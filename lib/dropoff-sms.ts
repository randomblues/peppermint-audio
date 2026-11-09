import { isBookingSmsWindowDue } from "@/lib/pickup-sms";

export type DropoffSmsBooking = {
  id: string;
  mobile: string;
  status: string;
  dropoff_date: string;
  dropoff_time: string | null;
  dropoff_sms_sent_at: string | null;
  dropoff_sms_claimed_at: string | null;
};

export function isDropoffSmsDue(booking: DropoffSmsBooking, now = new Date()) {
  if (booking.status !== "confirmed" || booking.dropoff_sms_sent_at) return false;
  return isBookingSmsWindowDue(booking.dropoff_date, booking.dropoff_time, "drop-off", now);
}
