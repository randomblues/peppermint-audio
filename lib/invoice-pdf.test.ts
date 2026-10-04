import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";

import { buildInvoicePdf } from "./invoice-pdf";

function extractCompressedPdfText(pdf: Buffer) {
  const streams: string[] = [];
  const streamMarker = Buffer.from("stream");
  const endStreamMarker = Buffer.from("endstream");
  let offset = 0;

  while (true) {
    const streamStart = pdf.indexOf(streamMarker, offset);
    if (streamStart === -1) break;
    const contentStart =
      pdf[streamStart + streamMarker.length] === 13
        ? streamStart + streamMarker.length + 2
        : streamStart + streamMarker.length + 1;
    const streamEnd = pdf.indexOf(endStreamMarker, contentStart);
    if (streamEnd === -1) break;
    try {
      const decoded = inflateSync(pdf.subarray(contentStart, streamEnd)).toString("latin1");
      if (decoded.includes("BT")) {
        streams.push(decoded.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) => Buffer.from(hex, "hex").toString("latin1")));
      }
    } catch {
      // Ignore uncompressed and image streams.
    }
    offset = streamEnd + endStreamMarker.length;
  }

  return streams.join("\n");
}

describe("invoice PDF generation", () => {
  it("generates a readable PDF document with invoice details", async () => {
    const pdf = await buildInvoicePdf({
      title: "Tax Invoice",
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
      gstIncludedCents: 909,
      notes: ["Please use reference PA-ABC12345."],
      bankTransfer: {
        amountCents: 20000,
        reference: "PA-ABC12345",
        accountName: "Shane Dsouza",
        bsb: "670864",
        accountNumber: "33933371",
        payId: "0452316823",
      },
    });

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    const pdfBytes = Buffer.from(pdf);
    const pdfText = extractCompressedPdfText(pdfBytes);
    expect(pdfBytes.toString("latin1")).toContain("/Subtype /Image");
    expect(pdfText).toContain("Tax Invoice");
    expect(pdfText).toContain("Booking Reference:");
    expect(pdfText).toContain("PA-ABC12345");
    expect(pdfText).toContain("FROM");
    expect(pdfText).toContain("Peppermint Audio");
    expect(pdfText).toContain("ABN 44 506 480 694");
    expect(pdfText).toContain("GST INCLUDED (10%)");
    expect(pdfText).toContain("AUD $9.09");
    expect(pdfText).toContain("PAYMENT");
    expect(pdfText).toContain("BANK TRANSFER DETAILS");
    expect(pdfText).toContain("Shane Dsouza");
    expect(pdfText).toContain("670864");
    expect(pdfText).toContain("33933371");
    expect(pdfText).toContain("0452316823");
    expect(pdfText).toContain("Pickup and return");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
