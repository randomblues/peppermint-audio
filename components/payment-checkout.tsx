"use client";

import { useEffect, useMemo, useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import { Button } from "@/components/ui/button";
import { formatAudCents } from "@/lib/payment-flow";

type PaymentData = {
  customerName: string;
  email: string;
  eventType: string;
  pickupDate: string;
  dropoffDate: string;
  hireAmountCents: number;
  securityDepositCents: number;
  hirePaymentStatus: string;
  depositPaymentStatus: string;
  hireClientSecret: string | null;
  depositClientSecret: string | null;
};

function PaymentForm({ data, onComplete }: { data: PaymentData; onComplete: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [hirePaid, setHirePaid] = useState(data.hirePaymentStatus === "paid");
  const [depositAuthorized, setDepositAuthorized] = useState(data.depositPaymentStatus === "authorized");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) {
      setError("Payment details are not ready yet. Please try again.");
      return;
    }
    setError("");
    setProcessing(true);
    try {
      const paymentMethod = await stripe.createPaymentMethod({
        type: "card",
        card,
        billing_details: { name: data.customerName, email: data.email },
      });
      if (paymentMethod.error || !paymentMethod.paymentMethod) {
        throw new Error(paymentMethod.error?.message ?? "Your card could not be prepared.");
      }

      if (!hirePaid && data.hireClientSecret) {
        const hireResult = await stripe.confirmCardPayment(data.hireClientSecret, {
          payment_method: paymentMethod.paymentMethod.id,
        });
        if (hireResult.error) throw new Error(hireResult.error.message);
        if (hireResult.paymentIntent?.status !== "succeeded") throw new Error("The hire payment did not complete.");
        setHirePaid(true);
      }

      if (!depositAuthorized && data.depositClientSecret) {
        const depositResult = await stripe.confirmCardPayment(data.depositClientSecret, {
          payment_method: paymentMethod.paymentMethod.id,
        });
        if (depositResult.error) throw new Error(depositResult.error.message);
        if (depositResult.paymentIntent?.status !== "requires_capture") throw new Error("The security deposit could not be authorised.");
        setDepositAuthorized(true);
      }
      card.clear();
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be completed.");
    } finally {
      setProcessing(false);
    }
  }

  if (hirePaid && (data.securityDepositCents === 0 || depositAuthorized)) {
    return <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm text-primary">Payment complete. Your hire payment has been captured and your security deposit has been authorised without being captured.</div>;
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold">Card details</p>
        <div className="mt-3 rounded-lg border bg-background p-3">
          <CardElement options={{ hidePostalCode: false }} />
        </div>
      </div>
      {error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={processing || !stripe || !elements}>
        {processing ? "Processing securely…" : `Pay ${formatAudCents(data.hireAmountCents + data.securityDepositCents)}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Your hire payment is captured now. The security deposit is only authorised and can be released after the equipment is returned.</p>
    </form>
  );
}

export function PaymentCheckout({ token }: { token: string }) {
  const [data, setData] = useState<PaymentData | null>(null);
  const [error, setError] = useState("");
  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  useEffect(() => {
    fetch(`/api/payment/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as PaymentData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Payment link could not be loaded.");
        setData(payload);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Payment link could not be loaded."));
  }, [token]);

  if (error) return <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>;
  if (!data) return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading secure payment details…</p>;
  if (!stripePromise) return <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Payments are not configured yet. Please contact Peppermint Audio.</p>;

  return (
    <Elements stripe={stripePromise}>
      <PaymentForm data={data} onComplete={() => setData((current) => current ? { ...current, hirePaymentStatus: "paid", depositPaymentStatus: current.securityDepositCents ? "authorized" : "not_required" } : current)} />
    </Elements>
  );
}
