/**
 * patch-patterns-2.cjs — corrects the unrolling of the comma-counting rules.
 *
 * patch-patterns.cjs replaced the ambiguous segment
 *     [^()]*(?:\([^()]*\)[^()]*)*
 * with the unambiguous
 *     (?:\([^()]*\)|[^(),])*
 * which removed the exponential backtracking but CHANGED THE SEMANTICS: the old
 * segment could swallow commas, so the pattern meant "at least N-1 commas in the
 * list" (≥N params) — the new segment cannot, so the five explicit commas meant
 * "exactly N params". Measured (benchmark/detect-hangfix-2026-10-07/pattern-semantics.cjs):
 *   code-many-params-10:      HEAD matched 6..14 params; the first patch matched only 6.
 * A detector that silently stops matching 11-parameter functions is worse than a
 * slow one, so the comma list is expressed as a COUNTED REPETITION instead:
 *     SEG(?:,SEG){5,}      (≥5 commas = ≥6 params, identical to HEAD)
 * The repetition is unambiguous too: every iteration must begin with a comma, and
 * SEG cannot consume a comma outside a paren group, so each step is forced.
 *
 * Idempotent: exits 0 when the patterns already carry the counted form.
 */
const fs = require('node:fs');
const path = require('node:path');

const BS = String.fromCharCode(92);
const file = path.join(__dirname, '..', '..', 'skills', 'detectors.json');
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));

// NB: these are the values as the ENGINE sees them (one backslash); JSON.stringify
// adds the escaping when the file is written. patch-patterns.cjs worked on raw
// FILE TEXT and therefore had to write two backslashes — mixing the two is how
// you get a pattern that compiles and matches nothing.
const SEG = '(?:' + BS + '([^()]*' + BS + ')|[^(),])*';
const JS_PREFIX = '(?:function' + BS + 's+)?' + BS + 'w+' + BS + 's*' + BS + '(';
const JS_SUFFIX = BS + ')[ ' + BS + 't]*' + BS + '{';
const PY_PREFIX = 'def' + BS + 's+' + BS + 'w+' + BS + 's*' + BS + '(';

const TARGETS = {
  'code-many-params-10': JS_PREFIX + SEG + '(?:,' + SEG + '){5,}' + JS_SUFFIX,
  'code-too-many-params-9': JS_PREFIX + SEG + '(?:,' + SEG + '){7,}' + JS_SUFFIX,
  'code-long-parameter-list-8': PY_PREFIX + SEG + '(?:,' + SEG + '){5,}' + BS + ')',
};

let changed = 0;
for (const [id, pattern] of Object.entries(TARGETS)) {
  const entry = doc[id];
  if (!entry || !entry.spec || !entry.spec.params) {
    console.log(`STOP: ${id} missing from detectors.json`);
    process.exit(2);
  }
  if (entry.spec.params.pattern === pattern) {
    console.log(`  ${id}: already in counted form`);
    continue;
  }
  entry.spec.params.pattern = pattern;
  changed++;
  console.log(`  ${id}: rewritten as counted repetition (${(pattern.match(/,/g) || []).length} commas in pattern text incl. the char classes)`);
}
if (changed > 0) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log(`rewrote ${changed} pattern(s)`);
