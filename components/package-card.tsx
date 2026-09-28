import Link from "next/link";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addOnCatalog, type PackageTier } from "@/lib/site-content";

type PackageCardProps = {
  pkg: PackageTier;
  compact?: boolean;
  priority?: boolean;
};

export function PackageCard({ pkg, compact = false, priority = false }: PackageCardProps) {
  return (
    <Card className="h-full justify-between overflow-hidden border">
      <div className="relative h-40">
        <Image
          src={pkg.image}
          alt={pkg.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          loading={priority ? "eager" : "lazy"}
          className="object-cover"
        />
      </div>
      <CardHeader className={compact ? "flex flex-col gap-2" : undefined}>
        <CardTitle>{pkg.name}</CardTitle>
        <CardAction>{pkg.notes ? <Badge>{pkg.notes}</Badge> : null}</CardAction>
        <CardDescription>{pkg.bestFor}</CardDescription>
        <p className="mt-2 text-3xl font-semibold tracking-tight">${pkg.price}</p>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-foreground">Ideal for {pkg.capacity}</p>
        {compact ? (
          <p className="mt-2 text-sm text-muted-foreground">{pkg.summary}</p>
        ) : (
          <>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {pkg.inclusions.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
            <div className="mt-6 border-t pt-4">
              <p className="text-sm font-medium text-foreground">Optional add-ons</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {pkg.addOnSlugs.map((slug) => {
                  const addOn = addOnCatalog[slug];

                  return (
                    <li key={slug} className="flex items-center justify-between gap-4">
                      <span>{addOn.name}</span>
                      <span className="shrink-0 font-medium text-foreground">+${addOn.price}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className={compact ? undefined : "flex-col gap-2"}>
        <Button
          className="w-full"
          nativeButton={false}
          render={
            <Link
              href={compact ? `/packages?package=${pkg.slug}` : `/contact?package=${pkg.slug}`}
            />
          }
        >
          {compact ? "View package details" : "Enquire about this package"}
        </Button>
        {!compact ? (
          <Button className="w-full" nativeButton={false} render={<Link href={`/booking?package=${pkg.slug}`} />}>
            Book this package
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
