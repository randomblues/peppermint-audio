"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, CreditCard, Landmark, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BankTransferOption } from "@/lib/bank-transfer";
import { formatAudCents, MAX_STRIPE_HIRE_DAYS, paymentMethodForRental, rentalDays, type PaymentMethod } from "@/lib/payment-flow";

type PaymentBooking = {
  id: string;
  pickup_date: string;
  dropoff_date?: string;
  status: string;
  hire_amount_cents?: number | null;
  security_deposit_cents?: number | null;
  payment_method?: string | null;
  hire_payment_status?: string | null;
  deposit_payment_status?: string | null;
  payment_token?: string | null;
  deposit_captured_cents?: number | null;
  invoice_number?: string | null;
  bank_transfer_option?: BankTransferOption | null;
};

function statusLabel(value: string | null | undefined) {
  return (value ?? "unpaid").replaceAll("_", " ");
}

export function AdminPaymentPanel({ booking, onChanged }: { booking: PaymentBooking; onChanged: (values: Partial<PaymentBooking>) => void }) {
  const dropoffDate = booking.dropoff_date ?? booking.pickup_date;
  const days = rentalDays(booking.pickup_date, dropoffDate);
  const recommendedMethod = days === null ? null : paymentMethodForRental(booking.pickup_date, dropoffDate);
  const existingMethod = booking.payment_method === "stripe_card_hold" || booking.payment_method === "bank_transfer" ? booking.payment_method : null;
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(existingMethod ?? recommendedMethod);
  const [bankTransferOption, setBankTransferOption] = useState<BankTransferOption>(booking.bank_transfer_option ?? "both");
  const [hireAmount, setHireAmount] = useState(booking.hire_amount_cents ? String(booking.hire_amount_cents / 100) : "");
  const [depositAmount, setDepositAmount] = useState(booking.security_deposit_cents ? String(booking.security_deposit_cents / 100) : "");
  const [captureAmount, setCaptureAmount] = useState(booking.security_deposit_cents ? String(booking.security_deposit_cents / 100) : "");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  const existingPaymentUrl = useMemo(() => paymentUrl || (booking.payment_token && typeof window !== "undefined" ? `${window.location.origin}/pay/${booking.payment_token}` : ""), [booking.payment_token, paymentUrl]);

  async function submit(endpoint: string, body: Record<string, unknown>) {
    setError("");
    setMessage("");
    setProcessing(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Payment update failed.");
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment update failed.");
      return null;
    } finally {
      setProcessing(false);
    }
  }

  async function createPayment() {
    if (!selectedMethod) return;
    const endpoint = selectedMethod === "bank_transfer" ? "/api/admin/payments/bank-transfer" : "/api/admin/payments/create-checkout";
    const data = await submit(endpoint, {
      bookingId: booking.id,
      hireAmount,
      securityDepositAmount: depositAmount || "0",
      ...(selectedMethod === "bank_transfer" ? { bankTransferOption } : {}),
    });
    if (!data) return;
    if (typeof data.paymentUrl === "string") setPaymentUrl(data.paymentUrl);
    onChanged({
      hire_amount_cents: typeof data.hireAmountCents === "number" ? data.hireAmountCents : Math.round(Number(hireAmount) * 100),
      security_deposit_cents: typeof data.securityDepositCents === "number" ? data.securityDepositCents : Math.round(Number(depositAmount || "0") * 100),
      payment_method: selectedMethod,
      bank_transfer_option: selectedMethod === "bank_transfer" ? bankTransferOption : booking.bank_transfer_option,
      payment_token: typeof data.paymentToken === "string" ? data.paymentToken : booking.payment_token,
      hire_payment_status: selectedMethod === "bank_transfer" ? "bank_transfer_pending" : "pending",
      deposit_payment_status: selectedMethod === "bank_transfer" ? (Number(depositAmount || "0") > 0 ? "bank_transfer_pending" : "not_required") : (Number(depositAmount || "0") > 0 ? "pending" : "not_required"),
    });
    setMessage(selectedMethod === "bank_transfer" ? `Bank transfer recorded. Reference: ${String(data.reference)}` : "One payment link created for the hire and deposit authorisation.");
  }

  async function manageDeposit(action: "release" | "capture") {
    const data = await submit("/api/admin/payments/manage-deposit", { bookingId: booking.id, action, amount: captureAmount });
    if (!data) return;
    onChanged({
      deposit_payment_status: action === "release" ? "released" : "captured",
      deposit_captured_cents: action === "capture" ? Math.round(Number(captureAmount) * 100) : booking.deposit_captured_cents,
    });
    setMessage(action === "release" ? "Security-deposit authorisation released." : "Security-deposit amount captured.");
  }

  async function markBankTransfer(action: "bank_transfer_received" | "bank_transfer_deposit_refunded") {
    const data = await submit("/api/admin/payments/manage-deposit", { bookingId: booking.id, action });
    if (!data) return;
    onChanged({
      hire_payment_status: action === "bank_transfer_received" ? "bank_transfer_received" : booking.hire_payment_status,
      deposit_payment_status: action === "bank_transfer_received" ? (Number(depositAmount || "0") > 0 ? "bank_transfer_received" : "not_required") : "bank_transfer_refunded",
    });
    setMessage(action === "bank_transfer_received" ? "Bank transfer marked received and receipt emailed." : "Bank-transfer deposit marked refunded.");
  }

  async function resendInvoice() {
    const data = await submit("/api/admin/payments/send-invoice", {
      bookingId: booking.id,
      ...(selectedMethod === "bank_transfer" ? { bankTransferOption } : {}),
    });
    if (data) setMessage("Invoice emailed again.");
  }

  async function copyLink() {
    if (!existingPaymentUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(existingPaymentUrl);
    setMessage("Payment link copied.");
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4 text-primary" />Payment collection</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">{selectedMethod === "bank_transfer" ? <Landmark className="size-4" /> : <CreditCard className="size-4" />}{days === null ? "Check booking dates" : selectedMethod === "bank_transfer" ? `Bank transfer · ${days} hire days` : `Stripe card hold · ${days} hire day${days === 1 ? "" : "s"}`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{selectedMethod === "bank_transfer" ? "Bank transfer is available for any hire length and does not create Stripe payments." : "One card form creates a captured hire payment and a separate uncaptured deposit authorisation. Create it close to return because card holds can expire after about seven days."}</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Payment method</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${selectedMethod === "stripe_card_hold" ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name={`payment-method-${booking.id}`} value="stripe_card_hold" checked={selectedMethod === "stripe_card_hold"} disabled={days === null || (days > MAX_STRIPE_HIRE_DAYS) || Boolean(existingMethod && existingMethod !== "stripe_card_hold")} onChange={() => setSelectedMethod("stripe_card_hold")} className="mt-1" />
              <span><span className="block font-medium">Stripe card hold</span><span className="block text-xs text-muted-foreground">Available for hires of 7 days or less.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${selectedMethod === "bank_transfer" ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name={`payment-method-${booking.id}`} value="bank_transfer" checked={selectedMethod === "bank_transfer"} disabled={days === null || Boolean(existingMethod && existingMethod !== "bank_transfer")} onChange={() => setSelectedMethod("bank_transfer")} className="mt-1" />
              <span><span className="block font-medium">Bank transfer</span><span className="block text-xs text-muted-foreground">Available for any hire length.</span></span>
            </label>
          </div>
        </fieldset>
        {selectedMethod === "bank_transfer" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Bank-transfer instructions to send</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ["payid", "PayID only"],
                ["bank_account", "BSB/account only"],
                ["both", "PayID and BSB/account"],
              ] as const).map(([value, label]) => (
                <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${bankTransferOption === value ? "border-primary bg-primary/5" : ""}`}>
                  <input type="radio" name={`bank-transfer-option-${booking.id}`} value={value} checked={bankTransferOption === value} onChange={() => setBankTransferOption(value)} className="mt-1" />
                  <span className="font-medium">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Hire amount (AUD)<input aria-label="Hire amount" inputMode="decimal" value={hireAmount} onChange={(event) => setHireAmount(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 font-normal" placeholder="100.00" /></label>
          <label className="space-y-1 text-sm font-medium">Security deposit (AUD)<input aria-label="Security deposit amount" inputMode="decimal" value={depositAmount} onChange={(event) => { setDepositAmount(event.target.value); setCaptureAmount(event.target.value); }} className="h-10 w-full rounded-lg border bg-background px-3 font-normal" placeholder="100.00" /></label>
        </div>
        <Button onClick={() => void createPayment()} disabled={processing || booking.status !== "confirmed" || !selectedMethod || !hireAmount}>{selectedMethod === "bank_transfer" ? "Create bank-transfer invoice" : "Create payment link"}</Button>
        {booking.payment_method ? <Button variant="outline" onClick={() => void resendInvoice()} disabled={processing}>Send invoice again</Button> : null}
        {existingPaymentUrl ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Customer payment link</p><p className="mt-1 break-all text-xs text-muted-foreground">{existingPaymentUrl}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copyLink()}><Copy className="size-3.5" />Copy link</Button><a href={existingPaymentUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted">Open link</a></div></div> : null}
        {booking.hire_payment_status && booking.hire_payment_status !== "unpaid" ? <p className="text-sm"><span className="font-medium">Hire payment:</span> {statusLabel(booking.hire_payment_status)}</p> : null}
        {booking.deposit_payment_status && booking.deposit_payment_status !== "not_required" ? <p className="text-sm"><span className="font-medium">Security deposit:</span> {statusLabel(booking.deposit_payment_status)}{booking.deposit_captured_cents ? ` · ${formatAudCents(booking.deposit_captured_cents)} captured` : ""}</p> : null}
        {booking.deposit_payment_status === "authorized" ? <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 className="size-4" />Deposit is authorised, not captured</p><label className="space-y-1 text-sm font-medium">Damage amount to capture (AUD)<input aria-label="Damage amount to capture" inputMode="decimal" value={captureAmount} onChange={(event) => setCaptureAmount(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 font-normal" /></label><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={processing} onClick={() => void manageDeposit("release")}><Unlock className="size-3.5" />Release deposit</Button><Button size="sm" variant="destructive" disabled={processing} onClick={() => void manageDeposit("capture")}>Capture damage amount</Button></div></div> : null}
        {booking.payment_method === "bank_transfer" && booking.hire_payment_status === "bank_transfer_pending" ? <Button onClick={() => void markBankTransfer("bank_transfer_received")} disabled={processing}>Mark bank transfer received</Button> : null}
        {booking.payment_method === "bank_transfer" && booking.deposit_payment_status === "bank_transfer_received" ? <Button variant="outline" onClick={() => void markBankTransfer("bank_transfer_deposit_refunded")} disabled={processing}>Mark deposit refunded</Button> : null}
        {error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
