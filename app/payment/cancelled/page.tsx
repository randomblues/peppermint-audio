import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/section";

export default function PaymentCancelledPage() {
  return (
    <Section eyebrow="Payment update" title="Payment not completed" description="No payment was completed in this Stripe session. Please contact Peppermint Audio if you need a fresh payment link.">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <Button className="mt-2" nativeButton={false} render={<Link href="/" />}>Return to homepage</Button>
      </div>
    </Section>
  );
}
