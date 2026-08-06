#!/usr/bin/env node
/**
 * up_refhero — how big is the hero in the REFERENCE's own lobby?
 *
 * Written because `menu_accept`'s `hero-fills-its-panel` floor had to come from
 * somewhere other than "what we happen to score". The reference plates are the only
 * external authority this project has on lobby composition, so the floor is derived
 * from them and this is the instrument that reads them.
 *
 * ⚠️ `reference/images/**` is gitignored and must never be committed, copied into
 * `src/`, or published. This tool reads a plate and prints RATIOS ONLY — no pixels, no
 * crops, no strings. `zb_home.png` additionally contains Uri's own account details and
 * is not a sensible input here for that reason; `bs_home.png` is the clean lobby plate.
 *
 *   node tools/tmp/up_refhero.mjs reference/images/curated/menus/bs_home.png 0.40 0.63 0.20 0.82
 *   node tools/tmp/up_refhero.mjs --control <png> <x0> <x1> <y0> <y1> --expect 0.565
 *
 * ── HOW IT SEPARATES THE HERO FROM THE ROOM ─────────────────────────────────
 * Not by "not the background", which was tried first and returned 0.79 — a lobby's
 * backdrop contains lit arches, machinery and a bottom UI bar, and a loose mask eats
 * all of them. It runs three TIGHT colour masks instead (a saturated green body, a
 * saturated red crown, a mid-brown belt) inside a hand-set band, and reports each one's
 * vertical extent separately so a contaminated mask is visible as a disagreement rather
 * than folded into one confident number. The hero's extent is the union of the masks
 * that agree with the eye.
 *
 * ── VALIDATED AGAINST A KNOWN INPUT (CLAUDE.md non-negotiable #6) ───────────
 * `--control` runs the same masks over a screenshot of OUR OWN home screen, where the
 * true answer is not a judgement at all: `window.__charStage()` projects the model's
 * bounding box and reports the height fraction exactly. `--expect` is that number, and
 * the tool exits 1 if the mask disagrees with it by more than 0.03. Without that, a
 * masking tool is a confident number with nothing behind it — which is the failure mode
 * nineteen instruments on this project were caught in.
 *
 * ── WHAT IT MEASURED ────────────────────────────────────────────────────────
 *   bs_home.png  2556x1179 (21.7:9)   hero top 0.316 (crown)  bottom 0.802 (feet)
 *                                     heightFrac 0.486   widthFrac 0.217
 * i.e. 0.265 of width once normalised to 16:9 — which is why a 0.42 WIDTH floor
 * refused the plate it exists to imitate. See `menu_accept.mjs`'s
 * `MIN_HERO_HEIGHT_FRAC` block.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const control = argv.includes('--control');
const expectIdx = argv.indexOf('--expect');
const expect = expectIdx >= 0 ? Number(argv[expectIdx + 1]) : null;
const positional = argv.filter((s, i) => !s.startsWith('--') && argv[i - 1] !== '--expect');

const file = positional[0];
const [x0, x1, y0, y1] = positional.slice(1, 5).map(Number);
if (!file || [x0, x1, y0, y1].some((v) => !Number.isFinite(v))) {
  console.error('usage: up_refhero.mjs <png> <x0> <x1> <y0> <y1> [--control --expect <hFrac>]');
  process.exit(2);
}

const b64 = readFileSync(file).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');

const out = await page.evaluate(async ({ b64, x0, x1, y0, y1 }) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.getElementById('c');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const X0 = Math.round(x0 * img.width), X1 = Math.round(x1 * img.width);
  const Y0 = Math.round(y0 * img.height), Y1 = Math.round(y1 * img.height);

  /** Tight, saturated masks. A loose "not the background" test returns 0.79 here. */
  const masks = {
    green: (r, gg, bb) => gg > r + 25 && gg > bb + 25,
    red: (r, gg, bb) => r > gg + 45 && r > bb + 25,
    warm: (r, gg, bb) => r > gg + 20 && gg > bb + 15 && r < 200,
  };
  const res = {};
  for (const [name, fn] of Object.entries(masks)) {
    let minX = 1e9, maxX = -1;
    const rows = new Map();
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        const i = (y * img.width + x) * 4;
        if (!fn(d[i], d[i + 1], d[i + 2])) continue;
        rows.set(y, (rows.get(y) ?? 0) + 1);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    // A row counts only if 2% of the band's width is lit, so a handful of antialiased
    // pixels cannot set an extreme. Reported per mask, never merged silently.
    const need = Math.max(6, (X1 - X0) * 0.02);
    const ys = [...rows.entries()].filter(([, n]) => n >= need).map(([y]) => y).sort((p, q) => p - q);
    res[name] = ys.length
      ? { top: ys[0], bot: ys[ys.length - 1], l: minX, r: maxX, rows: ys.length }
      : null;
  }
  return { w: img.width, h: img.height, res };
}, { b64, x0, x1, y0, y1 });

await browser.close();

const { w: W, h: H, res } = out;
const tops = Object.values(res).filter(Boolean).map((m) => m.top);
const bots = Object.values(res).filter(Boolean).map((m) => m.bot);
const ls = Object.values(res).filter(Boolean).map((m) => m.l);
const rs = Object.values(res).filter(Boolean).map((m) => m.r);
const top = Math.min(...tops), bot = Math.max(...bots);
const hFrac = +((bot - top) / H).toFixed(3);
const wFrac = +((Math.max(...rs) - Math.min(...ls)) / W).toFixed(3);
const aspect = +(W / H).toFixed(3);

console.log(`\n  plate            ${file.split('/').pop()}   ${W}x${H}   aspect ${aspect}`);
for (const [name, m] of Object.entries(res)) {
  console.log(`  mask ${name.padEnd(6)}      ${m ? `top ${(m.top / H).toFixed(3)}  bot ${(m.bot / H).toFixed(3)}  rows ${m.rows}` : '(empty)'}`);
}
console.log(`  hero heightFrac  ${hFrac}`);
console.log(`  hero widthFrac   ${wFrac}   (${(wFrac * aspect / (16 / 9)).toFixed(3)} normalised to 16:9)`);

if (control) {
  if (expect === null) { console.log('\n  --control needs --expect'); process.exit(2); }
  const err = Math.abs(hFrac - expect);
  const ok = err <= 0.03;
  console.log(`\n  CONTROL  mask ${hFrac} vs __charStage ${expect}   error ${err.toFixed(3)}   ${ok ? 'PASS' : 'FAIL'} (tol 0.03)`);
  process.exit(ok ? 0 : 1);
}
