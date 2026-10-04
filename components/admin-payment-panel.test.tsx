import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminPaymentPanel } from "./admin-payment-panel";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPaymentPanel", () => {
  it("creates one payment link for a short hire", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paymentUrl: "https://example.com/pay/token", paymentToken: "token", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={{ id: "booking-1", status: "confirmed", pickup_date: "2026-10-01", dropoff_date: "2026-10-03" }} onChanged={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Hire amount"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create payment link" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/create-checkout", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", hireAmount: "100", securityDepositAmount: "100", gstInclusive: true }),
    })));
    expect(await screen.findByText("One payment link created for the hire and deposit authorisation.")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/pay/token")).toBeInTheDocument();
  });

  it("allows selecting bank transfer for a short hire", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reference: "PA-BOOKING1", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPaymentPanel booking={{ id: "booking-1", status: "confirmed", pickup_date: "2026-10-01", dropoff_date: "2026-10-03" }} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /Bank transfer/i }));
    fireEvent.click(screen.getByRole("radio", { name: "PayID only" }));
    fireEvent.change(screen.getByLabelText("Hire amount"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create bank-transfer invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/bank-transfer", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", hireAmount: "100", securityDepositAmount: "100", gstInclusive: true, bankTransferOption: "payid" }),
    })));
  });
});
