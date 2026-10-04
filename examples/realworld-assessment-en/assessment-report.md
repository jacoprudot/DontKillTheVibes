# Assessment Report: realworld-control

- **Repository**: realworld-control
- **Date**: 2026-10-03T22:28:39.134Z
- **Model**: nvidia/nemotron-3-super-120b-a12b
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F (worst severity: critical — graded by `scripts/dktv-grade.mjs`, not judgement)
- **Critical Findings**: 2
- **Total Findings**: 6
- **By Severity**: critical 2 · high 1 · medium 2 · low 1
- **Estimated Total Effort**: 1×XS, 3×S, 1×M, 1×L
- **Top 3 Priorities**:
  - `security-jwt-weak-3` — JWT secret has a default weak value 'superSecret' (critical, XS)
  - `database-sequential-pagination-1` — Sequential count and findMany queries in getArticles and getFeed functions causing extra database roundtrip (high, S)
  - `code-any-type-6` — Use of 'any' type in function parameter loses type safety (medium, S)

---

## Detailed Findings (by Priority)

### Priority 1: `security-jwt-weak-3`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.9
**Location**: `src/app/routes/auth/auth.ts:16`
**Description**: JWT secret has a default weak value 'superSecret'
**Remediation**: Remove the default value and require JWT_SECRET to be set in environment variables
**Depends On**: None | **Blocks**: None

### Priority 2: `database-sequential-pagination-1`
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.9
**Location**: `src/app/routes/article/article.service.ts:20`
**Description**: Sequential count and findMany queries in getArticles and getFeed functions causing extra database roundtrip
**Remediation**: Execute count and findMany queries concurrently using Promise.all in both functions
**Depends On**: None | **Blocks**: None

### Priority 3: `code-any-type-6`
**Module**: code | **Severity**: medium | **Effort**: S | **Confidence**: 0.9
**Location**: `src/app/routes/article/article.service.ts:15`
**Description**: Use of 'any' type in function parameter loses type safety
**Remediation**: Replace 'any' with a specific type, e.g., define a Query interface for the query object
**Depends On**: None | **Blocks**: None

### Priority 4: `code-missing-return-type-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.9
**Location**: `src/app/routes/article/article.mapper.ts:3`
**Description**: Missing return type on function
**Remediation**: Add return type annotation
**Depends On**: None | **Blocks**: None

### Priority 5: `flows-missing-rate-limit-8`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.9
**Location**: `src/app/routes/auth/auth.controller.ts:29`
**Description**: Public login endpoint lacks rate limiting enabling brute force attacks
**Remediation**: Add rate limiting middleware to the login endpoint
**Depends On**: None | **Blocks**: None

### Priority 6: `database-irreversible-migration-1`
**Module**: database | **Severity**: critical | **Effort**: L | **Confidence**: 0.9
**Location**: `src/prisma/migrations/20211001143221_implicit_tags/migration.sql:13`
**Description**: Migration drops the ArticleTags table without data backup strategy
**Remediation**: Add a data migration step to preserve data before dropping the table, or avoid dropping tables in production
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-jwt-weak-3`: Remove the default value and require JWT_SECRET to be set in environment variables (XS)
- `database-sequential-pagination-1`: Execute count and findMany queries concurrently using Promise.all in both functions (S)
- `code-any-type-6`: Replace 'any' with a specific type, e.g., define a Query interface for the query object (S)
- `code-missing-return-type-8`: Add return type annotation (S)

### 60 Days
- `flows-missing-rate-limit-8`: Add rate limiting middleware to the login endpoint (M)

### 90 Days
- `database-irreversible-migration-1`: Add a data migration step to preserve data before dropping the table, or avoid dropping tables in production (L)

---

## Dependencies
- —

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
