# MCP Security Model

## Threat Model
- **Asset**: User's codebase, GitHub tokens, local files
- **Threat**: Malicious skill prompting MCP to exfiltrate data or execute commands
- **Attack Vector**: Prompt injection via skill instructions

## Controls Implemented

1. **Path Allowlisting**: File operations are resolved against the workspace root and
   rejected when the resolved path escapes it (lexical containment check). A symlink
   inside the workspace is *not* followed by the guard — see each `SECURITY.md`.
2. **Command Allowlisting / No Shell**: Children are only ever started with
   `execFileSync(bin, argv[])`. There is no `shell: true`, no `execSync`, and no
   command string anywhere in the MCP sources. `benchmark-mcp` additionally restricts
   profiled binaries to an allowlist (`node`, `python`, `python3`) by basename.
3. **Resource Limits (partial)**: a 30-second timeout per child process.
   **Memory and CPU are NOT capped.** Do not rely on them; this is the honest state
   of the code today.
4. **Audit Logging**: every invocation appends one JSON line to
   `.dontkillthevibes/audit.log` with the tool name plus truncated digests of the
   arguments and the result. Argument/result *content* is never written. The digest is
   truncated to 64 bits and unsalted, so it is a privacy control, not a tamper-evident
   proof.
5. **Persistent State**: the audit log above is the only state retained between
   invocations. No user code, payload, or response body is stored.
6. **Token Handling**: the GitHub token is read from the environment, never logged, and
   passed only to the official GitHub MCP server. Token *scopes* are not validated by
   this toolkit — grant the minimum scope you need.

## Validation

- **`pnpm security:audit`** — offline static check that fails on `shell: true`,
  `execSync`/`exec`/`spawn`, `eval`, and `...process.env` spreads under `mcps/*/src`,
  and requires every MCP package to ship a `SECURITY.md`.
- **`node scripts/mcp-smoke.mjs <server> <tool> '<args>' --expect <CODE>`** — drives a
  real server over stdio and asserts the security guard fired (for example
  `INVALID_COMMIT` for a shell-metacharacter ref, `BINARY_NOT_ALLOWED` for `rm`).
  Both checks run in CI.

## Not enforced — read this before trusting the toolkit with a repo

- Memory / CPU limits (only the wall-clock timeout is enforced).
- Symlink escape: the path guard is lexical and does not resolve links.
- Output-size caps on git commands (`execFileSync` uses Node's default 1 MiB buffer).
- Prompt-injection resistance of the host LLM itself: this toolkit constrains the
  *output contract*, not the model's reasoning.
