#!/usr/bin/env node
/**
 * WV_PROJSHOT — LOOK AT THE FRAME. Six projectile rows measured shipped == generic to
 * the pixel while `wv_projdbg.mjs` proved the bespoke branch ran, and no further number
 * was going to settle it (CLAUDE.md #3: judging a description instead of an image is
 * this project's most common failure).
 *
 * Renders ONE weapon's synthetic projectile at a chosen offset, shipped and with
 * `projectile()` deleted, and writes both frames plus a per-offset pixel count — the
 * matrix reports the MAX over two offsets, which can hide a per-offset difference.
 *
 *   node tools/tmp/wv_projshot.mjs --url $U --weapon pizza.Dough
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('out', 'shots/wv/proj'));
const WEAPONS = String(arg('weapon', 'pizza.Dough')).split(',');
const W = 1600, H = 900, RW = 800, RH = 450, DELTA = 6;
const log = (...a) => console.log(...a);

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
    page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
    }));
    await page.addInitScript(() => {
      const realNow = performance.now.bind(performance);
      let paused = false; let virt = 0; let base = realNow();
      window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
      performance.now = () => (paused ? virt : realNow() - base);
      let st = 1;
      Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
      window.__rng = { seed(v) { st = ((v >>> 0) || 1); } };
    });
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__vfxDebugFighters, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}';
      document.head.appendChild(s);
      for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* done */ } }
    });
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);

    await page.evaluate(([rw, rh, d]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas'); cv.width = rw; cv.height = rh;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      let base = null;
      const still = () => { const r = stage.rig; if (r) { r.shakeAmount = 0; r.shakeOffset?.set(0, 0, 0); } };
      const grab = () => { still(); stage.render(0); c2.clearRect(0, 0, rw, rh); c2.drawImage(stage.canvas, 0, 0, rw, rh); return c2.getImageData(0, 0, rw, rh).data; };
      window.__ps = {
        setBase() { base = grab(); },
        countBox() {
          const cur = grab(); let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
          for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
            if (Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2])) >= d) {
              n++; const x = p % rw, y = (p / rw) | 0;
              if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
            }
          }
          return { n, bbox: n ? [minx, miny, maxx, maxy] : null };
        },
        render() { still(); stage.render(0); },
      };
    }, [RW, RH, DELTA]);

    for (const spec of WEAPONS) {
      const [cid, key] = spec.split('.');
      for (const [ox, oy] of [[40, 0], [0, 40]]) {
        for (const mode of ['shipped', 'generic']) {
          /**
           * 🚨 THE DELETE AND THE RESTORE MUST HAPPEN IN ONE `evaluate`, AND SO MUST
           * THE CAPTURE. `getWeaponVfx()` hands back THE SAME OBJECT the character
           * file exports, so a "restore by re-importing the module" reads from the
           * object the delete already emptied and silently restores nothing — the
           * first version of this file did exactly that. Functions do not cross the
           * evaluate boundary either, so the saved hook cannot be returned and
           * re-applied from Node.
           *
           * The capture therefore comes back as a data URL off `stage.canvas`, which
           * is also strictly better than `page.screenshot()`: it is a CANVAS readback,
           * so no DOM HUD keyframe can land in it (`docs/AGENT-BRIEF.md` §3).
           */
          const r = await page.evaluate(async ([id, k, m, dx, dy]) => {
            const rules = await import('/src/game/rules.ts');
            const reg = await import('/src/vfx/weapons/index.ts');
            const weapon = rules.CHARACTERS[id].weapons.find((x) => x.key === k);
            const v = reg.getWeaponVfx(id, k);
            let savedHook = null;
            if (m === 'generic' && v && typeof v.projectile === 'function') { savedHook = v.projectile; delete v.projectile; }
            try {
              const L = window.__vfxLayer;
              const f = window.__vfxDebugFighters.player;
              const mk = (c, x, y) => ({ characterId: c, x, y, hp: 100, maxHp: 100, alive: true, facing: { x: 1, y: 0 }, terrainSlowFactor: 1, status: { slowedUntil: 0, stunnedUntil: 0 } });
              const player = mk(id, f.x, f.y); const enemy = mk('donut', f.x + 200, f.y);
              const st = (ps) => ({ elapsed: 1000, projectiles: ps, splats: [], trailMarks: [], player, enemy, fighters: [player, enemy] });
              L.sync(st([])); window.__ps.setBase();
              window.__rng.seed(101);
              const len = Math.hypot(dx, dy) || 1;
              const p = { id: 991, ownerId: 0, targetId: 1, ownerRole: 'player', targetRole: 'enemy', weapon, x: f.x + dx, y: f.y + dy, vx: (dx / len) * (weapon.speed ?? 100), vy: (dy / len) * (weapon.speed ?? 100), traveled: len, damage: weapon.damage, color: weapon.color, emoji: weapon.emoji ?? '' };
              const s2 = st([p]);
              L.sync(s2); window.__clk.advance(16); s2.elapsed += 16; L.sync(s2); L.updateEffects(0.016);
              const c = window.__ps.countBox();
              window.__ps.render();
              const info = [];
              L.group.traverse((o) => { if (String(o.name).startsWith('projectile:')) info.push({ name: o.name, bespoke: !!o.userData.weaponVfx, vis: o.visible, pos: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)], scale: +o.scale.x.toFixed(3) }); });
              const png = window.__stage.canvas.toDataURL('image/png');
              L.sync(st([])); L.clear();
              return { n: c.n, bbox: c.bbox, info, png };
            } finally {
              if (savedHook) v.projectile = savedHook;
            }
          }, [cid, key, mode, ox, oy]);
          const tag = `${cid}.${key}.o${ox}_${oy}.${mode}`;
          await writeFile(`${OUT}/${tag}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
          log(`${tag.padEnd(38)} ${String(r.n).padStart(6)} px  bbox ${JSON.stringify(r.bbox)}  obj ${JSON.stringify(r.info)}`);
        }
      }
    }
    log(`\nPNGs -> ${OUT}/`);
  } finally {
    await browser.close();
  }
}
main();
