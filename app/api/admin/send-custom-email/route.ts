import { NextResponse } from "next/server";
import { Resend } from "resend";

import { emailFooterHtml, emailFooterText } from "@/lib/email-footer";
import { recordCustomerEmail } from "@/lib/email-log";
import { requireAdmin } from "@/lib/admin-auth";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

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
    html: `
      <div style="margin:0;background:#f4f1ed;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#20211f">
        <div style="margin:0 auto;max-width:600px;overflow:hidden;border:1px solid #e4ddd5;border-radius:16px;background:#fff">
          <div style="background:#1c2925;padding:28px 32px;text-align:center">
            <img src="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.peppermintaudio.com.au"}/logo-white.png" alt="Peppermint Audio" width="170" style="display:block;width:170px;height:auto;margin:0 auto" />
          </div>
          <div style="padding:34px 32px">
            <div style="font-size:16px;line-height:1.7;white-space:pre-line">${escapeHtml(message)}</div>
          </div>
          ${emailFooterHtml}
        </div>
      </div>
    `,
  });
  if (response.error) return NextResponse.json({ error: "Custom email could not be sent." }, { status: 502 });
  try {
    await recordCustomerEmail(session.admin, {
      bookingId: body.bookingId,
      recipientEmail: booking.data.email,
      emailType: "custom",
      providerMessageId: response.data?.id,
    });
  } catch (error) {
    console.error("Custom email log failed:", error);
  }
  return NextResponse.json({ ok: true, id: response.data?.id });
}
