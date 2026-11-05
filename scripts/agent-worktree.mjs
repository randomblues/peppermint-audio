import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PORT_MIN = 3100;
const PORT_MAX = 4099;
const AGENT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function runGit(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`git ${args[0]} failed: ${detail}`);
  }
}

export function validateAgentName(name) {
  if (!AGENT_NAME.test(name)) {
    throw new Error("Agent name must use lowercase letters, numbers, and single hyphens.");
  }
  return name;
}

export function portForAgent(name) {
  validateAgentName(name);
  return portForSeed(name);
}

export function portForWorktreePath(root) {
  return portForSeed(path.resolve(root));
}

function portForSeed(seed) {
  const hash = createHash("sha256").update(seed).digest();
  const slot = hash.readUInt32BE(0) % (PORT_MAX - PORT_MIN + 1);
  return PORT_MIN + slot;
}

export function parseWorktreePaths(output) {
  return output.split(/\r?\n/)
    .filter(line => line.startsWith("worktree "))
    .map(line => line.slice("worktree ".length));
}

export function findAgentPortConflict(name, worktreePaths, managedRoot) {
  const port = portForAgent(name);
  const managedDirectory = path.resolve(managedRoot);
  for (const worktreePath of worktreePaths) {
    const resolvedPath = path.resolve(worktreePath);
    if (path.dirname(resolvedPath) !== managedDirectory) continue;
    const otherName = path.basename(resolvedPath);
    if (otherName !== name && AGENT_NAME.test(otherName) && portForAgent(otherName) === port) {
      return { name: otherName, port };
    }
  }
  return null;
}

export function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", error => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(error => error ? reject(error) : resolve(true));
    });
  });
}

export async function createAgentWorktree({ name, cwd = process.cwd(), portCheck = isPortAvailable }) {
  validateAgentName(name);
  const checkoutRoot = runGit(["rev-parse", "--show-toplevel"], cwd);
  const commonGitDir = path.resolve(checkoutRoot, runGit(["rev-parse", "--git-common-dir"], checkoutRoot));
  const projectRoot = path.dirname(commonGitDir);
  const worktreeRoot = path.join(path.dirname(projectRoot), `${path.basename(projectRoot)}-agents`);
  const worktreePath = path.join(worktreeRoot, name);
  const branch = `agent/${name}`;
  const port = portForAgent(name);

  if (existsSync(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  const existingBranches = runGit(["for-each-ref", "--format=%(refname:short)", `refs/heads/${branch}`], checkoutRoot)
    .split(/\r?\n/).filter(Boolean);
  if (existingBranches.includes(branch)) {
    throw new Error(`Branch already exists: ${branch}`);
  }

  const worktreePaths = parseWorktreePaths(runGit(["worktree", "list", "--porcelain"], checkoutRoot));
  const registeredPortConflict = findAgentPortConflict(name, worktreePaths, worktreeRoot);
  if (registeredPortConflict) {
    throw new Error(`Agent "${registeredPortConflict.name}" already maps to port ${port}; choose a different agent name.`);
  }
  if (!await portCheck(port)) {
    throw new Error(`Port ${port} for agent "${name}" is already in use; choose a different agent name.`);
  }

  mkdirSync(worktreeRoot, { recursive: true });
  runGit(["worktree", "add", "-b", branch, worktreePath, "HEAD"], checkoutRoot);
  return { branch, name, path: worktreePath, port, url: `http://localhost:${port}` };
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function formatInstructions(worktree) {
  const directory = shellQuote(worktree.path);
  return [
    `Created ${worktree.name}: ${worktree.branch}`,
    `App port: ${worktree.port} (${worktree.url})`,
    `Start: cd -- ${directory} && PORT=${worktree.port} scripts/dev-detached.sh`,
    `Stop:  cd -- ${directory} && scripts/dev-stop.sh ${worktree.port}`,
    `UI tests: cd -- ${directory} && PORT=${worktree.port} npm run test:e2e`,
    "Uncommitted changes from the source checkout were not copied.",
  ].join("\n");
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && ["-h", "--help"].includes(args[0])) {
    console.log("Usage: node scripts/agent-worktree.mjs <lowercase-agent-name>");
    console.log("Creates a sibling worktree and branch, with a stable app port in 3100-4099.");
    return;
  }
  if (args.length !== 1) {
    throw new Error("Usage: node scripts/agent-worktree.mjs <lowercase-agent-name>");
  }
  const worktree = await createAgentWorktree({ name: args[0] });
  console.log(formatInstructions(worktree));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
