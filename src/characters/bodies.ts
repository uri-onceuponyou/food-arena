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
 * | `headFraction`  | 0.76 | 0.50  | 0.46     | 0.40  |
 * | `torsoFraction` | 0    | 0.24  | 0.28     | 0.30  |
 * | `legFraction`   | 0.15 | 0.25  | 0.26     | 0.33  |
 * | `armFraction`   | 0.13 | 0.175 | 0.22     | 0.30  |
 * | torso width     | —    | 0.39  | 0.24     | 0.17  |
 * | `shoulderWidth` | 0.32 | 0.25  | 0.20     | 0.145 |
 * | `stanceWidth`   | 0.16 | 0.155 | 0.115    | 0.062 |
 * | `armRadius`     | .062 | 0.085 | 0.058    | 0.040 |
 * | `legRadius`     | .075 | 0.098 | 0.062    | 0.043 |
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
  readonly footClearance: number;
  readonly shoulderWidthF: number;
  readonly stanceWidthF: number;
  readonly armRadiusF: number;
  readonly handRadiusF: number;
  readonly legRadiusF: number;
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
   * the ankles. 0.12 puts the shoulder pivot about a fifth of the way up the head
   * mass.
   *
   * **`shoulderWidth` almost always needs a per-character tweak on STUB, and that
   * is expected rather than a failure of the preset.** With no torso, the arms
   * have to clear the FOOD, and food shapes are not interchangeable: a bottle is
   * 0.58R wide at shoulder height, an egg is 0.96R, a lollipop is a 0.19R stick.
   * One number cannot serve all three. 0.32H is the middle of that range (about
   * 0.84R at the default head size) — start there, render, and move it until the
   * upper arm is neither buried in the mass nor floating clear of it. This is the
   * single most common thing to get wrong on this archetype.
   */
  stub: {
    note: 'No torso — head on the hips, very short thick limbs, wide stance.',
    headFraction: 0.76,
    legFraction: 0.15,
    torsoFraction: 0,
    armFraction: 0.13,
    shoulderFraction: 0.12,
    headMount: 0.95,
    // Very short, very thick legs: at the stock 0.14 the feet — which are sized
    // off `legRadius`, not off leg length — go straight through the floor. Nearly
    // half the leg is ankle here, which is exactly the "no legs, just feet" read.
    footClearance: 0.52,
    shoulderWidthF: 0.32,
    stanceWidthF: 0.16,
    armRadiusF: 0.062,
    handRadiusF: 0.078,
    legRadiusF: 0.075,
    // Unused (no torso) but kept sane so a character that flips to another
    // archetype for a round doesn't inherit nonsense.
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
   */
  stout: {
    note: 'Short wide torso, thick short limbs, low centre of mass.',
    headFraction: 0.50,
    legFraction: 0.25,
    torsoFraction: 0.24,
    armFraction: 0.175,
    shoulderFraction: 0.24 * 0.80,
    headMount: 0.88,
    // Thick legs mean big feet (the foot mesh is sized off `legRadius`), so the
    // ankle has to sit high or the feet go through the floor. 0.44 keeps the
    // lowest point within ~0.2m of y=0 across all three STOUT characters.
    footClearance: 0.44,
    shoulderWidthF: 0.25,
    stanceWidthF: 0.155,
    armRadiusF: 0.085,
    handRadiusF: 0.095,
    legRadiusF: 0.098,
    torsoWidthRatio: 1.55,
    torsoDepthRatio: 0.88,
  },

  /**
   * STANDARD — the neutral baseline, and numerically identical to the rig's own
   * pre-archetype defaults. Kept unchanged on purpose: with four archetypes in
   * play something has to be the middle, and a middle that also happens to be the
   * historical default makes every other archetype a legible delta from it.
   */
  standard: {
    note: 'Medium torso and limbs — the neutral chibi baseline.',
    headFraction: 0.46,
    legFraction: 0.26,
    torsoFraction: 0.28,
    armFraction: 0.22,
    shoulderFraction: 0.28 * 0.78,
    headMount: 0.86,
    footClearance: 0.14,
    shoulderWidthF: 0.20,
    stanceWidthF: 0.115,
    armRadiusF: 0.058,
    handRadiusF: 0.075,
    legRadiusF: 0.062,
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
   */
  lanky: {
    note: 'Tall narrow torso, long thin limbs, narrow stance.',
    headFraction: 0.40,
    legFraction: 0.33,
    torsoFraction: 0.30,
    armFraction: 0.30,
    shoulderFraction: 0.30 * 0.84,
    headMount: 0.86,
    footClearance: 0.12,
    shoulderWidthF: 0.145,
    stanceWidthF: 0.062,
    armRadiusF: 0.040,
    handRadiusF: 0.060,
    legRadiusF: 0.043,
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
  const torsoWidth = tweaks.torsoWidth ?? shoulderWidth * a.torsoWidthRatio;
  return {
    height,
    headFraction: a.headFraction,
    legFraction: a.legFraction,
    torsoFraction: a.torsoFraction,
    armFraction: a.armFraction,
    shoulderFraction: a.shoulderFraction,
    headMount: a.headMount,
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
