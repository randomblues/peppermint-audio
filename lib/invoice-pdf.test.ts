import { describe, expect, it } from "vitest";

import { buildInvoicePdf } from "./invoice-pdf";

describe("invoice PDF generation", () => {
  it("generates a readable PDF document with invoice details", async () => {
    const pdf = await buildInvoicePdf({
      title: "Invoice",
      documentNumber: "PA-2026-ABC12345",
      issuedAt: "4 October 2026",
      customerName: "Alex Smith",
      customerEmail: "alex@example.com",
      eventType: "Wedding",
      pickupDate: "9 October 2026",
      dropoffDate: "11 October 2026",
      paymentMethod: "Bank transfer",
      lineItems: [
        { description: "Audio equipment hire", amountCents: 10000 },
        { description: "Refundable security deposit", amountCents: 10000 },
      ],
      totalCents: 20000,
      notes: ["Please use reference PA-ABC12345."],
    });

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(Buffer.from(pdf).toString("latin1")).toContain("/Subtype /Image");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
