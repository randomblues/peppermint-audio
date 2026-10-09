import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type BookingLineItem } from "@/lib/booking-line-items";
import { HirePriceSummary } from "./hire-price-summary";

const item: BookingLineItem = {
  id: "equipment:test",
  kind: "equipment",
  name: "Speaker",
  quantity: 1,
  unitPriceCents: 5500,
};

describe("HirePriceSummary", () => {
  it("emphasises the saving against the full nightly total with the actual breakdown", () => {
    render(<HirePriceSummary items={[item]} nights={3} />);
    expect(screen.getByText("$165.00").tagName).toBe("S");
    expect(screen.getByText("$110.00").tagName).toBe("STRONG");
    expect(screen.getByText("You save $55.00")).toBeInTheDocument();
    expect(screen.getByText("First night")).toBeInTheDocument();
    expect(screen.getByText("2 extra nights · 50% off")).toBeInTheDocument();
    expect(screen.getAllByText("$55.00")).toHaveLength(2);
  });

  it("updates savings for mixed selections and quantities", () => {
    render(<HirePriceSummary items={[{ ...item, quantity: 2 }, { ...item, id: "package:test", kind: "package", unitPriceCents: 6500 }]} nights={4} />);
    expect(screen.getByText("$700.00")).toHaveProperty("tagName", "S");
    expect(screen.getByText("$437.50")).toBeInTheDocument();
    expect(screen.getByText("You save $262.50")).toBeInTheDocument();
    expect(screen.getByText("$175.00")).toBeInTheDocument();
    expect(screen.getByText("$262.50")).toBeInTheDocument();
  });

  it("does not advertise savings for one-night, same-day, empty or free hires", () => {
    const { rerender, container } = render(<HirePriceSummary items={[item]} nights={1} detail="Same-day hire" />);
    expect(screen.getByText("$55.00")).toBeInTheDocument();
    expect(screen.getByText("Same-day hire")).toBeInTheDocument();
    expect(container.querySelector("s")).toBeNull();
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
    rerender(<HirePriceSummary items={[]} nights={3} />);
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
    rerender(<HirePriceSummary items={[{ ...item, unitPriceCents: 0 }]} nights={3} />);
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
  });

  it("uses per-unit rounding and excludes flat custom charges from savings", () => {
    render(<HirePriceSummary items={[{ ...item, unitPriceCents: 5501, quantity: 2 }, { ...item, id: "custom:test", kind: "custom", unitPriceCents: 10000 }]} nights={2} />);
    expect(screen.getByText("$320.04")).toHaveProperty("tagName", "S");
    expect(screen.getByText("$265.04")).toBeInTheDocument();
    expect(screen.getByText("You save $55.00")).toBeInTheDocument();
    expect(screen.getByText("1 extra night · 50% off")).toBeInTheDocument();
  });
});
