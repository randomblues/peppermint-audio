import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { PHOTO_ID_BUCKET } from "@/lib/supabase";

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
  const body = await request.json() as { id?: string; status?: string; internal_notes?: string };
  if (!body.id || (body.status && !["submitted", "confirmed", "completed", "cancelled"].includes(body.status))) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const update = { ...(body.status ? { status: body.status } : {}), ...(body.internal_notes !== undefined ? { internal_notes: body.internal_notes } : {}), updated_at: new Date().toISOString() };
  const { error } = await session.admin.from("bookings").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await request.json() as { id?: string; confirm?: boolean };
  if (!body.id || body.confirm !== true) return NextResponse.json({ error: "Explicit deletion confirmation is required." }, { status: 400 });
  const { data: booking, error: readError } = await session.admin.from("bookings").select("photo_id_paths").eq("id", body.id).single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const paths = (booking.photo_id_paths as string[] | null) ?? [];
  if (paths.length) await session.admin.storage.from(PHOTO_ID_BUCKET).remove(paths);
  const { error } = await session.admin.from("bookings").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
