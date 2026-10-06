# Assessment Report: cyberpunk-hud

- **Repository**: cyberpunk-hud
- **Date**: 2026-10-05T21:06:35.964Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 1
- **Total Findings**: 15
- **By Severity**: critical 1 · high 2 · medium 8 · low 4
- **Estimated Total Effort**: 1×XS, 5×S, 9×M
- **Top 3 Priorities**:
  - `code-logs-secrets-10` — The friction log documents that API keys and tokens were hardcoded in Function nodes or HTTP headers during the MCP exercise, and… (critical, XS)
  - `code-print-statement-8` — hud_loader.gd uses push_error() for a missing scene, which is appropriate, but the broader codebase relies on print-style debugging via… (low, S)
  - `code-medium-length-8` — The _process() function in game_state.gd spans roughly 40 lines and handles shield regen, health regen, HP hit simulation, cooldown… (low, S)

---

## Detailed Findings (by Priority)

### Priority 1: `code-logs-secrets-10`
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.65
**Location**: `docs/friction-log-cyberpunk-hud.md`
**Description**: The friction log documents that API keys and tokens were hardcoded in Function nodes or HTTP headers during the MCP exercise, and CLAUDE.md instructs users to symlink a plugin from an absolute local path. While the current committed files do not contain live secrets, the documented workflow of hardcoding credentials into node properties is a critical anti-pattern that will leak secrets into committed .tscn/.tres files.
**Remediation**: Never embed credentials in node properties or scene files. Use Godot's environment variable access (OS.get_environment) or a dedicated secrets autoload that reads from a gitignored .env file. Add a pre-commit hook that scans .tscn/.tres for token patterns.
**Evidence**:
```
CLAUDE.md: 'Symlink or copy the plugin: ln -s /Users/davidsarno/Documents/godot-ai/plugin/addons/godot_ai addons/godot_ai'
```
**Depends On**: None | **Blocks**: None

### Priority 2: `code-print-statement-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.6
**Location**: `hud_loader.gd:12`
**Description**: hud_loader.gd uses push_error() for a missing scene, which is appropriate, but the broader codebase relies on print-style debugging via the log_message signal and Time.get_time_string_from_system() in cyberpunk_hud.gd without a structured logging framework. The demo emits raw strings to the HUD log feed with no log levels, making production diagnostics difficult.
**Remediation**: Introduce a lightweight logging autoload with level filtering (debug/info/warn/error) and route log_message emissions through it. Keep push_error for genuine errors but add structured context.
**Evidence**:
```
log_labels[log_labels.size() - 1].text = "[%s] %s" % [stamp, text]
```
**Depends On**: None | **Blocks**: None

### Priority 3: `code-medium-length-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.65
**Location**: `autoload/game_state.gd:33`
**Description**: The _process() function in game_state.gd spans roughly 40 lines and handles shield regen, health regen, HP hit simulation, cooldown ticking, damage simulation, log emission, and credit bursts. While under the 50-line threshold, it bundles seven independent simulation concerns into one frame update.
**Remediation**: Extract each simulation concern into its own _tick_* method (e.g., _tick_shield_regen, _tick_hp_hits, _tick_cooldowns) and call them from _process. This makes each simulation independently tunable and testable.
**Evidence**:
```
func _process(delta: float) -> void:
	if shield < max_shield: ...
	if health < max_health: ...
	_hp_hit_timer += delta ...
	for i in range(cooldowns.size()): ...
	_damage_timer += delta ...
	_log_timer += delta ...
	_credit_burst_timer += delta ...
```
**Depends On**: None | **Blocks**: None

### Priority 4: `code-many-params-10`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.6
**Location**: `autoload/game_state.gd:1`
**Description**: game_state.gd declares 12 module-level mutable state variables (health, max_health, shield, max_shield, ammo, credits, cooldowns, cooldown_max, plus 8 private timers/rates). This flat state surface makes it easy to introduce inconsistent state and hard to reason about invariants.
**Remediation**: Group related state into typed sub-resources or dictionaries: a Vitals struct (health/shield + maxes), a Combat struct (ammo/cooldowns), and an Economy struct (credits). Expose accessors that enforce invariants.
**Evidence**:
```
var health: float = 100.0
var max_health: float = 100.0
var shield: float = 50.0
var max_shield: float = 100.0
var ammo: int = 30
var credits: int = 850
var cooldowns: Array[float] = [0.0, 0.0, 0.0]
var cooldown_max: Array[float] = [1.25, 2.0, 3.0]
```
**Depends On**: None | **Blocks**: `structure-config-logic-8`

### Priority 5: `flows-missing-request-id-7`
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.6
**Location**: `cyberpunk_hud.gd:175`
**Description**: The log feed uses Time.get_time_string_from_system() for timestamps, which is a wall-clock time with no correlation ID, sequence number, or monotonic ordering guarantee. In a real HUD this makes it impossible to correlate log entries with game events or trace a single action across the log feed.
**Remediation**: Add a monotonic sequence counter to each log entry (e.g., [0042]) alongside the timestamp, and include a correlation ID when the log entry originates from a specific game event. This enables tracing and deduplication.
**Evidence**:
```
var stamp := Time.get_time_string_from_system()
	log_labels[log_labels.size() - 1].text = "[%s] %s" % [stamp, text]
```
**Depends On**: None | **Blocks**: None

### Priority 6: `code-long-function-7`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `cyberpunk_hud.gd:24`
**Description**: The _ready() function in cyberpunk_hud.gd spans roughly 50 lines and mixes node path resolution, signal connection, initial state hydration, animation triggering, and tween setup. This violates single-responsibility and makes the function hard to test or modify without regression risk.
**Remediation**: Extract into focused helpers: _resolve_node_refs(), _connect_signals(), _hydrate_initial_state(), _start_animations(). Each helper should do one thing and be independently testable.
**Evidence**:
```
func _ready() -> void:
	_game_state = get_node("/root/GameState")
	cd_labels = [...]
	state_labels = [...]
	ability_nodes = [...]
	log_labels = [...]
	_game_state.health_changed.connect(...)
```
**Depends On**: None | **Blocks**: `cost-no-automated-tests-4`

### Priority 7: `code-moderate-complexity-3`
**Module**: code | **Severity**: medium | **Effort**: S | **Confidence**: 0.7
**Location**: `cyberpunk_hud.gd:130`
**Description**: _on_credits_changed() has multiple conditional branches handling gain vs spend, tween cancellation, and duration clamping. The branching logic (delta >= 0, tween running checks, clampf) pushes cyclomatic complexity above 10, making the credit-flash behavior hard to reason about.
**Remediation**: Extract _handle_credit_gain(value) and _handle_credit_spend(value, delta) as separate functions. Each branch becomes a named, testable unit.
**Evidence**:
```
if delta >= 0:
		if _credit_tick_tween != null and _credit_tick_tween.is_running():
			_credit_tick_tween.kill()
		_displayed_credits = float(value)
		ammo_label.text = _format_credits(value)
		return
	if _credit_tick_tween != null and _credit_tick_tween.is_running():
		_credit_tick_tween.kill()
```
**Depends On**: None | **Blocks**: `cost-no-automated-tests-4`

### Priority 8: `code-copy-paste-variant-6`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `cyberpunk_hud.gd:24`
**Description**: cyberpunk_hud.gd contains three near-identical array initializations in _ready() for cd_labels, state_labels, ability_nodes, and log_labels — each is a hand-written list of $ThemeRoot/... node paths. If the scene tree is restructured, all four lists must be updated in lockstep, and the friction log (#12) documents that stale paths silently fail at runtime.
**Remediation**: Replace the hand-written path arrays with a single data-driven loop over an index range, or use @onready arrays with a helper that resolves paths by pattern (e.g., $ThemeRoot/BottomLeft/AbilityBar/Ability%d/CD%d).
**Evidence**:
```
cd_labels = [
		$ThemeRoot/BottomLeft/AbilityBar/Ability1/CD1,
		$ThemeRoot/BottomLeft/AbilityBar/Ability2/CD2,
		$ThemeRoot/BottomLeft/AbilityBar/Ability3/CD3,
	]
	state_labels = [ ... ]
	ability_nodes = [ ... ]
	log_labels = [ ... ]
```
**Depends On**: None | **Blocks**: None

### Priority 9: `code-ignores-return-value-6`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `hud_loader.gd:12`
**Description**: hud_loader.gd calls load(path) and checks for null, but does not verify that the loaded PackedScene actually instantiates successfully. If the scene file is corrupt or has missing dependencies, instantiate() will return null and add_child(null) will silently fail or error without a clear diagnostic.
**Remediation**: Check the instantiate() return value: var instance := hud_scene.instantiate(); if instance == null: push_error(...); return; add_child(instance). Also validate the path exists before load.
**Evidence**:
```
var hud_scene: PackedScene = load(path)
	if hud_scene == null:
		push_error("HudLoader: no scene at %s" % path)
		return
	add_child(hud_scene.instantiate())
```
**Depends On**: None | **Blocks**: None

### Priority 10: `structure-layer-violation-1`
**Module**: structure | **Severity**: high | **Effort**: M | **Confidence**: 0.7
**Location**: `cyberpunk_hud.gd:24`
**Description**: cyberpunk_hud.gd (the view/controller layer) directly reaches into GameState (the model/singleton) via get_node("/root/GameState") and mutates UI state in response to signals. While signal-based decoupling is present, the HUD also reads GameState fields directly (health, shield, credits, ammo) during _ready(), creating a bidirectional coupling between view and model that bypasses any service layer.
**Remediation**: Introduce a HUDViewModel or presenter layer that subscribes to GameState signals and exposes read-only view state. The HUD should only talk to the view model, never to GameState directly. This also makes the HUD testable without a running GameState autoload.
**Evidence**:
```
_game_state = get_node("/root/GameState")
	...
	health_bar.value = _game_state.health
	health_val.text = str(int(_game_state.health))
	shield_bar.value = _game_state.shield
	shield_val.text = str(int(_game_state.shield))
	if "credits" in _game_state:
```
**Depends On**: `structure-high-coupling-2` | **Blocks**: None

### Priority 11: `structure-config-logic-8`
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `autoload/game_state.gd:1`
**Description**: game_state.gd hardcodes demo simulation parameters (regen rates, damage intervals, credit burst ranges, log messages) as module-level constants and variables. These are configuration values masquerading as code, making it impossible to tune the demo without editing the script, and mixing demo-only behavior into what is presented as a reusable state singleton.
**Remediation**: Move tunable parameters into an exported Resource (GameStateConfig) or a .tres file loaded at startup. Separate demo simulation logic from the core state singleton so the singleton can be reused in real games.
**Evidence**:
```
var _shield_regen_rate: float = 3.0
var _hp_regen_rate: float = 5.0
var _damage_interval: float = 4.0
var _hp_hit_interval: float = 2.5
var _log_interval: float = 3.0
var _credit_burst_interval: float = 1.6
```
**Depends On**: `code-many-params-10` | **Blocks**: None

### Priority 12: `flows-missing-error-handler-5`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `cyberpunk_hud.gd:24`
**Description**: cyberpunk_hud.gd connects to GameState signals but never disconnects them, and there is no error handling around the signal callbacks. If GameState emits a signal with unexpected arguments (e.g., after a schema change), the callback will error at runtime with no graceful degradation. The friction log (#12) documents that stale animation tracks silently fail — the same silent-failure pattern applies to signal wiring.
**Remediation**: Add defensive checks in signal callbacks (validate array indices, null-check nodes). Disconnect signals in _exit_tree(). Consider a signal-contract validation step at startup that verifies GameState exposes the expected signals and argument shapes.
**Evidence**:
```
_game_state.health_changed.connect(_on_health_changed)
	_game_state.shield_changed.connect(_on_shield_changed)
	_game_state.ammo_changed.connect(_on_ammo_changed)
	if _game_state.has_signal("credits_changed"):
		_game_state.credits_changed.connect(_on_credits_changed)
```
**Depends On**: None | **Blocks**: None

### Priority 13: `flows-state-expensive-update-5`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `autoload/game_state.gd:33`
**Description**: game_state.gd emits health_changed and shield_changed every frame during regen (whenever value < max), and ability_cooldown_changed every frame per active cooldown. Each emission triggers a full HUD update including label text formatting and ProgressBar value assignment. At 60fps with 3 cooldowns regenerating, this is ~240 signal emissions per second driving UI updates that could be batched.
**Remediation**: Throttle regen signal emissions to a fixed rate (e.g., 10Hz) or only emit when the displayed integer value changes. Batch cooldown updates into a single signal with an array payload. This reduces UI churn without visible quality loss.
**Evidence**:
```
if shield < max_shield:
		shield = minf(shield + _shield_regen_rate * delta, max_shield)
		shield_changed.emit(shield, max_shield)
	if health < max_health:
		health = minf(health + _hp_regen_rate * delta, max_health)
		health_changed.emit(health, max_health)
```
**Depends On**: None | **Blocks**: None

### Priority 14: `structure-high-coupling-2`
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `cyberpunk_hud.gd:24`
**Description**: cyberpunk_hud.gd is coupled to GameState through 8 signal connections plus direct field access, and GameState is coupled back to the HUD through the log_message signal contract. The HUD also depends on the exact node tree shape (ThemeRoot/TopLeft/HealthGroup/HealthContent/HealthBar) via @onready paths, giving it high afferent coupling to the scene structure.
**Remediation**: Define a HUD interface (GDScript abstract class or duck-typed contract) that GameState depends on, and inject it rather than using get_node. Use exported NodePath properties or a scene-tree-agnostic lookup so the HUD survives scene restructuring.
**Evidence**:
```
@onready var health_bar: ProgressBar = $ThemeRoot/TopLeft/HealthGroup/HealthContent/HealthBar
@onready var health_val: Label = $ThemeRoot/TopLeft/HealthGroup/HealthContent/HpHeader/HealthVal
@onready var shield_bar: ProgressBar = $ThemeRoot/TopLeft/HealthGroup/HealthContent/ShieldBar
```
**Depends On**: None | **Blocks**: `structure-layer-violation-1`

### Priority 15: `cost-no-automated-tests-4`
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.85
**Location**: `CLAUDE.md`
**Description**: The repository contains no test files, no test configuration, and no CI workflow. The friction log and prompt-friction-fixes.md explicitly require 'Python unit tests, integration tests, AND GDScript tests' for every fix, but the cyberpunk-hud project itself has zero automated tests. The demo relies entirely on manual project_run + screenshot verification.
**Remediation**: Add a test harness: GUT (Godot Unit Test) for GDScript tests covering game_state.gd simulation logic and cyberpunk_hud.gd signal handlers, plus a GitHub Actions workflow that runs the tests headless on push. Start with tests for _credit_burst, take_damage, and use_ability.
**Evidence**:
```
CLAUDE.md: 'Every fix gets Python unit tests, integration tests, AND GDScript tests' (from prompt-friction-fixes.md) — but no test files exist in the repo tree
```
**Depends On**: `code-long-function-7`, `code-moderate-complexity-3` | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `code-logs-secrets-10`: Never embed credentials in node properties or scene files. (XS)
- `code-print-statement-8`: Introduce a lightweight logging autoload with level filtering (debug/info/warn/error) and route log_message emissions through it. (S)
- `code-medium-length-8`: Extract each simulation concern into its own _tick_* method (e.g., _tick_shield_regen, _tick_hp_hits, _tick_cooldowns) and call them from _process. (S)
- `code-many-params-10`: Group related state into typed sub-resources or dictionaries: a Vitals struct (health/shield + maxes), a Combat struct (ammo/cooldowns), and an Economy struct (credits). (S)
- `flows-missing-request-id-7`: Add a monotonic sequence counter to each log entry (e.g., [0042]) alongside the timestamp, and include a correlation ID when the log entry originates from a specific game event. (S)

### 60 Days
- `code-long-function-7`: Extract into focused helpers: _resolve_node_refs(), _connect_signals(), _hydrate_initial_state(), _start_animations(). (M)
- `code-moderate-complexity-3`: Extract _handle_credit_gain(value) and _handle_credit_spend(value, delta) as separate functions. (S)
- `code-copy-paste-variant-6`: Replace the hand-written path arrays with a single data-driven loop over an index range, or use @onready arrays with a helper that resolves paths by pattern (e.g.,… (M)
- `code-ignores-return-value-6`: Check the instantiate() return value: var instance := hud_scene.instantiate(); if instance == null: push_error(...); return; add_child(instance). (M)
- `structure-layer-violation-1`: Introduce a HUDViewModel or presenter layer that subscribes to GameState signals and exposes read-only view state. (M)
- `structure-config-logic-8`: Move tunable parameters into an exported Resource (GameStateConfig) or a .tres file loaded at startup. (M)
- `flows-missing-error-handler-5`: Add defensive checks in signal callbacks (validate array indices, null-check nodes). (M)
- `flows-state-expensive-update-5`: Throttle regen signal emissions to a fixed rate (e.g., 10Hz) or only emit when the displayed integer value changes. (M)

### 90 Days
- `structure-high-coupling-2`: Define a HUD interface (GDScript abstract class or duck-typed contract) that GameState depends on, and inject it rather than using get_node. (M)
- `cost-no-automated-tests-4`: Add a test harness: GUT (Godot Unit Test) for GDScript tests covering game_state.gd simulation logic and cyberpunk_hud.gd signal handlers, plus a GitHub Actions workflow that runs the tests headless… (M)

---

## Dependencies
- `structure-layer-violation-1` **Depends On** `structure-high-coupling-2` (blocks)
- `cost-no-automated-tests-4` **Depends On** `code-long-function-7` (blocks)
- `cost-no-automated-tests-4` **Depends On** `code-moderate-complexity-3` (blocks)
- `structure-config-logic-8` **Depends On** `code-many-params-10` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
