import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase";
import { melbourneDateKey, rentalDays } from "@/lib/payment-flow";
import { bookingReferenceForId } from "@/lib/booking-reference";
import { createHireCalendarEvent } from "@/lib/booking-calendar";

const tokenPattern = /^[A-Za-z0-9_-]{22}$/;

export async function ensureBookingCalendarLink(bookingId: string) {
  const admin = createAdminClient();
  const read = () => admin.from("bookings").select("calendar_token").eq("id", bookingId).eq("status", "confirmed").single();
  const existing = await read();
  if (existing.error || !existing.data) throw new Error("Confirmed booking calendar link could not be loaded.");
  let token: string | null = existing.data.calendar_token;
  if (!token) {
    const created = await admin.from("bookings").update({ calendar_token: randomBytes(16).toString("base64url") })
      .eq("id", bookingId).eq("status", "confirmed").is("calendar_token", null).select("calendar_token").maybeSingle();
    if (created.error) throw new Error("Booking calendar link could not be saved.");
    if (created.data) token = created.data.calendar_token;
    else {
      const current = await read();
      if (current.error) throw new Error("Booking calendar link could not be reloaded.");
      token = current.data?.calendar_token;
    }
  }
  if (typeof token !== "string" || !tokenPattern.test(token)) throw new Error("Booking calendar link is unavailable.");
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.peppermintaudio.com.au");
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) {
    throw new Error("Calendar links require a secure website URL.");
  }
  return `${origin.origin}/calendar/${token}`;
}

export async function readBookingCalendar(token: string, now = new Date()) {
  if (!tokenPattern.test(token)) return null;
  const result = await createAdminClient().from("bookings")
    .select("id,status,pickup_date,pickup_time,dropoff_date,dropoff_time")
    .eq("calendar_token", token).eq("status", "confirmed").maybeSingle();
  if (result.error) throw new Error("Booking calendar details could not be loaded.");
  const booking = result.data;
  if (!booking || booking.status !== "confirmed") return null;
  if (rentalDays(booking.pickup_date, booking.dropoff_date) === null) throw new Error("Booking calendar dates are invalid.");
  const daysSinceReturn = rentalDays(booking.dropoff_date, melbourneDateKey(now));
  if (daysSinceReturn !== null && daysSinceReturn > 30) return null;
  return {
    reference: bookingReferenceForId(booking.id),
    events: [
      createHireCalendarEvent("pickup", booking.pickup_date, booking.pickup_time),
      createHireCalendarEvent("dropoff", booking.dropoff_date, booking.dropoff_time),
    ],
  };
}
