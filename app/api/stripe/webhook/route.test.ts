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
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
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

  it.each(["deferred", "immediate"])("ignores a delayed %s hire failure after its payment has succeeded", async (depositSchedule) => {
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
    expect(mocks.attemptDeferredDeposit.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendBillingDocument.mock.invocationCallOrder[0]);
  });
});
