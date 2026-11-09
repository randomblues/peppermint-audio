import { readBookingCalendar } from "@/lib/booking-calendar-access";
import { buildHireCalendarFile } from "@/lib/booking-calendar";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request, { params }: { params: Promise<{ token: string; kind?: string }> }) {
  const { token, kind } = await params;
  const eventKind = kind ?? new URL(request.url).searchParams.get("event");
  if (eventKind !== null && eventKind !== "pickup" && eventKind !== "dropoff" && eventKind !== "hire") {
    return Response.json({ error: "Choose hire, pickup or drop-off." }, { status: 400, headers });
  }
  try {
    const calendar = await readBookingCalendar(token);
    if (!calendar) return Response.json({ error: "This calendar link is unavailable. Please contact Peppermint Audio." }, { status: 404, headers });
    if (!eventKind) return Response.json(calendar, { headers });
    const event = eventKind === "hire" ? calendar.events
      : calendar.events.find(entry => entry.kind === eventKind);
    if (!event) throw new Error("The requested calendar event is missing.");
    return new Response(buildHireCalendarFile(event, calendar.reference), {
      headers: {
        ...headers, "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="peppermint-audio-${eventKind}.ics"`,
      },
    });
  } catch (error) {
    console.error("Booking calendar could not be loaded:", error);
    return Response.json({ error: "Calendar details could not be loaded. Please try again or contact Peppermint Audio." }, { status: 500, headers });
  }
}
