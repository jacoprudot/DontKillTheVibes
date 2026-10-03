#!/usr/bin/env node
/**
 * benchmark/anonymize-results.mjs — anonymize benchmark results in place.
 *
 * The four vibe-coding targets are published under neutral labels
 * (target-1..target-4). This script renames results/<real-name> to
 * results/<label> and scrubs identifying strings (repo names, name variants,
 * unambiguous author names) from every .json/.md artifact of those targets.
 * It NEVER touches repo-internal file paths (app/api/...) — only project
 * names. Code snippets inside the artifacts are left verbatim: renaming code
 * would break the judge's evidence chain (see benchmark/README.md).
 *
 * The real-name -> label mapping is defined HERE and only here.
 *
 * Usage:
 *   node benchmark/anonymize-results.mjs [--root <results-dir>] [--dry-run] [--help]
 *
 * Exit code: 0 when no identifying string remains in the artifacts, 1 when
 * leftovers are still present (listed, for a human to declare or fix).
 * Idempotent: a second run reports "no changes" and exits 0.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BENCH_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_ROOT = join(BENCH_DIR, 'results');

const HELP = `benchmark/anonymize-results.mjs — anonymize results/ (labels + string scrub)

Usage:
  node benchmark/anonymize-results.mjs [--root <results-dir>] [--dry-run] [--help]

Options:
  --root <dir>   results root to process (default: benchmark/results)
  --dry-run      print every planned action and the leftover check without
                 renaming or writing anything
  --help

Mapping (fixed in this script):
  chatbot-ui -> target-1, roomgpt -> target-2,
  screenshot-to-code -> target-3, llamacoder -> target-4
  realworld-control stays named (public via examples/realworld-assessment).

Author names: mckaywrigley -> target-1, abi -> target-3. 'Nutlope' authored two
of the targets, so it cannot be mapped to a single label: it is replaced with
[redacted-author] and reported.

Exit 0 = clean (or --dry-run of a plan that would be clean); 1 = leftovers remain.`;

/* The ONE place the real-name -> label mapping lives. */
const LABEL_MAP = {
  'chatbot-ui': 'target-1',
  'roomgpt': 'target-2',
  'screenshot-to-code': 'target-3',
  'llamacoder': 'target-4',
};

/* Identifying strings swept from artifacts. Values: label, or the special
 * '[redacted-author]' token for the author shared by two targets. Matched
 * case-insensitively with word boundaries, longest first. */
const IDENTIFIERS = {
  'chatbot-ui': 'target-1',
  'chatbot_ui': 'target-1',
  'mckaywrigley': 'target-1',
  'roomgpt': 'target-2',
  'room-gpt': 'target-2',
  'screenshot-to-code': 'target-3',
  'screenshot_to_code': 'target-3',
  'abi': 'target-3',
  'llamacoder': 'target-4',
  'llama-coder': 'target-4',
  'nutlope': '[redacted-author]',
};
const IDENT_RE = new RegExp(
  `\\b(${Object.keys(IDENTIFIERS).sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi',
);

function scrub(text) {
  let count = 0;
  const out = String(text).replace(IDENT_RE, (match) => {
    count++;
    return IDENTIFIERS[match.toLowerCase()];
  });
  return { out, count };
}

function listFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

function anonymizeMeta(meta, label) {
  const next = { ...meta };
  delete next.url;
  delete next.target_dir;
  next.anonymized = true;
  next.label = label;
  return next;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); return 0; }
  const dryRun = argv.includes('--dry-run');
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx !== -1 ? resolve(argv[rootIdx + 1]) : DEFAULT_ROOT;
  if (rootIdx !== -1 && argv[rootIdx + 1] === undefined) {
    console.error('--root requires a value');
    return 2;
  }
  if (!existsSync(root)) {
    console.error(`results root not found: ${root}`);
    return 2;
  }

  const plan = { renames: [], metas: [], sweeps: [] };

  /* ---- 1. rename results/<real> -> results/<label> ---- */
  for (const [real, label] of Object.entries(LABEL_MAP)) {
    const from = join(root, real);
    const to = join(root, label);
    if (existsSync(from) && existsSync(to)) {
      console.error(`both ${real} and ${label} exist under ${root} — refusing to guess; merge or remove one first`);
      return 2;
    }
    if (existsSync(from)) plan.renames.push({ from, to, real, label });
  }

  /* Directories as they WILL be on disk after the renames (or as they are). */
  const dirs = Object.entries(LABEL_MAP).map(([real, label]) => ({
    real, label, path: existsSync(join(root, label)) ? join(root, label) : join(root, real),
  })).filter((d) => existsSync(d.path));

  /* ---- 2. meta.json surgery + 3. string sweep over .json/.md ---- */
  const projected = new Map(); // file -> final content (used by the leftover check in both modes)
  for (const { real, label, path } of dirs) {
    const metaFile = join(path, 'meta.json');
    if (existsSync(metaFile)) {
      const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
      // Surgery (drop url/target_dir, add anonymized+label) AND scrub in one
      // write — the two must not overwrite each other.
      const cleanedStr = `${JSON.stringify(anonymizeMeta(meta, label), null, 2)}\n`;
      const { out, count } = scrub(cleanedStr);
      projected.set(metaFile, out);
      if (JSON.stringify(meta) !== JSON.stringify(anonymizeMeta(meta, label)) || count > 0) {
        plan.metas.push({ file: metaFile, label, out, count });
      }
    }
    for (const file of listFiles(path)) {
      if (!/\.(json|md)$/i.test(file)) continue;
      if (file === join(path, 'meta.json')) continue; // handled above
      const text = readFileSync(file, 'utf8');
      const { out, count } = scrub(text);
      projected.set(file, out);
      if (count > 0) plan.sweeps.push({ file, count, out });
    }
  }

  /* ---- dry run: report and evaluate the would-be state ---- */
  if (dryRun) {
    console.log(`DRY RUN — root: ${root}`);
    for (const r of plan.renames) console.log(`  would rename ${r.real} -> ${r.label}`);
    for (const m of plan.metas) console.log(`  would clean meta.json: ${m.file}`);
    for (const s of plan.sweeps) console.log(`  would replace ${s.count} identifying string(s): ${s.file}`);
    if (!plan.renames.length && !plan.metas.length && !plan.sweeps.length) console.log('  no changes needed — already anonymized');
  } else {
    /* Surgery and sweep FIRST (paths are still the original ones), renames LAST. */
    for (const m of plan.metas) {
      writeFileSync(m.file, m.out);
      console.log(`meta cleaned (url/target_dir removed, anonymized+label set, ${m.count} identifying string(s) scrubbed): ${m.file}`);
    }
    for (const s of plan.sweeps) {
      writeFileSync(s.file, s.out, 'utf8');
      console.log(`replaced ${s.count} identifying string(s): ${s.file}`);
    }
    for (const r of plan.renames) {
      renameSync(r.from, r.to);
      console.log(`renamed ${r.real} -> ${r.label}`);
    }
    if (!plan.renames.length && !plan.metas.length && !plan.sweeps.length) console.log('no changes — already anonymized');
  }

  /* ---- 4. leftover check: evaluate the RESULTING state ----
   * In real mode the files were just written and dirs renamed, so recompute
   * the dir list; in dry-run we keep the pre-rename paths but evaluate the
   * projected (post-scrub) content. */
  const leftoverDirs = dryRun
    ? dirs
    : Object.entries(LABEL_MAP)
        .map(([real, label]) => ({ real, label, path: join(root, label) }))
        .filter((d) => existsSync(d.path));
  const leftovers = [];
  for (const { label, path } of leftoverDirs) {
    for (const file of listFiles(path)) {
      let text;
      if (dryRun && projected.has(file)) text = projected.get(file);
      else {
        try { text = readFileSync(file, 'utf8'); } catch { continue; }
      }
      if (text.length > 20 * 1024 * 1024) continue; // skip huge blobs, best effort
      const hits = new Set();
      for (const m of text.matchAll(IDENT_RE)) hits.add(m[1].toLowerCase());
      if (hits.size) leftovers.push({ file, idents: [...hits] });
    }
  }
  if (leftovers.length) {
    console.error('\nLEFTOVER identifying strings (not in a .json/.md artifact, or missed):');
    for (const l of leftovers) console.error(`  ${l.file}: ${l.idents.join(', ')}`);
    console.error('declare them or extend the sweep; exiting 1.');
    return 1;
  }
  console.log('\nclean: no identifying strings remain in the target artifacts. exit 0.');
  return 0;
}

const code = main();
try { process.stdin.destroy(); } catch { /* noop */ }
process.exit(code);
