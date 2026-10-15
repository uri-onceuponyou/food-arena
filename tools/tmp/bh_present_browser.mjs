#!/usr/bin/env node
/**
 * BH_PRESENT_BROWSER — four SIM <-> PRESENTATION sync defects, driven in the real page.
 *
 * REVIEW-PHASE PROBE (2026-10-15). Read-only on every tracked file. Run it on a SNAPSHOT of a
 * detached worktree (never :5173):
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/bh_present_browser.mjs --url '{URL}' --label head --out shots/rv/bugs/present/head
 *
 * The SAME probe is run against a scratch worktree carrying the proposed minimal fixes
 * (`--label fix`). That arm is the POSITIVE CONTROL: every row below that reads "dead" on
 * HEAD must read "alive" there, or the probe cannot see the thing it claims to test.
 *
 *   §I  ITEM PRESS. `input.ts` queues Q/E (`pressItem`) and the HUD draws `is-ready` buttons
 *       with Q/E caps, but `match.ts:buildInput()` never calls `takeItemPress()` and
 *       `createHud` is given no `onUseItem`. Observable: the HUD slot's state, which `hud.ts`
 *       derives from the SIM (`itemUsable` / `Fighter.item.lastUsed`), plus Springform's
 *       displacement of the local fighter (`__vfxDebugFighters.player`).
 *   §C  CAST TELEGRAPH. `vfx.ts:spawnCastTelegraph` is documented as called by `match.ts` on
 *       `cast-started`; `match.ts` has no such case. Observable: `__vfxQaCounts.castTelegraph`
 *       across a REAL `waterbottle.Mega` press (proved real by the tray cooling at the press and
 *       `weapon-fired` arriving at the resolve), plus a mid-wind-up PNG. Counter liveness is
 *       proved on the same build by `__vfxSpawnTest('castTelegraph', ...)`.
 *   §R  A FIGHTER ALIVE AFTER A `death` EVENT (what a Leftovers revive produces). Observable:
 *       the model's body topple angle (`character:<id>` root, `children[0].rotation.z`) while
 *       the sim says `alive`.
 *   §F  GIANT SLAM FAR vs NEAR (N=3, `?fighters=`). One synthetic `weapon-fired` through the
 *       real `handleEvents`. Observable: `__feelDebug` — the kick is distance-scaled
 *       (`shakeSumM` vs `shakeRawSumM`) while the screen flash and the 120 ms hit-stop are not.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
const argv = process.argv.slice(2);
const flag = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const LABEL = flag('label', 'run');
const OUT = resolve(flag('out', `shots/rv/bugs/present/${LABEL}`));
const SECTIONS = (flag('sections', 'I,C,R,F')).split(',');

const result = { label: LABEL, base: BASE, sections: {} };
const log = (...a) => console.log(`[${LABEL}]`, ...a);

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
      + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
      + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
      + 'export const ErrorOverlay=class{};export default {};',
  }));
  return { page, errors };
}

async function goPlaying(page, query) {
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240_000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 240_000, polling: 250 });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── §I ───────────────────────────────────────────────────────────────────────
async function sectionI(browser) {
  const { page, errors } = await newPage(browser);
  const S = { errors };
  try {
    await goPlaying(page, 'player=hamburger&enemy=donut&pointerLock=0&items=springform,shiitake&simSpeed=2');
    const read = () => page.evaluate(() => {
      const slots = [...document.querySelectorAll('.hud-item-slot')].map((el) => ({
        cls: el.className, badge: el.querySelector('[data-role="badge"]')?.textContent ?? null,
        key: el.querySelector('.hud-item-key')?.textContent ?? null,
      }));
      const p = window.__vfxDebugFighters?.player;
      return { slots, x: p?.x, y: p?.y, loadout: window.__matchDebug?.loadouts?.[0] ?? null, elapsedFrames: window.__matchDebug?.frames };
    });
    // wait for both buttons to be armed by the sim's own gate
    await page.waitForFunction(() => [...document.querySelectorAll('.hud-item-slot')].filter((e) => e.classList.contains('is-ready')).length >= 1,
      null, { timeout: 60_000, polling: 250 }).catch(() => {});
    S.before = await read();
    // ARM 1 — the keyboard FIRST: Q is `ITEM_KEYS[0]`, slot 0 (Springform, a self-launch with
    // no wind-up). ⚠️ ORDER MATTERS: the first version tapped Shiitake first, and on the FIXED
    // tree its 1-slot wind-up made `itemUsable` refuse the Q press (`WAIT`) — an inconclusive
    // positive control, caught by reading the fix arm rather than trusting the head arm.
    await page.keyboard.press('KeyQ');
    await sleep(2500);
    S.afterQ = await read();
    // ARM 2 — the HUD button for slot 1 (tap). `dispatchEvent` reaches the element's own
    // `pointerdown` listener, which is exactly what a finger does after `touch.ts` routes it.
    await page.locator('.hud-item-slot').nth(1).dispatchEvent('pointerdown');
    await sleep(2500);
    S.afterTap = await read();
    await page.screenshot({ path: `${OUT}/I_after_presses.png` });
    const moved = Math.hypot((S.afterQ.x ?? 0) - (S.before.x ?? 0), (S.afterQ.y ?? 0) - (S.before.y ?? 0));
    S.verdict = {
      loadoutArrived: JSON.stringify(S.before.loadout),
      readyBefore: S.before.slots.map((s) => s.cls.includes('is-ready')),
      slot0AfterQ: S.afterQ.slots[0]?.cls, slot0BadgeAfterQ: S.afterQ.slots[0]?.badge,
      slot1AfterTap: S.afterTap.slots[1]?.cls, slot1BadgeAfterTap: S.afterTap.slots[1]?.badge,
      springformDisplacementWu: Number(moved.toFixed(1)),
    };
  } catch (e) { S.fatal = String(e.message).slice(0, 300); }
  await page.close();
  return S;
}

// ── §C ───────────────────────────────────────────────────────────────────────
async function sectionC(browser) {
  const { page, errors } = await newPage(browser);
  const S = { errors };
  try {
    await goPlaying(page, 'player=waterbottle&enemy=hamburger&pointerLock=0&simSpeed=2');
    const read = () => page.evaluate(() => ({
      qa: { ...(window.__vfxQaCounts ?? {}) },
      fired: window.__feelDebug?.events?.['weapon-fired'] ?? null,
      sel: window.__matchDebug?.selectedWeapon,
      tray: [...document.querySelectorAll('.hud-weapon-slot')].map((el) => el.className),
      p: window.__vfxDebugFighters?.player ?? null,
    }));
    await page.keyboard.press('Digit4');          // weapon slot 4 = waterbottle.Mega (castMs 1400)
    await sleep(800);
    S.before = await read();
    const box = await page.locator('canvas').first().boundingBox();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
    await page.mouse.down();
    // The press is consumed at the CAST START (cooldown stamped then), so wait for the tray.
    await page.waitForFunction(() => {
      const t = document.querySelectorAll('.hud-weapon-slot')[3];
      return t && !t.classList.contains('is-ready');
    }, null, { timeout: 30_000, polling: 100 }).catch(() => {});
    await page.mouse.up();
    S.atCastStart = await read();
    await page.screenshot({ path: `${OUT}/C_midwindup.png` });
    // the resolve: `weapon-fired` for the cast weapon arrives castMs later
    const firedBefore = S.before.fired ?? 0;
    await page.waitForFunction((n) => (window.__feelDebug?.events?.['weapon-fired'] ?? 0) > n, firedBefore, { timeout: 40_000, polling: 100 }).catch(() => {});
    S.afterResolve = await read();
    await page.screenshot({ path: `${OUT}/C_after_resolve.png` });
    // Counter liveness on THIS build: the QA spawner calls `spawnCastTelegraph` directly.
    S.spawnTest = await page.evaluate(() => {
      const before = window.__vfxQaCounts?.castTelegraph ?? 0;
      const p = window.__vfxDebugFighters?.player;
      window.__vfxSpawnTest?.('castTelegraph', p.x + 300, p.y, undefined, undefined, 'waterbottle', 'Mega', 1400);
      return { before, after: window.__vfxQaCounts?.castTelegraph ?? 0, hookPresent: typeof window.__vfxSpawnTest === 'function' };
    });
    S.verdict = {
      castStartedObservedByTray: S.atCastStart.tray[3]?.includes('is-ready') === false,
      telegraphsDuringRealCast: (S.afterResolve.qa.castTelegraph ?? 0) - (S.before.qa.castTelegraph ?? 0),
      weaponFiredAtResolve: (S.afterResolve.fired ?? 0) - (S.before.fired ?? 0),
      spawnTestDelta: S.spawnTest.after - S.spawnTest.before,
    };
  } catch (e) { S.fatal = String(e.message).slice(0, 300); }
  await page.close();
  return S;
}

// ── §R ───────────────────────────────────────────────────────────────────────
async function sectionR(browser) {
  const { page, errors } = await newPage(browser);
  const S = { errors };
  try {
    await goPlaying(page, 'player=hamburger&enemy=donut&pointerLock=0&simSpeed=3');
    // ⚠️ THE FIRST VERSION READ `root.children[0].rotation.z` AND WAS POINTED AT THE WRONG
    // NODE: rig characters (donut, …) suppress `applyBaseMotion` and topple their OWN
    // `ChibiRig` body joint from `dead01 = deathT / 0.75`, so `children[0]` stays at 0 on a
    // corpse too. Read 0 on HEAD and on FIX alike — a probe that could not fail. Now: the
    // HIGHEST world-space mesh origin under the character root (`matrixWorld` translation Y),
    // which a topple brings down whichever node does the toppling. Slot 0 (never killed) is
    // read beside it as the stability control.
    const read = () => page.evaluate(() => {
      const top = (name) => {
        let root = null;
        window.__stage?.scene?.traverse((o) => { if (o.name === name) root = o; });
        if (!root) return null;
        let maxY = -Infinity;
        root.traverse((o) => { if (o.isMesh && o.visible) maxY = Math.max(maxY, o.matrixWorld.elements[13]); });
        return maxY;
      };
      return {
        enemyTopY: top('character:donut'),
        playerTopY: top('character:hamburger'),
        simAlive: window.__vfxDebugFighters?.enemy?.alive ?? null,
        simHp: window.__vfxDebugFighters?.enemy?.hp ?? null,
      };
    });
    S.before = await read();
    await page.evaluate(() => window.__feelEvent?.({ type: 'death', fighterRole: 'enemy', fighterId: 1 }));
    await sleep(5000);
    S.after = await read();
    await page.screenshot({ path: `${OUT}/R_alive_after_death_event.png` });
    S.verdict = {
      simAliveAfter: S.after.simAlive, simHpAfter: S.after.simHp,
      enemyTopYBefore: Number((S.before.enemyTopY ?? NaN).toFixed(3)),
      enemyTopYAfter: Number((S.after.enemyTopY ?? NaN).toFixed(3)),
      playerTopYBefore: Number((S.before.playerTopY ?? NaN).toFixed(3)),
      playerTopYAfter: Number((S.after.playerTopY ?? NaN).toFixed(3)),
      toppledWhileAlive: S.after.simAlive === true && (S.after.enemyTopY ?? 9) < 0.6 * (S.before.enemyTopY ?? 0),
    };
  } catch (e) { S.fatal = String(e.message).slice(0, 300); }
  await page.close();
  return S;
}

// ── §F ───────────────────────────────────────────────────────────────────────
async function slam(browser, fighters, tag) {
  const { page, errors } = await newPage(browser);
  const S = { errors, fighters };
  try {
    await goPlaying(page, `fighters=${fighters}&pointerLock=0&simSpeed=1`);
    const read = () => page.evaluate(() => {
      const f = window.__feelDebug;
      const s = window.__vfxDebugFighters?.slots ?? [];
      return {
        screenFlash: f?.responses?.screenFlash, lastHitStopMs: f?.lastHitStopMs,
        shakeRawSumM: f?.shakeRawSumM, shakeSumM: f?.shakeSumM,
        flashPlaying: document.querySelector('[data-el="screenflash"]')?.classList.contains('is-playing') ?? null,
        d01: s[0] && s[1] ? Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y) : null,
      };
    });
    S.before = await read();
    await page.evaluate(() => window.__feelEvent?.({ type: 'weapon-fired', fighterRole: 'enemy', fighterId: 1, weaponKey: 'Giant' }));
    S.after = await page.evaluate(() => {
      const f = window.__feelDebug;
      return {
        screenFlash: f?.responses?.screenFlash, lastHitStopMs: f?.lastHitStopMs,
        shakeRawSumM: f?.shakeRawSumM, shakeSumM: f?.shakeSumM,
        flashPlaying: document.querySelector('[data-el="screenflash"]')?.classList.contains('is-playing') ?? null,
      };
    });
    await page.screenshot({ path: `${OUT}/F_${tag}.png` });
    S.verdict = {
      distanceWu: Number((S.before.d01 ?? NaN).toFixed(1)),
      flashFired: S.after.screenFlash - S.before.screenFlash,
      flashElementPlaying: S.after.flashPlaying,
      hitStopMs: S.after.lastHitStopMs,
      kickRawM: Number((S.after.shakeRawSumM - S.before.shakeRawSumM).toFixed(4)),
      kickDeliveredM: Number((S.after.shakeSumM - S.before.shakeSumM).toFixed(4)),
    };
  } catch (e) { S.fatal = String(e.message).slice(0, 300); }
  await page.close();
  return S;
}

// ── §R3 — the same as §R, with the donut ON SCREEN (160 wu from the local seat) for pixels ──
async function sectionR3(browser) {
  const { page, errors } = await newPage(browser);
  const S = { errors };
  try {
    // ⚠️ simSpeed 2 and a FRAME-COUNTED wait: the first run used simSpeed 1 and 6 s of wall
    // clock, which under SwiftShader was ~13 frames ≈ 0.65 s of `deathT` against a 0.75 s
    // fall — it photographed the anticipation beat and read "upright" on HEAD too.
    await goPlaying(page, 'fighters=hamburger@300,810;donut@460,810;taco@2670,290&pointerLock=0&simSpeed=2');
    const read = () => page.evaluate(() => {
      let root = null;
      window.__stage?.scene?.traverse((o) => { if (o.name === 'character:donut') root = o; });
      let maxY = -Infinity;
      root?.traverse((o) => { if (o.isMesh && o.visible) maxY = Math.max(maxY, o.matrixWorld.elements[13]); });
      const s = window.__vfxDebugFighters?.slots?.[1];
      return { topY: maxY, alive: s?.alive ?? null, hp: s?.hp ?? null, x: s?.x, y: s?.y };
    });
    S.before = await read();
    await page.screenshot({ path: `${OUT}/R3_before.png` });
    const f0 = await page.evaluate(() => {
      window.__feelEvent?.({ type: 'death', fighterRole: 'enemy', fighterId: 1 });
      return window.__matchDebug?.frames ?? 0;
    });
    // 40 frames at <= 0.1 s of sim each: well past the 0.75 s fall even through the 90 ms hit-stop.
    await page.waitForFunction((n) => (window.__matchDebug?.frames ?? 0) >= n, f0 + 40, { timeout: 180_000, polling: 200 });
    S.after = await read();
    S.framesWaited = 40;
    await page.screenshot({ path: `${OUT}/R3_alive_after_death_event.png` });
    S.verdict = {
      topYBefore: Number(S.before.topY.toFixed(3)), topYAfter: Number(S.after.topY.toFixed(3)),
      simAliveAfter: S.after.alive, simHpAfter: S.after.hp,
      movedWu: Number(Math.hypot(S.after.x - S.before.x, S.after.y - S.before.y).toFixed(1)),
    };
  } catch (e) { S.fatal = String(e.message).slice(0, 300); }
  await page.close();
  return S;
}

// ── §Fpeak — the far slam's flash, frozen at its keyframe peak (10% of 0.46 s) for pixels ──
async function sectionFpeak(browser) {
  const { page, errors } = await newPage(browser);
  const S = { errors };
  try {
    await goPlaying(page, 'fighters=hamburger@300,810;lollipop@2500,1190;donut@2670,290&pointerLock=0&simSpeed=1');
    await page.screenshot({ path: `${OUT}/Fpeak_before.png` });
    S.r = await page.evaluate(() => {
      window.__feelEvent?.({ type: 'weapon-fired', fighterRole: 'enemy', fighterId: 1, weaponKey: 'Giant' });
      const el = document.querySelector('[data-el="screenflash"]');
      const anims = el ? el.getAnimations() : [];
      for (const a of anims) { a.pause(); a.currentTime = 46; }
      const s = window.__vfxDebugFighters?.slots ?? [];
      return { anims: anims.length, opacity: el ? getComputedStyle(el).opacity : null,
        d01: s[0] && s[1] ? Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y) : null };
    });
    await page.screenshot({ path: `${OUT}/Fpeak_far_slam_flash.png` });
    S.verdict = S.r;
  } catch (e) { S.fatal = String(e.message).slice(0, 300); }
  await page.close();
  return S;
}

// ── §E — is the sim still being STEPPED under the result card? ────────────────────────
// `?fogRadius=0` starts in sudden death (50 HP/s for everyone), so a duel ends in seconds.
// `__feelDebug.frames` is bumped only on the non-paused branch of `loop`, the same branch that
// calls `stepMatch`; `stepDtMs` is the dt it handed the sim. Both moving while `phase` stays
// `'ended'` is the shipped loop stepping the sim after the whistle.
async function sectionE(browser) {
  const { page, errors } = await newPage(browser);
  const S = { errors };
  try {
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&pointerLock=0&fogRadius=0&simSpeed=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240_000 });
    await page.waitForFunction(() => window.__matchDebug?.phase === 'ended', null, { timeout: 240_000, polling: 200 });
    const read = () => page.evaluate(() => ({
      phase: window.__matchDebug?.phase, frames: window.__feelDebug?.frames, stepDtMs: window.__feelDebug?.stepDtMs,
      card: document.querySelector('[data-el="gameover"]') ? getComputedStyle(document.querySelector('[data-el="gameover"]')).display : null,
      title: document.querySelector('.hud-gameover-title, [data-el="gameover-title"]')?.textContent ?? null,
    }));
    S.atEnd = await read();
    await sleep(4000);
    S.later = await read();
    await page.screenshot({ path: `${OUT}/E_result_card.png` });
    S.verdict = { phaseLater: S.later.phase, framesAdvancedAfterEnd: S.later.frames - S.atEnd.frames, stepDtMsLater: S.later.stepDtMs, title: S.later.title, card: S.later.card };
  } catch (e) { S.fatal = String(e.message).slice(0, 300); }
  await page.close();
  return S;
}

async function main() {
  if (!BASE || /:5173(\/|$)/.test(BASE)) { console.error('bh_present_browser: --url must be a SNAPSHOT'); process.exit(2); }
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    // A fresh snapshot's FIRST client eats a dep-optimisation reload (AGENT-BRIEF §3): warm it.
    { const { page } = await newPage(browser); await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 180_000 }).catch(() => {}); await sleep(3000); await page.close(); }
    if (SECTIONS.includes('I')) { result.sections.I = await sectionI(browser); log('§I', JSON.stringify(result.sections.I.verdict ?? result.sections.I.fatal)); }
    if (SECTIONS.includes('C')) { result.sections.C = await sectionC(browser); log('§C', JSON.stringify(result.sections.C.verdict ?? result.sections.C.fatal)); }
    if (SECTIONS.includes('R')) { result.sections.R = await sectionR(browser); log('§R', JSON.stringify(result.sections.R.verdict ?? result.sections.R.fatal)); }
    if (SECTIONS.includes('R3')) { result.sections.R3 = await sectionR3(browser); log('§R3', JSON.stringify(result.sections.R3.verdict ?? result.sections.R3.fatal)); }
    if (SECTIONS.includes('E')) { result.sections.E = await sectionE(browser); log('§E', JSON.stringify(result.sections.E.verdict ?? result.sections.E.fatal)); }
    if (SECTIONS.includes('Fpeak')) { result.sections.Fpeak = await sectionFpeak(browser); log('§Fpeak', JSON.stringify(result.sections.Fpeak.verdict ?? result.sections.Fpeak.fatal)); }
    if (SECTIONS.includes('F')) {
      // Shipped spawns 0/1/2 (tools/arena.gameplay.json): Lollipop at slot 1, 2,232 wu from slot 0.
      result.sections.Ffar = await slam(browser, 'hamburger@300,810;lollipop@2500,1190;donut@2670,290', 'far');
      log('§F far', JSON.stringify(result.sections.Ffar.verdict ?? result.sections.Ffar.fatal));
      // Control: the same event with Lollipop 100 wu away. The KICK must differ; flash/hit-stop must not.
      result.sections.Fnear = await slam(browser, 'hamburger@300,810;lollipop@400,810;donut@2670,290', 'near');
      log('§F near', JSON.stringify(result.sections.Fnear.verdict ?? result.sections.Fnear.fatal));
    }
  } finally {
    await browser.close();
    writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
    log('wrote', `${OUT}/result.json`);
  }
}

if (IS_MAIN) await main();
