import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const sessionFile = ".copilot-dev-session.json";
const isolated = existsSync(sessionFile);
const session: unknown = isolated ? JSON.parse(readFileSync(sessionFile, "utf8")) : null;
if (isolated && (
  typeof session !== "object" || session === null || !("port" in session) ||
  typeof session.port !== "number" || !Number.isInteger(session.port) ||
  session.port < 3100 || session.port > 3999
)) {
  throw new Error("Invalid isolated-session port. Recreate the session configuration before running Playwright.");
}
const port = session !== null && typeof session === "object" && "port" in session
  ? session.port
  : 3000;
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
    reuseExistingServer: !isolated && !process.env.CI,
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
