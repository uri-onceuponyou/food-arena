#!/usr/bin/env node
/**
 * sc2_icons — generate the PWA / home-screen icon set from ONE vector source.
 *
 * ── Why a generator and not four hand-drawn PNGs ────────────────────────────
 * A manifest without icons is not installable on Android (Chrome requires at least one
 * icon >= 144px), and an iPhone with no `apple-touch-icon` puts a SCREENSHOT OF THE PAGE
 * on the home screen — which, on this app, is the boot curtain reading "Heating the
 * kitchen…" on a dark purple field. So the icons are load-bearing for JOB 1, not decoration.
 *
 * Four sizes, one source, so they cannot drift:
 *
 *   icon-192.png              Android launcher / `any`
 *   icon-512.png              Android splash + install prompt / `any`
 *   icon-maskable-512.png     `purpose: maskable` — Android crops icons to a platform
 *                             shape (circle, squircle, teardrop). The spec guarantees only
 *                             the inner **80% circle** survives, so this variant re-draws
 *                             the same art at 0.72 scale on a full-bleed field. Shipping
 *                             only an `any` icon means Android letterboxes it inside a
 *                             white blob; shipping only a `maskable` one means every
 *                             non-masking surface shows the padding. Both are needed.
 *   apple-touch-icon-180.png  iOS home screen. iOS applies its own corner radius and does
 *                             NOT respect transparency (it composites onto black), so this
 *                             one is drawn full-bleed with an opaque background.
 *
 * ── The drawing is deliberately geometry-only ───────────────────────────────
 * No text, no emoji, no font. `sharp`'s SVG rasteriser (librsvg) has no access to this
 * machine's fonts in any guaranteed way, and an icon that renders here as a burger and on
 * a build box as a tofu box is exactly the class of failure `CLAUDE.md` #4 describes —
 * it would render *plausibly and wrongly*. Paths and circles render identically everywhere.
 *
 * Palette is taken from the app, not invented: `#C1272D` is `index.html`'s `theme-color`,
 * `#16101f` is the boot background, `#FFF3DE` is the boot text.
 *
 * ⚠️ READ THE PNGs. `node tools/tmp/sc2_icons.mjs --write` then open them with the Read
 * tool. A generator that emits a 512x512 field of flat red is a pass on every byte check
 * in this file.
 *
 * Usage:
 *   node tools/tmp/sc2_icons.mjs            # dry run: report what WOULD be written
 *   node tools/tmp/sc2_icons.mjs --write    # write into public/icons/
 *   node tools/tmp/sc2_icons.mjs --selftest # the known-bad-input proofs (no files written)
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'public', 'icons');
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const SELFTEST = argv.includes('--selftest');

// ── the palette, quoted from the app ────────────────────────────────────────
const BRAND_RED = '#C1272D';   // index.html `theme-color` — the ANCHOR, used at the rim
// The field is a two-stop radial AROUND that anchor rather than a fade to the boot
// background. The first draft faded `#C1272D` -> `#16101f` and the corners went near-black:
// at 48px the icon read as a dark blob with a bun in it, which is the opposite of the
// house style (`CLAUDE.md`: hyper-saturated, high-key, vinyl-toy — and do NOT desaturate).
const FIELD_HOT = '#E8453B';
const FIELD_RIM = '#8E1A20';
const DEEP = '#16101f';        // index.html boot background (kept: the maskable rim reference)
const CREAM = '#FFF3DE';       // index.html boot text
const BUN = '#F2A649';
const BUN_DARK = '#D9832E';
const PATTY = '#6B3A1F';
const LETTUCE = '#78C043';
const CHEESE = '#FFC93C';

/**
 * The artwork, in a 0..512 box, at `scale` about the centre.
 *
 * `scale` is the whole point of the parameter list: the maskable variant needs the SAME
 * drawing at 72% so that Android's 80%-circle guarantee cannot clip a bun.
 */
function art(scale) {
  const c = 256;
  const t = (x, y) => `${(c + (x - c) * scale).toFixed(2)} ${(c + (y - c) * scale).toFixed(2)}`;
  const r = (v) => (v * scale).toFixed(2);
  // Sesame seeds: fixed positions on the top bun, scaled with everything else.
  const seeds = [[196, 168], [256, 150], [316, 168], [226, 196], [286, 196]]
    .map(([x, y]) => `<ellipse cx="${(c + (x - c) * scale).toFixed(2)}" cy="${(c + (y - c) * scale).toFixed(2)}" rx="${r(15)}" ry="${r(11)}" fill="${CREAM}" opacity="0.92"/>`)
    .join('');
  return `
    <!-- top bun: a dome, drawn as a single cubic so the silhouette reads at 48px -->
    <path d="M ${t(96, 232)} C ${t(96, 128)} ${t(160, 84)} ${t(256, 84)} C ${t(352, 84)} ${t(416, 128)} ${t(416, 232)} Z" fill="${BUN}"/>
    ${seeds}
    <!-- lettuce: a scalloped band, so the stack has one non-rectangular edge -->
    <path d="M ${t(92, 246)} L ${t(420, 246)} L ${t(420, 268)} C ${t(392, 300)} ${t(360, 258)} ${t(328, 288)} C ${t(296, 316)} ${t(268, 262)} ${t(236, 290)} C ${t(204, 318)} ${t(172, 260)} ${t(140, 288)} C ${t(116, 306)} ${t(100, 282)} ${t(92, 268)} Z" fill="${LETTUCE}"/>
    <!-- cheese: two corners hanging over the patty -->
    <path d="M ${t(108, 276)} L ${t(404, 276)} L ${t(368, 344)} L ${t(320, 300)} L ${t(272, 348)} L ${t(224, 300)} L ${t(176, 344)} L ${t(144, 300)} Z" fill="${CHEESE}"/>
    <!-- patty -->
    <rect x="${(c + (100 - c) * scale).toFixed(2)}" y="${(c + (300 - c) * scale).toFixed(2)}" width="${r(312)}" height="${r(62)}" rx="${r(26)}" fill="${PATTY}"/>
    <!-- bottom bun -->
    <path d="M ${t(100, 366)} L ${t(412, 366)} L ${t(412, 396)} C ${t(412, 428)} ${t(384, 444)} ${t(340, 444)} L ${t(172, 444)} C ${t(128, 444)} ${t(100, 428)} ${t(100, 396)} Z" fill="${BUN_DARK}"/>`;
}

/**
 * @param size    output edge in px
 * @param scale   artwork scale about the centre (1 = full bleed, 0.72 = maskable-safe)
 * @param radius  corner radius in the 512-space, or 0 for a square field. Android and iOS
 *                both apply their OWN mask, so shipping our own rounded corners on top
 *                produces a double-rounded icon — hence 0 for maskable and apple-touch.
 */
function svg(size, scale, radius) {
  const clip = radius > 0
    ? `<clipPath id="c"><rect x="0" y="0" width="512" height="512" rx="${radius}"/></clipPath>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="78%">
      <stop offset="0%" stop-color="${FIELD_HOT}"/>
      <stop offset="62%" stop-color="${BRAND_RED}"/>
      <stop offset="100%" stop-color="${FIELD_RIM}"/>
    </radialGradient>
    ${clip}
  </defs>
  <g ${radius > 0 ? 'clip-path="url(#c)"' : ''}>
    <rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>
    ${art(scale)}
  </g>
</svg>`;
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 0.92, radius: 96 },
  { file: 'icon-512.png', size: 512, scale: 0.92, radius: 96 },
  // 0.72 keeps every drawn pixel inside the 80% safe circle the maskable spec guarantees.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72, radius: 0 },
  // iOS composites onto BLACK and rounds the corners itself — full bleed, square, opaque.
  { file: 'apple-touch-icon-180.png', size: 180, scale: 0.92, radius: 0 },
];

async function render(t) {
  return sharp(Buffer.from(svg(t.size, t.scale, t.radius)))
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ── selftest: the known-bad inputs ──────────────────────────────────────────
// A generator has two silent failure modes and both have shipped in this repo's history:
// it can emit a FLAT field (the drawing never rendered) and it can emit art that the
// platform mask CLIPS. Both pass "the file exists and is a valid PNG".
async function selftest() {
  const checks = [];
  const stats = async (buf) => sharp(buf).stats();

  const good = await render(TARGETS[1]);
  const s = await stats(good);
  // 1. NOT FLAT. A solid field has stdev 0 on every channel.
  const minStd = Math.min(...s.channels.map((c) => c.stdev));
  checks.push(['icon-512 is not a flat field (some channel varies)', minStd > 8, `min channel stdev ${minStd.toFixed(2)}`]);

  // 2. THE KNOWN-BAD: the same pipeline with the artwork removed must FAIL check 1.
  //    Without this, check 1 proves only that a gradient exists.
  const flat = await sharp({ create: { width: 512, height: 512, channels: 4, background: BRAND_RED } }).png().toBuffer();
  const fs_ = await stats(flat);
  const flatStd = Math.min(...fs_.channels.map((c) => c.stdev));
  checks.push(['KNOWN-BAD: an art-less field is REFUSED by check 1', !(flatStd > 8), `min channel stdev ${flatStd.toFixed(2)}`]);

  // 3. MASKABLE SAFETY, measured rather than asserted: every pixel that differs from the
  //    background field must lie inside the 80% safe circle. This is the check that would
  //    have caught shipping the `any` art as the maskable one.
  const mask = TARGETS[2];
  const raw = await sharp(Buffer.from(svg(512, mask.scale, mask.radius))).raw().toBuffer({ resolveWithObject: true });
  const bgOnly = await sharp(Buffer.from(svg(512, 0.0001, mask.radius))).raw().toBuffer({ resolveWithObject: true });
  const ch = raw.info.channels;
  let outside = 0;
  let inside = 0;
  const R = 512 * 0.4;   // the guaranteed safe zone is the inner 80% circle
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * ch;
      let d = 0;
      for (let k = 0; k < 3; k++) d += Math.abs(raw.data[i + k] - bgOnly.data[i + k]);
      if (d < 24) continue;                              // background, within rasteriser noise
      const dx = x - 256; const dy = y - 256;
      if (dx * dx + dy * dy > R * R) outside++; else inside++;
    }
  }
  checks.push(['maskable: artwork exists at all', inside > 20000, `${inside} px of art inside the safe circle`]);
  checks.push(['maskable: ZERO art pixels outside the 80% safe circle', outside === 0, `${outside} px outside`]);

  // 4. KNOWN-BAD for check 3, at TWO scales. The first arm is the mistake that would
  //    actually be made — shipping the `any` art (0.92) as the maskable one. It spills
  //    only ~8 px, which is a thin margin to hang a control on, so the second arm at 1.0
  //    proves the detector's magnitude scales with the error rather than sitting at noise.
  const spillAt = async (scale) => {
    const b = await sharp(Buffer.from(svg(512, scale, 0))).raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * ch;
        let d = 0;
        for (let k = 0; k < 3; k++) d += Math.abs(b.data[i + k] - bgOnly.data[i + k]);
        if (d < 24) continue;
        const dx = x - 256; const dy = y - 256;
        if (dx * dx + dy * dy > R * R) n++;
      }
    }
    return n;
  };
  const spill092 = await spillAt(0.92);
  const spill100 = await spillAt(1.0);
  checks.push(['KNOWN-BAD: shipping the `any` art (0.92) as maskable DOES spill', spill092 > 0, `${spill092} px outside`]);
  checks.push(['KNOWN-BAD: and the spill GROWS with the error (1.00 > 0.92)', spill100 > spill092 * 4, `${spill100} px at 1.00 vs ${spill092} at 0.92`]);

  // 5. Opaque everywhere. iOS composites a transparent apple-touch-icon onto black.
  const apple = await render(TARGETS[3]);
  const am = await sharp(apple).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minAlpha = 255;
  for (let i = 3; i < am.data.length; i += am.info.channels) minAlpha = Math.min(minAlpha, am.data[i]);
  checks.push(['apple-touch-icon is fully opaque (iOS does not honour alpha)', minAlpha === 255, `min alpha ${minAlpha}`]);

  console.log('\nsc2_icons --selftest\n');
  let fails = 0;
  for (const [n, ok, d] of checks) { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}   (${d})`); }
  console.log(`\n  ${checks.length - fails}/${checks.length}\n`);
  process.exitCode = fails ? 1 : 0;
}

if (SELFTEST) {
  await selftest();
} else {
  if (WRITE && !existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nsc2_icons ${WRITE ? '' : '(dry run — pass --write) '}→ ${OUT_DIR}\n`);
  for (const t of TARGETS) {
    const buf = await render(t);
    if (WRITE) writeFileSync(join(OUT_DIR, t.file), buf);
    console.log(`  ${WRITE ? 'wrote' : 'would write'}  ${t.file.padEnd(26)} ${String(t.size).padStart(3)}px  scale ${t.scale}  ${buf.length} bytes`);
  }
  console.log('\n  ⚠️ Now READ the PNGs with the Read tool. A flat field passes every byte check here.\n');
}
