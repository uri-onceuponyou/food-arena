/**
 * The four body archetypes.
 *
 * ── Why four shared bodies and not eleven bespoke ones ───────────────────────
 * Rendering the cast as pure black silhouettes (`preview.html?piece=roster&
 * silhouette=1`) showed every character standing on the SAME body: two stubby
 * legs, one narrow waist, one pair of capsule arms. All eleven differed only above
 * the neck, which is the measurable form of the "one template with different
 * heads" note five rounds of prose critique kept landing on.
 *
 * The cause was mechanical, not artistic. `RigProportions` exposed only
 * thicknesses and widths — there was no knob for torso size, torso presence or
 * limb LENGTH — so no character could change its body shape even if it wanted to.
 *
 * Uri's call on the fix:
 *
 *   > "I think it will be easier to manage 3/4 body types and reuse them instead
 *   > of creating 11 unique body types. For example — one body type has very short
 *   > legs and hands, no torso — would work for the bottle. The majority of the
 *   > character sits in the head and sometimes torso. Then the loops can focus only
 *   > on head+torso and disregard the body, just make sure it fits."
 *
 * Four deliberately CONTRASTING bodies separate better in silhouette than eleven
 * near-identical bespoke ones, at a fraction of the work, and it collapses each
 * character's scope to head + torso.
 *
 * ── The rule for character work ──────────────────────────────────────────────
 * **You own head + torso dressing. You do not author a body.** Pick an archetype
 * and make your head fit it. Switching archetype is allowed and is a legitimate
 * fix. Tweaking a knob or two off an archetype is fine. Hand-authoring a twelfth
 * bespoke body is not — that is how the cast ended up with one body in the first
 * place, only worse, because eleven hand-tuned bodies converge on the mean.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 * ```ts
 * import { bodyType } from './bodies';
 *
 * this.rig = new ChibiRig({
 *   palette: { ... },
 *   proportions: bodyType('stout', { height: 2.05, headFraction: 0.60 }),
 *   stance: { ... },
 * });
 * ```
 * Then read every derived length off `rig.metrics` — never hardcode a copy of a
 * rig constant, because an archetype change silently invalidates it.
 *
 * ## The archetypes
 *
 * | Name       | Form                                                            | Cast |
 * |------------|-----------------------------------------------------------------|------|
 * | `stub`     | No torso at all. Head sits on the hips, very short thick limbs, wide stance. "A thing with feet." | waterbottle, egg, lollipop, donut |
 * | `stout`    | Short WIDE torso, thick short limbs, low centre of mass. Heavy and planted. | soup, hamburger, taco |
 * | `standard` | Medium torso and limbs — the neutral chibi baseline.            | pizza, sushi |
 * | `lanky`    | Tall NARROW torso, long thin limbs, narrow stance. Tall and light. | burrito, hotdog |
 *
 * Assignment follows each food's real-world shape class, so the body reinforces
 * identity instead of fighting it.
 *
 * ## The numbers, side by side
 *
 * Everything below is a fraction of the character's own height. This table is the
 * archetypes' entire reason for existing — read DOWN a column to see how much
 * separation each knob is buying.
 *
 * | knob            | stub | stout | standard | lanky |
 * |-----------------|------|-------|----------|-------|
 * | `headFraction`  | 0.68 | 0.50  | 0.46     | 0.40  |
 * | `torsoFraction` | 0    | 0.24  | 0.28     | 0.30  |
 * | `legFraction`   | 0.24 | 0.31  | 0.30     | 0.34  |
 * | `armFraction`   | 0.19 | 0.175 | 0.22     | 0.30  |
 * | torso width     | —    | 0.39  | 0.24     | 0.17  |
 * | `shoulderWidth` | 0.32 | 0.25  | 0.20     | 0.145 |
 * | `stanceWidth`   | 0.225| 0.215 | 0.115    | 0.062 |
 * | `armRadius`     | .062 | 0.085 | 0.058    | 0.040 |
 * | `legRadius`     | .058 | 0.074 | 0.056    | 0.043 |
 * | `footClearance` | 0.25 | 0.23  | 0.18     | 0.125 |
 *
 * ── The leg row is the round-2 rewrite, and it is a BUG FIX ──────────────────
 * `legFraction` and `legRadius` used to be 0.15/0.075 (STUB) and 0.25/0.098
 * (STOUT). At those values `ChibiRig`'s own arithmetic — thigh and shin split the
 * bone length, `CapsuleGeometry(r, max(0.001, len - 2r))` — produced segments
 * SHORTER than they were thick, which `THREE` degenerates into a sphere. The two
 * spheres then sat inside each other and inside the boot, and the shin reached the
 * screen at **exactly 0.000 of its own footprint** on nine of eleven characters.
 * `tools/tmp/legmodel.mjs` prints the ratio that decides it; it sorted the cast
 * into the measured pass/fail piles with no overlap. See each archetype below.
 *
 * ── ⚠️ THE ARM ROW HAS THE SAME DEFECT AND HAS NOT BEEN FIXED ────────────────
 * Round 2 fixed the legs and never checked the arms. Round 3 measured them. The
 * arm chain is built by the identical arithmetic — `armLen = height *
 * armFraction`, split 0.523 / 0.477, drawn as `CapsuleGeometry(r, len - 2r)` with
 * `r = armRadius` (upper) and `armRadius * 0.92` (fore) — so the same ratio
 * decides whether a forearm is a limb or a ball:
 *
 * | archetype  | `armFraction` | forearm len / 2r | hand diameter / forearm len |
 * |------------|---------------|------------------|------------------------------|
 * | `stub`     | 0.19          | 0.79             | 1.38                         |
 * | `stout`    | 0.175         | **0.53**         | **2.09**                     |
 * | `standard` | 0.22          | 0.98             | 1.32                         |
 * | `lanky`    | 0.30          | **1.94**         | 0.77                         |
 *
 * Read that against the legs' measured split — every character at <= 0.31 failed,
 * every character at >= 0.70 passed — and **LANKY is the only archetype whose arm
 * segments are longer than they are thick**, exactly as LANKY was the only one
 * whose legs were. On three of the four, the HAND BALL is wider than the whole
 * forearm is long, so the segment has no visible middle at any camera angle.
 *
 * This was confirmed on the character where it was worst. Soup's forearms were the
 * cast's lowest-delivering limb group (0.337 / 0.383), two bow retunes had already
 * measured worse, and the occluder — named by ablation in `tools/tmp/occluder.mjs`,
 * which reproduces `limbcheck`'s own metric and then hides one candidate at a time —
 * turned out to be **its own upper arm (40.7% of the forearm's footprint) and its
 * own hand cap (25.9%)**, with the bowl contributing nothing. Lengthening soup's
 * arm to `armFraction: 0.245` (forearm ratio 0.75, i.e. just over the legs' own
 * pass threshold) and sizing the terminal cap against the forearm instead of
 * `handRadius` took them to 0.515 / 0.560.
 *
 * **The archetype values below are deliberately NOT changed.** Soup's fix is
 * character-local because moving `armFraction` here moves nine characters at once
 * and every one of them needs re-measuring — that is the legs' pass over again and
 * it wants its own. `heaviness` does not read `armFraction`, so the motion weights
 * are not affected either way.
 *
 * Total nominal height stays near 0.95H in every archetype, so the cast still
 * reads as one family. When a character's food mass is not the ±R sphere the rig
 * assumes — most of them aren't — it re-balances with its own `headFraction` or
 * `height`, and the check is `shoot.mjs --char <id>`, which prints the real
 * bounding height. Aim for a top of head near 2.10m.
 */

import type { RigProportions } from './rig';
import { CHARACTER_HEIGHT } from '../units';

export type BodyArchetypeName = 'stub' | 'stout' | 'standard' | 'lanky';

/**
 * An archetype, expressed entirely in fractions of the character's own height so
 * a character can resize without re-deriving anything.
 *
 * `torsoWidthRatio` is a multiple of `shoulderWidth`, and `torsoDepthRatio` a
 * multiple of the resulting torso width. Torso half-width MUST stay below the
 * shoulder pivot (i.e. `torsoWidthRatio < 2.0`, comfortably below ~1.7) or the
 * arms sink into the body and the character reads as a pile of overlapping
 * dough balls — a real regression this rig has already shipped once.
 */
export interface BodyArchetype {
  /** One-line description, for the character loops. */
  readonly note: string;
  readonly headFraction: number;
  readonly legFraction: number;
  /** 0 means NO TORSO. */
  readonly torsoFraction: number;
  readonly armFraction: number;
  readonly shoulderFraction: number;
  readonly headMount: number;
  /**
   * Clear vertical gap between torso top and the bottom of the food mass, as a
   * fraction of height. See `RigProportions.neckFraction` for the measurement that
   * put it here; the short version is that the reference puts its head/body break
   * at 0.375-0.522 of figure height with a pinch of 0.2449-0.7458, and this cast
   * measured 0.1441 mean with 8 of 11 below the weakest plate.
   *
   * The head SHRINKS to pay for it, so total height does not move.
   *
   * ── 🔴 THE COST OF A NONZERO VALUE, MEASURED AT THE CAMERA URI JUDGES ───────
   * A gap builds a COLUMN and a COLLAR (`rig.ts`, `neckGap > 0`). Those are correct
   * structure only while the food mass HIDES them; a column the mass does not hide is
   * a third mass at the character's most prominent junction. Uri, on taco:
   * *"No mouth, seems like a hat or something."*
   *
   * Measured 2026-08-11 by ABLATION on the shipped lobby capture — the column and
   * collar painted `#FF00FF`, captured through `cr2_shot`, magenta counted, with the
   * unablated capture as a zero-scoring control:
   *
   *   char      neck px on a 900x1400 lobby capture
   *   hotdog          9767      ← LANKY, `neckFraction: 0.065`
   *   sushi           5085
   *   soup            4289
   *   pizza           1914
   *   burrito            0      ← the only one whose mass covers it
   *
   * Four of the five characters that build a neck put 2k-10k px of it on screen.
   * `shots/rg/normal_fit/hotdog.png` is the worked example and it is unambiguous: a
   * peach column with a hard black ring at its base, between the bun and the torso.
   *
   * ⚠️ The old table in `rig.ts` measured this at the MATCH camera (pitch 58), where
   * it reads as 86% HIDDEN, and treated the shortfall as a defect to close. **That
   * sign is backwards and it is corrected in `rig.ts`.** Occlusion costs
   * `Δy / tan(pitch)` of forward overhang, so the lobby demands 4.4x more than the
   * match camera does — verifying at 58 cannot see this at all.
   *
   * **So a nonzero value here is a commitment that every character on this archetype
   * has forward OVERHANG at its chin.** Check with `node tools/tmp/rg_neckz.mjs`
   * before raising one, and note that `0` is fully supported: STUB uses it, and
   * `taco.ts` opted out with an exact compensation that leaves R and `headCentreY`
   * identical to six figures.
   */
  readonly neckFraction: number;
  readonly footClearance: number;
  readonly shoulderWidthF: number;
  readonly stanceWidthF: number;
  readonly armRadiusF: number;
  readonly handRadiusF: number;
  readonly legRadiusF: number;
  /**
   * Torso width as a fraction of HEIGHT. Takes precedence over `torsoWidthRatio`.
   *
   * ── Why this exists ────────────────────────────────────────────────────────
   * `torsoWidthRatio` is a multiple of `shoulderWidth`, so widening the shoulders
   * silently widened the WAIST by the same proportion — and widening the shoulders
   * is the standard fix for an arm buried in the food mass. The two changes fight:
   * the arm moves out, the body it has to clear follows it out, and the character
   * ends up exactly as buried but wider. Recorded as a known defect in
   * `docs/STATE.md`; measured on Hamburger, where freeing the arms costs +0.12m of
   * shoulder and would have bought the bottom bun +0.19m of extra half-width.
   *
   * Every archetype's value here is its OWN previous product (`shoulderWidthF *
   * torsoWidthRatio`), so the default cast is unchanged to the millimetre and only
   * the coupling is gone.
   */
  readonly torsoWidthF: number;
  /** Legacy: torso width as a multiple of `shoulderWidth`. Only used if `torsoWidthF` is 0. */
  readonly torsoWidthRatio: number;
  readonly torsoDepthRatio: number;
}

export const BODY_ARCHETYPES: Record<BodyArchetypeName, BodyArchetype> = {
  /**
   * STUB — no torso. The food mass IS the body.
   *
   * The head has to be big here, and that is arithmetic rather than taste: with no
   * torso, the only things between the ground and the top of the character are the
   * legs and the head, so a normal 0.46 head would leave the character two thirds
   * of its own height. `headFraction` 0.76 puts the head bottom just below the hip
   * line, so the mass sits ON the hips with no gap and no visible waist.
   *
   * `shoulderFraction` matters more here than anywhere else. With no torso the
   * default (`torsoFraction * 0.78`) would be zero and the arms would sprout from
   * the ankles. 0.26 puts the shoulder pivot a quarter of the way up the head mass,
   * ABOVE its widest point — see the measurement note below for why 0.12 did not.
   *
   * **`shoulderWidth` almost always needs a per-character tweak on STUB, and that
   * is expected rather than a failure of the preset.** With no torso, the arms
   * have to clear the FOOD, and food shapes are not interchangeable: a bottle is
   * 0.58R wide at shoulder height, an egg is 0.96R, a lollipop is a 0.19R stick.
   * One number cannot serve all three. 0.32H is the middle of that range (about
   * 0.84R at the default head size) — start there, render, and move it until the
   * upper arm is neither buried in the mass nor floating clear of it. This is the
   * single most common thing to get wrong on this archetype.
   *
   * ── `shoulderFraction` 0.12 -> 0.26, and `stanceWidthF` 0.16 -> 0.225 ────────
   * Both were measured, not guessed (`tools/tmp/limbcheck.mjs`, which renders each
   * joint group alone and again with it hidden, and reports the share of its own
   * footprint that the food mass covers).
   *
   * At 0.12 the arm pivot sits about a fifth of the way up the food — which on
   * every bottom-heavy STUB mass is at or below its widest point, so the upper arm
   * starts inside the food and the forearm is deeper still. Egg had already
   * discovered this and overridden to 0.30 after a critic reported it had no arms;
   * Water Bottle had not, and measured forearm delivery of **0.002 and 0.004** —
   * two limbs at effectively zero pixels. 0.26 puts the pivot above the widest
   * point on all four STUB masses.
   *
   * The stance is the same failure on the legs (Finding 2): hips at 0.16H = 0.34m
   * against masses 0.32-0.72m wide at hip height, so on Donut, Egg and Lollipop the
   * thighs and shins measured 0.00-0.09 delivery — the cast-wide "feet with no
   * legs" read. Note this cannot be fixed by lowering the mass alone: the camera
   * looks DOWN (22 deg in preview, 58 deg in game), so anything above the hips
   * projects over the legs regardless of where its bottom edge sits.
   *
   * ── `legFraction` 0.15 -> 0.24, `legRadiusF` 0.075 -> 0.058, ────────────────
   * ── `footClearance` 0.52 -> 0.25, `headFraction` 0.76 -> 0.68 ──────────────
   * The wide stance was necessary and not sufficient, and the remainder was never
   * a camera problem. At 0.15H the whole leg is 0.315 m, `footClearance` 0.52 ate
   * more than half of it, and what was left — a 0.091 m thigh and a 0.060 m shin —
   * was THINNER THAN IT WAS WIDE against a 0.158 m leg radius. `CapsuleGeometry`
   * turns any segment with `len < 2r` into a sphere, so STUB's leg was literally
   * two overlapping balls 0.32 m across spanning 0.15 m of height, inside a boot
   * 0.36 m wide whose top sat ABOVE the knee. Delivered shin pixels: **zero**.
   *
   * 0.24H with a 0.058 radius makes the shin 1.4x as long as it is wide and puts
   * the boot's top at 31% of it. `footClearance` follows the rule the whole cast
   * now shares — `0.96 * legRadiusF / legFraction`, which is what keeps a boot
   * seated on the floor without being squashed, and which reproduces LANKY's
   * long-standing hand-picked 0.12 to two decimal places.
   *
   * `headFraction` pays for the legs so the archetype's total height does not
   * move: 0.24 + 0.68 * 0.975 = 0.893 against the old 0.15 + 0.76 * 0.975 = 0.891.
   * The head is still nearly TWICE any other archetype's, which is what STUB is
   * for. (All four STUB characters override `headFraction` anyway — see their own
   * files for the same arithmetic applied to their own masses.)
   */
  stub: {
    note: 'No torso — head on the hips, short thick limbs, wide stance.',
    headFraction: 0.68,
    legFraction: 0.24,
    // ── 0 -> 0.16 WAS TRIED AND REVERTED, and the reason is worth keeping ─────
    // "No torso" is also the reason all four STUB characters measure essentially
    // ZERO internal separation: with the food mass mounted straight onto the hips
    // there is no second lobe to be narrower than, so a pinch is not merely absent,
    // it is undefined. Egg measured `neckPinch` **0.0111** at the shipped facing
    // against a six-plate Brawl Stars floor of 0.2449 — the lowest in the cast, on
    // the character a blind critic named for exactly this.
    //
    // So STUB was given a 0.16H torso, with `headFraction` 0.68 -> 0.5159 paying
    // for it exactly (2 * 0.16 / (1 + 0.95) = 0.1641, so the top of the head does
    // not move), which also activates the complete, reviewed `dressTorso` bodies
    // that Egg, Donut and Lollipop have each carried unrendered since the archetype
    // landed — every one of them commented "what she looks like the moment she has
    // a torso again".
    //
    // ⚠️ IT DELIVERED NOTHING, AND THE REASON IS `docs/LESSONS.md` §1. Rendered at
    // the shipped 58deg camera and shipped facing, the new body is INVISIBLE: the
    // food mass is 0.52-0.69H wide and overhangs a 0.38H torso completely, and a
    // camera looking DOWN sees the mass, not what is under it. Egg moved 0.0111 ->
    // 0.0172 — inside the noise — and Donut went DOWN, 0.2545 -> 0.2083.
    //
    // The lesson generalises past this knob: **on this archetype, at this camera,
    // anything added BELOW the food mass cannot be seen.** A STUB character's
    // separation has to be carved INTO its own mass — which is exactly what the egg
    // critic asked for ("carve a head out of the ball") and is per-character
    // geometry, not an archetype knob. Left for that pass; reverting is one line.
    torsoFraction: 0,
    // ── 0.13 -> 0.19, with `handRadiusF` down from 0.078 ────────────────────────
    // Water Bottle's forearms measured 0.005 and 0.005 delivered while sitting
    // essentially CLEAR of the food (screen overlap with the mass: 0.003 and
    // 0.000). Nothing about the food was hiding them — the character's own HAND
    // was. At 0.13H the whole arm is 0.273m, so the forearm is 0.130m long against
    // an 0.164m-radius hand ball centred on the wrist: the mitt is wider than the
    // limb is long and simply contains it. The same arithmetic hides Egg's
    // forearms (0.36 delivered).
    //
    // This is the invisible-render family again (`docs/LESSONS.md` §1) with the
    // occluder being a sibling limb rather than the food, which is why every fix
    // aimed at the food mass left it untouched.
    armFraction: 0.19,
    shoulderFraction: 0.26,
    headMount: 0.95,
    // 0 rather than the other archetypes' 0.045-0.065. A neck gap on STUB puts a
    // thin column between the HIPS and the food mass, where the mass already
    // overhangs it — the same invisibility the reverted torso hit, plus the risk of
    // reading as a floating head. STUB opts out until its masses are carved.
    neckFraction: 0,
    // `0.96 * legRadiusF / legFraction` — the ankle height that seats a boot on the
    // floor at full height. The old 0.52 was chosen to stop feet sized off
    // `legRadius` punching through the floor; the boot now seats itself off
    // `LimbSize.groundY`, so the clearance can go back to doing its real job.
    footClearance: 0.25,
    shoulderWidthF: 0.32,
    stanceWidthF: 0.225,
    armRadiusF: 0.062,
    handRadiusF: 0.068,
    legRadiusF: 0.058,
    // Unused (no torso) but kept sane so a character that flips to another
    // archetype for a round doesn't inherit nonsense.
    torsoWidthF: 0.32 * 1.18,
    torsoWidthRatio: 1.18,
    torsoDepthRatio: 0.88,
  },

  /**
   * STOUT — short, wide, planted. Low centre of mass.
   *
   * The torso is the differentiator: nominally 0.24H tall but 0.39H WIDE (against
   * STANDARD's 0.24H), so it reads as a barrel rather than a waist. Legs are thick
   * and the stance is the widest in the cast, which is what sells "heavy" in
   * silhouette — a character reads as heavy from its base, not from its area.
   *
   * The legs are deliberately NOT much shorter than STANDARD's. A first pass put
   * them at 0.21H and the render showed why that was wrong: short legs under a big
   * mass is STUB's read, and Hamburger stopped being distinguishable from Egg
   * except by head shape — which is the exact failure this whole exercise exists
   * to fix. STOUT separates from STUB by having a BODY, not by being short.
   *
   * ── `legFraction` 0.25 -> 0.31, `legRadiusF` 0.098 -> 0.074, ────────────────
   * ── `footClearance` 0.44 -> 0.23 ───────────────────────────────────────────
   * Same mechanism as STUB, one size up. At 0.25H/0.098 the thigh was 0.174 m long
   * and 0.402 m thick and the shin 0.113 m long and 0.362 m thick — both spheres,
   * both inside each other, both inside a boot 0.69 m long (a THIRD of the whole
   * character's height). Measured delivery of `kneeL` at run: 0.000 on all three
   * STOUT characters. `soup.ts`'s boot builder already carries a comment about
   * having had to squash the boot to stop it swallowing the shin — that was this
   * bug, treated one character at a time.
   *
   * Note STOUT's legs are now the same length as STANDARD's rather than 0.01H
   * shorter, which is what the paragraph above already asked for. The archetype's
   * separation is carried by torso width (0.39H against 0.24H), stance (0.215
   * against 0.115) and limb thickness — never by leg length.
   */
  stout: {
    note: 'Short wide torso, thick limbs, low centre of mass.',
    headFraction: 0.50,
    legFraction: 0.31,
    torsoFraction: 0.24,
    armFraction: 0.175,
    shoulderFraction: 0.24 * 0.80,
    headMount: 0.88,
    neckFraction: 0.055,
    // `0.96 * legRadiusF / legFraction`. See STUB.
    footClearance: 0.23,
    shoulderWidthF: 0.25,
    // 0.155 -> 0.215. Same measurement as STUB's: a STOUT torso is 0.39H wide and
    // the hips sat at 0.155H, so all three STOUT characters' thighs and shins were
    // inside the food (hamburger 0.006/0.000, taco 0.012/0.000, soup 0.312/0.653).
    // STOUT is the archetype whose whole read is "heavy and planted", and a planted
    // character stands WIDE — this is the one place where the fix for the bug and
    // the fix for the silhouette are the same change.
    stanceWidthF: 0.215,
    armRadiusF: 0.085,
    handRadiusF: 0.095,
    legRadiusF: 0.074,
    torsoWidthF: 0.25 * 1.55,
    torsoWidthRatio: 1.55,
    torsoDepthRatio: 0.88,
  },

  /**
   * STANDARD — the neutral baseline, and numerically identical to the rig's own
   * pre-archetype defaults. Kept unchanged on purpose: with four archetypes in
   * play something has to be the middle, and a middle that also happens to be the
   * historical default makes every other archetype a legible delta from it.
   *
   * `legFraction` 0.26 -> 0.30 and `legRadiusF` 0.062 -> 0.056 for the same reason
   * as the other two, though STANDARD was the least broken of the three: its shin
   * ratio was already 0.98 and both its characters passed at idle. The change is
   * what keeps the archetype ladder monotone once STUB and STOUT move, and it buys
   * the run pose the same headroom.
   */
  standard: {
    note: 'Medium torso and limbs — the neutral chibi baseline.',
    headFraction: 0.46,
    legFraction: 0.30,
    torsoFraction: 0.28,
    armFraction: 0.22,
    shoulderFraction: 0.28 * 0.78,
    headMount: 0.86,
    neckFraction: 0.055,
    // `0.96 * legRadiusF / legFraction`. See STUB.
    footClearance: 0.18,
    shoulderWidthF: 0.20,
    stanceWidthF: 0.115,
    armRadiusF: 0.058,
    handRadiusF: 0.075,
    legRadiusF: 0.056,
    torsoWidthF: 0.20 * 1.18,
    torsoWidthRatio: 1.18,
    torsoDepthRatio: 0.88,
  },

  /**
   * LANKY — tall, narrow, light.
   *
   * The head is the smallest in the cast (0.40H against STUB's 0.76H) and that
   * two-to-one head ratio is the single strongest silhouette separator we have.
   * It does not go lower than 0.40 on purpose: at 0.36 both LANKY characters lost
   * their food mass — a burrito you cannot read as a burrito is a worse outcome
   * than a slightly less extreme body.
   *
   * The rest of the separation comes from WIDTH, which costs the food nothing:
   * `shoulderWidthF` 0.145 against STANDARD's 0.20, `armRadiusF` 0.040 against
   * 0.058, `stanceWidthF` 0.062 against 0.115. Narrow stance so the whole figure
   * reads as a vertical line rather than a triangle.
   *
   * **LANKY is the archetype that was already right, and that is the evidence the
   * other three were wrong.** It is the only one whose leg segments were longer
   * than they were thick (shin ratio 1.48 against STOUT's 0.31 and STUB's 0.21),
   * and the only one whose legs read as legs in
   * `preview.html?piece=roster&silhouette=1`. Its hand-picked `footClearance` 0.12
   * is also exactly what the cast-wide rule `0.96 * legRadiusF / legFraction`
   * returns for it — which is why that rule is trustworthy. Only `legFraction`
   * moves here, and only enough to keep LANKY the longest-legged body in the cast.
   */
  lanky: {
    note: 'Tall narrow torso, long thin limbs, narrow stance.',
    headFraction: 0.40,
    legFraction: 0.34,
    torsoFraction: 0.30,
    armFraction: 0.30,
    shoulderFraction: 0.30 * 0.84,
    headMount: 0.86,
    // LANKY takes the biggest gap because the probe says it converts best: a live
    // sweep on burrito moved neckPinch 0.0769 -> 0.2963 on head lift alone, the
    // only archetype where lift ALONE cleared the reference floor.
    neckFraction: 0.065,
    footClearance: 0.125,
    shoulderWidthF: 0.145,
    stanceWidthF: 0.062,
    armRadiusF: 0.040,
    handRadiusF: 0.060,
    legRadiusF: 0.043,
    torsoWidthF: 0.145 * 1.15,
    torsoWidthRatio: 1.15,
    torsoDepthRatio: 0.92,
  },
};

/**
 * Resolve an archetype into concrete `RigProportions`.
 *
 * `tweaks` is applied LAST and wins over everything, so a character can nudge one
 * number without restating the body. `tweaks.height` is honoured before the
 * fractions are resolved, so scaling a character scales its whole body with it.
 *
 * ```ts
 * proportions: bodyType('lanky')                              // straight preset
 * proportions: bodyType('lanky', { height: 2.30 })            // taller, same shape
 * proportions: bodyType('stub', { headFraction: 0.70 })       // smaller food mass
 * proportions: bodyType('stout', { shoulderWidth: 0.60 })     // absolute override
 * ```
 */
export function bodyType(name: BodyArchetypeName, tweaks: RigProportions = {}): RigProportions {
  const a = BODY_ARCHETYPES[name];
  const height = tweaks.height ?? CHARACTER_HEIGHT;
  const shoulderWidth = tweaks.shoulderWidth ?? height * a.shoulderWidthF;
  // Torso width is a fraction of HEIGHT, not a multiple of `shoulderWidth`. See
  // `torsoWidthF` — the coupling meant "move the arm out of the food" also moved
  // the food out after it. `torsoWidthRatio` is the pre-decoupling fallback.
  const torsoWidth = tweaks.torsoWidth
    ?? (a.torsoWidthF ? height * a.torsoWidthF : shoulderWidth * a.torsoWidthRatio);
  return {
    height,
    headFraction: a.headFraction,
    legFraction: a.legFraction,
    torsoFraction: a.torsoFraction,
    armFraction: a.armFraction,
    shoulderFraction: a.shoulderFraction,
    headMount: a.headMount,
    neckFraction: a.neckFraction,
    footClearance: a.footClearance,
    shoulderWidth,
    stanceWidth: height * a.stanceWidthF,
    armRadius: height * a.armRadiusF,
    handRadius: height * a.handRadiusF,
    legRadius: height * a.legRadiusF,
    torsoWidth,
    torsoDepth: torsoWidth * a.torsoDepthRatio,
    ...tweaks,
  };
}

/**
 * Which archetype each character uses. Single source of truth for the roster, so
 * the cohort a character belongs to is answerable without opening eleven files.
 * A character file still calls `bodyType()` itself — this is documentation that
 * cannot drift into a runtime dependency.
 */
export const CHARACTER_ARCHETYPES: Record<string, BodyArchetypeName> = {
  waterbottle: 'stub',
  egg: 'stub',
  lollipop: 'stub',
  donut: 'stub',
  soup: 'stout',
  hamburger: 'stout',
  taco: 'stout',
  pizza: 'standard',
  sushi: 'standard',
  burrito: 'lanky',
  hotdog: 'lanky',
};
