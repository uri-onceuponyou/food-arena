#!/usr/bin/env node
/**
 * STAGE A WHOLE KIT — `stage_weapon.mjs` reaches one FIELD of one weapon; this reaches
 * the whole `weapons: [...]` array, plus `stats` and `hasTrail`.
 *
 * Two jobs, and the first is the important one:
 *
 *   --clone src:dst    copy `src`'s stats, hasTrail and entire weapon list onto `dst`.
 *
 * ── Why a cloner is a MEASUREMENT tool and not a convenience ────────────────
 *
 * `kit_lab.mjs` claims to measure how different two characters are. The only way to know
 * whether it can is to hand it two characters that are KNOWN to be identical and check it
 * says so — `docs/LESSONS.md` §13, "validate the instrument against a known input before
 * believing it on an unknown one". A split-half self-comparison gives the noise floor; a
 * real clone, played through the real sim against the real other nine opponents, is the
 * end-to-end version and it exercises the whole pipeline rather than the arithmetic.
 *
 *   --weapons <char>=<file>   replace `<char>`'s weapon array with the body in <file>
 *                             (the lines between the brackets, indented as in rules.ts)
 *
 * Anything else of the form KEY=VALUE, or CONST.field=VALUE, is forwarded to the same
 * top-level substitution `stage_rules.mjs`/`stage_weapon.mjs` use.
 *
 * ⚠️ Every substitution must match EXACTLY ONCE or the stager exits non-zero. A staged
 * tree that silently changed nothing produces a confident, entirely fictional "this
 * candidate does nothing" row, which is the most expensive failure mode an instrument on
 * this project has.
 */
import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const outdir = argv.find((a) => !a.startsWith('--') && !a.includes('='));
if (!outdir) {
  console.error('usage: stage_kit.mjs <outdir> [--clone src:dst] [--weapons char=file] [KEY=VALUE ...]');
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

function once(label, re) {
  const hits = src.match(new RegExp(re.source, `${re.flags.replace('g', '')}g`));
  if (!hits || hits.length !== 1) {
    console.error(`stage_kit: "${label}" matched ${hits ? hits.length : 0} times — refusing to guess`);
    process.exit(2);
  }
  return src.match(re);
}

/** The `weapons: [ ... ],` block of one character. `\n    ],` at four spaces closes it;
 *  nested `comboParts` closes at eight, and a weapon object at six, so this is unique. */
const weaponsRe = (id) => new RegExp(`(\\n  ${id}: \\{[\\s\\S]*?\\n    weapons: \\[\\n)([\\s\\S]*?)(\\n    \\],)`);
/** The one line carrying `stats` and `hasTrail`. */
const vitalsRe = (id) => new RegExp(`(\\n    id: '${id}',[\\s\\S]{0,400}?\\n    stats: )(\\{ damage: \\d+, health: \\d+, speed: \\d+ \\}, hasTrail: (?:true|false),)`);

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];

  if (a === '--clone') {
    const [srcId, dstId] = String(argv[++i]).split(':');
    const sw = once(`${srcId}.weapons`, weaponsRe(srcId));
    const sv = once(`${srcId}.stats`, vitalsRe(srcId));
    once(`${dstId}.weapons`, weaponsRe(dstId));
    once(`${dstId}.stats`, vitalsRe(dstId));
    src = src.replace(weaponsRe(dstId), (_m, pre, _body, post) => `${pre}${sw[2]}${post}`);
    src = src.replace(vitalsRe(dstId), (_m, pre) => `${pre}${sv[2]}`);
    applied.push(`clone ${srcId} -> ${dstId}`);
    continue;
  }

  if (a === '--stat') {
    // --stat hotdog.health=8 — the one lever that pays a kit change back in power without
    // touching the kit, and the only one this project has measured to work (speed is inert).
    const spec = String(argv[++i]);
    const [lhs, val] = spec.split('=');
    const [id, field] = lhs.split('.');
    const m = once(`${id}.stats`, vitalsRe(id));
    const replaced = m[2].replace(new RegExp(`${field}: \\d+`), `${field}: ${val}`);
    if (replaced === m[2]) { console.error(`stage_kit: ${id} has no stat "${field}"`); process.exit(2); }
    src = src.replace(vitalsRe(id), (_x, pre) => `${pre}${replaced}`);
    applied.push(`${lhs}=${val}`);
    continue;
  }

  if (a === '--weapons') {
    const spec = String(argv[++i]);
    const eq = spec.indexOf('=');
    const id = spec.slice(0, eq);
    const body = readFileSync(spec.slice(eq + 1), 'utf8').replace(/\n+$/, '');
    once(`${id}.weapons`, weaponsRe(id));
    src = src.replace(weaponsRe(id), (_m, pre, _b, post) => `${pre}${body}${post}`);
    applied.push(`weapons ${id} <- ${spec.slice(eq + 1)}`);
    continue;
  }

  if (a.startsWith('--') || !a.includes('=')) continue;

  // KEY=VALUE / CONST.field=VALUE, same forms stage_rules.mjs accepts.
  const eq = a.indexOf('=');
  const key = a.slice(0, eq), val = a.slice(eq + 1);
  const parts = key.split('.');
  const re = parts.length === 1
    ? new RegExp(`^(export const ${parts[0]}\\s*=\\s*)([^;]+)(;)`, 'm')
    : new RegExp(`^(export const ${parts[0]} = \\{[\\s\\S]*?\\n  ${parts[1]}: )([^,\\n]+)(,)`, 'm');
  once(key, re);
  src = src.replace(re, `$1${val}$3`);
  applied.push(`${key}=${val}`);
}

writeFileSync(`${outdir}/game/rules.ts`, src);

// Confirm against the PARSED module, not the regex's opinion of itself.
const staged = await import(`${outdir}/game/rules.ts`);
console.error(`staged ${outdir}: ${applied.length ? applied.join(' · ') : 'UNCHANGED (frozen copy)'}`);
for (const a of applied) {
  if (!a.startsWith('clone ')) continue;
  const [, s, , d] = a.split(' ');
  const same = JSON.stringify(staged.CHARACTERS[s].weapons) === JSON.stringify(staged.CHARACTERS[d].weapons)
    && JSON.stringify(staged.CHARACTERS[s].stats) === JSON.stringify(staged.CHARACTERS[d].stats)
    && staged.CHARACTERS[s].hasTrail === staged.CHARACTERS[d].hasTrail;
  if (!same) { console.error(`stage_kit: clone ${s} -> ${d} did NOT take`); process.exit(3); }
  console.error(`  verified: ${d} now has ${s}'s exact kit (${staged.CHARACTERS[d].weapons.length} weapons, stats ${JSON.stringify(staged.CHARACTERS[d].stats)})`);
}
