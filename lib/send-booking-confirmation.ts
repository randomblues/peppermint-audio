import { Resend } from "resend";

import { buildBookingConfirmationEmail } from "@/lib/booking-confirmation-email";
import { getMelbourneToday } from "@/lib/date-utils";

export type BookingConfirmationRecord = {
  email: string;
  first_name: string;
  event_type: string;
  pickup_date: string;
  dropoff_date: string;
  pickup_time?: string | null;
  dropoff_time?: string | null;
  created_at?: string | null;
  package_interest: string;
  add_ons: string[] | null;
  additional_details?: string | null;
};

export async function sendBookingConfirmationEmail(booking: BookingConfirmationRecord) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email service is not configured.");

  const createdAt = booking.created_at ? new Date(booking.created_at) : null;
  const isSameDayBooking = Boolean(
    createdAt &&
    !Number.isNaN(createdAt.getTime()) &&
    getMelbourneToday(createdAt) === booking.pickup_date,
  );
  const email = buildBookingConfirmationEmail({
    firstName: booking.first_name,
    eventType: booking.event_type,
    pickupDate: booking.pickup_date,
    dropoffDate: booking.dropoff_date,
    pickupTime: booking.pickup_time,
    dropoffTime: booking.dropoff_time,
    packageInterest: booking.package_interest,
    addOns: booking.add_ons ?? [],
    pickupInstructions: isSameDayBooking
      ? {
        package_interest: booking.package_interest,
        add_ons: booking.add_ons,
        additional_details: booking.additional_details ?? null,
      }
      : undefined,
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
