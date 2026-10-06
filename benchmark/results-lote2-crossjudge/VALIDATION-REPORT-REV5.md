# DKTV — Informe de validación consolidado, rev. 5 (2026-10-05)

Sistema: **DontKillTheVibes (DKTV)** — toolkit de auditoría para repos vibe-coded.
Contrato con schema estricto, 368 reglas dueñas de severidad/effort, health grade
por código (peor severidad, inmune al volumen), grounding mecánico de citas.

**Revisiones:** rev.1 → review externo (6 correcciones) → rev.2 aplicó. rev.3 agregó
lote 2 + acuerdo inter-jueces sin sesgo → review externo rev.3 (contradicción
numérica, métrica indulgente, kappa, hipótesis alternativa, gate sesgado, patrón
k8s, saturación de la health F) → rev.4 corrige con datos verificados →
**review externo rev.4** (44/44 era capacidad o suerte; alcance del Fix P0;
health F) → **rev.5 cierra la tercera ronda con datos**.

## Modelo real (bug H5 declarado)

Evaluación y self-juez: **deepseek-chat**. Cross-juez: **qwen3.5:9b local**. Los
`assessment.json` estampan `llm_used: "claude-sonnet-4-5"` — inventado por el
modelo, el campo no se estampa (bug pendiente).

## 1. Lote 1 (6 OSS maduros, brazos A+B): sin cambios respecto a rev.2/3

44 findings | 16/18/10 | grounding 44/44 (100%). Modo grounding genuino: 9/44
citas que no sostienen el claim.

**Corrección fina del review externo ("44/44 era suerte, no capacidad"):**
test de distribución sobre las 44 citas (`temp/test-lote1-lines.cjs`): solo 11%
citan línea 1–2; la posición citada está **repartida por todo el archivo**
(ratio línea/tamaño: p10 = 0.09, mediana = 0.30, p90 = 0.73). Esto mata la
versión fuerte de "suerte por archivos cortos" — el modelo no tira al inicio
y acierta; **estima posiciones distribuidas y acierta el rango en código
canónico** (imports arriba, handlers reconocibles). La lectura correcta no es
"capacidad de anclaje" (el digest nunca dio números) ni "suerte azarosa":
es **estimación que funciona en código canónico y falla ~40% en código
vibe-coded**. El dato publicable es el contraste, no el 44/44 aislado.

## 2. Lote 2 (10 vibe-coded, brazos A+B+C): agregados con las TRES columnas (corrección Q2)

| métrica | Arm B | Arm C |
|---|---|---|
| findings | 143 | 632 (4.4x) |
| decidibles | 43 (30%) | 79 (12.5%) |
| precisión en decidibles | 81% (35/43) | 82% (65/79) |
| **precisión sobre TODOS** | **24% (35/143)** | **10% (65/632)** |
| grounding mecánico | 62% | 59% |
| unverifiable | 100 (70%) | 553 (88%) |
| health F | 8/10 | 8/10 |

**La rev.3 decía "C aporta cobertura, no ruido" usando solo la columna 3. Con las
tres columnas, el titular se invierte:** bajo denominador completo (unverifiable
= no real), B gana 24% a 10%. La tasa de decibilidad difiere 2.4x entre brazos;
comparar precisión-en-decidibles compara dos filtros distintos, y C pasa por el
filtro más duro (sobreviven los casos más claros). Conclusión corregida: **C
produce más claims y una fracción menor es verificable-decidible; la arquitectura
multi-agente aún no demuestra superioridad de precisión** — demuestra superioridad
de cobertura bruta, que puede o no valer el costo según el uso.

## 3. El modo de fallo del grounding, CORREGIDO con datos (corrección Q1)

La rev.3 atribuía el colapso a "paths alucinados". Falso. Test ejecutado sobre
los 775 findings del lote 2:

- **100% de los archivos citados en `location.file` EXISTEN en el repo** — en
  todas las familias de regla, incluidas reglas `gha` en repos sin
  `.github/workflows` (47/47). La hipótesis "el modelo fuerza reglas que no
  aplican e inventa el path" queda **desprobada**.
- **Solo 60% de los números de línea están en rango** (reproduce exactamente los
  números del juez: 88/143 y 376/632). El modo de fallo real: **el modelo sabe
  qué archivo pero inventa el número de línea**.
- Causa raíz accionable: **el digest no lleva números de línea** — el modelo
  estima posiciones dentro del contenido y erra ~40% en repos vibe-coded (100%
  en OSS maduro del lote 1, donde los archivos son más cortos/canónicos).

**Fix P0 corregido (alcance acotado tras review):** (a) anotar el digest con
números de línea (el modelo cita exacto), y (b) gate mecánico en el runner que
**MARCA** (no rechaza — corrección Q4: rechazar crea incentivo a citar
cualquier archivo real, empujando hacia el modo de fallo que el gate no
detecta) los findings con línea fuera de rango, con loop de reparación.

**Este fix NO toca el segundo modo de fallo** (verificado aritméticamente):
en C, 297/553 unverifiable tenían cita resuelta (376 grounded − 79 decidibles
= 297) — el juez tuvo archivo Y línea en rango y el snippet no permitió
decidir. Eso es fallo de **soporte**, no de anclaje; se ataca por la otra
ruta ya conocida (loop de reparación con lectura real del archivo en B2, y
estructuralmente Choice sobre líneas de Jev). Declarado explícitamente para
que nadie venda P0 como "arregla la masa de unverifiable": arregla la mitad.

## 4. Acuerdo inter-jueces con kappa (corrección Q3)

Muestra aleatoria seedeada, sin sesgo de selección. 144/156 claims (92%; 12 no
juzgables por thinking-flood del 9B — límite documentado).

| brazo | acuerdo bruto | azar esperado | **kappa Cohen** |
|---|---|---|---|
| B (toolkit) | 53/72 (74%) | 56% | **0.405** |
| C (orquestado) | 64/72 (89%) | 81% | **0.424** |

**El 89% vs 74% era inflación de tasa base** (C tiene ~88% unverifiable; coincidir
en eso casi no cuesta). Corregido por azar, los dos brazos tienen acuerdo
inter-jueces idéntico y moderado (~0.41). La hipótesis de composición de la rev.3
se confirma: **no hay evidencia de que los claims de C sean intrínsecamente más
verificables** una vez corregida la tasa base.

Desacuerdo dominante en ambos brazos: deepseek=real → qwen=unverifiable
(discrepan en suficiencia de evidencia, no en criterio de defecto). Segunda
fuente de unverifiable confirmada (corrección numérica): en C, 297/553 (54%) de
los unverifiable tenían la cita SÍ resuelta — el juez tuvo el snippet y no pudo
decidir. Modo de fallo separado del grounding.

## 5. Contrato: bug de registro atrapado en vivo

eurekagent arm C rechazado: id canónico `cost-overprovisioned-k8s-1` viola
`^[a-z-]+-\d+$`. **Decisión corregida tras review: ensanchar el patrón a
`^[a-z0-9-]+-\d+$`** (estrictamente más permisivo; los 368 ids actuales siguen
válidos; sin migración ni cambio de fingerprint). Renombrar la regla costaría
todo eso.

## 6. Health F saturada — DECIDIDO (tercera ronda)

8/10 repos vibe-coded sacan F en ambos brazos. Decisión del owner con
recomendación del reviewer: **la fórmula se queda intacta**. La F dice "hay al
menos un crítico estampado", que es cierto y es exactamente el mensaje que el
producto existe para dar; romper la inmunidad al volumen reintroduciría el
incentivo perverso que quitamos (rellenar para diluir) y optimizaría la métrica
para que se vea bien. La saturación es una **propiedad de la población**, no un
defecto de la fórmula.

Añadido acordado: modificador **informativo** por conteo, sin tocar la fórmula:
`F·1` (un crítico) vs `F·3+` (tres o más). Es información añadida, no juicio
reintroducido; la discriminación que falta la da el critical_count ya visible
en el informe. Implementación pendiente junto a los fixes de la próxima sesión.

## 7. Lo publicable hoy (corregido, endurecido y reencuadrado en rev.5)

- **El contraste de líneas-en-rango 100% → 60%** entre OSS maduro y
  vibe-coded, con causa raíz identificada (el digest no lleva números de
  línea; el modelo estima y acierta en código canónico, erra ~40% en
  vibe-coded) y fix acotado. Este es el dato central publicable.
- Lote 2: **100% de archivos citados existen** (hecho verificable por script,
  sorprendente y duro) — pero ya NO como evidencia de "anclaje": como evidencia
  de que el modelo sabe *qué* archivo y falla solo *dónde*.
- Kappa inter-jueces ~0.41 en ambos brazos (moderado, comparable con la
  literatura LLM-judge).
- El contrato rechaza output inválido en vivo (bug k8s atrapado con 144
  findings en producción).

**No publicable:** precisión absoluta (requiere adjudicación: tercer juez de
familia distinta a deepseek y qwen, sobre TODOS los claims, + humano en muestra
sin sesgo de decibilidad — condiciones aceptadas del review Q5). Y ya no el
44/44 aislado: publicado como capacidad sería el mismo error que venimos
corrigiendo tres rondas.

## 8. Cierre de la tercera ronda (rev. 5)

Tres rondas, cuatro errores reales corregidos con datos, y una causa raíz
(digest sin números de línea) que ninguna de las dos partes había visto al
empezar. Los hallazgos del benchmark quedan certificados para publicación:
el contrato atrapando un bug de registro en vivo, el contraste 100%→60% con
causa raíz, el kappa idéntico en ambos brazos tras corregir tasa base, y la
reversión de métrica B-vs-C bajo denominador completo. La precisión absoluta
queda condicionada a adjudicación. GO de publicación de hallazgos.
