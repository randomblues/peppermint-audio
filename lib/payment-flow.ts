export const MAX_STRIPE_HIRE_DAYS = 7;
export const PAYMENT_LINK_VALIDITY_DAYS = 30;

export type PaymentMethod = "stripe_card_hold" | "bank_transfer" | "cash_on_pickup";

export function canSwitchPendingBankTransfer(paymentMethod: string | null | undefined, hirePaymentStatus: string | null | undefined, depositPaymentStatus: string | null | undefined) {
  return paymentMethod === "bank_transfer"
    && hirePaymentStatus === "bank_transfer_pending"
    && depositPaymentStatus !== "bank_transfer_received"
    && depositPaymentStatus !== "bank_transfer_refunded";
}

function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  const timestamp = Date.UTC(year, month - 1, day);
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : Number.NaN;
}

export function rentalDays(pickupDate: string, dropoffDate: string) {
  const pickup = dateValue(pickupDate);
  const dropoff = dateValue(dropoffDate);
  if (!Number.isFinite(pickup) || !Number.isFinite(dropoff) || dropoff < pickup) return null;
  return Math.max(1, Math.round((dropoff - pickup) / 86_400_000));
}

export function paymentMethodForRental(pickupDate: string, dropoffDate: string): PaymentMethod | null {
  const days = rentalDays(pickupDate, dropoffDate);
  if (days === null) return null;
  return days <= MAX_STRIPE_HIRE_DAYS ? "stripe_card_hold" : "bank_transfer";
}

export function parseAmountCents(value: unknown) {
  const text = typeof value === "number" ? String(value) : String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatAudCents(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "Not set";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}
