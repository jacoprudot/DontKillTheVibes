# Remediation prompts (C2) — one per finding, in report order

Generated deterministically from the rule registry — no LLM wrote these. Every prompt cites its rule. `probado` → direct fix prompt. Destructive actions (rotate/revoke/rewrite history) are flagged and must be confirmed by a human — never auto-executed. Only critical/high findings carry prompts (the rest live in the report appendix; a 555KB prompt file is a wall, not a plan).

## 1. security-jwt-weak-3 [critical] — src/app/routes/auth/auth.ts:16

Rule cited: security-jwt-weak-3 (score 150, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: security-jwt-weak-3 (jwt_secret_default_or_short) — severity critical, effort XS.
Location: src/app/routes/auth/auth.ts:16
Evidence: secret: process.env.JWT_SECRET || 'superSecret',
Remediation (from the rule registry, skills/security-assessment.skill.md): Use strong random secret (minimum 32 bytes) from secure source
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 2. security-jwt-weak-3 [critical] — src/app/routes/auth/auth.ts:21

Rule cited: security-jwt-weak-3 (score 150, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: security-jwt-weak-3 (jwt_secret_default_or_short) — severity critical, effort XS.
Location: src/app/routes/auth/auth.ts:21
Evidence: secret: process.env.JWT_SECRET || 'superSecret',
Remediation (from the rule registry, skills/security-assessment.skill.md): Use strong random secret (minimum 32 bytes) from secure source
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 3. security-jwt-weak-3 [critical] — src/app/routes/auth/token.utils.ts:4

Rule cited: security-jwt-weak-3 (score 150, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: security-jwt-weak-3 (jwt_secret_default_or_short) — severity critical, effort XS.
Location: src/app/routes/auth/token.utils.ts:4
Evidence: jwt.sign({ user: { id } }, process.env.JWT_SECRET || 'superSecret', {
Remediation (from the rule registry, skills/security-assessment.skill.md): Use strong random secret (minimum 32 bytes) from secure source
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 4. code-extreme-complexity-1 [critical] — src/app/routes/article/article.service.ts

Rule cited: code-extreme-complexity-1 (score 100, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: code-extreme-complexity-1 — severity critical, effort L.
Location: src/app/routes/article/article.service.ts
Evidence: heuristic cyclomatic ≈ 26 (max 20); file-level approximation, not per-function
Remediation (from the rule registry, skills/code-quality-assessment.skill.md): Break into smaller functions: validateOrder, calculateTax, applyDiscounts
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 5. database-sequential-pagination-1 [high] — src/app/routes/article/article.service.ts:71

Rule cited: database-sequential-pagination-1 (score 65, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: database-sequential-pagination-1 (sequential_count_and_findmany_on_paginated_endpoint) — severity high, effort S.
Location: src/app/routes/article/article.service.ts:71
Evidence: const articlesCount = await prisma.article.count({
Remediation (from the rule registry, skills/database-assessment.skill.md): Run both queries concurrently: const [count, rows] = await Promise.all([countQuery, listQuery])
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 6. database-sequential-pagination-1 [high] — src/app/routes/article/article.service.ts:114

Rule cited: database-sequential-pagination-1 (score 65, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: database-sequential-pagination-1 (sequential_count_and_findmany_on_paginated_endpoint) — severity high, effort S.
Location: src/app/routes/article/article.service.ts:114
Evidence: const articlesCount = await prisma.article.count({
Remediation (from the rule registry, skills/database-assessment.skill.md): Run both queries concurrently: const [count, rows] = await Promise.all([countQuery, listQuery])
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 7. code-extreme-length-6 [high] — src/app/routes/article/article.controller.ts

Rule cited: code-extreme-length-6 (score 50, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: code-extreme-length-6 (nesting_depth) — severity high, effort L.
Location: src/app/routes/article/article.controller.ts
Evidence: 244 lines (max 150)
Remediation (from the rule registry, skills/code-quality-assessment.skill.md): Split into presentational and container components
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 8. code-extreme-length-6 [high] — src/app/routes/article/article.service.ts

Rule cited: code-extreme-length-6 (score 50, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: code-extreme-length-6 (nesting_depth) — severity high, effort L.
Location: src/app/routes/article/article.service.ts
Evidence: 653 lines (max 150)
Remediation (from the rule registry, skills/code-quality-assessment.skill.md): Split into presentational and container components
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 9. code-extreme-length-6 [high] — src/app/routes/auth/auth.service.ts

Rule cited: code-extreme-length-6 (score 50, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: code-extreme-length-6 (nesting_depth) — severity high, effort L.
Location: src/app/routes/auth/auth.service.ts
Evidence: 184 lines (max 150)
Remediation (from the rule registry, skills/code-quality-assessment.skill.md): Split into presentational and container components
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

## 10. code-high-complexity-2 [high] — src/app/routes/article/article.service.ts

Rule cited: code-high-complexity-2 (score 50, label `probado`)

```text
You are fixing one finding in the repository at C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\examples\detect-realworld\repo.
Rule: code-high-complexity-2 (cyclomatic_complexity) — severity high, effort M.
Location: src/app/routes/article/article.service.ts
Evidence: heuristic cyclomatic ≈ 26 (max 15); file-level approximation, not per-function
Remediation (from the rule registry, skills/code-quality-assessment.skill.md): Extract password validation and session creation to separate functions
Find every occurrence of this issue in the repository and fix it. Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.
```

