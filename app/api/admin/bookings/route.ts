import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { PHOTO_ID_BUCKET } from "@/lib/supabase";
import { sendBookingConfirmationEmail } from "@/lib/send-booking-confirmation";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status");
  let query = session.admin.from("bookings").select("*").order("pickup_date", { ascending: true });
  if (status && ["submitted", "confirmed", "completed", "cancelled"].includes(status)) query = query.eq("status", status);
  if (search) query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,event_type.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  let body: { id?: string; status?: string; internal_notes?: string };
  try {
    body = await request.json() as { id?: string; status?: string; internal_notes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.id || (body.status && !["submitted", "confirmed", "completed", "cancelled"].includes(body.status))) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  let confirmation: {
    email: string;
    first_name: string;
    event_type: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_time?: string | null;
    dropoff_time?: string | null;
    created_at?: string | null;
    package_interest: string;
    add_ons: string[] | null;
    additional_details?: string | null;
    confirmation_email_sent: boolean;
  } | null = null;
  if (body.status === "confirmed") {
    const result = await session.admin.from("bookings")
      .select("email,first_name,event_type,pickup_date,dropoff_date,pickup_time,dropoff_time,created_at,package_interest,add_ons,additional_details,confirmation_email_sent")
      .eq("id", body.id)
      .single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
    confirmation = result.data;
    if (!confirmation.confirmation_email_sent) {
      try {
        await sendBookingConfirmationEmail(confirmation);
      } catch (error) {
        console.error("Booking confirmation email failed:", error);
        const message = error instanceof Error ? error.message : "Booking confirmation email could not be sent.";
        return NextResponse.json({ error: message }, { status: message === "Email service is not configured." ? 500 : 502 });
      }
    }
  }
  const update = { ...(body.status ? { status: body.status } : {}), ...(body.internal_notes !== undefined ? { internal_notes: body.internal_notes } : {}), updated_at: new Date().toISOString() };
  if (body.status === "confirmed" && confirmation && !confirmation.confirmation_email_sent) {
    Object.assign(update, { confirmation_email_sent: true });
  }
  const { error } = await session.admin.from("bookings").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  let body: { id?: string; confirm?: boolean };
  try {
    body = await request.json() as { id?: string; confirm?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.id || body.confirm !== true) return NextResponse.json({ error: "Explicit deletion confirmation is required." }, { status: 400 });
  const { data: booking, error: readError } = await session.admin.from("bookings").select("photo_id_paths").eq("id", body.id).single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const paths = (booking.photo_id_paths as string[] | null) ?? [];
  if (paths.length) await session.admin.storage.from(PHOTO_ID_BUCKET).remove(paths);
  const { error } = await session.admin.from("bookings").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
