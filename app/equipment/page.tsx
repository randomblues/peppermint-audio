import { Suspense } from "react";
import Link from "next/link";

import { EquipmentCatalogue, EquipmentCatalogueFallback } from "@/components/equipment-catalogue";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { equipmentCatalog } from "@/lib/site-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Equipment Hire",
  description:
    "Hire individual speakers, microphones, mixers, DI boxes, and lighting from Peppermint Audio in Melbourne.",
  path: "/equipment",
});

export default function EquipmentPage() {
  return (
    <Section
      eyebrow="Individual equipment"
      title="Hire exactly what you need"
      headingAs="h1"
      description="Find the right speakers, microphones, lighting, and extras. Add what you need to your cart, and we will confirm availability for your dates."
    >
      <Suspense fallback={<EquipmentCatalogueFallback items={equipmentCatalog} />}>
        <EquipmentCatalogue items={equipmentCatalog} />
      </Suspense>
      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/[0.03] p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-medium">Prefer everything ready to go?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Explore complete PA packages with the essentials already included.</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/packages" />} className="min-h-11 shrink-0 rounded-xl">
          Explore packages
        </Button>
      </div>
    </Section>
  );
}
