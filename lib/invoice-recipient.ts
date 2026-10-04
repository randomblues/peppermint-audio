export type InvoiceRecipientOverrides = {
  billToName?: string;
  billToEmail?: string;
};

type InvoiceRecipientInput = {
  billToName?: unknown;
  billToEmail?: unknown;
};

export function parseInvoiceRecipient(input: InvoiceRecipientInput): { recipient?: InvoiceRecipientOverrides; error?: string } {
  if (input.billToName !== undefined && typeof input.billToName !== "string") {
    return { error: "Bill to name must be text." };
  }
  if (input.billToEmail !== undefined && typeof input.billToEmail !== "string") {
    return { error: "Bill to email must be text." };
  }

  const billToName = typeof input.billToName === "string" ? input.billToName.trim() : "";
  const billToEmail = typeof input.billToEmail === "string" ? input.billToEmail.trim() : "";
  if (billToName.length > 200) return { error: "Bill to name must be 200 characters or fewer." };
  if (billToEmail.length > 254 || (billToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billToEmail))) {
    return { error: "Enter a valid Bill to email address." };
  }

  const recipient: InvoiceRecipientOverrides = {};
  if (billToName) recipient.billToName = billToName;
  if (billToEmail) recipient.billToEmail = billToEmail;
  return { recipient };
}

export function invoiceEmailRecipients(originalEmail: string, alternateEmail?: string): { to: string[]; cc?: string[] } {
  const primaryEmail = alternateEmail || originalEmail;
  if (alternateEmail && alternateEmail.toLowerCase() !== originalEmail.toLowerCase()) {
    return { to: [primaryEmail], cc: [originalEmail] };
  }
  return { to: [primaryEmail] };
}
