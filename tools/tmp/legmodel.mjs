#!/usr/bin/env node
/**
 * THROWAWAY offline model of the rig's LEG geometry — no browser, no render.
 *
 * Round 1 left the legs open and named the camera-projection argument for why
 * tuning could not close them. Measuring `shots/probe/limb/final.json` shows a
 * second, larger cause that is pure geometry and needs no camera at all:
 *
 *   `kneeL` delivers EXACTLY 0.000 of its own footprint at run on nine of eleven
 *   characters — and on donut its screen overlap with the FOOD MASS is 0.001.
 *   Nothing about the food is hiding it. The shin is inside the thigh and the boot.
 *
 * Why: `ChibiRig` builds each limb segment as a capsule of length `len` and radius
 * `r`, and `THREE.CapsuleGeometry(r, max(0.001, len - 2r))` degenerates to a SPHERE
 * whenever `len < 2r`. Every character's own `dressLimbs` builder inherits the same
 * `len`/`radius` pair, so the same degeneracy reaches every bespoke leg.
 *
 * This prints, per character, the two ratios that decide whether a leg is a leg:
 *   shinAR  = shinLength  / (2 * shinRadius)
 *   thighAR = thighLength / (2 * thighRadius)
 * and `bootCov`, the share of the shin's length swallowed by the boot above the
 * ankle. Run `--pass` to see the ranking against the measured pass/fail table.
 */
const H = 2.1;

/** thigh share of the bone length, and shin-radius factor — both live in rig.ts. */
const SPLIT = Number(process.env.SPLIT ?? 0.605);
const SHIN_R = 0.9;
/** foot slot `len` multiple of legRadius — rig.ts limbSlots(). */
const FOOT_K = Number(process.env.FOOT_K ?? 2.3);

const ARCH = {
  stub: { lf: 0.15, fc: 0.52, lrf: 0.075 },
  stout: { lf: 0.25, fc: 0.44, lrf: 0.098 },
  standard: { lf: 0.26, fc: 0.14, lrf: 0.062 },
  lanky: { lf: 0.33, fc: 0.12, lrf: 0.043 },
};

/** Per-character: archetype, own height, and any explicit override. */
const CHARS = [
  ['hamburger', 'stout', 2.05, {}],
  ['donut', 'stub', 2.10, { lf: 0.20 }],
  ['taco', 'stout', 2.10, {}],
  ['burrito', 'lanky', 2.05, {}],
  ['egg', 'stub', 2.02, {}],
  ['lollipop', 'stub', 2.00, {}],
  ['pizza', 'standard', 2.10, { legRadius: H * 0.050 }],
  ['sushi', 'standard', 2.10, { lf: 0.29, legRadius: H * 0.078 }],
  ['soup', 'stout', 2.10, {}],
  ['waterbottle', 'stub', 2.10, {}],
  ['hotdog', 'lanky', 2.16, {}],
];

/** Measured, from shots/probe/limb/final.json — the thing the model has to explain. */
const MEASURED = {
  hamburger: 'FAIL', donut: 'FAIL', taco: 'FAIL', burrito: 'pass-idle', egg: 'FAIL',
  lollipop: 'FAIL', pizza: 'pass-idle', sushi: 'pass-idle', soup: 'FAIL',
  waterbottle: 'FAIL', hotdog: 'pass-idle',
};

const rows = [];
for (const [id, arch, h, ov] of CHARS) {
  const a = ARCH[arch];
  const lf = ov.lf ?? a.lf;
  const fc = ov.fc ?? a.fc;
  const legRadius = ov.legRadius ?? h * (ov.lrf ?? a.lrf);
  const legH = h * lf;
  const ankleY = legH * fc;
  const bone = legH - ankleY;
  const thigh = bone * SPLIT;
  const shin = bone - thigh;
  const shinR = legRadius * SHIN_R;
  const fw = legRadius * FOOT_K;
  // Both boot styles in the cast seat their underside on the floor; their TOP is
  // `min(0.86fw, ankleY + 0.22fw)` above it (soup/hotdog/pizza `buildWorkBoot`) or
  // `max(-ankleY + 0.72fw, 0.18fw)` (rig default). Take the workBoot form — it is
  // the one round 1 already had to squash to stop it eating soup's shins.
  const bootTop = Math.min(0.86 * fw, ankleY + 0.22 * fw) - ankleY;
  rows.push({
    id, arch,
    legLen: +legH.toFixed(3), thigh: +thigh.toFixed(3), shin: +shin.toFixed(3),
    legR: +legRadius.toFixed(3), fw: +fw.toFixed(3),
    thighAR: +(thigh / (2 * legRadius)).toFixed(2),
    shinAR: +(shin / (2 * shinR)).toFixed(2),
    bootCov: +(bootTop / shin).toFixed(2),
    measured: MEASURED[id],
  });
}
rows.sort((p, q) => p.shinAR - q.shinAR);
console.log(`SPLIT=${SPLIT} FOOT_K=${FOOT_K}`);
console.log('id           arch      legLen thigh  shin   legR   fw     thighAR shinAR bootCov  measured');
for (const r of rows) {
  console.log(
    r.id.padEnd(13) + r.arch.padEnd(10) +
    String(r.legLen).padEnd(7) + String(r.thigh).padEnd(7) + String(r.shin).padEnd(7) +
    String(r.legR).padEnd(7) + String(r.fw).padEnd(7) +
    String(r.thighAR).padStart(6) + String(r.shinAR).padStart(7) + String(r.bootCov).padStart(8) +
    '  ' + r.measured
  );
}
