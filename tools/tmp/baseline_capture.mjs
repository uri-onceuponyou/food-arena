#!/usr/bin/env node
/**
 * BASELINE CAPTURE — shoot the five elements of the baseline re-score, and shoot the
 * match ones MID-FIGHT rather than at rest.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Every arena critic round this project has ever run scored an IDLE frame against
 * peak-action plates. Our side: one motionless character, no opponent, no VFX. The
 * plates: `reference/images/curated/gameplay_topdown/` is six Brawl Stars frames with
 * 3-5 brawlers mid-super, smoke, poison clouds, nameplates, damage and emote bubbles.
 * A critic named the asymmetry unprompted and priced it at ~1 point — comparable to
 * the whole measured resolution floor of the instrument.
 *
 * So the arena/cast captures here are taken from a REAL driven match, and a frame is
 * only a candidate while all of the following hold at once:
 *
 *   both fighters alive AND both projected inside the viewport,
 *   separation <= ENGAGE wu (they are actually fighting, not walking towards it),
 *   at least one VFX effect spawned in the last VFX_WINDOW ms (`__vfxQaCounts` delta),
 *
 * and every candidate records `.hud-dmg` count, separation, and the per-kind VFX delta
 * so the pick is made on numbers rather than on which screenshot happened to be last.
 *
 * ── What it will NOT do ─────────────────────────────────────────────────────
 * It cannot put 3-5 fighters on screen: this is a 1v1 game. That asymmetry against the
 * plates is real, is a design fact rather than a capture defect, and is reported rather
 * than papered over.
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * Every PNG goes through `captureSettled`, so each lands with a `.capture.json`
 * sidecar and `tools/review.mjs` can vouch for it. `enforce` is ON for the menu
 * screens (a mid-fade menu is exactly the defect that gate exists for) and OFF for
 * in-match frames — the match screen settles once and then never changes class, and a
 * throw mid-fight would discard a whole run — but the sidecar still records
 * `painted`, and review.mjs refuses anything with `painted:false` regardless.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/baseline_capture.mjs --url {URL} --out shots/baseline
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { settleScreen, captureSettled, describe, waitForRoster } from './settle.mjs';

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
const OUT = String(args.out ?? 'shots/baseline');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
/**
 * `player:enemy` pairs, comma separated. Several, because a single matchup gives one
 * weapon's VFX and one pair of silhouettes, and the fight can be over in four seconds
 * (hamburger vs sushi resolved 70 -> 5 HP in three samples on the first run).
 */
const MATCHUPS = String(args.matchups ?? 'hamburger:sushi').split(',').map((s) => {
  const [p, e] = s.split(':');
  return { player: p, enemy: e };
});
/**
 * wu. The band a frame must fall in to be a candidate.
 *
 * Both ends are load-bearing. Above ~140 no weapon reaches, so the pair is walking
 * toward a fight rather than in one. Below ~40 the two fighters INTERPENETRATE — the
 * first run captured a d=14 wu frame in which hamburger and sushi are one unreadable
 * blob with two floating HP pills stacked on top of each other. Neither end is
 * "action".
 */
const D_MIN = Number(args.dmin ?? 45);
const D_MAX = Number(args.dmax ?? 140);
/** ms. A VFX effect within this window of the shutter counts as "VFX live". */
const VFX_WINDOW = 700;
const WANT = Number(args.candidates ?? 10);

if (BASE.includes(':5173')) {
  console.error('\n!! --url is the SHARED dev server. Three agents are editing src/ — use tools/snapshot.mjs.\n');
}

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const QA_KEYS = ['cast', 'meleeArc', 'impact', 'death', 'heal', 'giantSlam', 'puddleSplash', 'coverScuff'];

function qaTotal(c) {
  if (!c) return 0;
  return QA_KEYS.reduce((s, k) => s + (c[k] ?? 0), 0);
}

/**
 * A mid-progression profile, written straight into `localStorage` before first paint.
 *
 * `docs/DECISIONS-FOR-URI.md` §6 flagged this and it was never done: every review packet
 * this project has shot was a FIRST-RUN profile — 0 trophies, 0 wins, 0 XP, empty bars —
 * against reference plates showing a played account (Brawl Stars at 30400 trophies and
 * 89/104 brawlers). A critic reads empty counters as an unshipped game, and it is the
 * same content-mismatch defect as scoring an idle frame against peak-action plates.
 *
 * Written as a raw blob rather than by driving the UI because `economy/state.ts`
 * `deserialize()` validates every field on the way in — unknown character ids, off-road
 * milestones and out-of-range levels are all dropped or clamped — so a hand-written blob
 * cannot put the app into a state the app itself could not reach.
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
    // addInitScript runs before ANY page script, so `main.ts`'s `new PlayerProfile()`
    // reads the seeded blob on its first construction — not after a repaint.
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

// ─────────────────────────────────────────────────────────────────────────────
// the match
// ─────────────────────────────────────────────────────────────────────────────

const READ = () => {
  const g = (sel) => document.querySelector(sel);
  const f = window.__vfxDebugFighters ?? null;
  const scr = window.__vfxDebugScreen ?? null;
  const zoneBar = g('[data-el="zone-bar"]');
  const countdown = g('[data-el="countdown"]');
  const gameover = g('[data-el="gameover"]');
  return {
    f, scr,
    radius01: zoneBar ? parseFloat(zoneBar.style.width) / 100 : null,
    countdown: countdown && countdown.style.display !== 'none' ? countdown.textContent : null,
    ended: !!gameover && gameover.style.display === 'flex',
    dmg: document.querySelectorAll('.hud-dmg').length,
    qa: window.__vfxQaCounts ? { ...window.__vfxQaCounts } : null,
    projectiles: (() => {
      try {
        const pool = window.__vfxLayer?.projectilePool;
        if (!pool) return null;
        // syncPool keeps a Map or array of live objects; both have a size/length.
        return pool.size ?? pool.length ?? null;
      } catch { return null; }
    })(),
  };
};

async function shootMatch(browser, PLAYER, ENEMY, tag) {
  const page = await newPage(browser);
  const q = new URLSearchParams({
    pointerLock: '0', player: PLAYER, enemy: ENEMY,
    // Anchor the player just EAST of the boiling pot (700,500,r=95), the arena's centre
    // feature, and let the AI walk in. Two reasons, both about matching the plates:
    // fighters normally spawn 1080 wu apart against a <=140 wu weapon reach, so the
    // first third of an undriven run is two dots approaching; and every Brawl Stars
    // top-down plate is a fight around a map feature, not a fight in an empty corner.
    // (860,500) is 160 wu from the pot centre — outside both its r=95 burn ring and its
    // r=73 CoverBox — and clear of every CoverBox in `tools/arena.gameplay.json`, which
    // matters because `movement.ts:tryMove` refuses every step out of an overlap and
    // that reads exactly like a dead keyboard (`match.ts:checkQaSpawn`).
    px: String(args.px ?? 860), py: String(args.py ?? 500),
  });
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await settleScreen(page, { label: 'match', timeout: 60_000 });

  const matchup = await page.evaluate(() => ({
    player: document.querySelector('[data-el="player-name"]')?.textContent ?? '?',
    enemy: document.querySelector('[data-el="enemy-name"]')?.textContent ?? '?',
  }));
  console.log(`   matchup: ${matchup.player} vs ${matchup.enemy}`);

  // Wait out the countdown.
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-el="countdown"]');
    return !c || c.style.display === 'none';
  }, null, { timeout: 120_000 });

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

  while (candidates.length < WANT && Date.now() - t0 < 420_000) {
    let r;
    try { r = await page.evaluate(READ); } catch { break; }
    if (!r?.f) { await page.waitForTimeout(100); continue; }
    if (r.ended) { console.log('   match ended before the burst was full'); break; }

    const now = Date.now();
    qaHist.push({ t: now, total: qaTotal(r.qa), qa: r.qa });
    while (qaHist.length > 1 && now - qaHist[0].t > VFX_WINDOW) qaHist.shift();
    const vfxDelta = qaTotal(r.qa) - (qaHist[0]?.total ?? qaTotal(r.qa));

    const p = r.f.player, e = r.f.enemy;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    const onScreen = (s) => s && s.x > 40 && s.x < W - 40 && s.y > 40 && s.y < H - 40;
    const bothOn = onScreen(r.scr?.player) && onScreen(r.scr?.enemy);

    // ── drive: hold the anchor, orbit the enemy, hold fire ──────────────────
    // HOLD rather than chase. The AI now reaches an idle player in 110 of 110 matchups
    // (`docs/STATE.md`), so waiting at the anchor is what puts the fight beside the pot
    // instead of wherever the two happened to meet.
    const ax = Number(args.px ?? 860), ay = Number(args.py ?? 500);
    const dAnchor = Math.hypot(p.x - ax, p.y - ay);
    const toward = (tx, ty) => [
      tx > p.x + 12 ? 1 : tx < p.x - 12 ? -1 : 0,
      ty > p.y + 12 ? 1 : ty < p.y - 12 ? -1 : 0,
    ];
    let mx; let my;
    if (dAnchor > 240) {
      [mx, my] = toward(ax, ay);
    } else if (d < D_MIN + 20) {
      [mx, my] = toward(p.x + (p.x - e.x), p.y + (p.y - e.y));   // back off
    } else if (d > D_MAX - 20) {
      [mx, my] = toward(e.x, e.y);
    } else {
      // Strafe perpendicular — a fighting pose, and it keeps the run animation alive
      // so the cast is not captured at rest.
      const sx = e.x > p.x ? 1 : -1, sy = e.y > p.y ? 1 : -1;
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
      const name = `match_${tag}_${String(n++).padStart(2, '0')}.png`;
      const res = await captureSettled(page, {
        path: `${OUT}/${name}`, label: `match action ${n}`, tool: 'baseline_capture',
        wait: false, enforce: false,
      });
      candidates.push({
        file: name, painted: res.painted, stats: res.stats,
        d: Math.round(d), dmg: r.dmg, vfxDelta, projectiles: r.projectiles,
        php: p.hp, ehp: e.hp, radius01: r.radius01,
        pScreen: r.scr?.player, eScreen: r.scr?.enemy,
        qa: r.qa,
      });
      console.log(`   cand ${name}  d=${Math.round(d)}wu  dmgNums=${r.dmg}  vfxΔ=${vfxDelta}`
        + `  proj=${r.projectiles ?? '-'}  hp ${p.hp}/${e.hp}  painted=${res.painted}`);
    }
    await page.waitForTimeout(70);
  }

  for (const k of held) await page.keyboard.up(k).catch(() => {});
  if (firing) await page.mouse.up().catch(() => {});
  await page.close();
  return { candidates, matchup };
}

// ─────────────────────────────────────────────────────────────────────────────
// the menus
// ─────────────────────────────────────────────────────────────────────────────

async function shootScreen(browser, { screen, file, label, roster = false }) {
  const page = await newPage(browser);
  await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(`window.__screen === "${screen}"`, null, { timeout: 120_000 });
  if (roster) {
    // Eleven portraits IN THE DOM, not `__thumbsReady` — see settle.mjs's note; a fixed
    // wait has captured emoji placeholders into a critic packet twice.
    const got = await waitForRoster(page, { timeout: 240_000 }).catch((e) => { console.log(`   roster: ${e.message}`); return null; });
    console.log(`   roster: ${JSON.stringify(got)}`);
  }
  const st = await settleScreen(page, { label, timeout: 90_000, soft: true });
  console.log(`   ${label}: ${describe(st)}`);
  const res = await captureSettled(page, {
    path: `${OUT}/${file}`, label, tool: 'baseline_capture', enforce: true, settleTimeout: 90_000,
  });
  console.log(`   ${file}  stdev ${res.stats.stdev}  painted=${res.painted}`);
  await page.close();
  return { file, stats: res.stats, painted: res.painted };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report = { base: BASE, viewport: [W, H], matchups: MATCHUPS, band: [D_MIN, D_MAX], runs: [] };

  for (const { player, enemy } of MATCHUPS) {
    console.log(`\n── match, mid-fight: ${player} vs ${enemy} ──`);
    const tag = `${player}_${enemy}`;
    // eslint-disable-next-line no-await-in-loop
    const m = await shootMatch(browser, player, enemy, tag);
    report.runs.push({ player, enemy, ...m });
  }

  if (args.menus !== '0') {
    console.log('\n── home ──');
    report.home = await shootScreen(browser, { screen: 'home', file: 'home.png', label: 'home' });

    console.log('\n── character select ──');
    report.select = await shootScreen(browser, { screen: 'characters', file: 'select.png', label: 'character select', roster: true });
  }

  writeFileSync(`${OUT}/capture-report.json`, JSON.stringify(report, null, 2));
  const total = report.runs.reduce((s, r) => s + r.candidates.length, 0);
  console.log(`\n${total} action candidates -> ${OUT}`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
