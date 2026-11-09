import "server-only";
import { isE164PhoneNumber, type SmsMessage, type SmsProvider, type SmsReceipt } from "./sms-provider-types";

export class SmsTransport {
  constructor(private readonly provider: SmsProvider) {}

  async send(message: SmsMessage, options?: { idempotencyKey?: string }): Promise<SmsReceipt> {
    if (!isE164PhoneNumber(message.to)) {
      throw new Error("SMS recipient must be an E.164 phone number.");
    }
    if (!message.body.trim()) {
      throw new Error("SMS body must not be empty.");
    }

    return this.provider.send(message, options);
  }
}
