import type { Metadata } from "next";

import { CartView } from "@/components/cart-view";
import { Section } from "@/components/section";

export const metadata: Metadata = {
  title: "Your Hire Cart | Peppermint Audio",
  description: "Review your selected Peppermint Audio packages and equipment before submitting a booking request.",
};

export default function CartPage() {
  return (
    <Section eyebrow="Your selection" title="Review your hire cart" description="Combine packages and individual equipment, then submit one booking request.">
      <CartView />
    </Section>
  );
}
