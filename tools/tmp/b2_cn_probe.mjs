#!/usr/bin/env node
/**
 * B2_CN_PROBE — CN-1: is "concealed opponents keep their HP pill and radar blip" (cn_shot,
 * six seats, shipped regions) a defect in the GAME or in the INSTRUMENT?
 *
 * `tools/tmp/cn_shot.mjs` derives its expectation from GEOMETRY alone — region membership
 * and distance — and says the two mechanisms geometry cannot see (`Fighter.revealedUntil`,
 * the attack-reveal window, and `MatchState.brokenConcealment`, a plate destroyed by an
 * attack from under it, `DECISIONS §29c`) are *"held off by `?simSpeed=0.005`"*. A slow sim
 * does not stop the first AI attack; it only stretches what follows it. So this records,
 * on EVERY rendered frame from the first, what cn_shot reads once at the end:
 *
 *   pill / blip   `display` of `float-<key>` / `radar-<key>` — the same two reads cn_shot makes
 *   hp, alive     `__vfxDebugFighters.slots` — damage landing is combat having started
 *   attacks       `__vfxQaCounts.cast + meleeArc` — the VFX layer's count of attacks drawn
 *
 * Verdict rule, stated before the run: if an expected-hidden slot is HIDDEN on the early
 * playing frames and flips to shown only once attacks have been drawn, the game is applying
 * its own §29c rule and cn_shot's expectation is wrong. If it is shown from the first playing
 * frame with no attack drawn, the game's wiring is wrong.
 *
 * The seating is cn_shot's `resolveAnchor` + `seatsFor`, COPIED (that file is a script with
 * top-level await and cannot be imported) — so the scene is the one cn_shot asserts over.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/b2_cn_probe.mjs --url '{URL}'
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
if (!BASE) { console.error('b2_cn_probe: --url or PREVIEW_BASE required'); process.exit(2); }
const SIM_SPEED = String(arg('--sim-speed', '0.005'));
const WAIT_MS = Number(arg('--wait', 4000));
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const ROSTER = ['hamburger', 'egg', 'donut', 'lollipop', 'burrito', 'taco'];
const KEYS = ['player', 'enemy', 'slot2', 'slot3', 'slot4', 'slot5'];

/** cn_shot's `seatsFor`, verbatim in effect. */
function seatsFor(region, R) {
  const hw = region.w / 2, hh = region.h / 2, inset = 6;
  const p0 = { x: region.x - hw + inset, y: region.y - hh + inset };
  const near = Math.min(R - 30, region.w * 0.35);
  return [
    { x: p0.x, y: p0.y }, { x: region.x + hw - inset, y: region.y + hh - inset },
    { x: region.x + hw - inset, y: region.y + 0.33 * hh }, { x: p0.x - (R + 46), y: p0.y + 10 },
    { x: p0.x + near, y: p0.y + near * 0.4 }, { x: p0.x - (R - 40), y: p0.y - 24 },
  ];
}

const browser = await chromium.launch({ args: LAUNCH });
const R = 84;
let code = 0;
try {
  const scout = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await scout.goto(`${BASE}/?fogRadius=900&simSpeed=0.01&pointerLock=0`, { waitUntil: 'networkidle' });
  await scout.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
  const { anchor: region, all: regions } = await scout.evaluate(() => {
    const a = window.__matchArena; const c = a.center;
    const big = a.concealment.filter((b) => b.w >= 110 && b.h >= 110);
    const pool = big.length ? big : a.concealment;
    let best = null, bestD = Infinity;
    for (const b of pool) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bestD) { bestD = d; best = b; } }
    return { anchor: { x: best.x, y: best.y, w: best.w, h: best.h },
      all: a.concealment.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })) };
  });
  await scout.close();
  /**
   * ARM `cnshot` — cn_shot's own scene. ARM `quiet` — the SAME anchor plate and the same
   * expected-hidden pair, seated so that NOBODY HAS ANYONE TO SHOOT: s1/s2 in opposite
   * corners of the anchor (> R apart, so they cannot see each other), the local seat hidden
   * under a second plate > R away, and s3-s5 on open ground ~1,500 wu off, beyond every
   * weapon's reach. If the game's wiring is right, s1/s2 are hidden there; if it is wrong,
   * they are shown there too.
   */
  const hw = region.w / 2, hh = region.h / 2, inset = 6;
  const other = regions
    .map((b) => ({ b, d: Math.hypot(b.x - region.x, b.y - region.y) }))
    .filter((o) => o.d >= 200 && o.d <= 420)
    .sort((p, q) => p.d - q.d)[0]?.b ?? null;
  if (!other) throw new Error('b2_cn_probe: no second plate 200-420 wu from the anchor');
  const far = { x: region.x > 1400 ? region.x - 1100 : region.x + 1100, y: region.y > 1000 ? region.y - 500 : region.y + 900 };
  const arms = {
    cnshot: seatsFor(region, R),
    quiet: [
      { x: other.x, y: other.y },
      { x: region.x + hw - inset, y: region.y + hh - inset },
      { x: region.x - hw + inset, y: region.y - hh + inset },
      { x: far.x, y: far.y }, { x: far.x + 60, y: far.y }, { x: far.x, y: far.y + 60 },
    ],
  };
  const verdicts = {};
  for (const [name, seats] of Object.entries(arms)) {
    const d01 = Math.hypot(seats[1].x - seats[0].x, seats[1].y - seats[0].y);
    const d02 = Math.hypot(seats[2].x - seats[0].x, seats[2].y - seats[0].y);
    const d12 = Math.hypot(seats[1].x - seats[2].x, seats[1].y - seats[2].y);
    verdicts[name] = await runArm(name, seats, { d01, d02, d12 });
  }
  console.log(`\n  VERDICTS: ${JSON.stringify(verdicts)}`);

  async function runArm(name, seats, dist) {
    const fighters = seats.map((s, i) => `${ROSTER[i]}@${Math.round(s.x)},${Math.round(s.y)}`).join(';');
    const url = `${BASE}/?fighters=${encodeURIComponent(fighters)}&fogRadius=900&simSpeed=${SIM_SPEED}&pointerLock=0`;

    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript((keys) => {
      const log = [];
      window.__b2cn = log;
      let last = '';
      const raf = window.requestAnimationFrame.bind(window);
      const sample = () => {
        const d = window.__matchDebug; const f = window.__vfxDebugFighters?.slots;
        if (d && f) {
          const dsp = (n) => { const e = document.querySelector(`[data-el="${n}"]`); return e ? getComputedStyle(e).display : 'MISSING'; };
          const c = window.__vfxQaCounts ?? {};
          const row = {
            frame: d.frames, phase: d.phase,
            pill: keys.map((k) => dsp(`float-${k}`)), blip: keys.map((k) => dsp(`radar-${k}`)),
            hp: f.map((s) => Math.round(s.hp)), alive: f.map((s) => s.alive),
            attacks: (c.cast ?? 0) + (c.meleeArc ?? 0),
            // `__vfxDebugScreen.slots[i]` projects the GROUND point regardless of visibility:
            // non-null = on camera, so a 'none' pill there can only be concealment.
            onCam: (window.__vfxDebugScreen?.slots ?? []).map((p) => p !== null),
          };
          const key = JSON.stringify([row.phase, row.pill, row.blip, row.hp, row.attacks, row.onCam]);
          if (key !== last) { last = key; log.push(row); }
        }
        raf(sample);
      };
      raf(sample);
    }, KEYS);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
    await page.waitForTimeout(WAIT_MS);
    const log = await page.evaluate(() => window.__b2cn);

    console.log(`\n── arm ${name} — ${BASE} · simSpeed ${SIM_SPEED} · anchor (${region.x},${region.y}) ${region.w}×${region.h}`
      + ` · d(s0,s1) ${dist.d01.toFixed(0)} d(s0,s2) ${dist.d02.toFixed(0)} d(s1,s2) ${dist.d12.toFixed(0)} wu (R = ${R})`);
    console.log('  frame  phase     attacks  pill s1 s2 · blip s1 s2 · hp[0..5]');
    for (const r of log) {
      console.log(`  ${String(r.frame).padStart(5)}  ${String(r.phase).padEnd(9)} ${String(r.attacks).padStart(5)}    `
        + `${r.pill[1].padEnd(5)} ${r.pill[2].padEnd(5)} · ${r.blip[1].padEnd(5)} ${r.blip[2].padEnd(5)} · ${r.hp.join(',')}`);
    }
    const playing = log.filter((r) => r.phase === 'playing');
    let out = { verdict: 'NO PLAYING FRAME' };
    if (playing.length === 0) { console.log('  NO PLAYING FRAME SAMPLED — no verdict'); code = 2; }
    else {
      const first = playing[0];
      const hiddenFirst = [1, 2].every((i) => first.pill[i] === 'none' && first.blip[i] === 'none');
      const flip = playing.find((r) => [1, 2].some((i) => r.pill[i] !== 'none' || r.blip[i] !== 'none'));
      console.log(`\n  first playing sample: frame ${first.frame}, attacks drawn ${first.attacks}, s1/s2 hidden: ${hiddenFirst}`);
      if (flip) console.log(`  first sample with s1/s2 shown: frame ${flip.frame}, attacks drawn ${flip.attacks}, hp ${flip.hp.join(',')}`);
      else console.log('  s1/s2 stayed hidden on every playing sample');
      const verdict = hiddenFirst && (!flip || flip.attacks > first.attacks)
        ? 'INSTRUMENT — hidden until attacks were drawn: the game applies §29c (reveal / broken plate)'
        : !hiddenFirst && first.attacks === 0
          ? 'GAME — shown on the first playing frame with no attack drawn'
          : 'UNDECIDED — read the timeline above';
      console.log(`  VERDICT: ${verdict}`);
      const last = playing[playing.length - 1];
      console.log(`  last sample, all six: pill ${last.pill.join(',')} · blip ${last.blip.join(',')} · on camera ${last.onCam.join(',')}`);
      out = { hiddenFirst, flipFrame: flip?.frame ?? null, attacksFirst: first.attacks, attacksLast: last.attacks,
        lastPill: [last.pill[1], last.pill[2]], lastBlip: [last.blip[1], last.blip[2]], verdict: verdict.split(' ')[0] };
    }

    await page.close();
    return out;
  }
} finally {
  await browser.close();
}
process.exit(code);
