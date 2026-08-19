#!/usr/bin/env node
/**
 * WV_SHEET — THE PICTURE THAT ANSWERS URI'S QUESTION IN ONE GLANCE.
 *
 * `wv_area.mjs` produces the table. A table cannot show you that four weapons look
 * like nothing happened, because a table has no way to be looked at wrong. This does:
 * every weapon's impact (or cast), at the SHIPPED match camera, cropped IDENTICALLY,
 * tiled, and labelled with the number.
 *
 * ── THE ONE RULE THIS FILE EXISTS TO OBEY ───────────────────────────────────────
 *
 * 🔴 **EVERY TILE IS THE SAME CROP RECTANGLE AT THE SAME SCALE.** The obvious thing to
 * do — crop each tile to its own effect's bounding box — normalises exactly the
 * quantity the sheet is being made to show. A 36 px sculpt blown up to fill its tile
 * looks like a perfectly good effect; that is how "authored, correct, and effectively
 * invisible" survives a review. The crop here is a fixed window on the caster,
 * identical for all 33, so the tiles are directly comparable and a small effect LOOKS
 * small.
 *
 * ── AND THE ONE TRAP ────────────────────────────────────────────────────────────
 *
 * `page.screenshot()` is a PAGE capture, not a canvas readback: CSS keyframes run on
 * the document timeline and are NOT stilled by freezing `requestAnimationFrame`
 * (`docs/AGENT-BRIEF.md` §3 — one arena station self-paired at 471,742 px with rAF
 * already frozen, and 0 px once the CSS was stilled). Every animation is paused and
 * rewound before the first capture, and the count of still-running animations is
 * printed so "0" is a measurement rather than an assumption.
 *
 * Camera shake is zeroed before every render for the same reason `wv_area.mjs` does
 * it: at dt=0 `CameraRig.update` never exits its shake branch, so each `render()`
 * re-randomises the camera and consecutive tiles would be shot from different places.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wv -- \
 *     node tools/tmp/wv_sheet.mjs --url '{URL}' --beat impact
 *   node tools/tmp/wv_sheet.mjs --url $U --beat impact --pairs   # shipped | generic
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const has = (n) => process.argv.includes(`--${n}`);
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('out', 'shots/wv'));
const BEAT = String(arg('beat', 'impact'));
const PAIRS = has('pairs');
const SEED = Number(arg('seed', 101));
/** `char` or `char.Key`, comma separated. Used for the shipped|generic PAIRS sheet,
 * which is only worth making for the rows the matrix already flagged. */
const ONLY = arg('only', null) ? String(arg('only', '')).split(',') : null;
const W = 1600, H = 900;
/** Crop window size, in fractions of the frame. The POSITION is computed once from
 * `__vfxDebugScreen.player` — where the caster actually is on screen — and then held
 * FIXED for every tile. Same rectangle, same scale, every time; see the header. */
const CROP_W = Number(arg('cropW', 0.40));
const CROP_H = Number(arg('cropH', 0.52));
const COLS = Number(arg('cols', 6));
const TILE_W = Number(arg('tileW', 400));
const log = (...a) => console.log(...a);

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'wv-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
    + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* done */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function main() {
  await mkdir(`${OUT}/tiles`, { recursive: true });

  // Numbers from the matrix, if it has already run — the label is the point of the
  // sheet, and a tile that says "0.22x" next to a picture of nothing is the whole
  // argument. Absent, the sheet still builds and simply carries no ratio.
  let matrix = null;
  try { matrix = JSON.parse(await readFile(`${OUT}/wv_area.p58.json`, 'utf8')); } catch { /* optional */ }
  const rowFor = (id, key) => matrix?.results?.find((r) => r.id === id && r.key === key && r.beat === BEAT) ?? null;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
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
    const stillRunning = await page.evaluate(PAGE_STILL_HUD);
    log(`CSS animations still running after PAGE_STILL_HUD: ${stillRunning} (want 0)`);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const stage = window.__stage;
      const still = () => { const r = stage.rig; if (r) { r.shakeAmount = 0; r.shakeOffset?.set(0, 0, 0); } };
      window.__wvs = {
        render() { still(); stage.render(0); },
        step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
        reset() { window.__vfxLayer.clear(); },
      };
    });

    /**
     * ONE crop rectangle, computed from where the caster actually stands on screen and
     * then never changed. Hardcoding a fraction of the frame is how a sheet ends up
     * cropping the arena next to the effect; recomputing it per tile is how a 36 px
     * sculpt gets blown up to look fine. Neither.
     */
    const scr = await page.evaluate(() => (window.__vfxDebugScreen && window.__vfxDebugScreen.player) || null);
    const cw = Math.round(W * CROP_W); const ch = Math.round(H * CROP_H);
    const CLIP = {
      x: Math.max(0, Math.min(W - cw, Math.round((scr ? scr.x : W / 2) - cw / 2))),
      y: Math.max(0, Math.min(H - ch, Math.round((scr ? scr.y : H / 2) - ch * 0.55))),
      width: cw, height: ch,
    };
    log(`crop (fixed for every tile): ${JSON.stringify(CLIP)}  caster on screen at ${scr ? `${Math.round(scr.x)},${Math.round(scr.y)}` : 'UNKNOWN — fell back to frame centre'}`);

    const weapons = await page.evaluate(async () => {
      const rules = await import('/src/game/rules.ts');
      const reg = await import('/src/vfx/weapons/index.ts');
      const out = [];
      for (const [id, c] of Object.entries(rules.CHARACTERS)) {
        for (const w of c.weapons) {
          const v = reg.getWeaponVfx(id, w.key);
          out.push({
            id, key: w.key, name: w.name, type: w.type, color: w.color, damage: w.damage,
            hooks: v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [],
          });
        }
      }
      return out;
    });
    const wanted = ONLY ? weapons.filter((w) => ONLY.includes(w.id) || ONLY.includes(`${w.id}.${w.key}`)) : weapons;
    if (!wanted.length) { log(`--only matched nothing`); return; }
    log(`${wanted.length} of ${weapons.length} weapons, beat=${BEAT}${PAIRS ? ', shipped|generic pairs' : ''}`);

    const shoot = async (w, mode, ms) => {
      await page.evaluate(async ([ww, mode2, tms, kind, seed]) => {
        const rules = await import('/src/game/rules.ts');
        const reg = await import('/src/vfx/weapons/index.ts');
        const weapon = rules.CHARACTERS[ww.id].weapons.find((x) => x.key === ww.key);
        const v = reg.getWeaponVfx(ww.id, ww.key);
        const kill = kind === 'impact' ? ['impact'] : ['cast'];
        const saved = {};
        if (mode2 === 'generic' && v) for (const k of kill) if (typeof v[k] === 'function') { saved[k] = v[k]; delete v[k]; }
        window.__wvs.reset(); window.__wvs.step(0);
        const f = window.__vfxDebugFighters.player;
        window.__rng.seed(seed);
        // The SHIPPED call `match.ts` makes, with the attacker position it always
        // supplies — `__vfxSpawnTest` cannot pass it and 11 of 27 bespoke impacts
        // draw differently without it (measured, `wv_area.mjs`'s DIRECTION control).
        if (kind === 'impact') window.__vfxLayer.spawnImpactBurst(f.x, f.y, weapon.color, weapon.damage, { weapon, characterId: ww.id, fromXWU: f.x - 60, fromYWU: f.y });
        else window.__vfxLayer.spawnWeaponCast(f.x, f.y, { x: 1, y: 0 }, weapon, ww.id);
        if (tms > 0) window.__wvs.step(tms);
        window.__wvs.render();
        // Restore INSIDE the same evaluate, before the screenshot is taken outside it:
        // the frame is already rendered, and leaving a hook deleted across an await is
        // how an ablation leaks into every later tile.
        if (mode2 === 'generic' && v) Object.assign(v, saved);
      }, [w, mode, ms, BEAT, SEED]);
      const buf = await page.screenshot({ clip: CLIP });
      await page.evaluate(() => window.__wvs.reset());
      return buf;
    };

    // Baseline tile: the arena with NOTHING fired. Without it a reader cannot tell a
    // weak effect from a strong one — the eye needs to know what "nothing" looks like,
    // and this is the sheet's own null arm.
    await page.evaluate(() => { window.__wvs.reset(); window.__wvs.step(0); window.__wvs.render(); });
    const emptyTile = await page.screenshot({ clip: CLIP });

    const tiles = [{ label: 'NOTHING FIRED (baseline)', sub: 'the null arm — what "no effect" looks like', buf: emptyTile, flag: 'base' }];
    for (const w of wanted) {
      const row = rowFor(w.id, w.key);
      const ms = row?.peakAtMs ?? 160;
      const hasHook = w.hooks.includes(BEAT === 'impact' ? 'impact' : 'cast');
      const ratio = row ? row.ratio : null;
      const px = row ? row.shippedPx : null;
      const flag = !hasHook ? 'none' : (ratio !== null && ratio < 0.5 ? 'red' : (ratio !== null && ratio < 0.8 ? 'amber' : 'ok'));
      const sub = `${px !== null ? `${px} px` : ''}${ratio !== null ? `   ${ratio.toFixed(2)}x generic` : ''}${hasHook ? '' : '   (no bespoke hook)'}`;
      const buf = await shoot(w, 'shipped', ms);
      await writeFile(`${OUT}/tiles/${BEAT}.${w.id}.${w.key}.png`, buf);
      tiles.push({ label: `${w.id}.${w.key}`, sub, buf, flag });
      if (PAIRS && hasHook) {
        const g = await shoot(w, 'generic', ms);
        await writeFile(`${OUT}/tiles/${BEAT}.${w.id}.${w.key}.generic.png`, g);
        tiles.push({ label: `${w.id}.${w.key}  GENERIC`, sub: row ? `${row.genericPx} px — the control` : 'the control', buf: g, flag: 'ctl' });
      }
      log(`  ${w.id}.${w.key.padEnd(10)} @${String(ms).padStart(4)}ms  ${sub}`);
    }

    // ── Compose ────────────────────────────────────────────────────────────────
    const BAR = 54;
    const COLOR = { red: '#ff4d4d', amber: '#ffab3d', ok: '#8ee08e', none: '#7b7b8c', base: '#5aa9ff', ctl: '#7b7b8c' };
    const built = [];
    for (const t of tiles) {
      const img = await sharp(t.buf).resize({ width: TILE_W }).toBuffer();
      const m = await sharp(img).metadata();
      const bar = Buffer.from(
        `<svg width="${m.width}" height="${BAR}"><rect width="100%" height="100%" fill="#12121c"/>`
        + `<rect width="6" height="100%" fill="${COLOR[t.flag] ?? '#7b7b8c'}"/>`
        + `<text x="16" y="24" font-family="Helvetica,Arial" font-size="19" fill="#f2f2f8">${esc(t.label)}</text>`
        + `<text x="16" y="45" font-family="Helvetica,Arial" font-size="15" fill="${COLOR[t.flag] ?? '#9a9aae'}">${esc(t.sub)}</text></svg>`);
      built.push(await sharp({ create: { width: m.width, height: m.height + BAR, channels: 3, background: '#12121c' } })
        .composite([{ input: bar, left: 0, top: 0 }, { input: img, left: 0, top: BAR }]).png().toBuffer());
    }
    const m0 = await sharp(built[0]).metadata();
    const rows = Math.ceil(built.length / COLS);
    const GAP = 10;
    const SW = COLS * m0.width + (COLS + 1) * GAP;
    const SH = rows * m0.height + (rows + 1) * GAP;
    const comp = built.map((b, i) => ({
      input: b,
      left: GAP + (i % COLS) * (m0.width + GAP),
      top: GAP + Math.floor(i / COLS) * (m0.height + GAP),
    }));
    const outFile = `${OUT}/wv_sheet.${BEAT}${PAIRS ? '.pairs' : ''}.png`;
    await sharp({ create: { width: SW, height: SH, channels: 3, background: '#08080e' } })
      .composite(comp).png().toFile(outFile);
    log(`\nwrote ${outFile}  ${SW}x${SH}  (${built.length} tiles, identical crop, identical scale)`);
  } finally {
    await browser.close();
  }
}
main();
