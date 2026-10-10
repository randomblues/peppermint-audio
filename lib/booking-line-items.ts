import { z } from "zod";

import { addOnCatalog, equipmentCatalog, hirePricing, packageTiers } from "@/lib/site-content";
import { rentalDays } from "@/lib/payment-flow";

export const bookingLineItemSchema = z.object({
  id: z.string().min(1).max(180),
  kind: z.enum(["package", "equipment", "custom"]),
  catalogKey: z.string().max(180).optional(),
  name: z.string().min(1).max(200),
  option: z.string().max(160).optional(),
  quantity: z.number().int().min(1).max(100),
  unitPriceCents: z.number().int().min(0).max(10_000_000),
});

export type BookingLineItem = z.infer<typeof bookingLineItemSchema>;

type StoredBooking = {
  hire_line_items?: unknown;
};

function packageLineItem(slug: string) {
  const pkg = packageTiers.find((entry) => entry.slug === slug);
  return pkg
    ? {
      id: `package:${pkg.slug}`,
      kind: "package" as const,
      catalogKey: `package:${pkg.slug}`,
      name: pkg.name,
      quantity: 1,
      unitPriceCents: Math.round(pkg.price * 100),
    }
    : null;
}

function equipmentLineItem(slug: string, optionLabel: string) {
  const item = equipmentCatalog.find((entry) => entry.slug === slug);
  const option = item?.options.find((entry) => entry.label === optionLabel);
  return item && option
    ? {
      id: `equipment:${item.slug}:${option.label}`,
      kind: "equipment" as const,
      catalogKey: `equipment:${item.slug}:${option.label}`,
      name: item.name,
      option: option.label,
      quantity: 1,
      unitPriceCents: Math.round(option.price * 100),
    }
    : null;
}

export function catalogLineItemFromKey(key: string) {
  const [kind, slug, ...optionParts] = key.split(":");
  if (kind === "package" && slug) return packageLineItem(slug);
  if (kind === "equipment" && slug && optionParts.length) return equipmentLineItem(slug, optionParts.join(":"));
  if (kind === "addon" && slug) {
    const addOn = addOnCatalog[slug];
    return addOn
      ? {
        id: `addon:${slug}`,
        kind: "equipment" as const,
        catalogKey: `addon:${slug}`,
        name: addOn.name.replace(" Upgrade", ""),
        option: "Single item",
        quantity: 1,
        unitPriceCents: Math.round(addOn.price * 100),
      }
      : null;
  }
  return null;
}

export function catalogLineItemOptions() {
  return [
    ...packageTiers.map((pkg) => ({
      key: `package:${pkg.slug}`,
      label: pkg.name,
      detail: "Package",
      category: "Packages",
      item: packageLineItem(pkg.slug)!,
    })),
    ...equipmentCatalog.flatMap((item) => item.options.map((option) => ({
      key: `equipment:${item.slug}:${option.label}`,
      label: item.name,
      detail: option.label,
      category: item.category,
      item: equipmentLineItem(item.slug, option.label)!,
    }))),
  ];
}

export function catalogLineItemGroups() {
  const options = catalogLineItemOptions();
  const categoryOrder = ["Packages", "Speakers", "Subwoofers", "Microphones", "Mixers", "DI boxes", "Lighting", "Accessories"];
  return categoryOrder.flatMap((category) => {
    const categoryOptions = options.filter((option) => option.category === category);
    return categoryOptions.length ? [{ label: category, options: categoryOptions }] : [];
  });
}

export function customBookingLineItem(name: string, unitPriceCents: number, id = `custom:${Date.now()}`): BookingLineItem {
  return {
    id,
    kind: "custom",
    name: name.trim(),
    quantity: 1,
    unitPriceCents,
  };
}

export function lineItemHireTotalCents(item: BookingLineItem, nights = 1) {
  if (!Number.isSafeInteger(nights) || nights < 1) throw new Error("Hire duration must be at least one whole night.");
  const multiplier = item.kind === "custom" ? 1 : 1 + hirePricing.additionalNightRate * (nights - 1);
  return Math.round(item.unitPriceCents * multiplier) * item.quantity;
}

export function lineItemsTotalCents(items: BookingLineItem[], nights = 1) {
  return items.reduce((total, item) => total + lineItemHireTotalCents(item, nights), 0);
}

export function bookingHireTotalCents(items: BookingLineItem[], pickupDate: string, dropoffDate: string) {
  const nights = rentalDays(pickupDate, dropoffDate);
  if (nights === null) throw new Error("The booking dates are invalid.");
  return lineItemsTotalCents(items, nights);
}

function formatBookingLineItem(item: BookingLineItem) {
  return `${item.quantity > 1 ? `${item.quantity} × ` : ""}${item.name}${item.option ? ` (${item.option})` : ""}`;
}

export function summarizeBookingLineItems(items: BookingLineItem[]) {
  return items.map(formatBookingLineItem).join(", ");
}

export function parseBookingLineItems(input: unknown) {
  const result = z.array(bookingLineItemSchema).max(100).safeParse(input);
  if (!result.success) return { error: "Hire items are invalid. Please review the item names, quantities, and prices." } as const;

  const normalized: BookingLineItem[] = [];
  for (const item of result.data) {
    if (item.kind !== "custom") {
      const catalogItem = item.catalogKey ? catalogLineItemFromKey(item.catalogKey) : null;
      if (!catalogItem) return { error: "A selected package or product is no longer available." } as const;
      normalized.push({ ...catalogItem, quantity: item.quantity });
    } else {
      if (!item.name.trim()) return { error: "Custom hire items need a name." } as const;
      normalized.push({ ...item, name: item.name.trim() });
    }
  }
  if (!normalized.length) return { error: "Add at least one hire item before creating an invoice." } as const;
  return { items: normalized, totalCents: lineItemsTotalCents(normalized) } as const;
}

function parseCartItems(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const id = "id" in entry && typeof entry.id === "string" ? entry.id : "";
      const quantity = "quantity" in entry && typeof entry.quantity === "number" ? entry.quantity : 1;
      const catalogItem = catalogLineItemFromKey(id);
      return catalogItem && Number.isInteger(quantity) && quantity > 0
        ? [{ ...catalogItem, quantity }]
        : [];
    });
  } catch {
    return [];
  }
}

export function lineItemsFromCart(cartJson: string): BookingLineItem[] {
  return parseCartItems(cartJson);
}

export function lineItemsForBooking(booking: StoredBooking): BookingLineItem[] {
  if (booking.hire_line_items === null || booking.hire_line_items === undefined) return [];
  const stored = z.array(bookingLineItemSchema).max(100).safeParse(booking.hire_line_items);
  if (!stored.success) throw new Error("Stored hire items are invalid.");
  return stored.data;
}
