# DKTV — Informe de validación: Lote 1 + cross-judge (2026-10-05, rev. 2)

Sistema evaluado: **DontKillTheVibes (DKTV)**, toolkit de auditoría de código
orquestado por LLM. Contrato de salida validado (`validate-assessment.mjs`),
368 reglas canónicas con severidad/effort propios (el modelo no inventa la
taxonomía), grounding mecánico de citas (file:line existe y calza en el repo).

**REV. 2** — incorpora la revisión externa de DeepSeek (2026-10-05): corrección
de la fila mini-redis (la rev. 1 transpuso false/unverifiable en esa fila; los
totales 16/18/10 eran correctos), separación de ejes en la clasificación de
fallos, retiro del rango de precisión como cifra publicable, la health grade se
mantiene determinista, y la pregunta de calibración entre jueces se reformula
con el sesgo de selección declarado.

## Declaración de modelo (mientras dura el bug H5)

Los `assessment.json` de esta corrida llevan `llm_used: "claude-sonnet-4-5"`,
valor **inventado por el modelo** — el campo no se estampa (tercer modelo que
inventa uno distinto: gpt-4 en corridas NIM, claude-sonnet-4-5 acá). El modelo
real de evaluación y de self-juez de todo este lote fue **deepseek-chat vía API
DeepSeek**. El cross-juez fue **qwen3.5:9b local**. Bug de estampado pendiente
de fix (documentado, con la línea exacta).

## Setup del experimento

- **Brazos evaluados (lote 1):** A = naive (prompt libre) vs B = single-pass toolkit
  (digest → una llamada → assessment.json). Juez ciego: claims pool mezclados,
  relabelados C1..Cn, sin saber de qué brazo vienen.
- **Self-juez:** deepseek-chat (mismo modelo que evaluó — provisional por
  definición).
- **Cross-juez:** qwen3.5:9b local (familia distinta), sobre los claims que el
  self-juez NO aceptó (ver sesgo de selección, más abajo).
- **Muestra lote 1:** 6 repos OSS maduros (contraste deliberado): mini-redis (Rust),
  vegeta (Go), sinatra (Ruby), httpx (Python), fatfree (PHP), rich (Python).
- **Grounding mecánico:** verificación independiente del script: ¿el file:line
  citado existe y está en rango? Mide existencia, no verdad semántica.

## Resultados lote 1 (self-juez deepseek-chat)

| repo | findings | health | real | false | unverif | grounding mecánico |
|---|---|---|---|---|---|---|
| mini-redis | 6 | D | 5 | 0 | 1 | 6/6 |
| vegeta | 10 | F (1 critical) | 1 | 0 | 9 | 10/10 |
| sinatra | 9 | D | 1 | 8 | 0 | 9/9 |
| httpx | 4 | C | 4 | 0 | 0 | 4/4 |
| fatfree | 8 | D | 2 | 6 | 0 | 8/8 |
| rich | 7 | D | 3 | 4 | 0 | 7/7 |
| **total** | **44** | — | **16** | **18** | **10** | **44/44** |

## Los dos ejes de fallo, separados (corrección Q1)

La rev. 1 particionó los 28 veredictos no-"real" en 13/12/3 como si fueran modos
de fallo excluyentes. **No lo son**: "la cita sostiene el claim" (eje grounding)
y "el hallazgo es defendible como defecto" (eje severidad) son independientes.
Lo correcto:

**Eje grounding** — ¿la evidencia citada demuestra lo afirmado?
- **9 claims quedaron unverifiable para AMBOS jueces** (8 de vegeta + 1 de
  mini-redis, todos con grounding mecánico perfecto: la línea existe, no afirma).
  Este es el único error que es culpa del toolkit de forma directa.
- 1 claim más (rich-c3) no pudo juzgarse por fallo técnico del juez local
  (thinking-flood reproducible 3/3, documentado).

**Eje severidad** — ¿el hallazgo es un defecto real o marginalia defendible?
- El self-juez deepseek aplica una barra estricta ("defecto claro demostrado en
  el snippet") y rechazó 18 como false, a veces contradiciendo su propia razón
  escrita ("real supply-chain risk" + veredicto false).
- El cross-juez qwen3.5 aplica una barra más permisiva (acepta evidencia de
  ausencia: "el permissions block no aparece en el snippet" → real).
- **17 de 27 disputados fliparon a "real" bajo el cross-juez.** Cuidado al
  interpretar esta cifra: ver sesgo de selección, abajo.

## Lo que es publicable hoy (corrección Q2)

- **44/44 citas con grounding mecánico** — hecho verificable por script, no un
  juicio. Es la cifra dura del lote.
- Los dos ejes de fallo, descritos cualitativamente (arriba).
- **Precisión: NO publicable aún.** Ni como número único ni como rango: el rango
  "16–33" de la rev. 1 asumía sin medir que qwen3.5 aceptaría los 16 que
  deepseek llamó real (qwen solo vio los 28 disputados). La precisión exige
  adjudicación: juez tercero de otra familia sobre TODOS los claims, y/o humano
  en muestra. Hasta entonces, provisional.

## Health grade: se queda determinista (corrección Q3)

**vegeta tiene health F apoyada en un critical (security-gha-secret-leak-3) que
ningún juez verificó** (unverifiable para deepseek y para qwen3.5). La
tentación de degradar la nota cuando el critical no se verifica REINTRODUCIRÍA
el juicio del modelo en el único campo que hoy es determinista — exactamente lo
que tres sesiones de trabajo sacaron. La letra F es correcta (hay un critical
estampado por la regla, y la fórmula es inmune al volumen: un critical basta).

Lo que falta es de **presentación del informe**: distinguir "critical
(verificado)" de "critical (sin verificar)" como señal explícita al lado de la
letra. La letra se queda determinista; la verificación se reporta aparte.

## Calibración entre jueces: no respondible con este diseño (corrección Q4)

El cross-judge corrió SOLO sobre los 28 claims que deepseek rechazó: eso es
**selección sobre la variable dependiente**. Un conjunto definido por los
veredictos de un juez no sirve para medir acuerdo ni calibración entre jueces.
El "17/27 flip" no es una tasa comparable con nada — está condicionada a que
deepseek dijera "no real" de antemano.

**Diseño que sí lo respondería:** ambos jueces (o tres) sobre la muestra
completa sin filtrar, incluidos los 16 que deepseek aceptó. Eso da tasa de
acuerdo, kappa, y identifica qué juez está desplazado. Es el siguiente paso
metodológico, junto con la adjudicación humana en muestra. Nota: la conclusión
accionable ("hace falta adjudicación") se sostiene en cualquiera de los dos
escenarios, así que el trabajo pendiente no depende de resolver la calibración.

## Hallazgos transversales (revisados)

1. **Grounding mecánico 100%** (44/44) — la cita siempre apunta a una línea real.
2. **Eje grounding del toolkit:** 9 de 44 claims (~20%) citan líneas reales que
   no sostienen el claim (unverifiable para ambos jueces). Es el modo de fallo
   genuino del brazo evaluador, y el grounding mecánico por diseño no puede
   detectarlo (mide existencia, no afirmación).
3. **Eje severidad:** los dos jueces aplican barras distintas y medibles; los
   "1/10" y "1/9" de vegeta/sinatra son en gran parte artefacto de calibración,
   no precisión del toolkit. No convertible en cifra hasta la adjudicación.
4. **En repos con señal real (httpx, mini-redis) ambos jueces coinciden alto.**
5. **En repos limpios el toolkit produce marginalia de hardening, no cero
   findings** — el reverso del problema "zero findings", y hallazgo de producto
   real en ambos extremos.
6. **H5 (bug):** `llm_used` no se estampa; declarado arriba hasta el fix.

## Contexto: piloto previo (evidencia shipped, 5 repos)

Single-pass B: 9/14 claims verificados. Orquestador C (8 agentes): 22/25.
Convenience sample, juez LLM, run-to-run variance declarada. Misma cautela de
adjudicación aplica.

## Lote 2 (en curso al escribir este informe)

10 repos vibe-coded documentados "built with Claude Code", 6 lenguajes, brazos
A+B+C completos (orquestador incluido) + self-juez. Smoke inicial (obs-airplay,
C): **arm B = 14 findings vs arm C = 50 findings** — el orquestador encuentra
~3.5x más leyendo archivos por módulo en vez de un digest único. La comparación
B vs C con juez ciego será el dato central del lote; la precisión de cada brazo
sigue sujeta a la misma regla: adjudicación antes de publicar.

## Limitaciones declaradas

- n pequeño (lote 1: 6 repos/44 claims; piloto: 5 repos). Metodología de juez
  cruzado validada como proceso; escala no.
- Jueces LLM en ambos extremos (circularidad parcial mitigada con cross-judge,
  no eliminada — y el cross-judge actual tiene el sesgo de selección declarado
  arriba).
- Grounding mecánico mide existencia de la cita, no verdad del claim.
- rich-c3 sin veredicto cruzado (fallo técnico del juez local, documentado).
- 1 error aritmético ya corregido en esta rev. 2 (fila mini-redis); la revisión
  externa que lo encontró también motivó las correcciones Q1-Q4.

## Preguntas abiertas para el revisor (reformuladas neutras, rev. 2)

1. ¿La separación de ejes grounding/severidad es la correcta, o hay un tercer
   modo de fallo que ninguno de los dos jueces detectó?
2. ¿Es suficiente el diseño propuesto (jueces completos sin filtrar + humano en
   muestra) para publicar precisión, o se exige ground truth exhaustivo humano?
3. ¿La señal "critical (sin verificar)" junto a la letra determinista es la
   presentación correcta, o existe una alternativa que no reintroduzca juicio
   del modelo en la nota?
4. Con el sesgo de selección declarado: ¿qué diseño experimental mínimo
   descartaría que el desacuerdo 17/27 sea puramente artefacto del filtrado?
