import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import { purgeExpiredCustomerEmailHistory } from "@/lib/email-log";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await purgeExpiredCustomerEmailHistory(createAdminClient());
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("Email history cleanup failed:", error);
    return NextResponse.json({ error: "Email history cleanup failed. Check server logs." }, { status: 500 });
  }
}
