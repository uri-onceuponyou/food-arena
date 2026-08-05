/**
 * Where each named part lives on the reference plate, as fractions of the MATTED
 * SUBJECT's bounding box (`[x0, y0, x1, y1]`, origin at the subject box's
 * top-left, x right, y down).
 *
 * There is no rig to read on a screenshot, so these boxes are the one place in
 * this programme where a human eye is load-bearing. They are kept as data, with
 * the plate and the reasoning next to them, so they can be argued with instead of
 * being buried inside a tool. They were read off a 10%-grid overlay of the matted
 * figure (`pp_ref.mjs --dump-matte` then a grid render), not estimated.
 *
 * PLATE: `reference/images/curated/character_fullbody/bs_05.png` (1120x1870) —
 * ONE plate for every part, deliberately. Mixed-camera draws invalidated four
 * rounds on this project, and this set's crops differ in pose, focal length and
 * key direction from each other. bs_05 is the only plate in the set where all
 * parts are present AND unoccluded: full body head-to-boots, one hand completely
 * clear of the body, both legs and both boots in frame, a held prop, and a face
 * at ~320 px of plate height.
 *
 * ⚠️ WHY THESE ARE BOXES AND NOT MATTES OF THE PART ITSELF. A reference plate
 * cannot be ablated — hiding a mesh is not an operation a screenshot supports. So
 * the ONE treatment both sides can receive identically is: crop tight to the
 * part, and replace everything outside the CHARACTER's silhouette with the shared
 * field. Our side does exactly the same (`pp_ours.mjs`'s `paired` panel). The
 * geometric isolation our renderer can also do is kept as a diagnostic and is
 * never paired against a reference, because a pair of "our arm alone" against
 * "their arm plus torso plus cape" measures the ablation, not the art.
 */
export default {
  'silhouette-whole': {
    whole: true, binary: true, kind: 'standalone',
    note: 'shape only; colour, lighting and material removed by construction on BOTH sides, so polarity is not applicable',
  },
  'figure-whole': { whole: true, kind: 'standalone', note: 'the control panel the per-part panels are supposed to beat' },

  head: { box: [0.20, 0.00, 0.97, 0.40], kind: 'standalone', note: 'hair mass + crown + face down to the chin' },
  crown: {
    box: [0.20, 0.00, 0.97, 0.20], kind: 'standalone',
    note: 'the top-of-head mass above the eyes. Hamburger\'s is a seeded bun dome; this is a hair mass plus a gold crown — STRUCTURALLY DIFFERENT ELEMENTS in the same compositional role. Declared, not hidden.',
  },

  'face-overall': { box: [0.41, 0.13, 0.85, 0.38], kind: 'inset' },
  eyes: { box: [0.43, 0.15, 0.81, 0.32], kind: 'inset' },
  mouth: { box: [0.47, 0.27, 0.71, 0.37], kind: 'inset' },

  torso: { box: [0.25, 0.37, 0.83, 0.68], kind: 'standalone' },
  decoration: {
    box: [0.25, 0.36, 0.83, 0.58], kind: 'inset',
    note: 'the candy-studded collar and gold bow — the costume element worn on the torso, the role hamburger\'s apron plays',
  },

  arms: { box: [0.02, 0.34, 0.98, 0.67], kind: 'standalone', note: 'both sleeves; the torso between them is in frame on OUR side too' },
  hands: { box: [0.66, 0.46, 1.00, 0.70], kind: 'standalone', note: 'the free hand. The other grips the cannon, exactly as our handR grips the spatula, so both sides use the unencumbered hand' },
  legs: { box: [0.24, 0.62, 0.80, 0.92], kind: 'standalone' },
  feet: { box: [0.26, 0.86, 0.82, 1.00], kind: 'standalone' },
  prop: { box: [0.00, 0.24, 0.42, 0.44], kind: 'standalone', note: 'the shoulder cannon, against our spatula: both are the character\'s one held silhouette landmark' },

  // NOSE — dropped, and it is dropped on BOTH sides. Hamburger has no nose mesh
  // (`src/characters/hamburger.ts` builds eye, brow, blush and mouth on
  // `joints.face`, and nothing else), and the Brawl Stars chibi face has no
  // modelled nose either — the reference's own INDEX.md calls out "minimal nose"
  // as a house style. A part that does not exist is a mis-specification, not a
  // finding.
  nose: { valid: false, why: 'no nose exists on either side: hamburger builds eye/brow/blush/mouth only, and the reference chibi face has no modelled nose (the curated INDEX calls the house style "minimal nose")' },

  // EARS — dropped for the same reason, on both sides. The brief asked for
  // "ears-or-crown"; hamburger has no ears and neither does this reference
  // (hair covers the head entirely), so the part resolves to `crown` above.
  ears: { valid: false, why: 'neither side models ears; the brief\'s "ears-or-crown" resolves to `crown`' },
};
