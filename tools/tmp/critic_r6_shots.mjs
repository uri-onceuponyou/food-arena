/**
 * Capture the three critic packets for round 6, against COMMITTED HEAD.
 *
 * Run under `tools/tmp/headserve.mjs` so PREVIEW_BASE points at `git archive HEAD`
 * and not at five peers' half-saved working tree (docs/LESSONS.md §5).
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/critic_r6_shots.mjs
 *
 * Framing rules obeyed:
 *  - ARENA is shot through the REAL GAME ROUTE at 1600x900 (docs/LESSONS.md §6: the
 *    isolation views sat at 265wu while the game shows ~578wu). Stations are copied
 *    verbatim from `tools/arena-scan.mjs`, which validates them against cover
 *    (docs/LESSONS.md §10: ?px/?py do not depenetrate).
 *  - CHARACTERS are shot in `preview.html` at HEAD, whose backdrop is now 0x3d2b21
 *    (matches the shipped match's figure/ground polarity — docs/LESSONS.md §13), at
 *    an aspect inside the reference plates' 0.52-0.60 band so the A/B is not a
 *    framing test.
 *  - MENUS are shot through the real shell route at 1600x900.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = process.env.PREVIEW_BASE;
if (!BASE) { console.error('PREVIEW_BASE unset — run me under headserve.mjs'); process.exit(2); }

const HMR_STUB = 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},send(){}});'
  + 'export function injectQuery(u){return u} export function removeStyle(){} export function updateStyle(){}';

const OUT = 'shots/critic-r6';
await mkdir(`${OUT}/arena`, { recursive: true });
await mkdir(`${OUT}/menus`, { recursive: true });
await mkdir(`${OUT}/chars`, { recursive: true });

// Verbatim from tools/arena-scan.mjs STATIONS — three that between them show lanes,
// the hub hazard, and a landmark cluster.
const STATIONS = [
  { id: 'pot_diagonal', x: 570, y: 430 },
  { id: 'west_lane', x: 340, y: 500 },
  { id: 'pantry_ne', x: 1150, y: 330 },
];
const MAX_SAFE_RADIUS = 993;

const CHARS = ['donut', 'hamburger', 'hotdog', 'pizza', 'taco'];

const browser = await chromium.launch({ args: ARGS });
const errors = [];

async function newPage(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return p;
}

// ── 1. arena, shipped framing, real game route ───────────────────────────────
for (const s of STATIONS) {
  const p = await newPage(1600, 900);
  const url = `${BASE}/?player=hamburger&enemy=donut&px=${s.x}&py=${s.y}`
    + `&fogRadius=${MAX_SAFE_RADIUS}&simSpeed=0.02&pointerLock=0`;
  await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  await p.waitForTimeout(1200);
  const view = await p.evaluate(() => (window.__fairView ? window.__fairView() : null));
  await p.screenshot({ path: `${OUT}/arena/${s.id}.png`, timeout: 120000 });
  console.log(`arena ${s.id.padEnd(14)} fairView=${JSON.stringify(view)}`);
  await p.close();
}

// ── 2. menus ─────────────────────────────────────────────────────────────────
for (const [id, screen] of [['home', 'home'], ['characters', 'characters']]) {
  const p = await newPage(1600, 900);
  await p.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__previewReady === true || window.__shell', null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/menus/${id}.png`, timeout: 120000 });
  console.log(`menu  ${id}`);
  await p.close();
}

// ── 3. characters ────────────────────────────────────────────────────────────
// 1000x1750 = aspect 0.571, inside the reference plates' 0.52-0.60 band.
for (const id of CHARS) {
  const p = await newPage(1000, 1750);
  await p.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=0.6&shot=1`,
    { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__previewReady === true', null, { timeout: 90000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/chars/${id}.png`, timeout: 120000 });
  console.log(`char  ${id}`);
  await p.close();
}

await browser.close();
if (errors.length) { console.log('\nPAGE ERRORS:'); errors.slice(0, 20).forEach((e) => console.log('  ' + e)); }
console.log('\ndone');
