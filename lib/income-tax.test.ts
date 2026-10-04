import { describe, expect, it } from "vitest";

import { calculateMedicareLevy, calculateResidentIncomeTax } from "./income-tax";

describe("Australian income-tax estimate", () => {
  it("calculates 2026-27 resident tax using the ATO brackets", () => {
    expect(calculateResidentIncomeTax(10000000, "2026-27")).toBe(2052000);
  });

  it("calculates the Medicare levy separately", () => {
    expect(calculateMedicareLevy(10000000)).toBe(200000);
  });
});
