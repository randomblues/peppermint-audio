"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { CartQuantityControls } from "@/components/cart-quantity-controls";
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
  const { items, addItem, updateQuantity } = useCart();
  const cartItemId = `equipment:${item.slug}:${selectedOption.label}`;
  const cartQuantity = items.find((cartItem) => cartItem.id === cartItemId)?.quantity ?? 0;
  const cartItem = {
    id: cartItemId,
    name: item.name,
    kind: "equipment" as const,
    option: selectedOption.label,
    price: selectedOption.price,
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{item.category}</Badge>
          {item.popular ? (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Popular
            </Badge>
          ) : null}
        </div>
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
      <CardFooter className="mt-auto flex-col gap-2 sm:flex-row">
        {cartQuantity ? (
          <CartQuantityControls
            itemName={item.name}
            quantity={cartQuantity}
            onDecrease={() => updateQuantity(cartItemId, cartQuantity - 1)}
            onIncrease={() => addItem(cartItem)}
            className="w-full sm:w-auto sm:flex-none"
          />
        ) : <Button
          className="min-w-0 flex-1 rounded-xl border border-primary/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_88%,white),color-mix(in_oklab,var(--primary)_78%,white)_42%,color-mix(in_oklab,var(--primary)_70%,black))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_rgb(0_0_0/0.28),0_0_28px_color-mix(in_oklab,var(--primary)_22%,transparent)] transition-all hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_14px_26px_rgb(0_0_0/0.3),0_0_34px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
          onClick={() =>
            addItem(cartItem)
          }
        >
          <ShoppingCart className="size-4" aria-hidden="true" />
          Add to cart
        </Button>}
        <Button
          variant="outline"
          className="w-full min-w-0 rounded-xl border border-primary/15 px-3 text-muted-foreground shadow-none transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-foreground sm:w-auto sm:flex-1"
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
