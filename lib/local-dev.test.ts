import { afterEach, describe, expect, it, vi } from "vitest";
import type { existsSync } from "node:fs";
import {
  ensureDocker, prepareLocalStack, localConfig, localDevPort, localEmailStartupMessage, localEnvironment,
  localSettings, localStripeWebhooksEnabled, progressPrinter, extractStripeWebhookSecret,
  redact, runBounded, stalledStartMessage, stripeWebhookForwarderArgs, superviseStart, validateStatus, waitForDatabaseHealth,
} from "../scripts/local-dev.mjs";

describe("automatic local startup", () => {
  function engine() {
    let time = 0;
    return {
      run: vi.fn(), platform: "darwin" as NodeJS.Platform, exists: vi.fn<typeof existsSync>(() => true), home: "/Users/test",
      now: () => time, sleep: vi.fn(async (ms: number) => { time += ms; }),
    };
  }

  it("reuses any responding engine without looking for or launching Desktop", async () => {
    const deps = engine();
    await ensureDocker(deps);
    expect(deps.run).toHaveBeenCalledExactlyOnceWith("docker", ["info", "--format", "{{.ServerVersion}}"],
      { timeout: 5_000, stdio: "ignore" });
    expect(deps.exists).not.toHaveBeenCalled();
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("launches installed Desktop once and waits for the configured engine", async () => {
    const deps = engine();
    deps.run.mockImplementationOnce(() => { throw new Error("unavailable"); });
    await ensureDocker(deps);
    expect(deps.run.mock.calls.map(call => call[0])).toEqual(["docker", "open", "docker"]);
    expect(deps.run).toHaveBeenNthCalledWith(2, "open", ["-a", "/Applications/Docker.app"],
      { timeout: 5_000, stdio: "ignore" });
    expect(deps.sleep).toHaveBeenCalledExactlyOnceWith(5_000);
  });

  it("supports Desktop installed in the user's Applications directory", async () => {
    const deps = engine();
    deps.exists.mockImplementation(file => file === "/Users/test/Applications/Docker.app");
    deps.run.mockImplementationOnce(() => { throw new Error("unavailable"); });
    await ensureDocker(deps);
    expect(deps.run).toHaveBeenCalledWith("open", ["-a", "/Users/test/Applications/Docker.app"],
      { timeout: 5_000, stdio: "ignore" });
  });

  it("bounds both the total wait and every probe when Desktop never becomes ready", async () => {
    const deps = engine();
    deps.run.mockImplementation(command => { if (command === "docker") throw new Error("unavailable"); });
    await expect(ensureDocker(deps)).rejects.toThrow("within 120 seconds");
    expect(deps.now()).toBe(120_000);
    expect(deps.sleep.mock.calls.length).toBeLessThanOrEqual(24);
    expect(deps.run.mock.calls.filter(call => call[0] === "open")).toHaveLength(1);
    for (const call of deps.run.mock.calls) expect(call[2].timeout).toBeLessThanOrEqual(5_000);
  });

  it.each(["missing-cli", "missing-desktop", "non-mac", "launch-failed"])("gives actionable %s errors", async failure => {
    const deps = engine();
    deps.run.mockImplementation(() => { throw Object.assign(new Error("unavailable"),
      failure === "missing-cli" ? { code: "ENOENT" } : {}); });
    if (failure === "missing-desktop") deps.exists.mockReturnValue(false);
    if (failure === "non-mac") deps.platform = "linux";
    const expected = {
      "missing-cli": "Docker CLI is missing",
      "missing-desktop": "Docker Desktop is not installed",
      "non-mac": "Start your configured Docker engine",
      "launch-failed": "Could not launch Docker Desktop",
    }[failure];
    await expect(ensureDocker(deps)).rejects.toThrow(expected);
    expect(deps.sleep).not.toHaveBeenCalled();
    if (failure !== "launch-failed") expect(deps.run.mock.calls).toHaveLength(1);
  });

  function stack(state = "running") {
    return {
      ensureEngine: vi.fn(async () => {}),
      stackState: vi.fn(() => state), startStack: vi.fn(),
      readStatus: vi.fn(() => ({ API_URL: "http://127.0.0.1:30071" })),
      applyMigration: vi.fn(async () => {}),
    };
  }

  it("reuses a healthy local stack and safely applies the canonical migration", async () => {
    const deps = stack();
    expect(await prepareLocalStack(deps)).toEqual(deps.readStatus.mock.results[0].value);
    expect(deps.startStack).not.toHaveBeenCalled();
    expect(deps.applyMigration).toHaveBeenCalledExactlyOnceWith({ API_URL: "http://127.0.0.1:30071" });
  });

  it.each(["", "exited", "created", "dead"])("starts an absent/stopped stack (%s) exactly once", async state => {
    const deps = stack(state);
    await prepareLocalStack(deps);
    expect(deps.startStack).toHaveBeenCalledTimes(1);
    expect(deps.readStatus).toHaveBeenCalledTimes(1);
    expect(deps.applyMigration).toHaveBeenCalledTimes(1);
  });

  it("does not swallow unexpected status errors or blindly start unhealthy stacks", async () => {
    const deps = stack();
    deps.readStatus.mockImplementation(() => { throw new Error("Unexpected status failure"); });
    await expect(prepareLocalStack(deps)).rejects.toThrow("Unexpected status failure");
    expect(deps.startStack).not.toHaveBeenCalled();
    expect(deps.applyMigration).not.toHaveBeenCalled();
  });

  it.each(["paused", "restarting", "unexpected"])("reports unexpected container state %s", async state => {
    const deps = stack(state);
    await expect(prepareLocalStack(deps)).rejects.toThrow(`database is ${state}`);
    expect(deps.startStack).not.toHaveBeenCalled();
    expect(deps.readStatus).not.toHaveBeenCalled();
  });

  it("stops before migration if startup fails", async () => {
    const deps = stack("");
    deps.startStack.mockImplementation(() => { throw new Error("start failed"); });
    await expect(prepareLocalStack(deps)).rejects.toThrow("start failed");
    expect(deps.readStatus).not.toHaveBeenCalled();
  });
});

describe("bounded, observable stack startup", () => {
  it("awaits asynchronous stack inspection and status reads", async () => {
    const status = { API_URL: "http://127.0.0.1:30071" };
    const deps = {
      ensureEngine: vi.fn(async () => {}), stackState: vi.fn(async () => "created"),
      startStack: vi.fn(async () => {}), readStatus: vi.fn(async () => status), applyMigration: vi.fn(async () => {}),
    };
    expect(await prepareLocalStack(deps)).toBe(status);
    expect(deps.startStack).toHaveBeenCalledTimes(1);
    expect(deps.applyMigration).toHaveBeenCalledExactlyOnceWith(status);
  });

  it.each([["created", 1], ["exited", 0], ["", 0], ["running", 0]])(
    "clears an interrupted start only when the database is %s", async (state, clears) => {
      const order: string[] = [];
      const deps = {
        ensureEngine: vi.fn(async () => {}), stackState: vi.fn(async () => state),
        clearInterruptedStart: vi.fn(async () => { order.push("clear"); }),
        startStack: vi.fn(async () => { order.push("start"); }),
        readStatus: vi.fn(async () => ({})), applyMigration: vi.fn(async () => {}),
      };
      await prepareLocalStack(deps);
      expect(deps.clearInterruptedStart).toHaveBeenCalledTimes(clears);
      if (clears) expect(order).toEqual(["clear", "start"]);
    });

  it("waits for database health after start/reuse and before reading status", async () => {
    const order: string[] = [];
    const deps = {
      ensureEngine: vi.fn(async () => {}), stackState: vi.fn(async () => "running"),
      startStack: vi.fn(async () => { order.push("start"); }),
      waitForHealthy: vi.fn(async () => { order.push("health"); }),
      readStatus: vi.fn(async () => { order.push("status"); return {}; }), applyMigration: vi.fn(async () => {}),
    };
    await prepareLocalStack(deps);
    expect(order).toEqual(["health", "status"]);
    order.length = 0;
    deps.stackState.mockResolvedValue("exited");
    await prepareLocalStack(deps);
    expect(order).toEqual(["start", "health", "status"]);
  });

  function healthDeps(states: Array<string | Error>) {
    let time = 0;
    let index = 0;
    return {
      now: () => time, sleep: vi.fn(async (ms: number) => { time += ms; }), log: vi.fn(),
      health: vi.fn(async () => {
        const next = states[Math.min(index++, states.length - 1)];
        if (next instanceof Error) throw next;
        return next;
      }),
    };
  }

  it("returns immediately for a healthy database or one without a health check", async () => {
    for (const state of ["healthy\n", ""]) {
      const deps = healthDeps([state]);
      await waitForDatabaseHealth(deps);
      expect(deps.sleep).not.toHaveBeenCalled();
      expect(deps.log).not.toHaveBeenCalled();
    }
  });

  it("waits through starting and transient inspection errors after Docker restarts the stack", async () => {
    const deps = healthDeps(["starting", new Error("busy"), "starting", "healthy"]);
    await waitForDatabaseHealth({ ...deps, pollMs: 2_000 });
    expect(deps.health).toHaveBeenCalledTimes(4);
    expect(deps.log).toHaveBeenCalledExactlyOnceWith("Waiting for the local database to become healthy (starting)...");
  });

  it("fails with the last state once the health wait is exhausted", async () => {
    const deps = healthDeps(["unhealthy"]);
    await expect(waitForDatabaseHealth({ ...deps, timeoutMs: 90_000, pollMs: 2_000 }))
      .rejects.toThrow("did not become healthy within 90 seconds (last state: unhealthy)");
    expect(deps.now()).toBe(90_000);
    expect(deps.sleep.mock.calls.length).toBeLessThanOrEqual(45);
  });

  it("redacts credentials from progress and errors", () => {
    const text = redact([
      "DB URL: postgresql://postgres:pw@127.0.0.1:30072/postgres",
      "anon key: eyJhbGciOiJIUzI1NiJ9.payload.sig",
      "Secret key: sb_secret_abc123", "S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c",
      "Starting database...",
    ].join("\n"));
    expect(text).not.toMatch(/pw@|eyJ|sb_secret_abc|625729a0/);
    expect(text).toContain("Starting database...");
  });

  it("prints carriage-return progress line by line, without duplicates or secrets", () => {
    const lines: string[] = [];
    const print = progressPrinter(line => lines.push(line), "> ");
    print("Pulling 10%\rPulling 10%\rPull");
    print("ing 20%\nService role key: eyJsecret\n");
    print("Waiting for health checks...");
    expect(lines).toEqual(["> Pulling 10%", "> Pulling 20%", "> Service role key: [redacted]"]);
  });

  it("returns streamed child output without blocking", async () => {
    const chunks: string[] = [];
    const result = await runBounded(process.execPath, ["-e", "process.stderr.write('progress'); process.stdout.write('done')"],
      { timeout: 10_000, onStderr: chunk => chunks.push(chunk) });
    expect(result.stdout).toBe("done");
    expect(chunks.join("")).toBe("progress");
  });

  it("reports failed child exits with their stderr", async () => {
    await expect(runBounded(process.execPath, ["-e", "process.stderr.write('bad'); process.exit(3)"], { timeout: 10_000 }))
      .rejects.toMatchObject({ exitCode: 3, stderr: "bad" });
  });

  it("kills a hung child at the timeout instead of waiting", async () => {
    const started = Date.now();
    await expect(runBounded(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { timeout: 300 }))
      .rejects.toMatchObject({ code: "ETIMEDOUT" });
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("kills grandchildren of CLI wrappers so a timed-out start cannot linger", async () => {
    let grandchild = 0;
    const wrapper = [
      "const { spawn } = require('node:child_process');",
      "const native = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });",
      "process.stdout.write(String(native.pid));",
      "setInterval(() => {}, 1000);",
    ].join("\n");
    await expect(runBounded(process.execPath, ["-e", wrapper], {
      timeout: 1_500, onStdout: chunk => { grandchild = Number(chunk); },
    })).rejects.toMatchObject({ code: "ETIMEDOUT" });
    expect(grandchild).toBeGreaterThan(0);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(() => process.kill(grandchild, 0)).toThrow();
  });

  it("kills the child when aborted", async () => {
    const controller = new AbortController();
    const run = runBounded(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { timeout: 60_000, signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    await expect(run).rejects.toMatchObject({ code: "ABORT_ERR" });
  });

  function supervisor(states: Array<Map<string, string> | Error>) {
    let time = 0;
    let index = 0;
    let signal: AbortSignal | undefined;
    const start = vi.fn((abortSignal: AbortSignal) => {
      signal = abortSignal;
      return new Promise<string>((resolve, reject) => {
        abortSignal.addEventListener("abort", () => reject(Object.assign(new Error("stopped"), { code: "ABORT_ERR" })));
        if (states.length === 0) resolve("started");
      });
    });
    return {
      start, signal: () => signal, now: () => time,
      sleep: vi.fn(async (ms: number) => { time += ms; }),
      listStates: vi.fn(async () => {
        const next = states[Math.min(index++, states.length - 1)];
        if (next instanceof Error) throw next;
        return next;
      }),
    };
  }

  it("aborts quickly with a Docker diagnosis when a container never leaves Created", async () => {
    const deps = supervisor([new Map([["supabase_db_peppermint-x", "created"]])]);
    await expect(superviseStart({ ...deps, stallMs: 45_000, pollMs: 3_000 }))
      .rejects.toThrow(stalledStartMessage("supabase_db_peppermint-x", 45));
    expect(deps.signal()?.aborted).toBe(true);
    expect(deps.now()).toBeGreaterThanOrEqual(45_000);
    expect(deps.now()).toBeLessThanOrEqual(51_000);
    expect(stalledStartMessage("x", 45)).toContain("Restart Docker Desktop");
  });

  it("tolerates brief Created states and transient inspection failures", async () => {
    let finish: (value: string) => void = () => {};
    const deps = supervisor([
      new Map([["db", "created"]]), new Error("docker busy"), new Map([["db", "running"], ["kong", "created"]]),
      new Map([["db", "running"], ["kong", "running"]]),
    ]);
    deps.start.mockImplementation(() => new Promise<string>(resolve => { finish = resolve; }));
    deps.listStates.mockImplementationOnce(async () => new Map([["db", "created"]]))
      .mockImplementationOnce(async () => { throw new Error("docker busy"); })
      .mockImplementationOnce(async () => new Map([["db", "running"], ["kong", "created"]]))
      .mockImplementationOnce(async () => { finish("started"); return new Map([["db", "running"], ["kong", "running"]]); });
    const onPoll = vi.fn();
    await expect(superviseStart({ ...deps, stallMs: 45_000, pollMs: 3_000, onPoll })).resolves.toBe("started");
    expect(onPoll).toHaveBeenCalled();
  });

  it("propagates start failures without waiting for the stall threshold", async () => {
    const deps = supervisor([new Map()]);
    deps.start.mockImplementation(async () => { throw new Error("Local Supabase start failed: port in use"); });
    await expect(superviseStart({ ...deps, stallMs: 45_000 })).rejects.toThrow("port in use");
    expect(deps.now()).toBeLessThan(45_000);
  });
});

describe("local development tooling", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("enables local Stripe webhook forwarding only when explicitly configured", () => {
    expect(localStripeWebhooksEnabled(undefined)).toBe(false);
    expect(localStripeWebhooksEnabled("false", "LOCAL_STRIPE_WEBHOOKS=true")).toBe(false);
    expect(localStripeWebhooksEnabled(undefined, "LOCAL_STRIPE_WEBHOOKS=true")).toBe(true);
    expect(localStripeWebhooksEnabled(undefined, "export LOCAL_STRIPE_WEBHOOKS='true' # local test only")).toBe(true);
    expect(localStripeWebhooksEnabled(undefined, "LOCAL_STRIPE_WEBHOOKS=1")).toBe(false);
  });

  it("uses the configured local port and extracts/redacts webhook signing secrets", () => {
    expect(localDevPort([], "3000")).toBe(3000);
    expect(localDevPort(["--port", "3010"], "3000")).toBe(3010);
    expect(localDevPort(["--port=3011"], "3000")).toBe(3011);
    expect(localDevPort([], "3012")).toBe(3012);
    expect(extractStripeWebhookSecret("Ready! Your webhook signing secret is whsec_test_123-abc")).toBe("whsec_test_123-abc");
    expect(redact("webhook secret whsec_test_123-abc")).not.toContain("whsec_test_123-abc");
    const args = stripeWebhookForwarderArgs(3010);
    expect(args).toContain("http://127.0.0.1:3010/api/stripe/webhook");
    expect(args.find(argument => argument.startsWith("checkout.session.completed"))).toContain("payment_intent.succeeded");
    expect(args).not.toContain("--live");
  });

  it("prints the actual capture inbox and quota status", () => {
    expect(localEmailStartupMessage({
      LOCAL_EMAIL_MODE: "capture", LOCAL_EMAIL_INBOX_URL: "http://127.0.0.1:31004",
    })).toBe("Email mode: Local capture — no Resend quota used\nEmail inbox: http://127.0.0.1:31004");
  });

  it("warns about real delivery without claiming Resend uses the local inbox", () => {
    const message = localEmailStartupMessage({ LOCAL_EMAIL_MODE: "resend" });
    expect(message).toContain("real delivery uses Resend quota");
    expect(message).not.toContain("Email inbox:");
  });

  it("does not claim capture is active for an invalid mode", () => {
    expect(localEmailStartupMessage({ LOCAL_EMAIL_MODE: "invalid" })).toContain("delivery will be rejected");
  });

  it("injects this worktree's inbox and preserves explicitly controlled email mode", () => {
    vi.stubEnv("LOCAL_EMAIL_MODE", "resend");
    const environment = localEnvironment({
      API_URL: "http://127.0.0.1:31001", INBUCKET_URL: "http://127.0.0.1:31004",
      ANON_KEY: "test-anon", SERVICE_ROLE_KEY: "test-service",
    });
    expect(environment.LOCAL_EMAIL_MODE).toBe("resend");
    expect(environment.LOCAL_EMAIL_INBOX_URL).toBe("http://127.0.0.1:31004");
    expect(environment.SUPABASE_TARGET).toBe("local");
  });
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
      LOCAL_EMAIL_MODE: "capture", LOCAL_EMAIL_INBOX_URL: `http://127.0.0.1:${settings.apiPort + 3}`,
      LOCAL_SUPABASE_ANON_KEY: "test-anon", LOCAL_SUPABASE_SERVICE_ROLE_KEY: "test-service",
    });
    expect(localEnvironment(status)).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  });
});
