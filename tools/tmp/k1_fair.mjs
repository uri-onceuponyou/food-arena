#!/usr/bin/env node
/**
 * K1_FAIR — the match camera's PITCH (and AIM), priced for fairness. Node only, no GPU.
 *
 * `DECISIONS-FOR-URI.md §91e` parked a pitch experiment *"gated by `aspect.mjs` fairness"*.
 * `aspect.mjs` reads ONE number out of the running game — `__fairView().guaranteedRadiusUnits`,
 * i.e. `camera.ts:groundWindow()` — and checks its SPREAD across viewports. That number is
 * the solve's own CLAIM, so the gate cannot disagree with the solve. This tool asks the real
 * camera instead: it projects ground points through the `THREE.PerspectiveCamera` the rig
 * builds and reads where they land.
 *
 *   §A  the parsers (`camera.ts:qaPitchFromSearch`, `qaAimFromSearch`) — absent, garbage and
 *       out-of-range values are REFUSED (null -> the shipped camera), in-range ones pass.
 *   §B  THE PROOF, at every 0.25° of the accepted band x 33 aspects across `SUPPORTED_ASPECT`:
 *       aim 'centred' — the guaranteed disc AND the fair square project inside NDC [-1,1],
 *       `groundWindow()` agrees with the projection, and the shadow box
 *       (`lighting.ts:MATCH_SHADOW_RADIUS_M`) still holds the farthest visible corner.
 *       aim 'past' (SHIPPED) — PINNED RED: the disc's near side leaves the frame at every
 *       cell. If this ever passes, the shipped aim was fixed and this arm must be re-read.
 *       KNOWN-BAD arms, each REQUIRED to go red (CLAUDE.md rule 6):
 *         KB1  a disc 1% wider than the guarantee         -> must fail (the check is tight)
 *         KB2  the camera 2% closer than the solve        -> must fail (it can see a miss)
 *         KB3  the 58° DISTANCE kept at another pitch     -> must fail somewhere (re-solving
 *              is what holds fairness across a pitch change)
 *   §C  the table at 58/56/54/52/50/48 x five aspects x both aims: distance, binding, the
 *       TRUE reach below / above / beside the player and the TRUE guaranteed radius (largest
 *       disc that projects inside the frame), next to what `groundWindow()` claims; far
 *       corner, shadow headroom, fog onset, where the player sits on screen, px per wu, a
 *       standing fighter's projected height, visible ground area, and how much of the Giant
 *       Lollipop's reach circle is on screen.
 *   §D  every weapon's reach (range + HIT_RADIUS_VS_PLAYER) against BOTH radii, and
 *       `FAIR_PLAY.radiusUnits` against `rules.ts:GUARANTEED_VISIBLE_RADIUS`.
 *   §E  (--base <tree>) BYTE-IDENTITY of the shipped path: every camera matrix the default
 *       rig builds, at every pitch of the band x 33 aspects, Object.is-equal between this
 *       tree's camera.ts and the base tree's — plus the shake-fade radius.
 *
 *   node tools/tmp/k1_fair.mjs [--base /private/tmp/fa-k1-base] [--json out.json]
 *   node tools/tmp/k1_fair.mjs --root <tree>    # measure ANOTHER tree's camera.ts
 *
 * Exit 1 on any fault. READ-ONLY on every tree it reads.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = resolve(arg('--root', resolve(HERE, '../..')));
const BASE = arg('--base') ? resolve(arg('--base')) : null;
const JSON_OUT = arg('--json');
const QUIET = argv.includes('--quiet');

const cam = await import(pathToFileURL(`${ROOT}/src/render/camera.ts`).href);
const rules = await import(pathToFileURL(`${ROOT}/src/game/rules.ts`).href);
const units = await import(pathToFileURL(`${ROOT}/src/units.ts`).href);
const THREE = await import('three');
const { CameraRig, FAIR_PLAY, SUPPORTED_ASPECT } = cam;
const { WORLD_SCALE, CHARACTER_HEIGHT } = units;

let pass = 0; let fail = 0;
const faults = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; if (!QUIET) console.log(`  ok   ${name}`); }
  else { fail++; faults.push(name); console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`); }
}

// ── constants DERIVED from the tree, never retyped ────────────────────────────────────────
function grab(file, re, what) {
  const txt = readFileSync(`${ROOT}/${file}`, 'utf8');
  const m = txt.match(re);
  if (!m) throw new Error(`k1_fair: cannot find ${what} in ${file} — the citation went stale; re-derive it`);
  return m;
}
const SHADOW_BOX_M = Number(grab('src/render/lighting.ts', /export const MATCH_SHADOW_RADIUS_M = (\d+(?:\.\d+)?);/, 'MATCH_SHADOW_RADIUS_M')[1]);
const KEY = grab('src/render/lighting.ts', /export const KEY_OFFSET = new THREE\.Vector3\(([-\d.]+), ([-\d.]+), ([-\d.]+)\)/, 'KEY_OFFSET').slice(1).map(Number);
const KEY_ELEV = Math.atan2(KEY[1], Math.hypot(KEY[0], KEY[2]));
// `lighting.ts`'s own derivation of the box names a 1.7 m tallest caster; kept as ITS number.
const CASTER_REACH_M = 1.7 / Math.tan(KEY_ELEV);
const fogM = grab('src/game/match.ts', /fog: \{ color: 0x[0-9a-fA-F]+, near: (\d+(?:\.\d+)?), far: (\d+(?:\.\d+)?) \}/, "match.ts's Stage fog");
const FOG = { near: Number(fogM[1]), far: Number(fogM[2]) };
const SHIPPED_PITCH = Number(grab('src/game/match.ts',
  /camera: \{ pitchDeg: (?:qaPitchFromSearch\(location\.search\) \?\? )?(\d+(?:\.\d+)?), yawDeg: 0, frameMode: 'fair'/,
  "match.ts's camera literal")[1]);

const R = FAIR_PLAY.radiusUnits;             // world units
const Rm = R * WORLD_SCALE;                   // metres
const NAMED = [
  { name: '4:3', a: 4 / 3 }, { name: '16:10', a: 16 / 10 }, { name: '16:9', a: 16 / 9 },
  { name: '19.5:9', a: 19.5 / 9 }, { name: '21:9', a: 21 / 9 },
];
const BAND = Array.from({ length: 33 }, (_, i) => SUPPORTED_ASPECT.min + (SUPPORTED_ASPECT.max - SUPPORTED_ASPECT.min) * (i / 32));

/** A rig at `pitch`, solved for `aspect`, following a player at the origin. */
function rigAt(mod, pitch, aspect, aim) {
  const opts = { pitchDeg: pitch, yawDeg: 0, frameMode: 'fair' };
  if (aim) opts.aim = aim;
  const rig = new mod.CameraRig(opts);
  rig.setAspect(aspect);
  rig.snapTo(0, 0);
  rig.camera.updateMatrixWorld(true);
  return rig;
}
const v = new THREE.Vector3();
const ndc = (camera, x, y, z) => v.set(x, y, z).project(camera).clone();
const inFrame = (p) => Math.abs(p.x) <= 1 + 1e-9 && Math.abs(p.y) <= 1 + 1e-9;
/** Max |NDC| over a ring of ground points at radius `rM` metres about the player. */
function ringMaxNdc(camera, rM, n = 720) {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const p = ndc(camera, Math.cos(t) * rM, 0, Math.sin(t) * rM);
    m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
  }
  return m;
}
function squareMaxNdc(camera, hM, n = 200) {
  let m = 0;
  for (let i = 0; i <= n; i++) {
    const s = -hM + (2 * hM * i) / n;
    for (const [x, z] of [[s, -hM], [s, hM], [-hM, s], [hM, s]]) {
      const p = ndc(camera, x, 0, z);
      m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
    }
  }
  return m;
}
/** Ground distance (wu) from the player to the frame edge along bearing (dx, dz). */
function reachAlong(camera, dx, dz) {
  let lo = 0; let hi = 4000 * WORLD_SCALE;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (inFrame(ndc(camera, dx * mid, 0, dz * mid))) lo = mid; else hi = mid;
  }
  return lo / WORLD_SCALE;
}
/** The TRUE guaranteed radius: the largest disc about the player that projects in-frame. */
function trueGuaranteed(camera) {
  let lo = 0; let hi = 1000 * WORLD_SCALE;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (ringMaxNdc(camera, mid, 360) <= 1 + 1e-9) lo = mid; else hi = mid;
  }
  return lo / WORLD_SCALE;
}
/** The visible ground quad: the four frame corners raycast onto y = 0. Metres, player at 0. */
function groundCorners(camera) {
  const out = [];
  const o = camera.position.clone();
  for (const [x, y] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    const d = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(o).normalize();
    out.push(d.y >= -1e-9 ? null : o.clone().addScaledVector(d, -o.y / d.y));
  }
  return out;
}
const polyArea = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i]; const b = pts[(i + 1) % pts.length]; s += a.x * b.z - b.x * a.z; }
  return Math.abs(s) / 2;
};

console.log(`\nk1_fair — tree ${ROOT}${BASE ? `  ·  base ${BASE}` : ''}`);
console.log(`  R = FAIR_PLAY.radiusUnits = ${R.toFixed(2)} wu (${Rm.toFixed(3)} m) · shipped match pitch (match.ts literal) = ${SHIPPED_PITCH}°`);
console.log(`  shadow box ${SHADOW_BOX_M} m · key elevation ${(KEY_ELEV * 180 / Math.PI).toFixed(1)}° -> caster reach ${CASTER_REACH_M.toFixed(2)} m · fog ${FOG.near}-${FOG.far} m\n`);

// ═════════════════════════════════════════════════════════════════════════════
// §A — the parsers
// ═════════════════════════════════════════════════════════════════════════════
console.log('§A — `?camPitch=` / `?camAim=` parsers');
const QA = cam.QA_CAMERA;
const parseP = cam.qaPitchFromSearch;
const parseA = cam.qaAimFromSearch;
check('camera.ts exports QA_CAMERA, qaPitchFromSearch and qaAimFromSearch',
  !!QA && typeof parseP === 'function' && typeof parseA === 'function',
  `QA_CAMERA ${JSON.stringify(QA)} · qaPitchFromSearch ${typeof parseP} · qaAimFromSearch ${typeof parseA}`);
let MIN = 47; let MAX = 70;
if (QA && typeof parseP === 'function' && typeof parseA === 'function') {
  MIN = QA.minPitchDeg; MAX = QA.maxPitchDeg;
  check(`the accepted band ${MIN}-${MAX}° contains the shipped ${SHIPPED_PITCH}°`,
    Number.isFinite(MIN) && Number.isFinite(MAX) && MIN < SHIPPED_PITCH && SHIPPED_PITCH < MAX);
  const P = QA.pitchParam;
  const cases = [
    ['', null], ['?', null], [`?${P}=`, null], [`?${P}=%20`, null], [`?${P}=abc`, null],
    [`?${P}=NaN`, null], [`?${P}=Infinity`, null], [`?${P}=1e400`, null],
    [`?${P}=${MIN - 0.01}`, null], [`?${P}=${MAX + 0.01}`, null], [`?${P}=10`, null], [`?${P}=-50`, null],
    [`?${P.toLowerCase()}=50`, null], ['?pitch=50', null],
    [`?${P}=${MIN}`, MIN], [`?${P}=${MAX}`, MAX], [`?${P}=50`, 50], [`?${P}=58`, 58],
    [`?${P}=48.5`, 48.5], [`?player=donut&${P}=54&enemy=taco`, 54], [`?${P}=50&${P}=60`, 50],
  ];
  for (const [s, want] of cases) check(`qaPitchFromSearch(${JSON.stringify(s)}) -> ${want}`, Object.is(parseP(s), want), `got ${parseP(s)}`);
  const A = QA.aimParam;
  const acases = [['', null], [`?${A}=`, null], [`?${A}=past`, null], [`?${A}=Centred`, null], [`?${A}=centered`, null],
    [`?${A}=centred`, 'centred'], [`?screen=match&${A}=centred&seats=6`, 'centred']];
  for (const [s, want] of acases) check(`qaAimFromSearch(${JSON.stringify(s)}) -> ${want}`, Object.is(parseA(s), want), `got ${parseA(s)}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// §B — the proof, through the real camera, both aims
// ═════════════════════════════════════════════════════════════════════════════
const pitches = [];
for (let p = MIN; p <= MAX + 1e-9; p += 0.25) pitches.push(+p.toFixed(2));
console.log(`\n§B — the guaranteed disc and square, projected, at every 0.25° in [${MIN}, ${MAX}] (${pitches.length}) x ${BAND.length} aspects`);
check('the sweep is non-empty and includes the shipped pitch', pitches.length > 10 && pitches.includes(SHIPPED_PITCH), `${pitches.length} pitches`);
const proof = {};
for (const aim of ['centred', 'past']) {
  let worstDisc = { m: 0 }; let worstSq = { m: 0 }; let worstGuar = { d: 0 }; let worstShadow = { head: Infinity };
  let worstNearPast = { near: Infinity };
  let kb1 = 0; let kb2 = 0; let kb3 = 0; let kb3n = 0; let cells = 0; let discFailCells = 0;
  const dist58 = new Map(BAND.map((a) => [a, rigAt(cam, 58, a, aim).groundWindow().distanceM]));
  for (const p of pitches) {
    let c1 = false; let c2f = false; let c3 = false;
    for (const a of BAND) {
      cells++;
      const rig = rigAt(cam, p, a, aim);
      const c = rig.camera;
      const md = ringMaxNdc(c, Rm);
      const ms = squareMaxNdc(c, Rm);
      if (md > 1 + 1e-9) discFailCells++;
      if (md > worstDisc.m) worstDisc = { m: md, p, a };
      if (ms > worstSq.m) worstSq = { m: ms, p, a };
      const gw = rig.groundWindow();
      const dg = Math.abs(gw.guaranteedRadiusUnits - R);
      if (dg > worstGuar.d) worstGuar = { d: dg, p, a, g: gw.guaranteedRadiusUnits };
      const corners = groundCorners(c);
      const far = corners.every(Boolean) ? Math.max(...corners.map((q) => Math.hypot(q.x, q.z))) : Infinity;
      const head = SHADOW_BOX_M - (far + CASTER_REACH_M);
      if (head < worstShadow.head) worstShadow = { head, p, a, far };
      if (aim === 'past') {
        const nr = reachAlong(c, 0, 1);
        if (nr < worstNearPast.near) worstNearPast = { near: nr, p, a };
        continue; // the known-bad arms only mean something on a rig that passes
      }
      if (ringMaxNdc(c, Rm * 1.01, 360) > 1 + 1e-9) c1 = true;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
      const cc = c.clone(); cc.position.addScaledVector(fwd, gw.distanceM * 0.02); cc.updateMatrixWorld(true);
      if (ringMaxNdc(cc, Rm, 360) > 1 + 1e-9) c2f = true;
      if (Math.abs(p - 58) > 0.5) {
        const aimPt = c.position.clone().addScaledVector(fwd, gw.distanceM);
        const c3c = c.clone(); c3c.position.copy(aimPt).addScaledVector(fwd, -dist58.get(a)); c3c.updateMatrixWorld(true);
        if (ringMaxNdc(c3c, Rm, 360) > 1 + 1e-9) c3 = true;
      }
    }
    if (c1) kb1++;
    if (c2f) kb2++;
    if (Math.abs(p - 58) > 0.5) { kb3n++; if (c3) kb3++; }
  }
  const fa = (x) => (x === undefined ? '-' : x.toFixed(3));
  proof[aim] = { cells, discFailCells, worstDisc, worstSq, worstGuar, worstShadow, worstNearPast, kb1, kb2, kb3, kb3n };
  console.log(`  — aim '${aim}'${aim === 'past' ? ' (SHIPPED)' : ' (QA)'}`);
  check(`[${aim}] groundWindow().guaranteedRadiusUnits reads ${R.toFixed(1)} at every cell (worst |Δ| ${worstGuar.d.toExponential(2)})`,
    worstGuar.d < 1e-6, JSON.stringify(worstGuar));
  check(`[${aim}] the shadow box still holds the farthest visible corner + caster reach at every cell (min headroom ${worstShadow.head.toFixed(2)} m)`,
    worstShadow.head >= 0, `worst at pitch ${worstShadow.p} aspect ${fa(worstShadow.a)}: corner ${worstShadow.far?.toFixed(2)} m + ${CASTER_REACH_M.toFixed(2)} m vs ${SHADOW_BOX_M} m`);
  if (aim === 'centred') {
    check(`[centred] the guaranteed DISC projects inside the frame at all ${cells} cells (max |NDC| ${worstDisc.m.toFixed(6)})`,
      worstDisc.m <= 1 + 1e-9, `worst at pitch ${worstDisc.p} aspect ${fa(worstDisc.a)}`);
    check(`[centred] the fair SQUARE (the construction camera.ts states) projects inside at all cells (max |NDC| ${worstSq.m.toFixed(6)})`,
      worstSq.m <= 1 + 1e-9, `worst at pitch ${worstSq.p} aspect ${fa(worstSq.a)}`);
    check(`[centred] KB1 (disc 1% too wide) is CAUGHT at every pitch (${kb1}/${pitches.length}) — tight, not vacuous`, kb1 === pitches.length);
    check(`[centred] KB2 (camera 2% too close) is CAUGHT at every pitch (${kb2}/${pitches.length})`, kb2 === pitches.length);
    check(`[centred] KB3 (the 58° distance kept at another pitch) is caught for ${kb3}/${kb3n} off-58 pitches`, kb3n > 0 && kb3 > 0);
  } else {
    check(`[past] PINNED RED — the guaranteed disc leaves the frame at ${discFailCells}/${cells} cells (max |NDC| ${worstDisc.m.toFixed(3)}); `
      + `true reach BELOW the player is as short as ${worstNearPast.near.toFixed(1)} wu (pitch ${worstNearPast.p}, aspect ${fa(worstNearPast.a)})`,
      discFailCells === cells, `${discFailCells}/${cells} — if this is no longer every cell, the shipped aim changed: re-read this arm`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// §D — weapons against the guaranteed radius
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n§D — every weapon\'s reach vs the guaranteed radius');
const HIT = rules.HIT_RADIUS_VS_PLAYER;
const weapons = [];
for (const [id, def] of Object.entries(rules.CHARACTERS)) {
  for (const w of def.weapons) {
    if (w.range === undefined) continue;
    weapons.push({ id, key: w.key, name: w.name, type: w.type, range: w.range, reach: w.range + HIT, giantSlam: !!w.giantSlam });
  }
}
const normal = weapons.filter((w) => !w.giantSlam);
check('the weapon table is non-empty', normal.length > 0, String(normal.length));
const maxReach = Math.max(...normal.map((w) => w.reach));
check(`every non-ultimate weapon's reach is inside FAIR_PLAY's R (${normal.length} weapons, max ${maxReach.toFixed(1)} wu vs ${R.toFixed(1)})`,
  normal.every((w) => w.reach <= R + 1e-9), JSON.stringify(normal.filter((w) => w.reach > R)));
check(`FAIR_PLAY.radiusUnits (camera.ts) == GUARANTEED_VISIBLE_RADIUS (rules.ts) — ${R.toFixed(3)} vs ${rules.GUARANTEED_VISIBLE_RADIUS.toFixed(3)}`,
  Math.abs(R - rules.GUARANTEED_VISIBLE_RADIUS) < 1e-9);
const slams = weapons.filter((w) => w.giantSlam);
const SLAM_R = slams[0]?.reach ?? 0;

// ═════════════════════════════════════════════════════════════════════════════
// §C — the table (TRUE reach by projection, beside the solve's claim)
// ═════════════════════════════════════════════════════════════════════════════
const TABLE_PITCHES = [58, 56, 54, 52, 50, 48].filter((p) => p >= MIN && p <= MAX);
const H_PX = 900;
const table = [];
for (const aim of ['past', 'centred']) {
  for (const p of TABLE_PITCHES) {
    for (const { name, a } of NAMED) {
      const rig = rigAt(cam, p, a, aim);
      const c = rig.camera;
      const gw = rig.groundWindow();
      const corners = groundCorners(c);
      const farCorner = Math.max(...corners.map((q) => Math.hypot(q.x, q.z))) / WORLD_SCALE;
      const camToGround = Math.max(...corners.map((q) => q.distanceTo(c.position)));
      const pl = ndc(c, 0, 0, 0);
      const head = ndc(c, 0, CHARACTER_HEIGHT, 0);
      const W_PX = H_PX * a;
      const dx = ndc(c, WORLD_SCALE, 0, 0);
      const dz = ndc(c, 0, 0, -WORLD_SCALE);
      let slamOn = 0; const N = 720;
      for (let i = 0; i < N && SLAM_R > 0; i++) {
        const t = (i / N) * Math.PI * 2;
        if (inFrame(ndc(c, Math.cos(t) * SLAM_R * WORLD_SCALE, 0, Math.sin(t) * SLAM_R * WORLD_SCALE))) slamOn++;
      }
      const tg = trueGuaranteed(c);
      table.push({
        aim, pitch: p, aspect: name, distanceM: +gw.distanceM.toFixed(3), heightM: +c.position.y.toFixed(3), binding: gw.binding,
        claimedNearWu: +gw.nearUnits.toFixed(1), claimedFarWu: +gw.farUnits.toFixed(1), claimedGuaranteedWu: +gw.guaranteedRadiusUnits.toFixed(1),
        trueBelowWu: +reachAlong(c, 0, 1).toFixed(1), trueAboveWu: +reachAlong(c, 0, -1).toFixed(1), trueSideWu: +reachAlong(c, 1, 0).toFixed(1),
        trueGuaranteedWu: +tg.toFixed(1), weaponsOutsideTrue: normal.filter((w) => w.reach > tg + 1e-9).length,
        farCornerWu: +farCorner.toFixed(1), shadowHeadroomM: +(SHADOW_BOX_M - (farCorner * WORLD_SCALE + CASTER_REACH_M)).toFixed(2),
        maxCamToGroundM: +camToGround.toFixed(2), fogAtFarthest: +Math.min(1, Math.max(0, (camToGround - FOG.near) / (FOG.far - FOG.near))).toFixed(3),
        visibleGroundKwu2: +(polyArea(corners) / (WORLD_SCALE * WORLD_SCALE) / 1000).toFixed(1),
        playerScreenYFromTop: +((1 - pl.y) / 2).toFixed(3),
        fighterHeightPx900: +(Math.abs(head.y - pl.y) / 2 * H_PX).toFixed(1),
        pxPerWuX: +(Math.abs(dx.x - pl.x) / 2 * W_PX).toFixed(3), pxPerWuDepth: +(Math.abs(dz.y - pl.y) / 2 * H_PX).toFixed(3),
        slamCircleOnScreen: +(slamOn / N).toFixed(3),
      });
    }
  }
}
// The shipped cell must reproduce np_nfighter's red row: a seat 143 wu SOUTH of the observer
// was hidden at 1280x720 (16:9) on 1ca23ad. That is only possible if the true reach below is < 143.
const shipped169 = table.find((r) => r.aim === 'past' && r.pitch === SHIPPED_PITCH && r.aspect === '16:9');
check(`the shipped 16:9 cell explains np_nfighter's hidden seat (143 wu below the observer): true reach below ${shipped169?.trueBelowWu} wu < 143`,
  !!shipped169 && shipped169.trueBelowWu < 143, JSON.stringify(shipped169));
if (!QUIET) {
  console.log(`\n§C — the table (player at the follow target; ${H_PX}px tall frame; standing subject ${CHARACTER_HEIGHT} m; slam circle r=${SLAM_R.toFixed(1)} wu)`);
  console.log('aim     pitch aspect  dist_m bind  | claim guar | TRUE below above  side  guar  wpnOut | farCorner shadowHd fog%  groundKwu2 plY   figPx px/wu(x,z)  slam%');
  for (const r of table) {
    console.log(`${r.aim.padEnd(7)} ${String(r.pitch).padStart(5)} ${r.aspect.padEnd(7)} ${r.distanceM.toFixed(2).padStart(6)} ${r.binding.padEnd(5)} | ${r.claimedGuaranteedWu.toFixed(1).padStart(10)} | ${r.trueBelowWu.toFixed(0).padStart(10)} ${r.trueAboveWu.toFixed(0).padStart(5)} ${r.trueSideWu.toFixed(0).padStart(5)} ${r.trueGuaranteedWu.toFixed(1).padStart(5)} ${String(r.weaponsOutsideTrue).padStart(6)}  | ${r.farCornerWu.toFixed(0).padStart(9)} ${r.shadowHeadroomM.toFixed(2).padStart(8)} ${(r.fogAtFarthest * 100).toFixed(1).padStart(5)} ${r.visibleGroundKwu2.toFixed(0).padStart(10)} ${r.playerScreenYFromTop.toFixed(3)} ${r.fighterHeightPx900.toFixed(1).padStart(5)} ${r.pxPerWuX.toFixed(2)},${r.pxPerWuDepth.toFixed(2)} ${(r.slamCircleOnScreen * 100).toFixed(0).padStart(5)}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// §E — byte-identity of the shipped path against a base tree
// ═════════════════════════════════════════════════════════════════════════════
let identity = null;
if (BASE) {
  console.log(`\n§E — the DEFAULT rig (no aim option) vs ${BASE}`);
  if (!existsSync(`${BASE}/src/render/camera.ts`)) throw new Error(`k1_fair: no camera.ts under --base ${BASE}`);
  const baseCam = await import(pathToFileURL(`${BASE}/src/render/camera.ts`).href);
  let compared = 0; let differ = 0; let firstDiff = null;
  const elems = (r) => [...r.camera.matrixWorld.elements, ...r.camera.projectionMatrix.elements, ...r.camera.matrixWorldInverse.elements,
    r.groundWindow().guaranteedRadiusUnits, r.groundWindow().nearUnits, r.groundWindow().farUnits, r.groundWindow().halfWidthAtFairEdgeUnits,
    r.shakeFadeRadiusUnits()];
  for (const p of pitches) {
    for (const a of BAND) {
      const x = elems(rigAt(cam, p, a, null));
      const y = elems(rigAt(baseCam, p, a, null));
      compared++;
      if (x.length !== y.length || x.some((e, i) => !Object.is(e, y[i]))) {
        differ++;
        if (!firstDiff) firstDiff = { p, a, i: x.findIndex((e, i) => !Object.is(e, y[i])) };
      }
    }
  }
  // KNOWN-BAD: the same comparison against the CENTRED rig must differ — otherwise the
  // comparison cannot see a camera change at all.
  let kbDiffer = 0;
  for (const a of BAND) {
    const x = elems(rigAt(cam, 58, a, 'centred'));
    const y = elems(rigAt(baseCam, 58, a, null));
    if (x.some((e, i) => !Object.is(e, y[i]))) kbDiffer++;
  }
  identity = { compared, differ, firstDiff, kbDiffer };
  check(`the default rig is Object.is-identical to the base tree's at all ${compared} pitch x aspect cells (matrices, groundWindow, shake fade)`,
    compared > 0 && differ === 0, JSON.stringify(firstDiff));
  check(`KNOWN-BAD: the 'centred' rig differs from the base at ${kbDiffer}/${BAND.length} aspects (the comparison can see a camera change)`,
    kbDiffer === BAND.length);
}

if (JSON_OUT) {
  writeFileSync(resolve(JSON_OUT), JSON.stringify({
    tree: ROOT, base: BASE, at: new Date().toISOString(), R, shippedPitch: SHIPPED_PITCH, accepted: { min: MIN, max: MAX },
    proof, identity, weapons, table, faults,
  }, null, 1));
  console.log(`\nwrote ${JSON_OUT}`);
}
console.log(`\n${pass} passed, ${fail} failed${fail ? ` — ${faults.join(' | ')}` : ''}\n`);
process.exit(fail ? 1 : 0);
