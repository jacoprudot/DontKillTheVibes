# Comparison: real end-to-end run vs the Gemini baseline (real run, verbatim)

Same target (`temp/realworld`, the RealWorld API implementation). Baseline:
`../gemini-baseline/assessment-realworld-gemini-raw.md`. This run:
`./assessment.json` + `./assessment-report.md` (this folder).

## Coverage

| Metric | Gemini (real run) | DKTV (real run) |
|---|---|---|
| Total findings | 3 | 7 |
| Criticals | 0 | 1 |
| Highs | 1 | 3 |
| Security findings | 0 | 3 |
| Instances of the `favoritedBy` pattern reported | 1 (1 location) | 1 finding, 14 locations cited |
| The count+findMany pattern | 1 location | both functions (getArticles + getFeed) |

## False negatives in the baseline that this run caught

- **`security-jwt-weak-3`** (critical): the `'superSecret'` fallback at auth.ts:16/:21
  and token.utils.ts:4. The baseline missed it entirely — it is the most severe
  finding in the repo.
- **`security-cors-wildcard-2`**: `app.use(cors())` unrestricted (main.ts:13). Missed.
- **`security-error-detail-1`**: the error handler leaks raw `err.message`
  (main.ts:44). Missed.
- **Pagination pattern repetition**: the baseline cited one function; the pattern
  exists in two (getArticles :71, getFeed :114).

## Contract conformance

| Check | Gemini | DKTV (real run) |
|---|---|---|
| IDs `^[a-z-]+-\d+$` | ❌ `PERF-01` | ✅ |
| Module enum | ❌ "Performance" | ✅ |
| Effort enum | ✅ in this baseline — the out-of-enum `M/L` belongs to the other baseline: `../gemini-baseline/assessment-legal-rag-gemini-raw.md` | ✅ |
| `confidence` 0–1 | ❌ absent | ✅ on all 7 |
| `assessment.json` | ❌ not generated | ✅ |
| Prioritization algorithm | ❌ contradicted | ✅ scores computed, security first |
| Automatic validation | n/a | ✅ `VALID: 7 findings, 0 warnings` |

## Interpretation

- This run found **more, more severe, and contract-conformant output**. The Gemini
  baseline was accurate in what it reported (its 3 findings match findings 2, 3 and
  4 of this run) but missed the entire security surface — exactly the kind of
  omission a systematic per-module process (decision trees) exists to prevent.
- Honest limitation of this run: benchmark-mcp was not exercised (the realworld
  server was not running), so the performance findings are static. The performance
  skill marks this case as the pending "baseline protocol".
- What has changed since this comparison was written: the full 8-agent pipeline is
  now implemented (`scripts/dktv-orchestrate.mjs`) and was exercised as ARM C in
  the three-arm benchmark (`benchmark/results/`), where it matched or beat the
  single-pass arm on precision in 4 of 5 targets. This hand-run comparison remains
  valid as the per-finding audit trail.
