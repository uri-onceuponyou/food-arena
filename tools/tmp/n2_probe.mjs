#!/usr/bin/env node
/**
 * n2_probe — the neck migration priced WITHOUT a source edit, at BOTH shipped cameras.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY THIS EXISTS ALONGSIDE `nm_island.mjs` ───────────────────────────────
 * `nm_island` answers the verdict question — is the head a separate island — but only
 * for the tree it is pointed at. Pricing `withoutNeck()` with it therefore costs a
 * source edit per candidate, and a source edit that turns out to be wrong is the
 * expensive half of this whole pass (two characters were migrated, rendered, and
 * reverted).
 *
 * 🔴 THE MIGRATION NEEDS NO SOURCE EDIT TO BE RENDERED, and this is the load-bearing
 * fact: `withoutNeck()` holds R, `headCentreY`, `torsoTopY` and every other published
 * metric IDENTICAL (`nm_neck --against`, 11 of 11, max |Δ| 5.55e-17). The ONLY thing
 * it changes in the scene graph is that `neck_column` and `neck_collar` stop existing.
 * So **hiding those two meshes renders exactly the migrated character**, and an A/B
 * between `--hide none` and `--hide neck` is a paired comparison on one frozen tree
 * with one build.
 * ⚠️ The outline shell is a SEPARATE mesh with a suffixed name (`neck_column__outline`)
 * and it draws pixels. `--hide` matches on the stripped base name for exactly that
 * reason; a first version keyed on the exact name and left an inflated copy of the
 * column standing, which reads as "removing the column changed almost nothing".
 *
 * ── MODES ───────────────────────────────────────────────────────────────────
 *   `--mode island`  4-connected components of the character's matte (shipped frame
 *                    minus the `rig_root`-hidden frame), the same construction
 *                    `nm_island` uses, at `--pitch`.
 *   `--mode neckpx`  the ablation `25d5579` priced the defect with: the named meshes
 *                    painted `#FF00FF` through the shipped path, magenta counted, with
 *                    the UNPAINTED capture as a control that must score 0.
 *
 * ── KNOWN-BAD INPUTS (CLAUDE.md #6) ─────────────────────────────────────────
 *   `--knownbad split`     lift the `head` joint by `--dy`; components MUST rise.
 *                          ⚠️ It REFUSES to run on an arm whose base is already split:
 *                          "2 -> 2" is not evidence a detector works, and the first
 *                          version reported exactly that as a failure when it was
 *                          pointed at `--hide neck` (which is split by construction).
 *   `--knownbad selfpair`  same tree twice: 0 differing pixels, EXACTLY (camera shake
 *                          is zeroed by `a1a85e5`, so 0 is the real answer, not a
 *                          tolerance).
 *   `--knownbad hide`      Three cells, because the two obvious formulations are BOTH
 *                          wrong and both were written before this one:
 *                            A  a name that matches nothing  -> 0 matched, 0 changed
 *                            B  `rig_root`                   -> >0 matched, >0 changed
 *                            C  `neck`                       -> changedPx > 0 must
 *                               IMPLY matched > 0, and nothing more.
 *                          🚨 C IS ONE-WAY ON PURPOSE. "matched > 0 must coincide with
 *                          changedPx > 0" was the second draft and **burrito refutes
 *                          it**: it builds a column, `--hide` matches all 4 objects,
 *                          and the frame does not move by a single pixel — because its
 *                          own mass hides the column completely, which is the whole
 *                          reason `25d5579` scored it 0 px and used it as the control.
 *                          A guard that cannot tell "matched nothing" from "matched
 *                          something invisible" would have called that a failure. B is
 *                          what proves the mechanism is live without needing any
 *                          character to have a visible column — which, after this pass,
 *                          none does.
 *   `--knownbad control`   the magenta control: an unpainted frame must score 0.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/n2_probe.mjs --url {URL} --ids hotdog,sushi --mode island \
 *       --pitch 20 --hide neck --out shots/n2/hidden
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { components } from './silhlib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const IDS = get('--ids', 'hotdog,sushi').split(',').map((s) => s.trim()).filter(Boolean);
const PITCHES = get('--pitch', '20').split(',').map(Number);
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.60'));
const MODE = get('--mode', 'island');
const MIN = Number(get('--min', '60'));
const MINSHADOW = Number(get('--minshadow', '18'));
const DY = Number(get('--dy', '0.6'));
const KNOWNBAD = get('--knownbad', null);
const OUT = get('--out', null);
const HIDE = get('--hide', 'none');
/** `--shift name:dy,name:dy` — displace named objects in Y before the capture. */
const SHIFT = get('--shift', '').split(',').filter(Boolean).map((s) => {
  const [name, dy] = s.split(':');
  return { name, dy: Number(dy) };
});
/** `--scaley name:k` — scale named objects in Y about their own TOP edge. */
const SCALEY = get('--scaley', '').split(',').filter(Boolean).map((s) => {
  const [name, k] = s.split(':');
  return { name, k: Number(k) };
});
const PAINT = get('--paint', 'neck');
/**
 * ⚠️ THE JOIN IS MEASURED ON ONE ANIMATION PHASE UNLESS YOU SAY OTHERWISE. `t=1.5`
 * `anim=idle` is what `cr2_shot` and `nm_island` freeze, and the idle cycle rotates
 * `torso.x` by +-0.065 and `head.x` by -+0.075 — at ~0.45 m of lever that is ~0.03 m
 * of relative travel at the neck, which is the same order as the overlap a join is
 * bought with. Sweep `--t` before believing a single-phase "1 component".
 */
const TS = get('--t', '1.5').split(',').map(Number);
const ANIMS = get('--anim', 'idle').split(',');
const W = 900, H = 1400;

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

/** `neck` is the alias for exactly what `withoutNeck()` deletes. */
const NAMESETS = { neck: ['neck_column', 'neck_collar'], none: [] };
const resolve = (spec) => (NAMESETS[spec] ?? spec.split(',').map((s) => s.trim()).filter(Boolean));

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });

/**
 * One capture through the shipped preview path.
 * `opts.hide` names meshes to remove, `opts.paint` names meshes to force to magenta,
 * `opts.nochar` hides `rig_root`, `opts.lift` displaces the `head` joint.
 * Returns the PNG and the COUNT of objects each list actually matched — a hide that
 * matched nothing must not be readable as "the change did nothing".
 */
async function capture(id, pitch, opts = {}) {
  const t = opts.t ?? TS[0], anim = opts.anim ?? ANIMS[0];
  const url = `${BASE}/preview.html?piece=character&id=${id}&pitch=${pitch}&yaw=${YAW}&fill=${FILL}`
    + `&t=${t}&anim=${anim}&shot=1&bg=3d2b21`;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });
  const info = await page.evaluate(({ hide, paint, nochar, lift, shift, scaley }) => {
    const s = window.__stage;
    const base = (n) => String(n || '').replace(/__(no_)?outline$/, '');
    let hidden = 0, painted = 0, lifted = 0, shifted = 0;
    if (lift) s.scene.traverse((o) => { if (o.name === 'head') { o.position.y += lift; lifted++; } });
    // ⚠️ Base-name match, so the INVERTED-HULL OUTLINE follows. `addOutline` COPIES the
    // mesh's transform once, at construction — it is not a child — so moving only the
    // mesh leaves its ink line behind and the frame shows a ghost.
    for (const sh of shift || []) {
      s.scene.traverse((o) => { if (base(o.name) === sh.name) { o.position.y += sh.dy; shifted++; } });
    }
    // Scale about the object's own TOP, so a block can be lengthened DOWNWARD without
    // moving what sits on it. Needs the geometry's local box, which is why it cannot be
    // expressed as a plain scale.
    for (const sc of scaley || []) {
      s.scene.traverse((o) => {
        if (base(o.name) !== sc.name || !o.geometry) return;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        const top = o.position.y + bb.max.y * o.scale.y;
        o.scale.y *= sc.k;
        o.position.y = top - bb.max.y * o.scale.y;
        shifted++;
      });
    }
    if (hide && hide.length) s.scene.traverse((o) => { if (hide.includes(base(o.name))) { o.visible = false; hidden++; } });
    if (paint && paint.length) {
      s.scene.traverse((o) => {
        if (!o.isMesh || !paint.includes(base(o.name))) return;
        // A fresh unlit material, not a colour tweak: the shipped material is shared
        // and lit, so a tint would neither be unmissable nor confined to this mesh.
        const M = o.material?.constructor?.name;
        o.material = new (Object.getPrototypeOf(o.material).constructor)({ color: 0xff00ff });
        if (o.material.emissive) { o.material.emissive.setHex(0xff00ff); o.material.emissiveIntensity = 1; }
        o.material.toneMapped = false;
        o.userData.wasMaterial = M;
        painted++;
      });
    }
    if (nochar) s.scene.traverse((o) => { if (o.name === 'rig_root') o.visible = false; });
    s.scene.updateMatrixWorld(true);
    s.render(0);
    return { hidden, painted, lifted, shifted };
  }, { hide: opts.hide ?? [], paint: opts.paint ?? [], nochar: !!opts.nochar, lift: opts.lift ?? 0, shift: opts.shift ?? [], scaley: opts.scaley ?? [] });
  const buf = await page.locator('canvas').first().screenshot();
  await page.close();
  return { buf, info };
}

const raw = (buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true });

/** Differing-pixel count between two captures, exact. */
async function diffPx(A, B) {
  const [ra, rb] = await Promise.all([raw(A), raw(B)]);
  const ch = ra.info.channels;
  let d = 0;
  for (let i = 0; i < ra.data.length; i += ch) {
    if (ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2]) d++;
  }
  return d;
}

/** matte + 4-connected components, identical construction to `nm_island`. */
async function island(id, pitch, opts) {
  const A = await capture(id, pitch, opts);
  const B = await capture(id, pitch, { ...opts, nochar: true });
  const [ra, rb] = await Promise.all([raw(A.buf), raw(B.buf)]);
  const ch = ra.info.channels;
  const solid = new Uint8Array(W * H);
  let solidPx = 0;
  for (let j = 0; j < W * H; j++) {
    const i = j * ch;
    const dr = ra.data[i] - rb.data[i], dg = ra.data[i + 1] - rb.data[i + 1], db = ra.data[i + 2] - rb.data[i + 2];
    if (dr === 0 && dg === 0 && db === 0) continue;
    const mag = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
    const chroma = Math.max(dr, dg, db) - Math.min(dr, dg, db);
    if (mag >= MINSHADOW || chroma >= MINSHADOW) { solid[j] = 1; solidPx++; }
  }
  const { label, sizes } = components(solid, W, H);
  const big = sizes.map((s, i) => [i, s]).filter(([, s]) => s >= MIN).sort((x, y) => y[1] - x[1]);
  // Every component's bounding box, because "2 components" is not a finding until you
  // know WHICH 68 pixels — a detached head and a clipped chopstick tip are the same
  // integer and completely different bugs.
  const boxes = new Map();
  for (let j = 0; j < W * H; j++) {
    const id = label[j];
    if (id < 0) continue;
    const x = j % W, y = (j / W) | 0;
    const b = boxes.get(id) ?? { x0: W, x1: -1, y0: H, y1: -1 };
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    boxes.set(id, b);
  }
  const bboxes = big.map(([i, s]) => {
    const b = boxes.get(i);
    return `${s}px @ x[${b.x0}-${b.x1}] y[${b.y0}-${b.y1}]`;
  });
  return { solidPx, nComp: big.length, sizes: big.map(([, s]) => s), bboxes, png: A.buf, info: A.info };
}

/** magenta pixels, and the control that must be 0. */
async function magenta(buf) {
  const r = await raw(buf);
  const ch = r.info.channels;
  let n = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let j = 0; j < W * H; j++) {
    const i = j * ch;
    const R = r.data[i], G = r.data[i + 1], B = r.data[i + 2];
    if (R > 150 && B > 150 && G < 90 && Math.abs(R - B) < 90) {
      n++;
      const x = j % W, y = (j / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { n, bbox: n ? `${x1 - x0 + 1} x ${y1 - y0 + 1}` : '—' };
}

const save = async (name, buf) => { if (OUT) { await mkdir(OUT, { recursive: true }); await writeFile(`${OUT}/${name}`, buf); } };

let bad = 0;

// ── known-bads ──────────────────────────────────────────────────────────────
if (KNOWNBAD === 'selfpair') {
  for (const id of IDS) for (const p of PITCHES) {
    const A = await capture(id, p, {}); const B = await capture(id, p, {});
    const d = await diffPx(A.buf, B.buf);
    console.log(`SELF-PAIR ${id} p${p}: changedPx=${d} (MUST be exactly 0)`);
    if (d !== 0) bad++;
  }
} else if (KNOWNBAD === 'hide') {
  // Two-sided. A hide that matches nothing must not read as "no effect", and a hide
  // that matches something must actually move the frame.
  console.log('KNOWN-BAD hide — three cells per character:');
  console.log('  A  a name nothing carries   -> matched 0, changed 0');
  console.log('  B  rig_root                 -> matched > 0, changed > 0   (the mechanism is live)');
  console.log('  C  neck                     -> changed > 0 IMPLIES matched > 0, and no more:');
  console.log('     a column that exists and is fully HIDDEN by the food mass legitimately');
  console.log('     changes nothing. burrito is exactly that, and it refuted the previous');
  console.log('     two-way version of this check.\n');
  const names = resolve('neck');
  for (const id of [...IDS]) for (const p of PITCHES) {
    const base = await capture(id, p, {});
    const cells = [
      ['A none', ['n2_no_such_mesh'], (m, d) => m === 0 && d === 0],
      ['B root', ['rig_root'], (m, d) => m > 0 && d > 0],
      ['C neck', names, (m, d) => !(d > 0) || m > 0],
    ];
    for (const [label, hide, want] of cells) {
      const arm = await capture(id, p, { hide });
      const d = await diffPx(base.buf, arm.buf);
      const ok = want(arm.info.hidden, d);
      console.log(`${id.padEnd(12)} p${p}  ${label}  matched ${String(arm.info.hidden).padStart(3)}  changedPx ${String(d).padStart(7)}   ${ok ? '✓' : '🔴'}`);
      if (!ok) bad++;
    }
  }
} else if (KNOWNBAD === 'control') {
  for (const id of IDS) for (const p of PITCHES) {
    const A = await capture(id, p, {});
    const m = await magenta(A.buf);
    console.log(`CONTROL ${id} p${p}: magenta in the UNPAINTED frame = ${m.n} (MUST be 0)`);
    if (m.n !== 0) bad++;
  }
} else if (KNOWNBAD === 'split') {
  for (const id of IDS) for (const p of PITCHES) {
    const base = await island(id, p, { hide: resolve(HIDE), shift: SHIFT });
    if (base.nComp !== 1) {
      console.log(`${id.padEnd(12)} p${p}  🔴 VOID — the base arm is already ${base.nComp} components`
        + `, so "${base.nComp} -> ${base.nComp}" proves nothing. Run the known-bad on a JOINED arm.`);
      bad++; continue;
    }
    const lift = await island(id, p, { hide: resolve(HIDE), shift: SHIFT, lift: DY });
    const ok = lift.nComp > base.nComp;
    console.log(`${id.padEnd(12)} p${p}  head +${DY} m -> components ${base.nComp} -> ${lift.nComp}`
      + `  (${lift.sizes.slice(0, 5).join(', ')})  ${ok ? 'DETECTED ✓' : '🔴 NOT DETECTED'}`);
    if (!ok) bad++;
  }
} else if (MODE === 'sweep') {
  // What vertical raise of the character's own torso mass closes the join? Answered
  // in the browser, on one build, so the design round is priced BEFORE a source edit.
  const names = resolve(HIDE);
  const group = get('--group', null);
  const scaleGroup = get('--scalegroup', null);
  const list = scaleGroup ? get('--ks', '1,1.5,2,2.5').split(',').map(Number)
    : get('--dys', '0,0.03,0.06,0.09,0.12').split(',').map(Number);
  if (!group && !scaleGroup) { console.error('--mode sweep needs --group or --scalegroup'); process.exit(2); }
  console.log(`n2_probe sweep    ${scaleGroup ? `scaleY ${scaleGroup}` : `shift ${group}`}   hide=[${names.join(', ') || '—'}]`
    + `   fixed shift=[${SHIFT.map((s) => `${s.name}:${s.dy}`).join(', ') || '—'}]`);
  console.log(`id           pitch  ${scaleGroup ? '     k' : '    dy'}  moved  solidPx  components  sizes`);
  for (const id of IDS) for (const p of PITCHES) for (const v of list) {
    const opts = scaleGroup
      ? { hide: names, shift: SHIFT, scaley: [{ name: scaleGroup, k: v }] }
      : { hide: names, shift: [...SHIFT, { name: group, dy: v }] };
    const r = await island(id, p, opts);
    console.log(`${id.padEnd(12)} ${String(p).padStart(5)} ${v.toFixed(3).padStart(6)}`
      + `  ${String(r.info.shifted).padStart(5)}  ${String(r.solidPx).padStart(7)}  ${String(r.nComp).padStart(10)}  ${r.sizes.slice(0, 4).join(', ')}`);
    if (r.info.shifted === 0 && v !== 0) { console.log(`             🔴 --${scaleGroup ? 'scalegroup' : 'group'} matched NOTHING — the sweep is measuring the unchanged character.`); bad++; }
    await save(`${id}_p${p}_${scaleGroup ? 'k' : 'dy'}${v.toFixed(3)}.png`, r.png);
  }
} else if (MODE === 'island') {
  const names = resolve(HIDE);
  console.log(`n2_probe island   hide=[${names.join(', ') || '—'}]   yaw ${YAW}  fill ${FILL}  min ${MIN} px  shadow floor ${MINSHADOW}`);
  console.log(`id           pitch  anim      t  hidden  solidPx  components  sizes`);
  for (const id of IDS) for (const p of PITCHES) for (const anim of ANIMS) for (const t of TS) {
    const r = await island(id, p, { hide: names, shift: SHIFT, scaley: SCALEY, t, anim });
    console.log(`${id.padEnd(12)} ${String(p).padStart(5)}  ${anim.padEnd(5)} t${String(t).padStart(5)}`
      + `  ${String(r.info.hidden).padStart(6)}  ${String(r.solidPx).padStart(7)}  ${String(r.nComp).padStart(10)}`
      + `  ${r.sizes.slice(0, 6).join(', ')}${r.nComp > 1 ? `   🔴 SPLIT — ${r.bboxes.join(' | ')}` : ''}`);
    if (r.nComp > 1) bad++;
    await save(`${id}_p${p}_${anim}_t${t}_${HIDE === 'none' ? 'shipped' : HIDE}.png`, r.png);
  }
} else if (MODE === 'neckpx') {
  const names = resolve(PAINT);
  console.log(`n2_probe neckpx   paint=[${names.join(', ')}]   yaw ${YAW}  fill ${FILL}`);
  console.log('id           pitch  painted  control  magenta   bbox');
  for (const id of IDS) for (const p of PITCHES) {
    const ctl = await capture(id, p, {});
    const abl = await capture(id, p, { paint: names });
    const c = await magenta(ctl.buf), m = await magenta(abl.buf);
    console.log(`${id.padEnd(12)} ${String(p).padStart(5)}  ${String(abl.info.painted).padStart(7)}`
      + `  ${String(c.n).padStart(7)}  ${String(m.n).padStart(7)}   ${m.bbox}`);
    if (c.n !== 0) { console.log('             🔴 CONTROL IS NOT ZERO — the magenta test is reading the palette.'); bad++; }
    await save(`${id}_p${p}_ablated.png`, abl.buf);
  }
} else {
  console.error(`unknown --mode ${MODE}`); process.exit(2);
}

await browser.close();
if (KNOWNBAD) console.log(bad ? `\n🔴 KNOWN-BAD FAILED (${bad})` : '\n✓ known-bad holds');
process.exit(bad ? 1 : 0);
