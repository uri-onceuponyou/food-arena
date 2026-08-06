#!/usr/bin/env node
/**
 * Writes a `tools/shoot.mjs --batch` job list for LOLLIPOP at the two shipped cameras.
 *
 * Why a generator instead of a checked-in batch file: the batch's URLs must carry the
 * snapshot's own base, and `with_snapshot.mjs` injects that as `PREVIEW_BASE` into the
 * child rather than into a file on disk. This runs inside the same snapshot, reads the
 * env, and emits the JSON `shoot.mjs` then consumes — no browser, no second driver copy.
 * (Modelled on `ch_soup_batch.mjs`; same two cameras, same reasoning.)
 *
 * The two cameras are BOTH shipped and they expose different defects (CLAUDE.md, the
 * two-camera note):
 *   pitch 20 / yaw 0  — `src/ui/screens/charStage.ts:451`, the LOBBY. What Uri judges.
 *   pitch 58 / yaw 90 — `src/render/camera.ts`, the MATCH default at the spawn facing.
 * A geometric fix has to survive both; one that improves the lobby and costs the match
 * is a repaint, not a fix.
 *
 * ⚠️ Lollipop specifically needs the BACK view too. Its disc carries a mirrored swirl on
 * its rear face, and the character's own file records round 1 shipping a blank pale oval
 * at yaw 135/210 because only the front was decorated. That regression is invisible at
 * both of the cameras above.
 *
 *   node tools/tmp/ch_lollipop_batch.mjs --out shots/ch/lollipop/after --json <path>
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/ch/lollipop/after');
const JSON_PATH = get('--json', 'tools/tmp/ch_lollipop_batch.json');

const u = (q) => `${BASE}/preview.html?piece=character&id=lollipop&shot=1&${q}`;

const jobs = [
  // LOBBY — head-on, the framing every one of Uri's reject sheets was captured at.
  { url: u('anim=idle&pitch=20&yaw=0&t=1.5'), out: `${OUT}/lobby_yaw0.png`, w: 900, h: 1150 },
  // LOBBY — three-quarter. The face reads here, and any side-of-head mass declares
  // itself as an ear/horn here (DECISIONS §40 pattern 1) if it is going to.
  { url: u('anim=idle&pitch=20&yaw=35&t=1.5'), out: `${OUT}/lobby_yaw35.png`, w: 900, h: 1150 },
  // MATCH — the shipped spawn facing (exact profile), where the silhouette metrics live
  // and where this character's disc is edge-on.
  { url: u('anim=idle&pitch=58&yaw=90&t=1.5'), out: `${OUT}/match_yaw90.png`, w: 900, h: 1150 },
  // BACK — the blank-oval regression check described above.
  { url: u('anim=idle&pitch=20&yaw=170&t=1.5'), out: `${OUT}/lobby_yaw170.png`, w: 900, h: 1150 },
];

await mkdir(dirname(JSON_PATH), { recursive: true });
await writeFile(JSON_PATH, JSON.stringify(jobs, null, 2));
console.log(`[ch_lollipop_batch] ${jobs.length} jobs -> ${JSON_PATH} (base ${BASE})`);
