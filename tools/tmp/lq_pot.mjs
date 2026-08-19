#!/usr/bin/env node
/**
 * lq_pot — DOES THE ARENA'S BROTH DELIVER PIXELS? The question `PALETTE.broth` turns on.
 *
 * ## Why this had to be measured rather than read
 *
 * `PALETTE.broth` (`rules.ts:3087`) is NOT soup's private colour. `arena/shared.ts:1189`
 * builds `M.broth` from it and `arena/hazards.ts:137,257` put that material on `pot_broth`
 * (the boiling pot's surface) and `pot_bubble` (the bubbles on it). Moving it repaints part
 * of the ARENA, which is a `DECISIONS §73` decision and not a character one.
 *
 * Directly under that material, `shared.ts` carries:
 *
 *   > *"⚠️ BOTH OF THESE DELIVERED ZERO PIXELS AT EVERY STATION PROBED, ABLATED."*
 *
 * If that covered the broth, the change would be free. **It does not.** The comment's own
 * body names `kpal:flame` and `kpal:flameCore` — the two entries AFTER it — and contrasts
 * them with `pot_steam`, which moved the frame by 2,394-4,332 px in the same captures. So
 * "both of these" is the flame pair, and the broth's delivered area was never in it.
 *
 * ⚠️ And the stations that claim quotes — `pot_south (700:640)` and `pot_diagonal
 * (570:430)` — are **1× map coordinates**. `arena-scan.mjs` puts those stations at
 * **1400:1200** and **1140:940** on today's 2800×2000 map. The 1× playfield is exactly the
 * NW quadrant of the ×4 one, so a stale coordinate is still a LEGAL coordinate and nothing
 * in the tree can see the difference (`CLAUDE.md`'s stale-map-literal note). That does not
 * make the flame finding wrong — it was almost certainly right when taken — but it does
 * mean it cannot be re-quoted today, and neither can its silence about the broth.
 *
 * ## Method
 *
 * One page load per station, `requestAnimationFrame` frozen, camera shake zeroed, then:
 *
 *   SELF-PAIR   two captures, nothing touched. Must be **0 differing pixels**. An
 *               instrument that cannot tell "no change" from "cannot see change" makes
 *               every null result worthless — and CSS keyframes run on the document
 *               timeline, not rAF, so a frozen frame is not a still page (`AGENT-BRIEF`).
 *   CENSUS      the target meshes are counted and asserted **NON-EMPTY** before anything is
 *               concluded. `[].every()` is `true` and that vacuity has fired three times in
 *               this repo in one session.
 *   ABLATION    the material is forced to `#FF00FF`, emissive killed, and the frame must
 *               MOVE. A material whose ablation delivers 0 px is **BLIND, not innocent**.
 *   RETURN      the colour is put back and the frame must return to the baseline.
 *
 * ## Usage
 *
 *   node tools/tmp/lq_pot.mjs --url <base> [--out <dir>] [--json <file>]
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import sharp from 'sharp';

const argv = process.argv;
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

const BASE = (arg('--url', null) ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('lq_pot: no --url and no PREVIEW_BASE (:5173 is banned, rule 2)'); process.exit(2); }
const OUT = arg('--out', 'tools/tmp/lq_pot_shots');
const JSON_OUT = arg('--json', null);
const W = Number(arg('--w', 1300));
const H = Number(arg('--h', 740));

/**
 * `arena-scan.mjs`'s own pot stations, PARSED from its table rather than retyped.
 *
 * `CLAUDE.md`: a stale map literal stays a LEGAL coordinate — the 1× playfield is exactly
 * the NW quadrant of the ×4 one — so no legality check can see one, and `arena-scan`'s own
 * history has four stations silently becoming "four MID-NORTH-WEST stations on a map four
 * times the size" while every guard stayed green. This file already had to correct one such
 * quote (see the header: the `700:640` / `570:430` in `shared.ts` are 1× coordinates), so
 * retyping today's values here would be repeating the exact mistake it documents.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(arg('--root', resolve(HERE, '../..')));
const scanSrc = await readFile(join(ROOT, 'tools/arena-scan.mjs'), 'utf8');
const sharedSrc = await readFile(join(ROOT, 'src/arena/shared.ts'), 'utf8');
const constOf = (n) => {
  const m = sharedSrc.match(new RegExp(`export const ${n}\\s*=\\s*(-?[0-9.]+)`));
  if (!m) throw new Error(`lq_pot: could not read ${n} from src/arena/shared.ts`);
  return Number(m[1]);
};
/** The fog is opened past the map's own half-diagonal so nothing is culled by it. */
const FOG = Math.ceil(Math.hypot(constOf('ARENA_W') / 2, constOf('ARENA_H') / 2));
const STATIONS = ['pot_south', 'pot_diagonal', 'hub_north'].map((id) => {
  const m = scanSrc.match(new RegExp(`\\{\\s*id:\\s*'${id}',\\s*x:\\s*(-?[0-9.]+),\\s*y:\\s*(-?[0-9.]+)`));
  if (!m) throw new Error(`lq_pot: station '${id}' not found in tools/arena-scan.mjs`);
  return { id, x: Number(m[1]), y: Number(m[2]) };
});
if (STATIONS.length === 0) { console.error('lq_pot: empty station set — nothing to measure'); process.exit(2); }
console.log(`lq_pot: stations ${STATIONS.map((s) => `${s.id}@${s.x},${s.y}`).join(' ')}  fog ${FOG}`);

/** Names `arena/hazards.ts` gives the two meshes that wear `M.broth`. */
const TARGETS = ['pot_broth', 'pot_bubble__no_outline'];

const raw = async (p) => sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const diff = (A, B) => {
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return -1;
  let n = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) n++;
  }
  return n;
};

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
await mkdir(OUT, { recursive: true });
const report = [];
try {
  for (const st of STATIONS) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.addInitScript(() => {
      let virt = 0;
      performance.now = () => virt;
      window.__lqclk = { advance(ms) { virt += ms; } };
    });
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,'
        + 'prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;'
        + 'export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
    }));
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${FOG}&pointerLock=0`,
      { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.evaluate(async (frames) => {
      for (let i = 0; i < frames; i++) {
        window.__lqclk.advance(16.667);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => requestAnimationFrame(() => r()));
      }
    }, 90);

    const census = await page.evaluate((names) => {
      const stage = window.__stage;
      const rig = stage.rig;
      if (rig) { rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply(); }
      const hits = [];
      stage.scene.traverse((o) => { if (o.isMesh && names.includes(o.name)) hits.push(o); });
      window.__lqTargets = hits;
      // The frame is rendered by this call and by nothing else from here on: rAF is left
      // running but the clock never advances again, so the sim is stopped.
      stage.render(0);
      return {
        found: hits.length,
        names: hits.map((m) => m.name),
        materials: [...new Set(hits.map((m) => m.material.uuid))].length,
        color: hits[0] ? `#${hits[0].material.color.getHexString().toUpperCase()}` : null,
        visible: hits.filter((m) => m.visible).length,
      };
    }, TARGETS);

    const shot = async (tag) => {
      const p = `${OUT}/${st.id}__${tag}.png`;
      await page.locator('canvas').first().screenshot({ path: p, animations: 'disabled' });
      return p;
    };
    const a1 = await shot('a1_shipped');
    const a2 = await shot('a2_selfpair');
    const rawA1 = await raw(a1);
    const selfPair = diff(rawA1, await raw(a2));
    // ── A SECOND, STRONGER CONTROL: RE-RENDER WITH NOTHING TOUCHED ────────────────────
    // `selfPair` above re-SCREENSHOTS one rendered frame, so it controls for capture noise
    // and for CSS keyframes — and it reads 0. It does NOT control for `stage.render()`
    // itself, which re-runs `updateContactShadows()` and `scheduleShadowUpdate()` every
    // call. That difference is real and it is why the RETURN arm would not come back to 0:
    // the residual is the RENDER's own noise floor, not the material. Measure it instead of
    // guessing at it — an unvalidated baseline manufactures a regression as convincingly as
    // a real bug does (`AGENT-BRIEF` §4.7).
    await page.evaluate(() => { window.__stage.render(0); });
    const a3 = await shot('a3_renderpair');
    const renderPair = diff(rawA1, await raw(a3));

    // ⚠️ THE RETURN ARM CAUGHT A BUG IN THIS TOOL AND THAT IS WHY IT IS HERE. The first
    // version killed `emissive` on ablation and restored only `color`, so the frame came
    // back 1,448-3,091 px away from its own baseline — an "unrepeatable" reading that was
    // entirely the instrument's. Everything touched is now saved and put back.
    await page.evaluate(() => {
      window.__lqSaved = window.__lqTargets.map((m) => ({
        color: m.material.color.getHex(),
        emissive: m.material.emissive ? m.material.emissive.getHex() : null,
      }));
      for (const m of window.__lqTargets) {
        // ⚠️ NO `needsUpdate`. `color`/`emissive` are UNIFORMS, uploaded every frame; the
        // flag forces a PROGRAM RECOMPILE, and a recompile is NOT pixel-neutral in this
        // renderer — with it set, the RETURN arm came back 679-2,121 px off its own
        // baseline while SELF-PAIR was 0, i.e. the instrument, not the scene.
        m.material.color.set('#FF00FF');
        if (m.material.emissive) m.material.emissive.set('#000000');
      }
      window.__stage.render(0);
    });
    const abl = await shot('b_ablated');
    const moved = diff(rawA1, await raw(abl));

    await page.evaluate(() => {
      window.__lqTargets.forEach((m, i) => {
        const s = window.__lqSaved[i];
        m.material.color.setHex(s.color);
        if (m.material.emissive && s.emissive !== null) m.material.emissive.setHex(s.emissive);
      });
      window.__stage.render(0);
    });
    const ret = await shot('c_returned');
    const returned = diff(rawA1, await raw(ret));

    const row = { ...st, ...census, selfPair, renderPair, ablatedPx: moved, returnedPx: returned };
    report.push(row);
    // The ablation must clear the RENDER noise floor by a wide margin, not merely be
    // non-zero. `renderPair` is that floor, measured on this station, this load.
    const floor = Math.max(renderPair, returned);
    const verdict = census.found === 0 ? 'NO TARGET MESH'
      : selfPair !== 0 ? 'INVALID (capture self-pair non-zero)'
        : moved <= floor * 2 ? `BLIND / inside the render noise floor (${floor} px)`
          : `${moved} delivered px (${(moved / (W * H) * 100).toFixed(3)}% of frame), ${(moved / Math.max(floor, 1)).toFixed(1)}x the ${floor} px floor`;
    console.log(`${st.id.padEnd(14)} meshes ${census.found} (${census.materials} material) `
      + `selfPair ${selfPair}  renderPair ${renderPair}  ablation ${moved}  return ${returned}  → ${verdict}`);
    await page.close();
  }
  const bad = report.filter((r) => r.found === 0 || r.selfPair !== 0);
  if (report.length === 0) { console.log('\nlq_pot: NO STATIONS RAN — nothing was measured.'); process.exitCode = 1; }
  else if (bad.length) console.log(`\n⚠️ ${bad.length} station(s) invalid: ${bad.map((b) => b.id).join(', ')}`);
  else {
    const total = report.reduce((s, r) => s + r.ablatedPx, 0);
    const clear = report.filter((r) => r.ablatedPx > Math.max(r.renderPair, r.returnedPx) * 2);
    console.log(`\nAll ${report.length} stations valid. Broth delivered ${total} px across them, `
      + `clearing the render floor at ${clear.length}/${report.length} stations — `
      + (clear.length === 0 ? 'BLIND everywhere: the arena broth is invisible and PALETTE.broth is free to move.'
        : 'the arena broth IS on screen; PALETTE.broth is an ARENA change (DECISIONS §73), not a soup one.'));
  }
  if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(report, null, 2));
} finally { await browser.close(); }
