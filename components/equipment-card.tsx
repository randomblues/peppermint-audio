"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

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
import type { EquipmentItem } from "@/lib/site-content";

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
                <span className="shrink-0 font-semibold">${option.price}</span>
              </button>
            );
          })}
        </div>
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          {item.details.map((detail) => (
            <li key={detail}>- {detail}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          className="min-w-0 flex-1"
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
          Add to cart
        </Button>
        <Button
          variant="outline"
          className="shrink-0 px-3"
          nativeButton={false}
          render={<Link href={`/equipment/${item.slug}`} />}
        >
          View details
        </Button>
      </CardFooter>
    </Card>
  );
}
