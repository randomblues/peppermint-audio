import { NextResponse } from "next/server";

import { exchangeGoogleCalendarCode } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Google did not return an authorization code." }, { status: 400 });
  }

  try {
    const refreshToken = await exchangeGoogleCalendarCode(code);

    if (!refreshToken) {
      return NextResponse.json(
        {
          error:
            "Google did not return a refresh token. Remove the app permission from your Google Account and connect again.",
        },
        { status: 400 },
      );
    }

    return new NextResponse(
      [
        "Google Calendar connected.",
        "",
        "Add this value to Vercel as GOOGLE_CALENDAR_REFRESH_TOKEN:",
        "",
        refreshToken,
        "",
        "Then redeploy the site. You can close this window.",
      ].join("\n"),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not connect Google Calendar. Check your OAuth configuration and try again." },
      { status: 500 },
    );
  }
}
