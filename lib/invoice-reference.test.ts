import { describe, expect, it } from "vitest";

import { invoiceNumberForBooking } from "./invoice-reference";

describe("invoiceNumberForBooking", () => {
  it("creates a stable bank-friendly reference from a booking ID", () => {
    expect(invoiceNumberForBooking("12345678-90ab-cdef-1234-567890abcdef")).toBe("PA-1234567890AB");
    expect(invoiceNumberForBooking("booking-3")).toBe("PA-BOOKING3");
  });

  it("rejects an empty booking ID", () => {
    expect(() => invoiceNumberForBooking("---")).toThrow("booking ID");
  });

});
