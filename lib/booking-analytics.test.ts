import { describe, expect, it } from "vitest";
import {
  analyseBookings, bookingDate, bookingHireValue, bookingsCsv,
  datePresetRange, defaultAnalyticsFilters, melbourneDate, type AnalyticsBooking,
} from "./booking-analytics";

const booking: AnalyticsBooking = {
  id: "one", first_name: "Alex", last_name: "Smith", email: "alex@example.invalid",
  status: "confirmed", event_type: "Wedding", pickup_date: "2026-10-10",
  dropoff_date: "2026-10-12", created_at: "2026-09-30T14:30:00Z",
  hire_amount_cents: 10000, hire_payment_status: "paid",
};
const records = [
  booking,
  { ...booking, id: "two", status: "submitted", hire_amount_cents: 20000, hire_payment_status: "unpaid", pickup_date: "2026-11-01", dropoff_date: "2026-11-02" },
  { ...booking, id: "three", status: "cancelled", hire_amount_cents: 50000, hire_payment_status: "paid" },
  { ...booking, id: "four", status: "completed", hire_amount_cents: 30000 },
  { ...booking, id: "five", hire_amount_cents: null, hire_line_items: [] },
];

describe("booking analytics", () => {
  it("includes every status by default and supports zero, one or multiple selected statuses", () => {
    expect(analyseBookings(records, defaultAnalyticsFilters)).toHaveLength(5);
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, statuses: [] })).toEqual([]);
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, statuses: ["cancelled", "completed"] }).map((entry) => entry.id)).toEqual(["four", "three"]);
  });
  it("combines multi-status, inclusive date, search and payment filters", () => {
    expect(analyseBookings(records, {
      ...defaultAnalyticsFilters, statuses: ["submitted", "confirmed"], search: "alex smith",
      from: "2026-10-10", to: "2026-10-10", payment: "paid",
    }).map((entry) => entry.id)).toEqual(["five", "one"]);
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, search: "PA-ONE" })).toEqual([booking]);
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, payment: "unpaid" }).map((entry) => entry.id)).toEqual(["two"]);
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, from: "2026-11-01", to: "2026-10-01" })).toEqual([]);
  });
  it("uses Melbourne calendar dates for request filtering including UTC boundary changes", () => {
    expect(bookingDate(booking, "created_at")).toBe("2026-10-01");
    expect(melbourneDate(new Date("2026-10-31T14:00:00Z"))).toBe("2026-11-01");
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, dateBasis: "created_at", from: "2026-10-01", to: "2026-10-01" })).toHaveLength(5);
    expect(analyseBookings([{ ...booking, created_at: undefined }], { ...defaultAnalyticsFilters, dateBasis: "created_at", to: "2026-10-01" })).toEqual([]);
  });
  it("handles financial-year, previous-year month boundaries and leap years", () => {
    expect(datePresetRange("financial-year", "2026-06-30")).toEqual({ from: "2025-07-01", to: "2026-06-30" });
    expect(datePresetRange("financial-year", "2026-07-01")).toEqual({ from: "2026-07-01", to: "2027-06-30" });
    expect(datePresetRange("last-month", "2026-01-30")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(datePresetRange("month", "2024-02-10")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(datePresetRange("year", "2026-10-01")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(datePresetRange("all")).toEqual({ from: "", to: "" });
  });
  it("uses stored prices including zero, otherwise calculates canonical hire items", () => {
    expect(bookingHireValue({ ...booking, hire_amount_cents: 0 })).toBe(0);
    expect(bookingHireValue({ ...booking, hire_amount_cents: null, hire_line_items: [
      { id: "custom:fee", kind: "custom", name: "Fee", quantity: 2, unitPriceCents: 1500 },
    ] })).toBe(3000);
    expect(bookingHireValue({ ...booking, hire_amount_cents: null })).toBeNull();
  });
  it("sorts by pickup in either direction without mutating the source", () => {
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, sort: "pickup-desc" })[0].id).toBe("two");
    expect(analyseBookings(records, { ...defaultAnalyticsFilters, sort: "pickup-asc" }).at(-1)?.id).toBe("two");
    expect(records[0].id).toBe("one");
  });
  it("defaults to newest submissions and compares full timestamps across timezones", () => {
    const older = { ...booking, id: "older", pickup_date: "2026-11-01", created_at: "2026-10-01T12:00:00+11:00" };
    const newer = { ...booking, id: "newer", pickup_date: "2026-09-01", created_at: "2026-10-01T04:00:00Z" };
    const missing = { ...booking, id: "missing", created_at: undefined };
    const invalid = { ...booking, id: "invalid", created_at: "not-a-date" };
    const input = [older, missing, newer, invalid];
    expect(defaultAnalyticsFilters.sort).toBe("submitted-desc");
    expect(analyseBookings(input, defaultAnalyticsFilters).map((entry) => entry.id)).toEqual(["newer", "older", "invalid", "missing"]);
    expect(analyseBookings(input, { ...defaultAnalyticsFilters, sort: "submitted-asc" }).map((entry) => entry.id)).toEqual(["older", "newer", "invalid", "missing"]);
    expect(input.map((entry) => entry.id)).toEqual(["older", "missing", "newer", "invalid"]);
    expect(analyseBookings([{ ...newer, id: "b" }, { ...newer, id: "a" }], defaultAnalyticsFilters).map((entry) => entry.id)).toEqual(["a", "b"]);
  });
  it("exports the exact selection with safe CSV escaping and no private ID or deposit fields", () => {
    const csv = bookingsCsv([{ ...booking, first_name: "=FORMULA", event_type: 'Party, "big"' }]);
    expect(csv).toContain('"\'=FORMULA Smith"');
    expect(csv).toContain('"Party, ""big"""');
    expect(csv).toContain('"100.00"');
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).not.toContain("photo_id");
    expect(bookingsCsv([]).split("\r\n")).toHaveLength(1);
  });
});
