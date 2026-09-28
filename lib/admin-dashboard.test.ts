import { describe, expect, it } from "vitest";
import { filterBookings, isUpcoming, statusCounts } from "./admin-dashboard";

const bookings = [
  { pickup_date: "2026-10-01", status: "submitted" },
  { pickup_date: "2026-10-02", status: "confirmed" },
  { pickup_date: "2026-10-03", status: "confirmed" },
  { pickup_date: "2026-11-01", status: "completed" },
];

describe("admin dashboard booking logic", () => {
  it("counts each status independently", () => {
    expect(statusCounts(bookings)).toEqual({
      submitted: 1, confirmed: 2, completed: 1, cancelled: 0,
    });
  });

  it("applies status and inclusive pickup-date filters", () => {
    expect(filterBookings(bookings, {
      status: "confirmed", from: "2026-10-02", to: "2026-10-02",
    })).toHaveLength(1);
    expect(filterBookings(bookings, { status: "confirmed" })).toHaveLength(2);
  });

  it("excludes completed and cancelled bookings from upcoming", () => {
    expect(isUpcoming({ pickup_date: "2026-10-01", status: "submitted" }, "2026-10-01")).toBe(true);
    expect(isUpcoming({ pickup_date: "2026-10-01", status: "completed" }, "2026-10-01")).toBe(false);
    expect(isUpcoming({ pickup_date: "2026-09-30", status: "confirmed" }, "2026-10-01")).toBe(false);
    expect(isUpcoming({ pickup_date: null, status: "confirmed" }, "2026-10-01")).toBe(false);
    expect(isUpcoming({ pickup_date: "2026-10-01", status: "cancelled" }, "2026-10-01")).toBe(false);
  });

  it("handles missing fields and unknown statuses in filters and counts", () => {
    const incomplete = [{}, { pickup_date: "2026-10-01", status: "awaiting-payment" }];
    expect(filterBookings(incomplete, {})).toEqual(incomplete);
    expect(filterBookings(incomplete, { from: "2026-10-01" })).toHaveLength(1);
    expect(statusCounts(incomplete)).toEqual({
      submitted: 0, confirmed: 0, completed: 0, cancelled: 0,
    });
  });
});
