#!/usr/bin/env node
/**
 * MATCH DRIVER — part 2 of 2: play the whole thing, on screen.
 *
 * Boots the real game at its real entry point and plays a COMPLETE match with hands
 * on the controls — home → character select → countdown → combat → the closing fog →
 * a decision → the result card — sampling densely enough to judge pacing and
 * legibility OVER TIME rather than at one frozen instant.
 *
 * The companion `tools/match-sim.mjs` answers everything that is a number (length,
 * dead time, AI stalls, fog schedule) by driving the pure sim in Node at ~4 ms a
 * match. This one exists for what only pixels can answer: can you find yourself, is
 * the fog edge readable before it costs HP, does the HUD tell you what just happened,
 * does a 90-second Rice Spray become fatiguing.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 *   1. Navigates the real screen shell (or `--direct` straight into a match).
 *   2. Drives WASD + mouse aim + fire from a policy identical in shape to
 *      `match-sim.mjs`'s, reading `window.__vfxDebugFighters` /
 *      `window.__vfxDebugScreen` for positions and the HUD's own DOM for everything
 *      the player is actually shown.
 *   3. Samples ~5x/second: HP, positions, the clock, the zone bar, the zone warning
 *      state, weapon readiness, VFX spawn counts.
 *   4. Screenshots on a SIM-CLOCK schedule plus on events (first blood, first fog
 *      tick, death, result), so the strip is comparable between runs even though
 *      wall-clock frame rate is not.
 *   5. Writes `telemetry.json` + numbered frames + a contact sheet.
 *
 * ── Measurement limits, stated up front ─────────────────────────────────────
 *   * FRAME TIME AND FPS ARE NOT MEASURED AND CANNOT BE. SwiftShader is a CPU
 *     rasteriser; this project measures ~9-10 fps under it and that number means
 *     nothing. Everything here is timestamped in SIM time, read out of the game's own
 *     clock, which is exactly the axis pacing lives on.
 *   * Because a rendered frame can consume up to 50 ms of sim time (`match.ts` clamps
 *     dt at 1/20 s), a sub-300 ms effect can fall between two samples. This tool
 *     reports what it SAW; for "what does this effect look like at t=40ms" use the
 *     virtual-clock technique in `tools/tmp/lolliv.mjs` instead.
 *   * The scripted player has perfect information and perfect aim. It is a
 *     consistent, repeatable pair of hands — not a skill benchmark.
 *
 * ── Use ─────────────────────────────────────────────────────────────────────
 *   URL=$(node tools/snapshot.mjs --json | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])")
 *   node tools/match-play.mjs --url $URL --out shots/match/run1
 *   node tools/match-play.mjs --url $URL --direct --player sushi --enemy sushi --out shots/match/sushi
 *   node tools/match-play.mjs --url $URL --direct --policy idle --out shots/match/stall
 *   node tools/match-play.mjs --url $URL --fogRadius 120 --out shots/match/endgame  # jump to the squeeze
 *
 * `--enemy` ONLY applies with `--direct`. On the full menu route the opponent is
 * chosen by `ui/screens/characterSelect.ts:pickOpponent`, which is `Math.random()` —
 * so the matchup is not reproducible through the menus. The driver reads the actual
 * opponent back off the HUD and reports it, rather than letting you believe the flag
 * was honoured.
 *
 * ALWAYS point `--url` at a `tools/snapshot.mjs` server, never `:5173` — seven agents
 * save into the shared tree and a mid-run reload invalidates the whole strip.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { settleScreen, captureSettled, describe } from './tmp/settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

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
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = String(args.out ?? 'shots/match/run');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const PLAYER = String(args.player ?? 'hamburger');
const ENEMY = String(args.enemy ?? 'donut');
const POLICY = String(args.policy ?? 'smart');
const DIRECT = !!args.direct;
const MAX_WALL_MS = Number(args.maxWall ?? 900_000);
/** Sim-clock marks (seconds since the fight started) to capture a frame at. */
const SHOT_MARKS = String(args.marks ?? '0,1,2,3,5,8,12,18,25,35,50,70,95,120,150,175')
  .split(',').map(Number);

if (BASE.includes(':5173')) {
  console.error('\n!! --url points at the SHARED dev server. Use tools/snapshot.mjs.\n' +
    '   Peers saving mid-run will invalidate this whole strip.\n');
}

const ARENA = { w: 1400, h: 1000, cx: 700, cy: 500, maxR: 890 };

// ─────────────────────────────────────────────────────────────────────────────
// the hands
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };

/** Decide WASD from a world-unit target. Mirrors `match-sim.mjs`'s `axesToward`. */
function axesToward(px, py, tx, ty) {
  const dx = tx - px, dy = ty - py;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
  return { x: q(dx / m), y: q(dy / m) };
}

function makePolicy(kind, weapons) {
  // Reach of the highest-damage weapon — the distance a player actually fights at.
  const usable = weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= 140);
  const band = (usable.length
    ? usable.reduce((b, w) => ((w.damage ?? 0) > (b.damage ?? 0) ? w : b)).range ?? 100
    : 100) * 0.85;

  const hist = [];
  let detourUntil = -1, detourSign = 1;

  return (s) => {
    if (kind === 'idle') return { move: { x: 0, y: 0 }, fire: false };
    const { p, e, t, R } = s;
    const d = Math.hypot(p.x - e.x, p.y - e.y);

    // Stuck detector — NET displacement over 1.5 s, not per-tick movement. A fighter
    // pinned on a corner still jitters; a per-tick test reads that as walking.
    hist.push({ t, x: p.x, y: p.y });
    while (hist.length && t - hist[0].t > 1500) hist.shift();
    if (t > detourUntil && hist.length > 3 && t - hist[0].t > 1200
      && Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 45) {
      detourSign = -detourSign; detourUntil = t + 900; hist.length = 0;
    }

    const dc = Math.hypot(p.x - ARENA.cx, p.y - ARENA.cy);
    let target;
    if (dc > R - 30) {
      target = { x: ARENA.cx, y: ARENA.cy };            // the ring beats everything
    } else if (kind === 'chase' || d > band) {
      target = { x: e.x, y: e.y };
    } else if (d < band * 0.5) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      target = { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 };
    } else {
      const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
      target = { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 };
    }

    if (t < detourUntil) {
      const a = Math.atan2(target.y - p.y, target.x - p.x) + detourSign * (Math.PI / 2);
      target = { x: p.x + Math.cos(a) * 150, y: p.y + Math.sin(a) * 150 };
    }
    return { move: axesToward(p.x, p.y, target.x, target.y), fire: d <= band * 1.3 };
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(120_000);

  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(String(e)); console.log('PAGEERROR:', String(e).slice(0, 300)); });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE error:', m.text().slice(0, 300)); });

  // Another agent's save triggers a Vite full reload, which wipes in-page state
  // mid-run. Stubbing the HMR client is mandatory for anything that holds state
  // across steps (PROGRESS.md: one agent lost three sweeps to exactly this).
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));

  const frames = [];
  let shotN = 0;
  /**
   * Every frame through the guard.
   *
   * This tool drives menus into a match, and the three menu frames below are captured
   * straight off `__screenReady` — the flag that flips in the same tick the curtain
   * drops, 0.26 s before `fa-screen-in` ends. `settleScreen` is the condition; the
   * existing `waitForTimeout`s stay as floors for timed content. `enforce: false`
   * because this tool's job is to REPORT what a real match looked like and a refused
   * capture mid-match would throw away the run; an unsettled frame is printed instead,
   * and the `.capture.json` sidecar records it either way so `tools/review.mjs` can
   * refuse to build a critic packet out of one.
   */
  const shoot = async (label) => {
    const name = `f${String(shotN++).padStart(2, '0')}_${label}.png`;
    const pre = await settleScreen(page, { label, soft: true, timeout: 15_000 });
    if (!pre?.ok) console.log(`  ! ${name} captured UNSETTLED — ${describe(pre)}`);
    await captureSettled(page, {
      path: `${OUT}/${name}`, label, tool: 'match-play', wait: false, enforce: false,
    });
    frames.push(name);
    return name;
  };

  const timeline = [];
  const t0 = Date.now();

  // ── boot ──────────────────────────────────────────────────────────────────
  // `?pointerLock=0` is the documented QA hatch (`game/pointerLock.ts`): Playwright's
  // Chromium refuses `requestPointerLock()` unconditionally, and with capture enabled
  // the chip would sit in every frame. Real players never have this parameter.
  const q = new URLSearchParams({ pointerLock: '0' });
  if (args.fogRadius) q.set('fogRadius', String(args.fogRadius));
  if (args.px) q.set('px', String(args.px));
  if (args.py) q.set('py', String(args.py));

  if (DIRECT || args.fogRadius) {
    q.set('player', PLAYER); q.set('enemy', ENEMY);
    await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
  } else {
    await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
    await page.waitForFunction('window.__screen === "home" && window.__screenReady === true');
    await shoot('menu_home');
    timeline.push({ wall: Date.now() - t0, step: 'home' });

    await page.click('[data-el="start"]', { force: true });
    await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true');
    await page.waitForTimeout(1200);
    await shoot('menu_select');
    timeline.push({ wall: Date.now() - t0, step: 'character select' });

    await page.click(`.chars-card[data-char="${PLAYER}"]`).catch(() => {});
    await page.waitForTimeout(600);
    await shoot('menu_selected');
    await page.click('[data-el="fight"]', { force: true });
    await page.waitForFunction('window.__screen === "match"');
  }

  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });

  // The menu route picks the opponent at RANDOM (`characterSelect.ts:pickOpponent`),
  // so the only trustworthy source for who is actually fighting is the HUD itself.
  const actual = await page.evaluate(() => ({
    player: document.querySelector('[data-el="player-name"]')?.textContent ?? '?',
    enemy: document.querySelector('[data-el="enemy-name"]')?.textContent ?? '?',
  }));
  timeline.push({ wall: Date.now() - t0, step: `game ready — ACTUAL matchup: ${actual.player} vs ${actual.enemy}` });
  if (!DIRECT && actual.enemy.toLowerCase().replace(/\s/g, '') !== ENEMY.toLowerCase()) {
    console.log(`   note: --enemy=${ENEMY} was IGNORED (menu route randomises the opponent). Actual: ${actual.enemy}.`);
  }

  // ── the reader ────────────────────────────────────────────────────────────
  // Positions come from the sim's own debug mirror; EVERYTHING ELSE is read off the
  // HUD, deliberately — the question is what the player is SHOWN, so the readouts
  // are the honest source and a HUD that stops updating shows up as a flat trace.
  const READ = () => {
    const g = (sel) => document.querySelector(sel);
    const f = window.__vfxDebugFighters ?? null;
    const scr = window.__vfxDebugScreen ?? null;
    const zoneBar = g('[data-el="zone-bar"]');
    const zone = g('[data-el="zone"]');
    const countdown = g('[data-el="countdown"]');
    const gameover = g('[data-el="gameover"]');
    const radius01 = zoneBar ? parseFloat(zoneBar.style.width) / 100 : null;
    const slots = [...document.querySelectorAll('.hud-weapon')].map((s) => ({
      ready: s.classList.contains('is-ready'),
      sel: s.classList.contains('is-selected'),
      timer: s.querySelector('[data-role="timer"]')?.textContent ?? '',
    }));
    return {
      f, scr,
      timer: g('[data-el="timer"]')?.textContent ?? null,
      zoneLabel: g('[data-el="zone-label"]')?.textContent ?? null,
      zoneValue: g('[data-el="zone-value"]')?.textContent ?? null,
      zoneDanger: !!zone?.classList.contains('is-danger'),
      zoneImminent: !!zone?.classList.contains('is-imminent'),
      fogEdgeOn: !!g('[data-el="fogedge"]')?.classList.contains('is-on'),
      arrowShown: g('[data-el="safearrow"]')?.style.display === 'block',
      radius01,
      countdown: countdown && countdown.style.display !== 'none' ? countdown.textContent : null,
      ended: !!gameover && gameover.style.display === 'flex',
      result: g('[data-el="gameover-title"]')?.textContent ?? null,
      dmgNumbers: document.querySelectorAll('.hud-dmg').length,
      slots,
      qa: window.__vfxQaCounts ? { ...window.__vfxQaCounts } : null,
      playerLowHp: !!g('[data-el="player-bar"]')?.classList.contains('is-low'),
    };
  };

  const weapons = await page.evaluate(async () => {
    const m = await import('/src/game/rules.ts');
    const id = new URLSearchParams(location.search).get('player');
    return m.CHARACTERS[id ?? 'hamburger'].weapons.map((w) => ({
      key: w.key, name: w.name, type: w.type, range: w.range ?? null,
      damage: w.damage, cooldown: w.cooldown, pellets: w.pellets ?? 1,
    }));
  }).catch(() => []);

  const decide = makePolicy(POLICY, weapons.length ? weapons : [{ type: 'ranged', range: 120, damage: 10 }]);

  // ── the loop ──────────────────────────────────────────────────────────────
  const samples = [];
  const held = new Set();
  let firing = false;
  let marksLeft = [...SHOT_MARKS];
  let fightStartedAt = null;      // sim seconds when phase left countdown
  let sawFirstDamage = false, sawFirstFogWarn = false, sawFirstFogDanger = false;
  let lastPHp = null, lastEHp = null;
  let ended = false;

  const setKeys = async (move) => {
    const want = new Set();
    if (move.x < 0) want.add(KEYS.left);
    if (move.x > 0) want.add(KEYS.right);
    if (move.y < 0) want.add(KEYS.up);
    if (move.y > 0) want.add(KEYS.down);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k).catch(() => {}); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k).catch(() => {}); held.add(k); }
  };

  while (Date.now() - t0 < MAX_WALL_MS && !ended) {
    let r;
    try { r = await page.evaluate(READ); } catch { break; }
    if (!r.f) { await page.waitForTimeout(120); continue; }

    // Sim clock, read out of the game's own zone bar. `safeRadius = maxR *
    // timeRemaining / MATCH_DURATION`, so the bar IS the clock at ~0.2 s resolution —
    // finer than the mm:ss readout and available every frame.
    const simT = r.radius01 !== null && !Number.isNaN(r.radius01) ? 180 * (1 - r.radius01) : null;
    const inFight = r.countdown === null && !r.ended;
    if (inFight && fightStartedAt === null) {
      fightStartedAt = simT ?? 0;
      timeline.push({ wall: Date.now() - t0, simT, step: 'FIGHT (countdown over)' });
      await shoot('t000_start');
    }

    const p = r.f.player, e = r.f.enemy;
    const R = (r.radius01 ?? 1) * ARENA.maxR;
    samples.push({
      wall: Date.now() - t0, simT,
      px: Math.round(p.x), py: Math.round(p.y), php: p.hp,
      ex: Math.round(e.x), ey: Math.round(e.y), ehp: e.hp,
      d: Math.round(Math.hypot(p.x - e.x, p.y - e.y)),
      R: Math.round(R),
      timer: r.timer, zoneValue: r.zoneValue, zoneDanger: r.zoneDanger,
      zoneImminent: r.zoneImminent, fogEdgeOn: r.fogEdgeOn, arrow: r.arrowShown,
      dmgNumbers: r.dmgNumbers, ready: r.slots.map((s) => (s.ready ? 1 : 0)).join(''),
      qa: r.qa,
      pScreen: r.scr?.player ?? null, eScreen: r.scr?.enemy ?? null,
    });

    // ── event-triggered captures ───────────────────────────────────────────
    if (!sawFirstDamage && lastPHp !== null && (p.hp < lastPHp || e.hp < lastEHp)) {
      sawFirstDamage = true;
      timeline.push({ wall: Date.now() - t0, simT, step: `FIRST DAMAGE (p${p.hp} e${e.hp}, ${Math.round(Math.hypot(p.x - e.x, p.y - e.y))}wu apart)` });
      await shoot('first_damage');
    }
    if (!sawFirstFogWarn && r.zoneImminent) {
      sawFirstFogWarn = true;
      timeline.push({ wall: Date.now() - t0, simT, step: `FOG WARNING ("${r.zoneValue}")` });
      await shoot('fog_warning');
    }
    if (!sawFirstFogDanger && r.zoneDanger) {
      sawFirstFogDanger = true;
      timeline.push({ wall: Date.now() - t0, simT, step: `OUTSIDE THE ZONE ("${r.zoneValue}")` });
      await shoot('fog_outside');
    }
    lastPHp = p.hp; lastEHp = e.hp;

    if (r.ended) {
      ended = true;
      timeline.push({ wall: Date.now() - t0, simT, step: `RESULT: ${r.result} (player ${p.hp}, enemy ${e.hp})` });
      await page.waitForTimeout(1500);
      await shoot('result');
      break;
    }

    // ── scheduled captures, on the SIM clock ───────────────────────────────
    if (inFight && simT !== null && marksLeft.length) {
      const elapsed = simT - (fightStartedAt ?? 0);
      while (marksLeft.length && elapsed >= marksLeft[0]) {
        const m = marksLeft.shift();
        await shoot(`t${String(m).padStart(3, '0')}`);
      }
    }

    // ── drive ──────────────────────────────────────────────────────────────
    if (inFight) {
      const act = decide({ p, e, t: (simT ?? 0) * 1000, R });
      await setKeys(act.move);
      if (r.scr?.enemy) {
        await page.mouse.move(
          Math.max(2, Math.min(W - 2, r.scr.enemy.x)),
          Math.max(2, Math.min(H - 2, r.scr.enemy.y)),
        ).catch(() => {});
      }
      if (act.fire && !firing) { await page.mouse.down().catch(() => {}); firing = true; }
      else if (!act.fire && firing) { await page.mouse.up().catch(() => {}); firing = false; }
    }
    await page.waitForTimeout(90);
  }

  for (const k of held) await page.keyboard.up(k).catch(() => {});
  if (firing) await page.mouse.up().catch(() => {});
  if (!ended) { timeline.push({ wall: Date.now() - t0, step: 'GAVE UP (wall clock cap)' }); await shoot('timeout'); }

  // ── derive ────────────────────────────────────────────────────────────────
  const fight = samples.filter((s) => s.simT !== null);
  const first = fight[0]?.simT ?? 0;
  const last = fight[fight.length - 1]?.simT ?? 0;
  const engaged = fight.filter((s) => s.d <= 170).length;
  const summary = {
    base: BASE, requestedPlayer: PLAYER, requestedEnemy: ENEMY, actualMatchup: actual, policy: POLICY, viewport: [W, H],
    wallMs: Date.now() - t0,
    samples: samples.length,
    simSecondsCovered: +(last - first).toFixed(1),
    simSecondsPerWallSecond: +(((last - first) / ((Date.now() - t0) / 1000)) || 0).toFixed(2),
    engagedFrac: fight.length ? +(engaged / fight.length).toFixed(3) : null,
    result: samples[samples.length - 1] ?? null,
    pageErrors,
    timeline,
    NOTE: 'Timings are SIM seconds read from the game clock. Frame time / fps are NOT measured and cannot be under SwiftShader.',
  };

  writeFileSync(`${OUT}/telemetry.json`, JSON.stringify({ summary, weapons, samples }, null, 2));
  writeFileSync(`${OUT}/frames.txt`, frames.join('\n'));

  console.log(`\n══ ${PLAYER} vs ${ENEMY}  policy=${POLICY} ══`);
  for (const t of timeline) {
    console.log(`   ${String((t.wall / 1000).toFixed(1)).padStart(7)}s wall  ${t.simT != null ? `${t.simT.toFixed(1)}s sim` : '        '}   ${t.step}`);
  }
  console.log(`\n   ${samples.length} samples over ${summary.simSecondsCovered}s of sim time`);
  console.log(`   sim ran at ${summary.simSecondsPerWallSecond}x wall clock (SwiftShader; NOT a performance number)`);
  console.log(`   within 170wu of each other: ${summary.engagedFrac === null ? '—' : `${(summary.engagedFrac * 100).toFixed(1)}%`}`);
  console.log(`   ${frames.length} frames -> ${OUT}`);
  if (pageErrors.length) console.log(`   !! ${pageErrors.length} page errors`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
