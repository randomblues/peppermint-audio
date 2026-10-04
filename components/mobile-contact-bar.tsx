"use client";

import {
  ArrowUpRight,
  CalendarCheck,
  ChevronUp,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import { usePathname } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trackGoogleAdsPhoneClick, trackGoogleAdsWhatsAppClick } from "@/lib/google-ads";
import { business } from "@/lib/site-content";
import { whatsappUrl } from "@/components/whatsapp-button";

export function MobileContactBar() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;
  const isBookingForm = pathname === "/booking";

  return (
    <div className={`${isBookingForm ? "hidden md:block" : ""} fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.16)] backdrop-blur-xl md:inset-x-auto md:right-5 md:bottom-5 md:w-[min(calc(100%-2.5rem),22rem)] md:rounded-2xl md:border md:border-border/70 md:bg-background/95 md:p-2 md:pb-2 md:shadow-[0_12px_36px_rgb(0_0_0/0.24)]`}>
      <Sheet>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Check availability"
              className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/40 bg-gradient-to-r from-primary via-primary to-primary/85 px-4 text-left text-primary-foreground shadow-[0_8px_24px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] md:min-h-16"
            />
          }
        >
          <span className="availability-cta-icon-shell flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/20 motion-safe:animate-availability-cta-glow">
            <CalendarCheck
              className="availability-cta-icon motion-safe:animate-availability-cta size-4.5"
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-tight font-bold">Check availability</span>
            <span className="mt-0.5 block text-[0.68rem] leading-tight text-primary-foreground/75">
              We&apos;ll help you find the right setup
            </span>
          </span>
          <ChevronUp className="size-5 shrink-0 transition-transform group-data-open:-rotate-180" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton
          className="overflow-hidden rounded-t-[2rem] border-border/70 bg-background/95 p-0 shadow-[0_-16px_48px_rgb(0_0_0/0.3)] backdrop-blur-2xl md:!left-auto md:!right-5 md:!bottom-5 md:w-[min(calc(100%-2.5rem),30rem)] md:rounded-[2rem] md:border md:shadow-[0_16px_48px_rgb(0_0_0/0.3)]"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/15 to-transparent" />
          <SheetHeader className="relative gap-3 border-b border-border/70 px-5 pt-7 pb-5">
            <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div className="pr-8">
                <SheetTitle className="text-xl">Let&apos;s check your date</SheetTitle>
                <SheetDescription className="mt-1 leading-relaxed">
                  Share what you&apos;re planning and we&apos;ll help confirm the best option for your event.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="relative grid gap-3 px-5 py-5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={trackGoogleAdsWhatsAppClick}
              className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[#25D366]/35 bg-[#25D366]/10 px-4 text-left transition hover:bg-[#25D366]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] active:scale-[0.99]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
                <MessageCircle className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">WhatsApp</span>
                <span className="block text-xs text-muted-foreground">Fastest reply</span>
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <a
              href={`tel:${business.phone.replace(/\s/g, "")}`}
              onClick={trackGoogleAdsPhoneClick}
              className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border/80 bg-card/70 px-4 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Phone className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Call</span>
                <span className="block text-xs text-muted-foreground">{business.phone}</span>
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <a
              href={`mailto:${business.email}`}
              className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border/80 bg-card/70 px-4 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Email</span>
                <span className="block truncate text-xs text-muted-foreground">{business.email}</span>
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </div>
          <p className="relative px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
            Pickup from Abbotsford 3067 · Serving Melbourne
          </p>
        </SheetContent>
      </Sheet>
    </div>
  );
}
