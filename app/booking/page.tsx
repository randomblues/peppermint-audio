import { BookingForm } from "@/components/booking-form";
import { Section } from "@/components/section";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Submit a Booking Request",
  description: "Submit your Peppermint Audio hire details for availability review.",
  path: "/booking",
  robots: { index: false, follow: false },
});

export default function BookingPage() {
  return (
    <Section
      eyebrow="Booking request"
      title="Tell us about your hire"
      headingAs="h1"
      description="Complete the form below and we will review availability before confirming your booking."
    >
      <BookingForm />
    </Section>
  );
}
