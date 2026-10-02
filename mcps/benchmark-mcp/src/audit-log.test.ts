import { logAudit } from './audit-log.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// logAudit writes to process.cwd()/.dontkillthevibes/audit.log, so run each
// assertion inside a temp working directory.
describe('audit-log', () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function readLines(): any[] {
    const file = path.join(tempDir, '.dontkillthevibes', 'audit.log');
    return fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  }

  it('should append one JSON line per invocation with hashes, not content', () => {
    logAudit('tool_a', { secret: 'api-key-12345' }, { ok: true });
    logAudit('tool_b', null, { ok: false });
    const lines = readLines();
    expect(lines).toHaveLength(2);
    expect(lines[0].tool).toBe('tool_a');
    expect(lines[1].tool).toBe('tool_b');
    // Hashes are recorded — the raw secret must never appear
    const raw = fs.readFileSync(path.join(tempDir, '.dontkillthevibes', 'audit.log'), 'utf8');
    expect(raw).not.toContain('api-key-12345');
    expect(lines[0].args_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(lines[0].result_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(new Date(lines[0].ts).toString()).not.toBe('Invalid Date');
  });

  it('should hash null and undefined args deterministically', () => {
    logAudit('t', null, null);
    logAudit('t', undefined, undefined);
    const [a, b] = readLines();
    expect(a.args_hash).toBe(b.args_hash);
    expect(a.result_hash).toBe(b.result_hash);
  });

  it('should create the .dontkillthevibes directory on first write', () => {
    logAudit('first_call', {}, {});
    expect(fs.existsSync(path.join(tempDir, '.dontkillthevibes', 'audit.log'))).toBe(true);
  });

  it('should never throw even when writing is impossible', () => {
    // Make .dontkillthevibes exist as a FILE so mkdirSync fails with ENOTDIR.
    // fs built-in exports cannot be spied on in modern Node, so force a real
    // filesystem error instead of mocking.
    fs.writeFileSync(path.join(tempDir, '.dontkillthevibes'), 'i am a file');
    expect(() => logAudit('t', {}, {})).not.toThrow();
  });
});
