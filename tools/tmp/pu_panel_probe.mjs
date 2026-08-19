#!/usr/bin/env node
/**
 * pu_panel_probe — the two things a TUNING tool must do that a config editor need not.
 *
 *   1. §76: *"Show DERIVED CONSEQUENCES beside every field."* The trap this proves is real:
 *      `MATCH_DURATION_MS` and `SUDDEN_DEATH_MS` are coupled in MEANING and not in code —
 *      `SUDDEN_DEATH_MS = FOG_CLOSE_MS + SUDDEN_DEATH_GRACE_MS` does not follow the clock —
 *      so shortening the match drives `SUDDEN_DEATH_REMAINING_MS` NEGATIVE and sudden death
 *      silently never fires. A number in a text box cannot show that. The panel must.
 *
 *   2. Grouping. 216 fields need a way to see the four that matter together. The shipped
 *      panel has no bookmark/pin; `adminScreen.ts:matchesQuery` is the whole mechanism and
 *      it filters WITHIN THE ACTIVE TAB. That distinction is the difference between a
 *      useful filter string and a useless one, so it is measured rather than assumed.
 *
 * KNOWN-BAD: a query that matches nothing must report zero rows, not "all rows". Without
 * that arm a filter that silently ignored its input would pass every row count below.
 *
 * Usage:  node tools/tmp/pu_panel_probe.mjs [--url http://localhost:4321]
 */
import { chromium } from 'playwright';
const argv = process.argv.slice(2);
const i = argv.indexOf('--url');
const BASE = (i >= 0 ? argv[i + 1] : 'http://localhost:4321').replace(/\/$/, '');

const out = [];
const rec = (ok, label, detail) => out.push({ ok, label, detail });

const b = await chromium.launch();
const pg = await b.newPage();
await pg.goto(`${BASE}/?screen=admin`, { waitUntil: 'load' });
await pg.waitForFunction(() => window.__screen === 'admin', null, { timeout: 20_000 });
await pg.waitForTimeout(300);

// 1. the consequence line
const cq = await pg.evaluate(() => {
  const a = window.__admin;
  a.setTab('arena');
  a.stage('MATCH_DURATION_MS', 90000);
  return a.consequences('MATCH_DURATION_MS');
});
const negative = cq.find((l) => /SUDDEN_DEATH_REMAINING_MS/.test(l));
rec(!!negative && /-45000|−45000/.test(negative),
  'the panel PRINTS the negative sudden-death consequence',
  negative ?? `consequences=${JSON.stringify(cq)}`);

// 2. filtering, on the tab the keys actually live on
async function filterRows(tab, query) {
  return pg.evaluate(([t, q]) => {
    window.__admin.setTab(t);
    const s = document.querySelector('.adm-search') ?? [...document.querySelectorAll('input')]
      .find((x) => (x.placeholder ?? '').startsWith('Filter'));
    s.value = q;
    s.dispatchEvent(new Event('input', { bubbles: true }));
    return window.__admin.rowKeys();
  }, [tab, query]);
}
const speed = await filterRows('combat', 'speed');
rec(speed.length === 3 && speed.includes('PLAYER_SPEED') && speed.includes('AI_CHASE_SPEED'),
  'Combat + "speed" isolates exactly the three speed levers', speed.join(', '));

const dur = await filterRows('combat', 'duration');
rec(dur.includes('STUN_DURATION_MS') && dur.includes('SLOW_DURATION_MS'),
  'Combat + "duration" isolates the §80 status levers', dur.join(', '));

const cast = await filterRows('character', 'castms');
rec(cast.length === 1 && cast[0] === 'char.waterbottle.Mega.castMs',
  'Characters + "castms" isolates §77\'s single lever', cast.join(', '));

// KNOWN-BAD: the filter must be able to return NOTHING.
const none = await filterRows('combat', 'zzz-no-such-key-zzz');
rec(none.length === 0, 'KNOWN-BAD — a query matching nothing returns zero rows',
  `rows=${none.length}`);

console.log('');
for (const r of out) console.log(` ${r.ok ? ' ok ' : 'FAIL'}  ${r.label.padEnd(56)} ${r.detail}`);
const pass = out.filter((r) => r.ok).length;
console.log(`\npu_panel_probe: ${pass}/${out.length}`);
await b.close();
process.exit(pass === out.length ? 0 : 1);
