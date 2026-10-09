import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const protectedNames = new Set([
  "openbrowserpage", "readpage", "navigatepage", "screenshotpage", "clickelement",
  "typeinpage", "hoverelement", "dragelement", "handledialog", "runplaywrightcode",
  "computer",
]);

function protectedTool(name, args) {
  if (typeof name !== "string" || !name) {
    throw new Error("Missing tool name; refusing an unidentified tool operation.");
  }
  const leaf = name.split(/__|[.:/]/).at(-1).toLowerCase();
  if (protectedNames.has(leaf) || /browser|playwright/.test(name.toLowerCase())) {
    return true;
  }
  if (leaf === "parallel") {
    if (!Array.isArray(args?.tool_uses)) {
      throw new Error("Missing parallel tool list; refusing an unidentified tool operation.");
    }
    return args.tool_uses.some(tool => protectedTool(tool.recipient_name, tool.parameters));
  }
  return false;
}

function lockPath() {
  const commonDirectory = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    encoding: "utf8",
    timeout: 1500,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return path.resolve(commonDirectory, "copilot-browser-lock.json");
}

function readOwner(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  const owner = JSON.parse(text);
  if (typeof owner?.sessionId !== "string" || !owner.sessionId || typeof owner.acquiredAt !== "string") {
    throw new Error("Invalid browser lock metadata; inspect the lock manually before recovery.");
  }
  return owner;
}

function acquire(file, sessionId, toolName) {
  const candidate = `${file}.${randomUUID()}.tmp`;
  writeFileSync(candidate, JSON.stringify({ sessionId, acquiredAt: new Date().toISOString(), toolName }) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  try {
    try {
      // Publish complete metadata atomically so contenders cannot read a partial owner.
      linkSync(candidate, file);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const owner = readOwner(file);
      if (owner?.sessionId === sessionId) return {};
      return {
        permissionDecision: "deny",
        permissionDecisionReason: owner
          ? `Shared integrated-browser lock is held by session ${owner.sessionId} since ${owner.acquiredAt}. Do not remove it or use another integrated-browser tab to bypass it. Continue in your isolated worktree with terminal-driven Playwright, or wait until the owner finishes its turn.`
          : "Shared integrated-browser lock changed during acquisition. No browser operation was allowed; retry only after the other agent finishes.",
      };
    }
    // No "allow" verdict: keep the runtime's normal permission checks in force.
    return {};
  } finally {
    unlinkSync(candidate);
  }
}

function release(file, sessionId) {
  const owner = readOwner(file);
  if (owner?.sessionId === sessionId) {
    try {
      unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return true;
  }
  return false;
}

async function main() {
  const action = process.argv[2];
  if (action === "status") {
    const file = lockPath();
    console.log(JSON.stringify({ file, owner: readOwner(file) }));
    return;
  }
  if (action === "release" && process.argv[3]) {
    const released = release(lockPath(), process.argv[3]);
    if (!released) throw new Error("Lock was not released: the supplied session does not own it, or no lock exists.");
    console.log(JSON.stringify({ released }));
    return;
  }
  if (action !== "pre" && action !== "release") {
    throw new Error("Usage: node .github/hooks/browser-lock.mjs pre|release|status [owner-session-id]");
  }

  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const event = JSON.parse(input);
  const toolName = event.toolName ?? event.tool_name;
  let args = event.toolArgs ?? event.tool_input;
  if (
    typeof args === "string" &&
    typeof toolName === "string" &&
    toolName.split(/__|[.:/]/).at(-1).toLowerCase() === "parallel"
  ) {
    args = JSON.parse(args);
  }
  if (action === "pre" && !protectedTool(toolName, args)) {
    console.log("{}");
    return;
  }
  const sessionId = event.sessionId ?? event.session_id;
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    throw new Error("Missing runtime session ID; browser/terminal operation cannot be safely coordinated.");
  }
  const file = lockPath();
  if (action === "release") {
    release(file, sessionId);
    console.log("{}");
  } else {
    console.log(JSON.stringify(acquire(file, sessionId, toolName)));
  }
}

main().catch(error => {
  const reason = `Shared integrated-browser lock failed: ${error.message}`;
  console.log(JSON.stringify({ permissionDecision: "deny", permissionDecisionReason: reason }));
  console.error(reason);
  process.exitCode = 1;
});
