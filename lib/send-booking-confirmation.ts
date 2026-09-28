import { Resend } from "resend";

import { buildBookingConfirmationEmail } from "@/lib/booking-confirmation-email";

export type BookingConfirmationRecord = {
  email: string;
  first_name: string;
  event_type: string;
  pickup_date: string;
  dropoff_date: string;
  package_interest: string;
  add_ons: string[] | null;
};

export async function sendBookingConfirmationEmail(booking: BookingConfirmationRecord) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email service is not configured.");

  const email = buildBookingConfirmationEmail({
    firstName: booking.first_name,
    eventType: booking.event_type,
    pickupDate: booking.pickup_date,
    dropoffDate: booking.dropoff_date,
    packageInterest: booking.package_interest,
    addOns: booking.add_ons ?? [],
  });
  const response = await new Resend(apiKey).emails.send({
    from,
    to: [booking.email],
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (response.error) throw new Error("Booking confirmation email could not be sent.");
  return response.data?.id ?? null;
}
