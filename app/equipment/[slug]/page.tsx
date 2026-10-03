import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EquipmentDetail } from "@/components/equipment-detail";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { equipmentCatalog } from "@/lib/site-content";
import { createPageMetadata } from "@/lib/seo";

type EquipmentDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return equipmentCatalog.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: EquipmentDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = equipmentCatalog.find((candidate) => candidate.slug === slug);

  return createPageMetadata({
    title: item ? `${item.name} Hire` : "Equipment Hire",
    description: item?.description ?? "Hire individual audio equipment from Peppermint Audio in Melbourne.",
    path: item ? `/equipment/${item.slug}` : "/equipment",
    image: item?.image,
  });
}

export default async function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const { slug } = await params;
  const item = equipmentCatalog.find((candidate) => candidate.slug === slug);

  if (!item) {
    notFound();
  }

  return (
    <Section
      eyebrow="Equipment hire"
      title={item.name}
      description="Review the details, choose the setup you need, and request this hire for your event."
    >
      <Button variant="ghost" nativeButton={false} render={<Link href="/equipment" />} className="mb-4 px-0">
        ← Back to equipment
      </Button>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="overflow-hidden rounded-2xl border bg-muted">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              width={1200}
              height={800}
              className={`h-auto max-h-[34rem] w-full bg-white object-contain ${
                item.imageSize === "compact" ? "p-8" : "p-4"
              }`}
              priority
            />
          ) : (
            <div className="flex min-h-80 items-center justify-center text-sm font-medium text-muted-foreground">
              {item.category}
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div>
            <Badge variant="secondary">{item.category}</Badge>
            <p className="mt-4 text-lg text-muted-foreground">{item.description}</p>
          </div>
          <EquipmentDetail item={item} />
        </div>
      </div>
    </Section>
  );
}
