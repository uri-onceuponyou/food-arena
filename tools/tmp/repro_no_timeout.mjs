import { readFileSync } from 'node:fs';
const ROOT='/Users/uribishansky/claude-code/food-arena';
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const R = await import(`${ROOT}/src/game/rules.ts`);
const A = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`,'utf8'));
const arena = { ...A, build:()=>null, update:()=>{} };
const st = createMatch(arena,'hamburger','donut');
// Both effectively immortal, so the ONLY thing that can end this match is the clock.
st.player.hp=st.player.maxHp=1e12; st.enemy.hp=st.enemy.maxHp=1e12;
let t=0, printed=new Set();
while (t < 260000) {
  st.player.x=arena.center.x; st.player.y=arena.center.y;   // pin at the centre
  stepMatch(st, 16.667, {move:{x:0,y:0},selectedWeapon:0,attack:false});
  t=st.elapsed;
  const k=Math.floor(st.timeRemaining/1000);
  if (st.timeRemaining<=3000 && !printed.has(k)) { printed.add(k);
    console.log(`elapsed ${(st.elapsed/1000).toFixed(1)}s  timeRemaining ${(st.timeRemaining/1000).toFixed(2)}s  safeRadius ${st.safeRadius.toFixed(1)}  phase ${st.phase}  winner ${st.winner}`); }
}
console.log(`\nAFTER ${(st.elapsed/1000).toFixed(0)}s of a ${R.MATCH_DURATION_MS/1000}s match:`);
console.log(`  phase        = ${st.phase}`);
console.log(`  winner       = ${st.winner}`);
console.log(`  timeRemaining= ${st.timeRemaining}`);
console.log(`  safeRadius   = ${st.safeRadius}`);
console.log(`  => the clock reaching zero produces NO phase change and NO winner.`);
