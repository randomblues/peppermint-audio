<!-- BEGIN:nextjs-agent-rules -->
# Next.js guidance

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent working rules

These rules are mandatory. Safety, preservation of existing work, bounded execution, and truthful verification take priority over speed.

## Before acting

- Inspect the relevant files and current state before editing or running a command.
- Confirm the purpose, scope, destructive risk, blocking risk, completion condition, verification method, and recovery method for the planned action.
- Never silently ignore, weaken, reinterpret, or work around repository instructions.
- Do not modify `AGENTS.md`, repository instructions, or other governance files unless the user explicitly requests it.

## File changes

- Use the smallest complete targeted edit that satisfies the request.
- Preserve existing style, structure, encoding, and line endings.
- Never overwrite, delete, truncate, rename over, or recreate an existing file as a recovery method after an edit failure.
- If an edit fails: stop, re-read the complete file, inspect for partial changes and permissions/path issues, check Git state, then retry only with a smaller targeted edit.
- After editing, re-read the changed section and run the most relevant syntax check, formatter, linter, type-check, or test.
- Do not modify generated files, lockfiles, or release metadata unless the task requires it.

## Terminal commands

- Use commands appropriate for the detected operating system and shell.
- Prefer readable, independently verifiable commands over large one-liners.
- Use non-interactive commands with a clear completion condition. Do not run editors, pagers, watchers, follow-mode logs, foreground servers, or commands that wait for input.
- Every potentially long-running command must be bounded by a timeout, finite output/count, non-watch mode, or a tool-native wait condition.
- Do not repeatedly poll a command that has not terminated. If it appears stuck, identify the cause, stop checking in a loop, and replace it with a bounded command.
- Quote paths and variables safely, use `--` before filenames where supported, and avoid `eval` or shell wrappers unless genuinely required.
- Never put credentials, tokens, private keys, or other secrets in command arguments or generated files.

## Destructive actions

- Treat deletion, replacement, truncation, force operations, resets, and changes outside the requested scope as destructive.
- Inspect the target first and prefer a dry run where available.
- Do not perform destructive actions unless the user's request clearly authorizes the exact action and target.
- Never broaden scope or use uninspected wildcards for destructive actions.

## Git safety

- Run `git status --short` before and after changes.
- Do not discard unrelated working-tree changes or stage unrelated files.
- Do not amend, rebase, reset, force-push, delete branches, commit, or push unless explicitly requested.
- Before claiming completion, inspect the relevant diff and run `git diff --check`.

## Verification and recovery

- A tool returning without an error is not sufficient proof of success.
- Use the narrowest relevant validation: parse configuration with the framework or language tooling, lint or type-check changed code, and run targeted tests when available.
- Do not rerun a failing command unchanged. First inspect the actual failure, state the new hypothesis, and change the approach.
- If a command is cancelled or interrupted, reassess the filesystem and Git state before continuing; preserve all existing work.
- Never claim a test, build, or command passed unless its actual result was checked.

## Completion report

Report:

- what changed and which files changed;
- validations or commands run and their actual outcomes;
- anything incomplete and the exact reason; and
- any manual authentication or approval still required.

