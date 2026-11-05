import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminHireItems, AdminPaymentPanel } from "./admin-payment-panel";
import { catalogLineItemFromKey } from "@/lib/booking-line-items";

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

function renderOpenPaymentPanel(value: ReturnType<typeof booking> = booking(), onChanged = vi.fn()) {
  const rendered = render(<AdminPaymentPanel booking={value} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /^Payment/ }));
  return rendered;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AdminPaymentPanel", () => {
  it("offers Standard for up to three nights and Bank Transfer Only for any hire length", () => {
    const { rerender } = renderOpenPaymentPanel(booking({ dropoff_date: "2026-10-04" }));
    expect(screen.getByRole("radio", { name: /Standard Card or bank transfer. Available for hires of 3 nights or less./ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /Bank Transfer Only/ })).toBeEnabled();
    rerender(<AdminPaymentPanel booking={booking({ dropoff_date: "2026-10-05" })} onChanged={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Standard Card or bank transfer. Available for hires of 3 nights or less./ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Bank Transfer Only/ })).toBeEnabled();
  });

  it("shows scheduled deposit state and errors separately from the paid hire", () => {
    renderOpenPaymentPanel(booking({
      payment_method: "stripe_card_hold", hire_payment_status: "paid", deposit_payment_status: "scheduled",
      deposit_error: "Authentication is required before pickup.",
    }));
    expect(screen.getByText(/paid hire does not yet mean the deposit is secured/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Authentication is required");
  });
  it("includes extra nights in catalogue pricing but not custom charges or deposits", () => {
    render(
      <>
        <AdminHireItems booking={booking({
      dropoff_date: "2026-10-04",
      hire_line_items: [catalogLineItemFromKey("equipment:bose-s1-pro:Single speaker")!, ...lineItems],
        })} onChanged={vi.fn()} />
        <AdminPaymentPanel booking={booking({
          dropoff_date: "2026-10-04",
          hire_line_items: [catalogLineItemFromKey("equipment:bose-s1-pro:Single speaker")!, ...lineItems],
        })} onChanged={vi.fn()} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Payment/ }));
    expect(screen.getByText("$210.00")).toBeInTheDocument();
    expect(screen.getByText("$410.00")).toBeInTheDocument();
    expect(screen.getByText(/3 nights.*Every additional night half price/)).toBeInTheDocument();
    expect(screen.getByText("$55.00 each / night")).toBeInTheDocument();
    expect(screen.getByText("$100.00 each (flat charge)")).toBeInTheDocument();
  });

  it("shows a concise not-sent status for a fresh booking", () => {
    render(<AdminPaymentPanel booking={booking({ status: "submitted", hire_payment_status: "unpaid" })} onChanged={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: /^Payment/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Security deposit amount")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const requestStatus = screen.getAllByText("Not sent");
    const mobileRequestStatus = requestStatus.find((element) => element.classList.contains("sm:hidden"));
    expect(mobileRequestStatus).toHaveClass("max-w-full", "whitespace-normal");
    expect(requestStatus).toHaveLength(3);
    expect(screen.getByText("Payment status").parentElement).toHaveClass("flex-wrap");
    expect(screen.getByLabelText("Security deposit amount")).toBeInTheDocument();
  });

  it("shows the requested payment method in the payment status", () => {
    renderOpenPaymentPanel(booking({ hire_payment_status: "bank_transfer_pending", payment_method: "bank_transfer" }));

    expect(screen.getAllByText("Bank transfer requested")).toHaveLength(3);
  });

  it("hides a payment link while switching to a different payment method", () => {
    renderOpenPaymentPanel(booking({ hire_payment_status: "pending", payment_method: "stripe_card_hold", payment_token: "token-123" }));

    expect(screen.getByText("Customer payment link")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Bank Transfer Only/ }));
    expect(screen.queryByText("Customer payment link")).not.toBeInTheDocument();
  });

  it("allows Standard selection while an unpaid cash request is still pending", () => {
    renderOpenPaymentPanel(booking({ hire_payment_status: "cash_due", payment_method: "cash_on_pickup" }));

    expect(screen.getByRole("radio", { name: /^Standard/ })).toBeEnabled();
  });

  it("collapses and reopens payment collection", () => {
    render(<AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: /^Payment/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Security deposit amount")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Security deposit amount")).not.toBeInTheDocument();
  });

  it("creates one payment link using the stored hire items", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paymentUrl: "https://example.com/pay/token", paymentToken: "token", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });

    vi.stubGlobal("fetch", fetchMock);
    renderOpenPaymentPanel();

    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/create-checkout", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", securityDepositAmount: "100", gstInclusive: true, bankTransferOption: "both" }),
    })));
    expect(await screen.findByText("Standard payment request sent with card and bank-transfer options.")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/pay/token")).toBeInTheDocument();
  });

  it("allows requesting payment while the booking is still submitted", () => {
    renderOpenPaymentPanel(booking({ status: "submitted" }));

    expect(screen.getByRole("button", { name: "Send invoice" })).toBeEnabled();
  });

  it("sends both PayID and bank-account details for Bank Transfer Only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reference: "PA-BOOKING1", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderOpenPaymentPanel();

    fireEvent.click(screen.getByRole("radio", { name: /Bank Transfer Only/i }));
    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/bank-transfer", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", securityDepositAmount: "100", gstInclusive: true, bankTransferOption: "both" }),
    })));
  });

  it("uses the default $200 security deposit when sending bank transfer details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reference: "PA-BOOKING1", hireAmountCents: 10000, securityDepositCents: 20000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderOpenPaymentPanel();

    expect(screen.getByLabelText("Security deposit amount")).toHaveValue("200");
    fireEvent.click(screen.getByRole("radio", { name: /Bank Transfer Only/i }));
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/bank-transfer", expect.objectContaining({
      body: JSON.stringify({ bookingId: "booking-1", securityDepositAmount: "200", gstInclusive: true, bankTransferOption: "both" }),
    })));
  });

  it("sends optional alternate Bill to details with the payment request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paymentUrl: "https://example.com/pay/token", paymentToken: "token", hireAmountCents: 10000, securityDepositCents: 10000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderOpenPaymentPanel();

    fireEvent.change(screen.getByLabelText("Security deposit amount"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Bill to name"), { target: { value: "Acme Events" } });
    fireEvent.change(screen.getByLabelText("Bill to email"), { target: { value: "accounts@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/create-checkout", expect.objectContaining({
      body: JSON.stringify({
        bookingId: "booking-1",
        securityDepositAmount: "100",
        gstInclusive: true,
        bankTransferOption: "both",
        billToName: "Acme Events",
        billToEmail: "accounts@example.com",
      }),
    })));
  });

  it("keeps alternate Bill to details collapsed by default", () => {
    renderOpenPaymentPanel();

    const summary = screen.getByText(/Alternative Bill to details/);
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
  });

  it("allows switching a pending bank transfer to Standard", () => {
    renderOpenPaymentPanel(booking({
      payment_method: "bank_transfer",
      hire_payment_status: "bank_transfer_pending",
      deposit_payment_status: "bank_transfer_pending",
    }));

    const stripeOption = screen.getByRole("radio", { name: /^Standard/ });
    expect(stripeOption).toBeEnabled();
    fireEvent.click(stripeOption);
    expect(stripeOption).toBeChecked();
    expect(screen.queryByRole("radio", { name: "PayID only" })).not.toBeInTheDocument();
  });

  it("updates a pending invoice on the same booking and reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reference: "PA-BOOKING1", bookingId: "booking-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderOpenPaymentPanel(booking({
      payment_method: "bank_transfer",
      security_deposit_cents: 10000,
      gst_inclusive: true,
      hire_payment_status: "bank_transfer_pending",
      deposit_payment_status: "bank_transfer_pending",
    }));

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
    renderOpenPaymentPanel(booking({
      payment_method: "bank_transfer",
      hire_payment_status: "bank_transfer_received",
      deposit_payment_status: "not_required",
    }));

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
    renderOpenPaymentPanel(booking({
      payment_method: "bank_transfer",
      hire_payment_status: "bank_transfer_received",
      deposit_payment_status: "not_required",
    }));

    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    expect(await screen.findByText("Payment update failed (502): The server returned an invalid response.")).toBeInTheDocument();
  });

  it("saves order edits without creating or sending a payment request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, hireAmountCents: 20000 }),
    });
    const onChanged = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminHireItems booking={booking()} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase Audio hire quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/update-booking", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        bookingId: "booking-1",
        hireLineItems: [{ ...lineItems[0], quantity: 2 }],
        saveOnly: true,
      }),
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Hire items saved to this booking.");
    expect(onChanged).toHaveBeenCalledWith({
      hire_line_items: [{ ...lineItems[0], quantity: 2 }],
      hire_amount_cents: 20000,
    });
  });

  it("keeps hire items visible while payment collection is collapsed", () => {
    render(
      <>
        <AdminHireItems booking={booking()} onChanged={vi.fn()} />
        <AdminPaymentPanel booking={booking()} onChanged={vi.fn()} />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Hire items" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Payment/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Increase Audio hire quantity")).toBeVisible();
    expect(screen.queryByLabelText("Security deposit amount")).not.toBeInTheDocument();
  });

  it("requires unsaved hire-item edits to be saved before sending an invoice", () => {
    render(<AdminPaymentPanel booking={booking({ status: "submitted" })} onChanged={vi.fn()} hireItemsDirty />);
    fireEvent.click(screen.getByRole("button", { name: /^Payment/ }));

    expect(screen.getByText("Save the hire-item changes above before sending an invoice.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invoice" })).toBeDisabled();
  });

  it("unblocks payment collection after order edits are saved", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, hireAmountCents: 20000 }),
    });
    const value = booking({ status: "submitted" });
    vi.stubGlobal("fetch", fetchMock);
    function PaymentEditor() {
      const [dirty, setDirty] = useState(false);
      return (
        <>
          <AdminHireItems booking={value} onChanged={vi.fn()} onDirtyChange={setDirty} />
          <AdminPaymentPanel booking={value} onChanged={vi.fn()} hireItemsDirty={dirty} />
        </>
      );
    }

    render(<PaymentEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Audio hire quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /^Payment/ }));
    expect(screen.getByRole("button", { name: "Send invoice" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send invoice" })).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/payments/update-booking", expect.any(Object));
  });

  it("adds a catalogue item and recalculates the visible hire total", () => {
    render(<AdminHireItems booking={booking({ hire_line_items: [] })} onChanged={vi.fn()} />);

    const catalogueSelect = screen.getByLabelText("Add catalogue item");
    expect([...catalogueSelect.querySelectorAll("optgroup")].map((group) => group.label)).toEqual([
      "Packages", "Speakers", "Subwoofers", "Microphones", "Mixers", "DI boxes", "Lighting", "Accessories",
    ]);
    fireEvent.change(screen.getByLabelText("Add catalogue item"), { target: { value: "package:standard-party-events" } });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));

    expect(screen.getByLabelText("Hire items total")).toHaveTextContent("$240.00");
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeInTheDocument();
  });
});
