#!/usr/bin/env node
/**
 * DIAGNOSTIC PROBE driver. Loads a preview URL, runs an arbitrary in-page probe
 * function against `window.__stage`, optionally re-renders and screenshots.
 *
 * node tools/tmp/diag.mjs --url "<url>" --probe <name> [--out x.png] [--w] [--h]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

// ── Probes, evaluated in page. Each gets (THREE-less) access to window.__stage ──
const PROBES = {
  /** Dump world position + size of every baked shadow decal, puddle, hazard mesh. */
  shadowGraph: () => {
    const stage = window.__stage;
    const rows = [];
    stage.scene.updateMatrixWorld(true);
    stage.scene.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.name || '(anon)';
      if (!/shadow|puddle|hazard|scorch|glow|ring/i.test(n)) return;
      const p = new o.matrixWorld.constructor();
      const v = { x: 0, y: 0, z: 0 };
      v.x = o.matrixWorld.elements[12];
      v.y = o.matrixWorld.elements[13];
      v.z = o.matrixWorld.elements[14];
      const g = o.geometry;
      g.computeBoundingBox?.();
      const bb = g.boundingBox;
      rows.push({
        name: n,
        world: [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)],
        wu: [+(v.x / 0.05).toFixed(0), +(v.z / 0.05).toFixed(0)],
        localSize: bb ? [+(bb.max.x - bb.min.x).toFixed(2), +(bb.max.y - bb.min.y).toFixed(2)] : null,
        mat: o.material?.name || o.material?.type,
        opacity: o.material?.opacity,
        transparent: o.material?.transparent,
        depthWrite: o.material?.depthWrite,
        renderOrder: o.renderOrder,
        blending: o.material?.blending,
        visible: o.visible,
        parentChain: (() => { const s = []; let q = o.parent; while (q) { if (q.name) s.push(q.name); q = q.parent; } return s.join('<'); })(),
      });
    });
    return rows;
  },

  /** castShadow/receiveShadow audit per cover prop. */
  shadowFlags: () => {
    const stage = window.__stage;
    const out = {};
    stage.scene.traverse((o) => {
      if (!o.name || !o.name.startsWith('cover:')) return;
      const k = o.name;
      let cast = 0, nocast = 0, recv = 0, norecv = 0, meshes = 0;
      o.traverse((m) => { if (!m.isMesh) return; meshes++; m.castShadow ? cast++ : nocast++; m.receiveShadow ? recv++ : norecv++; });
      if (!out[k]) out[k] = { meshes, castShadow: cast, noCast: nocast, receiveShadow: recv, noRecv: norecv };
    });
    // also floor + lights
    const lights = [];
    stage.scene.traverse((o) => { if (o.isLight) lights.push({ type: o.type, castShadow: !!o.castShadow, intensity: o.intensity, mapSize: o.shadow ? [o.shadow.mapSize.x, o.shadow.mapSize.y] : null, cam: o.shadow ? { l: o.shadow.camera.left, r: o.shadow.camera.right, t: o.shadow.camera.top, b: o.shadow.camera.bottom, near: o.shadow.camera.near, far: o.shadow.camera.far } : null }); });
    let floorRecv = 0, floorTot = 0;
    stage.scene.traverse((o) => { if (o.isMesh && /floor|tile/i.test(o.name || '')) { floorTot++; if (o.receiveShadow) floorRecv++; } });
    return { props: out, lights, floorRecv, floorTot, shadowsEnabled: stage.renderer.shadowMap.enabled, shadowType: stage.renderer.shadowMap.type };
  },

  /** Every ground-level mesh (y<0.6) near a point, with depth/blend state. */
  floorLayers: () => {
    const stage = window.__stage;
    stage.scene.updateMatrixWorld(true);
    const rows = [];
    stage.scene.traverse((o) => {
      if (!o.isMesh) return;
      const y = o.matrixWorld.elements[13];
      if (y > 0.6 || y < -0.3) return;
      const x = o.matrixWorld.elements[12], z = o.matrixWorld.elements[14];
      const g = o.geometry; g.computeBoundingBox?.();
      const bb = g.boundingBox;
      const sx = bb ? (bb.max.x - bb.min.x) : 0;
      rows.push({
        name: o.name || '(anon)', y: +y.toFixed(3), wu: [+(x/0.05).toFixed(0), +(z/0.05).toFixed(0)],
        size: +sx.toFixed(2),
        dw: o.material?.depthWrite, tr: o.material?.transparent, dt: o.material?.depthTest,
        ro: o.renderOrder, blend: o.material?.blending, op: o.material?.opacity,
        inst: o.isInstancedMesh ? o.count : undefined,
        parent: o.parent?.name || '',
      });
    });
    rows.sort((a, b) => a.y - b.y);
    return rows;
  },
  /** Count and describe every mesh in the scene by name prefix. */
  inventory: () => {
    const stage = window.__stage;
    const counts = {};
    stage.scene.traverse((o) => {
      if (!o.isMesh) return;
      const k = (o.name || '(anon)').replace(/__no_outline$/, '');
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  },
};

// Mutations applied before render, selected by --mutate
const MUTATIONS = {
  none: () => 'none',
  /** Turn OFF the real shadow map entirely (baked decals stay). */
  noRealShadows: () => {
    const stage = window.__stage;
    stage.renderer.shadowMap.enabled = false;
    stage.scene.traverse((o) => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    return 'shadowMap off';
  },
  /** Baked decals hidden AND real shadow map off — the bare-lighting baseline. */
  noShadowsAtAll: () => {
    const stage = window.__stage;
    let n = 0;
    stage.scene.traverse((o) => { if (o.isMesh && /contact_shadow|cast_shadow/.test(o.name || '')) { o.visible = false; n++; } });
    stage.renderer.shadowMap.enabled = false;
    stage.scene.traverse((o) => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    return `hid ${n} + shadowMap off`;
  },
  /** Garish AND lifted 0.25m above the floor-pad layer. If red appears where it did
   *  not before, the decals were being z-occluded by opaque floor pads. */
  garishLifted: () => {
    const stage = window.__stage;
    let n = 0;
    const seen = new Map();
    stage.scene.traverse((o) => {
      if (!o.isMesh) return;
      const nm = o.name || '';
      let col = null;
      if (/contact_shadow/.test(nm)) col = 0xff0000;
      else if (/cast_shadow/.test(nm)) col = 0x00ffff;
      if (col === null) return;
      const key = col + ':' + o.material.uuid;
      let m = seen.get(key);
      if (!m) { m = o.material.clone(); m.color?.setHex(col); m.opacity = 1; m.transparent = true; m.map = null; seen.set(key, m); }
      o.material = m;
      o.position.y += 0.055;
      n++;
    });
    return `lifted+recoloured ${n}`;
  },
  /** Lift the real (untouched-colour) baked decals above the opaque floor pads. */
  liftBakedShadows: () => {
    const stage = window.__stage;
    let n = 0;
    stage.scene.traverse((o) => {
      if (o.isMesh && /contact_shadow|cast_shadow/.test(o.name || '')) { o.position.y += 0.06; n++; }
    });
    return `lifted ${n}`;
  },
  /** Hide ONLY the baked contact/AO decals. */
  hideContact: () => {
    const stage = window.__stage;
    let n = 0;
    stage.scene.traverse((o) => { if (o.isMesh && /contact_shadow/.test(o.name || '')) { o.visible = false; n++; } });
    return `hid ${n} contact`;
  },
  /** Hide ONLY the baked directional cast decals. */
  hideCast: () => {
    const stage = window.__stage;
    let n = 0;
    stage.scene.traverse((o) => { if (o.isMesh && /cast_shadow/.test(o.name || '')) { o.visible = false; n++; } });
    return `hid ${n} cast`;
  },
  /** Hide every baked shadow/AO decal. THE decisive props probe. */
  hideBakedShadows: () => {
    const stage = window.__stage;
    let n = 0;
    stage.scene.traverse((o) => {
      if (o.isMesh && /contact_shadow|cast_shadow/.test(o.name || '')) { o.visible = false; n++; }
    });
    return `hid ${n}`;
  },
  /** Garish-colour every baked shadow/AO decal so we can SEE where they actually are. */
  garishShadows: () => {
    const stage = window.__stage;
    let n = 0;
    const seen = new Map();
    stage.scene.traverse((o) => {
      if (!o.isMesh) return;
      const nm = o.name || '';
      let col = null;
      if (/contact_shadow/.test(nm)) col = 0xff0000;
      else if (/cast_shadow/.test(nm)) col = 0x00ffff;
      if (col === null) return;
      const key = col + ':' + (o.material.uuid);
      let m = seen.get(key);
      if (!m) {
        m = o.material.clone();
        m.color?.setHex(col);
        m.opacity = 1;
        m.transparent = true;
        m.map = null;
        seen.set(key, m);
      }
      o.material = m;
      n++;
    });
    return `recoloured ${n}`;
  },
};

async function main() {
  const args = parseArgs(process.argv);
  const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const url = args.url.startsWith('http') ? args.url : BASE + args.url;
  const w = Number(args.w ?? 1300), h = Number(args.h ?? 820);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });
    await page.waitForTimeout(300);

    if (args.mutate && args.mutate !== 'none') {
      const res = await page.evaluate(`(${MUTATIONS[args.mutate].toString()})()`);
      console.log('MUTATE:', args.mutate, '->', res);
      await page.evaluate(() => { window.__stage.render(0); window.__stage.render(0); });
      await page.waitForTimeout(200);
    }

    if (args.probe) {
      const res = await page.evaluate(`(${PROBES[args.probe].toString()})()`);
      console.log(JSON.stringify(res, null, 1));
    }

    if (args.pixels) {
      // --pixels "x,y;x,y;..." sample the composited canvas
      const res = await page.evaluate((spec) => {
        const cv = document.querySelector('canvas');
        const tmp = document.createElement('canvas');
        tmp.width = cv.width; tmp.height = cv.height;
        const ctx = tmp.getContext('2d');
        ctx.drawImage(cv, 0, 0);
        return spec.split(';').map((s) => {
          const [x, y] = s.split(',').map(Number);
          const d = ctx.getImageData(x, y, 1, 1).data;
          return { at: [x, y], rgb: [d[0], d[1], d[2]] };
        });
      }, args.pixels);
      console.log('PIXELS', JSON.stringify(res));
    }

    if (args.out) {
      await mkdir(dirname(resolve(args.out)), { recursive: true });
      await page.screenshot({ path: args.out, timeout: 90000 });
      console.log('shot ->', args.out);
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
