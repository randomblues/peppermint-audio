import { NextResponse } from "next/server";
import { Resend } from "resend";

import { emailFooterText } from "@/lib/email-footer";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { bookingId?: string; subject?: string; message?: string };
  try {
    body = await request.json() as { bookingId?: string; subject?: string; message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const subject = body.subject?.trim();
  const message = body.message?.trim();
  if (!body.bookingId || !subject || !message) return NextResponse.json({ error: "Booking ID, subject, and message are required." }, { status: 400 });

  const booking = await session.admin.from("bookings")
    .select("email")
    .eq("id", body.bookingId)
    .single();
  if (booking.error) return NextResponse.json({ error: booking.error.message }, { status: 500 });
  if (!booking.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

  const response = await new Resend(apiKey).emails.send({
    from,
    to: [booking.data.email],
    subject,
    text: `${message}\n\n${emailFooterText}`,
  });
  if (response.error) return NextResponse.json({ error: "Custom email could not be sent." }, { status: 502 });
  return NextResponse.json({ ok: true, id: response.data?.id });
}
