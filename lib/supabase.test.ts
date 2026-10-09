import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { createAdminClient, createAuthClient, PHOTO_ID_BUCKET } from "./supabase";

describe("Supabase clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    createClient.mockReturnValue({ client: true });
  });

  it("requires both admin credentials and creates a non-persisted service client", () => {
    expect(() => createAdminClient()).toThrow("Supabase is not configured");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    expect(() => createAdminClient()).toThrow("Supabase is not configured");

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    expect(createAdminClient()).toEqual({ client: true });
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("requires both auth credentials and creates an anonymous client", () => {
    expect(() => createAuthClient()).toThrow("Supabase auth is not configured");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");

    expect(createAuthClient()).toEqual({ client: true });
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("exports the booking photo bucket name", () => {
    expect(PHOTO_ID_BUCKET).toBe("booking-photo-ids");
  });

  it("uses only local credentials in development, ignoring hosted credentials", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SUPABASE_URL", "https://production.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "hosted-service");
    expect(() => createAdminClient()).toThrow("Local Supabase is not configured");
    vi.stubEnv("LOCAL_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("LOCAL_SUPABASE_SERVICE_ROLE_KEY", "local-service");
    vi.stubEnv("LOCAL_SUPABASE_ANON_KEY", "local-anon");
    createAdminClient();
    createAuthClient();
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "local-service", expect.any(Object));
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "local-anon", expect.any(Object));
  });

  it("blocks hosted URLs and hosted overrides in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_SUPABASE_URL", "https://production.supabase.co");
    vi.stubEnv("LOCAL_SUPABASE_ANON_KEY", "local-anon");
    expect(() => createAuthClient()).toThrow("loopback");
    vi.stubEnv("SUPABASE_TARGET", "hosted");
    expect(() => createAuthClient()).toThrow("cannot connect to hosted");
  });

  it("keeps production hosted and refuses local databases on Vercel", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    createAuthClient();
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "anon-key", expect.any(Object));
    vi.stubEnv("SUPABASE_TARGET", "local");
    vi.stubEnv("VERCEL", "1");
    expect(() => createAdminClient()).toThrow("Vercel");
  });

  it("defaults local production-mode servers to the local database", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("SUPABASE_URL", "https://production.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "hosted-service");
    expect(() => createAdminClient()).toThrow("Local Supabase is not configured");
    vi.stubEnv("LOCAL_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("LOCAL_SUPABASE_SERVICE_ROLE_KEY", "local-service");
    createAdminClient();
    expect(createClient).toHaveBeenCalledWith("http://localhost:54321", "local-service", expect.any(Object));
  });

  it("rejects unknown targets and embedded credentials in local URLs", () => {
    vi.stubEnv("SUPABASE_TARGET", "invalid");
    expect(() => createAdminClient()).toThrow("must be local or hosted");
    vi.stubEnv("SUPABASE_TARGET", "local");
    vi.stubEnv("LOCAL_SUPABASE_URL", "http://user:password@localhost:54321");
    vi.stubEnv("LOCAL_SUPABASE_SERVICE_ROLE_KEY", "local-service");
    expect(() => createAdminClient()).toThrow("loopback");
  });
});
