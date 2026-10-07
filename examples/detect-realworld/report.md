# DontKillTheVibes — deterministic assessment

- target: `C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\work\realworld-control`
- files scanned: 58 · test/spec/fixture files excluded: 8 · rules run: 136 · skipped (tool not implemented): 50
- overall health: **F·4** (worst-severity grade over detector findings; 4 critical)
- 30 detector finding(s) + 335 checklist gap(s) — an ausencia hit means a safeguard is MISSING, not that a violation was found
- every detector finding is a raw mechanical signal (label `probado`) — verify by hand (file:line) before acting; precision is NOT yet measured (see protocol in PLAN.md)

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

## Checklist gaps — ausencia checks (335)

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

### performance-no-tech-debt-alloc-9 (no_technical_debt_allocation) — 11 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package-lock.json`, `package.json`, `project.json` … +3 more

Add: Allocate sprint capacity (e.g., 20%) for performance improvements

### flows-n8n-no-error-handling-1 (n8n_workflow_has_no_error_trigger) — 10 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package-lock.json`, `package.json`, `project.json` … +2 more

Add: Add error trigger node connected to notification/escalation flow

### flows-n8n-no-retry-5 (n8n_workflow_no_retry_on_failed_nodes) — 10 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package-lock.json`, `package.json`, `project.json` … +2 more

Add: Enable retry on failed nodes with appropriate backoff

### flows-n8n-no-timeout-4 (n8n_workflow_missing_timeout_handling) — 10 file(s)

Missing in: `.eslintrc.json`, `e2e/.eslintrc.json`, `e2e/project.json`, `e2e/tsconfig.json`, `nx.json`, `package-lock.json`, `package.json`, `project.json` … +2 more

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
- Mechanical (detector/ausencia): 186 — fired: 43 · ran clean: 93 · not runnable yet (tool degraded, listed in findings.json): 50
- `juicio`: 116 — not evaluated by this engine (Fase 3; would carry label `juzgado`)
- `fuera`: 66 — out of scope by design

Degraded tools (named, never silent): code-bare-except-1 (semgrep), code-bare-except-with-others-2 (semgrep), code-boolean-parameter-plague-11 (semgrep), code-callback-hell-10 (semgrep), code-catch-and-continue-9 (semgrep), code-deep-inheritance-9 (semgrep), code-error-assigned-unused-2 (semgrep), code-extreme-nesting-4 (semgrep), code-high-nesting-5 (semgrep), code-loose-equality-1 (semgrep), code-loose-inequality-2 (semgrep), code-missing-error-main-10 (semgrep), code-nested-ternary-9 (semgrep), code-print-statement-5 (semgrep), code-print-statement-8 (semgrep), code-slice-append-in-loop-6 (semgrep), code-unchecked-error-1 (semgrep), code-var-usage-3 (semgrep), cost-deprecated-version-10 (osv-scanner), cost-license-incompatible-1 (license-scan), cost-license-share-alike-3 (license-scan), cost-non-commercial-use-6 (license-scan), flows-error-leaks-stack-6 (semgrep), flows-fire-and-forget-critical-1 (semgrep), flows-message-breaking-schema-2 (git-log), flows-missing-timeout-6 (semgrep), flows-ngrx-selectors-not-memoized-4 (semgrep), flows-redux-mutates-state-1 (semgrep), flows-redux-side-effects-2 (semgrep), github-commit-history-1 (git-log), github-commit-history-10 (git-log), github-commit-history-2 (git-log), github-commit-history-3 (git-log), github-commit-history-4 (git-log), github-commit-history-5 (git-log), github-commit-history-6 (git-log), github-commit-history-7 (git-log), github-commit-history-8 (git-log), github-commit-history-9 (git-log), github-issue-health-12 (github-api), security-cve-critical-1 (osv-scanner), security-cve-high-2 (osv-scanner), security-cve-medium-3 (osv-scanner), security-exploit-in-wild-5 (osv-scanner), security-license-incompatible-6 (license-scan), security-no-security-maintenance-7 (osv-scanner), security-secret-in-history-2 (gitleaks), security-transitive-vuln-8 (osv-scanner), security-unmaintained-dep-4 (osv-scanner), structure-singleton-violation-5 (semgrep)
