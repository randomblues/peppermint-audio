import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { business } from "@/lib/site-content";

export type InvoicePdfLineItem = {
  description: string;
  amountCents: number;
  status?: string;
};

export type InvoicePdfBankTransfer = {
  amountCents: number;
  reference: string;
  accountName: string;
  bsb?: string;
  accountNumber?: string;
  payId?: string;
};

export type InvoicePdfDetails = {
  title: string;
  documentNumber: string;
  issuedAt: string;
  customerName: string;
  customerEmail: string;
  eventType: string;
  pickupDate: string;
  dropoffDate: string;
  paymentMethod: string;
  lineItems: InvoicePdfLineItem[];
  totalCents: number;
  gstIncludedCents?: number;
  notes: string[];
  bankTransfer?: InvoicePdfBankTransfer;
};

const pageWidth = 595;
const pageHeight = 842;
const margin = 48;

function pdfText(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

function aud(cents: number) {
  return `AUD $${(cents / 100).toFixed(2)}`;
}

function drawWrapped(page: ReturnType<PDFDocument["addPage"]>, text: string, x: number, y: number, width: number, size: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, color = rgb(0.18, 0.2, 0.19)) {
  const words = pdfText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.forEach((current, index) => page.drawText(current, { x, y: y - index * (size + 4), size, font, color }));
  return y - lines.length * (size + 4);
}

export async function buildInvoicePdf(details: InvoicePdfDetails) {
  const document = await PDFDocument.create();
  const page = document.addPage([pageWidth, pageHeight]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = new Uint8Array(await readFile(join(process.cwd(), "public", "logo-white.png")));
  const logo = await document.embedPng(logoBytes);
  const dark = rgb(0.11, 0.16, 0.14);
  const muted = rgb(0.35, 0.37, 0.35);
  const green = rgb(0.24, 0.47, 0.37);
  const paleGreen = rgb(0.91, 0.96, 0.93);
  const line = rgb(0.86, 0.9, 0.87);
  const logoWidth = 182;
  const logoHeight = logoWidth * (101 / 532);
  let y = pageHeight - margin;

  page.drawRectangle({ x: 0, y: pageHeight - 112, width: pageWidth, height: 112, color: dark });
  page.drawImage(logo, { x: margin, y: pageHeight - 75, width: logoWidth, height: logoHeight });
  page.drawText(pdfText(details.title), { x: margin + 12, y: pageHeight - 86, size: 12, font: regular, color: rgb(0.78, 0.9, 0.83) });
  page.drawText(pdfText(`ABN ${business.abn}`), { x: margin + 12, y: pageHeight - 101, size: 8, font: regular, color: rgb(0.72, 0.84, 0.77) });
  page.drawText(pdfText(details.documentNumber), { x: pageWidth - margin - 150, y: pageHeight - 58, size: 10, font: regular, color: rgb(1, 1, 1) });
  page.drawText(pdfText(details.issuedAt), { x: pageWidth - margin - 150, y: pageHeight - 76, size: 9, font: regular, color: rgb(0.82, 0.84, 0.83) });
  y = pageHeight - 148;

  page.drawText("FROM", { x: margin, y, size: 8, font: bold, color: green });
  page.drawText(pdfText(business.name), { x: margin, y: y - 19, size: 11, font: bold, color: dark });
  page.drawText(pdfText(business.email), { x: margin, y: y - 36, size: 8, font: regular, color: muted });
  page.drawText(pdfText(`ABN ${business.abn}`), { x: margin, y: y - 50, size: 8, font: regular, color: muted });
  page.drawText("BILL TO", { x: 190, y, size: 8, font: bold, color: green });
  page.drawText(pdfText(details.customerName), { x: 190, y: y - 19, size: 12, font: bold, color: dark });
  page.drawText(pdfText(details.customerEmail), { x: 190, y: y - 36, size: 8, font: regular, color: muted });
  page.drawText("EVENT", { x: 390, y, size: 8, font: bold, color: green });
  page.drawText(pdfText(details.eventType), { x: 390, y: y - 19, size: 10, font: bold, color: dark });
  page.drawText(pdfText(`Pickup: ${details.pickupDate}`), { x: 390, y: y - 36, size: 8, font: regular, color: muted });
  page.drawText(pdfText(`Return: ${details.dropoffDate}`), { x: 390, y: y - 51, size: 8, font: regular, color: muted });
  y -= 91;

  page.drawRectangle({ x: margin, y: y - 28, width: pageWidth - margin * 2, height: 28, color: paleGreen });
  page.drawText("DESCRIPTION", { x: margin + 12, y: y - 16, size: 8, font: bold, color: dark });
  page.drawText("AMOUNT", { x: pageWidth - margin - 80, y: y - 16, size: 8, font: bold, color: dark });
  y -= 58;
  for (const item of details.lineItems) {
    page.drawRectangle({ x: margin, y: y - 28, width: pageWidth - margin * 2, height: 42, color: rgb(0.98, 0.99, 0.98) });
    y = drawWrapped(page, item.description, margin + 12, y, 330, 10, regular, dark);
    if (item.status) page.drawText(pdfText(item.status), { x: margin + 12, y: y + 3, size: 8, font: regular, color: muted });
    page.drawText(aud(item.amountCents), { x: pageWidth - margin - 80, y: y + 3, size: 10, font: regular, color: dark });
    y -= item.status ? 27 : 14;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: line });
    y -= 20;
  }

  const summaryAmountX = pageWidth - margin - 80;
  const totalLabel = details.gstIncludedCents && details.gstIncludedCents > 0 ? "TOTAL (INC. GST)" : "TOTAL";
  const totalLabelWidth = bold.widthOfTextAtSize(totalLabel, 10);
  page.drawRectangle({ x: pageWidth - margin - 220, y: y - 38, width: 220, height: 58, color: paleGreen });
  if (details.gstIncludedCents && details.gstIncludedCents > 0) {
    const gstLabel = "GST INCLUDED (10%)";
    const gstLabelWidth = regular.widthOfTextAtSize(gstLabel, 8);
    page.drawText(gstLabel, { x: summaryAmountX - 12 - gstLabelWidth, y: y - 18, size: 8, font: regular, color: muted });
    page.drawText(aud(details.gstIncludedCents), { x: summaryAmountX, y: y - 18, size: 9, font: regular, color: muted });
  }
  page.drawText(totalLabel, { x: summaryAmountX - 12 - totalLabelWidth, y, size: 10, font: bold, color: dark });
  page.drawText(aud(details.totalCents), { x: summaryAmountX, y, size: 11, font: bold, color: green });
  y -= details.gstIncludedCents && details.gstIncludedCents > 0 ? 58 : 42;
  if (details.bankTransfer) {
    const paymentHeight = 178;
    const paymentTop = y;
    page.drawRectangle({ x: margin, y: paymentTop - paymentHeight, width: pageWidth - margin * 2, height: paymentHeight, color: rgb(0.97, 0.99, 0.98) });
    page.drawRectangle({ x: margin, y: paymentTop - 32, width: pageWidth - margin * 2, height: 32, color: dark });
    page.drawText("BANK TRANSFER DETAILS", { x: margin + 14, y: paymentTop - 21, size: 8, font: bold, color: rgb(0.85, 0.96, 0.89) });

    page.drawText("AMOUNT DUE", { x: margin + 16, y: paymentTop - 54, size: 8, font: bold, color: green });
    page.drawText(aud(details.bankTransfer.amountCents), { x: margin + 16, y: paymentTop - 75, size: 18, font: bold, color: dark });
    page.drawText("PAYMENT REFERENCE", { x: 330, y: paymentTop - 54, size: 8, font: bold, color: green });
    page.drawText(pdfText(details.bankTransfer.reference), { x: 330, y: paymentTop - 75, size: 11, font: bold, color: dark });
    page.drawLine({ start: { x: margin + 16, y: paymentTop - 88 }, end: { x: pageWidth - margin - 16, y: paymentTop - 88 }, thickness: 0.6, color: line });

    const transferRows = [
      ["Account name", details.bankTransfer.accountName],
      ...(details.bankTransfer.bsb && details.bankTransfer.accountNumber ? [["BSB", details.bankTransfer.bsb], ["Account number", details.bankTransfer.accountNumber]] : []),
      ...(details.bankTransfer.payId ? [["PayID", details.bankTransfer.payId]] : []),
    ];
    transferRows.forEach(([label, value], index) => {
      const rowY = paymentTop - 108 - index * 17;
      page.drawText(label, { x: margin + 16, y: rowY, size: 8, font: bold, color: muted });
      page.drawText(pdfText(value), { x: margin + 126, y: rowY, size: 9, font: regular, color: dark });
    });
    y = paymentTop - paymentHeight - 18;
  } else {
    page.drawRectangle({ x: margin, y: y - 30, width: pageWidth - margin * 2, height: 30, color: paleGreen });
    page.drawText("PAYMENT", { x: margin + 12, y: y - 19, size: 8, font: bold, color: green });
    y = drawWrapped(page, details.paymentMethod, margin + 12, y - 43, pageWidth - margin * 2 - 24, 9, regular, muted);
    y -= 16;
  }
  for (const note of details.notes) {
    y = drawWrapped(page, note, margin + 12, y, pageWidth - margin * 2 - 24, 9, regular, muted);
    y -= 7;
  }

  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 78, color: dark });
  page.drawText(pdfText(`${business.name}  ·  ABN ${business.abn}`), { x: margin, y: 47, size: 9, font: bold, color: rgb(0.9, 0.96, 0.92) });
  page.drawText(pdfText(`${business.email}  ·  ${business.phone}`), { x: margin, y: 32, size: 8, font: regular, color: rgb(0.73, 0.83, 0.77) });
  page.drawText(pdfText(`Pickup and return: ${business.pickupSuburb} ${business.pickupPostcode}  ·  ${business.serviceArea}`), { x: margin, y: 19, size: 8, font: regular, color: rgb(0.73, 0.83, 0.77) });
  return Buffer.from(await document.save());
}
