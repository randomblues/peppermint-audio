import type { Metadata } from "next";

import { Section } from "@/components/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "FAQ | Peppermint Audio",
  description: "Frequently asked questions about audio system hire in Melbourne.",
};

export default function FaqPage() {
  return (
    <Section eyebrow="FAQ" title="Frequently Asked Questions" description="Common questions before booking.">
      <Accordion defaultValue={faqs[0] ? [faqs[0].question] : []}>
        {faqs.map((faq) => (
          <AccordionItem
            key={faq.question}
            value={faq.question}
            className="rounded-lg border px-4 data-[open]:bg-muted/20"
          >
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
