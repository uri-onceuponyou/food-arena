#!/usr/bin/env node
/**
 * V1_VFX_CHEESE — is Blue Cheese's aura DRAWN, at its damage radius, and QUIET?
 * (Graphics campaign V1, docs/REVAMP.md §5.)
 *
 * B3 made the aura deal 1 dmg/s to every opponent inside `ITEM_TUNING.blue_cheese.radius`, and
 * B2/B3b made the tick silent on screen on purpose (no flash, no shake) — so the cloud is the
 * only on-screen sign it exists. This boots a match, frame-steps it with a virtual clock (the
 * `gx_vfx_cap.mjs` pump, so SwiftShader speed cannot change what is sampled), and at one
 * frozen instant renders the canvas twice: as shipped, and with the `vfx_blue_cheese` mesh
 * hidden. The pixels that move are the cloud.
 *
 * Arms (each a separate boot):
 *   wearer    ?items=blue_cheese on the local seat (hamburger), opponent far away
 *   control   the same boot with NO items — the KNOWN-BAD for "a cloud is drawn": it must
 *             draw nothing, or the differ is reading something other than the item
 *   wearer2   a NON-local wearer: blue_cheese pushed into slot 1's loadout through the live
 *             state, slot 1 placed beside the local seat — the cloud must follow the item,
 *             not the camera's subject
 *
 * Asserted (exit 1 on any failure):
 *   1. wearer: the moved-pixel set is NON-EMPTY (asserted before any mean is taken over it)
 *      and lies inside the aura's projected radius (>= 95% of moved px within 1.12 r);
 *   2. wearer: the moved set reaches the boundary (its 98th-percentile radius >= 0.85 r) —
 *      a cloud drawn at a quarter of the radius would "exist" and lie about the hitbox;
 *   3. control: the moved set is EMPTY and the mesh draws no instances;
 *   4. NOT LOUD: mean OKLab chroma of the moved pixels as drawn is within +0.03 of the same
 *      pixels without the cloud, and |dL| <= 0.08 — a permanent effect must not be an accent;
 *   5. wearer2: moved pixels inside slot 1's projected radius, none required around slot 0.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/v1_vfx_cheese.mjs --url '{URL}' --out <dir>
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]; if (!a.startsWith('--')) continue;
  const nx = process.argv[i + 1]; if (nx === undefined || nx.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = nx; i++; }
}
const BASE = args.url ?? process.env.PREVIEW_BASE;
const OUT = args.out ?? 'shots/rv/v1/cheese';
const W = 1280, H = 720, STEP_MS = 1000 / 60;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
const fails = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) fails.push(name); };

async function boot(browser, query, { forceSlot1 = false } = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow(); let manual = false; let virt = 0; const q = [];
    window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.evaluate((force) => {
    window.__clk.manual();
    const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
    layer.sync = (s) => {
      window.__st = s;
      if (force && s.fighters[1] && !s.fighters[1].item.equipped.includes('blue_cheese')) {
        s.fighters[1].item.equipped.push('blue_cheese');
        s.fighters[1].item.lastUsed?.push?.(-Infinity);
      }
      return orig(s);
    };
    const st = window.__stage; window.__realRender = st.render.bind(st);
    st.render = (dt) => st.rig.update(dt);
  }, forceSlot1);
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 400; i++) {
    const ph = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
    if (ph === 'playing') break;
  }
  await page.evaluate((ms) => window.__clk.pump(90, ms), STEP_MS);   // 1.5 s of play: the churn has moved
  return page;
}

/** Frozen-instant render pair + the projected aura circle of each wearer. */
async function shoot(page) {
  return page.evaluate(() => {
    const stage = window.__stage; const rig = stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
    const grab = () => { window.__realRender(0); const cv = document.createElement('canvas'); cv.width = stage.canvas.width; cv.height = stage.canvas.height; cv.getContext('2d').drawImage(stage.canvas, 0, 0); return cv.toDataURL('image/png'); };
    const full = grab();
    const mesh = stage.scene.getObjectByName('vfx_blue_cheese');
    const was = mesh?.visible ?? false;
    if (mesh) mesh.visible = false;
    const off = grab();
    if (mesh) mesh.visible = was;
    const st = window.__st;
    const cam = stage.rig.camera;
    const proj = (x, z) => { const v = cam.position.clone().set(x, 0.34, z).project(cam); return { x: (v.x + 1) / 2 * stage.canvas.width, y: (1 - v.y) / 2 * stage.canvas.height }; };
    const wearers = st.fighters.map((f, slot) => ({ slot, f })).filter(({ f }) => f.alive && f.item.equipped.includes('blue_cheese')).map(({ slot, f }) => {
      const cx = f.x * 0.05, cz = f.y * 0.05, r = 84 * 0.05;
      const c = proj(cx, cz);
      // screen radius: the smallest projected distance of 16 rim points (the circle is an ellipse at 58 deg)
      const rs = Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2; const p = proj(cx + Math.cos(a) * r, cz + Math.sin(a) * r); return { a, p }; });
      return { slot, c, rim: rs.map(({ p }) => p) };
    });
    return { full, off, wearers, instances: mesh?.geometry?.instanceCount ?? null, meshFound: !!mesh, cw: stage.canvas.width, ch: stage.canvas.height };
  });
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function oklab(r, g, b) {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, Bb)];
}

/** Is (x,y) inside the polygon through the projected rim points, scaled by k about c? */
function insideScaled(rim, c, k, x, y) {
  let inside = false;
  for (let i = 0, j = rim.length - 1; i < rim.length; j = i++) {
    const xi = c.x + (rim[i].x - c.x) * k, yi = c.y + (rim[i].y - c.y) * k;
    const xj = c.x + (rim[j].x - c.x) * k, yj = c.y + (rim[j].y - c.y) * k;
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

async function analyse(tag, shot) {
  const dec = async (url) => sharp(Buffer.from(url.split(',')[1], 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const A = await dec(shot.full); const B = await dec(shot.off);
  writeFileSync(`${OUT}/${tag}_full.png`, Buffer.from(shot.full.split(',')[1], 'base64'));
  writeFileSync(`${OUT}/${tag}_off.png`, Buffer.from(shot.off.split(',')[1], 'base64'));
  const { width: w, height: h } = A.info;
  const moved = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d >= 6) moved.push(i);
  }
  const res = { tag, moved: moved.length, instances: shot.instances, meshFound: shot.meshFound, wearers: shot.wearers.map((q) => q.slot) };
  if (moved.length && shot.wearers.length) {
    let Ld = 0, Lu = 0, Cd = 0, Cu = 0;
    for (const i of moved) { const [l1, c1] = oklab(A.data[i], A.data[i + 1], A.data[i + 2]); const [l2, c2] = oklab(B.data[i], B.data[i + 1], B.data[i + 2]); Ld += l1; Lu += l2; Cd += c1; Cu += c2; }
    const n = moved.length;
    Object.assign(res, { drawnL: +(Ld / n).toFixed(3), underL: +(Lu / n).toFixed(3), drawnC: +(Cd / n).toFixed(3), underC: +(Cu / n).toFixed(3) });
    for (const q of shot.wearers) {
      let in112 = 0, in085 = 0;
      for (const i of moved) { const p = i / 3; const x = p % w, y = Math.floor(p / w); if (insideScaled(q.rim, q.c, 1.12, x, y)) in112++; if (!insideScaled(q.rim, q.c, 0.85, x, y)) in085++; }
      res[`slot${q.slot}_inside112`] = +(in112 / n).toFixed(3);
      res[`slot${q.slot}_beyond085`] = +(in085 / n).toFixed(3);
    }
  }
  console.log(JSON.stringify(res));
  return res;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const results = {};
  try {
    const common = 'screen=match&pointerLock=0&fogRadius=1700&px=2200&py=1400';
    let page = await boot(browser, `${common}&player=hamburger&enemy=taco&items=blue_cheese`);
    results.wearer = await analyse('wearer', await shoot(page)); await page.close();
    page = await boot(browser, `${common}&player=hamburger&enemy=taco`);
    results.control = await analyse('control', await shoot(page)); await page.close();
    page = await boot(browser, `screen=match&pointerLock=0&fogRadius=1700&fighters=${encodeURIComponent('hamburger@2200,1400;taco@2330,1400;pizza@600,600')}`, { forceSlot1: true });
    results.wearer2 = await analyse('wearer2', await shoot(page)); await page.close();
  } finally { await browser.close(); }
  writeFileSync(`${OUT}/cheese.json`, JSON.stringify(results, null, 2));

  const w = results.wearer, c = results.control, w2 = results.wearer2;
  check('wearer: the item is equipped in state (fixture)', w.wearers.includes(0), JSON.stringify(w.wearers));
  check('wearer: the cloud moves pixels (non-empty FIRST)', w.moved > 0, `${w.moved} px`);
  check('wearer: >= 95% of moved px inside 1.12 r', (w.slot0_inside112 ?? 0) >= 0.95, String(w.slot0_inside112));
  check('wearer: the cloud reaches its boundary (>= 2% of moved px beyond 0.85 r)', (w.slot0_beyond085 ?? 0) >= 0.02, String(w.slot0_beyond085));
  check('wearer: NOT loud — chroma within +0.03 of the ground under it', w.drawnC !== undefined && w.drawnC - w.underC <= 0.03, `${w.drawnC} vs ${w.underC}`);
  check('wearer: NOT loud — |dL| <= 0.08', w.drawnL !== undefined && Math.abs(w.drawnL - w.underL) <= 0.08, `${w.drawnL} vs ${w.underL}`);
  check('control (KNOWN-BAD for "drawn"): no item -> nothing moves', c.moved === 0 && c.wearers.length === 0, `${c.moved} px, wearers ${JSON.stringify(c.wearers)}`);
  check('control: the mesh draws no instances', !c.meshFound || c.instances === 0, String(c.instances));
  check('wearer2: a NON-local wearer is drawn (follows the item, not the camera)', w2.wearers.includes(1) && w2.moved > 0 && (w2.slot1_inside112 ?? 0) >= 0.95, `${w2.moved} px, inside ${w2.slot1_inside112}`);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
  process.exitCode = fails.length ? 1 : 0;
}
await main().catch((e) => { console.error(e); process.exitCode = 1; });
