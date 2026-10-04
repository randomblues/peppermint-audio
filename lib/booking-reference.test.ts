import { describe, expect, it } from "vitest";

import { bookingReferenceForId } from "./booking-reference";

describe("bookingReferenceForId", () => {
  it("creates a stable customer-facing reference from a booking ID", () => {
    expect(bookingReferenceForId("12345678-90ab-cdef-1234-567890abcdef")).toBe("PA-1234567890AB");
  });

  it("rejects an empty booking ID", () => {
    expect(() => bookingReferenceForId("---")).toThrow("booking reference");
  });
});
