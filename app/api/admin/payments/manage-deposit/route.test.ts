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

const request = (action: string, amount: unknown = "10") => new Request("http://localhost/api/admin/payments/manage-deposit", {
  method: "POST", body: JSON.stringify({ bookingId: "booking-1", action, amount }),
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
  it("rejects unauthenticated deposit actions before calling Stripe", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    expect((await POST(request("capture"))).status).toBe(401);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

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

  it.each(["0", "-1", "100.01", "1.001", "invalid", null])("rejects invalid or excessive capture amount %s", async amount => {
    expect((await POST(request("capture", amount))).status).toBe(400);
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.document).not.toHaveBeenCalled();
  });

  it.each([["0.01", 1], ["25", 2500], ["100", 10000]])("captures exactly %s dollars and sends a capture document", async (amount, cents) => {
    expect((await POST(request("capture", amount))).status).toBe(200);
    expect(mocks.capture).toHaveBeenCalledWith("pi_deposit", { amount_to_capture: cents });
    expect(mocks.document).toHaveBeenCalledWith(expect.anything(), "booking-1", "deposit_capture");
  });

  it("surfaces a provider failure without sending a success document", async () => {
    mocks.capture.mockRejectedValueOnce(new Error("Stripe unavailable"));
    const response = await POST(request("capture"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Stripe unavailable" });
    expect(mocks.document).not.toHaveBeenCalled();
  });

  it("does not report success when the capture document fails", async () => {
    mocks.document.mockRejectedValueOnce(new Error("Receipt delivery failed"));
    const response = await POST(request("capture"));
    expect(response.status).toBe(502);
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ error: "Receipt delivery failed" });
  });
});
