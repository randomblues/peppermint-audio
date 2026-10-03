import Link from "next/link";

import { PackageCard } from "@/components/package-card";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { packageTiers } from "@/lib/site-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Packages",
  description: "Simple, complete audio system hire packages for parties, presentations, weddings, and live events in Melbourne.",
  path: "/packages",
});

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
      description="Straightforward options starting at $95. Every package is ready to plug in and use. Weekend dates can fill quickly — send your event date and we&apos;ll check availability."
    >
      <Tabs defaultValue={selectedPackage} className="w-full">
        <TabsList
          className="!h-auto mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 bg-transparent p-0 sm:grid-cols-3 sm:gap-2"
          variant="default"
        >
          {packageTiers.map((pkg, index) => (
            <TabsTrigger
              key={pkg.slug}
              value={pkg.slug}
              className="group h-auto min-h-16 whitespace-normal rounded-lg border border-border/80 bg-card px-3 py-3 text-left leading-tight shadow-sm data-active:!border-2 data-active:!border-primary data-active:!bg-card data-active:!text-foreground data-active:shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_15%,transparent)] sm:text-center"
            >
              <span className="flex w-full items-center gap-3 sm:flex-col sm:gap-1">
                <span className="flex min-w-0 flex-1 items-center gap-2 sm:flex-col">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground group-data-[active]:bg-primary group-data-[active]:text-primary-foreground">
                    {index + 1}
                  </span>
                  <span>{pkg.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground group-data-[active]:font-medium group-data-[active]:text-primary">
                  {pkg.capacity} · ${pkg.price}
                </span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {packageTiers.map((pkg) => (
          <TabsContent key={pkg.slug} value={pkg.slug} className="mx-auto mt-6 w-full max-w-3xl">
            <PackageCard pkg={pkg} priority={pkg.slug === selectedPackage} />
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
