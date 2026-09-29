# Git MCP Security Model

This document describes ONLY the controls that are actually enforced in the
current implementation (`src/`). Do not add claims here without code behind
them.

## What is enforced

1. **Path containment** (`src/path-guard.ts`)
   - All user-supplied file paths are resolved relative to the workspace root
     (`process.cwd()` at server start) and rejected if they escape it.
   - Check is lexical: it operates on the resolved path string. A symlink
     inside the workspace that points outside is NOT detected by this guard.

2. **Command allowlist** (`src/git-wrapper.ts`)
   - The only external binary ever executed is `git`.
   - All commands run via `execFileSync(binary, args[])` — never a shell —
     so shell metacharacters cannot be interpreted.
   - Git refs (`since_commit`) are validated: full/short SHAs
     (`/^[0-9a-f]{7,40}$/i`) or ref names (`/^[A-Za-z0-9._\/-]+$/`, no
     leading `-`, no `..`). Pathspecs are validated the same way.
   - Branch names returned by `git branch` are re-validated before being
     passed back into other git commands.

3. **Timeouts**
   - Every git invocation has a 30-second timeout (`timeout: 30000`).

4. **No network access**
   - Only local git commands (blame, diff, branch, rev-parse, ls-files, log)
     are used. No fetch/pull/push/clone.

5. **Audit logging** (`src/audit-log.ts`)
   - Every tool invocation appends one JSON line to
     `.dontkillthevibes/audit.log` in the workspace root with the timestamp,
     tool name, and SHA-256 hashes of the arguments and result.
   - Content of arguments/results is never written to the log.

## What is NOT enforced (known limitations)

- No resource limits beyond the 30-second command timeout.
- No branch/commit output size caps (large diffs are returned as-is).
- Path containment is lexical only (see symlink caveat above).

## Validation

- `npm run security:audit` is currently a placeholder.
