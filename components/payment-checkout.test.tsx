import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentCheckout } from "./payment-checkout";

vi.mock("@stripe/react-stripe-js", () => ({
  CardElement: () => null,
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useElements: () => null,
  useStripe: () => null,
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

describe("PaymentCheckout", () => {
  it.each(["unpaid", "paid"])("shows the white vector Stripe wordmark when hire is %s", async (hirePaymentStatus) => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customerName: "Logo Test", email: "logo@example.com", eventType: "Party",
        pickupDate: "2026-10-09", dropoffDate: "2026-10-10",
        hireLineItems: [],
        hireAmountCents: 10000, securityDepositCents: 10000,
        hirePaymentStatus, depositPaymentStatus: "authorized",
        hireClientSecret: null, depositClientSecret: null,
      }),
    }));

    render(<PaymentCheckout token="logo-test" />);

    const mark = await screen.findByLabelText("Powered by Stripe");
    expect(mark).toHaveTextContent("Powered by");
    const wordmark = mark.querySelector("svg");
    expect(wordmark).toHaveAttribute("viewBox", "0 0 512 214");
    expect(wordmark).toHaveAttribute("aria-hidden", "true");
    expect(wordmark).toHaveAttribute("focusable", "false");
    expect(wordmark).toHaveClass("fill-white", "shrink-0");
    expect(wordmark?.querySelector("path")).toBeInTheDocument();
    expect(mark.querySelector("strong")).not.toBeInTheDocument();
  });

  it("shows full-period item totals consistent with the multi-night payment amount", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customerName: "Pricing Test", email: "pricing@example.com", eventType: "Party",
        pickupDate: "2026-10-09", dropoffDate: "2026-10-12",
        hireLineItems: [{ id: "speaker", kind: "equipment", name: "Test speaker", quantity: 2, unitPriceCents: 5500 }],
        hireAmountCents: 22000, securityDepositCents: 10000,
        hirePaymentStatus: "paid", depositPaymentStatus: "authorized",
        hireClientSecret: null, depositClientSecret: null,
      }),
    }));
    render(<PaymentCheckout token="pricing-test" />);
    expect(await screen.findByText(/3 nights.*additional nights half price/)).toBeInTheDocument();
    expect(screen.getAllByText("$220.00")).toHaveLength(2);
    expect(screen.getByText("$320.00")).toBeInTheDocument();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses concise wording after a hire payment completes", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_live_test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customerName: "Stripe Live Test",
        email: "test@example.com",
        eventType: "Test hire",
        pickupDate: "2026-10-06",
        dropoffDate: "2026-10-06",
        hireLineItems: [{
          id: "equipment:bose-s1-pro:Single speaker",
          kind: "equipment",
          catalogKey: "equipment:bose-s1-pro:Single speaker",
          name: "Bose S1 Pro PA Speaker",
          option: "Single speaker",
          quantity: 1,
          unitPriceCents: 100,
        }],
        hireAmountCents: 100,
        securityDepositCents: 100,
        hirePaymentStatus: "paid",
        depositPaymentStatus: "authorized",
        hireClientSecret: null,
        depositClientSecret: null,
      }),
    }));

    render(<PaymentCheckout token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText("Payment complete. Your hire payment is complete and your refundable security deposit has been authorised.")).toBeInTheDocument();
    });
    expect(screen.getByText("Hire summary")).toBeInTheDocument();
    expect(screen.getByText(/Bose S1 Pro PA Speaker/)).toBeInTheDocument();
    const depositDisclosure = screen.getByText("How your deposit works").closest("details");
    expect(depositDisclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("How your deposit works").closest("summary")!);
    expect(depositDisclosure).toHaveAttribute("open");
    expect(screen.getByText(/temporary card authorisation/i)).toBeInTheDocument();
    expect(screen.getByText(/The deposit only covers matters set out in the hire terms/)).toBeInTheDocument();
    expect(screen.queryByText(/excessive cleaning/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Powered by Stripe")).toBeInTheDocument();
    expect(screen.queryByText(/captured without being captured/i)).not.toBeInTheDocument();
  });
});
