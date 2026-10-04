import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase";
import { setAuthCookies } from "@/lib/auth-cookies";

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
    setAuthCookies(response, data.session);
    return response;
  } catch (error) {
    console.error("Admin login service failed", error);
    const message = error instanceof Error && error.message.includes("not configured")
      ? "Admin login is not configured on this server."
      : "The admin login service is unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
