#!/usr/bin/env node
/**
 * UB_THREAT — is `ai.ts:castThreat` a correct BOUND on what an open cast can actually hit?
 *
 * `castThreat` is the AI's model of the threatened set of a wind-up: a disc for melee, a
 * disc of `range + hitRadius` for a HOMING volley, and a WEDGE for a non-homing fan. A
 * model is worth nothing until it has been checked against the thing it models, and the
 * thing it models is `combat.ts:deliverWeapon` + `sim.ts:stepProjectiles`, not another
 * copy of the arithmetic.
 *
 * ── WHAT IS MEASURED ────────────────────────────────────────────────────────
 *
 * For each candidate weapon, over a grid of (separation `d`, bearing `β` off the caster's
 * frozen facing): fire the weapon for real, with the target STATIONARY, and record whether
 * that target took any damage from it. A stationary target is the MAXIMAL hit set — every
 * shape in the roster closes on its target, so moving can only ever shrink it — which is
 * exactly the set a conservative bound has to contain.
 *
 * Three verdicts per weapon, and the first two are opposite failures:
 *
 *   CONTAIN     every cell the sim HIT must have model margin < 0.  A violation is the
 *               dangerous direction: the AI would call a fighter safe and let it eat the
 *               shot. Must be 0.
 *   TIGHT       the largest model margin over hit cells, and the worst over-reach: how far
 *               outside the real hit set the model's boundary sits. Reported, not asserted
 *               — over-approximating is legal, and the number says how much it costs.
 *   NON-VACUOUS the hit set must be non-empty. "Nothing was hit" is also what a broken
 *               fixture produces, and it would satisfy CONTAIN perfectly.
 *
 * ── AND THE RIVAL MODEL IS SCORED BESIDE IT ────────────────────────────────
 *
 * `DECISIONS §77` claims the fix needs per-shape geometry rather than one disc law. That
 * is a falsifiable claim, so the DISC law (`range + hitRadius`, no bearing) is evaluated
 * on the same grid and its over-reach printed next to the shipped model's. If a single
 * disc were as good, this table would say so.
 *
 *   node tools/tmp/ub_threat.mjs --selftest
 *   node tools/tmp/ub_threat.mjs
 *   node tools/tmp/ub_threat.mjs --sim /tmp/fa-ub-head/src/game     # another tree
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { attemptAttack } from '../../src/game/combat.ts';
import { CHARACTERS } from '../../src/game/rules.ts';
import { castThreat } from '../../src/game/ai.ts';

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

const TICK = 16.667;
const DEG2RAD = Math.PI / 180;
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : String(n));

/** A big empty arena with the ring wide open — `u5_derive`'s fixture, same numbers. */
const arena = () => ({
  id: 'ub', displayName: 'ub', width: 8000, height: 8000,
  center: { x: 4000, y: 4000 }, maxSafeRadius: 7000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 400, y: 400 },
  cover: [], hazards: [], build: () => ({}),
});

/**
 * ONE SHOT, FOR REAL. `casterId` fires `weaponKey` with its `castMs` forced to 0, from
 * (4000,4000) facing +x; `targetId` stands at bearing `betaDeg`, `d` away, and does not
 * move. Returns { dealt, margin } — the damage that weapon put on the target, and what
 * `castThreat` said about that position at the instant of the press.
 *
 * ⚠️ THE CASTER IS SILENCED AFTER THE PRESS. It is slot 1, so `stepAI` drives it, and its
 * other weapons would otherwise fire during the flight — Burrito's Roll STUNS, which would
 * freeze a moving target and quietly turn a geometry measurement into a status measurement.
 * `lastUsed[i] = 1e9` makes `now - lastUsed[i]` hugely negative, so every cooldown gate in
 * `attemptAttack` refuses. Damage is ALSO filtered by `weaponKey`, so the two guards are
 * independent.
 */
function trial({ casterId, targetId, weaponKey, d, betaDeg }) {
  const weapons = CHARACTERS[casterId].weapons;
  const wi = weapons.findIndex((w) => w.key === weaponKey);
  if (wi < 0) throw new Error(`no ${casterId}.${weaponKey}`);
  const w = weapons[wi];
  const prev = w.castMs;
  w.castMs = 0;
  try {
    const state = createMatch(arena(), targetId, casterId);
    state.phase = 'playing';
    const cx = 4000; const cy = 4000;
    state.enemy.x = cx; state.enemy.y = cy;
    state.enemy.facing = { x: 1, y: 0 };
    const r = betaDeg * DEG2RAD;
    state.player.x = cx + d * Math.cos(r);
    state.player.y = cy + d * Math.sin(r);
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;

    const threat = castThreat(state.enemy, w, state.player.x, state.player.y, state.player.hitRadius);

    const evs = [];
    attemptAttack(state, state.enemy, wi, evs);
    for (let i = 0; i < state.enemy.lastUsed.length; i++) state.enemy.lastUsed[i] = 1e9;

    let dealt = 0;
    const collect = (list) => {
      for (const e of list) {
        if (e.type === 'hit-landed' && e.source?.kind === 'weapon'
          && e.source.weaponKey === weaponKey && e.source.attackerId === state.enemy.id) dealt += e.amount;
      }
    };
    collect(evs);
    const still = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    for (let t = 0; t < 12000; t += TICK) {
      collect(stepMatch(state, TICK, still));
      const live = state.projectiles.some((p) => p.weapon.key === weaponKey && p.ownerId === state.enemy.id);
      if (!live && t > 4 * TICK) break;
    }
    return { dealt, margin: threat === null ? Infinity : threat.margin };
  } finally {
    if (prev === undefined) delete w.castMs; else w.castMs = prev;
  }
}

/** The rival single-law model §77 says is not enough: a disc of `range + hitRadius`. */
function discMargin(w, d, hitRadius) {
  return d - ((w.range ?? 0) + hitRadius);
}

/** Every weapon in the roster that a wind-up could plausibly be hung on, plus the shipped one. */
const CANDIDATES = [
  { casterId: 'waterbottle', weaponKey: 'Mega' },   // melee disc — the SHIPPED cast, the control
  { casterId: 'taco', weaponKey: 'Double' },        // ranged, non-homing ±10° combo fan
  { casterId: 'burrito', weaponKey: 'Swarm' },      // ranged, homing, 4 pellets, 55° spread
  { casterId: 'sushi', weaponKey: 'Catch' },        // ranged, homing, 3 pellets, 40° spread
];

const BEARINGS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 135, 180];
const SEPS = (() => { const a = []; for (let d = 5; d <= 210; d += 5) a.push(d); return a; })();

function sweep(casterId, weaponKey, targetId) {
  const w = CHARACTERS[casterId].weapons.find((x) => x.key === weaponKey);
  const rows = [];
  for (const b of BEARINGS) {
    for (const d of SEPS) {
      const { dealt, margin } = trial({ casterId, targetId, weaponKey, d, betaDeg: b });
      rows.push({ b, d, hit: dealt > 0, margin });
    }
  }
  return { w, rows };
}

function report(casterId, weaponKey, targetId) {
  const { w, rows } = sweep(casterId, weaponKey, targetId);
  const hits = rows.filter((r) => r.hit);
  const hitRadius = 25.2; // HIT_RADIUS_VS_PLAYER — slot 0 is the human seat
  const violations = hits.filter((r) => !(r.margin < 0));
  // Worst over-reach: the deepest cell the MODEL calls threatened that the sim missed,
  // measured per bearing as (model boundary d) - (last hit d).
  let overReach = 0; let overAt = '';
  let discOver = 0; let discAt = '';
  for (const b of BEARINGS) {
    const line = rows.filter((r) => r.b === b);
    const lastHit = Math.max(-Infinity, ...line.filter((r) => r.hit).map((r) => r.d));
    const modelEdge = Math.max(-Infinity, ...line.filter((r) => r.margin < 0).map((r) => r.d));
    const discEdge = Math.max(-Infinity, ...line.filter((r) => discMargin(w, r.d, hitRadius) < 0).map((r) => r.d));
    const lh = Number.isFinite(lastHit) ? lastHit : 0;
    const me = Number.isFinite(modelEdge) ? modelEdge : 0;
    const de = Number.isFinite(discEdge) ? discEdge : 0;
    if (me - lh > overReach) { overReach = me - lh; overAt = `β=${b}°`; }
    if (de - lh > discOver) { discOver = de - lh; discAt = `β=${b}°`; }
  }
  console.log(`\n   ${casterId}.${weaponKey}  ${w.type}${w.homing ? ' homing' : ''}  range ${w.range}  vs ${targetId}`);
  console.log(`     cells                 ${rows.length}   (${BEARINGS.length} bearings x ${SEPS.length} separations)`);
  console.log(`     NON-VACUOUS  hits     ${hits.length}   <-- must be > 0`);
  console.log(`     CONTAIN      leaks    ${violations.length}   <-- must be 0 (sim hit, model said safe)`);
  if (violations.length) {
    for (const v of violations.slice(0, 6)) console.log(`       β=${v.b}° d=${v.d}  margin ${f2(v.margin)}`);
  }
  console.log(`     TIGHT        shipped model over-reach  ${f2(overReach)} wu ${overAt}`);
  console.log(`                  DISC-ONLY law over-reach  ${f2(discOver)} wu ${discAt}`);
  // Per-bearing edge table — the shape, made visible.
  const line = (label, pick) => `     ${label.padEnd(14)}` + BEARINGS.map((b) => {
    const l = rows.filter((r) => r.b === b);
    const m = Math.max(-Infinity, ...l.filter(pick).map((r) => r.d));
    return String(Number.isFinite(m) ? m : '-').padStart(5);
  }).join('');
  console.log(`     ${'bearing'.padEnd(14)}` + BEARINGS.map((b) => `${b}°`.padStart(5)).join(''));
  console.log(line('SIM last hit', (r) => r.hit));
  console.log(line('model edge', (r) => r.margin < 0));
  console.log(line('disc edge', (r) => discMargin(w, r.d, hitRadius) < 0));
  return { violations: violations.length, hits: hits.length, overReach, discOver };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — an instrument that cannot report a fault is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log('\n══ ub_threat SELFTEST ══');

  // 1. THE FIXTURE LANDS. Every "no leak" verdict below is vacuous if nothing ever hits.
  const near = trial({ casterId: 'taco', targetId: 'pizza', weaponKey: 'Double', d: 30, betaDeg: 0 });
  ok('CONTROL: a point-blank on-axis Double Toss lands', near.dealt > 0, `dealt ${near.dealt}`);
  const far = trial({ casterId: 'taco', targetId: 'pizza', weaponKey: 'Double', d: 400, betaDeg: 0 });
  ok('…and one fired at 400 wu does NOT — the fixture can report both outcomes', far.dealt === 0, `dealt ${far.dealt}`);
  const behind = trial({ casterId: 'taco', targetId: 'pizza', weaponKey: 'Double', d: 30, betaDeg: 180 });
  ok('…and one fired 180° away from the target does NOT', behind.dealt === 0, `dealt ${behind.dealt}`);

  // 2. THE CASTER IS ACTUALLY SILENCED. Burrito's OTHER weapons must contribute nothing —
  //    without the `lastUsed` gag a `Roll` stun would land during the flight and this
  //    tool would be measuring a status effect.
  const swarm = trial({ casterId: 'burrito', targetId: 'pizza', weaponKey: 'Swarm', d: 60, betaDeg: 0 });
  ok('CONTROL: a homing Swarm at 60 wu lands', swarm.dealt > 0, `dealt ${swarm.dealt}`);

  // 3. A KNOWN-BAD MODEL MUST BE CAUGHT. Score the DISC law on the one weapon whose
  //    threatened set is not a disc, in the direction the sweep can see: the disc law
  //    calls a target at β=90° threatened, and the sim cannot touch it.
  const w = CHARACTERS.taco.weapons.find((x) => x.key === 'Double');
  const side = trial({ casterId: 'taco', targetId: 'pizza', weaponKey: 'Double', d: 60, betaDeg: 90 });
  ok('KNOWN-BAD: the DISC law calls a 90°-off target threatened…',
    discMargin(w, 60, 25.2) < 0, `disc margin ${f2(discMargin(w, 60, 25.2))}`);
  ok('…the sim cannot touch it…', side.dealt === 0, `dealt ${side.dealt}`);
  ok('…and the shipped wedge model agrees with the sim', side.margin >= 0, `margin ${f2(side.margin)}`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

/**
 * ── HOW FAR SIDEWAYS, AND HOW LONG — THE OTHER ESCAPE `u5_derive` NEVER SWEEPS ────
 *
 * `tools/tmp/u5_derive.mjs` measures the escape window by running the target STRAIGHT AWAY
 * from the caster, which is the only motion it tries, and `rules.ts:Weapon.castMs` derives
 * every parenthesised wind-up from that one number. For a melee disc and a homing volley
 * that is the whole answer — there is nowhere else to go. For a NON-HOMING FAN it is not:
 * the beam is frozen, so a step ACROSS it leaves the threatened set, and the two costs are
 * not close. This bisects the smallest lateral step that takes zero damage, in the sim.
 */
function lateralEscape(casterId, weaponKey, sep, targetId) {
  const hit = (dy) => {
    const d = Math.hypot(sep, dy);
    const b = (Math.atan2(dy, sep) * 180) / Math.PI;
    return trial({ casterId, targetId, weaponKey, d, betaDeg: b }).dealt > 0;
  };
  if (!hit(0)) return null;             // nothing to escape — the cell is vacuous
  let lo = 0; let hi = 5;
  while (hit(hi) && hi < 2000) hi *= 2;
  if (hi >= 2000) return Infinity;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hit(m)) lo = m; else hi = m; }
  return hi;
}

if (import.meta.main && args.lateral) {
  const targetId = String(args.target ?? 'egg');   // the SLOWEST human, 105.60 wu/s
  const speed = 105.6;
  console.log(`\n══ UB_THREAT --lateral ══  the SIDEWAYS escape, target ${targetId} at ${speed} wu/s`);
  console.log(`   ${'weapon'.padEnd(22)}${'sep'.padStart(6)}${'sideways wu'.padStart(14)}${'ms'.padStart(9)}${'model wu'.padStart(11)}`);
  for (const c of CANDIDATES) {
    const w = CHARACTERS[c.casterId].weapons.find((x) => x.key === c.weaponKey);
    for (const sep of [20, 60, 100]) {
      const wu = lateralEscape(c.casterId, c.weaponKey, sep, targetId);
      const t = castThreat({ x: 0, y: 0, facing: { x: 1, y: 0 } }, w, sep, 0, 25.2);
      const model = t === null ? NaN : -t.margin;
      console.log(`   ${`${c.casterId}.${c.weaponKey}`.padEnd(22)}${String(sep).padStart(6)}`
        + `${(wu === null ? 'no hit' : f2(wu)).padStart(14)}${(wu === null || !Number.isFinite(wu) ? '—' : f2((wu / speed) * 1000)).padStart(9)}`
        + `${f2(model).padStart(11)}`);
    }
  }
  process.exit(0);
}

if (import.meta.main) {
  const targetId = String(args.target ?? 'pizza');
  console.log(`\n══ UB_THREAT ══  target ${targetId}  ·  stationary, castMs forced to 0`);
  let leaks = 0; let empty = 0;
  for (const c of CANDIDATES) {
    const r = report(c.casterId, c.weaponKey, targetId);
    leaks += r.violations;
    if (r.hits === 0) empty++;
  }
  console.log(`\n   >> ${leaks === 0 && empty === 0
    ? 'PASS — the model contains the real hit set on every weapon, and every hit set is non-empty.'
    : `FAIL — ${leaks} containment leak(s), ${empty} empty hit set(s).`}\n`);
  process.exit(leaks === 0 && empty === 0 ? 0 : 1);
}
