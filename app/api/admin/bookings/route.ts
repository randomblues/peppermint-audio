import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { requireAdminJson } from "@/lib/admin-request";
import { PHOTO_ID_BUCKET } from "@/lib/supabase";
import { removeCustomerEmailAttachments } from "@/lib/email-log";
import { ConfirmationError, sendTrackedBookingConfirmation } from "@/lib/booking-confirmation";
import { markInvoiceStatus, sendBillingDocument } from "@/lib/invoice-service";
import { lineItemsTotalCents, parseBookingLineItems, type BookingLineItem } from "@/lib/booking-line-items";
import { rentalDays } from "@/lib/payment-flow";
import { releaseCancelledDeferredDeposit } from "@/lib/deferred-deposits";
import { getStripe } from "@/lib/stripe";

async function closeStripePaymentIntents(paymentIntentIds: Array<string | null | undefined>) {
  const ids = paymentIntentIds.filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  const stripe = getStripe();
  const intents = await Promise.all(ids.map((id) => stripe.paymentIntents.retrieve(id)));
  if (intents.some((intent) => intent.status === "succeeded" || intent.status === "processing")) {
    throw new Error("A Stripe payment is already processing. Refresh the booking before recording a bank transfer.");
  }
  const pendingIntents = intents.filter((intent) => intent.status !== "canceled");
  const cancelledIntents = await Promise.all(pendingIntents.map((intent) => stripe.paymentIntents.cancel(intent.id)));
  if (cancelledIntents.some((intent) => intent.status !== "canceled")) {
    throw new Error("The Stripe payment request could not be closed.");
  }
}

function escapePostgrestSearch(value: string) {
  return value.replace(/[\\%_(),.]/g, "\\$&");
}

async function readAllRows<T>(read: (offset: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const data: T[] = [];
  let pageLength: number;
  do {
    const page = await read(data.length);
    if (page.error) return { data: null, error: page.error };
    data.push(...(page.data ?? []));
    pageLength = page.data?.length ?? 0;
  } while (pageLength === 500);
  return { data, error: null };
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status");
  const all = url.searchParams.get("all") === "true";
  let query = session.admin.from("bookings")
    .select("*,sms_logs:booking_sms_log(id,recipient_mobile,sms_type,body,status,provider_message_id,error,recorded_at)")
    .order("pickup_date", { ascending: true });
  if (all) query = query.order("id", { ascending: true });
  if (status && ["submitted", "confirmed", "completed", "cancelled"].includes(status)) query = query.eq("status", status);
  if (search) {
    const escapedSearch = escapePostgrestSearch(search);
    query = query.or(`email.ilike.%${escapedSearch}%,first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,event_type.ilike.%${escapedSearch}%`);
  }
  const { data: rows, error } = await (all ? readAllRows((offset) => query.range(offset, offset + 499)) : query);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const data = rows ?? [];
  const bookingIds = data.map((booking) => booking.id);
  const emailQuery = (ids: string[]) => session.admin
      .from("booking_email_log")
      .select("id,booking_id,recipient_email,email_type,provider_message_id,sent_at")
      .in("booking_id", ids)
      .order("sent_at", { ascending: false });
  const readLogs = (ids: string[]) => all
    ? readAllRows((offset) => emailQuery(ids).order("id", { ascending: true }).range(offset, offset + 499))
    : emailQuery(ids);
  const emailLogs = bookingIds.length
    ? await readLogs(bookingIds.slice(0, 100))
    : { data: [], error: null };
  if (emailLogs.error) return NextResponse.json({ error: emailLogs.error.message }, { status: 500 });
  const emailLogData = [...(emailLogs.data ?? [])];
  for (let offset = 100; offset < bookingIds.length; offset += 100) {
    const logs = await readLogs(bookingIds.slice(offset, offset + 100));
    if (logs.error) return NextResponse.json({ error: logs.error.message }, { status: 500 });
    emailLogData.push(...(logs.data ?? []));
  }
  const logsByBooking = new Map<string, typeof emailLogData>();
  for (const log of emailLogData) {
    const logs = logsByBooking.get(log.booking_id) ?? [];
    logs.push(log);
    logsByBooking.set(log.booking_id, logs);
  }
  return NextResponse.json({
    bookings: (data ?? []).map((booking) => ({ ...booking, email_logs: logsByBooking.get(booking.id) ?? [] })),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminJson<{ id?: string; status?: string; payment_received?: boolean; internal_notes?: string; hire_line_items?: unknown }>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;
  if (!body.id || (body.status && !["submitted", "confirmed", "completed", "cancelled"].includes(body.status))) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  let lineItemUpdate: { hire_line_items: unknown; hire_amount_cents: number } | null = null;
  let alreadyConfirmed = false;
  if (body.hire_line_items !== undefined) {
    const parsedItems = parseBookingLineItems(body.hire_line_items);
    if ("error" in parsedItems) return NextResponse.json({ error: parsedItems.error }, { status: 400 });
    const current = await session.admin.from("bookings")
      .select("status,payment_method,hire_payment_status,deposit_payment_status,pickup_date,dropoff_date")
      .eq("id", body.id)
      .single();
    if (current.error) return NextResponse.json({ error: current.error.message }, { status: 500 });
    if (!current.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
    alreadyConfirmed = current.data.status === "confirmed";
    const paymentSent = Boolean(current.data.payment_method)
      || !["unpaid", null, undefined].includes(current.data.hire_payment_status)
      || !["not_required", null, undefined].includes(current.data.deposit_payment_status);
    if (paymentSent) return NextResponse.json({ error: "This booking already has a payment request. Use Update payment request while it is still unpaid." }, { status: 409 });
    const nights = rentalDays(current.data.pickup_date, current.data.dropoff_date);
    if (nights === null) return NextResponse.json({ error: "The booking dates are invalid." }, { status: 400 });
    lineItemUpdate = { hire_line_items: parsedItems.items, hire_amount_cents: lineItemsTotalCents(parsedItems.items, nights) };
  }
  let confirmation: {
    id: string;
    email: string;
    first_name: string;
    event_type: string;
    mobile: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_time?: string | null;
    dropoff_time?: string | null;
    created_at?: string | null;
    hire_line_items: BookingLineItem[] | null;
    additional_details?: string | null;
    confirmation_email_sent: boolean;
    confirmation_sms_sent_at: string | null;
  } | null = null;
  let paymentUpdate: Record<string, unknown> & { hire_payment_status: string; deposit_payment_status: string; payment_received_at: string } | null = null;
  let standardBankTransferReceived = false;
  if (body.status === "confirmed") {
    const result = await session.admin.from("bookings")
      .select("id,email,mobile,first_name,event_type,pickup_date,dropoff_date,pickup_time,dropoff_time,created_at,hire_line_items,additional_details,confirmation_email_sent,confirmation_sms_sent_at,hire_payment_status,payment_method,security_deposit_cents,deposit_payment_status,bank_transfer_option,stripe_hire_payment_intent_id,stripe_deposit_payment_intent_id")
      .eq("id", body.id)
      .single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
    const paymentReady = ["paid", "succeeded", "bank_transfer_received"].includes(result.data.hire_payment_status ?? "")
      || (result.data.payment_method === "cash_on_pickup" && result.data.hire_payment_status === "cash_due");
    if (!paymentReady) {
      const bankTransferAvailable = result.data.payment_method === "bank_transfer"
        || (result.data.payment_method === "stripe_card_hold" && result.data.bank_transfer_option === "both");
      if (!bankTransferAvailable || body.payment_received !== true) {
        return NextResponse.json({ error: result.data.payment_method === "bank_transfer"
          ? "Confirm that payment has been received before confirming this booking."
          : "A paid Stripe payment or a bank-transfer or cash-on-pickup invoice is required before confirming this booking." }, { status: 409 });
      }
      standardBankTransferReceived = result.data.payment_method === "stripe_card_hold";
      paymentUpdate = {
        payment_method: "bank_transfer",
        bank_transfer_option: "both",
        payment_token: null,
        payment_token_expires_at: null,
        stripe_hire_payment_intent_id: null,
        stripe_deposit_payment_intent_id: null,
        deposit_hold_date: null,
        deposit_consent_at: null,
        deposit_capture_before: null,
        deposit_error: null,
        hire_payment_status: "bank_transfer_received",
        deposit_payment_status: result.data.security_deposit_cents > 0 ? "bank_transfer_received" : "not_required",
        payment_received_at: new Date().toISOString(),
      };
    }
    const reservation = await session.admin.rpc("reserve_booking_inventory", {
      p_booking_id: body.id,
      p_hire_line_items: lineItemUpdate?.hire_line_items ?? result.data.hire_line_items,
    });
    if (reservation.error) {
      console.error("Booking inventory reservation failed:", reservation.error);
      return NextResponse.json({ error: `Inventory availability could not be checked: ${reservation.error.message}` }, { status: 500 });
    }
    if (!reservation.data?.ok) {
      return NextResponse.json({ error: reservation.data?.error ?? "The booking cannot be reserved with current inventory." }, { status: 409 });
    }
    if (standardBankTransferReceived) {
      try {
        await closeStripePaymentIntents([
          result.data.stripe_hire_payment_intent_id,
          result.data.stripe_deposit_payment_intent_id,
        ]);
      } catch (error) {
        console.error("Standard Stripe request could not be closed before recording bank transfer:", error);
        return NextResponse.json({ error: "The Stripe payment request could not be closed safely. Refresh the booking before recording a bank transfer." }, { status: 409 });
      }
    }
    confirmation = result.data;
  }
  if (!confirmation && alreadyConfirmed && lineItemUpdate) {
    const reservation = await session.admin.rpc("reserve_booking_inventory", {
      p_booking_id: body.id,
      p_hire_line_items: lineItemUpdate.hire_line_items,
    });
    if (reservation.error) {
      console.error("Confirmed booking inventory update failed:", reservation.error);
      return NextResponse.json({ error: `Inventory availability could not be checked: ${reservation.error.message}` }, { status: 500 });
    }
    if (!reservation.data?.ok) {
      return NextResponse.json({ error: reservation.data?.error ?? "The booking cannot be reserved with current inventory." }, { status: 409 });
    }
  }
  const update = {
    ...(body.status ? { status: body.status } : {}),
    ...(body.internal_notes !== undefined ? { internal_notes: body.internal_notes } : {}),
    ...(lineItemUpdate ?? {}),
    ...(paymentUpdate ?? {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = await session.admin.from("bookings").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.status === "cancelled" || body.status === "completed") {
    const release = await session.admin.rpc("release_booking_inventory", { p_booking_id: body.id });
    if (release.error) {
      console.error("Booking inventory release failed:", release.error);
      return NextResponse.json({ error: `Booking status was updated, but its inventory reservation could not be released: ${release.error.message}` }, { status: 500 });
    }
  }
  if (confirmation) {
    const bookingId = body.id;
    try {
      const outcomes = await Promise.allSettled([
        sendTrackedBookingConfirmation(session.admin, body.id, confirmation),
        ...(paymentUpdate ? [(async () => {
          await markInvoiceStatus(session.admin, bookingId, "paid", paymentUpdate.payment_received_at);
          await sendBillingDocument(session.admin, bookingId, "payment_receipt", undefined, false, "both", undefined, standardBankTransferReceived);
        })()] : []),
      ]);
      const failures = outcomes.filter((outcome) => outcome.status === "rejected");
      if (failures.length) {
        const messages = failures.map(({ reason }) => reason instanceof ConfirmationError ? reason.message
          : `Booking confirmed, but payment receipt delivery failed. ${reason instanceof Error ? reason.message : "Please retry from payment collection."}`);
        const status = failures[0].reason instanceof ConfirmationError ? failures[0].reason.status : 502;
        throw new ConfirmationError(messages.join(" "), status);
      }
    } catch (error) {
      console.error("Booking confirmation failed:", error);
      return NextResponse.json({
        error: error instanceof ConfirmationError ? error.message : `Booking confirmed, but payment receipt delivery failed. ${error instanceof Error ? error.message : "Please retry from payment collection."}`,
        booking: update,
      },
        { status: error instanceof ConfirmationError ? error.status : 502 });
    }
  }
  if (body.status === "cancelled") {
    try {
      await releaseCancelledDeferredDeposit(session.admin, body.id);
    } catch (cause) {
      console.error("Cancelled booking deposit release failed:", cause);
      return NextResponse.json({ error: "Booking cancelled, but the deposit hold could not be released. Please review the deposit before retrying." }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: true, ...(paymentUpdate ? { payment: paymentUpdate } : {}) });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminJson<{ id?: string; confirm?: boolean }>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;
  if (!body.id || body.confirm !== true) return NextResponse.json({ error: "Explicit deletion confirmation is required." }, { status: 400 });
  const { data: booking, error: readError } = await session.admin.from("bookings").select("photo_id_paths").eq("id", body.id).single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const paths = (booking.photo_id_paths as string[] | null) ?? [];
  if (paths.length) {
    const removal = await session.admin.storage.from(PHOTO_ID_BUCKET).remove(paths);
    if (removal.error) return NextResponse.json({ error: `Private photo ID deletion failed: ${removal.error.message}` }, { status: 502 });
  }
  try {
    await removeCustomerEmailAttachments(session.admin, body.id);
  } catch (error) {
    console.error("Customer email attachment deletion failed:", error);
    return NextResponse.json({ error: "Customer email attachments could not be deleted." }, { status: 502 });
  }
  const { error } = await session.admin.from("bookings").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
