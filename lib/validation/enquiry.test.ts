import { describe, expect, it } from "vitest";
import { enquirySchema } from "./enquiry";

const validEnquiry = {
  name: "Sam Jones",
  email: "customer@example.com",
  phone: "0412345678",
  eventDate: "2099-10-01",
  eventType: "Birthday",
  packageInterest: "standard",
  guestCount: "1",
  message: "A party with music and speeches.",
};

describe("enquirySchema", () => {
  it("accepts valid values and coerces guest count", () => {
    const result = enquirySchema.parse(validEnquiry);
    expect(result.guestCount).toBe(1);
  });

  it("accepts guest count up to 1000 but rejects invalid boundaries", () => {
    expect(enquirySchema.safeParse({ ...validEnquiry, guestCount: "1000" }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...validEnquiry, guestCount: "0" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, guestCount: "1001" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, guestCount: "2.5" }).success).toBe(false);
  });

  it("enforces required field lengths and email format", () => {
    expect(enquirySchema.safeParse({ ...validEnquiry, email: "not-an-email" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, message: "Too short" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, name: "A" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, eventDate: "" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, eventDate: "2000-01-01" }).success).toBe(false);
  });
});
