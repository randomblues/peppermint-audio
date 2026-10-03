import { CartView } from "@/components/cart-view";
import { Section } from "@/components/section";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Your Hire Cart",
  description: "Review your selected Peppermint Audio packages and equipment before submitting a booking request.",
  path: "/cart",
  robots: {
    index: false,
    follow: false,
  },
});

export default function CartPage() {
  return (
    <Section eyebrow="Your selection" title="Review your hire cart" description="Combine packages and individual equipment, then submit one booking request.">
      <CartView />
    </Section>
  );
}
