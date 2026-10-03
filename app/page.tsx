import Link from "next/link";
import Image from "next/image";

import { PackageCarousel } from "@/components/package-carousel";
import { CustomerReviews } from "@/components/customer-reviews";
import { PhoneCallButton } from "@/components/phone-call-button";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { business, howItWorks } from "@/lib/site-content";

export default function Home() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-20">
          <Image
            src={business.heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-105 object-cover object-[75%_center] opacity-55"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-background/90 via-background/65 to-background/25" />
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-18 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8">
          <div className="max-w-2xl">
            <Badge variant="secondary">Pickup from Abbotsford 3067</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {business.heroHeading}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{business.heroSubheading}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/booking" />}>
                Book now
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                nativeButton={false}
                render={<Link href="/packages" />}
              >
                View Packages
              </Button>
              <PhoneCallButton phone={business.phone} />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground/85">
              Weekend dates can fill quickly — send your event date and we&apos;ll check availability.
            </p>
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
          <Card className="border bg-background/85 backdrop-blur-md">
            <CardHeader>
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Why Peppermint Audio?
              </p>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
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
                    Everything you need to get started with a straightforward plug-and-play setup.
                  </p>
                </div>
                <div className="p-3">
                  <p className="font-medium text-foreground">Built around your event</p>
                  <p className="mt-1 text-muted-foreground">
                    Clear package options from $95, plus custom options when you need them.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Section
        eyebrow="Packages"
        title="Simple, complete packages"
        description="Choose a ready-to-use package for your guest count. Every option includes the equipment and cables you need for a hassle-free setup."
      >
        <PackageCarousel />
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

      <Section
        eyebrow="Individual hire"
        title="Only need one or two items?"
        description="Hire a single speaker, a pair, a microphone, mixer, DI box, or lighting item without taking a full package."
      >
        <Card className="border">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Build a smaller hire</CardTitle>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Choose the exact equipment you need, including single-speaker and pair options, then enquire about availability.
              </p>
            </div>
            <Button nativeButton={false} render={<Link href="/equipment" />}>
              Browse equipment
            </Button>
          </CardContent>
        </Card>
      </Section>

      <Section
        eyebrow="Customer reviews"
        title="What customers say"
        description="Read what customers have said about hiring equipment from Peppermint Audio."
      >
        <CustomerReviews />
        <a
          href={business.googleReviewsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex font-medium text-primary underline-offset-4 hover:underline"
        >
          Read more reviews on Google
        </a>
      </Section>

      <Section
        eyebrow="Melbourne PA hire"
        title="Simple sound system hire for your event"
        description="Peppermint Audio provides PA system hire in Melbourne for weddings, parties, presentations, corporate events, live gigs, and private functions. Collect your ready-to-use equipment from Abbotsford 3067 and get support with setup before your event."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border">
            <CardHeader>
              <CardTitle>Speaker hire</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Choose speakers and stands sized for your guest count and venue.
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader>
              <CardTitle>Event-ready sound</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Our microphone hire includes wired or wireless options for speeches, announcements, and performances.
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader>
              <CardTitle>Complete PA packages</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Get the mixer, cables, stands, and connections you need in one straightforward package.
            </CardContent>
          </Card>
        </div>
      </Section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" aria-hidden="true">
        <div className="border-t" />
      </div>

      <Section eyebrow="Process" title="How hire works" description="Five simple steps from request to return.">
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

      <section className="relative isolate overflow-hidden border-y">
        <Image
          src={business.ctaImage}
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover object-[50%_58%] opacity-55"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/80 via-background/60 to-background/45" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              Ready to lock in your date?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tell us your event details and we will confirm package availability.
            </p>
            <Button className="mt-6" size="lg" nativeButton={false} render={<Link href="/booking" />}>
              Start a booking request
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
