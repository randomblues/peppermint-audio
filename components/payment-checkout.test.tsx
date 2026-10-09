import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentCheckout } from "./payment-checkout";
import { depositHoldDate, melbourneDateKey } from "@/lib/payment-flow";

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
    pickupDate: "2099-11-09", dropoffDate: "2099-11-12",
    hireLineItems: [{ id: "speaker", kind: "equipment", name: "Test speaker", quantity: 1, unitPriceCents: 5500 }],
    hireAmountCents: 11000, securityDepositCents: 10000,
    hirePaymentStatus: "pending", depositPaymentStatus: "scheduled",
    depositHoldDate: "2099-11-08", depositConsentRecorded: false,
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
    expect(screen.getByRole("heading", { level: 1, name: "Pay for your hire" })).toBeInTheDocument();
    const hireRow = screen.getByText("Hire subtotal").parentElement?.parentElement;
    const securityDepositRow = screen.getByText("Refundable security deposit").parentElement?.parentElement;
    const totalRow = screen.getByText("Total due today").parentElement;
    expect(hireRow?.nextElementSibling).toBe(totalRow);
    expect(totalRow?.nextElementSibling).toBe(securityDepositRow);
    expect(securityDepositRow).toHaveClass("text-xs", "text-muted-foreground", "border-dashed", "pt-3");
    expect(securityDepositRow).not.toHaveClass("border", "bg-primary/[0.04]", "rounded-xl");
    expect(securityDepositRow).toHaveTextContent("$100.00");
    expect(hireRow).toHaveTextContent("$110.00");
    expect(screen.queryByText("Paid", { exact: true })).not.toBeInTheDocument();
    expect(securityDepositRow).toHaveTextContent("Card hold scheduled before pickup");
    expect(totalRow?.lastElementChild).toHaveClass("font-bold");
    expect(screen.queryByText(/^Hold date:/)).not.toBeInTheDocument();
    expect(screen.getByText("Total due today").parentElement?.parentElement?.nextElementSibling).toBeNull();
    expect(screen.getByRole("heading", { name: "How your security deposit works" })).toBeInTheDocument();
    expect(screen.getByText("Your $100.00 security deposit is a temporary card authorisation scheduled for 8 November 2099.")).toBeInTheDocument();
    expect(screen.getByText("Your $100.00 security deposit is a temporary card authorisation scheduled for 8 November 2099.").textContent).toContain("8\u00a0November\u00a02099");
    expect(screen.queryByText(/\b(?<!security )deposit\b/i)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox").parentElement).toHaveTextContent(
      /security deposit hold on 8 November 2099 \(one day before pickup\)\. The hold is released after return unless charges apply under the hire terms\./,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(pay).toBeEnabled();
    fireEvent.click(pay);
    expect(await screen.findByText(/hold is scheduled before pickup; it has not been authorised yet/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Payment received" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pay for your hire" })).not.toBeInTheDocument();
    expect(screen.queryByText("Card details")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("has not been authorised yet");
    expect(screen.queryByText("Your booking will be confirmed soon.")).not.toBeInTheDocument();
    expect(screen.queryByText("Your hire is confirmed separately by Peppermint Audio.")).not.toBeInTheDocument();
    const receipt = screen.getByText("View hire summary").closest("details");
    expect(receipt).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("View hire summary"));
    expect(receipt).toHaveAttribute("open");
    expect(screen.getByText("Hire payment received").parentElement).toHaveTextContent("$110.00");
    expect(screen.queryByText("Paid", { exact: true })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith("/api/payment/advance-token", expect.objectContaining({ method: "POST", body: '{"consent":true}' }));
    expect(stripe.confirmCardPayment).toHaveBeenCalledTimes(1);
    expect(stripe.confirmCardPayment).toHaveBeenCalledWith("hire_secret", { payment_method: "pm_test" });
    expect(screen.queryByText("Total due today")).not.toBeInTheDocument();
    expect(screen.queryByText(/scheduled for.*one day before pickup/)).not.toBeInTheDocument();
  });

  it.each([
    ["pending", 10000, "Temporary card hold"],
    ["scheduled", 10000, "Card hold scheduled before pickup"],
    ["authorizing", 10000, "Card hold scheduled before pickup"],
    ["authorized", 10000, "Card hold authorised"],
    ["released", 10000, "Card hold released"],
    ["captured", 10000, "Captured"],
    ["not_required", 0, "Not required"],
  ])("shows accurate secondary security deposit wording for %s", async (depositPaymentStatus, securityDepositCents, label) => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...scheduled, depositPaymentStatus, securityDepositCents }),
    }));
    render(<PaymentCheckout token="status-token" />);
    const status = await screen.findByText(label, { exact: true });
    const footer = status.parentElement?.parentElement;
    expect(footer).toHaveClass("text-xs", "text-muted-foreground", "border-dashed");
    expect(footer).toHaveTextContent("Refundable security deposit");
    expect(footer).toHaveTextContent(securityDepositCents ? "$100.00" : "$0.00");
    expect(footer?.previousElementSibling).toHaveTextContent("Total due today");
  });

  it.each([
    ["authorized", 10000],
    ["scheduled", 10000],
    ["authorizing", 10000],
    ["released", 10000],
    ["captured", 10000],
    ["not_required", 0],
  ])("opens the confirmation screen for a completed %s payment without card entry", async (depositPaymentStatus, securityDepositCents) => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...scheduled, hirePaymentStatus: "paid", depositPaymentStatus, securityDepositCents }),
    }));
    render(<PaymentCheckout token="completed-token" />);
    expect(await screen.findByRole("heading", { name: "Payment received", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Card details")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay|Authorise/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to homepage" })).not.toBeInTheDocument();
    expect(screen.getByText("Hire payment received").parentElement).toHaveTextContent("$110.00");
    expect(screen.queryByText("Total due today")).not.toBeInTheDocument();
    expect(screen.queryByText("Hire subtotal")).not.toBeInTheDocument();
    expect(stripe.confirmCardPayment).not.toHaveBeenCalled();
  });

  it("charges hire and authorises the deposit together for last-minute pickup", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    const today = melbourneDateKey();
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const immediate = {
      ...scheduled,
      pickupDate: today,
      dropoffDate: tomorrow,
      hireClientSecret: "hire_secret",
      depositClientSecret: "deposit_secret",
      depositHoldDate: depositHoldDate(today),
      depositPaymentStatus: "pending",
    };
    const fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => immediate,
    }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: "authorized" }) });
    vi.stubGlobal("fetch", fetch);
    stripe.confirmCardPayment.mockResolvedValueOnce({ paymentIntent: { status: "succeeded" } })
      .mockResolvedValueOnce({ paymentIntent: { status: "requires_capture" } });
    stripe.createPaymentMethod.mockResolvedValueOnce({ paymentMethod: { id: "pm_hire" } })
      .mockResolvedValueOnce({ paymentMethod: { id: "pm_deposit" } });

    render(<PaymentCheckout token="last-minute-token" />);

    const pay = await screen.findByRole("button", { name: "Pay $210.00" });
    expect(pay).toBeDisabled();
    expect(screen.queryByText(/^Hold date:/)).not.toBeInTheDocument();
    expect(screen.getByText("Total due today").parentElement?.parentElement?.nextElementSibling).toBeNull();
    expect(screen.getByText("Your $100.00 security deposit is a temporary card authorisation that will be placed as part of today's checkout.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox").parentElement).toHaveTextContent(
      /charge the hire and place a temporary \$100\.00 security deposit hold as part of this checkout\./,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(pay);
    expect(await screen.findByText(/hire payment is complete and your refundable security deposit has been authorised/)).toBeInTheDocument();
    expect(screen.getByText("Card hold authorised")).toBeInTheDocument();
    expect(stripe.confirmCardPayment).toHaveBeenNthCalledWith(1, "hire_secret", { payment_method: "pm_hire" });
    expect(stripe.confirmCardPayment).toHaveBeenNthCalledWith(2, "deposit_secret", { payment_method: "pm_deposit" });
    expect(stripe.createPaymentMethod).toHaveBeenCalledTimes(2);
    expect(stripe.clear).not.toHaveBeenCalled();
    expect(screen.getByText("Hire payment received").parentElement).toHaveTextContent("$110.00");
    expect(screen.queryByText("Total due today")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith("/api/payment/last-minute-token", expect.objectContaining({
      method: "POST",
      body: '{"verifyDeposit":true}',
    }));
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

  it("completes immediate checkout without reusing a single-use payment method", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    const today = melbourneDateKey();
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({
      ...scheduled, pickupDate: today, dropoffDate: tomorrow,
      depositHoldDate: depositHoldDate(today), depositPaymentStatus: "pending",
      depositClientSecret: "deposit_secret",
    }) }).mockResolvedValue({ ok: true, json: async () => ({ ok: true, status: "authorized" }) }));
    stripe.createPaymentMethod.mockResolvedValueOnce({ paymentMethod: { id: "pm_single_use" } })
      .mockResolvedValueOnce({ paymentMethod: { id: "pm_fresh" } });
    const used = new Set<string>();
    stripe.confirmCardPayment.mockImplementation(async (secret: string, options: { payment_method: string }) => {
      if (used.has(options.payment_method)) {
        return { error: { message: "This PaymentMethod may not be used again without Customer attachment." } };
      }
      used.add(options.payment_method);
      return { paymentIntent: { status: secret === "hire_secret" ? "succeeded" : "requires_capture" } };
    });

    render(<PaymentCheckout token="single-use-token" />);
    const pay = await screen.findByRole("button", { name: "Pay $210.00" });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(pay);
    await screen.findByText("Payment complete. Your hire payment is complete and your refundable security deposit has been authorised.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(stripe.confirmCardPayment).toHaveBeenNthCalledWith(2, "deposit_secret", { payment_method: "pm_fresh" });
    expect(stripe.confirmCardPayment.mock.calls.filter(([secret]) => secret === "hire_secret")).toHaveLength(1);
  });

  it("retains paid hire and recorded consent when a declined deposit is retried", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    const today = melbourneDateKey();
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({
      ...scheduled, pickupDate: today, dropoffDate: tomorrow,
      depositHoldDate: depositHoldDate(today), depositPaymentStatus: "pending",
      depositClientSecret: "deposit_secret",
    }) }).mockResolvedValue({ ok: true, json: async () => ({ ok: true, status: "authorized" }) });
    vi.stubGlobal("fetch", fetch);
    stripe.confirmCardPayment.mockResolvedValueOnce({ paymentIntent: { status: "succeeded" } })
      .mockResolvedValueOnce({ error: { message: "Your card was declined." } })
      .mockResolvedValueOnce({ paymentIntent: { status: "requires_capture" } });
    render(<PaymentCheckout token="retry-token" />);
    const pay = await screen.findByRole("button", { name: "Pay $210.00" });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(pay);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your card was declined.");
    expect(screen.queryByRole("heading", { name: "Payment received" })).not.toBeInTheDocument();
    expect(screen.getByText("Total due today").parentElement).toHaveTextContent("$100.00");
    expect(screen.queryByRole("button", { name: "Pay $210.00" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Authorise $100.00 security deposit hold" }));
    await screen.findByText("Payment complete. Your hire payment is complete and your refundable security deposit has been authorised.");
    expect(stripe.confirmCardPayment.mock.calls.filter(([secret]) => secret === "hire_secret")).toHaveLength(1);
    expect(fetch.mock.calls.filter(([, options]) => options?.body === '{"consent":true}')).toHaveLength(1);
    expect(stripe.clear).not.toHaveBeenCalled();
  });

  it("keeps card entry mounted until deposit verification has finished", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    let finishVerification!: (value: object) => void;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({
      ...scheduled, hirePaymentStatus: "paid", depositPaymentStatus: "action_required",
      depositConsentRecorded: true, hireClientSecret: null, depositClientSecret: "deposit_secret",
    }) }).mockImplementationOnce(() => new Promise(resolve => { finishVerification = resolve; })));
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: "requires_capture" } });
    render(<PaymentCheckout token="verification-token" />);
    fireEvent.click(await screen.findByRole("button", { name: "Authorise $100.00 security deposit hold" }));
    await waitFor(() => expect(finishVerification).toBeTypeOf("function"));
    expect(screen.getByRole("button", { name: "Processing securely…" })).toBeDisabled();
    expect(screen.getByText("Card details")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Payment received" })).not.toBeInTheDocument();
    finishVerification({ ok: true, json: async () => ({ ok: true, status: "authorized" }) });
    await screen.findByText("Payment complete. Your hire payment is complete and your refundable security deposit has been authorised.");
    expect(screen.queryByText("Card details")).not.toBeInTheDocument();
    expect(stripe.clear).not.toHaveBeenCalled();
  });

  it.each(["pending", "paid"])("does not describe a card hold when a zero-deposit hire is %s", async hirePaymentStatus => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ...scheduled, hirePaymentStatus, securityDepositCents: 0, depositPaymentStatus: "not_required",
      depositHoldDate: null, hireClientSecret: hirePaymentStatus === "paid" ? null : "hire_secret",
    }) }));
    render(<PaymentCheckout token="zero-deposit-token" />);
    await screen.findByText("Hire summary");
    expect(screen.queryByText("How your security deposit works")).not.toBeInTheDocument();
    expect(screen.queryByText(/temporary card|temporary hold|deposit is released/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    if (hirePaymentStatus === "pending") {
      fireEvent.click(screen.getByRole("button", { name: "Pay $110.00" }));
      await screen.findByText("Payment complete. Your hire payment has been received. No security deposit is required.");
      expect(stripe.confirmCardPayment).toHaveBeenCalledTimes(1);
      expect(stripe.clear).not.toHaveBeenCalled();
    }
    expect(screen.getByText("Hire payment received").parentElement).toHaveTextContent("$110.00");
  });

  it("authenticates only the deposit during recovery without charging hire again", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({
      ...scheduled, hirePaymentStatus: "paid", depositPaymentStatus: "action_required",
      depositConsentRecorded: true, hireClientSecret: null, depositClientSecret: "deposit_secret",
    }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: "authorized" }) }));
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: "requires_capture" } });
    render(<PaymentCheckout token="token" />);
    fireEvent.click(await screen.findByRole("button", { name: "Authorise $100.00 security deposit hold" }));
    await screen.findByText("Payment complete. Your hire payment is complete and your refundable security deposit has been authorised.");
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
    expect(screen.getByText("Hire payment received").parentElement).toHaveTextContent("$220.00");
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
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
    const depositDisclosure = screen.getByText("How your security deposit works").closest("details");
    expect(depositDisclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("How your security deposit works").closest("summary")!);
    expect(depositDisclosure).toHaveAttribute("open");
    expect(screen.getByText(/temporary card authorisation/i)).toBeInTheDocument();
    expect(screen.getByText(/The security deposit only covers matters set out in the hire terms/)).toBeInTheDocument();
    expect(screen.queryByText(/excessive cleaning/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Powered by Stripe")).toBeInTheDocument();
    expect(screen.queryByText(/captured without being captured/i)).not.toBeInTheDocument();
  });
});
