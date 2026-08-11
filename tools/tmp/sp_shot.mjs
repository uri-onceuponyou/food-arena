#!/usr/bin/env node
/**
 * SPAWN PROOF — start a real 3-, 4- and 6-fighter match ON THE ARENA'S OWN SPAWNS and
 * photograph it.
 *
 * ── WHY THIS IS NOT `np_nfighter.mjs` ───────────────────────────────────────
 * `np_nfighter` proved the PRESENTATION is N-capable, and its spawns are a ring of radius
 * 190 wu that it generates itself — a measuring fixture, declared as such, chosen so every
 * fighter is inside `FAIR_PLAY.radiusUnits` and fits in one screenshot. That was the right
 * fixture for "does the renderer draw six of them".
 *
 * This asks the other question: **do the coordinates `src/arena/kitchen.ts` now SHIPS
 * actually seat a match?** So the coordinates are read out of `tools/arena.gameplay.json`'s
 * `spawns` — the arena's own list — and are never generated here. The consequence is that
 * these fighters are 500-1100 wu apart, which is the point and which is why the camera
 * cannot hold them all: the shots are of a REAL opening, not of a diorama.
 *
 * ⚠️ `?fighters=` REMAINS A TRANSPORT WITH NO PLACEMENT POLICY (`DECISIONS §49d`). It
 * carries coordinates a caller chose, exactly like `?px=`/`?py=`. This tool is a caller
 * that chose the arena's; that is a fact about this tool, not a new rule in `match.ts`.
 * The one assertion that would catch the rule being broken is §D below: the page's own
 * `window.__matchArena.spawns` must equal the dump, i.e. the ARENA carries the list.
 *
 * ── THE TRAPS THIS FILE IS BUILT AROUND (docs/AGENT-BRIEF §3) ───────────────
 *   * camera shake re-randomises on EVERY `render()`, so a frozen frame is not a frozen
 *     camera — zeroed explicitly before the capture;
 *   * CSS animations run on the document timeline, so freezing rAF does not still the HUD
 *     — `animations: 'disabled'` on the screenshot;
 *   * `window.__gameReady` is not a paint — frames are cranked after it.
 *
 * ── 🔴 IT EXITS NON-ZERO ON TODAY'S MAP, AND THAT IS THE RESULT ─────────────
 * One row fails at N=6: **no fighter is dead 9 s into the match.** Slot 0 is, and slot 5 is
 * on 11 HP, because slots 0/4 and 1/5 open **75.2 wu apart** — the best the 1400x1000
 * kitchen can do with three pairs (`kitchen.ts`'s spawn block). N=3 and N=4 are the paired
 * control in the same run and finish at full health. **Do NOT register this as a gate and
 * do NOT weaken the row to make it green**: it is a true statement about a shipped map, and
 * it goes away when `DECISIONS §48`'s 2800x2000 arena lands, not before.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/sp_shot.mjs --url '{URL}'
 *   node tools/tmp/sp_shot.mjs --url <base> --n 6        # one size only
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/sp`));
const ONLY = arg('--n', null);
const W = 1280, H = 720;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const ARENA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const SPAWNS = ARENA.spawns;
if (!Array.isArray(SPAWNS) || SPAWNS.length < 6) {
  console.error('sp_shot: tools/arena.gameplay.json declares no 6-spawn list. Refresh it:');
  console.error('  node tools/tmp/with_snapshot.mjs -- node tools/match-sim.mjs --refresh-arena --url {URL}');
  process.exit(2);
}
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];

/** Slots 0..n-1 of the SHIPPED list. Nothing here invents a coordinate. */
const rosterParam = (n) => CAST.slice(0, n)
  .map((id, i) => `${id}@${SPAWNS[i].x},${SPAWNS[i].y}`).join(';');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

/**
 * `frames` cranked at a frozen clock. `COUNTDOWN_FROM` is 3 s plus a 700 ms "START!" hold,
 * so ~222 frames is the earliest `phase === 'playing'` and 540 is ~9 s of match — long
 * enough that fighters have left their spawns and the shot is of a match rather than of a
 * starting grid.
 */
async function shoot(browser, n, frames, tag) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  const requestFails = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) requestFails.push(`${r.status()} ${r.url()}`); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let virt = 0;
    performance.now = () => virt;
    window.__clk = { advance(ms) { virt += ms; } };
    void realNow;
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  // ⚠️ `&screen=match` IS LOAD-BEARING AND IT IS AN OUT-OF-SET DEFECT, NOT A PREFERENCE.
  // `src/main.ts:MATCH_ONLY_PARAMS` is `['player','enemy','simSpeed','fogRadius','px','py']`
  // — `fighters` is NOT in it, so `?fighters=…` alone boots the TITLE CARD and
  // `window.__gameReady` never fires. It cost a 90 s timeout that reads exactly like the
  // sim refusing to seat the match, which is the failure this whole pass is about.
  // `np_nfighter.mjs` never hit it because it also passes `&fogRadius=900&simSpeed=1`,
  // which route by accident. Reported, not fixed here: `main.ts` is not this file set's.
  const url = `${BASE}/?screen=match&fighters=${encodeURIComponent(rosterParam(n))}&pointerLock=0`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
  await page.evaluate(async (f) => {
    for (let i = 0; i < f; i++) {
      window.__clk.advance(16.667);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }, frames);
  // 🚨 The shake decay is multiplied by dt and the RE-RANDOMISATION is not, so every
  // render() moves the camera. Zero it, then draw the frame we photograph.
  await page.evaluate(() => {
    const rig = window.__stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
    window.__stage.render(0);
  });
  const png = `${OUT}/${tag}.png`;
  await page.screenshot({ path: png, animations: 'disabled' });
  const data = await page.evaluate(() => ({
    phase: window.__matchDebug?.phase ?? null,
    winner: window.__matchDebug?.winner ?? null,
    slots: window.__vfxDebugFighters?.slots ?? null,
    arenaSpawns: window.__matchArena?.spawns ?? null,
    plates: document.querySelectorAll('.hud-fighter').length,
    names: [...document.querySelectorAll('.hud-fighter-name')].map((e) => e.textContent),
    // `VfxFighterSnapshot` carries `hp` and not `maxHp`, and a bare HP is not comparable
    // across a roster whose pools differ by 70..120. The HUD's readout is `"28 / 90"` and
    // `np_nfighter` already pins it as per-slot and index-aligned, so the denominator comes
    // from there rather than from a second copy of `maxHpFor` in this file.
    hpText: [...document.querySelectorAll('.hud-healthbar-text')].map((e) => e.textContent),
    timer: document.querySelector('[data-el="timer"]')?.textContent ?? null,
  }));
  await page.close();
  return { ...data, png, sha: sha(readFileSync(png)), errors, requestFails };
}

mkdirSync(OUT, { recursive: true });
console.log(`\nsp_shot — ${BASE} @ ${W}x${H}`);
console.log(`   spawns from tools/arena.gameplay.json: ${SPAWNS.map((s) => `(${s.x},${s.y})`).join(' ')}\n`);

const browser = await chromium.launch({ args: LAUNCH });
try {
  for (const n of (ONLY ? [Number(ONLY)] : [3, 4, 6])) {
    console.log(`── N = ${n} ──────────────────────────────────────────────`);
    // §A — ON THE GRID. 60 frames = 1.0 s: still inside the 3 s countdown, so nobody has
    // moved and every fighter must be exactly on its declared spawn.
    const grid = await shoot(browser, n, 60, `n${n}-spawn`);
    // §B — RUNNING. 540 frames = 9.0 s: past the countdown and past first contact.
    const play = await shoot(browser, n, 540, `n${n}-playing`);

    for (const [label, r] of [['spawn', grid], ['playing', play]]) {
      const jsErrors = r.errors.filter((e) => !/Failed to load resource/i.test(e));
      check(`[N=${n}/${label}] the page threw no JS exception`, jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
      if (r.requestFails.length) console.log(`  info - ${r.requestFails.length} failed request(s): ${r.requestFails.slice(0, 2).join(' | ')}`);
      check(`[N=${n}/${label}] the sim seats ${n} fighters`, r.slots?.length === n, `slots=${r.slots?.length}`);
      check(`[N=${n}/${label}] ${n} nameplates in the HUD`, r.plates === n, `got ${r.plates}`);
      console.log(`         ${r.png}  sha ${r.sha}  phase=${r.phase} timer=${r.timer}`);
    }
    // 🚨 THE ROW THAT WOULD CATCH `createMatch` THROWING: a match that refused to start
    // has no `phase` at all, and one that started at the WRONG place still photographs.
    check(`[N=${n}] every fighter is on ITS OWN declared spawn during the countdown`,
      grid.slots?.every((s, i) => Math.abs(s.x - SPAWNS[i].x) < 0.5 && Math.abs(s.y - SPAWNS[i].y) < 0.5),
      JSON.stringify(grid.slots?.map((s) => [Math.round(s.x), Math.round(s.y)])));
    check(`[N=${n}] the countdown shot IS the countdown`, grid.phase === 'countdown', String(grid.phase));
    check(`[N=${n}] the 9 s shot is a match in PLAY`, play.phase === 'playing', String(play.phase));
    check(`[N=${n}] …and the fighters have MOVED off their spawns by then`,
      play.slots?.some((s, i) => Math.hypot(s.x - SPAWNS[i].x, s.y - SPAWNS[i].y) > 40),
      JSON.stringify(play.slots?.map((s, i) => Math.round(Math.hypot(s.x - SPAWNS[i].x, s.y - SPAWNS[i].y)))));
    check(`[N=${n}] the ARENA carries the spawn list (not the URL)`,
      Array.isArray(grid.arenaSpawns) && grid.arenaSpawns.length === SPAWNS.length
        && grid.arenaSpawns.every((s, i) => s.x === SPAWNS[i].x && s.y === SPAWNS[i].y),
      JSON.stringify(grid.arenaSpawns));
    // ── THE OPENING, MEASURED ────────────────────────────────────────────────
    // ⚠️ THE FIRST DRAFT CALLED THIS ROW "nobody spawned in the fire" AND IT WAS THE WRONG
    // NAME FOR THE NUMBER IT PRINTS. Nobody spawns in the fire — `spawn_runway` guarantees
    // that. What N=6 actually shows is the 75.2 wu spawn-bay collision doing its damage,
    // and a row whose label names a cause it does not test is how a real finding gets
    // filed as a flake.
    const frac = (i) => {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(play.hpText?.[i] ?? '');
      return m ? Number(m[1]) / Number(m[2]) : null;
    };
    const nearest = (i) => Math.min(...SPAWNS.slice(0, n).map((s, j) => (i === j ? Infinity
      : Math.hypot(s.x - SPAWNS[i].x, s.y - SPAWNS[i].y))));
    console.log(`         opening census at 9 s — slot: hp/max (frac) · spawn · nearest other spawn`);
    play.slots?.forEach((s, i) => console.log(`           ${i}  ${String(play.hpText?.[i] ?? '?').padEnd(10)}`
      + ` ${(frac(i) ?? NaN).toFixed(2)}  (${SPAWNS[i].x},${SPAWNS[i].y})  ${nearest(i).toFixed(1)} wu`
      + `${s.alive ? '' : '   ← DEAD'}`));
    check(`[N=${n}] no fighter is dead 9 s into the match`,
      play.slots?.every((s) => s.alive), JSON.stringify(play.slots?.map((s, i) => [i, Math.round(s.hp), s.alive])));
    // THE CAUSAL CLAIM, AS A TEST RATHER THAN AS A PARAGRAPH. If the damage at N=6 were
    // just "six fighters is a busier match", it would not land preferentially on the four
    // seats that share a bay. `n < 6` has no bay-sharing seat, so the row is skipped there
    // — and N=3/N=4 are the PAIRED CONTROL for it: same map, same clock, same cast prefix.
    if (n === 6) {
      const shared = [0, 1, 4, 5];                            // the two bay pairs, 75.2 wu apart
      const order = play.slots.map((_, i) => i).sort((a, b) => (frac(a) ?? 1) - (frac(b) ?? 1));
      check('[N=6] the two WORST-hurt seats are ones that share a spawn bay (the 75.2 wu opening)',
        order.slice(0, 2).every((i) => shared.includes(i)),
        `damage order (worst first): ${order.join(',')} — bay-sharing seats are ${shared.join(',')}`);
    }
  }
} finally {
  await browser.close();
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`);
process.exitCode = fail ? 1 : 0;
