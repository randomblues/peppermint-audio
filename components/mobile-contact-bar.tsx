"use client";

import { CalendarCheck, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { trackGoogleAdsPhoneClick, trackGoogleAdsWhatsAppClick } from "@/lib/google-ads";
import { business } from "@/lib/site-content";
import { whatsappUrl } from "@/components/whatsapp-button";

export function MobileContactBar() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      aria-label="Quick contact actions"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-background/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0/0.12)] backdrop-blur md:hidden"
    >
      <Link
        href="/booking"
        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarCheck className="size-4" aria-hidden="true" />
        Check availability
      </Link>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        onClick={trackGoogleAdsWhatsAppClick}
        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCircle className="size-4 text-[#25D366]" aria-hidden="true" />
        WhatsApp us
      </a>
      <a
        href={`tel:${business.phone.replace(/\s/g, "")}`}
        onClick={trackGoogleAdsPhoneClick}
        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Phone className="size-4" aria-hidden="true" />
        Call us
      </a>
    </nav>
  );
}
