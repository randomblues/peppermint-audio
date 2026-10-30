import { bookingHireValue, bookingDate, csvCell, melbourneDate, type AnalyticsBooking } from "@/lib/booking-analytics";
import { lineItemHireTotalCents, lineItemsForBooking } from "@/lib/booking-line-items";
import { rentalDays } from "@/lib/payment-flow";

export type ReportPeriod = { from: string; to: string };
export type ReportPreset = "30-days" | "90-days" | "12-months" | "year" | "financial-year" | "custom";
export type Contribution = { name: string; category: "package" | "equipment" | "other"; hires: number; quantity: number; value: number };
const dayMs = 86_400_000;

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shiftDate(value: string, days: number) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
}

export function performancePeriod(preset: Exclude<ReportPreset, "custom">, today = melbourneDate()): ReportPeriod {
  const [year, month] = today.split("-").map(Number);
  if (preset === "30-days" || preset === "90-days") return { from: shiftDate(today, preset === "30-days" ? -29 : -89), to: today };
  if (preset === "year") return { from: `${year}-01-01`, to: today };
  if (preset === "financial-year") return { from: `${month >= 7 ? year : year - 1}-07-01`, to: today };
  return { from: new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10), to: today };
}

export function periodError(period: ReportPeriod, today = melbourneDate()) {
  if (!validDate(period.from) || !validDate(period.to)) return "Choose a valid start and end date.";
  if (period.from > period.to) return "The end date must be on or after the start date.";
  if (period.to > today) return "Historical reports cannot include future dates.";
  return "";
}

export function previousPeriod(period: ReportPeriod): ReportPeriod {
  const days = Math.round((Date.parse(period.to) - Date.parse(period.from)) / dayMs) + 1;
  return { from: shiftDate(period.from, -days), to: shiftDate(period.from, -1) };
}

function completionDate(booking: AnalyticsBooking) {
  const date = booking.dropoff_date || booking.pickup_date;
  return validDate(date) ? date : "";
}

function inPeriod(date: string, period: ReportPeriod) {
  return Boolean(date && date >= period.from && date <= period.to);
}

function median(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null;
}

function completedSummary(bookings: AnalyticsBooking[]) {
  const priced = bookings.flatMap((booking) => {
    const value = bookingHireValue(booking);
    return value === null ? [] : [{ booking, value }];
  });
  const sales = priced.reduce((sum, entry) => sum + entry.value, 0);
  return {
    hires: bookings.length,
    sales: bookings.length && !priced.length ? null : sales,
    average: priced.length ? Math.round(sales / priced.length) : null,
    priced: priced.length, unpriced: bookings.length - priced.length,
    unpaid: priced.filter(({ booking }) => !["paid", "succeeded", "captured", "bank_transfer_received"].includes(booking.hire_payment_status ?? ""))
      .reduce((sum, entry) => sum + entry.value, 0),
  };
}

export function performanceChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return { text: "Not enough data", direction: "neutral" as const };
  if (previous === 0) return { text: current === 0 ? "No change" : "New this period", direction: current > 0 ? "up" as const : "neutral" as const };
  const percent = Math.round((current - previous) / previous * 100);
  return { text: `${percent > 0 ? "+" : ""}${percent}%`, direction: percent > 0 ? "up" as const : percent < 0 ? "down" as const : "neutral" as const };
}

export function rentalPerformance(bookings: AnalyticsBooking[], period: ReportPeriod, today = melbourneDate()) {
  const error = periodError(period, today);
  if (error) throw new Error(error);
  const previous = previousPeriod(period);
  const completed = bookings.filter((booking) => booking.status === "completed" && inPeriod(completionDate(booking), period));
  const priorCompleted = bookings.filter((booking) => booking.status === "completed" && inPeriod(completionDate(booking), previous));
  const current = completedSummary(completed);
  const prior = completedSummary(priorCompleted);
  const requests = bookings.filter((booking) => inPeriod(bookingDate(booking, "created_at"), period));
  const priorRequests = bookings.filter((booking) => inPeriod(bookingDate(booking, "created_at"), previous));
  const outcomes = [
    { name: "Accepted", count: requests.filter((booking) => ["confirmed", "completed"].includes(booking.status)).length },
    { name: "Awaiting decision", count: requests.filter((booking) => booking.status === "submitted").length },
    { name: "Cancelled", count: requests.filter((booking) => booking.status === "cancelled").length },
  ];
  const knownEmails = new Map<string, string>();
  for (const booking of bookings) {
    const date = completionDate(booking);
    const email = booking.email?.trim().toLowerCase();
    if (booking.status !== "completed" || !date || !email || date > today) continue;
    const first = knownEmails.get(email);
    if (!first || date < first) knownEmails.set(email, date);
  }
  const identifiable = completed.filter((booking) => booking.email?.trim());
  const repeat = identifiable.filter((booking) => {
    const first = knownEmails.get(booking.email!.trim().toLowerCase());
    return first && first < completionDate(booking);
  }).length;

  const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekdays = weekdayNames.map((name) => ({ name, count: 0 }));
  const nights: number[] = [];
  const notice: number[] = [];
  const products = new Map<string, Contribution & { bookingIds: Set<string> }>();
  const occasions = new Map<string, { name: string; hires: number; value: number; priced: number }>();
  for (const booking of completed) {
    const value = bookingHireValue(booking);
    const occasion = booking.event_type.trim() || "Unspecified";
    const event = occasions.get(occasion.toLowerCase()) ?? { name: occasion, hires: 0, value: 0, priced: 0 };
    event.hires += 1;
    event.value += value ?? 0;
    if (value !== null) event.priced += 1;
    occasions.set(occasion.toLowerCase(), event);
    if (validDate(booking.pickup_date)) {
      const weekday = (new Date(`${booking.pickup_date}T00:00:00Z`).getUTCDay() + 6) % 7;
      weekdays[weekday].count += 1;
      const days = rentalDays(booking.pickup_date, booking.dropoff_date ?? booking.pickup_date);
      if (days !== null) nights.push(days);
      const received = bookingDate(booking, "created_at");
      if (received && received <= booking.pickup_date) notice.push(Math.round((Date.parse(booking.pickup_date) - Date.parse(received)) / dayMs));
    }
    if (value === null) continue;
    const items = lineItemsForBooking(booking);
    const duration = rentalDays(booking.pickup_date, booking.dropoff_date ?? booking.pickup_date);
    const weights = duration === null ? [] : items.map((item) => lineItemHireTotalCents(item, duration));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    // Largest remainders preserve every cent when a recorded total differs from its item mix.
    const allocations = total ? weights.map((weight) => Math.floor(weight / total * value)) : [];
    let remaining = value - allocations.reduce((sum, allocation) => sum + allocation, 0);
    const remainderOrder = total ? weights.map((weight, index) => ({ index, fraction: weight / total * value - allocations[index] }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index) : [];
    for (const entry of remainderOrder) {
      if (remaining <= 0) break;
      allocations[entry.index] += 1;
      remaining -= 1;
    }
    const entries = total ? items.map((item, index) => ({
      key: item.kind === "custom" ? `custom:${item.name.trim().toLowerCase()}` : item.catalogKey || item.id,
      name: `${item.name}${item.option ? ` · ${item.option}` : ""}`,
      category: item.kind === "custom" ? "other" as const : item.kind,
      quantity: item.quantity, value: allocations[index],
    })) : [{ key: "unitemised", name: "Unitemised hire", category: "other" as const, quantity: 0, value }];
    for (const item of entries) {
      const group = products.get(item.key) ?? { name: item.name, category: item.category, hires: 0, quantity: 0, value: 0, bookingIds: new Set<string>() };
      group.quantity += item.quantity;
      group.value += item.value;
      group.bookingIds.add(booking.id);
      group.hires = group.bookingIds.size;
      products.set(item.key, group);
    }
  }

  const [startYear, startMonth] = period.from.split("-").map(Number);
  const [endYear, endMonth] = period.to.split("-").map(Number);
  const span = (endYear - startYear) * 12 + endMonth - startMonth + 1;
  const step = span > 96 ? 12 : span > 24 ? 3 : 1;
  const bucketStart = new Date(Date.UTC(startYear, step === 12 ? 0 : step === 3 ? Math.floor((startMonth - 1) / 3) * 3 : startMonth - 1, 1));
  const trend: { key: string; label: string; sales: number; hires: number; requests: number; unpriced: number }[] = [];
  const bucketKey = (date: string) => {
    if (!date) return "";
    const [year, month] = date.split("-").map(Number);
    return step === 12 ? `${year}` : step === 3 ? `${year}-Q${Math.ceil(month / 3)}` : date.slice(0, 7);
  };
  while (bucketStart.toISOString().slice(0, 10) <= period.to) {
    const date = bucketStart.toISOString().slice(0, 10);
    const key = bucketKey(date);
    const label = step === 1 ? new Intl.DateTimeFormat("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" }).format(bucketStart) : key.replace("-", " ");
    trend.push({ key, label, sales: 0, hires: 0, requests: 0, unpriced: 0 });
    bucketStart.setUTCMonth(bucketStart.getUTCMonth() + step);
  }
  const buckets = new Map(trend.map((entry) => [entry.key, entry]));
  for (const booking of completed) {
    const bucket = buckets.get(bucketKey(completionDate(booking)))!;
    const value = bookingHireValue(booking);
    bucket.hires += 1;
    bucket.sales += value ?? 0;
    if (value === null) bucket.unpriced += 1;
  }
  for (const booking of requests) buckets.get(bucketKey(bookingDate(booking, "created_at")))!.requests += 1;
  const weekdayCount = weekdays.reduce((sum, day) => sum + day.count, 0);
  return {
    period, previous, current, prior, trend,
    trendUnit: step === 12 ? "Yearly" : step === 3 ? "Quarterly" : "Monthly",
    requests: requests.length, priorRequests: priorRequests.length, outcomes,
    acceptedShare: requests.length ? Math.round(outcomes[0].count / requests.length * 100) : null,
    repeat, identifiable: identifiable.length,
    repeatShare: identifiable.length ? Math.round(repeat / identifiable.length * 100) : null,
    weekdays, typicalNights: median(nights), typicalNotice: median(notice), noticeSample: notice.length,
    weekendShare: weekdayCount ? Math.round(weekdays.slice(4).reduce((sum, day) => sum + day.count, 0) / weekdayCount * 100) : null,
    products: [...products.values()].map(({ bookingIds: _ids, ...product }) => { void _ids; return product; }).sort((a, b) => b.value - a.value || b.hires - a.hires || a.name.localeCompare(b.name)),
    occasions: [...occasions.values()].sort((a, b) => b.value - a.value || b.hires - a.hires || a.name.localeCompare(b.name)),
    missingCompletionDates: bookings.filter((booking) => booking.status === "completed" && !completionDate(booking)).length,
    missingRequestDates: bookings.filter((booking) => !bookingDate(booking, "created_at")).length,
  };
}

export type RentalPerformance = ReturnType<typeof rentalPerformance>;

export function performanceCsv(report: RentalPerformance) {
  const money = (value: number | null) => value === null ? "" : (value / 100).toFixed(2);
  const rows = [
    ["Section", "Metric", "Current period", "Previous period", "Unit"],
    ["Period", "From", report.period.from, report.previous.from, ""],
    ["Period", "To", report.period.to, report.previous.to, ""],
    ["Definition", "Sales basis", "Completed hires by booked return date; includes GST where applicable; excludes deposits and cancellations", "", ""],
    ["Definition", "Demand basis", "Requests received in Melbourne time; outcomes reflect current status", "", ""],
    ["Summary", "Completed hire sales", money(report.current.sales), money(report.prior.sales), "AUD"],
    ["Summary", "Completed hires", String(report.current.hires), String(report.prior.hires), "count"],
    ["Summary", "Average priced hire", money(report.current.average), money(report.prior.average), "AUD"],
    ["Summary", "Requests received", String(report.requests), String(report.priorRequests), "count"],
    ["Summary", "Repeat-customer hires", String(report.repeat), "", "count"],
    ["Summary", "Identifiable completed hires", String(report.identifiable), "", "count"],
    ["Summary", "Repeat-customer hire share", report.repeatShare === null ? "" : String(report.repeatShare), "", "percent"],
    ["Summary", "Request acceptance share", report.acceptedShare === null ? "" : String(report.acceptedShare), "", "percent"],
    ["Summary", "Median hire duration", report.typicalNights === null ? "" : String(report.typicalNights), "", "nights"],
    ["Summary", "Median booking notice", report.typicalNotice === null ? "" : String(report.typicalNotice), "", "days"],
    ["Summary", "Friday to Sunday pickups", report.weekendShare === null ? "" : String(report.weekendShare), "", "percent"],
    ["Summary", "Unpaid completed hire charges", money(report.current.unpaid), money(report.prior.unpaid), "AUD"],
    ["Coverage", "Unpriced completed hires", String(report.current.unpriced), String(report.prior.unpriced), "count"],
    ["Coverage", "Retained completed hires missing completion dates", String(report.missingCompletionDates), "", "count"],
    ["Coverage", "Retained requests missing received dates", String(report.missingRequestDates), "", "count"],
    ...report.trend.flatMap((entry) => [
      ["Hire sales", entry.label, money(entry.sales), "", "AUD"],
      ["Completed hires", entry.label, String(entry.hires), "", "count"],
      ["Requests received", entry.label, String(entry.requests), "", "count"],
    ]),
    ...report.outcomes.map((entry) => ["Request outcome", entry.name, String(entry.count), "", "count"]),
    ...report.products.map((entry) => ["Allocated hire sales", entry.name, money(entry.value), "", "AUD"]),
    ...report.occasions.map((entry) => ["Event hire sales", entry.name, money(entry.priced ? entry.value : null), "", "AUD"]),
    ...report.weekdays.map((entry) => ["Pickup weekday", entry.name, String(entry.count), "", "count"]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
