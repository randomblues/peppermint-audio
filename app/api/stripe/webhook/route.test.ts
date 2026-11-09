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
  sendDuePickupReminderSms: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/booking-confirmation", () => ({ confirmPaidStripeBooking: mocks.confirmPaidStripeBooking }));
vi.mock("@/lib/booking-sms-cron", () => ({ sendDuePickupReminderSms: mocks.sendDuePickupReminderSms }));
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
    mocks.sendDuePickupReminderSms.mockResolvedValue(undefined);
    mocks.readDepositBooking.mockResolvedValue({
      id: "booking-1", stripe_hire_payment_intent_id: "pi_hire", hire_payment_status: "pending",
    });
  });

  it("persists a failed hire payment", async () => {
    const admin = adminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          type: "payment_intent.payment_failed",
          data: {
            object: {
              id: "pi_hire",
              metadata: { bookingId: "booking-1", paymentType: "hire" },
            },
          },
        }),
      },
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(admin.update).toHaveBeenCalledWith(expect.objectContaining({ hire_payment_status: "failed", stripe_hire_payment_intent_id: "pi_hire" }));
    expect(admin.eq).toHaveBeenCalledWith("id", "booking-1");
    expect(mocks.confirmPaidStripeBooking).not.toHaveBeenCalled();
    expect(mocks.notifyDepositAttention).not.toHaveBeenCalled();
  });

  it.each(["requires_payment_method", "requires_action"])("notifies deposit attention using the current %s state", async status => {
    const booking = { id: "booking-1", stripe_deposit_payment_intent_id: "pi_deposit" };
    const updated = { ...booking, deposit_payment_status: status === "requires_action" ? "action_required" : "failed" };
    const current = { id: "pi_deposit", status };
    mocks.readDepositBooking.mockResolvedValueOnce(booking).mockResolvedValueOnce(updated);
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_deposit", metadata: { bookingId: booking.id, paymentType: "deposit" } } },
      }) },
      paymentIntents: { retrieve: vi.fn().mockResolvedValue(current) },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.syncDeferredDeposit).toHaveBeenCalledWith(expect.anything(), booking, current);
    expect(mocks.notifyDepositAttention).toHaveBeenCalledWith(expect.anything(), updated);
  });

  it.each(["requires_capture", "succeeded", "canceled"])("ignores an old deposit failure when its current state is %s", async status => {
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_deposit" });
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_deposit", metadata: { bookingId: "booking-1", paymentType: "deposit" } } },
      }) },
      paymentIntents: { retrieve: vi.fn().mockResolvedValue({ id: "pi_deposit", status }) },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.syncDeferredDeposit).not.toHaveBeenCalled();
    expect(mocks.notifyDepositAttention).not.toHaveBeenCalled();
  });

  it("ignores a failed non-deferred deposit intent that has been replaced", async () => {
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_new" });
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_old", metadata: { bookingId: "booking-1", paymentType: "deposit" } } },
      }) },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.syncDeferredDeposit).not.toHaveBeenCalled();
    expect(mocks.notifyDepositAttention).not.toHaveBeenCalled();
  });

  it("returns an error when the deposit notification fails so Stripe can retry", async () => {
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_deposit" });
    mocks.notifyDepositAttention.mockRejectedValueOnce(new Error("SMS unavailable"));
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_deposit", metadata: { bookingId: "booking-1", paymentType: "deposit" } } },
      }) },
      paymentIntents: { retrieve: vi.fn().mockResolvedValue({ id: "pi_deposit", status: "requires_payment_method" }) },
    });
    expect((await POST(request())).status).toBe(500);
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
    expect(mocks.sendDuePickupReminderSms).toHaveBeenCalledWith("booking-1");
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
    expect(mocks.sendDuePickupReminderSms).toHaveBeenCalledWith("booking-1");
  });

  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("confirms a paid hire from %s", async (type) => {
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
      type, data: { object: { payment_status: "paid", payment_intent: "pi_hire", metadata: { bookingId: "booking-1", paymentType: "hire" } } },
    }) } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.confirmPaidStripeBooking).toHaveBeenCalledWith(expect.anything(), "booking-1");
    expect(mocks.sendDuePickupReminderSms).toHaveBeenCalledWith("booking-1");
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

  it("returns a retryable failure if the due pickup reminder fails after deposit authorisation", async () => {
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_deposit" });
    mocks.syncDeferredDeposit.mockResolvedValue("authorized");
    mocks.sendDuePickupReminderSms.mockRejectedValueOnce(new Error("SMS unavailable"));
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.amount_capturable_updated",
        data: { object: { id: "pi_deposit", metadata: { bookingId: "booking-1", paymentType: "deposit", deferredDeposit: "true" } } },
      }) },
      paymentIntents: { retrieve: vi.fn().mockResolvedValue({ id: "pi_deposit", status: "requires_capture" }) },
    });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.sendDuePickupReminderSms).toHaveBeenCalledWith("booking-1");
  });

  it.each(["payment_intent.amount_capturable_updated", "payment_intent.succeeded"])(
      "catches up a pickup reminder after a current immediate deposit %s event", async type => {
        mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_deposit" });
        mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
          type, data: { object: { id: "pi_deposit", metadata: { bookingId: "booking-1", paymentType: "deposit" } } },
        }) } });
        expect((await POST(request())).status).toBe(200);
        expect(mocks.sendDuePickupReminderSms).toHaveBeenCalledWith("booking-1");
      },
    );

  it.each(["payment_intent.amount_capturable_updated", "payment_intent.succeeded"])(
      "does not send a pickup reminder for a replaced deposit %s event", async type => {
        mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", stripe_deposit_payment_intent_id: "pi_current" });
        mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn().mockReturnValue({
          type, data: { object: { id: "pi_old", metadata: { bookingId: "booking-1", paymentType: "deposit" } } },
        }) } });
        expect((await POST(request())).status).toBe(200);
        expect(mocks.sendDuePickupReminderSms).not.toHaveBeenCalled();
      },
    );
});
