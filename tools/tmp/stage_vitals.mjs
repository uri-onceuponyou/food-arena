#!/usr/bin/env node
/**
 * STAGE A CANDIDATE ROSTER — `stage_rules.mjs` for the per-character `stats` block.
 *
 * `stage_rules.mjs` substitutes a top-level export or a dotted field of a `const` object,
 * and refuses to guess when a key matches more than once. `stats.health` matches ELEVEN
 * times — once per character — so it cannot reach the roster at all, and the roster is
 * exactly what has to be swept now that `stats` drives the sim (`rules.ts` AUTHORISED
 * DEVIATION #10).
 *
 *   node tools/tmp/stage_vitals.mjs <outdir> <candidate.json>
 *
 * The JSON is a full, explicit table — no defaults and no merge with the shipped roster:
 *
 *   {
 *     "HEALTH_PER_STAT": 0.14,          // optional; omit to keep the shipped constant
 *     "SPEED_PER_STAT": 0.05,           // optional
 *     "SPEED_TOP_STAT": 8,              // optional
 *     "stats": { "hamburger": { "health": 6, "speed": 5 }, ... }   // all 11, or none
 *   }
 *
 * `damage` is deliberately NOT settable: it is DERIVED from the weapon table by
 * `rules.ts:damageStatFor`, and a sweep that could set it by hand would be sweeping the
 * card's honesty rather than the game. The stager recomputes it and writes it in, so a
 * staged tree is always self-consistent — a candidate whose card disagreed with its own
 * kit would fail `sim.test.mjs` §22 and the sweep would be measuring a broken tree.
 *
 * Every substitution is asserted to match EXACTLY ONCE. A sweep row that silently patched
 * nothing is the worst possible outcome here: it reports a confident, entirely fictional
 * "this candidate changes nothing" (`docs/LESSONS.md` §13).
 */
import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const [outdir, candidatePath] = process.argv.slice(2);
if (!outdir || !candidatePath) {
  console.error('usage: stage_vitals.mjs <outdir> <candidate.json>');
  process.exit(1);
}
const cand = JSON.parse(readFileSync(candidatePath, 'utf8'));

rmSync(outdir, { recursive: true, force: true });
mkdirSync(`${outdir}/game`, { recursive: true });
mkdirSync(`${outdir}/arena`, { recursive: true });
for (const f of readdirSync(`${ROOT}/src/game`)) {
  if (f.endsWith('.ts')) copyFileSync(`${ROOT}/src/game/${f}`, `${outdir}/game/${f}`);
}
copyFileSync(`${ROOT}/src/arena/types.ts`, `${outdir}/arena/types.ts`);

let src = readFileSync(`${outdir}/game/rules.ts`, 'utf8');

function subOnce(label, re, replacement) {
  const hits = src.match(new RegExp(re.source, `${re.flags}g`));
  if (!hits || hits.length !== 1) {
    console.error(`stage_vitals: "${label}" matched ${hits ? hits.length : 0} times — refusing to guess`);
    process.exit(2);
  }
  src = src.replace(re, replacement);
}

for (const key of ['HEALTH_PER_STAT', 'SPEED_PER_STAT', 'SPEED_TOP_STAT', 'HEALTH_BASELINE_STAT', 'DPS_PER_DAMAGE_POINT']) {
  if (cand[key] === undefined) continue;
  subOnce(key, new RegExp(`^(export const ${key}\\s*=\\s*)([^;]+)(;)`, 'm'), `$1${cand[key]}$3`);
}

// `damage` is recomputed from the weapon table, so import the STAGED rules to derive it —
// the staged constants are already written in above, and deriving from the shipped module
// would bake this tree's `DPS_PER_DAMAGE_POINT` into a candidate that changed it.
if (cand.stats) {
  writeFileSync(`${outdir}/game/rules.ts`, src);
  const staged = await import(`${outdir}/game/rules.ts`);
  const missing = staged.CHARACTER_IDS.filter((id) => !cand.stats[id]);
  if (missing.length) {
    console.error(`stage_vitals: stats table is missing [${missing.join(', ')}] — it must be complete or absent`);
    process.exit(2);
  }
  for (const id of staged.CHARACTER_IDS) {
    const { health, speed } = cand.stats[id];
    if (typeof health !== 'number' || typeof speed !== 'number') {
      console.error(`stage_vitals: ${id} needs numeric health and speed`);
      process.exit(2);
    }
    const damage = staged.damageStatFor(id);
    subOnce(`${id}.stats`,
      new RegExp(`^(\\s*id: '${id}',[\\s\\S]{0,400}?stats: )\\{ damage: \\d+, health: \\d+, speed: \\d+ \\}`, 'm'),
      `$1{ damage: ${damage}, health: ${health}, speed: ${speed} }`);
  }
}

writeFileSync(`${outdir}/game/rules.ts`, src);
console.error(`staged ${outdir} from ${candidatePath}`);
