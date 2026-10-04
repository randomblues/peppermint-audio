import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/section";

export default function PaymentSuccessPage() {
  return (
    <Section eyebrow="Payment update" title="Payment step received" description="Stripe has received this payment step. We will update your Peppermint Audio booking shortly.">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm text-muted-foreground">If you were asked to complete a second step, please return to the payment email and open the remaining link.</p>
        <Button className="mt-6" nativeButton={false} render={<Link href="/" />}>Return to homepage</Button>
      </div>
    </Section>
  );
}
