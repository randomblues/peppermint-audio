import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStatus } from "@/lib/admin-dashboard";
import { getMelbourneToday } from "@/lib/date-utils";
import { recordCustomerEmail } from "@/lib/email-log";
import { EmailTransport, emailConfiguration } from "@/lib/email-transport";
import { buildPickupReminderEmail, getMelbourneTomorrow, type PickupReminderBooking } from "@/lib/pickup-reminders";

export const pickupReminderFields = "id,email,first_name,last_name,status,event_type,pickup_date,pickup_time,hire_line_items,additional_details,reminder_sent_at";

export type TrackedPickupReminderBooking = PickupReminderBooking & {
  id: string;
  status: BookingStatus;
  reminder_sent_at: string | null;
};

export async function sendPickupReminderEmail(admin: SupabaseClient, booking: TrackedPickupReminderBooking) {
  if (booking.status !== "confirmed" || booking.reminder_sent_at) return false;
  const { apiKey, from } = emailConfiguration();
  if (!apiKey || !from) throw new Error("Email service is not configured.");

  // Keep retries identical even if confirmation and the cron run on different days.
  const email = buildPickupReminderEmail(booking, { tomorrow: false });
  const response = await new EmailTransport(apiKey).emails.send({
    from, to: [booking.email], subject: email.subject, text: email.text, html: email.html,
  }, { idempotencyKey: `pickup-reminder-${booking.id}-${booking.pickup_date}` });
  if (response.error) throw new Error(response.error.message);

  const sentAt = new Date().toISOString();
  const update = await admin.from("bookings")
    .update({ reminder_sent_at: sentAt, updated_at: sentAt })
    .eq("id", booking.id).is("reminder_sent_at", null).select("id").maybeSingle();
  if (update.error) throw new Error(`Reminder sent but could not be marked: ${update.error.message}`);
  if (!update.data) return false;

  await recordCustomerEmail(admin, {
    bookingId: booking.id,
    recipientEmail: booking.email,
    emailType: "pickup_reminder",
    providerMessageId: response.data?.id,
  });
  return true;
}

export async function sendDuePickupReminderEmail(admin: SupabaseClient, bookingId: string, now = new Date()) {
  const result = await admin.from("bookings").select(pickupReminderFields).eq("id", bookingId).single();
  if (result.error) throw new Error(`Pickup reminder booking could not be read: ${result.error.message}`);
  if (!result.data) throw new Error("Pickup reminder booking could not be found.");
  const booking: TrackedPickupReminderBooking = result.data;
  if (![getMelbourneToday(now), getMelbourneTomorrow(now)].includes(booking.pickup_date)) return false;
  return sendPickupReminderEmail(admin, booking);
}
