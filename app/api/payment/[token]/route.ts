import { NextResponse } from "next/server";

import { lineItemsForBooking } from "@/lib/booking-line-items";
import { createAdminClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { readDepositBooking, syncDeferredDeposit } from "@/lib/deferred-deposits";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Payment link is invalid." }, { status: 400 });

  const admin = createAdminClient();
  const result = await admin.from("bookings")
    .select("id,status,first_name,last_name,email,pickup_date,dropoff_date,event_type,hire_line_items,hire_amount_cents,security_deposit_cents,payment_method,hire_payment_status,deposit_payment_status,deposit_hold_date,deposit_consent_at,stripe_hire_payment_intent_id,stripe_deposit_payment_intent_id,payment_token_expires_at")
    .eq("payment_token", token)
    .single();
  if (result.error) return NextResponse.json({ error: "Payment link could not be found." }, { status: 404 });
  if (!result.data || result.data.payment_method !== "stripe_card_hold") {
    return NextResponse.json({ error: "This payment link is not available." }, { status: 404 });
  }
  if (result.data.status && !["submitted", "confirmed"].includes(result.data.status)) {
    return NextResponse.json({ error: "This booking is no longer available for payment." }, { status: 410 });
  }
  if (!result.data.payment_token_expires_at || new Date(result.data.payment_token_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This payment link has expired. Please contact Peppermint Audio for a new link." }, { status: 410 });
  }

  try {
    const stripe = getStripe();
    const [hirePaymentIntent, depositPaymentIntent] = await Promise.all([
      result.data.stripe_hire_payment_intent_id
        ? stripe.paymentIntents.retrieve(result.data.stripe_hire_payment_intent_id)
        : null,
      result.data.stripe_deposit_payment_intent_id
        ? stripe.paymentIntents.retrieve(result.data.stripe_deposit_payment_intent_id)
        : null,
    ]);
    if (hirePaymentIntent && hirePaymentIntent.metadata.bookingId !== result.data.id) {
      return NextResponse.json({ error: "Payment link verification failed." }, { status: 500 });
    }
    if (depositPaymentIntent && depositPaymentIntent.metadata.bookingId !== result.data.id) {
      return NextResponse.json({ error: "Payment link verification failed." }, { status: 500 });
    }
    return NextResponse.json({
      customerName: `${result.data.first_name} ${result.data.last_name}`,
      email: result.data.email,
      eventType: result.data.event_type,
      pickupDate: result.data.pickup_date,
      dropoffDate: result.data.dropoff_date,
      hireLineItems: lineItemsForBooking(result.data),
      hireAmountCents: result.data.hire_amount_cents,
      securityDepositCents: result.data.security_deposit_cents,
      hirePaymentStatus: hirePaymentIntent?.status === "succeeded" ? "paid" : result.data.hire_payment_status,
      depositPaymentStatus: depositPaymentIntent?.status === "requires_capture" && !result.data.deposit_hold_date ? "authorized" : result.data.deposit_payment_status,
      depositHoldDate: result.data.deposit_hold_date ?? null,
      depositConsentRecorded: Boolean(result.data.deposit_consent_at),
      hireClientSecret: hirePaymentIntent?.status === "succeeded" ? null : hirePaymentIntent?.client_secret ?? null,
      depositClientSecret: depositPaymentIntent?.status === "succeeded" || depositPaymentIntent?.status === "canceled" || depositPaymentIntent?.status === "requires_capture"
        ? null
        : depositPaymentIntent?.client_secret ?? null,
    });
  } catch (error) {
    console.error("Payment link lookup failed:", error);
    return NextResponse.json({ error: "Payment link could not be loaded." }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  let body: { consent?: unknown; verifyDeposit?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const verifyingDeposit = body?.verifyDeposit === true;
  if (body?.consent !== true && !verifyingDeposit) return NextResponse.json({ error: "Consent to save your card and place the deposit hold is required." }, { status: 400 });
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Payment link is invalid." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const result = await admin.from("bookings").select("id,status,payment_method,payment_token_expires_at,deposit_hold_date")
      .eq("payment_token", token).single();
    if (result.error || !result.data) return NextResponse.json({ error: "Payment link could not be found." }, { status: 404 });
    const booking = result.data;
    if (booking.payment_method !== "stripe_card_hold" || !booking.deposit_hold_date
      || !["submitted", "confirmed"].includes(booking.status)
      || !booking.payment_token_expires_at || Date.parse(booking.payment_token_expires_at) <= Date.now()) {
      return NextResponse.json({ error: "This payment link is no longer available." }, { status: 410 });
    }
    if (verifyingDeposit) {
      const current = await readDepositBooking(admin, booking.id);
      if (!current?.stripe_deposit_payment_intent_id || !current.deposit_consent_at) {
        return NextResponse.json({ error: "Your deposit hold is not ready. Please contact Peppermint Audio." }, { status: 409 });
      }
      const intent = await getStripe().paymentIntents.retrieve(current.stripe_deposit_payment_intent_id, { expand: ["latest_charge"] });
      const status = await syncDeferredDeposit(admin, current, intent);
      if (status !== "authorized") {
        return NextResponse.json({ error: "Your deposit could not be secured. Please contact Peppermint Audio before pickup." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, status });
    }
    const update = await admin.from("bookings").update({ deposit_consent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", booking.id).eq("payment_token", token);
    if (update.error) throw new Error(`Deposit consent could not be saved: ${update.error.message}`);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    console.error(verifyingDeposit ? "Deposit verification failed:" : "Deposit consent failed:", cause);
    return NextResponse.json({ error: verifyingDeposit
      ? "Your deposit could not be checked. Please try again or contact Peppermint Audio."
      : "Your card-saving consent could not be recorded. Please try again." }, { status: 500 });
  }
}
