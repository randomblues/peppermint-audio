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
});
