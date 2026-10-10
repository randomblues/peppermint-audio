import { NextResponse } from "next/server";

import { requireAdminJson } from "@/lib/admin-request";
import { markInvoiceStatus, sendBillingDocument } from "@/lib/invoice-service";
import { parseAmountCents } from "@/lib/payment-flow";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const auth = await requireAdminJson<{ bookingId?: string; action?: "release" | "capture" | "bank_transfer_received" | "bank_transfer_deposit_refunded"; amount?: unknown }>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;
  const bookingId = body.bookingId?.trim();
  if (!bookingId || !["release", "capture", "bank_transfer_received", "bank_transfer_deposit_refunded"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "Booking ID and a valid deposit action are required." }, { status: 400 });
  }

  const result = await session.admin.from("bookings")
    .select("security_deposit_cents,stripe_deposit_payment_intent_id,deposit_payment_status,payment_method,deposit_hold_date,deposit_capture_before")
    .eq("id", bookingId)
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
  if (body.action === "bank_transfer_received" || body.action === "bank_transfer_deposit_refunded") {
    if (result.data.payment_method !== "bank_transfer") return NextResponse.json({ error: "This booking is not configured for bank transfer." }, { status: 400 });
    if (body.action === "bank_transfer_deposit_refunded" && result.data.deposit_payment_status !== "bank_transfer_received") {
      return NextResponse.json({ error: "The bank-transfer payment must be marked received before the deposit can be marked refunded." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const update = body.action === "bank_transfer_received"
      ? { hire_payment_status: "bank_transfer_received", deposit_payment_status: result.data.security_deposit_cents > 0 ? "bank_transfer_received" : "not_required", payment_received_at: now, updated_at: now }
      : { deposit_payment_status: "bank_transfer_refunded", bank_transfer_refunded_at: now, deposit_released_at: now, updated_at: now };
    const write = await session.admin.from("bookings").update(update).eq("id", bookingId);
    if (write.error) return NextResponse.json({ error: write.error.message }, { status: 500 });
    try {
      const documentType = body.action === "bank_transfer_received" ? "payment_receipt" : "deposit_release";
      if (body.action === "bank_transfer_received") await markInvoiceStatus(session.admin, bookingId, "paid", now);
      const emailId = await sendBillingDocument(session.admin, bookingId, documentType);
      return NextResponse.json({ ok: true, status: update.deposit_payment_status, emailId });
    } catch (error) {
      console.error("Bank-transfer billing document failed:", error);
      return NextResponse.json({ error: error instanceof Error ? `Payment status updated but receipt email failed: ${error.message}` : "Payment status updated but receipt email failed." }, { status: 502 });
    }
  }
  if (result.data.deposit_payment_status !== "authorized" || !result.data.stripe_deposit_payment_intent_id) {
    return NextResponse.json({ error: "The security deposit is not currently authorised." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const now = new Date().toISOString();
    if (body.action === "release") {
      if (result.data.deposit_hold_date) {
        await stripe.paymentIntents.update(result.data.stripe_deposit_payment_intent_id, { metadata: { releaseRequested: "true" } });
      }
      await stripe.paymentIntents.cancel(result.data.stripe_deposit_payment_intent_id);
      const update = await session.admin.from("bookings").update({
        deposit_payment_status: "released",
        deposit_released_at: now,
        updated_at: now,
      }).eq("id", bookingId);
      if (update.error) throw new Error(`Deposit release could not be saved: ${update.error.message}`);
      const emailId = await sendBillingDocument(session.admin, bookingId, "deposit_release");
      return NextResponse.json({ ok: true, status: "released", emailId });
    }

    const amountCents = parseAmountCents(body.amount);
    if (result.data.deposit_capture_before && Date.parse(result.data.deposit_capture_before) <= Date.now()) {
      return NextResponse.json({ error: "The security-deposit hold has expired. Do not attempt capture." }, { status: 409 });
    }
    if (amountCents === null || amountCents < 1 || amountCents > result.data.security_deposit_cents) {
      return NextResponse.json({ error: "Capture amount must be greater than zero and no more than the authorised deposit." }, { status: 400 });
    }
    await stripe.paymentIntents.capture(result.data.stripe_deposit_payment_intent_id, { amount_to_capture: amountCents });
    const update = await session.admin.from("bookings").update({
      deposit_payment_status: "captured",
      deposit_captured_cents: amountCents,
      deposit_captured_at: now,
      updated_at: now,
    }).eq("id", bookingId);
    if (update.error) throw new Error(`Deposit capture could not be saved: ${update.error.message}`);
    const emailId = await sendBillingDocument(session.admin, bookingId, "deposit_capture");
    return NextResponse.json({ ok: true, status: "captured", amountCents, emailId });
  } catch (error) {
    console.error("Stripe security-deposit action failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The security-deposit action could not be completed." }, { status: 502 });
  }
}
