/**
 * fg_cover — HOW DARK IS THE GROUND ACTUALLY DRAWN, as a function of how far it is from
 * the line that kills you.
 *
 * `fg_reg` answers "where is each cue drawn". This answers the question that decides
 * whether a player can SEE the danger: it single-samples every fog layer along the real
 * camera ray to each ground point and composites them in the shipped `renderOrder`
 * (crest 6 -> curtain 7 -> canopy 8, all `depthWrite:false`, so the order is the
 * renderOrder and NOT the depth), then reports the luminance against the bare floor.
 *
 * The threshold is not invented. `arena/fogRing.ts`'s own header states the acceptance
 * test this module was built to pass:
 *
 *   > every surface OUTSIDE the boundary, floor and raised prop alike, drops >= 30% in
 *   > luminance ... every surface INSIDE the boundary is bit-for-bit unchanged.
 *
 * So this prints, per arc: the first radius outside the line at which the drop reaches
 * 30%, and the innermost SAFE radius at which the drop is non-zero. A correct
 * implementation puts the first at a few wu outside and the second at 0.
 *
 * Every colour, alpha, ring radius and curtain texel is READ OFF the shipped objects.
 * The only authored input is the floor albedo (`KPAL.tileLight`), passed as --floor.
 */
import { loadShipped } from './fg_lib.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes('--' + n);

const S = await loadShipped();
const { THREE } = S;
const M = S.WORLD_SCALE;
const FLOOR = new THREE.Color(flag('floor', '#8A5F6F'));
const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

const ARCS = { NEAR: [0, 1], FAR: [0, -1], SIDE: [1, 0] };

/** Concentric (radius, colour, alpha) profile of an annulus mesh, in LOCAL metres. */
function profile(mesh) {
  const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
  const rad = (i) => Math.hypot(pos.getX(i), pos.getZ(i));
  const starts = [0];
  for (let i = 1; i < pos.count; i++) {
    const s = starts[starts.length - 1];
    if (!(Math.abs(rad(i) - rad(s)) <= 1e-4 * Math.max(1, rad(s)) && Math.abs(col.getW(i) - col.getW(s)) < 1e-6)) starts.push(i);
  }
  const lens = starts.map((s, k) => (k + 1 < starts.length ? starts[k + 1] : pos.count) - s);
  if (new Set(lens).size !== 1) throw new Error('ragged rings on ' + mesh.name);
  return starts.map((s) => ({ r: rad(s), c: new THREE.Color(col.getX(s), col.getY(s), col.getZ(s)), a: col.getW(s) }));
}

/** Sample an annulus profile at radius r: linear in radius, as the rasteriser interpolates. */
function sampleProfile(p, r) {
  if (r < p[0].r || r > p[p.length - 1].r) return null;   // the hole, or past the outer rim
  for (let i = 0; i + 1 < p.length; i++) {
    if (r >= p[i].r && r <= p[i + 1].r) {
      const f = (p[i + 1].r - p[i].r) < 1e-9 ? 0 : (r - p[i].r) / (p[i + 1].r - p[i].r);
      const c = p[i].c.clone().lerp(p[i + 1].c, f);
      return { c, a: p[i].a + (p[i + 1].a - p[i].a) * f };
    }
  }
  return null;
}

function over(dst, src, a) { return dst.clone().multiplyScalar(1 - a).add(src.clone().multiplyScalar(a)); }

function build(radiusWU, arcName, arm) {
  const [dx, dz] = ARCS[arcName];
  const rig = new S.CameraRig({ pitchDeg: Number(flag('pitch', '58')), yawDeg: 0, frameMode: 'fair' });
  rig.setAspect(Number(flag('aspect', String(16 / 9))));
  const pWU = { x: S.CENTER.x + dx * radiusWU, y: S.CENTER.y + dz * radiusWU };
  rig.snapTo(pWU.x * M, pWU.y * M);
  const C = rig.camera.position.clone();

  const fog = S.createFogRing(S.CENTER);
  fog.update(radiusWU, 12.0, true, rig);
  const named = {}; fog.root.traverse((o) => { if (o.isMesh) named[o.name] = o; });
  const crestM = named['fog_edge__no_outline'], canopyM = named['fog_canopy__no_outline'], wallM = named['fog_curtain__no_outline'];
  const h = canopyM.position.y;
  if (arm === 'exact') {
    const k = (C.y - h) / C.y;
    canopyM.position.set((1 - k) * (C.x - S.CENTER.x * M), h, (1 - k) * (C.z - S.CENTER.y * M));
    canopyM.scale.set(k, k === 0 ? 1 : 1, k); canopyM.scale.x = k; canopyM.scale.z = k;
  } else if (arm === 'flipped') {
    canopyM.position.set(-canopyM.position.x, h, -canopyM.position.z);
  } else if (arm === 'noCanopy') {
    canopyM.visible = false;
  } else if (arm === 'none') {
    // TRUE NULL. Every layer hidden, so every sample must read exactly 0.0% and the
    // whole composite path is proved to be measuring the fog and not the floor maths.
    canopyM.visible = false; crestM.visible = false; wallM.visible = false;
  } else if (arm !== 'shipped') throw new Error('unknown arm ' + arm);
  fog.root.updateMatrixWorld(true);

  const crestP = profile(crestM), canopyP = profile(canopyM);
  const O = new THREE.Vector2(S.CENTER.x * M, S.CENTER.y * M);
  const crestC = new THREE.Vector2(O.x + crestM.position.x, O.y + crestM.position.z);
  const canopyC = new THREE.Vector2(O.x + canopyM.position.x, O.y + canopyM.position.z);
  const canopyScale = canopyM.scale.x;
  const crestY = crestM.position.y, canopyY = canopyM.position.y;

  // The curtain's true opacity profile, straight off the CanvasTexture's retained pixels.
  const img = wallM.material.map.image.__image;
  if (!img) throw new Error('curtain texture pixels were not retained by the stub');
  const TW = img.width, TH = img.height;
  const meanAlphaAtV = (v) => {                       // v: 0 = cylinder bottom, 1 = top
    const row = Math.round((1 - v) * (TH - 1));       // CanvasTexture flips Y
    let s = 0; for (let x = 0; x < TW; x++) s += img.data[(row * TW + x) * 4 + 3];
    return s / TW / 255;
  };
  const texRGBAtV = (v) => {
    const row = Math.round((1 - v) * (TH - 1));
    let r = 0, g = 0, b = 0;
    for (let x = 0; x < TW; x++) { const i = (row * TW + x) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; }
    return new THREE.Color(r / TW / 255, g / TW / 255, b / TW / 255);
  };
  const wallR = wallM.scale.x, wallH = wallM.scale.y;
  const wallCol = wallM.material.color.clone();
  const wallOpacity = 0.82;   // the pulse's midpoint; `wallMat.opacity` at sin = 0

  /** Composited colour seen at ground point G. */
  function shade(G) {
    let out = FLOOR.clone();
    const dir = new THREE.Vector3(G.x - C.x, -C.y, G.y - C.z);
    // crest plane (renderOrder 6)
    const hitPlane = (y) => {
      const t = (y - C.y) / dir.y;
      return t > 0 && t < 1 ? new THREE.Vector2(C.x + dir.x * t, C.z + dir.z * t) : null;
    };
    const pc = crestM.visible ? hitPlane(crestY) : null;
    if (pc) { const s = sampleProfile(crestP, pc.distanceTo(crestC)); if (s) out = over(out, s.c, s.a); }
    // curtain (renderOrder 7): every crossing of the cylinder wall between y = 0 and wallH
    {
      const ox = C.x - O.x, oz = C.z - O.y;
      const a2 = dir.x * dir.x + dir.z * dir.z;
      const b2 = 2 * (ox * dir.x + oz * dir.z);
      const c2 = ox * ox + oz * oz - wallR * wallR;
      const disc = b2 * b2 - 4 * a2 * c2;
      if (disc > 0 && wallM.visible) {
        const sq = Math.sqrt(disc);
        for (const t of [(-b2 - sq) / (2 * a2), (-b2 + sq) / (2 * a2)]) {
          if (!(t > 0 && t < 1)) continue;
          const y = C.y + dir.y * t;
          if (y < 0 || y > wallH) continue;
          const v = y / wallH;
          const a = meanAlphaAtV(v) * wallOpacity;
          out = over(out, wallCol.clone().multiply(texRGBAtV(v)), a);
        }
      }
    }
    // canopy (renderOrder 8)
    if (canopyM.visible) {
      const pk = hitPlane(canopyY);
      if (pk) { const s = sampleProfile(canopyP, pk.distanceTo(canopyC) / canopyScale); if (s) out = over(out, s.c, s.a); }
    }
    return out;
  }

  const base = luma(FLOOR);
  const samples = [];
  for (let off = -260; off <= 320; off += 2) {
    const rr = radiusWU + off;
    const G = new THREE.Vector2((S.CENTER.x + dx * rr) * M, (S.CENTER.y + dz * rr) * M);
    const l = luma(shade(G));
    samples.push({ off, drop: 1 - l / base });
  }
  fog.dispose();
  return samples;
}

const radius = Number(flag('radius', '926.33'));
const TH30 = 0.30;
console.log(`# composited ground luminance vs the bare floor ${flag('floor', '#8A5F6F')} · safeRadius ${radius} wu · pitch ${flag('pitch', '58')}`);
console.log(`# acceptance test quoted from arena/fogRing.ts: OUTSIDE must drop >= 30%, INSIDE must be unchanged\n`);
for (const arm of (flag('arms', 'shipped,exact,noCanopy')).split(',')) {
  for (const arc of ['FAR', 'NEAR', 'SIDE']) {
    const s = build(radius, arc, arm);
    const outside = s.filter((x) => x.off > 0);
    const inside = s.filter((x) => x.off < 0);
    if (outside.length === 0 || inside.length === 0) throw new Error('empty half — the sweep did not straddle the line');
    const first30 = outside.find((x) => x.drop >= TH30);
    const innermostTouched = inside.filter((x) => x.drop > 0.01).sort((a, b) => a.off - b.off)[0];
    const at = (o) => s.find((x) => x.off === o);
    console.log(`## arm=${arm} arc=${arc}`);
    console.log(`   drop at the line (+0 wu) ......... ${(at(0).drop * 100).toFixed(1)}%`);
    console.log(`   drop at +20 / +50 / +100 / +200 .. ${[20, 50, 100, 200].map((o) => (at(o).drop * 100).toFixed(1) + '%').join(' / ')}`);
    console.log(`   FIRST radius reaching -30% ....... ${first30 ? '+' + first30.off + ' wu' : 'never within +320 wu'}`);
    console.log(`   innermost SAFE ground darkened ... ${innermostTouched ? innermostTouched.off + ' wu' : 'none (correct)'}`);
    const safe30 = inside.filter((x) => x.drop >= TH30).sort((a, b) => a.off - b.off)[0];
    console.log(`   innermost SAFE ground at >= 30% ... ${safe30 ? safe30.off + ' wu  (band ' + (0 - safe30.off) + ' wu wide)' : 'none (correct)'}`);
    console.log(`   drop at -50 / -100 (SAFE ground) . ${[-50, -100].map((o) => (at(o).drop * 100).toFixed(1) + '%').join(' / ')}\n`);
  }
}
