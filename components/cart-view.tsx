"use client";

import Link from "next/link";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CartView() {
  const { items, total, removeItem, updateQuantity, clearCart } = useCart();
  const [isClearing, setIsClearing] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
  }, []);

  const handleClearCart = () => {
    if (isClearing) return;
    setIsClearing(true);
    clearTimerRef.current = setTimeout(() => {
      clearCart();
      setIsClearing(false);
      clearTimerRef.current = null;
    }, 280);
  };

  const handleRemoveItem = (itemId: string) => {
    if (removingItemId || isClearing) return;
    setRemovingItemId(itemId);
    removeTimerRef.current = setTimeout(() => {
      removeItem(itemId);
      setRemovingItemId(null);
      removeTimerRef.current = null;
    }, 240);
  };

  if (!items.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Your cart is empty</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Add a package or individual equipment to start your enquiry.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="site-browse-button w-full sm:flex-1" nativeButton={false} render={<Link href="/packages" />}>
            <span>Browse packages</span>
            <ArrowUpRight aria-hidden="true" className="site-browse-button-icon" />
          </Button>
          <Button className="site-browse-button w-full sm:flex-1" nativeButton={false} render={<Link href="/equipment" />}>
            <span>Browse equipment</span>
            <ArrowUpRight aria-hidden="true" className="site-browse-button-icon" />
          </Button>
        </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Your selected hire</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">{item.name}</p>
                {item.option ? <p className="text-sm text-muted-foreground">{item.option}</p> : null}
                <p className="mt-1 text-sm">${item.price} each</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`quantity-${item.id}`}>Quantity for {item.name}</label>
                <input id={`quantity-${item.id}`} type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} className="h-10 w-20 rounded-md border bg-background px-3" />
                <Button
                  variant="ghost"
                  size="sm"
                  className={`site-remove-item ${removingItemId === item.id ? "is-removing" : ""}`}
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={Boolean(removingItemId) || isClearing}
                >
                  <Trash2 aria-hidden="true" className="site-remove-item-icon" />
                  <span>{removingItemId === item.id ? "Removing" : "Remove"}</span>
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="ghost"
            className={`site-clear-cart ${isClearing ? "is-clearing" : ""}`}
            onClick={handleClearCart}
            disabled={isClearing}
          >
            <Trash2 aria-hidden="true" className="site-clear-cart-icon" />
            <span>{isClearing ? "Clearing cart" : "Clear cart"}</span>
          </Button>
          <div className="site-cart-total flex items-center justify-between border-t pt-4">
            <span className="text-sm font-medium text-muted-foreground">Estimated hire total</span>
            <span className="text-2xl font-semibold tracking-tight">${total}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="site-cart-summary">
        <CardHeader><CardTitle>Booking request</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Availability and final pricing are confirmed before your hire is accepted.</p>
          </div>
          <Button className="w-full md:w-auto md:min-w-56" nativeButton={false} render={<Link href="/booking" />}>Submit a Booking Request</Button>
        </CardContent>
      </Card>
    </div>
  );
}
