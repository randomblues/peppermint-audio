import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { lineItemsForBooking, lineItemsTotalCents } from "@/lib/booking-line-items";
import { MAX_STRIPE_HIRE_DAYS, PAYMENT_LINK_VALIDITY_DAYS, parseAmountCents, rentalDays } from "@/lib/payment-flow";
import { sendInvoiceEmail } from "@/lib/invoice-service";
import { invoiceNumberForBooking } from "@/lib/invoice-reference";
import { parseInvoiceRecipient } from "@/lib/invoice-recipient";
import { getStripe } from "@/lib/stripe";

type PaymentRequest = {
  bookingId?: string;
  securityDepositAmount?: unknown;
  gstInclusive?: unknown;
  billToName?: unknown;
  billToEmail?: unknown;
};

function isMissingStripeCustomerError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const withCode = error as Error & { code?: unknown };
  return withCode.code === "resource_missing" && /no such customer/i.test(error.message);
}

async function ensureStripeCustomerId(
  stripe: ReturnType<typeof getStripe>,
  booking: { stripe_customer_id: string | null; email: string; first_name: string; last_name: string },
  bookingId: string,
  invoiceNumber: string,
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
    metadata: { bookingId, invoiceNumber },
  })).id;
}

function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: PaymentRequest;
  try {
    body = await request.json() as PaymentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bookingId = body.bookingId?.trim();
  const recipientResult = parseInvoiceRecipient(body);
  if (recipientResult.error) return NextResponse.json({ error: recipientResult.error }, { status: 400 });
  if (body.gstInclusive !== undefined && typeof body.gstInclusive !== "boolean") {
    return NextResponse.json({ error: "GST-inclusive selection must be true or false." }, { status: 400 });
  }
  const gstInclusive = body.gstInclusive !== false;
  const securityDepositCents = parseAmountCents(body.securityDepositAmount);
  if (!bookingId || securityDepositCents === null || securityDepositCents < 0) {
    return NextResponse.json({ error: "Booking ID and a valid security deposit amount are required." }, { status: 400 });
  }

  const result = await session.admin.from("bookings")
    .select("id,email,first_name,last_name,status,pickup_date,dropoff_date,hire_line_items,payment_method,hire_amount_cents,security_deposit_cents,gst_inclusive,payment_token,payment_token_expires_at,stripe_customer_id")
    .eq("id", bookingId)
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
  if (!["submitted", "confirmed"].includes(result.data.status)) return NextResponse.json({ error: "Only submitted or confirmed bookings can receive a payment request." }, { status: 400 });
  const hireLineItems = lineItemsForBooking(result.data);
  const hireAmountCents = lineItemsTotalCents(hireLineItems);
  if (!hireAmountCents) return NextResponse.json({ error: "Add at least one priced hire item before creating a payment request." }, { status: 400 });

  const days = rentalDays(result.data.pickup_date, result.data.dropoff_date);
  if (days === null) return NextResponse.json({ error: "The booking dates are invalid." }, { status: 400 });
  if (days > MAX_STRIPE_HIRE_DAYS) {
    return NextResponse.json({ error: `Stripe card authorisations are limited to hires of ${MAX_STRIPE_HIRE_DAYS} days or less. Use bank transfer for this booking.` }, { status: 400 });
  }
  if (result.data.payment_method === "bank_transfer") {
    return NextResponse.json({ error: "This booking is already configured for bank transfer. Do not create a second payment method." }, { status: 409 });
  }
  if (
    result.data.payment_method === "stripe_card_hold"
    && result.data.payment_token
    && result.data.payment_token_expires_at
    && new Date(result.data.payment_token_expires_at).getTime() > Date.now()
  ) {
    if (result.data.hire_amount_cents !== hireAmountCents || result.data.security_deposit_cents !== securityDepositCents) {
      return NextResponse.json({ error: "A payment link already exists for this booking with different amounts. Do not create a second active payment link." }, { status: 409 });
    }
    if ((result.data.gst_inclusive ?? true) !== gstInclusive) {
      return NextResponse.json({ error: "A payment link already exists with a different GST setting. Do not create a second active payment link." }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      days,
      paymentUrl: `${siteUrl(request)}/pay/${result.data.payment_token}`,
      paymentToken: result.data.payment_token,
      hireAmountCents,
      securityDepositCents,
      gstInclusive,
    });
  }

  try {
    const stripe = getStripe();
    const paymentToken = crypto.randomUUID();
    const paymentTokenExpiresAt = new Date(Date.now() + PAYMENT_LINK_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const invoiceNumber = invoiceNumberForBooking(bookingId);
    const customerId = await ensureStripeCustomerId(stripe, result.data, bookingId, invoiceNumber);
    const hirePaymentIntent = await stripe.paymentIntents.create({
      amount: hireAmountCents,
      currency: "aud",
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      setup_future_usage: "on_session",
      description: `Peppermint Audio hire · ${invoiceNumber}`,
      metadata: { bookingId, invoiceNumber, paymentType: "hire" },
    });
    const depositPaymentIntent = securityDepositCents > 0
      ? await stripe.paymentIntents.create({
        amount: securityDepositCents,
        currency: "aud",
          customer: customerId,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        capture_method: "manual",
        description: `Refundable security deposit · ${invoiceNumber}`,
        metadata: { bookingId, invoiceNumber, paymentType: "deposit" },
      })
      : null;

    const update = await session.admin.from("bookings").update({
      payment_method: "stripe_card_hold",
      hire_line_items: hireLineItems,
      hire_amount_cents: hireAmountCents,
      security_deposit_cents: securityDepositCents,
      gst_inclusive: gstInclusive,
      hire_payment_status: "pending",
      deposit_payment_status: securityDepositCents > 0 ? "pending" : "not_required",
      stripe_customer_id: customerId,
      stripe_hire_payment_intent_id: hirePaymentIntent.id,
      stripe_deposit_payment_intent_id: depositPaymentIntent?.id ?? null,
      payment_token: paymentToken,
      payment_token_expires_at: paymentTokenExpiresAt,
      bank_transfer_reference: null,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId);
    if (update.error) throw new Error(`Payment details could not be saved: ${update.error.message}`);
    const invoiceEmailId = await sendInvoiceEmail(session.admin, bookingId, `${siteUrl(request)}/pay/${paymentToken}`, false, undefined, recipientResult.recipient);

    return NextResponse.json({
      ok: true,
      days,
      paymentUrl: `${siteUrl(request)}/pay/${paymentToken}`,
      paymentToken,
      hireAmountCents,
      securityDepositCents,
      gstInclusive,
      invoiceEmailId,
    });
  } catch (error) {
    console.error("Stripe checkout creation failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Stripe payment links could not be created." }, { status: 502 });
  }
}
