"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Archive, CalendarDays, CheckCircle2, ChevronRight, Clock3, Download,
  ExternalLink, FileText, LayoutDashboard, LogOut, Mail, Menu, RefreshCw,
  Search, ShieldCheck, UserRound, X, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { bookingStatuses, filterBookings, isUpcoming, statusCounts } from "@/lib/admin-dashboard";

type Booking = Record<string, unknown> & {
  id: string; first_name: string; last_name: string; event_type: string;
  pickup_date: string; dropoff_date?: string; pickup_time?: string | null; dropoff_time?: string | null; status: string;
  internal_notes?: string; photo_id_paths?: string[]; add_ons?: string[];
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
  custom: "Custom email",
  invoice: "Invoice email",
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
async function responseError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}
type SummaryCard = { key: string; label: string; icon: ComponentType<{ className?: string }>; color: string; count: number };
type AdminSection = "bookings" | "archive";

export function AdminConsole() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [section, setSection] = useState<AdminSection>("bookings");

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
      setSection(window.location.hash === "#archive" ? "archive" : "bookings");
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
  async function sendReminder(id: string) {
    try {
      const response = await fetch("/api/admin/test-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: id }) });
      if (!response.ok) { showMessage(await responseError(response, "Email reminder failed."), "error"); return; }
      showMessage("Email reminder sent.", "success");
    } catch { showMessage("Email reminder failed. Check your connection and try again.", "error"); }
  }
  async function sendConfirmation(id: string) {
    try {
      const response = await fetch("/api/admin/send-confirmation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: id }) });
      if (!response.ok) { showMessage(await responseError(response, "Booking confirmation email failed."), "error"); return; }
      showMessage("Booking confirmation email sent.", "success");
    } catch { showMessage("Booking confirmation email failed. Check your connection and try again.", "error"); }
  }
  async function sendCustomEmail(id: string, subject: string, message: string) {
    try {
      const response = await fetch("/api/admin/send-custom-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: id, subject, message }) });
      if (!response.ok) { showMessage(await responseError(response, "Custom email failed."), "error"); return false; }
      showMessage("Custom email sent.", "success");
      return true;
    } catch { showMessage("Custom email failed. Check your connection and try again.", "error"); return false; }
  }
  async function signOut() { await fetch("/api/admin/logout", { method: "POST" }); window.location.href = "/admin/login"; }
  function navigateSection(nextSection: AdminSection, event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setSection(nextSection);
    setMobileNav(false);
    setMessage("");
    window.history.replaceState(null, "", `#${nextSection}`);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r bg-card p-5 transition-transform md:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 border-b pb-6"><div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div><div><p className="font-semibold">Peppermint Audio</p><p className="text-xs text-muted-foreground">Operations console</p></div></div>
        <nav className="mt-6 space-y-1" aria-label="Admin sections"><a className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "bookings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`} href="#bookings" aria-current={section === "bookings" ? "page" : undefined} onClick={(event) => navigateSection("bookings", event)}><LayoutDashboard className="size-4" />Bookings</a><a className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "archive" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`} href="#archive" aria-current={section === "archive" ? "page" : undefined} onClick={(event) => navigateSection("archive", event)}><Archive className="size-4" />Archive export</a></nav>
        <div className="absolute bottom-5 left-5 right-5 border-t pt-4"><Button variant="ghost" className="w-full justify-start gap-3" onClick={() => void signOut()}><LogOut className="size-4" />Sign out</Button></div>
      </aside>
      {mobileNav && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileNav(false)} />}
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8"><Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMobileNav(true)}><Menu /></Button><div className="hidden min-w-0 md:block"><p className="text-sm font-medium">{section === "archive" ? "Archive export" : "Booking management"}</p><p className="text-xs text-muted-foreground">{section === "archive" ? "Securely download booking records" : "Keep every event moving smoothly"}</p></div><div className="flex shrink-0 items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:inline">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}` : "Not updated yet"}</span><Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />Refresh</Button><Button variant="ghost" size="icon" className="md:hidden" onClick={() => void signOut()}><LogOut /></Button></div></div></header>
        <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-8">
          {message && <p role="status" className={`rounded-lg border px-4 py-2.5 text-sm ${messageType === "error" ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`}>{message}</p>}
          {section === "bookings" ? <><section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Good to see you</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Bookings overview</h1><p className="mt-1 text-sm text-muted-foreground">Review enquiries, confirm details, and prepare every event.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{lastUpdated ? `Last updated ${lastUpdated.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}` : "Loading latest data"}</div></section>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{([{ key: "upcoming", label: "Upcoming", icon: CalendarDays, color: "text-primary", count: upcomingCount }, { key: "submitted", label: "Submitted", icon: FileText, color: "text-amber-600", count: counts.submitted }, { key: "confirmed", label: "Confirmed", icon: CheckCircle2, color: "text-blue-600", count: counts.confirmed }, { key: "completed", label: "Completed", icon: CalendarDays, color: "text-emerald-600", count: counts.completed }, { key: "cancelled", label: "Cancelled", icon: XCircle, color: "text-red-600", count: counts.cancelled }] satisfies SummaryCard[]).map(({ key, label, icon: Icon, color, count }) => <Card key={key}><CardContent className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div><div className={`rounded-lg bg-muted p-2.5 ${color}`}><Icon className="size-5" /></div></CardContent></Card>)}</section>
          <section id="bookings" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">All bookings</h2><p className="text-sm text-muted-foreground">{visibleBookings.length} {visibleBookings.length === 1 ? "booking" : "bookings"} in view</p></div></div>
            <Card><CardContent className="grid gap-4 p-3 sm:grid-cols-[repeat(2,minmax(10rem,1fr))] lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(10rem,1fr))]"><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-1"><span>Search</span><span className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input aria-label="Search bookings" placeholder="Search name, email or event" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-background pl-9 pr-3 text-sm font-normal text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" /></span></label><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Status</span><select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground"><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Pickup from</span><input aria-label="Bookings from date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label><label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Pickup to</span><input aria-label="Bookings to date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label></CardContent></Card>
            {error ? <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><XCircle className="size-8 text-destructive" /><p className="font-medium">We couldn&apos;t load bookings</p><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></CardContent></Card> : loading ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground"><RefreshCw className="mx-auto mb-3 size-6 animate-spin" />Loading bookings…</CardContent></Card> : visibleBookings.length === 0 ? <Card><CardContent className="p-12 text-center"><CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">No bookings match these filters</p><p className="mt-1 text-sm text-muted-foreground">Try clearing a filter or check back after a new enquiry.</p></CardContent></Card> : <Card><div className="divide-y">{visibleBookings.map((booking) => <button key={booking.id} onClick={() => setSelected(booking)} className="flex w-full flex-wrap items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 sm:flex-nowrap"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{booking.first_name[0]}{booking.last_name[0]}</div><div className="min-w-0"><p className="truncate font-medium">{booking.first_name} {booking.last_name}</p><p className="truncate text-sm text-muted-foreground">{display(booking.email)}</p></div></div><div className="w-36"><p className="text-sm font-medium">{display(booking.event_type)}</p><p className="text-xs text-muted-foreground">{formatDate(booking.pickup_date)}</p></div><Badge className={statusClass(booking.status)}>{statusLabel(booking.status)}</Badge><ChevronRight className="ml-auto size-4 text-muted-foreground" /></button>)}</div></Card>}
          </section>
          </> : <section id="archive" aria-labelledby="archive-title" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-primary">Data management</p><h1 id="archive-title" className="mt-1 text-3xl font-semibold tracking-tight">Archive export</h1><p className="mt-1 text-sm text-muted-foreground">Create a secure backup of booking records and private photo IDs.</p></div><a href="#bookings" onClick={(event) => navigateSection("bookings", event)} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">Back to bookings</a></div><div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-lg bg-amber-100 p-2 text-amber-700"><Archive className="size-5" /></div><div><h2 className="font-semibold text-amber-950">Export booking archive</h2><p className="mt-1 max-w-xl text-sm text-amber-900/70">Download a ZIP of booking records and private photo IDs for a specific pickup date range. Handle this file securely.</p></div></div><div className="flex flex-wrap gap-2"><input aria-label="Archive from date" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 rounded-lg border border-amber-200 bg-background px-3 text-sm" /><input aria-label="Archive to date" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 rounded-lg border border-amber-200 bg-background px-3 text-sm" /><Button variant="outline" className="gap-2 border-amber-300 bg-background" onClick={() => void exportArchive()}><Download className="size-4" />Export ZIP</Button></div></div></div></section>}
        </main>
      </div>
      {selected && <BookingDetail booking={selected} onClose={() => setSelected(null)} onUpdate={update} onPhoto={signedLink} onDelete={deleteBooking} onSendReminder={sendReminder} onSendConfirmation={sendConfirmation} onSendCustomEmail={sendCustomEmail} onSendInvoiceEmail={async (id, subject, message, file) => { const body = new FormData(); body.append("bookingId", id); body.append("subject", subject); body.append("message", message); body.append("attachment", file); try { const response = await fetch("/api/admin/send-invoice-email", { method: "POST", body }); if (!response.ok) { showMessage(await responseError(response, "Invoice email failed."), "error"); return false; } showMessage("Invoice email sent.", "success"); return true; } catch { showMessage("Invoice email failed. Check your connection and try again.", "error"); return false; } }} />}
    </div>
  );
}

function BookingDetail({ booking, onClose, onUpdate, onPhoto, onDelete, onSendReminder, onSendConfirmation, onSendCustomEmail, onSendInvoiceEmail }: { booking: Booking; onClose: () => void; onUpdate: (id: string, values: { status?: string; internal_notes?: string }) => Promise<void>; onPhoto: (path: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onSendReminder: (id: string) => Promise<void>; onSendConfirmation: (id: string) => Promise<void>; onSendCustomEmail: (id: string, subject: string, message: string) => Promise<boolean>; onSendInvoiceEmail: (id: string, subject: string, message: string, file: File) => Promise<boolean> }) {
  const [notes, setNotes] = useState(booking.internal_notes ?? "");
  const [emailOpen, setEmailOpen] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [invoiceSubject, setInvoiceSubject] = useState("Your Peppermint Audio invoice");
  const [invoiceMessage, setInvoiceMessage] = useState("Hi,\n\nPlease find your invoice attached for your Peppermint Audio booking.\n\nIf you have any questions, please get in touch.");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  async function sendInvoiceEmail(id: string) {
    if (!invoiceFile) return false;
    const sent = await onSendInvoiceEmail(id, invoiceSubject, invoiceMessage, invoiceFile);
    if (sent) {
      setInvoiceSubject("Your Peppermint Audio invoice");
      setInvoiceMessage("Hi,\n\nPlease find your invoice attached for your Peppermint Audio booking.\n\nIf you have any questions, please get in touch.");
      setInvoiceFile(null);
    }
    return sent;
  }
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="booking-detail-title" className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl">
      <div className="flex shrink-0 items-start justify-between border-b bg-background p-4 sm:p-5"><div className="min-w-0 pr-3"><p className="text-sm text-primary">Booking details</p><h2 id="booking-detail-title" className="mt-1 break-words text-xl font-semibold sm:text-2xl">{booking.first_name} {booking.last_name}</h2><p className="truncate text-sm text-muted-foreground">{display(booking.event_type)} · {formatDate(booking.pickup_date)}</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details"><X /></Button></div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><Badge className={statusClass(booking.status)}>{statusLabel(booking.status)}</Badge><label className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span>Status</span><select aria-label="Update booking status" value={booking.status} onChange={(e) => void onUpdate(booking.id, { status: e.target.value })} className="h-9 rounded-lg border bg-background px-3 text-sm font-normal text-foreground">{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label></div><div className="grid grid-cols-1 gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2"><Detail label="Customer" value={`${booking.first_name} ${booking.last_name}`} icon={<UserRound />} /><Detail label="Email" value={display(booking.email)} icon={<Mail />} /><Detail label="Mobile" value={display(booking.mobile)} /><Detail label="Event address" value={display(booking.event_address)} />      <Detail label="Pickup" value={`${formatDate(booking.pickup_date)} at ${formatTime(booking.pickup_time)}`} /><Detail label="Drop-off" value={`${formatDate(booking.dropoff_date)} at ${formatTime(booking.dropoff_time)}`} /><Detail label="Package" value={display(booking.package_interest)} /><Detail label="Guests" value={display(booking.guest_count)} /><Detail label="Add-ons" value={booking.add_ons?.length ? booking.add_ons.join(", ") : "None selected"} /></div><div><h3 className="mb-2 text-sm font-semibold">Additional details</h3><p className="break-words rounded-lg bg-muted p-3 text-sm leading-relaxed">{display(booking.additional_details)}</p></div><div><h3 className="mb-2 text-sm font-semibold">Internal notes</h3><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 w-full resize-y rounded-lg border bg-background p-3 text-sm" placeholder="Add a private note for the team…" /><Button size="sm" className="mt-2" onClick={() => void onUpdate(booking.id, { internal_notes: notes })}>Save notes</Button></div>      <EmailHistory logs={booking.email_logs ?? []} /><div className="flex justify-end"><Button size="sm" onClick={() => setEmailOpen(true)}>Send Email</Button></div>{booking.photo_id_paths?.length ? <div><h3 className="mb-2 text-sm font-semibold">Photo ID</h3><div className="flex flex-wrap gap-2">{booking.photo_id_paths.map((path) => <Button key={path} variant="outline" size="sm" onClick={() => void onPhoto(path)}>View private ID <ExternalLink /></Button>)}</div></div> : null}<Button variant="destructive" className="w-full" onClick={() => void onDelete(booking.id)}>Permanently delete booking</Button></div>
      {emailOpen ? <div role="dialog" aria-modal="true" aria-labelledby="send-email-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><h2 id="send-email-title" className="text-lg font-semibold">Send Email</h2><Button variant="ghost" size="icon" onClick={() => setEmailOpen(false)} aria-label="Close email dialog"><X /></Button></div><p className="mt-1 text-sm text-muted-foreground">Choose an email to send to {display(booking.email)}.</p><div className="mt-5 grid gap-2">{booking.status === "confirmed" ? <Button variant="outline" className="justify-start" onClick={async () => { await onSendConfirmation(booking.id); setEmailOpen(false); }}>Send booking confirmation</Button> : <Button variant="outline" className="justify-start" disabled>Send booking confirmation (confirm booking first)</Button>}<Button variant="outline" className="justify-start" onClick={async () => { await onSendReminder(booking.id); setEmailOpen(false); }}>Send pickup reminder</Button></div><div className="mt-5 border-t pt-5"><h3 className="font-medium">Send invoice</h3><div className="mt-3 grid gap-3"><input aria-label="Invoice email subject" value={invoiceSubject} onChange={(event) => setInvoiceSubject(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm" /><textarea aria-label="Invoice email message" value={invoiceMessage} onChange={(event) => setInvoiceMessage(event.target.value)} className="min-h-28 rounded-lg border bg-background p-3 text-sm" /><input key={invoiceFile?.name ?? "empty-invoice"} aria-label="Invoice attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)} className="block w-full text-sm" /><Button disabled={!invoiceSubject.trim() || !invoiceMessage.trim() || !invoiceFile} onClick={async () => { const sent = await sendInvoiceEmail(booking.id); if (sent) { setEmailOpen(false); } }}>Send invoice</Button></div></div><div className="mt-5 border-t pt-5"><h3 className="font-medium">Send custom email</h3><div className="mt-3 grid gap-3"><input aria-label="Custom email subject" value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} placeholder="Subject" className="h-10 rounded-lg border bg-background px-3 text-sm" /><textarea aria-label="Custom email message" value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Write your message…" className="min-h-28 rounded-lg border bg-background p-3 text-sm" /><Button disabled={!customSubject.trim() || !customMessage.trim()} onClick={async () => { const sent = await onSendCustomEmail(booking.id, customSubject, customMessage); if (sent) { setCustomSubject(""); setCustomMessage(""); setEmailOpen(false); } }}>Send custom email</Button></div></div></div></div> : null}
    </aside>
  </div>;
}
function Detail({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div className="min-w-0"><p className="flex items-center gap-1 text-xs text-muted-foreground">{icon ? <span className="inline-flex size-3 shrink-0 items-center justify-center [&>svg]:size-3">{icon}</span> : null}{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>; }
function EmailHistory({ logs }: { logs: NonNullable<Booking["email_logs"]> }) {
  return (
    <section className="rounded-xl border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Email history</h3>
          <p className="mt-1 text-xs text-muted-foreground">Customer email delivery records are kept for 30 days.</p>
        </div>
        <Badge variant="secondary">{logs.length}</Badge>
      </div>
      {logs.length ? (
        <div className="mt-4 divide-y rounded-lg border bg-background">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{emailTypeLabel(log.email_type)}</p>
                <p className="truncate text-xs text-muted-foreground">{log.recipient_email}</p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{formatSentAt(log.sent_at)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          No customer emails have been logged for this booking yet.
        </p>
      )}
    </section>
  );
}
