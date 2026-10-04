import { describe, expect, it } from "vitest";

import { GST_HIRE_ONLY_NOTE, gstIncludedCents } from "./gst";

describe("GST calculations", () => {
  it("extracts the GST component from GST-inclusive hire pricing", () => {
    expect(gstIncludedCents(10000)).toBe(909);
  });

  it("states that GST applies to hire cost only", () => {
    expect(GST_HIRE_ONLY_NOTE).toContain("hire cost only");
    expect(GST_HIRE_ONLY_NOTE).toContain("security deposit is not included");
  });
});
