import { describe, expect, it } from "vitest";
import { buildPickupReminderEmail, findPackage, getMelbourneTomorrow } from "@/lib/pickup-reminders";

describe("pickup reminders", () => {
  it("matches packages by slug and display name", () => {
    expect(findPackage("big-celebration")?.inclusions).toContain("1 x 15-Inch Subwoofer.");
    expect(findPackage("Standard Party & Events Package")?.slug).toBe("standard-party-events");
  });

  it("calculates tomorrow in Melbourne across a DST boundary", () => {
    expect(getMelbourneTomorrow(new Date("2026-10-03T16:00:00Z"))).toBe("2026-10-05");
  });

  it("escapes customer content and includes all reminder requirements", () => {
    const email = buildPickupReminderEmail({
      email: "customer@example.com",
      first_name: "<Sam>",
      last_name: "O'Neil",
      event_type: "Wedding & party",
      pickup_date: "2026-09-29",
      package_interest: "speech-presentation",
      additional_details: "Need <extra> cable",
    });
    expect(email.html).toContain("&lt;Sam&gt;");
    expect(email.html).toContain("181 Nicholson St, Abbotsford VIC 3067");
    expect(email.html).toContain("0452 316 823");
    expect(email.html).toContain("Additional requirements");
    expect(email.html).toContain("Need &lt;extra&gt; cable");
    expect(email.text).toContain("Please note:");
    expect(email.text).toContain("2 x Bose S1 Pro PA Speakers (150W each).");
  });
});
