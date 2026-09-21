import type { Metadata } from "next";
import Link from "next/link";

import { PackageCard } from "@/components/package-card";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { packageTiers } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Packages | Peppermint Audio",
  description: "Simple, complete audio system hire packages for parties, presentations, weddings, and live events in Melbourne.",
};

type PackagesPageProps = {
  searchParams: Promise<{ package?: string }>;
};

export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const { package: requestedPackage } = await searchParams;
  const selectedPackage = packageTiers.some((pkg) => pkg.slug === requestedPackage)
    ? requestedPackage
    : packageTiers[0]?.slug;

  return (
    <Section
      eyebrow="Pricing"
      title="Choose your complete PA package"
      description="Three straightforward options, starting at $120. Every package is ready to plug in and use."
    >
      <Tabs defaultValue={selectedPackage}>
        <TabsList
          className="grid h-auto w-full max-w-4xl grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-3"
          variant="line"
        >
          {packageTiers.map((pkg) => (
            <TabsTrigger
              key={pkg.slug}
              value={pkg.slug}
              className="h-auto min-h-10 whitespace-normal rounded-md border border-border/80 px-3 py-2 text-center leading-tight data-active:bg-muted"
            >
              {pkg.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {packageTiers.map((pkg) => (
          <TabsContent key={pkg.slug} value={pkg.slug} className="mt-6 max-w-2xl">
            <PackageCard pkg={pkg} />
          </TabsContent>
        ))}
      </Tabs>
      <Card className="mt-8 border-dashed">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <CardTitle>Looking for a custom setup?</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              If you have particular equipment needs or a special occasion in mind, tell us what you are planning and we can build a package around you.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/contact?package=custom" />}>
            Ask about a custom package
          </Button>
        </CardContent>
      </Card>
    </Section>
  );
}
