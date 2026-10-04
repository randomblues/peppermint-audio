import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getStripe: vi.fn(),
  markInvoiceStatus: vi.fn(),
  sendBillingDocument: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/invoice-service", () => ({ markInvoiceStatus: mocks.markInvoiceStatus, sendBillingDocument: mocks.sendBillingDocument }));

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
});
