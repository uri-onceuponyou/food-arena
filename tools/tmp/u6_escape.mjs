#!/usr/bin/env node
/**
 * U6_ESCAPE — the escape window for a wind-up, MEASURED **in the direction the target
 * would actually run**, per weapon, per separation.
 *
 * ── WHY THIS EXISTS AND `u5_derive.mjs` DOES NOT ANSWER IT ──────────────────
 *
 * `u5_derive` sweeps `castMs` with the target running **straight away from the caster**,
 * and every parenthesised `castMs` in `rules.ts:Weapon.castMs` is derived from it. For a
 * MELEE disc that is the whole answer — the threatened set is radially symmetric, so
 * every direction costs the same and "away" is as good as any.
 *
 * 🚨 **FOR A NON-HOMING FAN, "AWAY" IS THE MOST EXPENSIVE DIRECTION THERE IS.** The
 * pellets fly frozen bearings and never turn (`ai.ts:castThreat`), so the threatened set
 * is a WEDGE, and the cheapest exit from a wedge is SIDEWAYS. Running down the beam is
 * racing the projectile; stepping across it is 25 wu.
 *
 * The rule `rules.ts` publishes says `escapeWindow` is *"how long the target must run,
 * from separation 0, before this weapon can no longer put damage on it"* — and **the
 * target picks the direction**. A one-bearing sweep answers a different question:
 * *"...before it can no longer put damage on it while it runs the one way that does not
 * work"*. That is not a floor on counterplay, it is a floor on bad counterplay, and it is
 * the difference between a 1150 ms wind-up and a 600 ms one on `taco.Double`.
 *
 * So this tool sweeps RUN BEARING as well as `castMs`, and reports the MINIMUM over
 * bearings — the cheapest way out — beside `u5_derive`'s radial number so the two are
 * never confused. `u5_derive` is not edited: its radial answer is still exactly right for
 * every melee weapon, it is another pass's published instrument, and its selftest is the
 * cross-check that this fixture reproduces it.
 *
 * ── THE SECOND HALF: "AND NOT ESCAPABLE BY NOTHING" ─────────────────────────
 *
 * A wind-up has two failure modes and only one of them is a long number. Every boundary
 * here is reported beside a STANDING control — the identical fixture with the target
 * given no move input at all — which must take damage. A `castMs` at which a target that
 * does nothing still escapes is a dead button, and it is invisible to an escape sweep,
 * which only ever asks whether running works.
 *
 * ── CONTROLS (the instrument is the controls) ───────────────────────────────
 *
 *   * every cell first runs `castMs: 0` in the identical fixture and REQUIRES a hit;
 *     a cell whose control does not land is NO-CONTROL and prints no boundary.
 *     "The target took no damage" is also what a broken fixture produces at every
 *     duration.
 *   * damage is filtered to the weapon under test AND to the FIRST cast that weapon
 *     opens: a long window can outlast a cooldown, and a second press landing inside the
 *     counting window would report a boundary that does not exist. The count window
 *     closes at `resolve + projectileMaxAgeMs + 2 ticks`, and `--verbose` prints the
 *     number of casts seen so a second one cannot hide.
 *   * the roster is restored on every path (`finally`), because every trial writes
 *     `castMs` on a process-wide singleton.
 *
 * ⚠️ RESOLUTION: the bisect is exact to 1 ms but the sim ticks at 16.667 ms, so no
 * boundary resolves finer than ONE TICK. Two boundaries inside 16.667 ms are one boundary.
 *
 *   node tools/tmp/u6_escape.mjs --selftest
 *   node tools/tmp/u6_escape.mjs                    # the six candidates at the design separations
 *   node tools/tmp/u6_escape.mjs --weapon taco.Double --seps 20,60,100,128 --verbose
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { attemptAttack } from '../../src/game/combat.ts';
import {
  CHARACTERS, CHARACTER_IDS, PLAYER_SPEED, HIT_RADIUS_VS_PLAYER,
  speedFor, projectileMaxAgeMs,
} from '../../src/game/rules.ts';

const TICK = 16.667;
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : String(n));

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

/**
 * 🚨 THE TRIAL CANNOT START AT SEPARATION 0 — `u5_derive`'s finding, reproduced here
 * because the fixture is the same one. At `dist === 0` a DIRECTIONAL swing is defined to
 * MISS (`combat.ts:MELEE_COINCIDENT_EPS`), so the control fails and nothing is
 * measurable. 20 wu is §33(c)'s own fixture separation.
 */
const SEP0 = 20;

const arena = () => ({
  id: 'u6', displayName: 'u6', width: 6000, height: 6000,
  center: { x: 3000, y: 3000 }, maxSafeRadius: 5000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 400, y: 400 },
  cover: [], hazards: [], build: () => ({}),
});

/**
 * ONE trial. The caster (slot 1, driven by `stepAI` through the shipped mover) opens
 * `weaponKey` at `castMs` with the target sitting `sep0` wu dead ahead of its frozen
 * facing; the target (slot 0, the HUMAN seat and `HIT_RADIUS_VS_PLAYER`) then runs on
 * bearing `runDeg`, measured off the caster→target axis: **0 = straight away, 90 =
 * sideways, 180 = straight into the caster.**
 *
 * Returns the damage that weapon's FIRST cast put on the target, and how many casts of it
 * were opened inside the counting window (which must be 1).
 */
function trial({ targetId, casterId, weaponKey, castMs, sep0 = SEP0, runDeg = 0, stand = false }) {
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

    let dealt = 0;
    let casts = 0;
    const collect = (list) => {
      for (const e of list) {
        if (e.type === 'cast-started' && e.weaponKey === weaponKey) casts++;
        if (e.type === 'hit-landed' && e.source?.kind === 'weapon'
          && e.source.weaponKey === weaponKey && e.source.attackerId === state.enemy.id) dealt += e.amount;
      }
    };
    const evs = [];
    attemptAttack(state, state.enemy, wi, evs);
    collect(evs);

    // The run bearing is measured off the caster→target axis, which the fixture puts on +x.
    const r = (runDeg * Math.PI) / 180;
    const move = stand ? { x: 0, y: 0 } : { x: Math.cos(r), y: Math.sin(r) };
    const input = { move, selectedWeapon: 0, attack: false };
    // The counting window closes once the FIRST cast has resolved and everything it
    // spawned is dead. A second press cannot contaminate a boundary it never enters.
    const closeAt = castMs + (w.type === 'ranged' ? projectileMaxAgeMs(w) : 0) + 3 * TICK;
    for (let t = 0; t < closeAt; t += TICK) {
      collect(stepMatch(state, TICK, input));
      const live = state.projectiles.some((p) => p.weapon.key === weaponKey && p.ownerId === state.enemy.id);
      if (state.enemy.cast === null && !live && t > castMs + 2 * TICK) break;
    }
    return { dealt, casts };
  } finally {
    if (prev === undefined) delete w.castMs; else w.castMs = prev;
  }
}

/**
 * The smallest `castMs` at which a target running `runDeg` takes ZERO from this weapon,
 * or `null` when the control failed, or `Infinity` when it never escapes inside `hi`.
 */
function boundaryOn({ targetId, casterId, weaponKey, sep0 = SEP0, runDeg = 0, hi = 8000 }) {
  const control = trial({ targetId, casterId, weaponKey, castMs: 0, sep0, runDeg });
  if (control.dealt <= 0) return { control: control.dealt, boundary: null };
  if (trial({ targetId, casterId, weaponKey, castMs: hi, sep0, runDeg }).dealt > 0) {
    return { control: control.dealt, boundary: Infinity };
  }
  let lo = 0; let up = hi;
  while (up - lo > 1) {
    const mid = Math.floor((lo + up) / 2);
    if (trial({ targetId, casterId, weaponKey, castMs: mid, sep0, runDeg }).dealt > 0) lo = mid; else up = mid;
  }
  return { control: control.dealt, boundary: up };
}

/** Bearings swept. Coarse enough to be cheap, fine enough that the wedge minimum is not straddled. */
const BEARINGS = (() => { const b = []; for (let d = 0; d < 360; d += 10) b.push(d); return b; })();

/**
 * The CHEAPEST escape: the minimum boundary over every run bearing, with the bearing that
 * achieved it. `radial` (bearing 0) is carried alongside because it is what `u5_derive`
 * publishes and the two must never be quoted as one number.
 */
function cheapestEscape({ targetId, casterId, weaponKey, sep0 = SEP0, hi = 8000 }) {
  let best = null; let bestDeg = null; let radial = null; let free = 0;
  for (const deg of BEARINGS) {
    const r = boundaryOn({ targetId, casterId, weaponKey, sep0, runDeg: deg, hi });
    if (deg === 0) radial = r.boundary;
    // ⚠️ A FAILED CONTROL ON ONE BEARING IS NOT A BROKEN FIXTURE, IT IS AN ESCAPE THAT IS
    // ALREADY FREE. `castMs: 0` and the target still takes nothing means running that way
    // beats the weapon with NO wind-up at all, so the escape window in that direction is
    // zero and the cheapest escape overall is zero. (Measured: `taco.Double`'s ±10° fan
    // drifts off a target fleeing from 100 wu, minimum separation 29.1 wu against a 25.2 wu
    // hit radius, so it misses a runner it never had a wind-up against.) A cell where
    // EVERY bearing is free is a weapon that threatens a mover at that separation not at
    // all, and it is printed as UNREACHABLE rather than as an escape of 0 ms.
    if (r.boundary === null) { free++; if (best === null || best > 0) { best = 0; bestDeg = deg; } continue; }
    if (best === null || r.boundary < best) { best = r.boundary; bestDeg = deg; }
  }
  if (free === BEARINGS.length) return { boundary: null, deg: null, radial, free };
  return { boundary: best, deg: bestDeg, radial, free };
}

/**
 * The quantity the derivation actually wants: **the worst separation for the target.**
 *
 * `escapeWindow` is *"how long the target must run before this weapon can no longer put
 * damage on it"* and it must hold wherever the caster presses, so it is the MAXIMUM over
 * separations of the MINIMUM over bearings. Taking one separation is how a fan came to be
 * priced at 1150 ms; taking one bearing is how a cone came to be priced at 1100.
 *
 * It is deliberately not monotone-assumed: measured, `sushi.Catch` is hardest to escape at
 * 60 wu (751 ms) and easier at both 20 (384) and 100 (601), because at 20 wu the dodge is
 * to run THROUGH the caster and homing pellets that overshoot cannot turn back.
 */
function escapeWindow({ targetId, casterId, weaponKey, seps, hi = 8000 }) {
  let worst = -1; let worstSep = null; let worstDeg = null;
  const rows = [];
  for (const sep of seps) {
    const c = cheapestEscape({ targetId, casterId, weaponKey, sep0: sep, hi });
    rows.push({ sep, ...c });
    const b = c.boundary === null ? 0 : c.boundary;
    if (b > worst) { worst = b; worstSep = sep; worstDeg = c.deg; }
  }
  return { window: worst, sep: worstSep, deg: worstDeg, rows };
}

// ── the roster's speed extremes, DERIVED (never the caps: 120/70 are nobody's speed) ──
const humans = CHARACTER_IDS.map((id) => ({ id, v: speedFor(id, PLAYER_SPEED) * 1000 }));
const FASTEST = humans.reduce((a, b) => (b.v > a.v ? b : a));
const SLOWEST = humans.reduce((a, b) => (b.v < a.v ? b : a));

const CANDIDATES = [
  ['waterbottle', 'Mega'],
  ['soup', 'Dump'],
  ['taco', 'Double'],
  ['burrito', 'Swarm'],
  ['sushi', 'Catch'],
  ['lollipop', 'Giant'],
];

/**
 * `--set <char>.<Weapon>.<field>=<n>` mutates the in-process roster before the sweep, so a
 * REDESIGN can be priced without editing `rules.ts` and without a worktree. It is a probe
 * knob, not a shipping path: `--set` prints what it changed, and the answer for any shape
 * it produces still has to be re-measured from the committed record afterwards.
 *
 * ⚠️ It writes a module-level singleton and does NOT restore — this process measures one
 * geometry and exits. Every function above restores `castMs` because they are called
 * thousands of times inside one run; this is called once, before any of them.
 */
if (args.set) {
  for (const spec of String(args.set).split(',')) {
    const m = /^([a-z]+)\.([A-Za-z]+)\.([A-Za-z]+)=(-?[0-9.]+)$/.exec(spec);
    if (!m) throw new Error(`--set '${spec}' is not <char>.<Weapon>.<field>=<number>`);
    const [, id, key, field, value] = m;
    const w = CHARACTERS[id]?.weapons.find((x) => x.key === key);
    if (!w) throw new Error(`--set '${spec}': no such weapon`);
    const was = w[field];
    w[field] = Number(value);
    console.log(`--set ${id}.${key}.${field}: ${was} -> ${w[field]}`);
  }
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name} ${detail}`); } };

  // 1. THE CONTROL FIRES. A fixture pointed past every melee reach must report NO-CONTROL,
  //    not a boundary — "nothing landed" is the same output a broken fixture gives.
  const far = boundaryOn({ targetId: SLOWEST.id, casterId: 'waterbottle', weaponKey: 'Mega', sep0: 3000 });
  t('KNOWN-BAD: out of reach → control does not land → no boundary', far.boundary === null, JSON.stringify(far));

  // 2. THE RADIAL ARM REPRODUCES `u5_derive` EXACTLY. Same fixture, same bisect, bearing 0
  //    — so any disagreement here is this file's, not the sim's. u5 publishes 601 for the
  //    slowest human against Mega at SEP0 = 20.
  const megaRadial = boundaryOn({ targetId: SLOWEST.id, casterId: 'waterbottle', weaponKey: 'Mega', runDeg: 0 });
  t(`bearing 0 reproduces u5_derive's published 601 ms for Mega (got ${megaRadial.boundary})`,
    megaRadial.boundary === 601, JSON.stringify(megaRadial));

  // 3. ⚠️ **THIS ROW WAS WRITTEN AS A KNOWN-GOOD AND IT FAILED, AND THE FAILURE IS THE
  //    FILE'S BIGGEST RESULT.** It used to read:
  //
  //      > *"A DISC HAS NO CHEAP DIRECTION. Mega is a 100° cone inside an 84 wu disc; the
  //      > melee resolution ignores nothing about bearing, but there is no bearing that
  //      > gets out cheaper than straight away."*
  //      >   `megaCheap.boundary >= megaRadial.boundary - TICK`   →  134 vs 601. FAIL.
  //
  //    The premise is false and `combat.ts:deliverWeapon` says so in three lines:
  //    `angleTo > cone / 2 → "wrong direction"`, measured against `attacker.facing`, which
  //    `sim.ts:applyAim` and `ai.ts` both refuse to update while `isCasting`. **A cone cast
  //    is escaped by leaving the ARC, not by outrunning the RADIUS**, and the arc is an
  //    order of magnitude cheaper. Kept above the replacement because every parenthesised
  //    `castMs` in `rules.ts` was derived from the radius reading.
  //
  //    The replacement asserts the property the old row MEANT: a genuinely
  //    omnidirectional melee (`cone: 360`, i.e. `lollipop.Giant`) has no cheap bearing,
  //    because there is no arc to leave. A model that just stopped sweeping bearings would
  //    pass this and fail row 3b.
  const giantRadial = boundaryOn({ targetId: SLOWEST.id, casterId: 'lollipop', weaponKey: 'Giant', runDeg: 0 });
  const giantCheap = cheapestEscape({ targetId: SLOWEST.id, casterId: 'lollipop', weaponKey: 'Giant' });
  t(`a 360° melee has no cheap bearing (${giantCheap.boundary} @${giantCheap.deg}° vs ${giantRadial.boundary} radial)`,
    giantCheap.boundary >= giantRadial.boundary - TICK, JSON.stringify(giantCheap));

  // 3b. AND A CONE DOES. The inequality is the point, not the value: it cannot be
  //     satisfied by a sweep that returns a constant, and it fails the moment the fixture
  //     stops freezing the caster's aim (a caster that re-aims turns its cone back onto
  //     the target and the angular escape disappears).
  const megaCheap = cheapestEscape({ targetId: SLOWEST.id, casterId: 'waterbottle', weaponKey: 'Mega' });
  t(`a melee CONE escapes strictly cheaper off-axis (${megaCheap.boundary} @${megaCheap.deg}° vs ${megaRadial.boundary} radial)`,
    megaCheap.boundary < megaRadial.boundary - TICK && megaCheap.deg !== 0, JSON.stringify(megaCheap));

  // 4. A FAN HAS ONE. This is the entire reason the file exists, and it is stated as an
  //    inequality rather than a value so it cannot be satisfied by a sweep that returns a
  //    constant. `taco.Double` is the roster's only non-homing fan special.
  const tacoRadial = boundaryOn({ targetId: SLOWEST.id, casterId: 'taco', weaponKey: 'Double', runDeg: 0 });
  const tacoCheap = cheapestEscape({ targetId: SLOWEST.id, casterId: 'taco', weaponKey: 'Double' });
  t(`a non-homing fan escapes strictly cheaper off-axis (${tacoCheap.boundary} @${tacoCheap.deg}° vs ${tacoRadial.boundary} radial)`,
    tacoCheap.boundary < tacoRadial.boundary - TICK && tacoCheap.deg !== 0, JSON.stringify(tacoCheap));

  // 5. THE STANDING CONTROL. A target that does nothing must be hit at the boundary — this
  //    is the "and not escapable by nothing" half, and without it a `castMs` that misses
  //    everyone reads as a perfect telegraph.
  const stood = trial({ targetId: SLOWEST.id, casterId: 'waterbottle', weaponKey: 'Mega', castMs: 1100, stand: true });
  t(`a STANDING target is still hit at the shipped 1100 (dealt ${stood.dealt})`, stood.dealt > 0, JSON.stringify(stood));

  // 6. A FASTER RUNNER ESCAPES SOONER. If the search read anything but the target's own
  //    legs, the two extremes would come out equal.
  const megaFast = boundaryOn({ targetId: FASTEST.id, casterId: 'waterbottle', weaponKey: 'Mega', runDeg: 0 });
  t(`a faster target escapes strictly sooner (${megaFast.boundary} < ${megaRadial.boundary})`,
    megaFast.boundary !== null && megaFast.boundary < megaRadial.boundary - TICK, `${megaFast.boundary}`);

  // 7. ONE CAST PER TRIAL. A window longer than a cooldown can open a second press inside
  //    the counting window; a boundary measured across two casts is a boundary of neither.
  const many = trial({ targetId: SLOWEST.id, casterId: 'burrito', weaponKey: 'Swarm', castMs: 5000, runDeg: 90 });
  t(`the counting window contains exactly one cast (saw ${many.casts})`, many.casts === 1, JSON.stringify(many));

  // 8. THE MUTATION IS UNDONE — every trial writes `castMs` on a process-wide singleton.
  t('the roster is left exactly as found',
    CHARACTERS.waterbottle.weapons.find((w) => w.key === 'Mega').castMs === 1100
    && CHARACTERS.taco.weapons.find((w) => w.key === 'Double').castMs === undefined);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

// ── report ──────────────────────────────────────────────────────────────────
const only = args.weapon ? String(args.weapon) : null;
const seps = args.seps ? String(args.seps).split(',').map(Number) : [20, 40, 60, 80, 100, 120, 140];
const REACTION_MS = 300;
const roundUp50 = (n) => Math.ceil(n / 50) * 50;

console.log(`fastest human ${FASTEST.id} ${f2(FASTEST.v)} wu/s · slowest human ${SLOWEST.id} ${f2(SLOWEST.v)} wu/s`);
console.log(`HIT_RADIUS_VS_PLAYER ${HIT_RADIUS_VS_PLAYER} · ${BEARINGS.length} bearings x ${seps.length} separations x bisect to 1 ms (tick floor ${f2(TICK)} ms)`);
console.log('escapeWindow = MAX over separations of MIN over bearings. castMs = roundUp50(window(slowest) + 300).\n');
console.log('weapon                 |  radial@20 slow |  ESCAPE WINDOW slow  (sep,bearing) | fast |    wu@slow |  DERIVED castMs | shipped');

for (const [id, key] of CANDIDATES) {
  if (only && only !== `${id}.${key}`) continue;
  const w = CHARACTERS[id].weapons.find((x) => x.key === key);
  const list = w.type === 'melee' ? seps.filter((s) => s <= (w.range ?? 0)) : seps;
  const slowR = boundaryOn({ targetId: SLOWEST.id, casterId: id, weaponKey: key, sep0: SEP0, runDeg: 0 });
  const slowW = escapeWindow({ targetId: SLOWEST.id, casterId: id, weaponKey: key, seps: list });
  const fastW = escapeWindow({ targetId: FASTEST.id, casterId: id, weaponKey: key, seps: list });
  const derived = roundUp50(slowW.window + REACTION_MS);
  console.log(
    `${(id + '.' + key).padEnd(22)} | ${String(slowR.boundary).padStart(15)} | `
    + `${String(slowW.window).padStart(19)}  (${String(slowW.sep).padStart(3)},${String(slowW.deg).padStart(3)}°) | `
    + `${String(fastW.window).padStart(4)} | ${f2((slowW.window / 1000) * SLOWEST.v).padStart(10)} | `
    + `${String(derived).padStart(15)} | ${w.castMs ?? '—'}`,
  );
  if (args.verbose) {
    for (const r of slowW.rows) {
      const stand = r.boundary === null ? '—'
        : trial({ targetId: SLOWEST.id, casterId: id, weaponKey: key, castMs: derived, sep0: r.sep, stand: true }).dealt;
      console.log(`    sep ${String(r.sep).padStart(4)}  cheapest ${String(r.boundary === null ? 'UNREACHABLE' : r.boundary).padStart(11)} @${String(r.deg).padStart(4)}°  radial ${String(r.radial).padStart(11)}  free-bearings ${String(r.free).padStart(2)}/${BEARINGS.length}  standing-target dmg @derived ${stand}`);
    }
  }
}
