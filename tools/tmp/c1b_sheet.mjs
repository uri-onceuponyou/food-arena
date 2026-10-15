#!/usr/bin/env node
/**
 * C1B_SHEET — graphics campaign work package C1b (the cast's SHAPES for the 58° camera), its
 * fast LOOKING tool. Owner of the `c1b_` prefix.
 *
 * One contact sheet per run: a row per character, a column per (pitch, facing), rendered
 * through `preview.html`'s own Stage and post chain on a frozen `t=` frame. The MODEL is
 * re-yawed page-side (`root.rotation.y`), never the camera, because that is what a facing is
 * in a match: the light stays where the match puts it and the fighter turns under it.
 *
 *   pitch 20 = the lobby's `charStage.ts` (grep `pitchDeg: 20`) — the DETECTOR for
 *              interpenetration, limb attachment and face construction (CLAUDE.md rule 3);
 *   pitch 58 = the match's `camera.ts` (grep `opts.pitchDeg ?? 58`).
 *
 * This is the iteration loop, not the acceptance: the acceptance sheets on the seat ring, in
 * the live match and the live lobby, are `c1a_probe.mjs --compare … --sheet`.
 *
 * Controls (CLAUDE.md rule 6):
 *   MOVES    yaw 0 and yaw 180 of the same character must differ (the yaw reaches the model);
 *   HOLDS    rendering yaw 0 a second time at the end must reproduce the first exactly;
 *   NONEMPTY every cell must differ from an empty-scene render of the same camera.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/c1b_sheet.mjs --url '{URL}' \
 *       --out <dir> [--ids a,b] [--cells 20:0,20:45,58:0,58:90,58:180] [--anim idle --t 1.5]
 *       [--size 300] [--fill 0.62] [--angle metal|swiftshader] [--tag name]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const IDS_ALL = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop', 'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Page side: re-yaw the model / re-pitch the camera, render twice, return a PNG of the canvas. */
const SHOOT = async (c) => {
  const st = window.__stage;
  let root = null;
  st.scene.traverse((o) => { if (!root && /^character:/.test(o.name || '')) root = o; });
  if (!root) return { error: 'no character root' };
  if (window.__c1bYaw0 === undefined) window.__c1bYaw0 = root.rotation.y;
  root.rotation.y = window.__c1bYaw0 + (c.yaw * Math.PI) / 180;
  st.rig.pitchDeg = c.pitch; st.rig.yawDeg = 0; st.rig.subjectFill = c.fill;
  if (c.target != null) st.rig.targetHeight = c.target;
  if (c.subject != null) st.rig.subjectHeight = c.subject;
  try { st.rig.shakeAmount = 0; st.rig.shakeOffset?.set?.(0, 0, 0); } catch { /* */ }
  st.rig.snapTo(0, 0);
  if (c.empty) root.visible = false;
  st.render(0); st.render(0);
  const url = st.renderer.domElement.toDataURL('image/png');
  root.visible = true;
  return { url };
};

async function main() {
  const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
  if (!BASE || BASE.includes(':5173')) { console.error('c1b_sheet: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }
  const OUT = resolve(String(arg('--out', 'shots/rv/c1b/sheet')));
  mkdirSync(OUT, { recursive: true });
  const ids = arg('--ids') ? String(arg('--ids')).split(',') : IDS_ALL;
  const cells = String(arg('--cells', '20:0,20:45,58:0,58:90,58:180')).split(',').map((s) => { const [p, y] = s.split(':').map(Number); return { pitch: p, yaw: y }; });
  const SIZE = Number(arg('--size', 300));
  const FILL = Number(arg('--fill', 0.62));
  const ANIM = String(arg('--anim', 'idle'));
  const T = Number(arg('--t', 1.5));
  const TAG = String(arg('--tag', 'sheet'));
  // --target/--subject (metres): a close-up framing for diagnosing a part (default: the preview's own)
  const ZOOM = { target: arg('--target') === null ? null : Number(arg('--target')), subject: arg('--subject') === null ? null : Number(arg('--subject')) };
  const angle = arg('--angle', 'metal');
  const LAUNCH = angle === 'metal'
    ? { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--force-color-profile=srgb'] }
    : { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] };
  const browser = await chromium.launch(LAUNCH);
  const rows = [];
  const controls = { moves: [], holds: [], nonEmpty: [] };
  try {
    for (const id of ids) {
      const page = await browser.newPage({ viewport: { width: SIZE, height: Math.round(SIZE * 1.25) }, deviceScaleFactor: 1 });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
      await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=${ANIM}&t=${T}&shot=1&fill=${FILL}`, { waitUntil: 'networkidle', timeout: 180_000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 180_000 });
      const tiles = [];
      const raw = [];
      for (const c of cells) {
        const r = await page.evaluate(SHOOT, { ...c, ...ZOOM, fill: FILL });
        if (r.error) throw new Error(`${id}: ${r.error}`);
        const buf = Buffer.from(r.url.split(',')[1], 'base64');
        raw.push(buf);
        tiles.push(await sharp(buf).resize(SIZE, Math.round(SIZE * 1.25), { fit: 'contain', background: '#000' }).png().toBuffer());
        const e = await page.evaluate(SHOOT, { ...c, ...ZOOM, fill: FILL, empty: true });
        controls.nonEmpty.push({ id, cell: `${c.pitch}:${c.yaw}`, same: Buffer.compare(Buffer.from(e.url.split(',')[1], 'base64'), buf) === 0 });
      }
      const again = await page.evaluate(SHOOT, { ...cells[0], ...ZOOM, fill: FILL });
      controls.holds.push({ id, same: Buffer.compare(Buffer.from(again.url.split(',')[1], 'base64'), raw[0]) === 0 });
      const i0 = cells.findIndex((c) => c.yaw === 0), i180 = cells.findIndex((c) => c.yaw === 180);
      if (i0 >= 0 && i180 >= 0) controls.moves.push({ id, differ: Buffer.compare(raw[i0], raw[i180]) !== 0 });
      if (errors.length) console.log(`[c1b_sheet] ${id} page errors: ${errors.join(' | ')}`);
      const H = Math.round(SIZE * 1.25);
      rows.push(await sharp({ create: { width: SIZE * cells.length + 4 * (cells.length - 1), height: H, channels: 3, background: '#202020' } })
        .composite(tiles.map((t, i) => ({ input: t, left: i * (SIZE + 4), top: 0 }))).png().toBuffer());
      writeFileSync(join(OUT, `${TAG}_${id}.png`), rows[rows.length - 1]);
      console.log(`[c1b_sheet] ${id} ok`);
      await page.close();
    }
  } finally { await browser.close(); }
  const H = Math.round(SIZE * 1.25);
  const W = SIZE * cells.length + 4 * (cells.length - 1);
  await sharp({ create: { width: W, height: rows.length * (H + 6), channels: 3, background: '#101010' } })
    .composite(rows.map((r, i) => ({ input: r, left: 0, top: i * (H + 6) }))).png().toFile(join(OUT, `${TAG}.png`));
  const bad = [...controls.moves.filter((m) => !m.differ).map((m) => `MOVES ${m.id}`),
    ...controls.holds.filter((h) => !h.same).map((h) => `HOLDS ${h.id}`),
    ...controls.nonEmpty.filter((n) => n.same).map((n) => `NONEMPTY ${n.id} ${n.cell}`)];
  if (!controls.holds.length) bad.push('HOLDS: nothing checked');
  writeFileSync(join(OUT, `${TAG}.json`), JSON.stringify({ base: BASE, cells, ids, anim: ANIM, t: T, controls, bad }, null, 1));
  console.log(`[c1b_sheet] -> ${join(OUT, `${TAG}.png`)} (rows ${ids.join(',')}; cols ${cells.map((c) => `${c.pitch}:${c.yaw}`).join(' ')})`);
  console.log(bad.length ? `CONTROLS FAILED: ${bad.join('; ')}` : 'controls OK (MOVES, HOLDS, NONEMPTY)');
  process.exit(bad.length ? 1 : 0);
}

if (IS_MAIN) await main();
