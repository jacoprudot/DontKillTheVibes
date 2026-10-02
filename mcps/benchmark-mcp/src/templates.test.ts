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

    it('should not expand $-patterns in user-controlled values', () => {
      // `$&`, `$'` and `$\`` are special replacement patterns in
      // String.prototype.replace: a string replacer would expand them and
      // silently grow/rewrite the generated script.
      const cases: Array<[string, string]> = [
        ['http://localhost:3000/a$&b', 'http://localhost:3000/aXYb'],
        ['http://localhost:3000/a$`b', 'http://localhost:3000/aXYb'],
        ["http://localhost:3000/a$'b", 'http://localhost:3000/aXYb'],
        ['http://localhost:3000/a$$b', 'http://localhost:3000/aXYb']
      ];
      for (const [hostile, clean] of cases) {
        const hostileScript = buildK6Script([{ url: hostile }], 'steady', 5, 15);
        const cleanScript = buildK6Script([{ url: clean }], 'steady', 5, 15);
        expect(hostileScript.length).toBe(cleanScript.length);
        expect(hostileScript).toContain(hostile);
      }
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

    it('should emit valid Lua table syntax, not JSON object syntax', () => {
      const script = buildWrkScript([
        {
          url: 'http://localhost:3000/api/articles?limit=10',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"a":1}'
        }
      ]);
      expect(script).toContain('["path"]');
      expect(script).toContain('["method"] = "POST"');
      expect(script).toContain('["content-type"] = "application/json"');
      expect(script).toContain('["body"] = "{\\"a\\":1}"');
      // JSON's `"key": value` form is not valid Lua and wrk would refuse to load it.
      expect(script).not.toMatch(/"path"\s*:/);
      expect(script).not.toMatch(/"method"\s*:/);
    });

    it('should keep the endpoints table a Lua sequence', () => {
      const script = buildWrkScript([
        { url: 'http://localhost:3000/api/articles?limit=10' },
        { url: 'http://localhost:3000/api/articles?limit=20' }
      ]);
      expect(script).toContain('["path"] = "/api/articles?limit=10"');
      expect(script).toContain('["path"] = "/api/articles?limit=20"');
      // Top-level table must stay a sequence so `#endpoints` works.
      expect(script).toMatch(/local endpoints = \{ \{/);
    });

    it('should escape quotes, backslashes and newlines in Lua strings', () => {
      const script = buildWrkScript([
        {
          url: 'http://localhost:3000/api',
          method: 'POST',
          body: 'line1\nline2 "quoted" \\ end'
        }
      ]);
      // An unescaped newline inside a Lua short string literal is a syntax error.
      const bodyLine = script.split('\n').find(line => line.includes('["body"]'));
      expect(bodyLine).toBeDefined();
      expect(bodyLine).toContain('line1\\nline2');
      expect(bodyLine).toContain('\\"quoted\\"');
      expect(bodyLine).toContain('\\\\ end');
    });

    it('should not expand $-patterns in user-controlled values', () => {
      const hostile = buildWrkScript([{ url: 'http://localhost:3000/a$&b' }]);
      const clean = buildWrkScript([{ url: 'http://localhost:3000/aXYb' }]);
      expect(hostile.length).toBe(clean.length);
      expect(hostile).toContain('/a$&b');
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

    it('should XML-escape a legal query string in the path node', () => {
      const jmx = buildJmxTemplate('http://example.com/api?x=1&y=2', 5, 30);
      const match = /<stringProp name="HTTPSampler\.path">([\s\S]*?)<\/stringProp>/.exec(jmx);
      expect(match).not.toBeNull();
      const pathNode = match ? match[1] : '';
      // Raw `&` would make the JMX unloadable; the value must stay semantically
      // identical once XML-decoded.
      expect(pathNode).toBe('/api?x=1&amp;y=2');
      expect(pathNode).not.toMatch(/&(?!(?:amp|lt|gt|quot|apos);)/);
      expect(jmx).not.toContain('<stringProp name="HTTPSampler.path">/api?x=1&y=2<');
    });

    it('should escape XML metacharacters in every substituted value', () => {
      const hostile = '1</stringProp><JSR223Sampler guiclass="x"/>&';
      const jmx = buildJmxTemplate('http://example.com/api', hostile as unknown as number, 30);
      expect(jmx).not.toContain('<JSR223Sampler');
      expect(jmx).toContain('1&lt;/stringProp&gt;&lt;JSR223Sampler guiclass=&quot;x&quot;/&gt;&amp;');
    });

    it('should escape quotes and apostrophes in the path node', () => {
      const jmx = buildJmxTemplate("http://example.com/'\"><x>", 5, 30);
      const match = /<stringProp name="HTTPSampler\.path">([\s\S]*?)<\/stringProp>/.exec(jmx);
      expect(match).not.toBeNull();
      const pathNode = match ? match[1] : '';
      expect(pathNode).toContain('&apos;');
      expect(pathNode).not.toContain('<');
      expect(pathNode).not.toContain('>');
      expect(pathNode).not.toContain('"');
      expect(pathNode).not.toContain("'");
    });
  });
});
