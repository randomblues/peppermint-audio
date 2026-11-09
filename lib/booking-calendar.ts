import { rentalDays } from "@/lib/payment-flow";
import { business } from "@/lib/site-content";

export type HireCalendarEvent = {
  kind: "pickup" | "dropoff";
  title: string;
  date: string;
  time: string | null;
  startsAt: string | null;
  googleUrl: string;
};

export type HireCalendarPeriod = {
  kind: "hire";
  title: string;
  date: string;
  endDate: string;
  startsAt: string | null;
  endsAt: string | null;
  description: string;
  googleUrl: string;
};

export const HIRE_COLLECTION_ADDRESS = business.pickupAddress;
const calendarTimeZone = "Australia/Melbourne";

function nextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

function melbourneInstant(date: string, time: string) {
  const wallTime = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
  let timestamp = wallTime;
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: calendarTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = formatter.formatToParts(new Date(timestamp));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(entry => entry.type === type)?.value);
    const localAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    const difference = wallTime - localAsUtc;
    if (difference === 0) return new Date(timestamp).toISOString();
    timestamp += difference;
  }
  throw new Error("The agreed calendar time does not exist in Melbourne.");
}

function compactDate(value: string) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function googleCalendarUrl(title: string, start: string, end: string, description: string) {
  const params = new URLSearchParams({
    action: "TEMPLATE", text: title, dates: `${start}/${end}`, ctz: calendarTimeZone,
    location: HIRE_COLLECTION_ADDRESS, details: description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function createHireCalendarEvent(kind: HireCalendarEvent["kind"], date: string, time?: string | null): HireCalendarEvent {
  if (rentalDays(date, date) === null || (time && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))) {
    throw new Error("A valid hire date and agreed time are required for the calendar.");
  }
  const title = kind === "pickup" ? "Peppermint Audio pickup" : "Peppermint Audio drop-off";
  const startsAt = time ? melbourneInstant(date, time) : null;
  const start = compactDate(startsAt ?? date);
  const end = startsAt ? start : compactDate(nextDay(date));
  const description = `Message or call ${business.phone} upon arrival.${time ? "" : " Time to be arranged."}`;
  return { kind, title, date, time: time?.slice(0, 5) || null, startsAt, googleUrl: googleCalendarUrl(title, start, end, description) };
}

export function formatHireCalendarDate(event: HireCalendarEvent) {
  const date = new Intl.DateTimeFormat("en-AU", {
    timeZone: calendarTimeZone, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(`${event.date}T12:00:00Z`));
  const time = event.startsAt ? new Intl.DateTimeFormat("en-AU", {
    timeZone: calendarTimeZone, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(event.startsAt)) : "Time to be arranged";
  return { date, time };
}

export function createHireCalendarPeriod(events: HireCalendarEvent[]): HireCalendarPeriod {
  const pickup = events.find(event => event.kind === "pickup");
  const dropoff = events.find(event => event.kind === "dropoff");
  if (events.length !== 2 || !pickup || !dropoff || rentalDays(pickup.date, dropoff.date) === null
    || (pickup.startsAt && dropoff.startsAt && pickup.startsAt >= dropoff.startsAt)) {
    throw new Error("A valid pickup and later drop-off are required for the hire calendar.");
  }
  const timed = Boolean(pickup.startsAt && dropoff.startsAt);
  const startsAt = timed ? pickup.startsAt : null;
  const endsAt = timed ? dropoff.startsAt : null;
  const endDate = nextDay(dropoff.date);
  const title = "Peppermint Audio equipment hire";
  const pickupLabel = formatHireCalendarDate(pickup);
  const dropoffLabel = formatHireCalendarDate(dropoff);
  const description = [
    `Pickup: ${pickupLabel.date}, ${pickupLabel.time}.`,
    `Drop-off: ${dropoffLabel.date}, ${dropoffLabel.time}.`,
    "All times are Melbourne time.",
    `Message or call ${business.phone} upon arrival.`,
  ].join("\n");
  return {
    kind: "hire", title, date: pickup.date, endDate, startsAt, endsAt, description,
    googleUrl: googleCalendarUrl(title, compactDate(startsAt ?? pickup.date), compactDate(endsAt ?? endDate), description),
  };
}

export function buildHireCalendarFile(event: HireCalendarEvent | HireCalendarEvent[], reference: string, now = new Date()) {
  const events = Array.isArray(event) ? event : [event];
  if (Array.isArray(event)) createHireCalendarPeriod(events);
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Peppermint Audio//Hire Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...events.flatMap(entry => [
      "BEGIN:VEVENT", `UID:${escape(reference)}-${entry.kind}@peppermintaudio.com.au`, `DTSTAMP:${compactDate(now.toISOString())}`,
      entry.startsAt ? `DTSTART:${compactDate(entry.startsAt)}` : `DTSTART;VALUE=DATE:${compactDate(entry.date)}`,
      ...(!entry.startsAt ? [`DTEND;VALUE=DATE:${compactDate(nextDay(entry.date))}`] : []),
      `SUMMARY:${escape(entry.title)}`, `LOCATION:${escape(HIRE_COLLECTION_ADDRESS)}`,
      `DESCRIPTION:${escape(`Message or call ${business.phone} upon arrival.${entry.time ? "" : " Time to be arranged."}`)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return `${lines.map(line => {
    const characters = Array.from(line);
    const folded: string[] = [];
    let current = "";
    for (const character of characters) {
      if (new TextEncoder().encode(current + character).length > 75) {
        folded.push(current);
        current = " ";
      }
      current += character;
    }
    return [...folded, current].join("\r\n");
  }).join("\r\n")}\r\n`;
}
