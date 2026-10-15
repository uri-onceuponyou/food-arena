#!/usr/bin/env node
/**
 * B6 · META-08 in Node — the rules a two-tab fix must keep, against the REAL `profile.ts`.
 *
 * `b6_screens.mjs` §M8 is the test of record (two real tabs, the shipped UI). This file is
 * the cheap half that can reach the cases a browser cannot set up on demand, and it exists
 * because the obvious fixes are WRONG in ways a two-tab browser run would never show:
 *
 *   * a naive "re-read storage before every write" (`this.data = load()`) throws away
 *     constructor-injected data (`nw_profile.mjs`'s 2,000-match oracle diverges at match 0)
 *     and makes a private-mode session — reads null, writes throw — FORGET ITS OWN MATCHES;
 *   * "re-read and MERGE inside `commit()`" turns a lost update into a DUPLICATION: a chest
 *     claimed in one tab and opened in the other opens twice (META-08 intent verifier, F5).
 *
 * Each "tab" is one `PlayerProfile` over ONE shared fake `localStorage`, which is exactly
 * what two tabs of one origin are. `window` is faked only where the storage EVENT is under
 * test, and the event is delivered the way a browser does: to the OTHER tab, after the write.
 *
 *   node tools/tmp/b6_profile.mjs             # the shipped profile.ts — exit 0 iff every row passes
 *   node tools/tmp/b6_profile.mjs --selftest  # every row proved able to FAIL (see below)
 *
 * Rows marked 🚨 were RED on the base `f65af2c` (the defect); rows marked HOLD were green
 * there and must stay green. A HOLD row that has never been red is a comment with a tick next
 * to it, so `--selftest` bundles four KNOWN-BAD variants of the real file — text mutations,
 * each anchor asserted to match exactly once so a drifted anchor cannot pass for a clean run:
 *   `base`   the pre-fix behaviour (no re-read, no listener) → every 🚨 row red, every HOLD green;
 *   `naive`  re-read with `load()` and adopt unconditionally → N4 N5 N6 N8 red;
 *   `merge`  no re-read, MERGE held containers at commit → N9 red (the duplication);
 *   `chatty` a storage listener that re-renders on every event → N10b red.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const KEY = 'food-arena.profile.v1';
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const PROFILE = join(ROOT, 'src/ui/screens/profile.ts');
const SELFTEST = process.argv.includes('--selftest');

/**
 * Bundle `profile.ts` (or a mutated copy of its text) plus the three economy helpers the rows
 * need, as ONE module graph so the profile and the economy share one instance. A mutated copy
 * goes in through stdin with `cwd` set to the real file's directory, so its relative imports
 * resolve exactly as the shipped file's do — nothing is written into `src/`.
 */
async function bundle(source = null) {
  const dir = mkdtempSync(join(tmpdir(), 'b6-profile-'));
  const out = join(dir, 'bridge.mjs');
  const common = ['--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${out}`];
  try {
    if (source === null) {
      const entry = join(dir, 'entry.ts');
      writeFileSync(entry, [
        `export * from ${JSON.stringify(PROFILE)};`,
        `export { createEconomy, serialize, milestones } from ${JSON.stringify(join(ROOT, 'src/game/economy/index.ts'))};`,
      ].join('\n'));
      execFileSync(ESBUILD, [entry, ...common], { stdio: 'inherit' });
    } else {
      execFileSync(ESBUILD, ['--loader=ts', '--sourcefile=profile.ts', ...common], {
        cwd: join(ROOT, 'src/ui/screens'),
        input: `${source}\nexport { createEconomy, serialize, milestones } from '../../game/economy';\n`,
        stdio: ['pipe', 'inherit', 'inherit'],
      });
    }
    return await import(`${out}?v=${Date.now()}${Math.random()}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A `Storage` with the browser's semantics: strings in, strings out, null when absent. */
function makeStorage({ readable = true, writable = true } = {}) {
  const m = new Map();
  return {
    m,
    getItem(k) { if (!readable) throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (!writable) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    clear() { m.clear(); },
    get length() { return m.size; },
    key(i) { return [...m.keys()][i] ?? null; },
  };
}
const use = (storage) => { globalThis.localStorage = storage; };
const stored = (s) => { const r = s.m.get(KEY); return r ? JSON.parse(r) : null; };
const held = (blob) => Object.values(blob.economy.containers).reduce((a, b) => a + b, 0);

/** Every row, against one bundled module. Returns `[{ id, pass, detail }]`; never throws. */
function runRows(M) {
  const { PlayerProfile, createEconomy, serialize, milestones } = M;
  const rows = [];
  const ok = (id, cond, detail = '') => { rows.push({ id, pass: !!cond, detail }); };
  const row = (id, fn) => { try { fn(); } catch (err) { ok(id, false, `threw: ${String(err?.message ?? err).slice(0, 120)}`); } };

  const [N1, N2] = milestones().map((m) => m.trophies).filter((t) => t <= 70);
  const seedBlob = () => {
    const economy = serialize(createEconomy(424242));
    economy.trophies = 70; economy.bestTrophies = 70;
    return JSON.stringify({ name: 'Seed', wins: 0, losses: 0, xp: 0, selected: 'hamburger', economy });
  };
  ok('G', N1 !== undefined && N2 !== undefined, `two claimable road nodes at 70 trophies (non-vacuity): ${N1}, ${N2}`);

  row('N0', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const a = new PlayerProfile();
    a.claimMilestone(N1); a.setName('OneTab');
    const b = stored(s);
    ok('N0', b.name === 'OneTab' && b.economy.claimed.includes(N1), JSON.stringify({ name: b.name, claimed: b.economy.claimed }));
  });

  row('N1', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const a = new PlayerProfile();
    const b = new PlayerProfile(); // booted before A's claim, never reloaded
    a.claimMilestone(N1);
    b.setName('TabB');
    let st = stored(s);
    ok('N1', st.name === 'TabB' && st.economy.claimed.includes(N1) && held(st) === 1,
      JSON.stringify({ name: st.name, claimed: st.economy.claimed, held: held(st) }));
    a.claimMilestone(N2); // A is now the stale one
    st = stored(s);
    ok('N2', st.name === 'TabB' && st.economy.claimed.includes(N1) && st.economy.claimed.includes(N2),
      JSON.stringify({ name: st.name, claimed: st.economy.claimed }));
    ok('N2b', a.name === 'TabB' && a.economy.claimed.includes(N1), `A.name ${a.name}`);
  });

  row('N3', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const a = new PlayerProfile();
    const b = new PlayerProfile();
    const paid = a.recordPlacement(0, 6); // a six-seat WIN banked in tab A
    b.select('pizza');                    // tab B equips someone
    const st = stored(s);
    ok('N3', st.wins === 1 && st.economy.trophies === 70 + paid.trophies && st.selected === 'pizza',
      `wins ${st.wins} · trophies ${st.economy.trophies} (want ${70 + paid.trophies}) · selected ${st.selected}`);
  });

  row('N4', () => {
    const s = makeStorage({ writable: false }); use(s); // private mode: reads null, writes throw
    const a = new PlayerProfile();
    a.recordResult(true); a.recordResult(true); a.recordResult(true);
    ok('N4', a.wins === 3, `wins ${a.wins}`);
  });

  row('N5', () => {
    delete globalThis.localStorage; // Node, as `nw_profile.mjs` runs it
    const a = new PlayerProfile({ wins: 7, losses: 0, xp: 0, economy: createEconomy(1) });
    a.recordResult(true);
    ok('N5', a.wins === 8, `wins ${a.wins}`);
  });

  row('N6', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const a = new PlayerProfile({ wins: 40 });
    a.setName('Inj');
    ok('N6', a.wins === 40 && stored(s).wins === 40, `wins ${a.wins} · stored ${stored(s).wins}`);
  });

  row('N7', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const a = new PlayerProfile();
    a.claimMilestone(N1);      // A holds progress
    s.removeItem(KEY);         // tab B: Settings' "Reset progress" (removes the key, reloads ITSELF)
    a.setName('AfterReset');   // stale A writes next
    const st = stored(s);
    ok('N7', st.name === 'AfterReset' && st.economy.claimed.length === 0 && st.economy.trophies === 0,
      `claimed ${JSON.stringify(st.economy.claimed)} · trophies ${st.economy.trophies}`);
  });

  row('N8', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const a = new PlayerProfile();
    a.claimMilestone(N1);
    s.setItem(KEY, '{not json');
    a.setName('Repair');
    const st = stored(s);
    ok('N8', st.name === 'Repair' && st.economy.claimed.includes(N1), `claimed ${JSON.stringify(st.economy.claimed)}`);
  });

  row('N9', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const a = new PlayerProfile();
    const b = new PlayerProfile();
    a.claimMilestone(N1); // chest +1, in A
    const kind = Object.entries(stored(s).economy.containers).find(([, n]) => n > 0)?.[0];
    const rb = b.openContainer(kind); // B opens it
    const ra = a.openContainer(kind); // A, which still "holds" it in memory, tries too
    const st = stored(s);
    // The invariant is the COUNT, not which tab gets it: on the base B (booted before the claim)
    // cannot see the chest and A opens it; refresh-first, B opens it and A finds nothing.
    const opens = (rb ? 1 : 0) + (ra ? 1 : 0);
    ok('N9', kind !== undefined && opens === 1 && held(st) === 0,
      `kind ${kind} · B ${rb ? 'opened' : 'null'} · A ${ra ? 'opened' : 'null'} · opens ${opens} · held ${held(st)}`);
  });

  row('N10', () => {
    const s = makeStorage(); use(s); s.setItem(KEY, seedBlob());
    const listeners = new Map();
    globalThis.window = {
      addEventListener: (t, fn) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
      removeEventListener: (t, fn) => listeners.get(t)?.delete(fn),
    };
    try {
      const a = new PlayerProfile();
      const aFns = new Set(listeners.get('storage') ?? []); // tab A's window
      listeners.clear();
      const b = new PlayerProfile();
      let renders = 0;
      a.onChange(() => { renders++; });
      b.setName('TabB');
      for (const fn of aFns) fn({ key: KEY, newValue: s.getItem(KEY), oldValue: null, storageArea: s });
      ok('N10', a.name === 'TabB' && renders === 1, `A.name ${a.name} · renders ${renders} · storage listeners on A: ${aFns.size}`);
      const before = renders;
      for (const fn of aFns) fn({ key: 'some.other.key', newValue: 'x', oldValue: null, storageArea: s });
      ok('N10b', renders === before, `renders ${before} -> ${renders}`);
    } finally { delete globalThis.window; }
  });
  return rows;
}

const LABEL = {
  G: 'G     non-vacuity',
  N0: 'N0    HOLD  one tab: claim then rename both persist',
  N1: "N1    🚨 B's rename keeps A's claim and its chest",
  N2: "N2    🚨 ...and A's next write keeps B's rename and both claims",
  N2b: "N2b   🚨 ...and the writer's own getters agree with storage",
  N3: "N3    🚨 a six-seat win banked in A survives B's equip",
  N4: 'N4    HOLD  a private-mode session remembers its own matches (an unwritable null is not a reset)',
  N5: 'N5    HOLD  constructor-injected data is kept when storage cannot be read (nw_profile)',
  N6: 'N6    HOLD  injected data over an UNCHANGED blob survives the first mutation',
  N7: 'N7    🚨 a stale tab does not resurrect progress wiped by a reset elsewhere',
  N8: 'N8    HOLD  an unparseable blob is repaired from memory, not adopted as a wipe',
  N9: 'N9    HOLD  a chest claimed in one tab and opened in the other opens ONCE (no duplication)',
  N10: "N10   🚨 after B writes, A's getters show it and A's screens are told once (storage event)",
  N10b: 'N10b  HOLD  an event for another key does not re-render',
};
const DEFECT = ['N1', 'N2', 'N2b', 'N3', 'N7', 'N10'];
const HOLD = ['G', 'N0', 'N4', 'N5', 'N6', 'N8', 'N9', 'N10b'];

/** Each mutation: [anchor, replacement]. The anchor must occur EXACTLY once. */
const VARIANTS = {
  base: {
    why: 'the pre-fix behaviour: no re-read before a mutation, no storage listener',
    red: DEFECT, green: HOLD,
    edits: [
      ['  private sync(): void {\n', '  private sync(): void {\n    return;\n'],
      ["if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {", 'if (false) {'],
    ],
  },
  naive: {
    why: 're-read with load() and ADOPT unconditionally — the obvious version',
    red: ['N4', 'N5', 'N6', 'N8'], green: ['G', 'N0', 'N1', 'N3'],
    edits: [
      ['  private refresh(): boolean {\n',
        '  private refresh(): boolean {\n    { const r0 = readRaw(); this.data = load(r0); this.seen = r0 ?? null; return true; }\n'],
    ],
  },
  chatty: {
    why: 'a storage listener that re-renders on EVERY event, whatever the key and whether anything moved',
    red: ['N10b'], green: ['G', 'N10'],
    edits: [
      ['        if (ev.key !== null && ev.key !== STORAGE_KEY) return;\n        if (this.refresh()) this.notify();\n',
        '        this.refresh(); this.notify();\n'],
    ],
  },
  merge: {
    why: 'no re-read; MERGE held containers with storage at commit (keep the larger count)',
    red: ['N9'], green: ['G', 'N0'],
    edits: [
      ['  private sync(): void {\n', '  private sync(): void {\n    return;\n'],
      ['      const raw = JSON.stringify({\n',
        '      try { const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); if (prev) for (const k of Object.keys(prev.economy.containers)) (this.data.economy.containers as Record<string, number>)[k] = Math.max((this.data.economy.containers as Record<string, number>)[k] ?? 0, prev.economy.containers[k] ?? 0); } catch { /* */ }\n      const raw = JSON.stringify({\n'],
    ],
  },
};

function print(rows) {
  for (const r of rows) console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${LABEL[r.id] ?? r.id}${r.detail ? `   — ${r.detail}` : ''}`);
}

if (!SELFTEST) {
  console.log('B6 PROFILE — two tabs over one storage area, against the shipped profile.ts');
  const rows = runRows(await bundle());
  print(rows);
  const failed = rows.filter((r) => !r.pass).length;
  const missing = Object.keys(LABEL).filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) console.log(`  FAIL rows never produced: ${missing.join(', ')}`);
  console.log(`\n══ b6_profile: ${rows.length - failed}/${rows.length} rows pass`);
  process.exit(failed === 0 && missing.length === 0 ? 0 : 1);
}

console.log('B6 PROFILE --selftest — every row proved able to fail, on known-bad variants of the real file');
const src = readFileSync(PROFILE, 'utf8');
let faults = 0;
for (const [name, v] of Object.entries(VARIANTS)) {
  let text = src;
  for (const [anchor, repl] of v.edits) {
    const n = text.split(anchor).length - 1;
    if (n !== 1) {
      console.log(`  FAIL [${name}] STALE MUTATION — anchor matched ${n}× (want 1): ${JSON.stringify(anchor.slice(0, 60))}`);
      faults++;
    }
    text = text.replace(anchor, repl);
  }
  const rows = runRows(await bundle(text));
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.pass]));
  const wrongRed = v.red.filter((id) => byId[id] !== false);
  const wrongGreen = v.green.filter((id) => byId[id] !== true);
  const good = wrongRed.length === 0 && wrongGreen.length === 0;
  if (!good) faults++;
  console.log(`  ${good ? 'ok  ' : 'FAIL'} [${name}] ${v.why}: red ${v.red.join(' ')}${wrongRed.length ? ` — NOT RED: ${wrongRed.join(' ')}` : ''}`
    + `; green ${v.green.join(' ')}${wrongGreen.length ? ` — NOT GREEN: ${wrongGreen.join(' ')}` : ''}`);
}
// The control: the shipped file itself must be all green, or the variants prove nothing.
const real = runRows(await bundle(src));
const realGood = real.every((r) => r.pass) && real.length === Object.keys(LABEL).length;
if (!realGood) faults++;
console.log(`  ${realGood ? 'ok  ' : 'FAIL'} [shipped] the unmutated file through the SAME stdin path is all green (${real.filter((r) => r.pass).length}/${real.length})`);
console.log(`\n══ b6_profile --selftest: ${faults === 0 ? 'every variant failed where it should' : `${faults} fault(s)`}`);
process.exit(faults === 0 ? 0 : 1);
