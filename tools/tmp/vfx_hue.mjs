#!/usr/bin/env node
/**
 * VFX HUE-CONTRACT INSTRUMENT.
 *
 * The arena contract (`src/arena/shared.ts` ~L362 and ~L601, `src/arena/hazards.ts`
 * ~L241) splits the wheel three ways: WALKABLE rose-mauve 330-340 + teal 198-206,
 * BLOCKING violet 258-268, and **0-60 deg reserved for the cast, the hazards and the
 * VFX**. So the interesting question is NOT "is VFX allowed to be warm" — it
 * explicitly is — it is the one the brief actually asks:
 *
 *     can a player tell an EFFECT from a CHARACTER from the FLOOR?
 *
 * Hue alone cannot answer that, because the cast and the VFX are contractually in the
 * same band. This measures all three populations the same way, in the same frame, and
 * reports the separation on every axis at once:
 *
 *   CAST    pixels the player's own model owns (found by a visibility matte, not a
 *           guessed screen box)
 *
 * ⚠️ DO NOT QUOTE THIS TOOL'S "covers% of cast" COLUMN. Its matte is a HIDE-DIFF —
 * every pixel that changes when the character is hidden — and hiding a fighter also
 * deletes the SHADOW it throws on the floor, so the matte is silhouette + shadow
 * (measured 5,255 px against the true drawn silhouette's 1,540). Any floor-level wash
 * tints the shadow and scores here as "repainted the fighter" while the fighter is
 * untouched. Measured divergence on the same frame, same instant: the arbitrated giant
 * slam reads **73.2% here and 9.7%** on `tools/tmp/vfx_wcov.mjs`'s intersection matte
 * (hide-diff AND repaints-magenta), and the judgement PNG shows a completely readable
 * hamburger — so 9.7% is the true one. `vfx_wcov.mjs` is the tool for rule 2.
 *
 * The HUE / SAT / LUMA / warm% columns are unaffected: they are computed over the
 * EFFECT's own changed pixels and never touch the matte. Rule 1 (clear cast luma
 * 0.302 by >= 0.15) and rule 4 (nothing in blocking violet 258-268) are still this
 * tool's to answer, and `|dL cast|` uses only the CAST population's mean luma, which
 * a shadow shifts by far less than it shifts a coverage count.
 *   ENV     every other pixel in the frozen frame
 *   EFFECT  the pixels an effect changes, at its own measured peak
 *
 * Per effect it reports mean hue / saturation / luma, the share of its delivered
 * pixels inside 0-60 deg, and — the number that decides the question — what fraction
 * of the CAST's own pixels the effect paints over.
 *
 *   node tools/tmp/vfx_hue.mjs --url <snapshot-url>
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

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
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = args.out ?? 'shots/vfx/hue';
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = W / 2, RH = H / 2;
const DELTA = 6;
const PLAYER = args.player ?? 'hamburger';

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
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
      window.__clk = {
        pause() { if (!paused) { virt = realNow() - base; paused = true; } },
        advance(ms) { virt += ms; },
      };
      performance.now = () => (paused ? virt : realNow() - base);
    });
    await page.goto(`${BASE}/?player=${PLAYER}&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: '.hud-countdown{display:none !important}' });
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);

    await page.evaluate(([rw, rh, delta]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas');
      cv.width = rw; cv.height = rh;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      let base = null;

      const grab = () => {
        stage.render(0);
        ctx.clearRect(0, 0, rw, rh);
        ctx.drawImage(stage.canvas, 0, 0, rw, rh);
        return ctx.getImageData(0, 0, rw, rh).data;
      };
      const hsl = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        let h = 0;
        if (d > 1e-6) {
          if (mx === r) h = ((g - b) / d) % 6;
          else if (mx === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h *= 60; if (h < 0) h += 360;
        }
        const l = (mx + mn) / 2;
        const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
        return [h, s, l];
      };
      /** Saturation-weighted circular hue mean + plain sat/luma means over an index
       * set. Weighting by saturation matters: a near-white pixel has a hue, and it is
       * meaningless — averaging it unweighted drags every population toward whatever
       * the achromatic pixels happen to round to. */
      const stats = (img, idx) => {
        let sx = 0, sy = 0, wsum = 0, ssum = 0, lsum = 0, warm = 0, chroma = 0;
        for (const p of idx) {
          const i = p * 4;
          const [h, s, l] = hsl(img[i], img[i + 1], img[i + 2]);
          const a = (h * Math.PI) / 180;
          sx += Math.cos(a) * s; sy += Math.sin(a) * s; wsum += s;
          ssum += s; lsum += l; chroma += s * l;
          if (h < 60) warm += s;
        }
        const n = idx.length || 1;
        let hm = (Math.atan2(sy, sx) * 180) / Math.PI; if (hm < 0) hm += 360;
        return {
          n: idx.length,
          hue: +hm.toFixed(1),
          sat: +(ssum / n).toFixed(3),
          luma: +(lsum / n).toFixed(3),
          warmShare: +(wsum > 0 ? warm / wsum : 0).toFixed(3),
          chroma: +(chroma / n).toFixed(4),
        };
      };

      window.__hue = {
        setBase() { base = grab(); },
        /** Indices whose pixels moved by >= delta since `setBase`. */
        changed() {
          const cur = grab();
          const idx = [];
          for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
            const d = Math.max(
              Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
            if (d >= delta) idx.push(p);
          }
          return idx;
        },
        current() { return grab(); },
        baseImg() { return base; },
        stats,
        step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
        reset() { window.__vfxLayer.clear(); },
      };
    }, [RW, RH, DELTA]);

    // ── The three populations ──────────────────────────────────────────────────
    const pops = await page.evaluate((pid) => {
      const stage = window.__stage;
      const root = stage.scene.getObjectByName(`character:${pid}`);
      window.__hue.setBase();
      const baseImg = Uint8ClampedArray.from(window.__hue.baseImg());
      root.visible = false;
      const castIdx = window.__hue.changed();       // pixels that VANISHED = the cast
      root.visible = true;
      window.__hue.setBase();                        // re-baseline with the cast back
      const total = baseImg.length / 4;
      const castSet = new Set(castIdx);
      const envIdx = [];
      for (let p = 0; p < total; p++) if (!castSet.has(p)) envIdx.push(p);
      window.__castSet = castSet;
      return {
        cast: window.__hue.stats(baseImg, castIdx),
        env: window.__hue.stats(baseImg, envIdx),
        castCoverage: +(castIdx.length / total * 100).toFixed(2),
      };
    }, PLAYER);

    console.log(`\nviewport ${W}x${H}  readback ${RW}x${RH}  player=${PLAYER}`);
    console.log(`CAST matte covers ${pops.castCoverage}% of frame (arena-scan expects ~0.2-3%)`);
    console.log(`  CAST  hue ${String(pops.cast.hue).padStart(5)}  sat ${pops.cast.sat}  luma ${pops.cast.luma}  warmShare ${pops.cast.warmShare}  n=${pops.cast.n}`);
    console.log(`  ENV   hue ${String(pops.env.hue).padStart(5)}  sat ${pops.env.sat}  luma ${pops.env.luma}  warmShare ${pops.env.warmShare}  n=${pops.env.n}`);

    const cases = [
      ['cast flash', ['cast', 14, '#FFC93C'], 100],
      ['impact dmg6', ['impact', 6, '#FFC93C'], 220],
      ['impact dmg18', ['impact', 18, '#FFC93C'], 320],
      ['impact E63946', ['impact', 12, '#E63946'], 220],
      ['impact BFEFFF', ['impact', 12, '#BFEFFF'], 220],
      ['death', ['death', 14, '#E63946'], 450],
      ['heal', ['heal', 14, '#6FE0A8'], 16],
      ['meleeArc', ['meleeArc', 12, '#FFC93C', 'hamburger', 'Smash'], 16],
      ['giantSlam', ['giantSlam', 10, '#E63946', 'lollipop', 'Giant'], 220],
      ['puddleSplash', ['puddleSplash', 4, '#E8F8FF'], 16],
      // Added 2026-08-05 with the effects themselves. `coverScuff` is new; `slam FIRED`
      // is what `spawnWeaponCast` now composes for one `weapon-fired` event, which is
      // the thing a player sees — the `giantSlam` row above is one PASS of it and can
      // pass the contract while the sum fails it.
      ['coverScuff', ['coverScuff', 12, '#BFEFFF'], 100],
      ['slam FIRED', ['weaponFired', 10, '#E63946', 'lollipop', 'Giant'], 220],
    ];

    console.log('\neffect                 hue    sat   luma  warm%  |ΔL cast|  covers% of cast   verdict');
    console.log('─'.repeat(96));
    const rows = [];
    for (const [label, fire, peakMs] of cases) {
      const r = await page.evaluate(async ([fireSpec, ms]) => {
        window.__hue.reset();
        window.__hue.setBase();
        const f = window.__vfxDebugFighters.player;
        const [kind, amount, color, who, wk] = fireSpec;
        window.__vfxSpawnTest(kind, f.x, f.y, amount, color, who, wk);
        window.__hue.step(ms);
        const idx = window.__hue.changed();
        const cur = window.__hue.current();
        let over = 0;
        for (const p of idx) if (window.__castSet.has(p)) over++;
        window.__hue.reset();
        return { s: window.__hue.stats(cur, idx), over, castN: window.__castSet.size };
      }, [fire, peakMs]);
      const dL = Math.abs(r.s.luma - pops.cast.luma);
      const coverPct = r.castN ? (r.over / r.castN) * 100 : 0;
      // The contract test: an effect either separates from the cast in VALUE
      // (|dL| >= 0.15) or it must not be painting over the cast's own pixels.
      const verdict = dL >= 0.15 ? 'VALUE-SEPARATED' : (coverPct < 25 ? 'off-cast' : 'COMPETES');
      console.log(`${label.padEnd(20)} ${String(r.s.hue).padStart(5)}  ${r.s.sat.toFixed(3)}  ${r.s.luma.toFixed(3)}  ${(r.s.warmShare * 100).toFixed(0).padStart(4)}%   ${dL.toFixed(3).padStart(6)}      ${coverPct.toFixed(1).padStart(5)}%       ${verdict}`);
      rows.push({ label, ...r.s, dLumaVsCast: +dL.toFixed(3), castCoveredPct: +coverPct.toFixed(1), verdict });
    }

    await writeFile(`${OUT}/hue.json`, JSON.stringify({ base: BASE, player: PLAYER, populations: pops, effects: rows }, null, 1));
    console.log(`\nwrote ${OUT}/hue.json`);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
