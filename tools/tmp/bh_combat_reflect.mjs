#!/usr/bin/env node
// bh_combat_reflect — Shiitake Shield reflects `dealt`, including OVERKILL on the killing blow.
//
// combat.ts (grep `SHIITAKE SHIELD: WHAT THE ATTACKER TAKES BACK`) says the reflection is
// "applied to `dealt`, the number the victim ACTUALLY lost, so the mirror cannot disagree with
// the health bar it is mirroring." `dealt` is computed BEFORE the clamp
// `target.hp = Math.max(0, target.hp - dealt)`, so on a killing blow it exceeds what the
// victim lost. Same for `hit-landed.amount` ("`amount` on the event is what the target actually
// LOST").
//
// The shield is raised through the REAL item path: slot 1 equips `shiitake`, presses it
// (`useItem: 0`), and the probe waits out the 2,500 ms wind-up until `item.shieldUntil` is in
// the future. Only HP is set directly (a value every fighter passes through in play).
//
// Arms:
//   A  N=2 control — victim at 50 HP, non-lethal Patty Smash: reflected == lost (no overkill).
//   B  N=2 subject — victim at 3 HP, attacker at 10 HP. Victim loses 3; attacker takes 12 and
//      DIES — after `match-ended` named it the winner (state.winner is a corpse).
//   C  N=3 subject — the same blow mid-match (third fighter alive): the attacker dies to a
//      reflection 4x larger than the HP its victim had.
//
// Usage: node tools/tmp/bh_combat_reflect.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const SMASH = weaponIndex(S, 'hamburger', 'Smash');

function arm(name, { n, victimHp, attackerHp }) {
  const arena = fixtureArena();
  const seats = [
    { characterId: 'hamburger', x: 1000, y: 1000, facing: { x: 1, y: 0 } },          // attacker, slot 0
    { characterId: 'pizza', x: 1040, y: 1000, items: ['shiitake'] },                   // shielded victim, slot 1
  ];
  if (n >= 3) seats.push({ characterId: 'soup', x: 1600, y: 1600 });                  // bystander keeps the match alive
  const st = seatMatch(S, arena, seats);
  const A = st.fighters[0], V = st.fighters[1];
  // Raise the shield through the real press + wind-up.
  const press = new Array(n).fill(null);
  press[1] = input({ useItem: 0 });
  S.sim.stepMatch(st, DT, press);
  let guard = 0;
  while (!(st.elapsed < V.item.shieldUntil) && guard++ < 400) S.sim.stepMatch(st, DT, new Array(n).fill(null));
  const shieldUp = st.elapsed < V.item.shieldUntil;
  V.hp = victimHp; A.hp = attackerHp;
  const vBefore = V.hp, aBefore = A.hp;
  const ins = new Array(n).fill(null);
  ins[0] = input({ aim: { x: 1, y: 0 }, weapon: SMASH, attack: true });
  const evs = S.sim.stepMatch(st, DT, ins);
  const lost = vBefore - V.hp;
  const reflEv = evs.find((e) => e.type === "hit-landed" && e.targetId === 0);
  const reflected = reflEv ? +reflEv.amount.toFixed(4) : 0;
  const hitOnVictim = evs.find((e) => e.type === 'hit-landed' && e.targetId === 1);
  const ended = evs.find((e) => e.type === 'match-ended');
  const order = evs.filter((e) => ['hit-landed', 'death', 'match-ended'].includes(e.type))
    .map((e) => e.type === 'hit-landed' ? `hit(${e.targetId},${+e.amount.toFixed(2)})` : e.type === 'death' ? `death(${e.fighterId})` : `ended(winner=${e.winnerId})`);
  console.log(`\n[${name}] N=${n} shieldUp=${shieldUp} victimHp ${vBefore}->${V.hp} attackerHp ${aBefore}->${A.hp}`);
  console.log(`  victim LOST ${lost} | hit-landed.amount on victim ${hitOnVictim ? +hitOnVictim.amount.toFixed(2) : '-'} | attacker took back ${reflected}`);
  console.log(`  event order: ${order.join(' -> ')}`);
  console.log(`  phase=${st.phase} winnerId=${st.winnerId} winnerAlive=${st.winnerId !== null ? st.fighters[st.winnerId].alive : '-'}`);
  return { shieldUp, lost, reflected, eventAmount: hitOnVictim?.amount, winnerAlive: st.winnerId !== null ? st.fighters[st.winnerId].alive : null, attackerAlive: A.alive, ended: !!ended };
}

const reflOf = (r) => r.reflectEvent;
const a = arm('A control: non-lethal, attacker healthy', { n: 3, victimHp: 50, attackerHp: 100 });
const b = arm('B measure: lethal on a 3 HP victim, attacker healthy', { n: 3, victimHp: 3, attackerHp: 100 });
const c = arm('C consequence: duel, attacker at 10 HP', { n: 2, victimHp: 3, attackerHp: 10 });
const d = arm('D consequence: three seats, attacker at 10 HP', { n: 3, victimHp: 3, attackerHp: 10 });

const nonVacuous = [a, b, c, d].every((r) => r.shieldUp) && a.reflected > 0;
console.log(`\nNON-VACUITY: shield up in all four arms and the control reflects something: ${nonVacuous}`);
console.log(`CONTROL  A: reflected ${a.reflected} == lost ${a.lost}: ${a.reflected === a.lost}`);
console.log(`SUBJECT  B: reflected ${b.reflected} vs lost ${b.lost} (hit-landed.amount on victim ${b.eventAmount})`);
console.log(`SUBJECT  C: duel — declared winner alive after the tick: ${c.winnerAlive}`);
console.log(`SUBJECT  D: N=3 — attacker (10 HP) alive after killing a 3 HP victim: ${d.attackerAlive}`);
const bug = b.reflected > b.lost;
console.log(bug ? 'VERDICT: BUG — the mirror reflects overkill (more than the victim lost).' : 'VERDICT: reflection is bounded by HP actually lost.');
process.exit(nonVacuous ? 0 : 2);
