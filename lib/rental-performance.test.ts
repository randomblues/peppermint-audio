import { describe, expect, it } from "vitest";
import { type AnalyticsBooking } from "./booking-analytics";
import { performanceChange, performanceCsv, performancePeriod, periodError, previousPeriod, rentalPerformance } from "./rental-performance";

const today = "2026-10-30";
const period = { from: "2026-10-01", to: today };
const base: AnalyticsBooking = {
  id: "prior", first_name: "Private", last_name: "Customer", email: "repeat@example.invalid",
  status: "completed", event_type: "Wedding", pickup_date: "2026-09-14", dropoff_date: "2026-09-15",
  created_at: "2026-09-01T00:00:00Z", hire_amount_cents: 10000, hire_payment_status: "paid",
};
const records: AnalyticsBooking[] = [
  base,
  { ...base, id: "first", email: "REPEAT@example.invalid ", pickup_date: "2026-10-02", dropoff_date: "2026-10-05", created_at: "2026-09-10T00:00:00Z", hire_amount_cents: 20000,
    hire_line_items: [{ id: "package:historic", kind: "package", catalogKey: "package:historic", name: "Saved package", quantity: 1, unitPriceCents: 10000 }] },
  { ...base, id: "second", email: "new@example.invalid", event_type: "Party", pickup_date: "2026-10-18", dropoff_date: "2026-10-20", created_at: "2026-10-01T14:30:00Z", hire_amount_cents: 30000, hire_payment_status: "unpaid",
    hire_line_items: [
      { id: "equipment:historic", kind: "equipment", catalogKey: "equipment:historic", name: "Saved speaker", quantity: 1, unitPriceCents: 10000 },
      { id: "custom:fee", kind: "custom", name: "Setup", quantity: 1, unitPriceCents: 15000 },
    ] },
  { ...base, id: "confirmed", status: "confirmed", created_at: "2026-10-08T00:00:00Z", hire_amount_cents: 90000 },
  { ...base, id: "submitted", status: "submitted", created_at: "2026-10-09T00:00:00Z" },
  { ...base, id: "cancelled", status: "cancelled", created_at: "2026-10-10T00:00:00Z", hire_amount_cents: 1000000 },
];

describe("rental business performance", () => {
  it("uses completed hires by return date, never pending or cancelled quote values", () => {
    const report = rentalPerformance(records, period, today);
    expect(report.current).toEqual({ hires: 2, sales: 50000, average: 25000, priced: 2, unpriced: 0, unpaid: 30000 });
    expect(report.prior).toEqual({ hires: 1, sales: 10000, average: 10000, priced: 1, unpriced: 0, unpaid: 0 });
    expect(report.previous).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(performanceChange(report.current.sales, report.prior.sales)).toEqual({ text: "+400%", direction: "up" });
  });
  it("separates request-received cohorts from completed-hire cohorts in Melbourne time", () => {
    const report = rentalPerformance(records, period, today);
    expect(report.requests).toBe(4);
    expect(report.priorRequests).toBe(2);
    expect(report.outcomes).toEqual([{ name: "Accepted", count: 2 }, { name: "Awaiting decision", count: 1 }, { name: "Cancelled", count: 1 }]);
    expect(report.acceptedShare).toBe(50);
    expect(report.trend).toEqual([{ key: "2026-10", label: "Oct 26", sales: 50000, hires: 2, requests: 4, unpriced: 0 }]);
    const boundary = rentalPerformance([{ ...base, dropoff_date: "2026-10-01", created_at: "2026-09-30T14:30:00Z" }], { from: "2026-10-01", to: "2026-10-01" }, today);
    expect(boundary.requests).toBe(1);
  });
  it("recognises repeat hires using earlier completed email history without exposing contacts", () => {
    const report = rentalPerformance(records, period, today);
    expect(report).toMatchObject({ repeat: 1, identifiable: 2, repeatShare: 50 });
    const withoutHistory = rentalPerformance(records.slice(1), period, today);
    expect(withoutHistory.repeat).toBe(0);
    const missingEmail = rentalPerformance([{ ...records[1], email: undefined }], period, today);
    expect(missingEmail.repeatShare).toBeNull();
  });
  it("retains zero-activity months and changes granularity for long periods", () => {
    const report = rentalPerformance(records, { from: "2026-08-01", to: today }, today);
    expect(report.trend).toHaveLength(3);
    expect(report.trend[0]).toMatchObject({ key: "2026-08", sales: 0, hires: 0, requests: 0 });
    expect(report.trendUnit).toBe("Monthly");
    const quarterly = rentalPerformance([], { from: "2020-01-01", to: today }, today);
    expect(quarterly.trendUnit).toBe("Quarterly");
    expect(quarterly.trend).toHaveLength(28);
    const yearly = rentalPerformance([], { from: "2010-01-01", to: today }, today);
    expect(yearly.trendUnit).toBe("Yearly");
    expect(yearly.trend).toHaveLength(17);
  });
  it("allocates recorded sales using saved item prices, nights and custom flat charges", () => {
    const report = rentalPerformance(records, period, today);
    expect(report.products.map(({ name, category, value, quantity, hires }) => ({ name, category, value, quantity, hires }))).toEqual([
      { name: "Saved package", category: "package", value: 20000, quantity: 1, hires: 1 },
      { name: "Saved speaker", category: "equipment", value: 15000, quantity: 1, hires: 1 },
      { name: "Setup", category: "other", value: 15000, quantity: 1, hires: 1 },
    ]);
    expect(report.products.reduce((sum, item) => sum + item.value, 0)).toBe(report.current.sales);
    const rounded = rentalPerformance([{ ...records[2], hire_amount_cents: 25001 }], period, today);
    expect(rounded.products.map((item) => item.value).sort()).toEqual([12500, 12501]);
    expect(rounded.products.reduce((sum, item) => sum + item.value, 0)).toBe(25001);
    const noItems = rentalPerformance([{ ...base, dropoff_date: "2026-10-01" }], period, today);
    expect(noItems.products[0]).toMatchObject({ name: "Unitemised hire", value: 10000 });
  });
  it("reports unknown prices as missing data, preserves real zero prices and excludes future hires", () => {
    const unknown = rentalPerformance([{ ...records[1], hire_amount_cents: null, hire_line_items: [] }], period, today);
    expect(unknown.current).toMatchObject({ sales: null, average: null, hires: 1, unpriced: 1 });
    expect(unknown.trend[0].unpriced).toBe(1);
    expect(unknown.products).toEqual([]);
    const zero = rentalPerformance([{ ...records[1], hire_amount_cents: 0 }], period, today);
    expect(zero.current).toMatchObject({ sales: 0, average: 0, unpriced: 0 });
    expect(zero.products[0].value).toBe(0);
    const future = rentalPerformance([{ ...base, dropoff_date: "2026-11-01" }], period, today);
    expect(future.current.hires).toBe(0);
    expect(rentalPerformance([], period, today)).toMatchObject({ requests: 0, acceptedShare: null, typicalNights: null, repeatShare: null });
  });
  it("shows operational patterns for the completed cohort only", () => {
    const report = rentalPerformance(records, period, today);
    expect(report).toMatchObject({ typicalNights: 2.5, typicalNotice: 19, noticeSample: 2, weekendShare: 100 });
    expect(report.weekdays.find((day) => day.name === "Fri")?.count).toBe(1);
    expect(report.weekdays.find((day) => day.name === "Sun")?.count).toBe(1);
  });
  it("validates real dates and historical bounds and compares equal-length periods across leap years", () => {
    expect(periodError({ from: "2026-02-31", to: today }, today)).toContain("valid");
    expect(periodError({ from: "2026-11-01", to: today }, today)).toContain("end date");
    expect(periodError({ from: today, to: "2026-11-01" }, today)).toContain("future");
    expect(previousPeriod({ from: "2024-03-01", to: "2024-03-31" })).toEqual({ from: "2024-01-30", to: "2024-02-29" });
    expect(performancePeriod("12-months", today)).toEqual({ from: "2025-11-01", to: today });
    expect(performancePeriod("30-days", today)).toEqual(period);
    expect(performancePeriod("financial-year", "2026-06-30").from).toBe("2025-07-01");
    expect(performancePeriod("financial-year", "2026-07-01").from).toBe("2026-07-01");
    expect(() => rentalPerformance([], { from: "", to: "" }, today)).toThrow("valid");
  });
  it("avoids invented growth percentages and tracks unusable dates", () => {
    expect(performanceChange(100, 0)).toEqual({ text: "New this period", direction: "up" });
    expect(performanceChange(0, 0).text).toBe("No change");
    expect(performanceChange(0, 100)).toEqual({ text: "-100%", direction: "down" });
    expect(performanceChange(null, 100).text).toBe("Not enough data");
    const report = rentalPerformance([{ ...base, pickup_date: "", dropoff_date: "", created_at: undefined }], period, today);
    expect(report).toMatchObject({ missingCompletionDates: 1, missingRequestDates: 1 });
  });
  it("exports aggregate definitions and values without booking identities or formula injection", () => {
    const report = rentalPerformance(records, period, today);
    const csv = performanceCsv(report);
    expect(csv).toContain('"Summary","Completed hire sales","500.00","100.00","AUD"');
    expect(csv).not.toContain("repeat@example.invalid");
    expect(csv).not.toContain("Private Customer");
    expect(csv).not.toContain('"first"');
    const injected = rentalPerformance([{ ...records[1], event_type: "=FORMULA", hire_line_items: [{ id: "custom:fee", kind: "custom", name: "=FORMULA", quantity: 1, unitPriceCents: 100 }] }], period, today);
    expect(performanceCsv(injected)).toContain('"\'=FORMULA"');
  });
});
