# DontKillTheVibes — deterministic assessment

- target: `C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\work\does-not-exist`
- files scanned: 0 · test/spec/fixture files excluded: 0 · rules run: 0 · skipped (tool not implemented): 0
- overall health: **C*** (worst-severity grade over detector findings; 0 critical)
- ⚠️ **grade capped by coverage**: coverage could not be computed (the scan failed, or no non-binary file was in scope): an unknown scope is not evidence of health (uncapped letter: A)
- ⚠️ **1 rule(s) did not complete**: (engine) — findings below are PARTIAL, see "Rule failures"
- 0 detector finding(s) + 0 checklist gap(s) — an ausencia hit means a safeguard is MISSING, not that a violation was found
- every detector finding is a raw mechanical signal (label `probado`) — verify by hand (file:line) before acting; precision is NOT yet measured (see protocol in PLAN.md)

## Coverage — what this run could actually see

**UNAVAILABLE**: the scan failed before coverage was computed (see "Rule failures"). Treat every count below as unknown, not as zero.

## Rule failures (named, never silent)

These rules did NOT complete. Findings elsewhere in this report are from the rules that did.

- **(engine)** — fatal-scan-error: target does not exist: C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\work\does-not-exist

## Truncated counts (floors, not totals)

No rule hit the 20-findings-per-rule cap, so the counts below are totals.

## Work plan (30/60/90)

Bucketing is deterministic: critical+high → 30 days, medium → 60, low/info → 90; order inside a phase is severity × module weight.

### 30 days (0)


### 60 days (0)


### 90 days (0)


## Findings — critical & high (0), grouped by file

## Appendix: medium / low / info (0)

One line each, priority order. These are signals, not the plan — verify before acting.


## Checklist gaps — ausencia checks (0)

These prove a safeguard is MISSING (a timeout, a budget, a monitor). They are not violations and carry no severity: a missing thing is missing in every repo until it isn't. Grouped by rule; fix is "add the safeguard", no per-finding prompt needed.

## Coverage vs baseline ruleset (paso D)

- Canonical registry: 368 rules
- Mechanical (detector/ausencia): 186 — fired: 0 · ran clean: 0 · not runnable yet (tool degraded, listed in findings.json): 0 · failed (error/budget): 1
- Findings per rule are capped at 20: 0 rule(s) stopped at the cap (their counts are floors)
- `juicio`: 116 — not evaluated by this engine (Fase 3; would carry label `juzgado`)
- `fuera`: 66 — out of scope by design

Degraded tools (named, never silent): none
