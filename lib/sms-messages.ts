import { bookingReferenceForId } from "./booking-reference";
import { depositDeclineCode } from "./deposit-decline-code";
import { melbourneDateKey } from "./payment-flow";
import { getMelbourneTomorrow } from "./pickup-reminders";
import { business } from "./site-content";

function formatPickupDate(value: string, includeWeekday = true) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: includeWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    timeZone: "Australia/Melbourne",
  }).format(new Date(`${value}T12:00:00Z`));
}

function reminderDay(date: string, now: Date) {
  return date === melbourneDateKey(now)
    ? "today"
    : date === getMelbourneTomorrow(now) ? "tomorrow" : `on ${formatPickupDate(date, false)}`;
}

function reminderTime(time: string | null | undefined) {
  if (!time) return "";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    throw new Error("Booking SMS requires a valid scheduled time.");
  }
  const [hour, minute] = time.split(":");
  const hourNumber = Number(hour);
  return ` at ${hourNumber % 12 || 12}:${minute} ${hourNumber < 12 ? "AM" : "PM"}`;
}

export function buildPhoneVerificationSms(code: string) {
  return `Peppermint Audio booking code: ${code}. Enter this on the booking page. It expires in 5 minutes.`;
}

export function buildBookingConfirmationSms(booking: {
  id: string;
  pickup_date: string;
  pickup_time?: string | null;
}, calendarUrl: string) {
  const pickupTime = booking.pickup_time ? ` ${booking.pickup_time.slice(0, 5)}` : "";
  return `Peppermint Audio: Booking confirmed. Pickup ${formatPickupDate(booking.pickup_date)}${pickupTime}. Ref ${bookingReferenceForId(booking.id)}. Reply here for help.\n\nAdd pickup & drop-off to your calendar: ${calendarUrl}`;
}

export function buildPickupReminderSms(booking: {
  pickup_date: string;
  pickup_time?: string | null;
}, now = new Date()) {
  const pickupDay = reminderDay(booking.pickup_date, now);
  const pickupTime = reminderTime(booking.pickup_time);
  return `Peppermint Audio: Hi! Your pickup is ${pickupDay}${pickupTime}, as requested. We're at 181 Nicholson St, Abbotsford. Please bring suitable transport in case you're collecting larger equipment.\n\nPlease note: Peppermint Audio is a small business operating from a private residence. Please respect the property and message or call ${business.phone} upon arrival. In case you're running late or need to change your scheduled pickup time, please contact us beforehand.`;
}

export function buildDropoffReminderSms(booking: {
  dropoff_date: string;
  dropoff_time?: string | null;
}, now = new Date()) {
  return `Peppermint Audio: Hi! Your equipment drop-off is ${reminderDay(booking.dropoff_date, now)}${reminderTime(booking.dropoff_time)}, as scheduled. Please check that all hired equipment, cables and accessories are accounted for and packed before returning them.\n\nMessage or call ${business.phone} upon arrival or in case you're running late or need to change your scheduled drop-off time to avoid a late drop-off fee.`;
}

export function buildDepositAttentionSms(booking: {
  deposit_payment_status?: string;
  deposit_error?: string | null;
} = {}) {
  const reasons: Record<string, string> = {
    insufficient_funds: "insufficient funds",
    expired_card: "the saved card has expired",
    incorrect_cvc: "the card security code could not be verified",
    card_not_supported: "the card is not supported",
    do_not_honor: "your bank declined it",
    generic_decline: "your bank declined it",
    transaction_not_allowed: "your bank did not allow this hold",
    restricted_card: "your bank restricted the card",
    issuer_not_available: "your bank could not be reached",
    processing_error: "a card processing error",
    try_again_later: "your bank could not approve it just now",
  };
  const code = depositDeclineCode(booking.deposit_error) ?? "";
  const reason = booking.deposit_payment_status === "failed" && Object.hasOwn(reasons, code)
    ? reasons[code]
    : undefined;
  const issue = booking.deposit_payment_status === "action_required"
    ? "Your bank needs you to verify the deposit hold."
    : booking.deposit_payment_status === "expired"
      ? "Your security-deposit hold has expired."
      : booking.deposit_payment_status === "hold_too_short"
        ? "Your deposit hold does not cover the hire period."
        : reason ? `Deposit hold failed: ${reason}.` : "Your security deposit needs attention.";
  return `Peppermint Audio: ${issue} Check your email to resolve it before pickup. Reply for help.`;
}
