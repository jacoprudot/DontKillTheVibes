# Repository Review: `vegeta`

Below are concrete problems I found, grouped by category. I've focused on things that are actually wrong or risky rather than stylistic nits.

## 1. CI / Release pipeline bugs

### 1.1 `release` job references a non-existent output
In `.github/workflows/ci.yml`, the "Create checksums and sign them" step writes:

```yaml
echo "name=${VERSION}" >> $GITHUB_OUTPUT
```

but the step's `id` is `sign`, and later steps read `${{ steps.sign.outputs.version }}`:

```yaml
name: ${{ steps.sign.outputs.version }}
tag_name: ${{ steps.sign.outputs.version }}
```

The output key is `name`, not `version`. So `steps.sign.outputs.version` is empty, and the release will be created with an empty name/tag. This is a real bug that will break tagged releases.

### 1.2 `VERSION` is used in the build step but never set
In the `build` job:

```yaml
run: |
  set -euo pipefail
  make vegeta
  VERSION=${GITHUB_REF#refs/tags/v}
  NAME="vegeta_${VERSION}_${GOOS}_${GOARCH}"
```

`GOOS` and `GOARCH` are set via `env:` from `steps.setup_env.outputs.*`, but `VERSION` is derived from `GITHUB_REF` — that's fine. However, the artifact name uses `steps.setup_env.outputs.goos`/`goarch`, while the tarball name uses `$GOOS`/`$GOARCH`. These should be consistent; if `setup_env` ever fails to populate, the tarball name silently becomes `vegeta__`. Minor, but fragile.

### 1.3 `goimports -w .` mutates the tree, then `git diff --exit-code`
```yaml
go install golang.org/x/tools/cmd/goimports@latest
goimports -w .
git diff --exit-code
```
This is a common pattern, but `@latest` makes CI non-reproducible — a new `goimports` release can break the build without any repo change. Pin a version.

### 1.4 `go-version: "1.22"` vs `go.mod` `go 1.22`
Consistent, but the Dockerfile uses `golang:1.20-alpine3.18` (see §2.1), so the CI and Docker builds use different Go toolchains.

### 1.5 `softprops/action-gh-release@v1` is unpinned
All other actions are pinned to major versions (`@v4`, `@v5`), but this one is `@v1` and is a third-party action. For a release job that handles signing keys, pinning to a SHA is strongly recommended.

### 1.6 GPG key handling
```yaml
echo "${{ secrets.VEGETA_GPG_KEY }}" | gpg --batch --yes --pinentry-mode loopback --import
```
The key is imported without a passphrase, and `--pinentry-mode loopback` is used. If the key is passphrase-protected, signing will fail; if it isn't, the secret is a plaintext private key in CI. Either way, this deserves a comment and ideally a dedicated signing key with minimal scope.

## 2. Dockerfile problems

### 2.1 Go version mismatch
```dockerfile
FROM golang:1.20-alpine3.18 AS BUILD
```
`go.mod` declares `go 1.22`. Building with Go 1.20 will fail (or at least warn) on a module requiring 1.22. The Docker image is effectively broken for the current module.

### 2.2 `make generate` runs before `make vegeta`
```dockerfile
RUN make generate
RUN make vegeta
```
`make generate` typically regenerates `*_easyjson.go` files. If the generated files are already committed (they are — `lib/results_easyjson.go`, `lib/targets_easyjson.go`), running `generate` in the image is unnecessary and adds build time. More importantly, if `generate` requires tools not installed in the image, the build fails.

### 2.3 No non-root user
The final image runs as root. For a network-facing load-testing tool this is a hardening gap.

### 2.4 `ADD . /vegeta` after `go mod download`
This invalidates the module cache layer on every source change, defeating the caching intent. A `.dockerignore` is also absent, so `.git`, `dist`, etc. get copied in.

## 3. Code-level issues

### 3.1 `encode.go`: `defer mc.Close()` before error check
```go
dec, mc, err := decoder(files)
defer mc.Close()
if err != nil {
    return err
}
```
`mc` is a `multiCloser` (a slice), so `Close()` on a nil/empty slice is safe, but the ordering is still wrong: if `decoder` returns an error, `mc` may be partially populated and `Close()` will run. More importantly, the deferred `Close()` error is silently discarded. Same pattern in `attack.go` for `out.Close()` and `f.Close()`.

### 3.2 `attack.go`: `srv.ListenAndServe()` error ignored
```go
defer srv.Close()
go srv.ListenAndServe()
```
If the Prometheus exporter fails to bind (e.g., port in use), the error is swallowed and the attack proceeds silently without metrics. At minimum, log it.

### 3.3 `attack.go`: `net.DefaultResolver.PreferGo = true` is set unconditionally
```go
net.DefaultResolver.PreferGo = true
```
This forces the pure-Go resolver for all attacks, even when the user didn't ask for custom resolvers. That's a behavioral change with performance and correctness implications (e.g., `/etc/nsswitch.conf` handling, mDNS). It should probably only be set when `opts.resolvers` is non-empty.

### 3.4 `attack.go`: `tlsConfig` calls deprecated `BuildNameToCertificate`
```go
c.BuildNameToCertificate()
```
`(*tls.Config).BuildNameToCertificate` is deprecated since Go 1.14 and is a no-op in modern Go. It should be removed.

### 3.5 `attack.go`: `tlsConfig` silently reuses cert as key
```go
key, ok := files[keyf]
if !ok {
    key = cert
}
```
If `-key` is not provided, the cert file is used as the key. This is a convenience for combined PEM files, but it's undocumented and will produce a confusing `X509KeyPair` error if the user simply forgot `-key`. Worth a comment or explicit error.

### 3.6 `flags.go`: `connectToFlag.Set` returns `nil` when `addrMap` is nil
```go
func (c *connectToFlag) Set(s string) error {
    if c.addrMap == nil {
        return nil
    }
    ...
}
```
Silently ignoring the flag when the map is nil is a bug — it should return an error. This can happen if the flag is constructed incorrectly.

### 3.7 `flags.go`: `connectToFlag.Set` splits on `:` naively
```go
parts := strings.Split(s, ":")
if len(parts) != 4 {
    return fmt.Errorf(...)
}
```
This breaks for IPv6 addresses (`[::1]:80:...`) and for hostnames containing colons. The documented format `src:port:dst:port` is inherently ambiguous with IPv6. `net.SplitHostPort` is used afterward, but the initial split already mangled the input.

### 3.8 `flags.go`: `rateFlag.Set` has a dead `case 0`
```go
ps := strings.SplitN(v, "/", 2)
switch len(ps) {
case 1:
    ps = append(ps, "1s")
case 0:
    return fmt.Errorf(...)
}
```
`strings.SplitN` never returns a zero-length slice, so `case 0` is unreachable. Harmless but misleading.

### 3.9 `flags.go`: `rateFlag.Set` accepts `"infinity"` but `String()` doesn't round-trip
```go
if v == "infinity" {
    return nil
}
```
Setting `-rate=infinity` leaves `f.Freq`/`f.Per` at their previous values (or zero), and `String()` will print `0/0s` or similar. The `infinity` sentinel isn't represented in the struct.

### 3.10 `flags.go`: `maxBodyFlag.Set` overflow check is wrong
```go
if ds > math.MaxInt64 {
    return fmt.Errorf("-max-body=%d overflows int64", ds)
}
```
`ds` is a `datasize.ByteSize` (uint64). Comparing to `math.MaxInt64` (an untyped constant) is fine, but the error message uses `%d` on a `ByteSize`, which will print the raw byte count, not the human-readable form. Minor.

### 3.11 `file.go`: `decoder` leaks file handles on error
```go
for _, f := range files {
    rc, err := file(f, false)
    if err != nil {
        return nil, closer, err
    }
    dec := vegeta.DecoderFor(rc)
    if dec == nil {
        return nil, closer, fmt.Errorf(...)
    }
    ...
}
```
If `DecoderFor` returns nil, `rc` is not added to `closer` and is leaked. The caller's `defer mc.Close()` won't close it.

### 3.12 `file.go`: `multiCloser.Close` returns a string-joined error
```go
return errors.New(strings.Join(errs, "; "))
```
This loses error identity (no `errors.Is`/`errors.As`). `errors.Join` (Go 1.20+) would be more appropriate.

### 3.13 `dump.go`: deprecated command returns an error
```go
func dumpCmd() command {
    return command{fn: func([]string) error {
        return fmt.Errorf("vegeta dump has been deprecated and succeeded by the vegeta encode command")
    }}
}
```
Returning an error for a deprecated command means `vegeta dump` exits non-zero. Deprecation usually warrants a warning + exit 0, or at least a distinct exit code. Also, the `command` struct's `fs` field is nil here — if any caller tries to use `cmd.fs`, it will panic.

### 3.14 `attack_test.go`: `TestAttackSignalOnce` is timing-dependent
```go
const (
    signalDelay    = 300 * time.Millisecond
    clientTimeout  = 1 * time.Second
    serverTimeout  = 2 * time.Second
    attackDuration = 10 * time.Second
)
```
These hard-coded sleeps are flaky on loaded CI runners. The test asserts `metrics.Requests >= 2` after a 300ms delay at 10 req/s — that's only ~3 requests, with no margin. Under `-race` on a slow runner this will intermittently fail.

### 3.15 `attack_test.go`: `decodeMetrics` ignores `metrics.Close()` error
```go
metrics.Close()
return metrics, nil
```
`Close()` returns an error in the vegeta API; ignoring it hides histogram/quantile computation failures.

### 3.16 `attack_test.go`: `TestAttackSignalTwice` doesn't verify the second signal path
The test sends two signals and checks duration, but doesn't assert that the attack actually stopped *because* of the second signal (vs. the first). It's a weak test.

## 4. Repository hygiene

### 4.1 `CHANGELOG` is stale
The file's most recent entry is `2018-05-18: v7.0.0`, but the module is `v12`. The changelog has been abandoned for ~6 major versions. Either maintain it or remove it in favor of GitHub Releases.

### 4.2 `go.sum` contains stale entries
The truncated `go.sum` shows both `github.com/cespare/xxhash/v2 v2.2.0` and `v2.3.0`, and both `github.com/golang/protobuf v1.5.3` and `v1.5.4`. This is normal for `go.sum` (it keeps historical hashes), but combined with `go.mod` pinning `v2.3.0`/`v1.5.4`, it suggests `go mod tidy` hasn't been run recently. Worth verifying.

### 4.3 `.github/dependabot.yml` has trailing whitespace
```yaml
    directory: "/" 
```
Trailing space after `"/"`. Trivial, but it's the kind of thing a linter would catch.

### 4.4 `CODEOWNERS` lists two users
```
* @tsenart @xla
```
If either is inactive, PRs will stall. Not a bug, but worth noting for a project with a single maintainer historically.

### 4.5 No `SECURITY.md`
For a tool that handles TLS certs, GPG signing keys, and network traffic, a security policy is expected.

### 4.6 `scripts/load-ramping/` is orphaned
The directory contains a Python script and gnuplot file with no reference from the Makefile, README, or CI. Either document it or remove it.

### 4.7 `lib/prom/prometheus-sample.png` is committed
A binary sample image in the source tree. It's referenced from the README presumably, but it bloats the repo and isn't needed for the build.

## 5. Security / correctness concerns

### 5.1 `InsecureSkipVerify` is exposed but not warned about
```go
c := tls.Config{InsecureSkipVerify: insecure}
```
`-insecure` disables cert verification with no runtime warning. For a load-testing tool this is expected, but a stderr warning would be prudent.

### 5.2 `net.DefaultResolver` is mutated globally
```go
net.DefaultResolver = res
net.DefaultResolver.PreferGo = true
```
This mutates process-global state. In a library context (if `attack()` were ever called from a test or embedded), this leaks across invocations. It's in `package main`, so the blast radius is limited, but it's still a code smell.

### 5.3 `promAddr` default is `0.0.0.0:8880`
```go
promAddr: "0.0.0.0:8880",
```
The Prometheus exporter binds to all interfaces by default. For a tool often run on developer laptops and CI runners, `127.0.0.1:8880` would be a safer default. The help text says `[empty = disabled]`, but the default is non-empty, so the exporter is *on* by default — contradicting the help text's implication.

### 5.4 `headers.Set` bypasses canonicalization intentionally
```go
// http.Header.Add() canonicalizes keys but vegeta is used
// to test systems that require case-sensitive headers.
h.Header[key] = append(h.Header[key], val)
```
This is documented and intentional, but it means `-header "content-type: ..."` and `-header "Content-Type: ..."` produce different wire headers. That's the point, but it's a footgun worth calling out in the README.

## 6. Minor / stylistic

- `attack.go`: `errZeroRate` is declared but never used in the shown code. Dead variable.
- `attack.go`: `files` map is keyed by filename, so passing the same file for `-targets` and `-body` would collide. Edge case, but real.
- `encode.go`: `encodeUsage` is a raw string with inconsistent indentation (3 spaces for the numbered list, 2 for options). Cosmetic.
- `flags.go`: `localAddr.Set` doesn't validate that the resolved address is IPv4/IPv6 as expected.
- `attack_test.go`: `TestHeadersSet` uses `t.Error` instead of `t.Fatal` in a loop, so it continues after a failure and may produce confusing output.

## Summary of highest-impact issues

| # | Issue | Impact |
|---|-------|--------|
| 1.1 | `steps.sign.outputs.version` vs `outputs.name` mismatch | Releases broken |
| 2.1 | Dockerfile uses Go 1.20, module requires 1.22 | Docker build broken |
| 3.3 | `PreferGo = true` set unconditionally | Silent DNS behavior change |
| 3.6 | `connectToFlag.Set` returns nil on nil map | Flag silently ignored |
| 3.7 | `connectToFlag` splits on `:` | IPv6 unsupported |
| 3.11 | `decoder` leaks file handles on error | Resource leak |
| 5.3 | Prometheus exporter binds `0.0.0.0` by default | Unintended network exposure |
| 4.1 | CHANGELOG stale since v7 | Misleading docs |

The release-pipeline bug (§1.1) and the Dockerfile Go-version mismatch (§2.1) are the two that will actually break things for users today.
