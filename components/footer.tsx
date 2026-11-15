import Image from "next/image";
import Link from "next/link";

import { business } from "@/lib/site-content";

export function Footer() {
  return (
    <footer className="mt-10 border-t bg-muted/20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
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
          <dl className="grid grid-cols-2 gap-6 border-t border-border/60 pt-5 text-sm sm:gap-8 sm:border-t-0 sm:border-l sm:pl-8 sm:pt-0">
            <div>
              <dt className="mb-1.5 text-xs text-muted-foreground">Pickup</dt>
              <dd className="font-medium text-foreground">{business.pickupSuburb} {business.pickupPostcode}</dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs text-muted-foreground">Servicing</dt>
              <dd className="font-medium text-foreground">{business.serviceArea}</dd>
            </div>
          </dl>
        </div>
        <nav aria-label="Policies" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-5">
          <Link href="/privacy-policy" className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Privacy Policy</Link>
          <Link href="/terms-of-hire" className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Terms of Hire</Link>
        </nav>
      </div>
    </footer>
  );
}
