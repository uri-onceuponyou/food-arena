/**
 * Does a DEAD-BUT-HEALED fighter outrank a LIVING one in the timeout resolver?
 *
 * The zombie state (`alive === false`, `hp > 0`) was MEASURED as reachable on the pre-fix
 * tree by `tools/tmp/dd_zombie.mjs` — 18/70 HP, three ticks after death, via the self-heal.
 * This asks what the shipped resolver DOES with it, and it is stated as a state rather than
 * played out, so nothing but the sort is under test. `resolveTimeout` sorts
 * `state.fighters` with NO `alive` filter and its rung 1 is HP FRACTION (sim.ts:849-860),
 * so the whole ladder rests on "dead implies hp === 0" — the invariant the corpse broke.
 */
import { createMatch, stepMatch } from '../../src/game/sim.ts';
const N = 6;
const arena = { id:'dd', displayName:'dd', width:2800, height:2000, center:{x:1400,y:1000},
  maxSafeRadius:900, playerSpawn:{x:200,y:200}, enemySpawn:{x:2600,y:1800}, cover:[], hazards:[], build(){return {};} };
const ring = (i) => ({ x: arena.center.x + 700*Math.cos((i/N)*Math.PI*2), y: arena.center.y + 700*Math.sin((i/N)*Math.PI*2) });

for (const zombieHp of [0, 18, 65]) {
  const st = createMatch(arena, Array.from({length:N},(_,i)=>({characterId:'hamburger',spawn:ring(i)})));
  st.phase = 'playing';
  // Slot 0: the corpse. hp 0 = what the sim guarantees today; 18 = what the pre-fix bug reached.
  st.fighters[0].alive = false; st.fighters[0].hp = zombieHp;
  // Four living rivals below the zombie's fraction, one above it.
  [10, 11, 12, 13].forEach((hp, k) => { st.fighters[k+1].hp = hp; });
  st.fighters[5].hp = 60;
  const top = Math.max(...st.fighters.filter(f=>f.alive).map(f=>f.hp));
  st.timeRemaining = 0;
  const evs = stepMatch(st, 16.67, { move:{x:0,y:0}, selectedWeapon:0, attack:false });
  const ended = evs.find(e => e.type === 'match-ended');
  const order = st.fighters.slice().map(f => f.id);
  const w = st.fighters[ended.winnerId];
  console.log(`zombie hp=${zombieHp}/70 (best living ${top}/70) -> winnerId ${ended.winnerId} alive=${w.alive} hp=${w.hp}` + (w.alive ? '' : '   <<< A DEAD FIGHTER WON THE MATCH'));
}
