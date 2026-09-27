import type { Metadata } from "next";

import { BookingForm } from "@/components/booking-form";
import { Section } from "@/components/section";

export const metadata: Metadata = {
  title: "Making a Booking | Peppermint Audio",
  description:
    "Complete your event details and submit your audio equipment booking with Peppermint Audio in Melbourne.",
  alternates: {
    canonical: "/booking",
  },
};

export default function BookingPage() {
  return (
    <Section
      eyebrow="Peppermint Audio"
      title="Making a booking"
      description="Complete the form below with your event details so we can prepare your audio equipment hire."
    >
      <BookingForm />
    </Section>
  );
}
