"use client";

import Link from "next/link";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";

export function CartButton() {
  const { itemCount } = useCart();

  return (
    <Button variant="outline" nativeButton={false} render={<Link href="/cart" />} aria-label={`Cart${itemCount ? `, ${itemCount} items` : ""}`}>
      Cart{itemCount ? ` (${itemCount})` : ""}
    </Button>
  );
}
