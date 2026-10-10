import type Stripe from "stripe";
import { EmailTransport as Resend, emailConfiguration } from "@/lib/email-transport";

import { createAdminClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { depositHoldCoversReturn, formatAudCents, MAX_STRIPE_HIRE_DAYS, rentalDays } from "@/lib/payment-flow";
import { getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";
import { recordCustomerEmail } from "@/lib/email-log";

type Admin = ReturnType<typeof createAdminClient>;
export type DeferredDepositBooking = {
  id: string;
  status: string;
  email: string;
  first_name: string;
  pickup_date: string;
  dropoff_date: string;
  dropoff_time: string | null;
  payment_method: string | null;
  hire_payment_status: string;
  security_deposit_cents: number;
  stripe_customer_id: string | null;
  stripe_hire_payment_intent_id: string | null;
  stripe_deposit_payment_intent_id: string | null;
  deposit_hold_date: string | null;
  deposit_consent_at: string | null;
  deposit_payment_status: string;
  deposit_capture_before: string | null;
  deposit_error: string | null;
  deposit_attention_sent_at: string | null;
  payment_token: string | null;
};

export async function readDepositBooking(admin: Admin, bookingId: string): Promise<DeferredDepositBooking | null> {
  const result = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (result.error) throw new Error(`Deposit booking lookup failed: ${result.error.message}`);
  return result.data;
}

export async function releaseCancelledDeferredDeposit(admin: Admin, bookingId: string) {
  const booking = await readDepositBooking(admin, bookingId);
  if (!booking || booking.status !== "cancelled" || !booking.deposit_hold_date || !booking.stripe_deposit_payment_intent_id) return;
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(booking.stripe_deposit_payment_intent_id);
  if (["canceled", "succeeded"].includes(intent.status)) return;
  await stripe.paymentIntents.update(intent.id, { metadata: { releaseRequested: "true" } });
  await stripe.paymentIntents.cancel(intent.id);
  await saveDeposit(admin, booking, { deposit_payment_status: "released", deposit_released_at: new Date().toISOString(), deposit_error: null });
}

async function saveDeposit(admin: Admin, booking: DeferredDepositBooking, updates: Record<string, unknown>) {
  const result = await admin.from("bookings").update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", booking.id).eq("stripe_hire_payment_intent_id", booking.stripe_hire_payment_intent_id)
    .select("id").maybeSingle();
  if (result.error || !result.data) {
    throw new Error(`Deposit status could not be saved: ${result.error?.message ?? "booking changed or no longer exists"}`);
  }
}

export async function syncDeferredDeposit(admin: Admin, booking: DeferredDepositBooking, intent: Stripe.PaymentIntent) {
  if (intent.metadata.bookingId !== booking.id || intent.metadata.paymentType !== "deposit") {
    throw new Error("Deposit intent does not belong to this booking.");
  }
  let status: string;
  let error: string | null = null;
  let captureBefore: number | null = null;
  if (intent.status === "requires_capture") {
    const charge = intent.latest_charge;
    if (charge && typeof charge !== "string") captureBefore = charge.payment_method_details?.card?.capture_before ?? null;
    if (!["submitted", "confirmed"].includes(booking.status)) {
      await getStripe().paymentIntents.update(intent.id, { metadata: { releaseRequested: "true" } });
      await getStripe().paymentIntents.cancel(intent.id);
      status = "released";
    } else if (!depositHoldCoversReturn(captureBefore, booking.dropoff_date, booking.dropoff_time)) {
      await getStripe().paymentIntents.update(intent.id, { metadata: { holdTooShort: "true" } });
      await getStripe().paymentIntents.cancel(intent.id);
      status = "hold_too_short";
      error = "The actual card hold expiry does not cover return and check-in. Arrange an alternative deposit before handing over equipment.";
    } else {
      status = "authorized";
    }
  } else if (intent.status === "requires_action") {
    status = "action_required";
    error = "Customer authentication is required for the security-deposit hold.";
  } else if (intent.status === "requires_payment_method") {
    status = "failed";
    error = intent.last_payment_error?.message ?? "The card could not authorise the security deposit.";
  } else if (intent.status === "canceled") {
    status = booking.deposit_payment_status === "hold_too_short" || intent.metadata.holdTooShort === "true" ? "hold_too_short"
      : booking.deposit_payment_status === "released" || intent.metadata.releaseRequested === "true" ? "released" : "expired";
    error = status === "expired" ? "The deposit authorisation expired or was cancelled before release was recorded." : booking.deposit_error;
  } else if (intent.status === "succeeded") {
    status = "captured";
  } else {
    status = "authorizing";
  }
  await saveDeposit(admin, booking, {
    deposit_payment_status: status,
    deposit_capture_before: captureBefore ? new Date(captureBefore * 1000).toISOString() : null,
    deposit_error: error,
    ...(status === "captured" ? { deposit_captured_cents: intent.amount_received, deposit_captured_at: new Date().toISOString() } : {}),
    ...(status === "released" ? { deposit_released_at: new Date().toISOString() } : {}),
  });
  return status;
}

export async function attemptDeferredDeposit(admin: Admin, bookingId: string, now = new Date()) {
  const booking = await readDepositBooking(admin, bookingId);
  if (!booking || !booking.deposit_hold_date || booking.payment_method !== "stripe_card_hold") return;
  if (!["submitted", "confirmed"].includes(booking.status) || booking.hire_payment_status !== "paid"
    || booking.security_deposit_cents <= 0 || booking.deposit_hold_date >= getMelbourneTomorrow(now)) return;
  if (!["scheduled", "authorizing"].includes(booking.deposit_payment_status)) return;
  const today = new Date(Date.parse(`${getMelbourneTomorrow(now)}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (booking.pickup_date < today) {
    await saveDeposit(admin, booking, { deposit_payment_status: "expired", deposit_error: "The scheduled deposit hold was missed before pickup. Arrange the deposit manually; no late automatic hold was placed." });
    return;
  }
  if (!booking.deposit_consent_at) throw new Error("Deposit card-saving consent has not been recorded.");
  const days = rentalDays(booking.pickup_date, booking.dropoff_date);
  if (days === null || days > MAX_STRIPE_HIRE_DAYS) throw new Error("This hire is not eligible for an automatic deposit hold.");
  if (!booking.stripe_customer_id || !booking.stripe_hire_payment_intent_id) throw new Error("Saved card details are missing.");

  const stripe = getStripe();
  let intent: Stripe.PaymentIntent;
  if (booking.stripe_deposit_payment_intent_id) {
    intent = await stripe.paymentIntents.retrieve(booking.stripe_deposit_payment_intent_id, { expand: ["latest_charge"] });
  } else {
    const hire = await stripe.paymentIntents.retrieve(booking.stripe_hire_payment_intent_id);
    const customerId = typeof hire.customer === "string" ? hire.customer : hire.customer?.id;
    const paymentMethodId = typeof hire.payment_method === "string" ? hire.payment_method : hire.payment_method?.id;
    if (hire.status !== "succeeded" || hire.metadata.bookingId !== booking.id || customerId !== booking.stripe_customer_id || !paymentMethodId) {
      throw new Error("The paid hire does not have a verified saved card.");
    }
    intent = await stripe.paymentIntents.create({
      amount: booking.security_deposit_cents,
      currency: "aud",
      customer: booking.stripe_customer_id,
      payment_method: paymentMethodId,
      allowed_payment_method_types: ["card"],
      capture_method: "manual",
      description: "Peppermint Audio security-deposit hold",
      metadata: { bookingId: booking.id, paymentType: "deposit", deferredDeposit: "true" },
    }, { idempotencyKey: `deposit-create-${hire.id}` });
    // Persist the intent before confirming so retries cannot create another hold.
    await saveDeposit(admin, booking, { stripe_deposit_payment_intent_id: intent.id, deposit_payment_status: "authorizing" });
  }
  const intentCustomerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
  if (intent.metadata.bookingId !== booking.id || intent.metadata.paymentType !== "deposit"
    || intent.amount !== booking.security_deposit_cents || intent.currency !== "aud"
    || intentCustomerId !== booking.stripe_customer_id) {
    throw new Error("The saved deposit intent does not match this booking's card and amount.");
  }
  if (intent.status === "requires_confirmation") {
    const current = await readDepositBooking(admin, booking.id);
    if (!current || !["submitted", "confirmed"].includes(current.status)
      || current.stripe_hire_payment_intent_id !== booking.stripe_hire_payment_intent_id) {
      await stripe.paymentIntents.cancel(intent.id);
      return;
    }
    try {
      intent = await stripe.paymentIntents.confirm(intent.id, { off_session: true, expand: ["latest_charge"] },
        { idempotencyKey: `deposit-confirm-${intent.id}` });
    } catch (cause) {
      if (!(cause instanceof Error) || !("payment_intent" in cause) || !cause.payment_intent) throw cause;
      // Stripe may throw for a decline/authentication requirement; retrieve its real state.
      intent = await stripe.paymentIntents.retrieve(intent.id, { expand: ["latest_charge"] });
    }
  }
  return syncDeferredDeposit(admin, booking, intent);
}

export async function notifyDepositAttention(admin: Admin, booking: DeferredDepositBooking) {
  if (!["submitted", "confirmed"].includes(booking.status)) return;
  if (!["failed", "action_required", "hold_too_short", "expired"].includes(booking.deposit_payment_status)
    || booking.deposit_attention_sent_at) return;
  const { apiKey, from, to } = emailConfiguration();
  if (!apiKey || !from || !to) throw new Error("Deposit notification email service is not configured.");
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://peppermint-audio.vercel.app").replace(/\/$/, "");
  const actionable = ["failed", "action_required"].includes(booking.deposit_payment_status) && booking.payment_token;
  const message = actionable
    ? `Please complete your ${formatAudCents(booking.security_deposit_cents)} security-deposit hold before pickup using your secure payment link. Your hire payment has already been received.`
    : "Please contact Peppermint Audio before pickup to arrange your security deposit. Your hire payment has already been received.";
  const url = actionable ? `${origin}/pay/${encodeURIComponent(booking.payment_token!)}` : null;
  const resend = new Resend(apiKey);
  const key = `${booking.id}-${booking.stripe_deposit_payment_intent_id}-${booking.deposit_payment_status}`;
  const internal = await resend.emails.send({
    from, to: [to], subject: `Deposit needs attention: ${booking.id}`,
    text: `Booking: ${booking.id}\nPickup: ${booking.pickup_date}\nDeposit status: ${booking.deposit_payment_status}\n${booking.deposit_error ?? ""}\nDo not hand over equipment without securing the deposit.`,
  }, { idempotencyKey: `deposit-admin-${key}` });
  if (internal.error) throw new Error(`Deposit admin alert failed: ${internal.error.message}`);
  const customer = await resend.emails.send({
    from, to: [booking.email], subject: "Your security deposit needs attention",
    text: `Hi ${booking.first_name},\n\n${message}${url ? `\n${url}` : ""}`,
    html: emailLayout({
      eyebrow: "Security deposit", title: "Please arrange your deposit before pickup",
      intro: `Hi ${escapeEmailHtml(booking.first_name)}, ${escapeEmailHtml(message)}`,
      content: url ? emailPanel(`<a href="${escapeEmailHtml(url)}">Complete your security-deposit hold</a>`, "accent") : "",
    }),
  }, { idempotencyKey: `deposit-customer-${key}` });
  if (customer.error) throw new Error(`Deposit customer email failed: ${customer.error.message}`);
  await recordCustomerEmail(admin, { bookingId: booking.id, recipientEmail: booking.email, emailType: "custom", providerMessageId: customer.data?.id });
  await saveDeposit(admin, booking, { deposit_attention_sent_at: new Date().toISOString() });
}
