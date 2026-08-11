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
 *
 * 🔴 **NO NOTE HERE NAMES A SLOT ANY MORE — THE SLOT LABEL IS DERIVED FROM THE SHIPPED DUMP.**
 * ⚠️ Three of these captions used to read, and were wrong for four hours:
 *
 *     west_bay    'slot 0/1 spawn bay: …'      ← still true
 *     north_lane  'slot 2/3 spawn bay: …'      ← FALSE: no seat within 536 wu of it
 *     ne_bay      'slot 4/5 spawn bay: …'      ← WRONG PAIR: it is slot 2/3's bay now
 *
 * `2d3e9bd` moved pair B to (2670,290) and pair C to (1590,510) — seat unfairness 2.680 →
 * 0.342 places of 6 over 600 matches. **The stations stayed valid** (they are districts, and
 * the districts did not move); only the captions went stale, which is the failure mode a
 * hand-maintained label always has. So the label is now computed against
 * `tools/arena.gameplay.json` at print time and cannot disagree with the map: a caption that
 * has to be edited when a coordinate moves will eventually not be.
 */
const STATIONS = [
  { id: 'hub', x: ARENA.center.x, y: ARENA.center.y - 190, note: 'the boiling pot, the four stove islands and the sink counter — the one thing that did NOT scale' },
  { id: 'west_bay', x: 300, y: 810, note: 'the west bay: the freezer stack north, the prep peninsula east' },
  { id: 'north_lane', x: 1150, y: 210, note: 'the north wall service line' },
  { id: 'ne_bay', x: 2560, y: 300, note: 'the north-east corner bay: the pantry nook west, the wall counter north' },
  { id: 'pantry_ne', x: 2350, y: 560, note: 'the NE pantry nook and its wood pad, looking north' },
  { id: 'cook_line_e', x: 1980, y: 700, note: 'the east cook line — two stove islands butted into one run (NEW structure)' },
  { id: 'prep_galley_w', x: 830, y: 700, note: 'the west prep galley and the pantry shelf beside it' },
  { id: 'east_room', x: 2450, y: 1000, note: 'the mid-map walk-in and its utility pad, the east bay inboard wall' },
  { id: 'north_wall', x: 1400, y: 260, note: 'the north wall centrepiece and the hub approach island' },
  { id: 'west_strip', x: 120, y: 500, note: 'the west wall strip: barrels flush to the bound, concealment patch beside' },
];

/**
 * How close a station has to be to a shipped seat before it is CALLED that seat's bay.
 *
 * 200 wu is deliberately tighter than the frame: the match camera shows far more ground than
 * this, so a seat 300 wu away is still in shot — but "this station IS the slot 2/3 bay" is a
 * stronger claim than "a seat is somewhere in the picture", and the caption makes the stronger
 * one. At 200 wu `west_bay` binds at 0.0 wu and `ne_bay` at 110.5; the next nearest station is
 * 355 wu from any seat, so nothing here sits on the threshold.
 */
const SPAWN_TAG_WU = 200;

/** The slot label for a station, or null — read from the dump, never typed. */
function spawnAt(st) {
  let best = -1, bd = Infinity;
  ARENA.spawns.forEach((s, i) => {
    const d = Math.hypot(s.x - st.x, s.y - st.y);
    if (d < bd) { bd = d; best = i; }
  });
  if (best < 0 || bd > SPAWN_TAG_WU) return null;
  const pair = best - (best % 2);
  return { seat: best, pair, d: bd, at: ARENA.spawns[best] };
}

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
    const sp = spawnAt(st);
    console.log(`       ${sp ? `[slot ${sp.pair}/${sp.pair + 1} SPAWN BAY — seat ${sp.seat} at (${sp.at.x},${sp.at.y}), ${sp.d.toFixed(1)} wu away] ` : ''}${st.note}`);
    if (r.errors.length) console.log(`       JS: ${r.errors.slice(0, 2).join(' | ')}`);
  }
} finally {
  await browser.close();
}

// ── Which spawn bays nothing photographed ───────────────────────────────────
// ⚠️ NON-EMPTY FIRST. `[].every()` / a loop that never runs would report "every bay has a
// station" on a dump with no spawns at all — three guards went vacuous in one session exactly
// that way. The pair is the unit, not the seat: the map is 180°-point-symmetric, so a station
// on the north-half seat photographs the pair.
if (!Array.isArray(ARENA.spawns) || ARENA.spawns.length === 0) {
  bad++;
  console.log('\n  🔴 tools/arena.gameplay.json has NO spawns — the bay labels above are vacuous, not clean.');
} else {
  const missing = [];
  for (let k = 0; k < ARENA.spawns.length; k += 2) {
    const s = ARENA.spawns[k];
    if (!STATIONS.some((st) => Math.hypot(s.x - st.x, s.y - st.y) <= SPAWN_TAG_WU)) missing.push(`${k}/${k + 1} (${s.x},${s.y})`);
  }
  console.log(`\n  spawn pairs (${ARENA.spawns.length / 2} in the dump) with NO station within ${SPAWN_TAG_WU} wu: `
    + `${missing.length ? `${missing.join(' · ')} — nothing here photographs ${missing.length === 1 ? 'that bay' : 'those bays'}` : 'none'}`);
}

console.log(`\n${bad ? `${bad} station(s) did not park or threw` : 'every station parked and rendered'} — NOW READ THE PNGs.\n`);
process.exitCode = bad ? 1 : 0;
