#!/usr/bin/env node
/**
 * V1B_COVER — what sits ON a fighter's body, and WHICH EFFECT FAMILY put it there.
 * (Graphics campaign V1b, docs/REVAMP.md §8 w5: 5 of 8 cast notes call the pair "a jumble" —
 * "overlapping translucent rings, a dark purple smear, blue orbs and confetti, all sitting on
 * top of each other, so you can't read either character's body".)
 *
 * `tools/tmp/v1_vfx_cover.mjs` (V1) answers "how much of each body is covered by effects"; it
 * cannot say WHICH effects, so it cannot say what to cut. This keeps its body mask and its
 * covered test exactly — and adds one ablation render per effect family at every sample:
 *
 *   full      as shipped (shake zeroed)
 *   novfx     the whole `vfx_layer` hidden                  -> covered by ANY effect
 *   no<fam>   one family hidden                              -> covered by THAT family
 *   body      characters alone vs an empty frame (camera layers, as V1's tool does)
 *
 * A body pixel is covered by a family when hiding that family moves it (>= DELTA summed over
 * RGB, V1's 24). Families are read off the layer's own pools at runtime — `rings`, `particles`
 * (flashes, shards, streaks, star pops), `wedges` (star decals, melee crescents), `unionCores`,
 * `transients` (every bespoke weapon file's objects: the donut's hoops, arcs and sprinkles),
 * `projectiles` (+ shells + the shared ribbon), `status`, `telegraphs`, `ground` (the stain),
 * `cheese`. A pixel can be covered by two families at once (a ring over a shard), so family
 * rows do not sum to the ANY row.
 *
 * Plans:
 *   six    V1's six-seat hub ring (same fighters, same `--slow 1` default) — AI on every seat
 *          but the local one, which stands. Comparable to V1's own numbers.
 *   duel   Donut vs Taco 1v1 at the canonical anchor (east of the pot, as `gx_vfx_cap --plan
 *          live` and `rv_capture`'s cast frame), the local Donut DRIVEN: circle-strafe in a
 *          45–140 wu band, mouse on the Taco, attack held, weapon cycled 1/2/3 (Ring Spin,
 *          Sprinkle Spray, Candy Barrage) every 1.3 s.
 *
 * Known-bad / controls:
 *   * every fighter's body must be NON-EMPTY in some sample, else FAIL (nothing was measured);
 *   * SELF-PAIR: the first sample's `full` is rendered twice and must differ on 0 body px;
 *   Sub-families (`<family>:<key>`): transients by `userData.vfxSrc` (stamped at the five ctx
 *   sites in `game/vfx.ts`) and, where the weapon file names its parts `fx:<file>.<element>`,
 *   by element; generic particles by the texture the pool slot is wearing.
 *   * HIT READ (`aroundPxPerSample`): effect pixels within 2.2 heights of a fighter but OFF
 *     every body — a cut that moves effects off the body keeps it, one that deletes them does not.
 *   * the families must ACCOUNT for the cover: in every sample, body px covered by ANY effect
 *     but by NO family are reported (`unattributed`) — a family list that missed a pool would
 *     show here, not hide.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/v1b_cover.mjs --url '{URL}' \
 *     --plan six|duel --out <dir> [--seconds 4 --every 100 --slow 1 --slowMs 2500 --thresh 0.25]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]; if (!a.startsWith('--')) continue;
  const nx = process.argv[i + 1]; if (nx === undefined || nx.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = nx; i++; }
}
const BASE = args.url ?? process.env.PREVIEW_BASE;
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
const PLAN = args.plan ?? 'six';
const OUT = args.out ?? `shots/rv/v1b/cover_${PLAN}`;
const SECONDS = Number(args.seconds ?? 4), EVERY = Number(args.every ?? 100);
const SLOW = args.slow === undefined ? (PLAN === 'six' ? 1 : -1) : Number(args.slow);
const SLOW_MS = Number(args.slowMs ?? 2500);
const THRESH = Number(args.thresh ?? 0.25);
const FIGHTERS = args.fighters ?? 'donut@1530,1000;taco@1575,922;hamburger@1665,922;lollipop@1710,1000;waterbottle@1665,1078;sushi@1575,1078';
const W = 1280, H = 720, STEP_MS = 1000 / 60, DELTA = 24, AROUND_K = 2.2;
const FAMILIES = ['rings', 'particles', 'wedges', 'unionCores', 'transients', 'projectiles', 'status', 'telegraphs', 'ground', 'cheese'];
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow(); let manual = false; let virt = 0; const q = [];
    window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  const query = PLAN === 'duel'
    ? 'screen=match&pointerLock=0&player=donut&enemy=taco&px=1560&py=1000'
    : `screen=match&pointerLock=0&fogRadius=1700&fighters=${encodeURIComponent(FIGHTERS)}`;
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.evaluate(() => {
    window.__clk.manual();
    const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
    layer.sync = (s) => { window.__st = s; return orig(s); };
    const st = window.__stage; window.__realRender = st.render.bind(st);
    st.render = (dt) => st.rig.update(dt);
  });
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 400; i++) {
    const ph = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
    if (ph === 'playing') break;
  }
  await page.evaluate((ms) => window.__clk.pump(30, ms), STEP_MS);

  // ── duel: walk into contact first (the 1v1 enemy starts ~150 wu away), then drive.
  const held = new Set(); let mouseDown = false; let lastKey = null;
  const setKeys = async (mx, my) => {
    const want = new Set(); if (mx < 0) want.add('KeyA'); if (mx > 0) want.add('KeyD'); if (my < 0) want.add('KeyW'); if (my > 0) want.add('KeyS');
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const drive = async (tMs) => {
    const r = await page.evaluate(() => ({ f: window.__st.fighters.map((x) => ({ x: x.x, y: x.y, alive: x.alive })), scr: window.__vfxDebugScreen?.slots ?? null }));
    const me = r.f[0], e = r.f[1];
    if (!me?.alive || !e?.alive) { if (mouseDown) { await page.mouse.up(); mouseDown = false; } await setKeys(0, 0); return; }
    const d = Math.hypot(e.x - me.x, e.y - me.y);
    const toward = (tx, ty) => [tx > me.x + 12 ? 1 : tx < me.x - 12 ? -1 : 0, ty > me.y + 12 ? 1 : ty < me.y - 12 ? -1 : 0];
    let mx, my;
    if (d < 65) [mx, my] = toward(me.x + (me.x - e.x), me.y + (me.y - e.y));
    else if (d > 120) [mx, my] = toward(e.x, e.y);
    else { const sx = e.x > me.x ? 1 : -1; const sy = e.y > me.y ? 1 : -1; mx = -sy; my = sx; }
    await setKeys(mx, my);
    const s = r.scr?.[1]; if (s) await page.mouse.move(Math.max(2, Math.min(W - 2, s.x)), Math.max(2, Math.min(H - 2, s.y)));
    if (!mouseDown) { await page.mouse.down(); mouseDown = true; }
    const k = ['1', '2', '3'][Math.floor(tMs / 1300) % 3];
    if (k !== lastKey) { await page.keyboard.press(`Digit${k}`); lastKey = k; }
  };
  if (PLAN === 'duel') {
    for (let i = 0; i < 600; i++) {
      const d = await page.evaluate(() => { const f = window.__st.fighters; return Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y); });
      if (d < 150) break;
      await drive(0);
      await page.evaluate((ms) => window.__clk.pump(3, ms), STEP_MS);
    }
    // a second of fighting before the first sample, so the effects are in flight
    for (let i = 0; i < 10; i++) { await drive(i * 100); await page.evaluate((ms) => window.__clk.pump(6, ms), STEP_MS); }
  }
  if (SLOW >= 0) await page.evaluate(([slot, ms]) => { const f = window.__st.fighters[slot]; if (f) f.status.slowedUntil = window.__st.elapsed + ms; }, [SLOW, SLOW_MS]);

  const n = Math.round((SECONDS * 1000) / EVERY);
  const series = [];
  let selfPairPx = null;
  for (let k = 0; k < n; k++) {
    const shot = await page.evaluate(([fams, selfPair]) => {
      const stage = window.__stage; const rig = stage.rig; const L = window.__vfxLayer;
      rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
      const grab = () => { window.__realRender(0); const cv = document.createElement('canvas'); cv.width = stage.canvas.width; cv.height = stage.canvas.height; cv.getContext('2d').drawImage(stage.canvas, 0, 0); return cv.toDataURL('image/png'); };
      const fam = {
        rings: () => L.rings.map((s) => s.mesh),
        particles: () => L.particles.map((s) => s.sprite),
        wedges: () => L.wedges.map((s) => s.mesh),
        unionCores: () => L.unionCores.map((s) => s.sprite),
        transients: () => L.transientEffects.map((e) => e.object),
        projectiles: () => [...L.projectilePool.values(), ...L.shellPool.values(), L.ribbons.mesh],
        status: () => L.statusBySlot.flatMap((v) => [v.slowRing, v.slowRingDark, v.slowTint, ...(v.stunStars ?? []), v.wardRing]).filter(Boolean),
        telegraphs: () => [...L.castTelegraphs.values()],
        ground: () => [L.groundMarks.mesh],
        cheese: () => [L.cheeseClouds.mesh],
      };
      const out = { full: grab() };
      if (selfPair) out.full2 = grab();
      const layer = stage.scene.getObjectByName('vfx_layer');
      layer.visible = false; out.novfx = grab(); layer.visible = true;
      out.fam = {};
      out.famLive = {};
      const ablate = (key, objs) => {
        objs = objs.filter((o) => o && o.visible);
        out.famLive[key] = objs.length;
        if (objs.length === 0) { out.fam[key] = null; return; }   // nothing visible -> covers nothing
        for (const o of objs) o.visible = false;
        out.fam[key] = grab();
        for (const o of objs) o.visible = true;
      };
      for (const f of fams) ablate(f, fam[f]?.() ?? []);
      // SUB-FAMILIES — which weapon hook (V1b stamps userData.vfxSrc at the five ctx sites) and
      // which generic particle kind (by the texture the pool slot is wearing).
      const bySrc = new Map();
      for (const e of L.transientEffects) { const o = e.object; if (!o?.visible) continue; const k = 'transients:' + (o.userData?.vfxSrc ?? 'untagged') + (o.name?.startsWith('fx:') ? '|' + o.name.slice(3) : ''); if (!bySrc.has(k)) bySrc.set(k, []); bySrc.get(k).push(o); }
      for (const [k, objs] of bySrc) ablate(k, objs);
      const texName = new Map([[L.glowTex, 'glow'], [L.shardTex, 'shard'], [L.streakTex, 'streak'], [L.starTex, 'star'], [L.coreTex, 'core'], [L.softDiscTex, 'softDisc']]);
      const byTex = new Map();
      for (const sl of L.particles) { const o = sl.sprite; if (!o?.visible) continue; const k = 'particles:' + (o.userData?.vfxKind ?? texName.get(o.material.map) ?? 'other'); if (!byTex.has(k)) byTex.set(k, []); byTex.get(k).push(o); }
      for (const [k, objs] of byTex) ablate(k, objs);
      // BODY MASK — V1's method, verbatim in effect: characters alone vs an empty frame, on
      // camera LAYERS (the stage re-shows seat rings each render).
      const roots = new Set(); stage.scene.traverse((o) => { if (o.name.startsWith('character:')) roots.add(o); });
      const underChar = (o) => { for (let q = o; q; q = q.parent) if (roots.has(q)) return true; return false; };
      const others = []; stage.scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && !underChar(o)) others.push([o, o.layers.mask]); });
      const bg = stage.scene.background; stage.scene.background = null;
      for (const [o] of others) o.layers.set(30);
      out.charsOnly = grab();
      const saved = []; for (const r of roots) r.traverse((q) => saved.push([q, q.layers.mask]));
      for (const r of roots) r.traverse((q) => { q.layers.mask = 1 << 30; });
      out.nochar = grab();
      for (const [q, m] of saved) q.layers.mask = m;
      for (const [o, m] of others) o.layers.mask = m;
      stage.scene.background = bg;
      const cam = rig.camera; const st = window.__st;
      out.fs = st.fighters.map((f) => { const v = cam.position.clone().set(f.x * 0.05, 1.0, f.y * 0.05).project(cam);
        const top = cam.position.clone().set(f.x * 0.05, 2.1, f.y * 0.05).project(cam);
        const foot = cam.position.clone().set(f.x * 0.05, 0, f.y * 0.05).project(cam);
        return { id: f.characterId, alive: f.alive, sx: (v.x + 1) / 2 * stage.canvas.width, sy: (1 - v.y) / 2 * stage.canvas.height,
          hpx: Math.abs(top.y - foot.y) / 2 * stage.canvas.height }; });
      out.t = st.elapsed;
      return out;
    }, [FAMILIES, k === 0]);
    const dec = async (url) => (url ? (await sharp(Buffer.from(url.split(',')[1], 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true })) : null);
    const A = await dec(shot.full), V = await dec(shot.novfx), C = await dec(shot.nochar), O = await dec(shot.charsOnly);
    const KEYS = Object.keys(shot.fam);
    const F = {}; for (const f of KEYS) F[f] = await dec(shot.fam[f]);
    const { width: w, height: h } = A.info;
    const nF = shot.fs.length;
    const body = new Array(nF).fill(0), cov = new Array(nF).fill(0), unattr = new Array(nF).fill(0);
    // HIT READ: effect pixels AROUND each fighter (within AROUND_K x its height of its centre,
    // off every body). A cut that moves an effect off the body keeps these; a cut that just
    // deletes effects loses them — so "less cover" is only a result next to this column.
    const around = new Array(nF).fill(0);
    const famCov = Object.fromEntries(KEYS.map((f) => [f, new Array(nF).fill(0)]));
    const moved = (X, i) => Math.abs(A.data[i] - X.data[i]) + Math.abs(A.data[i + 1] - X.data[i + 1]) + Math.abs(A.data[i + 2] - X.data[i + 2]) >= DELTA;
    let sp = 0; const A2 = shot.full2 ? await dec(shot.full2) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const dc = Math.abs(O.data[i] - C.data[i]) + Math.abs(O.data[i + 1] - C.data[i + 1]) + Math.abs(O.data[i + 2] - C.data[i + 2]);
      if (dc < DELTA) {
        if (moved(V, i)) {
          let ab = -1, ad = Infinity;
          shot.fs.forEach((f, j) => { if (!f.alive) return; const d = Math.hypot(x - f.sx, y - f.sy); if (d < f.hpx * AROUND_K && d < ad) { ad = d; ab = j; } });
          if (ab >= 0) around[ab]++;
        }
        continue;
      }
      let best = -1, bd = Infinity;
      shot.fs.forEach((f, j) => { if (!f.alive) return; const d = Math.hypot(x - f.sx, y - f.sy); if (d < f.hpx * 1.6 && d < bd) { bd = d; best = j; } });
      if (best < 0) continue;
      body[best]++;
      if (A2 && moved(A2, i)) sp++;
      if (!moved(V, i)) continue;
      cov[best]++;
      let any = false;
      for (const f of KEYS) if (F[f] && moved(F[f], i)) { famCov[f][best]++; if (!f.includes(':')) any = true; }
      if (!any) unattr[best]++;
    }
    if (k === 0) selfPairPx = sp;
    series.push({ t: Math.round(shot.t), ids: shot.fs.map((f) => f.id), body, cov, unattr, around, famCov, famLive: shot.famLive });
    if (k % 10 === 5) for (const nm of ['full', 'novfx']) writeFileSync(`${OUT}/s${k}_${nm}.png`, Buffer.from(shot[nm].split(',')[1], 'base64'));
    if (PLAN === 'duel') { await drive(k * EVERY); }
    await page.evaluate(([steps, ms]) => window.__clk.pump(steps, ms), [Math.max(1, Math.round(EVERY / STEP_MS)), STEP_MS]);
  }
  for (const kk of held) await page.keyboard.up(kk);
  if (mouseDown) await page.mouse.up();
  await browser.close();

  // ── summary: per fighter (V1's columns) and per family (the new question)
  const nF = series[0].body.length;
  const perFighter = [];
  for (let j = 0; j < nF; j++) {
    const fr = series.map((s) => (s.body[j] > 0 ? s.cov[j] / s.body[j] : null));
    const valid = fr.filter((v) => v !== null);
    let run = 0, longest = 0;
    for (const v of fr) { if (v !== null && v > THRESH) { run++; longest = Math.max(longest, run); } else run = 0; }
    perFighter.push({ slot: j, id: series[0].ids[j], samples: valid.length,
      meanCovered: valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(3) : null, longestRunMs: longest * EVERY });
  }
  // family share = covered-by-family body px / all body px, pooled over fighters and samples
  const totalBody = series.reduce((a, s) => a + s.body.reduce((x, y) => x + y, 0), 0);
  const totalCov = series.reduce((a, s) => a + s.cov.reduce((x, y) => x + y, 0), 0);
  const totalUn = series.reduce((a, s) => a + s.unattr.reduce((x, y) => x + y, 0), 0);
  const allKeys = [...new Set(series.flatMap((s) => Object.keys(s.famCov)))];
  const families = allKeys.map((f) => {
    const px = series.reduce((a, s) => a + (s.famCov[f] ? s.famCov[f].reduce((x, y) => x + y, 0) : 0), 0);
    const samplesLive = series.filter((s) => (s.famLive[f] ?? 0) > 0).length;
    return { family: f, bodyShare: totalBody ? +(px / totalBody).toFixed(4) : null, ofCovered: totalCov ? +(px / totalCov).toFixed(3) : null, samplesLive };
  }).sort((a, b) => (a.family.includes(':') - b.family.includes(':')) || ((b.bodyShare ?? 0) - (a.bodyShare ?? 0)));
  const aroundPerSample = +(series.reduce((a, s) => a + s.around.reduce((x, y) => x + y, 0), 0) / series.length).toFixed(0);
  const report = { args: { PLAN, SECONDS, EVERY, SLOW, SLOW_MS, THRESH, FIGHTERS: PLAN === 'six' ? FIGHTERS : 'donut v taco' },
    selfPairPx, totalBodyPx: totalBody, anyCoveredShare: totalBody ? +(totalCov / totalBody).toFixed(4) : null, aroundPxPerSample: aroundPerSample,
    unattributedOfCovered: totalCov ? +(totalUn / totalCov).toFixed(3) : null, perFighter, families, series };
  writeFileSync(`${OUT}/cover.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ selfPairPx, totalBodyPx: totalBody, anyCoveredShare: report.anyCoveredShare, aroundPxPerSample: aroundPerSample, unattributedOfCovered: report.unattributedOfCovered }));
  for (const s of perFighter) console.log(JSON.stringify(s));
  for (const f of families) console.log(JSON.stringify(f));
  const fails = [];
  if (perFighter.every((s) => s.samples === 0)) fails.push('no fighter body pixels in any sample — nothing measured');
  if (selfPairPx !== 0) fails.push(`SELF-PAIR: the same frozen frame rendered twice differs on ${selfPairPx} body px`);
  if (fails.length) { console.log('FAIL: ' + fails.join('; ')); process.exitCode = 1; }
}
await main().catch((e) => { console.error(e); process.exitCode = 1; });
