# Assessment Report: realworld-control

- **Repository**: realworld-control
- **Date**: 2026-10-03T20:01:54.001Z
- **Model**: nvidia/nemotron-3-super-120b-a12b
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: C
- **Critical Findings**: 2
- **Total de hallazgos**: 9
- **Por severidad**: critical 2 · high 2 · medium 3 · low 2
- **Por módulo**: database 2 · structure 1 · flows 4 · security 2
- **Estimated Total Effort**: 2×XS, 4×S, 1×M, 2×L
- **Top 3 Priorities**:
  - `database-irreversible-migration-1` — The migration drops the ArticleTags table without migrating its data to the new _ArticleToTag table, causing irreversible data loss. (critical, L) (score 117)
  - `security-jwt-weak-3` — Se utiliza un secreto JWT de respaldo hardcodeado ('superSecret') lo que representa un riesgo de seguridad si la variable de entorno no… (critical, XS) (score 100)
  - `database-missing-index-fk-1` — Missing index on foreign key column "authorId" in table "Article". (high, S) (score 58.5)

---

## Detailed Findings (by Priority)

### Priority 1: `database-irreversible-migration-1` (score 117)
**Module**: database | **Severity**: critical | **Effort**: L | **Confidence**: 0.9 | **Score**: 117
**Location**: `src/prisma/migrations/20211001143221_implicit_tags/migration.sql:15`
**Description**: The migration drops the ArticleTags table without migrating its data to the new _ArticleToTag table, causing irreversible data loss.
**Remediation**: Migrate the data from the old table to the new table before dropping the old table.
**Depends On**: None | **Blocks**: None

### Priority 2: `security-jwt-weak-3` (score 100)
**Module**: flows | **Severity**: critical | **Effort**: XS | **Confidence**: 1 | **Score**: 100
**Location**: `src/app/routes/auth/auth.ts:16`
**Description**: Se utiliza un secreto JWT de respaldo hardcodeado ('superSecret') lo que representa un riesgo de seguridad si la variable de entorno no está configurada.
**Remediation**: Eliminar el valor de respaldo y asegurar que la variable de entorno JWT_SECRET esté siempre configurada en todos los entornos.
**Depends On**: `structure-package-dependency-cycle-2` | **Blocks**: None

### Priority 3: `database-missing-index-fk-1` (score 58.5)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.9 | **Score**: 58.5
**Location**: `src/prisma/migrations/20210924225358_initial/migration.sql:90`
**Description**: Missing index on foreign key column "authorId" in table "Article".
**Remediation**: Add an index on the foreign key column to improve join performance.
**Depends On**: None | **Blocks**: None

### Priority 4: `structure-package-dependency-cycle-2` (score 49.5)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.9 | **Score**: 49.5
**Location**: `src/app/routes/article/article.service.ts:4`
**Description**: Dependency cycle detected between article, profile, and auth modules via article.service -> profile.utils -> auth.user.model -> article.article.model
**Remediation**: Break the cycle by moving the shared utils to a common module or by using dependency injection. For example, move the profileMapper to a shared utils module or pass the mapping function as a parameter.
**Depends On**: None | **Blocks**: `security-jwt-weak-3`, `flows-missing-rate-limit-8`, `flows-missing-request-id-7`, `flows-missing-security-headers-10`

### Priority 5: `security-cors-wildcard-2` (score 28.5)
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.95 | **Score**: 28.5
**Location**: `src/main.ts:13`
**Description**: CORS middleware configured with wildcard origin, allowing any origin
**Remediation**: Configure CORS with specific allowed origins instead of using wildcard
**Depends On**: None | **Blocks**: None

### Priority 6: `security-missing-headers-10` (score 28.5)
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.95 | **Score**: 28.5
**Location**: `src/main.ts:13`
**Description**: Missing security headers such as X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, etc.
**Remediation**: Implement security headers middleware (e.g., helmet) to set appropriate HTTP headers
**Depends On**: None | **Blocks**: None

### Priority 7: `flows-missing-rate-limit-8` (score 20)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 1 | **Score**: 20
**Location**: `src/main.ts`
**Description**: No se ha implementado ningún mecanismo de limitación de tasa en la aplicación, lo que podría permitir ataques de fuerza bruta o agotamiento de recursos.
**Remediation**: Agregar un middleware de limitación de tasa (como express-rate-limit) antes de definir las rutas.
**Depends On**: `structure-package-dependency-cycle-2` | **Blocks**: None

### Priority 8: `flows-missing-request-id-7` (score 5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 1 | **Score**: 5
**Location**: `src/main.ts`
**Description**: La aplicación no genera ni incluye un ID de solicitud en las respuestas o registros, lo que dificulta el rastreo y depuración de solicitudes.
**Remediation**: Implementar un middleware que genere un ID de solicitud único para cada solicitud y lo agregue a los encabezados de respuesta y/o registros.
**Depends On**: `structure-package-dependency-cycle-2` | **Blocks**: None

### Priority 9: `flows-missing-security-headers-10` (score 5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 1 | **Score**: 5
**Location**: `src/main.ts`
**Description**: La aplicación no configura cabeceras de seguridad esenciales (como HSTS, CSP, etc.), lo la deja vulnerable a diversos ataques comunes en el navegador.
**Remediation**: Integrar un middleware de cabeceras de seguridad (como helmet) para configurar automáticamente cabeceras de seguridad recomendadas.
**Depends On**: `structure-package-dependency-cycle-2` | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `database-irreversible-migration-1`: Migrate the data from the old table to the new table before dropping the old table. (L)
- `security-jwt-weak-3`: Eliminar el valor de respaldo y asegurar que la variable de entorno JWT_SECRET esté siempre configurada en todos los entornos. (XS)
- `database-missing-index-fk-1`: Add an index on the foreign key column to improve join performance. (S)
**Esfuerzo total**: XL

### 60 Days (Core Fixes)
- `structure-package-dependency-cycle-2`: Break the cycle by moving the shared utils to a common module or by using dependency injection. (L)
- `security-cors-wildcard-2`: Configure CORS with specific allowed origins instead of using wildcard (XS)
**Esfuerzo total**: XL

### 90 Days (Strategic)
- `security-missing-headers-10`: Implement security headers middleware (e.g., helmet) to set appropriate HTTP headers (S)
- `flows-missing-rate-limit-8`: Agregar un middleware de limitación de tasa (como express-rate-limit) antes de definir las rutas. (M)
- `flows-missing-request-id-7`: Implementar un middleware que genere un ID de solicitud único para cada solicitud y lo agregue a los encabezados de respuesta y/o registros. (S)
- `flows-missing-security-headers-10`: Integrar un middleware de cabeceras de seguridad (como helmet) para configurar automáticamente cabeceras de seguridad recomendadas. (S)
**Esfuerzo total**: XL

---

## Dependencias
- `security-jwt-weak-3` **Depends On** `structure-package-dependency-cycle-2`
- `flows-missing-rate-limit-8` **Depends On** `structure-package-dependency-cycle-2`
- `flows-missing-request-id-7` **Depends On** `structure-package-dependency-cycle-2`
- `flows-missing-security-headers-10` **Depends On** `structure-package-dependency-cycle-2`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
