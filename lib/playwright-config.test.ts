// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Playwright configuration", () => {
  it("serves localhost:3000 with a fresh browser context and reuses a running dev server locally", async () => {
    vi.stubEnv("CI", "");
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("http://localhost:3000");
    expect(config.use?.storageState).toEqual({ cookies: [], origins: [] });
    expect(config.webServer).toMatchObject({
      command: "npm run dev -- --port 3000 --hostname 127.0.0.1",
      url: "http://localhost:3000",
      reuseExistingServer: true,
    });
  });

  it("starts its own server in CI", async () => {
    vi.stubEnv("CI", "true");
    const { default: config } = await import("../playwright.config");
    expect(config.webServer).toMatchObject({ reuseExistingServer: false });
  });
});
