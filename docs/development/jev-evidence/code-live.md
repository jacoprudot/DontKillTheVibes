=== LIVE RUN ===

jev-probe — TypeSafe "Jev" probe (H1 rule selection, H2 line selection, H3 judging)
mode:       LIVE
target:     benchmark\work\realworld-control (git 30b68e1)
file:       src/app/routes/article/article.service.ts   (H2 ground truth: line 69, window 1-73 of 652)
module:     code   (H1 options = the canonical ids declared in skills/code-quality-assessment.skill.md)
expected:   H1 --expect-id code-missing-validation-4   H2 --expect-line 69
endpoint:   https://api.typesafe.ai/v1/systemone
model:      jev-latest  (alias; docs say jev-latest = jev-1.13.0)
api key:    present (never printed, never written)
node:       v24.14.1
generated:  2026-10-03T23:55:39.821Z

REGISTRY (scripts/lib/canonical-registry.mjs — the same parser the validator uses)
  canonical rules in skills/*.skill.md : 368  (fingerprint 368-6e180554)
  rules declared by code skill : 59
  expected id present                  : YES  code-missing-validation-4 = high/M
  options with a condition/evidence description: 59/59

────────────────────────────────────────────────────────────────────────────────────────────────────
H1 — rule selection (Choice over canonical rule ids)
hypothesis: A Choice over the canonical ids makes an invented rule id structurally impossible; the open question is only whether it picks the RIGHT id.
baseline defect being tested: a real B2 run produced 5 of 5 non-existent rule ids; 14 of 21 findings contradicted the severity of the rule they cited
question id: rule_id   type: choice

request budget (measured BEFORE sending): state 3,704 + longest question 2,041 = 5,745 / 32,000 tokens — fits

RAW ANSWER
{
  "type": "choice",
  "choice": "code-any-type-6",
  "confidence": 0.94,
  "probabilities": {
    "code-logs-secrets-10": 0,
    "code-channel-not-closed-5": 0,
    "code-long-parameter-list-8": 0,
    "code-null-instead-of-exception-3": 0,
    "code-many-params-10": 0,
    "code-console-log-7": 0,
    "code-medium-length-8": 0,
    "code-slice-append-in-loop-6": 0,
    "code-any-type-6": 0.95,
    "code-structural-duplication-high-4": 0.02,
    "code-missing-error-main-10": 0,
    "code-extreme-length-6": 0,
    "code-loose-equality-1": 0,
    "code-promise-chain-missing-catch-5": 0,
    "code-boolean-parameter-plague-11": 0,
    "code-high-nesting-5": 0,
    "code-missing-docstring-10": 0,
    "code-blocking-in-goroutine-3": 0,
    "code-multiple-return-points-12": 0,
    "code-ignores-return-value-6": 0,
    "code-unchecked-error-1": 0,
    "code-map-lookup-unchecked-7": 0,
    "code-catch-and-continue-9": 0,
    "code-high-complexity-2": 0,
    "code-nested-ternary-9": 0,
    "code-interface-bloat-8": 0,
    "code-sql-injection-risk-4": 0,
    "code-too-many-params-9": 0,
    "code-extreme-complexity-1": 0,
    "code-exact-duplication-significant-2": 0,
    "code-deep-inheritance-9": 0,
    "code-exact-duplication-minor-3": 0,
    "code-mutex-missing-4": 0,
    "code-exact-duplication-massive-1": 0,
    "code-callback-hell-10": 0,
    "code-bare-except-1": 0,
    "code-empty-catch-1": 0,
    "code-long-function-7": 0,
    "code-boilerplate-repetition-7": 0,
    "code-structural-duplication-medium-5": 0,
    "code-god-object-6": 0,
    "code-print-statement-5": 0,
    "code-unhandled-promise-4": 0,
    "code-print-statement-8": 0,
    "code-bare-except-with-others-2": 0,
    "code-missing-return-type-8": 0,
    "code-too-many-attributes-7": 0,
    "code-copy-paste-variant-6": 0.02,
    "code-loose-inequality-2": 0,
    "code-extreme-nesting-4": 0,
    "code-warning-suppression-7": 0.01,
    "code-missing-validation-4": 0,
    "code-var-usage-3": 0,
    "code-generic-catch-2": 0,
    "code-mutable-default-3": 0,
    "code-error-assigned-unused-2": 0,
    "code-moderate-complexity-3": 0,
    "code-god-package-9": 0,
    "code-system-exit-misuse-5": 0
  }
}

INTERPRETATION
  chosen id: code-any-type-6
  chosen probability: 0.95   confidence: 0.94
  equals --expect-id code-missing-validation-4: NO
  in the canonical option list: YES — an out-of-list id is schema-impossible for a Choice, because the answer names one of the option keys we sent
  top-3 options by probability:
      #1 code-any-type-6: 0.95  [medium/S]  [a REAL canonical rule in the option list]
      #2 code-structural-duplication-high-4: 0.02  [medium/M]  [a REAL canonical rule in the option list]
      #3 code-copy-paste-variant-6: 0.02  [medium/M]  [a REAL canonical rule in the option list]
  runner-up code-structural-duplication-high-4 (medium/M) is itself a REAL canonical rule: a file can genuinely violate MORE THAN ONE rule (article.service.ts really violates database-sequential-pagination-1 AND database-overfetch-relation-1), so a second choice that is a real rule is a co-violation signal, not a miss — it is surfaced here on purpose
  the expected id code-missing-validation-4 is not in the top-3
  probabilities sum: 1
  expected id: code-missing-validation-4 (high/M)
  severity/effort are STAMPED from the registry, never asked of the model: medium/S — this is what makes the 14/21 severity-contradiction defect impossible for a valid id

VERDICT: FAIL — chose code-any-type-6 (medium/S), a real rule, but not code-missing-validation-4

────────────────────────────────────────────────────────────────────────────────────────────────────
H2 — line selection (Choice over real line numbers)
hypothesis: A Choice whose options are the real line numbers of the window makes a non-existent citation structurally impossible; the open question is whether the chosen line is the ground-truth line and carries the evidence.
baseline defect being tested: 9 of 21 findings (≈40%) cited a line with no evidence — imports, braces, blank lines, line 0
question id: evidence_line   type: choice

request budget (measured BEFORE sending): state 478 + longest question 244 = 722 / 32,000 tokens — fits

RAW ANSWER
{
  "type": "choice",
  "choice": "8",
  "confidence": 0.33,
  "probabilities": {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0.35000000000000003,
    "9": 0.02,
    "10": 0,
    "11": 0,
    "12": 0,
    "13": 0,
    "14": 0.08,
    "15": 0.04,
    "16": 0,
    "17": 0,
    "18": 0,
    "19": 0.03,
    "20": 0,
    "21": 0,
    "22": 0,
    "23": 0,
    "24": 0,
    "25": 0,
    "26": 0,
    "27": 0.09999999999999999,
    "28": 0.03,
    "29": 0.01,
    "30": 0,
    "31": 0,
    "32": 0,
    "33": 0.01,
    "34": 0,
    "35": 0,
    "36": 0,
    "37": 0,
    "38": 0,
    "39": 0,
    "40": 0,
    "41": 0,
    "42": 0,
    "43": 0,
    "44": 0.01,
    "45": 0,
    "46": 0,
    "47": 0,
    "48": 0,
    "49": 0,
    "50": 0,
    "51": 0,
    "52": 0,
    "53": 0.01,
    "54": 0.01,
    "55": 0,
    "56": 0,
    "57": 0,
    "58": 0.01,
    "59": 0.01,
    "60": 0,
    "61": 0,
    "62": 0,
    "63": 0,
    "64": 0,
    "65": 0,
    "66": 0,
    "67": 0,
    "68": 0,
    "69": 0.27,
    "70": 0,
    "71": 0,
    "72": 0,
    "73": 0
  }
}

INTERPRETATION
  chosen line: 8 (option "8") of window 1-73
  chosen probability: 0.35000000000000003   confidence: 0.33
  equals --expect-line 69: NO
  chosen line text: "const buildFindAllQuery = (query: any, id: number | undefined) => {"
  accepted ground-truth line(s): 69 (--expect-line only: this module ships no literal evidence locator) → the chosen line is NOT accepted
  line 8: 0.35000000000000003   line 69: 0.27   line 27: 0.09999999999999999
  the option list is the real line numbers, so a citation outside this window is schema-impossible

VERDICT: FAIL — line 8 is "const buildFindAllQuery = (query: any, id: number | undefined) => {", which is not ground truth (--expect-line 69)

────────────────────────────────────────────────────────────────────────────────────────────────────
H3 — judging (Noul × 2)
hypothesis: A Noul returns a truth probability directly, so a judge built on it cannot drift across prompt variants the way a generating judge does.
baseline defect being tested: the blind judge moved 11 verdicts across prompt variants without a single claim changing
question id: statement_a / statement_b   type: noul

request budget (measured BEFORE sending): state 3,704 + longest question 97 = 3,801 / 32,000 tokens — fits

RAW ANSWER
{
  "statement_a": {
    "type": "noul",
    "noul": 0.28
  },
  "statement_b": {
    "type": "noul",
    "noul": 0.31
  }
}

INTERPRETATION
  statement_a (TRUE)  → noul 0.28   called true? no
  statement_b (FALSE) → noul 0.31   called false? yes
  separation (a − b): -0.03   (thresholds: a ≥ 0.8 and b ≤ 0.2 for a CLEAN separation)
  a Noul takes no prompt variant, so there is no phrasing to re-roll the verdict with: the number IS the answer

VERDICT: DOES NOT SEPARATE — true 0.28 vs false 0.31

────────────────────────────────────────────────────────────────────────────────────────────────────
BUDGET FINDINGS — the 32k constraint that forces the per-module architecture
  per-module state (this probe, worst of 3): 3,704 tokens (H1 3,704, H2 478, H3 3,704) — fits with 28,296 tokens of headroom
  single-pass digest at the toolkit's configured budget (scripts/dktv-assess.mjs DIGEST_CONTEXT_CHARS=180,000 chars): 45,000 tokens + question 97 = 45,097 tokens → DOES NOT FIT (over 32k)
  refusal the guard would raise: TOKEN BUDGET REFUSED for "single-pass digest": state 45,000 + longest question 97 = 45,097 tokens, over the 32,000-token limit (state 180,000 chars). Nothing was sent. The state must be narrowed (a per-module prompt) or split.
  measured digest of THIS target (10,000 chars/file cap): 80,688 chars ≈ 20,172 tokens over 63 files (2 truncated) → fits on its own
  measured skills corpus (all 8 *.skill.md): 216,697 chars ≈ 54,175 tokens
  single-pass prompt = digest + skills = 297,385 chars ≈ 74,347 tokens → OVER the 32k state limit; vs the 64,000-token whole-request context: OVER
  conclusion: the per-module prompt fits with room to spare; the configured single-pass digest does not fit at all, and no single-pass prompt can carry both the digest and the 8 skill files inside 32k. The per-module architecture is therefore forced by the API limit, not a stylistic choice.

COST
  per request: H1 5,745 tok · H2 722 tok · H3 3,801 tok (estimate, chars/4)
  this run: 12,988 input tokens → $0.00054550 ($42/Btok of input, output free)
  projected full benchmark (5 targets × 8 modules at ASSUMED 4,000 + 20,000 tokens/module): 960,000 input tokens → $0.0403
  the full-benchmark line is an ASSUMPTION, not a measurement: only the probe itself has been measured.

WHAT THIS PROBE DOES NOT PROVE
  - n = 1 per hypothesis, on ONE file of ONE repository: this is a signal, not a benchmark.
  - H1/H2 prove the SHAPE of the answer is constrained. They do not prove the model is right in general — only that a wrong answer can no longer be an invented id or an invented line number.
  - H3 with two statements is the weakest of the three: one clean pair does not establish judge stability. A real test needs the same statements across prompt variants and repeated runs.
  - The state is English source code, and English is the model's primary language; this probe says nothing about accuracy on Spanish-first repositories.
  - The second-place option is reported rather than hidden: a file can legitimately violate more than one rule, so a runner-up that is itself a canonical rule is a co-violation signal, not automatically a wrong answer.
  - LIVE values come from the API.

artifacts: 
