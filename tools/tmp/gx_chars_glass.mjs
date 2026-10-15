#!/usr/bin/env node
/**
 * GX_CHARS_GLASS — what the water bottle LOOKS like without its transmission pass, at both
 * shipped pitches, so the price measured by `gx_chars_draws.mjs` (the transmission pre-pass
 * re-renders every opaque object) can be weighed against a picture rather than a guess.
 *
 * Page-side only: every material with `transmission > 0` is set to 0 (and, in a third arm, to
 * an alpha-blended 0.55-opacity glass), rendered, captured, restored. No source edit.
 * Self-pair: the shipped arm is captured twice and must be byte-identical.
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_chars_glass.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = arg('out', 'shots/rv/audit/chars/cap/glass');
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const SHOT = (o) => {
  const s = window.__stage; const r = s.renderer; const rig = s.rig;
  rig.pitchDeg = o.pitch; rig.yawDeg = 0; rig.subjectFill = 0.6; rig.snapTo(0, 0);
  const mats = [];
  s.scene.traverse((x) => { const ms = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : []; for (const m of ms) if (m && m.transmission > 0) mats.push(m); });
  const saved = mats.map((m) => ({ m, t: m.transmission, tr: m.transparent, op: m.opacity, dw: m.depthWrite }));
  if (o.mode === 'off' || o.mode === 'alpha') for (const m of mats) { m.transmission = 0; m.needsUpdate = true; }
  if (o.mode === 'alpha') for (const m of mats) { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; m.needsUpdate = true; }
  r.info.autoReset = false; r.info.reset();
  s.render(0); s.render(0);
  const calls = r.info.render.calls; r.info.autoReset = true;
  const gl = r.getContext(); const W = r.domElement.width, H = r.domElement.height;
  const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
  for (const x of saved) { x.m.transmission = x.t; x.m.transparent = x.tr; x.m.opacity = x.op; x.m.depthWrite = x.dw; x.m.needsUpdate = true; }
  return { W, H, px: Array.from(b), calls, mats: mats.length };
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: 480, height: 600 }, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/preview.html?piece=character&id=waterbottle&anim=idle&t=1.5&shot=1&pitch=20&fill=0.6`, { waitUntil: 'networkidle', timeout: 180_000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 180_000 });
    const tiles = [];
    for (const pitch of [20, 58]) {
      const a = await page.evaluate(SHOT, { pitch, mode: 'shipped' });
      const a2 = await page.evaluate(SHOT, { pitch, mode: 'shipped' });
      const same = a.px.length === a2.px.length && a.px.every((v, i) => v === a2.px[i]);
      for (const mode of ['shipped', 'off', 'alpha']) {
        const res = mode === 'shipped' ? a : await page.evaluate(SHOT, { pitch, mode });
        console.log(`pitch ${pitch} ${mode.padEnd(8)} draws ${res.calls} · transmissive mats ${res.mats}${mode === 'shipped' ? ` · self-pair ${same ? 'IDENTICAL' : 'DIFFERS'}` : ''}`);
        tiles.push(await sharp(Buffer.from(res.px), { raw: { width: res.W, height: res.H, channels: 4 } }).flip().png().toBuffer());
      }
    }
    await sharp({ create: { width: 480 * 3, height: 600 * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .composite(tiles.map((t, i) => ({ input: t, left: (i % 3) * 480, top: Math.floor(i / 3) * 600 })))
      .png().toFile(join(OUT, 'waterbottle_glass.png'));
    console.log('wrote', join(OUT, 'waterbottle_glass.png'), '(rows: pitch 20, pitch 58; cols: shipped, transmission off, alpha glass)');
  } finally {
    await browser.close();
  }
}

if (IS_MAIN) await main();
