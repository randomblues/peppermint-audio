import { NextResponse } from "next/server";

import { lineItemsForBooking } from "@/lib/booking-line-items";
import { createAdminClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Payment link is invalid." }, { status: 400 });

  const admin = createAdminClient();
  const result = await admin.from("bookings")
    .select("id,first_name,last_name,email,pickup_date,dropoff_date,event_type,hire_line_items,hire_amount_cents,security_deposit_cents,payment_method,hire_payment_status,deposit_payment_status,stripe_hire_payment_intent_id,stripe_deposit_payment_intent_id,payment_token_expires_at")
    .eq("payment_token", token)
    .single();
  if (result.error) return NextResponse.json({ error: "Payment link could not be found." }, { status: 404 });
  if (!result.data || result.data.payment_method !== "stripe_card_hold") {
    return NextResponse.json({ error: "This payment link is not available." }, { status: 404 });
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
      hirePaymentStatus: result.data.hire_payment_status,
      depositPaymentStatus: result.data.deposit_payment_status,
      hireClientSecret: hirePaymentIntent?.status === "succeeded" ? null : hirePaymentIntent?.client_secret ?? null,
      depositClientSecret: depositPaymentIntent?.status === "succeeded" || depositPaymentIntent?.status === "canceled"
        ? null
        : depositPaymentIntent?.client_secret ?? null,
    });
  } catch (error) {
    console.error("Payment link lookup failed:", error);
    return NextResponse.json({ error: "Payment link could not be loaded." }, { status: 502 });
  }
}
