import { readFileSync } from 'node:fs';
const ROOT='/Users/uribishansky/claude-code/food-arena';
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const A = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`,'utf8'));
const arena = { ...A, build:()=>null, update:()=>{} };
const st = createMatch(arena,'hamburger','donut');
while(st.phase==='countdown') stepMatch(st,100,{move:{x:0,y:0},selectedWeapon:0,attack:false});
// Park the player far away; let the AI deadlock and lay trail for 30s.
st.player.x=200; st.player.y=200;
for(let i=0;i<1800;i++){ st.player.x=200; st.player.y=200; stepMatch(st,16.667,{move:{x:0,y:0},selectedWeapon:0,attack:false}); }
console.log('after 30s: enemy at', st.enemy.x.toFixed(0), st.enemy.y.toFixed(0), '| live trail marks:', st.trailMarks.length);
const near = st.trailMarks.filter(m=>Math.hypot(m.x-st.enemy.x,m.y-st.enemy.y)<25);
console.log('marks within 25wu of the enemy:', near.length, '-> potential instant damage:', near.length*3, 'HP  (player max HP 100)');
// Now teleport the player onto the pile and step ONE tick.
st.player.x=st.enemy.x; st.player.y=st.enemy.y;
const hpBefore=st.player.hp;
const evs=stepMatch(st,16.667,{move:{x:0,y:0},selectedWeapon:0,attack:false});
console.log('ONE 16.7ms tick standing on the pile:', hpBefore,'->',st.player.hp,'HP  (', evs.filter(e=>e.type==='hit-landed').length,'simultaneous hit events )');
