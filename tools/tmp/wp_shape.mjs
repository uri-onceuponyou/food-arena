#!/usr/bin/env node
/**
 * WP_SHAPE — the KIT SHAPE, guarded. Uri, 2026-08-24:
 *
 *   > *"Change weapons - All characters have 3 weapons (melee, short range, long range)
 *   > + Super. Adapt accordingly. Invent new weapons if needed."*
 *
 *   node tools/tmp/wp_shape.mjs              # the matrix. exit 1 on any fault.
 *   node tools/tmp/wp_shape.mjs --table      # + one line per character
 *   node tools/tmp/wp_shape.mjs --selftest   # the known-bads
 *   node tools/tmp/wp_shape.mjs --json out.json
 *
 * Offline, no browser, no GPU, ~1 s. Read-only on `src/`. Owner prefix: `wp_*`.
 *
 * ── WHY A GUARD AND NOT A COMMENT ───────────────────────────────────────────
 *
 * The shape is only worth anything if it is TRUE of all eleven at once. Before this
 * pass the roster ran **33 weapons unevenly** — Donut had ONE, Lollipop two, five
 * characters had no melee and four had no Super — while `settings.ts` and the HUD both
 * printed a `1 2 3 4` tray from `weapons.length`, so a player looking at Donut saw one
 * live key and three dead ones. Nothing was red. **A shape that nothing asserts is a
 * shape that lasts until the next weapon.**
 *
 * ── THE ELEVEN ARMS, AND WHAT WOULD FAIL EACH ───────────────────────────────
 *
 * `docs/AGENT-BRIEF.md` §4.4: *"ask of every assertion — what implementation would fail
 * this?"* Each arm below names it, and `--selftest` PLANTS that implementation and
 * requires the arm to go red. An arm with no known-bad is a comment with a tick next to it.
 *
 *   A SIZE        11 characters, 4 weapons each.        fails: a 3- or 5-weapon kit
 *   B SLOTS       exactly one weapon per slot name.     fails: two 'long', no 'melee'
 *   C ORDER       weapons[i].slot === WEAPON_SLOT_ORDER[i].
 *                                                       fails: super authored first
 *   D GEOMETRY    the declared slot matches the type and the REACH band.
 *                                                       fails: a 'short' at 128 wu
 *   E GAP         short.range < long.range, per character.
 *                                                       fails: both ranged on one rung
 *   F SUPER       super.cooldown >= SUPER_MIN_COOLDOWN_MS AND >= every other slot's.
 *                                                       fails: a 900 ms "Super"
 *   G SEPARATION  every NON-super cooldown is strictly BELOW SUPER_MIN_COOLDOWN_MS.
 *                                                       fails: an ordinary weapon tuned
 *                                                       up until the floor stops
 *                                                       separating anything
 *   H BLURB       exactly one ability blurb per weapon, joined by key through
 *                 `abilityCards()`.                     fails: a new weapon with no card
 *   I RUNGS       every authored `range` is a value of `REACH`.
 *                                                       fails: a retyped `120`
 *   J SPEED       ranged weapons carry `speed`; melee and self do NOT.
 *                                                       fails: a converted weapon that
 *                                                       kept its projectile speed
 *   K UNIQUE      weapon keys, and weapon emoji, are distinct within a character.
 *                                                       fails: two slots one glyph
 *
 * 🚨 **AND ARM Z, WHICH IS THE ONE `--selftest` CANNOT BE.** `docs/AGENT-BRIEF.md` §4.4:
 * *"`--selftest` validates a tool's LOGIC, never where the tool is POINTED"* — `valuescan`
 * read a perfect selftest with 14 of 18 stations in the wrong quadrant. So `--selftest`
 * additionally asserts, against the REAL module rather than a fixture, that this file is
 * pointed at a roster of **11** ids whose weapons are non-empty, and that `REACH` carries
 * the rungs the bands are built from. A green selftest over an empty or stubbed roster is
 * the failure mode this arm exists to make impossible.
 *
 * ── VACUITY ─────────────────────────────────────────────────────────────────
 * `[].every()` is `true`, and that fired three times in three files in one session here,
 * always green, always because a fix emptied the filtered set. **Every arm below counts
 * what it checked and fails if the count is zero.** `checked` is printed per arm for
 * exactly that reason: an arm reporting `0 checked` is a fault, not a pass.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const IS_MAIN = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

const RULES = await import(`${ROOT}src/game/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH, WEAPON_SLOT_ORDER, SUPER_MIN_COOLDOWN_MS, abilityCards } = RULES;

/** The bands, as RUNG NAMES of `REACH` — never numbers. `rules.ts:WeaponSlot` is the prose. */
const BAND = {
  melee: ['meleeQuick', 'meleeStrong', 'meleeHeavy'],
  short: ['rangedClose', 'rangedMid'],
  long: ['rangedLong', 'rangedMax'],
};
/** The Super is the one slot with no band: `lollipop.Giant` is `ultimateSlam`, which is
 *  deliberately off the ladder, and `hamburger.Onion` is `self` and has no range at all. */
const RUNG_VALUES = new Set(Object.values(REACH));

// ─────────────────────────────────────────────────────────────────────────────
// The arms. Each takes a roster and returns { faults, checked } so a known-bad can be
// run through the SAME code path as the real thing — a known-bad validated against a
// second implementation validates the second implementation.
// ─────────────────────────────────────────────────────────────────────────────

function armA(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    checked++;
    const n = roster[id].weapons.length;
    if (n !== WEAPON_SLOT_ORDER.length) faults.push(`A ${id}: ${n} weapons, expected ${WEAPON_SLOT_ORDER.length}`);
  }
  if (ids.length !== 11) faults.push(`A roster has ${ids.length} characters, expected 11`);
  return { faults, checked };
}

function armB(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    for (const slot of WEAPON_SLOT_ORDER) {
      checked++;
      const n = roster[id].weapons.filter((w) => w.slot === slot).length;
      if (n !== 1) faults.push(`B ${id}: ${n} weapons in slot '${slot}', expected 1`);
    }
  }
  return { faults, checked };
}

function armC(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    roster[id].weapons.forEach((w, i) => {
      if (i >= WEAPON_SLOT_ORDER.length) return;
      checked++;
      if (w.slot !== WEAPON_SLOT_ORDER[i]) {
        faults.push(`C ${id}: weapons[${i}] is '${w.slot}', tray key ${i + 1} should be '${WEAPON_SLOT_ORDER[i]}'`);
      }
    });
  }
  return { faults, checked };
}

function armD(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    for (const w of roster[id].weapons) {
      if (w.slot === 'super') continue; // the Super has no band — see BAND above
      checked++;
      const wantType = w.slot === 'melee' ? 'melee' : 'ranged';
      if (w.type !== wantType) faults.push(`D ${id}.${w.key}: slot '${w.slot}' but type '${w.type}', expected '${wantType}'`);
      const rung = BAND[w.slot].find((r) => REACH[r] === w.range);
      if (!rung) {
        faults.push(`D ${id}.${w.key}: slot '${w.slot}' range ${w.range} is not one of REACH.{${BAND[w.slot].join(',')}}`);
      }
    }
  }
  return { faults, checked };
}

function armE(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    const s = roster[id].weapons.find((w) => w.slot === 'short');
    const l = roster[id].weapons.find((w) => w.slot === 'long');
    if (!s || !l) continue; // arm B owns the missing case; do not double-report
    checked++;
    if (!(s.range < l.range)) faults.push(`E ${id}: short ${s.range} is not strictly below long ${l.range}`);
  }
  return { faults, checked };
}

function armF(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    const sup = roster[id].weapons.find((w) => w.slot === 'super');
    if (!sup) continue;
    checked++;
    if (sup.cooldown < SUPER_MIN_COOLDOWN_MS) {
      faults.push(`F ${id}.${sup.key}: Super cooldown ${sup.cooldown} < SUPER_MIN_COOLDOWN_MS ${SUPER_MIN_COOLDOWN_MS}`);
    }
    for (const w of roster[id].weapons) {
      if (w.slot === 'super') continue;
      if (w.cooldown > sup.cooldown) {
        faults.push(`F ${id}: ${w.key} cooldown ${w.cooldown} exceeds the Super's ${sup.cooldown}`);
      }
    }
  }
  return { faults, checked };
}

function armG(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    for (const w of roster[id].weapons) {
      if (w.slot === 'super') continue;
      checked++;
      if (w.cooldown >= SUPER_MIN_COOLDOWN_MS) {
        faults.push(`G ${id}.${w.key}: non-Super cooldown ${w.cooldown} >= SUPER_MIN_COOLDOWN_MS ${SUPER_MIN_COOLDOWN_MS} — the floor no longer separates`);
      }
    }
  }
  return { faults, checked };
}

function armH(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    // `weaponForAbility` THROWS on a blurb naming a weapon that does not exist — by
    // design, `rules.ts` says so, because a join that quietly returns nothing is how this
    // repo once listed 3 of 5 fighters. A guard must therefore not let that throw escape:
    // an uncaught exception here reads as "the TOOL is broken", which is the most
    // expensive possible way to report "the ROSTER is broken". Caught, and reported as
    // the H fault it is. (Found by KB-A, which deletes a weapon whose blurb survives.)
    let cards;
    try {
      cards = abilityCards(roster[id]);
    } catch (e) {
      faults.push(`H ${id}: abilityCards() threw — ${e.message}`);
      checked++;
      continue;
    }
    for (const w of roster[id].weapons) {
      checked++;
      const n = cards.filter((c) => c.weapon && c.weapon.key === w.key).length;
      if (n !== 1) faults.push(`H ${id}.${w.key}: ${n} ability blurbs join to it, expected 1`);
    }
  }
  return { faults, checked };
}

function armI(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    for (const w of roster[id].weapons) {
      if (w.range === undefined) continue; // `self` weapons have no reach
      checked++;
      if (!RUNG_VALUES.has(w.range)) faults.push(`I ${id}.${w.key}: range ${w.range} is not a rung of REACH — a retyped literal`);
    }
  }
  return { faults, checked };
}

function armJ(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    for (const w of roster[id].weapons) {
      checked++;
      const hasSpeed = w.speed !== undefined;
      if (w.type === 'ranged' && !hasSpeed) faults.push(`J ${id}.${w.key}: ranged with no speed`);
      if (w.type !== 'ranged' && hasSpeed) faults.push(`J ${id}.${w.key}: type '${w.type}' carrying speed ${w.speed} — speed is ranged-only`);
    }
  }
  return { faults, checked };
}

function armK(roster, ids) {
  const faults = [];
  let checked = 0;
  for (const id of ids) {
    const keys = roster[id].weapons.map((w) => w.key);
    const emoji = roster[id].weapons.map((w) => w.emoji);
    checked += 2;
    if (new Set(keys).size !== keys.length) faults.push(`K ${id}: duplicate weapon key in ${keys.join(',')}`);
    if (new Set(emoji).size !== emoji.length) faults.push(`K ${id}: duplicate weapon emoji in ${emoji.join(' ')}`);
  }
  return { faults, checked };
}

const ARMS = [
  ['A SIZE', armA], ['B SLOTS', armB], ['C ORDER', armC], ['D GEOMETRY', armD],
  ['E GAP', armE], ['F SUPER', armF], ['G SEPARATION', armG], ['H BLURB', armH],
  ['I RUNGS', armI], ['J SPEED', armJ], ['K UNIQUE', armK],
];

export function run(roster = CHARACTERS, ids = CHARACTER_IDS) {
  const rows = [];
  const faults = [];
  for (const [name, fn] of ARMS) {
    const r = fn(roster, ids);
    // VACUITY: an arm that checked nothing is a FAULT, never a pass. `[].every()` is
    // `true`, and three arms in this repo went green in one session by having their
    // filtered set emptied under them.
    if (r.checked === 0) {
      faults.push(`${name}: checked 0 — VACUOUS, the filtered set is empty`);
      rows.push({ arm: name, checked: 0, faults: 1, vacuous: true });
      continue;
    }
    faults.push(...r.faults);
    rows.push({ arm: name, checked: r.checked, faults: r.faults.length, vacuous: false });
  }
  return { rows, faults };
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-BADS. Each plants the implementation its arm names and requires RED.
// ─────────────────────────────────────────────────────────────────────────────

function cloneRoster() {
  const out = {};
  for (const id of CHARACTER_IDS) {
    out[id] = { ...CHARACTERS[id], weapons: CHARACTERS[id].weapons.map((w) => ({ ...w })), abilities: CHARACTERS[id].abilities.map((a) => ({ ...a })) };
  }
  return out;
}

function selftest() {
  const results = [];
  const arm = (label, ok) => { results.push({ label, ok }); };
  const hasFault = (roster, prefix) => run(roster).faults.some((f) => f.startsWith(prefix));

  // Z — WHERE THE TOOL IS POINTED. Not logic: the real module, before any fixture.
  arm('Z1  points at 11 real characters', CHARACTER_IDS.length === 11);
  arm('Z2  every real character has weapons', CHARACTER_IDS.every((id) => (CHARACTERS[id].weapons?.length ?? 0) > 0));
  arm('Z3  REACH carries every band rung', Object.values(BAND).flat().every((r) => typeof REACH[r] === 'number'));
  arm('Z4  the live roster is GREEN', run().faults.length === 0);

  // KB-A — a 3-weapon kit (the shape before this pass).
  { const r = cloneRoster(); r.hotdog.weapons.pop(); arm('KB-A  a 3-weapon kit -> A', hasFault(r, 'A ')); }
  // KB-B — two 'long' and no 'short'.
  { const r = cloneRoster(); r.egg.weapons[1].slot = 'long'; arm('KB-B  two weapons in one slot -> B', hasFault(r, 'B ')); }
  // KB-C — correct SET of slots, authored in the wrong ORDER. B and E stay green; only C sees it.
  {
    const r = cloneRoster();
    const w = r.soup.weapons;
    r.soup.weapons = [w[3], w[1], w[2], w[0]];
    arm('KB-C  right slots, wrong order -> C', hasFault(r, 'C '));
  }
  // KB-D — a 'short' weapon tuned onto a long rung. Its slot and type still agree.
  { const r = cloneRoster(); r.taco.weapons[1].range = REACH.rangedLong; arm('KB-D  short slot on a long rung -> D', hasFault(r, 'D ')); }
  // KB-D2 — the type/slot half, independently: a melee slot holding a ranged record.
  { const r = cloneRoster(); r.soup.weapons[0].type = 'ranged'; arm('KB-D2 melee slot, ranged type -> D', hasFault(r, 'D ')); }
  // KB-E — both ranged slots on the SAME rung. Each is inside its own band boundary
  // value, so D passes and only the ordering arm can see it.
  {
    const r = cloneRoster();
    r.hotdog.weapons[1].range = REACH.rangedMid;
    r.hotdog.weapons[2].range = REACH.rangedLong;
    const before = hasFault(r, 'E ');
    r.hotdog.weapons[1].range = REACH.rangedMid;
    r.hotdog.weapons[2].range = REACH.rangedMid; // 116 vs 116: legal band for neither? long band excludes 116 -> D fires too
    arm('KB-E  short not below long -> E', !before && hasFault(r, 'E '));
  }
  // KB-F — a Super tuned below the floor.
  { const r = cloneRoster(); r.lollipop.weapons[3].cooldown = 900; arm('KB-F  a 900 ms Super -> F', hasFault(r, 'F ')); }
  // KB-F2 — an ordinary weapon with a LONGER cooldown than the Super. Note the Super
  // itself is still above the floor, so F's first clause cannot be what catches this.
  { const r = cloneRoster(); r.egg.weapons[0].cooldown = 5000; arm('KB-F2 non-Super out-cooldowns the Super -> F', hasFault(r, 'F ')); }
  // KB-G — the separation closing: an ordinary weapon tuned up ONTO the floor.
  { const r = cloneRoster(); r.burrito.weapons[0].cooldown = SUPER_MIN_COOLDOWN_MS; r.burrito.weapons[3].cooldown = 4000; arm('KB-G  non-Super at the floor -> G', hasFault(r, 'G ')); }
  // KB-H — a new weapon with no ability card.
  {
    const r = cloneRoster();
    r.donut.abilities = r.donut.abilities.filter((a) => a.weapon !== 'Glaze');
    arm('KB-H  a weapon with no blurb -> H', hasFault(r, 'H '));
  }
  // KB-I — a retyped literal one unit off a rung. Every band test still passes at 128,
  // so I is the only arm that can see 129.
  { const r = cloneRoster(); r.pizza.weapons[2].range = 129; arm('KB-I  a retyped 129 -> I', hasFault(r, 'I ')); }
  // KB-J — THE BUG THIS ARM WAS WRITTEN FOR, and it was live in this pass's own working
  // tree for a few minutes: `waterbottle.Glass` converted ranged -> melee while KEEPING
  // `speed: SPEED.mid`. `range` and `type` and `slot` all agreed; only J sees it.
  { const r = cloneRoster(); r.waterbottle.weapons[0].speed = 232; arm('KB-J  melee that kept its speed -> J', hasFault(r, 'J ')); }
  // KB-J2 — the other direction: a ranged weapon with no speed.
  { const r = cloneRoster(); delete r.sushi.weapons[1].speed; arm('KB-J2 ranged with no speed -> J', hasFault(r, 'J ')); }
  // KB-K — two slots sharing one glyph on the tray.
  { const r = cloneRoster(); r.hamburger.weapons[1].emoji = r.hamburger.weapons[0].emoji; arm('KB-K  duplicate emoji -> K', hasFault(r, 'K ')); }
  // KB-V — VACUITY. An arm handed an empty id list must go RED, not green. This is the
  // failure that produced three green-but-empty guards here in one session.
  { arm('KB-V  empty roster -> VACUOUS, not pass', run(cloneRoster(), []).faults.length > 0); }
  // KB-V2 — and specifically: it must say VACUOUS rather than merely counting 0 faults.
  { arm('KB-V2 empty roster names the vacuity', run(cloneRoster(), []).faults.some((f) => f.includes('VACUOUS'))); }

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.label}`);
  console.log(`\n  ${results.length - failed.length}/${results.length} known-bads caught`);
  // `gatecount`'s shared summary regex is `/^\s*(\d+) passed, \d+ failed\s*$/m` and it must
  // match EXACTLY ONCE. The line above is for a human and matches nothing; this one is the
  // machine-readable count `docs/TOOLS.md`'s gate table is diffed against. Emitting both is
  // deliberate — a tool whose only summary is prose cannot be registered, and an unregistered
  // gate is one `gatecount` reports as UNREG rather than one it runs.
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  return failed.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────

if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) {
    console.log('── WP_SHAPE SELFTEST ──');
    process.exit(selftest() ? 0 : 1);
  }

  const { rows, faults } = run();
  if (argv.includes('--table')) {
    console.log('\n── THE KIT, ONE LINE PER CHARACTER ──');
    for (const id of CHARACTER_IDS) {
      // NOT `slot[0]` — 'short' and 'super' share an initial, which would print two
      // different slots as the same letter and make the table unreadable exactly where it
      // matters most. An explicit map, so a new slot name cannot silently collide.
      const TAG = { melee: 'melee', short: 'short', long: 'long ', super: 'SUPER' };
      const cells = CHARACTERS[id].weapons.map((w) => `${TAG[w.slot] ?? w.slot}:${w.key}${w.range === undefined ? '' : `(${Math.round(w.range)})`}`.padEnd(22));
      console.log(`  ${id.padEnd(12)} ${cells.join('  ')}`);
    }
  }
  console.log('\n── ARMS ──');
  for (const r of rows) console.log(`  ${r.arm.padEnd(14)} checked ${String(r.checked).padStart(3)}   ${r.faults === 0 ? 'ok' : `${r.faults} FAULT`}`);
  const weaponCount = CHARACTER_IDS.reduce((n, id) => n + CHARACTERS[id].weapons.length, 0);
  console.log(`\n  ${CHARACTER_IDS.length} characters · ${weaponCount} weapons · ${WEAPON_SLOT_ORDER.join('/')} · SUPER_MIN_COOLDOWN_MS ${SUPER_MIN_COOLDOWN_MS}`);
  if (faults.length) {
    console.log('\n── FAULTS ──');
    for (const f of faults) console.log(`  ${f}`);
  }
  const jsonAt = argv.indexOf('--json');
  if (jsonAt >= 0 && argv[jsonAt + 1]) writeFileSync(argv[jsonAt + 1], JSON.stringify({ rows, faults, weaponCount }, null, 2));
  console.log(faults.length ? `\nFAIL — ${faults.length} fault(s)` : '\nPASS');
  process.exit(faults.length ? 1 : 0);
}
