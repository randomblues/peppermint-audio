import "server-only";
import { MobileMessageSmsProvider } from "./mobilemessage-sms-provider";
import type { SmsProvider } from "./sms-provider-types";
import { normalizeAustralianMobileNumber } from "./sms-mobile-number";

export function createSmsProvider(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SmsProvider {
  const local = environment.SUPABASE_TARGET === "local" || environment.NODE_ENV !== "production";
  if (local && environment.IS_LOCAL_SMS_ENABLED?.trim() !== "true") {
    throw new Error("SMS is disabled in local development. Set IS_LOCAL_SMS_ENABLED=true to enable it.");
  }
  const providerName = local ? "mobilemessage" : environment.SMS_PROVIDER?.trim();
  if (providerName !== "mobilemessage") {
    throw new Error("SMS_PROVIDER must be set to a supported provider.");
  }

  const testRecipient = local ? environment.LOCAL_SMS_TEST_RECIPIENT?.trim() : undefined;
  if (local && !normalizeAustralianMobileNumber(testRecipient ?? "")) {
    throw new Error("Local SMS requires one valid LOCAL_SMS_TEST_RECIPIENT.");
  }

  const username = environment.MOBILEMESSAGE_API_USERNAME?.trim();
  const password = environment.MOBILEMESSAGE_API_PASSWORD?.trim();
  const senderId = environment.MOBILEMESSAGE_SENDER_ID?.trim();
  if (!username || !password || !senderId) {
    throw new Error("SMS requires MOBILEMESSAGE_API_USERNAME, MOBILEMESSAGE_API_PASSWORD, and MOBILEMESSAGE_SENDER_ID.");
  }

  return new MobileMessageSmsProvider({ username, password, senderId, testRecipient });
}
