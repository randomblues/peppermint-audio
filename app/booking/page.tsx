import type { Metadata } from "next";

import { BookingForm } from "@/components/booking-form";
import { Section } from "@/components/section";
import { packageTiers } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Making a Booking | Peppermint Audio",
  description:
    "Complete your event details and submit your audio equipment booking with Peppermint Audio in Melbourne.",
  alternates: {
    canonical: "/booking",
  },
};

type BookingPageProps = {
  searchParams: Promise<{ package?: string }>;
};

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const { package: requestedPackage } = await searchParams;
  const selectedPackage = packageTiers.some((pkg) => pkg.slug === requestedPackage)
    ? requestedPackage
    : undefined;

  return (
    <Section
      eyebrow="Peppermint Audio"
      title="Making a booking"
      description="The booking is only confirmed after Peppermint Audio reviews availability and confirms it."
    >
      <BookingForm initialPackageSlug={selectedPackage} />
    </Section>
  );
}
