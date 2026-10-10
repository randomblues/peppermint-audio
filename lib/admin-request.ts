import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";

type AdminSession = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>;

export async function requireAdminJson<T>(request: Request): Promise<{ session: AdminSession; body: T } | { response: NextResponse }> {
  const session = await requireAdmin();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  try {
    return { session, body: await request.json() as T };
  } catch {
    return { response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
  }
}
