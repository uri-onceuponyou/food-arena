#!/usr/bin/env node
/**
 * BB_PROBE — the two one-tick controls that establish the two defects this pass fixes,
 * BEFORE either is touched. `CLAUDE.md` #5: probe before you loop.
 *
 *   --block   Can a body block a shot?  Six seats, a shooter at slot 0, a bystander
 *             standing ON the line between the shooter and its nominal target. Reports
 *             who took the damage.
 *   --trail   Does `TRAIL.speedBoost` reach a BOT?  The same shape as the terrain-slow
 *             control that caught the fifth `ai.ts` defect (`sim.test.mjs` §25(a)):
 *             displacement over N ticks, dry vs standing on one's own trail, measured on
 *             the PLAYER seat and on the AI seat, with the player arm as the positive
 *             control. If the player does not speed up either, the rig is blind and its
 *             "no" for the bot means nothing.
 *
 * Both arms take `--src <dir>` so the same rig runs against a pre-fix tree.
 *
 * `docs/AGENT-BRIEF.md` §3: three tools here ran their whole CLI path on import. Guarded.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const DT = 16.667;

export async function loadSim(simDir) {
  const sim = await import(`${simDir}/sim.ts`);
  const rules = await import(`${simDir}/rules.ts`);
  const state = await import(`${simDir}/state.ts`);
  return { ...sim, RULES: rules, STATE: state };
}

/** A flat, empty arena big enough that nothing here is ever in the fog or in cover. */
const OPEN = {
  id: 'bb_probe', displayName: 'bb_probe', width: 8000, height: 8000,
  center: { x: 4000, y: 4000 }, maxSafeRadius: 1e6,
  playerSpawn: { x: 3000, y: 4000 }, enemySpawn: { x: 5000, y: 4000 },
  cover: [], hazards: [], build: () => null, update: () => {},
};

// ─────────────────────────────────────────────────────────────────────────────
// --block : can a body block a shot?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Six seats on a line running due east from the shooter:
 *
 *   slot 0 shooter ...... slot 1 BYSTANDER (near) ...... slot 2 nominal target (far)
 *
 * The shooter's nominal target is `nearestLivingOpponent`, so the bystander has to be
 * FARTHER than the intended victim for "aimed at slot 2, blocked by slot 1" to be the
 * question. Instead of fighting the target rule, the target is forced: the projectile is
 * spawned by a real press and then its `targetId` is REWRITTEN to the far fighter, which
 * is exactly the situation six seats produce naturally (your target runs behind someone).
 *
 * Reports the id of every fighter the volley damaged.
 */
export async function runBlock(simDir, { charId = 'hotdog', weaponKey = 'Mustard' } = {}) {
  const S = await loadSim(simDir);
  const { CHARACTERS } = S.RULES;
  const idx = CHARACTERS[charId].weapons.findIndex((w) => w.key === weaponKey);
  if (idx < 0) throw new Error(`bb_probe: ${charId} has no weapon ${weaponKey}`);
  const w = CHARACTERS[charId].weapons[idx];
  if (w.type !== 'ranged') throw new Error(`bb_probe: ${charId}.${weaponKey} is ${w.type}, not ranged`);

  const N = 6;
  const roster = Array.from({ length: N }, (_, i) => ({
    characterId: i === 0 ? charId : 'hamburger',
    spawn: { x: OPEN.center.x + i * 300, y: OPEN.center.y },
    controller: i === 0 ? 'human' : 'human', // all human: no bot may wander out of the line
  }));
  const st = S.createMatch(OPEN, roster);
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  const idleAll = roster.map(() => IDLE);
  while (st.phase !== 'playing') S.stepMatch(st, DT, idleAll);

  const F = st.fighters;
  // Park everyone on the east line and out of the way except the two that matter.
  const AX = OPEN.center.x, AY = OPEN.center.y;
  const BLOCKER_AT = 60;    // wu east of the shooter — squarely on the segment
  const TARGET_AT = 110;    // wu east of the shooter — inside every weapon's own `range`
  for (const f of F) { f.hp = 1e7; f.maxHp = 1e7; }
  F[0].x = AX; F[0].y = AY; F[0].facing = { x: 1, y: 0 };
  F[1].x = AX + BLOCKER_AT; F[1].y = AY;
  F[2].x = AX + TARGET_AT; F[2].y = AY;
  for (let i = 3; i < N; i++) { F[i].x = AX - 3000; F[i].y = AY + i * 200; }

  // NON-VACUITY, asserted before anything is filtered or counted: the blocker really does
  // stand on the segment, really is a living opponent, and really is inside its own hit
  // radius of that line.
  const pre = {
    seats: F.length,
    blockerOnLine: Math.abs(F[1].y - AY) < 1e-9 && F[1].x > F[0].x && F[1].x < F[2].x,
    blockerLiving: F[1].alive && F[1].hp > 0,
    blockerHitRadius: F[1].hitRadius,
  };

  const events = [];
  const press = idleAll.slice();
  press[0] = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: idx, attack: true };
  for (const ev of S.stepMatch(st, DT, press)) events.push(ev);
  // Force the nominal target to the FAR fighter, so "hit the target" and "hit whoever it
  // strikes" are different sentences.
  let retargeted = 0;
  for (const p of st.projectiles) {
    if (p.ownerId !== F[0].id) continue;
    p.targetId = F[2].id; p.targetRole = F[2].role;
    p.tx = F[2].x; p.ty = F[2].y;
    retargeted++;
  }

  const victims = new Map();
  for (let t = 0; t < 240 && st.projectiles.length > 0; t++) {
    for (const ev of S.stepMatch(st, DT, idleAll)) {
      if (ev.type === 'hit-landed' && ev.source?.kind === 'weapon') {
        victims.set(ev.targetId, (victims.get(ev.targetId) ?? 0) + 1);
      }
    }
  }
  return { ...pre, retargeted, weapon: `${charId}.${weaponKey}`, pellets: w.pellets ?? 1,
    victims: [...victims.entries()].map(([id, n]) => `${id}x${n}`).join(' ') || '(none)',
    hitBlocker: victims.has(F[1].id), hitTarget: victims.has(F[2].id) };
}

// ─────────────────────────────────────────────────────────────────────────────
// --trail : does the speed boost reach a bot?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Displacement of one seat over `ticks`, optionally standing on a mark of its OWN.
 * Same shape as `wm_vocab.mjs:walkOnce`, which is the rig that measured the terrain-slow
 * asymmetry — deliberately, so the two numbers are comparable.
 */
function walkOnce(S, { onTrail, seat, ticks = 12 }) {
  const roster = [
    { characterId: 'donut', spawn: { x: 1000, y: 4000 }, controller: 'human' },
    { characterId: 'donut', spawn: { x: 7000, y: 4000 }, controller: 'ai' },
  ];
  const st = S.createMatch(OPEN, roster);
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  while (st.phase !== 'playing') S.stepMatch(st, DT, [IDLE, null]);
  // Far apart, so the bot is in its chase-MOVE branch and neither is in weapon reach.
  const me = seat === 'player' ? st.fighters[0] : st.fighters[1];
  const foe = seat === 'player' ? st.fighters[1] : st.fighters[0];
  me.x = 800; me.y = 4000;
  foe.x = 7200; foe.y = 4000;
  const input = seat === 'player'
    ? [{ move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: false }, null]
    : [IDLE, null];
  let moved = 0;
  let onTrailTicks = 0;
  for (let i = 0; i < ticks; i++) {
    st.trailMarks.length = 0;
    if (onTrail) {
      // Injected rather than earned: a mark the fighter DROPPED would also depend on the
      // drop interval and on the fighter having already moved, which would confound the
      // arm. `ownerId` is the fighter's own slot, which is what `isOnOwnTrail` keys on.
      st.trailMarks.push({
        id: st.nextId++, ownerId: me.id, ownerRole: me.role, x: me.x, y: me.y,
        expiresAt: st.elapsed + 1e6, damagedMask: 0, damaged: false,
      });
      onTrailTicks++;
    }
    const bx = me.x, by = me.y;
    S.stepMatch(st, DT, input);
    moved += Math.hypot(me.x - bx, me.y - by);
  }
  return { moved, onTrailTicks };
}

export async function runTrail(simDir) {
  const S = await loadSim(simDir);
  const pDry = walkOnce(S, { onTrail: false, seat: 'player' });
  const pWet = walkOnce(S, { onTrail: true, seat: 'player' });
  const eDry = walkOnce(S, { onTrail: false, seat: 'enemy' });
  const eWet = walkOnce(S, { onTrail: true, seat: 'enemy' });
  const playerRatio = pDry.moved > 0 ? pWet.moved / pDry.moved : NaN;
  const botRatio = eDry.moved > 0 ? eWet.moved / eDry.moved : NaN;
  return {
    boost: S.RULES.TRAIL.speedBoost,
    pDry: pDry.moved, pWet: pWet.moved, eDry: eDry.moved, eWet: eWet.moved,
    playerRatio, botRatio,
    // POSITIVE CONTROL: both seats must actually have moved, and the PLAYER must actually
    // have been boosted. Without this a rig that never seated a mark would report "the bot
    // is not boosted" with total confidence — and so would one whose fighters never moved.
    controlOk: pDry.moved > 1 && eDry.moved > 1 && playerRatio > 1.01,
    reachesBot: eDry.moved > 1 && botRatio > 1.01,
    onTrailTicks: `${pWet.onTrailTicks}/${eWet.onTrailTicks}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

if (IS_MAIN) {
  const simDir = args.src ? resolve(args.src) : join(ROOT, 'src/game');
  const wantAll = !args.block && !args.trail;
  if (args.block || wantAll) {
    for (const [c, k] of [['hotdog', 'Mustard'], ['burrito', 'Swarm'], ['sushi', 'Catch'], ['egg', 'Hatch']]) {
      const r = await runBlock(simDir, { charId: c, weaponKey: k });
      console.log(`BLOCK  ${r.weapon.padEnd(16)} pellets=${r.pellets} seats=${r.seats} `
        + `blockerOnLine=${r.blockerOnLine} living=${r.blockerLiving} r=${r.blockerHitRadius} `
        + `retargeted=${r.retargeted}  victims=${r.victims}  `
        + `blocked=${r.hitBlocker ? 'YES' : 'no'} targetHit=${r.hitTarget ? 'YES' : 'no'}`);
    }
  }
  if (args.trail || wantAll) {
    const r = await runTrail(simDir);
    console.log(`TRAIL  boost=${r.boost}  player ${r.pDry.toFixed(4)} -> ${r.pWet.toFixed(4)} `
      + `ratio ${r.playerRatio.toFixed(6)}   bot ${r.eDry.toFixed(4)} -> ${r.eWet.toFixed(4)} `
      + `ratio ${r.botRatio.toFixed(6)}   controlOk=${r.controlOk} reachesBot=${r.reachesBot} `
      + `marks=${r.onTrailTicks}`);
  }
}
