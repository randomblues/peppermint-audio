import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import pg from "pg";

export function localSettings(root) {
  const hash = createHash("sha256").update(path.resolve(root)).digest("hex");
  const port = 20000 + (parseInt(hash.slice(0, 8), 16) % 3000) * 10;
  return {
    directory: path.join(root, ".local-supabase"),
    project: `peppermint-${hash.slice(0, 12)}`,
    apiPort: port + 1, dbPort: port + 2, studioPort: port + 3, mailPort: port + 4,
    shadowPort: port, poolerPort: port + 9,
  };
}

export function localConfig(settings) {
  return `project_id = "${settings.project}"
[api]
enabled = true
port = ${settings.apiPort}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = ${settings.dbPort}
shadow_port = ${settings.shadowPort}
major_version = 17
[db.pooler]
enabled = false
port = ${settings.poolerPort}
[db.seed]
enabled = false
[studio]
enabled = true
port = ${settings.studioPort}
api_url = "http://127.0.0.1"
[local_smtp]
enabled = true
port = ${settings.mailPort}
[storage]
enabled = true
file_size_limit = "50MiB"
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:*", "http://127.0.0.1:*"]
enable_signup = false
[auth.email]
enable_signup = true
enable_confirmations = false
[analytics]
enabled = false
[edge_runtime]
enabled = false
`;
}

export function redact(text) {
  return String(text)
    .replace(/((?:key|secret|token|password)\b[^:=\n]{0,20}[:=]\s*)\S+/gi, "$1[redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL redacted]")
    .replace(/\bwhsec_[A-Za-z0-9_+/=-]+/g, "[webhook secret redacted]")
    .replace(/\beyJ[\w.-]+/g, "[key redacted]")
    .replace(/\bsb_(?:secret|publishable)_\S+/g, "[key redacted]");
}

export function localStripeWebhooksEnabled(environmentValue, envFileContents = "") {
  let value = environmentValue;
  if (value === undefined) {
    const match = envFileContents.match(/^[ \t]*(?:export[ \t]+)?LOCAL_STRIPE_WEBHOOKS[ \t]*=[ \t]*(.*?)[ \t]*$/m);
    if (!match) return false;
    value = match[1].replace(/[ \t]+#.*$/, "").trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return value.trim().toLowerCase() === "true";
}

export function extractStripeWebhookSecret(text) {
  return String(text).match(/\bwhsec_[A-Za-z0-9_+/=-]+/)?.[0] ?? null;
}

export function localDevPort(args = [], defaultPort = process.env.PORT || "3000") {
  let value = defaultPort;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--port" || args[index] === "-p") value = args[index + 1];
    else if (args[index].startsWith("--port=")) value = args[index].slice("--port=".length);
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Local Stripe webhook forwarding requires a valid development port.");
  }
  return port;
}

function stripeCliEnvironment() {
  const keys = [
    "PATH", "HOME", "USERPROFILE", "USER", "LOGNAME", "TMPDIR", "TMP", "TEMP",
    "LANG", "LC_ALL", "TERM", "COLORTERM", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY",
    "NO_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR", "SYSTEMROOT",
  ];
  return Object.fromEntries(keys.filter(key => process.env[key]).map(key => [key, process.env[key]]));
}

export function stripeWebhookForwarderArgs(port) {
  const events = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "payment_intent.amount_capturable_updated",
    "payment_intent.succeeded",
    "payment_intent.canceled",
    "payment_intent.payment_failed",
  ].join(",");
  return [
    "listen", "--skip-update", "--events", events,
    "--forward-to", `http://127.0.0.1:${port}/api/stripe/webhook`,
  ];
}

export function startStripeWebhookForwarder(port, {
  spawnImpl = spawn, timeoutMs = 30_000, output = text => process.stdout.write(text),
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl("stripe", stripeWebhookForwarderArgs(port), {
      stdio: ["ignore", "pipe", "pipe"], env: stripeCliEnvironment(),
    });
    let outputBuffer = "";
    let settled = false;
    const timeout = setTimeout(() => {
      fail(new Error(`Stripe CLI did not provide a webhook secret within ${Math.ceil(timeoutMs / 1000)} seconds. Run stripe login and retry.`));
    }, timeoutMs);
    timeout.unref?.();

    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      reject(error);
    }

    function read(chunk) {
      const text = String(chunk);
      output(redact(text));
      if (settled) return;
      outputBuffer = `${outputBuffer}${text}`.slice(-512);
      const secret = extractStripeWebhookSecret(outputBuffer);
      if (secret) {
        settled = true;
        clearTimeout(timeout);
        resolve({ child, secret });
      }
    }

    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.once("error", error => {
      fail(new Error(`Could not start Stripe CLI (${error.message}). Install Stripe CLI, run stripe login, and retry.`));
    });
    child.once("exit", code => {
      fail(new Error(`Stripe CLI exited before webhook forwarding was ready (code ${code ?? "unknown"}). Run stripe login and retry.`));
    });
  });
}

// Async replacement for execFileSync: never blocks the event loop and always SIGKILLs the whole
// process group on timeout/abort (npm .bin wrappers otherwise leave the native CLI orphaned).
/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ timeout: number, env?: NodeJS.ProcessEnv, signal?: AbortSignal,
 *   onStdout?: (chunk: string) => void, onStderr?: (chunk: string) => void,
 *   spawnImpl?: typeof spawn, kill?: typeof process.kill }} options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function runBounded(command, args, {
  timeout, env, signal, onStdout, onStderr, spawnImpl = spawn, kill = process.kill,
}) {
  return new Promise((resolve, reject) => {
    let stdout = "", stderr = "", finished = false;
    const child = spawnImpl(command, args, { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    const killTree = () => {
      try {
        kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref?.();
    };
    const interrupt = received => {
      killTree();
      process.exit(received === "SIGINT" ? 130 : 143);
    };
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve(result);
    };
    const stop = (code, message) => {
      killTree();
      finish(Object.assign(new Error(message), { code }));
    };
    const timer = setTimeout(() => stop("ETIMEDOUT", `${path.basename(command)} ${args[0]} timed out after ${Math.round(timeout / 1000)} seconds`), timeout);
    const abort = () => stop("ABORT_ERR", `${path.basename(command)} ${args[0]} was stopped`);
    // The detached child no longer receives terminal Ctrl-C, so forward it.
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout?.on("data", chunk => { stdout += chunk; onStdout?.(String(chunk)); });
    child.stderr?.on("data", chunk => { stderr += chunk; onStderr?.(String(chunk)); });
    child.on("error", error => finish(error));
    child.on("close", code => {
      if (code === 0) finish(null, { stdout, stderr });
      else finish(Object.assign(new Error(`${path.basename(command)} ${args[0]} exited with code ${code}`), { exitCode: code }));
    });
  });
}

export function progressPrinter(write = line => console.log(line), prefix = "  supabase: ") {
  let buffer = "", last = "";
  return chunk => {
    buffer += chunk;
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = redact(raw.trim());
      if (line && line !== last) write(`${prefix}${line}`);
      if (line) last = line;
    }
  };
}

async function cli(root, settings, args, { timeout = 30_000, signal, onProgress } = {}) {
  try {
    const { stdout } = await runBounded(path.join(root, "node_modules", ".bin", "supabase"),
      [...args, "--workdir", settings.directory, "--yes"], { timeout, signal, onStderr: onProgress });
    return stdout;
  } catch (error) {
    if (error.code === "ABORT_ERR") throw error;
    const detail = redact(error.stderr?.trim() || error.stdout?.trim() || error.message);
    throw new Error(`Local Supabase ${args[0]} failed: ${detail}`, { cause: undefined });
  }
}

export function stalledStartMessage(name, seconds) {
  return `Docker created ${name} but did not start it within ${seconds} seconds. `
    + "The Docker engine is answering but not starting containers (this affects every container, not only Supabase). "
    + "Restart Docker Desktop and retry npm run dev. If it persists, update Docker Desktop or use its Troubleshoot menu, "
    + "and confirm `docker run --rm hello-world` completes.";
}

// Runs start() while polling container states; aborts quickly if any container is stuck in "created".
export async function superviseStart({
  start, listStates, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  stallMs = 45_000, pollMs = 3_000, onPoll = () => {},
}) {
  const controller = new AbortController();
  const began = now();
  let settled = false;
  const started = Promise.resolve().then(() => start(controller.signal));
  const done = started.then(() => { settled = true; }, () => { settled = true; });
  const createdSince = new Map();
  while (!settled) {
    await Promise.race([sleep(pollMs), done]);
    if (settled) break;
    let states;
    try {
      states = await listStates();
    } catch {
      continue;
    }
    if (settled) break;
    const time = now();
    for (const name of [...createdSince.keys()]) if (states.get(name) !== "created") createdSince.delete(name);
    for (const [name, state] of states) if (state === "created" && !createdSince.has(name)) createdSince.set(name, time);
    const stalled = [...createdSince].find(([, since]) => time - since >= stallMs);
    if (stalled) {
      controller.abort();
      await done;
      throw new Error(stalledStartMessage(stalled[0], Math.round(stallMs / 1000)));
    }
    onPoll(time - began);
  }
  return started;
}

async function dockerStates(project, signal) {
  const { stdout } = await runBounded("docker", [
    "ps", "-a", "--filter", `name=${project}`, "--format", "{{.Names}}\t{{.State}}",
  ], { timeout: 5_000, signal });
  return new Map(stdout.split("\n").filter(Boolean).map(line => line.split("\t")));
}

export function validateStatus(status, settings) {
  const api = new URL(status.API_URL);
  const db = new URL(status.DB_URL);
  if (api.hostname !== "127.0.0.1" || api.protocol !== "http:" || Number(api.port) !== settings.apiPort
    || db.hostname !== "127.0.0.1" || !["postgres:", "postgresql:"].includes(db.protocol)
    || Number(db.port) !== settings.dbPort || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error("Supabase status does not match this worktree's local-only database.");
  }
  return status;
}

async function statusFor(root, settings) {
  return validateStatus(JSON.parse(await cli(root, settings, ["status", "-o", "json"])), settings);
}

export async function ensureDocker({
  run = execFileSync, platform = process.platform, exists = existsSync,
  home = os.homedir(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
} = {}) {
  const deadline = now() + 120_000;
  const probe = () => {
    try {
      run("docker", ["info", "--format", "{{.ServerVersion}}"], {
        timeout: Math.max(1, Math.min(5_000, deadline - now())), stdio: "ignore",
      });
      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error("Docker CLI is missing. Install Docker and make docker available on PATH, then retry npm run dev.");
      }
      return false;
    }
  };
  if (probe()) return;
  if (platform !== "darwin") {
    throw new Error("Docker engine is unavailable. Start your configured Docker engine, then retry npm run dev.");
  }
  const desktop = ["/Applications/Docker.app", path.join(home, "Applications", "Docker.app")].find(exists);
  if (!desktop) {
    throw new Error("Docker engine is unavailable and Docker Desktop is not installed. Install Docker Desktop or start your configured engine, then retry npm run dev.");
  }
  try {
    console.log("Docker engine is not running. Launching Docker Desktop (waiting up to 120 seconds)...");
    run("open", ["-a", desktop], { timeout: 5_000, stdio: "ignore" });
  } catch {
    throw new Error("Could not launch Docker Desktop. Open it manually and wait for the engine, then retry npm run dev.");
  }
  // At most 24 retries, with each probe and the overall engine wait bounded.
  for (let attempt = 0; attempt < 24 && now() < deadline; attempt++) {
    await sleep(Math.min(5_000, deadline - now()));
    if (now() < deadline && probe()) return;
  }
  throw new Error("Docker engine did not become ready within 120 seconds. Check Docker Desktop and your configured Docker engine, then retry npm run dev.");
}

export async function prepareLocalStack({
  ensureEngine, stackState, startStack, readStatus, applyMigration, clearInterruptedStart = async () => {},
  waitForHealthy = async () => {},
}) {
  await ensureEngine();
  const state = await stackState();
  // A "created" database is left behind by an interrupted start; Supabase refuses to start over it.
  if (state === "created") await clearInterruptedStart();
  if (["", "exited", "created", "dead"].includes(state)) await startStack();
  else if (state !== "running") {
    throw new Error(`Local Supabase database is ${state}. Check this checkout's containers before retrying.`);
  }
  // Docker restarts the stack automatically when the engine launches; status fails until the database is healthy.
  await waitForHealthy();
  // Status failures (including partial/unhealthy stacks) must not trigger a blind start.
  const status = await readStatus();
  await applyMigration(status);
  return status;
}

export async function waitForDatabaseHealth({
  health, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 90_000, pollMs = 2_000, log = message => console.log(message),
}) {
  const deadline = now() + timeoutMs;
  let announced = false;
  for (;;) {
    let state;
    try {
      state = (await health()).trim();
    } catch {
      state = "unknown";
    }
    // An empty status means the container has no health check, so Supabase status is the next gate.
    if (state === "healthy" || state === "") return;
    if (now() >= deadline) {
      throw new Error(`Local Supabase database did not become healthy within ${Math.round(timeoutMs / 1000)} seconds (last state: ${state}). Check Docker Desktop, then retry npm run dev.`);
    }
    if (!announced) {
      log(`Waiting for the local database to become healthy (${state})...`);
      announced = true;
    }
    await sleep(Math.min(pollMs, Math.max(1, deadline - now())));
  }
}

async function startStack(root, settings) {
  mkdirSync(path.join(settings.directory, "supabase"), { recursive: true });
  const config = path.join(settings.directory, "supabase", "config.toml");
  if (!existsSync(config)) writeFileSync(config, localConfig(settings), { flag: "wx" });
  console.log(`Starting local Supabase (${settings.project}). Missing Docker images are downloaded first; progress follows.`);
  let lastOutput = Date.now();
  const print = progressPrinter();
  await superviseStart({
    start: signal => cli(root, settings, ["start"], {
      timeout: 600_000, signal, onProgress: chunk => { lastOutput = Date.now(); print(chunk); },
    }),
    listStates: () => dockerStates(settings.project),
    onPoll: elapsed => {
      if (Date.now() - lastOutput >= 15_000) {
        lastOutput = Date.now();
        console.log(`  supabase: still starting (${Math.round(elapsed / 1000)}s elapsed)...`);
      }
    },
  });
  console.log("Local Supabase started.");
}

export function startupLocalStack(root = process.cwd()) {
  const settings = localSettings(root);
  return prepareLocalStack({
    ensureEngine: () => ensureDocker(),
    stackState: async () => {
      try {
        const { stdout } = await runBounded("docker", [
          "ps", "-a", "--filter", `name=^supabase_db_${settings.project}$`, "--format", "{{.State}}",
        ], { timeout: 5_000 });
        return stdout.trim();
      } catch {
        throw new Error("Could not inspect this checkout's local Supabase containers. Check your Docker engine and retry.");
      }
    },
    startStack: () => startStack(root, settings),
    waitForHealthy: () => waitForDatabaseHealth({
      health: async () => (await runBounded("docker", [
        "inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{end}}", `supabase_db_${settings.project}`,
      ], { timeout: 5_000 })).stdout,
    }),
    clearInterruptedStart: async () => {
      console.log("Clearing an interrupted local Supabase start (data volumes are kept)...");
      await cli(root, settings, ["stop"], { timeout: 120_000, onProgress: progressPrinter() });
    },
    readStatus: () => statusFor(root, settings),
    applyMigration: status => migrate(root, status),
  });
}

async function migrate(root, status) {
  const client = new pg.Client({ connectionString: status.DB_URL, connectionTimeoutMillis: 10_000, query_timeout: 30_000 });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(readFileSync(path.join(root, "supabase", "001_booking_management.sql"), "utf8"));
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

export function localEnvironment(status) {
  return {
    SUPABASE_TARGET: "local",
    LOCAL_EMAIL_MODE: process.env.LOCAL_EMAIL_MODE || "capture",
    LOCAL_EMAIL_INBOX_URL: status.INBUCKET_URL || `http://127.0.0.1:${Number(new URL(status.API_URL).port) + 3}`,
    LOCAL_SUPABASE_URL: status.API_URL,
    LOCAL_SUPABASE_ANON_KEY: status.ANON_KEY,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };
}

export function localEmailStartupMessage(environment) {
  if (environment.LOCAL_EMAIL_MODE === "capture") {
    return `Email mode: Local capture — no Resend quota used\nEmail inbox: ${environment.LOCAL_EMAIL_INBOX_URL}`;
  }
  if (environment.LOCAL_EMAIL_MODE === "resend") {
    return "Email mode: Resend — real delivery uses Resend quota; a valid designated test recipient is required";
  }
  return "Email mode: Invalid configuration — email delivery will be rejected";
}

async function main() {
  const root = process.cwd();
  const [action, ...args] = process.argv.slice(2);
  if (!["dev", "serve"].includes(action)) {
    throw new Error("Usage: node scripts/local-dev.mjs dev|serve [Next.js server options]");
  }
  if (process.env.VERCEL || process.env.CI) throw new Error("Local development commands cannot run in deployment or CI.");
  const status = await startupLocalStack(root);
  if (action === "dev" || action === "serve") {
    const environment = localEnvironment(status);
    console.log(localEmailStartupMessage(environment));
    const envFile = path.join(root, ".env.local");
    const envFileContents = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
    const stripeEnabled = action === "dev"
      && localStripeWebhooksEnabled(process.env.LOCAL_STRIPE_WEBHOOKS, envFileContents);
    const port = stripeEnabled ? localDevPort(args) : null;
    let stripeChild;
    if (stripeEnabled) {
      const forwarder = await startStripeWebhookForwarder(port);
      stripeChild = forwarder.child;
      environment.STRIPE_WEBHOOK_SECRET = forwarder.secret;
      console.log(`Stripe CLI: forwarding test payment events to http://127.0.0.1:${port}/api/stripe/webhook`);
    } else if (action === "dev") {
      console.log("Stripe CLI forwarding is off. Set LOCAL_STRIPE_WEBHOOKS=true in .env.local to enable it.");
    }
    const nextArgs = [path.join(root, "node_modules", "next", "dist", "bin", "next"), action === "dev" ? "dev" : "start", ...args];
    if (stripeEnabled && !args.some(argument => argument === "--port" || argument === "-p" || argument.startsWith("--port="))) {
      nextArgs.push("--port", String(port));
    }
    const child = spawn(process.execPath, nextArgs, {
      stdio: "inherit", env: { ...process.env, ...environment },
    });
    let stopping = false;
    const stopChildren = signal => {
      stopping = true;
      child.kill(signal);
      stripeChild?.kill(signal);
    };
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stopChildren(signal));
    child.on("error", error => {
      stopping = true;
      stripeChild?.kill("SIGTERM");
      console.error(error.message);
      process.exitCode = 1;
    });
    child.on("exit", code => {
      stopping = true;
      stripeChild?.kill("SIGTERM");
      process.exitCode = code ?? 1;
    });
    stripeChild?.once("exit", code => {
      if (stopping) return;
      console.error(`Stripe CLI webhook forwarding stopped unexpectedly (code ${code ?? "unknown"}); stopping the local app.`);
      stopping = true;
      child.kill("SIGTERM");
    });
    return;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`Local development setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
