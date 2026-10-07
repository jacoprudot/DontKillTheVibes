/**
 * glob.mjs — minimal gitignore-style glob → RegExp translator for the detector
 * engine. Supports the subset used by skills/detectors.json specs:
 *   **  any number of path segments (including zero)
 *   *   any run of non-separator characters
 *   ?   one non-separator character
 *   {a,b}  alternation
 *   [abc] / [!abc]  character classes
 * Patterns are anchored to the whole repo-relative posix path.
 */

const ESCAPE = /[.+^${}()|[\]\\]/g;

function escapeChar(c) {
  return c.replace(ESCAPE, '\\$&');
}

export function globToRegExp(glob) {
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
      const close = glob.indexOf('}', i);
      if (close === -1) {
        re += '\\{';
        i += 1;
      } else {
        const inner = glob
          .slice(i + 1, close)
          .split(',')
          .map((alt) => alt.replace(ESCAPE, '\\$&'))
          .join('|');
        re += `(?:${inner})`;
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
  return new RegExp(`^${re}$`);
}

export function makeGlobMatcher(glob) {
  const re = globToRegExp(glob);
  return (relPosixPath) => re.test(relPosixPath);
}
