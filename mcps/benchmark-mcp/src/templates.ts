import { K6_TEMPLATE, WRK_TEMPLATE, JMETER_TEMPLATE } from './templates-content.js';

export interface EndpointSpec {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Returns a built-in benchmark template by file name. Templates are compiled
 * into the MCP (see templates-content.ts) — never loaded from disk and never
 * user content, so they cannot be tampered with at runtime.
 */
const BUILTIN_TEMPLATES: Record<string, string> = {
  'k6-template.js': K6_TEMPLATE,
  'wrk-template.lua': WRK_TEMPLATE,
  'jmeter-template.jmx': JMETER_TEMPLATE
};

export function loadTemplate(name: string): string {
  const template = BUILTIN_TEMPLATES[name];
  if (template === undefined) {
    throw new Error(`Benchmark template not found: ${name}`);
  }
  return template;
}

/**
 * Escapes a value for use inside an XML text node or attribute. Without this,
 * a legal URL character (e.g. `&` in a query string) produces a JMX file that
 * JMeter refuses to parse, and a crafted value could inject new XML elements
 * into the generated test plan.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Quotes a Lua string literal (LuaJIT / Lua 5.1 escapes). Control characters
 * are emitted as 3-digit decimal escapes so they can never be confused with a
 * following digit.
 */
function quoteLuaString(value: string): string {
  let out = '"';
  for (const ch of value) {
    switch (ch) {
      case '\\':
        out += '\\\\';
        break;
      case '"':
        out += '\\"';
        break;
      case '\n':
        out += '\\n';
        break;
      case '\r':
        out += '\\r';
        break;
      case '\t':
        out += '\\t';
        break;
      default: {
        const code = ch.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) {
          out += `\\${code.toString().padStart(3, '0')}`;
        } else {
          out += ch;
        }
      }
    }
  }
  return `${out}"`;
}

/**
 * Serializes a JSON-compatible value as a Lua literal. JSON object syntax
 * (`{"path": "/x"}`) is a syntax error in Lua, so objects are emitted as
 * `["key"] = value` tables; sequence arrays stay positional so `#endpoints`
 * and `endpoints[i]` keep working in the wrk template.
 */
function toLuaLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'string') return quoteLuaString(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nil';
  if (Array.isArray(value)) {
    return `{ ${value.map(item => toLuaLiteral(item)).join(', ')} }`;
  }
  if (typeof value === 'object') {
    const fields = Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => `[${quoteLuaString(key)}] = ${toLuaLiteral(fieldValue)}`);
    return `{ ${fields.join(', ')} }`;
  }
  return 'nil';
}

/**
 * Builds the k6 options object for a given traffic pattern.
 */
export function buildK6Options(
  trafficPattern: 'steady' | 'spike' | 'ramp',
  vus: number,
  durationSec: number
): unknown {
  const thresholds = {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  };

  switch (trafficPattern) {
    case 'spike':
      return {
        stages: [
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: vus },
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: vus * 10 },
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: vus },
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: 0 }
        ],
        thresholds
      };
    case 'ramp':
      return {
        stages: [
          { duration: `${Math.max(1, Math.floor(durationSec / 3))}s`, target: vus },
          { duration: `${Math.max(1, Math.floor(durationSec / 3))}s`, target: vus * 5 },
          { duration: `${Math.max(1, Math.floor(durationSec / 3))}s`, target: 0 }
        ],
        thresholds
      };
    case 'steady':
    default:
      return {
        vus,
        duration: `${durationSec}s`,
        thresholds
      };
  }
}

/**
 * Generates a runnable k6 script from the built-in template.
 */
export function buildK6Script(
  endpoints: EndpointSpec[],
  trafficPattern: 'steady' | 'spike' | 'ramp',
  vus: number,
  durationSec: number
): string {
  // Function replacers everywhere: a string replacement would expand `$&`,
  // `$'`, `$\`` and `$$` found in user-controlled values, silently corrupting
  // (and inflating) the generated artifact.
  return loadTemplate('k6-template.js')
    .replace('__OPTIONS__', () => JSON.stringify(buildK6Options(trafficPattern, vus, durationSec)))
    .replace('__ENDPOINTS__', () => JSON.stringify(endpoints));
}

/**
 * Generates a wrk Lua script from the built-in template. Endpoints are
 * reduced to path+query because wrk targets a single host.
 */
export function buildWrkScript(endpoints: EndpointSpec[]): string {
  const wrkEndpoints = endpoints.map(ep => {
    const url = new URL(ep.url);
    return {
      path: url.pathname + url.search,
      method: ep.method || 'GET',
      headers: ep.headers || {},
      ...(ep.body ? { body: ep.body } : {})
    };
  });
  // Emit a Lua table, not JSON: `{"path": ...}` is not valid Lua and wrk
  // cannot load it. Function replacer avoids `$` pattern expansion.
  return loadTemplate('wrk-template.lua').replace('__ENDPOINTS__', () =>
    toLuaLiteral(wrkEndpoints)
  );
}

/**
 * Generates a JMeter test plan from the built-in template.
 */
export function buildJmxTemplate(targetUrl: string, threads: number, durationSec: number): string {
  const url = new URL(targetUrl);
  return loadTemplate('jmeter-template.jmx')
    .replaceAll('__HOST__', () => escapeXml(url.hostname))
    .replaceAll('__PORT__', () => escapeXml(url.port || (url.protocol === 'https:' ? '443' : '80')))
    .replaceAll('__PROTOCOL__', () => escapeXml(url.protocol.replace(':', '')))
    .replaceAll('__PATH__', () => escapeXml(url.pathname + url.search))
    .replaceAll('__THREADS__', () => escapeXml(String(threads)))
    .replaceAll('__DURATION__', () => escapeXml(String(durationSec)));
}
