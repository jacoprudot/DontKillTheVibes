# Assessment Report: ai-job-agent

- **Repository**: ai-job-agent
- **Date**: 2026-10-05T20:46:16.365Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 4
- **Total Findings**: 57
- **By Severity**: critical 4 · high 13 · medium 33 · low 7
- **By Module**: database 7 · structure 7 · flows 26 · security 6 · cost 7 · github 4
- **Estimated Total Effort**: 5×XS, 12×S, 39×M, 1×L
- **Top 3 Priorities**:
  - `security-secret-in-code-1` — The script's own documentation hardcodes a real personal Gmail address (`k.akbarme@gmail.com`) as the example `from`/`reply_to` value, and… (critical, XS) (score 105)
  - `database-full-table-scan-3` — fetch_rows() pulls the whole sheet range 'A2:M400' into memory on every invocation and main() then indexes into it by position (idx =… (critical, M) (score 97.5)
  - `flows-fire-and-forget-critical-1` — After clicking Send the script waits a fixed 2000ms and then prints 'Email sent!' and closes the browser, without confirming the message… (critical, M) (score 60)

---

## Detailed Findings (by Priority)

### Priority 1: `security-secret-in-code-1` (score 105)
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.7 | **Score**: 105
**Location**: `scripts/send-cold-email.js:19`
**Description**: The script's own documentation hardcodes a real personal Gmail address (`k.akbarme@gmail.com`) as the example `from`/`reply_to` value, and the same address is used as the default sender in the payload examples. Committing a real personal email address into the repository exposes the maintainer's identity/contact to anyone who clones it and encourages users to copy a live address into their configs.
**Remediation**: Replace the hardcoded personal address in the docstring and examples with a neutral placeholder such as `you@example.com`, and require the sender address to come from configuration or an environment variable.
**Depends On**: None | **Blocks**: None

### Priority 2: `database-full-table-scan-3` (score 97.5)
**Module**: database | **Severity**: critical | **Effort**: M | **Confidence**: 0.75 | **Score**: 97.5
**Location**: `scripts/tracker-status-update.py:52`
**Description**: fetch_rows() pulls the whole sheet range 'A2:M400' into memory on every invocation and main() then indexes into it by position (idx = sheet_row - 2). This is a full-table scan used as a lookup structure, and it silently truncates at 400 rows so any sheet_row beyond that is reported as out-of-range and never updated.
**Remediation**: Fetch only the rows that need updating (batch the requested sheet_row values into a single ranges=...:batchGet call) instead of reading A2:M400 wholesale, and remove the hardcoded 400-row ceiling so the range is derived from the sheet's actual dimensions.
**Depends On**: None | **Blocks**: None

### Priority 3: `flows-fire-and-forget-critical-1` (score 60)
**Module**: flows | **Severity**: critical | **Effort**: M | **Confidence**: 0.6 | **Score**: 60
**Location**: `scripts/outlook-send.js:120`
**Description**: After clicking Send the script waits a fixed 2000ms and then prints 'Email sent!' and closes the browser, without confirming the message actually left the Outbox. A send that fails server-side is reported as success (fire-and-forget), so the caller records a sent row that never went out.
**Remediation**: After clicking Send, verify the compose window closed / the message appears in Sent Items (or poll for an error banner) before reporting success, and exit non-zero if the send cannot be confirmed.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 4: `flows-missing-idempotency-3` (score 60)
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.6 | **Score**: 60
**Location**: `scripts/outlook-send.js:120`
**Description**: The send flow clicks the Send button unconditionally with no idempotency guard or dedupe key. If the script is re-run (or the click is retried after a transient failure), the same email is sent again to the recipient, producing duplicate outbound messages.
**Remediation**: Before clicking Send, check for an existing sent marker (e.g. a message-id recorded in outreach-log.csv or a local lock file keyed by recipient+subject) and skip the send if the same message was already dispatched.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 5: `database-iteration-overload-5` (score 52)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.8 | **Score**: 52
**Location**: `scripts/tracker-status-update.py:110`
**Description**: update_local_tracker() performs a nested loop over every CSV row for every update (for row in rows: for update in updates:), i.e. O(rows x updates) comparisons with repeated clean()/lower() normalization on each comparison. With a few hundred applications and a batch of status updates this is quadratic work on every run.
**Remediation**: Build a lookup dict keyed by the normalized (company, role, location) tuple once, then resolve each update with a single O(1) dict lookup instead of scanning all rows per update.
**Depends On**: None | **Blocks**: None

### Priority 6: `code-exact-duplication-massive-1` (score 49.5)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.9 | **Score**: 49.5
**Location**: `scripts/greenhouse-apply.js:1`
**Description**: The five ATS filler scripts (ashby-apply.js, greenhouse-apply.js, jobvite-apply.js, lever-apply.js, linkedin-easy-apply.js) are near-identical copies of the same ~200-line skeleton: identical argv parsing, identical `sleep()` helper, identical `monitorSubmission()` polling loop with the same 180-iteration captcha/submitted regex checks, identical `main()` CDP/launch/context/page setup, identical `finally` teardown, and identical `main().catch()` error handler. Only the per-ATS field-filling functions differ.
**Remediation**: Extract the shared skeleton (argv parsing, sleep, browser bootstrap, submission monitor, teardown, error handler) into a single scripts/lib/ats-runner.js module and have each ATS script supply only its form-filling strategy, eliminating the duplicated control flow.
**Depends On**: None | **Blocks**: `flows-missing-timeout-6`, `flows-missing-idempotency-3`, `flows-missing-error-handler-5`, `flows-error-leaks-stack-6`, `flows-missing-request-id-7`, `flows-missing-rate-limit-8`, `flows-missing-dlq-2`, `flows-missing-visibility-timeout-9`, `flows-message-not-idempotent-8`, `flows-message-ordering-needed-4`, `flows-missing-cors-9`, `flows-missing-security-headers-10`, `flows-fire-and-forget-critical-1`, `flows-inconsistent-response-4`, `flows-message-schema-no-version-1`, `flows-message-breaking-schema-2`, `flows-message-retention-too-long-7`, `flows-dlq-not-monitored-5`, `flows-no-state-persistence-6`, `flows-validation-placement-2`, `flows-validation-too-early-3`, `flows-auth-order-1`, `flows-consumer-group-lag-3`, `flows-missing-circuit-breaker-7`, `flows-retry-no-backoff-4`, `flows-retry-no-max-5`

### Priority 7: `database-missing-app-pool-8` (score 45.5)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 45.5
**Location**: `scripts/tracker-status-update.py:83`
**Description**: update_sheet() issues one urllib.request.urlopen call per status cell and one per notes cell, sequentially, with no connection reuse or pooling and no batching. A batch of N updates produces 2N separate HTTPS connections to the Sheets API, each paying full TLS handshake cost.
**Remediation**: Use the Sheets API values:batchUpdate endpoint to send all cell updates in a single request, and reuse a single HTTP connection (e.g. requests.Session or http.client.HTTPConnection) across calls instead of opening a new urlopen per cell.
**Depends On**: None | **Blocks**: None

### Priority 8: `database-sequential-pagination-1` (score 45.5)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.7 | **Score**: 45.5
**Location**: `scripts/google-sheet-sync.py:47`
**Description**: fetch_next_row() reads the entire range 'A2:M2000' in a single request and derives the next row from len(values), so the append position is computed from a full unbounded scan of the sheet rather than a bounded/offset-based lookup. As the tracker grows past the hardcoded 2000-row window the computed start_row silently becomes wrong and duplicate/overwritten rows result.
**Remediation**: Replace the fixed A2:M2000 full-range read with a bounded lookup (e.g. request only the key column with a large but explicit range, or use the Sheets API append endpoint's own position detection) and validate the returned row count against the requested range before computing start_row.
**Depends On**: None | **Blocks**: None

### Priority 9: `security-no-input-validation-14` (score 45)
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 45
**Location**: `scripts/outlook-send.js:33`
**Description**: The recipient address, subject and body file path are taken straight from `process.argv` and used without any validation or sanitization. A crafted `to` value containing newlines or additional header syntax is typed directly into the Outlook compose field, and an arbitrary `bodyFile` path is read from disk, so the script can be driven to send mail to unintended recipients or exfiltrate local file contents.
**Remediation**: Validate the recipient against an email-address regex, reject values containing CR/LF or header separators, and restrict bodyFile/attachment paths to an allow-listed directory before use.
**Depends On**: None | **Blocks**: None

### Priority 10: `flows-missing-dlq-2` (score 30)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 30
**Location**: `scripts/tracker-status-update.py`
**Description**: `tracker-status-update.py` processes a batch of status updates and silently drops any update whose `sheet_row` is out of range (collected into `skipped_out_of_range`) or that lacks a `sheet_row` (skipped with `continue`). There is no dead-letter record of the failed updates for later retry or inspection.
**Remediation**: Write skipped/failed updates to a dead-letter file (e.g. `data/status-update-dlq.json`) with the reason, and exit non-zero when any update was dropped so the caller can retry them.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 11: `security-gha-overpermissive-2` (score 29.75)
**Module**: github | **Severity**: high | **Effort**: XS | **Confidence**: 0.85 | **Score**: 29.75
**Location**: `.github/workflows/test.yml:9`
**Description**: The workflow declares no top-level `permissions:` block, so every job receives the repository default GITHUB_TOKEN permissions (historically read/write on contents, issues, packages). The smoke/lint/skill-files jobs only need to read the checkout.
**Remediation**: Add a top-level `permissions: contents: read` block (and grant any extra scope per-job only where required) so the GITHUB_TOKEN is least-privilege for all three jobs.
**Depends On**: None | **Blocks**: None

### Priority 12: `cost-no-automated-tests-4` (score 28)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 28
**Location**: `package.json:8`
**Description**: The only test entry point is `smoke` (bin/smoke-test.sh), which explicitly skips every network/auth-gated path (ATS form fillers, Outlook triage, Google Sheets sync, real msmtp send). There is no unit or integration test suite, so regressions in the bulk of the automation surface are only caught manually, driving rework cost.
**Remediation**: Add a real automated test suite (e.g. node:test or vitest) covering the ATS form-fill helpers, CSV parsing, and payload validation, and wire it into the CI workflow.
**Depends On**: None | **Blocks**: None

### Priority 13: `flows-auth-order-1` (score 27.5)
**Module**: flows | **Severity**: high | **Effort**: S | **Confidence**: 0.55 | **Score**: 27.5
**Location**: `scripts/linkedin-easy-apply.js`
**Description**: The LinkedIn flow builds cookies from the local Chrome cookie store via `buildCookies()` and injects them, but the script does not verify the session is authenticated before driving the Easy Apply UI. If the cookies are stale/expired, the automation proceeds against a logged-out page and fails deep in the flow rather than at an auth check.
**Remediation**: After injecting cookies, navigate to a lightweight authenticated endpoint (e.g. /feed) and assert the user is logged in before starting the apply flow, aborting with a clear 'session expired' error otherwise.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 14: `flows-message-breaking-schema-2` (score 27.5)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 27.5
**Location**: `scripts/tracker-status-update.py`
**Description**: `update_local_tracker` rewrites the CSV using `fieldnames` derived from the existing header and `extrasaction='ignore'`, so any new column added by another writer is silently dropped on the next status update. This is a backward-incompatible schema change applied without versioning.
**Remediation**: Preserve unknown columns by merging the existing header with any new fields before writing, and version the tracker schema so writers agree on the column set instead of silently discarding columns.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 15: `flows-message-not-idempotent-8` (score 27.5)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 27.5
**Location**: `scripts/tracker-status-update.py`
**Description**: `update_local_tracker` matches rows by company/role/location and overwrites `status` and appends notes on every run. Re-running the same update JSON re-applies the change and can append duplicate notes, so the update is not idempotent.
**Remediation**: Make the update idempotent by keying on a stable row id (the `key` column) and skipping rows whose status already equals the target, and dedupe notes before appending.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 16: `security-gha-action-unpinned-5` (score 27)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 27
**Location**: `.github/workflows/test.yml:14`
**Description**: GitHub Actions are referenced by mutable version tags (`actions/checkout@v4`, `actions/setup-node@v4`) instead of immutable commit SHAs. A compromised or retagged upstream action would execute arbitrary code in the workflow with access to the runner and any secrets.
**Remediation**: Pin every third-party action to a full 40-character commit SHA (e.g. `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11`) and use Dependabot or a similar tool to keep the pins updated.
**Depends On**: None | **Blocks**: None

### Priority 17: `security-gha-job-no-timeout-7` (score 25.5)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 25.5
**Location**: `.github/workflows/test.yml:10`
**Description**: None of the workflow jobs (`smoke`, `lint`, `skill-files`) declare `timeout-minutes`. A hung step (e.g. a stalled `npm install` or a Playwright launch that never returns) can occupy a runner for the default 360 minutes, burning CI minutes and delaying feedback.
**Remediation**: Add `timeout-minutes: 10` (or an appropriate bound) to each job in .github/workflows/test.yml so runaway steps are killed promptly.
**Depends On**: None | **Blocks**: None

### Priority 18: `database-connection-timeout-high-3` (score 22.1)
**Module**: database | **Severity**: medium | **Effort**: XS | **Confidence**: 0.85 | **Score**: 22.1
**Location**: `scripts/tracker-status-update.py:84`
**Description**: Every urllib.request.urlopen call in update_sheet() (and fetch_rows()) is made without a timeout argument, so a hung or slow Sheets API response blocks the script indefinitely with no upper bound on connection or read time.
**Remediation**: Pass an explicit timeout to every urlopen call (e.g. urllib.request.urlopen(req, timeout=30)) and handle socket.timeout so a stalled API call fails fast instead of hanging the batch update.
**Depends On**: None | **Blocks**: None

### Priority 19: `cost-dev-setup-missing-3` (score 22)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 22
**Location**: `setup.sh:1`
**Description**: setup.sh installs dependencies and copies config templates but never verifies the toolchain end-to-end or runs the smoke test, and there is no documented one-command way to confirm a working dev environment. New contributors must discover bin/doctor.sh and bin/smoke-test.sh on their own.
**Remediation**: Have setup.sh finish by invoking `bash bin/doctor.sh` (or the smoke test) and print the result, so a broken environment is surfaced during setup rather than at first use.
**Depends On**: None | **Blocks**: None

### Priority 20: `code-exact-duplication-significant-2` (score 20.9)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.95 | **Score**: 20.9
**Location**: `scripts/mirror-tracker.mjs:30`
**Description**: The RFC 4180-lite CSV parser (`parseCSV`) is duplicated verbatim between scripts/job-dashboard.mjs and scripts/mirror-tracker.mjs, including the identical BOM-stripping logic and quoted-field state machine. The two copies have already drifted (one returns an array of objects, the other returns {header, rows}).
**Remediation**: Move the CSV parser into a shared module (e.g. scripts/lib/csv.mjs) exporting a single parse function, and have both job-dashboard.mjs and mirror-tracker.mjs import it so the parsing rules stay in sync.
**Depends On**: None | **Blocks**: None

### Priority 21: `flows-consumer-group-lag-3` (score 20)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.4 | **Score**: 20
**Location**: `scripts/job-dashboard.mjs`
**Description**: The dashboard's follow-up urgency is computed from `last_follow_up_at`/`sent_at` in outreach-log.csv, but there is no tracking of how far behind the follow-up cadence has fallen (no lag metric). Overdue follow-ups accumulate without a measurable backlog signal.
**Remediation**: Compute and display a follow-up backlog/lag metric (count and age of overdue follow-ups) in the dashboard so the cadence falling behind is visible rather than only per-row urgency.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 22: `security-gha-workspace-not-cleaned-6` (score 18)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 18
**Location**: `.github/workflows/test.yml:44`
**Description**: The `lint` job installs shellcheck via `sudo apt-get install` and the `smoke` job runs `npm install` on the shared GitHub-hosted runner without any cleanup step. On self-hosted or reused runners this leaves installed packages and node_modules behind, which can leak state between jobs or into subsequent workflow runs.
**Remediation**: Add a cleanup step (or use ephemeral/containerized runners) that removes installed tooling and node_modules after the job, or run these jobs inside a container so the workspace is discarded.
**Depends On**: None | **Blocks**: None

### Priority 23: `structure-low-cohesion-5` (score 16.5)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 16.5
**Location**: `scripts/job-dashboard.mjs:1`
**Description**: job-dashboard.mjs is a single module that simultaneously owns ANSI/terminal rendering, CSV parsing, repo-root path resolution, date/urgency analysis, sparkline math, table layout, and the interactive TUI event loop — unrelated responsibilities bundled into one file with no internal seams.
**Remediation**: Split the module into focused units: a csv parser, a repo-root resolver, an analysis layer (status counts, urgency, rows-per-day), and a rendering/TUI layer, so each concern can evolve and be tested independently.
**Depends On**: None | **Blocks**: None

### Priority 24: `database-missing-index-where-4` (score 15.6)
**Module**: database | **Severity**: medium | **Effort**: S | **Confidence**: 0.6 | **Score**: 15.6
**Location**: `scripts/tracker-status-update.py:112`
**Description**: Row matching is done by comparing normalized company/role/location strings with no key column and no index: the CSV template (templates/tracker.template.csv) has a 'key' column, but this updater ignores it and re-derives identity by scanning and lowercasing text fields, so lookups are unindexed and ambiguous when two applications share company+role+location.
**Remediation**: Use the existing 'key' column from the tracker CSV as the primary lookup key (build a dict from key -> row once) instead of matching on lowercased company/role/location text.
**Depends On**: None | **Blocks**: None

### Priority 25: `structure-high-coupling-2` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `scripts/linkedin-easy-apply.js:60`
**Description**: `buildCookies()` shells out to `python3 -c` with an inline Python program that imports browser_cookie3, coupling the Node script to a specific Python interpreter, an optional pip package, and a hardcoded Chrome cookie file path. The Node layer cannot function without the Python runtime being present and correctly configured.
**Remediation**: Isolate the cookie extraction behind a small documented adapter (e.g. a scripts/cookies.py invoked with a stable JSON contract) or read the cookie store directly, so the Node script depends on a defined interface rather than an embedded Python snippet.
**Depends On**: None | **Blocks**: None

### Priority 26: `flows-missing-timeout-6` (score 15)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 15
**Location**: `scripts/outlook-send.js:31`
**Description**: The CDP connection to the browser is established with `chromium.connectOverCDP(...)` without any timeout, and the subsequent `page.locator(...).click()` / `.fill()` calls on the Outlook compose UI have no explicit timeouts either. If the debug endpoint is unreachable or the Outlook UI never renders the compose form, the script hangs indefinitely instead of failing fast.
**Remediation**: Pass an explicit timeout to connectOverCDP (e.g. `chromium.connectOverCDP(url, { timeout: 15000 })`) and set `page.setDefaultTimeout(15000)` after obtaining the page so every locator action fails fast rather than hanging.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 27: `cost-gha-no-timeout-9` (score 14.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 14.4
**Location**: `.github/workflows/test.yml:11`
**Description**: None of the three jobs (smoke, lint, skill-files) declare a `timeout-minutes` value. A hung `npm run smoke`, a stalled `apt-get update`, or a wedged Playwright launch will burn the default 360-minute GitHub Actions limit per job, multiplying billed runner minutes.
**Remediation**: Add `timeout-minutes: 10` (or a suitable bound) to each job in .github/workflows/test.yml so a stuck step is killed instead of consuming the full default timeout.
**Depends On**: None | **Blocks**: None

### Priority 28: `database-missing-index-hot-path-2` (score 14.3)
**Module**: database | **Severity**: medium | **Effort**: S | **Confidence**: 0.55 | **Score**: 14.3
**Location**: `scripts/mirror-tracker.mjs`
**Description**: mirror() re-reads and re-parses both application-tracker.csv and outreach-log.csv from disk on every invocation and in watch mode on every debounced change, with no cached parse or incremental update, so the full CSV is re-scanned each time even when only one row changed.
**Remediation**: Cache the parsed CSV in memory and re-parse only the file whose mtime changed, or apply an incremental append/diff instead of re-reading and re-parsing the entire tracker on every watch tick.
**Depends On**: None | **Blocks**: None

### Priority 29: `flows-missing-error-handler-5` (score 14)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 14
**Location**: `scripts/lever-apply.js:63`
**Description**: `dismissCookieBanner` and `ensureLeverApplyForm` wrap locator interactions in `try { ... } catch {}` blocks that swallow every error silently. A genuine failure (selector changed, page crashed) is indistinguishable from the expected 'banner not present' case, so the form-fill flow proceeds with no diagnostic.
**Remediation**: Catch only the expected timeout/not-found errors and log or rethrow unexpected ones (e.g. `catch (err) { if (!/Timeout|not found/i.test(err.message)) throw err; }`) so real failures surface instead of being silently ignored.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 30: `cost-gha-no-dependency-cache-5` (score 13.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 13.6
**Location**: `.github/workflows/test.yml:22`
**Description**: The smoke job runs `npm install --no-audit --no-fund` on every push and pull request without any dependency caching (no actions/cache or setup-node `cache: npm`). Every CI run re-downloads the full npm dependency tree, wasting runner minutes and bandwidth on each of the three jobs.
**Remediation**: Add `cache: 'npm'` to the actions/setup-node@v4 step (or an actions/cache step keyed on package-lock.json) so node_modules is restored between runs instead of re-downloaded.
**Depends On**: None | **Blocks**: None

### Priority 31: `code-long-parameter-list-8` (score 13.2)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 13.2
**Location**: `scripts/outlook-send.js:28`
**Description**: The script's entry contract is a positional 4-argument CLI (`<to> <subject> <bodyFile> [attachmentPath]`) parsed directly from process.argv, and the same positional-argument pattern is repeated across all ATS scripts (`<jobUrl> <configPath>`). Positional argument lists of this shape are hard to extend and easy to mis-order.
**Remediation**: Accept a single JSON payload (as send-cold-email.js and generate-tailored-cv.mjs already do) or use named flags so callers pass an explicit object rather than an ordered positional list.
**Depends On**: None | **Blocks**: None

### Priority 32: `structure-config-logic-8` (score 13.2)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 13.2
**Location**: `scripts/google-sheet-sync.py:33`
**Description**: Configuration values (SPREADSHEET_ID, SHEET_NAME) are read from environment variables at module import time and default to placeholder sentinels ('YOUR_SHEET_ID'), while the same constants are re-declared independently in scripts/tracker-status-update.py — configuration is scattered across modules rather than centralized.
**Remediation**: Centralize sheet configuration (spreadsheet id, sheet name, range) in one shared config module or a single config file loaded by both scripts, and fail fast with a clear error when the placeholder is still set.
**Depends On**: None | **Blocks**: None

### Priority 33: `structure-service-sql-5` (score 13.2)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 13.2
**Location**: `scripts/google-sheet-sync.py:97`
**Description**: `rows_from_csv()` mixes data-access concerns (reading the CSV, calling `fetch_next_row()` which performs an authenticated Sheets API request) with presentation/business logic (cleaning fields, defaulting `source`/`applied_by`, and synthesizing the `=TODAY()-A{sheet_row}` formula and `make_key()` slug). The row-shaping logic is entangled with the network fetch.
**Remediation**: Split the function: a pure `format_row(row, sheet_row)` that maps a CSV dict to the sheet row, and a separate orchestration step that fetches the start row and appends, so the formatting logic is testable without network access.
**Depends On**: None | **Blocks**: None

### Priority 34: `flows-error-leaks-stack-6` (score 12)
**Module**: flows | **Severity**: medium | **Effort**: S | **Confidence**: 0.6 | **Score**: 12
**Location**: `scripts/outlook-triage.js:198`
**Description**: The top-level catch prints the full error stack to stderr (`console.error(err && err.stack ? err.stack : String(err))`). When run from the /job-triage skill the stack trace (including absolute local paths and internal call frames) is surfaced to the user/log output.
**Remediation**: Print a concise error message to stderr and only include the stack when a DEBUG/VERBOSE env var is set, so routine failures do not leak internal paths and frames.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 35: `flows-missing-rate-limit-8` (score 11)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 11
**Location**: `scripts/linkedin-easy-apply.js`
**Description**: The LinkedIn Easy Apply flow drives the LinkedIn web UI with no client-side rate limiting or pacing between applications. Repeated rapid submissions from the same account risk triggering LinkedIn's anti-automation throttling or account restrictions.
**Remediation**: Add a configurable minimum delay between applications (e.g. 30-60s) and a per-run application cap, and back off on HTTP 429 / captcha responses before retrying.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 36: `flows-retry-no-backoff-4` (score 11)
**Module**: flows | **Severity**: medium | **Effort**: XS | **Confidence**: 0.55 | **Score**: 11
**Location**: `scripts/ashby-apply.js`
**Description**: `monitorSubmission` polls in a fixed 1000ms `sleep` loop for up to 180 iterations with no exponential backoff or jitter. On a slow or rate-limited endpoint this produces a steady stream of requests rather than backing off.
**Remediation**: Replace the fixed 1s poll with exponential backoff plus jitter (e.g. 1s, 2s, 4s… capped) so repeated polling does not hammer the endpoint.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 37: `flows-dlq-not-monitored-5` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/tracker-status-update.py`
**Description**: Skipped updates (`skipped_out_of_range`) are only printed in the JSON result and never surfaced as an alert or metric. Nothing monitors for dropped status updates, so silent data loss in the tracker goes unnoticed.
**Remediation**: Emit a non-zero exit code and a structured warning when any update is skipped, and have the calling skill surface skipped rows to the user so they can be corrected and retried.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 38: `flows-message-ordering-needed-4` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/google-sheet-sync.py`
**Description**: `rows_from_csv` computes `start_row` from `fetch_next_row()` and then appends rows in CSV order. If two sync runs overlap, both can compute the same next row and append concurrently, interleaving rows out of order in the sheet.
**Remediation**: Serialize sheet appends (e.g. a lock file or a single-writer queue) and re-read the next row immediately before the append so concurrent runs cannot interleave or overwrite each other's rows.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 39: `flows-message-schema-no-version-1` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/send-cold-email.js`
**Description**: The JSON payload accepted by `send-cold-email.js` (from/to/subject/body/in_reply_to/references/account) has no schema version field. As the payload shape evolves, callers and the outreach-log rows cannot tell which schema a given message was produced under.
**Remediation**: Add a `schema_version` field to the payload and to the emitted JSON/outreach-log row, and validate it on read so future shape changes can be handled without breaking existing records.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 40: `flows-missing-circuit-breaker-7` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/greenhouse-apply.js`
**Description**: The Greenhouse flow retries submission and captcha handling in a 180-iteration loop with no circuit breaker. If the ATS endpoint is down or consistently rejecting, the script keeps hammering it for the full loop duration instead of failing fast.
**Remediation**: Add a circuit breaker: after N consecutive failed submission attempts or repeated non-2xx responses, stop retrying, log the failure, and exit non-zero so the caller can back off.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 41: `flows-missing-visibility-timeout-9` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/outlook-triage.js`
**Description**: The triage flow reads messages from Outlook Web and, unless `--keep-unread` is passed, leaves them marked as read. There is no visibility/lease timeout or explicit acknowledgement step, so a message that is read but whose extraction fails is effectively consumed and will not be re-processed on the next run.
**Remediation**: Only mark a message read after its extraction has been persisted successfully, and record a processed message id so failed extractions remain unread and are retried on the next triage run.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 42: `flows-retry-no-max-5` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: XS | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/greenhouse-apply.js`
**Description**: The captcha-token retry path re-clicks submit whenever a token is present, guarded only by a single `retriedWithToken` boolean, while the surrounding loop runs 180 times. There is no explicit maximum retry count tied to submission attempts, so retries are bounded only by the loop length rather than a deliberate cap.
**Remediation**: Define an explicit maximum number of submission retries (e.g. 2) and stop retrying once it is reached, logging that the submission could not be confirmed.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 43: `flows-validation-placement-2` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: S | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/send-cold-email.js`
**Description**: Payload validation happens in `readPayload` only for presence of from/to/subject/body; the recipient addresses themselves are never validated (no email-format check) before the message is handed to msmtp. Invalid addresses fail deep in the SMTP layer rather than at the boundary.
**Remediation**: Validate recipient (and from/reply_to) addresses against a basic email-format check in `readPayload` and fail with exit code 2 before building the message, so bad input is rejected at the boundary.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 44: `cost-gha-high-usage-1` (score 9.8)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 9.8
**Location**: `.github/workflows/test.yml:4`
**Description**: The workflow triggers on every push to main and every pull request to main across three separate ubuntu-latest jobs, with no path filtering or concurrency group. Docs-only or skill-markdown-only changes still spin up the full smoke + lint + skill-files matrix.
**Remediation**: Add a `concurrency` group with `cancel-in-progress: true` and `paths-ignore` for docs/markdown-only changes so redundant runs are cancelled and trivial commits do not consume runner minutes.
**Depends On**: None | **Blocks**: None

### Priority 45: `cost-documentation-poor-7` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `scripts/google-sheet-sync.py:33`
**Description**: Both Google Sheets scripts ship with placeholder configuration (`SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "YOUR_SHEET_ID")`) and no documented procedure for creating the service account, granting sheet access, or obtaining the ID. Users must reverse-engineer the setup, which is a recurring support/onboarding cost.
**Remediation**: Document the Google Sheets setup end-to-end (gcloud auth, sharing the sheet with the ADC principal, setting SPREADSHEET_ID/SHEET_NAME) in the README and fail fast with a clear error when the placeholder is still in place.
**Depends On**: None | **Blocks**: None

### Priority 46: `security-weak-rng-10` (score 9)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.3 | **Score**: 9
**Location**: `scripts/send-cold-email.js:123`
**Description**: Message-IDs are generated with `crypto.randomBytes(12)`, which is cryptographically strong, but the surrounding code treats the generated identifier as a security-relevant token for threading and logging. No weakness is present in the RNG itself; this finding is recorded only to note that the identifier is not validated for uniqueness across concurrent sends.
**Remediation**: No change required to the RNG; if message-id uniqueness matters for threading, include a per-process counter or timestamp component in addition to the random bytes.
**Depends On**: None | **Blocks**: None

### Priority 47: `cost-no-license-tracking-5` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `package.json:29`
**Description**: The project declares `"license": "MIT"` and depends on playwright-core, but there is no automated license inventory or attribution check anywhere in the repo or CI. As dependencies are added, incompatible or attribution-required licenses can slip in unnoticed.
**Remediation**: Add a license-checking step (e.g. license-checker or a CI job that generates a third-party notices file) so dependency licenses are tracked and attribution obligations are met.
**Depends On**: None | **Blocks**: None

### Priority 48: `cost-slow-tests-2` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `bin/smoke-test.sh:1`
**Description**: The smoke test is the sole automated gate and it is heavyweight: it runs install.sh in a sandbox, re-installs, exercises the dashboard and mirror scripts, and loops over all 14 skill files twice. Combined with the uncached npm install in CI, the feedback loop is slow for a repo of this size.
**Remediation**: Split the smoke test into fast (pure-function/CSV) and slow (install/browser) tiers so the common case runs in seconds, and cache dependencies in CI.
**Depends On**: None | **Blocks**: None

### Priority 49: `github-issue-health-1` (score 7.7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 7.7
**Location**: `CONTRIBUTING.md:20`
**Description**: CONTRIBUTING.md directs contributors to open issues and PRs but the repository ships no issue templates, PR template, or triage labels referenced anywhere in the provided files, so incoming reports (which the doc asks to include ATS platform, error output, and redacted CSV rows) have no structured intake path.
**Remediation**: Add .github/ISSUE_TEMPLATE/bug_report.md and .github/pull_request_template.md capturing the fields CONTRIBUTING.md already asks for (ATS platform, error output, redacted tracker rows) and reference them from the contributing guide.
**Depends On**: None | **Blocks**: None

### Priority 50: `github-commit-history-1` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `CHANGELOG.md:7`
**Description**: The changelog dates are internally inconsistent with the project's own timeline: v1.2.0 is dated 2026-04-26 and v1.1.0 2026-04-25, i.e. four days after v1.0.0 (2026-04-22) yet the README claims 228+ applications were already submitted and refined across the whole search. The release cadence (three releases in four days, each a large feature set) does not match the described history.
**Remediation**: Reconcile the CHANGELOG dates with the actual commit history (use `git log --format=%ad --date=short` per tag) and correct any release date that does not match the tagged commit, so the changelog reflects real history.
**Depends On**: None | **Blocks**: None

### Priority 51: `flows-inconsistent-response-4` (score 2.5)
**Module**: flows | **Severity**: low | **Effort**: M | **Confidence**: 0.5 | **Score**: 2.5
**Location**: `scripts/outlook-triage.js`
**Description**: The triage commands return heterogeneous shapes: `search` returns an array of result objects, `extract` returns an object with `selected/sender/body`, `mark-read` returns `{index, nowRead}`, and `clear-search` returns undefined. Consumers must special-case each command, making the CLI output inconsistent.
**Remediation**: Wrap every command's result in a uniform envelope (e.g. `{ok:true, command, data}`) so callers can parse the output the same way regardless of which subcommand ran.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 52: `flows-missing-request-id-7` (score 2.5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.5 | **Score**: 2.5
**Location**: `scripts/send-cold-email.js`
**Description**: The cold-email send flow emits a Message-ID but no correlation/request id that ties the send to the outreach-log row or the invoking skill run. When multiple sends happen in one session there is no single id to trace a message through logs, the CSV, and follow-ups.
**Remediation**: Generate a run/request id (e.g. a UUID per invocation) and include it in the JSON output and the outreach-log row alongside messageId, so each send can be correlated end-to-end.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 53: `flows-missing-cors-9` (score 2.25)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.45 | **Score**: 2.25
**Location**: `scripts/lever-apply.js`
**Description**: `setLeverLocation` issues an in-page `fetch('/searchLocations?...')` from the page context with `credentials: 'same-origin'`. This relies on the target site's CORS/same-origin policy and will silently fail (returning `{ok:false}`) if the endpoint rejects the request, with no fallback path.
**Remediation**: Handle the CORS/same-origin failure explicitly: on a failed fetch, fall back to typing the location and selecting from the rendered dropdown, and log the failure reason so the user knows the location was not resolved.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 54: `flows-missing-security-headers-10` (score 2.25)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.45 | **Score**: 2.25
**Location**: `scripts/generate-tailored-cv.mjs`
**Description**: `generate-tailored-cv.mjs` renders user-supplied markdown into an HTML document via `page.setContent(html)` and then to PDF. The generated HTML has no Content-Security-Policy or other hardening, and `renderInline` allows arbitrary `[text](url)` link targets, so a crafted CV markdown could embed unexpected URLs in the rendered document.
**Remediation**: Add a restrictive `<meta http-equiv="Content-Security-Policy">` to the generated HTML and validate/sanitize link URLs (allow only http/https) in `renderInline` before rendering.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 55: `flows-no-state-persistence-6` (score 2.25)
**Module**: flows | **Severity**: low | **Effort**: M | **Confidence**: 0.45 | **Score**: 2.25
**Location**: `scripts/outlook-send.js`
**Description**: `outlook-send.js` keeps no persistent state about which emails it has composed or sent; the only record is stdout. If the process is interrupted after clicking Send but before logging, there is no durable record to reconcile against the outreach log.
**Remediation**: Persist a send record (recipient, subject, message-id, timestamp, status) to a durable store before and after the Send click so interrupted runs can be reconciled.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 56: `flows-validation-too-early-3` (score 2.25)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.45 | **Score**: 2.25
**Location**: `scripts/lever-apply.js`
**Description**: `fillLeverForm` collects `missingRequired` by querying `[required]` elements immediately after filling, before the page's own client-side validation and any async field initialization have settled. Fields that populate asynchronously can be reported as missing, causing a false 'blocked' result.
**Remediation**: Re-check required fields after a short settle/wait (or after the form's validation event fires) before deciding the form is blocked, so asynchronously-populated fields are not falsely flagged.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

### Priority 57: `flows-message-retention-too-long-7` (score 2)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.4 | **Score**: 2
**Location**: `scripts/outlook-triage.js`
**Description**: Triage reads and leaves messages in the mailbox with no retention/cleanup policy, and `extract` returns the full message body text which callers may persist. Personal email content accumulates indefinitely with no defined retention window.
**Remediation**: Define and document a retention policy for extracted message bodies (e.g. keep only the matched snippet for N days) and avoid persisting full bodies beyond what the triage decision requires.
**Depends On**: `code-exact-duplication-massive-1` | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `security-secret-in-code-1`: Replace the hardcoded personal address in the docstring and examples with a neutral placeholder such as `you@example.com`, and require the sender address to come from configuration or an environment… (XS)
- `database-full-table-scan-3`: Fetch only the rows that need updating (batch the requested sheet_row values into a single ranges=...:batchGet call) instead of reading A2:M400 wholesale, and remove the hardcoded 400-row ceiling so… (M)
- `flows-fire-and-forget-critical-1`: After clicking Send, verify the compose window closed / the message appears in Sent Items (or poll for an error banner) before reporting success, and exit non-zero if the send cannot be confirmed. (M)
- `flows-missing-idempotency-3`: Before clicking Send, check for an existing sent marker (e.g. (S)
- `database-iteration-overload-5`: Build a lookup dict keyed by the normalized (company, role, location) tuple once, then resolve each update with a single O(1) dict lookup instead of scanning all rows per update. (M)
- `code-exact-duplication-massive-1`: Extract the shared skeleton (argv parsing, sleep, browser bootstrap, submission monitor, teardown, error handler) into a single scripts/lib/ats-runner.js module and have each ATS script supply only… (L)
- `database-missing-app-pool-8`: Use the Sheets API values:batchUpdate endpoint to send all cell updates in a single request, and reuse a single HTTP connection (e.g. (M)
- `database-sequential-pagination-1`: Replace the fixed A2:M2000 full-range read with a bounded lookup (e.g. (S)
- `security-no-input-validation-14`: Validate the recipient against an email-address regex, reject values containing CR/LF or header separators, and restrict bodyFile/attachment paths to an allow-listed directory before use. (M)
- `flows-missing-dlq-2`: Write skipped/failed updates to a dead-letter file (e.g. (M)
- `security-gha-overpermissive-2`: Add a top-level `permissions: contents: read` block (and grant any extra scope per-job only where required) so the GITHUB_TOKEN is least-privilege for all three jobs. (XS)
- `cost-no-automated-tests-4`: Add a real automated test suite (e.g. (M)
- `flows-auth-order-1`: After injecting cookies, navigate to a lightweight authenticated endpoint (e.g. (S)
- `flows-message-breaking-schema-2`: Preserve unknown columns by merging the existing header with any new fields before writing, and version the tracker schema so writers agree on the column set instead of silently discarding columns. (M)
- `flows-message-not-idempotent-8`: Make the update idempotent by keying on a stable row id (the `key` column) and skipping rows whose status already equals the target, and dedupe notes before appending. (M)
- `security-gha-action-unpinned-5`: Pin every third-party action to a full 40-character commit SHA (e.g. (M)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 10` (or an appropriate bound) to each job in .github/workflows/test.yml so runaway steps are killed promptly. (M)
- `database-connection-timeout-high-3`: Pass an explicit timeout to every urlopen call (e.g. (XS)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `cost-dev-setup-missing-3`: Have setup.sh finish by invoking `bash bin/doctor.sh` (or the smoke test) and print the result, so a broken environment is surfaced during setup rather than at first use. (M)
- `code-exact-duplication-significant-2`: Move the CSV parser into a shared module (e.g. (M)
- `flows-consumer-group-lag-3`: Compute and display a follow-up backlog/lag metric (count and age of overdue follow-ups) in the dashboard so the cadence falling behind is visible rather than only per-row urgency. (M)
- `security-gha-workspace-not-cleaned-6`: Add a cleanup step (or use ephemeral/containerized runners) that removes installed tooling and node_modules after the job, or run these jobs inside a container so the workspace is discarded. (M)
- `structure-low-cohesion-5`: Split the module into focused units: a csv parser, a repo-root resolver, an analysis layer (status counts, urgency, rows-per-day), and a rendering/TUI layer, so each concern can evolve and be tested… (M)
- `database-missing-index-where-4`: Use the existing 'key' column from the tracker CSV as the primary lookup key (build a dict from key -> row once) instead of matching on lowercased company/role/location text. (S)
- `structure-high-coupling-2`: Isolate the cookie extraction behind a small documented adapter (e.g. (M)
- `flows-missing-timeout-6`: Pass an explicit timeout to connectOverCDP (e.g. (M)
- `cost-gha-no-timeout-9`: Add `timeout-minutes: 10` (or a suitable bound) to each job in .github/workflows/test.yml so a stuck step is killed instead of consuming the full default timeout. (M)
- `database-missing-index-hot-path-2`: Cache the parsed CSV in memory and re-parse only the file whose mtime changed, or apply an incremental append/diff instead of re-reading and re-parsing the entire tracker on every watch tick. (S)
- `flows-missing-error-handler-5`: Catch only the expected timeout/not-found errors and log or rethrow unexpected ones (e.g. (M)
- `cost-gha-no-dependency-cache-5`: Add `cache: 'npm'` to the actions/setup-node@v4 step (or an actions/cache step keyed on package-lock.json) so node_modules is restored between runs instead of re-downloaded. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `code-long-parameter-list-8`: Accept a single JSON payload (as send-cold-email.js and generate-tailored-cv.mjs already do) or use named flags so callers pass an explicit object rather than an ordered positional list. (M)
- `structure-config-logic-8`: Centralize sheet configuration (spreadsheet id, sheet name, range) in one shared config module or a single config file loaded by both scripts, and fail fast with a clear error when the placeholder… (M)
- `structure-service-sql-5`: Split the function: a pure `format_row(row, sheet_row)` that maps a CSV dict to the sheet row, and a separate orchestration step that fetches the start row and appends, so the formatting logic is… (M)
- `flows-error-leaks-stack-6`: Print a concise error message to stderr and only include the stack when a DEBUG/VERBOSE env var is set, so routine failures do not leak internal paths and frames. (S)
- `flows-missing-rate-limit-8`: Add a configurable minimum delay between applications (e.g. (M)
- `flows-retry-no-backoff-4`: Replace the fixed 1s poll with exponential backoff plus jitter (e.g. (XS)
- `flows-dlq-not-monitored-5`: Emit a non-zero exit code and a structured warning when any update is skipped, and have the calling skill surface skipped rows to the user so they can be corrected and retried. (M)
- `flows-message-ordering-needed-4`: Serialize sheet appends (e.g. (M)
- `flows-message-schema-no-version-1`: Add a `schema_version` field to the payload and to the emitted JSON/outreach-log row, and validate it on read so future shape changes can be handled without breaking existing records. (M)
- `flows-missing-circuit-breaker-7`: Add a circuit breaker: after N consecutive failed submission attempts or repeated non-2xx responses, stop retrying, log the failure, and exit non-zero so the caller can back off. (M)
- `flows-missing-visibility-timeout-9`: Only mark a message read after its extraction has been persisted successfully, and record a processed message id so failed extractions remain unread and are retried on the next triage run. (M)
- `flows-retry-no-max-5`: Define an explicit maximum number of submission retries (e.g. (XS)
- `flows-validation-placement-2`: Validate recipient (and from/reply_to) addresses against a basic email-format check in `readPayload` and fail with exit code 2 before building the message, so bad input is rejected at the boundary. (S)
- `cost-gha-high-usage-1`: Add a `concurrency` group with `cancel-in-progress: true` and `paths-ignore` for docs/markdown-only changes so redundant runs are cancelled and trivial commits do not consume runner minutes. (M)
- `cost-documentation-poor-7`: Document the Google Sheets setup end-to-end (gcloud auth, sharing the sheet with the ADC principal, setting SPREADSHEET_ID/SHEET_NAME) in the README and fail fast with a clear error when the… (M)
- `security-weak-rng-10`: No change required to the RNG; if message-id uniqueness matters for threading, include a per-process counter or timestamp component in addition to the random bytes. (M)
- `cost-no-license-tracking-5`: Add a license-checking step (e.g. (M)
- `cost-slow-tests-2`: Split the smoke test into fast (pure-function/CSV) and slow (install/browser) tiers so the common case runs in seconds, and cache dependencies in CI. (M)
- `github-issue-health-1`: Add .github/ISSUE_TEMPLATE/bug_report.md and .github/pull_request_template.md capturing the fields CONTRIBUTING.md already asks for (ATS platform, error output, redacted tracker rows) and reference… (M)
- `github-commit-history-1`: Reconcile the CHANGELOG dates with the actual commit history (use `git log --format=%ad --date=short` per tag) and correct any release date that does not match the tagged commit, so the changelog… (M)
- `flows-inconsistent-response-4`: Wrap every command's result in a uniform envelope (e.g. (M)
- `flows-missing-request-id-7`: Generate a run/request id (e.g. (S)
- `flows-missing-cors-9`: Handle the CORS/same-origin failure explicitly: on a failed fetch, fall back to typing the location and selecting from the rendered dropdown, and log the failure reason so the user knows the… (S)
- `flows-missing-security-headers-10`: Add a restrictive `<meta http-equiv="Content-Security-Policy">` to the generated HTML and validate/sanitize link URLs (allow only http/https) in `renderInline` before rendering. (S)
- `flows-no-state-persistence-6`: Persist a send record (recipient, subject, message-id, timestamp, status) to a durable store before and after the Send click so interrupted runs can be reconciled. (M)
- `flows-validation-too-early-3`: Re-check required fields after a short settle/wait (or after the form's validation event fires) before deciding the form is blocked, so asynchronously-populated fields are not falsely flagged. (S)
- `flows-message-retention-too-long-7`: Define and document a retention policy for extracted message bodies (e.g. (S)
**Total Effort**: XL

---

## Dependencies
- `flows-missing-timeout-6` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-idempotency-3` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-error-handler-5` **Depends On** `code-exact-duplication-massive-1`
- `flows-error-leaks-stack-6` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-request-id-7` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-rate-limit-8` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-dlq-2` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-visibility-timeout-9` **Depends On** `code-exact-duplication-massive-1`
- `flows-message-not-idempotent-8` **Depends On** `code-exact-duplication-massive-1`
- `flows-message-ordering-needed-4` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-cors-9` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-security-headers-10` **Depends On** `code-exact-duplication-massive-1`
- `flows-fire-and-forget-critical-1` **Depends On** `code-exact-duplication-massive-1`
- `flows-inconsistent-response-4` **Depends On** `code-exact-duplication-massive-1`
- `flows-message-schema-no-version-1` **Depends On** `code-exact-duplication-massive-1`
- `flows-message-breaking-schema-2` **Depends On** `code-exact-duplication-massive-1`
- `flows-message-retention-too-long-7` **Depends On** `code-exact-duplication-massive-1`
- `flows-dlq-not-monitored-5` **Depends On** `code-exact-duplication-massive-1`
- `flows-no-state-persistence-6` **Depends On** `code-exact-duplication-massive-1`
- `flows-validation-placement-2` **Depends On** `code-exact-duplication-massive-1`
- `flows-validation-too-early-3` **Depends On** `code-exact-duplication-massive-1`
- `flows-auth-order-1` **Depends On** `code-exact-duplication-massive-1`
- `flows-consumer-group-lag-3` **Depends On** `code-exact-duplication-massive-1`
- `flows-missing-circuit-breaker-7` **Depends On** `code-exact-duplication-massive-1`
- `flows-retry-no-backoff-4` **Depends On** `code-exact-duplication-massive-1`
- `flows-retry-no-max-5` **Depends On** `code-exact-duplication-massive-1`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
