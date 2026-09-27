import { NextResponse } from "next/server";

import { getGoogleCalendarAuthorizationUrl } from "@/lib/google-calendar";

export async function GET() {
  try {
    return NextResponse.redirect(getGoogleCalendarAuthorizationUrl());
  } catch {
    return NextResponse.json(
      { error: "Google Calendar is not configured yet." },
      { status: 500 },
    );
  }
}
