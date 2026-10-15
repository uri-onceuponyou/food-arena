#!/usr/bin/env node
/**
 * BH_MOVE_BROWSER — the two browser questions of the movement bug hunt, in ONE page session.
 * Review-phase probe (2026-10-15). Run ONLY through sx_snap on the clean worktree:
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- node tools/tmp/bh_move_browser.mjs --url '{URL}'
 *
 *  A. DUMP   — build the arena in the browser (`tools/arena-dump.html`, the only source of
 *              `tools/arena.gameplay.json`) and diff it field by field against the committed
 *              dump every Node probe in this hunt reads. If they differ, every offline number
 *              here describes a map that does not ship. Written to shots/, NEVER to tools/.
 *  B. TRAP   — what a fighter stuck by `escapeCover`'s 2-cycle looks like in the shipped game.
 *              `?px=&py=` parks the LOCAL fighter at a landing point that the Node e2e
 *              (`bh_move_trap.mjs --e2e`) produced through the real Disposal branch, then holds
 *              each of the four movement keys for 1.5 s. Same function chain the victim of a
 *              Disposal throw runs (`tryMove` -> `escapeCover`). Movement is read off the
 *              PIXELS: the match camera follows the local fighter, so a fighter that moves drags
 *              the whole background with it. CONTROL: the same key script from an open-floor
 *              point must move the background.
 *
 * Every PNG is written under shots/rv/bugs/move/browser/.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; } }
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('need --url'); process.exit(2); }
const OUT = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move/browser`));
mkdirSync(OUT, { recursive: true });
const COMMITTED = resolve(String(args.committed ?? '/private/tmp/fa-rv-head/tools/arena.gameplay.json'));
const W = Number(args.w ?? 960), H = Number(args.h ?? 540);
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const browser = await chromium.launch({ args: LAUNCH });
const result = { base: BASE };
try {
  // ── warm the snapshot (first client eats Vite's dep-optimisation reload) ──
  {
    const p = await browser.newPage();
    try { await p.goto(`${BASE}/`, { waitUntil: 'load', timeout: 120000 }); await p.waitForTimeout(3000); } catch (e) { console.log('warm:', e.message); }
    await p.close();
  }

  // ── A. DUMP ───────────────────────────────────────────────────────────────
  if (!args['skip-dump']) {
  let dump = null;
  for (let attempt = 0; attempt < 3 && !dump; attempt++) {
    const p = await browser.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR(dump):', e.message));
    try {
      await p.goto(`${BASE}/tools/arena-dump.html`, { waitUntil: 'load', timeout: 120000 });
      await p.waitForFunction(() => window.__arenaReady === true, null, { timeout: 120000 });
      const err = await p.evaluate(() => window.__arenaError ?? null);
      if (err) throw new Error(err);
      dump = await p.evaluate(() => window.__arenaDump);
    } catch (e) { console.log(`dump attempt ${attempt}: ${e.message}`); }
    await p.close();
  }
  if (!dump) throw new Error('arena dump failed 3x');
  writeFileSync(`${OUT}/arena_dump_head.json`, JSON.stringify(dump, null, 2));
  const committed = JSON.parse(readFileSync(COMMITTED, 'utf8'));
  const norm = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).filter(([, y]) => y !== undefined).sort(([a], [b]) => a.localeCompare(b))) : x));
  const fields = [...new Set([...Object.keys(dump), ...Object.keys(committed)])];
  const diff = fields.filter((k) => norm(dump[k]) !== norm(committed[k]));
  result.dump = { fields, differing: diff, cover: dump.cover.length, hazards: dump.hazards.length, concealment: (dump.concealment ?? []).length, spawns: (dump.spawns ?? []).length };
  console.log(`A. DUMP: browser-built arena vs committed ${COMMITTED.replace(REPO + '/', '')}: ${diff.length === 0 ? 'IDENTICAL on every field' : 'DIFFERS on ' + diff.join(', ')}  (${dump.cover.length} cover · ${dump.hazards.length} hazards · ${(dump.concealment ?? []).length} concealment · ${(dump.spawns ?? []).length} spawns · maxSafeRadius ${dump.maxSafeRadius})`);
  }

  // ── B. TRAP vs CONTROL ────────────────────────────────────────────────────
  const decode = async (buf) => { const { data, info } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true }); if (info.width !== W || info.height !== H) throw new Error(`frame ${info.width}x${info.height}`); return { data }; };
  /** Share of pixels (outside the HUD bands and the central body box) that changed by > 24 on any channel. */
  const bgChange = (a, b) => {
    let ch = 0, tot = 0;
    for (let y = Math.round(H * 0.18); y < Math.round(H * 0.82); y++) for (let x = 0; x < W; x++) {
      if (Math.abs(x - W / 2) < W * 0.09 && Math.abs(y - H / 2) < H * 0.24) continue; // the fighter itself
      const i = (y * W + x) * 4; tot++;
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      if (d > 24) ch++;
    }
    return ch / tot;
  };
  async function keyScript(name, px, py) {
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    const logs = [];
    p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text()); });
    p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
    // `fogRadius` at the opening ring skips the countdown (applyQaSetup sets phase 'playing') and
    // `simSpeed=4` keeps a SwiftShader frame worth ~200 ms of sim, so a 2.5 s hold is several ticks.
    await p.goto(`${BASE}/?px=${px}&py=${py}&fogRadius=1720&simSpeed=4&pointerLock=0`, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await p.waitForFunction(() => window.__matchDebug && window.__matchDebug.phase === 'playing' && window.__matchDebug.frames > 5, null, { timeout: 240000 });
    await p.waitForTimeout(800);
    const shotA = await p.screenshot();
    writeFileSync(`${OUT}/${name}_A_before.png`, shotA);
    // Each key is held ~1.5 s and a frame is taken after EACH hold, so the comparison is
    // A-vs-after-key, not A-vs-end: the four holds cancel in the open (east, south, west,
    // north), and an end-to-end diff would read a mobile control as frozen.
    const inputs = [];
    const changes = [];
    // The local fighter's position, read off the match camera's follow request (`CameraRig.desired`
    // is set from the local fighter every frame; `targetUnits()` gives the metre->wu scale).
    const pos = () => p.evaluate(() => {
      const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
      const r = st.rig; const tu = r.targetUnits(); const k = r.target.x !== 0 ? tu.x / r.target.x : 1;
      return { x: +(r.desired.x * k).toFixed(3), y: +(r.desired.z * k).toFixed(3), frames: window.__matchDebug.frames, moveX: window.__matchDebug.moveX, moveY: window.__matchDebug.moveY };
    });
    let prevShot = await decode(shotA);
    for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
      const before = await pos();
      await p.keyboard.down(key);
      const samples = [];
      for (let k = 0; k < 10; k++) { await p.waitForTimeout(250); samples.push(await pos()); }
      await p.keyboard.up(key);
      await p.waitForTimeout(300);
      const after = await pos();
      const shot = await p.screenshot();
      writeFileSync(`${OUT}/${name}_after_${key}.png`, shot);
      const cur = await decode(shot);
      changes.push(+bgChange(prevShot, cur).toFixed(4));
      prevShot = cur;
      const nonZero = samples.filter((q) => q.moveX !== 0 || q.moveY !== 0);
      inputs.push({ key, before, after, framesDuringHold: after.frames - before.frames, samplesWithInput: nonZero.length, sampleInput: nonZero[0] ? [nonZero[0].moveX, nonZero[0].moveY] : null, moved: +Math.hypot(after.x - before.x, after.y - before.y).toFixed(3) });
    }
    const dbg = await p.evaluate(() => ({ qa: window.__matchDebug.qaSpawnInsideCover, phase: window.__matchDebug.phase, frames: window.__matchDebug.frames }));
    await p.close();
    const change = Math.max(...changes);
    return { name, px, py, inputs, dbg, changes, backgroundChanged: +change.toFixed(4), warnings: logs.filter((l) => l.includes('[QA]')).slice(0, 2) };
  }
  const trapPt = String(args.trap ?? '973,736.01').split(',').map(Number);
  const ctrlPt = String(args.control ?? '1590,510').split(',').map(Number);
  const trap = await keyScript('trap', trapPt[0], trapPt[1]);
  const ctrl = await keyScript('control', ctrlPt[0], ctrlPt[1]);
  result.trap = trap; result.control = ctrl;
  for (const r of [trap, ctrl]) {
    console.log(`B. ${r.name.toUpperCase()} @(${r.px},${r.py}): qaSpawnInsideCover=${r.dbg.qa} · frames ${r.dbg.frames}`);
    r.inputs.forEach((i, k) => console.log(`   hold ${i.key}: input seen in ${i.samplesWithInput}/10 samples ${JSON.stringify(i.sampleInput)} · ${i.framesDuringHold} frames · pos ${i.before.x},${i.before.y} -> ${i.after.x},${i.after.y} (moved ${i.moved} wu) · background change vs previous frame ${(100 * r.changes[k]).toFixed(2)}%`));
    for (const w of r.warnings) console.log(`   console: ${w.slice(0, 220)}`);
  }
} finally {
  await browser.close();
  writeFileSync(`${OUT}/browser_result.json`, JSON.stringify(result, null, 2));
}
