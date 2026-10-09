import { lineItemsTotalCents, type BookingLineItem } from "@/lib/booking-line-items";
import { formatAudCents } from "@/lib/payment-flow";
import { hirePricing } from "@/lib/site-content";

export function HirePriceSummary({
  items,
  nights,
  label = "Hire total",
  detail,
}: {
  items: BookingLineItem[];
  nights: number;
  label?: string;
  detail?: string;
}) {
  const firstNightCents = lineItemsTotalCents(items);
  const totalCents = lineItemsTotalCents(items, nights);
  const standardTotalCents = items.reduce((sum, item) =>
    sum + item.unitPriceCents * item.quantity * (item.kind === "custom" ? 1 : nights), 0);
  const savingsCents = standardTotalCents - totalCents;
  const extraNights = nights - 1;

  return (
    <div className="space-y-4 tabular-nums" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {savingsCents > 0 ? (
            <span className="text-sm text-muted-foreground">
              <span className="sr-only">Standard nightly total: </span>
              <s>{formatAudCents(standardTotalCents)}</s>
            </span>
          ) : null}
          <strong className="text-2xl font-semibold tracking-tight">{formatAudCents(totalCents)}</strong>
        </div>
      </div>
      {savingsCents > 0 ? (
        <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/10 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-lg font-semibold text-primary">You save {formatAudCents(savingsCents)}</p>
            <p className="text-xs text-muted-foreground">with multi-night hire</p>
          </div>
          <dl className="space-y-2 border-t border-primary/15 pt-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">First night</dt>
              <dd className="shrink-0">{formatAudCents(firstNightCents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{extraNights} extra {extraNights === 1 ? "night" : "nights"} · {Math.round((1 - hirePricing.additionalNightRate) * 100)}% off</dt>
              <dd className="shrink-0">{formatAudCents(totalCents - firstNightCents)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
