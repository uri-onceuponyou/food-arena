#!/usr/bin/env node
// bh_match_bluecheese — review-phase probe (2026-10-15). Is the Blue Cheese passive live?
// Two human seats with NO input (nobody moves or fires), the holder 60 wu from the victim
// (aura radius 84) for 6 s of sim. Positive control: a hand-delivered blue_cheese hit IS counted.
// Usage: node tools/tmp/bh_match_bluecheese.mjs [simDir]   (default: the clean worktree of 1090046)
const SIM = process.argv[2] ?? '/private/tmp/fa-rv-head/src/game';
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const R = await import(`${SIM}/rules.ts`);
const fs = await import('node:fs');
const d = JSON.parse(fs.readFileSync('/private/tmp/fa-rv-head/tools/arena.gameplay.json', 'utf8'));
const arena = { ...d, build: () => null, update: () => {} };
console.log('blue_cheese tuning', JSON.stringify(R.ITEM_TUNING.blue_cheese), 'kind', R.ITEMS.blue_cheese.kind);
function run(items) {
  // Both seats human with NO input: nobody moves or fires, so any damage is the item's.
  const st = createMatch(arena, [
    { characterId: 'hamburger', controller: 'human', items },
    { characterId: 'donut', controller: 'human' },
  ]);
  while (st.phase === 'countdown') stepMatch(st, 16.667, [null, null]);
  const a = st.fighters[0], b = st.fighters[1];
  b.x = a.x + 60; b.y = a.y;   // well inside any melee / aura reach
  let itemHits = 0, anyHits = 0, hp0 = b.hp;
  for (let t = 0; t < 6000; t += 16.667) {
    for (const ev of stepMatch(st, 16.667, [null, null])) {
      if (ev.type === 'hit-landed') { anyHits++; if (ev.source.kind === 'weapon' && ev.source.itemId) itemHits++; }
    }
  }
  return { items, itemHits, anyHits, victimHpBefore: hp0, victimHpAfter: b.hp, equipped: a.item.equipped };
}
console.log('blue_cheese 6 s adjacent:', JSON.stringify(run(['blue_cheese'])));
console.log('control, no item:', JSON.stringify(run([])));
// Positive control: the counter SEES a blue-cheese hit when one is delivered by hand.
{
  const combat = await import(`${SIM}/combat.ts`);
  const st = createMatch(arena, [{ characterId: 'hamburger', controller: 'human', items: ['blue_cheese'] }, { characterId: 'donut', controller: 'human' }]);
  while (st.phase === 'countdown') stepMatch(st, 16.667, [null, null]);
  const evs = []; combat.applyDamage(st, st.fighters[1], R.ITEM_TUNING.blue_cheese.dps, null, combat.itemDamageSource(st.fighters[0], 'blue_cheese'), evs);
  const seen = evs.filter((e) => e.type === 'hit-landed' && e.source.kind === 'weapon' && e.source.itemId === 'blue_cheese').length;
  console.log('positive control: hand-delivered blue_cheese hit counted', seen, 'victim hp', st.fighters[1].hp);
}
