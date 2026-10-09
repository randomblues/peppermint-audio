// @vitest-environment node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = path.resolve(".github/hooks/browser-lock.mjs");
const configuration = JSON.parse(readFileSync(path.resolve(".github/hooks/browser-lock.json"), "utf8"));
let directory: string;

function invoke(action: string, event: object, cwd = directory) {
  const result = spawnSync(process.execPath, [script, action], {
    cwd, input: JSON.stringify(event), encoding: "utf8", timeout: 4000,
  });
  expect(result.error).toBeUndefined();
  return { status: result.status, output: JSON.parse(result.stdout) };
}

function pre(sessionId: string, toolName = "functions.openBrowserPage", toolArgs: object = {}) {
  return invoke("pre", { sessionId, toolName, toolArgs });
}

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "peppermint-browser-lock-"));
  execFileSync("git", ["init", "--quiet", directory], { timeout: 2000 });
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("Copilot shared integrated-browser locking", () => {
  it("wires acquisition and turn/session cleanup using the SDK hook schema", () => {
    expect(configuration.version).toBe(1);
    expect(configuration.hooks.preToolUse[0].command).toBe("node .github/hooks/browser-lock.mjs pre");
    for (const event of ["agentStop", "sessionEnd"]) {
      expect(configuration.hooks[event][0].command).toBe("node .github/hooks/browser-lock.mjs release");
    }
  });

  it("allows its owner without overriding standard permissions and denies another session", () => {
    expect(pre("agent-a")).toEqual({ status: 0, output: {} });
    expect(pre("agent-a", "functions.readPage")).toEqual({ status: 0, output: {} });
    const contender = pre("agent-b");
    expect(contender.status).toBe(0);
    expect(contender.output.permissionDecision).toBe("deny");
    expect(contender.output.permissionDecisionReason).toContain("agent-a");
  });

  it.each([
    "mcp__browser__readPage", "functions.openBrowserPage", "functions.clickElement",
    "functions.navigatePage", "functions.runPlaywrightCode",
  ])("protects %s from competing sessions", tool => {
    pre("agent-a");
    expect(pre("agent-b", tool).output.permissionDecision).toBe("deny");
  });

  it.each([
    "functions.view", "functions.rg", "functions.apply_patch", "functions.bash",
    "functions.stop_bash", "functions.read_bash", "functions.list_bash", "functions.runTests",
    "functions.createAndRunTask", "functions.runTask", "functions.getTaskOutput",
    "functions.runNotebookCell", "run_in_terminal", "shell", "exec_command",
  ])("leaves %s available without acquiring a lock", tool => {
    pre("agent-a");
    expect(pre("agent-b", tool)).toEqual({ status: 0, output: {} });
    invoke("release", { sessionId: "agent-a" });
    pre("agent-b", tool);
    expect(pre("agent-c")).toEqual({ status: 0, output: {} });
  });

  it("protects wrapped parallel operations and accepts JSON-encoded tool arguments", () => {
    pre("agent-a");
    const result = invoke("pre", {
      sessionId: "agent-b", toolName: "multi_tool_use.parallel",
      toolArgs: JSON.stringify({ tool_uses: [{ recipient_name: "functions.readPage", parameters: {} }] }),
    });
    expect(result.output.permissionDecision).toBe("deny");
    expect(invoke("pre", {
      sessionId: "agent-b", toolName: "multi_tool_use.parallel",
      toolArgs: { tool_uses: [{ recipient_name: "functions.bash", parameters: {} }] },
    }).output).toEqual({});
  });

  it("supports snake-case payloads and releases only the owner's lock", () => {
    expect(invoke("pre", {
      session_id: "agent-a", tool_name: "openBrowserPage", tool_input: {},
    }).output).toEqual({});
    invoke("release", { session_id: "agent-b" });
    expect(pre("agent-b").output.permissionDecision).toBe("deny");
    invoke("release", { session_id: "agent-a" });
    expect(pre("agent-b").output).toEqual({});
    invoke("release", { session_id: "agent-a" });
    expect(pre("agent-c").output.permissionDecision).toBe("deny");
  });

  it("fails closed for missing session IDs, unknown input shapes, and malformed lock metadata", () => {
    for (const event of [
      { toolName: "readPage" },
      { sessionId: "agent-a" },
      { sessionId: "agent-a", toolName: "multi_tool_use.parallel", toolArgs: {} },
    ]) {
      const result = invoke("pre", event);
      expect(result.status).toBe(1);
      expect(result.output.permissionDecision).toBe("deny");
    }
    writeFileSync(path.join(directory, ".git", "copilot-browser-lock.json"), "{");
    expect(pre("agent-a").output.permissionDecision).toBe("deny");
    expect(pre("agent-a").status).toBe(1);
  });

  it("does not automatically steal an old lock", () => {
    writeFileSync(path.join(directory, ".git", "copilot-browser-lock.json"), JSON.stringify({
      sessionId: "agent-a", acquiredAt: "2020-01-01T00:00:00.000Z",
    }));
    expect(pre("agent-b").output.permissionDecision).toBe("deny");
  });

  it("shares the lock across Git worktrees", () => {
    execFileSync("git", [
      "-c", "user.name=Lock Test", "-c", "user.email=lock-test@example.invalid",
      "commit", "--quiet", "--allow-empty", "-m", "fixture",
    ], { cwd: directory, timeout: 2000 });
    const worktree = path.join(directory, "secondary");
    execFileSync("git", ["worktree", "add", "--quiet", "--detach", worktree], {
      cwd: directory, timeout: 2000,
    });
    pre("agent-a");
    expect(invoke("pre", { sessionId: "agent-b", toolName: "readPage" }, worktree).output.permissionDecision).toBe("deny");
  });

  it("allows only one winner when sessions acquire concurrently", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [script, "pre"], { cwd: directory });
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Concurrent lock test timed out"));
      }, 4000);
      let output = "";
      child.stdout.on("data", chunk => { output += chunk; });
      child.on("error", error => { clearTimeout(timeout); reject(error); });
      child.on("close", code => {
        clearTimeout(timeout);
        if (code !== 0) reject(new Error(`Hook exited with ${code}: ${output}`));
        else resolve(output);
      });
      child.stdin.end(JSON.stringify({ sessionId: `agent-${index}`, toolName: "readPage", toolArgs: {} }));
    })));
    const decisions = results.map(result => JSON.parse(result));
    expect(decisions.filter(decision => decision.permissionDecision !== "deny")).toHaveLength(1);
    expect(decisions.filter(decision => decision.permissionDecision === "deny")).toHaveLength(7);
    expect(readdirSync(path.join(directory, ".git")).filter(name => name.endsWith(".tmp"))).toEqual([]);
  });

  it("supports status and explicit owner-checked recovery without opening a browser", () => {
    pre("agent-a");
    const status = spawnSync(process.execPath, [script, "status"], { cwd: directory, encoding: "utf8", timeout: 4000 });
    expect(JSON.parse(status.stdout).owner.sessionId).toBe("agent-a");
    const wrongOwner = spawnSync(process.execPath, [script, "release", "agent-b"], {
      cwd: directory, encoding: "utf8", timeout: 4000,
    });
    expect(wrongOwner.status).toBe(1);
    const owner = spawnSync(process.execPath, [script, "release", "agent-a"], {
      cwd: directory, encoding: "utf8", timeout: 4000,
    });
    expect(owner.status).toBe(0);
    expect(pre("agent-b").output).toEqual({});
  });
});
