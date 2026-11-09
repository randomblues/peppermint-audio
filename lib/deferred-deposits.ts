import type Stripe from "stripe";
import { EmailTransport as Resend, emailConfiguration } from "@/lib/email-transport";

import { createAdminClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { depositHoldCoversReturn, formatAudCents, MAX_STRIPE_HIRE_DAYS, melbourneHour, rentalDays } from "@/lib/payment-flow";
import { getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { emailDetailsTable, emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";
import { recordCustomerEmail } from "@/lib/email-log";
import { sendDepositAttentionSms } from "@/lib/send-booking-sms";
import { depositDeclineCode } from "@/lib/deposit-decline-code";

type Admin = ReturnType<typeof createAdminClient>;
export type DeferredDepositBooking = {
  id: string;
  status: string;
  email: string;
  mobile: string;
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
  deposit_attention_sms_sent_at: string | null;
  deposit_attention_claimed_at: string | null;
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
    const declineCode = intent.last_payment_error?.decline_code;
    error = `${declineCode ? `[decline_code: ${declineCode}] ` : ""}${intent.last_payment_error?.message ?? "The card could not authorise the security deposit."}`;
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
  const tomorrow = getMelbourneTomorrow(now);
  const today = new Date(Date.parse(`${tomorrow}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (booking.pickup_date < today || booking.deposit_hold_date < today) {
    await saveDeposit(admin, booking, { deposit_payment_status: "expired", deposit_error: "The scheduled deposit hold was missed before pickup. Arrange the deposit manually; no late automatic hold was placed." });
    return;
  }
  if (booking.deposit_hold_date === today && melbourneHour(now) < 6) return;
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

const DEPOSIT_ATTENTION_CLAIM_TTL_MS = 15 * 60 * 1000;

async function claimDepositAttention(admin: Admin, booking: DeferredDepositBooking) {
  if (booking.deposit_attention_sent_at && booking.deposit_attention_sms_sent_at) return null;

  const now = new Date();
  const currentClaim = booking.deposit_attention_claimed_at;
  if (currentClaim && Date.parse(currentClaim) > now.getTime() - DEPOSIT_ATTENTION_CLAIM_TTL_MS) return null;

  const claimAt = now.toISOString();
  let query = admin.from("bookings").update({ deposit_attention_claimed_at: claimAt })
    .eq("id", booking.id);
  for (const field of ["deposit_attention_sent_at", "deposit_attention_sms_sent_at"] as const) {
    query = booking[field] ? query.eq(field, booking[field]) : query.is(field, null);
  }
  query = currentClaim
    ? query.eq("deposit_attention_claimed_at", currentClaim)
    : query.is("deposit_attention_claimed_at", null);
  const result = await query.select("id").maybeSingle();
  if (result.error) throw new Error(`Deposit notification claim failed: ${result.error.message}`);
  return result.data ? claimAt : null;
}

async function finishDepositAttention(
  admin: Admin, bookingId: string, claimAt: string,
  field: "deposit_attention_sent_at" | "deposit_attention_sms_sent_at",
) {
  const result = await admin.from("bookings")
    .update({ [field]: new Date().toISOString() })
    .eq("id", bookingId).eq("deposit_attention_claimed_at", claimAt)
    .is(field, null).select("id").maybeSingle();
  if (result.error || !result.data) {
    throw new Error(`Deposit notification status could not be saved: ${result.error?.message ?? "notification claim was lost"}`);
  }
}

async function releaseDepositAttentionClaim(admin: Admin, bookingId: string, claimAt: string) {
  const result = await admin.from("bookings").update({ deposit_attention_claimed_at: null })
    .eq("id", bookingId).eq("deposit_attention_claimed_at", claimAt).select("id").maybeSingle();
  if (result.error || !result.data) {
    throw new Error(`Deposit notification claim could not be released: ${result.error?.message ?? "notification claim was lost"}`);
  }
}

function customerDepositReason(status: string, error: string | null) {
  if (status === "action_required") {
    return "Your bank requires an additional verification step to authorise the security-deposit hold.";
  }
  if (status !== "failed") return null;

  const declineCode = depositDeclineCode(error);
  if (!declineCode) return null;
  const reasons: Record<string, string> = {
    insufficient_funds: "Your card issuer declined the deposit hold due to insufficient funds. Please add funds, use another card, or contact your bank.",
    expired_card: "The saved card appears to have expired. Please use another valid card through the secure payment link.",
    incorrect_cvc: "Your bank could not verify the card's security code. Please check the card details or use another card.",
    card_not_supported: "This card cannot be used for the deposit hold. Please try another card or contact your bank.",
    do_not_honor: "Your bank did not approve the deposit hold. Please contact your bank or try another card.",
    generic_decline: "Your bank did not approve the deposit hold. Please contact your bank or try another card.",
    transaction_not_allowed: "Your bank did not allow this type of deposit hold. Please contact your bank or try another card.",
    restricted_card: "Your bank has restricted this card for the deposit hold. Please contact your bank or try another card.",
    issuer_not_available: "Your bank could not be reached to approve the deposit hold. Please try again through the secure link or contact your bank.",
    processing_error: "The card provider could not process the deposit hold just now. Please try again through the secure link or use another card.",
    try_again_later: "Your bank could not approve the deposit hold just now. Please try again through the secure link or contact your bank.",
  };
  return Object.hasOwn(reasons, declineCode) ? reasons[declineCode] : null;
}

export async function notifyDepositAttention(admin: Admin, booking: DeferredDepositBooking) {
  if (!["submitted", "confirmed"].includes(booking.status)) return;
  if (!["failed", "action_required", "hold_too_short", "expired"].includes(booking.deposit_payment_status)
    || (booking.deposit_attention_sent_at && booking.deposit_attention_sms_sent_at)) return;
  // Compare-and-swap keeps the cron and Stripe webhook from sending the same alert concurrently.
  const claimAt = await claimDepositAttention(admin, booking);
  if (!claimAt) return;
  try {
    if (!booking.deposit_attention_sent_at) {
      await sendDepositAttentionEmails(admin, booking);
      await finishDepositAttention(admin, booking.id, claimAt, "deposit_attention_sent_at");
    }
    if (!booking.deposit_attention_sms_sent_at) {
      await sendDepositAttentionSms(booking);
      await finishDepositAttention(admin, booking.id, claimAt, "deposit_attention_sms_sent_at");
    }
  } catch (cause) {
    try {
      await releaseDepositAttentionClaim(admin, booking.id, claimAt);
    } catch (releaseCause) {
      throw new AggregateError([cause, releaseCause], "Deposit notification failed and its claim could not be released.");
    }
    throw cause;
  }
  await releaseDepositAttentionClaim(admin, booking.id, claimAt);
}

async function sendDepositAttentionEmails(admin: Admin, booking: DeferredDepositBooking) {
  const { apiKey, from, to } = emailConfiguration();
  if (!apiKey || !from || !to) throw new Error("Deposit notification email service is not configured.");
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://peppermint-audio.vercel.app").replace(/\/$/, "");
  const actionable = ["failed", "action_required"].includes(booking.deposit_payment_status) && booking.payment_token;
  const depositAmount = formatAudCents(booking.security_deposit_cents);
  const reason = customerDepositReason(booking.deposit_payment_status, booking.deposit_error);
  const customerMessage = actionable
    ? `${reason
      ? reason.replace("deposit hold", `${depositAmount} security-deposit hold`)
      : `We couldn't authorise the ${depositAmount} security-deposit hold on the card saved for your booking.`} Your hire payment has been received, but the deposit is still outstanding. Please use the secure link below to complete it before pickup.`
    : "We couldn't secure the security-deposit hold. Your hire payment has been received, but the deposit is still outstanding. Please contact us urgently to arrange it before pickup.";
  const deadlineMessage = "If the deposit has not been authorised by your scheduled pickup time, your booking will not go ahead and we will not be able to release the equipment.";
  const url = actionable ? `${origin}/pay/${encodeURIComponent(booking.payment_token!)}` : null;
  const resend = new Resend(apiKey);
  const key = `${booking.id}-${booking.stripe_deposit_payment_intent_id}-${booking.deposit_payment_status}`;
  const internal = await resend.emails.send({
    from, to: [to], subject: `Urgent: deposit hold failed before pickup (${booking.id})`,
    text: [
      `Urgent: the scheduled deposit hold failed for booking ${booking.id}.`,
      "Resolve this before pickup. Do not release equipment until the deposit is secured.",
      "",
      `Customer: ${booking.first_name} <${booking.email}>`,
      `Pickup date: ${booking.pickup_date}`,
      `Deposit: ${depositAmount}`,
      `Status: ${booking.deposit_payment_status}`,
      `Reason: ${booking.deposit_error ?? "No provider reason was recorded."}`,
      `Admin panel: ${origin}/admin`,
    ].join("\n"),
    html: emailLayout({
      eyebrow: "Action required",
      title: "Deposit hold failed",
      intro: "The scheduled security-deposit hold could not be authorised. Please resolve this before pickup; the booking must not proceed and equipment must not be released until the deposit is secured.",
      content: `${emailPanel(emailDetailsTable([
        { label: "Booking", value: booking.id },
        { label: "Customer", value: `${booking.first_name} <${booking.email}>` },
        { label: "Pickup date", value: booking.pickup_date },
        { label: "Deposit", value: depositAmount },
        { label: "Status", value: booking.deposit_payment_status },
        { label: "Reason", value: booking.deposit_error ?? "No provider reason was recorded." },
      ]), "warning")}${emailPanel(`<a href="${escapeEmailHtml(`${origin}/admin`)}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#16251f;color:#fff;text-decoration:none;font-weight:700">Open admin panel</a>`, "accent")}`,
    }),
  }, { idempotencyKey: `deposit-admin-${key}` });
  if (internal.error) throw new Error(`Deposit admin alert failed: ${internal.error.message}`);
  const customer = await resend.emails.send({
    from, to: [booking.email], subject: "Action required before pickup: security deposit",
    text: `Hi ${booking.first_name},\n\n${customerMessage}\n\n${url ? `${url}\n\n` : ""}${deadlineMessage}\n\nIf you need help, reply to this email or call 0452 316 823.`,
    html: emailLayout({
      eyebrow: "Action required",
      title: "Deposit required before pickup",
      intro: `Hi ${escapeEmailHtml(booking.first_name)}, ${escapeEmailHtml(customerMessage)}`,
      content: `${url
        ? emailPanel(`<a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#16251f;color:#fff;text-decoration:none;font-weight:700">Complete your deposit securely</a>`, "accent")
        : emailPanel("<p style=\"margin:0;color:#1d2823;font-size:14px;line-height:1.6\">Please reply to this email or call <a href=\"tel:+61452316823\" style=\"color:#17643e;font-weight:700\">0452 316 823</a> to arrange your deposit.</p>", "accent")}${emailPanel(`<p style="margin:0;color:#8f1d1d;font-size:14px;line-height:1.6"><strong>Important:</strong> ${escapeEmailHtml(deadlineMessage)}</p>`, "danger")}`,
    }),
  }, { idempotencyKey: `deposit-customer-${key}` });
  if (customer.error) throw new Error(`Deposit customer email failed: ${customer.error.message}`);
  await recordCustomerEmail(admin, { bookingId: booking.id, recipientEmail: booking.email, emailType: "custom", providerMessageId: customer.data?.id });
}
