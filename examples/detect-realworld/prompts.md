# Remediation prompts (C2) — one per finding, in report order

Generated deterministically from the rule registry — no LLM wrote these. Every prompt cites its rule. A `proven` finding carries a direct fix prompt. Destructive actions (rotate/revoke/rewrite history) are flagged and must be confirmed by a human — never auto-executed. Only critical/high findings carry prompts (the rest live in the report appendix; a 555KB prompt file is a wall, not a plan).

## 1. security-jwt-weak-3 [critical] — src/app/routes/auth/auth.ts:16

Rule cited: security-jwt-weak-3 (score 150, label `proven`)

```text
You are fixing one finding in the repository at examples/detect-realworld/repo.
Rule: security-jwt-weak-3 (jwt_secret_default_or_short) — severity critical, effort XS.
Location: src/app/routes/auth/auth.ts:16
Evidence: secret: process.env.JWT_SECRET || 'superSecret',
Remediation (from the rule registry, skills/security-assessment.skill.md): Use strong random secret (minimum 32 bytes) from secure source
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 2. security-jwt-weak-3 [critical] — src/app/routes/auth/auth.ts:21

Rule cited: security-jwt-weak-3 (score 150, label `proven`)

```text
You are fixing one finding in the repository at examples/detect-realworld/repo.
Rule: security-jwt-weak-3 (jwt_secret_default_or_short) — severity critical, effort XS.
Location: src/app/routes/auth/auth.ts:21
Evidence: secret: process.env.JWT_SECRET || 'superSecret',
Remediation (from the rule registry, skills/security-assessment.skill.md): Use strong random secret (minimum 32 bytes) from secure source
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 3. security-jwt-weak-3 [critical] — src/app/routes/auth/token.utils.ts:4

Rule cited: security-jwt-weak-3 (score 150, label `proven`)

```text
You are fixing one finding in the repository at examples/detect-realworld/repo.
Rule: security-jwt-weak-3 (jwt_secret_default_or_short) — severity critical, effort XS.
Location: src/app/routes/auth/token.utils.ts:4
Evidence: jwt.sign({ user: { id } }, process.env.JWT_SECRET || 'superSecret', {
Remediation (from the rule registry, skills/security-assessment.skill.md): Use strong random secret (minimum 32 bytes) from secure source
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 4. database-sequential-pagination-1 [high] — src/app/routes/article/article.service.ts:71

Rule cited: database-sequential-pagination-1 (score 65, label `proven`)

```text
You are fixing one finding in the repository at examples/detect-realworld/repo.
Rule: database-sequential-pagination-1 (sequential_count_and_findmany_on_paginated_endpoint) — severity high, effort S.
Location: src/app/routes/article/article.service.ts:71
Evidence: const articlesCount = await prisma.article.count({
Remediation (from the rule registry, skills/database-assessment.skill.md): Run both queries concurrently: const [count, rows] = await Promise.all([countQuery, listQuery])
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 5. database-sequential-pagination-1 [high] — src/app/routes/article/article.service.ts:114

Rule cited: database-sequential-pagination-1 (score 65, label `proven`)

```text
You are fixing one finding in the repository at examples/detect-realworld/repo.
Rule: database-sequential-pagination-1 (sequential_count_and_findmany_on_paginated_endpoint) — severity high, effort S.
Location: src/app/routes/article/article.service.ts:114
Evidence: const articlesCount = await prisma.article.count({
Remediation (from the rule registry, skills/database-assessment.skill.md): Run both queries concurrently: const [count, rows] = await Promise.all([countQuery, listQuery])
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

