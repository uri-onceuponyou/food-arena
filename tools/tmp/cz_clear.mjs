#!/usr/bin/env node
/**
 * CZ CLEAR — does the new canopy intersect anything?
 *
 * The patches were placed ">= 95% standable", i.e. their FOOTPRINTS were checked against
 * prop collision collars with a small overlap tolerated. That was safe while the tallest
 * thing on a patch was 0.62 m: a 5% footprint overlap with a counter is a plate clipping
 * a plinth, at ankle height, mostly hidden. It is NOT obviously safe now that the same
 * footprint is extruded to 2.99 m, because that overlap is now a rail through a freezer.
 *
 * 🚨 This is the reason a rendered frame is not enough on its own: there are TWENTY
 * patches and I looked at four. So this reads the arena the BROWSER built — `__matchArena`,
 * the same object the sim steps — and reports, for every (concealment, cover) pair, the
 * axis-aligned overlap of their rectangles in world units.
 *
 * It asserts the set it measures is NON-EMPTY at both ends (`CLAUDE.md` rule 6: a filter
 * that empties its own input passes vacuously), and prints the worst overlaps whether or
 * not any threshold is crossed — a number to read, not a green tick.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/cz_clear.mjs --url {URL}
 */
import { chromium } from 'playwright';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('cz_clear: --url or PREVIEW_BASE required'); process.exit(2); }

const b = await chromium.launch({ args: LAUNCH });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.02`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 180000 });
const dump = await p.evaluate(() => {
  const a = window.__matchArena;
  return a ? { cover: a.cover ?? [], conceal: a.concealment ?? [] } : null;
});
await b.close();

if (!dump) { console.error('cz_clear: no __matchArena'); process.exit(2); }
const { cover, conceal } = dump;
if (conceal.length === 0) { console.error('cz_clear: ZERO concealment boxes — nothing to check, refusing to pass'); process.exit(3); }
if (cover.length === 0) { console.error('cz_clear: ZERO cover boxes — the comparison set is empty, refusing to pass'); process.exit(3); }

const rows = [];
for (const c of conceal) {
  for (const v of cover) {
    const ox = Math.min(c.x + c.w / 2, v.x + v.w / 2) - Math.max(c.x - c.w / 2, v.x - v.w / 2);
    const oz = Math.min(c.y + c.h / 2, v.y + v.h / 2) - Math.max(c.y - c.h / 2, v.y - v.h / 2);
    if (ox > 0 && oz > 0) {
      rows.push({ conceal: `${c.kind}@${c.x},${c.y}`, cover: `${v.kind}@${v.x},${v.y}`,
        overlapWu2: +(ox * oz).toFixed(1), pctOfPatch: +(100 * ox * oz / (c.w * c.h)).toFixed(2) });
    }
  }
}
rows.sort((a, z) => z.overlapWu2 - a.overlapWu2);
console.log(`cz_clear: ${conceal.length} concealment x ${cover.length} cover = ${conceal.length * cover.length} pairs`);
console.log(`overlapping pairs: ${rows.length}`);
for (const r of rows.slice(0, 12)) console.log(`  ${String(r.pctOfPatch).padStart(6)}%  ${r.overlapWu2.toString().padStart(8)} wu^2   ${r.conceal.padEnd(24)} x ${r.cover}`);
if (rows.length === 0) console.log('  none — every canopy is extruded over open floor');
