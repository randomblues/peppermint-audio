export const MAX_STRIPE_HIRE_DAYS = 3;
const PAYMENT_LINK_VALIDITY_DAYS = 30;

export function depositHoldDate(pickupDate: string) {
  if (rentalDays(pickupDate, pickupDate) === null) throw new Error("Invalid pickup date.");
  return new Date(Date.parse(`${pickupDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

export function melbourneDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isMelbourneDateInFuture(value: string, now = new Date()) {
  return value > melbourneDateKey(now);
}

export function isImmediateDepositBooking(pickupDate: string, now = new Date()) {
  const today = melbourneDateKey(now);
  return pickupDate >= today && depositHoldDate(pickupDate) <= today;
}

export function paymentLinkExpiry(dropoffDate: string, now = Date.now()) {
  if (rentalDays(dropoffDate, dropoffDate) === null) throw new Error("Invalid return date.");
  return new Date(Math.max(now + PAYMENT_LINK_VALIDITY_DAYS * 86_400_000, Date.parse(`${dropoffDate}T00:00:00Z`) + 3 * 86_400_000)).toISOString();
}

export function depositHoldCoversReturn(captureBefore: number | null, dropoffDate: string, dropoffTime?: string | null) {
  if (rentalDays(dropoffDate, dropoffDate) === null || !captureBefore) return false;
  const time = dropoffTime || "23:59:59";
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return false;
  // +10 is conservative during daylight saving; allow another hour for check-in.
  const returnAt = Date.parse(`${dropoffDate}T${time}+10:00`);
  return Number.isFinite(returnAt) && captureBefore * 1000 > returnAt + 3_600_000;
}

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
