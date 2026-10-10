"use client";

import { useEffect, useMemo, useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/section";
import { lineItemHireTotalCents, type BookingLineItem } from "@/lib/booking-line-items";
import { formatAudCents, isImmediateDepositBooking, isMelbourneDateInFuture, rentalDays } from "@/lib/payment-flow";
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

function isScheduledHoldDate(date: string | null | undefined) {
  return Boolean(date && isMelbourneDateInFuture(date));
}

function formatMelbourneDate(date: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(`${date}T00:00:00`)).replace(/ /g, "\u00a0");
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

function isPaymentComplete(data: PaymentData) {
  return data.hirePaymentStatus === "paid" && (
    data.securityDepositCents === 0
    || ["authorized", "captured", "released"].includes(data.depositPaymentStatus)
    || Boolean(data.depositHoldDate && ["scheduled", "authorizing"].includes(data.depositPaymentStatus))
  );
}

function PaymentConfirmation({ data }: { data: PaymentData }) {
  const depositAuthorized = data.depositPaymentStatus === "authorized";
  const depositScheduled = ["scheduled", "authorizing"].includes(data.depositPaymentStatus);
  const message = data.securityDepositCents === 0
    ? "Payment complete. Your hire payment has been received. No security deposit is required."
    : depositAuthorized
      ? "Payment complete. Your hire payment is complete and your refundable security deposit has been authorised."
      : depositScheduled
        ? "Your hire payment has been received. Your security deposit hold is scheduled before pickup; it has not been authorised yet."
        : "Payment complete. Your hire payment has been received.";

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div role="status" className="mb-8 text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Payment received</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <div className="space-y-4">
        <DepositConfidencePanel data={data} />
        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium marker:hidden sm:p-5 [&::-webkit-details-marker]:hidden">
            View hire summary
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t p-3">
            <HireSummary data={data} receipt />
          </div>
        </details>
        <StripeTrustMark />
      </div>
    </section>
  );
}

function HireSummary({ data, receipt = false }: { data: PaymentData; receipt?: boolean }) {
  const nights = rentalDays(data.pickupDate, data.dropoffDate);
  const itemCount = data.hireLineItems.reduce((total, item) => total + item.quantity, 0);
  const immediateDeposit = Boolean(data.securityDepositCents > 0 && data.depositHoldDate && isImmediateDepositBooking(data.pickupDate));
  const depositSecured = ["authorized", "captured", "released"].includes(data.depositPaymentStatus);
  const hirePaid = data.hirePaymentStatus === "paid";
  const totalDueCents = (hirePaid ? 0 : data.hireAmountCents)
    + (immediateDeposit && !depositSecured ? data.securityDepositCents : 0);
  const securityDepositLabel = data.securityDepositCents === 0
    ? "Not required"
    : data.depositPaymentStatus === "authorized"
      ? "Card hold authorised"
      : data.depositPaymentStatus === "released"
        ? "Card hold released"
        : data.depositPaymentStatus === "captured"
          ? "Captured"
          : ["scheduled", "authorizing"].includes(data.depositPaymentStatus)
            ? "Card hold scheduled before pickup"
            : "Temporary card hold";

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
      <div className="mt-4 space-y-3 border-t pt-4">
        {!receipt ? <div className="flex items-center justify-between gap-4 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Hire subtotal</span>
            {hirePaid ? <span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="size-3.5" aria-hidden="true" />Paid</span> : null}
          </div>
          <span className="shrink-0 tabular-nums">{formatAudCents(data.hireAmountCents)}</span>
        </div> : null}
        <div className="flex items-center justify-between gap-4 pb-1">
          <span className="text-sm font-semibold sm:text-base">{receipt ? "Hire payment received" : "Total due today"}</span>
          <span className="shrink-0 text-xl font-bold tabular-nums sm:text-2xl">{formatAudCents(receipt ? data.hireAmountCents : totalDueCents)}</span>
        </div>
        <div className="flex items-start justify-between gap-4 border-t border-dashed pt-3 text-xs text-muted-foreground">
          <div className="min-w-0 space-y-1">
            <span className="block leading-5">Refundable security deposit</span>
            <span className="block text-[11px] leading-relaxed">{securityDepositLabel}</span>
          </div>
          <span className="shrink-0 leading-5 tabular-nums">{formatAudCents(data.securityDepositCents)}</span>
        </div>
      </div>
    </div>
  );
}

function DepositConfidencePanel({ data }: { data: PaymentData }) {
  if (data.securityDepositCents === 0) return null;
  const showScheduledHoldDate = isScheduledHoldDate(data.depositHoldDate);
  const immediateDeposit = Boolean(data.depositHoldDate && isImmediateDepositBooking(data.pickupDate));
  const depositAuthorized = data.depositPaymentStatus === "authorized";
  return (
    <details className="group overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04] shadow-sm">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-base font-semibold">How your security deposit works</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your {formatAudCents(data.securityDepositCents)} security deposit is a temporary card authorisation {depositAuthorized ? "that has been placed and will be released after return." : showScheduledHoldDate ? `scheduled for ${formatMelbourneDate(data.depositHoldDate!)}.` : immediateDeposit ? "that will be placed as part of today's checkout." : "that will be released after return."}
          </p>
        </div>
        <ChevronDown className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 border-t border-primary/10 px-4 py-4 sm:grid-cols-3 sm:px-5">
        {[
          ["1", depositAuthorized ? "Card authorised" : showScheduledHoldDate ? "Held before pickup" : immediateDeposit ? "Authorised today" : "Card authorisation", depositAuthorized ? "The temporary hold has been placed. Your bank may show it as pending; it is not a purchase." : showScheduledHoldDate ? `We place the temporary hold on ${formatMelbourneDate(data.depositHoldDate!)}. Your bank may show it as pending; it is not a purchase.` : "The temporary hold will be placed during checkout. Your bank may show it as pending; it is not a purchase."],
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
          <p>The security deposit only covers matters set out in the hire terms, such as damage, missing equipment, or late return.</p>
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
  const [consentRecorded, setConsentRecorded] = useState(Boolean(data.depositConsentRecorded));
  const requiresDepositConsent = Boolean(data.depositHoldDate);
  const immediateDeposit = Boolean(data.depositHoldDate && isImmediateDepositBooking(data.pickupDate));
  const showScheduledHoldDate = isScheduledHoldDate(data.depositHoldDate);
  const currentData = {
    ...data,
    hirePaymentStatus: hirePaid ? "paid" : data.hirePaymentStatus,
    depositPaymentStatus: depositAuthorized ? "authorized" : data.depositPaymentStatus,
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requiresDepositConsent && data.securityDepositCents > 0 && !consent) {
      setError(immediateDeposit
        ? "Please agree to the hire payment and temporary security deposit hold before continuing."
        : "Please agree to the card-saving and security deposit authorisation before continuing.");
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
      if (requiresDepositConsent && data.securityDepositCents > 0 && !consentRecorded) {
        const response = await fetch(`/api/payment/${encodeURIComponent(token)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? (immediateDeposit
          ? "Your checkout consent could not be recorded."
          : "Your card-saving consent could not be recorded."));
        setConsentRecorded(true);
      }
      const preparePaymentMethod = async () => {
        const result = await stripe.createPaymentMethod({
          type: "card",
          card,
          billing_details: { name: data.customerName, email: data.email },
        });
        if (result.error || !result.paymentMethod) {
          throw new Error(result.error?.message ?? "Your card could not be prepared.");
        }
        return result.paymentMethod.id;
      };

      if (!hirePaid && data.hireClientSecret) {
        const hireResult = await stripe.confirmCardPayment(data.hireClientSecret, {
          payment_method: await preparePaymentMethod(),
        });
        if (hireResult.error) throw new Error(hireResult.error.message);
        if (hireResult.paymentIntent?.status !== "succeeded") throw new Error("The hire payment did not complete.");
        setHirePaid(true);
      }

      if (!depositAuthorized && data.depositClientSecret) {
        const depositResult = await stripe.confirmCardPayment(data.depositClientSecret, {
          payment_method: await preparePaymentMethod(),
        });
        if (depositResult.error) throw new Error(depositResult.error.message);
        if (depositResult.paymentIntent?.status !== "requires_capture") throw new Error("The security deposit could not be authorised.");
        if (requiresDepositConsent) {
          const response = await fetch(`/api/payment/${encodeURIComponent(token)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verifyDeposit: true }),
          });
          const payload = await response.json();
          if (!response.ok || payload.status !== "authorized") {
            throw new Error(payload.error ?? "Your security deposit could not be verified. Please contact Peppermint Audio.");
          }
        }
        setDepositAuthorized(true);
      }
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be completed.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <HireSummary data={currentData} />
      <DepositConfidencePanel data={currentData} />
      {["hold_too_short", "expired"].includes(data.depositPaymentStatus) ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">Your hire payment has been received. Please contact Peppermint Audio before pickup to arrange your security deposit.</p> : null}
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold">Card details</p>
        <div className="mt-3 rounded-lg border bg-background p-3">
          <CardElement options={{
            hidePostalCode: false,
            style: {
              base: {
                color: "#f4f4f5",
                fontSize: "16px",
                "::placeholder": { color: "#a1a1aa" },
              },
              invalid: { color: "#f87171" },
            },
          }} />
        </div>
        {requiresDepositConsent && data.securityDepositCents > 0 && !hirePaid ? <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 shrink-0" /><span>{immediateDeposit
          ? `I authorise Peppermint Audio to charge the hire and place a temporary ${formatAudCents(data.securityDepositCents)} security deposit hold as part of this checkout. The hold is released after return unless charges apply under the hire terms.`
          : `I authorise Peppermint Audio to save my card, charge the hire, and place a temporary ${formatAudCents(data.securityDepositCents)} security deposit hold on ${formatMelbourneDate(data.depositHoldDate!)} (one day before pickup). The hold is released after return unless charges apply under the hire terms.`}</span></label> : null}
      </div>
      {error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={processing || !stripe || !elements || (requiresDepositConsent && !hirePaid && !consent && data.securityDepositCents > 0) || (!data.hireClientSecret && !data.depositClientSecret)}>
        {processing ? "Processing securely…" : hirePaid ? `Authorise ${formatAudCents(data.securityDepositCents)} security deposit hold` : `Pay ${formatAudCents(data.hireAmountCents + (immediateDeposit ? data.securityDepositCents : 0))}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {data.securityDepositCents === 0
          ? "Your hire payment is taken now. No security deposit is required for this booking."
          : hirePaid
          ? "Your hire payment has been received. Complete the security deposit hold above."
          : showScheduledHoldDate
            ? "Your hire payment is taken now. The security deposit hold is scheduled for one day before pickup."
            : immediateDeposit
              ? "Your hire payment will be charged and the temporary security deposit hold placed together during checkout."
              : "Your hire payment is taken now. Your refundable security deposit is released after the equipment is returned."}
      </p>
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

  if (data && !error && isPaymentComplete(data)) return <PaymentConfirmation data={data} />;

  return (
    <Section eyebrow="Secure payment" title="Pay for your hire" headingAs="h1" description="Review your hire and security deposit details, then complete your payment securely.">
      <div className="mx-auto max-w-xl">
        {error
          ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
          : !data
            ? <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading secure payment details…</p>
            : !stripePromise
              ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Payments are not configured yet. Please contact Peppermint Audio.</p>
              : <Elements stripe={stripePromise}>
                <PaymentForm data={data} token={token} onComplete={() => setData((current) => current ? { ...current, hirePaymentStatus: "paid", depositConsentRecorded: true, depositPaymentStatus: current.securityDepositCents ? current.depositClientSecret ? "authorized" : "scheduled" : "not_required" } : current)} />
              </Elements>}
      </div>
    </Section>
  );
}
