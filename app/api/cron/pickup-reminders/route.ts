import { NextResponse } from "next/server";
import { emailConfiguration } from "@/lib/email-transport";
import { getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { createAdminClient } from "@/lib/supabase";
import { pickupReminderFields, sendPickupReminderEmail, type TrackedPickupReminderBooking } from "@/lib/send-pickup-reminder";

export const runtime = "nodejs";

export function isCronAuthorized(request: Request, secret = process.env.CRON_SECRET) {
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!isCronAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const { apiKey, from } = emailConfiguration();
  if (!apiKey || !from) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

  const pickupDate = getMelbourneTomorrow(now);
  const admin = createAdminClient();
  const result = await admin.from("bookings")
    .select(pickupReminderFields)
    .eq("pickup_date", pickupDate)
    .eq("status", "confirmed")
    .is("reminder_sent_at", null);
  if (result.error) {
    console.error("Pickup reminder booking query failed:", result.error);
    return NextResponse.json({ error: "Booking query failed" }, { status: 500 });
  }

  const sent: string[] = [];
  const failures: { id: string; error: string }[] = [];
  for (const booking of (result.data ?? []) as TrackedPickupReminderBooking[]) {
    try {
      if (await sendPickupReminderEmail(admin, booking)) sent.push(booking.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Pickup reminder failed for booking ${booking.id}:`, message);
      failures.push({ id: booking.id, error: message });
    }
  }
  return NextResponse.json({ pickupDate, selected: result.data?.length ?? 0, sent: sent.length, failures });
}
