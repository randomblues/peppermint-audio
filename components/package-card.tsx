"use client";

import Link from "next/link";
import Image from "next/image";

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

  return (
    <Card className="h-full justify-between overflow-hidden border">
      <div className="relative h-56 bg-white sm:h-64">
        <Image
          src={pkg.image}
          alt={pkg.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          loading={priority ? "eager" : "lazy"}
          className="object-contain"
        />
      </div>
      <CardHeader className={compact ? "flex flex-col gap-2" : undefined}>
        <CardTitle>{pkg.name}</CardTitle>
        <CardAction>{pkg.notes ? <Badge>{pkg.notes}</Badge> : null}</CardAction>
        <CardDescription>{pkg.bestFor}</CardDescription>
        <p className="mt-2 text-3xl font-semibold tracking-tight">${pkg.price}</p>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-foreground">Ideal for {pkg.capacity}</p>
        {compact ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{pkg.summary}</p>
            <p className="mt-4 text-sm font-semibold text-foreground">Included</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {pkg.inclusions.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
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
      <CardFooter className="flex-col gap-2">
        <Button
          className="w-full"
          nativeButton={false}
          render={
            <Link
              href={`/packages?package=${pkg.slug}`}
            />
          }
        >
          View package details
        </Button>
        {!compact ? (
          <Button
            className="w-full"
            onClick={() => addItem({ id: `package:${pkg.slug}`, name: pkg.name, kind: "package", price: pkg.price })}
          >
            Add package to cart
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
