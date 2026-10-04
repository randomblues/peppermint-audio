import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { PHOTO_ID_BUCKET } from "@/lib/supabase";
export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const path = new URL(request.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Path is required." }, { status: 400 });
  const { data, error } = await session.admin.storage.from(PHOTO_ID_BUCKET).createSignedUrl(path, 300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
