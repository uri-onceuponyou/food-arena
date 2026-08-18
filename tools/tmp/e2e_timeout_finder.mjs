#!/usr/bin/env node
/**
 * Find a matchup + a REAL pair of hands that reaches the 45 s clock without a knockout.
 *
 * Why: the end-to-end run has to prove BOTH terminal states through the shipped path.
 * A knockout is trivial to provoke; a timeout is not, and the honest way to force one
 * is a player who plays to the clock (kite, never fire) rather than a patched build.
 * This is the cheap search — pure `sim.ts` in Node, ~4 ms a match — so the expensive
 * SwiftShader run only ever plays the matchup that is already known to time out.
 *
 * Sim extraction is `tools/match-sim.mjs:extractSimAt` verbatim: the sim modules
 * are copied out of `git show <ref>:` into the OS temp dir and imported from there,
 * because five peers are mid-edit in the working tree and a scratch `.ts` under
 * `tools/` would turn `npx tsc --noEmit` red for all of them.
 *
 * ⚠️ **"Verbatim" is how it broke.** It was a hardcoded six-module list, one of ELEVEN
 * copies, and §76 (`c5b9754`) added `tuningRegistry.ts` and `tuningStore.ts` to the closure.
 * This tool has no `gatecount` row, so it was one of the seven that broke in silence. The
 * list is DERIVED at the ref now (`tf2_simstage.mjs`) — and derived rather than hardcoded
 * because `--ref` is the point of this tool and no ref below `c5b9754` has those two files.
 *
 *   node tools/tmp/e2e_timeout_finder.mjs [--ref HEAD] [--top 12]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { simModulesAtRef } from './tf2_simstage.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REF = arg('--ref', 'HEAD');
const TOP = Number(arg('--top', 12));

function extractSimAt(ref) {
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = join(tmpdir(), `fa-e2e-simref-${sha}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'game'), { recursive: true });
  mkdirSync(join(dir, 'arena'), { recursive: true });
  for (const f of simModulesAtRef(ref, ROOT)) {
    writeFileSync(join(dir, 'game', f), execFileSync('git', ['show', `${ref}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
  }
  writeFileSync(join(dir, 'arena', 'types.ts'), execFileSync('git', ['show', `${ref}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
  return { dir: join(dir, 'game'), sha };
}

const SIM = extractSimAt(REF);
const { createMatch, stepMatch } = await import(`${SIM.dir}/sim.ts`);
const RULES = await import(`${SIM.dir}/rules.ts`);
const { CHARACTER_IDS, MATCH_DURATION_MS } = RULES;

const LAYOUT = `${ROOT}/tools/arena.gameplay.json`;
if (!existsSync(LAYOUT)) {
  console.error(`no ${LAYOUT}; run: node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const data = JSON.parse(readFileSync(LAYOUT, 'utf8'));
const arena = { ...data, build: () => null, update: () => {} };
const POT = arena.hazards.find((h) => h.kind === 'damage') ?? null;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
function axesToward(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  return { x: q(dx / m), y: q(dy / m) };
}

/**
 * KITE — a real, legal way to play, not a patch.
 *
 * `PLAYER_SPEED` (0.12) is strictly greater than `AI_CHASE_SPEED` (0.07), so a player
 * who simply refuses the fight cannot be run down. Priorities, in order:
 *   1. stay inside the closing ring (with margin);
 *   2. stay out of the pot;
 *   3. otherwise put the enemy behind you, biased tangentially so the wall does not
 *      pin you in a corner.
 * Never fires — a timeout needs the ENEMY alive too.
 */
function makeKite() {
  const hist = [];
  let spin = 1;
  return (state) => {
    const p = state.player, e = state.enemy;
    const cx = arena.center.x, cy = arena.center.y;
    const R = state.safeRadius;
    const dc = dist(p.x, p.y, cx, cy);

    hist.push({ t: state.elapsed, x: p.x, y: p.y });
    while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();
    if (state.phase === 'playing' && hist.length > 4 && state.elapsed - hist[0].t > 1200
      && Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 45) { spin = -spin; hist.length = 0; }

    // ORBIT. The safe disc is a circle, so state the plan in its own polar frame and
    // the ring can never be walked out of by accident: sit on the ring's own radius,
    // on the far side of the centre from the enemy. Interpolating raw atan2 values
    // (the first attempt) crosses the ±pi branch cut and marched the player straight
    // into the fog — 110/110 deaths with the enemy untouched.
    // The safe band is an ANNULUS, not a disc: the fog bites outside `R` and the pot
    // burns inside `POT.radius`. At the 45 s floor those are 140 and 95, so "run to
    // the centre" is a death sentence in the endgame. Sit in the middle of the band.
    const potR = POT ? POT.radius : 0;
    const ringR = Math.min(340, Math.max(potR + 25, (potR + R) / 2));
    // ORBIT, not antipode-chasing. Targeting the far side of the circle names a FIXED
    // point the AI can walk a chord to; every enemy in the roster reaches r<=128 and
    // all eleven landed shots. Running *tangentially* instead turns the chase into an
    // angular race, and `PLAYER_SPEED` 0.12 > `AI_CHASE_SPEED` 0.07 means the player
    // wins that race at any radius.
    const pa = Math.atan2(p.y - cy, p.x - cx);
    const ea = Math.atan2(e.y - cy, e.x - cx);
    let sep = ea - pa;
    while (sep > Math.PI) sep -= 2 * Math.PI;
    while (sep < -Math.PI) sep += 2 * Math.PI;
    const dir = sep > 0 ? -1 : 1;                 // run away from the enemy's bearing
    const ta = pa + dir * 1.1;
    let target = { x: cx + Math.cos(ta) * ringR, y: cy + Math.sin(ta) * ringR };
    if (POT && dist(target.x, target.y, POT.x, POT.y) < POT.radius + 30) {
      const a2 = ta + spin * 0.6;
      target = { x: cx + Math.cos(a2) * Math.max(POT.radius + 80, ringR), y: cy + Math.sin(a2) * Math.max(POT.radius + 80, ringR) };
    }
    if (dc > R - 40 || (POT && dist(p.x, p.y, POT.x, POT.y) < potR + 10)) {
      const a3 = Math.atan2(p.y - cy, p.x - cx);
      target = { x: cx + Math.cos(a3) * ringR, y: cy + Math.sin(a3) * ringR };
    }
    return { move: axesToward(p.x, p.y, target.x, target.y), aim: { x: e.x - p.x, y: e.y - p.y }, selectedWeapon: 0, attack: false };
  };
}

function run(player, enemy) {
  const state = createMatch(arena, player, enemy);
  const decide = makeKite();
  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let since = Infinity;
  const DT = 16.667, REACT = 150;
  const CAP = MATCH_DURATION_MS + 120_000;
  let minPhp = Infinity, minEhp = Infinity;
  while (state.phase !== 'ended' && state.elapsed < CAP) {
    if (since >= REACT) { input = decide(state); since = 0; }
    stepMatch(state, DT, input);
    since += DT;
    minPhp = Math.min(minPhp, state.player.hp);
    minEhp = Math.min(minEhp, state.enemy.hp);
  }
  const timedOut = state.player.hp > 0 && state.enemy.hp > 0;
  return {
    player, enemy, timedOut, winner: state.winner,
    php: state.player.hp, ehp: state.enemy.hp,
    rem: Math.round(state.timeRemaining), minPhp, minEhp,
    margin: Math.min(minPhp / RULES.PLAYER_MAX_HP, minEhp / RULES.ENEMY_MAX_HP),
  };
}

const rows = [];
for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) if (p !== e) rows.push(run(p, e));

const to = rows.filter((r) => r.timedOut);
console.log(`sim ${SIM.sha}  MATCH_DURATION_MS=${MATCH_DURATION_MS}  policy=kite`);
console.log(`timed out: ${to.length}/${rows.length} matchups\n`);
console.log('  most robust (largest worst-case HP margin):');
for (const r of to.sort((a, b) => b.margin - a.margin).slice(0, TOP)) {
  console.log(`    ${r.player.padEnd(10)} vs ${r.enemy.padEnd(10)}  winner=${String(r.winner).padEnd(6)} ` +
    `end p${r.php}/e${r.ehp}  worst p${r.minPhp}/e${r.minEhp}  margin ${(r.margin * 100).toFixed(0)}%`);
}
const ko = rows.filter((r) => !r.timedOut);
console.log(`\n  knocked out anyway: ${ko.length}`);
for (const r of ko.slice(0, 6)) console.log(`    ${r.player} vs ${r.enemy} -> ${r.winner} (p${r.php}/e${r.ehp}, ${r.rem}ms left)`);
