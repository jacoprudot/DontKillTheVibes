# Detector fixtures

`tests/fixtures/detectors/<rule-id>/{positive,negative}/…` — one directory per
rule, two sides. `node scripts/detect/test-fixtures.mjs` (aka `pnpm test:fixtures`)
scans `positive/` with `onlyIds = {rule}` and REQUIRES at least one finding, then
scans `negative/` and REQUIRES zero. Exit 0 only if every run fixture passes.

Two fixture shapes exist:

1. **Plain tree fixtures** (the original shape). `positive/` and `negative/` are
   directories of files; the engine's working-tree rules read them directly.

2. **Git-history fixtures** for rules whose tool reads COMMITS (`git-log`, and a
   `gitleaks` spec whose `path_regex` targets `.git/`). A directory cannot carry
   a history, and `git clone` is blocked in this sandbox, so the gate
   MATERIALISES a real repository from a declarative tree of states:

   ```
   <rule>/positive/commits/<YYYY-MM-DDTHHMM[~N]>/<tree files…>
   <rule>/positive/commits/<YYYY-MM-DDTHHMM[~N]>/subject.txt      (optional)
   <rule>/secret_value.txt                                       (optional)
   ```

   - Each `commits/<stamp>/` directory is the COMPLETE tree at that commit: a
     file present in an earlier state and absent from a later one was deleted —
     which is how "committed and later deleted" is expressed.
   - The directory name carries the commit timestamp. No colon (`T1200`, not
     `T12:00`) because a colon is not a legal character in a Windows path. Order
     is lexicographic = chronological. `~N` repeats the same state N times with
     the same timestamp, which is how the commit-rate thresholds get exercised
     without 85 hand-written directories.
   - An optional `subject.txt` inside a state directory sets that commit's
     subject. It is fixture metadata: it is never copied into the repository.
   - All dates come from the directory names, so nothing in the gate depends on
     the wall clock.
   - `secret_value.txt`, when present, holds the obviously-fake value the rule is
     supposed to find. The gate asserts that value appears NOWHERE in the scan
     output (findings, evidence, coverage — the whole result object), in the
     normal run and in both capped runs. That is the redaction proof.
   - The gate also asserts, for every history fixture: the rule actually RAN (a
     degraded or failed rule FAILS the gate instead of passing as a zero), the
     positive/negative sides were not truncated by a cap, a capped run NAMES its
     cap (`gitLimits.maxCommits = 1`, `gitLimits.maxDiffBytes = 64`), and a
     shallow checkout is named `SHALLOW_CHECKOUT` instead of reporting a
     statistic over one visible commit.

   The sandbox facts behind that design (measured 2026-10-08, git 2.53.0):
   `git init`, `git add`, `git commit`, `git log`, `git rev-parse` all work in a
   temp directory; `git clone` fails (`msys NtCreateDirectoryObject
   0xC0000022`), and piped child stdio fails with EPERM — so the gate spawns git
   with `stdio: 'ignore'` and an argv array, never a shell.

Rules with a git-log spec and NO fixture (so: unvalidated, not "passing"): none
of the implemented checks; `flows-message-breaking-schema-2` is deliberately
degraded by the runner and must not be given a fixture that fakes it.
`github-commit-history-6` (no-merge-refs) is implemented but has no fixture yet:
its threshold needs a merge-heavy history, which needs real merge commits.
