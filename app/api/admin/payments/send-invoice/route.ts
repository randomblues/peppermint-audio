import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { isBankTransferOption, type BankTransferOption } from "@/lib/bank-transfer";
import { sendInvoiceEmail } from "@/lib/invoice-service";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  let body: { bookingId?: string; bankTransferOption?: unknown };
  try {
    body = await request.json() as { bookingId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const bookingId = body.bookingId?.trim();
  if (!bookingId) return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
  if (body.bankTransferOption !== undefined && !isBankTransferOption(body.bankTransferOption)) {
    return NextResponse.json({ error: "A valid bank-transfer option is required." }, { status: 400 });
  }
  const bankTransferOption: BankTransferOption | undefined = body.bankTransferOption === undefined ? undefined : body.bankTransferOption;
  try {
    const id = await sendInvoiceEmail(session.admin, bookingId, null, true, bankTransferOption);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Invoice resend failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice email could not be sent." }, { status: 502 });
  }
}
