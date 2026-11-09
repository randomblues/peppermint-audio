import { getMelbourneToday } from "@/lib/date-utils";
import { getMelbourneTomorrow } from "@/lib/pickup-reminders";
import { melbourneHour } from "@/lib/payment-flow";

export type PickupSmsBooking = {
  id: string;
  mobile: string;
  status: string;
  pickup_date: string;
  pickup_time: string | null;
  payment_method: string | null;
  hire_payment_status: string;
  security_deposit_cents: number;
  deposit_payment_status: string;
  deposit_capture_before: string | null;
  pickup_sms_sent_at: string | null;
  pickup_sms_claimed_at: string | null;
};

export function isBookingSmsWindowDue(date: string, scheduledTime: string | null, kind: "pickup" | "drop-off", now: Date) {
  if (!scheduledTime || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(scheduledTime)) {
    throw new Error(`A valid agreed ${kind} time is required for the ${kind} SMS.`);
  }
  const today = getMelbourneToday(now);
  const hour = melbourneHour(now);
  const utcOffsetHours = (hour - now.getUTCHours() + 24) % 24;
  const morningStart = (21 + utcOffsetHours) % 24;
  const eveningStart = 8 + utcOffsetHours;
  const minute = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne", minute: "2-digit",
  }).format(now);
  const time = `${String(hour).padStart(2, "0")}:${minute.padStart(2, "0")}`;
  const early = scheduledTime.slice(0, 5) <= "09:00";
  return date === today
    ? time < scheduledTime.slice(0, 5) && (early || hour >= morningStart)
    : early && date === getMelbourneTomorrow(now) && hour >= eveningStart;
}

export function isPickupSmsDue(booking: PickupSmsBooking, now = new Date()) {
  if (!["submitted", "confirmed"].includes(booking.status) || booking.pickup_sms_sent_at) return false;
  if (!isBookingSmsWindowDue(booking.pickup_date, booking.pickup_time, "pickup", now)) return false;
  if (booking.payment_method !== "stripe_card_hold") return true;
  if (booking.hire_payment_status !== "paid") return false;
  if (booking.security_deposit_cents <= 0) return true;
  if (!["authorized", "captured"].includes(booking.deposit_payment_status)) return false;
  if (booking.deposit_payment_status === "authorized" && booking.deposit_capture_before
    && !(Date.parse(booking.deposit_capture_before) > now.getTime())) return false;
  return true;
}
