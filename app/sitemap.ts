import type { MetadataRoute } from "next";

import { business } from "@/lib/site-content";

const publicRoutes = [
  "",
  "/packages",
  "/how-it-works",
  "/faq",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route, index) => ({
    url: `${business.website}${route}`,
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
