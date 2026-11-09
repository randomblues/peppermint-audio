import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/booking-calendar-access", () => ({ readBookingCalendar: mocks.read }));
import { createHireCalendarEvent } from "@/lib/booking-calendar";
import { GET } from "./route";
import { GET as download } from "./[kind]/route";

const token = "a".repeat(22);
const context = { params: Promise.resolve({ token }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({
    reference: "PA-123456",
    events: [createHireCalendarEvent("pickup", "2026-11-10", "10:00"), createHireCalendarEvent("dropoff", "2026-11-11", "18:00")],
  });
});
describe("private calendar API", () => {
  it("returns minimal calendar details without caching or indexing them", async () => {
    const response = await GET(new Request(`http://localhost/api/calendar/${token}`), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect((await response.json()).events).toHaveLength(2);
  });
  it.each(["pickup", "dropoff"])("downloads an actual %s calendar file", async kind => {
    const response = await download(new Request(`http://localhost/api/calendar/${token}/${kind}`), { params: Promise.resolve({ token, kind }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(response.headers.get("content-disposition")).toContain(`peppermint-audio-${kind}.ics`);
    const file = await response.text();
    expect(file).toContain("BEGIN:VCALENDAR\r\n");
    expect(file).toContain(kind === "pickup" ? "DTSTART:20261109T230000Z" : "DTSTART:20261111T070000Z");
  });
  it("returns an explicit 400 for an unsupported event kind", async () => {
    expect((await GET(new Request(`http://localhost/api/calendar/${token}?event=other`), context)).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(["/hire", "?event=hire"])("downloads one file containing separate pickup and drop-off events via %s", async suffix => {
    const response = suffix.startsWith("/")
      ? await download(new Request(`http://localhost/api/calendar/${token}${suffix}`), { params: Promise.resolve({ token, kind: "hire" }) })
      : await GET(new Request(`http://localhost/api/calendar/${token}${suffix}`), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-disposition")).toContain("peppermint-audio-hire.ics");
    const file = await response.text();
    expect(file.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(file).toContain("DTSTART:20261109T230000Z\r\n");
    expect(file).toContain("DTSTART:20261111T070000Z\r\n");
    expect(file).toContain("SUMMARY:Peppermint Audio pickup\r\n");
    expect(file).toContain("SUMMARY:Peppermint Audio drop-off\r\n");
  });
  it("does not export an invalid hire period", async () => {
    mocks.read.mockResolvedValueOnce({ reference: "PA-123456", events: [] });
    const response = await download(new Request(`http://localhost/api/calendar/${token}/hire`), { params: Promise.resolve({ token, kind: "hire" }) });
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
  it("distinguishes missing links from operational failures without exposing diagnostics", async () => {
    mocks.read.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
    mocks.read.mockRejectedValueOnce(new Error("Private database diagnostic"));
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("Private database diagnostic");
  });
});
