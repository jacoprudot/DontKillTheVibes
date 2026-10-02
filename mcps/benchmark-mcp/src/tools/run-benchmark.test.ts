import { runBenchmark } from './run-benchmark.js';
import { Sandbox } from '../sandbox.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

// Element after `flag` in args (noUncheckedIndexedAccess-safe).
function argAfter(args: string[], flag: string): string {
  const value = args[args.indexOf(flag) + 1];
  if (typeof value !== 'string') {
    throw new Error(`mock setup error: ${flag} not followed by a value in ${JSON.stringify(args)}`);
  }
  return value;
}

const WRK_STDOUT = `Running 10s test @ http://localhost:3000/api
  2 threads and 10 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    10.00ms    2.00ms   50.00ms   90.00%
    Req/Sec    500.00     50.00   800.00     70.00%
  10000 requests in 10.01s, 2.00MB read
Requests/sec:    999.00
Transfer/sec:    204.76KB`;

describe('runBenchmark tool', () => {
  let tempWorkspace: string;
  let sandbox: Sandbox;
  let execSpy: jest.SpyInstance;
  let execCalls: Array<{ bin: string; args: string[] }>;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'runbenchmark-test-'));
    sandbox = new Sandbox(tempWorkspace);
    execCalls = [];
    execSpy = jest
      .spyOn(sandbox, 'execSandbox')
      .mockImplementation((bin: string, args: string[]) => {
        execCalls.push({ bin, args });
        if (bin === 'wrk') return WRK_STDOUT;
        if (bin === 'k6') return 'k6 raw output';
        if (bin === 'jmeter') {
          // Simulate jmeter writing its results file (-l <outputFile>)
          fs.writeFileSync(argAfter(args, '-l'), 'timeStamp,elapsed,label\n1,100,req1\n2,110,req2');
          return '';
        }
        throw new Error(`unexpected binary ${bin}`);
      });
  });

  afterEach(() => {
    execSpy.mockRestore();
    sandbox.cleanup();
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  });

  it('should run a wrk benchmark and parse its stdout', async () => {
    const result = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api',
      duration_sec: 10,
      connections: 10
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.template).toBe('wrk');
    expect(payload.data.results.requests_per_second).toBe(999);
    expect(payload.data.results.transfer_per_second).toBe('204.76KB');
    expect(payload.data.results.latency_avg).toBe('10.00ms');
    const { bin, args } = execCalls[0]!;
    expect(bin).toBe('wrk');
    expect(args).toContain('-t10');
    expect(args).toContain('-c10');
    expect(args).toContain('-d10s');
  });

  it('should reject file:// target URLs', async () => {
    const result = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'file:///etc/passwd'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_TARGET_URL');
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('should reject user-supplied scripts (RCE guard)', async () => {
    const result = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api',
      script: 'os.execute("rm -rf /")'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('CUSTOM_SCRIPT_FORBIDDEN');
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('should honor duration_sec for k6 and write the built-in script', async () => {
    const result = await runBenchmark(sandbox, {
      template: 'k6',
      target_url: 'http://localhost:3000/api/articles',
      duration_sec: 7
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    const { bin, args } = execCalls[0]!;
    expect(bin).toBe('k6');
    expect(args[args.indexOf('--duration') + 1]).toBe('7s');
    const scriptPath = args[args.length - 1]!;
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    expect(scriptContent).toContain('localhost:3000/api/articles');
    // The generated script must come from the built-in template (no raw user code)
    expect(scriptContent).not.toContain('os.execute');
  });

  it('should run jmeter via the generated test plan and parse the results file', async () => {
    const result = await runBenchmark(sandbox, {
      template: 'jmeter',
      target_url: 'http://localhost:3000/api',
      connections: 5,
      duration_sec: 15
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    const { bin, args } = execCalls[0]!;
    expect(bin).toBe('jmeter');
    expect(args).toContain('-n');
    expect(payload.data.results.format).toContain('JMeter');
    expect(payload.data.results.has_data).toBe(true);
    const jmxPath = argAfter(args, '-t');
    expect(fs.readFileSync(jmxPath, 'utf8')).toContain('localhost');
  });

  it('should return BENCHMARK_FAILED when wrk produces no output', async () => {
    execSpy.mockImplementation(() => {
      throw new Error('wrk: command not found');
    });
    const result = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('BENCHMARK_FAILED');
    expect(payload.error.retryable).toBe(true);
  });

  it('should keep partial stdout from a failing wrk run and parse it', async () => {
    execSpy.mockImplementation(() => {
      throw Object.assign(new Error('wrk exited 1'), { stdout: WRK_STDOUT });
    });
    const result = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api'
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.results.requests_per_second).toBe(999);
  });

  it('should reject non-positive duration and connections', async () => {
    const r1 = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api',
      duration_sec: 0
    });
    expect(parse(r1).error.code).toBe('INVALID_ARGUMENTS');
    const r2 = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api',
      connections: -1
    });
    expect(parse(r2).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject non-integer connections that would be injected into the JMX', async () => {
    const payloads = [
      '1</stringProp><JSR223Sampler guiclass="TestBeanGUI"/>',
      '10' // numeric string, still not a number
    ];
    for (const connections of payloads) {
      const result = await runBenchmark(sandbox, {
        template: 'jmeter',
        target_url: 'http://localhost:3000/api',
        connections: connections as unknown as number
      });
      const payload = parse(result);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('INVALID_ARGUMENTS');
      expect(payload.error.message).toContain('connections');
    }
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('should reject non-finite and fractional benchmark arguments', async () => {
    const cases: Array<Record<string, unknown>> = [
      { connections: Number.NaN },
      { connections: Number.POSITIVE_INFINITY },
      { connections: 1.5 },
      { duration_sec: 'x' },
      { duration_sec: Number.NaN },
      { duration_sec: 1.5 },
      { duration_sec: 86401 },
      { connections: 10001 }
    ];
    for (const extra of cases) {
      const args: any = {
        template: 'wrk',
        target_url: 'http://localhost:3000/api',
        ...extra
      };
      const result = await runBenchmark(sandbox, args);
      const payload = parse(result);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('INVALID_ARGUMENTS');
    }
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('should reject unsupported benchmark templates', async () => {
    const result = await runBenchmark(sandbox, {
      template: 'locust' as any,
      target_url: 'http://localhost:3000/api'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_ARGUMENTS');
    expect(payload.error.message).toContain('locust');
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('should fail when wrk succeeds but produces no output', async () => {
    execSpy.mockReturnValue('');
    const result = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('BENCHMARK_FAILED');
    expect(payload.error.message).toContain('no output');
  });

  it('should fail when jmeter errors and no output file exists', async () => {
    execSpy.mockImplementation(() => {
      throw new Error('jmeter crashed');
    });
    const result = await runBenchmark(sandbox, {
      template: 'jmeter',
      target_url: 'http://localhost:3000/api'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('BENCHMARK_FAILED');
  });

  it('should fail when jmeter writes no output file', async () => {
    execSpy.mockImplementation(() => ''); // success, but no results file written
    const result = await runBenchmark(sandbox, {
      template: 'jmeter',
      target_url: 'http://localhost:3000/api'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('BENCHMARK_FAILED');
    expect(payload.error.message).toContain('No benchmark output');
  });

  it('should return INTERNAL_ERROR when the sandbox temp dir cannot be created', async () => {
    jest.spyOn(sandbox, 'createTempDir').mockImplementation(() => {
      throw new Error('no temp space');
    });
    const result = await runBenchmark(sandbox, {
      template: 'wrk',
      target_url: 'http://localhost:3000/api'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.retryable).toBe(true);
  });
});
