import { PolicyPage } from "@/components/policy-page";
import { createPageMetadata } from "@/lib/seo";
import { business, hireTerms } from "@/lib/site-content";

export const metadata = createPageMetadata({
  title: "Terms of Hire",
  description: "These terms apply to equipment hired from Peppermint Audio. Please read them before submitting a booking request.",
  path: "/terms-of-hire",
});

export default function TermsOfHirePage() {
  return (
    <PolicyPage title="Terms of Hire" introduction="These terms apply to equipment hired from Peppermint Audio. Please read them before submitting a booking request." sections={hireTerms}>
      <section aria-labelledby="contact-heading" className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
        <h2 id="contact-heading" className="font-heading text-xl font-medium">Contact us</h2>
        <div className="mt-4 space-y-2 text-base leading-7 text-muted-foreground">
          <p className="font-medium text-foreground">{business.name}</p>
          <p>Email: <a href={`mailto:${business.email}`} className="break-all rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{business.email}</a></p>
          <p>Phone: <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{business.phone}</a></p>
          <p>Pickup and return: {business.pickupAddress}</p>
        </div>
      </section>
    </PolicyPage>
  );
}
