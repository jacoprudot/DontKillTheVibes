=== LIVE RUN ===

jev-probe — TypeSafe "Jev" probe (H1 rule selection, H2 line selection, H3 judging)
mode:       LIVE
target:     benchmark\work\realworld-control (git 30b68e1)
file:       src/app/routes/auth/auth.ts
module:     security   (H1 options = the canonical ids declared in skills/security-assessment.skill.md)
endpoint:   https://api.typesafe.ai/v1/systemone
model:      jev-latest  (alias; docs say jev-latest = jev-1.13.0)
api key:    present (never printed, never written)
node:       v24.14.1
generated:  2026-10-03T23:44:26.760Z

REGISTRY (scripts/lib/canonical-registry.mjs — the same parser the validator uses)
  canonical rules in skills/*.skill.md : 368  (fingerprint 368-6e180554)
  rules declared by security skill : 45
  expected id present                  : YES  security-jwt-weak-3 = critical/XS
  options with a condition/evidence description: 45/45

────────────────────────────────────────────────────────────────────────────────────────────────────
H1 — rule selection (Choice over canonical rule ids)
hypothesis: A Choice over the canonical ids makes an invented rule id structurally impossible; the open question is only whether it picks the RIGHT id.
baseline defect being tested: a real B2 run produced 5 of 5 non-existent rule ids; 14 of 21 findings contradicted the severity of the rule they cited
question id: rule_id   type: choice

request budget (measured BEFORE sending): state 242 + longest question 1,479 = 1,721 / 32,000 tokens — fits

RAW ANSWER
{
  "type": "choice",
  "choice": "security-jwt-weak-3",
  "confidence": 1,
  "probabilities": {
    "security-debug-in-prod-1": 0,
    "security-vcs-insecure-9": 0,
    "security-db-no-tls-11": 0,
    "security-session-cookie-not-secure-3": 0,
    "security-logs-contain-secrets-12": 0,
    "security-gha-no-concurrency-prod-10": 0,
    "security-no-input-validation-14": 0,
    "security-gha-action-unpinned-5": 0,
    "security-secret-in-history-2": 0,
    "security-rate-limit-weak-6": 0,
    "security-cors-wildcard-2": 0,
    "security-db-conn-string-6": 0,
    "security-secret-in-code-1": 0,
    "security-weak-crypto-9": 0,
    "security-gha-auto-deploy-prod-9": 0,
    "security-env-file-committed-3": 0,
    "security-binary-dep-10": 0,
    "security-missing-headers-10": 0,
    "security-gha-overpermissive-2": 0,
    "security-weak-rng-10": 0,
    "security-jwt-weak-3": 1,
    "security-unmaintained-dep-4": 0,
    "security-gha-pr-target-risk-1": 0,
    "security-key-rotation-manual-13": 0,
    "security-outdated-server-9": 0,
    "security-gha-job-no-timeout-7": 0,
    "security-no-security-maintenance-7": 0,
    "security-session-cookie-not-http-only-4": 0,
    "security-gha-secret-leak-3": 0,
    "security-transitive-vuln-8": 0,
    "security-encryption-weak-5": 0,
    "security-cve-medium-3": 0,
    "security-gha-fork-pr-4": 0,
    "security-gha-workspace-not-cleaned-6": 0,
    "security-password-weak-5": 0,
    "security-directory-listing-8": 0,
    "security-oauth-secret-8": 0,
    "security-gha-no-container-8": 0,
    "security-private-key-7": 0,
    "security-file-upload-weak-7": 0,
    "security-exploit-in-wild-5": 0,
    "security-cve-high-2": 0,
    "security-license-incompatible-6": 0,
    "security-error-detail-1": 0,
    "security-cve-critical-1": 0
  }
}

INTERPRETATION
  chosen option: security-jwt-weak-3
  in the canonical option list: YES — an out-of-list id is schema-impossible for a Choice, because the answer names one of the option keys we sent
  security-jwt-weak-3: 1   security-debug-in-prod-1: 0   security-vcs-insecure-9: 0
  probabilities sum: 1   confidence: 1
  expected id: security-jwt-weak-3 (critical/XS)
  severity/effort are STAMPED from the registry, never asked of the model: critical/XS — this is what makes the 14/21 severity-contradiction defect impossible for a valid id

VERDICT: PASS — it chose the canonical rule for this defect, and the option list makes any other id impossible

────────────────────────────────────────────────────────────────────────────────────────────────────
H2 — line selection (Choice over real line numbers)
hypothesis: A Choice whose options are the real line numbers of the window makes a non-existent citation structurally impossible; the open question is whether the chosen line carries the evidence.
baseline defect being tested: 9 of 21 findings (≈40%) cited a line with no evidence — imports, braces, blank lines, line 0
question id: evidence_line   type: choice

request budget (measured BEFORE sending): state 259 + longest question 135 = 394 / 32,000 tokens — fits

RAW ANSWER
{
  "type": "choice",
  "choice": "16",
  "confidence": 0.99,
  "probabilities": {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    "11": 0,
    "12": 0,
    "13": 0,
    "14": 0,
    "15": 0,
    "16": 0.99,
    "17": 0,
    "18": 0,
    "19": 0,
    "20": 0,
    "21": 0.01,
    "22": 0,
    "23": 0,
    "24": 0,
    "25": 0,
    "26": 0,
    "27": 0,
    "28": 0
  }
}

INTERPRETATION
  chosen option: 16 → line 16 of window 1-28
  line text: "    secret: process.env.JWT_SECRET || 'superSecret',"
  line actually carries the evidence (process.env.JWT_SECRET || 'superSecret'): YES
  ground truth line(s) in the WHOLE file: 16, 21 (window starts at 1, so the first is 16)
  line 16: 0.99   line 21: 0.01   line 1: 0
  confidence: 0.99
  the option list is the real line numbers, so a citation outside this window is schema-impossible

VERDICT: PASS — line 16 is "    secret: process.env.JWT_SECRET || 'superSecret',", which contains the evidence

────────────────────────────────────────────────────────────────────────────────────────────────────
H3 — judging (Noul × 2)
hypothesis: A Noul returns a truth probability directly, so a judge built on it cannot drift across prompt variants the way a generating judge does.
baseline defect being tested: the blind judge moved 11 verdicts across prompt variants without a single claim changing
question id: statement_a / statement_b   type: noul

request budget (measured BEFORE sending): state 242 + longest question 89 = 331 / 32,000 tokens — fits

RAW ANSWER
{
  "statement_a": {
    "type": "noul",
    "noul": 0.98
  },
  "statement_b": {
    "type": "noul",
    "noul": 0.03
  }
}

INTERPRETATION
  statement_a (TRUE)  → noul 0.98   called true? yes
  statement_b (FALSE) → noul 0.03   called false? yes
  separation (a − b): 0.95   (thresholds: a ≥ 0.8 and b ≤ 0.2 for a CLEAN separation)
  a Noul takes no prompt variant, so there is no phrasing to re-roll the verdict with: the number IS the answer

VERDICT: SEPARATES — true 0.98 vs false 0.03, margin 0.95 (clean)

────────────────────────────────────────────────────────────────────────────────────────────────────
BUDGET FINDINGS — the 32k constraint that forces the per-module architecture
  per-module state (this probe, worst of 3): 259 tokens (H1 242, H2 259, H3 242) — fits with 31,741 tokens of headroom
  single-pass digest at the toolkit's configured budget (scripts/dktv-assess.mjs DIGEST_CONTEXT_CHARS=180,000 chars): 45,000 tokens + question 89 = 45,089 tokens → DOES NOT FIT (over 32k)
  refusal the guard would raise: TOKEN BUDGET REFUSED for "single-pass digest": state 45,000 + longest question 89 = 45,089 tokens, over the 32,000-token limit (state 180,000 chars). Nothing was sent. The state must be narrowed (a per-module prompt) or split.
  measured digest of THIS target (10,000 chars/file cap): 80,688 chars ≈ 20,172 tokens over 63 files (2 truncated) → fits on its own
  measured skills corpus (all 8 *.skill.md): 216,697 chars ≈ 54,175 tokens
  single-pass prompt = digest + skills = 297,385 chars ≈ 74,347 tokens → OVER the 32k state limit; vs the 64,000-token whole-request context: OVER
  conclusion: the per-module prompt fits with room to spare; the configured single-pass digest does not fit at all, and no single-pass prompt can carry both the digest and the 8 skill files inside 32k. The per-module architecture is therefore forced by the API limit, not a stylistic choice.

COST
  per request: H1 1,721 tok · H2 394 tok · H3 331 tok (estimate, chars/4)
  this run: 3,870 input tokens → $0.00016254 ($42/Btok of input, output free)
  projected full benchmark (5 targets × 8 modules at ASSUMED 4,000 + 20,000 tokens/module): 960,000 input tokens → $0.0403
  the full-benchmark line is an ASSUMPTION, not a measurement: only the probe itself has been measured.

WHAT THIS PROBE DOES NOT PROVE
  - n = 1 per hypothesis, on ONE file of ONE repository: this is a signal, not a benchmark.
  - H1/H2 prove the SHAPE of the answer is constrained. They do not prove the model is right in general — only that a wrong answer can no longer be an invented id or an invented line number.
  - H3 with two statements is the weakest of the three: one clean pair does not establish judge stability. A real test needs the same statements across prompt variants and repeated runs.
  - The state is English source code, and English is the model's primary language; this probe says nothing about accuracy on Spanish-first repositories.
  - LIVE values come from the API.

artifacts: 
