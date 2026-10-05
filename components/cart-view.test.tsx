import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartView } from "./cart-view";

const mockCart = vi.hoisted(() => ({
  items: [{ id: "speaker", name: "Bose S1 Pro", kind: "equipment" as const, price: 65, quantity: 1 }],
  total: 65,
  removeItem: vi.fn(),
  updateQuantity: vi.fn(),
  clearCart: vi.fn(),
}));

vi.mock("@/components/cart-provider", () => ({
  useCart: () => mockCart,
}));

describe("CartView", () => {
  beforeEach(() => {
    mockCart.items = [{ id: "speaker", name: "Bose S1 Pro", kind: "equipment", price: 65, quantity: 1 }];
    mockCart.total = 65;
    mockCart.removeItem.mockClear();
    mockCart.updateQuantity.mockClear();
    mockCart.clearCart.mockClear();
  });

  it("starts the booking request from the selected hire cart", () => {
    render(<CartView />);

    expect(screen.getByText("Booking request")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toHaveAttribute("href", "/booking");
  });

  it("offers package and equipment browsing when the cart is empty", () => {
    mockCart.items = [];
    render(<CartView />);

    expect(screen.getByRole("button", { name: "Browse packages" })).toHaveAttribute("href", "/packages");
    expect(screen.getByRole("button", { name: "Browse equipment" })).toHaveAttribute("href", "/equipment");

    mockCart.items = [{ id: "speaker", name: "Bose S1 Pro", kind: "equipment", price: 65, quantity: 1 }];
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
    mockCart.items = [{ id: "speaker", name: "Bose S1 Pro", kind: "equipment", price: 65, quantity: 2 }];
    mockCart.total = 130;
    render(<CartView />);

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity for Bose S1 Pro" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity for Bose S1 Pro" }));

    expect(mockCart.updateQuantity).toHaveBeenNthCalledWith(1, "speaker", 3);
    expect(mockCart.updateQuantity).toHaveBeenNthCalledWith(2, "speaker", 1);
  });
});
