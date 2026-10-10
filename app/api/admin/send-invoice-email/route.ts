import { NextResponse } from "next/server";
import { EmailTransport as Resend, emailConfiguration } from "@/lib/email-transport";

import { emailFooterText } from "@/lib/email-footer";
import { recordCustomerEmail } from "@/lib/email-log";
import { requireAdmin } from "@/lib/admin-auth";
import { emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const attachmentValue = formData.get("attachment");
  const attachment = attachmentValue && typeof attachmentValue === "object" && "name" in attachmentValue && "size" in attachmentValue
    ? attachmentValue as File
    : null;
  if (!bookingId || !subject || !message || !attachment || !attachment.name) {
    return NextResponse.json({ error: "Booking ID, subject, message, and an invoice attachment are required." }, { status: 400 });
  }
  if (attachment.size === 0) return NextResponse.json({ error: "The invoice attachment cannot be empty." }, { status: 400 });
  if (attachment.size > MAX_ATTACHMENT_SIZE) {
    return NextResponse.json({ error: "The invoice attachment must be 10 MB or smaller." }, { status: 400 });
  }

  const booking = await session.admin.from("bookings")
    .select("email")
    .eq("id", bookingId)
    .single();
  if (booking.error) return NextResponse.json({ error: booking.error.message }, { status: 500 });
  if (!booking.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });

  const { apiKey, from } = emailConfiguration();
  if (!apiKey || !from) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

  const attachmentContent = Buffer.from(
    "arrayBuffer" in attachment
      ? await attachment.arrayBuffer()
      : await new Response(attachment).arrayBuffer(),
  ).toString("base64");
  const response = await new Resend(apiKey).emails.send({
    from,
    to: [booking.data.email],
    subject,
    text: `${message}\n\n${emailFooterText}`,
    html: emailLayout({
      eyebrow: "Peppermint Audio",
      title: subject,
      content: emailPanel(`<div style="color:#405148;font-size:16px;line-height:1.7;white-space:pre-line">${escapeEmailHtml(message)}</div>`, "soft"),
    }),
    attachments: [{ filename: attachment.name, content: attachmentContent }],
  });
  if (response.error) return NextResponse.json({ error: "Invoice email could not be sent." }, { status: 502 });

  try {
    await recordCustomerEmail(session.admin, {
      bookingId,
      recipientEmail: booking.data.email,
      emailType: "invoice",
      providerMessageId: response.data?.id,
    });
  } catch (error) {
    console.error("Invoice email log failed:", error);
  }
  return NextResponse.json({ ok: true, id: response.data?.id });
}
