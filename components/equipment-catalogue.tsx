"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";

import { EquipmentCard } from "@/components/equipment-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  defaultEquipmentFilters,
  equipmentSortOptions,
  filterEquipment,
  getEquipmentCategories,
  readEquipmentFilters,
  type EquipmentFilters,
} from "@/lib/equipment-catalogue";
import type { EquipmentItem } from "@/lib/site-content";

type CatalogueProps = { items: EquipmentItem[] };
type CatalogueViewProps = CatalogueProps & {
  filters: EquipmentFilters;
  onChange?: (filters: EquipmentFilters, history: "push" | "replace") => void;
};

export function EquipmentCatalogue({ items }: CatalogueProps) {
  const params = useSearchParams();
  const filters = readEquipmentFilters(params, items);

  function changeFilters(next: EquipmentFilters, history: "push" | "replace") {
    const updated = new URLSearchParams(params.toString());
    for (const [key, value, defaultValue] of [
      ["q", next.query, ""],
      ["category", next.category, "all"],
      ["sort", next.sort, "recommended"],
    ]) {
      if (value === defaultValue) updated.delete(key);
      else updated.set(key, value);
    }
    const query = updated.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (history === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  return <EquipmentCatalogueView items={items} filters={filters} onChange={changeFilters} />;
}

export function EquipmentCatalogueFallback({ items }: CatalogueProps) {
  return <EquipmentCatalogueView items={items} filters={defaultEquipmentFilters} />;
}

function EquipmentCatalogueView({ items, filters, onChange }: CatalogueViewProps) {
  const catalogueRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickyTop = useRef(64);
  const loading = !onChange;
  const results = filterEquipment(items, filters);
  const searchMatches = filterEquipment(items, { ...filters, category: "all", sort: "recommended" });
  const categories = getEquipmentCategories(items);
  const activeCategory = categories.find((category) => category.key === filters.category);
  const hasFilters = filters.query.length > 0
    || filters.category !== "all"
    || filters.sort !== "recommended";
  const selectClassName = "h-12 w-full min-w-0 appearance-none rounded-xl border bg-background py-2 pl-3 pr-7 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait lg:text-sm";

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-navbar");
    if (!header) return;

    const updateOffset = () => {
      stickyTop.current = header.getBoundingClientRect().height + 8;
      toolbarRef.current?.style.setProperty("--equipment-filter-top", `${stickyTop.current}px`);
    };

    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  function change(next: EquipmentFilters, history: "push" | "replace" = "push") {
    const root = catalogueRef.current;
    if (root) {
      const top = Math.max(0, root.getBoundingClientRect().top + window.scrollY - stickyTop.current);
      if (window.scrollY > top) window.scrollTo({ top, behavior: "instant" });
    }
    onChange?.(next, history);
  }

  function reset() {
    change(defaultEquipmentFilters);
    inputRef.current?.focus({ preventScroll: true });
  }

  function clearSearch() {
    change({ ...filters, query: "" }, "replace");
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <div ref={catalogueRef}>
      <div
        ref={toolbarRef}
        role="search"
        aria-label="Find equipment"
        aria-busy={loading}
        className="sticky top-[var(--equipment-filter-top,4rem)] z-30 mb-6 rounded-2xl border border-primary/25 bg-background/95 p-3 shadow-[0_12px_36px_rgb(0_0_0/0.22)] backdrop-blur-xl sm:p-4"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <div className="relative col-span-2 min-w-0 lg:col-span-1">
            <label htmlFor="equipment-search" className="sr-only">Search equipment</label>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 text-primary" aria-hidden="true" />
            <Input
              ref={inputRef}
              id="equipment-search"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search gear or brands..."
              value={filters.query}
              disabled={loading}
              aria-controls="equipment-results"
              onChange={(event) => change({ ...filters, query: event.target.value }, "replace")}
              onKeyDown={(event) => {
                if (event.key === "Escape" && filters.query) {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              className="h-12 rounded-xl border-primary/25 bg-primary/[0.03] pr-12 pl-11 text-base placeholder:text-muted-foreground/80 md:text-base"
            />
            {filters.query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clearSearch}
                className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="relative min-w-0">
            <label htmlFor="equipment-category" className="sr-only">Equipment category</label>
            <select
              id="equipment-category"
              value={filters.category}
              disabled={loading}
              onChange={(event) => change({ ...filters, category: event.target.value })}
              aria-controls="equipment-results"
              className={selectClassName}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="relative min-w-0">
            <label htmlFor="equipment-sort" className="sr-only">Sort equipment</label>
            <select
              id="equipment-sort"
              value={filters.sort}
              disabled={loading}
              onChange={(event) => {
                const sort = equipmentSortOptions.find((option) => option.value === event.target.value)?.value;
                if (sort) change({ ...filters, sort });
              }}
              aria-controls="equipment-results"
              aria-describedby="equipment-sort-hint"
              className={selectClassName}
            >
              {equipmentSortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
        <div className={hasFilters || loading ? "mt-3 flex min-h-7 flex-wrap items-center justify-between gap-2" : "sr-only"}>
          <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
            {loading ? "Loading filters..." : (
              <>
                <span className="font-medium tabular-nums text-foreground">{results.length}</span>
                {` ${results.length === 1 ? "item" : "items"}`}
                {hasFilters ? <span>{` of ${items.length}`}</span> : null}
              </>
            )}
          </p>
          {hasFilters && !loading ? (
            <button type="button" onClick={reset} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset filters
            </button>
          ) : null}
        </div>
        <p
          id="equipment-sort-hint"
          className={filters.sort.startsWith("price-") ? "mt-1 text-xs text-muted-foreground" : "sr-only"}
        >
          Price order uses the lowest nightly hire option.
        </p>
      </div>
      <section id="equipment-results" aria-label="Equipment results" aria-busy={loading} inert={loading}>
        {results.length ? (
          <div className="grid gap-6 md:grid-cols-2">
            {results.map((item, index) => (
              <EquipmentCard key={item.slug} item={item} priority={index < 2} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.025] px-5 py-14 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <SearchX className="size-6" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold">No gear found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
              {activeCategory
                ? `No matches${filters.query.trim() ? ` for "${filters.query.trim()}"` : ""} in ${activeCategory.label.toLowerCase()}.`
                : "Try a brand, model name, or a broader search such as speakers, microphones, or lighting."}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {activeCategory && searchMatches.length > 0 ? (
                <Button onClick={() => change({ ...filters, category: "all" })} className="min-h-11 rounded-xl">
                  Search all categories ({searchMatches.length})
                </Button>
              ) : null}
              <Button variant="outline" onClick={reset} className="min-h-11 rounded-xl">
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
