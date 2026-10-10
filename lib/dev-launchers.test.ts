import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const detachedScript = path.join(root, "scripts", "dev-detached.sh");
const stopScript = path.join(root, "scripts", "dev-stop.sh");
const stripeScript = path.join(root, "scripts", "dev-stripe-detached.sh");
const systemPath = process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin";

function fakeTools() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "peppermint-dev-launcher-"));
  const bin = path.join(directory, "bin");
  mkdirSync(bin);
  const lsof = path.join(bin, "lsof");
  const npm = path.join(bin, "npm");
  writeFileSync(lsof, "#!/bin/sh\nif [ -n \"${FAKE_LISTENER_PIDS:-}\" ]; then printf '%s\\n' \"$FAKE_LISTENER_PIDS\"; exit 0; fi\nexit 1\n");
  writeFileSync(npm, "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$LAUNCH_CAPTURE\"\nprintf '%s\\n' \"${PORT:-}\" \"${LOCAL_STRIPE_WEBHOOKS:-}\" >> \"$LAUNCH_CAPTURE\"\nprintf 'fake server startup\\n'\n");
  chmodSync(lsof, 0o755);
  chmodSync(npm, 0o755);
  return { directory, bin };
}

function runScript(script: string, bin: string, env: Partial<NodeJS.ProcessEnv>) {
  return spawnSync("/bin/bash", [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env, PATH: `${bin}:${systemPath}` },
  });
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForFile(file: string) {
  const deadline = Date.now() + 3000;
  while (!existsSync(file) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  if (!existsSync(file)) throw new Error(`Timed out waiting for ${file}`);
}

describe("detached development launchers", () => {
  it("refuses to start when the requested port already has a listener", () => {
    const tools = fakeTools();
    const capture = path.join(tools.directory, "capture");
    try {
      const result = runScript(detachedScript, tools.bin, {
        PORT: "4300",
        FAKE_LISTENER_PIDS: "12345",
        LAUNCH_CAPTURE: capture,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Port 4300 already has a listener");
      expect(existsSync(capture)).toBe(false);
    } finally {
      rmSync(tools.directory, { recursive: true, force: true });
    }
  });

  it("starts npm run dev in the background with the selected port and log path", async () => {
    const tools = fakeTools();
    const capture = path.join(tools.directory, "capture");
    const port = await unusedPort();
    const log = `/tmp/dev-${port}.log`;
    if (existsSync(log)) {
      rmSync(tools.directory, { recursive: true, force: true });
      throw new Error(`Refusing to overwrite existing launcher log ${log}`);
    }
    try {
      const result = runScript(detachedScript, tools.bin, {
        PORT: String(port),
        LAUNCH_CAPTURE: capture,
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`port ${port}`);
      expect(result.stdout).toContain(log);
      await waitForFile(capture);
      expect(readFileSync(capture, "utf8")).toBe(`run\ndev\n--\n--port\n${port}\n${port}\n\n`);
      expect(readFileSync(log, "utf8")).toContain("fake server startup");
    } finally {
      rmSync(log, { force: true });
      rmSync(tools.directory, { recursive: true, force: true });
    }
  });

  it("enables the integrated Stripe webhook forwarder through the detached launcher", async () => {
    const tools = fakeTools();
    const capture = path.join(tools.directory, "capture");
    const port = await unusedPort();
    const log = `/tmp/dev-${port}.log`;
    if (existsSync(log)) {
      rmSync(tools.directory, { recursive: true, force: true });
      throw new Error(`Refusing to overwrite existing launcher log ${log}`);
    }
    try {
      const result = runScript(stripeScript, tools.bin, {
        PORT: String(port),
        LAUNCH_CAPTURE: capture,
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Stripe test-mode forwarding is enabled");
      await waitForFile(capture);
      expect(readFileSync(capture, "utf8")).toContain("true");
    } finally {
      rmSync(log, { force: true });
      rmSync(tools.directory, { recursive: true, force: true });
    }
  });

  it("stops the PID reported as listening on the requested port", async () => {
    const tools = fakeTools();
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    const childExit = new Promise<void>(resolve => child.once("exit", () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      const result = runScript(stopScript, tools.bin, {
        PORT: "4300",
        FAKE_LISTENER_PIDS: String(child.pid),
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Sent termination signal");
      await childExit;
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      rmSync(tools.directory, { recursive: true, force: true });
    }
  });
});
