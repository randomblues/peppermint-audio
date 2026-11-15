import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EquipmentDetail } from "./equipment-detail";
import { CartProvider } from "./cart-provider";
import { equipmentCatalog } from "@/lib/site-content";

describe("EquipmentDetail", () => {
  it("adds the FLX4 to the cart at its advertised nightly price", () => {
    localStorage.clear();
    const item = equipmentCatalog.find((item) => item.slug === "pioneer-ddj-flx4");
    if (!item) throw new Error("FLX4 is missing from the equipment catalogue.");
    render(<CartProvider><EquipmentDetail item={item} /></CartProvider>);

    expect(screen.getByRole("radio", { name: "Single controller $40 / night" })).toBeInTheDocument();
    expect(screen.getByText(/USB cable, RCA audio cable & carry case included/)).toBeInTheDocument();
    expect(screen.getByText(/Bring your own compatible laptop and headphones/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(JSON.parse(localStorage.getItem("peppermint-audio-cart") ?? "[]")).toEqual([{
      id: "equipment:pioneer-ddj-flx4:Single controller",
      name: "Pioneer DDJ-FLX4 DJ Controller",
      kind: "equipment",
      option: "Single controller",
      price: 40,
      quantity: 1,
    }]);
    localStorage.clear();
  });

  it.each(equipmentCatalog)("shows the catalogue features for $slug", (item) => {
    render(<EquipmentDetail item={item} />);

    for (const detail of item.details) {
      expect(screen.getByText(`- ${detail}`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Availability confirmed before hire|Collected from Abbotsford 3067/)).not.toBeInTheDocument();
  });

  it("keeps the pair selected by default and carries a single selection into booking enquiry", () => {
    localStorage.clear();
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
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(screen.getByLabelText("Quantity in cart: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add one Test Speaker to cart" }));
    expect(screen.getByLabelText("Quantity in cart: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove one Test Speaker from cart" }));
    expect(screen.getByLabelText("Quantity in cart: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove one Test Speaker from cart" }));
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
  });
});
