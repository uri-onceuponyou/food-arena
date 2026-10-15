#!/usr/bin/env node
/**
 * GX_VFX_CAP — the VFX-domain audit's capture probe (review phase, read-only on src/).
 *
 * FRAME-STEPPED, not real-time. `performance.now` is a virtual clock and the game's own
 * rAF loop is held in a queue that this script PUMPS, so the sim runs at an exact
 * `--stepMs` per frame however slow SwiftShader is (match.ts clamps dt at 50 ms x
 * simSpeed, so a real-time run on a contended box samples effects at 50 ms and skips
 * whole beats). Between pumps the page is static, which is what lets one instant be
 * rendered several ways (canonical / ablated / close camera) without anything moving.
 *
 * Plans (`--plan`):
 *   live   1v1 matchups (`--matchups player:enemy,...`), slot 0 driven like
 *          `q1_capture.mjs` (circle-strafe in a 45-140 wu band, mouse on the nearest
 *          opponent, attack held) with the weapon key cycled by `--cycle`.
 *          Slot 0 spawns at `--px/--py` (default: 150 wu from the 1v1 enemy spawn, so
 *          there is no 20 s AI walk-in to pay for frame by frame).
 *   six    `--fighters "a@x,y;b@x,y;..."` (3-6 seats), slot 0 driven the same way.
 *   beats  frozen sim; per weapon fire `weaponFired` + `impact` through the shipped
 *          `__vfxSpawnTest` and save full-canvas renders at `--beatMs` after the fire,
 *          plus the screen point of the effect so a sheet tool can crop around it.
 *
 * At each `--diagAt` capture index (`--diag`), the SAME frozen instant is also rendered
 * canvas-only as:
 *   _noground   every `vfx_ground_mark` mesh hidden (Donut's trail marks + splats)
 *   _novfx      the whole `vfx_layer` hidden (what the frame is without this domain)
 *   _close58    match pitch 58, ~5.5 m tall subject framing on the fight's midpoint
 *   _close20    lobby-like pitch 20, same framing
 * The rig's private target/desired vectors are saved and restored by value, and shake
 * is zeroed for every diagnostic render (AGENT-BRIEF §3 — a frozen frame is not a
 * frozen camera while shake is alive).
 *
 * `--forceStatus` sets slow on slot 1 and stun on slot 2 (when present) every frame
 * from the first capture on, so the status telegraphs are on screen deterministically.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_vfx_cap.mjs --url '{URL}' --plan live --out shots/rv/audit/vfx/live
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

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
const BASE = args.url ?? process.env.PREVIEW_BASE;
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
const OUT = args.out ?? 'shots/rv/audit/vfx/cap';
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const STEP_MS = Number(args.stepMs ?? 1000 / 30);
const PLAN = args.plan ?? 'live';
const DIAG = !!args.diag;
const TAG = args.tag ?? PLAN;
const log = (...a) => console.log(...a);

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** q1_capture's derived anchor: east of the pot by 1.684 x its 95 wu radius. */
const ANCHOR = { x: 1560, y: 1000 };

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e).slice(0, 240)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow();
    let manual = false;
    let virt = 0;
    const q = [];
    window.__clk = {
      manual() { if (!manual) { virt = realNow() - base; manual = true; } },
      /** How many rAF callbacks are waiting for the pump. 0 right after `manual()` means the
       * game's pending REAL rAF has not fired yet, and pumping would advance nothing. */
      qlen() { return q.length; },
      /** Run the queued rAF callbacks once per step, advancing the clock by `ms` each. */
      pump(n, ms) {
        for (let i = 0; i < n; i++) {
          virt += ms;
          if (window.__forceStatus && window.__st) window.__forceStatus(window.__st);
          const cbs = q.splice(0);
          for (const cb of cbs) { try { cb(virt); } catch (e) { console.error('raf cb', e); } }
        }
        return q.length;
      },
    };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  return page;
}

/**
 * Load, wait for `__gameReady`, hand the loop to the pump, and (optionally) pump the
 * countdown away with the DRAW stubbed.
 *
 * `__fast(true)` replaces `stage.render` with `rig.update(dt)` only: the sim, the event
 * handling, `vfx.sync()`/`updateEffects()` and the camera follow all still run every
 * pumped frame — only the GPU draw (and the contact-shadow placement, which happens
 * inside it and is refreshed by the real render at every capture) is skipped. Under a
 * load average of 60-85 a real-time six-seat countdown ran below 0.5 fps and timed out
 * at 180 s; pumped this way it costs a few seconds.
 */
async function bootMatch(page, query, { waitCountdown = true } = {}) {
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.evaluate(() => {
    window.__clk.manual();
    // Grab the live MatchState on its way into the VFX layer — an instance property
    // shadows the prototype method; nothing else is changed.
    const layer = window.__vfxLayer;
    const orig = layer.sync.bind(layer);
    layer.sync = (s) => { window.__st = s; return orig(s); };
    const st = window.__stage;
    window.__realRender = st.render.bind(st);
    window.__fast = (on) => { st.render = on ? ((dt) => st.rig.update(dt)) : window.__realRender; };
  });
  await page.evaluate(() => window.__fast(true));
  // Wait (real time) until the game's loop has re-registered into the manual queue.
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  await page.evaluate(() => window.__clk.pump(3, 50));
  if (waitCountdown) {
    for (let i = 0; i < 400; i++) {
      const phase = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
      if (phase === 'playing') break;
    }
  }
  await page.evaluate((ms) => window.__clk.pump(3, ms), STEP_MS);
  return page.evaluate(() => ({
    player: document.querySelector('[data-el="player-name"]')?.textContent ?? '?',
    enemy: document.querySelector('[data-el="enemy-name"]')?.textContent ?? '?',
    n: window.__st?.fighters?.length ?? null,
    ids: window.__st?.fighters?.map((f) => f.characterId) ?? null,
    inCover: window.__matchDebug?.qaSpawnInsideCover ?? null,
  }));
}

const READ = () => {
  const f = window.__st?.fighters ?? [];
  const scr = window.__vfxDebugScreen ?? null;
  return {
    f: f.map((x) => ({ x: x.x, y: x.y, hp: x.hp, alive: x.alive, id: x.characterId })),
    scr: scr?.slots ?? null,
    elapsed: window.__st?.elapsed ?? null,
    proj: window.__st?.projectiles?.length ?? null,
    trail: window.__st?.trailMarks?.length ?? null,
    splats: window.__st?.splats?.length ?? null,
    qa: window.__vfxQaCounts ? { ...window.__vfxQaCounts } : null,
    // Sim-side wind-up state: ms until the cast resolves, or null. The ground truth the
    // `mega` plan photographs against — the picture must show SOMETHING while this is set.
    cast: f.map((x) => (x.cast ? Math.round(x.cast.resolvesAt - (window.__st?.elapsed ?? 0)) : null)),
    castQa: window.__vfxQaCounts?.castTelegraph ?? null,
  };
};

/** Canvas-only render of the CURRENT instant, optionally ablated / re-framed on `focus` (wu). */
async function diagRender(page, path, mode, focus) {
  const url = await page.evaluate(([mode, focus]) => {
    const stage = window.__stage;
    const rig = stage.rig;
    const layer = stage.scene.getObjectByName('vfx_layer');
    const saved = {
      pitch: rig.pitchDeg, frame: rig.frameMode, vw: rig.viewWidthUnits, th: rig.targetHeight,
      sh: rig.subjectHeight, sf: rig.subjectFill,
      target: rig.target.clone(), desired: rig.desired.clone(),
      shakeAmount: rig.shakeAmount, shakeOffset: rig.shakeOffset.clone(),
    };
    const hidden = [];
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
    if (mode === 'noground') {
      layer.traverse((o) => { if (o.name === 'vfx_ground_mark' && o.visible) { o.visible = false; hidden.push(o); } });
    }
    if (mode === 'novfx' && layer.visible) { layer.visible = false; hidden.push(layer); }
    if (mode.startsWith('close')) {
      rig.frameMode = 'subject';
      rig.subjectHeight = 2.1;
      rig.subjectFill = 0.38;
      rig.pitchDeg = mode.startsWith('close20') ? 20 : 58;
      rig.targetHeight = mode.startsWith('close20') ? 0.9 : 0;
      if (focus) { rig.target.set(focus.x * 0.05, 0, focus.y * 0.05); rig.desired.copy(rig.target); }
      if (mode.endsWith('novfx') && layer.visible) { layer.visible = false; hidden.push(layer); }
    }
    rig.apply();
    (window.__realRender ?? stage.render.bind(stage))(0);
    const cv = document.createElement('canvas');
    cv.width = stage.canvas.width; cv.height = stage.canvas.height;
    cv.getContext('2d').drawImage(stage.canvas, 0, 0);
    const data = cv.toDataURL('image/png');
    for (const o of hidden) o.visible = true;
    rig.pitchDeg = saved.pitch; rig.frameMode = saved.frame; rig.viewWidthUnits = saved.vw; rig.targetHeight = saved.th;
    rig.subjectHeight = saved.sh; rig.subjectFill = saved.sf;
    rig.target.copy(saved.target); rig.desired.copy(saved.desired);
    rig.shakeAmount = saved.shakeAmount; rig.shakeOffset.copy(saved.shakeOffset);
    rig.apply();
    return data;
  }, [mode, focus]);
  writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'));
}

/** One driven match: circle-strafe slot 0 around its nearest living opponent. */
async function driveAndCapture(page, tag, { seconds, captureEvery, cycle, warmup, diagAt, modes }) {
  const held = new Set();
  const setKeys = async (mx, my) => {
    const want = new Set();
    if (mx < 0) want.add('KeyA'); if (mx > 0) want.add('KeyD');
    if (my < 0) want.add('KeyW'); if (my > 0) want.add('KeyS');
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const D_MIN = 45, D_MAX = 140;
  const framesPerCapture = Math.max(1, Math.round(captureEvery / STEP_MS));
  const total = Math.round((seconds * 1000) / STEP_MS);
  const warm = Math.round(((warmup ?? 0) * 1000) / STEP_MS);
  const rows = [];
  let mouseDown = false;
  let lastKey = null;
  for (let fr = 0; fr <= total + warm; fr++) {
    if (fr === warm && args.forceStatus) {
      await page.evaluate(() => {
        window.__forceStatus = (s) => {
          const f = s.fighters;
          if (f[1]) f[1].status.slowedUntil = s.elapsed + 1500;
          if (f[2]) f[2].status.stunnedUntil = s.elapsed + 1500;
        };
      });
    }
    const r = await page.evaluate(READ);
    const me = r.f[0];
    let tgt = -1, best = Infinity;
    r.f.forEach((o, i) => { if (i === 0 || !o.alive) return; const d = Math.hypot(o.x - me.x, o.y - me.y); if (d < best) { best = d; tgt = i; } });
    if (me?.alive && tgt >= 0) {
      const e = r.f[tgt];
      const toward = (tx, ty) => [tx > me.x + 12 ? 1 : tx < me.x - 12 ? -1 : 0, ty > me.y + 12 ? 1 : ty < me.y - 12 ? -1 : 0];
      let mx, my;
      if (best < D_MIN + 20) [mx, my] = toward(me.x + (me.x - e.x), me.y + (me.y - e.y));
      else if (best > D_MAX - 20) [mx, my] = toward(e.x, e.y);
      else { const sx = e.x > me.x ? 1 : -1; const sy = e.y > me.y ? 1 : -1; mx = -sy; my = sx; }
      await setKeys(mx, my);
      const s = r.scr?.[tgt];
      if (s) await page.mouse.move(Math.max(2, Math.min(W - 2, s.x)), Math.max(2, Math.min(H - 2, s.y)));
      if (!mouseDown) { await page.mouse.down(); mouseDown = true; }
      if (cycle && cycle.length) {
        const k = cycle[Math.floor((fr * STEP_MS) / 1300) % cycle.length];
        if (k !== lastKey) { await page.keyboard.press(`Digit${k}`); lastKey = k; }
      }
    } else if (mouseDown) { await page.mouse.up(); mouseDown = false; await setKeys(0, 0); }
    if (fr > warm && (fr - warm) % framesPerCapture === 0) {
      const idx = Math.round((fr - warm) / framesPerCapture);
      const name = `${tag}_${String(idx).padStart(2, '0')}`;
      // The canonical frame: one REAL render of this instant (camera already followed
      // under the stub, shake left as the game has it), then a page screenshot so the
      // DOM HUD is in the picture exactly as a player sees it.
      await page.evaluate(() => window.__realRender(0));
      await page.screenshot({ path: `${OUT}/${name}.png` });
      const row = { name, t: r.elapsed, proj: r.proj, trail: r.trail, splats: r.splats,
        hp: r.f.map((o) => o.hp), alive: r.f.map((o) => o.alive), d: Math.round(best), weaponKey: lastKey,
        pos: r.f.map((o) => [Math.round(o.x), Math.round(o.y)]), scr: r.scr, qa: r.qa };
      if (DIAG && (!diagAt || diagAt.includes(idx))) {
        const focus = tgt >= 0 && me ? { x: (me.x + r.f[tgt].x) / 2, y: (me.y + r.f[tgt].y) / 2 } : (me ? { x: me.x, y: me.y } : null);
        // `full` = the same canvas render with NOTHING ablated (shake zeroed like every
        // diagnostic), so `_full` vs `_noground` / `_novfx` is a same-camera pair. The
        // page screenshot cannot serve: it carries the HUD and the live shake offset.
        const ms = modes.includes('noground') || modes.includes('novfx') ? ['full', ...modes.filter((m) => m !== 'full')] : modes;
        for (const m of ms) await diagRender(page, `${OUT}/${name}_${m}.png`, m, focus);
        row.diag = ms;
      }
      rows.push(row);
      log(`   ${name} t=${r.elapsed?.toFixed?.(0)} d=${Math.round(best)} key=${lastKey} proj=${r.proj} trail=${r.trail} splats=${r.splats} hp=${r.f.map((o) => Math.round(o.hp)).join('/')}`);
    }
    await page.evaluate((ms) => window.__clk.pump(1, ms), STEP_MS);
  }
  for (const k of held) await page.keyboard.up(k);
  if (mouseDown) await page.mouse.up();
  return rows;
}

const MODES = String(args.modes ?? 'noground,novfx,close58,close20').split(',');

async function planLive(browser) {
  const matchups = String(args.matchups ?? 'donut:taco').split(',').map((s) => s.split(':'));
  const cycle = args.cycle ? String(args.cycle).split('').map(Number) : null;
  const px = Number(args.px ?? 2360), py = Number(args.py ?? 1250);
  const out = [];
  for (const [player, enemy] of matchups) {
    log(`\n── live ${player} vs ${enemy} @ (${px},${py}) ──`);
    const page = await newPage(browser);
    const q = new URLSearchParams({ pointerLock: '0', screen: 'match', player, enemy, px: String(px), py: String(py) });
    const info = await bootMatch(page, q.toString());
    log(`   ${info.player} vs ${info.enemy} n=${info.n} inCover=${JSON.stringify(info.inCover)}`);
    for (let i = 0; i < 600; i++) {
      const r = await page.evaluate(READ);
      const d = Math.hypot(r.f[0].x - r.f[1].x, r.f[0].y - r.f[1].y);
      if (d < 170) { log(`   contact at t=${r.elapsed?.toFixed(0)} d=${d.toFixed(0)}`); break; }
      await page.evaluate(() => window.__clk.pump(1, 50));
    }
    const rows = await driveAndCapture(page, `${TAG}_${player}_${enemy}`, {
      seconds: Number(args.seconds ?? 6), captureEvery: Number(args.every ?? 500), cycle,
      warmup: Number(args.warmup ?? 1.0),
      diagAt: args.diagAt ? String(args.diagAt).split(',').map(Number) : null, modes: MODES,
    });
    out.push({ player, enemy, info, rows });
    await page.close();
  }
  return out;
}

async function planSix(browser) {
  const fighters = String(args.fighters);
  const cycle = args.cycle ? String(args.cycle).split('').map(Number) : null;
  log(`\n── six: ${fighters} ──`);
  const page = await newPage(browser);
  const q = new URLSearchParams({ pointerLock: '0', screen: 'match', fighters });
  const info = await bootMatch(page, q.toString());
  log(`   n=${info.n} ids=${info.ids} inCover=${JSON.stringify(info.inCover)}`);
  const rows = await driveAndCapture(page, TAG, {
    seconds: Number(args.seconds ?? 6), captureEvery: Number(args.every ?? 500), cycle,
    warmup: Number(args.warmup ?? 0.5),
    diagAt: args.diagAt ? String(args.diagAt).split(',').map(Number) : null, modes: MODES,
  });
  await page.close();
  return [{ fighters, info, rows }];
}

async function planBeats(browser) {
  const page = await newPage(browser);
  const q = new URLSearchParams({ pointerLock: '0', screen: 'match', player: args.player ?? 'hamburger', enemy: args.enemy ?? 'donut',
    px: String(ANCHOR.x), py: String(ANCHOR.y), simSpeed: '0.0001' });
  await bootMatch(page, q.toString(), { waitCountdown: false });
  const beatMs = String(args.beatMs ?? '60,180').split(',').map(Number);
  const ids = String(args.chars ?? 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
  const kinds = String(args.kinds ?? 'weaponFired,impact').split(',');
  const res = [];
  // Weapon keys from rules via an in-page import (the snapshot is a Vite dev server).
  const roster = await page.evaluate(async () => {
    const mod = await import('/src/game/rules.ts');
    const out = {};
    for (const [id, c] of Object.entries(mod.CHARACTERS)) out[id] = c.weapons.map((w) => ({ key: w.key, type: w.type, slot: w.slot, color: w.color, damage: w.damage, castMs: w.castMs ?? 0 }));
    return out;
  });
  for (const who of ids) {
    for (const w of roster[who] ?? []) {
      for (const kind of kinds) {
        for (const ms of beatMs) {
          const name = `beat_${who}_${w.key}_${kind}_${ms}`;
          const got = await page.evaluate(([who, key, kind, ms, ax, ay, dmg, W, H, wcolor]) => {
            const layer = window.__vfxLayer;
            const stage = window.__stage;
            layer.clear();
            const tx = kind === 'impact' ? ax + 60 : ax;
            // The shipped impact is tinted `colorForDamageSource` = the WEAPON's own colour
            // (match.ts). The first version of this probe passed the hook's default
            // '#FFC93C' for every weapon and photographed every generic impact yellow —
            // a mis-pointed instrument, caught by reading the sheet against match.ts.
            window.__vfxSpawnTest(kind, tx, ay, Math.max(1, dmg), wcolor, who, key);
            const steps = Math.max(1, Math.round(ms / 20));
            for (let i = 0; i < steps; i++) layer.updateEffects(ms / steps / 1000);
            stage.rig.shakeAmount = 0; stage.rig.shakeOffset.set(0, 0, 0);
            window.__realRender(0);
            const cv = document.createElement('canvas');
            cv.width = stage.canvas.width; cv.height = stage.canvas.height;
            cv.getContext('2d').drawImage(stage.canvas, 0, 0);
            const v = stage.rig.camera.position.clone().set(tx * 0.05, 1.0, ay * 0.05).project(stage.rig.camera);
            return { data: cv.toDataURL('image/png'), sx: (v.x + 1) / 2 * W, sy: (1 - v.y) / 2 * H, cw: cv.width, ch: cv.height };
          }, [who, w.key, kind, ms, ANCHOR.x, ANCHOR.y, w.damage, W, H, w.color]);
          writeFileSync(`${OUT}/${name}.png`, Buffer.from(got.data.split(',')[1], 'base64'));
          res.push({ name, who, key: w.key, kind, ms, slot: w.slot, type: w.type, color: w.color, damage: w.damage, sx: got.sx, sy: got.sy, cw: got.cw, ch: got.ch });
        }
      }
      log(`   ${who}.${w.key} done`);
    }
  }
  // the empty frame, for diffing
  const empty = await page.evaluate(() => {
    window.__vfxLayer.clear();
    const stage = window.__stage; window.__realRender(0);
    const cv = document.createElement('canvas'); cv.width = stage.canvas.width; cv.height = stage.canvas.height;
    cv.getContext('2d').drawImage(stage.canvas, 0, 0); return cv.toDataURL('image/png');
  });
  writeFileSync(`${OUT}/beat_empty.png`, Buffer.from(empty.split(',')[1], 'base64'));
  await page.close();
  return res;
}

/**
 * MEGA — is the game's only wind-up (`waterbottle.Mega`, castMs 1400) drawn in SHIPPED play?
 *
 * `vfx.ts:spawnCastTelegraph` documents that `match.ts` calls it on `cast-started`; a grep
 * finds no such call. This plan answers it in pixels, with both arms in one session:
 *   SHIPPED   slot 0 = Water Bottle, weapon 4 held, frames every 2 steps while the sim's own
 *             `fighters[0].cast` is non-null; logs the QA counter `castTelegraph` (bumped by
 *             `spawnCastTelegraph`) — it must rise if the shipped path draws a telegraph.
 *   CONTROL   the SAME instant re-rendered after firing `__vfxSpawnTest('castTelegraph')` for
 *             Mega at slot 0's position — the positive control: the telegraph CAN draw here.
 */
async function planMega(browser) {
  const page = await newPage(browser);
  const q = new URLSearchParams({ pointerLock: '0', screen: 'match', player: 'waterbottle', enemy: args.enemy ?? 'donut',
    px: String(args.px ?? 2360), py: String(args.py ?? 1250) });
  await bootMatch(page, q.toString());
  for (let i = 0; i < 600; i++) {
    const r = await page.evaluate(READ);
    if (Math.hypot(r.f[0].x - r.f[1].x, r.f[0].y - r.f[1].y) < 120) break;
    await page.evaluate(() => window.__clk.pump(1, 50));
  }
  await page.keyboard.press('Digit4');
  const rows = [];
  let shots = 0;
  let mouseDown = false;
  for (let fr = 0; fr < Math.round(6000 / STEP_MS) && shots < 14; fr++) {
    const r = await page.evaluate(READ);
    const s = r.scr?.[1];
    if (s) await page.mouse.move(Math.max(2, Math.min(W - 2, s.x)), Math.max(2, Math.min(H - 2, s.y)));
    if (!mouseDown) { await page.mouse.down(); mouseDown = true; }
    const casting = r.cast?.[0] !== null && r.cast?.[0] !== undefined;
    if (casting && fr % 2 === 0) {
      const name = `mega_${String(shots).padStart(2, '0')}`;
      await page.evaluate(() => window.__realRender(0));
      await page.screenshot({ path: `${OUT}/${name}_shipped.png` });
      // CONTROL: same instant, plus the QA-fired telegraph at slot 0, then removed again.
      const ctl = await page.evaluate(([W, H]) => {
        const st = window.__st; const me = st.fighters[0];
        const before = window.__vfxQaCounts?.castTelegraph ?? 0;
        window.__vfxSpawnTest('castTelegraph', me.x, me.y, 18, '#1E90D8', 'waterbottle', 'Mega', 1400);
        window.__vfxLayer.updateEffects(0.7);
        const stage = window.__stage;
        stage.rig.shakeAmount = 0; stage.rig.shakeOffset.set(0, 0, 0);
        window.__realRender(0);
        const cv = document.createElement('canvas'); cv.width = stage.canvas.width; cv.height = stage.canvas.height;
        cv.getContext('2d').drawImage(stage.canvas, 0, 0);
        const data = cv.toDataURL('image/png');
        window.__vfxLayer.cancelCastTelegraph(0, 'resolved');
        return { data, qaDelta: (window.__vfxQaCounts?.castTelegraph ?? 0) - before };
      }, [W, H]);
      writeFileSync(`${OUT}/${name}_qacontrol.png`, Buffer.from(ctl.data.split(',')[1], 'base64'));
      rows.push({ name, t: r.elapsed, castMsLeft: r.cast[0], shippedTelegraphCount: r.castQa, controlQaDelta: ctl.qaDelta });
      log(`   ${name} t=${r.elapsed?.toFixed(0)} castLeft=${r.cast[0]} shippedCastTelegraphCounter=${r.castQa} controlDelta=${ctl.qaDelta}`);
      shots++;
    }
    await page.evaluate((ms) => window.__clk.pump(1, ms), STEP_MS);
  }
  if (mouseDown) await page.mouse.up();
  await page.close();
  return rows;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const t0 = Date.now();
  let result;
  try {
    if (PLAN === 'live') result = await planLive(browser);
    else if (PLAN === 'six') result = await planSix(browser);
    else if (PLAN === 'beats') result = await planBeats(browser);
    else if (PLAN === 'mega') result = await planMega(browser);
    else throw new Error(`unknown plan ${PLAN}`);
  } finally {
    await browser.close();
  }
  writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify({ base: BASE, plan: PLAN, stepMs: STEP_MS, result }, null, 2));
  log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${OUT}`);
}

await main().catch((e) => { console.error(e); process.exitCode = 1; });
