import { describe, expect, it } from "vitest";

import { bookingHireTotalCents, catalogLineItemFromKey, customBookingLineItem, lineItemHireTotalCents, lineItemsTotalCents } from "./booking-line-items";

describe("nightly hire pricing", () => {
  const item = { ...catalogLineItemFromKey("package:speech-presentation-wireless")!, unitPriceCents: 10000 };

  it.each([[1, 10000], [2, 15000], [3, 20000], [4, 25000], [7, 40000]])(
    "charges %i nights without compounding the discount",
    (nights, expected) => expect(lineItemHireTotalCents(item, nights)).toBe(expected),
  );

  it("applies the same multiplier to packages, equipment and add-ons, including quantities", () => {
    for (const key of ["package:speech-presentation-wireless", "equipment:bose-s1-pro:Single speaker", "addon:wireless-microphones"]) {
      const selected = catalogLineItemFromKey(key)!;
      expect(selected).not.toBeNull();
      expect(lineItemHireTotalCents({ ...selected, quantity: 2 }, 3)).toBe(selected.unitPriceCents * 4);
    }
  });

  it("keeps custom service charges flat and rounds fractional cents per unit", () => {
    const oddRate = { ...item, unitPriceCents: 101, quantity: 3 };
    expect(lineItemHireTotalCents(oddRate, 2)).toBe(456);
    expect(lineItemsTotalCents([item, customBookingLineItem("Delivery", 5000)], 3)).toBe(25000);
  });

  it("counts overnights with a same-day minimum and ignores DST changes", () => {
    expect(bookingHireTotalCents([item], "2026-10-09", "2026-10-09")).toBe(10000);
    expect(bookingHireTotalCents([item], "2026-10-09", "2026-10-11")).toBe(15000);
    expect(bookingHireTotalCents([item], "2026-10-03", "2026-10-05")).toBe(15000);
    expect(bookingHireTotalCents([item], "2026-12-31", "2027-01-03")).toBe(20000);
  });

  it("rejects invalid dates and durations instead of producing a plausible price", () => {
    expect(() => bookingHireTotalCents([item], "2026-02-30", "2026-03-02")).toThrow("dates are invalid");
    expect(() => bookingHireTotalCents([item], "", "")).toThrow("dates are invalid");
    expect(() => bookingHireTotalCents([item], "2026-10-11", "2026-10-09")).toThrow("dates are invalid");
    for (const nights of [0, -1, 1.5, Number.NaN]) {
      expect(() => lineItemHireTotalCents(item, nights)).toThrow("whole night");
    }
  });
});
