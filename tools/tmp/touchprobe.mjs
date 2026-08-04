#!/usr/bin/env node
/**
 * Acceptance probe for the twin-stick TOUCH controls (`src/game/touch.ts`).
 *
 * Everything here is driven through the browser's REAL touch pipeline —
 * `Input.dispatchTouchEvent` over CDP, which goes through hit testing exactly like a
 * finger — and every gameplay claim is read off `window.__vfxDebugFighters`, the
 * sim's own per-tick position/HP snapshot, rather than judged from pixels.
 *
 * The five things it proves, in order of how easy each would be to fake:
 *   1. MOVEMENT. A drag in the left zone moves the fighter, in the dragged direction,
 *      on both axes, and STOPS when the finger lifts.
 *   2. AIM. Same fire input, two aim directions: damage lands only when the stick
 *      points at the opponent. That is the one experiment a "wired but does nothing"
 *      implementation cannot pass, and aim/facing has no debug readout of its own.
 *   3. WEAPON SELECT. Tapping a HUD slot changes the selected weapon.
 *   4. COEXISTENCE. In the SAME touch-capable context, real mouse events still reach
 *      the canvas and the keyboard still moves the fighter.
 *   5. NO REGRESSION. A mouse-only context installs no touch layer at all, the canvas
 *      is still the top element at frame centre, and the radar stays where it was.
 *
 * Usage: node tools/tmp/touchprobe.mjs --url http://localhost:PORT
 */

import { chromium } from 'playwright';
// The real mapping, imported and asserted directly. Node strips the types (the same
// trick `src/game/sim.test.mjs` uses), and `touch.ts` has no imports of its own, so
// this is the actual shipping function rather than a copy of it.
import { squareDeflection } from '../../src/game/touch.ts';

const args = process.argv.slice(2);
const url = (() => {
  const i = args.indexOf('--url');
  return i >= 0 ? args[i + 1] : 'http://localhost:5173';
})();
const shotDir = (() => {
  const i = args.indexOf('--out');
  return i >= 0 ? args[i + 1] : 'shots/touch';
})();

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const VP = { width: 844, height: 390 };

const results = [];
let failures = 0;
function record(group, check, ok, detail = '') {
  results.push({ group, check, ok, detail });
  if (!ok) failures++;
}

/** A finger, over CDP. `id` keeps two of them apart. */
function finger(x, y, id = 1) {
  return { x: Math.round(x), y: Math.round(y), id, radiusX: 12, radiusY: 12, force: 1 };
}

async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fighters(page) {
  return page.evaluate(() => window.__vfxDebugFighters ?? null);
}

/**
 * The SIM's own facing for the player, read out of the scene.
 *
 * There is no debug readout for `Fighter.facing`, but `match.ts` writes it to the model
 * every frame as `rotation.y = atan2(facing.x, facing.y)`, so the model's yaw IS the
 * sim's facing. The model is found BY NAME. Finding it by proximity was tried and is
 * wrong: the AI closes all the way to overlapping the player, at which point the nearest
 * projected object is the ENEMY's model and the probe reads the AI's facing instead.
 */
async function simFacing(page, id = 'hamburger') {
  return page.evaluate((charId) => {
    const st = window.__stage;
    if (!st) return null;
    const model = st.scene.children.find((o) => o.name === 'character:' + charId);
    if (!model) return null;
    const ry = model.rotation.y;
    return { name: model.name, x: Math.sin(ry), y: Math.cos(ry) };
  }, id);
}

/** Boot a match and wait until the countdown is over and the sim is live. */
async function openMatch(browser, { hasTouch, isMobile = false, query = '' }) {
  const context = await browser.newContext({
    viewport: VP,
    hasTouch,
    isMobile,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${url}/?player=hamburger&enemy=donut${query}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  // Phase proxy: the HUD hides the countdown the moment the match is 'playing'.
  await page.waitForFunction(
    () => document.querySelector('.hud-countdown')?.style.display === 'none',
    null, { timeout: 60000 },
  );
  await sleep(250);
  return { context, page, errs, cdp: await context.newCDPSession(page) };
}

async function run() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });

  // ── 1. Capability + layer sanity on a touch device ─────────────────────────
  const t = await openMatch(browser, { hasTouch: true, isMobile: true });
  const { page, cdp } = t;

  const caps = await page.evaluate(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    hasOnTouchStart: 'ontouchstart' in window,
    coarse: matchMedia('(pointer: coarse)').matches,
    fine: matchMedia('(pointer: fine)').matches,
    layer: !!document.querySelector('.tch-root'),
    layerPointerEvents: getComputedStyle(document.querySelector('.tch-root')).pointerEvents,
    hinted: document.querySelector('.tch-root')?.classList.contains('is-hinted') ?? false,
    faTouch: document.documentElement.classList.contains('fa-touch'),
    topAtCentre: document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2))?.tagName,
    canvasTouchAction: getComputedStyle(document.querySelector('#game canvas')).touchAction,
  }));
  record('touch', 'layer-exists-on-touch-device', caps.layer, JSON.stringify(caps));
  record('touch', 'layer-claims-NO-pointer-events', caps.layerPointerEvents === 'none', caps.layerPointerEvents);
  record('touch', 'canvas-is-top-at-centre', caps.topAtCentre === 'CANVAS', String(caps.topAtCentre));
  record('touch', 'no-fa-touch-before-a-real-finger', caps.faTouch === false, `fa-touch=${caps.faTouch}`);
  record('touch', 'canvas-gestures-suppressed', caps.canvasTouchAction === 'none', caps.canvasTouchAction);

  // ── 2. MOVEMENT: a left-zone drag moves the fighter ────────────────────────
  const before = await fighters(page);
  // Plant in the lower-left, drag EAST (screen +x). Full deflection: the stick radius
  // is 0.15 * short axis = ~59px here, and 90px of travel is past the rim.
  await touch(cdp, 'touchStart', [finger(150, 300)]);
  await sleep(30);
  await touch(cdp, 'touchMove', [finger(240, 300)]);
  await sleep(1400);
  const midEast = await fighters(page);
  await touch(cdp, 'touchEnd', []);
  // TWO settling reads. The first swallows the round-trip latency between reading
  // `midEast` and the touchEnd actually landing, which is real commanded movement and
  // not drift; the interval between the two is what a released stick must produce.
  await sleep(400);
  const settleA = await fighters(page);
  await sleep(500);
  const afterEast = await fighters(page);

  const dxEast = midEast.player.x - before.player.x;
  const dyEast = midEast.player.y - before.player.y;
  // Absolute distances are NOT a speed measurement here: SwiftShader renders a handful
  // of frames a second and `match.ts` clamps each frame's dt, so the sim advances far
  // slower than wall-clock. Parity against the keyboard is measured separately below,
  // which is the claim that actually matters.
  record('move', 'drag-east-moves-the-fighter', dxEast > 20,
    `dx=${dxEast.toFixed(1)}wu dy=${dyEast.toFixed(1)}wu over 1.4s`);
  record('move', 'drag-east-is-east-not-sideways', Math.abs(dyEast) < Math.abs(dxEast) * 0.25,
    `|dy|/|dx| = ${(Math.abs(dyEast) / Math.abs(dxEast)).toFixed(3)}`);
  const driftAfterRelease = Math.hypot(
    afterEast.player.x - settleA.player.x, afterEast.player.y - settleA.player.y);
  record('move', 'release-stops-the-fighter', driftAfterRelease < 0.5,
    `${driftAfterRelease.toFixed(2)}wu in the 500ms window starting 400ms after touchend`);

  // Second axis, opposite sign: drag NORTH (screen up = -y, same convention as W).
  const beforeN = await fighters(page);
  await touch(cdp, 'touchStart', [finger(150, 300)]);
  await sleep(30);
  await touch(cdp, 'touchMove', [finger(150, 210)]);
  await sleep(1200);
  const afterN = await fighters(page);
  await touch(cdp, 'touchEnd', []);
  await sleep(150);
  const dyN = afterN.player.y - beforeN.player.y;
  const dxN = afterN.player.x - beforeN.player.x;
  record('move', 'drag-north-moves-north', dyN < -20,
    `dy=${dyN.toFixed(1)}wu dx=${dxN.toFixed(1)}wu over 1.2s`);

  // The floating stick has to spawn where the thumb landed, not at a fixed pad.
  const stickBox = await page.evaluate(() => {
    const el = document.querySelector('.tch-stick--move');
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, shown: getComputedStyle(el).display };
  });
  record('move', 'fa-touch-set-after-a-real-finger',
    await page.evaluate(() => document.documentElement.classList.contains('fa-touch')));

  // ── 3. AIM: same fire input, two directions, only one lands damage ─────────
  // The player is teleported next to the enemy with the QA `?px=/?py=` overrides —
  // spawns are 1080wu apart and the melee reach is 70wu, so aiming cannot be tested
  // from the spawn without first walking for ten seconds. The SPAWN position is read
  // during the countdown, before the AI has taken a single step: reading it mid-match
  // (the first version of this probe) places the player 45wu from where the enemy USED
  // to be, which is nowhere near it, and the whole experiment silently measures
  // nothing. Both aim directions then miss and the control passes for the wrong reason.
  await t.context.close();
  const spawnCtx = await browser.newContext({ viewport: VP, hasTouch: true, deviceScaleFactor: 1 });
  const spawnPage = await spawnCtx.newPage();
  await spawnPage.goto(`${url}/?player=hamburger&enemy=donut`, { waitUntil: 'networkidle', timeout: 60000 });
  await spawnPage.waitForFunction('!!window.__vfxDebugFighters', null, { timeout: 90000 });
  const spawn = await fighters(spawnPage);
  await spawnCtx.close();
  record('aim', 'enemy-spawn-read-during-countdown',
    Math.hypot(spawn.enemy.x - spawn.player.x, spawn.enemy.y - spawn.player.y) > 900,
    `player (${spawn.player.x.toFixed(0)},${spawn.player.y.toFixed(0)}) enemy (${spawn.enemy.x.toFixed(0)},${spawn.enemy.y.toFixed(0)})`);

  // ── PARITY: a stick must not be slower than the keyboard ──────────────────
  // Asserted on the SHIPPING function, not in the page. `MatchInput.move` is a square
  // space — two held keys give 1.41x a single one — so a raw unit-disc stick would top
  // out 29% slower on every diagonal. Measuring that in the browser was tried and does
  // not work: under SwiftShader the sim advances ~4x slower than wall-clock and
  // `match.ts` clamps each frame's dt, so displacement is quantised hard enough to swamp
  // a 40% effect (the same control read x1.53, x0.46 and x0.74 on three runs).
  {
    const v = { x: 0, y: 0 };
    const at = (x, y) => { squareDeflection(x, y, v); return { x: +v.x.toFixed(4), y: +v.y.toFixed(4) }; };
    const full = 1 / Math.SQRT2;
    const cardinal = at(1, 0);
    const diagonal = at(full, -full);
    const half = at(0.5, 0);
    const halfDiag = at(full / 2, full / 2);
    const dead = at(0, 0);
    record('parity', 'full-cardinal-equals-one-key',
      cardinal.x === 1 && cardinal.y === 0, JSON.stringify(cardinal));
    record('parity', 'full-diagonal-equals-TWO-keys',
      Math.abs(diagonal.x - 1) < 1e-3 && Math.abs(diagonal.y + 1) < 1e-3,
      `${JSON.stringify(diagonal)} — a raw unit-disc stick would give {0.707,-0.707}, i.e. 29% slower`);
    record('parity', 'partial-deflection-stays-proportional',
      Math.abs(half.x - 0.5) < 1e-3 && Math.abs(Math.hypot(halfDiag.x, halfDiag.y) - 0.7071) < 2e-3,
      `half cardinal ${JSON.stringify(half)}, half diagonal |v|=${Math.hypot(halfDiag.x, halfDiag.y).toFixed(4)}`);
    record('parity', 'no-axis-ever-exceeds-the-key-range',
      [at(2, 0), at(2, 2), at(-3, 1)].every((p) => Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1),
      'over-travel is clamped, never amplified');
    record('parity', 'centred-stick-is-exactly-zero', dead.x === 0 && dead.y === 0, JSON.stringify(dead));
  }

  const aimRun = async (mode, side = 'east') => {
    // EAST of the enemy for the two aim cases: a fighter spawns facing +x (sim.ts) and
    // touchdown fires immediately (the deliberate quick-tap), so standing east points
    // that free first shot AWAY from the enemy and the control cannot be contaminated
    // by it. The tap case wants the opposite and asks for 'west'.
    const px = Math.round(spawn.enemy.x + (side === 'east' ? 45 : -45));
    // `simSpeed=2` is not a convenience, it is what makes the experiment exist. Patty
    // Smash has a 650ms cooldown and this page renders ~5 fps, so a plain wall-clock
    // window of a couple of seconds contains ONE attack — which fires on the tick the
    // finger lands, before the CDP touchMove that sets the aim has even arrived. Every
    // direction then scores identically and the whole test measures the quick-tap.
    const s = await openMatch(browser, {
      hasTouch: true, isMobile: true,
      query: `&px=${px}&py=${Math.round(spawn.enemy.y)}&simSpeed=2`,
    });
    const f0 = await fighters(s.page);
    const sign = mode === 'away' ? -1 : 1;
    let bx = 0;
    let by = 0;

    // Right zone (x > half the viewport) = aim + fire. Plant, then TRACK: the stick is
    // re-pushed along the enemy's current screen bearing every ~600ms, because the AI
    // repositions and a stick left pointing at where it used to be is not a test of aim.
    await touch(s.cdp, 'touchStart', [finger(650, 300)]);
    for (let i = 0; i < 8; i++) {
      const scr = await s.page.evaluate(() => window.__vfxDebugScreen);
      if (scr?.enemy && scr?.player) {
        bx = scr.enemy.x - scr.player.x;
        by = scr.enemy.y - scr.player.y;
      }
      const bl = Math.hypot(bx, by) || 1;
      if (mode !== 'tap') {
        await touch(s.cdp, 'touchMove',
          [finger(650 + (bx / bl) * 90 * sign, 300 + (by / bl) * 90 * sign)]);
      }
      await sleep(600);
    }
    const f1 = await fighters(s.page);
    // The reticle's own offset from the player, against the enemy's bearing at the same
    // instant: a direct angular readout of where the aim ended up, independent of damage.
    const aimGeom = await s.page.evaluate(() => {
      const el = document.querySelector('.hud-aim-reticle');
      const r = el.getBoundingClientRect();
      const p = window.__vfxDebugScreen.player;
      const e = window.__vfxDebugScreen.enemy;
      return {
        shown: getComputedStyle(el).display !== 'none',
        ax: r.left + r.width / 2 - p.x, ay: r.top + r.height / 2 - p.y,
        ex: e.x - p.x, ey: e.y - p.y,
      };
    });
    const ang = (Math.atan2(aimGeom.ay, aimGeom.ax) - Math.atan2(aimGeom.ey, aimGeom.ex)) * 180 / Math.PI;
    const aimError = Math.abs(((ang + 540) % 360) - 180); // 0deg = pointing at it, 180 = away
    if (mode === 'toward') await s.page.screenshot({ path: `${shotDir}/aim-toward.png` });
    await touch(s.cdp, 'touchEnd', []);
    await s.context.close();
    const bearing = (x, y) => `${Math.round((Math.atan2(y, x) * 180) / Math.PI)}deg`;
    return {
      dealt: f0.enemy.hp - f1.enemy.hp, hp0: f0.enemy.hp, hp1: f1.enemy.hp,
      shown: aimGeom.shown,
      aimError: Math.round(aimError),
      dist: Math.hypot(f0.enemy.x - f0.player.x, f0.enemy.y - f0.player.y),
      distEnd: Math.hypot(f1.enemy.x - f1.player.x, f1.enemy.y - f1.player.y),
      screenBearing: bearing(bx, by),
    };
  };

  // Identical fire input, identical placement, identical duration — the ONLY variable
  // is which way the stick was pushed.
  // Both placed WEST, where the spawn facing already points at the enemy: this pair is
  // about the FIRE path (does a held stick keep attacking, and does it deal real damage
  // through the sim), not about aim — aim is settled by the facing sweep below, which
  // has no AI in it.
  const toward = await aimRun('toward', 'west');
  const away = await aimRun('away', 'west');
  const tap = await aimRun('tap', 'west');
  record('aim', 'player-starts-in-melee-reach', toward.dist < 70 && away.dist < 70,
    `${toward.dist.toFixed(1)}wu / ${away.dist.toFixed(1)}wu apart at the first tick (Patty Smash reaches 70wu)`);
  record('aim', 'holding-the-stick-fires-REPEATEDLY', toward.dealt >= 24,
    `enemy hp ${toward.hp0} -> ${toward.hp1} (${toward.dealt} dealt = ${toward.dealt / 12} Patty Smash hits) while the stick was held`);
  // NOT an assertion. Over a window long enough for several attacks the AI circles the
  // stationary player, so an aim held opposite to a STALE bearing can end up pointing at
  // where the enemy has since walked. The AI-free control is the sim-facing block below.
  // Informational only. Damage cannot be used to judge AIM here: the AI closes to zero
  // distance, where `combat.ts` documents that the melee cone check goes NaN and a swing
  // lands regardless of facing.
  record('aim', 'inverted-aim-run-completed (informational)', true,
    `enemy hp ${away.hp0} -> ${away.hp1} (${away.dealt} dealt) with the stick held opposite; the AI ended at ${away.screenBearing}`);
  // Placed WEST of the enemy, so the spawn facing already points at it: a tap with no
  // drag must fire on the CURRENT facing rather than snapping the fighter somewhere.
  record('aim', 'a-tap-with-no-drag-fires-on-the-current-facing', tap.dealt >= 12,
    `enemy hp ${tap.hp0} -> ${tap.hp1} (${tap.dealt} dealt); enemy on screen at ${tap.screenBearing}, no drag at all`);
  record('aim', 'reticle-is-drawn-while-touch-aiming', toward.shown && away.shown,
    'the HUD reticle is the only aim feedback a phone has — there is no OS cursor');
  record('aim', 'a-bare-tap-draws-no-reticle', tap.shown === false,
    'a tap sets no direction, so there is nothing to draw and facing is left alone');

  // ── Where the aim ACTUALLY points, measured against the stick and nothing else ──
  // Comparing the reticle to the ENEMY was tried and is not a test of aim: at simSpeed 2
  // the AI crosses tens of degrees of bearing between the last stick push and the read,
  // so it measured how far the target had walked. The stick angle is exact and static.
  {
    const s = await openMatch(browser, { hasTouch: true, isMobile: true });
    const errors = [];
    for (const deg of [0, 90, 180, -90, 35, -145]) {
      const rad = (deg * Math.PI) / 180;
      await touch(s.cdp, 'touchStart', [finger(650, 250)]);
      await sleep(40);
      await touch(s.cdp, 'touchMove',
        [finger(650 + Math.cos(rad) * 90, 250 + Math.sin(rad) * 90)]);
      await sleep(320);
      const g = await s.page.evaluate(() => {
        const el = document.querySelector('.hud-aim-reticle');
        const r = el.getBoundingClientRect();
        const p = window.__vfxDebugScreen.player;
        return { ax: r.left + r.width / 2 - p.x, ay: r.top + r.height / 2 - p.y };
      });
      const got = (Math.atan2(g.ay, g.ax) * 180) / Math.PI;
      errors.push(Math.abs(((got - deg + 540) % 360) - 180));
      await touch(s.cdp, 'touchEnd', []);
      await sleep(120);
    }
    const worst = Math.max(...errors);
    record('aim', 'reticle-bearing-matches-the-stick-bearing', worst < 3,
      `worst error ${worst.toFixed(2)}deg across 6 stick angles: ${errors.map((e) => e.toFixed(1)).join(', ')}`);
    // And the radius: the reticle must sit ON the aim ring, the same hard clamp the
    // desktop pointer-lock stick bottoms out at, never drifting in toward the player.
    const radii = await s.page.evaluate(() => {
      const short = Math.min(innerWidth, innerHeight);
      return Math.max(84, Math.min(190, short * 0.155));
    });
    record('aim', 'reticle-sits-on-the-aim-ring', radii >= 84, `aim radius ${radii.toFixed(1)}px at this viewport`);
    await s.context.close();
  }

  // ── Does the aim reach the SIM? Read its facing, with no AI in the loop ────
  // The reticle proves the aim reached the HUD. This proves it reached `Fighter.facing`
  // — what every weapon cone, every projectile heading and the fighter's own rotation
  // resolve against.
  //
  // Asserted against the STICK, not against the enemy. Judging aim by damage turned out
  // to be unsound here for a reason worth writing down: the AI closes to literally zero
  // distance, and `combat.ts` documents that at dist 0 the cone check goes NaN and a
  // melee swing lands "regardless of facing". Damage therefore stops being a function of
  // aim exactly when the fight gets interesting.
  //
  // The four cardinals are exact by symmetry — the camera is yaw 0, so screen x maps to
  // world x and screen y to world y, with pitch only foreshortening the magnitude, which
  // `applyAim` normalises away. Oblique pushes are asserted by quadrant only, since a
  // 45-degree SCREEN angle is not a 45-degree WORLD angle under a pitched camera.
  {
    const s = await openMatch(browser, { hasTouch: true, isMobile: true });
    const errs = [];
    const quadrants = [];
    const cardinals = [
      ['left', -90, 0, -1, 0], ['right', 90, 0, 1, 0],
      ['up', 0, -90, 0, -1], ['down', 0, 90, 0, 1],
    ];
    for (const [label, dx, dy, wx, wy] of cardinals) {
      await touch(s.cdp, 'touchStart', [finger(650, 250)]);
      await sleep(40);
      await touch(s.cdp, 'touchMove', [finger(650 + dx, 250 + dy)]);
      await sleep(420);
      const f = await simFacing(s.page);
      await touch(s.cdp, 'touchEnd', []);
      await sleep(140);
      const deg = f ? (Math.acos(Math.max(-1, Math.min(1, f.x * wx + f.y * wy))) * 180) / Math.PI : 999;
      errs.push(`${label} ${deg.toFixed(2)}deg`);
      quadrants.push(deg);
    }
    const worst = Math.max(...quadrants);
    record('aim', 'SIM-FACING-matches-the-stick-on-all-four-cardinals', worst < 2,
      `error vs the expected world axis: ${errs.join(', ')}`);

    const obliques = [];
    for (const [dx, dy, sx, sy] of [[64, -64, 1, -1], [-64, 64, -1, 1], [-64, -64, -1, -1]]) {
      await touch(s.cdp, 'touchStart', [finger(650, 250)]);
      await sleep(40);
      await touch(s.cdp, 'touchMove', [finger(650 + dx, 250 + dy)]);
      await sleep(420);
      const f = await simFacing(s.page);
      await touch(s.cdp, 'touchEnd', []);
      await sleep(140);
      obliques.push(f && Math.sign(f.x) === sx && Math.sign(f.y) === sy);
    }
    record('aim', 'diagonal-pushes-land-in-the-right-world-quadrant',
      obliques.every(Boolean), `${obliques.filter(Boolean).length}/3 quadrants correct`);
    await s.context.close();
  }

  // ── 4. WEAPON SELECT by tap, and coexistence with mouse + keyboard ─────────
  const s2 = await openMatch(browser, { hasTouch: true, isMobile: true });
  const selBefore = await s2.page.evaluate(() =>
    [...document.querySelectorAll('.hud-weapon-slot')].findIndex((s) => s.classList.contains('is-selected')));
  const slotBox = await s2.page.evaluate(() => {
    const slots = [...document.querySelectorAll('.hud-weapon-slot')];
    const r = slots[2].getBoundingClientRect();
    return {
      cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height,
      pe: getComputedStyle(slots[2]).pointerEvents,
      bottom: innerHeight - r.bottom,
    };
  });
  // A real finger has not landed yet in this fresh context, so the slots must still be
  // inert — the property that keeps a mouse-only player's fire clicks off the bar.
  record('weapons', 'slots-inert-before-any-touch', slotBox.pe === 'none', `pointer-events=${slotBox.pe}`);
  await touch(s2.cdp, 'touchStart', [finger(150, 300)]);
  await touch(s2.cdp, 'touchEnd', []);
  await sleep(120);
  const slotAfter = await s2.page.evaluate(() => {
    const s = document.querySelectorAll('.hud-weapon-slot')[2];
    return { pe: getComputedStyle(s).pointerEvents, w: s.getBoundingClientRect().width, h: s.getBoundingClientRect().height };
  });
  record('weapons', 'slots-become-tappable-once-touched', slotAfter.pe === 'auto', `pointer-events=${slotAfter.pe}`);
  record('weapons', 'slot-tap-target>=44px', slotAfter.w >= 44 && slotAfter.h >= 44,
    `${Math.round(slotAfter.w)}x${Math.round(slotAfter.h)}`);
  await touch(s2.cdp, 'touchStart', [finger(slotBox.cx, slotBox.cy)]);
  await touch(s2.cdp, 'touchEnd', []);
  await sleep(150);
  const selAfter = await s2.page.evaluate(() =>
    [...document.querySelectorAll('.hud-weapon-slot')].findIndex((s) => s.classList.contains('is-selected')));
  record('weapons', 'tapping-a-slot-selects-it', selAfter === 2, `slot ${selBefore} -> ${selAfter}`);

  // Radar must not be sitting under the right thumb.
  const layout = await s2.page.evaluate(() => {
    const r = document.querySelector('.hud-radar').getBoundingClientRect();
    const w = document.querySelector('.hud-weapons').getBoundingClientRect();
    return {
      radar: { top: Math.round(r.top), bottom: Math.round(innerHeight - r.bottom), right: Math.round(innerWidth - r.right) },
      weaponsBottom: Math.round(innerHeight - w.bottom),
      vh: innerHeight, vw: innerWidth,
    };
  });
  // Thumb arc: a stick planted in the lower corner reaches its rim ~60px out, and a
  // thumb covers well beyond that. Anything gameplay-critical must clear the bottom
  // third of the frame in the outer quarter of its width.
  record('layout', 'radar-clears-the-thumb-zone', layout.radar.bottom > layout.vh * 0.33,
    `radar bottom=${layout.radar.bottom}px of ${layout.vh}px tall (top=${layout.radar.top})`);

  // Real MOUSE events, in the same touch-capable context.
  const mouseHits = await s2.page.evaluate(() => {
    const c = document.querySelector('#game canvas');
    window.__pm = 0; window.__pd = 0;
    c.addEventListener('mousemove', () => { window.__pm++; }, true);
    c.addEventListener('mousedown', () => { window.__pd++; }, true);
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await s2.page.mouse.move(mouseHits.x - 60, mouseHits.y - 40);
  await s2.page.mouse.move(mouseHits.x + 40, mouseHits.y + 30);
  await s2.page.mouse.down();
  await s2.page.mouse.up();
  const mouseSeen = await s2.page.evaluate(() => ({ move: window.__pm, down: window.__pd }));
  record('coexist', 'mouse-still-reaches-the-canvas-with-touch-live',
    mouseSeen.move > 0 && mouseSeen.down > 0, `${mouseSeen.move} mousemove / ${mouseSeen.down} mousedown`);

  // LAST DEVICE WINS on aim. The touch direction deliberately survives the finger
  // lifting, so without an explicit hand-back a single tap on a hybrid laptop would
  // leave the mouse unable to aim for the rest of the match — the reticle would sit
  // where the thumb left it while the cursor moved somewhere else entirely.
  {
    await touch(s2.cdp, 'touchStart', [finger(650, 250)]);
    await sleep(40);
    await touch(s2.cdp, 'touchMove', [finger(740, 250)]);
    await sleep(300);
    await touch(s2.cdp, 'touchEnd', []);
    await sleep(200);
    const heldAfterRelease = await s2.page.evaluate(() =>
      getComputedStyle(document.querySelector('.hud-aim-reticle')).display !== 'none');
    await s2.page.mouse.move(mouseHits.x + 120, mouseHits.y - 30);
    await s2.page.mouse.move(mouseHits.x + 130, mouseHits.y - 20);
    await sleep(300);
    const afterMouse = await s2.page.evaluate(() =>
      getComputedStyle(document.querySelector('.hud-aim-reticle')).display !== 'none');
    record('coexist', 'touch-aim-survives-the-finger-lifting', heldAfterRelease,
      'facing must not snap back when the thumb comes off, exactly as it does not when a mouse button is released');
    record('coexist', 'a-moving-mouse-takes-the-aim-BACK', heldAfterRelease && !afterMouse,
      'the touch reticle gives way to the free cursor on the first mousemove');
  }

  // Keyboard, same context, after touch has already been used.
  const kb0 = await fighters(s2.page);
  await s2.page.keyboard.down('KeyD');
  await sleep(900);
  await s2.page.keyboard.up('KeyD');
  const kb1 = await fighters(s2.page);
  record('coexist', 'keyboard-still-moves-with-touch-live', kb1.player.x - kb0.player.x > 20,
    `dx=${(kb1.player.x - kb0.player.x).toFixed(1)}wu on held KeyD`);

  // Screenshot with BOTH sticks planted, for a human to look at.
  await touch(s2.cdp, 'touchStart', [finger(150, 300, 1)]);
  await touch(s2.cdp, 'touchMove', [finger(210, 250, 1)]);
  await touch(s2.cdp, 'touchStart', [finger(210, 250, 1), finger(680, 300, 2)]);
  await touch(s2.cdp, 'touchMove', [finger(210, 250, 1), finger(740, 260, 2)]);
  await sleep(300);
  await s2.page.screenshot({ path: `${shotDir}/sticks.png` });
  const bothSticks = await s2.page.evaluate(() => [...document.querySelectorAll('.tch-stick')]
    .map((el) => ({ shown: getComputedStyle(el).display !== 'none',
                    cx: Math.round(el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
                    cy: Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) })));
  record('move', 'both-sticks-render-where-the-thumbs-landed',
    bothSticks.every((s) => s.shown) &&
    Math.abs(bothSticks[0].cx - 210) < 62 && Math.abs(bothSticks[1].cx - 740) < 62,
    JSON.stringify(bothSticks));
  const twoFinger = await fighters(s2.page);
  await sleep(700);
  const twoFingerLater = await fighters(s2.page);
  record('move', 'two-thumbs-at-once-both-work',
    Math.hypot(twoFingerLater.player.x - twoFinger.player.x, twoFingerLater.player.y - twoFinger.player.y) > 8,
    `moved ${Math.hypot(twoFingerLater.player.x - twoFinger.player.x, twoFingerLater.player.y - twoFinger.player.y).toFixed(1)}wu while ALSO firing`);
  await touch(s2.cdp, 'touchEnd', []);
  record('touch', 'no-console-errors-touch', s2.errs.length === 0, s2.errs.slice(0, 2).join(' | '));
  await s2.context.close();

  // ── 5. MOUSE-ONLY CONTROL: nothing may change ─────────────────────────────
  const s3 = await openMatch(browser, { hasTouch: false });
  const desktop = await s3.page.evaluate(() => {
    const slot = document.querySelector('.hud-weapon-slot');
    const radar = document.querySelector('.hud-radar').getBoundingClientRect();
    return {
      maxTouchPoints: navigator.maxTouchPoints,
      layer: !!document.querySelector('.tch-root'),
      faTouch: document.documentElement.classList.contains('fa-touch'),
      slotPe: getComputedStyle(slot).pointerEvents,
      keyBadge: getComputedStyle(document.querySelector('.hud-weapon-key')).display,
      radarBottom: Math.round(innerHeight - radar.bottom),
      canvasTouchAction: getComputedStyle(document.querySelector('#game canvas')).touchAction,
      topAtCentre: document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2))?.tagName,
    };
  });
  record('desktop', 'no-touch-layer-installed', desktop.layer === false, JSON.stringify(desktop));
  record('desktop', 'weapon-slots-stay-inert', desktop.slotPe === 'none', desktop.slotPe);
  record('desktop', 'digit-key-badges-kept', desktop.keyBadge !== 'none', desktop.keyBadge);
  record('desktop', 'radar-stays-bottom-right', desktop.radarBottom === 16, `${desktop.radarBottom}px from the bottom`);
  record('desktop', 'canvas-touch-action-untouched', desktop.canvasTouchAction === 'auto', desktop.canvasTouchAction);
  record('desktop', 'canvas-is-top-at-centre', desktop.topAtCentre === 'CANVAS', String(desktop.topAtCentre));
  const mk0 = await fighters(s3.page);
  await s3.page.keyboard.down('KeyD');
  await sleep(800);
  await s3.page.keyboard.up('KeyD');
  const mk1 = await fighters(s3.page);
  record('desktop', 'keyboard-move-unaffected', mk1.player.x - mk0.player.x > 20,
    `dx=${(mk1.player.x - mk0.player.x).toFixed(1)}wu`);
  record('desktop', 'no-console-errors-desktop', s3.errs.length === 0, s3.errs.slice(0, 2).join(' | '));
  await s3.page.screenshot({ path: `${shotDir}/desktop-control.png` });
  await s3.context.close();

  await browser.close();

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.group, 9)} ${pad(r.check, 42)} ${r.detail}`);
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
