import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EquipmentDetail } from "./equipment-detail";
import { CartProvider } from "./cart-provider";

describe("EquipmentDetail", () => {
  it("keeps the pair selected by default and carries a single selection into booking enquiry", () => {
    render(
      <CartProvider>
        <EquipmentDetail item={{
          slug: "test-speaker",
          name: "Test Speaker",
          category: "Speakers",
          description: "A test speaker.",
          image: "/test-speaker.png",
          options: [
            { label: "Pair (2 speakers)", price: 95 },
            { label: "Single speaker", price: 55 },
          ],
          details: ["Portable", "Power cables & Speaker stands included"],
        }} />
      </CartProvider>,
    );

    expect(screen.getByRole("radio", { name: "Pair (2 speakers) $95 / night" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText(/Power cables & Speaker stands included/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Single speaker $55 / night" }));

    expect(screen.getByRole("radio", { name: "Single speaker $55 / night" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toHaveClass("rounded-xl");
  });
});
