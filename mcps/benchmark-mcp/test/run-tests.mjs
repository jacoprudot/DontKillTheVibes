// test/run-tests.mjs — run the real jest binary with a package-local temp dir.
//
// Tests create scratch workspaces with fs.mkdtempSync(os.tmpdir()). Under
// `turbo run test` on Windows, parallel jest processes plus antivirus scanning
// race on the shared OS temp dir and mkdtemp intermittently fails with EPERM.
// node:os caches os.tmpdir() at first load, so the env override must happen
// before jest starts — a jest setupFile runs too late. Spawning the real bin
// keeps resolution/argv behavior byte-identical to the old `jest` script.
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const tmp = join(process.cwd(), '.test-tmp');
mkdirSync(tmp, { recursive: true });
process.env.TMPDIR = tmp;
process.env.TMP = tmp;
process.env.TEMP = tmp;

// pnpm links jest into the package's node_modules (same target the .bin shim
// uses). The package's exports map blocks subpath resolution, so go through
// the symlink directly.
const jestBin = join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');
if (!existsSync(jestBin)) {
  console.error(`jest binary not found at ${jestBin} — run pnpm install first`);
  process.exit(1);
}
const { status, signal, error } = spawnSync(process.execPath, [jestBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});
if (error) throw error;
process.exit(status === null ? 1 : status);
