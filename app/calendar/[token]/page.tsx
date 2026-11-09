import type { Metadata } from "next";
import { BookingCalendar } from "@/components/booking-calendar";

export const metadata: Metadata = {
  title: "Add your hire to your calendar",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function BookingCalendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BookingCalendar token={token} />;
}
