# Assessment Report: [redacted]/legal-rag-app

## Executive Summary
- **Overall Health**: C+
- **Critical Findings**: 2
- **Estimated Total Effort**: M (Medium)
- **Top 3 Priorities**: 
  - `PERF-01` (Main Thread Blocking by Transformers)
  - `SEC-01` (Network Mode Host in Docker Compose)
  - `CODE-01` (Lack of TypeScript / Type Safety)

---

## Detailed Findings (by Priority)

### Priority 1: `PERF-01`
**Module**: Performance | **Severity**: Critical | **Effort**: S
**Location**: `src/` (Rutas de IA)
**Description**: La dependencia `@xenova/transformers` está instalada en Node.js. Si se están generando embeddings o reranking localmente dentro del mismo proceso de Express, esto bloqueará el Event Loop de Node.js, dejando la aplicación inaccesible bajo carga moderada.
**Remediation**: Mover la inferencia de `transformers.js` a un `Worker Thread` de Node.js o extraerlo a un microservicio en Python.
**Evidence**: `package.json` incluye `@xenova/transformers`, el cual ejecuta inferencia síncrona en el thread principal si no se encapsula.
**Depends On**: None
**Blocks**: None

### Priority 2: `SEC-01`
**Module**: Security | **Severity**: Critical | **Effort**: XS
**Location**: `docker-compose.yml:73`
**Description**: El servicio `ingest` utiliza `network_mode: host`. Esto anula el aislamiento de red de Docker para este contenedor, exponiendo potencialmente servicios locales del servidor al contenedor.
**Remediation**: Usar el enrutamiento interno nativo de Docker. Eliminar `network_mode: host` y hacer que `ingest` llame a `http://app:3003` utilizando el DNS interno de Docker Compose (`[internal-network]`).
**Evidence**: Línea 73: `network_mode: host`
**Depends On**: None
**Blocks**: None

### Priority 3: `CODE-01`
**Module**: Code Quality | **Severity**: High | **Effort**: M/L
**Location**: Todo el proyecto (`src/`)
**Description**: El proyecto está escrito en JavaScript puro (`type: "module"`) sin TypeScript. Dada la complejidad del dominio (Legal, pasarelas de pago con Stripe, orquestación de LLMs), la falta de tipos estrictos incrementa drásticamente el riesgo de errores en tiempo de ejecución.
**Remediation**: Migrar incrementalmente a TypeScript o añadir JSDoc con validación de tipos activada (`checkJs: true`).
**Evidence**: Falta de `typescript` en `package.json`.
**Depends On**: None
**Blocks**: `DB-01`

### Priority 4: `DB-01`
**Module**: Database | **Severity**: Medium | **Effort**: M
**Location**: Consultas de base de datos
**Description**: Se está utilizando `pg` puro sin un ORM (como Prisma o Drizzle) ni un Query Builder. Esto es propenso a inyecciones SQL si no se usan consultas parametrizadas rigurosamente y dificulta la evolución del esquema y las migraciones.
**Remediation**: Introducir un ORM o al menos una herramienta de migraciones formal para gestionar el esquema de la base de datos de manera determinista.
**Evidence**: `package.json` depende de `pg` nativo sin librerías de migraciones asociadas.
**Depends On**: `CODE-01`
**Blocks**: None

---

## 30/60/90 Day Plan

### 30 Days (Quick Wins)
- **`SEC-01`**: Eliminar `network_mode: host` y usar la red de Docker para comunicación interna. (effort: XS)
- **`PERF-01`**: Aislar la ejecución de `@xenova/transformers` usando Worker Threads. (effort: S)

### 60 Days (Core Fixes)
- **`DB-01`**: Configurar un sistema de migraciones para PostgreSQL que reemplace la creación manual de tablas. (effort: M)

### 90 Days (Strategic)
- **`CODE-01`**: Comenzar migración progresiva a TypeScript empezando por los controladores de Stripe y lógica central (JSDoc o archivos `.ts`). (effort: L)

---

## Appendix
- Methodology: dontkillthevibes toolkit v0.1.0
- Assessed locally via Antigravity Synthesis Agent
