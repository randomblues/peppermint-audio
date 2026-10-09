import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getStripe: vi.fn(),
  readDepositBooking: vi.fn(),
  syncDeferredDeposit: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/deferred-deposits", () => ({ readDepositBooking: mocks.readDepositBooking, syncDeferredDeposit: mocks.syncDeferredDeposit }));

import { GET, POST } from "./route";

describe("payment link route", () => {
  it("does not claim a recovered hold is secured until its actual expiry has been checked", async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {
        id: "booking-1", status: "confirmed", payment_method: "stripe_card_hold",
        deposit_hold_date: "2026-11-08", payment_token_expires_at: "2099-01-01T00:00:00Z",
      }, error: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });
    mocks.readDepositBooking.mockResolvedValue({ id: "booking-1", deposit_consent_at: "2026-10-01", stripe_deposit_payment_intent_id: "pi_deposit" });
    const intent = { id: "pi_deposit" };
    mocks.getStripe.mockReturnValue({ paymentIntents: { retrieve: vi.fn().mockResolvedValue(intent) } });
    mocks.syncDeferredDeposit.mockResolvedValue("hold_too_short");
    const response = await POST(new Request("http://localhost/api/payment/token", {
      method: "POST", body: JSON.stringify({ verifyDeposit: true }),
    }), { params: Promise.resolve({ token: "token" }) });
    expect(response.status).toBe(409);
    expect(mocks.syncDeferredDeposit).toHaveBeenCalledWith(expect.anything(), expect.anything(), intent);
    expect((await response.json()).error).toContain("could not be secured");
  });
  it("requires explicit true consent before touching persistence", async () => {
    const response = await POST(new Request("http://localhost/api/payment/token", {
      method: "POST", body: JSON.stringify({ consent: false }),
    }), { params: Promise.resolve({ token: "token" }) });
    expect(response.status).toBe(400);
  });

  it("records consent only for a valid active deferred-payment link", async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {
        id: "booking-1", status: "submitted", payment_method: "stripe_card_hold",
        deposit_hold_date: "2026-11-08", payment_token_expires_at: "2099-01-01T00:00:00Z",
      }, error: null }),
    };
    const write = {
      update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      then: (resolve: (value: object) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValueOnce(query).mockReturnValueOnce(write) });
    const response = await POST(new Request("http://localhost/api/payment/token", {
      method: "POST", body: JSON.stringify({ consent: true }),
    }), { params: Promise.resolve({ token: "token" }) });
    expect(response.status).toBe(200);
    expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ deposit_consent_at: expect.any(String) }));
    expect(write.eq).toHaveBeenCalledWith("payment_token", "token");
  });
  it("returns the canonical hire line items for the payment page", async () => {
    const booking = {
      id: "booking-1",
      first_name: "Alex",
      last_name: "Customer",
      email: "alex@example.com",
      pickup_date: "2026-10-10",
      dropoff_date: "2026-10-11",
      event_type: "Party",
      hire_line_items: [{
        id: "equipment:bose-s1-pro:Single speaker",
        kind: "equipment",
        catalogKey: "equipment:bose-s1-pro:Single speaker",
        name: "Bose S1 Pro PA Speaker",
        option: "Single speaker",
        quantity: 1,
        unitPriceCents: 5500,
      }],
      hire_amount_cents: 5500,
      security_deposit_cents: 10000,
      payment_method: "stripe_card_hold",
      hire_payment_status: "pending",
      deposit_payment_status: "pending",
      stripe_hire_payment_intent_id: "hire-intent",
      stripe_deposit_payment_intent_id: "deposit-intent",
      payment_token_expires_at: "2099-01-01T00:00:00.000Z",
    };
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: booking, error: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    mocks.getStripe.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn()
          .mockResolvedValueOnce({ metadata: { bookingId: "booking-1" }, status: "requires_payment_method", client_secret: "hire-secret" })
          .mockResolvedValueOnce({ metadata: { bookingId: "booking-1" }, status: "requires_capture", client_secret: "deposit-secret" }),
      },
    });

    const response = await GET(new Request("http://localhost/api/payment/token"), { params: Promise.resolve({ token: "token" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.hireLineItems).toEqual([expect.objectContaining({
      name: "Bose S1 Pro PA Speaker",
      option: "Single speaker",
      unitPriceCents: 5500,
    })]);
    expect(payload.hireAmountCents).toBe(5500);
  });
});
