#!/usr/bin/env node
/**
 * RB_STAGE — one stager that reaches WEAPON fields *and* card `stats` in the same call.
 *
 * `stage_weapon.mjs` reaches `<char>.<Key>.<field>`; `stage_kit.mjs --stat` reaches
 * `<char>.<stat>`. A roster rebalance needs both in ONE staged tree (nerf a weapon,
 * re-derive the card bar it feeds), and neither stager can be chained because both copy
 * from `src/`, so the second would throw the first away. This is that union and nothing
 * else — it deliberately does not clone kits or replace whole weapon arrays.
 *
 *   node tools/tmp/rb_stage.mjs <outdir> burrito.Swarm.cooldown=4500 pizza.health=8
 *   node tools/tmp/rb_stage.mjs <outdir>                     # frozen, UNCHANGED control
 *
 * ⚠️ EVERY SUBSTITUTION MUST MATCH EXACTLY ONCE OR THIS EXITS NON-ZERO. A staged tree
 * that silently changed nothing produces a confident, entirely fictional "this candidate
 * does nothing" row — the most expensive failure mode an instrument has here
 * (`docs/LESSONS.md` §13). Zero pairs is a legitimate, load-bearing case: it stages the
 * frozen control a sweep compares against, so the candidate and the control are read
 * from the same snapshot of the tree rather than one of each.
 *
 * ⚠️ AND IT VERIFIES AGAINST THE PARSED MODULE, not against the regex's opinion of
 * itself: every applied pair is re-read out of `import(staged/rules.ts)` and compared to
 * the value asked for. `--selftest` proves that check FAILS on a known-bad by staging a
 * value the regex cannot reach.
 */
import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);

// ── selftest ────────────────────────────────────────────────────────────────
if (argv[0] === '--selftest') {
  const { execFileSync } = await import('node:child_process');
  const self = new URL(import.meta.url).pathname;
  let pass = 0, fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  const run = (args) => {
    try {
      const out = execFileSync(process.execPath, [self, ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, out };
    } catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; }
  };
  console.log('\n══ rb_stage SELFTEST ══');

  // 1. A frozen control changes nothing: the staged rules.ts is byte-identical to src.
  {
    const d = join(tmpdir(), `fa-rbstage-st-noop`);
    const r = run([d]);
    const a = readFileSync(`${ROOT}/src/game/rules.ts`, 'utf8');
    const b = readFileSync(`${d}/game/rules.ts`, 'utf8');
    ok('a zero-pair stage is byte-identical to src/game/rules.ts', r.code === 0 && a === b, `exit ${r.code}`);
    rmSync(d, { recursive: true, force: true });
  }
  // 2. A real weapon edit lands, and the PARSED module agrees.
  {
    const d = join(tmpdir(), `fa-rbstage-st-w`);
    const r = run([d, 'burrito.Swarm.cooldown=4500']);
    let got = null;
    try { got = (await import(`${d}/game/rules.ts`)).CHARACTERS.burrito.weapons.find((w) => w.key === 'Swarm').cooldown; } catch { /* reported below */ }
    ok('a weapon field edit lands and the parsed module reports it', r.code === 0 && got === 4500, `exit ${r.code} got ${got}`);
    rmSync(d, { recursive: true, force: true });
  }
  // 2b. A field on a MULTI-LINE weapon literal, and a field on a character's LAST weapon.
  //     Both are the cases the first bounded regex got wrong: Swarm wraps onto four lines,
  //     and the last weapon's scan can otherwise run past `],` into the NEXT character's
  //     `stats: { damage: … }` and rewrite a card bar while claiming to edit a weapon.
  {
    const d = join(tmpdir(), `fa-rbstage-st-multi`);
    const r = run([d, 'burrito.Swarm.pellets=3', 'pizza.Cheese.damage=9']);
    let pel = null, ch = null, nextStat = null;
    try {
      const M = await import(`${d}/game/rules.ts`);
      pel = M.CHARACTERS.burrito.weapons.find((w) => w.key === 'Swarm').pellets;
      ch = M.CHARACTERS.pizza.weapons.find((w) => w.key === 'Cheese').damage;
      nextStat = M.CHARACTERS.sushi.stats.damage;    // the character AFTER pizza in the file
    } catch { /* reported below */ }
    ok('a multi-line weapon field lands, and a LAST-weapon edit does not leak into the next character',
      r.code === 0 && pel === 3 && ch === 9 && nextStat === 9, `exit ${r.code} pellets ${pel} cheese ${ch} sushi.stats.damage ${nextStat}`);
    rmSync(d, { recursive: true, force: true });
  }
  // 3. A stat edit lands, and `maxHpFor` — a DERIVED read — moves with it. A stager that
  //    patched the comment above `stats` rather than `stats` itself would pass a string
  //    check and fail this one.
  {
    const d = join(tmpdir(), `fa-rbstage-st-s`);
    const r = run([d, 'pizza.health=8']);
    let hp = null, stat = null;
    try { const M = await import(`${d}/game/rules.ts`); stat = M.CHARACTERS.pizza.stats.health; hp = M.maxHpFor('pizza', 100); } catch { /* reported below */ }
    ok('a stat edit moves the DERIVED pool, not just the literal', r.code === 0 && stat === 8 && hp === 120, `exit ${r.code} stat ${stat} hp ${hp}`);
    rmSync(d, { recursive: true, force: true });
  }
  // 4. KNOWN-BAD: a target that does not exist must EXIT NON-ZERO, not stage silently.
  //    This is the assertion the whole tool exists for; without it a typo in a sweep row
  //    reads as "the candidate did nothing", which is a real answer here.
  {
    const d = join(tmpdir(), `fa-rbstage-st-bad`);
    const r = run([d, 'burrito.Nosuch.cooldown=4500']);
    ok('a weapon key that does not exist exits non-zero (known-bad)', r.code !== 0, `exit ${r.code}`);
    const r2 = run([d, 'burrito.Swarm.nosuchfield=4500']);
    ok('a weapon FIELD that does not exist exits non-zero (known-bad)', r2.code !== 0, `exit ${r2.code}`);
    const r3 = run([d, 'nosuchchar.health=8']);
    ok('a character that does not exist exits non-zero (known-bad)', r3.code !== 0, `exit ${r3.code}`);
    rmSync(d, { recursive: true, force: true });
  }
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ── stage ───────────────────────────────────────────────────────────────────
const [outdir, ...pairs] = argv;
if (!outdir) {
  console.error('usage: rb_stage.mjs <outdir> [<char>.<Key>.<field>=<v> | <char>.<stat>=<v> | KEY=VALUE ...]');
  process.exit(1);
}

rmSync(outdir, { recursive: true, force: true });
mkdirSync(`${outdir}/game`, { recursive: true });
mkdirSync(`${outdir}/arena`, { recursive: true });
for (const f of readdirSync(`${ROOT}/src/game`)) {
  if (f.endsWith('.ts')) copyFileSync(`${ROOT}/src/game/${f}`, `${outdir}/game/${f}`);
}
copyFileSync(`${ROOT}/src/arena/types.ts`, `${outdir}/arena/types.ts`);

let src = readFileSync(`${outdir}/game/rules.ts`, 'utf8');
const applied = [];

function subOnce(label, re, make) {
  const all = src.match(new RegExp(re.source, `${re.flags.replace('g', '')}g`));
  if (!all || all.length !== 1) {
    console.error(`rb_stage: "${label}" matched ${all ? all.length : 0} times — refusing to guess`);
    process.exit(2);
  }
  src = src.replace(re, make);
}

const STAT_FIELDS = new Set(['damage', 'health', 'speed']);

for (const pair of pairs) {
  const eq = pair.indexOf('=');
  if (eq < 0) { console.error(`rb_stage: "${pair}" is not KEY=VALUE`); process.exit(1); }
  const key = pair.slice(0, eq), val = pair.slice(eq + 1);
  const parts = key.split('.');

  // <char>.<WeaponKey>.<field>
  if (parts.length === 3) {
    const [id, wkey, field] = parts;
    // ⚠️ A WEAPON IS NOT ALWAYS ONE LINE. The first draft matched `key: '<k>',[^\n]*?`
    // and failed on `burrito.Swarm.pellets=3` — Swarm's literal wraps onto four lines, so
    // `pellets` sits on line 2 and the match found nothing. `refusing to guess` caught it
    // rather than staging silently, which is the whole point of that check.
    // The scan is bounded so it can never leave the weapon it started in: it may not
    // cross another `key: '` (the next weapon) nor the array's own `\n    ],` (the next
    // character's `stats: { damage: … }` is otherwise reachable from the LAST weapon).
    const re = new RegExp(`(\\n  ${id}: \\{[\\s\\S]*?key: '${wkey}',(?:(?!key: '|\\n    \\],)[\\s\\S])*?${field}: )([^,}\\n]+)`);
    subOnce(key, re, `$1${val}`);
    applied.push({ kind: 'weapon', id, wkey, field, val });
    continue;
  }

  // <char>.<stat>
  if (parts.length === 2 && STAT_FIELDS.has(parts[1])) {
    const [id, field] = parts;
    const re = new RegExp(`(\\n    id: '${id}',[\\s\\S]{0,400}?\\n    stats: \\{[^}]*?${field}: )(\\d+)`);
    subOnce(key, re, `$1${val}`);
    applied.push({ kind: 'stat', id, field, val });
    continue;
  }

  // KEY=VALUE / CONST.field=VALUE — `stage_rules.mjs`'s forms, unchanged.
  const re = parts.length === 1
    ? new RegExp(`^(export const ${parts[0]}\\s*=\\s*)([^;]+)(;)`, 'm')
    : new RegExp(`^(export const ${parts[0]} = \\{[\\s\\S]*?\\n  ${parts[1]}: )([^,\\n]+)(,)`, 'm');
  subOnce(key, re, `$1${val}$3`);
  applied.push({ kind: 'const', key, val });
}

writeFileSync(`${outdir}/game/rules.ts`, src);

// Confirm against the PARSED module, never the regex.
const M = await import(`${outdir}/game/rules.ts`);
for (const a of applied) {
  let got;
  if (a.kind === 'weapon') {
    const w = M.CHARACTERS[a.id]?.weapons.find((x) => x.key === a.wkey);
    if (!w) { console.error(`rb_stage: ${a.id} has no weapon ${a.wkey}`); process.exit(3); }
    got = w[a.field];
    if (got === undefined) { console.error(`rb_stage: ${a.id}.${a.wkey} has no field ${a.field}`); process.exit(3); }
  } else if (a.kind === 'stat') {
    got = M.CHARACTERS[a.id]?.stats?.[a.field];
    if (got === undefined) { console.error(`rb_stage: ${a.id} has no stat ${a.field}`); process.exit(3); }
  } else {
    got = a.key.includes('.') ? M[a.key.split('.')[0]]?.[a.key.split('.')[1]] : M[a.key];
  }
  if (String(got) !== String(a.val)) {
    console.error(`rb_stage: ${a.kind} ${JSON.stringify(a)} did NOT take — parsed module says ${got}`);
    process.exit(3);
  }
}
console.error(`staged ${outdir}: ${applied.length ? pairs.join(' · ') : 'UNCHANGED (frozen control)'}`);
