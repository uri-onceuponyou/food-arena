#!/usr/bin/env node
/**
 * LK1_SWEEP — candidate broth colours, rendered, cropped to the bowl, on one sheet.
 *
 * Uri: *"make the liquid more yellow than brown"*. `PALETTE.broth` is #E8792A, hue
 * 24.9 — orange. Choosing the replacement by arithmetic alone is exactly the failure
 * CLAUDE.md rule 3 names (judging a description instead of an image), and the
 * arithmetic is genuinely misleading here: sRGB luma weights GREEN at 0.7152, so
 * rotating orange -> yellow at constant HSL lightness RAISES luma by ~0.15, straight
 * at `CERAMIC`'s 0.722 — the cream rim the broth disc physically touches at the match
 * camera. So each candidate must be LOOKED AT against that rim.
 *
 * It repaints the SHIPPED materials in the page (no source edit, no `clone()` — see
 * CLAUDE.md rule 5: `Material.clone()` silently drops `onBeforeCompile`), asserts the
 * repaint matched exactly the meshes it should, renders, and restores.
 *
 *   node tools/tmp/lk1_sweep.mjs --url $U --broth E8792A,CC9F0D,D9AE12,E8B41C
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
const CANDS = get('--broth', 'E8792A').split(',').map((s) => s.trim().replace(/^#/, '').toUpperCase());
const OUT = get('--out', 'shots/lk1/sweep');
const W = 900, H = 1150;

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

/** hex -> {h,s,l} with h in degrees, s/l in 0..1. */
function toHsl(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
function fromHsl(h, s, l) {
  const C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - C / 2;
  let rgb;
  if (h < 60) rgb = [C, X, 0]; else if (h < 120) rgb = [X, C, 0]; else if (h < 180) rgb = [0, C, X];
  else if (h < 240) rgb = [0, X, C]; else if (h < 300) rgb = [X, 0, C]; else rgb = [C, 0, X];
  return rgb.map((v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255))
    .map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
const luma = (hex) => {
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return +((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255).toFixed(3);
};
/** The shipped pair #E8792A / #B85A16 is a −0.133 HSL-lightness step at the same hue.
 *  Rule 1 of the task: the pair is a VALUE STEP, so a candidate carries its own dark. */
const darkOf = (hex) => { const { h, s, l } = toHsl(hex); return fromHsl(h, Math.min(1, s * 0.975), Math.max(0.05, l - 0.133)); };

const STATIONS = [{ tag: 'lobby', pitch: 20, yaw: 0, crop: [165, 190, 570, 190] },
                  { tag: 'match', pitch: 58, yaw: 90, crop: [140, 150, 590, 460] }];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
let fails = 0;

for (const st of STATIONS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(`${BASE}/preview.html?piece=character&id=soup&pitch=${st.pitch}&yaw=${st.yaw}&t=1.5&anim=idle&shot=1`, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

  const tiles = [];
  for (const c of CANDS) {
    const d = darkOf(c);
    const matched = await page.evaluate(({ c, d }) => {
      const s = window.__stage; let n = 0;
      s.scene.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.color) return;
        if (o.name === 'soup_broth') { o.material.color.set('#' + c); n++; }
        if (o.name.startsWith('soup_broth_ring')) { o.material.color.set('#' + d); n++; }
      });
      s.scene.updateMatrixWorld(true); s.render(0);
      return n;
    }, { c, d });
    // MATCHED control — a repaint that matched nothing renders an unchanged frame,
    // which is indistinguishable from "this colour looks the same".
    if (matched !== 2) { console.log(`  ✗ MATCHED ${c}: repainted ${matched} meshes, expected 2`); fails++; }
    const buf = await page.locator('canvas').first().screenshot();
    const [x, y, w, h] = st.crop;
    const tile = await sharp(buf).extract({ left: x, top: y, width: w, height: h })
      .resize({ width: 760 }).toBuffer();
    tiles.push({ hex: c, dark: d, buf: tile });
    console.log(`  ${st.tag}  broth #${c} hsl(${toHsl(c).h.toFixed(0)}, ${(toHsl(c).s * 100).toFixed(0)}%, ${(toHsl(c).l * 100).toFixed(0)}%) luma ${luma(c)}   dark #${d} luma ${luma(d)}`);
  }
  await page.close();

  const meta = await sharp(tiles[0].buf).metadata();
  const th = meta.height, tw = meta.width, pad = 26;
  const sheet = sharp({ create: { width: tw, height: (th + pad) * tiles.length, channels: 3, background: { r: 20, g: 20, b: 24 } } });
  await sheet.composite(tiles.map((t, i) => ({ input: t.buf, left: 0, top: i * (th + pad) })))
    .png().toFile(`${OUT}/${st.tag}_sheet.png`);
  console.log(`[lk1_sweep] ${OUT}/${st.tag}_sheet.png  rows top→bottom: ${tiles.map((t) => '#' + t.hex).join(' , ')}`);
}
await browser.close();
process.exit(fails ? 1 : 0);
