import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createBookingCalendarEvent } from "@/lib/google-calendar";
import { createAdminClient, PHOTO_ID_BUCKET } from "@/lib/supabase";
import { bookingSchema } from "@/lib/validation/booking";

const maxFileSize = 10 * 1024 * 1024;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.ENQUIRY_FROM_EMAIL;
const toEmail = process.env.ENQUIRY_TO_EMAIL;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === "string"));
    const parsed = bookingSchema.safeParse(payload);
    const files = formData.getAll("idFiles").filter((value): value is File => value instanceof File);
    if (!parsed.success || files.length !== 2 || files.some((file) => file.size === 0 || file.size > maxFileSize)) {
      return NextResponse.json({ error: "Please check all booking details and upload the front and back of your photo ID." }, { status: 400 });
    }
    if (!resendApiKey || !fromEmail || !toEmail) {
      return NextResponse.json({ error: "Email service is not configured yet." }, { status: 500 });
    }
    const data = parsed.data;
    const admin = createAdminClient();
    const bookingId = crypto.randomUUID();
    const objectPaths: string[] = [];
    for (const [index, file] of files.entries()) {
      const path = `${bookingId}/${index === 0 ? "front" : "back"}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await admin.storage.from(PHOTO_ID_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream", upsert: false });
      if (upload.error) throw new Error(`Photo ID upload failed: ${upload.error.message}`);
      objectPaths.push(path);
    }

    const insert = await admin.from("bookings").insert({
      id: bookingId, email: data.email, first_name: data.firstName, last_name: data.lastName, mobile: data.mobile,
      event_type: data.eventType, event_address: data.eventAddress, pickup_date: data.pickupDate, dropoff_date: data.dropoffDate,
      package_interest: data.packageInterest, guest_count: data.guestCount, additional_details: data.additionalDetails,
      terms_accepted: data.termsAccepted === "accepted", photo_id_paths: objectPaths, status: "submitted",
      internal_email_sent: false, customer_email_sent: false,
    });
    if (insert.error) throw new Error(`Booking persistence failed: ${insert.error.message}`);
    const updateBooking = async (updates: Record<string, unknown>) => {
      const result = await admin.from("bookings").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", bookingId);
      if (result.error) throw new Error(`Booking outcome persistence failed: ${result.error.message}`);
    };

    let calendarEventLink: string | null = null;
    let calendarError: string | null = null;
    try {
      calendarEventLink = await createBookingCalendarEvent(data);
    } catch (error) {
      calendarError = error instanceof Error ? error.message : "Unknown Google Calendar error";
      console.error("Google Calendar event creation failed:", error);
    }
    await updateBooking({ calendar_event_link: calendarEventLink, calendar_error: calendarError });
    const text = [
      "New audio equipment booking", `Name: ${data.firstName} ${data.lastName}`, `Email: ${data.email}`, `Mobile: ${data.mobile}`,
      `Event type: ${data.eventType}`, `Event address: ${data.eventAddress}`, `Estimated guests: ${data.guestCount}`,
      `Pickup date: ${data.pickupDate}`, `Drop-off date: ${data.dropoffDate}`, `Package: ${data.packageInterest}`, "",
      "Additional details:", data.additionalDetails || "None provided", "",
      "Terms: Customer confirmed they have read and agree to the PA Equipment Hire Terms & Conditions.",
      calendarEventLink ? `Google Calendar event: ${calendarEventLink}` : "",
      calendarError ? `Google Calendar event was not created: ${calendarError}` : "",
    ].join("\n");
    const resend = new Resend(resendApiKey);
    const internalEmail = resend.emails.send({
      from: fromEmail, to: [toEmail], replyTo: data.email, subject: `Booking request: ${data.eventType} from ${data.pickupDate} to ${data.dropoffDate}`, text,
      attachments: await Promise.all(files.map(async (file) => ({ filename: file.name, content: Buffer.from(await file.arrayBuffer()).toString("base64") }))),
    });
    const customerEmail = resend.emails.send({
      from: fromEmail, to: [data.email], replyTo: toEmail, subject: "Your Peppermint Audio booking details have been received",
      text: [`Hi ${data.firstName},`, "", "Thanks for submitting your booking details to Peppermint Audio.", "",
        `Event: ${data.eventType}`, `Event address: ${data.eventAddress}`, `Pickup date: ${data.pickupDate}`, `Drop-off date: ${data.dropoffDate}`,
        `Package: ${data.packageInterest}`, `Estimated guests: ${data.guestCount}`, "", "We have received your details and photo ID.", "",
        "Kind regards,", "Peppermint Audio"].join("\n"),
    });
    let emails: Awaited<ReturnType<typeof resend.emails.send>>[];
    try {
      emails = await Promise.all([internalEmail, customerEmail]);
    } catch (error) {
      await updateBooking({
        calendar_event_link: calendarEventLink, calendar_error: calendarError,
        internal_email_sent: false, customer_email_sent: false,
      });
      throw new Error(`Booking email failed: ${error instanceof Error ? error.message : "Unknown email error"}`);
    }
    const internalEmailError = emails[0].error;
    const customerEmailError = emails[1].error;
    await updateBooking({
      calendar_event_link: calendarEventLink, calendar_error: calendarError,
      internal_email_sent: !internalEmailError, customer_email_sent: !customerEmailError,
    });
    if (internalEmailError || customerEmailError) {
      throw new Error(`Booking email failed: ${internalEmailError?.message ?? customerEmailError?.message}`);
    }
    return NextResponse.json({ ok: true, calendarEventCreated: Boolean(calendarEventLink), bookingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown booking error";
    console.error("Booking submission failed:", error);
    return NextResponse.json({ error: `Your booking could not be completed: ${message}` }, { status: 500 });
  }
}
