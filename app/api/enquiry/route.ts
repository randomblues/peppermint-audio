import { NextResponse } from "next/server";
import { EmailTransport as Resend, emailConfiguration } from "@/lib/email-transport";

import { emailFooterText } from "@/lib/email-footer";
import { recordCustomerEmail } from "@/lib/email-log";
import { emailDetailsTable, emailLayout, emailPanel } from "@/lib/email-template";
import { createAdminClient } from "@/lib/supabase";
import { enquirySchema } from "@/lib/validation/enquiry";


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
  const { apiKey: resendApiKey, from: fromEmail, to: toEmail } = emailConfiguration();
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
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

    const { name, email, phone, eventDate, eventType, message, attribution } =
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
      ...(attributionLines.length > 0 ? ["", "Marketing attribution:", ...attributionLines] : []),
      "",
      "Event details:",
      message,
      "",
      emailFooterText,
    ].join("\n");

    const response = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      replyTo: email,
      subject: `New enquiry: ${eventType} on ${eventDate}`,
      text,
      html: emailLayout({
        eyebrow: "New enquiry",
        title: "A new enquiry needs a reply",
        intro: "A customer has sent an enquiry through the Peppermint Audio website.",
        content: emailPanel(emailDetailsTable([
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Phone", value: phone },
          { label: "Event date", value: eventDate },
          { label: "Event type", value: eventType },
          { label: "Event details", value: message },
          ...(attributionLines.length > 0 ? [{ label: "Attribution", value: attributionLines.join(" · ") }] : []),
        ]), "accent"),
      }),
    });
    if (response.error) throw new Error(response.error.message);
    try {
      await recordCustomerEmail(createAdminClient(), {
        recipientEmail: email,
        emailType: "enquiry",
        providerMessageId: response.data?.id,
      });
    } catch (error) {
      console.error("Enquiry email log failed:", error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Enquiry submission failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while sending your enquiry." },
      { status: 500 }
    );
  }
}
