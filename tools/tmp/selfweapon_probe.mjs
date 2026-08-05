import { readFileSync } from 'node:fs';
const ROOT='/Users/uribishansky/claude-code/food-arena';
const {createMatch, stepMatch} = await import(ROOT+'/src/game/sim.ts');
const R = await import(ROOT+'/src/game/rules.ts');
const A = JSON.parse(readFileSync(ROOT+'/tools/tmp/arena.frozen.json','utf8'));
const arena={...A, maxSafeRadius:993, build:()=>null, update:()=>{}};
let onion=0, matches=0, ticks=0;
for(const p of R.CHARACTER_IDS){
  const st=createMatch(arena,p,'hamburger'); matches++;
  const inp={move:{x:0,y:0},selectedWeapon:0,attack:false};
  while(st.phase!=='ended' && st.elapsed<120000){
    const evs=stepMatch(st,16.667,inp); ticks++;
    for(const e of evs) if(e.type==='weapon-fired'&&e.fighterRole==='enemy'&&e.weaponKey==='Onion') onion++;
  }
}
console.log(`enemy-Hamburger 'Onion Ring' (self, heal 25, cd 6000) fires: ${onion} across ${matches} matches / ${ticks} ticks`);
const ai = readFileSync(ROOT+'/src/game/ai.ts','utf8');
console.log(`ai.ts pickHighestDamageWeapon skips self : ${/pickHighestDamageWeapon[\s\S]*?w\.type === 'self'\) return;/.test(ai)}`);
console.log(`ai.ts pickSniperWeapon requires 'ranged' : ${/w\.type !== 'ranged'\) continue;/.test(ai)}`);
// Now: can the PLAYER use it? Drive it directly.
const st=createMatch(arena,'hamburger','donut');
st.phase='playing'; st.player.hp=50;
const slot = R.CHARACTERS.hamburger.weapons.findIndex(w=>w.type==='self');
const evs=stepMatch(st,16.667,{move:{x:0,y:0},selectedWeapon:slot,attack:true});
console.log(`player self-heal slot ${slot} -> events ${JSON.stringify(evs.map(e=>e.type+(e.amount?':'+e.amount:'')))}, hp ${st.player.hp}`);
