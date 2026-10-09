import { PaymentCheckout } from "@/components/payment-checkout";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PaymentCheckout token={token} />;
}
