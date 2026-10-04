import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireAdmin } from "@/lib/admin-auth";
import { PHOTO_ID_BUCKET } from "@/lib/supabase";
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await request.json() as { from?: string; to?: string; confirm?: boolean };
  if (!body.confirm || !body.from || !body.to || body.from > body.to) return NextResponse.json({ error: "A valid date range and explicit confirmation are required." }, { status: 400 });
  const { data, error } = await session.admin.from("bookings").select("*").gte("pickup_date", body.from).lte("pickup_date", body.to).order("pickup_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const zip = new JSZip();
  const rows = data ?? [];
  const columns = ["id", "email", "first_name", "last_name", "mobile", "event_type", "event_address", "pickup_date", "pickup_time", "dropoff_date", "dropoff_time", "hire_line_items", "additional_details", "status", "internal_notes", "calendar_event_link", "calendar_error", "created_at", "updated_at"];
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  zip.file("bookings.csv", csv);
  zip.file("bookings.json", JSON.stringify(rows, null, 2));
  zip.file("README.txt", "Peppermint Audio booking archive. Photo ID files are private and included only when available.\n");
  for (const row of rows) for (const path of (row.photo_id_paths as string[] ?? [])) {
    const file = await session.admin.storage.from(PHOTO_ID_BUCKET).download(path);
    if (!file.error && file.data) zip.file(`attachments/${row.id}/${path.split("/").pop()}`, await file.data.arrayBuffer());
  }
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new NextResponse(new Blob([bytes.buffer as ArrayBuffer]), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="booking-archive-${body.from}-to-${body.to}.zip"` } });
}
