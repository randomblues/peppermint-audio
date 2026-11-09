"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { z } from "zod";
import { createHireCalendarEvent, createHireCalendarPeriod, formatHireCalendarDate, HIRE_COLLECTION_ADDRESS } from "@/lib/booking-calendar";
import { business } from "@/lib/site-content";

const calendarSchema = z.object({
  reference: z.string(),
  events: z.array(z.object({
    kind: z.enum(["pickup", "dropoff"]), date: z.string(), time: z.string().nullable(),
  })).length(2),
}).transform(calendar => {
  const events = calendar.events.map(event => createHireCalendarEvent(event.kind, event.date, event.time));
  return { ...calendar, events, hire: createHireCalendarPeriod(events) };
});

export function BookingCalendar({ token }: { token: string }) {
  const [calendar, setCalendar] = useState<z.infer<typeof calendarSchema> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setCalendar(null);
      setError("");
      try {
        const response = await fetch(`/api/calendar/${encodeURIComponent(token)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404
          ? "This calendar link is unavailable. Please contact Peppermint Audio."
          : "Calendar details could not be loaded. Please try again or contact Peppermint Audio.");
        const result = calendarSchema.parse(await response.json());
        setCalendar(result);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("Booking calendar request failed:", cause);
        setError(cause instanceof Error && cause.message.startsWith("This calendar link")
          ? cause.message : "Calendar details could not be loaded. Please try again or contact Peppermint Audio.");
      }
    }
    void load();
    return () => controller.abort();
  }, [token]);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <CalendarDays className="mb-4 size-9 text-primary" aria-hidden="true" />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Add your hire to your calendar</h1>
      <p className="mt-3 text-sm text-muted-foreground">Add your pickup and drop-off to your calendar. All times are Melbourne time.</p>
      {error ? <p role="alert" className="mt-6 rounded-xl border p-4">{error}</p> : !calendar
        ? <p role="status" className="mt-6">Loading calendar details...</p>
        : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">Booking reference: {calendar.reference}</p>
            <article aria-label="Hire calendar event" className="mt-6 min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
              <h2 className="font-heading text-xl font-semibold">Your equipment hire</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {calendar.events.map(event => {
                  const formatted = formatHireCalendarDate(event);
                  return (
                    <div key={event.kind} className="min-w-0">
                      <h3 className="font-medium">{event.kind === "pickup" ? "Pickup" : "Drop-off"}</h3>
                      <p className="mt-2 text-sm">{formatted.date}</p>
                      <p className="mt-1 font-medium">{formatted.time}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 text-sm text-muted-foreground">{HIRE_COLLECTION_ADDRESS}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a href={calendar.hire.googleUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                  className="rounded-full bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  Google Calendar<span className="sr-only"> for your hire (opens in a new tab)</span>
                </a>
                <a href={`/api/calendar/${encodeURIComponent(token)}/hire`} download
                  className="rounded-full border px-4 py-3 text-center text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  Apple / Outlook (.ics)<span className="sr-only"> for your hire</span>
                </a>
              </div>
            </article>
            <p className="mt-5 text-sm text-muted-foreground">If your hire times change after saving, update your saved calendar entries.</p>
          </>
        )}
      <p className="mt-8 text-sm">Need help? <a className="underline underline-offset-4" href={`tel:${business.phone.replace(/\s/g, "")}`}>Call {business.phone}</a>.</p>
    </section>
  );
}
