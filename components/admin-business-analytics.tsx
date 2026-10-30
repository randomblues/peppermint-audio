"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, Download, Info, Repeat2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAudCents } from "@/lib/payment-flow";
import { melbourneDate, type AnalyticsBooking } from "@/lib/booking-analytics";
import {
  performanceChange, performanceCsv, performancePeriod, periodError, rentalPerformance,
  type Contribution, type RentalPerformance, type ReportPeriod, type ReportPreset,
} from "@/lib/rental-performance";

const money = (value: number | null) => value === null ? "Not priced" : formatAudCents(value);
const shortDate = (value: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));

export function AdminBusinessAnalytics({
  bookings, loading, error, onRetry,
}: {
  bookings: AnalyticsBooking[]; loading: boolean; error: string; onRetry: () => void;
}) {
  const [preset, setPreset] = useState<ReportPreset>("12-months");
  const [period, setPeriod] = useState<ReportPeriod>(() => performancePeriod("12-months"));
  const today = melbourneDate();
  const validation = periodError(period, today);
  const result = useMemo(() => {
    if (validation || loading || error) return { report: null, error: "" };
    try {
      return { report: rentalPerformance(bookings, period, today), error: "" };
    } catch (cause) {
      console.error("Business performance calculation failed:", cause);
      return { report: null, error: "We couldn't calculate this report from the saved booking data. Refresh and try again." };
    }
  }, [bookings, period, today, validation, loading, error]);
  const report = result.report;
  const reportError = error || result.error;
  function choosePeriod(next: ReportPreset) {
    setPreset(next);
    if (next !== "custom") setPeriod(performancePeriod(next, today));
  }
  function exportReport() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF", performanceCsv(report)], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `business-performance-${period.from}-to-${period.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="analytics" aria-labelledby="performance-title" className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary"><BarChart3 className="size-4" />The business, at a glance</p>
          <h1 id="performance-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Business performance</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Are we growing? What drives sales? When do customers hire? A clearer view of your rental business.</p>
        </div>
        <Button variant="outline" disabled={!report} onClick={exportReport}><Download className="size-4" />Export report</Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card/60 p-4">
        <div className="min-w-0">
          <label htmlFor="performance-period" className="mb-1.5 block text-xs font-medium text-muted-foreground">Reporting period</label>
          <select id="performance-period" value={preset} onChange={(event) => choosePeriod(event.target.value as ReportPreset)} className="h-10 max-w-full rounded-lg border bg-background px-3 text-sm">
            <option value="30-days">Last 30 days</option><option value="90-days">Last 90 days</option><option value="12-months">Last 12 months</option><option value="year">Year to date</option><option value="financial-year">Financial year to date</option><option value="custom">Custom period</option>
          </select>
        </div>
        {preset === "custom" ? <div className="grid w-full min-w-0 gap-3 sm:w-auto sm:grid-cols-2">
          <label className="min-w-0 text-xs font-medium text-muted-foreground">From<input aria-label="Performance from date" type="date" max={today} value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} className="mt-1.5 h-10 min-w-0 w-full rounded-lg border bg-background px-3 text-sm text-foreground" /></label>
          <label className="min-w-0 text-xs font-medium text-muted-foreground">To<input aria-label="Performance to date" type="date" max={today} value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} className="mt-1.5 h-10 min-w-0 w-full rounded-lg border bg-background px-3 text-sm text-foreground" /></label>
        </div> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4 shrink-0" />{shortDate(period.from)} - {shortDate(period.to)}</p>}
      </div>
      {validation ? <p role="alert" className="rounded-xl border border-destructive/20 p-4 text-sm text-destructive">{validation}</p>
        : reportError ? <Card><CardContent className="space-y-3 p-8 text-center"><h2 className="font-semibold">Performance report unavailable</h2><p role="alert" className="text-sm text-destructive">{reportError}</p><Button variant="outline" onClick={onRetry}>Try again</Button></CardContent></Card>
          : loading ? <p role="status" className="rounded-xl border p-8 text-center text-muted-foreground">Preparing your performance report...</p>
            : report ? <PerformanceReport report={report} /> : null}
    </section>
  );
}

function PerformanceReport({ report }: { report: RentalPerformance }) {
  const pricingIncomplete = report.current.unpriced > 0 || report.prior.unpriced > 0;
  return <>
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h2 className="text-lg font-semibold">How did we perform?</h2><p className="text-xs text-muted-foreground">Compared with {shortDate(report.previous.from)} - {shortDate(report.previous.to)}</p></div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Score label="Completed hire sales" value={money(report.current.sales)} icon={<TrendingUp className="size-4" />} current={report.current.sales} previous={report.prior.sales} comparisonNote={pricingIncomplete ? "Pricing incomplete" : undefined} detail="Hire charges from completed rentals" />
        <Score label="Completed hires" value={String(report.current.hires)} icon={<CheckCircle2 className="size-4" />} current={report.current.hires} previous={report.prior.hires} detail="Measured by booked return date" />
        <Score label="Average hire value" value={report.current.average === null ? "No priced hires" : money(report.current.average)} icon={<BarChart3 className="size-4" />} current={report.current.average} previous={report.prior.average} comparisonNote={pricingIncomplete ? "Pricing incomplete" : undefined} detail={`${report.current.priced} priced completed hires`} />
        <Score label="Repeat-customer hires" value={report.repeatShare === null ? "No customer history" : `${report.repeatShare}%`} icon={<Repeat2 className="size-4" />} detail={`${report.repeat} of ${report.identifiable} hires with a contact email`} />
      </div>
    </div>
    {!report.current.hires ? <p className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><span>No completed hires in this period yet. Request activity is still shown below; submitted and confirmed bookings are not counted as completed sales.</span></p> : null}
    {report.current.unpriced ? <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">{report.current.unpriced} completed {report.current.unpriced === 1 ? "hire has" : "hires have"} no recorded price. Sales and average values cover priced hires only; growth comparisons are withheld until pricing is complete.</p> : null}
    <PerformanceTrend report={report} />
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ProductContribution products={report.products} />
      <Card><CardContent className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Which occasions drive sales?</h2>
        <p className="mt-1 text-xs text-muted-foreground">Event mix of hires completed in this period</p>
        <div className="mt-5 space-y-4">{report.occasions.length ? report.occasions.slice(0, 6).map((event) => <div key={event.name}><div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words">{event.name}<span className="mt-1 block text-xs text-muted-foreground">{event.hires} {event.hires === 1 ? "hire" : "hires"}{event.priced < event.hires ? ` · ${event.hires - event.priced} unpriced` : ""}</span></span><strong className="shrink-0 tabular-nums">{money(event.priced ? event.value : null)}</strong></div><div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${report.current.sales ? event.value / report.current.sales * 100 : 0}%` }} /></div></div>) : <EmptyChart text="Your event mix will appear when hires are completed." />}</div>
        {report.occasions.length > 6 ? <p className="mt-4 text-xs text-muted-foreground">Top 6 of {report.occasions.length} event types.</p> : null}
      </CardContent></Card>
    </div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Card><CardContent className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Is demand turning into business?</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Current outcomes of requests received in this period, not the completed-hire cohort above.</p>
        <div className="my-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-3xl font-semibold tabular-nums">{report.requests}</p><p className="mt-1 text-xs text-muted-foreground">Requests received</p></div><Change current={report.requests} previous={report.priorRequests} /></div>
        <div className="space-y-4">{report.outcomes.map((outcome, index) => <div key={outcome.name}><div className="mb-2 flex justify-between gap-3 text-sm"><span>{outcome.name}</span><strong className="tabular-nums">{outcome.count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${index === 0 ? "bg-primary" : index === 1 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${report.requests ? outcome.count / report.requests * 100 : 0}%` }} /></div></div>)}</div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{report.acceptedShare === null ? "No requests were received in this period." : `${report.acceptedShare}% are currently confirmed or completed. Pending decisions can still change this share; this is not a recorded historical conversion funnel.`}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Plan around customer habits</h2>
        <p className="mt-1 text-xs text-muted-foreground">Pickup patterns for hires completed in this period</p>
        <div aria-label="Completed hire pickups by weekday" className="mt-6 grid h-32 grid-cols-7 items-end gap-2">{report.weekdays.map((day) => <div key={day.name} className="flex h-full flex-col items-center justify-end gap-2"><span className="text-xs tabular-nums">{day.count}</span><div className="w-full max-w-8 rounded-t bg-primary/60" style={{ height: `${day.count / Math.max(1, ...report.weekdays.map((entry) => entry.count)) * 65}%`, minHeight: 2 }} /><span className="text-[10px] text-muted-foreground sm:text-xs">{day.name}</span></div>)}</div>
        <dl className="mt-6 divide-y text-sm">{[
          ["Typical hire length", report.typicalNights === null ? "No data" : `${report.typicalNights} nights (median)`],
          ["Typical booking notice", report.typicalNotice === null ? "No data" : `${report.typicalNotice} days (median)`],
          ["Friday to Sunday pickups", report.weekendShare === null ? "No data" : `${report.weekendShare}%`],
          ["Unpaid completed hire charges", money(report.current.unpaid)],
        ].map(([label, value]) => <div className="flex flex-wrap items-start justify-between gap-2 py-3" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-muted-foreground">Booking notice uses {report.noticeSample} hires with valid request and pickup dates. Unpaid charges reflect current hire-payment status, not net cash flow.</p>
      </CardContent></Card>
    </div>
    <details className="rounded-xl border bg-card/50 p-4 text-sm">
      <summary className="cursor-pointer font-medium">Definitions & data coverage</summary>
      <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
        <p>All amounts are AUD. Completed hire sales use saved hire charges, including GST where applicable, for bookings marked completed. Refundable deposits and cancelled hires are excluded. This is not a profit, cash-flow or tax report.</p>
        <p>Completed hires are grouped by their booked return date, or pickup date when no return date exists. Requests are grouped by the date received in Melbourne time. Comparisons use the immediately preceding period with the same number of days. Edge months may be partial; zero-activity months are included.</p>
        <p>Repeat-customer hires match contact emails against earlier completed hires in retained records. It is not a unique-person count. Deleted history and missing emails reduce coverage. Product sales are allocated proportionally across saved line-item prices so they reconcile to recorded hire totals.</p>
        <p>Pricing coverage: {report.current.priced} of {report.current.hires} completed hires. Across retained records, {report.missingCompletionDates} completed hires have no usable completion date and {report.missingRequestDates} requests have no usable received date; these records cannot be included in the corresponding dated analysis.</p>
        <p>Profit, advertising ROI and fleet utilisation are not shown: costs, reliable campaign spend and inventory capacity are not captured by these booking records.</p>
      </div>
    </details>
  </>;
}

function Score({ label, value, detail, icon, current, previous, comparisonNote }: { label: string; value: string; detail: string; icon: ReactNode; current?: number | null; previous?: number | null; comparisonNote?: string }) {
  return <Card><CardContent className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-xs font-medium leading-relaxed text-muted-foreground">{label}</h3><span className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</span></div><p className="mt-4 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p><div className="mt-3 min-h-5">{comparisonNote ? <span className="text-xs text-amber-600 dark:text-amber-300">{comparisonNote}</span> : current !== undefined && previous !== undefined ? <Change current={current} previous={previous} /> : <span className="text-xs text-muted-foreground">Based on retained hire history</span>}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p></CardContent></Card>;
}

function Change({ current, previous }: { current: number | null; previous: number | null }) {
  const change = performanceChange(current, previous);
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${change.direction === "up" ? "text-primary" : change.direction === "down" ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"}`}>{change.direction === "up" ? <ArrowUpRight className="size-3.5" /> : change.direction === "down" ? <ArrowDownRight className="size-3.5" /> : null}{change.text}<span className="font-normal text-muted-foreground">vs previous period</span></span>;
}

function PerformanceTrend({ report }: { report: RentalPerformance }) {
  const [metric, setMetric] = useState<"sales" | "hires" | "requests">("sales");
  const [showTable, setShowTable] = useState(false);
  const maximumValue = Math.max(0, ...report.trend.map((entry) => entry[metric]));
  const maximum = Math.max(1, maximumValue);
  const chartWidth = 1000;
  const width = chartWidth / report.trend.length;
  const tickIndexes = new Set([0, ...report.trend.map((_, index) => index).filter((index) => index % Math.ceil(report.trend.length / 3) === 0), report.trend.length - 1]);
  return <Card><CardContent className="p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold">Are we growing?</h2><p className="mt-1 text-xs text-muted-foreground">{report.trendUnit} activity within the selected period</p></div>
      <div role="group" aria-label="Performance trend metric" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
        {(["sales", "hires", "requests"] as const).map((value) => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)} className={`rounded-md px-3 py-2 text-xs font-medium ${metric === value ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}>{value === "sales" ? "Hire sales" : value === "hires" ? "Completed hires" : "Requests"}</button>)}
      </div>
    </div>
    <div className="mt-6 flex justify-between gap-3 text-xs text-muted-foreground"><span>{metric === "sales" ? "AUD · completed hire charges" : metric === "hires" ? "Completed hires · return date" : "Requests · date received"}</span><span className="shrink-0">{metric === "sales" ? money(maximumValue) : maximumValue} max</span></div>
    <svg role="img" aria-label={`${metric === "sales" ? "Completed hire sales" : metric === "hires" ? "Completed hires" : "Requests received"} trend; exact values available in the data table below`} viewBox="0 0 1000 220" preserveAspectRatio="none" className="mt-3 h-52 w-full overflow-visible">
      {[0, 1, 2, 3].map((line) => <line key={line} x1={0} x2={1000} y1={line * 65 + 10} y2={line * 65 + 10} stroke="currentColor" className="text-border" strokeDasharray="4 5" />)}
      {report.trend.map((entry, index) => <rect key={entry.key} x={index * width + width * 0.18} y={205 - entry[metric] / maximum * 185} width={width * 0.64} height={Math.max(1, entry[metric] / maximum * 185)} rx={Math.min(5, width * 0.1)} className={metric === "requests" ? "fill-blue-400/80" : "fill-primary/75"}><title>{entry.label}: {metric === "sales" ? money(entry.sales) : entry[metric]}{entry.unpriced ? `; ${entry.unpriced} unpriced hires excluded from sales` : ""}</title></rect>)}
    </svg>
    <div className="mt-2 flex justify-between gap-2 text-[10px] text-muted-foreground sm:text-xs">{report.trend.filter((_, index) => tickIndexes.has(index)).map((entry) => <span key={entry.key}>{entry.label}</span>)}</div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Empty periods are included. Hover bars or open the table for exact values.</p><Button size="sm" variant="ghost" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>{showTable ? "Hide trend data" : "View trend data"}</Button></div>
    {showTable ? <div className="mt-3 overflow-x-auto rounded-lg border" role="region" aria-label="Trend data table; scroll horizontally on small screens" tabIndex={0}><table className="w-full min-w-[400px] text-left text-xs"><caption className="sr-only">Hire sales exclude deposits and cancelled hires; rows use booked return date for completed hires and received date for requests.</caption><thead className="bg-muted/50"><tr>{["Period", "Hire sales", "Completed hires", "Requests"].map((label) => <th className="px-3 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{report.trend.map((entry) => <tr key={entry.key}><th scope="row" className="px-3 py-3 font-medium">{entry.label}</th><td className="px-3 py-3">{money(entry.sales)}{entry.unpriced ? " (partial)" : ""}</td><td className="px-3 py-3">{entry.hires}</td><td className="px-3 py-3">{entry.requests}</td></tr>)}</tbody></table></div> : null}
  </CardContent></Card>;
}

function ProductContribution({ products }: { products: Contribution[] }) {
  const [category, setCategory] = useState<Contribution["category"]>("package");
  const selected = products.filter((entry) => entry.category === category);
  const total = selected.reduce((sum, entry) => sum + entry.value, 0);
  return <Card><CardContent className="p-4 sm:p-5">
    <h2 className="text-lg font-semibold">What earns its place in the catalogue?</h2>
    <p className="mt-1 text-xs text-muted-foreground">Allocated hire sales from completed rentals</p>
    <div role="group" aria-label="Catalogue contribution" className="mt-4 flex flex-wrap gap-2">
      {(["package", "equipment", "other"] as const).map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${category === value ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground"}`}>{value === "package" ? "Packages" : value === "equipment" ? "Equipment" : "Other charges"}</button>)}
    </div>
    <div className="mt-5 space-y-4">{selected.length ? selected.slice(0, 5).map((item, index) => <div key={`${item.name}-${index}`} className="flex items-start gap-3"><span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2 text-sm"><span className="min-w-0 break-words font-medium">{item.name}</span><strong className="tabular-nums">{money(item.value)}</strong></div><p className="mt-1 text-xs text-muted-foreground">{item.hires} {item.hires === 1 ? "hire" : "hires"}{item.quantity ? ` · quantity ${item.quantity}` : ""}{total ? ` · ${Math.round(item.value / total * 100)}% of category sales` : ""}</p><div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${total ? item.value / total * 100 : 0}%` }} /></div></div></div>) : <EmptyChart text="No completed hires with priced items in this category." />}</div>
    {selected.length > 5 ? <p className="mt-4 text-xs text-muted-foreground">Top 5 of {selected.length} items.</p> : null}
    <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Allocation uses the saved item mix and hire duration. Package revenue is not split into its included equipment; quantities are catalogue units, including pairs where sold as a pair.</p>
  </CardContent></Card>;
}

function EmptyChart({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</p>;
}
