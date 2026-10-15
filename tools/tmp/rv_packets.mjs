#!/usr/bin/env node
/**
 * RV_PACKETS — the blind critic packets for one round of the graphics campaign (protocol
 * `rv/1`), built from one `rv_capture.mjs` output directory.
 *
 *   node tools/tmp/rv_packets.mjs --cap shots/rv/r0/cap --round shots/rv/r0
 *   node tools/tmp/rv_packets.mjs --verify shots/rv/r0          # re-audit a built round
 *   node tools/tmp/rv_packets.mjs --selftest                     # offline logic checks
 *
 * ── THE DESIGN IS q1_packets.mjs'S, AND SO IS THE BUILDER ──────────────────────────
 * Every NEW and CONTROL sheet is built by `tools/review.mjs --rubric canonical --critics 1
 * --plates <ONE plate>` exactly as q1_packets.mjs calls it: the capture gate (`vouch`), the
 * compositor (`tools/compare.mjs`, height 1000, coin-flipped A/B) and the canonical rubric are
 * the shipped ones, not copies. One fixed image of ours per element, a DIFFERENT reference
 * plate per sheet, round-robin inside the element's category.
 *
 * ── WHAT IS DIFFERENT, AND WHY ──────────────────────────────────────────────────
 *  1. 🚨 THE KEY IS NOT BESIDE THE SHEET. review.mjs writes `sheet_1.key.json` (and a
 *     `manifest.json` naming `ours`) into the SAME directory as `sheet_1.png`, so a critic
 *     handed `.../q1-arena-c3/sheet_1.png` holds the answer key one `ls` away, and the
 *     directory name tells it the element. Here review.mjs builds into `<round>/build/<id>/`
 *     and only the sheet is copied out, under a random opaque name, into the flat
 *     `<round>/packets/`, which holds nothing else but the rubric. Key + provenance live in
 *     `<round>/build/rv-packets.json`, which the orchestrator reads and critics never see.
 *  2. THE DRIFT ARM IS COPIED, NOT REFERENCED BY PATH. The 2026-08-05 sheets sit in
 *     `shots/review/baseline/<el>-c<n>/` next to their own keys, so handing a critic that
 *     path would leak the key. They are copied BYTE-FOR-BYTE (sha256 asserted equal to the
 *     source AND to the hash `q1-manifest.json` recorded on 2026-08-12) — never rebuilt,
 *     because compare.mjs coin-flips the slot and a rebuild is a different sheet.
 *  3. 🚨 `zb_home` CARRIES URI'S ACCOUNT STRINGS. CLAUDE.md: *"those strings must never appear
 *     in a report, a PACKET, or a committed file."* (review.mjs's CATEGORY_NOTES only says
 *     "never reproduce them", and the 2026-08-05 `home2` packets composited the plate raw.)
 *     So every sheet whose plate is `zb_home` has three identity regions — the account-name
 *     region, the sign-in toast, the status bubble — Gaussian-blurred ON THE COMPOSITE after
 *     review.mjs built it, at coordinates mapped from plate space through compare.mjs's own
 *     layout. Only coordinates are recorded; what the regions say is not, anywhere.
 *  4. The menu frames are the PHONE-GEOMETRY captures (`home_phone`, `select_phone`,
 *     2556x1179) by default, because the menu plates are 2556x1179 phone screenshots and
 *     review.mjs's CATEGORY_NOTES requires the same aspect; `--menu-variant desktop` uses
 *     the 1600x900 frames instead.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CURATED = join(ROOT, 'reference/images/curated');

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

export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
export const cycle = (arr, k) => Array.from({ length: k }, (_, i) => arr[i % arr.length]);

/** The plates of a category, as review.mjs lists them (same filter), sorted. */
export function platesOf(category) {
  const dir = join(CURATED, category);
  if (!existsSync(dir)) throw new Error(`rv_packets: no curated category ${category}`);
  const refs = readdirSync(dir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort();
  if (refs.length === 0) throw new Error(`rv_packets: ${category} is empty — a round-robin over [] builds nothing`);
  return refs;
}

// ── compare.mjs's layout, restated so a plate-space box can be found on the sheet ──
// tools/compare.mjs: GAP = 24, LABEL_H = 64, images at top = GAP + LABEL_H, slot A at
// x = GAP, slot B at x = GAP + wA + GAP, every image resized to `height` (1000) with
// `fit: contain`. --selftest asserts these against compare.mjs's source.
export const LAYOUT = { GAP: 24, LABEL_H: 64, HEIGHT: 1000 };

/**
 * The account-string regions of `zb_home` in PLATE pixels (2556x1179). Roles only:
 *   identity-name   the account-name text beside the level badge, top-left
 *   signin-toast    the platform sign-in notice, top-centre
 *   status-bubble   the short status bubble above the empty party slot
 * Generous on purpose; --selftest checks they are inside the plate.
 */
export const ZB_HOME_REDACT = [
  { role: 'identity-name', x: 300, y: 18, w: 180, h: 92 },
  { role: 'signin-toast', x: 1010, y: 40, w: 545, h: 205 },
  { role: 'status-bubble', x: 925, y: 405, w: 270, h: 105 },
];

/**
 * 🚨 `bs_home` CARRIES AN IDENTITY STRING TOO, and until 2026-10-15 this file blurred only
 * `zb_home`. Found by the revamp's menu package (U1), which read the plate rather than this
 * file's header. In PLATE pixels (2556x1179), roles only:
 *   identity-name   the profile-name label under the avatar, top-left
 * Generous on purpose (the label is ~45x31 px inside this box). The other menu plates —
 * `menus_select/{bs_character_detail,bs_roster_grid,zb_character_detail}` — were LOOKED AT the
 * same day: game content and currency/trophy counts only, no identity string.
 */
export const BS_HOME_REDACT = [
  { role: 'identity-name', x: 200, y: 112, w: 140, h: 62 },
];

/** Every plate that needs blurring, by file name. A plate absent here is composited as-is. */
export const PLATE_REDACT = { 'zb_home.png': ZB_HOME_REDACT, 'bs_home.png': BS_HOME_REDACT };

/** Map plate-space boxes onto the sheet, given which slot the plate occupies. */
export async function redactionBoxes(sheetMeta, { oursPath, refPath, refSlot }) {
  const plateBoxes = PLATE_REDACT[basename(refPath)];
  if (!plateBoxes) throw new Error(`rv_packets: no redaction table for ${basename(refPath)}`);
  const widthAt = async (p) => (await sharp(p).resize({ height: LAYOUT.HEIGHT, fit: 'contain', background: { r: 22, g: 16, b: 31, alpha: 1 } }).png().toBuffer({ resolveWithObject: true })).info.width;
  const [wOurs, wRef] = await Promise.all([widthAt(oursPath), widthAt(refPath)]);
  const wA = refSlot === 'A' ? wRef : wOurs;
  const left = refSlot === 'A' ? LAYOUT.GAP : LAYOUT.GAP + wA + LAYOUT.GAP;
  const top = LAYOUT.GAP + LAYOUT.LABEL_H;
  const pm = await sharp(refPath).metadata();
  const scale = LAYOUT.HEIGHT / pm.height;
  const expectW = LAYOUT.GAP * 3 + wOurs + wRef;
  if (sheetMeta.width !== expectW || sheetMeta.height !== LAYOUT.HEIGHT + LAYOUT.LABEL_H + LAYOUT.GAP * 2) {
    throw new Error(`rv_packets: sheet is ${sheetMeta.width}x${sheetMeta.height}, layout predicts ${expectW}x${LAYOUT.HEIGHT + LAYOUT.LABEL_H + LAYOUT.GAP * 2} — compare.mjs changed; refusing to guess where the plate is`);
  }
  return plateBoxes.map((b) => ({
    role: b.role,
    left: Math.max(0, Math.floor(left + b.x * scale)),
    top: Math.max(0, Math.floor(top + b.y * scale)),
    width: Math.ceil(b.w * scale),
    height: Math.ceil(b.h * scale),
  }));
}

export async function blurBoxes(sheetPath, boxes, sigma = 14) {
  const base = sharp(sheetPath);
  const comps = [];
  for (const b of boxes) {
    // eslint-disable-next-line no-await-in-loop
    const patch = await sharp(sheetPath).extract({ left: b.left, top: b.top, width: b.width, height: b.height }).blur(sigma).toBuffer();
    comps.push({ input: patch, left: b.left, top: b.top });
  }
  const buf = await base.composite(comps).png().toBuffer();
  writeFileSync(sheetPath, buf);
}

/**
 * A BALANCED slot design for one element: half the sheets put ours in A, half in B (the odd
 * one random), shuffled with crypto randomness, and a plate that repeats inside the element
 * never gets the same slot twice (so a repeat is a second OBSERVATION, not a byte-identical
 * twin). compare.mjs still flips its own coin; the builder re-runs review.mjs until the coin
 * lands on the design (expected 2 tries). Why: q1's "position bias 0.00" was measured on an
 * older critic model, and the first r0 build came out 32 A / 18 B with three identical
 * bs_home sheets — a position bias in today's model would have been confounded with the
 * element. Balanced per element, it cancels inside every element mean.
 */
const cryptoRandom = () => randomBytes(4).readUInt32BE(0) / 2 ** 32;
export function balancedSlots(plates, rnd = cryptoRandom) {
  const k = plates.length;
  if (k === 0) throw new Error('balancedSlots: no sheets');
  for (let tries = 0; tries < 1000; tries++) {
    const nA = Math.floor(k / 2) + (k % 2 && rnd() < 0.5 ? 1 : 0);
    const s = Array.from({ length: k }, (_, i) => (i < nA ? 'A' : 'B'));
    for (let i = k - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    const groups = new Map();
    plates.forEach((p, i) => groups.set(p, [...(groups.get(p) ?? []), s[i]]));
    if ([...groups.values()].every((g) => g.length < 2 || new Set(g).size === 2)) return s;
  }
  throw new Error(`balancedSlots: no balanced assignment for ${plates.join(',')}`);
}

// ── q1_packets.mjs's ctl_low recipe, unchanged ──
export async function degrade(src, dst) {
  await sharp(src).blur(3.5).modulate({ saturation: 0.45, brightness: 1.12 }).linear(0.72, 40).png().toFile(dst);
}

/** `<round>-<10 random hex>`: names the round and nothing else — not the arm, element or slot. */
const newId = (taken, round) => {
  for (;;) {
    const id = `${round}-${randomBytes(5).toString('hex')}`;
    if (!taken.has(id)) { taken.add(id); return id; }
  }
};
export const ROUND_RE = /^[a-z0-9]{1,12}$/;
export const sheetNameRe = (round) => new RegExp(`^${round}-[0-9a-f]{10}\\.png$`);

// ═════════════════════════════════════════════════════════════════════════════
// BUILD
// ═════════════════════════════════════════════════════════════════════════════

async function build(args) {
  const CAP = resolve(args.cap ?? join(ROOT, 'shots/rv/r0/cap'));
  const ROUND = resolve(args.round ?? join(ROOT, 'shots/rv/r0'));
  const MENU = String(args['menu-variant'] ?? 'phone');
  if (!['phone', 'desktop'].includes(MENU)) throw new Error('--menu-variant phone|desktop');
  const RNAME = basename(ROUND);
  if (!ROUND_RE.test(RNAME)) throw new Error(`rv_packets: round directory name "${RNAME}" must match ${ROUND_RE} (it prefixes every sheet name)`);
  const STAGE = join(ROUND, 'stage');
  const BUILD = join(ROUND, 'build');
  const PACK = join(ROUND, 'packets');
  if (existsSync(PACK) && readdirSync(PACK).length && !args.force) {
    throw new Error(`rv_packets: ${PACK} is not empty — a round's packets are built ONCE (pass --force to rebuild, which re-rolls every A/B slot)`);
  }
  for (const d of [STAGE, BUILD, PACK]) mkdirSync(d, { recursive: true });
  if (args.force) {
    for (const f of readdirSync(PACK)) rmSync(join(PACK, f), { recursive: true, force: true });
    for (const f of readdirSync(BUILD)) rmSync(join(BUILD, f), { recursive: true, force: true });
  }

  // ── our frames, and the provenance each must carry ──
  const frame = (n) => {
    const p = join(CAP, `${n}.png`);
    if (!existsSync(p) || !existsSync(`${p}.capture.json`)) throw new Error(`rv_packets: missing ${p} or its sidecar`);
    const sc = JSON.parse(readFileSync(`${p}.capture.json`, 'utf8'));
    if (sc.painted !== true) throw new Error(`rv_packets: ${p} sidecar says painted=${sc.painted}`);
    if (sc.rv?.nonCanonical) throw new Error(`rv_packets: ${p} was captured with --debug-at (non-canonical)`);
    return { path: p, sidecar: sc, sha256: sha256File(p) };
  };
  const ours = {
    arena: frame('arena'),
    arena6: frame('arena6'),
    cast: frame('cast'),
    home: frame(MENU === 'phone' ? 'home_phone' : 'home'),
    select: frame(MENU === 'phone' ? 'select_phone' : 'select'),
  };

  // hs_hudguard over the match frames — the packet-level belt q1_capture runs.
  const { verifyPacket, printChecks } = await import('./hs_hudguard.mjs');
  const hv = verifyPacket(['arena', 'arena6'].map((n) => ({ file: `${n}.png`, sidecar: ours[n].sidecar })));
  printChecks(hv, '  ');
  if (!hv.ok) throw new Error('rv_packets: hs_hudguard --verify refused a match frame');

  // ── controls ──
  const ctlHighSrc = join(CURATED, 'gameplay_topdown/bs_05.png');
  const ctlHigh = join(STAGE, 'ctl_high.png');
  copyFileSync(ctlHighSrc, ctlHigh);
  const q1High = join(ROOT, 'shots/q1/stage/ctl_high.png');
  const ctlHighSame = existsSync(q1High) ? sha256File(q1High) === sha256File(ctlHigh) : null;
  const ctlLow = join(STAGE, 'ctl_low.png');
  await degrade(ours.arena.path, ctlLow);
  writeFileSync(`${ctlLow}.capture.json`, JSON.stringify({
    tool: 'rv_packets', label: 'DEGRADED CONTROL — not a product image', takenAt: new Date().toISOString(),
    painted: ours.arena.sidecar.painted === true, enforced: false,
    derivedFrom: { path: ours.arena.path, sha256: ours.arena.sha256, degrade: 'blur 3.5 + saturation 0.45 + brightness 1.12 + linear(0.72,40) (q1_packets recipe)' },
    stats: null, before: ours.arena.sidecar.before, after: ours.arena.sidecar.after,
  }, null, 2));

  const TD = platesOf('gameplay_topdown');
  const CAST = platesOf('topdown_cast');
  const HOME = platesOf('menus_home');
  const SEL = platesOf('menus_select');
  const ELEMENTS = [
    { arm: 'new', element: 'arena', ours: ours.arena.path, category: 'gameplay_topdown', plates: cycle(TD, 8) },
    { arm: 'new', element: 'arena6', ours: ours.arena6.path, category: 'gameplay_topdown', plates: cycle(TD, 8) },
    { arm: 'new', element: 'cast', ours: ours.cast.path, category: 'topdown_cast', plates: cycle(CAST, 8) },
    { arm: 'new', element: 'home', ours: ours.home.path, category: 'menus_home', plates: cycle(HOME, 6) },
    { arm: 'new', element: 'select', ours: ours.select.path, category: 'menus_select', plates: cycle(SEL, 6) },
    // q1_packets' control plates: ctl_high never against its own source plate (bs_05).
    { arm: 'ctl_high', element: 'ctl_high', ours: ctlHigh, category: 'gameplay_topdown', plates: ['bs_02.png', 'bs_04.png', 'bs_06.png'], extra: ['--allow-unverified'] },
    { arm: 'ctl_low', element: 'ctl_low', ours: ctlLow, category: 'gameplay_topdown', plates: ['bs_01.png', 'bs_03.png', 'bs_05.png'] },
  ];

  const taken = new Set();
  const sheets = [];
  for (const el of ELEMENTS) {
    const design = balancedSlots(el.plates);
    for (let i = 0; i < el.plates.length; i++) {
      const plate = el.plates[i];
      const id = newId(taken, RNAME);
      const dir = join(BUILD, id);
      let key = null; let man = null; let oursSlot = null; let tries = 0;
      while (tries < 40) {
        tries++;
        rmSync(dir, { recursive: true, force: true });
        execFileSync('node', ['tools/review.mjs', '--ours', el.ours, '--category', el.category, '--plates', plate,
          '--rubric', 'canonical', '--critics', '1', '--out', dir, ...(el.extra ?? [])], { stdio: ['ignore', 'ignore', 'pipe'], cwd: ROOT });
        key = JSON.parse(readFileSync(join(dir, 'sheet_1.key.json'), 'utf8'));
        man = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
        oursSlot = key.A === 'ours' ? 'A' : key.B === 'ours' ? 'B' : null;
        if (!oursSlot || (key.A === 'ours') === (key.B === 'ours')) throw new Error(`rv_packets: malformed key in ${dir}`);
        if (oursSlot === design[i]) break;
      }
      if (oursSlot !== design[i]) throw new Error(`rv_packets: compare.mjs never landed ${design[i]} for ${el.element} c${i + 1} in ${tries} tries`);
      const built = join(dir, 'sheet_1.png');
      let redaction = null;
      if (PLATE_REDACT[plate]) {
        const meta = await sharp(built).metadata();
        const boxes = await redactionBoxes(meta, { oursPath: el.ours, refPath: join(CURATED, el.category, plate), refSlot: oursSlot === 'A' ? 'B' : 'A' });
        await blurBoxes(built, boxes);
        redaction = { plate, boxesPlatePx: PLATE_REDACT[plate], boxesSheetPx: boxes, sigma: 14, why: 'CLAUDE.md: a menu plate\'s identity strings must never appear in a packet' };
      }
      const pub = join(PACK, `${id}.png`);
      copyFileSync(built, pub);
      sheets.push({
        sheetId: id, arm: el.arm, element: el.element, critic: i + 1, refPlate: `${el.category}/${plate}`,
        category: el.category, oursSlot, sheetPath: pub, sha256: sha256File(pub), buildDir: dir,
        ours: el.ours, oursSha256: sha256File(el.ours), verified: man.capture?.verified ?? null,
        overrides: man.capture?.overrides ?? [], rubricSource: man.rubricSource, redaction, slotDesign: design[i], coinTries: tries,
      });
      console.log(`  ${el.arm.padEnd(8)} ${el.element.padEnd(8)} c${i + 1} ${plate.padEnd(24)} -> ${basename(pub)}`);
    }
  }

  // ── drift: the 2026-08-05 sheets, copied byte-for-byte, c1..c4 per element ──
  const q1m = existsSync(join(ROOT, 'shots/review/q1-manifest.json'))
    ? JSON.parse(readFileSync(join(ROOT, 'shots/review/q1-manifest.json'), 'utf8')) : null;
  const q1Hash = (src) => q1m?.assignments?.find((a) => a.arm === 'drift' && a.sheet === src)?.sheetSha256 ?? null;
  for (const el of ['arena', 'cast']) {
    for (const n of [1, 2, 3, 4]) {
      const srcDir = join(ROOT, `shots/review/baseline/${el}-c${n}`);
      const src = join(srcDir, 'sheet_1.png');
      const key = JSON.parse(readFileSync(join(srcDir, 'sheet_1.key.json'), 'utf8'));
      const man = JSON.parse(readFileSync(join(srcDir, 'manifest.json'), 'utf8'));
      const id = newId(taken, RNAME);
      const pub = join(PACK, `${id}.png`);
      copyFileSync(src, pub);
      const h = sha256File(pub);
      const hs = sha256File(src);
      const hq = q1Hash(src);
      if (h !== hs) throw new Error(`rv_packets: drift copy of ${src} is not byte-identical`);
      if (hq && hq !== h) throw new Error(`rv_packets: ${src} no longer matches the hash q1 recorded on 2026-08-12`);
      sheets.push({
        sheetId: id, arm: 'drift', element: `drift_${el}`, critic: n, refPlate: `${man.category}/${man.plates?.[0]}`,
        category: man.category, oursSlot: key.A === 'ours' ? 'A' : 'B', sheetPath: pub, sha256: h,
        source: src, sourceSha256: hs, q1RecordedSha256: hq, byteIdenticalToQ1Record: hq ? hq === h : null,
        rubricSource: man.rubricSource ?? null, verified: man.capture?.verified ?? null,
      });
      console.log(`  drift    drift_${el.padEnd(4)} c${n} ${String(man.plates?.[0]).padEnd(24)} -> ${basename(pub)}  (copy of baseline/${el}-c${n})`);
    }
  }

  // ── the rubric the critic is pasted, exactly as review.mjs writes it ──
  const rub = readdirSync(BUILD).map((d) => join(BUILD, d, 'RUBRIC.txt')).find((p) => existsSync(p));
  copyFileSync(rub, join(PACK, 'RUBRIC.txt'));

  const manifest = {
    protocol: 'rv/1',
    builtAt: new Date().toISOString(),
    builtBy: 'tools/tmp/rv_packets.mjs',
    builderSha256: sha256File(fileURLToPath(import.meta.url)),
    repoHeadAtBuild: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
    capture: {
      dir: CAP,
      tree: ours.arena.sidecar.rv?.tree ?? null,
      served: ours.arena.sidecar.rv?.served ?? null,
      menuVariant: MENU,
      frames: Object.fromEntries(Object.entries(ours).map(([k, v]) => [k, { path: v.path, sha256: v.sha256 }])),
    },
    rubric: { path: 'tools/review.rubric.txt', sha256: sha256File(join(ROOT, 'tools/review.rubric.txt')), packetCopy: join(PACK, 'RUBRIC.txt') },
    controls: { ctlHighSource: ctlHighSrc, ctlHighSameAsQ1Stage: ctlHighSame, ctlLowRecipe: 'q1_packets.mjs' },
    counts: sheets.reduce((m, s) => ({ ...m, [s.element]: (m[s.element] ?? 0) + 1 }), {}),
    floors: {
      note: 'review.mjs:resolutionFloor = 1.96*sqrt(2)*0.50/sqrt(k); between two arms 1.96*0.50*sqrt(1/k1+1/k2). σ=0.50 is the PUBLISHED value; q1_sigma measured 0.649 in 2026-08 (docs/STATE.md §2) — re-measure on r0.',
      k3: +(1.96 * Math.SQRT2 * 0.5 / Math.sqrt(3)).toFixed(3),
      k4: +(1.96 * Math.SQRT2 * 0.5 / Math.sqrt(4)).toFixed(3),
      k6: +(1.96 * Math.SQRT2 * 0.5 / Math.sqrt(6)).toFixed(3),
      k8: +(1.96 * Math.SQRT2 * 0.5 / Math.sqrt(8)).toFixed(3),
    },
    sheets,
  };
  writeFileSync(join(BUILD, 'rv-packets.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n${sheets.length} sheets -> ${PACK}\nkey + provenance (orchestrator only) -> ${join(BUILD, 'rv-packets.json')}`);
  const v = verify(ROUND);
  if (!v.ok) process.exitCode = 1;
}

// ═════════════════════════════════════════════════════════════════════════════
// VERIFY — re-derive the round's blindness and integrity from disk
// ═════════════════════════════════════════════════════════════════════════════

export function verify(ROUND) {
  const PACK = join(ROUND, 'packets');
  const man = JSON.parse(readFileSync(join(ROUND, 'build/rv-packets.json'), 'utf8'));
  const checks = [];
  const add = (ok, name, detail = '') => checks.push({ ok: !!ok, name, detail });
  const files = readdirSync(PACK);
  add(man.sheets.length > 0, 'the manifest lists sheets (non-empty before asserting over it)', `${man.sheets.length}`);
  add(files.filter((f) => f.endsWith('.png')).length === man.sheets.length, 'packets/ holds exactly the manifest\'s sheets', `${files.length} files`);
  const nameRe = sheetNameRe(basename(ROUND));
  add(files.every((f) => f === 'RUBRIC.txt' || nameRe.test(f)), 'packets/ holds ONLY opaque sheets + RUBRIC.txt (no key, no manifest)', files.filter((f) => f !== 'RUBRIC.txt' && !nameRe.test(f)).join(','));
  const leak = /ours|ref|key|arena|cast|home|select|ctl|drift|high|low/i;
  add(man.sheets.every((s) => !leak.test(basename(s.sheetPath))), 'no sheet filename names an arm, element or slot', '');
  let shaBad = 0;
  for (const s of man.sheets) if (!existsSync(s.sheetPath) || sha256File(s.sheetPath) !== s.sha256) shaBad++;
  add(shaBad === 0, 'every sheet on disk matches its recorded sha256', `${shaBad} mismatched`);
  // Byte-identical twins are EXPECTED where a plate repeats inside an element and the coin
  // flip agreed (q1_packets: "two critics see one identical file, which is the sd-0.50 design").
  // A twin across DIFFERENT (element, plate) pairs would be a build error.
  const byHash = new Map();
  for (const s of man.sheets) byHash.set(s.sha256, [...(byHash.get(s.sha256) ?? []), s]);
  const twins = [...byHash.values()].filter((g) => g.length > 1);
  const badTwins = twins.filter((g) => new Set(g.map((s) => `${s.element}|${s.refPlate}`)).size > 1);
  add(badTwins.length === 0, 'identical sheets only ever share (element, plate) — twins are the round-robin design',
    `${twins.length} twin group(s): ${twins.map((g) => `${g[0].element}/${basename(g[0].refPlate)}x${g.length}`).join(', ') || 'none'}`);
  const want = { arena: 8, arena6: 8, cast: 8, home: 6, select: 6, ctl_high: 3, ctl_low: 3, drift_arena: 4, drift_cast: 4 };
  for (const [el, n] of Object.entries(want)) add((man.counts[el] ?? 0) === n, `${el} x${n}`, `${man.counts[el] ?? 0}`);
  const drift = man.sheets.filter((s) => s.arm === 'drift');
  add(drift.length === 8 && drift.every((s) => s.sha256 === s.sourceSha256 && existsSync(s.source) && sha256File(s.source) === s.sha256),
    'drift sheets are byte-identical to their 2026-08-05 sources', '');
  add(drift.every((s) => s.byteIdenticalToQ1Record === true), 'drift sheets match the sha256 q1 recorded on 2026-08-12', drift.map((s) => s.byteIdenticalToQ1Record).join(','));
  // Per redacted plate. A home element round-robins over BOTH home plates, so when the
  // manifest has home sheets, each plate's set must be NON-EMPTY before `every` is believed
  // (an empty set passes `every` — CLAUDE.md rule 6's vacuity).
  const hasHome = man.sheets.some((s) => /^menus_home\//.test(s.refPlate));
  for (const [plate, boxes] of Object.entries(PLATE_REDACT)) {
    const ss = man.sheets.filter((s) => basename(s.refPlate) === plate);
    add((!hasHome || ss.length > 0) && ss.every((s) => s.redaction && s.redaction.boxesSheetPx?.length === boxes.length),
      `every ${plate.replace('.png', '')} sheet carries its ${boxes.length} redaction(s)`, `${ss.length} sheets`);
  }
  const rubric = readFileSync(join(ROOT, 'tools/review.rubric.txt'));
  add(readFileSync(join(PACK, 'RUBRIC.txt')).subarray(0, rubric.length).equals(rubric), 'packets/RUBRIC.txt is the canonical rubric byte-for-byte', '');
  add(man.sheets.filter((s) => s.arm === 'new' || s.arm === 'ctl_low').every((s) => s.verified === true), 'every NEW/ctl_low sheet was VERIFIED by review.mjs\'s capture gate', '');
  for (const el of ['arena', 'arena6', 'cast', 'home', 'select']) {
    const ss = man.sheets.filter((s) => s.element === el);
    const plates = new Set(ss.map((s) => s.refPlate));
    const library = ss.length ? platesOf(ss[0].category).length : 0;
    const expected = Math.min(ss.length, library);
    // Round-robin: every plate of the category is used before any repeats, and no two
    // CONSECUTIVE critics of an element see the same plate.
    const consecutive = ss.some((s, i) => i > 0 && s.refPlate === ss[i - 1].refPlate);
    add(ss.length > 0 && plates.size === expected && !consecutive,
      `${el}: reference plates round-robin (${plates.size} distinct of ${library} over ${ss.length} sheets)`, '');
  }
  const slots = man.sheets.reduce((m, s) => ({ ...m, [s.oursSlot]: (m[s.oursSlot] ?? 0) + 1 }), {});
  const unbalanced = [...new Set(man.sheets.filter((s) => s.arm !== 'drift').map((s) => s.element))].filter((el) => {
    const ss = man.sheets.filter((s) => s.element === el);
    const a = ss.filter((s) => s.oursSlot === 'A').length;
    return Math.abs(a - (ss.length - a)) > 1;
  });
  add(unbalanced.length === 0, 'ours-slot is balanced (|A-B| <= 1) inside every built element; drift keeps its 2026-08-05 slots',
    `${JSON.stringify(slots)}${unbalanced.length ? ` UNBALANCED: ${unbalanced.join(',')}` : ''}`);
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} - ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
  const n = checks.filter((c) => c.ok).length;
  console.log(`\n${n === checks.length ? '✅ PASS' : '🔴 FAIL'}  rv_packets verify: ${n}/${checks.length}`);
  return { ok: n === checks.length, checks };
}

// ═════════════════════════════════════════════════════════════════════════════
// SELFTEST
// ═════════════════════════════════════════════════════════════════════════════

async function selftest() {
  const checks = [];
  const add = (ok, name, detail = '') => checks.push({ ok: !!ok, name, detail });
  // compare.mjs's layout constants are what this file restates
  const cmp = readFileSync(join(ROOT, 'tools/compare.mjs'), 'utf8');
  const num = (re) => Number((re.exec(cmp) ?? [])[1]);
  add(num(/const GAP = (\d+);/) === LAYOUT.GAP && num(/const LABEL_H = (\d+);/) === LAYOUT.LABEL_H,
    'LAYOUT agrees with tools/compare.mjs (GAP, LABEL_H)', `${num(/const GAP = (\d+);/)} ${num(/const LABEL_H = (\d+);/)}`);
  const rev = readFileSync(join(ROOT, 'tools/review.mjs'), 'utf8');
  add(/'--height', String\(args\.height \?\? 1000\)/.test(rev), 'review.mjs still composes at height 1000', '');
  add(/sheet_\$\{i \+ 1\}\.key\.json/.test(rev), 'review.mjs still writes the key BESIDE the sheet (the reason packets/ exists)', '');
  // round-robin
  add(JSON.stringify(cycle(['a', 'b'], 6)) === JSON.stringify(['a', 'b', 'a', 'b', 'a', 'b']), 'cycle round-robins', '');
  let threw = false;
  try { platesOf('no_such_category'); } catch { threw = true; }
  add(threw, 'KNOWN-BAD: a missing category throws rather than building nothing', '');
  // redaction geometry on a synthetic sheet laid out exactly like compare.mjs's
  const tmp = join(ROOT, 'shots/rv/r0/.selftest_packets');
  mkdirSync(tmp, { recursive: true });
  // Every home plate must have been LOOKED AT for identity strings: both carry one today, and
  // a plate added later would otherwise be composited raw without anyone deciding it is clean.
  const homePlates = platesOf('menus_home');
  add(homePlates.length > 0 && homePlates.every((f) => PLATE_REDACT[f]), 'every menus_home plate has a redaction table', `${homePlates.join(', ')}`);
  let threwNoTable = false;
  try { await redactionBoxes({ width: 0, height: 0 }, { oursPath: '', refPath: join(CURATED, 'menus_select/bs_roster_grid.png'), refSlot: 'A' }); } catch { threwNoTable = true; }
  add(threwNoTable, 'KNOWN-BAD: a plate with no table refuses rather than returning no boxes', '');
  try {
    const ours = join(tmp, 'ours.png');
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 10, g: 200, b: 10 } } }).png().toFile(ours);
    const sheet = join(tmp, 'sheet.png');
    const key = join(tmp, 'sheet.key.json');
    // compare.mjs flips its own coin for the slot, so a check run on "whichever side it
    // landed" covers ONE side per run and its known-bad can be blind by chance: bs_home's only
    // box sits at the plate's LEFT edge, and with the reference in A a mirrored mapping still
    // lands on the reference panel. So each plate is built with the reference in A AND in B
    // (re-flipping, as the builder does), and the mirror known-bad runs where it can fire.
    const buildWithRefIn = (want) => {
      for (let t = 0; t < 40; t++) {
        execFileSync('node', ['tools/compare.mjs', '--ours', ours, '--ref', CUR_PLATE, '--out', sheet, '--key', key, '--height', '1000'], { cwd: ROOT, stdio: 'ignore' });
        const k = JSON.parse(readFileSync(key, 'utf8'));
        if ((k.A === 'reference' ? 'A' : 'B') === want) return true;
      }
      return false;
    };
    let CUR_PLATE = '';
    for (const [plateName, plateBoxes] of Object.entries(PLATE_REDACT)) {
      const plate = join(CURATED, 'menus_home', plateName);
      CUR_PLATE = plate;
      const tag = plateName.replace('.png', '');
      const pm = await sharp(plate).metadata();
      add(plateBoxes.length > 0 && plateBoxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= pm.width && b.y + b.h <= pm.height), `${tag}: redaction boxes lie inside the 2556x1179 plate`, `${pm.width}x${pm.height}`);
      for (const refSlot of ['A', 'B']) {
        const landed = buildWithRefIn(refSlot);
        const meta = await sharp(sheet).metadata();
        const boxes = landed ? await redactionBoxes(meta, { oursPath: ours, refPath: plate, refSlot }) : [];
        // The boxes must land on the PLATE (not on our green panel): sample each box centre.
        const raw = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const px = (x, y) => { const i = (y * raw.info.width + x) * raw.info.channels; return [raw.data[i], raw.data[i + 1], raw.data[i + 2]]; };
        const isOurs = (b) => { const [r, g, bb] = px(b.left + (b.width >> 1), b.top + (b.height >> 1)); return r === 10 && g === 200 && bb === 10; };
        const onOurs = boxes.filter(isOurs);
        add(landed && boxes.length > 0 && onOurs.length === 0, `${tag}, reference in ${refSlot}: redaction boxes land on the reference panel, not on ours`, `${boxes.length} boxes, ${onOurs.length} on ours`);
        if (refSlot === 'B') {
          // KNOWN-BAD: the mirrored slot (A) maps every box onto OUR panel, which spans the left
          // of the sheet — proves the check above can fail. Deterministic with the plate in B.
          const wrong = await redactionBoxes(meta, { oursPath: ours, refPath: plate, refSlot: 'A' });
          const wrongOnOurs = wrong.filter(isOurs);
          add(wrong.length > 0 && wrongOnOurs.length === wrong.length, `${tag}: KNOWN-BAD: the mirrored slot puts every box on OUR panel, so the check above fires`, `${wrongOnOurs.length}/${wrong.length}`);
          // the blur changes the boxes and nothing else
          const before = readFileSync(sheet);
          await blurBoxes(sheet, boxes);
          const a = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const b2 = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          let inside = 0; let outside = 0;
          const inBox = (x, y) => boxes.some((bx) => x >= bx.left && x < bx.left + bx.width && y >= bx.top && y < bx.top + bx.height);
          for (let y = 0; y < a.info.height; y += 2) for (let x = 0; x < a.info.width; x += 2) {
            const i = (y * a.info.width + x) * a.info.channels;
            const d = Math.abs(a.data[i] - b2.data[i]) + Math.abs(a.data[i + 1] - b2.data[i + 1]) + Math.abs(a.data[i + 2] - b2.data[i + 2]);
            if (d) { if (inBox(x, y)) inside++; else outside++; }
          }
          add(inside > 0 && outside === 0, `${tag}: blur moves pixels INSIDE the boxes and none outside`, `${inside} inside, ${outside} outside (2px lattice)`);
        }
      }
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  // balanced design
  const td8 = cycle(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], 8);
  let okBal = true;
  for (let t = 0; t < 200; t++) {
    const d = balancedSlots(td8);
    const a = d.filter((x) => x === 'A').length;
    if (a !== 4 || d[0] === d[6] || d[1] === d[7]) okBal = false;
  }
  add(okBal, 'balancedSlots: 8 sheets -> 4A/4B and a repeated plate never shares a slot (200 draws)', '');
  const odd = Array.from({ length: 400 }, () => balancedSlots(['x', 'y', 'z']).filter((v) => v === 'A').length);
  add(odd.every((n) => n === 1 || n === 2) && odd.includes(1) && odd.includes(2), 'balancedSlots: 3 sheets -> 1 or 2 in A, both occur', '');
  const tri = Array.from({ length: 200 }, () => balancedSlots(cycle(['h1', 'h2'], 6)));
  add(tri.every((d) => new Set([d[0], d[2], d[4]]).size === 2 && new Set([d[1], d[3], d[5]]).size === 2), 'balancedSlots: a plate used 3x is never 3x the same slot', '');
  let threwBal = false;
  try { balancedSlots([]); } catch { threwBal = true; }
  add(threwBal, 'KNOWN-BAD: an empty element throws', '');
  // degrade recipe = q1_packets'
  const q1p = readFileSync(join(ROOT, 'tools/tmp/q1_packets.mjs'), 'utf8');
  add(/\.blur\(3\.5\)\s*\n\s*\.modulate\(\{ saturation: 0\.45, brightness: 1\.12 \}\)\s*\n\s*\.linear\(0\.72, 40\)/.test(q1p), 'ctl_low recipe matches q1_packets.mjs byte-for-byte', '');
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} - ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
  const n = checks.filter((c) => c.ok).length;
  console.log(`\n${n === checks.length ? '✅ PASS' : '🔴 FAIL'}  rv_packets selftest: ${n}/${checks.length}`);
  return n === checks.length;
}

const isMain = (() => { try { return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  const args = parseArgs(process.argv);
  try {
    if (args.selftest) process.exitCode = (await selftest()) ? 0 : 1;
    else if (args.verify) process.exitCode = verify(resolve(String(args.verify))).ok ? 0 : 1;
    else await build(args);
  } catch (e) {
    console.error(String(e && e.stack || e));
    process.exitCode = 1;
  }
}
