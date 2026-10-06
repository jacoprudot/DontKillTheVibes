# Assessment Report: fatfree

- **Repository**: fatfree
- **Date**: 2026-10-05T16:12:19.757Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: D
- **Critical Findings**: —
- **Total Findings**: 8
- **By Severity**: high 2 · medium 5 · info 1
- **Estimated Total Effort**: 2×XS, 1×S, 5×M
- **Top 3 Priorities**:
  - `security-debug-in-prod-1` — DEBUG is set to 3 in config.ini, which enables verbose debug output including full error traces, SQL query logging, and internal state… (high, XS)
  - `security-error-detail-1` — index.php unconditionally sets DEBUG to 1, which causes the framework's error handler to render raw exception messages, file paths, and… (info, XS)
  - `security-missing-headers-10` — The application layout emits no security headers. (medium, S)

---

## Detailed Findings (by Priority)

### Priority 1: `security-debug-in-prod-1`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.95
**Location**: `config.ini:3`
**Description**: DEBUG is set to 3 in config.ini, which enables verbose debug output including full error traces, SQL query logging, and internal state dumps. index.php also hardcodes $f3->set('DEBUG',1) at line 17, overriding the config value. Shipping a production application with debug mode enabled exposes stack traces, file paths, and potentially sensitive runtime data to end users.
**Remediation**: Set DEBUG=0 in config.ini for production deployments and remove or guard the hardcoded $f3->set('DEBUG',1) in index.php so it is only active in development environments (e.g., driven by an environment variable).
**Evidence**:
```
[globals]

DEBUG=3
UI=ui/
```
**Depends On**: `security-error-detail-1` | **Blocks**: None

### Priority 2: `security-error-detail-1`
**Module**: security | **Severity**: info | **Effort**: XS | **Confidence**: 0.9
**Location**: `index.php:17`
**Description**: index.php unconditionally sets DEBUG to 1, which causes the framework's error handler to render raw exception messages, file paths, and stack traces directly to the HTTP client. Combined with the config.ini DEBUG=3 setting, any unhandled error will leak internal implementation details to the browser.
**Remediation**: Wrap the DEBUG assignment in an environment check (e.g., only set DEBUG when an APP_ENV variable equals 'development') and ensure production error responses return a generic message while logging full details server-side.
**Evidence**:
```
$f3->set('DEBUG',1);
if ((float)PCRE_VERSION<8.0)
	trigger_error('PCRE version is out of date');
```
**Depends On**: None | **Blocks**: `security-debug-in-prod-1`, `flows-missing-error-handler-5`

### Priority 3: `security-missing-headers-10`
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.85
**Location**: `ui/layout.htm:4`
**Description**: The application layout emits no security headers. There is no Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, or Referrer-Policy. Without these headers the application is exposed to clickjacking, MIME-sniffing attacks, and cross-site scripting escalation. The layout template is the single choke point where all pages are rendered, making it the natural place to inject header middleware.
**Remediation**: Add a before-route handler in index.php that calls header() with Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Strict-Transport-Security, and Referrer-Policy: no-referrer before any output is sent.
**Evidence**:
```
<head>
		<meta charset="<?php echo $ENCODING; ?>" />
		<title>Powered by <?php echo $PACKAGE; ?></title>
```
**Depends On**: None | **Blocks**: None

### Priority 4: `flows-missing-error-handler-5`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `index.php:20`
**Description**: The application registers routes and calls $f3->run() without installing any global error or exception handler. Any uncaught exception in a route callback will fall through to the framework's default handler, which (with DEBUG enabled) dumps a full trace to the client and returns an inconsistent response shape. There is no centralized place to log errors, map them to HTTP status codes, or return a uniform error payload.
**Remediation**: Register a global error handler via $f3->set('ONERROR', function($f3){ ... }) that logs the exception and renders a generic error page with the appropriate HTTP status code, before $f3->run() is called.
**Evidence**:
```
$f3->config('config.ini');

$f3->route('GET /',
	function($f3) {
```
**Depends On**: `security-error-detail-1` | **Blocks**: None

### Priority 5: `flows-missing-rate-limit-8`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `index.php:22`
**Description**: The public GET / and GET /userref routes have no rate limiting. The /userref route reads and converts the entire readme.md file on every request via Markdown::instance()->convert(), which is CPU-intensive. Without rate limiting, an attacker can trivially exhaust server resources by repeatedly requesting this endpoint.
**Remediation**: Add rate limiting middleware (e.g., a before-route handler keyed on client IP using the framework's Cache class) to cap requests per minute on public endpoints, and cache the rendered markdown output rather than re-converting it on every request.
**Evidence**:
```
$f3->route('GET /userref',
	function($f3) {
		$f3->set('content','userref.htm');
```
**Depends On**: None | **Blocks**: `structure-layer-violation-1`

### Priority 6: `structure-layer-violation-1`
**Module**: structure | **Severity**: high | **Effort**: M | **Confidence**: 0.8
**Location**: `index.php:22`
**Description**: Route callbacks in index.php directly construct the view layer and echo rendered output inline (echo View::instance()->render('layout.htm')). Business logic, view selection, and response emission are all collapsed into the route closure with no separation between controller, service, and presentation layers. This makes the routes untestable in isolation and couples routing directly to template rendering.
**Remediation**: Extract route handlers into dedicated controller classes (e.g., WelcomeController, UserRefController) that set template variables and delegate rendering, keeping index.php limited to route registration and framework bootstrap.
**Evidence**:
```
$f3->route('GET /',
	function($f3) {
		$classes=array(
```
**Depends On**: `flows-missing-rate-limit-8` | **Blocks**: None

### Priority 7: `cost-no-http-compression-9`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.htaccess:1`
**Description**: The .htaccess file configures URL rewriting but contains no mod_deflate or mod_brotli directives. All responses, including the large readme.md rendered as HTML on /userref and the CSS files, are served uncompressed. Enabling compression would reduce bandwidth consumption by 60-80% for text-heavy responses.
**Remediation**: Add mod_deflate configuration to .htaccess to compress text/html, text/css, application/javascript, and application/json responses, or configure Brotli at the server level for better ratios.
**Evidence**:
```
# Enable rewrite engine and route requests to framework
RewriteEngine On
```
**Depends On**: None | **Blocks**: None

### Priority 8: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `composer.json:1`
**Description**: The project depends on bcosca/fatfree-core via Composer but there is no CI workflow and no dependency caching strategy. Every fresh checkout requires a full composer install, and the absence of a lock file (composer.lock is not present in the repository) means dependency resolution is non-deterministic and repeated on every install.
**Remediation**: Commit a composer.lock file to pin dependency versions, and if CI is added, cache the vendor/ directory or Composer cache between runs to avoid re-downloading dependencies.
**Evidence**:
```
"require": {
		"bcosca/fatfree-core": "^3.8"
	}
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-debug-in-prod-1`: Set DEBUG=0 in config.ini for production deployments and remove or guard the hardcoded $f3->set('DEBUG',1) in index.php so it is only active in development environments (e.g., driven by an… (XS)
- `security-error-detail-1`: Wrap the DEBUG assignment in an environment check (e.g., only set DEBUG when an APP_ENV variable equals 'development') and ensure production error responses return a generic message while logging… (XS)
- `security-missing-headers-10`: Add a before-route handler in index.php that calls header() with Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Strict-Transport-Security, and Referrer-Policy:… (S)

### 60 Days
- `flows-missing-error-handler-5`: Register a global error handler via $f3->set('ONERROR', function($f3){ ... (M)
- `flows-missing-rate-limit-8`: Add rate limiting middleware (e.g., a before-route handler keyed on client IP using the framework's Cache class) to cap requests per minute on public endpoints, and cache the rendered markdown… (M)
- `structure-layer-violation-1`: Extract route handlers into dedicated controller classes (e.g., WelcomeController, UserRefController) that set template variables and delegate rendering, keeping index.php limited to route… (M)

### 90 Days
- `cost-no-http-compression-9`: Add mod_deflate configuration to .htaccess to compress text/html, text/css, application/javascript, and application/json responses, or configure Brotli at the server level for better ratios. (M)
- `cost-gha-no-dependency-cache-5`: Commit a composer.lock file to pin dependency versions, and if CI is added, cache the vendor/ directory or Composer cache between runs to avoid re-downloading dependencies. (M)

---

## Dependencies
- `security-debug-in-prod-1` **Depends On** `security-error-detail-1` (blocks)
- `flows-missing-error-handler-5` **Depends On** `security-error-detail-1` (blocks)
- `structure-layer-violation-1` **Depends On** `flows-missing-rate-limit-8` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
