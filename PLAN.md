# Plan DKTV — giro a detector determinista + traductor de reglas

**Estado:** propuesta, revisada por Kimi (2026-10-06). Pendiente de ejecución.
**Fecha:** 2026-10-06
**Revisión:** esta versión incorpora una **revisión externa del 2026-10-06**; sus correcciones verificadas son **nueve** y están aplicadas abajo. Sobre esa base, esta revisión añade: el **tipo** de regla en el registro (`detector` / `juicio` / `fuera`), el **paso A expandido (A1-A6)** como fase propia, el paso **C2** de prompts de remediación, y la **separación gratis/pagado** de la capa de consultoría.
**Repo:** https://github.com/jacoprudot/DontKillTheVibes

---

## 1. Objetivos (fijados por el dueño)

1. **Principal.** Que un vibecoder clone o corra el repo y **encuentre los errores que se repiten en código escrito por IA**, con un informe que le permita **resolver o desatascarse**.
2. **Secundario.** Demostrar ingeniería de primer nivel.
3. **Secundario.** Generar consultorías.

La vara de medida es la #1: *¿el informe desatasca al usuario?* No: *¿cuántas reglas tenemos?*

---

## 2. Por qué el giro

Todo lo que sigue está medido en este repo, no es opinión.

| Hecho medido | Fuente |
|---|---|
| Grounding mecánico **60%** en repos vibe-coded, 100% en OSS maduro | `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md` |
| **88%** de hallazgos del orquestador sin verificar (553/632) | ídem |
| Precisión sobre **todos** los claims: brazo B **24%**, brazo C **10%** | ídem |
| Un assessment con **cero hallazgos pasa el contrato** | `scripts/validate-assessment.mjs` |
| Path A cuesta **20-35 min** para un repo pequeño; sin estrategia para repo real | `docs/internal/HANDOFF.md`, auditoría del 2026-10-04 |
| `security-secret-in-history-2` **no puede disparar** en el runner (`.git` en `SKIP_DIRS`) | `scripts/dktv-assess.mjs:126` |
| Digest **corta por presupuesto en orden alfabético** → informe completo sobre muestra sesgada | `scripts/dktv-assess.mjs:209` |
| **14 de 368** reglas canónicas eran incitables por un patrón de id roto | `skills/CHANGELOG.md`, commit `12e695c` |

**Conclusión.** El detector es el LLM, y el LLM es la parte no fiable. Los dos revisores externos que nombraron `semgrep`/`gitleaks` tenían razón: una herramienta determinista encuentra lo que da miedo más rápido, gratis y **sin poder alucinar**.

Y una segunda conclusión, incómoda: **los 8 agentes nunca fueron el activo.** El activo es el registro de 368 reglas con severidad y effort propios, más el contrato y el validador que lo protegen.

---

## 3. Tesis nueva

> **Lo determinista encuentra. Las reglas traducen. El código arma el informe.**
> Si el mapeo detector → regla se co-diseña en el sidecar (Fase 1), **ya se sabe qué regla disparó**. El `Choice` no es un paso universal: existe solo donde decide el modelo — las reglas **`juicio`** y la **cola ambigua** del `detector` — y ahí elige de una lista cerrada, así que **inventar sigue siendo imposible**.

Comparación con la tesis vieja:

| | Vieja | Nueva |
|---|---|---|
| Detector | LLM lee código | `gitleaks` · `semgrep` · `osv-scanner` |
| Traducción | LLM escribe hallazgo | **Mayormente el sidecar** (detector → regla escrito una vez); `Choice` solo donde decide el modelo (`juicio` y cola ambigua) |
| Severidad | estampada en código | estampada en código (igual) |
| Prosa | generada por LLM | **escrita por regla en el skill** |
| Verificabilidad | 60% de citas en rango | **100%: la prueba es intrínseca** |

La diferencia clave: si `gitleaks` encuentra la cadena, **la cadena está ahí**. No hay cita que pueda estar mal. Ese era el freno número uno para el usuario.

**El tipo decide el motor, no solo la severidad.** Cada regla del registro declara su **tipo**, porque el tipo decide quién la corre. Son tres valores, no dos:

| Tipo | Quién lo prueba | Motor |
|---|---|---|
| `detector` | una herramienta determinista: `gitleaks` / `semgrep` / `osv-scanner` | el detector |
| `juicio` | el modelo decide **si aplica** y **si se viola** | el modelo (Jev o el baseline vendor-free) |
| `fuera` | no hay forma de detectarlo | ninguno: se declara, no se borra |

El campo vive en el sidecar (`skills/detectors.json`), no en las 368 líneas del skill: se escribe una vez y el parser no cambia (Fase 1).

**El censo deja de ser un veredicto y pasa a ser una clasificación.** Ya no lee «solo sobreviven 40 reglas», sino **«N mecanizables, M de juicio, 0 borradas»**. Las 368 siguen en el registro y siguen sirviendo: las `fuera` documentan lo que el producto no promete, que es información, no basura. El crecimiento y la mejora de reglas siguen por la vía gobernada que ya existe (`skills/CHANGELOG.md` + fingerprint + deprecación), y una regla que da falsos positivos en N proyectos **se corrige o se depreca** — con el número a la vista.

**Vendor-free es el default.** Para la mayoría de señales no hay LLM en el camino: el mapeo detector → regla se escribe una vez en el sidecar. Jev tiene que **justificarse solo donde decide el modelo** — reglas `juicio` y cola ambigua — y si ahí el baseline vendor-free empata, no se adopta (regla dura 2).

**Alcance honesto.** El producto solo puede servir al objetivo 1 en la fracción **mecanizable** (`detector`) y en la que el modelo puede juzgar con pregunta cerrada (`juicio`): seguridad, configuración y dependencias sí; lógica y arquitectura probablemente no. Por eso se anuncia como **«los errores que un detector puede probar»**, nunca como **«los errores que tiene tu código»**. Si el censo da ~40 mecanizables, la promesa es estrecha pero verdadera; si da ~200, es otra conversación — y el número se publica igual (regla dura 7). Lo que no sea mecanizable ni juzgable no se borra: se declara `fuera`.

---

## 4. Qué se queda y qué muere

**Se queda (el activo):**
- `skills/*.skill.md` — 368 reglas agrupadas en 8 áreas, con severidad, effort y **remediación ya escrita**.
- `scripts/lib/canonical-registry.mjs` — parser único, fingerprint, deprecación.
- `scripts/validate-assessment.mjs` — el contrato.
- `skills/CHANGELOG.md` + `registry-diff.mjs` — gobernanza.
- El historial de commits y el benchmark: son la prueba de ingeniería (objetivo 2).

**Muere:**
- Los 8 agentes especialistas y su orquestador. Detector redundante.
- El digest, la selección de archivos por módulo, la reparación de citas.
- La prosa generada por LLM.
- La baja **física** (`rm`) de `agents/`, el orquestador y la maquinaria del digest se ejecuta cuando el benchmark se archive — a más tardar en la Fase 5. Antes de eso, la evidencia versionada debe seguir siendo re-ejecutable.

**Se archiva, no se borra:** README viejo, benchmark, evidencias. Entrada de pivote fechada. El historial público se mantiene honesto — eso lo acreditaron los revisores.

**Los dos MCPs:**
- `mcps/git-mcp` se vuelve **estratégicamente relevante**: es la vía natural de entrega de la regla de secretos en el historial de git, la que hoy **no puede disparar** (`security-secret-in-history-2`, bloqueada porque `.git` está en `SKIP_DIRS`).
- `mcps/benchmark-mcp` (profiling JMeter) **no tiene relación con el producto nuevo**. Decisión explícita y escrita: se archiva, o se queda como pieza de portafolio. No se deja indefinido.

**Lo que contradice el estado nuevo (se maneja en Fase 0):**
- `verify-structure.js` — `agents` está en `requiredDirs`: el verificador falla si el directorio muere.
- `package.json:4` — la descripción dice «LLM-orchestrated assessment toolkit».
- `mcp_config.json` — referencia los dos MCPs propios, `git-mcp` incluido.
- Dos referencias a `agents/` en `README.md` (líneas 44 y 137).
- Extra verificado: `scripts/dktv-assess.mjs`, `scripts/dktv-orchestrate.mjs` y `scripts/lib/report-renderer.mjs` nombran `agents/`; mueren con el orquestador en esta misma sección.

**Lo que NO se rompe (verificado por el revisor):** el CI completo — `validate:skills`, `validate:mcps`, validación de los dos ejemplos, `registry-diff`, `mcp-smoke`, build/test/security de los MCPs — no toca ni los agentes ni el orquestador. Fase 0 puede correr sin tocar una línea de CI.

---

## 5. Detalle que decide el tamaño del producto

**No se sabe cuántas de las 368 reglas son expresables de forma determinista.** Puede ser 40, puede ser 200. Eso no es un detalle: define si el producto es una herramienta o un ejercicio. Por eso el censo ahora **clasifica por tipo** (sección 3): el número que decide el tamaño del producto es cuántas salen `detector`, no cuántas sobreviven.

Por eso la **Fase 1 mide eso**, en paralelo a la plomería de detectores y antes de escalar el producto.

Y por eso el arranque es con **~20 reglas que dan miedo**, no con 368:

- secreto en el repo o en el historial de git
- clave de API en el bundle del navegador
- `.env` commiteado
- CORS abierto (`*`) en producción
- endpoint sin autenticación
- dependencia con CVE conocido

Si esas 20 desatascan a un vibecoder, el producto existe. Las otras 348 se añaden después, o se declaran `juicio` / `fuera` — nunca se borran (sección 3).

Las 20 son todas de seguridad. Si el censo encuentra **2-3 reglas mecanizables fuera de seguridad** — triviales de `code-*` o `flows-*` — entran al arranque: sin ellas el vibecoder lee el producto como una alarma de seguridad y nada más.

Y el informe tiene que mostrar la **forma completa del producto** — severidad, effort, remediación escrita, plan 30/60/90 — o se lee como «un wrapper de `gitleaks`».

**Restricción de plataforma.** `semgrep` no corre nativo en Windows (requiere WSL2 o Docker); `gitleaks` y `osv-scanner` sí traen binario de Windows. Los usuarios objetivo — y el autor — están en Windows. Hay dos caminos y la decisión es de la Fase 2: (a) `semgrep` vía Docker con degradación elegante y aviso claro cuando falte, o (b) matcher propio en Node para los patrones triviales (CORS `*` y endpoint sin auth son patrones simples). No se elige en silencio.

---

## 6. Fases

### El flujo de auditoría, de una lectura

Los pasos `A` → `B` → `C` → `C2` → `D` son el flujo que corre el producto; las Fases 0-7 (más `A` y `C2`) son el orden en que se construye. `D` no es una fase nueva: es el diff contra el conjunto de reglas por defecto.

1. **A — Perfil de proyecto (`A1`-`A6`).** Inventario → reconciliación → **confirmación del usuario (bloqueante)** → escala → `project-profile.json` congelado → re-chequeo que detecta deriva. Sin perfil confirmado no se elige ninguna regla.
2. **B — Detectores, por clase.** `detector`: corre la herramienta y el sidecar mapea señal → regla. `juicio`: el modelo decide aplicabilidad **y** violación (Jev, sujeto al baseline vendor-free). Y la **cola ambigua** del `detector` — señal ya probada que puede ser 2-3 reglas — se mide antes de construir nada. Cada hallazgo sale etiquetado: **`probado`** o **`juzgado`**.
3. **C — Informe.** Estampa severidad y effort, ordena por `severity × module weight × confidence`, **asigna la etiqueta** `probado` / `juzgado`, pega la remediación ya escrita en el skill y arma el plan 30/60/90.
4. **C2 — Prompts de remediación.** Consume los hallazgos de C **con su etiqueta y su orden**: `probado` → prompt directo; `juzgado` → prompt que primero pide confirmar. No se auto-ejecutan.
5. **D — Control.** Diff contra el baseline del conjunto de reglas por defecto.

El flujo no tiene huecos: lo que A confirma es lo que B pesa; lo que B prueba o juzga es lo que C etiqueta; lo que C etiqueta es lo que C2 decide si se arregla directo o se confirma antes.

### Fase 0 — Congelar y declarar (bloqueante)

**Por qué:** hay trabajo verificado sin un solo commit. Y el pivote debe quedar documentado, no escondido.

Entregables:
- 3 commits: (1) correcciones de números, (2) manifiesto de targets + fin de la anonimización, (3) registro de revisiones externas + caso de estudio.
- Entrada de pivote fechada en el README o `CHANGELOG`.
- Resolver la lista de contradicciones de la sección 4 (`verify-structure.js`, descripción de `package.json`, `mcp_config.json`, referencias a `agents/` en `README.md`) — sin tocar CI.
- **Fijar el umbral de la Fase 7:** N = **10** repos de prueba, de los cuales **al menos 5** deben producir un hallazgo accionado. Se fija aquí, no después de ver resultados.
- `PLAN.md` (este archivo) commiteado.

Criterio de aceptación: `git status` limpio. Gates verdes: ambos ejemplos `VALID`, `registry-diff` PASS, `validate-skills` OK.

### Fase A — Perfil de proyecto (A1-A6, antes de la selección de reglas)

**Por qué es vital.** En desarrollo asistido por IA el rumbo cambia: los documentos se desalinean del código y entre sí, y los agentes siguen trabajando sobre un entendimiento viejo. **Nadie lo mide.** A lo mide, y **A6** convierte esa deriva en un hallazgo. Sin perfil, la selección de reglas es fe: el peso del módulo y el contexto salen de la nada.

Esta fase corre **antes** de la selección de reglas: sin perfil confirmado no se elige ni una regla.

Entregables, los seis sub-pasos:
- **A1. Inventario de documentación.** README, `CLAUDE.md` / `AGENTS.md`, `docs/`, ADRs, comentarios de código, `package.json`, migraciones, config de CI. Determinista.
- **A2. Reconciliación.** Fechas desde git. Cuál documento es el más reciente. Las **contradicciones entre documentos** se sacan a la superficie. La comparación la hace el LLM —comparar es lo que sí hace bien— y la salida es una **lista de contradicciones que el usuario puede verificar**.
- **A3. Confirmación con el usuario.** **BLOQUEANTE.** Sin OK explícito no hay selección de reglas. Sin esto el perfil es fe, no evidencia.
- **A4. Escala.** Usuarios, recursos, infraestructura, tamaño del equipo. Cambia el peso: un hallazgo en una app de 3 usuarios no pesa lo mismo que en una de 50,000.
- **A5. Congelar el perfil.** Versionado: `project-profile.json`. Es lo que consumen B y C.
- **A6. Re-chequeo posterior — el diferenciador.** Correr A otra vez más tarde **detecta deriva de contexto**: «el README dice X, el código hace Y, hace tres semanas decía Z». Sale casi gratis porque git ya trae las fechas.

Criterio de aceptación: **A3 no se puede saltar** —sin OK explícito la fase no cierra—; el perfil queda **versionado y congelado** (`project-profile.json`); las contradicciones están listadas **con sus fuentes**, no resumidas; y A6 es re-ejecutable y produce un diff contra el perfil congelado.

### Fase 1 — Sidecar de detectores (día 1) + censo en paralelo

> **Nota para el worker en paralelo (Kimi).** Esta fase **y la Fase 3 cambiaron** en esta revisión: el registro ahora declara el **tipo** de regla (`detector` / `juicio` / `fuera`, sección 3) y se insertó **C2**. Si ya empezaste la Fase 1 o la Fase 3 desde la revisión anterior, **realinea antes de seguir** o el trabajo se rehace.

**Por qué:** hoy cada regla es prosa que el LLM aplica. Para que un detector la dispare, la regla debe declararlo. Pero el censo completo de las 368 **no bloquea** la plomería de las ~20 que ya se saben mecanizables: lo que sí bloquea es el **formato**, porque decide cómo lo consumen las Fases 3-4.

Entregables:
- **Día 1 (el prerequisito real):** `skills/detectors.json` + su schema → `{ "<rule-id>": { "type": "detector | juicio | fuera", "tool": "semgrep", "query": "...", "confidence": 0.9 } }`. El **`type` es obligatorio** (sección 3); `tool`, `query` y `confidence` solo tienen sentido cuando el tipo es `detector`. Es lo único bloqueante: fija el contrato de consumo para 3-4 y C2, evita tocar 368 líneas de árbol de decisión y no cambia el parser.
- **En paralelo con la Fase 2:** censo completo — **clasificar las 368 por tipo**: cuántas son `detector` (expresables como `semgrep` pattern, `gitleaks` rule, `osv` advisory), cuántas `juicio` y cuántas `fuera`. El resultado se publica como **«N mecanizables, M de juicio, 0 borradas»**. Número, no estimación.
- Catálogo público `docs/RULES.md` generado desde el registro (id, módulo, **tipo**, severidad, effort, condición, remediación, detector). Arranca con las 20 y crece con el censo.
- Un test por regla con detector: fixture positivo y negativo.

Criterio de aceptación: el conteo medido está escrito y es reproducible. `detectors.json` valida contra su schema, **`type` incluido**, y la clasificación cierra con **0 reglas borradas**. `RULES.md` se regenera de forma determinista. Los tests de las reglas con detector pasan. El censo puede cerrar **después** de la Fase 2: no la bloquea.

### Fase 2 — Detectores

Entregables: `scripts/detect/` que corre `gitleaks` (repo + historial), `semgrep` (auth, CORS, exposición), `osv-scanner` / `npm audit` (CVEs), y emite JSON crudo normalizado.

Notas de diseño:
- La salida cruda de `gitleaks` en un repo grande puede exceder el `state` de 32k de Jev → **chunking obligatorio**.
- Sin red cuando el detector no la necesite. `osv-scanner` sí necesita red o base local.

**Decisión obligatoria (Windows).** `semgrep` no corre nativo en Windows; `gitleaks` y `osv-scanner` sí. Se elige y se escribe: (a) `semgrep` vía Docker con degradación elegante y aviso claro cuando Docker no esté, o (b) matcher propio en Node para los patrones triviales (CORS `*`, endpoint sin auth). Cualquiera de las dos se documenta con su costo; ninguna se asume.

**Falsos positivos: protocolo propio.** Verificabilidad no es precisión. Que `gitleaks` encuentre la cadena prueba que la cadena está ahí; **no** prueba que sea un secreto real. Claves de ejemplo (`sk-xxx`), placeholders y fixtures de test generan falsos positivos.

- Antes de publicar **cualquier** cifra de precisión de un detector: muestra **adjudicada por humano**, con protocolo escrito e **intervalo de confianza**. Sin IC no se publica el número.
- Lección ya pagada en este repo: el **89% de acuerdo inter-juez** era **inflación de tasa base**, no calidad (`benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md:97`). Una coincidencia alta sin IC no es evidencia.
- La regla dura 7 ya exige artefacto detrás de cada número; esto la hace operativa para los detectores.

Criterio de aceptación: sobre un repo de prueba, cada detector emite JSON válido y los hallazgos crudos son correctos (verificables a mano). La decisión de Windows está escrita y la tasa de falsos positivos tiene muestra adjudicada con IC antes de publicarse.

### Fase 3 — Reglas `juicio` y cola ambigua (¿hace falta traductor?)

> **Cambió en esta revisión** por el **tipo** de regla y la entrada de **C2** (ver la nota de realineación en la Fase 1). Si el worker en paralelo ya arrancó esta fase desde la revisión anterior, se realinea antes de continuar.

**Por qué:** la Fase 1 ya escribe el mapeo detector → regla en el sidecar. Si eso cubre casi todo, un traductor universal es un paso redundante. Lo que sí puede necesitar un LLM son **dos cosas distintas**, y no se mezclan:
- las reglas **`juicio`**: el modelo decide **si la regla aplica** y **si se viola** — dos preguntas, no una. Aquí no hay hecho probado hasta que el modelo lo juzga, y la salida se etiqueta `juzgado`;
- la **cola ambigua** de las reglas **`detector`**: una señal que la herramienta **ya probó** pero que puede corresponder a 2-3 reglas según contexto. El hecho está probado; lo único que falta es el nombre de la regla.

Entregables:
- **Reglas `juicio`:** cuántas son y cuáles. Se evalúan con pregunta cerrada (¿aplica? ¿se viola?) sobre la lista cerrada de IDs canónicos, y su resultado nunca se etiqueta `probado`.
- **Medir la cola, no el pipeline — y medirla ANTES de construir nada:** cuántas señales crudas de la Fase 2 no tienen mapeo único (candidatas a 2-3 reglas). Número, no estimación.
- **Criterio de corte escrito:** si la cola es pequeña, **no se construye el traductor**. Esa cola se resuelve con contexto en el sidecar, o se deja fuera del informe con aviso explícito.
- Solo si la cola lo justifica: `scripts/jev-assess.mjs` (o equivalente) que manda la señal cruda como `state` y pregunta `Choice` sobre los IDs candidatos; devuelve regla + confianza.

**Jev solo donde decide el modelo.** Eso son las reglas `juicio` y la cola ambigua del `detector`, nada más. `Choice` sobre una lista cerrada de IDs canónicos hace **estructuralmente imposible** inventar una regla o una severidad. Medido: eligió la regla correcta con probabilidad 1.0 sobre 45 opciones, y la línea correcta con 0.99. Fuente: `docs/development/JEV_EXPERIMENT.md`.

**Baseline obligatorio antes de adoptar Jev:** (1) **contar cuántas señales necesitan traducción** — ese número decide si el traductor existe — y (2) comparar, sobre esa cola, contra un enum de IDs en un JSON schema con **cualquier** LLM (modo anclado, vendor-free). Si el baseline empata, **no se adopta Jev**. Regla de la casa: primera la vía sin vendor.

Criterio de aceptación: las reglas `juicio` están contadas y **separadas** de la cola ambigua del `detector` — dos listas, no una. La cola está contada y escrita; o no hay traductor (con la razón documentada), o el traductor coincide con la regla esperada sobre la cola, y el baseline vendor-free está medido en sus dos partes: conteo y precisión.

### Fase 4 — Informe en código (paso C)

Entregables: ensamblado determinista del informe. Por hallazgo: regla, severidad, effort, ubicación, **la remediación escrita en el skill**, la **etiqueta `probado` / `juzgado`** (la asigna aquí, según el motor que lo produjo), y el plan 30/60/90 por `severity × module weight × confidence`. Cierra con el **diff contra el baseline** del conjunto de reglas por defecto (paso D): qué es nuevo, qué sigue igual.

Sin prosa generada. Si el texto de remediación de una regla no basta, se mejora la regla — no se le pide al modelo.

Criterio de aceptación: informe generado de punta a punta sin una sola llamada de generación de prosa, y cada hallazgo lleva su etiqueta `probado` / `juzgado`.

### Fase C2 — Prompts de remediación, ordenados y justificados

**Por qué:** entre el informe (C) y el control (D) falta la pieza que el usuario realmente pega en su agente. Es determinista y sale casi gratis, porque la remediación ya está escrita en el skill.

Entregables: **un prompt listo para pegar por hallazgo**, generado **desde la regla — no por un LLM**: plantilla + la remediación ya escrita + la prueba del detector.

Cada prompt lleva:
- la regla y su severidad;
- la ubicación exacta (archivo, línea, evidencia);
- la remediación ya escrita en el skill;
- **aviso explícito cuando la acción es destructiva** (rotar credenciales, reescribir historial).

Orden: el mismo del informe — `severity × module weight × confidence`, ya calculado. C2 no reordena: consume.

Justificación: cada prompt **cita su regla**, así el usuario ve por qué esa y por qué primero.

Diferencia por clase, y es la que importa:
- `detector` (etiqueta `probado`): prompt directo — encuentra y arregla.
- `juicio` (etiqueta `juzgado`): prompt que **primero pide confirmar** el hallazgo y solo arregla si es real. Nunca se le pide al usuario arreglar algo no probado.

**No se auto-ejecutan.** El usuario los lee y los pega: sigue siendo el dueño.

**Beneficio lateral:** si el prompt generado sale débil, la regla es débil. La calidad del registro se vuelve visible en cada corrida.

Criterio de aceptación: hay un prompt por hallazgo, en el orden del informe, con su regla citada y su aviso cuando la acción sea destructiva; ningún prompt de clase `juicio` instruye arreglar sin confirmar antes; ninguna llamada de LLM participa en generarlos.

### Fase 5 — Empaquetado como skill

Entregables: `SKILL.md` instalable con `npx skills add`. **Sin API key.** El usuario trabaja dentro de Claude Code / Cursor / Codex.

El CLI queda para CI, no como camino principal.

Criterio de aceptación: un agente sin configuración previa corre el flujo y produce el informe.

### Fase 6 — Demo y número

Entregables: README con la comparación en la primera pantalla — salida cruda del detector al lado del hallazgo traducido. Y **un número honesto y medido**.

Criterio de aceptación: el valor se entiende en 5 segundos sin instalar nada.

### Fase 7 — Enseñarlo

Post + caso de estudio. Sin ojos no hay consultoría (objetivo 3).

**Umbral de aceptación, declarado por escrito ANTES de arrancar** (el número se fija en Fase 0, no después de ver los resultados): con **N repos de prueba** (N declarado de antemano), **al menos 5 deben producir un hallazgo sobre el que el usuario actúe** — lo arregla, se desatasca, o pregunta cómo arreglarlo. «Se mide con usuarios» no es falsable: sin número, la fase no termina nunca.

Criterio de aceptación: el umbral declarado se alcanza, y el conteo se publica con su artefacto (regla dura 7). Si no se alcanza en la fecha declarada, el pivote se declara fallido con el número a la vista (regla dura 5), no se renegocia el umbral.

---

## 7. Reglas duras

1. Arrancar con ~20 reglas. No 368.
2. Baseline vendor-free antes de Jev. Si empata, no se adopta.
3. Jev es lock-in de vendor. Decisión explícita y escrita.
4. Juez de familia distinta. **El autor de un artefacto nunca es su juez.**
5. Archivar, no borrar. Correcciones visibles, nunca silenciosas.
6. No se construye sin cliente pagador. Fase 7 es la que paga.
7. Ninguna cifra se publica sin artefacto que la respalde.

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Pocas reglas son mecanizables | Se mide en Fase 1 **antes** de construir |
| Salida de detectores excede 32k de Jev | Chunking por archivo / por hallazgo |
| Lock-in de Jev | Baseline vendor-free obligatorio |
| `gitleaks`/`semgrep` no instalados en la máquina del usuario | Empaquetar o degradar con aviso claro |
| `semgrep` no corre nativo en Windows (WSL2/Docker) | Decisión explícita en Fase 2: Docker con degradación elegante, o matcher propio en Node para los patrones triviales |
| Falsos positivos de los detectores (claves de ejemplo, fixtures) | Muestra adjudicada por humano + IC antes de publicar cualquier precisión (Fase 2); ninguna cifra sin artefacto (regla dura 7) |
| El informe de 20 reglas parece un linter cualquiera | Se mide con usuarios: Fase 7 |
| Runway corto | Fases 1-4 son días, no semanas. Fase 7 no espera a la 6 |
| `A3` es human-in-the-loop y **bloqueante** | Añade latencia y una dependencia dura: sin OK del usuario el flujo no avanza. Se asume explícito; el flujo **no** inventa el perfil para seguir |
| Deriva de contexto no re-chequeada (`A6`) | El perfil congelado caduca: A6 es re-ejecutable y produce diff contra el perfil versionado, así la deriva se ve en vez de asumirse |
| Regla mal tipada (`juicio` vendida como `detector`, o al revés) | El tipo decide el motor; el censo la audita regla por regla y el fixture positivo/negativo la delata (Fase 1) |
| Prompts de C2 sobre acciones destructivas (rotar credenciales, reescribir historial) | Aviso explícito dentro del prompt; **no** se auto-ejecutan; el usuario decide |

---

## 9. Capa de consultoría: gratis vs pagado

**¿Esto es un flujo de consultoría de alto nivel?** No. Tal como está, es un flujo de **auditoría** de alto nivel. Lo que una consultoría entrega y este flujo no, en orden de valor:

1. **Impacto de negocio.** Una consultoría no entrega 40 hallazgos y se va: dice cuáles amenazan ingresos, usuarios o cumplimiento. Nuestra severidad es propiedad de la regla y **ciega al contexto** — medido: un JWT débil en una demo y en un banco reciben la misma severidad.
2. **Re-test después del arreglo.** Encontrado → arreglado → confirmado que se fue. Hoy no está en el flujo. Es el upsell natural.
3. **Alcance explícito.** Qué **no** se revisó. Protege a las dos partes. La clase `fuera` lo insinúa; no lo entrega.
4. **Trayectoria.** Segunda auditoría contra la primera: «pasaste de 12 críticos a 2». Eso es retención.
5. **Esfuerzo en unidades reales.** Hoy es un enum XS-XL propiedad de la regla.

La separación, limpia:

- **Gratis** = A, B, C, C2, D — la auditoría.
- **Pagado** = impacto, verificación, alcance, trayectoria.

Y: A4 da lo básico de escala gratis; el análisis profundo de impacto se queda pagado. **Escala sí, estrategia no.**

Sin la capa pagada, esto es un linter muy bueno.

---

## 10. Preguntas para validación (Kimi)

Respondidas en la revisión externa del 2026-10-06; el plan de arriba ya las incorpora. Se dejan escritas para que se vea contra qué se validó.

1. ¿El giro responde a los 3 objetivos, o el objetivo 1 pide otra cosa?
2. ¿La Fase 1 es prerequisito real de la 2-4, o la 2 puede empezar en paralelo?
3. ¿Bastan ~20 reglas para probar valor, o el vibecoder necesita cobertura desde el día uno?
4. ¿Jev está justificado, o el modo anclado vendor-free es suficiente y más simple?
5. ¿Qué falta en este plan?
6. ¿Qué se rompe del repo actual que no está listado en la sección 4?

---

## 11. Fuentes

- `docs/internal/HANDOFF.md` — estado y gotchas
- `benchmark/results-lote1-crossjudge/VALIDATION-REPORT.md`
- `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md`
- `docs/development/JEV_EXPERIMENT.md` — probe, resultados vivos, límite de 32k
- `docs/development/EXTERNAL_REVIEWS.md` — 7 revisiones externas
- `docs/CASE_STUDY.md` — pieza de lanzamiento
- `skills/CHANGELOG.md` — gobernanza del registro
- Revisión externa (Kimi) del 2026-10-06 — nueve correcciones verificadas, incorporadas a esta versión
