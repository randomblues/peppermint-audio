import { NextResponse } from "next/server";
import { EmailTransport as Resend, emailConfiguration } from "@/lib/email-transport";

import { emailFooterText } from "@/lib/email-footer";
import { recordCustomerEmail } from "@/lib/email-log";
import { emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let bookingId = "";
  let subject = "";
  let message = "";
  let attachment: File | null = null;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      bookingId = String(formData.get("bookingId") ?? "").trim();
      subject = String(formData.get("subject") ?? "").trim();
      message = String(formData.get("message") ?? "").trim();
      const attachmentValue = formData.get("attachment");
      attachment = attachmentValue && typeof attachmentValue === "object" && "name" in attachmentValue && "size" in attachmentValue
        ? attachmentValue as File
        : null;
    } else {
      const body = await request.json() as { bookingId?: string; subject?: string; message?: string };
      bookingId = body.bookingId?.trim() ?? "";
      subject = body.subject?.trim() ?? "";
      message = body.message?.trim() ?? "";
    }
  } catch {
    return NextResponse.json({ error: contentType.includes("multipart/form-data") ? "Invalid multipart form data." : "Invalid JSON body." }, { status: 400 });
  }
  if (!bookingId || !subject || !message) return NextResponse.json({ error: "Booking ID, subject, and message are required." }, { status: 400 });
  if (attachment) {
    if (!attachment.name || attachment.size === 0) return NextResponse.json({ error: "The attachment cannot be empty." }, { status: 400 });
    if (attachment.size > MAX_ATTACHMENT_SIZE) return NextResponse.json({ error: "The attachment must be 10 MB or smaller." }, { status: 400 });
  }

  const booking = await session.admin.from("bookings")
    .select("email")
    .eq("id", bookingId)
    .single();
  if (booking.error) return NextResponse.json({ error: booking.error.message }, { status: 500 });
  if (!booking.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });

  const { apiKey, from } = emailConfiguration();
  if (!apiKey || !from) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

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
    ...(attachment ? {
      attachments: [{
        filename: attachment.name,
        content: Buffer.from(
          "arrayBuffer" in attachment
            ? await attachment.arrayBuffer()
            : await new Response(attachment).arrayBuffer(),
        ).toString("base64"),
      }],
    } : {}),
  });
  if (response.error) return NextResponse.json({ error: "Email could not be sent." }, { status: 502 });
  try {
    await recordCustomerEmail(session.admin, {
      bookingId,
      recipientEmail: booking.data.email,
      emailType: "custom",
      providerMessageId: response.data?.id,
    });
  } catch (error) {
    console.error("Email log failed:", error);
  }
  return NextResponse.json({ ok: true, id: response.data?.id });
}
