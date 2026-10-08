/**
 * pattern-semantics.cjs — proof that the 2026-10-07 unrolling of the three
 * comma-counting rules did NOT change which functions they detect.
 *
 * Run from the repo root:
 *   node benchmark/detect-hangfix-2026-10-07/pattern-semantics.cjs
 *
 * Compares, for `code-many-params-10`, `code-too-many-params-9` and
 * `code-long-parameter-list-8`:
 *   HEAD  = skills/detectors.json at 0ee6743 (the ambiguous segment)
 *   NOW   = the working tree (counted repetition over an unambiguous segment)
 * over declarations with 1..16 parameters (JS and Python), paren-group
 * arguments, nested calls, arrow functions, multiline lists and array defaults.
 *
 * This check exists because the FIRST patch attempt (explicit commas instead of
 * the counted repetition) was bounded but silently narrowed the rules from
 * ">= N params" to "exactly N params" — a detector that stops matching an
 * 11-parameter function is worse than a slow one.
 */
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const headPath = path.join(here, 'detectors.head.json');
const curPath = path.join(here, '..', '..', 'skills', 'detectors.json');
const head = JSON.parse(fs.readFileSync(headPath, 'utf8'));
const cur = JSON.parse(fs.readFileSync(curPath, 'utf8'));

const names = (n) => Array.from({ length: n }, (_, i) => `p${i}`).join(', ');
const samples = [];
for (let n = 1; n <= 16; n++) samples.push([`js-${n}`, `function f(${names(n)}) {`]);
for (let n = 1; n <= 16; n++) samples.push([`py-${n}`, `def f(${names(n)}):`]);
samples.push(['js-paren', 'function f(a, (b), c, d, e, f, g) {']);
samples.push(['js-nested', 'function f(a, g(x), c, d, e, f, g) {']);
samples.push(['js-arrow', 'const f = (a, b, c, d, e, g) => {']);
samples.push(['js-multiline', 'function f(\n  a,\n  b,\n  c,\n  d,\n  e,\n  g\n) {']);
samples.push(['js-defaults', 'function f(a = [1, 2], b, c, d, e, g) {']);
samples.push(['js-six', 'function f(a, b, c, d, e, g) {']);
samples.push(['js-eleven', 'function f(a, b, c, d, e, g, h, i, j, k, l) {']);
samples.push(['py-paren', 'def f(a, (b), c, d, e, f, g):']);

let totalDiffs = 0;
for (const rule of ['code-many-params-10', 'code-too-many-params-9', 'code-long-parameter-list-8']) {
  const a = new RegExp(head[rule].spec.params.pattern);
  const b = new RegExp(cur[rule].spec.params.pattern);
  const diffs = [];
  for (const [name, text] of samples) {
    const x = a.test(text);
    const y = b.test(text);
    if (x !== y) diffs.push(`${name}: HEAD=${x} NOW=${y}`);
  }
  totalDiffs += diffs.length;
  console.log(`${rule}: ${diffs.length === 0 ? `IDENTICAL on ${samples.length} samples` : `DIFFS: ${diffs.join(' | ')}`}`);
}
console.log(`TOTAL SEMANTIC DIFFS: ${totalDiffs}`);
process.exit(totalDiffs === 0 ? 0 : 1);
