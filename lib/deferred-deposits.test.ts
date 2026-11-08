import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), confirm: vi.fn(), retrieve: vi.fn(), cancel: vi.fn(),
  send: vi.fn(), record: vi.fn(),
  updateIntent: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({
  paymentIntents: { create: mocks.create, confirm: mocks.confirm, retrieve: mocks.retrieve, cancel: mocks.cancel, update: mocks.updateIntent },
}) }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail: mocks.record }));

import { attemptDeferredDeposit, notifyDepositAttention, releaseCancelledDeferredDeposit, syncDeferredDeposit, type DeferredDepositBooking } from "./deferred-deposits";

const now = new Date("2026-10-09T20:00:00Z"); // 7am on 10 October in Melbourne.
let booking: DeferredDepositBooking;
let update: ReturnType<typeof vi.fn>;

function admin(failWrites = false) {
  let updates: object | null = null;
  let filters: [string, unknown][] = [];
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
    is: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
    maybeSingle: vi.fn(async () => {
      const matches = filters.every(([key, value]) => booking[key as keyof DeferredDepositBooking] === value);
      filters = [];
      if (updates) {
        const values = updates;
        updates = null;
        if (failWrites || !matches) return { data: null, error: null };
        Object.assign(booking, values);
        return { data: { id: booking.id }, error: null };
      }
      return { data: matches ? { ...booking } : null, error: null };
    }),
    update: vi.fn((values: object) => {
      updates = values;
      update(values);
      return query;
    }),
    then: (resolve: (value: object) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  return { from: vi.fn(() => query) } as never;
}

function intent(status = "requires_capture", overrides: object = {}) {
  return {
    id: "pi_deposit", status, amount_received: 0, amount: 10000, currency: "aud", customer: "cus_1",
    metadata: { bookingId: "booking-1", paymentType: "deposit", deferredDeposit: "true" },
    latest_charge: { payment_method_details: { card: { capture_before: Date.parse("2026-10-14T00:00:00Z") / 1000 } } },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  update = vi.fn();
  booking = {
    id: "booking-1", status: "confirmed", first_name: "<Alex>", email: "alex@example.com",
    pickup_date: "2026-10-10", dropoff_date: "2026-10-13", dropoff_time: "18:00",
    payment_method: "stripe_card_hold", hire_payment_status: "paid", security_deposit_cents: 10000,
    stripe_customer_id: "cus_1", stripe_hire_payment_intent_id: "pi_hire", stripe_deposit_payment_intent_id: null,
    deposit_hold_date: "2026-10-10", deposit_consent_at: "2026-09-01T00:00:00Z",
    deposit_payment_status: "scheduled", deposit_capture_before: null, deposit_error: null,
    deposit_attention_sent_at: null, deposit_attention_claimed_at: null, payment_token: "secure-token",
  };
  mocks.retrieve.mockResolvedValue({
    id: "pi_hire", status: "succeeded", customer: "cus_1", payment_method: "pm_saved",
    metadata: { bookingId: "booking-1" },
  });
  mocks.create.mockResolvedValue(intent("requires_confirmation"));
  mocks.confirm.mockResolvedValue(intent());
  mocks.cancel.mockResolvedValue(intent("canceled"));
  mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
  mocks.record.mockResolvedValue(undefined);
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ENQUIRY_FROM_EMAIL", "from@example.com");
  vi.stubEnv("ENQUIRY_TO_EMAIL", "admin@example.com");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
});

describe("deferred deposit holds", () => {
  it("does not hold a card a month early", async () => {
    booking.pickup_date = "2026-11-10";
    booking.dropoff_date = "2026-11-13";
    booking.deposit_hold_date = "2026-11-10";
    await attemptDeferredDeposit(admin(), booking.id, now);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("uses the saved hire card, persists first, confirms off-session and checks actual expiry", async () => {
    expect(await attemptDeferredDeposit(admin(), booking.id, now)).toBe("authorized");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 10000, customer: "cus_1", payment_method: "pm_saved", capture_method: "manual",
    }), { idempotencyKey: "deposit-create-pi_hire" });
    expect(mocks.confirm).toHaveBeenCalledWith("pi_deposit", { off_session: true, expand: ["latest_charge"] },
      { idempotencyKey: "deposit-confirm-pi_deposit" });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(mocks.confirm.mock.invocationCallOrder[0]);
    expect(booking.deposit_capture_before).toBe("2026-10-14T00:00:00.000Z");
    await attemptDeferredDeposit(admin(), booking.id, now);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });

  it("resumes an existing intent without creating another hold", async () => {
    booking.stripe_deposit_payment_intent_id = "pi_deposit";
    booking.deposit_payment_status = "authorizing";
    mocks.retrieve.mockResolvedValue(intent("requires_confirmation"));
    await attemptDeferredDeposit(admin(), booking.id, now);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });

  it("does not confirm a hold if its booking changed before intent persistence", async () => {
    await expect(attemptDeferredDeposit(admin(true), booking.id, now)).rejects.toThrow("booking changed");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("never confirms an existing intent with the wrong amount or customer", async () => {
    booking.stripe_deposit_payment_intent_id = "pi_deposit";
    mocks.retrieve.mockResolvedValue(intent("requires_confirmation", { amount: 50000 }));
    await expect(attemptDeferredDeposit(admin(), booking.id, now)).rejects.toThrow("does not match");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it.each(["cancelled", "completed"])("does not create holds for %s bookings", async status => {
    booking.status = status;
    await attemptDeferredDeposit(admin(), booking.id, now);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("releases an active deferred hold when the admin cancels its booking", async () => {
    booking.status = "cancelled";
    booking.stripe_deposit_payment_intent_id = "pi_deposit";
    mocks.retrieve.mockResolvedValue(intent());
    await releaseCancelledDeferredDeposit(admin(), booking.id);
    expect(mocks.updateIntent).toHaveBeenCalledWith("pi_deposit", { metadata: { releaseRequested: "true" } });
    expect(mocks.cancel).toHaveBeenCalledWith("pi_deposit");
    expect(booking.deposit_payment_status).toBe("released");
  });

  it("requires paid hire and recorded card-saving consent", async () => {
    booking.hire_payment_status = "pending";
    await attemptDeferredDeposit(admin(), booking.id, now);
    expect(mocks.create).not.toHaveBeenCalled();
    booking.hire_payment_status = "paid";
    booking.deposit_consent_at = null;
    await expect(attemptDeferredDeposit(admin(), booking.id, now)).rejects.toThrow("consent");
  });

  it("rejects four-night hires even if they have a stale scheduled record", async () => {
    booking.dropoff_date = "2026-10-14";
    await expect(attemptDeferredDeposit(admin(), booking.id, now)).rejects.toThrow("not eligible");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("allows same-day pickup payment to place the hold immediately", async () => {
    booking.pickup_date = "2026-10-09";
    booking.dropoff_date = "2026-10-10";
    booking.deposit_hold_date = "2026-10-09";
    expect(await attemptDeferredDeposit(admin(), booking.id, new Date("2026-10-08T20:00:00Z"))).toBe("authorized");
  });

  it("does not silently place a missed hold after pickup", async () => {
    booking.pickup_date = "2026-10-08";
    booking.deposit_hold_date = "2026-10-08";
    await attemptDeferredDeposit(admin(), booking.id, now);
    expect(booking.deposit_payment_status).toBe("expired");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("waits until 7am Melbourne time before attempting a scheduled hold", async () => {
    const beforeSeven = new Date("2026-10-09T19:00:00Z"); // 6am on the pickup date in Melbourne.
    await attemptDeferredDeposit(admin(), booking.id, beforeSeven);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(booking.deposit_payment_status).toBe("scheduled");
  });

  it.each([null, { payment_method_details: { card: { capture_before: Date.parse("2026-10-11T00:00:00Z") / 1000 } } }])("cancels missing or insufficient expiry rather than claiming a secured deposit", async latest_charge => {
    const status = await syncDeferredDeposit(admin(), booking, intent("requires_capture", { latest_charge }));
    expect(status).toBe("hold_too_short");
    expect(mocks.cancel).toHaveBeenCalledWith("pi_deposit");
    expect(booking.deposit_error).toContain("alternative deposit");
  });

  it("surfaces authentication requirements after a Stripe confirmation error", async () => {
    const error = Object.assign(new Error("authentication required"), { payment_intent: { id: "pi_deposit" } });
    mocks.confirm.mockRejectedValue(error);
    mocks.retrieve.mockResolvedValueOnce({
      id: "pi_hire", status: "succeeded", customer: "cus_1", payment_method: "pm_saved", metadata: { bookingId: booking.id },
    }).mockResolvedValueOnce(intent("requires_action"));
    expect(await attemptDeferredDeposit(admin(), booking.id, now)).toBe("action_required");
  });

  it("does not hide provider outages as card declines", async () => {
    mocks.confirm.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(attemptDeferredDeposit(admin(), booking.id, now)).rejects.toThrow("Stripe unavailable");
    expect(booking.stripe_deposit_payment_intent_id).toBe("pi_deposit");
  });

  it("preserves the Stripe decline code for safe customer guidance", async () => {
    const status = await syncDeferredDeposit(admin(), booking, intent("requires_payment_method", {
      last_payment_error: { decline_code: "insufficient_funds", message: "Your card has insufficient funds." },
    }));
    expect(status).toBe("failed");
    expect(booking.deposit_error).toBe("[decline_code: insufficient_funds] Your card has insufficient funds.");
  });

  it("distinguishes an expired hold from an intentional release", async () => {
    expect(await syncDeferredDeposit(admin(), booking, intent("canceled"))).toBe("expired");
    expect(await syncDeferredDeposit(admin(), booking, intent("canceled", {
      metadata: { bookingId: booking.id, paymentType: "deposit", releaseRequested: "true" },
    }))).toBe("released");
  });

  it("sends escaped customer recovery copy and a separate admin alert only once", async () => {
    booking.deposit_payment_status = "action_required";
    booking.deposit_error = "internal diagnosis";
    await notifyDepositAttention(admin(), booking);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    const internal = mocks.send.mock.calls[0][0];
    const customer = mocks.send.mock.calls[1][0];
    expect(internal.subject).toContain("Urgent");
    expect(internal.html).toContain("Deposit hold failed");
    expect(internal.html).toContain("background:#16251f");
    expect(internal.html).toContain("internal diagnosis");
    expect(internal.text).toContain("Do not release equipment");
    expect(customer.subject).toContain("Action required before pickup");
    expect(customer.html).toContain("&lt;Alex&gt;");
    expect(customer.html).toContain("https://example.com/pay/secure-token");
    expect(customer.html).toContain("background:#16251f");
    expect(customer.html).toContain("background:#fff0f0");
    expect(customer.html).toContain("color:#8f1d1d");
    expect(customer.html).toContain("booking will not go ahead");
    expect(customer.html).not.toContain("internal diagnosis");
    expect(customer.text).toContain("Your hire payment has been received");
    expect(customer.text).toContain("additional verification step");
    expect(customer.text).toContain("booking will not go ahead");
    await notifyDepositAttention(admin(), booking);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("asks the customer to contact the business when there is no payment link", async () => {
    booking.deposit_payment_status = "hold_too_short";
    booking.payment_token = null;
    await notifyDepositAttention(admin(), booking);
    const customer = mocks.send.mock.calls[1][0];
    expect(customer.text).toContain("call 0452 316 823");
    expect(customer.text).toContain("booking will not go ahead");
    expect(customer.text).not.toContain("/pay/");
  });

  it.each([
    ["insufficient_funds", "due to insufficient funds"],
    ["expired_card", "The saved card appears to have expired"],
    ["incorrect_cvc", "could not verify the card's security code"],
    ["card_not_supported", "cannot be used for the $100.00 security-deposit hold"],
    ["generic_decline", "Your bank did not approve the $100.00 security-deposit hold"],
    ["processing_error", "could not process the $100.00 security-deposit hold just now"],
  ])("uses customer-friendly wording for %s", async (declineCode, message) => {
    booking.deposit_payment_status = "failed";
    booking.deposit_error = `[decline_code: ${declineCode}] Raw provider diagnostic`;
    await notifyDepositAttention(admin(), booking);
    const customer = mocks.send.mock.calls[1][0];
    expect(customer.text).toContain(message);
    expect(customer.text).not.toContain(declineCode);
    expect(customer.text).not.toContain("Raw provider diagnostic");
  });

  it("sends and records only one customer alert when cron and webhook race", async () => {
    booking.deposit_payment_status = "failed";
    const sharedAdmin = admin();
    const staleBooking = { ...booking };
    await Promise.all([
      notifyDepositAttention(sharedAdmin, staleBooking),
      notifyDepositAttention(sharedAdmin, staleBooking),
    ]);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(booking.deposit_attention_sent_at).not.toBeNull();
    expect(booking.deposit_attention_claimed_at).toBeNull();
  });

  it("reclaims a notification claim left by a terminated job", async () => {
    booking.deposit_payment_status = "failed";
    booking.deposit_attention_claimed_at = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    await notifyDepositAttention(admin(), booking);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(booking.deposit_attention_sent_at).not.toBeNull();
    expect(booking.deposit_attention_claimed_at).toBeNull();
  });

  it("does not mark unsuccessful email delivery as notified", async () => {
    booking.deposit_payment_status = "failed";
    mocks.send.mockResolvedValue({ error: { message: "Email unavailable" } });
    await expect(notifyDepositAttention(admin(), booking)).rejects.toThrow("Email unavailable");
    expect(booking.deposit_attention_sent_at).toBeNull();
    expect(booking.deposit_attention_claimed_at).toBeNull();
  });
});
