import { describe, expect, it } from "vitest";
import { buildHireCalendarFile, createHireCalendarEvent, createHireCalendarPeriod, formatHireCalendarDate, HIRE_COLLECTION_ADDRESS } from "./booking-calendar";

describe("customer hire calendar events", () => {
  it.each([
    ["2026-11-10", "10:00:00", "2026-11-09T23:00:00.000Z"],
    ["2026-06-10", "10:00", "2026-06-10T00:00:00.000Z"],
    ["2026-10-04", "07:30", "2026-10-03T20:30:00.000Z"],
    ["2027-04-04", "07:30", "2027-04-03T21:30:00.000Z"],
  ])("converts %s %s from Melbourne time without DST drift", (date, time, expected) => {
    const event = createHireCalendarEvent("pickup", date, time);
    expect(event.startsAt).toBe(expected);
    const link = new URL(event.googleUrl);
    expect(link.origin).toBe("https://calendar.google.com");
    expect(link.searchParams.get("ctz")).toBe("Australia/Melbourne");
    expect(link.searchParams.get("dates")?.split("/")[0]).toBe(expected.replace(/[-:]/g, "").replace(".000", ""));
    expect(link.searchParams.get("location")).toBe(HIRE_COLLECTION_ADDRESS);
    expect(formatHireCalendarDate(event).time).toMatch(/(?:10:00|7:30) am/i);
  });

  it("exports a standalone Apple/Outlook event at the actual drop-off time", () => {
    const event = createHireCalendarEvent("dropoff", "2026-11-10", "18:00");
    const file = buildHireCalendarFile(event, "PA-123456", new Date("2026-11-01T00:00:00Z"));
    expect(file).toContain("DTSTART:20261110T070000Z\r\n");
    expect(file).toContain("SUMMARY:Peppermint Audio drop-off\r\n");
    expect(file).toContain("UID:PA-123456-dropoff@peppermintaudio.com.au\r\n");
    expect(file).toContain("LOCATION:181 Nicholson St\\, Abbotsford VIC 3067\r\n");
    expect(file).toContain("DTSTAMP:20261101T000000Z\r\n");
    expect(file).not.toContain("DTEND:");
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file.split("\r\n").every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it("labels legacy bookings without agreed times instead of inventing an appointment", () => {
    const event = createHireCalendarEvent("pickup", "2026-12-31", null);
    expect(event.startsAt).toBeNull();
    expect(formatHireCalendarDate(event).time).toBe("Time to be arranged");
    const file = buildHireCalendarFile(event, "PA-123456");
    expect(file).toContain("DTSTART;VALUE=DATE:20261231");
    expect(file).toContain("DTEND;VALUE=DATE:20270101");
    expect(file).toContain("Time to be arranged.");
  });

  it.each([["2026-02-30", "10:00"], ["2026-11-10", "25:00"], ["2026-11-10", "invalid"], ["2026-10-04", "02:30"]])(
    "rejects invalid dates and impossible Melbourne times: %s %s", (date, time) => {
      expect(() => createHireCalendarEvent("pickup", date, time)).toThrow();
    },
  );

  it.each([
    ["2026-11-10", "2026-11-11", "20261109T230000Z", "20261111T070000Z"],
    ["2026-11-10", "2026-11-10", "20261109T230000Z", "20261110T070000Z"],
    ["2026-10-03", "2026-10-04", "20261003T000000Z", "20261004T070000Z"],
    ["2027-04-03", "2027-04-04", "20270402T230000Z", "20270404T080000Z"],
  ])("adds one Google hire event and exports two Apple/Outlook events for %s through %s", (pickupDate, dropoffDate, start, end) => {
    const events = [
      createHireCalendarEvent("pickup", pickupDate, "10:00"),
      createHireCalendarEvent("dropoff", dropoffDate, "18:00"),
    ];
    const event = createHireCalendarPeriod(events);
    const link = new URL(event.googleUrl);
    expect(link.searchParams.get("dates")).toBe(`${start}/${end}`);
    expect(link.searchParams.get("ctz")).toBe("Australia/Melbourne");
    expect(link.searchParams.get("details")).toContain("Pickup:");
    expect(link.searchParams.get("details")).toContain("Drop-off:");
    const file = buildHireCalendarFile(events, "PA-123456", new Date("2026-11-01T00:00:00Z"));
    expect(file.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(file).toContain(`DTSTART:${start}\r\n`);
    expect(file).toContain(`DTSTART:${end}\r\n`);
    expect(file).toContain("SUMMARY:Peppermint Audio pickup\r\n");
    expect(file).toContain("SUMMARY:Peppermint Audio drop-off\r\n");
    expect(file).toContain("UID:PA-123456-pickup@peppermintaudio.com.au\r\n");
    expect(file).toContain("UID:PA-123456-dropoff@peppermintaudio.com.au\r\n");
    expect(event.description).toContain("10:00 am.");
    expect(event.description).toContain("6:00 pm.");
    expect(file.split("\r\n").every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it.each([[null, null], ["10:00", null], [null, "18:00"]])(
    "covers inclusive hire dates without inventing missing times (%s, %s)", (pickupTime, dropoffTime) => {
      const events = [
        createHireCalendarEvent("pickup", "2026-12-31", pickupTime),
        createHireCalendarEvent("dropoff", "2027-01-02", dropoffTime),
      ];
      const event = createHireCalendarPeriod(events);
      expect(event.startsAt).toBeNull();
      expect(event.endsAt).toBeNull();
      expect(new URL(event.googleUrl).searchParams.get("dates")).toBe("20261231/20270103");
      const file = buildHireCalendarFile(events, "PA-123456");
      expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(2);
      if (!pickupTime) {
        expect(file).toContain("DTSTART;VALUE=DATE:20261231\r\n");
        expect(file).toContain("DTEND;VALUE=DATE:20270101\r\n");
      } else {
        expect(file).toContain("DTSTART:20261230T230000Z\r\n");
      }
      if (!dropoffTime) {
        expect(file).toContain("DTSTART;VALUE=DATE:20270102\r\n");
        expect(file).toContain("DTEND;VALUE=DATE:20270103\r\n");
      } else {
        expect(file).toContain("DTSTART:20270102T070000Z\r\n");
      }
      expect(event.description).toContain("Time to be arranged");
      if (pickupTime) expect(event.description).toContain("10:00 am");
      if (dropoffTime) expect(event.description).toContain("6:00 pm");
    },
  );

  it("rejects incomplete, duplicate, reversed and zero-length hire periods", () => {
    const pickup = createHireCalendarEvent("pickup", "2026-11-10", "10:00");
    expect(() => createHireCalendarPeriod([pickup])).toThrow();
    expect(() => createHireCalendarPeriod([pickup, pickup])).toThrow();
    const invalidReturns: Array<[string, string | null]> = [["2026-11-09", null], ["2026-11-10", "09:00"], ["2026-11-10", "10:00"]];
    for (const [date, time] of invalidReturns) {
      const events = [pickup, createHireCalendarEvent("dropoff", date, time)];
      expect(() => createHireCalendarPeriod(events)).toThrow();
      expect(() => buildHireCalendarFile(events, "PA-123456")).toThrow();
    }
  });
});
