import { createSmsProvider } from "@/lib/sms-provider";
import { SmsTransport } from "@/lib/sms-transport";
import { buildBookingConfirmationSms, buildDepositAttentionSms, buildPickupReminderSms, buildDropoffReminderSms } from "@/lib/sms-messages";
import { normalizeAustralianMobileNumber } from "@/lib/sms-mobile-number";
import { recordBookingSms, type BookingSmsType } from "@/lib/sms-log";
import type { SmsMessage } from "@/lib/sms-provider-types";
import { ensureBookingCalendarLink } from "@/lib/booking-calendar-access";

function providerPhone(mobile: string) {
  const normalized = normalizeAustralianMobileNumber(mobile);
  if (!normalized) throw new Error("SMS recipient must be an Australian mobile number.");
  return `+${normalized}`;
}

async function sendTrackedSms(
  booking: { id: string; mobile: string },
  body: string,
  smsType: BookingSmsType,
  idempotencyKey: string,
  maxParts?: SmsMessage["maxParts"],
) {
  const local = process.env.SUPABASE_TARGET === "local" || process.env.NODE_ENV !== "production";
  const recipientMobile = local ? process.env.LOCAL_SMS_TEST_RECIPIENT?.trim() || booking.mobile : booking.mobile;
  const log = { bookingId: booking.id, recipientMobile, smsType, body, idempotencyKey };
  let receipt;
  try {
    const provider = new SmsTransport(createSmsProvider());
    receipt = await provider.send({
      to: providerPhone(booking.mobile), body, ...(maxParts ? { maxParts } : {}),
    }, { idempotencyKey });
  } catch (cause) {
    try {
      await recordBookingSms({ ...log, status: "failed", error: cause instanceof Error ? cause.message : "SMS send failed." });
    } catch (logError) {
      throw new AggregateError([cause, logError], "SMS failed and its history could not be saved.");
    }
    throw cause;
  }
  await recordBookingSms({ ...log, status: "accepted", providerMessageId: receipt.id });
  return receipt;
}

export async function sendBookingConfirmationSms(booking: {
  id: string;
  mobile: string;
  pickup_date: string;
  pickup_time?: string | null;
}) {
  const calendarUrl = await ensureBookingCalendarLink(booking.id);
  return sendTrackedSms(booking, buildBookingConfirmationSms(booking, calendarUrl), "confirmation", `booking-confirmation-${booking.id}`, 2);
}

export async function sendPickupReminderSms(booking: {
  id: string;
  mobile: string;
  pickup_date: string;
  pickup_time?: string | null;
}) {
  return sendTrackedSms(booking, buildPickupReminderSms(booking), "pickup_reminder", `pickup-reminder-${booking.id}-${booking.pickup_date}`, 3);
}

export async function sendDepositAttentionSms(booking: {
  id: string; mobile: string; deposit_payment_status?: string; deposit_error?: string | null;
}) {
  return sendTrackedSms(booking, buildDepositAttentionSms(booking), "deposit_attention", `deposit-attention-${booking.id}`);
}

export async function sendDropoffReminderSms(booking: {
  id: string;
  mobile: string;
  dropoff_date: string;
  dropoff_time?: string | null;
}) {
  return sendTrackedSms(booking, buildDropoffReminderSms(booking), "dropoff_reminder", `dropoff-reminder-${booking.id}-${booking.dropoff_date}`, 3);
}
