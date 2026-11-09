import { describe, expect, it } from "vitest";
import { buildHireCalendarFile, createHireCalendarEvent, formatHireCalendarDate, HIRE_COLLECTION_ADDRESS } from "./booking-calendar";

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
});
