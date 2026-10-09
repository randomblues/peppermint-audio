import Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase";
import { markInvoiceStatus, sendBillingDocument } from "@/lib/invoice-service";
import { getStripe } from "@/lib/stripe";
import { attemptDeferredDeposit, notifyDepositAttention, readDepositBooking, syncDeferredDeposit } from "@/lib/deferred-deposits";

async function updatePayment(bookingId: string, updates: Record<string, unknown>) {
  const admin = createAdminClient();
  const result = await admin.from("bookings").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", bookingId);
  if (result.error) throw new Error(`Payment webhook persistence failed: ${result.error.message}`);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return new Response("Stripe webhook is not configured.", { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid Stripe webhook signature.", { status: 400 });
  }

  try {
    if (event.type.startsWith("payment_intent.")) {
      const intent = event.data.object as Stripe.PaymentIntent;
      if (intent.metadata.paymentType === "hire" && intent.metadata.depositSchedule === "deferred" && intent.metadata.bookingId) {
        const booking = await readDepositBooking(createAdminClient(), intent.metadata.bookingId);
        if (!booking || booking.stripe_hire_payment_intent_id !== intent.id
          || (booking.hire_payment_status === "paid" && event.type !== "payment_intent.succeeded")) {
          return Response.json({ received: true });
        }
      }
      if (intent.metadata.paymentType === "deposit" && intent.metadata.deferredDeposit === "true" && intent.metadata.bookingId) {
        const admin = createAdminClient();
        const booking = await readDepositBooking(admin, intent.metadata.bookingId);
        // Ignore replaced intents and use current state for out-of-order delivery.
        if (!booking || booking.stripe_deposit_payment_intent_id !== intent.id) return Response.json({ received: true });
        const current = await getStripe().paymentIntents.retrieve(intent.id, { expand: ["latest_charge"] });
        const status = await syncDeferredDeposit(admin, booking, current);
        if (status === "authorized") await sendBillingDocument(admin, booking.id, "deposit_authorisation");
        if (status === "captured") await sendBillingDocument(admin, booking.id, "deposit_capture");
        if (status === "released") await sendBillingDocument(admin, booking.id, "deposit_release");
        const updated = await readDepositBooking(admin, booking.id);
        if (updated) await notifyDepositAttention(admin, updated);
        return Response.json({ received: true });
      }
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      const paymentType = session.metadata?.paymentType;
      if (bookingId && paymentType === "hire") {
        await updatePayment(bookingId, {
          hire_payment_status: session.payment_status === "paid" ? "paid" : "processing",
          stripe_hire_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
      } else if (bookingId && paymentType === "deposit") {
        await updatePayment(bookingId, {
          deposit_payment_status: "authorized",
          stripe_deposit_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
      }
    } else if (event.type === "payment_intent.amount_capturable_updated") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.bookingId;
      if (bookingId && paymentIntent.metadata.paymentType === "deposit") {
        await updatePayment(bookingId, {
          deposit_payment_status: "authorized",
          stripe_deposit_payment_intent_id: paymentIntent.id,
        });
        await sendBillingDocument(createAdminClient(), bookingId, "deposit_authorisation");
      }
    } else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.bookingId;
      if (bookingId && paymentIntent.metadata.paymentType === "hire") {
        const paidAt = new Date().toISOString();
        await updatePayment(bookingId, { hire_payment_status: "paid", stripe_hire_payment_intent_id: paymentIntent.id, payment_received_at: paidAt });
        await attemptDeferredDeposit(createAdminClient(), bookingId);
        const depositBooking = await readDepositBooking(createAdminClient(), bookingId);
        if (depositBooking) await notifyDepositAttention(createAdminClient(), depositBooking);
        await sendBillingDocument(createAdminClient(), bookingId, "payment_receipt");
        await markInvoiceStatus(createAdminClient(), bookingId, "paid", paidAt);
      } else if (bookingId && paymentIntent.metadata.paymentType === "deposit") {
        await updatePayment(bookingId, {
          deposit_payment_status: "captured",
          stripe_deposit_payment_intent_id: paymentIntent.id,
          deposit_captured_cents: paymentIntent.amount_received,
          deposit_captured_at: new Date().toISOString(),
        });
        await sendBillingDocument(createAdminClient(), bookingId, "deposit_capture");
      }
    } else if (event.type === "payment_intent.canceled") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.bookingId;
      if (bookingId && paymentIntent.metadata.paymentType === "deposit") {
        await updatePayment(bookingId, { deposit_payment_status: "released", deposit_released_at: new Date().toISOString() });
        await sendBillingDocument(createAdminClient(), bookingId, "deposit_release");
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.bookingId;
      if (bookingId && paymentIntent.metadata.paymentType === "hire") {
        await updatePayment(bookingId, {
          hire_payment_status: "failed",
          stripe_hire_payment_intent_id: paymentIntent.id,
        });
      } else if (bookingId && paymentIntent.metadata.paymentType === "deposit") {
        await updatePayment(bookingId, {
          deposit_payment_status: "failed",
          stripe_deposit_payment_intent_id: paymentIntent.id,
        });
      }
    }
  } catch (error) {
    console.error("Stripe webhook handler failed:", error);
    return new Response("Webhook processing failed.", { status: 500 });
  }

  return Response.json({ received: true });
}
