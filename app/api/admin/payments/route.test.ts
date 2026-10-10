import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getStripe: vi.fn(),
  customerCreate: vi.fn(),
  customerRetrieve: vi.fn(),
  paymentIntentCreate: vi.fn(),
  paymentIntentRetrieve: vi.fn(),
  paymentIntentCancel: vi.fn(),
  sendInvoiceEmail: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/invoice-service", () => ({ sendInvoiceEmail: mocks.sendInvoiceEmail }));

import { POST as createCheckout } from "./create-checkout/route";
import { POST as createBankTransfer } from "./bank-transfer/route";
import { POST as updateBooking } from "./update-booking/route";
import { catalogLineItemFromKey } from "@/lib/booking-line-items";
import { depositHoldDate, melbourneDateKey } from "@/lib/payment-flow";

const hireLineItems = [{
  id: "custom:test-hire",
  kind: "custom",
  name: "Audio hire",
  quantity: 1,
  unitPriceCents: 10000,
}];

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
  it.each(["stripe", "bank", "cash", "update"])("uses multi-night catalogue totals for %s without discounting the deposit", async (method) => {
    const { session, update } = adminSession({
      id: "booking-1", email: "alex@example.com", first_name: "Alex", last_name: "Smith",
      status: "submitted", pickup_date: "2099-10-09", dropoff_date: "2099-10-12",
      hire_line_items: [catalogLineItemFromKey("package:standard-party-events")],
      payment_method: null, hire_payment_status: "unpaid", deposit_payment_status: "not_required",
    });
    mocks.requireAdmin.mockResolvedValue(session);
    const body = { bookingId: "booking-1", securityDepositAmount: "100" };
    const response = method === "stripe"
      ? await createCheckout(request("/api/admin/payments/create-checkout", body))
      : method === "update"
        ? await updateBooking(request("/api/admin/payments/update-booking", {
          ...body, hireLineItems: [catalogLineItemFromKey("package:standard-party-events")], paymentMethod: "cash_on_pickup",
        }))
        : await createBankTransfer(request("/api/admin/payments/bank-transfer", {
          ...body, ...(method === "cash" ? { paymentMethod: "cash_on_pickup" } : {}),
        }));
    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      hire_amount_cents: 32000, security_deposit_cents: 10000,
    }));
    if (method === "stripe") {
      expect(mocks.paymentIntentCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ amount: 32000 }));
      expect(mocks.paymentIntentCreate).toHaveBeenCalledTimes(1);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_key");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com");
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getStripe.mockReturnValue({
      customers: { create: mocks.customerCreate, retrieve: mocks.customerRetrieve },
      paymentIntents: {
        create: mocks.paymentIntentCreate,
        retrieve: mocks.paymentIntentRetrieve,
        cancel: mocks.paymentIntentCancel,
      },
    });
    mocks.customerCreate.mockResolvedValue({ id: "cus_123" });
    mocks.customerRetrieve.mockResolvedValue({ id: "cus_123", deleted: false });
    mocks.paymentIntentCreate.mockReset().mockResolvedValue({ id: "pi_hire", client_secret: "hire_secret" });
    mocks.sendInvoiceEmail.mockResolvedValue("invoice-email-1");
    mocks.paymentIntentRetrieve.mockResolvedValue({ status: "requires_payment_method" });
    mocks.paymentIntentCancel.mockResolvedValue({ id: "cancelled" });
  });

  const revisableBooking = (overrides: Record<string, unknown> = {}) => ({
    id: "booking-original",
    email: "alex@example.com",
    first_name: "Alex",
    last_name: "Smith",
    mobile: "0400000000",
    event_type: "Party",
    event_address: "1 Main Street",
    pickup_date: "2099-10-01",
    dropoff_date: "2099-10-03",
    pickup_time: null,
    dropoff_time: null,
    additional_details: "",
    terms_accepted: true,
    photo_id_paths: [],
    status: "submitted",
    calendar_event_link: null,
    calendar_error: null,
    internal_notes: null,
    payment_method: "bank_transfer",
    hire_amount_cents: 10000,
    security_deposit_cents: 10000,
    gst_inclusive: true,
    hire_payment_status: "bank_transfer_pending",
    deposit_payment_status: "bank_transfer_pending",
    bank_transfer_option: "both",
    stripe_customer_id: null,
    stripe_hire_payment_intent_id: null,
    stripe_deposit_payment_intent_id: null,
    hire_line_items: hireLineItems,
    ...overrides,
  });

  it("creates only the hire intent and schedules the deposit with off-session card saving", async () => {
    const { session, update } = adminSession({
      id: "booking-1",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Smith",
      status: "submitted",
      pickup_date: "2099-10-01",
      dropoff_date: "2099-10-03",
      payment_method: null,
      hire_amount_cents: null,
      security_deposit_cents: null,
      payment_token: null,
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });

    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-1",
      hireLineItems,
      securityDepositAmount: "100",
    }));

    expect(response.status).toBe(200);
    expect((await response.json()).paymentUrl).toMatch(/^https:\/\/www\.example\.com\/pay\//);
    expect(mocks.paymentIntentCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      amount: 10000,
      setup_future_usage: "off_session",
      allowed_payment_method_types: ["card"],
      description: "Peppermint Audio hire · PA-BOOKING1",
      metadata: { bookingId: "booking-1", invoiceNumber: "PA-BOOKING1", paymentType: "hire", depositSchedule: "deferred" },
    }));
    expect(mocks.paymentIntentCreate).toHaveBeenCalledTimes(1);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_hire_payment_intent_id: "pi_hire",
      stripe_deposit_payment_intent_id: null,
      deposit_payment_status: "scheduled",
      deposit_hold_date: "2099-09-30",
      deposit_consent_at: null,
      payment_method: "stripe_card_hold",
    }));
  });

  it("creates hire and deposit intents together for pickup-day checkout", async () => {
    const pickupDate = melbourneDateKey();
    const { session, update } = adminSession({
      id: "booking-last-minute",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Smith",
      status: "submitted",
      pickup_date: pickupDate,
      dropoff_date: pickupDate,
      payment_method: null,
      hire_amount_cents: null,
      security_deposit_cents: null,
      payment_token: null,
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    mocks.paymentIntentCreate.mockResolvedValueOnce({ id: "pi_hire", client_secret: "hire_secret" })
      .mockResolvedValueOnce({ id: "pi_deposit", client_secret: "deposit_secret" });

    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-last-minute",
      securityDepositAmount: "100",
    }));

    expect(response.status).toBe(200);
    expect(mocks.paymentIntentCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      amount: 10000,
      allowed_payment_method_types: ["card"],
      metadata: { bookingId: "booking-last-minute", invoiceNumber: "PA-BOOKINGLASTM", paymentType: "hire", depositSchedule: "immediate" },
    }));
    expect(mocks.paymentIntentCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      amount: 10000,
      capture_method: "manual",
      metadata: { bookingId: "booking-last-minute", invoiceNumber: "PA-BOOKINGLASTM", paymentType: "deposit", deferredDeposit: "true" },
    }));
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_hire_payment_intent_id: "pi_hire",
      stripe_deposit_payment_intent_id: "pi_deposit",
      deposit_payment_status: "pending",
      deposit_hold_date: depositHoldDate(pickupDate),
    }));
  });

  it("rejects Stripe for a four-night hire", async () => {
    const { session } = adminSession({
      id: "booking-2",
      status: "confirmed",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-05",
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-2",
      hireLineItems,
      securityDepositAmount: "100",
    }));
    expect(response.status).toBe(400);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("creates a replacement Stripe customer when the saved customer no longer exists", async () => {
    const { session, update } = adminSession({
      id: "booking-missing-customer",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Smith",
      status: "submitted",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-03",
      payment_method: null,
      hire_amount_cents: null,
      security_deposit_cents: null,
      payment_token: null,
      stripe_customer_id: "cus_missing",
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    mocks.customerRetrieve.mockRejectedValueOnce(Object.assign(new Error("No such customer: 'cus_missing'"), { code: "resource_missing" }));
    mocks.customerCreate.mockResolvedValueOnce({ id: "cus_replacement" });

    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-missing-customer",
      securityDepositAmount: "100",
    }));

    expect(response.status).toBe(200);
    expect(mocks.customerRetrieve).toHaveBeenCalledWith("cus_missing");
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ stripe_customer_id: "cus_replacement" }));
  });

  it("rotates Stripe links by cancelling old pending intents and issuing a new token", async () => {
    const { session, update } = adminSession({
      id: "booking-rotate",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Smith",
      status: "submitted",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-03",
      payment_method: "stripe_card_hold",
      payment_token: "old-token",
      payment_token_expires_at: "2099-01-01T00:00:00.000Z",
      stripe_hire_payment_intent_id: "pi_old_hire",
      stripe_deposit_payment_intent_id: "pi_old_deposit",
      hire_payment_status: "pending",
      deposit_payment_status: "pending",
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });

    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-rotate",
      securityDepositAmount: "100",
    }));
    const payload = await response.json() as { paymentToken: string };

    expect(response.status).toBe(200);
    expect(payload.paymentToken).not.toBe("old-token");
    expect(mocks.paymentIntentRetrieve).toHaveBeenCalledWith("pi_old_hire");
    expect(mocks.paymentIntentRetrieve).toHaveBeenCalledWith("pi_old_deposit");
    expect(mocks.paymentIntentCancel).toHaveBeenCalledWith("pi_old_hire");
    expect(mocks.paymentIntentCancel).toHaveBeenCalledWith("pi_old_deposit");
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_hire_payment_intent_id: "pi_hire",
      stripe_deposit_payment_intent_id: null,
      payment_token: expect.any(String),
    }));
  });

  it("rejects Stripe link rotation after payment is settled", async () => {
    const { session } = adminSession({
      id: "booking-paid",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Smith",
      status: "confirmed",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-03",
      payment_method: "stripe_card_hold",
      hire_payment_status: "paid",
      deposit_payment_status: "authorized",
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });

    const response = await createCheckout(request("/api/admin/payments/create-checkout", {
      bookingId: "booking-paid",
      securityDepositAmount: "100",
    }));

    expect(response.status).toBe(409);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("records bank transfer for long hires instead of calling Stripe", async () => {
    const { session, update } = adminSession({
      id: "booking-3",
      status: "confirmed",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-09",
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    const response = await createBankTransfer(request("/api/admin/payments/bank-transfer", {
      bookingId: "booking-3",
      hireLineItems,
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
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    const response = await createBankTransfer(request("/api/admin/payments/bank-transfer", {
      bookingId: "booking-4",
      hireLineItems,
      securityDepositAmount: "100",
    }));
    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ payment_method: "bank_transfer" }));
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("creates a cash-on-pickup invoice without calling Stripe", async () => {
    const { session, update } = adminSession({
      id: "booking-cash",
      status: "submitted",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-03",
      payment_method: null,
      hire_amount_cents: null,
      security_deposit_cents: null,
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });

    const response = await createBankTransfer(request("/api/admin/payments/bank-transfer", {
      bookingId: "booking-cash",
      paymentMethod: "cash_on_pickup",
      securityDepositAmount: "100",
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      reference: "PA-BOOKINGCASH",
      invoiceEmailId: "invoice-email-1",
      gstInclusive: true,
      paymentMethod: "cash_on_pickup",
    });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      payment_method: "cash_on_pickup",
      hire_payment_status: "cash_due",
      deposit_payment_status: "cash_due",
    }));
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("uses cash-on-pickup wording when the invoice email fails", async () => {
    const { session } = adminSession({
      id: "booking-cash-email-failure",
      status: "submitted",
      pickup_date: "2026-10-01",
      dropoff_date: "2026-10-03",
      payment_method: null,
      hire_amount_cents: null,
      security_deposit_cents: null,
      hire_line_items: hireLineItems,
    });
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    mocks.sendInvoiceEmail.mockRejectedValueOnce(new Error("provider rejected recipient"));

    const response = await createBankTransfer(request("/api/admin/payments/bank-transfer", {
      bookingId: "booking-cash-email-failure",
      paymentMethod: "cash_on_pickup",
      securityDepositAmount: "100",
    }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Cash-on-pickup booking recorded but invoice email failed: provider rejected recipient",
    });
  });

  it("updates a pending bank-transfer booking without changing its reference", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: revisableBooking(),
        error: null,
      }),
    };
    const update = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: { from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) } });

    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original",
      paymentMethod: "bank_transfer",
      hireLineItems: [{ ...hireLineItems[0], unitPriceCents: 12500 }],
      securityDepositAmount: "100",
      gstInclusive: false,
      bankTransferOption: "payid",
    }));

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      hire_amount_cents: 12500,
      payment_method: "bank_transfer",
      gst_inclusive: false,
    }));
    expect(mocks.sendInvoiceEmail).toHaveBeenCalledWith(expect.anything(), "booking-original", null, true, "payid", {}, true, true);
  });

  it("saves hire items without sending or changing the payment request", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: revisableBooking(),
        error: null,
      }),
    };
    const update = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: { from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) } });

    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original",
      hireLineItems: [{ ...hireLineItems[0], quantity: 2 }],
      saveOnly: true,
    }));

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      hire_line_items: [{ ...hireLineItems[0], quantity: 2 }],
      hire_amount_cents: 20000,
    }));
    expect(update.update).not.toHaveBeenCalledWith(expect.objectContaining({
      payment_method: expect.anything(),
    }));
    expect(mocks.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("rejects draft-only changes while a card payment link is active", async () => {
    const { session, update } = adminSession(revisableBooking({
      payment_method: "stripe_card_hold", hire_payment_status: "pending",
      deposit_payment_status: "scheduled", payment_token: "active-token",
      stripe_hire_payment_intent_id: "pi_hire",
    }));
    mocks.requireAdmin.mockResolvedValue(session);
    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original", hireLineItems: [{ ...hireLineItems[0], quantity: 2 }], saveOnly: true,
    }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Use Send invoice");
    expect(update.update).not.toHaveBeenCalled();
    expect(mocks.paymentIntentCancel).not.toHaveBeenCalled();
    expect(mocks.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("allows unchanged items to be saved for an active card request", async () => {
    const { session, update } = adminSession(revisableBooking({
      payment_method: "stripe_card_hold", hire_payment_status: "pending",
      deposit_payment_status: "scheduled", payment_token: "active-token",
      stripe_hire_payment_intent_id: "pi_hire",
    }));
    mocks.requireAdmin.mockResolvedValue(session);
    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original", hireLineItems, saveOnly: true,
    }));
    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalled();
    expect(mocks.paymentIntentCancel).not.toHaveBeenCalled();
  });

  it.each(["invalid", "-1", "1.001", null])("rejects invalid revised deposit amounts: %s", async (securityDepositAmount) => {
    const { session, update } = adminSession(revisableBooking());
    mocks.requireAdmin.mockResolvedValue(session);
    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original", hireLineItems, securityDepositAmount,
    }));
    expect(response.status).toBe(400);
    expect(update.update).not.toHaveBeenCalled();
    expect(mocks.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it.each([
    { hire_payment_status: "bank_transfer_received", deposit_payment_status: "not_required" },
    { hire_payment_status: "bank_transfer_received", deposit_payment_status: "bank_transfer_refunded" },
    { hire_payment_status: "bank_transfer_pending", deposit_payment_status: "bank_transfer_received" },
  ])("does not reset settled bank-transfer payments: %j", async (statuses) => {
    const { session, update } = adminSession(revisableBooking(statuses));
    mocks.requireAdmin.mockResolvedValue(session);
    const response = await createBankTransfer(request("/api/admin/payments/bank-transfer", {
      bookingId: "booking-original", securityDepositAmount: "100",
    }));
    expect(response.status).toBe(409);
    expect(update.update).not.toHaveBeenCalled();
    expect(mocks.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("ignores missing Stripe intents when revising an existing Stripe booking", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: revisableBooking({
          payment_method: "stripe_card_hold",
          hire_payment_status: "pending",
          deposit_payment_status: "pending",
          stripe_hire_payment_intent_id: "pi_missing_hire",
          stripe_deposit_payment_intent_id: "pi_missing_deposit",
        }),
        error: null,
      }),
    };
    const update = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: { from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) } });
    mocks.paymentIntentRetrieve
      .mockRejectedValueOnce({ type: "StripeInvalidRequestError", code: "resource_missing", message: "No such payment_intent: 'pi_missing_hire'" })
      .mockRejectedValueOnce({ type: "StripeInvalidRequestError", code: "resource_missing", message: "No such payment_intent: 'pi_missing_deposit'" });

    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original",
      paymentMethod: "bank_transfer",
      hireLineItems,
      securityDepositAmount: "100",
      gstInclusive: true,
      bankTransferOption: "both",
    }));

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      payment_method: "bank_transfer",
      stripe_hire_payment_intent_id: null,
      stripe_deposit_payment_intent_id: null,
    }));
    expect(mocks.sendInvoiceEmail).toHaveBeenCalledWith(expect.anything(), "booking-original", null, true, "both", {}, true, true);
  });

  it("replaces a missing Stripe customer when revising an existing Stripe booking", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: revisableBooking({
          payment_method: "stripe_card_hold",
          hire_payment_status: "pending",
          deposit_payment_status: "pending",
          stripe_customer_id: "cus_missing",
        }),
        error: null,
      }),
    };
    const update = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: { from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) } });
    mocks.customerRetrieve.mockRejectedValueOnce({ code: "resource_missing", message: "No such customer: 'cus_missing'" });
    mocks.customerCreate.mockResolvedValueOnce({ id: "cus_replacement" });

    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original",
      paymentMethod: "stripe_card_hold",
      hireLineItems,
      securityDepositAmount: "100",
      gstInclusive: true,
    }));

    expect(response.status).toBe(200);
    expect(mocks.customerRetrieve).toHaveBeenCalledWith("cus_missing");
    expect(mocks.customerCreate).toHaveBeenCalledWith(expect.objectContaining({
      email: "alex@example.com",
      metadata: { bookingId: "booking-original", invoiceNumber: "PA-BOOKINGORIGI" },
    }));
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ stripe_customer_id: "cus_replacement" }));
  });

  it("creates both payment intents when an updated Stripe booking is due for pickup", async () => {
    const pickupDate = melbourneDateKey();
    const { session, update } = adminSession(revisableBooking({
      pickup_date: pickupDate,
      dropoff_date: pickupDate,
    }));
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: session.admin });
    mocks.paymentIntentCreate.mockResolvedValueOnce({ id: "pi_hire", client_secret: "hire_secret" })
      .mockResolvedValueOnce({ id: "pi_deposit", client_secret: "deposit_secret" });

    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original",
      paymentMethod: "stripe_card_hold",
      hireLineItems,
      securityDepositAmount: "100",
      gstInclusive: true,
    }));

    expect(response.status).toBe(200);
    expect(mocks.paymentIntentCreate).toHaveBeenCalledTimes(2);
    expect(mocks.paymentIntentCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      amount: 10000,
      capture_method: "manual",
      metadata: expect.objectContaining({ paymentType: "deposit" }),
    }));
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_deposit_payment_intent_id: "pi_deposit",
      deposit_payment_status: "pending",
      deposit_hold_date: depositHoldDate(pickupDate),
    }));
  });

  it("rejects changes after the hire has been paid", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: revisableBooking({ hire_payment_status: "paid" }), error: null }),
    };
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, admin: { from: vi.fn().mockReturnValue(read) } });
    const response = await updateBooking(request("/api/admin/payments/update-booking", {
      bookingId: "booking-original",
      paymentMethod: "bank_transfer",
      hireLineItems,
      securityDepositAmount: "100",
    }));
    expect(response.status).toBe(409);
  });
});
