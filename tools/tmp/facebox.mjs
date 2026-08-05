#!/usr/bin/env node
/**
 * WHAT IS ACTUALLY IN EACH `face` JOINT — and how big it is in the head's own frame.
 *
 * `faceframe.mjs` reports the face box in WORLD space, which is where the framing rule
 * reads it, and world space hides the two things that decide whether the rule can ever
 * succeed: whether the box is centred on the character's own centre line, and whether
 * everything inside it is a facial feature at all. Egg's world face box came out
 * x[-0.003 .. 0.850] — entirely on one side of the model — which is either a rotated
 * symmetric face or an asymmetric pile of geometry, and those want opposite fixes.
 *
 * Per mesh under `face`: name, local (root-frame) box, and its share of the joint box.
 *
 *   node tools/tmp/facebox.mjs --url <snap>
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const base = (() => {
  const i = process.argv.indexOf('--url');
  return i > 0 ? process.argv[i + 1] : process.env.PREVIEW_BASE ?? 'http://localhost:5173';
})();

async function inPage() {
  const src = await (await fetch('/src/render/camera.ts')).text();
  const spec = (/from\s+"([^"]*three[^"]*)"/.exec(src) ?? /from\s+'([^']*three[^']*)'/.exec(src))[1];
  const THREE = await import(spec);
  const { createCharacter } = await import('/src/characters/registry.ts');
  const { CHARACTER_IDS } = await import('/src/game/rules.ts');

  const out = {};
  for (const id of CHARACTER_IDS) {
    const model = createCharacter(id);
    model.play('idle');
    model.update({ dt: 0.4, elapsed: 0.4, moveSpeed01: 0, health01: 1 });
    model.root.updateWorldMatrix(true, true);
    const face = model.root.getObjectByName('face');
    const head = model.root.getObjectByName('head');
    const rec = {
      rootRotY: +(model.root.rotation.y * 180 / Math.PI).toFixed(2),
      headRotY: head ? +(head.rotation.y * 180 / Math.PI).toFixed(2) : null,
      faceRotY: face ? +(face.rotation.y * 180 / Math.PI).toFixed(2) : null,
      facePos: face ? [+face.position.x.toFixed(3), +face.position.y.toFixed(3), +face.position.z.toFixed(3)] : null,
      meshes: [],
    };
    if (face) {
      // In the FACE joint's own frame: the frame the features were authored in.
      const inv = new THREE.Matrix4().copy(face.matrixWorld).invert();
      const total = new THREE.Box3();
      face.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone()
          .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        total.union(b);
        rec.meshes.push({
          name: o.name || '(unnamed)',
          min: [+b.min.x.toFixed(3), +b.min.y.toFixed(3), +b.min.z.toFixed(3)],
          max: [+b.max.x.toFixed(3), +b.max.y.toFixed(3), +b.max.z.toFixed(3)],
        });
      });
      rec.localFaceBox = {
        min: [+total.min.x.toFixed(3), +total.min.y.toFixed(3), +total.min.z.toFixed(3)],
        max: [+total.max.x.toFixed(3), +total.max.y.toFixed(3), +total.max.z.toFixed(3)],
      };
    }
    out[id] = rec;
    model.dispose?.();
  }
  return out;
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage();
await page.route('**/__facebox.html', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body>' }));
page.on('pageerror', (e) => console.error('page error:', String(e)));
await page.goto(`${base}/__facebox.html`, { waitUntil: 'domcontentloaded' });
const res = await page.evaluate(inPage);
await browser.close();

for (const [id, r] of Object.entries(res)) {
  const b = r.localFaceBox;
  console.log(`\n${id}  rootRotY ${r.rootRotY}  headRotY ${r.headRotY}  faceRotY ${r.faceRotY}  facePos ${JSON.stringify(r.facePos)}`);
  if (b) {
    console.log(`  face box (face frame)  x[${b.min[0]} .. ${b.max[0]}]  y[${b.min[1]} .. ${b.max[1]}]  z[${b.min[2]} .. ${b.max[2]}]`
      + `   size ${(b.max[0] - b.min[0]).toFixed(3)} x ${(b.max[1] - b.min[1]).toFixed(3)} x ${(b.max[2] - b.min[2]).toFixed(3)}`);
  }
  const sorted = r.meshes.slice().sort((a, c) => (c.max[0] - c.min[0]) * (c.max[1] - c.min[1]) - (a.max[0] - a.min[0]) * (a.max[1] - a.min[1]));
  for (const m of sorted.slice(0, 8)) {
    console.log(`    ${m.name.padEnd(28)} x[${String(m.min[0]).padStart(7)} ..${String(m.max[0]).padStart(7)}] y[${String(m.min[1]).padStart(7)} ..${String(m.max[1]).padStart(7)}] z[${String(m.min[2]).padStart(7)} ..${String(m.max[2]).padStart(7)}]`);
  }
  console.log(`    (${r.meshes.length} meshes)`);
}
