import { describe, expect, it } from "vitest";
import { normalizeAustralianMobileNumber } from "./sms-mobile-number";

describe("normalizeAustralianMobileNumber", () => {
  it.each([
    ["0412 345 678", "61412345678"],
    ["0412-345-678", "61412345678"],
    ["+61 412 345 678", "61412345678"],
    ["61412345678", "61412345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeAustralianMobileNumber(input)).toBe(expected);
  });

  it.each(["041234567", "0312345678", "+1 415 555 0100", "04123456789", ""])(
    "rejects %s",
    (input) => expect(normalizeAustralianMobileNumber(input)).toBeNull(),
  );
});
