# Repository Review: `agentgraphed`

Below are the concrete problems I found, grouped by severity. I've only reviewed the files provided in full; where I flag something in a file I couldn't see, I say so explicitly.

---

## High severity

### 1. `bin/agentgraphed.js` — `findFreePort` has a race condition and a leak

```js
const srv = createServer()
  .once('error', () => res(false))
  .once('listening', () => srv.close(() => res(true)));
srv.listen(p, '127.0.0.1');
```

- **TOCTOU race:** the port is closed before the child process binds it. Between `srv.close()` and the spawned Next server calling `listen()`, another process can grab the port. The child then fails to bind, and `pingUntilReady` will time out after 15s with a misleading "server failed to start in time" error.
- **`srv` is referenced inside its own initializer.** `const srv = createServer().once(...).once('listening', () => srv.close(...))` works only because the callback runs later, but it's fragile and confusing. If `listen` ever threw synchronously, `srv` would be in TDZ.
- **No `error` handler after `listening`.** If the server errors after binding (rare, but possible), the promise never settles and the loop hangs.

### 2. `bin/agentgraphed.js` — child process is not killed on parent crash

```js
server.on('exit', (code) => { ... });
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

- There is **no `process.on('exit')` handler** and no `detached: false` guarantee that the child dies with the parent. If the parent is killed with `SIGKILL`, or throws an uncaught exception outside `main().catch`, the spawned Next server is orphaned and keeps holding the port. On the next `npx agentgraphed` run, `findFreePort` will skip that port and start a *second* server — the user now has two dashboards writing to the same SQLite file.
- `cleanup` calls `server.kill('SIGTERM')` then `process.exit(0)` immediately. `SIGTERM` is asynchronous; the child may not have flushed SQLite WAL before the parent exits. Prefer `server.kill()` + wait for `exit`, or at minimum `SIGKILL` after a grace period.

### 3. `bin/agentgraphed.js` — `pingUntilReady` treats any `<500` as ready

```js
if (res.ok || res.status < 500) return;
```

A `404` or `401` from a *different* server already listening on that port (e.g. a stale orphan from problem #2, or an unrelated dev server) is treated as "ready". The CLI then POSTs to `/api/ingest-local` on the wrong server and reports success. This is exactly the failure mode that makes the orphan-process bug hard to diagnose.

### 4. `.github/workflows/publish.yml` — `verify-platforms` runs *after* publish, so a broken release is already live

The comment acknowledges this ("A failure here means the package is live but broken"). This is a real problem, not just a documentation note:

- `npm publish` is irreversible for a given version. If `verify-platforms` fails on macOS, the only remedies are `npm deprecate` or a patch release — both leave a broken version installable.
- The correct ordering is: build → `npm pack` → install the tarball on all three OSes → *then* publish. The `verify-platforms` job should consume the local `.tgz` (or a `npm publish --dry-run` artifact), not the registry.
- The comment claims this "would have caught the 0.1.0–0.3.1 Apple Silicon dlopen bug" — but only *after* shipping it to every macOS user. That's not a fix, it's an alarm.

### 5. `.github/workflows/publish.yml` — `verify-platforms` has no `actions/checkout`

```yaml
verify-platforms:
  needs: publish
  steps:
    - uses: actions/setup-node@v4
```

There is no `actions/checkout@v4`. The job only runs `npm install agentgraphed@...` in a fresh dir, so it happens to work — but it's fragile and inconsistent with the rest of the workflow. More importantly, **`GITHUB_REF_NAME` is used in the `ver` step**; that env var is available without checkout, so this is latent rather than broken today. Still worth fixing for clarity.

### 6. `.github/workflows/publish.yml` — `npm install -g npm@latest` is unpinned and non-reproducible

```yaml
- name: Upgrade npm to a version that supports OIDC
  run: npm install -g npm@latest
```

- `@latest` can (and does) break. A future npm major could change `--provenance` semantics or the OIDC flow, and the release pipeline breaks with no code change.
- Pin to a known-good range, e.g. `npm@^11.5.1`, and let Dependabot bump it.

### 7. `.github/workflows/ci.yml` — the smoke test can pass without the server ever starting

```bash
for i in {1..30}; do
  if curl -sf http://localhost:4747/ > /dev/null; then break; fi
  sleep 1
done
curl -sf -o /dev/null -w "GET / → %{http_code}\n" http://localhost:4747/
kill $PID
```

- The loop `break`s on success but **does not fail on timeout**. If the server never comes up, the loop runs 30 times and falls through to the final `curl`, which will fail — but only because `curl -sf` exits non-zero. The `-w` output is printed regardless. This is *accidentally* correct, but the intent is unclear and there's no explicit `exit 1` on timeout.
- `kill $PID` kills the *shell's* background job, which is the `agentgraphed` CLI. The CLI spawns a *child* Next server (see #2). If the CLI's `SIGTERM` handler doesn't propagate in time, the Next server survives the CI step. On a fresh runner this is harmless; in a self-hosted runner it leaks.
- No `set -e` in the CI step. A failure in `npm pack` or `npm install` would be masked by the subsequent `curl` output.

---

## Medium severity

### 8. `next.config.mjs` — `serverExternalPackages` is incomplete for the native module chain

```js
serverExternalPackages: ['better-sqlite3', 'bindings'],
```

`better-sqlite3` depends on `bindings` and `prebuild-install` at install time, and at runtime loads a `.node` file via `bindings`. The comment says this is to keep `fs`/`path` out of the edge bundle. But:

- `drizzle-orm` is *not* listed. If any route imports `drizzle-orm/better-sqlite3`, Next may try to bundle it. It usually works because `better-sqlite3` is external, but the transitive `drizzle-orm` import is a known source of "Module not found: Can't resolve 'fs'" in standalone builds.
- The `.node` binary itself is not copied by `output: 'standalone'` automatically. `scripts/copy-standalone-assets.mjs` presumably handles this, but I can't verify it from the provided files — worth confirming it copies `node_modules/better-sqlite3/build/Release/*.node` and the `bindings` package.

### 9. `bin/agentgraphed.js` — `triggerIngest` swallows all errors and reports success

```js
if (!res.ok) {
  console.warn(`  (ingest endpoint returned ${res.status})`);
  return null;
}
```

- A non-OK response is logged as a warning and the CLI continues to "Ready." The user sees a dashboard with zero sessions and no indication that ingest failed. For a tool whose entire value proposition is "zero setup, it just works," silently swallowing ingest failure is the worst possible behavior.
- `result?.ok` is checked, but if `result` is `null` (the error path), the `if` is skipped and the CLI prints "Ready." anyway. There's no `else` branch telling the user ingest didn't run.

### 10. `bin/agentgraphed.js` — `--join` and `--no-open` are parsed but unknown flags are silently ignored

```js
const subcommand = argv[0];
switch (subcommand) { case 'help': ... case 'version': ... }
```

- `agentgraphed --jion` (typo) falls through the switch, `wantsJoin` is `false`, and the CLI boots normally. The user thinks they opted in; they didn't.
- `agentgraphed foo` (unknown subcommand) also boots normally. There's no "unknown argument" error. For a CLI that's the primary UX, this is a footgun.

### 11. `bin/agentgraphed.js` — `open` is a runtime dependency but imported dynamically

```js
const { default: open } = await import('open');
```

- `open` is listed in `dependencies` (good), but the dynamic import means a missing/broken `open` install is caught and downgraded to a console message. That's fine, but it also means the `open` package is never exercised in CI (the CI smoke test uses `--no-open`? No — it doesn't pass `--no-open`, so it *does* try to open a browser on the runner, which will fail silently). The CI test therefore doesn't verify the browser-open path at all.
- More importantly: on a headless CI runner, `open` may spawn `xdg-open` and hang or emit noise. The CI step doesn't set `AGENTGRAPHED_NO_OPEN=1`, so this is happening on every CI run.

### 12. `.github/workflows/ci.yml` — no test step

The repo has test files (`src/lib/ingest/sources.test.ts`, `sources.getSources.test.ts`) but CI only runs `npm run build` and a boot smoke test. There is no `npm test` step. Either:

- Tests aren't wired into `package.json` (I can't see `package.json` in full — it's truncated), or
- They exist but are never run in CI.

Either way, the two test files in the tree are dead weight in CI. This is a significant gap for a project with a native-module dependency and a cross-platform publish pipeline.

### 13. `.github/workflows/publish.yml` — `contents: write` is broader than needed

```yaml
permissions:
  contents: write   # softprops/action-gh-release needs this
  id-token: write
```

`softprops/action-gh-release` needs `contents: write` to create the release, yes. But the `publish` job also runs `npm ci`, `npm run build`, and `npm publish` — all of which run arbitrary code from the repo and its dependencies. Granting `contents: write` to the whole job means a compromised dependency (or a malicious PR merged to a tag) can push to the repo. Split the release-creation into a separate job that only has `contents: write`, and keep the publish job at `contents: read` + `id-token: write`.

### 14. `CHANGELOG.md` — version dates are in the future

```
## [0.5.8] — 2026-06-11
## [0.5.7] — 2026-06-11
...
## [0.5.3] — 2026-06-10
```

The `LICENSE` also says `Copyright (c) 2026`. Either the system clock is wrong, or these are placeholder dates. If the project is real and shipping, the dates are wrong and should be corrected. If this is a template, the dates should be removed rather than faked.

### 15. `CHANGELOG.md` — `[Unreleased]` contains a `### Changed` entry that is actually a dependency bump, and the `### Fixed` / `### Added` ordering is inconsistent

Minor, but: the `[Unreleased]` section has `### Changed` before `### Fixed` before `### Added`. Keep a Changelog convention is `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. The file claims to follow it "loosely," but consistency helps tooling.

### 16. `CONTRIBUTING.md` — references files that don't exist

```
- `bin/` — `agentgraphed` CLI entrypoints (`onboard`, `offboard`, default `start`)
```

The file tree shows only `bin/agentgraphed.js`. There is no `onboard` or `offboard` entrypoint. Either the docs are stale or the files were removed. This will confuse contributors.

### 17. `CONTRIBUTING.md` — `npm run fetch-pricing` is documented but the script is gitignored

```
| `npm run fetch-pricing`  | Refresh LiteLLM pricing data manually          |
```

`.gitignore` has:
```
# LiteLLM pricing snapshot — refetched at build time
src/lib/pricing-data/
```

So the pricing data is fetched at build time and not committed. That's a reasonable choice, but it means:

- A fresh clone without network access cannot build.
- The `fetch-pricing` script's output is non-deterministic across builds (LiteLLM updates pricing). Two builds of the same commit can produce different bundles. For a tool that reports *cost*, this is a correctness concern — the numbers a user sees depend on when they built.
- CI doesn't pin or cache the pricing snapshot, so the "Verify packed install" step is testing a different pricing dataset than any previous run.

### 18. `next-env.d.ts` — references `.next/types/routes.d.ts` which is gitignored

```ts
/// <reference path="./.next/types/routes.d.ts" />
```

`.next/` is in `.gitignore`. On a fresh clone, `tsc` (or the editor) will error on the missing reference until `next dev`/`next build` runs. This is standard Next.js behavior, but combined with `typedRoutes: false` in `next.config.mjs`, the reference is unnecessary. Next generates this file; it shouldn't be hand-edited, but the `typedRoutes: false` setting means the routes reference is dead. Either enable typed routes or let Next regenerate the file without the reference.

---

## Low severity / nits

### 19. `bin/agentgraphed.js` — `printHelp` uses `require('../package.json')` inside a function

```js
function printHelp() {
  const version = require('../package.json').version;
```

This is fine (Node caches it), but the top of the file already does `require('../package.json').version` in the `version` case. Minor duplication.

### 20. `bin/agentgraphed.js` — `findFreePort` starts at `start` and goes to `start + 100`

If `AGENTGRAPHED_PORT=65500`, the loop tries ports 65500–65599, and `srv.listen(65599)` throws `ERR_SOCKET_BAD_PORT` synchronously inside the promise executor. The `error` handler catches it and resolves `false`, so the loop continues to 65600, which also throws, etc. Eventually it throws "no free port found" — but only after 100 synchronous throws. Not a real bug, but the error message is misleading. Clamp to 65535.

### 21. `.github/workflows/ci.yml` — `npm pack` output glob is fragile

```bash
npm install "$GITHUB_WORKSPACE"/agentgraphed-*.tgz
```

If a previous run left a `.tgz` in the workspace (it shouldn't, but `npm pack` writes to CWD), the glob expands to multiple files and `npm install` fails with "too many arguments." Add `rm -f agentgraphed-*.tgz` before `npm pack`, or use `npm pack --pack-destination`.

### 22. `.github/workflows/publish.yml` — `verify-platforms` has `timeout-minutes: 5`

The job includes a 3-minute CDN poll plus `npm install` (which compiles `better-sqlite3` from source on platforms without prebuilds) plus a 30-second boot poll. 5 minutes is tight. On a cold Windows runner, `npm install` of `better-sqlite3` alone can take 2–3 minutes. Bump to 10.

### 23. `.github/workflows/publish.yml` — `verify-platforms` doesn't fail the overall workflow in a useful way

`needs: publish` means if `publish` fails, `verify-platforms` is skipped. If `verify-platforms` fails, the workflow is red but the package is already published. There's no notification mechanism (no Slack, no issue creation) — the comment says "surface loudly," but a red X on a workflow run is not loud. Consider opening a GitHub issue automatically on failure.

### 24. `CHANGELOG.md` — `[Unreleased]` mentions a `better-sqlite3` bump to `^12.10.1`, but `package-lock.json` shows `"better-sqlite3": "^12.10.1"` already resolved

The changelog says "Bumped ... from `^11.7.0` to `^12.10.1`" under `[Unreleased]`, but the lockfile already has 12.x. Either the changelog entry should be under a released version, or the lockfile was updated without a release. Minor inconsistency.

### 25. `LICENSE` — copyright year 2026

If this is genuinely 2026, fine. If not, it's wrong. Given the changelog dates, I suspect a clock issue or a template that wasn't updated.

### 26. `.gitignore` — `*.sqlite` but not `*.db`

The default DB lives in `~/.agentgraphed`, but devs can point `AGENTGRAPHED_DATA_DIR` at the repo. If the DB file is named `agentgraphed.db` (not `.sqlite`), it won't be ignored. I can't see `src/lib/db/paths.ts` to confirm the extension, but the ignore list only covers `.sqlite`, `.sqlite-shm`, `.sqlite-wal`. Add `*.db`, `*.db-shm`, `*.db-wal` if the extension differs.

### 27. `docs/screenshots/` — duplicate originals

```
docs/screenshots/analytics.png
docs/screenshots/originals/analytics.png
docs/screenshots/dashboard.png
docs/screenshots/originals/dashboard.png
...
```

Every screenshot exists twice: once at the top level and once under `originals/`. If the top-level ones are optimized/resized versions, that's fine, but there's no script in `scripts/` that generates them. Either commit the generation script or drop the `originals/` directory (it's dead weight in the npm package if `docs/` is included — check `package.json` `files`).

### 28. `README.md` not provided

I can't review it, but `CONTRIBUTING.md` references `README.md#run-as-a-service` and the changelog references `README.md#troubleshooting`. If those anchors don't exist, the links are broken. Worth verifying.

---

## Summary of the most important fixes

| # | Issue | Impact |
|---|-------|--------|
| 4 | `verify-platforms` runs after `npm publish` | Broken releases ship to users |
| 2 | Child server orphaned on parent crash | Port conflicts, double-writers to SQLite |
| 1 | `findFreePort` TOCTOU race | Intermittent startup failures |
| 9 | Ingest errors swallowed | Silent data loss, "it just doesn't work" |
| 12 | No test step in CI | Regressions ship |
| 6 | `npm@latest` unpinned | Release pipeline breaks unpredictably |
| 3 | `pingUntilReady` accepts any `<500` | False-positive readiness, wrong-server ingest |

The publish workflow's ordering (#4) and the CLI's process lifecycle (#2) are the two that will cause the most user-visible pain.
