#!/usr/bin/env node
/**
 * LK_ARM — stage the ATTACK-LOCKOUT arm into a detached worktree and PROVE the staging
 * landed, BEHAVIOURALLY, before anything is measured on it.
 *
 * ── WHY THIS EXISTS RATHER THAN `tools/tmp/u6_arm.mjs` ──────────────────────
 *
 * The brief said *"`u6_arm.mjs` already verifies a staged edit through the module loader
 * and refuses an arm whose patch did not land — reuse it."* **It cannot stage this arm,
 * and that is a fact about the tool rather than a complaint:** `u6_arm` is a `rules.ts`
 * *weapon-field* stager end to end — `setWeaponField()` anchors on `key: '<k>',` inside a
 * `defineCharacter` block, and its verification is `castMap()`, which reads
 * `w.castMs ?? 0` for every weapon. `DECISIONS §78`'s change is a **control-flow term in
 * `combat.ts:attemptAttack`**; it moves no field, so `castMap` is bit-identical across
 * both arms and `u6_arm`'s "STAGING FAILED" check would pass on an arm that never landed.
 *
 * So the DISCIPLINE is reused and the mechanism is not:
 *
 *   u6_arm                          lk_arm
 *   ------------------------------  ------------------------------------------------
 *   exactly one textual match       the file is COPIED whole, so there is no regex to miss
 *   re-import, assert the FIELD     re-import, assert the BEHAVIOUR: a mid-cast press of
 *     reads back as asked             a castless weapon returns true (feature) / false (base)
 *   every other castMs unchanged    every other castMs unchanged (checked here too, because
 *                                     an arm that also moved a weapon is not one variable)
 *
 * 🚨 **THE FAILURE THIS REFUSES IS THE SAME ONE.** An arm whose edit did not land measures
 * as "the change did nothing", which is a normal outcome here and the one nobody re-checks
 * (`AGENT-BRIEF` §3). The probe below is run on BOTH arms and the two must DISAGREE; a
 * silently-missed copy makes them agree and this exits 1.
 *
 *   node tools/tmp/lk_arm.mjs --selftest
 *   node tools/tmp/lk_arm.mjs --dir /tmp/fa-lk-feat --ref 06e4e3e \
 *        --file src/game/combat.ts --expect open
 *   node tools/tmp/lk_arm.mjs --dir /tmp/fa-lk-base --ref 06e4e3e --expect lockout
 *   node tools/tmp/lk_arm.mjs --probe /tmp/fa-lk-feat        # just read the arm back
 */
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const args = (() => {
  const o = { file: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    const v = n === undefined || n.startsWith('--') ? true : (i++, n);
    if (a === '--file') o.file.push(v); else o[a.slice(2)] = v;
  }
  return o;
})();

/**
 * ── THE PROBE, RUN IN A CHILD AGAINST THE ARM'S OWN MODULES ─────────────────
 *
 * It answers four questions in one child process, all through `import()` of the tree being
 * measured, never by reading its text:
 *
 *   lockout      does a mid-cast press of a CASTLESS weapon fire?  (the arm's identity)
 *   secondCast   does a mid-cast press of the CAST weapon fire?    (must be false in BOTH
 *                arms — the half of the old gate that is KEPT)
 *   cancelled    did the mid-cast press cancel the wind-up?        (must be false in BOTH)
 *   castMap      every weapon's `castMs`                           (one variable, not two)
 *
 * ⚠️ The castless slot is FOUND, never typed. Writing `0` would keep this passing after a
 * roster edit moved Water Bottle's weapon order, and the probe would then be pressing the
 * cast weapon while reporting on a castless one.
 */
const PROBE = (dir) => `
import { createMatch } from '${dir}/src/game/sim.ts';
import { attemptAttack } from '${dir}/src/game/combat.ts';
import { CHARACTERS, CHARACTER_IDS } from '${dir}/src/game/rules.ts';

const arena = {
  id: 'lk-arm', displayName: 'lk', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 3000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 3800, y: 3800 },
  cover: [], hazards: [], build() { return {}; },
};

const castChar = CHARACTER_IDS.find((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0));
if (!castChar) { console.log(JSON.stringify({ error: 'no cast weapon on the roster — the probe is vacuous' })); process.exit(0); }
const ws = CHARACTERS[castChar].weapons;
const castI = ws.findIndex((w) => (w.castMs ?? 0) > 0);
const plainI = ws.findIndex((w) => (w.castMs ?? 0) === 0);

const st = createMatch(arena, castChar, 'donut');
st.phase = 'playing';
const f = st.fighters[0];
f.x = 2000; f.y = 2000; f.facing = { x: 1, y: 0 };
st.fighters[1].x = 2020; st.fighters[1].y = 2000;

const evs = [];
const opened = attemptAttack(st, f, castI, evs);
const resolvesAt = f.cast ? f.cast.resolvesAt : null;
st.elapsed += 200;                       // mid-cast, well before resolvesAt
const plain = attemptAttack(st, f, plainI, evs);
const second = attemptAttack(st, f, castI, evs);

const castMap = {};
for (const id of CHARACTER_IDS) for (const w of CHARACTERS[id].weapons) castMap[id + '.' + w.key] = w.castMs ?? 0;

console.log(JSON.stringify({
  char: castChar, castI, plainI, opened,
  midCastPlainPress: plain,
  midCastSecondCastPress: second,
  castStillOpen: f.cast !== null,
  resolvesAtHeld: f.cast !== null && f.cast.resolvesAt === resolvesAt,
  fired: evs.filter((e) => e.type === 'weapon-fired').map((e) => e.weaponKey),
  castMap,
}));
`;

function probe(dir) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', PROBE(dir)],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(out);
}

/** `open` = the lockout is gone (a castless press fires mid-cast). `lockout` = it is there. */
const identityOf = (p) => (p.midCastPlainPress ? 'open' : 'lockout');

// ═══════════════════════════════════════════════════════════════════════════
// --selftest — a stager that cannot report a MISSED patch is worthless
// ═══════════════════════════════════════════════════════════════════════════
if (args.selftest) {
  const BASE = String(args.base ?? '/tmp/fa-lk-base');
  const FEAT = String(args.feat ?? '/tmp/fa-lk-feat');
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log(`\n══ lk_arm SELFTEST ══  base ${BASE}\n                       feat ${FEAT}`);
  for (const d of [BASE, FEAT]) if (!existsSync(`${d}/src/game/combat.ts`)) { console.error(`no worktree at ${d}`); process.exit(1); }

  const b = probe(BASE);
  const f = probe(FEAT);
  ok('the probe found a cast weapon at all — it is not measuring an empty roster', !b.error && b.castI >= 0, `${b.char} slot ${b.castI}`);
  ok('…and a DISTINCT castless slot to press mid-cast', b.plainI >= 0 && b.plainI !== b.castI, `plain slot ${b.plainI}`);
  ok('the wind-up actually opened in both arms — nothing below is measuring a no-op', b.opened && f.opened && b.castStillOpen);

  ok('BASE arm reads `lockout`', identityOf(b) === 'lockout', JSON.stringify(b.fired));
  ok('FEAT arm reads `open`', identityOf(f) === 'open', JSON.stringify(f.fired));
  ok('🚨 KNOWN-BAD (the whole point): the two arms DISAGREE — a copy that silently missed would make them agree',
    identityOf(b) !== identityOf(f), `${identityOf(b)} vs ${identityOf(f)}`);

  ok('NEITHER arm allows a SECOND cast — the kept half of the old gate',
    b.midCastSecondCastPress === false && f.midCastSecondCastPress === false);
  ok('NEITHER arm lets a mid-cast press CANCEL the wind-up, and `resolvesAt` is untouched',
    b.castStillOpen && f.castStillOpen && b.resolvesAtHeld && f.resolvesAtHeld);
  ok('ONE VARIABLE: every weapon\'s `castMs` is identical across the two arms',
    JSON.stringify(b.castMap) === JSON.stringify(f.castMap));

  // A self-pair. The base tree against itself must read the same identity twice — a probe
  // that returned a different answer on two reads of one tree would make every row above
  // an accident.
  ok('SELF-PAIR: the base tree probed twice reads the same identity', identityOf(probe(BASE)) === identityOf(b));

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

if (args.probe) {
  const p = probe(String(args.probe));
  console.log(JSON.stringify({ ...p, identity: identityOf(p), castMap: undefined }, null, 2));
  process.exit(0);
}

const DIR = String(args.dir ?? '');
if (!existsSync(`${DIR}/src/game/combat.ts`)) { console.error(`no worktree at ${DIR}`); process.exit(1); }
const REF = String(args.ref ?? 'HEAD');

// Restore first, so arms never stack silently (u6_arm's rule, and it is the right one).
execFileSync('git', ['-C', DIR, 'checkout', '--detach', REF], { stdio: 'inherit' });
execFileSync('git', ['-C', DIR, 'checkout', '--', 'src/game'], { stdio: 'inherit' });

for (const rel of args.file) {
  const src = `${ROOT}/${rel}`;
  if (!existsSync(src)) { console.error(`no such source file ${src}`); process.exit(1); }
  copyFileSync(src, `${DIR}/${rel}`);
  console.log(`copied ${rel}  (${readFileSync(src, 'utf8').split('\n').length} lines)`);
}

const p = probe(DIR);
const id = identityOf(p);
console.log(`arm ${DIR} @ ${REF}: identity=${id} · opened=${p.opened} · midCastPlain=${p.midCastPlainPress} · secondCast=${p.midCastSecondCastPress} · castStillOpen=${p.castStillOpen} · fired=[${p.fired.join(', ')}]`);
if (args.expect && id !== String(args.expect)) {
  console.error(`STAGING FAILED: arm reads '${id}', asked for '${args.expect}'`);
  process.exit(1);
}
