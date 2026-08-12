#!/usr/bin/env node
/**
 * U5_DERIVE — the escape window for a wind-up, MEASURED in the real sim, per weapon.
 *
 * `rules.ts:Weapon.castMs`'s own derivation is a closed form and it is only valid for
 * MELEE: *"a melee cast resolves on `range` alone from a caster who cannot move, so from
 * separation 0 the target must gain `range` wu"*. Four of the five remaining specials are
 * not that shape — three are RANGED (where `range` is a path budget, not an area) and one
 * is a 400 wu `giantSlam`. `tools/tmp/csx_derive.mjs` prints `R / speed` for every entry in
 * `REACH`, which is exactly the melee closed form and nothing else; it has no projectile
 * speed, no `hitRadius`, no homing and no fan, so it is structurally incapable of the
 * ranged question. It is also owned by another pass, so it is read, not edited.
 *
 * ── WHAT THIS MEASURES, AND WHY IT IS A MEASUREMENT AND NOT ARITHMETIC ──────
 *
 * For each candidate weapon it binary-searches the SMALLEST `castMs` at which a target
 * that runs takes ZERO damage from that weapon, driving the real `stepMatch` with real
 * `MatchInput` through the real `moveFighter`:
 *
 *   * the caster opens the cast at separation 0 and is rooted with its aim frozen,
 *   * the target runs straight away at its own `speedFor(id, PLAYER_SPEED)`,
 *   * every projectile the weapon spawned is flown to expiry before the verdict.
 *
 * The answer therefore includes the fan, the homing, the `traveled` budget's target-frame
 * accounting (AUTHORISED DEVIATION #12), `projectileMaxAgeMs` and the hit radius, none of
 * which the melee closed form contains. The closed form is printed BESIDE it as a
 * prediction, so a disagreement is visible rather than assumed away.
 *
 * ⚠️ THE CONTROL IS THE WHOLE INSTRUMENT. "The target took no damage" is also what a
 * broken fixture produces at every duration — wrong weapon index, target out of range,
 * caster facing the wrong way. So every cell first runs `castMs: 0` in the IDENTICAL
 * fixture and REQUIRES a hit; a cell whose control does not land is reported as
 * NO-CONTROL and its boundary is not printed. `[].every()` is `true` and so is
 * "nothing ever landed".
 *
 * ⚠️ RESOLUTION: the search is exact to 1 ms but the sim ticks at 16.667 ms, so no
 * boundary here resolves finer than ONE TICK. Two boundaries inside 16.667 ms of each
 * other are the same boundary.
 *
 *   node tools/tmp/u5_derive.mjs --selftest    # known-bad battery, see SELFTEST below
 *   node tools/tmp/u5_derive.mjs
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { attemptAttack } from '../../src/game/combat.ts';
import {
  CHARACTERS, CHARACTER_IDS, REACH, PLAYER_SPEED, HIT_RADIUS_VS_PLAYER,
  speedFor, projectileMaxAgeMs, FLEE_REFERENCE_SPEED,
} from '../../src/game/rules.ts';

const TICK = 16.667;
const f2 = (n) => n.toFixed(2);

/**
 * 🚨 THE TRIAL CANNOT START AT SEPARATION 0, AND FINDING THAT OUT IS THE FIRST RESULT.
 *
 * `rules.ts` states the design number *"from separation 0"*, but at `dist === 0` a
 * DIRECTIONAL swing (`cone < 360`) is defined to MISS — `combat.ts:MELEE_COINCIDENT_EPS`,
 * *"two coincident fighters have no bearing between them"*. Mega, Dump and every cone
 * weapon therefore land NOTHING at `castMs: 0` from separation 0, so the control fails and
 * the boundary is unmeasurable. Measured: the first draft of this file reported
 * `NO-CONTROL` for the shipped weapon whose published number it exists to reproduce.
 *
 * So every trial opens at 20 wu — §33(c)'s own fixture separation, comfortably above the
 * epsilon and far inside every candidate's reach — and the sep-0 design figure is the
 * measured boundary plus `SEP0 / speed`. Both are printed; neither is inferred silently.
 */
const SEP0 = 20;

/** A big empty arena with the ring wide open — the §33 fixture, same numbers. */
const arena = () => ({
  id: 'u5', displayName: 'u5', width: 6000, height: 6000,
  center: { x: 3000, y: 3000 }, maxSafeRadius: 5000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 400, y: 400 },
  cover: [], hazards: [], build: () => ({}),
});

/**
 * Run ONE trial: `casterId` opens `weaponKey` at `castMs` from separation `sep0`; the
 * target (slot 0, i.e. the HUMAN seat and `HIT_RADIUS_VS_PLAYER`) runs straight away.
 * Returns the damage that weapon put on the target.
 *
 * The caster is slot 1 so `stepAI` drives it — which is the point: a rooted caster must
 * be rooted through the shipped mover, not through a fixture that never asked it to move.
 * Damage is filtered by `weaponKey`, so anything else the driver presses is excluded.
 */
function trial({ targetId, casterId, weaponKey, castMs, sep0 }) {
  const weapons = CHARACTERS[casterId].weapons;
  const wi = weapons.findIndex((w) => w.key === weaponKey);
  if (wi < 0) throw new Error(`no ${casterId}.${weaponKey}`);
  const w = weapons[wi];
  const prev = w.castMs;
  w.castMs = castMs;
  try {
    const state = createMatch(arena(), targetId, casterId);
    state.phase = 'playing';
    state.enemy.x = 3000; state.enemy.y = 3000;
    state.player.x = 3000 + sep0; state.player.y = 3000;
    state.enemy.facing = { x: 1, y: 0 };
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;

    const evs = [];
    const opened = attemptAttack(state, state.enemy, wi, evs);
    let dealt = 0;
    const collect = (list) => {
      for (const e of list) {
        if (e.type === 'hit-landed' && e.source?.kind === 'weapon'
          && e.source.weaponKey === weaponKey && e.source.attackerId === state.enemy.id) dealt += e.amount;
      }
    };
    collect(evs);

    const away = { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false };
    // Long enough for the wind-up AND for every projectile to expire: the slowest shot in
    // the roster is `projectileMaxAgeMs` = 3500 ms, and the search ceiling is 6000 ms.
    const budgetMs = castMs + 12000;
    for (let t = 0; t < budgetMs; t += TICK) {
      collect(stepMatch(state, TICK, away));
      const live = state.projectiles.some((p) => p.weapon.key === weaponKey && p.ownerId === state.enemy.id);
      if (state.enemy.cast === null && !live && t > castMs + 2 * TICK) break;
    }
    return { dealt, opened };
  } finally {
    if (prev === undefined) delete w.castMs; else w.castMs = prev;
  }
}

/**
 * The smallest `castMs` at which the runner takes nothing, or null when the control
 * failed. Bisects on a monotone-in-practice predicate; the returned bound is reported
 * with the tick floor, never finer.
 */
function escapeBoundary({ targetId, casterId, weaponKey, sep0 = SEP0, hi = 6000 }) {
  const control = trial({ targetId, casterId, weaponKey, castMs: 0, sep0 });
  if (control.dealt <= 0) return { control: control.dealt, boundary: null };
  const top = trial({ targetId, casterId, weaponKey, castMs: hi, sep0 });
  if (top.dealt > 0) return { control: control.dealt, boundary: Infinity };
  let lo = 0; let up = hi;
  while (up - lo > 1) {
    const mid = Math.floor((lo + up) / 2);
    if (trial({ targetId, casterId, weaponKey, castMs: mid, sep0 }).dealt > 0) lo = mid; else up = mid;
  }
  return { control: control.dealt, boundary: up };
}

// ── the roster's speed extremes, DERIVED (never the caps: 120/70 are nobody's speed) ──
const humans = CHARACTER_IDS.map((id) => ({ id, v: speedFor(id, PLAYER_SPEED) * 1000 }));
const FASTEST = humans.reduce((a, b) => (b.v > a.v ? b : a));
const SLOWEST = humans.reduce((a, b) => (b.v < a.v ? b : a));

const CANDIDATES = [
  ['waterbottle', 'Mega'],   // the SHIPPED control: its published band must reproduce
  ['soup', 'Dump'],
  ['taco', 'Double'],
  ['burrito', 'Swarm'],
  ['sushi', 'Catch'],
  ['lollipop', 'Giant'],
];

/** The melee closed form `rules.ts` publishes, and the ranged one this pass derives. */
function predict(w) {
  const R = w.range ?? 0;
  if (w.type === 'melee') return { note: 'melee: gain `range`', wu: R };
  // Under AUTHORISED DEVIATION #12 `traveled` is charged with ground GAINED on the target,
  // so a fleeing target does not shorten the shot: the budget is spent only by closing.
  // The shot connects iff it can close `sep − hitRadius` with a budget of `range`.
  return { note: 'ranged: gain `range` + hitRadius', wu: R + HIT_RADIUS_VS_PLAYER };
}

if (process.argv.includes('--selftest')) {
  // ── SELFTEST: four known-bads, each aimed at a different way this could lie ──
  let pass = 0; let fail = 0;
  const t = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name} ${detail}`); } };

  // 1. THE CONTROL FIRES. Point the fixture at a separation no melee weapon reaches and
  //    the control must FAIL — this is the row that proves a null result is not free.
  const far = escapeBoundary({ targetId: SLOWEST.id, casterId: 'waterbottle', weaponKey: 'Mega', sep0: 3000 });
  t('KNOWN-BAD: out of range → control does not land → no boundary reported', far.boundary === null, JSON.stringify(far));

  // 2. THE SHIPPED WEAPON REPRODUCES ITS PUBLISHED BAND. `rules.ts` says the slowest human
  //    first escapes Mega at 795.45 ms. Measured must agree to within one tick.
  const mega = escapeBoundary({ targetId: SLOWEST.id, casterId: 'waterbottle', weaponKey: 'Mega' });
  const sep0Equiv = mega.boundary === null ? null : mega.boundary + (SEP0 / SLOWEST.v) * 1000;
  const want = (REACH.meleeHeavy / SLOWEST.v) * 1000;
  t(`the published 795.45 ms boundary reproduces (measured@0 ${sep0Equiv === null ? 'null' : f2(sep0Equiv)}, closed form ${f2(want)})`,
    sep0Equiv !== null && Math.abs(sep0Equiv - want) <= TICK + 1, JSON.stringify(mega));

  // 3. A FASTER RUNNER ESCAPES SOONER. If the search were reading anything but the target's
  //    own legs, the two extremes would come out equal.
  const megaFast = escapeBoundary({ targetId: FASTEST.id, casterId: 'waterbottle', weaponKey: 'Mega' });
  t(`a faster target escapes strictly sooner (${megaFast.boundary} < ${mega.boundary})`,
    megaFast.boundary !== null && megaFast.boundary < mega.boundary - TICK, `${megaFast.boundary} vs ${mega.boundary}`);

  // 4. THE MUTATION IS UNDONE. Every trial writes `castMs` on the shared roster object;
  //    §33's own history is a row that repaired the roster mid-suite and stayed green.
  t('the roster is left exactly as found', CHARACTERS.waterbottle.weapons.find((w) => w.key === 'Mega').castMs === 1100
    && CHARACTERS.soup.weapons.find((w) => w.key === 'Dump').castMs === undefined,
    `Mega ${CHARACTERS.waterbottle.weapons.find((w) => w.key === 'Mega').castMs}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

console.log(`fastest human ${FASTEST.id} ${f2(FASTEST.v)} wu/s · slowest human ${SLOWEST.id} ${f2(SLOWEST.v)} wu/s`);
console.log(`HIT_RADIUS_VS_PLAYER ${HIT_RADIUS_VS_PLAYER} · FLEE_REFERENCE_SPEED ${FLEE_REFERENCE_SPEED}\n`);
console.log(`every trial opens at SEP0 = ${SEP0} wu; "@0" adds SEP0/speed to reach the design frame\n`);
console.log('weapon               type   range dmg/press    cd |  predict wu  pred@0 fast/slow |  MEASURED@20 fast/slow |  MEASURED@0 fast/slow');
for (const [id, key] of CANDIDATES) {
  const w = CHARACTERS[id].weapons.find((x) => x.key === key);
  const p = predict(w);
  const perPress = w.comboParts
    ? w.comboParts.reduce((s, c) => s + c.damage, 0)
    : w.damage * (w.peckHits ?? 1) * (w.pellets ?? 1);
  const fast = escapeBoundary({ targetId: FASTEST.id, casterId: id, weaponKey: key });
  const slow = escapeBoundary({ targetId: SLOWEST.id, casterId: id, weaponKey: key });
  const show = (r) => (r.boundary === null ? 'NO-CONTROL' : r.boundary === Infinity ? '>6000' : String(r.boundary));
  const at0 = (r, v) => (typeof r.boundary !== 'number' || !Number.isFinite(r.boundary) ? show(r) : f2(r.boundary + (SEP0 / v) * 1000));
  const age = w.type === 'ranged' ? `  maxAge ${f2(projectileMaxAgeMs(w))}` : '';
  console.log(
    `${(id + '.' + key).padEnd(20)} ${(w.type).padEnd(6)}${String(w.range).padStart(5)}${String(perPress).padStart(10)}${String(w.cooldown).padStart(6)} | `
    + `${f2(p.wu).padStart(11)} ${f2((p.wu / FASTEST.v) * 1000).padStart(8)}/${f2((p.wu / SLOWEST.v) * 1000).padStart(8)} | `
    + `${show(fast).padStart(11)}/${show(slow).padStart(9)} | `
    + `${at0(fast, FASTEST.v).padStart(10)}/${at0(slow, SLOWEST.v).padStart(9)}${age}`,
  );
}
