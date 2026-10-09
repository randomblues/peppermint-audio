"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, ShoppingCart } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCart } from "@/components/cart-provider";
import { addOnCatalog, hirePricing, type PackageTier } from "@/lib/site-content";

type PackageCardProps = {
  pkg: PackageTier;
  compact?: boolean;
  priority?: boolean;
};

const addOnCoverageKeywords: Record<string, string[]> = {
  "wireless-microphones": ["wireless microphone", "wireless microphones"],
  "party-lights-bar": ["party lights", "party bar", "magikbar"],
  "party-light-par-can": ["party lights", "par can"],
  "extension-reel-10m": ["extension reel", "extension lead", "extension leads"],
};

const upsellPriority = [
  "wireless-microphones",
  "party-lights-bar",
  "party-light-par-can",
  "extension-reel-10m",
] as const;

function isAddOnAlreadyCovered(inclusionsText: string, addOnSlug: string) {
  const keywordMatches = addOnCoverageKeywords[addOnSlug];
  if (keywordMatches) {
    return keywordMatches.some((term) => inclusionsText.includes(term));
  }

  const addOnName = addOnCatalog[addOnSlug]?.name
    .toLowerCase()
    .replace(" upgrade", "");
  if (!addOnName) return false;

  return inclusionsText.includes(addOnName);
}

function createUpsellReason(addOnSlug: string) {
  if (addOnSlug === "wireless-microphones") {
    return "Great for roaming speeches and toasts";
  }
  if (addOnSlug === "party-lights-bar" || addOnSlug === "party-light-par-can") {
    return "Adds party atmosphere to your setup";
  }

  return "Popular extra with this package";
}

export function PackageCard({ pkg, compact = false, priority = false }: PackageCardProps) {
  const { addItem } = useCart();
  const [showAllInclusions, setShowAllInclusions] = useState(false);
  const [showCheckoutPrompt, setShowCheckoutPrompt] = useState(false);
  const [addedUpsellSlugs, setAddedUpsellSlugs] = useState<string[]>([]);
  const inclusionsText = pkg.inclusions.join(" ").toLowerCase();
  const candidateUpsellSlugs = pkg.slug === "speech-presentation-wireless"
    ? ["party-light-par-can"]
    : Array.from(new Set([...upsellPriority, ...pkg.addOnSlugs]));
  const upsellSuggestions = candidateUpsellSlugs
    .filter((slug) => addOnCatalog[slug] && !isAddOnAlreadyCovered(inclusionsText, slug))
    .slice(0, 2)
    .map((slug) => ({
      slug,
      name: addOnCatalog[slug].name.replace(" Upgrade", ""),
      price: addOnCatalog[slug].price,
      reason: createUpsellReason(slug),
    }));
  const hasSuggestions = upsellSuggestions.length > 0;
  const imageClassName =
    pkg.slug === "budget-with-a-boom"
      ? "object-contain p-2"
      : "object-contain";

  function getAddOnDetailsHref(addOnSlug: string) {
    if (addOnSlug === "wireless-microphones") {
      return "/equipment/k60-wireless";
    }

    return `/equipment/hire-${addOnSlug}`;
  }

  function handleAddPackageToCart() {
    addItem({ id: `package:${pkg.slug}`, name: pkg.name, kind: "package", price: pkg.price });
    setAddedUpsellSlugs([]);
    setShowCheckoutPrompt(true);
  }

  function handleAddOnToCart(addOnSlug: string) {
    const addOn = addOnCatalog[addOnSlug];
    if (!addOn) return;

    addItem({
      id: `equipment:hire-${addOnSlug}:Single item`,
      name: addOn.name.replace(" Upgrade", ""),
      kind: "equipment",
      option: "Single item",
      price: addOn.price,
    });
    setAddedUpsellSlugs((current) =>
      current.includes(addOnSlug) ? current : [...current, addOnSlug],
    );
  }

  return (
    <>
      <Card
        className={`h-full overflow-hidden border ${
          compact ? "gap-0 justify-start" : "justify-between"
        }`}
      >
        <div className={`relative bg-white ${compact ? "h-48 sm:h-52" : "h-56 sm:h-64"}`}>
          <Image
            src={pkg.image}
            alt={pkg.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            loading={priority ? "eager" : "lazy"}
            className={imageClassName}
          />
        </div>
        {compact ? (
          <CardHeader className="flex flex-col gap-3 border-b border-border/70 p-4 sm:p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Ready-to-use setup
                </p>
                <CardTitle className="mt-1 text-lg sm:text-xl">{pkg.name}</CardTitle>
                {pkg.notes ? <Badge className="mt-2">{pkg.notes}</Badge> : null}
              </div>
              <div className="relative z-20 min-w-0 shrink-0 rounded-lg border border-border/70 bg-muted/30 px-2 py-1 text-right">
                <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Per night
                </p>
                <p className="mt-0.5 whitespace-nowrap text-2xl font-semibold tracking-tight sm:text-3xl">
                  ${pkg.price}
                </p>
              </div>
            </div>
            <CardDescription className="text-sm leading-6">{pkg.bestFor}</CardDescription>
            <div className="grid grid-cols-2 divide-x rounded-lg border border-border/70 bg-muted/30">
              <div className="px-3 py-2.5">
                <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Capacity
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{pkg.capacity}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Setup
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">Complete system</p>
              </div>
            </div>
          </CardHeader>
        ) : (
          <CardHeader>
            <CardTitle>{pkg.name}</CardTitle>
            <CardAction>{pkg.notes ? <Badge>{pkg.notes}</Badge> : null}</CardAction>
            <CardDescription>{pkg.bestFor}</CardDescription>
            <p className="mt-2 text-3xl font-semibold tracking-tight">${pkg.price}<span className="text-base font-normal text-muted-foreground"> / night</span></p>
          </CardHeader>
        )}
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{hirePricing.summary}</p>
          {compact ? (
            <>
              <div className="flex min-h-20 items-center sm:min-h-24">
                <p className="text-sm leading-6 text-muted-foreground">{pkg.summary}</p>
              </div>
              <div className="mt-5 border-t border-border/70 pt-4">
                <p className="text-sm font-semibold text-foreground">In the box</p>
                <ul className="mt-2 space-y-2 text-sm leading-5 text-muted-foreground">
                  {pkg.inclusions.slice(0, 3).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                  {showAllInclusions
                    ? pkg.inclusions.slice(3).map((item) => <li key={item}>- {item}</li>)
                    : null}
                </ul>
                {pkg.inclusions.length > 3 ? (
                  <button
                    type="button"
                    aria-expanded={showAllInclusions}
                    onClick={() => setShowAllInclusions((isVisible) => !isVisible)}
                    className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                  >
                    {showAllInclusions
                      ? "Show less"
                      : `+ ${pkg.inclusions.length - 3} more included`}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Ideal for {pkg.capacity}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {pkg.inclusions.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
              <p className="mt-5 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Need anything extra?{" "}
                <Link href="/equipment" className="font-medium text-primary hover:underline">
                  Browse individual equipment
                </Link>{" "}
                and add it to your cart.
              </p>
            </>
          )}
        </CardContent>
        <CardFooter
          className={`flex-col gap-2 ${
            compact ? "mt-auto border-t border-border/70 p-4 sm:p-5" : ""
          }`}
        >
          <Button
            className={`${compact ? "h-11 w-full" : "w-full"} rounded-xl border border-primary/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_88%,white),color-mix(in_oklab,var(--primary)_78%,white)_42%,color-mix(in_oklab,var(--primary)_70%,black))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_rgb(0_0_0/0.28),0_0_28px_color-mix(in_oklab,var(--primary)_22%,transparent)] transition-all hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_14px_26px_rgb(0_0_0/0.3),0_0_34px_color-mix(in_oklab,var(--primary)_30%,transparent)]`}
            onClick={handleAddPackageToCart}
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            Add to cart
          </Button>
          <Button
            variant={compact ? "ghost" : "outline"}
            className={
              compact
                ? "w-full rounded-xl border border-primary/15 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_95%,var(--primary)_8%),color-mix(in_oklab,var(--background)_82%,black))] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_16px_rgb(0_0_0/0.2)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_20px_rgb(0_0_0/0.24),0_0_14px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
                : "w-full rounded-xl border border-primary/15 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_95%,var(--primary)_8%),color-mix(in_oklab,var(--background)_82%,black))] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_16px_rgb(0_0_0/0.2)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_20px_rgb(0_0_0/0.24),0_0_14px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
            }
            nativeButton={false}
            render={<Link href={`/packages?package=${pkg.slug}`} />}
          >
            View package details
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Button>
        </CardFooter>
      </Card>
      <DialogPrimitive.Root open={showCheckoutPrompt} onOpenChange={setShowCheckoutPrompt}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/45 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-md" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/20 bg-[linear-gradient(155deg,color-mix(in_oklab,var(--background)_78%,black),color-mix(in_oklab,var(--background)_62%,var(--primary)_18%)_48%,color-mix(in_oklab,var(--background)_74%,black))] p-6 text-foreground shadow-[0_28px_70px_rgb(0_0_0/0.45),inset_0_1px_0_rgba(255,255,255,0.22)] ring-1 ring-primary/20 transition-all duration-300 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:p-7">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-20 -translate-y-1/2 rounded-full bg-primary/30 blur-2xl" />
            <DialogPrimitive.Title className="relative text-xl font-semibold sm:text-2xl">
              Recommended add-ons for {pkg.name}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="relative mt-2 text-sm leading-6 text-muted-foreground">
              Pick any extras you want — each one is added to your cart as an individual item.
            </DialogPrimitive.Description>
            {hasSuggestions ? (
              <ul className="relative mt-4 space-y-2">
                {upsellSuggestions.map((suggestion) => {
                  const isAdded = addedUpsellSlugs.includes(suggestion.slug);
                  return (
                    <li
                      key={suggestion.slug}
                      className="rounded-2xl border border-white/15 bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {suggestion.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-primary">+${suggestion.price} / night</p>
                      </div>
                      <div className="mt-3 grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Button
                          variant={isAdded ? "secondary" : "outline"}
                          className={`w-full rounded-xl ${
                            isAdded
                              ? "border-primary/25 bg-primary/15 text-foreground"
                              : "border-white/20 bg-white/5 text-foreground hover:bg-white/10"
                          }`}
                          onClick={() => handleAddOnToCart(suggestion.slug)}
                        >
                          {isAdded ? "Added to cart" : "Add this to my cart"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 rounded-lg border border-white/20 px-2 text-xs text-muted-foreground hover:text-foreground"
                          nativeButton={false}
                          render={<Link href={getAddOnDetailsHref(suggestion.slug)} />}
                          onClick={() => setShowCheckoutPrompt(false)}
                        >
                          View details
                          <ArrowUpRight className="size-3" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="relative mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                No specific recommendations for this package yet. You can still browse add-ons.
              </p>
            )}
            <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full rounded-xl border border-white/20 bg-white/5 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_rgb(0_0_0/0.24)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/10"
                onClick={() => setShowCheckoutPrompt(false)}
              >
                Back
              </Button>
              <Button
                className="w-full rounded-xl border border-primary/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_88%,white),color-mix(in_oklab,var(--primary)_72%,black))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_26px_rgb(0_0_0/0.28)] transition-all hover:-translate-y-0.5 hover:brightness-105"
                nativeButton={false}
                render={<Link href="/cart" />}
                onClick={() => setShowCheckoutPrompt(false)}
              >
                Continue to checkout
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
