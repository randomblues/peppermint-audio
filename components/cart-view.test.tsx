import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartView } from "./cart-view";

const mockCart = vi.hoisted(() => ({
  items: [{ id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment" as const, price: 55, quantity: 1 }],
  hireDates: { pickupDate: "2026-10-20", dropoffDate: "2026-10-23" },
  setHireDates: vi.fn(),
  removeItem: vi.fn(),
  updateQuantity: vi.fn(),
  clearCart: vi.fn(),
}));

vi.mock("@/lib/date-utils", () => ({ getMelbourneToday: () => "2026-10-09" }));

vi.mock("@/components/cart-provider", () => ({
  useCart: () => mockCart,
}));

describe("CartView", () => {
  beforeEach(() => {
    mockCart.items = [{ id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment", price: 55, quantity: 1 }];
    mockCart.hireDates = { pickupDate: "2026-10-20", dropoffDate: "2026-10-23" };
    mockCart.setHireDates.mockClear();
    mockCart.removeItem.mockClear();
    mockCart.updateQuantity.mockClear();
    mockCart.clearCart.mockClear();
  });

  it("starts the booking request from the selected hire cart", () => {
    render(<CartView />);

    expect(screen.getByText("Booking request")).toBeInTheDocument();
    expect(screen.getByText("Hire total")).toBeInTheDocument();
    expect(screen.getByText("$55 each / night")).toBeInTheDocument();
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    expect(screen.getByText("$165.00").tagName).toBe("S");
    expect(screen.getByText("You save $55.00")).toBeInTheDocument();
    expect(screen.getByText(/Every extra night is 50% off/)).toBeInTheDocument();
    expect(screen.getByText("Your hire dates").closest('[data-slot="card"]')).toHaveClass("overflow-visible");
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toHaveAttribute("href", "/booking");
  });

  it("offers package and equipment browsing when the cart is empty", () => {
    mockCart.items = [];
    render(<CartView />);

    expect(screen.getByRole("button", { name: "Browse packages" })).toHaveAttribute("href", "/packages");
    expect(screen.getByRole("button", { name: "Browse equipment" })).toHaveAttribute("href", "/equipment");

  });

  it("requires a complete current date range before continuing", () => {
    mockCart.hireDates = { pickupDate: "2026-10-20", dropoffDate: "" };
    const { rerender } = render(<CartView />);
    expect(screen.getByText("$55.00")).toBeInTheDocument();
    expect(screen.getByText("1-night rate")).toBeInTheDocument();
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toBeDisabled();
    mockCart.hireDates = { pickupDate: "2026-10-01", dropoffDate: "2026-10-03" };
    rerender(<CartView />);
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toBeDisabled();
  });

  it("updates period totals with dates and quantities, including same-day hire", () => {
    const { rerender } = render(<CartView />);
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    mockCart.hireDates.dropoffDate = "2026-10-21";
    rerender(<CartView />);
    expect(screen.getByText("$55.00")).toBeInTheDocument();
    mockCart.items[0].quantity = 2;
    rerender(<CartView />);
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    mockCart.hireDates.dropoffDate = "2026-10-20";
    rerender(<CartView />);
    expect(screen.getByText("1 night · Same-day hire")).toBeInTheDocument();
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
  });

  it("clears an earlier end date when the start date moves later", () => {
    render(<CartView />);
    fireEvent.click(screen.getByLabelText("Start date"));
    fireEvent.click(screen.getByRole("button", { name: "24/10/2026" }));
    expect(mockCart.setHireDates).toHaveBeenCalledWith({ pickupDate: "2026-10-24", dropoffDate: "" });
  });

  it("sets the end date and prevents selection before the start date", () => {
    render(<CartView />);
    fireEvent.click(screen.getByLabelText("End date"));
    expect(screen.getByRole("button", { name: "19/10/2026" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "25/10/2026" }));
    expect(mockCart.setHireDates).toHaveBeenCalledWith({ pickupDate: "2026-10-20", dropoffDate: "2026-10-25" });
  });

  it("selects both hire dates from the start-date calendar and populates the end field", () => {
    const { rerender } = render(<CartView />);
    fireEvent.click(screen.getByLabelText("Start date"));
    fireEvent.click(screen.getByRole("button", { name: "21/10/2026" }));
    expect(mockCart.setHireDates).toHaveBeenLastCalledWith({ pickupDate: "2026-10-21", dropoffDate: "" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    mockCart.hireDates = { pickupDate: "2026-10-21", dropoffDate: "" };
    rerender(<CartView />);
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "25/10/2026" }));
    expect(mockCart.setHireDates).toHaveBeenLastCalledWith({ pickupDate: "2026-10-21", dropoffDate: "2026-10-25" });
    mockCart.hireDates = { pickupDate: "2026-10-21", dropoffDate: "2026-10-25" };
    rerender(<CartView />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toHaveTextContent("25 October 2026");
    expect(screen.getByText("4 nights")).toBeInTheDocument();
    expect(screen.getByText("$137.50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toBeEnabled();
  });

  it("surfaces unavailable items rather than continuing with a partial total", () => {
    mockCart.items[0].id = "equipment:removed";
    render(<CartView />);
    expect(screen.getByRole("alert")).toHaveTextContent("Some selected items are no longer available");
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toBeDisabled();
  });

  it("shows the clear-cart animation before clearing", () => {
    vi.useFakeTimers();
    render(<CartView />);

    const clearButton = screen.getByRole("button", { name: "Clear cart" });
    fireEvent.click(clearButton);

    expect(screen.getByRole("button", { name: "Clearing cart" })).toHaveClass("is-clearing");

    act(() => vi.advanceTimersByTime(280));
    expect(screen.getByRole("button", { name: "Clear cart" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows the remove animation before removing an item", () => {
    vi.useFakeTimers();
    render(<CartView />);

    const removeButton = screen.getByRole("button", { name: "Remove" });
    fireEvent.click(removeButton);

    expect(screen.getByRole("button", { name: "Removing" })).toHaveClass("is-removing");

    act(() => vi.advanceTimersByTime(240));
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows a quantity stepper and disables decrease at quantity 1", () => {
    render(<CartView />);

    const decreaseButton = screen.getByRole("button", { name: "Decrease quantity for Bose S1 Pro" });
    const increaseButton = screen.getByRole("button", { name: "Increase quantity for Bose S1 Pro" });

    expect(screen.getByLabelText("Quantity for Bose S1 Pro")).toHaveTextContent("1");
    expect(decreaseButton).toBeDisabled();
    expect(increaseButton).toBeEnabled();
  });

  it("updates quantity from the stepper controls", () => {
    mockCart.items[0].quantity = 2;
    render(<CartView />);

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity for Bose S1 Pro" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity for Bose S1 Pro" }));

    expect(mockCart.updateQuantity).toHaveBeenNthCalledWith(1, "equipment:bose-s1-pro:Single speaker", 3);
    expect(mockCart.updateQuantity).toHaveBeenNthCalledWith(2, "equipment:bose-s1-pro:Single speaker", 1);
  });
});
