import { Resend } from "resend";

import { emailFooterText } from "@/lib/email-footer";
import { bookingHireTotalCents, lineItemHireTotalCents, lineItemsForBooking, type BookingLineItem } from "@/lib/booking-line-items";
import { formatAudCents, rentalDays } from "@/lib/payment-flow";
import { emailDetailsTable, emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";
import { recordCustomerEmail, type CustomerEmailType } from "@/lib/email-log";
import { buildInvoicePdf, type InvoicePdfDetails, type InvoicePdfLineItem } from "@/lib/invoice-pdf";
import { invoiceNumberForBooking } from "@/lib/invoice-reference";
import { invoiceEmailRecipients, type InvoiceRecipientOverrides } from "@/lib/invoice-recipient";
import { type BankTransferDetails, type BankTransferOption } from "@/lib/bank-transfer";
import { gstIncludedCents } from "@/lib/gst";
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
  hire_line_items?: unknown;
  hire_amount_cents: number | null;
  security_deposit_cents: number | null;
  gst_inclusive?: boolean | null;
  payment_method: string | null;
  bank_transfer_option?: BankTransferOption | null;
  bank_transfer_reference?: string | null;
  deposit_payment_status?: string | null;
  deposit_captured_cents?: number | null;
  deposit_hold_date?: string | null;
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

const bookingSelect = "id,email,first_name,last_name,event_type,event_address,pickup_date,dropoff_date,hire_line_items,hire_amount_cents,security_deposit_cents,gst_inclusive,payment_method,bank_transfer_reference,bank_transfer_option,deposit_payment_status,deposit_captured_cents,deposit_hold_date";

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

export async function ensureInvoice(admin: AdminClient, booking: InvoiceBooking, paymentUrl?: string | null, bankTransferOption?: BankTransferOption, allowTransferOptionChange = false, allowPaymentMethodChange = false, allowInvoiceAmountChange = false) {
  const lineItems = lineItemsForBooking(booking);
  const hireAmountCents = bookingHireTotalCents(lineItems, booking.pickup_date, booking.dropoff_date);
  if (!hireAmountCents) throw new Error("Add at least one priced hire item before creating an invoice.");
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
      const paymentMethodChanged = existing.data.payment_method !== booking.payment_method;
      const canReplaceExistingDocument = (transferOptionChanged && !amountsChanged && allowTransferOptionChange)
        || (paymentMethodChanged && allowPaymentMethodChange);
      if (documents.data?.length && !canReplaceExistingDocument && !allowInvoiceAmountChange) {
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
    if (paymentUrl !== undefined && existing.data.payment_url !== paymentUrl) {
      const update = await admin.from("invoices").update({ payment_url: paymentUrl, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
      if (update.error) throw new Error(`Invoice payment link update failed: ${update.error.message}`);
      existing.data.payment_url = paymentUrl;
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

function documentTitle(documentType: BillingDocumentType, gstInclusive = true) {
  return {
    invoice: gstInclusive ? "Tax Invoice" : "Invoice",
    payment_receipt: "Payment receipt",
    deposit_authorisation: "Security deposit authorisation",
    deposit_release: "Security deposit release",
    deposit_capture: "Security deposit charge receipt",
  }[documentType];
}

function documentSubject(documentType: BillingDocumentType, number: string, gstInclusive = true) {
  return `${documentTitle(documentType, gstInclusive)} ${number} · Peppermint Audio`;
}

export function billingDocumentIntro(documentType: BillingDocumentType, customerName: string, gstInclusive = true, updated = false) {
  if (documentType === "invoice" && updated) {
    return `Here is your updated ${documentTitle(documentType, gstInclusive)} for ${customerName}.`;
  }
  return `Please find the attached ${documentTitle(documentType, gstInclusive).toLowerCase()} for ${customerName}.`;
}

function pdfDetails(documentType: BillingDocumentType, booking: InvoiceBooking, invoice: InvoiceRecord, recipient?: InvoiceRecipientOverrides): InvoicePdfDetails {
  const hire = invoice.hire_amount_cents;
  const deposit = invoice.security_deposit_cents;
  const method = invoice.payment_method === "bank_transfer"
    ? "Bank transfer"
    : invoice.payment_method === "cash_on_pickup"
      ? "Cash on pickup"
      : "Stripe card payment and security-deposit authorisation";
  const hireLineItems = lineItemsForBooking(booking);
  const nights = rentalDays(booking.pickup_date, booking.dropoff_date);
  if (nights === null) throw new Error("The booking dates are invalid.");
  const formatLineItem = (item: BookingLineItem, status?: string): InvoicePdfLineItem => ({
    description: `${item.quantity > 1 ? `${item.quantity} × ` : ""}${item.name}${item.option ? ` · ${item.option}` : ""}${item.kind === "custom" ? "" : ` · ${nights} ${nights === 1 ? "night" : "nights"}`}`,
    amountCents: lineItemHireTotalCents(item, nights),
    status,
  });
  let lineItems: InvoicePdfLineItem[] = [
    ...hireLineItems.map((item) => formatLineItem(item)),
    { description: "Refundable security deposit", amountCents: deposit },
  ];
  let totalCents = invoice.total_amount_cents;
  let gstCents = invoice.gst_inclusive !== false ? gstIncludedCents(hire) : 0;
  const notes = [
    "The security deposit is refundable when all equipment is returned on time and in the agreed condition.",
  ];
  if (invoice.payment_method === "stripe_card_hold" && booking.deposit_hold_date && documentType === "invoice") {
    notes.unshift(`The hire payment is due now. The ${formatAudCents(deposit)} security deposit is a separate temporary card hold scheduled for ${formatDate(booking.deposit_hold_date)}, or after payment for a last-minute booking. It is not charged with the hire payment.`);
  }
  const bank = invoice.payment_method === "bank_transfer" ? bankTransferDetails() : undefined;
  const bankTransfer = bank
    ? {
      ...bank,
      amountCents: invoice.total_amount_cents,
      reference: booking.bank_transfer_reference || invoice.invoice_number,
    }
    : undefined;
  if (documentType === "payment_receipt") {
    if (invoice.payment_method === "stripe_card_hold") {
      lineItems = [...hireLineItems.map((item) => formatLineItem(item, "Paid and captured")), { description: "Refundable security deposit", amountCents: deposit, status: booking.deposit_payment_status === "authorized" ? "Authorised, not captured" : "Pending authorisation" }];
      totalCents = hire;
      notes.unshift(booking.deposit_payment_status === "authorized"
        ? "This receipt confirms the hire payment. The security deposit is a separate temporary card hold, not an additional payment."
        : "This receipt confirms the hire payment only. The security deposit has not yet been authorised.");
    } else {
      const receivedBy = invoice.payment_method === "cash_on_pickup" ? "Received in cash" : "Received by bank transfer";
      lineItems = [...hireLineItems.map((item) => formatLineItem(item, receivedBy)), { description: "Refundable security deposit", amountCents: deposit, status: receivedBy }];
      notes.unshift(`This receipt confirms Peppermint Audio recorded the payment as ${invoice.payment_method === "cash_on_pickup" ? "cash received" : "bank transfer received"}.`);
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
  } else if (invoice.payment_url) {
    notes.unshift(`Pay securely online: ${invoice.payment_url}`);
  } else if (invoice.payment_method === "cash_on_pickup") {
    notes.unshift("Payment is due in cash on the day of pickup. Please bring the hire amount and refundable security deposit.");
  }
  return {
    title: documentTitle(documentType, invoice.gst_inclusive !== false),
    documentNumber: invoice.invoice_number,
    issuedAt: new Intl.DateTimeFormat("en-AU", { dateStyle: "long", timeZone: "Australia/Melbourne" }).format(new Date()),
    customerName: recipient?.billToName || `${booking.first_name} ${booking.last_name}`,
    customerEmail: recipient?.billToEmail || booking.email,
    eventType: booking.event_type,
    pickupDate: formatDate(booking.pickup_date),
    dropoffDate: formatDate(booking.dropoff_date),
    paymentMethod: method,
    lineItems,
    totalCents,
    gstIncludedCents: gstCents,
    notes,
    bankTransfer,
  };
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

export async function sendBillingDocument(admin: AdminClient, bookingId: string, documentType: BillingDocumentType, paymentUrl?: string | null, force = false, bankTransferOption?: BankTransferOption, recipient?: InvoiceRecipientOverrides, allowPaymentMethodChange = false, allowInvoiceAmountChange = false) {
  const booking = await readBooking(admin, bookingId);
  const invoice = await ensureInvoice(admin, booking, paymentUrl, bankTransferOption, force, allowPaymentMethodChange, allowInvoiceAmountChange);
  const claim = await claimDocument(admin, invoice, bookingId, documentType, force);
  if (!claim.claimed) return claim.record.provider_message_id as string | null;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email service is not configured.");
  const details = pdfDetails(documentType, booking, invoice, recipient);
  const emailRecipients = invoiceEmailRecipients(booking.email, recipient?.billToEmail);
  const customerName = recipient?.billToName || `${booking.first_name} ${booking.last_name}`;
  const gstInclusive = booking.gst_inclusive !== false;
  const emailIntro = billingDocumentIntro(documentType, customerName, gstInclusive, force && claim.record.status === "sent");
  const pdf = await buildInvoicePdf(details);
  const bodyText = [
    "Hello,",
    "",
    emailIntro,
    `Booking Reference: ${invoice.invoice_number}`,
    invoice.payment_url ? "Having trouble opening the payment page? No worries — copy and paste the link below into your browser." : "",
    invoice.payment_url ? `Pay securely online: ${invoice.payment_url}` : "",
    invoice.payment_url ? "Powered by Stripe." : "",
    `Event: ${booking.event_type}`,
    `Pickup: ${formatDate(booking.pickup_date)} · Return: ${formatDate(booking.dropoff_date)}`,
    booking.event_address ? `Event address: ${booking.event_address}` : "",
    invoice.payment_method === "cash_on_pickup" ? "Payment: cash due on the day of pickup, including the refundable security deposit." : "",
    "",
    emailFooterText,
  ].join("\n");
  const emailHtml = emailLayout({
    eyebrow: documentTitle(documentType, gstInclusive),
    intro: escapeEmailHtml(emailIntro),
    content: `
      ${emailPanel(`
        <p style="margin:0 0 6px;color:#668074;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Booking Reference:</p>
        <p style="margin:0;color:#1d2823;font-size:22px;font-weight:700;letter-spacing:.3px">${escapeEmailHtml(invoice.invoice_number)}</p>
      `, "accent")}
      ${emailPanel(emailDetailsTable([
        { label: "Invoice", value: invoice.invoice_number },
        { label: "Event", value: booking.event_type },
        { label: "Pickup", value: formatDate(booking.pickup_date) },
        { label: "Return", value: formatDate(booking.dropoff_date) },
        ...(booking.event_address ? [{ label: "Address", value: booking.event_address }] : []),
      ]))}
      ${invoice.payment_url ? emailPanel(`
        <p style="margin:0 0 10px;color:#1d2823;font-size:14px;line-height:1.6"><strong>Pay securely online</strong></p>
        <a href="${escapeEmailHtml(invoice.payment_url)}" style="display:inline-block;padding:11px 18px;border-radius:7px;background:#2f7056;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Continue to secure payment</a>
        <p style="margin:12px 0 0;color:#718078;font-size:12px;line-height:1.5">Having trouble opening the payment page? No worries &mdash; copy and paste the link below into your browser.</p>
        <p style="margin:12px 0 0;color:#718078;font-size:12px;line-height:1.5;word-break:break-all">${escapeEmailHtml(invoice.payment_url)}</p>
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid #cfe5d6">
          <p style="margin:0;color:#1d2823;font-size:13px;font-weight:700">Powered by Stripe</p>
        </div>
      `, "accent") : ""}
      ${invoice.payment_method === "cash_on_pickup" ? emailPanel("<p style=\"margin:0;color:#1d2823;font-size:14px;line-height:1.6\"><strong>Payment due in cash on pickup.</strong><br />Please bring the hire amount and refundable security deposit on the day of collection.</p>", "accent") : ""}
      <p style="margin:26px 0 0;color:#718078;font-size:13px;line-height:1.6">The detailed ${escapeEmailHtml(documentTitle(documentType, gstInclusive).toLowerCase())} is attached as a PDF for your records.</p>
    `,
  });
  const response = await new Resend(apiKey).emails.send({
    from,
    ...emailRecipients,
    subject: documentSubject(documentType, invoice.invoice_number, gstInclusive),
    text: bodyText,
    html: emailHtml,
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
      recipientEmail: recipient?.billToEmail || booking.email,
      emailType: documentEmailType(documentType),
      providerMessageId: response.data?.id,
    });
  } catch (error) {
    console.error("Billing email log failed:", error);
  }
  return response.data?.id ?? null;
}

export async function sendInvoiceEmail(admin: AdminClient, bookingId: string, paymentUrl?: string | null, force = false, bankTransferOption?: BankTransferOption, recipient?: InvoiceRecipientOverrides, allowPaymentMethodChange = false, allowInvoiceAmountChange = false) {
  return sendBillingDocument(admin, bookingId, "invoice", paymentUrl, force, bankTransferOption, recipient, allowPaymentMethodChange, allowInvoiceAmountChange);
}

export async function markInvoiceStatus(admin: AdminClient, bookingId: string, status: string, paidAt?: string) {
  const update = await admin.from("invoices").update({
    status,
    ...(paidAt ? { paid_at: paidAt } : {}),
    updated_at: new Date().toISOString(),
  }).eq("booking_id", bookingId).select("id").single();
  if (update.error || !update.data) throw new Error(`Invoice status update failed: ${update.error?.message ?? "invoice not found"}`);
}
