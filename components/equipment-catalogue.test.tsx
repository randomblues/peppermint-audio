import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider } from "@/components/cart-provider";
import { EquipmentCatalogue, EquipmentCatalogueFallback } from "./equipment-catalogue";
import { equipmentCatalog } from "@/lib/site-content";

function subscribeToHistory(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

vi.mock("next/navigation", () => ({
  useSearchParams() {
    const search = useSyncExternalStore(subscribeToHistory, () => window.location.search, () => "");
    return new URLSearchParams(search);
  },
}));

function renderCatalogue() {
  return render(<CartProvider><EquipmentCatalogue items={equipmentCatalog} /></CartProvider>);
}

function results() {
  return within(screen.getByRole("region", { name: "Equipment results" }));
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/equipment");
  const pushState = window.history.pushState.bind(window.history);
  const replaceState = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
    pushState(...args);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  vi.spyOn(window.history, "replaceState").mockImplementation((...args) => {
    replaceState(...args);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
});

afterEach(() => vi.restoreAllMocks());

describe("EquipmentCatalogue", () => {
  it("shows all products with accessible search, categories, sorting and a live count", () => {
    renderCatalogue();
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(equipmentCatalog.length);
    expect(screen.getByRole("textbox", { name: "Search equipment" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Search equipment" })).toHaveAttribute("placeholder", "Search gear or brands...");
    expect(screen.getByRole("combobox", { name: "Equipment category" })).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: "Sort equipment" })).toHaveValue("recommended");
    expect(screen.getByRole("status")).toHaveTextContent("18 items");
    expect(screen.getByRole("status").parentElement).toHaveClass("sr-only");
    expect(screen.queryByText("18 items to explore")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Equipment categories" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("search", { name: "Find equipment" })).getAllByRole("combobox")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Reset filters" })).not.toBeInTheDocument();
  });

  it("filters instantly and replaces history while typing", () => {
    renderCatalogue();
    fireEvent.change(screen.getByRole("textbox", { name: "Search equipment" }), { target: { value: "wireless mic" } });
    expect(results().getByRole("link", { name: "K60 Wireless Microphone" })).toBeInTheDocument();
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("1 item of 18");
    expect(screen.getByRole("option", { name: "Microphones" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Speakers" })).toBeInTheDocument();
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/equipment?q=wireless+mic");
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it("filters through one category dropdown, including effects and subwoofers", () => {
    renderCatalogue();
    const category = screen.getByRole("combobox", { name: "Equipment category" });
    expect(within(category).getAllByRole("option")).toHaveLength(9);
    fireEvent.change(category, { target: { value: "effects" } });
    expect(category).toHaveValue("effects");
    expect(results().getByRole("link", { name: "BeamZ S1500 Smoke Machine" })).toBeInTheDocument();
    expect(window.history.pushState).toHaveBeenLastCalledWith(null, "", "/equipment?category=effects");

    fireEvent.change(category, { target: { value: "subwoofers" } });
    expect(category).toHaveValue("subwoofers");
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(2);
  });

  it("does not add duplicate history entries when the active category is chosen again", () => {
    renderCatalogue();
    const category = screen.getByRole("combobox", { name: "Equipment category" });
    fireEvent.change(category, { target: { value: "all" } });
    expect(window.history.pushState).not.toHaveBeenCalled();
    fireEvent.change(category, { target: { value: "speakers" } });
    fireEvent.change(category, { target: { value: "speakers" } });
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
  });

  it("loads URL filters and preserves unrelated attribution parameters when updating them", () => {
    window.history.replaceState(null, "", "/equipment?q=shure&category=microphones&utm_source=google");
    renderCatalogue();
    expect(screen.getByRole("textbox", { name: "Search equipment" })).toHaveValue("shure");
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(3);
    fireEvent.change(screen.getByRole("combobox", { name: "Sort equipment" }), { target: { value: "price-desc" } });
    expect(screen.getByText("Price order uses the lowest nightly hire option.")).not.toHaveClass("sr-only");
    expect(new URLSearchParams(window.location.search).get("utm_source")).toBe("google");
    expect(new URLSearchParams(window.location.search).get("sort")).toBe("price-desc");
    expect(results().getAllByRole("link", { name: /^Shure/ })[0]).toHaveTextContent("Shure SM7B");
  });

  it("shows a useful empty state and can widen the category without discarding the search", () => {
    renderCatalogue();
    fireEvent.change(screen.getByRole("combobox", { name: "Equipment category" }), { target: { value: "speakers" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search equipment" }), { target: { value: "smoke" } });
    expect(results().getByRole("heading", { name: "No gear found" })).toBeInTheDocument();
    expect(results().getByText('No matches for "smoke" in speakers.')).toBeInTheDocument();
    fireEvent.click(results().getByRole("button", { name: "Search all categories (1)" }));
    expect(screen.getByRole("textbox", { name: "Search equipment" })).toHaveValue("smoke");
    expect(screen.getByRole("combobox", { name: "Equipment category" })).toHaveValue("all");
    expect(results().getByRole("link", { name: "BeamZ S1500 Smoke Machine" })).toBeInTheDocument();
  });

  it("offers a clear recovery when a query has no matches anywhere", () => {
    renderCatalogue();
    const input = screen.getByRole("textbox", { name: "Search equipment" });
    fireEvent.change(input, { target: { value: "no-such-product" } });
    expect(results().getByRole("heading", { name: "No gear found" })).toBeInTheDocument();
    expect(results().queryByRole("button", { name: /Search all categories/ })).not.toBeInTheDocument();
    fireEvent.click(results().getByRole("button", { name: "Clear filters" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(equipmentCatalog.length);
    expect(window.location.search).toBe("");
  });

  it("clears just the query with the clear button or Escape, preserving category and sort", () => {
    window.history.replaceState(null, "", "/equipment?q=shure&category=microphones&sort=name");
    renderCatalogue();
    const input = screen.getByRole("textbox", { name: "Search equipment" });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Equipment category" })).toHaveValue("microphones");
    expect(screen.getByRole("combobox", { name: "Sort equipment" })).toHaveValue("name");
    fireEvent.change(input, { target: { value: "wireless" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(5);
  });

  it("resets category, query and sorting together", () => {
    window.history.replaceState(null, "", "/equipment?q=shure&category=microphones&sort=name");
    renderCatalogue();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("textbox", { name: "Search equipment" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Equipment category" })).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: "Sort equipment" })).toHaveValue("recommended");
    expect(window.location.search).toBe("");
  });

  it("reacts to restored browser history", () => {
    renderCatalogue();
    act(() => {
      window.history.replaceState(null, "", "/equipment?q=presonus&category=subwoofers");
    });
    expect(screen.getByRole("textbox", { name: "Search equipment" })).toHaveValue("presonus");
    expect(screen.getByRole("combobox", { name: "Equipment category" })).toHaveValue("subwoofers");
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(1);
  });

  it("retains a chosen hire option when sorting and does not change the cart when filtering", () => {
    renderCatalogue();
    const boseCard = results().getByRole("link", { name: "Bose S1 Pro PA Speaker" })
      .closest<HTMLElement>('[data-slot="card"]');
    if (!boseCard) throw new Error("Bose equipment card is missing");
    fireEvent.click(within(boseCard).getByRole("button", { name: "Single speaker $55 / night" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort equipment" }), { target: { value: "price-asc" } });
    expect(within(boseCard).getByRole("button", { name: "Single speaker $55 / night" }))
      .toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(boseCard).getByRole("button", { name: "Add to cart" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search equipment" }), { target: { value: "smoke" } });
    expect(JSON.parse(localStorage.getItem("peppermint-audio-cart") ?? "[]")).toEqual([
      expect.objectContaining({ name: "Bose S1 Pro PA Speaker", price: 55, option: "Single speaker", quantity: 1 }),
    ]);
  });

  it("prerenders the catalogue while the URL-aware controls load", () => {
    render(<EquipmentCatalogueFallback items={equipmentCatalog} />);
    expect(screen.getByRole("search", { name: "Find equipment" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("region", { name: "Equipment results" })).toHaveAttribute("inert");
    expect(screen.getByRole("textbox", { name: "Search equipment" })).toBeDisabled();
    expect(results().getAllByRole("button", { name: "Add to cart" })).toHaveLength(equipmentCatalog.length);
    expect(screen.getByRole("status")).toHaveTextContent("Loading filters...");
  });
});
