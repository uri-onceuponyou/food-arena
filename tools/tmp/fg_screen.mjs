/**
 * fg_screen — the same defect in the unit a human perceives: PIXELS between the
 * character and the visible edge of the danger field, at the instant the HP starts
 * dropping.
 *
 * The player is placed EXACTLY on `safeRadius`, which is the first frame `sim.ts` bills
 * them 15 HP. Every point below is a REAL vertex of the shipped meshes (or the shipped
 * character height), pushed through the shipped `CameraRig`'s own projection matrix —
 * no ground-plane round trip, so this is literally where the pixels land.
 *
 * Controls, same discipline as fg_reg: the `exact` arm is what a correctly registered
 * canopy prints, and every gap must go to ~0 there.
 */
import { loadShipped } from './fg_lib.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };

const S = await loadShipped();
const { THREE } = S;
const M = S.WORLD_SCALE;
const W = Number(flag('w', '1280')), H = Number(flag('h', '720'));
const ASPECT = W / H;

const ARCS = { NEAR: [0, 1], FAR: [0, -1], SIDE: [1, 0] };

function run(radiusWU, arcName, arm) {
  const [dx, dz] = ARCS[arcName];
  const rig = new S.CameraRig({ pitchDeg: 58, yawDeg: 0, frameMode: 'fair' });
  rig.setAspect(ASPECT);
  const pWU = { x: S.CENTER.x + dx * radiusWU, y: S.CENTER.y + dz * radiusWU };
  rig.snapTo(pWU.x * M, pWU.y * M);
  rig.camera.updateMatrixWorld(true);
  const C = rig.camera.position.clone();

  const fog = S.createFogRing(S.CENTER);
  fog.update(radiusWU, 12.0, true, rig);
  const named = {};
  fog.root.traverse((o) => { if (o.isMesh) named[o.name] = o; });
  const canopy = named['fog_canopy__no_outline'];
  const crest = named['fog_edge__no_outline'];
  const wall = named['fog_curtain__no_outline'];
  const h = canopy.position.y;
  if (arm === 'exact') {
    const k = (C.y - h) / C.y;
    const O = new THREE.Vector2(S.CENTER.x * M, S.CENTER.y * M);
    canopy.position.set((1 - k) * (C.x - O.x), h, (1 - k) * (C.z - O.y));
    canopy.scale.set(k, 1, k);
  } else if (arm === 'flipped') {
    canopy.position.set(-canopy.position.x, h, -canopy.position.z);
  }
  fog.root.updateMatrixWorld(true);

  /** World point -> screen pixel. y grows DOWNWARD, as on a canvas. */
  const px = (v) => {
    const p = v.clone().project(rig.camera);
    return { x: (p.x * 0.5 + 0.5) * W, y: (1 - (p.y * 0.5 + 0.5)) * H };
  };
  /** The vertex of ring `r` that lies on the player's own azimuth. */
  const ringVertexAt = (mesh, r) => {
    const pos = mesh.geometry.attributes.position;
    const n = pos.count;
    // Ring stride recovered the same way fg_reg does, then the vertex whose direction
    // best matches the arc. Asserted non-empty: an empty argmax silently returns index 0.
    const rings = 4 === 0 ? 0 : null; // placeholder, replaced below
    return rings;
  };
  // Ring stride: recover by change-point on (radius, alpha) exactly as fg_reg does.
  const strideOf = (mesh) => {
    const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
    const rad = (i) => Math.hypot(pos.getX(i), pos.getZ(i));
    let starts = [0];
    for (let i = 1; i < pos.count; i++) {
      const s = starts[starts.length - 1];
      if (!(Math.abs(rad(i) - rad(s)) <= 1e-4 * Math.max(1, rad(s)) && Math.abs(col.getW(i) - col.getW(s)) < 1e-6)) starts.push(i);
    }
    const lens = starts.map((s, k) => (k + 1 < starts.length ? starts[k + 1] : pos.count) - s);
    if (new Set(lens).size !== 1) throw new Error('ragged rings');
    return lens[0];
  };
  const vertexOnAzimuth = (mesh, r) => {
    const stride = strideOf(mesh);
    const pos = mesh.geometry.attributes.position;
    let best = -1, bestDot = -Infinity;
    for (let i = 0; i < stride; i++) {
      const k = r * stride + i;
      const lx = pos.getX(k), lz = pos.getZ(k);
      const len = Math.hypot(lx, lz);
      if (len < 1e-9) continue;
      const dot = (lx / len) * dx + (lz / len) * dz;
      if (dot > bestDot) { bestDot = dot; best = k; }
    }
    if (best < 0) throw new Error(`vertexOnAzimuth: ring ${r} of ${mesh.name} is degenerate (radius 0)`);
    return new THREE.Vector3(pos.getX(best), pos.getY(best), pos.getZ(best)).applyMatrix4(mesh.matrixWorld);
  };

  const feet = new THREE.Vector3(pWU.x * M, 0, pWU.y * M);
  const head = feet.clone().setY(S.CHARACTER_HEIGHT);
  const wallBase = new THREE.Vector3(feet.x, 0, feet.z);
  const wallDense = new THREE.Vector3(feet.x, 2.0, feet.z);   // the readable bottom of the curtain
  const wallTop = new THREE.Vector3(feet.x, wall.scale.y, feet.z);

  const rows = [
    ['player FEET (= the damage line)', px(feet)],
    ['player HEAD', px(head)],
    ['crest bright line (a 0.90)', px(vertexOnAzimuth(crest, 1))],
    ['curtain base', px(wallBase)],
    ['curtain dense top (2.0 m)', px(wallDense)],
    ['curtain top (6.5 m)', px(wallTop)],
    ['DANGER FIELD onset (a 0.00)', px(vertexOnAzimuth(canopy, 0))],
    ['DANGER FIELD a 0.60', px(vertexOnAzimuth(canopy, 1))],
  ];
  fog.dispose();
  return { rows, radiusWU, arcName, arm };
}

const radius = Number(flag('radius', '926.33'));
console.log(`# ${W}x${H} canvas · pitch 58 · fair framing · player standing EXACTLY on safeRadius = ${radius} wu`);
console.log('# screen y grows DOWNWARD. "gap" = pixels between the danger field edge and the character silhouette.\n');
for (const arm of (flag('arms', 'shipped,exact')).split(',')) {
  for (const arc of ['FAR', 'NEAR', 'SIDE']) {
    const r = run(radius, arc, arm);
    console.log(`## arm=${arm} arc=${arc}`);
    const feet = r.rows[0][1], head = r.rows[1][1];
    for (const [n, p] of r.rows) console.log('   ' + n.padEnd(32) + `x=${p.x.toFixed(0).padStart(5)}  y=${p.y.toFixed(0).padStart(5)}`);
    const field = r.rows[6][1];
    const gap = arc === 'FAR' ? head.y - field.y : (arc === 'NEAR' ? field.y - feet.y : Math.abs(field.x - feet.x));
    console.log(`   -> field edge to nearest part of the character: ${gap.toFixed(0)} px (${(gap / H * 100).toFixed(1)}% of frame height)\n`);
  }
}
