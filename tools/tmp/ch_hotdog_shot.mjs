#!/usr/bin/env node
/**
 * ONE capture, six panels, for the HotDog face/silhouette pass.
 *
 * ── Why the LOBBY camera and not the match camera ───────────────────────────
 * Uri judges the lobby render. `charStage.ts:451` is the shipped lobby hero rig:
 * `pitchDeg: 20`, `subjectFill: 0.60`. `preview.html?piece=character` defaults to
 * pitch 22 / fill 0.66, which is close but NOT the same, so both are passed
 * explicitly here rather than inherited. Every panel is therefore the framing the
 * human actually looked at when he wrote the reject sheets.
 *
 * ── Why the silhouette panels are in the same sheet ─────────────────────────
 * `docs/DECISIONS-FOR-URI.md` §40 pattern 1: a pointed mass either side of a head
 * reads as an ear or a horn, five for five, and it "overrides what the shape is
 * made of". That is a SILHOUETTE claim, and it cannot be judged on a shaded render
 * where colour tells you the thing is an onion. `silhouette=1` renders the matte,
 * which is the only view that answers it.
 *
 * ⚠️ Peers are on the GPU. This takes ONE browser, one page, and re-navigates —
 * no parallel contexts.
 *
 *   node tools/tmp/ch_hotdog_shot.mjs --url <snapshot> --out shots/ch/hotdog/after
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = get('--url', process.env.PREVIEW_BASE);
const OUT = get('--out', 'shots/ch/hotdog/run');
if (!BASE) { console.error('ch_hotdog_shot: --url or PREVIEW_BASE required (snapshot only)'); process.exit(2); }

const W = 560, H = 840;
/** pitch/fill copied from charStage.ts:451-455 — the shipped lobby hero rig. */
const LOBBY = 'piece=character&id=hotdog&anim=idle&t=1.5&shot=1&pitch=20&fill=0.60';
const PANELS = [
  { tag: 'lobby.yaw0', q: `${LOBBY}&yaw=0` },
  { tag: 'lobby.yaw35', q: `${LOBBY}&yaw=35` },
  { tag: 'lobby.yaw90', q: `${LOBBY}&yaw=90` },
  { tag: 'face', q: 'piece=character&id=hotdog&anim=idle&t=1.5&shot=1&face=1&yaw=0' },
  { tag: 'sil.yaw0', q: `${LOBBY}&yaw=0&silhouette=1` },
  { tag: 'sil.yaw90', q: `${LOBBY}&yaw=90&silhouette=1` },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const tiles = [];
try {
  for (const p of PANELS) {
    await page.goto(`${BASE}/preview.html?${p.q}`, { waitUntil: 'networkidle', timeout: 120000 });
    // preview.html mounts no shell, so there is no curtain to settle; `__previewReady`
    // is set after the model is built AND two rAFs have run (see preview.ts).
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
    await page.waitForTimeout(400);
    const buf = await page.screenshot({ type: 'png' });
    await writeFile(join(OUT, `${p.tag}.png`), buf);
    // A frame-statistics floor: a black or blank panel is the failure mode this
    // project has shipped most often, and it looks exactly like a good run.
    const st = await sharp(buf).stats();
    const mean = st.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3;
    const sd = st.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3;
    console.log(`${p.tag.padEnd(12)} mean ${mean.toFixed(1)}  sd ${sd.toFixed(1)}${sd < 4 ? '  ✗ FLAT — this panel is not a render' : ''}`);
    tiles.push({ input: await sharp(buf).resize(W, H).png().toBuffer(), tag: p.tag });
  }
} finally { await browser.close(); }

const sheet = await sharp({ create: { width: W * 3, height: H * 2, channels: 3, background: '#101014' } })
  .composite(tiles.map((t, i) => ({ input: t.input, left: (i % 3) * W, top: Math.floor(i / 3) * H })))
  .png().toBuffer();
await writeFile(join(OUT, 'sheet.png'), sheet);
console.log(`\nwrote ${OUT}/sheet.png  (top row: lobby yaw 0 / 35 / 90 · bottom: face close-up, silhouette yaw 0, silhouette yaw 90)`);
