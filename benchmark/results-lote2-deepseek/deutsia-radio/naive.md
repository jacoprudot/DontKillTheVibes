# Repository Review: deutsia-radio

Below are the concrete problems I found, grouped by category. I've focused on things that are actually wrong or risky rather than stylistic nits.

## 1. Build / Configuration

### 1.1 SDK and Java version mismatch across the project
- `app/build.gradle.kts` sets `compileSdk = 34`, `targetSdk = 34`, `sourceCompatibility = JavaVersion.VERSION_11`, `jvmTarget = "11"`.
- `.idea/compiler.xml` says `bytecodeTargetLevel target="21"`.
- `.idea/misc.xml` says `languageLevel="JDK_21"`, `project-jdk-name="jbr-21"`.
- CI (`.github/workflows/build.yml`, `test.yml`) sets up **JDK 17**.

Three different Java versions (11 / 17 / 21) are in play. The IDE config will not match what CI builds, and the Kotlin `jvmTarget = "11"` is inconsistent with the JDK 21 IDE setting. Pick one (17 is the safe choice for AGP 8.x) and align all of them.

### 1.2 `compileSdk = 34` is behind current Play requirements
As of 2024/2025, Google Play requires `targetSdk = 35` for new submissions and updates. `targetSdk = 34` will be rejected for new releases. Also `compileSdk = 34` is old relative to the dependency versions used (see below).

### 1.3 Dependency version skew
- `androidx.core:core-ktx:1.12.0` and `appcompat:1.6.1` are old, while `androidx.lifecycle:*:2.10.0`, `androidx.navigation:*:2.9.6`, `androidx.room:2.8.4`, `androidx.sqlite:sqlite-ktx:2.6.2` are very new. These newer artifacts generally require `compileSdk = 35` (some require 36). The build will likely fail or emit "dependency requires compileSdk 35" errors.
- `androidx.security:security-crypto:1.1.0-alpha06` is an **alpha** dependency shipped in a release build. `EncryptedSharedPreferences` has been deprecated by Google; using an alpha of a deprecated library is a maintenance and security concern.
- `net.zetetic:android-database-sqlcipher:4.5.4` is the old `android-database-sqlcipher` artifact. The maintained artifact is `net.zetetic:sqlcipher-android`. The old one is unmaintained and has known issues on newer NDK/ABI targets.

### 1.4 `kotlin-kapt` plugin applied but no Kotlin plugin version pinned
`app/build.gradle.kts` uses `id("org.jetbrains.kotlin.android")` and `id("kotlin-kapt")` without versions, relying on the root `build.gradle.kts` (not shown) or the version catalog `gradle/libs.versions.toml`. `.idea/kotlinc.xml` pins Kotlin 2.0.21, but the build files don't. If the root build doesn't pin it, this is fragile.

### 1.5 `signingConfigs` block is broken when `keystore.properties` is absent
```kotlin
signingConfigs {
    create("release") {
        if (keystorePropertiesFile.exists()) { ... }
    }
}
buildTypes {
    release {
        signingConfig = signingConfigs.getByName("release")
        ...
    }
}
```
If `keystore.properties` does not exist (the normal case for contributors and CI), the `release` signing config is created **empty**, and `release` build type still references it. `assembleRelease` will then fail with a confusing "Keystore file not set" error. The signing config should only be assigned when the properties file exists, or the release build type should be conditional.

### 1.6 `isMinifyEnabled = true` with a very thin ProGuard config
`proguard-rules.pro` keeps whole packages (`-keep class androidx.media3.** { *; }`, `-keep class coil.** { *; }`, `-keep class net.sqlcipher.** { *; }`). This largely defeats R8 shrinking for the largest dependencies. It's not a bug, but it undermines the stated goal of `isShrinkResources = true` / `isMinifyEnabled = true`.

### 1.7 `lint { disable += "NullSafeMutableLiveData" }`
Disabling a lint check globally rather than fixing the underlying issue. Worth investigating whether it's masking real nullability bugs.

### 1.8 `.idea/` files committed to the repository
The `.gitignore` ignores some `.idea` files but the repo still tracks `.idea/.name`, `.idea/compiler.xml`, `.idea/gradle.xml`, `.idea/kotlinc.xml`, `.idea/misc.xml`, `.idea/vcs.xml`, etc. These are user/machine-specific and cause churn. The standard practice is to ignore the whole `.idea/` directory (or at least all of it except a curated subset).

### 1.9 `gradle-wrapper.jar` committed
This is normal for Gradle projects, but note that `build.yml` validates the wrapper while `test.yml` does **not** run `gradle/actions/wrapper-validation`. Inconsistent hardening.

## 2. Android Manifest

### 2.1 `android:usesCleartextTraffic="true"` globally
```xml
android:usesCleartextTraffic="true"
```
This enables cleartext HTTP for the entire app. For a privacy-focused app that also talks to `.onion` and `.i2p` endpoints, this is arguably intentional for those hosts, but it also permits cleartext to **any** host, including clearnet. The correct approach is a `network_security_config.xml` that permits cleartext only for `127.0.0.1` (the local Tor/I2P proxy) and specific `.onion`/`.i2p` suffixes, and blocks it elsewhere.

### 2.2 `package="com.opensource.i2pradio"` in the manifest
The `package` attribute in `AndroidManifest.xml` is deprecated and ignored when `namespace` is set in `build.gradle.kts` (which it is). It should be removed to avoid confusion.

### 2.3 `READ_MEDIA_IMAGES` / `READ_MEDIA_AUDIO` without apparent use
These are declared but the app is a streaming radio player. If they're only used for importing playlists or cover art, that's fine, but they're broad permissions. `READ_MEDIA_AUDIO` in particular is a sensitive permission that Play will scrutinize. There's no `READ_MEDIA_VIDEO` but there is `READ_MEDIA_IMAGES` — verify each is actually needed.

### 2.4 `WRITE_EXTERNAL_STORAGE` with `maxSdkVersion="28"` but no `requestLegacyExternalStorage`
On API 29 (Android 10), `WRITE_EXTERNAL_STORAGE` is a no-op unless `android:requestLegacyExternalStorage="true"` is set. If the app writes recordings to external storage on API 29, this will silently fail. The `DashRecorder`/`HlsRecorder` classes suggest recordings are written somewhere — verify the storage strategy.

### 2.5 `DeutsiaMediaLibraryService` is `exported="true"` and `enabled="false"`
The comment explains the opt-in design, which is good. But `exported="true"` on a service that is toggled at runtime means that once enabled, **any** app on the device can bind to it. There's no `android:permission` guard. For a media library service this is usually acceptable (that's how Android Auto works), but it's worth noting.

### 2.6 `AuthenticationActivity` has `android:screenOrientation="portrait"`
This is a lint warning on large screens / foldables and is discouraged. Also, if the app supports landscape (there's a `layout-land/fragment_now_playing.xml`), forcing portrait only on the auth screen is inconsistent.

### 2.7 No `android:networkSecurityConfig` and no `android:dataExtractionRules` reference
`app/src/main/res/xml/data_extraction_rules.xml` and `backup_rules.xml` exist in the tree, but the manifest does not reference them (`android:dataExtractionRules` / `android:fullBackupContent`). They are dead files. `allowBackup="false"` is set, so `backup_rules.xml` is moot, but `dataExtractionRules` is still recommended for API 31+.

## 3. Security

### 3.1 Bundled station JSON contains hardcoded proxy assumptions
`bundled_stations.json`, `i2p_stations.json`, `tor_stations.json` hardcode `proxyHost: "127.0.0.1"` and ports `4444` (I2P HTTP proxy) and `9050` (Tor SOCKS). This is fine as a default, but:
- The I2P HTTP proxy port 4444 is the **HTTP** proxy, not the SOCKS proxy (4447). Streaming audio over the HTTP proxy works but is not the recommended path; the SOCKS proxy (4447) is. Verify which one the code actually uses.
- Tor's `9050` is the SOCKS port; `9051` is the control port. Correct, but the code must use SOCKS, not HTTP CONNECT, for `.onion` — verify in `TorManager`.

### 3.2 `coverArtUri` in `bundled_stations.json` points to clearnet hosts
```json
"coverArtUri": "https://i.ibb.co/6cDHCvDS/2025.png"
"coverArtUri": "http://cdn-profiles.tunein.com/s24948/images/logoq.jpg"
"coverArtUri": "https://mangoradio.de/wp-content/uploads/cropped-Logo-192x192.webp"
```
For a privacy-focused app, loading cover art from clearnet CDNs (imgbb, TuneIn, a station's own site) leaks the user's IP and the fact that they're using the app. The `SecureImageLoader` class exists, but these URLs will still be fetched from clearnet unless the loader routes them through Tor/I2P. At minimum, this is a privacy leak; at worst it's a de-anonymization vector for users who chose this app specifically to avoid it.

### 3.3 `i2p_stations.json` has a duplicate entry
`CoS Radio` appears twice (once near the top, once near the bottom) with identical `streamUrl`. This will produce duplicate rows in the UI.

### 3.4 `security-crypto:1.1.0-alpha06`
`EncryptedSharedPreferences` from this artifact has been deprecated and the alpha has known issues (e.g., key rotation bugs, crashes on some devices). For a security-focused app, shipping an alpha crypto library is a red flag. Consider migrating to the Jetpack `security-crypto-ktx` stable or a custom `EncryptedFile`/Keystore-based solution.

### 3.5 `PasswordEncryptionUtil` / `PasswordHashUtil` — cannot verify without source
The file names suggest custom crypto. Custom password hashing is a common source of vulnerabilities. The presence of `PasswordHashUtilTest` and `PasswordEncryptionUtilTest` is good, but I can't verify the algorithms from the file tree alone. If these implement their own PBKDF2/scrypt/Argon2 rather than using a vetted library, that's a concern. (The tests exist, which is a positive signal.)

### 3.6 `DigestAuthenticator` — HTTP Digest auth is weak
Digest auth is deprecated and vulnerable to MITM downgrade attacks. If this is used for station authentication, it should be replaced with HTTPS + Basic/Bearer over TLS, or at least documented as a fallback.

### 3.7 `usesCleartextTraffic="true"` + Digest auth + cleartext cover art
Combined, these mean the app can send credentials and fetch images over plain HTTP. See 2.1.

## 4. CI / Workflows

### 4.1 `test.yml` does not validate the Gradle wrapper
`build.yml` runs `gradle/actions/wrapper-validation`, but `test.yml` does not. A compromised wrapper would still be caught by `build.yml` on the same commit, but the inconsistency is unnecessary.

### 4.2 `test.yml` uploads test reports but not on failure only
`if: always()` is correct, but the artifact name `test-results` is not unique per run. On re-runs, artifacts collide. Use `${{ github.run_id }}` or similar.

### 4.3 `trivy.yml` scans the filesystem, not the built APK
`scan-type: 'fs'` with `scan-ref: '.'` scans source files and lockfiles. For an Android app, the more valuable scan is of the built APK/AAB (`scan-type: 'image'` or a dedicated APK scanner). The current scan will miss vulnerabilities in the compiled native libs (e.g., SQLCipher's `.so`).

### 4.4 `scorecard.yml` has `publish_results: true` but no `repo_token`
The Scorecard action requires `repo_token: ${{ secrets.GITHUB_TOKEN }}` when `publish_results: true` for private repos; for public repos it's optional but recommended. Without it, the publish step may fail or publish with reduced fidelity.

### 4.5 No `concurrency` block on any workflow
Multiple pushes to `main` will run overlapping builds/tests. Add:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4.6 `dependabot.yml` has no `groups`
Weekly Gradle updates with `open-pull-requests-limit: 5` will produce a lot of PRs. Grouping related dependencies (e.g., all `androidx.media3:*`) would reduce noise.

### 4.7 No release workflow
There's a `fastlane/metadata/android/en-US/` tree and `zapstore.yaml`, but no workflow that builds and signs a release AAB/APK. The `signingConfigs` block exists but is never exercised in CI. This means release builds are only done locally, which is a supply-chain risk.

## 5. Code-level issues (from the files shown)

### 5.1 `EqualizerManager.initialize` — resource leak on partial failure
```kotlin
return try {
    equalizer = Equalizer(0, audioSessionId).apply { ... }
    try { bassBoost = BassBoost(0, audioSessionId).apply { ... } } catch (e: Exception) { ... }
    try { virtualizer = Virtualizer(0, audioSessionId).apply { ... } } catch (e: Exception) { ... }
    ...
} catch (e: Exception) {
    equalizer = null
    false
}
```
If `BassBoost` or `Virtualizer` construction throws, the `equalizer` is still assigned and `currentAudioSessionId` is set, but the method returns `true` (the outer try succeeds). If the outer try fails after `equalizer` was created, `equalizer = null` is set **without calling `release()`** on the native `Equalizer` object. That's a native resource leak. The `release()` method exists (referenced elsewhere) but isn't called in the catch block.

### 5.2 `EqualizerManager` — `isInitialized()` returns true in preview mode
```kotlin
fun isInitialized(): Boolean = equalizer != null || isPreviewMode
```
Callers that check `isInitialized()` before calling `setBandLevel` etc. will proceed in preview mode, where `equalizer` is null. The `setBandLevel` implementation (truncated) must guard against null. This is a footgun; a separate `isPreviewMode()` accessor would be clearer.

### 5.3 `EqualizerManager` — `initializeForPreview` sets `isBassBoostSupported = true` unconditionally
```kotlin
isBassBoostSupported = true
isVirtualizerSupported = true
```
This lies to the UI: on a device that doesn't support BassBoost, the preview will show the control, the user will enable it, and then when playback starts the effect won't apply. The UI should reflect actual device capability, not preview optimism.

### 5.4 `EqualizerManager` — `FIXED_BAND_FREQUENCIES` hardcoded to 5 bands
```kotlin
val FIXED_BAND_FREQUENCIES = listOf(60, 230, 910, 3600, 14000)
```
The Android `Equalizer` typically exposes 5 bands, but the center frequencies vary by device. The code builds a `fixedToNativeBandMap` to map fixed bands to native bands, which is good, but the fixed frequencies (60/230/910/3600/14000) don't match the typical Android bands (which are often 60/230/910/3600/14000 on many devices, but not all). The mapping logic (truncated) needs to handle the case where the native band count is less than 5.

### 5.5 `AuthenticationActivity` — `isVerifying` flag is not thread-safe
```kotlin
private var isVerifying = false  // Prevent multiple verification attempts
```
This is a plain `Boolean` accessed from the main thread and possibly a coroutine. If verification is dispatched to `Dispatchers.IO` (which the imports suggest), the flag is not volatile and not atomic. Use `AtomicBoolean` or confine to the main thread.

### 5.6 `AuthenticationActivity` — `progressBar` is nullable but `lateinit` fields are not
```kotlin
private lateinit var passwordInputLayout: TextInputLayout
private lateinit var passwordInput: TextInputEditText
private lateinit var errorText: TextView
private lateinit var unlockButton: MaterialButton
private lateinit var biometricButton: MaterialButton
private var progressBar: LinearProgressIndicator? = null
```
Inconsistent nullability. If `progressBar` can be null (e.g., not present in some layout), the `lateinit` fields should also be nullable or the layout should guarantee their presence. The `activity_authentication.xml` layout is not shown, so this is a "verify" item.

### 5.7 `AuthenticationActivity` imports `FragmentActivity` but extends `AppCompatActivity`
```kotlin
import androidx.fragment.app.FragmentActivity
...
class AuthenticationActivity : AppCompatActivity()
```
`AppCompatActivity` already extends `FragmentActivity`. The import is unused. Minor, but indicates copy-paste.

### 5.8 `AuthenticationActivity` — no `onBackPressed` handling
If the user presses back on the auth screen, the default behavior finishes the activity and returns to whatever was underneath (possibly `MainActivity`). For an auth gate, back should either exit the app or be disabled. Not shown, but worth verifying.

### 5.9 `ExampleInstrumentedTest` is the default template
```kotlin
assertEquals("com.opensource.i2pradio", appContext.packageName)
```
This is the auto-generated test from Android Studio. It tests nothing about the app. Either delete it or replace it with a real instrumentation test.

### 5.10 `bundled_stations.json` — `proxyPort: 0` for non-proxied stations
```json
"useProxy": false,
"proxyType": "NONE",
"proxyHost": "",
"proxyPort": 0
```
This is fine, but the parser must handle `proxyPort: 0` and empty `proxyHost` without trying to connect. Verify `RadioStation` deserialization.

### 5.11 `bundled_stations.json` — `Lain Radio - Focus` has no `country`/`countryCode`
Inconsistent schema. The parser must treat these as optional. Same for `MANGORADIO` and `Aktuelle HITS 24/7`.

### 5.12 `i2p_stations.json` — `eQtv Ukrainian` uses a clearnet cover art URL
```json
"coverArtUri": "https://equalit.ie/wp-content/uploads/2025/06/2025.png"
```
Same privacy issue as 3.2.

### 5.13 `tor_stations.json` — only 4 stations, all with `proxyPort: 9050`
Tor's SOCKS port is 9050 by default, but Orbot uses 9050 for SOCKS and 8118 for HTTP. If the app is meant to work with Orbot, verify the port. Also, `TorManager`/`TorService` suggest the app bundles its own Tor, in which case 9050 is correct.

## 6. Documentation / Metadata

### 6.1 `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `PRIVACY_POLICY.md` exist but weren't shown
Cannot review content. However, the presence of `PRIVACY_POLICY.md` alongside `usesCleartextTraffic="true"` and clearnet cover art loading is worth cross-checking: does the policy disclose that cover art is fetched from third-party CDNs?

### 6.2 `fastlane/metadata/android/en-US/changelogs/` has `10605.txt`, `10700.txt`, `10701.txt`
But `versionCode = 10801` and `versionName = "1.8.1"`. The changelog files are for versions 1.6.5, 1.7.0, 1.7.1 — there's no changelog for 1.8.1. F-Droid will show an empty changelog for the current version.

### 6.3 `zapstore.yaml` exists but no corresponding CI
Zapstore is a decentralized app store. If the project publishes there, there should be a workflow that builds and signs the APK and publishes it. Not present.

### 6.4 `assets/` directory contains screenshots and SVGs
These are not referenced by the build. They're likely for the README. Consider moving to `docs/` or `fastlane/metadata/android/en-US/images/` to avoid confusion with `app/src/main/assets/`.

### 6.5 `assets/160731958(1).svg` — filename with parentheses and a space-like character
This will cause issues on some filesystems and in URLs. Rename.

### 6.6 `assets/5.PNG` — uppercase extension
Inconsistent with the other `.png` files. On case-sensitive filesystems (Linux CI), this matters if referenced.

## 7. Testing

### 7.1 Test coverage is concentrated in `security/` and `data/radiobrowser/`
There are no tests for:
- `RadioService` (the core playback service)
- `TorManager` / `I2PManager` (the privacy-critical components)
- `RadioDao` / `RadioDatabase` (persistence)
- `PlaylistResolver`
- `StationImportExport`
- `EqualizerManager`

For an app whose selling point is privacy, the lack of tests for the proxy managers is notable.

### 7.2 `README_TESTS.md` and `README_SECURITY_TESTS.md` inside `src/test/`
These are documentation files inside the test source tree. They won't be packaged (test sources aren't), but they're in an odd location. Move to `docs/` or the repo root.

### 7.3 `RadioBrowserServerManagerDnsLeakTest` — good, but is it run in CI?
`test.yml` runs `./gradlew testDebugUnitTest`. If the DNS leak test requires network access or a specific environment, it may be flaky or skipped. Verify it's not `@Ignore`d.

### 7.4 `unitTests { isReturnDefaultValues = true }`
This makes Android framework methods return default values (0, null, false) instead of throwing. It's a common workaround, but it can mask bugs where code relies on framework behavior. Tests that pass under this setting may fail on a real device.

## 8. Miscellaneous

### 8.1 `app/src/main/res/values/colors_*.xml` — 8 color theme files
`colors_blue.xml`, `colors_classic.xml`, `colors_green.xml`, `colors_material3.xml`, `colors_orange.xml`, `colors_peach.xml`, `colors_purple.xml`, `colors_red.xml`. This is a lot of duplication. Consider a single `colors.xml` with theme attributes, or a `ThemeOverlay` approach.

### 8.2 `values-night/themes.xml` exists but no `values-night/colors.xml`
If the color themes don't have night variants, dark mode may look wrong. Verify.

### 8.3 17 locale files
`values-ar`, `-de`, `-es`, `-fa`, `-fr`, `-hi`, `-it`, `-ja`, `-ko`, `-my`, `-pt`, `-ru`, `-tr`, `-uk`, `-vi`, `-zh`. That's a lot of translations to maintain. There's no `values-en` (default is `values/strings.xml`), which is correct. But there's no `values-b+sr+Latn` or similar for RTL/LTR variants. Also, `values-my` (Burmese) and `values-fa` (Persian) are RTL — verify the layouts handle RTL (`supportsRtl="true"` is set, good).

### 8.4 `app/src/main/res/layout-land/fragment_now_playing.xml` exists but no other `-land` layouts
Inconsistent landscape support. Either support landscape everywhere or nowhere.

### 8.5 `ic_invizible.xml` — typo in filename
Should be `ic_invisible.xml`. Minor, but it's a public resource name.

### 8.6 `app/src/main/res/drawable/ic_launcher_foreground.xml` and `ic_launcher_monochrome.xml`
The monochrome icon is for themed icons (Android 13+). Good. But `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` are the adaptive icon definitions — verify they reference the monochrome layer.

### 8.7 `gradle.properties` not shown
Cannot verify `org.gradle.jvmargs`, `android.useAndroidX=true`, `kotlin.code.style`, etc. If `android.useAndroidX` is missing, the build will fail. Given the dependencies, it's almost certainly set, but worth confirming.

### 8.8 `settings.gradle.kts` not shown
Cannot verify `pluginManagement` / `dependencyResolutionManagement` repositories. If `google()` and `mavenCentral()` are not declared, the build fails. Also, `repositoriesMode` should be `FAIL_ON_PROJECT_REPOS` for reproducibility.

### 8.9 `gradle/libs.versions.toml` exists but `app/build.gradle.kts` uses hardcoded versions
The version catalog is not used in `app/build.gradle.kts` — all versions are inline strings. Either use the catalog or delete it. Having both is confusing.

### 8.10 `LICENSE` not shown
Cannot verify the license. The `fastlane` metadata and `zapstore.yaml` suggest F-Droid distribution, which requires a FOSS license. Verify it's present and compatible.

## Summary of highest-priority items

1. **`usesCleartextTraffic="true"` globally** (2.1) — privacy/security issue for a privacy app.
2. **Clearnet cover art URLs in bundled station JSON** (3.2) — de-anonymization vector.
3. **`compileSdk = 34` / `targetSdk = 34`** (1.2) — Play Store rejection.
4. **Dependency version skew** (1.3) — likely build failures.
5. **Broken release signing config when `keystore.properties` is absent** (1.5) — CI/release breakage.
6. **Native resource leak in `EqualizerManager.initialize`** (5.1).
7. **Alpha `security-crypto` dependency** (3.4).
8. **No release workflow** (4.7) — supply-chain risk.
9. **Duplicate `CoS Radio` entry** (3.3).
10. **Java version mismatch across IDE/CI/build** (1.1).
