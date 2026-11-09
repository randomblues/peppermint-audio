import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), attempt: vi.fn(), read: vi.fn(), sync: vi.fn(), notify: vi.fn(), retrieve: vi.fn(), document: vi.fn(), pickupSms: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/deferred-deposits", () => ({
  attemptDeferredDeposit: mocks.attempt, readDepositBooking: mocks.read,
  syncDeferredDeposit: mocks.sync, notifyDepositAttention: mocks.notify,
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ paymentIntents: { retrieve: mocks.retrieve } }) }));
vi.mock("@/lib/invoice-service", () => ({ sendBillingDocument: mocks.document }));
vi.mock("@/lib/booking-sms-cron", () => ({ sendDuePickupReminderSms: mocks.pickupSms }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date("2026-11-08T20:00:00Z")); // 7am in Melbourne during daylight saving.
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
    then: (resolve: (value: object) => unknown) => Promise.resolve({ data: [{ id: "booking-1" }], error: null }).then(resolve),
  };
  mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
  mocks.attempt.mockResolvedValue("authorized");
  mocks.read.mockResolvedValue({ id: "booking-1", deposit_payment_status: "authorized", stripe_deposit_payment_intent_id: "pi_deposit" });
  mocks.sync.mockResolvedValue("authorized");
  mocks.pickupSms.mockResolvedValue(undefined);
});

describe("deposit-hold cron", () => {
  it("denies unauthorized requests before querying bookings", async () => {
    expect((await GET(new Request("http://localhost/api/cron/deposit-holds"))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("processes the single UTC trigger at 6am Melbourne time during standard time", async () => {
    vi.setSystemTime(new Date("2026-05-08T20:00:00Z"));
    const response = await GET(new Request("http://localhost/api/cron/deposit-holds", { headers: { authorization: "Bearer test-cron-secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.attempt).toHaveBeenCalledWith(expect.anything(), "booking-1", expect.any(Date));
    expect(mocks.admin).toHaveBeenCalledOnce();
  });

  it("attempts due holds, verifies actual expiry and sends the authorisation document", async () => {
    const response = await GET(new Request("http://localhost/api/cron/deposit-holds", { headers: { authorization: "Bearer test-cron-secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.attempt).toHaveBeenCalledWith(expect.anything(), "booking-1", expect.any(Date));
    expect(mocks.retrieve).toHaveBeenCalledWith("pi_deposit", { expand: ["latest_charge"] });
    expect(mocks.document).toHaveBeenCalledWith(expect.anything(), "booking-1", "deposit_authorisation");
    expect(mocks.pickupSms).toHaveBeenCalledWith("booking-1");
  });

  it("returns a failure rather than a success-shaped cron result when a hold fails operationally", async () => {
    mocks.attempt.mockRejectedValue(new Error("Stripe unavailable"));
    const response = await GET(new Request("http://localhost/api/cron/deposit-holds", { headers: { authorization: "Bearer test-cron-secret" } }));
    expect(response.status).toBe(502);
    expect((await response.json()).failures).toEqual([{ id: "booking-1", error: "Stripe unavailable" }]);
  });

  it("reports pickup notification errors without changing the saved deposit state", async () => {
    mocks.pickupSms.mockRejectedValueOnce(new Error("Pickup SMS unavailable"));
    const response = await GET(new Request("http://localhost/api/cron/deposit-holds", { headers: { authorization: ["Bearer", "test-cron-secret"].join(" ") } }));
    expect(response.status).toBe(502);
    expect((await response.json()).failures).toEqual([{ id: "booking-1", error: "Pickup SMS unavailable" }]);
  });
});
