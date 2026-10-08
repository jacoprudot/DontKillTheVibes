# DontKillTheVibes — deterministic assessment

- target: `C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo`
- files scanned: 57 · test/spec/fixture files excluded: 8 · rules run: 136 · skipped (tool not implemented): 50
- overall health: **F·4** (worst-severity grade over detector findings; 4 critical)
- 30 detector finding(s) + 331 checklist gap(s) — an ausencia hit means a safeguard is MISSING, not that a violation was found
- every detector finding is a raw mechanical signal (label `probado`) — verify by hand (file:line) before acting; precision is NOT yet measured (see protocol in PLAN.md)

## Areas — what was assessed, and what was not

One row per assessment area (the skill modules; the rule-id prefixes of `skills/detectors.json`, which is also where every rule count below is read from). `det. runnable` = `detector` rules the runner executed · `det. blocked` = `detector` rules the runner could NOT execute (tool not implemented, or a spec this run refused) · `ausencia` = checklist rules · `juicio` = rules a model must decide (Fase 3 — no engine in this report) · `fuera` = declared out of scope · `findings`/`crit+high`/`gaps` = this run's output.

**A 0 in the findings column is a statement about the rules that RAN, never about the area.** Status rule: `SIN MOTOR` = zero runnable mechanical rules for the area (nothing was evaluated) · `PARCIAL` = the rules needing judgment or live data (`juicio` + `fuera`) are at least as many as the runnable mechanical ones · `CUBIERTA` = otherwise.

| area | status | rules | det. runnable | det. blocked | ausencia | juicio | fuera | findings | crit+high | gaps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `security` (security-assessment) | CUBIERTA | 45 | 16 | 9 | 3 | 17 | 0 | 3 | 3 | 0 |
| `database` (database-assessment) | PARCIAL | 32 | 7 | 0 | 7 | 9 | 9 | 2 | 2 | 103 |
| `performance` (performance-assessment) | PARCIAL | 71 | 2 | 0 | 8 | 32 | 29 | 0 | 0 | 70 |
| `structure` (structure-assessment) | PARCIAL | 29 | 7 | 1 | 0 | 21 | 0 | 0 | 0 | 0 |
| `code` (code-quality-assessment) | CUBIERTA | 59 | 27 | 18 | 2 | 12 | 0 | 23 | 5 | 20 |
| `flows` (flows-assessment) | CUBIERTA | 50 | 11 | 6 | 18 | 14 | 1 | 0 | 0 | 112 |
| `cost` (cost-analysis) | PARCIAL | 50 | 8 | 4 | 12 | 10 | 16 | 2 | 0 | 25 |
| `github` (github-intelligence) | PARCIAL | 32 | 8 | 11 | 1 | 1 | 11 | 0 | 0 | 1 |

Mechanical rules this run could not execute (named, never silent; the full engine record is under "Coverage vs baseline ruleset"): `security` refused spec: `security-secret-in-history-2` · `flows` 1 `ausencia` (missing tool: semgrep).

Zero-finding areas — a 0 is never a pass. Each line states how many rules RAN and found nothing, and how many were NOT EVALUATED, and why:

- performance — 0 findings across 10 rules that WERE evaluated · 70 checklist gaps · NOT EVALUATED: 61 of 71 rules (32 need judgment — Fase 3 has no engine · 29 are `fuera` — need runtime/live data) — the rest of the area was not assessed, so 0 findings is not a clean bill of health.
- structure — 0 findings across 7 rules that WERE evaluated · NOT EVALUATED: 22 of 29 rules (21 need judgment — Fase 3 has no engine · 1 blocked — tool not implemented: semgrep) — the rest of the area was not assessed, so 0 findings is not a clean bill of health.
- flows — 0 findings across 28 rules that WERE evaluated · 112 checklist gaps · NOT EVALUATED: 22 of 50 rules (14 need judgment — Fase 3 has no engine · 1 is `fuera` — need runtime/live data · 7 blocked — tool not implemented: git-log, semgrep) — the rest of the area was not assessed, so 0 findings is not a clean bill of health.
- github — 0 findings across 9 rules that WERE evaluated · 1 checklist gap · NOT EVALUATED: 23 of 32 rules (1 needs judgment — Fase 3 has no engine · 11 are `fuera` — need runtime/live data · 11 blocked — tool not implemented: git-log, github-api) — the rest of the area was not assessed, so 0 findings is not a clean bill of health.

## Coverage — what this run could actually see

A tool that audits code must never present partial coverage as complete. This block is the machine-readable `coverage` object in `findings.json`.

- non-binary files (scan candidates): **54** of 57 files in the tree (3 binary)
- matched by ≥1 rule path-glob: 49 · **matched by NO rule path-glob: 5** (9.3%)
  - not matched by any rule: `.eslintignore`, `.gitignore`, `.prettierignore`, `.prettierrc`, `Dockerfile`
- refused by read guards (content never reached a regex): 0 file(s) — named below
- **NOT EXAMINED by any regex rule: 5 of 54 (9.3%)** — 5 matched by no rule path-glob + 0 refused by a read guard; this is the number the health grade uses
- whole-tree rules (no path filter, or a catch-all glob like `**/*`: a secret/boilerplate scan touching every file is NOT language coverage): `code-boilerplate-repetition-7`, `flows-n8n-hardcoded-secrets-7`, `github-log-pattern-1`, `security-db-conn-string-6`, `security-oauth-secret-8`, `security-private-key-7`, `security-secret-in-code-1`
- extensions seen (files, uncovered by any rule): `.ts` 32 · `.json` 9 · `(none)` 5 (5 uncovered) · `.sql` 4 · `.js` 1 · `.md` 1 · `.prisma` 1 · `.toml` 1
- skipped by declared policy: gitignored 1 · test/spec/fixture 8 · binary 3
- skipped by read guards (named, never silent): 0
  - gitignored examples: `.vscode/extensions.json`
  - test/spec/fixture examples: `e2e/src/server/server.spec.ts`, `e2e/tsconfig.spec.json`, `src/tests/services/article.service.test.ts`, `src/tests/services/auth.service.test.ts`, `src/tests/services/profile.service.test.ts` … +3 more
- read-guard limits in force: whole-file regex content ≤ 262144 chars · line ≤ 2000 chars · reader cap 524288 bytes

## Rule failures (named, never silent)

None: every runnable rule ran to completion (136 run). Degraded tools (not implemented) are listed under the ruleset coverage below.

## Truncated counts (floors, not totals)

The engine stops collecting at 20 findings per rule (scripts/detect/matchers.mjs CAP). These rules stopped at the cap, so their real counts are HIGHER than what this report shows:

- **code-promise-chain-missing-catch-5** — stopped at cap 20; reported 20 (real count ≥ 20)
- **cost-api-no-retry-strategy-8** — stopped at cap 20; reported 20 (real count ≥ 20)
- **database-idle-timeout-missing-4** — stopped at cap 20; reported 20 (real count ≥ 20)
- **database-lock-timeout-missing-10** — stopped at cap 20; reported 20 (real count ≥ 20)
- **database-max-lifetime-missing-5** — stopped at cap 20; reported 20 (real count ≥ 20)
- **database-missing-bloat-monitoring-5** — stopped at cap 20; reported 20 (real count ≥ 20)
- **database-statement-timeout-missing-9** — stopped at cap 20; reported 20 (real count ≥ 20)
- **flows-message-schema-no-version-1** — stopped at cap 20; reported 20 (real count ≥ 20)
- **flows-missing-error-handler-5** — stopped at cap 20; reported 20 (real count ≥ 20)
- **flows-missing-request-id-7** — stopped at cap 20; reported 20 (real count ≥ 20)
- **flows-no-schema-registry-8** — stopped at cap 20; reported 20 (real count ≥ 20)
- **performance-no-circuit-breaker-4** — stopped at cap 20; reported 20 (real count ≥ 20)
- **performance-no-load-testing-3** — stopped at cap 20; reported 20 (real count ≥ 20)
- **performance-no-request-collapsing-4** — stopped at cap 20; reported 20 (real count ≥ 20)

## Work plan (30/60/90)

Bucketing is deterministic: critical+high → 30 days, medium → 60, low/info → 90; order inside a phase is severity × module weight.

### 30 days (10)

- **security-jwt-weak-3** [critical, effort XS, score 150] — src/app/routes/auth/auth.ts:16
- **security-jwt-weak-3** [critical, effort XS, score 150] — src/app/routes/auth/auth.ts:21
- **security-jwt-weak-3** [critical, effort XS, score 150] — src/app/routes/auth/token.utils.ts:4
- **code-extreme-complexity-1** [critical, effort L, score 100] — src/app/routes/article/article.service.ts
- **database-sequential-pagination-1** [high, effort S, score 65] — src/app/routes/article/article.service.ts:71
- **database-sequential-pagination-1** [high, effort S, score 65] — src/app/routes/article/article.service.ts:114
- **code-extreme-length-6** [high, effort L, score 50] — src/app/routes/article/article.controller.ts
- **code-extreme-length-6** [high, effort L, score 50] — src/app/routes/article/article.service.ts
- **code-extreme-length-6** [high, effort L, score 50] — src/app/routes/auth/auth.service.ts
- **code-high-complexity-2** [high, effort M, score 50] — src/app/routes/article/article.service.ts

### 60 days (9)

- **code-long-function-7** [medium, effort M, score 20] — src/app/routes/article/article.controller.ts
- **code-long-function-7** [medium, effort M, score 20] — src/app/routes/article/article.service.ts
- **code-long-function-7** [medium, effort M, score 20] — src/app/routes/auth/auth.service.ts
- **code-moderate-complexity-3** [medium, effort S, score 20] — src/app/routes/article/article.controller.ts
- **code-moderate-complexity-3** [medium, effort S, score 20] — src/app/routes/article/article.service.ts
- **code-moderate-complexity-3** [medium, effort S, score 20] — src/app/routes/auth/auth.service.ts
- **code-system-exit-misuse-5** [medium, effort M, score 20] — src/prisma/seed.ts:65
- **cost-unoptimized-images-8** [medium, effort M, score 16] — src/assets/images/demo-avatar.png
- **cost-unoptimized-images-8** [medium, effort M, score 16] — src/assets/images/smiley-cyrus.jpeg

### 90 days (11)

- **code-console-log-7** [low, effort S, score 5] — src/main.ts:56
- **code-exact-duplication-minor-3** [low, effort S, score 5] — src/app/routes/article/article.service.ts:83
- **code-medium-length-8** [low, effort S, score 5] — src/app/routes/article/article.controller.ts
- **code-medium-length-8** [low, effort S, score 5] — src/app/routes/article/article.service.ts
- **code-medium-length-8** [low, effort S, score 5] — src/app/routes/auth/auth.controller.ts
- **code-medium-length-8** [low, effort S, score 5] — src/app/routes/auth/auth.service.ts
- **code-medium-length-8** [low, effort S, score 5] — src/app/routes/profile/profile.controller.ts
- **code-medium-length-8** [low, effort S, score 5] — src/app/routes/profile/profile.service.ts
- **code-medium-length-8** [low, effort S, score 5] — src/main.ts
- **code-medium-length-8** [low, effort S, score 5] — src/prisma/seed.ts
- **code-multiple-return-points-12** [low, effort S, score 5] — src/app/routes/article/article.service.ts

## Findings — critical & high (10), grouped by file

### `src/app/routes/article/article.controller.ts` (1)

- **code-extreme-length-6** [high, effort L] — 244 lines (max 150)
  Remediation: Split into presentational and container components — rule: skills/code-quality-assessment.skill.md

### `src/app/routes/article/article.service.ts` (5)

- **code-extreme-complexity-1** [critical, effort L] — heuristic cyclomatic ≈ 26 (max 20); file-level approximation, not per-function
  Remediation: Break into smaller functions: validateOrder, calculateTax, applyDiscounts — rule: skills/code-quality-assessment.skill.md
- **database-sequential-pagination-1** [high, effort S] line 71 — const articlesCount = await prisma.article.count({
  Remediation: Run both queries concurrently: const [count, rows] = await Promise.all([countQuery, listQuery]) — rule: skills/database-assessment.skill.md
- **database-sequential-pagination-1** [high, effort S] line 114 — const articlesCount = await prisma.article.count({
  Remediation: Run both queries concurrently: const [count, rows] = await Promise.all([countQuery, listQuery]) — rule: skills/database-assessment.skill.md
- **code-extreme-length-6** [high, effort L] — 653 lines (max 150)
  Remediation: Split into presentational and container components — rule: skills/code-quality-assessment.skill.md
- **code-high-complexity-2** [high, effort M] — heuristic cyclomatic ≈ 26 (max 15); file-level approximation, not per-function
  Remediation: Extract password validation and session creation to separate functions — rule: skills/code-quality-assessment.skill.md

### `src/app/routes/auth/auth.service.ts` (1)

- **code-extreme-length-6** [high, effort L] — 184 lines (max 150)
  Remediation: Split into presentational and container components — rule: skills/code-quality-assessment.skill.md

### `src/app/routes/auth/auth.ts` (2)

- **security-jwt-weak-3** [critical, effort XS] line 16 — secret: process.env.JWT_SECRET || 'superSecret',
  Remediation: Use strong random secret (minimum 32 bytes) from secure source — rule: skills/security-assessment.skill.md
- **security-jwt-weak-3** [critical, effort XS] line 21 — secret: process.env.JWT_SECRET || 'superSecret',
  Remediation: Use strong random secret (minimum 32 bytes) from secure source — rule: skills/security-assessment.skill.md

### `src/app/routes/auth/token.utils.ts` (1)

- **security-jwt-weak-3** [critical, effort XS] line 4 — jwt.sign({ user: { id } }, process.env.JWT_SECRET || 'superSecret', {
  Remediation: Use strong random secret (minimum 32 bytes) from secure source — rule: skills/security-assessment.skill.md

## Appendix: medium / low / info (20)

One line each, priority order. These are signals, not the plan — verify before acting.

- **code-long-function-7** [medium]
  - src/app/routes/article/article.controller.ts — 244 lines (max 100)
  - src/app/routes/article/article.service.ts — 653 lines (max 100)
  - src/app/routes/auth/auth.service.ts — 184 lines (max 100)
- **code-moderate-complexity-3** [medium]
  - src/app/routes/article/article.controller.ts — heuristic cyclomatic ≈ 12 (max 10); file-level approximation, not per-function
  - src/app/routes/article/article.service.ts — heuristic cyclomatic ≈ 26 (max 10); file-level approximation, not per-function
  - src/app/routes/auth/auth.service.ts — heuristic cyclomatic ≈ 11 (max 10); file-level approximation, not per-function
- **code-system-exit-misuse-5** [medium]
  - src/prisma/seed.ts:65 — process.exit(1);
- **cost-unoptimized-images-8** [medium]
  - src/assets/images/demo-avatar.png — file exists in repo
  - src/assets/images/smiley-cyrus.jpeg — file exists in repo
- **code-console-log-7** [low]
  - src/main.ts:56 — console.info(`server up on port ${PORT}`);
- **code-exact-duplication-minor-3** [low]
  - src/app/routes/article/article.service.ts:83 — block of 400+ chars repeated at offset 1701 and 2685
- **code-medium-length-8** [low]
  - src/app/routes/article/article.controller.ts — 244 lines (max 50)
  - src/app/routes/article/article.service.ts — 653 lines (max 50)
  - src/app/routes/auth/auth.controller.ts — 71 lines (max 50)
  - src/app/routes/auth/auth.service.ts — 184 lines (max 50)
  - src/app/routes/profile/profile.controller.ts — 68 lines (max 50)
  - src/app/routes/profile/profile.service.ts — 61 lines (max 50)
  - src/main.ts — 58 lines (max 50)
  - src/prisma/seed.ts — 67 lines (max 50)
- **code-multiple-return-points-12** [low]
  - src/app/routes/article/article.service.ts — 10 occurrences (max 6)

## Checklist gaps — ausencia checks (331)

These prove a safeguard is MISSING (a timeout, a budget, a monitor). They are not violations and carry no severity: a missing thing is missing in every repo until it isn't. Grouped by rule; fix is "add the safeguard", no per-finding prompt needed.

### code-promise-chain-missing-catch-5 (promise_chain_missing_catch) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Always terminate promise chains with .catch() or use try/catch with async/await

### cost-api-no-retry-strategy-8 (no_api_error_retry_strategy) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Implement retry strategy with exponential backoff and jitter

### database-idle-timeout-missing-4 (idle_timeout_not_configured) — 20 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/jest.config.ts`, `e2e/project.json`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `e2e/tsconfig.json` … +12 more

Add: Set appropriate idle connection timeout (e.g., 300 seconds)

### database-lock-timeout-missing-10 (lock_timeout_not_configured) — 20 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/jest.config.ts`, `e2e/project.json`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `e2e/tsconfig.json` … +12 more

Add: Set lock_timeout to prevent indefinite blocking (e.g., 1000ms)

### database-max-lifetime-missing-5 (max_lifetime_not_configured) — 20 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/jest.config.ts`, `e2e/project.json`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `e2e/tsconfig.json` … +12 more

Add: Set maximum connection lifetime to prevent resource leaks (e.g., 3600s)

### database-missing-bloat-monitoring-5 (missing_pg_bloat_monitoring) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Install pg_extension or schedule regular bloat reports

### database-statement-timeout-missing-9 (statement_timeout_not_configured) — 20 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/jest.config.ts`, `e2e/project.json`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `e2e/tsconfig.json` … +12 more

Add: Set statement_timeout to prevent runaway queries (e.g., 5000ms)

### flows-message-schema-no-version-1 (message_schema_no_versioning) — 20 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/jest.config.ts`, `e2e/project.json`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `e2e/tsconfig.json` … +12 more

Add: Add version field to message schema and support multiple versions

### flows-missing-error-handler-5 (no_global_error_handler) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Add global error handling middleware to catch and format errors

### flows-missing-request-id-7 (no_request_id_middleware) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Add request ID middleware for tracing requests across services

### flows-no-schema-registry-8 (no_schema_registry_for_events) — 20 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/jest.config.ts`, `e2e/project.json`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `e2e/tsconfig.json` … +12 more

Add: Use schema registry (Confluent, AWS Glue) for version control and validation

### performance-no-circuit-breaker-4 (no_circuit_breaker_for_external_calls) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Implement circuit breaker pattern (Hystrix, resilience4j, oxyd)

### performance-no-load-testing-3 (no_load_testing_strategy) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Implement regular load testing (monthly or quarterly) as part of CI/CD

### performance-no-request-collapsing-4 (no_request_collapsing) — 20 file(s)

Missing in: `e2e/jest.config.ts`, `e2e/src/support/global-setup.ts`, `e2e/src/support/global-teardown.ts`, `e2e/src/support/test-setup.ts`, `jest.config.ts`, `jest.preset.js`, `src/app/models/http-exception.model.ts`, `src/app/routes/article/article.controller.ts` … +12 more

Add: Implement request collapsing or deduplication at edge or service level

### performance-no-tech-debt-alloc-9 (no_technical_debt_allocation) — 10 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package.json`, `project.json`, `README.md` … +2 more

Add: Allocate sprint capacity (e.g., 20%) for performance improvements

### flows-n8n-no-error-handling-1 (n8n_workflow_has_no_error_trigger) — 9 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package.json`, `project.json`, `tsconfig.app.json` … +1 more

Add: Add error trigger node connected to notification/escalation flow

### flows-n8n-no-retry-5 (n8n_workflow_no_retry_on_failed_nodes) — 9 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package.json`, `project.json`, `tsconfig.app.json` … +1 more

Add: Enable retry on failed nodes with appropriate backoff

### flows-n8n-no-timeout-4 (n8n_workflow_missing_timeout_handling) — 9 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package.json`, `project.json`, `tsconfig.app.json` … +1 more

Add: Set reasonable timeout values on all HTTP Request nodes

### database-missing-index-fk-1 (foreign_key_column) — 3 file(s)

Missing in: `src/prisma/migrations/20211105153605_api_url/migration.sql`, `src/prisma/migrations/20211221184529_deprecated_preview/migration.sql`, `src/prisma/schema.prisma`

Add: CREATE INDEX idx_orders_user_id ON orders(user_id);

### cost-dev-setup-missing-3 (no_local_development_setup) — 1 file(s)

Missing in: `(repo root)`

Add: Provide docker-compose or similar for local development

### cost-license-attribution-missing-2 (license_requires_attribution_missing) — 1 file(s)

Missing in: `README.md`

Add: Add required attribution to documentation and/about page

### cost-no-license-tracking-5 (no_license_compliance_tracking) — 1 file(s)

Missing in: `(repo root)`

Add: Implement automated license compliance checking (FOSSA, Snyk License)

### cost-no-oss-policy-9 (no_open_source_license_policy) — 1 file(s)

Missing in: `(repo root)`

Add: Create and implement open source use policy

### cost-no-performance-budget-10 (no_performance_budgeting) — 1 file(s)

Missing in: `(repo root)`

Add: Establish performance budgets and monitor against them

### flows-missing-circuit-breaker-7 (no_circuit_breaker_for_external_calls) — 1 file(s)

Missing in: `package.json`

Add: Implement circuit breaker pattern to fail fast when service is unhealthy

### flows-missing-rate-limit-8 (no_rate_limiting_on_public_endpoints) — 1 file(s)

Missing in: `package.json`

Add: Add rate limiting middleware to prevent abuse and exhaustion

### flows-missing-security-headers-10 (no_security_headers) — 1 file(s)

Missing in: `package.json`

Add: Add security headers middleware (HSTS, CSP, X-Frame-Options, etc)

### flows-no-state-persistence-6 (no_state_persistence_or_hydration) — 1 file(s)

Missing in: `package.json`

Add: Implement state persistence to localStorage or sessionStorage

### flows-no-time-travel-9 (no_time_travel_debugging) — 1 file(s)

Missing in: `package.json`

Add: Enable Redux DevTools or equivalent for time-travel debugging

### github-log-pattern-9 (no) — 1 file(s)

Missing in: `(repo root)`

Add: Treat as an observability gap only after confirming the deployment does not log elsewhere

## Coverage vs baseline ruleset (paso D)

- Canonical registry: 368 rules
- Mechanical (detector/ausencia): 186 — fired: 43 · ran clean: 93 · not runnable yet (tool degraded, listed in findings.json): 50 · failed (error/budget): 0
- Findings per rule are capped at 20: 14 rule(s) stopped at the cap (their counts are floors)
- `juicio`: 116 — not evaluated by this engine (Fase 3; would carry label `juzgado`)
- `fuera`: 66 — out of scope by design

Degraded tools (named, never silent): code-bare-except-1 (semgrep), code-bare-except-with-others-2 (semgrep), code-boolean-parameter-plague-11 (semgrep), code-callback-hell-10 (semgrep), code-catch-and-continue-9 (semgrep), code-deep-inheritance-9 (semgrep), code-error-assigned-unused-2 (semgrep), code-extreme-nesting-4 (semgrep), code-high-nesting-5 (semgrep), code-loose-equality-1 (semgrep), code-loose-inequality-2 (semgrep), code-missing-error-main-10 (semgrep), code-nested-ternary-9 (semgrep), code-print-statement-5 (semgrep), code-print-statement-8 (semgrep), code-slice-append-in-loop-6 (semgrep), code-unchecked-error-1 (semgrep), code-var-usage-3 (semgrep), cost-deprecated-version-10 (osv-scanner), cost-license-incompatible-1 (license-scan), cost-license-share-alike-3 (license-scan), cost-non-commercial-use-6 (license-scan), flows-error-leaks-stack-6 (semgrep), flows-fire-and-forget-critical-1 (semgrep), flows-message-breaking-schema-2 (git-log), flows-missing-timeout-6 (semgrep), flows-ngrx-selectors-not-memoized-4 (semgrep), flows-redux-mutates-state-1 (semgrep), flows-redux-side-effects-2 (semgrep), github-commit-history-1 (git-log), github-commit-history-10 (git-log), github-commit-history-2 (git-log), github-commit-history-3 (git-log), github-commit-history-4 (git-log), github-commit-history-5 (git-log), github-commit-history-6 (git-log), github-commit-history-7 (git-log), github-commit-history-8 (git-log), github-commit-history-9 (git-log), github-issue-health-12 (github-api), security-cve-critical-1 (osv-scanner), security-cve-high-2 (osv-scanner), security-cve-medium-3 (osv-scanner), security-exploit-in-wild-5 (osv-scanner), security-license-incompatible-6 (license-scan), security-no-security-maintenance-7 (osv-scanner), security-secret-in-history-2 (gitleaks), security-transitive-vuln-8 (osv-scanner), security-unmaintained-dep-4 (osv-scanner), structure-singleton-violation-5 (semgrep)
