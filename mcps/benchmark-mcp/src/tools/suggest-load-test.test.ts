import { suggestLoadTest } from './suggest-load-test.js';
import { Sandbox } from '../sandbox.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

// Extracts the JSON object assigned to `const options = ...` in the generated k6 script
function extractK6Options(k6Script: string): { stages?: Array<{ target: number }>; vus?: number } {
  const m = k6Script.match(/const options = (\{.*?\});/s);
  if (!m || m[1] === undefined) throw new Error('options object not found in generated k6 script');
  return JSON.parse(m[1]);
}

describe('suggestLoadTest tool', () => {
  let tempWorkspace: string;
  let sandbox: Sandbox;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest-test-'));
    sandbox = new Sandbox(tempWorkspace);
  });

  afterEach(() => {
    sandbox.cleanup();
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  });

  const endpoint = { url: 'http://localhost:3000/api/articles' };

  it('should generate k6 and wrk scripts for the steady pattern', async () => {
    const result = await suggestLoadTest(sandbox, {
      traffic_pattern: 'steady',
      endpoints: [endpoint]
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.traffic_pattern).toBe('steady');
    expect(typeof payload.data.k6_script).toBe('string');
    expect(typeof payload.data.wrk_script).toBe('string');
    expect(payload.data.k6_script).toContain('localhost:3000/api/articles');
    expect(payload.data.k6_script).not.toContain('__OPTIONS__');
    expect(payload.data.k6_script).not.toContain('__ENDPOINTS__');
    expect(extractK6Options(payload.data.k6_script).vus).toBe(10);
    expect(payload.data.wrk_script).toContain('/api/articles');
  });

  it('should build spike stages with 10x peak', async () => {
    const result = await suggestLoadTest(sandbox, {
      traffic_pattern: 'spike',
      endpoints: [endpoint]
    });
    const payload = parse(result);
    const stages = extractK6Options(payload.data.k6_script).stages!;
    expect(stages).toHaveLength(4);
    expect(stages[1]!.target).toBe(stages[0]!.target * 10);
    expect(stages[3]!.target).toBe(0);
  });

  it('should build ramp stages ending at 0 and honor methods/bodies', async () => {
    const result = await suggestLoadTest(sandbox, {
      traffic_pattern: 'ramp',
      endpoints: [endpoint, { url: 'http://localhost:3000/api/tags', method: 'POST', body: '{}' }]
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    const stages = extractK6Options(payload.data.k6_script).stages!;
    expect(stages).toHaveLength(3);
    expect(stages[2]!.target).toBe(0);
    expect(payload.data.wrk_script).toContain('"POST"');
  });

  it('should reject an invalid traffic pattern', async () => {
    const result = await suggestLoadTest(sandbox, {
      traffic_pattern: 'tsunami' as any,
      endpoints: [endpoint]
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject empty endpoint lists', async () => {
    const result = await suggestLoadTest(sandbox, {
      traffic_pattern: 'steady',
      endpoints: []
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject invalid endpoint URLs', async () => {
    const result = await suggestLoadTest(sandbox, {
      traffic_pattern: 'steady',
      endpoints: [{ url: 'ftp://bad' }]
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_ENDPOINT');
  });

  it('should reject header injection in endpoint headers', async () => {
    const result = await suggestLoadTest(sandbox, {
      traffic_pattern: 'steady',
      endpoints: [{ url: 'http://localhost:3000/api', headers: { 'x-evil': 'a"\r\nb' } }]
    });
    expect(parse(result).error.code).toBe('INVALID_ENDPOINT');
  });

  it('should return INTERNAL_ERROR when args cannot be read', async () => {
    const result = await suggestLoadTest(sandbox, null as any);
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.retryable).toBe(true);
  });
});
