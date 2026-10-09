import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthCookies } from "@/lib/auth-cookies";
import { createAuthClient } from "@/lib/supabase";
import { usesLocalSupabase } from "@/lib/supabase-config";

const localLogin = z.object({
  email: z.literal("admin@peppermint.local"),
  password: z.string().min(12),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = new URL(request.url);
  const host = request.headers.get("host")?.toLowerCase() ?? url.host;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)
    || request.headers.get("origin") !== `${url.protocol}//${host}`) {
    return NextResponse.json({ error: "Local same-origin requests only." }, { status: 403 });
  }
  try {
    if (!usesLocalSupabase()) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const login = localLogin.parse(JSON.parse(await readFile(
      path.join(process.cwd(), ".local-supabase", "admin-login.json"), "utf8",
    )));
    const { data, error } = await createAuthClient().auth.signInWithPassword(login);
    if (error) throw error;
    if (!data.session || data.user?.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "The local test account is not an administrator." }, { status: 403 });
    }
    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, data.session);
    return response;
  } catch (error) {
    console.error("Local test-admin sign-in failed", {
      type: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({
      error: "Local test-admin sign-in is unavailable. Run npm run db:local:start and npm run db:local:seed.",
    }, { status: 503 });
  }
}
