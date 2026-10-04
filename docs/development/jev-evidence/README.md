# Jev probe — live evidence (2026-10-03)

Raw, unedited API output from the **live** runs of
[`scripts/jev-probe.mjs`](../../../scripts/jev-probe.mjs) against
`https://api.typesafe.ai/v1/systemone`. These are the artifacts the analysis in
[`JEV_EXPERIMENT.md`](../JEV_EXPERIMENT.md) rests on. They are **evidence, not documentation**:
do not hand-edit them, and do not reformat them. If a claim in the analysis disagrees with these
files, the files win.

Until this directory existed, the only copies lived under the gitignored `temp/`, i.e. one
`git clean` away from being destroyed.

## What was run

| Artifacts | Module | File in the target | H1 `--expect-id` | H2 `--expect-line` |
|---|---|---|---|---|
| `security-live.json` · `security-live.md` | `security` | `src/app/routes/auth/auth.ts` | `security-jwt-weak-3` | 16 |
| `database-live.json` · `database-live.md` | `database` | `src/app/routes/article/article.service.ts` | `database-sequential-pagination-1` | 71 |
| `code-live.json` · `code-live.md` | `code` | `src/app/routes/article/article.service.ts` | `code-missing-validation-4` | 69 |

* **Nine live POSTs total** — three per run (H1 rule selection, H2 line selection, H3 judging).
  Each `*-live.json` contains exactly three `requests` and three `results`; no retry line appears
  in any report, so no POST was repeated.
* **Date:** `generated_at` `2026-10-03T23:44:26.760Z` (security),
  `2026-10-03T23:55:38.795Z` (database), `2026-10-03T23:55:39.821Z` (code) — all 2026-10-03,
  local time (UTC−6) 17:44 and 17:55.
* **Model:** requested alias `jev-latest`; the API reported the served model as
  **`jev-1.13.0`** (`results.*.modelReported` in each JSON).
* **Target:** `benchmark/work/realworld-control`, the NestJS + Prisma control snapshot, which is
  its own git checkout; the probe's provenance block names that snapshot's commit `30b68e1`
  (2024-01-04). That is the *control repository's* commit, not this repository's.
* **Runtime:** `node v24.14.1`.
* **Key handling:** the key was passed only through the `TYPESAFE_API_KEY` environment variable.
  It is not in these files, in the probe script, or anywhere else in the repository — see
  "Secret scan" below.

## The exact commands

```powershell
$env:TYPESAFE_API_KEY = '<from console.typesafe.ai/keys>'   # env only: never on the command line, never written to disk

node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-run `
  --module security --model jev-latest
node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-db `
  --module database --file src/app/routes/article/article.service.ts `
  --expect-id database-sequential-pagination-1 --expect-line 71 --model jev-latest
node scripts/jev-probe.mjs --target benchmark/work/realworld-control --out temp/jev-code `
  --module code --file src/app/routes/article/article.service.ts `
  --expect-id code-missing-validation-4 --expect-line 69 --model jev-latest

Remove-Item Env:\TYPESAFE_API_KEY
```

The `--out` values above are the directories the artifacts actually came from (`temp/jev-run`,
`temp/jev-db`, `temp/jev-code`); everything else is recorded inside the JSON itself (target,
file, module, expected id, window). The probe does not record argv, so the commands are
reconstructed from those recorded parameters, not read back from the artifacts.

## Measured cost

| Run | `usage.input_tokens` (API-reported) | Cost at $42/Btok |
|---|---|---|
| `security` | 3,870 | $0.00016254 |
| `database` | 11,820 | $0.00049644 |
| `code` | 12,988 | $0.00054550 |
| **total** | **28,678** | **$0.00120448** |

Output tokens are free, so the whole three-module experiment cost about **a tenth of a cent**.
These figures are the API's own `usage.input_tokens` for each run (all three requests), not the
probe's `chars/4` estimate; the estimates printed in the reports were 2,446 / 9,482 / 10,268
tokens, i.e. the live calls were 1.4–1.6× the estimate, which is why the measured number is the
one to quote.

## Read the verdicts in these reports with care

`security-live.md` reports PASS / PASS / SEPARATES. `database-live.md` and `code-live.md` report
**H1 FAIL, H2 FAIL, "H3 does not separate"** — and those automated verdicts are **wrong** for a
documented reason: the probe asks "which ONE rule" and scores against a single nominated id,
while `article.service.ts` genuinely violates two rules per module and our hand-verified
assessment lists both. The re-scoring, and everything that still is not verified, is in
[`JEV_EXPERIMENT.md`](../JEV_EXPERIMENT.md) §7. The files here are left exactly as the API and
the probe produced them.

## Secret scan (gate run before anything was copied)

Every candidate artifact was scanned before publication, and the copies were re-scanned after:

| Pattern (case-insensitive) | Result |
|---|---|
| `apikey`, `api_key`, `api-key`, `typesafe_api_key` | In the **artifacts**: 2 hits, both the literal `$API_KEY` placeholder inside the *description text of a security rule* (`security-gha-secret-leak-3`): `IF secret used in log output — echo \"$API_KEY\" …`. Not a credential. In `scripts/jev-probe.mjs`: the local variable `apiKey` (assigned from `process.env.TYPESAFE_API_KEY`) and its doc comments — no literal. |
| a run of 40+ `[A-Za-z0-9_-]` (the real key was 108 chars, prefix `apikey_`) | 3 + 1 hits **in the candidate artifacts**, all the canonical rule id `database-effective-cache-misconfigured-4` (exactly 40 chars). The only other 40+ runs anywhere in this directory are the SHA-256 digests printed below. No key-shaped string. |
| `authorization`, `bearer` | only the `auth.ts` source under test (`req.headers.authorization`, `'Bearer'`) and the documented request header. |
| `secret`, `token` | only rule ids/descriptions, the `JWT_SECRET` sample code under test, and token *budget* accounting (`input_tokens`, `state_tokens`). |
| literal `apikey_` | **zero hits** — in these files, and in the whole working tree outside `node_modules/` and `.git/`. |
| `scripts/jev-probe.mjs` | reads the key from `process.env.TYPESAFE_API_KEY` only; no literal key, no `apikey_`; the only 40+ character runs are ASCII comment rules. |

## Integrity

SHA-256 of each file as committed (`Copy-Item` byte-for-byte; source and copy hashes compared
equal, and the raw artifacts were never edited afterwards):

```
security-live.json   30802  ed544e98da977d5d35fb2e11860dd329e5dd4e592d2d6a007046a558258a6def
security-live.md     10034  9985f3abe6c6858aaf42cbe08d2b70daebd158e8ddbb49c73a4cd221a0025fdd
database-live.json   58933  581e2ae61385e0ef73f787d0e89f13eb70563efb96775398573bd31f0d7a1737
database-live.md     11555  536535b77e656fcd1e11e2c94501a96b1c021047898cb80a45b7ca507be6e933
code-live.json       69253  3506d77b8a540639b995218f751fcdee1bc58122d9a65f6a2120e962f60d32d2
code-live.md         12305  33ea7ddd6ae6e63a4c9bd61d1bf57d5f2d93385436be4d5baf52221d1fbd6277
```

## Not evidence: the mock runs

`temp/jev-probe/` and `temp/jev-verify/` (including `mock-security/`, `mock-database/`,
`mock-code/`) are **MOCK / offline** runs: no key, no network call, stubbed answers meant to
exercise both verdict branches of the harness. They are deliberately **not** versioned here.
Their reports are labelled `=== MOCK RUN ===` and their cost line says the figure is doubled and
meaningless.
