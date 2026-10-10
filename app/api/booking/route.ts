import { after, NextResponse } from "next/server";
import { EmailTransport as Resend, emailConfiguration } from "@/lib/email-transport";
import { emailFooterText } from "@/lib/email-footer";
import { emailDetailsTable, emailLayout, emailPanel } from "@/lib/email-template";
import { recordCustomerEmail } from "@/lib/email-log";
import { createBookingCalendarEvent } from "@/lib/google-calendar";
import { bookingReferenceForId } from "@/lib/booking-reference";
import { bookingHireTotalCents, parseBookingLineItems, summarizeBookingLineItems } from "@/lib/booking-line-items";
import { formatAudCents, rentalDays } from "@/lib/payment-flow";
import { createAdminClient, PHOTO_ID_BUCKET } from "@/lib/supabase";
import { bookingSchema } from "@/lib/validation/booking";
import { maxPhotoIdUploadSize } from "@/lib/prepare-photo-id";

function formatEmailDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(`${value}T00:00:00`));
}

export async function POST(request: Request) {
  const { apiKey: resendApiKey, from: fromEmail, to: toEmail } = emailConfiguration();
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === "string"));
    const parsed = bookingSchema.safeParse(payload);
    const files = formData.getAll("idFiles").filter((value): value is File => value instanceof File);
    if (!parsed.success || files.length !== 2 || files.some((file) => file.size === 0 || file.size > maxPhotoIdUploadSize)) {
      return NextResponse.json({ error: "Please check all booking details and upload the front and back of your photo ID." }, { status: 400 });
    }
    if (!resendApiKey || !fromEmail || !toEmail) {
      return NextResponse.json({ error: "Email service is not configured yet." }, { status: 500 });
    }
    const data = parsed.data;
    let hireLineItemsPayload: unknown;
    try {
      hireLineItemsPayload = JSON.parse(data.hireLineItems);
    } catch {
      return NextResponse.json({ error: "Hire items are invalid. Please review the item names, quantities, and prices." }, { status: 400 });
    }
    const parsedHireLineItems = parseBookingLineItems(hireLineItemsPayload);
    if ("error" in parsedHireLineItems) {
      return NextResponse.json({ error: parsedHireLineItems.error }, { status: 400 });
    }
    const hireLineItems = parsedHireLineItems.items;
    const hireAmountCents = bookingHireTotalCents(hireLineItems, data.pickupDate, data.dropoffDate);
    const nights = rentalDays(data.pickupDate, data.dropoffDate);
    const hireItemsSummary = summarizeBookingLineItems(hireLineItems);
    const additionalDetails = data.additionalDetails.trim();
    const admin = createAdminClient();
    const bookingId = crypto.randomUUID();
    const objectPaths: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const path = `${bookingId}/${index === 0 ? "front" : "back"}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const upload = await admin.storage.from(PHOTO_ID_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream", upsert: false });
        if (upload.error) throw new Error(`Photo ID upload failed: ${upload.error.message}`);
        objectPaths.push(path);
      }

      const insert = await admin.from("bookings").insert({
        id: bookingId, email: data.email, first_name: data.firstName, last_name: data.lastName, mobile: data.mobile,
        event_type: data.eventType, event_address: data.eventAddress, pickup_date: data.pickupDate, dropoff_date: data.dropoffDate,
        pickup_time: data.pickupTime, dropoff_time: data.dropoffTime,
        additional_details: additionalDetails,
        hire_line_items: hireLineItems,
        hire_amount_cents: hireAmountCents,
        terms_accepted: data.termsAccepted === "accepted", photo_id_paths: objectPaths, status: "submitted",
        internal_email_sent: false, customer_email_sent: false,
      });
      if (insert.error) throw new Error(`Booking persistence failed: ${insert.error.message}`);
    } catch (error) {
      if (objectPaths.length) {
        const cleanup = await admin.storage.from(PHOTO_ID_BUCKET).remove(objectPaths);
        if (cleanup.error) console.error("Failed to clean up uploaded photo IDs:", cleanup.error);
      }
      throw error;
    }
    const bookingReference = bookingReferenceForId(bookingId);
    const updateBooking = async (updates: Record<string, unknown>) => {
      const result = await admin.from("bookings").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", bookingId);
      if (result.error) throw new Error(`Booking outcome persistence failed: ${result.error.message}`);
    };

    after(async () => {
      let calendarEventLink: string | null = null;
      let calendarError: string | null = null;
      try {
        calendarEventLink = await createBookingCalendarEvent({ ...data, hireLineItems });
      } catch (error) {
        calendarError = error instanceof Error ? error.message : "Unknown Google Calendar error";
        console.error("Google Calendar event creation failed:", error);
      }
      try {
        await updateBooking({ calendar_event_link: calendarEventLink, calendar_error: calendarError });
      } catch (error) {
        console.error("Calendar outcome persistence failed; continuing booking emails:", error);
      }
      const text = [
      "New audio equipment booking", `Booking Reference: ${bookingReference}`, `Name: ${data.firstName} ${data.lastName}`, `Email: ${data.email}`, `Mobile: ${data.mobile}`,
      `Event type: ${data.eventType}`, `Event address: ${data.eventAddress}`,
      `Pickup: ${data.pickupDate} at ${data.pickupTime}`, `Drop-off: ${data.dropoffDate} at ${data.dropoffTime}`, "",
      `Hire items: ${hireItemsSummary || "None specified"}`, `Hire duration: ${nights} night(s)`, `Estimated hire total: ${formatAudCents(hireAmountCents)}`, "",
      "Additional details:", data.additionalDetails || "None provided", "",
      "Terms: Customer confirmed they have read and agree to the PA Equipment Hire Terms & Conditions.",
      calendarEventLink ? `Google Calendar event: ${calendarEventLink}` : "",
      calendarError ? `Google Calendar event was not created: ${calendarError}` : "",
      "",
      emailFooterText,
      ].join("\n");
      const resend = new Resend(resendApiKey);
      const internalEmail = resend.emails.send({
      from: fromEmail, to: [toEmail], replyTo: data.email, subject: `Booking request: ${data.eventType} from ${data.pickupDate} to ${data.dropoffDate}`, text,
      html: emailLayout({
        eyebrow: "New booking request",
        title: "A new request needs review",
        intro: "A customer has submitted a booking request with photo ID. Review availability before confirming it.",
        content: emailPanel(emailDetailsTable([
          { label: "Booking Reference:", value: bookingReference },
          { label: "Customer", value: `${data.firstName} ${data.lastName}` },
          { label: "Email", value: data.email },
          { label: "Mobile", value: data.mobile },
          { label: "Event", value: data.eventType },
          { label: "Pickup", value: `${data.pickupDate} at ${data.pickupTime}` },
          { label: "Drop-off", value: `${data.dropoffDate} at ${data.dropoffTime}` },
          { label: "Hire items", value: hireItemsSummary || "None specified" },
          { label: "Hire nights", value: String(nights) },
          { label: "Estimated hire total", value: formatAudCents(hireAmountCents) },
        ]), "accent"),
      }),
      attachments: await Promise.all(files.map(async (file) => ({ filename: file.name, content: Buffer.from(await file.arrayBuffer()).toString("base64") }))),
      });
      const customerEmailHtml = emailLayout({
        eyebrow: "Booking received",
        title: "Thanks for your request",
        intro: "We have received your booking request and photo ID. Your request is not confirmed yet; our team will review availability and be in touch shortly.",
        content: emailPanel(emailDetailsTable([
          { label: "Booking Reference:", value: bookingReference },
          { label: "Event", value: data.eventType },
          { label: "Address", value: data.eventAddress },
          { label: "Pickup", value: `${formatEmailDate(data.pickupDate)} at ${data.pickupTime}` },
          { label: "Drop-off", value: `${formatEmailDate(data.dropoffDate)} at ${data.dropoffTime}` },
          { label: "Hire items", value: hireItemsSummary || "None specified" },
          { label: "Hire nights", value: String(nights) },
          { label: "Estimated hire total", value: formatAudCents(hireAmountCents) },
        ],), "accent") + `<p style="margin:24px 0 0;color:#718078;font-size:14px;line-height:1.65">If any of these details need correcting, simply reply to this email and our team will help.</p>`,
      });
      const customerEmail = resend.emails.send({
      from: fromEmail, to: [data.email], replyTo: toEmail, subject: "Your booking request has been received",
      text: [
        `Hi ${data.firstName},`, "", "Thanks for submitting your booking request to Peppermint Audio.", "", `Booking Reference: ${bookingReference}`, "",
        `Event: ${data.eventType}`, `Event address: ${data.eventAddress}`, `Pickup: ${formatEmailDate(data.pickupDate)} at ${data.pickupTime}`,
        `Drop-off: ${formatEmailDate(data.dropoffDate)} at ${data.dropoffTime}`,
        `Hire items: ${hireItemsSummary || "None specified"}`,
        `Hire nights: ${nights}`, `Estimated hire total: ${formatAudCents(hireAmountCents)}`,
        "", "We have received your booking request and photo ID. Your request is not confirmed yet; our team will review availability and be in touch shortly.", "",
        emailFooterText,
      ].join("\n"),
      html: customerEmailHtml,
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
      if (!customerEmailError) {
        try {
          await recordCustomerEmail(admin, {
            bookingId,
            recipientEmail: data.email,
            emailType: "booking_request",
            providerMessageId: emails[1].data?.id,
          });
        } catch (error) {
          console.error("Customer booking email log failed:", error);
        }
      }
      await updateBooking({
        calendar_event_link: calendarEventLink, calendar_error: calendarError,
        internal_email_sent: !internalEmailError, customer_email_sent: !customerEmailError,
      });
      if (internalEmailError || customerEmailError) {
        throw new Error(`Booking email failed: ${internalEmailError?.message ?? customerEmailError?.message}`);
      }
    });
    return NextResponse.json({ ok: true, bookingId, bookingReference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown booking error";
    console.error("Booking submission failed:", error);
    return NextResponse.json({ error: `Your booking could not be completed: ${message}` }, { status: 500 });
  }
}
