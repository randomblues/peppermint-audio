export interface SmsMessage {
  to: string;
  body: string;
  maxParts?: 1 | 2 | 3;
}

export interface SmsReceipt {
  id: string;
}

export interface SmsProvider {
  send(message: SmsMessage, options?: { idempotencyKey?: string }): Promise<SmsReceipt>;
}

export function isE164PhoneNumber(value: string | undefined): value is string {
  return typeof value === "string" && /^\+[1-9]\d{1,14}$/.test(value);
}
