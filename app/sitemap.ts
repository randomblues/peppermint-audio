import type { MetadataRoute } from "next";

import { business, equipmentCatalog } from "@/lib/site-content";

const publicRoutes = [
  "",
  "/packages",
  "/equipment",
  "/how-it-works",
  "/faq",
  "/contact",
  "/booking",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = publicRoutes.map((route, index) => ({
    url: `${business.website}${route}`,
    changeFrequency: index === 0 ? "weekly" as const : "monthly" as const,
    priority: index === 0 ? 1 : 0.7,
  }));

  const equipmentRoutes = equipmentCatalog.map((item) => ({
    url: `${business.website}/equipment/${item.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
    ...(item.image
      ? { images: [`${business.website}${item.image}`] }
      : {}),
  }));

  return [...staticRoutes, ...equipmentRoutes];
}
