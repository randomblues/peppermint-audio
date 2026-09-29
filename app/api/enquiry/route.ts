import { NextResponse } from "next/server";
import { Resend } from "resend";

import { emailFooterText } from "@/lib/email-footer";
import { enquirySchema } from "@/lib/validation/enquiry";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.ENQUIRY_FROM_EMAIL;
const toEmail = process.env.ENQUIRY_TO_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function looksLikeSupplierSpam(message: string, eventType: string) {
  const text = `${message} ${eventType}`.toLowerCase();
  const indicators = [
    "manufacturer",
    "wholesale",
    "best-selling models",
    "send you",
    "supplier",
    "bluetooth speaker",
  ];

  return indicators.filter((indicator) => text.includes(indicator)).length >= 2;
}

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

    if (parsed.data.website || looksLikeSupplierSpam(parsed.data.message, parsed.data.eventType)) {
      return NextResponse.json(
        { error: "Please send an event-related enquiry using the form." },
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

    const { name, email, phone, eventDate, eventType, packageInterest, guestCount, message, attribution } =
      parsed.data;
    const attributionLines = [
      attribution?.gclid ? `Google click ID: ${attribution.gclid}` : null,
      attribution?.utmSource ? `UTM source: ${attribution.utmSource}` : null,
      attribution?.utmMedium ? `UTM medium: ${attribution.utmMedium}` : null,
      attribution?.utmCampaign ? `UTM campaign: ${attribution.utmCampaign}` : null,
      attribution?.utmTerm ? `UTM term: ${attribution.utmTerm}` : null,
    ].filter((line): line is string => Boolean(line));

    const text = [
      "New audio system hire enquiry",
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Event date: ${eventDate}`,
      `Event type: ${eventType}`,
      `Package interest: ${packageInterest}`,
      `Estimated guests: ${guestCount}`,
      ...(attributionLines.length > 0 ? ["", "Marketing attribution:", ...attributionLines] : []),
      "",
      "Event details:",
      message,
      "",
      emailFooterText,
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
