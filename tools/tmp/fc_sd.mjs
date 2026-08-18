#!/usr/bin/env node
/**
 * fc_sd — DOES THE CANOPY STILL SWALLOW THE SCREEN AT SUDDEN DEATH?
 *
 * The registration fix in `fogRing.ts:update` replaces a rigid translation with a
 * homothety that SCALES the canopy by `k = (Cy − CANOPY_Y) / Cy` ≈ 0.858. On the ground
 * plane that is provably coverage-neutral — projecting a `k`-scaled circle about the
 * camera nadir returns the authored circle exactly — but "provably" is how the 1500 wu
 * `FIELD_OUTER_UNITS` survived a ×4 map change, so it is measured here instead.
 *
 * Sudden death (`?fogRadius=0`) is the case that matters: `SUDDEN_DEATH_RADIUS` is 0,
 * every fighter is outside, and the canopy is supposed to cover the entire frame. It is
 * also a defect this project has already fixed once (`779dc62`, `>0` → `>=0`), so a
 * silent regression here would land on top of a closed bug.
 *
 * ── THE CONTROL IS THE WHOLE TEST ────────────────────────────────────────────
 * A dark frame proves nothing on its own. The reference numbers, measured on the
 * shipped build before this change (`DECISIONS`, `mg_fog.mjs`): a correct sudden-death
 * frame is **~72 mean luma**; the FAULT — no boundary drawn at all — is **~130.6**,
 * statistically the same as the **~132.3** no-fog control. So the wide-ring arm in this
 * table is the positive control that says which end of that range we are at, and a run
 * where the two arms come out the SAME is a run that measured nothing.
 *
 * Usage:  node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/fc_sd.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const BASE = arg('url', process.env.PREVIEW_BASE ?? null);
if (!BASE) { console.error('fc_sd: need --url or PREVIEW_BASE'); process.exit(2); }
const W = Number(arg('w', 1280)), H = Number(arg('h', 720));

// `&simSpeed=0.05` is load-bearing: sudden death does 50 HP/s to everyone, so at real
// speed the match ENDS in ~2 s and `update()`'s `active` flag correctly fades the
// boundary out — an earlier run of this measurement elsewhere photographed six cells of
// an already-ended match and passed for the wrong reason (`mg_fog.mjs`).
const CELLS = [
  { id: 'suddenDeath', q: '&fogRadius=0&simSpeed=0.05' },
  { id: 'wideRing', q: '&fogRadius=1600&simSpeed=0.05' },
  { id: 'noFogCtl', q: '&simSpeed=0.05' },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
const rows = [];
try {
  for (const c of CELLS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?player=hamburger&enemy=donut${c.q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
    await page.waitForFunction(`(() => { const d = window.__matchDebug; return d && d.phase === 'playing'; })()`,
      null, { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(900);
    const info = await page.evaluate(`(() => {
      const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
      let fog = null; st.scene.traverse((o) => { if (!fog && o.name === 'fog_boundary') fog = o; });
      let canopy = null; if (fog) fog.traverse((o) => { if (o.name === 'fog_canopy__no_outline') canopy = o; });
      let curtain = null; if (fog) fog.traverse((o) => { if (o.name === 'fog_curtain__no_outline') curtain = o; });
      return {
        phase: window.__matchDebug ? window.__matchDebug.phase : null,
        fogVisible: fog ? fog.visible : 'NO fog_boundary',
        safeRadiusWU: curtain ? curtain.scale.x / 0.05 : null,
        canopyScale: canopy ? canopy.scale.x : null,
        zone: (document.querySelector('.hud-zone-label') || {}).textContent ?? null,
      };
    })()`);
    const url = await page.evaluate(`(() => {
      const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
      return st.renderer.domElement.toDataURL('image/png');
    })()`);
    await ctx.close();
    const { data, info: ii } = await sharp(Buffer.from(url.split(',')[1], 'base64')).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    let s = 0; const n = ii.width * ii.height;
    for (let i = 0; i < n; i++) s += 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    rows.push({ ...c, luma: s / n, ...info });
  }
} finally { await browser.close(); }

console.log('\n══ fc_sd — mean whole-frame luma ══');
for (const r of rows) {
  console.log(`   ${r.id.padEnd(12)} luma ${r.luma.toFixed(1).padStart(6)}   safeRadius ${String(r.safeRadiusWU === null ? '—' : r.safeRadiusWU.toFixed(2)).padStart(8)}`
    + `   canopy scale ${String(r.canopyScale === null ? '—' : r.canopyScale.toFixed(4)).padStart(7)}`
    + `   fog.visible ${String(r.fogVisible).padEnd(5)}   phase ${String(r.phase).padEnd(8)}   HUD "${r.zone}"`);
}
const sd = rows.find((r) => r.id === 'suddenDeath');
const nf = rows.find((r) => r.id === 'noFogCtl');
const wr = rows.find((r) => r.id === 'wideRing');
// NON-EMPTY before any verdict: a missing cell must not be arithmetic'd into a PASS.
if (!sd || !nf || !wr) { console.log('\n🚨 a cell is missing — nothing here may be quoted.'); process.exit(1); }
const swallowed = nf.luma - sd.luma;
const discriminates = Math.abs(nf.luma - sd.luma) > 20;
console.log(`\n   ${discriminates ? '✅' : '🚨'} SUDDEN DEATH DARKENS THE FRAME BY ${swallowed.toFixed(1)} luma`
  + ` (${sd.luma.toFixed(1)} vs a no-fog control of ${nf.luma.toFixed(1)}).`);
console.log(`      the KNOWN FAULT signature is these two being the SAME picture (130.6 vs 132.3 on 779dc62's known-bad).`);
console.log(`   wide-ring positive control: luma ${wr.luma.toFixed(1)} at safeRadius ${wr.safeRadiusWU?.toFixed(2)}`);
process.exitCode = discriminates ? 0 : 1;
