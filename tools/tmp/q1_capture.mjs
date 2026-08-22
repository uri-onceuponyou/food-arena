#!/usr/bin/env node
/**
 * Q1 CAPTURE — the arena/cast action frames for the first blind-critic round since the
 * map doubled. A fork of `tools/tmp/baseline_capture.mjs` with ONE substantive change,
 * and it is the reason this file exists rather than a flag on that one.
 *
 * ── 🚨 THE DEFECT THIS FILE WAS WRITTEN TO FIX ──────────────────────────────
 * `baseline_capture.mjs` anchors the player with
 *
 *     px: String(args.px ?? 860), py: String(args.py ?? 500)
 *
 * under a comment that reads *"Anchor the player just EAST of the boiling pot
 * (700,500,r=95), the arena's centre feature ... (860,500) is 160 wu from the pot
 * centre"*. Every one of those numbers is a **1× map coordinate**. The arena is
 * 2800×2000 centred (1400,1000) since `6631446`, and the pot is at `CENTER`
 * (`src/arena/kitchen.ts:787`, `groundPos(CENTER.x, CENTER.y)`).
 *
 * (860,500) is therefore **735.9 wu** from the pot, not 160 — and it sits in the NW
 * quadrant, which is *exactly* the 1× playfield. That is why nothing caught it:
 * **the 1× playfield is the NW quadrant of the ×4 one, so a stale coordinate is still
 * a LEGAL coordinate.** `al_guard.mjs` §C (inside-a-CoverBox / off-map) passes on it,
 * because it is neither; §D (single-quadrant clustering) needs ≥5 stations in one
 * file and this file has one. Measured, not assumed — see `--preflight` below.
 *
 * So the anchor here is **DERIVED**: `tools/arena.gameplay.json`'s `center` plus an
 * offset expressed in the pot's own `dangerRadius`. Nothing is retyped, so the next
 * resize moves it automatically.
 *
 * ── THE GUARD, AND WHY IT IS NOT VACUOUS ────────────────────────────────────
 * `--preflight` judges the anchor on four detectors and prints them. Every one is
 * shown to FAIL on a known-bad first (`--known-bad`, which feeds it the literal
 * (860,500) of the tool this forks) — a guard that has not been shown to fail on the
 * bug it guards against is not a guard. And because three of the four arms are
 * filters over the CoverBox list, the guard asserts that list is **NON-EMPTY** before
 * asserting anything over it: `[].every()` returns `true`.
 *
 * ── UNCHANGED FROM baseline_capture.mjs, DELIBERATELY ───────────────────────
 * The eligibility band (both alive, both on screen, 45–140 wu apart, VFX within
 * 700 ms), the drive loop, the viewport (1600×900), the matchup (donut vs taco) and
 * `captureSettled` provenance. The round's whole point is a before/after against
 * `shots/review/baseline`, and every one of those is part of what was measured.
 *
 * ⚠️ It still cannot put 3–5 fighters on screen: `?fighters=` exists but is QA-ONLY
 * (`match.ts:326` — *"Nothing in `src/` calls the list form"*), so the SHIPPED match
 * is 1v1 (`docs/STATE.md:40`). Capturing six would be showing a critic a screen the
 * player cannot reach. Reported, not papered over.
 *
 * Usage:
 *   node tools/tmp/q1_capture.mjs --preflight            # offline, no browser
 *   node tools/tmp/q1_capture.mjs --known-bad            # offline; the guard must FAIL
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean-072f245 -- \
 *     node tools/tmp/q1_capture.mjs --url '{URL}' --out shots/q1/cap --seed-profile
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
const ROOT = resolve(process.argv[1], '../../..');

// ─────────────────────────────────────────────────────────────────────────────
// the arena, read rather than retyped
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `tools/arena.gameplay.json` is the exported arena definition, and `al_guard.mjs` §F
 * asserts it agrees with `src/arena/shared.ts` on ARENA_W/H — so reading it here is
 * reading the source of truth through a checked mirror, not inventing a second one.
 */
const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));

/** wu. Half-extent of a fighter's AABB — `PLAYER_SIZE / 2`, the value `movement.ts` collides on. */
const FIGHTER_HALF = 21;

/** The pot: the arena's centre feature, and the only hazard the drive loop cares about. */
const POT = ARENA.hazards.find((h) => h.kind === 'damage' && h.x === ARENA.center.x && h.y === ARENA.center.y);

/**
 * The anchor, as a MULTIPLE of the pot's own danger radius.
 *
 * `baseline_capture.mjs` used 160 wu against a 95 wu danger radius — 1.684×. That
 * relationship is what was measured (outside the burn ring, outside the pot's
 * CoverBox, close enough that the fight reads as happening AT the map feature), so
 * the relationship is what is preserved. The literal is not.
 */
const ANCHOR_K = Number(args.anchorK ?? 1.684);

function derivedAnchor() {
  if (!POT) throw new Error('no central damage hazard in tools/arena.gameplay.json — cannot derive an anchor');
  return {
    x: Math.round(ARENA.center.x + POT.radius * ANCHOR_K),
    y: Math.round(ARENA.center.y),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// the guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Judge an anchor. Returns `{ ok, checks }`; every check carries the number it
 * decided on, because a green tick with no number is a comment.
 *
 * ⚠️ `arena` is a PARAMETER, not the module constant, so `--known-bad` can hand this
 * the 1× map. A guard that can only ever see today's map cannot be shown to fail.
 */
function judgeAnchor(pt, arena) {
  const checks = [];
  const add = (ok, name, detail) => { checks.push({ ok, name, detail }); return ok; };

  // ── §0: the guard can still see. Three arms below FILTER the cover list, and a
  // filter over an empty set passes — that trap fired three times in three files in
  // one session. So the input is asserted non-empty BEFORE anything is asserted over it.
  add(Array.isArray(arena.cover) && arena.cover.length > 0,
    'cover list is non-empty (a filter over [] passes)', `${arena.cover?.length ?? 0} boxes`);
  add(Array.isArray(arena.hazards) && arena.hazards.length > 0,
    'hazard list is non-empty', `${arena.hazards?.length ?? 0} hazards`);

  // ── §A: on the map at all.
  const onMap = pt.x > 0 && pt.x < arena.width && pt.y > 0 && pt.y < arena.height;
  add(onMap, 'inside the playfield', `(${pt.x},${pt.y}) in ${arena.width}×${arena.height}`);

  // ── §B: not standing in a prop. `movement.ts:tryMove` refuses every step out of an
  // overlap, and that reads exactly like a dead keyboard.
  const inBox = (arena.cover ?? []).find((b) => Math.abs(pt.x - b.x) <= b.w / 2 + FIGHTER_HALF
    && Math.abs(pt.y - b.y) <= b.h / 2 + FIGHTER_HALF);
  add(!inBox, 'clear of every CoverBox (+ fighter half-extent)',
    inBox ? `INSIDE ${inBox.kind} at (${inBox.x},${inBox.y}) ${inBox.w}×${inBox.h}` : 'clear');

  // ── §C: outside the burn ring, so the anchored player is not being cooked while the
  // AI walks in — the run would end on HP, not on a full candidate burst.
  const pot = (arena.hazards ?? []).find((h) => h.kind === 'damage');
  const dPot = pot ? Math.hypot(pt.x - pot.x, pt.y - pot.y) : Infinity;
  add(pot ? dPot > pot.radius + FIGHTER_HALF : false, 'outside the pot burn ring',
    pot ? `d=${dPot.toFixed(1)} vs r=${pot.radius}+${FIGHTER_HALF}` : 'no damage hazard found');

  // ── §D: THE ONE THAT MATTERS. Close enough to the centre feature that the fight
  // happens AT it. This is the arm that (860,500) fails, and the arm no legality check
  // can express — a stale 1× coordinate is a perfectly legal ×4 coordinate.
  const MAX_D = pot ? pot.radius * 3 : Infinity;
  add(dPot <= MAX_D, 'the fight lands AT the centre feature, not merely on the map',
    `d=${dPot.toFixed(1)} vs max ${MAX_D.toFixed(1)} (3× the pot radius)`);

  // ── §E: not a coordinate from the 1× map, which is exactly the NW quadrant.
  const oneX = { x: arena.width / 4, y: arena.height / 4 };
  const nearOneXCentre = Math.hypot(pt.x - oneX.x, pt.y - oneX.y) < pot?.radius * 3;
  add(!nearOneXCentre, 'not clustered on the 1× centre (the NW quadrant\'s middle)',
    `d to (${oneX.x},${oneX.y}) = ${Math.hypot(pt.x - oneX.x, pt.y - oneX.y).toFixed(1)}`);

  return { ok: checks.every((c) => c.ok), checks };
}

function report(title, pt, arena) {
  const v = judgeAnchor(pt, arena);
  console.log(`\n── ${title}: (${pt.x},${pt.y}) on ${arena.width}×${arena.height} centre (${arena.center.x},${arena.center.y})`);
  for (const c of v.checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} - ${c.name}  [${c.detail}]`);
  console.log(`  => ${v.ok ? 'PASS' : 'FAIL'}`);
  return v;
}

if (args.preflight || args['known-bad']) {
  const live = derivedAnchor();
  const good = report('DERIVED ANCHOR, live map', live, ARENA);

  // The known-bad: the literal this file forked, on today's map. It must FAIL, and it
  // must fail on §D/§E rather than on legality — that asymmetry IS the finding.
  const stale = { x: 860, y: 500 };
  const bad = report('KNOWN-BAD: baseline_capture.mjs\'s literal (860,500) on the ×4 map', stale, ARENA);

  // And the same literal on the map it was WRITTEN for, which must PASS — otherwise
  // the guard is just rejecting that point for some unrelated reason.
  const oneX = {
    width: ARENA.width / 2, height: ARENA.height / 2,
    center: { x: ARENA.center.x / 2, y: ARENA.center.y / 2 },
    cover: ARENA.cover.map((b) => ({ ...b, x: b.x / 2, y: b.y / 2, w: b.w / 2, h: b.h / 2 })),
    hazards: ARENA.hazards.map((h) => ({ ...h, x: h.x / 2, y: h.y / 2 })),
  };
  const onOwnMap = report('CONTROL: the same literal on the 1× map it was written for', stale, oneX);

  const verdict = [
    ['the derived anchor passes on the live map', good.ok],
    ['the stale literal FAILS on the live map', !bad.ok],
    ['the stale literal PASSES on its own 1× map (so the guard is judging STALENESS, not the point)', onOwnMap.ok],
    ['the failure is on distance-to-feature, NOT on legality (legality cannot see this class)',
      bad.checks.find((c) => c.name.startsWith('inside the playfield'))?.ok === true
      && bad.checks.find((c) => c.name.startsWith('clear of every CoverBox'))?.ok === true
      && bad.checks.find((c) => c.name.startsWith('the fight lands AT'))?.ok === false],
  ];
  console.log('\n── meta ──');
  for (const [name, ok] of verdict) console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${name}`);
  const allOk = verdict.every(([, ok]) => ok);
  console.log(`\n${allOk ? '✅ PASS' : '🔴 FAIL'}  q1_capture preflight: ${verdict.filter(([, o]) => o).length}/${verdict.length}`);
  process.exit(allOk ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// the capture — from here on this is baseline_capture.mjs, with the anchor derived
// ─────────────────────────────────────────────────────────────────────────────

const { chromium } = await import('playwright');
const { settleScreen, captureSettled } = await import('./settle.mjs');
// ── 🚨 THE HUD WAS IN EVERY FRAME THIS TOOL EVER TOOK, BY LUCK, AND NOTHING CHECKED ──
// This tool drives the SHIPPED route (`/?player=…`), not `preview.html`, and
// `captureSettled` screenshots the PAGE rather than `locator('canvas')` — so the DOM HUD
// has always been composited in. Verified on the pixels of `shots/q1/cap/
// match_donut_taco_00.png`, which carries both nameplates, both HP bars, the clock, the
// zone strip, two floating pills, a weapon slot and the radar.
//
// That was never ASSERTED. A regression that unmounted the HUD, or a future edit that
// switched this to a canvas-clipped screenshot, would have produced a silently
// interface-less packet with every existing arm still green — and the canonical rubric
// folds "interface polish" into the single score, so that panel scores zero in that
// category by construction. The guard now runs on every candidate BEFORE it is kept, and
// its verdict is written into the sidecar `hs_hudguard --verify` reads.
const { assertHudInFrame, hudSidecar, judgeHud, hudProbeFn, HUD_SELECTORS, printChecks } =
  await import('./hs_hudguard.mjs');

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
if (BASE.includes(':5173')) {
  console.error('\n!! --url is the SHARED dev server. Never measure there.\n');
  process.exit(2);
}
const OUT = String(args.out ?? 'shots/q1/cap');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const MATCHUPS = String(args.matchups ?? 'donut:taco').split(',').map((s) => {
  const [p, e] = s.split(':');
  return { player: p, enemy: e };
});
const D_MIN = Number(args.dmin ?? 45);
const D_MAX = Number(args.dmax ?? 140);
const VFX_WINDOW = 700;
const WANT = Number(args.candidates ?? 10);

const ANCHOR = derivedAnchor();
{
  const v = judgeAnchor(ANCHOR, ARENA);
  for (const c of v.checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} - ${c.name}  [${c.detail}]`);
  if (!v.ok) { console.error('anchor refused — run --preflight'); process.exit(3); }
  console.log(`anchor (${ANCHOR.x},${ANCHOR.y}), derived from centre (${ARENA.center.x},${ARENA.center.y}) + ${ANCHOR_K}×potR ${POT.radius}\n`);
}

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const QA_KEYS = ['cast', 'meleeArc', 'impact', 'death', 'heal', 'giantSlam', 'puddleSplash', 'coverScuff'];
const qaTotal = (c) => (c ? QA_KEYS.reduce((s, k) => s + (c[k] ?? 0), 0) : 0);

/**
 * A mid-progression profile, byte-identical to `baseline_capture.mjs`'s so the two
 * rounds differ in the GAME and not in the save.
 *
 * ⚠️ It is not cosmetic in a match: `matchScreen.ts:120` passes
 * `profile.characterLevel(route.player)` into the session and `enemyLevelFor` mirrors
 * it, so `--seed-profile` puts BOTH fighters at donut's level 5 instead of level 1.
 * Symmetric, so it is not a fairness change, but it IS a content change and is
 * recorded in the run report.
 */
const SEEDED_PROFILE = {
  name: 'Chef',
  wins: 64,
  losses: 39,
  xp: 180,
  selected: 'hamburger',
  economy: {
    trophies: 380,
    bestTrophies: 402,
    coins: 4820,
    gems: 63,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 1, fireBox: 0 },
    claimed: [10, 25, 42, 60, 85, 107, 130, 160, 190, 220],
    unlocked: ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop', 'pizza', 'sushi'],
    winsTowardChest: 2,
    lastMatch: null,
    levels: { hamburger: 7, donut: 5, taco: 4, burrito: 3, egg: 2, lollipop: 6, pizza: 3, sushi: 4 },
    seed: 20260805,
    rolls: 37,
  },
};

async function newPage(browser) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: Number(args.dsf ?? 1),
  });
  if (args['seed-profile']) {
    await page.addInitScript(([key, blob]) => {
      try { localStorage.setItem(key, blob); } catch { /* private mode */ }
    }, ['food-arena.profile.v1', JSON.stringify(SEEDED_PROFILE)]);
  }
  page.setDefaultTimeout(180_000);
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 240)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript', body: HMR_STUB,
  }));
  return page;
}

const READ = () => {
  const g = (sel) => document.querySelector(sel);
  const f = window.__vfxDebugFighters ?? null;
  const scr = window.__vfxDebugScreen ?? null;
  const zoneBar = g('[data-el="zone-bar"]');
  const countdown = g('[data-el="countdown"]');
  const gameover = g('[data-el="gameover"]');
  return {
    f,
    scr,
    radius01: zoneBar ? parseFloat(zoneBar.style.width) / 100 : null,
    countdown: countdown && countdown.style.display !== 'none' ? countdown.textContent : null,
    ended: !!gameover && gameover.style.display === 'flex',
    dmg: document.querySelectorAll('.hud-dmg').length,
    qa: window.__vfxQaCounts ? { ...window.__vfxQaCounts } : null,
    projectiles: (() => {
      try {
        const pool = window.__vfxLayer?.projectilePool;
        if (!pool) return null;
        return pool.size ?? pool.length ?? null;
      } catch { return null; }
    })(),
  };
};

async function shootMatch(browser, PLAYER, ENEMY, tag) {
  const page = await newPage(browser);
  const q = new URLSearchParams({
    pointerLock: '0',
    player: PLAYER,
    enemy: ENEMY,
    px: String(ANCHOR.x),
    py: String(ANCHOR.y),
  });
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await settleScreen(page, { label: 'match', timeout: 60_000 });

  const matchup = await page.evaluate(() => ({
    player: document.querySelector('[data-el="player-name"]')?.textContent ?? '?',
    enemy: document.querySelector('[data-el="enemy-name"]')?.textContent ?? '?',
  }));
  console.log(`   matchup: ${matchup.player} vs ${matchup.enemy}`);

  await page.waitForFunction(() => {
    const c = document.querySelector('[data-el="countdown"]');
    return !c || c.style.display === 'none';
  }, null, { timeout: 120_000 });

  // FAIL FAST, and AFTER the countdown. A frame taken during the countdown has full HP
  // on every bar and a clock that has not moved — `CLAUDE.md` records a wrong-base demo
  // staged inside the countdown, "where nothing moves", as a vacuous control. The same
  // logic applies to a known-good: a HUD checked before the match starts is checked in
  // the one state where the pills cannot be wrong.
  {
    const { res } = await assertHudInFrame(page, { enforce: false });
    console.log('   ── hs_hudguard, before any candidate is kept ──');
    printChecks(res, '   ');
    if (!res.ok) {
      await page.close();
      throw new Error('q1_capture: the shipped route did not produce a complete HUD — every candidate from this run would score zero on interface polish. Refusing to capture.');
    }
  }

  const held = new Set();
  const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  const setKeys = async (mx, my) => {
    const want = new Set();
    if (mx < 0) want.add(KEYS.left);
    if (mx > 0) want.add(KEYS.right);
    if (my < 0) want.add(KEYS.up);
    if (my > 0) want.add(KEYS.down);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k).catch(() => {}); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k).catch(() => {}); held.add(k); }
  };

  const candidates = [];
  const qaHist = [];
  let firing = false;
  let n = 0;
  const t0 = Date.now();
  let firstContactMs = null;

  while (candidates.length < WANT && Date.now() - t0 < Number(args.budgetMs ?? 480_000)) {
    let r;
    try { r = await page.evaluate(READ); } catch { break; }
    if (!r?.f) { await page.waitForTimeout(100); continue; }
    if (r.ended) { console.log('   match ended before the burst was full'); break; }

    const now = Date.now();
    qaHist.push({ t: now, total: qaTotal(r.qa), qa: r.qa });
    while (qaHist.length > 1 && now - qaHist[0].t > VFX_WINDOW) qaHist.shift();
    const vfxDelta = qaTotal(r.qa) - (qaHist[0]?.total ?? qaTotal(r.qa));

    const p = r.f.player;
    const e = r.f.enemy;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (firstContactMs === null && d <= D_MAX) firstContactMs = now - t0;
    const onScreen = (s) => s && s.x > 40 && s.x < W - 40 && s.y > 40 && s.y < H - 40;
    const bothOn = onScreen(r.scr?.player) && onScreen(r.scr?.enemy);

    const dAnchor = Math.hypot(p.x - ANCHOR.x, p.y - ANCHOR.y);
    const toward = (tx, ty) => [
      tx > p.x + 12 ? 1 : tx < p.x - 12 ? -1 : 0,
      ty > p.y + 12 ? 1 : ty < p.y - 12 ? -1 : 0,
    ];
    let mx; let my;
    if (dAnchor > 240) {
      [mx, my] = toward(ANCHOR.x, ANCHOR.y);
    } else if (d < D_MIN + 20) {
      [mx, my] = toward(p.x + (p.x - e.x), p.y + (p.y - e.y));
    } else if (d > D_MAX - 20) {
      [mx, my] = toward(e.x, e.y);
    } else {
      const sx = e.x > p.x ? 1 : -1;
      const sy = e.y > p.y ? 1 : -1;
      mx = -sy; my = sx;
    }
    await setKeys(mx, my);
    if (r.scr?.enemy) {
      await page.mouse.move(
        Math.max(2, Math.min(W - 2, r.scr.enemy.x)),
        Math.max(2, Math.min(H - 2, r.scr.enemy.y)),
      ).catch(() => {});
    }
    if (!firing) { await page.mouse.down().catch(() => {}); firing = true; }

    const eligible = p.alive && e.alive && bothOn && d >= D_MIN && d <= D_MAX && vfxDelta > 0;
    if (eligible) {
      // 🚨 PROBED BEFORE THE SHUTTER, not after. `captureSettled` writes the PNG itself,
      // so a candidate judged afterwards is a refused frame already sitting on disk
      // where a packet builder can pick it up.
      // eslint-disable-next-line no-await-in-loop
      const hudDom = await page.evaluate(hudProbeFn, HUD_SELECTORS);
      const hudRes = judgeHud(hudDom);
      if (!hudRes.ok) {
        console.log('   candidate SKIPPED — hs_hudguard refused the HUD in this frame:');
        printChecks(hudRes, '     ');
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(70);
        continue;
      }
      const name = `match_${tag}_${String(n++).padStart(2, '0')}.png`;
      // eslint-disable-next-line no-await-in-loop
      const res = await captureSettled(page, {
        path: `${OUT}/${name}`, label: `match action ${n}`, tool: 'q1_capture',
        wait: false, enforce: false,
      });
      // Merge the guard's verdict into the sidecar `captureSettled` just wrote. Additive:
      // every existing field is preserved, and `hs_hudguard --verify <dir>` refuses any
      // packet whose frames lack this block.
      try {
        const sc = `${OUT}/${name}.capture.json`;
        const prev = JSON.parse(readFileSync(sc, 'utf8'));
        writeFileSync(sc, JSON.stringify({ ...prev, hud: hudSidecar(hudDom, hudRes) }, null, 2));
      } catch (e) { console.log(`   ⚠️ could not annotate sidecar for ${name}: ${String(e).slice(0, 120)}`); }
      candidates.push({
        hud: hudSidecar(hudDom, hudRes),
        file: name,
        painted: res.painted,
        stats: res.stats,
        d: Math.round(d),
        dAnchor: Math.round(dAnchor),
        dPot: Math.round(Math.hypot(p.x - ARENA.center.x, p.y - ARENA.center.y)),
        dmg: r.dmg,
        vfxDelta,
        projectiles: r.projectiles,
        php: p.hp,
        ehp: e.hp,
        radius01: r.radius01,
        pScreen: r.scr?.player,
        eScreen: r.scr?.enemy,
        qa: r.qa,
      });
      console.log(`   cand ${name}  d=${Math.round(d)}wu  dPot=${Math.round(Math.hypot(p.x - ARENA.center.x, p.y - ARENA.center.y))}wu`
        + `  dmgNums=${r.dmg}  vfxΔ=${vfxDelta}  proj=${r.projectiles ?? '-'}  hp ${p.hp}/${e.hp}  painted=${res.painted}`);
    }
    await page.waitForTimeout(70);
  }

  for (const k of held) await page.keyboard.up(k).catch(() => {});
  if (firing) await page.mouse.up().catch(() => {});
  await page.close();
  return { candidates, matchup, firstContactMs };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report_ = {
    base: BASE,
    viewport: [W, H],
    arena: { width: ARENA.width, height: ARENA.height, center: ARENA.center },
    anchor: ANCHOR,
    anchorK: ANCHOR_K,
    potRadius: POT.radius,
    seedProfile: !!args['seed-profile'],
    matchups: MATCHUPS,
    band: [D_MIN, D_MAX],
    runs: [],
  };

  for (const { player, enemy } of MATCHUPS) {
    console.log(`\n── match, mid-fight: ${player} vs ${enemy} ──`);
    // eslint-disable-next-line no-await-in-loop
    const m = await shootMatch(browser, player, enemy, `${player}_${enemy}`);
    report_.runs.push({ player, enemy, ...m });
  }

  writeFileSync(`${OUT}/capture-report.json`, JSON.stringify(report_, null, 2));
  const total = report_.runs.reduce((s, r) => s + r.candidates.length, 0);
  console.log(`\n${total} action candidates -> ${OUT}`);
  await browser.close();

  // ── THE PACKET MAY NOT BE HUD-LESS, AND THIS IS CHECKED BY DEFAULT ──────────
  // Not "by remembering". The per-candidate guard above already refused anything
  // interface-less, so this is the belt to that brace — it also catches a directory that
  // picked up frames from an older, unguarded run of this same tool.
  // ⚠️ `verifyPacket` asserts the directory is NON-EMPTY first: `[].every()` is `true`,
  // so a run that produced zero candidates would otherwise "pass" its own audit.
  const { verifyPacket } = await import('./hs_hudguard.mjs');
  const pngs = readdirSync(OUT).filter((f) => f.endsWith('.png')).sort().map((f) => {
    const sc = join(OUT, `${f}.capture.json`);
    let sidecar = null;
    try { sidecar = JSON.parse(readFileSync(sc, 'utf8')); } catch { sidecar = null; }
    return { file: f, sidecar };
  });
  const v = verifyPacket(pngs);
  console.log('\n── hs_hudguard --verify (packet audit) ──');
  const bad = printChecks(v, '  ');
  if (bad) {
    console.error(`\n🔴 ${OUT} CONTAINS ${bad} FRAME(S) THAT NOTHING CHECKED FOR A HUD. Do not build a critic packet from it.`);
    process.exitCode = 3;
  } else {
    console.log(`\n✅ every frame in ${OUT} carries a HUD the guard accepted`);
  }
}

await main().catch((e) => { console.error(e); process.exitCode = 1; });
