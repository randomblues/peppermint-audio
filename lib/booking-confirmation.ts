import type { SupabaseClient } from "@supabase/supabase-js";

import { recordCustomerEmail } from "@/lib/email-log";
import { sendBookingConfirmationEmail, type BookingConfirmationRecord } from "@/lib/send-booking-confirmation";
import { sendBookingConfirmationSms } from "@/lib/send-booking-sms";
import { syncConfirmedBookingCalendar } from "@/lib/confirmed-booking-calendar";

export class ConfirmationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function sendConfirmationMessages(
  admin: SupabaseClient,
  bookingId: string,
  booking: BookingConfirmationRecord & {
    id: string;
    mobile: string;
    confirmation_email_sent: boolean;
    confirmation_sms_sent_at: string | null;
  },
) {
  if (!booking.confirmation_email_sent) {
    try {
      const providerMessageId = await sendBookingConfirmationEmail(booking, { idempotencyKey: `booking-confirmation-${bookingId}` });
      try {
        await recordCustomerEmail(admin, {
          bookingId,
          recipientEmail: booking.email,
          emailType: "confirmation",
          providerMessageId,
        });
      } catch (error) {
        console.error("Confirmation email log failed:", error);
      }
    } catch (error) {
      console.error("Booking confirmation email failed:", error);
      const message = error instanceof Error ? error.message : "Booking confirmation email could not be sent.";
      throw new ConfirmationError(`Booking confirmed, but the confirmation email failed. Use Send confirmation email to retry. ${message}`, 502);
    }
    const tracking = await admin.from("bookings")
      .update({ confirmation_email_sent: true, updated_at: new Date().toISOString() }).eq("id", bookingId);
    if (tracking.error) {
      throw new ConfirmationError("Booking confirmed and email sent, but email tracking could not be saved. Refresh before retrying to avoid sending a duplicate.", 500);
    }
  }
  if (!booking.confirmation_sms_sent_at) {
    try {
      await sendBookingConfirmationSms(booking);
    } catch (error) {
      console.error("Booking confirmation SMS failed:", error);
      throw new ConfirmationError("Booking confirmed and email sent, but the SMS could not be sent. Retry confirming this booking to try again.", 502);
    }
    const tracking = await admin.from("bookings")
      .update({ confirmation_sms_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", bookingId);
    if (tracking.error) {
      throw new ConfirmationError("Booking confirmation SMS was sent, but its delivery status could not be saved. Refresh before retrying.", 500);
    }
  }
}

export async function sendTrackedBookingConfirmation(...args: Parameters<typeof sendConfirmationMessages>) {
  const results = await Promise.allSettled([
    sendConfirmationMessages(...args),
    syncConfirmedBookingCalendar(args[0], args[1]),
  ]);
  const [messages, calendar] = results;
  if (calendar.status === "rejected") console.error("Confirmed booking Google Calendar sync failed:", calendar.reason);
  if (messages.status === "rejected") throw messages.reason;
  if (calendar.status === "rejected") {
    throw new ConfirmationError("Booking confirmed and customer notified, but Google Calendar could not be updated. Check the calendar connection and retry confirmation.", 502);
  }
}

export async function confirmPaidStripeBooking(admin: SupabaseClient, bookingId: string) {
  const fields = "id,status,email,mobile,first_name,event_type,pickup_date,dropoff_date,pickup_time,dropoff_time,created_at,hire_line_items,additional_details,confirmation_email_sent,confirmation_sms_sent_at,hire_payment_status";
  const result = await admin.from("bookings").select(fields).eq("id", bookingId).single();
  if (result.error) throw new Error(`Paid booking could not be read: ${result.error.message}`);
  const booking = result.data;
  if (!booking) throw new Error("Paid booking could not be found.");
  if (booking.hire_payment_status !== "paid" || !["submitted", "confirmed"].includes(booking.status)) return;
  const reservation = await admin.rpc("reserve_booking_inventory", {
    p_booking_id: bookingId,
    p_hire_line_items: booking.hire_line_items,
  });
  if (reservation.error) throw new Error(`Paid booking inventory could not be checked: ${reservation.error.message}`);
  if (!reservation.data?.ok) {
    throw new Error(reservation.data?.error ?? "Paid booking could not be confirmed with current inventory.");
  }
  if (booking.status === "submitted") {
    const update = await admin.from("bookings")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", bookingId).eq("status", "submitted").select("id").maybeSingle();
    if (update.error) throw new Error(`Paid booking could not be confirmed: ${update.error.message}`);
    if (!update.data) return;
  }
  await sendTrackedBookingConfirmation(admin, bookingId, booking);
}
