import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tooling = [
  ".github/hooks/browser-lock.mjs",
  ".github/hooks/browser-lock.json",
  ".github/hooks/dev-session.mjs",
  "playwright.config.ts",
  "lib/browser-lock.test.ts",
  "lib/dev-session.test.ts",
  "lib/playwright-config.test.ts",
  "tests/e2e/session-isolation.spec.ts",
];

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function available(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", error => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
      else reject(error);
    });
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      server.close(error => error ? reject(error) : resolve(true));
    });
  });
}

async function reservePort(registry, name) {
  const first = createHash("sha256").update(name).digest().readUInt16BE(0) % 900;
  for (let offset = 0; offset < 900; offset++) {
    const port = 3100 + (first + offset) % 900;
    if (!await available(port)) continue;
    try {
      mkdirSync(path.join(registry, `port-${port}`));
      return port;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error("No unreserved session port is available between 3100 and 3999.");
}

async function main() {
  const [action, name, extra] = process.argv.slice(2);
  if (!["create", "status"].includes(action) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name ?? "") || extra) {
    throw new Error("Usage: node .github/hooks/dev-session.mjs create|status session-name (lowercase letters, digits and hyphens; at most 64 characters)");
  }
  const common = path.resolve(git(["rev-parse", "--git-common-dir"]));
  const registry = path.join(common, "copilot-dev-sessions");
  const recordDirectory = path.join(registry, name);
  const record = path.join(recordDirectory, "session.json");
  if (action === "status") {
    if (!existsSync(record)) throw new Error(`No completed session named ${name} exists.`);
    console.log(readFileSync(record, "utf8").trim());
    return;
  }
  mkdirSync(registry, { recursive: true });
  try {
    mkdirSync(recordDirectory);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`Session ${name} already exists or has incomplete setup. Use status or choose another name; existing work is never replaced.`);
    }
    throw error;
  }
  const port = await reservePort(registry, name);
  const source = git(["rev-parse", "--show-toplevel"]);
  const primary = path.dirname(common);
  const worktree = path.join(path.dirname(primary), `${path.basename(primary)}-sessions`, name);
  const branch = `copilot/session-${name}`;
  git(["worktree", "add", "-b", branch, "--", worktree, "HEAD"]);
  const toolingSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  for (const relative of tooling) {
    const destination = path.join(worktree, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(path.join(toolingSource, relative)));
  }
  const ignore = path.join(worktree, ".gitignore");
  const ignored = readFileSync(ignore, "utf8");
  if (!ignored.split(/\r?\n/).includes("/.copilot-dev-session.json")) {
    writeFileSync(ignore, `${ignored}${ignored.endsWith("\n") ? "" : "\n"}/.copilot-dev-session.json\n`);
  }
  const settings = {
    name, branch, worktree, port, url: `http://localhost:${port}`,
    source, revision: git(["rev-parse", "HEAD"]),
    devCommand: `npm run dev -- --port ${port} --hostname 127.0.0.1`,
  };
  const json = `${JSON.stringify(settings, null, 2)}\n`;
  writeFileSync(path.join(worktree, ".copilot-dev-session.json"), json, { flag: "wx" });
  writeFileSync(record, json, { flag: "wx" });
  console.log(json.trim());
}

main().catch(error => {
  console.error(`Isolated session setup failed: ${error.message}\nExisting work and reservations were preserved; inspect Git worktrees before recovery.`);
  process.exitCode = 1;
});
