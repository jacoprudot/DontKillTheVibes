# Handoff — Estado del proyecto (2026-10-02)

## Qué se hizo en esta sesión (auditoría + hardening)

Revisión completa del toolkit con verificación en ejecución, y corrección de los
bloqueadores que impedían publicar el repo con credibilidad.

**1. CI nunca había pasado (4/4 runs en rojo). Causa raíz:**
`mcps/benchmark-mcp/src/tools/analyze-resource-usage.test.ts` comparaba contra el
valor de Windows (`123456/1024`) de forma incondicional, mientras el mock POSIX
devuelve `126464` → fallo determinista en ubuntu-latest. Arreglado: la expectativa
ahora sigue a la plataforma. Verificado forzando `process.platform='linux'`.

**2. Umbral de cobertura muerto.** Ambas jest configs declaraban
`coverageThreshold` (80%) pero **no** activaban `collectCoverage`, y el script era
`jest` sin `--coverage` → el umbral nunca se evaluaba. Ahora `collectCoverage: true`
en los dos paquetes (86–88% ramas observado, por encima del umbral).

**3. `security:audit` era un falso verde** (`echo "Security audit placeholder" && exit 0`)
y a nivel raíz ni existía como tarea de turbo. Ahora hay `scripts/security-audit.mjs`:
chequeo estático offline que falla ante `shell: true`, `execSync`/`exec`/`spawn`,
`eval` y spreads de `...process.env` en `mcps/*/src`, y exige `SECURITY.md` por paquete.
Declarado en `turbo.json`.

**4. El smoke test no podía correr.** `scripts/mcp-smoke.mjs` exige 3 argumentos pero
CI lo invocaba desnudo. Reescrito: valida argumentos (exit 2 con usage), detecta
servidor ausente, tiene timeout duro, captura el throw sincrónico de `spawn`, y
**asertá** el resultado con `--expect`. CI ahora ejecuta dos pruebas de inyección
(`INVALID_COMMIT`, `BINARY_NOT_ALLOWED`).

**5. Vacíos de seguridad cerrados en benchmark-mcp** (verificado en ejecución):
inyección de argumentos al XML del plan JMeter (`connections`/`duration_sec` como
string colaban el `<= 0` y metían un `<JSR223Sampler>` ejecutable), `&` sin escapar,
patrones `$` de `String.replace`, y el script wrk generado no era Lua válido.

**6. El validador no sostenía el pitch.** `scripts/validate-assessment.mjs` ahora
valida tipos del schema, `description` no vacía, `location.line` entero, unicidad,
**registro canónico de IDs** (leído de `skills/*.skill.md`), integridad de
`work_plan`/`relatedFindings` y tallies de `summary`. Ya no crashea con `findings:[null]`.
Flag `--no-registry` para sets de skills propios.

**7. ID canónicos alineados.** El ejemplo E2E usaba 2 IDs mal numerados y 3 que no
existían en ningún skill; `github-intelligence.skill.md` no definía ni un ID. Corregido
en skills + ejemplo.

**8. Documentación honesta.** README (cobertura, CI, validador, módulo GitHub,
`requires-runtime-data` → "Data Availability"), `templates/security-model.md`
(se eliminó el claim falso de Memory 512MB/CPU 50% y la contradicción de
"No Persistent State") y este HANDOFF.

## Preparación del lanzamiento público (2026-10-02)

- **CTAs de conversión en el README** (3): uno arriba tras el tagline, uno después del
  ejemplo real, y una sección "Work with me" con la oferta de auditoría pagada. Todos
  apuntan a `mailto:jaco@leongael.xyz` con asunto y cuerpo prellenados. Pendiente:
  probar Calendly (convierte mejor) y poner un ancla de precio.
- **Baseline de Gemini reetiquetado.** El repo lo titulaba *"simulated run"*, lo que
  hacía parecer un hombre de paja lo que es evidencia real. Los outputs de Gemini se
  conservan **verbatim** (renombrados a `*-gemini-raw.md`, sin editar una coma) y el
  README del baseline explica que "simulated" se refería a los **MCPs desconectados**,
  no a hallazgos inventados.
- **`--emit-digest`** en `scripts/dktv-assess.mjs`: escribe el digest exacto (JSON) y
  sale 0 **sin necesitar API key**. Existe para que el benchmark alimente los dos brazos
  con input byte-idéntico.
- **Benchmark reproducible** en `benchmark/`: dos brazos con el mismo modelo y el mismo
  digest (prompt ingenuo vs. toolkit), juicio ciego con verificación mecánica de
  grounding, y los outputs crudos versionados como evidencia.
- **El benchmark NO se ha ejecutado todavía.** Los 5 objetivos ya están en
  `benchmark/repos.json`, verificados por API de GitHub el 2026-10-02 (públicos, sin
  archivar, MIT, tamaño contenido): `realworld-control` (control),
  `Nutlope/roomGPT`, `abi/screenshot-to-code`, `Nutlope/llamacoder`,
  `mckaywrigley/chatbot-ui`. **Limitación declarada**: 2 de 4 son del mismo autor
  (Next.js) y 3 de 4 son TypeScript — muestra de conveniencia, no representativa.
  Las credenciales NIM ya están disponibles y verificadas (ver sección anterior).
  No inventar resultados: la tabla de `benchmark/README.md` se llena solo con una
  corrida real.

## Verificación con modelos reales (NVIDIA NIM, 2026-10-02)

Config del autor: provider `nvidia`, baseURL `https://integrate.api.nvidia.com/v1`,
key en `~/.config/opencode/.env` como `NVIDIA_API_KEY`. Modelos verificados:
`nvidia/nemotron-3-super-120b-a12b` y `nvidia/nemotron-3-ultra-550b-a55b` — ambos
responden 200 con `content` correcto.

**Hallazgo que cambió el producto.** Primera corrida real contra `temp/realworld`
(digest de 30k chars) con el prompt de entonces: el modelo devolvió 5 hallazgos con IDs
de forma correcta pero **inventados** (`code-any-type-1`, `code-env-var-check-1`,
`code-nx-lint-config-1`, `code-eslint-ignore-pattern-1`, `performance-docker-expose-1`)
→ el validador rechazó los 5. Causa: el contrato pedía la *forma* del id pero nunca
decía "cópialo del registro", y los 394 IDs están enterrados en 221k chars de skills.

**Fix.** `buildSystemPrompt` inyecta ahora una sección `# Canonical rule ID registry`
con los 394 IDs (uno por línea) y una regla explícita: el id se copia verbatim,
inventarlo es violación de contrato, y si no hay regla que aplique se omite el hallazgo.
Misma corrida y mismo modelo tras el fix: 1 hallazgo, id `code-any-type-6`
(**canónico**), `VALID: 1 findings, 0 warning(s)`.

**Trade-off honesto que el benchmark debe medir:** la conformidad pasó de 0/5 a 1/1,
pero el modelo reportó 1 hallazgo en vez de 5. Precisión arriba, recall posiblemente
abajo. Eso es exactamente lo que los 5 repos tienen que cuantificar.

**`max_tokens` era un bug latente.** Estos modelos razonan: la corrida gastó 12 977
tokens de razonamiento de 13 293 de salida, así que el default viejo de 8192 habría
**truncado** la respuesta. `dktv-assess.mjs` acepta `--max-tokens` y detecta
`finish_reason: length`, avisando en consola y en el mensaje de reintento.

**Límite del entorno (no del producto).** En el sandbox de DSH, `spawn`/`spawnSync`
fallan con `EPERM` incluso redirigiendo stdio. Por eso el runner no puede validar (lanza
el validador como subproceso) ni el harness puede clonar. Ambos funcionan en una
terminal normal. Esta verificación se hizo invocando el prompt exacto del `--dry-run` y
el validador real por separado.

## B2 — orquestador multi-agente (2026-10-03)

**Qué es.** `scripts/dktv-orchestrate.mjs` + `scripts/lib/repo-files.mjs` (nuevos). Hace
correr de verdad a los **8 especialistas** de `agents/*-analyst.md`, que hasta ahora no
se ejecutaban en ninguna ruta del producto: cada módulo hace 2 rondas (ronda 1 = pide
los archivos que necesita viendo solo el árbol; ronda 2 = emite hallazgos con el
contenido real). Síntesis **determinista en código** (merge, dedupe, score
severidad × módulo × confianza, fases). 16 llamadas por repo, cero para la síntesis.

**Verificado.** P0–P4 offline (aislamiento, help, dry-run sin key, mock + validador, y
**prueba de fuga con señuelos reales**: `.env` y `.pem` retenidos, 0 coincidencias en
todas las salidas). Corrida real sobre el control: **21 findings, `VALID`, 16 llamadas,
exit 0**, 8 `modules/*.json`.

**Lo que salió bien:**
- `security` pidió `src/app/routes/auth/auth.ts` **por sí solo** — el punto entero de B2.
- `metadata` lo estampa el runner: `llm_used: nvidia/nemotron-3-super-120b-a12b`. Se
  acabaron los nombres de agente inventados (`synthesis-agent-v1`, etc.).
- Recall 4/7 exactos vs 2/7 del single-pass, y el JWT recuperado **en sustancia**.

**Los dos defectos que B2 destapó (lo importante):**
1. **Citas débiles: 9/21 (43%)**, peor que el 33% del single-pass. Y no es falta de
   acceso: los agentes **leyeron** los archivos correctos y aun así citaron imports,
   llaves sueltas, `*/` o líneas vacías. **Diagnóstico: es selección de línea, no de
   archivo → B3 (MCPs) NO arreglaría esto.** Ese hallazgo es lo que justificó hacer B2
   antes que B3.
2. **Severidad subvalorada por regla genérica:** el JWT se reportó como
   `security-secret-in-code-1` (high) en vez de `security-jwt-weak-3` (critical), con la
   línea correcta y la evidencia en el snippet. En una auditoría que se cobra, subvalorar
   un bypass de auth es grave → hace falta la regla "gana la más específica".

**Consecuencia para B3 (decisión de negocio).** B3 sigue valiendo, pero por **cobertura
de datos**, no por citas: el módulo `github` produce 0–1 findings porque sin API solo
infiere del árbol (sus reglas tech-stack pasaron a `→ PROFILE:`), y `performance` no
puede medir runtime sin `benchmark-mcp`. Frontera open-core: **B2 público** (cumple la
promesa del README y da el benchmark medible) y **B3 privado** (el producto que se
cobra). Consecuencia documental: el README no puede insinuar que el CLI usa los MCPs —
hoy `git-mcp` y `benchmark-mcp` son código muerto en la ruta del CLI.

**Siguiente:** clasificador post-hoc de línea + reintento dirigido (en curso), y después
integrar B2 como brazo C del benchmark **cuando Kimi cierre** su ronda del harness. Plan
completo de validación en `docs/internal/B2_VALIDATION_PLAN.md`.

## Mapa de verificación (todo debe seguir pasando)

| Chequeo | Comando | Esperado |
|---|---|---|
| Build | `pnpm build` | Tasks: 2 successful |
| Tests + gate 80% | `pnpm test` | 244 tests, cobertura ≥80% |
| Auditoría de seguridad | `pnpm security:audit` | 2 successful (1 warning esperado: binary variable en `sandbox.ts`) |
| Validar skills | `pnpm validate:skills` | 8 skill(s) valid |
| Validar MCPs | `pnpm validate:mcps` | 2 MCP package(s) valid |
| Contrato del ejemplo | `node scripts/validate-assessment.mjs examples/realworld-assessment/assessment.json` | VALID: 7 findings, 0 warning(s) |
| Digest (sin API key) | `node scripts/dktv-assess.mjs --target examples/realworld-assessment --emit-digest temp\d.json` | exit 0 + JSON escrito |
| Smoke: ref con shell | `node scripts/mcp-smoke.mjs mcps/git-mcp/dist/index.js get_diff_since '{"since_commit":"HEAD; id"}' --expect INVALID_COMMIT` | SMOKE OK |
| Smoke: RCE bloqueado | `node scripts/mcp-smoke.mjs mcps/benchmark-mcp/dist/index.js profile_code '{"binary":"rm","args":["-rf","/"],"profiler":"perf"}' --expect BINARY_NOT_ALLOWED` | SMOKE OK |

## Gotchas del entorno (importante para la próxima sesión)

- **`pnpm test` puede devolver un cache hit de turbo** (`FULL TURBO`) y parecer verde sin
  ejecutar nada. Para forzar: `pnpm test --force`.
- **`jest` con su pool de workers falla con `spawn EPERM` dentro del sandbox de DSH**
  (stdio por pipes). Para correr tests localmente usar `--runInBand`:
  `mcps/<pkg>/node_modules/.bin/jest.cmd --runInBand`. Los 4 tests de
  `src/sandbox.test.ts` que lanzan `node` fallan por esta razón en Windows/sandbox y
  pasan en Linux CI.
- `pnpm security:audit` corre con cache de turbo; `inputs` son `src/**` + `SECURITY.md`.

## Arquitectura actual

- MCPs custom: `mcps/git-mcp`, `mcps/benchmark-mcp` (ESM, `"type": "module"`).
- Oficiales vía `mcp_config.json`: `github`, `filesystem` + los 2 custom.
- Envelope interno `{success,data,error:{code,message,retryable}}` envuelto en
  `content` blocks. Audit log con digests truncados (nunca contenido).
- Workspace pnpm: solo `mcps/*`. Scripts raíz usan `--filter=./mcps/*` sin comillas.
- **Pendiente de verificar**: `@modelcontextprotocol/server-github` está deprecado en
  npm ("Package no longer supported") y se lanza con `npx -y` sin versión fija.

## Brechas conocidas (próxima sesión empieza aquí)

1. **Fuga de archivos sensibles**: RESUELTO. `dktv-assess.mjs` excluye por nombre
   `.env*`, `*.pem/key/p12/pfx/jks/keystore`, `id_rsa*`, `credentials*`, `.npmrc`,
   `.netrc`, honra el `.gitignore` del repo objetivo, y **avisa al LLM en el prompt**
   de que esos archivos se retuvieron — sin ese aviso el LLM podía firmar "no hay
   secretos". Verificado con señuelos: 0 apariciones del secreto y del PEM.
   **Brecha que queda:** el digest recorre el *filesystem*, así que no distingue
   "commiteado" de "ignorado"; para evaluar de verdad `security-env-file-committed-3`
   haría falta `git ls-files`.
2. **Sin `maxBuffer`** en `execFileSync` (git-wrapper y sandbox): un diff >1 MiB falla
   con `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` y se reporta como fallo *retryable*.
   Contradice `git-mcp/SECURITY.md:41`.
3. **`git blame` con rango** numera líneas desde 1 (debería usar `parts[2]` del
   porcelain) y hereda autor/tiempo del hunk anterior.
4. **Percentiles con off-by-one** (`Math.floor(len*p)` en vez de `Math.ceil(p*n)-1`).
5. **Números sin validación finita** en `measure_latency`/`measure_throughput`:
   `duration_sec` omitido → `{success:true, rps:0}` silencioso en vez de error.
6. **Nombres de herramientas fantasma** en agentes/skills: `git-mcp.get_commit_history`,
   `filesystem.glob_search` (la real es `search_files`), `filesystem.parse_log_file`.
7. **5 de 8 agentes** declaran un artefacto de resumen con nombre distinto al de su skill.
8. **Dos formas incompatibles** del documento de assessment: la de
   `agents/synthesis-agent.md` (phases=array, dependencies=map) y la que instruye
   `dktv-assess.mjs` (phases=objeto, dependencies=array).
9. **CI en verde sin confirmar**: el primer run tras el push debe verificarse; el
   workflow ahora valida también el ejemplo y los smoke tests.
10. **Sin agente github en el pipeline**: el skill ya tiene IDs canónicos, pero no hay
    corrida real que los ejercite.

## Convenciones que debe respetar la próxima sesión

- Todo output de assessment debe pasar `scripts/validate-assessment.mjs` antes de
  considerarse hecho (ahora también exige IDs canónicos).
- Los IDs canónicos viven **solo** en los árboles de `skills/*.skill.md` (`→ FINDING: <id>`).
  No renombrar IDs existentes: otros artefactos los referencian.
- Priorización: `score = peso_severidad(100/50/20/5/1) × peso_módulo(security 1.5…github 0.7) × confianza`.
- No reintroducir `execSync` con strings, `shell: true` ni `...process.env`: hay un
  gate (`pnpm security:audit`) y smoke tests que lo atrapan.
