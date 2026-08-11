#!/usr/bin/env node
/**
 * ARENA PLAY VIEW — the rendered half of the arena pass, and the one measurement
 * `ap_reach.mjs` cannot make for itself.
 *
 * ── 1. IT VALIDATES `ap_reach --body-visual` AGAINST THE LIVE SCENE ──────────
 * The whole "phantom pocket" finding rests on ONE number: how wide the character is
 * DRAWN, against the 42 wu it COLLIDES at. `ap_reach` defaults that to 26 wu, derived
 * from a pixel measurement in `shots/conceal/panels.json`. A pixel measurement is a
 * projection and carries the camera's perspective in it, so this re-derives the same
 * number the only way that has no camera in it at all: **the world-space XZ extent of
 * the player's model in the live scene graph**, walked from `window.__stage.scene`,
 * every mesh, every vertex, through each object's own `matrixWorld`.
 *
 * ⚠️ The two answers are NOT expected to be identical and the difference is the point:
 * the pixel figure includes whatever the character's widest pose reaches at that instant,
 * this one includes every limb at its rest transform. **If this figure comes back BELOW
 * the assumed 26 wu, `ap_reach` has UNDERSTATED the defect** (a narrower drawn body means
 * more floor looks reachable), so 26 is deliberately the conservative end.
 *
 * ── 2. IT PHOTOGRAPHS WHAT URI REPORTED, AT THE CAMERA HE PLAYS ON ──────────
 * Stations are `?px=/?py=` placements at the shipped match framing:
 *   `conceal_in` / `conceal_out`  — inside a plate patch and beside it. Uri: *"i can't
 *                                   hide under conceilments or break them."*
 *   `barrel_nw` / `pantry_ne`     — the two phantom pockets that shipped, photographed
 *                                   at their fixed positions.
 * Every station also records the sim's own `concealed` flag and the two HUD surfaces, so
 * the PNG and the state are captured from the same frame rather than argued about.
 *
 * ⚠️ **CSS ANIMATIONS RUN ON THE DOCUMENT TIMELINE, NOT rAF**, so `?simSpeed` does not
 * still the HUD. `--still-hud` pauses every running CSS animation before capture; without
 * it no pixel-identity claim from these frames is legitimate.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ap_view.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('out', `${ROOT}/shots/ap`));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
const STILL = !argv.includes('--no-still-hud');

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/** WORLD_SCALE from `src/units.ts` — metres per world unit. Read, never typed. */
const WORLD_SCALE = 0.05;

/**
 * ⚠️ RE-AIMED FOR THE ×4 MAP, 2026-08-11. WAS:
 *   { id: 'conceal_in',  x: 260, y: 375, note: 'standing INSIDE the P1 plate patch' },
 *   { id: 'conceal_out', x: 260, y: 500, note: 'beside P1, 125 wu south of its centre' },
 *   { id: 'conceal_p3',  x: 380, y: 560, note: 'inside the P3 west-lane crate stack' },
 *
 * 🚨 **THE PATCHES THEMSELVES MOVED AND THESE DID NOT.** `6631446` re-laid the
 * concealment out for the 2800×2000 map; the first plate stack is at **(555,290)** and
 * the first crate stack at **(700,910)**. The three coordinates above are the 1× plate
 * positions, and on the shipped map **all three land inside a `freezer`** — so the
 * station named *"standing INSIDE the P1 plate patch"* was standing inside a walk-in
 * freezer with no concealment anywhere in frame, and `escapeCover` shoved the fighter
 * out of it before the shutter. Note the irony recorded three lines below: the previous
 * pass fixed exactly this failure for two OTHER stations and left these three.
 * Coordinates are read from `tools/arena.gameplay.json`'s `concealment` list.
 */
const CONCEAL = JSON.parse(readFileSync(new URL('../arena.gameplay.json', import.meta.url), 'utf8')).concealment;
const P1 = CONCEAL.find((c) => c.kind === 'plate_stack');
const P3 = CONCEAL.find((c) => c.kind === 'crate_stack');
if (!P1 || !P3) throw new Error('ap_view: no plate_stack/crate_stack in the arena dump — refusing to guess');
const STATIONS = [
  { id: 'conceal_in', x: P1.x, y: P1.y, note: 'standing INSIDE the P1 plate patch' },
  { id: 'conceal_out', x: P1.x, y: P1.y + 125, note: 'beside P1, 125 wu south of its centre' },
  { id: 'conceal_p3', x: P3.x, y: P3.y, note: 'inside the P3 crate stack' },
  // ⚠️ Both of these were at (130,250) / (1150,300) on the first pass, which are INSIDE
  // the freezer's and the prep counter's inflated collision boxes — `escapeCover` shoved
  // the fighter out and the frames photographed a floating HP pill behind a prop. Placed
  // clear of every inflated box now, and SOUTH of the thing being looked at: the camera
  // pitches 58 degrees, so it reaches much further up-screen (+y) than down.
  { id: 'barrel_nw', x: 130, y: 380, note: 'looking north at the NW barrel, now flush to the wall' },
  { id: 'pantry_ne', x: 1150, y: 430, note: 'looking north at the NE pantry / prep-counter seam' },
];

mkdirSync(OUT, { recursive: true });

/**
 * World-space XZ extent of the player's model, in WORLD UNITS.
 *
 * Finds the model by looking for the object that CONTAINS a mesh named `torso_mesh`
 * (`characters/rig.ts` names it), rather than by a group name — group names in this
 * scene are assigned by several files and a name lookup is the kind of thing that
 * silently returns the wrong object. Every vertex of every descendant mesh is
 * transformed by its own `matrixWorld`, so no assumption is made about where the rig's
 * pivot is or how deep the hierarchy goes.
 */
const measureBody = () => {
  const scene = window.__stage?.scene;
  if (!scene) return { error: 'no window.__stage.scene' };
  const roots = [];
  // Match on any of the rig's own joint/mesh names rather than one string. The first
  // draft keyed on `torso_mesh` alone and found nothing on the live scene, which is
  // exactly the "an UNNAMED mesh is invisible to every diagnostic here" trap read
  // backwards — a diagnostic keyed on ONE name is invisible to every other rig branch.
  const RIGISH = /torso|pelvis_mesh|neck_column|neck_collar|shoulder_bridge/;
  scene.traverse((o) => {
    if (!o.name || !RIGISH.test(o.name)) return;
    let p = o;
    while (p.parent && p.parent !== scene) p = p.parent;
    if (!roots.includes(p)) roots.push(p);
  });
  if (!roots.length) {
    // Report what IS there, so one run diagnoses instead of two.
    const top = [];
    for (const c of scene.children) top.push(`${c.name || '(unnamed)'}[${c.children.length}]`);
    const names = new Set();
    scene.traverse((o) => { if (o.name) names.add(o.name); });
    return { error: 'no rig mesh found in the scene', topLevel: top, sampleNames: [...names].slice(0, 60) };
  }
  const out = [];
  for (const r of roots) {
    r.updateWorldMatrix(true, true);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity, n = 0;
    r.traverse((o) => {
      const g = o.geometry;
      const pos = g && g.attributes && g.attributes.position;
      if (!pos) return;
      const e = o.matrixWorld.elements;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
        if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
        n++;
      }
    });
    out.push({ name: r.name, verts: n, wM: maxX - minX, dM: maxZ - minZ, hM: maxY - minY, centreX: (minX + maxX) / 2 });
  }
  return { models: out };
};

const readState = () => ({
  fighters: window.__vfxDebugFighters ?? null,
  concealRegions: (window.__matchArena?.concealment ?? []).length,
  // `MatchDebug` publishes input and phase, NOT the fighter state, so `concealed` is
  // derived here from the arena's own regions and the fighter positions `vfx.ts`
  // publishes — the same centre-in-box membership rule `movement.ts:isConcealed` uses.
  // Stated rather than assumed: this is a SECOND implementation of that rule and it is
  // only legitimate as a cross-check on the PNG, never as the acceptance test.
  // `tools/tmp/conceal_lab.mjs` and `cw_conceal_view.mjs` own the acceptance test.
  inRegion: (() => {
    const rs = window.__matchArena?.concealment ?? [];
    const f = window.__vfxDebugFighters;
    const hit = (p) => p && rs.some((b) => Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.y - b.y) < b.h / 2);
    return { player: hit(f?.player), enemy: hit(f?.enemy) };
  })(),
  radarEnemy: document.querySelector('[data-el="radar-enemy"]')
    ? getComputedStyle(document.querySelector('[data-el="radar-enemy"]')).display : null,
  radarPlayer: document.querySelector('[data-el="radar-player"]')
    ? getComputedStyle(document.querySelector('[data-el="radar-player"]')).display : null,
});

const stillHud = () => {
  for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* ignore */ } }
};

const browser = await chromium.launch({ args: LAUNCH });
const results = [];
try {
  for (const st of STATIONS) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => console.log(`PAGEERROR [${st.id}]:`, e.message));
    const url = `${BASE}/?px=${st.x}&py=${st.y}&fogRadius=900&simSpeed=0.01&player=hamburger&enemy=donut&pointerLock=0`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
    await page.waitForTimeout(900);
    if (STILL) await page.evaluate(stillHud);
    const state = await page.evaluate(readState);
    const body = await page.evaluate(measureBody);
    const path = `${OUT}/${st.id}.png`;
    await page.screenshot({ path });
    results.push({ ...st, state, body, path });
    console.log(`\n[${st.id}] ${st.note}`);
    console.log(`   regions on the arena: ${state.concealRegions}   player-in-region=${state.inRegion.player}   enemy-in-region=${state.inRegion.enemy}`);
    console.log(`   fighter at (${Math.round(state.fighters?.player?.x ?? -1)},${Math.round(state.fighters?.player?.y ?? -1)})   radar: player=${state.radarPlayer} enemy=${state.radarEnemy}`);
    if (body.error) console.log(`   BODY: ${body.error}  top=${(body.topLevel ?? []).join(' ')}\n         names=${(body.sampleNames ?? []).join(',')}`);
    else for (const m of body.models) {
      console.log(`   BODY "${m.name || '(unnamed)'}" ${m.verts} verts  drawn ${(m.wM / WORLD_SCALE).toFixed(1)} x ${(m.dM / WORLD_SCALE).toFixed(1)} wu`
        + `  (${m.wM.toFixed(2)} x ${m.dM.toFixed(2)} m), height ${m.hM.toFixed(2)} m`);
    }
    console.log(`   -> ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
}

const widths = results.flatMap((r) => (r.body.models ?? []).map((m) => m.wM / WORLD_SCALE));
if (widths.length) {
  const minW = Math.min(...widths), maxW = Math.max(...widths);
  console.log(`\n== DRAWN BODY WIDTH, world-space, no camera in it: ${minW.toFixed(1)} .. ${maxW.toFixed(1)} wu`);
  console.log(`   PLAYER_SIZE (the collision box) is 42 wu, for EVERY character.`);
  console.log(`   invisible collar = (42 - drawn) / 2 = ${((42 - maxW) / 2).toFixed(1)} .. ${((42 - minW) / 2).toFixed(1)} wu per side`);
  // 🚨 THE NARROWEST, AND THE FIRST DRAFT OF THIS LINE SAID THE OPPOSITE.
  // It printed "use the WIDEST: it is the conservative choice", which is backwards and is
  // exactly the confidently-wrong instrument this project keeps catching. A WIDER assumed
  // drawn body makes the 26..42 band NARROWER, so it reports FEWER gaps — it hides the
  // defect. The narrowest character in the roster is the one who can see furthest into a
  // gap he cannot enter, so he sets the threshold. Acting on the old line would have
  // closed the tool on a layout that still stranded floor for Donut, and it nearly did:
  // at `--body-visual 26` the kitchen read clean while SIX gaps were still open at 20.
  console.log(`   -> ap_reach --body-visual ${Math.floor(minW)}   ⚠️ the NARROWEST, not the widest:`);
  console.log(`      a wider assumed body SHRINKS the band and under-reports the defect.`);
  console.log(`   ⚠️ This is a UNION bbox of every mesh parented to the model — held props and`);
  console.log(`      contact decals included — so it brackets the silhouette rather than being it.`);
  console.log(`      The pixel measurement in shots/conceal/panels.json (23.96 wu) sits inside it.`);
}
writeFileSync(`${OUT}/ap_view.json`, JSON.stringify({ base: BASE, w: W, h: H, results }, null, 2));
console.log(`\njson -> ${OUT}/ap_view.json\n`);
