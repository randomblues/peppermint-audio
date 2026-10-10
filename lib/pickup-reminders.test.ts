import { describe, expect, it } from "vitest";
import { buildPickupReminderEmail, formatMelbourneDate, getMelbourneTomorrow } from "@/lib/pickup-reminders";

describe("pickup reminders", () => {
  it("formats dates consistently", () => {
    expect(formatMelbourneDate("2026-09-29")).toBe("29 September 2026");
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
      hire_line_items: [{
        id: "package:speech-presentation",
        kind: "package",
        catalogKey: "package:speech-presentation",
        name: "Speech & Presentation Package",
        quantity: 1,
        unitPriceCents: 6500,
      }, {
        id: "custom:wireless-microphone",
        kind: "custom",
        name: "Wireless Microphone",
        quantity: 1,
        unitPriceCents: 2500,
      }],
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
    expect(email.text).toContain("Hire items:");
    expect(email.text).toContain("Wireless Microphone");
  });

  it("uses safe fallbacks when hire items and details are absent", () => {
    const email = buildPickupReminderEmail({
      email: "customer@example.com",
      first_name: "Alex",
      last_name: "Lee",
      event_type: "Meeting",
      pickup_date: "2026-09-29",
      hire_line_items: [],
      additional_details: "   ",
    });
    expect(email.text).toContain("- None specified");
    expect(email.html).not.toContain("Additional requirements</h2>");
  });
});
