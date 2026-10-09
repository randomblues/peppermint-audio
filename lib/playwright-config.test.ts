// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const file = vi.hoisted(() => ({ exists: false, contents: "" }));
vi.mock("node:fs", () => ({
  existsSync: () => file.exists,
  readFileSync: () => file.contents,
}));

afterEach(() => {
  file.exists = false;
  file.contents = "";
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Playwright session configuration", () => {
  it("preserves the default localhost server outside isolated worktrees", async () => {
    vi.stubEnv("CI", "");
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("http://localhost:3000");
    expect(config.webServer).toMatchObject({ reuseExistingServer: true });
  });

  it("uses the reserved port, a fresh browser context and never reuses another server", async () => {
    file.exists = true;
    file.contents = JSON.stringify({ port: 3210 });
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("http://localhost:3210");
    expect(config.use?.storageState).toEqual({ cookies: [], origins: [] });
    expect(config.webServer).toMatchObject({
      command: "npm run dev -- --port 3210 --hostname 127.0.0.1",
      url: "http://localhost:3210",
      reuseExistingServer: false,
    });
  });

  it.each([{}, { port: "3210" }, { port: 3000 }, { port: 4000 }, { port: 3210.5 }, null])("fails for invalid session metadata %j", async session => {
    file.exists = true;
    file.contents = JSON.stringify(session);
    await expect(import("../playwright.config")).rejects.toThrow("Invalid isolated-session port");
  });

  it("surfaces corrupt JSON instead of falling back to the shared server", async () => {
    file.exists = true;
    file.contents = "{";
    await expect(import("../playwright.config")).rejects.toThrow();
  });
});
