import Link from "next/link";

import { HireJourney } from "@/components/hire-journey";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "How It Works",
  description: "How Peppermint Audio package and equipment hire works, from cart request to pickup in Abbotsford Melbourne.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <section aria-labelledby="hire-heading">
      <header className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
        <h1 id="hire-heading" className="font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">How It Works</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
          You bring the plans. We&apos;ll help with the sound. Here&apos;s how to get the gear from us to your event.
        </p>
      </header>
      <HireJourney />
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div>
        <h2 className="font-heading text-xl font-medium">Still got a question?</h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Not sure what you need? <Link href="/faq" className="text-primary underline underline-offset-4">The FAQ is a good place to start.</Link> Or <Link href="/contact" className="text-primary underline underline-offset-4">get in touch</Link> and we&apos;ll help you work it out.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/packages" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          Browse packages
        </Link>
        <Link href="/equipment" className="inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          Hire individual equipment
        </Link>
      </div>
      </div>
    </section>
  );
}
