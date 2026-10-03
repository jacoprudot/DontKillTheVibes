# Ruleset CHANGELOG

The canonical rule registry is `skills/*.skill.md`. Every `→ FINDING: <id>` line is a
public id: shipped reports cite it, so adding, removing or re-scoring one changes the
tool's observable contract. This file is the record of those changes.

## Convention

- **Every ruleset change gets a dated entry, newest first.**
- The entry MUST contain the **fingerprint computed after the change**, written verbatim
  (for example `368-6e180554`). The fingerprint is
  `rulesetFingerprint()` from `scripts/lib/canonical-registry.mjs`:
  `"<rule count>-<sha256[0..8]>"` over the canonical string
  `` `${id}|${severity}|${effort}` `` for every rule, ids sorted, joined by `\n`, with
  `null` severity/effort rendered as the empty string. Same rules => same fingerprint; any
  add, removal or severity/effort change => a different fingerprint.
- Each entry lists **what changed**: added ids, removed ids, severity/effort changes,
  deprecations (with their replacement), plus the rule count and, when the change is a
  reclassification, what the ids became instead.
- **Rules are retired by deprecation, never by deletion.** Keep the `→ FINDING:` line and
  append `[deprecated -> <replacement-id>]` (or `[deprecated]` when nothing replaces it):
  the id stays canonical so past reports keep validating, and the validator downgrades a
  citation of it to a warning. A deleted id is a broken report.
- Record **why**, in one line. A bare id list does not explain a reclassification.

## How it is enforced

- `node scripts/registry-diff.mjs [git-ref]` rebuilds the registry from the working tree and
  from the same files at `git-ref` (default `HEAD`), prints ADDED / REMOVED / CHANGED /
  DEPRECATED plus both fingerprints, and gates on this file:
  - fingerprint changed and this file does not mention the new fingerprint => exit 1;
  - an id removed without `[deprecated …]` => exit 1, always;
  - fingerprint unchanged => exit 0 (nothing to declare).
- `pnpm validate:skills` fails on a duplicated rule id (`loadRules` is silently last-wins on
  duplicates, which is how an id can quietly change meaning) and on a malformed id.
- Both are intended to run in CI on every push and pull request.

---

## 2026-10-03 — current ruleset

**Fingerprint: `368-6e180554`** · **368 canonical finding rules**

- **Migration (26 ids reclassified, not removed):** all 26 `github-tech-stack-*` rules in
  `skills/github-intelligence.skill.md` were RECLASSIFIED from `→ FINDING:` to
  `→ PROFILE:`. They describe detected stack/profile metadata (framework, hosting, CI,
  package manager…), not defects, so they must not be scored, prioritised or reported as
  findings. They no longer count as canonical finding ids and can no longer appear in an
  assessment's `findings[]`; the `→ PROFILE:` lines keep the metadata contract (id,
  severity, effort) visible in the same decision tree. Measured counts: 394 canonical
  finding rules immediately before the change (commit `1c0474e`), 368 after (394 − 26 =
  368); fingerprint `394-94676d4c` → `368-6e180554`.
- No rules added, none removed, no severity/effort changed by this entry.
- Tooling landed with this entry: `rulesetFingerprint()` and `findDuplicateIds()` in
  `scripts/lib/canonical-registry.mjs`, the `[deprecated -> <id>]` rule convention,
  `scripts/registry-diff.mjs` (this gate), the duplicate-id failure in
  `scripts/validate-skills.mjs`, and the deprecated-rule / `metadata.ruleset_version`
  warnings in `scripts/validate-assessment.mjs`.
- `metadata.ruleset_version` is now stamped by `scripts/dktv-orchestrate.mjs`, so every
  assessment records the fingerprint it was scored under.
