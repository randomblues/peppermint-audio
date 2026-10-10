import { describe, expect, it } from "vitest";
import { resendDevelopmentEnvironment } from "../scripts/dev-resend.mjs";

describe("local Resend launcher", () => {
  it("defaults to the designated test inbox without arguments", () => {
    expect(resendDevelopmentEnvironment([])).toEqual({
      LOCAL_EMAIL_MODE: "resend",
      LOCAL_EMAIL_TEST_RECIPIENT: "shanedsouza6823@gmail.com",
    });
  });

  it("selects controlled Resend mode with a trimmed test recipient", () => {
    expect(resendDevelopmentEnvironment([" test@example.com "])).toEqual({
      LOCAL_EMAIL_MODE: "resend",
      LOCAL_EMAIL_TEST_RECIPIENT: "test@example.com",
    });
  });

  it.each([
    [""], ["invalid"], ["a@example.com,b@example.com"],
    ["Test <test@example.com>"], ["a@example.com", "b@example.com"],
  ])("rejects empty, invalid or multiple recipients: %j", (...args) => {
    expect(() => resendDevelopmentEnvironment(args)).toThrow("Usage:");
  });
});
