import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
});
