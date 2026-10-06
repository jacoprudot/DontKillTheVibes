# Revisiones adversariales externas — datos crudos para REVIEW_FINDINGS.md

Ejercicio del 2026-10-06: el mismo prompt adversarial (Fase 1 entendimiento obligatorio →
Fase 2 crítica con evidencia → Fase 3 veredicto) enviado a **siete** modelos, con la URL del
repo público. **No preparados con nuestras fortalezas**: los fallos de comprensión son el dato.

> Corrección 2026-10-06: el encabezado decía "seis". La tabla de abajo tiene siete filas
> (Claude, ChatGPT, Qwen, Kimi, Gemini, GLM, DeepSeek). El error era aritmético, en la prosa
> y no en los datos; manda la tabla. Tres de los siete (Gemini, GLM, DeepSeek) no pudieron
> abrir el repositorio.

---

## Resumen en una tabla

| Modelo | Acceso | Puntuación (ing / objetivo / utilidad) | Veredicto |
|---|---|---|---|
| Claude | Sí (README, run.mjs, judge.mjs, package.json; **robots.txt bloqueó** `examples/realworld-assessment-en` y `benchmark/results`) | 6 / 5 / 4 | NO como gate; SÍ como lectura de diseño |
| ChatGPT | Sí (17 archivos, citas verificadas por nosotros) | 7.5 / 9 / 6.5 | SÍ como experimental, NO como autoridad |
| Qwen | Sí (README + git log) | 6 / 8 / 4 | NO |
| Kimi | Sí (README, dktv-assess, validator, grade, CI, 1 skill; NO leyó orchestrate ni las otras 7 skills) | 7 / 8 / 5 | NO como gate; SÍ para robar el patrón |
| **Gemini** | **NO** | 1 / 1 / 1 | **FABRICÓ** una reseña demoledora de un repo que no podía leer |
| **GLM** | **NO** | N/A | **SE NEGÓ** y describió la reseña falsa que podría haber escrito |
| **DeepSeek** | **NO** (fetch + búsquedas web sin resultados) | N/A | **SE NEGÓ** tras documentar sus búsquedas |

Las tres últimas NO computan como revisiones. Gemini computa como **ejemplo negativo**;
GLM y DeepSeek como **ejemplo positivo de calibración**.

---

## Cita clave — GLM (el hallazgo central del ejercicio)

> "Podría escribirte ahora mismo una reseña adversarial convincente, con rutas de archivo
> plausibles (`src/core/engine.ts`, línea 247), un número de rendimiento inventado, y cinco
> problemas técnicos con la gravedad bien ordenada. Sería fluido, específico y **100%
> inventado**. Tú no podrías distinguirlo de una reseña real sin abrir el repo tú mismo."
>
> "Una reseña adversarial a ciegas no es una reseña adversarial. Es ficción con formato de auditoría."

**Gemini contra GLM, mismo prompt, misma URL inaccesible, comportamientos opuestos:** Gemini
inventó ("vaporware", "no hace absolutamente nada", "ejecución descuidada"); GLM se negó y
explicó por qué. Es el modo de fallo que el producto existe para cazar, demostrado en público
con dos puntos de datos.

---

## Qué encontró cada uno

**Claude** (la mejor: declaró exactamente qué abrió y qué le bloquearon)
- El brazo A es un **hombre de paja**: `NAIVE_SYSTEM` no exige `file:line` y B sí → "0 decidibles" mide el prompt, no la capacidad.
- **La precisión de A no se publica**, aunque `judge.mjs` la calcula para todos los brazos.
- `run.mjs --help` dice que C "is not comparable" mientras el README lo corona ganador.
- `run.mjs` recomienda `moonshotai/kimi-k2-instruct-0905`, que el README documenta como 404.
- **`scripts/` no tiene tests** (`pnpm test` filtra solo `./mcps/*`): el núcleo del producto está sin cubrir.
- Predice fallo por cobertura parcial silenciosa, CI verde con cero hallazgos y citas desviadas.
- **Inyección de prompt desde el repo auditado** (un comentario malicioso puede forjar hallazgos que validan).
- `"never send your code anywhere"` (MCPs) frente a los runners que envían el digest a `LLM_BASE_URL`.

**ChatGPT** (sin acceso a clonar; revisión estática, citas verificadas como reales por nosotros)
- **La truncación explícita**: `PER_FILE_CAP = 10_000` → un archivo de 50K pierde los últimos 40K → "0 findings, no porque no exista el bug".
- **`coverage_ratio` en el output** (`files_seen`/`files_total`): el cambio más accionable de todas las revisiones.
- **Privacidad más allá de la deny-list**: un secreto en `fixtures/customer.json` o `config/production.yaml` viaja al proveedor.
- C no recibe el mismo input que A/B → la comparación no es un A/B limpio.
- Pide tabla de capacidades por path y una sección "use it if / not good for".

**Qwen**
- Encadenó el mejor modo de fallo: repo grande → digest desborda → el modelo agota el razonamiento → JSON vacío → `VALID: 0 findings` → **el equipo asume que su código está perfecto**.
- **Los targets anonimizados le parecieron cherry-picking** (verificado: el `repos.json` público solo tiene etiquetas `target-N`).
- Un linter determinista (ESLint/SonarQube/**Semgrep**) verifica la verdad y es gratis → "pagar tokens por un JSON que aún requiere verificación manual es un anti-patrón".
- **Propone Defects4J** o repos con vulnerabilidades conocidas como ground truth público.
- Pide matriz de lenguajes, coste en USD/minutos y un ejemplo de hallazgo real y complejo.

**Kimi** (la más afilada; verificado todo lo siguiente contra el repo)
- **`benchmark/README.md:13,218`**: "both stay empty until a real run happens" / "TODO: fill after the run" — mientras el README principal publica resultados.
- Los targets son **irreproducibles desde el clone** (identidades en el `repos.local.json` gitignored).
- **`SKIP_DIRS` incluye `.git`** → `security-secret-in-history-2` **no puede disparar nunca** en Path B. Una regla inalcanzable.
- **`all.sort((a,b) => a.rel.localeCompare(b.rel))` + corte por presupuesto** → un monorepo se evalúa sobre `packages/a-*` y el informe se lee como completo.
- El system prompt incrusta las 8 skills (~220k chars) + 368 ids + digest de 180k; **cada reintento reenvía toda la conversación** (~100k+ tokens por intento, hasta 4).
- `"If a real problem has no matching rule, do NOT invent a rule: omit the finding"` → **clases de bug nuevas son invisibles por diseño**.
- Severidad ciega al contexto: un JWT débil en un demo y en un banco reciben la misma.

---

## La frase para el caso de estudio (Kimi)

> "Precisamente porque el resto del repo es tan disciplinado, la irreproducibilidad del
> benchmark pesa el doble: la única parte donde el rigor declinó es la que sustenta las
> cifras de marketing."

---

## Convergencia (esto ES la lista de trabajo)

| Hallazgo | Quién |
|---|---|
| El contrato garantiza forma, no verdad | ChatGPT + Claude + Kimi + Qwen |
| Cero hallazgos valida (indistinguible de una corrida rota) | ChatGPT + Claude + Kimi + Qwen |
| El benchmark no es reproducible desde el clone | **Qwen + Kimi** |
| El 22/25 no aguanta | ChatGPT + Claude + Qwen (+ Kimi por irreproducibilidad) |
| Falta reporte de cobertura (`files_seen`/`files_total`) | ChatGPT + Claude + Kimi |
| Herramientas deterministas (semgrep/gitleaks) son el competidor real | Qwen + crítica de ronda 2 |
| Contradicción "eliminate AI hallucinations" (About de GitHub) | ChatGPT + Claude |

---

## Estado de los arreglos

- **5 contradicciones**: cuatro en curso o hechas (benchmark/README, targets reproducibles, las dos de run.mjs) y la quinta abajo, autorizada.
- **QUINTA contradicción, autorizada**: los números del README no cuadran con `scores.json`
  (21/25, no 22/25; 9/15, no 9/14; rango real 0.625–1.0, no 0.84–1.0). **Manda la evidencia cruda.**
- **6 limitaciones**: deliberadamente NO arregladas; publicadas como gaps y listadas aquí.
- **About de GitHub**: pendiente del humano (Settings).
