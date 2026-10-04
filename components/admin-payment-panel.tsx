"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, CreditCard, Landmark, Plus, Trash2, Unlock, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BankTransferOption } from "@/lib/bank-transfer";
import { catalogLineItemGroups, catalogLineItemOptions, customBookingLineItem, lineItemsForBooking, lineItemsTotalCents, type BookingLineItem } from "@/lib/booking-line-items";
import { canSwitchPendingBankTransfer, formatAudCents, MAX_STRIPE_HIRE_DAYS, paymentMethodForRental, rentalDays, type PaymentMethod } from "@/lib/payment-flow";

type PaymentBooking = {
  id: string;
  pickup_date: string;
  dropoff_date?: string;
  status: string;
  hire_amount_cents?: number | null;
  security_deposit_cents?: number | null;
  gst_inclusive?: boolean | null;
  payment_method?: string | null;
  hire_payment_status?: string | null;
  deposit_payment_status?: string | null;
  payment_token?: string | null;
  deposit_captured_cents?: number | null;
  invoice_number?: string | null;
  bank_transfer_option?: BankTransferOption | null;
  hire_line_items?: BookingLineItem[] | null;
};

function statusLabel(value: string | null | undefined) {
  return (value ?? "unpaid").replaceAll("_", " ");
}

export function AdminPaymentPanel({ booking, onChanged, collapsible = true }: { booking: PaymentBooking; onChanged: (values: Partial<PaymentBooking>) => void; collapsible?: boolean }) {
  const dropoffDate = booking.dropoff_date ?? booking.pickup_date;
  const days = rentalDays(booking.pickup_date, dropoffDate);
  const recommendedMethod = days === null ? null : paymentMethodForRental(booking.pickup_date, dropoffDate);
  const existingMethod = booking.payment_method === "stripe_card_hold" || booking.payment_method === "bank_transfer" || booking.payment_method === "cash_on_pickup" ? booking.payment_method : null;
  const paymentSettled = ["paid", "succeeded", "captured", "bank_transfer_received"].includes(booking.hire_payment_status ?? "")
    || ["authorized", "captured", "bank_transfer_received"].includes(booking.deposit_payment_status ?? "");
  const canSwitchPendingBank = canSwitchPendingBankTransfer(existingMethod, booking.hire_payment_status, booking.deposit_payment_status);
  const canSelectStripe = !paymentSettled && days !== null && days <= MAX_STRIPE_HIRE_DAYS
    && (!existingMethod || existingMethod === "stripe_card_hold" || canSwitchPendingBank);
  const canSelectBankTransfer = !paymentSettled && days !== null;
  const canEditLineItems = !paymentSettled;
  const initialLineItems = lineItemsForBooking(booking);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(existingMethod ?? recommendedMethod);
  const [bankTransferOption, setBankTransferOption] = useState<BankTransferOption>(booking.bank_transfer_option ?? "both");
  const [depositAmount, setDepositAmount] = useState(booking.security_deposit_cents ? String(booking.security_deposit_cents / 100) : "");
  const [gstInclusive, setGstInclusive] = useState(booking.gst_inclusive !== false);
  const [captureAmount, setCaptureAmount] = useState(booking.security_deposit_cents ? String(booking.security_deposit_cents / 100) : "");
  const [billToName, setBillToName] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [lineItems, setLineItems] = useState<BookingLineItem[]>(initialLineItems);
  const [savedLineItems, setSavedLineItems] = useState<BookingLineItem[]>(initialLineItems);
  const [catalogSelection, setCatalogSelection] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(true);

  const existingPaymentUrl = useMemo(() => paymentUrl || (booking.payment_token && typeof window !== "undefined" ? `${window.location.origin}/pay/${booking.payment_token}` : ""), [booking.payment_token, paymentUrl]);
  const hireTotalCents = lineItemsTotalCents(lineItems);
  const lineItemsChanged = JSON.stringify(lineItems) !== JSON.stringify(savedLineItems);
  const hirePaymentState = booking.payment_method === "cash_on_pickup" && booking.hire_payment_status === "cash_due"
    ? "Cash due on pickup"
    : ["paid", "succeeded", "bank_transfer_received"].includes(booking.hire_payment_status ?? "")
      ? "Paid"
      : ["pending", "bank_transfer_pending"].includes(booking.hire_payment_status ?? "")
        ? "Payment requested"
        : "Unpaid";
  const depositState = booking.deposit_payment_status === "authorized"
    ? "Deposit authorised"
    : booking.deposit_payment_status === "released"
      ? "Deposit released"
      : booking.deposit_payment_status === "captured"
        ? "Deposit captured"
        : booking.deposit_payment_status === "cash_due"
          ? "Deposit cash due on pickup"
          : booking.deposit_payment_status === "not_required" ? "No deposit required" : "Deposit not settled";

  async function submit(endpoint: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
    setError("");
    setMessage("");
    setProcessing(true);
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const raw = typeof response.text === "function"
        ? await response.text()
        : JSON.stringify(await response.json());
      let data: Record<string, unknown> = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          throw new Error(`Payment update failed (${response.status}): The server returned an invalid response.`);
        }
      }
      if (!raw.trim() && response.ok) {
        throw new Error("Payment update failed: The server returned an empty response.");
      }
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Payment update failed (HTTP ${response.status}).`);
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
    if (!lineItems.length) {
      setError("Add at least one priced hire item before creating an invoice.");
      return;
    }
    if (existingMethod) {
      const data = await submit("/api/admin/payments/update-booking", {
        bookingId: booking.id,
        paymentMethod: selectedMethod,
        hireLineItems: lineItems,
        securityDepositAmount: depositAmount || "0",
        gstInclusive,
        ...(selectedMethod === "bank_transfer" ? { bankTransferOption } : {}),
        ...(billToName.trim() ? { billToName: billToName.trim() } : {}),
        ...(billToEmail.trim() ? { billToEmail: billToEmail.trim() } : {}),
      });
      if (!data) return;
      setSavedLineItems(lineItems);
      if (typeof data.paymentUrl === "string") setPaymentUrl(data.paymentUrl);
      onChanged({
        hire_line_items: lineItems,
        hire_amount_cents: hireTotalCents,
        security_deposit_cents: typeof data.securityDepositCents === "number" ? data.securityDepositCents : Math.round(Number(depositAmount || "0") * 100),
        gst_inclusive: gstInclusive,
        payment_method: selectedMethod,
        bank_transfer_option: selectedMethod === "bank_transfer" ? bankTransferOption : null,
        payment_token: typeof data.paymentUrl === "string" ? data.paymentUrl.split("/").pop() : null,
        hire_payment_status: selectedMethod === "bank_transfer" ? "bank_transfer_pending" : selectedMethod === "cash_on_pickup" ? "cash_due" : "pending",
        deposit_payment_status: selectedMethod === "bank_transfer" ? (Number(depositAmount || "0") > 0 ? "bank_transfer_pending" : "not_required") : selectedMethod === "cash_on_pickup" ? (Number(depositAmount || "0") > 0 ? "cash_due" : "not_required") : (Number(depositAmount || "0") > 0 ? "pending" : "not_required"),
      });
      setMessage(`Invoice sent using the current booking details and reference ${String(data.reference)}.`);
      return;
    }
    if (lineItemsChanged) {
      const saved = await submit("/api/admin/bookings", { id: booking.id, hire_line_items: lineItems }, "PATCH");
      if (!saved) return;
      setSavedLineItems(lineItems);
      onChanged({ hire_line_items: lineItems, hire_amount_cents: hireTotalCents });
    }
    const endpoint = selectedMethod === "stripe_card_hold" ? "/api/admin/payments/create-checkout" : "/api/admin/payments/bank-transfer";
    const data = await submit(endpoint, {
      bookingId: booking.id,
      ...(selectedMethod === "cash_on_pickup" ? { paymentMethod: "cash_on_pickup" } : {}),
      securityDepositAmount: depositAmount || "0",
      gstInclusive,
      ...(selectedMethod === "bank_transfer" ? { bankTransferOption } : {}),
      ...(billToName.trim() ? { billToName: billToName.trim() } : {}),
      ...(billToEmail.trim() ? { billToEmail: billToEmail.trim() } : {}),
    });
    if (!data) return;
    if (typeof data.paymentUrl === "string") setPaymentUrl(data.paymentUrl);
    const updatedPayment = {
      hire_amount_cents: hireTotalCents,
      security_deposit_cents: typeof data.securityDepositCents === "number" ? data.securityDepositCents : Math.round(Number(depositAmount || "0") * 100),
      gst_inclusive: gstInclusive,
      payment_method: selectedMethod,
      bank_transfer_option: selectedMethod === "bank_transfer" ? bankTransferOption : booking.bank_transfer_option,
      payment_token: typeof data.paymentToken === "string" ? data.paymentToken : booking.payment_token,
      hire_payment_status: selectedMethod === "bank_transfer" ? "bank_transfer_pending" : selectedMethod === "cash_on_pickup" ? "cash_due" : "pending",
      deposit_payment_status: selectedMethod === "bank_transfer" ? (Number(depositAmount || "0") > 0 ? "bank_transfer_pending" : "not_required") : selectedMethod === "cash_on_pickup" ? (Number(depositAmount || "0") > 0 ? "cash_due" : "not_required") : (Number(depositAmount || "0") > 0 ? "pending" : "not_required"),
    };
    onChanged(updatedPayment);
    setMessage(selectedMethod === "bank_transfer" ? `Bank transfer recorded. Reference: ${String(data.reference)}` : selectedMethod === "cash_on_pickup" ? `Cash-on-pickup invoice sent. Reference: ${String(data.reference)}` : "One payment link created for the hire and deposit authorisation.");
  }

  async function saveLineItems() {
    if (!lineItems.length) {
      setError("Add at least one priced hire item before saving.");
      return;
    }
    const saved = await submit("/api/admin/payments/update-booking", {
      bookingId: booking.id,
      hireLineItems: lineItems,
      saveOnly: true,
    });
    if (!saved) return;
    setSavedLineItems(lineItems);
    onChanged({ hire_line_items: lineItems, hire_amount_cents: hireTotalCents });
    setMessage("Hire items saved to this booking. Send the invoice when you are ready.");
  }

  function addCatalogItem() {
    const option = catalogLineItemOptions().find((entry) => entry.key === catalogSelection);
    if (!option) return;
    setLineItems((current) => {
      const existing = current.find((item) => item.id === option.item.id);
      return existing
        ? current.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, option.item];
    });
    setCatalogSelection("");
  }

  function addCustomItem() {
    const cents = Number.parseFloat(customPrice);
    if (!customName.trim() || !Number.isFinite(cents) || cents < 0) {
      setError("Enter a custom item name and a valid hire price.");
      return;
    }
    setLineItems((current) => [...current, customBookingLineItem(customName, Math.round(cents * 100))]);
    setCustomName("");
    setCustomPrice("");
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

  async function sendExistingInvoice() {
    const data = await submit("/api/admin/payments/send-invoice", {
      bookingId: booking.id,
      ...(selectedMethod === "bank_transfer" ? { bankTransferOption } : {}),
      ...(billToName.trim() ? { billToName: billToName.trim() } : {}),
      ...(billToEmail.trim() ? { billToEmail: billToEmail.trim() } : {}),
    });
    if (data) setMessage("Invoice sent using the current booking details.");
  }

  async function sendInvoice() {
    if (paymentSettled && booking.payment_method) {
      await sendExistingInvoice();
      return;
    }
    await createPayment();
  }

  async function copyLink() {
    if (!existingPaymentUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(existingPaymentUrl);
    setMessage("Payment link copied.");
  }

  return (
    <Card>
      {collapsible ? <CardHeader className="p-0"><button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5" aria-expanded={paymentOpen} onClick={() => setPaymentOpen((open) => !open)}><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4 text-primary" />Payment collection</CardTitle><ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${paymentOpen ? "rotate-180" : ""}`} /></button></CardHeader> : null}
      {(!collapsible || paymentOpen) ? <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">{selectedMethod === "bank_transfer" ? <Landmark className="size-4" /> : selectedMethod === "cash_on_pickup" ? <WalletCards className="size-4" /> : <CreditCard className="size-4" />}{days === null ? "Check booking dates" : selectedMethod === "bank_transfer" ? `Bank transfer · ${days} hire days` : selectedMethod === "cash_on_pickup" ? "Cash on pickup" : `Stripe card hold · ${days} hire day${days === 1 ? "" : "s"}`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{selectedMethod === "bank_transfer" ? "Bank transfer is available for any hire length and does not create Stripe payments." : selectedMethod === "cash_on_pickup" ? "The invoice will state that hire and deposit payment are due in cash on the day of pickup. You can confirm the booking immediately." : "One card form creates a captured hire payment and a separate uncaptured deposit authorisation. Create it close to return because card holds can expire after about seven days."}</p>
        </div>
        <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hire payment</p><p className="mt-1 font-semibold">{hirePaymentState}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Security deposit</p><p className="mt-1 font-semibold">{depositState}</p></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {booking.payment_method === "cash_on_pickup"
              ? "Confirmation is allowed once this booking is explicitly marked Cash on pickup; that does not mean the cash has already been received."
              : ["paid", "succeeded", "bank_transfer_received"].includes(booking.hire_payment_status ?? "")
                ? "The hire payment is received. You can confirm after checking availability."
                : "The booking cannot be confirmed until the hire payment is received, unless Cash on pickup is selected."}
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Payment method</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${selectedMethod === "stripe_card_hold" ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name={`payment-method-${booking.id}`} value="stripe_card_hold" checked={selectedMethod === "stripe_card_hold"} disabled={!canSelectStripe} onChange={() => setSelectedMethod("stripe_card_hold")} className="mt-1" />
              <span><span className="block font-medium">Stripe card hold</span><span className="block text-xs text-muted-foreground">Available for hires of 7 days or less.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${selectedMethod === "cash_on_pickup" ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name={`payment-method-${booking.id}`} value="cash_on_pickup" checked={selectedMethod === "cash_on_pickup"} disabled={!canSelectBankTransfer} onChange={() => setSelectedMethod("cash_on_pickup")} className="mt-1" />
              <span><span className="block font-medium">Cash on pickup</span><span className="block text-xs text-muted-foreground">Pay hire and deposit in cash on pickup.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${selectedMethod === "bank_transfer" ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name={`payment-method-${booking.id}`} value="bank_transfer" checked={selectedMethod === "bank_transfer"} disabled={!canSelectBankTransfer} onChange={() => setSelectedMethod("bank_transfer")} className="mt-1" />
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
        <section className="space-y-3 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Hire items</h3>
              <p className="mt-1 text-xs text-muted-foreground">Hire total is calculated from these items. {canEditLineItems ? "You can edit these items until the booking is paid." : "This booking is paid or its deposit is active, so additional items need a separate booking."}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold">{formatAudCents(hireTotalCents)}</span>
          </div>
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-lg bg-muted/40 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.option ? <p className="text-xs text-muted-foreground">{item.option}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatAudCents(item.unitPriceCents)} each</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="outline" aria-label={`Decrease ${item.name} quantity`} disabled={!canEditLineItems || item.quantity <= 1} onClick={() => setLineItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry))}>−</Button>
                  <span className="w-7 text-center text-sm">{item.quantity}</span>
                  <Button type="button" size="sm" variant="outline" aria-label={`Increase ${item.name} quantity`} disabled={!canEditLineItems || item.quantity >= 100} onClick={() => setLineItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry))}>+</Button>
                </div>
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${item.name}`} disabled={!canEditLineItems} onClick={() => setLineItems((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
          {canEditLineItems ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select aria-label="Add catalogue item" value={catalogSelection} onChange={(event) => setCatalogSelection(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm">
                <option value="">Add a package or product...</option>
                {catalogLineItemGroups().map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => <option key={option.key} value={option.key}>{option.label} · {option.detail} · {formatAudCents(option.item.unitPriceCents)}</option>)}
                  </optgroup>
                ))}
              </select>
              <Button type="button" variant="outline" disabled={!catalogSelection} onClick={addCatalogItem}><Plus className="size-4" />Add item</Button>
            </div>
          ) : null}
          {canEditLineItems ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
              <input aria-label="Custom item name" value={customName} onChange={(event) => setCustomName(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm" placeholder="Custom item name" />
              <input aria-label="Custom item hire price" inputMode="decimal" value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm" placeholder="Hire price" />
              <Button type="button" variant="outline" onClick={addCustomItem}><Plus className="size-4" />Add custom</Button>
            </div>
          ) : null}
          {canEditLineItems && lineItemsChanged ? <div className="flex justify-start border-t pt-4"><Button type="button" className="min-w-40" onClick={() => void saveLineItems()} disabled={processing}>Save</Button></div> : null}
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-3 text-sm"><p className="font-medium">Calculated hire total</p><p className="mt-1 text-lg font-semibold">{formatAudCents(hireTotalCents)}</p></div>
          <label className="space-y-1 text-sm font-medium">Security deposit (AUD)<input aria-label="Security deposit amount" inputMode="decimal" value={depositAmount} onChange={(event) => { setDepositAmount(event.target.value); setCaptureAmount(event.target.value); }} className="h-10 w-full rounded-lg border bg-background px-3 font-normal" placeholder="100.00" /></label>
        </div>
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Alternative Bill to details <span className="font-normal text-muted-foreground">(optional)</span></summary>
          <p className="mt-2 text-xs text-muted-foreground">Leave blank to use the booking contact. These details apply only to this payment request.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Bill to name<input aria-label="Bill to name" value={billToName} onChange={(event) => setBillToName(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 font-normal" placeholder="Company or alternate customer name" maxLength={200} /></label>
            <label className="space-y-1 text-sm font-medium">Bill to email<input aria-label="Bill to email" type="email" inputMode="email" value={billToEmail} onChange={(event) => setBillToEmail(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 font-normal" placeholder="accounts@example.com" maxLength={254} /></label>
          </div>
        </details>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <input aria-label="GST-inclusive hire cost" type="checkbox" checked={gstInclusive} onChange={(event) => setGstInclusive(event.target.checked)} className="mt-1 size-4 accent-primary" />
          <span><span className="block font-medium">GST-inclusive hire cost</span><span className="block text-xs text-muted-foreground">Keep ticked for standard hires. The invoice will show the GST component included in the hire amount.</span></span>
        </label>
        <Button onClick={() => void sendInvoice()} disabled={processing || !["submitted", "confirmed"].includes(booking.status) || !selectedMethod || !hireTotalCents}>Send invoice</Button>
        {existingPaymentUrl ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Customer payment link</p><p className="mt-1 break-all text-xs text-muted-foreground">{existingPaymentUrl}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copyLink()}><Copy className="size-3.5" />Copy link</Button><a href={existingPaymentUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted">Open link</a></div></div> : null}
        {booking.hire_payment_status && booking.hire_payment_status !== "unpaid" ? <p className="text-sm"><span className="font-medium">Hire payment:</span> {statusLabel(booking.hire_payment_status)}</p> : null}
        {booking.deposit_payment_status && booking.deposit_payment_status !== "not_required" ? <p className="text-sm"><span className="font-medium">Security deposit:</span> {statusLabel(booking.deposit_payment_status)}{booking.deposit_captured_cents ? ` · ${formatAudCents(booking.deposit_captured_cents)} captured` : ""}</p> : null}
        {booking.deposit_payment_status === "authorized" ? <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 className="size-4" />Deposit is authorised, not captured</p><label className="space-y-1 text-sm font-medium">Damage amount to capture (AUD)<input aria-label="Damage amount to capture" inputMode="decimal" value={captureAmount} onChange={(event) => setCaptureAmount(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 font-normal" /></label><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={processing} onClick={() => void manageDeposit("release")}><Unlock className="size-3.5" />Release deposit</Button><Button size="sm" variant="destructive" disabled={processing} onClick={() => void manageDeposit("capture")}>Capture damage amount</Button></div></div> : null}
        {booking.payment_method === "bank_transfer" && booking.hire_payment_status === "bank_transfer_pending" ? <Button onClick={() => void markBankTransfer("bank_transfer_received")} disabled={processing}>Mark bank transfer received</Button> : null}
        {booking.payment_method === "bank_transfer" && booking.deposit_payment_status === "bank_transfer_received" ? <Button variant="outline" onClick={() => void markBankTransfer("bank_transfer_deposit_refunded")} disabled={processing}>Mark deposit refunded</Button> : null}
        {error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</p> : null}
      </CardContent> : null}
    </Card>
  );
}
