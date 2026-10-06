# DKTV — Lote 3: predicción pre-registrada (2026-10-06)

Este documento se commitea ANTES de correr el lote 3. Su propósito es fijar
qué esperamos del Fix P0 (digest con gutter + gate marca-no-rechaza +
reparación) para que el resultado no pueda girarse después: cada desenlace
tiene su interpretación escrita de antemano.

## Estado del harness en esta corrida (distinto del lote 2)

- El digest lleva números de línea reales (`withLineNumbers`, dktv-assess.mjs).
- El juez lee el contenido SIN gutter (`stripGutter`, judge.mjs): weak_citations
  es comparable dentro del lote 3 y con el lote 2 (definición restablecida).
- El patrón de id del mock runner está sincronizado con el schema real
  (`^[a-z0-9-]+-\d+$`): los 14 ids con dígitos ya no se rechazan.
- Gate de citas: marca (no rechaza) líneas fuera de rango y gasta una pasada
  de reparación acotada (≤5 findings, peor primero, solo `location.line`).

## Predicción principal

**Las líneas-en-rango suben de ~60% en ambos brazos (B y C), en repos
vibe-coded.** Base: lote 2 midió 62% (B) / 59% (C) con digest sin números.
Mecanismo esperado: el modelo ya sabe QUÉ archivo (100% de archivos citados
existían) y fallaba DÓNDE; ahora el dónde viene impreso en el digest.

## Predicción negativa (lo que P0 NO debe mover)

**El unverifiable de Arm C se mantiene alto.** En el lote 2, 297/553 (54%)
de los unverifiable de C tenían cita resuelta (376 grounded − 79 decidibles):
el juez tuvo el snippet y no pudo decidir. Eso es fallo de SOPORTE, no de
anclaje — P0 no lo toca. Si el unverifiable de C baja de forma importante,
algo más cambió y hay que explicarlo, no celebrarlo.

## Matriz de desenlaces

| Resultado | Interpretación (escrita antes de correr) |
|---|---|
| Grounding sube en ambos brazos, unverifiable de C ~constante | Confirmación del mecanismo. El P0 hace lo que medimos que debía hacer. |
| Grounding sube Y unverifiable de C baja de paso | Hallazgo mejor de lo esperado: la reparación/ventanas también atacan soporte. Documentar por separado, no fundir en una cifra. |
| Grounding NO sube | El mecanismo estaba mal — con números impresos el modelo sigue citando mal, o el gate/reparación no aplica. Se sabrá sin discusión porque se predijo lo contrario. Re-abrir la causa raíz. |
| Grounding sube solo en B, no en C | El orquestador no hereda el digest con gutter (ruta distinta de generación). Bug de integración, localizable. |
| weak_citations cambia >2x vs lote 2 | Regresión del stripGutter o de la definición. Comparación inválida hasta explicarla — la definición se cambió para que esto NO pase. |

## Condiciones

- Mismas familias de target que el lote 2 (repos vibe-coded, anonimizados),
  idealmente repos NUEVOS para no re-medir los mismos árboles.
- Mismo juez (deepseek-chat) y cross-juez (qwen local) para comparabilidad.
- Los números del lote 2 citados arriba (62/59%, 297/553, 376−79) se
  re-verifican contra `benchmark/results-lote2-crossjudge/` antes de comparar.
