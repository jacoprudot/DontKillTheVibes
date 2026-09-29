#!/usr/bin/env node
/**
 * validate-mcps.mjs — minimal validator for mcps/* workspace packages
 *
 * Checks per MCP package directory:
 *  1. package.json exists and has non-empty "name" and "version"
 *  2. src/index.ts exists
 *
 * Exits non-zero on any failure.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const mcpsDir = join(root, 'mcps');

let failures = 0;
let checked = 0;
const fail = (pkg, msg) => {
  failures++;
  console.error(`FAIL ${pkg}: ${msg}`);
};

for (const dir of readdirSync(mcpsDir).sort()) {
  const pkgDir = join(mcpsDir, dir);
  if (!statSync(pkgDir).isDirectory()) continue;
  checked++;
  const pkgJsonPath = join(pkgDir, 'package.json');

  if (!existsSync(pkgJsonPath)) {
    fail(`mcps/${dir}`, 'missing package.json');
    continue;
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  } catch {
    fail(`mcps/${dir}`, 'package.json is not valid JSON');
    continue;
  }

  if (!pkg.name || typeof pkg.name !== 'string') fail(`mcps/${dir}`, 'package.json missing "name"');
  if (!pkg.version || typeof pkg.version !== 'string') fail(`mcps/${dir}`, 'package.json missing "version"');
  if (!existsSync(join(pkgDir, 'src', 'index.ts'))) fail(`mcps/${dir}`, 'missing src/index.ts');
}

if (failures > 0) {
  console.error(`\nvalidate-mcps: ${failures} failure(s) across ${checked} package(s)`);
  process.exit(1);
}
console.log(`validate-mcps: OK — ${checked} MCP package(s) valid`);
