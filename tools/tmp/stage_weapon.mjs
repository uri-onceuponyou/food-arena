#!/usr/bin/env node
/**
 * STAGE A PATCHED ROSTER — `tools/tmp/stage_rules.mjs` for WEAPON fields.
 *
 * `stage_rules.mjs` rewrites a top-level `export const NAME = value;` or a dotted field
 * of a const object whose fields are one per line. Every weapon in `CHARACTERS` is a
 * single-line object literal inside an array inside a record, so none of its fields can
 * be reached that way — and weapon damage/cooldown/range is exactly what a roster
 * balance sweep has to vary. Without this, the only way to sweep a weapon is to edit the
 * shared tree, which `docs/LESSONS.md` §5 forbids while peers are live.
 *
 *   node tools/tmp/stage_weapon.mjs <outdir> lollipop.Smash.damage=14 [more...]
 *   node tools/tmp/stage_weapon.mjs <outdir> lollipop.Giant.cooldown=6000 STUN_GRACE_MS=400
 *
 * A bare `KEY=VALUE` (no dots, or a dotted CONST.field) is forwarded to the same
 * substitution `stage_rules.mjs` uses, so one tool can stage a mixed change.
 *
 * ⚠️ It FAILS LOUDLY if a target does not match exactly once. A sweep that silently
 * changes nothing produces a clean, confident, entirely fictional "no effect" row — the
 * single most expensive failure mode an instrument has on this project
 * (`docs/LESSONS.md` §13).
 *
 * `--verify` re-imports the staged rules and prints the value it actually landed on, so
 * the substitution is confirmed against the parsed module rather than the regex's own
 * opinion of itself.
 */
import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2).filter((a) => a !== '--verify');
const VERIFY = process.argv.includes('--verify');
const [outdir, ...pairs] = argv;
if (!outdir) {
  console.error('usage: stage_weapon.mjs <outdir> [<char>.<WeaponKey>.<field>=<value> | KEY=VALUE ...]');
  process.exit(1);
}
// Zero pairs is legitimate and load-bearing: it stages an UNCHANGED frozen copy of the
// tree, which is what a sweep's control row has to be. Measuring the candidate against a
// snapshot and the baseline against the live tree would let a peer's save land on one
// side of the comparison and not the other (docs/LESSONS.md §5).

rmSync(outdir, { recursive: true, force: true });
mkdirSync(`${outdir}/game`, { recursive: true });
mkdirSync(`${outdir}/arena`, { recursive: true });
for (const f of readdirSync(`${ROOT}/src/game`)) {
  if (f.endsWith('.ts')) copyFileSync(`${ROOT}/src/game/${f}`, `${outdir}/game/${f}`);
}
copyFileSync(`${ROOT}/src/arena/types.ts`, `${outdir}/arena/types.ts`);

let src = readFileSync(`${outdir}/game/rules.ts`, 'utf8');
const applied = [];

for (const pair of pairs) {
  const eq = pair.indexOf('=');
  const key = pair.slice(0, eq);
  const val = pair.slice(eq + 1);
  const parts = key.split('.');

  if (parts.length === 3) {
    // <character>.<WeaponKey>.<field> — locate the character's block, then the one
    // weapon line inside it carrying `key: '<WeaponKey>'`, then the field on that line.
    const [charId, wkey, field] = parts;
    const blockRe = new RegExp(`^  ${charId}: \\{[\\s\\S]*?\\n  \\},$`, 'm');
    const block = src.match(blockRe);
    if (!block) { console.error(`stage_weapon: no character block for "${charId}"`); process.exit(2); }
    const lines = block[0].split('\n');
    const idx = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.includes(`key: '${wkey}'`));
    if (idx.length !== 1) {
      console.error(`stage_weapon: "${charId}.${wkey}" matched ${idx.length} weapon lines — refusing to guess`);
      process.exit(2);
    }
    const line = idx[0].l;
    // `damage:` must not also match `healAmount:`/`damageBoost:` — anchor on a word
    // boundary preceded by `{ ` or `, `.
    const fieldRe = new RegExp(`([{,]\\s*)${field}:\\s*([^,}]+)`);
    if (!fieldRe.test(line)) {
      console.error(`stage_weapon: "${charId}.${wkey}" has no field "${field}" on its line:\n  ${line.trim()}`);
      process.exit(2);
    }
    const before = line.match(fieldRe)[2].trim();
    const newLine = line.replace(fieldRe, `$1${field}: ${val}`);
    const newBlock = block[0].split('\n').map((l, i) => (i === idx[0].i ? newLine : l)).join('\n');
    src = src.replace(block[0], newBlock);
    applied.push(`${key}: ${before} -> ${val}`);
  } else {
    // Verbatim from stage_rules.mjs, so a mixed sweep behaves identically.
    let re;
    if (key.includes('.')) {
      const [, field] = key.split('.');
      re = new RegExp(`^(\\s*${field}:\\s*)([^,\\n]+)(,?)$`, 'm');
    } else {
      re = new RegExp(`^(export const ${key}\\s*=\\s*)([^;]+)(;)`, 'm');
    }
    const hits = src.match(new RegExp(re.source, `${re.flags}g`));
    if (!hits || hits.length !== 1) {
      console.error(`stage_weapon: "${key}" matched ${hits ? hits.length : 0} times — refusing to guess`);
      process.exit(2);
    }
    src = src.replace(re, `$1${val}$3`);
    applied.push(`${key} -> ${val}`);
  }
}

writeFileSync(`${outdir}/game/rules.ts`, src);
console.error(`staged ${outdir}: ${applied.join(' · ')}`);

if (VERIFY) {
  const R = await import(`${outdir}/game/rules.ts`);
  for (const pair of pairs) {
    const key = pair.slice(0, pair.indexOf('='));
    const parts = key.split('.');
    if (parts.length === 3) {
      const w = R.CHARACTERS[parts[0]].weapons.find((x) => x.key === parts[1]);
      console.error(`  verified ${key} = ${JSON.stringify(w?.[parts[2]])}`);
    } else if (parts.length === 2) {
      console.error(`  verified ${key} = ${JSON.stringify(R[parts[0]][parts[1]])}`);
    } else {
      console.error(`  verified ${key} = ${JSON.stringify(R[key])}`);
    }
  }
}
