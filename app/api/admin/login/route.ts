import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  if (!body.email || !body.password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  const { data, error } = await createAuthClient().auth.signInWithPassword({ email: body.email, password: body.password });
  if (error || !data.session) return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: data.session.expires_in };
  response.cookies.set("supabase-access-token", data.session.access_token, options);
  response.cookies.set("supabase-refresh-token", data.session.refresh_token, options);
  return response;
}
