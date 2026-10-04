=== LIVE RUN ===

jev-probe — TypeSafe "Jev" probe (H1 rule selection, H2 line selection, H3 judging)
mode:       LIVE
target:     benchmark\work\realworld-control (git 30b68e1)
file:       src/app/routes/article/article.service.ts   (H2 ground truth: line 71, window 1-75 of 652)
module:     database   (H1 options = the canonical ids declared in skills/database-assessment.skill.md)
expected:   H1 --expect-id database-sequential-pagination-1   H2 --expect-line 71
endpoint:   https://api.typesafe.ai/v1/systemone
model:      jev-latest  (alias; docs say jev-latest = jev-1.13.0)
api key:    present (never printed, never written)
node:       v24.14.1
generated:  2026-10-03T23:55:38.795Z

REGISTRY (scripts/lib/canonical-registry.mjs — the same parser the validator uses)
  canonical rules in skills/*.skill.md : 368  (fingerprint 368-6e180554)
  rules declared by database skill : 32
  expected id present                  : YES  database-sequential-pagination-1 = high/S
  options with a condition/evidence description: 32/32

────────────────────────────────────────────────────────────────────────────────────────────────────
H1 — rule selection (Choice over canonical rule ids)
hypothesis: A Choice over the canonical ids makes an invented rule id structurally impossible; the open question is only whether it picks the RIGHT id.
baseline defect being tested: a real B2 run produced 5 of 5 non-existent rule ids; 14 of 21 findings contradicted the severity of the rule they cited
question id: rule_id   type: choice

request budget (measured BEFORE sending): state 3,704 + longest question 1,239 = 4,943 / 32,000 tokens — fits

RAW ANSWER
{
  "type": "choice",
  "choice": "database-overfetch-relation-1",
  "confidence": 0.63,
  "probabilities": {
    "database-lock-timeout-missing-10": 0,
    "database-missing-index-hot-path-2": 0,
    "database-missing-index-fk-1": 0,
    "database-iteration-overload-5": 0,
    "database-not-null-violation-4": 0,
    "database-effective-cache-misconfigured-4": 0,
    "database-work-mem-too-low-2": 0,
    "database-index-bloat-7": 0,
    "database-idle-timeout-missing-4": 0,
    "database-connection-timeout-high-3": 0,
    "database-full-table-scan-3": 0,
    "database-missing-index-where-4": 0,
    "database-irreversible-migration-1": 0,
    "database-unused-indexes-6": 0,
    "database-overfetch-relation-1": 0.65,
    "database-missing-composite-index-5": 0,
    "database-statement-timeout-missing-9": 0,
    "database-n-plus-one-risk-1": 0,
    "database-n-plus-one-confirmed-2": 0,
    "database-missing-bloat-monitoring-5": 0,
    "database-undersized-pool-2": 0,
    "database-oversized-pool-1": 0,
    "database-sequential-pagination-1": 0.35000000000000003,
    "database-missing-prefetch-4": 0,
    "database-irreversible-migration-2": 0,
    "database-maintenance-work-mem-too-low-3": 0,
    "database-pg-stat-statements-disabled-1": 0,
    "database-missing-app-pool-8": 0,
    "database-risky-migration-3": 0,
    "database-max-lifetime-missing-5": 0,
    "database-lazy-loading-danger-3": 0,
    "database-heavy-migration-5": 0
  }
}

INTERPRETATION
  chosen id: database-overfetch-relation-1
  chosen probability: 0.65   confidence: 0.63
  equals --expect-id database-sequential-pagination-1: NO
  in the canonical option list: YES — an out-of-list id is schema-impossible for a Choice, because the answer names one of the option keys we sent
  top-3 options by probability:
      #1 database-overfetch-relation-1: 0.65  [high/S]  [a REAL canonical rule in the option list]
      #2 database-sequential-pagination-1: 0.35000000000000003  [high/S]  ← the expected id
      #3 database-lock-timeout-missing-10: 0  [medium/XS]  [a REAL canonical rule in the option list]
  runner-up database-sequential-pagination-1 (high/S) is itself a REAL canonical rule: a file can genuinely violate MORE THAN ONE rule (article.service.ts really violates database-sequential-pagination-1 AND database-overfetch-relation-1), so a second choice that is a real rule is a co-violation signal, not a miss — it is surfaced here on purpose
  the expected id database-sequential-pagination-1 is #2 by probability (0.35000000000000003)
  probabilities sum: 1
  expected id: database-sequential-pagination-1 (high/S)
  severity/effort are STAMPED from the registry, never asked of the model: high/S — this is what makes the 14/21 severity-contradiction defect impossible for a valid id

VERDICT: FAIL — chose database-overfetch-relation-1 (high/S), a real rule, but not database-sequential-pagination-1; note the expected id is #2 in the top-3 probability list

────────────────────────────────────────────────────────────────────────────────────────────────────
H2 — line selection (Choice over real line numbers)
hypothesis: A Choice whose options are the real line numbers of the window makes a non-existent citation structurally impossible; the open question is whether the chosen line is the ground-truth line and carries the evidence.
baseline defect being tested: 9 of 21 findings (≈40%) cited a line with no evidence — imports, braces, blank lines, line 0
question id: evidence_line   type: choice

request budget (measured BEFORE sending): state 484 + longest question 252 = 736 / 32,000 tokens — fits

RAW ANSWER
{
  "type": "choice",
  "choice": "75",
  "confidence": 0.28,
  "probabilities": {
    "1": 0,
    "2": 0.17,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0.02,
    "9": 0,
    "10": 0,
    "11": 0,
    "12": 0,
    "13": 0,
    "14": 0.01,
    "15": 0.03,
    "16": 0,
    "17": 0,
    "18": 0,
    "19": 0.01,
    "20": 0,
    "21": 0,
    "22": 0,
    "23": 0,
    "24": 0,
    "25": 0,
    "26": 0,
    "27": 0,
    "28": 0,
    "29": 0,
    "30": 0,
    "31": 0,
    "32": 0,
    "33": 0,
    "34": 0,
    "35": 0,
    "36": 0,
    "37": 0,
    "38": 0.01,
    "39": 0,
    "40": 0,
    "41": 0,
    "42": 0,
    "43": 0,
    "44": 0,
    "45": 0,
    "46": 0,
    "47": 0,
    "48": 0,
    "49": 0,
    "50": 0,
    "51": 0,
    "52": 0,
    "53": 0.01,
    "54": 0,
    "55": 0,
    "56": 0,
    "57": 0,
    "58": 0,
    "59": 0,
    "60": 0,
    "61": 0,
    "62": 0,
    "63": 0,
    "64": 0,
    "65": 0,
    "66": 0,
    "67": 0,
    "68": 0,
    "69": 0.03,
    "70": 0.13,
    "71": 0.12,
    "72": 0.06999999999999999,
    "73": 0.03,
    "74": 0.05,
    "75": 0.3
  }
}

INTERPRETATION
  chosen line: 75 (option "75") of window 1-75
  chosen probability: 0.3   confidence: 0.28
  equals --expect-line 71: NO
  chosen line text: "  });"
  accepted ground-truth line(s): 71 (--expect-line only: this module ships no literal evidence locator) → the chosen line is NOT accepted
  line 75: 0.3   line 2: 0.17   line 70: 0.13
  the option list is the real line numbers, so a citation outside this window is schema-impossible

VERDICT: FAIL — line 75 is "  });", which is not ground truth (--expect-line 71)

────────────────────────────────────────────────────────────────────────────────────────────────────
H3 — judging (Noul × 2)
hypothesis: A Noul returns a truth probability directly, so a judge built on it cannot drift across prompt variants the way a generating judge does.
baseline defect being tested: the blind judge moved 11 verdicts across prompt variants without a single claim changing
question id: statement_a / statement_b   type: noul

request budget (measured BEFORE sending): state 3,704 + longest question 99 = 3,803 / 32,000 tokens — fits

RAW ANSWER
{
  "statement_a": {
    "type": "noul",
    "noul": 0.28
  },
  "statement_b": {
    "type": "noul",
    "noul": 0.19
  }
}

INTERPRETATION
  statement_a (TRUE)  → noul 0.28   called true? no
  statement_b (FALSE) → noul 0.19   called false? yes
  separation (a − b): 0.09   (thresholds: a ≥ 0.8 and b ≤ 0.2 for a CLEAN separation)
  a Noul takes no prompt variant, so there is no phrasing to re-roll the verdict with: the number IS the answer

VERDICT: DOES NOT SEPARATE — true 0.28 vs false 0.19

────────────────────────────────────────────────────────────────────────────────────────────────────
BUDGET FINDINGS — the 32k constraint that forces the per-module architecture
  per-module state (this probe, worst of 3): 3,704 tokens (H1 3,704, H2 484, H3 3,704) — fits with 28,296 tokens of headroom
  single-pass digest at the toolkit's configured budget (scripts/dktv-assess.mjs DIGEST_CONTEXT_CHARS=180,000 chars): 45,000 tokens + question 99 = 45,099 tokens → DOES NOT FIT (over 32k)
  refusal the guard would raise: TOKEN BUDGET REFUSED for "single-pass digest": state 45,000 + longest question 99 = 45,099 tokens, over the 32,000-token limit (state 180,000 chars). Nothing was sent. The state must be narrowed (a per-module prompt) or split.
  measured digest of THIS target (10,000 chars/file cap): 80,688 chars ≈ 20,172 tokens over 63 files (2 truncated) → fits on its own
  measured skills corpus (all 8 *.skill.md): 216,697 chars ≈ 54,175 tokens
  single-pass prompt = digest + skills = 297,385 chars ≈ 74,347 tokens → OVER the 32k state limit; vs the 64,000-token whole-request context: OVER
  conclusion: the per-module prompt fits with room to spare; the configured single-pass digest does not fit at all, and no single-pass prompt can carry both the digest and the 8 skill files inside 32k. The per-module architecture is therefore forced by the API limit, not a stylistic choice.

COST
  per request: H1 4,943 tok · H2 736 tok · H3 3,803 tok (estimate, chars/4)
  this run: 11,820 input tokens → $0.00049644 ($42/Btok of input, output free)
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
