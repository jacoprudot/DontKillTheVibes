# Assessment Report: obs-airplay

- **Repository**: obs-airplay
- **Date**: 2026-10-05T20:12:18.242Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 4
- **Total Findings**: 50
- **By Severity**: critical 4 · high 10 · medium 31 · low 5
- **By Module**: code 6 · structure 5 · flows 7 · security 6 · cost 11 · performance 9 · github 6
- **Estimated Total Effort**: 5×XS, 7×S, 36×M, 2×L
- **Top 3 Priorities**:
  - `security-logs-contain-secrets-12` — The audio packet diagnostic logs the first payload byte and packet length of every audio packet (first 5 and then every 500th). (critical, XS) (score 90)
  - `security-no-input-validation-14` — parse_hw_addr() walks the caller-supplied string with strlen() and strtol() without validating its format or length, and writes up to 6… (high, M) (score 52.5)
  - `flows-missing-idempotency-3` — Connection lifecycle callbacks (cb_conn_init, cb_conn_destroy, cb_conn_reset) mutate shared counters and decoder state without any… (critical, S) (score 50)

---

## Detailed Findings (by Priority)

### Priority 1: `security-logs-contain-secrets-12` (score 90)
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.6 | **Score**: 90
**Location**: `src/airplay-source.c:243`
**Description**: The audio packet diagnostic logs the first payload byte and packet length of every audio packet (first 5 and then every 500th). AirPlay audio payloads are encrypted media data; logging raw payload bytes to the OBS log can leak stream content into a file that users routinely attach to bug reports.
**Remediation**: Remove the raw payload byte from the log line and log only non-sensitive metadata such as packet counter, compression type and length.
**Depends On**: None | **Blocks**: None

### Priority 2: `security-no-input-validation-14` (score 52.5)
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 52.5
**Location**: `src/airplay-source.c:164`
**Description**: parse_hw_addr() walks the caller-supplied string with strlen() and strtol() without validating its format or length, and writes up to 6 bytes into the destination buffer. A malformed or over-long hardware address string (e.g. from user settings) is parsed unchecked, and the loop condition re-evaluates strlen on every iteration.
**Remediation**: Validate the input against a strict MAC-address pattern (six hex octets separated by ':'), reject anything else, and bound the copy to the destination buffer size before parsing.
**Depends On**: None | **Blocks**: None

### Priority 3: `flows-missing-idempotency-3` (score 50)
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.5 | **Score**: 50
**Location**: `src/airplay-source.c`
**Description**: Connection lifecycle callbacks (cb_conn_init, cb_conn_destroy, cb_conn_reset) mutate shared counters and decoder state without any idempotency guard beyond the open_connections counter. A duplicated or replayed connection init/reset event can reset the timestamp mapper and audio diagnostics mid-stream, producing timestamp jumps and dropped frames.
**Remediation**: Make connection lifecycle handling idempotent by keying state on a per-connection identifier and ignoring duplicate init/reset events for an already-active connection, rather than relying solely on the open_connections counter.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 4: `security-secret-in-code-1` (score 49)
**Module**: github | **Severity**: critical | **Effort**: XS | **Confidence**: 0.7 | **Score**: 49
**Location**: `CMakeLists.txt:34`
**Description**: A developer-specific absolute path 'C:/Users/kitti/scoop/apps/openssl/current' is hardcoded as the OpenSSL fallback, leaking a local username and machine layout into the repository and making the build non-portable.
**Remediation**: Remove the personal path fallback and require OPENSSL_DIR/OPENSSL_ROOT_DIR to be set, or use a generic default such as C:/OpenSSL-Win64.
**Depends On**: None | **Blocks**: None

### Priority 5: `performance-cpu-hotspot-1` (score 42)
**Module**: performance | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 42
**Location**: `src/video-decoder.c:239`
**Description**: Every decoded frame is converted from the decoder's native pixel format to RGBA via sws_scale into a freshly allocated av_image_alloc buffer, and the resulting RGBA frame is then handed to obs_source_output_video. RGBA is 4 bytes/pixel versus 1.5 bytes/pixel for NV12, so this conversion both burns CPU on the swscale hot path and triples the memory bandwidth of the per-frame copy on the critical path of every mirrored frame.
**Remediation**: Output NV12 (or the decoder's native format) directly to OBS via obs_source_output_video with VIDEO_FORMAT_NV12, eliminating the sws_scale RGBA conversion and the 4-byte-per-pixel copy from the per-frame hot path.
**Depends On**: None | **Blocks**: None

### Priority 6: `code-missing-validation-4` (score 35)
**Module**: code | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 35
**Location**: `src/airplay-source.c:165`
**Description**: parse_hw_addr() parses a user/peer-supplied hardware address string with strtol() without validating that each 3-character group is a valid hex pair; malformed input silently yields 0 bytes and the loop condition calls strlen(str) on every iteration.
**Remediation**: Validate each parsed byte with strtol's end pointer (ensure exactly two hex digits were consumed) and reject the address on failure; cache strlen(str) in a local variable.
**Depends On**: None | **Blocks**: None

### Priority 7: `structure-high-coupling-1` (score 33)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.6 | **Score**: 33
**Location**: `src/airplay-source.c:20`
**Description**: airplay-source.c depends directly on UxPlay internal headers (raop.h, dnssd.h, stream.h, logger.h) and on the concrete video_decoder/audio_decoder implementations, with no abstraction layer between the plugin and the third-party library. Any UxPlay API change propagates straight into the OBS source code.
**Remediation**: Introduce a thin adapter interface (e.g. airplay_transport.h with function pointers or a vtable) that wraps raop/dnssd calls, so airplay-source.c depends on the adapter rather than on UxPlay headers directly.
**Depends On**: None | **Blocks**: `flows-missing-timeout-6`, `flows-missing-idempotency-3`, `flows-missing-error-handler-5`, `flows-error-leaks-stack-6`, `flows-missing-request-id-7`, `flows-missing-dlq-2`, `flows-missing-circuit-breaker-7`

### Priority 8: `cost-no-automated-tests-4` (score 30)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.75 | **Score**: 30
**Location**: `.github/workflows/build.yml:13`
**Description**: The only CI job is `build`; there is no test job, no unit tests, and no smoke test of the produced plugin anywhere in the workflow or the repository scripts (build.sh, build.bat only compile). Every regression in the AirPlay pipeline must be found manually by connecting a real Apple device, which is the most expensive possible defect-detection loop and drives rework cost.
**Remediation**: Add a CI test job that at minimum runs a compile-time smoke test and any unit tests for the decoders (video-decoder.c, audio-decoder.c), and gate merges on it so defects are caught in CI rather than through manual device testing.
**Depends On**: None | **Blocks**: None

### Priority 9: `code-logs-secrets-10` (score 28)
**Module**: github | **Severity**: critical | **Effort**: XS | **Confidence**: 0.4 | **Score**: 28
**Location**: `src/airplay-source.c:243`
**Description**: The video_process callback logs raw packet metadata including byte counts and NTP timestamps at INFO level for the first frames; combined with the audio packet logging this can expose stream characteristics in shared OBS logs.
**Remediation**: Downgrade per-packet diagnostics to LOG_DEBUG so they are only emitted when verbose logging is explicitly enabled.
**Depends On**: None | **Blocks**: None

### Priority 10: `cost-dev-setup-missing-3` (score 28)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 28
**Location**: `README.md`
**Description**: The README's 'Building from Source' section requires the developer to manually download and place the OBS 30.0.0 SDK, the FFmpeg 7.1 shared SDK/runtime, and libplist 2.7.0 into specific `deps/` subdirectories, then hand-generate import libraries with `lib /def:` and build libplist and UxPlay by hand before the plugin can be configured. There is no scripted bootstrap, so every new contributor spends significant time reproducing an undocumented, error-prone environment.
**Remediation**: Add a single bootstrap script (e.g. `scripts/setup-deps.ps1` or a CMake FetchContent/ExternalProject step) that downloads the pinned OBS SDK, FFmpeg 7.1 and libplist versions, generates the import libraries and builds the dependencies, and document that one command in the README.
**Depends On**: None | **Blocks**: None

### Priority 11: `security-gha-overpermissive-2` (score 28)
**Module**: github | **Severity**: high | **Effort**: XS | **Confidence**: 0.8 | **Score**: 28
**Location**: `.github/workflows/build.yml:9`
**Description**: The workflow declares no explicit permissions block, so the GITHUB_TOKEN inherits the repository default, which is often read/write for all scopes. The build job only needs to read the repository contents.
**Remediation**: Add a top-level 'permissions: contents: read' block (and grant any additional scope only to the specific job that needs it).
**Depends On**: None | **Blocks**: None

### Priority 12: `code-unchecked-error-1` (score 27.5)
**Module**: code | **Severity**: high | **Effort**: S | **Confidence**: 0.55 | **Score**: 27.5
**Location**: `src/audio-decoder.c:152`
**Description**: audio_decoder_set_format() frees the existing codec context and swr context but does not reset dec->swr_in_channels/swr_in_fmt, leaving stale swr input configuration cached after a format change; ensure_swr() may then reuse a mismatched swr context.
**Remediation**: Reset all cached swr input fields (swr_in_rate, swr_in_channels, swr_in_fmt) whenever the swr context is freed in audio_decoder_set_format().
**Depends On**: None | **Blocks**: None

### Priority 13: `security-gha-action-unpinned-5` (score 27)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 27
**Location**: `.github/workflows/build.yml:17`
**Description**: Third-party GitHub Actions are referenced by mutable tags instead of immutable commit SHAs: actions/checkout@v4 and ilammy/msvc-dev-cmd@v1. A compromised or retagged upstream action can execute arbitrary code in the build job, which has access to the repository and any workflow secrets.
**Remediation**: Pin every third-party action to a full 40-character commit SHA (e.g. actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11) and use Dependabot or Renovate to keep the pins updated.
**Depends On**: None | **Blocks**: None

### Priority 14: `security-gha-job-no-timeout-7` (score 25.5)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 25.5
**Location**: `.github/workflows/build.yml:11`
**Description**: The build job defines no timeout-minutes. A hung dependency download (curl/unzip of OBS SDK, FFmpeg, libplist) or a stalled nmake would occupy a windows-latest runner for the default multi-hour limit, wasting CI capacity and delaying feedback.
**Remediation**: Add `timeout-minutes: 30` (or an appropriate bound) to the build job so runaway steps are terminated automatically.
**Depends On**: None | **Blocks**: None

### Priority 15: `security-weak-rng-10` (score 25.5)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 25.5
**Location**: `src/airplay-source.c:128`
**Description**: generate_random_mac() seeds the C PRNG with srand(time(NULL) * getpid()) and derives the device MAC address from rand(). The seed has very low entropy (second-resolution time and PID), so the advertised AirPlay device identity is predictable and can be precomputed or spoofed by an attacker on the same network.
**Remediation**: Use a cryptographically secure source for the random octets, e.g. read from BCryptGenRandom/rand_s or OpenSSL RAND_bytes, and avoid seeding a global PRNG with time()/getpid().
**Depends On**: None | **Blocks**: None

### Priority 16: `security-gha-no-concurrency-prod-10` (score 24)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 24
**Location**: `.github/workflows/build.yml:4`
**Description**: The workflow has no concurrency group, so every push to master and every PR update starts a full parallel build that downloads and compiles five dependencies from source. Concurrent runs on the same ref waste runner minutes and can race on release artifacts.
**Remediation**: Add a top-level `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` block to cancel superseded runs.
**Depends On**: None | **Blocks**: None

### Priority 17: `flows-missing-dlq-2` (score 22.5)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.45 | **Score**: 22.5
**Location**: `src/airplay-source.c`
**Description**: Packets that fail decoding (video_decoder_decode / audio_decoder_decode returning false) are dropped immediately with only a log line; there is no dead-letter or quarantine path capturing the failing payload for later inspection or replay, so malformed-stream root causes cannot be diagnosed after the fact.
**Remediation**: Add a bounded dead-letter buffer that stores the first N failing packets (with timestamp and codec type) to disk or memory for post-mortem analysis instead of discarding them silently.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 18: `cost-license-share-alike-3` (score 20)
**Module**: cost | **Severity**: high | **Effort**: L | **Confidence**: 0.5 | **Score**: 20
**Location**: `LICENSE:1`
**Description**: The project is licensed LGPL-2.1 and statically links UxPlay (LGPL-2.1) and libplist into a single plugin DLL, then redistributes that DLL. Static linking of LGPL code imposes share-alike/relinking obligations on the combined binary; the repository contains no notice describing how recipients can relink against a modified UxPlay/libplist, which is a compliance gap with cost implications if the project is ever redistributed commercially.
**Remediation**: Document the LGPL static-linking compliance approach (e.g. provide object files or a relinkable form, or ship the LGPL components as separate DLLs) and add the required notices to the distribution, so redistribution does not create a license-compliance liability.
**Depends On**: None | **Blocks**: None

### Priority 19: `structure-config-logic-8` (score 19.8)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 19.8
**Location**: `CMakeLists.txt:33`
**Description**: CMakeLists.txt hardcodes a developer-specific absolute path ('C:/Users/kitti/scoop/apps/openssl/current') as the OpenSSL fallback, embedding environment-specific configuration into the build logic instead of resolving it from the environment or a cache variable.
**Remediation**: Remove the hardcoded user path and rely on OPENSSL_ROOT_DIR, find_package(OpenSSL) or a documented cache variable so the build is reproducible on other machines.
**Depends On**: None | **Blocks**: None

### Priority 20: `structure-framework-leak-3` (score 18.7)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 18.7
**Location**: `src/video-decoder.c:50`
**Description**: video-decoder.c writes diagnostics with fprintf(stderr, ...) instead of the plugin's OBS logging abstraction (blog/ap_log used elsewhere), leaking a non-framework logging mechanism into the module and bypassing OBS log routing.
**Remediation**: Replace the fprintf(stderr, ...) calls with blog(LOG_ERROR/LOG_INFO, ...) or the ap_error/ap_info macros from src/log.h so all diagnostics flow through OBS logging.
**Depends On**: None | **Blocks**: None

### Priority 21: `performance-no-perf-budgets-10` (score 18)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 18
**Location**: `README.md:19`
**Description**: The project advertises 'Low Latency - Direct H.264 frame pipeline with minimal buffering' but defines no measurable performance budget anywhere: no target end-to-end latency, no maximum decode time per frame, no CPU or memory ceiling for the plugin. Without a stated budget there is no objective criterion for accepting or rejecting a change to the decode path.
**Remediation**: Document explicit performance budgets (e.g. end-to-end glass-to-glass latency < 100 ms, per-frame decode < 8 ms at 1080p60, plugin CPU < 15% of one core) and reference them from the README and CI checks.
**Depends On**: None | **Blocks**: None

### Priority 22: `performance-no-load-testing-3` (score 16.8)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 16.8
**Location**: `.github/workflows/build.yml:10`
**Description**: The CI pipeline only builds the plugin; there is no load, soak, or performance test stage anywhere in the workflow or repository. A real-time AirPlay receiver that must sustain 60fps H.264 decode plus AAC decode with sub-frame latency has no automated verification that it keeps up under sustained mirroring load, so regressions in the decode pipeline (e.g. the per-frame sws_scale conversion in video-decoder.c) would only surface in production.
**Remediation**: Add a CI job that runs the decoder pipeline against recorded H.264/AAC-ELD sample streams and asserts sustained throughput (frames decoded per second, decode latency percentiles) against a defined budget before merging.
**Depends On**: None | **Blocks**: None

### Priority 23: `performance-no-regression-detection-5` (score 16.8)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 16.8
**Location**: `.github/workflows/build.yml:10`
**Description**: The build workflow has no benchmark or performance-regression gate. Because the plugin links a private FFmpeg 7 runtime and a pinned UxPlay v1.73.6, dependency bumps or decoder changes can silently degrade decode throughput with no automated signal; the only CI outcome is compile success.
**Remediation**: Add a benchmark step to the workflow that records decode throughput/latency for a fixed sample stream and fails the build when results regress beyond a threshold versus the stored baseline.
**Depends On**: None | **Blocks**: None

### Priority 24: `code-ignores-return-value-6` (score 16)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 16
**Location**: `src/video-decoder.c:253`
**Description**: video_decoder_flush() calls avcodec_send_packet(dec->ctx, NULL) to signal end-of-stream but discards the return value. If the send fails (e.g. EAGAIN because the decoder still has buffered input), the subsequent avcodec_receive_frame() may return no frame and pending frames are silently dropped.
**Remediation**: Check the return value of avcodec_send_packet() and handle AVERROR(EAGAIN) by draining with avcodec_receive_frame() in a loop before returning, logging any other error.
**Depends On**: None | **Blocks**: None

### Priority 25: `structure-low-cohesion-5` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `src/airplay-source.c:44`
**Description**: The airplay_source struct aggregates unrelated responsibilities: OBS source handle, UxPlay raop/dnssd handles, two decoders, three mutexes plus readiness flags, configuration values, volatile state counters, timestamp-anchor mapping state and audio diagnostic counters. No single cohesive concept binds these fields, which makes the struct hard to reason about and every callback depends on the whole blob.
**Remediation**: Decompose the struct into cohesive sub-structures (e.g. struct airplay_session for raop/dnssd/connection state, struct timestamp_mapper for anchor state, struct audio_stats for diagnostics) and pass only the needed sub-structure to each callback.
**Depends On**: None | **Blocks**: None

### Priority 26: `cost-gha-no-timeout-9` (score 14.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.9 | **Score**: 14.4
**Location**: `.github/workflows/build.yml:13`
**Description**: The `build` job defines no `timeout-minutes`. A hung dependency download (curl of the OBS SDK or FFmpeg zip), a stalled `choco install`, or a wedged `nmake` will keep the Windows runner alive until GitHub's default 360-minute limit, billing up to six hours of the most expensive runner tier for a single stuck job.
**Remediation**: Add `timeout-minutes: 30` (or a value comfortably above the observed build time) to the `build` job so a hung download or compile is killed quickly instead of consuming the full default budget.
**Depends On**: None | **Blocks**: None

### Priority 27: `performance-no-cost-perf-tradeoff-8` (score 14.4)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 14.4
**Location**: `src/video-decoder.c`
**Description**: The decoder unconditionally uses the software H.264 decoder with thread_count = 1 and AV_CODEC_FLAG_LOW_DELAY, and performs a full-frame sws_scale color conversion to RGBA on every frame. There is no documented or configurable trade-off between latency and CPU cost (e.g. hardware decode, multi-threaded decode, or a cheaper pixel format path), so users on weaker machines cannot trade latency for throughput.
**Remediation**: Expose a decode-mode setting (software single-thread low-latency vs. multi-threaded/hardware decode) and document the latency/CPU trade-off so users can choose the appropriate point on the curve.
**Depends On**: None | **Blocks**: None

### Priority 28: `performance-serialization-format-2` (score 14.4)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 14.4
**Location**: `src/video-decoder.c:239`
**Description**: The frame handoff to OBS uses an uncompressed RGBA intermediate buffer rather than a format OBS can consume without conversion. This is an inefficient serialization format for the video path: the decoder already produces a planar YUV frame, and converting it to packed RGBA only to have OBS convert it again wastes CPU and memory bandwidth per frame.
**Remediation**: Pass the decoded frame to OBS in a format OBS natively accepts (NV12/I420) so no intermediate packed-RGBA conversion is required on the frame path.
**Depends On**: None | **Blocks**: None

### Priority 29: `cost-gha-no-dependency-cache-5` (score 13.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 13.6
**Location**: `.github/workflows/build.yml:13`
**Description**: The workflow has no `actions/cache` step and no caching of the expensive, deterministic dependency downloads and builds (OpenSSL via Chocolatey, UxPlay clone, OBS SDK zip, FFmpeg 7 zip, libplist source + nmake build). Every push and PR re-downloads hundreds of MB and recompiles libplist from scratch, burning runner minutes and bandwidth on every run.
**Remediation**: Add an `actions/cache` step keyed on the pinned dependency versions (UxPlay v1.73.6, OBS 30.0.0, FFmpeg n7.1, libplist 2.7.0) to cache `deps/` and the built `plist.lib`, and cache the Chocolatey OpenSSL install so repeated runs skip the download and rebuild.
**Depends On**: None | **Blocks**: None

### Priority 30: `performance-no-backpressure-10` (score 13.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 13.2
**Location**: `src/airplay-source.c`
**Description**: The video and audio callbacks decode and immediately push frames to OBS while holding the per-stream mutex, with no backpressure or queue-depth control. If OBS cannot consume frames as fast as the sender produces them, the callback blocks on the mutex and the network receive path is throttled implicitly rather than by an explicit bounded queue, so there is no mechanism to shed or coalesce frames under overload.
**Remediation**: Introduce a bounded frame queue between the network callback and the OBS output path, dropping or coalescing the oldest frames when the queue is full so overload degrades gracefully instead of blocking the receive thread.
**Depends On**: None | **Blocks**: None

### Priority 31: `structure-service-sql-5` (score 13.2)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 13.2
**Location**: `src/airplay-source.c:7`
**Description**: airplay-source.c mixes the OBS source lifecycle/registration layer with protocol-level concerns: it directly drives UxPlay's raop/dnssd components, owns decoder instances, manages mutexes and timestamp mapping, and performs packet validation. This is a god-file that combines transport orchestration, decoding coordination and OBS output, so any change to the AirPlay protocol or to OBS output semantics forces edits in the same translation unit.
**Remediation**: Split the file: keep only the OBS source registration and settings in airplay-source.c, and extract the UxPlay callback handling, timestamp mapping and packet validation into a dedicated session/transport module (e.g. airplay-session.c) that exposes a narrow interface to the OBS layer.
**Depends On**: None | **Blocks**: None

### Priority 32: `cost-slow-build-1` (score 12.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 12.8
**Location**: `.github/workflows/build.yml:13`
**Description**: The CI build compiles five dependencies from source on every run: OpenSSL via Chocolatey, UxPlay cloned and built, the full OBS Studio 30.0.0 source archive downloaded and unzipped, FFmpeg 7.1 downloaded and extracted, and libplist 2.7.0 configured and built with nmake. None of these are cached or prebuilt, so each run pays the full download-and-compile cost, making the feedback loop slow and expensive.
**Remediation**: Prebuild the pinned dependencies once and publish them as a versioned release artifact or container image, then have the workflow download the prebuilt bundle instead of cloning, unzipping and compiling UxPlay, OBS SDK, FFmpeg and libplist on every run.
**Depends On**: None | **Blocks**: None

### Priority 33: `flows-missing-timeout-6` (score 12)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 12
**Location**: `src/airplay-source.c`
**Description**: The AirPlay receiver opens long-lived TCP/UDP connections (mirror 7100, RTSP 7000, timing 7011, control 6001, data 6000) and drives UxPlay callbacks, but no connection/read/idle timeout is configured anywhere in the source. A stalled or half-open client connection can block the receive path indefinitely, leaving the OBS source stuck with no video output and no recovery.
**Remediation**: Configure explicit socket/connection timeouts on the raop/dnssd setup (e.g. set SO_RCVTIMEO/SO_SNDTIMEO or the UxPlay connection timeout option) and add a watchdog that tears down and re-registers the source if no packet arrives within a bounded interval.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 34: `performance-no-adaptive-timeout-6` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `src/airplay-source.c`
**Description**: The source has no adaptive timeout or stall detection on the incoming AirPlay stream. If the sender stops delivering video packets, the plugin simply stops producing frames with no watchdog to detect the stall, reset the timestamp mapper, or signal OBS; the timestamp re-anchor only triggers when a new packet arrives with a large drift.
**Remediation**: Add a watchdog timer that detects absence of video/audio packets beyond a configurable threshold and resets the decoder and timestamp anchor so recovery is bounded rather than dependent on the next packet.
**Depends On**: None | **Blocks**: None

### Priority 35: `performance-no-request-collapsing-4` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `src/airplay-source.c`
**Description**: The timestamp mapping path takes the timestamp_mutex on every video and audio packet (map_timestamp is called from both cb_video_process and cb_audio_process). Under high packet rates this serializes the two decode paths on a single lock for a pure arithmetic operation, adding contention on the frame critical path.
**Remediation**: Make the timestamp anchor state lock-free (atomic load/store of the anchor pair) or compute the mapping without a mutex, since the operation is a simple offset calculation that does not need mutual exclusion.
**Depends On**: None | **Blocks**: None

### Priority 36: `flows-missing-error-handler-5` (score 11)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 11
**Location**: `src/airplay-source.c`
**Description**: The UxPlay callback surface (cb_conn_reset, cb_video_reset, cb_video_process, cb_audio_process) handles failures only by logging and returning; there is no central error handler that surfaces decode/connection failures to the user or triggers recovery. Persistent decode failures silently degrade to a black source with only rate-limited log lines.
**Remediation**: Add a unified error-handling path that tracks consecutive decode/connection failures and, after a threshold, tears down and re-initializes the AirPlay session while surfacing a user-visible error via obs_source_output_video(NULL) plus a logged actionable message.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 37: `cost-no-license-tracking-5` (score 10.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 10.4
**Location**: `README.md:4`
**Description**: The project statically links UxPlay (LGPL-2.1), libplist, FFmpeg (LGPL build), and OpenSSL, and ships their binaries, but there is no license inventory, no third-party notice file, and no automated license-compliance check in CI. The README credits the projects informally but does not track the obligations (LGPL relinking/source-availability, FFmpeg LGPL attribution) that come with redistributing these components.
**Remediation**: Add a THIRD-PARTY-NOTICES file listing each bundled dependency with its license and version, and add a CI license-scan step (e.g. a license-checker or SBOM generation) so license obligations are tracked automatically as dependencies change.
**Depends On**: None | **Blocks**: None

### Priority 38: `code-missing-error-main-10` (score 10)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `src/plugin-main.c:11`
**Description**: obs_module_load() calls airplay_source_register() and unconditionally returns true, so if source registration fails the module still reports successful load and OBS will show a plugin with no working source.
**Remediation**: Have airplay_source_register() return a success/failure status and propagate it from obs_module_load(), logging an error and returning false when registration fails.
**Depends On**: None | **Blocks**: None

### Priority 39: `code-mutex-missing-4` (score 10)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `src/airplay-source.c:96`
**Description**: map_timestamp() reads and writes the shared timestamp anchor fields (timestamp_anchor_set, remote_timestamp_anchor, local_timestamp_anchor) under timestamp_mutex, but reset_timestamp_mapper() and the anchor fields are also touched from connection callbacks; the anchor state is only guarded when timestamp_mutex_ready is true, and the ready flag itself is read without synchronization, so a callback racing with teardown can observe a partially initialized mutex.
**Remediation**: Initialize the mutexes before any callback can run and guard the *_mutex_ready flags with an atomic or initialize them once at source creation so map_timestamp/reset_timestamp_mapper never race with initialization.
**Depends On**: None | **Blocks**: None

### Priority 40: `flows-error-leaks-stack-6` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: S | **Confidence**: 0.5 | **Score**: 10
**Location**: `src/audio-decoder.c:86`
**Description**: log_av_error() writes the raw FFmpeg error string and numeric code to the OBS log for every decode failure. Combined with the packet-level logging in cb_audio_process (which prints packet contents/first byte and NTP timestamps), internal decoder state and stream details are exposed in logs that users commonly attach to public bug reports.
**Remediation**: Keep decoder error logging at a coarse level (error class only) and avoid logging packet payload bytes or full FFmpeg error strings; gate verbose diagnostics behind an explicit debug flag.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 41: `flows-missing-circuit-breaker-7` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `src/airplay-source.c`
**Description**: When the video or audio decoder repeatedly fails, the callbacks keep invoking the decoder on every incoming packet with no circuit breaker; a persistently failing decoder causes unbounded repeated work and log churn for the lifetime of the connection.
**Remediation**: Track consecutive decode failures per stream and open a circuit breaker after a threshold, skipping decode attempts for a cool-down period and re-initializing the decoder before resuming.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 42: `cost-documentation-poor-7` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `README.md:18`
**Description**: The README documents installation and a high-level build outline but omits the operational detail needed to maintain the project cheaply: there is no description of the fixed AirPlay ports used by the plugin (7000/7100/6000/6001/7011 appear only in the installer scripts), no explanation of the FFmpeg 7 vs 8 ABI constraint beyond a troubleshooting bullet, and no architecture or troubleshooting guide for the decoder pipeline. This forces maintainers to reverse-engineer intent from source, raising maintenance cost.
**Remediation**: Expand the README with a short architecture section covering the UxPlay/FFmpeg pipeline, the fixed TCP/UDP ports and why they are fixed, and the FFmpeg 7 ABI pinning rationale, so future maintainers do not have to rediscover these constraints from the code.
**Depends On**: None | **Blocks**: None

### Priority 43: `cost-license-attribution-missing-2` (score 8.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 8.8
**Location**: `README.md:34`
**Description**: The distributed installer (installer.iss) bundles FFmpeg 7 DLLs, OpenSSL libcrypto, and the UxPlay-derived plugin, but the installer ships only the project README and no license texts or attribution for the bundled third-party binaries. Redistributing FFmpeg and OpenSSL without their license notices is an attribution gap.
**Remediation**: Include the FFmpeg, OpenSSL and UxPlay license texts (and any required attribution) in the installer payload and reference them from the README, so the redistributed binaries carry their required notices.
**Depends On**: None | **Blocks**: None

### Priority 44: `code-var-usage-3` (score 8.4)
**Module**: github | **Severity**: medium | **Effort**: XS | **Confidence**: 0.6 | **Score**: 8.4
**Location**: `src/airplay-source.c:141`
**Description**: generate_random_mac reseeds the global rand() state on every call via srand(), which is not thread-safe and perturbs any other code in the process relying on rand().
**Remediation**: Use a dedicated thread-safe RNG (e.g. OpenSSL RAND_bytes) instead of reseeding the global rand() state.
**Depends On**: None | **Blocks**: None

### Priority 45: `cost-gha-infinite-artifacts-6` (score 6.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 6.4
**Location**: `.github/workflows/build.yml:13`
**Description**: The workflow builds a plugin DLL plus four FFmpeg runtime DLLs and an OpenSSL DLL, but no `actions/upload-artifact` step with a retention policy is present in the job. If artifacts are added without `retention-days`, or if the build output is uploaded on every push/PR run, storage accumulates indefinitely and incurs ongoing artifact storage cost.
**Remediation**: When uploading build artifacts, set an explicit short `retention-days` (e.g. 7) and upload only on tagged releases or master pushes rather than on every pull request, to avoid unbounded artifact storage growth.
**Depends On**: None | **Blocks**: None

### Priority 46: `code-print-statement-5` (score 4.75)
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.95 | **Score**: 4.75
**Location**: `src/video-decoder.c:50`
**Description**: The video decoder writes diagnostics directly to stderr with fprintf() instead of using the OBS logging API (blog/ap_log) used everywhere else in the plugin. These messages bypass OBS's log subsystem, are not captured in OBS logs, and are not routed through the plugin's log level filtering.
**Remediation**: Replace the fprintf(stderr, ...) calls in video_decoder_create() with blog(LOG_INFO/LOG_ERROR, ...) or the ap_info/ap_error macros from src/log.h so diagnostics appear in the OBS log.
**Depends On**: None | **Blocks**: None

### Priority 47: `cost-gha-expensive-runner-4` (score 2.8)
**Module**: cost | **Severity**: low | **Effort**: M | **Confidence**: 0.7 | **Score**: 2.8
**Location**: `.github/workflows/build.yml:13`
**Description**: The build job runs on `windows-latest`, GitHub's most expensive hosted runner tier (Windows runners bill at roughly 2x the Linux rate). The job only compiles C code with MSVC and downloads dependencies; nothing here requires the Windows runner premium beyond the MSVC toolchain, and the workflow runs on every push and pull request to master, multiplying the cost.
**Remediation**: Reduce Windows runner minutes: restrict the workflow trigger to pushes on master plus a path filter, or move the dependency-download/compile steps to a cheaper Linux runner and keep only the MSVC link step on windows-latest. Consider a self-hosted Windows runner if build volume grows.
**Depends On**: None | **Blocks**: None

### Priority 48: `flows-missing-request-id-7` (score 2.5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.5 | **Score**: 2.5
**Location**: `src/airplay-source.c`
**Description**: Log lines emitted across the connection and decode callbacks (connection init/destroy/reset, video_process, audio pkt) carry no correlation identifier, so interleaved events from multiple concurrent AirPlay connections cannot be attributed to a specific session when diagnosing failures.
**Remediation**: Introduce a per-connection request/session id assigned in cb_conn_init and include it in every blog() call for that connection so log lines can be correlated.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 49: `code-missing-docstring-10` (score 1.4)
**Module**: github | **Severity**: low | **Effort**: S | **Confidence**: 0.4 | **Score**: 1.4
**Location**: `src/airplay-source.c:139`
**Description**: generate_random_mac and the surrounding MAC helper functions have no documentation of their contract (buffer length expectations, locally-administered bit semantics), making the len parameter's required minimum unclear.
**Remediation**: Add a short comment documenting the required buffer size and the meaning of the generated address.
**Depends On**: None | **Blocks**: None

### Priority 50: `code-missing-return-type-8` (score 1.4)
**Module**: github | **Severity**: low | **Effort**: S | **Confidence**: 0.4 | **Score**: 1.4
**Location**: `src/airplay-source.c:139`
**Description**: Helper functions such as generate_random_mac and parse_hw_addr are declared static void with no documented or enforced error signalling, so callers cannot tell whether a valid MAC was produced.
**Remediation**: Return a bool from these helpers indicating success and have callers fall back to a safe default on failure.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `security-logs-contain-secrets-12`: Remove the raw payload byte from the log line and log only non-sensitive metadata such as packet counter, compression type and length. (XS)
- `security-no-input-validation-14`: Validate the input against a strict MAC-address pattern (six hex octets separated by ':'), reject anything else, and bound the copy to the destination buffer size before parsing. (M)
- `flows-missing-idempotency-3`: Make connection lifecycle handling idempotent by keying state on a per-connection identifier and ignoring duplicate init/reset events for an already-active connection, rather than relying solely on… (S)
- `security-secret-in-code-1`: Remove the personal path fallback and require OPENSSL_DIR/OPENSSL_ROOT_DIR to be set, or use a generic default such as C:/OpenSSL-Win64. (XS)
- `performance-cpu-hotspot-1`: Output NV12 (or the decoder's native format) directly to OBS via obs_source_output_video with VIDEO_FORMAT_NV12, eliminating the sws_scale RGBA conversion and the 4-byte-per-pixel copy from the… (M)
- `code-missing-validation-4`: Validate each parsed byte with strtol's end pointer (ensure exactly two hex digits were consumed) and reject the address on failure; cache strlen(str) in a local variable. (M)
- `structure-high-coupling-1`: Introduce a thin adapter interface (e.g. (L)
- `cost-no-automated-tests-4`: Add a CI test job that at minimum runs a compile-time smoke test and any unit tests for the decoders (video-decoder.c, audio-decoder.c), and gate merges on it so defects are caught in CI rather than… (M)
- `code-logs-secrets-10`: Downgrade per-packet diagnostics to LOG_DEBUG so they are only emitted when verbose logging is explicitly enabled. (XS)
- `cost-dev-setup-missing-3`: Add a single bootstrap script (e.g. (M)
- `security-gha-overpermissive-2`: Add a top-level 'permissions: contents: read' block (and grant any additional scope only to the specific job that needs it). (XS)
- `code-unchecked-error-1`: Reset all cached swr input fields (swr_in_rate, swr_in_channels, swr_in_fmt) whenever the swr context is freed in audio_decoder_set_format(). (S)
- `security-gha-action-unpinned-5`: Pin every third-party action to a full 40-character commit SHA (e.g. (M)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 30` (or an appropriate bound) to the build job so runaway steps are terminated automatically. (M)
- `security-weak-rng-10`: Use a cryptographically secure source for the random octets, e.g. (M)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `security-gha-no-concurrency-prod-10`: Add a top-level `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` block to cancel superseded runs. (M)
- `flows-missing-dlq-2`: Add a bounded dead-letter buffer that stores the first N failing packets (with timestamp and codec type) to disk or memory for post-mortem analysis instead of discarding them silently. (M)
- `cost-license-share-alike-3`: Document the LGPL static-linking compliance approach (e.g. (L)
- `structure-config-logic-8`: Remove the hardcoded user path and rely on OPENSSL_ROOT_DIR, find_package(OpenSSL) or a documented cache variable so the build is reproducible on other machines. (M)
- `structure-framework-leak-3`: Replace the fprintf(stderr, ...) calls with blog(LOG_ERROR/LOG_INFO, ...) or the ap_error/ap_info macros from src/log.h so all diagnostics flow through OBS logging. (M)
- `performance-no-perf-budgets-10`: Document explicit performance budgets (e.g. (M)
- `performance-no-load-testing-3`: Add a CI job that runs the decoder pipeline against recorded H.264/AAC-ELD sample streams and asserts sustained throughput (frames decoded per second, decode latency percentiles) against a defined… (M)
- `performance-no-regression-detection-5`: Add a benchmark step to the workflow that records decode throughput/latency for a fixed sample stream and fails the build when results regress beyond a threshold versus the stored baseline. (M)
- `code-ignores-return-value-6`: Check the return value of avcodec_send_packet() and handle AVERROR(EAGAIN) by draining with avcodec_receive_frame() in a loop before returning, logging any other error. (M)
- `structure-low-cohesion-5`: Decompose the struct into cohesive sub-structures (e.g. (M)
- `cost-gha-no-timeout-9`: Add `timeout-minutes: 30` (or a value comfortably above the observed build time) to the `build` job so a hung download or compile is killed quickly instead of consuming the full default budget. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `performance-no-cost-perf-tradeoff-8`: Expose a decode-mode setting (software single-thread low-latency vs. (M)
- `performance-serialization-format-2`: Pass the decoded frame to OBS in a format OBS natively accepts (NV12/I420) so no intermediate packed-RGBA conversion is required on the frame path. (M)
- `cost-gha-no-dependency-cache-5`: Add an `actions/cache` step keyed on the pinned dependency versions (UxPlay v1.73.6, OBS 30.0.0, FFmpeg n7.1, libplist 2.7.0) to cache `deps/` and the built `plist.lib`, and cache the Chocolatey… (M)
- `performance-no-backpressure-10`: Introduce a bounded frame queue between the network callback and the OBS output path, dropping or coalescing the oldest frames when the queue is full so overload degrades gracefully instead of… (M)
- `structure-service-sql-5`: Split the file: keep only the OBS source registration and settings in airplay-source.c, and extract the UxPlay callback handling, timestamp mapping and packet validation into a dedicated… (M)
- `cost-slow-build-1`: Prebuild the pinned dependencies once and publish them as a versioned release artifact or container image, then have the workflow download the prebuilt bundle instead of cloning, unzipping and… (M)
- `flows-missing-timeout-6`: Configure explicit socket/connection timeouts on the raop/dnssd setup (e.g. (M)
- `performance-no-adaptive-timeout-6`: Add a watchdog timer that detects absence of video/audio packets beyond a configurable threshold and resets the decoder and timestamp anchor so recovery is bounded rather than dependent on the next… (M)
- `performance-no-request-collapsing-4`: Make the timestamp anchor state lock-free (atomic load/store of the anchor pair) or compute the mapping without a mutex, since the operation is a simple offset calculation that does not need mutual… (M)
- `flows-missing-error-handler-5`: Add a unified error-handling path that tracks consecutive decode/connection failures and, after a threshold, tears down and re-initializes the AirPlay session while surfacing a user-visible error… (M)
- `cost-no-license-tracking-5`: Add a THIRD-PARTY-NOTICES file listing each bundled dependency with its license and version, and add a CI license-scan step (e.g. (M)
- `code-missing-error-main-10`: Have airplay_source_register() return a success/failure status and propagate it from obs_module_load(), logging an error and returning false when registration fails. (M)
- `code-mutex-missing-4`: Initialize the mutexes before any callback can run and guard the *_mutex_ready flags with an atomic or initialize them once at source creation so map_timestamp/reset_timestamp_mapper never race with… (M)
- `flows-error-leaks-stack-6`: Keep decoder error logging at a coarse level (error class only) and avoid logging packet payload bytes or full FFmpeg error strings; gate verbose diagnostics behind an explicit debug flag. (S)
- `flows-missing-circuit-breaker-7`: Track consecutive decode failures per stream and open a circuit breaker after a threshold, skipping decode attempts for a cool-down period and re-initializing the decoder before resuming. (M)
- `cost-documentation-poor-7`: Expand the README with a short architecture section covering the UxPlay/FFmpeg pipeline, the fixed TCP/UDP ports and why they are fixed, and the FFmpeg 7 ABI pinning rationale, so future maintainers… (M)
- `cost-license-attribution-missing-2`: Include the FFmpeg, OpenSSL and UxPlay license texts (and any required attribution) in the installer payload and reference them from the README, so the redistributed binaries carry their required… (M)
- `code-var-usage-3`: Use a dedicated thread-safe RNG (e.g. (XS)
- `cost-gha-infinite-artifacts-6`: When uploading build artifacts, set an explicit short `retention-days` (e.g. (M)
- `code-print-statement-5`: Replace the fprintf(stderr, ...) calls in video_decoder_create() with blog(LOG_INFO/LOG_ERROR, ...) or the ap_info/ap_error macros from src/log.h so diagnostics appear in the OBS log. (S)
- `cost-gha-expensive-runner-4`: Reduce Windows runner minutes: restrict the workflow trigger to pushes on master plus a path filter, or move the dependency-download/compile steps to a cheaper Linux runner and keep only the MSVC… (M)
- `flows-missing-request-id-7`: Introduce a per-connection request/session id assigned in cb_conn_init and include it in every blog() call for that connection so log lines can be correlated. (S)
- `code-missing-docstring-10`: Add a short comment documenting the required buffer size and the meaning of the generated address. (S)
- `code-missing-return-type-8`: Return a bool from these helpers indicating success and have callers fall back to a safe default on failure. (S)
**Total Effort**: XL

---

## Dependencies
- `flows-missing-timeout-6` **Depends On** `structure-high-coupling-1`
- `flows-missing-idempotency-3` **Depends On** `structure-high-coupling-1`
- `flows-missing-error-handler-5` **Depends On** `structure-high-coupling-1`
- `flows-error-leaks-stack-6` **Depends On** `structure-high-coupling-1`
- `flows-missing-request-id-7` **Depends On** `structure-high-coupling-1`
- `flows-missing-dlq-2` **Depends On** `structure-high-coupling-1`
- `flows-missing-circuit-breaker-7` **Depends On** `structure-high-coupling-1`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
