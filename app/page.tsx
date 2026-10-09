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
            <p className="text-sm font-medium text-primary">PA &amp; speaker hire in {business.serviceArea}</p>
            <h1 id="home-heading" className="font-heading mt-6 max-w-[12ch] text-[clamp(3.5rem,8vw,6.5rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
              {business.heroHeadingLines.map((line) => (
                <span key={line} className="block whitespace-nowrap">{line}{" "}</span>
              ))}
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">{business.heroSubheading}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/packages" className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                Find my setup
              </Link>
              <Link href="/equipment" className="inline-flex min-h-11 items-center rounded-sm text-sm text-foreground underline decoration-primary/60 underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                Just need the speakers?
              </Link>
            </div>
            <Link href="/contact" className="mt-4 inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Not sure what you need? Ask us.
            </Link>
          </div>
          <div className="mx-auto w-full max-w-xs sm:max-w-sm lg:max-w-none">
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
        <div className="mt-12 grid gap-3 border-y border-border/60 py-6 text-sm text-muted-foreground sm:mt-16 sm:grid-cols-3 sm:gap-6 sm:py-7">
          <p>Packages or individual gear</p>
          <p className="sm:text-center">Pickup in {business.pickupSuburb} {business.pickupPostcode}</p>
          <p className="sm:text-right">Setup walkthrough included</p>
        </div>
      </section>

      <section aria-labelledby="packages-heading" className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
        <header className="mb-8 max-w-2xl sm:mb-10">
          <p className="text-sm font-medium text-primary">Find your sound</p>
          <h2 id="packages-heading" className="font-heading mt-4 text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">
            A little speech. A proper boogie.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Start with what you&apos;re planning. We&apos;ve put the gear together so you don&apos;t have to figure out every cable.
          </p>
        </header>
        <PackageCarousel />
      </section>

      <section aria-label="Other ways to hire" className="border-y border-border/60 bg-primary/5">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-sm font-medium text-primary">Individual gear</p>
            <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Just two speakers? All good.</h2>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              Already got the decks, the playlist, or most of the setup? Hire just the bits you need. Speakers, mics, mixers, lights. No full package required.
            </p>
            <Link href="/equipment" className="mt-5 inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Have a browse of the gear
            </Link>
          </div>
          <div className="border-t border-border/60 pt-10 md:border-t-0 md:border-l md:pl-12 md:pt-0">
            <p className="text-sm font-medium text-primary">Something a bit different</p>
            <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Your event isn&apos;t a template.</h2>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              Neither does your setup have to be. Tell us what you&apos;re bringing, who&apos;s coming, and what you have in mind. We&apos;ll help work it out.
            </p>
            <Link href="/contact?package=custom" className="mt-5 inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Let&apos;s talk about your setup
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <header className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Less figuring it out. More enjoying it.</p>
          <h2 id="how-heading" className="font-heading mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">No idea where to start? Start here.</h2>
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
          <p className="text-sm font-medium text-primary">From people who&apos;ve hired with us</p>
          <h2 id="reviews-heading" className="font-heading mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            Don&apos;t just take our word for it.
          </h2>
        </header>
        <CustomerReviews />
        <a href={business.googleReviewsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          Read more reviews on Google
        </a>
      </section>

      <section aria-labelledby="contact-heading" className="border-t border-border/60 bg-primary/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Let&apos;s get your sound sorted</p>
            <h2 id="contact-heading" className="font-heading mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">Got a date in mind?</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              Tell us what you&apos;re planning and we&apos;ll check what&apos;s available. Weekend slots can go quickly, so the sooner you get in, the better.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                Let&apos;s chat
              </Link>
              <PhoneCallButton phone={business.phone} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
