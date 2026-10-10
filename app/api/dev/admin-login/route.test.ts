import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(), stat: vi.fn(), signIn: vi.fn(), connection: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual, readFile: mocks.readFile, stat: mocks.stat,
    default: { ...actual, readFile: mocks.readFile, stat: mocks.stat },
  };
});
vi.mock("@/lib/supabase-config", () => ({ supabaseConnection: mocks.connection }));
vi.mock("@/lib/supabase", () => ({
  createAuthClient: () => ({ auth: { signInWithPassword: mocks.signIn } }),
}));

import { POST } from "./route";

function request(url = "http://localhost:3000/api/dev/admin-login", origin: string | null = "http://localhost:3000") {
  return new Request(url, { method: "POST", headers: origin ? { origin } : {} });
}

describe("local test-admin login", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    mocks.connection.mockReturnValue({ url: "http://127.0.0.1:30071", key: "dummy" });
    mocks.stat.mockResolvedValue({ isFile: () => true, mode: 0o100600 });
    mocks.readFile.mockResolvedValue(JSON.stringify({ email: "admin@peppermint.local", password: "disposable-test-password" }));
    mocks.signIn.mockResolvedValue({
      data: {
        user: { app_metadata: { role: "admin" } },
        session: { access_token: "dummy-access", refresh_token: "dummy-refresh", expires_in: 3600 },
      },
      error: null,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("authenticates local fixtures and returns HTTP-only cookies without credentials", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.cookies.get("supabase-access-token")?.httpOnly).toBe(true);
    expect(response.cookies.get("supabase-refresh-token")?.httpOnly).toBe(true);
    expect(mocks.connection).toHaveBeenCalledWith("auth");
    expect(mocks.readFile).toHaveBeenCalledWith(expect.stringContaining(".local-supabase/admin-login.json"), "utf8");
  });

  it.each(["production", "test"])("is unavailable in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("is unavailable on Vercel even in development", async () => {
    vi.stubEnv("VERCEL", "1");
    expect((await POST(request())).status).toBe(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it.each([
    ["http://example.com/api/dev/admin-login", "http://example.com"],
    ["http://localhost:3000/api/dev/admin-login", "http://example.com"],
    ["http://localhost:3000/api/dev/admin-login", null],
    ["http://localhost:3000/api/dev/admin-login", "http://localhost:3001"],
  ])("rejects non-loopback or cross-origin requests: %s, %s", async (url, origin) => {
    expect((await POST(request(url, origin))).status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("does not read credentials when local Supabase configuration is rejected", async () => {
    mocks.connection.mockImplementationOnce(() => { throw new Error("Hosted connections are blocked"); });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("rejects permissive credential file permissions", async () => {
    mocks.stat.mockResolvedValue({ isFile: () => true, mode: 0o100644 });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it.each(["not-json", '{"email":"production@example.com","password":"dummy"}', "{}"])("rejects invalid or non-local fixtures", async (contents) => {
    mocks.readFile.mockResolvedValue(contents);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("reports missing fixtures without exposing file contents", async () => {
    mocks.stat.mockRejectedValueOnce(new Error("Missing file"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("reports authentication failure without issuing cookies", async () => {
    mocks.signIn.mockResolvedValue({ data: { session: null }, error: { message: "Invalid login" } });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("requires the admin role before issuing cookies", async () => {
    mocks.signIn.mockResolvedValue({
      data: { user: { app_metadata: {} }, session: { access_token: "dummy", refresh_token: "dummy", expires_in: 3600 } },
      error: null,
    });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
