"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export function GoogleAdsScripts({ conversionId }: { conversionId: string }) {
  const pathname = usePathname();
  if (!conversionId || pathname.startsWith("/calendar/")) return null;
  return (
    <>
      <Script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(conversionId)}`} strategy="afterInteractive" />
      <Script id="google-ads-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(conversionId)});
        `}
      </Script>
    </>
  );
}
