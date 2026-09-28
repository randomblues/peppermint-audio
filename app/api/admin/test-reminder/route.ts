import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildPickupReminderEmail, getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { email?: string };
  try {
    body = await request.json() as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

  const reminder = buildPickupReminderEmail({
    email,
    first_name: "Test",
    last_name: "Recipient",
    event_type: "Test reminder email",
    pickup_date: getMelbourneTomorrow(),
    package_interest: "speech-presentation",
    additional_details: "This is a test email. No booking has been created.",
  });
  const response = await new Resend(apiKey).emails.send({
    from,
    to: [email],
    subject: `[TEST] ${reminder.subject}`,
    text: reminder.text,
    html: reminder.html,
  });
  if (response.error) {
    console.error("Test reminder email failed:", response.error);
    return NextResponse.json({ error: "The test email could not be sent." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: response.data?.id });
}
