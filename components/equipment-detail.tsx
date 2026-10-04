"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EquipmentItem } from "@/lib/site-content";
import { useCart } from "@/components/cart-provider";

type EquipmentDetailProps = {
  item: EquipmentItem;
};

export function EquipmentDetail({ item }: EquipmentDetailProps) {
  const [selectedOption, setSelectedOption] = useState(item.options[0]);
  const { addItem } = useCart();

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>Choose your hire option</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select the option that suits your event. Availability is confirmed before your hire is accepted.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3" role="radiogroup" aria-label={`${item.name} hire options`}>
          {item.options.map((option) => {
            const selected = selectedOption.label === option.label;

            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedOption(option)}
                className={`flex min-h-14 items-center justify-between rounded-xl border px-4 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-primary/50"
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="font-semibold">${option.price}</span>
              </button>
            );
          })}
        </div>
        <ul className="mt-6 space-y-3 border-t pt-5 text-sm text-muted-foreground">
          {item.details.map((detail) => (
            <li key={detail}>- {detail}</li>
          ))}
        </ul>
        <Button className="mt-6 min-h-12 w-full rounded-xl border border-primary/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_88%,white),color-mix(in_oklab,var(--primary)_78%,white)_42%,color-mix(in_oklab,var(--primary)_70%,black))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_rgb(0_0_0/0.28),0_0_28px_color-mix(in_oklab,var(--primary)_22%,transparent)] transition-all hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_14px_26px_rgb(0_0_0/0.3),0_0_34px_color-mix(in_oklab,var(--primary)_30%,transparent)]" onClick={() => addItem({
          id: `equipment:${item.slug}:${selectedOption.label}`,
          name: item.name,
          kind: "equipment",
          option: selectedOption.label,
          price: selectedOption.price,
        })}>
          <ShoppingCart className="size-4" aria-hidden="true" />
          Add to cart
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          We will confirm availability, pickup timing, and the final hire details with you.
        </p>
      </CardContent>
    </Card>
  );
}
