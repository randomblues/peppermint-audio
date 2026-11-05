import { NextResponse } from "next/server";

import { requireAdminJson } from "@/lib/admin-request";
import { isBankTransferOption, type BankTransferOption } from "@/lib/bank-transfer";
import { sendInvoiceEmail } from "@/lib/invoice-service";
import { parseInvoiceRecipient } from "@/lib/invoice-recipient";

export async function POST(request: Request) {
  const auth = await requireAdminJson<{ bookingId?: string; bankTransferOption?: unknown; billToName?: unknown; billToEmail?: unknown }>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;
  const bookingId = body.bookingId?.trim();
  const recipientResult = parseInvoiceRecipient(body);
  if (recipientResult.error) return NextResponse.json({ error: recipientResult.error }, { status: 400 });
  if (!bookingId) return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
  if (body.bankTransferOption !== undefined && !isBankTransferOption(body.bankTransferOption)) {
    return NextResponse.json({ error: "A valid bank-transfer option is required." }, { status: 400 });
  }
  const bankTransferOption: BankTransferOption | undefined = body.bankTransferOption === undefined ? undefined : body.bankTransferOption;
  try {
    const booking = await session.admin.from("bookings")
      .select("id,status,hire_line_items,hire_payment_status,deposit_payment_status")
      .eq("id", bookingId)
      .single();
    if (booking.error) return NextResponse.json({ error: `Booking could not be loaded: ${booking.error.message}` }, { status: 500 });
    if (!booking.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
    const unpaid = !["paid", "succeeded", "captured", "bank_transfer_received"].includes(booking.data.hire_payment_status ?? "")
      && !["authorized", "captured", "bank_transfer_received"].includes(booking.data.deposit_payment_status ?? "");
    if (unpaid && ["submitted", "confirmed"].includes(booking.data.status)) {
      const reservation = await session.admin.rpc("reserve_booking_inventory", {
        p_booking_id: bookingId,
        p_hire_line_items: booking.data.hire_line_items,
      });
      if (reservation.error) {
        console.error("Invoice resend inventory reservation failed:", reservation.error);
        return NextResponse.json({ error: `Inventory availability could not be checked: ${reservation.error.message}` }, { status: 500 });
      }
      if (!reservation.data?.ok) {
        return NextResponse.json({ error: reservation.data?.error ?? "The booking cannot be reserved with current inventory." }, { status: 409 });
      }
    }
    const id = await sendInvoiceEmail(session.admin, bookingId, null, true, bankTransferOption, recipientResult.recipient);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Invoice resend failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice email could not be sent." }, { status: 502 });
  }
}
