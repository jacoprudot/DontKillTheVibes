import { profileCode } from './profile-code.js';
import { Sandbox } from '../sandbox.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// The tool returns MCP content blocks whose text is a JSON payload:
// { success: true, data } or { success: false, error: { code, message, retryable } }
function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

// Returns the element after `flag` in args, throwing if absent (with
// noUncheckedIndexedAccess the naive indexOf+1 lookup yields string|undefined).
function argAfter(args: string[], flag: string): string {
  const value = args[args.indexOf(flag) + 1];
  if (typeof value !== 'string') {
    throw new Error(`mock setup error: ${flag} not followed by a value in ${JSON.stringify(args)}`);
  }
  return value;
}

describe('profileCode tool', () => {
  let tempWorkspace: string;
  let sandbox: Sandbox;
  let execSpy: jest.SpyInstance;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'profilecode-test-'));
    sandbox = new Sandbox(tempWorkspace);
    // Simulate the profiler creating its output file, keyed off the `-o`/`-result-dir` arg
    execSpy = jest.spyOn(sandbox, 'execSandbox').mockImplementation(
      (_bin: string, args: string[]) => {
        const flagIdx = args.indexOf('-o') !== -1 ? args.indexOf('-o') : args.indexOf('-result-dir');
        const outPath = argAfter(args, args[flagIdx] as string);
        fs.writeFileSync(outPath, 'fake-profile-data');
        return '';
      }
    );
  });

  afterEach(() => {
    execSpy.mockRestore();
    sandbox.cleanup();
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  });

  it('should profile an allowlisted binary with perf', async () => {
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: ['app.js'],
      profiler: 'perf',
      duration_sec: 5
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.binary).toBe('node');
    expect(payload.data.profiler).toBe('perf');
    expect(payload.data.profile_file).toMatch(/^profile-/);
    // perf must be invoked without a shell, with the allowlisted binary after `--`
    const [, args] = execSpy.mock.calls[0];
    expect(args).toContain('--');
    expect(args[args.indexOf('--') + 1]).toBe('node');
  });

  it('should accept python/python3 for cprofile', async () => {
    const result = await profileCode(sandbox, {
      binary: 'python3',
      args: ['script.py'],
      profiler: 'cprofile'
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    const [bin, args] = execSpy.mock.calls[0];
    expect(bin).toBe('python');
    expect(args.slice(0, 3)).toEqual(['-m', 'cProfile', '-o']);
  });

  it('should reject a non-allowlisted binary (RCE guard)', async () => {
    const result = await profileCode(sandbox, {
      binary: 'rm',
      args: ['-rf', '/'],
      profiler: 'perf'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('BINARY_NOT_ALLOWED');
    expect(payload.error.retryable).toBe(false);
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('should reject path-traversal binaries by basename match', async () => {
    const result = await profileCode(sandbox, {
      binary: '/usr/bin/rm',
      args: [],
      profiler: 'perf'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('BINARY_NOT_ALLOWED');
  });

  it('should support the vtune profiler with its own output flag', async () => {
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: ['app.js'],
      profiler: 'vtune'
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    const [bin, args] = execSpy.mock.calls[0]!;
    expect(bin).toBe('vtune');
    expect(args).toContain('-collect');
    expect(args).toContain('hotspots');
  });

  it('should reject args that are not an array', async () => {
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: 'app.js' as any,
      profiler: 'perf'
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject an unsupported profiler value', async () => {
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: [],
      profiler: 'strace' as any
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject non-allowlisted binary even with an allowed profiler', async () => {
    const result = await profileCode(sandbox, {
      binary: 'bash',
      args: ['-c', 'id'],
      profiler: 'cprofile'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('BINARY_NOT_ALLOWED');
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('should reject missing binary', async () => {
    const result = await profileCode(sandbox, {
      binary: '',
      args: [],
      profiler: 'perf'
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject NUL bytes in args', async () => {
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: ['ok.js\0evil'],
      profiler: 'perf'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject non-positive duration_sec', async () => {
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: [],
      profiler: 'perf',
      duration_sec: 0
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject jfr (Java not in allowlist)', async () => {
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: [],
      profiler: 'jfr'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('PROFILER_NOT_SUPPORTED');
  });

  it('should return PROFILING_FAILED when the profiler produces no output', async () => {
    execSpy.mockImplementation(() => {
      throw new Error('perf: command not found');
    });
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: [],
      profiler: 'perf'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('PROFILING_FAILED');
    expect(payload.error.retryable).toBe(true);
  });

  it('should succeed when the profiler exits non-zero but wrote output', async () => {
    execSpy.mockImplementation((_bin: string, args: string[]) => {
      fs.writeFileSync(argAfter(args, '-o'), 'partial-profile');
      throw Object.assign(new Error('exit 137'), { stdout: '' });
    });
    const result = await profileCode(sandbox, {
      binary: 'node',
      args: [],
      profiler: 'perf'
    });
    expect(parse(result).success).toBe(true);
  });
});
