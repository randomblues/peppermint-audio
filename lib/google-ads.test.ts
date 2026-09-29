import { beforeEach, describe, expect, it, vi } from "vitest";

describe("trackGoogleAdsConversion", () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.gtag;
  });

  it("sends the configured conversion event", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", "AW-123456789");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL", "abcDEF123");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_CONVERSION_LABEL", "whatsapp123");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_BOOKING_CONVERSION_LABEL", "booking123");
    const { trackGoogleAdsConversion } = await import("./google-ads");
    const gtag = vi.fn();
    window.gtag = gtag;

    trackGoogleAdsConversion();

    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-123456789/abcDEF123",
    });
    vi.unstubAllEnvs();
  });

  it("does nothing when the tag has not loaded", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", "AW-123456789");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL", "abcDEF123");
    const { trackGoogleAdsConversion } = await import("./google-ads");

    expect(() => trackGoogleAdsConversion()).not.toThrow();
    vi.unstubAllEnvs();
  });

  it("sends the configured WhatsApp conversion event", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", "AW-123456789");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_CONVERSION_LABEL", "whatsapp123");
    const { trackGoogleAdsWhatsAppClick } = await import("./google-ads");
    const gtag = vi.fn();
    window.gtag = gtag;

    trackGoogleAdsWhatsAppClick();

    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-123456789/whatsapp123",
    });
    vi.unstubAllEnvs();
  });

  it("sends the configured booking conversion event", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", "AW-123456789");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_BOOKING_CONVERSION_LABEL", "booking123");
    const { trackGoogleAdsBookingSubmission } = await import("./google-ads");
    const gtag = vi.fn();
    window.gtag = gtag;

    trackGoogleAdsBookingSubmission();

    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-123456789/booking123",
    });
    vi.unstubAllEnvs();
  });
});
