import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";

export const PHONE_VERIFICATION_LIFETIME_MS = 5 * 60 * 1000;

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createPhoneVerification(secret: string, phone: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  return {
    token,
    code,
    tokenHash: hmac(secret, `token:${token}`),
    codeHash: hmac(secret, `code:${token}:${phone}:${code}`),
    expiresAt: new Date(now.getTime() + PHONE_VERIFICATION_LIFETIME_MS).toISOString(),
  };
}

export function phoneVerificationTokenHash(secret: string, token: string) {
  return hmac(secret, `token:${token}`);
}

export function phoneVerificationCodeHash(secret: string, token: string, phone: string, code: string) {
  return hmac(secret, `code:${token}:${phone}:${code}`);
}

export function phoneVerificationIpHash(secret: string, ip: string) {
  return hmac(secret, `ip:${ip}`);
}
