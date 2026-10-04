import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CartView } from "./cart-view";

vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({
    items: [{ id: "speaker", name: "Bose S1 Pro", kind: "equipment", price: 65, quantity: 1 }],
    total: 65,
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
  }),
}));

describe("CartView", () => {
  it("starts the booking request from the selected hire cart", () => {
    render(<CartView />);

    expect(screen.getByText("Booking request")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toHaveAttribute("href", "/booking");
  });
});
