# Repository Review: `fatfree`

This is the F3 (Fat-Free Framework) starter/skeleton project. Below are the concrete problems I found, grouped by severity.

---

## High severity

### 1. `DEBUG` is set to `3` in `config.ini` and then overridden to `1` in `index.php`
`config.ini` ships with:
```ini
DEBUG=3
```
and `index.php` immediately does:
```php
$f3->set('DEBUG',1);
```
before loading the config. This is contradictory and confusing:
- `DEBUG=3` is the most verbose level (includes stack traces, SQL logging, etc.) and is a **production security risk** if a user deploys this skeleton as-is.
- The hard-coded `$f3->set('DEBUG',1)` in `index.php` is then overwritten by `config.ini`'s `DEBUG=3` when `$f3->config('config.ini')` runs, so the effective value is `3`. The intent of the line in `index.php` is defeated.

A starter project should default to `DEBUG=0` (or at most `1`) and let the user opt in.

### 2. `.htaccess` blocks `app/` and `tmp/` but not `lib/`, `ui/`, `vendor/`, or `config.ini`
```apache
RewriteRule ^(app|tmp)\/|\.ini$ - [R=404]
```
Problems:
- The regex `^(app|tmp)\/|\.ini$` is an alternation with no grouping around the whole pattern. It matches either `^(app|tmp)/` **or** `\.ini$`. That part is fine, but it only protects `app/` and `tmp/` — directories that don't even exist in this repo.
- `lib/` (the framework source, including `base.php`) is **web-accessible**. The `welcome.htm` template itself warns: *"For security reasons, consider relocating the `lib/` folder to a path that's not Web-accessible."* The shipped `.htaccess` should enforce this, not just advise it.
- `vendor/` (Composer dependencies) is also web-accessible.
- `config.ini` is protected by the `\.ini$` rule, but `composer.json`, `composer.lock`, `readme.md`, `SECURITY.md`, and `.gitmodules` are all served as static files.

### 3. `RewriteRule` ordering bug — the `HTTP_AUTHORIZATION` rule is unreachable
```apache
RewriteRule .* index.php [L,QSA]
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization},L]
```
The first rule has the `[L]` (last) flag, so the second rule **never executes**. The intent (forwarding the `Authorization` header to PHP, needed for HTTP Basic auth under CGI/FastCGI) is silently broken. The `E=HTTP_AUTHORIZATION` rule must come **before** the catch-all `index.php` rule.

### 4. `index.php` sets `DEBUG` before loading config, then config overrides it
As noted in #1, the ordering is wrong. If the intent is to force `DEBUG=1` for the skeleton, it must be set **after** `$f3->config('config.ini')`. As written, the line is dead code.

### 5. `PCRE_VERSION` check is obsolete and misleading
```php
if ((float)PCRE_VERSION<8.0)
    trigger_error('PCRE version is out of date');
```
- `PCRE_VERSION` is a string like `"10.42 2022-12-11"`. Casting it to `(float)` yields `10.42`, which is fine for the comparison, but the check is meaningless: PHP 7.2+ (the stated minimum) bundles PCRE2 ≥ 10.x. The check can never fire on a supported PHP version.
- It also uses `trigger_error` with no severity, defaulting to `E_USER_NOTICE`, which is easily missed.

---

## Medium severity

### 6. `composer.json` is missing `require` constraints and metadata
```json
"require": {
    "bcosca/fatfree-core": "^3.8"
}
```
- No `php` version constraint, even though the readme explicitly states **PHP 7.2+** is required. Composer will happily install this on PHP 5.6 and the app will fatal.
- No `autoload` section, no `scripts`, no `config` (e.g. `optimize-autoloader`).
- `"type": "project"` is correct for a skeleton, but there is no `minimum-stability` / `prefer-stable` guidance.

### 7. `index.php` mixes Composer and submodule loading with a fragile check
```php
if (file_exists('vendor/autoload.php')) {
    require_once('vendor/autoload.php');
    $f3 = \Base::instance();
} elseif (!file_exists('lib/base.php')) {
    die('fatfree-core not found. ...');
} else {
    $f3=require('lib/base.php');
}
```
- The `die()` message is emitted as plain text with no HTTP status code. A missing dependency should return `500`, not `200`.
- `file_exists('vendor/autoload.php')` is relative to the **current working directory**, not the script directory. Under some SAPI configurations (e.g. when `index.php` is included from another directory), this check fails. Should use `__DIR__ . '/vendor/autoload.php'`.
- Same issue for `lib/base.php`.

### 8. `ui/layout.htm` hard-codes a `<base>` tag with `$PORT`
```html
<base href="<?php echo $SCHEME.'://'.$HOST.':'.$PORT.$BASE.'/'; ?>" />
```
- Always appending `:$PORT` produces broken URLs on standard ports (`http://example.com:80/`, `https://example.com:443/`). Browsers tolerate this, but it breaks relative links in some contexts and looks unprofessional.
- The `<base>` tag also affects all relative URLs, including the `href="lib/code.css"` on the next line — which points into the web-accessible `lib/` directory (see #2).

### 9. `ui/layout.htm` references `lib/code.css` which is not in this repo
```html
<link rel="stylesheet" href="lib/code.css" type="text/css" />
```
`lib/` is a git submodule (`fatfree-core`). Whether `code.css` exists there is not guaranteed by this repo's contents. If the submodule isn't initialized, this 404s. The skeleton should not depend on a file inside a submodule for its own layout.

### 10. `ui/userref.htm` reads `readme.md` from the filesystem on every request
```php
<?php echo Markdown::instance()->convert(Base::instance()->read('readme.md')); ?>
```
- No caching. The readme is 121 KB; parsing it with the Markdown plugin on every hit to `/userref` is wasteful.
- `Base::instance()->read('readme.md')` uses a relative path, so it depends on the CWD.
- If `readme.md` is missing, this throws an uncaught exception rather than a 404.

### 11. `welcome.htm` contains stale/incorrect documentation
- *"The `Bcrypt` class will use the `mcrypt` or `openssl` module"* — `mcrypt` was **removed in PHP 7.2** and is deprecated/removed. This is misleading.
- *"We're on the FreeNode (`chat.freenode.net`) `#fatfree` channel"* — Freenode collapsed in 2021; the channel no longer exists. The Slack invite link (`fatfreeframework-slack.herokuapp.com`) is also a Heroku free-tier app that is very likely dead.
- The Google Groups link uses the old `#!forum/` fragment syntax.
- *"Copyright © 2009-2025"* — fine, but the readme says the framework requires PHP 7.2+ while the welcome page still references `mcrypt`.

### 12. `SECURITY.md` exposes a personal email with no PGP key or process
```
please report security issues to <ikkez0n3@gmail.com>
```
- No PGP key, no disclosure timeline, no scope definition, no "please do not open public issues" guidance.
- A Gmail address for security reports is not ideal; a dedicated alias or GitHub Security Advisories would be better.

### 13. `.gitignore` is incomplete
```
/tmp/
/.idea/
```
Missing common entries for a PHP project:
- `/vendor/` (Composer dependencies — should never be committed)
- `composer.lock` (debatable for a library, but this is a `type: project`, so it **should** be committed; the point is it's not ignored, which is correct, but the absence of `/vendor/` is a real bug)
- `.DS_Store`, `Thumbs.db`
- `*.log`, `.env`, `.env.*`
- `/.vscode/`, `/.phpunit.result.cache`

The absence of `/vendor/` means a developer running `composer install` will see the entire dependency tree as untracked and may accidentally commit it.

### 14. `.htaccess` has no `Options -Indexes` or `DirectoryIndex` hardening
Directory listing is not disabled. If `mod_autoindex` is on and a directory has no index file, contents are listed. For a security-conscious skeleton, add:
```apache
Options -Indexes
```

---

## Low severity / style

### 15. `index.php` uses `array(...)` long syntax and inconsistent indentation
The `$classes` array mixes tabs and spaces, and uses the legacy `array()` constructor throughout. For a project targeting PHP 7.2+, `[]` is preferred and the file is otherwise modern.

### 16. `index.php` uses `PCRE_VERSION` without importing/qualifying
Minor, but `PCRE_VERSION` is a global constant; in a namespaced context this would fail. Not an issue here since the file is not namespaced, but worth noting.

### 17. `config.ini` has no `[routes]` or environment-specific sections
A skeleton config typically includes commented-out examples for `[globals]`, `[routes]`, and `[database]`. This one only has `DEBUG` and `UI`.

### 18. `readme.md` is enormous (121 KB) and duplicated as the `/userref` page
The readme is the entire user guide. This bloats the repo and makes the `/userref` route expensive (see #10). It would be better to link to the online docs or split the guide into a separate repo (which the readme itself mentions: `F3com-data`).

### 19. `ui/css/base.css` uses `overflow:hidden` on `div,table`
```css
div,table{overflow:hidden}
```
This is a heavy-handed reset that breaks `position:sticky`, dropdowns, and any content that needs to overflow. It's a known footgun.

### 20. `ui/css/base.css` sets `body{overflow:hidden}` and `html{overflow-y:scroll}`
Combined with `min-height:100%`, this can cause double scrollbars or clipped content on some browsers. The `overflow:hidden` on `body` is particularly aggressive for a base stylesheet.

### 21. `theme.css` uses `!important` unnecessarily
```css
table {
    color:#666 !important;
}
```
No competing rule justifies `!important`. It makes the theme harder to override.

### 22. `layout.htm` uses `<?php echo $ENCODING; ?>` without a default
If `ENCODING` is not set (it is set by F3 by default, but still), the `charset` attribute is empty. Minor.

### 23. No `LICENSE` file
`composer.json` declares `"license": "GPL-3.0"` and the readme/welcome page discuss GPL v3, but there is **no `LICENSE` file** in the repository root. GitHub and Composer both expect one.

### 24. No `CHANGELOG.md`, `CONTRIBUTING.md`, or issue/PR templates
For a project that is the public entry point to a widely-used framework, these are expected.

### 25. `.gitmodules` points to `fatfree-core` but `composer.json` also requires it
Having both a submodule and a Composer dependency for the same library is redundant and confusing. `index.php` handles both, but a user following the readme may end up with two copies. Pick one distribution method.

### 26. `index.php` `die()` message uses backticks in plain text
```
die('fatfree-core not found. Run `git submodule init` ...');
```
Backticks are Markdown, not shell. In a terminal or browser this renders literally. Minor, but sloppy.

### 27. `welcome.htm` uses `onclick="return false"` on checkboxes
```html
<input type="checkbox" ... onclick="return false">
```
This is a hack to make checkboxes read-only. `disabled` or `readonly` (with proper styling) is cleaner and more accessible. Also, `onclick="return false"` does not prevent keyboard toggling in all browsers.

### 28. `welcome.htm` links to `https://github.com/bcosca/fatfree` for docs
The readme says the canonical docs are at `fatfreeframework.com` and the source at `F3Community/F3com-data`. The welcome page's "latest and most comprehensive information" link points to the GitHub repo, which is inconsistent.

---

## Summary of the most important fixes

| # | Issue | Fix |
|---|-------|-----|
| 1 | `DEBUG=3` shipped by default | Set `DEBUG=0` in `config.ini` |
| 2 | `lib/`, `vendor/` web-accessible | Add `RewriteRule ^(lib|vendor|app|tmp)/ - [R=404]` |
| 3 | `HTTP_AUTHORIZATION` rule unreachable | Move it before the `index.php` catch-all |
| 4 | `DEBUG` set before config load | Move `$f3->set('DEBUG', ...)` after `$f3->config(...)` |
| 5 | No `php` constraint in `composer.json` | Add `"php": ">=7.2"` |
| 6 | `/vendor/` not in `.gitignore` | Add it |
| 7 | No `LICENSE` file | Add GPL-3.0 text |
| 8 | Stale `mcrypt`/Freenode references | Update or remove |
| 9 | `readme.md` parsed on every `/userref` hit | Cache the rendered HTML |
| 10 | Relative `file_exists`/`read` paths | Use `__DIR__` |
