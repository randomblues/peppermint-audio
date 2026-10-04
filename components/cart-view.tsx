"use client";

import Link from "next/link";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CartView() {
  const { items, total, removeItem, updateQuantity, clearCart } = useCart();
  if (!items.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Your cart is empty</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Add a package or individual equipment to start your enquiry.</p>
          <Button nativeButton={false} render={<Link href="/equipment" />}>Browse equipment</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
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
                <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>Remove</Button>
              </div>
            </div>
          ))}
          <Button variant="ghost" onClick={clearCart}>Clear cart</Button>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>Booking request</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-lg font-semibold"><span>Estimated hire total</span><span>${total}</span></div>
          <p className="mt-2 text-sm text-muted-foreground">Availability and final pricing are confirmed before your hire is accepted.</p>
          <Button className="mt-5 w-full" nativeButton={false} render={<Link href="/booking" />}>Submit a Booking Request</Button>
        </CardContent>
      </Card>
    </div>
  );
}
