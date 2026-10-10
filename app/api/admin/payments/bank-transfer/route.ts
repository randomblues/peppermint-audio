import { NextResponse } from "next/server";

import { requireAdminJson } from "@/lib/admin-request";
import { lineItemsForBooking, lineItemsTotalCents } from "@/lib/booking-line-items";
import { isBankTransferOption, type BankTransferOption } from "@/lib/bank-transfer";
import { sendInvoiceEmail } from "@/lib/invoice-service";
import { invoiceNumberForBooking } from "@/lib/invoice-reference";
import { parseInvoiceRecipient } from "@/lib/invoice-recipient";
import { parseAmountCents, rentalDays } from "@/lib/payment-flow";

export async function POST(request: Request) {
  const auth = await requireAdminJson<{ bookingId?: string; paymentMethod?: unknown; securityDepositAmount?: unknown; bankTransferOption?: unknown; gstInclusive?: unknown; billToName?: unknown; billToEmail?: unknown }>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;
  const bookingId = body.bookingId?.trim();
  const cashOnPickup = body.paymentMethod === "cash_on_pickup";
  if (body.paymentMethod !== undefined && body.paymentMethod !== "bank_transfer" && !cashOnPickup) {
    return NextResponse.json({ error: "A valid payment method is required." }, { status: 400 });
  }
  const recipientResult = parseInvoiceRecipient(body);
  if (recipientResult.error) return NextResponse.json({ error: recipientResult.error }, { status: 400 });
  if (!cashOnPickup && body.bankTransferOption !== undefined && !isBankTransferOption(body.bankTransferOption)) {
    return NextResponse.json({ error: "A valid bank-transfer option is required." }, { status: 400 });
  }
  if (body.gstInclusive !== undefined && typeof body.gstInclusive !== "boolean") {
    return NextResponse.json({ error: "GST-inclusive selection must be true or false." }, { status: 400 });
  }
  const bankTransferOption: BankTransferOption = isBankTransferOption(body.bankTransferOption) ? body.bankTransferOption : "both";
  const gstInclusive = body.gstInclusive !== false;
  const securityDepositCents = parseAmountCents(body.securityDepositAmount);
  if (!bookingId || securityDepositCents === null || securityDepositCents < 0) {
    return NextResponse.json({ error: "Booking ID and a valid security deposit amount are required." }, { status: 400 });
  }

  const result = await session.admin.from("bookings")
    .select("id,status,pickup_date,dropoff_date,hire_line_items,payment_method,hire_amount_cents,security_deposit_cents,gst_inclusive,hire_payment_status,deposit_payment_status")
    .eq("id", bookingId)
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
  if (["paid", "succeeded", "captured", "bank_transfer_received"].includes(result.data.hire_payment_status ?? "")
    || ["authorized", "captured", "bank_transfer_received", "bank_transfer_refunded"].includes(result.data.deposit_payment_status ?? "")) {
    return NextResponse.json({ error: "This booking has already been paid or its deposit has been processed. Resend its existing invoice instead." }, { status: 409 });
  }
  const hireLineItems = lineItemsForBooking(result.data);
  const nights = rentalDays(result.data.pickup_date, result.data.dropoff_date);
  if (nights === null) return NextResponse.json({ error: "The booking dates are invalid." }, { status: 400 });
  const hireAmountCents = lineItemsTotalCents(hireLineItems, nights);
  if (!hireAmountCents) return NextResponse.json({ error: "Add at least one priced hire item before creating an invoice." }, { status: 400 });
  if (!["submitted", "confirmed"].includes(result.data.status)) return NextResponse.json({ error: "Only submitted or confirmed bookings can receive a payment request." }, { status: 400 });
  if (result.data.payment_method === "stripe_card_hold") {
    return NextResponse.json({ error: "This booking is already configured for Stripe. Do not create a second payment method." }, { status: 409 });
  }
  if (result.data.payment_method === (cashOnPickup ? "cash_on_pickup" : "bank_transfer") && (result.data.hire_amount_cents !== hireAmountCents || result.data.security_deposit_cents !== securityDepositCents || (result.data.gst_inclusive ?? true) !== gstInclusive)) {
    return NextResponse.json({ error: "A bank-transfer invoice already exists for this booking with different amounts. Do not replace it silently." }, { status: 409 });
  }

  const reference = invoiceNumberForBooking(bookingId);
  const update = await session.admin.from("bookings").update({
    payment_method: cashOnPickup ? "cash_on_pickup" : "bank_transfer",
    hire_line_items: hireLineItems,
    hire_amount_cents: hireAmountCents,
    security_deposit_cents: securityDepositCents,
    gst_inclusive: gstInclusive,
    hire_payment_status: cashOnPickup ? "cash_due" : "bank_transfer_pending",
    deposit_payment_status: securityDepositCents > 0 ? (cashOnPickup ? "cash_due" : "bank_transfer_pending") : "not_required",
    bank_transfer_option: bankTransferOption,
    bank_transfer_reference: reference,
    updated_at: new Date().toISOString(),
  }).eq("id", bookingId);
  if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });
  try {
    const invoiceEmailId = await sendInvoiceEmail(session.admin, bookingId, null, false, bankTransferOption, recipientResult.recipient);
    return NextResponse.json({ ok: true, reference, invoiceEmailId, gstInclusive, ...(cashOnPickup ? { paymentMethod: "cash_on_pickup" } : {}) });
  } catch (error) {
    const paymentLabel = cashOnPickup ? "Cash-on-pickup booking recorded" : "Bank transfer recorded";
    console.error(`${paymentLabel}; invoice email failed:`, error);
    return NextResponse.json({ error: error instanceof Error ? `${paymentLabel} but invoice email failed: ${error.message}` : `${paymentLabel} but invoice email failed.` }, { status: 502 });
  }
}
