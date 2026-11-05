# Isolated agent worktrees

Use one Git worktree, branch, development server, and Playwright run per agent. Separate worktrees and ports isolate code and servers; Playwright gives each test an isolated browser context without sharing tabs or desktop focus.

## Start parallel chats without shell commands

When starting each chat in VS Code, choose **New Worktree** instead of sharing the current folder or branch. This gives each chat its own checkout and branch without running a setup command. If the chat is already open in a shared checkout, use the host's managed worktree/isolation action before editing when available.

A new worktree starts from the current commit; uncommitted changes are not copied. Save any changes that the new chat needs before creating it.

Playwright automatically chooses a stable port based on a worktree's path. Run `npm run test:e2e` from that worktree; it starts its own server and does not reuse an existing one. Each agent can run these checks independently.

## Command-line fallback

If VS Code cannot create a worktree for a chat, run this from a checkout:

```bash
node scripts/agent-worktree.mjs <agent-name>
```

Use a unique lowercase name made of letters, numbers, and hyphens, such as `booking-ui` or `inventory-tests`. The helper creates a sibling worktree under `../<repository>-agents/<agent-name>`, a branch named `agent/<agent-name>`, and a stable app port in the 3100–4099 range. It refuses to reuse an existing worktree or branch, a port already in use, or a port assigned to another registered agent worktree. It prints the worktree URL and commands for starting and stopping that worktree's detached dev server.

The worktree starts from the source checkout's current `HEAD`. Uncommitted changes are not copied. Commit or otherwise preserve changes before creating a worktree if the new agent needs them. Changes remain on separate branches; merge or cherry-pick them when ready.

Each checkout/worktree already receives its own local Supabase project, data volumes, and deterministic service-port range. Keep each agent's Next.js server on the port printed by the helper. Do not fall back to another port if startup reports a conflict; resolve the conflict or use a different agent name and create a fresh worktree.

The helper does not stop servers, remove worktrees, or delete branches. When an agent is finished, review its branch and explicitly remove its worktree through Git only when its work is safely preserved.

## Run isolated UI checks with Playwright

Run UI checks with Playwright only; do not use the VS Code integrated browser or other shared interactive browser tools:

```bash
npm run test:e2e
```

Playwright starts its own server on a stable worktree-specific port and uses isolated browser contexts. It does not reuse an existing server, so a port collision fails instead of accidentally testing another agent's checkout. `PORT=<port>` can override the automatic selection when needed.

## Boundaries

Worktrees and local Supabase stacks isolate local code and data, not external services. Use local/test integrations, keep calendar integrations disabled unless intentionally tested, and never use production credentials or customer data in agent validation.
