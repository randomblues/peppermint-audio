"use client";

import { useEffect } from "react";

const attributionKeys = ["gclid", "utm_source", "utm_medium", "utm_campaign", "utm_term"] as const;

export function MarketingAttribution() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const attribution = Object.fromEntries(
      attributionKeys
        .map((key) => [key, query.get(key)])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );

    if (Object.keys(attribution).length > 0) {
      window.sessionStorage.setItem("peppermint-marketing-attribution", JSON.stringify(attribution));
    }
  }, []);

  return null;
}
