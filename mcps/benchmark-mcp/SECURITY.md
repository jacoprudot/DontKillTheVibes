# Benchmark MCP Security Model

This document describes ONLY the controls that are actually enforced in the
current implementation (`src/`). Do not add claims here without code behind
them.

## What is enforced

1. **Sandbox execution** (`src/sandbox.ts`)
   - Benchmark tools run with a minimal, non-sensitive environment: no
     `process.env` spread. Only `PATH` (from the parent, needed to find the
     benchmark binaries), plus `HOME`/`TMPDIR` pointing at a per-instance
     temp directory. Caller-supplied env is applied first and these safe
     fields are forced on top, so they cannot be overridden.
   - All commands run via `execFileSync(binary, args[])` — never a shell.
   - The temp directory is removed on `process.on('exit')` as well as by
     explicit `cleanup()`.

2. **Command allowlist**
   - Load testing: `wrk`, `k6`, `jmeter` (only via `run_benchmark`).
   - Profiling: `perf`, `vtune`, `python -m cProfile` (only via
     `profile_code`, which additionally restricts the profiled binary to an
     allowlist: `node`, `python`, `python3`). Free-text commands are
     rejected — `profile_code` takes `{binary, args[]}` and passes each arg
     as an array element.
   - External-pid sampling uses read-only OS snapshots: `tasklist`
     (Windows) or `ps` (POSIX).
   - `measure_latency` / `measure_throughput` do not spawn any process: they
     use the built-in `fetch`.

3. **No arbitrary benchmark scripts**
   - `run_benchmark` rejects any user-supplied `script` — only the built-in
     `benchmark-templates` (k6 JS, wrk Lua, JMeter JMX) are executed,
     because wrk/k6 scripts are arbitrary code by definition.

4. **Network restrictions**
   - `target_url`/`url` are parsed with `new URL()` and only `http:`/`https:`
     schemes are allowed.
   - HTTP traffic goes only to the user-provided URL. There are no other
     outbound connections. Inbound connections are not opened.

5. **Input validation** (`src/validation.ts`)
   - Header keys/values are rejected if they contain CR/LF (header
     injection) or quotes.
   - `pid` must be a positive integer.

6. **Path containment** (`src/path-guard.ts`)
   - `compare_benchmarks` and `identify_resource_contention` resolve file
     paths relative to the workspace root and reject escapes (`..`).
   - Check is lexical; a symlink inside the workspace pointing outside is
     NOT detected.

7. **Timeouts**
   - Default 30-second timeout per sandboxed command; HTTP requests use a
     10-second abort signal; benchmark runs get `duration_sec + 30s`.

8. **Audit logging** (`src/audit-log.ts`)
   - Every tool invocation appends one JSON line to
     `.dontkillthevibes/audit.log` in the workspace root with the timestamp,
     tool name, and SHA-256 hashes of the arguments and result.
   - Content of arguments/results is never written to the log.

## What is NOT enforced (known limitations)

- No memory or CPU-time limits beyond the timeouts above.
- External-pid CPU sampling is limited by the OS tool: `tasklist` gives no
  per-process CPU% (memory only); `ps` gives lifetime-average CPU%.
- `profile_code` with `python` can by design execute arbitrary Python code
  supplied via `args` (e.g. `-c ...`). The allowlist constrains which
  interpreter runs, not what the interpreted program does.

## Validation

- `npm run security:audit` is currently a placeholder.
