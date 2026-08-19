#!/usr/bin/env node
/**
 * lq_hue — IS SOUP'S LIQUID ONE COLOUR? The cross-file invariant, checked.
 *
 * ## The defect this exists to make impossible
 *
 * Uri, playing the deployed build: *"Soup — add noodles or something in the liquid, make
 * the liquid more yellow than brown."* `c9a2ed0` moved the BOWL to gold `#CC9F0D` and
 * nothing else moved, because soup's liquid colour was written down in **five places**:
 *
 *     src/game/rules.ts:3087       PALETTE.broth        '#E8792A'   (also the ARENA's pot)
 *     src/game/rules.ts:4010       soup.Splash.color    '#E8792A'
 *     src/game/rules.ts:4105       soup.Dump.color      '#E8792A'
 *     src/vfx/weapons/soup.ts      nextBrothMat         '#E8792A'
 *     src/vfx/weapons/soup.ts      nextBodyBrothMat     '#E8792A'
 *
 * …plus `BROTH_HOT`/`BROTH_DEEP`, two hand-picked TINTS of that colour whose relationship
 * to it lived only in prose, and `characters/soup.ts`'s own `BROTH`. One rule in eight
 * places. The result was a yellow bowl throwing an orange splash, with every gate green.
 *
 * `src/vfx/weapons/soup.ts` now types no broth hex at all — it reads soup's `Weapon.color`
 * and derives the ramp — so **two** of those places are gone by construction. The rest
 * cannot be collapsed from one file set: `characters/soup.ts` is a different owner and
 * `PALETTE.broth` is shared with the arena. This tool is what stands in for the collapse
 * that could not happen, which is the accepted mitigation and NOT as good as the real one.
 *
 * ## What it checks
 *
 *   A  `src/vfx/weapons/soup.ts` contains no broth hex outside comments.
 *   B  the module's REAL derived palette (bundled and imported, not re-implemented here)
 *      agrees with `rules.ts` — this is the arm that would catch a broken derivation.
 *   C  the derivation is a byte-exact NO-OP at `#E8792A`: it must reproduce `#FFB35C` and
 *      `#B4400C`, the two literals it replaced. That is what makes the refactor safe to
 *      land in any order relative to the `rules.ts` change.
 *   D  `Splash.color === Dump.color` — one substance, one colour.
 *   E  `characters/soup.ts`'s `BROTH` agrees with them. **This is the one that is red
 *      today**, and deliberately: it is the routed `rules.ts` hunk, stated as a number.
 *
 * ## `--selftest`, and its documented limit
 *
 * Every assertion is re-run against a MUTATED copy of the tree and required to go red.
 * `CLAUDE.md` rule 6: *"a guard that has not been shown to FAIL on the bug it guards
 * against is not a guard"* — and *"`--selftest` validates a tool's LOGIC. It never
 * validates where the tool is POINTED."* So §S0 asserts, first, that every file this tool
 * reads exists and that every set it filters is NON-EMPTY, because `[].every()` is `true`
 * and that vacuity has fired three times in this repo in one session.
 *
 * ## Usage
 *
 *   node tools/tmp/lq_hue.mjs [--root <dir>]      # default: the repo this file is in
 *   node tools/tmp/lq_hue.mjs --selftest
 */

import { readFile, writeFile, mkdtemp, rm, cp, mkdir, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

const argv = process.argv;
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SELFTEST = argv.includes('--selftest');
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const ROOT = resolve(arg('--root', REPO));

const F = {
  vfx: 'src/vfx/weapons/soup.ts',
  rules: 'src/game/rules.ts',
  char: 'src/characters/soup.ts',
};

/**
 * The DOM stub that lets `src/vfx/weapons/soup.ts` be imported under node.
 *
 * The module builds a `CanvasTexture` for steam at module scope. A blanket `Proxy` is NOT
 * enough — three reads `image.depth` and a Proxy that answers every property with another
 * Proxy makes `image.depth > 1` throw `Cannot convert object to primitive value`, which
 * reads like a bug in the module under test rather than in the harness. The canvas has to
 * be a PLAIN object with real numbers on it; only the 2D context is proxied.
 */
const SHIM = `
const ctxProxy = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: () => {} });
  if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
  if (k === 'measureText') return () => ({ width: 0 });
  return () => {};
}, set: () => true });
globalThis.document = { createElement: (t) => (t === 'canvas'
  ? { width: 64, height: 64, style: {}, nodeType: 1, getContext: () => ctxProxy(), toDataURL: () => '' }
  : { style: {}, appendChild() {}, setAttribute() {} }) };
globalThis.window = globalThis;
globalThis.self = globalThis;
const m = await import(process.argv[2]);
process.stdout.write(JSON.stringify(m.__brothPalette));
`;

const run = (cmd, args, opts = {}) => new Promise((res) => {
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; let err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  p.on('exit', (code) => res({ code, out, err }));
});

/** Bundle and import a tree's `soup.ts`, returning its REAL derived palette. */
async function livePalette(root) {
  const tmp = await mkdtemp(join(tmpdir(), 'lq-hue-'));
  try {
    const bundle = join(tmp, 'soup.mjs');
    const shim = join(tmp, 'shim.mjs');
    await writeFile(shim, SHIM);
    const b = await run(join(REPO, 'node_modules/.bin/esbuild'),
      ['--bundle', join(root, F.vfx), '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error']);
    if (b.code !== 0) return { error: `esbuild: ${b.err.trim()}` };
    const r = await run(process.execPath, [shim, bundle]);
    if (r.code !== 0) return { error: `import: ${r.err.trim().split('\n').slice(0, 4).join(' / ')}` };
    try { return JSON.parse(r.out); } catch { return { error: `unparseable palette: ${r.out.slice(0, 200)}` }; }
  } finally { await rm(tmp, { recursive: true, force: true }); }
}

/** Strip line and block comments so a hex quoted in prose is not mistaken for a literal. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const weaponColor = (rulesSrc, key) => {
  const m = rulesSrc.match(new RegExp(`key:\\s*'${key}'[^\\n]*?color:\\s*'(#[0-9A-Fa-f]{6})'`));
  return m ? m[1].toUpperCase() : null;
};
const paletteBroth = (rulesSrc) => {
  const m = rulesSrc.match(/\bbroth:\s*'(#[0-9A-Fa-f]{6})'/);
  return m ? m[1].toUpperCase() : null;
};
const charBroth = (charSrc) => {
  const m = charSrc.match(/^const BROTH\s*=\s*'(#[0-9A-Fa-f]{6})'/m);
  return m ? m[1].toUpperCase() : null;
};

async function audit(root) {
  const res = { root, checks: [], facts: {} };
  const add = (id, name, ok, detail = '') => res.checks.push({ id, name, ok, detail });

  for (const [k, rel] of Object.entries(F)) {
    if (!existsSync(join(root, rel))) { add(`S0.${k}`, `${rel} exists`, false, 'missing'); return res; }
  }
  const vfx = await readFile(join(root, F.vfx), 'utf8');
  const rules = await readFile(join(root, F.rules), 'utf8');
  const char = await readFile(join(root, F.char), 'utf8');

  // ── §S0 — POINTED AT SOMETHING. Every set below is filtered; an empty one makes every
  //          `every()` over it vacuously true (CLAUDE.md rule 6).
  const splash = weaponColor(rules, 'Splash');
  const dump = weaponColor(rules, 'Dump');
  const noodle = weaponColor(rules, 'Noodle');
  const pal = paletteBroth(rules);
  const bowl = charBroth(char);
  res.facts = { splash, dump, noodle, paletteBroth: pal, bowlBroth: bowl };
  add('S0a', 'rules.ts yielded soup.Splash / soup.Dump / soup.Noodle colours',
    !!(splash && dump && noodle), JSON.stringify({ splash, dump, noodle }));
  add('S0b', 'rules.ts yielded PALETTE.broth', !!pal, String(pal));
  add('S0c', 'characters/soup.ts yielded its BROTH constant', !!bowl, String(bowl));
  if (!splash || !dump || !noodle || !pal || !bowl) return res;

  // ── §A — the VFX file types no broth hex of its own.
  const code = stripComments(vfx);
  const hexes = [...code.matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1].toUpperCase());
  add('A0', 'the VFX file has SOME string literals to scan (not an empty set)',
    hexes.length > 0, `${hexes.length} hex literals in code`);
  const brothLike = hexes.filter((h) => [splash, dump, noodle, pal, bowl, '#FFB35C', '#B4400C'].includes(h));
  add('A1', 'src/vfx/weapons/soup.ts hardcodes NO broth/noodle colour',
    brothLike.length === 0, brothLike.join(' '));

  // ── §B — the REAL derived palette, bundled and imported.
  const live = await livePalette(root);
  res.facts.derived = live;
  add('B0', 'the module bundled and imported', !live.error, live.error ?? '');
  if (!live.error) {
    add('B1', 'the derived body colour IS soup.Splash.color',
      live.body.toUpperCase() === splash, `derived=${live.body} rules=${splash}`);
    add('B2', 'the derived noodle colour IS soup.Noodle.color',
      live.noodle.toUpperCase() === noodle, `derived=${live.noodle} rules=${noodle}`);
    // ── §C — the NO-OP proof. Only meaningful while the body is still the old orange;
    //         once `rules.ts` moves it is a different (and untestable-here) statement, so
    //         it is SKIPPED rather than silently passing on nothing.
    if (splash === '#E8792A') {
      add('C1', 'at #E8792A the derivation reproduces the deleted literal #FFB35C',
        live.hot.toUpperCase() === '#FFB35C', `hot=${live.hot}`);
      add('C2', 'at #E8792A the derivation reproduces the deleted literal #B4400C',
        live.deep.toUpperCase() === '#B4400C', `deep=${live.deep}`);
    } else {
      res.checks.push({ id: 'C', name: `no-op proof SKIPPED — body has moved to ${splash}`, ok: true, skip: true, detail: `hot=${live.hot} deep=${live.deep}` });
    }
  }

  // ── §D/§E — the cross-file invariants that could not be collapsed.
  add('D1', 'soup.Splash.color === soup.Dump.color (one substance, one colour)',
    splash === dump, `${splash} vs ${dump}`);
  add('E1', "characters/soup.ts BROTH === soup's weapon colour",
    bowl === splash, `bowl=${bowl} weapon=${splash}`);
  return res;
}

function print(res) {
  let fails = 0;
  for (const c of res.checks) {
    if (c.skip) { console.log(`  skip - ${c.name}${c.detail ? `  (${c.detail})` : ''}`); continue; }
    if (c.ok) console.log(`  ok   - [${c.id}] ${c.name}`);
    else { fails++; console.log(`  FAIL - [${c.id}] ${c.name}${c.detail ? `\n         ${c.detail}` : ''}`); }
  }
  return fails;
}

if (!SELFTEST) {
  const res = await audit(ROOT);
  console.log(`lq_hue: ${ROOT}`);
  const fails = print(res);
  console.log(`\n  rules.ts   Splash ${res.facts.splash}  Dump ${res.facts.dump}  Noodle ${res.facts.noodle}  PALETTE.broth ${res.facts.paletteBroth}`);
  console.log(`  bowl       characters/soup.ts BROTH ${res.facts.bowlBroth}`);
  if (res.facts.derived && !res.facts.derived.error) {
    const d = res.facts.derived;
    console.log(`  derived    body ${d.body}  hot ${d.hot}  deep ${d.deep}  noodle ${d.noodle}`);
  }
  process.exitCode = fails ? 1 : 0;
} else {
  // ── KNOWN-BAD INPUTS ────────────────────────────────────────────────────────────
  // Each arm plants ONE defect in a copy of the tree and requires the matching check to
  // go red. An arm that stays green means the check is decorative.
  const tmp = await mkdtemp(join(tmpdir(), 'lq-hue-st-'));
  let fails = 0;
  /**
   * A copied tree needs `node_modules` SYMLINKED or esbuild cannot resolve `three` and
   * [B0] goes red for a reason that has nothing to do with the planted defect — the same
   * shape as `DECISIONS §60`, where a missing `node_modules` made seven gates die on a
   * missing import and read as seven broken gates. The control arm below is what caught it.
   */
  const stage = async (dir) => {
    await mkdir(dir, { recursive: true });
    await cp(join(REPO, 'src'), join(dir, 'src'), { recursive: true });
    await symlink(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  };
  const expectRed = async (name, mutate, id) => {
    const dir = join(tmp, name.replace(/\W+/g, '_'));
    await stage(dir);
    await mutate(dir);
    const res = await audit(dir);
    const c = res.checks.find((x) => x.id === id);
    const red = c && !c.ok && !c.skip;
    if (red) console.log(`  ok   - known-bad "${name}" turns [${id}] red`);
    else { fails++; console.log(`  FAIL - known-bad "${name}" left [${id}] ${c ? (c.skip ? 'SKIPPED' : 'green') : 'ABSENT'}`); }
  };
  const patch = async (dir, rel, from, to) => {
    const p = join(dir, rel);
    const s = await readFile(p, 'utf8');
    if (!s.includes(from)) throw new Error(`selftest: could not plant defect in ${rel} — '${from.slice(0, 40)}' not found`);
    await writeFile(p, s.replace(from, to));
  };
  try {
    console.log('lq_hue --selftest');
    // §S1 — the control: an UNMUTATED copy must reproduce the live tree's own verdict on
    // every check except E1, so a later red is attributable to the mutation and not to the
    // copy. (E1 is red in the real tree today; see the header.)
    {
      const dir = join(tmp, 'control');
      await stage(dir);
      const res = await audit(dir);
      const reds = res.checks.filter((c) => !c.ok && !c.skip).map((c) => c.id);
      const ok = reds.every((id) => id === 'E1');
      if (ok) console.log(`  ok   - control copy is green except [E1]${reds.length ? ` (red: ${reds.join(',')})` : ''}`);
      else { fails++; console.log(`  FAIL - control copy has unexpected reds: ${reds.join(',')}`); }
    }
    await expectRed('a hardcoded body hex is put back in the VFX file', (d) => patch(d, F.vfx,
      'flatLiquid(BROTH_BODY, 0.95)', "flatLiquid('#E8792A', 0.95)"), 'A1');
    await expectRed('the derivation is broken (hue offset wrong)', (d) => patch(d, F.vfx,
      'warmShift(BROTH_BODY, 7.1, 0.195, 0.196)', 'warmShift(BROTH_BODY, 47.1, 0.195, 0.196)'), 'C1');
    await expectRed('the VFX file stops reading rules.ts for the body', (d) => patch(d, F.vfx,
      "const BROTH_BODY = soupWeaponColor('Splash');", "const BROTH_BODY = '#123456';"), 'B1');
    await expectRed('Splash and Dump disagree', (d) => patch(d, F.rules,
      "key: 'Dump', name: 'Soup Dump', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 3000, cone: 90, color: '#E8792A'",
      "key: 'Dump', name: 'Soup Dump', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 3000, cone: 90, color: '#112233'"), 'D1');
    await expectRed('the bowl and the weapon disagree', (d) => patch(d, F.char,
      "const BROTH = '#CC9F0D';", "const BROTH = '#010203';"), 'E1');
    console.log(fails === 0 ? '\nlq_hue --selftest: PASS' : `\nlq_hue --selftest: ${fails} FAIL`);
    process.exitCode = fails ? 1 : 0;
  } finally { await rm(tmp, { recursive: true, force: true }); }
}
