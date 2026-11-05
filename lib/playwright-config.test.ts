// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { portForWorktreePath } from "../scripts/agent-worktree.mjs";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Playwright configuration", () => {
  it("uses the default port, a fresh browser context, and its own server", async () => {
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("CI", "");
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("http://localhost:3000");
    expect(config.use?.storageState).toEqual({ cookies: [], origins: [] });
    expect(config.webServer).toMatchObject({
      command: "npm run dev -- --port 3000 --hostname 127.0.0.1",
      url: "http://localhost:3000",
      reuseExistingServer: false,
    });
  });

  it("uses the worktree-specific port for its own server", async () => {
    vi.stubEnv("PORT", "3157");
    const { default: config } = await import("../playwright.config");
    expect(config.use?.baseURL).toBe("http://localhost:3157");
    expect(config.webServer).toMatchObject({
      command: "npm run dev -- --port 3157 --hostname 127.0.0.1",
      url: "http://localhost:3157",
      reuseExistingServer: false,
    });
  });

  it("chooses a stable port automatically for a VS Code-created worktree", async () => {
    vi.stubEnv("PORT", "");
    const root = mkdtempSync(path.join(os.tmpdir(), "peppermint-playwright-worktree-"));
    try {
      writeFileSync(path.join(root, ".git"), "gitdir: /tmp/worktrees/example\n");
      const { resolvePort } = await import("../playwright.config");
      expect(resolvePort({ configuredPort: "", root })).toBe(portForWorktreePath(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an invalid port", async () => {
    vi.stubEnv("PORT", "70000");
    await expect(import("../playwright.config")).rejects.toThrow("PORT must be an integer");
  });
});
