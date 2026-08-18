#!/usr/bin/env node
/**
 * LK_DODGE — what does dropping the attack lockout do to THE DODGE?
 *
 * `DECISIONS §78` priced the lockout in win rate (+19.7 pp to Water Bottle) and did not
 * price it in counterplay. `sim.test.mjs` §33's stated acceptance bar is Uri's own
 * *"a telegraph you can dodge"*, so the win-rate number alone cannot say whether the
 * change is the one he asked for. This tool measures the other half on the SAME fixture
 * §33(n) uses — the slowest human in the roster running directly away from a hand-opened
 * `waterbottle.Mega` — and decomposes WHY the dodge succeeds or fails.
 *
 * ── FOUR ARMS, ONE VARIABLE EACH ────────────────────────────────────────────
 *
 *   lockout    the caster may press nothing else            (the shipped rule at 06e4e3e)
 *   silent     the lockout is gone, but the caster's other  (the wind-up's own geometry,
 *              slots are held on cooldown by the fixture     isolated — the control)
 *   noeffect   the caster may press only weapons carrying   (the priced middle option)
 *              no `effect` — no slow, no stun
 *   open       the caster may press everything              (the change as shipped)
 *   nocast     NO wind-up is opened at all and the caster    (the control that asks whether the
 *              presses freely for the same span of time       wind-up is involved AT ALL)
 *
 * `silent` is the CONTROL and it is not decoration: if `open` fails the dodge and `silent`
 * passes it on the same tree, the cause is the caster's status weapons and not the removal
 * of the lockout per se — which is a different finding with a different fix.
 *
 * 🚨 EVERY ARM IS RUN ON THE **SAME TREE**, so nothing here can be explained by an arm
 * that did not stage. `lk_arm.mjs` does the cross-tree staging; this varies behaviour by
 * suppressing presses inside one fixture, which is why the `lockout` arm is reproduced
 * here rather than read off the base worktree — it is the same code path, so the four
 * numbers are commensurable.
 *
 *   node tools/tmp/lk_dodge.mjs --selftest
 *   node tools/tmp/lk_dodge.mjs --sim /tmp/fa-lk-feat/src/game
 */
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const { attemptAttack } = await import(`${SIM_DIR}/combat.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH, PLAYER_SPEED, speedFor } = RULES;

const TICK = 16.667;

const arena = {
  id: 'lk-dodge', displayName: 'lk', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 3000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 3800, y: 3800 },
  cover: [], hazards: [], build() { return {}; },
};

/**
 * The caster and the runner are DERIVED, never typed. The caster is whoever carries a
 * wind-up; the runner is the SLOWEST human in the roster, which is the worst case for
 * escaping and therefore the hardest version of "it got away".
 */
const CASTER = CHARACTER_IDS.find((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0));
const RUNNER = [...CHARACTER_IDS].sort((a, b) => speedFor(a, PLAYER_SPEED) - speedFor(b, PLAYER_SPEED))[0];
if (!CASTER) { console.error('no weapon on the roster carries a castMs — this tool is vacuous'); process.exit(1); }
const CW = CHARACTERS[CASTER].weapons;
const CAST_I = CW.findIndex((w) => (w.castMs ?? 0) > 0);
const MEGA = CW[CAST_I];

/** Slots the fixture holds shut, per arm. */
const SUPPRESS = {
  lockout: CW.map((_, i) => i !== CAST_I),                                   // everything else
  silent: CW.map((_, i) => i !== CAST_I),                                    // same, on the open tree
  noeffect: CW.map((w, i) => i !== CAST_I && (w.effect ?? 'none') !== 'none'),// only the status slots
  open: CW.map(() => false),                                                 // nothing
};

/**
 * One run. `move` is the runner's input direction; `arm` names which of the caster's slots
 * the fixture holds shut by stamping `lastUsed` into the future — `now - lastUsed < cooldown`
 * is then true forever, which is the same refusal the cooldown gate already makes and adds
 * no new code path to the sim.
 */
function run(arm, move, sim = { createMatch, stepMatch, attemptAttack }, openCast = true) {
  const state = sim.createMatch(arena, RUNNER, CASTER);
  state.phase = 'playing';
  const caster = state.fighters[1];
  const runner = state.fighters[0];
  caster.x = 2000; caster.y = 2000; caster.facing = { x: 1, y: 0 };
  runner.x = 2020; runner.y = 2000;
  runner.hp = 1e9; runner.maxHp = 1e9;
  caster.hp = 1e9; caster.maxHp = 1e9;
  for (let i = 0; i < caster.lastUsed.length; i++) if (SUPPRESS[arm][i]) caster.lastUsed[i] = 1e9;

  const evs = [];
  const opened = openCast ? sim.attemptAttack(state, caster, CAST_I, evs) : false;
  if (!openCast) caster.lastUsed[CAST_I] = 1e9;   // and it may not open one later either
  const input = { move, selectedWeapon: 0, attack: false };
  const fired = [];
  let megaDealt = 0;
  let otherDealt = 0;
  let slowTicks = 0;
  let stunTicks = 0;
  const tally = (list) => {
    for (const e of list) {
      if (e.type === 'weapon-fired' && e.fighterId === caster.id) fired.push(e.weaponKey);
      if (e.type === 'hit-landed' && e.source?.kind === 'weapon') {
        if (e.source.weaponKey === MEGA.key) megaDealt += e.amount; else otherDealt += e.amount;
      }
    }
  };
  tally(evs);
  // The cast arms run until the wind-up resolves; the `nocast` control runs the SAME number
  // of ticks, so the four separations are read at the same instant of match time.
  const BUDGET = Math.ceil(MEGA.castMs / TICK);
  for (let i = 0; i < BUDGET && (openCast ? caster.cast !== null : true); i++) {
    tally(stepMatch(state, TICK, input));
    if (state.elapsed < runner.status.slowedUntil) slowTicks++;
    if (state.elapsed < runner.status.stunnedUntil) stunTicks++;
  }
  tally(stepMatch(state, TICK, input));
  return {
    opened,
    megaDealt,
    otherDealt,
    sep: Math.hypot(runner.x - caster.x, runner.y - caster.y),
    fired,
    slowMs: slowTicks * TICK,
    stunMs: stunTicks * TICK,
    escaped: megaDealt === 0,
  };
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log(`\n══ lk_dodge SELFTEST ══  sim ${SIM_DIR}`);
  ok('the fixture found a caster and a distinct runner', CASTER && RUNNER && CASTER !== RUNNER, `${CASTER} vs ${RUNNER}`);
  ok('…and the caster carries a real wind-up', (MEGA.castMs ?? 0) > 0, `${MEGA.key} ${MEGA.castMs}ms`);
  ok('…and at least one of the caster\'s OTHER weapons carries a status effect — `noeffect` is not `open` by accident',
    CW.some((w, i) => i !== CAST_I && (w.effect ?? 'none') !== 'none'),
    CW.map((w, i) => `${w.key}:${i === CAST_I ? 'CAST' : (w.effect ?? 'none')}`).join(' '));
  // KNOWN-BAD: the suppression must actually suppress. The `lockout` arm holds every other
  // slot shut, so the caster can fire NOTHING but the wind-up — if the fixture's stamping
  // did not work, `fired` would carry other keys and every row below would be measuring the
  // wrong arm while looking fine.
  const l = run('lockout', { x: 1, y: 0 });
  ok('KNOWN-BAD: with every other slot held shut the caster fires ONLY its wind-up',
    l.fired.filter((k) => k !== MEGA.key).length === 0, `fired [${l.fired.join(', ')}]`);
  const o = run('open', { x: 1, y: 0 });
  ok('…and with nothing held shut it fires MORE than its wind-up — the suppression is the variable',
    o.fired.filter((k) => k !== MEGA.key).length > 0, `fired [${o.fired.join(', ')}]`);
  ok('a STANDING target is hit in every arm — the fixture is not measuring a broken resolve',
    ['lockout', 'silent', 'noeffect', 'open'].every((a) => run(a, { x: 0, y: 0 }).megaDealt > 0));
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

const boundary = (REACH.meleeHeavy / (speedFor(RUNNER, PLAYER_SPEED) * 1000)) * 1000;
console.log(`\n══ LK_DODGE ══  sim ${SIM_DIR}`);
console.log(`   caster ${CASTER}.${MEGA.key} castMs ${MEGA.castMs} · reach ${REACH.meleeHeavy} · runner ${RUNNER} @ ${(speedFor(RUNNER, PLAYER_SPEED) * 1000).toFixed(2)} wu/s`);
console.log(`   unslowed escape boundary ${boundary.toFixed(2)} ms — the wind-up is ${MEGA.castMs > boundary ? 'ABOVE' : 'BELOW'} it\n`);
console.log(`   ${'arm'.padEnd(10)}${'megaDmg'.padStart(9)}${'otherDmg'.padStart(10)}${'sep@resolve'.padStart(13)}${'slowed'.padStart(9)}${'stunned'.padStart(9)}   fired during the wind-up`);
for (const arm of ['lockout', 'silent', 'noeffect', 'open', 'nocast']) {
  const r = run(arm === 'nocast' ? 'open' : arm, { x: 1, y: 0 },
    { createMatch, stepMatch, attemptAttack }, arm !== 'nocast');
  const other = r.fired.filter((k) => k !== MEGA.key);
  console.log(`   ${arm.padEnd(10)}${String(r.megaDealt).padStart(9)}${String(r.otherDealt).padStart(10)}${r.sep.toFixed(2).padStart(13)}${`${r.slowMs.toFixed(0)}ms`.padStart(9)}${`${r.stunMs.toFixed(0)}ms`.padStart(9)}   [${other.join(', ')}]  ${r.escaped ? 'ESCAPED' : '** HIT **'}`);
}
console.log('');
