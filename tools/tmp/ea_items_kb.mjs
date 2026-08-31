#!/usr/bin/env node
/**
 * ea_items_kb — the KNOWN-BAD battery for the item acquisition path.
 *
 *   node tools/tmp/ea_items_kb.mjs
 *   node tools/tmp/ea_items_kb.mjs --selftest
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `economy.test.mjs` went from 285/10 to 375/0 across this change. That number on its
 * own is worth nothing. `CLAUDE.md` non-negotiable 6: **a guard that has not been shown
 * to FAIL on the bug it guards against is not a guard** — and this feature is the
 * canonical example. Before this commit the suite was GREEN while:
 *
 *   * `Reward` had no `items` field,
 *   * `rollContainer` had no item branch,
 *   * five containers declared item rows that could never pay out,
 *   * the trophy road carried seven `itemSurprise` nodes that resolved to nothing,
 *   * and `economy.test.mjs`'s own label-builder labelled a rolled item `''`.
 *
 * Nothing was red, because no assertion asked "can a player ever hold one of these?"
 * So the new assertions have to be shown to answer that question and not merely to pass.
 *
 * ── HOW ─────────────────────────────────────────────────────────────────────
 * Copy `src/` to a scratch tree, PLANT one real defect in the copy, run the real test
 * against it, and require (a) a non-zero exit and (b) the SPECIFIC named check in the
 * failure list. (b) is the half that matters: a planted bug that turns the suite red
 * somewhere else has proved nothing about the assertion it was aimed at.
 *
 * 🚨 AND (c): THE PLANT MUST HAVE LANDED. Every mutation asserts its own `before` text
 * was present in the file — a `String.replace` that matches nothing is a no-op, the
 * suite stays green, and a no-op mutation reads EXACTLY like "the guard failed to fire".
 * That is this project's vacuity trap wearing a different hat: `[].every()` is true and
 * so is "the bug I never actually planted was not detected".
 *
 * ── WHAT THIS TOOL CANNOT TELL YOU ──────────────────────────────────────────
 * That the assertions are pointed at the right THING. `--selftest` validates this
 * harness's logic — that it can distinguish a landed plant from a no-op and a targeted
 * failure from collateral. It says nothing about whether the ten items are the right ten
 * or whether the odds are the right odds. `valuescan` read a perfect selftest with 14 of
 * 18 stations in the wrong quadrant.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SELFTEST = process.argv.includes('--selftest');

/**
 * Each case: a file under `src/`, a `before` string that MUST be present, the `after`
 * that plants the defect, and the assertion name that must appear in the failure list.
 *
 * `want` is a substring of the check's name, because the names carry em-dashes and
 * apostrophes that are miserable to match exactly and trivial to match loosely.
 */
const CASES = [
  {
    id: 'roller-cannot-award',
    why: 'THE bug. Odds published for an outcome `rollContainer` has no branch for — the'
      + ' false disclosure that put this feature on a branch.',
    file: 'game/economy/containers.ts',
    before: '  if (entry.itemRarity) {\n    const pool = ITEMS_BY_RARITY[entry.itemRarity] ?? [];',
    after: '  if (false && entry.itemRarity) {\n    const pool = ITEMS_BY_RARITY[entry.itemRarity] ?? [];',
    want: 'every published row above 1% is actually produced',
  },
  {
    id: 'odds-say-nothing',
    why: 'The state the sheet shipped in: an item row falling through to the currency'
      + ' branch and being published to the player as the literal string "Nothing".',
    file: 'game/economy/containers.ts',
    before: '    } else if (entry.itemRarity) {',
    after: '    } else if (false && entry.itemRarity) {',
    want: 'every published item row is labelled as an item, never as "Nothing"',
  },
  {
    id: 'vacuous-item-rows',
    why: 'The vacuity trap itself. Strip every item row from every container and the'
      + ' quantifiers over them are all true. The NON-EMPTY guard must be what fires.',
    file: 'game/economy/tuning.ts',
    before: 'itemRarity?: Rarity;',
    after: 'itemRarity?: never;',
    mutate: (src) => src.replace(/\{ weight: ([\d.]+), itemRarity: '(\w+)' \}/g,
      (_m, w) => `{ weight: ${w}, coins: 1 }`),
    want: 'the set of container rows that reference an item tier is NON-EMPTY',
  },
  {
    id: 'duplicate-while-unowned',
    why: 'Hand over a second Squid Ink while Pompa sits unowned in the same pool —'
      + ' "technically fair, and universally read as a bug".',
    file: 'game/economy/containers.ts',
    before: '    const wanted = pool.filter((id) => !ownedItems.has(id));',
    after: '    const wanted = [];',
    want: 'a box never gives a duplicate item while an unowned item shares the pool',
  },
  {
    id: 'surprise-ignores-floor',
    why: 'A Neon-floor road node quietly paying a Normal item. `minRarity` is published'
      + ' on the node face, so ignoring it is a false statement on the road screen.',
    file: 'game/economy/trophyRoad.ts',
    before: '  const floor = RARITY_ORDER.indexOf(minRarity);\n  if (floor < 0) return [];',
    after: '  const floor = 0;\n  if (floor < 0) return [];',
    want: 'a surprise NEVER pays below its published floor',
  },
  {
    id: 'surprise-not-deterministic',
    why: 'Key the road draw on something the player can move. `rng.ts` reasons at length'
      + ' about exactly this and the reasoning was never asserted.',
    file: 'game/economy/trophyRoad.ts',
    before: '  const rng = createRng(roadSurpriseSeed(seed, threshold));',
    after: '  const rng = createRng(roadSurpriseSeed(seed, threshold) + (globalThis.__kb = (globalThis.__kb ?? 0) + 1));',
    want: 'a surprise resolves to the same item every time for the same player',
  },
  {
    id: 'items-not-persisted',
    why: 'Items awarded and then lost on reload — the failure a player notices and never'
      + ' forgives, and the one `serialize`/`deserialize` exist to make impossible.',
    file: 'game/economy/state.ts',
    before: '    items: [...state.items],',
    after: '',
    want: 'items survive a serialise/deserialise round trip',
  },
  {
    id: 'items-described-first',
    why: 'Position is load-bearing: `trophyRoad.ts:rewardIcons` pairs icons to these'
      + ' lines BY INDEX, so an item emitted early captions somebody else\'s icon.',
    file: 'game/economy/reward.ts',
    // ⚠️ THE FIRST VERSION OF THIS PLANT WAS WRONG AND THE BATTERY SAID SO. It only
    // ADDED a leading item loop and left the trailing one in place, so items were
    // described TWICE — items still appeared last, the positional check correctly
    // passed, and two unrelated checks fired instead. A known-bad that does not
    // reproduce the bug proves nothing about the guard aimed at it. It MOVES the loop
    // now: delete from the tail, insert at the head.
    before: '  for (const id of r.items) {\n    out.push({ emoji: ITEM_EMOJI, label: ITEMS[id].name });\n  }\n  return out;',
    after: '  return out;',
    mutate: (src) => src.replace(
      '  const out: { emoji: string; label: string }[] = [];\n  for (const id of r.characters) {',
      '  const out: { emoji: string; label: string }[] = [];\n'
      + '  for (const id of r.items) out.push({ emoji: ITEM_EMOJI, label: ITEMS[id].name });\n'
      + '  for (const id of r.characters) {',
    ),
    want: 'items are described LAST',
  },
  {
    id: 'weightedpick-returns-zero',
    why: 'The exact footgun `rng.ts` documents: -1 becoming index 0 turns an exhausted'
      + ' band into "you win Tenderiser", silently, on the rarest node on the road.',
    file: 'game/economy/rng.ts',
    before: '  if (weights.length === 0) return -1;\n  let total = 0;',
    after: '  if (weights.length === 0) return 0;\n  let total = 0;',
    want: 'weightedPick returns -1 for an empty list',
  },
  {
    id: 'starter-item-missing',
    why: 'A new player with an empty loadout screen cannot discover the feature exists'
      + ' until their first chest. `STARTER_ITEM` is the assumption that prevents it.',
    file: 'game/economy/state.ts',
    before: '    items: [STARTER_ITEM],\n    winsTowardChest: 0,',
    after: '    items: [],\n    winsTowardChest: 0,',
    want: 'a brand-new player owns exactly the starter item',
  },
];

// ── The harness ─────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
}

/** Run `economy.test.mjs` inside a scratch copy of `src/`. Returns the failure names. */
function runIn(dir) {
  try {
    execFileSync(process.execPath, [join(dir, 'game/economy/economy.test.mjs')], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exit: 0, out: '', failed: [] };
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    const failed = [...out.matchAll(/^ {2}- (.+)$/gm)].map((m) => m[1]);
    return { exit: err.status ?? 1, out, failed };
  }
}

function withScratch(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ea-kb-'));
  try {
    cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
    return fn(join(dir, 'src'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Apply one case's mutation. Throws if the `before` text is not present. */
function plant(srcDir, kase) {
  const path = join(srcDir, kase.file);
  const original = readFileSync(path, 'utf8');
  if (!original.includes(kase.before)) {
    throw new Error(`plant "${kase.id}": anchor not found in ${kase.file}\n  ${JSON.stringify(kase.before.slice(0, 80))}`);
  }
  let next = original.replace(kase.before, kase.after);
  if (kase.mutate) next = kase.mutate(next);
  if (next === original) throw new Error(`plant "${kase.id}": mutation was a no-op`);
  writeFileSync(path, next);
}

// ── MOVES: the clean tree is green ──────────────────────────────────────────

console.log('\nea_items_kb — known-bad battery for the item acquisition path\n');
console.log('CONTROL');
const control = withScratch((srcDir) => runIn(srcDir));
check('an unmutated copy of the tree passes economy.test.mjs',
  control.exit === 0, `exit ${control.exit}, ${control.failed.length} failures: ${control.failed.slice(0, 3).join(' | ')}`);

// ── Each planted defect must turn its OWN assertion red ─────────────────────

console.log('\nPLANTED DEFECTS');
for (const kase of CASES) {
  let result;
  let planted = true;
  try {
    result = withScratch((srcDir) => { plant(srcDir, kase); return runIn(srcDir); });
  } catch (err) {
    planted = false;
    result = { exit: -1, out: String(err.message), failed: [] };
  }
  const hit = result.failed.filter((n) => n.includes(kase.want));
  check(`${kase.id}: the mutation landed`, planted, result.out.slice(0, 300));
  check(`${kase.id}: the suite goes RED`, planted && result.exit !== 0,
    `exit ${result.exit}`);
  check(`${kase.id}: and "${kase.want}" is what fires`, hit.length > 0,
    planted
      ? `red checks were: ${result.failed.slice(0, 6).join(' | ') || '(none — the suite crashed or passed)'}`
      : 'mutation never landed, so this proves nothing');
}

// ── SELFTEST: can this harness tell a landed plant from a no-op? ────────────

if (SELFTEST) {
  console.log('\nSELFTEST');

  // §A — a mutation whose anchor is absent must be REFUSED, not silently skipped.
  let refused = false;
  try {
    withScratch((srcDir) => plant(srcDir, {
      id: 'nonsense', file: 'game/economy/reward.ts',
      before: 'this string is not in the file', after: 'x',
    }));
  } catch { refused = true; }
  check('§A a plant with a missing anchor throws instead of no-opping', refused);

  // §B — a mutation that changes nothing must be REFUSED. This is the arm that stops
  // "the guard did not fire" being reported for a bug that was never planted.
  let refusedNoop = false;
  try {
    withScratch((srcDir) => plant(srcDir, {
      id: 'noop', file: 'game/economy/reward.ts',
      before: 'export function emptyReward', after: 'export function emptyReward',
    }));
  } catch { refusedNoop = true; }
  check('§B a plant that is a no-op throws rather than reporting a miss', refusedNoop);

  // §C — the failure-name parser must actually parse names. A parser that always
  // returns [] would make every "and X is what fires" check fail loudly; a parser that
  // matched everything would make them all pass. Drive it with a known output shape.
  const parsed = [...'\n  - alpha check\n  - beta check\n'.matchAll(/^ {2}- (.+)$/gm)].map((m) => m[1]);
  check('§C the failure-list parser reads names off the suite output',
    parsed.length === 2 && parsed[0] === 'alpha check' && parsed[1] === 'beta check',
    JSON.stringify(parsed));

  // §D — COLLATERAL. A defect unrelated to items must NOT satisfy an item assertion.
  // Without this arm, "the suite goes red" would be indistinguishable from "the right
  // assertion fired", and every case above would be a `>= 1 failure` check in disguise.
  const collateral = withScratch((srcDir) => {
    plant(srcDir, {
      id: 'unrelated', file: 'game/economy/trophyRoad.ts',
      before: 'export function trophyLoss(trophies: number): number {',
      after: 'export function trophyLoss(trophies: number): number {\n  if (trophies >= 0) return 999;',
    });
    return runIn(srcDir);
  });
  const itemChecksHit = collateral.failed.filter((n) => CASES.some((c) => n.includes(c.want)));
  check('§D an unrelated defect turns the suite red', collateral.exit !== 0,
    `exit ${collateral.exit}`);
  check('§D ...without firing a single item assertion', itemChecksHit.length === 0,
    itemChecksHit.join(' | '));

  // §E — every case must name a DISTINCT assertion. Two cases pointed at one check is
  // one guard reported twice, which inflates the battery without covering anything.
  const wants = CASES.map((c) => c.want);
  check('§E every planted defect targets a distinct assertion',
    new Set(wants).size === wants.length, wants.join(' | '));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailed:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
