import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { requireAdminJson } from "@/lib/admin-request";
import { PHOTO_ID_BUCKET } from "@/lib/supabase";
import { sendBookingConfirmationEmail } from "@/lib/send-booking-confirmation";
import { recordCustomerEmail } from "@/lib/email-log";
import { lineItemsTotalCents, parseBookingLineItems, type BookingLineItem } from "@/lib/booking-line-items";
import { rentalDays } from "@/lib/payment-flow";
import { releaseCancelledDeferredDeposit } from "@/lib/deferred-deposits";

function escapePostgrestSearch(value: string) {
  return value.replace(/[\\%_(),.]/g, "\\$&");
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status");
  let query = session.admin.from("bookings").select("*").order("pickup_date", { ascending: true });
  if (status && ["submitted", "confirmed", "completed", "cancelled"].includes(status)) query = query.eq("status", status);
  if (search) {
    const escapedSearch = escapePostgrestSearch(search);
    query = query.or(`email.ilike.%${escapedSearch}%,first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,event_type.ilike.%${escapedSearch}%`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const bookingIds = (data ?? []).map((booking) => booking.id);
  const emailLogs = bookingIds.length
    ? await session.admin
      .from("booking_email_log")
      .select("id,booking_id,recipient_email,email_type,provider_message_id,sent_at")
      .in("booking_id", bookingIds)
      .order("sent_at", { ascending: false })
    : { data: [], error: null };
  if (emailLogs.error) return NextResponse.json({ error: emailLogs.error.message }, { status: 500 });
  const logsByBooking = new Map<string, typeof emailLogs.data>();
  for (const log of emailLogs.data ?? []) {
    const logs = logsByBooking.get(log.booking_id) ?? [];
    logs.push(log);
    logsByBooking.set(log.booking_id, logs);
  }
  return NextResponse.json({
    bookings: (data ?? []).map((booking) => ({ ...booking, email_logs: logsByBooking.get(booking.id) ?? [] })),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminJson<{ id?: string; status?: string; internal_notes?: string; hire_line_items?: unknown }>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;
  if (!body.id || (body.status && !["submitted", "confirmed", "completed", "cancelled"].includes(body.status))) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  let lineItemUpdate: { hire_line_items: unknown; hire_amount_cents: number } | null = null;
  if (body.hire_line_items !== undefined) {
    const parsedItems = parseBookingLineItems(body.hire_line_items);
    if ("error" in parsedItems) return NextResponse.json({ error: parsedItems.error }, { status: 400 });
    const current = await session.admin.from("bookings")
      .select("payment_method,hire_payment_status,deposit_payment_status,pickup_date,dropoff_date")
      .eq("id", body.id)
      .single();
    if (current.error) return NextResponse.json({ error: current.error.message }, { status: 500 });
    if (!current.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
    const paymentSent = Boolean(current.data.payment_method)
      || !["unpaid", null, undefined].includes(current.data.hire_payment_status)
      || !["not_required", null, undefined].includes(current.data.deposit_payment_status);
    if (paymentSent) return NextResponse.json({ error: "This booking already has a payment request. Use Update payment request while it is still unpaid." }, { status: 409 });
    const nights = rentalDays(current.data.pickup_date, current.data.dropoff_date);
    if (nights === null) return NextResponse.json({ error: "The booking dates are invalid." }, { status: 400 });
    lineItemUpdate = { hire_line_items: parsedItems.items, hire_amount_cents: lineItemsTotalCents(parsedItems.items, nights) };
  }
  let confirmation: {
    email: string;
    first_name: string;
    event_type: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_time?: string | null;
    dropoff_time?: string | null;
    created_at?: string | null;
    hire_line_items: BookingLineItem[] | null;
    additional_details?: string | null;
    confirmation_email_sent: boolean;
  } | null = null;
  if (body.status === "confirmed") {
    const result = await session.admin.from("bookings")
      .select("id,email,first_name,event_type,pickup_date,dropoff_date,pickup_time,dropoff_time,created_at,hire_line_items,additional_details,confirmation_email_sent,hire_payment_status,payment_method")
      .eq("id", body.id)
      .single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
    const paymentReady = ["paid", "succeeded", "bank_transfer_received"].includes(result.data.hire_payment_status ?? "")
      || (result.data.payment_method === "cash_on_pickup" && result.data.hire_payment_status === "cash_due");
    if (!paymentReady) {
      return NextResponse.json({ error: "Mark the hire payment as paid before confirming this booking." }, { status: 409 });
    }
    confirmation = result.data;
  }
  const update = {
    ...(body.status ? { status: body.status } : {}),
    ...(body.internal_notes !== undefined ? { internal_notes: body.internal_notes } : {}),
    ...(lineItemUpdate ?? {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = await session.admin.from("bookings").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (confirmation) {
    if (!confirmation.confirmation_email_sent) {
      try {
        const providerMessageId = await sendBookingConfirmationEmail(confirmation);
        try {
          await recordCustomerEmail(session.admin, {
            bookingId: body.id,
            recipientEmail: confirmation.email,
            emailType: "confirmation",
            providerMessageId,
          });
        } catch (error) {
          console.error("Confirmation email log failed:", error);
        }
      } catch (error) {
        console.error("Booking confirmation email failed:", error);
        const message = error instanceof Error ? error.message : "Booking confirmation email could not be sent.";
        return NextResponse.json({ error: `Booking confirmed, but the confirmation email failed. Use Send confirmation email to retry. ${message}` }, { status: 502 });
      }
      const tracking = await session.admin.from("bookings")
        .update({ confirmation_email_sent: true, updated_at: new Date().toISOString() }).eq("id", body.id);
      if (tracking.error) return NextResponse.json({ error: "Booking confirmed and email sent, but email tracking could not be saved. Refresh before retrying to avoid sending a duplicate." }, { status: 500 });
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
  return NextResponse.json({ ok: true });
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
  const { error } = await session.admin.from("bookings").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
