import { describe, expect, it } from "vitest";
import { localConfig, localEnvironment, localSettings, validateStatus } from "../scripts/local-db.mjs";

describe("local database tooling", () => {
  it("allocates stable, separate stack identities and port ranges for worktrees", () => {
    const first = localSettings("/tmp/peppermint-a");
    expect(localSettings("/tmp/peppermint-a")).toEqual(first);
    const second = localSettings("/tmp/peppermint-b");
    expect(second.project).not.toBe(first.project);
    expect(second.apiPort).not.toBe(first.apiPort);
    expect(first.apiPort).toBeGreaterThan(20000);
    expect(first.poolerPort).toBeLessThan(50000);
    expect(localConfig(first)).toContain(`project_id = "${first.project}"`);
    expect(localConfig(first)).toContain("enable_signup = false");
    expect(localConfig(first)).toContain("[auth.email]\nenable_signup = true");
  });

  it("rejects hosted and mismatched database status before any writes", () => {
    const settings = localSettings("/tmp/peppermint-a");
    const status = {
      API_URL: `http://127.0.0.1:${settings.apiPort}`,
      DB_URL: `postgresql://postgres:local@127.0.0.1:${settings.dbPort}/postgres`,
      ANON_KEY: "test-anon", SERVICE_ROLE_KEY: "test-service",
    };
    expect(validateStatus(status, settings)).toBe(status);
    expect(() => validateStatus({ ...status, API_URL: "https://example.supabase.co" }, settings)).toThrow("local-only");
    expect(() => validateStatus({ ...status, DB_URL: "postgresql://postgres:local@remote:5432/postgres" }, settings)).toThrow("local-only");
    expect(() => validateStatus({ ...status, SERVICE_ROLE_KEY: "" }, settings)).toThrow("local-only");
    expect(() => validateStatus({ ...status, API_URL: "http://127.0.0.1:1" }, settings)).toThrow("local-only");
    expect(localEnvironment(status)).toEqual({
      SUPABASE_TARGET: "local", LOCAL_SUPABASE_URL: status.API_URL,
      LOCAL_SUPABASE_ANON_KEY: "test-anon", LOCAL_SUPABASE_SERVICE_ROLE_KEY: "test-service",
    });
    expect(localEnvironment(status)).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  });
});
