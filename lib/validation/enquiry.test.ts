import { describe, expect, it } from "vitest";
import { enquirySchema } from "./enquiry";

const validEnquiry = {
  name: "Sam Jones",
  email: "customer@example.com",
  phone: "0412345678",
  eventDate: "2099-10-01",
  eventType: "Birthday",
  packageInterest: "standard",
  message: "A party with music and speeches.",
};

describe("enquirySchema", () => {
  it("accepts valid values", () => {
    expect(enquirySchema.safeParse(validEnquiry).success).toBe(true);
  });

  it("enforces required field lengths and email format", () => {
    expect(enquirySchema.safeParse({ ...validEnquiry, email: "not-an-email" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, message: "Too short" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, name: "A" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, eventDate: "" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...validEnquiry, eventDate: "2000-01-01" }).success).toBe(false);
  });
});
