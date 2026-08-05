#!/usr/bin/env node
/**
 * What does home's local darkening of the rarity badge actually buy?
 *
 * `home.ts` carried `box-shadow: inset 0 0 0 100px rgba(20,13,30,0.40)` on
 * `.fa-rarity`, with a comment saying why: the badge takes its fill inline from
 * `RARITY_COLORS`, cream-on-Normal-grey measured 2.76:1, and darkening the fill was
 * the only lever a screen has over a colour it does not own. `theme.ts` has since
 * given `.fa-rarity` a 1.6px ink TEXT-STROKE, which is colour-independent — the glyph
 * now sits on its own stroke rather than on the fill — so the darkening should be
 * contributing nothing but a duller badge.
 *
 * "Should be" is not a measurement, so this is one. It is an A/B **in one page**: the
 * badge is captured, the old rule is re-injected with `!important`, and the identical
 * element is captured again. Same fighter, same lighting, same frame, one property
 * different — which is the only version of this comparison that means anything while
 * five peers are editing the tree (`docs/LESSONS.md` §5), and it is cheaper and
 * stricter than two snapshots.
 *
 * Reported per rarity, because the whole job of this badge is telling six of them
 * apart and Normal (#9B9B9B, the least saturated) and Legendary (#F4A300, the one the
 * old comment said went brown) fail differently.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/rarity_px.mjs --url {URL}
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const outDir = args.out ?? 'shots/loose/rarity';

/** One fighter per rarity family that reaches the lobby hero plate. */
const CASES = [
  { id: 'hamburger', rarity: 'Normal', hex: '#9B9B9B' },
  { id: 'taco', rarity: 'Rare', hex: '#2E86D8' },
  { id: 'soup', rarity: 'Epic', hex: '#8B4FDE' },
  { id: 'sushi', rarity: 'Legendary', hex: '#F4A300' },
  { id: 'egg', rarity: 'Neon', hex: '#FF2FD0' },
  { id: 'lollipop', rarity: 'Cyber', hex: '#00E5B0' },
];

/** The rule this pass deleted, put back verbatim. */
const OLD_RULE =
  '.fa-home .fa-rarity{box-shadow: inset 0 0 0 100px rgba(20,13,30,0.40), 0 2px 0 rgba(0,0,0,0.35) !important;}';

function relLum(r, g, b) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Mean HSV saturation / value of the badge's FILL.
 *
 * The glyphs and their ink stroke are a large share of a 60x21 badge and are almost
 * black, so a plain mean over the rect measures the type as much as the plate. The
 * fill is the modal colour: bin at 4 bits/channel, take the heaviest bin that is not
 * near-black, and average the pixels in it.
 */
async function fillStats(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.max(r, g, b) < 60) continue; // ink stroke / border
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    let e = bins.get(key);
    if (!e) bins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
    e.n++; e.r += r; e.g += g; e.b += b;
  }
  if (bins.size === 0) return null;
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  const r = top.r / top.n, g = top.g / top.n, b = top.b / top.n;
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  return {
    r, g, b,
    sat: mx === 0 ? 0 : (mx - mn) / mx,
    val: mx,
    lum: relLum(r, g, b),
    px: info.width * info.height,
    coverage: top.n / (info.width * info.height),
  };
}

const seed = (id) => ({
  name: 'Chef', wins: 12, losses: 5, xp: 900, selected: id,
  economy: {
    trophies: 900, bestTrophies: 900, coins: 800, gems: 20,
    containers: { chest: 0, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1,
    lastMatch: null, seed: 31337, rolls: 0,
  },
});

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];

for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript((p) => {
    try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private */ }
  }, seed(c.id));
  await page.goto(`${base}/?screen=home&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 60000 });
  await page.waitForTimeout(2600);

  const badge = page.locator('.fa-home [data-el="herorarity"]');
  const meta = await badge.evaluate((n) => {
    const s = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    return {
      text: n.textContent,
      strokeWidth: s.webkitTextStrokeWidth,
      strokeColor: s.webkitTextStrokeColor,
      color: s.color,
      bg: s.backgroundColor,
      shadow: s.boxShadow,
      w: Math.round(r.width), h: Math.round(r.height),
    };
  });

  const afterBuf = await badge.screenshot({ path: `${outDir}/${c.id}-after.png` });
  const after = await fillStats(afterBuf);

  await page.addStyleTag({ content: OLD_RULE });
  await page.waitForTimeout(160);
  const beforeBuf = await badge.screenshot({ path: `${outDir}/${c.id}-before.png` });
  const before = await fillStats(beforeBuf);

  rows.push({ ...c, meta, before, after });
  await page.close();
}

await browser.close();

console.log('\nrarity badge fill, home hero plate — WITH the inset darkening vs WITHOUT');
console.log('(same page, same frame, one property toggled)\n');
console.log(
  'rarity      badge   stroke      fill BEFORE (darkened)            fill AFTER (as authored)      dS      dV',
);
for (const r of rows) {
  if (!r.before || !r.after) { console.log(`${r.rarity.padEnd(11)} NO PIXELS`); continue; }
  const rgb = (s) => `rgb(${Math.round(s.r)},${Math.round(s.g)},${Math.round(s.b)})`;
  console.log(
    `${r.rarity.padEnd(11)} ${String(r.meta.w + 'x' + r.meta.h).padEnd(7)} ${r.meta.strokeWidth.padEnd(11)} `
    + `${rgb(r.before).padEnd(18)} S=${r.before.sat.toFixed(3)} V=${r.before.val.toFixed(3)}  `
    + `${rgb(r.after).padEnd(18)} S=${r.after.sat.toFixed(3)} V=${r.after.val.toFixed(3)}  `
    + `${(r.after.sat - r.before.sat >= 0 ? '+' : '')}${(r.after.sat - r.before.sat).toFixed(3)}  `
    + `${(r.after.val - r.before.val >= 0 ? '+' : '')}${(r.after.val - r.before.val).toFixed(3)}`,
  );
}

// The premise the deletion rests on: the label's legibility comes from the stroke, so
// it cannot depend on the fill. Fail loudly if the stroke is ever removed.
const strokeless = rows.filter((r) => parseFloat(r.meta.strokeWidth) < 1.5);
console.log(
  `\ntext-stroke on every badge: ${strokeless.length === 0 ? `YES (${rows[0]?.meta.strokeWidth}, ${rows[0]?.meta.strokeColor})` : `MISSING on ${strokeless.map((r) => r.rarity).join(', ')} — THE DARKENING IS LOAD-BEARING AGAIN`}`,
);
process.exit(strokeless.length === 0 ? 0 : 1);
