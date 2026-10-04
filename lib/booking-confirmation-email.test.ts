import { describe, expect, it } from "vitest";

import { buildBookingConfirmationEmail } from "./booking-confirmation-email";

describe("buildBookingConfirmationEmail", () => {
  it("builds a confirmation with booking details and escaped HTML", () => {
    const email = buildBookingConfirmationEmail({
      bookingReference: "PA-1234567890AB",
      firstName: "<Alex>",
      eventType: "Wedding & reception",
      pickupDate: "9 October 2026",
      dropoffDate: "11 October 2026",
      pickupTime: "10:00",
      dropoffTime: "17:00",
      hireLineItems: [{ id: "package:standard", kind: "package", name: "Standard package", quantity: 1, unitPriceCents: 16000 }, { id: "equipment:mic", kind: "equipment", name: "Wireless Microphone Upgrade", quantity: 1, unitPriceCents: 2000 }],
    });

    expect(email.subject).toBe("Your booking with Peppermint Audio has been confirmed.");
    expect(email.text).toContain("Your booking with Peppermint Audio has been confirmed.");
    expect(email.text).toContain("Booking reference: PA-1234567890AB");
    expect(email.text).toContain("Wireless Microphone Upgrade");
    expect(email.text).toContain("Pickup: 9 October 2026 at 10:00");
    expect(email.html).toContain("Drop-off");
    expect(email.html).toContain("11 October 2026 at 17:00");
    expect(email.html).toContain("&lt;Alex&gt;");
    expect(email.html).toContain("Wedding &amp; reception");
    expect(email.html).toContain("PA-1234567890AB");
  });

  it("states when no add-ons were selected", () => {
    const email = buildBookingConfirmationEmail({
      firstName: "Alex",
      eventType: "Party",
      pickupDate: "9 October 2026",
      dropoffDate: "10 October 2026",
      hireLineItems: [{ id: "package:speech", kind: "package", name: "Speech package", quantity: 1, unitPriceCents: 6500 }],
    });

    expect(email.text).toContain("Hire items: Speech package");
    expect(email.html).toContain("Hire items");
  });

  it("includes pickup reminder instructions when requested for a same-day booking", () => {
    const email = buildBookingConfirmationEmail({
      firstName: "Alex",
      eventType: "Party",
      pickupDate: "3 October 2026",
      dropoffDate: "4 October 2026",
      pickupTime: "10:00",
      dropoffTime: "17:00",
      hireLineItems: [{ id: "package:standard", kind: "package", name: "Standard Party & Events Package", quantity: 1, unitPriceCents: 16000 }],
      pickupInstructions: {
        hire_line_items: [{
          id: "package:standard-party-events",
          kind: "package",
          name: "Standard Party & Events Package",
          quantity: 1,
          unitPriceCents: 16000,
        }],
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
