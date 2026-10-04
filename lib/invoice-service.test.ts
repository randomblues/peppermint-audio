import { describe, expect, it, vi } from "vitest";

import { billingDocumentIntro, ensureInvoice } from "./invoice-service";

describe("billing document email copy", () => {
  it("uses the correct invoice label for the GST setting", () => {
    expect(billingDocumentIntro("invoice", "Acme Events")).toBe("Please find the attached tax invoice for Acme Events.");
    expect(billingDocumentIntro("invoice", "Acme Events", false)).toBe("Please find the attached invoice for Acme Events.");
  });

  it("uses updated wording when an invoice is sent again", () => {
    expect(billingDocumentIntro("invoice", "Acme Events", true, true)).toBe("Here is your updated Tax Invoice for Acme Events.");
    expect(billingDocumentIntro("invoice", "Acme Events", false, true)).toBe("Here is your updated Invoice for Acme Events.");
  });

  it("uses the same contact-aware wording for other billing documents", () => {
    expect(billingDocumentIntro("payment_receipt", "Alex Smith")).toBe("Please find the attached payment receipt for Alex Smith.");
    expect(billingDocumentIntro("payment_receipt", "Alex Smith", true, true)).toBe("Please find the attached payment receipt for Alex Smith.");
  });

  it("keeps a newly saved payment URL on the invoice used for the email attachment", async () => {
    const invoice = {
      id: "invoice-1",
      booking_id: "booking-1",
      invoice_number: "PA-BOOKING1",
      payment_method: "stripe_card_hold",
      hire_amount_cents: 10000,
      security_deposit_cents: 10000,
      gst_inclusive: true,
      total_amount_cents: 20000,
      payment_url: null,
      bank_transfer_option: "both",
      status: "issued",
    };
    const invoicesTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: invoice, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    };
    const admin = { from: vi.fn(() => invoicesTable) };

    const result = await ensureInvoice(admin as never, {
      id: "booking-1",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Smith",
      event_type: "Party",
      pickup_date: "2026-10-10",
      dropoff_date: "2026-10-11",
      hire_line_items: [{ id: "speaker", kind: "custom", name: "Speaker", quantity: 1, unitPriceCents: 10000 }],
      hire_amount_cents: 10000,
      security_deposit_cents: 10000,
      gst_inclusive: true,
      payment_method: "stripe_card_hold",
    }, "https://example.com/pay/token");

    expect(result.payment_url).toBe("https://example.com/pay/token");
  });
});
