#!/usr/bin/env node
/**
 * THROWAWAY — rebuild a `valuescan --mode dl` `dl.json` from the run's own stdout log
 * plus any top-up runs, after the sweep was killed part-way through.
 *
 * Two 198-sample sweeps (11 characters x 18 stations, ~50 minutes each under load)
 * were killed by the harness at 172/198 and 184/198. Every completed sample had
 * already been PRINTED, so re-running 198 page loads to recover 33 of them would have
 * cost an hour to learn nothing new. This parses the printed rows and splices in the
 * top-up JSON for the characters that were cut off.
 *
 * `modeGate` reads exactly four fields off a dl row — `id`, `station`, `dL`, `error`
 * — so a log-derived row is a complete input for the gate. It is NOT a complete dl
 * row (no `figureLuma`, `dLedge`, `gridDL`), and the output records `source` per row
 * so nothing downstream can mistake one for the other.
 *
 *   node tools/tmp/dlmerge.mjs --log /tmp/vl_base.log --fill shots/vl/base_fill/dl.json \
 *                              --out shots/vl/base/dl.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const LOG = get('--log', null);
const FILL = get('--fill', null);
const OUT = get('--out', null);
if (!LOG || !OUT) { console.error('usage: --log <file> [--fill <dl.json>] --out <dl.json>'); process.exit(2); }

// `hotdog       west_choke    dL   0.1007  |dL| 0.101  dLedge ...`
const ROW = /^([a-z]+)\s+([a-z_]+)\s+dL\s+(-?[\d.]+)\s+\|dL\|/;
const rows = [];
const seen = new Set();
for (const line of (await readFile(LOG, 'utf8')).split('\n')) {
  const m = ROW.exec(line);
  if (!m) continue;
  const key = `${m[1]}/${m[2]}`;
  if (seen.has(key)) continue;          // a top-up may repeat a row; first wins
  seen.add(key);
  rows.push({ id: m[1], station: m[2], dL: Number(m[3]), source: 'log' });
}
const fromLog = rows.length;

let fromFill = 0;
if (FILL && existsSync(FILL)) {
  for (const r of JSON.parse(await readFile(FILL, 'utf8')).rows) {
    const key = `${r.id}/${r.station}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...r, source: 'fill' });
    fromFill++;
  }
}

await writeFile(OUT, JSON.stringify({ rows, provenance: { log: LOG, fill: FILL, fromLog, fromFill } }, null, 2));
const byId = {};
for (const r of rows) byId[r.id] = (byId[r.id] ?? 0) + 1;
console.log(`wrote ${OUT}: ${rows.length} rows (${fromLog} parsed from log, ${fromFill} from top-up)`);
for (const [id, n] of Object.entries(byId)) if (n !== 18) console.log(`  ⚠️ ${id}: ${n} stations, expected 18`);
