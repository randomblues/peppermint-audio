import type { Metadata } from "next";

import { EnquiryForm } from "@/components/enquiry-form";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { business, packageTiers } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact | Peppermint Audio",
  description: "Ask a question or send an enquiry to Peppermint Audio in Melbourne.",
};

type ContactPageProps = {
  searchParams: Promise<{ package?: string; equipment?: string }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { package: requestedPackage, equipment: requestedEquipment } = await searchParams;
  const selectedHire = requestedEquipment
    ?? (requestedPackage === "custom"
      ? "Custom package"
      : packageTiers.find((pkg) => pkg.slug === requestedPackage)?.name);

  return (
    <Section
      eyebrow="Contact"
      title="Get in touch"
      description="Have a question, want to enquire about a package, or need help planning your event? Send us a message and we will get back to you."
    >
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <EnquiryForm packageName={selectedHire} />
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
