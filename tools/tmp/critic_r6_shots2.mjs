/**
 * Pass 2: character frames at a subject fill that matches the reference plates
 * (they run ~85-90% subject height; our default `fill=0.66` made the A/B a framing
 * test, which is the exact bias `reference/images/curated/fullbody_fair` exists to
 * remove). Also re-shoots character-select with a long settle, to find out whether
 * the blank Water Bottle / Hot Dog cards are a real defect or my own harness racing
 * the portrait thumbnail generator.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/critic_r6_shots2.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = process.env.PREVIEW_BASE;
if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
const HMR_STUB = 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},send(){}});'
  + 'export function injectQuery(u){return u} export function removeStyle(){} export function updateStyle(){}';

const OUT = 'shots/critic-r6';
await mkdir(`${OUT}/chars88`, { recursive: true });
const CHARS = ['donut', 'hamburger', 'hotdog', 'pizza', 'taco'];

const browser = await chromium.launch({ args: ARGS });
async function newPage(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  return p;
}

for (const id of CHARS) {
  const p = await newPage(1000, 1750);
  await p.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=0.6&shot=1&fill=0.88`,
    { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__previewReady === true', null, { timeout: 90000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/chars88/${id}.png`, timeout: 120000 });
  console.log(`char88 ${id}`);
  await p.close();
}

// ── the blank-card question ──────────────────────────────────────────────────
{
  const p = await newPage(1600, 900);
  await p.goto(`${BASE}/?screen=characters`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(15000);
  await p.screenshot({ path: `${OUT}/menus/characters_settled15s.png`, timeout: 120000 });
  const cards = await p.evaluate(() => [...document.querySelectorAll('.chars-card')].map((c) => {
    const img = c.querySelector('img, canvas');
    return {
      id: c.getAttribute('data-char'),
      tag: img ? img.tagName : null,
      src: img && img.tagName === 'IMG' ? (img.getAttribute('src') || '').slice(0, 40) : null,
      complete: img && img.tagName === 'IMG' ? img.complete && img.naturalWidth > 0 : null,
      w: img ? img.getBoundingClientRect().width : null,
    };
  }));
  console.log(JSON.stringify(cards, null, 1));
  await p.close();
}
await browser.close();
console.log('done');
