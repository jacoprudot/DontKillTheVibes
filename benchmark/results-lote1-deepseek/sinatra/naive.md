# Repository Review: sinatra

Below are the problems I found, grouped by severity. I've focused on concrete, actionable issues rather than stylistic nitpicks.

---

## High severity

### 1. `CHANGELOG.md` — `4.0.1` section is mislabeled and out of order
The `## 4.0.1 / 2025-05-24` entry appears *after* `4.1.0` and `4.1.1`, and its content is a duplicate of the `4.1.0` fixes (Rack 3.1 compat, malformed Content-Type, frozen-string-literal, etc.). It also uses bare `[#2035]`-style references that are only defined later in the file. This is confusing and historically wrong — `4.0.1` predates `4.1.0`. Either the version number or the date is wrong, and the entries are duplicated.

### 2. `CHANGELOG.md` — `4.2.1` reverts a fix shipped in `4.2.0`
`4.2.0` lists "Fix: `PATH_INFO` can never be empty (#2114)" and `4.2.1` reverts it. That's fine as a changelog, but it means `4.2.0` shipped a regression that broke routing/404 handling. Worth flagging that the release process allowed a change with known downstream breakage to ship, and that the revert is the *only* content of `4.2.1`.

### 3. `.github/workflows/test.yml` — `ruby: "4.0"` in the matrix
The matrix lists `ruby: "4.0"` (and `ruby-head`). Ruby 4.0 does not exist as a released version. If this is aspirational, it will fail `ruby/setup-ruby` resolution; if it's a typo for `3.4`, it's redundant with the existing `3.4` entry. Either way the matrix entry is wrong.

### 4. `.github/workflows/test.yml` — `continue-on-error` masking real failures
The workflow uses `continue-on-error: ${{ matrix.allow-failure || false }}` on both `setup-ruby` and the test steps, then adds empty `run: ""` steps purely to surface the outcome. This is a known anti-pattern: `continue-on-error` marks the step as *passed* even on failure, so the job's overall status is green. The "outcome" echo steps don't fail the job — they just print. A failing `allow-failure` matrix entry will therefore never be visible as a red job, and the Discord notification (`if: failure()`) will not fire for those. The comment even acknowledges this ("because continue-on-error marks the steps as pass even if they fail") but the workaround doesn't actually fix it.

### 5. `.github/workflows/release.yml` — release is not gated on tests
The release workflow triggers on `push: tags: v*` and immediately builds and pushes all three gems. There is no dependency on the test workflow, no `needs:` job, and no verification that the tagged commit passed CI. A tag pushed to a broken commit will publish to RubyGems. Consider gating on a successful test run or at least a `workflow_run` trigger.

### 6. `.github/workflows/release.yml` — `workflow_dispatch` with no inputs
`workflow_dispatch` is enabled with no inputs, so a manual run will attempt to release whatever is on the default branch using the version in `VERSION`/gemspec. There's no guard (e.g., checking the tag matches the version) to prevent accidentally publishing an unreleased version.

### 7. `examples/chat.rb` — `Set` is used without `require 'set'`
```ruby
connections = Set.new
```
`Set` is not required. On Ruby < 3.2 (and depending on load order), this raises `NameError`. The example is also advertised as runnable (`#!/usr/bin/env ruby -I ../lib -I lib`), so it should be self-contained.

### 8. `examples/chat.rb` — XSS via unescaped user input
```ruby
erb :chat, locals: { user: params[:user].gsub(/\W/, '') }
```
The `gsub(/\W/, '')` strips non-word characters, which mitigates most injection, but the value is then interpolated into a `<script>` block:
```js
$.post('/', {msg: "<%= user %>: " + $('#msg').val()});
```
`\W` still allows `_` and digits/letters, so it's *probably* safe, but relying on `\W` for script-context escaping is fragile. More importantly, the chat messages themselves (`params[:msg]`) are broadcast to all clients and appended via `$('#chat').append(e.data)` — jQuery's `.append` with a string interprets HTML, so any connected client can inject markup/scripts into every other client. This is a stored-XSS-by-design example. At minimum it should use `.text()` or escape.

### 9. `examples/chat.rb` — `rescue` with no exception class swallows everything
```ruby
rescue
  out.close
end
```
Bare `rescue` catches `StandardError` (and here, effectively everything), including programming errors, and silently closes the stream. This hides bugs. Should rescue the specific I/O errors expected.

### 10. `examples/chat.rb` — `sleep 1` inside the stream loop
The heartbeat loop sleeps synchronously inside the request handler. With Puma this ties up a thread per connection; with a small thread pool, a handful of chat clients will exhaust the server. The example claims to work with Puma but doesn't demonstrate a non-blocking approach (e.g., `EventMachine` or `Async`), which is misleading for a "simple chat" example.

---

## Medium severity

### 11. `.gitignore` — `.DS_STORE` is the wrong filename
macOS creates `.DS_Store` (lowercase `s`). The pattern `.DS_STORE` will not match. This is a long-standing typo.

### 12. `.gitignore` — `*.lock` ignores `Gemfile.lock`
Ignoring `Gemfile.lock` is a deliberate choice for a library, but this repo also contains `rack-protection/` and `sinatra-contrib/` sub-gems with their own `Gemfile`s. For applications/examples and CI reproducibility, committing lockfiles (or at least not blanket-ignoring them) is usually preferable. At minimum, the blanket `*.lock` also ignores any other lock files (e.g., `yarn.lock`, `package-lock.json`) that might be added later.

### 13. `.rubocop.yml` — `TargetRubyVersion: 2.7` but CI tests Ruby 4.0 / head
The RuboCop target is pinned to 2.7 while the test matrix includes 3.4, 4.0, and head. Newer syntax will be flagged as errors, and cops for newer Rubies won't run. This should track the minimum supported Ruby (which the gemspec says is 2.7.8, so 2.7 is defensible) — but then the `4.0` matrix entry is inconsistent with the stated minimum.

### 14. `.rubocop.yml` — massive list of disabled cops
Roughly 40 cops are disabled, including `Metrics/*`, `Lint/RescueException`, `Lint/UselessAssignment`, `Lint/SuppressedException`, `Style/ClassVars`, and `Lint/MissingSuper`. Several of these (`Lint/RescueException`, `Lint/UselessAssignment`, `Lint/SuppressedException`) catch real bugs. Disabling them wholesale across the codebase means the linter provides little value. The comment "Temporary disable cops because warnings are fixed" suggests these were meant to be re-enabled.

### 15. `.rubocop.yml` — `rack-protection/**/*` and `sinatra-contrib/**/*` excluded
The sub-gems are excluded from linting entirely, so their code is never checked. Given they ship as separate gems, they should have their own `.rubocop.yml` (or be included here).

### 16. `.yardopts` — `'lib/**/*.rb' - '*.md'` is not valid YARD syntax
YARD's `--files`/exclusion syntax uses `--exclude`, not a bare `- '*.md'` argument. As written, YARD will likely treat `-` and `'*.md'` as extra file arguments or error. The intent (exclude markdown from the file list) isn't achieved.

### 17. `Gemfile` — `rubocop '~> 1.32.0'` is very old
RuboCop 1.32 is from 2022. Combined with `NewCops: enable` in `.rubocop.yml`, this is contradictory: `NewCops: enable` opts into cops that don't exist in 1.32, and newer cops added since 1.32 won't be available. Either bump RuboCop or drop `NewCops: enable`.

### 18. `Gemfile` — `gem 'rack', rack_version` with `nil`
```ruby
rack_version = nil if rack_version.empty? || (rack_version == 'stable')
gem 'rack', rack_version
```
Passing `nil` as the version constraint to `gem` is legal but relies on Bundler treating it as "any version." It works, but the pattern is repeated for `rack-session`, `puma`, and `zeitwerk` and is fragile — a future Bundler change could break it. A cleaner pattern is to conditionally add the `gem` line.

### 19. `Gemfile` — `sass-embedded` guard is incomplete
```ruby
java    = %w(jruby truffleruby).include?(RUBY_ENGINE)
aarch64 = RbConfig::CONFIG["target_cpu"] == 'aarch64'
gem 'sass-embedded', '~> 1.54' unless java && aarch64
```
The comment says the gem "fails to be installed on JRuby and TruffleRuby under aarch64," but the guard only skips when *both* conditions hold. On JRuby x86_64 or TruffleRuby x86_64, `sass-embedded` is still installed, which the comment implies is also problematic (native extensions). The condition likely should be `unless java` (or `unless java || aarch64`), depending on the actual failure mode.

### 20. `Gemfile` — `gem 'ostruct'` and `gem 'webrick'` as runtime deps
`ostruct` and `webrick` are bundled gems that were removed from the default gems in Ruby 3.4/3.5. Listing them in the top-level `Gemfile` is fine for tests, but if the library actually requires them at runtime, they must be declared in `sinatra.gemspec` (the CHANGELOG mentions "Declare missing dependencies for Ruby 3.5 (#2032)", so this may already be handled — but the `Gemfile` entries suggest they're only test deps).

### 21. `examples/stream.ru` — comment says "does not work properly with WEBrick" but doesn't say why
The comment is unhelpful. WEBrick buffers output, so streaming doesn't work — but the example doesn't explain this or point to a working server. Minor, but examples should be self-explanatory.

### 22. `examples/lifecycle_events.rb` — `on_start`/`on_stop` are not standard Sinatra DSL
`on_start` and `on_stop` are not part of Sinatra's public API (the CHANGELOG mentions "Add start and stop callbacks #1913" in 3.1.0, so they may exist). If they do, the example is fine; if they're from an extension, the example should `require` it. As written, running this example may raise `NoMethodError`.

### 23. `CONTRIBUTING.md` — IRC link points to Freenode, which is defunct
```
drop by the [#sinatra](irc://chat.freenode.net/#sinatra) channel on
[irc.freenode.net](http://freenode.net).
```
Freenode collapsed in 2021; the project moved to Libera.Chat. This link is dead. Similarly, the mailing list link (`groups.google.com/group/sinatrarb`) may be stale.

### 24. `CONTRIBUTING.md` — references `README.ja.md`, `README.de.md`, etc. that don't exist in this repo
The file tree shows only `README.md`. The translated READMEs are referenced as if they live in this repo (`github.com/sinatra/sinatra/blob/main/README.ja.md`), but they're not present. Either they were removed and the doc wasn't updated, or they live elsewhere.

### 25. `AUTHORS.md` — "Alumni" list includes people still on the team?
Not verifiable from the file tree, but the "Current Team" and "Alumni" lists should be cross-checked against `CODEOWNERS` (`@sinatra/team-sinatra`). Minor.

### 26. `.github/workflows/CODEOWNERS` — wrong location
`CODEOWNERS` must live at `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS`. The file is at `.github/workflows/CODEOWNERS`, which GitHub does **not** recognize. As a result, the `@sinatra/team-sinatra` ownership rule is silently ignored. This is a real bug — the file is in the wrong directory.

### 27. `.github/workflows/test.yml` — `actions/checkout@v5` and `ruby/setup-ruby@v1` version skew
`release.yml` uses `actions/checkout@v4` while `test.yml` uses `@v5`. Inconsistent pinning across workflows makes maintenance harder and can cause subtle differences (e.g., `v5` requires a newer runner). Pick one and use it everywhere.

### 28. `.github/workflows/test.yml` — `rubygems: ${{ matrix.ruby == '3.0' && 'latest' || matrix.ruby == '3.1' && 'latest' || 'default' }}`
This nested ternary is hard to read and relies on Ruby's `&&`/`||` precedence in a GitHub expression. It works, but a clearer form is `contains(fromJSON('["3.0","3.1"]'), matrix.ruby) && 'latest' || 'default'`. Also, the referenced issues (#2051) are old; the workaround may no longer be needed.

### 29. `.github/workflows/test.yml` — `timeout-minutes: 5` for rack-protection
Five minutes is tight for a matrix that includes JRuby and TruffleRuby, which are slow to boot. If a job legitimately takes longer, it will be killed and reported as a failure (or, with `continue-on-error`, silently pass). Consider raising this or measuring actual runtimes.

### 30. `.github/workflows/test.yml` — Discord notification only on `main`
```yaml
if: failure() && github.ref_name == 'main'
```
Failures on PRs and other branches won't notify. That's a deliberate choice, but it means a broken `main` is the only signal — and with `continue-on-error` masking failures, even that may not fire.

---

## Low severity / nits

### 31. `.gitignore` — `/pkg` and `*.gem` overlap
`/pkg` is the conventional gem build output dir; `*.gem` also catches gems built elsewhere. Redundant but harmless.

### 32. `.gitignore` — `vendor` (no leading slash)
`vendor` matches any directory named `vendor` at any depth, including `sinatra-contrib/vendor`. Probably intended, but worth confirming.

### 33. `.yardopts` — `--title 'Sinatra API Documentation'` but the repo contains three gems
The YARD config only documents the top-level `lib/`, not `rack-protection/lib` or `sinatra-contrib/lib`. If the intent is to document all three, the file list is incomplete.

### 34. `examples/simple.rb` — missing blank line / style
```ruby
require 'sinatra'
get('/') { 'this is a simple app' }
```
No blank line between `require` and the route. Trivial, but inconsistent with `lifecycle_events.rb`.

### 35. `examples/chat.rb` — `#!/usr/bin/env ruby -I ../lib -I lib`
The shebang passes `-I` flags, which works on Linux/macOS but not on all platforms (and `env` doesn't split arguments portably). Minor.

### 36. `examples/chat.rb` — `out << "heartbeat:\n"` is not valid SSE
SSE comments are lines starting with `:` (e.g., `:\n\n`). `heartbeat:` is not a recognized field and will be ignored by `EventSource`, so the heartbeat doesn't actually keep the connection alive in the way the comment implies. Should be `": heartbeat\n\n"`.

### 37. `examples/chat.rb` — `post '/'` returns `204` but the JS ignores the response
Fine, but the `204` comment ("response without entity body") is unnecessary.

### 38. `examples/chat.rb` — `connections` is a module-level local, not thread-safe
`Set` is not thread-safe. With Puma's threaded model, concurrent `add?`/`delete`/`each` can corrupt the set or raise. Should use a `Mutex` or a concurrent structure.

### 39. `examples/stream.ru` — `content_type :txt` before `stream`
Setting the content type before streaming is correct, but the example doesn't set `Cache-Control` or `X-Accel-Buffering`, which are often needed to prevent proxy buffering. Minor for an example.

### 40. `CHANGELOG.md` — `## 4.0.0. / 2024-01-19` has a stray period
`4.0.0.` — typo.

### 41. `CHANGELOG.md` — `## Unreleased` is empty
Fine, but if the repo uses `Unreleased` as a convention, it should be populated as changes land, not left empty.

### 42. `CHANGELOG.md` — link reference definitions are inconsistent
Some entries use inline links (`[#2124](https://...)`), others use reference-style (`[#2035]` with definitions at the bottom). Pick one style.

### 43. `Gemfile` — `gem 'minitest', '~> 5.0'` but tests use `test/contest.rb`
The repo has a custom `contest.rb` test harness. If it depends on a specific Minitest version, the constraint should reflect that. `~> 5.0` allows any 5.x, which may break with newer Minitest.

### 44. `Gemfile` — `gem 'rubocop', '~> 1.32.0', require: false`
Pinning to `~> 1.32.0` (i.e., `>= 1.32.0, < 1.33.0`) is extremely tight. Any bugfix in 1.33+ is unavailable. Should be `~> 1.32` (allowing 1.x) or a more recent minor.

### 45. `Gemfile` — `gem 'sass-embedded', '~> 1.54'`
`~> 1.54` allows `>= 1.54, < 2.0`, which is broad. If the guard is about a specific protobuf issue, the constraint should be tighter or the comment should explain the range.

### 46. `Gemfile` — `gem 'falcon', '~> 0.40', platforms: [:ruby]`
Falcon 0.40 is old (2022). If the project supports it, fine, but it may not work with newer Rack/Ruby. Worth verifying.

### 47. `Gemfile` — `gem 'eventmachine'` with no version
EventMachine is unmaintained and has known issues on newer Rubies. If it's only used for one test, consider dropping it or pinning.

### 48. `Gemfile` — `gem 'webrick'` listed but CHANGELOG says WEBrick support was restored in 4.1.1
If WEBrick is a runtime dependency for the `rackup` path, it should be in the gemspec, not just the Gemfile. If it's test-only, fine.

### 49. `examples/chat.rb` — `set :server, :puma` but no `require 'puma'`
Sinatra will try to load Puma lazily; if it's not installed, the example fails with a confusing error. The shebang doesn't help. Should `require 'puma'` or document the dependency.

### 50. `examples/chat.rb` — `halt erb(:login) unless params[:user]`
`params[:user]` could be an empty string (falsy? no — empty string is truthy in Ruby), so `?user=` would pass the check and render the chat with an empty username. Should be `params[:user].to_s.empty?`.

---

## Summary of the most important fixes

| # | Issue | File |
|---|-------|------|
| 1 | `CODEOWNERS` in wrong directory — silently ignored | `.github/workflows/CODEOWNERS` |
| 2 | `ruby: "4.0"` in matrix — nonexistent version | `.github/workflows/test.yml` |
| 3 | `continue-on-error` masks failures; outcome steps don't fail the job | `.github/workflows/test.yml` |
| 4 | Release not gated on tests | `.github/workflows/release.yml` |
| 5 | `Set` not required; XSS in chat example | `examples/chat.rb` |
| 6 | `.DS_STORE` typo | `.gitignore` |
| 7 | `4.0.1` changelog entry duplicated/misordered | `CHANGELOG.md` |
| 8 | `PATH_INFO` regression shipped in 4.2.0 | `CHANGELOG.md` |
| 9 | Dead Freenode link | `CONTRIBUTING.md` |
| 10 | Invalid YARD exclusion syntax | `.yardopts` |

The repository is generally well-maintained, but the CI configuration has real correctness issues (masked failures, nonexistent Ruby version, misplaced `CODEOWNERS`) and the examples contain security-relevant flaws (XSS, thread-unsafe state, missing requires) that undermine their value as documentation.
