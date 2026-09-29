# Gemini Baseline (simulated run) — NON-CONFORMANT

Estos dos reportes fueron generados por Gemini (Antigravity IDE Synthesis Agent)
el 2026-09-29 contra `temp/realworld/` (gothinkster RealWorld API) y
`temp/chilo-legal/`.

## Por qué se conservan

Son el **baseline de referencia** para medir el valor real del toolkit:

- Las afirmaciones factuales fueron verificadas contra el código y son
  correctas (hallazgos reales, sin alucinación factual).
- El output **incumple 100% el contrato del toolkit**: IDs de hallazgo
  inválidos (`PERF-01` vs patrón `^[a-z-]+-\d+$`), sin campo `confidence`,
  sin `assessment.json`, effort `M/L` fuera de enum, priorización que
  contradice el algoritmo del synthesis-agent, y cobertura de ~4 hallazgos
  frente a las 334 reglas definidas en los skills.

El apéndice del reporte de realworld lo admite: *"Full deep-dive simulated
run"* — los MCPs no estaban conectados; el LLM interpretó el rol e improvisó
el formato.

## Uso

Todo validador de outputs (`scripts/` → validación contra
`templates/finding-schema.json`) debe **fallar** con estos archivos. Son el
caso de prueba negativo: representan exactamente el problema que el toolkit
existe para eliminar.
