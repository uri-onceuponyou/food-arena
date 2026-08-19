#!/usr/bin/env node
/**
 * WI_SHOT — the picture, at BOTH cameras. `wv_sheet.mjs` does this at pitch 58 only.
 *
 * CLAUDE.md #3 has two halves and the second one is the one that gets skipped:
 * *"Judge rendered pixels. Read the PNG with the Read tool and actually look at it"*
 * AND *"there are two shipped cameras and they expose different defects — the lobby
 * rig (`charStage.ts` pitch 20) is the better DETECTOR."* `wv_sheet.mjs` carries no
 * `--pitch` at all (grepped: zero occurrences), so every judgement PNG this weapon
 * programme has produced is from the match rig. This file is the lobby half.
 *
 * 🔴 **EVERY TILE IS THE SAME CROP RECTANGLE AT THE SAME SCALE**, which is
 * `wv_sheet.mjs`'s rule and it is the whole point: cropping each tile to its own
 * effect's bounding box normalises exactly the quantity the sheet exists to show, and
 * a 139 px sculpt blown up to fill its tile looks like a perfectly good effect.
 *
 * The frame captured is the PEAK slice for that weapon, found the same way `wi_guard`
 * finds it (step through the schedule, keep the frame with the most changed pixels),
 * so a before/after pair is comparing each effect at its own best moment rather than
 * at a fixed millisecond one of them happens to be past.
 *
 * ⚠️ CSS keyframes run on the document timeline and are NOT stilled by freezing rAF,
 * and `page.screenshot({clip})` is a PAGE capture (`docs/AGENT-BRIEF.md` §3). Every
 * animation is paused and the still-running count is printed, so "0" is a measurement.
 * Camera shake is zeroed before every render for the same reason `wv_area.mjs` does it.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wi-after -- \
 *     node tools/tmp/wi_shot.mjs --url '{URL}' --pitch 20 --tag after
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
if (!BASE) { console.error('wi_shot: --url or PREVIEW_BASE required'); process.exit(2); }
const OUT = String(arg('out', 'shots/wi'));
const TAG = String(arg('tag', 'run'));
const PITCH = Number(arg('pitch', 58));
const DETECT_WIDTH = Number(arg('detectWidth', 150));
const SEED = Number(arg('seed', 777));
/** The four shortest rows of `209e270` plus one that already passed, as a control:
 * if the passing one changes as much as the failing ones, the change is not targeted. */
const WEAPONS = String(arg('weapons', 'burrito.Swarm,pizza.Tomato,lollipop.Smash,egg.Shards,sushi.Catch')).split(',');
const SLICES = [16, 80, 160, 260, 400];
const W = 1600, H = 900;
/** Fraction of the frame kept around the caster. Fixed for every tile and every run. */
const CROP_W = Number(arg('cropW', 0.34));
const CROP_H = Number(arg('cropH', 0.46));

const log = (...a) => console.log(...a);

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'wi-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
    + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

async function main() {
  await mkdir(OUT, { recursive: true });
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
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const running = await page.evaluate(PAGE_STILL_HUD);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);

    /* eslint-disable */
    await page.evaluate(([RW, RH, D]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas');
      cv.width = RW; cv.height = RH;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      let base = null;
      const still = () => {
        const r = stage.rig; if (!r) return;
        r.shakeAmount = 0;
        if (r.shakeOffset && r.shakeOffset.set) r.shakeOffset.set(0, 0, 0);
      };
      const grab = () => {
        still(); stage.render(0);
        c2.clearRect(0, 0, RW, RH); c2.drawImage(stage.canvas, 0, 0, RW, RH);
        return c2.getImageData(0, 0, RW, RH).data;
      };
      window.__wi = {
        setBase() { base = grab(); },
        count() {
          const cur = grab(); let n = 0;
          for (let i = 0; i < cur.length; i += 4) {
            const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
            if (d >= D) n++;
          }
          return n;
        },
        bbox() {
          const cur = grab();
          let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
          for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
            const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
            if (d >= D) {
              n++;
              const x = p % RW, y = (p / RW) | 0;
              if (x < minx) minx = x; if (x > maxx) maxx = x;
              if (y < miny) miny = y; if (y > maxy) maxy = y;
            }
          }
          return { n, minx, miny, maxx, maxy };
        },
        step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
        reset() { window.__vfxLayer.clear(); },
        still,
        setPitch(deg, widthUnits) {
          const rig = stage.rig; if (!rig) return null;
          const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
          rig.pitchDeg = deg;
          if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
          rig.apply();
          return saved;
        },
      };
    }, [W / 2, H / 2, 6]);
    /* eslint-enable */

    if (PITCH !== 58) {
      const saved = await page.evaluate(([p, w]) => window.__wi.setPitch(p, w), [PITCH, DETECT_WIDTH]);
      log(`camera: ${saved.pitch} -> ${PITCH} deg, ${saved.mode} -> ground, ${saved.width} -> ${DETECT_WIDTH} wu`);
    }

    const at = await page.evaluate(() => {
      const p = window.__vfxDebugFighters.player;
      return { x: p.x, y: p.y };
    });
    /**
     * The crop RECTANGLE, computed once and then held fixed for every tile in the run.
     *
     * ⚠️ NOT from `window.__vfxDebugScreen.player`, which is the obvious source and is
     * WRONG here: `match.ts` writes it from the render loop, this probe has already
     * replaced `requestAnimationFrame` with a no-op, and the `--pitch 20` re-pitch
     * happens after that — so at the lobby camera that field still holds the pitch-58
     * projection and every tile would be cropped around a point the caster is not at.
     * Calibrating off a deliberately enormous impact fired at the same world position
     * is camera-agnostic by construction and needs no projection maths.
     */
    const cal = await page.evaluate(async ([f]) => {
      window.__wi.reset(); window.__wi.step(0); window.__wi.setBase();
      window.__vfxSpawnTest('impact', f.x, f.y, 30, '#FF00FF');
      window.__wi.step(160);
      const b = window.__wi.bbox();
      window.__wi.reset();
      return b;
    }, [at]);
    if (!cal || !cal.n) { console.error('wi_shot: the calibration impact changed 0 px — the crop would be a guess'); process.exitCode = 1; return; }
    // Readback is half-size; scale back to viewport pixels.
    const cx = ((cal.minx + cal.maxx) / 2) * 2;
    const cy = ((cal.miny + cal.maxy) / 2) * 2;
    log(`calibration impact: ${cal.n} px, bbox centre ${Math.round(cx)},${Math.round(cy)} in viewport pixels`);
    const cw = Math.round(W * CROP_W), ch = Math.round(H * CROP_H);
    const clip = {
      x: Math.max(0, Math.min(W - cw, Math.round(cx - cw / 2))),
      y: Math.max(0, Math.min(H - ch, Math.round(cy - ch / 2))),
      width: cw, height: ch,
    };
    log(`crop ${JSON.stringify(clip)}  (effect centre ${Math.round(cx)},${Math.round(cy)})`);

    const tiles = [];
    for (const spec of WEAPONS) {
      const [id, key] = spec.split('.');
      // Find the peak slice first (pixels only), then re-fire and screenshot AT it.
      const peak = await page.evaluate(async ([w, sl]) => {
        const rules = await import('/src/game/rules.ts');
        const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
        if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };
        window.__wi.reset(); window.__wi.step(0); window.__wi.setBase();
        window.__rng.seed(w.seed);
        window.__vfxLayer.spawnImpactBurst(w.x, w.y, weapon.color, weapon.damage,
          { weapon, characterId: w.id, fromXWU: w.x - 60, fromYWU: w.y });
        let prev = 0; let best = -1; let bestT = 0;
        for (const t of sl) { window.__wi.step(t - prev); prev = t; const n = window.__wi.count(); if (n > best) { best = n; bestT = t; } }
        window.__wi.reset();
        return { best, bestT, damage: weapon.damage };
      }, [{ id, key, x: at.x, y: at.y, seed: SEED }, SLICES]);
      if (peak.err) { log(`${spec}: ${peak.err}`); continue; }

      await page.evaluate(async ([w, upto]) => {
        const rules = await import('/src/game/rules.ts');
        const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
        window.__wi.reset(); window.__wi.step(0);
        window.__rng.seed(w.seed);
        window.__vfxLayer.spawnImpactBurst(w.x, w.y, weapon.color, weapon.damage,
          { weapon, characterId: w.id, fromXWU: w.x - 60, fromYWU: w.y });
        window.__wi.step(upto);
        window.__wi.still();
        window.__stage.render(0);
      }, [{ id, key, x: at.x, y: at.y, seed: SEED }, peak.bestT]);
      const png = await page.screenshot({ clip });
      await page.evaluate(() => window.__wi.reset());
      tiles.push({ spec, png, peak: peak.best, at: peak.bestT, damage: peak.damage });
      log(`${spec.padEnd(20)} peak ${String(peak.best).padStart(6)} px @ ${peak.bestT} ms  (damage ${peak.damage})`);
    }

    if (!tiles.length) { console.error('wi_shot: no tile was rendered'); process.exitCode = 1; return; }

    const labelH = 34;
    const composite = [];
    for (let i = 0; i < tiles.length; i++) {
      composite.push({ input: tiles[i].png, left: i * cw, top: labelH });
      const svg = `<svg width="${cw}" height="${labelH}"><rect width="${cw}" height="${labelH}" fill="#111"/>`
        + `<text x="8" y="23" font-family="monospace" font-size="18" fill="#eee">${tiles[i].spec} — ${tiles[i].peak} px</text></svg>`;
      composite.push({ input: Buffer.from(svg), left: i * cw, top: 0 });
    }
    const bannerH = 30;
    const banner = `<svg width="${cw * tiles.length}" height="${bannerH}"><rect width="${cw * tiles.length}" height="${bannerH}" fill="#000"/>`
      + `<text x="8" y="21" font-family="monospace" font-size="17" fill="#8f8">${TAG} — pitch ${PITCH} — identical crop ${cw}x${ch} for every tile, peak slice</text></svg>`;
    const outPath = `${OUT}/wi_shot.${TAG}.p${PITCH}.png`;
    await sharp({ create: { width: cw * tiles.length, height: ch + labelH + bannerH, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } } })
      .composite([...composite.map((c) => ({ ...c, top: c.top + bannerH })), { input: Buffer.from(banner), left: 0, top: 0 }])
      .png().toFile(outPath);
    log(`wrote ${outPath}`);
    await writeFile(`${OUT}/wi_shot.${TAG}.p${PITCH}.json`, JSON.stringify({
      pitch: PITCH, tag: TAG, seed: SEED, clip, tiles: tiles.map(({ spec, peak, at: t, damage }) => ({ spec, peak, at: t, damage })),
    }, null, 1));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
