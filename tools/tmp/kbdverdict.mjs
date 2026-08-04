#!/usr/bin/env node
/**
 * THROWAWAY DIAGNOSTIC — "WASD does not move the player" verdict probe.
 *
 * Kills one hypothesis per case, in order, all with REAL CDP key events read off
 * fighter state (`window.__vfxDebugFighters`), never off a screenshot:
 *
 *   shipped     boot -> opening -> home -> character select -> Fight!, all real clicks.
 *               This is the only path a player takes and it had never been tested.
 *   direct      /?player=&enemy=  (the QA shortcut, no position override)
 *   reporter    the arena agent's EXACT url, including ?px=850&py=500
 *   sweep       ?px=<n>&py=500 across the east side's cover boxes.
 *               PREDICTION, from movement.ts's per-axis test and PLAYER_SIZE=42: a
 *               fighter overlapping a CoverBox is pinned FOREVER, because `tryMove`
 *               tests the DESTINATION for overlap and does no depenetration — from
 *               inside, every destination one step away still overlaps, on both axes.
 *               So px is pinned wherever |px - boxX| < (42 + boxW)/2 and walks
 *               everywhere else. A crisp, falsifiable band.
 *
 *               The first run of this sweep predicted only `spice_cart` (875,500,50,50)
 *               and was WRONG at px=924/960, which turned out to be a second box —
 *               `supply_barrel` at (940,500,48,46). The mismatch found the box.
 *
 * Run:  node tools/tmp/headserve.mjs -- node tools/tmp/kbdverdict.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const browser = await chromium.launch({ args: LAUNCH });
const results = [];

function log(...a) { console.log(...a); }

async function newPage() {
  const p = await browser.newPage({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => log('  PAGEERROR', String(e).slice(0, 200)));
  return p;
}

const pos = (p) => p.evaluate(() => {
  const f = window.__vfxDebugFighters;
  return f ? { px: f.player.x, py: f.player.y, ex: f.enemy.x, ey: f.enemy.y, hp: f.player.hp } : null;
});

async function waitPlaying(p, ms = 120000) {
  await p.waitForFunction('window.__gameReady === true', null, { timeout: ms });
  await p.waitForFunction(
    () => document.querySelector('.hud-countdown')?.style.display === 'none',
    null, { timeout: ms },
  );
  await p.waitForTimeout(300);
}

/** Hold a key for `ms` of WALL time and report the displacement it bought. */
async function hold(p, code, ms = 1400) {
  const a = await pos(p);
  await p.keyboard.down(code);
  await p.waitForTimeout(ms);
  await p.keyboard.up(code);
  await p.waitForTimeout(120);
  const b = await pos(p);
  return { code, from: a, to: b, dx: +(b.px - a.px).toFixed(1), dy: +(b.py - a.py).toFixed(1) };
}

/** Four cardinals. Returns the per-key displacements plus a moved/pinned verdict. */
async function movementSuite(p, label) {
  const env = await p.evaluate(() => ({
    focus: document.hasFocus(),
    active: document.activeElement ? document.activeElement.tagName + (document.activeElement.className ? '.' + String(document.activeElement.className).split(' ')[0] : '') : null,
    plock: window.__plockDebug ?? null,
    topAtCentre: (() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') : null; })(),
  }));
  const trials = [];
  for (const code of ['KeyA', 'KeyD', 'ArrowUp', 'KeyS']) trials.push(await hold(p, code));
  const totalAbs = trials.reduce((s, t) => s + Math.abs(t.dx) + Math.abs(t.dy), 0);
  const verdict = totalAbs > 4 ? 'MOVES' : 'PINNED';
  log(`\n== ${label} ==`);
  log(`   focus=${env.focus} active=${env.active} topAtCentre=${env.topAtCentre}`);
  log(`   pointerLock=${env.plock ? JSON.stringify(env.plock) : 'n/a'}`);
  for (const t of trials) log(`   ${t.code.padEnd(9)} dx=${String(t.dx).padStart(7)} dy=${String(t.dy).padStart(7)}   (${t.from.px.toFixed(1)},${t.from.py.toFixed(1)}) -> (${t.to.px.toFixed(1)},${t.to.py.toFixed(1)})`);
  log(`   >>> ${verdict}  (total |displacement| ${totalAbs.toFixed(1)} wu)`);
  results.push({ label, verdict, totalAbs: +totalAbs.toFixed(1), trials, env });
  return { verdict, totalAbs, trials, env };
}

/** Aim + fire, on whatever page is already in a live match. */
async function aimAndFire(p, label) {
  const before = await p.evaluate(() => ({
    cast: window.__vfxQaCounts?.cast ?? 0,
    scr: window.__vfxDebugScreen?.player ?? null,
  }));
  if (!before.scr) { log(`   ${label}: no __vfxDebugScreen.player — skipped`); return null; }
  // Two mouse positions on opposite sides of the player; facing must differ between them.
  const read = async (ox, oy) => {
    await p.mouse.move(before.scr.x + ox, before.scr.y + oy);
    await p.waitForTimeout(220);
    return p.evaluate(() => {
      const st = window.__stage;
      const c = st?.scene?.children?.find((o) => o.name?.startsWith?.('character:'));
      return c ? +c.rotation.y.toFixed(3) : null;
    });
  };
  const rotRight = await read(160, 0);
  const rotLeft = await read(-160, 0);
  await p.mouse.move(before.scr.x + 160, before.scr.y + 0);
  await p.mouse.down();
  await p.waitForTimeout(900);
  await p.mouse.up();
  const after = await p.evaluate(() => window.__vfxQaCounts?.cast ?? 0);
  const facingWorks = rotRight !== null && rotLeft !== null && Math.abs(rotRight - rotLeft) > 0.3;
  log(`   AIM  rot(mouse right)=${rotRight}  rot(mouse left)=${rotLeft}  -> ${facingWorks ? 'FACES CURSOR' : 'FACING DEAD'}`);
  log(`   FIRE cast events ${before.cast} -> ${after}  -> ${after > before.cast ? 'FIRES' : 'NO FIRE'}`);
  results.push({ label: label + ' [aim/fire]', facingWorks, casts: after - before.cast });
  return { facingWorks, casts: after - before.cast };
}

// ── Case 1: the shipped path, every step a real click ────────────────────────
if (!ONLY || ONLY === 'shipped') {
  const p = await newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // Real CDP mouse clicks. `force` only skips Playwright's actionability wait — these
  // screens animate continuously, so "element is stable" never becomes true, and the
  // opening card also auto-advances on its own timer and detaches the button.
  const step = async (name, sel, want) => {
    if (await p.evaluate((s) => window.__screen === s, want)) { log(`   already on ${want}`); return; }
    try {
      await p.waitForSelector(sel, { state: 'visible', timeout: 45000 });
      await p.click(sel, { force: true, timeout: 15000 });
      log(`   clicked ${name}`);
    } catch { log(`   ${name}: click raced the screen (auto-advance) — continuing`); }
    await p.waitForFunction((s) => window.__screen === s, want, { timeout: 60000 });
    log(`   -> screen=${await p.evaluate('window.__screen')}`);
    await p.waitForTimeout(500);
  };
  await p.waitForFunction('typeof window.__screen === "string"', null, { timeout: 60000 });
  log(`\n-- shipped path navigation (boot screen: ${await p.evaluate('window.__screen')}) --`);
  await step('opening: Start', '.open-start', 'home');
  await step('home: Start Game', '[data-el="start"]', 'characters');
  await step('characters: Fight!', '[data-el="fight"]', 'match');
  await waitPlaying(p);
  await movementSuite(p, 'SHIPPED PATH  / -> opening -> home -> characters -> Fight!');
  await aimAndFire(p, 'shipped path');
  await p.close();
}

// ── Case 2: the direct QA route, no position override ────────────────────────
if (!ONLY || ONLY === 'direct') {
  const p = await newPage();
  await p.goto(`${BASE}/?player=hamburger&enemy=donut`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitPlaying(p);
  await movementSuite(p, 'DIRECT  /?player=hamburger&enemy=donut');
  await aimAndFire(p, 'direct');
  await p.close();
}

// ── Case 3: the reporter's exact URL ─────────────────────────────────────────
if (!ONLY || ONLY === 'reporter') {
  const p = await newPage();
  await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=850&py=500&fogRadius=545&simSpeed=1&pointerLock=0&aimMode=free`,
    { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitPlaying(p);
  await movementSuite(p, "REPORTER'S EXACT URL  ...&px=850&py=500&fogRadius=545&pointerLock=0");
  await p.close();
}

// ── Case 4: the px sweep across the spice-cart box at (875, 500, 50, 50) ─────
if (!ONLY || ONLY === 'sweep') {
  log('\n== PX SWEEP along y=500, across the spice_cart CoverBox (875,500,50,50) ==');
  log('   prediction: PINNED wherever the 42 wu fighter overlaps a CoverBox, MOVES elsewhere');
  // Both boxes that straddle y=500 on the east side. `spice_cart` is the one the
  // reporter landed in; `supply_barrel` was found BY this sweep, when 924/960 came
  // back pinned against a prediction that only knew about the cart.
  const BOXES = [
    { name: 'spice_cart', x: 875, w: 50, h: 50, y: 500 },
    { name: 'supply_barrel', x: 940, w: 48, h: 46, y: 500 },
  ];
  // A SHALLOW overlap is escapable, and that is the whole mechanism in one line: the
  // fighter is pinned only when the depth it is buried at exceeds ONE STEP, because a
  // single step that clears the box is accepted. Step = PLAYER_SPEED (0.12 wu/ms) x
  // the clamped max frame dt (50 ms) = 6 wu, which is what a SwiftShader frame gives.
  const STEP = 0.12 * 50;
  const blocker = (px) => BOXES.find((o) => {
    const depthX = (42 + o.w) / 2 - Math.abs(px - o.x);
    const depthY = (42 + o.h) / 2 - Math.abs(500 - o.y);
    return depthX > STEP && depthY > 0;
  });
  const SWEEP = [780, 820, 828, 832, 850, 900, 918, 924, 960, 1000];
  for (const px of SWEEP) {
    const p = await newPage();
    await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=500&fogRadius=545&pointerLock=0`,
      { waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitPlaying(p);
    const a = await pos(p);
    await p.keyboard.down('KeyA');
    await p.waitForTimeout(1200);
    await p.keyboard.up('KeyA');
    await p.waitForTimeout(100);
    const b = await pos(p);
    const d = Math.abs(b.px - a.px) + Math.abs(b.py - a.py);
    const box = blocker(px);
    const got = d > 4 ? 'MOVES ' : 'PINNED';
    const want = box ? 'PINNED' : 'MOVES ';
    log(`   px=${String(px).padStart(4)}  ${(box ? 'inside ' + box.name : 'clear').padEnd(22)}  moved ${d.toFixed(1).padStart(6)} wu  ${got}  predicted ${want}  ${got === want ? 'OK' : '** MISMATCH **'}`);
    results.push({ label: `sweep px=${px}`, verdict: got.trim(), predicted: want.trim(), moved: +d.toFixed(1) });
    await p.close();
  }
}

await browser.close();
log('\n──────── SUMMARY ────────');
for (const r of results) log(`  ${(r.verdict ?? (r.facingWorks !== undefined ? (r.facingWorks ? 'FACES' : 'FACING DEAD') : '')).padEnd(7)} ${r.label}`);
