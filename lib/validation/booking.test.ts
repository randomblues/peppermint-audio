import { describe, expect, it } from "vitest";
import { bookingSchema } from "./booking";

const validBooking = {
  email: "customer@example.com",
  firstName: "Sam",
  lastName: "Jones",
  mobile: "0412345678",
  eventType: "Birthday",
  eventAddress: "10 Smith Street",
  pickupDate: "2026-10-01",
  dropoffDate: "2026-10-02",
  packageInterest: "standard-party-events",
  guestCount: "1",
  additionalDetails: "",
  termsAccepted: "accepted",
};

describe("bookingSchema", () => {
  it("accepts valid values, coerces guest count, and defaults add-ons", () => {
    const result = bookingSchema.parse(validBooking);
    expect(result.guestCount).toBe(1);
    expect(result.addOns).toBe("");
  });

  it("accepts the guest-count boundaries", () => {
    expect(bookingSchema.safeParse({ ...validBooking, guestCount: "1000" }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...validBooking, guestCount: "0" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, guestCount: "1001" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, guestCount: "1.5" }).success).toBe(false);
  });

  it("enforces minimum text lengths, terms, and the details maximum", () => {
    expect(bookingSchema.safeParse({ ...validBooking, firstName: "A" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, eventAddress: "1234" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, termsAccepted: "yes" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, additionalDetails: "x".repeat(3000) }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...validBooking, additionalDetails: "x".repeat(3001) }).success).toBe(false);
  });
});
