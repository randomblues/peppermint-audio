import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.admin }));
import { ensureBookingCalendarLink, readBookingCalendar } from "./booking-calendar-access";

const token = "a".repeat(22);
const booking = {
  id: "00000000-0000-4000-8000-000000000001", status: "confirmed",
  pickup_date: "2026-11-10", pickup_time: "10:00", dropoff_date: "2026-11-11", dropoff_time: "18:00", calendar_token: token,
};
function client() {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: booking, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: booking, error: null }),
  };
  mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.peppermintaudio.com.au");
});
afterEach(() => vi.unstubAllEnvs());

describe("private booking calendar access", () => {
  it("uses a stable 66-character link without exposing the booking ID", async () => {
    const query = client();
    const link = await ensureBookingCalendarLink(booking.id);
    expect(link).toBe(`https://www.peppermintaudio.com.au/calendar/${token}`);
    expect(link).toHaveLength(66);
    expect(link).not.toContain(booking.id);
    expect(query.update).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("status", "confirmed");
  });

  it("creates a 128-bit token only when none exists", async () => {
    const query = client();
    query.single.mockResolvedValueOnce({ data: { calendar_token: null }, error: null });
    await ensureBookingCalendarLink(booking.id);
    expect(query.update).toHaveBeenCalledWith({ calendar_token: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/) });
    expect(query.is).toHaveBeenCalledWith("calendar_token", null);
  });

  it("reuses the winner's token after concurrent creation", async () => {
    const query = client();
    query.single.mockResolvedValueOnce({ data: { calendar_token: null }, error: null });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await ensureBookingCalendarLink(booking.id)).toContain(token);
    expect(query.single).toHaveBeenCalledTimes(2);
  });

  it("fails explicitly if the token cannot be persisted", async () => {
    const query = client();
    query.single.mockResolvedValueOnce({ data: { calendar_token: null }, error: null });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
    await expect(ensureBookingCalendarLink(booking.id)).rejects.toThrow("could not be saved");
  });

  it("returns only the customer reference and public calendar details", async () => {
    const query = client();
    const result = await readBookingCalendar(token, new Date("2026-11-09T00:00:00Z"));
    expect(Object.keys(result!)).toEqual(["reference", "events"]);
    expect(result?.events.map(event => event.kind)).toEqual(["pickup", "dropoff"]);
    expect(query.eq).toHaveBeenCalledWith("calendar_token", token);
    expect(query.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(query.select).not.toHaveBeenCalledWith("*");
  });

  it("rejects malformed, missing, cancelled and expired links", async () => {
    expect(await readBookingCalendar("bad")).toBeNull();
    expect(mocks.admin).not.toHaveBeenCalled();
    const query = client();
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await readBookingCalendar(token)).toBeNull();
    query.maybeSingle.mockResolvedValueOnce({ data: { ...booking, status: "cancelled" }, error: null });
    expect(await readBookingCalendar(token)).toBeNull();
    expect(await readBookingCalendar(token, new Date("2026-12-12T00:00:00Z"))).toBeNull();
  });

  it("surfaces database errors instead of pretending the booking is missing", async () => {
    const query = client();
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "DB unavailable" } });
    await expect(readBookingCalendar(token)).rejects.toThrow("could not be loaded");
  });
});
