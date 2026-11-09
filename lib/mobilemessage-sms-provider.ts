import "server-only";
import type { SmsMessage, SmsProvider, SmsReceipt } from "./sms-provider-types";
import { normalizeAustralianMobileNumber } from "./sms-mobile-number";

interface MobileMessageConfiguration {
  username: string;
  password: string;
  senderId: string;
  testRecipient?: string;
}

export class MobileMessageSmsProvider implements SmsProvider {
  constructor(
    private readonly configuration: MobileMessageConfiguration,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send(message: SmsMessage, options: { idempotencyKey?: string } = {}): Promise<SmsReceipt> {
    if (!message.body.trim()) throw new Error("SMS body must not be empty.");
    const to = normalizeAustralianMobileNumber(this.configuration.testRecipient ?? message.to);
    if (!to) throw new Error("SMS recipient must be an Australian mobile number.");
    if (!this.configuration.senderId.trim()) throw new Error("An approved SMS sender ID is required.");

    const authorization = Buffer.from(
      `${this.configuration.username}:${this.configuration.password}`,
    ).toString("base64");
    const response = await this.fetcher("https://api.mobilemessage.com.au/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        messages: [{ to, message: message.body, sender: this.configuration.senderId }],
        max_parts: message.maxParts ?? 1,
        enable_unicode: false,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`SMS provider rejected the request (${response.status}).`);
    }

    let result: { results?: unknown } | null;
    try {
      result = await response.json() as { results?: unknown } | null;
    } catch {
      throw new Error("SMS provider returned an invalid response.");
    }
    if (!result || typeof result !== "object" || !Array.isArray(result.results)) {
      throw new Error("SMS provider returned an invalid response.");
    }
    const messageResult = result.results[0] as { status?: unknown; message_id?: unknown } | undefined;
    if (messageResult?.status !== "success" || typeof messageResult.message_id !== "string" || !messageResult.message_id) {
      const error = messageResult?.status === "blocked"
        ? "The recipient has opted out of SMS."
        : "SMS provider did not accept the message.";
      throw new Error(error);
    }

    return { id: messageResult.message_id };
  }
}
