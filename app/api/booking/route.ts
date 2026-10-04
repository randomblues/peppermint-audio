import { after, NextResponse } from "next/server";
import { Resend } from "resend";
import { emailFooterHtml, emailFooterText } from "@/lib/email-footer";
import { recordCustomerEmail } from "@/lib/email-log";
import { createBookingCalendarEvent } from "@/lib/google-calendar";
import { addOnCatalog, packageTiers } from "@/lib/site-content";
import { createAdminClient, PHOTO_ID_BUCKET } from "@/lib/supabase";
import { bookingSchema } from "@/lib/validation/booking";

const maxFileSize = 1.5 * 1024 * 1024;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.ENQUIRY_FROM_EMAIL;
const toEmail = process.env.ENQUIRY_TO_EMAIL;
const logoUrl = "https://www.peppermintaudio.com.au/logo-white.png";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function formatEmailDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(`${value}T00:00:00`));
}

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
    const selectedAddOnSlugs = data.addOns.split(",").filter(Boolean);
    const selectedPackage = packageTiers.find((pkg) => pkg.name === data.packageInterest || pkg.slug === data.packageInterest);
    if (selectedAddOnSlugs.some((slug) => !selectedPackage?.addOnSlugs.includes(slug) || !addOnCatalog[slug])) {
      return NextResponse.json({ error: "Please choose add-ons from the selected package." }, { status: 400 });
    }
    const selectedAddOns = selectedAddOnSlugs.map((slug) => addOnCatalog[slug].name);
    const additionalDetails = [
      data.additionalDetails.trim(),
      data.selectedEquipment ? `Selected hire items: ${data.selectedEquipment}` : "",
    ].filter(Boolean).join("\n\n");
    const admin = createAdminClient();
    const bookingId = crypto.randomUUID();
    const objectPaths: string[] = [];
    const uploadedFiles = await Promise.all(files.map(async (file, index) => {
      const path = `${bookingId}/${index === 0 ? "front" : "back"}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await admin.storage.from(PHOTO_ID_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream", upsert: false });
      if (upload.error) throw new Error(`Photo ID upload failed: ${upload.error.message}`);
      return path;
    }));
    objectPaths.push(...uploadedFiles);

    const insert = await admin.from("bookings").insert({
      id: bookingId, email: data.email, first_name: data.firstName, last_name: data.lastName, mobile: data.mobile,
      event_type: data.eventType, event_address: data.eventAddress, pickup_date: data.pickupDate, dropoff_date: data.dropoffDate,
      pickup_time: data.pickupTime, dropoff_time: data.dropoffTime,
      package_interest: data.packageInterest, add_ons: selectedAddOns, guest_count: null, additional_details: additionalDetails,
      terms_accepted: data.termsAccepted === "accepted", photo_id_paths: objectPaths, status: "submitted",
      internal_email_sent: false, customer_email_sent: false,
    });
    if (insert.error) throw new Error(`Booking persistence failed: ${insert.error.message}`);
    const updateBooking = async (updates: Record<string, unknown>) => {
      const result = await admin.from("bookings").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", bookingId);
      if (result.error) throw new Error(`Booking outcome persistence failed: ${result.error.message}`);
    };

    after(async () => {
      let calendarEventLink: string | null = null;
      let calendarError: string | null = null;
      try {
        calendarEventLink = await createBookingCalendarEvent({ ...data, addOns: selectedAddOns });
      } catch (error) {
        calendarError = error instanceof Error ? error.message : "Unknown Google Calendar error";
        console.error("Google Calendar event creation failed:", error);
      }
      await updateBooking({ calendar_event_link: calendarEventLink, calendar_error: calendarError });
      const text = [
      "New audio equipment booking", `Name: ${data.firstName} ${data.lastName}`, `Email: ${data.email}`, `Mobile: ${data.mobile}`,
      `Event type: ${data.eventType}`, `Event address: ${data.eventAddress}`,
      `Pickup: ${data.pickupDate} at ${data.pickupTime}`, `Drop-off: ${data.dropoffDate} at ${data.dropoffTime}`, `Package: ${data.packageInterest}`, "",
      `Selected hire items: ${data.selectedEquipment || "None specified"}`, "",
      `Add-ons: ${selectedAddOns.length ? selectedAddOns.join(", ") : "None selected"}`, "",
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
      attachments: await Promise.all(files.map(async (file) => ({ filename: file.name, content: Buffer.from(await file.arrayBuffer()).toString("base64") }))),
      });
      const customerEmail = resend.emails.send({
      from: fromEmail, to: [data.email], replyTo: toEmail, subject: "Your booking request has been received",
      text: [
        `Hi ${data.firstName},`, "", "Thanks for submitting your booking request to Peppermint Audio.", "",
        `Event: ${data.eventType}`, `Event address: ${data.eventAddress}`, `Pickup: ${formatEmailDate(data.pickupDate)} at ${data.pickupTime}`,
        `Drop-off: ${formatEmailDate(data.dropoffDate)} at ${data.dropoffTime}`, `Package: ${data.packageInterest}`,
        `Selected hire items: ${data.selectedEquipment || "None specified"}`,
        `Add-ons: ${selectedAddOns.length ? selectedAddOns.join(", ") : "None selected"}`,
        "", "We have received your booking request and photo ID. Your request is not confirmed yet; our team will review availability and be in touch shortly.", "",
        emailFooterText,
      ].join("\n"),
      html: `
        <div style="margin:0;background:#f4f1ed;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#20211f">
          <div style="margin:0 auto;max-width:600px;overflow:hidden;border:1px solid #e4ddd5;border-radius:16px;background:#fff">
            <div style="background:#1c2925;padding:28px 32px;text-align:center">
              <img src="${logoUrl}" alt="Peppermint Audio" width="170" style="display:block;width:170px;height:auto;margin:0 auto" />
            </div>
            <div style="padding:34px 32px">
              <p style="margin:0 0 8px;color:#5c806f;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Booking received</p>
              <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#20211f">Thanks, ${escapeHtml(data.firstName)}.</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#565955">We have received your booking request and photo ID. Your request is not confirmed yet; our team will review availability and be in touch shortly.</p>
              <div style="border:1px solid #e4ddd5;border-radius:12px;background:#faf9f7;padding:20px">
                <p style="margin:0 0 16px;font-size:14px;font-weight:bold;color:#20211f">Booking summary</p>
                <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5">
                  <tr><td style="padding:7px 12px 7px 0;color:#777b75">Event</td><td style="padding:7px 0;color:#20211f;font-weight:bold">${escapeHtml(data.eventType)}</td></tr>
                  <tr><td style="padding:7px 12px 7px 0;color:#777b75">Address</td><td style="padding:7px 0;color:#20211f">${escapeHtml(data.eventAddress)}</td></tr>
                  <tr><td style="padding:7px 12px 7px 0;color:#777b75">Pickup</td><td style="padding:7px 0;color:#20211f">${formatEmailDate(data.pickupDate)} at ${escapeHtml(data.pickupTime)}</td></tr>
                  <tr><td style="padding:7px 12px 7px 0;color:#777b75">Drop-off</td><td style="padding:7px 0;color:#20211f">${formatEmailDate(data.dropoffDate)} at ${escapeHtml(data.dropoffTime)}</td></tr>
                  <tr><td style="padding:7px 12px 7px 0;color:#777b75">Package</td><td style="padding:7px 0;color:#20211f">${escapeHtml(data.packageInterest)}</td></tr>
                  <tr><td style="padding:7px 12px 7px 0;color:#777b75">Selected hire items</td><td style="padding:7px 0;color:#20211f">${escapeHtml(data.selectedEquipment || "None specified")}</td></tr>
                  <tr><td style="padding:7px 12px 7px 0;color:#777b75">Add-ons</td><td style="padding:7px 0;color:#20211f">${escapeHtml(selectedAddOns.length ? selectedAddOns.join(", ") : "None selected")}</td></tr>
                </table>
              </div>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#565955">If any of these details need correcting, simply reply to this email and our team will help.</p>
            </div>
            ${emailFooterHtml}
          </div>
        </div>
      `,
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
    return NextResponse.json({ ok: true, bookingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown booking error";
    console.error("Booking submission failed:", error);
    return NextResponse.json({ error: `Your booking could not be completed: ${message}` }, { status: 500 });
  }
}
