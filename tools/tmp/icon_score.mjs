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

/** Forced-choice candidate text -> icon name. Fixed before any judge ran. */
const SUBJECT = {
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
  'a mustard squeeze bottle': 'mustardblast',
  'water droplets': 'droplets',
  'a sword slash': 'slash',
  'dough balls': 'dough',
  'a lettuce leaf': 'lettuce',
};

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
const FREE = {
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
  mustardblast: ['mustard bottle', 'mustard', 'mustard squeeze bottle', 'squeeze bottle'],
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
      given = SUBJECT[raw] ?? `?${raw}`;
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
  console.log(`${run.judge}  ${run.mode.padEnd(6)}  ${run.plate.padEnd(16)}  ${hit}/28`);
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

// ── Mutual swaps: the pairs the acceptance test forbids. ─────────────────────
console.log('\nSWAPS (forced-choice arm; A named as B while B named as A):');
const seen = new Set();
let anySwap = false;
for (const k of confusion.keys()) {
  const [a, b] = k.split(' <-> ');
  const back = `${b} <-> ${a}`;
  if (confusion.has(back) && !seen.has(back)) {
    seen.add(k);
    anySwap = true;
    console.log(`  ${a} <-> ${b}   (${confusion.get(k)} + ${confusion.get(back)})`);
  }
}
if (!anySwap) console.log('  none');
