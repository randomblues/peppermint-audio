import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { business } from "@/lib/site-content";

export type InvoicePdfLineItem = {
  description: string;
  amountCents: number;
  status?: string;
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
  notes: string[];
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
  let y = pageHeight - margin;

  page.drawRectangle({ x: 0, y: pageHeight - 112, width: pageWidth, height: 112, color: dark });
  page.drawImage(logo, { x: margin, y: pageHeight - 75, width: 182, height: 38.4 });
  page.drawText(pdfText(details.title), { x: margin, y: pageHeight - 86, size: 12, font: regular, color: rgb(0.78, 0.9, 0.83) });
  page.drawText(pdfText(details.documentNumber), { x: pageWidth - margin - 150, y: pageHeight - 58, size: 10, font: regular, color: rgb(1, 1, 1) });
  page.drawText(pdfText(details.issuedAt), { x: pageWidth - margin - 150, y: pageHeight - 76, size: 9, font: regular, color: rgb(0.82, 0.84, 0.83) });
  y = pageHeight - 148;

  page.drawText("BILL TO", { x: margin, y, size: 8, font: bold, color: green });
  page.drawText(pdfText(details.customerName), { x: margin, y: y - 19, size: 12, font: bold, color: dark });
  page.drawText(pdfText(details.customerEmail), { x: margin, y: y - 36, size: 9, font: regular, color: muted });
  page.drawText("EVENT", { x: 335, y, size: 8, font: bold, color: green });
  page.drawText(pdfText(details.eventType), { x: 335, y: y - 19, size: 11, font: bold, color: dark });
  page.drawText(pdfText(`Pickup: ${details.pickupDate}`), { x: 335, y: y - 36, size: 9, font: regular, color: muted });
  page.drawText(pdfText(`Return: ${details.dropoffDate}`), { x: 335, y: y - 51, size: 9, font: regular, color: muted });
  y -= 91;

  page.drawRectangle({ x: margin, y: y - 25, width: pageWidth - margin * 2, height: 25, color: rgb(0.91, 0.95, 0.92) });
  page.drawText("DESCRIPTION", { x: margin + 12, y: y - 16, size: 8, font: bold, color: dark });
  page.drawText("AMOUNT", { x: pageWidth - margin - 80, y: y - 16, size: 8, font: bold, color: dark });
  y -= 55;
  for (const item of details.lineItems) {
    y = drawWrapped(page, item.description, margin + 12, y, 330, 10, regular, dark);
    if (item.status) page.drawText(pdfText(item.status), { x: margin + 12, y: y + 3, size: 8, font: regular, color: muted });
    page.drawText(aud(item.amountCents), { x: pageWidth - margin - 80, y: y + 3, size: 10, font: regular, color: dark });
    y -= item.status ? 27 : 14;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.86, 0.87, 0.85) });
    y -= 20;
  }

  page.drawText("TOTAL", { x: pageWidth - margin - 155, y, size: 10, font: bold, color: dark });
  page.drawText(aud(details.totalCents), { x: pageWidth - margin - 80, y, size: 11, font: bold, color: green });
  y -= 42;
  page.drawText("PAYMENT", { x: margin, y, size: 8, font: bold, color: green });
  y = drawWrapped(page, details.paymentMethod, margin, y - 18, pageWidth - margin * 2, 9, regular, muted);
  y -= 16;
  for (const note of details.notes) {
    y = drawWrapped(page, note, margin, y, pageWidth - margin * 2, 9, regular, muted);
    y -= 7;
  }

  page.drawLine({ start: { x: margin, y: 65 }, end: { x: pageWidth - margin, y: 65 }, thickness: 0.7, color: rgb(0.8, 0.83, 0.81) });
  page.drawText(pdfText(`${business.name} · ${business.email} · ${business.phone}`), { x: margin, y: 47, size: 8, font: regular, color: muted });
  page.drawText(pdfText(`Pickup and return: ${business.pickupSuburb} ${business.pickupPostcode} · ${business.serviceArea}`), { x: margin, y: 33, size: 8, font: regular, color: muted });
  return Buffer.from(await document.save());
}
