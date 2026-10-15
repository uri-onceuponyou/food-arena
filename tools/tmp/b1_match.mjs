#!/usr/bin/env node
/**
 * b1_match — the B1 package's BROWSER red/green (2026-10-15): one section per match-core bug,
 * every bug row written to be RED on `2b2e792` and GREEN on the fix, run against a served
 * snapshot of a tree (`sx_snap --root <tree>`), never the shared dev server.
 *
 *   §I ITEMS       Q, a tap, and a countdown press (items reach the sim; a press made under
 *                  the WAIT button does not fire at GO)                   [F1 META-01 B1 ML-2]
 *   §P POST-WHISTLE a shot in the air at the whistle must not land after it [BH-01 ML-1 B5]
 *   §E ESC-AFTER   Escape on the result card must not open the pause sheet  [META-06 ML-6]
 *   §T TELEGRAPH   a real `waterbottle.Mega` cast draws its wind-up; a stun tears it down  [B2]
 *   §H HIT-STOP    at SIX seats a far slam/hit/death freezes nothing and flashes nothing; near
 *                  ones still do                                                          [B3]
 *   §D DT          no single `stepMatch` call is handed more than one frame's own dt     [BH-13]
 *   §K KNOCKOUT    at SIX seats a knocked-out seat's place is banked at the knockout, Leave
 *                  cannot erase it, the whistle does not bank it twice, Leftovers defers it,
 *                  and Leave with a revive pending banks the place it forfeits       [META-02]
 *   §C CAMERA      the return to a revived local seat is a CUT, not a whip-pan            [ML-7]
 *   §R REVIVE      `item-revived` gets a beat (pulse + number); the POSE half is routed  [B4]
 *
 * ── HOW EACH ROW IS KNOWN TO BE ABLE TO FAIL ─────────────────────────────────
 * The HEAD run IS the planted bug for every bug row: the clean worktree of `2b2e792` must go
 * red on them and green on the fix. Two rows guard a CHOICE the fix made between two working
 * variants, so HEAD cannot falsify them; `--plant` rewrites the served module to the rejected
 * variant and those rows must go red:
 *   --plant countdown-hold  the routed `playing ? takeItemPress() : null` (holds a countdown
 *                           press and fires it at GO)                          → §I row 5 red
 *   --plant prox-floor      the "obvious" gate `shakeProximityScale(d) > floor`, true at every
 *                           distance by float (0.15000000000000002)            → §H far rows red
 *
 * ── TRAPS THIS FILE ALREADY PAID FOR (from the bh_* reproductions it borrows) ────────
 *   - Wait on the SIM clock, never the wall: SwiftShader on a loaded box runs this loop at
 *     ~1-3 fps, and a wall-clock window measures the renderer, not the game.
 *   - The live `MatchState` is reached by wrapping `MatchAudio.prototype.handleEvents` and
 *     `VfxLayer.prototype.sync` through the dev server's OWN module instances — they call
 *     straight through. Kills/stuns use the sim's own `combat.ts:applyDamage` on that state,
 *     and their events go through `window.__feelEvent`, which IS `GameSession.handleEvents`.
 *   - `page.evaluate` grants user activation; nothing here depends on activation (no audio
 *     unlock, no pointer lock), which is why it is used freely.
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-b1-head -- node tools/tmp/b1_match.mjs --url '{URL}' --label head
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-wp-b1 -- node tools/tmp/b1_match.mjs --url '{URL}' --label fix
 *   ... --sections I,H --plant countdown-hold   (one plant per run)
 *
 * Exit 0 iff every row passed. `--expect head` inverts nothing: it is read by a human. PNGs and
 * a JSON land in `--out` (default: a scratch dir under /tmp, never the repo).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const A = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (!k.startsWith('--')) continue;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; }
}
const BASE = String(A.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE || /:5173(\/|$)/.test(BASE)) { console.error('b1_match: --url must be a SNAPSHOT (sx_snap), never :5173'); process.exit(2); }
const LABEL = String(A.label ?? 'run');
const OUT = String(A.out ?? `/tmp/b1_match_${LABEL}`);
const SECTIONS = String(A.sections ?? 'I,P,E,T,H,D,K,C,R').split(',');
const PLANT = A.plant ? String(A.plant) : null;
mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const VITE_CLIENT_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';

/** The two rejected variants, as literal rewrites of the served source. Each must MATCH, or the
 *  plant run is void — a plant that silently did not apply would read as "the row held". */
const PLANTS = {
  'countdown-hold': {
    file: '**/src/game/match.ts*',
    from: /const itemPress = this\.input\.takeItemPress\(\);/,
    to: 'const itemPress = playing ? this.input.takeItemPress() : null;',
  },
  'prox-floor': {
    file: '**/src/game/match.ts*',
    from: /return onAnyScreen\(Math\.hypot\(xWU - me\.x, yWU - me\.y\), this\.shakeFadeUnits\);/,
    to: 'return shakeProximityScale(Math.hypot(xWU - me.x, yWU - me.y), this.shakeFadeUnits) > 0.15;',
  },
};
if (PLANT && !PLANTS[PLANT]) { console.error(`unknown --plant ${PLANT}`); process.exit(2); }

const rows = [];
const results = { base: BASE, label: LABEL, plant: PLANT, at: new Date().toISOString(), sections: {} };
function row(sec, name, pass, detail) {
  rows.push({ sec, name, pass: pass === null ? null : !!pass, detail });
  const d = detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`${pass === null ? 'INFO' : pass ? 'PASS' : 'FAIL'}  §${sec} ${name}${d.length > 900 ? `${d.slice(0, 900)}…` : d}`);
}

const SEED_TROPHIES = 1500;
const SEED_PROFILE = {
  name: 'B1PROBE', wins: 4, losses: 2, xp: 260, selected: 'hamburger',
  economy: {
    trophies: SEED_TROPHIES, bestTrophies: SEED_TROPHIES, coins: 880, gems: 15,
    containers: { chest: 0, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], items: ['springform'], winsTowardChest: 1,
    lastMatch: null, levels: {}, seed: 424242, rolls: 0,
  },
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
let plantHits = 0;

async function open({ profile = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((p) => {
    if (p && !localStorage.getItem('food-arena.profile.v1')) localStorage.setItem('food-arena.profile.v1', JSON.stringify(p));
  }, profile);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: VITE_CLIENT_STUB }));
  if (PLANT) {
    const P = PLANTS[PLANT];
    await page.route(P.file, async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      if (P.from.test(body)) { body = body.replace(P.from, P.to); plantHits++; }
      await route.fulfill({ response: res, body });
    });
  }
  return { ctx, page, errors };
}
const wait = (page, fn, arg, ms = 600_000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
async function boot(page, query, phase = 'playing') {
  await page.goto(`${BASE}/?screen=match&pointerLock=0&${query}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await wait(page, () => window.__gameReady === true, null, 300_000);
  await wait(page, (ph) => window.__matchDebug?.phase === ph, phase, 300_000);
}

/** The live MatchState as `__b1State`, the VfxLayer as `__b1Vfx`, and one feel record per
 *  STEPPED frame in `__b1Frames` (pushed from inside `sync`, which the loop calls once per
 *  stepping frame after every slice and every event consumer). */
async function hookState(page) {
  await page.evaluate(async () => {
    const dir = await import('/src/audio/director.ts');
    const vfx = await import('/src/game/vfx.ts');
    const a = dir.MatchAudio.prototype;
    if (!a.handleEvents.__b1) {
      const orig = a.handleEvents;
      const f = function (...args) { window.__b1State = args[1]; return orig.apply(this, args); };
      f.__b1 = true; a.handleEvents = f;
    }
    const v = vfx.VfxLayer.prototype;
    if (!v.sync.__b1) {
      const orig = v.sync;
      const f = function (...args) {
        window.__b1State = args[0];
        window.__b1Vfx = this;
        const fd = window.__feelDebug;
        if (fd && window.__b1Rec) {
          const fr = (window.__b1Frames ??= []);
          fr.push({ raw: fd.rawDtMs, step: fd.stepDtMs, calls: fd.stepCalls, maxCall: fd.maxStepCallMs,
            phase: window.__matchDebug?.phase });
          if (fr.length > 400) fr.shift();
        }
        return orig.apply(this, args);
      };
      f.__b1 = true; v.sync = f;
    }
  });
  await wait(page, () => !!window.__b1State && Array.isArray(window.__b1State.fighters), null, 120_000);
}
const simWait = async (page, ms) => {
  const s0 = await page.evaluate(() => window.__b1State.elapsed);
  await wait(page, (a) => window.__b1State.elapsed - a.s0 > a.ms, { s0, ms });
};
const framesWait = async (page, n) => {
  const f0 = await page.evaluate(() => window.__feelDebug.frames);
  await wait(page, (a) => window.__feelDebug.frames - a.f0 >= a.n, { f0, n });
};
const readProfile = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('food-arena.profile.v1');
  if (!raw) return null;
  const p = JSON.parse(raw);
  const e = p.economy ?? {};
  return { trophies: e.trophies, coins: e.coins, losses: p.losses, wins: p.wins, xp: p.xp,
    lastPlace: e.lastMatch?.place ?? null, lastSeats: e.lastMatch?.seats ?? null };
});
/** Kill `victim` with `killer`'s first real weapon (a real key, so `killedBy` resolves) and
 *  route every event through the shipped handler. Returns the event types. */
const kill = (page, victim, killer) => page.evaluate(async ({ victim, killer }) => {
  const combat = await import('/src/game/combat.ts');
  const rules = await import('/src/game/rules.ts');
  const st = window.__b1State;
  const w = rules.CHARACTERS[st.fighters[killer].characterId].weapons[0];
  const evs = [];
  combat.applyDamage(st, st.fighters[victim], 9999, null, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: killer }, evs);
  for (const ev of evs) window.__feelEvent(ev);
  return evs.map((e) => e.type);
}, { victim, killer });

try {
  // A fresh snapshot's FIRST client eats Vite's dep-optimisation reload: warm it.
  { const { ctx, page } = await open(); await page.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 180_000 }).catch(() => {}); await page.waitForTimeout(4000); await ctx.close(); }

  // ── §I ITEMS ───────────────────────────────────────────────────────────────────
  if (SECTIONS.includes('I')) {
    const { ctx, page, errors } = await open();
    try {
      // simSpeed 0.5: the countdown is 3 s of SIM, and the press has to land with >= 1 s of it
      // left after the boot and the hook — at SwiftShader frame rates that is the margin.
      await boot(page, 'player=hamburger&enemy=donut&items=springform,warm_milk&simSpeed=0.5', 'countdown');
      await hookState(page);
      const slots = () => page.evaluate(() => [...document.querySelectorAll('.hud-item-slot')]
        .map((n) => ({ cls: n.className.replace('hud-item-slot', '').trim(), badge: n.querySelector('.hud-item-badge')?.textContent ?? '' })));
      const lastUsed = () => page.evaluate(() => window.__b1State.fighters[0].item.lastUsed.map((v) => (Number.isFinite(v) ? v : null)));
      const fired = (s) => /is-cooling|is-winding/.test(s?.cls ?? '');
      // The countdown press: made while the countdown has >= 1 s to run, so the very next frame
      // (<= 50 ms of sim) collects it while the phase is still 'countdown'.
      await wait(page, () => window.__b1State.phase === 'countdown' && window.__b1State.countdownValue >= 2, null, 120_000);
      const atPress = await page.evaluate(() => ({ phase: window.__b1State.phase, value: window.__b1State.countdownValue }));
      await page.keyboard.press('KeyQ');
      await wait(page, () => window.__b1State.phase === 'playing');
      await simWait(page, 1500);
      const afterGo = { slots: await slots(), lastUsed: await lastUsed() };
      row('I', 'NON-VACUITY: the countdown press was made during the countdown, and both slots are drawn', atPress.phase === 'countdown' && afterGo.slots.length === 2, { atPress });
      // CONTROL: an unbound key, the same sim window.
      await page.keyboard.press('KeyP');
      await simWait(page, 1500);
      const ctl = await slots();
      row('I', 'CONTROL: an unbound key leaves both slots READY', ctl.every((s) => /is-ready/.test(s.cls)), ctl);
      await page.keyboard.press('KeyQ');
      await simWait(page, 1500);
      const afterQ = { slots: await slots(), lastUsed: await lastUsed() };
      const btn = await page.$$('.hud-item-slot');
      if (btn[1]) await btn[1].dispatchEvent('pointerdown');
      await simWait(page, 1500);
      const afterTap = { slots: await slots(), lastUsed: await lastUsed() };
      await shot(page, `I_after_presses_${LABEL}`);
      row('I', 'BUG F1: Q on a READY slot fires it (sim stamps the cooldown, button leaves READY)', fired(afterQ.slots[0]) && afterQ.lastUsed[0] !== null, afterQ);
      row('I', 'BUG F1: a press on the slot-1 BUTTON fires slot 1', fired(afterTap.slots[1]) && afterTap.lastUsed[1] !== null, afterTap);
      row('I', 'a Q pressed under the countdown\'s WAIT did NOT fire at GO (1.5 s of play later the slot was still READY)',
        /is-ready/.test(afterGo.slots[0]?.cls ?? '') && afterGo.lastUsed[0] === null, afterGo);
      row('I', 'page errors', errors.length === 0, errors);
      results.sections.I = { atPress, afterGo, ctl, afterQ, afterTap, errors };
    } catch (e) { row('I', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §P POST-WHISTLE ──────────────────────────────────────────────────────────────
  if (SECTIONS.includes('P')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, 'player=hamburger&enemy=taco&simSpeed=0.5');
      await hookState(page);
      // bh_match_browser §P's plant: taco 100 wu west of the player fires `Filling` (ranged, 12
      // dmg) at it; the player is set to 3 HP; then the player's Smash kills taco — the whistle,
      // through the sim's own victor block — with that shot still in the air.
      const plant = await page.evaluate(async () => {
        const combat = await import('/src/game/combat.ts');
        const st = window.__b1State;
        const a = st.fighters[0]; const b = st.fighters[1];
        b.x = a.x - 100; b.y = a.y; b.facing = { x: 1, y: 0 };
        const wi = 2; b.lastUsed[wi] = -1e9;
        const evs = [];
        const firedShot = combat.attemptAttack(st, b, wi, evs);
        for (const ev of evs) window.__feelEvent(ev);
        const inFlight = st.projectiles.length;
        a.hp = 3;
        const evs2 = [];
        combat.applyDamage(st, b, 9999, null, { kind: 'weapon', weaponKey: 'Smash', weaponName: 'Smash', attackerId: 0 }, evs2);
        for (const ev of evs2) window.__feelEvent(ev);
        return { firedShot, inFlight, phase: st.phase, winnerId: st.winnerId, hp0: a.hp, at: st.elapsed };
      });
      row('P', 'NON-VACUITY: a shot is in the air at the whistle and the match is decided for the local seat',
        plant.inFlight > 0 && plant.phase === 'ended' && plant.winnerId === 0, plant);
      // Two frames: the first frame after the whistle must retire it before stepping.
      await framesWait(page, 2);
      const afterTwo = await page.evaluate(() => ({ shots: window.__b1State.projectiles.length, phase: window.__b1State.phase }));
      // Then 1.5 s of SIM — the planted shot lands ~400 ms of sim after the whistle on HEAD.
      await simWait(page, 1500);
      const later = await page.evaluate(() => ({
        alive0: window.__b1State.fighters[0].alive, hp0: window.__b1State.fighters[0].hp, elapsed: window.__b1State.elapsed,
        shots: window.__b1State.projectiles.length, phase: window.__b1State.phase,
        title: document.querySelector('[data-el="gameover-title"]')?.textContent ?? null,
      }));
      await shot(page, `P_after_whistle_${LABEL}`);
      row('P', 'BUG BH-01: the declared winner takes NO damage after the whistle (still 3 HP, alive)', later.alive0 === true && later.hp0 === plant.hp0, later);
      row('P', 'the shots in the air at the whistle are gone within two frames of it', afterTwo.shots === 0, afterTwo);
      row('P', 'the sim is still stepped under the card (the clock runs; the fix is not a freeze-frame)', later.elapsed - plant.at > 1000 && later.phase === 'ended', later);
      row('P', 'page errors', errors.length === 0, errors);
      results.sections.P = { plant, afterTwo, later, errors };
    } catch (e) { row('P', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §E ESCAPE AFTER THE WHISTLE ──────────────────────────────────────────────────
  if (SECTIONS.includes('E')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, 'player=pizza&enemy=egg&fogRadius=0');
      const sheetOpen = () => page.evaluate(() => document.querySelector('.match-sheet')?.classList.contains('is-open') ?? false);
      // CONTROL while live: Escape opens it, Escape closes it.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const liveOpen = await sheetOpen();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const liveClosed = !(await sheetOpen());
      row('E', 'CONTROL: during play Escape opens the pause sheet and Escape closes it', liveOpen && liveClosed, { liveOpen, liveClosed });
      await wait(page, () => window.__matchDebug?.phase === 'ended');
      await page.waitForTimeout(1500);
      const card = await page.evaluate(() => document.querySelector('[data-el="gameover-title"]')?.textContent ?? null);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const after = { open: await sheetOpen(), paused: await page.evaluate(() => window.__matchDebug?.paused) };
      await shot(page, `E_escape_on_card_${LABEL}`);
      row('E', 'NON-VACUITY: the match is decided and the card is up', !!card, card);
      row('E', 'BUG META-06: Escape on the result card does NOT open the pause sheet', after.open === false && after.paused === false, after);
      row('E', 'page errors', errors.length === 0, errors);
      results.sections.E = { liveOpen, liveClosed, card, after, errors };
    } catch (e) { row('E', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §T TELEGRAPH ─────────────────────────────────────────────────────────────────
  if (SECTIONS.includes('T')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, 'player=waterbottle&enemy=hamburger&simSpeed=1');
      await hookState(page);
      const read = () => page.evaluate(() => ({
        tg: window.__vfxQaCounts?.castTelegraph ?? 0,
        live: window.__b1Vfx?.castTelegraphs?.has?.(0) ?? null,
        cast: window.__b1State.fighters[0].cast ? { key: window.__b1State.fighters[0].cast.weaponKey ?? null } : null,
        fired: window.__feelDebug?.events?.['weapon-fired'] ?? 0,
        started: window.__feelDebug?.events?.['cast-started'] ?? null,
      }));
      const castMega = async () => {
        await page.keyboard.press('Digit4');
        await page.waitForTimeout(300);
        const box = await page.locator('canvas').first().boundingBox();
        await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
        await page.mouse.down();
        await wait(page, () => window.__b1State.fighters[0].cast !== null, null, 120_000).catch(() => {});
        await page.mouse.up();
      };
      const before = await read();
      await castMega();
      const mid = await read();
      await shot(page, `T_midwindup_${LABEL}`);
      row('T', 'NON-VACUITY: the real press opened a wind-up on the sim (caster has a `cast`)', mid.cast !== null, mid);
      row('T', 'BUG B2: the real `cast-started` drew a telegraph (QA counter +1 and a live entry for the caster)',
        mid.tg - before.tg === 1 && mid.live === true, { before, mid });
      // The resolve, then a SECOND cast interrupted by a stun — after Mega's cooldown, waited
      // out on the SIM clock off the weapon's own number rather than a guessed CSS class.
      await wait(page, () => window.__b1State.fighters[0].cast === null, null, 300_000).catch(() => {});
      const coolMs = await page.evaluate(async () => {
        const rules = await import('/src/game/rules.ts');
        return rules.CHARACTERS.waterbottle.weapons.find((w) => w.key === 'Mega').cooldown;
      });
      await simWait(page, coolMs + 300);
      await castMega();
      const mid2 = await read();
      const stun = await page.evaluate(async () => {
        const combat = await import('/src/game/combat.ts');
        const rules = await import('/src/game/rules.ts');
        const st = window.__b1State;
        const w = rules.CHARACTERS[st.fighters[1].characterId].weapons[0];
        const evs = [];
        combat.applyDamage(st, st.fighters[0], 1, 'stun', { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: 1 }, evs);
        for (const ev of evs) window.__feelEvent(ev);
        return evs.map((e) => (e.type === 'cast-cancelled' ? `cast-cancelled:${e.reason}` : e.type));
      });
      const afterStun = await read();
      row('T', 'NON-VACUITY: the second wind-up was live and the stun cancelled it in the sim', mid2.live === true && stun.includes('cast-cancelled:stun'), { mid2, stun });
      row('T', 'BUG B2: `cast-cancelled` tears the telegraph down at once (no live entry for the caster)', afterStun.live === false, afterStun);
      row('T', 'page errors', errors.length === 0, errors);
      results.sections.T = { before, mid, mid2, stun, afterStun, errors };
    } catch (e) { row('T', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §H HIT-STOP + FLASH GATING, SIX SEATS ────────────────────────────────────────
  if (SECTIONS.includes('H')) {
    const { ctx, page, errors } = await open();
    try {
      // Slot 0 at the west; slot 1 a lollipop ~2,230 wu away (off every screen); slot 2 a
      // lollipop 120 wu away (inside the 199 wu disc every screen shows); 3-5 far.
      await boot(page, 'fighters=hamburger@300,810;lollipop@2500,1190;lollipop@420,810;donut@2670,290;taco@2400,330;egg@2550,1700&simSpeed=1');
      await hookState(page);
      const seats = await page.evaluate(() => window.__b1State.fighters.map((f) => ({ id: f.id, c: f.characterId, x: f.x, y: f.y })));
      const d = (i) => Math.hypot(seats[i].x - seats[0].x, seats[i].y - seats[0].y);
      row('H', 'NON-VACUITY: six seats; slot 1 is beyond the 510 wu fade radius, slot 2 inside the 199 wu disc',
        seats.length === 6 && d(1) > 600 && d(2) < 199, seats.map((s, i) => `${s.c}@${Math.round(d(i))}wu`).join(' '));
      const fire = (ev) => page.evaluate((e) => {
        const f = window.__feelDebug;
        const b = { hs: f.responses.hitStop, fl: f.responses.screenFlash };
        window.__feelEvent(e);
        return { hitStop: f.responses.hitStop - b.hs, flash: f.responses.screenFlash - b.fl };
      }, ev);
      const weaponOf = (i) => page.evaluate(async (i) => {
        const rules = await import('/src/game/rules.ts');
        const w = rules.CHARACTERS[window.__b1State.fighters[i].characterId].weapons[0];
        return { key: w.key, name: w.name };
      }, i);
      const farSlam = await fire({ type: 'weapon-fired', fighterRole: 'enemy', fighterId: 1, weaponKey: 'Giant' });
      const nearSlam = await fire({ type: 'weapon-fired', fighterRole: 'enemy', fighterId: 2, weaponKey: 'Giant' });
      const w3 = await weaponOf(3);
      const hit = (target) => ({ type: 'hit-landed', targetRole: target === 0 ? 'player' : 'enemy', targetId: target, amount: 12, x: seats[target].x, y: seats[target].y,
        source: { kind: 'weapon', weaponKey: w3.key, weaponName: w3.name, attackerId: 3 } });
      const farHit = await fire(hit(1));
      const nearHit = await fire(hit(2));
      const youHit = await fire(hit(0));
      const farDeath = await fire({ type: 'death', fighterRole: 'enemy', fighterId: 3 });
      const nearDeath = await fire({ type: 'death', fighterRole: 'enemy', fighterId: 2 });
      await shot(page, `H_after_${LABEL}`);
      row('H', 'BUG B3: a giant slam OFF every screen neither flashes the frame nor freezes the sim', farSlam.flash === 0 && farSlam.hitStop === 0, farSlam);
      row('H', 'CONTROL: a giant slam 120 wu away still flashes AND freezes', nearSlam.flash === 1 && nearSlam.hitStop === 1, nearSlam);
      row('H', 'BUG B3: a weapon hit off every screen does not freeze the sim', farHit.hitStop === 0, farHit);
      row('H', 'CONTROL: a weapon hit 120 wu away still freezes', nearHit.hitStop === 1, nearHit);
      row('H', 'CONTROL: a weapon hit ON the local seat still freezes', youHit.hitStop === 1, youHit);
      row('H', 'BUG B3: a death off every screen does not freeze the sim', farDeath.hitStop === 0, farDeath);
      row('H', 'CONTROL: a death 120 wu away still freezes', nearDeath.hitStop === 1, nearDeath);
      row('H', 'page errors', errors.length === 0, errors);
      results.sections.H = { seats, farSlam, nearSlam, farHit, nearHit, youHit, farDeath, nearDeath, errors };
    } catch (e) { row('H', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §D DT PER STEP CALL ──────────────────────────────────────────────────────────
  if (SECTIONS.includes('D')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, 'player=hamburger&enemy=donut&simSpeed=1');
      await hookState(page);
      await page.evaluate(() => { window.__b1Frames = []; window.__b1Rec = true; });
      // The biggest weapon freeze there is: an 18-damage hit on the local seat (92.8 ms).
      await page.evaluate(async () => {
        const rules = await import('/src/game/rules.ts');
        const st = window.__b1State;
        const w = rules.CHARACTERS[st.fighters[1].characterId].weapons[0];
        window.__feelEvent({ type: 'hit-landed', targetRole: 'player', targetId: 0, amount: 18, x: st.fighters[0].x, y: st.fighters[0].y,
          source: { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: 1 } });
      });
      await framesWait(page, 30);
      const frames = await page.evaluate(() => { window.__b1Rec = false; return window.__b1Frames.slice(); });
      const perCall = (f) => (typeof f.maxCall === 'number' && typeof f.calls === 'number' ? f.maxCall : f.step);
      const repaying = frames.filter((f) => f.step > f.raw * 1.05);
      const worst = frames.reduce((m, f) => Math.max(m, f.raw > 0 ? perCall(f) / f.raw : 0), 0);
      row('D', 'NON-VACUITY: the freeze was repaid (frames stepping more than their own dt were recorded)', repaying.length > 0,
        { frames: frames.length, repaying: repaying.slice(0, 4) });
      row('D', 'BUG BH-13: no single `stepMatch` call was handed more than its frame\'s own dt (ratio <= 1)',
        repaying.length > 0 && worst <= 1.000001, { worstRatio: Number(worst.toFixed(4)), sample: repaying.slice(0, 4) });
      row('D', 'page errors', errors.length === 0, errors);
      results.sections.D = { frames, worst, errors };
    } catch (e) { row('D', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §K KNOCKOUT AT SIX SEATS ─────────────────────────────────────────────────────
  if (SECTIONS.includes('K')) {
    const banked = (p) => p && p.lastSeats === 6;
    // K1 — knocked out 6th, then Leave.
    {
      const { ctx, page, errors } = await open({ profile: SEED_PROFILE });
      try {
        await boot(page, 'player=hamburger&enemy=donut&seats=6&simSpeed=1');
        await hookState(page);
        const p0 = await readProfile(page);
        row('K', 'K1 NON-VACUITY: six seats, the seeded profile is the one the app holds', p0?.trophies === SEED_TROPHIES
          && (await page.evaluate(() => window.__b1State.fighters.length)) === 6, p0);
        await kill(page, 0, 1);
        const st = await page.evaluate(() => ({ alive0: window.__b1State.fighters[0].alive, phase: window.__b1State.phase }));
        row('K', 'K1 NON-VACUITY: the local seat is knocked out and the match is still PLAYING', st.alive0 === false && st.phase === 'playing', st);
        await framesWait(page, 4);
        const pKo = await readProfile(page);
        row('K', 'BUG META-02: the 6th place is BANKED at the knockout, before any Leave', banked(pKo) && pKo.lastPlace === 5
          && pKo.losses === SEED_PROFILE.losses + 1, { before: p0, after: pKo });
        await page.click('.fa-match .match-chip', { force: true });
        await wait(page, () => document.querySelector('.match-sheet')?.classList.contains('is-open') === true, null, 60_000);
        await page.click('[data-el="quit"]', { force: true });
        await wait(page, () => document.querySelector('[data-el="leave"]')?.disabled === false, null, 60_000);
        const confirm = await page.evaluate(() => ({ body: document.querySelector('[data-el="confirmbody"]')?.textContent ?? '',
          keep: document.querySelector('[data-el="keep"]')?.textContent?.trim() ?? '' }));
        // `fa-sheet-in` is a 0.2 s entry animation; under SwiftShader the first cut of this
        // shot caught the dimmed backdrop with no card on it. The DOM was right; the picture
        // was not, so it waits for the animation before photographing.
        await page.waitForFunction(() => document.querySelector('.match-sheet-card')?.getAnimations().every((a) => a.playState === 'finished') ?? true, null, { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(500);
        await shot(page, `K1_confirm_${LABEL}`);
        row('K', 'the confirm tells a knocked-out player the truth (already banked), not "no trophies, coins or XP"',
          /already banked/.test(confirm.body) && !/no trophies/.test(confirm.body), confirm);
        await page.click('[data-el="leave"]', { force: true });
        await wait(page, () => window.__screen === 'home', null, 120_000);
        const pLeave = await readProfile(page);
        row('K', 'Leave neither un-banks nor banks again', JSON.stringify(pLeave) === JSON.stringify(pKo), { pKo, pLeave });
        row('K', 'K1 page errors', errors.length === 0, errors);
        results.sections.K1 = { p0, st, pKo, confirm, pLeave, errors };
      } catch (e) { row('K', 'K1 completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    // K2 — knocked out 6th, wait for the whistle: one bank, and the card says the same thing.
    {
      const { ctx, page, errors } = await open({ profile: SEED_PROFILE });
      try {
        await boot(page, 'player=hamburger&enemy=donut&seats=6&simSpeed=1');
        await hookState(page);
        await kill(page, 0, 1);
        await framesWait(page, 4);
        const pKo = await readProfile(page);
        for (const v of [1, 2, 3, 4]) { await kill(page, v, 5); }
        await wait(page, () => window.__matchDebug?.phase === 'ended', null, 300_000);
        await page.waitForTimeout(1500);
        const card = await page.evaluate(() => ({
          place: document.querySelector('[data-el="gameover-place"]')?.textContent ?? null,
          payout: document.querySelector('[data-el="gameover-payout"]')?.innerText?.replace(/\s+/g, ' ') ?? null,
        }));
        const pEnd = await readProfile(page);
        await shot(page, `K2_card_${LABEL}`);
        row('K', 'BUG META-02: K2 banked at the knockout (before the whistle)', banked(pKo) && pKo.lastPlace === 5, pKo);
        row('K', 'the whistle does NOT bank a second time (profile identical to the knockout bank)', banked(pEnd) && JSON.stringify(pEnd) === JSON.stringify(pKo), { pKo, pEnd });
        const dT = (pEnd?.trophies ?? 0) - SEED_TROPHIES;
        row('K', 'the card shows 6th of 6 and the payout that was banked', /6th of 6/.test(card.place ?? '') && (card.payout ?? '').includes(String(dT)),
          { card, trophyDelta: dT });
        row('K', 'K2 page errors', errors.length === 0, errors);
        results.sections.K2 = { pKo, card, pEnd, errors };
      } catch (e) { row('K', 'K2 completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    // K3 — Leftovers: no bank while the revive is pending; bank once it can no longer fire.
    {
      const { ctx, page, errors } = await open({ profile: SEED_PROFILE });
      try {
        await boot(page, 'player=hamburger&enemy=donut&seats=6&items=leftovers&simSpeed=1');
        await hookState(page);
        const lo = await page.evaluate(() => window.__matchDebug.loadouts[0]);
        await kill(page, 0, 1);
        await framesWait(page, 4);
        const pPending = await readProfile(page);
        const evs = await kill(page, 1, 2);
        await framesWait(page, 4);
        const revived = await page.evaluate(() => window.__b1State.fighters[0].alive);
        const pRevived = await readProfile(page);
        await kill(page, 0, 3);
        await framesWait(page, 4);
        const pFinal = await readProfile(page);
        row('K', 'K3 NON-VACUITY: the local seat carries Leftovers and the kill chain revived it', lo.includes('leftovers') && evs.includes('item-revived') && revived === true, { lo, evs });
        row('K', 'a knockout with the revive still PENDING banks nothing (the place is not final yet)', !banked(pPending), pPending);
        row('K', '…nor while the revived fighter is back on its feet', !banked(pRevived), pRevived);
        row('K', 'BUG META-02: the second knockout (no revive left) banks — 5th of 6 by reverse elimination order',
          banked(pFinal) && pFinal.lastPlace === 4, pFinal);
        row('K', 'K3 page errors', errors.length === 0, errors);
        results.sections.K3 = { lo, evs, pPending, revived, pRevived, pFinal, errors };
      } catch (e) { row('K', 'K3 completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    // K4 — Leftovers pending, then Leave: leaving forfeits the revive and banks the place.
    {
      const { ctx, page, errors } = await open({ profile: SEED_PROFILE });
      try {
        await boot(page, 'player=hamburger&enemy=donut&seats=6&items=leftovers&simSpeed=1');
        await hookState(page);
        await kill(page, 0, 1);
        await framesWait(page, 4);
        const pPending = await readProfile(page);
        await page.click('.fa-match .match-chip', { force: true });
        await wait(page, () => document.querySelector('.match-sheet')?.classList.contains('is-open') === true, null, 60_000);
        await page.click('[data-el="quit"]', { force: true });
        await wait(page, () => document.querySelector('[data-el="leave"]')?.disabled === false, null, 60_000);
        const confirm = await page.evaluate(() => document.querySelector('[data-el="confirmbody"]')?.textContent ?? '');
        await page.click('[data-el="leave"]', { force: true });
        await wait(page, () => window.__screen === 'home', null, 120_000);
        const pLeave = await readProfile(page);
        row('K', 'K4 NON-VACUITY: nothing banked while the revive was pending', !banked(pPending), pPending);
        row('K', 'BUG META-02 (Leftovers): Leave with the revive pending banks the 6th place it forfeits', banked(pLeave) && pLeave.lastPlace === 5, { confirm, pLeave });
        row('K', 'K4 page errors', errors.length === 0, errors);
        results.sections.K4 = { pPending, confirm, pLeave, errors };
      } catch (e) { row('K', 'K4 completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }

  // ── §C THE CAMERA COMING BACK TO A REVIVED LOCAL SEAT ────────────────────────────
  if (SECTIONS.includes('C')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, 'seats=4&player=hamburger&enemy=donut&items=leftovers');
      await hookState(page);
      await kill(page, 0, 1);
      await wait(page, () => ['killer', 'nearest', 'hold'].includes(window.__matchDebug?.viewReason), null, 900_000);
      // Let the follow settle on the killer so the camera is genuinely far from the body.
      await framesWait(page, 30);
      const sample = () => page.evaluate(() => ({ f: window.__feelDebug?.frames, view: window.__matchDebug?.viewReason,
        pt: window.__vfxDebugScreen?.slots?.[0] ?? null, w: innerWidth, h: innerHeight }));
      const away = await sample();
      const sep = await page.evaluate(() => {
        const s = window.__b1State.fighters;
        return Math.round(Math.hypot(s[0].x - s[1].x, s[0].y - s[1].y));
      });
      const evs = await kill(page, 1, 2);
      const back = [];
      const t0 = Date.now(); let lastF = -1;
      while (Date.now() - t0 < 60_000 && back.length < 10) {
        const s = await sample();
        if (s.f !== lastF) { back.push(s); lastF = s.f; }
        await page.waitForTimeout(15);
      }
      const near = (s) => s.pt && Math.hypot(s.pt.x - s.w / 2, s.pt.y - s.h / 2) < 0.15 * s.h;
      const i0 = back.findIndex((s) => s.view === 'local');
      const framesToCentre = i0 < 0 ? null : (() => { const k = back.findIndex((s, j) => j >= i0 && near(s)); return k < 0 ? null : back[k].f - back[i0].f; })();
      row('C', 'NON-VACUITY: the camera had handed off away from the body, and the revive happened far away', away.view !== 'local' && evs.includes('item-revived') && sep > 600, { away, sep, evs });
      row('C', 'BUG ML-7: the return to the revived local seat is a CUT (centred on the first local frame)', framesToCentre === 0, { framesToCentre, back: back.slice(0, 8) });
      row('C', 'page errors', errors.length === 0, errors);
      results.sections.C = { away, sep, framesToCentre, back, errors };
    } catch (e) { row('C', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §R THE REVIVE BEAT (+ the pose, routed) ──────────────────────────────────────
  if (SECTIONS.includes('R')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, 'seats=4&player=hamburger&enemy=donut&items=leftovers');
      await hookState(page);
      await kill(page, 0, 1);
      const r = await page.evaluate(async () => {
        const combat = await import('/src/game/combat.ts');
        const rules = await import('/src/game/rules.ts');
        const st = window.__b1State;
        const w = rules.CHARACTERS[st.fighters[2].characterId].weapons[0];
        const evs = [];
        combat.applyDamage(st, st.fighters[1], 9999, null, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: 2 }, evs);
        const f = window.__feelDebug;
        let beat = null;
        for (const ev of evs) {
          const b = { vfx: f.responses.vfx, num: f.responses.damageNumber };
          window.__feelEvent(ev);
          if (ev.type === 'item-revived') beat = { vfx: f.responses.vfx - b.vfx, num: f.responses.damageNumber - b.num };
        }
        return { types: evs.map((e) => e.type), beat, alive0: st.fighters[0].alive };
      });
      row('R', 'NON-VACUITY: the real kill chain revived the local seat', r.alive0 === true && r.types.includes('item-revived'), r);
      row('R', 'BUG B4 (match.ts half): `item-revived` gets a visible beat — a pulse and a number', r.beat?.vfx === 1 && r.beat?.num === 1, r.beat);
      await framesWait(page, 30);
      row('R', 'INFO: the POSE half (BaseCharacter.deathT is never reset) is ROUTED to the characters owner — this tree still draws the topple', null);
      await shot(page, `R_revived_${LABEL}`);
      row('R', 'page errors', errors.length === 0, errors);
      results.sections.R = { r, errors };
    } catch (e) { row('R', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }
} finally {
  results.rows = rows;
  results.plantHits = plantHits;
  writeFileSync(`${OUT}/b1_match_${LABEL}.json`, JSON.stringify(results, null, 1));
  await browser.close();
}

const failed = rows.filter((r) => r.pass === false);
if (PLANT) console.log(`\nplant "${PLANT}" applied to ${plantHits} served module(s)${plantHits === 0 ? ' — VOID: the plant did not match, nothing below means anything' : ''}`);
console.log(`\n${rows.filter((r) => r.pass === true).length} passed, ${failed.length} failed (${LABEL}${PLANT ? `, plant ${PLANT}` : ''})`);
process.exit(failed.length === 0 && (!PLANT || plantHits > 0) ? 0 : 1);
