"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hirePricing, type EquipmentItem } from "@/lib/site-content";

type EquipmentCardProps = {
  item: EquipmentItem;
  priority?: boolean;
};

export function EquipmentCard({ item, priority = false }: EquipmentCardProps) {
  const [selectedOption, setSelectedOption] = useState(item.options[0]);
  const { addItem } = useCart();

  return (
    <Card className="h-full overflow-hidden border">
      <div className="relative h-48">
        <Link
          href={`/equipment/${item.slug}`}
          aria-label={`View ${item.name} details`}
          className="absolute inset-0 block"
        >
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              loading={priority ? "eager" : "lazy"}
              className={`bg-white object-contain transition-transform hover:scale-[1.02] ${
                item.imageSize === "compact" ? "p-8" : "p-3"
              }`}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-sm font-medium text-muted-foreground">
              {item.category}
            </div>
          )}
        </Link>
      </div>
      <CardHeader>
        <Badge variant="secondary" className="w-fit">
          {item.category}
        </Badge>
        <CardTitle>
          <Link href={`/equipment/${item.slug}`} className="hover:text-primary">
            {item.name}
          </Link>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{item.description}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {item.options.map((option) => {
            const selected = option.label === selectedOption.label;

            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedOption(option)}
                className={`flex min-h-12 items-center justify-between rounded-lg border px-3 text-left text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="shrink-0 font-semibold">${option.price} / night</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{hirePricing.summary}</p>
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          {item.details.map((detail) => (
            <li key={detail}>- {detail}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          className="min-w-0 flex-1 rounded-xl border border-primary/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_88%,white),color-mix(in_oklab,var(--primary)_78%,white)_42%,color-mix(in_oklab,var(--primary)_70%,black))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_rgb(0_0_0/0.28),0_0_28px_color-mix(in_oklab,var(--primary)_22%,transparent)] transition-all hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_14px_26px_rgb(0_0_0/0.3),0_0_34px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
          onClick={() =>
            addItem({
              id: `equipment:${item.slug}:${selectedOption.label}`,
              name: item.name,
              kind: "equipment",
              option: selectedOption.label,
              price: selectedOption.price,
            })
          }
        >
          <ShoppingCart className="size-4" aria-hidden="true" />
          Add to cart
        </Button>
        <Button
          variant="outline"
          className="shrink-0 rounded-xl border border-primary/15 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_95%,var(--primary)_8%),color-mix(in_oklab,var(--background)_82%,black))] px-3 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_16px_rgb(0_0_0/0.2)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_20px_rgb(0_0_0/0.24),0_0_14px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
          nativeButton={false}
          render={<Link href={`/equipment/${item.slug}`} />}
        >
          View details
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Button>
      </CardFooter>
    </Card>
  );
}
