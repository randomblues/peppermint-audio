"use client";

import { useEffect, useMemo, useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BookingLineItem } from "@/lib/booking-line-items";
import { formatAudCents } from "@/lib/payment-flow";
import { business } from "@/lib/site-content";

function StripeTrustMark() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground" aria-label="Powered by Stripe">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.2 13.1c-.4 1-1.5 1.7-3.2 1.7-1.4 0-2.5-.4-3.4-1.1l.7-1.2c.8.6 1.7.9 2.7.9.8 0 1.2-.3 1.2-.7 0-.5-.6-.7-1.7-1-1.5-.4-2.5-1-2.5-2.3 0-1.5 1.3-2.5 3.2-2.5 1.2 0 2.2.3 3 .8l-.7 1.3c-.7-.4-1.5-.7-2.3-.7-.7 0-1.1.3-1.1.7 0 .4.5.6 1.6.9 1.6.4 2.5 1.1 2.5 2.5 0 .3 0 .5-.1.7Z" />
      </svg>
      <span>Powered by <strong className="font-semibold text-foreground">stripe</strong></span>
    </div>
  );
}

type PaymentData = {
  customerName: string;
  email: string;
  eventType: string;
  pickupDate: string;
  dropoffDate: string;
  hireLineItems: BookingLineItem[];
  hireAmountCents: number;
  securityDepositCents: number;
  hirePaymentStatus: string;
  depositPaymentStatus: string;
  hireClientSecret: string | null;
  depositClientSecret: string | null;
};

function HireSummary({ data }: { data: PaymentData }) {
  const itemCount = data.hireLineItems.reduce((total, item) => total + item.quantity, 0);
  const totalDueCents = data.hireAmountCents + data.securityDepositCents;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="font-heading text-base font-semibold">Hire summary</p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {data.hireLineItems.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl bg-muted/35 px-3 py-3 text-sm">
            <span>
              <span className="font-medium">{item.quantity} × {item.name}</span>
              {item.option ? <span className="block text-xs text-muted-foreground">{item.option}</span> : null}
            </span>
            <span className="shrink-0 font-medium">{formatAudCents(item.unitPriceCents * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t pt-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Hire subtotal</span>
          <span>{formatAudCents(data.hireAmountCents)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Refundable security deposit</span>
          <span>{formatAudCents(data.securityDepositCents)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-3 text-base font-semibold">
          <span>Total due today</span>
          <span>{formatAudCents(totalDueCents)}</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">The security deposit is refundable and released after the equipment is returned.</p>
    </div>
  );
}

function DepositConfidencePanel({ data }: { data: PaymentData }) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04] shadow-sm">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-base font-semibold">How your deposit works</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your {formatAudCents(data.securityDepositCents)} deposit is a temporary card authorisation, not a second hire charge.
          </p>
        </div>
        <ChevronDown className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 border-t border-primary/10 px-4 py-4 sm:grid-cols-3 sm:px-5">
        {[
          ["1", "Authorised today", "Your bank may show the amount as pending. It is not captured as a purchase."],
          ["2", "Equipment returned", "We check the equipment back in against the agreed return time and condition."],
          ["3", "Released after check-in", "If everything is returned on time and complete, the full authorisation is released."],
        ].map(([step, title, detail]) => (
          <div key={step} className="flex gap-3 sm:block">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:mb-3">{step}</span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 border-t border-primary/10 bg-background/35 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p>The deposit only covers matters set out in the hire terms, such as damage, missing equipment, or late return.</p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">Questions?</p>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <a className="break-all font-medium text-foreground underline underline-offset-2" href={`mailto:${business.email}`}>{business.email}</a>
            <span className="hidden sm:inline" aria-hidden="true">or</span>
            <a className="font-medium text-foreground underline underline-offset-2" href={`tel:${business.phone.replace(/\s/g, "")}`}>{business.phone}</a>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground/80">Peppermint Audio · ABN {business.abn}</p>
        </div>
      </div>
    </details>
  );
}

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
    return (
      <div className="space-y-4">
        <HireSummary data={data} />
        <DepositConfidencePanel data={data} />
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm text-primary">Payment complete. Your hire payment is complete and your refundable security deposit has been authorised.</div>
        <StripeTrustMark />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <HireSummary data={data} />
      <DepositConfidencePanel data={data} />
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
      <p className="text-center text-xs text-muted-foreground">Your hire payment is taken now. Your refundable security deposit is released after the equipment is returned.</p>
      <StripeTrustMark />
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
