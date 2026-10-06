# Assessment Report: deutsia-radio

- **Repository**: deutsia-radio
- **Date**: 2026-10-05T20:32:10.955Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 1
- **Total Findings**: 29
- **By Severity**: critical 1 · high 6 · medium 18 · low 2 · info 2
- **By Module**: database 7 · structure 11 · cost 6 · github 5
- **Estimated Total Effort**: 2×XS, 4×S, 20×M, 3×L
- **Top 3 Priorities**:
  - `database-irreversible-migration-1` — The schema evolution relies on destructive/irreversible ALTER TABLE ADD COLUMN migrations (MIGRATION_1_2 through MIGRATION_9_10) with no… (critical, L) (score 58.5)
  - `database-missing-index-fk-1` — BrowseHistory stores radioBrowserUuid as a logical reference to radio_stations.radioBrowserUuid and is queried by it… (high, S) (score 45.5)
  - `structure-high-coupling-1` — RadioBrowserClient (data layer) directly depends on UI-layer PreferencesHelper and on TorManager, reading seven different proxy… (high, L) (score 41.25)

---

## Detailed Findings (by Priority)

### Priority 1: `database-irreversible-migration-1` (score 58.5)
**Module**: database | **Severity**: critical | **Effort**: L | **Confidence**: 0.45 | **Score**: 58.5
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioDatabase.kt:29`
**Description**: The schema evolution relies on destructive/irreversible ALTER TABLE ADD COLUMN migrations (MIGRATION_1_2 through MIGRATION_9_10) with no downgrade path and no fallbackToDestructiveMigration guard documented. If a migration fails partway, the database is left in an inconsistent state with no rollback strategy.
**Remediation**: Add explicit downgrade migrations or a documented recovery path, wrap each migration in a transaction, and add a pre-migration backup of the database file so a failed upgrade can be restored.
**Depends On**: None | **Blocks**: None

### Priority 2: `database-missing-index-fk-1` (score 45.5)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.7 | **Score**: 45.5
**Location**: `app/src/main/java/com/opensource/i2pradio/data/BrowseHistory.kt:18`
**Description**: BrowseHistory stores radioBrowserUuid as a logical reference to radio_stations.radioBrowserUuid and is queried by it (countBrowseHistoryByUuid, updateBrowseHistoryTimestamp), but the entity declares no @Index on radioBrowserUuid. The index is only created ad-hoc in MIGRATION_4_5, so a fresh install built from the entity schema will not have it.
**Remediation**: Declare @Entity(tableName = "browse_history", indices = [Index(value = ["radioBrowserUuid"]), Index(value = ["visitedAt"])]) on BrowseHistory so the index is part of the generated schema, and add a migration for existing installs.
**Depends On**: None | **Blocks**: None

### Priority 3: `structure-high-coupling-1` (score 41.25)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.75 | **Score**: 41.25
**Location**: `app/src/main/java/com/opensource/i2pradio/data/radiobrowser/RadioBrowserClient.kt:6`
**Description**: RadioBrowserClient (data layer) directly depends on UI-layer PreferencesHelper and on TorManager, reading seven different proxy preferences and Tor connection state to build its HTTP client. A data-layer API client reaching into UI preferences and a global singleton creates tight cross-layer coupling.
**Remediation**: Introduce a ProxyConfigProvider abstraction (interface) that supplies resolved proxy settings, inject it into RadioBrowserClient, and have the UI layer implement it over PreferencesHelper/TorManager.
**Depends On**: None | **Blocks**: None

### Priority 4: `database-sequential-pagination-1` (score 39)
**Module**: database | **Severity**: high | **Effort**: S | **Confidence**: 0.6 | **Score**: 39
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioDao.kt`
**Description**: Browse history pruning uses OFFSET-based pagination: 'SELECT visitedAt FROM browse_history ORDER BY visitedAt DESC LIMIT 1 OFFSET 74' inside deleteOldBrowseHistory. OFFSET forces SQLite to scan and discard the first 74 rows on every prune, and the query is re-run on each history insert.
**Remediation**: Replace the OFFSET subquery with a keyset/seek approach, e.g. delete rows whose visitedAt is older than the 75th newest timestamp obtained via a bounded index scan, or maintain a rolling window by deleting WHERE visitedAt < (SELECT MIN(visitedAt) FROM (SELECT visitedAt FROM browse_history ORDER BY visitedAt DESC LIMIT 75)).
**Depends On**: None | **Blocks**: None

### Priority 5: `database-missing-app-pool-8` (score 26)
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.4 | **Score**: 26
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioDatabase.kt`
**Description**: RadioDatabase builds the Room instance without configuring a connection pool or query executor; the default single-threaded executor is used for all DAO work while the repository dispatches many concurrent suspend queries (getQueueStations, batch UUID lookups, browse history writes). Under concurrent load these serialize on one connection.
**Remediation**: Configure Room's setQueryExecutor/setTransactionExecutor with a bounded thread pool sized to the expected concurrency, and document the chosen pool size relative to the app's query load.
**Depends On**: None | **Blocks**: None

### Priority 6: `database-missing-index-where-4` (score 19.5)
**Module**: database | **Severity**: medium | **Effort**: S | **Confidence**: 0.75 | **Score**: 19.5
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioDao.kt:25`
**Description**: The radio_stations table is queried and sorted by genre, isLiked, lastPlayedAt, displayOrder, source, cachedAt and streamUrl (e.g. 'SELECT * FROM radio_stations WHERE genre = :genre ORDER BY ...', 'WHERE streamUrl = :streamUrl', 'WHERE source = :source'), but the only index declared on the entity is on radioBrowserUuid. Every genre/source/streamUrl lookup and every ORDER BY on these columns forces a full table scan plus a sort.
**Remediation**: Add Room @Index annotations on RadioStation for the columns used in WHERE/ORDER BY clauses (genre, source, streamUrl, isLiked, lastPlayedAt, displayOrder, cachedAt) and bump the database version with a migration that creates the corresponding indexes.
**Depends On**: None | **Blocks**: None

### Priority 7: `github-issue-health-3` (score 19.25)
**Module**: github | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 19.25
**Location**: `CONTRIBUTING.md:9`
**Description**: No issue templates or pull-request template are referenced anywhere in the provided repository files, so bug reports and PRs arrive without the structured information (device, Android version, steps to reproduce) the project asks for.
**Remediation**: Add .github/ISSUE_TEMPLATE/bug_report.md, feature_request.md and a PULL_REQUEST_TEMPLATE.md capturing device, Android version, reproduction steps and test evidence.
**Depends On**: None | **Blocks**: None

### Priority 8: `code-exact-duplication-significant-2` (score 17.6)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 17.6
**Location**: `app/src/main/java/com/opensource/i2pradio/data/radioregistry/RadioRegistryClient.kt:27`
**Description**: buildHttpClient in RadioRegistryClient is a near-verbatim copy of buildHttpClient in RadioBrowserClient: identical SOCKS5_DNS placeholder resolver, identical force-Tor/force-custom-proxy branching, identical proxy-authenticator lambda and timeout handling. The two clients duplicate a substantial block of proxy-routing logic.
**Remediation**: Extract the shared proxy-aware OkHttpClient construction (DNS resolver, proxy selection, authenticator, timeouts) into one common helper used by both clients.
**Depends On**: None | **Blocks**: None

### Priority 9: `structure-high-coupling-2` (score 16.5)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 16.5
**Location**: `app/src/main/java/com/opensource/i2pradio/data/radioregistry/RadioRegistryClient.kt:7`
**Description**: RadioRegistryClient duplicates the same cross-layer coupling pattern: it imports com.opensource.i2pradio.ui.PreferencesHelper and TorManager and reads force-proxy preferences directly to construct its OkHttpClient, so the data layer is bound to UI preferences and global Tor state.
**Remediation**: Share a single injected ProxyConfigProvider between RadioBrowserClient and RadioRegistryClient instead of each client reading PreferencesHelper/TorManager directly.
**Depends On**: None | **Blocks**: None

### Priority 10: `structure-framework-leak-3` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `app/src/main/java/com/opensource/i2pradio/ui/RadioViewModel.kt:9`
**Description**: RadioViewModel leaks Android framework/service details into the presentation layer: it references RadioService action constants and extra keys, constructs Intents, and calls getApplication().startService, coupling the ViewModel to the concrete service implementation and its wire protocol.
**Remediation**: Hide service actions/extras behind a domain-level interface (e.g. PlaybackController) so the ViewModel does not depend on RadioService constants or Intent construction.
**Depends On**: None | **Blocks**: None

### Priority 11: `structure-low-cohesion-5` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `app/src/main/java/com/opensource/i2pradio/RadioService.kt`
**Description**: RadioService is a single class that simultaneously handles ExoPlayer playback, audio focus, media session/notification, stream recording to MediaStore, sleep timer, reconnect/network-callback logic, proxy configuration and repository access. These are unrelated responsibilities bundled into one service, indicating low cohesion.
**Remediation**: Split RadioService into focused collaborators (e.g. PlaybackController, RecordingController, SleepTimerController, ReconnectManager) coordinated by a thin service facade.
**Depends On**: None | **Blocks**: None

### Priority 12: `structure-service-orchestration-3` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `app/src/main/java/com/opensource/i2pradio/ui/RadioViewModel.kt`
**Description**: RadioViewModel performs service orchestration directly: it builds Intents with action strings and extras (ACTION_SWITCH_RECORDING_STREAM, ACTION_START_RECORDING, ACTION_STOP_RECORDING) and calls startService, and it also instantiates RadioRepository inline for syncCurrentStationById. The ViewModel is coordinating service commands rather than exposing state.
**Remediation**: Introduce a PlaybackCommandDispatcher/use-case layer that the ViewModel calls; keep Intent construction and service invocation out of the ViewModel.
**Depends On**: None | **Blocks**: None

### Priority 13: `structure-service-sql-5` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioRepository.kt:5`
**Description**: RadioRepository is a data-layer repository but it also embeds business/presentation logic: it reads user preferences (PreferencesHelper.arePresetsInitialized, setPresetsInitialized) and seeds bundled preset stations from JSON inside initializePresetStations, mixing persistence concerns with app configuration and seeding policy.
**Remediation**: Move preset seeding and preference checks out of RadioRepository into a dedicated startup/initializer component (e.g. a PresetInitializer invoked from I2PRadioApplication), leaving the repository responsible only for DAO access.
**Depends On**: None | **Blocks**: None

### Priority 14: `structure-singleton-violation-5` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `app/src/main/java/com/opensource/i2pradio/tor/TorManager.kt`
**Description**: TorManager is a global object singleton holding mutable connection state (_state, _socksPort, _httpPort, listeners, threads) that is read and mutated from many unrelated components (Application, MainActivity, RadioService, RadioBrowserClient, RadioRegistryClient, BrowseViewModel, TorService). Global mutable singleton state shared across layers makes dependencies implicit and hard to test.
**Remediation**: Convert TorManager into an injectable instance managed by a DI container or an application-scoped holder, exposing an interface so consumers depend on an abstraction rather than a global object.
**Depends On**: None | **Blocks**: None

### Priority 15: `structure-config-logic-8` (score 14.3)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 14.3
**Location**: `app/src/main/java/com/opensource/i2pradio/I2PRadioApplication.kt`
**Description**: I2PRadioApplication.onCreate embeds startup decision logic: it conditionally initializes TorManager, registers a state listener, and decides whether to auto-start TorService based on multiple preference checks and current TorManager state. Application bootstrap is carrying runtime configuration/branching logic.
**Remediation**: Move the Tor startup decision into a dedicated StartupCoordinator/TorBootstrapper class invoked from onCreate, so the Application class only wires components.
**Depends On**: None | **Blocks**: None

### Priority 16: `structure-repository-logic-4` (score 14.3)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 14.3
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioRepository.kt`
**Description**: RadioRepository contains non-CRUD decision logic: getStationsSorted/getStationsByGenreSorted/getQueueStations implement sort-order and genre-filter branching that maps UI sort semantics onto DAO queries, and setStationOrder loops over ids reassigning display positions. This is query-selection policy living in the repository rather than a dedicated query/spec layer.
**Remediation**: Extract the sort/filter mapping into a dedicated query-specification or use-case class (e.g. StationQueryBuilder) so the repository only executes the resulting DAO calls.
**Depends On**: None | **Blocks**: None

### Priority 17: `cost-gha-no-dependency-cache-5` (score 13.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 13.6
**Location**: `.github/workflows/build.yml:27`
**Description**: The build workflow runs `./gradlew assembleDebug --no-daemon` on every push and PR without any Gradle dependency/build cache step (no actions/cache, no gradle/actions/setup-gradle). Every run re-downloads all dependencies and recompiles from scratch, burning CI minutes and bandwidth on each commit.
**Remediation**: Add a caching step, e.g. use `gradle/actions/setup-gradle@v4` (or `actions/cache` keyed on `~/.gradle/caches` and `~/.gradle/wrapper` with a hash of the gradle files) before the build step, and drop `--no-daemon` so the Gradle daemon and caches are reused.
**Depends On**: None | **Blocks**: None

### Priority 18: `database-heavy-migration-5` (score 13)
**Module**: database | **Severity**: medium | **Effort**: L | **Confidence**: 0.5 | **Score**: 13
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioDatabase.kt:33`
**Description**: MIGRATION_9_10 runs 'UPDATE radio_stations SET displayOrder = id' over the entire table, and MIGRATION_1_2 runs 'UPDATE radio_stations SET proxyType = 'I2P' WHERE useProxy = 1'. These full-table UPDATEs execute inside the migration transaction on the main upgrade path and can be slow on large libraries, blocking app startup.
**Remediation**: Keep migrations minimal and idempotent: seed displayOrder lazily on first read instead of rewriting every row, or batch the UPDATE and document the expected runtime; ensure migrations run off the main thread during database open.
**Depends On**: None | **Blocks**: None

### Priority 19: `cost-gha-infinite-artifacts-6` (score 12.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 12.8
**Location**: `.github/workflows/test.yml:33`
**Description**: The test-results artifact is uploaded with `if: always()` and no `retention-days`, so every push and PR accumulates test reports under the default 90-day retention, growing storage cost indefinitely.
**Remediation**: Set `retention-days: 7` (or similar) on the `actions/upload-artifact` step and consider uploading only on failure to limit artifact storage growth.
**Depends On**: None | **Blocks**: None

### Priority 20: `cost-gha-no-timeout-9` (score 12.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 12.8
**Location**: `.github/workflows/build.yml:13`
**Description**: The `build` job defines no `timeout-minutes`, so a hung Gradle build (network stall, daemon deadlock) can occupy a runner for the default 360 minutes, consuming CI minutes and blocking the queue.
**Remediation**: Add `timeout-minutes: 20` (or an appropriate bound) to the `build` job so a stuck build is killed instead of running to the platform default.
**Depends On**: None | **Blocks**: None

### Priority 21: `cost-no-automated-tests-4` (score 12)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.3 | **Score**: 12
**Location**: `app/build.gradle.kts`
**Description**: The module declares test dependencies (JUnit, MockK, MockWebServer, coroutines-test) but the provided build configuration contains no coverage gate, no test task wiring beyond the default, and no performance/regression budget, so test cost/benefit is unmanaged.
**Remediation**: Add a coverage threshold (e.g. JaCoCo/Kover) and wire it into the CI test job so test investment is measured and regressions are caught early.
**Depends On**: None | **Blocks**: None

### Priority 22: `github-issue-health-1` (score 11.9)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 11.9
**Location**: `SECURITY.md:5`
**Description**: The supported-versions table lists only 1.6.x as supported, while the project is already at 1.8.1 (see app/build.gradle.kts versionName and CHANGELOG.md). Users on 1.7.x/1.8.x are told they are unsupported, so security fixes for current releases are not communicated.
**Remediation**: Update the supported-versions table in SECURITY.md to cover the current release line (e.g. 1.8.x) and state an explicit support window policy for older versions.
**Depends On**: None | **Blocks**: None

### Priority 23: `database-missing-bloat-monitoring-5` (score 10.4)
**Module**: database | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 10.4
**Location**: `app/src/main/java/com/opensource/i2pradio/data/RadioDao.kt`
**Description**: The radio_stations table accumulates RadioBrowser cache rows (source = 'RADIOBROWSER') that are only pruned by deleteStaleCachedStations with a caller-supplied timestamp, and there is no monitoring or scheduled vacuum/analyze of table growth. Unbounded cache growth degrades query performance over time.
**Remediation**: Add periodic maintenance that prunes stale cached stations on a schedule, runs ANALYZE/VACUUM when the table grows past a threshold, and logs table row counts so growth can be monitored.
**Depends On**: None | **Blocks**: None

### Priority 24: `cost-gha-high-usage-1` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `.github/workflows/trivy.yml:8`
**Description**: The Trivy workflow triggers on every push and pull request to main in addition to the weekly schedule, running a full filesystem vulnerability scan on each commit even though the scheduled run already covers drift.
**Remediation**: Restrict the Trivy scan to the weekly `schedule` plus `workflow_dispatch`, or gate the push/PR trigger with `paths` filters so it only runs when dependency manifests change.
**Depends On**: None | **Blocks**: None

### Priority 25: `github-commit-history-1` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `CHANGELOG.md:10`
**Description**: The changelog mixes release entries with unresolved issue references (e.g. '#442', '#' placeholders in the 1.8.1 section) and several entries end with a bare '#' marker, indicating incomplete changelog hygiene and unreferenced issue links.
**Remediation**: Replace the bare '#' markers with real issue/PR numbers or remove them, and ensure every referenced issue number resolves to an existing GitHub issue.
**Depends On**: None | **Blocks**: None

### Priority 26: `structure-dto-logic-7` (score 3.3)
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3.3
**Location**: `app/src/main/java/com/opensource/i2pradio/ui/StationActionHelper.kt`
**Description**: StationActionHelper.convertToRadioBrowserStation performs data mapping between RadioStation and RadioBrowserStation but hardcodes derived values (hls = false, lastcheckok = true, votes = 0, empty language fields) and forces non-null assertions on radioBrowserUuid, embedding conversion policy in a UI helper object.
**Remediation**: Move the RadioStation<->RadioBrowserStation mapping into the data layer (e.g. a mapper in the radiobrowser package) and handle missing UUIDs explicitly instead of using !! assertions.
**Depends On**: None | **Blocks**: None

### Priority 27: `cost-gha-expensive-runner-4` (score 1.6)
**Module**: cost | **Severity**: low | **Effort**: M | **Confidence**: 0.4 | **Score**: 1.6
**Location**: `.github/workflows/build.yml:14`
**Description**: The build job runs on `ubuntu-latest` with no matrix or runner-size tuning; combined with the uncached, no-daemon Gradle invocation this maximizes per-run compute cost for a single-module Android build.
**Remediation**: Cache Gradle dependencies, remove `--no-daemon`, and consider a smaller/cheaper runner or a single combined build+test job to reduce per-run compute.
**Depends On**: None | **Blocks**: None

### Priority 28: `github-issue-health-2` (score 0.42)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.6 | **Score**: 0.42
**Location**: `CONTRIBUTING.md:8`
**Description**: CONTRIBUTING.md documents bug reporting, feature requests and code style but contains no issue/PR triage guidance, no response-time expectations and no labels/templates guidance, so contributors have no visibility into how issues are handled.
**Remediation**: Add a short triage section to CONTRIBUTING.md describing expected response times, label usage and how issues are prioritized, and link to issue templates.
**Depends On**: None | **Blocks**: None

### Priority 29: `github-log-pattern-1` (score 0.28)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.4 | **Score**: 0.28
**Location**: `app/src/main/java/com/opensource/i2pradio/utils/DatabaseEncryptionManager.kt:3`
**Description**: The module logs through android.util.Log with a hardcoded tag and no structured logging or log-level configuration, so security-relevant events (database encryption enable/disable, key derivation failures) are not consistently recorded or filterable.
**Remediation**: Introduce a small logging facade with configurable levels and consistent tags, and log security-relevant lifecycle events (encryption enabled/disabled, migration success/failure) at appropriate levels.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `database-irreversible-migration-1`: Add explicit downgrade migrations or a documented recovery path, wrap each migration in a transaction, and add a pre-migration backup of the database file so a failed upgrade can be restored. (L)
- `database-missing-index-fk-1`: Declare @Entity(tableName = "browse_history", indices = [Index(value = ["radioBrowserUuid"]), Index(value = ["visitedAt"])]) on BrowseHistory so the index is part of the generated schema, and add a… (S)
- `structure-high-coupling-1`: Introduce a ProxyConfigProvider abstraction (interface) that supplies resolved proxy settings, inject it into RadioBrowserClient, and have the UI layer implement it over PreferencesHelper/TorManager. (L)
- `database-sequential-pagination-1`: Replace the OFFSET subquery with a keyset/seek approach, e.g. (S)
- `database-missing-app-pool-8`: Configure Room's setQueryExecutor/setTransactionExecutor with a bounded thread pool sized to the expected concurrency, and document the chosen pool size relative to the app's query load. (M)
- `database-missing-index-where-4`: Add Room @Index annotations on RadioStation for the columns used in WHERE/ORDER BY clauses (genre, source, streamUrl, isLiked, lastPlayedAt, displayOrder, cachedAt) and bump the database version… (S)
- `github-issue-health-3`: Add .github/ISSUE_TEMPLATE/bug_report.md, feature_request.md and a PULL_REQUEST_TEMPLATE.md capturing device, Android version, reproduction steps and test evidence. (M)
- `code-exact-duplication-significant-2`: Extract the shared proxy-aware OkHttpClient construction (DNS resolver, proxy selection, authenticator, timeouts) into one common helper used by both clients. (M)
- `structure-high-coupling-2`: Share a single injected ProxyConfigProvider between RadioBrowserClient and RadioRegistryClient instead of each client reading PreferencesHelper/TorManager directly. (M)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `structure-framework-leak-3`: Hide service actions/extras behind a domain-level interface (e.g. (M)
- `structure-low-cohesion-5`: Split RadioService into focused collaborators (e.g. (M)
- `structure-service-orchestration-3`: Introduce a PlaybackCommandDispatcher/use-case layer that the ViewModel calls; keep Intent construction and service invocation out of the ViewModel. (M)
- `structure-service-sql-5`: Move preset seeding and preference checks out of RadioRepository into a dedicated startup/initializer component (e.g. (M)
- `structure-singleton-violation-5`: Convert TorManager into an injectable instance managed by a DI container or an application-scoped holder, exposing an interface so consumers depend on an abstraction rather than a global object. (M)
- `structure-config-logic-8`: Move the Tor startup decision into a dedicated StartupCoordinator/TorBootstrapper class invoked from onCreate, so the Application class only wires components. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `structure-repository-logic-4`: Extract the sort/filter mapping into a dedicated query-specification or use-case class (e.g. (M)
- `cost-gha-no-dependency-cache-5`: Add a caching step, e.g. (M)
- `database-heavy-migration-5`: Keep migrations minimal and idempotent: seed displayOrder lazily on first read instead of rewriting every row, or batch the UPDATE and document the expected runtime; ensure migrations run off the… (L)
- `cost-gha-infinite-artifacts-6`: Set `retention-days: 7` (or similar) on the `actions/upload-artifact` step and consider uploading only on failure to limit artifact storage growth. (M)
- `cost-gha-no-timeout-9`: Add `timeout-minutes: 20` (or an appropriate bound) to the `build` job so a stuck build is killed instead of running to the platform default. (M)
- `cost-no-automated-tests-4`: Add a coverage threshold (e.g. (M)
- `github-issue-health-1`: Update the supported-versions table in SECURITY.md to cover the current release line (e.g. (M)
- `database-missing-bloat-monitoring-5`: Add periodic maintenance that prunes stale cached stations on a schedule, runs ANALYZE/VACUUM when the table grows past a threshold, and logs table row counts so growth can be monitored. (M)
- `cost-gha-high-usage-1`: Restrict the Trivy scan to the weekly `schedule` plus `workflow_dispatch`, or gate the push/PR trigger with `paths` filters so it only runs when dependency manifests change. (M)
- `github-commit-history-1`: Replace the bare '#' markers with real issue/PR numbers or remove them, and ensure every referenced issue number resolves to an existing GitHub issue. (M)
- `structure-dto-logic-7`: Move the RadioStation<->RadioBrowserStation mapping into the data layer (e.g. (S)
- `cost-gha-expensive-runner-4`: Cache Gradle dependencies, remove `--no-daemon`, and consider a smaller/cheaper runner or a single combined build+test job to reduce per-run compute. (M)
- `github-issue-health-2`: Add a short triage section to CONTRIBUTING.md describing expected response times, label usage and how issues are prioritized, and link to issue templates. (XS)
- `github-log-pattern-1`: Introduce a small logging facade with configurable levels and consistent tags, and log security-relevant lifecycle events (encryption enabled/disabled, migration success/failure) at appropriate… (XS)
**Total Effort**: XL

---

## Dependencies
- —

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
