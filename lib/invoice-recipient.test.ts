import { describe, expect, it } from "vitest";

import { invoiceEmailRecipients, parseInvoiceRecipient } from "./invoice-recipient";

describe("invoice recipient overrides", () => {
  it("trims valid alternate Bill to details", () => {
    expect(parseInvoiceRecipient({ billToName: "  Acme Events  ", billToEmail: " accounts@example.com " })).toEqual({
      recipient: { billToName: "Acme Events", billToEmail: "accounts@example.com" },
    });
  });

  it("allows omitted details so the booking contact remains the default", () => {
    expect(parseInvoiceRecipient({})).toEqual({ recipient: {} });
  });

  it("rejects invalid email addresses and overlong names", () => {
    expect(parseInvoiceRecipient({ billToEmail: "not-an-email" }).error).toBe("Enter a valid Bill to email address.");
    expect(parseInvoiceRecipient({ billToName: "x".repeat(201) }).error).toBe("Bill to name must be 200 characters or fewer.");
  });

  it("sends an alternate email primarily and copies the booking contact", () => {
    expect(invoiceEmailRecipients("booking@example.com", "accounts@example.com")).toEqual({
      to: ["accounts@example.com"],
      cc: ["booking@example.com"],
    });
    expect(invoiceEmailRecipients("booking@example.com", "BOOKING@example.com")).toEqual({
      to: ["BOOKING@example.com"],
    });
  });
});
