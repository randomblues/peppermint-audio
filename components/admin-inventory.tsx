"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Box,
  Cable,
  ChevronDown,
  Lightbulb,
  Mic2,
  Package,
  Search,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  inventoryCatalogCategories,
  inventoryCatalogOptions,
  inventoryProductCategories,
  inventoryProductCategory,
} from "@/lib/inventory";

type Product = {
  id: string;
  name: string;
  quantity_on_hand: number;
  category: string | null;
};
type Mapping = {
  catalogKey: string;
  unitsPerLineItem: number;
};
type Purchase = {
  id: string;
  product_id: string;
  product_name: string;
  purchase_date: string;
  quantity: number;
  total_cost_cents: number;
  gst_paid_cents: number;
  supplier: string;
  reference: string;
};
type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity_change: number;
  reason: string;
  created_at: string;
};
type PurchaseDraft = {
  date: string;
  quantity: string;
  totalCost: string;
  gstPaid: string;
  supplier: string;
  reference: string;
};

function todayLocal() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function dollarsToCents(value: string) {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  return Math.round(Number(value) * 100);
}

function money(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const props = { className, strokeWidth: 1.75 };
  if (category === "Speakers") return <Volume2 {...props} />;
  if (category === "Subwoofers") return <AudioLines {...props} />;
  if (category === "Microphones") return <Mic2 {...props} />;
  if (category === "Effects") return <Sparkles {...props} />;
  if (category === "Mixers") return <SlidersHorizontal {...props} />;
  if (category === "DI boxes") return <Box {...props} />;
  if (category === "Lighting") return <Lightbulb {...props} />;
  if (category === "Accessories") return <Cable {...props} />;
  return <Package {...props} />;
}

const categoryStyles: Record<string, { icon: string; glow: string }> = {
  Speakers: { icon: "bg-sky-400/10 text-sky-300 ring-sky-300/20", glow: "from-sky-400/15" },
  Subwoofers: { icon: "bg-violet-400/10 text-violet-300 ring-violet-300/20", glow: "from-violet-400/15" },
  Microphones: { icon: "bg-rose-400/10 text-rose-300 ring-rose-300/20", glow: "from-rose-400/15" },
  Effects: { icon: "bg-amber-400/10 text-amber-300 ring-amber-300/20", glow: "from-amber-400/15" },
  Mixers: { icon: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20", glow: "from-emerald-400/15" },
  "DI boxes": { icon: "bg-cyan-400/10 text-cyan-300 ring-cyan-300/20", glow: "from-cyan-400/15" },
  Lighting: { icon: "bg-yellow-400/10 text-yellow-300 ring-yellow-300/20", glow: "from-yellow-400/15" },
  Accessories: { icon: "bg-indigo-400/10 text-indigo-300 ring-indigo-300/20", glow: "from-indigo-400/15" },
  Uncategorized: { icon: "bg-muted text-muted-foreground ring-border", glow: "from-muted/40" },
};

async function postInventory(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Inventory update failed.");
}

function MappingEditor({
  idPrefix,
  mappings,
  onChange,
}: {
  idPrefix: string;
  mappings: Mapping[];
  onChange: (mappings: Mapping[]) => void;
}) {
  const optionsByKey = new Map(inventoryCatalogOptions.map((option) => [option.catalogKey, option.label]));
  const available = inventoryCatalogOptions.filter((option) => !mappings.some((mapping) => mapping.catalogKey === option.catalogKey));
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Listings that use this product</p>
      <p className="text-xs leading-5 text-muted-foreground">Enter the number of these inventory units used by one booking line. For example, a speaker-pair option uses two speakers.</p>
      {mappings.map((mapping, index) => {
        const rowOptions = inventoryCatalogOptions.filter((option) =>
          !mappings.some((item, itemIndex) => itemIndex !== index && item.catalogKey === option.catalogKey));
        const category = inventoryCatalogOptions.find((option) => option.catalogKey === mapping.catalogKey)?.category ?? "";
        const rowCategories = inventoryCatalogCategories.filter((item) => rowOptions.some((option) => option.category === item));
        return (
        <div key={`${idPrefix}-${mapping.catalogKey}`} className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_7rem_auto]">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-category-${index}`}>Category
            <select
              id={`${idPrefix}-category-${index}`}
              aria-label={`Category for listing ${index + 1}`}
              value={category}
              onChange={(event) => {
                const next = rowOptions.find((option) => option.category === event.target.value);
                if (next) onChange(mappings.map((item, itemIndex) => itemIndex === index ? { ...item, catalogKey: next.catalogKey } : item));
              }}
              className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm"
            >
              {rowCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-catalog-${index}`}>Listing
            <select
              id={`${idPrefix}-catalog-${index}`}
              aria-label={`Mapped listing ${index + 1}`}
              value={mapping.catalogKey}
              onChange={(event) => onChange(mappings.map((item, itemIndex) => itemIndex === index ? { ...item, catalogKey: event.target.value } : item))}
              className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm"
            >
              {rowOptions.filter((option) => option.category === category).map((option) => <option key={option.catalogKey} value={option.catalogKey}>{optionsByKey.get(option.catalogKey) ?? option.catalogKey}</option>)}
            </select>
          </label>
          <label className="sr-only" htmlFor={`${idPrefix}-units-${index}`}>Inventory units used per booking line</label>
          <input
            id={`${idPrefix}-units-${index}`}
            aria-label={`Inventory units for listing ${index + 1}`}
            type="number"
            min="1"
            max="1000"
            value={mapping.unitsPerLineItem}
            onChange={(event) => onChange(mappings.map((item, itemIndex) => itemIndex === index ? { ...item, unitsPerLineItem: Number(event.target.value) } : item))}
            className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm"
          />
          <Button type="button" variant="outline" onClick={() => onChange(mappings.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
        </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        disabled={!available.length}
        onClick={() => {
          const option = available[0];
          if (option) onChange([...mappings, { catalogKey: option.catalogKey, unitsPerLineItem: 1 }]);
        }}
      >
        Add listing
      </Button>
    </div>
  );
}

export function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, Mapping[]>>({});
  const [purchaseDrafts, setPurchaseDrafts] = useState<Record<string, PurchaseDraft>>({});
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("All categories");
  const [productName, setProductName] = useState("");
  const [addingProductCategory, setAddingProductCategory] = useState<string | null>(null);
  const [openingQuantity, setOpeningQuantity] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/inventory", { cache: "no-store" });
      const data = await response.json() as {
        products?: Product[];
        mappings?: Array<{ product_id: string; catalog_key: string; units_per_line_item: number }>;
        purchases?: Purchase[];
        movements?: Movement[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Inventory could not be loaded.");
      const mappings = data.mappings ?? [];
      const nextProducts = data.products ?? [];
      setProducts(nextProducts);
      setPurchases(data.purchases ?? []);
      setMovements(data.movements ?? []);
      const nextMappings = Object.fromEntries(nextProducts.map((product) => [
        product.id,
        mappings.filter((mapping) => mapping.product_id === product.id)
          .map(({ catalog_key, units_per_line_item }) => ({ catalogKey: catalog_key, unitsPerLineItem: units_per_line_item })),
      ]));
      setMappingDrafts(nextMappings);
      setPurchaseDrafts((current) => Object.fromEntries(nextProducts.map((product) => [
        product.id,
        current[product.id] ?? { date: todayLocal(), quantity: "1", totalCost: "", gstPaid: "", supplier: "", reference: "" },
      ])));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inventory could not be loaded.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(action: () => Promise<void>, successMessage: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (await load()) setMessage(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inventory update failed.");
    } finally {
      setSaving(false);
    }
  }

  function updatePurchaseDraft(id: string, values: Partial<PurchaseDraft>) {
    setPurchaseDrafts((current) => ({ ...current, [id]: { ...current[id], ...values } }));
  }

  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const productCategory = (product: Product) => inventoryProductCategory(product.name, product.category);
  const visibleProducts = products.filter((product) =>
    (productCategoryFilter === "All categories" || productCategory(product) === productCategoryFilter)
    && (!normalizedProductSearch || product.name.toLowerCase().includes(normalizedProductSearch)));
  const extraProductCategories = [...new Set(products.map(productCategory))]
    .filter((category) => !inventoryProductCategories.includes(category))
    .sort();
  const allProductCategories = [...inventoryProductCategories, ...extraProductCategories];
  const categorySummaries = allProductCategories.map((category) => {
    const categoryProducts = products.filter((product) => productCategory(product) === category);
    return {
      category,
      productCount: categoryProducts.length,
      units: categoryProducts.reduce((total, product) => total + product.quantity_on_hand, 0),
    };
  });
  const categoriesToShow = allProductCategories.filter((category) =>
    productCategoryFilter === "All categories"
      ? !normalizedProductSearch || visibleProducts.some((product) => productCategory(product) === category)
      : category === productCategoryFilter);
  const visibleProductGroups = categoriesToShow.map((category) => {
    const categoryProducts = visibleProducts.filter((product) => productCategory(product) === category);
    return { category, products: categoryProducts };
  });

  return (
    <section aria-labelledby="inventory-title" className="min-w-0 space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Internal operations</p>
        <h1 id="inventory-title" className="mt-1 text-3xl font-semibold tracking-tight">Equipment inventory</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Track owned equipment, assign it to hire listings, and record purchase costs and GST from receipts. Inventory details are only available in this admin area.</p>
      </header>

      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">{message}</p> : null}

      <section aria-labelledby="inventory-products-title" className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="inventory-products-title" className="text-xl font-semibold">Products and stock</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse by category or search for a product. Everything you need is kept with the equipment it belongs to.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>Refresh inventory</Button>
        </div>
        <div className="relative min-w-0">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search inventory products" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search equipment by name…" className="h-12 w-full rounded-xl border bg-card/70 py-2 pl-10 pr-11 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
          {productSearch ? <button type="button" aria-label="Clear inventory search" onClick={() => setProductSearch("")} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X aria-hidden="true" className="size-4" />
          </button> : null}
        </div>
        {!loading && products.length ? <p className="text-xs text-muted-foreground">Showing {visibleProducts.length} of {products.length} products · {products.reduce((total, product) => total + product.quantity_on_hand, 0)} units on hand</p> : null}
        {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading inventory…</CardContent></Card>
          : productCategoryFilter === "All categories" && !normalizedProductSearch ? (
            <section aria-labelledby="inventory-category-heading" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Browse inventory</p>
                  <h3 id="inventory-category-heading" className="mt-1 text-lg font-semibold">Choose a category</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Pick a category to see its equipment, add stock, or manage booking checks.</p>
                </div>
                <span className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">{categorySummaries.length} categories</span>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
                {categorySummaries.map(({ category, productCount, units }) => {
                  const style = categoryStyles[category] ?? categoryStyles.Uncategorized;
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-label={`Browse ${category} inventory`}
                      onClick={() => setProductCategoryFilter(category)}
                      className="group relative isolate flex min-h-40 min-w-0 flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"
                    >
                      <span className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${style.glow} via-transparent to-transparent opacity-80`} />
                      <span className="flex items-start justify-between gap-3">
                        <span className={`grid size-11 place-items-center rounded-xl ring-1 ${style.icon}`}>
                          <CategoryIcon category={category} className="size-5" />
                        </span>
                        <span className="grid size-8 place-items-center rounded-full border bg-background/60 text-muted-foreground transition group-hover:border-primary/30 group-hover:text-primary">
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        </span>
                      </span>
                      <span className="mt-5 block min-w-0">
                        <span className="block truncate font-semibold">{category}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {productCount ? `${productCount} product${productCount === 1 ? "" : "s"}` : "Ready for your first product"}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{units} unit{units === 1 ? "" : "s"} on hand</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : normalizedProductSearch && visibleProducts.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No products match these filters.</CardContent></Card>
            : visibleProductGroups.map((group) => {
              const isSelectedCategory = productCategoryFilter === group.category;
              const style = categoryStyles[group.category] ?? categoryStyles.Uncategorized;
              const groupUnits = group.products.reduce((total, product) => total + product.quantity_on_hand, 0);
              return (
                <section key={group.category} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <div className={`border-b bg-gradient-to-br ${style.glow} via-transparent to-transparent p-4 sm:p-6`}>
                    {isSelectedCategory ? <Button type="button" variant="outline" size="sm" onClick={() => {
                      setProductCategoryFilter("All categories");
                      setAddingProductCategory(null);
                    }}>
                      <ArrowLeft aria-hidden="true" className="size-4" />
                      All categories
                    </Button> : <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Search results</p>}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ring-1 ${style.icon}`}>
                          <CategoryIcon category={group.category} className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-semibold">{group.category}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {group.products.length} product{group.products.length === 1 ? "" : "s"} · {groupUnits} unit{groupUnits === 1 ? "" : "s"} on hand
                          </p>
                        </div>
                      </div>
                      {isSelectedCategory && inventoryProductCategories.includes(group.category)
                        ? <Button type="button" onClick={() => {
                          setAddingProductCategory((current) => current === group.category ? null : group.category);
                          setProductName("");
                          setOpeningQuantity("0");
                        }}>
                          {addingProductCategory === group.category ? "Close form" : "Add product"}
                        </Button>
                        : !isSelectedCategory && inventoryProductCategories.includes(group.category)
                          ? <Button type="button" variant="outline" onClick={() => setProductCategoryFilter(group.category)}>Browse {group.category}</Button>
                          : null}
                    </div>
                  </div>
                  <div className="space-y-4 p-3 sm:p-5">
                    {isSelectedCategory && addingProductCategory === group.category ? <form className="grid gap-3 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_10rem_auto] lg:items-end" onSubmit={(event) => {
                      event.preventDefault();
                      const quantity = Number(openingQuantity);
                      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100_000) {
                        setError("Enter a whole-number opening quantity from 0 to 100,000.");
                        return;
                      }
                      void save(async () => {
                        await postInventory({
                          action: "create_product",
                          name: productName,
                          category: group.category,
                          openingQuantity: quantity,
                          mappings: [],
                        });
                        setProductName("");
                        setOpeningQuantity("0");
                        setAddingProductCategory(null);
                        setProductCategoryFilter(group.category);
                      }, `${productName.trim()} added to ${group.category}.`);
                    }}>
                      <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">Product name
                        <input aria-label={`New product name in ${group.category}`} required maxLength={200} value={productName} onChange={(event) => setProductName(event.target.value)} className="h-11 min-w-0 rounded-xl border bg-background px-3 text-sm text-foreground" placeholder="e.g. Smoke machine" />
                      </label>
                      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Opening quantity
                        <input aria-label={`Opening quantity in ${group.category}`} type="number" min="0" max="100000" step="1" required value={openingQuantity} onChange={(event) => setOpeningQuantity(event.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm text-foreground" />
                      </label>
                      <Button type="submit" className="h-11" disabled={saving || loading || !productName.trim()}>Save product</Button>
                    </form> : null}
                    {isSelectedCategory && !group.products.length && addingProductCategory !== group.category
                      ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nothing here yet. Add the equipment you own to start tracking it.</p>
                      : null}
                    {group.category === "Uncategorized" && group.products.length
                      ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Existing products without a category remain visible here.</p>
                      : null}
                    {group.products.map((product) => {
                      const drafts = mappingDrafts[product.id] ?? [];
                      const productPurchases = purchases.filter((purchase) => purchase.product_id === product.id);
                      const productAdjustments = movements.filter((movement) => movement.product_id === product.id && movement.movement_type !== "purchase");
                      const purchase = purchaseDrafts[product.id] ?? { date: todayLocal(), quantity: "1", totalCost: "", gstPaid: "", supplier: "", reference: "" };
                      return (
                <Card key={product.id} data-inventory-product={product.id}>
                  <CardContent className="p-0">
                    <details open={Boolean(normalizedProductSearch)} className="group">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <h4 className="truncate text-base font-semibold">{product.name}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">On hand: <strong className="text-foreground">{product.quantity_on_hand}</strong></p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${drafts.length ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                            {drafts.length ? `${drafts.length} listing${drafts.length === 1 ? "" : "s"} mapped` : "Not mapped"}
                          </span>
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </div>
                      </summary>
                      <div className="space-y-5 border-t p-4 sm:p-5">
                    <MappingEditor
                      idPrefix={`product-${product.id}`}
                      mappings={drafts}
                      onChange={(next) => setMappingDrafts((current) => ({ ...current, [product.id]: next }))}
                    />
                    <Button disabled={saving} onClick={() => void save(async () => {
                      await postInventory({ action: "replace_mappings", productId: product.id, mappings: drafts });
                    }, `Listings saved for ${product.name}.`)}>Save listings</Button>

                    <div className="grid gap-4 border-t pt-4 lg:grid-cols-2">
                      <form className="min-w-0 space-y-3" onSubmit={(event) => {
                        event.preventDefault();
                        const totalCostCents = dollarsToCents(purchase.totalCost);
                        const gstPaidCents = dollarsToCents(purchase.gstPaid);
                        const quantity = Number(purchase.quantity);
                        if (totalCostCents === null || gstPaidCents === null || !Number.isInteger(quantity) || quantity < 1) {
                          setError("Enter a valid whole-number purchase quantity and amounts with up to two decimal places.");
                          return;
                        }
                        void save(async () => {
                          await postInventory({
                            action: "record_purchase",
                            productId: product.id,
                            purchaseDate: purchase.date,
                            quantity,
                            totalCostCents,
                            gstPaidCents,
                            supplier: purchase.supplier,
                            reference: purchase.reference,
                          });
                        }, `Purchase recorded for ${product.name}.`);
                      }}>
                        <div>
                          <h4 className="font-medium">Record a purchase</h4>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Enter total cost and GST exactly as shown on the receipt. This record does not determine tax deductibility.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">Purchase date
                            <input aria-label={`Purchase date for ${product.name}`} type="date" required value={purchase.date} onChange={(event) => updatePurchaseDraft(product.id, { date: event.target.value })} className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm text-foreground" />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Quantity purchased
                            <input aria-label={`Purchase quantity for ${product.name}`} type="number" min="1" max="100000" step="1" required value={purchase.quantity} onChange={(event) => updatePurchaseDraft(product.id, { quantity: event.target.value })} className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground" />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Total paid (AUD)
                            <input aria-label={`Purchase total for ${product.name}`} inputMode="decimal" required value={purchase.totalCost} onChange={(event) => updatePurchaseDraft(product.id, { totalCost: event.target.value })} className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground" placeholder="0.00" />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">GST on receipt (AUD)
                            <input aria-label={`Purchase GST for ${product.name}`} inputMode="decimal" required value={purchase.gstPaid} onChange={(event) => updatePurchaseDraft(product.id, { gstPaid: event.target.value })} className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground" placeholder="0.00" />
                          </label>
                          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">Supplier <span className="font-normal">(optional)</span>
                            <input aria-label={`Purchase supplier for ${product.name}`} maxLength={200} value={purchase.supplier} onChange={(event) => updatePurchaseDraft(product.id, { supplier: event.target.value })} className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm text-foreground" />
                          </label>
                          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">Receipt reference <span className="font-normal">(optional)</span>
                            <input aria-label={`Purchase reference for ${product.name}`} maxLength={200} value={purchase.reference} onChange={(event) => updatePurchaseDraft(product.id, { reference: event.target.value })} className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm text-foreground" />
                          </label>
                        </div>
                        <Button type="submit" variant="outline" disabled={saving}>Save purchase</Button>
                      </form>

                      <form className="min-w-0 space-y-3 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0" onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        const quantityChange = Number(form.get("quantityChange"));
                        const reason = String(form.get("reason") ?? "");
                        if (!Number.isInteger(quantityChange) || quantityChange === 0) {
                          setError("Enter a nonzero whole-number stock adjustment.");
                          return;
                        }
                        void save(async () => {
                          await postInventory({ action: "adjust_stock", productId: product.id, quantityChange, reason });
                        }, `Stock adjusted for ${product.name}.`);
                      }}>
                        <div>
                          <h4 className="font-medium">Adjust counted stock</h4>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Use a positive or negative adjustment for a recount, damage, or loss. Add a reason for your records.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Change in quantity
                            <input name="quantityChange" aria-label={`Stock adjustment for ${product.name}`} type="number" step="1" required className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground" placeholder="e.g. -1 or 2" />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Reason
                            <input name="reason" aria-label={`Adjustment reason for ${product.name}`} required maxLength={500} className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground" placeholder="e.g. Stocktake" />
                          </label>
                        </div>
                        <Button type="submit" variant="outline" disabled={saving}>Save adjustment</Button>
                      </form>
                      </div>
                      <details className="border-t pt-4">
                        <summary className="cursor-pointer text-sm font-medium">
                          Purchase and stock history ({productPurchases.length + productAdjustments.length})
                        </summary>
                        <div className="mt-3 space-y-4">
                          {productPurchases.length ? <ul className="divide-y">
                            {productPurchases.map((entry) => (
                              <li key={entry.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-sm">
                                <span>{entry.purchase_date} · {entry.quantity} unit{entry.quantity === 1 ? "" : "s"}</span>
                                <span>{money(entry.total_cost_cents)} total · {money(entry.gst_paid_cents)} GST</span>
                                <span className="w-full text-xs text-muted-foreground">{[entry.supplier, entry.reference].filter(Boolean).join(" · ") || "No supplier or receipt reference"}</span>
                              </li>
                            ))}
                          </ul> : productAdjustments.length ? <p className="text-sm text-muted-foreground">No purchases recorded for this product yet.</p> : null}
                          {productAdjustments.length ? <div>
                            <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock adjustments</h5>
                            <ul className="mt-2 divide-y text-sm">
                              {productAdjustments.map((movement) => (
                                <li key={movement.id} className="flex flex-wrap justify-between gap-2 py-2">
                                  <span>{movement.created_at.slice(0, 10)} · {movement.reason}</span>
                                  <span>{movement.quantity_change > 0 ? "+" : ""}{movement.quantity_change}</span>
                                </li>
                              ))}
                            </ul>
                          </div> : null}
                          {!productPurchases.length && !productAdjustments.length
                            ? <p className="text-sm text-muted-foreground">No purchase or stock adjustments recorded for this product yet.</p>
                            : null}
                        </div>
                      </details>
                    </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
              );
            })}
      </div>
      </section>
    </section>
  );
}
