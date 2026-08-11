#!/usr/bin/env node
/**
 * Score a blind identify-at-real-size round, and build the confusion matrix.
 *
 * The judge never sees the key; scoring happens here. `docs/LESSONS.md` §3 warns that a
 * bare count cannot tell a DISTINGUISHABILITY failure (two icons swapping with each
 * other) from a LEGIBILITY failure (nobody can name it at all), and those have different
 * fixes — so this prints the matrix, not just the number.
 *
 *   node tools/tmp/icon_score.mjs shots/icons/accept2/before/answers.json
 *
 * The answers file is [{ judge, plate, key, mode, lines: [...] }].
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** True only when this file is the process entry point.
 *
 *  `ic_pair.mjs` needs the SUBJECT map and `subjectOf()` — a paired round is scored by
 *  exactly the same rulebook as a plain one, and a SECOND COPY of a 65-entry map is the
 *  defect `gatecount` exists to refuse one level up: today's agreeing copy is next
 *  month's stale one. Importing it means the CLI body below must not run on import, or
 *  `readFileSync(process.argv[2])` fires with someone else's arguments. */
const IS_MAIN = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

/** Forced-choice candidate text -> icon name. Fixed before any judge ran.
 *
 *  ⚠️ LOOKUPS GO THROUGH `subjectOf()`, NEVER THROUGH THIS OBJECT DIRECTLY. The scorer
 *  lowercases every judge answer before matching, and `'a close X'` below carries a
 *  capital X — so a judge who answered that tile *exactly right* was scored WRONG. The
 *  `--selftest` added below caught it on its first run, one line after this map grew to
 *  65 subjects; before that this instrument had never been shown a known-bad input at
 *  all. CLAUDE.md non-negotiable #6. */
export const SUBJECT = {
  'a hammer or mallet': 'hammer',
  'seaweed': 'seaweed',
  'a bottle cap': 'cap',
  'an impact burst / explosion star': 'burst',
  'a tomato': 'tomato',
  'a rolled burrito': 'wrap',
  'an onion': 'onion',
  'a baby chick': 'chick',
  'a chunk of meat on the bone': 'meat',
  'a pot of honey': 'honey',
  'a wrapped candy': 'candy',
  'a fish': 'fish',
  'a grilled burger patty': 'patty',
  'a bowl of rice': 'rice',
  'a lollipop': 'lollipop',
  'a spinning cyclone or vortex': 'swirl',
  'a bowl of noodles': 'noodle',
  'a fish caught on a hook': 'puffer',
  'a ketchup squeeze bottle': 'ketchupslip',
  'an egg': 'egg',
  'a wedge of cheese': 'cheese',
  'a breaking wave': 'wave',
  'glass shards': 'shards',
  // SUBJECT CHANGED (DECISIONS-FOR-URI §10, Uri: "do it"). The glyph is no longer a bottle.
  // The before/after rounds therefore differ by exactly this one candidate string — stated
  // rather than hidden, because it means the two rounds are not byte-identical tasks.
  'a hot dog with mustard': 'mustardblast',
  'water droplets': 'droplets',
  'a sword slash': 'slash',
  'dough balls': 'dough',
  'a lettuce leaf': 'lettuce',

  // ── The 37 UI_ICONS. Added for the CROSS-FAMILY round. ────────────────────
  // docs/DECISIONS-FOR-URI.md §10: these had never been measured, and one judge
  // answered "coin" to a FOOD icon — so the two families' collisions with each other
  // were unmeasured, which is a worse defect than any single glyph, because a food
  // icon and a currency icon carry opposite meanings in the same screen.
  // Written from each icon's own comment in `ui.ts`, not from any judge's output.
  'a gold coin': 'coin',
  'a cut gemstone': 'gem',
  'a trophy cup': 'trophy',
  'a five-pointed star': 'star',
  'a sparkle / twinkle': 'sparkle',
  'a chequered finish flag': 'flag',
  'a map pin': 'pin',
  'a treasure chest': 'chest',
  'a loot box with a burger on it': 'boxBurger',
  'a purple loot box': 'boxPineapple',
  'a red loot box with a bow': 'boxRed',
  'a dark loot box with a flame on it': 'boxFire',
  'a wrapped gift': 'gift',
  'a gear / cog': 'gear',
  'a padlock': 'lock',
  'a play button triangle': 'play',
  'a pause button': 'pause',
  'a back arrow': 'back',
  'a close X': 'close',
  'a tick / checkmark': 'check',
  'a house': 'home',
  'two circling swap arrows': 'swap',
  'a muted speaker': 'mute',
  'a speaker with sound waves': 'sound',
  'a traffic cone': 'cone',
  "a chef's hat": 'chefhat',
  'a person wearing a chef hat': 'avatar',
  'a sword': 'damage',
  'a red heart': 'health',
  'a lightning bolt': 'speed',
  'a double-headed arrow': 'range',
  'a stopwatch': 'timer',
  'a green heart with a cross': 'heal',
  // ⚠️ THIS CANDIDATE STRING IS A DESCRIPTION OF THE CURRENT DRAWING, NOT OF THE ABILITY,
  // AND THAT MAKES `stun` UNFIXABLE ON THIS INSTRUMENT. Any redraw that leaves the star
  // family has NO CORRECT STRING TO BE SCORED AGAINST — it would be marked wrong for
  // succeeding. Every other entry here names a THING (a padlock, a tomato, a stopwatch);
  // this one names a composition. It is the reason `stun` has only ever been usable as an
  // ILLEGIBLE TWIN — which it is very good at: 3 of 3 judges split it magnified and 2 of 3
  // native at r13, 5 of 6 at r12, 3 of 3 at r11, i.e. the most reliable failing-twin
  // bracket this instrument has.
  // 🔴 NOT CHANGED HERE, DELIBERATELY. Adding a second entry changes the TASK, so the
  // round that adds it is not comparable with the rounds before it — `DECISIONS-FOR-URI`
  // §30 did exactly that for `mustardblast` and had to declare it. Whoever redraws `stun`
  // must add the string IN THE SAME COMMIT as the redraw and say so in the message, and
  // must not do it in a round that is measuring anything else.
  'a big star with a small star beside it': 'stun',
  'a snail shell spiral': 'slow',
  'a medal on ribbons': 'medal',
  'a party popper': 'party',
};

/** Confusions that are DESIGNED IN and are therefore not defects.
 *
 *  `ui.ts` states it outright: the four purchasable boxes "share one silhouette and
 *  differ by colourway plus a lid emblem, so they read as a family and as a ladder —
 *  which is what they are." A judge who calls the purple box the red box has read the
 *  design correctly and picked the wrong rung. Scoring that as a swap would report the
 *  intent as a bug. Declared BEFORE any judge ran, so it cannot be tuned afterwards.
 *  Nothing else is exempt — `health`/`heal` are NOT exempt, because a heart that means
 *  "damage taken" and a heart that means "healing" are opposite meanings. */
export const BY_DESIGN = new Set(['boxBurger', 'boxPineapple', 'boxRed', 'boxFire']);

/** Case-insensitive subject lookup — see the warning on `SUBJECT`. */
export const SUBJECT_LC = new Map(Object.entries(SUBJECT).map(([t, n]) => [t.toLowerCase().trim(), n]));
export const subjectOf = (raw) => SUBJECT_LC.get(String(raw).toLowerCase().trim());

/**
 * Free-form normalisation, applied identically to every run so the before/after delta is
 * valid whatever you think of the leniency:
 *  - a hedged answer ("mallet / hammer") is split on "/" and counts if ANY branch matches;
 *  - a leading colour or size adjective is dropped ("blue fish" -> "fish"), because a
 *    colour word describes the fill, not the subject, and the subject is what is being
 *    tested.
 */
const ADJ = /^(red|blue|green|brown|orange|yellow|golden|gold|pink|purple|white|black|grey|gray|big|small|little|large|tiny)\s+/;
function freeVariants(raw) {
  const out = [];
  for (const part of raw.split('/')) {
    const t = part.trim().replace(/\s+/g, ' ');
    if (!t) continue;
    out.push(t);
    const stripped = t.replace(ADJ, '');
    if (stripped !== t) out.push(stripped);
  }
  return out;
}

/** Free-form arm: accepted answers per icon. Written from the ICON's intent, not from
 *  any judge's output, so it cannot be tuned after the fact. */
export const FREE = {
  patty: ['patty', 'burger patty', 'hamburger patty', 'beef patty', 'grilled patty', 'meat patty'],
  meat: ['meat on the bone', 'drumstick', 'ham', 'meat', 'ham hock', 'meat on bone', 'chicken leg'],
  tomato: ['tomato'],
  lettuce: ['lettuce', 'lettuce leaf', 'cabbage', 'leaf'],
  onion: ['onion', 'garlic', 'garlic bulb'],
  candy: ['candy', 'wrapped candy', 'sweet', 'toffee', 'bonbon'],
  swirl: ['cyclone', 'swirl', 'spiral', 'whirlwind', 'vortex', 'tornado', 'swirl button'],
  chick: ['chick', 'baby chick', 'baby chicken', 'chicken', 'bird'],
  burst: ['burst', 'impact burst', 'starburst', 'explosion', 'star spark', 'spark', 'impact', 'star burst'],
  hammer: ['hammer', 'mallet', 'sledgehammer', 'mallet hammer', 'hammer mallet'],
  dough: ['dough', 'dough balls', 'dough ball'],
  cheese: ['cheese', 'cheese wedge', 'wedge of cheese', 'slice of cheese'],
  rice: ['rice', 'rice bowl', 'bowl of rice'],
  seaweed: ['seaweed', 'kelp', 'seaweed frond'],
  fish: ['fish'],
  puffer: ['fish on a hook', 'hooked fish', 'fish on hook', 'pufferfish', 'fishing'],
  droplets: ['droplets', 'water droplets', 'water drops', 'water droplet', 'raindrops', 'drops'],
  noodle: ['noodles', 'bowl of noodles', 'noodle bowl', 'ramen', 'pasta bowl'],
  wave: ['wave', 'breaking wave', 'ocean wave', 'wave curl'],
  shards: ['shards', 'glass shards', 'ice shards', 'broken glass', 'shattered glass'],
  cap: ['bottle cap', 'cap', 'crown cap'],
  // Subject changed from a squeeze bottle to the hot dog itself. The old bottle answers
  // are kept above the new ones rather than deleted: a free-form round scored before the
  // change is still scored by the same rulebook, which is the only way its number stays
  // comparable. CLAUDE.md — "change it and keep the old wording above it with the reason".
  //   was: ['mustard bottle', 'mustard', 'mustard squeeze bottle', 'squeeze bottle']
  mustardblast: ['mustard bottle', 'mustard', 'mustard squeeze bottle', 'squeeze bottle',
    'hot dog', 'hotdog', 'hot dog with mustard', 'sausage in a bun', 'hot dog in a bun'],
  ketchupslip: ['ketchup bottle', 'ketchup', 'ketchup squeeze bottle', 'sauce bottle', 'squeeze bottle'],
  // A judge who writes "claw slash mark" or "scratch marks" HAS identified a slash; the
  // first scoring pass counted those wrong, which was a scorer bug rather than an icon
  // defect. Added before the second round and re-run over the first, so both rounds are
  // scored by the same rulebook.
  slash: ['slash', 'sword slash', 'blade slash', 'blade', 'sword', 'slash mark', 'slash marks',
    'claw slash', 'claw slash mark', 'claw marks', 'claw mark', 'scratch marks', 'scratch mark',
    'scratches', 'swipe'],
  wrap: ['burrito', 'wrap', 'rolled burrito', 'burrito wrap', 'tortilla'],
  lollipop: ['lollipop', 'lolly'],
  egg: ['egg'],
  honey: ['honey', 'honey pot', 'pot of honey', 'honey jar', 'jar of honey'],
};

/**
 * ── SELFTEST: the known-bad-input check this instrument shipped without ──────
 *
 * `CLAUDE.md` non-negotiable #6 — a guard that has not been shown to FAIL on the thing
 * it guards against is not a guard. This scorer was believed for a whole icon pass
 * without ever being shown a wrong answer sheet, so:
 *
 *   PERFECT   every tile answered with its own subject      -> must be n/n, no swaps
 *   SHIFTED   every tile answered with the NEXT tile's       -> must be 0/n
 *   SELF-PAIR two icons answered as each other, rest perfect -> must report exactly
 *             that one swap, and nothing else
 *   BLANK     no answers at all                              -> must be 0/n
 *
 * The SELF-PAIR case is the one that matters: a scorer that counts misses but cannot
 * see a MUTUAL confusion is exactly the bare count `docs/LESSONS.md` §3 warns about,
 * and it would have reported the mustardblast/ketchupslip collapse as "no change".
 *
 *   node tools/tmp/icon_score.mjs --selftest
 */
if (IS_MAIN && process.argv[2] === '--selftest') {
  const names = Object.values(SUBJECT);
  const rev = new Map(Object.entries(SUBJECT).map(([text, n]) => [n, text]));
  const tiles = names.map((name, i) => ({ i: i + 1, name }));
  const N = tiles.length;
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}  got ${JSON.stringify(got)}`);
    ok ? pass++ : fail++;
  };
  /** Re-implements the scorer's forced-choice path over synthetic answers. */
  const run = (lines) => {
    const answers = new Map();
    for (const line of lines) {
      const m = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
      if (m) answers.set(Number(m[1]), m[2].toLowerCase().trim());
    }
    let hit = 0;
    const conf = new Map();
    for (const { i, name } of tiles) {
      const raw = answers.get(i) ?? '(blank)';
      const given = subjectOf(raw) ?? `?${raw}`;
      if (given === name) hit++;
      else conf.set(`${name} <-> ${given}`, (conf.get(`${name} <-> ${given}`) ?? 0) + 1);
    }
    const swaps = [];
    const seen = new Set();
    for (const k of conf.keys()) {
      const [x, y] = k.split(' <-> ');
      if (conf.has(`${y} <-> ${x}`) && !seen.has(`${y} <-> ${x}`)) { seen.add(k); swaps.push(`${x} <-> ${y}`); }
    }
    return { hit, swaps: swaps.sort() };
  };
  const perfect = tiles.map((t) => `${t.i}. ${rev.get(t.name)}`);
  check('PERFECT scores n/n', run(perfect).hit, N);
  check('PERFECT reports no swap', run(perfect).swaps, []);
  check('SHIFTED scores 0', run(tiles.map((t, k) => `${t.i}. ${rev.get(tiles[(k + 1) % N].name)}`)).hit, 0);
  check('BLANK scores 0', run([]).hit, 0);
  // SELF-PAIR: swap the answers on tiles 1 and 2 only.
  const paired = [...perfect];
  paired[0] = `1. ${rev.get(tiles[1].name)}`;
  paired[1] = `2. ${rev.get(tiles[0].name)}`;
  const sp = run(paired);
  check('SELF-PAIR scores n-2', sp.hit, N - 2);
  check('SELF-PAIR reports exactly one swap', sp.swaps, [[tiles[0].name, tiles[1].name].sort().join(' <-> ')]);
  // A ONE-WAY miss must NOT be reported as a swap.
  const oneWay = [...perfect];
  oneWay[0] = `1. ${rev.get(tiles[1].name)}`;
  check('ONE-WAY miss is not a swap', run(oneWay).swaps, []);
  // An unrecognised answer string must miss, not silently pass.
  const junk = [...perfect];
  junk[0] = '1. a thing i have never heard of';
  check('UNKNOWN answer scores as a miss', run(junk).hit, N - 1);
  // ⚠️ REGRESSION CASE. `'a close X'` is stored with a capital X and every judge answer
  // is lowercased before matching, so the raw-object lookup scored a CORRECT answer as
  // wrong. That is what dropped PERFECT to 64/65 the first time this selftest ran.
  const shout = tiles.map((t) => `${t.i}. ${rev.get(t.name).toUpperCase()}`);
  check('CASE-INSENSITIVE: shouted answers still score n/n', run(shout).hit, N);
  console.log(`\nselftest ${pass} pass / ${fail} fail  (subjects: ${N})`);
  process.exit(fail ? 1 : 0);
}

if (IS_MAIN) {
const runs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const confusion = new Map(); // "truth->given" -> count
const perIcon = new Map();   // icon -> { seen, hit, given: Map }

for (const run of runs) {
  const key = JSON.parse(readFileSync(run.key, 'utf8'));
  const answers = new Map();
  for (const line of run.lines) {
    const m = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
    if (m) answers.set(Number(m[1]), m[2].toLowerCase().trim());
  }
  let hit = 0;
  const misses = [];
  for (const { i, name } of key.tiles) {
    const raw = answers.get(i) ?? '(blank)';
    let given;
    if (run.mode === 'forced') {
      given = subjectOf(raw) ?? `?${raw}`;
    } else {
      const list = FREE[name] ?? [];
      given = freeVariants(raw).some((v) => list.includes(v)) ? name : `?${raw}`;
    }
    const ok = given === name;
    if (ok) hit++; else misses.push(`${name} -> ${raw}`);
    const p = perIcon.get(name) ?? { seen: 0, hit: 0, given: new Map() };
    p.seen++; if (ok) p.hit++;
    if (!ok) p.given.set(raw, (p.given.get(raw) ?? 0) + 1);
    perIcon.set(name, p);
    if (!ok && run.mode === 'forced') {
      const k = `${name} <-> ${given}`;
      confusion.set(k, (confusion.get(k) ?? 0) + 1);
    }
  }
  // `/28` was hardcoded here, which was correct while `food` was the only set that could
  // be rendered. The cross-family plate is 65 tiles, so a fixed denominator would have
  // silently reported 24/65 as 24/28 — the kind of confident wrong answer non-negotiable
  // #6 is about. Denominator now comes from the key.
  console.log(`${run.judge}  ${run.mode.padEnd(6)}  ${run.plate.padEnd(16)}  ${hit}/${key.tiles.length}`);
  for (const m of misses) console.log(`      MISS  ${m}`);
  console.log('');
}

// ── Per-icon roll-up, ordered worst first. ───────────────────────────────────
console.log('ICON'.padEnd(14) + 'HIT/SEEN   most common wrong answers');
const rows = [...perIcon.entries()].sort((a, b) => (a[1].hit / a[1].seen) - (b[1].hit / b[1].seen));
for (const [name, p] of rows) {
  const wrong = [...p.given.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} x${v}`).join(', ');
  console.log(name.padEnd(14) + `${p.hit}/${p.seen}`.padEnd(11) + wrong);
}

// ── CROSS-FAMILY roll-up. Only meaningful on the `all` plate. ────────────────
// The question §10 parked is not "how legible is the set" but "does a FOOD icon get
// read as a UI icon, or the reverse" — a food glyph answered "coin" is a worse defect
// than an unnameable one, because currency and weapons carry opposite meanings on the
// same screen. Reported separately from the aggregate: CLAUDE.md #10, a paired
// per-item count and an aggregate are different quantities.
const FOOD_SET = new Set(Object.keys(FREE));
const isFood = (n) => FOOD_SET.has(n);
const cross = [];
for (const [k, v] of confusion) {
  const [truth, given] = k.split(' <-> ');
  if (given.startsWith('?')) continue;
  if (isFood(truth) !== isFood(given)) cross.push([`${truth} (${isFood(truth) ? 'food' : 'ui'}) -> ${given} (${isFood(given) ? 'food' : 'ui'})`, v]);
}
if (cross.length) {
  console.log('\nCROSS-FAMILY misreads (a food icon named as a UI icon, or the reverse):');
  for (const [k, v] of cross.sort((x, y) => y[1] - x[1])) console.log(`  x${v}  ${k}`);
} else {
  console.log('\nCROSS-FAMILY misreads: none');
}

// ── Mutual swaps: the pairs the acceptance test forbids. ─────────────────────
console.log('\nSWAPS (forced-choice arm; A named as B while B named as A):');
const seen = new Set();
let anySwap = false;
for (const k of confusion.keys()) {
  const [a, b] = k.split(' <-> ');
  const back = `${b} <-> ${a}`;
  if (confusion.has(back) && !seen.has(back)) {
    seen.add(k);
    // The four purchasable boxes are one silhouette in four colourways ON PURPOSE.
    if (BY_DESIGN.has(a) && BY_DESIGN.has(b)) {
      console.log(`  ${a} <-> ${b}   (${confusion.get(k)} + ${confusion.get(back)})  [BY DESIGN — one silhouette, four colourways; not a defect]`);
      continue;
    }
    anySwap = true;
    console.log(`  ${a} <-> ${b}   (${confusion.get(k)} + ${confusion.get(back)})`);
  }
}
if (!anySwap) console.log('  none');
}
