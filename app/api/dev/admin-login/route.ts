import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

import { setAuthCookies } from "@/lib/auth-cookies";
import { supabaseConnection } from "@/lib/supabase-config";
import { createAuthClient } from "@/lib/supabase";

const localLoginSchema = z.object({
  email: z.literal("admin@peppermint.local"),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = new URL(request.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || !["http:", "https:"].includes(url.protocol)
    || request.headers.get("origin") !== url.origin) {
    return NextResponse.json({ error: "A same-origin loopback request is required." }, { status: 403 });
  }
  try {
    supabaseConnection("auth");
    const file = path.join(process.cwd(), ".local-supabase", "admin-login.json");
    const metadata = await stat(file);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
      console.error("Local test-admin login file must be owner-readable only.");
      return NextResponse.json({ error: "The local test-admin login file must have owner-only permissions." }, { status: 503 });
    }
    const login = localLoginSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    if (!login.success) {
      console.error("Local test-admin login file is invalid.");
      return NextResponse.json({ error: "The local test-admin login file is invalid." }, { status: 503 });
    }
    const { data, error } = await createAuthClient().auth.signInWithPassword(login.data);
    if (error || !data.session) {
      console.error("Local test-admin authentication failed.");
      return NextResponse.json({ error: "Local test-admin authentication failed. Check the local fixtures." }, { status: 401 });
    }
    if (data.user?.app_metadata?.role !== "admin") {
      console.error("Local test account does not have the admin role.");
      return NextResponse.json({ error: "The local test account must have the admin role." }, { status: 403 });
    }
    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "no-store");
    setAuthCookies(response, data.session);
    return response;
  } catch {
    console.error("Local test-admin login is unavailable. Check local Supabase and the ignored login file.");
    return NextResponse.json({ error: "Local test-admin login is unavailable. Check local Supabase and the ignored login file." }, { status: 503 });
  }
}
