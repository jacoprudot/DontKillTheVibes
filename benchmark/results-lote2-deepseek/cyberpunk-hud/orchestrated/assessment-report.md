# Assessment Report: cyberpunk-hud

- **Repository**: cyberpunk-hud
- **Date**: 2026-10-05T21:06:54.600Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 2
- **Total Findings**: 71
- **By Severity**: critical 2 · high 8 · medium 33 · low 11 · info 17
- **By Module**: structure 6 · flows 20 · cost 7 · performance 6 · github 32
- **Estimated Total Effort**: 17×XS, 12×S, 40×M, 2×L
- **Top 3 Priorities**:
  - `flows-fire-and-forget-critical-1` — _ready() connects to GameState signals and immediately reads state, but the signal connections are made without any guard for the case… (critical, M) (score 55)
  - `structure-high-coupling-1` — CooldownGauge reaches directly into the global GameState singleton via get_node_or_null("/root/GameState") and then reads… (high, L) (score 44)
  - `flows-missing-idempotency-3` — _credit_burst() mutates the credits balance and emits credits_changed on a timer with no idempotency key or dedupe, so any… (critical, S) (score 40)

---

## Detailed Findings (by Priority)

### Priority 1: `flows-fire-and-forget-critical-1` (score 55)
**Module**: flows | **Severity**: critical | **Effort**: M | **Confidence**: 0.55 | **Score**: 55
**Location**: `cyberpunk_hud.gd:57`
**Description**: _ready() connects to GameState signals and immediately reads state, but the signal connections are made without any guard for the case where GameState is missing or the signals are absent; the code already uses has_signal() checks for credits_changed and hp_direct_hit, showing the contract is unstable, yet the remaining connects are unconditional and will hard-fail the HUD if the autoload changes.
**Remediation**: Wrap all GameState signal connections in a single helper that checks has_signal()/has_method() before connecting, and degrade gracefully (log + disable the affected widget) instead of crashing the HUD when the producer contract changes.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 2: `structure-high-coupling-1` (score 44)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.8 | **Score**: 44
**Location**: `scripts/cooldown_gauge.gd:24`
**Description**: CooldownGauge reaches directly into the global GameState singleton via get_node_or_null("/root/GameState") and then reads _game_state.cooldowns[ability_index] and _game_state.cooldown_max[ability_index] in _draw(), coupling a pure drawing Control to the concrete autoload's internal array layout.
**Remediation**: Inject the cooldown values (or a small cooldown provider interface) into the gauge from the HUD controller instead of resolving /root/GameState inside the widget, so the gauge depends on data rather than on the singleton's field names.
**Depends On**: None | **Blocks**: `flows-missing-error-handler-5`, `flows-fire-and-forget-critical-1`, `flows-missing-idempotency-3`, `flows-missing-request-id-7`, `flows-missing-timeout-6`, `flows-missing-dlq-2`, `flows-message-not-idempotent-8`, `flows-missing-visibility-timeout-9`, `flows-message-ordering-needed-4`, `flows-message-retention-too-short-6`, `flows-no-state-persistence-6`, `flows-state-expensive-update-5`, `flows-state-inefficient-access-7`, `flows-state-missing-defaults-10`, `flows-state-excessive-nesting-8`, `flows-validation-placement-2`, `flows-validation-too-early-3`, `flows-inconsistent-response-4`, `flows-missing-cors-9`, `flows-missing-security-headers-10`

### Priority 3: `flows-missing-idempotency-3` (score 40)
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.4 | **Score**: 40
**Location**: `autoload/game_state.gd:63`
**Description**: _credit_burst() mutates the credits balance and emits credits_changed on a timer with no idempotency key or dedupe, so any replay/duplicate invocation of the same tick (e.g. after a pause/resume or a re-entrant _process) applies the debit or top-up twice.
**Remediation**: Make the credit mutation idempotent by keying each burst with a monotonically increasing tick id and ignoring repeats, or move the balance change behind a single authoritative apply_delta(delta, tick_id) function that rejects already-applied ticks.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 4: `cost-no-automated-tests-4` (score 30)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.75 | **Score**: 30
**Location**: `docs/prompt-friction-fixes.md:17`
**Description**: The repository contains no automated test suite for the HUD project: no test files, no CI workflow, and no test runner configuration are present anywhere in the provided content. The friction-fix prompt even asks the implementer to add Python and GDScript tests from scratch, confirming none exist. Without automated tests, regressions in the HUD controller, GameState singleton, and scene wiring can only be caught by manual play-testing, which is slow and unreliable.
**Remediation**: Add a Godot GUT/GdUnit test suite covering GameState signal emissions (health/shield/credits/cooldown), cyberpunk_hud.gd label formatting and cooldown state transitions, and hud_loader.gd scene resolution; wire it into a CI job that runs on every push.
**Depends On**: None | **Blocks**: None

### Priority 5: `cost-dev-setup-missing-3` (score 28)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 28
**Location**: `CLAUDE.md:18`
**Description**: The documented development setup depends on machine-specific, non-reproducible steps: a hardcoded absolute symlink path (/Users/davidsarno/Documents/godot-ai/plugin/addons/godot_ai) and a manual 'enable the plugin in Project Settings' step, with no devcontainer, no pinned tool versions, and no scripted bootstrap. A new contributor cannot get a working environment from the repository alone.
**Remediation**: Add a bootstrap script (or Makefile target) that resolves the godot-ai plugin path relative to the repo, pins the Godot and Python versions, and automates plugin enablement; document it in CLAUDE.md instead of the absolute symlink.
**Depends On**: None | **Blocks**: None

### Priority 6: `cost-no-code-review-6` (score 24)
**Module**: cost | **Severity**: high | **Effort**: L | **Confidence**: 0.6 | **Score**: 24
**Location**: `docs/prompt-friction-fixes.md:9`
**Description**: The workflow described in the docs is a single-agent, MCP-driven edit loop with no review gate: changes are made directly to scenes/scripts and saved, and the prompt only asks for a PR per tier after the fact. There is no CODEOWNERS, no required-reviewer configuration, and no branch protection evidence in the provided files, so unreviewed changes to shared scripts (cyberpunk_hud.gd, game_state.gd) can land unchecked.
**Remediation**: Add a CODEOWNERS file and enable branch protection requiring at least one approving review plus passing CI before merge to main; document the review step in CLAUDE.md.
**Depends On**: None | **Blocks**: None

### Priority 7: `github-issue-health-3` (score 22.75)
**Module**: github | **Severity**: high | **Effort**: M | **Confidence**: 0.65 | **Score**: 22.75
**Location**: `docs/prompt-friction-fixes.md`
**Description**: The friction-fix prompt instructs the reader to follow a 'Adding a new tool' checklist in CLAUDE.md and a skill file at ~/.claude/skills/godot-ai/skill.md, but neither the checklist nor the skill file exists in this repository. The referenced process documentation is missing.
**Remediation**: Either vendor the referenced checklist and skill file into the repository (e.g. docs/) or remove the dangling references and inline the required steps.
**Depends On**: None | **Blocks**: None

### Priority 8: `flows-message-not-idempotent-8` (score 22.5)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.45 | **Score**: 22.5
**Location**: `cyberpunk_hud.gd:139`
**Description**: _on_credits_changed() applies the delta by tweening the displayed value from the current _displayed_credits, so a duplicated or out-of-order credits_changed emission (e.g. a replayed gain after a spend) leaves the label showing a value that no longer matches GameState.credits.
**Remediation**: Treat the emitted value as authoritative: always tween toward the absolute value from the event and reconcile _displayed_credits against GameState.credits on every emission, ignoring deltas that would move the display away from the source of truth.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 9: `github-log-pattern-6` (score 21)
**Module**: github | **Severity**: high | **Effort**: S | **Confidence**: 0.6 | **Score**: 21
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that stale animation tracks silently target non-existent paths at runtime with 'no error, just no effect' (entry #12). Silent failure of animation tracks is a logging gap: the engine emits nothing, so the defect is invisible in logs.
**Remediation**: Add a runtime check in the HUD script that warns when an expected animation clip is missing or its tracks do not resolve, so silent no-ops surface in the log.
**Depends On**: None | **Blocks**: None

### Priority 10: `flows-missing-dlq-2` (score 20)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.4 | **Score**: 20
**Location**: `autoload/game_state.gd:95`
**Description**: log_message events are emitted into the HUD feed with no dead-letter or overflow handling: _on_log_message shifts the five visible labels and drops the oldest entry, so any message emitted while the feed is saturated is silently discarded with no record.
**Remediation**: Persist overflow log messages to a bounded ring buffer (or a file) instead of dropping them, and expose the buffer so dropped/undelivered messages can be inspected rather than lost.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 11: `structure-low-cohesion-5` (score 17.6)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 17.6
**Location**: `autoload/game_state.gd:1`
**Description**: game_state.gd is a grab-bag singleton that simultaneously owns player vitals (health/shield), weapon ammo, currency/credits economy, ability cooldown timers, a demo damage loop, a log-message generator and a credit-burst simulation — unrelated responsibilities that change for different reasons.
**Remediation**: Split the singleton into cohesive services: a VitalsState (health/shield + regen), an AbilityState (cooldowns), a WalletState (credits), and a separate DemoDriver node that emits the simulated damage/log/credit events.
**Depends On**: None | **Blocks**: None

### Priority 12: `structure-high-coupling-2` (score 16.5)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 16.5
**Location**: `cyberpunk_hud.gd:33`
**Description**: The HUD controller hard-codes the absolute autoload path get_node("/root/GameState") and then reads and writes its fields directly (health, shield, ammo, credits, cooldowns) and calls its methods (use_ability), tightly coupling the view layer to the concrete GameState implementation.
**Remediation**: Depend on an abstract state interface or inject the state node via an exported NodePath, and expose only the signals/accessors the HUD needs so the view is not bound to the singleton's concrete fields.
**Depends On**: None | **Blocks**: None

### Priority 13: `structure-config-logic-8` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `hud_loader.gd:11`
**Description**: HudLoader builds the scene path from the exported hud_version string at runtime ("res://hud_%s.tscn" % hud_version) and loads it dynamically, so the HUD variant selection is configuration logic embedded in a runtime node rather than a data-driven scene reference.
**Remediation**: Replace the string-concatenated dynamic load with an exported PackedScene (or an Array[PackedScene] indexed by the enum) so the scene dependency is declared in the editor and validated at load time instead of resolved by string formatting.
**Depends On**: None | **Blocks**: None

### Priority 14: `structure-service-orchestration-3` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `autoload/game_state.gd:39`
**Description**: _process() in the state singleton orchestrates multiple unrelated subsystems in one loop: shield regen, health regen, random direct-hit damage, cooldown ticking, periodic take_damage, log emission and credit bursts — the state object is acting as a demo orchestrator rather than holding state.
**Remediation**: Move the per-frame simulation (regen, random damage, log/credit timers) into a dedicated DemoDriver/Simulation node and keep GameState as a passive state holder that only exposes signals and mutators.
**Depends On**: None | **Blocks**: None

### Priority 15: `performance-no-perf-budgets-10` (score 14.4)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 14.4
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The project has no performance budget or frame-time target defined anywhere: the HUD stacks many per-frame redraws (scanlines, waveform, radar sweep, orbit dot, cooldown gauges, shield gradient) plus a GameState._process that emits signals every frame, yet no budget, frame-time ceiling, or measurement gate is documented.
**Remediation**: Define an explicit frame-time budget (e.g. HUD must stay under 2 ms CPU/GPU per frame at 960x540) and add a benchmark scene or automated check that fails when the budget is exceeded.
**Depends On**: None | **Blocks**: None

### Priority 16: `flows-missing-error-handler-5` (score 14)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 14
**Location**: `hud_loader.gd:13`
**Description**: HudLoader._ready() loads a scene path built from an exported string and only pushes an error when the load fails; there is no fallback scene, no user-visible error surface, and no recovery path, so a bad hud_version value silently leaves the game with no HUD at all.
**Remediation**: Handle the failure explicitly: fall back to a known-good scene (e.g. res://hud_v1.tscn) or show an on-screen error overlay, and validate hud_version against the exported enum before building the path.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 17: `performance-no-regression-detection-5` (score 13.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 13.2
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: There is no performance regression detection: the friction log documents only functional MCP tooling issues, and no benchmark, frame-time capture, or CI check exists to catch a regression when new per-frame drawing scripts (scanlines, waveform, radar_sweep, orbit_dot) are added to the HUD.
**Remediation**: Add a repeatable benchmark scene that records average and 99th-percentile frame time, and run it in CI (or a pre-commit script) so any change that degrades HUD frame time is flagged.
**Depends On**: None | **Blocks**: None

### Priority 18: `performance-no-cost-perf-tradeoff-8` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: No cost/performance tradeoff analysis is recorded for the decorative effects: the HUD runs multiple always-on per-frame redraw scripts and looped tweens without any documented decision about which effects are worth their frame-time cost.
**Remediation**: Record a short tradeoff note per decorative effect (scanlines, waveform, radar sweep, orbit dot) stating its measured frame-time cost and whether it is worth keeping, and gate the most expensive ones behind a quality setting.
**Depends On**: None | **Blocks**: None

### Priority 19: `performance-no-load-testing-3` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: No load or stress testing is performed or planned for the HUD: the demo drives GameState with fixed timers and the friction log shows only editor screenshots were used for verification, so worst-case signal/log/credit burst rates are never exercised.
**Remediation**: Add a stress harness that drives GameState signals (damage, log_message, credits_changed) at high frequency and measures HUD frame time and allocation to validate behavior under load.
**Depends On**: None | **Blocks**: None

### Priority 20: `cost-documentation-poor-7` (score 11.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 11.2
**Location**: `CLAUDE.md:7`
**Description**: Project documentation is inconsistent with the actual repository state: CLAUDE.md describes a single cyberpunk_hud.tscn while README.md documents three versioned scenes (hud_v1/v2/v3.tscn), and CLAUDE.md lists stale animation clips (damage_shake, dmg_flash, hp_low_pulse) that no longer exist in hud_v2/hud_v3 libraries. There is no setup/run guide for the standalone project, no explanation of the GameState demo loop, and no architecture overview, so onboarding a new contributor requires reverse-engineering the scenes.
**Remediation**: Reconcile CLAUDE.md with README.md (document all three HUD versions and the hud_version selector), remove references to deleted animation clips, and add a short architecture/setup section covering GameState signals and how to run the project.
**Depends On**: None | **Blocks**: None

### Priority 21: `github-issue-health-7` (score 11.2)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 11.2
**Location**: `docs/prompt-hud-v2.md:5`
**Description**: The v2 prompt hardcodes an absolute local path (/Users/davidsarno/Documents/cyberpunk-hud-demo/) as the project location, which leaks a developer's home directory and username into the repository and is meaningless to any other contributor.
**Remediation**: Replace the absolute path with a repo-relative description (e.g. 'this repository root') and scrub other machine-specific paths from the docs.
**Depends On**: None | **Blocks**: None

### Priority 22: `flows-state-inefficient-access-7` (score 11)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 11
**Location**: `scripts/cooldown_gauge.gd:38`
**Description**: _draw() reaches into GameState.cooldowns[ability_index] and GameState.cooldown_max[ability_index] by raw index on every redraw with no bounds check, so an out-of-range ability_index (settable via the exported property) reads past the array and errors during drawing.
**Remediation**: Validate ability_index against the GameState array sizes in _ready() and clamp or disable drawing when out of range, and cache the cooldown values in _process instead of indexing the global state inside _draw().
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 23: `cost-no-license-tracking-5` (score 10.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 10.4
**Location**: `README.md:13`
**Description**: The project has no LICENSE file, no license field, and no third-party dependency/license inventory, despite bundling the godot-ai addon (addons/godot_ai) and referencing an external GitHub project. Without license tracking there is no record of the terms under which the bundled addon or the project itself may be used or redistributed.
**Remediation**: Add a LICENSE file for the project, and add a third-party notices file listing the godot-ai addon and any other bundled dependencies with their license identifiers and versions.
**Depends On**: None | **Blocks**: None

### Priority 24: `flows-state-expensive-update-5` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `autoload/game_state.gd:42`
**Description**: _process() emits shield_changed and health_changed every frame while regenerating, even when the value change is sub-pixel, causing the HUD to rebuild label text and bar values at full frame rate for no visible difference.
**Remediation**: Only emit the change signals when the value crosses a meaningful threshold (e.g. int(value) differs from the last emitted int) and coalesce per-frame updates into a single emit at the end of _process.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 25: `flows-state-missing-defaults-10` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `scripts/cooldown_gauge.gd:38`
**Description**: The gauge assumes GameState exposes cooldowns and cooldown_max arrays of matching length and that ability_index is valid; there are no defaults or guards, so a GameState without those fields (or with shorter arrays) makes the gauge fail rather than fall back to a ready state.
**Remediation**: Initialize local defaults (remaining = 0.0, max_cd = 1.0) and guard the GameState lookups with has()/size checks so the gauge renders a sensible ready ring when the state contract is absent or incomplete.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 26: `cost-no-performance-budget-10` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `docs/prompt-hud-v3.md`
**Description**: The v3 plan adds per-frame work (radar sweep arc redraw, waveform polyline of 40-60 points, cooldown gauge arcs, scanline overlay) and explicitly instructs letting the game run for full animation cycles, yet no performance budget is defined anywhere: no target frame time, no draw-call or node-count ceiling beyond a loose '~60 fewer nodes' goal, and no measurement step. Without a budget, per-frame cost regressions in the HUD cannot be detected.
**Remediation**: Define an explicit performance budget for the HUD (e.g. target 60 FPS at 960x540, max draw calls and node count, max per-frame script time) and add a measurement step to the verification checklist that fails when the budget is exceeded.
**Depends On**: None | **Blocks**: None

### Priority 27: `flows-message-retention-too-short-6` (score 9)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 9
**Location**: `cyberpunk_hud.gd:196`
**Description**: The log feed retains only the five visible Log* labels and overwrites the oldest on every new message, so any diagnostic history older than five events is permanently lost with no retention window.
**Remediation**: Keep a longer backing history (e.g. a ring buffer of the last 100 messages) behind the five visible rows and allow scrolling/export so recent-but-not-visible events remain available for debugging.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 28: `flows-missing-timeout-6` (score 9)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 9
**Location**: `cyberpunk_hud.gd:139`
**Description**: _on_credits_changed() creates a tween that animates the displayed credit counter over a duration derived from the delta, but the tween is never bounded by a maximum lifetime and is only killed when a new credits_changed arrives; if the producer stops emitting, the ticker tween and the flash tween keep running with no timeout or cleanup.
**Remediation**: Give the credit ticker tween an explicit maximum duration and kill it in _exit_tree()/on visibility change, and reset _displayed_credits to the authoritative GameState value when the tween finishes so the UI cannot drift from the source of truth.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 29: `cost-no-oss-policy-9` (score 8.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 8.8
**Location**: `CLAUDE.md`
**Description**: There is no open-source usage policy in the repository: no guidance on which licenses are acceptable for dependencies, no approval process for adding third-party code, and no record of how the bundled godot-ai addon was vetted. Contributors adding dependencies have no policy to follow.
**Remediation**: Add a short OSS policy document defining approved license types, the review/approval process for new dependencies, and a requirement to record each dependency's license in the third-party notices file.
**Depends On**: None | **Blocks**: None

### Priority 30: `github-commit-history-1` (score 8.4)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 8.4
**Location**: `CLAUDE.md`
**Description**: The repository contains no LICENSE file and no license declaration in README.md or CLAUDE.md, despite being a public demo project that documents its origin and build process. Without a license, the code is all-rights-reserved by default, which blocks reuse and creates legal ambiguity for anyone cloning the demo.
**Remediation**: Add a LICENSE file (e.g. MIT or Apache-2.0) at the repository root and reference it from README.md so the terms of reuse are explicit.
**Depends On**: None | **Blocks**: None

### Priority 31: `github-commit-history-6` (score 8.4)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 8.4
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log documents that editor_screenshot source="game" fails with a KeyError (entry #4), so the running game view cannot be captured. The documented workaround is 'no workaround', meaning visual verification of the CanvasLayer HUD is impossible through the tooling.
**Remediation**: File the screenshot handler bug as a tracked issue with a minimal reproduction, and add a fallback capture path (e.g. viewport texture grab) so HUD verification is not blocked.
**Depends On**: None | **Blocks**: None

### Priority 32: `github-commit-history-9` (score 8.4)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 8.4
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log documents that ui_build_layout cannot set theme_override_* properties (entry #7), requiring a follow-up node_set_property call per override. This doubles the tool-call count for styled layouts and is a documented, unresolved workflow cost.
**Remediation**: Track the theme_override_* layout-builder gap as an open issue and, until fixed, keep a documented helper pattern for batch-applying overrides after layout creation.
**Depends On**: None | **Blocks**: None

### Priority 33: `github-issue-health-5` (score 8.4)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 8.4
**Location**: `docs/prompt-friction-fixes.md`
**Description**: The friction-fix prompt says fixes should be done on a new branch from main because they modify server/plugin code, but this repository contains no server or plugin source — only the HUD demo and docs. The scope statement does not match the repository contents.
**Remediation**: Clarify in the prompt that the server/plugin fixes belong to the godot-ai repository, and keep this repo's copy limited to the HUD artifact and friction log.
**Depends On**: None | **Blocks**: None

### Priority 34: `flows-message-ordering-needed-4` (score 8)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 8
**Location**: `cyberpunk_hud.gd:196`
**Description**: _on_log_message() maintains ordering by shifting label text down the array, which assumes messages arrive strictly in order; because the producer emits from _process with independent timers (log, damage, credits), two events in the same frame can be rendered in an order that does not match their emission order.
**Remediation**: Attach a sequence number to each log_message emission and sort/insert by that sequence in the HUD feed, or emit all per-frame events through a single ordered queue so the displayed order matches the producer's order.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 35: `flows-validation-placement-2` (score 8)
**Module**: flows | **Severity**: medium | **Effort**: S | **Confidence**: 0.4 | **Score**: 8
**Location**: `autoload/game_state.gd:88`
**Description**: use_ability() validates the index and cooldown state at the point of mutation, but the HUD's _unhandled_input() already maps keys to fixed indices and calls use_ability without any validation, so invalid input is only caught deep in the state layer rather than at the boundary.
**Remediation**: Validate the ability index at the input boundary in _unhandled_input() (and in any other caller) before dispatching, so bad indices are rejected before they reach the state mutation path.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 36: `github-issue-health-1` (score 7.7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 7.7
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log contains 12 documented issues with proposed tool changes, but there is no tracking artifact (issue list, TODO index, or status table) mapping each entry to an open/closed state. Readers cannot tell which frictions are still live.
**Remediation**: Add a status column or companion tracking file that maps each friction entry to an issue number and open/closed state, and update it as fixes land.
**Depends On**: None | **Blocks**: None

### Priority 37: `github-issue-health-9` (score 7.7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 7.7
**Location**: `docs/prompt-hud-v3.md`
**Description**: The v3 prompt references a branch 'polish/v2-terminal' and a godot-ai plugin version requirement (v1.1.0+) but the repository provides no way to verify which branch or plugin version is actually in use, and the branch is not documented anywhere else.
**Remediation**: Record the required plugin version and working branch in CLAUDE.md or a VERSIONS file so the v3 instructions can be validated against the checked-out state.
**Depends On**: None | **Blocks**: None

### Priority 38: `flows-missing-visibility-timeout-9` (score 7)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.35 | **Score**: 7
**Location**: `autoload/game_state.gd:95`
**Description**: The log_message signal is emitted on a fixed 3-second timer with no visibility/acknowledgement timeout, so messages are pushed to the HUD regardless of whether the consumer is ready or has processed the previous one.
**Remediation**: Add an acknowledgement or visibility window to the log_message contract (e.g. only emit when the HUD reports it is visible and has drained the previous message) so the producer does not outrun the consumer.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 39: `github-issue-health-11` (score 7)
**Module**: github | **Severity**: medium | **Effort**: S | **Confidence**: 0.5 | **Score**: 7
**Location**: `docs/prompt-hud-v3.md`
**Description**: The v3 prompt asks for a full-rect TextureRect with a GradientTexture2D or minimal shader for the scanline overlay, but the implemented scanlines.gd draws lines procedurally instead. The prompt and the delivered artifact diverge without a note explaining the deviation.
**Remediation**: Update the v3 prompt to describe the procedural scanline implementation actually used, or add a note in the friction log explaining why the shader approach was abandoned.
**Depends On**: None | **Blocks**: None

### Priority 40: `github-log-pattern-2` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that animation_create_simple rejects duplicate same-node/same-property targets but allows same-node/different-property (poke #4), and that the error message says 'Animation already exists. Delete it first or choose a different name.' The error text conflates two distinct failure modes (duplicate clip name vs duplicate track target).
**Remediation**: Split the error messages so duplicate-clip-name and duplicate-track-target failures are distinguishable, and document the distinction in the friction log.
**Depends On**: None | **Blocks**: None

### Priority 41: `github-log-pattern-4` (score 7)
**Module**: github | **Severity**: medium | **Effort**: S | **Confidence**: 0.5 | **Score**: 7
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that theme_create fails with 'Error 19 (ERR_FILE_NOT_FOUND or ERR_FILE_CANT_WRITE)' when the parent directory is missing (entry #1). The log itself is unsure which of the two error codes applies, indicating the error was not captured precisely.
**Remediation**: Re-run the failing call and record the exact error code and message rather than the ambiguous 'or' form, so the fix can target the correct failure path.
**Depends On**: None | **Blocks**: None

### Priority 42: `github-log-pattern-5` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that scene_open reports EDITOR_NOT_READY after project_stop returned success (entry #10), but the log does not record the elapsed time between stop and the failing call, nor whether editor_state was polled. The timing evidence needed to fix the race is absent.
**Remediation**: Add timestamps and the editor_state snapshot to the friction entry so the readiness race can be characterized and reproduced.
**Depends On**: None | **Blocks**: None

### Priority 43: `github-log-pattern-9` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that node_rename on the scene root returns 'INVALID_PARAMS: Cannot rename the scene root' (entry #2), but the restriction is not documented in any user-facing reference in this repository, so callers only discover it by failure.
**Remediation**: Document the scene-root rename restriction in CLAUDE.md alongside the other known tool limitations, and note the editor-UI alternative.
**Depends On**: None | **Blocks**: None

### Priority 44: `structure-dto-logic-7` (score 3.3)
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3.3
**Location**: `cyberpunk_hud.gd:196`
**Description**: _format_credits() implements thousands-separator presentation logic (manual digit loop and comma insertion) inside the HUD controller, mixing display formatting behavior into the view class rather than a formatting utility.
**Remediation**: Extract _format_credits into a shared formatting helper (e.g. a NumberFormat utility) so the HUD controller only binds values to labels and formatting can be reused and unit-tested independently.
**Depends On**: None | **Blocks**: None

### Priority 45: `performance-no-slo-6` (score 3)
**Module**: performance | **Severity**: low | **Effort**: M | **Confidence**: 0.5 | **Score**: 3
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: No service-level objective exists for the HUD's responsiveness: there is no stated target for input-to-visual latency, animation smoothness, or frame rate, so the many tween-driven effects (credit ticker, ability bounce, hp breathe) cannot be evaluated against any objective.
**Remediation**: Document SLOs for the HUD (e.g. 60 FPS sustained, input-to-feedback under 50 ms) and verify them with a frame-time capture during a scripted interaction sequence.
**Depends On**: None | **Blocks**: None

### Priority 46: `performance-no-tech-debt-alloc-9` (score 3)
**Module**: performance | **Severity**: low | **Effort**: M | **Confidence**: 0.5 | **Score**: 3
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log documents accumulating technical debt (stale animation clips left in the library, animations silently targeting non-existent paths, no animation_delete tool) with no allocation of effort to pay it down, which will keep degrading the HUD's runtime behavior.
**Remediation**: Allocate a fixed slice of each iteration to removing the documented debt (delete stale clips, fix broken animation track paths) and track it as explicit backlog items.
**Depends On**: None | **Blocks**: None

### Priority 47: `flows-inconsistent-response-4` (score 2.5)
**Module**: flows | **Severity**: low | **Effort**: M | **Confidence**: 0.5 | **Score**: 2.5
**Location**: `cyberpunk_hud.gd:123`
**Description**: The HUD renders the ammo label from two different sources depending on whether GameState exposes a credits field: _on_ammo_changed writes str(value) while _on_credits_changed writes _format_credits(value), so the same widget produces two different response shapes for the same underlying state.
**Remediation**: Pick one authoritative source for the ammo/credits label and route both signals through a single formatter, removing the legacy _on_ammo_changed branch so the widget's output shape is consistent regardless of which signal fires.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 48: `flows-no-state-persistence-6` (score 2.5)
**Module**: flows | **Severity**: low | **Effort**: M | **Confidence**: 0.5 | **Score**: 2.5
**Location**: `autoload/game_state.gd:14`
**Description**: GameState holds health, shield, ammo, credits and cooldowns purely in memory with no persistence layer, so all flow state is lost on quit/reload and cannot be resumed or inspected after a crash.
**Remediation**: Add a save/load path for GameState (e.g. serialize the mutable fields to user:// on change or on quit and restore them in _ready) so flow state survives restarts and can be inspected after a failure.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 49: `flows-state-excessive-nesting-8` (score 2.25)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.45 | **Score**: 2.25
**Location**: `cyberpunk_hud.gd:139`
**Description**: _on_credits_changed() nests the gain/spend branching, tween-kill logic and counter fast-forward inside a single handler, mixing flash animation, tween lifecycle management and numeric formatting in one deeply branched flow.
**Remediation**: Split the handler into separate _flash_credit_change(), _snap_credits() and _tick_credits_down() functions and dispatch on the delta sign at the top level so each flow path is flat and independently testable.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 50: `flows-validation-too-early-3` (score 2.25)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.45 | **Score**: 2.25
**Location**: `cyberpunk_hud.gd:57`
**Description**: _ready() reads _game_state.health/shield/credits and formats them before the first signal arrives, duplicating the formatting logic that _on_health_changed/_on_shield_changed/_on_credits_changed perform; the initial values are validated and rendered early, then immediately overwritten by the first emission.
**Remediation**: Remove the duplicated initial formatting and instead call the same _on_health_changed/_on_shield_changed/_on_credits_changed handlers once at the end of _ready() so there is a single rendering path for both initial and subsequent state.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 51: `github-commit-history-10` (score 2.1)
**Module**: github | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 2.1
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log documents that theme_set_stylebox_flat only supports uniform border widths, corner radii, and content margins (entries #5 and #11), blocking asymmetric neon-underline and header-padding designs. The workaround was to accept uniform values, which visibly limits the intended aesthetic.
**Remediation**: Add per-side border_width_*, corner_radius_*, and content_margin_* parameters to theme_set_stylebox_flat, since StyleBoxFlat already exposes them natively.
**Depends On**: None | **Blocks**: None

### Priority 52: `flows-missing-request-id-7` (score 2)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.4 | **Score**: 2
**Location**: `autoload/game_state.gd:95`
**Description**: log_message is emitted with only free-text payloads (e.g. "Ability %d activated", "Reloaded") and no correlation id, so the HUD log feed cannot correlate an emitted event with the state change that produced it when several events fire in the same frame.
**Remediation**: Add a monotonically increasing event id (and optionally a source tag) to the log_message signal payload and render it in the log feed so each entry is traceable back to its originating state change.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 53: `flows-missing-cors-9` (score 1.5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.3 | **Score**: 1.5
**Location**: `project.godot:21`
**Description**: The project enables the godot_ai editor plugin and autoloads its runtime game_helper.gd, which exposes an in-editor/runtime helper surface with no visible origin or access restriction configured in the project settings.
**Remediation**: Restrict the godot_ai helper to editor-only builds (guard the autoload behind OS.has_feature("editor")) and document/limit which origins or callers may reach the helper endpoint.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 54: `flows-missing-security-headers-10` (score 1.5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.3 | **Score**: 1.5
**Location**: `project.godot:21`
**Description**: The project configuration defines no security-relevant settings for the enabled godot_ai plugin/autoload (no allowlist, no bind address restriction, no auth token), leaving the helper surface open to whatever the plugin defaults to.
**Remediation**: Add explicit configuration for the godot_ai helper (bind to localhost only, require a token, disable in exported builds) in project.godot or the plugin settings so the surface is not left at insecure defaults.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 55: `github-issue-health-8` (score 0.56)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.8 | **Score**: 0.56
**Location**: `CLAUDE.md:18`
**Description**: CLAUDE.md instructs users to symlink the plugin from an absolute local path (ln -s /Users/davidsarno/Documents/godot-ai/plugin/addons/godot_ai addons/godot_ai) and to run the dev server from ~/Documents/godot-ai. These machine-specific instructions cannot be followed by other contributors.
**Remediation**: Document the plugin setup using a relative or configurable path (e.g. an environment variable or a documented clone location) instead of a hardcoded home directory.
**Depends On**: None | **Blocks**: None

### Priority 56: `github-issue-health-12` (score 0.52)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.75 | **Score**: 0.52
**Location**: `docs/prompt-hud-v3.md:5`
**Description**: The v3 prompt states hud_v1.tscn and hud_v2.tscn must not be modified, yet hud_v2.tscn and hud_v3.tscn share the same scene uid (uid://6tj7ce5sra3b). Duplicate uids across scenes is a resource-identity conflict that can cause Godot to load the wrong scene.
**Remediation**: Assign a unique uid to hud_v3.tscn (regenerate it in the editor) so it no longer collides with hud_v2.tscn's uid.
**Depends On**: None | **Blocks**: None

### Priority 57: `github-commit-history-2` (score 0.49)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.7 | **Score**: 0.49
**Location**: `CLAUDE.md:39`
**Description**: CLAUDE.md documents stale, orphaned animation clips (damage_shake, dmg_flash, hp_low_pulse) that were superseded but never removed because no animation_delete tool existed. The friction log confirms the workaround was to create incremented names (dmg_shake2, dmg_shake3), leaving dead artifacts in the scene library.
**Remediation**: Remove the orphaned animation clips from the AnimationPlayer library now that the tooling gap is understood, and delete the corresponding stale-clip note from CLAUDE.md.
**Depends On**: None | **Blocks**: None

### Priority 58: `github-issue-health-6` (score 0.49)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.7 | **Score**: 0.49
**Location**: `docs/prompt-hud-v2.md:8`
**Description**: The v2 prompt instructs editing test_project/cyberpunk_hud.tscn and test_project/themes/cyberpunk.tres, but no test_project/ directory exists in this repository — the HUD lives at the repo root. The file paths in the prompt are stale.
**Remediation**: Update the prompt's file paths to match the actual repository layout (cyberpunk_hud.tscn, themes/cyberpunk.tres at the root) or move the HUD into test_project/ as the prompt assumes.
**Depends On**: None | **Blocks**: None

### Priority 59: `github-commit-history-3` (score 0.45)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.65 | **Score**: 0.45
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that animations silently target non-existent node paths after layout restructuring (entry #12), with no error at runtime. This is a latent correctness hazard: the HUD can appear to work while damage/pause animations do nothing.
**Remediation**: Add a startup validation pass that checks every AnimationPlayer track path resolves, and fail loudly (push_error) when a track points at a missing node.
**Depends On**: None | **Blocks**: None

### Priority 60: `github-issue-health-10` (score 0.45)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.65 | **Score**: 0.45
**Location**: `docs/prompt-hud-v3.md`
**Description**: The v3 prompt requires running animation_validate on every AnimationPlayer clip after node moves, but the friction log (entry #12) states no such validation tool exists. The verification step in the prompt is therefore not executable.
**Remediation**: Either implement animation_validate before relying on it in the prompt, or replace the step with a manual track-path audit and note the tooling gap.
**Depends On**: None | **Blocks**: None

### Priority 61: `github-commit-history-5` (score 0.42)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.42
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records a readiness race (entry #10) where scene_open reports play mode after project_stop returned success, requiring a 3-5 second manual retry. This is an unaddressed flakiness source in the documented workflow.
**Remediation**: Track the readiness-race issue as an open item in the repo (issue or TODO in docs) and add a retry-with-backoff helper rather than relying on manual sleeps.
**Depends On**: None | **Blocks**: None

### Priority 62: `github-commit-history-7` (score 0.42)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.42
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that theme_create fails when the parent directory does not exist (entry #1), and the workaround was to write a .gitkeep file first. This is a recurring papercut that adds a manual step to every new theme/script creation.
**Remediation**: Add DirAccess.make_dir_recursive_p() before saving in file-creating handlers so directory creation is automatic, and remove the .gitkeep workaround from the docs.
**Depends On**: None | **Blocks**: None

### Priority 63: `github-commit-history-8` (score 0.42)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.42
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log documents that theme_apply rejects CanvasLayer roots (entry #6), forcing a ThemeRoot Control wrapper and reparenting of all regions. The workaround is baked into the scene structure but is not explained in CLAUDE.md, so future contributors may not understand why ThemeRoot exists.
**Remediation**: Add a short comment in CLAUDE.md explaining that ThemeRoot exists because theme_apply cannot target CanvasLayer, so the wrapper is intentional.
**Depends On**: None | **Blocks**: None

### Priority 64: `github-issue-health-2` (score 0.42)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.42
**Location**: `docs/prompt-friction-fixes.md`
**Description**: The friction-fix prompt references a worktree path (.claude/worktrees/nice-hamilton/docs/friction-log-cyberpunk-hud.md) and a branch (dlight/nice-hamilton) that are local-only artifacts. Anyone outside the original machine cannot follow the instructions, making the document non-reproducible.
**Remediation**: Replace machine-local worktree paths with repo-relative paths and describe how to recreate the branch, so the fix instructions are reproducible by other contributors.
**Depends On**: None | **Blocks**: None

### Priority 65: `github-issue-health-4` (score 0.42)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.42
**Location**: `docs/prompt-friction-fixes.md`
**Description**: The friction-fix prompt requires 'Python unit tests, integration tests, AND GDScript tests' plus 'pytest -v' and 'test_run' before any batch is considered done, but this repository contains no test directory, no pytest configuration, and no test runner script. The stated verification gate cannot be satisfied as-is.
**Remediation**: Add the referenced test scaffolding (tests/ directory, pytest config, GDScript test runner) or document where the test suite lives if it is maintained in the godot-ai repo instead.
**Depends On**: None | **Blocks**: None

### Priority 66: `github-commit-history-4` (score 0.39)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.55 | **Score**: 0.39
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log documents that signal_connect cannot resolve autoload singletons (entry #8), forcing signal wiring into GDScript _ready() code. The workaround is functional but means the scene files do not express their own wiring, making the graph harder to inspect.
**Remediation**: Document the autoload-signal limitation in CLAUDE.md and keep all autoload signal connections centralized in one clearly commented _ready() block per scene script.
**Depends On**: None | **Blocks**: None

### Priority 67: `github-log-pattern-1` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that signal_connect failed for both '/root/GameState' and bare 'GameState' forms (entry #8), and the deliberate-poke checklist confirms 'Both forms fail'. The log does not record the exact error text for the bare-name form, making the report harder to act on.
**Remediation**: Capture and include the full error payload for each failing call form in the friction log so the plugin maintainers can reproduce without guessing.
**Depends On**: None | **Blocks**: None

### Priority 68: `github-log-pattern-10` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that animation_create_simple duplicate-target behavior was 'Partial' (poke #4) and that the exact rejection boundary (same node + same property) was only inferred. The log does not record the error text for the rejected case, leaving the boundary under-specified.
**Remediation**: Record the exact error message and a minimal reproduction for the rejected duplicate-target case so the boundary is documented precisely.
**Depends On**: None | **Blocks**: None

### Priority 69: `github-log-pattern-3` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that editor_screenshot source="game" fails with a KeyError-style error (entry #4) but does not include the traceback or the exact key that was missing, so the bug cannot be diagnosed from the log alone.
**Remediation**: Include the full traceback and the offending parameter name in the friction entry, and link it to the corresponding issue.
**Depends On**: None | **Blocks**: None

### Priority 70: `github-log-pattern-7` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that ui_build_layout rejected 'theme_override_colors/font_color' with 'Property not found on PanelContainer' (entry #7). The error names the node type but not the supported property paths, leaving the caller to guess the correct form.
**Remediation**: Extend the error message to list the supported theme_override_* prefixes (colors, constants, font_sizes) so callers can self-correct.
**Depends On**: None | **Blocks**: None

### Priority 71: `github-log-pattern-8` (score 0.35)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.5 | **Score**: 0.35
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log records that theme_apply rejected the CanvasLayer root with 'Node /cyberpunk_hud is not a Control or Window (got CanvasLayer)' (entry #6). The message is accurate but offers no hint that a Control wrapper is the intended workaround.
**Remediation**: Append a suggested remediation to the error (e.g. 'wrap children in a Control and apply the theme there') so the failure is self-documenting.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `flows-fire-and-forget-critical-1`: Wrap all GameState signal connections in a single helper that checks has_signal()/has_method() before connecting, and degrade gracefully (log + disable the affected widget) instead of crashing the… (M)
- `structure-high-coupling-1`: Inject the cooldown values (or a small cooldown provider interface) into the gauge from the HUD controller instead of resolving /root/GameState inside the widget, so the gauge depends on data rather… (L)
- `flows-missing-idempotency-3`: Make the credit mutation idempotent by keying each burst with a monotonically increasing tick id and ignoring repeats, or move the balance change behind a single authoritative apply_delta(delta,… (S)
- `cost-no-automated-tests-4`: Add a Godot GUT/GdUnit test suite covering GameState signal emissions (health/shield/credits/cooldown), cyberpunk_hud.gd label formatting and cooldown state transitions, and hud_loader.gd scene… (M)
- `cost-dev-setup-missing-3`: Add a bootstrap script (or Makefile target) that resolves the godot-ai plugin path relative to the repo, pins the Godot and Python versions, and automates plugin enablement; document it in CLAUDE.md… (M)
- `cost-no-code-review-6`: Add a CODEOWNERS file and enable branch protection requiring at least one approving review plus passing CI before merge to main; document the review step in CLAUDE.md. (L)
- `github-issue-health-3`: Either vendor the referenced checklist and skill file into the repository (e.g. (M)
- `flows-message-not-idempotent-8`: Treat the emitted value as authoritative: always tween toward the absolute value from the event and reconcile _displayed_credits against GameState.credits on every emission, ignoring deltas that… (M)
- `github-log-pattern-6`: Add a runtime check in the HUD script that warns when an expected animation clip is missing or its tracks do not resolve, so silent no-ops surface in the log. (S)
- `flows-missing-dlq-2`: Persist overflow log messages to a bounded ring buffer (or a file) instead of dropping them, and expose the buffer so dropped/undelivered messages can be inspected rather than lost. (M)
- `structure-low-cohesion-5`: Split the singleton into cohesive services: a VitalsState (health/shield + regen), an AbilityState (cooldowns), a WalletState (credits), and a separate DemoDriver node that emits the simulated… (M)
- `structure-high-coupling-2`: Depend on an abstract state interface or inject the state node via an exported NodePath, and expose only the signals/accessors the HUD needs so the view is not bound to the singleton's concrete… (M)
- `structure-config-logic-8`: Replace the string-concatenated dynamic load with an exported PackedScene (or an Array[PackedScene] indexed by the enum) so the scene dependency is declared in the editor and validated at load time… (M)
- `structure-service-orchestration-3`: Move the per-frame simulation (regen, random damage, log/credit timers) into a dedicated DemoDriver/Simulation node and keep GameState as a passive state holder that only exposes signals and mutators. (M)
- `performance-no-perf-budgets-10`: Define an explicit frame-time budget (e.g. (M)
- `flows-missing-error-handler-5`: Handle the failure explicitly: fall back to a known-good scene (e.g. (M)
- `performance-no-regression-detection-5`: Add a repeatable benchmark scene that records average and 99th-percentile frame time, and run it in CI (or a pre-commit script) so any change that degrades HUD frame time is flagged. (M)
- `performance-no-cost-perf-tradeoff-8`: Record a short tradeoff note per decorative effect (scanlines, waveform, radar sweep, orbit dot) stating its measured frame-time cost and whether it is worth keeping, and gate the most expensive… (M)
- `performance-no-load-testing-3`: Add a stress harness that drives GameState signals (damage, log_message, credits_changed) at high frequency and measures HUD frame time and allocation to validate behavior under load. (M)
- `github-issue-health-7`: Replace the absolute path with a repo-relative description (e.g. (M)
- `cost-documentation-poor-7`: Reconcile CLAUDE.md with README.md (document all three HUD versions and the hud_version selector), remove references to deleted animation clips, and add a short architecture/setup section covering… (M)
- `flows-state-inefficient-access-7`: Validate ability_index against the GameState array sizes in _ready() and clamp or disable drawing when out of range, and cache the cooldown values in _process instead of indexing the global state… (M)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `cost-no-license-tracking-5`: Add a LICENSE file for the project, and add a third-party notices file listing the godot-ai addon and any other bundled dependencies with their license identifiers and versions. (M)
- `flows-state-expensive-update-5`: Only emit the change signals when the value crosses a meaningful threshold (e.g. (M)
- `flows-state-missing-defaults-10`: Initialize local defaults (remaining = 0.0, max_cd = 1.0) and guard the GameState lookups with has()/size checks so the gauge renders a sensible ready ring when the state contract is absent or… (M)
- `cost-no-performance-budget-10`: Define an explicit performance budget for the HUD (e.g. (M)
- `flows-message-retention-too-short-6`: Keep a longer backing history (e.g. (M)
- `flows-missing-timeout-6`: Give the credit ticker tween an explicit maximum duration and kill it in _exit_tree()/on visibility change, and reset _displayed_credits to the authoritative GameState value when the tween finishes… (M)
- `cost-no-oss-policy-9`: Add a short OSS policy document defining approved license types, the review/approval process for new dependencies, and a requirement to record each dependency's license in the third-party notices… (M)
- `github-commit-history-1`: Add a LICENSE file (e.g. (M)
- `github-commit-history-6`: File the screenshot handler bug as a tracked issue with a minimal reproduction, and add a fallback capture path (e.g. (M)
- `github-commit-history-9`: Track the theme_override_* layout-builder gap as an open issue and, until fixed, keep a documented helper pattern for batch-applying overrides after layout creation. (M)
- `github-issue-health-5`: Clarify in the prompt that the server/plugin fixes belong to the godot-ai repository, and keep this repo's copy limited to the HUD artifact and friction log. (M)
- `flows-message-ordering-needed-4`: Attach a sequence number to each log_message emission and sort/insert by that sequence in the HUD feed, or emit all per-frame events through a single ordered queue so the displayed order matches the… (M)
- `flows-validation-placement-2`: Validate the ability index at the input boundary in _unhandled_input() (and in any other caller) before dispatching, so bad indices are rejected before they reach the state mutation path. (S)
- `github-issue-health-1`: Add a status column or companion tracking file that maps each friction entry to an issue number and open/closed state, and update it as fixes land. (M)
- `github-issue-health-9`: Record the required plugin version and working branch in CLAUDE.md or a VERSIONS file so the v3 instructions can be validated against the checked-out state. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `flows-missing-visibility-timeout-9`: Add an acknowledgement or visibility window to the log_message contract (e.g. (M)
- `github-issue-health-11`: Update the v3 prompt to describe the procedural scanline implementation actually used, or add a note in the friction log explaining why the shader approach was abandoned. (S)
- `github-log-pattern-2`: Split the error messages so duplicate-clip-name and duplicate-track-target failures are distinguishable, and document the distinction in the friction log. (M)
- `github-log-pattern-4`: Re-run the failing call and record the exact error code and message rather than the ambiguous 'or' form, so the fix can target the correct failure path. (S)
- `github-log-pattern-5`: Add timestamps and the editor_state snapshot to the friction entry so the readiness race can be characterized and reproduced. (M)
- `github-log-pattern-9`: Document the scene-root rename restriction in CLAUDE.md alongside the other known tool limitations, and note the editor-UI alternative. (M)
- `structure-dto-logic-7`: Extract _format_credits into a shared formatting helper (e.g. (S)
- `performance-no-slo-6`: Document SLOs for the HUD (e.g. (M)
- `performance-no-tech-debt-alloc-9`: Allocate a fixed slice of each iteration to removing the documented debt (delete stale clips, fix broken animation track paths) and track it as explicit backlog items. (M)
- `flows-inconsistent-response-4`: Pick one authoritative source for the ammo/credits label and route both signals through a single formatter, removing the legacy _on_ammo_changed branch so the widget's output shape is consistent… (M)
- `flows-no-state-persistence-6`: Add a save/load path for GameState (e.g. (M)
- `flows-state-excessive-nesting-8`: Split the handler into separate _flash_credit_change(), _snap_credits() and _tick_credits_down() functions and dispatch on the delta sign at the top level so each flow path is flat and independently… (S)
- `flows-validation-too-early-3`: Remove the duplicated initial formatting and instead call the same _on_health_changed/_on_shield_changed/_on_credits_changed handlers once at the end of _ready() so there is a single rendering path… (S)
- `github-commit-history-10`: Add per-side border_width_*, corner_radius_*, and content_margin_* parameters to theme_set_stylebox_flat, since StyleBoxFlat already exposes them natively. (S)
- `flows-missing-request-id-7`: Add a monotonically increasing event id (and optionally a source tag) to the log_message signal payload and render it in the log feed so each entry is traceable back to its originating state change. (S)
- `flows-missing-cors-9`: Restrict the godot_ai helper to editor-only builds (guard the autoload behind OS.has_feature("editor")) and document/limit which origins or callers may reach the helper endpoint. (S)
- `flows-missing-security-headers-10`: Add explicit configuration for the godot_ai helper (bind to localhost only, require a token, disable in exported builds) in project.godot or the plugin settings so the surface is not left at… (S)
- `github-issue-health-8`: Document the plugin setup using a relative or configurable path (e.g. (XS)
- `github-issue-health-12`: Assign a unique uid to hud_v3.tscn (regenerate it in the editor) so it no longer collides with hud_v2.tscn's uid. (XS)
- `github-commit-history-2`: Remove the orphaned animation clips from the AnimationPlayer library now that the tooling gap is understood, and delete the corresponding stale-clip note from CLAUDE.md. (XS)
- `github-issue-health-6`: Update the prompt's file paths to match the actual repository layout (cyberpunk_hud.tscn, themes/cyberpunk.tres at the root) or move the HUD into test_project/ as the prompt assumes. (XS)
- `github-commit-history-3`: Add a startup validation pass that checks every AnimationPlayer track path resolves, and fail loudly (push_error) when a track points at a missing node. (XS)
- `github-issue-health-10`: Either implement animation_validate before relying on it in the prompt, or replace the step with a manual track-path audit and note the tooling gap. (XS)
- `github-commit-history-5`: Track the readiness-race issue as an open item in the repo (issue or TODO in docs) and add a retry-with-backoff helper rather than relying on manual sleeps. (XS)
- `github-commit-history-7`: Add DirAccess.make_dir_recursive_p() before saving in file-creating handlers so directory creation is automatic, and remove the .gitkeep workaround from the docs. (XS)
- `github-commit-history-8`: Add a short comment in CLAUDE.md explaining that ThemeRoot exists because theme_apply cannot target CanvasLayer, so the wrapper is intentional. (XS)
- `github-issue-health-2`: Replace machine-local worktree paths with repo-relative paths and describe how to recreate the branch, so the fix instructions are reproducible by other contributors. (XS)
- `github-issue-health-4`: Add the referenced test scaffolding (tests/ directory, pytest config, GDScript test runner) or document where the test suite lives if it is maintained in the godot-ai repo instead. (XS)
- `github-commit-history-4`: Document the autoload-signal limitation in CLAUDE.md and keep all autoload signal connections centralized in one clearly commented _ready() block per scene script. (XS)
- `github-log-pattern-1`: Capture and include the full error payload for each failing call form in the friction log so the plugin maintainers can reproduce without guessing. (XS)
- `github-log-pattern-10`: Record the exact error message and a minimal reproduction for the rejected duplicate-target case so the boundary is documented precisely. (XS)
- `github-log-pattern-3`: Include the full traceback and the offending parameter name in the friction entry, and link it to the corresponding issue. (XS)
- `github-log-pattern-7`: Extend the error message to list the supported theme_override_* prefixes (colors, constants, font_sizes) so callers can self-correct. (XS)
- `github-log-pattern-8`: Append a suggested remediation to the error (e.g. (XS)
**Total Effort**: XL

---

## Dependencies
- `flows-missing-error-handler-5` **Depends On** `structure-high-coupling-1`
- `flows-fire-and-forget-critical-1` **Depends On** `structure-high-coupling-1`
- `flows-missing-idempotency-3` **Depends On** `structure-high-coupling-1`
- `flows-missing-request-id-7` **Depends On** `structure-high-coupling-1`
- `flows-missing-timeout-6` **Depends On** `structure-high-coupling-1`
- `flows-missing-dlq-2` **Depends On** `structure-high-coupling-1`
- `flows-message-not-idempotent-8` **Depends On** `structure-high-coupling-1`
- `flows-missing-visibility-timeout-9` **Depends On** `structure-high-coupling-1`
- `flows-message-ordering-needed-4` **Depends On** `structure-high-coupling-1`
- `flows-message-retention-too-short-6` **Depends On** `structure-high-coupling-1`
- `flows-no-state-persistence-6` **Depends On** `structure-high-coupling-1`
- `flows-state-expensive-update-5` **Depends On** `structure-high-coupling-1`
- `flows-state-inefficient-access-7` **Depends On** `structure-high-coupling-1`
- `flows-state-missing-defaults-10` **Depends On** `structure-high-coupling-1`
- `flows-state-excessive-nesting-8` **Depends On** `structure-high-coupling-1`
- `flows-validation-placement-2` **Depends On** `structure-high-coupling-1`
- `flows-validation-too-early-3` **Depends On** `structure-high-coupling-1`
- `flows-inconsistent-response-4` **Depends On** `structure-high-coupling-1`
- `flows-missing-cors-9` **Depends On** `structure-high-coupling-1`
- `flows-missing-security-headers-10` **Depends On** `structure-high-coupling-1`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
