#!/usr/bin/env node
/**
 * UB2-PATCHSIM — BUILD A `--sim` TREE THAT CAN PUT A LOADOUT ON A BOT SEAT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY, AND WHY THIS SHAPE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every N=6 balance number in this repo comes out of `tools/tmp/nf_ffa.mjs`, and its floors
 * — **placement 0.978 places**, **seat spread 0.315** — are properties OF THAT TOOL's design
 * (the ring's `2*pi/n` symmetry, the phase nuisance, the fractional tie rule, the total-wipe
 * branch). Re-implementing placement in a second file to make it carry items would be *"a
 * rule stated once and implemented twice"*, which is this repo's most expensive recorded
 * defect shape and the reason four separate bugs shipped.
 *
 * `nf_ffa`'s own header names the supported alternative, verbatim:
 *
 *   > *"This tool never patches a sim itself. It takes `--sim <dir>` like every other Node
 *   > balance tool here, so an ablation is: copy `src/`, edit one constant, ASSERT the edit
 *   > landed (anchor-miss must be fatal), import BOTH and print the constant from each, then
 *   > run the patched arm at the SAME phase as a baseline JSON and pair with `--baseline`."*
 *
 * This is that copy-and-patch step, done once, with the assertions it demands. `nf_ffa` is
 * not modified, not imported and not read.
 *
 * ── WHAT THE PATCH DOES, AND WHY IT CANNOT CONTAMINATE THE CONTROL ─────────
 *
 * ONE hunk, in `createMatch`'s config loop: `items: cfg.items` becomes
 * `items: cfg.items ?? __ub2Items(id)`, where `__ub2Items` reads two environment variables
 * and **returns `undefined` when neither is set**.
 *
 * 🚨 **SO THE CONTROL ARM IS THE PATCHED TREE WITH THE ENVIRONMENT UNSET, NOT THE REAL
 * TREE.** That is deliberate and it is the whole reason the patch is shaped as a `??` on an
 * `undefined`: `cfg.items` is `undefined` for every config `nf_ffa` builds, `__ub2Items`
 * returns `undefined` with no env, and `items: undefined` is byte-for-byte the value the
 * unpatched line produces. The two trees are therefore identical **by construction** on the
 * control arm and not merely by a measurement somebody has to trust — and `--verify` runs
 * the measurement anyway, because "by construction" is exactly the kind of claim this
 * project has been wrong about.
 *
 *   UB2_ITEMS=warm_milk            every seat carries it            (the SYMMETRIC arm)
 *   UB2_ITEMS=warm_milk,pompa      a full two-slot loadout
 *   UB2_ITEMS=... UB2_ITEM_SEAT=0  ONLY seat 0 carries it           (the ASYMMETRIC arm —
 *                                  the shipped shape, where `match.ts` gives the loadout to
 *                                  `LOCAL_SLOT` and to nobody else)
 *
 * ⚠️ **`process.env` IS READ PER CALL, NOT AT MODULE LOAD.** `nf_ffa` forks worker children
 * and forwards a fixed flag list; env is inherited, but a value cached at import time in the
 * PARENT would be a different object from the one a child resolves. Reading it inside the
 * call makes both agree, and `--verify` drives the sharded path specifically.
 *
 * ── THE ANCHOR IS FATAL ON A MISS, AND ON A DOUBLE MATCH ───────────────────
 *
 * `docs/AGENT-BRIEF.md`: an ablation whose patch silently did not land returns "the change
 * did nothing", which is a normal outcome for a balance run and which nobody re-checks.
 * So: exactly one occurrence required, the file is re-read after writing, and the patched
 * module is IMPORTED before this tool exits — `node --check` validates syntax and never
 * ORDER, and three files here shipped a temporal-dead-zone `ReferenceError` that only
 * running them caught.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   node tools/tmp/ub2_patchsim.mjs --out /tmp/ub2sim            # build it
 *   node tools/tmp/ub2_patchsim.mjs --out /tmp/ub2sim --verify   # build + prove both halves
 *
 *   node tools/tmp/nf_ffa.mjs --sim /tmp/ub2sim/src/game --n 6 --json ctl.json
 *   UB2_ITEMS=warm_milk node tools/tmp/nf_ffa.mjs --sim /tmp/ub2sim/src/game --n 6 \
 *        --baseline ctl.json
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

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

/** The lines the patch replaces. Quoted exactly, so a reformat is a loud failure. */
const ANCHOR = '      items: cfg.items,';
const HP_ANCHOR = '      maxHp: cfg.maxHp ?? maxHpFor(cfg.characterId, seatIsBotOpponent ? ENEMY_MAX_HP : PLAYER_MAX_HP, lvl),';
/**
 * ── THE COOLDOWN DIAL, IN `combat.ts` AND NOT IN `rules.ts` ────────────────
 *
 * `ITEMS` is a frozen object literal ~200 lines long; patching ten `cooldownMs` fields in it
 * would be ten anchors that can each go stale independently. `itemUsable` reads the value
 * through exactly ONE expression, and that expression is the quantity the question is about
 * — *"how long until this button comes back"*. One anchor, and it is the one the sim
 * actually consults, so a dial applied here cannot disagree with the gate.
 *
 * ⚠️ It moves the SIM only. A HUD reading `cooldownMs` off the registry would disagree —
 * irrelevant for an offline balance arm, stated so nobody reuses this tree for a screenshot.
 */
const CD_ANCHOR = '  const cooldown = def.cooldownMs ?? 0;';

/**
 * The replacements. `__ub2Items` / `__ub2Hp` are declared in the same file, above
 * `createMatch`, so the patched tree needs no new import and no new file — a second file
 * would be a second thing that can fail to be copied.
 */
const REPLACEMENT = '      items: cfg.items ?? __ub2Items(id),';
const HP_REPLACEMENT = '      maxHp: cfg.maxHp ?? maxHpFor(cfg.characterId, seatIsBotOpponent ? ENEMY_MAX_HP : PLAYER_MAX_HP, lvl) * __ub2Hp(id),';
const CD_REPLACEMENT = '  const cooldown = (def.cooldownMs ?? 0) * Number(process.env.UB2_CD ?? 1);';

const HELPER = `
/**
 * ── 🔬 MEASUREMENT PATCH — \`tools/tmp/ub2_patchsim.mjs\`. NOT SHIPPED CODE. ──
 *
 * Returns \`undefined\` with no environment set, which is byte-for-byte what the unpatched
 * \`items: cfg.items\` produced for every config \`nf_ffa\` builds. The control arm of any A/B
 * measured on this tree is therefore identical to the real tree BY CONSTRUCTION.
 *
 * Read per call rather than cached at module load: \`nf_ffa\` forks worker children, and a
 * value resolved once in the parent is a different object from the one a child would see.
 */
function __ub2Items(id) {
  const raw = process.env.UB2_ITEMS;
  if (raw === undefined || raw === '') return undefined;
  const seat = process.env.UB2_ITEM_SEAT;
  if (seat !== undefined && seat !== '' && seat !== 'all' && Number(seat) !== id) return undefined;
  return raw.split(',').filter(Boolean);
}

/**
 * ── 🔬 THE POSITIVE CONTROL FOR THE WHOLE RIG. NOT SHIPPED CODE. ──
 *
 * \`CLAUDE.md\` / the item contract: **prove the rig can see a change before reporting a
 * null.** The medikit track reported *"0 of 110 moved, bit-identical"* and it meant "the rig
 * cannot see it", not "the change did nothing". An item that scores 0 here has to be
 * distinguishable from a rig that scores everything 0, and the only way to know is to hand
 * ONE SEAT an advantage nobody could call subtle and require the instrument to register it.
 *
 * \`maxHp\` is the surface \`nf_ffa --boost\` already uses for exactly this — *"an unambiguous,
 * non-subtle advantage through the PUBLIC \`FighterConfig\` surface … so \`--selftest\` §D never
 * has to patch a sim"* — but \`--boost\` keys on CHARACTER, and in a mirror roster every seat
 * is the same character, so it moves all six and produces no seat effect at all. This is the
 * same lever keyed on SEAT.
 *
 * Returns exactly \`1\` with no environment set, so the control arm multiplies by one.
 */
function __ub2Hp(id) {
  const mul = process.env.UB2_BOOST_HP;
  if (mul === undefined || mul === '') return 1;
  const seat = process.env.UB2_BOOST_SEAT;
  if (seat !== undefined && seat !== '' && seat !== 'all' && Number(seat) !== id) return 1;
  return Number(mul);
}
`;

export function buildPatchedTree(outDir) {
  const dst = resolve(outDir);
  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  // The whole of `src/`, because `src/game/*.ts` imports `../arena/types.ts`, `../units.ts`
  // and eleven other siblings. Copying only `game/` gives a tree that fails to resolve —
  // which looks exactly like a broken patch.
  cpSync(join(ROOT, 'src'), join(dst, 'src'), { recursive: true });

  const simPath = join(dst, 'src', 'game', 'sim.ts');
  const before = readFileSync(simPath, 'utf8');

  const combatPath = join(dst, 'src', 'game', 'combat.ts');
  const combatBefore = readFileSync(combatPath, 'utf8');
  for (const [label, a, src] of [['items', ANCHOR, before], ['maxHp', HP_ANCHOR, before], ['cooldown', CD_ANCHOR, combatBefore]]) {
    const hits = src.split('\n').filter((l) => l === a).length;
    if (hits !== 1) {
      throw new Error(`ub2_patchsim: the ${label} anchor matched ${hits} times, expected exactly 1.\n`
        + `  anchor: ${JSON.stringify(a)}\n`
        + '  An anchor miss is FATAL here on purpose: a patch that silently did not land returns\n'
        + '  "the change did nothing", which is a normal outcome for a balance ablation.');
    }
  }

  const helperAnchor = 'export function createMatch(';
  if (!before.includes(helperAnchor)) {
    throw new Error(`ub2_patchsim: could not find ${JSON.stringify(helperAnchor)} to hang the helper above`);
  }

  const after = before
    .split('\n').map((l) => (l === ANCHOR ? REPLACEMENT : l === HP_ANCHOR ? HP_REPLACEMENT : l)).join('\n')
    .replace(helperAnchor, `${HELPER}\n${helperAnchor}`);

  writeFileSync(simPath, after);
  writeFileSync(combatPath, combatBefore.split('\n')
    .map((l) => (l === CD_ANCHOR ? CD_REPLACEMENT : l)).join('\n'));
  const cdWritten = readFileSync(combatPath, 'utf8');
  if (!cdWritten.includes(CD_REPLACEMENT) || cdWritten.includes(CD_ANCHOR)) {
    throw new Error('ub2_patchsim: the cooldown patch did not survive the write');
  }

  // Re-read from disk. "I wrote it" and "it is on disk" are different claims.
  const written = readFileSync(simPath, 'utf8');
  if (!written.includes(REPLACEMENT) || written.includes(ANCHOR)
    || !written.includes(HP_REPLACEMENT) || written.includes(HP_ANCHOR)
    || !written.includes('function __ub2Items') || !written.includes('function __ub2Hp')) {
    throw new Error('ub2_patchsim: the patch did not survive the write');
  }
  return { simPath, combatPath, gameDir: join(dst, 'src', 'game'), before, after: written };
}

if (IS_MAIN) {
  const out = String(args.out ?? '/tmp/ub2sim');
  const r = buildPatchedTree(out);
  console.log(`ub2_patchsim: patched tree at ${out}`);
  console.log(`  --sim ${r.gameDir}`);
  // "import BOTH and print the constant from each" — nf_ffa's own instruction.
  console.log(`  REAL    ${ROOT}/src/game/sim.ts : ${ANCHOR.trim()}`);
  console.log(`  PATCHED ${r.simPath} : ${REPLACEMENT.trim()}`);
  console.log(`  REAL    ${ROOT}/src/game/combat.ts : ${CD_ANCHOR.trim()}`);
  console.log(`  PATCHED ${r.combatPath} : ${CD_REPLACEMENT.trim()}`);

  // `node --check` validates SYNTAX and never ORDER. Import it.
  const mod = await import(pathToFileURL(join(r.gameDir, 'sim.ts')).href);
  if (typeof mod.createMatch !== 'function') throw new Error('ub2_patchsim: patched sim.ts does not export createMatch');
  console.log('  patched sim.ts IMPORTS and still exports createMatch');

  if (args.verify) {
    // ── BOTH HALVES, AND NEITHER MEANS ANYTHING ALONE ──────────────────────
    //
    // OFF: with no environment the patched tree must seat NOTHING. If this is wrong the
    //      control arm of every A/B is contaminated and both arms move together.
    // ON:  with the environment set it must seat exactly what was asked, on exactly the
    //      seats asked for. If this is wrong the "positive" arm is a second control and the
    //      run reports a null that means nothing.
    const arena = {
      id: 'ub2', displayName: 'ub2', width: 2800, height: 2000,
      center: { x: 1400, y: 1000 }, maxSafeRadius: 50_000,
      playerSpawn: { x: 300, y: 810 }, enemySpawn: { x: 2500, y: 1190 },
      cover: [], hazards: [], build: () => null, update: () => {},
    };
    const six = () => Array.from({ length: 6 }, (_, i) => ({
      characterId: 'hamburger', controller: 'ai', spawn: { x: 400 + i * 300, y: 500 },
    }));
    let fails = 0;
    const ok = (name, cond, detail) => {
      if (cond) console.log(`  ok   - ${name}${detail ? `  (${detail})` : ''}`);
      else { fails++; console.log(`  FAIL - ${name}${detail ? `  (${detail})` : ''}`); }
    };

    delete process.env.UB2_ITEMS; delete process.env.UB2_ITEM_SEAT;
    const off = mod.createMatch(arena, six());
    ok('OFF: the patched tree with no environment seats ZERO items on ZERO seats — the control is uncontaminated',
      off.fighters.every((f) => f.item.equipped.length === 0),
      off.fighters.map((f) => f.item.equipped.length).join(','));

    process.env.UB2_ITEMS = 'warm_milk,pompa';
    const all = mod.createMatch(arena, six());
    ok('NON-VACUITY: the symmetric arm really seated six fighters',
      all.fighters.length === 6, `${all.fighters.length}`);
    ok('ON/all: every seat carries the requested pair, in order',
      all.fighters.every((f) => f.item.equipped.join(',') === 'warm_milk,pompa'),
      all.fighters.map((f) => `[${f.item.equipped.join('|')}]`).join(' '));

    process.env.UB2_ITEM_SEAT = '0';
    const one = mod.createMatch(arena, six());
    ok('ON/seat 0: the carrier has it',
      one.fighters[0].item.equipped.join(',') === 'warm_milk,pompa',
      `[${one.fighters[0].item.equipped.join('|')}]`);
    const others = one.fighters.slice(1);
    ok('NON-VACUITY: there are five other seats to check against',
      others.length === 5, `${others.length}`);
    ok('ON/seat 0: 🔴 and NO OTHER SEAT DOES — the asymmetric arm is asymmetric',
      others.every((f) => f.item.equipped.length === 0),
      others.map((f) => f.item.equipped.length).join(','));

    process.env.UB2_ITEM_SEAT = '3';
    const three = mod.createMatch(arena, six());
    ok('ON/seat 3: 🔴 the carrier SEAT is honoured, not hard-coded to 0 — a fixture pinned to slot 0 would pass every row above',
      three.fighters[3].item.equipped.length === 2
      && three.fighters.filter((f) => f.item.equipped.length > 0).length === 1,
      three.fighters.map((f) => f.item.equipped.length).join(','));

    delete process.env.UB2_ITEMS; delete process.env.UB2_ITEM_SEAT;
    const off2 = mod.createMatch(arena, six());
    ok('OFF again: turning the environment back off restores the control — the state is not sticky',
      off2.fighters.every((f) => f.item.equipped.length === 0));

    // ── THE POSITIVE-CONTROL LEVER, BOTH DIRECTIONS ────────────────────────
    ok('HP OFF: with no boost every seat carries the roster maxHp — the control multiplies by ONE',
      new Set(off2.fighters.map((f) => f.maxHp)).size === 1,
      off2.fighters.map((f) => f.maxHp).join(','));
    process.env.UB2_BOOST_HP = '3'; process.env.UB2_BOOST_SEAT = '2';
    const boosted = mod.createMatch(arena, six());
    ok('HP ON: 🔴 seat 2 and ONLY seat 2 is boosted x3 — the lever that proves the rig can see a seat advantage at all',
      boosted.fighters[2].maxHp === off2.fighters[2].maxHp * 3
      && boosted.fighters.filter((f, i) => i !== 2).every((f, i) => f.maxHp === off2.fighters[i < 2 ? i : i + 1].maxHp),
      boosted.fighters.map((f) => f.maxHp).join(','));
    delete process.env.UB2_BOOST_HP; delete process.env.UB2_BOOST_SEAT;

    // ── THE COOLDOWN DIAL, BOTH DIRECTIONS ─────────────────────────────────
    // Driven through `itemUsable`, which is the function the dial patches — a check that
    // read `ITEMS.warm_milk.cooldownMs` instead would be reading the registry the dial does
    // NOT touch and would pass no matter what the patch did.
    const cm = await import(pathToFileURL(join(r.gameDir, 'combat.ts')).href);
    const cdState = () => {
      process.env.UB2_ITEMS = 'warm_milk';
      const st = mod.createMatch(arena, six());
      delete process.env.UB2_ITEMS;
      st.phase = 'playing';
      return st;
    };
    {
      const st = cdState();
      delete process.env.UB2_CD;
      ok('CD OFF: a fresh slot is usable, and stamping `lastUsed` just now makes it NOT — the gate is live',
        cm.itemUsable(st, st.fighters[0], 0)
        && (st.fighters[0].item.lastUsed[0] = st.elapsed, !cm.itemUsable(st, st.fighters[0], 0)));
      // One millisecond past the authored cooldown: usable at x1, refused at x3.
      st.elapsed = st.fighters[0].item.lastUsed[0] + 5001;
      ok('CD OFF: 🔴 one ms past the authored 5,000 ms cooldown the slot is BACK — duration equals cooldown, so uptime is 100% by construction',
        cm.itemUsable(st, st.fighters[0], 0));
      process.env.UB2_CD = '3';
      ok('CD ON: 🔴 the same instant is REFUSED at x3 — the dial reaches the gate the sim actually consults',
        !cm.itemUsable(st, st.fighters[0], 0));
      st.elapsed = st.fighters[0].item.lastUsed[0] + 15001;
      ok('CD ON: …and accepted once 3x the cooldown has passed, so the dial is a MULTIPLIER and not an off switch',
        cm.itemUsable(st, st.fighters[0], 0));
      delete process.env.UB2_CD;
    }

    console.log(fails === 0 ? '\n  verify: all rows green' : `\n  verify: ${fails} FAILED`);
    if (fails) process.exit(1);
  }
}
