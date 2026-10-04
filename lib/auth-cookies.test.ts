import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { REFRESH_COOKIE_MAX_AGE, setAuthCookies } from "./auth-cookies";

describe("setAuthCookies", () => {
  it("keeps the refresh token available beyond the short access-token lifetime", () => {
    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, {
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
    });

    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("supabase-access-token=access");
    expect(cookies).toContain("supabase-refresh-token=refresh");
    expect(cookies).toContain(`Max-Age=${REFRESH_COOKIE_MAX_AGE}`);
  });
});
