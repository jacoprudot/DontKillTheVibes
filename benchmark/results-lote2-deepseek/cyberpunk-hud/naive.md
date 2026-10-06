# Repository Review: cyberpunk-hud

## Critical Issues

### 1. `project.godot` is missing from the file contents but referenced everywhere
The file tree lists `project.godot`, but its contents aren't included. More importantly, the code depends on things that must be configured there and can't be verified:
- `GameState` autoload registration (`get_node("/root/GameState")` in `cyberpunk_hud.gd:24`)
- Input actions `pause`, `ability_1`, `ability_2`, `ability_3` (used in `_unhandled_input`)
- `main.tscn` as the main scene

If any of these are missing, the project fails at runtime with no fallback. This is a single point of failure that should at least be documented.

### 2. `cyberpunk_hud.gd` hard-crashes if `GameState` is absent
```gdscript
_game_state = get_node("/root/GameState")
```
`get_node` (not `get_node_or_null`) will push an error and return `null` if the autoload isn't registered. Every subsequent line (`_game_state.health_changed.connect(...)`) then errors. There's no guard, despite the code elsewhere defensively checking `has_signal("credits_changed")` and `"credits" in _game_state`. The defensiveness is inconsistent — either trust the autoload or don't.

### 3. `hud_loader.gd` uses `load()` instead of `preload()`/`ResourceLoader` and doesn't handle failure cleanly
```gdscript
var hud_scene: PackedScene = load(path)
if hud_scene == null:
    push_error(...)
    return
```
`load()` on a missing path returns `null` **and** prints an error, so the `push_error` is redundant noise. More importantly, `load()` is synchronous and blocks; for a runtime loader this is acceptable, but the bigger issue is that `hud_version` is a `String` from `@export_enum` — if someone types an invalid value in the inspector (or the enum is edited), you get a silent-ish failure. A `match` or validation against known versions would be safer.

### 4. `_on_hp_direct_hit` leaks stylebox overrides and duplicates state
```gdscript
var style := health_bar.get_theme_stylebox("fill").duplicate() as StyleBoxFlat
health_bar.add_theme_stylebox_override("fill", style)
```
Every direct hit:
- Duplicates the stylebox again (the previous override is discarded, but the new one is a fresh copy each time).
- Adds a new override on top of the existing override.

This grows the override stack and allocates a new `StyleBoxFlat` per hit. It also means the "original_color" captured is the *current* (possibly already-flashed) color, not the theme's base color — so repeated hits can drift the color. The flash tween also isn't tracked, so overlapping hits race each other.

### 5. `_start_hp_breathe` creates an infinite tween with no cleanup
```gdscript
var breathe := create_tween().set_loops()
```
This tween runs forever on `health_bar.modulate:a`. It's never killed. If the HUD is freed/reloaded (e.g. via `hud_loader` version switching), the tween is bound to the node so it should die with it — but combined with `_on_hp_direct_hit` tweening `position` and the flash tweening `style.bg_color`, you have three independent tweens mutating the same node with no coordination. The comment claims they're independent (alpha vs RGB vs position), which is true, but there's no guard against `_on_hp_direct_hit` firing while a previous hit's tween is still running.

### 6. `_on_ammo_changed` is dead code in practice
```gdscript
func _on_ammo_changed(value: int) -> void:
    if not (_game_state != null and "credits" in _game_state):
        ammo_label.text = str(value)
```
Since `GameState` always has `credits`, this branch never executes. The signal is still connected in `_ready`, so it fires and does nothing. Either remove the connection or remove the handler. The comment acknowledges this ("Legacy path") but leaving dead signal wiring is a maintenance trap.

### 7. `_format_credits` is O(n²) and reinvents the wheel
```gdscript
for i in range(s.length() - 1, -1, -1):
    out = s[i] + out
```
String prepending in a loop is quadratic. For 4-digit numbers it's irrelevant, but the comment says "Godot has no built-in locale formatter" — Godot 4 has `String.num_int64()` and you can use `"%d"` with manual grouping, or simply `str(value).pad_zeros()` / a regex. More importantly, this doesn't handle negative numbers (the `-` would be grouped incorrectly) and doesn't handle values ≥ 10000 correctly if `MAX_CREDITS` is ever raised. It's a hand-rolled formatter with edge cases.

### 8. `GameState._process` emits signals every frame during regen
```gdscript
if shield < max_shield:
    shield = minf(shield + _shield_regen_rate * delta, max_shield)
    shield_changed.emit(shield, max_shield)
```
This emits `shield_changed` and `health_changed` **every frame** while regenerating. The HUD handler updates `ProgressBar.value`, `max_value`, and a `Label.text` every frame. `Label.text` assignment is not free (triggers re-layout/redraw). For a demo it's tolerable, but it's a real performance smell and the kind of thing that scales badly. A dirty-check (only emit when the integer display value changes) would be trivial.

### 9. `GameState` mixes demo-driver logic with state
`game_state.gd` is an autoload singleton that:
- Holds game state (health, shield, ammo, credits, cooldowns)
- Runs a demo loop (random damage, random log messages, random credit bursts)
- Contains hardcoded demo constants (`_log_messages`, `MAX_CREDITS`, regen rates)

This makes it unusable as a real game state singleton and untestable in isolation. The demo behavior should be a separate node/script that drives `GameState`, not baked into it. The `_credit_burst` comment even admits it's tuned for "the demo loop."

### 10. `_credit_burst` can produce a no-op signal gap
```gdscript
var new_credits := clampi(credits + delta, 0, MAX_CREDITS)
var applied_delta := new_credits - credits
if applied_delta == 0:
    return
```
If `credits` is already at `MAX_CREDITS` and `delta` is positive, `applied_delta == 0` and it returns silently. Fine. But if `credits` is at 0 and `delta` is negative, same. The logic is correct but the "occasionally income tops up" heuristic (`credits < 500 or randf() < 0.06`) means the counter can sit at 0 for a while with no signal — the HUD shows a stale value. Minor, but the demo loop's intent ("never runs dry") isn't actually guaranteed.

## Correctness / Robustness Issues

### 11. `_on_cooldown_changed` indexes `_ABILITY_ACCENT_COLORS` without bounds check
```gdscript
state_labels[index].add_theme_color_override("font_color", _ABILITY_ACCENT_COLORS[index])
```
The guard is `if index >= 0 and index < cd_labels.size()`. `cd_labels` has 3 entries and `_ABILITY_ACCENT_COLORS` has 3 entries, so it's safe *today*. But the two arrays are decoupled — if someone adds a 4th ability to `cd_labels`/`state_labels`/`ability_nodes` but forgets the color array, this crashes. The arrays should be derived from a single source of truth.

### 12. `_on_log_message` assumes `log_labels` is non-empty
```gdscript
log_labels[log_labels.size() - 1].text = ...
```
If `log_labels` is empty (scene restructure), `size() - 1 == -1` and this indexes out of bounds. The loop `for i in range(log_labels.size() - 1)` also silently does nothing for size 0 or 1. No guard.

### 13. `_toggle_pause` doesn't handle the unpause animation
```gdscript
if is_paused and ap.has_animation("pause_slide_in"):
    ap.play("pause_slide_in")
```
On unpause, the overlay is hidden instantly with no exit animation. The `pause_slide_in` clip presumably leaves the menu in a slid-in state; hiding the overlay mid-animation could leave the AnimationPlayer in an inconsistent state. Also, `get_tree().paused = is_paused` pauses the tree — but the HUD's `_unhandled_input` still needs to run to unpause. If the HUD node's `process_mode` isn't set to `PROCESS_MODE_ALWAYS` (or `WHEN_PAUSED`), the pause menu becomes uncloseable. This isn't visible in the script — it depends on scene configuration that isn't shown.

### 14. `_bounce_ability` sets `pivot_offset` from `node.size` which may be stale
```gdscript
node.pivot_offset = node.size * 0.5
```
If the node hasn't been laid out yet (first frame), `size` is `Vector2.ZERO` and the pivot is wrong. For a bounce triggered by input this is usually fine, but it's fragile. Also, `pivot_offset` is set every bounce — harmless but redundant.

### 15. `hud_loader.gd` `@export_enum` with `String` type is unusual
```gdscript
@export_enum("v1", "v2", "v3") var hud_version: String = "v3"
```
`@export_enum` normally exports an `int` index. Using it with `String` works in Godot 4 (it stores the string), but it's non-idiomatic and the inspector shows a dropdown that maps to strings. If the enum list is edited, existing saved values become invalid strings. An `int` enum with a `match` to build the path would be more robust.

## Documentation / Process Issues

### 16. `CLAUDE.md` references files that don't exist
- `cyberpunk_hud.tscn` — the file tree shows `hud_v1.tscn`, `hud_v2.tscn`, `hud_v3.tscn`, but **no `cyberpunk_hud.tscn`**. Yet `CLAUDE.md`, `docs/prompt-hud-v2.md`, and `cyberpunk_hud.gd` all reference `cyberpunk_hud.tscn`.
- `hud_loader.gd` loads `res://hud_%s.tscn` → `hud_v3.tscn`, which exists. But `cyberpunk_hud.gd` is attached to... which scene? The file tree doesn't show a scene with that script attached, and `cyberpunk_hud.tscn` is missing.

This is a **broken repository state**: the controller script and its scene are disconnected. Either the scene was renamed and the docs/script weren't updated, or the scene is missing entirely.

### 17. `CLAUDE.md` documents stale animations that can't be deleted
```
Stale clips (orphaned, can't delete without `animation_delete` tool):
- `damage_shake`, `dmg_flash`, `hp_low_pulse`
```
This is a known-broken state left in the shipped scene. The friction log (#9) explains why, but shipping a scene with orphaned animation clips that reference non-existent node paths is a latent bug — if anyone re-adds a node with a matching name, the stale clip silently starts working again with wrong behavior.

### 18. `docs/prompt-friction-fixes.md` references paths outside the repo
```
.claude/worktrees/nice-hamilton/docs/friction-log-cyberpunk-hud.md
```
and
```
ln -s /Users/davidsarno/Documents/godot-ai/plugin/addons/godot_ai addons/godot_ai
```
These are machine-specific absolute paths committed to the repo. `CLAUDE.md` also has `/Users/davidsarno/...`. This makes the docs non-portable and leaks the author's filesystem layout.

### 19. `.gitignore` ignores `addons/` but `CLAUDE.md` instructs symlinking into `addons/`
```
addons/
```
Combined with the symlink instruction, this means the plugin is never committed and every clone must re-symlink. That's a deliberate choice, but it's undocumented as such — a reader might think the project is self-contained.

### 20. `docs/prompt-hud-v3.md` says v3 "starts as a copy of `hud_v2.tscn`" but the file tree shows `hud_v3.tscn` exists with no indication it was actually derived
The prompt is a *plan*, not a record. The repo contains `hud_v3.tscn` and `scripts/*.gd` (angular_frame, brackets, cooldown_gauge, log_pulse, orbit_dot, radar_sweep, scanlines, shield_gradient, waveform) that implement the v3 plan — but there's no v3 friction log entry, no updated `CLAUDE.md` describing v3, and no README update. The docs describe v1/v2 while the code has moved to v3. Documentation drift.

### 21. `README.md` isn't included in the provided contents
The file tree lists `README.md` but its contents aren't shown. Given the drift above, it's likely stale too, but I can't verify.

## Code Quality / Style

### 22. Inconsistent null/type guards
- `_game_state.has_signal("credits_changed")` — defensive
- `"credits" in _game_state` — defensive
- `get_node("/root/GameState")` — not defensive
- `_on_ammo_changed` checks `_game_state != null` — but `_game_state` is set in `_ready` and never null after that

The defensiveness is cargo-culted rather than principled. Pick a contract (autoload always exists) and enforce it, or handle absence everywhere.

### 23. Magic numbers scattered through `cyberpunk_hud.gd`
`0.35`, `0.18`, `0.45`, `700.0`, `0.025`, `0.035`, `0.2`, `1.2`, `0.08`, `0.42`, `1.18`, `0.85`, `1.25` — none are named constants. The color constants are extracted (`_CREDIT_SPEND`, etc.) but the timing constants aren't. Inconsistent.

### 24. `_on_damage_taken` is an empty handler
```gdscript
func _on_damage_taken(_amount: float) -> void:
    pass
```
Connected in `_ready` but does nothing. Either remove the connection or implement it. The `dmg_hit` animation mentioned in `CLAUDE.md` is presumably supposed to be triggered here but isn't.

### 25. `_on_hp_direct_hit` and `_on_damage_taken` overlap semantically
`take_damage` emits both `damage_taken` (always) and `hp_direct_hit` (only when HP is hit after shield). The HUD handles `hp_direct_hit` with a jitter and ignores `damage_taken`. This split is confusing — the naming suggests `damage_taken` is the primary event, but the visual feedback is on the secondary one.

### 26. `GameState` uses `Array[float]` for cooldowns but `cooldown_max` is also `Array[float]`
```gdscript
var cooldowns: Array[float] = [0.0, 0.0, 0.0]
var cooldown_max: Array[float] = [1.25, 2.0, 3.0]
```
Two parallel arrays that must stay in sync. `use_ability` checks `index >= cooldowns.size()` but then indexes `cooldown_max[index]` — if `cooldown_max` is shorter, crash. A single array of dictionaries or a small `Ability` class would be safer.

### 27. `_credit_burst` uses `randf() < 0.06` as a magic probability
The comment explains the intent but the 0.06 and the 500 threshold are unnamed. Also, `randi_range(1200, 3500)` vs `-randi_range(50, 200)` — the asymmetry is intentional but undocumented beyond "occasionally income tops up."

## Testing / Verification

### 28. No tests anywhere
No `test/` directory, no GUT/GdUnit setup, no CI config. The friction log and prompts repeatedly mention `pytest -v` and `test_run` — but those are for the **godot-ai plugin**, not this project. This project has zero automated verification. For a demo that's arguably fine, but the docs treat it as a test artifact, so the absence is notable.

### 29. No `project.godot` contents means the Godot version claim is unverifiable
`CLAUDE.md` says "Godot 4.6" and `docs/prompt-hud-v3.md` says "Godot 4.6". Godot 4.6 doesn't exist as of my knowledge — 4.3/4.4 are current. Either this is a typo, a future version, or a fictional version. If `project.godot` declares `config/features=PackedStringArray("4.6")`, the project won't open in any released Godot.

## Summary of Highest-Priority Fixes

1. **Reconcile the missing `cyberpunk_hud.tscn`** — the controller script has no scene, or the docs are wrong. This is the most likely "the repo doesn't actually run" issue.
2. **Guard `get_node("/root/GameState")`** or document the autoload requirement in `project.godot`.
3. **Fix `_on_hp_direct_hit`** to not stack stylebox overrides / duplicate styleboxes per hit.
4. **Remove dead code**: `_on_ammo_changed` connection, `_on_damage_taken` empty handler, stale animation clips.
5. **Move demo-driver logic out of `GameState`** so the singleton is reusable.
6. **Update `CLAUDE.md`/`README.md`** to reflect v3 and the actual file names.
7. **Remove absolute paths** from committed docs.
8. **Verify the Godot version** in `project.godot` is real.
