"use client";

import { useEffect, useMemo, useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { lineItemHireTotalCents, type BookingLineItem } from "@/lib/booking-line-items";
import { formatAudCents, rentalDays } from "@/lib/payment-flow";
import { business } from "@/lib/site-content";

function StripeTrustMark() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground" aria-label="Powered by Stripe">
      <span>Powered by</span>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 512 214" className="h-6 w-auto shrink-0 fill-white">
        <path d="M35.982 83.484c0-5.546 4.551-7.68 12.09-7.68 10.808 0 24.461 3.272 35.27 9.103V51.484c-11.804-4.693-23.466-6.542-35.27-6.542C19.2 44.942 0 60.018 0 85.192c0 39.252 54.044 32.995 54.044 49.92 0 6.541-5.688 8.675-13.653 8.675-11.804 0-26.88-4.836-38.827-11.378v33.849c13.227 5.689 26.596 8.106 38.827 8.106 29.582 0 49.92-14.648 49.92-40.106-.142-42.382-54.329-34.845-54.329-50.774zm96.142-66.986l-34.702 7.395-.142 113.92c0 21.05 15.787 36.551 36.836 36.551 11.662 0 20.195-2.133 24.888-4.693V140.8c-4.55 1.849-27.022 8.391-27.022-12.658V77.653h27.022V47.36h-27.022l.142-30.862zm71.112 41.386L200.96 47.36h-30.72v124.444h35.556V87.467c8.39-10.951 22.613-8.96 27.022-7.396V47.36c-4.551-1.707-21.191-4.836-29.582 10.524zm38.257-10.524h35.698v124.444h-35.698V47.36zm0-10.809l35.698-7.68V0l-35.698 7.538V36.55zm109.938 8.391c-13.938 0-22.898 6.542-27.875 11.094l-1.85-8.818h-31.288v165.83l35.555-7.537.143-40.249c5.12 3.698 12.657 8.96 25.173 8.96 25.458 0 48.64-20.48 48.64-65.564-.142-41.245-23.609-63.716-48.498-63.716zm-8.533 97.991c-8.391 0-13.37-2.986-16.782-6.684l-.143-52.765c3.698-4.124 8.818-6.968 16.925-6.968 12.942 0 21.902 14.506 21.902 33.137 0 19.058-8.818 33.28-21.902 33.28zM512 110.08c0-36.409-17.636-65.138-51.342-65.138-33.85 0-54.33 28.73-54.33 64.854 0 42.808 24.179 64.426 58.88 64.426 16.925 0 29.725-3.84 39.396-9.244v-28.445c-9.67 4.836-20.764 7.823-34.844 7.823-13.796 0-26.027-4.836-27.591-21.618h69.547c0-1.85.284-9.245.284-12.658zm-70.258-13.511c0-16.071 9.814-22.756 18.774-22.756 8.675 0 17.92 6.685 17.92 22.756h-36.694z" />
      </svg>
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
  depositHoldDate?: string | null;
  depositConsentRecorded?: boolean;
};

function HireSummary({ data }: { data: PaymentData }) {
  const nights = rentalDays(data.pickupDate, data.dropoffDate);
  const itemCount = data.hireLineItems.reduce((total, item) => total + item.quantity, 0);
  const totalDueCents = data.hirePaymentStatus === "paid" ? 0 : data.hireAmountCents;

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
            <span className="shrink-0 font-medium">{nights === null ? "Invalid dates" : formatAudCents(lineItemHireTotalCents(item, nights))}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{nights === null ? "Please contact us to check your hire dates." : `${nights} ${nights === 1 ? "night" : "nights"} · Standard first-night rate, additional nights half price.`}</p>
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
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{data.depositHoldDate ? `The security deposit is a separate temporary card hold, scheduled for ${data.depositHoldDate}, one day before pickup. If you pay after that date, we attempt the hold after your hire payment.` : "The security deposit is a separate temporary card hold, not part of the hire charge."}</p>
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
          ["1", data.depositHoldDate ? "Held before pickup" : "Card authorisation", data.depositHoldDate ? "We attempt the hold one day before pickup, or after payment for last-minute bookings. We will contact you if your card needs attention." : "Your bank may show the amount as pending. It is not captured as a purchase."],
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

function PaymentForm({ data, token, onComplete }: { data: PaymentData; token: string; onComplete: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [hirePaid, setHirePaid] = useState(data.hirePaymentStatus === "paid");
  const [depositAuthorized, setDepositAuthorized] = useState(data.depositPaymentStatus === "authorized");
  const [consent, setConsent] = useState(Boolean(data.depositConsentRecorded));
  const deferred = Boolean(data.depositHoldDate);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deferred && data.securityDepositCents > 0 && !consent) {
      setError("Please agree to the card-saving and security-deposit authorisation before continuing.");
      return;
    }
    if (!stripe || !elements) {
      setError("Secure card entry is not ready yet. Please try again.");
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) {
      setError("Payment details are not ready yet. Please try again.");
      return;
    }
    setError("");
    setProcessing(true);
    try {
      if (deferred && data.securityDepositCents > 0 && !data.depositConsentRecorded) {
        const response = await fetch(`/api/payment/${encodeURIComponent(token)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Your card-saving consent could not be recorded.");
      }
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
        if (deferred) {
          const response = await fetch(`/api/payment/${encodeURIComponent(token)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verifyDeposit: true }),
          });
          const payload = await response.json();
          if (!response.ok || payload.status !== "authorized") {
            throw new Error(payload.error ?? "Your deposit could not be verified. Please contact Peppermint Audio.");
          }
        }
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

  if (hirePaid && (data.securityDepositCents === 0 || depositAuthorized || (deferred && ["scheduled", "authorizing"].includes(data.depositPaymentStatus)))) {
    return (
      <div className="space-y-4">
        <HireSummary data={data} />
        <DepositConfidencePanel data={data} />
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm text-primary">{data.securityDepositCents === 0 ? "Payment complete. Your hire payment has been received. No security deposit is required." : depositAuthorized ? "Payment complete. Your hire payment is complete and your refundable security deposit has been authorised." : "Your hire payment has been received. Your security-deposit hold is scheduled before pickup; it has not been authorised yet."}</div>
        <StripeTrustMark />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <HireSummary data={data} />
      <DepositConfidencePanel data={data} />
      {["hold_too_short", "expired"].includes(data.depositPaymentStatus) ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">Your hire payment has been received. Please contact Peppermint Audio before pickup to arrange your security deposit.</p> : null}
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold">Card details</p>
        <div className="mt-3 rounded-lg border bg-background p-3">
          <CardElement options={{ hidePostalCode: false }} />
        </div>
        {deferred && data.securityDepositCents > 0 && !hirePaid ? <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 shrink-0" /><span>I authorise Peppermint Audio to save my card securely with Stripe and place a temporary {formatAudCents(data.securityDepositCents)} security-deposit hold one day before pickup, or after payment if I book later. Any amount captured from the deposit will be limited to costs covered by the hire terms.</span></label> : null}
      </div>
      {error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={processing || !stripe || !elements || (deferred && !hirePaid && !consent && data.securityDepositCents > 0) || (!data.hireClientSecret && !data.depositClientSecret)}>
        {processing ? "Processing securely…" : hirePaid ? `Authorise ${formatAudCents(data.securityDepositCents)} deposit hold` : `Pay ${formatAudCents(data.hireAmountCents)}`}
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
      <PaymentForm data={data} token={token} onComplete={() => setData((current) => current ? { ...current, hirePaymentStatus: "paid", depositConsentRecorded: true, depositPaymentStatus: current.securityDepositCents ? current.depositClientSecret ? "authorized" : "scheduled" : "not_required" } : current)} />
    </Elements>
  );
}
