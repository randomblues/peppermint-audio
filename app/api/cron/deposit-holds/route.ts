import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase";
import { attemptDeferredDeposit, notifyDepositAttention, readDepositBooking, syncDeferredDeposit } from "@/lib/deferred-deposits";
import { getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { getStripe } from "@/lib/stripe";
import { sendBillingDocument } from "@/lib/invoice-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const result = await admin.from("bookings").select("id")
      .eq("payment_method", "stripe_card_hold").eq("hire_payment_status", "paid")
      .in("status", ["submitted", "confirmed"])
      .lt("deposit_hold_date", getMelbourneTomorrow())
      .in("deposit_payment_status", ["scheduled", "authorizing", "authorized", "failed", "action_required", "hold_too_short", "expired"]);
    if (result.error) throw new Error(`Deposit query failed: ${result.error.message}`);
    const failures: { id: string; error: string }[] = [];
    for (const { id } of result.data ?? []) {
      try {
        await attemptDeferredDeposit(admin, id);
        let booking = await readDepositBooking(admin, id);
        if (booking?.deposit_payment_status === "authorized" && booking.stripe_deposit_payment_intent_id) {
          const intent = await getStripe().paymentIntents.retrieve(booking.stripe_deposit_payment_intent_id, { expand: ["latest_charge"] });
          const status = await syncDeferredDeposit(admin, booking, intent);
          if (status === "authorized") await sendBillingDocument(admin, id, "deposit_authorisation");
          booking = await readDepositBooking(admin, id);
        }
        if (booking) await notifyDepositAttention(admin, booking);
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Deposit job failed.";
        console.error(`Deposit job failed for ${id}:`, cause);
        failures.push({ id, error });
      }
    }
    return NextResponse.json({ selected: result.data?.length ?? 0, failures }, { status: failures.length ? 502 : 200 });
  } catch (cause) {
    console.error("Deposit hold job failed:", cause);
    return NextResponse.json({ error: "Deposit hold job failed. Check server logs." }, { status: 500 });
  }
}
