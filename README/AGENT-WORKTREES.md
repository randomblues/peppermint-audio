# Isolated agent worktrees

Use one Git worktree, branch, development server, and browser context per agent. Chats that share a checkout or browser page can overwrite code, navigate each other's tabs, change viewport state, or steal focus.

## Create an agent worktree

From any checkout of this repository, run:

```bash
node scripts/agent-worktree.mjs <agent-name>
```

Use a unique lowercase name made of letters, numbers, and hyphens, such as `booking-ui` or `inventory-tests`. The helper creates a sibling worktree under `../<repository>-agents/<agent-name>`, a branch named `agent/<agent-name>`, and a stable app port in the 3100–4099 range. It refuses to reuse an existing worktree or branch, a port already in use, or a port assigned to another registered agent worktree. It prints the worktree URL and commands for starting and stopping that worktree's detached dev server.

The worktree starts from the source checkout's current `HEAD`. Uncommitted changes are not copied. Commit or otherwise preserve changes before creating a worktree if the new agent needs them. Changes remain on separate branches; merge or cherry-pick them when ready.

Each checkout/worktree already receives its own local Supabase project, data volumes, and deterministic service-port range. Keep each agent's Next.js server on the port printed by the helper. Do not fall back to another port if startup reports a conflict; resolve the conflict or use a different agent name and create a fresh worktree.

The helper does not stop servers, remove worktrees, or delete branches. When an agent is finished, review its branch and explicitly remove its worktree through Git only when its work is safely preserved.

## Isolate browser sessions manually

Repository tooling cannot create or guarantee separate VS Code integrated-browser contexts. For each agent:

- Use a separate browser profile/context or a separate VS Code window/profile configured with its own browser session.
- Open that worktree's printed localhost URL in its own session. Do not reuse another agent's localhost tab, even if the page route is the same.
- Do not ask a shared browser session to foreground a tab while another agent is testing. Foregrounding can steal desktop focus, and shared browser controls can navigate or interact with the wrong page.
- If separate integrated-browser contexts are unavailable, do not run concurrent interactive browser tests in that shared context. Coordinate browser checks separately; code, worktrees, and servers can still run independently.

Separate profiles reduce browser-cookie and local-storage collisions. They do not prevent multiple windows from competing for operating-system focus, so avoid interacting with a window owned by another active test.

## Boundaries

Worktrees and local Supabase stacks isolate local code and data, not external services. Use local/test integrations, keep calendar integrations disabled unless intentionally tested, and never use production credentials or customer data in agent validation.
