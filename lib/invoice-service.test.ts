import { describe, expect, it } from "vitest";

import { billingDocumentIntro } from "./invoice-service";

describe("billing document email copy", () => {
  it("uses the correct invoice label for the GST setting", () => {
    expect(billingDocumentIntro("invoice", "Acme Events")).toBe("Please find the attached tax invoice for Acme Events.");
    expect(billingDocumentIntro("invoice", "Acme Events", false)).toBe("Please find the attached invoice for Acme Events.");
  });

  it("uses the same contact-aware wording for other billing documents", () => {
    expect(billingDocumentIntro("payment_receipt", "Alex Smith")).toBe("Please find the attached payment receipt for Alex Smith.");
  });
});
