# RealWorld Assessment (English) — pipeline-generated example

This example is the **raw output of the pipeline**, generated against the
[`gothinkster/node-express-realworld-example-app`](https://github.com/gothinkster/node-express-realworld-example-app)
control repo with:

```
node scripts/dktv-assess.mjs --target <realworld clone> --out examples/realworld-assessment-en --language en
```

- `assessment.json` — passed `validate-assessment.mjs` (`VALID: 6 findings`), severity/effort stamped from the canonical registry, `metadata.ruleset_version` pinned. It includes the critical `security-jwt-weak-3` finding (hardcoded `superSecret` JWT fallback).
- `assessment-report.md` — rendered deterministically from the JSON by `scripts/lib/report-renderer.mjs` (no LLM).
- `validation.txt` — the validator verdict for this exact document.

What it is not: hand-verified. For the hand-verified showcase with the
human-written report and the model-by-model comparison, see the Spanish
sibling [`examples/realworld-assessment`](../realworld-assessment) (with
`COMPARISON.md`). Both validate against the same contract.
