import type { MetadataRoute } from "next";

import { business } from "@/lib/site-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${business.website}/sitemap.xml`,
    host: business.website,
  };
}
