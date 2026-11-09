import { describe, expect, it } from "vitest";
import {
  createPhoneVerification,
  PHONE_VERIFICATION_LIFETIME_MS,
  phoneVerificationCodeHash,
  phoneVerificationIpHash,
  phoneVerificationTokenHash,
} from "./phone-verification";

describe("phone verification challenge helpers", () => {
  it("creates a short-lived six-digit code and stores only keyed hashes", () => {
    const now = new Date("2026-11-09T01:00:00.000Z");
    const challenge = createPhoneVerification("test-secret", "61412345678", now);

    expect(challenge.code).toMatch(/^\d{6}$/);
    expect(challenge.expiresAt).toBe(new Date(now.getTime() + PHONE_VERIFICATION_LIFETIME_MS).toISOString());
    expect(challenge.tokenHash).toBe(phoneVerificationTokenHash("test-secret", challenge.token));
    expect(challenge.codeHash).toBe(phoneVerificationCodeHash("test-secret", challenge.token, "61412345678", challenge.code));
    expect(challenge.codeHash).not.toContain(challenge.code);
    expect(phoneVerificationCodeHash("test-secret", challenge.token, "61400000000", challenge.code))
      .not.toBe(challenge.codeHash);
    expect(phoneVerificationIpHash("test-secret", "192.0.2.1"))
      .not.toBe(phoneVerificationIpHash("test-secret", "192.0.2.2"));
  });
});
