#!/usr/bin/env node
/**
 * "The status lock is bounded now" — checked against the number it replaced.
 *
 * 07a4e3a claims a weapon whose cooldown is shorter than the status it applies can no
 * longer hold that status up forever; the recorded before-figures are **31.4% of
 * engaged time movement-locked** and a **longest unbroken lock of 11.02 s** against a
 * 6.0 s mean engagement. Both were measured through a probe, so this re-derives them
 * from the committed sim over all 110 matchups.
 *
 * Pure `sim.ts` in Node (the `extractSimAt` freeze from `tools/match-sim.mjs`), because
 * `stunnedUntil` is sim state that the renderer never publishes — `__vfxDebugFighters`
 * carries hp/alive/terrainSlowFactor and nothing about status. The browser side of this
 * question is in `tools/tmp/journey.mjs` as an OBSERVABLE instead: input held, zero
 * displacement, for how long.
 *
 *   node tools/tmp/e2e_statuslock.mjs [--ref HEAD]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { simModulesAtRef } from './tf2_simstage.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const REF = argv.includes('--ref') ? argv[argv.indexOf('--ref') + 1] : 'HEAD';

/**
 * ⚠️ **WAS: a hardcoded six-module list, one of ELEVEN copies.** §76 (`c5b9754`) added
 * `tuningRegistry.ts` and `tuningStore.ts` to `sim.ts`'s closure and this tool was one of
 * the seven with no `gatecount` row, so it broke in silence. The list is DERIVED at the ref
 * now — `tf2_simstage.mjs` explains why derived-at-the-ref rather than eight strings: this
 * tool takes `--ref`, and any ref below `c5b9754` has no `tuningRegistry.ts` to extract.
 *
 * 🚨 **AND THE CACHE PREDICATE WAS PART OF THE BUG.** It asked only whether `sim.ts`
 * existed, so a directory left behind by the broken six-file extraction is a CACHE HIT: the
 * fix above would have been skipped entirely and the tool would keep failing on a stale
 * `$TMPDIR` for as long as the machine kept it. It now requires every module in the closure.
 */
function extractSimAt(ref) {
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = join(tmpdir(), `fa-e2e-simref-${sha}`);
  const modules = simModulesAtRef(ref, ROOT);
  const complete = modules.every((f) => existsSync(join(dir, 'game', f)));
  if (!complete) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 'game'), { recursive: true });
    mkdirSync(join(dir, 'arena'), { recursive: true });
    for (const f of modules) {
      writeFileSync(join(dir, 'game', f), execFileSync('git', ['show', `${ref}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
    }
    writeFileSync(join(dir, 'arena', 'types.ts'), execFileSync('git', ['show', `${ref}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
  }
  return { dir: join(dir, 'game'), sha };
}

const SIM = extractSimAt(REF);
const { createMatch, stepMatch } = await import(`${SIM.dir}/sim.ts`);
const R = await import(`${SIM.dir}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, HIT_RADIUS_VS_ENEMY, HIT_RADIUS_VS_PLAYER } = R;

const arenaData = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const arena = { ...arenaData, build: () => null, update: () => {} };

const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
const axesToward = (fx, fy, tx, ty) => {
  const dx = tx - fx, dy = ty - fy, m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  return { x: q(dx / m), y: q(dy / m) };
};
const maxRange = (id) => Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);

/** Straight-in aggression: the case that MAXIMISES exposure to an applied status. */
function chase(state) {
  const p = state.player, e = state.enemy;
  const d = dist(p.x, p.y, e.x, e.y);
  const ws = CHARACTERS[p.characterId].weapons;
  let idx = 0, best = -Infinity;
  ws.forEach((w, i) => {
    if (w.type === 'self') return;
    if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
    if (d > (w.range ?? Infinity)) return;
    if ((w.damage ?? 0) > best) { best = w.damage ?? 0; idx = i; }
  });
  return { move: axesToward(p.x, p.y, e.x, e.y), aim: { x: e.x - p.x, y: e.y - p.y }, selectedWeapon: idx, attack: true };
}

const rows = [];
for (const player of CHARACTER_IDS) {
  for (const enemy of CHARACTER_IDS) {
    if (player === enemy) continue;
    const state = createMatch(arena, player, enemy);
    const engage = Math.max(maxRange(player) + HIT_RADIUS_VS_ENEMY, maxRange(enemy) + HIT_RADIUS_VS_PLAYER);
    let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    let since = Infinity;
    const DT = 16.667;
    let lockedMs = 0, engagedMs = 0, run = 0, worst = 0;
    while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS + 120_000) {
      if (since >= 150) { input = chase(state); since = 0; }
      stepMatch(state, DT, input);
      since += DT;
      if (state.phase !== 'playing') continue;
      const locked = state.player.status.stunnedUntil > state.elapsed;
      const eng = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= engage;
      if (eng) engagedMs += DT;
      if (locked) { lockedMs += DT; run += DT; worst = Math.max(worst, run); } else run = 0;
    }
    rows.push({ player, enemy, lockedMs, engagedMs, worst, lockedFrac: engagedMs ? lockedMs / engagedMs : 0 });
  }
}

const worst = rows.reduce((a, b) => (b.worst > a.worst ? b : a));
const totLocked = rows.reduce((s, r) => s + r.lockedMs, 0);
const totEngaged = rows.reduce((s, r) => s + r.engagedMs, 0);
console.log(`sim ${SIM.sha}  policy=chase (maximum exposure)  ${rows.length} matchups`);
console.log(`  movement-locked share of ENGAGED time ... ${((totLocked / totEngaged) * 100).toFixed(1)}%   (was 31.4%)`);
console.log(`  longest unbroken lock, worst matchup .... ${(worst.worst / 1000).toFixed(2)} s  [${worst.player} vs ${worst.enemy}]   (was 11.02 s)`);
console.log(`  STUN_DURATION_MS=${R.STUN_DURATION_MS}  STUN_GRACE_MS=${R.STUN_GRACE_MS}  SLOW_DURATION_MS=${R.SLOW_DURATION_MS}  SLOW_GRACE_MS=${R.SLOW_GRACE_MS}`);
const over = rows.filter((r) => r.worst > R.STUN_DURATION_MS + R.STUN_GRACE_MS + 200);
console.log(`  matchups whose longest lock exceeds STUN_DURATION+GRACE: ${over.length}/${rows.length}`);
for (const r of rows.sort((a, b) => b.worst - a.worst).slice(0, 6)) {
  console.log(`    ${r.player.padEnd(11)} vs ${r.enemy.padEnd(11)} longest ${(r.worst / 1000).toFixed(2)}s  locked ${(r.lockedFrac * 100).toFixed(1)}% of engaged`);
}
