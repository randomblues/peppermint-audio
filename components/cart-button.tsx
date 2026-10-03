"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";

export function CartButton() {
  const { itemCount } = useCart();

  return (
    <Button
      variant="outline"
      size="icon"
      className="relative"
      nativeButton={false}
      render={<Link href="/cart" />}
      aria-label={`Open cart${itemCount ? `, ${itemCount} items` : ""}`}
    >
      <ShoppingCart aria-hidden="true" />
      {itemCount ? (
        <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {itemCount}
        </span>
      ) : null}
    </Button>
  );
}
