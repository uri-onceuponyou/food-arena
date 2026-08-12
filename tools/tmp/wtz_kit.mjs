#!/usr/bin/env node
/**
 * WTZ_KIT — what a weapon ACTUALLY does, measured on the real sim, for the
 * description audit (soup · waterbottle · hotdog shard).
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `CharacterDef.abilities[].desc` is prose shown on the character card. Nothing in
 * this repo checks it against `CharacterDef.weapons`, and `DECISIONS §13` already
 * records that class ("the stat card is fiction"). This tool answers, per weapon,
 * only questions the SIM can answer, by running it — never by reading the record and
 * asserting arithmetic about it, because the record is the thing under audit.
 *
 *   PRESS    how many projectiles ONE press actually spawns  (`projectile-spawned`)
 *   FAN      the total angular span of those projectiles, measured off their velocities
 *   DAMAGE   what a target actually LOSES from one press landing everything
 *   EFFECT   what a target's status timers actually do when the press lands
 *   WINDUP   ms between `weapon-fired` and the first `hit-landed` at point blank
 *
 * ── KNOWN-BAD VALIDATION (`--selftest`) ─────────────────────────────────────
 *
 * Every measurement above is run against a MUTATED weapon record whose answer is
 * known, and the run fails if the instrument does not notice. Per `CLAUDE.md` rule 6
 * a guard that has not been shown to FAIL on the bug it guards is not a guard, and
 * three of these arms would otherwise be vacuous by construction (a `.filter()` over
 * an empty event list `.every()`s to true).
 *
 *   node tools/tmp/wtz_kit.mjs --selftest
 *   node tools/tmp/wtz_kit.mjs                     # the three-character shard
 *   node tools/tmp/wtz_kit.mjs --all               # whole roster
 *   node tools/tmp/wtz_kit.mjs --json out.json
 */

import { createMatch, stepMatch } from '../../src/game/sim.ts';
import {
  CHARACTERS, CHARACTER_IDS, SLOW_DURATION_MS, STUN_DURATION_MS,
  SLOW_MOVE_MULTIPLIER, SLOW_GRACE_MS, STUN_GRACE_MS,
} from '../../src/game/rules.ts';

const SHARD = ['soup', 'waterbottle', 'hotdog'];
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

const TICK = 16; // ms — the sim is fed a fixed dt so every number here is reproducible

function makeArena({ width = 4000, height = 4000 } = {}) {
  return {
    id: 'wtz-fixture', displayName: 'WTZ fixture',
    width, height, center: { x: width / 2, y: height / 2 },
    // Big enough that the fog never closes inside the window we measure in; the fog
    // is a damage source and would contaminate the DAMAGE column otherwise.
    maxSafeRadius: 4000,
    playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: width - 200, y: height - 200 },
    cover: [], hazards: [], build() { return {}; },
  };
}

const NO_INPUT = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

/**
 * Fire `weaponIndex` ONCE, with the enemy parked `sep` wu due +X of the player and
 * the player facing +X, and run the sim forward `windowMs`. The enemy is pinned every
 * tick (position AND facing) so nothing it does can move the numbers — the AI is the
 * only other actor and it must not be allowed to shoot back into the DAMAGE column.
 *
 * ⚠️ The enemy's HP is topped back up every tick BEFORE the step, never after, so a
 * death cannot end the match mid-window and truncate a multi-pellet volley.
 */
function fireOnce(charId, weaponIndex, { sep = 40, windowMs = 4000, enemy = 'donut', pinHp = true } = {}) {
  const arena = makeArena();
  const state = createMatch(arena, charId, enemy);
  state.phase = 'playing';
  const [me, foe] = [state.fighters[0], state.fighters[1]];
  const cx = arena.center.x, cy = arena.center.y;
  me.x = cx; me.y = cy; me.facing = { x: 1, y: 0 };
  foe.x = cx + sep; foe.y = cy;

  const events = [];
  const firstTick = [];
  let firedAt = null;

  for (let t = 0; t < windowMs; t += TICK) {
    // Pin the target: no movement, no counter-fire, no death.
    foe.x = cx + sep; foe.y = cy;
    if (pinHp) { foe.hp = foe.maxHp; foe.alive = true; }
    foe.status.slowedUntil = -Infinity; foe.status.stunnedUntil = -Infinity;
    foe.lastUsed = foe.lastUsed.map(() => Infinity); // the AI can attempt but never pass the cooldown gate

    const input = t === 0
      ? { move: { x: 0, y: 0 }, selectedWeapon: weaponIndex, attack: true }
      : { ...NO_INPUT, selectedWeapon: weaponIndex };
    const out = stepMatch(state, TICK, input);
    for (const e of out) events.push({ at: t, ...e });
    if (t === 0) {
      firstTick.push(...out);
      const f = out.find((e) => e.type === 'weapon-fired');
      if (f) firedAt = t;
      // Velocities have to be read on the tick the volley spawns; `stepProjectiles`
      // re-aims a homing shot on every later tick and the fan would read as 0.
      for (const p of state.projectiles) firstTick.push({ type: '__vel', vx: p.vx, vy: p.vy, damage: p.damage });
    }
  }
  return { state, events, firstTick, firedAt, me, foe };
}

/** Total angular span, in degrees, of the projectiles spawned by one press. */
function fanDeg(firstTick) {
  const vs = firstTick.filter((e) => e.type === '__vel');
  if (vs.length < 2) return 0;
  const angs = vs.map((v) => Math.atan2(v.vy, v.vx) * 180 / Math.PI);
  return +(Math.max(...angs) - Math.min(...angs)).toFixed(4);
}

/**
 * Measure one weapon. Two separations are used deliberately: melee is measured at
 * 60% of its reach (inside the cone and inside the range, so a miss means the cone,
 * not the distance) and ranged at 40 wu, well inside every rung on the ladder.
 */
function measure(charId, weaponIndex) {
  const w = CHARACTERS[charId].weapons[weaponIndex];
  const sep = w.type === 'melee' ? Math.max(4, Math.round((w.range ?? 70) * 0.6)) : 40;
  const r = fireOnce(charId, weaponIndex, { sep });

  const spawned = r.events.filter((e) => e.type === 'projectile-spawned' && e.weaponKey === w.key);
  const hits = r.events.filter((e) => e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === w.key);
  const fired = r.events.filter((e) => e.type === 'weapon-fired' && e.weaponKey === w.key);

  // ── STATUS: measured on an UNPINNED target, because the pinning above wipes the
  // very timers this column reads. A second, separate run.
  const r2 = fireOnce(charId, weaponIndex, { sep, windowMs: 3000, pinHp: true });
  let statusSeen = null;
  {
    const arena = makeArena();
    const state = createMatch(arena, charId, 'donut');
    state.phase = 'playing';
    const [me, foe] = [state.fighters[0], state.fighters[1]];
    const cx = arena.center.x, cy = arena.center.y;
    me.x = cx; me.y = cy; me.facing = { x: 1, y: 0 };
    let slowMs = 0, stunMs = 0, gotHit = false;
    for (let t = 0; t < 3000; t += TICK) {
      foe.x = cx + sep; foe.y = cy; foe.hp = foe.maxHp; foe.alive = true;
      foe.lastUsed = foe.lastUsed.map(() => Infinity);
      const input = t === 0
        ? { move: { x: 0, y: 0 }, selectedWeapon: weaponIndex, attack: true }
        : { ...NO_INPUT, selectedWeapon: weaponIndex };
      const out = stepMatch(state, TICK, input);
      if (out.some((e) => e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === w.key)) {
        gotHit = true;
        slowMs = Math.max(slowMs, foe.status.slowedUntil - state.elapsed);
        stunMs = Math.max(stunMs, foe.status.stunnedUntil - state.elapsed);
      }
    }
    statusSeen = { gotHit, slowMs: Math.max(0, Math.round(slowMs)), stunMs: Math.max(0, Math.round(stunMs)) };
  }

  const totalDamage = +hits.reduce((s, h) => s + h.amount, 0).toFixed(4);
  const windupMs = hits.length && r.firedAt !== null
    ? r.events.find((e) => e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === w.key).at - r.firedAt
    : null;

  return {
    char: charId, key: w.key, name: w.name, type: w.type,
    authored: {
      range: w.range ?? null, damage: w.damage, cooldown: w.cooldown, cone: w.cone ?? null,
      speed: w.speed ?? null, effect: w.effect, pellets: w.pellets ?? null, spreadDeg: w.spreadDeg ?? null,
      flags: ['splatter', 'homing', 'trailBoosted', 'giantSlam', 'comboParts', 'peckHits', 'healAmount']
        .filter((f) => w[f] !== undefined && w[f] !== false),
    },
    measured: {
      pressesFired: fired.length,
      projectilesPerPress: spawned.length,
      fanDeg: fanDeg(r.firstTick),
      hitsLanded: hits.length,
      totalDamagePerPress: totalDamage,
      windupMs,
      slowAppliedMs: statusSeen.slowMs,
      stunAppliedMs: statusSeen.stunMs,
      splatsCreated: r.events.filter((e) => e.type === 'splat-created').length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-BAD VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
//
// Every arm below MUTATES a real weapon record so the correct answer is known, and
// requires the instrument to MOVE. `CLAUDE.md` rule 6: a guard not shown to fail on
// the bug it guards is not a guard — and an arm that asserts over a filtered set must
// assert the set is non-empty FIRST, or `[].every()` waves it through.
function selftest() {
  const rows = [];
  const ok = (name, pass, detail) => { rows.push({ name, pass, detail }); };

  // Control: the baseline must be non-vacuous before any known-bad means anything.
  const base = measure('waterbottle', 0); // Spray: 3 pellets, spreadDeg 30
  ok('CONTROL non-vacuous', base.measured.projectilesPerPress > 0 && base.measured.hitsLanded > 0,
    `${base.measured.projectilesPerPress} projectiles, ${base.measured.hitsLanded} hits, ${base.measured.totalDamagePerPress} dmg`);

  const w = CHARACTERS.waterbottle.weapons[0];
  const save = { pellets: w.pellets, spreadDeg: w.spreadDeg, effect: w.effect, damage: w.damage };

  // KNOWN-BAD 1 — drop the pellets. PRESS must fall to 1.
  w.pellets = undefined;
  const kb1 = measure('waterbottle', 0);
  ok('KNOWN-BAD pellets:=undefined -> PRESS falls to 1',
    base.measured.projectilesPerPress === 3 && kb1.measured.projectilesPerPress === 1,
    `${base.measured.projectilesPerPress} -> ${kb1.measured.projectilesPerPress}`);
  w.pellets = save.pellets;

  // KNOWN-BAD 2 — zero the spread. FAN must collapse to 0 while PRESS holds.
  w.spreadDeg = 0;
  const kb2 = measure('waterbottle', 0);
  ok('KNOWN-BAD spreadDeg:=0 -> FAN collapses, PRESS holds',
    base.measured.fanDeg > 0 && kb2.measured.fanDeg === 0 && kb2.measured.projectilesPerPress === 3,
    `fan ${base.measured.fanDeg}deg -> ${kb2.measured.fanDeg}deg, press ${kb2.measured.projectilesPerPress}`);
  w.spreadDeg = save.spreadDeg;

  // KNOWN-BAD 3 — swap the effect. The STATUS column must follow it, both ways.
  w.effect = 'stun';
  const kb3 = measure('waterbottle', 0);
  ok('KNOWN-BAD effect slow:=stun -> STATUS follows',
    base.measured.slowAppliedMs > 0 && base.measured.stunAppliedMs === 0
    && kb3.measured.stunAppliedMs > 0 && kb3.measured.slowAppliedMs === 0,
    `slow ${base.measured.slowAppliedMs}/${kb3.measured.slowAppliedMs}ms, stun ${base.measured.stunAppliedMs}/${kb3.measured.stunAppliedMs}ms`);
  w.effect = save.effect;

  // KNOWN-BAD 4 — halve the damage. The DAMAGE column must halve, not stay authored.
  w.damage = save.damage * 2;
  const kb4 = measure('waterbottle', 0);
  ok('KNOWN-BAD damage x2 -> DAMAGE column doubles',
    base.measured.totalDamagePerPress > 0
    && Math.abs(kb4.measured.totalDamagePerPress - base.measured.totalDamagePerPress * 2) < 1e-6,
    `${base.measured.totalDamagePerPress} -> ${kb4.measured.totalDamagePerPress}`);
  w.damage = save.damage;

  // KNOWN-BAD 5 — the melee arm. Turn the cone away from the target: hits must go to 0.
  const m = CHARACTERS.waterbottle.weapons[3];
  const baseM = measure('waterbottle', 3);
  const saveCone = m.cone;
  m.cone = 1;
  const kb5 = measure('waterbottle', 3);
  ok('KNOWN-BAD melee cone:=1 -> HITS survive (target is dead ahead)',
    baseM.measured.hitsLanded === 1 && kb5.measured.hitsLanded === 1,
    `${baseM.measured.hitsLanded} -> ${kb5.measured.hitsLanded} (a cone check on an axis-aligned target cannot reject; see below)`);
  m.cone = saveCone;

  // KNOWN-BAD 5b — the arm that CAN express a melee miss: put the target behind.
  const behind = (() => {
    const arena = makeArena();
    const state = createMatch(arena, 'waterbottle', 'donut');
    state.phase = 'playing';
    const [me, foe] = [state.fighters[0], state.fighters[1]];
    const cx = arena.center.x, cy = arena.center.y;
    me.x = cx; me.y = cy; me.facing = { x: -1, y: 0 }; // facing AWAY
    let hits = 0;
    for (let t = 0; t < 500; t += TICK) {
      foe.x = cx + 50; foe.y = cy; foe.hp = foe.maxHp; foe.alive = true;
      foe.lastUsed = foe.lastUsed.map(() => Infinity);
      me.facing = { x: -1, y: 0 };
      const input = t === 0 ? { move: { x: 0, y: 0 }, selectedWeapon: 3, attack: true } : { ...NO_INPUT, selectedWeapon: 3 };
      for (const e of stepMatch(state, TICK, input)) {
        if (e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === 'Mega') hits++;
      }
    }
    return hits;
  })();
  ok('KNOWN-BAD melee facing reversed -> HITS falls to 0',
    baseM.measured.hitsLanded === 1 && behind === 0, `1 -> ${behind}`);

  const failed = rows.filter((r) => !r.pass);
  for (const r of rows) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
  console.log(`\n  ${rows.length - failed.length}/${rows.length} arms pass`);
  return failed.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  if (has('--selftest')) {
    console.log('WTZ_KIT --selftest\n');
    process.exitCode = selftest() ? 0 : 1;
    return;
  }

  const ids = has('--all') ? [...CHARACTER_IDS] : SHARD;
  const out = [];
  console.log('WTZ_KIT — measured on the real sim, dt=16ms, target pinned\n');
  console.log(`  status constants: SLOW ${SLOW_DURATION_MS}ms x${SLOW_MOVE_MULTIPLIER} move (+${SLOW_GRACE_MS}ms grace)`
    + ` · STUN ${STUN_DURATION_MS}ms movement-locked (+${STUN_GRACE_MS}ms grace)\n`);

  for (const id of ids) {
    const def = CHARACTERS[id];
    console.log(`\n${'='.repeat(78)}\n${def.name} (${id}) — ${def.rarity}\n${'='.repeat(78)}`);
    def.weapons.forEach((w, i) => {
      const r = measure(id, i);
      out.push(r);
      const a = r.authored, m = r.measured;
      const blurb = def.abilities[i];
      console.log(`\n  [${i}] ${w.key} "${w.name}"  (${w.type})`);
      console.log(`      desc:     "${blurb ? blurb.desc : '(none)'}"`);
      console.log(`      authored: range ${a.range} · dmg ${a.damage} · cd ${a.cooldown}ms · cone ${a.cone}`
        + ` · speed ${a.speed} · effect ${a.effect} · pellets ${a.pellets} · spreadDeg ${a.spreadDeg}`
        + (a.flags.length ? ` · flags [${a.flags.join(', ')}]` : ' · flags []'));
      console.log(`      MEASURED: projectiles/press ${m.projectilesPerPress} · fan ${m.fanDeg}deg`
        + ` · hits ${m.hitsLanded} · damage/press ${m.totalDamagePerPress}`
        + ` · windup ${m.windupMs === null ? 'n/a' : m.windupMs + 'ms'}`
        + ` · slow ${m.slowAppliedMs}ms · stun ${m.stunAppliedMs}ms · splats ${m.splatsCreated}`);
    });
  }

  const jf = val('--json');
  if (jf) {
    // eslint-disable-next-line no-undef
    require('node:fs').writeFileSync(jf, JSON.stringify(out, null, 2));
  }
  console.log('');
}

main();
