import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { isBankTransferOption, type BankTransferOption } from "@/lib/bank-transfer";
import { sendInvoiceEmail } from "@/lib/invoice-service";
import { invoiceNumberForBooking } from "@/lib/invoice-reference";
import { parseAmountCents, rentalDays } from "@/lib/payment-flow";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { bookingId?: string; hireAmount?: unknown; securityDepositAmount?: unknown; bankTransferOption?: unknown; gstInclusive?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const bookingId = body.bookingId?.trim();
  if (body.bankTransferOption !== undefined && !isBankTransferOption(body.bankTransferOption)) {
    return NextResponse.json({ error: "A valid bank-transfer option is required." }, { status: 400 });
  }
  if (body.gstInclusive !== undefined && typeof body.gstInclusive !== "boolean") {
    return NextResponse.json({ error: "GST-inclusive selection must be true or false." }, { status: 400 });
  }
  const bankTransferOption: BankTransferOption = body.bankTransferOption === undefined ? "both" : body.bankTransferOption;
  const gstInclusive = body.gstInclusive !== false;
  const hireAmountCents = parseAmountCents(body.hireAmount);
  const securityDepositCents = parseAmountCents(body.securityDepositAmount);
  if (!bookingId || hireAmountCents === null || hireAmountCents < 1 || securityDepositCents === null || securityDepositCents < 0) {
    return NextResponse.json({ error: "Booking ID, hire amount, and a valid security deposit amount are required." }, { status: 400 });
  }

  const result = await session.admin.from("bookings")
    .select("id,status,pickup_date,dropoff_date,payment_method,hire_amount_cents,security_deposit_cents,gst_inclusive")
    .eq("id", bookingId)
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
  if (result.data.status !== "confirmed") return NextResponse.json({ error: "Only confirmed bookings can receive a payment request." }, { status: 400 });
  if (rentalDays(result.data.pickup_date, result.data.dropoff_date) === null) return NextResponse.json({ error: "The booking dates are invalid." }, { status: 400 });
  if (result.data.payment_method === "stripe_card_hold") {
    return NextResponse.json({ error: "This booking is already configured for Stripe. Do not create a second payment method." }, { status: 409 });
  }
  if (result.data.payment_method === "bank_transfer" && (result.data.hire_amount_cents !== hireAmountCents || result.data.security_deposit_cents !== securityDepositCents || (result.data.gst_inclusive ?? true) !== gstInclusive)) {
    return NextResponse.json({ error: "A bank-transfer invoice already exists for this booking with different amounts. Do not replace it silently." }, { status: 409 });
  }

  const reference = invoiceNumberForBooking(bookingId);
  const update = await session.admin.from("bookings").update({
    payment_method: "bank_transfer",
    hire_amount_cents: hireAmountCents,
    security_deposit_cents: securityDepositCents,
    gst_inclusive: gstInclusive,
    hire_payment_status: "bank_transfer_pending",
    deposit_payment_status: securityDepositCents > 0 ? "bank_transfer_pending" : "not_required",
    bank_transfer_option: bankTransferOption,
    bank_transfer_reference: reference,
    updated_at: new Date().toISOString(),
  }).eq("id", bookingId);
  if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });
  try {
    const invoiceEmailId = await sendInvoiceEmail(session.admin, bookingId, null, false, bankTransferOption);
    return NextResponse.json({ ok: true, reference, invoiceEmailId, gstInclusive });
  } catch (error) {
    console.error("Bank-transfer invoice email failed:", error);
    return NextResponse.json({ error: error instanceof Error ? `Bank transfer recorded but invoice email failed: ${error.message}` : "Bank transfer recorded but invoice email failed." }, { status: 502 });
  }
}
