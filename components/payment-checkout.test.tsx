import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentCheckout } from "./payment-checkout";

const stripe = vi.hoisted(() => ({
  createPaymentMethod: vi.fn(), confirmCardPayment: vi.fn(), clear: vi.fn(),
}));
vi.mock("@stripe/react-stripe-js", () => ({
  CardElement: () => null,
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useElements: () => ({ getElement: () => ({ clear: stripe.clear }) }),
  useStripe: () => stripe,
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

describe("PaymentCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripe.createPaymentMethod.mockResolvedValue({ paymentMethod: { id: "pm_test" } });
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: "succeeded" } });
  });

  const scheduled = {
    customerName: "Test Customer", email: "test@example.com", eventType: "Party",
    pickupDate: "2026-11-09", dropoffDate: "2026-11-12",
    hireLineItems: [{ id: "speaker", kind: "equipment", name: "Test speaker", quantity: 1, unitPriceCents: 5500 }],
    hireAmountCents: 11000, securityDepositCents: 10000,
    hirePaymentStatus: "pending", depositPaymentStatus: "scheduled",
    depositHoldDate: "2026-11-08", depositConsentRecorded: false,
    hireClientSecret: "hire_secret", depositClientSecret: null,
  };

  it("requires consent, records it, charges only hire and leaves the deposit scheduled", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => scheduled })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    render(<PaymentCheckout token="advance-token" />);
    const pay = await screen.findByRole("button", { name: "Pay $110.00" });
    expect(pay).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(pay).toBeEnabled();
    fireEvent.click(pay);
    expect(await screen.findByText(/hold is scheduled before pickup; it has not been authorised yet/)).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith("/api/payment/advance-token", expect.objectContaining({ method: "POST", body: '{"consent":true}' }));
    expect(stripe.confirmCardPayment).toHaveBeenCalledTimes(1);
    expect(stripe.confirmCardPayment).toHaveBeenCalledWith("hire_secret", { payment_method: "pm_test" });
  });

  it("does not charge when consent persistence fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => scheduled })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Consent could not be saved." }) }));
    render(<PaymentCheckout token="token" />);
    await screen.findByRole("checkbox");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Pay $110.00" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Consent could not be saved");
    expect(stripe.confirmCardPayment).not.toHaveBeenCalled();
  });

  it("authenticates only the deposit during recovery without charging hire again", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({
      ...scheduled, hirePaymentStatus: "paid", depositPaymentStatus: "action_required",
      depositConsentRecorded: true, hireClientSecret: null, depositClientSecret: "deposit_secret",
    }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: "authorized" }) }));
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: "requires_capture" } });
    render(<PaymentCheckout token="token" />);
    fireEvent.click(await screen.findByRole("button", { name: "Authorise $100.00 deposit hold" }));
    await screen.findByText(/deposit has been authorised/);
    expect(stripe.confirmCardPayment).toHaveBeenCalledTimes(1);
    expect(stripe.confirmCardPayment).toHaveBeenCalledWith("deposit_secret", { payment_method: "pm_test" });
  });
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
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("$320.00")).not.toBeInTheDocument();
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
