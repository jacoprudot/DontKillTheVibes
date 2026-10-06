# DKTV — Informe de validación consolidado, rev. 3 (2026-10-05)

Sistema evaluado: **DontKillTheVibes (DKTV)** — toolkit de auditoría de código para
repos vibe-coded. Contrato de salida con schema estricto (`validate-assessment.mjs`),
368 reglas canónicas dueñas de su severidad/effort (el modelo no inventa la taxonomía),
health grade calculada por código (peor severidad presente, inmune al volumen), grounding
mecánico de citas (file:line existe y calza en el repo, verificado por script).

**Historia de revisiones:** rev. 1 → revisión externa (DeepSeek) con 6 correcciones
(error aritmético en tabla, ejes de fallo mezclados, rango de precisión inválido, health
grade determinista, sesgo de selección en cross-judge, pregunta cargada) → rev. 2 aplicó
las 6. **Esta rev. 3 agrega el Lote 2 completo (10 repos, 3 brazos) y el primer acuerdo
inter-jueces medido SIN sesgo de selección.**

## 1. Modelo usado (declaración explícita, bug H5 pendiente)

Los `assessment.json` estampan `llm_used: "claude-sonnet-4-5"` — valor **inventado por
el modelo**, el campo no se estampa (tercer modelo que inventa uno distinto). El modelo
real de evaluación y self-juez en todos los lotes fue **deepseek-chat (API DeepSeek)**.
Cross-juez: **qwen3.5:9b local** (Ollama, familia distinta, daemon afinado 85% GPU).

## 2. Lote 1 — 6 repos OSS maduros (contraste), brazos A+B

44 findings | juez: 16 real / 18 false / 10 unverif | **grounding mecánico 44/44 (100%)**.
Modo de fallo genuino del eje grounding: 9/44 claims citan líneas reales que no
sostienen el claim (unverifiable para AMBOS jueces). Los desacuerdos restantes son de
calibración de severidad entre jueces (deepseek ~2x más severo que qwen3.5 — medido en
claims disputados, con sesgo de selección declarado en rev. 2).

## 3. Lote 2 — 10 repos vibe-coded ("built with Claude Code"), 6 lenguajes, brazos A+B+C

Repos: jarvis-voice (Py), eurekagent (Py), deutsia-radio (Kotlin), holo-gestures (HTML),
ai-job-agent (JS), agentgraphed (TS), crypto-claude-desk (Py), cyberpunk-hud (GDScript),
obs-airplay (C), aurora-synth (JS). Evaluado con los 3 brazos: A naive, B single-pass
(digest único), C orquestador B2 (8 agentes especialistas leyendo archivos por módulo).

### Agregados (self-juez deepseek-chat, provisional)

| métrica | Arm B (single-pass) | Arm C (orquestador) |
|---|---|---|
| findings | 143 | 632 (4.4x) |
| precision en decidibles | 81% (35/43) | 82% (65/79) |
| **grounding mecánico** | **62% (88/143)** | **59% (376/632)** |
| unverifiable (juez) | 100 (70%) | 553 (88%) |
| health F | 8/10 repos | 8/10 repos |

### HALLAZGO CENTRAL: colapso del grounding en la audiencia objetiva

El grounding mecánico cae de **100% (lote 1, OSS maduro) a ~60% (lote 2, vibe-coded)**,
en ambos brazos. El evaluador alucina paths completos (archivos que no existen en el
repo). Casos extremos: jarvis-voice B 2/37, holo-gestures B 0/14. La debilidad de ancla
es PEOR precisamente en la audiencia del producto. La mayoría del unverifiable masivo
deriva de esto: cita que no resuelve → snippet no disponible → juez no puede verificar.

### B vs C con mismo juez e harness

C encuentra 4.4x más con la MISMA precisión decidible. La cobertura extra no es ruido.
Ambos brazos comparten la debilidad de grounding (problema generativo, no de información:
leer más archivos no arregla la cita).

### El contrato atrapó un bug del registro en caliente

eurekagent arm C: 144 findings rechazados por el validador — el id canónico
`cost-overprovisioned-k8s-1` viola el patrón `^[a-z-]+-\d+$` (el '8' de "k8s"). Una regla
canónica cuyo id el propio schema prohíbe. El gate funcionó como se diseñó; el fix
(renombrar regla o ensanchar patrón) está pendiente de decisión.

## 4. Acuerdo inter-jueces SIN sesgo de selección (novedad de la rev. 3)

Diseño corregido tras la crítica de la rev. 2: **muestreo aleatorio estratificado y
seedeado** — 8 claims por repo×brazo (todos si menos), plan reproducible en
`sampling-plan.json`. Así qwen3.5 juzga claims que deepseek aceptó Y rechazó.

- Cobertura: **144/156 claims (92%)**. Los 12 restantes (3 sub-batches): thinking-flood
  determinista del 9B (razona ~31k chars y nunca emite respuesta; reproducible, incluso
  a 4 claims por batch). Límite documentado del juez local.
- **Acuerdo global: 117/144 (81%)**
- **Arm B: 53/72 (74%) · Arm C: 64/72 (89%)**

### Patrón de desacuerdo (18 casos)

- Mayoritario: deepseek=real → qwen=unverifiable (qwen más estricto EVIDENCIAL aquí —
  inversión respecto al lote 1, donde deepseek era el estricto en severidad). Los jueces
  discrepan más en "¿el snippet alcanza?" que en "¿es defecto?", y eso está correlacionado
  con el grounding colapsado.
- Flips con impacto en precisión: solo 3 false→real (crypto-claude-desk secret-leak-3,
  aurora env-file-committed, aurora secret-in-code) — subirían la precisión, no bajarla.

## 5. Lo publicable hoy vs lo que exige adjudicación

**Publicable (hechos verificables por script):**
- Lote 1: grounding mecánico 44/44.
- Lote 2: la CAIDA de grounding a ~60% en vibe-coded (diferencia 100%→60% entre lotes,
  mismo modelo y harness — el efecto es de la naturaleza del objetivo).
- Acuerdo inter-jueces 81% (74% B / 89% C) sobre muestra aleatoria sin sesgo.
- El contrato rechaza output inválido en vivo (bug de registro atrapado).

**No publicable aún:** precisión absoluta de ningún brazo (requiere adjudicación:
tercer juez sobre TODOS los claims + humano en muestra — conclusión que se sostiene en
todos los escenarios posibles de los datos actuales).

## 6. Limitaciones declaradas

- n = 21 repos totales (11+10), dos ejes de muestra distintos (OSS maduro vs vibe-coded),
  no representativos estadísticamente. Metodología validada; escala no.
- Jueces LLM en ambos extremos; la circularidad se mitiga con cross-judge y con la
  publicación del acuerdo/discrepancia, no se elimina.
- Grounding mecánico mide existencia de la cita, no verdad del claim.
- 12/156 claims sin veredicto cruzado (límite del 9B).
- Self-juez deepseek en los lotes: los números de precisión por repo son provisionales.

## 7. Preguntas para el revisor (neutras)

1. ¿El hallazgo "grounding colapsa en vibe-coded" está correctamente atribuido? La
   interpretación es que el evaluador alucina paths más en repos AI-built (estructuras
   menos canónicas); ¿hay una hipótesis alternativa que los datos no descarten?
2. ¿Es válido concluir que el orquestador "aporta cobertura, no ruido" con precisión
   decidible 81% vs 82%, o la precisión en decidibles es una métrica demasiado indulgente
   cuando el 70-88% de los claims queda unverifiable?
3. El acuerdo 89% vs 74% (C vs B) — ¿es evidencia suficiente de que los claims del
   orquestador son intrínsecamente más verificables, o puede explicarse por composición
   de la muestra (los claims de C citan otros tipos de archivo)?
4. ¿La mitigación propuesta para el grounding (gate mecánico en el runner/validator que
   rechace o marque findings cuyo file:line no resuelva) es la correcta, o corre el
   riesgo de sesgar el recall (descartar hallazgos verdaderos con cita imperfecta)?
5. ¿El diseño de adjudicación propuesto (tercer juez completo + humano en muestra
   estratificada) resuelve la circularidad de forma suficiente para publicar precisión?
