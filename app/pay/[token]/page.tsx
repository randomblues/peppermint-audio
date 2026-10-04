import { Section } from "@/components/section";
import { PaymentCheckout } from "@/components/payment-checkout";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Section eyebrow="Secure payment" title="Complete your Peppermint Audio hire" description="One secure card form handles your hire payment and refundable security-deposit authorisation. The deposit hold may expire after about seven days, so this link should be used close to the return date.">
      <div className="mx-auto max-w-xl">
        <PaymentCheckout token={token} />
      </div>
    </Section>
  );
}
