# SELECTION-100 — criterio pre-registrado de selección de repos (Fase 7)

**Frozen at:** 2026-10-08 (UTC, fecha del entorno) — versión 2. Sustituye al
borrador de la misma fecha que se congeló horas antes: ese usaba señales
genéricas de "vibe coding" y clonado shallow. Se descarta ANTES de producir
un solo clon utilizado (los 75 clones shallow del borrador se borraron sin
correrse) y ANTES de ver resultados de las queries de esta versión. Razón del
cambio: las plataformas nombrables son la señal real de vibecoding; y un
clone shallow deja muertas las reglas de historial (higiene de commits +
security-secret-in-history-2), con lo que la corrida se desperdiciaría.

Este archivo es lo que hace publicable la estadística: el criterio existe
antes de los números, no después.

## Queries exactas (api.github.com/search/repositories)

Los vibecoders usan plataformas. Las queries las nombran, en tres grupos de
términos (límite de la API: máximo 5 operadores OR por query — HTTP 422
"More than five AND / OR / NOT operators"):

- Grupo A (plataformas de generación): `Lovable OR Bolt.new OR "bolt.new" OR v0.dev OR Base44`
- Grupo B (agentes / declaración): `"Replit Agent" OR Cursor OR "Claude Code" OR "built with AI" OR "AI-generated"`
- Grupo C (señales de stack): `Supabase OR "Vite React" OR Next.js OR shadcn`

Una query por (grupo × lenguaje) = 9 queries, orden fijo: JavaScript,
TypeScript, Python; dentro de cada lenguaje grupo A, luego B, luego C.
Parámetros: `sort=stars`, `order=desc`, `per_page=100`.

El parámetro `q` de cada una es EXACTAMENTE:

```
(<TERMS>) in:readme stars:5..2000 pushed:>2026-08-09 archived:false language:<LANG>
```

Con `<TERMS>` = uno de los tres grupos y `<LANG>` ∈ {JavaScript, TypeScript, Python}.

## Filtros, tal cual

- `stars:5..2000`
- `pushed:>2026-08-09` (hoy − 60 días; hoy = 2026-10-08, fecha del entorno)
- `archived:false`
- `language:` JavaScript, TypeScript o Python
- `in:readme` con al menos un término de los grupos A/B/C

## Paginación

Páginas `page=1..10` por query (tope duro de la API de búsqueda: 1000
resultados visibles por query), hasta una página con menos de 100 resultados.

## Orden determinista

1. Pool = unión de las 9 queries.
2. Ordenar por **stars desc**, desempate por **full_name asc** (comparación ASCII).
3. Dedupe por `full_name`, conservando la PRIMERA ocurrencia en ese orden.
4. Tomar **los primeros 100**. Ni uno elegido a mano.

## Clonado: historial COMPLETO

```
git clone <url> benchmark/work100/<owner>__<repo>     # SIN --depth
```

SHA pineado = `git rev-parse HEAD` de la rama por defecto. Un clon válido
TIENE historial completo — se verifica con `git rev-list --count HEAD` en
muestras al azar (debe ser >> 1).

## Medición de señales (NO filtro)

Después de clonar, cada repo se clasifica por origen detectado en archivos:
`lovable-tagger` en package.json · `supabase/config.toml` · `.bolt/` ·
`components/ui/` (shadcn) · `next.config.*` · `.cursorrules` · `CLAUDE.md` ·
`requirements.txt` (python) · `manage.py` (django).

NO se filtra por esto. Se mide y se publica como distribución: "de 100
repos, X son origen Lovable, Y Bolt, Z ninguno detectable". Filtrar sería
elegir la muestra a gusto; medirla es un dato.

## Declaración

NINGÚN repo se descarta después de ver resultados. Si un repo cumple el
criterio y está dentro de los primeros 100 en el orden determinista, se
clona. Los únicos fallos posibles son técnicos (repo borrado entre la query
y el clone, red, permisos) y se reportan con su causa.

## Anonimización (reglas duras)

- Nunca el VALOR de un secreto de un tercero, ni su ubicación si es
  credencial viva: se cuenta sin nombrar el repo.
- `benchmark/work100/` nunca entra a git (terceros). Solo `targets-100.json`
  con metadata (name/url/commit/stars/language/signals/primary_stack).
- Antes de commitear: `git grep` de patrones de credenciales contra HEAD
  debe dar cero de terceros.
