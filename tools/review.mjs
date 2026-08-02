#!/usr/bin/env node
/**
 * Assemble a blind review packet for a critic agent.
 *
 * Picks N reference plates from the curated library, pairs each with one of our
 * renders, and emits blind A/B sheets plus a manifest. The critic is handed ONLY
 * the sheet paths. The answer key stays in `key.json`, which the orchestrator reads
 * afterwards to score the verdict.
 *
 * Usage:
 *   node tools/review.mjs --ours "shots/hamburger/r1/hero.png" --category character \
 *     --out shots/review/hamburger-r1 [--n 3]
 *
 *   node tools/review.mjs --ours "shots/arena/r1/wide.png" --category gameplay \
 *     --out shots/review/arena-r1
 */

import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
if (!args.ours || !args.category || !args.out) {
  console.error('Need --ours <png> --category character|gameplay --out <dir>');
  process.exit(2);
}

const curatedDir = resolve(`reference/images/curated/${args.category}`);
if (!existsSync(curatedDir)) {
  console.error(`No curated references at ${curatedDir}.`);
  console.error('Run the reference-curation step before any blind review.');
  process.exit(3);
}

const refs = (await readdir(curatedDir)).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
if (refs.length === 0) {
  console.error(`${curatedDir} is empty — nothing to compare against.`);
  process.exit(3);
}

const n = Math.min(Number(args.n ?? 3), refs.length);

// Sample without replacement so the critic sees a spread of references, not the
// same plate three times.
const pool = [...refs];
const picked = [];
for (let i = 0; i < n; i++) {
  picked.push(pool.splice(randomInt(0, pool.length), 1)[0]);
}

const outDir = resolve(args.out);
await mkdir(outDir, { recursive: true });

const sheets = [];
for (let i = 0; i < picked.length; i++) {
  const ref = join(curatedDir, picked[i]);
  const sheet = join(outDir, `sheet_${i + 1}.png`);
  const key = join(outDir, `sheet_${i + 1}.key.json`);
  execFileSync('node', [
    'tools/compare.mjs',
    '--ours', args.ours,
    '--ref', ref,
    '--out', sheet,
    '--key', key,
    '--height', String(args.height ?? 1000),
  ], { stdio: 'inherit' });
  sheets.push({ sheet, key, reference: basename(ref) });
}

const manifest = {
  ours: args.ours,
  category: args.category,
  sheets: sheets.map((s) => s.sheet),
  keys: sheets.map((s) => s.key),
};
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('\n── critic packet ready ──');
console.log('Show the critic ONLY these files:');
sheets.forEach((s) => console.log(`  ${s.sheet}`));
console.log(`\nKeys (orchestrator only): ${join(outDir, 'sheet_*.key.json')}`);
