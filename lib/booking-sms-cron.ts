import "server-only";
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase";
import { getMelbourneToday } from "@/lib/date-utils";
import { getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { isPickupSmsDue, type PickupSmsBooking } from "@/lib/pickup-sms";
import { isDropoffSmsDue, type DropoffSmsBooking } from "@/lib/dropoff-sms";
import { sendPickupReminderSms, sendDropoffReminderSms } from "@/lib/send-booking-sms";

const CLAIM_TTL_MS = 15 * 60 * 1000;
type ScheduledSmsBooking = PickupSmsBooking & DropoffSmsBooking;

export async function runBookingSmsCron(request: Request, kind: "pickup" | "dropoff") {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return processBookingSms(kind);
}

export async function sendDuePickupReminderSms(bookingId: string) {
  const result = await processBookingSms("pickup", bookingId);
  if (!result.ok) throw new Error("Pending pickup SMS could not be sent or tracked. Check server logs.");
}

export async function runHireRemindersCron(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pickup = await processBookingSms("pickup");
  const dropoff = await processBookingSms("dropoff");
  return NextResponse.json({ pickup: await pickup.json(), dropoff: await dropoff.json() }, {
    status: !pickup.ok || !dropoff.ok ? 502 : 200,
  });
}

async function processBookingSms(kind: "pickup" | "dropoff", bookingId?: string) {
  const dateField = kind === "pickup" ? "pickup_date" : "dropoff_date";
  const timeField = kind === "pickup" ? "pickup_time" : "dropoff_time";
  const sentField = kind === "pickup" ? "pickup_sms_sent_at" : "dropoff_sms_sent_at";
  const claimField = kind === "pickup" ? "pickup_sms_claimed_at" : "dropoff_sms_claimed_at";
  const label = kind === "pickup" ? "Pickup" : "Drop-off";
  const now = new Date();
  const admin = createAdminClient();
  let selection = admin.from("bookings")
    .select("id,mobile,status,pickup_date,pickup_time,dropoff_date,dropoff_time,payment_method,hire_payment_status,security_deposit_cents,deposit_payment_status,deposit_capture_before,pickup_sms_sent_at,pickup_sms_claimed_at,dropoff_sms_sent_at,dropoff_sms_claimed_at")
    .in(dateField, [getMelbourneToday(now), getMelbourneTomorrow(now)])
    .in("status", kind === "pickup" ? ["submitted", "confirmed"] : ["confirmed"])
    .is(sentField, null);
  if (bookingId) selection = selection.eq("id", bookingId);
  const query = await selection;
  if (query.error) {
    console.error(`${label} SMS booking query failed:`, query.error);
    return NextResponse.json({ error: `${label} SMS bookings could not be loaded.` }, { status: 500 });
  }
  let sent = 0;
  const failures: { id: string; error: string }[] = [];
  for (const booking of (query.data ?? []) as ScheduledSmsBooking[]) {
    let claimed = false;
    const claimAt = now.toISOString();
    try {
      if (!(kind === "pickup" ? isPickupSmsDue(booking, now) : isDropoffSmsDue(booking, now))) continue;
      const previousClaim = booking[claimField];
      if (previousClaim && Date.parse(previousClaim) > now.getTime() - CLAIM_TTL_MS) continue;
      let claim = admin.from("bookings").update({ [claimField]: claimAt })
        .eq("id", booking.id).eq("mobile", booking.mobile).eq("status", booking.status)
        .eq(dateField, booking[dateField]).eq(timeField, booking[timeField]).is(sentField, null);
      if (kind === "pickup") {
        claim = claim.eq("security_deposit_cents", booking.security_deposit_cents)
          .eq("deposit_payment_status", booking.deposit_payment_status).eq("hire_payment_status", booking.hire_payment_status);
        claim = booking.payment_method ? claim.eq("payment_method", booking.payment_method) : claim.is("payment_method", null);
        claim = booking.deposit_capture_before
          ? claim.eq("deposit_capture_before", booking.deposit_capture_before)
          : claim.is("deposit_capture_before", null);
      }
      claim = previousClaim ? claim.eq(claimField, previousClaim) : claim.is(claimField, null);
      const result = await claim.select("id").maybeSingle();
      if (result.error) throw new Error(`${label} SMS claim failed: ${result.error.message}`);
      if (!result.data) continue;
      claimed = true;
      if (kind === "pickup") await sendPickupReminderSms(booking);
      else await sendDropoffReminderSms(booking);
      const saved = await admin.from("bookings")
        .update({ [sentField]: new Date().toISOString(), [claimField]: null })
        .eq("id", booking.id).eq(claimField, claimAt).select("id").maybeSingle();
      if (saved.error || !saved.data) throw new Error(`${label} SMS tracking failed: ${saved.error?.message ?? "claim was lost"}`);
      claimed = false;
      sent++;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : `${label} SMS failed.`;
      console.error(`${label} SMS failed for ${booking.id}:`, cause);
      failures.push({ id: booking.id, error });
    } finally {
      if (claimed) {
        const release = await admin.from("bookings").update({ [claimField]: null })
          .eq("id", booking.id).eq(claimField, claimAt).select("id").maybeSingle();
        if (release.error || !release.data) {
          console.error(`${label} SMS claim release failed for ${booking.id}:`, release.error);
          failures.push({ id: booking.id, error: `${label} SMS claim could not be released.` });
        }
      }
    }
  }
  return NextResponse.json({ selected: query.data?.length ?? 0, sent, failures }, { status: failures.length ? 502 : 200 });
}
