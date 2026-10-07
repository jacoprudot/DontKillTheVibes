/**
 * glob.mjs — minimal gitignore-style glob → RegExp translator for the detector
 * engine. Supports the subset used by skills/detectors.json specs:
 *   **  any number of path segments (including zero)
 *   *   any run of non-separator characters
 *   ?   one non-separator character
 *   {a,b}  alternation — each alternative is itself a full sub-glob
 *          (e.g. {README.md,docs/**} — the 2026-10-07 cost-module specs need this)
 *   [abc] / [!abc]  character classes
 * Patterns are anchored to the whole repo-relative posix path.
 *
 * HARDENING (2026-10-07): the previous version escaped alternatives verbatim,
 * so `docs/**` inside braces produced the invalid regex `docs/**` ("Nothing to
 * repeats") and cost-documentation-poor-7 / cost-license-attribution-missing-2
 * crashed the whole run. Alternatives are now translated RECURSIVELY.
 */

const ESCAPE = /[.+^${}()|[\]\\]/g;

function escapeChar(c) {
  return c.replace(ESCAPE, '\\$&');
}

/** Split a brace body on top-level commas only (nested braces survive). */
function splitAlternatives(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** Translate a glob to a regex SOURCE string (no anchors). */
function translate(glob) {
  let re = '';
  let i = 0;
  const n = glob.length;
  while (i < n) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:[^/]+/)*'; // **/ → zero or more whole directories
          i += 3;
        } else {
          re += '.*';
          i += 2;
        }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else if (c === '{') {
      // find the matching close brace at the same nesting depth
      let depth = 1;
      let close = -1;
      for (let j = i + 1; j < n; j++) {
        if (glob[j] === '{') depth++;
        else if (glob[j] === '}') { depth--; if (depth === 0) { close = j; break; } }
      }
      if (close === -1) {
        re += '\\{';
        i += 1;
      } else {
        const alts = splitAlternatives(glob.slice(i + 1, close))
          .map((alt) => (alt === '' ? '' : translate(alt))); // recursion: each alt is a sub-glob
        re += `(?:${alts.join('|')})`;
        i = close + 1;
      }
    } else if (c === '[') {
      const close = glob.indexOf(']', i + 1);
      if (close === -1) {
        re += '\\[';
        i += 1;
      } else {
        let cls = glob.slice(i + 1, close);
        if (cls.startsWith('!')) cls = `^${cls.slice(1)}`;
        re += `[${cls}]`;
        i = close + 1;
      }
    } else {
      re += escapeChar(c);
      i += 1;
    }
  }
  return re;
}

export function globToRegExp(glob) {
  return new RegExp(`^${translate(glob)}$`);
}

export function makeGlobMatcher(glob) {
  const re = globToRegExp(glob);
  return (relPosixPath) => re.test(relPosixPath);
}
