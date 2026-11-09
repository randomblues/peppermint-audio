import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), enabled: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/google-calendar", () => ({ createBookingCalendarEvent: mocks.create, isGoogleCalendarEnabled: mocks.enabled }));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.admin }));
import { createAdminClient } from "@/lib/supabase";
import { syncConfirmedBookingCalendar } from "./confirmed-booking-calendar";

const booking = {
  id: "booking-1", status: "confirmed", calendar_event_link: null, first_name: "Test", last_name: "Booking",
  pickup_date: "2026-11-10", pickup_time: "10:00:00", dropoff_date: "2026-11-11", dropoff_time: "18:00:00",
};
function client(overrides = {}) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { ...booking, ...overrides }, error: null }),
    then: (resolve: (value: object) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.create.mockResolvedValue("https://calendar.google.test/event");
});
describe("confirmed booking owner calendar", () => {
  it("saves a missing event on confirmation with booking-scoped duplicate protection", async () => {
    const query = client();
    await syncConfirmedBookingCalendar(createAdminClient(), booking.id);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ pickupTime: "10:00:00" }), { bookingId: booking.id });
    expect(query.update).toHaveBeenCalledWith({ calendar_event_link: "https://calendar.google.test/event", calendar_error: null });
  });
  it.each([{ status: "submitted" }, { status: "cancelled" }, { status: "completed" }, { calendar_event_link: "https://calendar.google.test/existing" }])(
    "does not duplicate existing events or add unconfirmed bookings: %j", async overrides => {
      client(overrides);
      await syncConfirmedBookingCalendar(createAdminClient(), booking.id);
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("does not call Google when local integration is disabled", async () => {
    client();
    mocks.enabled.mockReturnValue(false);
    await syncConfirmedBookingCalendar(createAdminClient(), booking.id);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("records connection errors and rejects so confirmation can be retried", async () => {
    const query = client();
    mocks.create.mockRejectedValueOnce(new Error("invalid_grant"));
    await expect(syncConfirmedBookingCalendar(createAdminClient(), booking.id)).rejects.toThrow("invalid_grant");
    expect(query.update).toHaveBeenCalledWith({ calendar_error: "invalid_grant" });
  });
});
