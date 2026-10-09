import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
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

function cli(root, settings, args, timeout = 30_000) {
  try {
    return execFileSync(path.join(root, "node_modules", ".bin", "supabase"),
      [...args, "--workdir", settings.directory, "--yes"], {
        encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
  } catch (error) {
    const detail = String(error.stderr ?? error.message)
      .replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL redacted]")
      .replace(/\beyJ[\w.-]+/g, "[key redacted]")
      .replace(/\bsb_(?:secret|publishable)_\S+/g, "[key redacted]");
    throw new Error(`Local Supabase ${args[0]} failed: ${detail}`, { cause: undefined });
  }
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

function statusFor(root, settings) {
  return validateStatus(JSON.parse(cli(root, settings, ["status", "-o", "json"])), settings);
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

async function seed(settings, status) {
  const accessFile = path.join(settings.directory, "admin-login.json");
  const login = existsSync(accessFile)
    ? JSON.parse(readFileSync(accessFile, "utf8"))
    : { email: "admin@peppermint.local", password: randomBytes(24).toString("base64url") };
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let user;
  for (let page = 1; !user; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw result.error;
    user = result.data.users.find(entry => entry.email === login.email);
    if (result.data.users.length < 100) break;
  }
  const attributes = { password: login.password, email_confirm: true, app_metadata: { role: "admin" } };
  const result = user
    ? await admin.auth.admin.updateUserById(user.id, attributes)
    : await admin.auth.admin.createUser({ email: login.email, ...attributes });
  if (result.error) throw result.error;
  if (!existsSync(accessFile)) writeFileSync(accessFile, `${JSON.stringify(login, null, 2)}\n`, { flag: "wx", mode: 0o600 });

  const date = offset => {
    const value = new Date();
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const bookings = [1, 7, 30].map((offset, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`,
    email: `test-hire-${index + 1}@example.invalid`,
    first_name: "Local", last_name: `Test ${index + 1}`, mobile: "0400000000",
    event_type: "Private party", event_address: "Disposable local test address",
    pickup_date: date(offset), dropoff_date: date(offset + index + 1),
    terms_accepted: true, status: "submitted",
    internal_notes: "Disposable local fixture. Not a real booking.",
  }));
  const inserted = await admin.from("bookings").upsert(bookings, { onConflict: "id", ignoreDuplicates: true });
  if (inserted.error) throw inserted.error;
  console.log(`Local admin credentials: ${accessFile}\nSeeded three disposable bookings (existing records preserved).`);
}

export function localEnvironment(status) {
  return {
    SUPABASE_TARGET: "local",
    LOCAL_SUPABASE_URL: status.API_URL,
    LOCAL_SUPABASE_ANON_KEY: status.ANON_KEY,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };
}

async function verify(settings, status) {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  const auth = createClient(status.API_URL, status.ANON_KEY, options);
  const login = JSON.parse(readFileSync(path.join(settings.directory, "admin-login.json"), "utf8"));
  const signedIn = await auth.auth.signInWithPassword(login);
  if (signedIn.error) throw signedIn.error;
  if (signedIn.data.user.app_metadata.role !== "admin") throw new Error("Seeded local user is not an administrator.");
  const anonymous = createClient(status.API_URL, status.ANON_KEY, options);
  const blocked = await anonymous.from("bookings").select("id").limit(1);
  if (!blocked.error) throw new Error("Anonymous clients unexpectedly have booking access.");
  const id = randomUUID();
  const object = `local-verification/${id}.txt`;
  const contents = "Disposable local storage verification";
  try {
    const insert = await admin.from("bookings").insert({
      id, email: "integration@example.invalid", first_name: "Disposable", last_name: "Verification",
      mobile: "0400000000", event_type: "Test", event_address: "Local only",
      pickup_date: "2099-01-01", dropoff_date: "2099-01-02",
    }).select("id").single();
    if (insert.error) throw insert.error;
    if (insert.data.id !== id) throw new Error("Local booking persistence did not return the inserted ID.");
    const upload = await admin.storage.from("booking-photo-ids").upload(object, Buffer.from(contents), { contentType: "text/plain" });
    if (upload.error) throw upload.error;
    const link = await admin.storage.from("booking-photo-ids").createSignedUrl(object, 60);
    if (link.error) throw link.error;
    const file = await fetch(link.data.signedUrl, { signal: AbortSignal.timeout(10_000) });
    if (!file.ok || await file.text() !== contents) throw new Error("Local signed storage download failed.");
    const publicFile = await fetch(`${status.API_URL}/storage/v1/object/public/booking-photo-ids/${object}`, { signal: AbortSignal.timeout(10_000) });
    if (publicFile.ok) throw new Error("Local private file is publicly accessible.");
    console.log("PASS: local Auth, admin role, booking persistence, anonymous access denial, private upload and signed download.");
  } finally {
    const removed = await admin.storage.from("booking-photo-ids").remove([object]);
    if (removed.error) throw removed.error;
    const deleted = await admin.from("bookings").delete().eq("id", id);
    if (deleted.error) throw deleted.error;
    const logout = await auth.auth.signOut();
    if (logout.error) throw logout.error;
  }
}

async function main() {
  const root = process.cwd();
  const settings = localSettings(root);
  const [action, ...args] = process.argv.slice(2);
  if (!["start", "stop", "status", "seed", "verify", "dev", "serve"].includes(action)
    || (!["dev", "serve"].includes(action) && args.length)) {
    throw new Error("Usage: node scripts/local-db.mjs start|stop|status|seed|verify|dev|serve [Next.js server options]");
  }
  if (process.env.VERCEL || process.env.CI) throw new Error("Local database commands cannot run in deployment or CI.");
  if (action === "start") {
    mkdirSync(path.join(settings.directory, "supabase"), { recursive: true });
    const config = path.join(settings.directory, "supabase", "config.toml");
    if (!existsSync(config)) writeFileSync(config, localConfig(settings), { flag: "wx" });
    console.log(`Starting ${settings.project}. First startup downloads Docker images (up to 10 minutes).`);
    cli(root, settings, ["start"], 600_000);
    await migrate(root, statusFor(root, settings));
  }
  if (action === "stop") {
    cli(root, settings, ["stop"], 120_000);
    console.log("Stopped this worktree's local stack. Database and storage volumes are retained.");
    return;
  }
  const status = statusFor(root, settings);
  if (action === "seed") await seed(settings, status);
  if (action === "verify") await verify(settings, status);
  if (action === "dev" || action === "serve") {
    const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), action === "dev" ? "dev" : "start", ...args], {
      stdio: "inherit", env: { ...process.env, ...localEnvironment(status) },
    });
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
    child.on("error", error => { console.error(error.message); process.exitCode = 1; });
    child.on("exit", code => { process.exitCode = code ?? 1; });
    return;
  }
  console.log(`Local API: ${status.API_URL}\nLocal Studio: http://127.0.0.1:${settings.studioPort}\nLocal Auth mail: http://127.0.0.1:${settings.mailPort}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`Local database setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
