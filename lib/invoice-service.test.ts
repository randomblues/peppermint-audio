import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pdf: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/invoice-pdf", () => ({ buildInvoicePdf: mocks.pdf }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail: vi.fn() }));

import { billingDocumentIntro, ensureInvoice, sendBillingDocument } from "./invoice-service";
import { catalogLineItemFromKey } from "./booking-line-items";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("billing document email copy", () => {
  it.each([true, false])("keeps multi-night invoice and receipt line amounts consistent (GST %s)", async (gstInclusive) => {
    vi.stubEnv("RESEND_API_KEY", "re_test_placeholder");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "test@example.com");
    mocks.pdf.mockResolvedValue(Buffer.from("test-pdf"));
    mocks.send.mockResolvedValue({ data: { id: "test-email" }, error: null });
    const booking = {
      id: "booking-1", email: "test@example.com", first_name: "Pricing", last_name: "Test", event_type: "Party",
      pickup_date: "2026-10-09", dropoff_date: "2026-10-12",
      hire_line_items: [catalogLineItemFromKey("package:standard-party-events")],
      hire_amount_cents: 32000, security_deposit_cents: 10000, gst_inclusive: gstInclusive,
      payment_method: "cash_on_pickup",
    };
    const invoice = {
      id: "invoice-1", booking_id: booking.id, invoice_number: "PA-TEST", payment_method: "cash_on_pickup",
      hire_amount_cents: 32000, security_deposit_cents: 10000, gst_inclusive: gstInclusive,
      total_amount_cents: 42000, bank_transfer_option: "both", status: "issued",
    };
    const query = (data: unknown) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    });
    const admin = { from: vi.fn((table: string) => query(table === "bookings" ? booking : table === "invoices" ? invoice : { id: "document-1", status: "pending" })) };
    for (const document of ["invoice", "payment_receipt"] as const) {
      await sendBillingDocument(admin as never, booking.id, document);
      expect(mocks.pdf).toHaveBeenLastCalledWith(expect.objectContaining({
        title: document === "invoice" ? (gstInclusive ? "Tax Invoice" : "Invoice") : "Payment receipt",
        totalCents: 42000,
        gstIncludedCents: gstInclusive ? 2909 : 0,
        lineItems: [
          expect.objectContaining({ description: expect.stringContaining("3 nights"), amountCents: 32000 }),
          expect.objectContaining({ description: "Refundable security deposit", amountCents: 10000 }),
        ],
      }));
    }
  });

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
