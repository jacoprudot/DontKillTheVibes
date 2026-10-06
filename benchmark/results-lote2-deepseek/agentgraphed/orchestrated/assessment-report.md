# Assessment Report: agentgraphed

- **Repository**: agentgraphed
- **Date**: 2026-10-05T20:53:38.712Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 6
- **Total Findings**: 79
- **By Severity**: critical 6 · high 15 · medium 48 · low 6 · info 4
- **By Module**: database 25 · structure 8 · flows 11 · security 15 · cost 11 · github 9
- **Estimated Total Effort**: 20×XS, 13×S, 43×M, 3×L
- **Top 3 Priorities**:
  - `database-full-table-scan-3` — The timeline search uses leading-wildcard LIKE patterns (`%${opts.search}%`) against s.first_prompt and s.summary. (critical, M) (score 84.5)
  - `security-logs-contain-secrets-12` — On a batch failure the raw model response is embedded into the error string (`Could not parse model response. (critical, XS) (score 82.5)
  - `flows-missing-idempotency-3` — POST /api/ingest-local (and GET, which just calls POST) triggers a full filesystem re-scan and DB write with no idempotency key, no dedup… (critical, S) (score 75)

---

## Detailed Findings (by Priority)

### Priority 1: `database-full-table-scan-3` (score 84.5)
**Module**: database | **Severity**: critical | **Effort**: M | **Confidence**: 0.65 | **Score**: 84.5
**Location**: `src/lib/queries.ts:175`
**Description**: The timeline search uses leading-wildcard LIKE patterns (`%${opts.search}%`) against s.first_prompt and s.summary. SQLite cannot use a B-tree index for a leading-wildcard LIKE, so every search request performs a full scan of the sessions table, which grows unbounded as sessions accumulate.
**Remediation**: Replace the LIKE '%term%' search with an FTS5 virtual table over first_prompt/summary, or at minimum restrict to prefix matching (term%) so the existing indexes can be used.
**Depends On**: None | **Blocks**: None

### Priority 2: `security-logs-contain-secrets-12` (score 82.5)
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.55 | **Score**: 82.5
**Location**: `src/lib/llm/classify.ts:233`
**Description**: On a batch failure the raw model response is embedded into the error string (`Could not parse model response. First 200 chars: ${text.slice(0, 200)}`) and that string is returned to the caller and surfaced in the UI. The classifier input is the user's own prompt content, so session text can be echoed into error output and logs.
**Remediation**: Do not include raw model output in error messages. Log a generic failure reason plus a correlation id, and keep the response text out of any user-visible or persisted error string.
**Depends On**: None | **Blocks**: None

### Priority 3: `flows-missing-idempotency-3` (score 75)
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.75 | **Score**: 75
**Location**: `src/app/api/ingest-local/route.ts:13`
**Description**: POST /api/ingest-local (and GET, which just calls POST) triggers a full filesystem re-scan and DB write with no idempotency key, no dedup guard and no in-flight lock at the route level. Any client — including a browser prefetch or a retried request — can fire repeated concurrent ingests, and the endpoint is unauthenticated.
**Remediation**: Require an idempotency key (or a single-flight mutex) on the ingest endpoint, reject duplicate concurrent invocations with 409, and gate the route behind a local-only check so repeated calls cannot re-run the scan.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 4: `database-irreversible-migration-1` (score 71.5)
**Module**: database | **Severity**: critical | **Effort**: L | **Confidence**: 0.55 | **Score**: 71.5
**Location**: `src/lib/db/client.ts:150`
**Description**: The schema migrations in ensureSchema are one-way: columns are added and rows are backfilled (source_tag='default', categories=json_array(category)) with no down-migration or schema-version record. If a migration is interrupted or a newer version writes data an older version cannot read, there is no path to roll back, and the destructive backfill cannot be undone.
**Remediation**: Record an explicit schema_version in the settings table and gate each migration on it, and make backfills idempotent and reversible (or snapshot the DB before running destructive UPDATEs).
**Depends On**: None | **Blocks**: None

### Priority 5: `flows-fire-and-forget-critical-1` (score 70)
**Module**: flows | **Severity**: critical | **Effort**: M | **Confidence**: 0.7 | **Score**: 70
**Location**: `src/lib/ingest/auto.ts:92`
**Description**: The ingest pipeline is launched as an un-awaited promise (`inFlight = (async () => {...})(); // Intentionally NOT awaited`) and the caller returns immediately. If the process exits or the request context is torn down before the promise settles, the ingest — including the leaderboard submission and auto-classification — is lost with no completion guarantee or durable queue.
**Remediation**: Move the ingest work onto a durable background job/queue (or at minimum await it in a dedicated worker with a persisted 'pending' marker) so a crash mid-flight does not silently drop the scan and submission.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 6: `security-gha-overpermissive-2` (score 52.5)
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.7 | **Score**: 52.5
**Location**: `.github/workflows/publish.yml:30`
**Description**: The publish job grants `contents: write` at the job level solely so `softprops/action-gh-release` can create a release page. That write scope is available to every step in the job, including `npm ci` (which runs install scripts from the dependency tree) and the unpinned `npm@latest` install, widening the blast radius of a supply-chain compromise.
**Remediation**: Split the GitHub Release creation into a separate job that alone receives `contents: write`, and keep the build/publish job at `contents: read` with only `id-token: write`.
**Depends On**: None | **Blocks**: None

### Priority 7: `security-no-input-validation-14` (score 45)
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 45
**Location**: `src/app/api/share/dashboard/route.tsx:118`
**Description**: Query parameters are parsed with `parseInt(raw, 10) || 30` and passed straight into DB queries (`getRangeSummary(days, ...)`, `getDailySeries(days, ...)`) with no upper bound or type validation. A caller can supply an arbitrarily large `days` value, forcing unbounded range scans and memory/CPU exhaustion on the local server.
**Remediation**: Validate and clamp all query parameters: reject non-numeric input, and bound `days` to a sane maximum (e.g. `Math.min(3650, Math.max(1, n))`) before passing it to the query layer.
**Depends On**: None | **Blocks**: None

### Priority 8: `security-secret-in-code-1` (score 45)
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.3 | **Score**: 45
**Location**: `src/lib/quota/refresh.ts:22`
**Description**: The OAuth `client_id` is hardcoded in source. While this particular value is the public Claude Code client id and is not a secret, embedding credentials-adjacent constants in code makes it easy for a future edit to place a real client secret in the same location. The file also writes refreshed tokens to disk, so the surrounding code is security-sensitive.
**Remediation**: Move the client id into a named, documented constant module with a comment stating it is public, and add a lint/CI check that fails on high-entropy string literals in source.
**Depends On**: None | **Blocks**: None

### Priority 9: `structure-high-coupling-1` (score 44)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.8 | **Score**: 44
**Location**: `src/lib/llm/classify.ts:1`
**Description**: classify.ts imports directly from ../db/client, ./client, and ./models, and reaches into the sessions/messages tables with raw SQL (sampleSessionPrompts, getUnclassifiedRows, the UPDATE sessions statement). The LLM classification concern is tightly coupled to the persistence layer and cannot be tested or reused without a live SQLite database.
**Remediation**: Define a narrow repository interface for the session/message reads and writes classify.ts needs, inject it into classifyBatch(), and keep the LLM module free of direct getSqlite() calls.
**Depends On**: None | **Blocks**: `flows-missing-timeout-6`, `flows-missing-idempotency-3`, `flows-missing-rate-limit-8`, `flows-error-leaks-stack-6`, `flows-missing-error-handler-5`, `flows-fire-and-forget-critical-1`, `flows-missing-dlq-2`, `flows-retry-no-backoff-4`, `flows-message-schema-no-version-1`, `flows-missing-request-id-7`, `flows-missing-cors-9`

### Priority 10: `database-iteration-overload-5` (score 39)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 39
**Location**: `src/lib/ingest/recost.ts:20`
**Description**: recostAllSessions loads every session row into memory (`SELECT ... FROM sessions` with no LIMIT) and then iterates the full array inside a transaction, issuing one UPDATE per row. As the sessions table grows this becomes an unbounded in-memory iteration plus N individual UPDATE statements.
**Remediation**: Batch the recost in chunks (e.g. LIMIT/OFFSET or keyset pagination) and/or compute costs in SQL where possible, so memory and statement count stay bounded regardless of table size.
**Depends On**: None | **Blocks**: None

### Priority 11: `database-risky-migration-3` (score 39)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 39
**Location**: `src/lib/db/client.ts:150`
**Description**: ensureSchema performs destructive data mutations at startup without a transaction: the source_tag backfill UPDATE and the categories backfill UPDATE run as separate db.exec calls. If the process is killed between the ALTER and the UPDATE (or between the two backfills), the DB is left in a partially migrated state with no rollback.
**Remediation**: Wrap each migration step (ALTER + backfill) in a single better-sqlite3 transaction so a crash leaves the schema either fully migrated or untouched, and record completion in a schema_version row.
**Depends On**: None | **Blocks**: None

### Priority 12: `database-missing-index-fk-1` (score 35.75)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.55 | **Score**: 35.75
**Location**: `src/lib/db/schema.ts:60`
**Description**: messages.session_id is a foreign-key-style reference to sessions.id but has no declared foreign key and, more importantly, the sessions table's project_id column (line 22) references projects.id with no FK constraint or index declared in the schema. Queries in src/lib/queries.ts join sessions to projects on p.id = s.project_id and filter by s.project_id, but the only index on sessions is sessions_project_idx which does exist — however messages.session_id has messages_session_idx. The unindexed FK is tool_io.session_id which does have an index. The concrete gap: sessions.project_id has an index but no FK constraint, so orphaned sessions can accumulate and cascade deletes are impossible.
**Remediation**: Add explicit FOREIGN KEY constraints (with ON DELETE CASCADE) to sessions.project_id, messages.session_id, and tool_io.session_id, and enable PRAGMA foreign_keys = ON in getDb() so orphaned rows cannot be written.
**Depends On**: None | **Blocks**: None

### Priority 13: `database-n-plus-one-risk-1` (score 35.75)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 35.75
**Location**: `src/lib/queries.ts:175`
**Description**: getTimeline returns a list of sessions, and the session-detail rendering path calls getSessionTokenBreakdown(sessionId) once per session (a GROUP BY over tool_io). When a day group contains many sessions, this becomes an N+1 query pattern against tool_io, which is the largest table in the schema.
**Remediation**: Batch the breakdown lookups: run a single `SELECT session_id, kind, source, SUM(bytes), SUM(est_tokens), COUNT(*) FROM tool_io WHERE session_id IN (?,...) GROUP BY session_id, kind, source` and map results back to sessions.
**Depends On**: None | **Blocks**: None

### Priority 14: `flows-missing-dlq-2` (score 35)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 35
**Location**: `src/app/leaderboard/actions.ts:148`
**Description**: postBatch returns null on network/abort failure and the caller simply returns null, discarding the batch. Failed leaderboard submissions have no dead-letter queue or persisted retry record — the payload is dropped and only re-attempted if the user happens to submit again.
**Remediation**: Persist failed submission payloads to a local outbox table (or DLQ) and retry them on the next tick, so transient network failures do not permanently lose leaderboard rows.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 15: `database-overfetch-relation-1` (score 32.5)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.5 | **Score**: 32.5
**Location**: `src/lib/queries.ts:175`
**Description**: SESSION_FIELDS selects every column of sessions (including large text columns first_prompt, summary, keywords, categories) for every row returned by getTimeline/getSessionsForProject, even though list views typically render only a subset. This over-fetches large TEXT payloads across the relation for each list query.
**Remediation**: Select only the columns the list view needs, or split the heavy text columns (first_prompt, summary) into a separate detail query fetched on demand.
**Depends On**: None | **Blocks**: None

### Priority 16: `database-sequential-pagination-1` (score 32.5)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.5 | **Score**: 32.5
**Location**: `src/lib/queries.ts:185`
**Description**: getTimeline paginates with `ORDER BY s.started_at DESC LIMIT ?` combined with an offset-style `before` cursor (`s.started_at < ?`). Because started_at is not unique, rows sharing a timestamp can be skipped or duplicated across pages, and the query re-scans from the top of the index on each page rather than using a stable keyset cursor.
**Remediation**: Use a composite keyset cursor on (started_at, id) — WHERE (started_at, id) < (?, ?) ORDER BY started_at DESC, id DESC — and add a composite index sessions(started_at, id) to make pagination stable and index-only.
**Depends On**: None | **Blocks**: None

### Priority 17: `security-db-conn-string-6` (score 30)
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.4 | **Score**: 30
**Location**: `src/lib/db/paths.ts:6`
**Description**: The database location is derived from `process.env.AGENTGRAPHED_DATA_DIR` with no validation, and the resulting path is used to create directories and open a SQLite file. An attacker who can influence the environment can redirect the database (and its stored API keys) to an arbitrary writable location.
**Remediation**: Validate that `AGENTGRAPHED_DATA_DIR` resolves to an absolute path inside an expected base directory, and reject or normalize values containing traversal segments before use.
**Depends On**: None | **Blocks**: None

### Priority 18: `security-env-file-committed-3` (score 30)
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.4 | **Score**: 30
**Location**: `.gitignore:6`
**Description**: The ignore rules cover `.env*` but explicitly re-include `!.env.example`. If `.env.example` ever contains real values (a common copy-paste mistake), it would be committed. The repository also stores API keys in the local SQLite `settings` table, so key material exists outside the ignore rules entirely.
**Remediation**: Keep `.env.example` free of real values, add a CI secret-scanning step (e.g. gitleaks) over the full history, and document that API keys stored in the settings table are plaintext on disk.
**Depends On**: None | **Blocks**: None

### Priority 19: `database-missing-app-pool-8` (score 29.25)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.45 | **Score**: 29.25
**Location**: `src/lib/db/client.ts:6`
**Description**: There is no application-level connection pool or concurrency limiter around the single better-sqlite3 handle. All request handlers and the background ingest share one synchronous connection, so a slow analytical query blocks every other request on the event loop with no queueing or backpressure.
**Remediation**: Introduce a lightweight query queue/limiter for heavy analytical queries, or move long aggregations to a worker thread with its own connection so request handling is not blocked.
**Depends On**: None | **Blocks**: None

### Priority 20: `cost-no-automated-tests-4` (score 28)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 28
**Location**: `package.json:36`
**Description**: The only test script is `test:sources`, which runs two source-parsing test files via tsx. There is no test runner, no coverage, and no tests for the pricing, cost estimation, LLM client, ingest, or quota modules. The CI workflow never runs any tests at all — it only builds and boots the binary — so regressions in cost calculation or ingest logic ship undetected.
**Remediation**: Add a real test runner (e.g. vitest/node:test) with coverage for pricing, recost, and ingest logic, and invoke it as a required step in the CI workflow.
**Depends On**: None | **Blocks**: None

### Priority 21: `security-gha-job-no-timeout-7` (score 27)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 27
**Location**: `.github/workflows/ci.yml:8`
**Description**: The `build` job in ci.yml defines no `timeout-minutes`. A hung build, install, or the backgrounded server poll loop can occupy a runner indefinitely (default 360 minutes), burning CI minutes and masking a stuck process.
**Remediation**: Add `timeout-minutes: 15` (or an appropriate bound) to the `build` job so a wedged step fails fast instead of consuming the runner for hours.
**Depends On**: None | **Blocks**: None

### Priority 22: `database-undersized-pool-2` (score 26)
**Module**: database | **Severity**: high | **Effort**: XS | **Confidence**: 0.4 | **Score**: 26
**Location**: `src/lib/db/client.ts:6`
**Description**: The design uses exactly one shared connection for all readers and the background writer. Under concurrent dashboard requests plus ingest, this single connection serializes all access and provides no read concurrency, effectively an undersized pool of one.
**Remediation**: For read-heavy workloads, open a small pool of read-only connections (SQLite WAL supports concurrent readers) while keeping a single writer, so dashboard reads do not serialize behind ingest writes.
**Depends On**: None | **Blocks**: None

### Priority 23: `security-gha-no-concurrency-prod-10` (score 24)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 24
**Location**: `.github/workflows/publish.yml:24`
**Description**: The publish workflow has no `concurrency` group. Two tags pushed in quick succession (or a re-run racing a new tag) can execute `npm publish` concurrently against the same package, producing partial/duplicate releases and interleaved registry writes.
**Remediation**: Add a `concurrency` block with `group: publish-${{ github.ref }}` and `cancel-in-progress: false` so only one publish per tag runs at a time and releases are serialized.
**Depends On**: None | **Blocks**: None

### Priority 24: `structure-service-sql-5` (score 18.7)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 18.7
**Location**: `src/lib/queries.ts:60`
**Description**: The query layer (src/lib/queries.ts) is a service module that embeds raw SQL strings directly (SELECT ... FROM sessions s JOIN projects p ...) instead of delegating to a repository/data-access layer. Business logic such as day grouping, token attribution, and multi-day session role computation is interleaved with SQL execution in getTimeline(), getProjects(), getTodaySessions(), etc.
**Remediation**: Extract all SQL into a dedicated repository module (e.g. src/lib/db/repositories/sessions.ts) exposing typed methods like findSessionsInRange(), and keep queries.ts as a thin orchestration layer that only composes repository calls and shapes results.
**Depends On**: None | **Blocks**: None

### Priority 25: `database-connection-timeout-high-3` (score 18.2)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.7 | **Score**: 18.2
**Location**: `src/lib/db/client.ts:11`
**Description**: The better-sqlite3 connection is opened with only journal_mode=WAL and synchronous=NORMAL pragmas. No busy_timeout is set, so when the background ingest writer (src/lib/ingest/auto.ts) holds a write lock while a dashboard read/write runs, SQLite immediately returns SQLITE_BUSY instead of waiting, surfacing as intermittent 'database is locked' errors.
**Remediation**: Set a busy timeout on the connection, e.g. `_sqlite.pragma('busy_timeout = 5000')`, so concurrent ingest and dashboard access wait for the lock instead of failing immediately.
**Depends On**: None | **Blocks**: None

### Priority 26: `flows-missing-timeout-6` (score 18)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 18
**Location**: `src/lib/quota/probe.ts:57`
**Description**: The outbound fetch to https://api.anthropic.com/v1/messages is issued with no AbortController/signal and no timeout, so a hung or slow Anthropic endpoint blocks the /api/quota-probe request handler indefinitely (the route awaits probeClaudeQuota directly). The same pattern appears in the retry path at line 96.
**Remediation**: Wrap the probe fetch in an AbortController with a short timeout (e.g. 5s) and pass `signal: ctrl.signal`, clearing the timer in a finally block; return a structured {ok:false,error:'timeout'} on abort.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 27: `security-missing-headers-10` (score 18)
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.6 | **Score**: 18
**Location**: `next.config.mjs:2`
**Description**: The Next.js config defines no `headers()` block, so responses lack security headers such as `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, and `Referrer-Policy`. The dashboard renders user-derived session content, so the absence of CSP and framing protections leaves it exposed to injected-content and clickjacking risks.
**Remediation**: Add an async `headers()` entry in next.config.mjs that sets `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP frame-ancestors), and `Referrer-Policy: no-referrer` on all routes.
**Depends On**: None | **Blocks**: None

### Priority 28: `structure-repository-logic-4` (score 17.6)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 17.6
**Location**: `src/lib/queries.ts:155`
**Description**: getTimeline() mixes data-access (the prepared SELECT with dynamic WHERE building) with substantial domain logic: computing startOfDayMs, spanDays, assigning 'started'/'continued'/'closed' roles, and attributing tokens/cost only to the closing day. This is business logic living inside what should be a repository read.
**Remediation**: Move the day-grouping and role-attribution logic into a pure domain function (e.g. groupSessionsByDay(rows)) that takes already-fetched rows, leaving the repository method responsible only for the SQL fetch.
**Depends On**: None | **Blocks**: None

### Priority 29: `flows-error-leaks-stack-6` (score 17)
**Module**: flows | **Severity**: medium | **Effort**: S | **Confidence**: 0.85 | **Score**: 17
**Location**: `src/app/api/ingest-local/route.ts:18`
**Description**: The catch block returns `(e as Error).message` verbatim in the JSON response body, exposing internal error details (file paths, SQLite errors, stack-derived messages) to any caller of the unauthenticated ingest endpoint.
**Remediation**: Log the full error server-side and return a generic message such as 'Ingest failed' with a correlation id, keeping internal error text out of the HTTP response.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 30: `flows-missing-error-handler-5` (score 17)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 17
**Location**: `src/lib/ingest/auto.ts:104`
**Description**: triggerBackgroundIngest runs the ingest pipeline as a fire-and-forget async IIFE whose catch block is empty (`catch { // Best-effort }`), so any failure in runIngest, maybeAutoClassify or maybeSubmitLeaderboard is silently swallowed with no logging, metric or retry signal.
**Remediation**: Log the caught error with context (e.g. console.error('background ingest failed', err)) and record a failure counter/timestamp so repeated silent failures are observable.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 31: `database-lock-timeout-missing-10` (score 16.9)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.65 | **Score**: 16.9
**Location**: `src/lib/db/client.ts:11`
**Description**: No lock timeout is configured on the SQLite connection. The background ingest (src/lib/ingest/auto.ts) and the request-serving queries share the same file; without a busy/lock timeout, a write lock held by ingest causes immediate SQLITE_BUSY failures on concurrent reads/writes rather than waiting.
**Remediation**: Set `PRAGMA busy_timeout = 5000` (and consider `PRAGMA journal_mode = WAL` is already set) so lock contention between ingest and dashboard queries is retried instead of failing.
**Depends On**: None | **Blocks**: None

### Priority 32: `security-rate-limit-weak-6` (score 16.5)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 16.5
**Location**: `src/app/api/quota-probe/route.ts:31`
**Description**: The quota-probe endpoint has no rate limiting. Each call issues a real outbound request to Anthropic/OpenAI using the user's credentials, so a loop of requests can burn the user's API quota and trip provider rate limits.
**Remediation**: Add a per-process rate limit (e.g. minimum interval between probes, or a token bucket) and return 429 when the limit is exceeded.
**Depends On**: None | **Blocks**: None

### Priority 33: `structure-config-logic-8` (score 16.5)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 16.5
**Location**: `src/lib/ingest/sources.ts:44`
**Description**: fallbackPath() resolves configuration by chaining a DB setting, two environment variables, and a hardcoded homedir default inline in application logic. Configuration resolution is entangled with runtime behavior rather than being centralized in a config module.
**Remediation**: Introduce a dedicated config module that reads and normalizes all source-directory settings (DB setting, env vars, defaults) once, and have fallbackPath() consume that resolved config object.
**Depends On**: None | **Blocks**: None

### Priority 34: `structure-low-cohesion-5` (score 16.5)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 16.5
**Location**: `src/lib/queries.ts:1`
**Description**: queries.ts is a grab-bag module holding unrelated responsibilities: session reads, project aggregation, timeline day-grouping, token breakdown, settings get/set, and leaderboard session selection. These concerns change for different reasons, indicating low cohesion.
**Remediation**: Split queries.ts by aggregate: sessions.ts, projects.ts, timeline.ts, settings.ts, and leaderboard.ts, each exposing only the queries for its own domain.
**Depends On**: None | **Blocks**: None

### Priority 35: `flows-missing-rate-limit-8` (score 16)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 16
**Location**: `src/app/api/quota-probe/route.ts:26`
**Description**: POST /api/quota-probe performs a live outbound API call (Anthropic or OpenAI) on every invocation with no rate limiting or throttling. The probe module itself documents that Anthropic returns 429 when polled too fast, confirming the endpoint is abusable to burn the user's quota and trigger provider rate limits.
**Remediation**: Add a per-provider cooldown (e.g. reject with 429 if a probe ran within the last N seconds) and/or a token-bucket limiter on the route before calling probeClaudeQuota/probeCodexQuota.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 36: `database-heavy-migration-5` (score 15.6)
**Module**: database | **Severity**: medium | **Effort**: L | **Confidence**: 0.6 | **Score**: 15.6
**Location**: `src/lib/db/client.ts:150`
**Description**: ensureSchema runs a series of ALTER TABLE ADD COLUMN statements and backfill UPDATEs (e.g. `UPDATE sessions SET source_tag = 'default' WHERE source_tag IS NULL` and the categories backfill `UPDATE sessions SET categories = json_array(category)`) directly at startup on the live database. On a large existing DB these full-table UPDATEs run synchronously inside getDb(), blocking the first request and holding a write lock for the duration.
**Remediation**: Move the backfill UPDATEs out of the synchronous startup path into a versioned, chunked migration that runs in the background (or in a transaction with progress reporting) so startup is not blocked by a full-table rewrite.
**Depends On**: None | **Blocks**: None

### Priority 37: `database-missing-index-where-4` (score 15.6)
**Module**: database | **Severity**: medium | **Effort**: S | **Confidence**: 0.6 | **Score**: 15.6
**Location**: `src/lib/queries.ts:175`
**Description**: getTimeline builds a WHERE clause filtering on s.source_tag (line 175: where.push('s.source_tag = ?')) and s.provider, and the search branch filters on s.first_prompt LIKE ? OR s.summary LIKE ?. The source_tag column is indexed (sessions_source_tag_idx) but the LIKE search on first_prompt/summary has no supporting index and will force a full table scan of sessions on every timeline search.
**Remediation**: Add a covering index for the search path (e.g. CREATE INDEX sessions_first_prompt_idx ON sessions(first_prompt)) or move search to an FTS5 virtual table so LIKE '%term%' queries do not scan the whole sessions table.
**Depends On**: None | **Blocks**: None

### Priority 38: `structure-framework-leak-3` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `src/lib/ingest/auto.ts:16`
**Description**: auto.ts (a core ingest module) imports getSetting/setSetting/getSessionsForLeaderboard from ../queries and drives leaderboard HTTP submission, mixing framework-adjacent scheduling concerns with domain ingest logic. The background scheduler and leaderboard submission are entangled with the ingest pipeline rather than isolated behind an interface.
**Remediation**: Separate the periodic scheduler and leaderboard submission into their own modules with explicit interfaces, and have the ingest trigger call them via injected callbacks rather than importing query helpers directly.
**Depends On**: None | **Blocks**: None

### Priority 39: `structure-service-orchestration-3` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `src/lib/ingest/run.ts:14`
**Description**: runIngest() orchestrates multiple concerns in one function: it triggers Claude and Codex ingestion, then performs pricing-metadata comparison, recosting, and settings persistence inline. The recost/pricing-refresh responsibility is not separated from the ingest orchestration.
**Remediation**: Extract the pricing-refresh-and-recost block into its own function (e.g. maybeRecostOnPricingChange()) in a dedicated module, and have runIngest() call it as a single named step.
**Depends On**: None | **Blocks**: None

### Priority 40: `security-cors-wildcard-2` (score 15)
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.5 | **Score**: 15
**Location**: `src/app/api/quota-probe/route.ts:23`
**Description**: The quota-probe POST handler accepts requests from any origin and performs a privileged action (reading stored provider credentials and issuing an outbound authenticated probe) without any Origin/CSRF check. A malicious page in the user's browser can trigger the probe against the local server.
**Remediation**: Validate the `Origin`/`Host` header on state-changing local endpoints and reject cross-origin requests, or require a per-session CSRF token on POST handlers.
**Depends On**: None | **Blocks**: None

### Priority 41: `security-no-security-maintenance-7` (score 15)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 15
**Location**: `package.json:30`
**Description**: Dependencies are declared with caret ranges (`^`) and there is no automated dependency-vulnerability scanning or update workflow in the repository. Without Dependabot/Renovate or an `npm audit` gate in CI, known CVEs in transitive dependencies can go unnoticed.
**Remediation**: Enable Dependabot (or Renovate) for npm and add an `npm audit --audit-level=high` step to the CI workflow so vulnerable dependency versions fail the build.
**Depends On**: None | **Blocks**: None

### Priority 42: `database-missing-bloat-monitoring-5` (score 13)
**Module**: database | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 13
**Location**: `src/lib/db/client.ts:12`
**Description**: The database is a long-lived local SQLite file (agentgraphed.sqlite) that accumulates sessions, messages, and tool_io rows indefinitely, but there is no VACUUM, auto_vacuum, or free-page/bloat monitoring anywhere in the client or ingest code. Deleted or rewritten rows (e.g. the tool_io wipe on the v4→v5 transition) leave free pages that are never reclaimed.
**Remediation**: Enable `PRAGMA auto_vacuum = INCREMENTAL` and periodically run `PRAGMA incremental_vacuum`, plus track page_count/freelist_count to alert on bloat.
**Depends On**: None | **Blocks**: None

### Priority 43: `database-missing-composite-index-5` (score 13)
**Module**: database | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 13
**Location**: `src/lib/db/schema.ts:47`
**Description**: Queries frequently combine a project filter with an ordering on started_at (getSessionsForProject: WHERE project_id = ? ORDER BY started_at DESC LIMIT ?). The schema has separate single-column indexes sessions_project_idx and sessions_started_idx, but no composite index, so the project-filtered ordered query must sort the matched rows.
**Remediation**: Add a composite index sessions(project_id, started_at DESC) so project-scoped session listings are served in order directly from the index.
**Depends On**: None | **Blocks**: None

### Priority 44: `database-missing-index-hot-path-2` (score 13)
**Module**: database | **Severity**: medium | **Effort**: S | **Confidence**: 0.5 | **Score**: 13
**Location**: `src/lib/queries.ts:175`
**Description**: The hot timeline query filters on s.started_at and orders by s.started_at DESC, and getTodaySessions filters on started_at/ended_at. While sessions_started_idx exists on started_at, the combined predicate `started_at < ? AND ended_at >= ?` (getTodaySessions) cannot be served by a single-column index and forces a scan of the started_at range with a filter on ended_at.
**Remediation**: Add a composite index on sessions(started_at, ended_at) so the today-window predicate can be satisfied from the index without a post-filter scan.
**Depends On**: None | **Blocks**: None

### Priority 45: `database-missing-prefetch-4` (score 13)
**Module**: database | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 13
**Location**: `src/lib/queries.ts:175`
**Description**: getTimeline issues one query for sessions and then, for each session row, the UI layer fetches per-session breakdowns via getSessionTokenBreakdown (a separate query per session). There is no eager prefetch/join of the tool_io breakdown, so rendering a timeline of N sessions triggers N additional queries.
**Remediation**: Prefetch the tool_io breakdown for all sessions in the timeline in a single grouped query (WHERE session_id IN (...)) and pass the results down, instead of querying per session.
**Depends On**: None | **Blocks**: None

### Priority 46: `flows-retry-no-backoff-4` (score 13)
**Module**: flows | **Severity**: medium | **Effort**: XS | **Confidence**: 0.65 | **Score**: 13
**Location**: `src/lib/quota/probe.ts:96`
**Description**: After a 401 the probe immediately re-issues probeWithToken with no delay or backoff, and the refresh path likewise retries instantly. A persistently unauthorized token therefore produces back-to-back API calls with no spacing.
**Remediation**: Introduce a short exponential backoff (e.g. 250ms–1s with jitter) before the retry attempt, and cap the number of retries so a bad token cannot cause a tight retry loop.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 47: `security-gha-action-unpinned-5` (score 12.6)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 12.6
**Location**: `.github/workflows/ci.yml:12`
**Description**: Third-party and first-party GitHub Actions are referenced by mutable major-version tags (`actions/checkout@v4`, `actions/setup-node@v4`) instead of a full commit SHA. A tag can be moved or a compromised upstream release can silently change what runs in CI with the repository's token.
**Remediation**: Pin every `uses:` reference to a full 40-character commit SHA (e.g. `actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955 # v4.3.0`) and let Dependabot/Renovate bump the SHA.
**Depends On**: None | **Blocks**: None

### Priority 48: `cost-gha-no-timeout-9` (score 12)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 12
**Location**: `.github/workflows/ci.yml:8`
**Description**: The CI build job has no timeout-minutes set, so a hung `npm run build`, a stuck `npm pack`/install, or the boot-and-poll loop can occupy a runner for the default 360-minute limit, burning CI minutes. The publish job in publish.yml likewise has no timeout (only verify-platforms sets one).
**Remediation**: Set an explicit `timeout-minutes` (e.g. 15) on the build and publish jobs so a hung step cannot consume the full default runner budget.
**Depends On**: None | **Blocks**: None

### Priority 49: `flows-message-schema-no-version-1` (score 12)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 12
**Location**: `src/lib/ingest/auto.ts:196`
**Description**: The leaderboard payload is built inline with a hardcoded `schema_version: LEADERBOARD_SCHEMA_VERSION` constant and a hand-rolled field mapping, with no shared schema definition or validation between the client payload and the server contract; the same duplicated mapping exists in src/app/leaderboard/actions.ts.
**Remediation**: Extract the leaderboard payload into a single versioned schema module (e.g. zod) shared by both call sites, and validate the payload against it before POSTing so client and server cannot drift.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 50: `security-unmaintained-dep-4` (score 12)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 12
**Location**: `package.json:22`
**Description**: The project depends on `@anthropic-ai/sdk` at `^0.32.0` and `openai` at `^6.42.0`; the Anthropic SDK major line is well behind current releases, and the lockfile pins `@anthropic-ai/sdk` 0.32.1. Stale SDK versions accumulate unpatched advisories and miss security fixes shipped in later releases.
**Remediation**: Upgrade `@anthropic-ai/sdk` and `openai` to current supported majors, re-run the test suite, and add a scheduled dependency-update job to keep them current.
**Depends On**: None | **Blocks**: None

### Priority 51: `database-effective-cache-misconfigured-4` (score 11.7)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.45 | **Score**: 11.7
**Location**: `src/lib/cache.ts:22`
**Description**: ttlMemo caches query results in a process-local Map keyed only by a string, with a 5s TTL and opportunistic cleanup only when store.size > 64. Keys are not namespaced by parameters in all call sites (e.g. getProjects uses a fixed key), so a cache entry can outlive the data it represents and be served stale after an ingest that does not call clearMemo().
**Remediation**: Include all query parameters in the memo key and invalidate the cache explicitly on every write path (ingest, recost, classify) rather than relying solely on the short TTL.
**Depends On**: None | **Blocks**: None

### Priority 52: `database-statement-timeout-missing-9` (score 11.7)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.45 | **Score**: 11.7
**Location**: `src/lib/db/client.ts:11`
**Description**: No statement timeout or progress handler is configured on the SQLite connection. Long-running analytical queries (e.g. the GROUP BY aggregations in getProjects/getTodaySummary over an ever-growing sessions/tool_io table) can run unbounded and block the single Node event loop, with no mechanism to abort them.
**Remediation**: Register a progress handler via `_sqlite.progressHandler` or wrap heavy analytical queries with a deadline so a runaway aggregation cannot stall the server indefinitely.
**Depends On**: None | **Blocks**: None

### Priority 53: `cost-gha-no-dependency-cache-5` (score 11.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 11.2
**Location**: `.github/workflows/publish.yml:63`
**Description**: The verify-platforms job runs actions/setup-node without `cache: 'npm'` (unlike the build and publish jobs), so every matrix leg (macos, windows, ubuntu) re-downloads the full npm dependency tree from scratch on each release, wasting CI minutes and network bandwidth.
**Remediation**: Add `cache: 'npm'` to the setup-node step in the verify-platforms job so the npm cache is reused across matrix runs.
**Depends On**: None | **Blocks**: None

### Priority 54: `cost-llm-high-usage-1` (score 11.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 11.2
**Location**: `src/lib/llm/classify.ts:160`
**Description**: The classifier samples up to 8 user prompts per session (MAX_SAMPLED_PROMPTS = 8, MAX_PROMPT_CHARS = 400) and sends them to the LLM in batches of 20 sessions, and auto-classify runs by default (only 'off' opts out) on every background ingest tick. With no per-run token cap, no cost ceiling, and no user-visible budget, a large backlog of unclassified sessions can silently generate a large, unbounded LLM bill.
**Remediation**: Add a hard per-run token/cost budget to classifyBatch (stop batching once estimated spend exceeds a configurable cap), surface the running cost in the UI, and require explicit opt-in rather than default-on auto-classify.
**Depends On**: None | **Blocks**: None

### Priority 55: `github-log-pattern-2` (score 10.5)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 10.5
**Location**: `src/lib/ingest/run.ts:1`
**Description**: The recost block swallows every failure with a bare `catch {}` and no log line, so a persistent pricing/recost failure (bad JSON, missing file, DB error) is invisible in the server output.
**Remediation**: Log the caught error at warn level with context (`console.warn('recost skipped', (e as Error).message)`) instead of silently discarding it.
**Depends On**: None | **Blocks**: None

### Priority 56: `cost-api-no-usage-monitoring-9` (score 10.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 10.4
**Location**: `src/lib/llm/classify.ts:186`
**Description**: classifyBatch accumulates totalCost from estimateLlmCost and returns it, but nothing persists or aggregates that spend over time — there is no usage dashboard, no alerting, and no historical record of LLM API consumption. The same is true for generateSessionContext, which returns costUsd that is discarded by callers. Users cannot see how much they have spent on classification/summarization.
**Remediation**: Persist per-call LLM usage (tokens and estimated USD) to a table and expose an aggregate usage view with alerting thresholds so spend is observable over time.
**Depends On**: None | **Blocks**: None

### Priority 57: `database-oversized-pool-1` (score 10.4)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.4 | **Score**: 10.4
**Location**: `src/lib/db/client.ts:6`
**Description**: getDb() caches a single module-level better-sqlite3 connection in `_db`/`_sqlite`. In a Next.js standalone server with multiple worker processes or dev hot-reload, each process opens its own connection to the same file with no coordination, and the module-level singleton is not process-safe. This is a single-connection design rather than a bounded pool, so concurrent writers across processes contend on the same file lock.
**Remediation**: Document and enforce single-process access (or use a shared connection/WAL-aware pool) and ensure the singleton is reset on hot-reload so stale handles to a deleted DB file are not reused.
**Depends On**: None | **Blocks**: None

### Priority 58: `database-pg-stat-statements-disabled-1` (score 10.4)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.4 | **Score**: 10.4
**Location**: `src/lib/db/client.ts:11`
**Description**: The SQLite connection is opened without enabling any query-statistics facility (SQLite's equivalent, e.g. `PRAGMA optimize` / the sqlite_stat1 table via ANALYZE), so the query planner has no statistics on the growing sessions/tool_io tables and may choose poor plans for the analytical GROUP BY queries.
**Remediation**: Run `ANALYZE` after large ingests (or periodically) so SQLite maintains sqlite_stat1 statistics, and call `PRAGMA optimize` on connection close to keep plans current.
**Depends On**: None | **Blocks**: None

### Priority 59: `cost-api-no-retry-strategy-8` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `src/lib/llm/classify.ts:196`
**Description**: When an LLM batch call throws, classifyBatch catches the error, increments batchesFailed, and moves on with no retry and no backoff. Transient provider errors therefore permanently drop those sessions from classification, and the user must re-run the whole batch (re-paying for the successful batches) to recover them.
**Remediation**: Add bounded retries with exponential backoff and jitter for transient LLM errors, and record failed batch ids so only the failed rows are retried on the next run.
**Depends On**: None | **Blocks**: None

### Priority 60: `security-weak-rng-10` (score 9)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.3 | **Score**: 9
**Location**: `src/app/leaderboard/actions.ts:22`
**Description**: The per-install identifier is generated with `randomBytes(16).toString('hex')`, which is cryptographically strong, but the value is used as a stable identity token and is transmitted to a remote server on every submission. Its predictability is not the issue; the concern is that a long-lived bearer-like identifier is sent in cleartext over the network and persisted locally without rotation.
**Remediation**: Treat the install id as a rotating credential: rotate it periodically, and ensure submissions are sent only over TLS with the identifier scoped to the leaderboard endpoint.
**Depends On**: None | **Blocks**: None

### Priority 61: `cost-api-no-response-cache-5` (score 8.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 8.8
**Location**: `src/lib/llm/classify.ts:160`
**Description**: classifyBatch re-sends every row it is given to the LLM with no check against already-classified sessions and no response cache; the only guard is getUnclassifiedRows filtering on category IS NULL. Any caller that passes rows already classified (or re-runs after a partial failure) pays for the same classification twice, and identical prompt payloads are never deduplicated or cached.
**Remediation**: Skip rows that already have a category inside classifyBatch and cache LLM responses keyed by a hash of the prompt payload so identical batches are not re-billed.
**Depends On**: None | **Blocks**: None

### Priority 62: `security-gha-workspace-not-cleaned-6` (score 8.4)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 8.4
**Location**: `.github/workflows/publish.yml:60`
**Description**: The `verify-platforms` job installs the just-published package from the public registry and boots it, but never cleans the workspace or restricts what the installed package can do. The published tarball's install scripts (better-sqlite3 native build) execute on the runner with the job token; there is no `npm ci --ignore-scripts` or sandboxing for the untrusted registry artifact.
**Remediation**: Install the verification package with `--ignore-scripts` where possible, or run the boot check in a disposable container/step that does not carry repository credentials, and explicitly clean the workspace afterwards.
**Depends On**: None | **Blocks**: None

### Priority 63: `cost-documentation-poor-7` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `src/lib/llm/models.ts:17`
**Description**: The model price table in models.ts is hand-maintained and hardcoded (input/output USD per 1M tokens) with a comment saying prices are 'sourced from public list pricing', but there is no documented process, source link, or update cadence for keeping these numbers current. Stale prices here directly produce wrong cost estimates shown to users.
**Remediation**: Document the source and update process for the model price table, and add a test or build-time check that flags entries older than a defined staleness window.
**Depends On**: None | **Blocks**: None

### Priority 64: `cost-slow-build-1` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `package.json:30`
**Description**: The build script runs `node scripts/fetch-pricing.mjs && next build && node scripts/copy-standalone-assets.mjs` and is invoked both in CI and in the `prepack` hook, so every `npm pack`/publish re-runs the full Next.js standalone build. There is no build cache (e.g. Next build cache or turbo) configured, so repeated builds in CI and locally recompile everything from scratch.
**Remediation**: Enable Next.js build caching in CI (actions/cache for .next/cache) and avoid re-running the full build in prepack when a fresh build already exists.
**Depends On**: None | **Blocks**: None

### Priority 65: `github-commit-history-1` (score 7.7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 7.7
**Location**: `CHANGELOG.md:1`
**Description**: The changelog's `[Unreleased]` section mixes a dependency bump, a bug fix, and three new features under `Changed`/`Fixed`/`Added` but the release entries below (0.5.8, 0.5.7, …) are dated 2026-06-11 while the package version in package.json is 0.5.9 — the Unreleased block has no version heading, so it is unclear whether 0.5.9 is already shipped or still pending.
**Remediation**: Either promote the `[Unreleased]` block to a dated `## [0.5.9] — YYYY-MM-DD` heading matching package.json, or add a `## [0.5.9]` entry so the changelog and the published version stay in lockstep.
**Depends On**: None | **Blocks**: None

### Priority 66: `github-log-pattern-4` (score 7.7)
**Module**: github | **Severity**: medium | **Effort**: S | **Confidence**: 0.55 | **Score**: 7.7
**Location**: `src/lib/quota/probe.ts:40`
**Description**: `probeClaudeQuota` returns structured error strings but never logs the HTTP status or the raw rate-limit headers when a probe fails, making it hard to distinguish a transient 529 from a real auth problem after the fact.
**Remediation**: Log the probe outcome (status, provider, whether a token refresh occurred) at debug/info level so quota-probe failures are diagnosable from the server log.
**Depends On**: None | **Blocks**: None

### Priority 67: `cost-no-performance-budget-10` (score 7.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 7.2
**Location**: `src/lib/ingest/auto.ts:22`
**Description**: The background ingest scheduler runs every 5 minutes (TICK_MS) with a 10-second debounce and no performance budget or cost ceiling on how much work each tick may do. On a machine with a very large session history, each tick can re-scan and re-cost the entire dataset with no bound on duration or resource use.
**Remediation**: Define and enforce a per-tick performance budget (max files scanned, max duration) and back off the tick interval when a scan exceeds it.
**Depends On**: None | **Blocks**: None

### Priority 68: `github-issue-health-1` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `.github/ISSUE_TEMPLATE/bug_report.md:1`
**Description**: The bug report template has no `title` prefix and no `assignees`, and more importantly it does not request the AgentGraphed version or a minimal reproduction in a structured field — the free-text `**Logs / screenshots**` section is the only place for diagnostics, so triage depends on the reporter volunteering version/OS.
**Remediation**: Add a `title: '[Bug]: '` prefix and structured required fields (version, Node version, OS) so incoming bug reports are consistently triageable.
**Depends On**: None | **Blocks**: None

### Priority 69: `cost-gha-infinite-artifacts-6` (score 6.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 6.4
**Location**: `.github/workflows/ci.yml:22`
**Description**: The CI job runs `npm pack` and installs the resulting tarball but never uploads it as an artifact, and the publish job also runs `npm pack` without retention control. More importantly, no artifact retention policy is configured anywhere, so any future artifact uploads would default to the repository retention setting with no cost-aware cap.
**Remediation**: Explicitly set `retention-days` on any artifact upload steps and avoid uploading build tarballs that are not needed for debugging.
**Depends On**: None | **Blocks**: None

### Priority 70: `structure-dto-logic-7` (score 3.58)
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.65 | **Score**: 3.58
**Location**: `src/app/leaderboard/actions.ts:151`
**Description**: toSessionRow() is a DTO-mapping function that also performs value transformation (Math.round(s.est_cost_usd * 10000) / 10000) and date serialization inline, and the surrounding submitNow() mixes payload shaping with chunking and network orchestration.
**Remediation**: Move payload/DTO construction into a pure mapper module (e.g. leaderboardPayload.ts) that takes domain rows and returns the wire shape, keeping the action focused on orchestration.
**Depends On**: None | **Blocks**: None

### Priority 71: `flows-missing-request-id-7` (score 3)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3
**Location**: `src/app/api/ingest-local/route.ts:13`
**Description**: The ingest endpoint neither accepts nor propagates a request/correlation id, and its error response carries no identifier, making a failed ingest impossible to correlate with server-side logs.
**Remediation**: Generate (or accept) an X-Request-Id per invocation, include it in log lines and in the JSON error response, and propagate it into runIngest for end-to-end tracing.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 72: `database-unused-indexes-6` (score 2.93)
**Module**: database | **Severity**: low | **Effort**: S | **Confidence**: 0.45 | **Score**: 2.93
**Location**: `src/lib/db/schema.ts:47`
**Description**: The schema declares indexes that the provided query code never uses: sessions_provider_idx (queries filter provider only inside getTimeline, which already orders by started_at), sessions_model_idx (no query in the provided files filters on model), and messages_timestamp_idx (no provided query filters messages by timestamp). Each unused index adds write amplification on every ingest insert.
**Remediation**: Drop indexes that no query uses (sessions_model_idx, messages_timestamp_idx) or confirm their consumers exist; keep only indexes backed by an actual query predicate.
**Depends On**: None | **Blocks**: None

### Priority 73: `flows-missing-cors-9` (score 2.75)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.55 | **Score**: 2.75
**Location**: `src/app/api/quota-probe/route.ts:26`
**Description**: The quota-probe route returns JSON responses without any CORS headers or origin restriction, and it is a state-changing POST that reads the user's stored credentials and writes a quota snapshot. No Access-Control-Allow-Origin policy is defined for the API surface.
**Remediation**: Add an explicit CORS policy (restrict to the local dashboard origin, or omit CORS headers entirely and reject cross-origin requests) for the API routes that touch credentials and local state.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 74: `database-max-lifetime-missing-5` (score 2.6)
**Module**: database | **Severity**: low | **Effort**: XS | **Confidence**: 0.4 | **Score**: 2.6
**Location**: `src/lib/db/client.ts:6`
**Description**: The module-level `_db`/`_sqlite` singleton is never closed or recycled. In a long-running standalone server, if the underlying DB file is replaced or the process forks, the cached handle persists for the process lifetime with no max-lifetime or health-check mechanism.
**Remediation**: Add a close/reopen path (e.g. on SIGTERM and on detected file replacement) and expose a resetDb() that closes the handle so a stale connection is not reused indefinitely.
**Depends On**: None | **Blocks**: None

### Priority 75: `database-idle-timeout-missing-4` (score 2.27)
**Module**: database | **Severity**: low | **Effort**: XS | **Confidence**: 0.35 | **Score**: 2.27
**Location**: `src/lib/db/client.ts:6`
**Description**: The cached SQLite connection has no idle timeout or lifecycle management; it stays open for the entire process lifetime. Combined with the periodic 5-minute ingest timer in src/lib/ingest/auto.ts, the handle is never released even when the dashboard is idle.
**Remediation**: Add an idle-close policy (close the handle after N minutes of inactivity and lazily reopen on next getDb()) to release file locks and WAL resources when the app is not in use.
**Depends On**: None | **Blocks**: None

### Priority 76: `security-error-detail-1` (score 0.9)
**Module**: security | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.9
**Location**: `src/app/api/ingest-local/route.ts:17`
**Description**: The ingest endpoint returns the raw exception message to the client (`error: (e as Error).message`) with a 500 status. Internal error text (paths, SQL, stack-adjacent detail) is exposed to any caller that can reach the local server.
**Remediation**: Return a generic error message to the client and log the detailed exception server-side; only include sanitized, non-sensitive detail in the response.
**Depends On**: None | **Blocks**: None

### Priority 77: `github-log-pattern-1` (score 0.49)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.7 | **Score**: 0.49
**Location**: `src/lib/llm/classify.ts:1`
**Description**: `classifyBatch` logs only `console.error('classify batch failed', msg)` with no session/batch identifier, no provider, and no model, so a failed classification batch cannot be correlated to the sessions it was processing.
**Remediation**: Include the batch index, row count, provider, and model in the error log (e.g. `console.error('classify batch failed', { batchIndex, batchSize, provider, model, msg })`).
**Depends On**: None | **Blocks**: None

### Priority 78: `github-log-pattern-3` (score 0.42)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.42
**Location**: `bin/agentgraphed.js:1`
**Description**: `triggerIngest` reports failures only via `console.warn` with the HTTP status or error message and returns null; the caller then prints nothing about the failure, so a user whose ingest silently failed sees a normal-looking boot with zero sessions.
**Remediation**: Surface ingest failure to the user explicitly (e.g. print a clear 'Ingest failed — check logs' line and exit non-zero or retry) rather than a terse warn that is easy to miss.
**Depends On**: None | **Blocks**: None

### Priority 79: `github-issue-health-2` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `.github/ISSUE_TEMPLATE/feature_request.md:1`
**Description**: The feature request template lacks a `title` prefix and any `labels` beyond `enhancement`; there is no field capturing the affected area (ingest, UI, pricing, leaderboard), so feature requests cannot be routed or deduplicated without manual reading.
**Remediation**: Add a `title: '[Feature]: '` prefix and a dropdown/area field so feature requests can be auto-labeled and routed.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `database-full-table-scan-3`: Replace the LIKE '%term%' search with an FTS5 virtual table over first_prompt/summary, or at minimum restrict to prefix matching (term%) so the existing indexes can be used. (M)
- `security-logs-contain-secrets-12`: Do not include raw model output in error messages. (XS)
- `flows-missing-idempotency-3`: Require an idempotency key (or a single-flight mutex) on the ingest endpoint, reject duplicate concurrent invocations with 409, and gate the route behind a local-only check so repeated calls cannot… (S)
- `database-irreversible-migration-1`: Record an explicit schema_version in the settings table and gate each migration on it, and make backfills idempotent and reversible (or snapshot the DB before running destructive UPDATEs). (L)
- `flows-fire-and-forget-critical-1`: Move the ingest work onto a durable background job/queue (or at minimum await it in a dedicated worker with a persisted 'pending' marker) so a crash mid-flight does not silently drop the scan and… (M)
- `security-gha-overpermissive-2`: Split the GitHub Release creation into a separate job that alone receives `contents: write`, and keep the build/publish job at `contents: read` with only `id-token: write`. (XS)
- `security-no-input-validation-14`: Validate and clamp all query parameters: reject non-numeric input, and bound `days` to a sane maximum (e.g. (M)
- `security-secret-in-code-1`: Move the client id into a named, documented constant module with a comment stating it is public, and add a lint/CI check that fails on high-entropy string literals in source. (XS)
- `structure-high-coupling-1`: Define a narrow repository interface for the session/message reads and writes classify.ts needs, inject it into classifyBatch(), and keep the LLM module free of direct getSqlite() calls. (L)
- `database-iteration-overload-5`: Batch the recost in chunks (e.g. (M)
- `database-risky-migration-3`: Wrap each migration step (ALTER + backfill) in a single better-sqlite3 transaction so a crash leaves the schema either fully migrated or untouched, and record completion in a schema_version row. (M)
- `database-missing-index-fk-1`: Add explicit FOREIGN KEY constraints (with ON DELETE CASCADE) to sessions.project_id, messages.session_id, and tool_io.session_id, and enable PRAGMA foreign_keys = ON in getDb() so orphaned rows… (S)
- `database-n-plus-one-risk-1`: Batch the breakdown lookups: run a single `SELECT session_id, kind, source, SUM(bytes), SUM(est_tokens), COUNT(*) FROM tool_io WHERE session_id IN (?,...) GROUP BY session_id, kind, source` and map… (M)
- `flows-missing-dlq-2`: Persist failed submission payloads to a local outbox table (or DLQ) and retry them on the next tick, so transient network failures do not permanently lose leaderboard rows. (M)
- `database-overfetch-relation-1`: Select only the columns the list view needs, or split the heavy text columns (first_prompt, summary) into a separate detail query fetched on demand. (S)
- `database-sequential-pagination-1`: Use a composite keyset cursor on (started_at, id) — WHERE (started_at, id) < (?, ?) ORDER BY started_at DESC, id DESC — and add a composite index sessions(started_at, id) to make pagination stable… (S)
- `security-db-conn-string-6`: Validate that `AGENTGRAPHED_DATA_DIR` resolves to an absolute path inside an expected base directory, and reject or normalize values containing traversal segments before use. (XS)
- `security-env-file-committed-3`: Keep `.env.example` free of real values, add a CI secret-scanning step (e.g. (XS)
- `database-missing-app-pool-8`: Introduce a lightweight query queue/limiter for heavy analytical queries, or move long aggregations to a worker thread with its own connection so request handling is not blocked. (M)
- `cost-no-automated-tests-4`: Add a real test runner (e.g. (M)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 15` (or an appropriate bound) to the `build` job so a wedged step fails fast instead of consuming the runner for hours. (M)
- `database-undersized-pool-2`: For read-heavy workloads, open a small pool of read-only connections (SQLite WAL supports concurrent readers) while keeping a single writer, so dashboard reads do not serialize behind ingest writes. (XS)
- `security-gha-no-concurrency-prod-10`: Add a `concurrency` block with `group: publish-${{ github.ref }}` and `cancel-in-progress: false` so only one publish per tag runs at a time and releases are serialized. (M)
- `structure-service-sql-5`: Extract all SQL into a dedicated repository module (e.g. (M)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `database-connection-timeout-high-3`: Set a busy timeout on the connection, e.g. (XS)
- `flows-missing-timeout-6`: Wrap the probe fetch in an AbortController with a short timeout (e.g. (M)
- `security-missing-headers-10`: Add an async `headers()` entry in next.config.mjs that sets `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP frame-ancestors), and `Referrer-Policy:… (S)
- `structure-repository-logic-4`: Move the day-grouping and role-attribution logic into a pure domain function (e.g. (M)
- `flows-error-leaks-stack-6`: Log the full error server-side and return a generic message such as 'Ingest failed' with a correlation id, keeping internal error text out of the HTTP response. (S)
- `flows-missing-error-handler-5`: Log the caught error with context (e.g. (M)
- `database-lock-timeout-missing-10`: Set `PRAGMA busy_timeout = 5000` (and consider `PRAGMA journal_mode = WAL` is already set) so lock contention between ingest and dashboard queries is retried instead of failing. (XS)
- `security-rate-limit-weak-6`: Add a per-process rate limit (e.g. (M)
- `structure-config-logic-8`: Introduce a dedicated config module that reads and normalizes all source-directory settings (DB setting, env vars, defaults) once, and have fallbackPath() consume that resolved config object. (M)
- `structure-low-cohesion-5`: Split queries.ts by aggregate: sessions.ts, projects.ts, timeline.ts, settings.ts, and leaderboard.ts, each exposing only the queries for its own domain. (M)
- `flows-missing-rate-limit-8`: Add a per-provider cooldown (e.g. (M)
- `database-heavy-migration-5`: Move the backfill UPDATEs out of the synchronous startup path into a versioned, chunked migration that runs in the background (or in a transaction with progress reporting) so startup is not blocked… (L)
- `database-missing-index-where-4`: Add a covering index for the search path (e.g. (S)
- `structure-framework-leak-3`: Separate the periodic scheduler and leaderboard submission into their own modules with explicit interfaces, and have the ingest trigger call them via injected callbacks rather than importing query… (M)
- `structure-service-orchestration-3`: Extract the pricing-refresh-and-recost block into its own function (e.g. (M)
- `security-cors-wildcard-2`: Validate the `Origin`/`Host` header on state-changing local endpoints and reject cross-origin requests, or require a per-session CSRF token on POST handlers. (XS)
- `security-no-security-maintenance-7`: Enable Dependabot (or Renovate) for npm and add an `npm audit --audit-level=high` step to the CI workflow so vulnerable dependency versions fail the build. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `database-missing-bloat-monitoring-5`: Enable `PRAGMA auto_vacuum = INCREMENTAL` and periodically run `PRAGMA incremental_vacuum`, plus track page_count/freelist_count to alert on bloat. (M)
- `database-missing-composite-index-5`: Add a composite index sessions(project_id, started_at DESC) so project-scoped session listings are served in order directly from the index. (M)
- `database-missing-index-hot-path-2`: Add a composite index on sessions(started_at, ended_at) so the today-window predicate can be satisfied from the index without a post-filter scan. (S)
- `database-missing-prefetch-4`: Prefetch the tool_io breakdown for all sessions in the timeline in a single grouped query (WHERE session_id IN (...)) and pass the results down, instead of querying per session. (M)
- `flows-retry-no-backoff-4`: Introduce a short exponential backoff (e.g. (XS)
- `security-gha-action-unpinned-5`: Pin every `uses:` reference to a full 40-character commit SHA (e.g. (M)
- `cost-gha-no-timeout-9`: Set an explicit `timeout-minutes` (e.g. (M)
- `flows-message-schema-no-version-1`: Extract the leaderboard payload into a single versioned schema module (e.g. (M)
- `security-unmaintained-dep-4`: Upgrade `@anthropic-ai/sdk` and `openai` to current supported majors, re-run the test suite, and add a scheduled dependency-update job to keep them current. (M)
- `database-effective-cache-misconfigured-4`: Include all query parameters in the memo key and invalidate the cache explicitly on every write path (ingest, recost, classify) rather than relying solely on the short TTL. (XS)
- `database-statement-timeout-missing-9`: Register a progress handler via `_sqlite.progressHandler` or wrap heavy analytical queries with a deadline so a runaway aggregation cannot stall the server indefinitely. (XS)
- `cost-gha-no-dependency-cache-5`: Add `cache: 'npm'` to the setup-node step in the verify-platforms job so the npm cache is reused across matrix runs. (M)
- `cost-llm-high-usage-1`: Add a hard per-run token/cost budget to classifyBatch (stop batching once estimated spend exceeds a configurable cap), surface the running cost in the UI, and require explicit opt-in rather than… (M)
- `github-log-pattern-2`: Log the caught error at warn level with context (`console.warn('recost skipped', (e as Error).message)`) instead of silently discarding it. (M)
- `cost-api-no-usage-monitoring-9`: Persist per-call LLM usage (tokens and estimated USD) to a table and expose an aggregate usage view with alerting thresholds so spend is observable over time. (M)
- `database-oversized-pool-1`: Document and enforce single-process access (or use a shared connection/WAL-aware pool) and ensure the singleton is reset on hot-reload so stale handles to a deleted DB file are not reused. (XS)
- `database-pg-stat-statements-disabled-1`: Run `ANALYZE` after large ingests (or periodically) so SQLite maintains sqlite_stat1 statistics, and call `PRAGMA optimize` on connection close to keep plans current. (XS)
- `cost-api-no-retry-strategy-8`: Add bounded retries with exponential backoff and jitter for transient LLM errors, and record failed batch ids so only the failed rows are retried on the next run. (M)
- `security-weak-rng-10`: Treat the install id as a rotating credential: rotate it periodically, and ensure submissions are sent only over TLS with the identifier scoped to the leaderboard endpoint. (M)
- `cost-api-no-response-cache-5`: Skip rows that already have a category inside classifyBatch and cache LLM responses keyed by a hash of the prompt payload so identical batches are not re-billed. (M)
- `security-gha-workspace-not-cleaned-6`: Install the verification package with `--ignore-scripts` where possible, or run the boot check in a disposable container/step that does not carry repository credentials, and explicitly clean the… (M)
- `cost-documentation-poor-7`: Document the source and update process for the model price table, and add a test or build-time check that flags entries older than a defined staleness window. (M)
- `cost-slow-build-1`: Enable Next.js build caching in CI (actions/cache for .next/cache) and avoid re-running the full build in prepack when a fresh build already exists. (M)
- `github-commit-history-1`: Either promote the `[Unreleased]` block to a dated `## [0.5.9] — YYYY-MM-DD` heading matching package.json, or add a `## [0.5.9]` entry so the changelog and the published version stay in lockstep. (M)
- `github-log-pattern-4`: Log the probe outcome (status, provider, whether a token refresh occurred) at debug/info level so quota-probe failures are diagnosable from the server log. (S)
- `cost-no-performance-budget-10`: Define and enforce a per-tick performance budget (max files scanned, max duration) and back off the tick interval when a scan exceeds it. (M)
- `github-issue-health-1`: Add a `title: '[Bug]: '` prefix and structured required fields (version, Node version, OS) so incoming bug reports are consistently triageable. (M)
- `cost-gha-infinite-artifacts-6`: Explicitly set `retention-days` on any artifact upload steps and avoid uploading build tarballs that are not needed for debugging. (M)
- `structure-dto-logic-7`: Move payload/DTO construction into a pure mapper module (e.g. (S)
- `flows-missing-request-id-7`: Generate (or accept) an X-Request-Id per invocation, include it in log lines and in the JSON error response, and propagate it into runIngest for end-to-end tracing. (S)
- `database-unused-indexes-6`: Drop indexes that no query uses (sessions_model_idx, messages_timestamp_idx) or confirm their consumers exist; keep only indexes backed by an actual query predicate. (S)
- `flows-missing-cors-9`: Add an explicit CORS policy (restrict to the local dashboard origin, or omit CORS headers entirely and reject cross-origin requests) for the API routes that touch credentials and local state. (S)
- `database-max-lifetime-missing-5`: Add a close/reopen path (e.g. (XS)
- `database-idle-timeout-missing-4`: Add an idle-close policy (close the handle after N minutes of inactivity and lazily reopen on next getDb()) to release file locks and WAL resources when the app is not in use. (XS)
- `security-error-detail-1`: Return a generic error message to the client and log the detailed exception server-side; only include sanitized, non-sensitive detail in the response. (XS)
- `github-log-pattern-1`: Include the batch index, row count, provider, and model in the error log (e.g. (XS)
- `github-log-pattern-3`: Surface ingest failure to the user explicitly (e.g. (XS)
- `github-issue-health-2`: Add a `title: '[Feature]: '` prefix and a dropdown/area field so feature requests can be auto-labeled and routed. (XS)
**Total Effort**: XL

---

## Dependencies
- `flows-missing-timeout-6` **Depends On** `structure-high-coupling-1`
- `flows-missing-idempotency-3` **Depends On** `structure-high-coupling-1`
- `flows-missing-rate-limit-8` **Depends On** `structure-high-coupling-1`
- `flows-error-leaks-stack-6` **Depends On** `structure-high-coupling-1`
- `flows-missing-error-handler-5` **Depends On** `structure-high-coupling-1`
- `flows-fire-and-forget-critical-1` **Depends On** `structure-high-coupling-1`
- `flows-missing-dlq-2` **Depends On** `structure-high-coupling-1`
- `flows-retry-no-backoff-4` **Depends On** `structure-high-coupling-1`
- `flows-message-schema-no-version-1` **Depends On** `structure-high-coupling-1`
- `flows-missing-request-id-7` **Depends On** `structure-high-coupling-1`
- `flows-missing-cors-9` **Depends On** `structure-high-coupling-1`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
