import { Section } from "@/components/section";
import { PaymentCheckout } from "@/components/payment-checkout";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Section eyebrow="Secure payment" title="Pay for your hire" description="Review your hire and deposit details, then complete your payment securely.">
      <div className="mx-auto max-w-xl">
        <PaymentCheckout token={token} />
      </div>
    </Section>
  );
}
