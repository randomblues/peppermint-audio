import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getStripe: vi.fn(),
  markInvoiceStatus: vi.fn(),
  sendBillingDocument: vi.fn(),
  readDepositBooking: vi.fn(),
  syncDeferredDeposit: vi.fn(),
  attemptDeferredDeposit: vi.fn(),
  notifyDepositAttention: vi.fn(),
  confirmPaidStripeBooking: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/booking-confirmation", () => ({ confirmPaidStripeBooking: mocks.confirmPaidStripeBooking }));
vi.mock("@/lib/invoice-service", () => ({ markInvoiceStatus: mocks.markInvoiceStatus, sendBillingDocument: mocks.sendBillingDocument }));
vi.mock("@/lib/deferred-deposits", () => ({
  readDepositBooking: mocks.readDepositBooking, syncDeferredDeposit: mocks.syncDeferredDeposit,
  attemptDeferredDeposit: mocks.attemptDeferredDeposit, notifyDepositAttention: mocks.notifyDepositAttention,
}));

import { POST } from "./route";

function request() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "signature" },
    body: "{}",
  });
}

function adminClient() {
  const update = vi.fn().mockReturnThis();
  const eq = vi.fn().mockResolvedValue({ error: null });
  return { from: vi.fn().mockReturnValue({ update, eq }), update, eq };
}

describe("Stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const admin = adminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn() },
    });
    mocks.markInvoiceStatus.mockResolvedValue(undefined);
    mocks.sendBillingDocument.mockResolvedValue("document-1");
    mocks.confirmPaidStripeBooking.mockResolvedValue(undefined);
    mocks.readDepositBooking.mockResolvedValue({
      id: "booking-1", stripe_hire_payment_intent_id: "pi_hire", hire_payment_status: "pending",
    });
  });

  it.each([
    ["hire", { hire_payment_status: "failed", stripe_hire_payment_intent_id: "pi_hire" }],
    ["deposit", { deposit_payment_status: "failed", stripe_deposit_payment_intent_id: "pi_deposit" }],
  ])("persists a failed %s payment", async (paymentType, updates) => {
    const admin = adminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          type: "payment_intent.payment_failed",
          data: {
            object: {
              id: paymentType === "hire" ? "pi_hire" : "pi_deposit",
              metadata: { bookingId: "booking-1", paymentType },
            },
          },
        }),
      },
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(admin.update).toHaveBeenCalledWith(expect.objectContaining(updates));
    expect(admin.eq).toHaveBeenCalledWith("id", "booking-1");
    expect(mocks.confirmPaidStripeBooking).not.toHaveBeenCalled();
  });

  it("ignores stale deferred-deposit events from a replaced intent", async () => {
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_new" });
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_old", metadata: { bookingId: "booking-1", paymentType: "deposit", deferredDeposit: "true" } } },
      }) },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.syncDeferredDeposit).not.toHaveBeenCalled();
  });

  it.each(["deferred", "immediate", "none", undefined])("ignores a delayed %s hire failure after its payment has succeeded", async (depositSchedule) => {
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_hire_payment_intent_id: "pi_hire", hire_payment_status: "paid" });
    const admin = adminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_hire", metadata: { bookingId: "booking-1", paymentType: "hire", depositSchedule } } },
    }) } });
    expect((await POST(request())).status).toBe(200);
    expect(admin.update).not.toHaveBeenCalled();
  });

  it.each(["deferred", "immediate", "none", undefined])("ignores replaced %s hire intents", async (depositSchedule) => {
    mocks.readDepositBooking.mockResolvedValue({
      id: "booking-1", stripe_hire_payment_intent_id: "pi_current", hire_payment_status: "pending",
    });
    const admin = adminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_old", metadata: { bookingId: "booking-1", paymentType: "hire", depositSchedule } } },
    }) } });
    expect((await POST(request())).status).toBe(200);
    expect(admin.update).not.toHaveBeenCalled();
    expect(mocks.sendBillingDocument).not.toHaveBeenCalled();
    expect(mocks.confirmPaidStripeBooking).not.toHaveBeenCalled();
  });

  it("retrieves current deferred-deposit state for out-of-order events", async () => {
    const current = { id: "pi_deposit", status: "requires_capture" };
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_deposit" });
    mocks.syncDeferredDeposit.mockResolvedValue("authorized");
    const retrieve = vi.fn().mockResolvedValue(current);
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_deposit", metadata: { bookingId: "booking-1", paymentType: "deposit", deferredDeposit: "true" } } },
      }) },
      paymentIntents: { retrieve },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.syncDeferredDeposit).toHaveBeenCalledWith(expect.anything(), expect.anything(), current);
    expect(mocks.sendBillingDocument).toHaveBeenCalledWith(expect.anything(), "booking-1", "deposit_authorisation");
  });

  it("attempts a due last-minute hold only after recording the paid hire", async () => {
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_hire", metadata: { bookingId: "booking-1", paymentType: "hire" } } },
    }) } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.attemptDeferredDeposit).toHaveBeenCalledWith(expect.anything(), "booking-1");
    expect(mocks.confirmPaidStripeBooking).toHaveBeenCalledWith(expect.anything(), "booking-1");
    expect(mocks.attemptDeferredDeposit.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendBillingDocument.mock.invocationCallOrder[0]);
  });

  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("confirms a paid hire from %s", async (type) => {
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type, data: { object: { payment_status: "paid", payment_intent: "pi_hire", metadata: { bookingId: "booking-1", paymentType: "hire" } } },
    }) } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.confirmPaidStripeBooking).toHaveBeenCalledWith(expect.anything(), "booking-1");
  });

  it.each([
    ["hire", "unpaid", "pi_hire"],
    ["hire", "paid", "pi_old"],
    ["deposit", "paid", "pi_deposit"],
  ])("does not confirm %s checkout with status %s and intent %s", async (paymentType, payment_status, payment_intent) => {
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type: "checkout.session.completed", data: { object: { payment_status, payment_intent, metadata: { bookingId: "booking-1", paymentType } } },
    }) } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.confirmPaidStripeBooking).not.toHaveBeenCalled();
  });

  it("returns a retryable failure if automatic confirmation fails", async () => {
    mocks.confirmPaidStripeBooking.mockRejectedValueOnce(new Error("email failed"));
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type: "payment_intent.succeeded", data: { object: { id: "pi_hire", metadata: { bookingId: "booking-1", paymentType: "hire" } } },
    }) } });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.attemptDeferredDeposit).toHaveBeenCalledWith(expect.anything(), "booking-1");
    expect(mocks.sendBillingDocument).toHaveBeenCalledWith(expect.anything(), "booking-1", "payment_receipt");
  });

  it("still confirms the paid hire if deposit processing fails", async () => {
    mocks.attemptDeferredDeposit.mockRejectedValueOnce(new Error("deposit failed"));
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type: "payment_intent.succeeded", data: { object: { id: "pi_hire", metadata: { bookingId: "booking-1", paymentType: "hire" } } },
    }) } });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.confirmPaidStripeBooking).toHaveBeenCalledWith(expect.anything(), "booking-1");
  });
});
