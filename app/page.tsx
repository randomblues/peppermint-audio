import Link from "next/link";
import Image from "next/image";

import { PackageCarousel } from "@/components/package-carousel";
import { CustomerReviews } from "@/components/customer-reviews";
import { PhoneCallButton } from "@/components/phone-call-button";
import { business, homeHireSteps } from "@/lib/site-content";

export default function Home() {
  return (
    <>
      <section aria-labelledby="home-heading" className="mx-auto w-full max-w-6xl px-5 pt-14 pb-8 sm:px-8 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-6">
          <div>
            <h1 id="home-heading" className="font-heading max-w-[12ch] text-[clamp(3.5rem,8vw,6.5rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
              {business.heroHeadingLines.map((line) => (
                <span key={line} className="block whitespace-nowrap">{line}{" "}</span>
              ))}
            </h1>
            <div className="mt-7 max-w-lg sm:mt-8">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-relaxed text-foreground/75" aria-label={business.heroSubheading}>
                {business.heroSubheading.split(" · ").map((event, index) => (
                  <span key={event} className="inline-flex items-center gap-3 whitespace-nowrap">
                    {index > 0 ? <span aria-hidden="true" className="text-primary/50">·</span> : null}
                    {event}
                  </span>
                ))}
              </p>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">{business.heroSupportingText}</p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/packages" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/5 px-6 text-base font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                <span>View packages</span>
              </Link>
              <PhoneCallButton phone={business.phone} className="h-12 rounded-xl border-border bg-transparent bg-none px-5 font-medium shadow-none ring-0 hover:bg-muted/40" />
            </div>
            <Link href="/contact" className="mt-3 inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Not sure what you need? Ask us.
            </Link>
          </div>
          <div className="hidden w-full lg:block">
            <Image
              src={business.heroImage}
              alt="Microphones and a PA speaker set up on an outdoor stage"
              width={1000}
              height={1503}
              priority
              sizes="(min-width: 1024px) 420px, (min-width: 640px) 384px, 320px"
              className="aspect-[4/5] w-full rounded-3xl object-cover object-[50%_70%]"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="packages-heading" className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
        <header className="mb-8 max-w-2xl sm:mb-10">
          <h2 id="packages-heading" className="font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Explore our sound packages.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Start with what you&apos;re planning. We&apos;ve put the gear together so you don&apos;t have to figure out every cable.
          </p>
        </header>
        <PackageCarousel />
      </section>

      <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <header className="max-w-2xl">
          <h2 id="how-heading" className="font-heading text-3xl font-semibold tracking-tight sm:text-5xl">No idea where to start? Start here.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            You don&apos;t need to know all the sound stuff. That&apos;s what we&apos;re here for.
          </p>
        </header>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {homeHireSteps.map((step, index) => (
            <li key={step.title} className="border-t border-border/60 pt-6">
              <p aria-hidden="true" className="font-heading text-sm font-medium text-primary">0{index + 1}</p>
              <h3 className="font-heading mt-4 text-2xl font-medium tracking-tight">{step.title}</h3>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{step.detail}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <Link href="/how-it-works" className="inline-flex min-h-11 items-center rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            The pickup-to-party details
          </Link>
          <Link href="/faq" className="inline-flex min-h-11 items-center rounded-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            A few questions before the party
          </Link>
        </div>
      </section>

      <section aria-labelledby="reviews-heading" className="mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20">
        <header className="mb-16 max-w-2xl">
          <h2 id="reviews-heading" className="font-heading text-3xl font-semibold tracking-tight sm:text-5xl">
            Don&apos;t just take our word for it.
          </h2>
        </header>
        <CustomerReviews />
        <a href={business.googleReviewsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          Read more reviews on Google
        </a>
      </section>

      <section aria-labelledby="contact-heading" className="border-t border-border/60 bg-primary/5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 sm:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-xl">
            <h2 id="contact-heading" className="font-heading text-2xl leading-tight font-medium tracking-tight sm:text-3xl">Got a date in mind?</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Tell us what you&apos;re planning and we&apos;ll check availability for your dates. Weekends can book out quickly, so we recommend getting your dates sorted ahead of time.
            </p>
          </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                Let&apos;s chat
              </Link>
              <PhoneCallButton phone={business.phone} className="h-12 rounded-xl border-border bg-transparent bg-none px-5 font-medium shadow-none ring-0 hover:bg-muted/40" />
          </div>
        </div>
      </section>
    </>
  );
}
