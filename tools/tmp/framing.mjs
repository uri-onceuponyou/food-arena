#!/usr/bin/env node
/**
 * FRAMING — how big is a character on screen, measured off RENDERED PIXELS, and what
 * would it cost to make it bigger.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────
 *
 * `docs/LESSONS.md` §6: "Measure sizes off a rendered frame, not by trigonometry. Two
 * agents computed the character's on-screen height as 13% and 7%; the truth is ~10.5%.
 * One ignored camera pitch, the other over-corrected for it." Any answer to "are the
 * characters too small" that is derived from `fov`, `pitch` and a right-angle triangle
 * has already been wrong twice on this project. So this hides the character, renders,
 * shows it, renders again, and takes the bounding box of what changed.
 *
 * Shadows are disabled on BOTH renders. Without that the diff bbox includes the
 * character's own contact shadow, which on a 58-degree camera extends well past its
 * feet and would inflate every number here — the same "the mask is not of the thing
 * you think" fault `docs/LESSONS.md` §5 records.
 *
 * ── What it sweeps, and why THAT ───────────────────────────────────────────────
 *
 * `CameraRig` exposes `pitchDeg`, `fov` and `fairRadiusUnits` as plain fields with an
 * `apply()`, so all three can be swept live on one booted page — no rebuild, no
 * snapshot per value. For each setting it reports BOTH the measured character height
 * AND `__fairView().guaranteedRadiusUnits`, because those two numbers are the whole
 * trade: `camera.ts`'s fair-play rectangle is a COMPETITIVE guarantee (every viewport
 * sees the same distance in every direction), and a character that is bigger because
 * the camera came closer has bought that size out of the guarantee.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/framing.mjs --url {URL}
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

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
const OUT = String(args.out ?? 'shots/feel');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const CHARS = (args.chars ? String(args.chars).split(',') : ['donut', 'hamburger', 'lollipop', 'egg']);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
    // ⚠️ The virtual clock is LOAD-BEARING here, not a convenience. `measure()` renders
    // twice (character hidden, character shown) and diffs. Under SwiftShader a render
    // costs ~100 ms of real time, so without this every time-driven shader in the scene
    // — the fog ring's pulse, puddle shimmer, arena ambient — moves BETWEEN the two
    // frames and lands in the diff. Measured with the clock running, the shipped
    // configuration reported a character 154 px tall while a CLOSER camera one row below
    // reported 66 px: two numbers that cannot both be true. Freezing `performance.now()`
    // makes the two renders differ in exactly one thing, which is the whole method.
    await page.addInitScript(() => {
      const realNow = performance.now.bind(performance);
      let paused = false; let virt = 0; let base = realNow();
      performance.now = () => (paused ? virt : realNow() - base);
      window.__clk = {
        pause() { if (!paused) { virt = realNow() - base; paused = true; } },
        resume() { if (paused) { base = realNow() - virt; paused = false; } },
      };
    });
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
    }));

    // Warm-up load, discarded. `window.__stage` is a single slot overwritten by the
    // last Stage constructed (docs/TOOLS.md), and on the very first navigation of a
    // fresh browser the first character consistently measured 0 px — the harness was
    // holding a Stage that was no longer the match's.
    await page.goto(`${BASE}/?player=donut&enemy=hamburger&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForTimeout(1200);

    const rows = [];
    for (const id of CHARS) {
      await page.goto(`${BASE}/?player=${id}&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__clk.pause());
      await page.waitForTimeout(300);

      await page.evaluate(([w, h]) => {
        const stage = window.__stage;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        const grab = () => {
          stage.render(0);
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(stage.canvas, 0, 0, w, h);
          return ctx.getImageData(0, 0, w, h).data;
        };
        window.__fr = {
          /**
           * Silhouette bbox of one character, by ablation. `visible = false` on the
           * model root removes the character AND its shadow, so the shadow map is
           * turned off for both renders — otherwise the bbox is of character-plus-
           * shadow, which on this camera is nearly twice as tall.
           */
          measure(name, opts) {
            let root = null;
            stage.scene.traverse((o) => { if (o.name === name) root = o; });
            if (!root) return null;
            const sm = stage.renderer.shadowMap.enabled;
            stage.renderer.shadowMap.enabled = false;
            root.visible = false;
            const off = grab();
            // `opts.nullControl` leaves the character HIDDEN for the second render too.
            // Everything this returns must then be zero; anything else is the harness
            // measuring its own noise and no other number here is trustworthy.
            root.visible = !(opts && opts.nullControl);
            const on = grab();
            root.visible = true;
            stage.renderer.shadowMap.enabled = sm;
            // ⚠️ A raw min/max bbox is NOT usable here and reported 154 px against a
            // true ~78 px. Cropping the reported box and looking at it (which is the
            // only reason this was caught) showed the character sitting in the BOTTOM
            // THIRD of it, with the top edge out on empty blue floor: a handful of
            // stray pixels — post-chain ringing at the edge of a bright object — set
            // `miny` 130 px above anything solid. The FILL count was right the whole
            // time; only the extent was wrong, which is exactly the failure mode a
            // number cannot show you and a crop can.
            //
            // So the extent is taken from the row/column PROFILE with a minimum
            // occupancy, not from the outermost lit pixel.
            const rowsN = new Int32Array(h), colsN = new Int32Array(w);
            let n = 0;
            for (let i = 0, p = 0; i < on.length; i += 4, p++) {
              const d = Math.max(
                Math.abs(on[i] - off[i]), Math.abs(on[i + 1] - off[i + 1]), Math.abs(on[i + 2] - off[i + 2]),
              );
              if (d < 10) continue;
              n++;
              rowsN[(p / w) | 0]++; colsN[p % w]++;
            }
            if (n === 0) return { px: 0 };
            // Occupancy threshold is a FRACTION OF THE PEAK ROW, not a constant. A
            // constant of 3 still let a ~100-row tall, 3-4 px wide artefact above the
            // character set the top edge, and any constant is arbitrary against a
            // subject whose size is the thing being measured. 15% of the peak row is
            // scale-free and survives the sweep, where the subject's own width changes
            // by 2x between the first and last row of the table.
            const peakRow = Math.max(...rowsN), peakCol = Math.max(...colsN);
            const occR = Math.max(2, peakRow * 0.15), occC = Math.max(2, peakCol * 0.15);
            let miny = -1, maxy = -1, minx = -1, maxx = -1;
            for (let y = 0; y < h; y++) if (rowsN[y] >= occR) { if (miny < 0) miny = y; maxy = y; }
            for (let x = 0; x < w; x++) if (colsN[x] >= occC) { if (minx < 0) minx = x; maxx = x; }
            if (miny < 0) return { px: n, w: 0, h: 0, bbox: null, heightPct: 0, widthPct: 0, fillPct: 0 };
            return {
              px: n, w: maxx - minx + 1, h: maxy - miny + 1, bbox: [minx, miny, maxx, maxy],
              peakRow, peakCol,
              heightPct: +(100 * (maxy - miny + 1) / h).toFixed(2),
              widthPct: +(100 * (maxx - minx + 1) / w).toFixed(2),
              fillPct: +(100 * n / (w * h)).toFixed(3),
            };
          },
          view() { return window.__fairView(); },
          /**
           * Scale a character model in place.
           *
           * This prices the ONE lever that raises on-screen size with no balance cost.
           * `CHARACTER_HEIGHT` (units.ts, 2.1 m) is purely visual: the sim collides on
           * `PLAYER_SIZE` (42 wu, rules.ts) and `CHARACTER_RADIUS` is derived from that
           * 42 independently of `CHARACTER_HEIGHT`, so a taller cast changes no
           * simulation number and cannot move the fair-play radius or `aspect.mjs`.
           * Scaling the root here is not a proposal to ship — it is how the claim gets
           * MEASURED instead of computed.
           */
          scaleChar(name, k) {
            let root = null;
            stage.scene.traverse((o) => { if (o.name === name) root = o; });
            if (root) root.scale.setScalar(k);
            return !!root;
          },
          /** Set a rig field and re-apply. Returns the new ground window. */
          set(field, value) {
            const rig = stage.rig;
            if (field === 'fov') { rig.camera.fov = value; rig.camera.updateProjectionMatrix(); }
            else rig[field] = value;
            rig.apply();
            return window.__fairView();
          },
        };
      }, [Math.round(W / 2), Math.round(H / 2)]);

      const view = await page.evaluate(() => window.__fr.view());
      const nul = await page.evaluate((n) => window.__fr.measure(n, { nullControl: true }), `character:${id}`);
      if (nul.px > 60) {
        log(`  ⚠️ NULL CONTROL FAILED for ${id}: ${nul.px} px changed with the character hidden in BOTH`
          + ` renders. The harness is measuring drift, not the character. Numbers below are void.`);
      }
      const m = await page.evaluate((n) => window.__fr.measure(n), `character:${id}`);
      rows.push({ id, view, m, nullPx: nul.px });
      log(`${pad(id, 12)}height ${pad(m.heightPct + '%', 9)}width ${pad(m.widthPct + '%', 9)}`
        + `${pad(m.w + 'x' + m.h + ' px', 14)}fill ${pad(m.fillPct + '%', 9)}`
        + `cam ${view.distanceM.toFixed(2)} m · R ${view.guaranteedRadiusUnits.toFixed(2)} wu (${view.binding}) · null ${nul.px} px`);
      await page.screenshot({ path: `${OUT}/framing-${id}.png` });
    }

    const mean = rows.reduce((s, r) => s + r.m.heightPct, 0) / rows.length;
    log(`\nMEAN measured character height: ${mean.toFixed(2)}% of frame height`
      + `   (reference band, hand-measured on Brawl Stars plates: 14-21%)`);

    // ── The sweep: what would each lever actually buy? ─────────────────────────
    // Back on the last character loaded, so every row below is the same subject and
    // the only thing changing is the camera.
    const id = CHARS[CHARS.length - 1];
    log(`\n══ WHAT EACH LEVER BUYS (subject: ${id}, measured, not computed) ═════════`);
    log(`${pad('lever', 26)}${pad('height %', 11)}${pad('vs now', 9)}${pad('cam m', 9)}${pad('guaranteed R wu', 18)}binding`);
    log('-'.repeat(96));
    // Re-measure the shipped configuration THROUGH `set()`, so the baseline and every
    // sweep row go down the identical code path. Measuring the baseline before any
    // `set()` and the rows after it made the shipped row read 34.22% against 14.67%
    // for a CLOSER camera one line below — two numbers that cannot both be true, which
    // is the tell that they were not the same measurement.
    await page.evaluate(() => window.__fr.set('fairRadiusUnits', 199.22));
    const base = await page.evaluate((n) => window.__fr.measure(n), `character:${id}`);
    const baseView = await page.evaluate(() => window.__fr.view());
    log(`  [baseline bbox ${JSON.stringify(base.bbox)} = ${base.w}x${base.h} px]`);
    const sweep = [];
    const record = async (label, field, value) => {
      const v = await page.evaluate(([f, x]) => window.__fr.set(f, x), [field, value]);
      const mm = await page.evaluate((n) => window.__fr.measure(n), `character:${id}`);
      sweep.push({ label, field, value, heightPct: mm.heightPct, view: v });
      log(`${pad(label, 26)}${pad(mm.heightPct + '%', 11)}${pad('x' + (mm.heightPct / base.heightPct).toFixed(2), 9)}`
        + `${pad(v.distanceM.toFixed(2), 9)}${pad(v.guaranteedRadiusUnits.toFixed(2), 18)}${v.binding}`);
    };
    log(`${pad('SHIPPED (58 deg, R 199.2)', 26)}${pad(base.heightPct + '%', 11)}${pad('x1.00', 9)}`
      + `${pad(baseView.distanceM.toFixed(2), 9)}${pad(baseView.guaranteedRadiusUnits.toFixed(2), 18)}${baseView.binding}`);

    // Levers that DO NOT touch the guarantee.
    for (const p of [50, 54, 62, 68]) await record(`pitch ${p} deg`, 'pitchDeg', p);
    await page.evaluate(() => window.__fr.set('pitchDeg', 58));
    for (const f of [26, 44, 55]) await record(`fov ${f} deg`, 'fov', f);
    await page.evaluate(() => window.__fr.set('fov', 34));

    // The lever that DOES: shrinking the guaranteed radius itself.
    for (const r of [190.7, 165.2, 157, 143.2, 128.8]) await record(`fair radius ${r} wu`, 'fairRadiusUnits', r);
    await page.evaluate(() => window.__fr.set('fairRadiusUnits', 199.2185));

    // And the lever with NO balance cost — see `scaleChar`.
    for (const [k, m] of [[1.24, 2.6], [1.38, 2.9]]) {
      await page.evaluate(([n, kk]) => window.__fr.scaleChar(n, kk), [`character:${id}`, k]);
      const mm = await page.evaluate((n) => window.__fr.measure(n), `character:${id}`);
      const v = await page.evaluate(() => window.__fr.view());
      sweep.push({ label: `model height ${m} m`, field: 'modelScale', value: k, heightPct: mm.heightPct, view: v });
      log(`${pad(`model height ${m} m (x${k})`, 26)}${pad(mm.heightPct + '%', 11)}${pad('x' + (mm.heightPct / base.heightPct).toFixed(2), 9)}`
        + `${pad(v.distanceM.toFixed(2), 9)}${pad(v.guaranteedRadiusUnits.toFixed(2), 18)}${v.binding}  ← no balance cost`);
    }
    await page.evaluate(([n]) => window.__fr.scaleChar(n, 1), [`character:${id}`]);

    await writeFile(`${OUT}/framing.json`, JSON.stringify({ rows, base, baseView, sweep }, null, 2));
    log(`\njson -> ${OUT}/framing.json`);
  } finally {
    await browser.close();
  }
}

await main();
