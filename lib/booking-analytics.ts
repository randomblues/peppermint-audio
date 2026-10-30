import { bookingStatuses, type BookingStatus } from "@/lib/admin-dashboard";
import { bookingReferenceForId } from "@/lib/booking-reference";
import { lineItemsForBooking, lineItemsTotalCents } from "@/lib/booking-line-items";
import { rentalDays } from "@/lib/payment-flow";

export type AnalyticsBooking = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  pickup_date: string;
  dropoff_date?: string;
  created_at?: string;
  email?: string;
  event_type: string;
  hire_amount_cents?: number | null;
  hire_line_items?: unknown;
  hire_payment_status?: string | null;
};

export type DateBasis = "pickup_date" | "created_at";
export type PaymentFilter = "all" | "paid" | "unpaid";
export type DatePreset = "all" | "month" | "last-month" | "year" | "financial-year";
export type BookingSort = "submitted-desc" | "submitted-asc" | "pickup-asc" | "pickup-desc";
export type AnalyticsFilters = {
  search: string;
  statuses: readonly BookingStatus[];
  from: string;
  to: string;
  dateBasis: DateBasis;
  payment: PaymentFilter;
  sort: BookingSort;
};

export const defaultAnalyticsFilters: AnalyticsFilters = {
  search: "", statuses: bookingStatuses, from: "", to: "",
  dateBasis: "pickup_date", payment: "all", sort: "submitted-desc",
};

export function melbourneDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function bookingDate(booking: AnalyticsBooking, basis: DateBasis) {
  if (basis === "pickup_date") return booking.pickup_date;
  if (!booking.created_at || !Number.isFinite(Date.parse(booking.created_at))) return "";
  return melbourneDate(new Date(booking.created_at));
}

export function datePresetRange(preset: DatePreset, today = melbourneDate()) {
  const [year, month] = today.split("-").map(Number);
  const endOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: endOfMonth(year, month) };
  if (preset === "last-month") {
    const date = new Date(Date.UTC(year, month - 2, 1));
    return { from: date.toISOString().slice(0, 10), to: endOfMonth(date.getUTCFullYear(), date.getUTCMonth() + 1) };
  }
  if (preset === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (preset === "financial-year") {
    const start = month >= 7 ? year : year - 1;
    return { from: `${start}-07-01`, to: `${start + 1}-06-30` };
  }
  return { from: "", to: "" };
}

export function isHirePaid(booking: AnalyticsBooking) {
  return ["paid", "succeeded", "captured", "bank_transfer_received"].includes(booking.hire_payment_status ?? "");
}

export function bookingHireValue(booking: AnalyticsBooking): number | null {
  if (typeof booking.hire_amount_cents === "number" && Number.isFinite(booking.hire_amount_cents) && booking.hire_amount_cents >= 0) {
    return booking.hire_amount_cents;
  }
  const items = lineItemsForBooking(booking);
  const days = rentalDays(booking.pickup_date, booking.dropoff_date ?? booking.pickup_date);
  return items.length && days !== null ? lineItemsTotalCents(items, days) : null;
}

export function analyseBookings<T extends AnalyticsBooking>(bookings: T[], filters: AnalyticsFilters) {
  const query = filters.search.trim().toLowerCase();
  return bookings.filter((booking) => {
    const date = bookingDate(booking, filters.dateBasis);
    return filters.statuses.some((status) => status === booking.status)
      && (!query || [booking.first_name, booking.last_name, `${booking.first_name} ${booking.last_name}`, booking.email, booking.event_type, bookingReferenceForId(booking.id)]
        .some((value) => value?.toLowerCase().includes(query)))
      && (!filters.from || date >= filters.from)
      && (!filters.to || Boolean(date) && date <= filters.to)
      && (filters.payment === "all" || (filters.payment === "paid" ? isHirePaid(booking) : !isHirePaid(booking)));
  }).sort((a, b) => {
    if (filters.sort === "submitted-desc" || filters.sort === "submitted-asc") {
      const first = Date.parse(a.created_at ?? "");
      const second = Date.parse(b.created_at ?? "");
      if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : a.id.localeCompare(b.id);
      if (!Number.isFinite(second)) return -1;
      const difference = filters.sort === "submitted-desc" ? second - first : first - second;
      return difference || a.id.localeCompare(b.id);
    }
    const difference = filters.sort === "pickup-desc"
      ? b.pickup_date.localeCompare(a.pickup_date)
      : a.pickup_date.localeCompare(b.pickup_date);
    return difference || a.id.localeCompare(b.id);
  });
}

export function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function bookingsCsv(bookings: AnalyticsBooking[]) {
  const rows = [
    ["Booking reference", "Customer", "Email", "Event", "Status", "Pickup", "Return", "Hire value AUD", "Hire payment status"],
    ...bookings.map((booking) => {
      const value = bookingHireValue(booking);
      return [
        bookingReferenceForId(booking.id), `${booking.first_name} ${booking.last_name}`, booking.email ?? "",
        booking.event_type, booking.status, booking.pickup_date, booking.dropoff_date ?? "",
        value === null ? "" : (value / 100).toFixed(2), booking.hire_payment_status ?? "unpaid",
      ];
    }),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
