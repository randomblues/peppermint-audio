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
  searchParams: Promise<{ package?: string; equipment?: string; cart?: string }>;
};

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const { package: requestedPackage, equipment: requestedEquipment, cart: requestedCart } = await searchParams;
  const selectedPackage = packageTiers.some((pkg) => pkg.slug === requestedPackage)
    ? requestedPackage
    : undefined;
  let selectedEquipment = requestedEquipment;

  if (requestedCart) {
    try {
      const cart = JSON.parse(requestedCart) as Array<{ name?: unknown; option?: unknown; quantity?: unknown }>;
      const summary = cart
        .filter((item) => typeof item.name === "string")
        .map((item) => `${item.quantity && Number(item.quantity) > 1 ? `${item.quantity} × ` : ""}${item.name}${typeof item.option === "string" ? ` (${item.option})` : ""}`)
        .join(", ");
      if (summary) selectedEquipment = summary;
    } catch {
      selectedEquipment = requestedEquipment;
    }
  }

  return (
    <Section
      eyebrow="Peppermint Audio"
      title="Making a booking"
      description="The booking is only confirmed after Peppermint Audio reviews availability and confirms it."
    >
      <BookingForm initialPackageSlug={selectedPackage} initialEquipmentName={selectedEquipment} />
    </Section>
  );
}
