"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, Filter, Mail, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { bookingStatuses, type BookingStatus } from "@/lib/admin-dashboard";
import {
  analyseBookings, bookingDate, bookingHireValue, bookingsCsv,
  datePresetRange, defaultAnalyticsFilters, melbourneDate,
  type AnalyticsBooking, type AnalyticsFilters, type BookingSort, type DateBasis, type DatePreset, type PaymentFilter,
} from "@/lib/booking-analytics";
import { formatAudCents } from "@/lib/payment-flow";

const statusNames: Record<BookingStatus, string> = { submitted: "Submitted", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };
const statusStyles: Record<string, string> = {
  submitted: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  confirmed: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-300",
};
const fieldClass = "h-10 min-w-0 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
const labelClass = "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground";
const pageSize = 20;

function prettyDate(date: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function submittedDate(booking: AnalyticsBooking) {
  const date = bookingDate(booking, "created_at");
  if (!date) return "Not recorded";
  const today = melbourneDate();
  if (date === today) return "Today";
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return prettyDate(date);
}

export function AdminBookingsWorkspace<T extends AnalyticsBooking>({
  bookings, loading, error, onRetry, onSelect,
}: {
  bookings: T[]; loading: boolean; error: string;
  onRetry: () => void; onSelect: (booking: T) => void;
}) {
  const defaultFilters: AnalyticsFilters = {
    ...defaultAnalyticsFilters, statuses: ["submitted", "confirmed"],
  };
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [preset, setPreset] = useState<DatePreset | "custom">("all");
  const [page, setPage] = useState(1);
  const availableStatuses = bookingStatuses;
  const filtered = useMemo(() => analyseBookings(bookings, filters), [bookings, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const sortField = filters.sort.startsWith("submitted") ? "submitted" : "pickup";
  const sortAscending = filters.sort.endsWith("-asc");
  const sortDescription = sortField === "submitted"
    ? sortAscending ? "Oldest submissions first" : "Newest submissions first"
    : sortAscending ? "Earliest hire dates first" : "Latest hire dates first";

  function changeFilters(values: Partial<AnalyticsFilters>) {
    setFilters((current) => ({ ...current, ...values }));
    setPage(1);
  }
  function reset() {
    changeFilters(defaultFilters);
    setPreset("all");
  }
  function toggleStatus(status: BookingStatus) {
    changeFilters({ statuses: filters.statuses.includes(status) ? filters.statuses.filter((value) => value !== status) : [...filters.statuses, status] });
  }
  function setSort(field: "submitted" | "pickup", ascending: boolean) {
    const sort: BookingSort = `${field}-${ascending ? "asc" : "desc"}`;
    changeFilters({ sort });
  }
  function exportCsv() {
    const csv = bookingsCsv(filtered);
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bookings-${melbourneDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="bookings" className="min-w-0 space-y-6" aria-labelledby="bookings-workspace-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary"><CalendarDays className="size-4" />Your working day</p>
          <h1 id="bookings-workspace-title" className="mt-2 text-3xl font-semibold tracking-tight">Bookings</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Manage your bookings. Submitted and confirmed bookings are selected by default.</p>
        </div>
        <Button variant="outline" disabled={loading || Boolean(error) || !filtered.length || invalidRange} onClick={exportCsv}><Download className="size-4" />Export filtered CSV</Button>
      </header>

      <Card>
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Filter className="size-4 text-primary" />Explore your bookings</h2>
            <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="size-3.5" />Reset filters</Button>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className={`${labelClass} sm:col-span-2`}>
              Search
              <span className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4" /><input aria-label="Search bookings" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value })} placeholder="Name, email, event or booking reference" className={`${fieldClass} pl-9`} /></span>
            </label>
              <label className={labelClass}>Date basis<select aria-label="Date basis" value={filters.dateBasis} onChange={(event) => changeFilters({ dateBasis: event.target.value as DateBasis })} className={fieldClass}><option value="pickup_date">Pickup date</option><option value="created_at">Request received date</option></select></label>
              <label className={labelClass}>Hire payment<select aria-label="Hire payment filter" value={filters.payment} onChange={(event) => changeFilters({ payment: event.target.value as PaymentFilter })} className={fieldClass}><option value="all">All payment states</option><option value="paid">Hire paid</option><option value="unpaid">Hire not paid</option></select></label>
            <label className={labelClass}>Date range<select aria-label="Date range preset" value={preset} onChange={(event) => {
              const next = event.target.value as DatePreset | "custom";
              setPreset(next);
              if (next !== "custom") changeFilters(datePresetRange(next));
            }} className={fieldClass}><option value="all">All time</option><option value="month">This month</option><option value="last-month">Last month</option><option value="year">This calendar year</option><option value="financial-year">This financial year</option><option value="custom">Custom range</option></select></label>
            <label className={labelClass}>From<input aria-label="Bookings from date" type="date" value={filters.from} onChange={(event) => { setPreset("custom"); changeFilters({ from: event.target.value }); }} aria-invalid={invalidRange} className={fieldClass} /></label>
            <label className={labelClass}>To<input aria-label="Bookings to date" type="date" value={filters.to} onChange={(event) => { setPreset("custom"); changeFilters({ to: event.target.value }); }} aria-invalid={invalidRange} className={fieldClass} /></label>
          </div>
          <fieldset className="border-t pt-4">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Booking statuses</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {availableStatuses.map((status) => <label key={status} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${filters.statuses.includes(status) ? "border-primary/40 bg-primary/5" : "bg-background text-muted-foreground"}`}><input className="size-4 accent-primary" type="checkbox" checked={filters.statuses.includes(status)} onChange={() => toggleStatus(status)} /><span>{statusNames[status]}</span></label>)}
              <Button variant="ghost" size="sm" onClick={() => changeFilters({ statuses: availableStatuses })}>Select all</Button>
              <Button variant="ghost" size="sm" onClick={() => changeFilters({ statuses: [] })}>Clear statuses</Button>
            </div>
          </fieldset>
          {invalidRange ? <p role="alert" className="text-sm text-destructive">Choose an end date on or after the start date.</p> : null}
        </CardContent>
      </Card>

      {error ? <Card><CardContent className="space-y-3 p-8 text-center"><h2 className="font-semibold">We couldn&apos;t load bookings</h2><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={onRetry}>Try again</Button></CardContent></Card>
        : loading ? <p role="status" className="rounded-xl border p-8 text-center text-muted-foreground">Loading bookings…</p>
          : !invalidRange ? <>
            <p aria-live="polite" className="text-sm text-muted-foreground"><strong className="text-foreground">{filtered.length}</strong> of {bookings.length} bookings</p>
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold">Booking list</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}` : "No results"}</p>
                  </div>
                  <div role="group" aria-label="Booking sort" className="ml-auto flex max-w-full items-center gap-2">
                    <label htmlFor="booking-sort-field" className="hidden text-xs text-muted-foreground sm:inline">Sort by</label>
                    <select id="booking-sort-field" aria-label="Sort bookings by" aria-describedby="booking-sort-description" value={sortField} onChange={(event) => setSort(event.target.value === "submitted" ? "submitted" : "pickup", sortAscending)} className="h-10 min-w-0 w-32 rounded-lg border bg-background px-3 text-sm">
                      <option value="submitted">Submitted</option>
                      <option value="pickup">Hire Dates</option>
                    </select>
                    <Button type="button" variant="outline" size="icon" className="size-10" aria-label={sortAscending ? "Sort descending" : "Sort ascending"} aria-describedby="booking-sort-description" title={`${sortDescription}. Click to reverse.`} onClick={() => setSort(sortField, !sortAscending)}>
                      {sortAscending ? <ArrowUp className="size-4" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" />}
                    </Button>
                    <span id="booking-sort-description" className="sr-only" aria-live="polite">{sortDescription}</span>
                  </div>
                </div>
                {shown.length ? <div className="divide-y">{shown.map((booking) => <button key={booking.id} onClick={() => onSelect(booking)} className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
                  <span className="min-w-0">
                    <span className="block break-words font-medium">{booking.first_name} {booking.last_name}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 break-all text-xs text-muted-foreground"><Mail aria-hidden="true" className="size-3.5 shrink-0 text-primary/70" />{booking.email || "No email"}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/15 bg-primary/[0.04] px-2 py-1 text-xs leading-tight text-muted-foreground">
                        <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-primary/80" />
                        <span className="break-words">Hire Dates: {prettyDate(booking.pickup_date)}{booking.dropoff_date ? ` – ${prettyDate(booking.dropoff_date)}` : ""}</span>
                      </span>
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.025] px-2 py-1 text-xs leading-tight text-muted-foreground">
                        <Clock3 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/80" />
                        <span className="break-words">Submitted On: {submittedDate(booking)}</span>
                      </span>
                    </span>
                  </span>
                  <span className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1"><span className="block break-words text-sm text-muted-foreground">{booking.event_type}</span><span className="mt-1 block text-sm font-medium">{bookingHireValue(booking) === null ? "Not priced" : formatAudCents(bookingHireValue(booking)!)} <span className="text-xs font-normal text-muted-foreground">hire</span></span></span>
                  <span className="col-start-2 row-start-1 flex items-center gap-2 sm:col-start-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[booking.status] ?? "bg-muted"}`}>{booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span><ChevronRight className="size-4 text-muted-foreground" /></span>
                </button>)}</div> : <div className="p-8 text-center"><Search className="mx-auto mb-3 size-6 text-muted-foreground" /><p className="font-medium">No bookings match these filters</p><p className="mt-2 text-sm text-muted-foreground">{filters.statuses.length ? "Try a wider date range or a different search." : "Select at least one booking status to see results."}</p><Button className="mt-4" variant="outline" onClick={reset}>Reset filters</Button></div>}
                {pages > 1 ? <nav aria-label="Booking pages" className="flex flex-wrap items-center justify-between gap-3 border-t p-4"><span className="text-xs text-muted-foreground">Page {currentPage} of {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" aria-label="Previous bookings page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" />Previous</Button><Button size="sm" variant="outline" aria-label="Next bookings page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight className="size-4" /></Button></div></nav> : null}
              </CardContent>
            </Card>
          </> : null}
    </section>
  );
}
