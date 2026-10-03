import type { Metadata } from "next";

import { business } from "@/lib/site-content";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  robots?: Metadata["robots"];
  image?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  robots,
  image = "/hero-mixer.jpg",
}: PageMetadataOptions): Metadata {
  const fullTitle = `${title} | ${business.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "en_AU",
      url: path,
      siteName: business.name,
      title: fullTitle,
      description,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
    ...(robots ? { robots } : {}),
  };
}
