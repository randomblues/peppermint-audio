import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), updateIntent: vi.fn(), cancel: vi.fn(), capture: vi.fn(), document: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({
  paymentIntents: { update: mocks.updateIntent, cancel: mocks.cancel, capture: mocks.capture },
}) }));
vi.mock("@/lib/invoice-service", () => ({ sendBillingDocument: mocks.document, markInvoiceStatus: vi.fn() }));

import { POST } from "./route";

const request = (action: string) => new Request("http://localhost/api/admin/payments/manage-deposit", {
  method: "POST", body: JSON.stringify({ bookingId: "booking-1", action, amount: "10" }),
});

function session(captureBefore: string | null = null) {
  const read = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {
      security_deposit_cents: 10000, stripe_deposit_payment_intent_id: "pi_deposit",
      deposit_payment_status: "authorized", payment_method: "stripe_card_hold",
      deposit_hold_date: "2026-11-08", deposit_capture_before: captureBefore,
    }, error: null }),
  };
  const write = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
  return { admin: { from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(write) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(session());
  mocks.document.mockResolvedValue("email-1");
});

describe("deferred-deposit admin actions", () => {
  it("marks an intentional release before cancelling so the webhook cannot call it an expiry", async () => {
    expect((await POST(request("release"))).status).toBe(200);
    expect(mocks.updateIntent).toHaveBeenCalledWith("pi_deposit", { metadata: { releaseRequested: "true" } });
    expect(mocks.updateIntent.mock.invocationCallOrder[0]).toBeLessThan(mocks.cancel.mock.invocationCallOrder[0]);
  });

  it("rejects capture after the recorded hold expiry without calling Stripe", async () => {
    mocks.requireAdmin.mockResolvedValue(session("2020-01-01T00:00:00Z"));
    expect((await POST(request("capture"))).status).toBe(409);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
