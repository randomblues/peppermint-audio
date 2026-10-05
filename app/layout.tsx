import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "@fontsource-variable/outfit";

import { Footer } from "@/components/footer";
import { CartProvider } from "@/components/cart-provider";
import { MarketingAttribution } from "@/components/marketing-attribution";
import { MobileContactBar } from "@/components/mobile-contact-bar";
import { Navbar } from "@/components/navbar";
import { googleAdsConversionId } from "@/lib/google-ads";
import { business } from "@/lib/site-content";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(business.website),
  title: {
    default: "Peppermint Audio | Audio Rental for Melbourne Events",
    template: "%s | Peppermint Audio",
  },
  description:
    "Complete audio system hire for private events in Melbourne, including speakers, microphones, mixers, and cables. Pickup from Abbotsford 3067.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: business.website,
    siteName: business.name,
    title: "Peppermint Audio | Audio Rental for Melbourne Events",
    description:
      "Complete audio system hire for private events in Melbourne, including speakers, microphones, mixers, and cables. Pickup from Abbotsford 3067.",
    images: [
      {
        url: "/hero-mixer.jpg",
        width: 1200,
        height: 630,
        alt: "Audio mixer for Peppermint Audio event hire",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Peppermint Audio | Audio Rental for Melbourne Events",
    description:
      "Complete audio system hire for private events in Melbourne, including speakers, microphones, mixers, and cables. Pickup from Abbotsford 3067.",
    images: ["/hero-mixer.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${business.website}/#business`,
    name: business.name,
    url: business.website,
    image: `${business.website}${business.heroImage}`,
    logo: `${business.website}/logo-white.png`,
    description:
      "Complete audio system hire for parties, weddings, corporate events, live gigs, and private functions in Melbourne.",
    telephone: business.phone,
    email: business.email,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: business.pickupSuburb,
      postalCode: business.pickupPostcode,
      addressRegion: "VIC",
      addressCountry: "AU",
    },
    areaServed: {
      "@type": "City",
      name: business.serviceArea,
    },
    sameAs: [business.googleReviewsUrl],
    makesOffer: [
      {
        "@type": "Offer",
        name: "PA system hire",
        url: `${business.website}/packages`,
      },
      {
        "@type": "Offer",
        name: "Audio equipment hire for events",
        url: `${business.website}/packages`,
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        {googleAdsConversionId ? (
          <>
            <Script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsConversionId)}`}
              strategy="afterInteractive"
            />
            <Script id="google-ads-gtag" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', ${JSON.stringify(googleAdsConversionId)});
              `}
            </Script>
          </>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <div className="flex min-h-screen flex-col">
          <MarketingAttribution />
          <CartProvider>
            <Navbar />
            <main className="site-shell flex-1 bg-background pb-20 md:pb-0">{children}</main>
            <Footer />
            <MobileContactBar />
          </CartProvider>
        </div>
      </body>
    </html>
  );
}
