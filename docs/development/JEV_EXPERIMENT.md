# JEV EXPERIMENT — does TypeSafe's Jev fix the two defects we measured?

> Status: **probe built, verified offline, and generalised to any module. No live run yet** (no
> `TYPESAFE_API_KEY` was available in this workspace; that is expected and the probe is designed
> to be useful without one).
>
> Artifact: [`scripts/jev-probe.mjs`](../../scripts/jev-probe.mjs) — three requests, one per
> hypothesis. It defaults to the `security` ground truth of
> `benchmark/work/realworld-control` (NestJS + Prisma control snapshot) and takes `--module`,
> `--file`, `--expect-id` and `--expect-line` to point at any other module's ground truth.
>
> This is a **probe, not an integration**. It answers three narrow questions and nothing
> else. It is not wired into `dktv-orchestrate.mjs`, it does not replace `benchmark/judge.mjs`,
> and it does not touch `benchmark/**` or `examples/**`.

---

## 1. What we are testing, and why these three questions

Three defects were measured on the B2 orchestrator. Each has a plausible structural fix in
Jev's primitive set, and each fix is falsifiable with one request.

| # | Defect measured | Proposed structural fix | What the probe would prove |
|---|---|---|---|
| **H1** | **Invented rule ids and severities.** A real run produced **5 of 5 non-existent ids**. Another run produced 21 findings of which **14 (67 %)** carried a severity or effort that contradicted the rule they cited (measured by `diffRuleFields`). | A `Choice` whose `criteria` map **is** the canonical rule list. | If the option list is the registry, an out-of-registry id is *schema-impossible*: a `choice` answer can only name an option key we sent. H1 proves the shape is closed and reports whether the model picks the **right** id. |
| **H2** | **Citations that point at nothing.** 9 of 21 findings (≈**40 %**) cited a line with no evidence: line 0, a blank line, an import, a lone `};`. The B2 runner carries a bounded citation-repair pass (`REPAIR_*` in `dktv-orchestrate.mjs`) purely to paper over this. | A `Choice` whose options are the **real line numbers of a window**. | Same argument as H1: line 999 or line 0 cannot be returned. H1/H2 remove the *whole failure class*, then we still have to check the model picked a line whose **text** carries the evidence. |
| **H3** | **An unstable judge.** The blind judge is a generating model we prompt and parse; across prompt variants it moved **11 verdicts** without a single claim changing. | `Noul` — a yes/no question that returns the truth probability directly. | There is no answer to re-roll and no prompt shape to drift: the number *is* the answer. H3 checks that one TRUE and one FALSE-but-plausible statement separate cleanly (true > 0.5 > false) and by how much. |

### Ground truth (mechanically checkable, no human judgement)

The probe is **module-parametric**. Every default is the security value, so all pre-existing
invocations are unchanged; `--module`, `--file`, `--expect-id` and `--expect-line` select
another module's ground truth.

#### Module → skill file: DISCOVERED from the file, never guessed from its name

H1's option list is the ids declared by **one** skill file. Which file that is comes from the
`module:` key in each file's YAML frontmatter — the probe reads `skills/*.skill.md` and builds
the mapping itself. A `<module>-assessment.skill.md` naming convention would be **wrong for two
of the eight files**, which is exactly why the mapping is read rather than assumed:

| `module:` | skill file | canonical rules declared |
|---|---|---|
| `security` | `skills/security-assessment.skill.md` | 45 |
| `database` | `skills/database-assessment.skill.md` | 32 |
| `code` | `skills/code-quality-assessment.skill.md` | **59** ← not `code-assessment.skill.md` |
| `cost` | `skills/cost-analysis.skill.md` | 50 |
| `flows` | `skills/flows-assessment.skill.md` | 50 |
| `performance` | `skills/performance-assessment.skill.md` | 71 |
| `structure` | `skills/structure-assessment.skill.md` | 29 |
| `github` | `skills/github-intelligence.skill.md` | 32 ← not `github-assessment.skill.md` |

368 canonical rules total, fingerprint `368-6e180554`. A module that no skill file declares is
refused with the list of modules that exist; a module declared by two files is refused as
ambiguous rather than silently picking one.

#### Per-module ground truth

| # | Ground truth | Where it comes from |
|---|---|---|
| H1 | `--expect-id` (default **`security-jwt-weak-3`**, declared `severity: critical, effort: XS`) | The id is hand-verified against `examples/realworld-assessment/assessment.json`; the severity/effort are looked up in the registry (`loadRules`) instead of hardcoded. The id must be one of the option keys, and the report asserts that. |
| H2 | `--expect-line` (default **16**), which must fall inside the window the probe sends | `src/app/routes/auth/auth.ts` (28 lines) matches `/process\.env\.JWT_SECRET\s*\|\|\s*['"]superSecret['"]/` on **lines 16 and 21**, so the security module additionally ships a literal evidence locator and accepts either. **Every other module is judged against `--expect-line` alone** — the accepted set is printed, so nothing is hidden. A wrong `--target`/`--file`/`--expect-line` is a hard error, never a meaningless "PASS". |
| H2 (window) | 1 … `max(40, expect-line + 4)`, clamped to the file length | The window **always covers the ground-truth line** and never ends on it. The security default collapses back to `1-28`, byte-identical to every earlier run. If the window would need more than the documented **255** options, the probe refuses before building anything (exit 2). |
| H3 | statement_a **TRUE**: the file falls back to the literal `'superSecret'` when `JWT_SECRET` is unset. statement_b **FALSE (plausible)**: the secret comes from a centralised secrets helper and the literal is only reachable in local development. | The file shows `secret: process.env.JWT_SECRET \|\| 'superSecret'` with **no** guard, twice, and no secrets helper anywhere. `\|\|` means it fails *open*, not closed. For any other module the pair is generated from that module's own `--expect-id`/`--expect-line`, so the Noul judges the file actually in the state. |

Hand-verified ground truth for the two extra modules the probe was generalised to test
(`examples/realworld-assessment/assessment.json` — the same file, the same lines):

| `--module` | `--file` | `--expect-id` | `--expect-line` | Also genuinely violated in the same file |
|---|---|---|---|---|
| `database` | `src/app/routes/article/article.service.ts` | `database-sequential-pagination-1` (high/S) | **71** | `database-overfetch-relation-1` (high/S) at line 98 |
| `code` | `src/app/routes/article/article.service.ts` | `code-missing-validation-4` (high/M) | **69** | `code-any-type-6` (medium/S) at line 69 |

Those second violations are the reason the report **surfaces the top-3 options by probability
instead of only the winner**: the file legitimately violates more than one rule, so a runner-up
that is itself a canonical rule is a co-violation signal, not a miss.

H3's false statement is deliberately *plausible* (env-var-with-dev-fallback is a very common
real pattern) rather than absurd, so a clean separation is evidence and not a freebie.

---

## 2. The request schema — read from the docs, not invented

Sources (fetched as raw markdown, which is where the field names came from):

* <https://docs.typesafe.ai/api> (`/api.md`)
* <https://docs.typesafe.ai/primitives/choice> · [/noul](https://docs.typesafe.ai/primitives/noul) · [/score](https://docs.typesafe.ai/primitives/score)
* <https://docs.typesafe.ai/introduction/quickstart>
* <https://docs.typesafe.ai/models> (`/models.md`) — the page that carries price, rate limits, context and the alias table
* <https://docs.typesafe.ai/concepts/state> (`/concepts/state.md`) — supported state shapes

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

Request — **all three top-level fields are required**:

```
{ state, model, questions }
  state     : string | object | array      // structured data is explicitly supported
  model     : string                       // "jev-latest" is the flagship alias
  questions : map<string, Question>        // the key is NEVER sent to the model
```

`Question` = `{ type, instructions, criteria }`:

| `type` | `criteria` | Answer fields |
|---|---|---|
| `"choice"` | `map<option, string \| object \| array \| null>` — **max 255 options**, `null` allowed when the option needs no detail | `choice`, `probabilities` (every option → float, sums to 1), `confidence` |
| `"noul"` | *optional* `{ true: <desc>, false: <desc> }` | `noul` — **no `confidence`** for a Noul (only two outcomes, so the value describes the whole distribution) |
| `"score"` | `array<string \| object \| array>` — 2…10 ordered levels | `score`, `legend`, `probabilities`, `confidence` |

`instructions` may be a string, object or array. Response:

```
{ model, answers: { <question id>: <Answer> }, usage: { input_tokens, output_tokens } }
```

Errors: `401` bad key · `422` validation · `429` rate limit · `529` overloaded. The docs tell
you to retry `429`/`529` with exponential backoff.

**Every fact supplied with this task is confirmed, and the page that confirms them is
<https://docs.typesafe.ai/models> — not `/api`, which documents the request shape only:**

| Supplied fact | Where it is confirmed | Confirmed value |
|---|---|---|
| `$42`/Btok of input, output free | `/models` | `Price (per Btok / per Mtok) $42 / $0.042`; "Charged per input token. Output tokens are free." |
| 100k tokens/s, 80 req/s | `/models` | `100K tokens per second / 80 requests per second` (flagged as *dynamically adjusting*) |
| 64k per request; state + longest question ≤ 32k | `/models` | `64k tokens per request; 32k tokens for state plus the longest question`; "the 64k budget covers the `state` plus all questions combined; the 32k budget applies to the `state` plus the single longest question" |
| `jev-latest` = `jev-1.13.0` | `/models` alias table | `jev-latest → jev-1.13.0` |
| English primary, other languages lower accuracy | `/models`, `/concepts/state` | "English is the primary training language and where accuracy is currently best" |

Three details the brief did not carry, which the probe handles:

1. **`529 Overloaded`** is a documented status code (`/api` error table) that should be retried
   alongside `429`/5xx. The probe retries it.
2. A `Score` has a hard **10-level** maximum and a `Choice` a **255-option** maximum. For the
   security defaults H1 uses 45 options and H2 uses 28, both well inside the limit; for
   `database`/`code` H1 uses 32/59 and H2 uses 75/73 (the line window has to reach line 71/69),
   still inside it. The probe refuses outright when a window would cross 255 — see §4.
3. **Data handling** (`/models`): "Jev is not trained on customer requests or responses", with
   zero data retention (ZDR) available for enterprise. Relevant to our own rule that client data
   is sacred — see the Spanish annex.

---

## 3. How to run it

```powershell
# 1. Offline, no key, writes NOTHING — this is the mode to audit first. The security defaults.
node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-probe --dry-run

# 2. The same probe pointed at another module's hand-verified ground truth (still offline).
node scripts/jev-probe.mjs --dry-run --module database --file src/app/routes/article/article.service.ts `
  --expect-id database-sequential-pagination-1 --expect-line 71 `
  --target benchmark/work/realworld-control --out temp/jev-probe
node scripts/jev-probe.mjs --dry-run --module code --file src/app/routes/article/article.service.ts `
  --expect-id code-missing-validation-4 --expect-line 69 `
  --target benchmark/work/realworld-control --out temp/jev-probe

# 3. Offline reporting path, no key, writes a clearly-labelled MOCK report.
node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-probe --mock

# 4. LIVE — the only mode that needs a key.
$env:TYPESAFE_API_KEY = '<from console.typesafe.ai/keys>'   # env only: never on the command line, never written to disk
node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-probe --module security --model jev-latest
Remove-Item Env:\TYPESAFE_API_KEY
```

Bash equivalent for the live run:

```bash
TYPESAFE_API_KEY='<key>' node scripts/jev-probe.mjs \
  --target benchmark/work/realworld-control --out temp/jev-probe --module security --model jev-latest
```

CLI:

```
node scripts/jev-probe.mjs --target <dir> --out <dir>
  [--module <name>] [--file <repo-relative path>] [--expect-id <canonical rule id>] [--expect-line <n>]
  [--model jev-latest] [--dry-run] [--mock] [--help]
```

| Flag | Default (the security ground truth) | What it does |
|---|---|---|
| `--module` | `security` | Which module's declared rules become H1's option list. The skill file is found through the frontmatter mapping, so **no module is rejected for not being security**; an unknown module is refused with the list of modules that exist. |
| `--file` | `src/app/routes/auth/auth.ts` | The repo-relative file H2 asks about, read through `openRepo` (deny-list intact). |
| `--expect-id` | `security-jwt-weak-3` | H1's ground-truth rule id. Must be one of the option keys; the report says whether it is. |
| `--expect-line` | `16` | H2's ground-truth line number. The window is extended to cover it and refused if that needs more than 255 options. |

Exit codes: `0` ok · `1` API/network failure · `2` usage/config (including a token-budget refusal
and the 255-option refusal).

Guardrails the probe enforces by itself:

* **`--dry-run` needs no key and writes nothing** — no `mkdir`, no file, no `process.env` read.
* **`--mock` needs no key and makes no network call.** Each hypothesis is answered **twice**, once
  PASS-shaped and once FAIL-shaped, so *both* verdict branches of every check are exercised
  offline instead of one being vacuously green (MOCK H1 also answers with a different real rule,
  and MOCK H3 fails to separate). The mock cost line says out loud that it is doubled and
  meaningless.
* The key is read from `TYPESAFE_API_KEY` only, never printed, never written.
* Repo content is read through `openRepo` from `scripts/lib/repo-files.mjs`, so the sensitive-file
  deny-list applies: `.env`, `*.pem`, `*.key`, `credentials*`, `id_rsa*` are **never** readable,
  and are excluded from the file tree as well as from content.
* Retries: 5 attempts, backoff **5/10/15/20 s**, honouring `retry-after`. `401`/`422` are not
  retried (a bad key or a malformed body does not improve).
* Child processes: the only spawn is the provenance capture (`node --version`,
  `git rev-parse --short HEAD`), and its output is captured through a **real file descriptor**
  (`stdio: ['ignore', fd, fd]`, no `encoding`), because piped stdio is denied with `EPERM` here.
* `TYPESAFE_ENDPOINT` overrides the endpoint. It exists so the retry path can be exercised
  offline against a closed port; nothing in the normal flow uses it.

---

## 4. The 32k constraint — why per-module fits and single-pass does not

The API allows **64k tokens per request**, of which **state + the longest single question must
fit in 32k**. The probe measures this *before every request* and **refuses to send** when it does
not fit (exit 2, clear error, nothing sent). Measured on the control snapshot:

| Request | State | Longest question | Total / 32k | Headroom |
|---|---|---|---|---|
| H1 (45 rule options) | 965 chars ≈ **242 tok** | 5,916 chars ≈ 1,479 tok | **1,721** | 30,279 |
| H2 (28 line options) | 1,035 chars ≈ **259 tok** | 537 chars ≈ 135 tok | **394** | 31,606 |
| H3 (2 Nouls) | 965 chars ≈ **242 tok** | 354 chars ≈ 89 tok | **331** | 31,669 |

Those three rows are the **security defaults, and they are byte-for-byte what the pre-generic
probe produced**: the module name is interpolated into H1's question, the security branch of H2's
question is kept verbatim, and the window rule collapses back to `1-28`. Diffing the whole
`--dry-run` output against the pre-change baseline leaves only three new *informational* console
lines (the discovered mapping, the ground truth, the accepted lines) — no budget, option count,
option key, instruction string or request body differs.

The same measurement for the two modules the probe was generalised to test — both on
`src/app/routes/article/article.service.ts` (652 lines, 13,380 chars), the one file that really
violates two rules in each module:

| Request | State | Longest question | Total / 32k | Headroom |
|---|---|---|---|---|
| `database` H1 (32 rule options) | 14,814 chars ≈ **3,704 tok** | 4,954 chars ≈ 1,239 tok | **4,943** | 27,057 |
| `database` H2 (75 line options, window `1-75`) | 1,934 chars ≈ **484 tok** | 1,006 chars ≈ 252 tok | **736** | 31,264 |
| `database` H3 (2 Nouls) | 14,814 chars ≈ **3,704 tok** | 394 chars ≈ 99 tok | **3,803** | 28,197 |
| `code` H1 (59 rule options) | 14,814 chars ≈ **3,704 tok** | 8,164 chars ≈ 2,041 tok | **5,745** | 26,255 |
| `code` H2 (73 line options, window `1-73`) | 1,911 chars ≈ **478 tok** | 975 chars ≈ 244 tok | **722** | 31,278 |
| `code` H3 (2 Nouls) | 14,814 chars ≈ **3,704 tok** | 387 chars ≈ 97 tok | **3,801** | 28,199 |

A B2 per-module prompt is the same shape: one skill + the files the module asked for + the
module's rule list. Everything there is *scoped*, so the state stays in the low thousands of
tokens and the option list stays at 32–59 instead of 368.

**The 255-option ceiling is real and now enforced.** H2's options *are* line numbers, so a
window of N lines is N options and the documented Choice maximum caps it. The window rule
(`1 … max(40, expect-line + 4)`, clamped to the file length) extends to cover the ground truth;
when that would exceed 255 the probe refuses **before building anything** (exit 2, nothing sent).
Verified on a 400-line fixture outside the repo:

```console
$ node scripts/jev-probe.mjs --dry-run --module database --target <fixture> --file src/long.ts \
    --expect-id database-sequential-pagination-1 --expect-line 300
error: the H2 window 1-304 would need 304 line options in one Choice, over the documented maximum
of 255 options. --expect-line 300 in src/long.ts (400 lines) forces this window. Nothing was sent:
probe a smaller file or a windowed excerpt instead.        # exit 2
```

`--expect-line 251` (window `1-255`, exactly 255 options) passes; `--expect-line 252` (256
options) is refused. The boundary is the documented number, not an approximation.

The single-pass digest does not fit:

| Measurement | Size | Verdict |
|---|---|---|
| The toolkit's configured digest budget (`DIGEST_CONTEXT_CHARS=180_000` in `scripts/dktv-assess.mjs`) | 180,000 chars ≈ **45,000 tok** (+89 tok question = 45,089) | **> 32k → refused.** This is the number the task asked to be measured, and the refusal comes from the same guard function the requests use. |
| The digest measured **for this target** (10,000 chars/file cap, via `openRepo`): 80,688 chars over 63 files (2 truncated) | ≈ **20,172 tok** | Fits *on its own*. Reported honestly: an aggressively capped digest of this small repo is not by itself over the limit. |
| The 8 skill files a single-pass prompt also has to carry (`skills/*.skill.md`) | 216,697 chars ≈ **54,175 tok** | On its own already **over 32k**. |
| **Single-pass prompt = digest + skills** | 297,385 chars ≈ **74,347 tok** | **Over the 32k state limit AND over the 64k whole-request context.** |

**Conclusion.** The per-module architecture is forced by the API limit, not by taste. Even
granting the most favourable digest cap, a prompt that carries the digest *and* the rule corpus
needs ≈74k tokens — more than the entire 64k context, before any question. A single-purpose
Choice question is the only shape that keeps the registry, the state and the question inside 32k.
The corollary is that the H1 option list must be **the module's rules** (45 for `security`, 32 for
`database`, 59 for `code`), not the whole registry (368): even the full registry would fit, but
scoping keeps the Choice discrimination problem small — and each extra option costs tokens and
dilutes the probability mass.

---

## 5. Cost

Published assumption used by the probe: **$42 per Btok of input, output free** (`output_tokens`
comes back in `usage` and is printed, but is not charged).

**This probe (measured, estimate = chars/4):**

| Module / request | Input tokens | Cost |
|---|---|---|
| `security` H1 / H2 / H3 | 1,721 / 394 / 331 | $0.00007228 / $0.00001655 / $0.00001390 |
| `security` **run total** | **2,446** | **$0.00010273** |
| `database` H1 / H2 / H3 | 4,943 / 736 / 3,803 | $0.00020761 / $0.00003091 / $0.00015973 |
| `database` **run total** | **9,482** | **$0.00039825** |
| `code` H1 / H2 / H3 | 5,745 / 722 / 3,801 | $0.00024129 / $0.00003032 / $0.00015964 |
| `code` **run total** | **10,268** | **$0.00043125** |

A live run replaces the estimate with the real `usage.input_tokens` and reports both. A `--mock`
run reports a doubled figure and labels it as meaningless (two stubbed answers per hypothesis,
nothing billed).

**A full 5-target benchmark (projection — this part is an assumption, not a measurement):**

```
5 targets × 8 modules × (4,000 tok round 1  +  20,000 tok round 2)
  = 5 × 8 × 24,000 = 960,000 input tokens
  = 0.00096 Btok × $42  =  $0.040
```

Order of magnitude: **five cents for the whole benchmark**, versus one LLM-completion call per
module at current provider prices for the same shape. Even if the per-module prompt were 3× the
assumption (72k tokens → 2.88M tokens total) the run is **$0.12**. Cost is not the deciding
factor here; correctness is. Note also that output tokens are free, which is the opposite of the
per-token economics we are used to — the expensive thing to send is the *state*, which is exactly
what the per-module architecture keeps small.

---

## 6. Language caveat

English is Jev's primary language; the docs accept other languages but state **lower accuracy**.
Our toolkit is **Spanish-first**: `dktv-orchestrate.mjs` defaults to `--language es`, the
assessment report is written in Spanish, and our target repositories have Spanish identifiers,
comments and READMEs.

Consequences for this experiment:

* The probe deliberately uses **English-only instructions and an English source file**, so the
  measured result is an *upper bound* on Jev's quality for us. A good H1/H2/H3 result in English
  says nothing about the Spanish path.
* If Jev is adopted, the state stays code (mostly language-neutral, but Spanish comments and
  domain nouns are state too), while the **question text** would have to be Spanish to produce
  Spanish-facing output — that is exactly the swap the docs warn about.
* **Follow-up probe before adoption:** re-run H1/H2/H3 with (a) Spanish `instructions`, and
  (b) a Spanish-heavy source file, and compare against the English baseline. Both are one
  `--model`/one file away; the probe needs no code change beyond pointing `--target` at a
  Spanish repo, and a small wording option if we want translated questions.

---

## 7. What the probe verifies offline, and what it cannot

Verified without a key:

* the 45-option H1 list is built from the **real registry** — `loadRulesFrom` (ids declared by
  `skills/security-assessment.skill.md`) joined with `loadRules` (authoritative severity/effort),
  both from `scripts/lib/canonical-registry.mjs`; `security-jwt-weak-3` is present and reads
  `critical/XS`; 45/45 options carry a condition + evidence description;
* the **module → skill file mapping** is discovered from frontmatter for all 8 modules
  (`code` → `code-quality-assessment.skill.md`, `github` → `github-intelligence.skill.md`, …),
  so the two files that break the naming convention are handled correctly;
* `--module database` (32 rules) and `--module code` (59 rules) build their option lists from
  their own skill files, and each `--expect-id` is a real option key;
* the **security regression is byte-for-byte**: diffing the full `--dry-run` output before and
  after generalisation changes only three new informational console lines — 45 options, 1,721 /
  394 / 331 tokens, and every request body, are identical;
* the `database` H2 window is `1-75` and contains line 71 verbatim; the `code` window is `1-73`
  and contains line 69 verbatim (checked against the emitted body, not asserted);
* 368 canonical rules across `skills/*.skill.md`, fingerprint `368-6e180554`;
* the H2 window and its options are the file's real 28 lines for security (the ground-truth
  pattern is found on lines 16 and 21), and `--expect-line` elsewhere;
* every request body is inside the 32k budget, and the single-pass digest is refused by the same
  guard;
* the **255-option refusal**: a 400-line fixture with `--expect-line 300` exits 2 with
  `the H2 window 1-304 would need 304 line options … over the documented maximum of 255`;
  `--expect-line 251` (window `1-255`, exactly 255 options) passes and `--expect-line 252`
  (256 options) is refused, so the boundary is the documented number and not an approximation;
* an unknown `--module` and an out-of-range `--expect-line` both exit 2 with a clear message;
* the whole report path (pass branch, fail branch, separation branch, mock labelling) — `--mock`
  exits 0 for `security`, `database` and `code`, and prints **both** a PASS-shaped and a
  FAIL-shaped verdict for **each** of H1/H2/H3;
* the retry path: 5 attempts with 5/10/15/20 s backoff against a closed port (see raw output),
  not against a real `429`/`529`.

**Cannot be verified here, and must not be claimed:**

* any statement about Jev's actual accuracy — there is no API key in this workspace, so the
  probe has never spoken to `api.typesafe.ai`. A MOCK report is a test of the harness, not a
  finding about Jev. The `database` and `code` ground truth is verified *offline* only: the
  request bodies are correct and the windows contain the right lines, but whether Jev picks them
  is untested;
* retry behaviour against a genuine `429` with a real `retry-after` header (only the closed-port
  network-error path was exercised — the backoff itself is confirmed at 5/10/15/20 s, 50.3 s total);
* price, rate limits and the alias→version mapping are taken from `/models` as documented; they are
  external facts that the probe asserts as constants, not things it measures;
* **H3 is the weakest hypothesis by construction**: one clean pair of statements is not judge
  stability. Proving the judge defect is fixed needs the same statements run repeatedly and
  across prompt variants — which is precisely the experiment that produced the 11 moved verdicts.
  For non-security modules the H3 statements are *generated* from `--expect-id`/`--expect-line`
  rather than hand-verified, so their truth is only as good as that ground truth.

---

## 8. Decision rule — what result would justify adopting Jev

| Outcome | Reading |
|---|---|
| H1 picks `security-jwt-weak-3` and H2 picks line 16 or 21, with usable confidence (or, for another module, its own `--expect-id` / `--expect-line`) | The two measured defect classes are **structurally closed**, not just reduced. Adopt for rule id + citation selection. |
| H1/H2 correct but with low confidence / split probability | Structure is closed but the model is unsure. Usable **with a confidence gate** (docs: low confidence → ask a human), which is a much better failure mode than an invented id. |
| H1 or H2 wrong (a valid but wrong option) | The structural fix removes invented values but not wrong values. **Check the top-3 first**: if the runner-up is itself a canonical rule, the file may genuinely violate more than one rule (`article.service.ts` does, in both `database` and `code`), so a "miss" on the winner can still be a correct second finding. |
| H3 separates cleanly **and** reproduces across repeated runs | The judge can move off a generating model. Until repeated runs confirm it, keep `benchmark/judge.mjs` and treat Noul as an *additional* signal. |

Whatever the outcome: this is **n = 1 per hypothesis on one file of one repository**. It is a
signal with a clear decision rule, not a benchmark.

---

## Anexo (español) — costo y decisión de negocio

**Qué costaría probarlo de verdad.** La corrida real de este probe cuesta del orden de
**$0.0001** (2.446 tokens de entrada) con el módulo `security`; con `database` o `code` sobre
`article.service.ts` sube a **≈$0.0004** (9.482 / 10.268 tokens), porque el estado lleva el
archivo completo (652 líneas). Un benchmark completo de 5 targets × 8 módulos se
proyecta en **≈$0.04** con el supuesto de 24.000 tokens por módulo. Es decir: el costo no es la
razón para no probarlo. Lo caro hoy no es Jev, es seguir reparando citas débiles y severidades
inventadas con código propio (`REPAIR_*`, `stampRuleFields`) y un juez que se mueve con el
prompt.

**Qué compraríamos.** No un modelo más listo, sino **tres restricciones de forma**: el id de
regla sale del registro o no sale; la línea citada existe o no existe; el veredicto de un juez
es un número en vez de un prompt. Eso es exactamente el tipo de garantía que un toolkit de
auditoría necesita para que un informe sea defendible ante un cliente.

**La advertencia honesta.** Todo lo medido está en inglés, y nuestro toolkit es
español-primero. Antes de adoptar hay que repetir H1/H2/H3 en español: si la precisión cae, la
restricción de forma sigue tapando los ids inventados, pero el valor del juicio (H3) se cae.

**Dato de cumplimiento.** `/models` dice que Jev **no se entrena con las peticiones ni las
respuestas del cliente**, y que hay retención cero (ZDR) en planes enterprise. Eso importa para
nuestra regla de "datos de clientes son sagrados": mandar código de cliente a este endpoint es
defendible, pero conviene aclararlo por escrito con el cliente antes de la primera corrida real.

---

## Raw verification output

Full transcripts of the offline runs are reproduced in the hand-off message for this task.
The commands are:

```powershell
node --check scripts/jev-probe.mjs                                  # exit 0
node scripts/jev-probe.mjs --help                                   # exit 0, shows --module/--file/--expect-id/--expect-line

# security regression: byte-for-byte identical to the pre-generalisation run
node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-probe --dry-run   # exit 0, wrote nothing

# the same probe against the two hand-verified non-security ground truths
node scripts/jev-probe.mjs --dry-run --module database --file src/app/routes/article/article.service.ts `
  --expect-id database-sequential-pagination-1 --expect-line 71 `
  --target benchmark/work/realworld-control --out temp/jev-probe                                     # exit 0
node scripts/jev-probe.mjs --dry-run --module code --file src/app/routes/article/article.service.ts `
  --expect-id code-missing-validation-4 --expect-line 69 `
  --target benchmark/work/realworld-control --out temp/jev-probe                                     # exit 0

# both verdict branches of every hypothesis, for three modules
node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-probe --mock      # exit 0, MOCK report
node scripts/jev-probe.mjs --mock --module database --file src/app/routes/article/article.service.ts `
  --expect-id database-sequential-pagination-1 --expect-line 71 --target benchmark/work/realworld-control
node scripts/jev-probe.mjs --mock --module code --file src/app/routes/article/article.service.ts `
  --expect-id code-missing-validation-4 --expect-line 69 --target benchmark/work/realworld-control

# the 255-option refusal (400-line fixture OUTSIDE the repo, so nothing here is modified)
node scripts/jev-probe.mjs --dry-run --module database --target <fixture-dir> --file src/long.ts `
  --expect-id database-sequential-pagination-1 --expect-line 300                                       # exit 2, nothing sent
```

No command above needs `TYPESAFE_API_KEY`. `git status --short` after all of them lists only
`scripts/jev-probe.mjs` and this document.
