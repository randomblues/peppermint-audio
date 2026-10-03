import Link from "next/link";

import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { business, howItWorks } from "@/lib/site-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "How It Works",
  description: "How audio system hire pickup works from Abbotsford Melbourne 3067.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <Section
      eyebrow="Booking Flow"
      title="How It Works"
      description="From first enquiry to gear return, here is exactly what to expect."
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

      <Button className="mt-6" nativeButton={false} render={<Link href="/contact" />}>
        Check availability
      </Button>
    </Section>
  );
}
