#!/usr/bin/env node
/**
 * p5_weakb — recompute `weakBoundaryPct` from a stamped `chars.json`, plus the per-PAIR
 * breakdown the gate collapses to one number, so a failure can be attributed to a
 * specific part boundary instead of to a character.
 *
 * The formula is copied verbatim from valuescan.mjs modeGate (contact-weighted share of
 * adjacent part pairs whose |dL| < 0.10), and this file is VALIDATED by reproducing the
 * gate's own printed column on a run whose numbers are already known.
 * READ-ONLY probe: it never writes into shots/vl or edits any tool.
 */
import { readFileSync } from 'node:fs';
const path = process.argv[2];
const topN = Number(process.argv[3] ?? 6);
const c = JSON.parse(readFileSync(path, 'utf8'));
const m = c.__meta;
console.log(`# ${path}`);
console.log(`# meta ${m ? `srcId ${m.srcId} tool ${m.toolHash} stations ${m.stationsHash} finished ${m.finishedAt}` : 'ABSENT — UNQUOTABLE'}`);
const IDS = (m && m.ids) || Object.keys(c).filter((k) => k !== '__meta');
for (const id of IDS) {
  const e = c[id];
  if (!e || !e.ss || !e.ss.adjacent) { console.log(`${id.padEnd(12)} NO ss.adjacent`); continue; }
  const A = e.ss.adjacent;
  const tot = A.reduce((s, p) => s + p.contacts, 0);
  const weak = A.filter((p) => p.dL < 0.10);
  const weakC = weak.reduce((s, p) => s + p.contacts, 0);
  const pct = tot ? (100 * weakC) / tot : 0;
  console.log(`${id.padEnd(12)} weakB% ${pct.toFixed(1).padStart(5)}  ${pct > 15 ? 'FAIL' : 'pass'}  contacts ${tot}  pairs ${A.length} weakPairs ${weak.length}`);
  for (const p of weak.slice().sort((x, y) => y.contacts - x.contacts).slice(0, topN)) {
    console.log(`    ${String(p.a ?? p.from).padEnd(14)}|${String(p.b ?? p.to).padEnd(14)} dL ${String(p.dL).padStart(7)}  contacts ${String(p.contacts).padStart(6)} (${(100 * p.contacts / tot).toFixed(1)}%)  lumaA ${p.lumaA ?? '—'} lumaB ${p.lumaB ?? '—'}`);
  }
}
