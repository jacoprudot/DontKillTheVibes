# Assessment Report: realworld (gothinkster RealWorld API, temp/realworld)

## Executive Summary
- **Overall Health**: C
- **Critical Findings**: 1
- **Estimated Total Effort**: S (3×XS, 3×S, 1×M)
- **Top 3 Priorities**:
  - `security-jwt-weak-3` — JWT secret con fallback hardcodeado 'superSecret' (score 142.5)
  - `database-sequential-pagination-1` — count + findMany secuenciales (score 58.5)
  - `database-overfetch-relation-1` — carga completa de relación favoritedBy (score 55.25)

**Priorización**: score = peso_severidad × peso_módulo × confianza
(critical=100/high=50; security=1.5, database=1.3, code=1.0). Security siempre
oprime primero; el orden resultante coincide con la regla.

---

## Detailed Findings (by Priority)

### Priority 1: `security-jwt-weak-3`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.95
**Location**: `src/app/routes/auth/auth.ts:16` (también :21, `token.utils.ts:4`)
**Description**: El secreto JWT cae al default público `'superSecret'` si `JWT_SECRET`
no está definido. Cualquier despliegue sin la env var acepta tokens firmados con un
secreto conocido — bypass total de autenticación.
**Remediation**: Eliminar el fallback (fallar al arrancar si falta la env var),
rotar tokens firmados con el default, validar env vars en el boot.
**Evidence**: `secret: process.env.JWT_SECRET || 'superSecret'`
**Depends On**: None | **Blocks**: None

### Priority 2: `database-sequential-pagination-1`
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.9
**Location**: `src/app/routes/article/article.service.ts:71` (`getArticles`; repetido en `getFeed` :114-122)
**Description**: Los endpoints paginados ejecutan `prisma.article.count()` y
`prisma.article.findMany()` como dos awaits secuenciales. El count bloquea al
findMany, duplicando la latencia de I/O en los reads más calientes.
**Remediation**: `const [articlesCount, articles] = await Promise.all([count, findMany])` en ambas funciones.
**Evidence**: `const articlesCount = await prisma.article.count({...}); const articles = await prisma.article.findMany({...})`
**Depends On**: None | **Blocks**: None

### Priority 3: `database-overfetch-relation-1`
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.85
**Location**: `src/app/routes/article/article.service.ts:98` (8+ sitios: :98 :101 :147 :150 :229 :232 :260 :263 :373 :376 :588 :591 :634 :637)
**Description**: `favoritedBy: true` carga la relación many-to-many completa a
memoria solo para calcular `favoritedBy.some(f => f.id === id)` (:601, :647). Un
artículo con miles de favoritos agota la memoria por request.
**Remediation**: Reemplazar el include por existencia filtrada:
`favoritedBy: { where: { id: userId }, select: { id: true } }`, o extender el
patrón `_count` ya usado para `favoritesCount`.
**Evidence**: `include: { ... favoritedBy: true ... }` + `article.favoritedBy.some((favorited: any) => favorited.id === id)`
**Depends On**: `database-sequential-pagination-1` | **Blocks**: None

### Priority 4: `code-missing-validation-4`
**Module**: code | **Severity**: high | **Effort**: M | **Confidence**: 0.9
**Location**: `src/app/routes/article/article.service.ts:69` (`getArticles`; patrón en todos los controllers)
**Description**: No existe validación en ninguna frontera de la API: los servicios
reciben `query: any` / `body: any` directo de `req`. Parámetros de paginación,
slugs y payloads de auth no se validan antes de llegar a Prisma.
**Remediation**: Middleware de validación (zod/class-validator) en todas las
rutas; tipar estrictamente las entradas de los servicios.
**Evidence**: `export const getArticles = async (query: any, id?: number) => {`
**Depends On**: None | **Blocks**: `code-any-type-6`

### Priority 5: `security-cors-wildcard-2`
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.9
**Location**: `src/main.ts:13`
**Description**: `app.use(cors())` sin opciones habilita `Access-Control-Allow-Origin: *` en todas las rutas.
**Remediation**: `cors({ origin: ['https://frontend'], credentials: true })` con allowlist explícita.
**Evidence**: `app.use(cors());`
**Depends On**: None | **Blocks**: None

### Priority 6: `code-any-type-6`
**Module**: code | **Severity**: medium | **Effort**: S | **Confidence**: 0.85
**Location**: `src/app/routes/article/article.service.ts:69` (`getArticles`; mappers :601/:647)
**Description**: `any` en interfaces públicas/servicio (`query: any`, `favorited: any`), anulando el type-safety exactamente en la superficie de la API.
**Remediation**: DTOs para query/body (`ArticleQuery { tag?; author?; limit?; offset? }`); tipos generados de Prisma en los mappers.
**Evidence**: `export const getArticles = async (query: any, id?: number) => { ... favoritedBy.some((favorited: any) => ...`
**Depends On**: `code-missing-validation-4` | **Blocks**: None

### Priority 7: `security-error-detail-1`
**Module**: security | **Severity**: info | **Effort**: XS | **Confidence**: 0.7
**Location**: `src/main.ts:44`
**Description**: El handler global devuelve `err.message` crudo con HTTP 500, pudiendo filtrar texto interno de excepciones a clientes.
**Remediation**: Log completo del error del lado servidor; mensaje genérico al cliente.
**Evidence**: `} else if (err) { res.status(500).json(err.message); }`
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan

### 30 Days (Quick Wins)
- `security-jwt-weak-3`: quitar fallback y validar env var (XS)
- `security-cors-wildcard-2`: allowlist CORS (XS)
- `security-error-detail-1`: mensaje genérico en 500 (XS)
- `database-sequential-pagination-1`: paralelizar count+findMany (S)
- `database-overfetch-relation-1`: existencia filtrada en favoritedBy (S)

### 60 Days (Core Fixes)
- `code-any-type-6`: DTOs y tipos Prisma en mappers (S)

### 90 Days (Strategic)
- `code-missing-validation-4`: middleware de validación en toda la API (M)

---

## Appendix
- All findings in JSON: `assessment.json` (validado con `scripts/validate-assessment.mjs`: VALID, 7 findings, 0 warnings)
- Methodology: dontkillthevibes toolkit v0.1.0-beta
- Run: real end-to-end — git-mcp vía stdio (blame: commit `e40aeb92`, autor upstream) para evidencia histórica; benchmark-mcp no ejercitado (servidor objetivo no en ejecución); árboles de decisión de skills aplicados manualmente con IDs canónicos
- Comparación con baseline: ver `COMPARISON.md`
