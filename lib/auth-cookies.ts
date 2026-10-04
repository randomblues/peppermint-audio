import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "supabase-access-token";
export const REFRESH_TOKEN_COOKIE = "supabase-refresh-token";
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export function setAuthCookies(response: NextResponse, session: AuthSession) {
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...baseOptions,
    maxAge: session.expires_in,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...baseOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}
