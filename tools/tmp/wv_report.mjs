#!/usr/bin/env node
/**
 * WV_REPORT — THE STANDING MATRIX, RE-DERIVED FROM THE MEASUREMENTS EVERY TIME.
 *
 * `wv_area.mjs` measures; this joins its two camera runs into the one table Uri asked
 * for and turns it into a VERDICT with a stated rule. It renders nothing and opens no
 * browser, so it is cheap to re-run and it cannot quietly disagree with the data —
 * there is no number in here that is not read out of the JSON.
 *
 * ── THE PASS RULE, STATED BEFORE THE ANSWER (CLAUDE.md #10) ─────────────────────
 *
 * A weapon PASSES the visual-area axis when, for every beat it draws:
 *
 *   (a) it delivers pixels at all — `shipped > 0`; and
 *   (b) its bespoke path does not deliver MATERIALLY LESS than the generic effect it
 *       replaced: `ratio >= 1 - floor`, where `floor` is that run's NULL ARM — the
 *       deviation of the rows whose ratio is 1.000 by construction.
 *
 * (b) is a REGRESSION rule, not a beauty contest, and that is deliberate. Every
 * bespoke hook replaces something that already shipped and already cleared review, so
 * "is this big enough" has an exact per-weapon answer sitting in the tree. It needs no
 * threshold to be invented, it moves with the camera and the arena instead of going
 * stale, and it is the ratio that made `pj_probe`'s tomato legible as a defect at all
 * (36 px against the generic path's 686).
 *
 * 🔴 **WHAT THIS RULE IS NOT: A LEGIBILITY VERDICT.** Delivered area is a SCREEN, not
 * a judgement. `tools/tmp/p2_bgcross.mjs` measured legibility against the surfaces a
 * weapon actually crosses and found area's rank correlation with it is **0.230** — the
 * strongest predictor was the weapon's OWN LIGHTNESS at **-0.738**. So:
 *   · a weapon that FAILS here is delivering less than the thing it replaced, which is
 *     a fact about the tree and is actionable on its own;
 *   · a weapon that PASSES here has cleared area and NOTHING ELSE. It can still be
 *     illegible against what it crosses, wrong in colour, or wrong in shape.
 * Reporting a pass as "this weapon looks right" would be `docs/LESSONS.md` §6b — a
 * probe telling you what is broken and being read as telling you what the viewer sees.
 *
 * ── AND WHAT IS NOT MEASURED AT ALL ────────────────────────────────────────────
 * Rows carry `satPct`. A row where BOTH arms fill most of the frame has a ratio that
 * is arithmetically near 1.0 and means nothing — two effects that each cover three
 * quarters of the screen cannot differ much however different they are. Those rows are
 * printed as SATURATED and excluded from the verdict rather than counted as passes.
 *
 * ── WHAT IT SAID ON 8ca8f88, BOTH CAMERAS, repeat 3 ────────────────────────────
 *
 *   null-arm floor          +/-2.0% at BOTH pitches (14 rows, max deviation 0.00%)
 *   INVISIBLE  2 · HALVED 20 · MARGINAL 34 · CLEAN 18   of 74 judged rows
 *   weapons with no invisible and no halved beat          17 of 33
 *   weapons whose shortfall is NOT explained by a
 *     designed roster-wide treatment                      16 — EVERY ONE ON IMPACT
 *
 * 🔴 **AND THE TWO CAMERAS AGREE ON EVERY ONE OF THEM.** All 22 invisible/halved rows
 * are short at pitch 58 AND at pitch 20; the 8 cross-camera disagreements are all
 * MARGINAL rows sitting on the boundary (0.74-1.02x one way, 0.79-1.82x the other).
 * That is what CLAUDE.md #3 predicts for a real geometric fact rather than a
 * foreshortening artefact — *"a limb passing through a torso is a 3D fact; it is wrong
 * at every angle, and the shallow view does not make it wrong, it makes it VISIBLE."*
 * A shortfall that appeared only at 20 degrees would have been a camera story.
 *
 *   node tools/tmp/wv_report.mjs                      # reads shots/wv/wv_area.p*.json
 *   node tools/tmp/wv_report.mjs --dir shots/wv
 */
import { readFile, writeFile } from 'node:fs/promises';

function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const DIR = String(arg('dir', 'shots/wv'));
const SAT_LIMIT = Number(arg('satLimit', 40));
const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);

async function load(p) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } }

const main = async () => {
  const a = await load(`${DIR}/wv_area.p58.json`);
  const b = await load(`${DIR}/wv_area.p20.json`);
  if (!a) { log(`no ${DIR}/wv_area.p58.json — run wv_area.mjs --pitch 58 first`); process.exitCode = 2; return; }

  const floor58 = a.nullArm?.floor ?? null;
  const floor20 = b?.nullArm?.floor ?? null;
  log('══════════════════════════════════════════════════════════════════════════════');
  log(' WEAPON VISUAL MATRIX — delivered pixel area, bespoke vs the generic path');
  log('══════════════════════════════════════════════════════════════════════════════');
  log(`match camera  pitch 58, shipped framing        · ${a.results.length} rows · readback ${a.readback.join('x')}`);
  if (b) log(`lobby-analogue pitch 20, ground ${b.detectWidth} wu (DETECTOR — areas are NOT shipped scale) · ${b.results.length} rows`);
  else log(`lobby-analogue pitch 20: NOT RUN`);
  log(`\nNULL-ARM FLOOR (rows whose two arms are the same code path, so ratio is 1.000 by construction):`);
  log(`  pitch 58: n=${a.nullArm?.n ?? 0}  median dev ${((a.nullArm?.medianDev ?? 0) * 100).toFixed(2)}%  p90 ${((a.nullArm?.p90Dev ?? 0) * 100).toFixed(2)}%  max ${((a.nullArm?.maxDev ?? 0) * 100).toFixed(2)}%  → floor +/-${(floor58 * 100).toFixed(1)}%`);
  if (b) log(`  pitch 20: n=${b.nullArm?.n ?? 0}  median dev ${((b.nullArm?.medianDev ?? 0) * 100).toFixed(2)}%  p90 ${((b.nullArm?.p90Dev ?? 0) * 100).toFixed(2)}%  max ${((b.nullArm?.maxDev ?? 0) * 100).toFixed(2)}%  → floor +/-${(floor20 * 100).toFixed(1)}%`);
  log(`🔴 A ratio inside 1 +/- floor is INDISTINGUISHABLE from "no bespoke effect at all". Do not act on one.`);

  const rowsOf = (j) => new Map((j?.results ?? []).map((r) => [`${r.id}.${r.key}|${r.beat}`, r]));
  const R58 = rowsOf(a); const R20 = rowsOf(b);
  const weapons = a.rows;
  const beats = [...new Set(a.results.map((r) => r.beat))];

  // ── The matrix ────────────────────────────────────────────────────────────────
  log(`\n${pad('weapon', 22)}${pad('beat', 11)}${rp('px@58', 8)}${rp('ctl@58', 8)}${rp('r@58', 7)}${rp('r@20', 7)}${rp('sat%', 6)}  verdict`);
  log('─'.repeat(88));
  const verdicts = new Map();
  const flat = [];
  for (const w of weapons) {
    for (const beat of beats) {
      const k = `${w.id}.${w.key}|${beat}`;
      const r = R58.get(k); if (!r) continue;
      const r2 = R20.get(k);
      let v;
      if (!r.hasHook) v = 'no bespoke hook — generic path, by design';
      else if (r.satPct > SAT_LIMIT) v = `SATURATED (${r.satPct.toFixed(0)}% of frame) — ratio uninformative, excluded`;
      else if (r.shippedPx <= 0) v = '🔴 DELIVERS NOTHING';
      else if (r.ratio < 1 - floor58) v = `🔴 ${(r.ratio * 100).toFixed(0)}% of the effect it replaced`;
      else v = 'ok on area';
      flat.push({ w, beat, r, r2, v });
      const cur = verdicts.get(`${w.id}.${w.key}`) ?? [];
      cur.push({ beat, v, r, r2 });
      verdicts.set(`${w.id}.${w.key}`, cur);
      log(`${pad(`${w.id}.${w.key}`, 22)}${pad(beat, 11)}${rp(r.shippedPx, 8)}${rp(r.genericPx, 8)}${rp(r.ratio.toFixed(2), 7)}${rp(r2 ? r2.ratio.toFixed(2) : '-', 7)}${rp(r.satPct.toFixed(0), 6)}  ${v}`);
    }
  }

  // ── Verdict ───────────────────────────────────────────────────────────────────
  const judged = flat.filter((f) => f.r.hasHook && f.r.satPct <= SAT_LIMIT);

  // NON-VACUITY (CLAUDE.md #6): every filtered set asserted over is checked non-empty.
  if (!judged.length) { log('\n🔴 NOTHING WAS JUDGED — every row was excluded, so the count below would be vacuous.'); process.exitCode = 1; return; }

  log(`\n══ VERDICT ═══════════════════════════════════════════════════════════════════`);
  log(`rows measured           ${flat.length}   (${weapons.length} weapons x the beats each one draws)`);
  log(`rows JUDGED             ${judged.length}   (has a bespoke hook AND is not saturated)`);
  log(`rows excluded           ${flat.length - judged.length}   ` +
      `(${flat.filter((f) => !f.r.hasHook).length} no hook — generic by design; ` +
      `${flat.filter((f) => f.r.hasHook && f.r.satPct > SAT_LIMIT).length} saturated)`);

  /**
   * ── WHY A BINARY "ratio < 1 - floor" IS THE WRONG HEADLINE ────────────────────
   *
   * The null-arm floor is +/-2.0%, which is a statement about the INSTRUMENT and not
   * about a player. Applied as a pass/fail it fails `sushi.Fish` at 0.96x and
   * `soup.Splash`'s projectile at 0.92x alongside `burrito.Swarm`'s impact at 0.10x,
   * and reports "6 of 33 pass" — a number that is arithmetically correct and would
   * send an owner to twenty-seven files. `docs/LESSONS.md` §6b in one line: the probe
   * measured the right thing and the verdict drawn from it was not the thing anyone
   * should act on.
   *
   * So the rows are TIERED, and both bars are numbers this repo already owns:
   *
   *  INVISIBLE   `shipped < 300 px` at this 800x450 readback. Not invented here —
   *              `vfx.ts:castMuzzle`'s own derivation calls 282 px *"inside
   *              measurement noise of the floor"* and 413 px *"clears it with
   *              margin"*, and says of an 18 px cast: *"Eighteen pixels is not a quiet
   *              cast, it is a cast the player cannot see fire."* That is this
   *              project's own visibility floor and it is reused rather than guessed.
   *
   *  HALVED      `ratio < 0.5`. This one IS a chosen materiality bar, and it is
   *              declared as such: it is a factor of two, far outside any measurement
   *              question, and it is the size of gap that `pj_probe`'s 36-vs-686
   *              (0.05x) and this run's 0.10x sit in.
   *
   *  MARGINAL    below the floor but above both bars. Real, small, and NOT a reason
   *              to open a file on its own.
   */
  const ABS_FLOOR = Number(arg('absFloor', 300));
  const HALVED = Number(arg('halved', 0.5));
  const invisible = judged.filter((f) => f.r.shippedPx < ABS_FLOOR);
  const halved = judged.filter((f) => f.r.shippedPx >= ABS_FLOOR && f.r.ratio < HALVED);
  const marginal = judged.filter((f) => f.r.shippedPx >= ABS_FLOOR && f.r.ratio >= HALVED && f.r.ratio < 1 - floor58);
  const clean = judged.filter((f) => f.r.ratio >= 1 - floor58);
  log(`\n  INVISIBLE  ${String(invisible.length).padStart(2)}  shipped < ${ABS_FLOOR} px — under this repo's own visibility floor (vfx.ts:castMuzzle)`);
  log(`  HALVED     ${String(halved.length).padStart(2)}  >= ${ABS_FLOOR} px but under ${HALVED}x of the effect it replaced`);
  log(`  MARGINAL   ${String(marginal.length).padStart(2)}  measurably short (outside the +/-${(floor58 * 100).toFixed(0)}% null-arm floor) but neither of the above`);
  log(`  CLEAN      ${String(clean.length).padStart(2)}  at or above the effect it replaced`);
  for (const [name, set] of [['INVISIBLE', invisible], ['HALVED', halved]]) {
    if (!set.length) { log(`\n  ${name}: none`); continue; }
    log(`\n  ${name}:`);
    for (const f of set.sort((x, y) => x.r.ratio - y.r.ratio)) {
      const cross = f.r2 && f.r2.hasHook ? `   pitch20 ${f.r2.ratio.toFixed(2)}x` : '';
      log(`     ${pad(`${f.w.id}.${f.w.key}`, 20)} ${pad(f.beat, 11)} ${rp(f.r.shippedPx, 6)} px vs ${rp(f.r.genericPx, 6)} px = ${f.r.ratio.toFixed(2)}x${cross}`);
    }
  }

  const failing = [...invisible, ...halved];
  const failWeapons = new Set(failing.map((f) => `${f.w.id}.${f.w.key}`));
  const passWeapons = weapons.filter((w) => !failWeapons.has(`${w.id}.${w.key}`));

  /**
   * ── TWO OF THE THREE BEATS HAVE A DESIGNED SHORTFALL, AND READING THEM AS BUGS
   *    WOULD BE THE MISTAKE THIS FILE EXISTS TO PREVENT ──────────────────────────
   *
   * A raw list would send an owner to twenty files. It should send them to two
   * numbers. Both are in `game/vfx.ts`, both are deliberate, both are documented
   * there, and both apply to EVERY weapon at once:
   *
   *  CAST · `castMuzzle`'s subordinate anchor. A bespoke `cast()` does not replace the
   *    muzzle flash — the flash is demoted from `'primary'` (k=1) to `'subordinate'`
   *    (k=0.75) and the bespoke detail is drawn on top. A radial sprite's area goes as
   *    the square of scale, so the anchor alone is **0.5625** of the generic flash by
   *    construction, and a cast row lands at 0.5625 + (its own detail / generic).
   *    Measured here: seventeen ranged casts at 0.61-0.67x, which IS the anchor.
   *    ⚠️ That block's own prose is STALE: `vfx.ts:3143` says the subordinate is *"the
   *    same sprite at 62% linear size"* while `vfx.ts:3191` codes **0.75**, and
   *    `vfx.ts:3182` REJECTS 0.62 by name nine lines above the code.
   *
   *  PROJECTILE · `60e9942`'s size floor plus its halo. A bespoke sculpt is scaled up
   *    until its bounding radius reaches `PROJECTILE_MIN_R` = **0.26 m**; the generic
   *    path draws `SphereGeometry(wu(10))` = **0.5 m**. Half the radius by design.
   *    Every weapon whose sculpt hits that floor measures the SAME 552-596 px against
   *    the generic 1215 px — 0.45-0.46x, six weapons, identical to the pixel.
   *
   *  IMPACT · NOTHING. `spawnImpactBurst` takes the bespoke branch and RETURNS; the
   *    generic burst is not drawn at all and no anchor is left under it. There is no
   *    designed shortfall on this beat, which is why every INVISIBLE row and thirteen
   *    of the HALVED rows are impacts — and why the cast fix has no counterpart here.
   */
  const DESIGNED = { cast: [0.50, 0.80], projectile: [0.25, 0.60] };
  const explained = [];
  const unexplained = [];
  for (const f of [...invisible, ...halved, ...marginal]) {
    const band = DESIGNED[f.beat];
    if (band && f.r.ratio >= band[0] && f.r.ratio <= band[1]) explained.push(f); else unexplained.push(f);
  }
  log(`\n── of the ${invisible.length + halved.length + marginal.length} short rows, by CAUSE ──────────────────────────────────────────`);
  log(`  ${explained.length} sit inside a DESIGNED, roster-wide treatment (cast anchor 0.5625 · projectile floor+halo 0.45)`);
  log(`  ${unexplained.length} do NOT — of which ${unexplained.filter((f) => f.beat === 'impact').length} are on the IMPACT beat, where no treatment exists to explain them`);

  const marginalOnly = new Set(marginal.map((f) => `${f.w.id}.${f.w.key}`));
  for (const k of failWeapons) marginalOnly.delete(k);
  log(`\n🔴 WEAPONS WITH NO INVISIBLE AND NO HALVED BEAT: ${passWeapons.length} of ${weapons.length}`);
  log(`   of which ${passWeapons.length - marginalOnly.size} are clean on every beat, and ${marginalOnly.size} carry a MARGINAL shortfall only:`);
  log(`   ${[...marginalOnly].join(', ') || '(none)'}`);
  log(`\nWEAPONS WITH AN INVISIBLE OR HALVED BEAT: ${failWeapons.size}`);
  log(`   ${[...failWeapons].join(', ')}`);

  /**
   * ⚠️ AND THE COUNT AN OWNER SHOULD ACT ON IS THE ONE WITH THE DESIGNED TREATMENTS
   * TAKEN OUT. Six weapons appear above ONLY because their projectile sits at the
   * 0.45x that `PROJECTILE_MIN_R` produces BY CONSTRUCTION for every sculpt small
   * enough to hit it. Counting those as per-weapon defects is counting one decision
   * six times; the decision is worth revisiting, in one place, and the weapon files
   * are not the place.
   */
  const badUnexplained = new Set([...invisible, ...halved]
    .filter((f) => { const b = DESIGNED[f.beat]; return !(b && f.r.ratio >= b[0] && f.r.ratio <= b[1]); })
    .map((f) => `${f.w.id}.${f.w.key}`));
  log(`\n🔴 WEAPONS WHOSE SHORTFALL IS *NOT* EXPLAINED BY A DESIGNED TREATMENT: ${badUnexplained.size}`);
  log(`   ${[...badUnexplained].join(', ')}`);
  log(`   → these are the rows to open a file for. The other ${failWeapons.size - badUnexplained.size} are one decision counted ${failWeapons.size - badUnexplained.size} times.`);
  log(`\n⚠️ THIS COUNT MEANS ONE THING: no beat of that weapon is under this repo's own`);
  log(`   ${ABS_FLOOR} px visibility floor or under ${HALVED}x of the effect it replaced. It is NOT a`);
  log(`   legibility verdict — commit a419871 measured area's rank correlation with`);
  log(`   legibility at 0.230 against the weapon's OWN LIGHTNESS at -0.738. A weapon can`);
  log(`   clear every bar here and still vanish onto a cream floor.`);

  // ── Cross-camera agreement: does the shallow detector change any verdict? ─────
  if (b) {
    const both = judged.filter((f) => f.r2 && f.r2.hasHook && f.r2.satPct <= SAT_LIMIT);
    if (!both.length) log(`\n(no row was judgeable at BOTH cameras — cross-camera agreement not measurable)`);
    else {
      const disagree = both.filter((f) => (f.r.ratio < 1 - floor58) !== (f.r2.ratio < 1 - floor20));
      log(`\n══ CROSS-CAMERA ═════════════════════════════════════════════════════════════`);
      log(`${both.length} rows judgeable at both cameras · ${disagree.length} where the two cameras DISAGREE on the verdict`);
      for (const f of disagree) {
        log(`   ${pad(`${f.w.id}.${f.w.key}`, 20)} ${pad(f.beat, 11)} 58deg ${f.r.ratio.toFixed(2)}x  ·  20deg ${f.r2.ratio.toFixed(2)}x`);
      }
      log(`(CLAUDE.md #3: a defect is a 3D fact and is wrong at every angle — the shallow`);
      log(` view makes it VISIBLE, it does not create it. A disagreement is a row to look at.)`);
    }
  }

  await writeFile(`${DIR}/wv_matrix.json`, JSON.stringify({
    floor58, floor20, satLimit: SAT_LIMIT,
    rows: flat.map((f) => ({
      id: f.w.id, key: f.w.key, type: f.w.type, beat: f.beat, hasHook: f.r.hasHook,
      shipped58: f.r.shippedPx, generic58: f.r.genericPx, ratio58: f.r.ratio, sat58: f.r.satPct,
      shipped20: f.r2?.shippedPx ?? null, generic20: f.r2?.genericPx ?? null, ratio20: f.r2?.ratio ?? null, sat20: f.r2?.satPct ?? null,
      verdict: f.v,
    })),
    passWeapons: passWeapons.map((w) => `${w.id}.${w.key}`),
    failWeapons: [...failWeapons],
    failuresExplainedByDesign: explained.map((f) => `${f.w.id}.${f.w.key}/${f.beat}=${f.r.ratio}`),
    failuresUnexplained: unexplained.map((f) => `${f.w.id}.${f.w.key}/${f.beat}=${f.r.ratio}`),
    impactFailures: failing.filter((f) => f.beat === 'impact').map((f) => `${f.w.id}.${f.w.key}=${f.r.ratio}`),
    invisible: invisible.map((f) => `${f.w.id}.${f.w.key}/${f.beat}=${f.r.shippedPx}px`),
    halved: halved.map((f) => `${f.w.id}.${f.w.key}/${f.beat}=${f.r.ratio}`),
    unexplainedWeapons: [...badUnexplained],
  }, null, 2));
  log(`\njson -> ${DIR}/wv_matrix.json`);
};
main();
