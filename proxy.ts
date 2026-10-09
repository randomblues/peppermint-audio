import { createAuthClient } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, setAuthCookies } from "@/lib/auth-cookies";

const REFRESH_WINDOW_SECONDS = 60;

function tokenExpiresSoon(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized)) as { exp?: number };
    return !decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000) + REFRESH_WINDOW_SECONDS;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/admin/login" || path === "/api/admin/login" || path === "/api/admin/logout") {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!accessToken || !refreshToken || !tokenExpiresSoon(accessToken)) return NextResponse.next();

  const auth = createAuthClient();
  const { data, error } = await auth.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return NextResponse.next();

  request.cookies.set(ACCESS_TOKEN_COOKIE, data.session.access_token);
  request.cookies.set(REFRESH_TOKEN_COOKIE, data.session.refresh_token);
  const response = NextResponse.next({ request });
  setAuthCookies(response, data.session);
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
