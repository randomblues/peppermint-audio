// @vitest-environment node
import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";

import { buildInvoicePdf, type InvoicePdfDetails } from "./invoice-pdf";

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
  it.each([20, 100])("keeps %s wrapped line items, totals and payment panels inside actual PDF page bounds", async count => {
    const details: InvoicePdfDetails = {
      title: "Invoice", documentNumber: "PA-BOUNDS", issuedAt: "10 October 2026",
      customerName: "Disposable Test", customerEmail: "test@example.com", eventType: "Party",
      pickupDate: "11 October 2026", dropoffDate: "12 October 2026",
      paymentMethod: "Cash due on pickup",
      lineItems: Array.from({ length: count }, (_, index) => ({
        description: `Item ${index + 1}: ${"Long wrapped equipment description ".repeat(8)}`,
        amountCents: 1000, status: "Due",
      })),
      totalCents: count * 1000, gstIncludedCents: 909,
      notes: ["Pay securely online: https://example.com/pay/" + "token".repeat(220),
        "Important instructions ".repeat(600)],
      bankTransfer: { amountCents: 10000, reference: "PA-BOUNDS", accountName: "Test", bsb: "000000", accountNumber: "123456", payId: "test@example.com" },
    };
    for (const bankTransfer of [details.bankTransfer, undefined]) {
      const pdf = await buildInvoicePdf({ ...details, bankTransfer });
      const document = await PDFDocument.load(pdf);
      expect(document.getPageCount()).toBeGreaterThan(1);
      for (const page of document.getPages()) {
        expect(page.getSize()).toEqual({ width: 595, height: 842 });
        const contents = page.node.Contents() as PDFArray;
        const operators = Array.from({ length: contents.size() }, (_, index) => {
          const stream = document.context.lookup(contents.get(index));
          if (!(stream instanceof PDFRawStream)) throw new Error("Expected a raw PDF content stream.");
          return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
        }).join("\n");
        const textPositions = [...operators.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)];
        expect(textPositions.length).toBeGreaterThan(0);
        for (const [, x, y] of textPositions) {
          expect(Number(x)).toBeGreaterThanOrEqual(0);
          expect(Number(x)).toBeLessThan(595);
          // Only the branded footer may occupy the bottom 88 points.
          expect(Number(y) <= 88 || Number(y) >= 104).toBe(true);
          expect(Number(y)).toBeGreaterThanOrEqual(0);
          expect(Number(y)).toBeLessThanOrEqual(842);
        }
        for (const [, , y, , height] of operators.matchAll(/([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) re/g)) {
          expect(Number(y)).toBeGreaterThanOrEqual(0);
          expect(Number(y) + Number(height)).toBeLessThanOrEqual(842);
          expect(Number(y) === 0 || Number(y) >= 104).toBe(true);
        }
      }
      const text = extractCompressedPdfText(pdf);
      expect(text).toContain(bankTransfer ? "BANK TRANSFER DETAILS" : "PAYMENT");
      for (let index = 1; index <= count; index++) expect(text).toContain(`Item ${index}:`);
      expect(text).toContain("TOTAL (INC. GST)");
      expect(text).toContain("ONLINE PAYMENT");
      expect(text).toContain("NOTES");
    }
  });

  it("splits a single description spanning several pages without losing its ending", async () => {
    const pdf = await buildInvoicePdf({
      title: "Invoice", documentNumber: "PA-LONG", issuedAt: "10 October 2026",
      customerName: "Test", customerEmail: "test@example.com", eventType: "Party",
      pickupDate: "11 October 2026", dropoffDate: "12 October 2026", paymentMethod: "Cash",
      lineItems: [{ description: "Equipment ".repeat(3000) + "END OF DESCRIPTION", amountCents: 1000 }],
      totalCents: 1000, notes: [],
    });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(2);
    const text = extractCompressedPdfText(pdf);
    expect(text.match(/Equipment/g)).toHaveLength(3000);
    expect(text).toContain("END");
    expect(text).toContain("DESCRIPTION");
    expect(await buildInvoicePdf({
      title: "Invoice", documentNumber: "PA-LONG", issuedAt: "10 October 2026",
      customerName: "Test", customerEmail: "test@example.com", eventType: "Party",
      pickupDate: "11 October 2026", dropoffDate: "12 October 2026", paymentMethod: "Cash",
      lineItems: [{ description: "Equipment ".repeat(3000) + "END OF DESCRIPTION", amountCents: 1000 }],
      totalCents: 1000, notes: [],
    })).toEqual(pdf);
  });

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
