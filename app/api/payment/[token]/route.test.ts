import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));

import { GET } from "./route";

describe("payment link route", () => {
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
