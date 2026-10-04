import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminPaymentPanel } from "./admin-payment-panel";

const lineItems = [{
  id: "custom:test-hire",
  kind: "custom" as const,
  name: "Audio hire",
  quantity: 1,
  unitPriceCents: 10000,
}];

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    status: "confirmed",
    pickup_date: "2026-10-01",
    dropoff_date: "2026-10-03",
    hire_line_items: lineItems,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPaymentPanel", () => {
  it("collapses and reopens payment collection", () => {
    render(<AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: "Payment collection" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Security deposit amount")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Security deposit amount")).toBeInTheDocument();
  });

  it("creates one payment link using the stored hire items", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paymentUrl: "https://example.com/pay/token", paymentToken: "token", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/create-checkout", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", securityDepositAmount: "100", gstInclusive: true }),
    })));
    expect(await screen.findByText("One payment link created for the hire and deposit authorisation.")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/pay/token")).toBeInTheDocument();
  });

  it("allows requesting payment while the booking is still submitted", () => {
    render(<AdminPaymentPanel booking={booking({ status: "submitted" })} onChanged={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Send invoice" })).toBeEnabled();
  });

  it("allows selecting bank transfer for a short hire", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reference: "PA-BOOKING1", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /Bank transfer/i }));
    fireEvent.click(screen.getByRole("radio", { name: "PayID only" }));
    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/bank-transfer", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", securityDepositAmount: "100", gstInclusive: true, bankTransferOption: "payid" }),
    })));
  });

  it("sends optional alternate Bill to details with the payment request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paymentUrl: "https://example.com/pay/token", paymentToken: "token", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Bill to name"), { target: { value: "Acme Events" } });
    fireEvent.change(screen.getByLabelText("Bill to email"), { target: { value: "accounts@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/create-checkout", expect.objectContaining({
      body: JSON.stringify({
        bookingId: "booking-1",
        securityDepositAmount: "100",
        gstInclusive: true,
        billToName: "Acme Events",
        billToEmail: "accounts@example.com",
      }),
    })));
  });

  it("keeps alternate Bill to details collapsed by default", () => {
    render(<AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />);

    const summary = screen.getByText(/Alternative Bill to details/);
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
  });

  it("allows switching a pending bank transfer to Stripe", () => {
    render(<AdminPaymentPanel booking={booking({
      payment_method: "bank_transfer",
      hire_payment_status: "bank_transfer_pending",
      deposit_payment_status: "bank_transfer_pending",
    })} onChanged={vi.fn()} />);

    const stripeOption = screen.getByRole("radio", { name: /Stripe card hold/i });
    expect(stripeOption).toBeEnabled();
    fireEvent.click(stripeOption);
    expect(stripeOption).toBeChecked();
  });

  it("updates a pending invoice on the same booking and reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reference: "PA-BOOKING1", bookingId: "booking-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={booking({
      payment_method: "bank_transfer",
      security_deposit_cents: 10000,
      gst_inclusive: true,
      hire_payment_status: "bank_transfer_pending",
      deposit_payment_status: "bank_transfer_pending",
    })} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("GST-inclusive hire cost"));
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/update-booking", expect.objectContaining({
      body: JSON.stringify({
        bookingId: "booking-1",
        paymentMethod: "bank_transfer",
        hireLineItems: lineItems,
        securityDepositAmount: "100",
        gstInclusive: false,
        bankTransferOption: "both",
      }),
    })));
    expect(await screen.findByText("Invoice sent using the current booking details and reference PA-BOOKING1.")).toBeInTheDocument();
  });

  it("resends the current invoice for a settled booking through the same button", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={booking({
      payment_method: "bank_transfer",
      hire_payment_status: "bank_transfer_received",
      deposit_payment_status: "not_required",
    })} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/send-invoice", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", bankTransferOption: "both" }),
    })));
    expect(await screen.findByText("Invoice sent using the current booking details.")).toBeInTheDocument();
  });

  it("shows a useful error when the invoice endpoint returns non-JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "<html>Bad gateway</html>",
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={booking({
      payment_method: "bank_transfer",
      hire_payment_status: "bank_transfer_received",
      deposit_payment_status: "not_required",
    })} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    expect(await screen.findByText("Payment update failed (502): The server returned an invalid response.")).toBeInTheDocument();
  });

  it("uses PATCH when saving line items before creating a payment request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ paymentUrl: "https://example.com/pay/token", paymentToken: "token", hireAmountCents: 20000, securityDepositCents: 10000 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase Audio hire quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/bookings", expect.objectContaining({
      method: "PATCH",
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/payments/create-checkout", expect.objectContaining({
      method: "POST",
    }));
  });

  it("adds a catalogue item and recalculates the hire total", () => {
    render(<AdminPaymentPanel booking={booking({ hire_line_items: [] })} onChanged={vi.fn()} />);

    const catalogueSelect = screen.getByLabelText("Add catalogue item");
    expect([...catalogueSelect.querySelectorAll("optgroup")].map((group) => group.label)).toEqual([
      "Packages", "Speakers", "Subwoofers", "Microphones", "Mixers", "DI boxes", "Lighting", "Accessories",
    ]);
    fireEvent.change(screen.getByLabelText("Add catalogue item"), { target: { value: "package:standard-party-events" } });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));

    expect(screen.getByText(/Hire total is calculated from these items/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save hire items" })).toBeInTheDocument();
  });
});
