# Repository Review: `ai-job-agent`

Below are the concrete problems I found, grouped by severity. I've cited specific files/lines where possible.

---

## 🔴 High severity

### 1. `bin/smoke-test.sh` — `run()` swallows the real exit code
```bash
run() {
  ...
  if "$@" >/tmp/smoke-stdout 2>/tmp/smoke-stderr; then
    ...
  else
    local rc=$?
    echo -e "${RED}FAIL${NC} (exit $rc)"
```
`$?` is captured **after** the `echo`/`printf` calls inside the `if` branch have already run, so `rc` is almost always `0` (the exit status of the last `printf`). The reported exit code is meaningless. Capture it immediately:
```bash
if "$@" >... 2>...; then ...; else rc=$?; ...
```

### 2. `bin/smoke-test.sh` — `set -e` + `run` returning non-zero aborts the whole suite
The script uses `set -eu`. `run()` returns `$rc` on failure. Because `run` is invoked as a bare command (not in an `if`/`||` context), the first failing test will terminate the script under `set -e` — you'll never see the summary or the remaining tests. Either drop `set -e` or invoke as `run ... || true`.

### 3. `bin/smoke-test.sh` — "handles empty CSV" test is a no-op
```bash
run "handles empty CSV without crashing" \
  bash -c "
    : > '$SANDBOX/empty.csv'
    AI_JOB_AGENT_ROOT='$REPO' node -e \"import('$REPO/scripts/job-dashboard.mjs').catch(()=>{});\" </dev/null 2>&1 | head -1 | grep -q '.'
  "
```
This never actually points the dashboard at `empty.csv` (it uses `AI_JOB_AGENT_ROOT`, not `LOCAL_TRACKER`), and `grep -q '.'` just checks that *any* output exists. The test passes even if the dashboard crashes, because the `.catch(()=>{})` swallows the error and the shell pipeline still emits something. It does not test what its name claims.

### 4. `bin/smoke-test.sh` — "quoted commas" test doesn't test CSV parsing
The test writes a CSV and then reads it back with `fs.readFileSync(...).split('\n')` — plain line splitting, not the project's CSV parser. It asserts `lines.length === 2`, which is true for *any* well-formed two-line file. It would pass even if the real parser mishandled quoted commas. The test name is misleading.

### 5. `.github/workflows/test.yml` — idempotency check is broken
```yaml
- name: Verify install.sh idempotent re-run
  run: |
    HOME="${{ runner.temp }}/sandbox-home" mkdir -p "$HOME/.claude/skills"
    HOME="${{ runner.temp }}/sandbox-home" bash skills/install.sh >/dev/null
    HOME="${{ runner.temp }}/sandbox-home" bash skills/install.sh 2>&1 | grep -q "already linked"
```
`HOME=... mkdir -p "$HOME/..."` sets `HOME` only for the `mkdir` process; the `$HOME` in the argument is expanded by the *outer* shell (the runner's real `$HOME`), not the sandbox. So the sandbox dir is never created by that line, and the subsequent `install.sh` runs against a `HOME` whose `.claude/skills` may not exist. Also, `grep -q "already linked"` will fail the step if the message text ever changes — brittle coupling to a log string.

### 6. `bin/doctor.sh` — repo resolution order contradicts the docs
The header comment and `CHANGELOG.md` say resolution is:
`$AI_JOB_AGENT_ROOT` → `~/.claude/skills/ai-job-agent/` → `REPO_PATH` marker → `~/ai-job-agent/`.

But the code checks `[ -d "$HOME/.claude/skills/ai-job-agent" ] && [ -f .../package.json ]` **before** the `REPO_PATH` marker branch. If the canonical clone exists *and* a `REPO_PATH` marker points elsewhere (e.g. a dev checkout), the marker is silently ignored. The `elif` for `REPO_PATH` is therefore dead code whenever the canonical clone is present — which is the normal install case. This is a real behavioral bug, not just a doc mismatch.

### 7. `bin/doctor.sh` — `REPO_PATH` branch is unreachable
Same block: because the previous `elif` already matches `~/.claude/skills/ai-job-agent/package.json`, the `REPO_PATH` `elif` can only fire if the canonical clone exists but has no `package.json` — an unusual state. The comment "REPO_PATH marker" resolution path is effectively never exercised, yet `install.sh` writes that marker (per the smoke test). Either the marker is vestigial or the resolution order is wrong.

### 8. `bin/doctor.sh` — skill count mismatch (13 vs 14)
```bash
# Symlinks for all 13 bundled skills
SKILL_NAMES=(job-coach job-setup job-evaluate job-apply job-track job-triage \
             job-status job-outreach job-followup job-dashboard job-cv \
             job-interview job-patterns job-recap)
```
The array has **14** entries but the comment says 13. The success message says "all 14 skills registered". The comment is wrong; more importantly, this hard-coded list must be kept in sync with `skills/install.sh`'s `BUNDLED` array and the smoke test's loop — three separate copies of the same list. Any new skill will silently be missed by one of them.

### 9. `bin/doctor.sh` — `set -u` with unguarded `$REPO` in remediation hints
`REMEDIATIONS+=("$name: $hint")` is fine, but several hints interpolate `$REPO` and `$LINKEDIN_CONFIG` which are set — OK. However the script uses `set -u` (not `set -e`), and `RESOLVED_ROOT` may be empty when later code does `[ -d "$REPO/node_modules" ]` — `$REPO` is always set, so that's fine. The real issue: if `RESOLVED_ROOT` is empty, the script still proceeds to check `$REPO/node_modules` and `$REPO/config/...` using the *script's own* repo path, which may not be the user's active install. The doctor can report "OK" for a repo the user isn't actually using.

### 10. `bin/job-agent.sh` — AppleScript injection via `$REPO`
```bash
/usr/bin/osascript <<APPLESCRIPT
tell application "Terminal"
  do script "${CLAUDE_CMD}"
  ...
```
`CLAUDE_CMD` and `DASHBOARD_CMD` embed `$REPO` (the repo path) directly into an AppleScript string. If the repo path contains a `"` or backslash (legal on macOS), the heredoc breaks or injects AppleScript. Same for the iTerm branch. Should be escaped or passed via `osascript -e` with proper quoting.

### 11. `bin/job-agent.sh` — `eval "$INSTALL_CMD"` on a user-influenced string
```bash
if eval "$INSTALL_CMD"; then
```
`INSTALL_CMD` is built from detected package managers, so it's not directly user-controlled — but `eval` on a constructed string is still a code smell, and if `$OS` detection ever falls through to a branch that includes user input it becomes an injection vector. Prefer an array: `INSTALL_CMD=(sudo apt update && sudo apt install -y tmux)` and run `"${INSTALL_CMD[@]}"`.

### 12. `bin/job-agent.sh` — `read -r REPLY` under `set -e` with no TTY
The script runs `set -eu`. If invoked non-interactively (e.g. from CI, or piped), `read -r REPLY` returns non-zero on EOF and `set -e` aborts the script with no message. There's no `[ -t 0 ]` guard before prompting.

### 13. `bin/job-agent.sh` — `exec "$0" "$@"` after install loses the original argv semantics
After installing tmux, the script re-execs itself. If the user invoked it via `npm run agent`, `$0` is the shell script path and `$@` is empty — fine. But if invoked with arguments, they're forwarded; the script never documents or validates any arguments, so this is dead flexibility. Minor, but the `"$@"` is misleading.

### 14. `.github/workflows/test.yml` — ShellCheck is `continue-on-error: true` and also `|| true`
```yaml
- name: ShellCheck (warn-only, doesn't fail build)
  continue-on-error: true
  run: |
    ...
    shellcheck bin/*.sh skills/install.sh || true
```
Double-suppressed. ShellCheck findings will never surface in CI status, and the `|| true` means even the step's own exit code is always 0. The job is named "shellcheck + bash syntax" but shellcheck is effectively decorative. Also, `shellcheck` is only run on `bin/*.sh` and `skills/install.sh` — **not** on `setup.sh`, `wizard.sh`, or `scripts/*.sh` (if any), despite the syntax check covering them.

### 15. `.github/workflows/test.yml` — `npm install` without lockfile
`.gitignore` explicitly ignores `package-lock.json`:
```
package-lock.json
```
CI runs `npm install --no-audit --no-fund` with no lockfile, so every CI run resolves floating versions. Combined with `node-version: '20'` (not pinned to a patch), builds are non-reproducible. For a repo that ships a "smoke test" as its quality gate, this is a real supply-chain/reproducibility gap. Either commit the lockfile or use `npm ci` with one.

### 16. `.gitignore` ignores `package-lock.json` — but `package.json` is committed
This is the classic anti-pattern. For an application (not a library), the lockfile should be committed. The repo has a `package.json` with scripts (`smoke`, `doctor`, `mirror`, `agent`, `dashboard`) that CI depends on, so reproducibility matters.

---

## 🟠 Medium severity

### 17. `bin/doctor.sh` — Playwright check is fragile string-matching
```bash
if grep -qiE 'will be downloaded|to install|missing' "$TMP_DIR/pw.out"; then
  warn "Playwright Chromium browsers" "not yet downloaded ..."
```
This greps Playwright's human-readable `--dry-run` output for English phrases. Playwright changes this output between versions; the check will silently misreport. There's no version pin on Playwright in the visible `package.json` (not shown, but the doctor assumes `npx --no-install playwright` works). Better: check for the browser binary path directly, or run a tiny Playwright launch and catch the error.

### 18. `bin/doctor.sh` — `npx --no-install playwright install --dry-run chromium` may hit the network
`npx --no-install` prevents *installing* the package, but `playwright install --dry-run` still consults the registry/CDN in some versions. A "doctor" command that can hang on a slow network is a UX problem. Should be wrapped in a timeout.

### 19. `bin/doctor.sh` — `mktemp -d /tmp/ajagent-doctor.XXXXXX` is not portable
On macOS, `mktemp -d /tmp/foo.XXXXXX` works, but the template must end in `XXXXXX` (it does). However, using a hard-coded `/tmp` ignores `$TMPDIR` (which on macOS is a per-user dir). Prefer `mktemp -d "${TMPDIR:-/tmp}/ajagent-doctor.XXXXXX"`. Same issue in `bin/smoke-test.sh`.

### 20. `bin/smoke-test.sh` — writes to fixed `/tmp/smoke-stdout` and `/tmp/smoke-stderr`
```bash
if "$@" >/tmp/smoke-stdout 2>/tmp/smoke-stderr; then
```
Two concurrent runs (or two users on a shared box) clobber each other. Should use `$SANDBOX` or `mktemp`.

### 21. `bin/smoke-test.sh` — `run` uses `head -1` on stderr/stdout, hiding multi-line failures
```bash
echo -e "    ${DIM}stdout:${NC} $(head -1 /tmp/smoke-stdout ...)"
```
Only the first line of output is shown. For a failing test, the useful diagnostic is usually the *last* line (stack trace tail) or the full output. This makes CI failures hard to debug.

### 22. `bin/smoke-test.sh` — `run "install.sh --uninstall removes the symlinks"` then re-installs without checking
```bash
run "install.sh --uninstall removes the symlinks" \
  bash -c "
    HOME='$SANDBOX' bash '$REPO/skills/install.sh' --uninstall >/dev/null 2>&1
    [ ! -L '$SANDBOX/.claude/skills/job-coach' ]
  "
# Re-install for the rest of the tests
HOME="$SANDBOX" bash "$REPO/skills/install.sh" >/dev/null 2>&1
```
The re-install's exit code is not checked. If it fails, every subsequent skill test fails with a confusing error. Should be `run "re-install" ...` or at least `|| { echo "re-install failed"; exit 1; }`.

### 23. `bin/smoke-test.sh` — header-injection test only checks `Bcc`
```bash
! echo "$out" | grep -qE "^Bcc: evil"
```
The test only verifies the injected `Bcc` doesn't appear. It doesn't check that the *subject* was sanitized (the CRLF could still be present in the subject line, or the body could be corrupted). A stronger test would assert the subject equals the sanitized value and that no `\r` appears in the output.

### 24. `bin/smoke-test.sh` — `set -eu` + `run` returning non-zero (duplicate of #2, but worth flagging in the summary)
Already covered, but note the smoke test is the *only* automated gate for the scripts, so this bug means CI can pass while tests are actually failing.

### 25. `bin/doctor.sh` — `REMEDIATIONS` array is populated but never printed
The header comment says "Track FAIL remediation hints for the final tail." The array is appended to in `fail()`, but the visible portion of the script (truncated at 17,645 bytes) never iterates over it. If the tail is missing, all remediation hints are silently dropped. (The file is truncated in the review, so this may be present — but the comment/behavior should be verified.)

### 26. `bin/doctor.sh` — `node -e` invoked once per field (N+1 process spawns)
```bash
for f in "${REQUIRED[@]}"; do
  val=$(AJA_CFG="$LINKEDIN_CONFIG" AJA_FIELD="$f" node -e "...")
done
```
For 6 required + 10 optional fields, that's 16 Node process spawns just to read JSON. Slow on cold start (~50–100ms each). Should parse once and emit all fields, or use `jq` if available.

### 27. `bin/doctor.sh` — placeholder detection is heuristic and locale-dependent
```bash
if [ -z "$val" ] || [[ "$val" == YOUR_* ]] || [[ "$val" == /path/to/* ]]; then
```
This only catches placeholders starting with `YOUR_` or `/path/to/`. The template (`config/linkedin-config.template.json`) may use other placeholder conventions (e.g. `<your-name>`, `TODO`, `example@example.com`). A user who fills in `example@example.com` will pass the "required fields filled" check. The doctor should validate email/phone format, not just non-emptiness.

### 28. `bin/doctor.sh` — `[[ ... ]]` is bash-only, but the shebang is `#!/usr/bin/env bash`
Fine on macOS/Linux, but the script is invoked as `bash bin/doctor.sh` in docs and `npm run doctor` — consistent. However, `bin/smoke-test.sh` and `bin/job-agent.sh` also use `[[ ]]` and `echo -e`. `echo -e` is not POSIX and behaves differently under `sh`/`dash`; since the shebang is bash it's OK, but the CI "Bash syntax check" only runs `bash -n`, which won't catch `echo -e` portability issues. Minor.

### 29. `.github/workflows/test.yml` — `skill-files` job duplicates the smoke test
The smoke test already loops over all 14 skills checking frontmatter and the "Proactively invoke" phrase. The `skill-files` job does the same thing again. Redundant CI work; more importantly, the two loops can drift (one uses `skills/job-*/SKILL.md` glob, the other a hard-coded list). Consolidate.

### 30. `.github/workflows/test.yml` — `skill-files` glob `skills/job-*/SKILL.md` will match `skills/job-apply/SKILL.md` etc., but not `skills/README.md`
Fine, but note the glob silently skips any skill whose directory doesn't start with `job-`. If a future skill is named `resume-tailor/`, it won't be validated. The smoke test's hard-coded list has the opposite problem (misses new skills). Neither is robust.

### 31. `.github/workflows/test.yml` — no `permissions:` block
The workflow has no `permissions:` key, so it inherits the repo default (often `write-all` for older repos). For a workflow that only reads code and runs tests, it should declare `permissions: contents: read`. Standard hardening.

### 32. `.github/workflows/test.yml` — `actions/checkout@v4` and `actions/setup-node@v4` not pinned to SHA
Tags are mutable. For supply-chain hygiene, pin to commit SHAs (or at least use Dependabot). Not critical for a personal repo, but worth noting.

### 33. `.github/workflows/test.yml` — `sudo apt-get update && sudo apt-get install -y shellcheck` on every run
No caching; adds ~30–60s per CI run. Also, `shellcheck` is available pre-installed on `ubuntu-latest` runners in recent images — the install is likely unnecessary.

### 34. `CHANGELOG.md` — version dates are in the future
```markdown
## [1.2.0] — 2026-04-26
## [1.1.0] — 2026-04-25
## [1.0.0] — 2026-04-22
```
These are dated 2026. Either the system clock is wrong, or these are placeholders. A changelog with future dates is confusing and will break any tooling that parses dates. (If the repo genuinely targets 2026, ignore — but flag it.)

### 35. `CHANGELOG.md` — "BUNDLED array extended from 9 → 13 skills" but doctor says 14
```markdown
- `BUNDLED` array in `skills/install.sh` extended from 9 → 13 skills (adds `job-coach` was already present, plus `job-evaluate`, `job-cv`, `job-interview`, `job-patterns`).
```
9 + 4 = 13, but the doctor and smoke test both say 14. Either the changelog is wrong, or one of the counts is. The parenthetical "adds `job-coach` was already present" is also grammatically broken and ambiguous. This inconsistency will confuse users debugging install issues.

### 36. `CHANGELOG.md` — "Fixed" section claims a fix that isn't verifiable
```markdown
- `/job-coach` no longer hijacks specific verb requests — pasting a URL still routes directly to `/job-apply` (or `/job-evaluate` if "evaluate" / "score" / "deep-dive" appears in the same message).
```
This is a prompt-engineering behavior, not a code fix. There's no test for it (the smoke test only checks frontmatter strings). Claiming it under "Fixed" without a regression test is misleading.

### 37. `CLAUDE.md` — skill table omits `/job-recap`
The table lists 13 skills (coach, setup, apply, track, triage, status, outreach, followup, dashboard, evaluate, cv, interview, patterns) but the repo has 14 (`job-recap` is missing from the table). The intro paragraph also lists 13 skills and omits `/job-recap`. Users won't know it exists.

### 38. `CLAUDE.md` — "Two ways to drive it" lists 13 skills in the intro
```markdown
type `/job-coach`, `/job-apply`, `/job-evaluate`, `/job-cv`, `/job-track`, `/job-triage`, `/job-status`, `/job-outreach`, `/job-followup`, `/job-dashboard`, `/job-interview`, `/job-patterns`, or `/job-setup`
```
Count: 13. Missing `/job-recap`. Same issue as #37.

### 39. `CLAUDE.md` — table row for `/job-interview` is truncated mid-sentence
```markdown
| `/job-interview <company>` | `application-tracker.csv` + WebSea
```
The file is truncated in the review, but if this is the actual content, the table is broken. (Likely just truncation in the prompt — flagging in case.)

### 40. `.gitignore` — ignores `config/candidate-profile.md` but not `config/candidate-profile.template.md`
Good — the template is tracked, the real file is ignored. But the `.gitignore` also ignores `config/answer-bank.md` and `config/linkedin-config.json`, while `config/example-config.json` and `config/linkedin-config.template.json` are tracked. Consistent. However, `config/search-plan.md` is ignored but `templates/search-plan.template.md` is tracked — also consistent. No issue here, just noting the pattern is correct.

### 41. `.gitignore` — `*.json.bak` is too narrow
Backups of config files could be `*.json~`, `*.json.orig`, `*.json.save`, etc. The single pattern won't catch them. Also, `config/linkedin-config.json` is ignored, but a user might create `config/linkedin-config.json.bak` — caught. `config/linkedin-config.backup.json` — not caught. Minor.

### 42. `.gitignore` — `data/applications.md` and `data/outreach.md` ignored, but `data/` directory itself isn't
If `data/` is empty after clone, git won't track it, and `mirror-tracker.mjs` may fail to write. The script should `mkdir -p data/` before writing. (Can't verify without the script, but the `.gitignore` pattern suggests the dir is generated.)

### 43. `.gitignore` — `reports/`, `output/`, `interview-prep/` ignored but no `.gitkeep`
Same issue: these directories won't exist on a fresh clone. Scripts that write to them must create them. If they don't, first-run failures. Worth verifying in `generate-tailored-cv.mjs` and the `/job-evaluate` skill.

### 44. `.gitignore` — `.claude/` ignored, but `skills/install.sh` writes to `~/.claude/skills/`
The `.claude/` ignore is for the *repo-local* `.claude/` dir (Claude Code project config). The install writes to `$HOME/.claude/skills/`, which is outside the repo. No conflict, but the comment "Claude Code local config (skills, settings, etc.)" is misleading — it suggests skills are ignored, when actually the repo's `skills/` dir is tracked. Clarify the comment.

### 45. `.gitignore` — `package-lock.json` ignored (see #16)
Already covered.

### 46. `.gitignore` — `chrome-data/` ignored, but no mention of Playwright's browser cache
Playwright installs browsers to `~/.cache/ms-playwright` (Linux) or `~/Library/Caches/ms-playwright` (macOS), outside the repo. Fine. But if any script sets `PLAYWRIGHT_BROWSERS_PATH=./chrome-data`, the ignore is correct. Otherwise the `chrome-data/` entry is for the CDP-based Outlook scripts. The comment "Chrome profiles" is vague.

---

## 🟡 Low severity / nits

### 47. `bin/doctor.sh` — `printf "  %-58s"` with long skill names overflows
`job-dashboard` etc. fit, but if a skill name exceeds 58 chars the column alignment breaks. Cosmetic.

### 48. `bin/doctor.sh` — color codes emitted even when not a TTY
No `[ -t 1 ]` check before emitting ANSI escapes. Piping `npm run doctor` to a file produces escape sequences. Same in `bin/smoke-test.sh` and `bin/job-agent.sh`. Should respect `NO_COLOR` and/or `[ -t 1 ]`.

### 49. `bin/doctor.sh` — `NODE_MAJOR=${NODE_V%%.*}` fails on pre-release versions
`node --version` can return `v20.0.0-pre` or `v21.0.0-nightly20240101`. `${NODE_V%%.*}` gives `20` or `21` — OK. But `v20` (no dots) gives `20` — OK. Edge case: `v8.9.4` gives `8`, and `[ "$NODE_MAJOR" -ge 18 ]` correctly fails. Fine.

### 50. `bin/doctor.sh` — `2>/dev/null` on `[ "$NODE_MAJOR" -ge 18 ]` hides real errors
```bash
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
```
If `NODE_MAJOR` is non-numeric (e.g. `v` with no version), `[ ... -ge 18 ]` errors and the `2>/dev/null` hides it, falling through to the `else` branch. That's the intended behavior, but the error suppression is a code smell — better to validate `NODE_MAJOR` is numeric first.

### 51. `bin/smoke-test.sh` — `run` uses `local rc=$?` after `echo`
Already covered in #1.

### 52. `bin/smoke-test.sh` — `skip` function doesn't actually skip anything
```bash
skip() {
  local name="$1"
  local reason="$2"
  printf "  %-55s" "$name"
  echo -e "${YELLOW}SKIP${NC} ${DIM}($reason)${NC}"
  SKIPPED=$((SKIPPED + 1))
}
```
It just prints. That's fine for a report, but the name implies it gates execution. The callers are hard-coded `skip "..." "..."` lines, so it's really a "note" function. Rename to `note` or `skipped` for clarity.

### 53. `bin/smoke-test.sh` — `run "snapshot is non-TTY safe (returns to TTY check)"` name is confusing
The test asserts the snapshot output contains "AI Job Agent Dashboard", but the name says "returns to TTY check". Mismatch between name and assertion.

### 54. `bin/smoke-test.sh` — `run "interactive mode falls back gracefully when not a TTY"` uses `|| true`
```bash
out=\$(node '$REPO/scripts/job-dashboard.mjs' </dev/null 2>&1 || true)
echo \"\$out\" | grep -q 'Not a TTY'
```
The `|| true` means the test passes if the script exits non-zero *and* prints "Not a TTY", or if it exits zero and prints it. But it also passes if the script crashes with a stack trace containing "Not a TTY" anywhere. Weak assertion.

### 55. `bin/job-agent.sh` — `tmux set-option -t "$SESSION" status off` is per-session, not per-window
Fine, but the `|| true` swallows errors. If tmux version doesn't support `status off` (it does), silent failure. Minor.

### 56. `bin/job-agent.sh` — `tmux split-window -v -p 40 -t "${SESSION}:main"` may fail if the session was just created
There's a race: `tmux new-session -d` returns before the session is fully ready in some tmux versions. Usually fine, but a `sleep 0.1` or `tmux wait-for` would be more robust. Low priority.

### 57. `bin/job-agent.sh` — `exec "$0" "$@"` after install re-runs the whole script including the tmux check
If tmux install succeeded, the re-exec will find tmux and proceed. Fine. But if the user's `$0` is a relative path and cwd changed, `exec "$0"` fails. Use `exec "$(command -v "$0" || echo "$0")"` or an absolute path. Edge case.

### 58. `bin/job-agent.sh` — iTerm AppleScript assumes iTerm is running
`tell application "iTerm"` will launch iTerm if not running, which may be surprising. Should check `application "iTerm" is running` first, or use `tell application "iTerm" to activate` explicitly. Minor UX.

### 59. `bin/job-agent.sh` — Terminal.app fallback opens two *windows*, not tabs
```applescript
tell application "Terminal"
  activate
  do script "${CLAUDE_CMD}"
  do script "${DASHBOARD_CMD}"
end tell
```
`do script` without a `in` target opens a new window each time. The echo says "Opened two Terminal tabs" — wrong. Either use `do script ... in front window` for the second, or fix the message.

### 60. `bin/job-agent.sh` — no check for `claude` version
The script checks `command -v claude` but not that it's a compatible version. If the user has an old Claude Code, the skills may not work. Low priority.

### 61. `.github/workflows/test.yml` — `npm install` runs before `npm run smoke`, but smoke test doesn't need deps
The smoke test exercises `install.sh`, `send-cold-email.js --dry-run`, `job-dashboard.mjs --snapshot`, etc. If those scripts have zero runtime deps (the dashboard is described as "zero deps"), the `npm install` step is wasted time. If they do have deps, fine. Worth checking `package.json`.

### 62. `.github/workflows/test.yml` — no `timeout-minutes` on jobs
A hung test (e.g. Playwright waiting on network) will run for the default 6 hours. Add `timeout-minutes: 10` to each job.

### 63. `.github/workflows/test.yml` — `branches: [main]` on both `push` and `pull_request`
Fine, but if the default branch is `master`, CI never runs. Verify the default branch name.

### 64. `.github/workflows/test.yml` — no concurrency group
Multiple pushes to a PR trigger multiple runs. Add:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 65. `CHANGELOG.md` — no `[Unreleased]` section
Keep a Changelog convention recommends an `[Unreleased]` section at the top. Missing.

### 66. `CHANGELOG.md` — no comparison links at the bottom
Keep a Changelog convention: `[1.2.0]: https://github.com/.../compare/v1.1.0...v1.2.0`. Missing, so version headers aren't clickable.

### 67. `CHANGELOG.md` — "Security" section only in 1.1.0
1.2.0 has no Security section, but it adds `/job-evaluate` which fetches arbitrary URLs (SSRF surface) and `/job-cv` which renders HTML to PDF (potential injection if JD content is interpolated into HTML). These should be documented, even if just "no known issues".

### 68. `CLAUDE.md` — no mention of `/job-recap` (see #37)
Also, the "Bundled Skills" table has 13 rows but the repo has 14 skills. The table should be generated from `skills/` to avoid drift.

### 69. `CLAUDE.md` — "Two ways to drive it" doesn't mention `npm run agent`
The unified tmux mode is a major feature (per CHANGELOG 1.1.0) but isn't listed as a third way to drive the toolkit. Users reading CLAUDE.md won't discover it.

### 70. `CLAUDE.md` — no troubleshooting section
Given the number of moving parts (tmux, Playwright, msmtp, gcloud, Chrome CDP), a "if X fails, try Y" section would help. `bin/doctor.sh` exists but isn't referenced from CLAUDE.md.

### 71. `CLAUDE.md` — no mention of `bin/doctor.sh` or `npm run doctor`
The doctor is the primary debugging tool but isn't surfaced in the main instructions file.

### 72. `CLAUDE.md` — no mention of `npm run smoke` or CI
Contributors won't know how to run the test suite.

### 73. `CLAUDE.md` — no mention of `npm run mirror` / `mirror:watch`
The markdown tracker mirror is a 1.2.0 feature but isn't documented in CLAUDE.md.

### 74. `CLAUDE.md` — no mention of `reports/`, `output/`, `interview-prep/`, `data/` directories
Users won't know where outputs land.

### 75. `CLAUDE.md` — no mention of the 7-block A-G rubric
The rubric is central to `/job-coach` and `/job-evaluate` but isn't explained in CLAUDE.md.

### 76. `CLAUDE.md` — no mention of exit codes
The ATS fillers use exit codes 0/2/3/4 (per CHANGELOG 1.0.0), but CLAUDE.md doesn't document them. Users scripting against the fillers need this.

### 77. `CLAUDE.md` — no mention of `--dry-run` vs `--submit`
`/job-apply` is "dry-run by default; pass `--submit` to actually submit" (per CHANGELOG), but CLAUDE.md's table doesn't show this. Safety-critical.

### 78. `CLAUDE.md` — no mention of `--uninstall`
`skills/install.sh --uninstall` exists but isn't documented.

### 79. `CLAUDE.md` — no mention of `$AI_JOB_AGENT_ROOT`
The env var is the first resolution path but isn't documented in CLAUDE.md.

### 80. `CLAUDE.md` — no mention of the `REPO_PATH` marker
Same.

---

## Summary of the most impactful issues

| # | Issue | File |
|---|-------|------|
| 1 | `run()` captures `$?` after `echo`, so exit codes are wrong | `bin/smoke-test.sh` |
| 2 | `set -e` + `run` returning non-zero aborts the suite on first failure | `bin/smoke-test.sh` |
| 3 | "empty CSV" test doesn't test the CSV parser | `bin/smoke-test.sh` |
| 4 | "quoted commas" test doesn't test the CSV parser | `bin/smoke-test.sh` |
| 5 | CI idempotency check uses `HOME=... mkdir` incorrectly | `.github/workflows/test.yml` |
| 6 | `REPO_PATH` resolution is dead code when canonical clone exists | `bin/doctor.sh` |
| 7 | Skill count 13 vs 14 inconsistency | `bin/doctor.sh`, `CHANGELOG.md` |
| 8 | AppleScript injection via `$REPO` | `bin/job-agent.sh` |
| 9 | `eval "$INSTALL_CMD"` | `bin/job-agent.sh` |
| 10 | `read -r` under `set -e` with no TTY guard | `bin/job-agent.sh` |
| 11 | ShellCheck double-suppressed, never fails CI | `.github/workflows/test.yml` |
| 12 | `package-lock.json` gitignored → non-reproducible CI | `.gitignore`, CI |
| 13 | `/job-recap` missing from CLAUDE.md and CHANGELOG counts | `CLAUDE.md`, `CHANGELOG.md` |
| 14 | Future-dated changelog entries | `CHANGELOG.md` |
| 15 | No `permissions:` / `timeout-minutes` / `concurrency` in CI | `.github/workflows/test.yml` |

The single most serious functional bug is **#1/#2 in `bin/smoke-test.sh`** — the test harness can report success while tests are failing, and can abort before running the full suite. Since this is the repo's primary quality gate (per CI), it undermines the entire "smoke test" claim.
