#!/usr/bin/env node
/**
 * DOES THE FIGHTER SURVIVE THE FINAL RING?
 *
 * `MIN_SAFE_RADIUS = 140` is new. `arena/fogRing.ts` was authored and tuned when the
 * ring closed all the way to zero and spent almost the whole match at 400-990 wu; its
 * header claims the curtain is "faint enough up top that it never hides a fighter",
 * which was measured at those radii and has never been re-measured at 140.
 *
 * At 140 wu the geometry is not a scaled version of the same picture, it is a
 * different picture: 140 wu = 7 m, so a 6.5 m tall curtain now stands 7 m from the
 * arena centre — i.e. roughly one character height away from a fighter who is holding
 * the middle, and squarely between that fighter and a camera pitched 58 degrees down.
 * The curtain is `depthTest: true`, so wherever its near arc is closer to the camera
 * than the fighter, it wins.
 *
 * The measurement is the one that matters and nothing else: **how many of the
 * player's own pixels reach the screen**, found with a visibility matte (hide the
 * model, diff, restore) rather than a guessed screen box — the same method
 * `tools/tmp/potvis.mjs` used to prove a fighter inside the pot was 0.0% visible.
 * Swept across the ring's whole range so the answer is a curve, not an anecdote.
 *
 *   node tools/tmp/vfx_finalring.mjs --url <snapshot-url>
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = args.out ?? 'shots/vfx/finalring';
const W = Number(args.w ?? 1600), H = Number(args.h ?? 900);
const RW = W / 2, RH = H / 2;
const PLAYER = args.player ?? 'hamburger';
// Arena centre is (700, 500) and the pot's CoverBox forbids a fighter centre closer
// than 73 wu, so 90 wu off-centre is the nearest legal "holding the middle" spot.
const PX = Number(args.px ?? 790), PY = Number(args.py ?? 500);
const RADII = (args.radii ? String(args.radii).split(',') : ['990', '600', '400', '260', '180', '140']).map(Number);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  await mkdir(OUT, { recursive: true });
  const rows = [];
  console.log(`\nplayer pinned at (${PX}, ${PY}) — ${Math.round(Math.hypot(PX - 700, PY - 500))} wu off arena centre\n`);
  console.log('safeRadius   player px   % of frame   player luma   frame luma   verdict  curtain bleed INSIDE the boundary');
  console.log('─'.repeat(118));
  for (const R of RADII) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
    }));
    await page.goto(`${BASE}/?player=${PLAYER}&enemy=donut&simSpeed=0.0001&pointerLock=0&fogRadius=${R}&px=${PX}&py=${PY}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
    await page.waitForFunction(() => !!window.__stage, null, { timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: '.hud-countdown{display:none !important}' });

    const r = await page.evaluate(([rw, rh, pid, safeR]) => {
      const stage = window.__stage;
      const cv = document.createElement('canvas'); cv.width = rw; cv.height = rh;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const grab = () => { stage.render(0); ctx.clearRect(0, 0, rw, rh); ctx.drawImage(stage.canvas, 0, 0, rw, rh); return ctx.getImageData(0, 0, rw, rh).data; };
      const root = stage.scene.getObjectByName(`character:${pid}`);
      const withModel = Uint8ClampedArray.from(grab());
      root.visible = false;
      const without = grab();
      root.visible = true;
      let n = 0, lp = 0, lf = 0;
      const total = withModel.length / 4;
      for (let i = 0, p = 0; i < withModel.length; i += 4, p++) {
        const lum = (0.2126 * withModel[i] + 0.7152 * withModel[i + 1] + 0.0722 * withModel[i + 2]) / 255;
        lf += lum;
        const d = Math.max(Math.abs(withModel[i] - without[i]), Math.abs(withModel[i + 1] - without[i + 1]), Math.abs(withModel[i + 2] - without[i + 2]));
        if (d >= 6) { n++; lp += lum; }
      }
      // ── The module's own acceptance test #2, re-run at the new radii ──────────
      // `fogRing.ts`'s header commits to "every surface INSIDE the boundary is
      // bit-for-bit unchanged. Currently 0.0%." That was measured when the ring spent
      // the match at 400-990 wu. `MIN_SAFE_RADIUS` is new and the curtain is a 6.5 m
      // CYLINDER: from a camera pitched down onto it, the far wall projects INWARD
      // over the safe disc, and how far inward is a function of the wall's height
      // RELATIVE to its radius. Toggle just the curtain and ask how many of the
      // pixels it paints land on safe ground.
      const curtain = stage.scene.getObjectByName('fog_curtain__no_outline');
      let bleedPx = 0, curtainPx = 0;
      if (curtain && curtain.visible) {
        const withWall = Uint8ClampedArray.from(withModel);
        curtain.visible = false;
        const noWall = grab();
        curtain.visible = true;
        // Unproject each changed pixel onto the ground plane and measure its distance
        // from the arena centre in world units — pixel-space geometry cannot answer
        // "inside the ring" on a pitched camera.
        const cam = stage.rig.camera;
        const V3 = stage.scene.position.constructor;
        const org = new V3();
        const dir = new V3();
        for (let i = 0, p = 0; i < withWall.length; i += 4, p++) {
          const d = Math.max(Math.abs(withWall[i] - noWall[i]), Math.abs(withWall[i + 1] - noWall[i + 1]), Math.abs(withWall[i + 2] - noWall[i + 2]));
          if (d < 6) continue;
          curtainPx++;
          const sx = ((p % rw) / rw) * 2 - 1;
          const sy = -(((p / rw) | 0) / rh) * 2 + 1;
          org.set(sx, sy, -1).unproject(cam);
          dir.set(sx, sy, 1).unproject(cam).sub(org).normalize();
          if (Math.abs(dir.y) < 1e-6) continue;
          const t = -org.y / dir.y;
          if (t <= 0) continue;
          const wx = org.x + dir.x * t, wz = org.z + dir.z * t;
          // metres -> world units (WORLD_SCALE 0.05); arena centre is (700, 500).
          const ux = wx / 0.05, uy = wz / 0.05;
          const distU = Math.hypot(ux - 700, uy - 500);
          if (distU < safeR) bleedPx++;
        }
      }
      // How much of the frame's light does the WHOLE boundary carry? This is the
      // number that decides whether it may pop out of existence in one frame when a
      // match ends (`resolveTimeout` ends matches at MIN_SAFE_RADIUS with both
      // fighters alive, which is exactly where this is largest).
      const boundary = stage.scene.getObjectByName('fog_boundary');
      let lumaNoFog = 0;
      if (boundary) {
        boundary.visible = false;
        const noFog = grab();
        boundary.visible = true;
        for (let i = 0; i < noFog.length; i += 4) {
          lumaNoFog += (0.2126 * noFog[i] + 0.7152 * noFog[i + 1] + 0.0722 * noFog[i + 2]) / 255;
        }
        lumaNoFog /= total;
      }
      return {
        px: n, pct: +(n / total * 100).toFixed(3),
        playerLuma: +(n ? lp / n : 0).toFixed(3),
        frameLuma: +(lf / total).toFixed(3),
        frameLumaNoFog: +lumaNoFog.toFixed(3),
        fogLumaShare: lumaNoFog > 0 ? +(1 - (lf / total) / lumaNoFog).toFixed(3) : 0,
        curtainPx, bleedPx,
        bleedPct: curtainPx ? +(bleedPx / curtainPx * 100).toFixed(1) : 0,
      };
    }, [RW, RH, PLAYER, R]);

    await page.screenshot({ path: `${OUT}/r${R}.png` });
    const base = rows.length ? rows[0].px : r.px;
    const keep = base > 0 ? r.px / base : 1;
    const verdict = keep >= 0.9 ? 'ok' : keep >= 0.6 ? 'DEGRADED' : 'BURIED';
    console.log(`${String(R).padStart(9)}   ${String(r.px).padStart(9)}   ${String(r.pct).padStart(10)}   ${String(r.playerLuma).padStart(11)}   ${String(r.frameLuma).padStart(10)}   ${verdict.padEnd(4)}  curtain=${String(r.curtainPx).padStart(6)}px  INSIDE=${String(r.bleedPx).padStart(6)}px (${String(r.bleedPct).padStart(5)}%)  fog carries ${(r.fogLumaShare*100).toFixed(1).padStart(5)}% of frame luma`);
    rows.push({ R, ...r, keepVsWidest: +keep.toFixed(3), verdict });
    await page.close();
  }
  await writeFile(`${OUT}/finalring.json`, JSON.stringify({ base: BASE, player: PLAYER, px: PX, py: PY, rows }, null, 1));
  console.log(`\nwrote ${OUT}/finalring.json  and r*.png`);
} finally {
  await browser.close();
}
