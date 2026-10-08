# Canonical rule catalog

> **GENERATED FILE — DO NOT EDIT BY HAND.** Every line below is produced from
> the canonical sources; a hand edit is silently overwritten on the next run and
> fails `node scripts/gen-rules-doc.mjs --check`. To change a rule, change the skill or
> `skills/detectors.json`, then regenerate.

- **Regenerate with:** `node scripts/gen-rules-doc.mjs`
- **Verify the file is up to date:** `node scripts/gen-rules-doc.mjs --check` (exit 1 when stale)
- **Ruleset fingerprint:** `368-6e180554` — from `rulesetFingerprint()` in `scripts/lib/canonical-registry.mjs`: `<count>-<sha256(id|severity|effort)>`, so any added, removed, reclassified or re-scored rule changes it.
- **Generation date:** 2026-10-08 — from UTC clock (pin with `--date=` or `SOURCE_DATE_EPOCH`). Regeneration is otherwise deterministic: the registry has 368 rules in 8 areas, of which **49 are `proven`** (fixture-gated) and **319 are `declared`** (asserted, no fixture).
- **Sources (one source of truth per field — no second parser, no second list):**
  - `skills/*.skill.md` → rule id, severity, effort, deprecation (`loadRules()` in `scripts/lib/canonical-registry.mjs`) and the verbatim condition / remediation text (`loadSkillMetadata()` in `scripts/lib/skill-metadata.mjs`).
  - `skills/detectors.json` → `type`, `tool`, `spec` (the single source for these three).
  - `scripts/detect/engine.mjs` → `DEGRADED_TOOLS`, the tools this runner does NOT implement.
  - `scripts/lib/module-weights.mjs` → the area weights used for ordering, and the human label per area.
  - `templates/finding-schema.json` → the severity ordering (`critical` → `info`).
  - `tests/fixtures/detectors/<rule-id>/positive/` + `.../negative/` → the `proven` / `declared` marker: a rule is `proven` only when both directories exist and each holds at least one file. Read from the filesystem at generation time — no rule id and no count is hardcoded, so adding a fixture changes the catalog on the next run.
  - The area list itself is derived at generation time from the rule-id prefixes of `skills/detectors.json`; nothing above hardcodes a count, an area, a tool or a proven rule.

## How to read this catalog

Every canonical rule appears exactly once, under its area, with the status the
deterministic runner would give it **today**:

| status | meaning |
| --- | --- |
| `runnable` | a `detector` rule whose tool this runner implements — it can fire today |
| `blocked` | a `detector` rule whose tool this runner does NOT implement (`DEGRADED_TOOLS`) — it can never fire today |
| `ausencia` | a checklist / absence check: a hit proves a safeguard is MISSING, not that a violation was found |
| `juicio` | needs a model to decide a closed question (Fase 3 — no engine exists) — NOT enforced today |
| `fuera` | declared out of scope by design — never enforced |

- The `provenance` column is the audit column: **`proven` = demonstrated, `declared` = only asserted.** A rule is `proven` when `tests/fixtures/detectors/<rule-id>/positive/` and `.../negative/` both exist and are non-empty on disk — the evidence `node scripts/detect/test-fixtures.mjs` needs to show the rule fires on what it targets and stays silent on what it should not flag. A rule with no fixture, or with only one side, is `declared`: an untested assertion. The marker is read from disk at generation time; nothing here lists which rules are proven.
- `blocked`, `juicio` and `fuera` rules are **not enforced today**. They are listed so the claim is reviewable, not to imply coverage.
- An `ausencia` rule runs, but a hit only proves that a safeguard is **missing**; it never proves a violation. `ausencia` rules whose tool is not implemented are marked `(not implemented)` and can never fire.
- The raw `spec` is shown for `detector` rules only, verbatim from `skills/detectors.json` (one line, in a code span). Specifications are structural declarations and stay **provisional** until their positive/negative fixtures pass (PLAN.md Fase 1) — `node scripts/gen-rules-doc.mjs` does not judge whether a spec is a *good* detector for its rule.
- 8 rule(s) carry no `IF <name>` token: their skill states the condition in prose (usually inside backticks, e.g. “IF `==` used instead of `===`”), which the shared skill parser does not turn into a name, so the condition column shows — rather than an invented label. The remediation text and the owning skill file are still shown.
- A `deprecated` rule is kept (never deleted) so past reports keep resolving. It stays listed with its current classification, marked `deprecated → <successor>`.

## Summary — the 8 assessment areas

One row per area. This is the first question to ask of the ruleset: **how much of
each area can actually fire today?** `det. runnable` is that number; everything
else is either blocked, checklist-only, or waiting on a model.

The second question is the audit question: **how much of each area has been
demonstrated rather than merely asserted?** `proven / declared` answers it —
`proven` rules carry a non-empty positive **and** negative fixture set on disk,
`declared` rules carry none.

| area | rules | proven / declared | det. runnable | det. blocked | ausencia | juicio | fuera | % enforced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [`security`](#security--security-assessment) — security-assessment (weight 1.5) | 45 | 17 / 28 | 17 | 8 | 3 | 17 | 0 | 38% |
| [`database`](#database--database-assessment) — database-assessment (weight 1.3) | 32 | 3 / 29 | 7 | 0 | 7 | 9 | 9 | 22% |
| [`performance`](#performance--performance-assessment) — performance-assessment (weight 1.2) | 71 | 0 / 71 | 2 | 0 | 8 | 32 | 29 | 3% |
| [`structure`](#structure--structure-assessment) — structure-assessment (weight 1.1) | 29 | 2 / 27 | 7 | 1 | 0 | 21 | 0 | 24% |
| [`code`](#code--code-quality-assessment) — code-quality-assessment (weight 1.0) | 59 | 12 / 47 | 26 | 18 | 2 | 13 | 0 | 44% |
| [`flows`](#flows--flows-assessment) — flows-assessment (weight 1.0) | 50 | 3 / 47 | 12 | 5 | 18 | 14 | 1 | 24% |
| [`cost`](#cost--cost-analysis) — cost-analysis (weight 0.8) | 50 | 2 / 48 | 8 | 4 | 12 | 10 | 16 | 16% |
| [`github`](#github--github-intelligence) — github-intelligence (weight 0.7) | 32 | 10 / 22 | 18 | 1 | 1 | 1 | 11 | 56% |
| **TOTAL** | **368** | **49 / 319** | **97** | **37** | **51** | **117** | **66** | **26%** |

- The area totals sum to the registry total (45 + 32 + 71 + 29 + 59 + 50 + 50 + 32 = 368), and the type columns sum to it as well: `detector` 134 (runnable 97 + blocked 37) + `ausencia` 51 + `juicio` 117 + `fuera` 66 = 368.
- `proven / declared` splits every area by the evidence on disk: `proven` = a non-empty `tests/fixtures/detectors/<rule-id>/positive/` **and** `.../negative/`, `declared` = no such pair, so the two numbers always sum to `rules`. It is independent of `det. runnable`: one is about tested evidence, the other about which tool this runner implements.
- **Audit headline: 49 of 368 rules (13%) are `proven` — demonstrated by fixtures — and 319 (87%) are `declared`, asserted with no fixture.** Run `node scripts/detect/test-fixtures.mjs` to execute the gate those 49 evidence sets feed.
- `% enforced` = `det. runnable ÷ rules`: the share of the area whose violations a deterministic detector can *prove* today. `ausencia` rules also execute but are excluded here, because they prove only the absence of a guard.
- **26% of the ruleset (97 of 368) is runnable by the deterministic engine today.** 37 `detector` rules are blocked by an unimplemented tool, 51 are checklist checks, 117 need a model (Fase 3) and 66 are declared out of scope.
- Areas are ordered by module weight — the same weights the work plan orders by — read live from `scripts/lib/module-weights.mjs`, whose source line is: `security: 1.5, database: 1.3, performance: 1.2, structure: 1.1, flows: 1.0, code: 1.0, cost: 0.8, github: 0.7`.
- Of the 51 `ausencia` checks, 1 also needs a tool this runner does not implement (semgrep) and can never fire today.

## security — security-assessment

- **Skill source:** `skills/security-assessment.skill.md`
- **Rules:** 45 — `detector` 25 (runnable 17, blocked 8) · `ausencia` 3 · `juicio` 17 · `fuera` 0
- **Demonstrated:** 17 of 45 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 28 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 17 of 45 rules run (38%). The other 28: 8 blocked `detector` rules — tool not implemented (license-scan, osv-scanner) · 3 checklist-only rules · 17 rules needing judgment (Fase 3) · 0 rules out of scope.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `security-cve-critical-1` | `blocked` | `declared` | `critical` | `S` | `CVE_critical_in_prod_dependency` | `Update to lodash 4.17.21 or later` | `osv-scanner` (not implemented) — `{"severity_min":"CRITICAL"}` |
| `security-encryption-weak-5` | `juicio` | `declared` | `critical` | `XS` | `encryption_key_weak_or_short` | `Use proper key length (16, 24, or 32 bytes for AES) from secure random source` | — |
| `security-exploit-in-wild-5` | `blocked` | `declared` | `critical` | `S` | `dependency_with_known_exploit_in_wild` | `Update to Log4j 2.17.0 or later immediately` | `osv-scanner` (not implemented) — `{"kev_only":true}` |
| `security-gha-pr-target-risk-1` | `runnable` | `proven` | `critical` | `S` | `workflow_uses_pull_request_target_with_checkout` | `Never use pull_request_target with checkout - allows fork PRs to write to base repo` | `yaml-check` — `{"file_glob":".github/workflows/*.y*ml","check":"presence","pattern":"pull_request_target[\\s\\S]{0,400}(actions/checkout\|secrets\\.)"}` |
| `security-gha-secret-leak-3` | `runnable` | `proven` | `critical` | `XS` | `secret_used_in_log_output` | `Never echo secrets; use masking or avoid logging altogether` | `yaml-check` — `{"file_glob":".github/workflows/*.y*ml","check":"presence","pattern":"run:[^\\n]*\\{\\{[^}]*\\bsecrets\\."}` |
| `security-jwt-weak-3` | `runnable` | `proven` | `critical` | `XS` | `jwt_secret_default_or_short` | `Use strong random secret (minimum 32 bytes) from secure source` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"JWT[_-]?SECRET['\"]?\\s*\\)?\\s*(?:\\\|\\\|\|\\?\\?)\\s*['\"][^'\"]+['\"]\|JWT[_-]?SECRET['\"]?\\s*[:=]\\s*['\"][^'\"]+['\"]","path_glob":"**/*.{ts,tsx,js,jsx,mjs,cjs,cts,mts}"}}` |
| `security-logs-contain-secrets-12` | `juicio` | `declared` | `critical` | `XS` | `logs_contain_sensitive_information` | `Never log credentials, tokens, or PII; use masking if absolutely needed` | — |
| `security-oauth-secret-8` | `runnable` | `proven` | `critical` | `XS` | `oauth_token_or_secret_in_code` | `Use OAuth app credentials stored securely; never commit personal tokens` | `gitleaks` — `{"regex":"(?i:(client[_-]?secret\|oauth[_-]?(secret\|token))\\s*[:=]\\s*['\"][^'\"]{8,}['\"])"}` |
| `security-password-weak-5` | `juicio` | `declared` | `critical` | `M` | `password_storage_weak` | `Use bcrypt, scrypt, or Argon2 with appropriate salt` | — |
| `security-private-key-7` | `runnable` | `proven` | `critical` | `XS` | `private_key_in_code` | `Store private key in secrets manager; never commit to repository` | `gitleaks` — `{"regex":"-----BEGIN (RSA \|EC \|OPENSSH \|PGP )?PRIVATE KEY( BLOCK)?-----","keywords":["PRIVATE KEY"]}` |
| `security-secret-in-code-1` | `runnable` | `proven` | `critical` | `XS` | `api_key_pattern` | `Remove key and rotate immediately; use environment variables or secrets manager` | `gitleaks` — `{"regex":"(?i:(api[_-]?key\|secret\|token\|password\|passwd\|pwd)\\s*[:=]\\s*['\"]?[A-Za-z0-9_\\-/+=]{16,}['\"]?)","keywords":["key","secret","token","password"]}` |
| `security-secret-in-history-2` | `runnable` | `proven` | `critical` | `S` | `secret_in_git_history` | `Rotate secret immediately; consider git history rewrite if extremely sensitive` | `gitleaks` — `{"regex":"(?i:(api[_-]?key\|secret\|token\|password\|passwd\|pwd)\\s*[:=]\\s*['\"]?[A-Za-z0-9_\\-/+=]{16,}['\"]?)","path_regex":"\\.git/"}` |
| `security-cve-high-2` | `blocked` | `declared` | `high` | `S` | `CVE_high_in_prod_dependency` | `Update to express 4.18.2 or later` | `osv-scanner` (not implemented) — `{"severity_min":"HIGH"}` |
| `security-db-conn-string-6` | `runnable` | `proven` | `high` | `XS` | `database_connection_string_in_code` | `Use environment variables: process.env.DATABASE_URL` | `gitleaks` — `{"regex":"(postgres(ql)?\|mysql\|mariadb\|mongodb(\\+srv)?\|redis\|amqp)://[^\\s'\"]+:[^\\s'\"]+@","keywords":["postgres://","mysql://","mongodb","redis://"]}` |
| `security-db-no-tls-11` | `juicio` | `declared` | `high` | `M` | `database_connection_no_encryption` | `Enable TLS/SSL for database connections` | — |
| `security-debug-in-prod-1` | `runnable` | `proven` | `high` | `XS` | `debug_mode_enabled_in_prod` | `Disable debug mode in production; use separate development configuration` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:(app\\.debug\\s*=\\s*True\|DEBUG\\s*=\\s*['\"]?1\|NEXT_PUBLIC_[A-Z_]*DEBUG))","path_glob":"**/*.{py,js,ts,env,yaml,yml}"}}` |
| `security-env-file-committed-3` | `runnable` | `proven` | `high` | `XS` | — | `Add .env to .gitignore and remove from history using git filter-repo` | `node-matcher` — `{"matcher":"file-presence","params":{"path_glob":"**/.env*","exclude_glob":"**/.env.{example,sample,template}"}}` |
| `security-file-upload-weak-7` | `juicio` | `declared` | `high` | `M` | `file_upload_validation_missing` | `Validate file type, size, and content; restrict to safe extensions` | — |
| `security-gha-auto-deploy-prod-9` | `juicio` | `declared` | `high` | `M` | `deployment_to_production_on_merge` | `Require manual approval or feature flags for production deployment` | — |
| `security-gha-overpermissive-2` | `runnable` | `proven` | `high` | `XS` | `workflow_permissions_not_restricted` | `Follow principle of least permission: specify exact permissions needed` | `yaml-check` — `{"file_glob":".github/workflows/*.y*ml","check":"presence","pattern":"permissions:\\s*write-all"}` |
| `security-no-input-validation-14` | `juicio` | `declared` | `high` | `M` | `no_input_validation_at_boundaries` | `Implement comprehensive input validation at all trust boundaries` | — |
| `security-weak-crypto-9` | `juicio` | `declared` | `high` | `M` | `encryption_algorithm_weak` | `Use bcrypt, scrypt, or Argon2 for password hashing` | — |
| `security-binary-dep-10` | `runnable` | `proven` | `medium` | `M` | `binary_dependency_without_source` | `Prefer source-based dependencies or verify binary integrity` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:(preinstall\|install\|postinstall)\"?\\s*:\\s*\"[^\"]*\\b(curl\|wget\|bash\|\\.sh)\\b)","path_glob":"**/package.json"}}` |
| `security-cors-wildcard-2` | `runnable` | `proven` | `medium` | `XS` | `cors_allows_all_origins` | `Restrict origins to specific domains: ['https://app.example.com']` | `node-matcher` — `{"matcher":"cors-wildcard","params":{"path_glob":"**/*.{ts,js,py,go,java}"}}` |
| `security-cve-medium-3` | `blocked` | `declared` | `medium` | `S` | `CVE_medium_in_prod_dependency` | `Update to jquery 3.5.0 or later` | `osv-scanner` (not implemented) — `{"severity_min":"MEDIUM"}` |
| `security-directory-listing-8` | `juicio` | `declared` | `medium` | `XS` | `directory_listing_enabled` | `Disable directory listing in web server configuration` | — |
| `security-gha-action-unpinned-5` | `runnable` | `proven` | `medium` | `M` | `action_not_pinned_to_version` | `Pin actions to specific version SHA to prevent supply chain attacks` | `yaml-check` — `{"file_glob":".github/workflows/*.y*ml","check":"presence","pattern":"uses:\\s*(?!actions/)[^@\\s]+/[^@\\s]+@(main\|master\|v\\d+)\\s*$"}` |
| `security-gha-fork-pr-4` | `runnable` | `proven` | `medium` | `M` | `workflow_runs_on_fork_pull_requests` | `Use pull_request instead of pull_request_target for fork safety` | `yaml-check` — `{"file_glob":".github/workflows/*.y*ml","check":"presence","pattern":"pull_request_target[\\s\\S]{0,300}secrets\\."}` |
| `security-gha-job-no-timeout-7` | `ausencia` | `declared` | `medium` | `M` | `job_without_timeout` | `Set reasonable timeout values for all jobs` | `yaml-check` |
| `security-gha-no-concurrency-prod-10` | `juicio` | `declared` | `medium` | `M` | `no_concurrency_control_for_production` | `Use concurrency: group: production to prevent concurrent deployments` | — |
| `security-gha-no-container-8` | `juicio` | `declared` | `medium` | `M` | `container_not_used_for_isolation` | `Use container: directive to isolate jobs from runner and each other` | — |
| `security-gha-workspace-not-cleaned-6` | `runnable` | `proven` | `medium` | `M` | `workspace_not_cleaned` | `Add cleanup step or use container jobs that discard workspace` | `yaml-check` — `{"file_glob":".github/workflows/*.y*ml","check":"presence","pattern":"persist-credentials:\\s*true"}` |
| `security-key-rotation-manual-13` | `juicio` | `declared` | `medium` | `M` | `encryption_keys_rotated_manually` | `Implement automated key rotation schedule and process` | — |
| `security-license-incompatible-6` | `blocked` | `declared` | `medium` | `M` | `license_incompatible_with_commercial_use` | `Replace with permissive-licensed alternative or comply with GPL obligations` | `license-scan` (not implemented) — `{"allowlist":["MIT","BSD-2-Clause","BSD-3-Clause","Apache-2.0","ISC","CC0-1.0","Unlicense","0BSD","Python-2.0","Zlib"]}` |
| `security-missing-headers-10` | `juicio` | `declared` | `medium` | `S` | `missing_security_headers` | `Add security headers middleware to protect against common attacks` | — |
| `security-no-security-maintenance-7` | `blocked` | `declared` | `medium` | `M` | `dependency_has_no_security_maintenance` | `Monitor closely or replace with better maintained alternative` | `osv-scanner` (not implemented) — `{"unmaintained_months":24}` |
| `security-outdated-server-9` | `juicio` | `declared` | `medium` | `M` | `outdated_server_software` | `Update to latest stable version for security patches` | — |
| `security-rate-limit-weak-6` | `juicio` | `declared` | `medium` | `M` | `rate_limiting_missing_or_weak` | `Implement rate limiting to prevent brute force attacks` | — |
| `security-session-cookie-not-http-only-4` | `ausencia` | `declared` | `medium` | `XS` | `session_cookie_not_http_only` | `Set HttpOnly flag to prevent XSS access to session cookie` | `node-matcher` |
| `security-session-cookie-not-secure-3` | `ausencia` | `declared` | `medium` | `XS` | `session_cookie_not_secure` | `Set Secure flag for session cookies in HTTPS environments` | `node-matcher` |
| `security-transitive-vuln-8` | `blocked` | `declared` | `medium` | `S` | `transitive_dependency_vulnerability` | `Update Dependency A to version that uses safe Dependency B` | `osv-scanner` (not implemented) — `{"transitive":true}` |
| `security-unmaintained-dep-4` | `blocked` | `declared` | `medium` | `M` | `unmaintained_dependency` | `Replace with actively maintained alternative or fork with security patches` | `osv-scanner` (not implemented) — `{"unmaintained_months":18}` |
| `security-weak-rng-10` | `juicio` | `declared` | `medium` | `M` | `random_number_generator_weak` | `Use cryptographically secure random number generator` | — |
| `security-vcs-insecure-9` | `runnable` | `proven` | `low` | `M` | `version_control_system_not_secure` | `Use HTTPS or SSH for all git operations` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"git\\+http://","path_glob":"**/{package.json,requirements.txt,go.mod,pyproject.toml}"}}` |
| `security-error-detail-1` | `juicio` | `declared` | `info` | `XS` | `error_detail_exposed_to_client` | `Log the full error server-side and return a generic message to the client` | — |

## database — database-assessment

- **Skill source:** `skills/database-assessment.skill.md`
- **Rules:** 32 — `detector` 7 (runnable 7, blocked 0) · `ausencia` 7 · `juicio` 9 · `fuera` 9
- **Demonstrated:** 3 of 32 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 29 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 7 of 32 rules run (22%). The other 25: 0 blocked `detector` rules · 7 checklist-only rules · 9 rules needing judgment (Fase 3) · 9 rules out of scope.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `database-full-table-scan-3` | `fuera` | `declared` | `critical` | `M` | `table_rows` | `Analyze query patterns and add appropriate indexes; consider partitioning` | — |
| `database-irreversible-migration-1` | `juicio` | `declared` | `critical` | `L` | `migration_drops_column` | `Add data backup step before column drop or provide restore procedure` | — |
| `database-n-plus-one-confirmed-2` | `fuera` | `declared` | `critical` | `M` | `query_count_in_logs` | `Implement batch loading or JOIN to reduce query count` | — |
| `database-irreversible-migration-2` | `juicio` | `declared` | `high` | `L` | `migration_renames_table` | `Implement table rename with data migration or provide rollback script` | — |
| `database-iteration-overload-5` | `juicio` | `declared` | `high` | `M` | `orm_iteration_over_large_resultset` | `Use iterator(), yield_per(), or add pagination limits` | — |
| `database-missing-app-pool-8` | `juicio` | `declared` | `high` | `M` | `missing_connection_pooling_in_application` | `Implement connection pooling (e.g., PgBouncer, HikariCP)` | — |
| `database-missing-index-fk-1` | `ausencia` | `declared` | `high` | `S` | `foreign_key_column` | `CREATE INDEX idx_orders_user_id ON orders(user_id);` | `node-matcher` |
| `database-n-plus-one-risk-1` | `juicio` | `declared` | `high` | `M` | `orm_loop_detected` | `Use JOIN or FETCH to load related data in single query` | — |
| `database-not-null-violation-4` | `runnable` | `proven` | `high` | `M` | `migration_adds_not_null_without_default` | `Provide DEFAULT value or make column nullable initially` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"ALTER\\s+TABLE\\s+[\\w\".]+\\s+ADD\\s+COLUMN\\s+(?:(?!DEFAULT)[^;])*NOT\\s+NULL(?:(?!DEFAULT)[^;])*;","path_glob":"**/migrations/**"}}` |
| `database-overfetch-relation-1` | `juicio` | `declared` | `high` | `S` | `full_relation_included_to_derive_single_flag` | `Filter the relation to the current user: favoritedBy: { where: { id: userId }, select: { id: true } }` | — |
| `database-risky-migration-3` | `juicio` | `declared` | `high` | `M` | `migration_changes_column_type` | `Add data validation/truncation step or provide data migration script` | — |
| `database-sequential-pagination-1` | `runnable` | `proven` | `high` | `S` | `sequential_count_and_findmany_on_paginated_endpoint` | `Run both queries concurrently: const [count, rows] = await Promise.all([countQuery, listQuery])` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"await\\s+[\\w.]+\\.count\\([^)]*\\)[^\\n]*\\n(?:[^\\n]*\\n){0,4}[^\\n]*await\\s+[\\w.]+\\.findMany\\(","path_glob":"**/*.{ts,js,tsx}"}}` |
| `database-undersized-pool-2` | `juicio` | `declared` | `high` | `XS` | `pool_size` | `Increase pool size to handle expected concurrent load` | — |
| `database-connection-timeout-high-3` | `runnable` | `declared` | `medium` | `XS` | `connection_timeout` | `Reduce timeout to 30s and monitor for actual pool exhaustion` | `node-matcher` — `{"matcher":"numeric-bound","params":{"pattern":"connection[_-]?[Tt]imeout(?:Millis\|MS)?[\"']?\\s*[:=]\\s*[\"']?(\\d+)","path_glob":"**/*.{ts,js,json,yml,yaml,toml,properties,conf,prisma}","op":"gt","value":30000}}` |
| `database-effective-cache-misconfigured-4` | `runnable` | `declared` | `medium` | `XS` | `effective_cache_poorly_configured` | `Set to 50-70% of available RAM for query planner accuracy` | `node-matcher` — `{"matcher":"numeric-bound","params":{"pattern":"\\beffective_cache_size\\s*=\\s*([0-9]+)MB","path_glob":"**/*.conf","op":"lt","value":256}}` |
| `database-heavy-migration-5` | `fuera` | `declared` | `medium` | `L` | `migration_performs_heavy_operation_on_large_table` | `Schedule during maintenance window or use concurrent index creation` | — |
| `database-index-bloat-7` | `fuera` | `declared` | `medium` | `M` | `index_bloat_significant` | `REINDEX CONCURRENTLY to remove bloat without locking` | — |
| `database-lazy-loading-danger-3` | `fuera` | `declared` | `medium` | `M` | `orm_lazy_loading_enabled` | `Consider eager loading or explicit JOIN for high-traffic paths` | — |
| `database-lock-timeout-missing-10` | `ausencia` | `declared` | `medium` | `XS` | `lock_timeout_not_configured` | `Set lock_timeout to prevent indefinite blocking (e.g., 1000ms)` | `node-matcher` |
| `database-maintenance-work-mem-too-low-3` | `runnable` | `declared` | `medium` | `XS` | `maintenance_work_mem_too_low` | `Increase to 256MB for better maintenance performance` | `node-matcher` — `{"matcher":"numeric-bound","params":{"pattern":"\\bmaintenance_work_mem\\s*=\\s*([0-9]+)MB","path_glob":"**/*.conf","op":"lt","value":256}}` |
| `database-missing-bloat-monitoring-5` | `ausencia` | `declared` | `medium` | `M` | `missing_pg_bloat_monitoring` | `Install pg_extension or schedule regular bloat reports` | `node-matcher` |
| `database-missing-composite-index-5` | `fuera` | `declared` | `medium` | `M` | `composite_where_conditions` | `CREATE INDEX idx_events_user_created ON events(user_id, created_at);` | — |
| `database-missing-index-hot-path-2` | `fuera` | `declared` | `medium` | `S` | `join_column_in_slow_query_log` | `CREATE INDEX idx_order_items_product_id ON order_items(product_id);` | — |
| `database-missing-index-where-4` | `fuera` | `declared` | `medium` | `S` | `where_column_used_frequently` | `CREATE INDEX idx_jobs_status ON jobs(status);` | — |
| `database-missing-prefetch-4` | `juicio` | `declared` | `medium` | `M` | `missing_select_related_or_prefetch_related` | `Use select_related for ForeignKey, prefetch_related for ManyToMany` | — |
| `database-oversized-pool-1` | `runnable` | `declared` | `medium` | `XS` | `pool_size` | `Set pool_size to 2-4x CPU cores (8-16 for this system)` | `node-matcher` — `{"matcher":"numeric-bound","params":{"pattern":"(?:maximum[_-]?pool[_-]?size\|connection[_-]?limit\|pool[_-]?size)[\"']?\\s*[:=]\\s*[\"']?(\\d+)","path_glob":"**/*.{ts,js,json,yml,yaml,toml,properties,conf,prisma}","op":"gt","value":32}}` |
| `database-pg-stat-statements-disabled-1` | `ausencia` | `declared` | `medium` | `XS` | `pg_stat_statements_not_enabled` | `Add 'pg_stat_statements' to shared_preload_libraries and restart` | `node-matcher` |
| `database-statement-timeout-missing-9` | `ausencia` | `declared` | `medium` | `XS` | `statement_timeout_not_configured` | `Set statement_timeout to prevent runaway queries (e.g., 5000ms)` | `node-matcher` |
| `database-work-mem-too-low-2` | `runnable` | `declared` | `medium` | `XS` | `work_mem_too_low` | `Increase work_mem to 64MB (25% of available RAM per concurrent operation)` | `node-matcher` — `{"matcher":"numeric-bound","params":{"pattern":"\\bwork_mem\\s*=\\s*([0-9]+)MB","path_glob":"**/*.conf","op":"lt","value":64}}` |
| `database-idle-timeout-missing-4` | `ausencia` | `proven` | `low` | `XS` | `idle_timeout_not_configured` | `Set appropriate idle connection timeout (e.g., 300 seconds)` | `node-matcher` |
| `database-max-lifetime-missing-5` | `ausencia` | `declared` | `low` | `XS` | `max_lifetime_not_configured` | `Set maximum connection lifetime to prevent resource leaks (e.g., 3600s)` | `node-matcher` |
| `database-unused-indexes-6` | `fuera` | `declared` | `low` | `S` | `unused_indexes_detected` | `Consider removing unused indexes to reduce write overhead` | — |

## performance — performance-assessment

- **Skill source:** `skills/performance-assessment.skill.md`
- **Rules:** 71 — `detector` 2 (runnable 2, blocked 0) · `ausencia` 8 · `juicio` 32 · `fuera` 29
- **Demonstrated:** 0 of 71 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 71 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 2 of 71 rules run (3%). The other 69: 0 blocked `detector` rules · 8 checklist-only rules · 32 rules needing judgment (Fase 3) · 29 rules out of scope.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `performance-memory-leak-3` | `fuera` | `declared` | `critical` | `L` | `memory_profile_shows_leak` | `Identify and fix objects not being garbage collected (event listeners, caches, etc.)` | — |
| `performance-cap-exceeded-in-6mo-1` | `fuera` | `declared` | `high` | `L` | `growth_rate_exceeds_capacity_in_6_months` | `Plan capacity increase: horizontal scaling, vertical scaling, or optimization` | — |
| `performance-cpu-hotspot-1` | `fuera` | `declared` | `high` | `M` | `cpu_profile_shows` | `Optimize algorithm or consider caching frequently computed values` | — |
| `performance-db-bottleneck-7` | `fuera` | `declared` | `high` | `M` | `db_query_time` | `Optimize queries, add indexes, or consider read replicas` | — |
| `performance-db-no-pooling-1` | `juicio` | `declared` | `high` | `M` | `database_connection_not_pooled` | `Implement connection pooling (HikariCP for Java, node-postgres pool for JS)` | — |
| `performance-external-api-8` | `fuera` | `declared` | `high` | `M` | `external_api_time` | `Implement caching, circuit breaker, or asynchronous processing` | — |
| `performance-gc-pressure-4` | `fuera` | `declared` | `high` | `M` | `gc_pause_time` | `Tune GC settings or reduce object allocation rate` | — |
| `performance-image-processing-11` | `fuera` | `declared` | `high` | `M` | `image_processing_time` | `Offload image processing to background workers or use CDN image optimization` | — |
| `performance-lock-contention-6` | `fuera` | `declared` | `high` | `M` | `lock_contention` | `Reduce lock scope, use lock-free data structures, or increase partitioning` | — |
| `performance-long-critical-path-1` | `juicio` | `declared` | `high` | `L` | `critical_path_length` | `Consider service consolidation or API composition to reduce hops` | — |
| `performance-no-connection-pool-7` | `juicio` | `declared` | `high` | `M` | `no_connection_pooling` | `Implement connection pooling for databases, HTTP clients, and message brokers` | — |
| `performance-cache-eviction-high-20` | `fuera` | `declared` | `medium` | `M` | `cache_eviction_rate_high` | `Increase cache size or review TTL and eviction policy` | — |
| `performance-cache-miss-rate-19` | `fuera` | `declared` | `medium` | `M` | `cache_hit_rate` | `Review cache key strategy, TTL values, or cache size` | — |
| `performance-cpu-kernel-heavy-2` | `fuera` | `declared` | `medium` | `M` | `cpu_profile_shows` | `Optimize queries or reduce network calls; consider connection pooling` | — |
| `performance-db-index-overuse-6` | `fuera` | `declared` | `medium` | `M` | `database_index_overuse` | `Remove unused indexes to reduce write overhead and storage costs` | — |
| `performance-db-pool-oversized-7` | `fuera` | `declared` | `medium` | `M` | `database_connection_pool_oversized` | `Right-size connection pool to match actual concurrent usage` | — |
| `performance-dns-lookup-14` | `fuera` | `declared` | `medium` | `M` | `dns_lookup_time` | `Use DNS caching or consider internal service discovery` | — |
| `performance-encryption-12` | `fuera` | `declared` | `medium` | `M` | `encryption_decryption_time` | `Consider hardware acceleration or reduce encryption frequency` | — |
| `performance-gc-major-pause-5` | `fuera` | `declared` | `medium` | `M` | `gc_pause_time` | `Consider GC tuning or incremental/tri-color GC algorithms` | — |
| `performance-http-no-pooling-2` | `juicio` | `declared` | `medium` | `M` | `http_client_no_connection_pooling` | `Use HTTP client with connection pooling (axios, http/nodejs)` | — |
| `performance-io-bound-sync-2` | `runnable` | `declared` | `medium` | `M` | `io_bound_not_using_async` | `Use asynchronous I/O or dedicate threads for I/O operations` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"readFileSync\|writeFileSync\|readdirSync\|statSync\|execSync\|spawnSync","path_glob":"**/*.{js,ts,mjs,cjs}"}}` |
| `performance-no-adaptive-concurrency-9` | `juicio` | `declared` | `medium` | `M` | `no_adaptive_concurrency` | `Implement adaptive thread pool that grows/shrinks based on load` | — |
| `performance-no-adaptive-timeout-6` | `juicio` | `declared` | `medium` | `M` | `no_adaptive_timeout` | `Implement adaptive timeout based on recent performance or service health` | — |
| `performance-no-backpressure-10` | `juicio` | `declared` | `medium` | `M` | `no_backpressure_handling` | `Implement backpressure signaling (e.g., Reactive Streams, Flow Control)` | — |
| `performance-no-bulkhead-5` | `juicio` | `declared` | `medium` | `M` | `no_bulkhead_isolation` | `Implement bulkhead pattern to isolate critical services` | — |
| `performance-no-chaos-engineering-4` | `juicio` | `declared` | `medium` | `M` | `no_chaos_engineering_practice` | `Implement chaos engineering: latency injection, fault injection, etc.` | — |
| `performance-no-checkpointing-7` | `juicio` | `declared` | `medium` | `M` | `no_checkpointing_in_long_runs` | `Add checkpointing to allow restart from last successful point` | — |
| `performance-no-circuit-breaker-4` | `ausencia` | `declared` | `medium` | `M` | `no_circuit_breaker_for_external_calls` | `Implement circuit breaker pattern (Hystrix, resilience4j, oxyd)` | `node-matcher` |
| `performance-no-compression-13` | `ausencia` | `declared` | `medium` | `M` | `no_compression_used_for_large_responses` | `Enable gzip or Brotli compression for responses >1KB` | `yaml-check` |
| `performance-no-cost-perf-tradeoff-8` | `juicio` | `declared` | `medium` | `M` | `no_cost_performance_tradeoff_analysis` | `Implement cost-performance analysis for optimization decisions` | — |
| `performance-no-data-archiving-10` | `ausencia` | `declared` | `medium` | `M` | `no_data_archiving_strategy` | `Implement hot/warm/cold storage strategy based on access patterns` | `yaml-check` |
| `performance-no-graceful-degradation-7` | `juicio` | `declared` | `medium` | `M` | `no_graceful_degradation` | `Implement graceful degradation: show cached data or limited functionality` | — |
| `performance-no-internal-compression-3` | `juicio` | `declared` | `medium` | `M` | `compression_not_used_for_internal_communication` | `Enable compression (gzip, Snappy, LZ4) for high-volume internal communication` | — |
| `performance-no-keep-alive-9` | `juicio` | `declared` | `medium` | `M` | `no_http_keep_alive` | `Enable HTTP keep-alive to reuse connections` | — |
| `performance-no-lb-round-robin-8` | `juicio` | `declared` | `medium` | `M` | `no_round_robin_load_balancing` | `Use round-robin or least connections load balancing for better distribution` | — |
| `performance-no-load-testing-3` | `ausencia` | `declared` | `medium` | `M` | `no_load_testing_strategy` | `Implement regular load testing (monthly or quarterly) as part of CI/CD` | `node-matcher` |
| `performance-no-partitioning-8` | `juicio` | `declared` | `medium` | `M` | `no_partitioning_for_parallelism` | `Process all partitions in parallel to utilize full cluster capacity` | — |
| `performance-no-perf-budgets-10` | `fuera` | `declared` | `medium` | `M` | `no_performance_budgets_per_team` | `Assign performance budgets to teams: e.g., API team: 95th percentile < 200ms` | — |
| `performance-no-pipelining-5` | `juicio` | `declared` | `medium` | `M` | `no_pipelining_in_stages` | `Implement pipelining: start transformation as soon as first data available` | — |
| `performance-no-priority-queuing-10` | `juicio` | `declared` | `medium` | `M` | `no_priority_queuing` | `Implement priority queuing: high priority requests bypass queue` | — |
| `performance-no-regression-detection-5` | `ausencia` | `declared` | `medium` | `M` | `no_performance_regression_detection` | `Implement performance regression detection: compare against baseline` | `node-matcher` |
| `performance-no-request-collapsing-4` | `ausencia` | `declared` | `medium` | `M` | `no_request_collapsing` | `Implement request collapsing or deduplication at edge or service level` | `node-matcher` |
| `performance-no-request-id-3` | `juicio` | `declared` | `medium` | `M` | `no_request_id_for_tracing` | `Add request ID middleware for tracing requests across services` | — |
| `performance-no-resource-isolation-9` | `juicio` | `declared` | `medium` | `M` | `no_resource_isolation_for_noisy_neighbors` | `Use resource quotas or separate resource pools for different workload types` | — |
| `performance-no-response-streaming-5` | `juicio` | `declared` | `medium` | `M` | `no_response_streaming_for_large_data` | `Use streaming responses for large datasets (e.g., CSV export, log streaming)` | — |
| `performance-no-retry-jitter-8` | `juicio` | `declared` | `medium` | `M` | `no_retry_jitter` | `Add jitter to retry delays: randomize between 0.5x and 1.5x of base delay` | — |
| `performance-no-self-rate-limit-6` | `juicio` | `declared` | `medium` | `M` | `no_rate_limiting_for_self_protection` | `Implement rate limiting to protect service from overload` | — |
| `performance-no-windowing-6` | `juicio` | `declared` | `medium` | `M` | `no_windowing_for_batch_processing` | `Use sliding window or tumbling window for appropriate use cases` | — |
| `performance-queue-wait-17` | `fuera` | `declared` | `medium` | `M` | `queue_wait_time` | `Increase worker count or optimize processing speed` | — |
| `performance-resource-exhausted-in-3mo-2` | `fuera` | `declared` | `medium` | `M` | `resource_exhaustion_predicted_in_3_months` | `Plan memory increase: optimize usage, increase instance size, or horizontal scale` | — |
| `performance-serialization-9` | `fuera` | `declared` | `medium` | `M` | `serialization_time` | `Consider protobuf, Avro, or MessagePack for high-throughput scenarios` | — |
| `performance-serialization-format-2` | `juicio` | `declared` | `medium` | `M` | `serialization_format_inefficient` | `Consider protobuf, gRPC, or Thrift for service-to-service communication` | — |
| `performance-serialization-format-4` | `runnable` | `declared` | `medium` | `M` | `serialization_format_inefficient_for_throughput` | `Consider protobuf, Avro, or MessagePack for better throughput` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:(pickle.(dump\|dumps\|load\|loads)\|BinaryFormatter\|TypeNameHandling))","path_glob":"**/*.{py,cs,ts,js,java}"}}` |
| `performance-ssl-handshake-16` | `fuera` | `declared` | `medium` | `M` | `ssl_handshake_time` | `Use session resumption or OCSP stapling to reduce handshake cost` | — |
| `performance-suboptimal-batch-1` | `juicio` | `declared` | `medium` | `M` | `batch_size_suboptimal` | `Increase batch size to reduce per-item overhead (e.g., database transactions)` | — |
| `performance-tcp-handshake-15` | `fuera` | `declared` | `medium` | `M` | `tcp_handshake_time` | `Use connection pooling or HTTP keep-alive to reuse connections` | — |
| `performance-template-rendering-10` | `fuera` | `declared` | `medium` | `M` | `template_rendering_time` | `Consider caching rendered templates or using streaming templates` | — |
| `performance-transport-protocol-3` | `juicio` | `declared` | `medium` | `M` | `transport_protocol_inefficient` | `Consider HTTP/2, gRPC, or WebSocket for better multiplexing` | — |
| `performance-log-retention-too-long-8` | `ausencia` | `declared` | `low` | `M` | `log_retention_too_long` | `Implement log rotation and retention policy (e.g., keep 30 days)` | `yaml-check` |
| `performance-log-retention-too-short-9` | `juicio` | `declared` | `low` | `M` | `log_retention_too_short` | `Adjust retention to balance troubleshooting needs and storage costs` | — |
| `performance-no-error-budget-7` | `juicio` | `declared` | `low` | `M` | `no_error_budget_policy` | `Define error budget: e.g., 99.9% availability allows 43m downtime/month` | — |
| `performance-no-slo-6` | `juicio` | `declared` | `low` | `M` | `no_service_level_objectives` | `Define SLOs based on user expectations and business requirements` | — |
| `performance-no-tcp-nodelay-10` | `juicio` | `declared` | `low` | `S` | `no_tcp_nodelay` | `Set TCP_NODELAY=true for low-latency requirements` | — |
| `performance-no-tech-debt-alloc-9` | `ausencia` | `declared` | `low` | `M` | `no_technical_debt_allocation` | `Allocate sprint capacity (e.g., 20%) for performance improvements` | `node-matcher` |
| `performance-no-udp-11` | `juicio` | `declared` | `low` | `S` | `no_udp_when_appropriate` | `Use UDP for real-time data where timeliness matters more than reliability` | — |
| `performance-reserved-instance-5` | `fuera` | `declared` | `low` | `M` | `reserved_instance_opportunity` | `Purchase reserved instances or savings plans for 30-50% cost reduction` | — |
| `performance-spot-eligible-4` | `fuera` | `declared` | `low` | `M` | `spot_instance_eligible_workloads_on_demand` | `Use spot instances with fallback to on-demand for fault tolerance` | — |
| `performance-underutilized-compute-1` | `fuera` | `declared` | `low` | `S` | `cpu_utilization` | `Right-size instances or use autoscaling to match demand` | — |
| `performance-underutilized-memory-2` | `fuera` | `declared` | `low` | `S` | `memory_utilization` | `Right-size instances or use autoscaling to match demand` | — |
| `performance-underutilized-storage-3` | `fuera` | `declared` | `low` | `S` | `storage_utilization` | `Right-size storage or implement lifecycle policies to reduce costs` | — |
| `performance-worker-idle-18` | `fuera` | `declared` | `low` | `M` | `worker_idle_time` | `Right-size worker pool to match actual concurrent workload` | — |

## structure — structure-assessment

- **Skill source:** `skills/structure-assessment.skill.md`
- **Rules:** 29 — `detector` 8 (runnable 7, blocked 1) · `ausencia` 0 · `juicio` 21 · `fuera` 0
- **Demonstrated:** 2 of 29 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 27 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 7 of 29 rules run (24%). The other 22: 1 blocked `detector` rule — tool not implemented (semgrep) · 0 checklist-only rules · 21 rules needing judgment (Fase 3) · 0 rules out of scope.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `structure-dependency-cycle-1` | `juicio` | `declared` | `critical` | `L` | `import_cycle_detected` | `Introduce domain events or shared kernel to break cycle` | — |
| `structure-extremely-unstable-3` | `juicio` | `declared` | `high` | `L` | `instability_index` | `Stabilize interface or reduce number of dependents` | — |
| `structure-high-coupling-1` | `juicio` | `declared` | `high` | `L` | `afferent_coupling` | `Split into focused services: AuthenticationService, AuthorizationService, UserService` | — |
| `structure-inverted-dependency-2` | `runnable` | `proven` | `high` | `M` | `service_imports_controller` | `Extract URL generation to utility service or use configuration` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^\\s*(?:import\\s+(?:static\\s+)?[\\w.]*[Cc]ontroller[\\w.]*\|from\\s+[\\w.]*[Cc]ontroller[\\w.]*\|(?:import\|from)\\b[^;\\n]*[\"'][\\w./@-]*[Cc]ontroller[\\w./@-]*[\"']\|(?:[\\w$\\s{}()[\\],*.]*?=\\s*)?require\\(\\s*[\"'][\\w./@-]*[Cc]ontroller[\\w./@-]*[\"']\\s*\\)))","path_glob":"**/*Service.*"}}` |
| `structure-layer-violation-1` | `runnable` | `proven` | `high` | `M` | `controller_imports_repository_directly` | `Call through service layer: orderService.getOrderById(id)` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^\\s*(?:import\\s+(?:static\\s+)?[\\w.]*[Rr]epositor(?:y\|ies)[\\w.]*\|from\\s+[\\w.]*[Rr]epositor(?:y\|ies)[\\w.]*\|(?:import\|from)\\b[^;\\n]*[\"'][\\w./@-]*[Rr]epositor(?:y\|ies)[\\w./@-]*[\"']\|(?:[\\w$\\s{}()[\\],*.]*?=\\s*)?require\\(\\s*[\"'][\\w./@-]*[Rr]epositor(?:y\|ies)[\\w./@-]*[\"']\\s*\\)))","path_glob":"**/*Controller.*"}}` |
| `structure-package-dependency-cycle-2` | `juicio` | `declared` | `high` | `L` | `import_cycle_detected` | `Reorganize package structure or use dependency inversion` | — |
| `structure-class-dependency-cycle-3` | `juicio` | `declared` | `medium` | `M` | `import_cycle_detected` | `Introduce interface or use dependency injection to break cycle` | — |
| `structure-config-logic-8` | `juicio` | `declared` | `medium` | `M` | `configuration_contains_business_logic` | `Use feature flag service or environment-specific configuration` | — |
| `structure-controller-logic-6` | `juicio` | `declared` | `medium` | `M` | `controller_contains_business_logic` | `Move calculation to service or domain service` | — |
| `structure-framework-cycle-5` | `juicio` | `declared` | `medium` | `M` | `framework_specific_cycle_detected` | `Use state management service or event-driven communication` | — |
| `structure-framework-leak-3` | `runnable` | `declared` | `medium` | `M` | `domain_entity_exports_framework_types` | `Keep domain entities framework-independent; use DTOs for boundaries` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^\\s*(?:import\\s+(?:static\\s+)?(?:[\\w${},*\\s]+\\s+from\\s+)?\|from\\s+)['\"]?@?(?:javax\\.servlet\|jakarta\\.servlet\|org\\.springframework\\.web\|angular/core\|flask\|django\|fastapi\|express)\\b[\\w./'\"]*)","path_glob":"**/{entities,models,domain}/**"}}` |
| `structure-high-coupling-2` | `juicio` | `declared` | `medium` | `M` | `afferent_coupling` | `Evaluate if responsibilities are properly separated` | — |
| `structure-highly-unstable-4` | `juicio` | `declared` | `medium` | `M` | `instability_index` | `Consider if instability is justified by business volatility` | — |
| `structure-low-cohesion-5` | `juicio` | `declared` | `medium` | `M` | `lack_of_cohesion_in_methods` | `Split class into multiple classes with focused responsibilities` | — |
| `structure-observer-violation-6` | `juicio` | `declared` | `medium` | `M` | `observer_pattern_claimed` | `Use observer interface to decouple subject from observers` | — |
| `structure-repository-logic-4` | `juicio` | `declared` | `medium` | `M` | `repository_contains_business_logic` | `Move business logic to service or domain layer` | — |
| `structure-repository-no-crud-2` | `juicio` | `declared` | `medium` | `M` | `repository_pattern_claimed` | `Extend base repository or implement standard CRUD interface` | — |
| `structure-repository-violation-1` | `juicio` | `declared` | `medium` | `M` | `repository_pattern_claimed` | `Create separate repositories: OrderRepository, CustomerRepository, etc.` | — |
| `structure-service-orchestration-3` | `juicio` | `declared` | `medium` | `M` | `service_pattern_claimed` | `Consider dedicated orchestrator or workflow engine` | — |
| `structure-service-sql-5` | `runnable` | `declared` | `medium` | `M` | `service_contains_sql_queries` | `Move query to repository or use criteria builder API` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:\\b(?:select\\s+(?:distinct\\s+)?[\\w*\\s,()]+?\\s+from\\s+[\\w.]+\|insert\\s+into\\s+[\\w.]+\|update\\s+[\\w.]+\\s+set\\s+\\w+\|delete\\s+from\\s+[\\w.]+\|join\\s+[\\w.]+\|(?:\\.query\|\\.raw\|\\.execute)\\(\\s*['\"]\\s*(?:select\|insert\|update\|delete)))","path_glob":"**/*Service.*"}}` |
| `structure-singleton-violation-5` | `blocked` | `declared` | `medium` | `M` | `singleton_pattern_claimed` | `Make constructor private and provide static getInstance() method` | `semgrep` (not implemented) — `{"pattern":"class $C {\n  ...\n  static getInstance(...) {\n    ...\n  }\n  ...\n  constructor(...) {\n    ...\n  }\n  ...\n}","languages":["ts","tsx","js","jsx"]}` |
| `structure-strategy-hardcoded-7` | `runnable` | `declared` | `medium` | `M` | `strategy_pattern_claimed` | `Use configuration or factory to select strategy dynamically` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?:switch\\s*\\([^)]*\\)\\s*\\{\|(?:else\\s+)?if\\s*\\([^)]*\\)\\s*\\{\|else\\s*\\{\|case\\s+[^:\\n]+:)[^{}]*?\\bnew\\s+[\\w$]*Strategy\\s*\\(","path_glob":"**/*{Service,Strategy}.*"}}` |
| `structure-transitive-cycle-4` | `juicio` | `declared` | `medium` | `M` | `transitive_dependency_cycle_detected` | `Apply same cycle-breaking techniques at higher granularity` | — |
| `structure-adapter-violation-10` | `juicio` | `declared` | `low` | `S` | `adapter_pattern_claimed` | `Adapter should work with interface, not concrete implementation` | — |
| `structure-decorator-violation-9` | `juicio` | `declared` | `low` | `S` | `decorator_pattern_claimed` | `Extend base interface, not concrete implementation` | — |
| `structure-dto-logic-7` | `runnable` | `declared` | `low` | `S` | `data_transfer_object_contains_logic` | `Keep DTOs as pure data carriers; move validation to service or validator` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^\\s*(?:(?:public\|private\|protected\|static\|async\|override\|readonly\|final\|abstract\|internal\|virtual)\\s+)*(?:[\\w$<>[\\]\|.,&?]+\\s+)?(?!get[A-Z$\\s]\|set[A-Z$\\s]\|constructor\\s*\\(\|if\\s*\\(\|for\\s*\\(\|while\\s*\\(\|switch\\s*\\(\|catch\\s*\\(\|return\\b\|new\\s\|throw\\b\|else\\b\|case\\b\|do\\s*\\{)[\\w$]+\\s*\\([^()]*\\)\\s*(?::\\s*[\\w$<>[\\]\|.,&?\\s]+)?\\s*(?:\\{\|;\|=>))","path_glob":"**/*{DTO,Dto}.*"}}` |
| `structure-factory-violation-4` | `runnable` | `declared` | `low` | `XS` | `factory_pattern_claimed` | `Make constructor private and provide static factory method` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^\\s*(?:(?:public)\\s+[\\w$]*Factory\\s*\\([^()]*\\)\|(?:public\\s+)?constructor\\s*\\([^()]*\\))\\s*(?::\\s*[\\w$<>[\\]\|.,&?\\s]+)?\\s*(?:\\{\|;\|throws\\b))","path_glob":"**/*Factory.*"}}` |
| `structure-medium-cohesion-6` | `juicio` | `declared` | `low` | `M` | `lack_of_cohesion_in_methods` | `Review if methods belong together or should be separated` | — |
| `structure-template-method-8` | `juicio` | `declared` | `low` | `S` | `template_method_pattern_claimed` | `Add protected hook methods for subclasses to override` | — |

## code — code-quality-assessment

- **Skill source:** `skills/code-quality-assessment.skill.md`
- **Rules:** 59 — `detector` 44 (runnable 26, blocked 18) · `ausencia` 2 · `juicio` 13 · `fuera` 0
- **Demonstrated:** 12 of 59 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 47 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 26 of 59 rules run (44%). The other 33: 18 blocked `detector` rules — tool not implemented (semgrep) · 2 checklist-only rules · 13 rules needing judgment (Fase 3) · 0 rules out of scope.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `code-bare-except-1` | `blocked` | `declared` | `critical` | `XS` | — | `Specify exceptions to catch or use except Exception:` | `semgrep` (not implemented) — `{"pattern":"except:\n  ...","languages":["py"]}` |
| `code-empty-catch-1` | `runnable` | `proven` | `critical` | `XS` | `empty_catch_block` | `At minimum log the exception; preferably handle or rethrow` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}\|except\\s*(?:[A-Za-z_][\\w.]*\\s*)?:\\s*pass\\b","path_glob":"**/*.{js,ts,jsx,tsx,java,cs,php,kt,swift,dart,py}","max_matches":1000000}}` |
| `code-extreme-complexity-1` | `runnable` | `proven` | `critical` | `L` | `cyclomatic_complexity` | `Break into smaller functions: validateOrder, calculateTax, applyDiscounts` | `node-matcher` — `{"matcher":"complexity-limit","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","metric":"cyclomatic","max":20}}` |
| `code-logs-secrets-10` | `runnable` | `proven` | `critical` | `XS` | `logs_sensitive_information` | `Never log credentials, tokens, or PII; use masking if absolutely needed` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:(?:console\|logger\|log\|logging\|sys)\\.(?:log\|debug\|info\|warn\|warning\|error\|exception)\\s*\\([^)\\n]*(?:password\|passwd\|token\|secret\|api[_-]?key\|credential)\\w*\\s*[,)\\]};])","path_glob":"**/*.{js,ts,jsx,tsx,py,java,cs,go}","max_matches":1000000}}` |
| `code-sql-injection-risk-4` | `runnable` | `proven` | `critical` | `S` | `sql_string_concatenation` | `Use parameterized queries: cursor.execute(\"SELECT ... WHERE name = %s\", (name,))` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:(?:SELECT\|INSERT\|UPDATE\|DELETE)[^\"'\\n]*[\"']\\s*\\+\\s*\\w+\|f[\"'][^\"'\\n]*(?:SELECT\|INSERT\|UPDATE\|DELETE)[^\\n]*?\\{[^}\\n]+\\})","path_glob":"**/*.py","max_matches":1000000}}` |
| `code-bare-except-with-others-2` | `blocked` | `declared` | `high` | `S` | `bare_except_in_try_with_multiple_except` | `Order exceptions from specific to general; avoid bare except` | `semgrep` (not implemented) — `{"pattern":"try:\n  ...\nexcept $EXC:\n  ...\nexcept:\n  ...","languages":["py"]}` |
| `code-exact-duplication-massive-1` | `runnable` | `proven` | `high` | `L` | `exact_duplicate_lines` | `Extract to shared validation utility or base class` | `node-matcher` — `{"matcher":"exact-duplication","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","min_chars":1200}}` |
| `code-extreme-length-6` | `runnable` | `proven` | `high` | `L` | `file_lines` | `Split into presentational and container components` | `node-matcher` — `{"matcher":"complexity-limit","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","metric":"line-count","max":150}}` |
| `code-extreme-nesting-4` | `blocked` | `declared` | `high` | `M` | `nesting_depth` | `Use early returns or guard clauses to reduce nesting` | `semgrep` (not implemented) — `{"pattern":"if ($A) {\n  if ($B) {\n    if ($C) {\n      if ($D) {\n        if ($E) {\n          if ($F) {\n            ...\n          }\n        }\n      }\n    }\n  }\n}","languages":["js","ts","jsx","tsx","java","cs","php","kt","swift","dart","go","rust","c","cpp"]}` |
| `code-generic-catch-2` | `runnable` | `proven` | `high` | `S` | `catch_generic_exception` | `Either handle specific exceptions or rethrow after logging` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"catch\\s*\\(\\s*(?:Exception\|Throwable)\\s+\\w+\\s*\\)\|except\\s+(?:Exception\|BaseException)\\s*:","path_glob":"**/*.{java,cs,py}","max_matches":1000000}}` |
| `code-god-object-6` | `runnable` | `proven` | `high` | `L` | `god_object_detected` | `Apply Single Responsibility Principle; split into focused classes` | `node-matcher` — `{"matcher":"max-occurrences","params":{"pattern":"(?m:^    def \\w+\\()","path_glob":"**/*.py","max":30}}` |
| `code-god-package-9` | `juicio` | `declared` | `high` | `L` | `god_package_detected` | `Split into domain-specific packages: strutil, mathutil, netutil, uiutil` | — |
| `code-high-complexity-2` | `runnable` | `proven` | `high` | `M` | `cyclomatic_complexity` | `Extract password validation and session creation to separate functions` | `node-matcher` — `{"matcher":"complexity-limit","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","metric":"cyclomatic","max":15}}` |
| `code-missing-validation-4` | `juicio` | `declared` | `high` | `M` | `no_validation_at_api_boundary` | `Add authentication and authorization checks at controller level` | — |
| `code-mutable-default-3` | `runnable` | `proven` | `high` | `XS` | `mutable_default_argument` | `Use None default and initialize inside function: def process(items=None)` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"def\\s+\\w+\\s*\\([^)]*=\\s*(?:\\[\\]\|\\{\\}\|set\\(\\)\|dict\\(\\)\|list\\(\\))","path_glob":"**/*.py","max_matches":1000000}}` |
| `code-unchecked-error-1` | `blocked` | `declared` | `high` | `S` | `error_not_checked` | `Check error and handle appropriately: if err != nil { return err }` | `semgrep` (not implemented) — `{"pattern":"$F($X...)","languages":["go"]}` |
| `code-unhandled-promise-4` | `juicio` | `declared` | `high` | `S` | `promise_not_awaited` | `Either await the promise or explicitly handle with .then/.catch` | — |
| `code-any-type-6` | `juicio` | `declared` | `medium` | `S` | — | `Define specific interface or use generics for flexibility` | — |
| `code-blocking-in-goroutine-3` | `juicio` | `declared` | `medium` | `M` | `blocking_call_in_goroutine` | `Use context.WithTimeout or non-blocking alternatives` | — |
| `code-boolean-parameter-plague-11` | `blocked` | `declared` | `medium` | `M` | `boolean_parameter_count` | `Replace booleans with enum or named options object` | `semgrep` (not implemented) — `{"pattern":"function $F(..., $A: boolean, ..., $B: boolean, ..., $C: boolean, ..., $D: boolean, ...) {\n  ...\n}","languages":["ts"]}` |
| `code-callback-hell-10` | `blocked` | `declared` | `medium` | `M` | `callback_hell_detected` | `Use promises with async/await or promises chaining` | `semgrep` (not implemented) — `{"pattern":"$F(..., function ($A) {\n  ...\n  $G(..., function ($B) {\n    ...\n    $H(..., function ($C) {\n      ...\n    }, ...)\n    ...\n  }, ...)\n  ...\n}, ...)","languages":["js","ts","jsx","tsx"]}` |
| `code-catch-and-continue-9` | `blocked` | `declared` | `medium` | `M` | `catches_error_and_continues` | `Break loop or implement retry circuit breaker for critical operations` | `semgrep` (not implemented) — `{"pattern":"for (...) {\n  ...\n  try {\n    ...\n  } catch ($E) {\n    ...\n    continue;\n    ...\n  }\n  ...\n}","languages":["js","ts","jsx","tsx","java","cs","php","kt","swift","dart"]}` |
| `code-copy-paste-variant-6` | `juicio` | `declared` | `medium` | `M` | `copy_paste_with_minor_changes` | `Parameterize the varying parts and extract to shared function` | — |
| `code-deep-inheritance-9` | `blocked` | `declared` | `medium` | `M` | `deep_inheritance_hierarchy` | `Consider composition over inheritance for behavioral variation` | `semgrep` (not implemented) — `{"pattern":"class $C1($C2):\n  ...\nclass $C2($C3):\n  ...\nclass $C3($C4):\n  ...\nclass $C4($C5):\n  ...\nclass $C5($C6):\n  ...","languages":["py"]}` |
| `code-error-assigned-unused-2` | `blocked` | `declared` | `medium` | `M` | `error_assigned_not_used` | `Either handle error or use blank identifier if truly irrelevant` | `semgrep` (not implemented) — `{"pattern":"$A, err := $F(...)","languages":["go"]}` |
| `code-exact-duplication-significant-2` | `runnable` | `proven` | `medium` | `M` | `exact_duplicate_lines` | `Create shared response formatter utility` | `node-matcher` — `{"matcher":"exact-duplication","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","min_chars":800}}` |
| `code-high-nesting-5` | `blocked` | `declared` | `medium` | `S` | `nesting_depth` | `Extract inner loop to separate function with clear purpose` | `semgrep` (not implemented) — `{"pattern":"if ($A) {\n  if ($B) {\n    if ($C) {\n      if ($D) {\n        if ($E) {\n          ...\n        }\n      }\n    }\n  }\n}","languages":["js","ts","jsx","tsx","java","cs","php","kt","swift","dart","go","rust","c","cpp"]}` |
| `code-ignores-return-value-6` | `juicio` | `declared` | `medium` | `M` | `ignores_return_value` | `Check return value or change function to throw exception on failure` | — |
| `code-interface-bloat-8` | `runnable` | `declared` | `medium` | `M` | `interface_bloat` | `Split into smaller, focused interfaces by concern` | `node-matcher` — `{"matcher":"max-occurrences","params":{"pattern":"(?m:^\\t\\w+\\s*\\([^)\\n]*\\)\\s*(?:\\([^)\\n]*\\)\|[\\w.\\[\\]*]+)?\\s*$)","path_glob":"**/*.go","max":10}}` |
| `code-long-function-7` | `runnable` | `declared` | `medium` | `M` | `function_lines` | `Break into smaller functions: validateInput, transformData, formatOutput` | `node-matcher` — `{"matcher":"complexity-limit","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","metric":"line-count","max":100}}` |
| `code-long-parameter-list-8` | `runnable` | `declared` | `medium` | `M` | `long_parameter_list` | `Use parameter object or builder pattern` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"def\\s+\\w+\\s*\\((?:\\([^()]*\\)\|[^(),])*(?:,(?:\\([^()]*\\)\|[^(),])*){5,}\\)","path_glob":"**/*.py","max_matches":1000000}}` |
| `code-loose-equality-1` | `blocked` | `declared` | `medium` | `XS` | — | `Use === for strict equality and type safety` | `semgrep` (not implemented) — `{"pattern":"$A == $B","languages":["js","ts","jsx","tsx"]}` |
| `code-loose-inequality-2` | `blocked` | `declared` | `medium` | `XS` | — | `Use !== for strict inequality` | `semgrep` (not implemented) — `{"pattern":"$A != $B","languages":["js","ts","jsx","tsx"]}` |
| `code-map-lookup-unchecked-7` | `runnable` | `declared` | `medium` | `M` | `map_lookup_not_checked` | `Use value, ok := myMap[key]; if !ok { /* handle missing key */ }` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^\\s*\\w+\\s*:?=\\s*\\w+\\[[^\\]\\n]+\\]\\s*$)","path_glob":"**/*.go","max_matches":1000000}}` |
| `code-missing-error-main-10` | `blocked` | `declared` | `medium` | `M` | `missing_error_handling_in_main` | `Handle errors from initialization and provide meaningful exit codes` | `semgrep` (not implemented) — `{"pattern":"func main() {\n  ...\n  $R := $F(...)\n  ...\n}","languages":["go"]}` |
| `code-moderate-complexity-3` | `runnable` | `declared` | `medium` | `S` | `cyclomatic_complexity` | `Consider lookup table or strategy pattern for formatting rules` | `node-matcher` — `{"matcher":"complexity-limit","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","metric":"cyclomatic","max":10}}` |
| `code-mutex-missing-4` | `juicio` | `declared` | `medium` | `M` | `mutex_not_used` | `Use sync.Mutex or sync.RWMutex to protect shared state` | — |
| `code-nested-ternary-9` | `blocked` | `declared` | `medium` | `M` | `nested_ternary_operators` | `Use if/else statement or extract to helper function` | `semgrep` (not implemented) — `{"pattern":"$C ? $A : $D ? $B : $E","languages":["js","ts","jsx","tsx","java","cs","kt"]}` |
| `code-null-instead-of-exception-3` | `juicio` | `declared` | `medium` | `S` | `throws_exception_or_returns_null` | `Throw domain-specific exception or use Optional/Result type` | — |
| `code-promise-chain-missing-catch-5` | `ausencia` | `declared` | `medium` | `S` | `promise_chain_missing_catch` | `Always terminate promise chains with .catch() or use try/catch with async/await` | `node-matcher` |
| `code-slice-append-in-loop-6` | `blocked` | `declared` | `medium` | `M` | `slice_append_in_loop` | `Pre-slice with make([]int, 0, 10000) to avoid repeated allocations` | `semgrep` (not implemented) — `{"pattern":"for ... {\n  ...\n  $X = append($X, ...)\n  ...\n}","languages":["go"]}` |
| `code-structural-duplication-high-4` | `juicio` | `declared` | `medium` | `M` | `structural_similarity` | `Extract common algorithm to shared function with parameters` | — |
| `code-system-exit-misuse-5` | `runnable` | `declared` | `medium` | `M` | `uses_system_exit_for_flow_control` | `Throw exception and let caller decide how to handle failure` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\\b(?:System\\.exit\|os\\.Exit\|sys\\.exit\|process\\.exit)\\s*\\(","path_glob":"**/*.{java,go,py,js,ts}","max_matches":1000000}}` |
| `code-too-many-attributes-7` | `runnable` | `declared` | `medium` | `M` | `too_many_attributes` | `Group related attributes into nested objects or separate classes` | `node-matcher` — `{"matcher":"max-occurrences","params":{"pattern":"(?m:^\\s{8}self\\.\\w+\\s*=[^=])","path_glob":"**/*.py","max":20}}` |
| `code-too-many-params-9` | `runnable` | `declared` | `medium` | `M` | `parameter_count` | `Use parameter object or builder pattern` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?:function\\s+)?\\w+\\s*\\((?:\\([^()]*\\)\|[^(),])*(?:,(?:\\([^()]*\\)\|[^(),])*){7,}\\)[ \\t]*\\{","path_glob":"**/*.{js,ts,jsx,tsx,java,cs,php,kt,swift,dart}","max_matches":1000000}}` |
| `code-var-usage-3` | `blocked` | `declared` | `medium` | `XS` | — | `Use let or const for block scoping` | `semgrep` (not implemented) — `{"pattern":"var $X = ...","languages":["js","ts","jsx","tsx"]}` |
| `code-boilerplate-repetition-7` | `runnable` | `declared` | `low` | `S` | `boilerplate_code_in_every_file` | `Create base service class or use dependency injection framework` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^\\s*(?:[#*]+\\s*)?(?:Copyright\|SPDX-License-Identifier)[^\\n]*(?:\\n\\s*[#*].+){4,})","path_glob":"**/*","max_matches":1000000}}` |
| `code-channel-not-closed-5` | `juicio` | `declared` | `low` | `S` | `channel_not_closed` | `Close channel when no more values will be sent to prevent goroutine leaks` | — |
| `code-console-log-7` | `runnable` | `declared` | `low` | `S` | — | `Remove or replace with appropriate logging level` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"console\\.(log\|debug\|info)\\s*\\(","path_glob":"src/**/*.{js,ts,jsx,tsx}","max_matches":1000000}}` |
| `code-exact-duplication-minor-3` | `runnable` | `proven` | `low` | `S` | `exact_duplicate_lines` | `Create shared logging helper or use aspect-oriented approach` | `node-matcher` — `{"matcher":"exact-duplication","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","min_chars":400}}` |
| `code-many-params-10` | `runnable` | `declared` | `low` | `S` | `parameter_count` | `Consider connection configuration object` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?:function\\s+)?\\w+\\s*\\((?:\\([^()]*\\)\|[^(),])*(?:,(?:\\([^()]*\\)\|[^(),])*){5,}\\)[ \\t]*\\{","path_glob":"**/*.{js,ts,jsx,tsx,java,cs,php,kt,swift,dart}","max_matches":1000000}}` |
| `code-medium-length-8` | `runnable` | `declared` | `low` | `S` | `function_lines` | `Consider if function does one thing well; split if multiple concerns` | `node-matcher` — `{"matcher":"complexity-limit","params":{"path_glob":"**/*.{js,ts,jsx,tsx,py,go,java,cs,php,kt,swift,dart,c,cpp}","metric":"line-count","max":50}}` |
| `code-missing-docstring-10` | `ausencia` | `declared` | `low` | `S` | `missing_docstring_in_public_api` | `Add docstring describing purpose, parameters, return value, and exceptions` | `node-matcher` |
| `code-missing-return-type-8` | `runnable` | `declared` | `low` | `S` | `missing_return_type` | `Add return type annotation: string` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?m:^export\\s+(?:async\\s+)?function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{)","path_glob":"**/*.ts","max_matches":1000000}}` |
| `code-multiple-return-points-12` | `runnable` | `declared` | `low` | `S` | `return_statement_count` | `Consider single exit point or early validation approach` | `node-matcher` — `{"matcher":"max-occurrences","params":{"pattern":"(?m:^\\s*return\\b)","path_glob":"**/*.{js,ts,jsx,tsx,py,java,cs,php,go,kt,swift,dart}","max":6}}` |
| `code-print-statement-5` | `blocked` | `declared` | `low` | `S` | — | `Use logging module with appropriate level` | `semgrep` (not implemented) — `{"pattern":"print(...)","languages":["py"]}` |
| `code-print-statement-8` | `blocked` | `declared` | `low` | `S` | `uses_print_instead_of_logger` | `Use proper logging framework with appropriate log levels` | `semgrep` (not implemented) — `{"pattern":"System.$OUT.println(...)","languages":["java"],"path_glob":"src/main/**/*.java"}` |
| `code-structural-duplication-medium-5` | `juicio` | `declared` | `low` | `M` | `structural_similarity` | `Create shared validation library with configurable rules` | — |
| `code-warning-suppression-7` | `juicio` | `declared` | `low` | `S` | `suppresses_warnings_without_justification` | `Fix underlying issues or suppress only specific warnings with justification` | — |

## flows — flows-assessment

- **Skill source:** `skills/flows-assessment.skill.md`
- **Rules:** 50 — `detector` 17 (runnable 12, blocked 5) · `ausencia` 18 · `juicio` 14 · `fuera` 1
- **Demonstrated:** 3 of 50 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 47 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 12 of 50 rules run (24%). The other 38: 5 blocked `detector` rules — tool not implemented (semgrep) · 18 checklist-only rules · 14 rules needing judgment (Fase 3) · 1 rule out of scope.
- 1 of the 18 `ausencia` checks needs an unimplemented tool (semgrep) and can never fire today.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `flows-fire-and-forget-critical-1` | `blocked` | `declared` | `critical` | `M` | `fire_and_forget_used_for_critical_operation` | `Use acknowledged async with callback/webhook or synchronous processing for critical ops` | `semgrep` (not implemented) — `{"pattern":"(?i:^\\s*(?!(?:await\|return\|const\|let\|var)\\s)(?:[\\w$.]+\\.)?[\\w$]*(?:payment\|charge\|transaction\|order)[\\w$]*\\s*\\()","languages":["js","ts","jsx","tsx"]}` |
| `flows-missing-idempotency-3` | `juicio` | `declared` | `critical` | `S` | `no_idempotency_key_for_payment` | `Require and validate Idempotency-Key header for payment endpoints` | — |
| `flows-n8n-hardcoded-secrets-7` | `runnable` | `proven` | `critical` | `XS` | `n8n_workflow_hardcoded_secrets` | `Use n8n credentials or environment variables for secrets` | `gitleaks` — ``{"regex":"(?i:(?:api[_-]?key\|access[_-]?token\|auth[_-]?token\|secret\|password\|credential)[\"']?\\s*[:=]\\s*[\"'][A-Za-z0-9_\\-./+=]{12,}[\"'])","keywords":["apiKey","api_key","token","secret","password","access_token"],"note":"WHOLE-TREE scan, stated plainly (defect 6a, 2026-10-08). This spec carried a path_regex of `(?i:workflows?\|n8n)/.*\\.json$` that the runner IGNORES: runGitleaksLite (scripts/detect/engine.mjs) walks every text file in the tree and only consults path_regex to route a spec to the git-HISTORY scan (isHistoryPathSpec, which tests the regex against `.git/`). Measured before removal: it fired on config/settings.json and on src/legacy.js, i.e. outside any workflows/ directory. The field was a scope that did nothing, so it is deleted rather than kept as a lie in the schema; the rule is global by declaration now, and the positive fixture carries a non-workflow file so that behaviour is asserted instead of assumed. Re-adding a real scope means implementing path filtering in runGitleaksLite first."}`` |
| `flows-auth-order-1` | `runnable` | `proven` | `high` | `S` | `auth_middleware_after_validation` | `Move auth middleware before validation middleware in the stack` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"app\\.use\\(\\s*[^)]*validat[\\s\\S]{0,2000}?app\\.use\\(\\s*[^)]*(?:auth\|jwt)","path_glob":"**/*.{js,ts}","max_matches":1000000}}` |
| `flows-consumer-group-lag-3` | `fuera` | `declared` | `high` | `M` | `consumer_group_lag_excessive` | `Increase consumer replicas or optimize processing speed` | — |
| `flows-dlq-on-repeat-failures-10` | `ausencia` | `declared` | `high` | `M` | `no_dead_letter_on_repeated_failures` | `Configure dead letter queue for repeatedly failing messages` | `yaml-check` |
| `flows-message-breaking-schema-2` | `runnable` | `declared` | `high` | `M` | `message_schema_breaking_change` | `Use backward-compatible changes only; add new fields as optional` | `git-log` — `{"check":"schema-breaking-change"}` |
| `flows-message-not-encrypted-9` | `juicio` | `declared` | `high` | `M` | `message_encryption_not_used_when_required` | `Encrypt sensitive message payloads using appropriate standards` | — |
| `flows-message-not-idempotent-8` | `juicio` | `declared` | `high` | `M` | `message_processing_not_idempotent` | `Make processing idempotent or use deduplication mechanism` | — |
| `flows-missing-dlq-2` | `ausencia` | `declared` | `high` | `M` | `no_dead_letter_queue_for_async` | `Configure dead letter queue for failed message inspection and replay` | `yaml-check` |
| `flows-n8n-code-node-format-2` | `runnable` | `proven` | `high` | `XS` | `n8n_code_node_returns_wrong_format` | `Return array of objects with json property: [{json: {result: value}}]` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\"type\"\\s*:\\s*\"[^\"]*[Cc]ode\"[\\s\\S]{0,3000}?\"functionCode\"\\s*:\\s*\"((?:(?!json\\s*:)[^\"\\\\]\|\\\\.)*)\"","path_glob":"**/*.json","max_matches":1000000}}` |
| `flows-n8n-no-error-handling-1` | `ausencia` | `declared` | `high` | `S` | `n8n_workflow_has_no_error_trigger` | `Add error trigger node connected to notification/escalation flow` | `node-matcher` |
| `flows-redux-mutates-state-1` | `blocked` | `declared` | `high` | `M` | `redux_store_mutations_direct` | `Return new state array: return [...state.items, newItem]` | `semgrep` (not implemented) — `{"pattern":"state.$X.push(...)","languages":["js","ts"]}` |
| `flows-dlq-not-monitored-5` | `juicio` | `declared` | `medium` | `M` | `dead_letter_queue_not_monitored` | `Set up alerts on DLQ size and regularly inspect contents` | — |
| `flows-error-leaks-stack-6` | `blocked` | `declared` | `medium` | `S` | `error_response_leaks_stack_trace` | `Configure error handler to hide stack traces in production` | `semgrep` (not implemented) — `{"pattern":"$RES.$METHOD(...).$SEND({..., stack: $ERR.stack, ...})","languages":["js","ts"]}` |
| `flows-message-ordering-needed-4` | `juicio` | `declared` | `medium` | `M` | `no_message_ordering_guarantee_when_needed` | `Use partitioning or sequencing to guarantee order when required` | — |
| `flows-message-retention-too-short-6` | `juicio` | `declared` | `medium` | `M` | `message_retention_too_short` | `Increase retention period to allow for multiple retry attempts` | — |
| `flows-message-schema-no-version-1` | `ausencia` | `declared` | `medium` | `M` | `message_schema_no_versioning` | `Add version field to message schema and support multiple versions` | `node-matcher` |
| `flows-missing-circuit-breaker-7` | `ausencia` | `declared` | `medium` | `M` | `no_circuit_breaker_for_external_calls` | `Implement circuit breaker pattern to fail fast when service is unhealthy` | `node-matcher` |
| `flows-missing-error-handler-5` | `ausencia` | `declared` | `medium` | `M` | `no_global_error_handler` | `Add global error handling middleware to catch and format errors` | `node-matcher` |
| `flows-missing-rate-limit-8` | `ausencia` | `declared` | `medium` | `M` | `no_rate_limiting_on_public_endpoints` | `Add rate limiting middleware to prevent abuse and exhaustion` | `node-matcher` |
| `flows-missing-timeout-6` | `ausencia` | `declared` | `medium` | `M` | `no_timeout_on_external_calls` | `Set reasonable timeout values (e.g., 5s connect, 15s read)` | `semgrep` (not implemented) |
| `flows-missing-visibility-timeout-9` | `ausencia` | `declared` | `medium` | `M` | `no_visibility_timeout_config` | `Set visibility timeout to exceed expected processing time` | `yaml-check` |
| `flows-n8n-no-logging-8` | `juicio` | `declared` | `medium` | `M` | `n8n_workflow_no_logging_or_auditing` | `Add Set nodes to log key values or use n8n's built-in execution logging` | — |
| `flows-n8n-no-retry-5` | `ausencia` | `declared` | `medium` | `M` | `n8n_workflow_no_retry_on_failed_nodes` | `Enable retry on failed nodes with appropriate backoff` | `node-matcher` |
| `flows-n8n-no-timeout-4` | `ausencia` | `declared` | `medium` | `M` | `n8n_workflow_missing_timeout_handling` | `Set reasonable timeout values on all HTTP Request nodes` | `node-matcher` |
| `flows-n8n-no-validation-6` | `juicio` | `declared` | `medium` | `M` | `n8n_workflow_no_data_validation` | `Add IF nodes or Function nodes to validate input data` | — |
| `flows-n8n-schedule-format-3` | `runnable` | `declared` | `medium` | `XS` | `n8n_schedule_trigger_interval_not_array` | `Use array format: [5] for minutes, [0,12] for hours, etc.` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\"(?:triggerIntervals\|minutes\|hours)\"\\s*:\\s*\"[^\"]*(?:every\|daily\|weekly\|monthly\|hour\|minute\|day)[^\"]*\"","path_glob":"**/*.json","max_matches":1000000}}` |
| `flows-n8n-too-many-nodes-10` | `runnable` | `declared` | `medium` | `L` | `n8n_workflow_excessive_node_count` | `Consolidate sequential functions and remove unnecessary nodes` | `node-matcher` — `{"matcher":"max-occurrences","params":{"pattern":"\"typeVersion\"\\s*:","path_glob":"**/*.json","max":30}}` |
| `flows-ngrx-selectors-not-memoized-4` | `blocked` | `declared` | `medium` | `M` | `ngrx_selectors_not_memoized` | `Use createSelector to memoize expensive computations` | `semgrep` (not implemented) — `{"pattern":"export const $SEL = ($STATE: $T) => $EXPR","languages":["ts"]}` |
| `flows-no-schema-registry-8` | `ausencia` | `declared` | `medium` | `M` | `no_schema_registry_for_events` | `Use schema registry (Confluent, AWS Glue) for version control and validation` | `node-matcher` |
| `flows-redux-side-effects-2` | `blocked` | `declared` | `medium` | `M` | `redux_reducer_side_effects` | `Keep reducers pure; move side effects to middleware or epics` | `semgrep` (not implemented) — `{"pattern":"(?s:function\\s+\\w*[Rr]educer\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,3000}?(?:\\bfetch\\s*\\(\|\\baxios\\s*\\(\|Date\\.now\\s*\\(\|Math\\.random\\s*\\(\|localStorage\\.))","languages":["js","ts"]}` |
| `flows-retry-no-backoff-4` | `runnable` | `declared` | `medium` | `XS` | `retry_without_backoff` | `Implement exponential backoff with jitter for retry attempts` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:\\bcatch\\s*\\([^)]*\\)\\s*\\{[^{}]{0,300}?\\b(?:retry\|attempt\|recall)\\w*\\s*\\()","path_glob":"**/*.{js,ts}","max_matches":1000000}}` |
| `flows-retry-no-max-5` | `runnable` | `declared` | `medium` | `XS` | `retry_without_max_attempts` | `Set maximum retry attempts (e.g., 3) before giving up` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:while\\s*\\(\\s*(?:true\|1)\\s*\\)\\s*\\{[\\s\\S]{0,500}?\\b(?:retry\|attempt\|recall)\\w*\\s*\\()","path_glob":"**/*.{js,ts}","max_matches":1000000}}` |
| `flows-state-expensive-update-5` | `juicio` | `declared` | `medium` | `M` | `state_update_triggers_expensive_computation` | `Use selective subscription or change detection optimization` | — |
| `flows-state-inefficient-access-7` | `runnable` | `declared` | `medium` | `M` | `state_access_patterns_inefficient` | `Use selective subscription (mapState, useSelector) for specific needs` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"useSelector\\(\\s*\\(?\\s*state\\s*\\)?\\s*=>\\s*state\\s*\\)","path_glob":"**/*.{ts,tsx,js,jsx}","max_matches":1000000}}` |
| `flows-state-missing-defaults-10` | `juicio` | `declared` | `medium` | `M` | `state_initialization_missing_defaults` | `Provide sensible default values for all state properties` | — |
| `flows-validation-placement-2` | `juicio` | `declared` | `medium` | `S` | `validation_in_controller_NOT_middleware` | `Extract validation to reusable middleware or validation layer` | — |
| `flows-vuex-denormalized-state-3` | `juicio` | `declared` | `medium` | `M` | `vuex_state_not_normalized` | `Normalize state: {users: {id: user}, posts: [{userId: 1, ...}]}` | — |
| `flows-inconsistent-response-4` | `juicio` | `declared` | `low` | `M` | `response_transformation_inconsistent` | `Standardize response format across all endpoints` | — |
| `flows-message-not-compressed-10` | `ausencia` | `declared` | `low` | `M` | `no_message_compression_for_large_payloads` | `Enable compression for payloads exceeding threshold (e.g., 10KB)` | `yaml-check` |
| `flows-message-retention-too-long-7` | `runnable` | `declared` | `low` | `S` | `message_retention_too_long` | `Implement retention policy based on business requirements` | `node-matcher` — `{"matcher":"numeric-bound","params":{"pattern":"(?i:retention[^\n]{0,40}(d+)s*(d\|day))","path_glob":"**/*.{yml,yaml,json,ts,js,py}","op":"gt","value":30}}` |
| `flows-missing-cors-9` | `ausencia` | `declared` | `low` | `S` | `no_cors_configuration` | `Configure CORS policy to restrict origins as needed` | `node-matcher` |
| `flows-missing-request-id-7` | `ausencia` | `declared` | `low` | `S` | `no_request_id_middleware` | `Add request ID middleware for tracing requests across services` | `node-matcher` |
| `flows-missing-security-headers-10` **deprecated → `security-missing-headers-10`** | `ausencia` | `declared` | `low` | `S` | `no_security_headers` | `Add security headers middleware (HSTS, CSP, X-Frame-Options, etc)` | `node-matcher` |
| `flows-n8n-no-changelog-9` | `juicio` | `declared` | `low` | `S` | `n8n_workflow_no_version_control_comments` | `Maintain changelog within workflow description or external documentation` | — |
| `flows-no-state-persistence-6` | `ausencia` | `declared` | `low` | `M` | `no_state_persistence_or_hydration` | `Implement state persistence to localStorage or sessionStorage` | `node-matcher` |
| `flows-no-time-travel-9` | `ausencia` | `declared` | `low` | `S` | `no_time_travel_debugging` | `Enable Redux DevTools or equivalent for time-travel debugging` | `node-matcher` |
| `flows-state-excessive-nesting-8` | `runnable` | `declared` | `low` | `S` | `excessive_state_nesting` | `Flatten state structure where possible for easier access` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\\bstate\\.\\w+\\.\\w+\\.\\w+\\.\\w+","path_glob":"**/*.{ts,tsx,js,jsx}","max_matches":1000000}}` |
| `flows-validation-too-early-3` | `runnable` | `declared` | `low` | `S` | `validation_too_early_in_stack` | `Ensure body parsing middleware runs before validation middleware` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"app\\.use\\(\\s*[^)]*(?:validat\|schema)[^)]*\\)[\\s\\S]{0,800}?app\\.use\\(\\s*[^)]*(?:express\\.json\|bodyParser\|urlencoded)","path_glob":"**/*.{js,ts}","max_matches":1000000}}` |

## cost — cost-analysis

- **Skill source:** `skills/cost-analysis.skill.md`
- **Rules:** 50 — `detector` 12 (runnable 8, blocked 4) · `ausencia` 12 · `juicio` 10 · `fuera` 16
- **Demonstrated:** 2 of 50 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 48 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 8 of 50 rules run (16%). The other 42: 4 blocked `detector` rules — tool not implemented (license-scan, osv-scanner) · 12 checklist-only rules · 10 rules needing judgment (Fase 3) · 16 rules out of scope.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cost-api-in-loop-3` | `runnable` | `proven` | `high` | `M` | `external_api_calls_in_loop` | `Batch API calls: process 100 items per request instead of 1` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\\b(for\|while)\\s*\\([^)]*\\)\\s*\\{[^}]{0,2000}?(fetch\\s*\\(\|axios\\s*\\.\|stripe\\s*\\.)","path_glob":"**/*.{ts,tsx,js,jsx,py,go,java}"}}` |
| `cost-db-no-pooling-10` | `runnable` | `proven` | `high` | `M` | `no_database_connection_pooling` | `Implement connection pooling (HikariCP, PgBouncer, etc.)` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"new\\s+(pg\\.)?Client\\s*\\(\|createConnection\\s*\\(\|DriverManager\\.getConnection\\s*\\(","path_glob":"**/*.{ts,js,py,java,go,kt}"}}` |
| `cost-dev-setup-missing-3` | `ausencia` | `declared` | `high` | `M` | `no_local_development_setup` | `Provide docker-compose or similar for local development` | `node-matcher` |
| `cost-export-restriction-8` | `fuera` | `declared` | `high` | `L` | `exporting_restricted_technology` | `Review export controls and obtain necessary licenses if required` | — |
| `cost-license-incompatible-1` | `blocked` | `declared` | `high` | `M` | `license_incompatible_with_commercial_use` | `Replace with permissive-licensed alternative or comply with GPL obligations` | `license-scan` (not implemented) — `{"allowlist":["MIT","MIT-0","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC","Zlib","Unlicense","0BSD","Python-2.0"]}` |
| `cost-license-share-alike-3` | `blocked` | `declared` | `high` | `L` | `license_requires_share_alike_not_followed` | `Either comply with GPL or replace with compatible alternative` | `license-scan` (not implemented) — `{"allowlist":["MIT","MIT-0","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC","Zlib","Unlicense","0BSD","Python-2.0"]}` |
| `cost-llm-very-high-usage-2` | `fuera` | `declared` | `high` | `L` | `openai_calls_estimated` | `Consider fine-tuning smaller model or implementing response caching` | — |
| `cost-no-automated-tests-4` | `ausencia` | `declared` | `high` | `M` | `no_automated_testing_in_ci` | `Add automated testing stage to catch regressions early` | `yaml-check` |
| `cost-no-code-review-6` | `fuera` | `declared` | `high` | `L` | `code_review_process_absent` | `Implement pull request review process with required approvals` | — |
| `cost-non-commercial-use-6` | `blocked` | `declared` | `high` | `L` | `using_evaluation_or_non_commercial_license` | `Purchase proper commercial licenses or switch to free alternative` | `license-scan` (not implemented) — `{"allowlist":["MIT","MIT-0","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC","Zlib","Unlicense","0BSD","Python-2.0","GPL-2.0","GPL-3.0","AGPL-3.0","LGPL-2.1","LGPL-3.0","MPL-2.0","EPL-2.0"]}` |
| `cost-api-no-client-rate-limit-4` | `juicio` | `declared` | `medium` | `M` | `no_api_rate_limiting_client_side` | `Implement client-side rate limiting to stay within free tiers` | — |
| `cost-api-no-idempotency-7` | `runnable` | `declared` | `medium` | `M` | `api_call_without_idempotency_key` | `Add idempotency key header to prevent duplicate charges on retry` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"stripe\\.(charges\|paymentIntents\|payment_intents\|subscriptions)\\.[a-zA-Z]+\\s*\\(","path_glob":"**/*.{ts,tsx,js,jsx,py,go,java}"}}` |
| `cost-api-no-response-cache-5` | `juicio` | `declared` | `medium` | `M` | `no_api_response_caching` | `Implement caching layer (Redis, Memorable, or in-memory) for idempotent calls` | — |
| `cost-api-no-retry-strategy-8` | `ausencia` | `declared` | `medium` | `M` | `no_api_error_retry_strategy` | `Implement retry strategy with exponential backoff and jitter` | `node-matcher` |
| `cost-api-no-usage-monitoring-9` | `juicio` | `declared` | `medium` | `M` | `no_api_usage_monitoring` | `Implement API usage monitoring and alerting` | — |
| `cost-api-wrong-tier-6` | `juicio` | `declared` | `medium` | `M` | `using_expensive_api_when_cheaper_available` | `Evaluate if lower-cost payment processor meets requirements` | — |
| `cost-db-backup-4` | `runnable` | `declared` | `medium` | `M` | `database_backups_not_optimized` | `Implement incremental backup strategy with periodic full backups` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(0\\s+0\\s+\\*\\s+\\*\\s+\\*[^\\n]*(pg_dump\|mysqldump\|mongodump)\|\\b(pg_dump\|mysqldump\|mongodump)\\b[^\\n]*--(clean\|full\|format=t))","path_glob":"**/*.{sh,cron,yml,yaml,conf}"}}` |
| `cost-db-growth-3` | `fuera` | `declared` | `medium` | `M` | `database_storage_growing_rapidly_without_archival` | `Implement archival strategy for inactive data` | — |
| `cost-db-pool-5` | `fuera` | `declared` | `medium` | `M` | `database_connection_pool_misconfigured` | `Right-size connection pool to match actual concurrent usage` | — |
| `cost-deprecated-version-10` | `blocked` | `declared` | `medium` | `M` | `using_deprecated_or_unsafe_version` | `Update to current stable version for security and support` | `osv-scanner` (not implemented) — `{"unmaintained_months":12}` |
| `cost-documentation-poor-7` | `ausencia` | `declared` | `medium` | `M` | `no_documentation_or_outdated` | `Maintain up-to-date documentation as part of definition of done` | `node-matcher` |
| `cost-flaky-tests-5` | `fuera` | `declared` | `medium` | `M` | `test_flakiness_rate_high` | `Fix flaky tests: use mocks, control timing, isolate dependencies` | — |
| `cost-gha-high-usage-1` | `fuera` | `declared` | `medium` | `M` | `actions_minutes_month` | `Consider self-hosted runners saving ~$0.008/minute after threshold` | — |
| `cost-gha-infinite-artifacts-6` | `ausencia` | `declared` | `medium` | `M` | `no_artifact_retention_policy` | `Set retention period: keep artifacts for 30 days then delete` | `yaml-check` |
| `cost-gha-matrix-inefficient-10` | `juicio` | `declared` | `medium` | `M` | `no_matrix_optimization` | `Optimize matrix to exclude unnecessary combinations` | — |
| `cost-gha-no-dependency-cache-5` | `ausencia` | `declared` | `medium` | `M` | `no_caching_dependencies` | `Cache node_modules between workflow runs` | `yaml-check` |
| `cost-gha-no-timeout-9` | `ausencia` | `declared` | `medium` | `M` | `no_workflow_timeout` | `Set reasonable timeout: timeout-minutes: 60` | `yaml-check` |
| `cost-gha-wasteful-retries-3` | `fuera` | `declared` | `medium` | `S` | `workflow_runs_daily` | `Fix root causes of failures to reduce wasted compute` | — |
| `cost-license-attribution-missing-2` | `ausencia` | `declared` | `medium` | `M` | `license_requires_attribution_missing` | `Add required attribution to documentation and/about page` | `node-matcher` |
| `cost-llm-high-usage-1` | `fuera` | `declared` | `medium` | `M` | `openai_calls_estimated` | `Implement caching, use smaller models for simple tasks, optimize prompts` | — |
| `cost-no-http-compression-9` | `ausencia` | `declared` | `medium` | `M` | `no_http_compression` | `Enable HTTP compression to reduce bandwidth usage by 60-80%` | `node-matcher` |
| `cost-no-knowledge-sharing-8` | `fuera` | `declared` | `medium` | `M` | `no_knowledge_sharing_process` | `Implement regular knowledge sharing sessions and documentation` | — |
| `cost-no-license-tracking-5` | `ausencia` | `declared` | `medium` | `M` | `no_license_compliance_tracking` | `Implement automated license compliance checking (FOSSA, Snyk License)` | `node-matcher` |
| `cost-no-oss-policy-9` | `ausencia` | `declared` | `medium` | `M` | `no_open_source_license_policy` | `Create and implement open source use policy` | `node-matcher` |
| `cost-no-performance-budget-10` | `ausencia` | `declared` | `medium` | `M` | `no_performance_budgeting` | `Establish performance budgets and monitor against them` | `node-matcher` |
| `cost-overprovisioned-k8s-1` | `fuera` | `declared` | `medium` | `M` | `k8s_requests` | `Right-size resource requests to match actual usage` | — |
| `cost-overprovisioned-k8s-limits-2` | `runnable` | `declared` | `medium` | `M` | `k8s_limits` | `Adjust limits to match node capacity or add larger nodes` | `yaml-check` — `{"file_glob":"**/*.{yaml,yml}","check":"presence","pattern":"limits:[\\s\\S]{0,300}?(cpu:\\s*[\"']?[3-9]\\d*m?\\b\|memory:\\s*[\"']?([4-9]\|[1-9]\\d+)(Gi\|G)\\b)"}` |
| `cost-patent-risk-4` | `fuera` | `declared` | `medium` | `M` | `patent_licensing_risk_not_evaluated` | `Conduct patent landscape review or obtain legal opinion` | — |
| `cost-redis-as-db-6` | `juicio` | `declared` | `medium` | `M` | `redis_used_as_primary_database` | `Use Redis for caching only; use proper database for persistence` | — |
| `cost-slow-build-1` | `fuera` | `declared` | `medium` | `M` | `build_time` | `Optimize build process: incremental builds, caching, parallelization` | — |
| `cost-slow-tests-2` | `fuera` | `declared` | `medium` | `M` | `test_suite_time` | `Parallelize tests, use test selection, optimize slow tests` | — |
| `cost-technical-debt-high-9` | `fuera` | `declared` | `medium` | `M` | `technical_debt_ratio_high` | `Allocate sprint capacity for technical debt reduction` | — |
| `cost-trademark-risk-7` | `juicio` | `declared` | `medium` | `M` | `trademark_infringement_risk` | `Conduct trademark search and choose distinct name` | — |
| `cost-unoptimized-images-8` | `runnable` | `declared` | `medium` | `M` | `no_image_optimization` | `Implement image optimization pipeline (format conversion, compression, resizing)` | `node-matcher` — `{"matcher":"file-presence","params":{"path_glob":"**/{assets,public,static,images,img}/**/*.{jpg,jpeg,png}"}}` |
| `cost-api-deprecated-endpoint-10` | `runnable` | `declared` | `low` | `S` | `using_deprecated_api_endpoint` | `Migrate to newer API version for better performance and pricing` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(api\\.twitter\\.com/1\\.[01]/\|graph\\.facebook\\.com/v([0-9]\|1[01])\\b\|api\\.facebook\\.com/v([0-9]\|1[01])\\b)","path_glob":"**/*.{ts,tsx,js,jsx,py,go,java,kt}"}}` |
| `cost-gha-always-on-8` | `runnable` | `declared` | `low` | `S` | `no_selective_branch_tracking` | `Use branches: [main, 'releases/**'] to limit workflow triggers` | `yaml-check` — `{"file_glob":".github/workflows/*.{yml,yaml}","check":"presence","pattern":"(\\n\\s{2}(push\|pull_request):(?!.*branches)\|on:\\s*\\[[^\\]]*(push\|pull_request)[^\\]]*\\])"}` |
| `cost-gha-concurrent-limit-7` | `juicio` | `declared` | `low` | `M` | `concurrent_job_limit_not_optimized` | `Adjust concurrency limits to match actual usage patterns` | — |
| `cost-gha-expensive-runner-4` | `juicio` | `declared` | `low` | `M` | `workflow_uses_expensive_os_for_simple_task` | `Use self-hosted runners with appropriate software for cost savings` | — |
| `cost-gha-public-usage-2` | `fuera` | `declared` | `low` | `M` | `actions_minutes_month` | `Monitor usage to avoid unexpected charges if repo goes private` | — |
| `cost-missing-cdn-7` | `juicio` | `declared` | `low` | `S` | `cdn_not_used_for_static_assets` | `Use CDN to offload static asset delivery and reduce origin load` | — |

## github — github-intelligence

- **Skill source:** `skills/github-intelligence.skill.md`
- **Rules:** 32 — `detector` 19 (runnable 18, blocked 1) · `ausencia` 1 · `juicio` 1 · `fuera` 11
- **Demonstrated:** 10 of 32 rules are `proven` (a non-empty `positive/` and `negative/` fixture set exists on disk); the other 22 are `declared` — asserted, not yet demonstrated.
- **Enforced today:** 18 of 32 rules run (56%). The other 14: 1 blocked `detector` rule — tool not implemented (github-api) · 1 checklist-only rule · 1 rule needing judgment (Fase 3) · 11 rules out of scope.

| rule | status | provenance | severity | effort | condition | remediation (verbatim) | tool / spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `github-issue-health-3` | `fuera` | `declared` | `high` | `M` | `issue` | `Triage and close stale backlog items; an unbounded backlog hides real defects` | — |
| `github-log-pattern-6` | `runnable` | `proven` | `high` | `S` | `debug` | `Set production log level to info or higher; debug output can leak payloads and secrets` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(?i:(LOG_LEVEL\|log[_-]?level)\\s*[:=]\\s*['\"]?(debug\|trace))","path_glob":"**/*.{env,yaml,yml,json,ts,js,py}"}}` |
| `github-commit-history-1` | `runnable` | `proven` | `medium` | `M` | `commits` | `Treat as low-activity: confirm maintainer availability before depending on the project` | `git-log` — `{"check":"commit-rate","op":"lt","threshold":2}` |
| `github-commit-history-6` | `runnable` | `declared` | `medium` | `M` | `merge` | `Review the branch strategy; long-lived branches delay integration and hide conflicts` | `git-log` — `{"check":"no-merge-refs","threshold":50}` |
| `github-commit-history-9` | `runnable` | `proven` | `medium` | `M` | `average` | `Encourage smaller commits; large diffs make review and bisection unreliable` | `git-log` — `{"check":"commit-size-lines","threshold":500}` |
| `github-issue-health-1` | `fuera` | `declared` | `medium` | `M` | `median` | `Add a triage rotation or auto-response; slow triage lets the backlog grow` | — |
| `github-issue-health-11` | `fuera` | `declared` | `medium` | `S` | `labeled` | `Apply a label taxonomy; unlabeled issues cannot be triaged at scale` | — |
| `github-issue-health-5` | `fuera` | `declared` | `medium` | `M` | `PR` | `Introduce a review checklist; shallow review lets defects through` | — |
| `github-issue-health-7` | `fuera` | `declared` | `medium` | `M` | `stale` | `Close or relabel stale issues; unresolved noise erodes trust in the tracker` | — |
| `github-issue-health-9` | `fuera` | `declared` | `medium` | `M` | `PR` | `Find and remove the review bottleneck (owner, PR size, flaky CI)` | — |
| `github-log-pattern-2` | `runnable` | `declared` | `medium` | `M` | `error` | `File the recurring signature as a defect and fix the root cause, not the symptom` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\b([Ee]rror\|[Ee]xception\|[Ff]atal)\b","path_glob":"**/*.log","max_matches":1000000}}` |
| `github-log-pattern-4` | `runnable` | `declared` | `medium` | `S` | `security` | `Confirm alerting on these events; unexplained attempts indicate probing` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(401\|403)\|[Aa]uth(entication\|orization)s+(failed\|error)\|invalids+(token\|credentials)","path_glob":"**/*.log","max_matches":1000000}}` |
| `github-log-pattern-5` | `juicio` | `declared` | `medium` | `M` | `audit` | `Add append-only audit logging for privileged actions to close the compliance gap` | — |
| `github-log-pattern-9` | `ausencia` | `declared` | `medium` | `M` | `no` | `Treat as an observability gap only after confirming the deployment does not log elsewhere` | `node-matcher` |
| `github-commit-history-10` | `runnable` | `proven` | `low` | `S` | `late` | `Surface as a sustainability signal, not as a technical severity` | `git-log` — `{"check":"commit-hour-distribution","threshold":20}` |
| `github-commit-history-2` | `runnable` | `proven` | `info` | `XS` | `commits` | `No action required — high activity confirms active maintenance` | `git-log` — `{"check":"commit-rate","op":"gt","threshold":20}` |
| `github-commit-history-3` | `runnable` | `proven` | `info` | `XS` | `refactor` | `No action required — flag elevated regression risk during the refactor window` | `git-log` — `{"check":"commit-message-pattern","pattern":"refactor","threshold":30}` |
| `github-commit-history-4` | `runnable` | `proven` | `info` | `XS` | `feature` | `No action required — feature-focused development signal` | `git-log` — `{"check":"commit-message-pattern","pattern":"feature","threshold":50}` |
| `github-commit-history-5` | `runnable` | `proven` | `info` | `XS` | `bugfix` | `No action required — quality-focused maintenance signal; watch for recurring defect areas` | `git-log` — `{"check":"commit-message-pattern","pattern":"bugfix","threshold":40}` |
| `github-commit-history-7` | `runnable` | `proven` | `info` | `XS` | `squash` | `No action required — clean-history preference; note reduced git-blame granularity` | `git-log` — `{"check":"squash-dominance","threshold":70}` |
| `github-commit-history-8` | `runnable` | `proven` | `info` | `XS` | `commit` | `No action required — good hygiene signal` | `git-log` — `{"check":"commit-message-pattern","pattern":"conventional","threshold":80}` |
| `github-issue-health-10` | `fuera` | `declared` | `info` | `XS` | `PR` | `No action required — efficient review process signal` | — |
| `github-issue-health-12` | `blocked` | `declared` | `info` | `XS` | `labeled` | `No action required — good organization signal` | `github-api` (not implemented) — `{"check":"label-hygiene","threshold":80}` |
| `github-issue-health-2` | `fuera` | `declared` | `info` | `XS` | `median` | `No action required — responsive maintenance signal` | — |
| `github-issue-health-4` | `fuera` | `declared` | `info` | `XS` | `issue` | `No action required — healthy resolution rate` | — |
| `github-issue-health-6` | `fuera` | `declared` | `info` | `XS` | `PR` | `No action required — thorough review process signal` | — |
| `github-issue-health-8` | `fuera` | `declared` | `info` | `XS` | `stale` | `No action required — good issue hygiene signal` | — |
| `github-log-pattern-1` | `runnable` | `declared` | `info` | `XS` | `application` | `No action required — operational visibility signal` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\b([Ww]inston\|[Pp]ino\|[Ll]og4[jJ]\|[Ll]ogback\|[Ll]ogrotate)\b\|[Ll]ogging.ya?ml","path_glob":"**/*","max_matches":1000000}}` |
| `github-log-pattern-10` | `runnable` | `declared` | `info` | `XS` | `structured` | `No action required — machine-readable logging signal` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"(^\|\n)s*{[^\n]*\\\"(level\|msg\|message\|timestamp\|time)\\\"s*:","path_glob":"**/*.log","max_matches":1000000}}` |
| `github-log-pattern-3` | `runnable` | `declared` | `info` | `XS` | `access` | `No action required — usage insight signal; use it to scope hot paths` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"\b(GET\|POST\|PUT\|DELETE)\b[^\n]*HTTP/1.[01]\\\" [0-9]{3}","path_glob":"**/*.log","max_matches":1000000}}` |
| `github-log-pattern-7` | `runnable` | `declared` | `info` | `XS` | `log` | `No action required — good ops practice signal` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"[Ll]ogrotate\|maxFiles\|maxSize\|retention\|[Rr]otation","path_glob":"**/*.{json,yaml,yml,toml,xml,conf,properties,js,ts,py}","max_matches":1000000}}` |
| `github-log-pattern-8` | `runnable` | `declared` | `info` | `XS` | `centralized` | `No action required — mature observability signal` | `node-matcher` — `{"matcher":"file-content-regex","params":{"pattern":"[Ff]ilebeat\|[Ff]luentd\|[Pp]romtail\|[Ll]ogstash\|[Cc]loudwatch\|[Ll]oki\|\bELK\b","path_glob":"**/*.{json,yaml,yml,toml,xml,conf}","max_matches":1000000}}` |

## Integrity of this catalog

- Canonical rules parsed from `skills/*.skill.md`: **368**.
- Rules classified in `skills/detectors.json`: **368**.
- Rules catalogued above: **368** (equals the registry total 368).
- Retired rules kept in the catalog (`deprecated`, never deleted, so past reports that cite them keep resolving): **1** — `flows-missing-security-headers-10` → `security-missing-headers-10`.
- Fixture provenance read live from `tests/fixtures/detectors/`: **49** rule id(s) have a fixture directory, **49** have a non-empty `positive/` **and** `negative/` set and are therefore `proven` (`code-empty-catch-1`, `code-exact-duplication-massive-1`, `code-exact-duplication-minor-3`, `code-exact-duplication-significant-2`, `code-extreme-complexity-1`, `code-extreme-length-6`, `code-generic-catch-2`, `code-god-object-6`, `code-high-complexity-2`, `code-logs-secrets-10`, `code-mutable-default-3`, `code-sql-injection-risk-4`, `cost-api-in-loop-3`, `cost-db-no-pooling-10`, `database-idle-timeout-missing-4`, `database-not-null-violation-4`, `database-sequential-pagination-1`, `flows-auth-order-1`, `flows-n8n-code-node-format-2`, `flows-n8n-hardcoded-secrets-7`, `github-commit-history-1`, `github-commit-history-10`, `github-commit-history-2`, `github-commit-history-3`, `github-commit-history-4`, `github-commit-history-5`, `github-commit-history-7`, `github-commit-history-8`, `github-commit-history-9`, `github-log-pattern-6`, `security-binary-dep-10`, `security-cors-wildcard-2`, `security-db-conn-string-6`, `security-debug-in-prod-1`, `security-env-file-committed-3`, `security-gha-action-unpinned-5`, `security-gha-fork-pr-4`, `security-gha-overpermissive-2`, `security-gha-pr-target-risk-1`, `security-gha-secret-leak-3`, `security-gha-workspace-not-cleaned-6`, `security-jwt-weak-3`, `security-oauth-secret-8`, `security-private-key-7`, `security-secret-in-code-1`, `security-secret-in-history-2`, `security-vcs-insecure-9`, `structure-inverted-dependency-2`, `structure-layer-violation-1`); the other **319** rules are `declared`. Run `node scripts/detect/test-fixtures.mjs` to execute the gate over these sets.
- Blocked-tool set (from `scripts/detect/engine.mjs`): `github-api`, `license-scan`, `npm-audit`, `osv-scanner`, `semgrep`.
- Tools declared in this ruleset (from `skills/detectors.json`): `git-log`, `github-api`, `gitleaks`, `license-scan`, `node-matcher`, `osv-scanner`, `semgrep`, `yaml-check`.

Regenerate with `node scripts/gen-rules-doc.mjs`; verify with `node scripts/gen-rules-doc.mjs --check`.
