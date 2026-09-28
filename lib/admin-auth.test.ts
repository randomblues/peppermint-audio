import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, createAuthClient, createAdminClient, getUser } = vi.hoisted(() => ({
  cookies: vi.fn(),
  createAuthClient: vi.fn(),
  createAdminClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/supabase", () => ({ createAuthClient, createAdminClient }));

import { requireAdmin } from "./admin-auth";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    createAuthClient.mockReturnValue({ auth: { getUser } });
    createAdminClient.mockReturnValue({ storage: "admin-storage" });
  });

  it("returns null without an access-token cookie", async () => {
    await expect(requireAdmin()).resolves.toBeNull();
    expect(createAuthClient).not.toHaveBeenCalled();
  });

  it("returns null for invalid tokens and does not create an admin client", async () => {
    const get = vi.fn().mockReturnValue({ value: "bad-token" });
    cookies.mockResolvedValue({ get });
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    await expect(requireAdmin()).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledWith("bad-token");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns the authenticated user and admin client", async () => {
    const user = { id: "user-1", email: "admin@example.com" };
    cookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "good-token" }) });
    getUser.mockResolvedValue({ data: { user }, error: null });
    await expect(requireAdmin()).resolves.toEqual({ user, admin: { storage: "admin-storage" } });
    expect(createAdminClient).toHaveBeenCalledOnce();
  });
});
