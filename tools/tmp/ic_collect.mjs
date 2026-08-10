#!/usr/bin/env node
/**
 * Assemble a round's answer sheets into the `[{judge, plate, key, mode, lines}]` file
 * that `icon_score.mjs` and `ic_pair.mjs --score` both read.
 *
 * ── Why this is a tool and not a shell loop ─────────────────────────────────
 * The PROTOCOL is part of the measurement, and `a77ff30` found it is worth 29 points on
 * its own — the same 63 tiles scored 96.3% when the judge could magnify and 67.2% when
 * it could not. Every arm therefore has to be stamped with which one it was, at the
 * moment it is collected, or the two get pooled later by someone reading a filename.
 * This refuses to write a sheet without an explicit `--protocol`.
 *
 * It also validates each sheet against the key BEFORE scoring: a judge that answered 71
 * of 74 tiles, or numbered them 0..73, produces a plausible score rather than an error.
 *
 *   node tools/tmp/ic_collect.mjs --key shots/ic/d2/draft2.key.json \
 *     --protocol nozoom --judges P,Q,R --dir shots/ic/d2 --out shots/ic/d2/answers_nozoom.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const PROTOCOLS = new Set(['zoom', 'nozoom']);
if (!a.key || !a.judges || !a.out || !PROTOCOLS.has(a.protocol)) {
  console.error('usage: ic_collect.mjs --key <k.json> --protocol zoom|nozoom --judges P,Q --dir <d> --out <o.json>');
  console.error('  ⚠️ --protocol is REQUIRED. A score quoted without it is not a number.');
  process.exit(2);
}
const dir = a.dir ?? '.';
const key = JSON.parse(readFileSync(a.key, 'utf8'));
const n = key.tiles.length;

const runs = [];
const faults = [];
for (const j of a.judges.split(',').map((s) => s.trim()).filter(Boolean)) {
  const path = join(dir, `ans_${j}.txt`);
  const lines = readFileSync(path, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const seen = new Map();
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
    if (!m) { faults.push(`${j}: unparseable line "${line}"`); continue; }
    const i = Number(m[1]);
    if (seen.has(i)) faults.push(`${j}: tile ${i} answered twice`);
    seen.set(i, m[2]);
  }
  const missing = [];
  for (let i = 1; i <= n; i++) if (!seen.has(i)) missing.push(i);
  const extra = [...seen.keys()].filter((i) => i < 1 || i > n);
  if (missing.length) faults.push(`${j}: ${missing.length} of ${n} tiles UNANSWERED (${missing.slice(0, 12).join(',')}${missing.length > 12 ? '…' : ''})`);
  if (extra.length) faults.push(`${j}: answered tiles outside 1..${n}: ${extra.join(',')}`);
  runs.push({
    judge: j, plate: key.plate ?? a.key, key: a.key, mode: 'forced',
    protocol: a.protocol, lines,
  });
}

if (faults.length) {
  console.log('🔴 ANSWER SHEETS INVALID:\n  ' + faults.join('\n  '));
  process.exit(1);
}
writeFileSync(a.out, JSON.stringify(runs, null, 1) + '\n');
console.log(`wrote ${a.out}  ${runs.length} judge(s) x ${n} tiles  protocol=${a.protocol}`);
