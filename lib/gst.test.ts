import { describe, expect, it } from "vitest";

import { gstIncludedCents } from "./gst";

describe("GST calculations", () => {
  it("extracts the GST component from GST-inclusive hire pricing", () => {
    expect(gstIncludedCents(10000)).toBe(909);
  });
});
