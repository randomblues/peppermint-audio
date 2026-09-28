import { NextResponse } from "next/server";
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("supabase-access-token");
  response.cookies.delete("supabase-refresh-token");
  return response;
}
