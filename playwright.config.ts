import { defineConfig, devices } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

function portForWorktreePath(root: string) {
  const hash = createHash("sha256").update(path.resolve(root)).digest();
  return 3100 + (hash.readUInt32BE(0) % 1000);
}

export function resolvePort({ configuredPort = process.env.PORT, root = process.cwd() } = {}) {
  const gitMetadata = path.join(root, ".git");
  const isWorktree = existsSync(gitMetadata) && statSync(gitMetadata).isFile();
  const defaultPort = isWorktree ? portForWorktreePath(root) : 3000;
  const value = configuredPort?.trim() ? configuredPort : defaultPort;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

const port = resolvePort();
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    storageState: { cookies: [], origins: [] },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --hostname 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "macbook-air-13",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: "macbook-pro-14",
      use: {
        browserName: "chromium",
        viewport: { width: 1512, height: 982 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: "macbook-pro-16",
      use: {
        browserName: "chromium",
        viewport: { width: 1728, height: 1117 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 12"], browserName: "chromium" },
    },
  ],
});
