import { bookingReferenceForId } from "@/lib/booking-reference";

export function invoiceNumberForBooking(bookingId: string) {
  return bookingReferenceForId(bookingId);
}
