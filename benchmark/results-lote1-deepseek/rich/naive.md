# Repository Review: `rich`

Below are the problems I found, grouped by severity. I've focused on things that are actually actionable rather than stylistic nitpicks.

## High severity

### 1. CI workflow is broken: `$VENV` is never set
`.github/workflows/pythonpackage.yml` runs:
```yaml
- name: Format check with black
  run: |
    source $VENV
    make format-check
```
`$VENV` is never exported anywhere in the workflow. `snok/install-poetry` with `virtualenvs-in-project: true` creates `.venv`, but it does not set `$VENV`. `source $VENV` will fail (or silently source nothing), and then `make format-check` / `make typecheck` will run against whatever Python is on `PATH` — not the Poetry environment. This means the format/typecheck steps are effectively not validating the installed environment, and may be failing or passing spuriously.

### 2. CI matrix excludes Python 3.13 on Windows for no documented reason
```yaml
exclude:
  - { os: windows-latest, python-version: "3.13" }
```
There's no comment explaining why. Combined with `allow-prereleases: true` and testing `3.14`, this looks like a stale workaround. Either document it or remove it.

### 3. `readmechanged.yml` uses a hardcoded discussion ID and a personal token
```yaml
GITHUB_TOKEN: ${{ secrets.GHP_README_WORKFLOW }}
DISCUSSIONID='MDEwOkRpc2N1c3Npb24zMzI2NzM0'
```
- The discussion ID is hardcoded to a specific discussion in the `willmcgugan/rich` repo, but the project has moved to `Textualize/rich`. The commit URL in the body also points at `github.com/willmcgugan/rich/commit/...`, which is the old location.
- Relying on a personal access token secret (`GHP_README_WORKFLOW`) for a repo-owned workflow is fragile and a security/ownership concern.

### 4. `newissue.yml` pipes untrusted issue titles into a shell command
```yaml
env:
  TITLE: ${{ github.event.issue.title }}
run: faqtory suggest "$TITLE" > suggest.md
```
The title is passed via env (good), but it's still interpolated into a shell command. If `faqtory` or the shell mishandles it, this is a command-injection surface. More importantly, the workflow runs on `issues: [opened]` with `permissions: issues: write` and checks out `master` — a compromised `faqtory` release would have write access to issues. Consider pinning `faqtory` to a version and dropping unnecessary permissions.

### 5. `comment.yml` and `newissue.yml` both use `name: issues`
Two different workflows share the same `name:`. This makes them indistinguishable in the Actions UI and in status checks. Rename them (e.g. `issue-closed-comment`, `issue-opened-suggest`).

## Medium severity

### 6. `codespell` workflow has a malformed multi-line `run`
```yaml
- run: codespell --ignore-words-list="ba,fo,hel,revered,womens"
    --skip="./README.*.md,*.svg,*.ai,./benchmarks/snippets.py,./tests,./tools,*.lock"
```
The continuation line is indented but there's no `>` or `|` block scalar, and no backslash. YAML will treat this as a single scalar with a folded newline, which *may* work, but it's fragile and inconsistent with the rest of the repo. Use a block scalar.

### 7. `codespell` skips `./tests` and `./tools`
Skipping the entire test suite from spell-checking means typos in test names, docstrings, and fixture data go unchecked. At minimum, skip only generated files.

### 8. `asv.conf.json` pins `setuptools: ["59.2.0"]` and Python 3.10 only
The benchmark matrix is pinned to a single old setuptools and a single Python version, while the package supports 3.9–3.14. Benchmarks will not reflect performance on modern interpreters, and the `setuptools` pin is a workaround for a build issue that likely no longer applies.

### 9. `asv.conf.json` `build_command` installs Poetry but then uses `setup.py build`
```json
"build_command": [
  "pip install poetry",
  "python setup.py build",
  ...
]
```
Installing Poetry is pointless here since the build uses `setup.py`. Either use Poetry consistently or drop the install step.

### 10. `benchmarks/benchmarks.py` has a misnamed benchmark
```python
def test_divide_complex(self):
    list(Segment.divide(self.line, [5, 10, 20, 50, 108, 110, 118]))
```
ASV only picks up methods named `time_*` (and `track_*`, `mem_*`). A `test_*` method in a benchmark class is silently ignored. This benchmark never runs. Rename to `time_divide_complex`.

### 11. `benchmarks/benchmarks.py` `time_divide_unicode_heavy` uses the wrong text
```python
def time_divide_unicode_heavy(self):
    self.text.divide(range(20, 100, 4))
```
`self.text` is `Text.from_markup(snippets.MARKUP)`, not the unicode-heavy text. Compare with `time_divide` which uses `Text(snippets.LOREM_IPSUM)`. The "unicode_heavy" variant is not actually exercising unicode-heavy input.

### 12. `benchmarks/benchmarks.py` `time_align_center_unicode_heavy` uses the wrong width
```python
Text(snippets.UNICODE_HEAVY_TEXT).align(
    "center", width=self.len_lorem_ipsum * 3
)
```
`self.len_lorem_ipsum` is the length of the *lorem ipsum* snippet, not the unicode-heavy snippet. The width is arbitrary relative to the text being aligned.

### 13. `benchmarks/benchmarks.py` `TextHotCacheSuite` doesn't measure what it claims
```python
def time_wrapping_unicode_heavy_warm_cache(self):
    for _ in range(20):
        Text(snippets.UNICODE_HEAVY_TEXT).wrap(self.console, 12, overflow="fold")
```
This constructs a *new* `Text` each iteration, so any per-instance cache is cold. If the intent is to measure a warm cache, the `Text` object should be created once in `setup` and reused.

### 14. `.coveragerc` omits `rich/jupyter.py` from coverage
Jupyter support is a documented feature (`docs/source/reference/jupyter.rst`, `tests/test_jupyter.py`). Omitting it from coverage hides regressions. If it's omitted because it can't run in CI, that should be documented and the tests should be skipped explicitly rather than the module excluded from coverage.

### 15. `pyproject.toml` / `setup.py` duplication
Both `pyproject.toml` and `setup.py` exist. The `asv.conf.json` build command uses `setup.py build`, while CI uses Poetry. This dual-build setup is a maintenance hazard — metadata can drift between the two. Pick one.

### 16. `assets/logo.ai` is a 1.2 MB PDF masquerading as an `.ai` file
The file content starts with `%PDF-1.6`. It's committed to the repo and is over a megabyte. This bloats clones and is not useful to consumers of the library. Consider moving it out of the repo or to Git LFS.

### 17. `benchmarks/results/darrenburns-2022-mbp/` contains ~200 committed JSON result files
These are machine-specific benchmark results from a single contributor's laptop, committed to the main repo. They will never be updated and add noise. The `benchmarks/README.md` describes publishing results to a separate `rich-benchmarks` repo — these should live there, not here.

## Low severity

### 18. `.pre-commit-config.yaml` excludes `benchmarks/` entirely
```yaml
exclude: benchmarks/
```
This means black, isort, pycln, and the pre-commit-hooks (trailing whitespace, end-of-file-fixer, etc.) don't run on benchmark code. Given the bugs found above in `benchmarks/benchmarks.py`, this is likely why they went unnoticed.

### 19. `.pre-commit-config.yaml` pins `isort` to `language_version: "3.11"`
This is inconsistent with the CI matrix (3.9–3.14) and with the `black` hook which has no such pin. It also means contributors on other Python versions get different behavior.

### 20. `.pre-commit-config.yaml` uses `black-pre-commit-mirror` at `23.11.0`
The PR template says "run the latest black with default args", but the pre-commit config pins an old version. Contributors following the template and contributors using pre-commit will produce different formatting.

### 21. `AI_POLICY.md` and PR template disagree on AI PR requirements
`AI_POLICY.md` says AI PRs must "identify itself as AI generated, including the name of the agent used." The PR template only has a checkbox `AI was used to generate this PR` with no field for the agent name. Align these.

### 22. `AI_POLICY.md` says "The Pull Request must link to a issue" — grammar
Should be "an issue". Minor, but it's a policy document.

### 23. `bug_report.md` template has a typo
> "Edit this with a clear and concise description of what the bug."

Missing "is" — should be "what the bug is."

### 24. `bug_report.md` suggests `pip freeze | grep rich`
This is unreliable: `pip freeze` output for an editable install may not contain "rich", and on Windows `grep` isn't available by default. Suggest `pip show rich` or `python -c "import rich; print(rich.__version__)"`.

### 25. `readmechanged.yml` triggers on `push` to `master` only
It won't catch README changes merged via other branches or via the GitHub web editor if the default branch is ever renamed. Also, the notification body hardcodes `@willmcgugan @oleksis @Adilius` — these will go stale.

### 26. `asvhashfile` lists tags out of order
```
v10.0.0
v10.2.2
...
v12.5.0
v8.0.0
v9.13.0
v9.5.1
```
Not a bug, but sorting would make it easier to audit which tags are covered. Also, the file is missing many tags between v12.5.0 and the current version.

### 27. `benchmarks/README.md` references `main` branch of `rich-benchmarks`
> "When the HTML is merged into `main`, the benchmark dashboard will be updated"

But the rest of the repo uses `master`. Verify which branch the `rich-benchmarks` repo actually uses.

### 28. `.github/workflows/comment.yml` uses a pinned SHA for `peter-evans/create-or-update-comment`
```yaml
uses: peter-evans/create-or-update-comment@a35cf36e5301d70b76f316e867e7788a55a31dae
```
Pinning to a SHA is good practice, but the same action is used in `newissue.yml` with the same SHA — fine. However, `juliangruber/read-file-action@v1` is pinned to a mutable tag, not a SHA. Inconsistent supply-chain hygiene.

### 29. `docs/requirements.txt` is not shown but is referenced by `.readthedocs.yml`
Can't verify contents, but worth checking that it pins versions — unpinned docs requirements cause non-reproducible doc builds.

### 30. `rich/_unicode_data/` contains 20+ generated files
These are presumably generated by `tools/make_width_tables.py`. There's no CI check that they're up to date with the generator, so they can silently drift. Consider a CI step that regenerates and diffs.

### 31. `tests/pytest.ini` exists alongside `pyproject.toml`
If pytest config is split between `pytest.ini` and `pyproject.toml`, the `pytest.ini` takes precedence and any `[tool.pytest.ini_options]` in `pyproject.toml` is ignored. Consolidate.

### 32. `setup.py` still exists in a Poetry-managed project
Poetry projects typically don't need `setup.py`. Its presence (and use in `asv.conf.json`) suggests the migration to Poetry was incomplete.

### 33. `benchmarks/snippets.py` is excluded from codespell but not from pre-commit
Inconsistent exclusion lists between `.pre-commit-config.yaml` (`exclude: benchmarks/`) and `codespell.yml` (`--skip=...benchmarks/snippets.py...`). Pick one policy.

### 34. `README.md` is translated into ~20 languages but there's no CI check that translations stay in sync
The `readmechanged.yml` workflow notifies three people when `README.md` changes, but there's no mechanism to flag stale translations. This is a process gap rather than a bug, but it means translations will drift.

### 35. `.github/workflows/pythonpackage.yml` only runs on `pull_request`
```yaml
on: [pull_request]
```
There's no `push` trigger for `master`. This means a direct push to `master` (or a merge that bypasses PR checks) is never tested. Add `push: branches: [master]`.

### 36. `tox.ini` exists but CI uses Poetry directly
If `tox.ini` is stale, it's misleading. If it's used locally, it should be documented. Either way, having both `tox.ini` and Poetry-based CI is redundant.

## Summary of the most impactful fixes

1. Fix `$VENV` in `pythonpackage.yml` — CI is likely not testing what it claims.
2. Fix the `test_divide_complex` → `time_divide_complex` rename so the benchmark actually runs.
3. Fix the two `unicode_heavy` benchmarks that use the wrong text/width.
4. Remove or relocate the committed benchmark result JSONs and the 1.2 MB `logo.ai`.
5. Update `readmechanged.yml` to point at `Textualize/rich` and remove the hardcoded discussion ID.
6. Reconcile `AI_POLICY.md` with the PR template.
7. Stop excluding `benchmarks/` from pre-commit, or at least run black/isort on it.
