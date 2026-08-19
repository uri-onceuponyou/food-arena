#!/usr/bin/env node
/**
 * WM_VOCAB — the CLOSED VOCABULARY of weapon mechanics this sim can actually express.
 *
 * ── WHY A VOCABULARY AND NOT A REPORT ───────────────────────────────────────
 *
 * ⚠️ The "20 of 34" below is the ORIGINAL audit's number and it is WRONG — the gate
 * re-derives **13 of 34** false, 21 PASS. See `wm_gate.mjs`'s header. Kept in the past
 * tense because three other documents still carry it.
 *
 * An audit found 20 of 34 ability blurbs claiming something the sim does not do. That
 * finding lived only in agent reports and commit messages, so it went stale against a
 * tree that moved ~30 commits and NOTHING IN THE REPO COULD RE-RUN IT. Natural language
 * cannot be diffed against a struct, so the durable form is: every blurb declares, from
 * a closed list, WHICH MECHANICS IT CLAIMS, and a gate asserts each one against the
 * weapon record it is type-linked to (`rules.ts:AbilityBlurb.weapon`, `abilityCards()`).
 *
 * A term is in this vocabulary only if the SIM implements it. That is the half that
 * catches the expensive class: `sushi.Seaweed`'s *"lures every enemy toward it"* is not
 * a wrong NUMBER, it is a mechanic with no field, no state and no code — so `lure` is
 * simply absent here and any claim naming it fails as MISSING MECHANIC.
 *
 * ── THE THREE CLASSES, WHICH HAVE DIFFERENT OWNERS AND DIFFERENT COSTS ──────
 *
 *   WRONG VALUE      term IS in this vocabulary, predicate is FALSE on the record.
 *                    Owner: whoever owns `rules.ts`. Cost: one number or one word.
 *   MISSING MECHANIC term is NOT in this vocabulary at all. Owner: whoever owns the sim.
 *                    Cost: a feature. **This class is the roadmap.**
 *   COSMETIC         flavour that asserts nothing checkable. Cost: nothing.
 *
 * ── ⚠️ TWO TRAPS THAT WOULD CORRUPT EVERY DAMAGE AND RANGE VERDICT ──────────
 *
 * 1. `Weapon.damage` IS AUTHORED PER-PELLET. It cost 50.6 pp on Hamburger and the roster
 *    was balanced against it twice. So a *"heavy damage"* claim is checked against BURST
 *    — `damage x pellets`, `damage x peckHits`, or the SUM of `comboParts` — never
 *    against the raw field. Both quantities are published here (`burst`, `perHit`)
 *    because both are claimed by real blurbs: donut's *"chip away health"* is a per-hit
 *    claim on a weapon whose BURST is above the roster median.
 * 2. `Weapon.range` is *"two quantities wearing one number"* — `ai.ts:pickWeapon` gates
 *    on it, `sim.ts:stepProjectiles` retires on it. **No term here reads `range` as
 *    effective reach.** `reach-whole-map` compares the nominal number against the ARENA
 *    DIAGONAL, a comparison whose verdict (400 vs 3441) cannot turn on the gap between
 *    the two readings. Effective reach is `tf_reach`'s job, measured on the real sim.
 *
 * ── SELF-VALIDATION (CLAUDE.md rule 6: a guard not shown to FAIL is not a guard) ──
 *
 * Every term carries `expect`:
 *   'discriminating'  at least one shipped weapon satisfies it AND at least one does not.
 *                     A term nothing satisfies is a fiction; a term everything satisfies
 *                     is a tautology. Both are asserted, and both are faults.
 *   'none-today'      NO shipped weapon satisfies it, deliberately — these are the
 *                     wrong-value catchers. The gate FAILS if one starts being satisfied
 *                     without this annotation changing, so the ratchet runs both ways.
 *
 * `splat-slows-anyone` is not read off a field at all: it is MEASURED on the real sim
 * each run, with a positive control (the human-controlled fighter MUST slow) so a rig
 * that measures nothing cannot report "no".
 *
 * Owner prefix: wm_*. Read-only on `src/`. Offline: no browser, no GPU.
 *
 *   node tools/tmp/wm_vocab.mjs            # print the vocabulary + the derived roster stats
 *   node tools/tmp/wm_vocab.mjs --selftest # the grounding + measurement controls
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const IS_MAIN = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

const rules = await import(`${ROOT}src/game/rules.ts`);
const sim = await import(`${ROOT}src/game/sim.ts`);

const { CHARACTERS, CHARACTER_IDS, TRAIL, STUN_DURATION_MS, SLOW_DURATION_MS, SPLAT_RADIUS, SPLAT_DURATION_MS } = rules;

// ─────────────────────────────────────────────────────────────────────────────
// ARENA SCALE — parsed, because `src/arena/shared.ts` cannot be imported offline
// (it pulls `src/render/toon`, i.e. the whole Three.js tree). Parsed with hard
// assertions rather than trusted: a silent 0 here would make `reach-whole-map`
// vacuously TRUE for every weapon, which is exactly the `[].every()` shape.
// ─────────────────────────────────────────────────────────────────────────────
function arenaScale() {
  const src = readFileSync(`${ROOT}src/arena/shared.ts`, 'utf8');
  const num = (name) => {
    const m = src.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)\\b`));
    if (!m) throw new Error(`wm_vocab: could not parse ${name} out of src/arena/shared.ts`);
    const v = Number(m[1]);
    if (!Number.isFinite(v) || v < 1000) throw new Error(`wm_vocab: ${name} parsed as ${v}, which is not a plausible map dimension`);
    return v;
  };
  const w = num('ARENA_W'), h = num('ARENA_H');
  return { w, h, diagonal: Math.hypot(w, h) };
}
export const ARENA = arenaScale();

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED ROSTER ARITHMETIC — the trap-aware quantities every damage term reads
// ─────────────────────────────────────────────────────────────────────────────
export function burstOf(w) {
  if (Array.isArray(w.comboParts) && w.comboParts.length) return w.comboParts.reduce((s, p) => s + p.damage, 0);
  return w.damage * (w.peckHits ?? 1) * (w.pellets ?? 1);
}
/** Damage delivered by ONE contact — the quantity a "chips away a little health" claim is about. */
export function perHitOf(w) {
  if (Array.isArray(w.comboParts) && w.comboParts.length) return Math.max(...w.comboParts.map((p) => p.damage));
  return w.damage;
}

function percentile(sorted, p) {
  if (!sorted.length) throw new Error('wm_vocab: percentile of an empty set');
  const i = p * (sorted.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export const ROSTER = (() => {
  const rows = [];
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) {
      rows.push({ tag: `${id}.${w.key}`, id, w, burst: burstOf(w), perHit: perHitOf(w) });
    }
  }
  if (rows.length === 0) throw new Error('wm_vocab: the roster is empty');
  const damaging = rows.filter((r) => r.burst > 0);
  if (damaging.length === 0) throw new Error('wm_vocab: no damaging weapon in the roster');
  const bursts = damaging.map((r) => r.burst).sort((a, b) => a - b);
  const perHits = damaging.map((r) => r.perHit).sort((a, b) => a - b);
  const cds = rows.map((r) => r.w.cooldown).sort((a, b) => a - b);
  const byBurst = [...damaging].sort((a, b) => b.burst - a.burst);
  const rank = new Map(byBurst.map((r, i) => [r.tag, i + 1]));
  // Reach ordering, for `reach-longest`. `range` is undefined on `type: 'self'`
  // (hamburger.Onion), so it coerces to 0 rather than to NaN — a NaN here would poison
  // every comparison silently and make the term vacuously false for the whole roster.
  const ranges = rows.map((r) => r.w.range ?? 0).sort((a, b) => b - a);
  if (!Number.isFinite(ranges[0]) || ranges[0] <= 0) throw new Error('wm_vocab: the roster has no positive weapon range');
  return {
    rows, damaging,
    burstMedian: percentile(bursts, 0.5),
    perHitP33: percentile(perHits, 1 / 3),
    cooldownP67: percentile(cds, 2 / 3),
    burstRank: rank,
    maxRange: ranges[0],
    secondRange: ranges.find((x) => x < ranges[0]) ?? 0,
    nWeapons: rows.length,
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// MEASURED: does a floor splat slow a BOT, or only a human-controlled fighter?
//
// `pizza.Tomato`'s blurb says *"slowing ANYONE who steps on them"*. `rules.ts` states
// the same rule twice in prose and `sim.ts:moveFighter` implements it once — it is the
// only caller of `terrainSlowFactor()` that scales a speed, and `ai.ts` builds its own
// step out of the STATUS slow alone. Rather than assert that from the source, this
// measures it, with the PLAYER arm as the positive control: if the human fighter does
// not slow either, the rig is blind and its "no" means nothing.
// ─────────────────────────────────────────────────────────────────────────────
const CLEAR_ARENA = {
  id: 'wm_vocab', displayName: 'wm_vocab', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 100000,
  playerSpawn: { x: 1000, y: 2000 }, enemySpawn: { x: 3000, y: 2000 },
  cover: [], hazards: [], build: () => null, update: () => {},
};
const DT = 16.667;

/** Displacement of one seat over `ticks`, optionally standing in a splat. */
function walkOnce({ flooded, seat }) {
  const st = sim.createMatch(CLEAR_ARENA, 'hotdog', 'hotdog');
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  while (st.phase !== 'playing') sim.stepMatch(st, DT, IDLE);
  // Park the two far apart so the bot is in its chase-MOVE branch and neither is in reach.
  st.player.x = 400; st.player.y = 2000;
  st.enemy.x = 3600; st.enemy.y = 2000;
  const f = seat === 'player' ? st.player : st.enemy;
  const x0 = f.x, y0 = f.y;
  const input = seat === 'player'
    ? { move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: false }
    : IDLE;
  let moved = 0;
  for (let i = 0; i < 12; i++) {
    if (flooded) {
      // Re-seat the splat under the fighter every tick so it is standing in one for the
      // whole walk regardless of how far it gets. Injected directly rather than fired,
      // because firing would also apply the weapon's own status slow and confound the arm.
      st.splats.length = 0;
      st.splats.push({ id: st.nextId++, x: f.x, y: f.y, expiresAt: st.elapsed + SPLAT_DURATION_MS });
    } else {
      st.splats.length = 0;
    }
    const bx = f.x, by = f.y;
    sim.stepMatch(st, DT, input);
    moved += Math.hypot(f.x - bx, f.y - by);
  }
  return { moved, net: Math.hypot(f.x - x0, f.y - y0) };
}

export function measureSplatSlow() {
  const pDry = walkOnce({ flooded: false, seat: 'player' }).moved;
  const pWet = walkOnce({ flooded: true, seat: 'player' }).moved;
  const eDry = walkOnce({ flooded: false, seat: 'enemy' }).moved;
  const eWet = walkOnce({ flooded: true, seat: 'enemy' }).moved;
  const playerRatio = pDry > 0 ? pWet / pDry : NaN;
  const botRatio = eDry > 0 ? eWet / eDry : NaN;
  return {
    playerRatio, botRatio, pDry, pWet, eDry, eWet,
    // POSITIVE CONTROL. Without this a rig that never put anyone in a splat would report
    // "the bot does not slow" with total confidence — and so would a rig whose fighters
    // never moved at all (hence the `> 0` guards, which make a zero-displacement arm a
    // control failure rather than a ratio of 0/0).
    controlOk: pDry > 1 && eDry > 1 && playerRatio < 0.99,
    reachesBot: eDry > 1 && botRatio < 0.99,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MEASURED: how many DISTINCT fighters does ONE press damage?
//
// Three blurbs promise an effect on MORE THAN ONE fighter — `lollipop.Giant`'s *"hits
// the whole map, making everyone dizzy"*, `sushi.Catch`'s *"pulling enemies everywhere"*,
// `burrito.Swarm`'s *"fly everywhere and chase enemies"*. `multi-target` is deliberately
// ABSENT from the vocabulary below, so those claims come back MISSING MECHANIC. That
// verdict must not rest on my reading of `combat.ts:deliverWeapon`; this measures it, and
// it is what will TELL YOU TO ADD THE TERM if the sim ever grows the mechanic.
//
// ⚠️ WHY THIS RIG EXISTS BESIDE `wty_multitarget.mjs` RATHER THAN IMPORTING ITS CONTROL.
// That tool's real rows are reused below — no duplication of the census. But its
// `pressWithBystanders({ patchFanOut })` parameter is **declared in the signature and
// never read anywhere in the file**, so asking it for a fan-out control returns an
// ORDINARY run: measured, `patchFanOut: true` on `lollipop.Giant` reports `victims 1`,
// which reads exactly like a passing control and is not one. Reported, not edited — that
// file has a different owner. The control below is therefore built here: two presses at
// two different nearest targets must report TWO distinct victims, which proves the census
// can see a second fighter through the real event pipeline.
// ─────────────────────────────────────────────────────────────────────────────
const MT_ARENA = {
  id: 'wm_mt', displayName: 'wm_mt', width: 8000, height: 8000,
  center: { x: 4000, y: 4000 }, maxSafeRadius: 100000,
  playerSpawn: { x: 3000, y: 4000 }, enemySpawn: { x: 5000, y: 4000 },
  cover: [], hazards: [], build: () => null, update: () => {},
};
const MT_HUGE = 1e7;

/**
 * `presses` describes, per press, which bystander index must be NEAREST. Returns the
 * number of DISTINCT fighters the attacker's weapon damaged across the whole run.
 */
function multiTargetRun(charId, weaponKey, { presses = [0], ring = 60, durationMs = 4000 } = {}) {
  const ws = CHARACTERS[charId].weapons;
  const idx = ws.findIndex((w) => w.key === weaponKey);
  if (idx < 0) throw new Error(`wm_vocab: ${charId} has no weapon "${weaponKey}"`);
  const N = 5;
  const roster = [{ characterId: charId }];
  for (let i = 0; i < N; i++) roster.push({ characterId: charId, spawn: { x: 1000 + i * 200, y: 1000 } });
  const st = sim.createMatch(MT_ARENA, roster);
  const all = st.fighters;
  for (let i = 1; i < all.length; i++) all[i].controller = 'human';
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  const idleAll = all.map(() => IDLE);
  while (st.phase !== 'playing') sim.stepMatch(st, DT, idleAll);

  const AX = 4000, AY = 4000;
  const victims = new Set();
  let pressIx = 0, firedThis = false, fires = 0;

  // Bearings spread over the circle; radii staggered 2% per index so "who is nearest" is
  // a stated fact rather than floating-point noise (the same correction wty_multitarget
  // records: on an exact ring the tie broke on `hypot` rounding).
  // ⚠️ THE DESIGNATED NEAREST STANDS AT BEARING 0, NOT ON ITS OWN SPOKE, AND THAT IS A FIX.
  // Written first with every bystander on a fixed spoke and only its RADIUS varying, the
  // control's second press put bystander 2 at bearing 144 deg — nearest, and outside
  // Lollipop Smash's 80 deg cone — so the press legitimately hit nobody and the control
  // reported 1. That is the arm working: it caught its own rig being blind before any row
  // was believed. The nearest is now always dead ahead of the frozen aim.
  const place = (nearIdx) => {
    all[0].x = AX; all[0].y = AY; all[0].facing = { x: 1, y: 0 };
    let spoke = 0;
    for (let i = 0; i < N; i++) {
      const f = all[i + 1];
      if (i === nearIdx) { f.x = AX + ring; f.y = AY; }
      else {
        spoke++;
        const bearing = (spoke / N) * 360 * DEG_TO_RAD;
        const r = ring * (1.6 + i * 0.02);
        f.x = AX + Math.cos(bearing) * r;
        f.y = AY + Math.sin(bearing) * r;
      }
      f.hp = MT_HUGE; f.maxHp = MT_HUGE;
    }
    all[0].hp = MT_HUGE; all[0].maxHp = MT_HUGE;
  };

  let t = 0;
  while (t < durationMs && pressIx < presses.length) {
    place(presses[pressIx]);
    const input = [
      firedThis ? IDLE : { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: idx, attack: true },
      ...idleAll.slice(1),
    ];
    for (const ev of sim.stepMatch(st, DT, input)) {
      if (ev.type === 'weapon-fired' && ev.fighterId === all[0].id && ev.weaponKey === weaponKey) { firedThis = true; fires++; }
      else if (ev.type === 'hit-landed' && ev.source?.kind === 'weapon' && ev.source.weaponKey === weaponKey && ev.source.attackerId === all[0].id) {
        victims.add(ev.targetId);
      }
    }
    t += DT;
    // Advance to the next press once this one has landed and settled.
    if (firedThis && t > (pressIx + 1) * (durationMs / presses.length)) { pressIx++; firedThis = false; }
  }
  return { victims: victims.size, fires };
}
const DEG_TO_RAD = Math.PI / 180;

export function measureMultiTarget() {
  // The three weapons whose cards promise more than one victim, plus the melee ultimate.
  const rows = [
    ['lollipop', 'Giant'], ['sushi', 'Catch'], ['burrito', 'Swarm'], ['sushi', 'Seaweed'],
  ].map(([c, k]) => ({ tag: `${c}.${k}`, ...multiTargetRun(c, k) }));
  // POSITIVE CONTROL — the census must be ABLE to report 2. Two presses, two different
  // nearest targets. Without this arm every "1" above is indistinguishable from a rig
  // that is simply blind to the other five fighters.
  const control = multiTargetRun('lollipop', 'Smash', { presses: [0, 2], durationMs: 6000 });
  return { rows, control, canSeeTwo: control.victims >= 2, maxVictims: Math.max(...rows.map((r) => r.victims)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE VOCABULARY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ THE ONE JUDGEMENT THRESHOLD IN THIS FILE. It is READ IN BOTH DIRECTIONS.
 *
 * `stun-few-seconds` (>= this) and `stun-brief` (< this) are exact complements over the
 * stun weapons, and that is deliberate: it means a stun blurb cannot become true by
 * DELETING its duration clause, only by describing the duration it actually has. One of
 * the two is satisfied by every stun weapon at any setting of `STUN_DURATION_MS`, so
 * whichever way the constant moves, exactly one set of cards goes red.
 *
 * 🔴 **DO NOT "FIX" A CARD BY MOVING THIS NUMBER.** 2026-08-19: `hamburger.Lettuce` and
 * `burrito.Roll` both said *"for a few seconds"* against a 2000 ms stun, and lowering
 * 3000 -> 2000 would have turned both green in one character. That is the goalpost move
 * CLAUDE.md rule 6 is about. The cards moved instead; see the commit and DECISIONS §81.
 */
const FEW_SECONDS_MS = 3000;

export function buildVocab(env) {
  const V = {};
  const T = (name, expect, doc, test) => { V[name] = { name, expect, doc, test }; };
  // Injectable so a known-bad can drive the stun terms from the OTHER side of the
  // threshold without editing `rules.ts`. Asserted, not defaulted-and-forgotten: a
  // silently-undefined `stunMs` would make `stun-brief` vacuously FALSE for the whole
  // roster and read exactly like a real regression.
  const stunMs = env.stunMs ?? STUN_DURATION_MS;
  if (!Number.isFinite(stunMs) || stunMs < 0) throw new Error(`wm_vocab: stunMs is ${stunMs}, which is not a duration`);

  // ── structure ──────────────────────────────────────────────────────────────
  T('melee', 'discriminating', "delivered by `combat.ts:deliverWeapon`'s melee branch", (c) => c.w?.type === 'melee');
  T('ranged', 'discriminating', 'spawns projectiles that travel', (c) => c.w?.type === 'ranged');
  T('self-target', 'discriminating', "`type: 'self'` — resolves on the caster, works in an empty arena", (c) => c.w?.type === 'self');
  T('melee-cone', 'discriminating', 'a DIRECTIONAL swing: `cone < 360`, tested against frozen `facing`', (c) => c.w?.type === 'melee' && (c.w.cone ?? 360) < 360);

  // ── status ─────────────────────────────────────────────────────────────────
  T('slow', 'discriminating', `\`effect: 'slow'\` — movement x${rules.SLOW_MOVE_MULTIPLIER} for ${SLOW_DURATION_MS}ms, diminishing on repeats`, (c) => c.w?.effect === 'slow');
  T('stun', 'discriminating', `\`effect: 'stun'\` — movement locked to 0 for ${STUN_DURATION_MS}ms, diminishing on repeats`, (c) => c.w?.effect === 'stun');
  T('stun-few-seconds', 'none-today', `a stun lasting >= ${FEW_SECONDS_MS}ms. STUN_DURATION_MS is ${stunMs} and is GLOBAL`, (c) => c.w?.effect === 'stun' && stunMs >= FEW_SECONDS_MS);
  T('stun-brief', 'discriminating', `a stun SHORTER than ${FEW_SECONDS_MS}ms — the honest reading of "for a moment". STUN_DURATION_MS is ${stunMs} and is GLOBAL`, (c) => c.w?.effect === 'stun' && stunMs < FEW_SECONDS_MS);

  // ── damage. BURST, never the raw per-pellet field. ─────────────────────────
  T('damage-any', 'discriminating', 'burst damage > 0', (c) => c.burst > 0);
  T('damage-above-median', 'discriminating', `burst strictly above the roster median (${ROSTER.burstMedian})`, (c) => c.burst > ROSTER.burstMedian);
  T('damage-top3', 'discriminating', 'burst in the top 3 of the roster', (c) => (ROSTER.burstRank.get(c.tag) ?? 1e9) <= 3);
  T('damage-below-median', 'discriminating', `burst > 0 and below the roster median (${ROSTER.burstMedian})`, (c) => c.burst > 0 && c.burst < ROSTER.burstMedian);
  T('damage-per-hit-low', 'discriminating', `damage per CONTACT in the bottom third (<= ${ROSTER.perHitP33})`, (c) => c.perHit > 0 && c.perHit <= ROSTER.perHitP33);

  // ── delivery ───────────────────────────────────────────────────────────────
  T('pellets', 'discriminating', 'fires N>1 projectiles from one press, fanned across `spreadDeg`', (c) => (c.w?.pellets ?? 1) > 1);
  T('combo', 'discriminating', '`comboParts` — distinct simultaneous projectiles with their own damage and angle', (c) => Array.isArray(c.w?.comboParts) && c.w.comboParts.length > 1);
  T('homing', 'discriminating', '`homing` — steers toward the target in flight (one target; see `multi-target`)', (c) => c.w?.homing === true);
  T('repeat-hits', 'discriminating', '`peckHits`/`peckInterval` — arrives, then strikes repeatedly', (c) => (c.w?.peckHits ?? 1) > 1);
  T('splatter', 'discriminating', `\`splatter\` — leaves a ground splat, r=${SPLAT_RADIUS}, ${SPLAT_DURATION_MS}ms. Slows. Deals NO damage.`, (c) => c.w?.splatter === true);
  T('splat-slows-anyone', 'none-today', 'a splat that slows BOTS as well as the human seat — MEASURED each run', (c) => c.w?.splatter === true && env.splatSlow.reachesBot);
  T('trail-boost', 'discriminating', `\`trailBoosted\` — damage x${TRAIL.damageBoost} while on own trail`, (c) => c.w?.trailBoosted === true);
  T('wind-up', 'discriminating', '`castMs` > 0 — the press only OPENS the attack; caster is rooted and its aim frozen', (c) => (c.w?.castMs ?? 0) > 0);
  T('self-heal', 'discriminating', '`healAmount` > 0, scaled by the level HEALTH ladder', (c) => (c.w?.healAmount ?? 0) > 0);
  T('giant-slam-vfx', 'discriminating', '`giantSlam` — a map-scale VISUAL. Read by vfx/camera/match; the sim resolves it as ordinary melee.', (c) => c.w?.giantSlam === true);
  T('long-cooldown', 'discriminating', `cooldown in the top third of the roster (>= ${ROSTER.cooldownP67}ms)`, (c) => (c.w?.cooldown ?? 0) >= ROSTER.cooldownP67);
  T('reach-whole-map', 'none-today', `nominal \`range\` >= the arena diagonal (${ARENA.diagonal.toFixed(1)} wu on ${ARENA.w}x${ARENA.h})`, (c) => (c.w?.range ?? 0) >= ARENA.diagonal);
  // The RELATIVE reach claim, and it is deliberately relative. A card that named an
  // absolute area would go stale the moment DECISIONS §80's lever 1 (shrink the super's
  // radius) is taken; "the widest in the game" survives a shrink and still fails the
  // moment some other weapon out-reaches it. `range` is compared against the SHIPPED
  // roster's maximum, so a claim whose own weapon is retuned below another one goes red.
  T('reach-longest', 'discriminating', `nominal \`range\` is the largest in the roster (${ROSTER.maxRange} wu; next longest ${ROSTER.secondRange} wu)`, (c) => (c.w?.range ?? 0) >= ROSTER.maxRange);

  // ── character-level (the one passive) ──────────────────────────────────────
  T('passive-trail', 'discriminating', '`CharacterDef.hasTrail` — drops marks while moving', (c) => c.def.hasTrail === true);
  T('trail-damage', 'discriminating', `the trail damages who treads it (${TRAIL.damage} HP, capped at ${TRAIL.maxHitsPerTick}/tick/victim)`, (c) => c.def.hasTrail === true && TRAIL.damage > 0);
  T('trail-speed-boost', 'discriminating', `standing on own trail multiplies speed by ${TRAIL.speedBoost}`, (c) => c.def.hasTrail === true && TRAIL.speedBoost > 1);

  return V;
}

/**
 * Words a COSMETIC span may not contain. Without this, `cosmetic` is an escape hatch that
 * turns any claim green by declaring it flavour — the classification equivalent of the
 * vacuity trap. Deliberately narrow: only unambiguous mechanic verbs and nouns, so that
 * genuine flavour ("tips himself over", "a chick bursts out") is not blocked.
 */
export const MECHANIC_LEXICON = new Set([
  'slow', 'slows', 'slowing', 'slowed', 'stun', 'stuns', 'stunned', 'freeze', 'freezes',
  'frozen', 'dizzy', 'heal', 'heals', 'healing', 'damage', 'damaging', 'hurts', 'chip',
  'chips', 'chase', 'chases', 'chasing', 'homing', 'lure', 'lures', 'pull', 'pulling',
  'destroyed', 'destructible', 'everyone', 'everywhere', 'vision', 'blind', 'burns',
  'seconds', 'splat', 'trail', 'heavy', 'huge', 'massive', 'powerful', 'slip',
]);

/** Function words only. Quantifiers ("every", "all", "whole", "map") are CONTENT on purpose. */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'it', 'its', 'his',
  'her', 'hers', 'him', 'he', 'she', 'they', 'them', 'their', 'that', 'this', 'these',
  'those', 'with', 'from', 'into', 'onto', 'for', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'can', 'could', 'will', 'would', 'while', 'when', 'until', 'then',
  'than', 'there', 'here', 's', 't', 'do', 'does', 'did', 'has', 'have', 'had', 'by',
  'if', 'not', 'no', 'which', 'who',
]);

export function contentWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((x) => x.length > 1 && !STOPWORDS.has(x));
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
  const splatSlow = measureSplatSlow();
  const V = buildVocab({ splatSlow });
  const selftest = process.argv.includes('--selftest');

  console.log('══ WM_VOCAB ══');
  console.log(`   arena ${ARENA.w}x${ARENA.h}, diagonal ${ARENA.diagonal.toFixed(2)} wu`);
  console.log(`   roster ${ROSTER.nWeapons} weapons, ${ROSTER.damaging.length} damaging`);
  console.log(`   burst median ${ROSTER.burstMedian} · per-hit P33 ${ROSTER.perHitP33} · cooldown P67 ${ROSTER.cooldownP67}ms`);
  console.log(`   splat slow: human x${splatSlow.playerRatio.toFixed(3)}  bot x${splatSlow.botRatio.toFixed(3)}  (control ${splatSlow.controlOk ? 'OK' : 'FAILED'})`);
  console.log('');

  let bad = 0;
  for (const t of Object.values(V)) {
    const sat = ROSTER.rows.filter((r) => t.test({ w: r.w, def: CHARACTERS[r.id], tag: r.tag, burst: r.burst, perHit: r.perHit }));
    const n = sat.length;
    let verdict = 'ok';
    if (t.expect === 'discriminating' && (n === 0 || n === ROSTER.nWeapons)) { verdict = n === 0 ? 'FICTION (nothing satisfies it)' : 'TAUTOLOGY (everything satisfies it)'; bad++; }
    if (t.expect === 'none-today' && n !== 0) { verdict = `NOW SATISFIED by ${n} — update the annotation`; bad++; }
    console.log(`   ${t.name.padEnd(20)} ${String(n).padStart(2)}/${ROSTER.nWeapons}  ${t.expect.padEnd(15)} ${verdict === 'ok' ? '' : '<<< ' + verdict}`);
    if (process.argv.includes('-v')) console.log(`        ${t.doc}`);
  }

  if (selftest) {
    console.log('\n── CONTROLS ──');
    const c1 = splatSlow.controlOk;
    console.log(`   ${c1 ? 'PASS' : 'FAIL'}  POSITIVE  the human seat DOES slow in a splat (x${splatSlow.playerRatio.toFixed(3)}) — a rig that measures nothing cannot report "no"`);
    const c2 = contentWords('Seaweed lures every enemy toward it').includes('lures');
    console.log(`   ${c2 ? 'PASS' : 'FAIL'}  LEXICON   the stopword list does not swallow a mechanic word ("lures" survives)`);
    const c3 = contentWords('for the of and is').length === 0;
    console.log(`   ${c3 ? 'PASS' : 'FAIL'}  LEXICON   pure function words yield NO content words`);
    const mt = measureMultiTarget();
    const c4 = mt.canSeeTwo;
    console.log(`   ${c4 ? 'PASS' : 'FAIL'}  POSITIVE  the victim census CAN report 2 (two presses, two nearest targets: victims=${mt.control.victims}, fires=${mt.control.fires})`);
    const c5 = mt.maxVictims <= 1;
    console.log(`   ${c5 ? 'PASS' : 'FAIL'}  GROUNDING no single press damages more than ONE fighter — so \`multi-target\` is rightly ABSENT from the vocabulary`);
    for (const r of mt.rows) console.log(`             ${r.tag.padEnd(18)} victims=${r.victims} fires=${r.fires}`);
    if (!c1 || !c2 || !c3 || !c4 || !c5) bad++;
  }

  if (bad > 0) { console.error(`\n${bad} vocabulary fault(s)`); process.exit(1); }
  console.log('\nvocabulary grounded.');
}
