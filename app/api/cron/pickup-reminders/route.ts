import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildPickupReminderEmail, getMelbourneTomorrow, type PickupReminderBooking } from "@/lib/pickup-reminders";
import { createAdminClient } from "@/lib/supabase";
import { recordCustomerEmail } from "@/lib/email-log";

export const runtime = "nodejs";

export function isCronAuthorized(request: Request, secret = process.env.CRON_SECRET) {
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!isCronAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

  const pickupDate = getMelbourneTomorrow();
  const admin = createAdminClient();
  const result = await admin.from("bookings")
    .select("id,email,first_name,last_name,event_type,pickup_date,pickup_time,package_interest,add_ons,additional_details")
    .eq("pickup_date", pickupDate)
    .neq("status", "cancelled")
    .is("reminder_sent_at", null);
  if (result.error) {
    console.error("Pickup reminder booking query failed:", result.error);
    return NextResponse.json({ error: "Booking query failed" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const sent: string[] = [];
  const failures: { id: string; error: string }[] = [];
  for (const booking of (result.data ?? []) as (PickupReminderBooking & { id: string })[]) {
    try {
      const email = buildPickupReminderEmail(booking);
      const response = await resend.emails.send({ from, to: [booking.email], subject: email.subject, text: email.text, html: email.html });
      if (response.error) throw new Error(response.error.message);
      try {
        await recordCustomerEmail(admin, {
          bookingId: booking.id,
          recipientEmail: booking.email,
          emailType: "pickup_reminder",
          providerMessageId: response.data?.id,
        });
      } catch (error) {
        console.error(`Pickup reminder email log failed for booking ${booking.id}:`, error);
      }
      const update = await admin.from("bookings").update({ reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", booking.id).is("reminder_sent_at", null);
      if (update.error) throw new Error(`Reminder sent but could not be marked: ${update.error.message}`);
      sent.push(booking.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Pickup reminder failed for booking ${booking.id}:`, message);
      failures.push({ id: booking.id, error: message });
    }
  }
  return NextResponse.json({ pickupDate, selected: result.data?.length ?? 0, sent: sent.length, failures });
}
