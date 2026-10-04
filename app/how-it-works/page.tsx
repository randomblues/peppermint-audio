import Link from "next/link";

import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { business, howItWorks } from "@/lib/site-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "How It Works",
  description: "How Peppermint Audio package and equipment hire works, from cart request to pickup in Abbotsford Melbourne.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <Section
      eyebrow="Booking Flow"
      title="How It Works"
      headingAs="h1"
      description="Choose your equipment, send a booking request, and let us confirm availability before you collect from Abbotsford."
    >
      <div className="grid gap-4">
        {howItWorks.map((step, index) => (
          <Card key={step.title} className="border">
            <CardHeader>
              <Badge variant="secondary" className="w-fit">Step {index + 1}</Badge>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{step.detail}</CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 rounded-xl border bg-muted/30 p-5 text-sm text-muted-foreground">
        Pickup location: {business.pickupSuburb} {business.pickupPostcode}. Please bring photo ID and arrive during your confirmed collection window.
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button nativeButton={false} render={<Link href="/packages" />}>
          Browse packages
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/equipment" />}>
          Hire individual equipment
        </Button>
      </div>
    </Section>
  );
}
