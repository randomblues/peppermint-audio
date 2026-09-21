import type { Metadata } from "next";

import { EnquiryForm } from "@/components/enquiry-form";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { business, packageTiers } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact | Peppermint Audio",
  description: "Send an enquiry for audio system hire in Melbourne.",
};

type ContactPageProps = {
  searchParams: Promise<{ package?: string }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { package: requestedPackage } = await searchParams;
  const packageName =
    requestedPackage === "custom"
      ? "Custom package"
      : packageTiers.find((pkg) => pkg.slug === requestedPackage)?.name;

  return (
    <Section
      eyebrow="Contact"
      title="Get a Quote"
      description="Tell us about your event and we will recommend the best package and confirm availability."
    >
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <EnquiryForm packageName={packageName} />
        <Card className="border">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">Pickup details</Badge>
            <CardTitle>Abbotsford collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Pickup from {business.pickupSuburb} {business.pickupPostcode}. We confirm the exact window after booking.
            </p>
            <Separator />
            <p>Email: {business.email}</p>
            <p>Phone: {business.phone}</p>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
