import { EquipmentCard } from "@/components/equipment-card";
import { Section } from "@/components/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      eyebrow="Individual equipments"
      title="Hire exactly what you need"
      headingAs="h1"
      description="You do not need to hire a full package. Choose a single item or a pair, select the setup that suits you, and send an enquiry for availability."
    >
      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle>Prefer everything ready to go?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Our complete packages include speakers, microphones, mixers, cables, and the essentials for a smooth event setup.
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        {equipmentCatalog.map((item, index) => (
          <EquipmentCard key={item.slug} item={item} priority={index < 2} />
        ))}
      </div>
    </Section>
  );
}
