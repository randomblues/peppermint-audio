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
    const id = await sendInvoiceEmail(session.admin, bookingId, null, true, bankTransferOption, recipientResult.recipient);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Invoice resend failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice email could not be sent." }, { status: 502 });
  }
}
