import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBookingCalendarEvent, isGoogleCalendarEnabled } from "@/lib/google-calendar";

export async function syncConfirmedBookingCalendar(admin: SupabaseClient, bookingId: string) {
  if (!isGoogleCalendarEnabled()) return;
  const result = await admin.from("bookings")
    .select("id,status,first_name,last_name,email,mobile,event_type,event_address,pickup_date,pickup_time,dropoff_date,dropoff_time,hire_line_items,additional_details,calendar_event_link")
    .eq("id", bookingId).single();
  if (result.error || !result.data) throw new Error("Confirmed booking could not be loaded for Google Calendar.");
  const booking = result.data;
  if (booking.status !== "confirmed" || booking.calendar_event_link) return;
  let link: string | null;
  try {
    link = await createBookingCalendarEvent({
      firstName: booking.first_name, lastName: booking.last_name, email: booking.email, mobile: booking.mobile,
      eventType: booking.event_type, eventAddress: booking.event_address,
      pickupDate: booking.pickup_date, pickupTime: booking.pickup_time,
      dropoffDate: booking.dropoff_date, dropoffTime: booking.dropoff_time,
      hireLineItems: booking.hire_line_items ?? [], additionalDetails: booking.additional_details ?? "",
    }, { bookingId });
    if (!link) throw new Error("Google Calendar did not save the confirmed booking.");
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Google Calendar event creation failed.";
    const saved = await admin.from("bookings").update({ calendar_error: message }).eq("id", bookingId);
    if (saved.error) throw new AggregateError([cause, new Error(saved.error.message)], "Google Calendar failed and its error could not be saved.");
    throw cause;
  }
  const saved = await admin.from("bookings").update({ calendar_event_link: link, calendar_error: null }).eq("id", bookingId);
  if (saved.error) throw new Error("Google Calendar event was saved, but its booking tracking could not be saved. Retry confirmation to recover.");
}
