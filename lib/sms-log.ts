import "server-only";
import { createAdminClient } from "@/lib/supabase";

export type BookingSmsType = "confirmation" | "pickup_reminder" | "dropoff_reminder" | "deposit_attention";
export type BookingSmsLog = {
  id: string;
  recipient_mobile: string;
  sms_type: BookingSmsType;
  body: string;
  status: "accepted" | "failed";
  provider_message_id: string | null;
  error: string | null;
  recorded_at: string;
};

export async function recordBookingSms(input: {
  bookingId: string;
  recipientMobile: string;
  smsType: BookingSmsType;
  body: string;
  idempotencyKey: string;
} & (
  | { status: "accepted"; providerMessageId: string }
  | { status: "failed"; error: string }
)) {
  const result = await createAdminClient().from("booking_sms_log").upsert({
    booking_id: input.bookingId,
    recipient_mobile: input.recipientMobile,
    sms_type: input.smsType,
    body: input.body,
    status: input.status,
    provider_message_id: input.status === "accepted" ? input.providerMessageId : null,
    error: input.status === "failed" ? input.error : null,
    idempotency_key: input.idempotencyKey,
    recorded_at: new Date().toISOString(),
  }, {
    onConflict: "idempotency_key",
    ignoreDuplicates: input.status === "failed",
  });
  if (result.error) throw new Error(`Booking SMS history could not be saved: ${result.error.message}`);
}
