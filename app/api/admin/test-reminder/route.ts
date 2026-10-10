import { NextResponse } from "next/server";
import { EmailTransport as Resend, emailConfiguration } from "@/lib/email-transport";
import { buildPickupReminderEmail, getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { requireAdminJson } from "@/lib/admin-request";
import type { BookingLineItem } from "@/lib/booking-line-items";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminJson<{ email?: string; bookingId?: string }>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;

  let booking: {
    email: string;
    first_name: string;
    last_name: string;
    event_type: string;
    pickup_date: string;
    pickup_time?: string | null;
    hire_line_items: BookingLineItem[] | null;
    additional_details: string | null;
  } | null = null;
  if (body.bookingId) {
    const result = await session.admin.from("bookings")
      .select("email,first_name,last_name,event_type,pickup_date,pickup_time,hire_line_items,additional_details")
      .eq("id", body.bookingId)
      .single();
    if (result.error) {
      console.error("Reminder booking lookup failed:", result.error);
      return NextResponse.json({ error: "Booking lookup failed. Please confirm the latest Supabase migration has been applied." }, { status: 500 });
    }
    if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
    booking = result.data;
  }
  const email = (booking?.email ?? body.email)?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid recipient email address is required." }, { status: 400 });
  }

  const { apiKey, from } = emailConfiguration();
  if (!apiKey || !from) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

  const reminder = buildPickupReminderEmail(booking ?? {
    email,
    first_name: "Test",
    last_name: "Recipient",
    event_type: "Test reminder email",
    pickup_date: getMelbourneTomorrow(),
    hire_line_items: [],
    additional_details: "This is a test email. No booking has been created.",
  }, { tomorrow: !booking || booking.pickup_date === getMelbourneTomorrow() });
  const response = await new Resend(apiKey).emails.send({
    from,
    to: [email],
    subject: reminder.subject,
    text: reminder.text,
    html: reminder.html,
  });
  if (response.error) {
    console.error("Test reminder email failed:", response.error);
    return NextResponse.json({ error: "The test email could not be sent." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: response.data?.id });
}
