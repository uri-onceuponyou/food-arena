#!/usr/bin/env node
/**
 * SX_SIXPLAY — PLAY A WHOLE SIX-FIGHTER MATCH THROUGH THE REAL RENDERER.
 *
 * ## Why this exists
 *
 * In one night this project gained a 2800×2000 arena with six spawns (`6631446`), a ring
 * that scales with fighter count (`4bb64e4`), sudden death (`f87d407`), a 3–6 seat payout
 * curve (`721ce3c`), XP and league payouts through it (`a588066`) and a fog boundary that
 * no longer vanishes at radius 0 (`779dc62`). **Every one was verified in isolation and
 * nothing had ever played them together.** `tools/match-play.mjs` is the project's
 * "play the whole thing on screen" tool and it is hard 1v1 — `--player`/`--enemy` — so no
 * six-fighter match had been played end to end through the renderer at all.
 *
 * This is the closest thing to a player this repo can run. The two most valuable bug
 * reports this project has ever had (*"there are regions in the map that are unreachable"*
 * and *"i can't hide under concealments"*) both came from a human simply playing it, and
 * both were invisible to `tsc`, to every assertion and to every screenshot.
 *
 * ## What it drives
 *
 * `?fighters=<id>;<id>;…` — `match.ts:fightersFromQuery`, the QA transport that seats 3..6.
 * **Deliberately with NO coordinates**, so `sim.ts:defaultSpawn` resolves every slot through
 * `ArenaDefinition.spawns` — the six authored spawns in `kitchen.ts`. That is the shipping
 * path, and a probe that carried its own ring (as `np_nfighter.mjs` does, at a hard-coded
 * `CENTER {700,500}` from the 1× map) would be measuring its own fixture instead.
 *
 * Slot 0 is the LOCAL HUMAN SEAT (`sim.ts`: `controller: seatIsLocal ? 'human' : 'ai'`), so
 * it is driven here with WASD + mouse aim + fire. Slots 1–5 are the shipped bot policy.
 *
 * ## 🚨 THE CONTROLS — every arm exists to make a specific row go RED
 *
 * `docs/AGENT-BRIEF.md` §4.4, and three fresh failures from 2026-08-11 in exactly this
 * territory: a control placed where the bug could not express itself; three known-bads that
 * each certified the check they were meant to falsify; a suite reporting 227 passed through
 * a rewrite it could not see. **Ask of every control: could this scenario distinguish the
 * two arms at all?**
 *
 *   `--arm base`    the real thing.
 *   `--arm idle`    slot 0 is given NO input. The per-slot motion row must go RED for slot 0
 *                   and STAY GREEN for 1–5 — which is the only thing that proves the motion
 *                   row reads six independent slots rather than broadcasting slot 0's.
 *   `--arm swap`    slots 1 and 2 exchange characters. The per-slot HUD identity read must
 *                   MOVE, or every "the HUD is coherent at six seats" row below is satisfied
 *                   by a HUD that ignores the slot index entirely (`np_nfighter`'s §5).
 *   `--arm two`     N=2 on the identical code path. ⚠️ NOT a decorative control: at two seats
 *                   the top bar must have NO `.hud-chips` rail at all, so it is the arm that
 *                   proves the chip count row is counting something real.
 *   `--arm survive` slot 0 walks to the arena centre and never fires. Not a "policy" — it is the
 *                   only reliable way to get a LIVING local seat to the 30 s trigger, and the
 *                   HUD's sudden-death state is only reachable from one: `renderZone` gates the
 *                   danger branch on `localFighter(state).alive`, so a run whose local seat died
 *                   at 28 s photographs the calm pill and says nothing about the alarm.
 *
 * ## What is NOT claimed
 *
 * ⚠️ **FRAME RATE IS NOT MEASURED AND CANNOT BE HERE.** SwiftShader is a CPU rasteriser.
 * Draw calls are exact and are measured by `tools/perf.mjs`; everything in this file is
 * timestamped on the SIM clock, read out of the game's own zone bar.
 *
 * ⚠️ **`match.ts:loop` does NOT sub-step** — one `stepMatch(state, min(realDt,1/20)*simSpeed)`
 * per frame — so a slow renderer runs the sim at dt≈50 ms. That is the shipped behaviour, not
 * something this tool introduces, but it means these runs are not tick-comparable with
 * `sx_census.mjs`'s dt=16.667. The effective dt is measured and printed.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/sx_sixplay.mjs --url '{URL}' --out shots/sx/run1 --arm base
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/sx/run`));
const ARM = String(arg('--arm', 'base'));
const SPEED = Number(arg('--speed', 1));
const MAX_WALL_MS = Number(arg('--wall', 900_000));
const W = Number(arg('--w', 1280));
const H = Number(arg('--h', 720));
const SHOTS = !has('--no-shots');

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/** The cast, in slot order. Six DIFFERENT characters: six of one measures the sim, not the
 *  game, and the HUD identity rows below need six distinguishable portraits. */
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];

function rosterFor(arm) {
  if (arm === 'two') return CAST.slice(0, 2);
  const ids = CAST.slice();
  if (arm === 'swap') { const t = ids[1]; ids[1] = ids[2]; ids[2] = t; }
  return ids;
}

// ── The page-side reader. ONE `page.evaluate` per sample. ────────────────────
// ⚠️ `page.evaluate()` grants transient user activation (AGENT-BRIEF §3), so a probe that
// evaluates freely is handing the app gestures it never received. Nothing here measures a
// gesture-gated behaviour, but the one-call-per-sample shape is kept anyway.
const READ = () => {
  const g = (s) => document.querySelector(s);
  const zoneBar = g('[data-el="zone-bar"]');
  const zone = g('[data-el="zone"]');
  const countdown = g('[data-el="countdown"]');
  const gameover = g('[data-el="gameover"]');
  const f = window.__vfxDebugFighters ?? null;
  const scr = window.__vfxDebugScreen ?? null;
  const n = f?.slots?.length ?? 0;
  const key = (i) => (i === 0 ? 'player' : i === 1 ? 'enemy' : `slot${i}`);
  // Per-slot HUD identity, read from the DOM the HUD actually built. Above two seats the
  // name and numeric HP are `display:none` at chip size (hud.ts), so these are assertions
  // about the HUD's WIRING — which is exactly the defect class they exist for: a pooled HUD
  // that writes every fighter into slot 1.
  const hudSlots = Array.from({ length: n }, (_, i) => {
    const k = key(i);
    const bar = g(`[data-el="${k}-bar"]`);
    return {
      name: g(`[data-el="${k}-name"]`)?.textContent ?? null,
      emoji: g(`[data-el="${k}-emoji"]`)?.innerHTML?.slice(0, 120) ?? null,
      hpText: g(`[data-el="${k}-hp"]`)?.textContent ?? null,
      fillW: g(`[data-el="${k}-fill"]`)?.style.width ?? null,
      barPresent: !!bar,
      floatShown: (() => { const el = g(`[data-el="float-${k}"]`); return el ? getComputedStyle(el).display !== 'none' && el.style.display !== 'none' : null; })(),
      blipShown: (() => { const el = g(`[data-el="radar-${k}"]`); return el ? getComputedStyle(el).display !== 'none' : null; })(),
    };
  });
  const topbar = g('[data-el="topbar"]');
  const chips = g('[data-el="chips"]');
  const tb = topbar?.getBoundingClientRect();
  return {
    n,
    slots: f?.slots ?? null,
    screen: scr?.slots ?? null,
    timer: g('[data-el="timer"]')?.textContent ?? null,
    zoneLabel: g('[data-el="zone-label"]')?.textContent ?? null,
    zoneValue: g('[data-el="zone-value"]')?.textContent ?? null,
    zoneDanger: !!zone?.classList.contains('is-danger'),
    zoneImminent: !!zone?.classList.contains('is-imminent'),
    radius01: zoneBar ? parseFloat(zoneBar.style.width) / 100 : null,
    fogEdgeOn: !!g('[data-el="fogedge"]')?.classList.contains('is-on'),
    countdown: countdown && countdown.style.display !== 'none' ? countdown.textContent : null,
    ended: !!gameover && gameover.style.display === 'flex',
    resultTitle: g('[data-el="gameover-title"]')?.textContent ?? null,
    resultSub: g('[data-el="gameover-subtitle"]')?.textContent ?? null,
    resultStats: g('[data-el="gameover-stats"]')?.textContent ?? null,
    hudSlots,
    chipCount: chips ? chips.querySelectorAll('.hud-fighter').length : 0,
    chipRail: !!chips,
    topbarChipsClass: !!topbar?.classList.contains('hud-topbar--chips'),
    topbarH: tb ? Math.round(tb.height) : null,
    phase: window.__matchDebug?.phase ?? null,
    winnerRole: window.__matchDebug?.winner ?? null,
    frames: window.__feelDebug?.frames ?? null,
    rawDtMs: window.__feelDebug?.rawDtMs ?? null,
    // Draw calls for THIS frame. `autoReset` is left alone: with no composer at `low`/`high`
    // there is one `renderer.render()` per frame plus the shadow pass, so `info.render.calls`
    // read here is the last full frame's total. Reported as a cross-check on `perf.mjs`,
    // never as a substitute for it.
    draws: (() => { try { const s = (window.__stages || []).filter((x) => !x.disposed)[0]; return s ? s.renderer.info.render.calls : null; } catch { return null; } })(),
    tris: (() => { try { const s = (window.__stages || []).filter((x) => !x.disposed)[0]; return s ? s.renderer.info.render.triangles : null; } catch { return null; } })(),
  };
};

async function run() {
  mkdirSync(OUT, { recursive: true });
  const ids = rosterFor(ARM);
  const n = ids.length;
  const browser = await chromium.launch({ args: LAUNCH });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [], reqFails = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) reqFails.push(`${r.status()} ${r.url()}`); });
  // HMR client stubbed: a peer's save must not be able to reload the page mid-run. (The
  // snapshot already freezes the tree; this closes the socket as well.)
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
  }));

  const url = `${BASE}/?fighters=${encodeURIComponent(ids.join(';'))}&pointerLock=0&simSpeed=${SPEED}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });

  // Constants and the live arena, imported from the build under test rather than typed in.
  // `tools/match-play.mjs` hardcodes `ARENA = {w:1400,h:1000,cx:700,cy:500,maxR:890}` and a
  // 180 s clock; both are two map generations stale, which is exactly what this avoids.
  const K = await page.evaluate(async () => {
    const r = await import('/src/game/rules.ts');
    const a = window.__matchArena;
    return {
      MATCH_DURATION_MS: r.MATCH_DURATION_MS,
      SUDDEN_DEATH_REMAINING_MS: r.SUDDEN_DEATH_REMAINING_MS,
      MIN_SAFE_RADIUS: r.MIN_SAFE_RADIUS,
      ringFloor: r.minSafeRadiusFor ? r.minSafeRadiusFor(window.__vfxDebugFighters.slots.length) : null,
      FOG_DAMAGE: r.FOG_DAMAGE,
      REACH: r.REACH,
      arena: a ? { w: a.width, h: a.height, cx: a.center.x, cy: a.center.y, maxR: a.maxSafeRadius, spawns: a.spawns } : null,
    };
  });

  const shots = [];
  const shoot = async (tag) => {
    if (!SHOTS) return;
    const p = `${OUT}/${String(shots.length).padStart(2, '0')}_${tag}.png`;
    await page.screenshot({ path: p }).catch(() => {});
    shots.push(p);
    return p;
  };

  await shoot('countdown');

  // ── the loop ──────────────────────────────────────────────────────────────
  const samples = [];
  const held = new Set();
  let firing = false, ended = false;
  let spawnRead = null, sdShot = false, preSdShot = false, firstFightShot = false;
  let lastHp = null;
  const KEYMAP = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' };
  const setKeys = async (mx, my) => {
    const want = new Set();
    if (mx < -0.2) want.add(KEYMAP.left);
    if (mx > 0.2) want.add(KEYMAP.right);
    if (my < -0.2) want.add(KEYMAP.up);
    if (my > 0.2) want.add(KEYMAP.down);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k).catch(() => {}); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k).catch(() => {}); held.add(k); }
  };

  while (Date.now() - t0 < MAX_WALL_MS && !ended) {
    let r;
    try { r = await page.evaluate(READ); } catch { break; }
    if (!r.slots) { await page.waitForTimeout(120); continue; }

    // The sim clock, inverted out of the game's own zone bar: while the ring is above its
    // floor `safeRadius = maxR * (1 - elapsed/T)`, so the bar IS the clock at 0.1%
    // resolution (~2 wu, ~0.045 s) — finer than the m:ss readout and available every frame.
    // ⚠️ It saturates at 0 once sudden death collapses the ring, which is precisely the
    // event being detected, so `sdAt` is latched on the FIRST zero rather than derived.
    const simT = r.radius01 !== null && !Number.isNaN(r.radius01)
      ? (K.MATCH_DURATION_MS / 1000) * (1 - r.radius01) : null;
    const inFight = r.countdown === null && !r.ended;

    if (spawnRead === null && r.slots.length === n) {
      spawnRead = r.slots.map((s) => ({ x: s.x, y: s.y, hp: s.hp }));
    }
    if (inFight && !firstFightShot) { firstFightShot = true; await shoot('fight_start'); }

    const onScreen = (r.screen ?? []).filter((p) => p && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H).length;
    samples.push({
      wall: Date.now() - t0, simT, phase: r.phase,
      radius01: r.radius01, timer: r.timer,
      zoneLabel: r.zoneLabel, zoneValue: r.zoneValue, zoneDanger: r.zoneDanger, zoneImminent: r.zoneImminent,
      hp: r.slots.map((s) => s.hp), alive: r.slots.map((s) => !!s.alive),
      pos: r.slots.map((s) => [Math.round(s.x), Math.round(s.y)]),
      onScreen, draws: r.draws, tris: r.tris,
      // ⚠️ `floats`/`screenPt` are the DIRECT reading of the pinned-pill defect. The first
      // version of this file inferred it as `aliveCount - onScreen`, which is an inference and
      // not a measurement: it cannot tell a pill that was hidden from one that was clamped to
      // the frame edge, and those are the two hypotheses.
      floats: r.hudSlots.map((h) => h.floatShown),
      screenPt: (r.screen ?? []).map((p) => (p ? [Math.round(p.x), Math.round(p.y)] : null)),
      chipCount: r.chipCount, chipRail: r.chipRail, topbarH: r.topbarH,
      hudHp: r.hudSlots.map((h) => h.hpText), hudName: r.hudSlots.map((h) => h.name),
      hudFill: r.hudSlots.map((h) => h.fillW),
      rawDtMs: r.rawDtMs, frames: r.frames,
    });

    // Just BEFORE the collapse — the frame the sudden-death comparison is made against.
    if (!preSdShot && simT !== null && simT >= (K.MATCH_DURATION_MS - K.SUDDEN_DEATH_REMAINING_MS) / 1000 - 1.6 && r.radius01 > 0.02) {
      preSdShot = true; await shoot('pre_sudden_death');
    }
    if (!sdShot && r.radius01 !== null && r.radius01 <= 0.001) {
      sdShot = true; await shoot('sudden_death');
    }
    lastHp = r.slots.map((s) => s.hp);

    if (r.ended) {
      ended = true;
      await page.waitForTimeout(1200);
      await shoot('result');
      samples.push({ wall: Date.now() - t0, simT, phase: 'ended', result: r.resultTitle, sub: r.resultSub, stats: r.resultStats, hp: lastHp, alive: r.slots.map((s) => !!s.alive) });
      break;
    }

    // ── drive slot 0 ───────────────────────────────────────────────────────
    if (inFight && ARM !== 'idle') {
      const me = r.slots[0];
      if (me && me.alive) {
        let best = null, bd = Infinity;
        for (let i = 1; i < r.slots.length; i++) {
          const o = r.slots[i];
          if (!o?.alive) continue;
          const d = Math.hypot(o.x - me.x, o.y - me.y);
          if (d < bd) { bd = d; best = i; }
        }
        // Toward the nearest living opponent, but toward the arena centre once the ring is
        // closing on us — a policy that only ever chased would spend the endgame in the fog
        // and the run would measure the driver, not the game.
        const cx = K.arena?.cx ?? 1400, cy = K.arena?.cy ?? 1000;
        const distC = Math.hypot(me.x - cx, me.y - cy);
        const R = (r.radius01 ?? 1) * (K.arena?.maxR ?? 1985);
        let tx, ty;
        // `survive` heads for the middle and stops just outside the pot's burn ring; every
        // other arm chases the nearest opponent unless the closing ring says otherwise.
        if (ARM === 'survive') {
          const stand = 220;                       // clear of POT.dangerRadius (95) with margin
          tx = distC < stand ? me.x + (me.x - cx) : cx;
          ty = distC < stand ? me.y + (me.y - cy) : cy;
        } else if (distC > R * 0.8 || best === null) { tx = cx; ty = cy; }
        else { tx = r.slots[best].x; ty = r.slots[best].y; }
        const dx = tx - me.x, dy = ty - me.y, m = Math.hypot(dx, dy) || 1;
        await setKeys(dx / m, dy / m);
        const sp = best !== null ? r.screen?.[best] : null;
        if (sp) await page.mouse.move(Math.max(2, Math.min(W - 2, sp.x)), Math.max(2, Math.min(H - 2, sp.y))).catch(() => {});
        const wantFire = ARM !== 'survive' && best !== null && bd < 260;
        if (wantFire && !firing) { await page.mouse.down().catch(() => {}); firing = true; }
        else if (!wantFire && firing) { await page.mouse.up().catch(() => {}); firing = false; }
      }
    }
    await page.waitForTimeout(70);
  }
  for (const k of held) await page.keyboard.up(k).catch(() => {});
  if (firing) await page.mouse.up().catch(() => {});
  if (!ended) await shoot('gave_up');

  // ── derive ────────────────────────────────────────────────────────────────
  const fight = samples.filter((s) => s.simT !== null && s.phase === 'playing');
  const pathLen = Array.from({ length: n }, () => 0);
  for (let i = 1; i < fight.length; i++) {
    for (let k = 0; k < n; k++) {
      const a = fight[i - 1].pos?.[k], b = fight[i].pos?.[k];
      if (a && b) pathLen[k] += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }
  const hpDropped = Array.from({ length: n }, (_, k) => {
    let d = 0;
    for (let i = 1; i < fight.length; i++) {
      const a = fight[i - 1].hp?.[k], b = fight[i].hp?.[k];
      if (a !== undefined && b !== undefined && b < a) d += a - b;
    }
    return d;
  });
  const dtEff = fight.length > 1 ? fight.filter((s) => s.rawDtMs).map((s) => s.rawDtMs) : [];
  const onScreenHist = {};
  for (const s of fight) onScreenHist[s.onScreen] = (onScreenHist[s.onScreen] ?? 0) + 1;
  const drawsBy = {};
  for (const s of fight) if (s.draws) (drawsBy[s.onScreen] ??= []).push(s.draws);

  let minSep = Infinity, minPair = null;
  if (spawnRead) {
    for (let a = 0; a < spawnRead.length; a++) for (let b = a + 1; b < spawnRead.length; b++) {
      const d = Math.hypot(spawnRead[a].x - spawnRead[b].x, spawnRead[a].y - spawnRead[b].y);
      if (d < minSep) { minSep = d; minPair = [a, b]; }
    }
  }
  const last = samples[samples.length - 1];
  const summary = {
    base: BASE, arm: ARM, roster: ids, n, speed: SPEED, viewport: [W, H],
    wallMs: Date.now() - t0, samples: samples.length, fightSamples: fight.length,
    constants: K,
    spawnRead, minSep, minPair,
    pathLen, hpDropped,
    ended, result: last?.result ?? null, resultSub: last?.sub ?? null, resultStats: last?.stats ?? null,
    finalHp: last?.hp ?? null, finalAlive: last?.alive ?? null,
    sdSeen: samples.some((s) => s.radius01 !== null && s.radius01 <= 0.001),
    sdAtSimT: samples.find((s) => s.radius01 !== null && s.radius01 <= 0.001)?.simT ?? null,
    lastPreSd: [...samples].reverse().find((s) => s.radius01 > 0.001 && s.phase === 'playing') ?? null,
    dtEffMeanMs: dtEff.length ? dtEff.reduce((a, b) => a + b, 0) / dtEff.length : null,
    onScreenHist,
    drawsByOnScreen: Object.fromEntries(Object.entries(drawsBy).map(([k, v]) => [k, {
      n: v.length, min: Math.min(...v), median: v.slice().sort((a, b) => a - b)[v.length >> 1], max: Math.max(...v),
    }])),
    chipCount: fight[0]?.chipCount ?? null, chipRail: fight[0]?.chipRail ?? null,
    topbarH: fight[0]?.topbarH ?? null,
    hudNameAtStart: fight[0]?.hudName ?? null,
    errors: errors.slice(0, 20), reqFails: reqFails.slice(0, 20),
    shots,
  };
  writeFileSync(`${OUT}/telemetry.json`, JSON.stringify({ summary, samples }, null, 1));
  await browser.close();
  return summary;
}

if (IS_MAIN) {
  const s = await run();
  const pad = (v, w = 7) => String(v).padStart(w);
  console.log(`\nSX_SIXPLAY  arm=${s.arm}  n=${s.n}  ${s.roster.join(',')}  speed=${s.speed}`);
  console.log(`wall ${(s.wallMs / 1000).toFixed(1)} s · ${s.samples} samples (${s.fightSamples} in fight) · effective sim dt ${s.dtEffMeanMs?.toFixed(1) ?? '?'} ms`);
  console.log(`arena ${s.constants.arena?.w}×${s.constants.arena?.h} maxR ${s.constants.arena?.maxR} ringFloor ${s.constants.ringFloor?.toFixed(2)}`);
  console.log(`\nSPAWNS read back from the live sim (no coordinates were supplied):`);
  (s.spawnRead ?? []).forEach((p, i) => console.log(`   slot${i} ${pad(Math.round(p.x))},${pad(Math.round(p.y))}  hp ${p.hp}`));
  console.log(`   min pairwise separation ${s.minSep?.toFixed(1)} wu  (slots ${s.minPair})`);
  console.log(`\nPER-SLOT over the fight:`);
  console.log(`   slot        ${Array.from({ length: s.n }, (_, i) => pad(i)).join('')}`);
  console.log(`   path wu     ${s.pathLen.map((v) => pad(Math.round(v))).join('')}`);
  console.log(`   hp lost     ${s.hpDropped.map((v) => pad(v)).join('')}`);
  console.log(`   final hp    ${(s.finalHp ?? []).map((v) => pad(v)).join('')}`);
  console.log(`   alive       ${(s.finalAlive ?? []).map((v) => pad(v ? 'Y' : '.')).join('')}`);
  console.log(`\nHUD: chip rail ${s.chipRail} · chips ${s.chipCount} · topbar ${s.topbarH}px · names ${JSON.stringify(s.hudNameAtStart)}`);
  console.log(`SUDDEN DEATH: seen ${s.sdSeen} at simT ${s.sdAtSimT?.toFixed(2) ?? '—'} s`);
  if (s.lastPreSd) console.log(`   last pre-collapse sample: t ${s.lastPreSd.simT?.toFixed(2)} s  hp ${JSON.stringify(s.lastPreSd.hp)} alive ${JSON.stringify(s.lastPreSd.alive)}`);
  console.log(`RESULT: ${s.ended ? `${s.result} / ${s.resultSub} / ${s.resultStats}` : 'DID NOT END (wall cap)'}`);
  console.log(`\nFIGHTERS ON SCREEN (camera follows slot 0, FAIR_PLAY radius 199.2 wu):`);
  for (const [k, v] of Object.entries(s.onScreenHist).sort((a, b) => a[0] - b[0])) {
    const d = s.drawsByOnScreen[k];
    console.log(`   ${k} on screen: ${pad(v)} samples  draws ${d ? `${d.min}..${d.max} (median ${d.median})` : '—'}`);
  }
  if (s.errors.length) console.log(`\nPAGE ERRORS (${s.errors.length}):\n   ${s.errors.join('\n   ')}`);
  if (s.reqFails.length) console.log(`\nFAILED REQUESTS (${s.reqFails.length}):\n   ${s.reqFails.join('\n   ')}`);
  console.log(`\nshots -> ${OUT}`);
}
