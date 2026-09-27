import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createBookingCalendarEvent } from "@/lib/google-calendar";
import { bookingSchema } from "@/lib/validation/booking";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.ENQUIRY_FROM_EMAIL;
const toEmail = process.env.ENQUIRY_TO_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(
      Array.from(formData.entries()).filter(([, value]) => typeof value === "string"),
    );
    const parsed = bookingSchema.safeParse(payload);
    const files = formData.getAll("idFiles").filter((value): value is File => value instanceof File);

    if (!parsed.success || files.length < 2 || files.length > 2 || files.some((file) => file.size === 0 || file.size > maxFileSize)) {
      return NextResponse.json({ error: "Please check all booking details and upload the front and back of your photo ID." }, { status: 400 });
    }

    if (!resend || !fromEmail || !toEmail) {
      return NextResponse.json({ error: "Email service is not configured yet. Please add RESEND_API_KEY, ENQUIRY_FROM_EMAIL, and ENQUIRY_TO_EMAIL." }, { status: 500 });
    }

    const { email, firstName, lastName, mobile, eventType, eventAddress, pickupDate, dropoffDate, packageInterest, guestCount, additionalDetails } = parsed.data;
    let calendarEventLink: string | null = null;
    let calendarError: string | null = null;

    try {
      calendarEventLink = await createBookingCalendarEvent({
        firstName,
        lastName,
        email,
        mobile,
        eventType,
        eventAddress,
        pickupDate,
        dropoffDate,
        packageInterest,
        guestCount,
        additionalDetails,
      });
    } catch (error) {
      calendarError = error instanceof Error ? error.message : "Unknown Google Calendar error";
      console.error("Google Calendar event creation failed:", error);
    }

    const text = [
      "New audio equipment booking",
      `Name: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Mobile: ${mobile}`,
      `Event type: ${eventType}`,
      `Event address: ${eventAddress}`,
      `Estimated guests: ${guestCount}`,
      `Pickup date: ${pickupDate}`,
      `Drop-off date: ${dropoffDate}`,
      `Package: ${packageInterest}`,
      "",
      "Additional details:",
      additionalDetails || "None provided",
      "",
      "Terms: Customer confirmed they have read and agree to the PA Equipment Hire Terms & Conditions.",
      calendarEventLink ? `Google Calendar event: ${calendarEventLink}` : "",
      calendarError ? `Google Calendar event was not created: ${calendarError}` : "",
    ].join("\n");

    const bookingSummary = [
      `Event: ${eventType}`,
      `Event address: ${eventAddress}`,
      `Pickup date: ${pickupDate}`,
      `Drop-off date: ${dropoffDate}`,
      `Package: ${packageInterest}`,
      `Estimated guests: ${guestCount}`,
    ].join("\n");

    const internalEmail = resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      replyTo: email,
      subject: `Booking request: ${eventType} from ${pickupDate} to ${dropoffDate}`,
      text,
      attachments: await Promise.all(files.map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()).toString("base64"),
      }))),
    });

    const customerEmail = resend.emails.send({
      from: fromEmail,
      to: [email],
      replyTo: toEmail,
      subject: "Your Peppermint Audio booking details have been received",
      text: [
        `Hi ${firstName},`,
        "",
        "Thanks for submitting your booking details to Peppermint Audio.",
        "",
        bookingSummary,
        "",
        "We have received your details and photo ID. Please keep this email for your records.",
        "If anything further is needed, Peppermint Audio will contact you directly.",
        "",
        "Kind regards,",
        "Peppermint Audio",
        "contactus@peppermintaudio.com.au",
      ].join("\n"),
    });

    await Promise.all([internalEmail, customerEmail]);

    return NextResponse.json({ ok: true, calendarEventCreated: Boolean(calendarEventLink) });
  } catch {
    return NextResponse.json({ error: "Something went wrong while sending your booking details." }, { status: 500 });
  }
}
