// @vitest-environment node
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = path.resolve(".github/hooks/dev-session.mjs");
let directory: string;
let repository: string;

function invoke(action: string, name: string) {
  return new Promise<{ code: number | null; output: string; error: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [script, action, name], { cwd: repository });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Session setup timed out"));
    }, 10_000);
    let output = "";
    let error = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { error += chunk; });
    child.on("error", failure => { clearTimeout(timeout); reject(failure); });
    child.on("close", code => { clearTimeout(timeout); resolve({ code, output, error }); });
  });
}

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "peppermint-dev-session-"));
  repository = path.join(directory, "repo");
  execFileSync("git", ["init", "--quiet", repository], { timeout: 2000 });
  writeFileSync(path.join(repository, ".gitignore"), "node_modules/\n");
  writeFileSync(path.join(repository, "source.txt"), "committed\n");
  execFileSync("git", ["add", "."], { cwd: repository, timeout: 2000 });
  execFileSync("git", [
    "-c", "user.name=Session Test", "-c", "user.email=session-test@example.invalid",
    "commit", "--quiet", "-m", "fixture",
  ], { cwd: repository, timeout: 2000 });
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("isolated development sessions", { timeout: 15_000 }, () => {
  it("creates independent worktrees and reserved ports without copying dirty source or secrets", async () => {
    writeFileSync(path.join(repository, "source.txt"), "uncommitted\n");
    writeFileSync(path.join(repository, ".env.local"), "DISPOSABLE_TEST_VALUE=not-a-secret\n");
    const results = await Promise.all([invoke("create", "agent-a"), invoke("create", "agent-b")]);
    expect(results.map(result => result.code)).toEqual([0, 0]);
    const [a, b] = results.map(result => JSON.parse(result.output));
    expect(a.worktree).not.toBe(b.worktree);
    expect(a.port).not.toBe(b.port);
    for (const session of [a, b]) {
      expect(session.port).toBeGreaterThanOrEqual(3100);
      expect(session.port).toBeLessThanOrEqual(3999);
      expect(session.devCommand).toContain(`--port ${session.port}`);
      expect(execFileSync("git", ["branch", "--show-current"], {
        cwd: session.worktree, encoding: "utf8", timeout: 2000,
      }).trim()).toBe(session.branch);
      expect(readFileSync(path.join(session.worktree, "source.txt"), "utf8")).toBe("committed\n");
      expect(existsSync(path.join(session.worktree, ".env.local"))).toBe(false);
      expect(existsSync(path.join(session.worktree, "node_modules"))).toBe(false);
      expect(JSON.parse(readFileSync(path.join(session.worktree, ".copilot-dev-session.json"), "utf8")).port).toBe(session.port);
      expect(existsSync(path.join(session.worktree, ".github/hooks/browser-lock.json"))).toBe(true);
      expect(readFileSync(path.join(session.worktree, ".gitignore"), "utf8")).toContain("/.copilot-dev-session.json");
    }
    writeFileSync(path.join(a.worktree, "source.txt"), "agent-a edit\n");
    expect(readFileSync(path.join(b.worktree, "source.txt"), "utf8")).toBe("committed\n");
    expect(readFileSync(path.join(repository, "source.txt"), "utf8")).toBe("uncommitted\n");
    expect(JSON.parse((await invoke("status", "agent-a")).output)).toEqual(a);
  });

  it("refuses duplicate sessions without overwriting their edits", async () => {
    const first = await invoke("create", "same-session");
    expect(first.code).toBe(0);
    const session = JSON.parse(first.output);
    writeFileSync(path.join(session.worktree, "source.txt"), "keep this edit\n");
    const duplicate = await invoke("create", "same-session");
    expect(duplicate.code).toBe(1);
    expect(duplicate.error).toContain("never replaced");
    expect(readFileSync(path.join(session.worktree, "source.txt"), "utf8")).toBe("keep this edit\n");
  });

  it.each(["../escape", "Uppercase", "a/b", "", "x".repeat(65)])("rejects unsafe name %s", async name => {
    expect((await invoke("create", name)).code).toBe(1);
    expect(existsSync(path.join(repository, ".git/copilot-dev-sessions"))).toBe(false);
  });

  it("reports missing sessions explicitly", async () => {
    const result = await invoke("status", "missing");
    expect(result.code).toBe(1);
    expect(result.error).toContain("No completed session");
  });

  it("shares port reservations and the worktree directory when invoked from a worktree", async () => {
    const first = await invoke("create", "agent-a");
    expect(first.code).toBe(0);
    const session = JSON.parse(first.output);
    const nested = spawn(process.execPath, [script, "create", "agent-b"], { cwd: session.worktree });
    const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const timeout = setTimeout(() => { nested.kill(); reject(new Error("Nested session setup timed out")); }, 10_000);
      let output = "";
      nested.stdout.on("data", chunk => { output += chunk; });
      nested.on("error", error => { clearTimeout(timeout); reject(error); });
      nested.on("close", code => { clearTimeout(timeout); resolve({ code, output }); });
    });
    expect(result.code).toBe(0);
    const other = JSON.parse(result.output);
    expect(path.dirname(other.worktree)).toBe(path.dirname(session.worktree));
    expect(other.port).not.toBe(session.port);
  });

  it("skips a port occupied by another process", async () => {
    const name = "occupied-port";
    const preferred = 3100 + createHash("sha256").update(name).digest().readUInt16BE(0) % 900;
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(preferred, "127.0.0.1", resolve);
    });
    try {
      const result = await invoke("create", name);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.output).port).not.toBe(preferred);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  });
});
