# Repository Review: `httpx`

Below are the concrete problems I found, grouped by severity. I've limited myself to issues that are verifiable from the file tree and the file contents provided.

---

## 1. Broken / missing references in CI and scripts

### 1.1 `scripts/build` is referenced but does not exist
`.github/workflows/publish.yml` and `.github/workflows/test-suite.yml` both invoke:

```yaml
- name: "Build package & docs"
  run: "scripts/build"
```

But the file tree only contains:

```
scripts/check
scripts/clean
scripts/coverage
scripts/docs
scripts/install
scripts/lint
scripts/publish
scripts/sync-version
scripts/test
```

There is **no `scripts/build`**. Both the `Publish` and `Test Suite` workflows will fail at that step. Either the script was deleted and the workflows weren't updated, or the workflows were written against a script that was never committed.

### 1.2 `scripts/publish` is referenced but does not exist
Same problem in `publish.yml`:

```yaml
- name: "Publish to PyPI & deploy docs"
  run: "scripts/publish"
```

`scripts/publish` is listed in the file tree, so this one is fine — but note that it depends on `scripts/build` having produced artifacts, which it can't, per 1.1.

### 1.3 `scripts/coverage` is invoked but the coverage threshold is not enforced in the workflow
`test-suite.yml` runs `scripts/coverage` as a separate step. The contributing guide claims:

> `FAIL Required test coverage of 100% not reached. Total coverage: 99.00%`

If `scripts/coverage` is what enforces this, fine — but the workflow runs `scripts/test` *and then* `scripts/coverage`, which likely re-runs the test suite. That's wasteful and can produce inconsistent results if the two scripts use different pytest invocations.

---

## 2. Documentation inconsistencies

### 2.1 `docs/advanced/clients.md` links to a non-existent anchor
The page says:

> If you need finer-grained control on the merging of client-level and request-level parameters, see [Request instances](#request-instances).

The anchor `#request-instances` does exist on the page, so this is fine. However, later it says:

> To dispatch a `Request` instance across to the network, create a [`Client` instance](#client-instances) and use `.send()`:

There is **no `#client-instances` heading** on the page. The headings are `## Why use a Client?`, `## Usage`, `## Making requests`, etc. The link `#client-instances` is broken.

### 2.2 `docs/advanced/clients.md` references `#merging-of-parameters`
The text says:

> If you need to mix client-level and request-level options in a way that is not supported by the default [Merging of parameters](#merging-of-parameters)…

The actual heading is `## Merging of configuration`, so the anchor should be `#merging-of-configuration`. The link is broken.

### 2.3 `docs/advanced/authentication.md` uses `os.environ` without importing `os`
The example:

```pycon
>>> auth = httpx.NetRCAuth(file=os.environ.get("NETRC"))
```

is shown in a `pycon` block with no preceding `import os`. As a copy-pasteable example this will raise `NameError`. Minor, but it's a documentation bug.

### 2.4 `docs/advanced/authentication.md` claims digest auth "provides encryption"
> HTTP digest authentication is a challenge-response authentication scheme. Unlike basic authentication it provides encryption…

This is **incorrect**. Digest auth does not encrypt the request body or the response; it only avoids sending the password in cleartext. The claim that it "provides encryption" is misleading and should be corrected.

### 2.5 `docs/advanced/clients.md` progress-bar examples are subtly wrong
In the `tqdm` example:

```python
num_bytes_downloaded = response.num_bytes_downloaded
for chunk in response.iter_bytes():
    download_file.write(chunk)
    progress.update(response.num_bytes_downloaded - num_bytes_downloaded)
    num_bytes_downloaded = response.num_bytes_downloaded
```

`response.num_bytes_downloaded` is documented as the number of bytes downloaded *so far*, so this works, but the initial read happens before the loop and the update uses a delta. This is fine but fragile. More importantly, the `rich` example uses `progress.update(download_task, completed=response.num_bytes_downloaded)` — also fine. Not a bug, but the two examples are inconsistent in style for no reason.

### 2.6 `docs/advanced/clients.md` upload-progress example is truncated mid-code-block
The file content ends with:

```python
    with io.BytesIO(random.randbytes(total)) as 
```

This is a truncated code block in the provided content. If this is how the file actually ends, the docs build will fail or render a broken example. (It may just be truncation in the review context, but worth flagging.)

---

## 3. CHANGELOG problems

### 3.1 `[UNRELEASED]` section is missing a version/date header
The top of `CHANGELOG.md` is:

```markdown
## [UNRELEASED]

### Removed

* Drop support for Python 3.8
```

Keep-a-Changelog convention is `## [Unreleased]` (lowercase `u`). More importantly, the "Removed" entry ("Drop support for Python 3.8") is a **breaking change** that should be under a `### Changed` or at least accompanied by a note, and it should be listed under the version where it actually lands. As written, it's ambiguous whether 3.8 support was dropped in 0.28.1 or is pending.

### 3.2 `0.28.1` entry has no `### Fixed` heading
```markdown
## 0.28.1 (6th December, 2024)

* Fix SSL case where `verify=False` together with client side certificates.
```
Every other release uses `### Added` / `### Fixed` / `### Changed` subheadings. This one doesn't, which breaks the changelog's structural consistency and makes tooling that parses sections unreliable.

### 3.3 `0.28.0` entry mixes prose and bullet lists inconsistently
The 0.28.0 entry starts with prose paragraphs, then a `**Deprecations**:` block, then `**The following changes are also included**:` followed by bullets. This is readable but inconsistent with the rest of the file, which uses `### Added` / `### Changed` / `### Removed` headings. It also omits the `### Added` heading for the new `FunctionAuth` export mentioned in `[UNRELEASED]`.

### 3.4 Typo: "prefered" → "preferred"
In the 0.28.0 entry:
> This is generally considered a prefered style

### 3.5 Typo: "shouldn've" → "shouldn't have"
In the 0.23.3 entry:
> This shouldn've have been included in a minor version bump

### 3.6 Typo: "dependancy" → "dependency"
In the 0.24.0 entry:
> The `rfc3986` dependancy has been removed.

### 3.7 `0.23.1` note contradicts itself
> **Note**: The 0.23.1 release should have used a proper version bump, rather than a minor point release. There are API surface area changes that may affect some users.

This is honest, but it means the changelog is documenting a known-bad release without a remediation note. Users reading the changelog have no guidance on what to do.

---

## 4. Workflow / CI configuration issues

### 4.1 `publish.yml` triggers on **any** tag push
```yaml
on:
  push:
    tags:
      - '*'
```
This means pushing a tag like `docs-test` or `v0.0.0-experiment` will trigger a PyPI publish attempt. It should be restricted to version tags, e.g. `- 'v*'` or `- '[0-9]+.*'`. Combined with the missing `scripts/build`, this workflow is doubly broken.

### 4.2 `publish.yml` uses Python 3.9 while `test-suite.yml` tests 3.9–3.13
The publish job pins `python-version: 3.9`. If the package is built with 3.9, the wheel metadata may not reflect the full supported range. More importantly, `CHANGELOG.md` says Python 3.8 support is being dropped, so 3.9 is the new floor — but the publish job should ideally use the same version as the lowest tested version, or a dedicated build environment. Not a hard bug, but a consistency issue.

### 4.3 `test-suite.yml` runs `scripts/check` on every matrix entry
```yaml
- name: "Run linting checks"
  run: "scripts/check"
```
Linting is run 5 times (once per Python version) even though it's version-independent. This wastes CI minutes. It should be a separate job.

### 4.4 `test-suite.yml` runs `scripts/build` on every matrix entry
Same issue: building the package and docs 5 times is redundant. Should be a separate job.

### 4.5 `test-suite.yml` does not test on Windows or macOS
The matrix is `runs-on: "ubuntu-latest"` only. For a networking library with platform-specific behavior (SSL, sockets, file handling), this is a significant gap. The contributing guide even mentions OS platform as a bug-report field, implying cross-platform relevance.

### 4.6 `dependabot.yml` has a trailing space in `schedule:`
```yaml
    schedule: 
      interval: monthly
```
Trailing whitespace after `schedule:`. Harmless but sloppy; some YAML linters flag it.

### 4.7 `dependabot.yml` groups all pip packages into one PR
```yaml
    groups:
      python-packages:
        patterns:
          - "*"
```
This means a single Dependabot PR can bump `httpcore`, `certifi`, `idna`, `sniffio`, `anyio`, and dev dependencies all at once. If one bump breaks tests, the whole PR is blocked and it's hard to bisect. Consider splitting runtime vs. dev dependencies.

---

## 5. Repository hygiene

### 5.1 `.gitignore` does not ignore `.venv/`
It ignores `venv*/` but not `.venv/`. Many developers use `.venv` (with a leading dot). This will cause accidental commits of virtualenv contents.

### 5.2 `.gitignore` does not ignore `.ruff_cache/` or `.tox/`
Given the project uses `scripts/lint` (likely ruff/black/mypy), `.ruff_cache/` and `.tox/` are common artifacts that should be ignored.

### 5.3 `requirements.txt` exists but no `requirements-dev.txt` or lock file
The file tree shows a single `requirements.txt`. For a library with a large test matrix, there's no lock file (e.g. `requirements-dev.txt`, `uv.lock`, `poetry.lock`). This makes CI non-reproducible — a new release of a dev dependency can break the build without any code change.

### 5.4 `docs/CNAME` exists but no `docs/index.md` front-matter check
`docs/CNAME` is present (for GitHub Pages custom domain), but there's no indication of what domain it points to. Not a bug per se, but worth verifying it matches the `mkdocs.yml` `site_url`.

### 5.5 `tests/fixtures/.netrc-nopassword` is committed
A `.netrc` fixture is committed. Even if it contains no real credentials, committing `.netrc`-shaped files is a bad habit and can trip secret scanners. It should be generated at test time or clearly marked as a fixture.

### 5.6 `docs/img/` contains large binary assets
`docs/img/rich-progress.gif`, `docs/img/tqdm-progress.gif`, `docs/img/butterfly.png`, etc. are committed directly. GIFs of progress bars can be hundreds of KB each. For a library repo, these bloat clone size. Consider hosting them externally or using Git LFS.

---

## 6. Code-level concerns (inferred from file tree)

### 6.1 `httpx/_urlparse.py` and `httpx/_urls.py` both exist
Having both a `_urlparse` module and a `_urls` module suggests URL parsing logic is split across two files. This is a common source of subtle bugs (e.g., the WHATWG test suite in `tests/models/test_whatwg.py` and `tests/models/whatwg.json`). Without seeing the contents, I can't confirm duplication, but the split is worth auditing.

### 6.2 `httpx/_decoders.py` supports zstd via optional dependency
The changelog says zstd support requires `httpx[zstd]`. If `_decoders.py` imports `zstandard` at module level, it will break for users who don't install the extra. The changelog claims "Ensure `certifi` and `httpcore` are only imported if required" (#3377), so the same discipline should apply to `zstandard`. Worth verifying.

### 6.3 `httpx/_main.py` (CLI) is tested by `tests/test_main.py`
The CLI is a relatively small part of the library but has its own test file. If the CLI is not a first-class feature, consider whether it belongs in the core package or should be a separate `httpx-cli` package. Not a bug, but a design question.

### 6.4 `httpx/_status_codes.py` is a generated file
Status codes are static data. If this file is generated, there should be a script to regenerate it (e.g., `scripts/sync-status-codes`). The file tree shows `scripts/sync-version` but no status-code sync script. If it's hand-maintained, it will drift from the HTTP spec.

---

## 7. Test suite concerns

### 7.1 `tests/concurrency.py` is not a test file
The file is named `concurrency.py`, not `test_concurrency.py`. If it contains test functions, pytest won't collect them by default. If it's a helper, it should live in `tests/helpers/` or be named `_concurrency.py` to make its role clear.

### 7.2 `tests/common.py` is a shared helper
Same issue: `common.py` is not collected by pytest, which is correct for a helper, but its name doesn't signal that. Consider `tests/_helpers.py`.

### 7.3 No `tests/test_urlparse.py`
There is `tests/models/test_url.py` and `tests/models/test_whatwg.py`, but no direct test for `httpx/_urlparse.py`. If `_urlparse` is a separate module, it should have its own unit tests.

### 7.4 No `tests/test_urls.py`
Similarly, `httpx/_urls.py` has no dedicated test file. URL handling is the most bug-prone part of an HTTP client; this is a coverage gap.

### 7.5 `tests/models/whatwg.json` is a large fixture
The WHATWG URL test suite is large. Committing it as a single JSON file is fine, but there's no indication of which version of the spec it corresponds to. Add a comment or a `README` in `tests/models/` noting the source and version.

---

## 8. Security / correctness concerns

### 8.1 `publish.yml` uses `TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}`
The secret is named `PYPI_TOKEN` but assigned to `TWINE_PASSWORD`. This works, but the naming is confusing. More importantly, the workflow uses `environment: deploy` — verify that the environment has protection rules (required reviewers) so a compromised tag push can't publish to PyPI.

### 8.2 `publish.yml` triggers on tag push without a test gate
The publish workflow does not depend on the test suite passing. A tag can be pushed on a commit that fails tests, and PyPI will still receive the package. Add a `needs: tests` or a separate `workflow_run` trigger.

### 8.3 `docs/advanced/authentication.md` recommends `NetRCAuth(file=os.environ.get("NETRC"))`
If `NETRC` is unset, `os.environ.get("NETRC")` returns `None`, which `NetRCAuth` treats as "use default". That's fine, but the example doesn't show the `import os` and doesn't warn that `NETRC` is not a standard environment variable (it's a curl convention). Users may expect it to work with `netrc` stdlib behavior, which uses `~/.netrc` only.

### 8.4 `docs/advanced/authentication.md` custom auth example mutates the request in place
```python
def auth_flow(self, request):
    request.headers['X-Authentication'] = self.token
    yield request
```
Mutating the request in place is the documented pattern, but it means the same `Request` object is reused across retries. If the auth flow yields the same request twice (as in the 401 example), the second yield sends the already-mutated request. This is intentional but subtle; the docs should call it out explicitly.

---

## 9. Minor / stylistic

- `CHANGELOG.md` uses `*` for bullets in some sections and `-` in others. Pick one.
- `docs/advanced/clients.md` uses `'` for string literals in some examples and `"` in others. Inconsistent.
- `docs/advanced/clients.md` says "If you need finer-grained control on the merging of client-level and request-level parameters" — "control on" should be "control over".
- `docs/advanced/authentication.md` says "Try to be more descriptive as you can" in `.github/CONTRIBUTING.md` — should be "Try to be as descriptive as you can".
- `.github/CONTRIBUTING.md` says "the seconds step" — should be "the second step".
- `.github/CONTRIBUTING.md` says "it's fully featured" — should be "it's fully featured" (fine) but the sentence is a run-on.
- `.github/ISSUE_TEMPLATE/1-issue.md` has a checkbox `- [ ] Initially raised as discussion #...` — the `#...` placeholder is never filled in, so the checkbox is meaningless as a template.
- `.github/PULL_REQUEST_TEMPLATE.md` says "I understand that this PR may be closed in case there was no previous discussion." — "in case there was" should be "if there was".

---

## Summary of the most serious issues

| # | Issue | Impact |
|---|-------|--------|
| 1.1 | `scripts/build` referenced but missing | CI publish + test workflows fail |
| 4.1 | `publish.yml` triggers on any tag | Accidental PyPI publishes |
| 8.2 | Publish workflow has no test gate | Broken releases can reach PyPI |
| 2.1, 2.2 | Broken doc anchors | Users can't navigate docs |
| 2.4 | Digest auth "provides encryption" | Factually wrong security claim |
| 3.1 | `[UNRELEASED]` casing + ambiguous version | Changelog tooling / user confusion |
| 5.3 | No lock file | Non-reproducible CI |
| 7.3, 7.4 | No dedicated URL parsing tests | Coverage gap in the most bug-prone area |

The single most urgent fix is **1.1** — the CI is currently broken because `scripts/build` does not exist, and this blocks both the test suite and the publish workflow.
