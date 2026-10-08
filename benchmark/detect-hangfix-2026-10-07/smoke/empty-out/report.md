# DontKillTheVibes — deterministic assessment

- target: `C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\detect-hangfix-2026-10-07\smoke\emptydir`
- files scanned: 0 · test/spec/fixture files excluded: 0 · rules run: 136 · skipped (tool not implemented): 50
- overall health: **C*** (worst-severity grade over detector findings; 0 critical)
- ⚠️ **grade capped by coverage**: coverage could not be computed (the scan failed, or no non-binary file was in scope): an unknown scope is not evidence of health (uncapped letter: A)
- 0 detector finding(s) + 6 checklist gap(s) — an ausencia hit means a safeguard is MISSING, not that a violation was found
- every detector finding is a raw mechanical signal (label `probado`) — verify by hand (file:line) before acting; precision is NOT yet measured (see protocol in PLAN.md)

## Coverage — what this run could actually see

A tool that audits code must never present partial coverage as complete. This block is the machine-readable `coverage` object in `findings.json`.

- non-binary files (scan candidates): **0** of 0 files in the tree (0 binary)
- matched by ≥1 rule path-glob: 0 · **matched by NO rule path-glob: 0** (0.0%)
- whole-tree rules (no path filter, or a catch-all glob like `**/*`: a secret/boilerplate scan touching every file is NOT language coverage): `code-boilerplate-repetition-7`, `flows-n8n-hardcoded-secrets-7`, `github-log-pattern-1`, `security-db-conn-string-6`, `security-oauth-secret-8`, `security-private-key-7`, `security-secret-in-code-1`
- extensions seen (files, uncovered by any rule): 
- skipped by declared policy: gitignored 0 · test/spec/fixture 0 · binary 0
- skipped by read guards (named, never silent): 0
- read-guard limits in force: whole-file regex content ≤ 262144 chars · line ≤ 2000 chars · reader cap 524288 bytes

## Rule failures (named, never silent)

None: every runnable rule ran to completion (136 run). Degraded tools (not implemented) are listed under the ruleset coverage below.

## Truncated counts (floors, not totals)

No rule hit the 20-findings-per-rule cap, so the counts below are totals.

## Work plan (30/60/90)

Bucketing is deterministic: critical+high → 30 days, medium → 60, low/info → 90; order inside a phase is severity × module weight.

### 30 days (0)


### 60 days (0)


### 90 days (0)


## Findings — critical & high (0), grouped by file

## Appendix: medium / low / info (0)

One line each, priority order. These are signals, not the plan — verify before acting.


## Checklist gaps — ausencia checks (6)

These prove a safeguard is MISSING (a timeout, a budget, a monitor). They are not violations and carry no severity: a missing thing is missing in every repo until it isn't. Grouped by rule; fix is "add the safeguard", no per-finding prompt needed.

### cost-dev-setup-missing-3 (no_local_development_setup) — 1 file(s)

Missing in: `(repo root)`

Add: Provide docker-compose or similar for local development

### cost-documentation-poor-7 (no_documentation_or_outdated) — 1 file(s)

Missing in: `(repo root)`

Add: Maintain up-to-date documentation as part of definition of done

### cost-no-license-tracking-5 (no_license_compliance_tracking) — 1 file(s)

Missing in: `(repo root)`

Add: Implement automated license compliance checking (FOSSA, Snyk License)

### cost-no-oss-policy-9 (no_open_source_license_policy) — 1 file(s)

Missing in: `(repo root)`

Add: Create and implement open source use policy

### cost-no-performance-budget-10 (no_performance_budgeting) — 1 file(s)

Missing in: `(repo root)`

Add: Establish performance budgets and monitor against them

### github-log-pattern-9 (no) — 1 file(s)

Missing in: `(repo root)`

Add: Treat as an observability gap only after confirming the deployment does not log elsewhere

## Coverage vs baseline ruleset (paso D)

- Canonical registry: 368 rules
- Mechanical (detector/ausencia): 186 — fired: 6 · ran clean: 130 · not runnable yet (tool degraded, listed in findings.json): 50 · failed (error/budget): 0
- Findings per rule are capped at 20: 0 rule(s) stopped at the cap (their counts are floors)
- `juicio`: 116 — not evaluated by this engine (Fase 3; would carry label `juzgado`)
- `fuera`: 66 — out of scope by design

Degraded tools (named, never silent): code-bare-except-1 (semgrep), code-bare-except-with-others-2 (semgrep), code-boolean-parameter-plague-11 (semgrep), code-callback-hell-10 (semgrep), code-catch-and-continue-9 (semgrep), code-deep-inheritance-9 (semgrep), code-error-assigned-unused-2 (semgrep), code-extreme-nesting-4 (semgrep), code-high-nesting-5 (semgrep), code-loose-equality-1 (semgrep), code-loose-inequality-2 (semgrep), code-missing-error-main-10 (semgrep), code-nested-ternary-9 (semgrep), code-print-statement-5 (semgrep), code-print-statement-8 (semgrep), code-slice-append-in-loop-6 (semgrep), code-unchecked-error-1 (semgrep), code-var-usage-3 (semgrep), cost-deprecated-version-10 (osv-scanner), cost-license-incompatible-1 (license-scan), cost-license-share-alike-3 (license-scan), cost-non-commercial-use-6 (license-scan), flows-error-leaks-stack-6 (semgrep), flows-fire-and-forget-critical-1 (semgrep), flows-message-breaking-schema-2 (git-log), flows-missing-timeout-6 (semgrep), flows-ngrx-selectors-not-memoized-4 (semgrep), flows-redux-mutates-state-1 (semgrep), flows-redux-side-effects-2 (semgrep), github-commit-history-1 (git-log), github-commit-history-10 (git-log), github-commit-history-2 (git-log), github-commit-history-3 (git-log), github-commit-history-4 (git-log), github-commit-history-5 (git-log), github-commit-history-6 (git-log), github-commit-history-7 (git-log), github-commit-history-8 (git-log), github-commit-history-9 (git-log), github-issue-health-12 (github-api), security-cve-critical-1 (osv-scanner), security-cve-high-2 (osv-scanner), security-cve-medium-3 (osv-scanner), security-exploit-in-wild-5 (osv-scanner), security-license-incompatible-6 (license-scan), security-no-security-maintenance-7 (osv-scanner), security-secret-in-history-2 (gitleaks), security-transitive-vuln-8 (osv-scanner), security-unmaintained-dep-4 (osv-scanner), structure-singleton-violation-5 (semgrep)
