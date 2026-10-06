# Assessment Report: crypto-claude-desk

- **Repository**: crypto-claude-desk
- **Date**: 2026-10-05T21:00:29.330Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 6
- **Total Findings**: 76
- **By Severity**: critical 6 · high 15 · medium 42 · low 6 · info 7
- **By Module**: database 12 · code 9 · structure 9 · security 3 · cost 13 · performance 6 · github 24
- **Estimated Total Effort**: 15×XS, 12×S, 45×M, 4×L
- **Top 3 Priorities**:
  - `database-irreversible-migration-1` — The migration list includes irreversible DROP TABLE statements executed at every _init_db() call with no down-migration, backup, or… (critical, L) (score 97.5)
  - `database-full-table-scan-3` — getSymbolStats computes COUNT/SUM/AVG/MIN/MAX over the entire trades table filtered only by UPPER(symbol) = UPPER(?), a non-sargable… (critical, M) (score 91)
  - `code-bare-except-1` — `extractLiquidationPrice` wraps `JSON.parse(t.agent_signals)` in a `catch {}` with no binding and no logging, silently swallowing… (critical, XS) (score 85)

---

## Detailed Findings (by Priority)

### Priority 1: `database-irreversible-migration-1` (score 97.5)
**Module**: database | **Severity**: critical | **Effort**: L | **Confidence**: 0.75 | **Score**: 97.5
**Location**: `mcp-servers/crypto_learning_db.py:186`
**Description**: The migration list includes irreversible DROP TABLE statements executed at every _init_db() call with no down-migration, backup, or user_version gate; once agent_scorecards/scorecard_history are dropped the data cannot be recovered.
**Remediation**: Gate migrations behind PRAGMA user_version, take a file-level backup (or VACUUM INTO) before applying destructive steps, and provide a documented rollback path for each migration.
**Depends On**: None | **Blocks**: `code-exact-duplication-significant-2`, `code-bare-except-1`, `code-copy-paste-variant-6`, `code-missing-return-type-8`, `code-ignores-return-value-6`, `code-missing-validation-4`, `code-print-statement-5`, `code-missing-error-main-10`, `code-missing-docstring-10`, `performance-no-connection-pool-7`, `performance-no-keep-alive-9`, `performance-no-retry-jitter-8`, `performance-no-adaptive-timeout-6`, `performance-no-request-collapsing-4`, `performance-no-compression-13`

### Priority 2: `database-full-table-scan-3` (score 91)
**Module**: database | **Severity**: critical | **Effort**: M | **Confidence**: 0.7 | **Score**: 91
**Location**: `dashboard/src/lib/db.ts:227`
**Description**: getSymbolStats computes COUNT/SUM/AVG/MIN/MAX over the entire trades table filtered only by UPPER(symbol) = UPPER(?), a non-sargable expression that cannot use any index even if one existed, guaranteeing a full table scan per symbol statistics request.
**Remediation**: Store symbol in a normalized (already-uppercased) column and compare with a plain equality predicate, then add an index on that column so the aggregation can use an index scan instead of a full table scan.
**Depends On**: None | **Blocks**: None

### Priority 3: `code-bare-except-1` (score 85)
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.85 | **Score**: 85
**Location**: `dashboard/src/lib/db.ts:113`
**Description**: `extractLiquidationPrice` wraps `JSON.parse(t.agent_signals)` in a `catch {}` with no binding and no logging, silently swallowing malformed JSON and falling through to the computed default. The same pattern is repeated in market-intelligence.ts `parseOutcomes` and in the fetch helpers, hiding data-corruption problems.
**Remediation**: Bind the error (`catch (err)`) and log it (e.g. `console.warn('invalid agent_signals JSON', err)`) before falling back, so malformed trade data is visible instead of silently ignored.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 4: `security-no-input-validation-14` (score 60)
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.8 | **Score**: 60
**Location**: `dashboard/src/app/api/ohlcv/route.ts:9`
**Description**: The `symbol` query parameter is read straight from the request and passed to `getOhlcv(symbol, ...)` without any validation or allow-list check, unlike `interval` which is validated against VALID_INTERVALS. An attacker can supply arbitrary strings (path fragments, extremely long values, injection payloads) that flow into the downstream data-fetching layer.
**Remediation**: Validate `symbol` against the same allow-list used elsewhere (e.g. the `_SYMBOL_RE` pattern / supported symbols set) and return HTTP 400 for anything that does not match before calling getOhlcv.
**Depends On**: None | **Blocks**: None

### Priority 5: `database-risky-migration-3` (score 52)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.8 | **Score**: 52
**Location**: `mcp-servers/crypto_learning_db.py:186`
**Description**: _ensure_schema runs destructive migrations unconditionally on every startup — 'DROP TABLE IF EXISTS scorecard_history' and 'DROP TABLE IF EXISTS agent_scorecards' — inside a loop that swallows sqlite3.OperationalError, so historical scorecard data is silently and irreversibly deleted whenever the server initializes.
**Remediation**: Move destructive DDL out of the startup path into a versioned, one-time migration guarded by PRAGMA user_version, and archive the dropped tables (rename to *_deprecated) instead of dropping them outright.
**Depends On**: None | **Blocks**: None

### Priority 6: `database-missing-app-pool-8` (score 45.5)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 45.5
**Location**: `mcp-servers/crypto_learning_db.py:94`
**Description**: _get_conn() creates a brand-new sqlite3 connection on every call and _init_db() re-runs the schema script each time; no connection pool or shared handle is used, so every MCP tool call pays connection setup plus DDL overhead and connections are never explicitly closed.
**Remediation**: Introduce a small connection pool or a module-level cached connection (with proper close on shutdown) and initialize the schema only once, so repeated tool calls reuse an already-prepared connection.
**Depends On**: None | **Blocks**: None

### Priority 7: `performance-no-connection-pool-7` (score 42)
**Module**: performance | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 42
**Location**: `mcp-servers/crypto_technical_analysis.py:88`
**Description**: safe_fetch_ohlcv_data iterates over every configured CCXT exchange and calls exchange.fetch_ohlcv sequentially, creating a fresh HTTP request per attempt with no shared session/connection pooling or keep-alive reuse. Each retry pays a new TCP + TLS handshake to the exchange, and the CoinGecko fallback uses bare requests.get() calls (lines 118, 145) which also open a new connection per call.
**Remediation**: Create a module-level requests.Session (or configure ccxt with a shared aiohttp/requests session) and reuse it for all exchange and CoinGecko calls so TCP/TLS connections are pooled and reused across retries and tool invocations.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 8: `security-secret-in-code-1` (score 42)
**Module**: github | **Severity**: critical | **Effort**: XS | **Confidence**: 0.6 | **Score**: 42
**Location**: `dashboard/server/pty-server.mjs`
**Description**: The PTY server spawns a real OS shell with the user's full privileges and passes the entire process environment (`env: { ...process.env, TERM: "xterm-256color" }`) into that shell. Any secrets present in the environment (API keys, tokens, cloud credentials) are inherited by the spawned shell and are reachable by anything that connects to the WebSocket, which has no authentication.
**Remediation**: Do not forward the full process.env to the spawned shell. Build an explicit minimal environment allowlist (PATH, HOME, SHELL, TERM) and require an authentication token on the WebSocket handshake before spawning any PTY.
**Depends On**: None | **Blocks**: None

### Priority 9: `structure-high-coupling-1` (score 38.5)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.7 | **Score**: 38.5
**Location**: `mcp-servers/crypto_technical_analysis.py:16`
**Description**: The technical-analysis MCP server hardcodes a module-level dict of live ccxt exchange clients (EXCHANGES = {'binance': ccxt.binance(), ...}) and a CoinGecko URL template, coupling the analysis logic directly to concrete external data providers. Every tool function reaches into this global, so the module cannot be tested or reused without real network clients and cannot swap providers without editing the module.
**Remediation**: Introduce a data-provider abstraction (e.g. an ExchangeClient protocol with a fetch_ohlcv method) and inject it into the tool functions, keeping the concrete ccxt/CoinGecko wiring in a single composition root.
**Depends On**: None | **Blocks**: None

### Priority 10: `code-missing-validation-4` (score 37.5)
**Module**: code | **Severity**: high | **Effort**: M | **Confidence**: 0.75 | **Score**: 37.5
**Location**: `dashboard/src/app/api/ohlcv/route.ts:11`
**Description**: The `symbol` query parameter is taken straight from the URL and passed to `getOhlcv`/`toBinanceSymbol` without any validation against an allowed symbol pattern, unlike the MCP servers which route symbols through `validate_symbol`. Arbitrary user-controlled strings are interpolated into the upstream Binance URL.
**Remediation**: Validate `symbol` with a strict allow-list regex (e.g. `/^[A-Za-z0-9]{1,15}$/`) before use and return HTTP 400 on mismatch, mirroring `validators.validate_symbol`.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 11: `structure-layer-violation-1` (score 35.75)
**Module**: structure | **Severity**: high | **Effort**: M | **Confidence**: 0.65 | **Score**: 35.75
**Location**: `dashboard/server/pty-server.mjs`
**Description**: The PTY server mixes transport concerns with process/OS concerns in a single module: it creates the WebSocketServer, performs loopback authorization, picks the platform shell, spawns the PTY, and manages its lifecycle all in one file. The WebSocket transport layer directly owns shell-spawning policy, so neither can be changed or tested independently.
**Remediation**: Separate the WebSocket transport (connection handling, message framing) from a PTY session manager that owns shell selection and process lifecycle, wiring them together in a small composition entrypoint.
**Depends On**: None | **Blocks**: None

### Priority 12: `security-gha-pr-target-risk-1` (score 35)
**Module**: github | **Severity**: critical | **Effort**: S | **Confidence**: 0.5 | **Score**: 35
**Location**: `CONTRIBUTING.md`
**Description**: CONTRIBUTING.md states there is no automated test suite and that the project relies on manual smoke testing, while also inviting pull requests that may add or modify MCP servers and hooks. Without any CI validation, untrusted contributions are merged based on manual review alone, and the executable hook/script surface is not automatically checked.
**Remediation**: Introduce a minimal CI workflow that runs the existing pytest suite (pyproject.toml already configures pytest) and lints shell/Python files on every PR, and require it to pass before merge.
**Depends On**: None | **Blocks**: None

### Priority 13: `security-gha-secret-leak-3` (score 35)
**Module**: github | **Severity**: critical | **Effort**: XS | **Confidence**: 0.5 | **Score**: 35
**Location**: `bin/autopilot.sh`
**Description**: The script redirects all stdout/stderr of the headless Claude run into data/logs/YYYY-MM-DD.log (`>> "$LOG_FILE" 2>&1`). Agent output and any error traces that include environment details or credentials echoed by tools are persisted to a plaintext log file in the repository working tree.
**Remediation**: Redact secrets from log output before writing, store logs outside the repo tree with restrictive permissions (chmod 600), and add data/logs to .gitignore (already present) plus a scrub step for known secret patterns.
**Depends On**: None | **Blocks**: None

### Priority 14: `database-missing-index-fk-1` (score 32.5)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.5 | **Score**: 32.5
**Location**: `mcp-servers/crypto_learning_db.py:150`
**Description**: The predictions table declares FOREIGN KEY (trade_id) REFERENCES trades(id) and the trade_modifications table declares FOREIGN KEY (trade_id) REFERENCES trades(id), but only idx_predictions_trade and idx_tm_trade exist; the parent side of the relationship (trades.id) has no index beyond the implicit PRIMARY KEY, and no index covers the FK lookups performed when validating/joining trades by id in the dashboard queries.
**Remediation**: Ensure every foreign-key column has a covering index (idx_predictions_trade and idx_tm_trade already do) and add an explicit index on trades(id) usage paths; verify with PRAGMA foreign_key_check and EXPLAIN QUERY PLAN that FK enforcement does not scan the child tables.
**Depends On**: None | **Blocks**: None

### Priority 15: `database-sequential-pagination-1` (score 32.5)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.5 | **Score**: 32.5
**Location**: `tests/test_crypto_learning_db.py:175`
**Description**: The trade query API is exercised with limit/offset pagination (db._query_trades(limit=2, offset=0)), which is the classic OFFSET-based pagination pattern; on a growing trades table each page re-scans and discards all preceding rows, and concurrent inserts shift page boundaries.
**Remediation**: Switch to keyset (cursor) pagination on an indexed, monotonic column such as (opened_at, id) — WHERE (opened_at, id) < (?, ?) ORDER BY opened_at DESC, id DESC LIMIT ? — instead of LIMIT/OFFSET.
**Depends On**: None | **Blocks**: None

### Priority 16: `cost-llm-very-high-usage-2` (score 28)
**Module**: cost | **Severity**: high | **Effort**: L | **Confidence**: 0.7 | **Score**: 28
**Location**: `bin/autopilot.sh:1`
**Description**: autopilot.sh is designed to be driven by crontab (documented examples run monitor hourly, quick daily, analyze weekly, portfolio on weekdays) and each invocation launches a headless `claude -p` session that itself delegates to multiple subagents. The hourly monitor alone spawns haiku+opus+sonnet agents on every run, producing continuous, unattended LLM spend with no cost ceiling or usage monitoring.
**Remediation**: Introduce a cost guard in autopilot.sh: track cumulative spend per day in data/logs, abort when a configurable budget is exceeded, and reduce the monitor cron frequency or batch symbols to cut redundant agent spawns.
**Depends On**: None | **Blocks**: None

### Priority 17: `security-cors-wildcard-2` (score 22.5)
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.75 | **Score**: 22.5
**Location**: `dashboard/server/pty-server.mjs:44`
**Description**: The WebSocket server accepts connections based on remote address only and performs no Origin header check. Any web page loaded in the user's browser can open a WebSocket to ws://127.0.0.1:3001 (loopback is reachable from the browser) and, because the server spawns a full-privilege shell with no authentication, achieve remote command execution on the developer's machine.
**Remediation**: Verify the `Origin` header in the connection handler and reject any origin that is not the dashboard's own origin; additionally require a per-session random token passed in the URL or first message before spawning the PTY.
**Depends On**: None | **Blocks**: None

### Priority 18: `security-gha-auto-deploy-prod-9` (score 21)
**Module**: github | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 21
**Location**: `bin/autopilot.sh:20`
**Description**: autopilot.sh is designed to be run unattended from cron and invokes `claude -p` with a broad pre-approved tool allowlist (Read,Write,Grep,Glob,WebSearch,WebFetch and seven mcp__crypto-* servers). Any workflow it runs can write files and call external services without human review, and the crontab examples show it running hourly/daily against the live project directory. There is no dry-run, no confirmation gate, and no restriction preventing it from mutating the portfolio DB or repository contents.
**Remediation**: Add a dry-run/confirmation mode for state-mutating workflows, restrict the allowed tools per workflow (read-only for monitor/quick/portfolio), and require an explicit opt-in flag before any workflow that writes to the database or filesystem runs unattended.
**Depends On**: None | **Blocks**: None

### Priority 19: `security-gha-overpermissive-2` (score 21)
**Module**: github | **Severity**: high | **Effort**: XS | **Confidence**: 0.6 | **Score**: 21
**Location**: `bin/autopilot.sh`
**Description**: ALLOWED_TOOLS grants the headless session Write, Grep, Glob, WebSearch, WebFetch plus every crypto MCP server, including crypto-learning-db which can create/close trades and modify portfolio state. This is broader than any single workflow needs (e.g. `quick` only reads market data) and violates least privilege for an unattended process.
**Remediation**: Define a per-workflow allowlist so read-only workflows (quick, portfolio, monitor price checks) get only Read and the market-data MCP servers, and reserve Write plus crypto-learning-db for workflows that legitimately mutate state.
**Depends On**: None | **Blocks**: None

### Priority 20: `security-missing-headers-10` (score 21)
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.7 | **Score**: 21
**Location**: `dashboard/next.config.ts:3`
**Description**: The Next.js configuration defines no `headers()` block, so the dashboard is served without security response headers such as Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Strict-Transport-Security. This leaves the app open to clickjacking, MIME sniffing, and XSS amplification.
**Remediation**: Add an async `headers()` entry in next.config.ts that sets Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, and Strict-Transport-Security for all routes.
**Depends On**: None | **Blocks**: None

### Priority 21: `cost-no-automated-tests-4` (score 20)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.5 | **Score**: 20
**Location**: `pyproject.toml:1`
**Description**: The project declares pytest and pytest-cov as dev dependencies and configures testpaths, but the provided repository content shows no test suite exercising the MCP servers, the dashboard DB layer, or the autopilot workflows. Without automated tests, regressions in the trading logic and data pipeline are only caught in production, driving up rework and maintenance cost.
**Remediation**: Add a pytest suite covering the MCP server helper functions (validators, serializers, DB schema) and a smoke test for the dashboard DB layer, and wire it into CI so regressions are caught before merge.
**Depends On**: None | **Blocks**: None

### Priority 22: `database-missing-index-where-4` (score 19.5)
**Module**: database | **Severity**: medium | **Effort**: S | **Confidence**: 0.75 | **Score**: 19.5
**Location**: `dashboard/src/lib/db.ts:150`
**Description**: getRecentClosedTradesForChart filters trades on status and closed_at (WHERE status = 'closed' AND closed_at IS NOT NULL AND closed_at >= ? ORDER BY closed_at DESC) but the schema mirror defines no index on trades(status) or trades(closed_at), forcing a full table scan on every chart render.
**Remediation**: Add CREATE INDEX idx_trades_status_closed_at ON trades(status, closed_at) to the schema in crypto_learning_db.py and the EMPTY_SCHEMA mirror so the chart query can use an index range scan.
**Depends On**: None | **Blocks**: None

### Priority 23: `database-connection-timeout-high-3` (score 18.2)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.7 | **Score**: 18.2
**Location**: `mcp-servers/crypto_learning_db.py:96`
**Description**: _get_conn() opens sqlite3.connect(str(DB_PATH)) with the default timeout of 5 seconds and no explicit busy timeout, so concurrent writers (MCP server plus the dashboard's better-sqlite3 connection on the same WAL database) will raise 'database is locked' under contention instead of waiting.
**Remediation**: Pass an explicit timeout to sqlite3.connect (e.g. sqlite3.connect(str(DB_PATH), timeout=30)) and/or execute PRAGMA busy_timeout=30000 so concurrent writers back off instead of failing immediately.
**Depends On**: None | **Blocks**: None

### Priority 24: `code-exact-duplication-significant-2` (score 18)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 18
**Location**: `mcp-servers/crypto_advanced_indicators.py:39`
**Description**: The `_json_native` serializer helper and its `_tool_serializer` wrapper are copy-pasted verbatim (including the same Spanish docstring) into at least three MCP servers: crypto_advanced_indicators.py, crypto_exchange_ccxt_ultra.py and crypto_market_microstructure.py. Any fix to the numpy serialization bug must be applied in every copy, and the copies will drift.
**Remediation**: Extract `_json_native`/`_tool_serializer` into the shared `validators.py` (or a new `serialization.py`) module and import it from each server, so the numpy-serialization fix lives in exactly one place.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 25: `github-log-pattern-6` (score 17.5)
**Module**: github | **Severity**: high | **Effort**: S | **Confidence**: 0.5 | **Score**: 17.5
**Location**: `bin/autopilot.sh`
**Description**: Log entries are appended to a single daily file shared by all workflows with no rotation, size cap, or retention, and the file is opened with default permissions. Logs grow unbounded and are world-readable depending on umask.
**Remediation**: Set restrictive permissions on the log directory (chmod 700) and add rotation/retention (logrotate or a size check that archives/truncates old logs).
**Depends On**: None | **Blocks**: None

### Priority 26: `database-heavy-migration-5` (score 16.9)
**Module**: database | **Severity**: medium | **Effort**: L | **Confidence**: 0.65 | **Score**: 16.9
**Location**: `mcp-servers/crypto_learning_db.py:182`
**Description**: _ensure_schema executes the full CREATE TABLE/CREATE INDEX script plus ALTER TABLE and DROP TABLE migrations synchronously on every connection initialization (_init_db is called at the start of each core function), adding repeated DDL work to every tool invocation.
**Remediation**: Run schema setup once per process (cache an initialized flag or check PRAGMA user_version) instead of re-executing the whole script on every _init_db() call.
**Depends On**: None | **Blocks**: None

### Priority 27: `structure-config-logic-8` (score 16.5)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 16.5
**Location**: `mcp-servers/crypto_learning_db.py:29`
**Description**: _discover_db_dir() embeds environment-dependent path-resolution policy (CRYPTO_DB_DIR, CLAUDE_PROJECT_DIR, walking up from PWD up to 6 levels, plugin-relative fallback) directly in the module and executes it at import time (DB_DIR = _discover_db_dir()). Configuration decisions are entangled with the server's runtime logic, making the DB location non-deterministic and untestable without mutating process env/PWD.
**Remediation**: Move the path-resolution policy into a dedicated config module that reads a validated settings object, and pass the resolved DB path explicitly into the connection factory instead of computing it at import time.
**Depends On**: None | **Blocks**: None

### Priority 28: `cost-dev-setup-missing-3` (score 16)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.4 | **Score**: 16
**Location**: `hooks/post-setup.sh:1`
**Description**: The session startup hook only creates data directories and explicitly defers dependency management to a separate /setup skill and `uv run`. There is no automated, verifiable dev-environment bootstrap (no lockfile check, no dependency install, no health check), so new contributors hit manual setup steps and wasted time.
**Remediation**: Provide a single documented bootstrap command (e.g. `uv sync` plus a setup script) that installs dependencies and verifies the environment, and reference it from the README and the post-setup hook.
**Depends On**: None | **Blocks**: None

### Priority 29: `performance-no-keep-alive-9` (score 15.6)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 15.6
**Location**: `mcp-servers/crypto_ultra_simple.py:24`
**Description**: Every CoinGecko tool (get_bitcoin_price, get_crypto_prices, get_coin_details, get_market_rankings, get_price_history, get_market_trends) issues a standalone requests.get() with no shared Session, so no HTTP keep-alive connection is reused between calls. Each tool invocation re-establishes a TCP+TLS connection to api.coingecko.com.
**Remediation**: Introduce a module-level requests.Session() and route all CoinGecko calls through it so connections are kept alive and reused across tool calls.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 30: `structure-repository-logic-4` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `dashboard/src/lib/db.ts:7`
**Description**: db.ts acts as the data-access layer but also contains domain/business logic: extractLiquidationPrice() computes a cross-margin liquidation approximation (entry × (1 ∓ (1/leverage − buffer))) and getSymbolStats() derives win-rate/avg-win/avg-loss aggregates. Repository modules should only map rows to entities; this decision logic belongs in a domain/service layer.
**Remediation**: Move extractLiquidationPrice and the derived statistics into a domain module (e.g. lib/domain/trade-metrics.ts) and keep db.ts limited to querying and row-to-entity mapping.
**Depends On**: None | **Blocks**: None

### Priority 31: `structure-service-sql-5` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `mcp-servers/crypto_learning_db.py:29`
**Description**: The MCP server layer mixes service/orchestration concerns with raw SQL: _ensure_schema() inlines the full DDL, migration statements, and seed inserts, while _record_trade() and the other tool functions build INSERT/SELECT statements inline. There is no repository/DAO boundary, so persistence details leak into the tool surface.
**Remediation**: Extract a TradeRepository/PortfolioRepository that owns all SQL and schema DDL, and have the MCP tool functions call repository methods so the service layer contains no SQL strings.
**Depends On**: None | **Blocks**: None

### Priority 32: `performance-no-retry-jitter-8` (score 14.4)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 14.4
**Location**: `mcp-servers/crypto_technical_analysis.py:88`
**Description**: The exchange fallback loop retries the next exchange immediately on failure with no backoff or jitter. When an upstream exchange is rate-limiting or degraded, all configured exchanges are hammered back-to-back in a tight loop, which can amplify throttling and lengthen the critical path of every indicator tool.
**Remediation**: Add exponential backoff with randomized jitter between exchange retry attempts (e.g. sleep(2**attempt + random.uniform(0, 0.5))) and cap the number of retries.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 33: `database-statement-timeout-missing-9` (score 14.3)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.55 | **Score**: 14.3
**Location**: `mcp-servers/crypto_learning_db.py:96`
**Description**: The SQLite connection is created without any statement-level timeout or progress handler, so a long-running query (e.g. an unindexed full-table aggregation over trades) can block the MCP server indefinitely with no upper bound.
**Remediation**: Set a bounded execution time via conn.set_progress_handler() or PRAGMA busy_timeout plus query-level LIMITs, and abort queries that exceed the budget so a single slow statement cannot hang the server.
**Depends On**: None | **Blocks**: None

### Priority 34: `structure-framework-leak-3` (score 14.3)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 14.3
**Location**: `dashboard/src/app/api/ohlcv/route.ts:2`
**Description**: The route handler leaks the underlying data-source framework into the HTTP layer: it imports the Interval type and getOhlcv directly from @/lib/ohlcv, so the Next.js route is coupled to the Binance-specific adapter rather than to an application service. Swapping the candle provider would require editing every route.
**Remediation**: Introduce an application service (e.g. getCandles(symbol, interval, limit)) that the route depends on, and keep the Binance adapter behind that service so routes never import provider modules directly.
**Depends On**: None | **Blocks**: None

### Priority 35: `code-copy-paste-variant-6` (score 14)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 14
**Location**: `dashboard/src/lib/market-intelligence.ts:41`
**Description**: `parseOutcomes` in market-intelligence.ts is a near-duplicate of `_parse_outcomes` in mcp-servers/crypto_polymarket.py: both defensively JSON-parse the `outcomes`/`outcomePrices` string-or-array fields, index prices by position and coerce to float. The two implementations will diverge on edge cases (e.g. missing price entries).
**Remediation**: Move the outcome-parsing logic into a single shared module (or a small npm package consumed by both the dashboard and the MCP server) so the Polymarket payload handling is defined once.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 36: `code-missing-error-main-10` (score 14)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 14
**Location**: `dashboard/server/pty-server.mjs:36`
**Description**: `new WebSocketServer({ host: HOST, port: PORT })` is created at module top level with no error handler; if the port is already in use the process throws an unhandled 'error' event and crashes without a clear diagnostic.
**Remediation**: Attach `wss.on('error', ...)` and wrap startup in a try/catch (or a `main()` with process-level handlers) that logs the failure and exits with a non-zero code.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 37: `performance-no-adaptive-timeout-6` (score 13.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 13.2
**Location**: `mcp-servers/crypto_defillama.py:36`
**Description**: DEFAULT_TIMEOUT is a single fixed 30s value applied to every DefiLlama endpoint, including the large /overview/dexs and historical TVL payloads. There is no adaptive or per-endpoint timeout, so a slow large-payload endpoint can block a tool call for the full 30 seconds while small endpoints get an unnecessarily long budget.
**Remediation**: Set per-endpoint timeouts (shorter for small responses like /v2/chains, longer for large ones) or implement an adaptive timeout that adjusts based on observed response times.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 38: `database-missing-bloat-monitoring-5` (score 13)
**Module**: database | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 13
**Location**: `mcp-servers/crypto_learning_db.py:96`
**Description**: The database is opened with PRAGMA journal_mode=WAL and PRAGMA foreign_keys=ON but no auto_vacuum, incremental_vacuum, or free-page monitoring; the trades/predictions/summaries tables grow unbounded with no bloat tracking or maintenance job.
**Remediation**: Enable PRAGMA auto_vacuum=INCREMENTAL (or schedule periodic VACUUM), and add a maintenance task that reports freelist_count/page_count so table and index bloat is visible before it degrades query performance.
**Depends On**: None | **Blocks**: None

### Priority 39: `structure-low-cohesion-5` (score 12.1)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 12.1
**Location**: `mcp-servers/validators.py`
**Description**: validators.py groups unrelated validation concerns — symbol/coin-id regex validation, exchange allow-list checking, positive-integer bounds, and timeframe validation — into one module with no shared abstraction beyond 'validation'. Callers must import the whole grab-bag to use any single validator.
**Remediation**: Split the validators into cohesive modules by domain (symbols, exchanges, numeric bounds, timeframes) or expose them through a small Validator interface so each concern can evolve independently.
**Depends On**: None | **Blocks**: None

### Priority 40: `code-ignores-return-value-6` (score 12)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 12
**Location**: `mcp-servers/crypto_learning_db.py:150`
**Description**: `conn.execute("PRAGMA journal_mode=WAL")` and `conn.execute("PRAGMA foreign_keys=ON")` in `_get_conn` discard the returned cursor, so a failure to enable WAL or foreign-key enforcement (which silently degrades durability and referential integrity) is never detected.
**Remediation**: Capture and check the PRAGMA result, e.g. `row = conn.execute("PRAGMA journal_mode=WAL").fetchone()` and assert the mode is 'wal', logging a warning if the pragma did not take effect.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 41: `performance-no-request-collapsing-4` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `dashboard/src/components/price-chart.tsx:110`
**Description**: The price polling effect fires a fetch to /api/price every 30 seconds per mounted PriceChart instance, and the candle-fetch effect issues separate /api/ohlcv and /api/price requests on every symbol/timeframe change. Concurrent components or rapid symbol switching produce duplicate in-flight requests to the same endpoints with no collapsing/deduplication.
**Remediation**: Deduplicate concurrent requests to /api/price and /api/ohlcv (e.g. a shared in-flight promise map keyed by symbol+interval, or SWR/React Query with a shared cache) so simultaneous callers share one network request.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 42: `security-gha-action-unpinned-5` (score 9.8)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 9.8
**Location**: `skills/setup/SKILL.md:26`
**Description**: The setup skill instructs the agent to install uv by piping a remote install script directly into a shell (`curl -LsSf https://astral.sh/uv/install.sh | sh`), and the Windows variant does the same with `irm ... | iex`. The script is fetched from a mutable URL with no version pin or checksum verification, so a compromised or changed upstream script executes arbitrary code with the user's privileges.
**Remediation**: Pin the installer to a specific released version and verify a published checksum before executing, e.g. download the versioned script to a temp file, validate its SHA-256 against the known digest, then run it. Alternatively install uv via a package manager (brew/apt/pipx) with a pinned version.
**Depends On**: None | **Blocks**: None

### Priority 43: `cost-api-no-response-cache-5` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `dashboard/src/app/api/ohlcv/route.ts:6`
**Description**: The OHLCV route is marked `export const dynamic = "force-dynamic"`, which disables Next.js route caching entirely, so every client request re-executes the upstream Binance fetch path even though the underlying candle data only changes per interval. This multiplies upstream API calls and compute cost unnecessarily.
**Remediation**: Remove force-dynamic or add an explicit revalidate window (e.g. `export const revalidate = 60`) so identical OHLCV requests are served from cache instead of hitting the upstream API on every call.
**Depends On**: None | **Blocks**: None

### Priority 44: `cost-llm-high-usage-1` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `skills/analyze/SKILL.md:1`
**Description**: The /analyze workflow spawns 5 subagents per invocation, including two opus-tier agents (portfolio-manager and learning-agent) plus three sonnet/haiku agents, each with multi-turn MCP tool access. Every analysis run therefore consumes a large, unbounded amount of LLM tokens with no per-run budget, no caching of agent outputs, and no cap on how often the workflow is triggered.
**Remediation**: Add a token/run budget guard to the /analyze workflow: cache Phase 1 report files and reuse them within a time window instead of re-spawning agents, downgrade non-decision agents where possible, and document a maximum number of full analyses per day.
**Depends On**: None | **Blocks**: None

### Priority 45: `performance-no-compression-13` (score 9.6)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 9.6
**Location**: `dashboard/next.config.ts:3`
**Description**: next.config.ts defines only serverExternalPackages and enables no compression configuration. The dashboard serves large JSON payloads (OHLCV candle arrays, market-intelligence snapshots) and Next.js response compression is not explicitly enabled/configured, so responses may be sent uncompressed.
**Remediation**: Enable response compression (Next.js `compress: true` is default but verify it is not disabled, and/or add gzip/brotli at the reverse proxy) so large JSON API payloads are compressed on the wire.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 46: `security-gha-job-no-timeout-7` (score 9.1)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 9.1
**Location**: `bin/autopilot.sh`
**Description**: The headless `claude -p` invocation in autopilot.sh has no timeout or watchdog. If the model call or an MCP server hangs (e.g. a slow exchange API), the cron job blocks indefinitely, overlapping with the next scheduled run and potentially accumulating concurrent headless sessions against the same SQLite DB.
**Remediation**: Wrap the `claude -p` call in `timeout 600` (or a configurable limit), and add a lockfile (flock) so overlapping cron invocations cannot run concurrently.
**Depends On**: None | **Blocks**: None

### Priority 47: `cost-no-performance-budget-10` (score 8.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 8.8
**Location**: `bin/autopilot.sh:1`
**Description**: The autopilot runs unattended via cron with no performance or cost budget defined anywhere: no maximum runtime, no token/spend ceiling, and no alerting when a run exceeds expectations. A runaway or looping headless session would consume resources indefinitely without detection.
**Remediation**: Define explicit budgets for each workflow (max wall-clock time and max token spend), enforce them with `timeout` around the claude invocation, and log/alert when a run exceeds the budget.
**Depends On**: None | **Blocks**: None

### Priority 48: `security-gha-no-concurrency-prod-10` (score 8.4)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 8.4
**Location**: `bin/autopilot.sh`
**Description**: The crontab examples schedule monitor/quick/analyze/portfolio jobs at overlapping times (hourly monitor plus daily quick/analyze/portfolio) with no concurrency guard. Multiple headless Claude sessions can run simultaneously against the same project directory and SQLite learning.db, risking interleaved writes and duplicate trade closes.
**Remediation**: Serialize autopilot runs with a lock (flock on a lockfile) or a queue, and stagger the cron schedules so no two workflows overlap.
**Depends On**: None | **Blocks**: None

### Priority 49: `cost-api-no-client-rate-limit-4` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `dashboard/src/lib/ohlcv.ts:41`
**Description**: The server-side fetchers call Binance's public klines and ticker endpoints with no client-side rate limiting, request collapsing, or backoff. Under concurrent dashboard usage or aggressive polling, these calls can exceed Binance rate limits, triggering throttling or IP bans that break the dashboard and force costly retries.
**Remediation**: Add a shared rate limiter / request-collapsing layer (e.g. a token-bucket or in-flight dedupe) around the Binance fetchers and honor 429 responses with exponential backoff.
**Depends On**: None | **Blocks**: None

### Priority 50: `cost-api-no-usage-monitoring-9` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `dashboard/src/lib/ohlcv.ts:41`
**Description**: There is no monitoring or accounting of upstream API usage across the dashboard fetchers or the MCP servers. Without tracking call volume, error rates, or per-endpoint consumption, quota exhaustion and cost spikes from the public APIs go undetected until they cause outages.
**Remediation**: Add lightweight usage counters/metrics for each upstream API (calls, errors, latency) and emit them to logs or a metrics endpoint so quota and cost trends are observable.
**Depends On**: None | **Blocks**: None

### Priority 51: `github-log-pattern-5` (score 7.7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 7.7
**Location**: `bin/autopilot.sh`
**Description**: The autopilot script captures the exit code of the `claude -p` call into EXIT_CODE but the `set -euo pipefail` at the top means a non-zero exit from the command aborts the script before the 'Finished' log line and the `exit $EXIT_CODE` are reached, so failed runs are not logged as finished.
**Remediation**: Temporarily disable errexit around the claude invocation (e.g. `set +e` ... `set -e`) or use `if ! claude ...; then EXIT_CODE=$?; fi` so the completion line and exit code are always recorded.
**Depends On**: None | **Blocks**: None

### Priority 52: `security-gha-workspace-not-cleaned-6` (score 7.7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 7.7
**Location**: `bin/autopilot.sh`
**Description**: Each autopilot run appends full model output to data/logs/YYYY-MM-DD.log and leaves behind generated report files under data/reports/ with no rotation or cleanup. Over time this accumulates unbounded on-disk artifacts (including any sensitive portfolio data the agents emit) that are never pruned.
**Remediation**: Add log rotation (logrotate or a size-based truncation in the script) and a retention policy that prunes data/reports and data/logs older than N days.
**Depends On**: None | **Blocks**: None

### Priority 53: `cost-api-no-retry-strategy-8` (score 7.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 7.2
**Location**: `dashboard/src/lib/market-intelligence.ts:22`
**Description**: The market-intelligence fetchers return null on any failure with no retry or backoff strategy. Transient upstream errors (Polymarket, DefiLlama, stablecoins) silently degrade the panel, and any future retry logic added ad hoc would amplify load without jitter, increasing both failure and cost risk.
**Remediation**: Implement a bounded retry with exponential backoff and jitter for the fetchJson helper, and surface degraded state to the UI instead of silently returning null.
**Depends On**: None | **Blocks**: None

### Priority 54: `cost-no-http-compression-9` (score 7.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 7.2
**Location**: `dashboard/next.config.ts:3`
**Description**: The Next.js config only sets serverExternalPackages and enables no compression or response optimization. The dashboard serves OHLCV candle arrays, market-intelligence snapshots and trade lists over the API routes without compression, inflating bandwidth and egress cost for every client poll.
**Remediation**: Enable compression in next.config.ts (or via the hosting layer) and ensure API responses for large payloads such as OHLCV candles are gzip/brotli encoded.
**Depends On**: None | **Blocks**: None

### Priority 55: `github-issue-health-1` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `CONTRIBUTING.md`
**Description**: CONTRIBUTING.md defines bug and feature issue templates only as prose instructions ('Open a GitHub issue with the following information') rather than as structured issue templates. There are no .github/ISSUE_TEMPLATE files, so reports arrive unstructured and are hard to triage.
**Remediation**: Add .github/ISSUE_TEMPLATE/bug_report.yml and feature_request.yml with the fields described in CONTRIBUTING.md so issues are consistently structured and auto-labeled.
**Depends On**: None | **Blocks**: None

### Priority 56: `github-log-pattern-2` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `dashboard/server/pty-server.mjs`
**Description**: The PTY server logs lifecycle events with `console.log`/`console.warn` and interpolated strings (e.g. `[pty-server] spawned PID ${pty.pid}`) with no log level or structured format, and it logs the remote address of rejected connections. This is inconsistent with the project's own CONTRIBUTING.md rule to use the logging module and avoid ad-hoc output.
**Remediation**: Adopt a leveled logger (pino/winston) with structured fields (event, pid, remote) and consistent severity levels instead of raw console calls.
**Depends On**: None | **Blocks**: None

### Priority 57: `github-log-pattern-4` (score 7)
**Module**: github | **Severity**: medium | **Effort**: S | **Confidence**: 0.5 | **Score**: 7
**Location**: `hooks/post-setup.sh`
**Description**: The SessionStart hook suppresses all errors with `2>/dev/null || true` and produces no log output at all. If directory creation fails (e.g. permissions), the failure is completely silent and later MCP/agent operations fail with confusing downstream errors.
**Remediation**: Log hook failures to a known location (e.g. data/logs/hook.log) with a timestamp and the failing path, while still exiting 0 so the session is not blocked.
**Depends On**: None | **Blocks**: None

### Priority 58: `github-log-pattern-9` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `mcp-servers/crypto_learning_db.py`
**Description**: The DB path discovery walks up to six parent directories from PWD looking for an existing data/db/learning.db and silently falls back to the plugin-local path. The chosen DB location is never logged, so when trades appear to vanish users cannot tell which database file the server actually opened.
**Remediation**: Log the resolved DB_PATH (and which discovery branch was taken) once at server startup so the active database is always identifiable.
**Depends On**: None | **Blocks**: None

### Priority 59: `security-gha-fork-pr-4` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `CONTRIBUTING.md`
**Description**: The contribution workflow instructs contributors to fork the repository and open pull requests against main, and the project ships a SessionStart hook (hooks/hooks.json -> hooks/post-setup.sh) that executes a shell script on session start. A PR that modifies hooks/post-setup.sh would execute attacker-controlled shell code for any maintainer who checks out and opens the branch, with no CI gate shown to review it.
**Remediation**: Add a CI check that flags changes to hooks/ and other executable scripts for mandatory human review, and document that maintainers should review hook changes before running Claude Code on an untrusted branch.
**Depends On**: None | **Blocks**: None

### Priority 60: `cost-documentation-poor-7` (score 6.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 6.4
**Location**: `mcp-servers.plugin.json:38`
**Description**: The MCP server manifest documents configuration only via an inline `_comment` string inside the env block, and the DB path discovery logic in crypto_learning_db.py is non-obvious. Poor operational documentation of how the DB location and servers are wired increases onboarding and maintenance cost for contributors.
**Remediation**: Move the configuration explanation out of the JSON env block into README/docs, documenting CRYPTO_DB_DIR, the DB discovery order, and how each MCP server is launched.
**Depends On**: None | **Blocks**: None

### Priority 61: `cost-no-license-tracking-5` (score 6.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 6.4
**Location**: `pyproject.toml:1`
**Description**: The project declares an MIT license and pulls in third-party dependencies (fastmcp, ccxt, numpy, pandas, requests) but there is no automated license inventory or compliance check in the repository, so incompatible or changed licenses in transitive dependencies would go unnoticed.
**Remediation**: Add an automated license scan (e.g. pip-licenses or a CI license-check step) that inventories dependency licenses and fails the build on disallowed licenses.
**Depends On**: None | **Blocks**: None

### Priority 62: `cost-slow-tests-2` (score 6.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 6.4
**Location**: `pyproject.toml:1`
**Description**: The pytest configuration uses `addopts = "-v --tb=short"` with no parallelism (e.g. pytest-xdist) and no test selection markers, so any future suite that touches network-backed MCP servers or SQLite will run serially and slowly, increasing developer iteration cost.
**Remediation**: Add pytest-xdist for parallel execution and mark network/integration tests so the fast unit subset can be run during development.
**Depends On**: None | **Blocks**: None

### Priority 63: `github-commit-history-1` (score 6.3)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 6.3
**Location**: `CONTRIBUTING.md`
**Description**: CONTRIBUTING.md asks contributors to 'Commit with a clear message describing the change' but defines no commit message convention (no Conventional Commits, no scope/type rules), so history quality depends entirely on individual discipline.
**Remediation**: Adopt and document a commit message convention (e.g. Conventional Commits) in CONTRIBUTING.md and enforce it with a commit-msg hook or CI check.
**Depends On**: None | **Blocks**: None

### Priority 64: `code-missing-return-type-8` (score 4)
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.8 | **Score**: 4
**Location**: `mcp-servers/crypto_advanced_indicators.py:39`
**Description**: `_json_native(obj)` and `_tool_serializer(result)` are declared without parameter or return type annotations, unlike the rest of the module which annotates tool signatures. The same untyped helpers appear in crypto_exchange_ccxt_ultra.py and crypto_market_security.py.
**Remediation**: Annotate the helpers, e.g. `def _json_native(obj: Any) -> Any:` and `def _tool_serializer(result: Any) -> str:`, to keep the module consistently typed.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 65: `database-max-lifetime-missing-5` (score 3.9)
**Module**: database | **Severity**: low | **Effort**: XS | **Confidence**: 0.6 | **Score**: 3.9
**Location**: `dashboard/src/lib/db.ts:68`
**Description**: getDb() caches a single better-sqlite3 connection in the module-level _db variable for the lifetime of the process with no max-lifetime or re-open policy; if the underlying learning.db file is replaced (e.g. by bin/sync-plugin-db.sh copying a new DB over it) the cached handle keeps serving the stale file.
**Remediation**: Track the DB file mtime/inode and re-open the connection when it changes, or add a max-lifetime after which the cached handle is closed and recreated, so external DB syncs are picked up.
**Depends On**: None | **Blocks**: None

### Priority 66: `structure-adapter-violation-10` (score 3.3)
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3.3
**Location**: `dashboard/src/lib/ohlcv.ts`
**Description**: ohlcv.ts is the adapter to the Binance klines/ticker API, but it also embeds domain transformation logic: toBinanceSymbol() applies quote-currency inference rules and the response mapping performs numeric coercion and unit conversion (ms→s). The adapter is doing more than translating the external protocol into the internal model.
**Remediation**: Split the module into a thin Binance HTTP adapter that returns raw payloads and a mapper that converts them into the Candle domain type, so symbol-normalization rules live in one place.
**Depends On**: None | **Blocks**: None

### Priority 67: `structure-dto-logic-7` (score 3.3)
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3.3
**Location**: `dashboard/src/lib/market-intelligence.ts`
**Description**: The GammaMarket/Chain/DexOverview DTO types carry behavior: parseOutcomes() and classifyFlow() implement parsing and classification rules (STRONG_INFLOW/OUTFLOW thresholds) that are business logic attached to transport shapes, and getDefiFlowSnapshot() computes the 7-day TVL change inline from raw history points.
**Remediation**: Keep the DTO types as pure data shapes and move parseOutcomes/classifyFlow and the TVL-change computation into a dedicated domain module that consumes the DTOs.
**Depends On**: None | **Blocks**: None

### Priority 68: `code-missing-docstring-10` (score 3)
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3
**Location**: `tests/helpers.py:4`
**Description**: `call_tool` is defined identically in both tests/helpers.py and tests/conftest.py; the helpers.py copy is a duplicate utility module whose presence invites divergence between the two definitions.
**Remediation**: Keep a single definition (in conftest.py or helpers.py) and import it from the other location so tests cannot drift between two copies of `call_tool`.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 69: `code-print-statement-5` (score 2.75)
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.55 | **Score**: 2.75
**Location**: `dashboard/server/pty-server.mjs:45`
**Description**: The PTY server uses raw `console.log`/`console.warn` calls throughout (listening banner, spawned PID, rejected connections, resize failures) instead of a structured logger, making it hard to filter or route these operational logs.
**Remediation**: Introduce a small logger (e.g. pino or a leveled wrapper) and replace the console calls with `logger.info`/`logger.warn` so log levels and destinations are configurable.
**Depends On**: `database-irreversible-migration-1` | **Blocks**: None

### Priority 70: `github-log-pattern-8` (score 0.39)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.55 | **Score**: 0.39
**Location**: `mcp-servers/crypto_learning_db.py`
**Description**: The learning DB server performs schema migrations by executing ALTER/DROP statements inside a loop that swallows `sqlite3.OperationalError` with a bare `pass` and no logging. A migration that fails for an unexpected reason (not 'already exists') is silently ignored, leaving the schema in an unknown state with no diagnostic trail.
**Remediation**: Log the swallowed exception at debug/info level and only suppress the specific 'duplicate column'/'no such table' errors; re-raise or log at warning level for any other OperationalError.
**Depends On**: None | **Blocks**: None

### Priority 71: `github-log-pattern-1` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `bin/autopilot.sh`
**Description**: Autopilot logging uses ad-hoc `echo "[$TIMESTAMP] ..." >> "$LOG_FILE"` lines with a hand-rolled timestamp format and no log level, request id, or structured fields. This makes the logs hard to parse or correlate across the multiple workflows that write to the same daily file.
**Remediation**: Emit structured, leveled log lines (e.g. JSON with timestamp, workflow, level, message) or use a small logging helper, and include a run id so concurrent workflow entries can be correlated.
**Depends On**: None | **Blocks**: None

### Priority 72: `github-log-pattern-10` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `dashboard/src/lib/db.ts`
**Description**: The dashboard DB layer silently substitutes an in-memory empty database when learning.db is missing (`createEmptyDb()`), with no log or user-visible warning beyond the isDbInitialized helper. Operators may believe they are viewing real data when the dashboard is actually rendering a synthetic zero-state.
**Remediation**: Log a clear warning when falling back to the in-memory DB and surface a visible banner in the UI indicating that no real database was found.
**Depends On**: None | **Blocks**: None

### Priority 73: `github-issue-health-2` (score 0.32)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.45 | **Score**: 0.32
**Location**: `CONTRIBUTING.md`
**Description**: CONTRIBUTING.md references labels (`enhancement`, `question`) and a PR workflow but the repository provides no pull request template and no documented triage/labeling process, so contributions lack a consistent review checklist.
**Remediation**: Add a .github/pull_request_template.md mirroring the PR guidelines (focused PR, CLAUDE.md/docs updates, example output for new MCP tools) and document the label taxonomy.
**Depends On**: None | **Blocks**: None

### Priority 74: `github-log-pattern-3` (score 0.32)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.45 | **Score**: 0.32
**Location**: `bin/sync-plugin-db.sh`
**Description**: sync-plugin-db.sh reports status via plain `echo` lines prefixed with `[sync-plugin-db]` and no severity level, and it silently swallows failures in the mtime helper (`2>/dev/null || ...`). Operational failures during a DB sync are therefore not distinguishable from normal output.
**Remediation**: Add explicit error handling and leveled output (e.g. write errors to stderr with an ERROR prefix and exit non-zero on failure) so sync problems are visible in logs.
**Depends On**: None | **Blocks**: None

### Priority 75: `github-log-pattern-7` (score 0.32)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.45 | **Score**: 0.32
**Location**: `dashboard/server/pty-server.mjs`
**Description**: The PTY server logs the full shell command and project root at startup and logs every spawned PID and websocket close, but never logs the outcome of the shell session or any error context beyond `e.message`. There is no correlation id tying a browser session to its PTY, making incident investigation difficult.
**Remediation**: Assign a session id per connection, include it in every log line for that session, and log session start/end with exit codes so a session can be reconstructed from logs.
**Depends On**: None | **Blocks**: None

### Priority 76: `github-commit-history-2` (score 0.28)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.4 | **Score**: 0.28
**Location**: `CONTRIBUTING.md`
**Description**: The documented workflow has contributors branch from main and open PRs, but there is no documented branch protection, required review, or merge strategy (squash vs merge). This makes commit history and review guarantees dependent on repository settings that are not described anywhere in the repo.
**Remediation**: Document the required branch protection rules (required reviews, status checks) and the merge strategy in CONTRIBUTING.md, and enable them in the repository settings.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `database-irreversible-migration-1`: Gate migrations behind PRAGMA user_version, take a file-level backup (or VACUUM INTO) before applying destructive steps, and provide a documented rollback path for each migration. (L)
- `database-full-table-scan-3`: Store symbol in a normalized (already-uppercased) column and compare with a plain equality predicate, then add an index on that column so the aggregation can use an index scan instead of a full… (M)
- `code-bare-except-1`: Bind the error (`catch (err)`) and log it (e.g. (XS)
- `security-no-input-validation-14`: Validate `symbol` against the same allow-list used elsewhere (e.g. (M)
- `database-risky-migration-3`: Move destructive DDL out of the startup path into a versioned, one-time migration guarded by PRAGMA user_version, and archive the dropped tables (rename to *_deprecated) instead of dropping them… (M)
- `database-missing-app-pool-8`: Introduce a small connection pool or a module-level cached connection (with proper close on shutdown) and initialize the schema only once, so repeated tool calls reuse an already-prepared connection. (M)
- `performance-no-connection-pool-7`: Create a module-level requests.Session (or configure ccxt with a shared aiohttp/requests session) and reuse it for all exchange and CoinGecko calls so TCP/TLS connections are pooled and reused… (M)
- `security-secret-in-code-1`: Do not forward the full process.env to the spawned shell. (XS)
- `structure-high-coupling-1`: Introduce a data-provider abstraction (e.g. (L)
- `code-missing-validation-4`: Validate `symbol` with a strict allow-list regex (e.g. (M)
- `structure-layer-violation-1`: Separate the WebSocket transport (connection handling, message framing) from a PTY session manager that owns shell selection and process lifecycle, wiring them together in a small composition… (M)
- `security-gha-pr-target-risk-1`: Introduce a minimal CI workflow that runs the existing pytest suite (pyproject.toml already configures pytest) and lints shell/Python files on every PR, and require it to pass before merge. (S)
- `security-gha-secret-leak-3`: Redact secrets from log output before writing, store logs outside the repo tree with restrictive permissions (chmod 600), and add data/logs to .gitignore (already present) plus a scrub step for… (XS)
- `database-missing-index-fk-1`: Ensure every foreign-key column has a covering index (idx_predictions_trade and idx_tm_trade already do) and add an explicit index on trades(id) usage paths; verify with PRAGMA foreign_key_check and… (S)
- `database-sequential-pagination-1`: Switch to keyset (cursor) pagination on an indexed, monotonic column such as (opened_at, id) — WHERE (opened_at, id) < (?, ?) ORDER BY opened_at DESC, id DESC LIMIT ? (S)
- `cost-llm-very-high-usage-2`: Introduce a cost guard in autopilot.sh: track cumulative spend per day in data/logs, abort when a configurable budget is exceeded, and reduce the monitor cron frequency or batch symbols to cut… (L)
- `security-cors-wildcard-2`: Verify the `Origin` header in the connection handler and reject any origin that is not the dashboard's own origin; additionally require a per-session random token passed in the URL or first message… (XS)
- `security-gha-auto-deploy-prod-9`: Add a dry-run/confirmation mode for state-mutating workflows, restrict the allowed tools per workflow (read-only for monitor/quick/portfolio), and require an explicit opt-in flag before any workflow… (M)
- `security-gha-overpermissive-2`: Define a per-workflow allowlist so read-only workflows (quick, portfolio, monitor price checks) get only Read and the market-data MCP servers, and reserve Write plus crypto-learning-db for workflows… (XS)
- `security-missing-headers-10`: Add an async `headers()` entry in next.config.ts that sets Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, and… (S)
- `cost-no-automated-tests-4`: Add a pytest suite covering the MCP server helper functions (validators, serializers, DB schema) and a smoke test for the dashboard DB layer, and wire it into CI so regressions are caught before… (M)
- `database-missing-index-where-4`: Add CREATE INDEX idx_trades_status_closed_at ON trades(status, closed_at) to the schema in crypto_learning_db.py and the EMPTY_SCHEMA mirror so the chart query can use an index range scan. (S)
- `database-connection-timeout-high-3`: Pass an explicit timeout to sqlite3.connect (e.g. (XS)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `code-exact-duplication-significant-2`: Extract `_json_native`/`_tool_serializer` into the shared `validators.py` (or a new `serialization.py`) module and import it from each server, so the numpy-serialization fix lives in exactly one… (M)
- `github-log-pattern-6`: Set restrictive permissions on the log directory (chmod 700) and add rotation/retention (logrotate or a size check that archives/truncates old logs). (S)
- `database-heavy-migration-5`: Run schema setup once per process (cache an initialized flag or check PRAGMA user_version) instead of re-executing the whole script on every _init_db() call. (L)
- `structure-config-logic-8`: Move the path-resolution policy into a dedicated config module that reads a validated settings object, and pass the resolved DB path explicitly into the connection factory instead of computing it at… (M)
- `cost-dev-setup-missing-3`: Provide a single documented bootstrap command (e.g. (M)
- `performance-no-keep-alive-9`: Introduce a module-level requests.Session() and route all CoinGecko calls through it so connections are kept alive and reused across tool calls. (M)
- `structure-repository-logic-4`: Move extractLiquidationPrice and the derived statistics into a domain module (e.g. (M)
- `structure-service-sql-5`: Extract a TradeRepository/PortfolioRepository that owns all SQL and schema DDL, and have the MCP tool functions call repository methods so the service layer contains no SQL strings. (M)
- `performance-no-retry-jitter-8`: Add exponential backoff with randomized jitter between exchange retry attempts (e.g. (M)
- `database-statement-timeout-missing-9`: Set a bounded execution time via conn.set_progress_handler() or PRAGMA busy_timeout plus query-level LIMITs, and abort queries that exceed the budget so a single slow statement cannot hang the server. (XS)
- `structure-framework-leak-3`: Introduce an application service (e.g. (M)
- `code-copy-paste-variant-6`: Move the outcome-parsing logic into a single shared module (or a small npm package consumed by both the dashboard and the MCP server) so the Polymarket payload handling is defined once. (M)
- `code-missing-error-main-10`: Attach `wss.on('error', ...)` and wrap startup in a try/catch (or a `main()` with process-level handlers) that logs the failure and exits with a non-zero code. (M)
- `performance-no-adaptive-timeout-6`: Set per-endpoint timeouts (shorter for small responses like /v2/chains, longer for large ones) or implement an adaptive timeout that adjusts based on observed response times. (M)
- `database-missing-bloat-monitoring-5`: Enable PRAGMA auto_vacuum=INCREMENTAL (or schedule periodic VACUUM), and add a maintenance task that reports freelist_count/page_count so table and index bloat is visible before it degrades query… (M)
- `structure-low-cohesion-5`: Split the validators into cohesive modules by domain (symbols, exchanges, numeric bounds, timeframes) or expose them through a small Validator interface so each concern can evolve independently. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `code-ignores-return-value-6`: Capture and check the PRAGMA result, e.g. (M)
- `performance-no-request-collapsing-4`: Deduplicate concurrent requests to /api/price and /api/ohlcv (e.g. (M)
- `security-gha-action-unpinned-5`: Pin the installer to a specific released version and verify a published checksum before executing, e.g. (M)
- `performance-no-compression-13`: Enable response compression (Next.js `compress: true` is default but verify it is not disabled, and/or add gzip/brotli at the reverse proxy) so large JSON API payloads are compressed on the wire. (M)
- `cost-api-no-response-cache-5`: Remove force-dynamic or add an explicit revalidate window (e.g. (M)
- `cost-llm-high-usage-1`: Add a token/run budget guard to the /analyze workflow: cache Phase 1 report files and reuse them within a time window instead of re-spawning agents, downgrade non-decision agents where possible, and… (M)
- `security-gha-job-no-timeout-7`: Wrap the `claude -p` call in `timeout 600` (or a configurable limit), and add a lockfile (flock) so overlapping cron invocations cannot run concurrently. (M)
- `cost-no-performance-budget-10`: Define explicit budgets for each workflow (max wall-clock time and max token spend), enforce them with `timeout` around the claude invocation, and log/alert when a run exceeds the budget. (M)
- `security-gha-no-concurrency-prod-10`: Serialize autopilot runs with a lock (flock on a lockfile) or a queue, and stagger the cron schedules so no two workflows overlap. (M)
- `cost-api-no-client-rate-limit-4`: Add a shared rate limiter / request-collapsing layer (e.g. (M)
- `cost-api-no-usage-monitoring-9`: Add lightweight usage counters/metrics for each upstream API (calls, errors, latency) and emit them to logs or a metrics endpoint so quota and cost trends are observable. (M)
- `github-log-pattern-5`: Temporarily disable errexit around the claude invocation (e.g. (M)
- `security-gha-workspace-not-cleaned-6`: Add log rotation (logrotate or a size-based truncation in the script) and a retention policy that prunes data/reports and data/logs older than N days. (M)
- `cost-api-no-retry-strategy-8`: Implement a bounded retry with exponential backoff and jitter for the fetchJson helper, and surface degraded state to the UI instead of silently returning null. (M)
- `cost-no-http-compression-9`: Enable compression in next.config.ts (or via the hosting layer) and ensure API responses for large payloads such as OHLCV candles are gzip/brotli encoded. (M)
- `github-issue-health-1`: Add .github/ISSUE_TEMPLATE/bug_report.yml and feature_request.yml with the fields described in CONTRIBUTING.md so issues are consistently structured and auto-labeled. (M)
- `github-log-pattern-2`: Adopt a leveled logger (pino/winston) with structured fields (event, pid, remote) and consistent severity levels instead of raw console calls. (M)
- `github-log-pattern-4`: Log hook failures to a known location (e.g. (S)
- `github-log-pattern-9`: Log the resolved DB_PATH (and which discovery branch was taken) once at server startup so the active database is always identifiable. (M)
- `security-gha-fork-pr-4`: Add a CI check that flags changes to hooks/ and other executable scripts for mandatory human review, and document that maintainers should review hook changes before running Claude Code on an… (M)
- `cost-documentation-poor-7`: Move the configuration explanation out of the JSON env block into README/docs, documenting CRYPTO_DB_DIR, the DB discovery order, and how each MCP server is launched. (M)
- `cost-no-license-tracking-5`: Add an automated license scan (e.g. (M)
- `cost-slow-tests-2`: Add pytest-xdist for parallel execution and mark network/integration tests so the fast unit subset can be run during development. (M)
- `github-commit-history-1`: Adopt and document a commit message convention (e.g. (M)
- `code-missing-return-type-8`: Annotate the helpers, e.g. (S)
- `database-max-lifetime-missing-5`: Track the DB file mtime/inode and re-open the connection when it changes, or add a max-lifetime after which the cached handle is closed and recreated, so external DB syncs are picked up. (XS)
- `structure-adapter-violation-10`: Split the module into a thin Binance HTTP adapter that returns raw payloads and a mapper that converts them into the Candle domain type, so symbol-normalization rules live in one place. (S)
- `structure-dto-logic-7`: Keep the DTO types as pure data shapes and move parseOutcomes/classifyFlow and the TVL-change computation into a dedicated domain module that consumes the DTOs. (S)
- `code-missing-docstring-10`: Keep a single definition (in conftest.py or helpers.py) and import it from the other location so tests cannot drift between two copies of `call_tool`. (S)
- `code-print-statement-5`: Introduce a small logger (e.g. (S)
- `github-log-pattern-8`: Log the swallowed exception at debug/info level and only suppress the specific 'duplicate column'/'no such table' errors; re-raise or log at warning level for any other OperationalError. (XS)
- `github-log-pattern-1`: Emit structured, leveled log lines (e.g. (XS)
- `github-log-pattern-10`: Log a clear warning when falling back to the in-memory DB and surface a visible banner in the UI indicating that no real database was found. (XS)
- `github-issue-health-2`: Add a .github/pull_request_template.md mirroring the PR guidelines (focused PR, CLAUDE.md/docs updates, example output for new MCP tools) and document the label taxonomy. (XS)
- `github-log-pattern-3`: Add explicit error handling and leveled output (e.g. (XS)
- `github-log-pattern-7`: Assign a session id per connection, include it in every log line for that session, and log session start/end with exit codes so a session can be reconstructed from logs. (XS)
- `github-commit-history-2`: Document the required branch protection rules (required reviews, status checks) and the merge strategy in CONTRIBUTING.md, and enable them in the repository settings. (XS)
**Total Effort**: XL

---

## Dependencies
- `code-exact-duplication-significant-2` **Depends On** `database-irreversible-migration-1`
- `code-bare-except-1` **Depends On** `database-irreversible-migration-1`
- `code-copy-paste-variant-6` **Depends On** `database-irreversible-migration-1`
- `code-missing-return-type-8` **Depends On** `database-irreversible-migration-1`
- `code-ignores-return-value-6` **Depends On** `database-irreversible-migration-1`
- `code-missing-validation-4` **Depends On** `database-irreversible-migration-1`
- `code-print-statement-5` **Depends On** `database-irreversible-migration-1`
- `code-missing-error-main-10` **Depends On** `database-irreversible-migration-1`
- `code-missing-docstring-10` **Depends On** `database-irreversible-migration-1`
- `performance-no-connection-pool-7` **Depends On** `database-irreversible-migration-1`
- `performance-no-keep-alive-9` **Depends On** `database-irreversible-migration-1`
- `performance-no-retry-jitter-8` **Depends On** `database-irreversible-migration-1`
- `performance-no-adaptive-timeout-6` **Depends On** `database-irreversible-migration-1`
- `performance-no-request-collapsing-4` **Depends On** `database-irreversible-migration-1`
- `performance-no-compression-13` **Depends On** `database-irreversible-migration-1`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
