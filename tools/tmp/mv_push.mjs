#!/usr/bin/env node
/**
 * MV_PUSH — THE DISPLACEMENT PRIMITIVE, BUILT AND MEASURED AND **NOT LANDED**.
 *
 * `movement.ts:escapeCover`'s header has recorded the gap since it was written:
 *
 *   > *"No player can reach that state today — spawns are clear and **knockback is
 *   > visual-only**. It becomes reachable the moment anyone adds sim-side knockback, a
 *   > dash, or a pull."*
 *
 * It is still true. `game/match.ts:applyKnockback` nudges a THREE.js model root and never
 * reaches `Fighter.x/y`, so **the sim cannot move a fighter it did not ask to move** —
 * which is `wm_gate`'s missing mechanic behind five weapon claims across four weapons:
 * `hotdog.Ketchup` *"lose control"*, `sushi.Seaweed` *"lures"* and `sushi.Catch` *"pulling"*,
 * `egg.Tackle`/`waterbottle.Mega` *"launches"*.
 *
 * The primitive was written, wired to knockback on every weapon hit, and **REFUSED ON A
 * MEASUREMENT**, not on time or taste. This file is the whole of it: the patch, the four
 * proofs that the primitive itself is sound, and the one number that refuses the WIRING.
 * It exists so the next pass starts from the measurement instead of from a blank file.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS SOUND — four proofs, all reproduced by `--prove`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. **DEPENETRATION HOLDS, AND IT IS BETTER THAN "IT RECOVERS".** Spending the push
 *    through `tryMove` means a shove INTO `spice_cart` (875,500,50,50) is REFUSED at the
 *    box face — the victim stops at x=828.999 and never enters, so the primitive cannot
 *    create the buried state at all. Forced into it by hand (x=875, dead centre) the
 *    fighter walks out on **tick 1**. The control is that a buried fighter pressing
 *    NOTHING stays buried, which is `escapeCover`'s documented intent-gating, not a fault.
 * 2. **CONTROL AUTHORITY IS UNTOUCHED, BIT-IDENTICALLY.** Difference of differences over
 *    30 ticks — (east − west) with a maximum push in flight against (east − west) with
 *    none — is `109.202183999996` in both arms, `===`. Being shoved costs POSITION and
 *    never CONTROL, which is what keeps it out of `DECISIONS §75`'s slow+stun lock family.
 * 3. **DETERMINISM.** No `Math.random`, no wall clock, no iteration-order dependence: the
 *    direction is computed once from `victim − attacker` and the spend is
 *    `min(remaining, PLAYER_SPEED * dt)`. A re-run is bit-identical.
 * 4. **IT IS NOT A THIRD LOCK, WITH A NUMBER (`§80`).** Longest possible push is
 *    `MAX_PUSH_DISTANCE / PLAYER_SPEED` = **350 ms**. A fighter walking straight INTO it
 *    nets `PLAYER_SPEED − speedFor(c)`: **0.0000 wu/ms for Hot Dog and Sushi** (they sit at
 *    the cap) up to 0.0144 for Egg and Soup — **5.04 wu over the entire push, 12% of one
 *    body.** And the push aims AWAY from the attacker, so it strictly HELPS the dodge §80
 *    asks for; it can never hold anybody inside a super's disc.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚨 WHAT REFUSES IT — `--refuse`, and it is a DESIGN result, not a tuning miss
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wiring it to EVERY weapon hit **deletes melee**. A bot closes at
 * `speedFor(id, AI_CHASE_SPEED)` = 61.6–70.0 wu/s. A pushed target moves at `PLAYER_SPEED`
 * = **120 wu/s, 1.71x the fastest chase**, so during a push nobody can close at all — and
 * the SUSTAINED rate is worse than the instantaneous one, because every weapon pushes:
 *
 *     kit push rate if everything fires on cooldown, against its own chase speed
 *       hamburger   79.1 wu/s  vs 63.7   1.24x     <- can never reach what it is hitting
 *       hotdog      69.9 wu/s  vs 70.0   1.00x     <- exactly break-even
 *       lollipop    55.8 wu/s  vs 67.9   0.82x
 *       ...
 *       donut       10.4 wu/s  vs 65.8   0.16x
 *
 * Measured end-to-end through the real `stepMatch`, not from the table: a passive,
 * immortal target that simply stands there is shoved from separation 30 to **90.86 wu in
 * 1,100 ms** by a Hamburger bot trying to close on it. `sim.test.mjs` §33(l)'s KNOWN-BAD
 * control — *"the SAME fixture with no cast open CLOSES IN"* — goes red on exactly that,
 * which is that row doing its job.
 *
 * ── SO THE FIELD THIS NEEDS IS `Weapon.knockback`, AND THAT IS THE FINDING ──
 *
 * The scale is not the problem; the SURFACE is. Knockback priced off `damage` is a
 * property of all 33 weapons at once, and a kit that fires three of them stacks three
 * shoves. It has to be **authored per weapon and absent by default**, exactly like
 * `castMs` — whose absence is bit-identical to the pre-cast sim, which is the property
 * that made the cast system landable while three other agents held three other files.
 *
 *     // in `Weapon`, beside `castMs`:
 *     /** Knockback this weapon applies to its victim, in world units. Absent = none. *\/
 *     knockback?: number;
 *
 * Then `pushDistanceForDamage(dealt)` in the patch becomes `w.knockback ?? 0` and the
 * whole roster is bit-identical until somebody authors a number. **`rules.ts` was not this
 * agent's file, and the derivation-from-`damage` used here was the attempt to avoid asking
 * for the field. The measurement says the field is the right answer.**
 *
 * ⚠️ AND `lure` / `self-launch` NEED THE SAME SHAPE, ONE LEVEL UP. Both are this same
 * primitive with a different SOURCE of the direction — a lure pulls TOWARD a point, a
 * self-launch pushes the CASTER along its own frozen facing. `pushFighter(fighter, fromX,
 * fromY, distance)` already expresses all three: pass the caster's position to push away,
 * the lure's anchor with a negated vector to pull in, and the caster itself with a point
 * behind it to launch. **They need `lure?: number` and `selfLaunch?: number` in `Weapon`
 * and no new movement code at all.**
 *
 * ── WHAT IS DELIBERATELY NOT IN THE PATCH ───────────────────────────────────
 *
 * `trail`, `fog` and `hazard` sources do not push. Fog and hazards have no attacker, so
 * there is no direction to push along. A trail mark HAS an owner but damages on a per-tick
 * cadence, so pushing off it would be a continuous shove from a stationary object — it
 * would turn Donut's trail into a wall.
 *
 *   node tools/tmp/mv_push.mjs --prove      # the four proofs, on the patched sim
 *   node tools/tmp/mv_push.mjs --refuse     # the melee-closure measurement that refused it
 *   node tools/tmp/mv_push.mjs --selftest   # both, plus the rig's own controls
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const PATCH = join(ROOT, 'tools/tmp/mv_push.patch');

// `docs/AGENT-BRIEF.md` §3 — guard the main path; three tools here ran their CLI on import.
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const args = new Set(process.argv.slice(2));

/**
 * Copy `src/` into a temp dir and apply the primitive.
 *
 * 🚨 **THE APPLY IS ASSERTED, AND A FAILED APPLY THROWS RATHER THAN DEGRADING.** A patch
 * that no longer applies would leave a temp tree that is simply the SHIPPED tree — every
 * proof below would then run against a sim with no primitive in it, `--prove` would report
 * "control authority untouched" (trivially, because nothing pushes) and `--refuse` would
 * report "melee closes fine". Both would read as passing and both would be measuring
 * nothing. That is the vacuity trap this repo has been bitten by at least seven times, and
 * it is the single most likely way this file rots.
 */
export function buildPushedTree() {
  if (!existsSync(PATCH)) throw new Error(`mv_push: no patch at ${PATCH}`);
  const dir = mkdtempSync(join(tmpdir(), 'mv-push-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  try {
    execFileSync('patch', ['-p1', '--batch', '--forward', '-i', PATCH], {
      cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
    });
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(
      'mv_push: the primitive no longer applies to `src/` — the tree moved under it.\n'
      + `  ${String(e.stdout ?? '')}${String(e.stderr ?? '')}\n`
      + '  REPORTING NOTHING rather than a number from an unpatched sim: every proof below\n'
      + '  would pass vacuously against a tree with no primitive in it.',
    );
  }
  // The positive control on the apply itself: the patched tree must CARRY the primitive.
  const mv = readFileSync(join(dir, 'src/game/movement.ts'), 'utf8');
  const cb = readFileSync(join(dir, 'src/game/combat.ts'), 'utf8');
  const sm = readFileSync(join(dir, 'src/game/sim.ts'), 'utf8');
  const missing = [
    ['movement.ts:pushFighter', mv.includes('export function pushFighter(')],
    ['movement.ts:stepPush', mv.includes('export function stepPush(')],
    ['combat.ts wiring', cb.includes('pushFighter(target, attacker.x, attacker.y')],
    ['sim.ts integration', sm.includes('stepPush(fighter, dt, state.arena)')],
  ].filter(([, ok]) => !ok).map(([n]) => n);
  if (missing.length) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`mv_push: the patch applied but the primitive is absent: ${missing.join(', ')}`);
  }
  // …and the NEGATIVE control: the SHIPPED tree must NOT carry it, or the patch is a no-op
  // and the "before" arm of every comparison below is the "after" arm.
  if (readFileSync(join(ROOT, 'src/game/movement.ts'), 'utf8').includes('export function stepPush(')) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error('mv_push: the SHIPPED tree already carries the primitive — this rig has nothing to stage.');
  }
  return { dir, simDir: join(dir, 'src/game') };
}

const rmTree = (t) => { if (t) rmSync(t.dir, { recursive: true, force: true }); };

const SPICE = { x: 875, y: 500, w: 50, h: 50, kind: 'spice_cart' };
const NO_INPUT = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

function arenaWith(cover, w = 2800, h = 2000) {
  return {
    id: 'mv_push', displayName: 'mv_push', width: w, height: h,
    center: { x: w / 2, y: h / 2 }, maxSafeRadius: 50_000,
    playerSpawn: { x: w / 4, y: h / 4 }, enemySpawn: { x: (w * 3) / 4, y: (h * 3) / 4 },
    cover, hazards: [], build: () => null, update: () => {},
  };
}

async function loadSim(simDir) {
  return {
    ...(await import(`${simDir}/sim.ts`)),
    RULES: await import(`${simDir}/rules.ts`),
    MOVE: await import(`${simDir}/movement.ts`),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
  let bad = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`);
    else { bad++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  const want = (k) => args.has(`--${k}`) || args.has('--selftest');
  console.log('══ MV_PUSH ══  the displacement primitive, staged — measured and NOT landed');

  if (!args.has('--prove') && !args.has('--refuse') && !args.has('--selftest')) {
    console.log('\n   usage: --prove | --refuse | --selftest');
    process.exit(0);
  }

  const tree = buildPushedTree();
  try {
    const S = await loadSim(tree.simDir);
    const { PLAYER_SPEED, AI_CHASE_SPEED, CHARACTER_IDS, CHARACTERS, speedFor } = S.RULES;
    const { MAX_PUSH_DISTANCE, pushFighter, pushDistanceForDamage } = S.MOVE;

    if (want('prove')) {
      console.log('\n── PROOF 1: DEPENETRATION — `movement.ts:escapeCover`\'s "the moment anyone adds sim-side knockback" ──');
      {
        const arena = arenaWith([SPICE]);
        const st = S.createMatch(arena, 'hamburger', 'hamburger');
        st.phase = 'playing';
        const inside = (f) => Math.abs(f.x - SPICE.x) < (f.size + SPICE.w) / 2
          && Math.abs(f.y - SPICE.y) < (f.size + SPICE.h) / 2;
        st.player.x = SPICE.x - 60; st.player.y = SPICE.y;
        st.enemy.x = SPICE.x - 400; st.enemy.y = SPICE.y;
        ok('the victim starts OUTSIDE the cart (non-vacuity: a fighter already inside proves nothing)',
          !inside(st.player), `x=${st.player.x}`);
        // The biggest push the system can produce, aimed due east, straight into the box.
        pushFighter(st.player, st.player.x - 1, st.player.y, MAX_PUSH_DISTANCE);
        ok('…and it really is holding a maximum push (non-vacuity)',
          st.player.push.remaining === MAX_PUSH_DISTANCE, `${st.player.push.remaining} wu`);
        let everInside = false;
        for (let i = 0; i < 40; i++) { S.stepMatch(st, 16.667, NO_INPUT); if (inside(st.player)) everInside = true; }
        ok('a maximum push INTO cover is refused at the box face — the buried state is unreachable',
          !everInside && !inside(st.player), `stopped at x=${st.player.x.toFixed(3)}`);
        ok('…and it did move (a push that went nowhere would pass the row above vacuously)',
          st.player.x > SPICE.x - 60 + 1e-6, `moved ${(st.player.x - (SPICE.x - 60)).toFixed(3)} wu`);

        st.player.x = SPICE.x; st.player.y = SPICE.y;
        ok('FORCED into the cart by hand, the fighter really is buried (the state under test)',
          inside(st.player));
        let freedAt = null;
        for (let i = 0; i < 40; i++) {
          S.stepMatch(st, 16.667, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
          if (freedAt === null && !inside(st.player)) freedAt = i + 1;
        }
        ok('…and `escapeCover` frees it on the FIRST tick it presses a direction',
          freedAt === 1 && !inside(st.player), `freed on tick ${freedAt}, x=${st.player.x.toFixed(3)}`);
        st.player.x = SPICE.x; st.player.y = SPICE.y;
        for (let i = 0; i < 40; i++) S.stepMatch(st, 16.667, NO_INPUT);
        ok('CONTROL: a buried fighter pressing NOTHING stays put — `escapeCover` is intent-gated by design',
          inside(st.player), 'this is the QA-parking diagnostic its header protects, not a fault');
      }

      console.log('\n── PROOF 2: CONTROL AUTHORITY — a shove costs POSITION, never CONTROL (`§75`, `§80`) ──');
      {
        const arena = arenaWith([], 4000, 4000);
        const mk = (push) => {
          const st = S.createMatch(arena, 'hamburger', 'hamburger');
          st.phase = 'playing';
          st.player.x = 2000; st.player.y = 2000;
          st.enemy.x = 3900; st.enemy.y = 3900;   // far enough that nothing interacts
          if (push) pushFighter(st.player, 2000, 2001, MAX_PUSH_DISTANCE);  // due north
          return st;
        };
        const run = (st, mv, n) => {
          for (let i = 0; i < n; i++) S.stepMatch(st, 16.667, { move: mv, aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
          return { x: st.player.x, y: st.player.y };
        };
        const E = { x: 1, y: 0 }, W = { x: -1, y: 0 }, N = 30;
        const a = run(mk(false), E, N), b = run(mk(false), W, N);
        const c = run(mk(true), E, N), d = run(mk(true), W, N);
        ok('the fixture MOVES at all (a frozen fighter makes every difference 0 and the test vacuous)',
          Math.abs(a.x - b.x) > 1, `east-west span ${(a.x - b.x).toFixed(3)} wu`);
        ok('the push actually displaced it, on the other axis, by the whole cap',
          Math.abs(c.y - a.y) > MAX_PUSH_DISTANCE - 1e-6, `${(c.y - a.y).toFixed(3)} wu of ${MAX_PUSH_DISTANCE}`);
        ok('🔴 CONTROL AUTHORITY IS BIT-IDENTICAL under a maximum push (difference of differences)',
          (a.x - b.x) === (c.x - d.x), `no push ${(a.x - b.x).toFixed(12)} · pushed ${(c.x - d.x).toFixed(12)}`);
        const e = run(mk(true), E, N);
        ok('🔴 DETERMINISM: a re-run is bit-identical — no RNG, no clock, no iteration order',
          e.x === c.x && e.y === c.y);
      }

      console.log('\n── PROOF 3: IT IS NOT A THIRD LOCK — `§80`, with a number ──');
      {
        const durMs = MAX_PUSH_DISTANCE / PLAYER_SPEED;
        const speeds = CHARACTER_IDS.map((id) => ({ id, s: speedFor(id, PLAYER_SPEED) }))
          .sort((p, q) => p.s - q.s);
        const worst = speeds[0];
        const net = (PLAYER_SPEED - worst.s) * durMs;
        console.log(`   longest possible push ${durMs.toFixed(1)} ms at ${PLAYER_SPEED} wu/ms (= PLAYER_SPEED, the roster CAP)`);
        for (const { id, s } of [speeds[0], speeds[speeds.length - 1]]) {
          console.log(`     ${id.padEnd(12)} own ${s.toFixed(4)} -> walking INTO it nets `
            + `${(PLAYER_SPEED - s).toFixed(4)} wu/ms = ${((PLAYER_SPEED - s) * durMs).toFixed(2)} wu over the whole push`);
        }
        ok('walking straight INTO a maximum push costs less than one FIFTH of a body, worst case',
          net < CHARACTERS.hamburger.weapons.length * 0 + 42 / 5,
          `${net.toFixed(2)} wu on ${worst.id}, against a 42 wu body`);
        ok('nothing in the roster can be pushed FASTER than the roster movement cap',
          speeds[speeds.length - 1].s <= PLAYER_SPEED + 1e-12,
          'so `render/camera.ts`\'s fair-play radius claim is untouched');
      }
    }

    if (want('refuse')) {
      console.log('\n── 🚨 THE REFUSAL: WIRED TO EVERY HIT, THIS DELETES MELEE ──');
      {
        const rows = [];
        for (const id of CHARACTER_IDS) {
          let rate = 0;
          for (const w of CHARACTERS[id].weapons) {
            if (w.type === 'self' || !(w.damage > 0)) continue;
            const perPress = pushDistanceForDamage(w.damage) * (w.comboParts ? w.comboParts.length : 1);
            rate += perPress / (w.cooldown / 1000);
          }
          rows.push({ id, rate, chase: speedFor(id, AI_CHASE_SPEED) * 1000 });
        }
        rows.sort((a, b) => b.rate / b.chase - a.rate / a.chase);
        console.log('   kit push rate if everything fires on cooldown, vs its own chase speed');
        for (const r of rows) {
          console.log(`     ${r.id.padEnd(12)} ${r.rate.toFixed(1).padStart(6)} wu/s  vs ${r.chase.toFixed(1)}  `
            + `${(r.rate / r.chase).toFixed(2)}x${r.rate >= r.chase ? '   <- can never reach what it is hitting' : ''}`);
        }
        const broken = rows.filter((r) => r.rate >= r.chase);
        ok('the census is NON-EMPTY (a zero-weapon roster would make the next row vacuous)',
          rows.length === CHARACTER_IDS.length && rows.every((r) => r.chase > 0), `${rows.length} characters`);
        ok('🔴 at least one kit pushes its victim faster than it can chase — the refusal',
          broken.length > 0, broken.map((r) => `${r.id} ${(r.rate / r.chase).toFixed(2)}x`).join(' · '));

        // …and the same thing end-to-end through the real `stepMatch`, because a table is a
        // prediction and this is the measurement.
        const arena = arenaWith([], 4000, 4000);
        const st = S.createMatch(arena, 'waterbottle', 'hamburger');
        st.phase = 'playing';
        st.player.x = 2000; st.player.y = 2000; st.enemy.x = 2030; st.enemy.y = 2000;
        st.player.hp = 1e9; st.player.maxHp = 1e9; st.enemy.hp = 1e9; st.enemy.maxHp = 1e9;
        st.player.facing = { x: 1, y: 0 };
        for (let i = 0; i * 16.667 < 1100; i++) S.stepMatch(st, 16.667, NO_INPUT);
        const sep = Math.hypot(st.enemy.x - st.player.x, st.enemy.y - st.player.y);
        ok('🔴 a PASSIVE, IMMORTAL target is shoved OUT of melee range by the bot trying to close on it',
          sep > 30, `separation 30 -> ${sep.toFixed(2)} wu in 1,100 ms; `
          + 'sim.test.mjs §33(l)\'s KNOWN-BAD control ("the same fixture with no cast open CLOSES IN") goes red on this');
      }
    }
  } finally {
    rmTree(tree);
  }

  if (bad > 0) { console.log(`\n   ${bad} FAULT(S)`); process.exit(1); }
  console.log('\n   OK — the primitive is sound and the GLOBAL wiring is refused. See the header for the `rules.ts` field.');
}
