import Link from "next/link";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { business } from "@/lib/site-content";

export function Footer() {
  return (
    <footer className="mt-10 border-t bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Pickup: {business.pickupSuburb} {business.pickupPostcode}</Badge>
          <Badge variant="outline">Servicing {business.serviceArea}</Badge>
        </div>
        <Separator className="my-5" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm text-muted-foreground">
            <Image
              src="/logo-white.png"
              alt={business.name}
              width={266}
              height={51}
              className="-ml-2 h-auto w-44"
            />
            <p>Email: {business.email}</p>
            <p>Phone: {business.phone}</p>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/contact" />}>
            Send an enquiry
          </Button>
        </div>
      </div>
    </footer>
  );
}
