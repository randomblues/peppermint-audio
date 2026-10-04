export function invoiceNumberForBooking(bookingId: string) {
  const compactId = bookingId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
  if (!compactId) throw new Error("A booking ID is required to create an invoice reference.");
  return `PA-${compactId}`;
}
