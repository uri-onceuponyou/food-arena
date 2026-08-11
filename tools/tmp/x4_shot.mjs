#!/usr/bin/env node
/**
 * X4_SHOT — photograph the 2800x2000 kitchen at the MATCH camera, from stations spread
 * over the whole map, and at the LOBBY-shallow pitch as well.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `sp_shot.mjs` photographs a six-fighter opening from ONE seat, which is the right shot
 * for "do the spawns work" and the wrong one for "does the map read". At x4 area, a single
 * match-camera frame covers roughly a fortieth of the playfield: judging the layout from
 * `n6-playing.png` would be judging 2.5% of it. `arena-scan.mjs`'s 18 stations are all
 * 1400x1000 coordinates and now all land in the map's north-west QUADRANT, so it cannot
 * answer this either (reported, not fixed — that file is not this pass's).
 *
 * So: a station per DISTRICT, parked with the shipped `?px=`/`?py=` transport, plus the
 * arena's own six spawns. **The point is to LOOK at them** (`CLAUDE.md` rule 3), which is
 * why this tool prints nothing a reader could mistake for a verdict.
 *
 * ── THE TRAPS IT IS BUILT AROUND (docs/AGENT-BRIEF §3) ─────────────────────
 *   * camera shake re-randomises on EVERY `render()`, so a frozen frame is not a frozen
 *     camera — zeroed explicitly before every capture;
 *   * CSS animations run on the document timeline, so freezing rAF does not still the HUD
 *     — `animations: 'disabled'`;
 *   * `window.__gameReady` is not a paint — frames are cranked after it;
 *   * `main.ts:MATCH_ONLY_PARAMS` does not contain `fighters`, so `&screen=match` is
 *     load-bearing on any URL that carries it (see `sp_shot.mjs`'s note).
 *
 * ── USAGE ──────────────────────────────────────────────────────────────────
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/x4_shot.mjs --url '{URL}'
 *   node tools/tmp/x4_shot.mjs --url <base> --only hub,west_bay
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/x4`));
const ONLY = arg('--only', null);
const W = 1280, H = 720;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const ARENA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));

/**
 * One station per district of the layout `kitchen.ts` declares, so the set covers the map
 * rather than one quadrant of it. Coordinates are the DISTRICT's own, not a spawn's,
 * except where a district IS a spawn bay.
 */
const STATIONS = [
  { id: 'hub', x: ARENA.center.x, y: ARENA.center.y - 190, note: 'the boiling pot, the four stove islands and the sink counter — the one thing that did NOT scale' },
  { id: 'west_bay', x: 300, y: 810, note: 'slot 0/1 spawn bay: the freezer stack north, the prep peninsula east' },
  { id: 'north_lane', x: 1150, y: 210, note: 'slot 2/3 spawn bay: the north wall service line' },
  { id: 'ne_bay', x: 2560, y: 300, note: 'slot 4/5 spawn bay: the pantry nook west, the wall counter north' },
  { id: 'pantry_ne', x: 2350, y: 560, note: 'the NE pantry nook and its wood pad, looking north' },
  { id: 'cook_line_e', x: 1980, y: 700, note: 'the east cook line — two stove islands butted into one run (NEW structure)' },
  { id: 'prep_galley_w', x: 830, y: 700, note: 'the west prep galley and the pantry shelf beside it' },
  { id: 'east_room', x: 2450, y: 1000, note: 'the mid-map walk-in and its utility pad, the east bay inboard wall' },
  { id: 'north_wall', x: 1400, y: 260, note: 'the north wall centrepiece and the hub approach island' },
  { id: 'west_strip', x: 120, y: 500, note: 'the west wall strip: barrels flush to the bound, concealment patch beside' },
];

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

async function shoot(browser, st, frames = 90) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.addInitScript(() => {
    let virt = 0;
    performance.now = () => virt;
    window.__clk = { advance(ms) { virt += ms; } };
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  const url = `${BASE}/?screen=match&px=${st.x}&py=${st.y}&pointerLock=0&simSpeed=0`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
  await page.evaluate(async (f) => {
    for (let i = 0; i < f; i++) {
      window.__clk.advance(16.667);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }, frames);
  await page.evaluate(() => {
    const rig = window.__stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
    window.__stage.render(0);
  });
  const png = `${OUT}/${st.id}.png`;
  await page.screenshot({ path: png, animations: 'disabled' });
  const at = await page.evaluate(() => {
    const s = window.__vfxDebugFighters?.slots?.[0];
    return s ? { x: Math.round(s.x), y: Math.round(s.y) } : null;
  });
  await page.close();
  return { png, sha: sha(readFileSync(png)), at, errors: errors.filter((e) => !/Failed to load resource/i.test(e)) };
}

mkdirSync(OUT, { recursive: true });
console.log(`\nx4_shot — ${BASE} @ ${W}x${H} · arena ${ARENA.width}x${ARENA.height}, ${ARENA.cover.length} cover boxes\n`);
const list = ONLY ? STATIONS.filter((s) => String(ONLY).split(',').includes(s.id)) : STATIONS;
const browser = await chromium.launch({ args: LAUNCH });
let bad = 0;
try {
  for (const st of list) {
    const r = await shoot(browser, st);
    const parked = r.at && Math.hypot(r.at.x - st.x, r.at.y - st.y) < 60;
    if (!parked || r.errors.length) bad++;
    console.log(`  ${parked && !r.errors.length ? 'ok  ' : 'FAIL'} ${st.id.padEnd(15)} asked (${st.x},${st.y})  landed ${r.at ? `(${r.at.x},${r.at.y})` : 'nowhere'}`);
    console.log(`       ${r.png}  sha ${r.sha}`);
    console.log(`       ${st.note}`);
    if (r.errors.length) console.log(`       JS: ${r.errors.slice(0, 2).join(' | ')}`);
  }
} finally {
  await browser.close();
}
console.log(`\n${bad ? `${bad} station(s) did not park or threw` : 'every station parked and rendered'} — NOW READ THE PNGs.\n`);
process.exitCode = bad ? 1 : 0;
