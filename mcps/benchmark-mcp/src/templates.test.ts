import {
  loadTemplate,
  buildK6Options,
  buildK6Script,
  buildWrkScript,
  buildJmxTemplate
} from './templates.js';

describe('templates module', () => {
  describe('loadTemplate', () => {
    it('should load the built-in k6 and wrk templates', () => {
      const k6 = loadTemplate('k6-template.js');
      const wrk = loadTemplate('wrk-template.lua');
      expect(k6).toContain('__OPTIONS__');
      expect(k6).toContain('__ENDPOINTS__');
      expect(wrk).toContain('__ENDPOINTS__');
    });

    it('should load the jmeter template', () => {
      const jmx = loadTemplate('jmeter-template.jmx');
      expect(jmx).toContain('__HOST__');
      expect(jmx).toContain('__THREADS__');
    });

    it('should throw a clear error for unknown templates', () => {
      expect(() => loadTemplate('nope-template.js')).toThrow(/Benchmark template not found/);
    });
  });

  describe('buildK6Options', () => {
    it('should produce a steady vus/duration shape', () => {
      const opts: any = buildK6Options('steady', 10, 30);
      expect(opts.vus).toBe(10);
      expect(opts.duration).toBe('30s');
      expect(opts.thresholds.http_req_duration).toContain('p(95)<500');
    });

    it('should produce a 4-stage spike peaking at 10x', () => {
      const opts: any = buildK6Options('spike', 10, 40);
      expect(opts.stages).toHaveLength(4);
      expect(opts.stages.map((s: any) => s.target)).toEqual([10, 100, 10, 0]);
      expect(opts.stages[0].duration).toBe('10s');
    });

    it('should produce a 3-stage ramp peaking at 5x and ending at 0', () => {
      const opts: any = buildK6Options('ramp', 20, 30);
      expect(opts.stages.map((s: any) => s.target)).toEqual([20, 100, 0]);
    });

    it('should never produce a zero-second stage duration', () => {
      const opts: any = buildK6Options('spike', 10, 3);
      for (const s of opts.stages) {
        expect(parseInt(s.duration, 10)).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('buildK6Script', () => {
    it('should inline options and endpoints into the template', () => {
      const script = buildK6Script(
        [{ url: 'http://localhost:3000/api', method: 'GET' }],
        'steady',
        5,
        15
      );
      expect(script).not.toContain('__OPTIONS__');
      expect(script).not.toContain('__ENDPOINTS__');
      expect(script).toContain('"vus":5');
      expect(script).toContain('localhost:3000/api');
    });
  });

  describe('buildWrkScript', () => {
    it('should reduce endpoints to path+query and keep method/headers/body', () => {
      const script = buildWrkScript([
        {
          url: 'http://localhost:3000/api/articles?limit=10',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}'
        }
      ]);
      expect(script).not.toContain('__ENDPOINTS__');
      expect(script).toContain('/api/articles?limit=10');
      expect(script).toContain('"POST"');
      expect(script).toContain('application/json');
      expect(script).not.toContain('localhost:3000'); // wrk targets a single host
    });
  });

  describe('buildJmxTemplate', () => {
    it('should substitute host, port, protocol, threads and duration', () => {
      const jmx = buildJmxTemplate('https://api.example.com:8443/v1/test', 20, 60);
      expect(jmx).not.toContain('__HOST__');
      expect(jmx).toContain('api.example.com');
      expect(jmx).toContain('8443');
      expect(jmx).toContain('https');
      expect(jmx).toContain('/v1/test');
      expect(jmx).toContain('>20<');
      expect(jmx).toContain('>60<');
    });

    it('should default ports by protocol when none is given', () => {
      const http = buildJmxTemplate('http://example.com/api', 1, 1);
      const https = buildJmxTemplate('https://example.com/api', 1, 1);
      expect(http).toContain('>80<');
      expect(https).toContain('>443<');
    });
  });
});
