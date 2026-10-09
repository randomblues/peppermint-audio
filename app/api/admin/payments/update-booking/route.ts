import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { isBankTransferOption, type BankTransferOption } from "@/lib/bank-transfer";
import { lineItemsTotalCents, parseBookingLineItems, type BookingLineItem } from "@/lib/booking-line-items";
import { sendInvoiceEmail } from "@/lib/invoice-service";
import { invoiceNumberForBooking } from "@/lib/invoice-reference";
import { parseInvoiceRecipient } from "@/lib/invoice-recipient";
import { MAX_STRIPE_HIRE_DAYS, depositHoldDate, paymentLinkExpiry, parseAmountCents, rentalDays } from "@/lib/payment-flow";
import { getStripe } from "@/lib/stripe";

type PaymentMethod = "stripe_card_hold" | "bank_transfer" | "cash_on_pickup";

type UpdateRequest = {
  bookingId?: string;
  paymentMethod?: unknown;
  hireLineItems?: unknown;
  securityDepositAmount?: unknown;
  gstInclusive?: unknown;
  bankTransferOption?: unknown;
  billToName?: unknown;
  billToEmail?: unknown;
  saveOnly?: unknown;
};

function isMissingStripeCustomerError(error: unknown) {
  const maybeStripeError = error as { code?: unknown; message?: unknown };
  return maybeStripeError.code === "resource_missing"
    && typeof maybeStripeError.message === "string"
    && /no such customer/i.test(maybeStripeError.message);
}

async function ensureStripeCustomerId(
  stripe: ReturnType<typeof getStripe>,
  booking: { stripe_customer_id: string | null; email: string; first_name: string; last_name: string },
  bookingId: string,
) {
  const existingCustomerId = booking.stripe_customer_id?.trim();
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!("deleted" in customer && customer.deleted)) return existingCustomerId;
    } catch (error) {
      if (!isMissingStripeCustomerError(error)) throw error;
    }
  }
  return (await stripe.customers.create({
    email: booking.email,
    name: `${booking.first_name} ${booking.last_name}`,
    metadata: { bookingId, invoiceNumber: invoiceNumberForBooking(bookingId) },
  })).id;
}

function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

async function cancelPendingIntent(stripe: ReturnType<typeof getStripe>, paymentIntentId: string | null | undefined) {
  if (!paymentIntentId) return;
  let intent: Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>>;
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    const maybeStripeError = error as { code?: string; type?: string; message?: string };
    const missingIntent = maybeStripeError.code === "resource_missing"
      || (maybeStripeError.type === "StripeInvalidRequestError" && maybeStripeError.message?.includes("No such payment_intent"));
    if (missingIntent) return;
    throw error;
  }
  if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(intent.status)) {
    await stripe.paymentIntents.cancel(paymentIntentId);
  }
}

function paymentIsSettled(booking: Record<string, unknown>) {
  return ["paid", "succeeded", "captured", "bank_transfer_received"].includes(String(booking.hire_payment_status))
    || ["authorized", "captured", "bank_transfer_received"].includes(String(booking.deposit_payment_status));
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: UpdateRequest;
  try {
    body = await request.json() as UpdateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bookingId = body.bookingId?.trim();
  const requestedMethod = body.paymentMethod;
  const paymentMethod: PaymentMethod | null = requestedMethod === "stripe_card_hold" || requestedMethod === "bank_transfer" || requestedMethod === "cash_on_pickup"
    ? requestedMethod
    : null;
  const recipientResult = parseInvoiceRecipient(body);
  if (recipientResult.error) return NextResponse.json({ error: recipientResult.error }, { status: 400 });
  if (!bookingId || body.hireLineItems === undefined) {
    return NextResponse.json({ error: "Booking ID and hire items are required." }, { status: 400 });
  }
  if (body.paymentMethod !== undefined && !paymentMethod) {
    return NextResponse.json({ error: "A valid payment method is required." }, { status: 400 });
  }
  if (body.gstInclusive !== undefined && typeof body.gstInclusive !== "boolean") {
    return NextResponse.json({ error: "GST-inclusive selection must be true or false." }, { status: 400 });
  }
  if (body.saveOnly !== undefined && typeof body.saveOnly !== "boolean") {
    return NextResponse.json({ error: "Save-only selection must be true or false." }, { status: 400 });
  }
  if (body.bankTransferOption !== undefined && !isBankTransferOption(body.bankTransferOption)) {
    return NextResponse.json({ error: "A valid bank-transfer option is required." }, { status: 400 });
  }

  const parsedLineItems = parseBookingLineItems(body.hireLineItems);
  if ("error" in parsedLineItems) return NextResponse.json({ error: parsedLineItems.error }, { status: 400 });
  const hireLineItems: BookingLineItem[] = parsedLineItems.items;
  const securityDepositCents = body.securityDepositAmount === undefined ? null : parseAmountCents(body.securityDepositAmount);
  if (!lineItemsTotalCents(hireLineItems) || (securityDepositCents !== null && securityDepositCents < 0)) {
    return NextResponse.json({ error: "Add at least one priced hire item and enter a valid security deposit amount." }, { status: 400 });
  }

  const existing = await session.admin.from("bookings").select("*").eq("id", bookingId).single();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  if (!existing.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
  const nights = rentalDays(existing.data.pickup_date, existing.data.dropoff_date);
  if (nights === null) return NextResponse.json({ error: "The booking dates are invalid." }, { status: 400 });
  const hireAmountCents = lineItemsTotalCents(hireLineItems, nights);
  if (!["submitted", "confirmed"].includes(existing.data.status)) return NextResponse.json({ error: "Only submitted or confirmed bookings can be updated." }, { status: 400 });
  if (paymentIsSettled(existing.data)) {
    return NextResponse.json({ error: "This booking has been paid or its deposit has been processed. Create a separate booking for additional items." }, { status: 409 });
  }

  const targetMethod = paymentMethod ?? existing.data.payment_method as PaymentMethod | null;
  const depositCents = securityDepositCents ?? existing.data.security_deposit_cents ?? 0;
  const gstInclusive = body.gstInclusive ?? existing.data.gst_inclusive ?? true;
  const bankTransferOption: BankTransferOption = body.bankTransferOption ?? existing.data.bank_transfer_option ?? "both";
  const update: Record<string, unknown> = {
    hire_line_items: hireLineItems,
    hire_amount_cents: hireAmountCents,
    updated_at: new Date().toISOString(),
  };

  try {
    if (body.saveOnly === true) {
      const write = await session.admin.from("bookings").update(update).eq("id", bookingId);
      if (write.error) return NextResponse.json({ error: write.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, bookingId, hireAmountCents });
    }

    Object.assign(update, {
      security_deposit_cents: depositCents,
      gst_inclusive: gstInclusive,
      deposit_hold_date: null,
      deposit_consent_at: null,
      deposit_capture_before: null,
      deposit_error: null,
      deposit_attention_sent_at: null,
    });

    if (!targetMethod) {
      const write = await session.admin.from("bookings").update(update).eq("id", bookingId);
      if (write.error) return NextResponse.json({ error: write.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, bookingId, hireAmountCents, securityDepositCents: depositCents, gstInclusive });
    }

    if (targetMethod === "bank_transfer" || targetMethod === "cash_on_pickup") {
      const pendingStatus = targetMethod === "cash_on_pickup" ? "cash_due" : "bank_transfer_pending";
      if (existing.data.hire_payment_status && existing.data.hire_payment_status !== pendingStatus && existing.data.payment_method === targetMethod) {
        return NextResponse.json({ error: `This ${targetMethod === "cash_on_pickup" ? "cash-on-pickup" : "bank-transfer"} booking is no longer pending.` }, { status: 409 });
      }
      if (existing.data.payment_method === "stripe_card_hold") {
        const stripe = getStripe();
        await cancelPendingIntent(stripe, existing.data.stripe_hire_payment_intent_id);
        await cancelPendingIntent(stripe, existing.data.stripe_deposit_payment_intent_id);
      }
      Object.assign(update, {
        payment_method: targetMethod,
        bank_transfer_option: bankTransferOption,
        hire_payment_status: pendingStatus,
        deposit_payment_status: depositCents > 0 ? pendingStatus : "not_required",
        stripe_hire_payment_intent_id: null,
        stripe_deposit_payment_intent_id: null,
        payment_token: null,
        payment_token_expires_at: null,
        bank_transfer_reference: invoiceNumberForBooking(bookingId),
      });
    } else {
      const days = rentalDays(existing.data.pickup_date, existing.data.dropoff_date);
      if (days === null || days > MAX_STRIPE_HIRE_DAYS) {
        return NextResponse.json({ error: `Stripe card authorisations are limited to hires of ${MAX_STRIPE_HIRE_DAYS} days or less. Use bank transfer for this booking.` }, { status: 400 });
      }
      if (existing.data.payment_method === "bank_transfer" && existing.data.hire_payment_status !== "bank_transfer_pending") {
        return NextResponse.json({ error: "This bank-transfer booking is no longer pending." }, { status: 409 });
      }
      const stripe = getStripe();
      if (existing.data.payment_method === "stripe_card_hold") {
        await cancelPendingIntent(stripe, existing.data.stripe_hire_payment_intent_id);
        await cancelPendingIntent(stripe, existing.data.stripe_deposit_payment_intent_id);
      }
      const customerId = await ensureStripeCustomerId(stripe, existing.data, bookingId);
      const hirePaymentIntent = await stripe.paymentIntents.create({
        amount: hireAmountCents,
        currency: "aud",
        customer: customerId,
        allowed_payment_method_types: ["card"],
        ...(depositCents > 0 ? { setup_future_usage: "off_session" as const } : {}),
        description: `Peppermint Audio hire · ${invoiceNumberForBooking(bookingId)}`,
        metadata: { bookingId, invoiceNumber: invoiceNumberForBooking(bookingId), paymentType: "hire", depositSchedule: depositCents > 0 ? "deferred" : "none" },
      });
      Object.assign(update, {
        payment_method: "stripe_card_hold",
        hire_payment_status: "pending",
        deposit_payment_status: depositCents > 0 ? "scheduled" : "not_required",
        deposit_hold_date: depositCents > 0 ? depositHoldDate(existing.data.pickup_date) : null,
        stripe_customer_id: customerId,
        stripe_hire_payment_intent_id: hirePaymentIntent.id,
        stripe_deposit_payment_intent_id: null,
        payment_token: crypto.randomUUID(),
        payment_token_expires_at: paymentLinkExpiry(existing.data.dropoff_date),
        bank_transfer_reference: null,
      });
    }

    const write = await session.admin.from("bookings").update(update).eq("id", bookingId);
    if (write.error) throw new Error(`Booking payment details could not be saved: ${write.error.message}`);
    const nextPaymentUrl = targetMethod === "stripe_card_hold" ? `${siteUrl(request)}/pay/${String(update.payment_token)}` : null;
    const invoiceEmailId = await sendInvoiceEmail(
      session.admin,
      bookingId,
      nextPaymentUrl,
      true,
      targetMethod === "bank_transfer" ? bankTransferOption : undefined,
      recipientResult.recipient,
      true,
      true,
    );
    return NextResponse.json({ ok: true, bookingId, reference: invoiceNumberForBooking(bookingId), paymentUrl: nextPaymentUrl, hireAmountCents, securityDepositCents: depositCents, gstInclusive, invoiceEmailId });
  } catch (error) {
    console.error("Existing booking update failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The booking could not be updated." }, { status: 502 });
  }
}
