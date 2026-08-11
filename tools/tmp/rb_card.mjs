#!/usr/bin/env node
/**
 * RB_CARD — the `sim.test.mjs` §22 CARD INVARIANTS, runnable against a STAGED roster.
 *
 * `sim.test.mjs` imports `./rules.ts` relatively, so it can only ever test the working
 * tree. A balance sweep stages dozens of candidate rosters under `/tmp` and needs to know
 * which of them are even LEGAL before spending 100 s of CPU measuring one — because the
 * card constraints are tight enough that a plausible-looking damage change is illegal:
 *
 *   §22(f)  stats.damage === damageStatFor(id)          — the bar is DERIVED from the kit
 *   §22(g)  >= 6 distinct stat totals, no tie bigger than 3
 *   §22(h)  rho(kitDps, healthMultiplier) <= -0.6, and max/min health multiplier >= 1.6
 *   §22(b)  pool order follows the health BAR order, strictly
 *   §25(c)  Hamburger's heal clears a quarter of Hamburger's pool
 *   §26(i)  Hamburger still holds the roster's MINIMUM pool
 *
 * ⚠️ THE §22(g) MARGIN IS ZERO ON THE SHIPPED ROSTER — 6 distinct totals with a 3-way tie
 * at 19, against bounds of ">= 6" and "<= 3". So a single stat point moved anywhere can
 * turn that gate red, and it is not obvious from the number being changed. That is the
 * whole reason this exists as a pre-filter rather than a post-hoc surprise.
 *
 *   node tools/tmp/rb_card.mjs                    # the working tree
 *   node tools/tmp/rb_card.mjs --sim /tmp/x/game  # a staged candidate
 *   node tools/tmp/rb_card.mjs --selftest
 */
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

/** Every §22 card invariant, as pure functions of one parsed `rules` module. */
export function auditCard(R) {
  const {
    CHARACTERS, CHARACTER_IDS, STAT_MAX_DISPLAY, PLAYER_MAX_HP, ENEMY_MAX_HP,
    HEALTH_BASELINE_STAT, kitDps, damageStatFor, healthMultiplier, maxHpFor,
  } = R;
  const rows = [];
  const add = (id, ok, detail) => rows.push({ id, ok, detail });

  // (f) the damage bar is the kit
  {
    const wrong = CHARACTER_IDS.filter((id) => CHARACTERS[id].stats.damage !== damageStatFor(id));
    add('22f-damage-bar-is-kit', wrong.length === 0,
      wrong.map((id) => `${id} card ${CHARACTERS[id].stats.damage} vs kit ${damageStatFor(id)} (${kitDps(id).toFixed(2)} HP/s)`).join(' · ')
      || 'all 11 agree');
  }
  // (f) every bar on the 1..STAT_MAX scale
  {
    const bad = CHARACTER_IDS.filter((id) => !['damage', 'health', 'speed'].every((k) => {
      const v = CHARACTERS[id].stats[k];
      return Number.isInteger(v) && v >= 1 && v <= STAT_MAX_DISPLAY;
    }));
    add('22f-bars-in-scale', bad.length === 0, bad.join(',') || `1..${STAT_MAX_DISPLAY}`);
  }
  // (g) the card discriminates
  {
    const totals = CHARACTER_IDS.map((id) => CHARACTERS[id].stats.damage + CHARACTERS[id].stats.health + CHARACTERS[id].stats.speed);
    const distinct = new Set(totals).size;
    const tie = Math.max(...[...new Set(totals)].map((t) => totals.filter((x) => x === t).length));
    add('22g-card-discriminates', distinct >= 6 && tie <= 3, `${distinct} distinct (need >=6) · largest tie ${tie} (need <=3)`);
  }
  // (h) health compensates the kit
  {
    const dps = CHARACTER_IDS.map((id) => kitDps(id));
    const hp = CHARACTER_IDS.map((id) => healthMultiplier(id));
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mx = mean(dps), my = mean(hp);
    const cov = dps.reduce((s, x, i) => s + (x - mx) * (hp[i] - my), 0);
    const sx = Math.sqrt(dps.reduce((s, x) => s + (x - mx) ** 2, 0));
    const sy = Math.sqrt(hp.reduce((s, y) => s + (y - my) ** 2, 0));
    const rho = cov / (sx * sy);
    add('22h-health-compensates-kit', rho <= -0.6, `rho ${rho.toFixed(3)} (need <= -0.6)`);
    const lo = Math.min(...hp), hi = Math.max(...hp);
    add('22h-durability-range', hi / lo >= 1.6, `${(hi / lo).toFixed(2)}x (need >= 1.6)`);
  }
  // (b) pool order follows the bar order
  {
    const byBar = [...CHARACTER_IDS].sort((a, b) => CHARACTERS[a].stats.health - CHARACTERS[b].stats.health);
    const ok = byBar.every((id, i) => i === 0
      || CHARACTERS[id].stats.health === CHARACTERS[byBar[i - 1]].stats.health
      || maxHpFor(id, PLAYER_MAX_HP) > maxHpFor(byBar[i - 1], PLAYER_MAX_HP));
    add('22b-pool-follows-bar', ok, byBar.map((id) => `${id} ${maxHpFor(id, PLAYER_MAX_HP)}`).join(' '));
    const base = CHARACTER_IDS.every((id) => CHARACTERS[id].stats.health !== HEALTH_BASELINE_STAT
      || maxHpFor(id, ENEMY_MAX_HP) === ENEMY_MAX_HP);
    add('22b-baseline-stat-is-role-pool', base, `stat ${HEALTH_BASELINE_STAT} === ${ENEMY_MAX_HP}`);
  }
  // (25c) the heal clears a quarter of the pool
  {
    const heal = CHARACTERS.hamburger.weapons.find((w) => w.type === 'self')?.healAmount ?? 0;
    const pool = maxHpFor('hamburger', PLAYER_MAX_HP);
    add('25c-heal-clears-quarter-pool', heal >= pool / 4, `${heal} vs pool/4 = ${(pool / 4).toFixed(1)}`);
  }
  // (26i) hamburger holds the roster minimum pool
  {
    const pools = CHARACTER_IDS.map((id) => maxHpFor(id, PLAYER_MAX_HP));
    add('26i-hamburger-is-frailest', maxHpFor('hamburger', PLAYER_MAX_HP) === Math.min(...pools),
      `hamburger ${maxHpFor('hamburger', PLAYER_MAX_HP)} · roster min ${Math.min(...pools)}`);
  }
  return rows;
}

/** The card bar each character's kit implies — what `stats.damage` must be set to. */
export function derivedBars(R) {
  return Object.fromEntries(R.CHARACTER_IDS.map((id) => [id, {
    card: R.CHARACTERS[id].stats.damage, derived: R.damageStatFor(id), dps: R.kitDps(id),
  }]));
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (args.selftest) {
    // KNOWN-BAD: the audit must FAIL on a roster that is deliberately broken. A card
    // audit that cannot be made to fail is a comment with a tick next to it.
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const execFileP = promisify(execFile);
    let pass = 0, fail = 0;
    const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
    console.log('\n══ rb_card SELFTEST ══');

    const live = await import(`${ROOT}/src/game/rules.ts`);
    const base = auditCard(live);
    ok('the shipped roster passes every card invariant', base.every((r) => r.ok),
      base.filter((r) => !r.ok).map((r) => r.id).join(',') || `${base.length} rows`);
    ok('…and the audit is not vacuous — it returned rows', base.length >= 8, `${base.length} rows`);

    const stager = join(ROOT, 'tools/tmp/rb_stage.mjs');
    const mk = async (tag, pairs) => {
      const d = join(tmpdir(), `fa-rbcard-${tag}`);
      await execFileP(process.execPath, [stager, d, ...pairs], { cwd: ROOT, maxBuffer: 1 << 26 });
      const M = await import(`${d}/game/rules.ts`);
      const rows = auditCard(M);
      rmSync(d, { recursive: true, force: true });
      return rows;
    };
    // 1. Raise a weapon's damage without re-deriving the bar -> §22(f) must go red.
    {
      const r = await mk('f', ['pizza.Dough.damage=9']);
      ok('KNOWN-BAD: a weapon damage change with a stale card bar fails §22(f)',
        r.find((x) => x.id === '22f-damage-bar-is-kit')?.ok === false,
        r.find((x) => x.id === '22f-damage-bar-is-kit')?.detail);
    }
    // 2. Move one stat point into the 3-way tie at 19 -> §22(g) must go red. This is the
    //    zero-margin case the header warns about, proved rather than asserted.
    {
      const r = await mk('g', ['burrito.speed=6']);
      ok('KNOWN-BAD: one stat point into the tie at 19 fails §22(g)',
        r.find((x) => x.id === '22g-card-discriminates')?.ok === false,
        r.find((x) => x.id === '22g-card-discriminates')?.detail);
    }
    // 3. Flatten the health axis -> §22(h) durability range must go red.
    //    ⚠️ THE FIRST DRAFT OF THIS KNOWN-BAD DID NOT FAIL, and that is worth keeping:
    //    it moved only pizza (h10) and hamburger (h3) to 7, which leaves taco h4 and soup
    //    h9 holding 1.3/0.8 = 1.625x — still over the 1.6 bound. A known-bad that does not
    //    actually break the thing it names is the vacuous-guard shape this project has
    //    caught three times in one session. All FOUR extremes have to move.
    {
      const r = await mk('h', ['pizza.health=7', 'hamburger.health=7', 'taco.health=7', 'soup.health=7']);
      const dr = r.find((x) => x.id === '22h-durability-range');
      ok('KNOWN-BAD: flattening the health axis fails §22(h) durability range',
        dr?.ok === false, dr?.detail);
    }
    // 4. Give hamburger a bigger pool than the roster minimum -> §26(i) must go red.
    {
      const r = await mk('i', ['hamburger.health=9']);
      ok('KNOWN-BAD: hamburger off the roster floor fails §26(i)',
        r.find((x) => x.id === '26i-hamburger-is-frailest')?.ok === false,
        r.find((x) => x.id === '26i-hamburger-is-frailest')?.detail);
    }
    console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
    process.exit(fail ? 1 : 0);
  }

  const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
  const R = await import(`${SIM_DIR}/rules.ts`);
  const rows = auditCard(R);
  console.log(`\n══ CARD AUDIT ══ ${SIM_DIR}`);
  for (const r of rows) console.log(`   ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(30)} ${r.detail}`);
  const bars = derivedBars(R);
  const stale = Object.entries(bars).filter(([, v]) => v.card !== v.derived);
  if (stale.length) {
    console.log(`\n   CARD BARS TO RE-DERIVE:`);
    for (const [id, v] of stale) console.log(`     ${id.padEnd(12)} damage: ${v.card} -> ${v.derived}   (kitDps ${v.dps.toFixed(2)})`);
  }
  console.log(`\n   ${rows.filter((r) => r.ok).length}/${rows.length} invariants hold\n`);
  process.exit(rows.every((r) => r.ok) ? 0 : 1);
}
