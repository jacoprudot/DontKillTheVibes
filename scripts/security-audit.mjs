#!/usr/bin/env node
/**
 * security-audit.mjs — offline, deterministic security audit for a custom MCP package.
 *
 * This replaces the previous `echo "Security audit placeholder" && exit 0`
 * stub, which reported success without checking anything.
 *
 * It enforces the invariants the MCPs actually rely on:
 *   1. No shell execution: `shell: true`, execSync / exec / execFile / spawn / spawnSync
 *   2. No dynamic code evaluation: eval(), new Function()
 *   3. No blanket environment inheritance: `...process.env` spread into a child
 *   4. Every MCP package ships a SECURITY.md
 *
 * It warns (does not fail) when execFileSync's binary is a variable rather than a
 * literal, since an allowlist may legitimately guard it upstream.
 *
 * Usage: node scripts/security-audit.mjs [packageDir]   (default: cwd)
 * Exit 0 = clean, 1 = violations.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const pkgDir = resolve(process.argv[2] || '.');

const FORBIDDEN = [
  { re: /shell\s*:\s*true/, msg: 'shell: true enables shell interpretation (command injection)' },
  { re: /(?<!\.)\bexecSync\s*\(/, msg: 'execSync runs a command string through a shell' },
  { re: /(?<!\.)\bexec\s*\(/, msg: 'exec() runs a command string through a shell' },
  { re: /(?<!\.)\bexecFile\s*\(/, msg: 'execFile() is async; use execFileSync with an argv array for these tools' },
  { re: /(?<!\.)\bspawnSync\s*\(/, msg: 'spawnSync is not used in this codebase; justify it explicitly' },
  { re: /(?<!\.)\bspawn\s*\(/, msg: 'spawn() is not used in this codebase; justify it explicitly' },
  { re: /(?<!\.)\beval\s*\(/, msg: 'eval() executes arbitrary code' },
  { re: /new\s+Function\s*\(/, msg: 'new Function() compiles arbitrary code' },
  { re: /\.\.\.\s*process\.env/, msg: 'spreading process.env leaks the whole host environment into children' },
];

const WARN = [
  {
    re: /execFileSync\s*\(\s*(?!['"`])/,
    msg: 'execFileSync binary is not a string literal — confirm it is allowlisted',
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'coverage') {
        walk(full, out);
      }
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

let violations = 0;
let warnings = 0;
const srcDir = join(pkgDir, 'src');

if (!existsSync(pkgDir)) {
  console.error(`security-audit: package directory not found: ${pkgDir}`);
  process.exit(2);
}

if (!existsSync(join(pkgDir, 'SECURITY.md'))) {
  violations++;
  console.error('FAIL: SECURITY.md is missing — document what is and is not enforced.');
}

const files = existsSync(srcDir) ? walk(srcDir) : [];

for (const file of files) {
  const rel = relative(pkgDir, file).split('\\').join('/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of FORBIDDEN) {
      if (rule.re.test(line)) {
        violations++;
        console.error(`FAIL ${rel}:${i + 1}: ${rule.msg}`);
      }
    }
    for (const rule of WARN) {
      if (rule.re.test(line)) {
        warnings++;
        console.warn(`WARN ${rel}:${i + 1}: ${rule.msg}`);
      }
    }
  });
}

const name = relative(process.cwd(), pkgDir) || pkgDir;
if (violations > 0) {
  console.error(`\nsecurity-audit: ${violations} violation(s) in ${name} (${files.length} file(s) scanned)`);
  process.exit(1);
}
console.log(
  `security-audit: OK — ${name} (${files.length} file(s) scanned, ${warnings} warning(s))`
);
