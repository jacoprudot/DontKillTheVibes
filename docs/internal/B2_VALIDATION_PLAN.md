# Plan de validación — B2 (orquestador multi-agente)

> Documento interno. Define **cómo se valida B2**, con criterios falsables y una
> matriz de interpretación de fallos. Objetivo: que un resultado de B2 se pueda
> leer como *diagnóstico* (¿el problema es de acceso o de prompt?) y no solo como
> "salió bien" o "salió mal".
>
> Estado: B2 en construcción (`scripts/dktv-orchestrate.mjs` +
> `scripts/lib/repo-files.mjs`). Kimi tiene el harness (`benchmark/*`,
> `scripts/dktv-assess.mjs`). **No integrar B2 como brazo C hasta que su ronda cierre.**

---

## 1. Qué cambia B2, exactamente

| | Ruta actual (`dktv-assess.mjs`) | B2 (`dktv-orchestrate.mjs`) |
|---|---|---|
| Agentes usados | 1 de 9 (`synthesis-agent.md`) | **9 de 9** (8 especialistas + síntesis) |
| Qué ve cada agente | digest fijo recortado a N chars | **el árbol completo**, y luego **los archivos que pide** |
| Llamadas LLM por repo | 1 (+ reintentos) | 16 (8 módulos × 2 rondas) + síntesis **determinista en código** |
| MCPs | ninguno | ninguno *(B2 lee el filesystem local: misma capacidad, sin protocolo)* |
| Síntesis | el LLM produce el documento | **código**: merge, dedupe, score, fases |

**Hipótesis que B2 pone a prueba:** los dos defectos medidos — recall bajo y 40% de
citas débiles — vienen de que un solo prompt con un digest truncado obliga al modelo
a *adivinar* sobre 61 de 319 archivos. Si un especialista lee el archivo que necesita,
la cita debería apuntar al código correcto.

**Si B2 no mejora las citas, B3 tampoco lo hará** (misma capacidad, distinto
mecanismo). Esa es la razón de hacer B2 primero.

---

## 2. Baseline medido (contra esto se compara)

Ronda 3, brazo toolkit, single-pass, `--repeat 3` del juez, commit de la corrida
anterior. Control = `gothinkster/node-express-realworld-example-app` @ `30b68e1e`.

| Métrica | Baseline single-pass (control) |
|---|---|
| Hallazgos | 6 |
| real / false / inverificable | 5 / 0 / 1 |
| Precisión (juez) | 1.0 (rango 1–1, acuerdo 100%) |
| **Citas débiles** | **2/6 (33%)** |
| Recall vs los 7 hallazgos manuales | 2 exactos + 1 relacionado |
| `security-jwt-weak-3` (el crítico) | recuperado, cita `auth.ts:10` |
| Cobertura de módulos | parcial (según lo que entró en el digest) |

Y del agregado de 5 repos: 30 findings, 8 reales, 2 falsos, 20 inverificables,
**12/30 citas débiles (40%)**. El brazo naive: 64 claims, **0 verificables**.

---

## 3. Precondiciones (si algo falla, no se valida)

- [ ] `git status` limpio de conflictos; B2 no ha tocado ningún archivo existente.
- [ ] Kimi cerró su ronda: harness estable en `benchmark/`, sin escrituras en curso.
- [ ] `benchmark/work/realworld-control` clonado (control correcto, con `src/app/routes/auth/auth.ts`).
- [ ] `LLM_API_KEY` disponible por entorno. **Nunca se imprime ni se escribe a disco.**
- [ ] Entorno: en sandbox DSH los pipes de hijo están denegados (EPERM). Todo spawn
      debe capturar salida por **descriptor de archivo**, nunca `{encoding:'utf8'}`.
- [ ] `MAX_TOKENS` ≥ 32768 (modelos de razonamiento: una corrida real gastó 12 977
      tokens solo razonando con 8192 de presupuesto).

---

## 4. Puertas offline (sin API key) — P0 a P4

Todas deben pasar antes de gastar una sola llamada.

| # | Qué prueba | Comando | Criterio |
|---|---|---|---|
| P0 | Aislamiento de escritura | `git status --short` | Solo aparecen los 2 archivos nuevos de B2. Ni un archivo existente modificado. |
| P1 | Arranque | `node scripts/dktv-orchestrate.mjs --help` | exit 0, usage completo |
| P2 | Plan sin key | `--target benchmark/work/realworld-control --out temp/orch-dry --dry-run` | Imprime los 8 módulos, tamaño del árbol, retenidos por seguridad, presupuestos y tamaño de prompt. No llama a la red. |
| P3 | End-to-end offline | `--mock` y luego `node scripts/validate-assessment.mjs temp/orch-mock/assessment.json` | `VALID: N findings, 0 warning(s)` + los 8 `modules/*.json` escritos. Los artefactos mock deben estar etiquetados como mock de forma inconfundible. |
| P4 | **Prueba de fuga** | fixture con `.env` (valor señuelo), `certs/tls.pem`, `.gitignore` con `*.log`, `debug.log`, `src/app.js` | Los señuelos retenidos > 0 **y** el valor del `.env` / contenido del `.pem` **no aparece en ningún archivo de salida ni en el plan**. Un grep al directorio de resultados debe dar cero coincidencias. |

P4 no es opcional: `dktv-assess.mjs` ya envía contenido a un endpoint externo, y la
deny-list es la única barrera. Un fallo aquí detiene todo.

---

## 5. La prueba que importa — corrida real sobre el control

```powershell
$envFile = "$env:USERPROFILE\.config\opencode\.env"
$line = Get-Content $envFile | Where-Object { $_ -match '^\s*NVIDIA_API_KEY\s*=' } | Select-Object -First 1
$env:LLM_API_KEY  = ($line -split '=',2)[1].Trim().Trim('"').Trim("'")
$env:LLM_BASE_URL = 'https://integrate.api.nvidia.com/v1'
$env:LLM_MODEL    = 'nvidia/nemotron-3-super-120b-a12b'
$env:MAX_TOKENS   = '32768'

node scripts/dktv-orchestrate.mjs --target benchmark/work/realworld-control --out benchmark/results/realworld-control-b2
node scripts/validate-assessment.mjs benchmark/results/realworld-control-b2/assessment.json
```

Se usa el **control** porque es el único repo donde conocemos la verdad: los 7 hallazgos
de la evaluación manual y, sobre todo, el JWT `superSecret` en `auth.ts`.

### Lo primero que hay que mirar: el log de la ronda 1

Antes de juzgar la salida, revisar el log de peticiones del módulo **security**:

> ¿`src/app/routes/auth/auth.ts` aparece en el `need` de la ronda 1, **sin que nadie se lo diga**?

Esa sola línea decide la interpretación de todo lo demás (ver §7).

---

## 6. Criterios de éxito (falsables)

### C1 — El especialista pide lo que debe (acceso)
`security` incluye `auth.ts` (y ojalá `token.utils.ts`) en su `need` de ronda 1.
**Falsable:** sí/no en el log.

### C2 — La cita del crítico es fuerte (el test de la promesa)
`security-jwt-weak-3` con `location.file` = `src/app/routes/auth/auth.ts` y una línea
cuyo snippet **contiene la evidencia** (`JWT_SECRET`, `'superSecret'`), es decir
**NO clasificada como cita débil**.
Esto es más estricto que la ronda anterior, que recuperó el hallazgo con cita dudosa.

### C3 — Citas débiles
Objetivo: **≤1 cita débil del total** en el control (baseline: 2/6 = 33%).
Umbral de fracaso: >2.

### C4 — Recall
Recuperar **≥4 de los 7** hallazgos manuales (baseline single-pass: 2 exactos + 1
relacionado). El JWT es obligatorio; los otros 6 son `database-sequential-pagination-1`,
`database-overfetch-relation-1`, `code-missing-validation-4`, `code-any-type-6`,
`security-cors-wildcard-2`, `security-error-detail-1`.

### C5 — Contrato
`assessment.json` pasa el validador estricto (`VALID`), todos los IDs existen en el
registro canónico de 368, los tallies de `summary` cuadran, y `metadata` está
**estampado por el runner** — `llm_used` debe ser el id real del modelo, nunca un
nombre de agente inventado (ya observamos `synthesis-agent-v1`,
`dontkillthevibes-synthesis-agent` y `llm-synthesis-agent` en cinco corridas).

### C6 — Los 8 módulos corren de verdad
Se escriben los 8 `modules/*.json`. Un módulo con 0 hallazgos es un resultado válido;
un módulo que no se ejecutó no lo es.

### C7 — Coste acotado
≤17 llamadas LLM por repo (8×2 + 1 de reintento). Si se dispara, hay un bucle de
reintentos mal acotado.

### C8 — Juez
Re-juzgar el resultado de B2 con **el mismo juez y `--repeat 3`** que ya afinamos
(modelo distinto al evaluado, ciego). Publicar precisión **con rango**, nunca un
decimal suelto.

---

## 7. Matriz de interpretación (esto es lo que B2 viene a aclarar)

| Síntoma observado | Diagnóstico | Siguiente acción |
|---|---|---|
| C1 falla: `security` no pide `auth.ts` | El prompt de ronda 1 es demasiado débil para elegir archivos | Arreglar el prompt de petición (nombrar los artefactos que cada skill necesita), no el de grounding |
| C1 ok, C2 falla (cita débil o apunta a imports) | **No es acceso, es selección de línea.** El mismo fallo que en single-pass | Clasificador post-hoc de línea + reintento dirigido. B3 no lo arreglaría |
| C1 ok, C2 ok, C3/C4 no mejoran | Las reglas no cubren lo que hay; problema de contenido, no de pipeline | Ampliar árboles de decisión con evidencia, no tocar la orquestación |
| C2 ok pero C5 falla | La síntesis determinista tiene un bug (ids, talles, metadata) | Arreglo de código, acotado |
| C7 se dispara | Reintentos sin tope o JSON inválido en bucle | Acotar antes de sacar conclusiones: contamina todo |

**La pregunta abierta que B2 responde:** ¿el 40% de citas débiles era falta de acceso
al código, o el modelo elige mal la línea aunque lo tenga delante?

---

## 8. Integración como brazo C (después de que Kimi cierre)

Solo si C1–C8 se cumplen en el control:

1. Brazo C en el harness = `dktv-orchestrate.mjs`, **mismo modelo y mismo digest semilla**
   que el brazo B, para que la única diferencia sea la orquestación.
2. Los 5 targets, con el juez ciego y `--repeat 3`.
3. Tabla final por brazo: `real / false / unverificable`, precisión **con rango**,
   citas débiles, y recall vs la verdad conocida donde la haya.
4. **Las cifras publicables se atan a un commit exacto.** Antes de publicar:
   commit del harness+skills, commit del control, y recién entonces la corrida.

---

## 9. Frontera open-core (decisión de negocio)

- **Público (B2):** orquestador multi-agente que lee el filesystem local. Cumple la
  promesa del README ("8 specialist analyst roles + Synthesis Agent") y da un benchmark
  honesto y medible. Es el instrumento.
- **Privado (B3):** orquestación sobre **MCPs reales** (git-mcp, benchmark-mcp), datos
  de GitHub y medición de runtime. Es el producto que se cobra.

Consecuencia documental: el README no puede seguir insinuando que el CLI usa los MCPs.
Debe decir que los MCPs son la **ruta de integración con el cliente** (Claude Code,
Cursor, OpenCode — ya están en `mcp_config.json`), y que B3 es lo que unifica ambas
rutas. Ojo: hoy `git-mcp` y `benchmark-mcp` son **código muerto en la ruta del CLI** —
244 tests y ~86-88% de cobertura sin que ninguna ruta del producto los invoque.

---

## 10. Evidencia a capturar (para que las cifras sean defendibles)

- Comando exacto + salida cruda de P0–P4.
- Log de ronda 1 por módulo (`modules/*.json` → lista `need`), que es la prueba de C1.
- `assessment.json` + salida del validador.
- Salida del juez con `--repeat 3`, con el rango y la tasa de acuerdo.
- El **hash del commit** de la corrida.
- Y lo que salga mal, tal cual. Un benchmark que solo publica lo que le favorece no
  sirve para vender auditorías.

---

## Anexo — comandos rápidos

```powershell
# Puertas offline
node scripts/dktv-orchestrate.mjs --help
node scripts/dktv-orchestrate.mjs --target benchmark/work/realworld-control --out temp/orch-dry --dry-run
node scripts/dktv-orchestrate.mjs --target benchmark/work/realworld-control --out temp/orch-mock --mock
node scripts/validate-assessment.mjs temp/orch-mock/assessment.json

# Prueba de fuga (P4)
# (crear temp/orch-fixture con .env, certs/tls.pem, .gitignore, debug.log, src/app.js)
node scripts/dktv-orchestrate.mjs --target temp/orch-fixture --out temp/orch-leak --dry-run
Select-String -Path temp/orch-leak\* -Pattern 'super-secret-value' -Recurse   # debe dar 0

# Corrida real (con key) — ver §5
```
