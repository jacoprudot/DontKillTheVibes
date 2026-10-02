# Handoff — Estado del proyecto (post Fases 3/4, 2026-09-29)

## Qué pasó en la última sesión

1. **Auditoría crítica exhaustiva** del toolkit (MCPs, skills/agents, infra, pruebas).
2. **Fixes de seguridad en MCPs**: eliminado RCE por diseño (`profile_code` con allowlist
   `node/python/python3`, sin shell), inyección de shell en git-mcp cerrada
   (`execFileSync` + validación de refs), sandbox honesto (env mínimo, cleanup),
   audit log real en `.dontkillthevibes/audit.log`, SECURITY.md reescritos
   declarando solo lo enforceado.
3. **Herramientas rotas arregladas**: `find_large_files` (crash ESM), `suggest_load_test`
   (era placeholder), `measure_throughput` (`concentration`→`concurrency`, concurrencia real),
   `analyze_resource_usage` (honra `pid`), `compare_benchmarks`/`identify_resource_contention`
   (leen del workspace vía PathGuard), wrk stdout capturado.
4. **Infra**: recursión de turbo eliminada, lockfile pnpm commiteado, `.turbo/` ignorado,
   `package-lock.json` borrado, workspaces muertos removidos.
5. **Contrato enforceable**: `scripts/validate-assessment.mjs` valida `assessment.json`
   contra `templates/finding-schema.json`.
6. **Primera corrida end-to-end real** contra `temp/realworld/`: 7 hallazgos conformes
   (VALID, 0 warnings) en `examples/realworld-assessment/`. Comparación vs baseline en
   `COMPARISON.md` — detectó el JWT crítico (`superSecret`) que el baseline de Gemini omitió.
7. Push a `origin/master` (4 commits). El repo migró a `jacoprudot/DontKillTheVibes`
   (mayúsculas); conviene: `git remote set-url origin https://github.com/jacoprudot/DontKillTheVibes.git`.

## Mapa de verificación (todo debe seguir pasando)

| Chequeo | Comando | Esperado |
|---|---|---|
| Build | `pnpm build` | Tasks: 2 successful |
| Validar skills | `pnpm validate:skills` | 8 skill(s) valid |
| Validar MCPs | `pnpm validate:mcps` | 2 MCP package(s) valid |
| Validar assessment | `node scripts/validate-assessment.mjs examples/realworld-assessment/assessment.json` | VALID: 7 findings, 0 warnings |
| Smoke seguridad | `node scripts/mcp-smoke.mjs mcps/git-mcp/dist/index.js get_diff_since '{"since_commit":"HEAD; id"}'` | INVALID_COMMIT |
| RCE bloqueado | `node scripts/mcp-smoke.mjs mcps/benchmark-mcp/dist/index.js profile_code '{"binary":"rm","args":["-rf","/"],"profiler":"perf"}'` | BINARY_NOT_ALLOWED |

## Arquitectura actual (post-pivote)

- MCPs custom: `mcps/git-mcp`, `mcps/benchmark-mcp` (compilan a ESM, `"type": "module"`).
- Oficiales vía `mcp_config.json`: `github`, `filesystem` + los 2 custom (`git-mcp`, `benchmark-mcp`).
- Skills/agents referencian los servers como `github`/`filesystem` (no `github-mcp`).
- Resultados MCP: payload interno `{success,data,error:{code,message,retryable}}` envuelto
  en `content` blocks protocol-conformant. Audit log con hashes (nunca contenido).
- Workspace pnpm: solo `mcps/*`. Scripts raíz usan `--filter=./mcps/*` **sin comillas**
  (las comillas simples rompen el filtro en Windows).

## Baselines y evidencia

- `examples/gemini-baseline/` — reportes de Gemini (simulated run, NON-CONFORMANT a
  propósito; deben FALLAR el validador si se les pasa el JSON).
- `examples/realworld-assessment/` — corrida real conforme (assessment.json + report + COMPARISON).
- Objetivos de prueba: `temp/realworld/` (RealWorld API, NestJS+Prisma), `temp/chilo-legal/`
  (backend legal Node/Python — **aún sin assessment versionado**).

## Brechas conocidas (la próxima sesión empieza aquí)

1. **Tests unitarios MCPs**: `pnpm test` corre jest pero no hay archivos de test —
   último falso verde. Spec original pedía >80% cobertura.
2. **CI pendiente**: `.github/workflows/` vacío. Mínimo: ci.yml (install → build →
   validate:skills/mcps → smoke tests). Necesita los tests unitarios primero.
3. **benchmark-mcp sin ejercitar con carga real**: la corrida de realworld fue estática
   (servidor no corría). Pendiente el "Quick Baseline Protocol" de la skill de performance.
4. **Corrida sobre `temp/chilo-legal`** para tener el segundo caso versionado.
5. **Pipeline automatizable**: hoy el synthesis-agent se ejecuta por el LLM anfitrión
   leyendo skills/agents; no existe un runner que orqueste los 8 agentes en paralelo.
6. **Reglas [requires-runtime-data]**: skills marcan qué reglas necesitan telemetría
   (DB en vivo, GHA minutes, consumer lag) — el comportamiento "skip con confianza
   reducida" está documentado pero no medido en una corrida real.
7. Menores: `scripts/validate-skills.mjs`/`validate-mcps.mjs` validan estructura, no
   profundidad de árboles; `get_blame` numera líneas relativas al rango (offset), no
   absolutas; symlink escape en PathGuard conocido (chequeo léxico, documentado en SECURITY.md).

## Convenciones que debe respetar la próxima sesión

- Todo output de assessment debe pasar `scripts/validate-assessment.mjs` antes de considerarse hecho.
- IDs de hallazgo canónicos viven en los árboles de los skills; ejemplos usan los mismos IDs.
- Priorización: score = peso_severidad(100/50/20/5/1) × peso_módulo(security 1.5…github 0.7) × confianza; security siempre primero.
- No reintroducir `execSync` con strings ni `...process.env` en hijos — los smoke tests existen para atraparlo.
