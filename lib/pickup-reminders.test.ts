import { describe, expect, it } from "vitest";
import { buildPickupReminderEmail, formatMelbourneDate, getMelbourneTomorrow } from "@/lib/pickup-reminders";

describe("pickup reminders", () => {
  it("formats dates consistently", () => {
    expect(formatMelbourneDate("2026-09-29")).toBe("29 September 2026");
  });

  it("uses the actual date without tomorrow claims for manual reminders", () => {
    const email = buildPickupReminderEmail({
      email: "customer@example.com", first_name: "Alex", last_name: "Lee",
      event_type: "Meeting", pickup_date: "2026-09-29", pickup_time: "10:00",
      hire_line_items: [], additional_details: null,
    }, { tomorrow: false });
    expect(email.text).toContain("Your pickup is on 29 September 2026 at 10:00");
    expect(email.text).not.toContain("tomorrow");
    expect(email.html).not.toContain("tomorrow");
    expect(email.html).toContain("Your pickup details");
    expect(email.html).not.toContain("Pickup reminder");
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
    const residenceNotice = "Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.";
    expect(email.text).toContain(residenceNotice);
    expect(email.html).toContain(residenceNotice);
    expect(email.text).not.toMatch(/30 minutes before arriving/i);
    expect(email.html).not.toMatch(/30 minutes before arriving/i);
    expect(email.text).toContain("pickup is tomorrow, 29 September 2026 at 10:00");
    expect(email.text).toContain("Hire items:");
    expect(email.text).toContain("Wireless Microphone");
    for (const body of [email.text, new DOMParser().parseFromString(email.html, "text/html").body.textContent ?? ""]) {
      expect(body).toContain("Please make sure your vehicle has enough space for your hire, especially large PA speakers or other bulky equipment.");
      expect(body).toContain("Unsure it will fit? Message or call us and we can help you check.");
      expect(body).toContain("We're happy to lend a hand with loading. Please remember that safe transport and handling after pickup are your responsibility.");
      expect(body).not.toContain("Please bring suitable transport and valid photo ID for pickup.");
      expect(body).not.toContain("folded-down rear seats");
      expect(body).not.toContain("PreSonus AIR15s");
      expect(body).not.toContain("subwoofer");
      expect(body.match(/Hire items/g)).toHaveLength(1);
      expect(body.match(/Wireless Microphone/g)).toHaveLength(1);
    }
    const document = new DOMParser().parseFromString(email.html, "text/html");
    const contactBlock = document.querySelector("table")?.parentElement;
    expect(contactBlock?.textContent).toContain("181 Nicholson St, Abbotsford VIC 3067");
    expect(contactBlock?.textContent).toContain("0452 316 823");
    expect(contactBlock?.textContent).toContain(residenceNotice);
    expect(contactBlock?.textContent).not.toContain("Hire items");
    const itemsBlock = contactBlock?.nextElementSibling;
    expect(itemsBlock?.textContent).toContain("Hire items");
    expect(itemsBlock?.querySelectorAll("li")).toHaveLength(2);
    expect(itemsBlock?.textContent).toContain("Speech & Presentation Package");
    expect(itemsBlock?.textContent).toContain("Wireless Microphone");
    expect(email.text.indexOf("Phone:")).toBeGreaterThan(email.text.indexOf("Pickup address:"));
    expect(email.text.indexOf("Hire items:")).toBeGreaterThan(email.text.indexOf(residenceNotice));
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
