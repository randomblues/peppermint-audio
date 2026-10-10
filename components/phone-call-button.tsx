"use client";

import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackGoogleAdsPhoneClick } from "@/lib/google-ads";
import { cn } from "@/lib/utils";

type PhoneCallButtonProps = {
  phone: string;
  className?: string;
};

export function PhoneCallButton({ phone, className }: PhoneCallButtonProps) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className={cn("font-semibold shadow-lg ring-1 ring-white/30", className)}
      nativeButton={false}
      render={<a href={`tel:${phone.replace(/\s/g, "")}`} />}
      onClick={trackGoogleAdsPhoneClick}
    >
      <Phone className="size-4" aria-hidden="true" />
      Call {phone}
    </Button>
  );
}
