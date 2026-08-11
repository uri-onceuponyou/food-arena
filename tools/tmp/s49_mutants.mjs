/**
 * s49_mutants — THE KNOWN-BAD BATTERY FOR `DECISIONS §49a` AND `§49c`.
 *
 * ⚠️ **A GUARD THAT HAS NOT BEEN SHOWN TO FAIL ON THE BUG IT GUARDS AGAINST IS NOT A
 * GUARD** (`CLAUDE.md` #6). §49a inserted a rung into `sim.ts:resolveTimeout` and §49c
 * flattened the seat dial in `createMatchFromList`; both landed with new `sim.test.mjs`
 * rows, and every one of those rows passes just as well against a sim that never changed —
 * because the rung is INERT on every state real play can produce, and because the flat
 * dial is only visible above two seats, which nothing in `src/` seats.
 *
 * So each claim is re-asserted here against a DELIBERATELY WRONG sim: the six sim modules
 * copied out of the working tree with one literal source edit applied, exactly the
 * `conceal_lab.mjs:patchedSimDir` idiom. Every mutation must be CAUGHT. A mutation that is
 * missed is a row in `sim.test.mjs` that would not have noticed the defect it names.
 *
 * ⚠️ Each edit is required to have actually MATCHED. A control built on a replacement that
 * silently matched nothing passes for the wrong reason, which is the single most common way
 * an instrument in this repo has lied — so `applied` is asserted per edit, per mutant.
 *
 *   node tools/tmp/s49_mutants.mjs
 *
 * Node-only. No browser, no snapshot, no GPU.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/** The same six modules `conceal_lab`, `match-sim` and `roster_lab` each hardcode. */
const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   - ${name}${detail ? `  (${detail})` : ''}`); }
  else { fail++; failures.push(`${name}${detail ? `  (${detail})` : ''}`); console.log(`  FAIL - ${name}${detail ? `  (${detail})` : ''}`); }
}

function patchedSimDir(tag, edits) {
  const root = join(tmpdir(), `fa-s49-${tag}`);
  const dir = join(root, 'game');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, 'arena'), { recursive: true });
  for (const f of SIM_MODULES) writeFileSync(join(dir, f), readFileSync(`${ROOT}/src/game/${f}`, 'utf8'));
  writeFileSync(join(root, 'arena', 'types.ts'), readFileSync(`${ROOT}/src/arena/types.ts`, 'utf8'));
  const applied = [];
  for (const [file, from, to] of edits) {
    const before = readFileSync(join(dir, file), 'utf8');
    const after = before.replace(from, to);
    applied.push(after !== before);
    writeFileSync(join(dir, file), after);
  }
  return { dir, applied };
}

async function loadSim(dir) {
  const sim = await import(`${dir}/sim.ts`);
  const rules = await import(`${dir}/rules.ts`);
  return { createMatch: sim.createMatch, stepMatch: sim.stepMatch, RULES: rules };
}

const ARENA = {
  id: 's49-fixture',
  displayName: 'S49 Fixture',
  width: 3000,
  height: 3000,
  center: { x: 1500, y: 1500 },
  maxSafeRadius: 4000,
  playerSpawn: { x: 200, y: 200 },
  enemySpawn: { x: 2800, y: 2800 },
  cover: [],
  hazards: [],
  build: () => ({}),
};
const NO_INPUT = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
const RING = 400;
const ringSpawn = (i, n) => ({
  x: ARENA.center.x + RING * Math.cos((i / n) * Math.PI * 2),
  y: ARENA.center.y + RING * Math.sin((i / n) * Math.PI * 2),
});

/**
 * The six-seat whistle fixture from `sim.test.mjs` §27(c), rebuilt against an arbitrary
 * sim so a mutant can be handed the identical state. Everyone level on pool and on ground,
 * rooted, unable to attack, regen blocked — so the ONLY quantity that can separate them is
 * the death sheet.
 */
function whistleWinner(SIM, deaths) {
  const n = deaths.length;
  const state = SIM.createMatch(ARENA, deaths.map((_, i) => ({
    characterId: 'hamburger', spawn: ringSpawn(i, n),
  })));
  state.phase = 'playing';
  state.fighters.forEach((f, i) => {
    f.hp = 50; f.maxHp = 100;
    f.deaths = deaths[i];
    f.lastDamagedAt = state.elapsed;
    f.status.stunnedUntil = state.elapsed + 10_000;
    f.lastUsed = f.lastUsed.map(() => Infinity);
  });
  state.timeRemaining = 0;
  SIM.stepMatch(state, 16.667, NO_INPUT);
  return state.winnerId;
}

/** Two seats, hand-set on every rung. Mirrors §27(c)'s `timeoutWinner`. */
function duelWinner(SIM, { pHp, pMax, eHp, eMax, pOff, eOff, pDeaths = 0, eDeaths = 0 }) {
  const state = SIM.createMatch(ARENA, 'hamburger', 'hamburger');
  state.phase = 'playing';
  const { x: cx, y: cy } = ARENA.center;
  state.player.x = cx - pOff; state.player.y = cy;
  state.enemy.x = cx + eOff; state.enemy.y = cy;
  state.player.hp = pHp; state.player.maxHp = pMax;
  state.enemy.hp = eHp; state.enemy.maxHp = eMax;
  state.player.deaths = pDeaths; state.enemy.deaths = eDeaths;
  for (const f of state.fighters) {
    f.lastDamagedAt = state.elapsed;
    f.status.stunnedUntil = state.elapsed + 10_000;
    f.lastUsed = f.lastUsed.map(() => Infinity);
  }
  state.timeRemaining = 0;
  SIM.stepMatch(state, 16.667, NO_INPUT);
  return state.winnerId;
}

/** A real duel run to a knockout, returning the death sheet the kill path produced. */
function knockoutSheet(SIM) {
  const state = SIM.createMatch(ARENA, 'hamburger', 'donut');
  state.phase = 'playing';
  for (let i = 0; i < 4000 && state.phase !== 'ended'; i++) {
    SIM.stepMatch(state, 16.667, { move: { x: 1, y: 0.2 }, selectedWeapon: 0, attack: true });
  }
  return state.fighters.map((f) => f.deaths);
}

const LIVE = await loadSim(`${ROOT}/src/game`);
const { PLAYER_MAX_HP, ENEMY_MAX_HP, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY } = LIVE.RULES;

console.log('\n══ s49 MUTANTS ══  every §49a/§49c claim, re-asserted against a deliberately wrong sim');
console.log('   FLOOR: EXACT. Every mutation must be CAUGHT; a missed one is a guard that is not one.\n');

// ── 0. THE LIVE SIM IS THE POSITIVE CONTROL ─────────────────────────────────
// Without these the whole file could be measuring a broken fixture: if `whistleWinner`
// returned the same number for every sim, all five mutants below would be "caught".
console.log('0. the LIVE sim answers each fixture the way §49a/§49c say it should');
{
  ok('six seats: fewest deaths wins the whistle (slot 5, the cleanest sheet)',
    whistleWinner(LIVE, [3, 3, 2, 2, 1, 0]) === 5, `winnerId ${whistleWinner(LIVE, [3, 3, 2, 2, 1, 0])}`);
  ok('…mirrored, slot 0 wins — the rung reads deaths, not ids',
    whistleWinner(LIVE, [0, 1, 2, 2, 3, 3]) === 0);
  ok('…and an equal sheet falls through to the lower slot (rung 4)',
    whistleWinner(LIVE, [2, 2, 2, 2, 2, 2]) === 0);
  ok('two seats: rung 1 still outranks deaths',
    duelWinner(LIVE, { pHp: 60, pMax: 100, eHp: 30, eMax: 90, pOff: 100, eOff: 100, pDeaths: 3, eDeaths: 0 }) === 0);
  ok('two seats: rung 2 still outranks deaths',
    duelWinner(LIVE, { pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 300, pDeaths: 3, eDeaths: 0 }) === 0);
  ok('two seats: deaths outrank the slot',
    duelWinner(LIVE, { pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 100, pDeaths: 2, eDeaths: 1 }) === 1);
  const sheet = knockoutSheet(LIVE);
  ok('a real knockout writes exactly one death into the sheet',
    sheet.reduce((a, b) => a + b, 0) === 1, `[${sheet.join(',')}]`);
  const six = LIVE.createMatch(ARENA, [0, 1, 2, 3, 4, 5].map((i) => ({ characterId: 'donut', spawn: ringSpawn(i, 6) })));
  ok('§49c: above two seats every seat is on the same flat dial',
    six.fighters.every((f) => f.maxHp === six.fighters[0].maxHp && f.hitRadius === HIT_RADIUS_VS_PLAYER),
    six.fighters.map((f) => f.maxHp).join(','));
  const duel = LIVE.createMatch(ARENA, 'donut', 'donut');
  ok('…while the DUEL keeps the bot dial on slot 1 (AUTHORISED DEVIATION #9 stands)',
    duel.fighters[1].maxHp < duel.fighters[0].maxHp
    && duel.fighters[1].hitRadius === HIT_RADIUS_VS_ENEMY
    && duel.fighters[1].maxHp !== six.fighters[1].maxHp,
    `${duel.fighters[0].maxHp}/${duel.fighters[1].maxHp} vs flat ${six.fighters[1].maxHp}`);
  ok('…and the two role bases genuinely differ, so none of the above is vacuous',
    PLAYER_MAX_HP !== ENEMY_MAX_HP && HIT_RADIUS_VS_PLAYER !== HIT_RADIUS_VS_ENEMY);
}

// ── THE MUTANTS ─────────────────────────────────────────────────────────────
const RUNG3 = '    if (a.deaths !== b.deaths) return a.deaths - b.deaths; // rung 3: FEWEST DEATHS (§49a)\n';
const RUNG1 = `    const fa = hpFraction(a);
    const fb = hpFraction(b);
    if (fa !== fb) return fb - fa;`;

const MUTANTS = [
  {
    name: 'A. rung 3 DELETED — the tiebreak never reads a death sheet',
    edits: [['sim.ts', RUNG3, '']],
    caught: (SIM) => whistleWinner(SIM, [3, 3, 2, 2, 1, 0]) === 0,
    detail: (SIM) => `winnerId ${whistleWinner(SIM, [3, 3, 2, 2, 1, 0])} (live says 5)`,
    guards: 'sim.test.mjs §27(c) "at six seats the FEWEST DEATHS wins the whistle, not the lowest slot"',
  },
  {
    name: 'B. rung 3 hoisted ABOVE rung 2 — deaths outrank zone control',
    edits: [
      ['sim.ts', RUNG3, ''],
      ['sim.ts', '    const da = toCentre(a);', `${RUNG3}    const da = toCentre(a);`],
    ],
    caught: (SIM) => duelWinner(SIM, { pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 300, pDeaths: 3, eDeaths: 0 }) === 1,
    detail: (SIM) => `winnerId ${duelWinner(SIM, { pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 300, pDeaths: 3, eDeaths: 0 })} (live says 0)`,
    guards: 'sim.test.mjs §27(c) "rung 2 still outranks deaths"',
  },
  {
    name: 'C. rung 3 hoisted ABOVE rung 1 — deaths outrank the HP fraction',
    edits: [
      ['sim.ts', RUNG3, ''],
      ['sim.ts', RUNG1, `${RUNG3}${RUNG1}`],
    ],
    caught: (SIM) => duelWinner(SIM, { pHp: 60, pMax: 100, eHp: 30, eMax: 90, pOff: 100, eOff: 100, pDeaths: 3, eDeaths: 0 }) === 1,
    detail: (SIM) => `winnerId ${duelWinner(SIM, { pHp: 60, pMax: 100, eHp: 30, eMax: 90, pOff: 100, eOff: 100, pDeaths: 3, eDeaths: 0 })} (live says 0)`,
    guards: 'sim.test.mjs §27(c) "rung 1 still outranks deaths"',
  },
  {
    name: 'D. the rung reads `id` instead of `deaths` — a plausible transcription slip',
    edits: [['sim.ts', 'if (a.deaths !== b.deaths) return a.deaths - b.deaths;', 'if (a.id !== b.id) return a.id - b.id;']],
    caught: (SIM) => whistleWinner(SIM, [3, 3, 2, 2, 1, 0]) === 0,
    detail: (SIM) => `winnerId ${whistleWinner(SIM, [3, 3, 2, 2, 1, 0])} (live says 5)`,
    guards: 'sim.test.mjs §27(c) six-seat row + the "flipping ONLY eDeaths" known-bad',
  },
  {
    name: 'E. `deaths++` DROPPED from the kill path — the counter is 0 forever',
    edits: [['combat.ts', '    target.deaths++;\n', '']],
    caught: (SIM) => knockoutSheet(SIM).reduce((a, b) => a + b, 0) === 0,
    detail: (SIM) => `sheet [${knockoutSheet(SIM).join(',')}] (live has exactly one death)`,
    guards: 'sim.test.mjs §27(c) "a real knockout increments `deaths`, once, on the fighter that went down"',
  },
  {
    name: 'F. §49c REVERTED — every slot above 0 is dialled as "the enemy" again',
    edits: [['sim.ts', 'const seatIsBotOpponent = isBotDuel && !seatIsLocal;', 'const seatIsBotOpponent = !seatIsLocal;']],
    caught: (SIM) => {
      const six = SIM.createMatch(ARENA, [0, 1, 2, 3, 4, 5].map((i) => ({ characterId: 'donut', spawn: ringSpawn(i, 6) })));
      return six.fighters[1].maxHp !== six.fighters[0].maxHp || six.fighters[1].hitRadius !== HIT_RADIUS_VS_PLAYER;
    },
    detail: (SIM) => {
      const six = SIM.createMatch(ARENA, [0, 1, 2, 3, 4, 5].map((i) => ({ characterId: 'donut', spawn: ringSpawn(i, 6) })));
      return `pools [${six.fighters.map((f) => f.maxHp).join(',')}]`;
    },
    guards: 'sim.test.mjs §28(b) "above two seats NO slot is dialled by its index"',
  },
  {
    name: 'G. §49c OVER-APPLIED — the duel loses its bot dial too (DEVIATION #9 silently reversed)',
    edits: [['sim.ts', 'const seatIsBotOpponent = isBotDuel && !seatIsLocal;', 'const seatIsBotOpponent = false;']],
    caught: (SIM) => {
      const duel = SIM.createMatch(ARENA, 'donut', 'donut');
      return duel.fighters[1].maxHp === duel.fighters[0].maxHp
        || duel.fighters[1].hitRadius !== HIT_RADIUS_VS_ENEMY;
    },
    detail: (SIM) => {
      const duel = SIM.createMatch(ARENA, 'donut', 'donut');
      return `duel pools ${duel.fighters[0].maxHp}/${duel.fighters[1].maxHp}`;
    },
    guards: 'sim.test.mjs §28(b) "the DUEL keeps the bot-opponent dial on slot 1" — and `--bitid` itself',
  },
];

console.log('\n1. every mutant is CAUGHT, and every edit is proven to have matched');
for (const m of MUTANTS) {
  const { dir, applied } = patchedSimDir(m.name.slice(0, 1).toLowerCase(), m.edits);
  ok(`the patch for "${m.name}" actually landed (a no-op edit would fake this control)`,
    applied.every(Boolean), applied.map((a) => (a ? 'applied' : 'NO MATCH')).join(', '));
  if (!applied.every(Boolean)) continue;
  const SIM = await loadSim(dir);
  let detail = '';
  let caught = false;
  try { caught = m.caught(SIM); detail = m.detail(SIM); } catch (e) { detail = `threw: ${e.message}`; caught = true; }
  ok(`CAUGHT — ${m.name}`, caught, `${detail}; guards ${m.guards}`);
}

console.log(`\n   ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\n   FAILURES:');
  for (const f of failures) console.log(`     ${f}`);
  process.exit(1);
}
process.exit(0);
