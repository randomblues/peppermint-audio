import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { business, faqs } from "@/lib/site-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "FAQ",
  description: "Frequently asked questions about audio system hire in Melbourne.",
  path: "/faq",
});

export default function FaqPage() {
  const renderQuestion = (faq: (typeof faqs)[number]) => (
    <AccordionItem key={faq.question} value={faq.question} className="border-border/60">
      <AccordionTrigger className="gap-5 rounded-none py-6 text-base leading-relaxed font-medium hover:text-primary hover:no-underline sm:py-7 sm:text-lg">
        {faq.question}
      </AccordionTrigger>
      <AccordionContent className="max-w-2xl pb-7 text-base leading-7 text-muted-foreground sm:pr-8">
        {faq.answer.split("\n\n").map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {faq.links ? (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
            {faq.links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-sm text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <section aria-labelledby="faq-heading" className="mx-auto w-full max-w-3xl px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-24">
        <header className="mb-8 sm:mb-12">
          <h1 id="faq-heading" className="font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Good sound. Less stress.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            You don&apos;t need to know all the sound stuff. Here&apos;s a little help figuring out what you need.
          </p>
        </header>
        <Accordion>
          {faqs.slice(0, 5).map(renderQuestion)}
        </Accordion>
        <details className="mt-8 border-y border-border/60 sm:mt-10">
          <summary className="cursor-pointer rounded-sm py-5 text-base font-medium marker:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            A few practical bits
            <span className="mt-1 block pl-4 text-sm font-normal text-muted-foreground">
              Multi-night hire, pickup &amp; booking
            </span>
          </summary>
          <Accordion>{faqs.slice(5).map(renderQuestion)}</Accordion>
        </details>
        <div className="mt-10 sm:mt-12">
          <h2 className="font-heading text-xl font-medium">Still got a question?</h2>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            Tell us what you have in mind. We&apos;ll help you figure it out.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link href="/contact" className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Get in touch
            </Link>
            <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="rounded-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Call {business.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
