"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_CART_ITEM_QUANTITY } from "@/components/cart-provider";

type CartQuantityControlsProps = {
  itemName: string;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  className?: string;
};

export function CartQuantityControls({
  itemName,
  quantity,
  onDecrease,
  onIncrease,
  className = "w-full",
}: CartQuantityControlsProps) {
  return (
    <div
      role="group"
      aria-label={`${itemName} quantity controls`}
      className={`flex ${className} items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-1.5`}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Remove one ${itemName} from cart`}
        onClick={onDecrease}
        className="size-9 shrink-0 rounded-full border-border bg-background text-foreground shadow-none transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-foreground"
      >
        <Minus className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <span
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Quantity in cart: ${quantity}`}
        className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap text-center text-sm font-normal tracking-normal text-foreground"
      >
        <ShoppingCart className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{quantity}</span>
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Add one ${itemName} to cart`}
        onClick={onIncrease}
        disabled={quantity >= MAX_CART_ITEM_QUANTITY}
        className="size-9 shrink-0 rounded-full border-primary/25 bg-primary/10 text-foreground shadow-none transition-colors hover:border-primary/40 hover:bg-primary/20 hover:text-foreground disabled:opacity-45"
      >
        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>
  );
}
