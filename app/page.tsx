import Link from "next/link";
import Image from "next/image";

import { PackageCard } from "@/components/package-card";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { business, howItWorks, packageTiers } from "@/lib/site-content";

export default function Home() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-muted/40 via-background to-background" />
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-18 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8">
          <div className="max-w-2xl">
            <Badge variant="secondary">Pickup from Abbotsford 3067</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {business.heroHeading}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{business.heroSubheading}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/contact" />}>
                Get a Quote
              </Button>
              <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/packages" />}>
                View Packages
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Weddings</span>
              <span>·</span>
              <span>Private functions</span>
              <span>·</span>
              <span>Parties</span>
              <span>·</span>
              <span>Corporate events</span>
              <span>·</span>
              <span>Live gigs</span>
            </div>
          </div>
          <Card className="border">
            <CardHeader>
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Why Peppermint Audio?
              </p>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="relative h-36 overflow-hidden rounded-lg">
                <Image
                  src={business.heroImage}
                  alt="DJ mixing desk at a Melbourne event"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="divide-y rounded-lg border">
                <div className="p-3">
                  <p className="font-medium text-foreground">Complete from the start</p>
                  <p className="mt-1 text-muted-foreground">
                    Speakers, stands, microphones, mixer, and cables all included.
                  </p>
                </div>
                <div className="p-3">
                  <p className="font-medium text-foreground">Easy to run</p>
                  <p className="mt-1 text-muted-foreground">
                    Everything you need to get started, with plug-and-play setup and a walkthrough at pickup.
                  </p>
                </div>
                <div className="p-3">
                  <p className="font-medium text-foreground">Built around your event</p>
                  <p className="mt-1 text-muted-foreground">
                    Three clear packages from $120, plus custom options when you need them.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Section
        eyebrow="Packages"
        title="Three simple, complete packages"
        description="Choose a ready-to-use package for your guest count. Every option includes the equipment and cables you need for a hassle-free setup."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {packageTiers.map((pkg) => (
            <PackageCard key={pkg.slug} pkg={pkg} compact />
          ))}
        </div>
        <Card className="mt-4 border-dashed">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <CardTitle>Need something more specific?</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Tell us what you need for your venue, guest count, or special occasion and we can build a custom package around it.
              </p>
            </div>
            <Button nativeButton={false} render={<Link href="/contact?package=custom" />}>
              Build a custom package
            </Button>
          </CardContent>
        </Card>
      </Section>

      <Section eyebrow="Process" title="How hire works" description="Five simple steps from quote to return.">
        <ol className="grid gap-4 md:grid-cols-2">
          {howItWorks.map((step, index) => (
            <li key={step.title}>
              <Card className="border">
                <CardHeader>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">{step.detail}</CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Ready to lock in your date?" description="Tell us your event details and we will confirm package availability.">
        <Button size="lg" nativeButton={false} render={<Link href="/contact" />}>
          Start your enquiry
        </Button>
      </Section>
    </>
  );
}
