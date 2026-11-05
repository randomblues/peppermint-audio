import { z } from "zod";

import { addOnCatalog, equipmentCatalog, packageTiers } from "@/lib/site-content";

function inventoryDisplayName(name: string) {
  return name
    .replace("Bose S1 Pro PA Speaker", "Bose S1 Pro")
    .replace("Yamaha DXR15 PA Speaker", "Yamaha DXR15")
    .replace("Behringer Eurolive B1200D Pro Active Subwoofer", "Behringer B1200D Pro")
    .replace("PreSonus AIR15s Active Subwoofer", "PreSonus AIR15s")
    .replace("Behringer Ultravoice XM8500 Dynamic Microphone", "Behringer XM8500")
    .replace("Spirit E12 / 12-Channel Soundcraft Mixer", "Spirit E12")
    .replace("Behringer X32 Digital Mixer", "Behringer X32")
    .replace("CR Lite MagikBar Hub Party Bar", "CR Lite MagikBar")
    .replace("BeamZ S1500 Smoke Machine", "BeamZ S1500")
    .replace("Party Light PAR Can", "PAR Can");
}

export const inventoryCatalogOptions = [
  ...packageTiers.map((item) => ({
    catalogKey: `package:${item.slug}`,
    label: item.name.replace(/ Package$/, ""),
    category: "Packages",
  })),
  ...equipmentCatalog.flatMap((item) => item.options.map((option) => {
    const optionLabel = option.label === "Pair (2 speakers)" ? "Pair (2)"
      : option.label === "Single speaker" ? "Single"
        : option.label;
    return {
      catalogKey: `equipment:${item.slug}:${option.label}`,
      label: item.options.length > 1 ? `${inventoryDisplayName(item.name)} · ${optionLabel}` : inventoryDisplayName(item.name),
      category: item.category,
    };
  })),
  ...Object.entries(addOnCatalog).map(([slug, item]) => ({
    catalogKey: `addon:${slug}`,
    label: inventoryDisplayName(item.name.replace(" Upgrade", "")),
    category: item.category ?? (slug === "wireless-microphones" ? "Microphones" : "Accessories"),
  })),
];

const categoryOrder = ["Packages", "Speakers", "Subwoofers", "Microphones", "Effects", "Mixers", "DI boxes", "Lighting", "Accessories"];

export const inventoryCatalogCategories = categoryOrder.filter((category) =>
  inventoryCatalogOptions.some((option) => option.category === category),
);
export const inventoryProductCategories = inventoryCatalogCategories.filter((category) => category !== "Packages");

const normalizeInventoryProductName = (name: string) => name.replace(/ Upgrade$/, "");
const catalogProductCategories = new Map<string, string>([
  ...equipmentCatalog.map((item) => [normalizeInventoryProductName(item.name), item.category] as const),
  ...Object.entries(addOnCatalog).map(([slug, item]) => [
    normalizeInventoryProductName(item.name),
    item.category ?? (slug === "wireless-microphones" ? "Microphones" : "Accessories"),
  ] as const),
]);
const uncategorizedCatalogProductOverrides = new Map([
  ["Speaker Stand", "Accessories"],
  ["Behringer Xenyx 2-channel Mixer", "Mixers"],
]);

export function inventoryProductCategory(name: string, category: string | null) {
  if (category?.trim()) return category;
  return uncategorizedCatalogProductOverrides.get(name)
    ?? catalogProductCategories.get(normalizeInventoryProductName(name))
    ?? "Uncategorized";
}

const catalogKeys = new Set(inventoryCatalogOptions.map((option) => option.catalogKey));

export const inventoryCatalogKeySchema = z.string().refine((value) => catalogKeys.has(value), "Choose a listed package or equipment option.");

export const inventoryMappingSchema = z.object({
  catalogKey: inventoryCatalogKeySchema,
  unitsPerLineItem: z.number().int().min(1).max(1000),
});

export const inventoryMappingsSchema = z.array(inventoryMappingSchema)
  .max(100)
  .refine((mappings) => new Set(mappings.map(({ catalogKey }) => catalogKey)).size === mappings.length, {
    message: "Each listed package or equipment option can only be mapped once per product.",
  });

export const inventoryProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().refine((value) => inventoryProductCategories.includes(value), "Choose an equipment category."),
  openingQuantity: z.number().int().min(0).max(100_000),
  mappings: inventoryMappingsSchema,
});

export const inventoryPurchaseSchema = z.object({
  productId: z.string().uuid(),
  purchaseDate: z.string().refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid purchase date."),
  quantity: z.number().int().min(1).max(100_000),
  totalCostCents: z.number().int().min(0).max(100_000_000),
  gstPaidCents: z.number().int().min(0).max(100_000_000),
  supplier: z.string().trim().max(200).default(""),
  reference: z.string().trim().max(200).default(""),
}).refine((purchase) => purchase.gstPaidCents <= purchase.totalCostCents, {
  message: "GST recorded cannot exceed the total purchase cost.",
  path: ["gstPaidCents"],
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantityChange: z.number().int().min(-100_000).max(100_000).refine((value) => value !== 0),
  reason: z.string().trim().min(1).max(500),
});
