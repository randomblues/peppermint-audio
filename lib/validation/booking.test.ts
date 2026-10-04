import { describe, expect, it } from "vitest";
import { bookingSchema } from "./booking";

const validBooking = {
  email: "customer@example.com",
  firstName: "Sam",
  lastName: "Jones",
  mobile: "0412345678",
  eventType: "Birthday",
  eventAddress: "10 Smith Street",
  pickupDate: "2099-10-01",
  dropoffDate: "2099-10-02",
  pickupTime: "10:00",
  dropoffTime: "17:00",
  packageInterest: "standard-party-events",
  additionalDetails: "",
  termsAccepted: "accepted",
};

describe("bookingSchema", () => {
  it("accepts valid values and defaults add-ons", () => {
    const result = bookingSchema.parse(validBooking);
    expect(result.addOns).toBe("");
    expect(result.selectedEquipment).toBe("");
  });

  it("enforces minimum text lengths, terms, and the details maximum", () => {
    expect(bookingSchema.safeParse({ ...validBooking, firstName: "A" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, eventAddress: "1234" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, termsAccepted: "yes" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, additionalDetails: "x".repeat(3000) }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...validBooking, additionalDetails: "x".repeat(3001) }).success).toBe(false);
  });

  it("rejects dates before today and drop-off dates before pickup", () => {
    expect(bookingSchema.safeParse({ ...validBooking, pickupDate: "2000-01-01" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, dropoffDate: "2099-09-30" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, pickupTime: "25:00" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, pickupDate: "2099-10-01", dropoffDate: "2099-10-01", pickupTime: "17:00", dropoffTime: "10:00" }).success).toBe(false);
  });
});
