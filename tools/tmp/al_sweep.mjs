#!/usr/bin/env node
/**
 * ARENA-LITERAL CENSUS — the human-readable half. `al_guard.mjs` is the gate.
 *
 * Prints every candidate arena literal in the tracked tree, grouped by file, with the
 * syntactic role that made it a candidate and what is wrong with it (if anything).
 * Read this when you want the list; run `al_guard.mjs` when you want a verdict.
 *
 *   node tools/tmp/al_sweep.mjs                 # everything, grouped by file
 *   node tools/tmp/al_sweep.mjs --bad           # only the flagged rows
 *   node tools/tmp/al_sweep.mjs --file valuescan
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadArena, scanFiles, extract, classify, addressesShippedArena } from './al_lib.mjs';

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };

export function census() {
  const arena = loadArena();
  const files = scanFiles();
  const rows = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const ctx = { shipped: addressesShippedArena(text) };
    for (const h of extract(rel, text)) {
      const flags = classify(arena, h, ctx);
      rows.push({ ...h, shipped: ctx.shipped, flags });
    }
  }
  return { arena, files, rows };
}

function main() {
  const { arena, files, rows } = census();
  const only = arg('file', null);
  const badOnly = process.argv.includes('--bad');
  const shown = rows
    .filter((r) => (only ? r.file.includes(String(only)) : true))
    .filter((r) => (badOnly ? r.flags.length : true));

  console.log(`arena ${arena.w}×${arena.h}, centre (${arena.cx},${arena.cy}), maxSafeRadius ${arena.maxSafeRadius}, `
    + `half-diagonal ${arena.halfDiagonal.toFixed(2)}, ${arena.cover.length} cover boxes`);
  console.log(`${files.length} tracked text files scanned · ${rows.length} candidates extracted by role · `
    + `${rows.filter((r) => r.flags.length).length} flagged\n`);

  let last = null;
  for (const r of shown) {
    if (r.file !== last) { console.log(`\n── ${r.file}`); last = r.file; }
    const v = Array.isArray(r.value) ? `(${r.value.join(', ')})` : String(r.value);
    const f = r.flags.length ? `  🔴 ${r.flags.map((x) => `${x.code}: ${x.detail}`).join(' | ')}` : '';
    console.log(`  ${String(r.line).padStart(5)}  ${r.role.padEnd(6)} ${v.padEnd(18)} ${r.quad ?? '  '}  ${r.why}${f}`);
    if (r.flags.length) console.log(`         ${r.text}`);
  }

  // ── per-file quadrant coverage, the signal that caught valuescan and arena-scan ──
  console.log('\n\n── quadrant coverage, files with ≥5 extracted positions ──');
  const byFile = new Map();
  for (const r of rows) {
    if (r.role !== 'pos' || !r.quad || !r.shipped || r.inComment) continue;
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }
  for (const [f, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    if (list.length < 5) continue;
    const q = { NW: 0, NE: 0, SW: 0, SE: 0 };
    for (const r of list) q[r.quad]++;
    const empty = Object.values(q).filter((n) => n === 0).length;
    console.log(`  ${String(list.length).padStart(3)}  NW ${String(q.NW).padStart(3)} NE ${String(q.NE).padStart(3)}`
      + ` SW ${String(q.SW).padStart(3)} SE ${String(q.SE).padStart(3)}  ${empty === 3 ? '🔴 ONE QUADRANT' : empty ? `⚠️ ${empty} empty` : '  '}  ${f}`);
  }
}

if (IS_MAIN) main();
