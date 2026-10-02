# Gemini Baseline — real Gemini run, verbatim, NON-CONFORMANT

Estos dos reportes son la **salida cruda y sin editar** de Gemini (Antigravity IDE
Synthesis Agent) del 2026-09-29 contra `temp/realworld/` (gothinkster RealWorld API)
y `temp/chilo-legal/`.

> **Sobre la palabra "simulated":** los apéndices de los propios reportes dicen
> *"Full deep-dive simulated run"*, pero eso se refiere a que **los MCPs no estaban
> conectados**, no a que los hallazgos fueran inventados. Las afirmaciones factuales
> son reales y verificables contra el código; lo que se improvisó fue el **formato**,
> no el contenido. Los archivos se conservan tal cual los emitió Gemini: si se
> editaran, dejarían de ser evidencia.

## Por qué se conservan

Son el **baseline de referencia** para medir el valor real del toolkit:

- Las afirmaciones factuales fueron verificadas contra el código y son
  correctas (hallazgos reales, sin alucinación factual).
- El output **incumple 100% el contrato del toolkit**: IDs de hallazgo
  inválidos (`PERF-01` vs patrón `^[a-z-]+-\d+$`), sin campo `confidence`,
  sin `assessment.json`, effort `M/L` fuera de enum, priorización que
  contradice el algoritmo del synthesis-agent, y cobertura de 3–4 hallazgos
  frente a las 394 reglas canónicas definidas en los skills.

El apéndice del reporte de realworld lo admite: los MCPs no estaban conectados, así
que el LLM interpretó el rol e **improvisó el formato**. Ese es exactamente el fallo
que el toolkit existe para eliminar: contenido plausible, contrato inexistente.

## Uso

Todo validador de outputs (`scripts/` → validación contra
`templates/finding-schema.json`) debe **fallar** con estos archivos. Son el
caso de prueba negativo: representan exactamente el problema que el toolkit
existe para eliminar.
