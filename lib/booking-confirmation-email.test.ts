import { describe, expect, it } from "vitest";

import { buildBookingConfirmationEmail } from "./booking-confirmation-email";

describe("buildBookingConfirmationEmail", () => {
  it("builds a confirmation with booking details and escaped HTML", () => {
    const email = buildBookingConfirmationEmail({
      firstName: "<Alex>",
      eventType: "Wedding & reception",
      pickupDate: "9 October 2026",
      dropoffDate: "11 October 2026",
      pickupTime: "10:00",
      dropoffTime: "17:00",
      packageInterest: "Standard package",
      addOns: ["Wireless Microphone Upgrade"],
    });

    expect(email.subject).toBe("Your booking with Peppermint Audio has been confirmed.");
    expect(email.text).toContain("Your booking with Peppermint Audio has been confirmed.");
    expect(email.text).toContain("Wireless Microphone Upgrade");
    expect(email.text).toContain("Pickup: 9 October 2026 at 10:00");
    expect(email.html).toContain("Drop-off:</strong> 11 October 2026 at 17:00");
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

  it("includes pickup reminder instructions when requested for a same-day booking", () => {
    const email = buildBookingConfirmationEmail({
      firstName: "Alex",
      eventType: "Party",
      pickupDate: "3 October 2026",
      dropoffDate: "4 October 2026",
      pickupTime: "10:00",
      dropoffTime: "17:00",
      packageInterest: "Standard Party & Events Package",
      addOns: ["Wireless Microphone Upgrade"],
      pickupInstructions: {
        package_interest: "standard-party-events",
        add_ons: ["Wireless Microphone Upgrade"],
        additional_details: "Please call on arrival.",
      },
    });

    expect(email.text).toContain("Same-day pickup details:");
    expect(email.text).toContain("Pickup address: 181 Nicholson St, Abbotsford VIC 3067");
    expect(email.text).toContain("Please call on arrival.");
    expect(email.html).toContain("Same-day pickup details");
    expect(email.html).toContain("181 Nicholson St, Abbotsford VIC 3067");
  });
});
