import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAgentWorktree,
  findAgentPortConflict,
  formatInstructions,
  parseWorktreePaths,
  portForAgent,
  validateAgentName,
} from "../scripts/agent-worktree.mjs";

const temporaryDirectories: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "peppermint-agent-worktree-"));
  temporaryDirectories.push(directory);
  return directory;
}

function initializeRepository(root: string) {
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Agent Worktree Test"], { cwd: root });
  execFileSync("git", ["config", "user.email", "agent-worktree-test@example.invalid"], { cwd: root });
  writeFileSync(path.join(root, "README.md"), "test repository\n");
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: root });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("agent worktree helper", () => {
  it("validates names and assigns a stable app port in the documented range", () => {
    expect(validateAgentName("admin-ui")).toBe("admin-ui");
    expect(portForAgent("admin-ui")).toBe(portForAgent("admin-ui"));
    expect(portForAgent("admin-ui")).toBeGreaterThanOrEqual(3100);
    expect(portForAgent("admin-ui")).toBeLessThanOrEqual(4099);
    expect(() => validateAgentName("../admin")).toThrow("lowercase letters");
    expect(() => validateAgentName("Admin_UI")).toThrow("lowercase letters");
  });

  it("parses registered worktree paths and detects stable-port collisions", () => {
    const names = new Map<number, string>();
    let collision: [string, string] | undefined;
    for (let index = 0; index < 1500 && !collision; index++) {
      const name = `agent-${index}`;
      const port = portForAgent(name);
      const prior = names.get(port);
      if (prior) collision = [prior, name];
      else names.set(port, name);
    }
    expect(collision).toBeDefined();
    const [existingName, requestedName] = collision!;
    const paths = parseWorktreePaths(`worktree /project\nHEAD abc\n\nworktree /agents/${existingName}\nHEAD def\n`);
    expect(paths).toEqual(["/project", `/agents/${existingName}`]);
    expect(findAgentPortConflict(requestedName, paths, "/agents")).toEqual({
      name: existingName,
      port: portForAgent(requestedName),
    });
    expect(findAgentPortConflict("new-agent", paths, "/elsewhere")).toBeNull();
  });

  it("creates an isolated sibling worktree and reports its launch commands", async () => {
    const parent = temporaryDirectory();
    const repo = path.join(parent, "peppermint-audio");
    initializeRepository(repo);
    const worktree = await createAgentWorktree({
      name: "booking-ui",
      cwd: repo,
      portCheck: vi.fn(async () => true),
    });

    expect(worktree).toMatchObject({
      branch: "agent/booking-ui",
      name: "booking-ui",
      port: portForAgent("booking-ui"),
      url: `http://localhost:${portForAgent("booking-ui")}`,
    });
    expect(readFileSync(path.join(worktree.path, "README.md"), "utf8")).toBe("test repository\n");
    expect(execFileSync("git", ["branch", "--show-current"], { cwd: worktree.path, encoding: "utf8" }).trim())
      .toBe("agent/booking-ui");
    expect(formatInstructions(worktree)).toContain(`PORT=${worktree.port} scripts/dev-detached.sh`);
    expect(formatInstructions(worktree)).toContain("Uncommitted changes from the source checkout were not copied.");
  });

  it("refuses an occupied port before creating a worktree", async () => {
    const parent = temporaryDirectory();
    const repo = path.join(parent, "peppermint-audio");
    initializeRepository(repo);
    const portCheck = vi.fn(async () => false);

    await expect(createAgentWorktree({ name: "occupied", cwd: repo, portCheck }))
      .rejects.toThrow(`Port ${portForAgent("occupied")} for agent "occupied" is already in use`);
    expect(execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: repo, encoding: "utf8" }))
      .not.toContain(`${path.basename(repo)}-agents/occupied`);
  });

  it("refuses to reuse an existing worktree name without changing it", async () => {
    const parent = temporaryDirectory();
    const repo = path.join(parent, "peppermint-audio");
    initializeRepository(repo);
    const portCheck = vi.fn(async () => true);
    const created = await createAgentWorktree({ name: "same-agent", cwd: repo, portCheck });

    await expect(createAgentWorktree({ name: "same-agent", cwd: repo, portCheck }))
      .rejects.toThrow(`Worktree path already exists: ${created.path}`);
    expect(execFileSync("git", ["branch", "--show-current"], { cwd: created.path, encoding: "utf8" }).trim())
      .toBe("agent/same-agent");
  });
});
