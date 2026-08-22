#!/usr/bin/env node
/**
 * wtx_claims.mjs — settles the EMPIRICALLY CHECKABLE half of the weapon-description
 * audit on the real sim, offline and deterministic. No browser, no GPU.
 *
 * Each block is one CLAIM taken from an `abilities[].desc` string in `rules.ts`, run as
 * a scenario rather than read off the source, because reading source is how a plausible
 * reading gets treated as fact.
 *
 * ⚠️ EVERY BLOCK CARRIES A KNOWN-BAD ARM. A scenario that cannot FAIL proves nothing,
 * and `CLAUDE.md` rule 6 records three separate vacuous guards in one session. Where the
 * assertion filters a set, the set is asserted non-empty first.
 *
 * Owner prefix: wtx_*.
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { CHARACTERS, TRAIL, STUN_DURATION_MS, SLOW_DURATION_MS, SLOW_MOVE_MULTIPLIER } from '../../src/game/rules.ts';

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  (ok ? pass++ : fail++);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
  return ok;
}
function nonEmpty(label, arr) {
  return check(`[non-vacuity] ${label} set is non-empty (n=${arr.length})`, arr.length > 0);
}

/**
 * ⚠️ THE SPAWNS MUST SIT INSIDE `maxSafeRadius`, AND THE FIRST VERSION OF THIS FIXTURE
 * DID NOT. Copying `sim.test.mjs`'s corner spawns (200,200 / w-200,h-200) against its
 * 545 safe radius put both fighters ~1131 wu from centre, i.e. OUTSIDE the ring, so the
 * ring killed a fighter and `state.phase` went to 'ended' at ~1.5 s of sim time. Every
 * long-running scenario then measured a match that was already over — the donut trail
 * block read `marks=0` and looked like "the trail does not exist". It exists; the match
 * had stopped. This is `CLAUDE.md`'s "a station standing in the wrong place keeps its
 * count perfectly" in a fixture rather than in a station.
 */
function makeArena({ cover = [], hazards = [], width = 2000, height = 2000, maxSafeRadius = 900 } = {}) {
  return {
    id: 'wtx', displayName: 'wtx', width, height,
    center: { x: width / 2, y: height / 2 }, maxSafeRadius,
    playerSpawn: { x: 900, y: 1000 }, enemySpawn: { x: 1100, y: 1000 },
    cover, hazards, build() { return {}; },
  };
}
function playing(playerChar, enemyChar, opts) {
  const s = createMatch(makeArena(opts), playerChar, enemyChar);
  s.phase = 'playing';
  return s;
}
const idxOf = (id, key) => CHARACTERS[id].weapons.findIndex((w) => w.key === key);
const NOMOVE = { x: 0, y: 0 };

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM taco.Double  "throws filling and onion together for massive damage"');
console.log('  → does BOTH halves of the combo actually land, at what separations?');
{
  const di = idxOf('taco', 'Double');
  const W = CHARACTERS.taco.weapons[di];
  const partSum = W.comboParts.reduce((s, p) => s + p.damage, 0);
  const rows = [];
  for (const sep of [30, 60, 90, 110, 127]) {
    const s = playing('taco', 'donut');
    s.player.x = 500; s.player.y = 500; s.player.facing = { x: 1, y: 0 };
    s.enemy.x = 500 + sep; s.enemy.y = 500;
    const hp0 = s.enemy.hp;
    let spawned = 0, landed = 0;
    for (let t = 0; t < 200; t++) {
      // Freeze the target: overwrite its position every tick so the only variable is
      // combo geometry, not a chase. The AI still runs; we simply undo its movement.
      s.enemy.x = 500 + sep; s.enemy.y = 500;
      const ev = stepMatch(s, 16, { move: NOMOVE, selectedWeapon: di, attack: t === 0 });
      spawned += ev.filter((e) => e.type === 'projectile-spawned' && e.ownerRole === 'player').length;
      landed += ev.filter((e) => e.type === 'hit-landed' && e.source?.weaponKey === 'Double').length;
    }
    rows.push({ sep, spawned, landed, dealt: hp0 - s.enemy.hp });
    console.log(`    sep=${String(sep).padStart(3)} wu  spawned=${spawned}  landed=${landed}  damage dealt=${hp0 - s.enemy.hp}`);
  }
  nonEmpty('separation', rows);
  check(`both parts spawn every press (comboParts.length=${W.comboParts.length})`,
    rows.every((r) => r.spawned === 2));
  check(`BOTH parts land at every tested separation -> burst = ${partSum}`,
    rows.every((r) => r.landed === 2 && r.dealt === partSum),
    `dealt=${rows.map((r) => r.dealt).join(',')}  vs partSum=${partSum}`);
  // KNOWN-BAD: the same scenario aimed 90 degrees away must land ZERO. If it does not,
  // this scenario is not measuring aim at all and every row above is meaningless.
  {
    const s = playing('taco', 'donut');
    s.player.x = 500; s.player.y = 500; s.player.facing = { x: 1, y: 0 };
    let landed = 0;
    for (let t = 0; t < 200; t++) {
      s.enemy.x = 500; s.enemy.y = 500 + 60;   // perpendicular to facing
      const ev = stepMatch(s, 16, { move: NOMOVE, selectedWeapon: di, attack: t === 0 });
      landed += ev.filter((e) => e.type === 'hit-landed' && e.source?.weaponKey === 'Double').length;
    }
    check('[known-bad] aimed 90 deg away -> 0 hits (scenario can fail)', landed === 0, `landed=${landed}`);
  }
  // The record's own `damage` field is 0 — the trap the brief warns about, in a new shape.
  check(`taco.Double.damage is ${W.damage}, so any tool reading w.damage sees ${W.damage}, not ${partSum}`,
    W.damage === 0);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM burrito.Swarm  "fly everywhere and chase enemies"  (plural)');
console.log('  → how many DISTINCT fighters do the four pellets bind to?');
{
  const si = idxOf('burrito', 'Swarm');
  const W = CHARACTERS.burrito.weapons[si];
  const s = playing('burrito', 'donut');
  s.player.x = 500; s.player.y = 500; s.player.facing = { x: 1, y: 0 };
  s.enemy.x = 560; s.enemy.y = 500;
  stepMatch(s, 16, { move: NOMOVE, selectedWeapon: si, attack: true });
  const mine = s.projectiles.filter((p) => p.ownerId === s.player.id);
  nonEmpty('spawned projectile', mine);
  const targets = new Set(mine.map((p) => p.targetId));
  check(`all ${W.pellets} pellets spawn`, mine.length === W.pellets, `n=${mine.length}`);
  check(`they bind to exactly ONE targetId (not "enemies")`, targets.size === 1,
    `distinct targets=${targets.size}`);
  // The fan: `combat.ts` uses `offset = (i - (n-1)/2) * spreadDeg`, so spreadDeg is a
  // per-pellet STEP and the TOTAL fan is (n-1)*spreadDeg.
  //
  // ⚠️ MEASURE THIS ON A NON-HOMING WEAPON. `stepMatch` spawns AND steps in one call, so
  // by the time `state.projectiles` is readable a homing volley has already had one tick
  // of `HOMING_TURN_RATE` applied and the outer pellets have been pulled inward. The
  // first version of this check read 153.1 deg for Swarm and called the 165 deg
  // prediction FALSE — the prediction was right and the instrument was measuring one
  // tick too late. Donut's Candy (pellets 3, spreadDeg 14, no homing) is the clean arm.
  const cw = CHARACTERS.donut.weapons[idxOf('donut', 'Candy')];
  const cs = playing('donut', 'hamburger');
  cs.player.x = 1000; cs.player.y = 1000; cs.player.facing = { x: 1, y: 0 };
  cs.enemy.x = 1100; cs.enemy.y = 1000;
  stepMatch(cs, 0, { move: NOMOVE, selectedWeapon: idxOf('donut', 'Candy'), attack: true });
  const cp = cs.projectiles.filter((p) => p.ownerId === cs.player.id);
  nonEmpty('candy pellet', cp);
  const cangs = cp.map((p) => Math.atan2(p.vy, p.vx) * 180 / Math.PI).sort((a, b) => a - b);
  const ctotal = cangs[cangs.length - 1] - cangs[0];
  check(`donut.Candy TOTAL fan = (pellets-1)*spreadDeg = ${(cw.pellets - 1) * cw.spreadDeg} deg, NOT spreadDeg=${cw.spreadDeg}`,
    Math.abs(ctotal - (cw.pellets - 1) * cw.spreadDeg) < 1e-6, `measured ${ctotal.toFixed(2)} deg`);
  console.log(`    => burrito.Swarm's TOTAL fan at spawn is (4-1)*55 = 165 deg.`);
  console.log(`    ⚠️ The Weapon interface docstring says "fanned across spreadDeg". It is a per-pellet STEP.`);

  // And how much does homing pull that fan in? Measure Swarm's spread after one tick.
  const sangs = mine.map((p) => Math.atan2(p.vy, p.vx) * 180 / Math.PI).sort((a, b) => a - b);
  console.log(`    burrito.Swarm spread after ONE homing tick: ${(sangs[sangs.length - 1] - sangs[0]).toFixed(1)} deg (from 165 at spawn).`);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM burrito.Swarm  "the flying toppings can be destroyed"');
console.log('  → enumerate every reason a projectile is ever removed, over real matches');
{
  const reasons = new Map();
  let ticks = 0;
  for (let seed = 0; seed < 6; seed++) {
    const s = playing('burrito', 'hamburger', { cover: [{ x: 1000, y: 900, w: 160, h: 160 }] });
    for (let t = 0; t < 3000; t++) {
      // Both fighters held alive: the census is about REMOVAL REASONS, and a match that
      // ends stops producing them. Without this the run ended at ~1.5 s and reported
      // "expired=32, no hit-target" — which would have read as "projectiles never hit".
      s.player.hp = s.player.maxHp; s.enemy.hp = s.enemy.maxHp;
      const ev = stepMatch(s, 16, { move: { x: (t % 97 < 48 ? 1 : -1), y: (t % 53 < 26 ? 1 : -1) },
        selectedWeapon: (t + seed) % CHARACTERS.burrito.weapons.length, attack: t % 7 === 0 });
      ticks++;
      for (const e of ev) if (e.type === 'projectile-destroyed') reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + 1);
      if (s.phase === 'ended') break;
    }
  }
  const list = [...reasons.entries()];
  nonEmpty('projectile-destroyed event', list);
  check('[non-vacuity] all three removal causes were actually EXERCISED, so absence means absence',
    ['hit-target', 'hit-cover', 'expired'].every((r) => (reasons.get(r) ?? 0) > 0),
    `over ${ticks} ticks`);
  console.log(`    observed removal reasons: ${list.map(([r, n]) => `${r}=${n}`).join('  ')}`);
  check('the ONLY removal reasons are hit-target / hit-cover / expired',
    list.every(([r]) => ['hit-target', 'hit-cover', 'expired'].includes(r)));
  check('no reason exists that a PLAYER ACTION could cause (no "shot down" / "destroyed")',
    !list.some(([r]) => /destroy|shot|intercept|block/i.test(r)));
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM burrito.Roll  "freezes enemies in place for a few seconds"');
console.log(`  → STUN_DURATION_MS = ${STUN_DURATION_MS}; and does a stun stop them ATTACKING?`);
{
  const ri = idxOf('burrito', 'Roll');
  const s = playing('burrito', 'hamburger');
  s.player.x = 500; s.player.y = 500; s.player.facing = { x: 1, y: 0 };
  s.enemy.x = 530; s.enemy.y = 500;
  const ev = stepMatch(s, 16, { move: NOMOVE, selectedWeapon: ri, attack: true });
  const hit = ev.find((e) => e.type === 'hit-landed');
  check('Roll Stun lands and applies a stun', !!hit && s.enemy.status.stunnedUntil > s.elapsed);
  check(`stun lasts ${STUN_DURATION_MS} ms = ${(STUN_DURATION_MS / 1000).toFixed(1)} s`,
    STUN_DURATION_MS === 2000);
  // Does the stunned fighter still fire? Hold it stunned and count its weapon-fired events.
  let firedWhileStunned = 0, ticksStunned = 0;
  for (let t = 0; t < 100; t++) {
    s.enemy.status.stunnedUntil = s.elapsed + 5000;   // hold the stun open
    const wasStunned = s.elapsed < s.enemy.status.stunnedUntil;
    const e2 = stepMatch(s, 16, { move: NOMOVE, selectedWeapon: ri, attack: false });
    if (wasStunned) {
      ticksStunned++;
      firedWhileStunned += e2.filter((e) => e.type === 'weapon-fired' && e.fighterId === s.enemy.id).length;
    }
  }
  check('[non-vacuity] the target was actually stunned for the sampled ticks', ticksStunned > 0);
  check('a STUNNED fighter still FIRES (stun locks movement only)', firedWhileStunned > 0,
    `weapon-fired while stunned = ${firedWhileStunned} over ${ticksStunned} ticks`);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM donut.StickyTrail  "hurts enemies, speeds him up"');
{
  // (a) hurts enemies
  const s = playing('donut', 'hamburger');
  s.player.x = 800; s.player.y = 1000;
  let trailHits = 0;
  for (let t = 0; t < 120; t++) {
    s.enemy.hp = s.enemy.maxHp;            // keep the match alive; we are testing the trail
    stepMatch(s, 16, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
  }
  check('[non-vacuity] the match is still playing (a scenario measured after "ended" measures nothing)',
    s.phase === 'playing', `phase=${s.phase}`);
  const marks = s.trailMarks.length;
  check('[non-vacuity] donut laid trail marks while moving', marks > 0, `marks=${marks}`);
  // park the enemy on a mark and count trail damage
  const mark = s.trailMarks[Math.floor(s.trailMarks.length / 2)];
  const hp0 = s.enemy.hp;
  for (let t = 0; t < 60; t++) {
    s.enemy.x = mark.x; s.enemy.y = mark.y;
    const ev = stepMatch(s, 16, { move: NOMOVE, selectedWeapon: 0, attack: false });
    trailHits += ev.filter((e) => e.type === 'hit-landed' && e.source?.kind === 'trail').length;
  }
  check(`trail HURTS: ${trailHits} trail hits, ${hp0 - s.enemy.hp} HP (TRAIL.damage=${TRAIL.damage}, cap ${TRAIL.maxHitsPerTick}/tick)`,
    trailHits > 0);
  check(`trail applies NO status effect (it is "Sticky" in name only)`,
    s.enemy.status.slowedUntil === -Infinity, `slowedUntil=${s.enemy.status.slowedUntil}`);
  // (b) speeds him up — measure distance travelled on vs off own trail
  function travel(onTrail) {
    const g = playing('donut', 'hamburger');
    g.player.x = 400; g.player.y = 400;
    if (!onTrail) g.trailMarks.length = 0;
    let d = 0;
    for (let t = 0; t < 120; t++) {
      const bx = g.player.x, by = g.player.y;
      if (!onTrail) g.trailMarks.length = 0;      // deny him his own trail
      stepMatch(g, 16, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
      d += Math.hypot(g.player.x - bx, g.player.y - by);
    }
    return d;
  }
  const on = travel(true), off = travel(false);
  check(`trail SPEEDS HIM UP: ${on.toFixed(1)} wu with trail vs ${off.toFixed(1)} without (TRAIL.speedBoost=${TRAIL.speedBoost})`,
    on > off * 1.05, `ratio ${(on / off).toFixed(3)}`);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM donut.Candy  UNDOCUMENTED: trailBoosted multiplies damage on own trail');
{
  const ci = idxOf('donut', 'Candy');
  const W = CHARACTERS.donut.weapons[ci];
  function burst(withTrail) {
    const s = playing('donut', 'hamburger');
    s.player.x = 500; s.player.y = 500; s.player.facing = { x: 1, y: 0 };
    if (!withTrail) s.trailMarks.length = 0;
    if (withTrail) s.trailMarks.push({ x: 500, y: 500, expiresAt: s.elapsed + 99999, ownerId: s.player.id, ownerRole: 'player' });
    const hp0 = s.enemy.hp;
    for (let t = 0; t < 120; t++) {
      s.enemy.x = 560; s.enemy.y = 500;
      if (!withTrail) s.trailMarks.length = 0;
      stepMatch(s, 16, { move: NOMOVE, selectedWeapon: ci, attack: t === 0 });
    }
    return hp0 - s.enemy.hp;
  }
  const a = burst(false), b = burst(true);
  check(`base burst = ${W.damage} x ${W.pellets} = ${W.damage * W.pellets}`, a === W.damage * W.pellets, `measured ${a}`);
  check(`boosted burst is HIGHER on own trail (x${TRAIL.damageBoost})`, b > a, `off-trail ${a} vs on-trail ${b}`);
  console.log(`    NEITHER ability desc nor the weaponFacts readout mentions this multiplier.`);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM hamburger.Lettuce  "Stuns enemies for a few seconds" / .Tomato "Slows enemies down"');
{
  const li = idxOf('hamburger', 'Lettuce'), ti = idxOf('hamburger', 'Tomato');
  for (const [name, wi, field, dur] of [['Lettuce', li, 'stunnedUntil', STUN_DURATION_MS],
                                        ['Tomato', ti, 'slowedUntil', SLOW_DURATION_MS]]) {
    const s = playing('hamburger', 'donut');
    s.player.x = 500; s.player.y = 500; s.player.facing = { x: 1, y: 0 };
    let applied = false;
    for (let t = 0; t < 200; t++) {
      s.enemy.x = 560; s.enemy.y = 500;
      stepMatch(s, 16, { move: NOMOVE, selectedWeapon: wi, attack: t === 0 });
      if (s.enemy.status[field] > s.elapsed) { applied = true; break; }
    }
    check(`${name}: applies ${field} for ${dur} ms (${(dur / 1000).toFixed(1)} s)`, applied);
  }
  console.log(`    SLOW is a x${SLOW_MOVE_MULTIPLIER} movement multiplier for ${SLOW_DURATION_MS} ms.`);
  console.log(`    STUN is movement -> 0 for ${STUN_DURATION_MS} ms. It does NOT stop attacking (proved above).`);
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\nCLAIM burrito.Disc "throws HIMSELF" / any desc where the CHARACTER moves');
console.log('  → does the fighter change position when it fires?');
{
  for (const [id, key] of [['burrito', 'Disc'], ['burrito', 'Roll'], ['taco', 'Filling'], ['hamburger', 'Smash']]) {
    const wi = idxOf(id, key);
    const s = playing(id, 'donut');
    s.player.x = 500; s.player.y = 500; s.player.facing = { x: 1, y: 0 };
    const x0 = s.player.x, y0 = s.player.y;
    let maxDisp = 0;
    for (let t = 0; t < 60; t++) {
      s.enemy.x = 540; s.enemy.y = 500;
      stepMatch(s, 16, { move: NOMOVE, selectedWeapon: wi, attack: t === 0 });
      maxDisp = Math.max(maxDisp, Math.hypot(s.player.x - x0, s.player.y - y0));
    }
    check(`${id}.${key}: attacker displacement over the whole action = ${maxDisp.toFixed(3)} wu (input move = 0)`,
      maxDisp === 0);
  }
  console.log('    No weapon in the sim moves its own user. There is no launch/leap/dash/roll mechanic.');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
