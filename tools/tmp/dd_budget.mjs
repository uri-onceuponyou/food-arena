import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { applyDamage } from '../../src/game/combat.ts';
const N = 6;
const arena = { id:'dd', displayName:'dd', width:2800, height:2000, center:{x:1400,y:1000},
  maxSafeRadius:900, playerSpawn:{x:200,y:200}, enemySpawn:{x:2600,y:1800}, cover:[], hazards:[], build(){return {};} };
for (const R of [200, 300, 400, 700]) {
  const ring = (i) => ({ x: arena.center.x + R*Math.cos((i/N)*Math.PI*2), y: arena.center.y + R*Math.sin((i/N)*Math.PI*2) });
  const st = createMatch(arena, Array.from({length:N},(_,i)=>({characterId:'hamburger',spawn:ring(i),controller:i===0?'human':'ai'})));
  st.phase='playing';
  for (const f of [st.fighters[0], st.fighters[1]]) applyDamage(st, f, f.maxHp*10, null, {kind:'hazard'}, []);
  let firstLiveEvent = -1, playing = 0, liveEvents = 0;
  const T = 900;
  for (let t=0;t<T;t++){
    const evs = stepMatch(st, 16.67, {move:{x:1,y:1},aim:{x:-1,y:0},selectedWeapon:0,attack:true});
    if (st.phase==='playing') playing++;
    const n = evs.filter(e=>st.fighters.slice(2).some(f=>e.fighterId===f.id||e.ownerId===f.id||e.source?.attackerId===f.id)).length;
    if (n>0 && firstLiveEvent<0) firstLiveEvent=t;
    liveEvents+=n;
  }
  console.log(`R=${R}: first living-seat event at tick ${firstLiveEvent} · ${liveEvents} total · playing ${playing}/${T} · alive ${st.fighters.filter(f=>f.alive).length}`);
}
