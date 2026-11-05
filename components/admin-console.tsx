"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import {
  Archive, BarChart3, Boxes, ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet,
  CalendarDays, ExternalLink, Hash, LayoutDashboard, LogOut, Mail, Menu, RefreshCw,
  ShieldCheck, UserRound, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { bookingStatuses } from "@/lib/admin-dashboard";
import { AdminBookingsWorkspace } from "@/components/admin-bookings-workspace";
import { AdminBusinessAnalytics } from "@/components/admin-business-analytics";
import { buildBookingConfirmationEmail } from "@/lib/booking-confirmation-email";
import { bookingReferenceForId } from "@/lib/booking-reference";
import { lineItemsForBooking } from "@/lib/booking-line-items";
import { buildPickupReminderEmail } from "@/lib/pickup-reminders";
import { calculateMedicareLevy, calculateResidentIncomeTax, type IncomeTaxYear } from "@/lib/income-tax";
import type { BankTransferOption } from "@/lib/bank-transfer";
import { AdminHireItems, AdminPaymentPanel } from "@/components/admin-payment-panel";
import { AdminInventory } from "@/components/admin-inventory";
import { AdminErrorDialog } from "@/components/admin-error-dialog";
import { PdfAttachmentPreview } from "@/components/pdf-attachment-preview";
import type { BookingLineItem } from "@/lib/booking-line-items";

type Booking = Record<string, unknown> & {
  id: string; first_name: string; last_name: string; event_type: string;
  pickup_date: string; dropoff_date?: string; pickup_time?: string | null; dropoff_time?: string | null; status: string;
  email?: string; additional_details?: string | null;
  internal_notes?: string; photo_id_paths?: string[];
  mobile?: string; event_address?: string; gst_inclusive?: boolean | null;
  hire_amount_cents?: number | null; security_deposit_cents?: number | null; payment_method?: string | null;
  hire_line_items?: BookingLineItem[] | null;
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
  submitted: "border-amber-300/35 bg-gradient-to-b from-amber-400/20 to-amber-500/5 text-amber-200 shadow-[0_2px_12px_rgb(245_158_11/0.12)]",
  confirmed: "border-blue-300/35 bg-gradient-to-b from-blue-400/20 to-blue-500/5 text-blue-200 shadow-[0_2px_12px_rgb(59_130_246/0.12)]",
  completed: "border-emerald-300/35 bg-gradient-to-b from-emerald-400/20 to-emerald-500/5 text-emerald-200 shadow-[0_2px_12px_rgb(16_185_129/0.12)]",
  cancelled: "border-red-300/35 bg-gradient-to-b from-red-400/20 to-red-500/5 text-red-200 shadow-[0_2px_12px_rgb(239_68_68/0.12)]",
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
  const hireItems = lineItemsForBooking(booking);
  if (value === "booking-confirmation") {
    const email = buildBookingConfirmationEmail({
      bookingReference: bookingReferenceForId(booking.id),
      firstName: booking.first_name,
      eventType: booking.event_type,
      pickupDate: booking.pickup_date,
      dropoffDate: booking.dropoff_date ?? booking.pickup_date,
      pickupTime: booking.pickup_time,
      dropoffTime: booking.dropoff_time,
      hireLineItems: hireItems,
      pickupInstructions: {
        hire_line_items: hireItems,
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
      hire_line_items: hireItems,
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
type AdminSection = "bookings" | "inventory" | "analytics" | "tax-report" | "archive";

export function AdminConsole() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] = useState<Booking | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
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
      const response = await fetch("/api/admin/bookings?all=true", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load bookings.");
      setBookings(data.bookings ?? []); setLastUpdated(new Date());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load bookings."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const syncSection = () => {
      const hash = window.location.hash;
      setSection(hash === "#archive" ? "archive" : hash === "#tax-report" ? "tax-report" : hash === "#inventory" ? "inventory" : ["#analytics", "#all-bookings", "#historical-bookings"].includes(hash) ? "analytics" : "bookings");
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

  async function update(id: string, values: { status?: string; internal_notes?: string; payment_received?: boolean }) {
    const booking = bookings.find((item) => item.id === id);
    const bankTransferAvailable = booking?.payment_method === "bank_transfer"
    || (booking?.payment_method === "stripe_card_hold" && booking.bank_transfer_option === "both");
    const waitingForManualPayment = !["paid", "succeeded", "bank_transfer_received"].includes(booking?.hire_payment_status ?? "");
    if (values.status === "confirmed" && booking && bankTransferAvailable && waitingForManualPayment
    && values.payment_received !== true) {
      setPaymentConfirmation(booking);
      return;
    }
    if (values.payment_received) setConfirmingPayment(true);
    try {
      const response = await fetch("/api/admin/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...values }) });
      const data = await response.json() as {
        error?: string;
        payment?: Pick<Booking, "hire_payment_status" | "deposit_payment_status" | "payment_method" | "bank_transfer_option" | "payment_token" | "stripe_hire_payment_intent_id" | "stripe_deposit_payment_intent_id">;
        booking?: Partial<Booking>;
      };
      if (!response.ok) {
        if (data.booking) {
          setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, ...data.booking } : booking));
          setSelected((current) => current?.id === id ? { ...current, ...data.booking } : current);
          setPaymentConfirmation(null);
        }
        showMessage(data.error ?? "Update failed.", "error");
        return;
      }
      const { payment } = data;
      const { payment_received: paymentReceived, ...bookingValues } = values;
      const updatedValues = { ...bookingValues, ...payment };
      setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, ...updatedValues } : booking));
      setSelected((current) => current?.id === id ? { ...current, ...updatedValues } : current);
      if (paymentReceived) setPaymentConfirmation(null);
      showMessage("Booking updated.", "success");
    } catch { showMessage("Update failed. Check your connection and try again.", "error"); }
    finally { setConfirmingPayment(false); }
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
  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }
  function navigateSection(nextSection: AdminSection, event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setSection(nextSection);
    setMobileNav(false);
    setMessage("");
    window.history.replaceState(null, "", `#${nextSection}`);
  }
  const sectionHeading = section === "analytics" ? "Analytics" : section === "archive" ? "Archive export" : section === "tax-report" ? "Tax" : section === "inventory" ? "Inventory" : "Bookings";
  const sectionDescription = section === "analytics" ? "Insights across all your bookings" : section === "archive" ? "Securely download booking records" : section === "tax-report" ? "Prepare tax figures and records" : section === "inventory" ? "Track owned equipment and purchases" : "Keep every event moving smoothly";

  return (
    <div className="admin-console-shell min-h-screen bg-muted/30">
      <AdminErrorDialog message={messageType === "error" ? message : ""} onClose={() => setMessage("")} />
      <Dialog.Root open={Boolean(paymentConfirmation)} onOpenChange={(open) => { if (!open && !confirmingPayment) setPaymentConfirmation(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-md" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-popover p-6 text-popover-foreground shadow-2xl">
            <Dialog.Title className="text-xl font-semibold">Has payment been received?</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
              Confirm that the hire payment and any security deposit have been received for {paymentConfirmation?.first_name} {paymentConfirmation?.last_name}. This will confirm the booking and email the customer.
            </Dialog.Description>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={confirmingPayment} onClick={() => setPaymentConfirmation(null)}>No, not yet</Button>
              <Button disabled={confirmingPayment} onClick={() => { if (paymentConfirmation) void update(paymentConfirmation.id, { status: "confirmed", payment_received: true }); }}>{confirmingPayment ? "Confirming…" : "Yes, confirm booking"}</Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <aside className={`admin-console-sidebar fixed inset-y-0 left-0 z-30 w-64 border-r bg-card p-5 transition-transform md:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/" aria-label="Go to Peppermint Audio home" className="flex items-center gap-3 border-b pb-6"><div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div><div><p className="font-semibold">Peppermint Audio</p><p className="text-xs text-muted-foreground">Operations console</p></div></Link>
        <nav className="mt-6 space-y-1" aria-label="Admin sections">
          <a className={`admin-console-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "bookings" ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]" : "text-muted-foreground hover:bg-muted"}`} href="#bookings" aria-current={section === "bookings" ? "page" : undefined} onClick={(event) => navigateSection("bookings", event)}><LayoutDashboard className="size-4" />Bookings</a>
          <a className={`admin-console-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "inventory" ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]" : "text-muted-foreground hover:bg-muted"}`} href="#inventory" aria-current={section === "inventory" ? "page" : undefined} onClick={(event) => navigateSection("inventory", event)}><Boxes className="size-4" />Inventory</a>
          <a className={`admin-console-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "analytics" ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]" : "text-muted-foreground hover:bg-muted"}`} href="#analytics" aria-current={section === "analytics" ? "page" : undefined} onClick={(event) => navigateSection("analytics", event)}><BarChart3 className="size-4" />Analytics</a>
          <a className={`admin-console-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "tax-report" ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]" : "text-muted-foreground hover:bg-muted"}`} href="#tax-report" aria-current={section === "tax-report" ? "page" : undefined} onClick={(event) => navigateSection("tax-report", event)}><FileSpreadsheet className="size-4" />Tax</a>
          <a className={`admin-console-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${section === "archive" ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]" : "text-muted-foreground hover:bg-muted"}`} href="#archive" aria-current={section === "archive" ? "page" : undefined} onClick={(event) => navigateSection("archive", event)}><Archive className="size-4" />Archive export</a>
        </nav>
        <div className="absolute bottom-5 left-5 right-5 border-t pt-4"><Button variant="ghost" className="w-full justify-start gap-3" onClick={() => void signOut()}><LogOut className="size-4" />Sign out</Button></div>
      </aside>
      {mobileNav && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileNav(false)} />}
      <div className="md:pl-64">
        <header className="admin-console-topbar sticky top-0 z-10 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8"><Button aria-label="Open navigation" variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMobileNav(true)}><Menu /></Button><div className="hidden min-w-0 md:block"><p className="text-sm font-medium">{sectionHeading}</p><p className="text-xs text-muted-foreground">{sectionDescription}</p></div><div className="flex shrink-0 items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:inline">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}` : "Not updated yet"}</span><Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />Refresh</Button><Button aria-label="Sign out" variant="ghost" size="icon" className="md:hidden" onClick={() => void signOut()}><LogOut /></Button></div></div></header>
        <main className="admin-console-main mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-8">
          {message && messageType === "success" && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-primary">{message}</p>}
          {section === "analytics" ? (
            <AdminBusinessAnalytics bookings={bookings} loading={loading} error={error} onRetry={() => void load()} />
          ) : section === "inventory" ? (
            <AdminInventory />
          ) : section === "bookings" ? (
            <AdminBookingsWorkspace bookings={bookings} loading={loading} error={error} onRetry={() => void load()} onSelect={setSelected} />
          ) : section === "tax-report" ? (
            <TaxReportPage />
          ) : (
            <section id="archive" aria-labelledby="archive-title" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary">Data management</p>
                  <h1 id="archive-title" className="mt-1 text-3xl font-semibold tracking-tight">Archive export</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Create a secure backup of booking records and private photo IDs.</p>
                </div>
                <a href="#bookings" onClick={(event) => navigateSection("bookings", event)} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">Back to bookings</a>
              </div>
              <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/[0.06] p-5 shadow-[0_12px_30px_color-mix(in_oklab,_#f59e0b_5%,_transparent)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="rounded-lg bg-amber-400/15 p-2 text-amber-300"><Archive className="size-5" /></div>
                    <div>
                      <h2 className="font-semibold text-amber-200">Export booking archive</h2>
                      <p className="mt-1 max-w-xl text-sm text-amber-100/65">Download a ZIP of booking records and private photo IDs for a specific pickup date range. Handle this file securely.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input aria-label="Archive from date" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className="h-9 rounded-lg border border-amber-400/30 bg-background px-3 text-sm" />
                    <input aria-label="Archive to date" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className="h-9 rounded-lg border border-amber-400/30 bg-background px-3 text-sm" />
                    <Button variant="outline" className="gap-2 border-amber-400/40 bg-background/60 hover:bg-amber-400/10" onClick={() => void exportArchive()}><Download className="size-4" />Export ZIP</Button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
      {selected && <BookingDetail booking={selected} onClose={() => setSelected(null)} onUpdate={update} onPhoto={signedLink} onDelete={deleteBooking} onSendEmail={sendEmail} onPaymentUpdated={paymentUpdated} />}
    </div>
  );
}

function CommunicationsSection({ booking, onSendEmail }: { booking: Booking; onSendEmail: () => void }) {
  const logs = (booking.email_logs ?? []).slice().sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  const [expanded, setExpanded] = useState(false);
  const [previewingLog, setPreviewingLog] = useState<NonNullable<Booking["email_logs"]>[number] | null>(null);
  const contentId = `booking-communications-${booking.id}`;

  return (
    <section className="overflow-hidden rounded-xl border">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><Mail className="size-4" /></span>
          <span className="min-w-0">
            <span className="block font-semibold">Communications</span>
            <span className="mt-1 block text-sm text-muted-foreground">Email history and messages for this booking.</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">{logs.length}</Badge>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div id={contentId} hidden={!expanded} className="space-y-4 border-t p-4 sm:p-5">
        {previewingLog ? (
          <EmailHistoryPreview log={previewingLog} onBack={() => setPreviewingLog(null)} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold">Email history</h4>
                <p className="mt-1 text-sm text-muted-foreground">Customer emails sent in the last 30 days.</p>
              </div>
              <Button className="gap-2" onClick={onSendEmail}><Mail className="size-4" />Send Email</Button>
            </div>
            {logs.length ? (
              <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-border">
                {logs.map((log) => (
                  <li key={log.id} className="relative flex gap-3">
                    <div className="z-10 mt-3 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-primary shadow-sm"><Mail className="size-4" /></div>
                    <button type="button" onClick={() => setPreviewingLog(log)} aria-label={`View ${emailTypeLabel(log.email_type)} sent email`} className="min-w-0 flex-1 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium">{emailTypeLabel(log.email_type)}</p>
                        <p className="text-xs text-muted-foreground">{formatSentAt(log.sent_at)}</p>
                      </div>
                      <p className="mt-2 truncate text-sm text-muted-foreground">Delivered to {log.recipient_email}</p>
                      {log.provider_message_id ? <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground/70">ID {log.provider_message_id}</p> : null}
                      <p className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">View sent email <ChevronRight className="size-3.5" /></p>
                    </button>
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
          </>
        )}
      </div>
    </section>
  );
}

function BookingDetail({ booking, onClose, onUpdate, onPhoto, onDelete, onSendEmail, onPaymentUpdated }: { booking: Booking; onClose: () => void; onUpdate: (id: string, values: { status?: string; internal_notes?: string }) => Promise<void>; onPhoto: (path: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onSendEmail: (id: string, subject: string, message: string, attachment: File | null) => Promise<boolean>; onPaymentUpdated: (id: string, values: Partial<Booking>) => void }) {
  const [notes, setNotes] = useState(booking.internal_notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [hireItemsDirty, setHireItemsDirty] = useState(false);
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[50] bg-black/45 backdrop-blur-md" />
        <Dialog.Popup aria-labelledby="booking-detail-title" className="fixed inset-0 z-[51] m-auto flex h-[min(92vh,920px)] w-[calc(100%-1rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-[0_30px_120px_rgba(0,0,0,.45)] sm:w-[calc(100%-2rem)] sm:max-w-3xl">
      <div className="relative shrink-0 overflow-hidden border-b bg-[radial-gradient(circle_at_top_right,_color-mix(in_oklab,_var(--primary)_22%,_transparent),_transparent_46%),linear-gradient(135deg,_color-mix(in_oklab,_var(--primary)_8%,_var(--background)),_var(--background)_68%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full border border-primary/15 bg-primary/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Booking details</p>
            <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
              <h2 id="booking-detail-title" className="min-w-0 w-full break-words text-2xl font-semibold leading-tight tracking-tight sm:w-auto sm:flex-1 sm:text-3xl">{booking.first_name} {booking.last_name}</h2>
              <Badge role="status" aria-label={`Booking status: ${statusLabel(booking.status)}`} className={`h-8 shrink-0 gap-2 rounded-full px-3 text-sm font-semibold tracking-wide shadow-sm ring-1 ring-white/10 backdrop-blur-md sm:mt-1 ${statusClass(booking.status)}`}>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor] ring-2 ring-current/20" />
                {statusLabel(booking.status)}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-muted-foreground">
                <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/80" />
                {formatDate(booking.pickup_date)}
              </span>
            </div>
            <div className="mt-2">
              <p className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-background/35 px-2.5 py-1 text-[11px] text-muted-foreground">
                <Hash aria-hidden="true" className="size-3 shrink-0 text-primary/80" />
                <span className="truncate">Booking reference: {bookingReferenceForId(booking.id)}</span>
              </p>
            </div>
          </div>
          <Button className="relative shrink-0 border border-white/10 bg-white/5 hover:bg-white/10" variant="ghost" size="icon" onClick={onClose} aria-label="Close details"><X /></Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-x-5 gap-y-3 rounded-xl border p-3 text-sm sm:grid-cols-2 sm:p-4">
          <Detail label="Customer" value={`${booking.first_name} ${booking.last_name}`} icon={<UserRound />} />
          <Detail label="Email" value={display(booking.email)} icon={<Mail />} />
          <Detail label="Booking reference" value={bookingReferenceForId(booking.id)} />
          <Detail label="Mobile" value={display(booking.mobile)} />
          <Detail label="Event type" value={display(booking.event_type)} />
          <Detail label="Event address" value={display(booking.event_address)} />
          <Detail label="Pickup" value={`${formatDate(booking.pickup_date)} at ${formatTime(booking.pickup_time)}`} />
          <Detail label="Drop-off" value={`${formatDate(booking.dropoff_date)} at ${formatTime(booking.dropoff_time)}`} />
          {booking.photo_id_paths?.length ? (
            <div>
              <p className="text-xs text-muted-foreground">Photo ID</p>
              <div className="flex flex-wrap gap-2">
                {booking.photo_id_paths.map((path) => <Button key={path} variant="link" size="xs" className="h-6 px-1" onClick={() => void onPhoto(path)}>View ID <ExternalLink /></Button>)}
              </div>
            </div>
          ) : null}
          <label className="block min-w-0 space-y-1 sm:col-start-1 sm:row-start-5">
            <span className="block text-xs text-muted-foreground">Status</span>
            <span className="relative block w-full max-w-48">
              <select aria-label="Update booking status" value={booking.status} onChange={(event) => void onUpdate(booking.id, { status: event.target.value })} className="h-9 w-full max-w-48 appearance-none rounded-lg border bg-background px-3 pr-9 text-sm font-normal text-foreground shadow-sm">
                {statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </span>
          </label>
          <div className="min-w-0 sm:col-start-2 sm:row-start-5">
            <p className="text-xs text-muted-foreground">Additional details</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{booking.additional_details?.trim() || "-"}</p>
          </div>
        </div>
        <AdminHireItems key={`booking-hire-items-${booking.id}`} booking={booking} onChanged={(values) => onPaymentUpdated(booking.id, values)} onDirtyChange={setHireItemsDirty} />
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Internal notes</h3>
            <Button
              type="button"
              variant="link"
              size="xs"
              aria-label={notesOpen ? "Hide internal notes" : booking.internal_notes?.trim() ? "Edit internal notes" : "Add internal notes"}
              aria-expanded={notesOpen}
              aria-controls={`booking-internal-notes-${booking.id}`}
              onClick={() => setNotesOpen((current) => !current)}
              className="h-6 px-0"
            >
              {notesOpen ? "Hide notes" : booking.internal_notes?.trim() ? "Edit notes" : "Add notes"}
            </Button>
          </div>
          <div id={`booking-internal-notes-${booking.id}`} hidden={!notesOpen} className="space-y-2 rounded-xl border p-3">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full resize-y rounded-lg border bg-background p-3 text-sm" placeholder="Add a private note for the team…" />
            <Button size="sm" onClick={() => void onUpdate(booking.id, { internal_notes: notes })}>Save notes</Button>
          </div>
        </section>
        <CommunicationsSection booking={booking} onSendEmail={() => setEmailOpen(true)} />
        <AdminPaymentPanel key={`booking-payment-${booking.id}`} booking={booking} onChanged={(values) => onPaymentUpdated(booking.id, values)} hireItemsDirty={hireItemsDirty} />
        <Button variant="destructive" className="w-full" onClick={() => void onDelete(booking.id)}>Permanently delete booking</Button>
      </div>
      {emailOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="send-email-title" className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4">
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
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
   purchaseSummary: { purchaseCount: number; totalCostCents: number; gstPaidCents: number };
   purchases: Array<{ id: string; productName: string; date: string; quantity: number; totalCostCents: number; gstPaidCents: number; supplier: string; reference: string }>;
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
         <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Review hire GST and equipment purchase records for your business.</p>
       </div>
       {tool === "gst" ? <Button variant="outline" className="gap-2" onClick={() => void downloadReport()} disabled={!report || loading}><Download className="size-4" />Download CSV</Button> : null}
     </div>
     <div className="inline-flex rounded-lg border bg-card p-1" role="tablist" aria-label="Tax tools">
       <button type="button" role="tab" aria-selected={tool === "gst"} onClick={() => setTool("gst")} className={`rounded-md px-3 py-2 text-sm font-medium ${tool === "gst" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Calculating GST</button>
       <button type="button" role="tab" aria-selected={tool === "tax"} onClick={() => setTool("tax")} className={`rounded-md px-3 py-2 text-sm font-medium ${tool === "tax" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Tax</button>
     </div>
     {tool === "tax" ? <IncomeTaxCalculator /> : <><Card>
       <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
         <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>From</span><input aria-label="GST report from date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
         <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>To</span><input aria-label="GST report to date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground" /></label>
         <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"><span>Report basis</span><select aria-label="GST report basis" value={basis} onChange={(event) => setBasis(event.target.value as "paid" | "issued")} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground"><option value="paid">Payments received (cash basis)</option><option value="issued">Invoices issued (accrual basis)</option></select></label>
         <Button onClick={() => void runReport()} disabled={loading} className="gap-2"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />Run report</Button>
       </CardContent>
     </Card>
     <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary"><p className="font-medium">How these figures work</p><p className="mt-1 text-primary/80">Hire GST is calculated as 1/11 of GST-inclusive hire charges; refundable security deposits are excluded. Equipment purchase cost and GST are recorded as entered from receipts and shown by purchase date. These records do not determine GST-credit eligibility, deductions, or depreciation; confirm tax treatment with your registered tax agent.</p></div>
     {error ? <Card><CardContent className="p-8 text-center text-sm text-destructive">{error}</CardContent></Card> : loading && !report ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground"><RefreshCw className="mx-auto mb-3 size-6 animate-spin" />Preparing GST report…</CardContent></Card> : report ? <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">GST included</p><p className="mt-1 text-2xl font-semibold text-primary">{money(report.summary.gstIncludedCents)}</p><p className="mt-1 text-xs text-muted-foreground">Review for your BAS</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Taxable hire sales</p><p className="mt-1 text-2xl font-semibold">{money(report.summary.taxableSalesCents)}</p><p className="mt-1 text-xs text-muted-foreground">{report.summary.invoiceCount} invoice{report.summary.invoiceCount === 1 ? "" : "s"}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Refundable deposits</p><p className="mt-1 text-2xl font-semibold">{money(report.summary.securityDepositCents)}</p><p className="mt-1 text-xs text-muted-foreground">Excluded from GST</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Customer payments</p><p className="mt-1 text-2xl font-semibold">{money(report.summary.totalAmountCents)}</p><p className="mt-1 text-xs text-muted-foreground">Hire plus deposits</p></CardContent></Card></section><Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Hire</th><th className="px-4 py-3 text-right font-medium">GST included</th><th className="px-4 py-3 text-right font-medium">Deposit</th></tr></thead><tbody className="divide-y">{report.rows.map((row) => <tr key={row.invoiceNumber}><td className="px-4 py-3 font-medium">{row.invoiceNumber}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(row.date)}</td><td className="px-4 py-3 capitalize text-muted-foreground">{row.status}</td><td className="px-4 py-3 text-right">{money(row.taxableSalesCents)}</td><td className="px-4 py-3 text-right font-medium text-primary">{money(row.gstIncludedCents)}</td><td className="px-4 py-3 text-right text-muted-foreground">{money(row.securityDepositCents)}</td></tr>)}</tbody></table>{report.rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No invoices matched this date range and report basis.</p> : null}</CardContent></Card></> : null}
     {report && !error ? <section aria-labelledby="equipment-purchases-title" className="space-y-3">
       <div>
         <h2 id="equipment-purchases-title" className="text-xl font-semibold">Equipment purchases</h2>
         <p className="mt-1 text-sm text-muted-foreground">{report.purchaseSummary.purchaseCount} purchase{report.purchaseSummary.purchaseCount === 1 ? "" : "s"} recorded in this purchase-date range.</p>
       </div>
       <div className="grid gap-3 sm:grid-cols-2">
         <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Equipment purchase cost</p><p className="mt-1 text-2xl font-semibold">{money(report.purchaseSummary.totalCostCents)}</p><p className="mt-1 text-xs text-muted-foreground">Actual total paid recorded from receipts</p></CardContent></Card>
         <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">GST recorded on equipment purchases</p><p className="mt-1 text-2xl font-semibold text-primary">{money(report.purchaseSummary.gstPaidCents)}</p><p className="mt-1 text-xs text-muted-foreground">Receipt values; eligibility is not assessed</p></CardContent></Card>
       </div>
       <Card><CardContent className="overflow-x-auto p-0">
         {report.purchases.length ? <table className="w-full min-w-[700px] text-left text-sm">
           <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Purchase date</th><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 text-right font-medium">Quantity</th><th className="px-4 py-3 text-right font-medium">Total paid</th><th className="px-4 py-3 text-right font-medium">GST on receipt</th><th className="px-4 py-3 font-medium">Supplier / reference</th></tr></thead>
           <tbody className="divide-y">{report.purchases.map((purchase) => <tr key={purchase.id}><td className="px-4 py-3">{formatDate(purchase.date)}</td><td className="px-4 py-3 font-medium">{purchase.productName}</td><td className="px-4 py-3 text-right">{purchase.quantity}</td><td className="px-4 py-3 text-right">{money(purchase.totalCostCents)}</td><td className="px-4 py-3 text-right text-primary">{money(purchase.gstPaidCents)}</td><td className="px-4 py-3">{[purchase.supplier, purchase.reference].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody>
         </table> : <p className="p-8 text-center text-sm text-muted-foreground">No equipment purchases matched this purchase-date range.</p>}
       </CardContent></Card>
     </section> : null}
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

function Detail({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div className="min-w-0"><p className="flex items-center gap-1 text-xs text-muted-foreground">{icon ? <span className="inline-flex size-3 shrink-0 items-center justify-center [&>svg]:size-3">{icon}</span> : null}{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>; }
type EmailPreviewMessage = {
  id: string;
  subject: string;
  from: string;
  to: string[];
  created_at: string;
  html: string | null;
  text: string | null;
  attachments: Array<{ filename: string; content_type: string; size: number; url: string }>;
  attachmentsArchived: boolean | null;
};

function plainTextEmailHtml(text: string) {
  const escaped = text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px;color:#1d2823;font:15px/1.6 system-ui,sans-serif"><pre style="white-space:pre-wrap;font:inherit">${escaped}</pre></body></html>`;
}

function EmailHistoryPreview({ log, onBack }: { log: NonNullable<Booking["email_logs"]>[number]; onBack: () => void }) {
  const [email, setEmail] = useState<EmailPreviewMessage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadEmail() {
      try {
        const response = await fetch(`/api/admin/email-history?id=${encodeURIComponent(log.id)}`);
        const result = await response.json() as { email?: EmailPreviewMessage; error?: string };
        if (!response.ok || !result.email) throw new Error(result.error || "The sent email could not be loaded.");
        if (active) setEmail(result.email);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "The sent email could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadEmail();
    return () => { active = false; };
  }, [attempt, log.id]);

  return (
    <section aria-labelledby="email-preview-title" className="space-y-4">
      <Button variant="ghost" className="-ml-2 gap-1" onClick={onBack}><ChevronLeft className="size-4" />Back to email history</Button>
      <div>
        <p className="text-sm font-medium text-primary">{emailTypeLabel(log.email_type)}</p>
        <h3 id="email-preview-title" className="mt-1 text-xl font-semibold">Sent email</h3>
        <p className="mt-1 break-all text-sm text-muted-foreground">To {log.recipient_email} · {formatSentAt(log.sent_at)}</p>
      </div>
      {loading ? (
        <div role="status" className="rounded-xl border bg-muted/20 p-8 text-center text-sm text-muted-foreground">Loading sent email…</div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => {
            setEmail(null);
            setError("");
            setLoading(true);
            setAttempt((current) => current + 1);
          }}>Try again</Button>
        </div>
      ) : email ? (
        <>
          <div className="space-y-1 rounded-xl border bg-muted/20 p-4 text-sm">
            <p className="break-words"><span className="font-medium">Subject:</span> {email.subject}</p>
            <p className="break-words text-muted-foreground"><span className="font-medium">From:</span> {email.from}</p>
          </div>
          {email.html || email.text ? (
            <iframe
              title={`Rendered ${emailTypeLabel(log.email_type)} email`}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={email.html || plainTextEmailHtml(email.text ?? "")}
              className="h-[min(70vh,48rem)] w-full rounded-xl border bg-white"
            />
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">The email provider no longer has the body for this message.</div>
          )}
          {email.attachments.length ? (
            <section aria-labelledby="email-attachments-title" className="space-y-3">
              <h4 id="email-attachments-title" className="font-semibold">Attachments ({email.attachments.length})</h4>
              {email.attachments.map((attachment, index) => {
                const inlineUrl = `${attachment.url}&inline=true`;
                return (
                  <div key={`${attachment.filename}-${index}`} className="space-y-3 rounded-xl border p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium">{attachment.filename}</p>
                        <p className="text-xs text-muted-foreground">{formatAttachmentSize(attachment.size)}</p>
                      </div>
                      <a href={attachment.url} download={attachment.filename} className="inline-flex min-h-9 shrink-0 items-center rounded-lg border px-3 text-sm font-medium text-primary hover:bg-muted">Download</a>
                    </div>
                    {attachment.content_type === "application/pdf" ? (
                      <PdfAttachmentPreview url={inlineUrl} filename={attachment.filename} />
                    ) : attachment.content_type.startsWith("image/") ? (
                      <Image src={inlineUrl} alt={`Email attachment: ${attachment.filename}`} width={720} height={480} unoptimized className="max-h-[28rem] max-w-full rounded-lg border object-contain" />
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {email.attachmentsArchived === null
                ? "This email predates attachment archiving, so its original files are not available here."
                : email.attachmentsArchived
                  ? "No attachments were sent with this email."
                  : "The attachment copy could not be archived for this email."}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
