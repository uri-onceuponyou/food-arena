#!/usr/bin/env node
/**
 * vidframes — pull frames out of a video WITHOUT ffmpeg, by decoding it in the browser
 * we already ship tests against.
 *
 * ⚠️ ffmpeg is not installed on this machine and Uri should not have to install one to
 * report a bug. Playwright/Chromium is already a dependency here, and Chromium decodes
 * H.264/HEVC natively — so `<video>` + `seek` + `drawImage` is a frame extractor we
 * already own. Output goes to `shots/` which is gitignored: the source is a capture of
 * Uri's own phone and lives under `reference/`, which is local-only and PUBLIC-repo-banned.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = process.argv[2];
const outDir = process.argv[3] ?? 'shots/vid';
const n = Number(process.argv[4] ?? 12);

const b64 = readFileSync(resolve(src)).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent('<video id="v" muted playsinline></video><canvas id="c"></canvas>');
await page.evaluate(async (data) => {
  const v = document.getElementById('v');
  v.src = 'data:video/mp4;base64,' + data;
  await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j(new Error('decode failed')); });
}, b64);

const meta = await page.evaluate(() => {
  const v = document.getElementById('v');
  return { dur: v.duration, w: v.videoWidth, h: v.videoHeight };
});
console.log(`duration ${meta.dur.toFixed(2)}s  ${meta.w}x${meta.h}`);
if (!meta.w) { console.log('ZERO WIDTH — codec not decodable here'); await browser.close(); process.exit(2); }

for (let i = 0; i < n; i++) {
  const t = (meta.dur * (i + 0.5)) / n;
  const png = await page.evaluate(async ({ t, w, h }) => {
    const v = document.getElementById('v'), c = document.getElementById('c');
    c.width = w; c.height = h;
    await new Promise((r) => { v.onseeked = r; v.currentTime = t; });
    c.getContext('2d').drawImage(v, 0, 0, w, h);
    return c.toDataURL('image/png').split(',')[1];
  }, { t, w: meta.w, h: meta.h });
  const f = `${outDir}/f${String(i).padStart(2, '0')}_${t.toFixed(2)}s.png`;
  writeFileSync(f, Buffer.from(png, 'base64'));
  console.log(`  ${f}`);
}
await browser.close();
