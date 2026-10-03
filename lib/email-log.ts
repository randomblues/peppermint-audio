import { createAdminClient } from "@/lib/supabase";

export const customerEmailTypes = [
  "booking_request",
  "confirmation",
  "pickup_reminder",
  "custom",
  "invoice",
  "enquiry",
] as const;

export type CustomerEmailType = (typeof customerEmailTypes)[number];
type AdminClient = ReturnType<typeof createAdminClient>;

export async function recordCustomerEmail(
  admin: AdminClient,
  input: {
    bookingId?: string | null;
    recipientEmail: string;
    emailType: CustomerEmailType;
    providerMessageId?: string | null;
  },
) {
  const result = await admin.from("booking_email_log").insert({
    booking_id: input.bookingId ?? null,
    recipient_email: input.recipientEmail,
    email_type: input.emailType,
    provider_message_id: input.providerMessageId ?? null,
  });
  if (result.error) {
    throw new Error(`Customer email log persistence failed: ${result.error.message}`);
  }
}
