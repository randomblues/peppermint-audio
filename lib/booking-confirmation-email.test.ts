import { describe, expect, it } from "vitest";

import { buildBookingConfirmationEmail } from "./booking-confirmation-email";

describe("buildBookingConfirmationEmail", () => {
  it("builds a confirmation with booking details and escaped HTML", () => {
    const email = buildBookingConfirmationEmail({
      firstName: "<Alex>",
      eventType: "Wedding & reception",
      pickupDate: "9 October 2026",
      dropoffDate: "11 October 2026",
      packageInterest: "Standard package",
      addOns: ["Wireless Microphone Upgrade"],
    });

    expect(email.subject).toBe("Your booking with Peppermint Audio has been confirmed.");
    expect(email.text).toContain("Your booking with Peppermint Audio has been confirmed.");
    expect(email.text).toContain("Wireless Microphone Upgrade");
    expect(email.html).toContain("&lt;Alex&gt;");
    expect(email.html).toContain("Wedding &amp; reception");
  });

  it("states when no add-ons were selected", () => {
    const email = buildBookingConfirmationEmail({
      firstName: "Alex",
      eventType: "Party",
      pickupDate: "9 October 2026",
      dropoffDate: "10 October 2026",
      packageInterest: "Speech package",
      addOns: [],
    });

    expect(email.text).toContain("Add-ons: None selected");
    expect(email.html).toContain("Add-ons:</strong> None selected");
  });
});
