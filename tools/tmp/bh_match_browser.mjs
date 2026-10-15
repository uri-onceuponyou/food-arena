#!/usr/bin/env node
/**
 * bh_match_browser — the match-lifecycle bug hunt's BROWSER half (review phase, 2026-10-15).
 *
 * Every section drives the SHIPPED page through a served snapshot (`sx_snap --root <tree>`),
 * and every section reads an OBSERVABLE a player has (the result card, the pause sheet, the
 * screen that is mounted, the stored profile, the pixels) — plus the shipped QA mirrors
 * (`__matchDebug`, `__feelDebug`, `__plockDebug`) where a pixel cannot say it.
 *
 * ⚠️ Two sections PLANT a state with the sim's own functions (`combat.ts:attemptAttack` /
 * `applyDamage`, imported from the dev server, i.e. the SAME module instance the game runs)
 * on the live `MatchState`, reached by wrapping `MatchAudio.prototype.handleEvents` — the
 * shipped loop hands it `this.state` every frame. Nothing in the tree is modified; the
 * wrapper calls straight through. The resulting events are routed through the shipped QA hook
 * `window.__feelEvent`, which is `GameSession.handleEvents`. Everything after the plant is
 * the shipped `GameSession.loop`, unassisted.
 *
 *   §P POST-WHISTLE  a projectile in flight when the match is decided keeps flying under the
 *                    shipped loop and kills the declared winner behind the VICTORY card.
 *                    Control arm (`clear`): same plant, projectiles emptied at the whistle.
 *   §R REVIVE POSE   a Leftovers resurrection (real kill chain, real `reviveThoseKilledBy`)
 *                    leaves the local fighter's model in the death topple while it walks.
 *   §E ESC-AFTER-END Escape on the result card opens the PAUSE sheet; its confirm says the
 *                    match pays nothing — on a match that has already been banked.
 *   §L RE-CAPTURE    (`?pointerLock=sim`) Resume from that sheet re-captures the mouse on the
 *                    result screen; Esc then raises the "match is frozen" scrim over it.
 *   §B BACK          browser/hardware Back during a live match abandons it (no pause sheet),
 *                    against DECISIONS §31 ("Back opens the PAUSE SHEET").
 *   §G READY FLAG    `window.__gameReady` survives the match that set it.
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/bh_match_browser.mjs --url '{URL}' --out shots/rv/bugs/match/browser_head
 *   ... --sections P,R --arm clear     (control arm for §P)
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
if (!BASE) { console.error('need --url'); process.exit(2); }
const OUT = String(A.out ?? 'shots/rv/bugs/match/browser');
const SECTIONS = String(A.sections ?? 'P,R,E,L,B').split(',');
const ARM = String(A.arm ?? 'ship');
mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const results = { base: BASE, arm: ARM, sections: {} };
const rows = [];
function row(sec, name, pass, detail) {
  rows.push({ sec, name, pass, detail });
  console.log(`${pass === null ? 'INFO' : pass ? 'PASS' : 'FAIL'}  §${sec} ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
async function newPage(viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  return { ctx, page, errors };
}
const wait = (page, fn, arg, ms = 600_000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
const shot = async (page, name) => { const p = `${OUT}/${name}.png`; await page.screenshot({ path: p }); return p; };

/** Wrap the shipped prototypes so the live MatchState is reachable. Calls straight through. */
async function hookState(page) {
  await page.evaluate(async () => {
    const dir = await import('/src/audio/director.ts');
    const vfx = await import('/src/game/vfx.ts');
    const wrap = (proto, name, argIdx) => {
      const orig = proto[name];
      if (orig.__bh) return;
      const f = function (...a) { window.__bhState = a[argIdx]; return orig.apply(this, a); };
      f.__bh = true;
      proto[name] = f;
    };
    wrap(dir.MatchAudio.prototype, 'handleEvents', 1);
    wrap(vfx.VfxLayer.prototype, 'sync', 0);
  });
  await wait(page, () => !!window.__bhState && Array.isArray(window.__bhState.fighters), null, 60_000);
}

const cardText = (page) => page.evaluate(() => {
  const g = document.querySelector('[data-el="gameover"]');
  const vis = g && getComputedStyle(g).display !== 'none';
  return {
    shown: !!vis,
    title: document.querySelector('[data-el="gameover-title"]')?.textContent ?? null,
    place: document.querySelector('[data-el="gameover-place"]')?.textContent ?? null,
    payout: document.querySelector('[data-el="gameover-payout"]')?.textContent ?? null,
  };
});
const profile = (page) => page.evaluate(() => {
  try {
    const p = JSON.parse(localStorage.getItem('food-arena.profile.v1') ?? 'null');
    if (!p) return null;
    const e = p.economy ?? {};
    return { wins: p.wins, losses: p.losses, xp: p.xp, trophies: e.trophies, coins: e.coins };
  } catch (err) { return { error: String(err) }; }
});

try {
  // ── §P — POST-WHISTLE ────────────────────────────────────────────────────────────
  if (SECTIONS.includes('P')) {
    const { ctx, page, errors } = await newPage();
    await page.goto(`${BASE}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&simSpeed=0.5`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(page, () => window.__matchDebug?.phase === 'playing');
    await hookState(page);
    await shot(page, 'P0_playing');
    const plant = await page.evaluate(async (arm) => {
      const combat = await import('/src/game/combat.ts');
      const st = window.__bhState;
      const a = st.fighters[0], b = st.fighters[1];
      // Taco stands 100 wu WEST of the player (clear floor at the player's spawn), facing it.
      b.x = a.x - 100; b.y = a.y; b.facing = { x: 1, y: 0 };
      const wi = 2; // taco `Filling` — ranged, range 128, speed 256, damage 12
      b.lastUsed[wi] = -1e9;
      const evs = [];
      const fired = combat.attemptAttack(st, b, wi, evs);
      for (const ev of evs) window.__feelEvent(ev);
      const inFlight = st.projectiles.length;
      a.hp = 3;
      // The whistle, through the sim's own victor block: the player's Smash kills taco.
      const evs2 = [];
      combat.applyDamage(st, b, 9999, null, { kind: 'weapon', weaponKey: 'Smash', weaponName: 'Smash', attackerId: 0 }, evs2);
      for (const ev of evs2) window.__feelEvent(ev);
      if (arm === 'clear') st.projectiles.length = 0;
      return { fired, inFlight, phase: st.phase, winnerId: st.winnerId, playerHp: a.hp,
        endEvents: evs2.map((e) => e.type), deathCensus: window.__feelDebug.events.death };
    }, ARM);
    row('P', 'plant: projectile in flight at the whistle, match decided for the player', plant.inFlight > 0 && plant.phase === 'ended' && plant.winnerId === 0, plant);
    // Watch the shipped loop — on the SIM's clock, never the wall's. Under SwiftShader on a
    // loaded box this loop has been measured at ~0.3-2.5 fps (25 ms of sim per frame at
    // simSpeed 0.5), so a wall-clock window is a statement about the renderer, not the game:
    // the first cut of this section waited 25 s of wall, saw nothing, and would have called
    // the bug absent. It now runs until the planted projectile has RESOLVED (or 3 s of sim).
    const t0 = Date.now();
    const simAt0 = await page.evaluate(() => window.__bhState.elapsed);
    let first = null, after = null, sawDeath = false;
    while (Date.now() - t0 < 600_000) {
      // Both arms burn at least 1 s of SIM after the plant, so the control looks as long as
      // the defect arm does; the defect arm's shot lands ~300 ms of sim after the whistle.
      const done = await page.evaluate((s0) => (window.__bhState.projectiles.length === 0
        && window.__bhState.elapsed - s0 > 1000) || window.__bhState.elapsed - s0 > 3000, simAt0);
      if (done && first) {
        const d = await page.evaluate(() => window.__feelDebug?.events?.death);
        if (d > plant.deathCensus && !sawDeath) {
          sawDeath = true;
          after = await page.evaluate(() => ({ phase: window.__matchDebug?.phase, view: window.__matchDebug?.viewReason,
            deaths: window.__feelDebug?.events?.death, alive0: window.__bhState?.fighters?.[0]?.alive }));
          await page.waitForTimeout(1500);
          await shot(page, `P2_after_${ARM}`);
        }
        break;
      }
      const s = await page.evaluate(() => ({
        phase: window.__matchDebug?.phase, winner: window.__matchDebug?.winner,
        view: window.__matchDebug?.viewReason, deaths: window.__feelDebug?.events?.death,
        hitsW: window.__feelDebug?.events?.['hit-landed:weapon'],
        alive0: window.__bhState?.fighters?.[0]?.alive, hp0: window.__bhState?.fighters?.[0]?.hp,
        title: document.querySelector('[data-el="gameover-title"]')?.textContent ?? null,
      }));
      if (!first && s.title) { first = s; await shot(page, `P1_card_${ARM}`); }
      if (s.deaths > plant.deathCensus && !sawDeath) { sawDeath = true; after = s; await page.waitForTimeout(1200); await shot(page, `P2_after_${ARM}`); }
      if (sawDeath && Date.now() - t0 > 6000) break;
      await page.waitForTimeout(150);
    }
    const final = await page.evaluate(() => ({
      phase: window.__matchDebug?.phase, winner: window.__matchDebug?.winner, view: window.__matchDebug?.viewReason,
      deaths: window.__feelDebug?.events?.death, alive0: window.__bhState?.fighters?.[0]?.alive, hp0: window.__bhState?.fighters?.[0]?.hp,
      title: document.querySelector('[data-el="gameover-title"]')?.textContent ?? null,
    }));
    if (!sawDeath) await shot(page, `P2_after_${ARM}`);
    const card = await cardText(page);
    row('P', 'the card reads VICTORY for the local seat', /VICTORY/.test(card.title ?? ''), card);
    const label = ARM === 'clear' ? 'CONTROL: no post-whistle death without a projectile in the air'
      : ARM === 'fix' ? 'FIX ARM: the same shot in the air does no damage after the whistle'
        : 'BUG: the declared winner (local seat) DIES after the whistle under the shipped loop';
    row('P', label, ARM === 'ship' ? sawDeath && final.alive0 === false : !sawDeath && final.alive0 === true,
      { first, after, final });
    row('P', 'page errors', errors.length === 0, errors);
    results.sections.P = { plant, first, after, final, card, errors };
    await ctx.close();
  }

  // ── §R — REVIVE POSE ─────────────────────────────────────────────────────────────
  if (SECTIONS.includes('R')) {
    const { ctx, page, errors } = await newPage();
    await page.goto(`${BASE}/?screen=match&seats=4&player=hamburger&enemy=donut&items=leftovers&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(page, () => window.__matchDebug?.phase === 'playing');
    await hookState(page);
    const lo = await page.evaluate(() => window.__matchDebug?.loadouts);
    row('R', 'four seats, local seat carries leftovers', Array.isArray(lo) && lo.length === 4 && lo[0].includes('leftovers'), lo);
    // The model instances, reached the same way as the state: `BaseCharacter.prototype.update`
    // is called for every model every frame and no character overrides it.
    await page.evaluate(async () => {
      const t = await import('/src/characters/types.ts');
      const proto = t.BaseCharacter.prototype;
      if (!proto.update.__bh) {
        const orig = proto.update;
        const f = function (ctx) { (window.__bhModels ??= {})[this.root.name] = this; return orig.call(this, ctx); };
        f.__bh = true; proto.update = f;
      }
    });
    await wait(page, () => !!window.__bhModels?.['character:hamburger'], null, 60_000);
    await page.waitForTimeout(800);
    const r0 = await shot(page, 'R0_alive');
    results.__poseAlive = await page.evaluate(() => {
      const m = window.__bhModels['character:hamburger'];
      const jb = m.rig?.joints?.body;
      return { deathT: m.deathT, state: m.state, rotZ: Math.round(m.body.rotation.z * 1000) / 1000, posY: Math.round(m.body.position.y * 1000) / 1000,
        rigBodyRotZ: jb ? Math.round(jb.rotation.z * 1000) / 1000 : null, rigBodyPosY: jb ? Math.round(jb.position.y * 1000) / 1000 : null };
    });
    const s0 = await page.evaluate(() => window.__vfxDebugScreen?.player);
    if (s0) {
      const cx = Math.round(s0.x), cy = Math.round(s0.y);
      results.__r0crop = { path: r0, box: { left: Math.max(0, cx - 110), top: Math.max(0, cy - 170), width: 220, height: 220 } };
    }
    const chain = await page.evaluate(async () => {
      const combat = await import('/src/game/combat.ts');
      const st = window.__bhState;
      const key = (i) => st.fighters[i].characterId;
      const src = (i) => ({ kind: 'weapon', weaponKey: 'x', weaponName: key(i), attackerId: i });
      const e1 = []; combat.applyDamage(st, st.fighters[0], 9999, null, src(1), e1);   // slot 1 kills you
      for (const ev of e1) window.__feelEvent(ev);
      const e2 = []; combat.applyDamage(st, st.fighters[1], 9999, null, src(2), e2);   // slot 2 kills slot 1
      for (const ev of e2) window.__feelEvent(ev);
      const f0 = st.fighters[0];
      return { e1: e1.map((e) => e.type), e2: e2.map((e) => e.type), alive0: f0.alive, hp0: f0.hp, deaths0: f0.deaths, phase: st.phase };
    });
    row('R', 'real kill chain revives the local seat (sim says alive, 18 hp)', chain.alive0 === true && chain.e2.includes('item-revived') && chain.phase === 'playing', chain);
    // SIM clock, not wall: the topple is 0.75 s of MODEL time and the death burst 1.35 s.
    const simNow = await page.evaluate(() => window.__bhState.elapsed);
    await wait(page, (s0) => window.__bhState.elapsed - s0 > 2500, simNow, 600_000);
    const pose = () => page.evaluate(() => {
      const m = window.__bhModels?.['character:hamburger'];
      // Rig-driven characters (hamburger is one) suppress BaseCharacter.applyBaseMotion and
      // write the topple onto `rig.joints.body` instead, so read BOTH and say which.
      const jb = m.rig?.joints?.body;
      return m ? { deathT: Math.round(m.deathT * 1000) / 1000, state: m.state,
        rotZ: Math.round(m.body.rotation.z * 1000) / 1000, posY: Math.round(m.body.position.y * 1000) / 1000,
        rigBodyRotZ: jb ? Math.round(jb.rotation.z * 1000) / 1000 : null,
        rigBodyPosY: jb ? Math.round(jb.position.y * 1000) / 1000 : null } : null;
    });
    const poseRevived = await pose();
    const p0 = await page.evaluate(() => ({ x: window.__bhState.fighters[0].x, y: window.__bhState.fighters[0].y }));
    await page.keyboard.down('KeyD');
    await wait(page, (x0) => window.__bhState.fighters[0].x - x0 > 40, p0.x, 600_000).catch(() => {});
    await page.keyboard.up('KeyD');
    const p1 = await page.evaluate(() => ({ x: window.__bhState.fighters[0].x, y: window.__bhState.fighters[0].y,
      alive: window.__bhState.fighters[0].alive, view: window.__matchDebug?.viewReason,
      scr: window.__vfxDebugScreen?.player }));
    const poseWalked = await pose();
    const shotPath = await shot(page, `R1_revived_walked_${ARM}`);
    try {
      const sharp = (await import('sharp')).default;
      const cx = Math.round(p1.scr?.x ?? 640), cy = Math.round(p1.scr?.y ?? 400);
      await sharp(shotPath).extract({ left: Math.max(0, cx - 110), top: Math.max(0, cy - 170), width: 220, height: 220 })
        .resize(660, 660, { kernel: 'nearest' }).toFile(`${OUT}/R1_crop_${ARM}.png`);
      if (results.__r0crop) await sharp(results.__r0crop.path).extract(results.__r0crop.box).resize(660, 660, { kernel: 'nearest' }).toFile(`${OUT}/R0_crop.png`);
    } catch (err) { console.log('crop failed', String(err).slice(0, 120)); }
    row('R', 'CONTROL: before the kill the model is upright (deathT -1)', results.__poseAlive?.deathT === -1, results.__poseAlive);
    row('R', 'the revived fighter is under control (walked >40 wu right)', p1.x - p0.x > 40 && p1.alive, { p0, p1 });
    row('R', ARM === 'ship' ? 'BUG: the revived, walking fighter is still drawn in the DEATH pose' : 'the revived fighter has left the death pose',
      // `state` is NOT the discriminant: `play('idle'|'run')` overwrites it every frame for a
      // living fighter while `deathT` — the field the topple is computed from — is never reset.
      ARM === 'ship' ? (poseWalked?.deathT ?? -1) >= 0 && Math.abs(poseWalked?.rigBodyRotZ ?? poseWalked?.rotZ ?? 0) > 1.0
        : poseWalked?.deathT === -1 && Math.abs(poseWalked?.rigBodyRotZ ?? poseWalked?.rotZ ?? 0) < 0.3,
      { poseAlive: results.__poseAlive, poseRevived, poseWalked });
    row('R', 'page errors', errors.length === 0, errors);
    results.sections.R = { lo, chain, p0, p1, poseAlive: results.__poseAlive, poseRevived, poseWalked, errors };
    delete results.__poseAlive; delete results.__r0crop;
    await ctx.close();
  }

  // ── §C — THE CAMERA COMING BACK TO A REVIVED LOCAL SEAT: CUT OR WHIP-PAN? ─────────
  // `updateViewSubject`'s own rule: "A subject change beyond `cutBeyondUnits` is a `snapTo`,
  // not a `follow`." Its alive branch returns before that rule is applied, so the change
  // BACK to a revived local seat is a glide. Measured on the shipped observable the rig
  // exposes: `__vfxDebugScreen.slots[i]` is the slot's ground point projected to the
  // screen, `null` when it is off screen.
  if (SECTIONS.includes('C')) {
    const { ctx, page, errors } = await newPage();
    await page.goto(`${BASE}/?screen=match&seats=4&player=hamburger&enemy=donut&items=leftovers&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(page, () => window.__matchDebug?.phase === 'playing');
    await hookState(page);
    // ⚠️ A REAL weapon key: `match.ts:attackerSlotOf` resolves the killer through
    // `roster.ts:weaponAttackerOf`, and the first cut of this section passed `weaponKey: 'x'`,
    // which resolves to nobody — so `killedBy` was null and the camera went to the NEAREST
    // fighter instead of the killer, and the control traced the wrong slot.
    await page.evaluate(async () => {
      const combat = await import('/src/game/combat.ts');
      const rules = await import('/src/game/rules.ts');
      const st = window.__bhState;
      const w = rules.CHARACTERS[st.fighters[1].characterId].weapons[0];
      const e1 = []; combat.applyDamage(st, st.fighters[0], 9999, null, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: 1 }, e1);
      for (const ev of e1) window.__feelEvent(ev);
    });
    // Sample the hand-off to the killer (the rule's CUT case) frame by frame.
    // slot -1 = whoever the camera is watching right now.
    const sample = (slot) => page.evaluate((s) => ({
      f: window.__feelDebug?.frames, view: window.__matchDebug?.viewReason, subj: window.__matchDebug?.viewSubject,
      pt: window.__vfxDebugScreen?.slots?.[s < 0 ? window.__matchDebug?.viewSubject : s] ?? null,
      w: innerWidth, h: innerHeight,
    }), slot);
    const trace = async (slot, untilMs) => {
      const out = []; const t0 = Date.now(); let lastF = -1;
      while (Date.now() - t0 < untilMs) {
        const s = await sample(slot);
        if (s.f !== lastF) { out.push(s); lastF = s.f; }
        await page.waitForTimeout(20);
      }
      return out;
    };
    // The dwell is 1350 ms of RAW (simSpeed-scaled) time — at this box's frame rate that
    // is minutes of wall. Wait on the camera's own state machine, then trace the hand-off.
    await wait(page, () => ['killer', 'nearest', 'hold'].includes(window.__matchDebug?.viewReason), null, 900_000).catch(() => {});
    const handoff = await trace(-1, 20_000);
    let onKiller = handoff.findIndex((s) => s.view === 'killer' || s.view === 'nearest' || s.view === 'hold');
    if (onKiller < 0) onKiller = 0;
    // Revive: slot 2 kills slot 1, the local seat gets up where it fell.
    const chain = await page.evaluate(async () => {
      const combat = await import('/src/game/combat.ts');
      const st = window.__bhState;
      const rules = await import('/src/game/rules.ts');
      const w2 = rules.CHARACTERS[st.fighters[2].characterId].weapons[0];
      const e2 = []; combat.applyDamage(st, st.fighters[1], 9999, null, { kind: 'weapon', weaponKey: w2.key, weaponName: w2.name, attackerId: 2 }, e2);
      for (const ev of e2) window.__feelEvent(ev);
      const f0 = st.fighters[0];
      return { revived: e2.some((e) => e.type === 'item-revived'), alive0: f0.alive, x0: f0.x, y0: f0.y,
        x1: st.fighters[1].x, y1: st.fighters[1].y };
    });
    const back = await trace(0, 6_000);
    const near = (s) => s.pt && Math.hypot(s.pt.x - s.w / 2, s.pt.y - s.h / 2) < 0.15 * s.h;
    const framesToCentre = (tr, from) => { const i = tr.findIndex((s, k) => k >= from && near(s)); return i < 0 ? null : tr[i].f - tr[from].f; };
    const handoffFrames = onKiller >= 0 ? framesToCentre(handoff, onKiller) : null;
    const backStart = back.findIndex((s) => s.view === 'local');
    const backFrames = backStart >= 0 ? framesToCentre(back, backStart) : null;
    const offscreenFramesBack = backStart >= 0 ? back.slice(backStart).filter((s, k, arr) => !s.pt && (k === 0 || !near(arr[k - 1]))).length : null;
    const sep = Math.round(Math.hypot(chain.x0 - chain.x1, chain.y0 - chain.y1));
    row('C', 'CONTROL: once the camera is on the killer, the killer is centred (the hand-off was a CUT)', handoffFrames !== null && handoffFrames <= 1, { handoffFrames, onKiller, h0: handoff[onKiller] });
    row('C', `the return to the revived local seat (${sep} wu away) is a GLIDE, not the documented cut`, backFrames !== null && backFrames > 1,
      { backFrames, offscreenFramesBack, chain, backHead: back.slice(backStart, backStart + 8) });
    row('C', 'page errors', errors.length === 0, errors);
    results.sections.C = { handoffFrames, backFrames, offscreenFramesBack, sep, chain, handoff: handoff.slice(Math.max(0, onKiller - 2), onKiller + 6), back: back.slice(0, 20), errors };
    await ctx.close();
  }

  // ── §I — DOES AN ITEM PRESS REACH THE SIM? ───────────────────────────────────────
  // `tools/tmp/up_item_press.mjs` asks the same question (and its header names the missing
  // two-line hunk) but its 60 s `phase === 'playing'` wait does not survive this machine's
  // load, so the question is re-asked here on the SIM clock, in a duel (the two items chosen
  // work at two seats). Observable: the HUD item slot's class — `is-cooling`/`is-winding` is
  // written only off `Fighter.item.lastUsed`, which only `combat.ts:attemptItem` stamps.
  if (SECTIONS.includes('I')) {
    const { ctx, page, errors } = await newPage();
    await page.goto(`${BASE}/?screen=match&player=hamburger&enemy=donut&items=springform,warm_milk&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(page, () => window.__matchDebug?.phase === 'playing');
    await hookState(page);
    const slots = () => page.evaluate(() => [...document.querySelectorAll('.hud-item-slot')].map((n) => ({
      cls: n.className.replace('hud-item-slot ', ''), badge: n.querySelector('.hud-item-badge')?.textContent ?? '',
      key: n.querySelector('.hud-item-key')?.textContent ?? '' })));
    const lastUsed = () => page.evaluate(() => [...(window.__bhState.fighters[0].item.lastUsed ?? [])]);
    const simWait = async (ms) => { const s0 = await page.evaluate(() => window.__bhState.elapsed);
      await wait(page, (a) => window.__bhState.elapsed - a.s0 > a.ms, { s0, ms }); };
    const before = await slots();
    const lu0 = await lastUsed();
    await shot(page, `I0_ready_${ARM}`);
    // CONTROL: a key bound to nothing, the same SIM window.
    await page.keyboard.press('KeyP');
    await simWait(1500);
    const ctl = await slots();
    // Q (slot 0) by key, then a mouse press on slot 1's button.
    await page.keyboard.press('KeyQ');
    await simWait(1500);
    const afterQ = await slots();
    const btn = await page.$$('.hud-item-slot');
    if (btn[1]) await btn[1].dispatchEvent('pointerdown');
    await simWait(1500);
    const afterTap = await slots();
    const lu1 = await lastUsed();
    await shot(page, `I1_after_press_${ARM}`);
    const fired = (s) => /is-cooling|is-winding/.test(s?.cls ?? '');
    row('I', 'both active items start READY, key caps drawn', before.length === 2 && before.every((s) => /is-ready/.test(s.cls)), before);
    row('I', 'CONTROL: an unbound key leaves both slots ready', ctl.every((s) => /is-ready/.test(s.cls)), ctl);
    row('I', ARM === 'ship' ? 'BUG: Q on a READY slot does nothing (slot stays ready, lastUsed untouched)' : 'Q fires slot 0',
      ARM === 'ship' ? !fired(afterQ[0]) && JSON.stringify(lu0) === JSON.stringify(lu1) : fired(afterQ[0]), { afterQ, lu0, lu1 });
    row('I', ARM === 'ship' ? 'BUG: pressing the slot-1 BUTTON does nothing' : 'the slot-1 button fires slot 1',
      ARM === 'ship' ? !fired(afterTap[1]) : fired(afterTap[1]), afterTap);
    row('I', 'page errors', errors.length === 0, errors);
    results.sections.I = { before, ctl, afterQ, afterTap, lu0, lu1, errors };
    await ctx.close();
  }

  // ── §E — ESCAPE ON THE RESULT CARD ───────────────────────────────────────────────
  if (SECTIONS.includes('E')) {
    const { ctx, page, errors } = await newPage();
    await page.goto(`${BASE}/?screen=match&player=pizza&enemy=egg&fogRadius=0&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(page, () => window.__matchDebug?.phase === 'playing');
    const before = await profile(page);
    await wait(page, () => window.__matchDebug?.phase === 'ended');
    await page.waitForTimeout(1500);
    const card = await cardText(page);
    const banked = await profile(page);
    const chip = await page.evaluate(() => getComputedStyle(document.querySelector('.match-chip')).display);
    await shot(page, 'E0_card');
    row('E', 'match ended and banked (card shows payout, profile moved)', card.shown && !!card.payout, { card, before, banked, chip });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const sheet = await page.evaluate(() => ({
      open: document.querySelector('.match-sheet')?.classList.contains('is-open') ?? false,
      paused: window.__matchDebug?.paused,
    }));
    await shot(page, `E1_escape_${ARM}`);
    let confirm = null, afterLeave = null;
    if (sheet.open) {
      await page.click('.match-sheet [data-el="quit"]', { force: true });
      await page.waitForTimeout(200);
      confirm = await page.evaluate(() => document.querySelector('[data-el="confirmbody"]')?.textContent ?? null);
      await shot(page, 'E2_confirm');
      await page.waitForTimeout(500);
      await page.click('.match-sheet [data-el="leave"]', { force: true });
      await wait(page, () => window.__screen === 'home', null, 120_000).catch(() => {});
      afterLeave = await profile(page);
    }
    row('E', ARM === 'ship' ? 'Escape on a DECIDED match opens the pause sheet (chip is hidden for exactly that reason)' : 'Escape on a decided match does nothing',
      ARM === 'ship' ? sheet.open === true : sheet.open === false, { sheet, chip });
    if (confirm !== null) {
      const delta = before && banked ? { trophies: banked.trophies - (before.trophies ?? 0), coins: banked.coins - (before.coins ?? 0), xp: banked.xp - (before.xp ?? 0) } : null;
      row('E', 'the confirm promises no trophies/coins/XP, but the match already paid', /no trophies, coins or XP/.test(confirm) && delta && (delta.coins > 0 || delta.xp > 0),
        { confirm, before, banked, afterLeave, delta });
    }
    row('E', 'page errors', errors.length === 0, errors);
    results.sections.E = { before, banked, card, chip, sheet, confirm, afterLeave, errors };
    await ctx.close();
  }

  // ── §L — POINTER LOCK RE-CAPTURED ON THE RESULT SCREEN ───────────────────────────
  if (SECTIONS.includes('L')) {
    const { ctx, page, errors } = await newPage();
    await page.goto(`${BASE}/?screen=match&player=pizza&enemy=egg&fogRadius=0&pointerLock=sim`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(page, () => window.__matchDebug?.phase === 'playing' && window.__plockDebug?.available === true);
    // ⚠️ `__plockDebug` is republished only on a STATE TRANSITION (`setState` → `render`),
    // so after the toast times out to 'hidden' a release that lands in 'hidden' again never
    // refreshes it — it read `locked: true` on a released lock in this tool's first run.
    // `__matchDebug.pointerLocked` is `input.pointerLocked`, written by the lock's own
    // `onLockChange` and published EVERY frame (paused frames included): that is the mirror.
    const lk = () => page.evaluate(() => ({ locked: window.__matchDebug?.pointerLocked, phase: window.__matchDebug?.phase,
      paused: window.__matchDebug?.paused, plk: { ...window.__plockDebug } }));
    await page.click('.plk-root [data-el="capture"]', { force: true });
    await wait(page, () => window.__matchDebug?.pointerLocked === true, null, 120_000).catch(() => {});
    const lockedInPlay = await lk();
    await wait(page, () => window.__matchDebug?.phase === 'ended');
    await wait(page, () => window.__matchDebug?.pointerLocked === false, null, 120_000).catch(() => {});
    const atEnd = await lk();
    const f0 = await page.evaluate(() => window.__matchDebug?.frames);
    await wait(page, (a) => window.__matchDebug?.frames - a > 10, f0, 300_000).catch(() => {});
    const control = await lk();
    row('L', 'captured during play, released by the whistle and STAYS released 10 frames on (control)', lockedInPlay.locked === true && atEnd.locked === false && control.locked === false, { lockedInPlay, atEnd, control });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const sheetOpen = await page.evaluate(() => document.querySelector('.match-sheet')?.classList.contains('is-open'));
    let relocked = null, lost = null;
    if (sheetOpen) {
      await page.click('.match-sheet [data-el="resume"]', { force: true });
      await wait(page, () => window.__matchDebug?.pointerLocked === true, null, 120_000).catch(() => {});
      relocked = await lk();
      await shot(page, 'L1_recaptured_on_result');
      await page.keyboard.press('Escape');
      await wait(page, () => document.querySelector('.plk-root')?.classList.contains('is-lost'), null, 120_000).catch(() => {});
      lost = await page.evaluate(() => ({ ...window.__plockDebug, locked: window.__matchDebug?.pointerLocked, paused: window.__matchDebug?.paused,
        lostVisible: document.querySelector('.plk-root')?.classList.contains('is-lost') }));
      await page.waitForTimeout(800);
      await shot(page, 'L2_frozen_scrim_on_result');
    }
    row('L', 'Resume from the post-match sheet RE-CAPTURES the mouse on the result screen', relocked?.locked === true && relocked?.phase === 'ended', { sheetOpen, relocked });
    row('L', 'Esc then raises "match is frozen" over the result card', lost?.lostVisible === true, lost);
    row('L', 'page errors', errors.length === 0, errors);
    results.sections.L = { lockedInPlay, atEnd, control, sheetOpen, relocked, lost, errors };
    await ctx.close();
  }

  // ── §B — BACK DURING A LIVE MATCH, and §G — the readiness flag ─────────────────
  if (SECTIONS.includes('B')) {
    const { ctx, page, errors } = await newPage();
    await page.goto(`${BASE}/?screen=characters&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(page, () => window.__screen === 'characters' && window.__screenReady === true);
    const g0 = await page.evaluate(() => ({ gameReady: window.__gameReady ?? null, screen: window.__screen }));
    const p0 = await profile(page);
    await page.evaluate(() => window.__shell.navigate({ name: 'match', player: 'pizza', enemy: 'egg' }));
    await wait(page, () => window.__matchDebug?.phase === 'playing');
    await page.waitForTimeout(800);
    const live = await page.evaluate(() => ({ screen: window.__screen, url: location.search, hist: history.length }));
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => ({
      screen: window.__screen, url: location.search,
      sheetOpen: document.querySelector('.match-sheet')?.classList.contains('is-open') ?? false,
      matchMounted: !!document.querySelector('.fa-match'),
      matchDebug: !!window.__matchDebug, gameReady: window.__gameReady ?? null,
    }));
    const p1 = await profile(page);
    await shot(page, `B1_after_back_${ARM}`);
    // PASS = the DEFECT is observed: DECISIONS §31 says Back opens the pause sheet; the match
    // is unmounted instead, nothing banked, no confirm.
    row('B', 'Back during a LIVE match ABANDONS it — no pause sheet, nothing banked (against DECISIONS §31)',
      live.screen === 'match' && after.screen !== 'match' && !after.sheetOpen && !after.matchDebug
        && JSON.stringify(p0) === JSON.stringify(p1), { live, after, p0, p1 });
    row('G', '__gameReady is undefined before any match (control)', g0.gameReady === null, g0);
    row('G', '__gameReady stays TRUE after the match that set it is torn down', after.gameReady === true && after.matchDebug === false, after);
    row('B', 'page errors', errors.length === 0, errors);
    results.sections.B = { g0, live, after, p0, p1, errors };
    await ctx.close();
  }
} finally {
  results.rows = rows;
  writeFileSync(`${OUT}/results_${ARM}.json`, JSON.stringify(results, null, 1));
  await browser.close();
}
