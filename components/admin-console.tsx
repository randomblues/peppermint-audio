"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Archive, CalendarDays, CheckCircle2, ChevronRight, Clock3, Download, FileSpreadsheet,
  ExternalLink, FileText, LayoutDashboard, LogOut, Mail, Menu, RefreshCw,
  Search, ShieldCheck, UserRound, X, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { bookingStatuses, filterBookings, isUpcoming, statusCounts } from "@/lib/admin-dashboard";
import { buildBookingConfirmationEmail } from "@/lib/booking-confirmation-email";
import { buildPickupReminderEmail } from "@/lib/pickup-reminders";
import { calculateMedicareLevy, calculateResidentIncomeTax, type IncomeTaxYear } from "@/lib/income-tax";
import type { BankTransferOption } from "@/lib/bank-transfer";
import { AdminPaymentPanel } from "@/components/admin-payment-panel";

type Booking = Record<string, unknown> & {
  id: string; first_name: string; last_name: string; event_type: string;
  pickup_date: string; dropoff_date?: string; pickup_time?: string | null; dropoff_time?: string | null; status: string;
  email?: string; package_interest?: string; additional_details?: string | null;
  internal_notes?: string; photo_id_paths?: string[]; add_ons?: string[];
  mobile?: string; event_address?: string; guest_count?: number | null; gst_inclusive?: boolean | null;
  hire_amount_cents?: number | null; security_deposit_cents?: number | null; payment_method?: string | null;
  hire_payment_status?: string | null; deposit_payment_status?: string | null; payment_token?: string | null;
  deposit_captured_cents?: number | null;
  bank_transfer_option?: BankTransferOption | null;
  email_logs?: Array<{ id: string; recipient_email: string; email_type: string; provider_message_id?: string | null; sent_at: string }>;
};
const statuses = bookingStatuses;
const statusLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const display = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const formatDate = (value: unknown) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${String(value)}T00:00:00`));
};
const formatTime = (value: unknown) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date(`1970-01-01T${String(value)}`));
};
const emailTypeLabel = (value: string) => ({
  booking_request: "Booking request",
  confirmation: "Booking confirmation",
  pickup_reminder: "Pickup reminder",
  custom: "Email",
  invoice: "Invoice email",
  payment_receipt: "Payment receipt",
  deposit_authorisation: "Deposit authorisation",
  deposit_release: "Deposit release",
  deposit_capture: "Deposit charge receipt",
  enquiry: "Enquiry",
}[value] ?? value);
const formatSentAt = (value: string) => new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));
const statusClass = (value: string) => ({
  submitted: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
}[value] ?? "border-border bg-muted text-muted-foreground");
const emailTemplates = [
  { value: "blank", label: "Blank email" },
  { value: "booking-confirmation", label: "Booking confirmation" },
  { value: "pickup-reminder", label: "Pickup reminder" },
  { value: "invoice", label: "Invoice email" },
  { value: "payment-reminder", label: "Payment reminder" },
  { value: "pickup-details", label: "Pickup details" },
] as const;
function emailTemplateContent(value: string, booking: Booking) {
  if (value === "booking-confirmation") {
    const email = buildBookingConfirmationEmail({
      firstName: booking.first_name,
      eventType: booking.event_type,
      pickupDate: booking.pickup_date,
      dropoffDate: booking.dropoff_date ?? booking.pickup_date,
      pickupTime: booking.pickup_time,
      dropoffTime: booking.dropoff_time,
      packageInterest: booking.package_interest ?? "Your selected package",
      addOns: booking.add_ons ?? [],
      pickupInstructions: {
        package_interest: booking.package_interest ?? "",
        add_ons: booking.add_ons ?? [],
        additional_details: booking.additional_details ?? null,
      },
    });
    return { subject: email.subject, message: email.text };
  }
  if (value === "pickup-reminder") {
    const email = buildPickupReminderEmail({
      email: booking.email ?? "",
      first_name: booking.first_name,
      last_name: booking.last_name,
      event_type: booking.event_type,
      pickup_date: booking.pickup_date,
      pickup_time: booking.pickup_time,
      package_interest: booking.package_interest ?? "",
      add_ons: booking.add_ons ?? [],
      additional_details: booking.additional_details ?? null,
    });
    return { subject: email.subject, message: email.text };
  }
  const templates: Record<string, { subject: string; message: string }> = {
    blank: { subject: "", message: "" },
    invoice: {
      subject: "Your Peppermint Audio invoice",
      message: "Hi,\n\nPlease find your invoice attached for your Peppermint Audio booking.\n\nIf you have any questions, please get in touch.",
    },
    "payment-reminder": {
      subject: "Payment reminder for your Peppermint Audio booking",
      message: "Hi,\n\nJust a quick reminder about payment for your Peppermint Audio booking.\n\nPlease get in touch if you have any questions.",
    },
    "pickup-details": {
      subject: "Pickup details for your Peppermint Audio booking",
      message: "Hi,\n\nHere are the pickup details for your Peppermint Audio booking.\n\nPlease get in touch if you have any questions.",
    },
  };
  return templates[value] ?? templates.blank;
}
async function responseError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}
type SummaryCard = { key: string; label: string; icon: ComponentType<{ className?: string }>; color: string; count: number };
type AdminSection = "bookings" | "email-history" | "tax-report" | "archive";

export function AdminConsole() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [emailHistorySearch, setEmailHistorySearch] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [section, setSection] = useState<AdminSection>("bookings");
  const [selectedEmailHistory, setSelectedEmailHistory] = useState<Booking | null>(null);

  const showMessage = useCallback((nextMessage: string, type: "success" | "error") => {
    setMessage(nextMessage);
    setMessageType(type);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}) });
      const response = await fetch(`/api/admin/bookings?${query}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load bookings.");
      setBookings(data.bookings ?? []); setLastUpdated(new Date());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load bookings."); }
    finally { setLoading(false); }
  }, [search, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const syncSection = () => {
      const hash = window.location.hash;
      setSection(hash === "#archive" ? "archive" : hash === "#tax-report" ? "tax-report" : hash === "#email-history" ? "email-history" : "bookings");
      setMessage("");
    };
    syncSection();
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);
  useEffect(() => {
    if (!message || messageType !== "success") return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message, messageType]);

  const visibleBookings = useMemo(() => filterBookings(bookings, { status, from: dateFrom, to: dateTo }), [bookings, status, dateFrom, dateTo]);
  const counts = useMemo(() => statusCounts(bookings), [bookings]);
  const upcomingCount = useMemo(() => bookings.filter((booking) => isUpcoming(booking)).length, [bookings]);
  const filteredEmailHistoryBookings = useMemo(() => {
    const query = emailHistorySearch.trim().toLowerCase();
    if (!query) return bookings;
    return bookings.filter((booking) => [
      booking.first_name,
      booking.last_name,
      booking.email,
      booking.event_type,
      ...(booking.email_logs ?? []).flatMap((log) => [log.recipient_email, emailTypeLabel(log.email_type)]),
    ].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [bookings, emailHistorySearch]);

  async function update(id: string, values: { status?: string; internal_notes?: string }) {
    try {
      const response = await fetch("/api/admin/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...values }) });
      if (!response.ok) { showMessage(await responseError(response, "Update failed."), "error"); return; }
      setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, ...values } : booking));
      setSelected((current) => current?.id === id ? { ...current, ...values } : current);
      showMessage("Booking updated.", "success");
    } catch { showMessage("Update failed. Check your connection and try again.", "error"); }
  }
  async function signedLink(path: string) {
    try {
      const response = await fetch(`/api/admin/photo-link?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      if (response.ok && data.url) window.open(data.url, "_blank", "noopener,noreferrer");
      else showMessage(data.error ?? "Photo ID unavailable.", "error");
    } catch { showMessage("Photo ID unavailable. Check your connection and try again.", "error"); }
  }
  async function exportArchive() {
    if (!range.from || !range.to || !window.confirm("This archive includes booking data and private photo IDs. Continue?")) return;
    const response = await fetch("/api/admin/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...range, confirm: true }) });
    if (!response.ok) { showMessage(await responseError(response, "Export failed."), "error"); return; }
    const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `booking-archive-${range.from}-to-${range.to}.zip`; link.click(); URL.revokeObjectURL(link.href); showMessage("Archive downloaded.", "success");
  }
  async function deleteBooking(id: string) {
    if (!window.confirm("Permanently delete this booking and its private photo IDs?")) return;
    const response = await fetch("/api/admin/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, confirm: true }) });
    if (!response.ok) { showMessage(await responseError(response, "Delete failed."), "error"); return; }
    setBookings((current) => current.filter((booking) => booking.id !== id)); setSelected(null); showMessage("Booking deleted.", "success");
  }
  async function sendEmail(id: string, subject: string, message: string, attachment: File | null) {
    try {
      const body = new FormData();
      body.append("bookingId", id);
      body.append("subject", subject);
      body.append("message", message);
      if (attachment) body.append("attachment", attachment);
      const response = await fetch("/api/admin/send-custom-email", { method: "POST", body });
      if (!response.ok) { showMessage(await responseError(response, "Email failed."), "error"); return false; }
      showMessage("Email sent.", "success");
      return true;
    } catch { showMessage("Email failed. Check your connection and try again.", "error"); return false; }
  }
  function paymentUpdated(id: string, values: Partial<Booking>) {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, ...values } : booking));
    setSelected((current) => current?.id === id ? { ...current, ...values } : current);
  }
  async function signOut() { await fetch("/api/admin/logout", { method: "POST" }); window.location.href = "/admin/login"; }
  function navigateSection(nextSection: AdminSection, event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setSection(nextSection);
    setMobileNav(false);
    setSelectedEmailHistory(null);
    setMessage("");
    window.history.replaceState(null, "", `#${nextSection}`);
  }
  const sectionHeading = section === "archive" ? "Archive export" : section === "tax-report" ? "Tax" : section === "email-history" ? "Email history" : "Booking management";
  const sectionDescription = section === "archive" ? "Securely download booking records" : section === "tax-report" ? "Prepare tax figures and records" : section === "email-history" ? "Search customer email delivery records" : "Keep every event moving smoothly";

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r bg-card p-5 transition-transform md:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 border-b pb-6"><div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div><div><p className="font-semibold">Peppermint Audio</p><p className="text-xs text-muted-foreground">Operations console</p></div></div>
        <nav className="mt-6 space-y-1" aria-label="Admin sections"><a className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "bookings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`} href="#bookings" aria-current={section === "bookings" ? "page" : undefined} onClick={(event) => navigateSection("bookings", event)}><LayoutDashboard className="size-4" />Bookings</a><a className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "email-history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`} href="#email-history" aria-current={section === "email-history" ? "page" : undefined} onClick={(event) => navigateSection("email-history", event)}><Mail className="size-4" />Email history</a><a className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "tax-report" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`} href="#tax-report" aria-current={section === "tax-report" ? "page" : undefined} onClick={(event) => navigateSection("tax-report", event)}><FileSpreadsheet className="size-4" />Tax</a><a className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "archive" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`} href="#archive" aria-current={section === "archive" ? "page" : undefined} onClick={(event) => navigateSection("archive", event)}><Archive className="size-4" />Archive export</a></nav>
        <div className="absolute bottom-5 left-5 right-5 border-t pt-4"><Button variant="ghost" className="w-full justify-start gap-3" onClick={() => void signOut()}><LogOut className="size-4" />Sign out</Button></div>
      </aside>
      {mobileNav && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileNav(false)} />}
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8"><Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMobileNav(true)}><Menu /></Button><div className="hidden min-w-0 md:block"><p className="text-sm font-medium">{sectionHeading}</p><p className="text-xs text-muted-foreground">{sectionDescription}</p></div><div className="flex shrink-0 items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:inline">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}` : "Not updated yet"}</span><Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />Refresh</Button><Button variant="ghost" size="icon" className="md:hidden" onClick={() => void signOut()}><LogOut /></Button></div></div></header>
        <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-8">
          {message && <p role="status" className={`rounded-lg border px-4 py-2.5 text-sm ${messageType === "error" ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`}>{message}</p>}
          {section === "bookings" ? <><section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Good to see you</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Bookings overview</h1><p className="mt-1 text-sm text-muted-foreground">Review enquiries, confirm details, and prepare every event.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{lastUpdated ? `Last updated ${lastUpdated.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}` : "Loading latest data"}</div></section>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{([{ key: "upcoming", label: "Upcoming", icon: CalendarDays, color: "text-primary", count: upcomingCount }, { key: "submitted", label: "Submitted", icon: FileText, color: "text-amber-600", count: counts.submitted }, { key: "confirmed", label: "Confirmed", icon: CheckCircle2, color: "text-blue-600", count: counts.confirmed }, { key: "completed", label: "Completed", icon: CalendarDays, color: "text-emerald-600", count: counts.completed }, { key: "cancelled", label: "Cancelled", icon: XCircle, color: "text-red-600", count: counts.cancelled }] satisfies SummaryCard[]).map(({ key, label, icon: Icon, color, count }) => <Card key={key}><CardContent className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div><div className={`rounded-lg bg-muted p-2.5 ${color}`}><Icon className="size-5" /></div></CardContent></Card>)}</section>
          <section id="bookings" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">All bookings</h2><p className="text-sm text-muted-foreground">{visibleBookings.length} {visibleBookings.length === 1 ? "booking" : "bookings"} in view</p></div></div>
            <Card><CardContent className="grid gap-4 p-3 sm:grid-cols-[repeat(2,minmax(10rem,1fr))] lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(10rem,1fr))]"><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-1"><span>Search</span><span className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input aria-label="Search bookings" placeholder="Search name, email or event" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-background pl-9 pr-3 text-sm font-normal text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" /></span></label><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Status</span><select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground"><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Pickup from</span><input aria-label="Bookings from date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Pickup to</span><input aria-label="Bookings to date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label></CardContent></Card>
            {error ? <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><XCircle className="size-8 text-destructive" /><p className="font-medium">We couldn&apos;t load bookings</p><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></CardContent></Card> : loading ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground"><RefreshCw className="mx-auto mb-3 size-6 animate-spin" />Loading bookings…</CardContent></Card> : visibleBookings.length === 0 ? <Card><CardContent className="p-12 text-center"><CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">No bookings match these filters</p><p className="mt-1 text-sm text-muted-foreground">Try clearing a filter or check back after a new enquiry.</p></CardContent></Card> : <Card><div className="divide-y">{visibleBookings.map((booking) => <button key={booking.id} onClick={() => setSelected(booking)} className="flex w-full flex-wrap items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 sm:flex-nowrap"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{booking.first_name[0]}{booking.last_name[0]}</div><div className="min-w-0"><p className="truncate font-medium">{booking.first_name} {booking.last_name}</p><p className="truncate text-sm text-muted-foreground">{display(booking.email)}</p></div></div><div className="w-36"><p className="text-sm font-medium">{display(booking.event_type)}</p><p className="text-xs text-muted-foreground">{formatDate(booking.pickup_date)}</p></div><Badge className={statusClass(booking.status)}>{statusLabel(booking.status)}</Badge><ChevronRight className="ml-auto size-4 text-muted-foreground" /></button>)}</div></Card>}
          </section>
          </> : section === "email-history" ? <EmailHistoryPage bookings={filteredEmailHistoryBookings} search={emailHistorySearch} onSearch={setEmailHistorySearch} onSelect={setSelectedEmailHistory} /> : section === "tax-report" ? <TaxReportPage /> : <section id="archive" aria-labelledby="archive-title" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-primary">Data management</p><h1 id="archive-title" className="mt-1 text-3xl font-semibold tracking-tight">Archive export</h1><p className="mt-1 text-sm text-muted-foreground">Create a secure backup of booking records and private photo IDs.</p></div><a href="#bookings" onClick={(event) => navigateSection("bookings", event)} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">Back to bookings</a></div><div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-lg bg-amber-100 p-2 text-amber-700"><Archive className="size-5" /></div><div><h2 className="font-semibold text-amber-950">Export booking archive</h2><p className="mt-1 max-w-xl text-sm text-amber-900/70">Download a ZIP of booking records and private photo IDs for a specific pickup date range. Handle this file securely.</p></div></div><div className="flex flex-wrap gap-2"><input aria-label="Archive from date" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 rounded-lg border border-amber-200 bg-background px-3 text-sm" /><input aria-label="Archive to date" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 rounded-lg border border-amber-200 bg-background px-3 text-sm" /><Button variant="outline" className="gap-2 border-amber-300 bg-background" onClick={() => void exportArchive()}><Download className="size-4" />Export ZIP</Button></div></div></div></section>}
        </main>
      </div>
      {selected && <BookingDetail booking={selected} onClose={() => setSelected(null)} onUpdate={update} onPhoto={signedLink} onDelete={deleteBooking} onSendEmail={sendEmail} onPaymentUpdated={paymentUpdated} />}
      {selectedEmailHistory && <EmailHistoryDetail booking={selectedEmailHistory} onClose={() => setSelectedEmailHistory(null)} />}
    </div>
  );
}

function BookingDetail({ booking, onClose, onUpdate, onPhoto, onDelete, onSendEmail, onPaymentUpdated }: { booking: Booking; onClose: () => void; onUpdate: (id: string, values: { status?: string; internal_notes?: string }) => Promise<void>; onPhoto: (path: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onSendEmail: (id: string, subject: string, message: string, attachment: File | null) => Promise<boolean>; onPaymentUpdated: (id: string, values: Partial<Booking>) => void }) {
  const [notes, setNotes] = useState(booking.internal_notes ?? "");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [customFile, setCustomFile] = useState<File | null>(null);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="booking-detail-title" className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl">
      <div className="flex shrink-0 items-start justify-between border-b bg-background p-4 sm:p-5"><div className="min-w-0 pr-3"><p className="text-sm text-primary">Booking details</p><h2 id="booking-detail-title" className="mt-1 break-words text-xl font-semibold sm:text-2xl">{booking.first_name} {booking.last_name}</h2><p className="truncate text-sm text-muted-foreground">{display(booking.event_type)} · {formatDate(booking.pickup_date)}</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details"><X /></Button></div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><Badge className={statusClass(booking.status)}>{statusLabel(booking.status)}</Badge><label className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span>Status</span><select aria-label="Update booking status" value={booking.status} onChange={(e) => void onUpdate(booking.id, { status: e.target.value })} className="h-9 rounded-lg border bg-background px-3 text-sm font-normal text-foreground">{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label></div><div className="grid grid-cols-1 gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2"><Detail label="Customer" value={`${booking.first_name} ${booking.last_name}`} icon={<UserRound />} /><Detail label="Email" value={display(booking.email)} icon={<Mail />} /><Detail label="Mobile" value={display(booking.mobile)} /><Detail label="Event address" value={display(booking.event_address)} />      <Detail label="Pickup" value={`${formatDate(booking.pickup_date)} at ${formatTime(booking.pickup_time)}`} /><Detail label="Drop-off" value={`${formatDate(booking.dropoff_date)} at ${formatTime(booking.dropoff_time)}`} /><Detail label="Package" value={display(booking.package_interest)} /><Detail label="Guests" value={display(booking.guest_count)} /><Detail label="Add-ons" value={booking.add_ons?.length ? booking.add_ons.join(", ") : "None selected"} /></div><AdminPaymentPanel booking={booking} onChanged={(values) => onPaymentUpdated(booking.id, values)} /><div><h3 className="mb-2 text-sm font-semibold">Additional details</h3><p className="break-words rounded-lg bg-muted p-3 text-sm leading-relaxed">{display(booking.additional_details)}</p></div><div><h3 className="mb-2 text-sm font-semibold">Internal notes</h3><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 w-full resize-y rounded-lg border bg-background p-3 text-sm" placeholder="Add a private note for the team…" /><Button size="sm" className="mt-2" onClick={() => void onUpdate(booking.id, { internal_notes: notes })}>Save notes</Button></div><div className="flex justify-end"><Button size="sm" onClick={() => setEmailOpen(true)}>Send Email</Button></div>{booking.photo_id_paths?.length ? <div><h3 className="mb-2 text-sm font-semibold">Photo ID</h3><div className="flex flex-wrap gap-2">{booking.photo_id_paths.map((path) => <Button key={path} variant="outline" size="sm" onClick={() => void onPhoto(path)}>View private ID <ExternalLink /></Button>)}</div></div> : null}<Button variant="destructive" className="w-full" onClick={() => void onDelete(booking.id)}>Permanently delete booking</Button></div>
      {emailOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="send-email-title" className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border bg-background shadow-2xl sm:h-auto sm:max-h-[min(90vh,840px)] sm:rounded-2xl">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Mail className="size-5" /></div>
                <div className="min-w-0">
                  <h2 id="send-email-title" className="text-lg font-semibold">Send an email</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">To {display(booking.email)}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEmailOpen(false)} aria-label="Close email dialog"><X /></Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-6">
                <section aria-labelledby="email-composer-title" className="rounded-xl border bg-muted/20 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-background p-2 text-primary shadow-sm"><Mail className="size-4" /></div>
                    <div>
                      <h3 id="email-composer-title" className="font-semibold">Compose email</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Choose a template or write a message, then send it to this customer.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="email-template" className="text-sm font-medium">Load a template <span className="font-normal text-muted-foreground">(optional)</span></label>
                        <select id="email-template" aria-label="Load an email template" value={emailTemplate} onChange={(event) => {
                          setEmailTemplate(event.target.value);
                          const template = emailTemplateContent(event.target.value, booking);
                          setCustomSubject(template.subject);
                          setCustomMessage(template.message);
                        }} className="h-9 max-w-full rounded-lg border bg-background px-2.5 text-sm">
                          <option value="">Choose a template…</option>
                          {emailTemplates.map((template) => <option key={template.value} value={template.value}>{template.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="email-subject" className="text-sm font-medium">Subject</label>
                      <input id="email-subject" aria-label="Email subject" value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} placeholder="e.g. Details for your event" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="email-message" className="text-sm font-medium">Message</label>
                      <textarea id="email-message" aria-label="Email message" value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Write your message…" className="min-h-32 w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="email-attachment" className="text-sm font-medium">Attachment <span className="font-normal text-muted-foreground">(optional)</span></label>
                      <input key={customFile?.name ?? "empty-email"} id="email-attachment" aria-label="Email attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(event) => setCustomFile(event.target.files?.[0] ?? null)} className="block w-full cursor-pointer rounded-lg border bg-background text-sm file:mr-3 file:border-0 file:border-r file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium" />
                      <p className="text-xs text-muted-foreground">{customFile ? customFile.name : "Optional · up to 10 MB"}</p>
                    </div>
                    <Button className="w-full sm:w-auto" disabled={!customSubject.trim() || !customMessage.trim()} onClick={async () => { const sent = await onSendEmail(booking.id, customSubject, customMessage, customFile); if (sent) { setCustomSubject(""); setCustomMessage(""); setCustomFile(null); setEmailTemplate(""); setEmailOpen(false); } }}>Send email</Button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  </div>;
}
function TaxReportPage() {
 const today = new Date();
 const financialYearStart = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
 const [tool, setTool] = useState<"gst" | "tax">("gst");
 const [from, setFrom] = useState(`${financialYearStart}-07-01`);
 const [to, setTo] = useState(`${financialYearStart + 1}-06-30`);
 const [basis, setBasis] = useState<"paid" | "issued">("paid");
 const [report, setReport] = useState<{
   summary: { invoiceCount: number; taxableSalesCents: number; gstIncludedCents: number; securityDepositCents: number; totalAmountCents: number };
   rows: Array<{ invoiceNumber: string; date: string; paidAt: string | null; status: string; paymentMethod: string; taxableSalesCents: number; gstIncludedCents: number; securityDepositCents: number; totalAmountCents: number }>;
 } | null>(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");

 const runReport = useCallback(async () => {
   setLoading(true);
   setError("");
   try {
     const response = await fetch(`/api/admin/tax-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&basis=${basis}`, { cache: "no-store" });
     if (!response.ok) throw new Error(await responseError(response, "Could not load the GST report."));
     setReport(await response.json());
   } catch (cause) {
     setError(cause instanceof Error ? cause.message : "Could not load the GST report.");
   } finally {
     setLoading(false);
   }
 }, [basis, from, to]);

 useEffect(() => {
   const timer = window.setTimeout(() => void runReport(), 0);
   return () => window.clearTimeout(timer);
 }, [runReport]);

 async function downloadReport() {
   const response = await fetch(`/api/admin/tax-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&basis=${basis}&format=csv`, { cache: "no-store" });
   if (!response.ok) {
     setError(await responseError(response, "Could not download the GST report."));
     return;
   }
   const blob = await response.blob();
   const link = document.createElement("a");
   link.href = URL.createObjectURL(blob);
   link.download = `gst-report-${from}-to-${to}-${basis}.csv`;
   link.click();
   URL.revokeObjectURL(link.href);
 }

 const money = (cents: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
 return (
   <section id="tax-report" aria-labelledby="tax-report-title" className="space-y-4">
     <div className="flex flex-wrap items-end justify-between gap-4">
       <div>
         <p className="text-sm font-medium text-primary">Tax time</p>
         <h1 id="tax-report-title" className="mt-1 text-3xl font-semibold tracking-tight">Tax</h1>
         <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage GST summaries, tax records, and downloadable reports for your business.</p>
       </div>
       {tool === "gst" ? <Button variant="outline" className="gap-2" onClick={() => void downloadReport()} disabled={!report || loading}><Download className="size-4" />Download CSV</Button> : null}
     </div>
     <div className="inline-flex rounded-lg border bg-card p-1" role="tablist" aria-label="Tax tools">
       <button type="button" role="tab" aria-selected={tool === "gst"} onClick={() => setTool("gst")} className={`rounded-md px-3 py-2 text-sm font-medium ${tool === "gst" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Calculating GST</button>
       <button type="button" role="tab" aria-selected={tool === "tax"} onClick={() => setTool("tax")} className={`rounded-md px-3 py-2 text-sm font-medium ${tool === "tax" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Tax</button>
     </div>
     {tool === "tax" ? <IncomeTaxCalculator /> : <><Card>
       <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
         <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>From</span><input aria-label="GST report from date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
         <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>To</span><input aria-label="GST report to date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
         <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Report basis</span><select aria-label="GST report basis" value={basis} onChange={(event) => setBasis(event.target.value as "paid" | "issued")} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground"><option value="paid">Payments received (cash basis)</option><option value="issued">Invoices issued (accrual basis)</option></select></label>
         <Button onClick={() => void runReport()} disabled={loading} className="gap-2"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />Run report</Button>
       </CardContent>
     </Card>
     <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary"><p className="font-medium">How this figure works</p><p className="mt-1 text-primary/80">GST included is calculated as 1/11 of your GST-inclusive hire charges. Refundable security deposits are excluded. This is output GST before input-tax credits and other BAS adjustments.</p></div>
     {error ? <Card><CardContent className="p-8 text-center text-sm text-destructive">{error}</CardContent></Card> : loading && !report ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground"><RefreshCw className="mx-auto mb-3 size-6 animate-spin" />Preparing GST report…</CardContent></Card> : report ? <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">GST included</p><p className="mt-1 text-2xl font-semibold text-primary">{money(report.summary.gstIncludedCents)}</p><p className="mt-1 text-xs text-muted-foreground">Review for your BAS</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Taxable hire sales</p><p className="mt-1 text-2xl font-semibold">{money(report.summary.taxableSalesCents)}</p><p className="mt-1 text-xs text-muted-foreground">{report.summary.invoiceCount} invoice{report.summary.invoiceCount === 1 ? "" : "s"}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Refundable deposits</p><p className="mt-1 text-2xl font-semibold">{money(report.summary.securityDepositCents)}</p><p className="mt-1 text-xs text-muted-foreground">Excluded from GST</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Customer payments</p><p className="mt-1 text-2xl font-semibold">{money(report.summary.totalAmountCents)}</p><p className="mt-1 text-xs text-muted-foreground">Hire plus deposits</p></CardContent></Card></section><Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Hire</th><th className="px-4 py-3 text-right font-medium">GST included</th><th className="px-4 py-3 text-right font-medium">Deposit</th></tr></thead><tbody className="divide-y">{report.rows.map((row) => <tr key={row.invoiceNumber}><td className="px-4 py-3 font-medium">{row.invoiceNumber}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(row.date)}</td><td className="px-4 py-3 capitalize text-muted-foreground">{row.status}</td><td className="px-4 py-3 text-right">{money(row.taxableSalesCents)}</td><td className="px-4 py-3 text-right font-medium text-primary">{money(row.gstIncludedCents)}</td><td className="px-4 py-3 text-right text-muted-foreground">{money(row.securityDepositCents)}</td></tr>)}</tbody></table>{report.rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No invoices matched this date range and report basis.</p> : null}</CardContent></Card></> : null}
   </>}</section>
 );
}

function IncomeTaxCalculator() {
  const [year, setYear] = useState<IncomeTaxYear>("2026-27");
  const [businessIncome, setBusinessIncome] = useState("");
  const [deductibleExpenses, setDeductibleExpenses] = useState("");
  const [salaryIncome, setSalaryIncome] = useState("");
  const [otherIncome, setOtherIncome] = useState("");
  const [taxPaid, setTaxPaid] = useState("");
  const cents = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));
  const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value / 100);
  const netProfit = Math.max(0, cents(businessIncome) - cents(deductibleExpenses));
  const taxableIncome = netProfit + cents(salaryIncome) + cents(otherIncome);
  const incomeTax = calculateResidentIncomeTax(taxableIncome, year);
  const medicareLevy = calculateMedicareLevy(taxableIncome);
  const estimatedTax = incomeTax + medicareLevy;
  const estimatedBalance = estimatedTax - cents(taxPaid);
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Tax year</span><select aria-label="Income tax year" value={year} onChange={(event) => setYear(event.target.value as IncomeTaxYear)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground"><option value="2026-27">2026–27</option><option value="2025-26">2025–26</option></select></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Business income (AUD)</span><input aria-label="Business income" inputMode="decimal" value={businessIncome} onChange={(event) => setBusinessIncome(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" placeholder="0.00" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Deductible business expenses (AUD)</span><input aria-label="Deductible business expenses" inputMode="decimal" value={deductibleExpenses} onChange={(event) => setDeductibleExpenses(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" placeholder="0.00" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Gross full-time salary and wages (AUD)</span><input aria-label="Gross full-time salary and wages" inputMode="decimal" value={salaryIncome} onChange={(event) => setSalaryIncome(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" placeholder="0.00" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Other taxable income (AUD)</span><input aria-label="Other taxable income" inputMode="decimal" value={otherIncome} onChange={(event) => setOtherIncome(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" placeholder="0.00" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2"><span>Tax already paid or withheld (AUD)</span><input aria-label="Tax already paid" inputMode="decimal" value={taxPaid} onChange={(event) => setTaxPaid(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" placeholder="0.00" /></label>
        </CardContent>
      </Card>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Net business profit</p><p className="mt-1 text-2xl font-semibold">{money(netProfit)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Taxable income</p><p className="mt-1 text-2xl font-semibold">{money(taxableIncome)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Income tax estimate</p><p className="mt-1 text-2xl font-semibold text-primary">{money(incomeTax)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Estimated balance</p><p className={`mt-1 text-2xl font-semibold ${estimatedBalance > 0 ? "text-amber-700" : "text-emerald-700"}`}>{money(Math.abs(estimatedBalance))}</p><p className="mt-1 text-xs text-muted-foreground">{estimatedBalance > 0 ? "Potential amount remaining" : "Potential credit"}</p></CardContent></Card></section>
      <Card><CardContent className="space-y-2 p-4 text-sm"><p><span className="font-medium">Medicare levy estimate:</span> {money(medicareLevy)}</p><p className="text-muted-foreground">This combines your full-time salary, Peppermint Audio net profit, and other taxable income before applying the resident tax brackets. Tax already paid or withheld is subtracted from the estimated balance.</p><p className="text-muted-foreground">This is an individual Australian resident estimate. It does not account for company tax, tax offsets, HELP debt, Medicare exemptions or surcharge, capital gains, superannuation, or deductible expense eligibility.</p><p className="text-muted-foreground">Use this as an estimate only and confirm your final return with a registered tax agent. Rates: <a className="underline" href="https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents" target="_blank" rel="noreferrer">ATO resident tax rates</a>.</p></CardContent></Card>
    </div>
  );
}

function EmailHistoryPage({ bookings, search, onSearch, onSelect }: { bookings: Booking[]; search: string; onSearch: (value: string) => void; onSelect: (booking: Booking) => void }) {
  const emailCount = bookings.reduce((total, booking) => total + (booking.email_logs?.length ?? 0), 0);
  return (
    <section id="email-history" aria-labelledby="email-history-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Customer communications</p>
          <h1 id="email-history-title" className="mt-1 text-3xl font-semibold tracking-tight">Email history</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search a booking to see every customer email sent to them in the last 30 days.</p>
        </div>
        <div className="text-xs text-muted-foreground">{bookings.length} {bookings.length === 1 ? "booking" : "bookings"} · {emailCount} {emailCount === 1 ? "email" : "emails"}</div>
      </div>
      <Card>
        <CardContent className="p-3">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
            <span>Search bookings</span>
            <span className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input aria-label="Search email history" placeholder="Search name, email or event" value={search} onChange={(event) => onSearch(event.target.value)} className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm font-normal text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" />
            </span>
          </label>
        </CardContent>
      </Card>
      {bookings.length ? (
        <Card>
          <div className="divide-y">
            {bookings.map((booking) => {
              const logs = booking.email_logs ?? [];
              const latest = logs.slice().sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
              return (
                <button key={booking.id} onClick={() => onSelect(booking)} className="flex w-full flex-wrap items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 sm:flex-nowrap">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{booking.first_name[0]}{booking.last_name[0]}</div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{booking.first_name} {booking.last_name}</p>
                      <p className="truncate text-sm text-muted-foreground">{display(booking.email)}</p>
                    </div>
                  </div>
                  <div className="min-w-32">
                    <p className="text-sm font-medium">{display(booking.event_type)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(booking.pickup_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-4" />
                    <span>{logs.length} {logs.length === 1 ? "email" : "emails"}</span>
                  </div>
                  <div className="w-full text-xs text-muted-foreground sm:w-44 sm:text-right">{latest ? `Last sent ${formatSentAt(latest.sent_at)}` : "No emails sent yet"}</div>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card><CardContent className="p-12 text-center"><Mail className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">No bookings match this search</p><p className="mt-1 text-sm text-muted-foreground">Try searching by customer name, email, or event.</p></CardContent></Card>
      )}
    </section>
  );
}
function Detail({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div className="min-w-0"><p className="flex items-center gap-1 text-xs text-muted-foreground">{icon ? <span className="inline-flex size-3 shrink-0 items-center justify-center [&>svg]:size-3">{icon}</span> : null}{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>; }
function EmailHistoryDetail({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const logs = (booking.email_logs ?? []).slice().sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="email-history-detail-title" className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l bg-background shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Mail className="size-5" /></div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Customer communications</p>
              <h2 id="email-history-detail-title" className="mt-1 truncate text-xl font-semibold">{booking.first_name} {booking.last_name}</h2>
              <p className="truncate text-sm text-muted-foreground">{display(booking.email)}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close email history"><X /></Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email activity</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">{logs.length}</p>
                <p className="text-sm text-muted-foreground">{logs.length === 1 ? "communication sent" : "communications sent"}</p>
              </div>
              <div className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">Retained for 30 days</div>
            </div>
          </div>
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Communication timeline</h3>
                <p className="mt-1 text-sm text-muted-foreground">Every delivery recorded for this customer.</p>
              </div>
              {logs.length ? <Badge variant="secondary">{logs.length}</Badge> : null}
            </div>
            {logs.length ? (
              <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-border">
                {logs.map((log) => (
                  <li key={log.id} className="relative flex gap-3">
                    <div className="z-10 mt-3 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-primary shadow-sm"><Mail className="size-4" /></div>
                    <div className="min-w-0 flex-1 rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium">{emailTypeLabel(log.email_type)}</p>
                        <p className="text-xs text-muted-foreground">{formatSentAt(log.sent_at)}</p>
                      </div>
                      <p className="mt-2 truncate text-sm text-muted-foreground">Delivered to {log.recipient_email}</p>
                      {log.provider_message_id ? <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground/70">ID {log.provider_message_id}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center">
                <Mail className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">No communications recorded</p>
                <p className="mt-1 text-sm text-muted-foreground">Emails sent to this customer will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
