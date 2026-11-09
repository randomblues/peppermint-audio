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

export function createHireCalendarEvent(kind: HireCalendarEvent["kind"], date: string, time?: string | null): HireCalendarEvent {
  if (rentalDays(date, date) === null || (time && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))) {
    throw new Error("A valid hire date and agreed time are required for the calendar.");
  }
  const title = kind === "pickup" ? "Peppermint Audio pickup" : "Peppermint Audio drop-off";
  const startsAt = time ? melbourneInstant(date, time) : null;
  const start = compactDate(startsAt ?? date);
  const end = startsAt ? start : compactDate(nextDay(date));
  const params = new URLSearchParams({
    action: "TEMPLATE", text: title, dates: `${start}/${end}`, ctz: calendarTimeZone,
    location: HIRE_COLLECTION_ADDRESS,
    details: `Message or call ${business.phone} upon arrival.${time ? "" : " Time to be arranged."}`,
  });
  return { kind, title, date, time: time?.slice(0, 5) || null, startsAt, googleUrl: `https://calendar.google.com/calendar/render?${params}` };
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

export function buildHireCalendarFile(event: HireCalendarEvent, reference: string, now = new Date()) {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Peppermint Audio//Hire Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${escape(reference)}-${event.kind}@peppermintaudio.com.au`, `DTSTAMP:${compactDate(now.toISOString())}`,
    event.startsAt ? `DTSTART:${compactDate(event.startsAt)}` : `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
    ...(!event.startsAt ? [`DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`] : []),
    `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(HIRE_COLLECTION_ADDRESS)}`,
    `DESCRIPTION:${escape(`Message or call ${business.phone} upon arrival.${event.time ? "" : " Time to be arranged."}`)}`,
    "END:VEVENT", "END:VCALENDAR",
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
