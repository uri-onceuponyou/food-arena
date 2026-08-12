#!/usr/bin/env node
/**
 * n2_geom — WHERE IS THE AIR? The 3D vertical gap between the top of a character's
 * BODY geometry and the bottom of its HEAD geometry, with the neck column excluded.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * `nm_island.mjs` answers "is the head a separate island?" through the shipped
 * renderer. It is the verdict and it costs a browser and two captures per arm. It is
 * useless for DESIGN, because it reports a count and not a distance: it cannot say
 * how far short the torso falls, so it cannot tell you what to change.
 *
 * This is the design-space half. It builds the shipped character off the shipped
 * files, walks every mesh, and reports the world-space Y extents on each side of the
 * joint. `withoutNeck()` holds R, `headCentreY`, `torsoTopY` and every other metric
 * IDENTICAL (`nm_neck.mjs --against`, 11/11), so **the shipped tree with
 * `neck_column`/`neck_collar` excluded IS the migrated geometry** — no source edit is
 * needed to price the migration.
 *
 * ⚠️ A POSITIVE Y GAP IS NOT AUTOMATICALLY A VISIBLE SPLIT and a zero one is not
 * automatically a join. The camera looks DOWN, so a body part far forward in Z can
 * project over a gap that exists in Y, and two masses that touch in Y can still be
 * separated on screen if they miss each other in X. `nm_island` remains the verdict;
 * this is what you steer with between verdicts.
 *
 * ── 🚨 `bodyTop` AND `headBot` ARE THE EXTREMES OF TWO **ISLANDS**, NOT OF A ──
 * ── TORSO AND A HEAD. READ THE `…By` COLUMN BEFORE READING THE NUMBER. ───────
 * This is the single most misreadable thing here, and it is what made the old
 * `--knownbad sort` fail three characters that have nothing wrong with them.
 * The buckets are `isUnder(mesh, rig.joints.head)` — PARENTAGE, not anatomy — which
 * is exactly right for the island question (`nm_island` counts pixels of anything
 * head-parented against anything else) and is *not* a neck measurement. Measured on
 * `072f245`, the mesh that defines each side is very often neither a head nor a torso:
 *
 *   hamburger    body top = `spatula_blade`         — a HELD WEAPON, on the hand
 *                head bottom = `shoulder_cheese_drip` — `hamburger.ts:886`, two
 *                capsules the file itself describes as reaching "from the cheese
 *                layer DOWN PAST the patty's own underside — into the arm mound
 *                itself … the visual bridge that sells 'arms emerge from between the
 *                bun layers'". It hangs to shoulder level ON PURPOSE.
 *   taco         body top = `upperArmL_mesh`        — an ARM
 *   egg/donut/lollipop  body top = `shoulder_bridge_*`
 *   soup/waterbottle    body top = `(unnamed)`      — an arm segment nobody named
 *
 * Only burrito, pizza, sushi and hotdog report an actual torso mesh on the body side.
 * So **`gap` is "how deeply do the two islands overlap in Y", and nothing else.** It
 * is not a neck length, it is not "how buried is the head", and a large negative
 * number is not a defect. On the four STUB characters it cannot be anything else:
 * `bodies.ts` ships STUB as `torsoFraction: 0`, `note: 'No torso — head on the hips'`,
 * so the food mass IS the body and it overhangs the hips by design.
 *
 * ── KNOWN-BAD INPUTS (CLAUDE.md #6) ─────────────────────────────────────────
 *   `--knownbad lift`   lifts the `head` joint by `--dy` and requires the reported
 *                       gap to grow by exactly that much (1e-9). A gap metric that
 *                       does not move when the head moves is measuring nothing.
 *   `--knownbad sort`   the cast battery. See the block above the code.
 *   `--selftest`        the fault battery: five injected implementation faults, each
 *                       required to turn `--knownbad sort` RED at the arm it names,
 *                       against an unfaulted control required to stay green.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   node tools/tmp/n2_geom.mjs --ids hotdog,sushi
 *   node tools/tmp/n2_geom.mjs --ids hotdog --parts        # every mesh, sorted
 *   node tools/tmp/n2_geom.mjs --knownbad lift             # WHOLE CAST unless --ids
 *   node tools/tmp/n2_geom.mjs --knownbad sort             # WHOLE CAST unless --ids
 *   node tools/tmp/n2_geom.mjs --selftest                  # validate the instrument
 *   node tools/tmp/n2_geom.mjs --knownbad sort --fault clamp   # see a fault go red
 *
 * ⚠️ The two `--knownbad` paths and `--selftest` cover **`ALL_IDS`** unless `--ids` is
 * passed explicitly. They used to inherit the report path's `--ids` default of
 * `hotdog,sushi`, so the documented invocation `node tools/tmp/n2_geom.mjs --knownbad
 * sort` asserted over **2 of 11 characters and printed a green tick** — while the
 * header two paragraphs up claimed it covered "every character that carries a food
 * mass on a torso". See the FALSE-COVERAGE note in the `sort` block.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO, ALL_IDS, captureWarnings, arg, flag, num, writeOut } from './rg_lib.mjs';

const IDS = arg('--ids', 'hotdog,sushi') === 'all' ? ALL_IDS
  : arg('--ids', 'hotdog,sushi').split(',').map((s) => s.trim()).filter(Boolean);
const PARTS = flag('--parts');
const DY = num('--dy', 0.6);
const KNOWNBAD = arg('--knownbad', null);
const JSONOUT = arg('--json', null);
const SELFTEST = flag('--selftest');
const FAULT = arg('--fault', null);

/**
 * Subjects for every ASSERTING path. `--ids` still wins when given, because a
 * one-character debug run is the common case — but the DEFAULT is the whole cast,
 * not the report path's two-character convenience default.
 */
const SUBJECTS = flag('--ids') ? IDS : ALL_IDS;

/**
 * The roster the cast battery is pinned to (`G2`). Kept as its own literal rather
 * than `=== ALL_IDS` so that adding or retiring a character is a DELIBERATE edit to
 * this file with a reason, exactly as `nk_neckgate.mjs` pins its builder set — a
 * subject list that silently follows a shared constant can shrink to nothing and
 * `[].every()` is `true`.
 */
const PINNED_ROSTER = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop',
  'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];

/**
 * The bracket half-width for the sign-flip arm, in metres. 1 mm.
 *
 * B+/B- are a pure SIGN test, so this value's only job is to sit far above the
 * metric's numerical noise and far below any real geometric quantity. It is not
 * tuned to a verdict in either direction:
 *   FLOOR   `--knownbad lift` reports `Δ 0.600000000` on all 11 rows, so the observed
 *           round-trip error through `Matrix3.invert()` and `Box3.setFromObject` is
 *           < 5e-10 m. 1e-3 is ~2e6x that.
 *   CEILING 1 mm is 0.04% of the shortest figure in the cast (egg, 2.0297 m). There is
 *           no geometry in this project at that scale.
 *
 * ⚠️ ITS FAULT SENSITIVITY IS A CONSEQUENCE, MEASURED, NOT A TARGET. Choosing the
 * margin to maximise how red a fault goes is the mirror image of choosing it to make
 * a check pass. Recorded for the record only: the `localy` fault leaves a residue of
 * `|gap| * (sec(tilt) - 1)`, so it is caught where that exceeds the margin. Measured
 * on `072f245` at 1e-3, B+ residues — 7 of 11 subjects red:
 *   lollipop -0.007202 · egg -0.004197 · taco -0.001940 · donut -0.000955
 *   hamburger -0.000629 · hotdog -0.000475 · waterbottle -0.000278
 *   (burrito, pizza, sushi, soup stay green — their lean, their overlap, or both, are
 *    too small for the cos error to clear 1 mm.)
 * 🚨 An earlier draft of this comment justified 2e-3 with *"on hamburger (lean 0.16,
 * gap -0.7314) that is 0.00949 m"*. **That number was fabricated** — 0.16 is hotdog's
 * lean, lifted from the comment inside `measure()` and pasted onto hamburger, whose
 * real residue is 25x smaller. At 2e-3 the fault was caught on 3 subjects, not 7, and
 * the selftest assertion written from the fabricated figure named the WRONG THREE
 * characters and failed. Kept because it is this file's own rule 10 violation.
 */
const BRACKET_M = 1e-3;

/**
 * The rig's own column and collar — the two meshes `withoutNeck()` deletes.
 *
 * ⚠️ THE OUTLINE SHELL IS A SEPARATE MESH WITH A SUFFIXED NAME, AND IT IS RENDERED.
 * A first version keyed on the exact name, so `neck_column__outline` — an INFLATED
 * copy of the column, i.e. the tallest thing on the body — was bucketed as body
 * geometry and burrito's "body top" came back as the column it was supposed to be
 * excluding. Strip the suffix before classifying; keep the shell in the extents,
 * because it draws pixels and the defect is measured in pixels.
 * → That bug is now GUARDED, not merely commented: `G3` below asserts no body-bucket
 *   mesh carries a neck basename, and `--fault nosuffix` reproduces the bug and is
 *   required to turn G3 red. A comment with a tick next to it is not a guard.
 */
const NECK_MESHES = new Set(['neck_column', 'neck_collar']);
const baseName = (n) => String(n).replace(/__(no_)?outline$/, '');

/** Every fault `--fault` and `--selftest` know how to inject. A typo must not run clean. */
const FAULTS = {
  clamp: 'gap = min(gap, 0) — a metric that cannot express a POSITIVE gap',
  localy: 'head.position.y += lift, skipping the parent-basis change (the documented cos bug)',
  stale: 'the post-lift rig.joints.root.updateWorldMatrix() is deleted',
  allhead: 'every non-neck mesh buckets as HEAD, so the body side empties',
  nosuffix: 'baseName() is identity, so neck_column__outline counts as body geometry',
};
if (FAULT !== null && !Object.hasOwn(FAULTS, FAULT)) {
  console.error(`unknown --fault ${JSON.stringify(FAULT)}; known: ${Object.keys(FAULTS).join(', ')}`);
  process.exit(2);
}

/**
 * Local bundle, same shape as `nm_neck.mjs`'s. `rg_lib.buildBundle` exists but its
 * entry does not export `THREE`, and a Box3 needs the SAME THREE instance the rig
 * built its geometry with.
 */
async function loadCast() {
  const dir = mkdtempSync(path.join(tmpdir(), 'n2-'));
  const entry = path.join(dir, 'entry.ts');
  const q = (p) => JSON.stringify(path.join(REPO, p));
  writeFileSync(entry, [
    `export * as THREE from 'three';`,
    `export { createCharacter } from ${q('src/characters/registry')};`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(REPO, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(REPO, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
  return import('file://' + out);
}

const mod = await loadCast();
const THREE = mod.THREE;

/**
 * Build one character and bucket every mesh into `head` / `body` / `neck`.
 * `lift` displaces the `head` joint first — the known-bad.
 * `fault` injects one named implementation defect — see `FAULTS`.
 */
function measure(id, lift = 0, fault = null) {
  const { value } = captureWarnings(() => mod.createCharacter(id));
  const rig = value.rig;
  rig.restPose();
  if (lift) {
    // 🚨 `head.position.y += lift` IS NOT A LIFT OF `lift` METRES, and the known-bad
    // caught it: the head joint hangs off a torso that `RigStance.lean`/`twist` have
    // rotated, so a LOCAL +Y step lands `lift * cos(tilt)` up in WORLD Y. Measured on
    // the first version — 0.6 asked for, 0.592870 delivered on hotdog (lean 0.16) and
    // 0.599651 on sushi (lean -0.02) — which is exactly the cos factor and read as the
    // metric being 1.2% wrong. It was the DISPLACEMENT that was wrong.
    // ⚠️ `nm_island.mjs` does the same `o.position.y += lift` for its own known-bad. It
    // is harmless there because that test only asks whether the count RISES, and a 1%
    // short lift still splits a matte — but the number it reports is not the number it
    // names, and anything that ever asserts on the magnitude will inherit this.
    if (fault === 'localy') {
      rig.joints.head.position.y += lift;
    } else {
      const parent = rig.joints.head.parent;
      parent.updateWorldMatrix(true, false);
      const toLocal = new THREE.Matrix3().setFromMatrix4(parent.matrixWorld).invert();
      rig.joints.head.position.add(new THREE.Vector3(0, lift, 0).applyMatrix3(toLocal));
    }
  }
  if (fault !== 'stale') rig.joints.root.updateWorldMatrix(true, true);

  const headJoint = rig.joints.head;
  const isUnder = (o, ancestor) => {
    for (let p = o; p; p = p.parent) if (p === ancestor) return true;
    return false;
  };
  const nameFor = fault === 'nosuffix' ? String : baseName;

  const rows = [];
  rig.joints.root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const box = new THREE.Box3().setFromObject(o);
    if (!isFinite(box.min.y) || box.isEmpty()) return;
    const side = NECK_MESHES.has(nameFor(o.name)) ? 'neck'
      : (fault === 'allhead' ? 'head' : (isUnder(o, headJoint) ? 'head' : 'body'));
    rows.push({
      name: o.name || '(unnamed)', side,
      yMin: box.min.y, yMax: box.max.y,
      xMin: box.min.x, xMax: box.max.x, zMin: box.min.z, zMax: box.max.z,
    });
  });

  const body = rows.filter((r) => r.side === 'body');
  const head = rows.filter((r) => r.side === 'head');
  const neck = rows.filter((r) => r.side === 'neck');
  const bodyTop = body.length ? Math.max(...body.map((r) => r.yMax)) : NaN;
  const headBot = head.length ? Math.min(...head.map((r) => r.yMin)) : NaN;
  const m = rig.metrics;
  // The WHOLE figure, because a join fixed by growing the head downward is only free
  // if the character's overall height did not move — `H`/`headFraction` are tuned to
  // land the top of the food mass at the cast's standard height, and a silent 0.03 m
  // there is an apparent-size change wearing a structure fix's clothes.
  const figTop = Math.max(...rows.map((r) => r.yMax));
  const figBot = Math.min(...rows.map((r) => r.yMin));
  const rawGap = headBot - bodyTop;
  return {
    id, rows, body, head, neck, figTop, figBot,
    bodyTop, headBot, gap: fault === 'clamp' ? Math.min(rawGap, 0) : rawGap,
    /** Body-bucket meshes whose basename is a neck mesh. Non-empty == the suffix bug. */
    neckInBody: body.filter((r) => NECK_MESHES.has(baseName(r.name))).map((r) => r.name),
    bodyTopBy: body.slice().sort((a, b) => b.yMax - a.yMax)[0]?.name ?? '—',
    headBotBy: head.slice().sort((a, b) => a.yMin - b.yMin)[0]?.name ?? '—',
    colTop: neck.length ? Math.max(...neck.map((r) => r.yMax)) : NaN,
    torsoTopY: m.torsoTopY, headCentreY: m.headCentreY, headRadius: m.headRadius,
    neckGap: m.neckGap, neckRadius: m.neckRadius, torsoHeight: m.torsoHeight,
    torsoWidth: m.torsoWidth, shoulderWidth: m.shoulderWidth,
  };
}

// ── --knownbad lift ─────────────────────────────────────────────────────────
if (KNOWNBAD === 'lift') {
  console.log(`KNOWN-BAD: does the reported gap follow the head? head +${DY} m must add exactly ${DY} to it.\n`);
  let bad = 0;
  for (const id of SUBJECTS) {
    const a = measure(id, 0, FAULT);
    const b = measure(id, DY, FAULT);
    const moved = b.gap - a.gap;
    const ok = Math.abs(moved - DY) < 1e-9;
    console.log(`${id.padEnd(12)} gap ${a.gap.toFixed(6)} -> ${b.gap.toFixed(6)}   Δ ${moved.toFixed(9)}   ${ok ? '✓' : '🔴'}`);
    if (!ok) bad++;
  }
  console.log(bad ? `\n🔴 KNOWN-BAD FAILED on ${bad}` : '\n✓ the gap tracks the head exactly.');
  process.exit(bad ? 1 : 0);
}

/* ══════════════════════════════════════════════════════════════════════════════
   --knownbad sort — THE CAST BATTERY

   ── THE OLD WORDING, KEPT VERBATIM BECAUSE THE RULE IT ENCODED WAS REVERSED ──
   (CLAUDE.md: "When an assertion encodes a rule that has been reversed, change it
    and keep the old wording above it with the reason.")

     > `--knownbad sort`   TWO-SIDED, and deliberately NOT written against a snapshot
     >                     of the cast: every character that carries a food mass on a
     >                     torso must report a NON-positive gap as shipped, and the
     >                     SAME characters must report a positive one once the head is
     >                     lifted `--dy`.

   ── WHY IT WAS REVERSED — THREE MEASURED FACTS, ALL ON `072f245` ─────────────

   1. **"TWO-SIDED" WAS FALSE BY CONSTRUCTION, AND ITS SIBLING KNOWN-BAD PROVES IT.**
      `--knownbad lift` passes 11/11 with `Δ 0.600000000` on every row, i.e. it
      establishes `gap(lift) ≡ gap(0) + lift` EXACTLY. Substitute: the second arm
      `gap(0.6) > 0` is algebraically `gap(0) > -0.6`. It is not a second side. It is
      arm one's own number re-tested against a hidden magnitude threshold of 0.6 m —
      a number that entered the file as a LIFT (`--dy`, a displacement) and was never
      derived as a LIMIT. Exactly CLAUDE.md #6's "two arms of one instrument false by
      construction … a single threshold cut through one continuous population."

   2. **THE THRESHOLD CUT THROUGH A STRUCTURALLY IDENTICAL COHORT.** It failed
      hamburger (-0.731386), egg (-0.936974) and waterbottle (-0.745304), and passed
      donut (-0.580044) and lollipop (-0.572471) — by 0.0200 m and 0.0275 m. But
      egg, waterbottle, donut and lollipop are the SAME archetype: `bodies.ts`
      `CHARACTER_ARCHETYPES` puts all four on STUB, whose own note reads *"No torso —
      head on the hips"* and whose `torsoFraction` is `0`. All four measure
      `torsoHeight 0.000000`. Two passed and two failed on 2 cm of an unrelated
      quantity. A threshold that splits one cohort is not measuring the cohort.

   3. **THE PICTURES SAY THE CHARACTERS ARE FINE, AT BOTH SHIPPED CAMERAS.**
      Rendered on a detached worktree of `072f245` through `sx_snap` + `r2_shot` at
      `charStage.ts`'s lobby pitch 20 and `camera.ts`'s match pitch 58 — the lobby
      being the better DETECTOR for a buried head (CLAUDE.md #3). Nothing is buried.
      Egg and Water Bottle are a food mass sitting on the hips with limbs coming out
      of it, which is what STUB IS. Hamburger's head bottom is
      `shoulder_cheese_drip`, whose own source comment asks it to reach "DOWN PAST
      the patty's own underside — into the arm mound itself". Donut — which PASSED —
      is visually the same construction as Egg, which failed.
      → All three failures were INSTRUMENT, none was geometry. No `src/characters/`
        change is owed.

   ── WHAT REPLACES IT, AND WHAT IMPLEMENTATION FAILS EACH ARM ─────────────────
   Per subject, four checks; plus two guards that cannot go vacuous.

     A   shipped `gap <= 0`. The real assertion, unchanged, and the one that would
         have caught `a44d36d` (heads became their own islands when `neck_column`
         was deleted — see `nk_neckgate.mjs`, which cites this gate for exactly that).
         FAILED BY: any bucketing that puts the head mass above the body mass.

     B+  lift by `(-gap + 2 mm)` → gap must be `> 0`.
     B-  lift by `(-gap - 2 mm)` → gap must stay `<= 0`.
         Together these BRACKET THE SIGN FLIP at the zero crossing the metric itself
         reports, so the test is identical on sushi (overlap 0.007 m) and on egg
         (0.937 m) and there is no threshold left to tune. This is the "the metric
         can express BOTH signs" property the old arm was reaching for, stated
         without smuggling in a magnitude limit.
         FAILED BY: `--fault clamp` (a metric that cannot go positive), `--fault
         stale` (a lift that never reaches the world matrix), `--fault localy` (the
         cos bug — it fails B+ on the deep-overlap characters, which are precisely
         the three the old arm was falsely accusing).

     G3  the body bucket is NON-EMPTY and contains no `neck_column`/`neck_collar`
         basename. The non-emptiness half is deliberate: G3's real clause is a filter
         (`body.filter(isNeck)`) and `[].every()` is `true`, so it had to be pinned
         open. FAILED BY: `--fault nosuffix`, `--fault allhead`.

     G1  the subject set is NON-EMPTY.
     G2  the subject set EQUALS `PINNED_ROSTER`.
         G1/G2 exist because this file's assertions used to run over `IDS`, whose
         default is `hotdog,sushi` — so the documented invocation covered 2 of 11 and
         printed a green tick under a header claiming "every character". A count that
         does not move when coverage collapses is the whole failure mode.
   ══════════════════════════════════════════════════════════════════════════════ */

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Run the cast battery. Returns `{ checks, rows }`; `checks` is a flat list of
 * `{ id, arm, ok, note }` so the selftest can assert WHICH arm a fault reddened
 * rather than merely that something went red.
 */
function castBattery({ fault = null, subjects = SUBJECTS } = {}) {
  const checks = [];
  const rows = [];
  const push = (id, arm, ok, note) => checks.push({ id, arm, ok, note });

  push('—', 'G1', subjects.length > 0, `${subjects.length} subject(s)`);
  push('—', 'G2', eq(subjects, PINNED_ROSTER),
    eq(subjects, PINNED_ROSTER) ? 'matches the pinned roster' : `got [${subjects}] want [${PINNED_ROSTER}]`);

  for (const id of subjects) {
    const r = measure(id, 0, fault);
    const above = measure(id, -r.gap + BRACKET_M, fault);
    const below = measure(id, -r.gap - BRACKET_M, fault);
    push(id, 'A', r.gap <= 0, `shipped ${r.gap.toFixed(6)}`);
    push(id, 'B+', above.gap > 0, `+${BRACKET_M} -> ${above.gap.toFixed(6)}`);
    push(id, 'B-', below.gap <= 0, `-${BRACKET_M} -> ${below.gap.toFixed(6)}`);
    push(id, 'G3', r.body.length > 0 && r.neckInBody.length === 0,
      r.body.length === 0 ? 'body bucket EMPTY' : (r.neckInBody.length ? `neck in body: ${r.neckInBody}` : `${r.body.length} body meshes, no neck`));
    rows.push({ id, r, above, below });
  }
  return { checks, rows };
}

if (KNOWNBAD === 'sort') {
  console.log('KNOWN-BAD, cast battery. Per character: the shipped masses must OVERLAP in Y (A),');
  console.log(`and the sign must flip across a bracket of +-${BRACKET_M} m around the character's OWN`);
  console.log('measured zero crossing (B+/B-), with the body bucket non-empty and neck-free (G3).');
  if (FAULT) console.log(`\n⚠️  --fault ${FAULT}: ${FAULTS[FAULT]}`);
  console.log('');
  const { checks, rows } = castBattery({ fault: FAULT });
  for (const c of checks.filter((x) => x.id === '—')) {
    console.log(`${'(guard)'.padEnd(12)} ${c.arm.padEnd(3)} ${c.ok ? '✓' : '🔴'}  ${c.note}`);
  }
  for (const { id, r } of rows) {
    const mine = checks.filter((c) => c.id === id);
    const mark = (a) => { const c = mine.find((x) => x.arm === a); return `${a} ${c.ok ? '✓' : '🔴'}`; };
    console.log(`${id.padEnd(12)} ${mark('A')} ${mark('B+')} ${mark('B-')} ${mark('G3')}`
      + `   gap ${r.gap.toFixed(6)}   body top ${r.bodyTop.toFixed(4)} by ${r.bodyTopBy}`
      + `   head bottom ${r.headBot.toFixed(4)} by ${r.headBotBy}`);
  }
  const failed = checks.filter((c) => !c.ok);
  for (const c of failed) console.log(`  🔴 ${c.id} ${c.arm}: ${c.note}`);
  console.log(`\n${checks.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

/* ══════════════════════════════════════════════════════════════════════════════
   --selftest — THE FAULT BATTERY

   CLAUDE.md #6: "A guard that has not been shown to FAIL on the bug it guards
   against is not a guard", and its 🚨 rider: "a guard can pass by having nothing
   left to check". So every refusal below is paired with (a) an unfaulted CONTROL
   required to be CLEAN — otherwise a battery that always screams would "pass" every
   refusal — and (b) an assertion on WHICH ARM went red, because a fault that reddens
   the wrong arm is a coincidence, not coverage.

   ⚠️ `--selftest` validates this tool's LOGIC. It does NOT validate that the tool is
   POINTED anywhere real — `valuescan` read a perfect selftest with 14 of 18 stations
   in the wrong quadrant. What points this one is `G2`, and G2 is checked here too.
   ══════════════════════════════════════════════════════════════════════════════ */

if (SELFTEST) {
  let pass = 0, fail = 0;
  const ok = (cond, label, note = '') => {
    if (cond) { pass++; console.log(`  ✓ ${label}${note ? `   ${note}` : ''}`); }
    else { fail++; console.log(`  🔴 ${label}${note ? `   ${note}` : ''}`); }
  };
  const redArms = (fault) => {
    const { checks } = castBattery({ fault, subjects: PINNED_ROSTER });
    return { checks, red: checks.filter((c) => !c.ok) };
  };

  console.log('n2_geom --selftest — the fault battery\n');

  console.log('CONTROL (no fault) — the battery must be CLEAN, or every refusal below is free:');
  const control = castBattery({ fault: null, subjects: PINNED_ROSTER });
  ok(control.checks.length > 0, 'C1  the control battery is NON-EMPTY', `${control.checks.length} checks`);
  ok(control.checks.length === PINNED_ROSTER.length * 4 + 2,
    'C2  it runs 4 checks per pinned subject plus the 2 guards', `${control.checks.length} for ${PINNED_ROSTER.length} subjects`);
  ok(control.checks.every((c) => c.ok), 'C3  every control check PASSES',
    control.checks.filter((c) => !c.ok).map((c) => `${c.id}/${c.arm}`).join(', ') || 'all green');
  ok(PINNED_ROSTER.length > 0 && eq([...ALL_IDS].sort(), [...PINNED_ROSTER].sort()),
    'C4  the pinned roster is non-empty and covers rg_lib ALL_IDS', `${PINNED_ROSTER.length} characters`);

  console.log('\nFAULTS — each must turn the battery RED, at the arm it is named for:');

  const clamp = redArms('clamp');
  ok(clamp.red.length > 0, 'F1  clamp is REJECTED', `${clamp.red.length} red`);
  ok(clamp.red.length === PINNED_ROSTER.length && clamp.red.every((c) => c.arm === 'B+'),
    'F2  ...at B+ on every subject, and nowhere else',
    [...new Set(clamp.red.map((c) => c.arm))].join(','));

  // ── F4 WAS WRITTEN AS "at B+ on every subject, and nowhere else" AND IT FAILED ──
  // The prediction was that deleting the post-lift `updateWorldMatrix` only loses the
  // LIFT. It does not: `rig.restPose()` leaves the matrices needing an update too, so
  // the fault corrupts the BASELINE as well — every reported extent moves. The
  // interesting consequence is worth more than the tidy assertion was: under `stale`,
  // **pizza reports gap +0.078663, a PHANTOM DETACHED HEAD.** That is the exact false
  // positive this gate exists to never emit, so it is asserted by name.
  const stale = redArms('stale');
  ok(stale.red.length > 0, 'F3  stale (no post-lift updateWorldMatrix) is REJECTED', `${stale.red.length} red`);
  ok(PINNED_ROSTER.every((id) => stale.red.some((c) => c.id === id)),
    'F4  ...on EVERY subject — no character survives it',
    `${new Set(stale.red.map((c) => c.id)).size}/${PINNED_ROSTER.length} subjects red`);
  ok(stale.red.some((c) => c.id === 'pizza' && c.arm === 'A'),
    'F5  ...and it is caught at ARM A on pizza, where it manufactures a POSITIVE gap — '
    + 'the phantom detached head this gate must never emit',
    stale.red.filter((c) => c.arm === 'A').map((c) => c.id).join(',') || 'none');

  // ── F7 NAMED hamburger/egg/waterbottle AND IT FAILED ────────────────────────
  // Written from a fabricated residue (see BRACKET_M). The characters that catch the
  // cos bug are those where `|gap| * (sec(tilt) - 1)` clears the margin, which depends
  // on LEAN as much as on overlap depth — so the list is measured, not reasoned.
  const localy = redArms('localy');
  ok(localy.red.length > 0, 'F6  localy (the documented cos bug) is REJECTED', `${localy.red.length} red`);
  ok(localy.red.every((c) => c.arm === 'B+'), 'F7  ...at B+ and only there',
    [...new Set(localy.red.map((c) => c.arm))].join(','));
  // Named explicitly: "some subject went red" would be satisfied by the wrong subject.
  const cosCaught = ['hamburger', 'donut', 'taco', 'egg', 'lollipop', 'waterbottle', 'hotdog'];
  ok(cosCaught.every((d) => localy.red.some((c) => c.id === d && c.arm === 'B+'))
     && localy.red.length === cosCaught.length,
    'F8  ...on exactly the 7 subjects whose cos residue clears the 1 mm bracket',
    localy.red.map((c) => c.id).join(','));

  const allhead = redArms('allhead');
  ok(allhead.red.length > 0, 'F9  allhead (body bucket empties) is REJECTED', `${allhead.red.length} red`);
  ok(PINNED_ROSTER.every((id) => allhead.red.some((c) => c.id === id && c.arm === 'G3')),
    'F10 ...at G3 on every subject — the non-emptiness clause, which is why G3 has one',
    [...new Set(allhead.red.map((c) => c.arm))].join(','));

  const nosuffix = redArms('nosuffix');
  ok(nosuffix.red.length > 0, 'F11 nosuffix (the outline-shell bug) is REJECTED', `${nosuffix.red.length} red`);
  // ⚠️ COVERAGE STATED RATHER THAN IMPLIED: burrito is the ONLY character that still
  // builds a `neck_column` (`nk_neckgate.mjs`'s pinned builder set is the same one),
  // so this fault can only express itself on one subject and G3 is the only arm that
  // can see it — burrito's gap moves -0.067620 -> -0.137364 (0.069744 m, because the
  // inflated shell now tops the body at 1.4434) and stays the right side of zero.
  // If burrito ever migrates off the column this refusal goes VACUOUS; F12 names it so
  // that day is a loud failure rather than a silent one.
  ok(nosuffix.red.length === 1 && nosuffix.red[0].id === 'burrito' && nosuffix.red[0].arm === 'G3',
    'F12 ...at G3 on burrito, the only character that still builds a neck column',
    nosuffix.red.map((c) => `${c.id}/${c.arm}`).join(',') || 'none');

  console.log('\nCOVERAGE — the guards that stop this battery going vacuous:');
  const empty = castBattery({ fault: null, subjects: [] });
  ok(empty.checks.some((c) => c.arm === 'G1' && !c.ok), 'G1  an EMPTY subject set is refused');
  const short = castBattery({ fault: null, subjects: ['sushi'] });
  ok(short.checks.some((c) => c.arm === 'G2' && !c.ok), 'G2  a SHORT subject set is refused');
  ok(short.checks.filter((c) => c.arm === 'A').length === 1,
    'G3  ...and the short run really did assert over fewer subjects — the coverage collapse the old default hid');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ── report ──────────────────────────────────────────────────────────────────
const out = {};
for (const id of IDS) {
  const r = measure(id, 0, FAULT);
  out[id] = {
    gap: r.gap, bodyTop: r.bodyTop, bodyTopBy: r.bodyTopBy, headBot: r.headBot, headBotBy: r.headBotBy,
    torsoTopY: r.torsoTopY, headCentreY: r.headCentreY, headRadius: r.headRadius,
    neckGap: r.neckGap, neckRadius: r.neckRadius, colTop: r.colTop,
    torsoHeight: r.torsoHeight, torsoWidth: r.torsoWidth, shoulderWidth: r.shoulderWidth,
  };
  console.log(`\n── ${id} ──────────────────────────────────────────────────────`);
  console.log(`  R ${r.headRadius.toFixed(6)}   headCentreY ${r.headCentreY.toFixed(6)}   torsoTopY ${r.torsoTopY.toFixed(6)}`);
  console.log(`  neckGap ${r.neckGap.toFixed(6)}   neckRadius ${r.neckRadius.toFixed(6)}   column reaches y ${r.colTop.toFixed(6)}`);
  console.log(`  torsoHeight ${r.torsoHeight.toFixed(6)}  torsoWidth ${r.torsoWidth.toFixed(6)}  shoulderWidth ${r.shoulderWidth.toFixed(6)}`);
  console.log(`  BODY top     ${r.bodyTop.toFixed(6)}  (${r.bodyTopBy})`);
  console.log(`  HEAD bottom  ${r.headBot.toFixed(6)}  (${r.headBotBy})`);
  console.log(`  FIGURE  y ${r.figBot.toFixed(6)} .. ${r.figTop.toFixed(6)}   height ${(r.figTop - r.figBot).toFixed(6)}`);
  console.log(`  🔴 AIR GAP once the column goes: ${r.gap.toFixed(6)} m`
    + `   = ${(r.gap / r.headRadius).toFixed(4)} R   = ${(r.gap / r.torsoHeight).toFixed(4)} torsoH`);
  if (PARTS) {
    const top = r.body.slice().sort((a, b) => b.yMax - a.yMax).slice(0, 10);
    const bot = r.head.slice().sort((a, b) => a.yMin - b.yMin).slice(0, 10);
    console.log('  body, highest 10:');
    for (const p of top) console.log(`    ${p.name.padEnd(28)} yMax ${p.yMax.toFixed(4)}  x[${p.xMin.toFixed(3)},${p.xMax.toFixed(3)}]  z[${p.zMin.toFixed(3)},${p.zMax.toFixed(3)}]`);
    console.log('  head, lowest 10:');
    for (const p of bot) console.log(`    ${p.name.padEnd(28)} yMin ${p.yMin.toFixed(4)}  x[${p.xMin.toFixed(3)},${p.xMax.toFixed(3)}]  z[${p.zMin.toFixed(3)},${p.zMax.toFixed(3)}]`);
  }
}
if (JSONOUT) console.log(`\n${writeOut(JSONOUT, out)}`);
