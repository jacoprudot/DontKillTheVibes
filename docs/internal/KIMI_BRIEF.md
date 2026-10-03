# Briefing para Kimi — reanudación tras la interrupción (2026-10-03)

## Qué pasó

Hubo una **interrupción de ~14 h** entre el 2026-10-02 por la noche y el 2026-10-03 al
mediodía. Durante esa ventana, el Lead (Nemo) siguió avanzando en B2 y en documentación,
**sin tocar nada de tu scope**. Este documento es para que retomes sin releer el historial.

## Reparto de escritura (respetar antes de editar)

| Zona | Dueño | Estado |
|---|---|---|
| `benchmark/**`, `scripts/dktv-assess.mjs` | **Kimi** | tuyo, intacto |
| `scripts/dktv-orchestrate.mjs`, `scripts/lib/repo-files.mjs` | Lead (B2) | funcional, verificado |
| `scripts/validate-assessment.mjs`, `examples/realworld-assessment/*` | Lead | **endurecimiento en curso ahora** |
| `README.md`, `docs/internal/*` | Lead | actualizado |
| `skills/**`, `agents/**` | Lead | 368 reglas canónicas |

Si necesitas tocar algo fuera de tu columna, dilo antes.

## Lo que ya se cerró (no lo repitas)

1. **El control estaba mal.** `benchmark/work/realworld-control` era el repo de **specs**
   (330 archivos, cero código). Corregido a `gothinkster/node-express-realworld-example-app`
   @ `30b68e1e`. La corrida anterior del control está invalidada.
2. **Juez inestable entre variantes de prompt**: 11 veredictos del brazo ingenuo se
   movieron sin cambiar una coma de los claims. Por eso ahora se publican **rangos** con
   `--repeat 3`, no decimales.
3. **`unverifiable` es un tercer veredicto**, fuera del denominador de precisión. El brazo
   ingenuo queda casi entero ahí: sus citas son rutas sin número de línea.
4. **Grounding mecánico del naive**: se reporta como `n/a*`, no como 0.
5. **Registro canónico**: **368 reglas** (las 26 `github-tech-stack-*` pasaron a `→ PROFILE:`).
6. **`location.line` débil es el defecto medido del toolkit**: 12/30 (40%) en el agregado de
   5 repos. `grounded(mech)` solo comprueba que el archivo y la línea existan, **no que la
   línea tenga algo que ver con el hallazgo**.

## Lo que está en vuelo ahora mismo

- **Endurecimiento de `validate-assessment.mjs`**: hasta hoy el validador extraía del
  registro **solo los IDs**, nunca las severidades/efforts declarados. Consecuencia real:
  una corrida emitió `security-secret-in-code-1` como `high` cuando el skill lo declara
  **`critical`** — y el validador lo aceptó. Todo el scoring
  (`severidad × módulo × confianza`) se estaba calculando sobre severidades inventadas.
  El gate nuevo exige que `severity` y `effort` coincidan con la regla.
  **Ojo:** `examples/realworld-assessment/assessment.json` tiene 1 discrepancia
  (`security-jwt-weak-3` con `effort: S` en vez de `XS`) que se está corrigiendo; si ves
  el ejemplo fallar, es esto.
- **B2 (orquestador multi-agente)**: `scripts/dktv-orchestrate.mjs`, nuevo, funcional.
  Hace correr de verdad a los 8 especialistas: ronda 1 elige archivos, ronda 2 emite
  hallazgos. 16 llamadas + hasta 8 de reparación de citas = **≤24**. Síntesis determinista.
  Verificado offline (P0–P4, incluida prueba de fuga con señuelos) y con una corrida real
  sobre el control: 21 findings, `VALID`, y **`security` pidió `auth.ts` por sí solo**.

## Hallazgo que te afecta directamente

**El problema de las citas NO es de acceso, es de selección de línea.** B2 le dio a cada
especialista el contenido real del archivo que pidió, y aun así el 43% de las citas
apuntaron a imports, llaves sueltas, `*/` o líneas vacías. Implicación: **la orquestación
sobre MCPs (B3) no arreglaría las citas.** B3 sigue valiendo, pero por **cobertura de
datos** (`github` produce 0–1 findings sin API; `performance` no puede medir runtime sin
`benchmark-mcp`), no por calidad de cita.

## Agentes que trabajaron en esta sesión

| Agente | Qué hizo | Resultado |
|---|---|---|
| Revisor A (read-only) | Auditoría de `mcps/*` + `mcp_config.json` | Encontró la inyección JMX y la ausencia de `maxBuffer` |
| Revisor B (read-only) | Skills, agentes, contrato, docs | Encontró deriva de IDs y el ejemplo no-canónico |
| Constructor del harness | `benchmark/` de dos brazos | Runner + juez ciego con leak-guard |
| Constructor de IDs | Registro canónico | 333 → 394, luego 368 tras mover tech-stack a PROFILE |
| Constructor de B2 | `dktv-orchestrate.mjs` | 8 especialistas funcionales, 16 llamadas |
| Reparador de B2 | Clasificador de citas + regla más específica | `weak 14/24 → 0/24` en mock |
| Endurecedor del validador | `validate-assessment.mjs` | **en curso** |

## Qué te toca a ti, cuando retomes

1. **Termina tu ronda del harness** (clasificador de citas débiles + `--repeat 3` ya están
   en `benchmark/`). Si vas a re-correr brazos, recuerda: `--force`, y **borrar
   `scores.json`** o usar el `--force` del juez (los scores viejos se reutilizan).
2. **Integración del brazo C**: B2 como tercer brazo, con el **mismo modelo y mismo digest
   semilla** que el brazo B, y juzgado con el mismo juez y `--repeat 3`. Eso es tuyo porque
   es `benchmark/run.mjs`.
3. **Antes de publicar cualquier cifra**: que esté atada a un commit exacto.

## Gotchas del entorno (nos costaron tiempo)

- **Pipes de hijo denegados (EPERM)** en el sandbox: captura la salida de subprocesos por
  **descriptor de archivo**, nunca `{encoding:'utf8'}`.
- **`git clone` falla por schannel**: usar `git -c http.sslBackend=openssl clone`.
- **NIM devuelve 504 en cold start**: reintentar 429/5xx/red con backoff (5/10/15/20 s).
- **Los modelos razonan**: `MAX_TOKENS=32768`. Con 8192 una corrida gastó los 8192 tokens
  razonando y devolvió vacío.
- **El modo `--mock` del harness sobreescribe `results/`**: hacer backup si se corre contra
  resultados reales.
