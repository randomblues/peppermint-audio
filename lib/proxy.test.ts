// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createAuthClient, refreshSession } = vi.hoisted(() => ({
  createAuthClient: vi.fn(), refreshSession: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ createAuthClient }));

import { proxy } from "../proxy";

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: token ? { cookie: `supabase-access-token=${token}; supabase-refresh-token=refresh` } : {},
  });
}

describe("admin session proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthClient.mockReturnValue({ auth: { refreshSession } });
  });

  it("leaves login, logout and unauthenticated requests untouched", async () => {
    for (const path of ["/admin/login", "/api/admin/login", "/api/admin/logout"]) {
      await proxy(request(path, "expired"));
    }
    await proxy(request("/admin"));
    expect(createAuthClient).not.toHaveBeenCalled();
  });

  it("refreshes through the same environment-selected auth client as login", async () => {
    refreshSession.mockResolvedValue({
      data: { session: { access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 } },
      error: null,
    });
    const response = await proxy(request("/api/admin/bookings", "expired"));
    expect(createAuthClient).toHaveBeenCalledOnce();
    expect(refreshSession).toHaveBeenCalledWith({ refresh_token: "refresh" });
    expect(response.cookies.get("supabase-access-token")?.value).toBe("new-access");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("supabase-access-token=new-access");
  });

  it("does not refresh a still-valid access token", async () => {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await proxy(request("/admin", `header.${payload}.signature`));
    expect(createAuthClient).not.toHaveBeenCalled();
  });

  it("does not replace cookies when refresh fails", async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "Invalid refresh token" } });
    const response = await proxy(request("/admin", "expired"));
    expect(response.cookies.getAll()).toHaveLength(0);
  });
});
