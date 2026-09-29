# Comparación: corrida real end-to-end vs baseline Gemini (simulated)

Mismo objetivo (`temp/realworld`, RealWorld API). Baseline:
`../gemini-baseline/assessment-realworld-simulated.md`. Corrida:
`./assessment.json` + `./assessment-report.md` (esta carpeta).

## Cobertura

| Métrica | Gemini (simulated) | DKTV real |
|---|---|---|
| Hallazgos totales | 3 | 7 |
| Criticals | 0 | 1 |
| Highs | 1 | 3 |
| Hallazgos de security | 0 | 3 |
| Instancias del patrón favoritedBy reportadas | 1 (1 ubicación) | 1 hallazgo, 14 ubicaciones citadas |
| Patrón count+findMany | 1 ubicación | ambas funciones (getArticles + getFeed) |

## Falsos negativos del baseline que la corrida real detectó

- **`security-jwt-weak-3`** (critical): fallback `'superSecret'` en auth.ts:16/:21 y
  token.utils.ts:4. El baseline lo omitió por completo — es el hallazgo más grave
  del repo.
- **`security-cors-wildcard-2`**: `app.use(cors())` sin restricción (main.ts:13). Omitido.
- **`security-error-detail-1`**: error handler filtra `err.message` crudo (main.ts:44). Omitido.
- **Repetición del patrón de paginación**: el baseline citó una función; el patrón
  existe en dos (getArticles :71, getFeed :114).

## Conformidad con el contrato

| Chequeo | Gemini | DKTV real |
|---|---|---|
| IDs `^[a-z-]+-\d+$` | ❌ `PERF-01` | ✅ |
| Enum de módulos | ❌ "Performance" | ✅ |
| Enum de effort | ❌ `M/L` | ✅ |
| `confidence` 0–1 | ❌ ausente | ✅ en los 7 |
| `assessment.json` | ❌ no generado | ✅ |
| Algoritmo de priorización | ❌ contradicho | ✅ scores calculados, security primero |
| Validación automática | n/a | ✅ `VALID: 7 findings, 0 warnings` |

## Interpretación

- La corrida real encontró **más, más grave y conforme**. El baseline de Gemini fue
  preciso en lo que reportó (sus 3 hallazgos coinciden con hallazgos 2, 3 y 4 de
  esta corrida) pero omitió toda la superficie de security — exactamente el tipo de
  omisión que un proceso sistemático (árboles de decisión por módulo) existe para
  prevenir.
- Limitación honesta de esta corrida: benchmark-mcp no se ejercitó (el servidor
  realworld no estaba corriendo), por lo que los hallazgos de performance son
  estáticos. La skill de performance marca este caso como "baseline protocol"
  pendiente.
- Limitación del baseline que sigue aplicando: la corrida aplicó los árboles de
  forma manual/orquestada por un agente; la ejecución automatizada completa
  (8 agentes paralelos invocados por el synthesis-agent) aún no está implementada
  como pipeline ejecutable.
