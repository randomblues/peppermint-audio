"use client";

import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackGoogleAdsPhoneClick } from "@/lib/google-ads";

type PhoneCallButtonProps = {
  phone: string;
};

export function PhoneCallButton({ phone }: PhoneCallButtonProps) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className="font-semibold shadow-lg ring-1 ring-white/30"
      nativeButton={false}
      render={<a href={`tel:${phone.replace(/\s/g, "")}`} />}
      onClick={trackGoogleAdsPhoneClick}
    >
      <Phone className="size-4" aria-hidden="true" />
      Call {phone}
    </Button>
  );
}
