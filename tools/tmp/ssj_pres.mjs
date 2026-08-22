#!/usr/bin/env node
/**
 * ssj_pres — the gate that DOES NOT EXIST: does any damage->presentation response
 * curve saturate?
 *
 * Every one of these curves takes a raw HP amount and maps it to a feel quantity
 * (freeze ms, shake metres, particle count, glyph size, audio weight). Every one of
 * them fails a rescale by PINNING AT ITS CLAMP CEILING, which raises no error, keeps
 * `tsc` clean, and passes every gate in the battery. That is why it needs its own.
 *
 * TWO HALVES, and the second is the one the other instruments in this repo skip:
 *   1. CENSUS the curve sites from SOURCE, so a rename shrinks the count and the tool
 *      refuses rather than reporting `[].every() === true`.
 *   2. EVALUATE each curve over the real population of amounts a player can be dealt,
 *      and compare the share at the ceiling and at the floor, before vs after.
 *
 *   node tools/tmp/ssj_pres.mjs --k 20            # naive (coefficients untouched)
 *   node tools/tmp/ssj_pres.mjs --k 20 --fixed    # coefficients divided by k
 *   node tools/tmp/ssj_pres.mjs --selftest
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const IS_MAIN = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SSJ_ROOT ? fs.realpathSync(process.env.SSJ_ROOT) : path.resolve(HERE, '../..');
const R = await import(pathToFileURL(path.join(ROOT, 'src/game/rules.ts')).href);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * THE CURVES. `file`/`probe` let the census prove the site still exists; `f` reproduces
 * it. Transcribed from source and each one's `probe` is asserted present, so a curve
 * that is deleted or rewritten makes this tool FAIL rather than silently drop a row.
 */
export const CURVES = [
  { id: 'hitstop',      file: 'src/game/match.ts',  probe: '10 + ev.amount * 4.6',        f: (a, s) => clamp(10 + a * 4.6 / s, 16, 105) },
  // SHAKE_MAX_M is 0.40 (match.ts:638) — read, not guessed. A wrong ceiling here makes
  // the row read 98.4% saturated TODAY, which is exactly the false-regression class.
  { id: 'shake',        file: 'src/game/match.ts',  probe: '0.012 + ev.amount * 0.0175',  f: (a, s) => clamp(0.012 + a * 0.0175 / s, 0.012, 0.40) },
  { id: 'knockback',    file: 'src/game/match.ts',  probe: '0.05 + ev.amount * 0.006',    f: (a, s) => clamp(0.05 + a * 0.006 / s, 0, 0.22) },
  { id: 'hitreaction',  file: 'src/game/match.ts',  probe: 'ev.amount / 12',              f: (a, s) => clamp(a / (12 * s), 0.25, 1) },
  { id: 'burstsize',    file: 'src/game/vfx.ts',    probe: '0.42 + amount * 0.075',       f: (a, s) => clamp(0.42 + a * 0.075 / s, 0.42, 2.0) },
  { id: 'particles',    file: 'src/game/vfx.ts',    probe: '1 + amount * 0.4',            f: (a, s) => Math.round(clamp(1 + a * 0.4 / s, 2, 8)) },
  { id: 'glyphtier',    file: 'src/ui/hud.ts',      probe: 'amount >= 15',                f: (a, s) => (a >= 15 * s ? 2 : a >= 6 * s ? 1 : 0) },
  { id: 'audioweight',  file: 'src/audio/sounds.ts', probe: '(damage - 2) / 16',          f: (a, s) => clamp((a - 2 * s) / (16 * s), 0, 1) },
  { id: 'imp_burrito',  file: 'src/vfx/weapons/burrito.ts', probe: '0.85 + damage * 0.035', f: (a, s) => clamp(0.85 + a * 0.035 / s, 0.85, 1.35) },
  { id: 'imp_donut',    file: 'src/vfx/weapons/donut.ts',   probe: '0.85 + damage * 0.035', f: (a, s) => clamp(0.85 + a * 0.035 / s, 0.85, 1.25) },
  { id: 'imp_egg',      file: 'src/vfx/weapons/egg.ts',     probe: '0.85 + damage * 0.035', f: (a, s) => clamp(0.85 + a * 0.035 / s, 0.85, 1.45) },
  { id: 'imp_hotdog',   file: 'src/vfx/weapons/hotdog.ts',  probe: '0.85 + damage * 0.035', f: (a, s) => clamp(0.85 + a * 0.035 / s, 0.85, 1.4) },
  { id: 'imp_pizza',    file: 'src/vfx/weapons/pizza.ts',   probe: '0.85 + damage * 0.035', f: (a, s) => clamp(0.85 + a * 0.035 / s, 0.85, 1.4) },
  { id: 'imp_sushi',    file: 'src/vfx/weapons/sushi.ts',   probe: '0.85 + damage * 0.035', f: (a, s) => clamp(0.85 + a * 0.035 / s, 0.85, 1.4) },
  { id: 'imp_taco',     file: 'src/vfx/weapons/taco.ts',    probe: '0.85 + damage * 0.035', f: (a, s) => clamp(0.85 + a * 0.035 / s, 0.85, 1.45) },
  { id: 'imp_hamburger', file: 'src/vfx/weapons/hamburger.ts', probe: '1 + ctx.damage * 0.05',   f: (a, s) => clamp(1 + a * 0.05 / s, 1, 2.2) },
  { id: 'imp_water',    file: 'src/vfx/weapons/waterbottle.ts', probe: '1 + ctx.damage * 0.06', f: (a, s) => clamp(1 + a * 0.06 / s, 1, 2.4) },
  { id: 'imp_lolli_a',  file: 'src/vfx/weapons/lollipop.ts', probe: '0.85 + ctx.damage * 0.03', f: (a, s) => clamp(0.85 + a * 0.03 / s, 0.85, 1.6) },
  { id: 'imp_lolli_b',  file: 'src/vfx/weapons/lollipop.ts', probe: '0.9 + ctx.damage * 0.035', f: (a, s) => clamp(0.9 + a * 0.035 / s, 0.9, 1.7) },
];

/** Every per-hit amount a player can be dealt: display units x 15 levels. */
export function amountPopulation(k = 1) {
  const out = [];
  for (const id of R.CHARACTER_IDS) {
    for (const w of R.CHARACTERS[id].weapons) {
      if (w.type === 'self') continue;
      const bases = w.comboParts ? w.comboParts.map((p) => p.damage) : [w.damage];
      for (const b of bases) {
        if (b === 0) continue;
        for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) out.push(b * k * R.levelDamageMultiplier(L));
      }
    }
  }
  return out;
}

/** CENSUS — every curve's probe string must still be findable in its file. */
export function census() {
  const missing = [];
  for (const c of CURVES) {
    const p = path.join(ROOT, c.file);
    if (!fs.existsSync(p) || !fs.readFileSync(p, 'utf8').includes(c.probe)) missing.push(`${c.id} (${c.file}: "${c.probe}")`);
  }
  return { sites: CURVES.length, missing };
}

export function evaluate(k, corrected) {
  const pop = amountPopulation(k);
  if (pop.length === 0) throw new Error('VACUOUS: empty amount population');
  const s = corrected ? k : 1;   // the coefficient divisor the migration must apply
  const rows = [];
  for (const c of CURVES) {
    const vals = pop.map((a) => c.f(a, s));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    // the curve's own reachable extremes, measured at k=1 uncorrected = today
    const base = amountPopulation(1).map((a) => c.f(a, 1));
    const bLo = Math.min(...base), bHi = Math.max(...base);
    rows.push({
      id: c.id, distinct: new Set(vals).size,
      atCeil: vals.filter((v) => v >= bHi - 1e-9).length / vals.length,
      atFloor: vals.filter((v) => v <= bLo + 1e-9).length / vals.length,
      baseDistinct: new Set(base).size,
      baseAtCeil: base.filter((v) => v >= bHi - 1e-9).length / base.length,
      baseAtFloor: base.filter((v) => v <= bLo + 1e-9).length / base.length,
    });
  }
  return { n: pop.length, rows };
}

function selftest() {
  const T = []; const ok = (n, c, note = '') => T.push({ n, c, note });
  const cs = census();
  ok('CENSUS: every curve site still exists in source', cs.missing.length === 0, cs.missing.join(' | '));
  ok('CENSUS: 19 sites (20 thresholds; glyphtier holds 2)', cs.sites === 19, `${cs.sites}`);
  const pop = amountPopulation(1);
  ok('POPULATION non-empty', pop.length > 0, `${pop.length}`);
  ok('POPULATION has >8 distinct values (not constant)', new Set(pop).size > 8, `${new Set(pop).size}`);

  // SELF-PAIR: k=1 corrected and uncorrected are the same thing.
  const a = evaluate(1, false), b = evaluate(1, true);
  ok('SELF-PAIR k=1 corrected === uncorrected', JSON.stringify(a.rows) === JSON.stringify(b.rows));

  // KNOWN-BAD: naive k=20 must pin EVERY curve at its ceiling.
  const naive = evaluate(20, false);
  const pinned = naive.rows.filter((r) => r.atCeil > 0.999).length;
  ok('KNOWN-BAD naive k=20 pins every curve', pinned === CURVES.length, `${pinned}/${CURVES.length}`);

  // CONTROL: corrected k=20 must reproduce today's shares EXACTLY.
  const fixed = evaluate(20, true);
  const drifted = fixed.rows.filter((r, i) =>
    Math.abs(r.atCeil - a.rows[i].atCeil) > 1e-9 || Math.abs(r.atFloor - a.rows[i].atFloor) > 1e-9).length;
  ok('CONTROL corrected k=20 reproduces today\'s shares', drifted === 0, `${drifted} drifted`);

  // REVERSE KNOWN-BAD: over-dividing must pin at the FLOOR, not the ceiling. Without
  // this arm a one-sided check calls an over-correction "healthy".
  const over = { rows: CURVES.map((c) => {
    const vals = amountPopulation(20).map((x) => c.f(x, 400));
    const base = amountPopulation(1).map((x) => c.f(x, 1));
    const bLo = Math.min(...base);
    return { id: c.id, atFloor: vals.filter((v) => v <= bLo + 1e-9).length / vals.length };
  }) };
  ok('REVERSE KNOWN-BAD over-division pins at the FLOOR',
    over.rows.filter((r) => r.atFloor > 0.999).length >= CURVES.length - 2,
    `${over.rows.filter((r) => r.atFloor > 0.999).length}/${CURVES.length}`);

  let pass = 0;
  for (const t of T) { if (t.c) pass++; console.log(`${t.c ? '  ok  ' : ' FAIL '} ${t.n}${t.note ? '   [' + t.note + ']' : ''}`); }
  console.log(`\n${pass}/${T.length}`);
  return pass === T.length ? 0 : 1;
}

if (IS_MAIN) {
  if (process.argv.includes('--selftest')) process.exit(selftest());
  const i = process.argv.indexOf('--k');
  const k = i >= 0 ? Number(process.argv[i + 1]) : 20;
  const corrected = process.argv.includes('--fixed');
  const cs = census();
  if (cs.missing.length) { console.error('CENSUS SHRANK — refusing:\n  ' + cs.missing.join('\n  ')); process.exit(1); }
  const r = evaluate(k, corrected);
  console.log(`ROOT ${ROOT}   k=${k}   coefficients ${corrected ? 'DIVIDED by k' : 'UNTOUCHED (naive)'}   population ${r.n}\n`);
  console.log('curve            distinct  @ceiling  @floor      today: distinct  @ceiling  @floor');
  for (const x of r.rows) {
    const bad = x.atCeil > 0.999 || x.atFloor > 0.999;
    console.log(`${bad ? '🔴' : '  '} ${x.id.padEnd(14)} ${String(x.distinct).padStart(6)}  ${(100 * x.atCeil).toFixed(1).padStart(7)}%  ${(100 * x.atFloor).toFixed(1).padStart(6)}%` +
      `       ${String(x.baseDistinct).padStart(6)}  ${(100 * x.baseAtCeil).toFixed(1).padStart(7)}%  ${(100 * x.baseAtFloor).toFixed(1).padStart(6)}%`);
  }
  const pinned = r.rows.filter((x) => x.atCeil > 0.999 || x.atFloor > 0.999).length;
  console.log(`\nPINNED: ${pinned}/${r.rows.length}`);
  process.exit(pinned === 0 ? 0 : 1);
}
