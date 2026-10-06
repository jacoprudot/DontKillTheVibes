# Repository Review: `eurekagent`

Below are the problems I found, grouped by severity. I've been specific about file/line references where possible.

---

## Critical / Security

### 1. `protect_result_files.py` — path-based protection is trivially bypassable
The hook blocks writes to `intermediate_results.jsonl` / `best_result.jsonl` by matching on `path.name` and on regexes over the raw command string. This is fragile:

- **Symlink / hardlink bypass**: `ln -s /tmp/evil intermediate_results.jsonl` is caught by the `ln` regex, but `python3 -c "open('intermediate_results.jsonl','w')"` is not — the regex only covers shell utilities (`cp`, `mv`, `tee`, `sed -i`, redirects). Any Python/Perl/Ruby one-liner writing the file passes through.
- **Relative-path evasion**: `_is_protected_result_path` uses `path.name`, so `./subdir/../intermediate_results.jsonl` is fine, but a path like `intermediate_results.jsonl/../x` or a path built at runtime is not inspected at all.
- **`_contains_protected_result_reference`** matches the *substring* anywhere in the command, so `grep intermediate_results.jsonl foo` is fine (read allowed) but so is `echo intermediate_results.jsonl > /tmp/x` — the write-detection regexes are the only real gate, and they're incomplete.

### 2. `_contains_cuda_override` is a denylist, not a sandbox
The hook tries to prevent agents from setting `CUDA_VISIBLE_DEVICES` by regex-matching shell/Python text. This is bypassable by:
- `env CUDA_VISIBLE_DEVICES=0 python ...` (the `env` prefix isn't matched — the pattern requires `CUDA_VISIBLE_DEVICES=` preceded by start/space/pipe/`;`/`` ` ``/`(`, and `env ` puts a space before it, so actually this *is* matched… but `env -u X CUDA_VISIBLE_DEVICES=0` and `env "CUDA_VISIBLE_DEVICES=0"` are not).
- `os.environ.update({"CUDA_VISIBLE_DEVICES": "0"})` — not matched.
- `subprocess.run(..., env={**os.environ, "CUDA_VISIBLE_DEVICES": "0"})` — not matched.
- Reading the value from a file / constructing the string dynamically.

The comment in the skill says "the hook blocks this" — it does not reliably. This is a defense-in-depth measure presented as a guarantee.

### 3. `_is_inside_internal_dir` uses `resolved.parts` but `_resolve_tool_path` may not resolve
`_resolve_tool_path` calls `.resolve(strict=False)` and falls back to the unresolved path on `OSError`. `_is_inside_internal_dir` re-resolves. If resolution fails (e.g., a broken symlink chain), the check silently degrades. More importantly, `PROTECTED_INTERNAL_DIR in resolved.parts` matches *any* path component named `.eureka_internal`, including one the agent creates elsewhere — but also means an agent can read the real one via a symlink whose target resolves outside the check window.

### 4. `log_web_search.py` writes to a hardcoded absolute path
`_HISTORY_PATH = Path("/workspace/round_state/web_search_history.jsonl")` — no env override, no fallback. If the hook runs outside the container (e.g., during local dev or a different mount layout), it either fails silently or writes to an unexpected location. The `_debug` path is similarly hardcoded.

### 5. `log_web_search.py` — unbounded, unvalidated JSONL append
`_append` opens the file in append mode with no locking. Multiple concurrent hook invocations (Claude Code can fire hooks in parallel) can interleave writes. On POSIX, `O_APPEND` writes under `PIPE_BUF` are atomic, but these entries can exceed 4 KB (`summary` up to 1000 chars + JSON overhead), so interleaving is possible. No rotation, no size cap — the file grows forever.

### 6. `log_web_search.py` — `_handle_web_search` dedup is per-call only
`urls = list(set(_URL_RE.findall(text)))` dedups within a single response, but the module docstring claims "URL-level dedup" across the file. There is no cross-call dedup. The docstring is misleading.

### 7. `log_web_search.py` — silent failure on malformed input
`main()` catches `Exception` on `json.loads` and returns silently. A hook that fails to parse its event produces no diagnostic unless `EUREKA_WEB_SEARCH_HOOK_DEBUG` is set. Combined with the fact that the hook's stderr output (`print(..., file=sys.stderr)`) may not be surfaced by Claude Code, debugging is hard.

### 8. `protect_result_files.py` — `_emit_allow`/`_emit_deny` always `sys.exit(0)`
Both exit 0. If Claude Code interprets a non-zero exit as "block" and zero as "allow" (the documented behavior for some hook versions), then a hook that crashes before emitting JSON would be treated as allow. The hook does not wrap `main` in a try/except that emits a deny on unexpected errors — a crash in `_resolve_tool_path` or a regex could let a write through.

---

## Correctness / Logic

### 9. `log_web_search.py` — `_handle_web_search_prime` double-decode is fragile
The comment says Claude Code may double-encode. The code handles `parsed` being a `str`, then handles `parsed[0]` having `"text"` but not `"title"`. But if the double-encoded payload is a dict (not a list), or if the first element is a dict with both `"text"` and `"title"`, the logic silently produces wrong output. There's no test coverage visible.

### 10. `log_web_search.py` — `_extract_text_from_response` returns `str(tool_response)` as last resort
For an unexpected dict shape, this produces a Python repr string that then gets regex-scanned for URLs. `_URL_RE` will match URLs inside the repr, producing garbage entries. Better to return `""` and log a debug entry.

### 11. `protect_result_files.py` — `_is_same_round_peer_path` only checks `approach_details` in `parts`
If the workspace layout changes (e.g., `approaches/` instead of `approach_details/`), the isolation silently stops working. The string `"approach_details"` is hardcoded in multiple places (`_is_same_round_peer_path`, `_is_same_round_manifest_path`, `_contains_same_round_peer_shell_op`). No single source of truth.

### 12. `protect_result_files.py` — `_is_same_round_manifest_path` blocks reads too
The function is called from `_deny_for_file_tool` for *all* tool names, including `Read`. The error message says "access to same-round proposal manifests is blocked during implement" — but the skill says agents may inspect prior rounds. The check only fires when `_implement_isolation_active()`, so it's scoped, but the intent (block reads of same-round manifests) is not documented in the skill's "File Ownership" section, which only says "do not read or modify same-round peer approach directories or descriptions."

### 13. `_contains_same_round_peer_shell_op` regex is incomplete
`rf"(?:/workspace/)?approach_details/(round_{loop_index}_[A-Za-z0-9_-]+)"` — this misses:
- Paths with `./` prefix: `./approach_details/round_1_foo`
- Absolute paths not under `/workspace`: `/home/user/approach_details/...`
- Paths with `..`: `approach_details/../approach_details/round_1_foo`
- Quoted paths with spaces (unlikely for approach IDs, but the regex doesn't anchor on word boundaries)

### 14. `_INTERNAL_DIR_SHELL_PATTERN` misses common tools
The pattern lists many utilities but omits `python`, `python3`, `perl`, `ruby`, `node`, `bash -c`, `sh -c`, `xargs`, `find -exec`, `git`, `rsync`, `scp`. An agent can read `.eureka_internal/gpu_helpers.py` with `python3 -c "print(open('.eureka_internal/gpu_helpers.py').read())"` and the hook won't fire.

### 15. `_is_write_to_protected_result` regexes are order-dependent and incomplete
- `re.search(r">{1,2}\s*[^|;&\n]*" + filenames, command)` — matches `> intermediate_results.jsonl` but also `> /tmp/x intermediate_results.jsonl` (false positive) and misses `>| intermediate_results.jsonl` (noclobber override).
- `\btee\b[^|;&\n]*` — misses `tee -a`? No, `-a` is fine. But misses `tee` with the filename in a variable.
- The `cp|mv|ln|install|dd|truncate` pattern requires the filename to appear *after* the utility on the same line, but `cp intermediate_results.jsonl /tmp/` (reading, not writing) is also blocked — a false positive that breaks legitimate backup workflows.

### 16. `_contains_settings_json_reference` is substring-based
`"~/.claude/settings.json" in command` — matches `echo "not ~/.claude/settings.json"` and `grep -v ~/.claude/settings.json`. It's only used to deny, so false positives are safe but annoying. More importantly, it misses `~/.claude/./settings.json`, `$HOME/.claude/settings.json` with different quoting, and `~/.claude/settings.json` reached via `cd ~/.claude && cat settings.json`.

---

## Architecture / Design

### 17. Hooks are the only enforcement mechanism, and they're text-based
The entire security model (protect result files, protect `.eureka_internal`, prevent CUDA override, isolate same-round peers) rests on regex-matching tool inputs. This is fundamentally unsound. A determined agent (or a prompt-injected one) can bypass all of it. The correct approach is OS-level: run the agent as a user that lacks write permission to controller-owned files, mount `.eureka_internal` read-only, and use cgroups/namespaces for GPU isolation. The hooks should be a convenience layer, not the security boundary.

### 18. Hardcoded `/workspace` paths everywhere
`/workspace/round_state/...`, `/workspace/eval/eureka_submit.py`, `/workspace/approach_details/...`. The repo has a `docker/` directory and a `pyproject.toml`, suggesting it's meant to be runnable outside the container, but the hooks and skills assume the container layout. No env var like `EUREKA_WORKSPACE` is used.

### 19. `results/` directory contains committed submission CSVs
`results/mle/*/submissions/*.csv` are checked in. These are large binary-ish artifacts that bloat the repo and are not source. They should be gitignored or stored as release artifacts. The `.gitignore` presumably doesn't cover them (the file tree shows them present).

### 20. `examples/kernel_engineering_trimul_strict/hidden_eval_dir/_ttt_lib/` is a vendored copy of `libkernelbot`
This is a large third-party library vendored into an example. It will drift from upstream, has no license header visible in the file tree, and makes the example hard to maintain. It should be a dependency, not a copy.

### 21. `src/eval_grader/` and `src/monitor/` have no visible tests
The file tree shows no `tests/` directory anywhere. For a system whose correctness depends on grading, isolation, and budget accounting, the absence of tests is a significant risk. The hooks in particular are pure logic and would be trivial to unit-test.

### 22. `src/acp/` has three adapters (`pty_adapter`, `stream_adapter`, `factory`) with no interface documentation
`protocol.py` presumably defines the interface, but there's no README or docstring visible. The `factory.py` pattern suggests runtime selection, but the criteria are unclear.

### 23. `src/tui/` is a large surface area (app, screens, widgets, theme) with no tests
TUI code is notoriously hard to test, but the presence of `missing_pricing_dialog.py`, `resume_extra_time_dialog.py`, etc. suggests business logic (pricing, budget) is embedded in widgets. That logic should be in `src/pricing.py` / `src/time_budget.py` and tested there.

---

## Documentation / Consistency

### 24. Skill docs contradict the hooks
- `implement-approach/SKILL.md` says "Do **not** read or modify same-round peer approach directories" — the hook blocks *reads* of peer paths, but the skill's "File Ownership" section only says "do not read or modify same-round peer approach directories or descriptions." The hook also blocks same-round *manifests*, which the skill doesn't mention.
- The skill says "Do **not** write to `eval_feedback/`" — the hook does not enforce this. Inconsistent.
- The skill says "Do NOT read or configure `/usr/bin/python3` or `~/.local/lib/python3.x/site-packages`" — no hook enforces this.

### 25. `generate-inputs/SKILL.md` template has a broken code fence
In the INSTRUCTION.md template:
```
<If initial.py is provided:>- Initial code is provided in the file `initial.py`.
```
The `<If ...>` placeholder is jammed against the list item with no space, and the template mixes prose placeholders (`<domain>`) with conditional directives (`<If ...>`) without a clear convention. A model following this template will produce malformed output.

### 26. `generate-inputs/SKILL.md` — "a evaluator" typo
"we provide a evaluator in the file `evaluate.py`" — should be "an evaluator". Minor, but this is a template that gets copied into every generated problem.

### 27. `implement-approach/SKILL.md` — `_validate_solution_description` is duplicated logic
The helper embeds a `vague_starts` tuple and length checks that presumably mirror server-side validation in `src/eval_grader/`. If the server changes its rules, the skill's copy drifts. This should be a shared module or the server should return a clear error that the agent can react to.

### 28. `implement-approach/SKILL.md` — `eureka_score` swallows errors
```python
if r.returncode == 0:
    d = json.loads(r.stdout)
    return d.get("score", 0.0), d.get("valid", False)
return None
```
- `json.loads(r.stdout)` can raise if the grader prints a warning to stdout before the JSON. No try/except.
- `return None` on non-zero exit discards `r.stderr`, so the agent has no idea why grading failed.
- `timeout=120` is hardcoded; GPU grading can take longer.

### 29. `prepare-workspace/SKILL.md` — `progress.json` schema is under-specified
The template shows `"steps_completed": ["<step_names>"]` but doesn't say whether the list is ordered, whether duplicates are allowed, or what happens if a step is re-done. The valid step names are listed but not the valid transitions.

### 30. `README.md` and `assets/TROUBLESHOOTING.md` are not shown
I can't review them, but the presence of a troubleshooting doc alongside a README suggests the setup is non-trivial. Given the hardcoded paths and hook dependencies, that's expected.

---

## Minor / Style

### 31. `log_web_search.py` — `import re` inside functions
`_is_write_to_protected_result`, `_contains_cuda_override`, `_contains_internal_dir_shell_op`, `_contains_same_round_peer_shell_op` all do `import re` locally. `re` is already imported at module top in `log_web_search.py`; in `protect_result_files.py` it's imported at top too (the truncated portion shows `import re` inside functions, which is redundant). Move to module level.

### 32. `log_web_search.py` — `_handle_web_search` summary logic is odd
```python
summary = text[:500] if "error" in text.lower() or "Error" in text else ""
```
`"error" in text.lower()` already covers `"Error"`, so the second condition is dead. Also, storing the first 500 chars of an error as the summary for *every* URL in the response is misleading.

### 33. `protect_result_files.py` — `_resolve_tool_path` `cwd` parameter is required but callers may not pass it
The signature is `_resolve_tool_path(raw_path: str, *, cwd: str)`. If a caller forgets `cwd`, it's a `TypeError`. The truncated portion doesn't show the call site, but this is a footgun.

### 34. `protect_result_files.py` — `PROTECTED_RESULT_FILES` is a set of bare filenames
`{"intermediate_results.jsonl", "best_result.jsonl"}` — any file with that name anywhere on the filesystem is protected. That's probably intended, but it means an agent can't create a file with that name even in its own scratch directory. Document the intent.

### 35. `docker/setup-daemon-proxy.sh` and `docker/build.sh` are not shown
Can't review, but shell scripts in a repo with this much Python should be checked for `set -euo pipefail`, quoting, and idempotency.

### 36. `uv.toml` and `pyproject.toml` both present
`uv.toml` is for uv-specific config; `pyproject.toml` for the project. Having both is fine, but the split should be documented. If `uv.toml` duplicates dependency info, that's a drift risk.

### 37. `results/README.md` exists but `results/mle/2026-05-30T15-07-11-GMT_grading_report.json` has a future date
`2026-05-30` is in the future relative to any plausible review date. Either the system clock is wrong, the filename is a placeholder, or this is a test fixture that shouldn't be committed.

### 38. `examples/ac1/` — "ac1" is an opaque name
No README in the example explains what "ac1" stands for. The other examples (`circle_packing`, `erdos_min_overlap`) are self-describing. Rename or document.

---

## Summary

The most serious issues are:

1. **The security model is regex-based and bypassable** (#1–#8, #14–#16, #17). If this repo is meant to run untrusted agent code, the hooks are not a sufficient boundary.
2. **No tests anywhere** (#21). For a system with this much logic around budgets, grading, and isolation, that's a major gap.
3. **Hardcoded paths and duplicated constants** (#4, #11, #18, #27) make the system brittle and hard to relocate.
4. **Documentation contradicts enforcement** (#24) — agents will be confused about what's actually blocked.
5. **Committed artifacts in `results/`** (#19) and **vendored third-party code** (#20) bloat the repo.

If I were prioritizing: fix the security boundary first (move to OS-level permissions), add tests for the hooks and budget logic, then clean up the docs and repo hygiene.
