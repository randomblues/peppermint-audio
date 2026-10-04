import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getStripe: vi.fn(),
  customerCreate: vi.fn(),
  paymentIntentCreate: vi.fn(),
  sendInvoiceEmail: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/invoice-service", () => ({ sendInvoiceEmail: mocks.sendInvoiceEmail }));

import { POST as createCheckout } from "./create-checkout/route";
import { POST as createBankTransfer } from "./bank-transfer/route";

const request = (url: string, body: unknown) => new Request(`http://localhost${url}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function adminSession(readData: Record<string, unknown>) {
  const read = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: readData, error: null }),
  };
  const update = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    session: { admin: { from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) } },
    update,
  };
}

describe("admin payment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_key");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com");
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getStripe.mockReturnValue({
      customers: { create: mocks.customerCreate },
      paymentIntents: { create: mocks.paymentIntentCreate },
    });
    mocks.customerCreate.mockResolvedValue({ id: "cus_123" });
    mocks.paymentIntentCreate
      .mockResolvedValueOnce({ id: "pi_hire", client_secret: "hire_secret" })
      .mockResolvedValueOnce({ id: "pi_deposit", client_secret: "deposit_secret" });
    mocks.sendInvoiceEmail.mockResolvedValue("invoice-email-1");
  });

  it("creates one captured hire intent and one manual-capture deposit intent", async () => {
    const { session, update } = adminSession({
      id: "booking-1",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Smith",
      status: "confirmed",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-03",
      payment_method: null,
      hire_amount_cents: null,
      security_deposit_cents: null,
      payment_token: null,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });

    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-1",
      hireAmount: "100",
      securityDepositAmount: "100",
    }));

    expect(response.status).toBe(200);
    expect((await response.json()).paymentUrl).toMatch(/^https:\/\/www\.example\.com\/pay\//);
    expect(mocks.paymentIntentCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      amount: 10000,
      description: "Peppermint Audio hire · PA-BOOKING1",
      metadata: { bookingId: "booking-1", invoiceNumber: "PA-BOOKING1", paymentType: "hire" },
    }));
    expect(mocks.paymentIntentCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      amount: 10000,
      capture_method: "manual",
      description: "Refundable security deposit · PA-BOOKING1",
      metadata: { bookingId: "booking-1", invoiceNumber: "PA-BOOKING1", paymentType: "deposit" },
    }));
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_hire_payment_intent_id: "pi_hire",
      stripe_deposit_payment_intent_id: "pi_deposit",
      payment_method: "stripe_card_hold",
    }));
  });

  it("rejects Stripe for hires longer than seven days", async () => {
    const { session } = adminSession({
      id: "booking-2",
      status: "confirmed",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-09",
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-2",
      hireAmount: "100",
      securityDepositAmount: "100",
    }));
    expect(response.status).toBe(400);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("records bank transfer for long hires instead of calling Stripe", async () => {
    const { session, update } = adminSession({
      id: "booking-3",
      status: "confirmed",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-09",
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    const response = await createBankTransfer(request("/api/admin/payments/bank-transfer", {
      bookingId: "booking-3",
      hireAmount: "100",
      securityDepositAmount: "100",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, reference: "PA-BOOKING3", invoiceEmailId: "invoice-email-1", gstInclusive: true });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      payment_method: "bank_transfer",
      gst_inclusive: true,
      hire_payment_status: "bank_transfer_pending",
      deposit_payment_status: "bank_transfer_pending",
    }));
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("allows bank transfer for short hires instead of calling Stripe", async () => {
    const { session, update } = adminSession({
      id: "booking-4",
      status: "confirmed",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-03",
      payment_method: null,
      hire_amount_cents: null,
      security_deposit_cents: null,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    const response = await createBankTransfer(request("/api/admin/payments/bank-transfer", {
      bookingId: "booking-4",
      hireAmount: "100",
      securityDepositAmount: "100",
    }));
    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ payment_method: "bank_transfer" }));
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });
});
