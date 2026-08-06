#!/usr/bin/env node
/**
 * cam_face — HOW STEEPLY DOES OUR CAST PRESENT ITS FACE, and is that the camera or the rig?
 *
 * `cam_ellipse.mjs` answers what a CAMERA is doing. It cannot answer what a CHARACTER
 * is doing, and those have completely different fixes: a camera pitch is one number in
 * `camera.ts`, a face plane is eleven rigs.
 *
 * ─── THE GEOMETRY, stated so the number can be argued with ──────────────────────
 * Treat the head as a solid of revolution about the vertical axis and the face as a
 * patch on its surface. Let
 *
 *   C = the head's centre,  E = the centroid of the FACE FEATURES (eyes/brows/mouth),
 *   phi = elevation of (E - C) above horizontal = asin(n.y) for n = normalize(E - C).
 *
 * `phi` is the **face-plane elevation**: 0 means the face looks straight out at the
 * horizon, positive means it is tipped UP toward a camera above.
 *
 * A camera at pitch `theta` then sees the face at
 *
 *   PRESENTATION ANGLE = theta - phi
 *
 * and the face foreshortens by cos(theta - phi). The share of the visible head that is
 * CROWN rather than face — the thing a critic reacts to — is
 *
 *   crownShare = (1 + sin(theta - phi)) / 2
 *
 * At phi = 0 our match camera (58) gives crownShare 0.924: **92% of the head above the
 * eye line.** Tipping the face up by 20 degrees gives 0.809. That difference is the
 * whole of Uri's hypothesis, expressed as a number the rig controls.
 *
 * ─── WHY THIS IS COMPUTED FROM THE RIG AND NOT FROM PIXELS ──────────────────────
 * A pixel measurement of the same thing needs the head silhouette AND the eye line
 * segmented out of a shaded render, and our heads carry near-white specular highlights
 * on the crown that a sclera detector cannot tell from an eye. The rig knows exactly
 * where the face meshes are. The rendered PNGs at `shots/camangle/ours_char_*_p*.png`
 * are the check on this, not the source of it — `CLAUDE.md` #3, read them.
 *
 * ⚠️ KNOWN-BAD VALIDATION. `--selftest` drives the SAME arithmetic with synthetic
 * heads whose answer is known, including two that must FAIL: a face plane that points
 * at the floor, and an "eye centroid" placed at the head centre (no direction at all).
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/cam_face.mjs --url {URL}
 *   node tools/tmp/cam_face.mjs --selftest
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const D = 180 / Math.PI;
const crownShare = (thetaDeg, phiDeg) => (1 + Math.sin((thetaDeg - phiDeg) / D)) / 2;

if (has('--selftest')) {
  let pass = 0, fail = 0;
  const chk = (n, ok, d) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

  // MOVES — the two shipped pitches on a face that looks at the horizon.
  chk(`phi=0, theta=20 -> crownShare ${crownShare(20, 0).toFixed(3)}`, Math.abs(crownShare(20, 0) - 0.671) < 0.002);
  chk(`phi=0, theta=58 -> crownShare ${crownShare(58, 0).toFixed(3)}`, Math.abs(crownShare(58, 0) - 0.924) < 0.002);
  // ORDERS — tipping the face up must always reduce crown, at both pitches.
  for (const th of [20, 40, 58]) {
    chk(`theta=${th}: crown falls monotonically as phi rises`,
      crownShare(th, 0) > crownShare(th, 10) && crownShare(th, 10) > crownShare(th, 20));
  }
  // HOLDS — the statistic depends only on the DIFFERENCE, which is the claim that a
  // camera change and a rig change are interchangeable for this quantity.
  chk('theta-phi is the only argument (58/20 == 38/0)',
    Math.abs(crownShare(58, 20) - crownShare(38, 0)) < 1e-12);
  // KNOWN-BAD 1 — a face plane pointing at the FLOOR reads worse than no fix at all,
  // and must not be reported as an improvement.
  chk(`phi=-20 at theta=58 is WORSE (${crownShare(58, -20).toFixed(3)} > ${crownShare(58, 0).toFixed(3)})`,
    crownShare(58, -20) > crownShare(58, 0));
  // KNOWN-BAD 2 — an eye centroid AT the head centre has no direction; phi is undefined
  // and the tool must refuse rather than return 0.
  const phiOf = (dx, dy, dz) => {
    const L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return null;
    return Math.asin(dy / L) * D;
  };
  chk('degenerate eye-at-centre returns null, not 0', phiOf(0, 0, 0) === null);
  chk('phi recovers a known 30deg tip', Math.abs(phiOf(0, 0.5, 0.8660254) - 30) < 0.01);

  // The PROJECTED-AREA law the live probe rests on: a flat patch of true area A with
  // unit normal n delivers A*|n.v| to a view along v. Checked against closed form on
  // a VERTICAL patch (a face that looks at the horizon) — it must fall as cos(theta).
  const patchArea = (thetaDeg, phiDeg) => {
    const th = thetaDeg / D, ph = phiDeg / D;
    // patch normal tipped up by phi, view direction depressed by theta
    const n = [0, Math.sin(ph), Math.cos(ph)];
    const v = [0, -Math.sin(th), -Math.cos(th)];
    return Math.abs(n[0] * v[0] + n[1] * v[1] + n[2] * v[2]);
  };
  chk(`vertical face at theta=20 delivers ${patchArea(20, 0).toFixed(4)} (cos20)`,
    Math.abs(patchArea(20, 0) - Math.cos(20 / D)) < 1e-9);
  chk(`vertical face at theta=58 delivers ${patchArea(58, 0).toFixed(4)} (cos58)`,
    Math.abs(patchArea(58, 0) - Math.cos(58 / D)) < 1e-9);
  chk(`58 vs 20 survival on a vertical face = ${(patchArea(58, 0) / patchArea(20, 0)).toFixed(3)} — the number to beat`,
    Math.abs(patchArea(58, 0) / patchArea(20, 0) - 0.564) < 0.002);
  // KNOWN-BAD: a face tipped UP by exactly theta faces the camera square-on and must
  // deliver its FULL area. If the law were wrong by a sign this would read minimum.
  chk('face tipped to meet the camera delivers 1.000', Math.abs(patchArea(58, 58) - 1) < 1e-9);
  // KNOWN-BAD: a face tipped DOWN loses more, not less.
  chk('face tipped down 20 at theta=58 delivers LESS than a vertical one',
    patchArea(58, -20) < patchArea(58, 0));
  console.log(`\ncam_face selftest: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
} else {
  const BASE = arg('--url') ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${BASE}/preview.html?piece=character&id=egg&shot=1`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });

  const data = await page.evaluate(async () => {
    const src = await (await fetch('/src/render/camera.ts')).text();
    const spec = (/from\s+"([^"]*three[^"]*)"/.exec(src) ?? /from\s+'([^']*three[^']*)'/.exec(src))[1];
    const THREE = await import(spec);
    const { createCharacter } = await import('/src/characters/registry.ts');
    const { CHARACTER_IDS } = await import('/src/game/rules.ts');

    const out = [];
    for (const id of CHARACTER_IDS) {
      // ⚠️ Per-character try/catch, and it earned itself immediately: a peer's
      // in-flight edit to `src/characters/sushi.ts` threw `o.thickAt is not a
      // function` from its constructor, which took down the whole 11-character sweep.
      // A snapshot freezes the working tree, uncommitted files included, so a probe
      // that runs while a cast overhaul is live must survive one broken constructor
      // or it measures nothing. The failure is REPORTED, not swallowed.
      try {
      const m = createCharacter(id);
      m.play('idle');
      // Settle to the same pose the renders were taken at (t = 1.5 s, 1/120 substeps).
      let t = 0;
      for (let i = 0; i < 180; i++) { t += 1 / 120; m.update({ dt: 1 / 120, elapsed: t, moveSpeed01: 0, health01: 1 }); }
      m.root.updateWorldMatrixWorld?.(true, true);
      m.root.updateWorldMatrix(true, true);

      const head = m.root.getObjectByName('head');
      const face = m.root.getObjectByName('face');
      const headBox = head ? new THREE.Box3().setFromObject(head) : null;
      const rec = { id, hasHead: !!head, hasFace: !!face };

      if (headBox && face) {
        const c = headBox.getCenter(new THREE.Vector3());
        const s = headBox.getSize(new THREE.Vector3());
        // The face-feature centroid, area-weighted by each mesh's bounding-box
        // diagonal so a big sclera counts for more than a 2 mm catchlight.
        const acc = new THREE.Vector3();
        let wsum = 0, meshes = 0;
        face.traverse((o) => {
          if (!o.isMesh || !o.geometry) return;
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
          const w = b.getSize(new THREE.Vector3()).length();
          acc.addScaledVector(b.getCenter(new THREE.Vector3()), w);
          wsum += w; meshes++;
        });
        if (wsum > 0) {
          acc.multiplyScalar(1 / wsum);
          const d = acc.clone().sub(c);
          const L = d.length();
          rec.headCentre = [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)];
          rec.headSize = [+s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3)];
          rec.faceCentroid = [+acc.x.toFixed(3), +acc.y.toFixed(3), +acc.z.toFixed(3)];
          rec.faceMeshes = meshes;
          rec.offsetLen = +L.toFixed(4);
          rec.phiDeg = L < 1e-4 ? null : +(Math.asin(d.y / L) * 180 / Math.PI).toFixed(2);
          // How far the face sits ABOVE the head's own centre, as a fraction of the
          // head's half-height. Reported next to phi because the two can disagree:
          // a face high on a TALL head can still have a low elevation angle.
          rec.faceAboveCentreFrac = +((acc.y - c.y) / (s.y / 2)).toFixed(3);
        }
      }
      // ── DELIVERED FACE AREA, with no shape assumption at all ────────────────
      //
      // ⚠️ `phi` above is exact as DEFINED, but turning it into "how much face does
      // the player see" assumes the head is a sphere. That assumption is fine for egg
      // and hamburger and **wrong for a torus** — donut's rig phi is -29.95, which
      // would predict crownShare 1.000 (no face at all at 58 deg), while the render
      // `shots/camangle/ours_char_donut_p58.png` plainly shows both eyes. The vector
      // is not lying; the sphere model is.
      //
      // So this measures the thing directly: sum the FRONT-FACING projected area of
      // every triangle, which for a closed convex mesh is exactly its silhouette area
      // and for a face patch is exactly the area it delivers to the screen. A
      // triangle of true area A and unit normal n projects to A*|n·v| onto the plane
      // perpendicular to the view direction v. No head shape enters.
      //
      // The number that matters is faceArea/headArea at pitch 58 against pitch 20:
      // that IS "how much of the face survives the match camera", in the units a
      // critic looks at.
      const projArea = (root, thetaDeg) => {
        const th = thetaDeg * Math.PI / 180;
        const v = new THREE.Vector3(0, -Math.sin(th), -Math.cos(th)); // camera at +Z, looking down
        let area = 0;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
        root.traverse((o) => {
          if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
          if (o.visible === false) return;
          const pos = o.geometry.attributes.position;
          const idx = o.geometry.index;
          const tri = idx ? idx.count / 3 : pos.count / 3;
          for (let t = 0; t < tri; t++) {
            const i0 = idx ? idx.getX(t * 3) : t * 3;
            const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
            const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
            a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
            b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
            c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
            e1.subVectors(b, a); e2.subVectors(c, a);
            n.crossVectors(e1, e2);
            const dot = n.dot(v);
            // Front-facing only: with v pointing INTO the scene, a triangle whose
            // outward normal opposes v faces the camera.
            if (dot < 0) area += -dot / 2;
          }
        });
        return area;
      };
      if (head && face) {
        rec.area = {};
        for (const th of [20, 40, 58]) {
          const fa = projArea(face, th), ha = projArea(head, th);
          rec.area['p' + th] = {
            face: +fa.toFixed(5), head: +ha.toFixed(5),
            faceOfHead: ha > 0 ? +(fa / ha).toFixed(4) : null,
          };
        }
        const a20 = rec.area.p20.faceOfHead, a58 = rec.area.p58.faceOfHead;
        rec.faceSurvival58vs20 = a20 ? +(a58 / a20).toFixed(3) : null;
      }
      out.push(rec);
      m.dispose?.();
      } catch (e) {
        out.push({ id, error: String(e && e.message ? e.message : e) });
      }
    }
    return out;
  });
  await browser.close();
  console.log(JSON.stringify({ errs, data }, null, 1));
}
