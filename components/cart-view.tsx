"use client";

import Link from "next/link";

import { useCart } from "@/components/cart-provider";
import { DatePicker } from "@/components/date-picker";
import { HirePriceSummary } from "@/components/hire-price-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { lineItemsFromCart } from "@/lib/booking-line-items";
import { getMelbourneToday } from "@/lib/date-utils";
import { rentalDays } from "@/lib/payment-flow";
import { hirePricing } from "@/lib/site-content";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CartView() {
  const { items, hireDates, setHireDates, removeItem, updateQuantity, clearCart } = useCart();
  const [isClearing, setIsClearing] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = getMelbourneToday();
  const nights = rentalDays(hireDates.pickupDate, hireDates.dropoffDate);
  const datesValid = nights !== null && hireDates.pickupDate >= today;
  const lineItems = lineItemsFromCart(JSON.stringify(items));
  const itemsValid = lineItems.length === items.length;

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
                <p className="mt-1 text-sm">${item.price} each / night</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex h-10 items-center overflow-hidden rounded-xl border border-border bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <button
                    type="button"
                    aria-label={`Decrease quantity for ${item.name}`}
                    disabled={item.quantity <= 1}
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="flex h-full w-10 items-center justify-center border-r border-border text-base font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    −
                  </button>
                  <span
                    aria-label={`Quantity for ${item.name}`}
                    aria-live="polite"
                    className="flex h-full min-w-12 items-center justify-center px-2 text-sm font-semibold tabular-nums"
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase quantity for ${item.name}`}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="flex h-full w-10 items-center justify-center border-l border-border text-base font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    +
                  </button>
                </div>
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
        </CardContent>
      </Card>
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>Your hire dates</CardTitle>
          <p className="text-sm text-muted-foreground">{hirePricing.cartSummary}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hire-start-date">Start date</Label>
              <DatePicker
                id="hire-start-date"
                value={hireDates.pickupDate}
                minDate={today}
                rangeStart={hireDates.pickupDate}
                rangeEnd={hireDates.dropoffDate}
                onBlur={() => undefined}
                onChange={(pickupDate) => setHireDates({ pickupDate, dropoffDate: "" })}
                onRangeChange={(pickupDate, dropoffDate) => setHireDates({ pickupDate, dropoffDate })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hire-end-date">End date</Label>
              <DatePicker id="hire-end-date" value={hireDates.dropoffDate} minDate={hireDates.pickupDate > today ? hireDates.pickupDate : today} rangeStart={hireDates.pickupDate} rangeEnd={hireDates.dropoffDate} onBlur={() => undefined} onChange={(dropoffDate) => setHireDates({ ...hireDates, dropoffDate })} />
            </div>
          </div>
          <div className="site-cart-total border-t pt-4">
            <HirePriceSummary
              items={lineItems}
              nights={datesValid && itemsValid ? nights : 1}
              detail={datesValid ? `${nights} ${nights === 1 ? "night" : "nights"}${hireDates.pickupDate === hireDates.dropoffDate ? " · Same-day hire" : ""}` : "1-night rate"}
            />
          </div>
          {!itemsValid ? <p role="alert" className="text-sm text-destructive">Some selected items are no longer available. Remove them before continuing.</p> : null}
          {hireDates.pickupDate && hireDates.pickupDate < today ? <p role="alert" className="text-sm text-destructive">Start date must be today or later.</p> : null}
        </CardContent>
      </Card>
      <Card className="site-cart-summary">
        <CardHeader><CardTitle>Booking request</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Availability and final pricing are confirmed before your hire is accepted.</p>
          </div>
          {datesValid && itemsValid ? (
            <Button className="w-full md:w-auto md:min-w-56" nativeButton={false} render={<Link href="/booking" />}>Submit a Booking Request</Button>
          ) : (
            <Button className="w-full md:w-auto md:min-w-56" disabled>Submit a Booking Request</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
