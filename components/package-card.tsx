"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, ShoppingCart } from "lucide-react";

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
import type { PackageTier } from "@/lib/site-content";

type PackageCardProps = {
  pkg: PackageTier;
  compact?: boolean;
  priority?: boolean;
};

export function PackageCard({ pkg, compact = false, priority = false }: PackageCardProps) {
  const { addItem } = useCart();
  const [showAllInclusions, setShowAllInclusions] = useState(false);
  const imageClassName =
    pkg.slug === "budget-with-a-boom"
      ? "object-contain p-2"
      : "object-contain";

  return (
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
                Hire price
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
          <p className="mt-2 text-3xl font-semibold tracking-tight">${pkg.price}</p>
        </CardHeader>
      )}
      <CardContent>
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
          onClick={() => addItem({ id: `package:${pkg.slug}`, name: pkg.name, kind: "package", price: pkg.price })}
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
  );
}
