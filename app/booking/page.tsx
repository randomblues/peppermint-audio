import { BookingForm } from "@/components/booking-form";
import type { CartItem } from "@/components/cart-provider";
import { Section } from "@/components/section";
import { packageTiers } from "@/lib/site-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Making a Booking",
  description:
    "Complete your event details and submit your audio equipment booking with Peppermint Audio in Melbourne.",
  path: "/booking",
});

type BookingPageProps = {
  searchParams: Promise<{ package?: string; equipment?: string; cart?: string }>;
};

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const { package: requestedPackage, equipment: requestedEquipment, cart: requestedCart } = await searchParams;
  let selectedPackage = packageTiers.some((pkg) => pkg.slug === requestedPackage)
    ? requestedPackage
    : undefined;
  let selectedEquipment = requestedEquipment;
  let cartItems: CartItem[] = [];

  if (requestedCart) {
    try {
      const cart = JSON.parse(requestedCart) as Array<Partial<CartItem>>;
      cartItems = cart.filter((item): item is CartItem => (
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        (item.kind === "package" || item.kind === "equipment") &&
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
      ));
      const summary = cartItems
        .map((item) => `${item.quantity > 1 ? `${item.quantity} × ` : ""}${item.name}${item.option ? ` (${item.option})` : ""}`)
        .join(", ");
      if (summary) selectedEquipment = summary;
      if (!selectedPackage) {
        const cartPackage = cartItems.find((item) => item.kind === "package");
        selectedPackage = packageTiers.find((pkg) =>
          pkg.name === cartPackage?.name || `package:${pkg.slug}` === cartPackage?.id,
        )?.slug;
      }
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
      <BookingForm initialPackageSlug={selectedPackage} initialEquipmentName={selectedEquipment} cartItems={cartItems} />
    </Section>
  );
}
