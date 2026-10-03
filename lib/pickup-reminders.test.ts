import { describe, expect, it } from "vitest";
import { buildPickupReminderEmail, escapeHtml, findPackage, formatMelbourneDate, getMelbourneTomorrow } from "@/lib/pickup-reminders";

describe("pickup reminders", () => {
  it("matches packages by slug and display name", () => {
    expect(findPackage("big-celebration")?.inclusions).toContain("1 x 15-Inch Subwoofer.");
    expect(findPackage("Standard Party & Events Package")?.slug).toBe("standard-party-events");
    expect(findPackage("  BIG-CELEBRATION  ")?.name).toBe("Big Celebration Package");
    expect(findPackage("not-a-package")).toBeUndefined();
  });

  it("formats dates consistently and escapes every HTML-sensitive character", () => {
    expect(formatMelbourneDate("2026-09-29")).toBe("29 September 2026");
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
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
      pickup_time: "10:00",
      package_interest: "speech-presentation",
      add_ons: ["Wireless Microphone Upgrade"],
      additional_details: "Need <extra> cable",
    });
    expect(email.html).toContain("&lt;Sam&gt;");
    expect(email.html).toContain("181 Nicholson St, Abbotsford VIC 3067");
    expect(email.html).not.toContain(">Event</td>");
    expect(email.text).not.toContain("Event:");
    expect(email.html).toContain("0452 316 823");
    expect(email.html).toContain("Additional requirements");
    expect(email.html).toContain("Need &lt;extra&gt; cable");
    expect(email.text).toContain("Please note:");
    expect(email.text).toContain("pickup is tomorrow, 29 September 2026 at 10:00");
    expect(email.text).toContain("2 x Bose S1 Pro PA Speakers (150W each).");
    expect(email.text).toContain("Wireless Microphone Upgrade");
  });

  it("uses safe fallbacks when package, add-ons, and details are absent", () => {
    const email = buildPickupReminderEmail({
      email: "customer@example.com",
      first_name: "Alex",
      last_name: "Lee",
      event_type: "Meeting",
      pickup_date: "2026-09-29",
      package_interest: "unknown-package",
      add_ons: null,
      additional_details: "   ",
    });
    expect(email.text).toContain("Package: unknown-package");
    expect(email.text).toContain("None selected");
    expect(email.html).toContain("Please confirm the package inclusions");
    expect(email.html).not.toContain("Additional requirements</h2>");
  });
});
