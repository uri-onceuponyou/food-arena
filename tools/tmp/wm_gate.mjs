#!/usr/bin/env node
/**
 * WM_GATE — the STANDING MATRIX: every one of the 34 ability blurbs, claim by claim,
 * asserted against the weapon record it is type-linked to.
 *
 *   node tools/tmp/wm_gate.mjs                # the matrix. exit 1 while any claim is false.
 *   node tools/tmp/wm_gate.mjs --table        # + a one-line-per-blurb compact matrix
 *   node tools/tmp/wm_gate.mjs -v             # + each term's definition beside its verdict
 *   node tools/tmp/wm_gate.mjs --ratchet      # exit 0 only if the fault set EQUALS wm_ledger.json
 *   node tools/tmp/wm_gate.mjs --selftest     # the known-bads
 *   node tools/tmp/wm_gate.mjs --json out.json
 *   node tools/tmp/wm_gate.mjs --write-ledger # re-record the ledger (do this WITH a commit message)
 *
 * Offline, no browser, no GPU, ~1s. Read-only on `src/`. Owner prefix: wm_*.
 *
 * ── WHY THIS EXISTS AND WHY IT IS NOT A REPORT ──────────────────────────────
 *
 * ⚠️ WAS, and it is quoted in three other documents: *"An audit found 20 of 34 blurbs..."*.
 * **THAT COUNT IS WRONG AND THIS GATE IS WHY WE KNOW.** It re-derives **13 of 34** false
 * (21 PASS) at `a42224c`. The original audit had no closed vocabulary, so it counted
 * flavour prose as claims — which is precisely the failure `cosmetic` + `MECHANIC_LEXICON`
 * exist to prevent. The wrong number was quoted to Uri. Kept in the past tense here rather
 * than deleted, because it is still in `docs/STATE.md` and twice in `DECISIONS-FOR-URI.md`
 * and someone will meet it there first.
 *
 * An audit found 20 of 34 blurbs claiming something the sim does not do. It left NO
 * DURABLE RECORD: the matrix lived in agent reports and commit messages, so it went
 * stale against a tree that then moved ~30 commits, and nothing could re-run it. **A
 * finding that cannot be re-derived is a memory, not a finding.** This is the same
 * finding expressed as a gate, so it re-derives itself on every run.
 *
 * ── THE THREE CLASSES, WHICH HAVE DIFFERENT OWNERS ──────────────────────────
 *
 *   WRONG VALUE       the term IS in `wm_vocab.mjs` and its predicate is FALSE on the
 *                     record. Fix: one word or one number in `rules.ts`.
 *   MISSING MECHANIC  the term is not in the vocabulary at all — no field, no state, no
 *                     code implements it. Fix: a feature. **THIS CLASS IS THE ROADMAP.**
 *   COSMETIC          flavour. Asserted only against the abuse guard below.
 *
 * ── FIVE WAYS A CLASSIFIER CAN PASS BY CHECKING NOTHING, ALL GUARDED ────────
 *
 * `[].every()` is `true`, and that exact vacuity has fired repeatedly in this repo — so
 * every arm here asserts its set is NON-EMPTY before asserting over it:
 *
 *   §S  SIZE          the declaration key set must EQUAL the set derived from
 *                     `abilityCards()`, both non-empty. A dropped blurb, a dropped
 *                     declaration or a renamed weapon key is a fault, not a smaller run.
 *   §D  DRIFT         `desc` in the declaration must EQUAL the shipped `desc`, byte for
 *                     byte. This is what stops the side-file rotting silently: edit a
 *                     blurb in `rules.ts` and this gate goes RED the same minute.
 *   §P  SPAN          every span must be an exact substring of the blurb. A declaration
 *                     that has drifted off the text cannot be trusted about the text.
 *   §C  COVERAGE      every CONTENT WORD of every blurb must sit inside some span. A
 *                     classifier that classifies half a sentence passes every check on
 *                     the half it looked at; this makes the unlooked-at half a fault.
 *   §X  COSMETIC      a `cosmetic` span may not contain a word from `MECHANIC_LEXICON`.
 *                     Without this, `cosmetic` is a one-word escape hatch that turns any
 *                     claim green — the vacuity trap wearing a different hat.
 *
 * And the vocabulary itself is grounded in `wm_vocab.mjs`: a term nothing satisfies is a
 * FICTION, a term everything satisfies is a TAUTOLOGY, and both are faults there.
 *
 * ── THE KNOWN-BAD IS FREE AND IT IS IN THE TREE ─────────────────────────────
 *
 * `waterbottle.Mega`'s card promises a self-launch, a second bottle spawned from the cap,
 * a merge of the two, and a heavier-than-normal slow. **None of those four exist.** The
 * `--selftest` arm requires this gate to FAIL on that weapon against the UNMODIFIED tree.
 * A guard that has not been shown to fail on the bug it guards against is not a guard,
 * and a synthetic known-bad would not have shown that this one is aimed at the roster.
 *
 * ── 🚨 `wm_claims.json` IS A TEMPORARY SECOND SOURCE OF TRUTH ───────────────
 *
 * The declarations belong in `src/game/rules.ts`, on `AbilityBlurb`, beside the `desc:`
 * they describe — exactly where `AbilityBlurb.weapon` already lives, and for exactly the
 * same reason: two things that can drift apart will. They are in a side file only
 * because `rules.ts` was owned by another agent when this was built. THE MIGRATION:
 *
 *   1. `AbilityBlurb` grows `claims: readonly (readonly [string, string])[]`.
 *   2. Each blurb's array is pasted from `wm_claims.json` beside its own `desc`.
 *   3. `defineCharacter`'s signature already computes the weapon-key union; nothing there
 *      changes. A claim term stays a plain string, because the vocabulary must be able to
 *      name mechanics that DO NOT EXIST — that is the whole MISSING MECHANIC class, and a
 *      union type of implemented mechanics would make it unexpressible.
 *   4. This gate reads `def.abilities[i].claims` instead of the JSON, and §D (the desc
 *      drift arm) DISAPPEARS — it becomes structurally impossible, which is the point.
 *   5. `wm_claims.json` is deleted in the same commit. Two sources of truth is the defect
 *      this repo has paid for most often; leaving this file behind would be one more.
 *
 * ── SCOPE. THIS IS THE TECHNICAL AXIS ONLY. ─────────────────────────────────
 *
 * It answers "does the sim do what the card says". It says NOTHING about what is drawn —
 * `lollipop.Giant` carries a map-scale VFX (`giantSlam`) over a 400 wu melee, so the
 * visual and the sim disagree about SCALE in a way only a rendered-pixel pass can see.
 * ⚠️ WAS *"over a 400 wu SINGLE-TARGET melee"*: `3483d23` made the melee branch resolve
 * against every opponent in the arc, so the single-target half of that sentence is gone
 * and only the scale disagreement remains.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const IS_MAIN = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

const { CHARACTERS, CHARACTER_IDS, abilityCards } = await import(`${ROOT}src/game/rules.ts`);
const vocabMod = await import('./wm_vocab.mjs');
const { buildVocab, burstOf, perHitOf, contentWords, MECHANIC_LEXICON, measureSplatSlow, ROSTER, ARENA } = vocabMod;

const CLAIMS_PATH = `${ROOT}tools/tmp/wm_claims.json`;
const LEDGER_PATH = `${ROOT}tools/tmp/wm_ledger.json`;

/** The join key. `abilityCards()` is the ONLY supported way to read the two arrays together. */
export function keyFor(id, ability) {
  return `${id}.${ability.weapon ?? '~' + ability.name}`;
}

/** Every blurb in the roster, already joined to its weapon by KEY, never by index. */
export function derivedBlurbs(chars = CHARACTERS, ids = CHARACTER_IDS) {
  const out = [];
  for (const id of ids) {
    const def = chars[id];
    const cards = abilityCards(def);
    if (cards.length !== def.abilities.length) throw new Error(`wm_gate: abilityCards dropped a row on ${id}`);
    def.abilities.forEach((a, i) => {
      const w = cards[i].weapon;
      out.push({
        key: keyFor(id, a), id, def, ability: a, w,
        tag: w ? `${id}.${w.key}` : `${id}.~`,
        burst: w ? burstOf(w) : 0,
        perHit: w ? perHitOf(w) : 0,
      });
    });
  }
  return out;
}

/** Mechanics the RECORD carries that no claim on this blurb mentions. Informational. */
const RECORD_MECHANICS = [
  'melee', 'ranged', 'self-target', 'slow', 'stun', 'pellets', 'combo', 'homing',
  'repeat-hits', 'splatter', 'trail-boost', 'wind-up', 'self-heal', 'giant-slam-vfx',
];

export function analyse({ decls, chars = CHARACTERS, ids = CHARACTER_IDS, vocab }) {
  const faults = [];
  const rows = [];
  const F = (cls, key, detail) => faults.push({ cls, key, detail });

  const blurbs = derivedBlurbs(chars, ids);
  const derivedKeys = blurbs.map((b) => b.key);
  const declKeys = Object.keys(decls);

  // ── §S SIZE / NON-VACUITY. FIRST, before any filter runs. ──────────────────
  if (derivedKeys.length === 0) F('SIZE', '(roster)', 'no blurbs derived from the roster at all');
  if (declKeys.length === 0) F('SIZE', '(declarations)', 'the declaration set is EMPTY — every quantified check below would pass vacuously');
  if (new Set(derivedKeys).size !== derivedKeys.length) F('SIZE', '(roster)', 'two blurbs derive the same join key');
  for (const k of derivedKeys) if (!(k in decls)) F('SIZE', k, 'shipped blurb with NO declaration');
  for (const k of declKeys) if (!derivedKeys.includes(k)) F('SIZE', k, 'declaration for a blurb that is not in the roster');
  if (faults.some((f) => f.cls === 'SIZE')) return { faults, rows, sizes: { derived: derivedKeys.length, declared: declKeys.length } };

  for (const b of blurbs) {
    const d = decls[b.key];
    const ctx = { w: b.w, def: b.def, tag: b.tag, burst: b.burst, perHit: b.perHit };
    const row = { key: b.key, desc: b.ability.desc, claims: [], undeclared: [], faults: 0, why: d.why ?? null };

    // ── §D DRIFT ────────────────────────────────────────────────────────────
    if (d.desc !== b.ability.desc) {
      F('DRIFT', b.key, `the blurb has CHANGED since this declaration was written.\n        shipped:  ${JSON.stringify(b.ability.desc)}\n        declared: ${JSON.stringify(d.desc)}`);
      row.faults++;
    }

    if (!Array.isArray(d.c) || d.c.length === 0) {
      F('SIZE', b.key, 'declaration carries NO claims — an empty claim list asserts nothing');
      row.faults++;
      rows.push(row);
      continue;
    }

    const covered = new Set();
    for (const [term, span] of d.c) {
      const verdict = { term, span, cls: null, note: '' };

      // ── §P SPAN ───────────────────────────────────────────────────────────
      if (!b.ability.desc.includes(span)) {
        verdict.cls = 'STALE-SPAN';
        F('STALE-SPAN', b.key, `span ${JSON.stringify(span)} is not in the blurb`);
        row.faults++;
        row.claims.push(verdict);
        continue;
      }
      for (const wd of contentWords(span)) covered.add(wd);

      if (term === 'cosmetic') {
        // ── §X COSMETIC ABUSE ───────────────────────────────────────────────
        const leak = contentWords(span).find((wd) => MECHANIC_LEXICON.has(wd));
        if (leak) {
          verdict.cls = 'COSMETIC-ABUSE';
          F('COSMETIC-ABUSE', b.key, `span ${JSON.stringify(span)} is declared flavour but contains the mechanic word "${leak}"`);
          row.faults++;
        } else {
          verdict.cls = 'COSMETIC';
        }
        row.claims.push(verdict);
        continue;
      }

      const t = vocab[term];
      if (!t) {
        // ── MISSING MECHANIC — no field, no state, no code. The roadmap. ─────
        verdict.cls = 'MISSING';
        F('MISSING', b.key, `claims "${term}" — NOT IN THE VOCABULARY: nothing in the sim can express it (${JSON.stringify(span)})`);
        row.faults++;
        row.claims.push(verdict);
        continue;
      }
      if (t.test(ctx)) {
        verdict.cls = 'PASS';
        verdict.note = t.doc;
      } else {
        verdict.cls = 'WRONG-VALUE';
        verdict.note = t.doc;
        F('WRONG-VALUE', b.key, `claims "${term}" (${JSON.stringify(span)}) — the record does not satisfy it. ${t.doc}`);
        row.faults++;
      }
      row.claims.push(verdict);
    }

    // ── §C COVERAGE ─────────────────────────────────────────────────────────
    const words = contentWords(b.ability.desc);
    if (words.length === 0) {
      F('COVERAGE', b.key, 'the blurb has NO content words — the coverage arm would pass vacuously');
      row.faults++;
    }
    const uncovered = [...new Set(words)].filter((wd) => !covered.has(wd));
    if (uncovered.length) {
      F('COVERAGE', b.key, `unclassified word(s): ${uncovered.join(', ')} — every content word must sit inside a declared span`);
      row.faults++;
      row.uncovered = uncovered;
    }

    // ── informational: what the RECORD does that the CARD never mentions ────
    if (b.w) {
      const named = new Set(d.c.map(([term]) => term));
      for (const m of RECORD_MECHANICS) {
        const t = vocab[m];
        if (t && t.test(ctx) && !named.has(m)) row.undeclared.push(m);
      }
    }

    rows.push(row);
  }

  return { faults, rows, sizes: { derived: derivedKeys.length, declared: declKeys.length } };
}

// ─────────────────────────────────────────────────────────────────────────────
function fingerprint(f) { return `${f.cls}|${f.key}|${f.detail.split('\n')[0]}`; }

function render(res, { verbose, compact }) {
  const CLS = { PASS: '  ok ', 'WRONG-VALUE': ' VAL ', MISSING: ' MISS', COSMETIC: '  -- ', 'STALE-SPAN': ' SPAN', 'COSMETIC-ABUSE': ' ABUS' };
  console.log('══ WM_GATE ══  the weapon-promise matrix, technical axis');
  console.log(`   ${res.sizes.derived} blurbs derived · ${res.sizes.declared} declared · ${ROSTER.nWeapons} weapons · arena ${ARENA.w}x${ARENA.h}`);
  console.log('');
  for (const r of res.rows) {
    const bad = r.faults > 0;
    console.log(`${bad ? 'FAIL' : 'PASS'}  ${r.key}`);
    console.log(`      "${r.desc}"`);
    for (const c of r.claims) {
      console.log(`      ${CLS[c.cls] ?? c.cls}  ${c.term.padEnd(24)} ${JSON.stringify(c.span)}`);
      if (verbose && c.note) console.log(`             ${c.note}`);
    }
    if (r.uncovered) console.log(`      UNCL  ${r.uncovered.join(', ')}`);
    if (r.undeclared?.length) console.log(`      info  record also does: ${r.undeclared.join(', ')} — the card never says so`);
    console.log('');
  }

  if (compact) {
    console.log('── COMPACT MATRIX ──  ok=true · VAL=wrong value · MISS=missing mechanic · --=cosmetic');
    for (const r of res.rows) {
      const tally = { ok: 0, VAL: 0, MISS: 0, cos: 0 };
      for (const c of r.claims) {
        if (c.cls === 'PASS') tally.ok++;
        else if (c.cls === 'WRONG-VALUE') tally.VAL++;
        else if (c.cls === 'MISSING') tally.MISS++;
        else if (c.cls === 'COSMETIC') tally.cos++;
      }
      const bad = r.faults > 0;
      console.log(
        `   ${(bad ? 'FAIL' : 'PASS')}  ${r.key.padEnd(24)} ok ${String(tally.ok).padStart(2)}  VAL ${String(tally.VAL).padStart(2)}  MISS ${String(tally.MISS).padStart(2)}  cos ${String(tally.cos).padStart(2)}   ` +
        (bad ? r.claims.filter((c) => c.cls === 'WRONG-VALUE' || c.cls === 'MISSING').map((c) => c.term).join(' ') : ''),
      );
    }
    console.log('');
  }

  // ── THE JUDGEMENT CALLS, PRINTED RATHER THAN BURIED ─────────────────────────
  // Every row here took a CHARITABLE reading of an ambiguous clause. They are the
  // difference between this matrix and the prior audit's larger count, and each one is a
  // one-line change in `wm_claims.json`. Printing them is the honest form of "what I
  // could not verify": a reader can overturn any of them without re-deriving anything.
  const judged = res.rows.filter((r) => r.why);
  if (judged.length) {
    console.log('── JUDGEMENT CALLS (a charitable reading was taken; each is one line in wm_claims.json) ──');
    for (const r of judged) console.log(`   ${r.key}\n      ${r.why}`);
    console.log('');
  }

  const byCls = {};
  for (const f of res.faults) (byCls[f.cls] ??= []).push(f);
  const clean = res.rows.filter((r) => r.faults === 0);
  console.log('── SUMMARY ──');
  // ⚠️ THE CLAIM TOTALS ARE PRINTED, NOT REMEMBERED. The first commit of this tool quoted
  // "COSMETIC 25" from a hand tally of the compact table and the real number was 20 —
  // every other figure in that message was right, which is exactly how a stale count
  // survives. Anything a report wants to quote is computed here.
  const tally = {};
  for (const r of res.rows) for (const c of r.claims) tally[c.cls] = (tally[c.cls] ?? 0) + 1;
  const totalClaims = Object.values(tally).reduce((a, b) => a + b, 0);
  console.log(`   ${totalClaims} claims declared across ${res.rows.length} blurbs: ` +
    Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log(`   ${clean.length} of ${res.rows.length} blurbs PASS the technical axis`);
  const weaponsClean = new Set(clean.filter((r) => !r.key.includes('.~')).map((r) => r.key));
  console.log(`   ${weaponsClean.size} of ${ROSTER.nWeapons} weapons carry a blurb that is technically true`);
  for (const [cls, list] of Object.entries(byCls)) console.log(`   ${String(list.length).padStart(3)}  ${cls}`);
  if (byCls.MISSING) {
    const mech = {};
    for (const f of byCls.MISSING) {
      const m = f.detail.match(/claims "([^"]+)"/);
      if (m) (mech[m[1]] ??= []).push(f.key);
    }
    console.log('\n── THE ROADMAP: mechanics the cards promise and the sim cannot express ──');
    for (const [m, keys] of Object.entries(mech).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`   ${m.padEnd(26)} ${keys.length}x  ${keys.join(', ')}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function selftest(vocab, decls, env) {
  const clone = () => JSON.parse(JSON.stringify(decls));
  let pass = 0, fail = 0;
  const arm = (label, cond, extra = '') => {
    if (cond) { pass++; console.log(`   PASS  ${label} ${extra}`); }
    else { fail++; console.log(`   FAIL  ${label} ${extra}`); }
  };
  const run = (d, chars = CHARACTERS, v = vocab) => analyse({ decls: d, chars, vocab: v });

  const base = run(decls);

  console.log('── KNOWN-BADS ──');

  // THE REAL ONE, FREE, IN THE TREE. If this passes, the gate is decorative.
  const mega = base.faults.filter((f) => f.key === 'waterbottle.Mega');
  arm('REAL      `waterbottle.Mega` FAILS on the unmodified tree', mega.length > 0, `(${mega.length} faults: ${[...new Set(mega.map((f) => f.cls))].join(',')})`);
  arm('REAL      ...and at least one of them is a MISSING MECHANIC', mega.some((f) => f.cls === 'MISSING'));

  // KB1 — a term that is in no vocabulary must come back MISSING, not silently pass.
  {
    const d = clone(); d['hamburger.Smash'].c.push(['zzz-teleports-the-arena', 'heavy damage']);
    const r = run(d);
    arm('KB1  ABSENT  a claim naming a mechanic that does not exist -> MISSING', r.faults.some((f) => f.cls === 'MISSING' && f.key === 'hamburger.Smash'));
  }
  // KB2 — a term that IS in the vocabulary but false on the record -> WRONG VALUE.
  {
    const d = clone(); d['hamburger.Tomato'].c = [['stun', 'Slows enemies down']];
    const r = run(d);
    arm('KB2  VALUE   a `stun` claim on a `slow` weapon -> WRONG VALUE', r.faults.some((f) => f.cls === 'WRONG-VALUE' && f.key === 'hamburger.Tomato'));
  }
  // KB3 — a dropped declaration must be a SIZE fault, not a smaller clean run.
  {
    const d = clone(); delete d['hamburger.Smash'];
    const r = run(d);
    arm('KB3  SIZE    a dropped declaration -> SIZE fault (not a smaller green run)', r.faults.some((f) => f.cls === 'SIZE' && f.key === 'hamburger.Smash'));
  }
  // KB3b — THE VACUITY ARM. An EMPTY declaration set must FAIL LOUDLY.
  {
    const r = run({});
    arm('KB3b VACUITY an EMPTY declaration set -> SIZE fault ([].every() is true)', r.faults.some((f) => f.cls === 'SIZE'), `(${r.faults.length} faults)`);
  }
  // KB4 — a span that has drifted off the text.
  {
    const d = clone(); d['hamburger.Tomato'].c = [['slow', 'Slows enemies sideways']];
    const r = run(d);
    arm('KB4  SPAN    a span that is not in the blurb -> STALE-SPAN', r.faults.some((f) => f.cls === 'STALE-SPAN'));
  }
  // KB5 — cosmetic used as an escape hatch.
  {
    const d = clone(); d['hamburger.Tomato'].c = [['cosmetic', 'Slows enemies down']];
    const r = run(d);
    arm('KB5  ABUSE   a `cosmetic` span containing "slows" -> COSMETIC-ABUSE', r.faults.some((f) => f.cls === 'COSMETIC-ABUSE'));
  }
  // KB6 — a claim dropped so part of the sentence goes unlooked-at.
  {
    const d = clone(); d['burrito.Swarm'].c = d['burrito.Swarm'].c.filter(([t]) => t !== 'projectile-destructible');
    const r = run(d);
    arm('KB6  COVER   dropping a claim leaves content words UNCLASSIFIED', r.faults.some((f) => f.cls === 'COVERAGE' && f.key === 'burrito.Swarm'));
  }
  // KB7 — the blurb edited in `rules.ts` under a declaration that still says the old thing.
  {
    const chars = { ...CHARACTERS, hamburger: { ...CHARACTERS.hamburger, abilities: CHARACTERS.hamburger.abilities.map((a) => a.weapon === 'Tomato' ? { ...a, desc: 'Slows enemies down a lot' } : a) } };
    const r = run(decls, chars);
    arm('KB7  DRIFT   editing the blurb in rules.ts -> DRIFT fault', r.faults.some((f) => f.cls === 'DRIFT' && f.key === 'hamburger.Tomato'));
  }
  // KB8 — the POSITIVE control: a correct claim must actually pass, or every arm above
  // is satisfied by a gate that simply fails everything.
  {
    const d = clone();
    for (const k of Object.keys(d)) d[k].c = d[k].c.filter(([t]) => false);
    const r = run(d);
    const gp = base.rows.find((x) => x.key === 'waterbottle.Glass');
    arm('KB8  POSITIVE a fully-true blurb PASSES (waterbottle.Glass, 3/3 claims)', gp && gp.faults === 0 && gp.claims.every((c) => c.cls === 'PASS'));
    arm('KB8b EMPTY    a declaration with an EMPTY claim list -> SIZE fault', r.faults.some((f) => f.cls === 'SIZE'));
  }
  // KB9 — the roster side: if the sim GAINS the mechanic, the claim must go green.
  {
    const chars = { ...CHARACTERS, hotdog: { ...CHARACTERS.hotdog, weapons: CHARACTERS.hotdog.weapons.map((w) => w.key === 'Slash' ? { ...w, damage: 1 } : w) } };
    const r = run(decls, chars);
    arm('KB9  ROSTER  nerfing hotdog.Slash to 1 dmg -> its "Powerful" claim goes WRONG-VALUE', r.faults.some((f) => f.cls === 'WRONG-VALUE' && f.key === 'hotdog.Slash'));
  }

  // ── KB11–KB13: THE THREE CLAIMS LANDED 2026-08-19, EACH SHOWN RED ON ITS OWN BUG ──
  //
  // Four WRONG-VALUEs were closed that day by moving the CARD rather than the number
  // (DECISIONS §81). CLAUDE.md rule 6: a guard that has not been shown to FAIL on the bug
  // it guards against is not a guard — and a card rewritten to be true today is worth
  // nothing if the gate cannot notice it going false again. Each arm below drives the
  // record from the other side and requires the WRONG-VALUE back.
  // ⚠️ Every one asserts its affected key set is NON-EMPTY before asserting over it:
  // `[].every()` is `true`, and these arms filter.

  // KB11 — `stun-brief`. The threshold is a JUDGEMENT (3000 ms) and the cheap wrong fix
  // was to lower it until the old cards passed. So the term is driven from the far side:
  // at STUN_DURATION_MS 3500 "for a moment" must go WRONG-VALUE on BOTH cards, and
  // `stun-few-seconds` — kept in the vocabulary precisely as this term's complement —
  // must start being satisfied.
  {
    const stunned = ['hamburger.Lettuce', 'burrito.Roll'];
    const declaring = stunned.filter((k) => decls[k]?.c.some(([t]) => t === 'stun-brief'));
    const v = vocabMod.buildVocab({ ...env, stunMs: 3500 });
    const r = run(decls, CHARACTERS, v);
    const red = declaring.filter((k) => r.faults.some((f) => f.cls === 'WRONG-VALUE' && f.key === k));
    arm('KB11 STUN    a 3500ms STUN_DURATION_MS -> every "for a moment" card goes WRONG-VALUE',
      declaring.length === 2 && red.length === declaring.length, `(${red.length}/${declaring.length} declaring)`);
    const nStun = ROSTER.rows.filter((x) => v['stun-few-seconds'].test({ w: x.w, def: CHARACTERS[x.id], tag: x.tag, burst: x.burst, perHit: x.perHit })).length;
    arm('KB11b COMPL  ...and `stun-few-seconds`, its complement, starts being satisfied', nStun > 0, `(${nStun}/${ROSTER.nWeapons})`);
  }
  // KB12 — `reach-longest`. The claim that replaced "hits the whole map". Retune the one
  // weapon that satisfies it below the next longest and the card must go red, which is
  // what makes the claim track DECISIONS §80's lever 1 instead of outliving it.
  {
    const declaring = Object.keys(decls).filter((k) => decls[k].c.some(([t]) => t === 'reach-longest'));
    const chars = { ...CHARACTERS, lollipop: { ...CHARACTERS.lollipop, weapons: CHARACTERS.lollipop.weapons.map((w) => w.key === 'Giant' ? { ...w, range: 100 } : w) } };
    const r = run(decls, chars);
    const red = declaring.filter((k) => r.faults.some((f) => f.cls === 'WRONG-VALUE' && f.key === k));
    arm('KB12 REACH   dropping lollipop.Giant to 100 wu -> its "widest area" claim goes WRONG-VALUE',
      declaring.length > 0 && red.length === declaring.length, `(${red.length}/${declaring.length} declaring)`);
  }
  // KB13 — `pellets`. The claim that replaced "the seaweed scatters across the map".
  {
    const declaring = ['sushi.Catch'].filter((k) => decls[k]?.c.some(([t]) => t === 'pellets'));
    const chars = { ...CHARACTERS, sushi: { ...CHARACTERS.sushi, weapons: CHARACTERS.sushi.weapons.map((w) => w.key === 'Catch' ? { ...w, pellets: 1 } : w) } };
    const r = run(decls, chars);
    const red = declaring.filter((k) => r.faults.some((f) => f.cls === 'WRONG-VALUE' && f.key === k));
    arm('KB13 FAN     sushi.Catch down to ONE pellet -> its "scatters in a fan" claim goes WRONG-VALUE',
      declaring.length === 1 && red.length === 1, `(${red.length}/${declaring.length} declaring)`);
  }

  // KB9b/c/d — `multi-target` was the largest single class in the matrix (3 blurbs) and
  // it rested on a term being ABSENT from the vocabulary. An absence is the easiest thing
  // in this repo to be wrong about, so it is MEASURED: one press, five bystanders parked
  // inside reach, distinct victims counted.
  //
  // 🚨 IT WAS RIGHT TO MEASURE IT. `3483d23` made a melee swing resolve against every
  // opponent in its arc and `lollipop.Giant` went 1 victim -> 5. **`--ratchet` reported
  // "fault set unchanged" across that commit at exit 0**, correctly and uselessly: a
  // MISSING verdict is a property of the VOCABULARY, so a mechanic being BUILT is
  // invisible to the ratchet by construction. These three arms are the only thing in the
  // battery that can see it, and the old single arm — `maxVictims <= 1` — is preserved in
  // `wm_vocab.mjs`'s selftest with the reason it had to become two.
  {
    const mt = env.multi;
    arm('KB9b GROUND  the census CAN see two fighters (positive control)', mt.canSeeTwo, `(control victims=${mt.control.victims})`);
    arm('KB9c GROUND  a MELEE press damages MORE THAN ONE — `multi-target-melee` is grounded', mt.meleeReachesMany, `(${mt.meleeVictims})`);
    // The BOUNDARY, and it is the load-bearing half: without it `multi-target-melee` could
    // widen to cover the two RANGED cards that promise the same thing, turning two MISSING
    // verdicts green on a mechanic nobody built.
    arm('KB9d BOUNDARY a RANGED press still damages exactly ONE — so `multi-target` is rightly ABSENT', mt.rangedReachesOne, `(${mt.rangedVictims})`);
    // KB9e — the term driven from the OTHER side. If the census ever reports melee at 1,
    // every `multi-target-melee` claim must go WRONG-VALUE rather than quietly passing.
    const declaring = Object.keys(decls).filter((k) => decls[k].c.some(([t]) => t === 'multi-target-melee'));
    const v = vocabMod.buildVocab({ ...env, multi: { ...mt, meleeReachesMany: false } });
    const r = run(decls, CHARACTERS, v);
    const red = declaring.filter((k) => r.faults.some((f) => f.cls === 'WRONG-VALUE' && f.key === k));
    arm('KB9e MULTI   a census reporting ONE melee victim -> every "everyone" claim goes WRONG-VALUE',
      declaring.length > 0 && red.length === declaring.length, `(${red.length}/${declaring.length} declaring)`);
  }

  // KB10 — the RATCHET itself, in both directions. A ratchet that only ever reports
  // "unchanged" is a comment with a tick next to it, and the FIXED direction is the one
  // that stops the ledger silently outliving the faults it records.
  {
    const led = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')).faults;
    const now = base.faults.map(fingerprint).sort();
    arm('KB10 RATCHET the recorded ledger EQUALS today\'s fault set', JSON.stringify(led) === JSON.stringify(now), `(${now.length})`);
    const withNew = [...now, 'MISSING|zz.Fake|synthetic'];
    arm('KB10b NEW    an added fault is detected', withNew.filter((x) => !new Set(led).has(x)).length === 1);
    const withFixed = now.slice(1);
    arm('KB10c FIXED  a fault that no longer reproduces is detected', led.filter((x) => !new Set(withFixed).has(x)).length === 1);
  }

  console.log(`\n   ${pass} passed, ${fail} failed`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

  const splatSlow = measureSplatSlow();
  if (!splatSlow.controlOk) {
    console.error('INSTRUMENT INVALID — the splat-slow positive control failed (the human seat did not slow). Not reporting.');
    process.exit(2);
  }
  const env = { splatSlow, multi: vocabMod.measureMultiTarget() };
  const vocab = buildVocab(env);
  const decls = JSON.parse(readFileSync(CLAIMS_PATH, 'utf8')).claims;

  if (has('--selftest')) process.exit((await selftest(vocab, decls, env)) ? 0 : 1);

  const res = analyse({ decls, vocab });
  render(res, { verbose: has('-v'), compact: has('--table') });

  const prints = res.faults.map(fingerprint).sort();
  if (has('--json')) writeFileSync(val('--json'), JSON.stringify({ sizes: res.sizes, rows: res.rows, faults: res.faults }, null, 2));
  if (has('--write-ledger')) {
    // ⚠️ `measuredOn` EXISTS BECAUSE TWO OF THESE FAULTS ARE MEASURED ON THE LIVE SIM,
    // NOT READ OFF A FIELD — `splat-slows-anyone` walks two fighters through `stepMatch`
    // and `multi-target` counts victims through the real event pipeline. So this file
    // records a verdict about a TREE, and the working tree is not a commit: 2026-08-19 a
    // peer's UNCOMMITTED `combat.ts` turned `lollipop.Giant` from 1 victim into 5, which
    // would have silently retired a roadmap item into a ledger nobody could reproduce.
    // Say which tree the numbers came from, in the file that carries them.
    writeFileSync(LEDGER_PATH, JSON.stringify({
      _: 'Faults ACCEPTED as of the recorded SHA. --ratchet fails on any DIFFERENCE, in either direction: a new fault is a regression, and a fault that no longer reproduces means this ledger is stale and must be re-recorded WITH the fix.',
      sha: process.env.WM_SHA ?? null,
      measuredOn: process.env.WM_MEASURED_ON ?? null,
      faults: prints,
    }, null, 2) + '\n');
    console.log(`\nwrote ${LEDGER_PATH} (${prints.length} accepted faults)`);
    process.exit(0);
  }

  if (has('--ratchet')) {
    const led = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')).faults;
    const now = new Set(prints), was = new Set(led);
    const added = [...now].filter((x) => !was.has(x));
    const gone = [...was].filter((x) => !now.has(x));
    console.log('\n── RATCHET ──');
    for (const a of added) console.log(`   NEW    ${a}`);
    for (const g of gone) console.log(`   FIXED  ${g}   <- re-record the ledger with the fix`);
    if (added.length || gone.length) { console.error(`\nratchet: ${added.length} new, ${gone.length} no longer reproducing`); process.exit(1); }
    console.log('   fault set unchanged.');
    process.exit(0);
  }

  if (res.faults.length) { console.error(`\n${res.faults.length} fault(s) across ${res.rows.filter((r) => r.faults).length} blurbs`); process.exit(1); }
  process.exit(0);
}
