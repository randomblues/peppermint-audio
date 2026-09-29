const conversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim();
const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim();
const whatsappConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_CONVERSION_LABEL?.trim();
const bookingConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_CONVERSION_LABEL?.trim();

export const googleAdsConversionId = conversionId ?? "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function trackGoogleAdsEvent(label: string | undefined) {
  if (
    !conversionId ||
    !label ||
    typeof window === "undefined" ||
    typeof window.gtag !== "function"
  ) {
    return;
  }

  try {
    window.gtag("event", "conversion", {
      send_to: `${conversionId}/${label}`,
    });
  } catch (error) {
    console.warn("Google Ads conversion tracking failed.", error);
  }
}

export function trackGoogleAdsConversion() {
  trackGoogleAdsEvent(conversionLabel);
}

export function trackGoogleAdsWhatsAppClick() {
  trackGoogleAdsEvent(whatsappConversionLabel);
}

export function trackGoogleAdsBookingSubmission() {
  trackGoogleAdsEvent(bookingConversionLabel);
}
