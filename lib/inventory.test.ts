import { describe, expect, it } from "vitest";

import {
  inventoryAdjustmentSchema,
  inventoryCatalogCategories,
  inventoryCatalogOptions,
  inventoryProductCategory,
  inventoryMappingsSchema,
  inventoryProductSchema,
  inventoryPurchaseSchema,
} from "@/lib/inventory";

describe("inventory validation", () => {
  it("offers package, equipment-option, and add-on keys for internal stock mapping", () => {
    expect(inventoryCatalogCategories).toContain("Speakers");
    expect(inventoryCatalogCategories).toContain("Microphones");
    expect(inventoryCatalogOptions).toEqual(expect.arrayContaining([expect.objectContaining({
      catalogKey: "package:standard-party-events",
      label: "Standard Party & Events",
      category: "Packages",
    })]));
    expect(inventoryCatalogOptions.some(({ catalogKey }) => catalogKey.startsWith("equipment:"))).toBe(true);
    expect(inventoryCatalogOptions.some(({ catalogKey }) => catalogKey.startsWith("addon:"))).toBe(true);
    expect(inventoryCatalogOptions.find(({ catalogKey }) => catalogKey === "equipment:bose-s1-pro:Pair (2 speakers)")?.label)
      .toBe("Bose S1 Pro · Pair (2)");
  });

  it("uses website categories for existing inventory rows with no stored category", () => {
    expect(inventoryProductCategory("Bose S1 Pro PA Speaker", null)).toBe("Speakers");
    expect(inventoryProductCategory("Behringer X32 Digital Mixer", null)).toBe("Mixers");
    expect(inventoryProductCategory("Behringer Xenyx 2-channel Mixer", null)).toBe("Mixers");
    expect(inventoryProductCategory("Speaker Stand", null)).toBe("Accessories");
    expect(inventoryProductCategory("Mystery product", "Lighting")).toBe("Lighting");
    expect(inventoryProductCategory("Mystery product", null)).toBe("Uncategorized");
  });

  it("requires unique listed catalog mappings with positive component quantities", () => {
    expect(inventoryMappingsSchema.safeParse([
      { catalogKey: "equipment:bose-s1-pro:Single speaker", unitsPerLineItem: 1 },
      { catalogKey: "equipment:bose-s1-pro:Pair (2 speakers)", unitsPerLineItem: 2 },
    ]).success).toBe(true);
    expect(inventoryMappingsSchema.safeParse([
      { catalogKey: "equipment:bose-s1-pro:Single speaker", unitsPerLineItem: 1 },
      { catalogKey: "equipment:bose-s1-pro:Single speaker", unitsPerLineItem: 2 },
    ]).success).toBe(false);
    expect(inventoryMappingsSchema.safeParse([
      { catalogKey: "unlisted:product", unitsPerLineItem: 1 },
    ]).success).toBe(false);
  });

  it("validates product and purchase amounts without calculating tax treatment", () => {
    expect(inventoryProductSchema.safeParse({
      name: "Smoke machine",
      category: "Effects",
      openingQuantity: 1,
      mappings: [],
    }).success).toBe(true);
    expect(inventoryProductSchema.safeParse({
      name: "Mystery product",
      category: "Package components",
      openingQuantity: 1,
      mappings: [],
    }).success).toBe(false);
    expect(inventoryPurchaseSchema.safeParse({
      productId: "7b6e5e2e-6bc7-4c7f-a5e0-34d065f80f84",
      purchaseDate: "2026-11-05",
      quantity: 2,
      totalCostCents: 50000,
      gstPaidCents: 4545,
    }).success).toBe(true);
    expect(inventoryPurchaseSchema.safeParse({
      productId: "7b6e5e2e-6bc7-4c7f-a5e0-34d065f80f84",
      purchaseDate: "2026-11-05",
      quantity: 2,
      totalCostCents: 50000,
      gstPaidCents: 50001,
    }).success).toBe(false);
    expect(inventoryPurchaseSchema.safeParse({
      productId: "7b6e5e2e-6bc7-4c7f-a5e0-34d065f80f84",
      purchaseDate: "2026-02-30",
      quantity: 1,
      totalCostCents: 5000,
      gstPaidCents: 0,
    }).success).toBe(false);
  });

  it("requires nonzero stock adjustments with an audit reason", () => {
    expect(inventoryAdjustmentSchema.safeParse({
      productId: "7b6e5e2e-6bc7-4c7f-a5e0-34d065f80f84",
      quantityChange: -1,
      reason: "Damaged",
    }).success).toBe(true);
    expect(inventoryAdjustmentSchema.safeParse({
      productId: "7b6e5e2e-6bc7-4c7f-a5e0-34d065f80f84",
      quantityChange: 0,
      reason: "Counted",
    }).success).toBe(false);
  });
});
