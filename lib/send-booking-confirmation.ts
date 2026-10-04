import { Resend } from "resend";

import { buildBookingConfirmationEmail } from "@/lib/booking-confirmation-email";
import { bookingReferenceForId } from "@/lib/booking-reference";
import { getMelbourneToday } from "@/lib/date-utils";
import { lineItemsForBooking, type BookingLineItem } from "@/lib/booking-line-items";

export type BookingConfirmationRecord = {
  id?: string;
  email: string;
  first_name: string;
  event_type: string;
  pickup_date: string;
  dropoff_date: string;
  pickup_time?: string | null;
  dropoff_time?: string | null;
  created_at?: string | null;
  hire_line_items: BookingLineItem[] | null;
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
  const hireItems = lineItemsForBooking({ hire_line_items: booking.hire_line_items });
  const email = buildBookingConfirmationEmail({
    bookingReference: booking.id ? bookingReferenceForId(booking.id) : undefined,
    firstName: booking.first_name,
    eventType: booking.event_type,
    pickupDate: booking.pickup_date,
    dropoffDate: booking.dropoff_date,
    pickupTime: booking.pickup_time,
    dropoffTime: booking.dropoff_time,
    hireLineItems: hireItems,
    pickupInstructions: isSameDayBooking
      ? {
        hire_line_items: hireItems,
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
  if (response.error) {
    const providerMessage = typeof response.error.message === "string" ? response.error.message.trim() : "";
    throw new Error(providerMessage
      ? `Booking confirmation email could not be sent: ${providerMessage}`
      : "Booking confirmation email could not be sent.");
  }
  return response.data?.id ?? null;
}
