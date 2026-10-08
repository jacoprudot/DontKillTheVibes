/**
 * patch-patterns.cjs — one-shot 2026-10-07 fix for the catastrophic-backtracking
 * segment in the comma-counting parameter rules.
 *
 * The hazardous segment (as it appears in skills/detectors.json):
 *     [^()]*(?:\([^()]*\)[^()]*)*
 * Its two failing properties:
 *   1. the trailing [^()]* of one iteration can consume the same characters as
 *      the leading [^()]* of the next segment, and
 *   2. [^()]* matches commas, so every comma in the file is a candidate segment
 *      boundary (a combinatorial number of decompositions on a file with many
 *      commas and parens), independent of line length.
 * The unambiguous replacement:
 *     (?:\([^()]*\)|[^(),])*
 * The alternatives start with disjoint characters (( vs not-(,),) ), so the
 * choice at each position is forced: no ambiguity, no exponential path, and a
 * comma can no longer be swallowed by a segment.
 *
 * The script refuses to run if any OTHER nested quantified group is present in
 * a pattern besides the known segment, so a silent blanket rewrite cannot hide
 * a second hazard. Idempotent: it exits 0 with SKIP once the segment is gone.
 */
const fs = require('node:fs');
const path = require('node:path');

const BS = String.fromCharCode(92); // keeps backslash escaping out of this one-off
const file = path.join(__dirname, '..', '..', 'skills', 'detectors.json');
let text = fs.readFileSync(file, 'utf8');

const OLD = '[^()]*(?:' + BS + BS + '([^()]*' + BS + BS + ')[^()]*)*';
const NEW = '(?:' + BS + BS + '([^()]*' + BS + BS + ')|[^(),])*';

const occurrences = text.split(OLD).length - 1;
if (occurrences === 0) {
  console.log('SKIP: ambiguous segment not present (already patched?)');
  process.exit(0);
}
console.log(`ambiguous segment occurrences: ${occurrences}`);
if (occurrences !== 20) {
  console.log('STOP: expected exactly 20 (6 + 8 + 6 in the three comma-counting rules)');
  process.exit(2);
}

// After removing the known segment from every pattern, no nested quantified
// group may remain (a nested group is a quantified group whose body also
// contains a quantifier).
const doc = JSON.parse(text);
const nestedRe = /\(\?:[^()]*[*+][^()]*\)[*+]|\([^()]*[*+][^()]*\)[*+]/;
const others = [];
for (const [id, entry] of Object.entries(doc)) {
  const p = entry && entry.spec && entry.spec.params && entry.spec.params.pattern;
  if (typeof p !== 'string') continue;
  const stripped = p.split(OLD).join('');
  if (nestedRe.test(stripped)) others.push(id);
}
if (others.length > 0) {
  console.log(`STOP: other nested quantified group(s) present in ${others.join(', ')} — inspect by hand`);
  process.exit(2);
}

text = text.split(OLD).join(NEW);
fs.writeFileSync(file, text);
const after = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('patched rules and their comma counts:');
for (const [id, entry] of Object.entries(after)) {
  const p = entry && entry.spec && entry.spec.params && entry.spec.params.pattern;
  if (typeof p === 'string' && p.includes(NEW)) console.log(`  ${id}: ${(p.match(/,/g) || []).length} comma-separated slots`);
}
console.log(`remaining ambiguous segments: ${text.split(OLD).length - 1}`);
