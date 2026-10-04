import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { gstIncludedCents } from "@/lib/gst";

type ReportBasis = "paid" | "issued";

type InvoiceRow = {
  booking_id: string;
  invoice_number: string;
  issued_at: string;
  paid_at: string | null;
  status: string;
  payment_method: string;
  hire_amount_cents: number;
  security_deposit_cents: number;
  total_amount_cents: number;
  gst_inclusive?: boolean | null;
};

function isDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function melbourneDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function aud(cents: number) {
  return (cents / 100).toFixed(2);
}

function csv(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const from = query.get("from");
  const to = query.get("to");
  const basis = query.get("basis") as ReportBasis | null;
  const format = query.get("format") ?? "json";
  if (!isDate(from) || !isDate(to) || from > to) {
    return NextResponse.json({ error: "A valid date range is required." }, { status: 400 });
  }
  if (basis !== "paid" && basis !== "issued") {
    return NextResponse.json({ error: "Report basis must be paid or issued." }, { status: 400 });
  }
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: "Report format must be json or csv." }, { status: 400 });
  }

  const result = await session.admin
    .from("invoices")
    .select("booking_id,invoice_number,issued_at,paid_at,status,payment_method,hire_amount_cents,security_deposit_cents,total_amount_cents,gst_inclusive")
    .order("issued_at", { ascending: true });
  if (result.error) return NextResponse.json({ error: `GST report lookup failed: ${result.error.message}` }, { status: 500 });

  const rows = (result.data as InvoiceRow[] ?? []).filter((invoice) => {
    if (basis === "paid" && (invoice.status !== "paid" || !invoice.paid_at)) return false;
    if (basis === "issued" && invoice.status === "cancelled") return false;
    const date = basis === "paid" ? invoice.paid_at : invoice.issued_at;
    if (!date) return false;
    const reportDate = melbourneDate(date);
    return reportDate >= from && reportDate <= to;
  }).map((invoice) => ({
    invoiceNumber: invoice.invoice_number,
    date: melbourneDate(basis === "paid" ? invoice.paid_at! : invoice.issued_at),
    paidAt: invoice.paid_at,
    status: invoice.status,
    paymentMethod: invoice.payment_method,
    taxableSalesCents: invoice.gst_inclusive !== false ? invoice.hire_amount_cents : 0,
    gstIncludedCents: invoice.gst_inclusive !== false ? gstIncludedCents(invoice.hire_amount_cents) : 0,
    securityDepositCents: invoice.security_deposit_cents,
    totalAmountCents: invoice.total_amount_cents,
  }));

  const summary = rows.reduce((totals, row) => ({
    invoiceCount: totals.invoiceCount + 1,
    taxableSalesCents: totals.taxableSalesCents + row.taxableSalesCents,
    gstIncludedCents: totals.gstIncludedCents + row.gstIncludedCents,
    securityDepositCents: totals.securityDepositCents + row.securityDepositCents,
    totalAmountCents: totals.totalAmountCents + row.totalAmountCents,
  }), {
    invoiceCount: 0,
    taxableSalesCents: 0,
    gstIncludedCents: 0,
    securityDepositCents: 0,
    totalAmountCents: 0,
  });

  if (format === "csv") {
    const columns = ["invoice_number", "date", "paid_at", "status", "payment_method", "taxable_sales_aud", "gst_included_aud", "refundable_deposit_aud", "total_amount_aud"];
    const data = rows.map((row) => [
      csv(row.invoiceNumber),
      csv(row.date),
      csv(row.paidAt),
      csv(row.status),
      csv(row.paymentMethod),
      csv(aud(row.taxableSalesCents)),
      csv(aud(row.gstIncludedCents)),
      csv(aud(row.securityDepositCents)),
      csv(aud(row.totalAmountCents)),
    ].join(","));
    data.push([
      csv("TOTAL"),
      "",
      "",
      "",
      "",
      csv(aud(summary.taxableSalesCents)),
      csv(aud(summary.gstIncludedCents)),
      csv(aud(summary.securityDepositCents)),
      csv(aud(summary.totalAmountCents)),
    ].join(","));
    return new NextResponse([columns.join(","), ...data].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gst-report-${from}-to-${to}-${basis}.csv"`,
      },
    });
  }

  return NextResponse.json({ basis, from, to, summary, rows });
}
