import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json() as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "A valid login request is required." }, { status: 400 });
  }
  if (!body.email || !body.password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  try {
    const { data, error } = await createAuthClient().auth.signInWithPassword({ email: body.email, password: body.password });
    if (error || !data.session) return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: data.session.expires_in };
    response.cookies.set("supabase-access-token", data.session.access_token, options);
    response.cookies.set("supabase-refresh-token", data.session.refresh_token, options);
    return response;
  } catch (error) {
    console.error("Admin login service failed", error);
    const message = error instanceof Error && error.message.includes("not configured")
      ? "Admin login is not configured on this server."
      : "The admin login service is unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
