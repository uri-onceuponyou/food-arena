#!/usr/bin/env node
/**
 * BH_MOVE_SYM — do terrain slow (puddle, splat) and the Sticky Trail boost reach a BOT seat
 * exactly as they reach a HUMAN seat? One-tick controls through the real `stepMatch`.
 * Review-phase probe (2026-10-15). READ-ONLY; imports `--src-root` (default: the clean
 * worktree of HEAD). Writes only under shots/rv/bugs/move/.
 *
 * For each controller (human pressing a cardinal direction / AI chasing a target 1,800 wu
 * away), the step length on the first playing tick is measured on dry floor, inside the
 * shipped south puddle, and (Donut only) standing on a fresh own-trail mark. Ratios must be
 * PUDDLE_SLOW_FACTOR and TRAIL.speedBoost for BOTH controllers.
 *
 * Known-bad: the same measurement against a scratch copy of `ai.ts` with the terrain term
 * removed from `aiSpeedMult` (the pre-b2be2f7 shape) must read AI ratio 1.000.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; } }
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
mkdirSync(OUT_DIR, { recursive: true });

function stageKnownBad() {
  const dst = `${OUT_DIR}/knownbad_sym/src/game`;
  mkdirSync(dst, { recursive: true }); mkdirSync(`${OUT_DIR}/knownbad_sym/src/arena`, { recursive: true });
  for (const f of readdirSync(`${SRC_ROOT}/src/game`)) if (f.endsWith('.ts')) copyFileSync(`${SRC_ROOT}/src/game/${f}`, `${dst}/${f}`);
  copyFileSync(`${SRC_ROOT}/src/arena/types.ts`, `${OUT_DIR}/knownbad_sym/src/arena/types.ts`);
  let ai = readFileSync(`${dst}/ai.ts`, 'utf8');
  const a = '    * terrainSlowAt(self.x, self.y, state.arena, state.splats)\n';
  if (!ai.includes(a)) throw new Error('known-bad anchor missing');
  ai = ai.replace(a, '');
  writeFileSync(`${dst}/ai.ts`, ai);
  return `${OUT_DIR}/knownbad_sym`;
}

async function measure(root) {
  const { createMatch, stepMatch } = await import(`${root}/src/game/sim.ts`);
  const R = await import(`${root}/src/game/rules.ts`);
  const ARENA = { ...JSON.parse(readFileSync(ARENA_PATH, 'utf8')), build: () => null, update: () => {} };
  const puddle = ARENA.hazards.find((h) => h.kind === 'slow');
  const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  // One tick of movement for `slot` 0 at `p`, controller `ctl`, optional own-trail mark under it.
  const stepLen = (ctl, ch, p, withMark) => {
    const target = { x: p.x < 1400 ? 2700 : 100, y: p.y }; // ~1,800 wu away: out of every reach
    const st = createMatch(ARENA, [
      { characterId: ch, controller: ctl, spawn: { ...p }, maxHp: 1e7 },
      { characterId: 'egg', controller: 'human', spawn: target, maxHp: 1e7 },
      { characterId: 'egg', controller: 'human', spawn: { x: target.x, y: target.y > 1000 ? target.y - 300 : target.y + 300 }, maxHp: 1e7 },
    ]);
    let g = 0; while (st.phase !== 'playing' && g++ < 100000) stepMatch(st, 16.667, [NEUTRAL, NEUTRAL, NEUTRAL]);
    const f = st.fighters[0];
    if (withMark) st.trailMarks.push({ id: st.nextId++, ownerId: 0, ownerRole: f.role, x: f.x, y: f.y, expiresAt: st.elapsed + 10_000, damagedMask: 0, damaged: false });
    const x0 = f.x, y0 = f.y;
    const dir = target.x > p.x ? 1 : -1;
    stepMatch(st, 16.667, [{ move: { x: dir, y: 0 }, selectedWeapon: 0, attack: false }, NEUTRAL, NEUTRAL]);
    return Math.hypot(f.x - x0, f.y - y0);
  };
  const dry = { x: puddle.x, y: puddle.y + 200 };
  const wet = { x: puddle.x, y: puddle.y };
  const out = {};
  for (const ctl of ['human', 'ai']) {
    const d = stepLen(ctl, 'hotdog', dry, false), w = stepLen(ctl, 'hotdog', wet, false);
    const dd = stepLen(ctl, 'donut', dry, false), dm = stepLen(ctl, 'donut', dry, true);
    out[ctl] = { dry: d, wet: w, puddleRatio: w / d, donutDry: dd, donutOnTrail: dm, trailRatio: dm / dd };
  }
  return { out, PUDDLE: R.PUDDLE_SLOW_FACTOR, BOOST: R.TRAIL.speedBoost };
}

const shipped = await measure(SRC_ROOT);
console.log(`src-root ${SRC_ROOT}  (expected puddle ${shipped.PUDDLE}, trail ${shipped.BOOST})`);
for (const [k, v] of Object.entries(shipped.out)) console.log(`  ${k.padEnd(5)} puddle ratio ${v.puddleRatio.toFixed(6)} (dry ${v.dry.toFixed(4)} wet ${v.wet.toFixed(4)}) · trail ratio ${v.trailRatio.toFixed(6)} (dry ${v.donutDry.toFixed(4)} on-trail ${v.donutOnTrail.toFixed(4)})`);
const bad = await measure(stageKnownBad());
console.log(`known-bad (ai.ts without the terrain term):`);
for (const [k, v] of Object.entries(bad.out)) console.log(`  ${k.padEnd(5)} puddle ratio ${v.puddleRatio.toFixed(6)} · trail ratio ${v.trailRatio.toFixed(6)}`);
const ok = Math.abs(shipped.out.human.puddleRatio - shipped.PUDDLE) < 1e-6 && Math.abs(shipped.out.ai.puddleRatio - shipped.PUDDLE) < 1e-6
  && Math.abs(shipped.out.human.trailRatio - shipped.BOOST) < 1e-6 && Math.abs(shipped.out.ai.trailRatio - shipped.BOOST) < 1e-6
  && Math.abs(bad.out.ai.puddleRatio - 1) < 1e-6;
console.log(ok ? 'SYMMETRIC on the shipped tree, and the known-bad is seen' : 'ASYMMETRY or instrument failure — read the rows');
writeFileSync(`${OUT_DIR}/sym.json`, JSON.stringify({ shipped, knownBad: bad, ok }, null, 2));
