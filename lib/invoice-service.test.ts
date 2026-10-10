import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pdf: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/invoice-pdf", () => ({ buildInvoicePdf: mocks.pdf }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail: vi.fn() }));

import { billingDocumentIntro, ensureInvoice, sendBillingDocument } from "./invoice-service";
import { catalogLineItemFromKey } from "./booking-line-items";
import { depositHoldDate, melbourneDateKey } from "./payment-flow";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("billing delivery tracking and retry safety", () => {
  function setup(status = "pending", providerMessageId: string | null = null) {
    vi.stubEnv("RESEND_API_KEY", "re_test_placeholder");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "test@example.com");
    mocks.pdf.mockResolvedValue(Buffer.from("test-pdf"));
    mocks.send.mockResolvedValue({ data: { id: "next-email" }, error: null });
    const booking = {
      id: "booking-1", email: "test@example.com", first_name: "Test", last_name: "Customer", event_type: "Party",
      pickup_date: "2026-10-09", dropoff_date: "2026-10-10",
      hire_line_items: [catalogLineItemFromKey("package:standard-party-events")],
      hire_amount_cents: 16000, security_deposit_cents: 10000, payment_method: "cash_on_pickup",
    };
    const invoice = {
      id: "invoice-1", booking_id: booking.id, invoice_number: "PA-TEST", payment_method: "cash_on_pickup",
      hire_amount_cents: 16000, security_deposit_cents: 10000, total_amount_cents: 26000,
      gst_inclusive: true, bank_transfer_option: "both", status: "issued",
    };
    const document = { id: "doc-1", status, provider_message_id: providerMessageId, created_at: "2026-10-09T00:00:00Z" };
    let failedStatus: string | undefined;
    const update = vi.fn((values: typeof document) => ({
      eq: vi.fn(async () => {
        if (values.status === failedStatus) return { error: { message: "tracking unavailable" } };
        Object.assign(document, values);
        return { error: null };
      }),
    }));
    const query = (data: unknown) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: { ...data as object }, error: null })),
      maybeSingle: vi.fn(async () => ({ data: { ...data as object }, error: null })), update,
    });
    const admin = { from: vi.fn((table: string) => query(table === "bookings" ? booking : table === "invoices" ? invoice : document)) };
    return { admin, document, failStatus: (value?: string) => { failedStatus = value; } };
  }

  it("surfaces a failed sent write and reuses the provider key on retry", async () => {
    const { admin, failStatus } = setup();
    failStatus("sent");
    await expect(sendBillingDocument(admin as never, "booking-1", "invoice")).rejects.toThrow("sent status update failed");
    failStatus();
    await expect(sendBillingDocument(admin as never, "booking-1", "invoice")).resolves.toBe("next-email");
    expect(mocks.send.mock.calls.map(call => call[1])).toEqual([
      { idempotencyKey: "billing-doc-1-initial" }, { idempotencyKey: "billing-doc-1-initial" },
    ]);
    expect(mocks.send.mock.calls[0][0]).toEqual(mocks.send.mock.calls[1][0]);
    await sendBillingDocument(admin as never, "booking-1", "invoice");
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("gives an intentional resend a new key while retaining it across failed persistence", async () => {
    const { admin, failStatus } = setup("sent", "original-email");
    failStatus("sent");
    await expect(sendBillingDocument(admin as never, "booking-1", "invoice", undefined, true)).rejects.toThrow("sent status update failed");
    failStatus();
    await sendBillingDocument(admin as never, "booking-1", "invoice", undefined, true);
    expect(mocks.send.mock.calls.map(call => call[1])).toEqual([
      { idempotencyKey: "billing-doc-1-original-email" }, { idempotencyKey: "billing-doc-1-original-email" },
    ]);
    expect(mocks.send.mock.calls[0][0]).toEqual(mocks.send.mock.calls[1][0]);
    await sendBillingDocument(admin as never, "booking-1", "invoice", undefined, true);
    expect(mocks.send.mock.lastCall?.[1]).toEqual({ idempotencyKey: "billing-doc-1-next-email" });
  });

  it("does not deliver a forced resend when its pending write fails", async () => {
    const { admin, failStatus } = setup("sent", "original-email");
    failStatus("pending");
    await expect(sendBillingDocument(admin as never, "booking-1", "invoice", undefined, true)).rejects.toThrow("pending status update failed");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("surfaces both delivery and failed-status persistence errors", async () => {
    const { admin, failStatus } = setup();
    mocks.send.mockResolvedValue({ data: null, error: { message: "provider rejected" } });
    failStatus("failed");
    await expect(sendBillingDocument(admin as never, "booking-1", "invoice")).rejects.toThrow("could not be sent; failed status update failed");
    failStatus();
    await expect(sendBillingDocument(admin as never, "booking-1", "invoice")).rejects.toThrow("could not be sent.");
    expect(mocks.send.mock.lastCall?.[1]).toEqual({ idempotencyKey: "billing-doc-1-initial" });
  });
});

describe("billing document email copy", () => {
  it.each([true, false])("a scheduled card deposit is not represented as money received (GST %s)", async gstInclusive => {
    vi.stubEnv("RESEND_API_KEY", "re_test_placeholder");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "test@example.com");
    mocks.pdf.mockResolvedValue(Buffer.from("test-pdf"));
    mocks.send.mockResolvedValue({ data: { id: "test-email" }, error: null });
    const booking = {
      id: "booking-1", email: "test@example.com", first_name: "Test", last_name: "Customer", event_type: "Party",
      pickup_date: "2099-11-09", dropoff_date: "2099-11-10", hire_line_items: [catalogLineItemFromKey("package:standard-party-events")],
      hire_amount_cents: 16000, security_deposit_cents: 10000, gst_inclusive: gstInclusive,
      payment_method: "stripe_card_hold", deposit_payment_status: "scheduled", deposit_hold_date: "2099-11-08",
      event_address: "Customer-provided event address",
    };
    const invoice = {
      id: "invoice-1", booking_id: booking.id, invoice_number: "PA-TEST", payment_method: "stripe_card_hold",
      hire_amount_cents: 16000, security_deposit_cents: 10000, total_amount_cents: 26000, gst_inclusive: gstInclusive,
      bank_transfer_option: "both", status: "issued", payment_url: "https://example.com/pay/token",
    };
    const query = (data: unknown) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    });
    const admin = { from: vi.fn((table: string) => query(table === "bookings" ? booking : table === "invoices" ? invoice : { id: "doc-1", status: "pending" })) };
    await sendBillingDocument(admin as never, booking.id, "payment_receipt");
    expect(mocks.send.mock.lastCall?.[0].text).not.toContain("https://example.com/pay/token");
    expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({
      totalCents: 16000,
      notes: expect.arrayContaining(["This receipt confirms the hire payment only. The security deposit has not yet been authorised."]),
    }));
    await sendBillingDocument(admin as never, booking.id, "invoice");
    expect(mocks.send.mock.lastCall?.[0].text).toContain("https://example.com/pay/token");
    expect(mocks.pdf).toHaveBeenLastCalledWith(expect.objectContaining({
      notes: expect.arrayContaining([
        expect.stringContaining("The $100.00 security deposit is a temporary card hold scheduled for 8 November 2099 (one day before pickup)."),
      ]),
    }));
    await sendBillingDocument(admin as never, booking.id, "deposit_release");
    const releaseEmail = mocks.send.mock.lastCall?.[0];
    expect(releaseEmail.text).not.toContain("https://example.com/pay/token");
    expect(releaseEmail.html).not.toContain("Continue to secure payment");
    expect(releaseEmail.html).not.toContain("https://example.com/pay/token");
    expect(releaseEmail.html).toContain("Customer-provided event address");
  });

  it("describes a last-minute deposit hold as part of checkout on the invoice", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_placeholder");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "test@example.com");
    mocks.pdf.mockResolvedValue(Buffer.from("test-pdf"));
    mocks.send.mockResolvedValue({ data: { id: "test-email" }, error: null });
    const pickupDate = melbourneDateKey();
    const booking = {
      id: "booking-1", email: "test@example.com", first_name: "Test", last_name: "Customer", event_type: "Party",
      pickup_date: pickupDate, dropoff_date: pickupDate, hire_line_items: [catalogLineItemFromKey("package:standard-party-events")],
      hire_amount_cents: 16000, security_deposit_cents: 10000, gst_inclusive: true,
      payment_method: "stripe_card_hold", deposit_payment_status: "pending", deposit_hold_date: depositHoldDate(pickupDate),
    };
    const invoice = {
      id: "invoice-1", booking_id: booking.id, invoice_number: "PA-TEST", payment_method: "stripe_card_hold",
      hire_amount_cents: 16000, security_deposit_cents: 10000, total_amount_cents: 26000, gst_inclusive: true,
      bank_transfer_option: "both", status: "issued", payment_url: "https://example.com/pay/token",
    };
    const query = (data: unknown) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    });
    const admin = { from: vi.fn((table: string) => query(table === "bookings" ? booking : table === "invoices" ? invoice : { id: "doc-1", status: "pending" })) };

    await sendBillingDocument(admin as never, booking.id, "invoice");

    expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({
      totalCents: 26000,
      notes: expect.arrayContaining([
        "The hire payment is due now. The $100.00 security deposit is a temporary card hold placed as part of checkout.",
      ]),
    }));
  });

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
