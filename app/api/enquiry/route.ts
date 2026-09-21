import { NextResponse } from "next/server";
import { Resend } from "resend";

import { enquirySchema } from "@/lib/validation/enquiry";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.ENQUIRY_FROM_EMAIL;
const toEmail = process.env.ENQUIRY_TO_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = enquirySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the form details and try again." },
        { status: 400 }
      );
    }

    if (!resend || !fromEmail || !toEmail) {
      return NextResponse.json(
        {
          error:
            "Email service is not configured yet. Please add RESEND_API_KEY, ENQUIRY_FROM_EMAIL, and ENQUIRY_TO_EMAIL.",
        },
        { status: 500 }
      );
    }

    const { name, email, phone, eventDate, eventType, packageInterest, guestCount, message } =
      parsed.data;

    const text = [
      "New audio system hire enquiry",
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Event date: ${eventDate}`,
      `Event type: ${eventType}`,
      `Package interest: ${packageInterest}`,
      `Estimated guests: ${guestCount}`,
      "",
      "Event details:",
      message,
    ].join("\n");

    await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      replyTo: email,
      subject: `New enquiry: ${eventType} on ${eventDate}`,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while sending your enquiry." },
      { status: 500 }
    );
  }
}
