import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), signIn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile, default: { readFile: mocks.readFile } }));
vi.mock("@/lib/supabase", () => ({
  createAuthClient: () => ({ auth: { signInWithPassword: mocks.signIn } }),
}));

import { POST } from "./route";

function request(url = "http://localhost:3000/api/dev/admin-login", origin: string | null = "http://localhost:3000") {
  return new Request(url, { method: "POST", headers: origin ? { origin } : {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("SUPABASE_TARGET", "local");
  mocks.readFile.mockResolvedValue(JSON.stringify({ email: "admin@peppermint.local", password: "disposable-test-password" }));
  mocks.signIn.mockResolvedValue({
    data: {
      user: { app_metadata: { role: "admin" } },
      session: { access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 },
    }, error: null,
  });
});

describe("agent local test-admin sign-in", () => {
  it("signs into real local Auth and returns only normal HTTP-only session cookies", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "admin@peppermint.local", password: "disposable-test-password" });
    expect(response.cookies.get("supabase-access-token")?.value).toBe("test-access");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it.each(["production", "test"])("is unavailable in %s before reading credentials", async environment => {
    vi.stubEnv("NODE_ENV", environment);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("is unavailable on Vercel even with development/local settings", async () => {
    vi.stubEnv("VERCEL", "1");
    expect((await POST(request())).status).toBe(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it.each<[string, string | null]>([
    ["http://localhost:3000/api/dev/admin-login", null],
    ["http://localhost:3000/api/dev/admin-login", "https://attacker.example"],
    ["https://preview.example/api/dev/admin-login", "https://preview.example"],
  ])("rejects non-local or cross-origin access", async (url, origin) => {
    expect((await POST(request(url, origin))).status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("uses the incoming loopback Host when Next normalizes the internal request URL", async () => {
    const input = request("http://localhost:3000/api/dev/admin-login", "http://127.0.0.1:3000");
    input.headers.set("host", "127.0.0.1:3000");
    expect((await POST(input)).status).toBe(200);
    input.headers.set("host", "preview.example");
    expect((await POST(input)).status).toBe(403);
  });

  it("reports missing fixtures without logging credential contents", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.readFile.mockRejectedValue(new Error("Sensitive contents must not be logged"));
    try {
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: expect.stringContaining("db:local:seed") });
      expect(JSON.stringify(log.mock.calls)).not.toContain("Sensitive contents");
    } finally { log.mockRestore(); }
  });

  it("does not create a session for a non-admin account", async () => {
    mocks.signIn.mockResolvedValue({
      data: { user: { app_metadata: {} }, session: { access_token: "not-admin" } }, error: null,
    });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toHaveLength(0);
  });
});
