import { Resend } from "resend";

import { emailFooterHtml, emailFooterText } from "@/lib/email-footer";
import { recordCustomerEmail, type CustomerEmailType } from "@/lib/email-log";
import { buildInvoicePdf, type InvoicePdfDetails, type InvoicePdfLineItem } from "@/lib/invoice-pdf";
import { invoiceNumberForBooking } from "@/lib/invoice-reference";
import { formatBankTransferInstructions, type BankTransferDetails, type BankTransferOption } from "@/lib/bank-transfer";
import { GST_HIRE_ONLY_NOTE, gstIncludedCents } from "@/lib/gst";
import { business } from "@/lib/site-content";
import { createAdminClient } from "@/lib/supabase";

type AdminClient = ReturnType<typeof createAdminClient>;
export type BillingDocumentType = "invoice" | "payment_receipt" | "deposit_authorisation" | "deposit_release" | "deposit_capture";

type InvoiceBooking = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  event_type: string;
  event_address?: string | null;
  pickup_date: string;
  dropoff_date: string;
  package_interest?: string | null;
  add_ons?: string[] | null;
  hire_amount_cents: number | null;
  security_deposit_cents: number | null;
  gst_inclusive?: boolean | null;
  payment_method: string | null;
  bank_transfer_option?: BankTransferOption | null;
  bank_transfer_reference?: string | null;
  deposit_payment_status?: string | null;
  deposit_captured_cents?: number | null;
};

type InvoiceRecord = {
  id: string;
  booking_id: string;
  invoice_number: string;
  payment_method: string;
  hire_amount_cents: number;
  security_deposit_cents: number;
  gst_inclusive: boolean;
  total_amount_cents: number;
  payment_url?: string | null;
  bank_transfer_option: BankTransferOption;
  status: string;
};

const bookingSelect = "id,email,first_name,last_name,event_type,event_address,pickup_date,dropoff_date,package_interest,add_ons,hire_amount_cents,security_deposit_cents,gst_inclusive,payment_method,bank_transfer_reference,bank_transfer_option,deposit_payment_status,deposit_captured_cents";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" }).format(new Date(`${value}T00:00:00`));
}

function amount(value: number | null | undefined) {
  if (!Number.isSafeInteger(value) || value === null || value === undefined || value < 0) {
    throw new Error("Invoice amounts are not configured for this booking.");
  }
  return value;
}

function bankTransferDetails() {
  const accountName = process.env.BANK_TRANSFER_ACCOUNT_NAME;
  const bsb = process.env.BANK_TRANSFER_BSB?.trim();
  const accountNumber = process.env.BANK_TRANSFER_ACCOUNT_NUMBER?.trim();
  const payId = process.env.BANK_TRANSFER_PAYID?.trim();
  if (!accountName || (!payId && (!bsb || !accountNumber))) throw new Error("Bank transfer details are not configured.");
  return { accountName, bsb, accountNumber, payId } satisfies BankTransferDetails;
}

async function readBooking(admin: AdminClient, bookingId: string) {
  const result = await admin.from("bookings").select(bookingSelect).eq("id", bookingId).single();
  if (result.error) throw new Error(`Booking lookup failed: ${result.error.message}`);
  if (!result.data) throw new Error("Booking could not be found.");
  return result.data as InvoiceBooking;
}

export async function ensureInvoice(admin: AdminClient, booking: InvoiceBooking, paymentUrl?: string | null, bankTransferOption?: BankTransferOption, allowTransferOptionChange = false) {
  const hireAmountCents = amount(booking.hire_amount_cents);
  const securityDepositCents = amount(booking.security_deposit_cents);
  const gstInclusive = booking.gst_inclusive ?? true;
  if (!booking.payment_method) throw new Error("Payment method is not configured for this booking.");
  const selectedBankTransferOption = bankTransferOption ?? booking.bank_transfer_option ?? "both";
  const existing = await admin.from("invoices").select("*").eq("booking_id", booking.id).maybeSingle();
  if (existing.error) throw new Error(`Invoice lookup failed: ${existing.error.message}`);
  if (existing.data) {
    const amountsChanged = existing.data.hire_amount_cents !== hireAmountCents
      || existing.data.security_deposit_cents !== securityDepositCents
      || (existing.data.gst_inclusive ?? true) !== gstInclusive
      || existing.data.payment_method !== booking.payment_method;
    const transferOptionChanged = booking.payment_method === "bank_transfer" && existing.data.bank_transfer_option !== selectedBankTransferOption;
    if (amountsChanged || transferOptionChanged) {
      const documents = await admin.from("billing_documents").select("id").eq("invoice_id", existing.data.id).limit(1);
      if (documents.error) throw new Error(`Invoice document lookup failed: ${documents.error.message}`);
      if (documents.data?.length && !(transferOptionChanged && !amountsChanged && allowTransferOptionChange)) {
        throw new Error("An invoice has already been issued with different payment details. Create a new booking invoice instead of replacing the existing document.");
      }
      const update = await admin.from("invoices").update({
        payment_method: booking.payment_method,
        hire_amount_cents: hireAmountCents,
        security_deposit_cents: securityDepositCents,
        gst_inclusive: gstInclusive,
        total_amount_cents: hireAmountCents + securityDepositCents,
        bank_transfer_option: selectedBankTransferOption,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.data.id);
      if (update.error) throw new Error(`Invoice amount update failed: ${update.error.message}`);
      existing.data.hire_amount_cents = hireAmountCents;
      existing.data.security_deposit_cents = securityDepositCents;
      existing.data.gst_inclusive = gstInclusive;
      existing.data.total_amount_cents = hireAmountCents + securityDepositCents;
      existing.data.payment_method = booking.payment_method;
      existing.data.bank_transfer_option = selectedBankTransferOption;
    }
    if (paymentUrl && existing.data.payment_url !== paymentUrl) {
      const update = await admin.from("invoices").update({ payment_url: paymentUrl, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
      if (update.error) throw new Error(`Invoice payment link update failed: ${update.error.message}`);
    }
    return existing.data as InvoiceRecord;
  }
  const invoiceNumber = invoiceNumberForBooking(booking.id);
  const result = await admin.from("invoices").insert({
    booking_id: booking.id,
    invoice_number: invoiceNumber,
    payment_method: booking.payment_method,
    hire_amount_cents: hireAmountCents,
    security_deposit_cents: securityDepositCents,
    gst_inclusive: gstInclusive,
    total_amount_cents: hireAmountCents + securityDepositCents,
    payment_url: paymentUrl ?? null,
    bank_transfer_option: selectedBankTransferOption,
    status: "issued",
  }).select().single();
  if (result.error) {
    const retry = await admin.from("invoices").select("*").eq("booking_id", booking.id).single();
    if (retry.error || !retry.data) throw new Error(`Invoice creation failed: ${result.error.message}`);
    return retry.data as InvoiceRecord;
  }
  return result.data as InvoiceRecord;
}

function documentEmailType(documentType: BillingDocumentType): CustomerEmailType {
  return documentType;
}

function documentTitle(documentType: BillingDocumentType) {
  return {
    invoice: "Tax Invoice",
    payment_receipt: "Payment receipt",
    deposit_authorisation: "Security deposit authorisation",
    deposit_release: "Security deposit release",
    deposit_capture: "Security deposit charge receipt",
  }[documentType];
}

function documentSubject(documentType: BillingDocumentType, number: string) {
  return `${documentTitle(documentType)} ${number} · Peppermint Audio`;
}

function pdfDetails(documentType: BillingDocumentType, booking: InvoiceBooking, invoice: InvoiceRecord): InvoicePdfDetails {
  const hire = invoice.hire_amount_cents;
  const deposit = invoice.security_deposit_cents;
  const method = invoice.payment_method === "bank_transfer" ? "Bank transfer" : "Stripe card payment and security-deposit authorisation";
  let lineItems: InvoicePdfLineItem[] = [
    { description: `Audio equipment hire · ${booking.package_interest || booking.event_type}`, amountCents: hire },
    { description: "Refundable security deposit", amountCents: deposit },
  ];
  let totalCents = invoice.total_amount_cents;
  let gstCents = invoice.gst_inclusive !== false ? gstIncludedCents(hire) : 0;
  const notes = [
    "The security deposit is refundable when all equipment is returned on time and in the agreed condition.",
  ];
  if (documentType === "payment_receipt") {
    if (invoice.payment_method === "stripe_card_hold") {
      lineItems = [{ description: "Audio equipment hire payment", amountCents: hire, status: "Paid and captured" }, { description: "Refundable security deposit", amountCents: deposit, status: booking.deposit_payment_status === "authorized" ? "Authorised, not captured" : "Pending authorisation" }];
      notes.unshift("This receipt confirms the hire payment was captured and the security deposit was authorised as a temporary card hold.");
    } else {
      lineItems = [{ description: "Audio equipment hire", amountCents: hire, status: "Received by bank transfer" }, { description: "Refundable security deposit", amountCents: deposit, status: "Received by bank transfer" }];
      notes.unshift("This receipt confirms Peppermint Audio recorded the bank transfer as received.");
    }
  } else if (documentType === "deposit_authorisation") {
    lineItems = [{ description: "Refundable security deposit", amountCents: deposit, status: "Authorised, not captured" }];
    totalCents = deposit;
    gstCents = 0;
    notes.unshift("The amount above is a temporary card authorisation, not a completed charge. It will be released after the equipment is returned safely.");
  } else if (documentType === "deposit_release") {
    lineItems = [{ description: "Refundable security deposit", amountCents: deposit, status: "Released / refunded" }];
    totalCents = deposit;
    gstCents = 0;
    notes.unshift("The security-deposit authorisation has been released. Your card issuer may take additional time to remove the pending hold.");
  } else if (documentType === "deposit_capture") {
    const captured = amount(booking.deposit_captured_cents);
    lineItems = [{ description: "Security deposit applied to damage, loss, or late-return costs", amountCents: captured, status: "Captured" }];
    totalCents = captured;
    gstCents = 0;
    notes.unshift("This document records the amount captured from the security deposit.");
  } else if (invoice.payment_method === "bank_transfer") {
    const bank = bankTransferDetails();
    notes.unshift(formatBankTransferInstructions(formatAud(invoice.total_amount_cents), booking.bank_transfer_reference || invoice.invoice_number, bank, invoice.bank_transfer_option));
  } else if (invoice.payment_url) {
    notes.unshift(`Pay securely online: ${invoice.payment_url}`);
  }
  if (gstCents > 0) {
    notes.push(GST_HIRE_ONLY_NOTE);
  }
  return {
    title: documentTitle(documentType),
    documentNumber: invoice.invoice_number,
    issuedAt: new Intl.DateTimeFormat("en-AU", { dateStyle: "long", timeZone: "Australia/Melbourne" }).format(new Date()),
    customerName: `${booking.first_name} ${booking.last_name}`,
    customerEmail: booking.email,
    eventType: booking.event_type,
    pickupDate: formatDate(booking.pickup_date),
    dropoffDate: formatDate(booking.dropoff_date),
    paymentMethod: method,
    lineItems,
    totalCents,
    gstIncludedCents: gstCents,
    notes,
  };
}

function formatAud(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

async function claimDocument(admin: AdminClient, invoice: InvoiceRecord, bookingId: string, documentType: BillingDocumentType, force = false) {
  const existing = await admin.from("billing_documents").select("*").eq("invoice_id", invoice.id).eq("document_type", documentType).maybeSingle();
  if (existing.error) throw new Error(`Billing document lookup failed: ${existing.error.message}`);
  if (existing.data?.status === "sent" && !force) return { record: existing.data, claimed: false };
  if (existing.data) return { record: existing.data, claimed: true };
  const result = await admin.from("billing_documents").insert({
    invoice_id: invoice.id,
    booking_id: bookingId,
    document_type: documentType,
    status: "pending",
  }).select().single();
  if (result.error) {
    const retry = await admin.from("billing_documents").select("*").eq("invoice_id", invoice.id).eq("document_type", documentType).single();
    if (retry.error || !retry.data) throw new Error(`Billing document claim failed: ${result.error.message}`);
    return { record: retry.data, claimed: retry.data.status !== "sent" };
  }
  return { record: result.data, claimed: true };
}

export async function sendBillingDocument(admin: AdminClient, bookingId: string, documentType: BillingDocumentType, paymentUrl?: string | null, force = false, bankTransferOption?: BankTransferOption) {
  const booking = await readBooking(admin, bookingId);
  const invoice = await ensureInvoice(admin, booking, paymentUrl, bankTransferOption, force);
  const claim = await claimDocument(admin, invoice, bookingId, documentType, force);
  if (!claim.claimed) return claim.record.provider_message_id as string | null;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email service is not configured.");
  const details = pdfDetails(documentType, booking, invoice);
  const pdf = await buildInvoicePdf(details);
  const bodyText = [
    `Hi ${booking.first_name},`,
    "",
    `${documentTitle(documentType)} ${invoice.invoice_number} is attached.`,
    `Event: ${booking.event_type}`,
    `Pickup: ${formatDate(booking.pickup_date)} · Return: ${formatDate(booking.dropoff_date)}`,
    booking.event_address ? `Event address: ${booking.event_address}` : "",
    ...details.notes,
    "",
    emailFooterText,
  ].join("\n");
  const response = await new Resend(apiKey).emails.send({
    from,
    to: [booking.email],
    subject: documentSubject(documentType, invoice.invoice_number),
    text: bodyText,
    html: `
      <div style="margin:0;background:#f4f1ed;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#20211f">
        <div style="margin:0 auto;max-width:600px;overflow:hidden;border:1px solid #e4ddd5;border-radius:16px;background:#fff">
          <div style="background:#1c2925;padding:28px 32px;text-align:center">
            <img src="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.peppermintaudio.com.au"}/logo-white.png" alt="${escapeHtml(business.name)}" width="170" style="display:block;width:170px;height:auto;margin:0 auto" />
          </div>
          <div style="padding:34px 32px">
            <p style="margin:0 0 8px;color:#5c806f;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${escapeHtml(documentTitle(documentType))}</p>
            <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#20211f">Hi ${escapeHtml(booking.first_name)}.</h1>
            <p style="margin:0;font-size:16px;line-height:1.6;color:#565955">${escapeHtml(`${documentTitle(documentType)} ${invoice.invoice_number} is attached.`)}</p>
            <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#565955">${escapeHtml(`Event: ${booking.event_type}`)}<br />${escapeHtml(`Pickup: ${formatDate(booking.pickup_date)} · Return: ${formatDate(booking.dropoff_date)}`)}${booking.event_address ? `<br />${escapeHtml(`Address: ${booking.event_address}`)}` : ""}</p>
            ${details.notes.map((note) => `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#565955">${escapeHtml(note)}</p>`).join("")}
          </div>
          ${emailFooterHtml}
        </div>
      </div>
    `,
    attachments: [{ filename: `${documentType}-${invoice.invoice_number}.pdf`, content: pdf.toString("base64") }],
  });
  if (response.error) {
    await admin.from("billing_documents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", claim.record.id);
    throw new Error("Billing document email could not be sent.");
  }
  await admin.from("billing_documents").update({
    status: "sent",
    provider_message_id: response.data?.id ?? null,
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", claim.record.id);
  try {
    await recordCustomerEmail(admin, {
      bookingId,
      recipientEmail: booking.email,
      emailType: documentEmailType(documentType),
      providerMessageId: response.data?.id,
    });
  } catch (error) {
    console.error("Billing email log failed:", error);
  }
  return response.data?.id ?? null;
}

export async function sendInvoiceEmail(admin: AdminClient, bookingId: string, paymentUrl?: string | null, force = false, bankTransferOption?: BankTransferOption) {
  return sendBillingDocument(admin, bookingId, "invoice", paymentUrl, force, bankTransferOption);
}

export async function markInvoiceStatus(admin: AdminClient, bookingId: string, status: string, paidAt?: string) {
  const update = await admin.from("invoices").update({
    status,
    ...(paidAt ? { paid_at: paidAt } : {}),
    updated_at: new Date().toISOString(),
  }).eq("booking_id", bookingId).select("id").single();
  if (update.error || !update.data) throw new Error(`Invoice status update failed: ${update.error?.message ?? "invoice not found"}`);
}
