# Repository Review: obs-airplay

Below are the concrete problems I found, grouped by severity. Line references are to the files as shown.

---

## Critical / Correctness

### 1. `CMakeLists.txt` hardcodes a developer's personal Scoop path
```cmake
else()
    set(OPENSSL_DIR "C:/Users/kitti/scoop/apps/openssl/current")
endif()
```
This is a leftover from the author's machine. On any other machine without OpenSSL in the two standard locations, CMake will silently point at a nonexistent directory and fail later with a confusing error. It should be removed or replaced with a proper `find_package(OpenSSL)`.

### 2. `CMakeLists.txt` is Windows-only despite `build.sh` claiming Linux/macOS support
- `target_compile_definitions(... WIN32 ...)`
- `target_link_libraries(... ws2_32 iphlpapi ${DEPS_DIR}/w32-pthreads.lib)`
- `install(TARGETS ... DESTINATION $ENV{PROGRAMDATA}/...)`
- Hardcoded `.lib` paths for UxPlay, libplist, obs, w32-pthreads

`build.sh` advertises Ubuntu/macOS builds with `libobs-dev`, `libavcodec-dev`, etc., but the CMake project cannot possibly configure on those platforms. Either the script is misleading or the CMake needs real platform branching. As written, `build.sh` is dead code.

### 3. `install.bat` uses a wildcard in `copy`, which does not expand
```bat
copy /y "%SCRIPT_DIR%libcrypto-*.dll" "%PLUGIN_DIR%\" >nul
```
`copy` does not glob. This will fail with "The system cannot find the file specified" unless a literal file named `libcrypto-*.dll` exists. Should be a `for %%F in (libcrypto-*.dll) do copy ...` loop like the FFmpeg block above it.

### 4. `installer.iss` `[Files]` wildcard is fine, but `[Run]` firewall rules are not idempotent
The `[Run]` section adds firewall rules unconditionally. Re-running the installer (upgrade) will create duplicate rules or fail. `install.bat` correctly deletes first; the Inno Setup script does not. Add a `delete rule` before each `add rule`, or use `Flags: runhidden; Check:` to skip if present.

### 5. `installer.iss` `FindOBSPluginDir` is a no-op
```pascal
if RegQueryStringValue(HKLM, 'SOFTWARE\OBS Studio', '', InstallPath) then
begin
  Result := ExpandConstant('{commonappdata}') + '\obs-studio\plugins\obs-airplay-receiver';
  Exit;
end;
```
Every branch returns the same string. The registry lookup and `DirExists` check accomplish nothing. Either use `InstallPath` to derive the plugin dir, or delete the function.

### 6. `installer.iss` `[UninstallDelete]` deletes `{app}` recursively
```pascal
Type: filesandordirs; Name: "{app}"
```
`{app}` is `{commonappdata}\obs-studio\plugins\obs-airplay-receiver`. That's the plugin's own directory, so it's OK — but combined with `[Files]` copying `README.md` into `{app}` (not `{app}\bin\64bit`), and the fact that `{commonappdata}\obs-studio\plugins` is shared with other plugins, this is fragile. If a user ever changes `DefaultDirName` to `{commonappdata}\obs-studio\plugins`, the uninstaller wipes every other plugin. At minimum, guard the delete.

### 7. `airplay-source.c` — `srand()` called on every MAC generation
```c
static void generate_random_mac(char *mac, size_t len)
{
    srand((unsigned)(time(NULL) * getpid()));
    ...
}
```
`srand` is not thread-safe and reseeding with `time(NULL)` means two calls in the same second produce identical MACs. If the source is recreated quickly (e.g. user toggles the source), the AirPlay receiver will advertise the same MAC and clients may refuse to reconnect. Use a proper CSPRNG or seed once.

### 8. `airplay-source.c` — `parse_hw_addr` has no validation
```c
for (size_t i = 0; i < strlen(str) && *hw_len < 6; i += 3) {
    hw[(*hw_len)++] = (char)strtol(str + i, NULL, 16);
}
```
- `strlen(str)` is recomputed every iteration (O(n²), minor).
- No check that `str` is non-NULL.
- No check that the parsed value fits in a byte; `strtol` can return >255 and it's silently truncated.
- If `str` is shorter than expected, `*hw_len` ends up < 6 and the caller has no way to know.

### 9. `airplay-source.c` — `map_timestamp` re-anchor logic can produce non-monotonic timestamps
```c
if (timestamp_diff(mapped, now) > MAX_TIMESTAMP_DRIFT_NS) {
    ctx->remote_timestamp_anchor = remote_ts;
    ctx->local_timestamp_anchor = now;
    mapped = now;
}
```
When a re-anchor fires, `mapped` jumps to `now`, which can be *earlier* than the previously emitted timestamp. OBS's video pipeline assumes monotonic timestamps; a backwards jump can cause frames to be dropped or the source to stall. The re-anchor should clamp to at least the last emitted timestamp.

### 10. `airplay-source.c` — `cb_conn_destroy` decrements without a matching increment guarantee
```c
LONG open = InterlockedDecrement(&ctx->open_connections);
if (open < 0) {
    InterlockedExchange(&ctx->open_connections, 0);
    open = 0;
}
```
The `InterlockedExchange` after the decrement is racy: another thread can increment between the decrement and the exchange, and the exchange will clobber it. Use `InterlockedCompareExchange` in a loop, or just don't clamp (the `< 0` case indicates a real bug worth logging).

### 11. `airplay-source.c` — `video_frame_count` is not atomic
```c
int video_frame_count;
...
if (ctx->video_frame_count < 5) { ... }
ctx->video_frame_count++;
```
`cb_video_process` is called from UxPlay's thread, but the field is also read in the same function only — however, it's reset nowhere on reconnect, and it's a plain `int` accessed under `video_mutex` in one place but the initial read is outside any lock in some paths. More importantly, it's never reset in `cb_conn_init`, so the "first 5 frames" logging only ever fires once per source lifetime, not per connection. Minor, but the intent is clearly per-connection.

### 12. `airplay-source.c` — `obs_source_output_video` called with stack-allocated `obs_source_frame`
```c
struct obs_source_frame obs_frame = {0};
...
obs_source_output_video(ctx->source, &obs_frame);
```
OBS copies the frame data synchronously for `obs_source_output_video`, so this is technically OK, but the `data[0]` pointer points into `frame.data[0]` which is owned by the decoder. If `video_decoder_decode` reuses its internal buffer on the next call (very likely), and OBS holds a reference asynchronously (it does for async sources), you get a use-after-free / tearing. The decoder's buffer lifetime contract needs to be explicit, and the frame should be copied or the decoder should hand off ownership.

### 13. `airplay-source.c` — `frame.pts` used as `obs_frame.timestamp` without unit conversion
```c
obs_frame.timestamp = frame.pts > 0 ? (uint64_t)frame.pts : timestamp;
```
`timestamp` is nanoseconds from `os_gettime_ns()`. `frame.pts` is whatever the decoder produces (likely microseconds or a raw FFmpeg timebase). Mixing the two in the same field will cause wildly wrong timing. Either always use `timestamp` or convert `pts` to ns consistently.

### 14. `airplay-source.c` — `MAX_VIDEO_PACKET_SIZE` is 32 MB, allocated per packet?
Not shown in the excerpt, but `MAX_VIDEO_PACKET_SIZE (32 * 1024 * 1024)` as a sanity bound on `data_len` is fine; if it's also used as a buffer size somewhere, that's a 32 MB allocation per frame. Worth verifying in `video-decoder.c`.

### 15. `airplay-source.c` — `warned_h265` is never reset
Once H.265 is seen, the warning is suppressed forever, even across reconnects. Same pattern as `video_frame_count`. Minor, but the flags should be reset in `cb_conn_init`.

---

## Build / CI

### 16. `.github/workflows/build.yml` — `choco install openssl` is unpinned
```yaml
run: choco install openssl -y --no-progress
```
OpenSSL 3.x vs 4.x will break the build. Pin a version (`--version=3.3.2`) or use a known-good source.

### 17. `.github/workflows/build.yml` — `curl -L` without `--fail`
```yaml
curl -L -o deps/obs-sdk.zip "https://github.com/..."
```
If GitHub returns a 404 HTML page, `curl` exits 0 and the zip is garbage. Add `--fail --retry 3`.

### 18. `.github/workflows/build.yml` — `unzip -q` without checking
Same issue: `unzip` on a corrupt file returns non-zero, but the script continues because there's no `set -e` in the bash steps. Add `set -euo pipefail` to each `shell: bash` step.

### 19. `.github/workflows/build.yml` — `mv deps/ffmpeg7-extract/ffmpeg-* deps/ffmpeg7-runtime`
If the glob matches multiple directories (it won't today, but could if the archive layout changes), `mv` fails. Also, `mv` of a directory into a non-existent target renames it; if `deps/ffmpeg7-runtime` already exists from a cache, behavior differs. Use `mv deps/ffmpeg7-extract/ffmpeg-* deps/ffmpeg7-runtime` only after `rm -rf deps/ffmpeg7-runtime`.

### 20. `.github/workflows/build.yml` — `sed -i` patches to UxPlay are fragile
```bash
sed -i 's/#include <ws2tcpip.h>/#include <winsock2.h>\n#include <ws2tcpip.h>/' "$UXLIB/compat.h"
sed -i '/#ifndef snprintf/,/#endif/d' "$UXLIB/compat.h"
```
These depend on exact upstream text. A UxPlay patch bump (the workflow pins `v1.73.6`, good) will silently no-op if the text changes, producing a broken build with no error. Add `grep -q` assertions after each `sed`.

### 21. `.github/workflows/build.yml` — `lib /def:...` requires MSVC env
The `shell: cmd` steps rely on `ilammy/msvc-dev-cmd` having set up the environment. That's fine, but the `lib` command is not on PATH in a plain `cmd` shell; if the action's env doesn't propagate to `cmd` steps (it does, but it's implicit), this breaks. Worth a comment.

### 22. `.github/workflows/build.yml` — no artifact upload
The workflow builds but never uploads the DLL or the installer. The README references a Releases page with a `.zip`; nothing in CI produces it. Either add `actions/upload-artifact` or document that releases are manual.

### 23. `.github/workflows/build.yml` — no caching
Every run re-downloads OBS SDK (~100 MB), FFmpeg, libplist, and rebuilds libplist from source. Add `actions/cache` keyed on the dependency versions.

### 24. `.github/workflows/build.yml` — `deps/` is in `.gitignore` but the workflow writes to it
That's fine for CI, but it means a local `git clean -fdx` nukes the deps and the README's manual steps must be re-run. Document this.

### 25. `CMakeLists.txt` — `find_library` fallback ignores `OPENSSL_DIR`
```cmake
if(NOT OPENSSL_CRYPTO_LIB)
    find_library(OPENSSL_CRYPTO_LIB NAMES libcrypto crypto)
endif()
```
The fallback searches default paths, which on Windows will find nothing or the wrong thing. If the first search fails, the build should fail with a clear message, not silently pick up a system libcrypto.

### 26. `CMakeLists.txt` — `install(TARGETS ... DESTINATION $ENV{PROGRAMDATA}/...)`
If `PROGRAMDATA` is unset (rare, but possible in some CI containers), this expands to `/obs-studio/...`. Use `if(DEFINED ENV{PROGRAMDATA})` guard or `CMAKE_INSTALL_PREFIX`.

### 27. `CMakeLists.txt` — `target_link_libraries` with hardcoded `.lib` paths
```cmake
${UXPLAY_BUILD_DIR}/airplay.lib
${UXPLAY_BUILD_DIR}/playfair.lib
${UXPLAY_BUILD_DIR}/llhttp.lib
${LIBPLIST_DIR}/build/plist.lib
${DEPS_DIR}/obs.lib
${DEPS_DIR}/w32-pthreads.lib
```
These bypass CMake's dependency tracking. If the libs are rebuilt, the plugin won't relink. Use `add_library(... IMPORTED)` or `find_library` with `PATHS`.

### 28. `CMakeLists.txt` — `project(... LANGUAGES C)` but libplist is built as C/CXX
The top-level project declares only C. The libplist sub-build (in CI) declares `C CXX`. Not a bug per se, but if anyone tries to `add_subdirectory` libplist, it'll fail.

### 29. `CMakeLists.txt` — `OBS_SDK_VERSION` cache variable but `OBS_SRC_DIR` uses it
```cmake
set(OBS_SDK_VERSION "30.0.0" CACHE STRING "Oldest supported OBS SDK")
set(OBS_SRC_DIR "${DEPS_DIR}/obs-sdk/obs-studio-${OBS_SDK_VERSION}" CACHE PATH ...)
```
If a user overrides `OBS_SDK_VERSION` on the command line, `OBS_SRC_DIR` is already cached from a previous configure and won't update. Classic CMake cache bug. Use `set(... CACHE ... FORCE)` or compute `OBS_SRC_DIR` without caching.

### 30. `CMakeLists.txt` — `PREFIX ""` on a MODULE library
On Windows this is a no-op, but on other platforms it would produce `obs-airplay-receiver.dll` instead of `libobs-airplay-receiver.so`. Since the project is Windows-only, fine — but combined with the misleading `build.sh`, it's another sign the cross-platform story is aspirational.

---

## Code Quality / Robustness

### 31. `airplay-source.c` — `is_stopping` uses `InterlockedCompareExchange` as a read
```c
return !ctx || InterlockedCompareExchange(&ctx->stopping, 0, 0) != 0;
```
This works but is obscure. `InterlockedCompareExchange` with `(0,0)` is a full memory barrier; a plain `volatile LONG` read would suffice for a flag. More importantly, `stopping` is `volatile LONG` but written with `InterlockedExchange` elsewhere — mixing volatile and interlocked access is a code smell.

### 32. `airplay-source.c` — `cb_conn_teardown` logs but does nothing
```c
static void cb_conn_teardown(void *cls, bool *t96, bool *t110)
{
    (void)cls;
    if (!t96 || !t110) return;
    blog(...);
}
```
The `t96`/`t110` out-params are presumably meant to be set by the callback to tell UxPlay whether to tear down audio/video. Leaving them untouched means UxPlay uses whatever defaults it initialized them to. If the intent is "tear down both", this should set `*t96 = true; *t110 = true;`. As written, the callback is a no-op that may cause UxPlay to hang waiting for a decision.

### 33. `airplay-source.c` — `cb_conn_feedback` is empty
```c
static void cb_conn_feedback(void *cls) { (void)cls; }
```
Fine if UxPlay doesn't need a response, but worth a comment explaining why.

### 34. `airplay-source.c` — `cb_video_pause` / `cb_video_resume` are empty
Same as above. If these are supposed to pause/resume the decoder, they're broken. If not, comment why.

### 35. `airplay-source.c` — `audio_output_logged`, `warned_no_adec`, `warned_audio_ct` are declared but their use isn't shown
Likely fine, but the pattern of "warn once" flags that are never reset on reconnect (see #15) suggests the same bug applies to all of them.

### 36. `airplay-source.c` — `MAX_AUDIO_FRAMES_PER_PACKET 8192` and `MAX_AUDIO_PACKET_SIZE (1024*1024)`
These are sanity bounds; if they're used to size stack buffers, 8192 frames × 4 bytes = 32 KB on the stack, which is fine, but worth confirming in `audio-decoder.c`.

### 37. `airplay-source.c` — `#define getpid _getpid` after including `<process.h>`
`_getpid` is declared in `<process.h>`, so this is fine, but the `#define` is placed after the include block and before use — fragile if the file is reordered. Use `_getpid` directly.

### 38. `airplay-source.c` — `srand`/`rand` for MAC generation
Covered in #7. Also, `rand() % 256` has modulo bias (negligible for a MAC, but a reviewer should note it).

### 39. `airplay-source.c` — `parse_hw_addr` writes into `hw` without bounds on `hw`'s actual size
The caller passes a buffer and `hw_len` is capped at 6, so it's safe if the caller always passes a 6-byte buffer. But the function signature doesn't enforce this. Add a `size_t hw_cap` parameter.

### 40. `airplay-source.c` — `blog(LOG_INFO, "[AirPlay] video_process: ... ntp=%llu", ...)` uses `%llu` for `uint64_t`
On MSVC, `uint64_t` is `unsigned long long`, so `%llu` is correct. On other platforms it may be `unsigned long`. Since the project is Windows-only, fine, but use `PRIu64` for portability.

### 41. `airplay-source.c` — `obs_frame.timestamp = frame.pts > 0 ? (uint64_t)frame.pts : timestamp;`
`frame.pts` is likely `int64_t`; comparing `> 0` and casting to `uint64_t` is fine, but see #13 for the unit mismatch.

### 42. `airplay-source.c` — `InterlockedExchange(&ctx->width, frame.width)` after `obs_source_output_video`
The width/height are updated *after* the frame is output. If OBS reads `ctx->width` during the output call (it doesn't, but a future change might), there's a race. Update before output.

### 43. `airplay-source.c` — `video_mutex` held during `obs_source_output_video`
```c
pthread_mutex_lock(&ctx->video_mutex);
...
obs_source_output_video(ctx->source, &obs_frame);
...
pthread_mutex_unlock(&ctx->video_mutex);
```
`obs_source_output_video` can block (it takes OBS's internal locks). Holding `video_mutex` across it means the decoder thread can't be torn down while OBS is processing. This is a potential deadlock if OBS's video thread ever calls back into the plugin. Move the output outside the lock, or copy the frame first.

### 44. `airplay-source.c` — `reset_timestamp_mapper` called from `cb_conn_init` without holding `timestamp_mutex` during the check
```c
if (open == 1)
    reset_timestamp_mapper(ctx);
```
`reset_timestamp_mapper` takes the mutex internally, so this is fine. But `open == 1` is checked after `InterlockedIncrement`, so if two connections race, both could see `open == 1`? No — `InterlockedIncrement` returns unique values. OK.

### 45. `airplay-source.c` — `cb_conn_destroy` calls `obs_source_output_video(ctx->source, NULL)` without checking `ctx->source`
If `ctx->source` is NULL (during teardown), this crashes. `is_stopping` checks `ctx` but not `ctx->source`.

### 46. `airplay-source.c` — `cb_conn_reset` same issue
```c
obs_source_output_video(ctx->source, NULL);
```
No NULL check on `ctx->source`.

### 47. `airplay-source.c` — `cb_video_process` checks `!ctx->video_mutex_ready` but not `!ctx->source`
Same pattern.

### 48. `airplay-source.c` — `MAX_TIMESTAMP_DRIFT_NS 3000000000ULL` (3 seconds)
A 3-second drift tolerance is very loose for a real-time video pipeline. If the remote clock is off by 2 seconds, the plugin will happily emit frames with 2-second-old timestamps, causing OBS to buffer or drop. Consider tightening to ~100 ms and re-anchoring more aggressively.

### 49. `airplay-source.c` — `#include <time.h>` and `#include <pthread.h>` at the top, but `pthread.h` is only available via w32-pthreads on Windows
The include order matters: `<winsock2.h>` must come before `<windows.h>` to avoid winsock 1.1 conflicts. The file includes `<winsock2.h>` then `<windows.h>` in the `#ifdef _WIN32` block, which is correct, but `<pthread.h>` is included *before* that block. If w32-pthreads' `pthread.h` pulls in `<windows.h>`, the winsock ordering is broken. Move the `#ifdef _WIN32` block above the `pthread.h` include.

### 50. `airplay-source.c` — `#include <stdlib.h>` for `srand`/`rand`/`strtol`, `<string.h>` for `strlen`
Fine, but `strtol` needs `<stdlib.h>` (present) and `snprintf` needs `<stdio.h>` (not included). On MSVC, `snprintf` is in `<stdio.h>`; the file may compile due to transitive includes, but it's not guaranteed. Add `<stdio.h>`.

---

## Documentation / Metadata

### 51. `README.md` — firewall instructions contradict the installers
README says:
> - **TCP port 7000** (AirPlay)
> - **UDP port 5353** (mDNS/Bonjour)

But `install.bat` and `installer.iss` open:
- UDP 6000-6001, 7011
- TCP 7000, 7100

The README omits 6000, 6001, 7011, and 7100, and includes 5353 which the installers don't open. Users following the README will have broken audio and mirroring.

### 52. `README.md` — "Clone with submodules" but there are no submodules
```bash
git clone --recursive https://github.com/aomkoyo/obs-airplay-receiver.git
```
The repo has no `.gitmodules` and the CI clones UxPlay manually. The `--recursive` flag is misleading.

### 53. `README.md` — build steps reference `deps/uxplay-build` which is never created
Step 5 says:
```bat
cd deps\uxplay-build
mkdir build && cd build
cmake .. -G "NMake Makefiles" ...
```
But nothing in the README or CI creates `deps/uxplay-build` or its `CMakeLists.txt`. The CI clones UxPlay to `deps/UxPlay` and patches it, but the README's manual steps don't match. A user following the README cannot build.

### 54. `README.md` — "Built entirely with Claude Code" is prominent but the license is LGPL-2.1
The project links UxPlay (LGPL-2.1) statically. LGPL requires that users be able to relink with a modified UxPlay. Shipping a static `.lib` of UxPlay inside a proprietary-ish plugin without providing object files or a relink mechanism may violate LGPL §6. The README should clarify compliance (e.g., provide the UxPlay source and build scripts, which it does, but the static linking story needs a note).

### 55. `README.md` — version mismatch
`CMakeLists.txt` says `VERSION 2.2.0`, `installer.iss` says `AppVersion=2.2.0`, `OutputBaseFilename=...v2.2.0`. Consistent. But the README's badge points to `aomkoyo/obs-airplay-receiver` while the repo is `obs-airplay`. Minor, but the URLs in README (`github.com/aomkoyo/obs-airplay-receiver`) don't match the repo name given in the prompt.

### 56. `LICENSE` — LGPL-2.1 text is truncated
The file contains only the preamble and the first paragraph. The full LGPL-2.1 is ~500 lines. As shipped, the license is not actually the LGPL-2.1; it's a fragment. This is a legal problem: the project claims LGPL-2.1 but doesn't include the license text.

### 57. `.gitignore` — `deps/` is ignored, but `build.sh` and `build.bat` assume `deps/` exists
A fresh clone has no `deps/`, and the README's manual steps are the only way to populate it. That's fine, but the `.gitignore` also ignores `*.lib`, which means if someone commits a prebuilt `deps/obs.lib`, it's silently ignored. Not a bug, but worth noting.

### 58. `.gitignore` — `Makefile` is ignored
This will ignore any `Makefile` a user creates, including ones they might want to commit. Usually you'd ignore `Makefile` only in the build dir. Minor.

### 59. `build.bat` — `set FFMPEG_CMAKE=` inside an `if` block
```bat
if defined FFMPEG_ROOT (
    set FFMPEG_CMAKE=-DFFMPEG_ROOT="%FFMPEG_ROOT%"
) else (
    set FFMPEG_CMAKE=
)
```
In batch, `set` inside a parenthesized block without `setlocal enabledelayedexpansion` can behave unexpectedly if the variable is read in the same block. Here it's read later, so it works, but it's fragile. Also, `%FFMPEG_ROOT%` is expanded at parse time, so if the user sets it after the `if`, it won't be picked up. Use `setlocal enabledelayedexpansion` and `!FFMPEG_ROOT!`.

### 60. `build.bat` — no `setlocal`
Without `setlocal`, the script pollutes the caller's environment with `FFMPEG_CMAKE`, `OPENSSL_CMAKE`, etc. Add `setlocal` at the top.

### 61. `build.bat` — `cmake .. -G "Visual Studio 17 2022"` hardcodes VS 2022
The README says VS 2019 or 2022. The script only works with 2022. Either detect the generator or document the requirement.

### 62. `build.sh` — `-j$(nproc ...)` on macOS
`nproc` doesn't exist on macOS; the fallback `sysctl -n hw.ncpu` handles it. But `nproc 2>/dev/null` on macOS prints nothing and returns non-zero, so the `||` chain works. OK.

### 63. `build.sh` — `cmake --build . --config "$BUILD_TYPE"` on Linux
`--config` is ignored by Makefile generators. Harmless, but misleading.

### 64. `build.sh` — no `set -u` or `set -o pipefail`
Only `set -e`. A typo in a variable name silently expands to empty. Add `set -euo pipefail`.

### 65. `build.sh` — `${OBS_DIR:+-DOBS_DIR="$OBS_DIR"}` unquoted
If `OBS_DIR` contains spaces, this breaks. Quote it: `${OBS_DIR:+-DOBS_DIR="$OBS_DIR"}` is actually fine because the whole expansion is one word, but the inner quotes are literal. Use an array.

### 66. `install.bat` — `netsh` rules use `localport=6000-6001,7011`
`netsh` accepts comma-separated ports and ranges, but the syntax `6000-6001,7011` is valid. However, the rule name is deleted first with `>nul 2>&1`, which hides errors. If the delete fails (e.g., rule doesn't exist), the add may still succeed. Fine, but the `2>&1` hides real errors.

### 67. `install.bat` — no check for admin privileges
The script says "Run as Administrator" but doesn't verify. If run without admin, `mkdir` in `%PROGRAMDATA%` fails and the error message is generic. Add a `net session` check.

### 68. `install.bat` — `pause` at the end
Fine for interactive use, but if the script is called from CI or another script, it hangs. Add a `--no-pause` flag or check `%CI%`.

### 69. `installer.iss` — `PrivilegesRequired=admin` but `[Run]` netsh commands don't use `runascurrentuser`
Since the installer runs as admin, netsh runs as admin. Fine. But if the user later uninstalls without admin, `[UninstallRun]` netsh will fail silently. Add `Flags: runhidden; RunOnceId: ...` (already there) and consider `runasoriginaluser` for the delete.

### 70. `installer.iss` — `[Files]` copies `README.md` to `{app}` but `[UninstallDelete]` deletes `{app}`
Consistent, but the README is installed to `{commonappdata}\obs-studio\plugins\obs-airplay-receiver\README.md`, which is an odd place for a README. Users won't find it. Install to `{app}\..\..\..\..\..\README` or just don't install it.

### 71. `installer.iss` — `AppPublisherURL` points to `aomkoyo/obs-airplay-receiver`
Same URL mismatch as #55.

### 72. `installer.iss` — `OutputDir=.`
The installer is written to the repo root. Combined with `.gitignore` not ignoring `*.exe`, this could accidentally be committed. Add `Output/OBS-AirPlay-Receiver-Setup-*.exe` to `.gitignore`.

### 73. `installer.iss` — no `[Icons]` or `[Tasks]`
Fine for a plugin, but no desktop shortcut or start menu entry. Expected for a plugin, so not a bug.

### 74. `installer.iss` — `DisableProgramGroupPage=yes` but no `[Icons]`
Consistent.

### 75. `installer.iss` — `WizardStyle=modern` requires Inno Setup 6+
Not documented. Add a comment or a `MinVersion`.

---

## Security

### 76. `airplay-source.c` — `srand`/`rand` for MAC generation is not cryptographically secure
AirPlay pairing uses the MAC as part of the device identity. A predictable MAC could allow an attacker on the LAN to impersonate the receiver. Use `BCryptGenRandom` on Windows.

### 77. `airplay-source.c` — `parse_hw_addr` uses `strtol` without error checking
If the input is `"zz:zz:zz:zz:zz:zz"`, `strtol` returns 0 and the MAC becomes all zeros. Not a security issue per se, but it means a malformed setting silently produces a valid-looking MAC.

### 78. `.github/workflows/build.yml` — downloads binaries from GitHub releases without checksum verification
```yaml
curl -L -o deps/ffmpeg7-shared.zip "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/..."
```
`latest` is a moving target and there's no SHA256 check. A compromised release would be built into the plugin. Pin a specific release and verify the hash.

### 79. `.github/workflows/build.yml` — `choco install openssl` runs arbitrary code from Chocolatey
Chocolatey packages are community-maintained. Pin a version and verify the hash, or use the official OpenSSL installer.

### 80. `install.bat` / `installer.iss` — firewall rules open ports to all profiles
`netsh advfirewall firewall add rule ... dir=in action=allow` without `profile=private` opens the ports on public networks too. On a laptop connected to a coffee shop Wi-Fi, the AirPlay receiver is exposed. Add `profile=private,domain`.

### 81. `install.bat` — `copy /y "%SCRIPT_DIR%libcrypto-*.dll"` (see #3) means the OpenSSL DLL is never copied, so the plugin fails to load with a missing-DLL error. This is a functional bug, but it also means users may be tempted to copy a random `libcrypto` from the internet, which is a security risk.

---

## Summary of the most impactful issues

| # | Issue | Impact |
|---|-------|--------|
| 1 | Hardcoded `C:/Users/kitti/...` OpenSSL path | Build fails on any other machine |
| 2 | CMake is Windows-only but `build.sh` claims Linux/macOS | Misleading; script is dead code |
| 3 | `copy libcrypto-*.dll` wildcard doesn't expand | Plugin fails to load after `install.bat` |
| 7 | `srand(time(NULL))` per MAC | Duplicate MACs on quick reconnect |
| 9 | Timestamp re-anchor can go backwards | OBS drops/stalls frames |
| 12 | `obs_source_output_video` with decoder-owned buffer | Use-after-free / tearing |
| 13 | `frame.pts` mixed with ns timestamp | Wrong frame timing |
| 32 | `cb_conn_teardown` doesn't set out-params | UxPlay may hang on teardown |
| 43 | `obs_source_output_video` under `video_mutex` | Potential deadlock |
| 51 | README firewall ports don't match installers | Users can't connect |
| 53 | README build steps reference nonexistent `deps/uxplay-build` | Manual build impossible |
| 56 | LICENSE is a truncated LGPL-2.1 | Legal non-compliance |
| 78 | Unpinned `latest` FFmpeg download | Supply-chain risk |

The project is clearly a work-in-progress Windows port with a lot of hard-won protocol knowledge, but the build system, installer, and documentation have several correctness and consistency gaps that will bite users and contributors.
