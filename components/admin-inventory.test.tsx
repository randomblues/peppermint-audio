import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminInventory } from "@/components/admin-inventory";

const product: { id: string; name: string; category: string | null; quantity_on_hand: number } = { id: "7b6e5e2e-6bc7-4c7f-a5e0-34d065f80f84", name: "Bose speaker", category: "Speakers", quantity_on_hand: 4 };
const purchase = {
  id: "purchase-1",
  product_id: product.id,
  product_name: product.name,
  purchase_date: "2026-03-10",
  quantity: 2,
  total_cost_cents: 110000,
  gst_paid_cents: 10000,
  supplier: "Audio shop",
  reference: "INV-100",
};
const inventory = {
  products: [product],
  mappings: [{ product_id: product.id, catalog_key: "equipment:bose-s1-pro:Single speaker", units_per_line_item: 1 }],
  trackedListings: [],
  purchases: [purchase],
  movements: [{ id: "adjustment-1", product_id: product.id, movement_type: "adjustment", quantity_change: -1, reason: "Damaged", created_at: "2026-03-11T00:00:00Z" }],
};

function installFetch(inventoryResponse = inventory) {
  const fetchMock = vi.fn().mockImplementation((_url: string, options?: RequestInit) => options?.method === "POST"
    ? Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    : Promise.resolve({ ok: true, json: async () => inventoryResponse }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openBoseProduct() {
  fireEvent.click(await screen.findByRole("button", { name: "Browse Speakers inventory" }));
  fireEvent.click(await screen.findByText("Bose speaker"));
  await screen.findByLabelText("Inventory units for listing 1");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminInventory", () => {
  it("saves listing mappings and enables booking checks from the product details", async () => {
    const fetchMock = installFetch();
    render(<AdminInventory />);

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter inventory products by category")).not.toBeInTheDocument();
    await openBoseProduct();
    expect(screen.getByText("On hand:")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Inventory units for listing 1"), { target: { value: "2" } });
    expect(screen.getByRole("button", { name: "Enable checks for Bose S1 Pro · Single" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save listings" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/inventory", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        action: "replace_mappings",
        productId: product.id,
        mappings: [{ catalogKey: "equipment:bose-s1-pro:Single speaker", unitsPerLineItem: 2 }],
      }),
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Listings saved for Bose speaker.");

    fireEvent.click(screen.getByRole("button", { name: "Enable checks for Bose S1 Pro · Single" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/inventory", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        action: "set_listing_tracked",
        catalogKey: "equipment:bose-s1-pro:Single speaker",
        tracked: true,
      }),
    })));
  });

  it("records purchase amounts and GST as entered from the receipt", async () => {
    const fetchMock = installFetch();
    render(<AdminInventory />);
    await openBoseProduct();

    fireEvent.change(screen.getByLabelText("Purchase quantity for Bose speaker"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Purchase total for Bose speaker"), { target: { value: "1100.00" } });
    fireEvent.change(screen.getByLabelText("Purchase GST for Bose speaker"), { target: { value: "100.00" } });
    fireEvent.change(screen.getByLabelText("Purchase supplier for Bose speaker"), { target: { value: "Audio shop" } });
    fireEvent.change(screen.getByLabelText("Purchase reference for Bose speaker"), { target: { value: "INV-100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save purchase" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/inventory", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"totalCostCents":110000'),
    })));
    const request = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      action: "record_purchase",
      quantity: 2,
      totalCostCents: 110000,
      gstPaidCents: 10000,
      supplier: "Audio shop",
      reference: "INV-100",
    });
  });

  it("shows purchase and stock history inside the product details", async () => {
    installFetch();
    render(<AdminInventory />);
    await openBoseProduct();

    fireEvent.click(screen.getByText("Purchase and stock history (2)"));
    expect(screen.getByText("$1,100.00 total · $100.00 GST")).toBeInTheDocument();
    expect(screen.getByText("2026-03-11 · Damaged")).toBeInTheDocument();
  });

  it("filters a product's mapping choices by category", async () => {
    const fetchMock = installFetch();
    render(<AdminInventory />);
    await openBoseProduct();

    fireEvent.change(screen.getByLabelText("Category for listing 1"), { target: { value: "Packages" } });
    const listing = screen.getByLabelText("Mapped listing 1");
    expect(listing).toHaveValue("package:speech-presentation-wireless");
    const options = within(listing).getAllByRole("option");
    expect(options).toHaveLength(5);
    expect(options.every((option) => (option as HTMLOptionElement).value.startsWith("package:"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Save listings" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/inventory", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"catalogKey":"package:speech-presentation-wireless"'),
    })));
  });

  it("creates a product with an opening on-hand count", async () => {
    const fetchMock = installFetch();
    render(<AdminInventory />);
    fireEvent.click(await screen.findByRole("button", { name: "Browse Effects inventory" }));

    expect(screen.queryByLabelText("New inventory product name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("New product name in Effects"), { target: { value: "Smoke machine" } });
    fireEvent.change(screen.getByLabelText("Opening quantity in Effects"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/inventory", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "create_product", name: "Smoke machine", category: "Effects", openingQuantity: 1, mappings: [] }),
    })));
  });

  it("keeps products without a stored category visible", async () => {
    installFetch({
      ...inventory,
      products: [{ ...product, category: null }],
    });
    render(<AdminInventory />);

    fireEvent.click(await screen.findByRole("button", { name: "Browse Uncategorized inventory" }));
    expect(await screen.findByText("Bose speaker")).toBeInTheDocument();
    expect(screen.getByText("Existing products without a category remain visible here.")).toBeInTheDocument();
  });

  it("places existing catalog products without a stored category into their website category", async () => {
    installFetch({
      ...inventory,
      products: [{ ...product, name: "Bose S1 Pro PA Speaker", category: null }],
    });
    render(<AdminInventory />);

    const speakersCategory = await screen.findByRole("button", { name: "Browse Speakers inventory" });
    expect(speakersCategory).toHaveTextContent("1 product");
    expect(screen.queryByRole("button", { name: "Browse Uncategorized inventory" })).not.toBeInTheDocument();
    fireEvent.click(speakersCategory);
    expect(screen.getByText("1 product · 4 units on hand")).toBeInTheDocument();
  });

  it("keeps product details collapsed until the user opens a category and product", async () => {
    installFetch();
    render(<AdminInventory />);

    fireEvent.click(await screen.findByRole("button", { name: "Browse Speakers inventory" }));
    const productName = await screen.findByText("Bose speaker");
    const productDetails = productName.closest("details");
    expect(productDetails).not.toHaveAttribute("open");
    fireEvent.click(productName);
    expect(productDetails).toHaveAttribute("open");
    expect(await screen.findByRole("textbox", { name: "Purchase total for Bose speaker" })).toBeVisible();
  });
});
