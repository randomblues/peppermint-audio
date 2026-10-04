import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingForm } from "./booking-form";

vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({
    items: [{ id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment", price: 55, quantity: 1 }],
    clearCart: vi.fn(),
  }),
}));

describe("BookingForm", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows the required request details and selected cart item", () => {
    render(<BookingForm />);

    expect(screen.getByText("Booking details")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Event address")).toBeInTheDocument();
    expect(screen.getByText(/Bose S1 Pro PA Speaker/)).toBeInTheDocument();
    expect(screen.getByText("Photo ID and terms")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit a Booking Request" })).toBeInTheDocument();
  });
});
