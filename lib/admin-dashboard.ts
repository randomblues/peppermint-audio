export const bookingStatuses = ["submitted", "confirmed", "completed", "cancelled"] as const;
type BookingStatus = (typeof bookingStatuses)[number];

type DashboardBooking = {
  pickup_date?: string | null;
  status?: string | null;
};

export function filterBookings<T extends DashboardBooking>(
  bookings: T[],
  filters: { status?: string; from?: string; to?: string },
): T[] {
  return bookings.filter((booking) => {
    const date = booking.pickup_date ?? "";
    return (
      (!filters.status || booking.status === filters.status) &&
      (!filters.from || date >= filters.from) &&
      (!filters.to || date <= filters.to)
    );
  });
}

export function statusCounts(bookings: DashboardBooking[]) {
  return bookingStatuses.reduce<Record<BookingStatus, number>>((counts, status) => {
    counts[status] = bookings.filter((booking) => booking.status === status).length;
    return counts;
  }, { submitted: 0, confirmed: 0, completed: 0, cancelled: 0 });
}

export function isUpcoming(booking: DashboardBooking, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(booking.pickup_date && booking.pickup_date >= today &&
    booking.status !== "cancelled" && booking.status !== "completed");
}
