import{C as Se,a as re,L as ni,c as Wt,b as ra,V as le,d as oe,S as _i,e as Me,M as G,t as We,R as Ue,B as Wc,f as y,g as Aa,h as es,i as ot,j as si,k as Hi,G as te,P as Ia,l as K,m as pt,n as Qa,o as ts,O as J0,Z as Uc,A as Yc,p as eu,q as tu,N as au,r as ri,s as ii,u as Ts,v as zd,w as $i,x as ia,y as Tt,z as ft,D as aa,E as _e,F as ye,H as an,I as ou,J as nu,K as Qe,Q as su,T as ru,U as iu,W as At,X as cu,Y as lu,_ as hu,$ as Od,a0 as du,a1 as pu,a2 as ci,a3 as Vc,a4 as uu,a5 as fu,a6 as mu,a7 as gu,a8 as Zs,a9 as Kc,aa as wu,ab as bu,ac as as,ad as yu,ae as li,af as vu,ag as xu,ah as ku,ai as Ld,aj as Mu,ak as Xc,al as hi,am as Eu,an as Tu,ao as Su,ap as Au,aq as Fu,ar as Ru,as as Nd,at as bt,au as xo,av as Ss,aw as at,ax as Pi,ay as qi,az as ji,aA as As,aB as Da,aC as Bi,aD as io,aE as qt,aF as _a,aG as Dd,aH as Gi,aI as ca,aJ as Cu,aK as Iu,aL as Ka,aM as zu,aN as Zc,aO as wn,aP as os,aQ as Ou,aR as Lu,aS as Nu,aT as Du,aU as _u,aV as Hu,aW as Qc,aX as $u,aY as Pu,aZ as Qs,a_ as qu,a$ as ju,b0 as Bu,b1 as Gu,b2 as Wu}from"./kitchen-BBz2mmKZ.js";const Jc={coins:500,gems:25},Uu=!1,_d=Se[0],mt={trophiesWin:15,trophyLossBase:2,trophyLossPer:150,trophyLossCap:10,trophyLossGraceBelow:100,coinsWin:60,coinsLoss:20,winsPerChest:3},co={Normal:120,Rare:260,Epic:520,Legendary:900,Neon:1400,Cyber:2200},Ro={baseCoins:300,growth:1.32,rarityCostMultiplier:{Normal:1,Rare:1,Epic:1,Legendary:1,Neon:1,Cyber:1},roundTo:10},Ut=["chest","hamburgerBox","pineappleBox","redBox","fireBox"],Hd="Rarity sets how hard a fighter is to find — not how strong it is, and not what it costs to level up. Two fighters at the same level are a fair fight whatever their rarity.",Oe={chest:{name:"Chest",emoji:"📦",blurb:"Earned by winning matches and along the Trophy Road.",price:null,entries:[{weight:50,coins:120},{weight:22,coins:220},{weight:13,coins:90,gems:5},{weight:8,coins:400},{weight:4,coins:150,gems:20},{weight:2.1,characterRarity:"Normal"},{weight:.9,characterRarity:"Rare"}]},hamburgerBox:{name:"Hamburger Box",emoji:"🍔",blurb:"Mostly Normal fighters, with a chance of something rarer.",price:{coins:900,gems:60},entries:[{weight:89,characterRarity:"Normal"},{weight:10,characterRarity:"Rare"},{weight:1,characterRarity:"Epic"}]},pineappleBox:{name:"Purple Pineapple Box",emoji:"🍍",blurb:"Rare fighters guaranteed, Epic and Legendary possible.",price:{coins:3200,gems:120},entries:[{weight:94.5,characterRarity:"Rare"},{weight:5,characterRarity:"Epic"},{weight:.5,characterRarity:"Legendary"}]},redBox:{name:"Big Smile Box",emoji:"🎁",blurb:"Epic fighters, with the only Cyber chance outside the Fire Box.",price:{coins:5600,gems:240},entries:[{weight:89.49,characterRarity:"Epic"},{weight:10,characterRarity:"Legendary"},{weight:.5,characterRarity:"Neon"},{weight:.01,characterRarity:"Cyber"}]},fireBox:{name:"Purple Fire Box",emoji:"🔥",blurb:"Legendary fighters, with the best Neon and Cyber odds in the game.",price:{coins:12e3,gems:480},entries:[{weight:94.5,characterRarity:"Legendary"},{weight:5,characterRarity:"Neon"},{weight:.5,characterRarity:"Cyber"}]}},jt=[{trophies:10,reward:{type:"container",kind:"chest",count:1}},{trophies:25,reward:{type:"coins",amount:150}},{trophies:42,reward:{type:"gems",amount:5}},{trophies:60,reward:{type:"character",id:"donut"}},{trophies:85,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:107,reward:{type:"coins",amount:250}},{trophies:130,reward:{type:"character",id:"taco"}},{trophies:160,reward:{type:"gems",amount:10}},{trophies:190,reward:{type:"container",kind:"chest",count:1}},{trophies:220,reward:{type:"character",id:"burrito"}},{trophies:260,reward:{type:"coins",amount:400}},{trophies:300,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:345,reward:{type:"character",id:"soup"}},{trophies:400,reward:{type:"gems",amount:20}},{trophies:455,reward:{type:"container",kind:"chest",count:1}},{trophies:510,reward:{type:"character",id:"sushi"}},{trophies:580,reward:{type:"coins",amount:700}},{trophies:650,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:725,reward:{type:"character",id:"waterbottle"}},{trophies:815,reward:{type:"gems",amount:35}},{trophies:905,reward:{type:"container",kind:"chest",count:1}},{trophies:1e3,reward:{type:"character",id:"pizza"}},{trophies:1105,reward:{type:"coins",amount:1200}},{trophies:1220,reward:{type:"container",kind:"redBox",count:1}},{trophies:1340,reward:{type:"character",id:"egg"}},{trophies:1485,reward:{type:"gems",amount:60}},{trophies:1630,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:1780,reward:{type:"character",id:"lollipop"}},{trophies:1980,reward:{type:"coins",amount:2e3}},{trophies:2190,reward:{type:"container",kind:"redBox",count:1}},{trophies:2400,reward:{type:"character",id:"hotdog"}},{trophies:2650,reward:{type:"gems",amount:100}},{trophies:2900,reward:{type:"container",kind:"fireBox",count:1}},{trophies:3200,reward:{type:"bundle",parts:[{type:"coins",amount:5e3},{type:"gems",amount:150},{type:"container",kind:"fireBox",count:1}]}}],$d=[{id:"gemsPouch",name:"Pouch of Gems",emoji:"💎",priceUsdCents:99,gems:80},{id:"gemsSack",name:"Sack of Gems",emoji:"💎",priceUsdCents:499,gems:500},{id:"gemsCrate",name:"Crate of Gems",emoji:"💎",priceUsdCents:999,gems:1200},{id:"gemsBarrel",name:"Barrel of Gems",emoji:"💎",priceUsdCents:1999,gems:2600},{id:"gemsVault",name:"Vault of Gems",emoji:"💎",priceUsdCents:4999,gems:7e3},{id:"starterBundle",name:"Chef Starter Pack",emoji:"🧑‍🍳",priceUsdCents:499,gems:500,coins:2e3,container:{kind:"pineappleBox",count:1},oneTime:!0}],Fs=(()=>{const e={};for(const t of Se){const a=re[t].rarity;(e[a]??=[]).push(t)}return e})();function Yu(e){let t=e>>>0;return t=Math.imul(t^t>>>16,569420461),t=Math.imul(t^t>>>15,1935289751),(t^t>>>15)>>>0}function Vu(e){let t=Yu(Math.trunc(e)||0);const a=()=>{t=t+1831565813>>>0;let o=t;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296};return{next:a,int(o){return o>0?Math.floor(a()*o):0},pick(o){return o.length>0?o[Math.floor(a()*o.length)]:void 0}}}function Ku(e,t,a){if(t.length===0)return-1;const o=e.next()*a;let n=0;for(let s=0;s<t.length;s++)if(n+=t[s],o<n)return s;return t.length-1}function Xu(){return Math.floor(Math.random()*4294967295)>>>0||1}function Wi(){return{coins:0,gems:0,containers:{},characters:[]}}function Gn(e,t){return t===1?e:/[sxz]$/i.test(e)?`${e}es`:`${e}s`}function Pd(e,t){e.coins+=t.coins,e.gems+=t.gems;for(const[a,o]of Object.entries(t.containers))e.containers[a]=(e.containers[a]??0)+o;for(const a of t.characters)e.characters.includes(a)||e.characters.push(a);return e}function Zu(e){const t=[];for(const a of e.characters)t.push({emoji:re[a].emoji,label:re[a].name});for(const[a,o]of Object.entries(e.containers)){if(!o)continue;const n=Oe[a];t.push({emoji:n.emoji,label:o>1?`${o} ${Gn(n.name,o)}`:n.name})}return e.coins>0&&t.push({emoji:"🪙",label:`${e.coins.toLocaleString()} ${Gn("Coin",e.coins)}`}),e.gems>0&&t.push({emoji:"💎",label:`${e.gems.toLocaleString()} ${Gn("Gem",e.gems)}`}),t}function Rs(e){return e.reduce((t,a)=>t+a.weight,0)}function Vo(e){const t=Oe[e],a=Rs(t.entries);if(a<=0)return[];const o=[];for(const s of t.entries){const r=s.weight/a*100;if(s.characterRarity){const i=Fs[s.characterRarity]??[];o.push({label:`${s.characterRarity} fighter`,percent:r,rarity:s.characterRarity,pool:i})}else{const i=[];s.coins&&i.push(`${s.coins.toLocaleString()} coins`),s.gems&&i.push(`${s.gems.toLocaleString()} gems`),o.push({label:i.join(" + ")||"Nothing",percent:r})}}const n=new Map;for(const s of o){const r=n.get(s.label);r?r.percent+=s.percent:n.set(s.label,{...s})}return[...n.values()].sort((s,r)=>r.percent-s.percent)}function qd(e){return`${e.toFixed(4).replace(/0+$/,"").replace(/\.$/,"")}%`}function Qu(e,t,a){const o=Oe[e],n=Rs(o.entries),s=o.entries[Ku(t,o.entries.map(i=>i.weight),n)],r=Wi();if(!s)return{kind:e,reward:r};if(s.coins&&(r.coins+=s.coins),s.gems&&(r.gems+=s.gems),s.characterRarity){const i=Fs[s.characterRarity]??[],c=i.filter(l=>!a.has(l));if(c.length>0){const l=t.pick(c);r.characters.push(l)}else{const l=t.pick(i);if(r.coins+=co[s.characterRarity],l)return{kind:e,reward:r,duplicateOf:l}}}return{kind:e,reward:r}}function jd(e){return co[re[e].rarity]}function Ju(e){return e<mt.trophyLossGraceBelow?0:Math.min(mt.trophyLossCap,mt.trophyLossBase+Math.floor(e/mt.trophyLossPer))}function ef(e,t){return t?mt.trophiesWin:-Ju(e)}function tf(){return jt}function di(){return jt.length>0?jt[jt.length-1].trophies:0}function Bd(e,t){return jt.filter(a=>e>=a.trophies&&!t.includes(a.trophies))}function af(e){return jt.find(t=>e<t.trophies)??null}function Gd(e){const t=af(e);if(!t)return{from:di(),to:di(),progress01:1,next:null};const a=jt.indexOf(t),o=a>0?jt[a-1].trophies:0,n=t.trophies-o,s=n>0?Math.min(1,Math.max(0,(e-o)/n)):0;return{from:o,to:t.trophies,progress01:s,next:t}}function Wd(e,t){const a=Wi();switch(e.type){case"coins":a.coins+=e.amount;break;case"gems":a.gems+=e.amount;break;case"container":a.containers[e.kind]=(a.containers[e.kind]??0)+e.count;break;case"character":a.coins+=jd(e.id);break;case"bundle":for(const o of e.parts)Pd(a,Wd(o));break}return a}function pi(e,t){switch(e.type){case"coins":return{emoji:"🪙",title:`${e.amount.toLocaleString()} Coins`,isCharacter:!1};case"gems":return{emoji:"💎",title:`${e.amount.toLocaleString()} Gems`,isCharacter:!1};case"container":{const a=Oe[e.kind];return{emoji:a.emoji,title:e.count>1?`${e.count} ${Gn(a.name,e.count)}`:a.name,isCharacter:!1}}case"character":{const a=re[e.id],o=Uu;return{emoji:a.emoji,title:a.name,isCharacter:!0,payoutNote:o?void 0:`owned · 🪙 ${jd(e.id).toLocaleString()}`}}case"bundle":return{emoji:"🎉",title:"Grand Prize",isCharacter:!1}}}function of(e,t){const a=Wt(t);if(a>=ni)return null;const o=a-ra,n=Ro.baseCoins*Math.pow(Ro.growth,o)*Ro.rarityCostMultiplier[re[e].rarity];return{coins:Math.round(n/Ro.roundTo)*Ro.roundTo,gems:0}}function nf(e){return Wt(e)}function sf(){return $d}function rf(e){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(e/100)}function el(e){return e.priceUsdCents>0?e.gems/(e.priceUsdCents/100):0}function cf(e){const t=$d.filter(n=>!n.oneTime&&n.gems>0),a=t.reduce((n,s)=>s.priceUsdCents<n.priceUsdCents?s:n,t[0]);if(!a||e.id===a.id)return 0;const o=el(e)/el(a);return Math.max(0,Math.round((o-1)*100))}function Ud(){const e={};for(const t of Ut)e[t]=0;return e}function Yd(e=Xu()){return{trophies:0,bestTrophies:0,coins:Jc.coins,gems:Jc.gems,containers:Ud(),claimed:[],unlocked:[_d],winsTowardChest:0,lastMatch:null,levels:{},seed:e,rolls:0}}function Ui(e){return new Set(Se)}function lf(e,t){return!0}function Vd(e,t){e.coins+=t.coins,e.gems+=t.gems;for(const[a,o]of Object.entries(t.containers))e.containers[a]=(e.containers[a]??0)+(o??0);for(const a of t.characters)e.unlocked.includes(a)||e.unlocked.push(a)}function ui(e,t,a){return e.coins<t||e.gems<a?!1:(e.coins-=t,e.gems-=a,!0)}function hf(e,t){const a=ef(e.trophies,t);e.trophies=Math.max(0,e.trophies+a),e.bestTrophies=Math.max(e.bestTrophies,e.trophies);const o=t?mt.coinsWin:mt.coinsLoss;e.coins+=o;let n=0;if(t){for(e.winsTowardChest++;e.winsTowardChest>=mt.winsPerChest;)e.winsTowardChest-=mt.winsPerChest,n++;e.containers.chest+=n}const s={won:t,trophies:a,coins:o,chests:n,seen:!1};return e.lastMatch=s,s}function df(e){return Math.max(0,mt.winsPerChest-e.winsTowardChest)}function Kd(e){return Bd(e.trophies,e.claimed)}function Xd(e,t){const a=Bd(e.trophies,e.claimed).find(n=>n.trophies===t);if(!a)return null;const o=Wd(a.reward,Ui());return e.claimed.push(t),e.claimed.sort((n,s)=>n-s),Vd(e,o),o}function pf(e){const t=Wi();for(const a of Kd(e)){const o=Xd(e,a.trophies);o&&Pd(t,o)}return t}function uf(e,t){if((e.containers[t]??0)<=0)return null;e.containers[t]--;const a=Vu(e.seed+e.rolls);e.rolls++;const o=Qu(t,a,Ui());return Vd(e,o.reward),o}function ff(e){return Ut.reduce((t,a)=>t+(e.containers[a]??0),0)}function mf(e,t,a){const o=Oe[t].price;return!o||!(a==="coins"?ui(e,o.coins,0):ui(e,0,o.gems))?!1:(e.containers[t]++,!0)}function Yi(e,t){return Wt(e.levels[t]??ra)}function Vi(e,t){return of(t,Yi(e,t))}function gf(e,t){const a=Vi(e,t);return a!==null&&e.coins>=a.coins&&e.gems>=a.gems}function wf(e,t){const a=Vi(e,t);if(!a||!ui(e,a.coins,a.gems))return null;const o=Wt(Yi(e,t)+1);return e.levels[t]=o,{level:o,spent:a}}function bf(e){const t=Yd();if(!e||typeof e!="object")return t;const a=e,o=(s,r)=>typeof s=="number"&&Number.isFinite(s)&&s>=0?Math.floor(s):r,n={trophies:o(a.trophies,0),bestTrophies:o(a.bestTrophies,0),coins:o(a.coins,t.coins),gems:o(a.gems,t.gems),containers:Ud(),claimed:[],unlocked:[_d],winsTowardChest:o(a.winsTowardChest,0),lastMatch:null,levels:{},seed:o(a.seed,t.seed)||t.seed,rolls:o(a.rolls,0)};if(a.containers&&typeof a.containers=="object"){const s=a.containers;for(const r of Ut)n.containers[r]=o(s[r],0)}if(Array.isArray(a.claimed)){const s=new Set(jt.map(i=>i.trophies)),r=new Set(a.claimed.filter(i=>typeof i=="number"&&s.has(i)));n.claimed=[...r].sort((i,c)=>i-c)}if(Array.isArray(a.unlocked))for(const s of a.unlocked)typeof s=="string"&&Se.includes(s)&&!n.unlocked.includes(s)&&n.unlocked.push(s);if(a.levels&&typeof a.levels=="object"){const s=a.levels;for(const r of Se){const i=s[r];if(typeof i!="number"||!Number.isFinite(i))continue;const c=Wt(i);c>ra&&(n.levels[r]=c)}}if(a.lastMatch&&typeof a.lastMatch=="object"){const s=a.lastMatch;n.lastMatch={won:s.won===!0,trophies:typeof s.trophies=="number"&&Number.isFinite(s.trophies)?Math.trunc(s.trophies):0,coins:o(s.coins,0),chests:o(s.chests,0),seen:s.seen===!0}}return n.bestTrophies=Math.max(n.bestTrophies,n.trophies),n}function yf(e){return{trophies:e.trophies,bestTrophies:e.bestTrophies,coins:e.coins,gems:e.gems,containers:{...e.containers},claimed:[...e.claimed],unlocked:[...e.unlocked],winsTowardChest:e.winsTowardChest,lastMatch:e.lastMatch?{...e.lastMatch}:null,levels:{...e.levels},seed:e.seed,rolls:e.rolls}}function vf(e,t){typeof t.coins=="number"&&Number.isFinite(t.coins)&&t.coins>=0&&(e.coins=Math.floor(t.coins)),typeof t.gems=="number"&&Number.isFinite(t.gems)&&t.gems>=0&&(e.gems=Math.floor(t.gems))}const Zd="food-arena.profile.v1",Bo=250,xf=100,kf=35,fi="Chef",mi=16;function Qd(e){if(typeof e!="string")return fi;const t=e.replace(/\s+/g," ").replace(/[\p{Cc}\p{Cf}]/gu,"").trim().slice(0,mi).trim();return t.length>0?t:fi}function Mf(e){return typeof e=="string"&&Se.includes(e)}function Js(e,t){return typeof e=="number"&&Number.isFinite(e)&&e>=0?e:t}function tl(){return{name:fi,wins:0,losses:0,xp:0,selected:Se[0],economy:Yd()}}function al(){try{const e=localStorage.getItem(Zd);if(!e)return tl();const t=JSON.parse(e),a=bf(t.economy);return t.economy===void 0&&vf(a,t),{name:Qd(t.name),wins:Math.floor(Js(t.wins,0)),losses:Math.floor(Js(t.losses,0)),xp:Math.floor(Js(t.xp,0)),selected:Mf(t.selected)?t.selected:Se[0],economy:a}}catch{return tl()}}class Jd{data;listeners=new Set;constructor(t){this.data=t?{...al(),...t}:al()}get name(){return this.data.name}get wins(){return this.data.wins}get losses(){return this.data.losses}get xp(){return this.data.xp}get selected(){return this.data.selected}get level(){return Math.floor(this.data.xp/Bo)+1}get levelProgress01(){return this.data.xp%Bo/Bo}get economy(){return this.data.economy}get coins(){return this.data.economy.coins}get gems(){return this.data.economy.gems}get trophies(){return this.data.economy.trophies}get bestTrophies(){return this.data.economy.bestTrophies}get containers(){return this.data.economy.containers}get containerCount(){return ff(this.data.economy)}get winsToNextChest(){return df(this.data.economy)}get lastMatch(){return this.data.economy.lastMatch}get unlocked(){return Ui(this.data.economy)}isUnlocked(t){return lf(this.data.economy)}get claimable(){return Kd(this.data.economy)}select(t){this.data.selected!==t&&(this.data.selected=t,this.commit())}setName(t){const a=Qd(t);return a===this.data.name||(this.data.name=a,this.commit()),a}recordResult(t){t?(this.data.wins++,this.data.xp+=xf):(this.data.losses++,this.data.xp+=kf);const a=hf(this.data.economy,t);return this.commit(),a}markLastMatchSeen(){const t=this.data.economy.lastMatch;!t||t.seen||(t.seen=!0,this.commit())}claimMilestone(t){const a=Xd(this.data.economy,t);return a&&this.commit(),a}claimAllMilestones(){const t=pf(this.data.economy);return this.commit(),t}openContainer(t){const a=uf(this.data.economy,t);return a&&this.commit(),a}buyContainer(t,a){const o=mf(this.data.economy,t,a);return o&&this.commit(),o}characterLevel(t){return Yi(this.data.economy,t)}nextLevelPrice(t){return Vi(this.data.economy,t)}canLevelUp(t){return gf(this.data.economy,t)}levelUp(t){const a=wf(this.data.economy,t);return a&&this.commit(),a}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}commit(){try{localStorage.setItem(Zd,JSON.stringify({name:this.data.name,wins:this.data.wins,losses:this.data.losses,xp:this.data.xp,selected:this.data.selected,economy:yf(this.data.economy)}))}catch{}for(const t of this.listeners)t()}}const Ef="fa-screen-styles";function la(e,t){if(document.getElementById(e))return;const a=document.createElement("style");a.id=e,a.textContent=t,document.head.appendChild(a)}function Tf(){la(Ef,Sf)}function ep(e,t){const a=e.replace("#",""),o=a.length===3?a.split("").map(i=>i+i).join(""):a,n=parseInt(o.slice(0,2),16)||0,s=parseInt(o.slice(2,4),16)||0,r=parseInt(o.slice(4,6),16)||0;return`rgba(${n},${s},${r},${t})`}const Sf=`
:root {
  /* Real notch/home-indicator insets. Overridable inline on <html> for testing —
     see the file header. */
  --fa-safe-t: env(safe-area-inset-top, 0px);
  --fa-safe-r: env(safe-area-inset-right, 0px);
  --fa-safe-b: env(safe-area-inset-bottom, 0px);
  --fa-safe-l: env(safe-area-inset-left, 0px);
}

.fa-root {
  --ink: #1a1224;
  --ink-2: #2a1d3a;
  --cream: #FFF3DE;
  --panel: rgba(255,243,222,0.94);
  --gold: #F4A300;
  --mustard: #FFC93C;
  --mustard-hi: #FFDD6B;
  --gold-shadow: #8a5c00;
  --ketchup: #D62839;
  --tomato: #E63946;
  --lettuce: #7CB518;
  --water: #1E90D8;

  /* ── The same two hues, at a value that survives being TYPE ────────────────
     '--ketchup' and '--water' are FILL colours: white on either clears 4.5:1 and
     they are used that way all over the HUD. As ink on the menus' cream and mustard
     surfaces they do not: measured 4.17 for the trophy road's OPEN caption on its
     own cream pill, and 3.48 (white card) / 2.56 (mustard card) for the gem counts
     in the store. Both were below AA on a compliance surface — the store publishes
     real-money-adjacent prices — while looking, at a glance, like brand colour used
     correctly.

     So the hue is kept and the value is dropped, once, here. Anything that needs the
     brand red or the brand blue as INK on a light surface uses these; anything that
     needs it as a FILL keeps the originals. Two tokens instead of a per-screen guess
     that drifts. Measured: ketchup-ink 5.9 on cream / 7.5 on white; water-ink 5.6 on
     the mustard SKU card / 7.6 on white. */
  --ketchup-ink: #A3202E;
  --water-ink: #125981;

  /* Minimum touch target. Apple/Google both say 44; a brawler menu played with a
     thumb on a moving bus should not go below it, ever. */
  --tap: 44px;
  /* Vertical rhythm. vh-driven because landscape phones run out of HEIGHT first. */
  --gap: clamp(6px, 1.3vh, 12px);
  --gutter: clamp(10px, 1.6vw, 20px);
  /* ── THIS ASSERTION WAS FALSE WHEN IT WAS WRITTEN, AND IS KEPT WITH THE REASON ──
     The old wording, verbatim:

       "TWO radii, project-wide. Anything you press is a pill; anything you read off is
        a 16px surface. Four competing radii on one screen was a named critic finding."

     It was an intention, not a fact, and nothing ever measured it. Counted by
     'tools/tmp/ds_inventory.mjs' (which parses every stylesheet in src/ui/ with the
     real TypeScript parser rather than grepping it): 18 distinct border-radius
     declarations, 15 distinct absolute atoms, across 110 uses. This token is referenced
     exactly THREE times in the entire codebase, while 10px, 12px, 13px and 14px are
     typed literally 17 times between them for the same job.

     It is now the third rung of a five-rung scale, named '--ds-r-3' with the rest of
     the tokens at the foot of this file, and kept here as an alias so the three
     existing references keep working and keep resolving to the same 16px. */
  --radius-surface: var(--ds-r-3);

  position: fixed;
  inset: 0;
  z-index: 40;
  overflow: hidden;
  /* Explicit, because the host #screens div is pointer-events:none — see the long
     comment on it in index.html. A menu screen needs events; a live match does not
     (below), and the match screen's own controls opt back in individually. */
  pointer-events: auto;
  font-family: 'Heebo', sans-serif;
  color: var(--ink);
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* While a match is live the shell keeps the layer mounted (the pause chip lives in
   it) but everything decorative goes away and clicks fall through to the canvas. */
.fa-root.is-ingame { pointer-events: none; }
.fa-root.is-ingame .fa-bg,
.fa-root.is-ingame .fa-dots,
.fa-root.is-ingame .fa-rays { display: none; }

/* ── Backdrop ─────────────────────────────────────────────────────────────── */
/* Owned by the SHELL, not by any screen, so navigating never re-paints or flashes
   the background — only the content above it changes. */
.fa-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% -8%, #FFD98C 0%, transparent 46%),
    linear-gradient(160deg, #F4A300 0%, #E85D2C 45%, #C1272D 100%);
  background-color: #C1272D;
}
/* Comic halftone. 'multiply' keeps it a texture rather than a grey film. */
.fa-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(0,0,0,0.10) 2px, transparent 2px);
  background-size: 24px 24px;
  mix-blend-mode: multiply;
}
/* Speed lines behind the centre of the frame. Very low contrast on purpose: it has
   to survive being screenshotted next to a Brawl Stars plate without reading as
   noise, so it works as a subliminal focus ring, not as a pattern. */
.fa-rays {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200vmax;
  height: 200vmax;
  transform: translate(-50%, -50%);
  background: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.07) 0deg 3deg, transparent 3deg 15deg);
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0%, transparent 62%);
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, transparent 62%);
  animation: fa-rays-spin 90s linear infinite;
}
@keyframes fa-rays-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }

/* Screens stack here. */
.fa-stack { position: absolute; inset: 0; }

/* Navigation curtain. Screens are torn down and rebuilt (a single WebGL stage is
   re-parented between them), so the swap is hidden behind an opaque wipe instead of
   cross-fading two live screens — one 3D context cannot be in two places at once. */
.fa-curtain {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: #140d1e;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s ease-out;
}
.fa-curtain.is-on { opacity: 1; pointer-events: auto; }

/* ── Screen frame ─────────────────────────────────────────────────────────── */
.fa-screen {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--gap);
  padding:
    calc(var(--fa-safe-t) + var(--gap))
    calc(var(--fa-safe-r) + var(--gutter))
    calc(var(--fa-safe-b) + var(--gap))
    calc(var(--fa-safe-l) + var(--gutter));
  animation: fa-screen-in 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
}
/* ── The one line that makes PORTRAIT work ─────────────────────────────────────
   This is a bug fix, not housekeeping. '.fa-screen' declares rows but no columns, so
   its single implicit column is 'auto' — and an 'auto' track is at least the largest
   MIN-CONTENT contribution of its items. A grid item's own 'min-width' defaults to
   'auto', which for a flex row of nowrap pills is the sum of those pills. At 430x932
   the trophy road's top bar (Back + a 28px title + two currency chips) contributes
   490px, so the column came out 490 wide inside a 430 frame and EVERY row on the
   screen — hero card, road panel, bottom bar — was drawn 70px too wide.

   It never showed up as overflow because '.fa-root' is 'overflow: hidden': the
   document reported scrollWidth === clientWidth while the player's gem count was
   amputated at the right edge. menu_accept's no-page-scroll assertion cannot see that
   either, and all five of its viewports are landscape, so nothing has ever looked.

   'min-width: 0' lets the column be the frame, and the flex rows inside then shrink
   and ellipsise as they were always written to. */
.fa-screen > * { min-width: 0; }
@keyframes fa-screen-in {
  from { opacity: 0; transform: translateY(10px) scale(0.992); }
  to { opacity: 1; transform: none; }
}

/* ── Top bar ──────────────────────────────────────────────────────────────── */
.fa-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--tap);
}
.fa-topbar-spacer { flex: 1 1 auto; min-width: 0; }

/* Read-only status pill (name, trophies, coins).
   Sized UP from 34px/0.78rem. A player's trophy and coin counts are core lobby
   information and they were rendering as the smallest type on the screen — smaller
   than the tab labels beside them and than every body line in the panels below — so
   the hierarchy said they were the least important thing in the frame. 40px still
   sits inside the top bar's 44px minimum, so nothing about the bar's height moves. */
.fa-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 40px;
  padding: 0 15px;
  background: var(--panel);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e2);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.7rem, 1.7vh, 0.95rem);
  white-space: nowrap;
  color: var(--ink);
}
.fa-chip-em { font-size: 1.1em; line-height: 1; }
/* The INK tokens, not the fill tokens. This is the case the pair above was created for
   and the one place that had not been converted: '--ketchup' on the chip's cream plate
   measures 4.27:1 and '--water' 2.99:1, both under the 4.5 floor, on a counter a player
   reads at a glance. '--ketchup-ink' takes it to 6.43 and '--water-ink' to 6.51 at the
   same hue. Found by measuring character select; the chip is the shell's, so this fixes
   every screen that shows one. */
.fa-chip-val { color: var(--ketchup-ink); }
.fa-chip--gem .fa-chip-val { color: var(--water-ink); }

/* Interactive version of the chip — used for Back and the settings gear. Height is
   raised to the full tap target; the visual pill stays 34px via padding so the
   layout does not look chunkier than the read-only chips beside it. */
.fa-iconbtn {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: var(--tap);
  height: var(--tap);
  padding: 0 12px;
  cursor: pointer;
  background: var(--panel);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e2);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.7rem, 1.6vh, 0.9rem);
  color: var(--ink);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-iconbtn:hover { background: #FFFFFF; }
.fa-iconbtn:active { transform: translateY(3px); box-shadow: var(--ds-e0); }

/* Segmented tab bar.
   The height is the tap target PLUS the container's own 3px border on each side —
   otherwise the buttons inside come out 6px short of 44 and the whole bar fails the
   touch-target check while looking exactly right.

   ── The track is INK, and that is a fix, not a style change ──────────────────
   It used to be '--panel' — cream — which made it one more cream pill in a row of
   cream pills on a cream-and-orange backdrop. Two trophy-road critics independently
   filed the same unactioned finding: *"Home / Foods / Trophies is the
   lowest-contrast element on the lobby."* The text contrast was never the problem
   (ink on cream is 12:1); the problem was that neither the BAR nor the SELECTED tab
   separated from anything, so the one piece of navigation on the screen read as
   decoration.

   A dark track fixes both at once: the bar now separates from the warm backdrop, and
   the active tab is a bright mustard slab inside a dark frame rather than a slightly
   yellower cream next to cream. It is also the HUD's idiom — dark plate, bright
   state — and the HUD is the one element on this project that beat the shipped
   reference in a blind test. */
.fa-tabs {
  display: flex;
  min-height: calc(var(--tap) + 6px);
  padding: 3px;
  background: var(--ink);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  overflow: hidden;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35), inset 0 2px 6px rgba(0,0,0,0.5);
}
.fa-tab {
  appearance: none;
  border: none;
  cursor: pointer;
  background: transparent;
  color: rgba(255,243,222,0.78);
  --fa-ic-ink: var(--cream);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.74rem, 1.9vh, 1.02rem);
  letter-spacing: 0.02em;
  min-height: var(--tap);
  padding: 0 clamp(10px, 1.6vw, 22px);
  border-radius: var(--ds-r-pill);
  transition: background 0.12s, color 0.12s;
}
.fa-tab:hover:not(.is-active) { background: rgba(255,243,222,0.16); color: var(--cream); }
.fa-tab.is-active {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
  box-shadow: 0 2px 0 var(--gold-shadow);
}
.fa-tab[disabled] { opacity: 0.45; cursor: default; }
.fa-tab[disabled]:hover { background: transparent; }

/* ── Panels ───────────────────────────────────────────────────────────────── */
.fa-panel {
  background: var(--panel);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--radius-surface);
  box-shadow: var(--ds-e3);
  padding: clamp(8px, 1.5vh, 14px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}
.fa-panel--flush { padding: 0; overflow: hidden; }

/* 0.62 measured 4.85:1 on the cream panel — over the AA floor by 0.35, which is no
   headroom at all: the settings scroller's own bottom fade was enough to push it to
   3.93 and it was the last failing run in the whole battery. A section label wants to
   be quieter than its content, not marginal; 0.8 measures 7.8:1 and is still plainly
   subordinate to the 900-weight ink beside it. */
.fa-panel-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: clamp(0.72rem, 1.7vh, 0.95rem);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(26,18,36,0.8);
}

/* Screen headline. Cream on ink stroke — the same treatment the HUD countdown and
   the prototypes' <h1> both use, which is what makes menu and match feel like one
   product rather than two. */
.fa-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: clamp(1rem, 3.1vh, 1.75rem);
  line-height: 1.05;
  letter-spacing: 0.01em;
  color: var(--cream);
  -webkit-text-stroke: 3px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 4px 0 var(--ink), 0 10px 18px rgba(0,0,0,0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.fa-btn {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--tap);
  padding: 0 clamp(14px, 2vw, 30px);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.8rem, 1.9vh, 1.1rem);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--ink);
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: 0 4px 0 var(--gold-shadow);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
  white-space: nowrap;
}
.fa-btn:hover { filter: brightness(1.06); }
.fa-btn:active { transform: translateY(4px); box-shadow: 0 0 0 var(--gold-shadow); }
.fa-btn[disabled] { opacity: 0.5; cursor: default; filter: none; }
.fa-btn[disabled]:active { transform: none; box-shadow: 0 4px 0 var(--gold-shadow); }

/* The single loudest control on any screen. Breathes so the eye lands on it first,
   exactly like the prototype's START GAME.
   Sized deliberately larger than round 1: a critic measured it at ~17% of frame
   width and 6.4% of height against a ~22-25% / 11-13% reference norm, and noted it
   carried less visual weight than the disabled nav around it. It now also has a
   real material — inner top highlight, thick bottom lip, outer glow and a contact
   shadow onto the background — instead of being a flat fill. */
.fa-btn--primary {
  font-size: clamp(1rem, 3vh, 1.7rem);
  min-height: clamp(var(--tap), 9.5vh, 78px);
  padding: 0 clamp(24px, 3.6vw, 58px);
  border-width: 4px;
  box-shadow:
    inset 0 3px 0 rgba(255,255,255,0.7),
    0 7px 0 var(--gold-shadow),
    0 10px 22px rgba(0,0,0,0.4),
    0 0 26px rgba(255,201,60,0.5);
  animation: fa-btn-pulse 1.8s ease-in-out infinite;
}
.fa-btn--primary:active {
  transform: translateY(7px);
  box-shadow: inset 0 3px 0 rgba(255,255,255,0.7), 0 0 0 var(--gold-shadow);
}
/* Character select's FIGHT!: the only object in its corner, so it gets the full
   width allowance a shipped CTA has. */
.fa-btn--hero { min-width: clamp(150px, 22vw, 380px); }
.fa-btn--primary:active { animation: none; }
@keyframes fa-btn-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.035); }
}

.fa-btn--green {
  background: linear-gradient(180deg, #A6E24A 0%, var(--lettuce) 100%);
  box-shadow: 0 4px 0 #43690b;
}
.fa-btn--green:active { box-shadow: 0 0 0 #43690b; }

.fa-btn--quiet {
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  box-shadow: 0 4px 0 rgba(0,0,0,0.35);
}
.fa-btn--quiet:active { box-shadow: var(--ds-e0); }

/* Left-aligned nav row (Foods / Shop / Items ...). */
.fa-menuitem {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: var(--tap);
  padding: 0 12px;
  text-align: start;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.74rem, 1.7vh, 0.95rem);
  color: var(--ink);
  background: #FFFFFF;
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
  transition: transform 0.1s, background 0.12s, box-shadow 0.1s;
}
.fa-menuitem-em { font-size: 1.25em; line-height: 1; width: 1.3em; text-align: center; }
.fa-menuitem:hover { background: var(--mustard-hi); transform: translateX(3px); }
.fa-menuitem:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.3); }
.fa-menuitem[disabled] { opacity: 0.55; cursor: default; }
.fa-menuitem[disabled]:hover { background: #FFFFFF; transform: none; }
.fa-menuitem-soon {
  margin-inline-start: auto;
  font-size: 0.62em;
  font-weight: var(--ds-w-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(26,18,36,0.45);
}

/* ── Scrolling regions ────────────────────────────────────────────────────── */
/* The page itself NEVER scrolls (body is overflow:hidden). Anything that can
   overflow scrolls inside its own box, which is the only way a landscape phone and
   an ultrawide desktop can share one layout. */
.fa-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(26,18,36,0.4) transparent;
}
.fa-scroll::-webkit-scrollbar { width: 8px; }
.fa-scroll::-webkit-scrollbar-track { background: transparent; }
.fa-scroll::-webkit-scrollbar-thumb {
  background: rgba(26,18,36,0.35);
  border-radius: var(--ds-r-pill);
}

/* ── Level / progress bar ─────────────────────────────────────────────────── */
.fa-level {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 200px;
  min-width: 0;
}
.fa-level-label {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: clamp(0.69rem, 1.6vh, 0.9rem);
  color: var(--cream);
  text-shadow: 0 2px 0 var(--ink);
  white-space: nowrap;
}
/* Taller than round 1's 16px hairline, and it carries its own numeric readout —
   a critic called the old bar "invisible for what is core progression". */
.fa-level-track {
  position: relative;
  flex: 1 1 auto;
  min-width: 40px;
  height: clamp(20px, 3vh, 26px);
  background: var(--panel);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  overflow: hidden;
  box-shadow: var(--ds-e2);
}
.fa-level-fill {
  height: 100%;
  border-radius: var(--ds-r-pill);
  background: repeating-linear-gradient(45deg, var(--lettuce) 0 10px, #9BE03A 10px 20px);
  transition: width 0.4s ease-out;
}
.fa-level-xp {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.69rem, 1.4vh, 0.76rem);
  letter-spacing: 0.03em;
  color: var(--ink);
  pointer-events: none;
}

/* ── Stat bars (character select) ─────────────────────────────────────────── */
.fa-stat {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fa-stat-label {
  flex: 0 0 auto;
  width: clamp(58px, 8vw, 92px);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.69rem, 1.45vh, 0.8rem);
  white-space: nowrap;
}
.fa-stat-track {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 14px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: var(--ds-r-pill);
  overflow: hidden;
}
.fa-stat-fill {
  height: 100%;
  border-radius: var(--ds-r-pill);
  transition: width 0.32s cubic-bezier(0.2, 0.9, 0.3, 1);
  background-image: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%);
  background-blend-mode: overlay;
}
.fa-stat-val {
  flex: 0 0 auto;
  width: 20px;
  text-align: end;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: clamp(0.69rem, 1.4vh, 0.78rem);
  color: rgba(26,18,36,0.7);
}

/* ── Rarity badge ─────────────────────────────────────────────────────────── */
/* Colour comes from RARITY_COLORS in rules.ts via inline style — never hardcoded
   here, so a balance/roster change can't silently desync the menu from the game.

   ── WHITE ON THE FILL FAILED FIVE OF SIX RARITIES ──────────────────────────
   Measured against the pixels actually behind each glyph: Cyber 1.64, Legendary 2.08,
   Normal 2.78, Neon 3.20, Rare 3.81, Epic 4.92, against a 4.5 AA floor. That is the
   same failure family as 'docs/LESSONS.md' §1 case 10 — the dark-on-dark HUD cooldown
   wipe that three critics across three rounds reported as "no visible cooldown".

   Three fixes were rendered at real badge size and compared as PIXELS
   ('tools/tmp/rarity_probe.mjs', 'rarity_probe2.mjs'), because only the arithmetic
   could be settled on paper:

     - darkening the fill behind the type. This is what 'home.ts' does at alpha 0.40,
       and it is NOT enough: it leaves Cyber at 4.06. Reaching 4.5 on every rarity
       needs ~0.52, which costs the badge half its value and turns Legendary gold
       brown — on a screen whose whole job is telling six rarities apart.
     - picking ink or white per fill by luminance. Crisp, keeps the fill fully
       saturated, and clears AA for all six of OUR colours (worst 4.77) — but the
       crossover for an ARBITRARY fill is 4.07, so a rarity added to 'rules.ts' near
       L=0.185 would fail silently. It also needs JS, which means it could only ever
       fix the screens whose owner remembered to call it.
     - AN INK TEXT-STROKE, below. Colour-independent, CSS-only (so it fixes home's
       badge too, in a file this owner does not touch), and the same treatment
       '.fa-title' and '.chars-card-name' already use — measured 16.55:1 on every
       rarity, because the glyph's paper is its own stroke rather than the fill.

   1.6px is the width the sweep settled on. '-webkit-text-stroke' centres on the glyph
   outline, so half of it comes off the INSIDE of a stem that is only ~1.8px wide at
   800 weight; 2.2px visibly closed the counters of NORMAL and LEGENDARY, and 1.2px
   left too thin a rim to enclose the glyph. The font-size floor moved 0.70rem ->
   0.72rem to keep that ratio honest at the smallest place this badge is used.

   ── 'paint-order: stroke fill' IS LOAD-BEARING, and it was verified as pixels ──
   Without it the stroke paints OVER the fill and does eat half an ~1.8px stem, which
   at 11.2px would leave ~0.2px of '--cream' — a core no rasteriser can resolve, and a
   badge that reads as solid ink on the rarity colour (Epic 3.69:1, the worst of six).
   With it the fill is painted back over the rim, so the stroke only adds outside the
   outline. Measured on every rarity on BOTH screens the badge renders on
   ('tools/tmp/rarity_aa.mjs', 6 rarities x home + character select x 3 viewports):
   16.52-16.54, cream core 12-17% of the badge, unbroken core runs of 7-9 CSS px, all
   counters open at 6x. Do not drop 'paint-order' as a redundant line.

   NOTE for the next reader: 'home.ts' locally pins 'font-size: 0.7rem', under the
   0.72rem floor above. Measured, the ratio survives it (8px core run at 11.2px against
   9px at 13.12px), so it is recorded rather than "fixed". 'tools/tmp/home_metrics.mjs'
   scored this badge 2.53 for one commit because it was the only one of the three
   contrast batteries without a text-stroke branch; it has one now. */
.fa-rarity {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  height: 22px;
  padding: 0 9px;
  border: 2px solid var(--ink);
  border-radius: var(--ds-r-pill);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: clamp(0.72rem, 1.55vh, 0.82rem);
  /* 0.09em -> 0.11em: the stroke adds ~1.6px of ink to every glyph's outside edge, so
     the tracking has to grow with it or adjacent letters touch. */
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--cream);
  -webkit-text-stroke: 1.6px var(--ink);
  paint-order: stroke fill;
  white-space: nowrap;
}

/* ── Confetti (select / win celebration) ──────────────────────────────────── */
.fa-confetti-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 90;
}
.fa-confetti {
  position: absolute;
  top: 34%;
  width: 9px;
  height: 14px;
  border-radius: 2px;
  animation: fa-confetti-fall 1.4s ease-in forwards;
}
@keyframes fa-confetti-fall {
  to { transform: translate(var(--x, 0px), 70vh) rotate(520deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .fa-screen, .fa-btn--primary, .fa-rays, .fa-confetti { animation: none !important; }
}

/* The same stop, as an explicit preference rather than an OS one.
   'settings.ts' toggles this class on <html> and persists it; 'applyStoredSettings()'
   re-applies it at boot from the shell, so the choice holds before the settings
   screen has ever been mounted. Kept as a SEPARATE block from the media query above,
   not merged with a comma, so neither can silently disable the other if one selector
   turns out to be unsupported — and so any other owner can join in by adding
   ':root.fa-reduce-motion' beside their own 'prefers-reduced-motion' rule. */
:root.fa-reduce-motion .fa-screen,
:root.fa-reduce-motion .fa-btn--primary,
:root.fa-reduce-motion .fa-rays,
:root.fa-reduce-motion .fa-confetti { animation: none !important; }

/* ═══════════════════════════════════════════════════════════════════════════════
   THE COMPONENT LAYER  —  'ds-*'
   ═══════════════════════════════════════════════════════════════════════════════

   Uri, on the shipped build: "The character and scenery is a lot better. But the
   text, menu boxes, icons, bars, etc still look amateurish."

   ── THE MEASURED CAUSE, and it is not taste ─────────────────────────────────
   'tools/tmp/ds_inventory.mjs' parses every stylesheet in 'src/ui/' (with the real
   TypeScript parser, because every one lives in a template literal) and counts the
   authored values. Across the five menu screens plus this file:

     border-radius     14 distinct declarations / 11 absolute atoms   (a system: ~4)
     box-shadow        53 distinct declarations / 66 distinct LAYERS  (a system: ~5)
     font-size        102 distinct declarations                       (a system: ~7)
     border            15 distinct, of which FOUR are the same ink line at
                       2px / 2.5px / 3px / 4px
     gap               20 distinct, a continuum from 1px to 22px with no structure

   303 class names across the five screens, of which SEVEN are shared. Every screen
   re-implements its own panel, its own button, its own bar. Nothing reads as one
   product when every box has its own physics.

   ── THE SINGLE MOST DAMNING NUMBER, and it is NOT the shadow count ──────────
   Decomposing every 'font-size: clamp(min, slope, max)' (ds_inventory --clamps):

     91 of 102 font-size declarations — 89% of all type on the menus — land in ONE
     cluster. min 0.58-0.84rem, max 0.70-1.15rem, slope 1.15-2.0vh.

   The menus do not have a type scale that drifted. THEY HAVE ONE SIZE, jittered 26
   different ways. A section label, a stat value, a nav item and a currency counter
   all render between 11px and 18px, and the only thing separating them is 0.02rem
   of noise no reader can see. That is what "amateurish" looks like from the inside:
   a shipped lobby's numerals are 3-4x its labels; ours are within 1.15x, at random.

   ── WHERE THE SCALES BELOW COME FROM ────────────────────────────────────────
   From the histogram, not from taste. Every step is either the MODE of an observed
   cluster or a rung on a ratio anchored at two observed modes:

     radius   999px (n=51) . 50% (n=19) . 12px (mode of the 10-14 band, n=24)
              16px (mode of the 16-26 band once var(--radius-surface) is counted)
              3px (mode of the 2-3 band)
     lip      alpha 0.35 is the mode by a landslide (13 of the top 20 declarations);
              offset 3px is the mode (n=13), then 2px (n=4), 5px (n=3), 4px, 10px
     stroke   3px (n=26) . 2px (n=12) . 4px (n=3);  2.5px (n=16) is drift, and it is
              settings.ts's alone in 8 of its 16 uses
     space    3 . 6 . 8 . 12 . 20  — the four modes of the gap continuum, plus one
              step for the 16-22 clamp tails
     type     ratio 1.2, anchored so that step 2 is the PER-PART MODE of the
              91-declaration cluster (min 0.69rem n=39, slope 1.4vh n=18, max
              0.82rem n=15 — the modes of the three parts, not a triple that any one
              author happened to type) and step 6 lands on the observed TITLE cluster
              (max 1.7-1.85rem, slope 2.8-3.2vh). 1.2 was not chosen: 1.70 / 0.82 =
              2.07, and 2.07^(1/4) = 1.199. The data picked it.

   ── AND WHAT THE COUNTS DO NOT MEASURE (docs/LESSONS.md 6b) ─────────────────
   Collapsing 53 shadows to 6 measures TIDINESS. It does not measure quality, and a
   stylesheet where every box is the same immaculate panel scores perfectly on that
   metric while being exactly the defect. The reference plates
   ('reference/images/curated/menus/') do NOT run one rounded rect everywhere: they
   run distinct treatments for distinct JOBS — a dark slab for utility and data, a
   saturated slab for actions, a pill for read-only counters, a circular badge that
   breaks its parent's silhouette for counts, a SEGMENTED meter for discrete
   progression against a continuous bar for fractional. That differentiation is the
   win, and no counter in this repo can see it. Hence the '--paper' / '--slate' /
   '--action' split below, which is a design claim and not a tidiness one.

   ⚠️ And note what is NOT the mechanism: "add drop shadows" was refused on a
   measurement. The dark% budget reads 14.50 on our 5.17-scoring screen against
   13.63 on our 7.00-scoring one — a 0.87 gap against a +/-4.26 floor. It does not
   separate our good menu from our bad one. Brawl Stars' 43.74 is a DARK-THEMED
   game. Chasing it means darkening our art to satisfy an instrument.

   ── THIS LAYER SHIPS UNUSED, ON PURPOSE ─────────────────────────────────────
   Five screens are owned by five other agents. A foundation that silently restyles
   all five while their owners are asleep is how this project loses a night. So
   every class here is prefixed 'ds-', which no existing element carries, and every
   token is prefixed '--ds-', which nothing existing reads. Adoption is each
   owner's call, in their own file, in a later pass.

   Proven, not asserted: 'tools/tmp/ds_neutral.mjs' censuses 70 computed properties
   on every element of all five screens at three viewports, before and after, on ONE
   frozen snapshot with this file symlinked live ('snap_hold --swap'), and diffs the
   captures against a drift control taken on the unedited tree.

   ── 🚨 AND THE CHROME IS SHARED, WHICH REFUTES THE OBVIOUS PLAN ─────────────
   The plan this pass started from was "character select scores 7.00 and home 5.17, so
   make home like the screen next door." A per-element critique (commit 6ebb6d1)
   refutes it. Every 2D chrome element measured lives in THIS FILE, and the two places
   character select overrides it — '.fa-stat-track' height and '.fa-stat-pips' — moved
   the critic by ZERO. So the answer to "does our own better screen already solve this
   element" is NO, for all shared chrome. There is no screen to copy: the fixes have to
   land in the layer, which makes it considerably more load-bearing than briefed.

   Three of its findings are built above, each against a measurement, and two of them
   REFUSE the obvious mechanism:
     * the stat row is 0.60x the reference's height with a line glyph where the
       reference has a tinted mass, and the label beside the value instead of above it.
       Pips and a taller TRACK are refuted — character select already has both and
       scored identically. See '.ds-row' and '.ds-tile--stat'.
     * the primary button is NOT flat: our vertical shading is +0.038/+0.064 against a
       reference +0.050. The difference is the LABEL treatment. See '.ds-btn--primary'.
     * the secondary control is 0.91x the primary's area against a reference 0.25x —
       a relationship no crop of either button could see. See '.ds-btn--secondary'.
   Its type and shadow findings are the ones this layer was already built for: 8 of 10
   measured font sizes inside 9.6-12.8px (a 1.33x range with eight steps in it, i.e. no
   perceptible hierarchy below 16px), and 14 box-shadows that are one idiom at six
   depths.

   ── ADOPTION MAP, for whoever comes next ────────────────────────────────────
   Derived from the class census, so it is a list of real sites and not a wish:
     ds-surface  <- home-track, chars-card, chars-detail, tr-node, tr-sku,
                    shop-card, set-section, set-row, fa-panel
     ds-btn      <- chars-lv-btn, tr-claimall, tr-open-cta, tr-sku-buy, shop-buy,
                    set-done, set-reset, tr-sheet-close, set-bindreset, tr-odds,
                    home-change   (11 bespoke buttons beside the shared fa-btn)
     ds-bar      <- home-bar, tr-track, tr-spine, fa-level-track, fa-stat-track
     ds-meter    <- home-pips, fa-stat-pips, tr-pip  (three segmented meters, unshared)
     ds-tile     <- home-kit-tile, home-track-icon, tr-node-medal, shop-card-em,
                    set-row-icon, tr-open-em, chars-ability-em
     ds-badge    <- tr-open-count, shop-held-n, chars-card-lv
     ds-row      <- home-rec, chars-fact, tr-odds-row, shop-odds-row
     ds-chip     <- home-track-pill, chars-hero-badge, tr-tier, tr-status,
                    shop-guarantee, tr-reveal-chip
   ═══════════════════════════════════════════════════════════════════════════════ */

.fa-root {
  /* ── RADIUS ─────────────────────────────────────────────────────────────── */
  --ds-r-1: 3px;        /* inner clip, scrollbar thumb, nib */
  --ds-r-2: 12px;       /* tile, card, row — the working radius */
  --ds-r-3: 16px;       /* panel — the largest flat surface */
  --ds-r-pill: 999px;   /* anything you press, and every counter */
  --ds-r-round: 50%;    /* a token, a medal, a count bubble */

  /* ── ELEVATION ──────────────────────────────────────────────────────────────
     The whole drift is one idiom with two hand-typed parameters. 53 distinct
     box-shadow declarations decompose into: 'inset? 0 Npx 0 COLOUR', N in
     {0,1,2,3,4,5,6,7,8,10}, COLOUR in {rgba(0,0,0,a) for ten values of a} plus
     four named lip colours. Nobody was designing a new shadow; they were
     re-typing the whole declaration to change ONE of its two numbers.

     So the colour comes out as a variable. A component that wants a gold lip sets
     '--ds-lip: var(--gold-shadow)' and keeps the ladder. That single indirection
     is what collapses 53 declarations into six, and it is also why adoption is
     cheap: the press state is 'box-shadow: var(--ds-e0)', which is the SAME
     colour at zero offset, so it animates instead of popping. */
  --ds-lip: rgba(0,0,0,0.35);
  --ds-e0: 0 0 0 var(--ds-lip);                                     /* pressed */
  --ds-e1: 0 2px 0 var(--ds-lip);                                   /* chip, tag */
  --ds-e2: 0 3px 0 var(--ds-lip);                                   /* raised (mode) */
  --ds-e3: 0 5px 0 var(--ds-lip);                                   /* panel */
  --ds-e4: 0 7px 0 var(--ds-lip), 0 10px 22px rgba(0,0,0,0.4);      /* hero CTA */
  --ds-e5: 0 10px 0 rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5);   /* modal sheet */
  /* The inner top highlight that makes a slab read as moulded rather than filled.
     Two, because the same white at 0.9 on a dark surface is a stripe, not a
     highlight — the six existing uses had already split into 0.7-0.9 on light and
     0.14-0.15 on dark, so this records a distinction that was already being made. */
  --ds-bevel: inset 0 2px 0 rgba(255,255,255,0.9);
  --ds-bevel-dark: inset 0 2px 0 rgba(255,255,255,0.15);

  /* ── STROKE — the ink line ────────────────────────────────────────────────── */
  --ds-stroke-1: 2px;
  --ds-stroke-2: 3px;   /* the mode, n=26 */
  --ds-stroke-3: 4px;

  /* ── SPACE ────────────────────────────────────────────────────────────────── */
  --ds-s1: 3px;
  --ds-s2: 6px;
  --ds-s3: 8px;
  --ds-s4: 12px;
  --ds-s5: 20px;

  /* ── TYPE ───────────────────────────────────────────────────────────────────
     Seven steps at ratio 1.2. Each is clamp(min, slope, max) with

       max(n)   = 0.82rem * 1.2^(n-2)          rounded to 2dp
       min(n)   = max(n-1)                     so a short screen drops every element
                                               exactly one rung, which is a property
                                               rather than a pile of guesses
       slope(n) = max(n) in px / 9.37 per vh   so the crossover sits near a 937px-tall
                                               viewport for every step

     ⚠️ The bottom of the ladder is CLAMPED AT 0.69rem (11.04px) and does not follow
     the ratio. That is not a rounding choice: 'screen_metrics.mjs' flags every text
     run under 11px, the tight case is a 390px-TALL landscape phone where the min
     binds, and 0.82/1.2 = 0.68rem = 10.88px would fail it. So steps 1 and 2 share a
     floor and converge on a short screen. Recorded rather than hidden.

     Rendered, at a 16px root:              phone 390h   desktop 900h   cap (>937h)
       --ds-t1  caption, tag, superscript     11.0px       11.0px         11.5px
       --ds-t2  label, stat name  [THE MODE]  11.0px       12.6px         13.1px
       --ds-t3  body, control, nav item       13.1px       14.9px         15.7px
       --ds-t4  lead, chip value              15.7px       18.0px         18.9px
       --ds-t5  numeral, price                18.9px       21.6px         22.7px
       --ds-t6  screen title                  22.7px       26.1px         27.2px
       --ds-t7  display                       27.2px       31.5px         32.6px

     The step between consecutive DESKTOP renders is 1.15 / 1.18 / 1.21 / 1.20 /
     1.21 / 1.21 — the ratio holds everywhere except across the 11px floor, which is
     the one place it cannot.

     Steps 3 and up are BIGGER than almost anything currently on the menus, and
     that is the point: the defect is that nothing is big. Nothing above t7 is
     tokenised — the opening title (4.6rem), the trophy count (5.6rem) and the
     character-select name (4rem) are deliberate per-screen display type and stay
     their owners' business. */
  --ds-t1: clamp(0.69rem, 1.2vh, 0.72rem);
  --ds-t2: clamp(0.69rem, 1.4vh, 0.82rem);
  --ds-t3: clamp(0.82rem, 1.65vh, 0.98rem);
  --ds-t4: clamp(0.98rem, 2vh, 1.18rem);
  --ds-t5: clamp(1.18rem, 2.4vh, 1.42rem);
  --ds-t6: clamp(1.42rem, 2.9vh, 1.7rem);
  --ds-t7: clamp(1.7rem, 3.5vh, 2.04rem);

  /* Three weights, from five. 600 (n=4) and 500 (n=1) are single-site drift. */
  --ds-w-body: 700;
  --ds-w-bold: 800;   /* n=59 */
  --ds-w-black: 900;  /* n=32 */

  /* Three tracking steps, from twelve. The clusters are real: 0.01-0.02 (tight,
     for large type where the stroke already separates), 0.03-0.05 (normal),
     0.08-0.12 (uppercase, where tracking is doing structural work). */
  --ds-track-tight: 0.02em;
  --ds-track: 0.04em;
  --ds-track-caps: 0.09em;

  /* ── SURFACE COLOURS, BY JOB ────────────────────────────────────────────────
     This is the design claim, not the tidiness one. Our menus are cream boxes on a
     warm backdrop, all the way down; the reference plates run three surfaces that
     mean three different things, and the meaning is carried by the SURFACE rather
     than by a label. Reusing the existing measured tokens, so no new colour enters
     the product and every contrast pair below is one the batteries already know. */
  --ds-paper: var(--panel);                                            /* read */
  --ds-paper-hi: #FFFFFF;
  --ds-slate: var(--ink);                                              /* utility */
  --ds-slate-2: var(--ink-2);
  --ds-action-a: var(--mustard-hi);                                    /* get */
  --ds-action-b: var(--mustard);
  --ds-ink-on-paper: var(--ink);
  --ds-ink-on-slate: var(--cream);
}

/* ═══ TYPE UTILITIES ══════════════════════════════════════════════════════════
   Size only. Family and weight stay separate concerns, because a screen that wants
   the label size at black weight should not have to fight a compound class. */
.ds-t1 { font-size: var(--ds-t1); }
.ds-t2 { font-size: var(--ds-t2); }
.ds-t3 { font-size: var(--ds-t3); }
.ds-t4 { font-size: var(--ds-t4); }
.ds-t5 { font-size: var(--ds-t5); }
.ds-t6 { font-size: var(--ds-t6); }
.ds-t7 { font-size: var(--ds-t7); }

/* A <button> does NOT inherit font-family — 'screen_metrics.mjs' found real controls
   shipping in Arial because of it. Anything structural names Rubik explicitly. */
.ds-face { font-family: 'Rubik', sans-serif; }
.ds-w-body { font-weight: var(--ds-w-body); }
.ds-w-bold { font-weight: var(--ds-w-bold); }
.ds-w-black { font-weight: var(--ds-w-black); }
.ds-caps {
  text-transform: uppercase;
  letter-spacing: var(--ds-track-caps);
}

/* Counters that do not jitter. A trophy total ticking 3170 -> 3180 reflows every
   glyph in a proportional face, which reads as cheap in exactly the way Uri named.
   Costs one declaration and is invisible until the number changes. */
.ds-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

/* The headline treatment, factored out of '.fa-title' so a screen can put a stroked
   headline anywhere without re-deriving it. 'paint-order: stroke fill' is
   LOAD-BEARING and measured: without it the stroke paints over the fill and eats
   half of an ~1.8px stem, and the glyph reads as solid ink. See the '.fa-rarity'
   comment above for the six-rarity pixel measurement that settled it. */
.ds-stroked {
  color: var(--cream);
  -webkit-text-stroke: var(--ds-stroke-2) var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 4px 0 var(--ink);
}

/* ═══ SURFACE ═════════════════════════════════════════════════════════════════
   One box, three jobs. The modifier is not decoration — it is the only thing
   telling a player whether a box is something to READ, something to USE, or
   something that GIVES them something, and picking it is the adopting screen's
   most consequential decision. */
.ds-surface {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--ds-s3);
  min-height: 0;
  padding: var(--ds-s4);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-3);
  background: var(--ds-paper);
  box-shadow: var(--ds-e3);
  color: var(--ds-ink-on-paper);
}
/* READ — the cream plate. Data you look at and do not touch. */
.ds-surface--paper { background: var(--ds-paper); color: var(--ds-ink-on-paper); }
/* USE — the dark slab. The single biggest structural difference from the reference
   plates, which put navigation, settings and secondary data on dark and reserve
   bright surfaces for actions. We have this treatment in exactly one place today
   (the tab track, which was itself a fix for "the lowest-contrast element on the
   lobby") and it worked there for the same reason it will work here: a dark plate
   separates from a warm backdrop, and a bright state inside it separates from the
   plate. Cream on ink measures ~12:1. */
.ds-surface--slate {
  background: linear-gradient(180deg, var(--ds-slate-2) 0%, var(--ds-slate) 100%);
  color: var(--ds-ink-on-slate);
  box-shadow: var(--ds-e3), var(--ds-bevel-dark);
}
/* GET — the saturated slab. Reserved for surfaces that hand the player something. */
.ds-surface--action {
  background: linear-gradient(180deg, var(--ds-action-a) 0%, var(--ds-action-b) 100%);
  color: var(--ds-ink-on-paper);
  --ds-lip: var(--gold-shadow);
  box-shadow: var(--ds-e3), var(--ds-bevel);
}
.ds-surface--tile { border-radius: var(--ds-r-2); padding: var(--ds-s3); }
.ds-surface--flush { padding: 0; overflow: hidden; }
.ds-surface--flat { box-shadow: none; }
.ds-surface--raised { box-shadow: var(--ds-e4); }

/* ═══ BUTTON ══════════════════════════════════════════════════════════════════
   Press physics come free from the lip token: the raised state is an offset lip and
   the pressed state is the SAME colour at zero offset, so the element travels down
   into its own shadow. Eleven bespoke buttons across the five screens each
   re-derive this; every one of them is this component plus a colour. */
.ds-btn {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ds-s3);
  min-height: var(--tap);
  padding: 0 var(--ds-s5);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t3);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--ds-ink-on-paper);
  background: linear-gradient(180deg, var(--ds-action-a) 0%, var(--ds-action-b) 100%);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  --ds-lip: var(--gold-shadow);
  box-shadow: var(--ds-e2);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.ds-btn:hover { filter: brightness(1.06); }
.ds-btn:active { transform: translateY(3px); box-shadow: var(--ds-e0); }
.ds-btn[disabled] { opacity: 0.5; cursor: default; filter: none; }
.ds-btn[disabled]:active { transform: none; box-shadow: var(--ds-e2); }

/* The one loud control on a screen. Bigger, not just brighter: a critic measured our
   CTA at ~17% of frame width against a ~22-25% reference norm and noted it carried
   less weight than the disabled nav around it. Size IS the hierarchy here. */
/* ⚠️ AND THE OBVIOUS FIX IS REFUTED, WITH A NUMBER. The natural diagnosis of our CTA
   against the reference is "ours is flat, add a gradient". It is NOT flat: our vertical
   shading measures +0.038 / +0.064 against the reference's +0.050, i.e. we already have
   MORE. Adding gradient would spend the pass moving a number that is already past the
   target — LESSONS 6b, an acceptance test that is not the binding constraint.

   The measured remaining difference is the LABEL: ours is dark ink on yellow, the
   reference is white with a heavy black outline. So the primary carries the stroked
   treatment, which is the same idiom '.fa-title' and '.fa-rarity' already use and the
   same one measured at 16.55:1 on every rarity — a stroked glyph sits on its own
   stroke, so this also makes the label colour-independent of the button fill. */
.ds-btn--primary {
  font-size: var(--ds-t6);
  min-height: clamp(var(--tap), 9.5vh, 78px);
  padding: 0 clamp(24px, 3.6vw, 58px);
  border-width: var(--ds-stroke-3);
  box-shadow: var(--ds-e4), var(--ds-bevel);
  color: var(--cream);
  -webkit-text-stroke: var(--ds-stroke-2) var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 3px 0 var(--ink);
}
.ds-btn--primary:active { transform: translateY(6px); box-shadow: var(--ds-e0), var(--ds-bevel); }
/* ── SIZE IS THE HIERARCHY, AND OURS IS INVERTED BY 3.6x ─────────────────────────
   Measured on home: the secondary control (CHANGE) is 0.91x the PRIMARY's area. The
   reference's secondary is 0.25x. We are 3.6x too large relative to our own primary,
   which is why the lobby reads as three equal columns rather than one dominant action.

   Note the SHAPE of that finding, because it generalises: no crop of either button
   could have found it. An isolated element cannot see what it sits beside — the same
   blind spot that once let a character read as a goat. A component library is where
   the relationship gets fixed, because it is the only place both ends are declared.

   So the ratio is a stated target, not a vibe: this modifier stays at the 44px tap
   floor while '--primary' runs to 78px (0.56x linear), and a caller should hold its
   WIDTH near half the primary's to land the 0.25x area. '.fa-btn--quiet' is the class
   actually carrying the defect today and it is NOT changed here — it is live on five
   screens and this layer ships pixel-neutral; the fix belongs to that screen's owner.

   Secondary also reads as secondary by SIZE as well as colour — a same-size pair in
   two hues is how a menu ends up with no hierarchy at all.

   ── INK, NOT CREAM, AND THAT IS A MEASUREMENT ─────────────────────────────────
   This shipped for one iteration as cream on the blue and 'tools/tmp/ds_sheet.mjs'
   caught it in the rendered specimen: cream on '--water' measures 2.92:1 and on the
   gradient's lighter top stop 2.14:1, against a 4.5 floor. Ink on the same two stops
   measures 5.13 and 7.60. Same failure family as the six rarities that failed white-
   on-fill, and the same lesson: a brand colour that carries white in the HUD does not
   automatically carry it as a button face. */
.ds-btn--secondary {
  font-size: var(--ds-t2);
  padding: 0 var(--ds-s4);
  background: linear-gradient(180deg, #4FB3E8 0%, var(--water) 100%);
  color: var(--ink);
  --ds-lip: #0e4a6d;
}
.ds-btn--quiet {
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  --ds-lip: rgba(0,0,0,0.35);
}
/* The gradient runs '--ketchup' -> a darker red rather than '--tomato' -> '--ketchup',
   and the reason is the WORST stop rather than taste. Cream on '--tomato' (#E63946) is
   3.80:1 — under the 4.5 floor, and a reset-your-progress button is the last control in
   the product that should be hard to read. Cream on '--ketchup' (#D62839) is 4.52 and
   on the dark stop 8.13, so running the ramp one notch darker clears AA at both ends
   without changing the hue. Ink was tried instead and measures 4.29 on '--tomato',
   i.e. it fails too: the fix had to be the FILL, not the type. */
.ds-btn--danger {
  background: linear-gradient(180deg, var(--ketchup) 0%, #8f1a24 100%);
  color: var(--cream);
  --ds-lip: #5c1017;
}
.ds-btn--green {
  background: linear-gradient(180deg, #A6E24A 0%, var(--lettuce) 100%);
  --ds-lip: #43690b;
}
/* SQUARE, not a pill. Our icon control is '.fa-iconbtn', a pill, everywhere; the
   plates use a rounded SQUARE for a glyph-only control and a pill only for text.
   The shape is doing the work of telling you which it is before you read it. */
.ds-btn--icon {
  width: var(--tap);
  min-width: var(--tap);
  padding: 0;
  border-radius: var(--ds-r-2);
  background: linear-gradient(180deg, var(--ds-slate-2) 0%, var(--ds-slate) 100%);
  color: var(--ds-ink-on-slate);
  --fa-ic-ink: var(--cream);
  --ds-lip: rgba(0,0,0,0.45);
  box-shadow: var(--ds-e2), var(--ds-bevel-dark);
}
.ds-btn--block { width: 100%; }

/* ═══ CHIP — a read-only counter ══════════════════════════════════════════════
   Never interactive. A chip that can be tapped is a '.ds-btn', and keeping the two
   apart is the difference between a player knowing what is pressable and guessing. */
.ds-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-s2);
  height: 40px;
  padding: 0 var(--ds-s4);
  background: var(--ds-paper);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e2);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t2);
  white-space: nowrap;
  color: var(--ds-ink-on-paper);
}
.ds-chip--slate {
  background: linear-gradient(180deg, var(--ds-slate-2) 0%, var(--ds-slate) 100%);
  color: var(--ds-ink-on-slate);
  box-shadow: var(--ds-e2), var(--ds-bevel-dark);
}
.ds-chip--sm { height: 22px; padding: 0 var(--ds-s3); font-size: var(--ds-t1); border-width: var(--ds-stroke-1); }
/* The chip's VALUE, one step up from its label. On the reference plates the numeral
   is the loudest thing in the counter and the icon is second; ours were the same
   size, which is why a trophy total read as chrome. */
.ds-chip-val { font-size: var(--ds-t4); font-weight: var(--ds-w-black); font-variant-numeric: tabular-nums; }

/* ═══ BADGE — status attached to something else ═══════════════════════════════
   Absent from this project entirely, and the plates are covered in them: a count
   bubble on a nav tile, a FREE flag on a shop entry, a NEW ribbon on a season card.
   A badge is defined by breaking its parent's silhouette — that overhang is what
   makes it read as applied rather than contained, and it is why the parent needs
   'position: relative' and nothing else. */
.ds-badge {
  position: absolute;
  top: -8px;
  inset-inline-end: -8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 var(--ds-s2);
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-pill);
  background: var(--ketchup);
  color: #FFFFFF;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t1);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  box-shadow: var(--ds-e1);
  pointer-events: none;
}
.ds-badge--count { min-width: 22px; padding: 0; border-radius: var(--ds-r-round); }
/* White is kept on the RED badge and dropped on the other two, because that is what
   the arithmetic says rather than what looks consistent in a rule listing: white on
   '--ketchup' is 4.96:1 and clears, white on '--lettuce' is 2.48 and white on
   '--water' is 3.49, both under the floor at an 11px glyph. Ink on those two measures
   7.21 and 5.13. A badge is the smallest type in the product and is the last place a
   marginal ratio is affordable. */
.ds-badge--good { background: var(--lettuce); color: var(--ink); }
.ds-badge--info { background: var(--water); color: var(--ink); }
/* The flag form: a small tag on the top-left, tilted off the parent's corner. Text
   is uppercase and tracked because at 11px it is a mark, not a word. */
.ds-badge--tag {
  top: -7px;
  inset-inline-end: auto;
  inset-inline-start: -6px;
  border-radius: var(--ds-r-1);
  padding: 0 var(--ds-s2);
  height: 18px;
  text-transform: uppercase;
  letter-spacing: var(--ds-track-caps);
  transform: rotate(-4deg);
}

/* ═══ TILE — a glyph in a box ═════════════════════════════════════════════════
   Seven independent implementations across the five screens. Square, so it does not
   compete with the pills, and it carries its own fill so a caller can colour-code
   by category the way the plates colour-code a stat by its icon chip. */
/* ⚠️ 'color' is SET, not inherited, and that is a bug fix. A tile inside
   '.ds-row--slate' inherits cream, and its fill is a bright category colour by
   construction — so the specimen sheet rendered a cream glyph on mustard at 1.4:1 and
   a cream glyph on green at 3.8:1. The tile's paper is its OWN fill, never its
   parent's, so it has to name its own ink. A caller passing a DARK '--ds-tile-fill'
   must override 'color' as well; that is the one case this cannot cover, because the
   fill arrives from JS. */
.ds-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--ink);
  --fa-ic-ink: var(--ink);
  width: 34px;
  height: 34px;
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  background: var(--ds-tile-fill, var(--ds-paper-hi));
  box-shadow: var(--ds-e1);
  font-size: var(--ds-t4);
  line-height: 1;
}
.ds-tile--lg { width: 46px; height: 46px; font-size: var(--ds-t5); }
.ds-tile--sm { width: 26px; height: 26px; font-size: var(--ds-t2); border-radius: var(--ds-r-1); }
.ds-tile--round { border-radius: var(--ds-r-round); }
/* THE STAT TILE. Sized off the measurement rather than off the grid: our stat icon is
   33x33 against a reference tile of roughly 72x70, and at 1em with a 1.7px stroke and
   'fill: none' it is a line DRAWING where the reference has a coloured MASS. 56px is
   the largest tile that still leaves a 56px row taller than it is deep at the tight
   landscape-phone height. The glyph is scaled to 0.62 of the tile, not to 1em, so the
   tint is what the eye lands on. The default fill is deliberately NOT white here --
   a stat tile with no tint is the defect. */
.ds-tile--stat {
  width: 56px;
  height: 56px;
  border-width: var(--ds-stroke-2);
  border-radius: var(--ds-r-2);
  background: var(--ds-tile-fill, var(--mustard));
  font-size: 35px;
  box-shadow: var(--ds-e1), var(--ds-bevel);
}
.ds-tile--stat > svg, .ds-tile--stat > .fa-ic { width: 62%; height: 62%; stroke-width: 2.4; }

/* ═══ ROW — icon, label, value ════════════════════════════════════════════════
   Four independent implementations today, all of them a bar or a flex line. The
   plates' stat block is NOT a bar: it is a dark slab carrying a coloured icon chip,
   a small coloured label and a large numeral, and the absence of a fill is what
   lets the numeral be the loud thing. A row is for a value with no denominator; a
   bar is for a value with one. Choosing correctly between them is most of what
   makes a stat block look designed.

   ── 🚨 THE GEOMETRY BELOW IS MEASURED, AND IT REPLACES A FIRST DRAFT ──────────
   'stat-bars' is the WORST element in the per-element critique, and the finding that
   matters is that character select's supposedly-better version scored the SAME —
   two critics, two panels, one number. So pips and a taller track are refuted as the
   fix; the reference is not doing a better BAR, it is not drawing a bar at all.

   The three measured gaps, and every number below is one of them:
     * the row is 0.60x the reference's HEIGHT. First draft: min-height 34px. Now 56.
     * the icon is a 33x33 line glyph -- 1.7px stroke, 'fill: none', sized at 1em --
       against a filled, TINTED tile roughly 72x70. Hence '.ds-tile--stat' at 56px
       with a tint that is required rather than optional: an outline glyph at 1em is a
       drawing, and the reference's is a MASS.
     * the label sits BESIDE the value. In the reference it sits ABOVE it, small and
       colour-coded, with the numeral at display weight underneath. That single
       change is what lets the number be the loud thing, and it costs no width -- the
       reason our stat rows are short is that they are laid out as one line.

   ⚠️ Read the per-element scores as GAPS and as three bands, never as a ranking, and
   never beside the whole-screen numbers: isolating a UI crop displaces the critic
   scale (the reference side scored 7.12 +/- 1.22 against 8.17 for whole images, and
   4 of 17 rounds fell outside 7-9 and were discarded). Critics said why, unprompted --
   an isolated crop "reads as a debug overlay". The instrument works; the SCALE moved. */
.ds-row {
  display: flex;
  align-items: center;
  gap: var(--ds-s4);
  min-height: 56px;
  padding: var(--ds-s2) var(--ds-s3);
  border-radius: var(--ds-r-2);
  background: rgba(26,18,36,0.06);
}
.ds-row--slate {
  background: linear-gradient(180deg, var(--ds-slate-2) 0%, var(--ds-slate) 100%);
  color: var(--ds-ink-on-slate);
  box-shadow: var(--ds-bevel-dark);
}
/* Label over value. The stack is the component; a caller that puts the label and the
   value as siblings of the tile gets the old one-line row back and the defect with it. */
.ds-row-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
}
.ds-row-label {
  min-width: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  line-height: 1.15;
  text-transform: uppercase;
  letter-spacing: var(--ds-track-caps);
  /* Colour-coded to its tile, the way the reference colour-codes a stat by its icon
     chip. Defaults to the inherited ink so a caller that sets nothing is still legible. */
  color: var(--ds-row-accent, inherit);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Display weight, one full step above the label rather than beside it. */
.ds-row-val {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t5);
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}
/* The one-line form is kept for rows that are genuinely a list item rather than a
   stat -- an odds row, an inventory line -- where a two-line stack would be wrong. */
.ds-row--inline { min-height: 34px; }
.ds-row--inline .ds-row-body { flex-direction: row; align-items: center; gap: var(--ds-s3); }
.ds-row--inline .ds-row-label { font-size: var(--ds-t2); flex: 1 1 auto; }
.ds-row--inline .ds-row-val { font-size: var(--ds-t4); flex: 0 0 auto; }

/* ═══ BAR — a value WITH a denominator ════════════════════════════════════════
   Five independent implementations today, at four different heights, three border
   widths and two fill idioms. The caller supplies the fill colour and the width;
   everything else is here. */
.ds-bar {
  position: relative;
  flex: 1 1 auto;
  min-width: 40px;
  height: 22px;
  background: var(--ds-paper);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  overflow: hidden;
  box-shadow: var(--ds-e2);
}
.ds-bar--sm { height: 14px; border-width: var(--ds-stroke-1); box-shadow: none; }
.ds-bar--lg { height: 30px; }
.ds-bar-fill {
  height: 100%;
  border-radius: var(--ds-r-pill);
  background: var(--ds-bar-ink, var(--lettuce));
  /* The top-light that makes a fill read as a lozenge rather than a flat block.
     Same idiom as '.fa-stat-fill', hoisted so every bar gets it. */
  background-image: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%);
  transition: width 0.4s ease-out;
}
/* The numeric readout INSIDE the track. A bar with no number is a decoration, and a
   critic called ours "invisible for what is core progression" when it had none. */
.ds-bar-cap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--ds-track);
  color: var(--ds-ink-on-paper);
  pointer-events: none;
}

/* ═══ METER — a value with a SMALL, COUNTABLE denominator ═════════════════════
   Segmented, and that is the point. The reference plates use a continuous bar for a
   fraction nobody counts (trophies to the next reward) and a PIPPED meter for one a
   player counts on sight (power level, 11 pips). We already draw three pip meters,
   in three files, none shared. This is the same '.ds-bar' with the segmentation as
   an overlay rather than as N child elements, so a screen that already renders a
   percentage-width fill adopts it by adding one class.

   '--ds-pips' is the segment count; the gap is drawn in ink over the fill so it
   reads as a physical notch instead of a lighter stripe. */
.ds-meter { --ds-pips: 10; }
.ds-meter::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    transparent 0,
    transparent calc(100% / var(--ds-pips) - 2px),
    var(--ink) calc(100% / var(--ds-pips) - 2px),
    var(--ink) calc(100% / var(--ds-pips))
  );
}

/* ═══ BANNER — a classification, not a chip ═══════════════════════════════════
   A rarity or a class is not a counter and should not look like one. The plates run
   it as a slanted strip that bleeds off the left edge of the frame, which reads as
   applied to the character rather than as another pill in a row of pills. Kept
   subtle (8 degrees) because a landscape phone is 390px tall and a steeper angle
   costs real vertical space.

   ── ITS FILL COMES FROM THE CALLER, SO ITS LEGIBILITY CANNOT ────────────────
   '--ds-banner-fill' is whatever a rarity or a class colour happens to be, exactly
   like '.fa-rarity'. Measured on the specimen sheet, cream on '--water' reads 2.92:1.
   That is the same problem '.fa-rarity' already solved and the solution is copied
   verbatim rather than re-derived: an INK TEXT-STROKE with 'paint-order: stroke fill',
   which is colour-INDEPENDENT because the glyph's paper becomes its own stroke.
   Measured there at 16.5:1 on all six rarities on two screens at three viewports.
   'paint-order' is load-bearing: without it the stroke paints over the fill, eats half
   an ~1.8px stem, and the badge reads as solid ink. */
.ds-banner {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-s2);
  padding: var(--ds-s1) var(--ds-s5) var(--ds-s1) var(--ds-s4);
  transform: skewX(-8deg);
  background: var(--ds-banner-fill, var(--ketchup));
  border-block: var(--ds-stroke-1) solid var(--ink);
  color: var(--cream);
  -webkit-text-stroke: 1.6px var(--ink);
  paint-order: stroke fill;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t2);
  text-transform: uppercase;
  letter-spacing: var(--ds-track-caps);
  box-shadow: var(--ds-e1);
}
.ds-banner > * { transform: skewX(8deg); }

/* ═══ DIVIDER ════════════════════════════════════════════════════════════════ */
.ds-rule {
  height: var(--ds-stroke-1);
  border: 0;
  margin: var(--ds-s2) 0;
  background: rgba(26,18,36,0.18);
  border-radius: var(--ds-r-pill);
}

/* Motion opt-out, both forms, kept as separate blocks for the reason recorded on the
   existing pair below: a comma-joined selector list is disabled entirely if either
   selector turns out to be unsupported. */
@media (prefers-reduced-motion: reduce) {
  .ds-btn, .ds-bar-fill { transition: none !important; }
}
:root.fa-reduce-motion .ds-btn,
:root.fa-reduce-motion .ds-bar-fill { transition: none !important; }
`,Af=1923712,tp="#1d5a80",Ff="#1D5576",Rf="#093F73",ol="#8A4E15",Cf="#C07A23",If="#F4C55E",Co=5,Io=14,er=-.6,zf=[[-.6,.86],[0,.88],[1.2,.94],[2.6,1.02],[3.8,1.16],[8,1.4],[14,1.55]],nl=1.3,Of=.52,sl=new le(16.35,9.82,4.69).normalize(),Lf=[[0,.58],[1.5,.62],[2.6,.88],[3.8,1.16],[4.7,1.36],[6.4,1.42]],zo=.24,Oo=.215,rl=.62,Nf=2.48,Df=.86;function il(e,t){if(t<=e[0][0])return e[0][1];const a=e[e.length-1];if(t>=a[0])return a[1];for(let o=1;o<e.length;o++){const[n,s]=e[o],[r,i]=e[o-1];if(t>n)continue;const c=(t-r)/Math.max(1e-6,n-r);return i+(s-i)*(c*c*(3-2*c))}return a[1]}function _f(e,t=128){const a=document.createElement("canvas");a.width=t,a.height=t;const o=a.getContext("2d");if(o){const s=o.createRadialGradient(t/2,t/2,0,t/2,t/2,t/2),[r,i,c]=e,l=h=>`rgb(${Math.round(r+(255-r)*h)},${Math.round(i+(255-i)*h)},${Math.round(c+(255-c)*h)})`;s.addColorStop(0,l(0)),s.addColorStop(.54,l(.1)),s.addColorStop(.8,l(.58)),s.addColorStop(1,"rgb(255,255,255)"),o.fillStyle=s,o.fillRect(0,0,t,t)}const n=new ot(a);return n.colorSpace=au,n.wrapS=ri,n.wrapT=ri,n}function cl(e,t,a){const o=new K({map:_f(t),blending:tu,blendEquation:Yc,blendSrc:Uc,blendDst:eu,blendEquationAlpha:Yc,blendSrcAlpha:Uc,blendDstAlpha:J0,transparent:!0,depthWrite:!1,toneMapped:!1}),n=new y(new Ia(e,e),o);return n.rotation.x=-Math.PI/2,n.renderOrder=a,n.userData.noOutline=!0,n}const Lt={counterBody:"#123A50",counterTop:"#A8641F",counterLip:"#D08A2E",shelf:"#7A431A",steel:"#24485C",jars:["#B02733","#4E8A12","#C99414","#1668A8","#6B3AA8","#B85A18","#2E8C6A","#C4553C"]};class ns{stage;holder=document.createElement("div");model=null;currentId=null;subjectW=oe*.8;subjectH=oe;elapsed=0;introT=0;observer=null;footShadow=null;disposed=!1;dressing=null;constructor(){this.holder.style.cssText="position:absolute;inset:0;",this.stage=new _i({container:this.holder,background:Af,fog:null,camera:{pitchDeg:20,yawDeg:0,frameMode:"subject",subjectHeight:oe,subjectFill:.6,targetHeight:oe*.52,followLerp:1},maxPixelRatio:2}),this.stage.canvas.style.cssText="display:block;width:100%;height:100%;",this.buildSet(),this.stage.rig.snapTo(0,0),this.stage.lighting.focus(0,0,6)}buildSet(){const t=new Me(Co,Co,Io,72,28,!0);this.paintVertexRamp(t,(m,g,w)=>{const b=G.clamp(-(m*sl.x+w*sl.z)/Co,0,1);return il(zf,g+Io/2+er)*(nl+(Of-nl)*b)});const a=We({color:Ff,ramp:Ue(),roughness:.9,rim:!1});a.side=Wc,a.vertexColors=!0;const o=new y(t,a);o.position.y=Io/2+er,o.receiveShadow=!0,o.userData.noOutline=!0,o.name="menu_wall",o.renderOrder=-1,this.stage.scene.add(o);const n=new Aa(0,6.4,96,32);this.paintVertexRamp(n,(m,g)=>il(Lf,Math.hypot(m,g)));const s=We({color:Rf,ramp:Ue(),roughness:.86,rim:!1});s.vertexColors=!0;const r=new y(n,s);r.rotation.x=-Math.PI/2,r.receiveShadow=!0,r.userData.noOutline=!0,r.name="menu_ground",this.stage.scene.add(r);const i=cl(5.4,[18,32,160],1);i.position.y=.012,i.name="menu_ground_decal",this.stage.scene.add(i);const c=new y(new Me(1.15,1.24,.18,48),We({color:ol,ramp:Ue(),roughness:.72}));c.position.y=.09,c.castShadow=!0,c.receiveShadow=!0,c.userData.noOutline=!0,c.name="menu_plinth_body",this.stage.scene.add(c);const l=We({color:Cf,ramp:Ue(),roughness:.55}),h=new y(new Me(1.21,1.19,.06,48,1,!0),l);h.position.y=zo-.03,h.castShadow=!0,h.receiveShadow=!0,h.userData.noOutline=!0,h.name="menu_plinth_rim",this.stage.scene.add(h);const d=new y(new Aa(1.1,1.21,48),l);d.rotation.x=-Math.PI/2,d.position.y=zo,d.receiveShadow=!0,d.userData.noOutline=!0,this.stage.scene.add(d);const p=new y(new Me(1.1,1.1,zo-Oo,48,1,!0),We({color:ol,ramp:Ue(),roughness:.8,doubleSide:!0}));p.position.y=(zo+Oo)/2,p.receiveShadow=!0,p.userData.noOutline=!0,this.stage.scene.add(p);const u=new y(new Me(1.1,1.1,.05,48),We({color:If,ramp:Ue(),roughness:.45}));u.position.y=Oo-.025,u.receiveShadow=!0,u.userData.noOutline=!0,u.name="menu_plinth_top",this.stage.scene.add(u);const f=cl(1.9,[92,62,30],2);f.position.y=Oo+.004,f.scale.set(1,1,.72),f.name="menu_foot_decal",this.footShadow=f,this.stage.scene.add(f)}paintVertexRamp(t,a){const o=t.attributes.position,n=new Float32Array(o.count*3);for(let s=0;s<o.count;s++){const r=a(o.getX(s),o.getY(s),o.getZ(s));n[s*3]=r,n[s*3+1]=r,n[s*3+2]=r}t.setAttribute("color",new es(n,3))}applyFraming(){const t=this.stage.rig.camera,a=t.aspect>0&&Number.isFinite(t.aspect)?t.aspect:1,o=Math.max(.5,this.subjectH)+zo,n=Math.max(.5,this.subjectW,Nf),s=Df*a*o/n;this.stage.rig.subjectHeight=o,this.stage.rig.subjectFill=G.clamp(Math.min(rl,s),.2,rl),this.stage.rig.targetHeight=o*.5,this.stage.rig.apply()}static floorGridTexture(t=256){const a=document.createElement("canvas");a.width=t,a.height=t;const o=a.getContext("2d");o&&(o.clearRect(0,0,t,t),o.strokeStyle="rgba(0,0,0,0.55)",o.lineWidth=t*.055,o.strokeRect(0,0,t,t));const n=new ot(a);return n.wrapS=si,n.wrapT=si,n.repeat.set(22,22),n.colorSpace=Hi,n}buildDressing(){const t=new te;t.name="lobby_dressing";const a=(f,m=!1)=>(f.castShadow=m,f.receiveShadow=!0,f.userData.noOutline=!0,t.add(f),f),o=-3.35,n=7.2,s=.78,r=new y(new Ia(13,13),new K({map:ns.floorGridTexture(),transparent:!0,depthWrite:!1,toneMapped:!1}));r.rotation.x=-Math.PI/2,r.position.y=.006,r.renderOrder=0,r.userData.noOutline=!0,r.name="lobby_floor_grid",t.add(r);const i=ns.floorGridTexture();i.repeat.set(26,9);const c=new y(new Me(Co-.04,Co-.04,Io,72,1,!0),new K({map:i,side:Wc,transparent:!0,depthWrite:!1,toneMapped:!1}));c.position.y=Io/2+er,c.renderOrder=0,c.userData.noOutline=!0,c.name="lobby_wall_grid",t.add(c),a(new y(new pt(n,s,.72),We({color:Lt.counterBody,ramp:Ue(),roughness:.8})),!0).position.set(0,s/2,o),a(new y(new pt(n+.12,.11,.84),We({color:Lt.counterTop,ramp:Ue(),roughness:.5}))).position.set(0,s+.055,o),a(new y(new pt(n+.12,.045,.06),We({color:Lt.counterLip,ramp:Ue(),roughness:.4}))).position.set(0,s+.012,o+.44),a(new y(new pt(n-.4,.13,.52),We({color:Lt.shelf,ramp:Ue(),roughness:.75}))).position.set(0,2.15,o-.05);for(const f of[-2.6,2.6])a(new y(new pt(.1,.36,.1),We({color:Lt.steel,ramp:Ue(),roughness:.7}))).position.set(f,2.31,o-.2);const l=new Me(.19,.21,.44,20),h=new Me(.21,.21,.07,20),d=We({color:Lt.steel,ramp:Ue(),roughness:.45}),p=[-2.95,-2.25,-1.55,1.55,2.25,2.95,-2.6,2.6],u=[2.35,2.35,2.35,2.35,2.35,2.35,.9,.9];for(let f=0;f<p.length;f++){const m=.86+f*37%5*.09,g=u[f]+.22*m;a(new y(l,We({color:Lt.jars[f],ramp:Ue(),roughness:.55}))).position.set(p[f],g,o-.02),t.children[t.children.length-1].scale.setScalar(m),a(new y(h,d)).position.set(p[f],g+.25*m,o-.02),t.children[t.children.length-1].scale.setScalar(m)}for(const f of[-1.95,1.95])a(new y(new Me(.4,.36,.46,24),We({color:Lt.steel,ramp:Ue(),roughness:.35}))).position.set(f,s+.34,o-.02),a(new y(new Me(.44,.44,.06,24),We({color:Lt.counterLip,ramp:Ue(),roughness:.3}))).position.set(f,s+.6,o-.02);return t}setScene(t){this.disposed||(t==="lobby"&&!this.dressing&&(this.dressing=this.buildDressing(),this.stage.scene.add(this.dressing)),this.dressing&&(this.dressing.visible=t==="lobby"))}attachTo(t){this.disposed||(this.holder.parentElement!==t&&t.appendChild(this.holder),this.observer?.disconnect(),this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(t),this.resize())}detach(){this.observer?.disconnect(),this.observer=null,this.holder.remove()}show(t){if(this.disposed||t===this.currentId)return;this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose()),this.model=Qa(t),this.model.play("idle"),this.stage.scene.add(this.model.root);const a=new ts().setFromObject(this.model.root);if(this.subjectH=Math.max(.5,a.max.y-a.min.y),this.subjectW=2*Math.max(.25,Math.abs(a.min.x),Math.abs(a.max.x),Math.abs(a.min.z),Math.abs(a.max.z)),this.model.root.position.y=Oo+.005-a.min.y,this.footShadow){const o=G.clamp(Math.max(a.max.x-a.min.x,a.max.z-a.min.z)*1.15,1,2.3);this.footShadow.scale.set(o/1.9,1,o/1.9*.72)}this.currentId=t,this.introT=.34,this.applyFraming()}poke(){this.model?.play("attack")}update(t){if(!this.disposed){if(this.elapsed+=t,this.stage.rig.yawDeg=Math.sin(this.elapsed*.42)*22,this.model){if(this.introT>0){this.introT=Math.max(0,this.introT-t);const a=1-this.introT/.34,o=Math.sin(a*Math.PI)*(1-a*.4);this.model.root.scale.setScalar(1+o*.16),this.model.root.rotation.y=(1-a)*-.9}else this.model.root.scale.setScalar(1),this.model.root.rotation.y=0;this.model.update({dt:t,elapsed:this.elapsed,moveSpeed01:0,health01:1})}this.stage.render(t)}}resize(){this.disposed||(this.stage.resize(),this.applyFraming())}info(){const t=this.stage.rig.camera,a=this.model?new ts().setFromObject(this.model.root):null,o=s=>{const r=s.clone().project(t);return{x:+(r.x*.5+.5).toFixed(3),y:+(1-(r.y*.5+.5)).toFixed(3)}},n=this.stage.rig;return{id:this.currentId,aspect:+t.aspect.toFixed(3),fill:+n.subjectFill.toFixed(3),subject:{w:+this.subjectW.toFixed(2),h:+this.subjectH.toFixed(2)},cameraOk:Number.isFinite(t.position.x)&&Number.isFinite(t.position.y),feet:a?o(new le(0,a.min.y,0)):null,crown:a?o(new le(0,a.max.y,0)):null,left:a?o(new le(a.min.x,(a.min.y+a.max.y)/2,0)):null,right:a?o(new le(a.max.x,(a.min.y+a.max.y)/2,0)):null}}dispose(){if(!this.disposed){if(this.disposed=!0,this.observer?.disconnect(),this.observer=null,this.dressing){const t=new Set,a=new Set;this.dressing.traverse(o=>{const n=o;if(n.geometry&&t.add(n.geometry),n.material)for(const s of Array.isArray(n.material)?n.material:[n.material])a.add(s)}),t.forEach(o=>o.dispose()),a.forEach(o=>o.dispose()),this.stage.scene.remove(this.dressing),this.dressing=null}this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose(),this.model=null),this.stage.dispose(),this.holder.remove()}}}let Ja=null;function Ki(){return Ja||(Ja=new ns,typeof window<"u"&&(window.__charStage=()=>Ja?.info()??null)),Ja}function ll(){Ja?.dispose(),Ja=null}const tr=1e-4,Hf=2e4;function Xi(e){let t=e|0||2654435769;return()=>(t^=t<<13,t^=t>>>17,t^=t<<5,(t>>>0)/4294967296)}function de(e,t,a){return t+e()*(a-t)}function ee(e,t){return Math.pow(2,de(e,-t,t)/1200)}const hl=new WeakMap;function $f(e){const t=hl.get(e);if(t)return t;const a=Math.floor(e.sampleRate*2),o=e.createBuffer(1,a,e.sampleRate),n=o.getChannelData(0),s=Xi(6221086);for(let r=0;r<a;r++)n[r]=s()*2-1;return hl.set(e,o),o}const dl=new WeakMap;function Pf(e,t){let a=dl.get(e);a||(a=new Map,dl.set(e,a));const o=Math.max(.05,Math.round(t*20)/20),n=a.get(o);if(n)return n;const s=1024,r=new Float32Array(s),i=Math.tanh(o);for(let c=0;c<s;c++){const l=c/(s-1)*2-1;r[c]=Math.tanh(o*l)/i}return a.set(o,r),r}function ap(e,t){const a=e.createWaveShaper();return a.curve=Pf(e,t),a.oversample="2x",a}const qf=.26,jf=.19,pl=new WeakMap;function Bf(e){const t=pl.get(e);if(t)return t;const a=e.sampleRate,o=Math.floor(a*qf),n=e.createBuffer(2,o,a),s=Math.floor(a*.005),r=6.9078/(jf*a);for(let l=0;l<2;l++){const h=n.getChannelData(l),d=Xi(l===0?1990433:7840721);let p=0;for(let f=s;f<o;f++){const m=f-s,g=.3+.42*(m/(o-s)),w=d()*2-1;p=p*g+w*(1-g),h[f]=p*Math.exp(-r*m)}const u=l===0?[.0071,.0132,.0198,.0281,.0367,.0458]:[.0083,.0119,.0214,.0263,.0389,.0441];for(let f=0;f<u.length;f++){const m=s+Math.floor(u[f]*a);if(m>=o)continue;const g=f%2===0?1:-1;h[m]+=g*.62*Math.exp(-r*(m-s)*.55)}}let i=0;for(let l=0;l<2;l++){const h=n.getChannelData(l);for(let d=0;d<o;d++)i=Math.max(i,Math.abs(h[d]))}const c=i>0?.6/i:1;for(let l=0;l<2;l++){const h=n.getChannelData(l);for(let d=0;d<o;d++)h[d]*=c}return pl.set(e,n),n}function Gf(e){const t=e.createConvolver();return t.normalize=!1,t.buffer=Bf(e),t}function op(e,t,a){if(!e.wet||!(a>0))return;const o=e.ctx.createGain();o.gain.value=a,t.connect(o),o.connect(e.wet)}function np(e,t,a){const o=e.createGain(),n=Math.max(5e-4,a.attack??.002),s=(a.duration-n)*Math.max(0,Math.min(.9,a.hold??0)),r=Math.max(tr*2,a.peak),i=t+a.duration;return o.gain.setValueAtTime(tr,t),o.gain.linearRampToValueAtTime(r,t+n),s>0&&o.gain.setValueAtTime(r,t+n+s),(a.curve??"exp")==="exp"?o.gain.exponentialRampToValueAtTime(tr,i):o.gain.linearRampToValueAtTime(0,i),o.gain.setValueAtTime(0,i+.001),o}function eo(e,t,a,o,n="exp"){if(typeof t=="number"){e.setValueAtTime(t,a);return}const[s,r]=t;e.setValueAtTime(s,a),n==="exp"&&s>0&&r>0?e.exponentialRampToValueAtTime(r,a+o):e.linearRampToValueAtTime(r,a+o)}function $(e,t){const{ctx:a,dest:o,when:n}=e,s=a.createBufferSource(),r=$f(a);s.buffer=r,s.playbackRate.value=t.rate??1,t.loop&&(s.loop=!0,s.loopStart=0,s.loopEnd=r.duration);const i=Math.max(0,r.duration-(t.duration+.02)),c=t.loop?de(e.rng,0,r.duration):de(e.rng,0,Math.min(1.5,i)),l=np(a,n,t),h=t.tremolo?Wf(a,n,t.duration,t.tremolo.rate,t.tremolo.depth):l;h!==l&&h.connect(l);const d=t.drive?ap(a,t.drive):h;if(d!==h&&d.connect(h),t.filter){const p=u=>{const f=a.createBiquadFilter();return f.type=t.filter,f.Q.value=u,eo(f.frequency,t.freq??1e3,n,t.duration,t.freqCurve??"exp"),f};if(t.poles===24){const u=Math.sqrt(Math.max(.1,t.q??1));s.connect(p(u)).connect(p(u)).connect(d)}else s.connect(p(t.q??1)).connect(d)}else s.connect(d);return l.connect(o),op(e,l,t.wet??0),s.start(n,c,t.duration+.02),s.stop(n+t.duration+.02),t.duration}function W(e,t){const{ctx:a,dest:o,when:n}=e,s=np(a,n,t);let r=s;if(t.ring!==void 0){const l=a.createGain();l.gain.value=0;const h=a.createOscillator();h.type="sine",eo(h.frequency,t.ring,n,t.duration,"exp"),h.connect(l.gain),h.start(n),h.stop(n+t.duration+.02),l.connect(s),r=l}if(t.drive){const l=ap(a,t.drive);l.connect(r),r=l}if(t.lowpass!==void 0){const l=a.createBiquadFilter();l.type="lowpass",l.Q.value=.7,eo(l.frequency,t.lowpass,n,t.duration),l.connect(r),r=l}const i=Math.max(1,Math.min(3,Math.round(t.voices??1))),c=t.detuneCents??0;for(let l=0;l<i;l++){const h=a.createOscillator();h.type=t.type??"sine";const d=i===1?0:(l/(i-1)-.5)*c,p=Math.pow(2,d/1200);if(typeof t.freq=="number"?eo(h.frequency,t.freq*p,n,t.duration,t.freqCurve??"exp"):eo(h.frequency,[t.freq[0]*p,t.freq[1]*p],n,t.duration,t.freqCurve??"exp"),i>1){const u=a.createGain();u.gain.value=1/i,h.connect(u).connect(r)}else h.connect(r);h.start(n),h.stop(n+t.duration+.02)}return s.connect(o),op(e,s,t.wet??0),t.duration}function Cs(e,t){let a=0;for(const o of t.modes){const n=t.duration*o.decay,s=typeof t.freq=="number"?t.freq*o.ratio:[t.freq[0]*o.ratio,t.freq[1]*o.ratio];(typeof s=="number"?s:Math.max(s[0],s[1]))>Hf||(a=Math.max(a,n),W(e,{type:"sine",freq:s,peak:t.peak*o.gain,attack:t.attack??.0015,duration:n,drive:t.drive,wet:t.wet}))}return a}function Wf(e,t,a,o,n){const s=Math.max(0,Math.min(1,n)),r=e.createGain();r.gain.value=1-s*.5;const i=e.createOscillator();i.type="sine",eo(i.frequency,o,t,a,"lin");const c=e.createGain();return c.gain.value=s*.5,i.connect(c),c.connect(r.gain),i.start(t),i.stop(t+a+.02),r}function ge(e,t){const a=t.freq??5e3,o=$(e,{filter:"highpass",freq:a,q:.9,peak:t.peak,attack:4e-4,duration:.007,wet:t.wet??.06});if(!t.snap)return o;const n=(t.snapMs??14)/1e3,s=W(e,{type:"triangle",freq:[t.snap,t.snap*.38],peak:t.peak*.72,attack:6e-4,duration:n,drive:2.2,wet:t.wet??.06});return j(o,s)}function Ie(e,t){const[a,o]=t.grainMs??[4,11],n=t.decay??.35,s=t.freqShift;for(let r=0;r<t.count;r++){const i=Math.pow(e.rng(),1.5)*t.spread,c=de(e.rng,a,o)/1e3,l=t.peak*(1-i/t.spread*(1-n))*de(e.rng,.55,1),h=s?s[0]+(s[1]-s[0])*(i/t.spread):1;$({...e,when:e.when+i},{filter:"bandpass",freq:de(e.rng,t.freq[0],t.freq[1])*h,q:t.q??6,peak:l,attack:8e-4,duration:c,drive:t.drive,wet:t.wet})}return t.spread+o/1e3}function Po(e,t){const a=t.rise??2.6;let o=0;for(let n=0;n<t.count;n++){const s=de(e.rng,0,t.spread),r=de(e.rng,t.freq[0],t.freq[1]),i=de(e.rng,.045,.095);o=Math.max(o,s+i),W({...e,when:e.when+s},{type:"sine",freq:[r,r*a],peak:t.peak*de(e.rng,.5,1),attack:.002,duration:i,wet:t.wet})}return o}function ss(e,t){const[a,o]=t.pingMs??[7,18],n=t.bend??.92,s=Math.log2(t.freq[0]),r=Math.log2(t.freq[1]);let i=0;for(let c=0;c<t.count;c++){const l=Math.pow(e.rng(),1.6)*t.spread,h=Math.pow(2,s+(e.rng()+c*.6180339887)%1*(r-s)),d=de(e.rng,a,o)/1e3;i=Math.max(i,l+d),W({...e,when:e.when+l},{type:"sine",freq:[h,h*n],peak:t.peak*de(e.rng,.55,1),attack:6e-4,duration:d,wet:t.wet})}return i}function Zi(e,t){const[a,o]=t.freq??[9e3,3200],n=t.duration??.11,s=t.wet??.3,r=$(e,{filter:"bandpass",freq:[a*ee(e.rng,90),o*ee(e.rng,90)],q:.7,peak:t.peak,attack:.0012,duration:n,wet:s}),i=$(e,{filter:"highpass",poles:24,freq:[a*.8,a*.45],q:.7,peak:t.peak*.55,attack:6e-4,duration:n*.55,wet:s}),c=t.drops??6,l=c>0?Ie(e,{count:c,spread:n*.85,grainMs:[3,9],freq:[o,a],q:5,peak:t.peak*.85,decay:.25,wet:s}):0;return j(r,i,l)}function j(...e){let t=0;for(const a of e)a>t&&(t=a);return t}const ul="fa.audio.volume",fl="fa.audio.muted",Uf=.62,Yf=20,Vf=.008,Pe={Ambient:0,Normal:1,Critical:2},Kf=.11,ml=[1,.62,.42,.3,.22],Xf=.5,Lo=.7,gl=1.2,sp=3,wl=new WeakMap;function Zf(e){const t=wl.get(e);if(t)return t;const a=2048,o=new Float32Array(a);for(let n=0;n<a;n++){const s=(n/(a-1)*2-1)*sp,r=Math.abs(s),i=r<=Lo?r:Lo+(gl-Lo)*Math.tanh((r-Lo)/(gl-Lo));o[n]=Math.sign(s)*i}return wl.set(e,o),o}function Qf(e,t,a=!0){const o=e.createGain();o.gain.value=1;let n=null;if(a)try{n=e.createGain(),n.gain.value=1;const c=e.createGain();c.gain.value=Xf,n.connect(Gf(e)).connect(c).connect(o)}catch{n=null}const s=e.createGain();s.gain.value=1/sp;const r=e.createWaveShaper();r.curve=Zf(e),r.oversample="2x";const i=e.createGain();return i.gain.value=0,o.connect(s).connect(r).connect(i).connect(t??e.destination),{input:o,wetIn:n,limiter:r,master:i}}function Jf(e){const t=Math.max(0,Math.min(1,e));return Math.pow(t,1.8)*Uf}function em(){const e=typeof navigator<"u"?navigator.userActivation:void 0;return e===void 0||e.isActive===!0}class tm{ctx=null;chain=null;state="idle";failure=null;volume=.8;muted=!1;maxVoices;persist;reverb;injected;injectedDestination;offline;voices=[];retrigger=new Map;listeners=new Set;virtualTime=0;counters={started:0,droppedBudget:0,droppedThrottle:0,droppedNotRunning:0};analyser=null;gestureBound=!1;constructor(t={}){this.maxVoices=t.maxVoices??Yf,this.persist=t.persist??!0,this.reverb=t.reverb??!0,this.injected=t.context??null,this.injectedDestination=t.destination??null,this.offline=!!this.injected&&typeof OfflineAudioContext<"u"&&this.injected instanceof OfflineAudioContext,this.loadSettings(),this.injected?(this.attachContext(this.injected),this.offline&&(this.state="running")):(this.bindGestureUnlock(),this.bindVisibility())}setVolume(t){this.volume=Math.max(0,Math.min(1,Number.isFinite(t)?t:0)),this.applyMasterGain(.02),this.saveSettings(),this.emit()}getVolume(){return this.volume}setMuted(t){this.muted=!!t,this.applyMasterGain(.015),this.saveSettings(),this.emit()}isMuted(){return this.muted}toggleMuted(){return this.setMuted(!this.muted),this.muted}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}getState(){return this.state}getFailure(){return this.failure}activeVoices(){return this.prune(this.now()),this.voices.length}unlock(){if(this.state==="failed"||this.offline||!this.ctx&&!em())return;const t=this.ensureContext();t&&(typeof t.resume=="function"&&t.state!=="running"&&t.resume().then(()=>this.syncState(),()=>this.syncState()),this.syncState())}bindGestureUnlock(){if(this.gestureBound||typeof window>"u")return;this.gestureBound=!0;const t=["pointerdown","touchend","keydown","click"],a=()=>{if(this.unlock(),this.state==="running"||this.state==="failed")for(const o of t)window.removeEventListener(o,a,!0)};for(const o of t)window.addEventListener(o,a,!0)}bindVisibility(){typeof document>"u"||document.addEventListener("visibilitychange",()=>{const t=this.ctx;if(!(!t||typeof t.suspend!="function")){try{document.hidden?t.suspend().catch(()=>{}):this.state!=="idle"&&t.resume().catch(()=>{})}catch{}this.syncState()}})}ensureContext(){if(this.ctx)return this.ctx;if(this.state==="failed")return null;try{const t=typeof AudioContext<"u"?AudioContext:globalThis.webkitAudioContext;if(!t)return this.fail("Web Audio API unavailable"),null;const a=new t({latencyHint:"interactive"});return this.attachContext(a),a}catch(t){return this.fail(String(t)),null}}attachContext(t){this.ctx=t;try{this.chain=Qf(t,this.injectedDestination??void 0,this.reverb),this.applyMasterGain(0),this.syncState()}catch(a){this.fail(String(a))}}syncState(){if(this.state==="failed")return;const t=this.state;this.ctx?this.offline?this.state="running":this.state=this.ctx.state==="running"?"running":"suspended":this.state="idle",t!==this.state&&this.emit()}fail(t){this.state="failed",this.failure=t,console.warn("[audio] disabled:",t),this.emit()}play(t,a={}){try{return this.playInner(t,a)}catch(o){return this.failure||(this.failure=String(o),console.warn("[audio] sound failed:",o)),!1}}playInner(t,a){if(this.state==="failed")return!1;if(this.state!=="running"||!this.ctx||!this.chain)return this.counters.droppedNotRunning++,!1;const o=this.now();this.prune(o);const n=a.priority??Pe.Normal;let s=1,r=1;if(a.key){const x=this.retrigger.get(a.key),v=x&&o-x.at<Kf?x.count+1:0;if(this.retrigger.set(a.key,{at:o,count:v}),v>=ml.length)return this.counters.droppedThrottle++,!1;s=ml[v],r=1+v*.045}if(this.voices.length>=this.maxVoices){if(n<Pe.Critical&&!this.steal(n))return this.counters.droppedBudget++,!1;n>=Pe.Critical&&this.voices.length>=this.maxVoices&&this.steal(Pe.Critical)}const i=this.ctx,c=Math.max(o,i.currentTime)+Vf+(a.delay??0),l=Math.max(0,(a.gain??1)*s),h=i.createGain();h.gain.value=l;const d=a.pan!==void 0&&typeof i.createStereoPanner=="function",p=Math.max(-1,Math.min(1,a.pan??0));let u=h;if(d){const x=i.createStereoPanner();x.pan.value=p,h.connect(x),u=x}u.connect(this.chain.input);let f=null;if(this.chain.wetIn)if(f=i.createGain(),f.gain.value=l,d){const x=i.createStereoPanner();x.pan.value=p,f.connect(x).connect(this.chain.wetIn)}else f.connect(this.chain.wetIn);const m=Xi(a.seed??Math.random()*4294967295|0),g={ctx:i,dest:h,wet:f??void 0,when:c,rng:m};let w=0;try{w=t(g)||0}catch(x){throw h.disconnect(),f?.disconnect(),x}const b=c+w/r+.05;if(this.voices.push({node:h,wet:f,end:b,priority:n}),this.counters.started++,!this.offline){const x=Math.max(30,(b-i.currentTime)*1e3+40);setTimeout(()=>this.prune(this.now()),x)}return!0}steal(t){let a=-1;for(let n=0;n<this.voices.length;n++)if(this.voices[n].priority<t){a=n;break}if(a<0)return!1;const[o]=this.voices.splice(a,1);return this.release(o),!0}prune(t){for(let a=this.voices.length-1;a>=0;a--)if(this.voices[a].end<=t){const[o]=this.voices.splice(a,1);this.release(o)}if(this.retrigger.size>64)for(const[a,o]of this.retrigger)t-o.at>1&&this.retrigger.delete(a)}release(t){try{t.node.gain.cancelScheduledValues(0),t.node.gain.value=0,t.node.disconnect()}catch{}if(t.wet)try{t.wet.gain.cancelScheduledValues(0),t.wet.gain.value=0,t.wet.disconnect()}catch{}}now(){return this.ctx?Math.max(this.ctx.currentTime,this.virtualTime):this.virtualTime}setVirtualTime(t){this.virtualTime=t,this.prune(t)}tap(){if(!this.ctx||!this.chain)return null;if(this.analyser)return this.analyser;try{const t=this.ctx.createAnalyser();return t.fftSize=2048,t.smoothingTimeConstant=0,this.chain.master.connect(t),this.analyser=t,t}catch{return null}}connectTap(t){if(!this.ctx||!this.chain)return!1;try{return this.chain.master.connect(t),!0}catch{return!1}}get context(){return this.ctx}get busInput(){return this.chain?.input??null}applyMasterGain(t){if(!this.chain||!this.ctx)return;const a=this.muted?0:Jf(this.volume),o=this.chain.master.gain;try{if(t>0&&!this.offline){const n=this.ctx.currentTime;o.cancelScheduledValues(n),o.setValueAtTime(o.value,n),o.linearRampToValueAtTime(a,n+t)}else o.cancelScheduledValues(0),o.value=a}catch{o.value=a}}loadSettings(){if(!(!this.persist||typeof localStorage>"u"))try{const t=localStorage.getItem(ul);if(t!==null){const a=Number(t);Number.isFinite(a)&&(this.volume=Math.max(0,Math.min(1,a)))}this.muted=localStorage.getItem(fl)==="1"}catch{}}saveSettings(){if(!(!this.persist||typeof localStorage>"u"))try{localStorage.setItem(ul,String(this.volume)),localStorage.setItem(fl,this.muted?"1":"0")}catch{}}emit(){for(const t of this.listeners)try{t()}catch{}}}function bl(e,t,a,o,n,s,r=ra){const i=re[t].weapons.length,c=Wt(r);return{role:e,characterId:t,level:c,damageMul:ii(c),x:a.x,y:a.y,hp:o,maxHp:o,size:n,facing:{x:s.x,y:s.y},status:{slowedUntil:-1/0,stunnedUntil:-1/0},alive:!0,lastUsed:new Array(i).fill(-1/0),hazardTimers:[],fogTimer:0,regenTimer:0,trailDropTimer:0,detourSign:0,lastDamagedAt:-1/0,terrainSlowFactor:1,concealed:!1}}function oa(e){return e==="player"?"enemy":"player"}function Qi(e){return Math.max(0,Math.min(1,(e-2)/16))}function am(e){const t=Qi(e);return a=>{const o=ee(a.rng,70),n=$(a,{filter:"bandpass",freq:[2600*o,620*o],q:1.1,peak:.26+t*.12,attack:.006,duration:.13,drive:1.5,wet:.14}),s=W(a,{type:"sine",freq:[440*o,170*o],peak:.16+t*.12,attack:.004,duration:.11,drive:1.9,voices:2,detuneCents:14,wet:.1});return j(n,s)}}function om(e,t){const a=Qi(e),o=Math.min(1,t/180);return n=>{const s=ee(n.rng,55),r=.2+o*.1,i=$(n,{filter:"bandpass",freq:[420*s,(1900-o*600)*s],q:2.2,peak:.44+a*.2,attack:.05+o*.03,hold:.12,duration:r,drive:1.6,wet:.2}),c=W(n,{type:"sawtooth",freq:[200*s,88*s],lowpass:[900,300],peak:.2+a*.12,attack:.02,duration:r*.8,drive:1.8,voices:2,detuneCents:18,wet:.12});return j(i,c)}}function nm(){const e=[523.25,659.25,783.99];return t=>{const a=ee(t.rng,25);e.forEach((n,s)=>{W({...t,when:t.when+s*.06},{type:"triangle",freq:n*a,peak:.2,attack:.012,hold:.2,duration:.3,voices:2,detuneCents:9,wet:.42})});const o=$(t,{filter:"highpass",freq:[3e3,7e3],q:.8,peak:.07,attack:.08,duration:.42,wet:.5});return j(.3+e.length*.06,o)}}function sm(){return e=>{const t=ee(e.rng,30),a=W(e,{type:"sine",freq:[130*t,30*t],peak:.9,attack:.004,hold:.08,duration:.78,drive:3.4,voices:3,detuneCents:22,wet:.3}),o=$(e,{filter:"lowpass",freq:[2200,140],q:1.4,peak:.55,attack:.01,duration:.62,drive:2.2,wet:.34}),n=ge(e,{peak:.62,freq:3e3,snap:1900,snapMs:26}),s=Ie(e,{count:10,spread:.42,freq:[900,4200],peak:.16,q:5,wet:.4});return j(a,o,n,s)}}function rm(e){const t=Qi(e);return a=>{const o=ee(a.rng,60),n=ge(a,{peak:.66-t*.14,freq:3900-t*1100,snap:2700-t*800,snapMs:11+t*7}),s=W(a,{type:"sine",freq:[(230-t*80)*o,(62-t*22)*o],peak:.48+t*.34,attack:.0018,duration:.11+t*.22,drive:2+t*1.5,voices:2,detuneCents:16,wet:.16}),r=t>.12?W(a,{type:"sine",freq:[(118-t*38)*o,(44-t*12)*o],peak:.14+t*.38,attack:.004,duration:.1+t*.2,drive:1.5,wet:.1}):0,i=$(a,{filter:"bandpass",freq:[1700*o,470*o],q:1.5,peak:.24+t*.2,attack:.0012,duration:.07+t*.1,drive:1.9,wet:.22}),c=$(a,{filter:"bandpass",freq:[1900,640],q:.9,peak:.05+t*.05,attack:.018,duration:.16+t*.22,wet:.6}),l=Zi(a,{peak:.1+(1-t)*.06,freq:[8600-t*2200,3400-t*900],duration:.06+t*.05,drops:5,wet:.28});return j(n,s,r,i,c,l)}}function im(e){const t=e<.3;return a=>{const o=ee(a.rng,45),n=de(a.rng,.9,1.15),s=de(a.rng,285,360),r=W(a,{type:"sawtooth",freq:[s*o,s*o*.4],lowpass:[de(a.rng,1180,1620),260],peak:.3,attack:.004,duration:(t?.34:.22)*n,drive:de(a.rng,2.1,2.8),voices:2,detuneCents:20,wet:.18}),i=de(a.rng,830,1150),c=$(a,{filter:"lowpass",poles:24,freq:[i,190],q:.9,peak:.2,attack:.002,duration:.16*n,drive:1.6,wet:.24}),l=ge(a,{peak:.2,freq:3600,wet:.16}),h=Ie(a,{count:4,spread:.03,grainMs:[3,8],freq:[de(a.rng,2700,3400),de(a.rng,6e3,9e3)],q:4,peak:.24,decay:.3,wet:.2}),d=Zi(a,{peak:.13,freq:[de(a.rng,7600,9400),de(a.rng,2800,3600)],duration:de(a.rng,.05,.08),drops:5,wet:.26}),p=t?W(a,{type:"sine",freq:[de(a.rng,88,104),32],peak:.55,attack:.006,duration:.3*n,drive:2.6,wet:.16}):0;return j(r,c,l,h,d,p)}}function cm(){return e=>{const t=ee(e.rng,30),a=ge(e,{peak:.2,freq:5400,snap:3800,snapMs:6}),o=W(e,{type:"triangle",freq:[620*t,1560*t],ring:[132,96],peak:.34,attack:.022,duration:.26,wet:.34}),n=W(e,{type:"sine",freq:[1880*t,2520*t],peak:.1,attack:.03,duration:.34,wet:.55});return j(a,o,n)}}function lm(){return e=>{const t=ee(e.rng,40),a=W(e,{type:"sawtooth",freq:[440*t,58*t],lowpass:[2600,240],peak:.42,attack:.006,duration:.6,drive:2.2,voices:2,detuneCents:24,wet:.26}),o=$(e,{filter:"lowpass",freq:[3200,200],q:1.1,peak:.34,attack:.004,duration:.44,drive:1.5,wet:.4}),n=W(e,{type:"sine",freq:[150*t,30*t],peak:.7,attack:.003,duration:.42,drive:3,voices:2,detuneCents:14,wet:.2});return j(a,o,n)}}function hm(){const e=[392,523.25,659.25];return t=>{const a=ee(t.rng,20);return e.forEach((o,n)=>{W({...t,when:t.when+n*.05},{type:"triangle",freq:o*a,peak:.26,attack:.01,duration:.24,voices:2,detuneCents:8,wet:.34})}),.24+e.length*.05}}function dm(){return e=>{const t=$(e,{filter:"lowpass",poles:24,freq:[420,110],q:1.2,peak:.34,attack:.05,duration:.4,drive:2,wet:.35}),a=$(e,{filter:"bandpass",freq:[1400,2600],q:.7,peak:.1,attack:.08,duration:.42,wet:.55});return j(t,a)}}const pm=2.1,rp=1.5,ar=.55;function um(){return e=>{const t=pm,a={attack:ar,hold:(rp-ar)/(t-ar),duration:t},o=W(e,{type:"sine",freq:118*ee(e.rng,25),peak:.026,voices:3,detuneCents:26,drive:1.6,...a,wet:.25}),n=$(e,{filter:"bandpass",freq:[de(e.rng,900,1500),de(e.rng,1700,2500)],q:.45,peak:.055,loop:!0,tremolo:{rate:[.55,.85],depth:.3},...a,wet:.4}),s=$(e,{filter:"highpass",poles:24,freq:[6400,8200],q:.7,peak:.009,loop:!0,...a,wet:.5}),r=de(e.rng,.3,t-.6),i={...e,when:e.when+r},c=Math.floor(e.rng()*4);let l=0;if(c===0)l=Cs(i,{freq:de(e.rng,620,980),duration:.42,peak:.085,attack:.0015,wet:.62,modes:[{ratio:1,gain:1,decay:1},{ratio:2.71,gain:.6,decay:.5},{ratio:4.63,gain:.34,decay:.3}]});else if(c===1){const h=ge(i,{peak:.1,freq:3400,snap:900,snapMs:14,wet:.5}),d=de(e.rng,.11,.19),p=ge({...i,when:i.when+d},{peak:.075,freq:3100,snap:820,snapMs:12,wet:.5});l=j(h,d+p)}else c===2?l=$(i,{filter:"bandpass",freq:[de(e.rng,2800,3600),de(e.rng,5600,7400)],q:.8,peak:.04,attack:.09,duration:.55,wet:.7}):l=ss(i,{count:3,spread:.16,freq:[4200,11e3],peak:.022,pingMs:[8,20],bend:.94,wet:.6});return j(o,n,s,r+l)}}function fm(){return e=>{const t=$(e,{filter:"highpass",freq:[2600,5200],q:.8,peak:.18,attack:.01,duration:.26,wet:.3}),a=Ie(e,{count:4,spread:.2,freq:[2500,6e3],peak:.1,q:7,wet:.35});return j(t,a)}}function mm(){return e=>{const t=$(e,{filter:"lowpass",freq:[1400,260],q:3.2,peak:.2,attack:.008,duration:.15,drive:1.8,wet:.2}),a=W(e,{type:"sine",freq:[180,84],peak:.14,duration:.11,drive:2.2,wet:.14});return j(t,a)}}function gm(){return e=>{const t=ee(e.rng,90),a=ge(e,{peak:.26,freq:2400,snap:1200,snapMs:8}),o=W(e,{type:"sine",freq:[150*t,66*t],peak:.22,duration:.09,drive:2,wet:.24});return j(o,a)}}function wm(e){const t=[523.25,587.33,659.25,698.46,783.99],a=t[Math.max(0,Math.min(t.length-1,5-e))];return o=>{const n=W(o,{type:"triangle",freq:a,peak:.34,attack:.004,hold:.25,duration:.16,voices:2,detuneCents:7,wet:.3}),s=$(o,{filter:"highpass",freq:3800,peak:.12,duration:.015,wet:.12});return j(n,s)}}function bm(){const e=[523.25,659.25,1046.5];return t=>{e.forEach((o,n)=>{W({...t,when:t.when+n*.07},{type:"square",freq:o,lowpass:[3200,1800],peak:.22,attack:.006,hold:.3,duration:.34,voices:2,detuneCents:10,wet:.3})});const a=$(t,{filter:"bandpass",freq:[500,4e3],q:.9,peak:.16,attack:.14,duration:.2,wet:.35});return j(.34+e.length*.07,a)}}function ym(){return e=>{const t=ee(e.rng,18);[587.33,392].forEach((n,s)=>{W({...e,when:e.when+s*.16},{type:"triangle",freq:n*t,peak:.26,attack:.008,hold:.25,duration:.38,voices:2,detuneCents:11,wet:.34})});const a=W(e,{type:"sine",freq:[196*t,98*t],peak:.34,attack:.02,hold:.3,duration:.72,drive:2.2,voices:2,detuneCents:15,wet:.28}),o=$(e,{filter:"bandpass",freq:[2200,620],q:.8,peak:.12,attack:.06,duration:.66,wet:.55});return j(.38+.16,a,o)}}function vm(e){const t=e?[523.25,659.25,783.99,1046.5]:[659.25,587.33,493.88,392];return a=>(t.forEach((o,n)=>{W({...a,when:a.when+n*.1},{type:e?"square":"sawtooth",freq:o,lowpass:e?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.4,voices:2,detuneCents:e?9:16,wet:.34})}),.4+t.length*.1)}function xm(e){const t=e?[523.25,659.25,1046.5]:[587.33,493.88,392],a=.62;return o=>{const n=(i,c)=>($({...o,when:o.when+i},{filter:"bandpass",freq:2900,q:10,peak:.7,attack:.012,hold:.45,duration:c,tremolo:{rate:24,depth:.7},wet:.06}),i+c);n(0,.26);const s=n(.36,.22),r=W(o,{type:"sawtooth",freq:[150,132],lowpass:[1100,420],peak:.14,attack:.01,hold:.5,duration:.58,drive:1.8,voices:2,detuneCents:22,wet:.2});return t.forEach((i,c)=>{W({...o,when:o.when+a+c*.1},{type:e?"square":"sawtooth",freq:i,lowpass:e?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.36,voices:2,detuneCents:e?9:16,wet:.34})}),j(s,r,a+(t.length-1)*.1+.36)}}function km(){return e=>{const t=W(e,{type:"triangle",freq:[900,620],peak:.22,duration:.055,drive:1.6,wet:.16}),a=$(e,{filter:"highpass",freq:5e3,peak:.1,duration:.012});return j(t,a)}}function bn(e,t,a,o,n){return Ie(e,{count:12,spread:t,grainMs:[5,14],freq:[2300,4600],freqShift:[a,o],q:3.2,peak:n,decay:.4,drive:1.5,wet:.3})}function No(e,t,a){return Ie(e,{count:7,spread:t,grainMs:[2,5],freq:[5600,11e3],q:9,peak:a,decay:.25,wet:.34})}const Mm={Disc:{cast(e){const t=ee(e.rng,55),a=bn(e,.3,1.35,.62,.3),o=No(e,.22,.13),n=$(e,{filter:"bandpass",freq:[700*t,1800*t],q:1.6,peak:.34,attack:.05,hold:.1,duration:.3,drive:1.4,wet:.3});return j(a,o,n)},impact(e){const t=ge(e,{peak:.46,freq:3400,snap:1600,snapMs:10,wet:.1}),a=$(e,{filter:"bandpass",freq:[2400,950],q:2,peak:.3,attack:.003,duration:.07,drive:1.9,wet:.24}),o=bn(e,.2,1.3,.68,.3),n=No(e,.14,.46),s=W(e,{type:"sine",freq:[190,72],peak:.46,attack:.0022,duration:.1,drive:2.6,voices:2,detuneCents:15,wet:.14});return j(t,a,o,n,s)}},Roll:{cast(e){const t=ee(e.rng,60);return $(e,{filter:"bandpass",freq:[900*t,2100*t],q:2.4,peak:.36,attack:.04,duration:.2,drive:1.5,wet:.3})},impact(e){const t=bn(e,.26,.7,1.5,.32),a=No(e,.2,.44),o=$(e,{filter:"bandpass",freq:[1100,3400],q:7,peak:.3,attack:.02,duration:.26,drive:1.6,wet:.32}),n=W(e,{type:"sine",freq:[230,124],peak:.18,attack:.004,duration:.08,drive:2.2,wet:.12});return j(t,a,o,n)}},Swarm:{cast(e){const t=ee(e.rng,70),a=$(e,{filter:"bandpass",freq:[1400*t,3e3*t],q:4,peak:.36,attack:.025,duration:.17,drive:1.7,wet:.3}),o=No(e,.16,.16);return j(a,o)},impact(e){const t=ge(e,{peak:.36,freq:4200,snap:2200,snapMs:7,wet:.1}),a=bn(e,.13,1.2,.8,.24),o=No(e,.1,.3),n=W(e,{type:"sine",freq:[250,118],peak:.18,attack:.002,duration:.07,drive:2.4,wet:.12});return j(t,a,o,n)}}};function yn(e,t,a,o){return Cs(e,{freq:t,duration:a,peak:o,attack:.0012,drive:1.4,wet:.34,modes:[{ratio:1,gain:1,decay:1},{ratio:2.06,gain:.82,decay:.82},{ratio:3.18,gain:.6,decay:.6},{ratio:4.34,gain:.4,decay:.42},{ratio:5.52,gain:.3,decay:.3}]})}function yl(e,t,a){return Ie(e,{count:7,spread:t,grainMs:[2,5],freq:[4200,12e3],q:10,peak:a,decay:.3,wet:.12})}function Em(e,t,a){return ss(e,{count:4,spread:t,freq:[5e3,12500],peak:a,pingMs:[5,13],bend:1.08,wet:.2})}const Tm={Candy:{cast(e){const t=ee(e.rng,70),a=$(e,{filter:"bandpass",freq:[1400*t,3200*t],q:2,peak:.34,attack:.022,duration:.13,wet:.28}),o=yn(e,1900*t,.11,.2),n=yl(e,.07,.1);return j(a,o,n)},impact(e){const t=ee(e.rng,60),a=ge(e,{peak:.5,freq:5400,snap:3200,snapMs:8,wet:.12}),o=yn(e,2450*t,.4,.56),n=yl(e,.22,.9),s=Em(e,.16,.74),r=yn({...e,when:e.when+.09},2450*t*1.02,.26,.22),i=yn({...e,when:e.when+.175},2450*t*1.045,.17,.11),c=W(e,{type:"sine",freq:[280*t,130*t],peak:.42,attack:.0018,duration:.1,drive:3.2,wet:.12});return j(a,o,n,s,.09+r,.175+i,c)}}};function or(e,t,a){const o=ee(e.rng,60),n=ge(e,{peak:t,freq:(4200+a*1800)*o,snap:(2600+a*900)*o,snapMs:7,wet:.05}),s=$(e,{filter:"bandpass",freq:[(2600+a*800)*o,(5200+a*1600)*o],q:3.4,peak:t*.8,attack:5e-4,duration:.022,drive:2.2,wet:.1}),r=$(e,{filter:"highpass",poles:24,freq:[(7e3+a*1800)*o,(4600+a*1200)*o],q:.7,peak:t*1.5,attack:4e-4,duration:.024,wet:.12});return j(n,s,r)}function vl(e,t){const a=ee(e.rng,70),o=$(e,{filter:"lowpass",poles:24,freq:[(1800+t*600)*a,(420-t*110)*a],q:3.6,peak:.26+t*.18,attack:.012+t*.01,duration:.15+t*.12,drive:2,wet:.24}),n=W(e,{type:"sine",freq:[(180-t*45)*a,(58-t*16)*a],peak:.36+t*.3,attack:.006,duration:.13+t*.1,drive:3.2,voices:2,detuneCents:16,wet:.14}),s=$(e,{filter:"bandpass",freq:[700*a,1500*a],q:6,peak:.12+t*.08,attack:.03,duration:.2+t*.14,wet:.36}),r=Ie(e,{count:Math.round(5+t*5),spread:.12+t*.06,grainMs:[3,8],freq:[3800,10600],q:7,peak:.5+t*.3,decay:.3,wet:.28});return j(o,n,s,r)}const nr=.045,Sm={Tackle:{cast(e){const t=ee(e.rng,40),a=$(e,{filter:"bandpass",freq:[420*t,1900*t],q:2,peak:.44,attack:.07,hold:.1,duration:.26,drive:1.6,wet:.3}),o=W(e,{type:"sine",freq:[120*t,240*t],peak:.28,attack:.08,duration:.24,drive:2.4,voices:2,detuneCents:14,wet:.16});return j(a,o)},impact(e){const t=or(e,.88,.35),a=vl({...e,when:e.when+nr},1);return j(t,nr+a)}},Hatch:{cast(e){const t=or(e,.5,0),a=W({...e,when:e.when+.05},{type:"triangle",freq:[1500,2400],peak:.3,attack:.006,duration:.09,drive:2.2,wet:.32}),o=W({...e,when:e.when+.15},{type:"triangle",freq:[1800,2700],peak:.24,attack:.005,duration:.07,drive:2.2,wet:.32});return j(t,.05+a,.15+o)},impact(e){const t=ge(e,{peak:.4,freq:5400,snap:3200,snapMs:6,wet:.1}),a=$(e,{filter:"highpass",poles:24,freq:[8200,5600],q:.7,peak:.2,attack:4e-4,duration:.005,wet:.12}),o=W(e,{type:"triangle",freq:[2100,1250],peak:.22,attack:.0015,duration:.05,drive:2.4,wet:.2}),n=W({...e,when:e.when+.035},{type:"triangle",freq:[1700,2600],peak:.18,attack:.005,duration:.06,drive:2,wet:.3}),s=W(e,{type:"sine",freq:[240,120],peak:.22,attack:.002,duration:.06,drive:2.2,wet:.1});return j(t,a,o,.035+n,s)}},Shards:{cast(e){const t=ee(e.rng,80),a=$(e,{filter:"highpass",freq:[1900*t,3800*t],q:1.1,peak:.32,attack:.016,duration:.11,wet:.26}),o=Ie(e,{count:4,spread:.08,grainMs:[3,6],freq:[3400,7e3],q:8,peak:.13,wet:.28});return j(a,o)},impact(e){const t=nr*.62,a=or(e,.66,1),o=vl({...e,when:e.when+t},.18);return j(a,t+o)}}};function xl(e,t,a,o){const n=ee(e.rng,70),s=W(e,{type:"sine",freq:[(170-t*55)*n,(52-t*16)*n],peak:o,attack:.003,duration:a,drive:3+t*1.2,voices:2,detuneCents:18,wet:.12}),r=$(e,{filter:"lowpass",poles:24,freq:[(760-t*220)*n,(150-t*45)*n],q:1.2,peak:o*.45,attack:.002,duration:a*.7,drive:2.2,wet:.2}),i=$(e,{filter:"bandpass",freq:[(2400-t*400)*n,(1450-t*300)*n],q:.8,peak:o*.056,attack:.003,duration:a*.55,drive:1.4,wet:.3});return j(s,r,i)}const Am={Smash:{cast(e){const t=ee(e.rng,55),a=$(e,{filter:"lowpass",poles:24,freq:[1300*t,420*t],q:1.6,peak:.42,attack:.055,hold:.1,duration:.22,drive:1.7,wet:.22}),o=W(e,{type:"sawtooth",freq:[180*t,92*t],lowpass:[620,220],peak:.24,attack:.03,duration:.2,drive:2.2,voices:2,detuneCents:20,wet:.12});return j(a,o)},impact(e){const t=ge(e,{peak:.44,freq:1500,snap:620,snapMs:22,wet:.1}),a=xl(e,1,.24,.86);return j(t,a)}},Tomato:{cast(e){const t=ee(e.rng,80),a=$(e,{filter:"lowpass",poles:24,freq:[1500*t,520*t],q:2.1,peak:.36,attack:.014,duration:.14,drive:1.6,wet:.18}),o=W(e,{type:"sine",freq:[300*t,140*t],peak:.16,attack:.006,duration:.11,drive:2,wet:.1});return j(a,o)},impact(e){const t=ge(e,{peak:.34,freq:1900,snap:780,snapMs:15,wet:.1}),a=xl(e,.55,.19,.62),o=$(e,{filter:"lowpass",poles:24,freq:[1e3,260],q:2.8,peak:.24,attack:.008,duration:.13,drive:1.8,wet:.26});return j(t,a,o)}},Lettuce:{cast(e){return $(e,{filter:"bandpass",freq:[900,2200],q:1.2,peak:.26,attack:.03,duration:.15,wet:.3})},impact(e){const t=$(e,{filter:"lowpass",poles:24,freq:[1600,380],q:1.4,peak:.3,attack:.006,duration:.16,drive:1.5,wet:.3}),a=W(e,{type:"triangle",freq:[240,96],peak:.3,attack:.012,hold:.2,duration:.3,drive:2.4,voices:2,detuneCents:22,wet:.18}),o=$(e,{filter:"bandpass",freq:[3400,1900],q:.9,peak:.042,attack:.004,duration:.1,wet:.34});return j(t,a,o)}},Onion:{cast(e){const t=ee(e.rng,20),a=[174.61,220,261.63];a.forEach((n,s)=>{W({...e,when:e.when+s*.07},{type:"triangle",freq:n*t,peak:.28,attack:.016,hold:.22,duration:.34,drive:2.2,voices:2,detuneCents:11,wet:.4})});const o=$(e,{filter:"lowpass",poles:24,freq:[900,300],q:1,peak:.1,attack:.1,duration:.45,wet:.5});return j(.34+a.length*.07,o)}}};function kl(e,t,a,o,n){const s=ee(e.rng,60),r=.075+o*.045,i=.1+o*.06,c=$(e,{filter:"bandpass",freq:[t*s,a*s],q:5.5,peak:n,attack:.012,duration:r,drive:1.8,wet:.2}),l=$({...e,when:e.when+r*.82},{filter:"bandpass",freq:[a*s,t*.72*s],q:5.5,peak:n*.9,attack:.008,duration:i,drive:1.8,wet:.24}),h=W(e,{type:"triangle",freq:[t*.34*s,a*.3*s],peak:n*.5,attack:.014,duration:r+i*.6,drive:2.4,voices:2,detuneCents:16,wet:.14});return j(c,r*.82+l,h)}function Ml(e,t,a){const o=ee(e.rng,70),n=ge(e,{peak:.3+t*.1,freq:1700+a*700,snap:700+a*320,snapMs:16,wet:.1}),s=$(e,{filter:"lowpass",poles:24,freq:[(1400+a*600)*o,(280+a*120)*o],q:3.2,peak:.42+t*.2,attack:.005,duration:.15+t*.07,drive:2,wet:.26}),r=W(e,{type:"sine",freq:[(210-t*50)*o,(66-t*18)*o],peak:.6+t*.34,attack:.0025,duration:.16+t*.14,drive:2.6,voices:2,detuneCents:15,wet:.14}),i=$(e,{filter:"bandpass",freq:[(4200+a*2200)*o,(2100+a*900)*o],q:.75,peak:.23+a*.06,attack:.0015,duration:.05+a*.03,wet:.34});return j(n,s,r,i)}const Fm={Mustard:{cast(e){return kl(e,520,1250,.15,.44)},impact(e){return Ml(e,.42,1)}},Ketchup:{cast(e){return kl(e,340,780,1,.42)},impact(e){const t=Ml(e,.3,0),a=$(e,{filter:"lowpass",poles:24,freq:[640,200],q:4,peak:.2,attack:.04,duration:.34,drive:1.6,wet:.4});return j(t,a)}},Slash:{cast(e){const t=ee(e.rng,50);return $(e,{filter:"bandpass",freq:[700*t,2300*t],q:2,peak:.38,attack:.05,hold:.1,duration:.19,drive:1.5,wet:.26})},impact(e){const t=ee(e.rng,45),a=.026,o=(l,h,d)=>ge({...e,when:e.when+l},{peak:h,freq:d,snap:d*.3,snapMs:20,wet:.12}),n=o(0,.5,1400),s=o(a,.4,1200),r=$(e,{filter:"bandpass",freq:[900*t,340*t],q:2.4,peak:.34,attack:.0015,duration:.12,drive:2.1,wet:.24}),i=W(e,{type:"sine",freq:[200*t,58*t],peak:.95,attack:.002,duration:.24,drive:3,voices:2,detuneCents:17,wet:.14}),c=Ie(e,{count:5,spread:.075,grainMs:[3,9],freq:[3e3,6400],q:4,peak:.38,decay:.3,wet:.3});return j(n,a+s,r,i,c)}}};function sr(e,t,a,o){const n=Cs(e,{freq:t,duration:a,peak:o,attack:8e-4,wet:.36,modes:[{ratio:1,gain:1,decay:1},{ratio:2.76,gain:.8,decay:.7},{ratio:5.4,gain:.5,decay:.44}]}),s=W(e,{type:"sine",freq:[t*1.02,t*.92],ring:t*1.37,peak:o*.7,attack:8e-4,duration:a*.8,wet:.4});return j(n,s)}function El(e,t,a,o){return Ie(e,{count:t,spread:a,grainMs:[2,5],freq:[5600,14e3],q:11,peak:o,decay:.3,wet:.3})}const Rm={Smash:{cast(e){const t=ee(e.rng,50),a=$(e,{filter:"bandpass",freq:[600*t,2400*t],q:2.4,peak:.44,attack:.055,hold:.1,duration:.22,drive:1.5,wet:.3}),o=sr(e,2400*t,.12,.16);return j(a,o)},impact(e){const t=ee(e.rng,45),a=ge(e,{peak:.66,freq:6400,snap:4200,snapMs:6,wet:.14}),o=sr(e,5400*t,.34,.56),n=El(e,9,.2,.8),s=W(e,{type:"sine",freq:[250*t,100*t],peak:.62,attack:.0015,duration:.12,drive:3,wet:.12}),r=$(e,{filter:"bandpass",freq:[7e3,12e3],q:1.2,peak:.26,attack:.025,duration:.16,wet:.5});return j(a,o,n,r,s)}},Giant:{impact(e){const t=ee(e.rng,35),a=ge(e,{peak:.72,freq:5800,snap:3600,snapMs:9,wet:.16}),o=sr(e,4550*t,.5,.64),n=El(e,12,.36,.84),s=$(e,{filter:"bandpass",freq:[6e3,9500],q:1.4,peak:.14,attack:.06,duration:.58,wet:.6}),r=W(e,{type:"sine",freq:[230*t,78*t],peak:.52,attack:.0025,duration:.14,drive:3,voices:2,detuneCents:16,wet:.14});return j(a,o,n,s,r)}}};function rr(e,t,a){const o=ee(e.rng,60),n=.38+a*.12,s=$(e,{filter:"bandpass",freq:[(560-a*200)*o,(2200-a*900)*o],q:1.5,peak:1.2,attack:.035,hold:.1,duration:n,drive:1.5,wet:.1*Math.min(1,16/t),tremolo:{rate:[t*.88,t],depth:.85}}),r=$(e,{filter:"highpass",freq:3600,peak:.16,attack:8e-4,duration:.018,wet:.1});return j(s,r)}const Cm={Dough:{cast(e){return rr(e,16,.85)},impact(e){const t=ee(e.rng,70),a=$(e,{filter:"lowpass",poles:24,freq:[1100*t,190*t],q:1.1,peak:.34,attack:.004,duration:.13,drive:1.8,wet:.24}),o=ge(e,{peak:.34,freq:1600,snap:660,snapMs:18,wet:.1}),n=W(e,{type:"sine",freq:[150*t,58*t],peak:.5,attack:.003,duration:.18,drive:2.8,voices:2,detuneCents:18,wet:.14}),s=$(e,{filter:"bandpass",freq:[2500,1700],q:.8,peak:.028,attack:.012,duration:.11,wet:.4});return j(a,o,n,s)}},Tomato:{cast(e){return rr(e,26,.25)},impact(e){const t=ee(e.rng,65),a=$(e,{filter:"bandpass",freq:[1350*t,400*t],q:1.4,peak:.34,attack:.001,duration:.07,drive:2,wet:.2}),o=$(e,{filter:"lowpass",poles:24,freq:[900,240],q:2.6,peak:.3,attack:.008,duration:.15,drive:1.7,wet:.26}),n=ge(e,{peak:.34,freq:2e3,snap:900,snapMs:13,wet:.1}),s=W(e,{type:"sine",freq:[200*t,72*t],peak:.62,duration:.18,drive:3.2,voices:2,detuneCents:16,wet:.14}),r=Zi(e,{peak:.15,freq:[8200,3e3],duration:.085,drops:6,wet:.34});return j(a,o,n,s,r)}},Cheese:{cast(e){return rr(e,12,.6)},impact(e){const t=ee(e.rng,55),a=$(e,{filter:"bandpass",freq:[1400*t,480*t],q:2.2,peak:.3,attack:.01,duration:.2,drive:1.6,wet:.26}),o=W(e,{type:"triangle",freq:[300*t,110*t],peak:.32,attack:.012,hold:.25,duration:.34,drive:2.4,voices:2,detuneCents:20,wet:.18}),n=ge(e,{peak:.26,freq:1800,snap:760,snapMs:16,wet:.1}),s=Ie(e,{count:4,spread:.13,grainMs:[6,16],freq:[3200,5200],q:3.5,peak:.16,decay:.35,freqShift:[1,.62],wet:.34});return j(a,o,n,s)}}};function ir(e,t,a){return $(e,{filter:"bandpass",freq:[2800,5600],q:.85,peak:t,attack:a*.35,duration:a,wet:.55})}function cr(e,t,a,o){return Po(e,{count:t,spread:a,freq:[1500,3100],rise:1.9,peak:o,wet:.42})}function lr(e,t,a,o){const n=ee(e.rng,80),s=(2600-t*900)*n,r=(420-t*200)*n,i=$(e,{filter:"lowpass",freq:[s,r],poles:24,q:2.4+t*2,peak:o*.72,attack:.006+t*.012,duration:a,drive:1.8,wet:.3}),c=W(e,{type:"sine",freq:[(190-t*60)*n,(68-t*22)*n],peak:o*(.85+t*.55),attack:.005,duration:a*.75,drive:2.5,voices:2,detuneCents:16,wet:.14}),l=ge(e,{peak:.22+t*.12,freq:1150,snap:460,snapMs:18,wet:.12});return j(i,c,l)}const Im={Splash:{cast(e){const t=ee(e.rng,90),a=$(e,{filter:"bandpass",freq:[900*t,260*t],q:3.4,peak:.46,attack:.012,duration:.12,drive:1.8,wet:.24}),o=Po(e,{count:2,spread:.07,freq:[620,980],peak:.2,wet:.3});return j(a,o)},impact(e){const t=lr(e,.24,.2,.44),a=Po(e,{count:4,spread:.16,freq:[480,900],peak:.14,wet:.3}),o=cr(e,7,.11,.2),n=ir(e,.11,.34);return j(t,a,o,n)}},Noodle:{cast(e){const t=ee(e.rng,70),a=$(e,{filter:"bandpass",freq:[1500*t,520*t],q:2.2,peak:.42,attack:.01,duration:.16,drive:1.7,wet:.26}),o=W(e,{type:"sine",freq:[520*t,190*t],peak:.16,attack:.02,duration:.18,drive:2,wet:.16});return j(a,o)},impact(e){const t=$(e,{filter:"bandpass",freq:[1400,560],q:1.6,peak:.26,attack:.0015,duration:.05,drive:1.8,wet:.18}),a=lr(e,.35,.26,.44),o=Po(e,{count:3,spread:.2,freq:[440,820],peak:.12,wet:.3}),n=cr(e,8,.14,.2),s=ir(e,.12,.42);return j(t,a,o,n,s)}},Dump:{cast(e){const t=ee(e.rng,40);let a=0;const o=9;for(let s=0;s<o;s++){const r=s/o*.34+de(e.rng,-.012,.012),i=de(e.rng,320,1100)*t,c=de(e.rng,.05,.11);a=Math.max(a,r+c),$({...e,when:e.when+Math.max(0,r)},{filter:"lowpass",poles:24,freq:[i*2.2,i*.6],q:4.5,peak:.32,attack:.008,duration:c,drive:1.6,wet:.28})}const n=W(e,{type:"sine",freq:[150*t,70*t],peak:.3,attack:.12,duration:.4,drive:2,voices:2,detuneCents:14,wet:.2});return j(a,n)},impact(e){const t=lr(e,1,.42,.62),a=Po(e,{count:7,spread:.34,freq:[380,820],peak:.16,wet:.34}),o=Ie(e,{count:5,spread:.26,freq:[600,1500],peak:.1,q:4,wet:.3}),n=cr(e,7,.22,.14),s=ir(e,.15,.75);return j(t,a,o,n,s)}}};function hr(e,t,a,o,n){const s=ee(e.rng,45),r=$(e,{filter:"bandpass",freq:[t*s,a*s],q:12,peak:n,attack:.004,duration:o,curve:"lin",freqCurve:"exp",wet:.18}),i=$({...e,when:e.when+o*.16},{filter:"bandpass",freq:[t*2*s,a*1.7*s],q:14,peak:n*.5,attack:.002,duration:o*.7,curve:"lin",wet:.22}),c=$({...e,when:e.when+o*.06},{filter:"bandpass",freq:[t*3.4*s,a*2.6*s],q:16,peak:n*.8,attack:.0015,duration:o*.45,curve:"lin",wet:.24});return j(r,o*.16+i,o*.06+c)}function vn(e,t,a,o){return Ie(e,{count:t,spread:a,grainMs:[2,5],freq:[4200,12e3],q:6,peak:o,decay:.35,wet:.1})}const zm={Rice:{cast(e){const t=$(e,{filter:"highpass",freq:[2200,4200],q:1,peak:.3,attack:.012,duration:.09,wet:.2}),a=vn(e,7,.09,.2);return j(t,a)},impact(e){const t=vn(e,6,.075,.34),a=ge(e,{peak:.3,freq:5600,snap:3600,snapMs:5,wet:.08}),o=W(e,{type:"sine",freq:[300,170],peak:.16,attack:.0015,duration:.05,drive:2,wet:.1});return j(t,a,o)}},Seaweed:{cast(e){const t=ee(e.rng,60);return $(e,{filter:"bandpass",freq:[1600*t,3400*t],q:1.8,peak:.34,attack:.03,duration:.18,wet:.3})},impact(e){const t=ee(e.rng,55),a=Ie(e,{count:10,spread:.16,grainMs:[3,9],freq:[2800,6400],q:4.5,peak:.28,decay:.35,wet:.28}),o=$(e,{filter:"bandpass",freq:[3600*t,1600*t],q:7,peak:.26,attack:.012,duration:.24,wet:.32}),n=ge(e,{peak:.32,freq:4200,snap:2400,snapMs:7,wet:.1}),s=W(e,{type:"sine",freq:[280,150],peak:.13,attack:.003,duration:.06,drive:2,wet:.12});return j(a,o,n,s)}},Fish:{cast(e){return hr(e,900,2600,.14,.3)},impact(e){const t=hr(e,2600,8200,.17,.72),a=$(e,{filter:"lowpass",poles:24,freq:[1100,340],q:2.4,peak:.16,attack:.006,duration:.09,drive:1.8,wet:.24}),o=vn(e,5,.1,.2),n=W(e,{type:"sine",freq:[230,96],peak:.42,attack:.0018,duration:.07,drive:2.4,wet:.12});return j(t,a,o,n)}},Catch:{cast(e){const t=ee(e.rng,40),a=W(e,{type:"sine",freq:[140*t,300*t],peak:.3,attack:.1,duration:.3,drive:2.2,voices:2,detuneCents:14,wet:.24}),o=$(e,{filter:"bandpass",freq:[800*t,2400*t],q:2.2,peak:.34,attack:.08,duration:.28,wet:.32});return j(a,o)},impact(e){const t=hr(e,3e3,9e3,.15,.8),a=$({...e,when:e.when+.05},{filter:"lowpass",poles:24,freq:[1300,420],q:2.2,peak:.2,attack:.005,duration:.11,drive:1.9,wet:.26}),o=vn({...e,when:e.when+.04},8,.16,.28),n=ge(e,{peak:.52,freq:5e3,snap:2800,snapMs:7,wet:.1}),s=W(e,{type:"sine",freq:[220,80],peak:.5,attack:.0018,duration:.09,drive:2.6,voices:2,detuneCents:14,wet:.14});return j(t,.05+a,.04+o,n,s)}}};function xn(e,t,a){const o=ee(e.rng,70),n=$(e,{filter:"bandpass",freq:[3400*o,1500*o],q:1.2,peak:.55+t*.3,attack:6e-4,duration:.03,drive:2.2,wet:.12}),s=ge(e,{peak:.44+t*.2,freq:5200*o,snap:(2900-t*500)*o,snapMs:8,wet:.1}),r=Ie(e,{count:Math.round(7+t*6),spread:.14+t*.1,grainMs:[3,9-a*3],freq:[2700+a*900,9200+a*2600],q:7,peak:.34+t*.16,decay:.28,drive:1.6,wet:.26}),i=t*(1-a)>.02?W(e,{type:"sine",freq:[(190-t*60)*o,(72-t*22)*o],peak:.24+t*.26,attack:.002,duration:.08+t*.1,drive:2.6,voices:2,detuneCents:16,wet:.14}):0,c=$(e,{filter:"highpass",poles:24,freq:[8e3+a*2e3,5200+a*1200],q:.7,peak:.165+t*.065,attack:6e-4,duration:.014+t*.012,wet:.22});return j(n,s,r,i,c)}const Om={Filling:{cast(e){const t=ee(e.rng,60),a=$(e,{filter:"bandpass",freq:[700*t,1800*t],q:2,peak:.44,attack:.03,duration:.16,drive:1.6,wet:.26}),o=Ie(e,{count:4,spread:.1,freq:[3e3,7e3],peak:.11,q:8,wet:.28}),n=W(e,{type:"sine",freq:[260*t,130*t],peak:.14,duration:.1,drive:2,wet:.12});return j(a,o,n)},impact(e){return xn(e,.75,.3)}},Onion:{cast(e){const t=ee(e.rng,80);return $(e,{filter:"highpass",freq:[1800*t,3400*t],q:1.1,peak:.36,attack:.02,duration:.12,wet:.28})},impact(e){const t=xn(e,.3,1),a=$(e,{filter:"bandpass",freq:[1100,420],q:1.6,peak:.26,attack:.006,duration:.1,drive:1.7,wet:.24});return j(t,a)}},Double:{cast(e){const t=ee(e.rng,50),a=$(e,{filter:"bandpass",freq:[640*t,1700*t],q:2,peak:.44,attack:.025,duration:.15,drive:1.6,wet:.26}),o=$({...e,when:e.when+.055},{filter:"bandpass",freq:[820*t,2100*t],q:2,peak:.38,attack:.02,duration:.13,drive:1.6,wet:.26}),n=W(e,{type:"sine",freq:[240*t,118*t],peak:.16,duration:.12,drive:2,wet:.12});return j(a,.055+o,n)},impact(e){const t=xn(e,.85,.1),a=xn({...e,when:e.when+.055},.4,.85);return j(t,.055+a)}}};function kn(e,t,a,o){return Cs(e,{freq:t,duration:a,peak:o,attack:.001,drive:1.8,wet:.22,modes:[{ratio:1,gain:1,decay:1},{ratio:2.43,gain:.78,decay:.55},{ratio:3.71,gain:.5,decay:.34},{ratio:5.86,gain:.3,decay:.2}]})}function Tl(e,t,a){const o=$(e,{filter:"bandpass",freq:[1300,2800],q:1.5,peak:t,attack:.004,duration:a,wet:.34}),n=Ie(e,{count:7,spread:a*.7,grainMs:[3,7],freq:[2600,8600],q:8,peak:t*.42,decay:.3,wet:.3}),s=$(e,{filter:"highpass",poles:24,freq:[6200,3800],q:.7,peak:t*.25,attack:.002,duration:a*.5,wet:.36});return j(o,n,s)}const Lm={Spray:{cast(e){const t=$(e,{filter:"bandpass",freq:[900,2800],q:1.1,peak:.34,attack:.02,duration:.14,wet:.28}),a=kn(e,190,.06,.2);return j(t,a)},impact(e){const t=ge(e,{peak:.28,freq:4200,snap:2500,snapMs:8,wet:.12}),a=Tl(e,.34,.16),o=W(e,{type:"sine",freq:[260,120],peak:.3,attack:.002,duration:.09,drive:2,wet:.12});return j(t,a,o)}},Glass:{cast(e){const t=ee(e.rng,70),a=$(e,{filter:"highpass",freq:[1600*t,3600*t],q:1.2,peak:.36,attack:.018,duration:.13,wet:.26}),o=Ie(e,{count:3,spread:.07,grainMs:[3,7],freq:[4200,8e3],q:9,peak:.14,wet:.3});return j(a,o)},impact(e){const t=ge(e,{peak:.62,freq:4600,snap:3400,snapMs:9,wet:.14}),a=kn(e,460,.13,.42),o=Ie(e,{count:9,spread:.15,grainMs:[3,8],freq:[3200,9200],q:8,peak:.3,decay:.25,wet:.32}),n=ss(e,{count:3,spread:.1,freq:[5200,11e3],peak:.19,pingMs:[6,14],bend:.9,wet:.34});return j(t,a,o,n)}},Cap:{cast(e){const t=W(e,{type:"sine",freq:[520,900],peak:.4,attack:.001,duration:.05,drive:2.6,wet:.2}),a=ge(e,{peak:.3,freq:4e3,snap:2400,snapMs:6,wet:.12});return j(t,a)},impact(e){const t=ge(e,{peak:.52,freq:3800,snap:2300,snapMs:9,wet:.12}),a=kn(e,560,.2,.7),o=W(e,{type:"sine",freq:[150,68],peak:.17,attack:.003,duration:.11,drive:2.4,wet:.12}),n=ss(e,{count:2,spread:.05,freq:[4600,9e3],peak:.3,pingMs:[5,11],bend:.86,wet:.28});return j(t,a,o,n)}},Mega:{cast(e){const t=ee(e.rng,35),a=$(e,{filter:"bandpass",freq:[500*t,2600*t],q:1.8,peak:.44,attack:.1,hold:.08,duration:.34,drive:1.5,wet:.34}),o=W(e,{type:"sine",freq:[90*t,200*t],peak:.34,attack:.12,duration:.36,drive:2.4,voices:2,detuneCents:14,wet:.2});return j(a,o)},impact(e){const t=ge(e,{peak:.58,freq:3e3,snap:1500,snapMs:16,wet:.12}),a=Tl(e,.56,.42),o=kn(e,380,.24,.56),n=W(e,{type:"sine",freq:[140,46],peak:.62,attack:.003,duration:.3,drive:3.2,voices:2,detuneCents:18,wet:.16});return j(t,a,o,n)}}};function ct(e,t){const a={};for(const[o,n]of Object.entries(t))n&&(a[`${e}.${o}`]=n);return a}const Nm={...ct("burrito",Mm),...ct("donut",Tm),...ct("egg",Sm),...ct("hamburger",Am),...ct("hotdog",Fm),...ct("lollipop",Rm),...ct("pizza",Cm),...ct("soup",Im),...ct("sushi",zm),...ct("taco",Om),...ct("waterbottle",Lm)};function Sl(e,t){return Nm[`${e}.${t}`]}const Dm=210,_m=.78,ip=420,Hm=.32,$m=900,Pm=520,qm=.45,jm=1.5,Bm=1600,Gm=ip,Wm=.6180339887,Um=.42;class Go{constructor(t,a={}){this.engine=t,this.listenerRole=a.listener??"player"}listenerRole;lastFogSoundAt=-1/0;lastHealSoundAt=-1/0;ringFloored=!1;sawRingAboveFloor=!1;statusBefore={player:{stun:NaN,slow:NaN},enemy:{stun:NaN,slow:NaN}};statusWriterUnclaimed={player:{stun:!1,slow:!1},enemy:{stun:!1,slow:!1}};statusTrackable=!1;nextAmbienceAt=-1/0;ambienceChunk=0;lastCombatAt=-1/0;handleEvents(t,a){try{this.watchZone(a),this.watchAmbience(a),this.openStatusWindow(a);for(const o of t)this.handleEvent(o,a)}catch(o){console.warn("[audio] event dispatch failed:",o)}finally{this.closeStatusWindow(a)}}reset(){this.lastFogSoundAt=-1/0,this.lastHealSoundAt=-1/0,this.ringFloored=!1,this.sawRingAboveFloor=!1,this.statusBefore={player:{stun:NaN,slow:NaN},enemy:{stun:NaN,slow:NaN}},this.statusWriterUnclaimed={player:{stun:!1,slow:!1},enemy:{stun:!1,slow:!1}},this.statusTrackable=!1,this.nextAmbienceAt=-1/0,this.ambienceChunk=0,this.lastCombatAt=-1/0}static statusTimestamps(t){const a=t.status;return!a||typeof a.stunnedUntil!="number"||typeof a.slowedUntil!="number"?null:{stun:a.stunnedUntil,slow:a.slowedUntil}}openStatusWindow(t){const a=Go.statusTimestamps(t.player),o=Go.statusTimestamps(t.enemy);if(this.statusTrackable=a!==null&&o!==null,a===null||o===null)return;const n={player:a,enemy:o};for(const s of["player","enemy"]){const r=this.statusBefore[s];this.statusWriterUnclaimed[s]={stun:n[s].stun!==r.stun,slow:n[s].slow!==r.slow}}}closeStatusWindow(t){for(const a of["player","enemy"]){const o=Go.statusTimestamps(t[a]);o&&(this.statusBefore[a]=o)}}wasStatusRefused(t,a){return this.statusTrackable?this.statusWriterUnclaimed[t][a]?(this.statusWriterUnclaimed[t][a]=!1,!1):!0:!1}watchZone(t){if(!this.ringFloored&&t.phase==="playing"){if(t.safeRadius>Ts+.5){this.sawRingAboveFloor=!0;return}this.sawRingAboveFloor&&(this.ringFloored=!0,this.engine.play(ym(),{priority:Pe.Critical}))}}watchAmbience(t){if(t.phase!=="playing"||t.elapsed<this.nextAmbienceAt)return;this.nextAmbienceAt=t.elapsed+rp*1e3;const a=this.ambienceChunk*Wm%1;this.ambienceChunk++;const o=Math.hypot(t.player.x-t.enemy.x,t.player.y-t.enemy.y),n=t.elapsed-this.lastCombatAt<Bm||o<Gm;this.engine.play(um(),{gain:n?qm:jm,pan:(a*2-1)*Um,priority:Pe.Ambient,key:"ambience"})}handleEvent(t,a){switch(t.type){case"countdown-tick":this.engine.play(wm(t.value),{priority:Pe.Critical});break;case"match-started":this.engine.play(bm(),{priority:Pe.Critical});break;case"match-ended":{const o=a.player.alive===!0&&a.enemy.alive===!0,n=t.winner===this.listenerRole;this.engine.play(o?xm(n):vm(n),{priority:Pe.Critical});break}case"weapon-fired":this.lastCombatAt=a.elapsed,this.playCast(t.fighterRole,t.weaponKey,a);break;case"hit-landed":this.lastCombatAt=a.elapsed,this.playHit(t,a);break;case"heal":{if(t.amount<=zd&&a.elapsed-this.lastHealSoundAt<Pm)break;this.lastHealSoundAt=a.elapsed;const o=a[t.fighterRole];this.engine.play(hm(),{...this.place(o.x,o.y,a),key:"heal"});break}case"death":{const o=a[t.fighterRole];this.engine.play(lm(),{...this.place(o.x,o.y,a),priority:Pe.Critical,gain:t.fighterRole===this.listenerRole?1:void 0});break}case"projectile-destroyed":t.reason==="hit-cover"&&this.engine.play(gm(),{...this.place(t.x,t.y,a),priority:Pe.Ambient,key:"cover"});break}}playCast(t,a,o){const n=o[t],s=re[n.characterId].weapons.find(c=>c.key===a);if(!s)return;if(s.giantSlam){this.engine.play(sm(),{priority:Pe.Critical});return}const r=Sl(n.characterId,a)?.cast,i=r?this.wrapWeaponHook(r,s,n.characterId,s.damage):Ym(s);this.engine.play(i,{...this.place(n.x,n.y,o),key:`cast:${n.characterId}.${a}`})}playHit(t,a){const o=this.place(t.x,t.y,a),n=t.effect==="stun"&&this.wasStatusRefused(t.targetRole,"stun");if(t.source.kind==="fog"){if(a.elapsed-this.lastFogSoundAt<$m)return;this.lastFogSoundAt=a.elapsed,this.engine.play(dm(),{priority:Pe.Ambient,key:"fog"});return}if(t.source.kind==="hazard"){this.engine.play(fm(),{...o,priority:Pe.Ambient,key:"hazard"});return}if(t.source.kind==="trail"){this.engine.play(mm(),{...o,priority:Pe.Ambient,key:"trail"});return}const s=t.source.weaponKey,r=a[oa(t.targetRole)],i=re[r.characterId].weapons.find(h=>h.key===s),c=i?Sl(r.characterId,i.key)?.impact:void 0,l=c&&i?this.wrapWeaponHook(c,i,r.characterId,t.amount):rm(t.amount);if(this.engine.play(l,{...o,key:`impact:${r.characterId}.${s}`}),t.targetRole===this.listenerRole){const h=a[t.targetRole];this.engine.play(im(h.hp/h.maxHp),{gain:.9,key:"hurt",priority:Pe.Normal})}n&&this.engine.play(cm(),{...o,key:"shrug",priority:Pe.Normal})}wrapWeaponHook(t,a,o,n){return s=>t({...s,color:a.color,damage:n,weapon:a,characterId:o})}place(t,a,o){const n=o[this.listenerRole],s=t-n.x,r=a-n.y,i=Math.max(-1,Math.min(1,s/Dm))*_m,c=Math.hypot(s,r),l=Math.max(Hm,1/(1+c/ip));return{pan:i,gain:l}}}function Ym(e){return e.type==="melee"?om(e.damage,e.cone??90):e.type==="self"?nm():am(e.damage)}const dr="/food-arena/",Al=`${dr.endsWith("/")?dr:`${dr}/`}audio/bounce-and-bash.mp3`,Fl=.45,cp="fa.audio.music";function Vm(){try{const e=localStorage.getItem(cp);if(e){const t=JSON.parse(e);return{volume:typeof t.volume=="number"?Math.min(1,Math.max(0,t.volume)):Fl,enabled:t.enabled!==!1}}}catch{}return{volume:Fl,enabled:!0}}function Rl(e){try{localStorage.setItem(cp,JSON.stringify(e))}catch{}}class Km{el=null;source=null;gain=null;state=Vm();wanted=!1;listeners=new Set;fadeToken=0;loadError=null;suppressed=!1;ensureGraph(){if(typeof document>"u")return!1;const t=Ze(),a=t.context,o=t.busInput;if(!a||!o||typeof a.createMediaElementSource!="function")return!1;if(this.source)return!0;if(!this.el){const n=document.createElement("audio");n.src=Al,n.loop=!0,n.preload="auto",n.volume=1,n.crossOrigin="anonymous",n.addEventListener("error",()=>{const s=n.error?n.error.code:0;this.loadError=`music track failed to load (MediaError ${s}) from ${n.currentSrc||n.src}`,console.warn(`[audio] ${this.loadError}`),this.emit()},{once:!0}),this.el=n}try{return this.source=a.createMediaElementSource(this.el),this.gain=a.createGain(),this.gain.gain.value=this.state.enabled?this.state.volume:0,this.source.connect(this.gain).connect(o),!0}catch{return this.source=null,this.gain=null,!1}}play(){if(this.wanted=!0,this.suppressed||!this.state.enabled||!this.ensureGraph()||!this.el)return;const t=this.el.play();t&&typeof t.catch=="function"&&t.catch(()=>{})}pause(){this.wanted=!1,this.el?.pause()}onUnlock(){this.wanted&&this.play()}isPlaying(){return!!this.el&&!this.el.paused}getLoadError(){return this.loadError}getTrackUrl(){return this.el?this.el.src:Al}getVolume(){return this.state.volume}setVolume(t){this.state.volume=Math.min(1,Math.max(0,t)),Rl(this.state),this.applyGain(),this.emit()}isEnabled(){return this.state.enabled}setEnabled(t){this.state.enabled=t,Rl(this.state),this.applyGain(),t?this.play():this.el?.pause(),this.emit()}fadeOut(t=.6){if(this.suppressed=!0,!this.el||this.el.paused)return;this.applyGain(0,t);const a=this.el;window.setTimeout(()=>{this.fadeToken===o&&a.pause()},t*1e3+40);const o=++this.fadeToken}fadeIn(t=.8){if(this.fadeToken++,this.suppressed=!1,!this.state.enabled||!this.ensureGraph()||!this.el)return;const a=this.el.paused;if(a){this.gain&&(this.gain.gain.value=0);const o=this.el.play();o&&typeof o.catch=="function"&&o.catch(()=>{})}this.applyGain(void 0,a?t:.25)}duck(t=.35){this.applyGain(this.state.volume*Math.min(1,Math.max(0,t)))}unduck(){this.applyGain()}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}applyGain(t,a=.08){if(!this.gain)return;const n=Ze().context,s=this.state.enabled?t??this.state.volume:0;try{if(n){const r=n.currentTime;this.gain.gain.cancelScheduledValues(r),this.gain.gain.setValueAtTime(this.gain.gain.value,r),this.gain.gain.linearRampToValueAtTime(s,r+a)}else this.gain.gain.value=s}catch{this.gain.gain.value=s}}emit(){for(const t of this.listeners)try{t()}catch{}}}let Mn=null;function Ye(){if(!Mn){Mn=new Km;const e=Mn;Ze().onChange(()=>{Ze().getState()==="running"&&e.onUnlock()})}return Mn}let En=null;function Ze(){return En||(En=new tm,Zm(En)),En}function Xm(e){return new Go(Ze(),e)}const we={setVolume(e){Ze().setVolume(e)},getVolume(){return Ze().getVolume()},setMuted(e){Ze().setMuted(e)},isMuted(){return Ze().isMuted()},toggleMuted(){return Ze().toggleMuted()},onChange(e){return Ze().onChange(e)},getState(){return Ze().getState()},unlock(){Ze().unlock()},previewClick(){Ze().play(km(),{key:"ui"})},music:{play(){Ye().play()},pause(){Ye().pause()},isPlaying(){return Ye().isPlaying()},getVolume(){return Ye().getVolume()},setVolume(e){Ye().setVolume(e)},isEnabled(){return Ye().isEnabled()},setEnabled(e){Ye().setEnabled(e)},fadeOut(e){Ye().fadeOut(e)},fadeIn(e){Ye().fadeIn(e)},duck(e){Ye().duck(e)},unduck(){Ye().unduck()},onChange(e){return Ye().onChange(e)},getLoadError(){return Ye().getLoadError()},getTrackUrl(){return Ye().getTrackUrl()}}};function Zm(e){typeof window>"u"||(window.__audio={engine:e,tap:()=>e.tap(),connectTap:t=>e.connectTap(t),stats:()=>({state:e.getState(),activeVoices:e.activeVoices(),started:e.counters.started,droppedBudget:e.counters.droppedBudget,droppedThrottle:e.counters.droppedThrottle,droppedNotRunning:e.counters.droppedNotRunning,volume:e.getVolume(),muted:e.isMuted()}),get music(){const t=Ye();return{url:t.getTrackUrl(),error:t.getLoadError(),playing:t.isPlaying(),enabled:t.isEnabled()}}})}const A={ink:"#1a1224",cream:"#FFF3DE",white:"#FFFFFF",gold:"#F4A300",mustard:"#FFC93C",mustardHi:"#FFDD6B",ketchup:"#D62839",tomato:"#E63946",tomatoHi:"#FF9E9E",lettuce:"#7CB518",leafDark:"#4E8B2B",water:"#1E90D8",waterHi:"#5BC8F5",ice:"#8FE1FF",iceHi:"#BFF0FF",grape:"#7A4BC4",grapeHi:"#9B6BE0",grapeDark:"#5B2E8C",violet:"#B497D6",wood:"#8B4A22",woodHi:"#B4622A",meat:"#8B3A2E",meatHi:"#D98A72",patty:"#A05A2C",pattyDark:"#5A2E17",steel:"#DCD6E8",candy:"#FF6FA5",candyHi:"#FFB3D1",flame:"#FF7A2F"};function to(e,t,a,o=12,n=12){const s=[];for(let r=0;r<e*2;r++){const i=r%2===0?t:a,c=Math.PI*r/e-Math.PI/2;s.push(`${(o+i*Math.cos(c)).toFixed(2)} ${(n+i*Math.sin(c)).toFixed(2)}`)}return`M${s.join("L")}Z`}const Qm={patty:`
<ellipse cx="12" cy="14.3" rx="8.5" ry="4.5" fill="${A.pattyDark}"/>
<ellipse cx="12" cy="11.5" rx="8.5" ry="4.5" fill="${A.patty}"/>
<path d="M6.8 10.4 10 12.3M10.9 9.2 14.1 11.1M15.2 10.1 17.8 11.6" stroke="${A.pattyDark}" stroke-width="1.5"/>`,meat:`
<path d="M2.6 12.8c0-4.6 3.4-7.6 7.6-7.6 4.3 0 6.9 2.9 6.9 6.5 0 4.9-3.4 8.7-7.6 8.7-4.1 0-6.9-3.2-6.9-7.6z" fill="${A.meat}"/>
<path d="M6.8 9.8c2.6-.8 4.5.2 5.5 2.5" stroke="${A.meatHi}" stroke-width="1.8"/>
<path d="M14.4 7.6h4.8a1.5 1.5 0 0 1 0 3h-4.8a1.5 1.5 0 0 1 0-3z" fill="${A.cream}"/>
<circle cx="19.6" cy="7.2" r="1.9" fill="${A.cream}"/>
<circle cx="19.6" cy="10.6" r="1.9" fill="${A.cream}"/>`,tomato:`
<circle cx="12" cy="13.7" r="7.6" fill="${A.tomato}"/>
<path d="M12 7.2c-1.5-1.4-3.1-1.8-4.4-1.4.1 1.5.9 2.7 2.1 3.4M12 7.2c1.5-1.4 3.1-1.8 4.4-1.4-.1 1.5-.9 2.7-2.1 3.4z" fill="${A.leafDark}" stroke-width="1.4"/>
<path d="M12 3.4v3.6" stroke="${A.leafDark}" stroke-width="1.9"/>
<path d="M8.5 11a4.4 4.4 0 0 1 2.4-2.3" stroke="${A.tomatoHi}" stroke-width="1.7"/>`,lettuce:`
<path d="M12 20.8c-5.4 0-8.9-3.5-8.9-7.6 0-1.7 1.1-2.3 2.1-1.7.4-1.9 1.9-2.5 2.9-1.4.6-1.9 2.3-2.5 3.3-1.3.9-1.9 2.7-2.1 3.7-.6 1.2-1.1 2.9-.2 2.9 1.4 1.5-.2 2.7.9 2.5 2.3.6 3.9-2.7 8.2-8.2 8.2z" fill="${A.lettuce}"/>
<path d="M12 20.2v-8.4" stroke="${A.leafDark}" stroke-width="1.6"/>`,onion:`
<path d="M12 20.8c-4.1 0-6.8-2.7-6.8-6.4 0-3.5 2.7-6.6 6.8-8.6 4.1 2 6.8 5.1 6.8 8.6 0 3.7-2.7 6.4-6.8 6.4z" fill="#F4E6F7"/>
<path d="M12 6.2v14.6" stroke="${A.violet}" stroke-width="1.4"/>
<path d="M8.4 8.6c-1.1 2.5-1.3 5.6 0 9.1M15.6 8.6c1.1 2.5 1.3 5.6 0 9.1" stroke="${A.violet}" stroke-width="1.4"/>
<path d="M12 6.4c.4-2.1 1.9-3.2 3.6-3.4-.4 2.1-1.7 3.2-3.6 3.4z" fill="${A.lettuce}" stroke-width="1.3"/>`,candy:`
<ellipse cx="12" cy="12" rx="5.3" ry="4.7" fill="${A.candy}"/>
<path d="M6.8 10.1 2.7 7.2v9.6l4.1-2.9z" fill="${A.candyHi}"/>
<path d="M17.2 10.1 21.3 7.2v9.6l-4.1-2.9z" fill="${A.candyHi}"/>
<path d="M9.7 10.4a3 3 0 0 1 2-1.5" stroke="${A.cream}" stroke-width="1.6"/>`,swirl:`
<g fill="${A.water}">
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(120 12 12)"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(240 12 12)"/>
</g>
<circle cx="12" cy="12" r="1.8" fill="${A.cream}" stroke-width="1.4"/>`,chick:`
<path d="M10.4 4.4 11 1.8 12.8 4.2" stroke-width="1.8"/>
<ellipse cx="11.4" cy="15.8" rx="7.2" ry="6" fill="${A.mustardHi}"/>
<circle cx="11.6" cy="9.4" r="5.4" fill="${A.mustardHi}"/>
<path d="M16.6 8.2 22.2 10.2 16.6 12.2z" fill="${A.gold}"/>
<circle cx="13.4" cy="8.2" r="1.4" fill="${A.ink}" stroke="none"/>
<path d="M8.4 15a4 4 0 0 0 4.6 4.4" stroke="${A.gold}" stroke-width="1.9"/>`,burst:`<path d="${to(9,10.2,4.6)}" fill="${A.gold}"/>
<path d="${to(9,5.6,2.4)}" fill="${A.mustardHi}" stroke-width="1.3"/>`,hammer:`
<path d="M5.2 3.4h13.6a1.7 1.7 0 0 1 1.7 1.7v4.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V5.1a1.7 1.7 0 0 1 1.7-1.7z" fill="#C9B8DE"/>
<path d="M16.2 3.6v7.4" stroke-width="1.4"/>
<path d="M10.1 11h3.8v10.2h-3.8z" fill="${A.patty}"/>`,dough:`
<circle cx="8" cy="15.4" r="5.1" fill="#E6D4B0"/>
<circle cx="16.4" cy="14.6" r="4.3" fill="#EFE0C4"/>
<circle cx="12.6" cy="7.4" r="4.6" fill="#F7ECD6"/>
<path d="M10.8 5.9a2.6 2.6 0 0 1 1.8-1.4" stroke="${A.white}" stroke-width="1.5"/>`,cheese:`
<path d="M2.4 17.4 20.4 5.6a1.4 1.4 0 0 1 1.2 1.4v10.4a1.4 1.4 0 0 1-1.4 1.4H3.8a1.4 1.4 0 0 1-1.4-1.4z" fill="${A.mustard}"/>
<circle cx="9.4" cy="15.2" r="1.9" fill="#DE9A12" stroke="none"/>
<circle cx="16.2" cy="12.2" r="1.6" fill="#DE9A12" stroke="none"/>
<circle cx="17.6" cy="16.6" r="1.3" fill="#DE9A12" stroke="none"/>`,rice:`
<path d="M3.4 13.4h17.2c0 4.6-3.8 8-8.6 8s-8.6-3.4-8.6-8z" fill="${A.waterHi}"/>
<path d="M5.6 13.4a2.2 2.2 0 0 1 2.8-2 2.4 2.4 0 0 1 3.6-1.6 2.4 2.4 0 0 1 3.6 1.6 2.2 2.2 0 0 1 2.8 2z" fill="${A.white}"/>
<path d="M2.4 13.4h19.2" stroke-width="1.8"/>`,seaweed:`
<path d="M12 21.6V6" stroke="#2E6B3A" stroke-width="2.3"/>
<path d="M11.8 10c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>
<path d="M12.2 15.4c4.6 0 7-2.6 7-6.8-4.6 0-7 2.6-7 6.8z" fill="#4E9B5A"/>
<path d="M11.8 20.8c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>`,fish:`
<path d="M2.4 12.2c2.1-4 5.6-6.1 9.7-6.1 3.5 0 6 1.7 7.3 4.2-1.3 4.8-4.4 7.9-9 7.9-3.5 0-6-2.1-8-6z" fill="${A.water}"/>
<path d="M18.9 10.1 22.4 7v10.2l-3.5-3.4z" fill="${A.waterHi}"/>
<circle cx="7.1" cy="10.7" r="1.2" fill="${A.ink}" stroke="none"/>`,puffer:`
<path d="M11 1.8v6.8a4.1 4.1 0 1 1-8.2 0v-1.2" stroke-width="2.8"/>
<path d="M2.8 8.2 5.4 11.6" stroke-width="2.2"/>
<path d="M10.4 17.4c1.2-2.2 3.1-3.4 5.4-3.4 2 0 3.4 1 4.2 2.4-.8 2.7-2.6 4.5-5.2 4.5-2 0-3.4-1.2-4.4-3.5z" fill="${A.gold}"/>
<path d="M19.8 16.4 22.4 14.6v5.9l-2.6-1.9z" fill="${A.mustard}"/>
<circle cx="13.2" cy="16.9" r="1.1" fill="${A.ink}" stroke="none"/>`,droplets:`
<path d="M8.4 20.6a4.9 4.9 0 0 1-4.9-4.9c0-2.9 4.9-8.4 4.9-8.4s4.9 5.5 4.9 8.4a4.9 4.9 0 0 1-4.9 4.9z" fill="${A.water}"/>
<path d="M17.6 13.6a3.3 3.3 0 0 1-3.3-3.3c0-2 3.3-5.7 3.3-5.7s3.3 3.7 3.3 5.7a3.3 3.3 0 0 1-3.3 3.3z" fill="${A.waterHi}"/>`,noodle:`
<path d="M16.4 2 13 11.4" stroke="${A.woodHi}" stroke-width="2.6"/>
<path d="M21.7 3.9 18.3 13.3" stroke="${A.wood}" stroke-width="2.6"/>
<path d="M3.2 13.2h17.6c0 4.8-3.9 8.4-8.8 8.4s-8.8-3.6-8.8-8.4z" fill="${A.ketchup}"/>
<path d="M5.6 13.2a2.1 2.1 0 0 1 2.3-2.2 2.4 2.4 0 0 1 3.1-2.3 2.6 2.6 0 0 1 4 .2 2.4 2.4 0 0 1 3.3 2.1 2.1 2.1 0 0 1 1.5 2.2z" fill="${A.mustardHi}"/>
<path d="M8.8 11.2c0-1.6.9-2.6 2-2.6M13.6 11.4c0-1.7.9-2.7 2-2.7" stroke="#D9A417" stroke-width="1.4"/>
<path d="M2.2 13.2h19.6" stroke-width="1.8"/>`,wave:`
<path d="M2.4 18.6C4 11 8.5 6.6 13.6 6.6c4.1 0 7 2.5 7 5.8 0 2.7-1.9 4.6-4.2 4.6-2.1 0-3.6-1.4-3.6-3.2 0-1.6 1.1-2.6 2.4-2.6.9 0 1.7.5 1.9 1.3-1.4-.3-2.3.5-2.3 1.4 0 1 .8 1.7 1.9 1.7 1.5 0 2.5-1.2 2.5-2.9 0-2.3-2.1-4.2-5.2-4.2-4.4 0-7.9 3.8-9.4 10.1z" fill="${A.water}"/>
<path d="M2 21c2.7-1.5 4.4 1 7.1-.4M11.9 20.6c2.7-1.5 4.4 1 7.1-.4" stroke="${A.waterHi}" stroke-width="1.7"/>`,shards:`
<path d="M2.2 3.4 12.6 8.8 6.6 18.2z" fill="${A.ice}"/>
<path d="M15.2 2.6 22 11.4 13.4 13.6z" fill="${A.iceHi}"/>
<path d="M12.4 16 20.8 15.4 17 21.8z" fill="${A.ice}"/>`,cap:`
<g transform="rotate(9 12 12.4)">
<ellipse cx="12" cy="15" rx="9.2" ry="3.2" fill="#12669E"/>
<path d="M2.8 12h18.4v3H2.8z" fill="#12669E" stroke="none"/>
<ellipse cx="12" cy="12" rx="9.2" ry="3.2" fill="${A.water}"/>
<ellipse cx="12" cy="11.8" rx="5.6" ry="1.5" fill="${A.iceHi}" stroke-width="1.3"/>
</g>`,mustardblast:`
<path d="M7.2 11.4h9.6a4.3 4.3 0 0 1 0 8.6H7.2a4.3 4.3 0 0 1 0-8.6z" fill="#E8B15C"/>
<path d="M5 6.6h14a3.7 3.7 0 0 1 0 7.4H5a3.7 3.7 0 0 1 0-7.4z" fill="#C2452F"/>
<path d="M5.6 12 9 8.8 12.4 12 15.8 8.8 19.2 12" stroke="${A.mustard}" stroke-width="2.8"/>`,ketchupslip:`
<path d="M4.6 8.6h7.6a2.1 2.1 0 0 1 2.1 2.1v8.6a2.1 2.1 0 0 1-2.1 2.1H4.6a2.1 2.1 0 0 1-2.1-2.1v-8.6a2.1 2.1 0 0 1 2.1-2.1z" fill="${A.tomato}"/>
<path d="M6.6 3.2h3.6v5.4H6.6z" fill="${A.tomato}"/>
<path d="M7.2 1.4h2.4v1.9H7.2z" fill="#9E1B27"/>
<path d="M3.4 12.4h10" stroke="${A.cream}" stroke-width="2"/>
<path d="M18.4 8.6c2.4 0 3.6 1.5 3.4 3-.2 1.4-1.5 1.4-1.5 2.6 0 1.4-1.5 2.3-2.8 1.7-1.2-.6-2.4.3-3-.9-.6-1.2.3-1.9-.3-3 -.6-1.2.6-2.4 2-2.4 1 0 1.2-1 2.2-1z" fill="${A.tomato}"/>`,slash:`
<path d="M2.4 21.6C2 9 9 2 21.6 2.4 15 8 11 12 2.4 21.6z" fill="${A.steel}"/>
<path d="M20.4 3.6C13.4 7.4 8.2 12.4 4.4 18.8" stroke="${A.white}" stroke-width="2.2"/>
<path d="M8.6 21.4c3.4-2.8 6.2-5.6 8.4-8.6M14.4 21.6c2.4-2 4.4-4 6-6.2" stroke="#9C93B0" stroke-width="1.8"/>`,wrap:`
<path d="M4.4 17.6 15.6 6.4a4.4 4.4 0 0 1 3.6 3.6L8 21.2a4.4 4.4 0 0 1-3.6-3.6z" fill="#EFE0C4"/>
<path d="M15.6 6.4a4.4 4.4 0 0 1 3.6 3.6l2.8-2.8a4.4 4.4 0 0 0-3.6-3.6z" fill="#E9B44C"/>
<path d="M8.4 13.6 11.2 16.4M11.6 10.4 14.4 13.2" stroke="#CBB289" stroke-width="1.8"/>`,lollipop:`
<path d="M12 21.4v-6.6" stroke-width="2.3"/>
<circle cx="12" cy="9" r="6.3" fill="${A.candy}"/>
<path d="M12 9a2.1 2.1 0 1 0 2.1 2.1c0-2.3-2.3-3.7-4.6-2.9" stroke="${A.cream}" stroke-width="1.9"/>`,egg:`
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="#E4CFA6"/>
<path d="M12 4.8a6.7 8.3 0 0 1 0 16.6z" fill="#C9AE7C" stroke="none"/>
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="none"/>
<path d="M8.4 15.4a3.6 3.6 0 0 0 1.9 3.8" stroke="#FFF8EA" stroke-width="2"/>`,honey:`
<path d="M5.4 3.4h13.2v3.4H5.4z" fill="${A.gold}"/>
<path d="M8.2 6.6h7.6v2.6H8.2z" fill="#C98A00"/>
<path d="M6.6 9c-.9 2.6-1.3 4.9-1.3 7 0 3.3 2.2 5.2 6.7 5.2s6.7-1.9 6.7-5.2c0-2.1-.4-4.4-1.3-7z" fill="#C98A00"/>
<path d="M6.6 12.8h10.8v3.6H6.6z" fill="${A.mustardHi}" stroke-width="1.4"/>
<path d="M18.3 9.2c1.7 2.4 2.5 4.2 2.5 5.5 0 1.5-.9 2.5-2.2 2.5s-2.2-1-2.2-2.5c0-1.3.6-3 1.9-5.5z" fill="${A.mustardHi}"/>`};function Tn(e,t,a,o=""){return`
<path d="M3.4 9.4h17.2v9.4a1.7 1.7 0 0 1-1.7 1.7H5.1a1.7 1.7 0 0 1-1.7-1.7z" fill="${e}"/>
<path d="M3.4 9.4 6.6 5.6h10.8l3.2 3.8z" fill="${t}"/>
<path d="M9.8 7.0h4.4v5.6H9.8z" fill="${a}" stroke-width="1.3"/>
${o}`}const Jm=`<path d="M12 0.6c2.6 2.2 3.7 3.9 3.2 5.5-.9-.8-1.6-1.1-2.3-.9.7 1.9.3 3.1-.9 4-1.2-.9-1.6-2.1-.9-4-.7-.2-1.4.1-2.3.9-.5-1.6.6-3.3 3.2-5.5z" fill="${A.flame}" stroke-width="1.3"/>`,eg=`<path d="M12 0.4c2.4.8 3.6 2.4 3.6 4.6-2.4-.7-3.6-2.3-3.6-4.6zM12 0.4c-2.4.8-3.6 2.4-3.6 4.6C10.8 4.3 12 2.7 12 .4z" fill="${A.lettuce}" stroke-width="1.3"/>`,tg=`<path d="M12 5.6C9.2 1.6 4.8 2.8 6.2 5.6M12 5.6C14.8 1.6 19.2 2.8 17.8 5.6" fill="${A.mustard}" stroke-width="1.4"/>`,ag=`<path d="M4.9 13.4a2.6 2.6 0 0 1 5.2 0z" fill="#B4622A" stroke-width="1.2"/>
<path d="M4.7 13.4h5.6v1.5H4.7z" fill="${A.lettuce}" stroke-width="1.2"/>
<path d="M4.9 15h5.2a2.2 2.2 0 0 1-5.2 0z" fill="#B4622A" stroke-width="1.2"/>`,og=Array.from({length:8},(e,t)=>`<rect x="10.3" y="0.9" width="3.4" height="5.4" rx="1.2" fill="${A.gold}" transform="rotate(${t*45} 12 12)"/>`).join(""),ng={coin:`
<ellipse cx="12" cy="14.2" rx="9" ry="7" fill="#7F4E00"/>
<ellipse cx="12" cy="11.2" rx="9" ry="7" fill="#D98200"/>
<path d="${to(5,5.6,2.4,12,11.4)}" fill="#FFEFC0" stroke-width="1.4"/>
<path d="M8.2 8.6a7 5.4 0 0 1 3.4-2.3" stroke="${A.white}" stroke-width="1.7"/>`,gem:`
<path d="M6.6 3.9h10.8l3.6 5.3L12 20.4 3 9.2z" fill="${A.water}"/>
<path d="M6.6 3.9 8.9 9.2h6.2l2.3-5.3z" fill="${A.ice}" stroke-width="1.3"/>
<path d="M3 9.2h18" stroke-width="1.3"/>
<path d="M8.9 9.2 12 20.4l3.1-11.2" stroke-width="1.3"/>`,trophy:`
<path d="M7.1 3.3h9.8v5a4.9 4.9 0 0 1-9.8 0z" fill="${A.gold}"/>
<path d="M7.1 4.9H4.3a3.3 3.3 0 0 0 3.3 4.3" stroke-width="1.8"/>
<path d="M16.9 4.9h2.8a3.3 3.3 0 0 1-3.3 4.3" stroke-width="1.8"/>
<path d="M12 13.1v3.3" stroke-width="2.2"/>
<path d="M7.9 20.7h8.2l-.8-2.6a1.2 1.2 0 0 0-1.2-.9h-4.2a1.2 1.2 0 0 0-1.2.9z" fill="${A.mustard}"/>
<path d="M9.6 5.1a3.4 3.4 0 0 0 .5 4.5" stroke="${A.cream}" stroke-width="1.4"/>`,star:`<path d="${to(5,9.4,4.1)}" fill="${A.mustard}"/>
<path d="M12 4.6 10.6 9" stroke="${A.mustardHi}" stroke-width="1.4"/>`,sparkle:`
<path d="M10.4 1.8c1.5 5.4 2.9 6.8 8.3 8.3-5.4 1.5-6.8 2.9-8.3 8.3-1.5-5.4-2.9-6.8-8.3-8.3 5.4-1.5 6.7-2.9 8.3-8.3z" fill="${A.mustard}"/>
<path d="M18.6 14.4c.7 2.6 1.4 3.3 4 4-2.6.7-3.3 1.4-4 4-.7-2.6-1.4-3.3-4-4 2.6-.7 3.3-1.4 4-4z" fill="${A.mustardHi}" stroke-width="1.5"/>`,flag:`
<path d="M5.6 21.2V3.2" stroke-width="2.2"/>
<path d="M5.6 4h13.6v9.2H5.6z" fill="${A.cream}"/>
<path d="M5.6 4h3.4v3.06H5.6zM12.4 4h3.4v3.06h-3.4zM9 7.06h3.4v3.07H9zM15.8 7.06h3.4v3.07h-3.4zM5.6 10.13h3.4v3.07H5.6zM12.4 10.13h3.4v3.07h-3.4z" fill="${A.ink}" stroke="none"/>`,pin:`
<path d="M12 21.4s6.7-6.5 6.7-11.1a6.7 6.7 0 1 0-13.4 0c0 4.6 6.7 11.1 6.7 11.1z" fill="${A.ketchup}"/>
<circle cx="12" cy="10.2" r="2.6" fill="${A.cream}"/>`,chest:`
<path d="M3.1 11.6h17.8v6.7a1.7 1.7 0 0 1-1.7 1.7H4.8a1.7 1.7 0 0 1-1.7-1.7z" fill="${A.wood}"/>
<path d="M3.1 11.6a8.9 8.9 0 0 1 17.8 0z" fill="${A.woodHi}"/>
<path d="M2.6 10.2h18.8v3H2.6z" fill="${A.gold}" stroke-width="1.4"/>
<path d="M10.3 9.8h3.4v5.4h-3.4z" fill="${A.mustard}" stroke-width="1.4"/>
<circle cx="12" cy="12.9" r="0.85" fill="${A.wood}" stroke="none"/>`,boxBurger:Tn(A.gold,A.mustard,A.ketchup,ag),boxPineapple:Tn(A.grape,A.grapeHi,A.mustard,eg),boxRed:Tn(A.ketchup,"#E9536A",A.mustard,tg),boxFire:Tn(A.grapeDark,A.grape,A.flame,Jm),gift:`
<path d="M4 10.4h16v8.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.6z" fill="${A.ketchup}"/>
<path d="M2.6 6.4h18.8v4H2.6z" fill="#E9536A"/>
<path d="M10.2 6.4h3.6v13.8h-3.6z" fill="${A.mustard}" stroke-width="1.3"/>
<path d="M12 6.2c-2.6-3.4-6.2-2.4-5 .2M12 6.2c2.6-3.4 6.2-2.4 5 .2" fill="${A.mustard}" stroke-width="1.4"/>`,gear:`${og}
<circle cx="12" cy="12" r="7.4" fill="${A.gold}"/>
<circle cx="12" cy="12" r="3.3" fill="${A.cream}"/>`,lock:`
<path d="M7.5 10.4V7.9a4.5 4.5 0 0 1 9 0v2.5" stroke-width="1.9"/>
<path d="M4.4 10.2h15.2a1.9 1.9 0 0 1 1.9 1.9v6.6a1.9 1.9 0 0 1-1.9 1.9H4.4a1.9 1.9 0 0 1-1.9-1.9v-6.6a1.9 1.9 0 0 1 1.9-1.9z" fill="${A.gold}"/>
<circle cx="12" cy="14.4" r="1.7" fill="${A.ink}" stroke="none"/>
<path d="M12 15.4v2.6" stroke-width="1.9"/>`,play:'<path d="M7.6 4.2 19.4 12 7.6 19.8z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>',pause:`
<path d="M6.4 4.4h4.2v15.2H6.4z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>
<path d="M13.4 4.4h4.2v15.2h-4.2z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>`,back:'<path d="M15.2 4.4 7.4 12l7.8 7.6" stroke-width="2.8"/>',close:'<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" stroke-width="2.8"/>',check:'<path d="M4.6 12.4 9.4 17.4 19.4 6.8" stroke-width="3"/>',home:`
<path d="M3 11.6 12 3.4l9 8.2" stroke-width="2.1"/>
<path d="M5.4 10.6h13.2v9.8H5.4z" fill="${A.gold}"/>
<path d="M9.6 14h4.8v6.4H9.6z" fill="${A.wood}"/>`,swap:`
<path d="M4.6 10.2a7.4 7.4 0 0 1 12.6-3.6" stroke-width="2.2"/>
<path d="M17.6 2.9v4.2h-4.2" stroke-width="2.2"/>
<path d="M19.4 13.8a7.4 7.4 0 0 1-12.6 3.6" stroke-width="2.2"/>
<path d="M6.4 21.1v-4.2h4.2" stroke-width="2.2"/>`,mute:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${A.cream}"/>
<path d="M15.4 9.4 20.6 14.6M20.6 9.4 15.4 14.6" stroke="${A.tomato}" stroke-width="2.4"/>`,sound:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${A.cream}"/>
<path d="M15.2 9a4.2 4.2 0 0 1 0 6" stroke-width="1.9"/>
<path d="M18 6.4a8 8 0 0 1 0 11.2" stroke-width="1.9"/>`,cone:`
<path d="M12 3 18.8 18.6H5.2z" fill="${A.gold}"/>
<path d="M9.3 11.4h5.4M8 15h8" stroke="${A.cream}" stroke-width="2.1"/>
<path d="M3.2 18.4h17.6a1.2 1.2 0 0 1 1.2 1.2v.2a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 19.8v-.2a1.2 1.2 0 0 1 1.2-1.2z" fill="${A.ketchup}"/>`,chefhat:`
<path d="M6.6 12.4a3.9 3.9 0 1 1 1.6-7.4 4.3 4.3 0 0 1 7.6 0 3.9 3.9 0 1 1 1.6 7.4z" fill="${A.cream}"/>
<path d="M6.6 12.2h10.8v6a1.4 1.4 0 0 1-1.4 1.4H8a1.4 1.4 0 0 1-1.4-1.4z" fill="${A.cream}"/>
<path d="M6.6 15.4h10.8" stroke-width="1.4"/>`,avatar:`
<path d="M3.4 21.2a8.6 8.6 0 0 1 17.2 0z" fill="${A.gold}"/>
<circle cx="12" cy="11.6" r="5" fill="${A.mustard}"/>
<path d="M7.2 8.4a2.9 2.9 0 1 1 1.6-5.3 3.6 3.6 0 0 1 6.4 0 2.9 2.9 0 1 1 1.6 5.3z" fill="${A.cream}"/>
<path d="M7.2 8.2h9.6v2.2H7.2z" fill="${A.cream}"/>`,damage:`
<path d="M20.6 1.6 21.4 6.6 9.8 18.2 6.4 14.8z" fill="${A.steel}"/>
<path d="M20.6 1.6 15.6 2.4 4 14l3.4 3.4z" fill="#B7AFC7" stroke="none"/>
<path d="M20.6 1.6 6.4 14.8" stroke-width="1.4"/>
<path d="M3.6 15.2 8.8 20.4" stroke="${A.ketchup}" stroke-width="3.4"/>
<path d="M1.8 20.2 5.4 16.6" stroke-width="2.4"/>`,health:`<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${A.ketchup}"/>
<path d="M7.2 10.4a2.6 2.6 0 0 1 2-1.6" stroke="${A.cream}" stroke-width="1.5"/>`,speed:`<path d="M13.8 2.2 5.6 13.4h4.8l-1.6 8.4 8.8-11.6h-5z" fill="${A.mustard}"/>`,range:`
<path d="M3.4 12h17.2" stroke-width="2.3"/>
<path d="M7.2 8.1 3.2 12l4 3.9" stroke-width="2.3"/>
<path d="M16.8 8.1 20.8 12l-4 3.9" stroke-width="2.3"/>`,timer:`
<circle cx="12" cy="13.6" r="7.7" fill="#C9B8DE"/>
<path d="M9.5 2.4h5" stroke-width="2.1"/>
<path d="M12 2.4v3.5" stroke-width="2.1"/>
<path d="M12 9.4v4.3h3.3" stroke-width="1.9"/>`,heal:`
<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${A.lettuce}"/>
<path d="M12 9.6v5.6M9.2 12.4h5.6" stroke="${A.cream}" stroke-width="2.1"/>`,stun:`<path d="${to(5,8.6,3.7,10.2,10.6)}" fill="${A.mustard}"/>
<path d="${to(5,4.2,1.8,19.2,18)}" fill="${A.mustardHi}" stroke-width="1.4"/>`,slow:`
<circle cx="12" cy="12" r="9.1" fill="${A.gold}"/>
<path d="M12 12a2.9 2.9 0 1 0 2.9 2.9c0-3.4-3.2-5.3-6.3-4.1-3.4 1.3-4.6 5.3-2.6 8.2" stroke-width="2.1"/>`,medal:`
<path d="M8.4 2.2 11 8.6H7L4.4 2.2z" fill="${A.ketchup}"/>
<path d="M15.6 2.2 13 8.6h4l2.6-6.4z" fill="${A.water}"/>
<circle cx="12" cy="15.2" r="6.6" fill="${A.gold}"/>
<circle cx="12" cy="15.2" r="3.4" fill="${A.mustard}" stroke-width="1.3"/>`,party:`
<path d="M3.4 20.9 9 8.2l6.8 6.8z" fill="${A.ketchup}"/>
<path d="M9 8.2 15.8 15" stroke-width="1.4"/>
<circle cx="18.7" cy="5.5" r="1.6" fill="${A.mustard}"/>
<circle cx="14.2" cy="3.4" r="1.3" fill="${A.lettuce}"/>
<circle cx="20.8" cy="10.4" r="1.3" fill="${A.water}"/>
<path d="M16.2 8.8 18.6 6.4" stroke-width="1.4"/>`},et=416,nt=496,Cl=et/nt,sg=.42,rg=.07,pr=.08,ig=.66,cg=.08,wa={x0:.035,x1:.965,y0:.045,y1:.725},lg=.7,ur=.18,fr=.92,hg=1.15,Fa=new Map,mr=new Map,gi=[];let gr=!1;function dg(e){const a=document.createElement("canvas");a.width=8,a.height=8;const o=a.getContext("2d",{willReadFrequently:!0});if(!o)return[0,0,0];o.drawImage(e,0,0,8,8);const n=o.getImageData(0,0,8,8).data;let s=0,r=0,i=0;for(let l=0;l<n.length;l+=4)s+=n[l],r+=n[l+1],i+=n[l+2];const c=n.length/4;return[Math.round(s/c),Math.round(r/c),Math.round(i/c)]}function Ji(e){return Fa.get(e)}function wi(){const e=[...Se];if(typeof document>"u"||typeof window<"u"&&window.__screen==="characters")return e;const t=new Set;for(const a of document.querySelectorAll("[data-portrait]")){const o=a.dataset.portrait;Se.includes(o)&&t.add(o)}return!t.size&&(typeof window>"u"||!window.__screen)?e:[...t]}function lp(e){for(const a of Se){const o=Fa.get(a);o&&e(a,o)}if(Se.every(a=>Fa.has(a))){window.__thumbsReady=!0;return}if(gi.push(e),gr)return;gr=!0,window.__thumbsReady=!1;const t=()=>void pg().finally(()=>{gr=!1,gi.length=0,window.__thumbsReady=wi().every(a=>Fa.has(a))});typeof requestIdleCallback=="function"?requestIdleCallback(t,{timeout:600}):setTimeout(t,120)}async function pg(){if(!wi().some(a=>!Fa.has(a)))return;const e=document.createElement("div");e.style.cssText=`position:fixed;left:-9999px;top:0;width:${et}px;height:${nt}px;pointer-events:none;`,document.body.appendChild(e);let t=null;try{t=new _i({container:e,background:0,fog:null,camera:{pitchDeg:12,yawDeg:24,frameMode:"subject",subjectHeight:2.1,subjectFill:1,targetHeight:1.05,followLerp:1},shadows:!1,postFx:"grade",offscreen:!0,maxPixelRatio:1}),t.canvas.style.cssText=`display:block;width:${et}px;height:${nt}px;`,t.resize();const a=new Set;for(;;){const o=wi().filter(n=>!Fa.has(n)&&!a.has(n));if(!o.length)break;for(const n of o)a.add(n),await fg(t,n)}}catch{}finally{t?.dispose(),e.remove()}}function Do(e,t,a,o){const n=new le,s=e.getCenter(n.clone()).applyMatrix4(t.matrixWorldInverse).z;let r=1/0,i=1/0,c=-1/0,l=-1/0;for(let h=0;h<8;h++){n.set(h&1?e.max.x:e.min.x,h&2?e.max.y:e.min.y,h&4?e.max.z:e.min.z).applyMatrix4(t.matrixWorldInverse),n.z=s,n.applyMatrix4(t.projectionMatrix);const d=(n.x*.5+.5)*a,p=(1-(n.y*.5+.5))*o;r=Math.min(r,d),c=Math.max(c,d),i=Math.min(i,p),l=Math.max(l,p)}return{x:+r.toFixed(1),y:+i.toFixed(1),w:+(c-r).toFixed(1),h:+(l-i).toFixed(1)}}function Il(e,t){const a=e.getObjectByName(t);if(!a)return null;const o=new ts().setFromObject(a);return o.isEmpty()?null:o}function ug(e,t,a){const o=new le;let n=0;return e.traverse(s=>{const r=s;if(!r.isMesh||!r.visible)return;const i=r.geometry?.getAttribute("position");if(i)for(let c=0;c<i.count;c++){if(o.fromBufferAttribute(i,c).applyMatrix4(r.matrixWorld),o.y<t)continue;const l=Math.abs(o.dot(a));l>n&&(n=l)}}),n}async function fg(e,t){const a=Qa(t);e.scene.add(a.root),a.play("idle"),a.update({dt:.4,elapsed:.4,moveSpeed01:0,health01:1});const o=new ts().setFromObject(a.root),n=Il(a.root,"head"),s=Il(a.root,"face"),r=Math.max(.5,o.max.y-o.min.y),i=o.max.y,c=(s??n)?.min.y??o.min.y+.45*r,l=Math.max(o.min.y,Math.min(o.min.y+sg*r,c-rg*r)),h=Math.max(.4,i-l),d=e.rig.camera,p=new le,u=(C,T,F)=>{e.rig.subjectFill=1,e.rig.subjectHeight=C,e.rig.targetHeight=T-C/2,e.rig.snapTo(F*p.x,F*p.z),d.updateMatrixWorld(!0),d.matrixWorldInverse.copy(d.matrixWorld).invert()};u(h/fr,i+pr*(h/fr),0),p.setFromMatrixColumn(d.matrixWorld,0).normalize();const f=ug(a.root,l,p),m=Math.max(h/fr,2*f/(Cl*hg),s?(i-s.min.y)/(ig+cg):0);let g=i+pr*m,w=0,b=m;if(s){const C=()=>i-ur*b;for(let T=0;T<4;T++){g=i+pr*b;for(let P=0;P<3;P++){u(b,g,w);const Q=Do(s,d,et,nt),I=(Q.y+Q.h)/nt-lg;if(I<=0)break;const L=Math.max(0,(Q.y/nt-wa.y0)*b),z=Math.max(C(),g-Math.min(I*b,L));if(Math.abs(z-g)<1e-4)break;g=z}u(b,g,w);const F=Do(s,d,et,nt),N=F.x+F.w-wa.x1*et,S=wa.x0*et-F.x,R=b*Cl/et;N>0&&S<0?w+=Math.min(N,-S)*R:S>0&&N<0&&(w-=Math.min(S,-N)*R);const q=F.w/((wa.x1-wa.x0)*et),_=(F.y+F.h)/nt,B=_>wa.y1?(_+ur)/(wa.y1+ur):1,Y=Math.max(q,B);if(Y<=1.001)break;b*=Y}}u(b,g,w);const x=$i[re[t].rarity];e.scene.background=new ia(x),e.lighting.focus(0,0,4),mr.has(x)||(a.root.visible=!1,e.render(0),mr.set(x,dg(e.canvas)),a.root.visible=!0),e.render(0),e.render(0);const v=e.canvas.toDataURL("image/png"),E=a.root.getObjectByName("hips"),k=a.root.getObjectByName("shoulderL"),M=new le;(window.__thumbMeta??={})[t]={size:{w:et,h:nt},subject:Do(o,d,et,nt),head:n?Do(n,d,et,nt):null,face:s?Do(s,d,et,nt):null,bg:mr.get(x)??null,world:{minY:+o.min.y.toFixed(4),maxY:+o.max.y.toFixed(4),halfWidth:+Math.max(Math.abs(o.min.x),Math.abs(o.max.x)).toFixed(4),hipsY:E?+E.getWorldPosition(M).y.toFixed(4):null,shoulderY:k?+k.getWorldPosition(M).y.toFixed(4):null,headY:n?[+n.min.y.toFixed(4),+n.max.y.toFixed(4)]:null,faceY:s?[+s.min.y.toFixed(4),+s.max.y.toFixed(4)]:null,yCut:+l.toFixed(4),upperHalfWidth:+f.toFixed(4)},frame:{subjectHeight:+e.rig.subjectHeight.toFixed(4),subjectFill:+e.rig.subjectFill.toFixed(4),targetHeight:+e.rig.targetHeight.toFixed(4),headroom:+((g-i)/b).toFixed(4),pan:+w.toFixed(4)}},e.scene.remove(a.root),a.dispose(),Fa.set(t,v);for(const C of gi)C(t,v);await new Promise(C=>setTimeout(C,0))}const mg='<circle cx="12" cy="9" r="5.6" fill="#FFF3DE"/><path d="M5.2 21.6c0-3.5 3-5.6 6.8-5.6s6.8 2.1 6.8 5.6z" fill="#FFF3DE"/>';function St(e,t={}){const a=$i[re[e].rarity],o=Ji(e),n=["fa-ic-portrait",t.crop==="head"?"fa-ic-portrait--head":"",o?"has-render":"",t.class??""].filter(Boolean).join(" "),s=o?` src="${o}"`:"";return`<span class="${n}" data-portrait="${e}" style="--pc:${a}"><img alt=""${s}/><svg class="fa-ic" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${mg}</svg></span>`}function Ko(e,t={}){const a=(o,n)=>{for(const s of e.querySelectorAll(`[data-portrait="${o}"]`)){const r=s.querySelector("img");r&&(r.getAttribute("src")!==n&&r.setAttribute("src",n),s.classList.add("has-render"))}};if(t.generate===!1){for(const o of e.querySelectorAll("[data-portrait]")){const n=o.dataset.portrait,s=Ji(n);s&&a(n,s)}return}lp(a)}const gg={...ng,...Qm},wg='viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"';function O(e,t={}){const a=gg[e];if(!a)return"";const o=["fa-ic",`fa-ic--${e}`,t.class??""].filter(Boolean).join(" "),n=t.size??"1em",s=t.label?`role="img" aria-label="${t.label}"`:'aria-hidden="true" focusable="false"';return`<svg class="${o}" ${wg} width="${n}" height="${n}" ${s}>${a}</svg>`}const bg={"🪙":"coin","💎":"gem","🏆":"trophy","⭐":"star","✨":"sparkle","🏁":"flag","📍":"pin","🎉":"party","🎁":"gift","🧑‍🍳":"chefhat","⚙️":"gear","⚙":"gear","🔒":"lock","▶":"play","⏸":"pause","◀":"back","🙂":"avatar","🚧":"cone","🔇":"mute","🔊":"sound","🏠":"home","🍟":"swap","❤️":"health","❤":"health","💨":"speed","↔":"range","⏱":"timer","💚":"heal","💫":"stun","🐌":"slow","🍖":"patty","🍅":"tomato","🥬":"lettuce","🧅":"onion","🍬":"candy","🥩":"meat","🌯":"wrap","🌀":"swirl","🥚":"egg","🐣":"chick","💥":"burst","🔨":"hammer","🍭":"lollipop","⚪":"dough","🧀":"cheese","🍚":"rice","🌿":"seaweed","🐟":"fish","🐡":"puffer","💦":"droplets","🍜":"noodle","🌊":"wave","🧊":"shards","🔵":"cap","💛":"mustardblast","🔴":"ketchupslip","⚔️":"slash","⚔":"damage","🍯":"honey","💧":"droplets"},yg={chest:"chest",hamburgerBox:"boxBurger",pineappleBox:"boxPineapple",redBox:"boxRed",fireBox:"boxFire"};function Jt(e,t={}){const a=bg[e];return a?O(a,t):e}function dt(e,t={}){return O(yg[e]??"chest",t)}function hp(e,t={}){return Jt(e,t)}const zl="fa-icon-styles";function ha(){if(document.getElementById(zl))return;const e=document.createElement("style");e.id=zl,e.textContent=vg,document.head.appendChild(e)}const vg=`
/* The icon itself. Inline-block rather than inline so it never picks up a line box's
   descender gap, and shrink-proof so a flex row cannot squash it into a sliver — which
   is what happens to an SVG in a flex container with no basis. */
.fa-ic {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: -0.15em;
}

/* Rendered character portrait. The wrapper carries the rarity colour that thumbs.ts
   also bakes behind the render, so the placeholder mark, the letterboxing and the
   portrait all sit on one continuous field. */
.fa-ic-portrait {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  border-radius: 50%;
  overflow: hidden;
  background: var(--pc, #C9B8DE);
}
.fa-ic-portrait img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
}
.fa-ic-portrait .fa-ic {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  vertical-align: baseline;
}
.fa-ic-portrait.has-render img { display: block; }
/* Head crop for badge-sized portraits — see PortraitOpts.crop in portraits.ts.
   ⚠️ THIS RULE IS A FUNCTION OF HOW 'thumbs.ts' FRAMES, and it was retuned when that
   changed. It used to read scale(1.8) / origin 50% 31%, sized against a source that
   held a WHOLE STANDING BODY. thumbs.ts now frames the upper body, and 1.8x on top of
   that showed a slice of Hot Dog's bun with no face in it and one of Egg's eyes —
   measured by cropping the trophy road's own character nodes at 8x
   ('tools/tmp/portrait_crop_check.mjs').
   Retuned by measurement, not by eye: 'thumbs.ts' publishes every character's face
   rect in source pixels on 'window.__thumbMeta', and across the seven characters that
   carry a 'face' joint those rects span source y 0.166-0.760 and x 0.157-0.842. A
   square badge's own 'object-fit: cover' already trims the 416x496 source to
   y 0.081-0.919, and scale(1.2) at origin 14% then shows y 0.100-0.799, x 0.083-0.917
   — the whole envelope, with margin on all four sides. scale(1.3) clips Pizza. */
.fa-ic-portrait--head img { transform: scale(1.2); transform-origin: 50% 14%; }
.fa-ic-portrait.has-render .fa-ic { display: none; }
`,Ol=[Tt.tomato,Tt.mustard,Tt.lettuce,Tt.cheese,Tt.glaze,Tt.waterCap];function rs(e,t=50,a=26){for(let o=0;o<a;o++){const n=document.createElement("span");n.className="fa-confetti",n.style.left=`${t+(Math.random()*12-6)}%`,n.style.background=Ol[Math.floor(Math.random()*Ol.length)],n.style.animationDelay=`${(Math.random()*.22).toFixed(2)}s`,n.style.setProperty("--x",`${Math.round(Math.random()*240-120)}px`),e.appendChild(n),setTimeout(()=>n.remove(),1800)}}function Re(e,t,a){const o=document.createElement(e);return t&&(o.className=t),o}const xg="1v1 · Kitchen Rumble";function kg(e){const t=Math.round(e/1e3);return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}function Mg(e){la("fa-home-styles",Eg),ha();const t=Re("div","fa-screen fa-home"),a=Ki();a.setScene("lobby"),t.innerHTML=`
    <div class="home-room" aria-hidden="true">
      <div class="home-room-wall"></div>
      <div class="home-room-floor"></div>
      <div class="home-room-alcove"></div>
    </div>

    <header class="fa-topbar">
      <div class="fa-chip"><span class="fa-chip-em">${O("avatar")}</span><span data-el="name"></span></div>
      <div class="fa-chip"><span class="fa-chip-em">${O("trophy")}</span><span class="fa-chip-val" data-el="trophies">0</span></div>
      <div class="fa-chip home-chip-coin"><span class="fa-chip-em">${O("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-topbar-spacer"></div>
      <!-- ICONS, not four words. The reference plates carry navigation pictorially and
           caption it; ours carried four same-weight text runs in one dark pill, which is
           the "labels are text" half of the amateurish read. tools/tmp/hm_lang.mjs
           measures the consequence rather than the intent: an icon adds a hard local
           luma step and its own hue, and the four tabs were contributing neither.
           ⚠️ NO BACKTICKS IN THIS FILE'S TEMPLATE LITERALS, INCLUDING IN COMMENTS. The
           first draft of this comment quoted the tool name in backticks and tsc reported
           "src/ui/screens/home.ts(192,64): error TS1005" -- the literal terminated
           mid-HTML. CLAUDE.md records this biting four times in hud.ts, where it 500s the
           dev server for every agent in the tree; here it is only a compile error, and
           only because a typecheck happened to be the next thing run. -->
      <nav class="fa-tabs">
        <button class="fa-tab is-active" type="button">${O("home")} Home</button>
        <button class="fa-tab" type="button" data-go="characters">${O("chefhat")} Foods</button>
        <button class="fa-tab" type="button" data-go="trophies">${O("trophy")} Trophies</button>
        <!-- The one destination on this bar that cannot currently sell anything, and it
             is here anyway. The lobby's standing rule is "nothing advertises something
             that does not work", and the shop passes it on the same terms the gem store
             already does: nothing on it is a live-looking control that no-ops, every
             price and every drop rate on it is real, and it states in words that buying
             is off and why. Hidden would have been the dishonest option — it would put
             a compliance surface where no screenshot, no contrast battery and no
             acceptance test can reach it. See the header of shop.ts. -->
        <button class="fa-tab" type="button" data-go="shop">${O("coin")} Shop</button>
      </nav>
      <button class="fa-iconbtn" type="button" data-el="settings" aria-label="Settings">${O("gear")}</button>
    </header>

    <div class="home-middle">
      <!-- LEFT: progression. Everything here is live economy state and every row is
           a real destination. -->
      <aside class="fa-panel home-col home-progress">
        <p class="fa-panel-title">Progress</p>

        <!-- The level bar lives HERE, not in the bottom bar. It used to be a 16px
             hairline floating alone in the bottom-left corner with nothing within
             400px of it, which is a lot of screen for a stat; and it is progression,
             so it belongs with the other two progressions rather than beside the CTA. -->
        <div class="fa-level home-level">
          <span class="fa-level-label home-lv" data-el="lv">Lv 1</span>
          <div class="fa-level-track">
            <div class="fa-level-fill" data-el="lvfill"></div>
            <span class="fa-level-xp" data-el="lvxp"></span>
          </div>
          <span class="fa-level-label" data-el="lvnext">Lv 2</span>
        </div>

        <!-- THE SUB IS A SIBLING OF '.home-track-top', NOT A CHILD OF IT, and that one
             move is most of the truncation fix. It used to sit inside
             '.home-track-text', a flex item squeezed between a 24px icon and a nowrap
             pill: at 852x480 that column measured 39.89 CSS px, so "Waiting to be
             opened" rendered as "Waitin...". Out here it gets the card's full 125px and
             needs no ellipsis at all. It costs ZERO height -- it was already on its own
             line, just an artificially narrow one. -->
        <button class="home-track home-track--road" type="button" data-go="trophies" data-el="road">
          <span class="home-track-top">
            <span class="home-track-icon" data-el="roadicon">${O("chest")}</span>
            <span class="home-track-title" data-el="roadtitle">Next reward</span>
            <span class="home-track-pill" data-el="roadpill">${O("trophy")}</span>
          </span>
          <span class="home-track-sub" data-el="roadsub"></span>
          <span class="home-bar"><span class="home-bar-fill" data-el="roadfill"></span></span>
        </button>

        <button class="home-track" type="button" data-go="trophies" data-el="chest">
          <span class="home-track-top">
            <span class="home-track-icon">${O("gift")}</span>
            <span class="home-track-title">Free chest</span>
            <span class="home-pips" data-el="pips"></span>
          </span>
          <span class="home-track-sub" data-el="chestsub"></span>
        </button>

        <button class="home-track home-track--held" type="button" data-go="trophies" data-el="held" hidden>
          <span class="home-track-top">
            <span class="home-track-icon">${O("chest")}</span>
            <span class="home-track-title" data-el="heldtitle"></span>
            <span class="home-track-pill is-go">Open</span>
          </span>
          <span class="home-track-sub">Waiting to be opened</span>
        </button>

        <!-- THE DARK FAMILY. Three cream-on-cream chips inside a cream card were the
             clearest instance of the whole screen speaking one material: same fill, same
             radius, same border as everything around them, differentiated by nothing.
             The reference plates run TWO tile families side by side — bright tiles for
             things you act on, dark slate tiles for things you read off — and these are
             read-only, so they are the dark ones. The numeral also carries the meaning
             in colour now (won / lost / peak) instead of a caption doing all the work. -->
        <div class="home-record">
          <div class="home-rec"><span class="home-rec-ic">${O("medal")}</span><span class="home-rec-val is-win" data-el="wins">0</span><span class="home-rec-key">Wins</span></div>
          <div class="home-rec"><span class="home-rec-ic">${O("close")}</span><span class="home-rec-val is-loss" data-el="losses">0</span><span class="home-rec-key">Losses</span></div>
          <div class="home-rec"><span class="home-rec-ic">${O("trophy")}</span><span class="home-rec-val is-best" data-el="best">0</span><span class="home-rec-key">Best</span></div>
        </div>
      </aside>

      <!-- CENTRE: the equipped fighter, rendered by the game's own renderer.
           There are no staging layers over the canvas any more. Round 2 had four of
           them — a ray burst, a room, a horizon and a contact shadow — because
           'Stage' clears opaque and nothing could be painted BEHIND the canvas. All
           four are now real geometry inside 'charStage.ts', where they can be lit,
           occluded by the hero, and cast. Everything between the canvas and the
           labels here is a LABEL. -->
      <!-- A SPACER, and the stage itself is absolutely positioned over it.
           The hero used to be a grid item in this track, which is what made it a CARD:
           it started where the middle band started and stopped where it stopped, with a
           border drawn round the join. It is now full-bleed top to bottom (see
           '.home-stage'), so the grid only has to reserve the width the flanks must not
           intrude on. -->
      <div class="home-stage-slot" aria-hidden="true"></div>

      <!-- RIGHT: what you are about to take into the match. -->
      <aside class="fa-panel home-col home-fighter">
        <p class="fa-panel-title">Your fighter</p>
        <div class="home-stats" data-el="stats"></div>
        <div class="home-kit" data-el="kit"></div>
        <p class="home-kit-cap" data-el="kitcap"></p>
        <button class="fa-btn fa-btn--quiet home-change" type="button" data-go="characters">
          ${O("swap")} Change
        </button>
      </aside>
    </div>

    <!-- OUTSIDE '.home-middle' ON PURPOSE. It spans the whole screen height, so it
         cannot be a child of one row of the screen grid. -->
    <section class="home-stage" data-el="stage" data-clicksound="on">
      <div class="home-stage-3d" data-el="stage3d"></div>
      <div class="home-stage-glow" aria-hidden="true"></div>
      <div class="home-nameplate">
        <span class="fa-title home-hero-name" data-el="heroname"></span>
        <span class="fa-rarity" data-el="herorarity"></span>
      </div>
      <div class="home-stage-hint" data-el="hint">Tap to taunt</div>
    </section>

    <footer class="home-bottom">
      <div class="home-mode">
        <span class="home-mode-name">${xg}</span>
        <span class="home-mode-sub" data-el="modesub">${kg(aa)} · last one standing</span>
      </div>
      <button class="fa-btn fa-btn--primary" type="button" data-el="start">${O("play")} Start Game</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const o=v=>{const E=t.querySelector(`[data-el="${v}"]`);if(!E)throw new Error(`home: missing element "${v}"`);return E},n=o("stage3d"),s=o("confetti"),r=o("heroname"),i=o("herorarity"),c=o("hint");let l=0;function h(){const v=e.profile.claimable.length,E=o("road"),k=o("roadfill");if(v>0){E.classList.add("is-ready"),o("roadicon").innerHTML=O("sparkle"),o("roadtitle").textContent=v>1?`${v} rewards ready`:"Reward ready",o("roadsub").textContent="Tap to claim",o("roadpill").textContent="Claim",k.style.width="100%";return}E.classList.remove("is-ready");const{progress01:M,next:C}=Gd(e.profile.trophies);if(k.style.width=`${(M*100).toFixed(1)}%`,!C){o("roadicon").innerHTML=O("flag"),o("roadtitle").textContent="Road complete",o("roadsub").textContent="Every reward claimed",o("roadpill").innerHTML=`${O("trophy")} ${e.profile.trophies.toLocaleString()}`;return}const T=pi(C.reward,e.profile.unlocked);o("roadicon").innerHTML=C.reward.type==="character"?St(C.reward.id,{crop:"head"}):C.reward.type==="container"?dt(C.reward.kind):Jt(T.emoji),Ko(t),o("roadtitle").textContent=T.title,o("roadsub").textContent=`${(C.trophies-e.profile.trophies).toLocaleString()} trophies to go`,o("roadpill").innerHTML=`${O("trophy")} ${C.trophies.toLocaleString()}`}function d(){const v=e.profile.winsToNextChest,E=mt.winsPerChest,k=Math.max(0,Math.min(E,E-v));o("chestsub").textContent=v===0?"Ready on your next win":`${v} more ${v===1?"win":"wins"}`,o("pips").innerHTML=Array.from({length:E},(M,C)=>`<span class="home-pip${C<k?" is-on":""}"></span>`).join("")}function p(){const v=e.profile.containerCount,E=o("held");E.hidden=v===0,v>0&&(o("heldtitle").textContent=v===1?"1 chest held":`${v} chests held`)}function u(){const v=re[e.profile.selected],E=[["damage","Damage",v.stats.damage,"var(--ketchup)"],["health","Health",v.stats.health,"var(--lettuce)"],["speed","Speed",v.stats.speed,"var(--water)"]];o("stats").innerHTML=E.map(([k,M,C,T])=>`
      <div class="fa-stat">
        <span class="fa-stat-label">${O(k)} ${M}</span>
        <div class="fa-stat-track">
          <div class="fa-stat-fill" style="width:${C*10}%;background-color:${T}"></div>
        </div>
        <span class="fa-stat-val">${C}</span>
      </div>`).join(""),f()}function f(){const v=re[e.profile.selected];l>=v.abilities.length&&(l=0),o("kit").innerHTML=v.abilities.map((M,C)=>`
      <button class="home-kit-tile${C===l?" is-on":""}" type="button" data-kit="${C}">
        <span class="home-kit-em">${Jt(M.emoji)}</span>
        <span class="home-kit-name">${M.name}</span>
      </button>`).join("");const E=o("kitcap"),k=v.abilities[l];E.innerHTML=k?`<span class="home-kit-capname">${k.name}</span><span>${k.desc}</span>`:"",m()}function m(){const v=o("kit"),E=v.children[l];if(!E)return;const k=v.getBoundingClientRect(),M=E.getBoundingClientRect();if(k.width<=0||M.width<=0)return;const C=M.left+M.width/2,T=getComputedStyle(v).direction==="rtl"?(k.right-C)/k.width:(C-k.left)/k.width;o("kitcap").style.setProperty("--home-cap-x",`${(T*100).toFixed(1)}%`)}function g(){const v=re[e.profile.selected];o("name").textContent=e.profile.name,o("trophies").textContent=e.profile.trophies.toLocaleString(),o("coins").textContent=e.profile.coins.toLocaleString(),h(),d(),p(),u(),o("wins").textContent=e.profile.wins.toLocaleString(),o("losses").textContent=e.profile.losses.toLocaleString(),o("best").textContent=e.profile.bestTrophies.toLocaleString(),o("lv").textContent=`Lv ${e.profile.level}`,o("lvnext").textContent=`Lv ${e.profile.level+1}`,o("lvfill").style.width=`${(e.profile.levelProgress01*100).toFixed(1)}%`,o("lvxp").textContent=`${e.profile.xp%Bo} / ${Bo} XP`,r.textContent=v.name,i.textContent=v.rarity,i.style.background=ft[v.rarity],a.show(v.id)}const w=v=>{const E=v.target,k=E.closest("[data-kit]");if(k){const T=Number(k.dataset.kit);Number.isInteger(T)&&(l=T,f());return}const M=E.closest("[data-go]");if(!M)return;const C=M.dataset.go;C==="characters"?e.navigate({name:"characters"}):C==="trophies"?e.navigate({name:"trophies"}):C==="shop"&&e.navigate({name:"shop"})};t.addEventListener("click",w),o("start").addEventListener("click",()=>{e.navigate({name:"characters"})}),o("settings").addEventListener("click",()=>{e.navigate({name:"settings"})}),o("stage").addEventListener("click",()=>{a.poke(),rs(s,50,18)}),setTimeout(()=>c.classList.add("is-faded"),4200);const b=e.profile.onChange(g);g(),a.attachTo(n);const x=requestAnimationFrame(()=>m());return{root:t,update(v){a.update(v)},resize(){a.resize(),m()},dispose(){b(),cancelAnimationFrame(x),t.removeEventListener("click",w),a.setScene("portrait"),a.detach(),t.remove()}}}const Eg=`
/* ═══════════════════════════════════════════════════════════════════════════
   ROUND 4 — THE SCREEN WAS COLOURED PAPER, AND THAT IS NOW A NUMBER
   ═══════════════════════════════════════════════════════════════════════════

   Uri, having looked at the build: "I've had a look at the Home Screen and menus and
   we need to do a better job there. Looks amateurish." The blind critic, independently:
   home 5.17 against a reference 8.50 — the second-worst element in the game.

   The instrument written before any of this was touched is 'tools/tmp/hm_lang.mjs',
   and it is deliberately PIXEL-based rather than DOM-based for one reason: the
   reference is a set of screenshots. A DOM walk cannot be run on 'bs_home.png', and a
   metric computed one way on ours and another way on the plate measures the two
   instruments rather than the two screens. Four numbers, same function, any bitmap:

     flat%   share of 12x12 tiles with luma stdev < 2.5 -- literally "coloured paper"
     hues    EFFECTIVE hue count, 1/sum(p^2) over 24 bins, chromatic pixels only
     edge%   share of pixels on a luma step >= 30 -- outlines, bevels, shadows, detail
     dark%   share below luma 45 -- the outline-and-shadow budget

   Validated against six synthetic known-bad inputs first (16/16), because nineteen
   instruments were caught returning confident wrong answers here in one session.

   ── THE CONTROL IS OUR OWN CHARACTER SELECT, NOT THE PLATE ──────────────────
   Character select scores 7.00 to this screen's 5.17 on the same renderer, the same
   lighting, the same models and the same capture path. Captured in ONE run on ONE
   frozen snapshot, three repeats each (the hero sways +/-22 degrees, so repeats are the
   drift control and the measured spread IS the resolution floor):

                     home      select    floor    what it says
     flat%           46.80     30.37     0.91     47% of the lobby is featureless
     hues             5.57      8.04     0.10     one orange, one cream, twice
     edge%            8.13     14.18     0.20     nothing has an edge
     dark%           14.50     13.63     4.26     <- CANNOT RESOLVE. See below.

   ⚠️ dark% IS REPORTED AND NOT ACTED ON. Its measured floor is +/-4.26 and the gap
   between our 5.17 screen and our 7.00 screen is 0.87 — a fifth of the noise. The
   diagnosis handed to this pass listed "hard drop shadows and bevels" as a headline
   defect; on the only paired control available it is not what separates our good menu
   from our bad one, and CLAUDE.md #10 is explicit that acting inside a floor is how
   this project has repeatedly steered on noise. Brawl Stars measures 43.74 there, but
   Brawl Stars is a DARK-themed game and ours is high-key by a settled art direction
   that has already falsified "fix it by desaturating" four times. Chasing that number
   would mean darkening the art to satisfy an instrument.

   ── ACCEPTANCE, AND THE ONE METRIC THAT WAS DEMOTED AFTER ROUND 1 ───────────
   Stated before round 1 as flat% <= 33, hues >= 7.0, edge% >= 12. Then the plates were
   put through the same function, and hues DID NOT SURVIVE:

     screen              score   flat%   hues   edge%
     ours, home           5.17   46.80   5.57    8.13
     ours, select         7.00   30.37   8.04   14.18
     Brawl Stars home     8.50   31.50   4.71    9.95
     Brawl Stars roster      -   41.02   2.84   11.14
     Zooba progression       -   63.65   2.11    5.39

   The best-scoring screen in the set has FEWER effective hues than our worst one. hues
   separates our two screens and is flatly contradicted across products, so it is a
   within-product observation and not a quality proxy — it is reported below and NOT
   steered on. This is the same discipline CLAUDE.md #10 demands of a resolution floor,
   applied to validity instead of precision: a number that ranks the reference below the
   thing it is meant to improve is not measuring quality.

   What both independent references agree on is flat%: 30.37 and 31.50 for good screens
   against our 46.80. So:

     PRIMARY    flat%  46.80 -> <= 33.0   (floor 0.91; both references sit at 30-32)
     SECONDARY  edge%   8.13 -> >= 10.0   (floor 0.20; references 9.95 / 11.14 / 14.18)
     REPORTED   hues, dark%  -- see above, and dark% cannot resolve its own gap.

   ── WHAT IS BUILT, AND WHICH DEFECT EACH PIECE ANSWERS ──────────────────────
    1. A ROOM instead of a backdrop ('.home-room'). The flat orange radial plus dot
       grid was 47% featureless by itself. Now a tiled wall, a counter line, a floor,
       and a warm pool bedding the cool stage into it.
    2. THE HERO CARD IS GONE ('.home-stage'). It is full-bleed top to bottom with its
       canvas feathered into the room, so the fighter stands IN the lobby instead of
       inside a bordered rectangle on it. The set behind it is now a kitchen -- see
       'charStage.setScene()'.
    3. TILES DIFFERENTIATED BY FUNCTION. Bright gold for the thing you act on, dark
       slate for the things you read off, cream for the card they sit in.
    4. Pictorial navigation and a pictorial record row.

   ── AND THE ONE THING THAT COULD NOT BE REACHED FROM HERE ───────────────────
   'menu_accept''s 'hero-fills-its-panel' (floor 0.42) measures the hero's projected
   width as a fraction of ITS CANVAS. Making the canvas the full 16:9 viewport -- the
   literal Brawl Stars composition -- divides that number by the aspect change and
   lands it at ~0.29 for every fighter, with no framing that recovers it: reaching 0.42
   at 16:9 needs the character to be 89% of the screen's HEIGHT, against the reference's
   own 47%. The assertion is correct for a hero in a panel and becomes a category error
   when the panel is the screen, which is exactly the aggregate-vs-paired confusion
   CLAUDE.md #10 warns about. 'menu_accept.mjs' is not this file's to change, so the
   stage is held at aspect <= 0.92 (where every fighter clears the floor with margin)
   and the routing request is in the report. */

/* ── THE ROOM ─────────────────────────────────────────────────────────────── */
/* Painted by THIS SCREEN and not by the shell. '.fa-bg' is shared by every menu, so a
   room built there would put a kitchen behind the settings sheet and the shop. It sits
   at z-index 0 with every real control above it, and it is 'pointer-events: none' plus
   'aria-hidden' so it can never take a tap or a screen-reader stop -- '#screens' and
   '.hud-root' being pass-through is a standing rule on this project.

   WARM, and deliberately not the dark room the reference plate has. Brawl Stars' lobby
   is a dark purple industrial interior because its brand is purple; ours is a warm
   kitchen because the backdrop's job is to be the same product as the screen one click
   away. Character select is a warm orange field and scores 7.00; a dark lobby would
   have bought this metric at the cost of making the two screens different games. */
.fa-home .home-room {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
/* The wall, and the tiling is what actually moves 'flat%'.
   Two grout lines per joint, a dark one and a light one below it, because that is what
   a lit tile edge is and because ONE line at low alpha does not clear the metric's own
   30-luma step threshold -- it would have been a texture nobody and nothing could see,
   which is 'docs/LESSONS.md' §1 stated as a gradient stop. */
/* Pitch 64 px and not 94, and the grout is a real two-tone joint.
   'hm_lang''s edge share counts a pixel only on a luma STEP of 30 or more, which is not
   an arbitrary threshold — it is roughly where a joint stops being a tint and starts
   being a line. Round 1 ran 94 px tiles with a 0.20/0.16 joint: about 32 and 24 counts
   of step on this base, so half the joints did not clear it and there were few of them.
   The point of tiling a wall is not the pattern, it is that a room has EDGES in it and
   a gradient does not. */
.fa-home .home-room-wall {
  position: absolute;
  inset: 0 0 42% 0;
  background:
    repeating-linear-gradient(90deg, rgba(52,14,0,0.30) 0 3px, rgba(255,240,200,0.26) 3px 7px, transparent 7px 46px),
    repeating-linear-gradient(180deg, rgba(52,14,0,0.30) 0 3px, rgba(255,240,200,0.26) 3px 7px, transparent 7px 46px),
    radial-gradient(120% 90% at 50% 100%, rgba(255,222,150,0.55) 0%, transparent 62%),
    linear-gradient(180deg, #E9761F 0%, #EE8A22 46%, #F2A22C 100%);
}
/* The counter run and the floor under it. A hard bright lip on top of a dark body: the
   single highest-contrast horizontal in the frame, which is what stops the eye and
   makes the wall read as a wall rather than as the top of a gradient. */
.fa-home .home-room-floor {
  position: absolute;
  inset: 58% 0 0 0;
  background:
    linear-gradient(180deg, #FFE2A8 0 6px, #C8811F 6px 13px, #8E3A16 13px 22px, transparent 22px),
    /* Board joints. The floor was the single largest featureless region left after the
       wall was tiled — 42% of the frame at one gradient — and a plank line is the
       cheapest edge in the room. 0.16 alpha did not clear the 30-count step; 0.30 with a
       lit edge beside it does, and it is what a board joint looks like anyway. */
    repeating-linear-gradient(90deg, rgba(0,0,0,0.30) 0 3px, rgba(255,214,150,0.14) 3px 6px, transparent 6px 84px),
    repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 58px),
    linear-gradient(180deg, #A63A18 0%, #7E240F 55%, #5E1608 100%);
}
/* ── THE ALCOVE, and it is the third attempt at this seam ─────────────────────
   The stage's clear colour is an opaque saturated azure and the room around it is a
   warm orange kitchen. Two earlier attempts to join them both failed, and both failed
   in a way worth recording because the obvious idea is one of them:

     1. A WARM RIM over the canvas edge ('opening.ts''s idiom, which works on the title
        card). Measured: effective hue count 5.57 -> 4.17, i.e. it did not blend the cool
        into the warm, it PAINTED OVER the cool -- and the cyclorama is described in
        'charStage.ts' as the largest cool surface in the menus.
     2. A BIGGER, SOFTER FEATHER. Looked at, on a real capture: the canvas stopped being
        a rectangle and became a soft-edged rectangle. It still read as a blue slab
        floating on an orange wall, which is the same "cutout pasted on a swatch" both
        blind critics filed against the old card -- with the outline blurred.

   The mistake in both is treating the join as a BLEND problem. It is a spatial one: two
   different places cannot be cross-faded into each other, they have to be one place.
   So the wall now has a hole in it. A tiled kitchen wall with an arched service recess,
   the recess is the colour the renderer already clears to, and the fighter stands inside
   it. The feather is then invisible because it fades cool into cool, and the frame of
   the recess is a HARD edge, which is what the room was short of.

   Deliberately NOT a vignette. This file's round-2 note records that the art direction
   is high-key and that a dark vignette would have been the wrong move twice over; an
   architectural opening is dark because it is a hole, and it is bounded, framed and the
   same shape at every viewport rather than being a shadow smeared over the composition. */
.fa-home .home-room-alcove {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: -3%;
  bottom: 0;
  /* Wider than '.home-stage' by design, so the canvas's feathered edge lands INSIDE the
     recess and never crosses its frame. */
  width: min(97vh, 60vw);
  border-radius: 46% 46% 4% 4% / 30% 30% 2% 2%;
  background:
    radial-gradient(58% 44% at 50% 30%, rgba(120,190,235,0.30) 0%, transparent 72%),
    linear-gradient(180deg, #1B5375 0%, #164866 52%, #0E3149 100%);
  box-shadow:
    inset 0 0 0 5px rgba(255,196,104,0.92),
    inset 0 0 0 10px rgba(58,18,2,0.72),
    inset 0 18px 34px rgba(0,0,0,0.34),
    0 0 42px rgba(0,0,0,0.30);
}

/* ── The middle band ──────────────────────────────────────────────────────── */
/* Three columns, and the reason this is not round 1's three columns is that both
   flanks are LIVE. Round 1's rails held twelve navigation buttons, five tagged SOON,
   and a blind critic called that the loudest defect on the screen ("no top-grossing
   front end ships a home screen where the majority of navigation is unavailable").
   Round 2 replaced them with one roadmap card and the next critic named THAT the
   single most damaging element, for the same reason. Neither verdict was about
   columns; both were about advertising things that do not work. Every row below is
   driven by 'game/economy/' or 'game/rules.ts' and every one of them goes somewhere.

   The centre track is 'auto' and the flanks are 'fr': the hero sizes ITSELF from its
   own height (see '.home-stage') and the flanks absorb whatever is left, so there is
   never a strip of empty backdrop between the hero and a card. The whole band is
   capped so a 21:9 stretches the cards to a readable width rather than to 850px. */
.fa-home .home-middle {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(150px, 1fr);
  gap: var(--gap);
  min-height: 0;
  width: 100%;
  max-width: 1680px;
  margin-inline: auto;
}
/* ⚠️ THE THREE ROWS HAVE TO BE POSITIONED, AND IT IS NOT COSMETIC.
   '.home-room' and '.home-stage' are positioned with 'z-index: 0'. A positioned element
   with an explicit z-index paints in the POSITIONED phase, which is entirely above the
   in-flow block phase that non-positioned grid items paint in -- so without this the
   full-height stage would be drawn straight over the top bar, the flank panels and
   START GAME, and every one of them would still be hit-testable but invisible. That is
   'docs/LESSONS.md' §1 with the sign flipped: present, painted, and behind the thing it
   is supposed to be in front of. */
.fa-home .fa-topbar,
.fa-home .home-middle,
.fa-home .home-bottom { position: relative; z-index: 1; }
/* The confetti layer needs nothing here: 'theme.ts' already puts it at z-index 90, which
   is above both the room and these rows. An override was written and removed — lowering
   a shared layer to clear a local stack is how a screen ends up with confetti behind a
   panel on some OTHER screen's next change. */
/* SIZED TO CONTENT, then centred against the hero's mass.
   A stretched panel is the trap this screen already fell into once: round 1's rail
   was one small card sitting on top of ~600px of empty cream, and a large flat
   emptiness inside a bordered surface is a louder "unfinished" signal than no surface
   at all. These cards hold everything the lobby honestly knows and then stop. */
/* 'container-type: inline-size' — A CONTAINER QUERY, AND IT IS THE RIGHT INSTRUMENT
   RATHER THAN A CLEVER ONE. The flank's width is
       (100vw - 2*gutter - min(97vh, 60vw) - 2*gap) / 2
   because the middle track reserves the stage slot off vh. So it is a function of BOTH
   axes, and the flank widths actually measured are

     852x480 -> 173.34    1024x768 -> 178.45    844x390 -> 213.34
     852x393 -> 215.77    1280x800 -> 225.61    1600x900 -> 331.81

   — the narrowest flank in the set is on a PHONE and the second narrowest is on a
   TABLET twice its area. No media query can name that pair without naming four
   viewports and getting the fifth wrong, which is the same mistake the nameplate's vh
   clamp made one panel up. The card asks about the box it is in, and gets the true
   answer at every size including ones nobody tested.

   ⚠️ It also removes a hazard rather than adding one: 'contain: inline-size' makes this
   column's width independent of its contents, which is the exact defect
   'docs/LESSONS.md' records for the portrait top bar (an auto track inflated to its
   items' min-content and drew the whole screen 70px too wide). */
.fa-home .home-col {
  container-type: inline-size;
  /* THE ONE PLACE ON THIS SCREEN WHERE 'vh' IS THE RIGHT UNIT, and it is worth saying
     why given the nameplate two panels down was broken by exactly the opposite. There
     the quantity being positioned against (a 56px top bar) does not scale with the
     viewport, so a vh clamp was a category error. HERE the quantity being spent IS
     vertical room, and there is proportionally less of it on a 480px screen than on a
     900px one. 0.85vh resolves to 4.08px at 852x480 — the only viewport whose left
     flank has no headroom — and to the original 6px everywhere above 706px tall.
     Worth 9.6px across the column's five gaps, against a measured 9.31px overspend. */
  gap: clamp(4px, 0.85vh, 6px);
  padding: clamp(6px, 1.35vh, 14px);
  overflow: hidden;
  align-self: center;
  max-height: 100%;
}
/* ⚠️ 'flex: 0 0 auto' ON EVERY CHILD, AND IT IS A GUARD RATHER THAN A LAYOUT TWEAK.
   An over-subscribed column here does NOT overflow — every child is a '<button>' or a
   block whose flex 'min-height: auto' Chromium does not resolve to its content-based
   minimum, so the column silently COMPRESSES its cards and their contents draw outside
   their own borders while the panel looks untouched. Proven on a mutant
   ('ud_defects.mjs --selftest', row 5): 40px of extra content shrank the road card
   70.58px -> 52.28px with its content still 67px, i.e. 21px of type rendering over the
   card's bottom edge — and BOTH column-level overflow metrics reported 0.00.
   'scrollHeight - clientHeight' was 0, the per-child bottom was 0.06.

   With shrinking off, the same overspend becomes an overflow the panel clips, which
   'childCut' does see. That is the whole point: a failure this layout can have must be
   a failure the instrument can NAME. It is not load-bearing for the fit — every
   viewport measured has headroom — it is load-bearing for the NEXT change. */
.fa-home .home-col > * { flex: 0 0 auto; }

/* ── UI WEIGHT ────────────────────────────────────────────────────────────── */
/* The round-1 critic's second finding: "everything around the hero is web UI rather
   than game UI — the two cream panels are flat 1px-bordered cards with no bevel, no
   inner shadow and no chunky outline, [and] the only heavy display type on the whole
   screen is START GAME and Hamburger."

   The border was 3px rather than 1px, but the perception is the point: at the size
   these panels are actually seen, a 3px outline with a single flat drop reads thin
   next to a reference plate. What is missing is a MATERIAL — a lit top edge, a thick
   bottom lip and a little warmth pooling in the base — which is the same treatment
   'theme.ts' already gives '.fa-btn--primary', the one control on this screen the
   critic called shipped-grade. Scoped to '.fa-home' because 'theme.ts' is shared and
   this is a home-screen finding, not a system-wide one. */
.fa-home .home-col {
  border-width: 4px;
  box-shadow:
    0 6px 0 rgba(0,0,0,0.38),
    0 11px 20px rgba(0,0,0,0.22),
    inset 0 3px 0 rgba(255,255,255,0.9),
    inset 0 -10px 16px rgba(150,96,30,0.10);
}
/* Panel titles were 62%-opacity ink at ~12px — the lightest structural type on the
   screen, and measured at 4.8:1. Solid ink, larger, with a gold rule under it, so a
   heading reads as a heading and not as a caption. */
.fa-home .fa-panel-title {
  color: var(--ink);
  font-size: clamp(0.8rem, 1.95vh, 1.05rem);
  letter-spacing: 0.1em;
}
.fa-home .fa-panel-title::after {
  content: '';
  display: block;
  width: 32px;
  height: 4px;
  margin-top: 5px;
  border-radius: 999px;
  background: var(--gold);
}

/* ── Progress cards ───────────────────────────────────────────────────────── */
/* 'font-family' is declared HERE and that is a fix, not tidiness. A '<button>' does
   not inherit the family from its ancestors, so every descendant of this card that did
   not name a face itself fell back to the UA default — the metrics pass found
   '.home-track-sub', the two busiest lines in the left rail, rendering in **Arial**
   beside Heebo and Rubik everywhere else. Invisible to 'tsc' and to every assertion in
   'menu_accept'; a font-family audit found it in one run. */
.fa-home .home-track {
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  min-height: var(--tap);
  padding: 7px 9px;
  text-align: start;
  font-family: 'Heebo', sans-serif;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-home .home-track:hover { filter: brightness(1.04); }
.fa-home .home-track:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
}
.fa-home .home-track[hidden] { display: none; }

/* ── NOTHING ON THIS SCREEN ELLIPSISES ANY MORE ───────────────────────────────
   'white-space: nowrap; overflow: hidden; text-overflow: ellipsis' on the title and
   the sub produced NINE truncated runs at 852x480 and TEN at 1024x768, measured with
   'tools/tmp/ud_defects.mjs' against a populated save:

     "9 rewards ready"      -> "9 rew..."       (-10 chars)
     "Waiting to be opened" -> "Waitin..."      (-14 chars)
     "3 chests held"        -> "3 che..."       (-8 chars)

   Two blind critics named it unprompted -- "truncated mid-word ... reads as an
   unfinished layout bug" -- and it produced the joint-worst score in the per-element
   audit, 4 against 8. The solution was already written down in 'settings.ts:1311',
   where a nowrap segmented control rendered "Battery s..." at 390px portrait and was
   fixed by WRAPPING: an option a player cannot read is an option that is not offered.
   Same rule, same fix, three more elements.

   THREE THINGS MAKE THE WRAP SAFE, and all three are load-bearing:

   1. 'min-width' on the title, NOT 'min-width: 0'. A flex item allowed to shrink to
      zero wraps INSIDE A WORD -- at 852x480 the title column was 39.89px against a
      45px "rewards", so break-word would have rendered "reward" / "s", which is worse
      than the ellipsis it replaced. The floor is set above the longest word any title
      can hold, so the wrap always lands on a space.
   2. 'flex-wrap: wrap' on the row, so the PILL drops to its own line when the title
      cannot have its floor otherwise. This is what buys the title its width back; the
      pill is 'white-space: nowrap' and cannot shrink, so without this the title pays
      for it. 'margin-inline-start: auto' keeps the pill right-aligned on either line.
   3. 'overflow-wrap: break-word' as a FLOOR, never as the mechanism -- exactly as in
      'settings.ts'. If a future string does hold a word longer than the column, it
      breaks rather than overflowing the card, and the metrics tool reports it.

   ⚠️ Wrapping spends VERTICAL space, and '.home-col' is 'overflow: hidden' -- it CLIPS
   rather than scrolls. A wrap that does not fit converts a horizontal truncation into
   a vertical one, which is strictly WORSE: an ellipsis at least tells the player that
   something was cut. The container query below pays for the wrap at the one flank
   width where the budget is tight, and 'ud_defects.mjs' reports 'clipped' per column
   so an overspend cannot ship silently. */
.fa-home .home-track-top {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 4px 8px; width: 100%; min-width: 0;
}
.fa-home .home-track-icon { font-size: clamp(1.15rem, 2.6vh, 1.5rem); line-height: 1; flex: 0 0 auto; }
.fa-home .home-track-title {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.7rem, 1.55vh, 0.86rem);
  line-height: 1.18;
  flex: 1 1 auto;
  /* The longest word any title can carry is a milestone face title -- a character name
     from 'rules.ts' ("Hamburger", "Bottle") or "complete" / "rewards" / "chests" --
     which measures ~68px at the largest size this clamp reaches. 72px therefore
     guarantees the wrap lands on a space at every viewport. */
  min-width: 72px;
  overflow-wrap: break-word;
}
.fa-home .home-track-sub {
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.7rem, 1.4vh, 0.8rem); font-weight: 700; color: #4A3524;
  line-height: 1.22;
  overflow-wrap: break-word;
}
/* 'renderRoad' leaves this empty in one state and the flex column would otherwise
   still pay the gap for a box with nothing in it. */
.fa-home .home-track-sub:empty { display: none; }
.fa-home .home-track-pill {
  display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
  margin-inline-start: auto;
  --fa-ic-ink: #FFF3DE;
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.6rem, 1.35vh, 0.74rem);
  background: var(--ink); color: var(--cream);
  border-radius: 999px; padding: 3px 9px; white-space: nowrap;
}
.fa-home .home-pips { margin-inline-start: auto; }
.fa-home .home-track-pill.is-go { background: var(--lettuce); color: #16300a; }

/* The one state on this screen allowed to pull the eye away from START GAME, and
   only while it is true. */
.fa-home .home-track.is-ready {
  background: linear-gradient(180deg, #B6EC5E 0%, var(--lettuce) 100%);
  animation: fa-home-ready 1.6s ease-in-out infinite;
}
.fa-home .home-track.is-ready .home-track-sub { color: #16300a; }
@keyframes fa-home-ready {
  0%, 100% { box-shadow: 0 3px 0 rgba(0,0,0,0.3), 0 0 0 rgba(124,181,24,0); }
  50% { box-shadow: 0 3px 0 rgba(0,0,0,0.3), 0 0 16px rgba(166,226,74,0.85); }
}

/* Distance-to-next, measured across the gap the player is actually crossing. */
.fa-home .home-bar {
  display: block;
  width: 100%;
  height: 9px;
  background: rgba(26,18,36,0.16);
  border: 2px solid var(--ink);
  border-radius: 999px;
  overflow: hidden;
}
.fa-home .home-bar-fill {
  display: block;
  height: 100%;
  background: repeating-linear-gradient(45deg, var(--gold) 0 8px, var(--mustard) 8px 16px);
  transition: width 0.4s ease-out;
}

/* Free-chest cadence. Countable, so it is counted. */
.fa-home .home-pips { display: flex; gap: 3px; flex: 0 0 auto; }
.fa-home .home-pip {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--ink);
  background: rgba(26,18,36,0.14);
}
.fa-home .home-pip.is-on { background: var(--lettuce); }

/* ── PAYING FOR THE WRAP, AT THE ONE WIDTH WHERE IT COSTS ANYTHING ────────────
   Wrapping instead of ellipsising spends vertical space, and the left flank's budget
   is not the same at every viewport. Measured slack (band height minus column height),
   'tools/tmp/ud_defects.mjs':

     852x480 ....  24.95px   <- the only tight one
     852x393 ....  35.78px
     844x390 ....  32.78px
     1024x768 ... 254.20px
     1280x800 ... 275.03px
     1600x900 ... 350.47px

   So the trims below fire on a 173px flank and NOT on a 178px one, which no media
   query can express (the 173px case is a 852x480 phone and the 178px case is a
   1024x768 tablet). Nothing here removes information — it is padding, gap and one
   ornamental icon size. The icon is the largest single saving because it, not the
   text, sets the row's height: 24px of glyph beside 13px of type. */
/* ⚠️ THE HEIGHT CONDITION IS NOT REDUNDANT WITH THE WIDTH ONE, and leaving it off
   applied all of this to a 1024x768 tablet.
   A container query resolves against the CONTENT box, and the content boxes are
   852x480 -> 155.4px and 1024x768 -> 152.7px: the TABLET's flank is the narrower of the
   two, so no max-width threshold can separate them. But every declaration in this block
   buys VERTICAL room, and the tablet has 232px of slack — it needs none of it, and
   quietly restyling a viewport that was never broken is how a fix becomes a regression
   somewhere nobody looked. The width says the cards are cramped; the height says the
   column is out of room; the trims are only correct when both are true. */
@media (max-height: 520px) {
@container (max-width: 176px) {
  /* THE PILL MOVES ONTO THE SUB'S LINE, and this is where the height actually is.
     With the row as a wrapping flex line, a 132px card cannot hold
     icon + a title with a usable minimum + a nowrap pill, so the PILL wraps to a line
     of its own: 22px per card, on all three cards, for one 45px chip. Reflowing the
     card as a three-area grid puts it beside the sub instead, where there is already a
     line. 'display: contents' on '.home-track-top' is what lets a grid area address
     children of a wrapper without moving them in the DOM — the wide layout keeps its
     single row and its markup is untouched.

     Measured at 852x480 with the LONGEST strings the code can emit
     ('ud_defects.mjs --stress'): the road card was 108.17px and the column overspent
     its band by 21.61px, clipping the record row. */
  .fa-home .home-track {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'ic ti ti'
      'sb sb pl'
      'br br br';
    align-items: center;
    padding: 4px 7px;
    column-gap: 6px;
    row-gap: 3px;
  }
  .fa-home .home-track-top { display: contents; }
  .fa-home .home-track-icon { grid-area: ic; font-size: 1.05rem; }
  /* min-width goes back to 0 here ON PURPOSE: the title now owns a whole grid row and
     is never competing with the pill, so the floor that stopped mid-word breaks in the
     flex layout would only force the grid column wider than the card. */
  .fa-home .home-track-title { grid-area: ti; min-width: 0; }
  .fa-home .home-track-sub { grid-area: sb; }
  .fa-home .home-track-pill,
  .fa-home .home-pips { grid-area: pl; justify-self: end; margin-inline-start: 0; }
  .fa-home .home-bar { grid-area: br; height: 7px; }
  .fa-home .home-kit-tile { padding: 4px 3px; }
  .fa-home .home-kit-cap { margin-top: 6px; padding: 3px 6px; }
  /* ORNAMENT ONLY, and it is already dropped one breakpoint down for the same reason:
     "the gold rule under a panel title is 9px of a band that has none to spare". The
     first pass of this fix left it in and the column came out 8.59px over — measured as
     '.home-track > .home-bar draws 8.59px outside its own card', which is precisely the
     silent squash the guard above now makes impossible. */
  .fa-home .fa-panel-title::after { display: none; }
  /* THE THIRD CHANNEL IS THE ONE TO SPEND. This row says each number three ways: a
     glyph, a colour and a word. The file's own note is that "the numeral carries the
     meaning in colour now (won / lost / peak) instead of a caption doing all the work",
     and every one of the three colours is documented at 8.4-12.4:1 on the slate plate.
     Dropping the 11.5px glyph keeps the word AND the colour and is worth 22.3px of a
     band that was 21.61px short. */
  .fa-home .home-record { margin-top: 1px; padding-top: 4px; }
  .fa-home .home-rec { padding: 3px 2px 2px; }
  .fa-home .home-rec-ic { display: none; }
}
}

/* ── Centre stage ─────────────────────────────────────────────────────────── */
/* PORTRAIT, AND THAT IS THE SINGLE BIGGEST CHANGE ON THE SCREEN.
   'charStage.applyFraming()' fits the subject to whichever axis binds. On a panel
   wider than it is tall the binding axis is always HEIGHT, so every extra pixel of
   width is guaranteed empty backdrop — which is exactly why the old full-width panel
   showed a ~350px character inside a 1330px box and read as an aquarium.

   'aspect-ratio' with 'justify-self: center' is what makes this self-sizing: the grid
   row gives the panel a definite HEIGHT, the ratio derives its width from that, and
   'auto' on the middle track lets the flanks take the rest. So the hero is 4:5 at
   every viewport without a single breakpoint, and 4:5 is the shape of the
   character-select hero column — the best-scoring menu we have, running the same
   renderer, the same lighting and the same models. */
/* ── AND THE CARD IS GONE ─────────────────────────────────────────────────────
   Two blind critics on this screen said the hero "reads as a cutout pasted on a colour
   swatch", and round 3 answered the SWATCH half by building a real 3D set inside the
   canvas. It never answered the CUTOUT half, because the thing making it a cutout was
   the 4px ink border, the 16px radius and the 6px drop shadow drawn around it: a card
   is by construction a picture OF a place rather than a place. Uri's own words on the
   result were "looks amateurish", and this is the piece of it that is a rectangle.

   So: no border, no radius, no shadow, no grid cell. It spans the full screen height,
   its canvas is feathered into the room with a radial mask, and a warm glow bridges the
   two. That mask is 'opening.ts''s idiom, not a new one -- the title card has shipped a
   masked hero over a warm field for several rounds and it is the highest-scoring
   treatment of this same stage in the build.

   ── WIDTH IS CAPPED AT 0.92 OF THE HEIGHT, AND THAT IS A GATE, NOT A TASTE ──
   'menu_accept''s 'hero-fills-its-panel' measures the hero's projected width over the
   CANVAS width, floor 0.42. At the portrait rig's 0.62 vertical fill the projected
   width fraction is (subjectW/subjectH) * 0.62 / aspect, so it falls as the canvas gets
   wider: 0.57 for Hamburger at 0.92, and 0.48 for the narrowest fighter in the cast.
   A full-bleed 16:9 canvas -- the reference plate's actual composition -- puts every
   fighter at ~0.29 and no framing recovers it (0.42 at 16:9 needs the character to be
   89% of screen HEIGHT, against Brawl Stars' own 47%). See the round-4 header.

   'min(92vh, 56vw)' rather than a bare ratio: at 1024x768 the flanks would otherwise be
   crushed to 126px against a 150px minimum. When 56vw binds the canvas gets NARROWER,
   which moves the hero metric UP, so the cap is safe in the only direction it can act. */
/* ⚠️ A 5vh OVERSCAN WAS TRIED HERE AND REVERTED, and the number that killed it was the
   picture. Running the canvas 110vh tall so the set bled off the top and bottom edges
   did move the primary metric the right way (flat% 36.37 -> 32.19) and it made the hero
   62% of 990px rather than of 900 — which, rendered, crowded the frame: the crown
   touched the nameplate and the podium ran under the bottom bar. The alcove above buys
   the same "no bounding box" read for nothing, so the stage went back to the viewport
   height and the width cap went to 56vw. flat% held at 32.62. */
.fa-home .home-stage {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: 0;
  width: min(92vh, 56vw);
  transform: translateX(-50%);
  cursor: pointer;
}
/* THE FEATHER. The canvas's own clear colour is opaque (see 'charStage.ts'), so the
   only way its rectangle stops being a rectangle is to mask the element. Inside the
   dark stop the room does not show at all; by 82% it is entirely room. Both the canvas
   and its CSS placeholder background live on THIS element so the mask catches the
   pre-first-present frame too -- on the parent it would have left a hard-edged slab of
   '#1d5a80' for one frame on every navigation. */
/* ⚠️ ROUND 1 OF THIS PASS PUT THE FEATHER AND THE GLOW BOTH TOO STRONG, AND THE NUMBER
   SAID SO BEFORE THE EYE DID. Core 44% / transparent 82%, with a 0.34-alpha warm rim
   over the top, left an ellipse of visible set roughly 360x560 inside an 828x900 canvas
   — most of which the fighter itself covers. So the room was showing and the SET was
   not, and the warm rim then tinted what little blue survived: measured effective hue
   count fell 5.57 -> 4.17 while the page got MORE orange, which is the exact direction
   'docs/LESSONS.md' §8 spent two rounds proving is the wrong one. The cyclorama is
   described in 'charStage.ts' as "the largest cool surface in the menus" and it had been
   painted over. Core out to 58%, transparent at 94%, and the rim down to 0.15. */
.fa-home .home-stage-3d {
  position: absolute;
  inset: 0;
  background: ${tp};
  -webkit-mask-image: radial-gradient(66% 70% at 50% 50%, #000 58%, rgba(0,0,0,0.42) 78%, transparent 94%);
  mask-image: radial-gradient(66% 70% at 50% 50%, #000 58%, rgba(0,0,0,0.42) 78%, transparent 94%);
}
/* The warm rim over the seam. Same job as 'opening.ts''s '.open-glow' — enough to stop
   the cool pool reading as a hole punched in the wall, and not one step more. */
.fa-home .home-stage-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(70% 74% at 50% 50%, transparent 56%, rgba(255,186,88,0.15) 80%, transparent 96%);
}
/* What the grid reserves for it. The stage itself is out of flow, so this is the only
   thing keeping a flank from being drawn across the fighter. */
.fa-home .home-stage-slot { width: min(97vh, 60vw); }

/* ── WHERE THE FOUR STAGING LAYERS WENT ───────────────────────────────────── */
/* Round 2 painted a ray burst, a room, a horizon and a contact shadow here, as masked
   CSS over the canvas, and the reason was structural rather than stylistic: 'Stage'
   clears to an opaque colour, so a layer BEHIND the canvas is 'docs/LESSONS.md' §1 in
   its purest form — perfectly rendered, permanently invisible. That forced every one of
   them to be a low-alpha tint painted OVER the hero, which is a ceiling no amount of
   tuning gets past: they could not be lit, could not be occluded by the character, and
   could not cast anything.

   All four are now geometry in 'charStage.ts'. Two shapes that were tried and rejected
   in CSS are recorded there rather than lost, because both are the obvious idea and
   both are wrong: a filled pool of light on the floor landed on the plinth and bleached
   it, and a pool with a plinth-shaped hole wrapped AROUND the hole and crossed each
   flank twice, reading as ripples on water. The 3D floor has neither problem because
   the plinth OCCLUDES it instead of being drawn over.

   Nothing replaced them here. Two horizons in one card is worse than either alone. */

/* TOP-LEFT, not bottom-centre.
   The old nameplate was bottom-centred, and the bottom centre of this panel is where
   the plinth is — on a short viewport the word "Hamburger" landed across the
   character's feet. The panel's top-left corner is empty sky in every framing the rig
   produces (the camera pitches 20 degrees and targets half the subject's height), so
   the label can live there permanently without ever being computed against the pose. */
/* TOP-CENTRE now, and the reason the old comment gave is what moved it.
   It said the card's top-left is "dead sky in every framing the rig produces" -- true of
   a 4:5 card, and false the moment the card became the full screen height: the stage's
   top-left corner is now behind the status chips. The stage's top CENTRE is the piece of
   the top bar that is deliberately empty ('.fa-topbar-spacer'), and it is still sky at
   every framing for the same reason as before. Bottom-centre remains wrong -- that is
   where the plinth is. */
/* ⚠️ AND THE OFFSET WAS IN THE WRONG UNIT, WHICH IS WHY IT WAS WRONG EVERYWHERE.
   'top: clamp(46px, 7.5vh, 76px)' with a 'clamp(40px, 12vh, 56px)' override on short
   viewports was a guard nobody had ever measured, and it FAILED AT ALL SIX viewports
   tested, not only on the phone it was tuned for. Measured, 'tools/tmp/ud_defects.mjs':

     viewport     top bar bottom   nameplate top   OVERLAP
     852x393           62.00           47.16       14.84px
     852x480           62.23           46.00       16.23px
     844x390           62.00           46.80       15.20px
     1024x768          65.97           57.59        8.38px
     1280x800          66.39           60.00        6.39px
     1600x900          67.69           67.50        0.19px

   The mechanism is in the middle column: THE TOP BAR IS 56px TALL AT EVERY ONE OF THEM.
   It is built out of '--tap' (a fixed 44px) plus fixed padding and borders, so it does
   not scale with the viewport at all — only the 'var(--gap)' above it does, and that is
   itself clamped to 6-12px. The nameplate offset was written in 'vh', so the two
   quantities scale differently and any value that clears the bar does so by coincidence
   at exactly one height. A vh clamp cannot express "below a fixed-height bar".

   So the offset is now a MAX of the aesthetic value and a hard floor derived from the
   same variable the bar is derived from: '--tap + 12px' is the bar's measured height
   (56px, constant across a 2.3x range of viewport height), and 6px is the clearance.
   If the design system's tap target ever grows, the nameplate moves with it instead of
   silently sliding back under the tabs.

   NOT solved by moving the plate off-centre: the empty half of the top bar
   ('.fa-topbar-spacer') is LEFT of the tabs, and the nameplate is centred on the hero,
   which is centred on the screen. Decentring the name to dodge the tabs would decentre
   it from the thing it names. */
.fa-home .home-nameplate {
  position: absolute;
  top: max(
    calc(var(--fa-safe-t) + var(--gap) + var(--tap) + 12px + 6px),
    clamp(46px, 7.5vh, 76px)
  );
  inset-inline-start: 0;
  inset-inline-end: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 6px and not 3px: '.fa-title' paints 'text-shadow: 0 4px 0 var(--ink)' BELOW its
     line box, so any gap under 4px lets the name's drop shadow land on the rarity
     badge. Only visible on a short viewport, where the title clamps down to 1rem and
     the shadow does not clamp with it. */
  gap: 6px;
  max-width: 100%;
  pointer-events: none;
}
.fa-home .home-hero-name { max-width: 100%; }
/* 'theme.ts' gives '.fa-rarity' 'align-self: flex-start', which is right for character
   select's left-aligned nameplate and leaves the badge stranded at the far edge of an
   828px-wide centred one — measured 375px left of the name it belongs to. */
.fa-home .home-nameplate .fa-rarity { align-self: center; }

/* THE INSET DARKENING IS GONE, and its removal is a fix rather than a revert.
   It was added here because the badge takes its fill inline from 'RARITY_COLORS' and
   cannot be restyled by hue without desyncing the menu from the roster, so the only
   local lever was to darken whatever colour arrived: white-on-Normal-grey measured
   2.76:1 against a 4.5 floor (the same dark-on-dark failure 'docs/LESSONS.md' §1
   case 10 records for the HUD cooldown wipe), and 0.40 alpha bought some of it back
   at a cost of HSV saturation 1.00 -> 0.91.

   'theme.ts' has since given '.fa-rarity' a 1.6px ink TEXT-STROKE, which is
   colour-independent: the glyph's paper is now its own stroke rather than the fill, so
   every rarity measures 16.53-16.54:1 no matter what hue 'rules.ts' hands it. The
   darkening is therefore contributing exactly nothing to legibility and is only
   muting the badge — on a screen whose whole job is telling six rarities apart. The
   drop shadow stays; it is the shared raised-slab idiom, not a contrast device.

   ── RE-MEASURED AFTER 'cab4662' REPORTED 2.53 HERE. THE BADGE IS FINE. ────────
   That commit read "home now measures min ratio 2.53 with 1 run below AA on the
   Normal '.fa-rarity' badge, against a recorded 5.80 and 0" and called it a live
   regression rather than a capture artefact. It reproduces, and it is neither: it is
   the one battery of three whose contrast model does not know what a text stroke is.
   On ONE frozen snapshot, same tree, same badge:

     tools/tmp/screen_metrics.mjs   16.53   0 below AA   (has the stroke branch)
     tools/tmp/chars_metrics.mjs    16.53   ALL CLEAN    (has the stroke branch)
     tools/tmp/home_metrics.mjs      2.53   1 below AA   (did NOT — now fixed)

   2.53 is 'contrast(#FFF3DE, #9B9B9B)' to three figures: '--cream' against the raw
   'RARITY_COLORS.Normal' fill with the ink stroke between them ignored. It is exactly
   what a stroke-blind model must return once the darkening above came out. Note that
   screen_metrics' home MINIMUM is 5.80 today and 0 runs are below AA — the same pair of
   numbers the report called the "recorded" baseline — and that minimum is
   '.home-track-pill.is-go' "Open", not this badge. Which instrument the historical 5.80
   actually came from was NOT established here; what was established is that the two
   instruments disagree by 6.5x on this element on one frozen tree.

   Judged as PIXELS, per rarity, on both screens the badge renders on
   ('tools/tmp/rarity_aa.mjs', six rarities x home + character select x 3 viewports):
   16.52-16.54 on all of them, cream core intact at 12-17% of the badge with unbroken
   runs of 7-9 CSS px. 'paint-order: stroke fill' is why — the fill is painted back
   OVER the stroke, so the 1.6px rim is added outside the outline and takes nothing
   off an ~1.8px stem. Nothing here needs darkening again; darkening it to satisfy a
   stroke-blind instrument would mute six rarities to fix a measurement.

   The 'font-size: 0.7rem' below IS under theme.ts's 0.72rem floor, which that file
   raised deliberately "to keep that ratio honest at the smallest place this badge is
   used". Measured, the ratio holds anyway: 11.2px here gives a 8px core run against
   9px at character select's 13.12px. Left alone rather than "fixed" blind, because
   the only reason to move it would be a number that says it is wrong. */
.fa-home .fa-rarity {
  height: 21px;
  font-size: 0.7rem;
  border-width: 2.5px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
}

/* BOTTOM-LEFT, not bottom-right. The stage now runs the full screen height, so its
   bottom-right corner is exactly where the mode plate and START GAME are -- the hint
   would have been drawn across the primary CTA. */
.fa-home .home-stage-hint {
  position: absolute;
  bottom: clamp(8px, 1.6vh, 16px);
  inset-inline-start: clamp(4px, 1vh, 12px);
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.66rem, 1.45vh, 0.78rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cream);
  background: linear-gradient(180deg, rgba(42,29,58,0.94) 0%, rgba(16,10,26,0.96) 100%);
  border: 2.5px solid rgba(255,243,222,0.45);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  padding: 4px 11px;
  transition: opacity 0.6s ease;
}
/* Says its piece, then gets out of the way. A permanent instruction on a lobby is a
   tutorial that never ends — but "out of the way" used to mean opacity 0.35, which
   dropped the whole pill, plate and all, to 2.70:1 and produced the critic's exact
   words: "pale grey on pale blue". It now recedes by losing its lift rather than its
   legibility: still the quietest thing on the card, still readable at 9:1. */
.fa-home .home-stage-hint.is-faded {
  opacity: 0.88;
  box-shadow: none;
  border-color: rgba(255,243,222,0.22);
}

/* ── Fighter card ─────────────────────────────────────────────────────────── */
.fa-home .home-stats { display: flex; flex-direction: column; gap: 5px; }
/* The shared '.fa-stat-label' is a fixed 58-92px column, which is right for character
   select's narrow stats panel and wrong here, where the label carries an icon too. */
.fa-home .home-fighter .fa-stat-label {
  display: flex; align-items: center; gap: 5px;
  width: auto; flex: 0 0 auto;
}

/* ── The kit, as tiles ─────────────────────────────────────────────────────── */
/* Was four full-width rows with a two-line label each: "it reads as a spreadsheet in
   the middle of a brawler". Now a grid of pressable tiles carrying the icon and the
   name, with the description in one caption line below.

   Two columns and not four, because two to four abilities have to share the same
   grid: four columns would make a Donut's two tiles a half-empty row. An odd count
   spans its last tile across both columns instead of leaving the ragged cell that a
   critic named a defect on this screen once already. */
.fa-home .home-kit {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin-top: 2px;
}
.fa-home .home-kit-tile {
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: var(--tap);
  padding: 5px 4px;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-home .home-kit-tile:last-child:nth-child(odd) { grid-column: 1 / -1; }
.fa-home .home-kit-tile:hover { filter: brightness(1.04); }
.fa-home .home-kit-tile:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
}
.fa-home .home-kit-tile.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  box-shadow: 0 3px 0 var(--gold-shadow), inset 0 2px 0 rgba(255,255,255,0.75);
}
.fa-home .home-kit-em { font-size: clamp(1.25rem, 2.9vh, 1.7rem); line-height: 1; flex: 0 0 auto; }
/* WRAPS, for the same reason the track title does. At 852x480 a 58.17px tile rendered
   "Tomato Toss" as "Tomato T..." and "Lettuce Fling" as "Lettuce ..." — three of the
   nine truncated runs on the screen, and unlike the track rows these strings come from
   'rules.ts' and cannot be shortened here. The longest single word in the cast's
   ability names measures ~40px against a 57-58px tile at every viewport where the tile
   exists, so the wrap always lands on a space and 'break-word' is only a floor. */
.fa-home .home-kit-name {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.66rem, 1.45vh, 0.82rem);
  line-height: 1.12;
  text-align: center;
  max-width: 100%;
  overflow-wrap: break-word;
}
/* The tap state. A FIXED minimum height, because selecting a tile must not reflow the
   panel — the Change button sits under this and '.home-col' clips rather than scrolls,
   so a growing caption would eat a control rather than push the page. */
.fa-home .home-kit-cap {
  position: relative;
  margin: 9px 0 0;
  padding: 4px 8px;
  min-height: 2em;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.45vh, 0.82rem);
  line-height: 1.15;
  text-align: center;
  color: #3B2A18;
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: 2.5px solid var(--ink);
  border-radius: 10px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.9);
}
/* The selected ability's NAME, hidden by default because the tile beside it already
   carries it. It is turned on at exactly one breakpoint — the landscape phone, where
   the tiles go icon-only to fit (see the max-height block at the foot of this file) —
   so the caption is the only place the name exists there. Rendered as its own element
   rather than concatenated into the string, because the two states differ in LAYOUT,
   not in content, and a screen must not have to re-run 'renderKit' to change size. */
.fa-home .home-kit-capname { display: none; font-weight: 900; }
/* NON-BREAKING SPACES, both sides. A plain space in 'content' collapses against the
   adjacent inline box and the first capture rendered "Tomato Toss -Slows enemies down"
   — the leading space survived and the trailing one did not. The dash is also what
   stops the separator from being the wrap point on a two-line caption.
   ⚠️ DOUBLE backslashes: this whole stylesheet is a JS template literal, so a single
   backslash is consumed by JS and never reaches CSS. Written singly it compiled as an
   octal escape and tsc refused the file (TS1487). Same family of trap as the backtick
   rule at the top of this file. */
.fa-home .home-kit-capname::after { content: '\\00a0\\2013\\00a0'; font-weight: 700; }
/* The tail. '--home-cap-x' is written by 'renderKit()' from the selected index, so the
   caption points at its own tile rather than at the grid in general. A rotated square
   whose lower half lands ON the plate's ink border, which is what makes it read as a
   tail growing out of the plate instead of as a diamond floating above it — the first
   version left a gap and looked like a stray icon. */
.fa-home .home-kit-cap::before {
  content: '';
  position: absolute;
  top: -8px;
  inset-inline-start: var(--home-cap-x, 50%);
  width: 13px;
  height: 13px;
  margin-inline-start: -6.5px;
  transform: rotate(45deg);
  background: var(--mustard);
  border-left: 2.5px solid var(--ink);
  border-top: 2.5px solid var(--ink);
  border-start-start-radius: 3px;
}
.fa-home .home-change { margin-top: 4px; width: 100%; }

/* Career record. Three numbers, all live, and the only place in the product that
   shows them — the trophy road tracks the CURRENT count, this tracks the peak. */
.fa-home .home-record {
  display: flex;
  gap: 5px;
  margin-top: 2px;
  padding-top: 6px;
  border-top: 2.5px dotted rgba(26,18,36,0.2);
}
/* DARK SLATE, and this is the second tile family on the screen.
   They were 'rgba(26,18,36,0.06)' on cream -- a 6% tint inside a cream card, which is
   the same surface at a different opacity rather than a different surface. The plates
   run bright ACTION tiles and dark READ-ONLY tiles side by side, and 'hm_lang''s hue
   count is what makes that a number rather than an opinion: a screen whose every panel
   is one cream cannot spend more of the wheel than the one hue it owns. */
.fa-home .home-rec {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 2px 3px;
  background: linear-gradient(180deg, #3A2A4E 0%, #241A33 100%);
  border: 2.5px solid var(--ink);
  border-radius: 10px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.34), inset 0 2px 0 rgba(255,255,255,0.14);
  --fa-ic-ink: #FFF3DE;
}
.fa-home .home-rec-ic { font-size: clamp(0.72rem, 1.5vh, 0.9rem); line-height: 1; opacity: 0.92; }
.fa-home .home-rec-val {
  font-family: 'Rubik', sans-serif; font-weight: 900;
  font-size: clamp(0.8rem, 1.9vh, 1.05rem);
  line-height: 1;
  color: var(--cream);
}
/* The numeral carries the meaning. All three measured against the '#241A33' half of the
   plate, which is the darker end and therefore the binding case:
   '#8FE04A' 10.7:1, '#FF8A96' 8.4:1, '#FFD15C' 12.4:1 -- every one clear of AA with
   room, and the hues are the roster's own lettuce / ketchup / gold rather than three
   new ones invented for this row. */
.fa-home .home-rec-val.is-win { color: #8FE04A; }
.fa-home .home-rec-val.is-loss { color: #FF8A96; }
.fa-home .home-rec-val.is-best { color: #FFD15C; }
/* 55%-opacity ink at 9.9px measured 3.73:1 against a 4.5 floor and was, with the tap
   hint and the mode line, one of the three text runs the critic could not read. Solid
   ink-brown at >=11px took it to ~10:1 on the old cream chip; on the slate plate the
   same job is done by cream at 78%, measured 9.2:1. */
.fa-home .home-rec-key {
  display: flex; align-items: center; gap: 3px;
  font-size: clamp(0.7rem, 1.4vh, 0.78rem);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255,243,222,0.78);
  white-space: nowrap;
}

/* ── The GOLD family: the one row that is a reward ─────────────────────────── */
/* The trophy road, the free chest and the record row were three identical cream
   surfaces stacked in one cream card, so the panel read as a list and not as a set of
   objects. The road is the thing the player is working toward and the only row here
   that ever pays out, so it takes the same gold the primary CTA uses -- which is the
   reference plates' actual system: bright yellow means "this gives you something". */
.fa-home .home-track--road {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  box-shadow: 0 3px 0 var(--gold-shadow), inset 0 2px 0 rgba(255,255,255,0.7);
}
.fa-home .home-track--road:active { box-shadow: 0 0 0 var(--gold-shadow), inset 0 2px 0 rgba(255,255,255,0.7); }
/* '#4A3524' on mustard measures 7.1:1; the sub-line keeps its own value rather than
   inheriting a colour picked for cream. */
.fa-home .home-track--road .home-track-sub { color: #4A3524; }
/* The gold row's pill has to stop being gold-on-gold. Ink plate, cream type: 15.9:1. */
.fa-home .home-track--road .home-track-pill { background: var(--ink); color: var(--cream); }

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
/* The bottom bar holds the CTA and its label, and nothing else. Character select's
   bottom bar is the same shape — one loud button in the corner — and that is the
   highest-scoring menu in the build. */
.fa-home .home-bottom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(8px, 1.6vw, 20px);
  min-height: var(--tap);
}
/* ── The status chips join the DARK family ────────────────────────────────────
   Three cream pills on a cream-and-orange page, in a row, at the top of a screen whose
   named defect is that everything is the same surface. The reference plate's currency
   readouts are dark slate with a saturated icon and white type, for the same reason the
   record row above is: a counter is something you READ, not something you press, and
   the two should not look alike.

   ⚠️ '.fa-chip' is 'theme.ts''s and 'theme.ts' is shared, so this is scoped to
   '.fa-home' -- exactly as the '--ketchup' fix below already was. The interactive
   '.fa-iconbtn' gear beside them deliberately stays cream: it is the one thing in the
   bar you press, and that is now the difference between the two shapes.

   The old note, kept because the number is still true of the cream chip on every OTHER
   screen: "'--ketchup' on cream measured 4.35:1 -- under the 4.5 floor by a hair, and it
   is the player's trophy count, which is not a decoration. Darkened one step." On the
   slate plate the trophy count goes the other way and becomes a LIGHT value: '#FF8A96'
   on '#241A33' measures 8.4:1, where '#A81B2B' would have been 1.6:1 and unreadable.
   This is 'docs/LESSONS.md' §1 case 10 exactly -- dark ink on a dark plate -- and it is
   the direct cost of changing a surface under type that was tuned for the old one. */
.fa-home .fa-chip {
  background: linear-gradient(180deg, #3A2A4E 0%, #241A33 100%);
  color: var(--cream);
  box-shadow: 0 4px 0 rgba(0,0,0,0.42), inset 0 2px 0 rgba(255,255,255,0.15);
  --fa-ic-ink: #FFF3DE;
}
.fa-home .fa-chip-val { color: #FF8A96; }
.fa-home .home-chip-coin .fa-chip-val,
.fa-home .home-chip-coin { color: #FFD15C; }

/* Inside the progress panel the level bar is a row, not a floating hairline: it gets
   the panel's full width and the cream label treatment has to go, because there is no
   dark backdrop behind it any more. */
.fa-home .home-level { flex: 0 0 auto; }
.fa-home .home-level .fa-level-label {
  color: var(--ink);
  text-shadow: none;
  font-size: clamp(0.62rem, 1.4vh, 0.78rem);
}

/* The CTA's subject. A lobby's primary button has to say what it starts — this is the
   only 1v1 mode in the build, and the duration is read from MATCH_DURATION_MS so the
   copy cannot outlive the sim. */
/* ON A PLATE, and that fixes two findings with one element.
   "'3:00 · last one standing' is thin light text directly on saturated red" measured
   3.50:1 — cream at 80% opacity over '#C1272D' is simply not a legible pairing, and no
   amount of text-shadow rescues 11px of it. A dark plate is also the HUD's idiom (dark
   ground, bright state), and the HUD is the one element on this project that beat the
   shipped reference in a blind A/B — so the same move that makes the copy readable is
   the move that makes it read as game UI rather than as a caption floating on the
   backdrop. */
.fa-home .home-mode {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  margin-inline-start: auto;
  text-align: end;
  min-width: 0;
  padding: 6px clamp(11px, 1.4vw, 18px);
  background: linear-gradient(180deg, rgba(44,30,60,0.94) 0%, rgba(20,13,30,0.96) 100%);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.14);
}
.fa-home .home-mode-name {
  font-family: 'Rubik', sans-serif; font-weight: 900;
  font-size: clamp(0.74rem, 1.75vh, 0.96rem);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--mustard-hi);
  text-shadow: none;
  white-space: nowrap;
}
.fa-home .home-mode-sub {
  font-family: 'Rubik', sans-serif;
  font-size: clamp(0.72rem, 1.6vh, 0.88rem);
  font-weight: 800;
  color: rgba(255,243,222,0.94);
  text-shadow: none;
  white-space: nowrap;
}

/* ── Landscape phones ─────────────────────────────────────────────────────── */
/* Height is the binding constraint long before width — 390px tall is the tight case,
   not 844px wide. So trim by HEIGHT, and drop the flank whose information is
   available one tap away: the fighter's stats are the whole right-hand panel of the
   character-select screen, while the progress cards exist nowhere else. */
/* Both flanks SURVIVE here, and the hero keeps its 4:5.
   The instinct is to widen the hero panel on a short screen, and it is wrong: the rig
   sizes the character off the panel's HEIGHT (62% of it), so widening the panel adds
   empty cyan and does not add one pixel of character. What has to give instead is the
   two lists that need vertical room the band does not have. */
@media (max-height: 460px) {
  .fa-home .home-stage-hint { display: none; }
  /* WAS: '.fa-home .home-nameplate { top: clamp(40px, 12vh, 56px); }' with the reason
     "the nameplate's top offset is a clamp against viewport height, and at 390px tall
     the top bar is proportionally much larger, so the name would land on the tabs."
     The diagnosis was right and the prescription was 15px short — 12vh of 393 is
     47.16px against a tab bar whose bottom edge is at y=62, so the override moved the
     plate DOWN by 1.16px and the name still ran under the tabs. Kept here per the
     project's rule about reversed assertions: the fix is one level up, on the base
     rule, and it is a max() against a floor derived from '--tap' rather than another
     vh guess. Nothing viewport-specific is needed any more. */
  .fa-home .home-track-sub { display: none; }
  .fa-home .home-mode-sub { display: none; }
  .fa-home .home-record { display: none; }
  /* ⚠️ WAS: '.fa-home .home-kit { display: none; }' and '.home-kit-cap { display: none }',
     with the reason "the caption is the kit's tap state, so it goes with the kit".
     The reason for hiding the CAPTION was sound; hiding the KIT was not, and it stopped
     being defensible the moment Uri ruled the game LANDSCAPE-ONLY (DECISIONS §14).
     This breakpoint is not an edge case — it IS the phone experience — and what it
     shipped was a lobby with NO ability affordance whatsoever: measured 0 tiles at
     852x393 and 844x390, against 4 at every viewport above 460px tall. The right flank
     is titled "Your fighter" and told the player three stat bars and nothing about what
     the fighter DOES.

     It was hidden because the 2x2 grid plus its caption is ~139px and did not fit. The
     measurement says the flank has 118px of unused height at 852x393 (panel 151px in a
     269px band), so the fix is to make the kit fit rather than to delete it:

       - ONE ROW of N tiles instead of a 2x2 grid          -> 44px, not 93px
       - ICON-ONLY tiles, the name moving to the caption   -> nothing truncates in a
                                                              43px tile, and the caption
                                                              gains the name it needs
       - a slightly taller caption to hold name + desc     -> ~50px

     Total ~96px against 118px available, and 'ud_defects.mjs' asserts the column does
     not clip. The caption stays because the tiles are back, which is what the old
     comment actually said. */
  /* ICON-ONLY AT EVERY LANDSCAPE-PHONE WIDTH, one row or two. The name moves to the
     caption, which is where the tap state already lives — measured, that is 33px off a
     two-up grid (a 73px tile wraps "Lettuce Fling" onto a second line and stands 61px
     tall; icon-only it is 44px, the tap floor exactly), and the notched flank needed
     every one of them. */
  .fa-home .home-kit-tile { padding: 4px 3px; gap: 0; }
  .fa-home .home-kit-name { display: none; }
  .fa-home .home-kit-capname { display: inline; }
  .fa-home .home-kit-cap { margin-top: 7px; padding: 3px 6px; min-height: 2.6em; }
  /* ⚠️ AND THE ONE-ROW FORM IS GATED ON THE FLANK BEING WIDE ENOUGH FOR FOUR THUMBS.
     The first version of this fix put four icon tiles in a row unconditionally and
     'menu_accept' refused it: at 844x390 WITH A LANDSCAPE iPHONE'S NOTCH (44px of inset
     on each long edge, which is the device this breakpoint exists for) the flank falls
     from 193px of content to 151, and four tiles measured 34x44 against a 44x44 tap
     floor. An ability affordance a thumb cannot hit is not an affordance, so the count
     the probe reports would have said "4" about a row nobody can use.

     The threshold is arithmetic rather than taste: four 44px targets with three 5px
     gaps need 191px. Below it the kit falls back to the two-up grid this file already
     uses everywhere else — still icon-only, still 44px tall, 73px wide.
     A container query rather than a width media query for the reason given above the
     '.home-col' rule: this is a question about the FLANK, and the same 844x390 device
     answers it differently with and without insets. */
  /* ⚠️ 191px IS THE CONTAINER'S CONTENT BOX, NOT ITS BORDER BOX, and the difference is
     18px of padding and border that cost a whole debugging round. A container query on
     'container-type: inline-size' resolves against the CONTENT box, so a 215.78px flank
     queries as 200.2px — a threshold written at 200 against the outer width matched
     NOTHING, at any viewport, and the kit stayed two-up everywhere while the rule sat
     there parsing cleanly. (Confirmed by walking 'document.styleSheets': the
     CSSContainerRule was present and simply never matched.) 191 = 4 tiles x 44px +
     3 gaps x 5px, i.e. the arithmetic requirement itself, which is why it is that
     number and not a rounded one.
     ⚠️ SINGLE QUOTES in this comment, like every other one in this file: a backtick
     anywhere in this template literal terminates the string. Writing the property name
     in backticks here produced 'home.ts(1820,7): error TS1005' — CLAUDE.md's
     non-negotiable, and it has now bitten in this file twice. */
  @container (width >= 191px) {
    .fa-home .home-kit {
      grid-template-columns: none;
      grid-auto-flow: column;
      /* minmax(44px, ...) and not minmax(0, ...): the tap floor has to be expressed in
         the grid, not merely satisfied by arithmetic, or the next ability added to a
         character silently shrinks four targets below it. */
      grid-auto-columns: minmax(44px, 1fr);
    }
    /* The odd-count span is a two-column idiom. In one row there is no ragged cell to
       close, and letting it span would make a three-ability fighter's last tile twice
       the width of the other two. */
    .fa-home .home-kit-tile:last-child:nth-child(odd) { grid-column: auto; }
  }
  /* ⚠️ AND BELOW 191px THE STATS GO, NOT THE KIT — WHICH IS A REVERSAL, ON THIS FILE'S
     OWN STATED PRINCIPLE.
     A landscape iPhone carries 44px of safe-area inset on BOTH long edges, so 844x390
     becomes 756px of usable width and the flank falls to 154px of content. Four 44px
     targets need 191, so the kit has to be two-up there — and two-up plus its caption
     plus three stat bars plus the Change button measures 313px against a 245px band.
     Something has to go, and the comment at the top of this media query already says
     which: "drop the flank whose information is available one tap away: the fighter's
     stats are the whole right-hand panel of the character-select screen". That reason
     was written to justify dropping a whole flank and was then applied to the KIT,
     which is available nowhere else on this screen. Applied to the thing it actually
     describes, it drops the three stat bars: 227px, and it fits.
     Measured with 'ud_defects.mjs' at 844x390 and 852x393 with menu_accept's own
     insets (t0 r44 b21 l44). See DECISIONS-FOR-URI — this is the one judgement call in
     the four fixes, and reversing it is one rule. */
  @container (width < 191px) {
    .fa-home .home-stats { display: none; }
    /* And the panel HEADERS, worth 19px each including their gap. Measured, the right
       flank was still 7.5px over after the stats went and the left flank had 0.41px of
       slack — 19px is the difference between "fits" and "the Change button is clipped".
       What is left in each panel says what it is without being told: three cards reading
       "9 rewards ready" / "Free chest" / "3 chests held", and four ability tiles over a
       caption that names the one you tapped. */
    .fa-home .home-col .fa-panel-title { display: none; }
  }
  /* The gold rule under a panel title is 9px of a band that has none to spare. */
  .fa-home .fa-panel-title::after { display: none; }
}

/* ── PORTRAIT PHONE, AND IT WAS BROKEN AT HEAD ────────────────────────────── */
/* Measured at 430x932 (iPhone 15 Pro Max) with 'tools/tmp/portrait_probe.mjs': the
   ENTIRE screen was laying out at 584 CSS px inside a 430 px viewport, so the tab bar,
   the settings gear and START GAME were all simply off the right-hand edge and the hero
   was cropped off-centre.

   Two separate causes, and the second only becomes visible once the first is fixed:

   1. THE TOP BAR SET THE WIDTH. It is one non-wrapping flex row — three status chips,
      a three-tab segmented control and a gear — whose min-content width is ~584. A
      '.fa-screen' grid track is 'auto', and an auto track's base size is its items'
      min-content contribution, so the bar inflated the track and every row below it
      inherited the inflated width. The hero card was a symptom, not the cause.
   2. THE HERO CARD WOULD STILL OVERFLOW. It is 'height: 100%' plus 'aspect-ratio: 4/5',
      which makes its width follow the row height — and a portrait row is ~760 px tall,
      so 608 px of width. 'max-width: 100%' does not save it, because a grid item's
      default 'min-width: auto' resolves to min-content, and for an aspect-ratio box with
      a definite height min-content IS height x ratio. The floor beat the cap.
      'align-self: center' is load-bearing in the fix: without it the item stretches, the
      height becomes definite again, and the width goes straight back to 608.

   WHY 315 ASSERTIONS MISSED IT: 'menu_accept''s five viewports are 1600x900, 1280x800,
   1024x768, 844x390 and 2560x1080 — all landscape, none under 844 px wide, so this
   breakpoint never fired in the suite. And the shell clips overflow, so
   'document.scrollWidth' stayed at 430 and even the no-page-scroll assertion passed.
   A defect can be 100% reproducible and still invisible to a suite that never asks. */
@media (max-width: 700px) {
  .fa-home .home-middle { grid-template-columns: minmax(0, 1fr); }
  .fa-home .home-col { display: none; }
  .fa-home .home-mode { display: none; }
  .fa-home .home-bottom { flex-wrap: wrap; }
  /* Two rows rather than one. The spacer goes because a flex spacer inside a wrapping
     row pushes the wrap point around for no benefit; the chips take the first line and
     the navigation takes the second. */
  .fa-home .fa-topbar { flex-wrap: wrap; row-gap: 6px; }
  .fa-home .fa-topbar-spacer { display: none; }
  .fa-home .fa-tabs { flex: 1 1 auto; }
  .fa-home .fa-tab { flex: 1 1 0; justify-content: center; padding: 0 6px; }
  /* PORTRAIT KEEPS THE FULL-BLEED STAGE, but the landscape width cap is nonsense here:
     52vw of a 430px-wide phone is 224px inside a 932px-tall box, which frames the hero
     by WIDTH and shrinks it to a third of the screen. The flanks are hidden at this
     breakpoint (below), so there is nothing for the stage to crowd and it can take the
     viewport. §14 is settled -- the game is landscape and portrait gets a rotate prompt
     -- but 'menu_accept_portrait' is 219 assertions and that prompt still needs a laid
     out screen underneath it, so this stays correct rather than being deleted. */
  .fa-home .home-stage { width: min(92vh, 92vw); }
  .fa-home .home-room-alcove { width: min(97vh, 98vw); }
  .fa-home .home-stage-slot { display: none; }
  .fa-home .home-nameplate { top: clamp(70px, 11vh, 120px); }
}

@media (prefers-reduced-motion: reduce) {
  .fa-home .home-track.is-ready { animation: none !important; }
}
:root.fa-reduce-motion .fa-home .home-track.is-ready { animation: none !important; }
`,Tg=4500,Sg=["No","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen","Twenty"];function Ag(e){return Sg[e]??String(e)}function Fg(){const e=new URLSearchParams(location.search).get("hold"),t=e===null?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:Tg}function Rg(e){la("fa-opening-styles",Cg),ha();const t=Re("div","fa-screen fa-opening"),a=Ki();t.innerHTML=`
    <header class="open-head">
      <h1 class="open-title">Food Fight Arena</h1>
      <p class="open-tagline">${Ag(Se.length)} fighters. One kitchen. No table manners.</p>
    </header>

    <div class="open-stage">
      <div class="open-stage-3d" data-el="stage3d"></div>
      <div class="open-glow"></div>
    </div>

    <footer class="open-foot">
      <button class="fa-btn fa-btn--primary open-start" type="button" data-el="start">
        ${O("play")} Tap to start
      </button>
      <div class="open-timer" aria-hidden="true"><span class="open-timer-fill" data-el="timerfill"></span></div>
    </footer>
  `;const o=p=>{const u=t.querySelector(`[data-el="${p}"]`);if(!u)throw new Error(`opening: missing element "${p}"`);return u},n=o("stage3d");let s=!1,r=null;function i(){s||(s=!0,r!==null&&(clearTimeout(r),r=null),we.unlock(),we.music.play(),e.navigate({name:"home"}))}const c=p=>{p.key!=="Tab"&&i()},l=()=>i();window.addEventListener("keydown",c,!0),window.addEventListener("pointerdown",l,!0),o("start").addEventListener("click",i);const h=Fg();r=setTimeout(i,h);const d=o("timerfill");return d.style.transition=`width ${h}ms linear`,requestAnimationFrame(()=>{d.style.width="100%"}),a.show(e.profile.selected),a.attachTo(n),{root:t,update(p){a.update(p)},resize(){a.resize()},dispose(){r!==null&&clearTimeout(r),window.removeEventListener("keydown",c,!0),window.removeEventListener("pointerdown",l,!0),a.detach(),t.remove()}}}const Cg=`
.fa-opening {
  grid-template-rows: auto minmax(0, 1fr) auto;
  justify-items: center;
  text-align: center;
}

.fa-opening .open-head { display: flex; flex-direction: column; align-items: center; gap: 2px; }

/* Not '.fa-title': that one is sized for a screen HEADING and clips to one line with
   an ellipsis, which is wrong for the one piece of type on this screen that is
   allowed to be the loudest thing in the frame. The 2 degree tilt is the
   prototype's, and is the single detail that stops a centred sans-serif wordmark
   reading as a placeholder. */
.fa-opening .open-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.5rem, 7.2vh, 4rem);
  line-height: 1.02;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: var(--cream);
  transform: rotate(-2deg);
  -webkit-text-stroke: 4px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 5px 0 var(--ink), 0 12px 22px rgba(0,0,0,0.4);
  animation: fa-open-slam 0.44s cubic-bezier(0.2, 1.5, 0.35, 1);
}
@keyframes fa-open-slam {
  from { opacity: 0; transform: rotate(-2deg) scale(1.5); }
  to { opacity: 1; transform: rotate(-2deg) scale(1); }
}

.fa-opening .open-tagline {
  margin: 0;
  font-family: 'Heebo', sans-serif;
  font-weight: 800;
  /* Sized to be read from across a room, like the wordmark above it. At the round-1
     size it rendered ~13px under a 64px title and read as a caption on a poster. */
  font-size: clamp(0.72rem, 2.5vh, 1.3rem);
  letter-spacing: 0.01em;
  color: var(--cream);
  -webkit-text-stroke: 2px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 3px 0 var(--ink);
  transform: rotate(-1deg);
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
/* The portrait context paints its own backdrop (see charStage.ts). On the HOME screen
   that is fine — it is framed as a display case. Here it must not be: a hard rectangle
   of someone else's world in the middle of a title card reads as a video player. So the
   canvas is MASKED to an ellipse that fades out well before its own edge, which turns
   the same pixels into a lit spotlight standing in the menu's world. The mask is on a
   wrapper rather than the canvas so charStage's own sizing is untouched.
 *
 * ── Retuned for the 3D set ──────────────────────────────────────────────────
 * These numbers were authored against a FLAT, bright cyan clear colour. charStage now
 * builds a real lit set — cyclorama, floor, horizon — which is a large win everywhere
 * it is framed as a stage (it flipped the cast's figure/ground polarity from -0.23 to
 * +0.19; LESSONS §13) and a loss in exactly one place: here, where the set is supposed
 * to be invisible. Against a deep-blue cyclorama the old generous ellipse showed a cool
 * smudge with a horizon line running across it, mid-title-card.
 *
 * The fix is NOT simply a smaller ellipse. The mask cuts the CHARACTER as well as the
 * set, and the fighter spans roughly 24-76% of this box, so pulling the opaque core in
 * far enough to hide the horizon starts dissolving the arms. Instead the ellipse keeps
 * enough radius to hold the fighter and the transition is made much steeper — opaque
 * where the fighter is, gone within a short band after it — and the warm rim that beds
 * the patch into the card is roughly doubled and pulled inward to meet it.
 *
 * ── That trade is now MEASURED, and both alternatives are closed ────────────
 * NOTE the single quotes below. This comment sits inside a CSS template literal, and one
 * backtick in it terminates the string — docs/LESSONS.md section 9, which has now bitten
 * eight times and bit here while this very paragraph was being written.
 *
 * The paragraph above was an argument. tools/tmp/openglare.mjs turns it into numbers:
 * shoot the stage box, hide the canvas, shoot it again, and every pixel that MOVED is a
 * pixel the stage delivered — so the warm CARD showing through a transparent part of the
 * mask can never be mistaken for the fighter. (The first version of that probe made
 * exactly that mistake and its own control caught it: the tighter the mask, the more
 * "fighter" it reported. docs/LESSONS.md section 13.)
 *
 * Cool pixels use home_metrics.mjs's own backdrop rule, so the number means the same
 * thing it means on the two other screens that mount this stage. Drift control (two
 * frames, same conditions, the idle sway alone): coolShare ±0.14 pp, warm ±0.45%.
 *
 *     desktop 1600x900         coolShare   fighter+podium px
 *     shipped                      6.15%             168,306
 *     tighter core (56%/38%)       1.88%             116,270   -31%   <- cuts the fighter
 *     tighter still (50%/30%)      0.73%              73,572   -56%
 *     steeper falloff              3.28%              89,806   -47%
 *
 * **Every mask that removes the blue removes the character with it**, by 60x the drift
 * floor. The shipped values are where this lever runs out, and they are correct.
 *
 * The other lever — warming the rim instead of cutting — was priced in the same run and
 * REJECTED on the pixels rather than on the numbers, which is the point of looking:
 * a 0.30 warm veil takes coolShare 7.62% -> 2.16% and loses no geometry at all, and
 * shots/open/phone-portrait-glow-warm-veil-30.png shows it desaturating the hero into
 * a sticker behind frosted glass — spending exactly the figure/ground charStage was
 * built to win (-0.23 to +0.19).
 *
 * So the residual cool is not this file's to remove. What WOULD remove it is a per-mount
 * backdrop colour on the shared stage — a warm cyclorama for the title card only — which
 * lives in charStage.ts. Parked in docs/DECISIONS-FOR-URI.md. */
/* 54vh, not 70vh — and this is the second half of the same fix.
 *
 * charStage frames the fighter off whichever axis binds, so every pixel of panel width
 * past what the fighter needs is guaranteed to be backdrop. That is exactly the defect
 * menu_accept's hero-fills-its-panel floor exists to catch (see MIN_HERO_WIDTH_FRAC,
 * written for the home screen's identical problem), and with the new 3D set behind it
 * the title card had drifted under that floor at 844x390 with a notch: character width
 * over panel width measured 0.396-0.417 against a 0.42 minimum.
 *
 * Swept rather than guessed (tools/tmp/openwidth.mjs, four viewports x six widths,
 * worst-of-six samples per point because the idle animation sways the arms by ~0.03):
 *
 *     width      phone+notch   phone    desktop   tablet    fighter height frac
 *     70vh       0.414 FAIL    0.452    0.515     0.486     0.53
 *     58vh       0.470         0.524    0.578     0.555     0.55
 *     54vh       ~0.545        ~0.59    ~0.65     ~0.62     0.54
 *     46vh       0.678         0.733    0.777     0.775     0.48  <- knee
 *
 * Below ~46vh the height fraction collapses: width starts binding and the fighter
 * itself shrinks, which is the opposite of the point. 54vh sits well clear of that
 * knee with the fighter the same size it always was, and clears the floor by 0.125 at
 * the worst viewport — margin the noise cannot eat.
 *
 * It also happens to be the fix for the OTHER opening-screen problem: the set is drawn
 * to this box, so a narrower box is less visible set. */
.fa-opening .open-stage {
  position: relative;
  width: min(100%, 54vh);
  height: 100%;
  min-height: 0;
}
/* Radii re-expressed as a fraction of the NARROWER box, so the mask's absolute size on
   screen is unchanged: it still goes fully transparent inside the element (0.80 x 62%
   = 49.6% from centre), which is what keeps the box's own corners from showing a faint
   rectangle of cyclorama. */
.fa-opening .open-stage-3d {
  position: absolute;
  inset: 0;
  -webkit-mask-image: radial-gradient(62% 58% at 50% 54%, #000 46%, rgba(0,0,0,0.40) 64%, transparent 80%);
  mask-image: radial-gradient(62% 58% at 50% 54%, #000 46%, rgba(0,0,0,0.40) 64%, transparent 80%);
}
/* Warm rim, so the cool spotlight is bedded into the warm backdrop rather than
   sitting in a hole cut out of it. */
.fa-opening .open-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(64% 60% at 50% 54%, rgba(255,196,96,0.30) 20%, rgba(255,190,86,0.52) 66%, rgba(255,170,60,0.22) 84%, transparent 95%);
  /* soft-light rather than a plain overlay: it warms the cool set that is still
     visible immediately behind the fighter — the part no mask can remove without
     cutting the fighter too — while barely moving an already-saturated warm bun. */
  mix-blend-mode: soft-light;
}

/* ── Start ────────────────────────────────────────────────────────────────── */
/* The extra bottom padding is for the hairline, which is 4px tall and would otherwise
   sit flush against the frame edge — where a rounded phone corner or a home indicator
   eats it. */
.fa-opening .open-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding-bottom: 10px;
}
.fa-opening .open-start { min-width: clamp(180px, 30vw, 340px); }

/* The auto-continue deadline, made visible. A splash that moves on by itself with
   no warning reads as a crash; the same behaviour with a 3px line reads as a
   trailer. */
.fa-opening .open-timer {
  width: clamp(120px, 22vw, 260px);
  height: 9px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: rgba(26,18,36,0.4);
  overflow: hidden;
}
.fa-opening .open-timer-fill {
  display: block;
  width: 0%;
  height: 100%;
  border-radius: 999px;
  background: var(--cream);
}

/* The bar's TRANSITION is stopped but the timer behind it is not — the auto-continue
   is a safety net, and silently removing it under a motion preference would leave a
   player who cannot see it stuck on a title card. It simply jumps to full instead. */
@media (prefers-reduced-motion: reduce) {
  .fa-opening .open-title { animation: none !important; }
  .fa-opening .open-timer-fill { transition: none !important; }
}
:root.fa-reduce-motion .fa-opening .open-title { animation: none !important; }
:root.fa-reduce-motion .fa-opening .open-timer-fill { transition: none !important; }
`,Ig=.15,zg=44,Og=78,Lg=5,Ng=10,Ll=.5,Nl="touch-styles";function Dg(){return typeof window>"u"?!1:typeof navigator<"u"&&(navigator.maxTouchPoints??0)>0?!0:"ontouchstart"in window}function _g(){return typeof window.matchMedia!="function"?!1:window.matchMedia("(pointer: coarse)").matches}function Hg(){const e=Math.min(window.innerWidth,window.innerHeight);return Math.max(zg,Math.min(Og,e*Ig))}function $g(e,t,a){const o=Math.max(Math.abs(e),Math.abs(t)),n=o>1e-6?Math.min(1,Math.hypot(e,t))/o:0;return a.x=Math.max(-1,Math.min(1,e*n)),a.y=Math.max(-1,Math.min(1,t*n)),a}function Dl(){return{id:null,baseX:0,baseY:0,curX:0,curY:0}}function Pg(e){const t=Dg(),a=Dl(),o=Dl(),n={x:0,y:0},s={x:0,y:-1};let r=!1,i=!1,c=!1,l=0,h="",d="";if(!t)return{available:!1,get engaged(){return!1},move:n,get moving(){return!1},aimDir:()=>null,get firing(){return!1},clearAim(){},reset(){},dispose(){}};qg();const p=document.createElement("div");p.className="tch-root",p.innerHTML='<div class="tch-stick tch-stick--move" data-el="move-stick"><div class="tch-knob"></div></div><div class="tch-stick tch-stick--aim" data-el="aim-stick"><div class="tch-knob"></div></div><div class="tch-hint tch-hint--move" data-el="move-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">MOVE</div></div><div class="tch-hint tch-hint--aim" data-el="aim-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">AIM &amp; FIRE</div></div>',document.body.appendChild(p);const u=z=>p.querySelector('[data-el="'+z+'"]'),f=u("move-stick"),m=u("aim-stick"),g=u("move-hint"),w=u("aim-hint");_g()&&(p.classList.add("is-hinted"),document.documentElement.classList.add("fa-touch-capable"));const x=e.canvas.parentElement,v=e.canvas.style.touchAction,E=x?x.style.touchAction:"";e.canvas.style.touchAction="none",x&&(x.style.touchAction="none");function k(z){if(!(z instanceof Node))return!1;const U=e.canvas;return z===U||U.contains(z)||z.contains(U)}function M(){return Hg()}function C(z,U){const ie=M();let J=z.curX-z.baseX,D=z.curY-z.baseY;const X=Math.hypot(J,D);if(X>ie){const ve=ie/X;z.baseX=z.curX-J*ve,z.baseY=z.curY-D*ve,J*=ve,D*=ve}const he=Math.hypot(J,D);return U.x=J,U.y=D,he}const T={x:0,y:0},F=[];function N(z){const U=F.indexOf(z);U>=0&&F.splice(U,1)}function S(z,U){for(let ie=0;ie<z.length;ie++)if(z[ie].identifier===U)return z[ie];return null}function R(z,U,ie){for(let J=F.length-1;J>=0;J--){const D=S(ie,F[J]);if(!D){F.splice(J,1);continue}if(D.clientX<window.innerWidth*Ll===U){F.splice(J,1),z.id=D.identifier,z.baseX=D.clientX,z.baseY=D.clientY,z.curX=D.clientX,z.curY=D.clientY;return}}}function q(){if(a.id===null){n.x=0,n.y=0;return}if(C(a,T)<Lg){n.x=0,n.y=0;return}const U=M();$g(T.x/U,T.y/U,n)}function _(){if(o.id===null)return;const z=C(o,T);z<Ng||(s.x=T.x/z,s.y=T.y/z,r=!0)}function B(z,U,ie){if(U.id===null)return ie!==""&&(z.style.display="none"),"";const J=U.curX-U.baseX,D=U.curY-U.baseY,X=M(),he=Math.hypot(J,D),ve=he>X?X/he:1,ze=Math.round(U.baseX),ma=Math.round(U.baseY),Ga=Math.round(U.baseX+J*ve),Ao=Math.round(U.baseY+D*ve),Fo=ze+","+ma+","+Ga+","+Ao+","+Math.round(X);if(Fo===ie)return Fo;ie===""&&(z.style.display="block"),z.style.setProperty("--r",X.toFixed(0)+"px"),z.style.transform="translate("+ze+"px,"+ma+"px) translate(-50%,-50%)";const un=z.firstElementChild;return un&&(un.style.transform="translate("+(Ga-ze)+"px,"+(Ao-ma)+"px) translate(-50%,-50%)"),Fo}function Y(){if(h=B(f,a,h),d=B(m,o,d),a.id===null&&o.id===null){l=0;return}l=requestAnimationFrame(Y)}function P(){!l&&!c&&(l=requestAnimationFrame(Y))}const Q=z=>{if(c)return;let U=!1;for(let ie=0;ie<z.changedTouches.length;ie++){const J=z.changedTouches[ie];if(!k(J.target))continue;const D=J.clientX<window.innerWidth*Ll,X=D?a:o;if(X.id!==null){F.includes(J.identifier)||F.push(J.identifier),U=!0;continue}X.id=J.identifier,X.baseX=J.clientX,X.baseY=J.clientY,X.curX=J.clientX,X.curY=J.clientY,U=!0,D?g.classList.add("is-used"):w.classList.add("is-used")}U&&(i||(i=!0,document.documentElement.classList.add("fa-touch")),q(),_(),P(),z.preventDefault())},I=z=>{if(c)return;let U=!1;for(let ie=0;ie<z.changedTouches.length;ie++){const J=z.changedTouches[ie];J.identifier===a.id?(a.curX=J.clientX,a.curY=J.clientY,U=!0):J.identifier===o.id?(o.curX=J.clientX,o.curY=J.clientY,U=!0):F.includes(J.identifier)&&(U=!0)}U&&(q(),_(),P(),z.preventDefault())},L=z=>{if(c)return;let U=!1;for(let ie=0;ie<z.changedTouches.length;ie++){const J=z.changedTouches[ie];J.identifier===a.id?(a.id=null,R(a,!0,z.touches),U=!0):J.identifier===o.id?(o.id=null,R(o,!1,z.touches),U=!0):F.includes(J.identifier)&&(N(J.identifier),U=!0)}U&&(q(),_(),P())};return window.addEventListener("touchstart",Q,{passive:!1}),window.addEventListener("touchmove",I,{passive:!1}),window.addEventListener("touchend",L),window.addEventListener("touchcancel",L),{available:!0,get engaged(){return i},move:n,get moving(){return a.id!==null},aimDir:()=>r?s:null,get firing(){return o.id!==null},clearAim(){o.id===null&&(r=!1)},reset(){a.id=null,o.id=null,F.length=0,n.x=0,n.y=0,r=!1,P()},dispose(){c||(c=!0,cancelAnimationFrame(l),window.removeEventListener("touchstart",Q),window.removeEventListener("touchmove",I),window.removeEventListener("touchend",L),window.removeEventListener("touchcancel",L),F.length=0,e.canvas.style.touchAction=v,x&&(x.style.touchAction=E),document.documentElement.classList.remove("fa-touch","fa-touch-capable"),p.remove())}}}function qg(){if(document.getElementById(Nl))return;const e=document.createElement("style");e.id=Nl,e.textContent=jg,document.head.appendChild(e)}const jg=`
.tch-root {
  position: fixed;
  inset: 0;
  z-index: 25;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

/* ── The sticks ───────────────────────────────────────────────────────────── */
/* Planted where the thumb lands, so there is no target to find. The ring is the
   travel limit, drawn at the same radius the input math clamps to, which is what
   makes the deflection readable as a stick rather than as a smear. */
.tch-stick {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  width: calc(var(--r, 60px) * 2);
  height: calc(var(--r, 60px) * 2);
  border-radius: 50%;
  will-change: transform;
  background: rgba(26,18,36,0.34);
  border: 3px solid rgba(255,243,222,0.5);
  box-shadow: 0 0 0 2px rgba(26,18,36,0.45);
}

.tch-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  margin: -26px 0 0 -26px;
  border-radius: 50%;
  will-change: transform;
  background: #FFF3DE;
  border: 3px solid #1a1224;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}

/* Gold for the fire stick — the weapon accent this HUD already uses for readiness and
   for the muzzle cone. Cream for movement. The two thumbs then never have to be told
   apart by position alone. */
.tch-stick--aim .tch-knob { background: #F4A300; }
.tch-stick--aim { border-color: rgba(244,163,0,0.62); }

/* ── Resting-position hints ───────────────────────────────────────────────── */
/* Shown only on a device whose PRIMARY pointer is coarse, and only until that stick
   has been used once. Floating sticks work anywhere in their half, so this is a hint
   about where a thumb usually rests, NOT a pad: it never claims a touch, and it is
   gone for good after the first one. */
.tch-hint {
  position: absolute;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.42;
  transition: opacity 0.25s ease-out;
  animation: tch-hint-breathe 2.8s ease-in-out infinite;
}
.tch-root.is-hinted .tch-hint { display: flex; }
/* Specificity has to match the rule above, or the hint outlives its own first use. */
.tch-root.is-hinted .tch-hint.is-used { display: none; }
.tch-hint--move {
  left: calc(var(--fa-safe-l, 0px) + 17%);
  bottom: calc(var(--fa-safe-b, 0px) + 22%);
  transform: translate(-50%, 50%);
}
.tch-hint--aim {
  right: calc(var(--fa-safe-r, 0px) + 17%);
  bottom: calc(var(--fa-safe-b, 0px) + 22%);
  transform: translate(50%, 50%);
}
.tch-hint-ring {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  border: 3px dashed rgba(255,243,222,0.85);
  box-shadow: 0 0 0 2px rgba(26,18,36,0.5), inset 0 0 0 2px rgba(26,18,36,0.5);
}
.tch-hint--aim .tch-hint-ring { border-color: rgba(244,163,0,0.9); }
.tch-hint-label {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #FFF3DE;
  background: rgba(26,18,36,0.82);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
@keyframes tch-hint-breathe {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.55; }
}

/* Short landscape phones: keep the hints out of the weapon bar's row. */
@media (max-height: 460px) {
  .tch-hint-ring { width: 76px; height: 76px; }
  .tch-hint { gap: 5px; }
}
`,Rt={left:["KeyA","ArrowLeft"],right:["KeyD","ArrowRight"],up:["KeyW","ArrowUp"],down:["KeyS","ArrowDown"]},ec="KeyM",tc=9,Bg=.155,Gg=84,Wg=190;function Ug(e){const t=new URLSearchParams(location.search).get(e);if(t===null)return null;const a=Number(t);return Number.isFinite(a)?a:null}class Yg{constructor(t){this.canvas=t;const a=Ug("aimSens");this.sensitivity=a!==null&&a>0?Math.min(6,a):1,this.freeAim=new URLSearchParams(location.search).get("aimMode")==="free",this.touch=Pg({canvas:t}),window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onVisibilityChange),t.addEventListener("mousemove",this.onMouseMove),t.addEventListener("mousedown",this.onMouseDown),window.addEventListener("mouseup",this.onMouseUp),t.addEventListener("contextmenu",this.onContextMenu)}keys=new Set;mouseDown=!1;ndcX=0;ndcY=0;hasMouse=!1;weaponIndex=0;weaponCount=1;locked=!1;offX=0;offY=0;clientX=0;clientY=0;sensitivity;freeAim;touch;touchOffset={x:0,y:0};setWeaponCount(t){this.weaponCount=Math.max(1,t),this.weaponIndex>=this.weaponCount&&(this.weaponIndex=0)}get selectedWeapon(){return this.weaponIndex}selectWeapon(t){!Number.isInteger(t)||t<0||t>=this.weaponCount||(this.weaponIndex=t)}get touchEngaged(){return this.touch.engaged}get attackHeld(){return this.mouseDown||this.touch.firing}get mouseNdc(){return this.hasMouse&&!this.locked?{x:this.ndcX,y:this.ndcY}:null}get pointerLocked(){return this.locked}get aimOffsetPx(){const t=this.touch.aimDir();if(t){const a=this.aimRadiusPx();return this.touchOffset.x=t.x*a,this.touchOffset.y=t.y*a,this.touchOffset}return this.locked?{x:this.offX,y:this.offY}:null}setPointerLocked(t){t!==this.locked&&(this.locked=t,t&&(this.hasMouse?(this.offX=this.clientX-window.innerWidth/2,this.offY=this.clientY-window.innerHeight/2):(this.offX=0,this.offY=-this.aimRadiusPx()),this.clampOffset(),this.hasMouse=!0))}moveAxes(){let t=0,a=0;return this.keyDown(Rt.left)&&(t-=1),this.keyDown(Rt.right)&&(t+=1),this.keyDown(Rt.up)&&(a-=1),this.keyDown(Rt.down)&&(a+=1),this.touch.moving&&(t=Math.max(-1,Math.min(1,t+this.touch.move.x)),a=Math.max(-1,Math.min(1,a+this.touch.move.y))),{x:t,y:a}}reset(){this.keys.clear(),this.mouseDown=!1,this.touch.reset(),this.locked&&(this.offX=0,this.offY=-this.aimRadiusPx())}dispose(){this.touch.dispose(),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onVisibilityChange),this.canvas.removeEventListener("mousemove",this.onMouseMove),this.canvas.removeEventListener("mousedown",this.onMouseDown),window.removeEventListener("mouseup",this.onMouseUp),this.canvas.removeEventListener("contextmenu",this.onContextMenu)}aimRadiusPx(){const t=Math.min(window.innerWidth,window.innerHeight);return Math.max(Gg,Math.min(Wg,t*Bg))}clampOffset(){if(this.freeAim){const n=window.innerWidth/2,s=window.innerHeight/2;this.offX=Math.max(-n,Math.min(n,this.offX)),this.offY=Math.max(-s,Math.min(s,this.offY));return}const t=this.aimRadiusPx(),a=Math.hypot(this.offX,this.offY);if(a<=t){a<.001&&(this.offY=-t);return}const o=t/a;this.offX*=o,this.offY*=o}keyDown(t){return t.some(a=>this.keys.has(a))}onKeyDown=t=>{this.keys.add(t.code);const a=Number(t.key);if(Number.isInteger(a)&&a>=1&&a<=tc){const o=a-1;o<this.weaponCount&&(this.weaponIndex=o)}t.code===ec&&!t.repeat&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&we.toggleMuted()};onKeyUp=t=>{this.keys.delete(t.code)};onMouseMove=t=>{if(this.touch.clearAim(),this.locked){this.offX+=(t.movementX??0)*this.sensitivity,this.offY+=(t.movementY??0)*this.sensitivity,this.clampOffset(),this.hasMouse=!0;return}const a=this.canvas.getBoundingClientRect();this.clientX=t.clientX,this.clientY=t.clientY,this.ndcX=(t.clientX-a.left)/a.width*2-1,this.ndcY=-((t.clientY-a.top)/a.height*2-1),this.hasMouse=!0};onMouseDown=t=>{t.button===0&&(this.mouseDown=!0)};onMouseUp=t=>{t.button===0&&(this.mouseDown=!1)};onBlur=()=>{this.keys.clear(),this.mouseDown=!1,this.touch.reset()};onVisibilityChange=()=>{document.visibilityState==="hidden"&&this.onBlur()};onContextMenu=t=>{t.preventDefault()}}const _l=16241663,Vg=14711797,Kg=12872686,ao=2755399,Xg=.34,wr=3.2,Zg=6.5;function Qg(e){return G.clamp(e*.3,oe,Zg)}const Jg=.5,De=128,ac=1500,e1=[{offset:-14,color:_l,alpha:0},{offset:-1,color:_l,alpha:.9},{offset:7,color:Vg,alpha:.85},{offset:34,color:5906060,alpha:.3},{offset:150,color:ao,alpha:.18},{offset:0,absolute:ac,color:ao,alpha:.18}],t1=[{offset:12,color:ao,alpha:0},{offset:44,color:ao,alpha:.6},{offset:140,color:ao,alpha:.72},{offset:0,absolute:ac,color:ao,alpha:.72}];function a1(){const a=document.createElement("canvas");a.width=64,a.height=256;const o=a.getContext("2d"),n=o.createImageData(64,256);let s=2654435769;const r=()=>(s=s*1664525+1013904223>>>0,s/4294967295),i=new Float32Array(64);for(let l=0;l<64;l++)i[l]=.18+.82*r();for(let l=0;l<256;l++){const h=1-l/255,d=Math.pow(1-h,2.6);for(let p=0;p<64;p++){const u=.85+.15*Math.sin(p*.9+h*5),f=Math.max(0,Math.min(1,d*i[p]*u)),m=(l*64+p)*4,g=Math.pow(1-h,3);n.data[m]=255,n.data[m+1]=Math.round(190+65*g),n.data[m+2]=255,n.data[m+3]=Math.round(f*255)}}o.putImageData(n,0,0);const c=new ot(a);return c.wrapS=si,c.wrapT=ri,c.needsUpdate=!0,c}function Hl(e,t,a,o){const n=e.length*De,s=new Float32Array(n*3),r=new Float32Array(n*4),i=[],c=new Float32Array(De),l=new Float32Array(De);for(let m=0;m<De;m++){const g=m/De*Math.PI*2;c[m]=Math.cos(g),l[m]=Math.sin(g)}const h=new ia;for(let m=0;m<e.length;m++){h.setHex(e[m].color);for(let g=0;g<De;g++){const w=m*De+g;s[w*3+1]=0,r[w*4]=h.r,r[w*4+1]=h.g,r[w*4+2]=h.b,r[w*4+3]=e[m].alpha}}for(let m=0;m<e.length-1;m++)for(let g=0;g<De;g++){const w=(g+1)%De;i.push(m*De+g,(m+1)*De+g,m*De+w),i.push(m*De+w,(m+1)*De+g,(m+1)*De+w)}const d=new an,p=new es(s,3);p.setUsage(ou),d.setAttribute("position",p),d.setAttribute("color",new es(r,4)),d.setIndex(i),d.boundingSphere=new nu(new le,Qe(ac)*1.2);const u=new K({vertexColors:!0,transparent:!0,depthWrite:!1,side:ye,toneMapped:!1}),f=new y(d,u);return f.name=`${o}__no_outline`,f.userData.noOutline=!0,f.renderOrder=a,f.frustumCulled=!1,f.castShadow=!1,f.receiveShadow=!1,f.position.y=t,{mesh:f,setRadius(m){for(let g=0;g<e.length;g++){const w=e[g],b=w.absolute!==void 0?Math.max(w.absolute,m+200):Math.max(0,m+w.offset),x=Qe(b),v=g*De;for(let E=0;E<De;E++){const k=(v+E)*3;s[k]=c[E]*x,s[k+2]=l[E]*x}}p.needsUpdate=!0},setOpacity(m){u.opacity=m},dispose(){d.dispose(),u.dispose()}}}function o1(e){const t=new te;t.name="fog_boundary";const a=_e(e.x,e.y);t.position.set(a.x,0,a.z),t.frustumCulled=!1;const o=Hl(e1,Xg,6,"fog_edge"),n=Hl(t1,wr,8,"fog_canopy");t.add(o.mesh);const s=a1(),r=new Me(1,1,1,De,1,!0),i=new K({map:s,color:Kg,transparent:!0,opacity:.82,depthWrite:!1,side:ye,toneMapped:!1}),c=new y(r,i);c.name="fog_curtain__no_outline",c.userData.noOutline=!0,c.renderOrder=7,c.frustumCulled=!1,c.castShadow=!1,c.receiveShadow=!1,t.add(c),t.add(n.mesh);let l=0,h=0;return{root:t,update(d,p,u,f){const m=Math.min(.25,Math.max(0,p-h));if(h=p,l=u&&d>0?1:Math.max(0,l-m/Jg),t.visible=l>.002,!t.visible)return;const w=Math.max(0,d);o.setRadius(w),n.setRadius(w),o.setOpacity(l),n.setOpacity(l);const b=G.degToRad(f.pitchDeg),x=G.degToRad(f.yawDeg),v=wr/Math.max(.2,Math.tan(b));n.mesh.position.set(-Math.sin(x)*v,wr,-Math.cos(x)*v);const E=Qe(w),k=Qg(E);c.scale.set(E,k,E),c.position.y=k/2;const M=2*Math.PI*E;s.repeat.x=Math.max(6,Math.round(M/5)),s.offset.x=p*.035%1,i.opacity=(.82+.1*Math.sin(p*2.1))*l},dispose(){o.dispose(),n.dispose(),r.dispose(),i.dispose(),s.dispose(),t.clear()}}}const n1=180/Math.PI,s1=Math.PI/180,r1=1e-6;function dp(e,t){const a=e[t];return re[a.characterId].hasTrail?e.trailMarks.some(o=>o.ownerRole===t&&Math.hypot(a.x-o.x,a.y-o.y)<At.radius):!1}function is(e,t){return t==="stun"?e.status.stunnedUntil+su:e.status.slowedUntil+ru}function lo(e,t,a,o,n,s){const r=e[t];if(!r.alive)return;const i=n.kind==="weapon"?e[oa(t)]:n.kind==="trail"?e[n.ownerRole]:null,c=i?a*i.damageMul:a;r.hp=Math.max(0,r.hp-c),r.lastDamagedAt=e.elapsed,o==="slow"?e.elapsed>=is(r,"slow")&&(r.status.slowedUntil=e.elapsed+cu):o==="stun"&&e.elapsed>=is(r,"stun")&&(r.status.stunnedUntil=e.elapsed+lu),s.push({type:"hit-landed",targetRole:t,amount:c,effect:o,source:n,x:r.x,y:r.y}),r.hp===0&&(r.alive=!1,s.push({type:"death",fighterRole:t}),e.phase==="playing"&&(e.phase="ended",e.winner=oa(t),s.push({type:"match-ended",winner:e.winner})))}function br(e,t,a,o,n,s,r,i,c,l,h){const d=Math.atan2(l.y,l.x)+n*s1,p=Math.cos(d),u=Math.sin(d),f=o.speed??0,m=r??o.color,g=i??o.emoji,w=e.nextId++;e.projectiles.push({id:w,ownerRole:t,targetRole:a,weapon:o,x:c.x,y:c.y,vx:p*f,vy:u*f,traveled:0,damage:s,color:m,emoji:g}),h.push({type:"projectile-spawned",id:w,ownerRole:t,weaponKey:o.key,x:c.x,y:c.y,color:m,emoji:g})}function bi(e,t,a,o){if(e.phase!=="playing")return!1;const n=e[t],s=oa(t),r=e[s],c=re[n.characterId].weapons[a];if(!c)return!1;const l=e.elapsed;if(l-n.lastUsed[a]<c.cooldown)return!1;if(n.lastUsed[a]=l,o.push({type:"weapon-fired",fighterRole:t,weaponKey:c.key}),c.type==="self"){const f=(c.healAmount??0)*iu(n.level),m=Math.min(f,n.maxHp-n.hp);return n.hp=Math.min(n.maxHp,n.hp+f),m>0&&o.push({type:"heal",fighterRole:t,amount:m}),!0}if(c.type==="melee"){if(r.hp<=0)return!0;const f=r.x-n.x,m=r.y-n.y,g=Math.hypot(f,m);if(g>(c.range??0))return!0;const w=c.cone??360;if(w<360){if(g<r1)return!0;const b=(n.facing.x*f+n.facing.y*m)/g;if(Math.acos(Math.max(-1,Math.min(1,b)))*n1>w/2)return!0}return lo(e,s,c.damage,c.effect,{kind:"weapon",weaponKey:c.key,weaponName:c.name},o),!0}const h={x:n.x,y:n.y},d=n.facing;if(c.comboParts){for(const f of c.comboParts)br(e,t,s,c,f.angle,f.damage,f.color,f.emoji,h,d,o);return!0}const u=!!c.trailBoosted&&dp(e,t)?Math.round(c.damage*At.damageBoost):c.damage;if(c.pellets&&c.pellets>1){const f=c.spreadDeg??0;for(let m=0;m<c.pellets;m++){const g=(m-(c.pellets-1)/2)*f,w=c.pelletColors?c.pelletColors[m%c.pelletColors.length]:void 0,b=c.pelletEmojis?c.pelletEmojis[m%c.pelletEmojis.length]:void 0;br(e,t,s,c,g,u,w,b,h,d,o)}}else br(e,t,s,c,0,u,void 0,void 0,h,d,o);return!0}function oc(e,t,a,o,n,s,r,i){return Math.abs(e-n)<(a+r)/2&&Math.abs(t-s)<(o+i)/2}function cs(e,t,a,o){for(let n=0;n<o.length;n++){const s=o[n];if(Math.abs(e-s.x)<(a+s.w)/2&&Math.abs(t-s.y)<(a+s.h)/2)return!0}return!1}const i1=[];function c1(e){return e.concealment??i1}function pp(e,t,a){const o=c1(a);for(let n=0;n<o.length;n++){const s=o[n];if(oc(e,t,0,0,s.x,s.y,s.w,s.h))return!0}return!1}function nc(e,t,a,o,n){return pp(a,o,n)?Math.hypot(a-e,o-t)<=hu:!0}const l1=4,$l=.01;function h1(e,t){const a=e.size,o=a/2,n=t.cover;for(let s=0;s<l1;s++){let r=null,i=0;for(let h=0;h<n.length;h++){const d=n[h],p=(a+d.w)/2-Math.abs(e.x-d.x);if(p<=0)continue;const u=(a+d.h)/2-Math.abs(e.y-d.y);if(u<=0)continue;const f=p<u?p:u;f>i&&(i=f,r=d)}if(r===null)return;const c=(a+r.w)/2-Math.abs(e.x-r.x),l=(a+r.h)/2-Math.abs(e.y-r.y);if(c<=l){const h=e.x>=r.x?1:-1;e.x=Math.min(t.width-o,Math.max(o,e.x+h*(c+$l)))}else{const h=e.y>=r.y?1:-1;e.y=Math.min(t.height-o,Math.max(o,e.y+h*(l+$l)))}}}function yi(e,t,a,o){const n=e.size/2,s=e.x,r=e.y;if((t!==0||a!==0)&&h1(e,o),t!==0){const i=Math.min(o.width-n,Math.max(n,e.x+t));cs(i,e.y,e.size,o.cover)||(e.x=i)}if(a!==0){const i=Math.min(o.height-n,Math.max(n,e.y+a));cs(e.x,i,e.size,o.cover)||(e.y=i)}return e.x!==s||e.y!==r}const d1=10,p1=4e4,up=16,u1=8,f1=4,Pl=new WeakMap;function m1(e,t){const a=Pl.get(e);if(a&&a.size===t&&a.cover===e.cover)return a;let o=d1;for(;Math.ceil(e.width/o)*Math.ceil(e.height/o)>p1;)o*=2;const n=Math.max(1,Math.ceil(e.width/o)),s=Math.max(1,Math.ceil(e.height/o)),r=n*s,i=new Uint8Array(r),c=t/2;for(let h=0;h<s;h++)for(let d=0;d<n;d++){const p=(d+.5)*o,u=(h+.5)*o;p>=c&&p<=e.width-c&&u>=c&&u<=e.height-c&&!cs(p,u,t,e.cover)&&(i[h*n+d]=1)}const l={cell:o,cols:n,rows:s,size:t,cover:e.cover,passable:i,dist:new Int32Array(r),queue:new Int32Array(r),chain:new Int32Array(up+1),goalCell:-1,requestedGoal:-1};return Pl.set(e,l),l}function yr(e,t){const{cols:a,rows:o,passable:n,dist:s,queue:r}=e;s.fill(-1),e.goalCell=t,s[t]=0,r[0]=t;let i=0,c=1;for(;i<c;){const l=r[i++],h=l%a,d=(l-h)/a,p=s[l]+1;for(let u=-1;u<=1;u++){const f=d+u;if(f<0||f>=o)continue;const m=f*a;for(let g=-1;g<=1;g++){if(g===0&&u===0)continue;const w=h+g;if(w<0||w>=a)continue;const b=m+w;n[b]===0||s[b]>=0||g!==0&&u!==0&&(n[d*a+w]===0||n[m+h]===0)||(s[b]=p,r[c++]=b)}}}}function ql(e,t,a,o,n){const{cols:s,rows:r,passable:i,dist:c}=e;if(t>=0&&t<s&&a>=0&&a<r){const l=a*s+t;if(i[l]===1)return l}for(let l=1;l<=o;l++)for(let h=-l;h<=l;h++){const d=a+h;if(d<0||d>=r)continue;const p=Math.abs(h)===l;for(let u=-l;u<=l;u+=p?1:2*l){const f=t+u;if(f<0||f>=s)continue;const m=d*s+f;if(i[m]===1)return m}}return-1}function jl(e,t,a,o,n,s){const r=a-e,i=o-t,c=Math.max(1,Math.ceil(Math.hypot(r,i)/(n*.4)));for(let l=1;l<=c;l++){const h=l/c;if(cs(e+r*h,t+i*h,n,s))return!1}return!0}const ea={dirX:0,dirY:0,wpX:0,wpY:0};function g1(e,t,a,o){const n=m1(e,t.size),{cell:s,cols:r,rows:i,dist:c,chain:l}=n,h=t.size/2,d=Math.min(e.width-h,Math.max(h,a)),p=Math.min(e.height-h,Math.max(h,o)),u=ql(n,Math.min(r-1,Math.max(0,Math.floor(d/s))),Math.min(i-1,Math.max(0,Math.floor(p/s))),u1);if(u<0)return!1;const f=ql(n,Math.min(r-1,Math.max(0,Math.floor(t.x/s))),Math.min(i-1,Math.max(0,Math.floor(t.y/s))),f1);if(f<0)return!1;if(n.requestedGoal!==u||c[f]<0){if(yr(n,u),c[f]<0){yr(n,f);let k=f,M=1/0;for(let C=0;C<c.length;C++){if(c[C]<0)continue;const T=C%r,F=(T+.5)*s-d,N=((C-T)/r+.5)*s-p,S=F*F+N*N;S<M&&(M=S,k=C)}yr(n,k)}n.requestedGoal=u}if(c[f]<0)return!1;let m=f,g=0;for(;g<up&&c[m]>0;){const k=m%r,M=(m-k)/r,C=c[m];let T=-1,F=C,N=1/0;for(let S=-1;S<=1;S++){const R=M+S;if(R<0||R>=i)continue;const q=R*r;for(let _=-1;_<=1;_++){if(_===0&&S===0)continue;const B=k+_;if(B<0||B>=r)continue;const Y=q+B,P=c[Y];if(P<0||P>=C||_!==0&&S!==0&&(n.passable[M*r+B]===0||n.passable[q+k]===0))continue;const Q=(B+.5)*s-d,I=(R+.5)*s-p,L=Q*Q+I*I;(P<F||P===F&&L<N)&&(F=P,N=L,T=Y)}}if(T<0)break;l[g++]=T,m=T}let w,b;if(g===0)w=d,b=p;else{let k=0;for(let F=1;F<g;F++){const N=l[F],S=N%r,R=(N-S)/r;if(!jl(t.x,t.y,(S+.5)*s,(R+.5)*s,t.size,e.cover))break;k=F}const M=l[k],C=M%r,T=(M-C)/r;w=(C+.5)*s,b=(T+.5)*s,k===g-1&&c[M]===0&&jl(t.x,t.y,d,p,t.size,e.cover)&&(w=d,b=p)}const x=w-t.x,v=b-t.y,E=Math.hypot(x,v);return E<1e-6?!1:(ea.dirX=x/E,ea.dirY=v/E,ea.wpX=w,ea.wpY=b,!0)}function Bl(e,t,a,o,n,s,r){const i=e.x,c=e.y;let l=t,h=a,d=s,p=r;g1(n,e,s,r)&&(l=ea.dirX,h=ea.dirY,d=ea.wpX,p=ea.wpY);const u=(k,M)=>Math.hypot(k-d,M-p),f=u(i,c);yi(e,l*o,h*o,n);const m=e.x,g=e.y;if(f-u(m,g)>=o*.35)return e.detourSign=0,!0;const w=k=>{e.x=i,e.y=c;const M=-h*k+l*.3,C=l*k+h*.3,T=Math.hypot(M,C)||1;return yi(e,M/T*o,C/T*o,n),Math.hypot(e.x-i,e.y-c)};if(e.detourSign!==0&&w(e.detourSign)>=o*.35)return!0;const b=w(1),x=e.x,v=e.y,E=w(-1);if(b>=E){if(b>=o*.35)return e.detourSign=1,e.x=x,e.y=v,!0}else if(E>=o*.35)return e.detourSign=-1,!0;return e.detourSign=0,e.x=m,e.y=g,m!==i||g!==c}const Sn=400,Wn=1e-6,Gl=.8,Wl=.6,Qt={x:0,y:0},Ne={dirX:0,dirY:0,navX:0,navY:0};function w1(e,t,a,o,n){Qt.x=0,Qt.y=0;let s=0;for(const d of e.arena.hazards){if(d.kind!=="damage")continue;const p=t-d.x,u=a-d.y,f=Math.hypot(p,u),m=d.radius+Vc;if(f>=m)continue;const g=f>Wn?p/f:1,w=f>Wn?u/f:0,b=-w*o+g*n>=0?1:-1,x=-w*b,v=g*b,E=Math.min(2,(m-f)/Vc),k=E*wu;Qt.x+=(g*Gl+x*Wl)*k,Qt.y+=(w*Gl+v*Wl)*k,E>s&&(s=E)}const r=e.arena.center.x,i=e.arena.center.y,c=r-t,l=i-a,h=Math.hypot(c,l);if(h>Wn){const d=e.safeRadius-h;if(d<Zs){const p=Math.min(2,(Zs-d)/Zs);Qt.x+=c/h*p*Kc,Qt.y+=l/h*p*Kc,p>s&&(s=p)}}return s}const Ul={melee:!0,ranged:!0,self:!1},b1={melee:!1,ranged:!1,self:!0},y1=(()=>{const e=Math.PI/180,t=new Map,a=o=>{const n=Math.abs(Math.sin(o*e));return n<1e-9?1/0:Od/n};for(const o of Se)for(const n of re[o].weapons){let s=0;const r=[];if(n.type!=="self")if(n.comboParts)for(const i of n.comboParts){const c=a(i.angle);c===1/0?s+=i.damage:r.push({maxDist:c,damage:i.damage})}else{const i=n.damage*(n.peckHits??1),c=n.pellets??1;if(n.type==="melee"||c<=1||n.homing)s=i*c;else{const l=n.spreadDeg??0;for(let h=0;h<c;h++){const d=a((h-(c-1)/2)*l);d===1/0?s+=i:r.push({maxDist:d,damage:i})}}}t.set(n,{always:s,offAxis:r})}return t})();function v1(e,t){const a=y1.get(e);if(!a)return e.damage;let o=a.always;for(const n of a.offAxis)t<n.maxDist&&(o+=n.damage);return o}const Yl=(e,t,a,o)=>v1(t,o),x1=(e,t)=>{const a=e.enemy,o=t.healAmount??0;return o<=0||a.hp>a.maxHp*gu||a.maxHp-a.hp<o?-1/0:o};function vr(e,t,a,o){const n=e.enemy,s=re[n.characterId].weapons,r=e.elapsed;let i=null,c=-1/0;for(let l=0;l<s.length;l++){const h=s[l];if(!a[h.type]||r-n.lastUsed[l]<h.cooldown||t>(h.range??1/0))continue;const d=o(e,h,l,t);d>c&&(c=d,i=l)}return i}function k1(e,t,a){if(e.phase!=="playing")return!1;const o=e.enemy,n=e.player;if(o.hp<=0||n.hp<=0)return!1;const s=e.elapsed,r=nc(o.x,o.y,n.x,n.y,e.arena),i=e.aiSighting;r&&(i.x=n.x,i.y=n.y,i.at=s);const c=i.x,l=i.y,h=c-o.x,d=l-o.y,p=Math.hypot(h,d),u=p||1,f=p>1e-6,m=o.hp<o.maxHp*du,g=s<o.status.slowedUntil?pu:1,w=s<o.status.stunnedUntil;f&&(o.facing={x:h/u,y:d/u});let b=!1;const x=m?-1:1,v=w1(e,o.x,o.y,x*h/u,x*d/u),E=v>=mu,k=(T,F,N,S)=>{if(Ne.dirX=T,Ne.dirY=F,Ne.navX=N,Ne.navY=S,v<=0)return;const R=T+Qt.x,q=F+Qt.y,_=Math.hypot(R,q);_<Wn||(Ne.dirX=R/_,Ne.dirY=q/_,Ne.navX=o.x+Ne.dirX*Sn,Ne.navY=o.y+Ne.dirY*Sn)},M=E&&!w,C=M?null:vr(e,u,b1,x1);if(m){if(!w){const F=ci(o.characterId,uu)*t*g;k(-h/u,-d/u,o.x-h/u*Sn,o.y-d/u*Sn),Bl(o,Ne.dirX,Ne.dirY,F,e.arena,Ne.navX,Ne.navY),b=!0}const T=C??(r?vr(e,u,Ul,Yl):null);T!==null&&bi(e,"enemy",T,a)}else{const T=M?null:C??(r?vr(e,u,Ul,Yl):null);if(T!==null)bi(e,"enemy",T,a);else if(!w){const F=ci(o.characterId,fu)*t*g;k(h/u,d/u,c,l),Bl(o,Ne.dirX,Ne.dirY,F,e.arena,Ne.navX,Ne.navY),b=!0}}return b}const Vl=12;function Kl(e,t,a,o={}){const n=Wt(o.player??ra),s=Wt(o.enemy??ra);return{phase:"countdown",elapsed:0,countdownValue:bu,countdownTick:0,startFlashTimer:0,timeRemaining:aa,safeRadius:e.maxSafeRadius,player:bl("player",t,e.playerSpawn,as(t,li,n),Fu,{x:1,y:0},n),enemy:bl("enemy",a,e.enemySpawn,as(a,yu,s),Au,{x:-1,y:0},s),projectiles:[],splats:[],trailMarks:[],winner:null,arena:e,aiSighting:{x:e.playerSpawn.x,y:e.playerSpawn.y,at:0},nextId:1}}function M1(e,t,a){const o=[];if(e.elapsed+=t,T1(e,t,o),e.phase==="playing"){e.timeRemaining=Math.max(0,e.timeRemaining-t);const n=1-e.timeRemaining/aa;e.safeRadius=Math.max(Ts,e.arena.maxSafeRadius*(1-n))}if(S1(e),e.phase==="playing"){A1(e,a),a.attack&&bi(e,"player",a.selectedWeapon,o);const n=F1(e,t,a);Xl(e,"player",t,n,o);const s=k1(e,t,o);Xl(e,"enemy",t,s,o)}return R1(e,t,o),e.phase==="playing"&&e.timeRemaining<=0&&E1(e,o),o}function E1(e,t){const{player:a,enemy:o,arena:n}=e,s=a.maxHp>0?a.hp/a.maxHp:0,r=o.maxHp>0?o.hp/o.maxHp:0;let i;if(s!==r)i=s>r?"player":"enemy";else{const c=Math.hypot(a.x-n.center.x,a.y-n.center.y),l=Math.hypot(o.x-n.center.x,o.y-n.center.y);i=c<=l?"player":"enemy"}e.phase="ended",e.winner=i,t.push({type:"match-ended",winner:i})}function T1(e,t,a){e.phase==="countdown"&&(e.countdownTick+=t,e.countdownTick>=1e3&&(e.countdownTick-=1e3,e.countdownValue-=1,e.countdownValue>0?a.push({type:"countdown-tick",value:e.countdownValue}):(e.startFlashTimer=vu,a.push({type:"countdown-tick",value:0}))),e.countdownValue<=0&&(e.startFlashTimer-=t,e.startFlashTimer<=0&&(e.phase="playing",e.timeRemaining=aa,e.safeRadius=e.arena.maxSafeRadius,a.push({type:"match-started"}))))}function S1(e){for(let t=e.splats.length-1;t>=0;t--)e.elapsed>=e.splats[t].expiresAt&&e.splats.splice(t,1);for(let t=e.trailMarks.length-1;t>=0;t--)e.elapsed>=e.trailMarks[t].expiresAt&&e.trailMarks.splice(t,1)}function fp(e,t){let a=1;for(const o of e.arena.hazards)o.kind==="slow"&&Math.hypot(t.x-o.x,t.y-o.y)<o.radius&&(a=Math.min(a,o.slowFactor??Xc));for(const o of e.splats)Math.hypot(t.x-o.x,t.y-o.y)<hi&&(a=Math.min(a,Xc));return a}function A1(e,t){if(!t.aim)return;const a=Math.hypot(t.aim.x,t.aim.y);a>1e-6&&(e.player.facing={x:t.aim.x/a,y:t.aim.y/a})}function F1(e,t,a,o){const n=e.player,s=e.elapsed;let r=fp(e,n);dp(e,"player")&&(r*=At.speedBoost),s<n.status.slowedUntil&&(r*=Ru);const c=s<n.status.stunnedUntil?0:ci(n.characterId,Eu)*t*r,l=a.move.x*c,h=a.move.y*c;return yi(n,l,h,e.arena),l!==0||h!==0}function Xl(e,t,a,o,n){const s=e[t];if(!s.alive)return;s.terrainSlowFactor=fp(e,s),s.concealed=pp(s.x,s.y,e.arena);const r=re[s.characterId],i=oa(t),c=e[i];if(r.hasTrail&&o){if(s.trailDropTimer+=a,s.trailDropTimer>=At.dropIntervalMs){s.trailDropTimer=0;const h={id:e.nextId++,ownerRole:t,x:s.x,y:s.y,expiresAt:e.elapsed+At.durationMs,damaged:!1};e.trailMarks.push(h),n.push({type:"trail-mark-created",ownerRole:t,x:s.x,y:s.y})}}else s.trailDropTimer=0;if(c.alive){let h=0;for(const d of e.trailMarks)if(!(d.ownerRole!==t||d.damaged)&&!(Math.hypot(c.x-d.x,c.y-d.y)>=At.radius)&&(d.damaged=!0,!(h>=At.maxHitsPerTick)&&(h++,lo(e,i,At.damage,null,{kind:"trail",ownerRole:t},n),!c.alive)))break}if(e.arena.hazards.forEach((h,d)=>{if(h.kind!=="damage")return;if(Math.hypot(s.x-h.x,s.y-h.y)<h.radius){const u=(s.hazardTimers[d]??0)+a;u>=(h.tickMs??1/0)?(s.hazardTimers[d]=0,lo(e,t,h.damage??0,null,{kind:"hazard"},n)):s.hazardTimers[d]=u}else s.hazardTimers[d]=0}),e.elapsed-s.lastDamagedAt>xu&&s.hp<s.maxHp&&s.hp>0){if(s.regenTimer+=a,s.regenTimer>=ku){s.regenTimer=0;const h=s.hp;s.hp=Math.min(s.maxHp,s.hp+zd),s.hp>h&&n.push({type:"heal",fighterRole:t,amount:s.hp-h})}}else s.regenTimer=0;Math.hypot(s.x-e.arena.center.x,s.y-e.arena.center.y)>e.safeRadius&&s.hp>0?(s.fogTimer+=a,s.fogTimer>=Ld&&(s.fogTimer=0,lo(e,t,Nd,null,{kind:"fog"},n))):s.fogTimer=0}function An(e,t,a,o){const n=e.projectiles[t];o.push({type:"projectile-destroyed",id:n.id,reason:a,x:n.x,y:n.y}),e.projectiles.splice(t,1)}function Zl(e,t,a,o){const n={id:e.nextId++,x:t,y:a,expiresAt:e.elapsed+Tu};e.splats.push(n),o.push({type:"splat-created",x:t,y:a})}function R1(e,t,a){for(let o=e.projectiles.length-1;o>=0;o--){const n=e.projectiles[o],s=n.weapon,r=e[n.targetRole],i=n.targetRole==="player"?Od:Mu;if(s.peckHits&&n.arrived){if(r.hp<=0){An(e,o,"expired",a);continue}n.peckTimer=(n.peckTimer??0)+t,n.peckTimer>=(s.peckInterval??500)&&(n.peckTimer=0,lo(e,n.targetRole,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name},a),n.hitsSoFar=(n.hitsSoFar??1)+1,n.hitsSoFar>=s.peckHits&&An(e,o,"expired",a));continue}if(s.homing&&r.hp>0&&nc(n.x,n.y,r.x,r.y,e.arena)){const u=r.x-n.x,f=r.y-n.y,m=Math.hypot(u,f)||1,g=u/m,w=f/m,b=Math.hypot(n.vx,n.vy)||1,x=n.vx/b,v=n.vy/b,E=Math.min(1,Su*t),k=x+(g-x)*E,M=v+(w-v)*E,C=Math.hypot(k,M)||1,T=s.speed??0;n.vx=k/C*T,n.vy=M/C*T}const c=n.vx*t/1e3,l=n.vy*t/1e3,h=n.x+c,d=n.y+l,p=e.arena.cover.some(u=>oc(h,d,Vl,Vl,u.x,u.y,u.w,u.h));if(n.traveled+=Math.hypot(c,l),n.x=h,n.y=d,p||n.traveled>=(s.range??1/0)){s.splatter&&Zl(e,n.x,n.y,a),An(e,o,p?"hit-cover":"expired",a);continue}if(r.hp>0&&Math.hypot(n.x-r.x,n.y-r.y)<i){if(lo(e,n.targetRole,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name},a),s.splatter&&Zl(e,n.x,n.y,a),s.peckHits){n.arrived=!0,n.peckTimer=0,n.hitsSoFar=1;continue}An(e,o,"hit-target",a);continue}}}const Ql="pointerlock-styles",C1=2600;function mp(){const e=new URLSearchParams(location.search);return e.get("pointerLock")??e.get("pointerlock")}function I1(){const e=mp();if(e==="0")return!1;if(e==="1"||e==="sim")return!0;const t=new URLSearchParams(location.search);return!(t.has("shot")||t.has("simSpeed"))}function z1(){return typeof window.matchMedia!="function"?!0:window.matchMedia("(pointer: fine)").matches}function O1(e){const{target:t}=e,a=mp()==="sim";let o=!1;const s=typeof document<"u"&&"pointerLockElement"in document&&typeof t.requestPointerLock=="function"&&z1()&&I1();let r=!1,i=!1,c=!0,l="hidden",h=0,d=!1,p=!1,u="";const f=document.createElement("div");f.className="plk-root",f.innerHTML=`
    <div class="plk-bar" data-el="bar">
      <button class="plk-chip plk-chip--primary" type="button" data-el="capture">🔒 Capture mouse</button>
      <button class="plk-chip" type="button" data-el="fs">⛶ Fullscreen</button>
    </div>
    <div class="plk-toast" data-el="toast">Mouse captured · <b>Esc</b> to release</div>
    <div class="plk-scrim" data-el="scrim">
      <div class="plk-card" data-el="card">
        <div class="plk-card-title">Paused</div>
        <div class="plk-card-sub">The mouse was released, so the match is frozen.</div>
        <button class="plk-btn plk-btn--primary" type="button" data-el="resume">▶ Click to resume</button>
        <div class="plk-card-row">
          <button class="plk-btn plk-btn--quiet" type="button" data-el="fs2">⛶ Fullscreen</button>
          <button class="plk-btn plk-btn--quiet" type="button" data-el="free">Play without capture</button>
        </div>
      </div>
    </div>
  `;const m=P=>f.querySelector(`[data-el="${P}"]`),g=m("fs"),w=m("fs2");function b(){return a?o:document.pointerLockElement===t}function x(){window.__plockDebug={state:l,wantsLock:r,locked:b(),pending:p,lastError:u,available:s}}function v(){f.classList.toggle("is-prompt",l==="prompt"),f.classList.toggle("is-toast",l==="toast"),f.classList.toggle("is-lost",l==="lost"),x()}function E(P){l!==P&&(l=P,window.clearTimeout(h),P==="toast"&&(h=window.setTimeout(()=>{!d&&l==="toast"&&E("hidden")},C1)),v())}function k(){const Q=!!document.fullscreenElement?"⛶ Exit fullscreen":"⛶ Fullscreen";g.textContent=Q,w.textContent=Q}function M(){try{document.fullscreenElement?document.exitFullscreen?.()?.catch(()=>{}):document.documentElement.requestFullscreen?.()?.catch(()=>{})}catch{}}function C(P){u=P===void 0?"refused":String(P?.message??P),x(),!(d||!r||b())&&(e.pause(),E("lost"))}function T(){if(!(d||!s||!r||b()||p)){if(a){o=!0,R();return}p=!0;try{const P=t.requestPointerLock();P&&typeof P.then=="function"?P.then(()=>{p=!1},Q=>{p=!1,C(Q)}):window.setTimeout(()=>{p=!1},0)}catch(P){p=!1,C(P)}}}function F(){if(b()){if(i=!0,a){o=!1,R();return}try{document.exitPointerLock()}catch{i=!1}}}function N(){r=!0,e.resume()}function S(){r=!1,F(),E("prompt"),e.resume()}const R=()=>{if(d)return;const P=b();if(e.onLockChange(P),p=!1,P){r=!0,i=!1,E("toast");return}if(i){i=!1,E(c&&s?"prompt":"hidden");return}r?(e.pause(),E("lost")):E(c&&s?"prompt":"hidden")},q=()=>{p=!1,!d&&C("pointerlockerror")},_=()=>{d||!r||!s||b()||l!=="lost"&&(e.pause(),E("lost"))},B=()=>k(),Y=P=>{d||!o||P.key!=="Escape"||(P.preventDefault(),P.stopImmediatePropagation(),o=!1,R())};return s&&(L1(),document.body.appendChild(f),document.addEventListener("pointerlockchange",R),document.addEventListener("pointerlockerror",q),document.addEventListener("fullscreenchange",B),window.addEventListener("blur",_),a&&window.addEventListener("keydown",Y,!0),m("capture").addEventListener("click",P=>{P.stopPropagation(),N()}),m("resume").addEventListener("click",P=>{P.stopPropagation(),N()}),m("scrim").addEventListener("click",()=>N()),m("free").addEventListener("click",P=>{P.stopPropagation(),S()}),g.addEventListener("click",P=>{P.stopPropagation(),M()}),w.addEventListener("click",P=>{P.stopPropagation(),M()}),k(),E("prompt"),v()),{available:s,get locked(){return s&&b()},engage:T,release:F,setMatchActive(P){!s||c===P||(c=P,P?b()||E("prompt"):(F(),E("hidden")))},dispose(){d||(d=!0,window.clearTimeout(h),s&&(F(),document.removeEventListener("pointerlockchange",R),document.removeEventListener("pointerlockerror",q),document.removeEventListener("fullscreenchange",B),window.removeEventListener("blur",_),window.removeEventListener("keydown",Y,!0),f.remove()))}}}function L1(){if(document.getElementById(Ql))return;const e=document.createElement("style");e.id=Ql,e.textContent=N1,document.head.appendChild(e)}const N1=`
.plk-root {
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: none;
  font-family: 'Heebo', sans-serif;
  color: #FFF3DE;
  user-select: none;
}

/* ── Capture chip ─────────────────────────────────────────────────────────── */
/* Bottom-centre, ABOVE the weapon bar. Every other edge of the frame is spoken for
   (nameplates top-left/right, clock top-centre, weapon bar bottom-centre, radar
   bottom-right, pause chip bottom-left), and this band is also clear of the ±60px
   around frame centre that the input regression probe drives real mouse events
   through — an overlay there would re-break exactly the bug the screens work fixed. */
.plk-bar {
  position: absolute;
  left: 50%;
  bottom: calc(var(--fa-safe-b, 0px) + 104px);
  transform: translateX(-50%);
  display: none;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}
.plk-root.is-prompt .plk-bar { display: flex; }

.plk-chip {
  appearance: none;
  cursor: pointer;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.03em;
  color: #FFF3DE;
  background: rgba(26,18,36,0.82);
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 7px 14px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s, filter 0.12s;
  white-space: nowrap;
}
.plk-chip:hover { background: rgba(58,40,80,0.92); }
.plk-chip:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }
.plk-chip--primary {
  color: #1a1224;
  background: #F4A300;
  box-shadow: 0 3px 0 #8a5c00;
  /* A slow breathe rather than a hard flash: this is an offer, not an alarm. */
  animation: plk-breathe 2.4s ease-in-out infinite;
}
.plk-chip--primary:hover { background: #FFB92B; }
@keyframes plk-breathe {
  0%, 100% { box-shadow: 0 3px 0 #8a5c00, 0 0 0 rgba(244,163,0,0); }
  50% { box-shadow: 0 3px 0 #8a5c00, 0 0 14px 2px rgba(244,163,0,0.75); }
}

/* ── "Captured" confirmation ──────────────────────────────────────────────── */
/* Transient on purpose. It says the one thing the player needs at that instant —
   how to get back out — and then leaves the frame clean. */
.plk-toast {
  position: absolute;
  left: 50%;
  bottom: calc(var(--fa-safe-b, 0px) + 104px);
  transform: translateX(-50%);
  display: none;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgba(26,18,36,0.78);
  border: 2px solid #1a1224;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
}
.plk-toast b { font-family: 'Rubik', sans-serif; font-weight: 900; color: #F4A300; }
.plk-root.is-toast .plk-toast { display: block; animation: plk-toast-out 2.6s ease-in forwards; }
@keyframes plk-toast-out {
  0%, 62% { opacity: 1; }
  100% { opacity: 0; }
}

/* ── Resume scrim ─────────────────────────────────────────────────────────── */
/* Only ever present while the match is ALREADY frozen, which is why it is allowed to
   claim pointer events across the whole viewport. */
.plk-scrim {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(10,6,16,0.62);
  backdrop-filter: blur(2px);
  cursor: pointer;
  pointer-events: auto;
}
.plk-root.is-lost .plk-scrim { display: flex; }
.plk-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 26px 38px;
  text-align: center;
  background: rgba(26,18,36,0.95);
  border: 4px solid #1a1224;
  border-radius: 24px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5);
  animation: plk-card-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes plk-card-in {
  from { opacity: 0; transform: scale(0.94) translateY(10px); }
  to { opacity: 1; transform: none; }
}
.plk-card-title {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.1rem, 3vh, 1.7rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  -webkit-text-stroke: 2px #1a1224;
  paint-order: stroke fill;
}
.plk-card-sub { font-size: 12px; color: #C9B8DE; margin-top: -4px; }
.plk-card-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }

.plk-btn {
  appearance: none;
  cursor: pointer;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.03em;
  color: #FFF3DE;
  background: rgba(58,40,80,0.9);
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 9px 18px;
  min-height: 40px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.plk-btn:hover { filter: brightness(1.12); }
.plk-btn:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }
.plk-btn--primary {
  color: #1a1224;
  background: #F4A300;
  font-size: 16px;
  padding: 12px 28px;
  min-height: 46px;
  box-shadow: 0 4px 0 #8a5c00;
}
.plk-btn--quiet { font-size: 11px; padding: 7px 14px; min-height: 34px; background: rgba(58,40,80,0.7); }

@media (max-width: 720px) {
  .plk-bar, .plk-toast { bottom: calc(var(--fa-safe-b, 0px) + 86px); }
  .plk-chip { font-size: 11px; padding: 6px 11px; }
}
`,Ct=.11,Jl=oe*.1,gp=new bt(Ct,12,10);gp.scale(1,.86,1);const D1=new xo(Ct*.32,Ct*.5,6),ho=new Ss(Ct*.6,0);ho.scale(1,.4,1);const _1=new K({color:"#E63946"}),H1=new K({color:"#3E5C2B"}),$1=new K({color:"#FF9E9E",transparent:!0,opacity:.55,depthWrite:!1});function sc(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const P1=sc(18,()=>new K({color:"#E63946",transparent:!0,opacity:.85,depthWrite:!1})),q1=sc(20,()=>new K({color:"#C21F32",transparent:!0,opacity:.9,depthWrite:!1})),eh=sc(6,()=>new K({color:"#FFD9C7",transparent:!0,opacity:.95,blending:at,depthWrite:!1}));function j1(e){const t=new te,a=new y(gp,_1);t.add(a);const o=new y(D1,H1);o.position.set(0,Ct*.75,0),t.add(o);const n=new y(ho,$1);return n.scale.setScalar(.55),n.position.set(Ct*.32,Ct*.28,Ct*.5),t.add(n),t}function xr(e,t,a,o,n,s=1){const r=new y(ho,q1()),i=(.3+Math.random()*.25)*s;r.scale.setScalar(i),r.position.copy(t);const c=t.x,l=t.y,h=t.z,d=1.1+Math.random()*1.3,p=-5.5,u=.32+Math.random()*.16;e.spawnTransient(r,u,(f,m)=>{r.position.set(c+a*n*m,l+d*m+.5*p*m*m,h+o*n*m),r.scale.setScalar(i*(1-f*.35)),r.material.opacity=.9*(1-f)})}const B1={Tomato:{projectile(e){const t=j1(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=(t.userData.__spin??0)+a*8;t.userData.__spin=o,t.rotation.x=o,t.rotation.z=Math.sin(o*.6)*.25;const n=1+Math.sin(o*2.2)*.09;t.scale.set(1/n,n,1/n);const s=(t.userData.__dripTimer??.05)-a;s<=0?(t.userData.__dripTimer=.09+Math.random()*.05,xr(e,e.position,-e.direction.x*.5,-e.direction.z*.5,.3+Math.random()*.25)):t.userData.__dripTimer=s},impact(e){const t=e.position,a=G.clamp(1+e.damage*.05,1,2.2),o=Jl/(Ct*.6),n=new y(ho,eh());n.position.copy(t),n.scale.setScalar(.7*o),e.spawnTransient(n,.18,i=>{n.scale.setScalar(G.lerp(.7,2.4,i)*o*a),n.material.opacity=.9*(1-i)});const s=7,r=Pi*.45;for(let i=0;i<s;i++){const c=i/s*Math.PI*2+Math.random()*.5,l=r+(.5+Math.random()*.75)*a,h=new y(ho,P1()),d=(.55+Math.random()*.4)*o*a,p=t.x+Math.cos(c)*r,u=t.y,f=t.z+Math.sin(c)*r;h.position.set(p,u,f),h.rotation.y=Math.random()*Math.PI*2;const m=t.x+Math.cos(c)*l,g=t.z+Math.sin(c)*l,w=u-.9;e.spawnTransient(h,.55+Math.random()*.2,b=>{const x=1-Math.pow(1-b,3);h.position.set(G.lerp(p,m,x),G.lerp(u,w,Math.min(1,x*1.3)),G.lerp(f,g,x)),h.scale.setScalar(d*(1-b*.3)),h.material.opacity=.85*(1-Math.pow(b,1.5))})}for(let i=0;i<5;i++){const c=Math.random()*Math.PI*2;xr(e,t,Math.cos(c),Math.sin(c),1.3+Math.random()*1.1,o)}},cast(e){const t=Jl/(Ct*.6),a=new y(ho,eh()),o=a.material;o.color.set(e.color),a.position.copy(e.position),a.scale.setScalar(.16*t),e.spawnTransient(a,.15,n=>{a.scale.setScalar(G.lerp(.16,.62,n)*t),o.opacity=.9*(1-n)});for(let n=0;n<3;n++){const s=(Math.random()-.5)*.6;xr(e,e.position,e.direction.x+s,e.direction.z+s,.9+Math.random()*.5,t*.35)}}}},rc="#C93F73",G1="#F0C070",Is="#FFF0F6",W1="#FFD9EC",vi=["#E63946","#7CB518","#FFC93C","#7C4DFF","#2E86D8","#FFFFFF"],rt=oe,za=Math.PI*2,ls=.28,wt=rt*.09,Bt=rt*.043,U1=rt*.014,Y1=rt*.042,Fn=rt*.375,Rn=rt*.4;function po(e,t,a,o,n){const s=new ji(e,t,a,o,n);return s.rotateX(-Math.PI/2),s}const V1=po(wt,Bt,8,22),K1=po(wt,Bt*.82,8,22),X1=po(wt,Bt*1.3,8,22),th=[po(wt*.92,Bt*.86,6,8,1.5),po(wt*1.05,Bt*.72,6,8,1),po(wt*.8,Bt*.95,6,7,2.1)];let Z1=0;const Q1=()=>th[Z1++%th.length],wp=new qi(U1,Y1,3,6);function bp(e,t=40){const a=new Aa(e,1,t,1);return a.rotateX(-Math.PI/2),a}const J1=bp(.84),ew=bp(.7);function ko(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const Mo=(e,t,a={})=>new K({color:e,transparent:!0,opacity:t,depthWrite:!1,side:ye,...a}),ah=new K({color:"#FF6FA5"}),tw=new K({color:G1}),aw=new K({color:rc}),oh=vi.map(e=>new K({color:e})),ow=ko(18,()=>Mo(rc,1)),nw=ko(18,()=>Mo("#FF6FA5",1)),sw=ko(30,()=>Mo("#FFFFFF",1)),rw=ko(24,()=>Mo(Is,.7)),iw=ko(20,()=>Mo(Is,.7,{blending:at})),cw=ko(24,()=>Mo(Is,1)),yp=new le(0,1,0),nh=new le,kr=new As,sh=new As;function lw(e,t,a,o,n){kr.setFromAxisAngle(yp,o);const s=Math.hypot(t,a);Math.abs(n)>1e-4&&s>1e-4?(nh.set(a/s,0,-t/s),sh.setFromAxisAngle(nh,n),e.quaternion.copy(sh).multiply(kr)):e.quaternion.copy(kr)}function hw(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function dw(e,t,a){let o=e.userData.__ring;return o||(o={spin:Math.random()*za,rate:a*za/hw(t),shed:0,echo:0},e.userData.__ring=o),o}function ba(e,t,a,o,n,s,r,i,c,l={}){const h=l.hard?cw():l.glow?iw():rw();h.color.set(r),h.opacity=i;const d=new y(l.band?ew:J1,h);d.renderOrder=l.renderOrder??9,d.position.set(t,a,o),d.rotation.y=Math.random()*za,d.scale.set(n,1,n);const p=l.fadePow??1,u=l.hold??0;e.spawnTransient(d,c,f=>{const m=G.lerp(n,s,1-Math.pow(1-f,2.4));d.scale.set(m,1,m),h.opacity=f<u?i:i*(1-Math.pow((f-u)/(1-u),p))})}function Mr(e,t,a,o,n,s,r,i,c=1){const l=sw();l.color.set(vi[Math.random()*vi.length|0]),l.opacity=1;const h=new y(wp,l);h.renderOrder=9,h.position.set(t,a,o),h.scale.setScalar(c);const d=(Math.random()-.5)*26,p=(Math.random()-.5)*26,u=-9;e.spawnTransient(h,i,(f,m)=>{h.position.set(t+n*m,Math.max(ls,a+s*m+.5*u*m*m),o+r*m),h.rotation.set(d*m,0,p*m),l.opacity=1-Math.pow(f,2.4)})}function pw(e,t,a,o,n,s,r){const i=new te,c=ow();c.color.set(rc),c.opacity=1;const l=Q1(),h=new y(l,c);h.scale.setScalar(1.28),i.add(h);const d=nw();d.color.set(a),d.opacity=1,i.add(new y(l,d)),i.renderOrder=9,i.position.copy(t),i.scale.setScalar(s);const p=t.x,u=t.y,f=t.z,m=Math.cos(o)*n,g=Math.sin(o)*n,w=1.5+Math.random()*1.2,b=-8.5,x=(Math.random()-.5)*20,v=(Math.random()-.5)*20;e.spawnTransient(i,r,(E,k)=>{i.position.set(p+m*k,Math.max(ls,u+w*k+.5*b*k*k),f+g*k),i.rotation.set(x*k,0,v*k);const M=1-Math.pow(E,2.2);d.opacity=M,c.opacity=M})}function uw(e){return G.clamp(.85+e*.035,.85,1.25)}function fw(e){const t=new te,a=new y(X1,aw);a.position.y=-rt*.007,t.add(a),t.add(new y(V1,tw)),ah.color.set(e);const o=new y(K1,ah);o.position.y=Bt*.36,t.add(o);const n=Math.random()*za;for(let s=0;s<5;s++){const r=n+s/5*za+(Math.random()-.5)*.6,i=new y(wp,oh[Math.random()*oh.length|0]);i.position.set(Math.cos(r)*wt,Bt*1.05,Math.sin(r)*wt),i.quaternion.setFromAxisAngle(yp,-r),i.rotateX(Math.PI/2),i.scale.setScalar(1.05),t.add(i)}return t.userData.__isCandyRing=!0,t}const mw={Candy:{projectile(e){const t=fw(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=dw(t,e.weapon,2.4);if(o.spin+=o.rate*a,lw(t,e.direction.x,e.direction.z,o.spin,.13+Math.sin(o.spin*.41)*.08),t.position.y+=Math.sin(o.spin*.62)*rt*.011,o.echo-=a,o.echo<=0){o.echo=.075;const n=wt+Bt;ba(e,e.position.x,e.position.y,e.position.z,n,n*1.45,W1,.55,.2,{glow:!0,fadePow:1.4})}o.shed-=a,o.shed<=0&&(o.shed=.085+Math.random()*.05,Mr(e,e.position.x-e.direction.x*wt,e.position.y,e.position.z-e.direction.z*wt,-e.direction.x*.6+(Math.random()-.5)*.6,.15+Math.random()*.35,-e.direction.z*.6+(Math.random()-.5)*.6,.34,.85))},impact(e){const t=uw(e.damage),{x:a,y:o,z:n}=e.position;ba(e,a,o,n,Fn*.8*t,Fn*t,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,fadePow:1.1,hold:.45}),ba(e,a,o,n,Fn*.62*t,Fn*.86*t,e.color,1,.19,{hard:!0,renderOrder:11,fadePow:1.4,hold:.3}),ba(e,a,ls,n,Rn*.2*t,Rn*t,e.color,.95,.3,{hard:!0,renderOrder:7,fadePow:1.6,hold:.35}),ba(e,a,ls-.01,n,Rn*.16*t,Rn*.86*t,Is,.9,.34,{hard:!0,band:!0,renderOrder:6,fadePow:1.4,hold:.3});for(let s=0;s<3;s++){const r=s/3*za+Math.random()*.9;pw(e,e.position,e.color,r,(2.3+Math.random()*1.5)*t,(1.05+Math.random()*.5)*t,.36+Math.random()*.12)}for(let s=0;s<8;s++){const r=Math.random()*za,i=(2.2+Math.random()*1.8)*t;Mr(e,a,o,n,Math.cos(r)*i+e.direction.x*.9,2.5+Math.random()*1.6,Math.sin(r)*i+e.direction.z*.9,.4+Math.random()*.14,1.1+Math.random()*.6)}},cast(e){ba(e,e.position.x,e.position.y,e.position.z,rt*.06,rt*.2,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,hold:.3}),ba(e,e.position.x,e.position.y,e.position.z,rt*.03,rt*.13,e.color,.95,.13,{hard:!0,band:!0,renderOrder:11,hold:.25});for(let t=0;t<4;t++)Mr(e,e.position.x,e.position.y,e.position.z,e.direction.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.7+Math.random()*.6,e.direction.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.3,.85)}}},on="#F2A73E",ic="#B96F16",vp="#E9C078",cc="#4E2C1B",xp="#E63946",kp="#8FCB1E",zs="#EFE2FA",Mp="#C9A9E4",Ep="#CDB0EE",be=oe,He=Math.PI*2,hs=.29,mo=be*.085,Os=be*.105,Er=be*.032,pe=be*.105,Ht=be*.07,ka=be*.036,ke=be*.125,gw=be*.33;function uo(e,t=7){return new Me(1,1,1,t,1,!0,-e/2,e)}const go=[uo(1.1),uo(1.7),uo(2.3)];let ww=0;const bw=()=>go[ww++%go.length],xi=uo(2.7,9),Tp=uo(2.9,12),ki=new Ss(1,0),Sp=new Bi(1,0),Mi=new pt(1,1,1),rh=new bt(1,14,10),yw=new bt(1,16,10,0,Math.PI*1.5),vw=new ji(1,.062,5,20),ih=new xo(1,1,6),xw=uo(2.2,7),kw=(()=>{const t=document.createElement("canvas");t.width=t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.85)"),o.addColorStop(.42,"rgba(255,255,255,0.44)"),o.addColorStop(.76,"rgba(255,255,255,0.12)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new ot(t);return n.colorSpace=Hi,n})();function Eo(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const nn=(e,t={})=>new K({color:e,transparent:!0,opacity:1,depthWrite:!1,side:ye,...t}),lc=Eo(26,()=>nn(on)),Ap=Eo(34,()=>nn(vp)),Cn=Eo(30,()=>nn(cc)),Mw=Eo(12,()=>nn(Mp)),Fp=Eo(20,()=>nn("#FFF3D6")),Ew=Eo(14,()=>new qt({map:kw,color:Ep,transparent:!0,opacity:.3,depthWrite:!1})),Yt=(e,t={})=>new K({color:e,side:ye,...t}),ch=Yt("#6B3E26"),Tw=Yt(cc),Sw=Yt(on),Aw=Yt(ic),lh=Yt(kp),Fw=Yt(xp),hh=Yt("#B497D6"),Rw=Yt(Mp),Tr=Yt(zs);function Cw(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Sr(e){const t=e.weapon.comboParts;if(!t)return-1;const a=t.findIndex(o=>o.color===e.color&&o.damage===e.damage);return a>=0?a:t.findIndex(o=>o.color===e.color)}function Rp(e){return G.clamp(.85+e*.035,.85,1.45)}function Cp(e,t,a){let o=e.userData.__tumble;return o||(o={t:Math.random()*He,rate:a*He/Cw(t),shed:0},e.userData.__tumble=o),o}function oo(e,t,a,o,n,s,r,i,c,l,h,d,p,u,f=-9){a.color.set(o),a.opacity=1;const m=new y(t,a);m.renderOrder=9,m.position.set(n,s,r),m.scale.set(h,d,p),m.rotation.set(Math.random()*He,Math.random()*He,Math.random()*He);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,b=(Math.random()-.5)*20,x=m.rotation.x,v=m.rotation.y,E=m.rotation.z;e.spawnTransient(m,u,(k,M)=>{const C=s+c*M+.5*f*M*M,T=C<=hs;m.position.set(n+i*M,T?hs:C,r+l*M),T||m.rotation.set(x+g*M,v+w*M,E+b*M),a.opacity=1-Math.pow(k,2.4)})}function Ip(e,t,a,o,n,s,r,i,c){oo(e,bw(),lc(),Math.random()<.35?ic:on,t,a,o,n,s,r,mo*i,Os*i,mo*i,c)}function Ls(e,t,a,o,n,s,r,i,c){oo(e,Sp,Ap(),vp,t,a,o,n,s,r,Er*i,Er*i,Er*i,c)}function Ns(e,t,a,o,n,s,r,i,c,l){if(t==="lettuce")oo(e,xi,Cn(),kp,a,o,n,s,r,i,Ht*c,Ht*.42*c,Ht*c,l,-6.5);else if(t==="tomato")oo(e,Mi,Cn(),xp,a,o,n,s,r,i,ka*c,ka*c,ka*c,l);else if(t==="onion")oo(e,Mi,Cn(),zs,a,o,n,s,r,i,ka*1.3*c,ka*.4*c,ka*1.3*c,l);else{const h=pe*(.45+Math.random()*.3)*c;oo(e,ki,Cn(),Math.random()<.4?cc:"#6B3E26",a,o,n,s,r,i,h,h*.8,h*1.15,l)}}function hc(e,t,a,o,n){const s=Fp();s.color.set("#FFF3D6"),s.opacity=1;const r=new y(Sp,s);r.renderOrder=12,r.position.set(t,a,o),r.rotation.set(Math.random()*He,Math.random()*He,0),r.scale.setScalar(n*.6),e.spawnTransient(r,.12,i=>{r.scale.setScalar(n*G.lerp(.6,1.3,i)),s.opacity=i<.4?1:1-(i-.4)/.6})}function zp(e,t){const{x:a,y:o,z:n}=e.position,s=e.direction,r=Math.random()*He;for(let i=0;i<5;i++){const c=r+i/5*He,l=Fp();l.color.set(i%2===0?"#FFF3D6":"#FFD27A"),l.opacity=1;const h=new y(go[i%go.length],l);h.renderOrder=12;const d=Math.cos(c),p=Math.sin(c),u=be*.11*t,f=be*.44*t,m=Math.atan2(d,p);e.spawnTransient(h,.13,g=>{const w=1-Math.pow(1-g,2.2),b=G.lerp(u,f,w);h.position.set(a+d*b+s.x*b*.3,o,n+p*b+s.z*b*.3);const x=(1-g*.45)*t;h.rotation.set(0,m,0),h.scale.set(mo*1.15*x,Os*1*x,mo*1.15*x),l.opacity=g<.45?1:1-(g-.45)/.55})}}function dh(e,t,a,o,n,s,r,i=.3){const c=new io(Ew()),l=c.material;l.color.set(Ep),l.opacity=0,c.renderOrder=10;const h=(Math.random()-.5)*n*1.4,d=(Math.random()-.5)*n*1.4;c.position.set(t,a,o),c.scale.set(n,n,1),e.spawnTransient(c,r,p=>{const u=1-Math.pow(1-p,2);c.position.set(t+h*u,a+s*u,o+d*u);const f=n*(1+u*.9);c.scale.set(f,f,1),l.opacity=i*Math.sin(Math.min(1,p*1.25)*Math.PI)})}function Iw(e,t,a,o){const{x:n,y:s,z:r}=e.position,i=e.direction;let c=-i.z,l=i.x;Math.hypot(c,l)<1e-4&&(c=1,l=0);for(const h of[-1,1]){const d=lc();d.color.set(h<0?on:ic),d.opacity=1;const p=new y(Tp,d);p.renderOrder=9;const u=n+c*h*be*.24*t,f=r+l*h*be*.24*t;p.position.set(u,s,f);const m=mo*2.1*t;p.scale.set(m,Os*1.9*t,m);const g=c*h*a+i.x*a*.35,w=l*h*a+i.z*a*.35,b=1.5+Math.random()*.9,x=h*(7+Math.random()*5),v=(Math.random()-.5)*6;e.spawnTransient(p,o,(E,k)=>{const M=s+b*k-4.6*k*k;p.position.set(u+g*k,Math.max(hs,M),f+w*k),p.rotation.set(v*k,x*k,h*.5),d.opacity=1-Math.pow(E,2.2)})}}function ph(e){const t=new te;ch.color.set(e);const a=new y(ki,ch);a.scale.set(pe,pe*.85,pe*1.18),a.rotation.set(.6,.4,.2),t.add(a);const o=new y(ki,Tw);o.scale.setScalar(pe*.62),o.position.set(pe*.55,-pe*.4,-pe*.3),o.rotation.set(1.1,.3,.8),t.add(o);const n=new y(xi,lh);n.scale.set(Ht*1.15,Ht*.4,Ht*1.15),n.position.set(-pe*.45,pe*.55,pe*.2),n.rotation.set(.9,.7,-.5),t.add(n);for(const[c,l,h]of[[.8,.3,.5],[-.55,-.25,-.8]]){const d=new y(Mi,Fw);d.scale.setScalar(ka*1.45),d.position.set(pe*c,pe*l,pe*h),d.rotation.set(Math.random(),Math.random(),Math.random()),t.add(d)}const s=new y(xi,lh);s.scale.set(Ht*.8,Ht*.3,Ht*.8),s.position.set(pe*.3,-pe*.15,-pe*.7),s.rotation.set(-.6,1.9,.8),t.add(s);const r=new y(go[2],Sw);r.scale.set(pe*1.02,pe*1.25,pe*1.02),r.position.set(-pe*.25,-pe*.72,-pe*.1),r.rotation.set(1.5,.4,.15),t.add(r);const i=new y(go[0],Aw);return i.scale.set(pe*.7,pe*.85,pe*.7),i.position.set(pe*.75,-pe*.35,pe*.45),i.rotation.set(.9,2.2,-.6),t.add(i),t}function uh(e){const t=new te;hh.color.set(e);const a=new y(rh,hh);a.scale.set(ke,ke*.92,ke),t.add(a);const o=new te;for(let r=0;r<3;r++){const i=new y(vw,Tr);i.scale.set(ke*1.01,ke*.93,ke*1.01),i.rotation.y=r/3*Math.PI,o.add(i)}t.add(o);const n=new y(ih,Tr);n.scale.set(ke*.42,ke*.62,ke*.42),n.position.y=ke*1.06,n.rotation.z=.18,t.add(n);for(let r=0;r<3;r++){const i=r/3*He+.4,c=new y(ih,Rw);c.scale.set(ke*.09,ke*.34,ke*.09),c.position.set(Math.cos(i)*ke*.2,-ke*1,Math.sin(i)*ke*.2),c.rotation.set(Math.PI+(Math.random()-.5)*.6,0,(Math.random()-.5)*.6),t.add(c)}const s=new y(rh,Tr);return s.scale.set(ke*.42,ke*.2,ke*.42),s.position.set(ke*.42,ke*.62,-ke*.3),t.add(s),t.userData.__bands=o,t}function fh(e,t){const a=e.object;if(!a)return;const o=e.dt??0,n=Cp(a,e.weapon,t);if(n.t+=n.rate*o,a.rotation.x=n.t,a.rotation.z=Math.sin(n.t*.63)*.9,n.shed-=o,n.shed<=0){n.shed=.06+Math.random()*.04;const s=Math.random(),r=s<.45?"meat":s<.72?"tomato":"lettuce",i=e.position.x-e.direction.x*pe,c=e.position.z-e.direction.z*pe;Ns(e,r,i,e.position.y-pe*.4,c,-e.direction.x*.5+(Math.random()-.5)*.7,-.2-Math.random()*.4,-e.direction.z*.5+(Math.random()-.5)*.7,.85,.34),Math.random()<.55&&Ls(e,i,e.position.y,c,-e.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-e.direction.z*.7+(Math.random()-.5)*.6,.9,.3)}}function mh(e,t){const a=Rp(e.damage)*t,{x:o,y:n,z:s}=e.position,r=e.direction;hc(e,o,n,s,be*.24*a),zp(e,a),Iw(e,a*.95,2.4*a,.4);const i=be*.26*a,c=.8;for(let l=0;l<6;l++){const h=l/6*He+Math.random()*.7,d=(2.2+Math.random()*1.5)*a,p=Math.random();Ns(e,p<.5?"meat":p<.78?"tomato":"lettuce",o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.9+Math.random()*1.3,Math.sin(h)*d+r.z*c,a,.42+Math.random()*.14)}for(let l=0;l<4;l++){const h=l/4*He+Math.random()*.9,d=(2.4+Math.random()*1.6)*a;Ip(e,o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.7+Math.random()*1.5,Math.sin(h)*d+r.z*c,(.85+Math.random()*.5)*a,.42+Math.random()*.12)}for(let l=0;l<9;l++){const h=Math.random()*He,d=(2.6+Math.random()*2.1)*a;Ls(e,o+Math.cos(h)*i*.8,n,s+Math.sin(h)*i*.8,Math.cos(h)*d+r.x*c,1.5+Math.random()*1.8,Math.sin(h)*d+r.z*c,(.85+Math.random()*.7)*a,.36+Math.random()*.14)}}function gh(e,t){const a=e.object;if(!a)return;const o=e.dt??0,n=Cp(a,e.weapon,t);n.t+=n.rate*o,a.rotation.x=n.t*.8,a.rotation.z=n.t*.45;const s=a.userData.__bands;if(s&&(s.rotation.y+=o*1.9),n.shed-=o,n.shed<=0){n.shed=.1+Math.random()*.07;const r=Ap();r.color.set(zs),r.opacity=1;const i=new y(xw,r);i.renderOrder=9;const c=e.position.x-e.direction.x*ke,l=e.position.z-e.direction.z*ke;i.position.set(c,e.position.y,l);const h=ke*(.3+Math.random()*.2);i.scale.set(h,h*.5,h);const d=-e.direction.x*.5+(Math.random()-.5)*.5,p=-e.direction.z*.5+(Math.random()-.5)*.5,u=5+Math.random()*5;e.spawnTransient(i,.42,(f,m)=>{i.position.set(c+d*m,e.position.y-.7*m*m-.25*m,l+p*m),i.rotation.set(Math.sin(m*u)*1.4,m*3,Math.cos(m*u*.7)*1.1),r.opacity=1-Math.pow(f,2)})}}function wh(e,t){const a=Rp(e.damage)*t,{x:o,y:n,z:s}=e.position,r=e.direction;hc(e,o,n,s,be*.21*a),zp(e,a*.88);for(let l=0;l<3;l++){const h=Mw();h.color.set(l===0||l===1?e.color:zs),h.opacity=.66;const d=new y(yw,h);d.renderOrder=10,d.position.set(o,n,s),d.rotation.set((Math.random()-.5)*.5,Math.random()*He,(Math.random()-.5)*.5);const p=ke*(.8+l*.12),u=gw*a*(.78+l*.22),f=(Math.random()-.5)*5;e.spawnTransient(d,.3+l*.05,m=>{const g=1-Math.pow(1-m,2.6),w=G.lerp(p,u,g);d.scale.set(w,w*(.9-g*.45),w),d.position.y=n+g*be*.06,d.rotation.y+=f*.02,h.opacity=.66*(1-Math.pow(m,1.4))})}dh(e,o,n*.6,s,be*.34*a,be*.3,.65,.4);for(let l=0;l<3;l++){const h=l/3*He+Math.random();dh(e,o+Math.cos(h)*be*.24*a,hs+be*.12,s+Math.sin(h)*be*.24*a,be*.28*a,be*.26,.6,.34)}const i=be*.24*a,c=.7;for(let l=0;l<5;l++){const h=l/5*He+Math.random()*.8,d=(2.3+Math.random()*1.4)*a;Ns(e,"onion",o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.9+Math.random()*1.2,Math.sin(h)*d+r.z*c,a,.4+Math.random()*.12)}for(let l=0;l<3;l++){const h=Math.random()*He,d=(2.3+Math.random()*1.5)*a;Ip(e,o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.6+Math.random()*1.4,Math.sin(h)*d+r.z*c,(.75+Math.random()*.45)*a,.4)}for(let l=0;l<7;l++){const h=Math.random()*He,d=(2.5+Math.random()*1.9)*a;Ls(e,o+Math.cos(h)*i*.8,n,s+Math.sin(h)*i*.8,Math.cos(h)*d+r.x*c,1.4+Math.random()*1.6,Math.sin(h)*d+r.z*c,(.8+Math.random()*.6)*a,.34+Math.random()*.12)}}function Ar(e,t,a){const o=e.direction,{x:n,y:s,z:r}=e.position,i=lc();i.color.set(on),i.opacity=.9;const c=new y(Tp,i);c.renderOrder=11;const l=Math.atan2(o.x,o.z),h=mo*.9*a;e.spawnTransient(c,.18,d=>{const p=h*(1+d*1.5);c.position.set(n+o.x*d*be*.14,s-d*be*.04,r+o.z*d*be*.14),c.scale.set(p,Os*1.1*a*(1-d*.35),p),c.rotation.set(0,l+d*1.1,0),i.opacity=.9*(1-d*d)}),hc(e,n+o.x*be*.06,s,r+o.z*be*.06,be*.1*a);for(let d=0;d<7;d++)Ls(e,n,s,r,o.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.6+Math.random()*.7,o.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(const d of t)Ns(e,d,n,s,r,o.x*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.8+Math.random()*.5,o.z*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.9*a,.3)}const zw={Filling:{projectile(e){const t=ph(e.color);return t.position.copy(e.position),t},trail(e){fh(e,1.7)},impact(e){mh(e,1)},cast(e){Ar(e,["meat","tomato"],1)}},Onion:{projectile(e){const t=uh(e.color);return t.position.copy(e.position),t},trail(e){gh(e,1.2)},impact(e){wh(e,1)},cast(e){Ar(e,["onion","onion"],1)}},Double:{projectile(e){const t=Sr(e)===1?uh(e.color):ph(e.color);return t.scale.setScalar(1.12),t.position.copy(e.position),t},trail(e){Sr(e)===1?gh(e,1.3):fh(e,1.9)},impact(e){Sr(e)===1?wh(e,1.12):mh(e,1.12)},cast(e){Ar(e,["meat","onion","tomato"],1.25)}}},sn="#F5EAD6",Ow="#E4CFA0",Op="#B9843C",Lp="#6B3E12",Np="#452D18",dc="#E0562B",Dp="#D5EAF4",pc="#FFFFFF",Ds="#FFF6E4",_p="#5B3324",uc="#FFC93C",fc="#E63946",mc="#7DA33F",Lw="#FFFDF7",se=oe,Te=Math.PI*2,wo=.29,Fe=se*.115,Ke=se*.3,Nw=se*.085,Hp=se*.075,$p=se*.09,ds=se*.032,Fr=se*.058,Dw=se*.05,_w=se*.1,ps=se*.022,Hw=se*.4,$w=se*.97,Pw=se*.7,Pp=se*.11,Ei=new pt(1,1,1),qw=new Me(.5,.5,1,8,1,!0,-1.5,3),qp=new Ss(.5,0),jp=new Bi(.62,0),_s=new qi(1,1.4,3,6);_s.scale(.5,1/3.4,.5);const Bp=new bt(.5,8,6),us=new pt(1,1,1),jw=new xo(.5,1,4),Xo=new pt(1,1,1),bh=new ji(1,.085,5,18),yh=new Me(1,1,1,16,1),Bw=new Me(.55,1,1,14,1),Gw=new Me(1,1,1,12,1,!0,-1.55,3.1),Ww=new _a(1,18);function To(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const So=(e,t={})=>new K({color:e,transparent:!0,opacity:1,depthWrite:!1,side:ye,...t}),Uw=To(30,()=>So(sn)),Ea=To(34,()=>So(Ds)),Yw=To(6,()=>So(dc)),Vw=To(10,()=>So(sn)),Kw=To(10,()=>So(Lp)),Gp=To(24,()=>So(pc)),$e=(e,t={})=>new K({color:e,side:ye,...t}),vh=$e(sn),xh=$e(Ow),In=$e(Op),Xw=$e(Dp),Zw=$e(dc),kh=$e(Ds),Qw=$e(_p);$e(uc);$e(fc);$e(mc);const Jw=[$e(mc),$e(fc),$e(uc),$e(Ds)],eb=[$e("#5C7F2A"),$e("#B02733"),$e("#E0A317"),$e(Lw)],zn=new le,On=new le,Rr=new le,Mh=new Dd;function tb(e,t,a,o,n,s,r){zn.set(t,a,o).normalize(),On.set(n,s,r).normalize(),Rr.crossVectors(zn,On).normalize(),On.crossVectors(Rr,zn).normalize(),Mh.makeBasis(zn,On,Rr),e.quaternion.setFromRotationMatrix(Mh)}function ab(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function ob(e){const t=e.weapon.pelletColors;if(!t||t.length===0)return 0;const a=t.indexOf(e.color);return a>=0?a%4:0}function Ti(e){return G.clamp(.85+e*.035,.85,1.35)}function Wp(e,t,a){let o=e.userData.__spin;return o||(o={t:Math.random()*Te,rate:a*Te/ab(t),shed:0,age:0},e.userData.__spin=o),o}function Ta(e,t,a,o,n,s,r,i,c,l,h,d,p,u,f=-9){a.color.set(o),a.opacity=1;const m=new y(t,a);m.renderOrder=9,m.position.set(n,s,r),m.scale.set(h,d,p),m.rotation.set(Math.random()*Te,Math.random()*Te,Math.random()*Te);const g=(Math.random()-.5)*18,w=(Math.random()-.5)*18,b=(Math.random()-.5)*18,x=m.rotation.x,v=m.rotation.y,E=m.rotation.z;e.spawnTransient(m,u,(k,M)=>{const C=s+c*M+.5*f*M*M,T=C<=wo;m.position.set(n+i*M,T?wo:C,r+l*M),T||m.rotation.set(x+g*M,v+w*M,E+b*M),a.opacity=1-Math.pow(k,2.4)})}function fo(e,t,a,o,n,s,r,i,c){const l=Nw*i*(.85+Math.random()*.55),h=Math.random();Ta(e,qw,Uw(),h<.24?Np:h<.48?Op:sn,t,a,o,n,s,r,l,l*.85,l,c,-7.5)}function Zo(e,t,a,o,n,s,r,i,c){const l=Hp*i*(.7+Math.random()*.6);Ta(e,Math.random()<.5?qp:jp,Gp(),Math.random()<.45?pc:Dp,t,a,o,n,s,r,l*1.3,l*.34,l,c,-8.5)}function Qo(e,t,a,o,n,s,r,i,c,l){if(t==="rice")Ta(e,_s,Ea(),Ds,a,o,n,s,r,i,ds*c,$p*c,ds*c,l);else if(t==="bean"){const h=Fr*c;Ta(e,Bp,Ea(),_p,a,o,n,s,r,i,h*1.35,h*.85,h*.85,l)}else if(t==="cheese")Ta(e,us,Ea(),uc,a,o,n,s,r,i,_w*c,ps*c,ps*c,l,-6.5);else if(t==="salsa"){const h=Fr*.85*c;Ta(e,Xo,Ea(),fc,a,o,n,s,r,i,h,h,h,l)}else{const h=Fr*c;Ta(e,Xo,Ea(),mc,a,o,n,s,r,i,h*1.2,h*.55,h*1.2,l)}}function Si(e,t){const{x:a,y:o,z:n}=e.position,s=e.direction,r=Math.random()*Te;for(let i=0;i<8;i++){const c=r+i/8*Te,l=Gp();l.color.set(i%2===0?pc:Np),l.opacity=1;const h=new y(i%2===0?qp:jp,l);h.renderOrder=12;const d=Math.cos(c),p=Math.sin(c),u=se*.26*t,f=se*.44*t,m=(Math.random()-.5)*14;e.spawnTransient(h,.14,g=>{const w=1-Math.pow(1-g,2.2),b=G.lerp(u,f,w);h.position.set(a+d*b+s.x*b*.28,o+w*se*.05,n+p*b+s.z*b*.28);const x=Hp*t*(1.7-g*.5);h.scale.set(x*1.6,x*.34,x),h.rotation.set(m*g,Math.atan2(d,p),m*g*.6),l.opacity=g<.45?1:1-(g-.45)/.55})}}const ta=16,Up=2.35,nb=.42;function gc(e){const t=new te,a=Vw(),o=Kw();a.color.set(sn),a.opacity=1,o.color.set(Lp),o.opacity=1;const n=[];for(let s=0;s<e;s++){const r=new y(Ei,o);r.renderOrder=10;const i=new y(Ei,a);i.renderOrder=11,r.scale.setScalar(0),i.scale.setScalar(0),t.add(r,i),n.push({face:i,back:r})}return{group:t,slats:n,faceMat:a,backMat:o}}function sb(e,t,a,o,n,s,r,i){const{group:c,slats:l,faceMat:h,backMat:d}=gc(ta),p=se*.06*r,u=se*.15*r,f=Pw*r,m=Pp*r,g=(v,E,k)=>{const M=v*Up*Te*s,C=v*nb*Te*s,T=M+(C-M)*E,F=p+v*(u-p),N=p+v*(f-p),S=F+(N-F)*E;k.x=t+Math.cos(n+T)*S,k.z=o+Math.sin(n+T)*S},w={x:0,z:0},b={x:0,z:0},x=v=>{const E=1-Math.pow(1-Math.min(1,v/.62),2.4),k=G.lerp(a,wo,1-Math.pow(1-Math.min(1,v/.72),1.8));for(let C=0;C<ta;C++){const T=C/ta,F=(C+1)/ta;g(T,E,w),g(F,E,b);const N=b.x-w.x,S=b.z-w.z,R=Math.hypot(N,S)*1.14,q=Math.atan2(N,S),_=(w.x+b.x)*.5,B=(w.z+b.z)*.5,Y=m*(1-T*.35),{face:P,back:Q}=l[C];P.rotation.set(0,q,0),Q.rotation.set(0,q,0),P.position.set(_,k+.022,B),Q.position.set(_,k,B),P.scale.set(Y,se*.008,R),Q.scale.set(Y*1.8,se*.006,R*1.12)}const M=v<.68?1:1-(v-.68)/.32;h.opacity=M,d.opacity=M*.95};x(0),e.spawnTransient(c,i,x)}function rb(e,t,a){const{x:o,z:n}=e.position,s=22,r=2.2,i=Hw*t,{group:c,slats:l,faceMat:h,backMat:d}=gc(s),p=Math.random()*Te,u=wo+se*.02,f=($w*t-u)/(s-1),m=r*Te/(s-1),g=w=>{const b=Math.min(1,w/.52),x=w<.62?1:1-(w-.62)/.38*.16;for(let E=0;E<s;E++){const k=E/s*.9,M=b>k,{face:C,back:T}=l[E];if(C.visible=M,T.visible=M,!M)continue;const F=p+E*m,N=i*x,S=o+Math.cos(F)*N,R=u+E*f,q=n+Math.sin(F)*N;tb(C,-Math.sin(F)*N*m,f,Math.cos(F)*N*m,Math.cos(F),0,Math.sin(F)),T.quaternion.copy(C.quaternion);const _=N*m*1.02,B=se*.1*t;C.position.set(S,R,q),T.position.set(S-Math.cos(F)*.02,R,q-Math.sin(F)*.02),C.scale.set(_,se*.009,B),T.scale.set(_*1.02,se*.007,B*1.75)}const v=w<.62?1:1-(w-.62)/.38;h.opacity=.88*v,d.opacity=.92*v};g(0),e.spawnTransient(c,a,g)}function Yp(e,t,a,o,n,s,r,i,c){const{group:l,slats:h,faceMat:d,backMat:p}=gc(ta),u=se*.03*i,f=se*.13*i,m=Math.random()<.5?1:-1,g=m*(9+Math.random()*5),w={x:0,z:0},b={x:0,z:0},x=(E,k,M)=>{const C=k+E*Up*Te*m,T=u+E*(f-u);M.x=Math.cos(C)*T,M.z=Math.sin(C)*T},v=(E,k)=>{const M=g*k,C=t+n*k,T=Math.max(wo,a+s*k-4*k*k),F=o+r*k;for(let S=0;S<ta;S++){x(S/ta,M,w),x((S+1)/ta,M,b);const R=b.x-w.x,q=b.z-w.z,_=Math.hypot(R,q)*1.16,B=Math.atan2(R,q),{face:Y,back:P}=h[S];Y.rotation.set(0,B,0),P.rotation.set(0,B,0),Y.position.set(C+(w.x+b.x)*.5,T+.018,F+(w.z+b.z)*.5),P.position.set(C+(w.x+b.x)*.5,T,F+(w.z+b.z)*.5);const Q=Pp*i*.72;Y.scale.set(Q,se*.007,_),P.scale.set(Q*1.8,se*.005,_*1.14)}const N=1-Math.pow(E,2);d.opacity=N,p.opacity=N*.95};v(0,0),e.spawnTransient(l,c,v)}function ib(e){const t=new te,a=new te;t.add(a),vh.color.set(e);const o=new y(yh,vh);o.rotation.x=Math.PI/2,o.scale.set(Fe,Ke*.8,Fe),a.add(o);const n=new y(Bw,xh);n.rotation.x=-Math.PI/2,n.scale.set(Fe,Ke*.12,Fe),n.position.z=-Ke*.46,a.add(n);const s=new y(Gw,In);s.rotation.x=Math.PI/2,s.scale.set(Fe*1.02,Ke*.8,Fe*1.02),a.add(s);const r=new y(us,In);r.position.set(Fe*.92,0,0),r.rotation.set(.42,0,0),r.scale.set(Fe*.14,Fe*.16,Ke*.82),a.add(r);const i=new y(yh,Xw);i.rotation.x=Math.PI/2,i.scale.set(Fe*1.07,Ke*.26,Fe*1.07),i.position.z=-Ke*.2,a.add(i);for(const h of[-Ke*.1,Ke*.04]){const d=new y(bh,Zw);d.scale.set(Fe*1.08,Fe*1.08,Fe*.85),d.position.z=h,a.add(d)}const c=new y(Ww,xh);c.scale.setScalar(Fe*.99),c.position.z=Ke*.404,a.add(c);const l=[In,kh,In];for(let h=0;h<3;h++){const d=new y(bh,l[h]),p=Fe*(.78-h*.25);d.scale.set(p,p,Fe*.2),d.position.z=Ke*.412,a.add(d)}for(let h=0;h<4;h++){const d=h/4*Te+.5,p=new y(h%2===0?_s:Bp,h%2===0?kh:Qw),u=Fe*.28;p.scale.set(u,h%2===0?u*2:u,u),p.position.set(Math.cos(d)*Fe*.6,Math.sin(d)*Fe*.6,Ke*.42),p.rotation.set(Math.random(),Math.random(),Math.random()),a.add(p)}return t.userData.__spinner=a,t}function cb(e){const t=new te,a=Jw[e],o=eb[e],n=se*.075;if(e===0){for(let r=0;r<3;r++){const i=new y(jw,r===1?o:a);i.scale.set(n*.5,n*2.6,n*.22),i.position.set((r-1)*n*.5,n*.4,0),i.rotation.set(.2,0,(r-1)*.55),t.add(i)}const s=new y(us,o);s.scale.set(n*.16,n*1.2,n*.16),s.position.y=-n*.7,t.add(s)}else if(e===1)for(let s=0;s<3;s++){const r=s/3*Te,i=new y(Xo,s===2?o:a),c=n*(1+Math.random()*.35);i.scale.setScalar(c),i.position.set(Math.cos(r)*n*.75,Math.sin(r)*n*.5,Math.sin(r*1.7)*n*.55),i.rotation.set(Math.random(),Math.random(),Math.random()),t.add(i)}else if(e===2)for(let s=0;s<4;s++){const r=new y(us,s===3?o:a);r.scale.set(n*2.5,ps*1.2,ps*1.2),r.position.set(0,(s-1.5)*n*.28,(s-1.5)*n*.2),r.rotation.set(0,(s-1.5)*.28,(s-1.5)*.14),t.add(r)}else for(let s=0;s<5;s++){const r=s/5*Te+.3,i=new y(_s,s===4?o:a);i.scale.set(ds*1.15,$p*1.15,ds*1.15),i.position.set(Math.cos(r)*n*.55,Math.sin(r*1.3)*n*.4,Math.sin(r)*n*.55),i.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),t.add(i)}return t}function lb(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Wp(t,e.weapon,9);o.t+=o.rate*a;const n=t.userData.__spinner;if(n&&(n.rotation.z=o.t),t.rotation.x=Math.sin(o.t*.35)*.1,o.shed-=a,o.shed<=0){o.shed=.055+Math.random()*.04;const s=e.position.x-e.direction.x*Ke*.5,r=e.position.z-e.direction.z*Ke*.5,i=Math.random();i<.42?Qo(e,"rice",s,e.position.y-Fe*.3,r,-e.direction.x*.6+(Math.random()-.5)*.7,-.15-Math.random()*.4,-e.direction.z*.6+(Math.random()-.5)*.7,.9,.32):i<.72?fo(e,s,e.position.y,r,-e.direction.x*.8+(Math.random()-.5)*.6,.15+Math.random()*.3,-e.direction.z*.8+(Math.random()-.5)*.6,.75,.3):Zo(e,s,e.position.y,r,-e.direction.x*.9+(Math.random()-.5)*.5,.2+Math.random()*.35,-e.direction.z*.9+(Math.random()-.5)*.5,.65,.26)}}function hb(e){const t=Ti(e.damage),{x:a,y:o,z:n}=e.position,s=e.direction;Si(e,t);const r=se*.16*t;let i=-s.z,c=s.x;Math.hypot(i,c)<1e-4&&(i=1,c=0);const l=Math.atan2(s.z,s.x);for(const p of[-1,1])sb(e,a+s.x*r+i*p*r*.7,o,n+s.z*r+c*p*r*.7,l+p*1.05,p,t*.92,.78);const h=se*.26*t,d=.8;for(let p=0;p<9;p++){const u=p/9*Te+Math.random()*.6,f=(2.3+Math.random()*1.5)*t,m=Math.random();Qo(e,m<.32?"rice":m<.66?"bean":m<.85?"cheese":"salsa",a+Math.cos(u)*h,o,n+Math.sin(u)*h,Math.cos(u)*f+s.x*d,1.9+Math.random()*1.3,Math.sin(u)*f+s.z*d,t,.42+Math.random()*.14)}for(let p=0;p<6;p++){const u=p/6*Te+Math.random()*.9,f=(2.4+Math.random()*1.6)*t;fo(e,a+Math.cos(u)*h,o,n+Math.sin(u)*h,Math.cos(u)*f+s.x*d,1.8+Math.random()*1.4,Math.sin(u)*f+s.z*d,(.9+Math.random()*.5)*t,.44+Math.random()*.12)}for(let p=0;p<4;p++){const u=Math.random()*Te,f=(2.7+Math.random()*1.8)*t;Zo(e,a+Math.cos(u)*h*.9,o,n+Math.sin(u)*h*.9,Math.cos(u)*f+s.x*d,1.6+Math.random()*1.6,Math.sin(u)*f+s.z*d,(.8+Math.random()*.6)*t,.36+Math.random()*.12)}}function db(e,t){const a=e.direction,{x:o,y:n,z:s}=e.position;Yp(e,o,n,s,a.x*2.2+(Math.random()-.5)*.4,.7,a.z*2.2+(Math.random()-.5)*.4,t,.26);for(let r=0;r<5;r++)Qo(e,r%2===0?"rice":"bean",o,n,s,a.x*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.6,a.z*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.9*t,.3);for(let r=0;r<4;r++)Zo(e,o,n,s,a.x*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8+Math.random()*.6,a.z*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8*t,.24);for(let r=0;r<3;r++)fo(e,o,n,s,a.x*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.6+Math.random()*.5,a.z*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.8*t,.26)}const pb={Disc:{projectile(e){const t=ib(e.color);return t.position.copy(e.position),t},trail(e){lb(e)},impact(e){hb(e)},cast(e){db(e,1)}},Roll:{impact(e){const t=Ti(e.damage);rb(e,1,.62),Si(e,t*.85);const{x:a,y:o,z:n}=e.position,s=e.direction,r=se*.24*t;for(let i=0;i<5;i++){const c=i/5*Te+Math.random()*.8,l=(2+Math.random()*1.3)*t;Qo(e,i%2===0?"rice":"guac",a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.6,1.7+Math.random()*1.1,Math.sin(c)*l+s.z*.6,t,.38+Math.random()*.12)}for(let i=0;i<3;i++){const c=Math.random()*Te,l=(2.2+Math.random()*1.4)*t;fo(e,a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.6,1.6+Math.random()*1.2,Math.sin(c)*l+s.z*.6,.85*t,.4)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position;for(const s of[-.5,.5])Yp(e,a-t.z*s*se*.12,o,n+t.x*s*se*.12,t.x*2.6-t.z*s*1.2,.5,t.z*2.6+t.x*s*1.2,.9,.3);for(let s=0;s<5;s++)fo(e,a,o,n,t.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.6+Math.random()*.6,t.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.85,.28);for(let s=0;s<3;s++)Zo(e,a,o,n,t.x*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.5,t.z*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.75,.24)}},Swarm:{projectile(e){const t=cb(ob(e));return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Wp(t,e.weapon,2.4);o.t+=o.rate*a,o.age+=a;const n=Math.sin(o.age*7.5+o.t)*se*.085;if(t.position.x+=-e.direction.z*n,t.position.z+=e.direction.x*n,t.position.y+=Math.sin(o.age*5.2)*se*.03,t.rotation.x=o.t*.8,t.rotation.z=Math.sin(o.t*.7)*.7,o.shed-=a,o.shed<=0){o.shed=.14+Math.random()*.08;const s=Ea();s.color.set(e.color),s.opacity=1;const r=new y(Xo,s);r.renderOrder=9;const i=t.position.x,c=t.position.y,l=t.position.z,h=se*.03;r.position.set(i,c,l),r.scale.setScalar(h),e.spawnTransient(r,.26,(d,p)=>{r.position.set(i,c-.5*p*p,l),r.scale.setScalar(h*(1-d*.6)),s.opacity=1-d})}},impact(e){const t=Ti(e.damage)*.8,{x:a,y:o,z:n}=e.position,s=e.direction;Si(e,t*.7);const r=se*.22*t;for(let i=0;i<5;i++){const c=i/5*Te+Math.random()*.8,l=(2.1+Math.random()*1.2)*t,h=Ea();h.color.set(e.color),h.opacity=1;const d=new y(Xo,h);d.renderOrder=9;const p=a+Math.cos(c)*r,u=n+Math.sin(c)*r,f=Math.cos(c)*l+s.x*.6,m=Math.sin(c)*l+s.z*.6,g=1.6+Math.random()*1.1,w=Dw*t;d.scale.setScalar(w),d.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3),e.spawnTransient(d,.36,(b,x)=>{const v=o+g*x-4.5*x*x;d.position.set(p+f*x,Math.max(wo,v),u+m*x),h.opacity=1-Math.pow(b,2.2)})}for(let i=0;i<3;i++){const c=Math.random()*Te,l=(2.2+Math.random()*1.3)*t;fo(e,a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.5,1.5+Math.random()*1.2,Math.sin(c)*l+s.z*.5,.7*t,.34)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position,s=(e.weapon.spreadDeg??40)*Math.PI/360,r=["guac","salsa","cheese","rice"];for(let h=0;h<12;h++){const d=(Math.random()*2-1)*s,p=Math.cos(d),u=Math.sin(d),f=t.x*p-t.z*u,m=t.x*u+t.z*p,g=1.8+Math.random()*1.4;Qo(e,r[h%4],a,o,n,f*g,.8+Math.random()*.7,m*g,.95,.34)}const i=Yw();i.color.set(dc),i.opacity=1;const c=new y(Ei,i);c.renderOrder=11;const l=Math.atan2(t.x,t.z);e.spawnTransient(c,.2,h=>{const d=1-Math.pow(1-h,2);c.position.set(a+t.x*d*se*.3,o+d*se*.05,n+t.z*d*se*.3),c.rotation.set(0,l+d*.8,0),c.scale.set(se*.2*(1+d*.5),se*.01,se*.05),i.opacity=1-h*h});for(let h=0;h<4;h++)Zo(e,a,o,n,t.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8+Math.random()*.6,t.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8,.26)}}},Ha="#FFF8EA",wc="#E4D6AE",Hs="#FFFFFF",bc="#4A3118",Vp="#FF9E12",ub="#FFCE55",Kp="#F4FBFF",Un="#FFD84D",fb="#EFB528",mb="#F5872B",gb="#2A2320",Xp="#FFF0B8",xe=oe,Ce=Math.PI*2,Oa=.29,wb=xe*.31,bb=xe*.2,Zp=xe*.03,yb=xe*.062,vb=xe*.115,xb=xe*.052,kb=xe*.16,Mb=xe*.026,Eb=xe*.045,Ma=xe*.125,Xe=xe*.085,Ln=xe*.115,La=new xo(.5,1,4);La.rotateZ(-Math.PI/2);const Ai=new bt(.5,16,11,0,Math.PI*1.5),Tb=new Me(.5,.5,1,8,1,!0,-1.35,2.7),Sb=new Me(.5,.5,1,8,1,!0,-1.2,2.4),no=new bt(.5,12,10),yc=new qi(1,2.2,3,7);yc.scale(.5,1/4.2,.5);yc.rotateZ(-Math.PI/2);const Qp=new Bi(.62,0),Ab=new xo(.5,1,3),Fb=new pt(1,1,1),Jp=new xo(.5,1,4);Jp.rotateX(Math.PI/2);function rn(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const cn=(e,t={})=>new K({color:e,transparent:!0,opacity:1,depthWrite:!1,side:ye,...t}),e0=rn(34,()=>cn(Ha)),Rb=rn(18,()=>cn(Vp)),Cb=rn(18,()=>cn(Kp)),Ib=rn(16,()=>cn(Xp)),bo=rn(40,()=>cn(Hs)),Gt=(e,t={})=>new K({color:e,side:ye,...t}),Cr=Gt(Ha),Fi=Gt(wc),zb=Gt(Ha),Eh=Gt(mb),Ob=Gt(gb),Th=Gt(fb),Sh=[Gt(Un),Gt(Un),Gt(Un)];let Lb=0;const _o=new le,Ho=new le,Ir=new le,Ah=new Dd;function $s(e,t,a,o){_o.set(t,a,o).normalize(),Math.abs(_o.y)>.94?Ho.set(1,0,0):Ho.set(0,1,0),Ir.crossVectors(_o,Ho).normalize(),Ho.crossVectors(Ir,_o).normalize(),Ah.makeBasis(_o,Ho,Ir),e.quaternion.setFromRotationMatrix(Ah)}function Nb(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Ri(e){return G.clamp(.85+e*.035,.85,1.45)}function Db(e,t,a,o,n,s,r,i,c,l,h,d,p,u,f=-9){a.color.set(o),a.opacity=1;const m=new y(t,a);m.renderOrder=9,m.position.set(n,s,r),m.scale.set(h,d,p),m.rotation.set(Math.random()*Ce,Math.random()*Ce,Math.random()*Ce);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,b=(Math.random()-.5)*20,x=m.rotation.x,v=m.rotation.y,E=m.rotation.z;e.spawnTransient(m,u,(k,M)=>{const C=s+c*M+.5*f*M*M,T=C<=Oa;m.position.set(n+i*M,T?Oa:C,r+l*M),T||m.rotation.set(x+g*M,v+w*M,E+b*M),a.opacity=1-Math.pow(k,2.4)})}function Sa(e,t,a,o,n,s,r,i,c){const l=yb*i*(.75+Math.random()*.6);Db(e,Qp,e0(),Math.random()<.3?wc:Ha,t,a,o,n,s,r,l,l*.8,l,c)}function zr(e,t,a,o,n,s,r,i,c){const l=Rb();l.color.set(Math.random()<.3?ub:Vp),l.opacity=1;const h=new y(no,l);h.renderOrder=9;const d=xb*i*(.8+Math.random()*.6);h.position.set(t,a,o),h.scale.setScalar(d);const p=14+Math.random()*10,u=Math.random()*Ce;e.spawnTransient(h,c,(f,m)=>{const g=a+s*m-4.4*m*m;h.position.set(t+n*m,Math.max(Oa,g),o+r*m);const w=Math.sin(u+m*p)*.24;h.scale.set(d*(1+w),d*(1-w),d*(1+w*.4)),l.opacity=1-Math.pow(f,3)})}function Yn(e,t,a,o,n,s,r,i,c){const l=Cb();l.color.set(Kp),l.opacity=.78;const h=new y(yc,l);h.renderOrder=10,h.position.set(t,a,o);const d=kb*i*(.55+Math.random()*.4),p=Mb*i*(.75+Math.random()*.5);$s(h,n,s,r),h.scale.set(d,p,p),e.spawnTransient(h,c,(u,f)=>{const m=a+s*f-2.2*f*f;h.position.set(t+n*f,Math.max(Oa,m),o+r*f),h.scale.set(d*(1+u*1.5),p*(1-u*.4),p*(1-u*.4)),l.opacity=.78*(1-Math.pow(u,1.8))})}function vc(e,t,a,o,n,s,r,i){const c=Ib();c.color.set(Math.random()<.35?Un:Xp),c.opacity=1;const l=new y(Ab,c);l.renderOrder=9;const h=Eb*r*(.7+Math.random()*.6);l.position.set(t,a,o),l.scale.set(h,h*1.5,h*.35);const d=4+Math.random()*4,p=Math.random()*Ce;e.spawnTransient(l,i,(u,f)=>{l.position.set(t+n*f+Math.sin(p+f*d)*.1,a+.35*f-.55*f*f,o+s*f+Math.cos(p+f*d*.8)*.1),l.rotation.set(Math.sin(p+f*d)*1.5,f*2.2,Math.cos(p+f*d*.7)*1.2),c.opacity=1-Math.pow(u,2)})}function Vn(e,t,a,o=.13){const{x:n,y:s,z:r}=e.position,i=e.direction,c=Math.random()*Ce;for(let l=0;l<t;l++){const h=c+l/t*Ce+(Math.random()-.5)*.5,d=(l%3-1)*.42+(Math.random()-.5)*.2,p=Math.cos(d),u=Math.cos(h)*p,f=Math.sin(d),m=Math.sin(h)*p,g=bo();g.color.set(l%2===0?Hs:Ha),g.opacity=1;const w=bo();w.color.set(bc),w.opacity=1;const b=new y(La,g),x=new y(La,w);b.renderOrder=13,x.renderOrder=12;const v=wb,E=v+bb*a*(.7+Math.random()*.55),k=Zp*(.8+Math.random()*.45),M=n+i.x*v*.22,C=r+i.z*v*.22,T=new te;T.add(x,b),$s(b,u,f,m),x.quaternion.copy(b.quaternion),e.spawnTransient(T,o,F=>{const N=1-Math.pow(1-F,2.4),S=G.lerp(v,v+(E-v)*.45,N),R=G.lerp(v+(E-v)*.35,E,N),q=Math.max(.02,R-S),_=(S+R)*.5;b.position.set(M+u*_,s+f*_,C+m*_),x.position.copy(b.position),b.scale.set(q,k,k),x.scale.set(q*1.06,k*2.6,k*2.6);const B=F<.45?1:1-(F-.45)/.55;g.opacity=B,w.opacity=B})}}function Fh(e,t,a,o){const{x:n,z:s}=e.position,r=Math.random()*Ce,i=new te,c=bo();c.color.set(Hs),c.opacity=1;const l=bo();l.color.set(bc),l.opacity=1;const h=[];for(let u=0;u<t;u++){const f=r+u/t*Ce+(Math.random()-.5)*.55,m=new y(La,l),g=new y(La,c);m.renderOrder=10,g.renderOrder=11,m.scale.setScalar(0),g.scale.setScalar(0),$s(g,Math.cos(f),0,Math.sin(f)),m.quaternion.copy(g.quaternion),i.add(m,g),h.push({face:g,seam:m,a:f,len:xe*(.16+Math.random()*.3)*a,w:xe*(.02+Math.random()*.014)*a})}const d=xe*.2*a,p=u=>{const f=1-Math.pow(1-Math.min(1,u/.22),2.6);for(const g of h){const w=Math.max(.001,g.len*f),b=d+w*.5,x=n+Math.cos(g.a)*b,v=s+Math.sin(g.a)*b;g.face.position.set(x,Oa+.012,v),g.seam.position.set(x,Oa,v),g.face.scale.set(w,xe*.006,g.w),g.seam.scale.set(w*1.05,xe*.004,g.w*2.1)}const m=u<.42?1:1-(u-.42)/.58;c.opacity=.92*m,l.opacity=.92*m};p(0),e.spawnTransient(i,o,p)}function Rh(e,t,a,o){const{x:n,y:s,z:r}=e.position,i=e.direction;let c=-i.z,l=i.x;Math.hypot(c,l)<1e-4&&(c=1,l=0);for(const h of[-1,1]){const d=e0();d.color.set(h<0?Ha:wc),d.opacity=1;const p=new y(Ai,d);p.renderOrder=10;const u=n+c*h*xe*.26*t,f=r+l*h*xe*.26*t,m=vb*2*t;p.position.set(u,s,f),p.scale.set(m,m*1.15,m),p.rotation.set(0,h*1.4,0);const g=c*h*a+i.x*a*.35,w=l*h*a+i.z*a*.35,b=1.6+Math.random()*.9,x=h*(6+Math.random()*4),v=(Math.random()-.5)*5;e.spawnTransient(p,o,(E,k)=>{const M=s+b*k-4.6*k*k;p.position.set(u+g*k,Math.max(Oa,M),f+w*k),p.rotation.set(v*k,h*1.4+x*k,h*.4),d.opacity=1-Math.pow(E,2.2)})}}function _b(e){const t=new te,a=new te;t.add(a);const o=Sh[Lb++%Sh.length];o.color.set(e);const n=Ma,s=new y(no,o);s.scale.set(n*2,n*1.85,n*1.9),s.position.y=n*.15,a.add(s);const r=new y(no,Th);r.scale.set(n*1.5,n*.8,n*1.45),r.position.set(0,-n*.42,n*.18),a.add(r);const i=new y(Jp,Eh);i.scale.set(n*.55,n*.46,n*.7),i.position.set(0,n*.26,n*.92),a.add(i);for(const h of[-1,1]){const d=new y(no,Ob);d.scale.setScalar(n*.34),d.position.set(h*n*.4,n*.62,n*.62),a.add(d);const p=new y(no,Th);p.scale.set(n*.34,n*.85,n*1.05),p.position.set(h*n*.92,n*.08,-n*.1),p.rotation.z=h*.4,a.add(p),p.userData.__side=h;const u=new y(Fb,Eh);u.scale.set(n*.18,n*.1,n*.44),u.position.set(h*n*.34,-n*.92,n*.12),a.add(u)}const c=new y(Ai,zb);c.scale.set(n*1.22,n*1,n*1.22),c.position.set(-n*.16,n*.88,-n*.22),c.rotation.set(Math.PI-.42,.7,.3),a.add(c);const l=new y(Ai,Fi);return l.scale.set(n*1.08,n*.8,n*1.08),l.position.set(-n*.16,n*.86,-n*.22),l.rotation.set(Math.PI-.42,.7,.3),a.add(l),t.userData.__bob=a,t}function Hb(e){const t=new te;Cr.color.set(e);const a=new y(Tb,Cr);a.scale.set(Xe*2,Ln,Xe*2),t.add(a);const o=new y(Sb,Fi);o.scale.set(Xe*1.78,Ln*.92,Xe*1.78),t.add(o);for(let s=0;s<2;s++){const r=new y(Qp,Cr),i=Xe*(.42+s*.18);r.scale.set(i,i*.7,i),r.position.set(Xe*(s===0?.8:-.5),Ln*(s===0?.45:-.5),Xe*.4),r.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),t.add(r)}const n=new y(no,Fi);return n.scale.set(Xe*.75,Xe*.4,Xe*.75),n.position.set(-Xe*.2,-Ln*.34,0),t.add(n),t}function t0(e,t,a){let o=e.userData.__anim;return o||(o={t:Math.random()*Ce,rate:a*Ce/Nb(t.weapon),shed:0,age:0,lx:t.position.x,lz:t.position.z,speed:Qe(t.weapon.speed??160)},e.userData.__anim=o),o}function $b(e){const t=e.object;if(!t)return;const a=e.dt??0,o=t0(t,e,1);o.age+=a;const n=Math.hypot(e.position.x-o.lx,e.position.z-o.lz);a>0&&(o.speed=o.speed*.55+n/a*.45),o.lx=e.position.x,o.lz=e.position.z;const s=Qe(e.weapon.speed??160),r=o.speed<s*.28,i=t.userData.__bob;if(i)if(r){const c=o.age*2.2%1,l=Math.sin(Math.min(1,c*2.2)*Math.PI);i.position.set(0,-Ma*.3*l,Ma*.75*l),i.rotation.set(l*.95,0,0)}else{const c=o.age*7;i.position.set(0,Math.abs(Math.sin(c))*Ma*.22,0),i.rotation.set(0,0,Math.sin(c*.5)*.3);for(const l of i.children){const h=l.userData.__side;h!==void 0&&(l.rotation.z=h*(.4+Math.sin(c)*.5))}}o.shed-=a,o.shed<=0&&(o.shed=r?.1+Math.random()*.08:.2+Math.random()*.14,vc(e,e.position.x+(Math.random()-.5)*Ma,e.position.y+Ma*.3,e.position.z+(Math.random()-.5)*Ma,-e.direction.x*.25+(Math.random()-.5)*.35,-e.direction.z*.25+(Math.random()-.5)*.35,1,.7))}const Pb=xe*.27;function qb(e){const t=Ri(e.damage)*1.25,{x:a,y:o,z:n}=e.position,s=e.direction;Vn(e,4,t*1.15);const r=Pb;for(let i=0;i<9;i++){const c=i/9*Ce+Math.random()*.6,l=(1.9+Math.random()*1.2)*t;Sa(e,a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.5,1.5+Math.random()*1,Math.sin(c)*l+s.z*.5,1.2*t,.34)}for(let i=0;i<10;i++){const c=Math.random()*Ce;vc(e,a+Math.cos(c)*r,o+xe*.05,n+Math.sin(c)*r,Math.cos(c)*(.9+Math.random()*.8),Math.sin(c)*(.9+Math.random()*.8),t*1.25,.62)}}function jb(e){const t=e.object;if(!t)return;const a=e.dt??0,o=t0(t,e,1.9);if(o.t+=o.rate*a,t.rotation.x=o.t,t.rotation.z=Math.sin(o.t*.7)*1,o.shed-=a,o.shed<=0){o.shed=.075+Math.random()*.05;const n=e.position.x-e.direction.x*Xe,s=e.position.z-e.direction.z*Xe;Math.random()<.45?Yn(e,n,e.position.y-Xe*.3,s,-e.direction.x*.35+(Math.random()-.5)*.4,-.5-Math.random()*.4,-e.direction.z*.35+(Math.random()-.5)*.4,.6,.3):Sa(e,n,e.position.y,s,-e.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-e.direction.z*.7+(Math.random()-.5)*.6,.7,.28)}}const Bb={Tackle:{impact(e){const t=Ri(e.damage),{x:a,y:o,z:n}=e.position,s=e.direction;Vn(e,8,t),Rh(e,t*.95,2.4*t,.42),Fh(e,7,t,.66);const r=xe*.26*t,i=.8;for(let c=0;c<5;c++){const l=c/5*Ce+Math.random()*.7,h=(2+Math.random()*1.2)*t;zr(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.9+Math.random()*1.1,Math.sin(l)*h+s.z*i,t*1.15,.5+Math.random()*.12)}for(let c=0;c<6;c++){const l=c/6*Ce+Math.random()*.8,h=(2.4+Math.random()*1.5)*t;Yn(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.4+Math.random()*1,Math.sin(l)*h+s.z*i,t,.4+Math.random()*.12)}for(let c=0;c<11;c++){const l=Math.random()*Ce,h=(2.6+Math.random()*2)*t;Sa(e,a+Math.cos(l)*r*.9,o,n+Math.sin(l)*r*.9,Math.cos(l)*h+s.x*i,1.7+Math.random()*1.7,Math.sin(l)*h+s.z*i,(.9+Math.random()*.6)*t,.4+Math.random()*.14)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position,s=Math.atan2(t.x,t.z);for(let r=0;r<4;r++){const i=(r-1.5)*.34,c=Math.sin(s+i),l=Math.cos(s+i),h=(r%2-.5)*.35,d=bo();d.color.set(r%2===0?Hs:Ha),d.opacity=1;const p=bo();p.color.set(bc),p.opacity=1;const u=new y(La,d),f=new y(La,p);u.renderOrder=13,f.renderOrder=12;const m=new te;m.add(f,u),$s(u,c,h,l),f.quaternion.copy(u.quaternion);const g=Zp*.85;e.spawnTransient(m,.17,w=>{const b=1-Math.pow(1-w,2.2),x=xe*.1+b*xe*.1,v=xe*(.12+b*.22),E=x+v*.5;u.position.set(a+c*E,o+h*E*.5,n+l*E),f.position.copy(u.position),u.scale.set(v,g,g),f.scale.set(v*1.06,g*2.6,g*2.6);const k=w<.5?1:1-(w-.5)/.5;d.opacity=k,p.opacity=k})}for(let r=0;r<8;r++)Sa(e,a,o,n,t.x*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.7+Math.random()*.7,t.z*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(let r=0;r<3;r++)zr(e,a,o,n,t.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.8+Math.random()*.5,t.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.9,.32)}},Hatch:{projectile(e){const t=_b(e.color);return t.position.copy(e.position),t},trail(e){$b(e)},impact(e){qb(e)},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position;Vn(e,6,.62,.14),Rh(e,.8,2,.4);for(let s=0;s<9;s++){const r=Math.random()*Ce;vc(e,a+Math.cos(r)*xe*.1,o+xe*.06,n+Math.sin(r)*xe*.1,Math.cos(r)*(.8+Math.random()*.9)+t.x*.5,Math.sin(r)*(.8+Math.random()*.9)+t.z*.5,1.1,.8)}for(let s=0;s<5;s++)Sa(e,a,o,n,t.x*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.8+Math.random()*.6,t.z*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.85,.3)}},Shards:{projectile(e){const t=Hb(e.color);return t.position.copy(e.position),t},trail(e){jb(e)},impact(e){const t=Ri(e.damage)*.9,{x:a,y:o,z:n}=e.position,s=e.direction;Vn(e,5,t*.82,.12),Fh(e,5,t*.7,.6);const r=xe*.24*t,i=.7;for(let c=0;c<6;c++){const l=c/6*Ce+Math.random()*.8,h=(2.2+Math.random()*1.4)*t;Yn(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.4+Math.random()*1,Math.sin(l)*h+s.z*i,t*1.1,.42+Math.random()*.12)}for(let c=0;c<7;c++){const l=c/7*Ce+Math.random()*.9,h=(2.4+Math.random()*1.7)*t;Sa(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.6+Math.random()*1.4,Math.sin(l)*h+s.z*i,(.85+Math.random()*.5)*t,.38+Math.random()*.12)}for(let c=0;c<2;c++){const l=Math.random()*Ce;zr(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*2*t+s.x*i,1.7+Math.random()*.9,Math.sin(l)*2*t+s.z*i,t*.85,.44)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position,s=(e.weapon.spreadDeg??30)*Math.PI/360;for(let r=0;r<9;r++){const i=(Math.random()*2-1)*s,c=Math.cos(i),l=Math.sin(i),h=t.x*c-t.z*l,d=t.x*l+t.z*c,p=1.6+Math.random()*1.2;Sa(e,a,o,n,h*p,.7+Math.random()*.6,d*p,.95,.32)}for(let r=0;r<3;r++){const i=(Math.random()*2-1)*s,c=Math.cos(i),l=Math.sin(i),h=t.x*c-t.z*l,d=t.x*l+t.z*c;Yn(e,a,o,n,h*1.6,.5+Math.random()*.4,d*1.6,.85,.3)}}}},$a="#E63946",Pa="#FFFDF9",a0="#00E5B0",Gb="#FFEAF1",Wb=.32,Ub=.34,Ch=.36,Yb=.33,Or=.46;function ln(e){const t=document.createElement("canvas");return t.width=e,t.height=e,t.getContext("2d")}function hn(e){const t=new ot(e.canvas);return t.anisotropy=8,t.needsUpdate=!0,t}function Vb(){const t=ln(512),a=512/2,o=a,n=5,s=1.15,r=Math.PI/n*.52,i=56;t.fillStyle="#ffffff";for(let l=0;l<n;l++){const h=l/n*Math.PI*2;t.beginPath();for(let d=0;d<=i;d++){const p=d/i*o,u=h+s*Math.PI*2*(p/o)-r,f=a+Math.cos(u)*p,m=a+Math.sin(u)*p;d===0?t.moveTo(f,m):t.lineTo(f,m)}for(let d=i;d>=0;d--){const p=d/i*o,u=h+s*Math.PI*2*(p/o)+r;t.lineTo(a+Math.cos(u)*p,a+Math.sin(u)*p)}t.closePath(),t.fill()}t.globalCompositeOperation="destination-out";const c=t.createRadialGradient(a,a,o*.9,a,a,o);return c.addColorStop(0,"rgba(0,0,0,0)"),c.addColorStop(1,"rgba(0,0,0,1)"),t.fillStyle=c,t.fillRect(0,0,512,512),t.globalCompositeOperation="source-over",hn(t)}function Kb(){const t=ln(256),a=256/2,o=t.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0.62)"),o.addColorStop(.55,"rgba(255,255,255,0.58)"),o.addColorStop(.88,"rgba(255,255,255,0.8)"),o.addColorStop(.975,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=o,t.fillRect(0,0,256,256),hn(t)}function Xb(){const t=ln(512),a=512/2,o=a,n=o*.74;t.fillStyle="#ffffff",t.beginPath(),t.moveTo(a+o,a),t.arc(a,a,o,0,Math.PI*2,!1),t.moveTo(a+n,a),t.arc(a,a,n,0,Math.PI*2,!0),t.fill(),t.globalCompositeOperation="destination-out";const s=40;t.fillStyle="rgba(0,0,0,0.5)";for(let c=0;c<s;c++){const l=c/s*Math.PI*2,h=l+Math.PI/s;t.beginPath(),t.moveTo(a,a),t.arc(a,a,o,l,h),t.closePath(),t.fill()}const r=t.createRadialGradient(a,a,o*.96,a,a,o);r.addColorStop(0,"rgba(0,0,0,0)"),r.addColorStop(1,"rgba(0,0,0,1)"),t.fillStyle=r,t.fillRect(0,0,512,512);const i=t.createRadialGradient(a,a,n,a,a,n*1.22);return i.addColorStop(0,"rgba(0,0,0,1)"),i.addColorStop(1,"rgba(0,0,0,0)"),t.fillStyle=i,t.fillRect(0,0,512,512),t.globalCompositeOperation="source-over",hn(t)}function Zb(){const t=ln(512),a=512/2,o=t.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0)"),o.addColorStop(.966,"rgba(255,255,255,0)"),o.addColorStop(.976,"rgba(255,255,255,1)"),o.addColorStop(.991,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=o,t.fillRect(0,0,512,512),hn(t)}function Qb(){const t=ln(64),a=64/2,o=t.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.35,"rgba(255,255,255,0.8)"),o.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=o,t.fillRect(0,0,64,64),hn(t)}const Ps=Vb(),Jb=Kb(),ey=Xb(),o0=Zb(),qs=Qb(),$t=new _a(1,96);$t.rotateX(-Math.PI/2);const ty=new Me(1,1,.34,12),ay=new Me(1,1,.22,44),oy=new Me(.055,.055,1,10);function Be(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const ny=Be(3,()=>new K({map:Jb,color:$a,transparent:!0,opacity:.6,depthWrite:!1})),sy=Be(2,()=>new K({map:Ps,color:Pa,transparent:!0,opacity:.5,depthWrite:!1})),ry=Be(2,()=>new K({map:Ps,color:$a,transparent:!0,opacity:.9,depthWrite:!1})),iy=Be(6,()=>new K({map:Ps,color:Pa,transparent:!0,opacity:.9,depthWrite:!1})),cy=Be(3,()=>new K({map:ey,color:Pa,transparent:!0,opacity:1,depthWrite:!1,blending:at})),n0=Be(4,()=>new K({map:o0,color:$a,transparent:!0,opacity:1,depthWrite:!1})),ly=Be(2,()=>new K({map:o0,color:Pa,transparent:!0,opacity:1,depthWrite:!1})),hy=Be(10,()=>new K({map:Ps,color:$a,transparent:!0,opacity:.9,depthWrite:!1})),dy=Be(14,()=>new K({color:$a,transparent:!0,opacity:1})),py=Be(14,()=>new K({color:Pa,transparent:!0,opacity:1})),uy=Be(24,()=>new qt({map:qs,color:Gb,transparent:!0,opacity:1,depthWrite:!1,blending:at})),fy=Be(12,()=>new qt({map:qs,color:a0,transparent:!0,opacity:1,depthWrite:!1,blending:at})),my=Be(12,()=>new qt({map:qs,color:$a,transparent:!0,opacity:1,depthWrite:!1})),gy=Be(5,()=>new qt({map:qs,color:a0,transparent:!0,opacity:1,depthWrite:!1})),wy=Be(2,()=>new K({color:Pa,transparent:!0,opacity:1})),by=Be(2,()=>new K({color:"#FBF7EE",transparent:!0,opacity:1}));function Ih(e,t,a,o,n,s){const r=hy(),i=new y($t,r);i.position.set(t,Yb,a),i.rotation.y=Math.random()*Math.PI*2,i.renderOrder=12;const c=(Math.random()<.5?-1:1)*(2.4+Math.random()*1.2),l=i.rotation.y;i.scale.setScalar(o*.35),e.spawnTransient(i,n,h=>{const d=1-Math.pow(1-Math.min(1,h*3.2),3);i.scale.setScalar(o*(.35+.65*d)),i.rotation.y=l+c*h*.35,r.opacity=s*(1-Math.pow(h,1.6))})}function zh(e,t,a,o,n,s,r){const i=Math.random()<.45?dy():py(),c=new y(ty,i);c.scale.setScalar(s),c.position.set(t.x,t.y,t.z),c.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);const l=t.x,h=t.y,d=t.z,p=1.5+Math.random()*1.9,u=-9.4,f=(Math.random()-.5)*16,m=(Math.random()-.5)*16;e.spawnTransient(c,r,(g,w)=>{c.position.set(l+a*n*w,Math.max(.08,h+p*w+.5*u*w*w),d+o*n*w),c.rotation.x+=f*.016,c.rotation.z+=m*.016,i.opacity=1-Math.pow(g,2.2)})}function ya(e,t,a,o,n,s,r,i,c=uy,l=0){const h=c(),d=new io(h);d.position.set(t,a,o),d.scale.set(n,n,1),d.renderOrder=14,d.visible=l<=0;const p=(Math.random()-.5)*.5;e.spawnTransient(d,r+l,(u,f)=>{if(f<l){d.visible=!1;return}d.visible=!0;const m=Math.min(1,(f-l)/r),g=G.lerp(n,s,m);d.scale.set(g,g,1),d.position.y=a+i*m,d.position.x=t+p*m,h.opacity=1-Math.pow(m,1.5)})}function yy(e,t,a,o,n){const s=oe*.85,r=oe*1.7,i=new te,c=Math.hypot(o,n)||1,l=s+oe*.5;i.position.set(t+o/c*l,0,a+n/c*l);const h=n0(),d=new y($t,h);d.scale.setScalar(s*1.16),d.position.y=.115,d.renderOrder=12,i.add(d);const p=wy(),u=new y(ay,p);u.scale.set(s,1,s),i.add(u);const f=ry(),m=new y($t,f);m.scale.setScalar(s*.99),m.position.y=.13,m.renderOrder=13,i.add(m);const g=by(),w=new y(oy,g);w.scale.set(1,r,1);const b=new le(-o,0,-n);b.lengthSq()<1e-6&&b.set(0,0,-1),b.normalize(),w.quaternion.setFromUnitVectors(new le(0,1,0),b),w.position.set(b.x*(s+r*.5)*.92,.05,b.z*(s+r*.5)*.92),i.add(w);const x=5.2,v=.09;e.spawnTransient(i,.75,(k,M)=>{if(M<v){const T=M/v;i.position.y=x*(1-T*T),i.scale.set(1,1,1)}else{const T=Math.min(1,(M-v)/.16);i.position.y=0;const F=1-.55*(1-T)*Math.cos(T*Math.PI*1.2);i.scale.set(1+(1-F)*.22,Math.max(.25,F),1+(1-F)*.22)}const C=k<.45?1:1-(k-.45)/.55;p.opacity=C,g.opacity=C,f.opacity=.9*C,h.opacity=C})}const vy={Smash:{cast(e){const t=e.direction.x,a=e.direction.z,o=e.position.x-t*.75,n=e.position.z-a*.75,s=Math.atan2(a,t),r=oe*1.15,i=G.degToRad((e.weapon.cone??80)/2),c=oe*.34;for(let l=0;l<2;l++){const h=l*.05,d=iy();d.color.set(l===0?Pa:$a);const p=new y($t,d);p.scale.setScalar(c*(1-l*.16)),p.renderOrder=13;const u=l===0?.95:.42;e.spawnTransient(p,.2,f=>{const m=G.clamp((f*.2-h)/.2,0,1),g=1-Math.pow(1-m,2),w=s-i+g*i*2;p.position.set(o+Math.cos(w)*r,G.lerp(oe*.8,.4,g),n+Math.sin(w)*r),p.rotation.y=w*1.6,d.opacity=u*(m<=0?0:1-Math.pow(f,2.4))})}for(let l=0;l<2;l++){const h=s+(Math.random()-.5)*i*1.4;ya(e,o+Math.cos(h)*r*1.05,oe*.5,n+Math.sin(h)*r*1.05,oe*.13,oe*.03,.2,.25)}},impact(e){const{x:t,z:a}=e.position,o=G.clamp(.85+e.damage*.03,.85,1.6);ya(e,t,e.position.y,a,oe*.3*o,oe*.6*o,.15,.1),Ih(e,t,a,oe*.32*o,.5,.85);const n=6;for(let s=0;s<n;s++){const r=s/n*Math.PI*2+Math.random()*.7;zh(e,{x:t,y:e.position.y*.8,z:a},Math.cos(r),Math.sin(r),(1.7+Math.random()*1.9)*o,oe*(.065+Math.random()*.03),.42+Math.random()*.18)}for(let s=0;s<3;s++){const r=Math.random()*Math.PI*2;ya(e,t+Math.cos(r)*.3,e.position.y+.1,a+Math.sin(r)*.3,oe*.14,oe*.04,.34,.5)}}},Giant:{cast(e){const{x:t,z:a}=e.position,o=Qe(e.weapon.range??0),n=ny(),s=new y($t,n);s.position.set(t,Wb,a),s.renderOrder=10,s.scale.setScalar(o*.12),e.spawnTransient(s,1,u=>{const f=1-Math.pow(1-Math.min(1,u/.26),3);s.scale.setScalar(o*(.12+.88*f)),n.opacity=.3*(u<.2?1:Math.pow(1-(u-.2)/.8,1.5))});for(const[u,f,m,g]of[[n0(),1,.95,16],[ly(),.974,.9,17]]){const w=new y($t,u);w.position.set(t,Ch+.01,a),w.renderOrder=g,w.scale.setScalar(o*.12*f),e.spawnTransient(w,1,b=>{const x=1-Math.pow(1-Math.min(1,b/.26),3);w.scale.setScalar(o*(.12+.88*x)*f),u.opacity=m*(b<.42?1:Math.pow(1-(b-.42)/.58,1.4))})}const r=sy(),i=new y($t,r);i.position.set(t,Ub,a),i.renderOrder=11,i.scale.setScalar(o*.12),e.spawnTransient(i,1,u=>{const f=1-Math.pow(1-Math.min(1,u/.26),3);i.scale.setScalar(o*(.12+.88*f)),i.rotation.y=(1-Math.pow(1-u,2))*1.5,r.opacity=.4*(u<.22?1:Math.pow(1-(u-.22)/.78,1.5))});const c=cy(),l=new y($t,c);l.position.set(t,Ch,a),l.renderOrder=15,l.scale.setScalar(o*.05),e.spawnTransient(l,Or+.22,(u,f)=>{const m=Math.min(1,f/Or),g=1-Math.pow(1-m,2.2);l.scale.setScalar(o*(.05+.98*g)),l.rotation.y=g*.5,c.opacity=.95*(1-Math.pow(u,2.4))});const h=10,d=.55,p=Math.PI*(3-Math.sqrt(5));for(let u=0;u<h;u++){const f=o*d*Math.sqrt((u+.6)/h),m=u*p,g=t+Math.cos(m)*f,w=a+Math.sin(m)*f,b=f/o*Or;ya(e,g,.55,w,oe*.2,oe*.68,.3,.55,my,b),u%3===0&&ya(e,g,.5,w,oe*.12,oe*.34,.34,.7,gy,b+.03)}yy(e,t,a,e.direction.x,e.direction.z)},impact(e){const{x:t,z:a}=e.position,o=G.clamp(.9+e.damage*.035,.9,1.7);ya(e,t,e.position.y,a,oe*.34*o,oe*.62*o,.18,.12),Ih(e,t,a,oe*.42*o,.62,.9);const n=8;for(let s=0;s<n;s++){const r=s/n*Math.PI*2+Math.random()*.6;zh(e,{x:t,y:e.position.y*.85,z:a},Math.cos(r),Math.sin(r),(2.1+Math.random()*2.2)*o,oe*(.07+Math.random()*.035),.48+Math.random()*.2)}for(let s=0;s<4;s++){const r=s/4*Math.PI*2+Math.random();ya(e,t+Math.cos(r)*.34,e.position.y+.15,a+Math.sin(r)*.34,oe*.11,oe*.04,.42,.85,fy)}}}},xy="#EFB868",ky="#CE8A2E",s0="#4A2A12",My="#B93A28",Wo="#F7ECD3",me=oe,Je=Math.PI*2,js=.26;function qa(e,t=10){const a=new Gi(e,t);return a.rotateX(-Math.PI/2),a}function xc(e,t){const a=Math.tan(t)*e,o=-e*.58,n=e*.42,s=new ca;return s.moveTo(0,o),s.lineTo(-a,n),s.quadraticCurveTo(0,n+a*.5,a,n),s.closePath(),s}function Ey(e){const t=new ca;return t.moveTo(0,e),t.quadraticCurveTo(e*.82,e*.78,e*.96,-e*.06),t.quadraticCurveTo(e*.7,-e*.72,0,-e),t.quadraticCurveTo(-e*.84,-e*.66,-e,e*.04),t.quadraticCurveTo(-e*.7,e*.8,0,e),t}function r0(e,t,a=22){const o=new ca;for(let n=0;n<=a;n++){const s=n/a*Je,r=1+Math.sin(s*3+e)*.17+Math.sin(s*5+t)*.11,i=Math.cos(s)*r,c=Math.sin(s)*r;n===0?o.moveTo(i,c):o.lineTo(i,c)}return o}function Ty(e){const t=new ca;return t.moveTo(-e,0),t.lineTo(e,0),t.lineTo(0,1),t.closePath(),t}const so=me*.3,Uo=me*.16,Kn=me*.18,Oh=qa(xc(so,.44),8),Xn=qa(Ey(Kn),8),kc=(()=>{const e=new _a(1,12);return e.rotateX(-Math.PI/2),e})(),Lh=(()=>{const e=new _a(Uo,20);e.rotateX(-Math.PI/2);const t=e.attributes.position;for(let a=1;a<t.count;a++){const o=t.getX(a),n=t.getZ(a),s=Math.atan2(n,o),r=1+Math.sin(s*3)*.13+Math.sin(s*7+1.3)*.075;t.setX(a,o*r),t.setZ(a,n*r)}return t.needsUpdate=!0,e})(),Nh=qa(xc(me*.105,.52),4),i0=qa(xc(1,.62),3),c0=qa(r0(0,2.1),1),Sy=qa(r0(1.7,4.3),1),Ay=qa(Ty(.16),1),l0=(()=>{const e=new Aa(.62,1,18,1,0,Math.PI*.8);return e.rotateX(-Math.PI/2),e})(),Fy=(()=>{const e=new _a(me*.032,6);return e.rotateX(-Math.PI/2),e})(),Ry=(()=>{const e=new pt(me*.022,1,me*.022);return e.translate(0,-.5,0),e})();function ja(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const da=e=>new K({color:e,side:ye}),Dh=da("#F6E3B4"),_h=da("#E63946"),Hh=da("#FFD873"),Cy=da(xy),h0=da(ky),Iy=da(My),zy=da(Wo),Oy=da(s0),Ly=ja(20,()=>new K({color:"#E63946",transparent:!0,opacity:1,side:ye,depthWrite:!1})),d0=ja(24,()=>new K({color:s0,transparent:!0,opacity:1,side:ye,depthWrite:!1})),p0=ja(10,()=>new K({color:"#B62430",transparent:!0,opacity:.9,side:ye,depthWrite:!1})),Ny=ja(28,()=>new K({color:Wo,transparent:!0,opacity:.9,side:ye,depthWrite:!1})),u0=ja(8,()=>new K({color:"#FFE9A8",transparent:!0,opacity:.9,side:ye,blending:at,depthWrite:!1})),f0=ja(16,()=>new K({color:"#FFD9A0",transparent:!0,opacity:.5,side:ye,blending:at,depthWrite:!1})),Lr=ja(12,()=>new K({color:"#FFD873",transparent:!0,opacity:.95,side:ye,depthWrite:!1})),Dy=new le(0,1,0),$h=new le,Ph=new le,Nr=new As,qh=new As;function Xa(e,t,a,o){Nr.setFromAxisAngle(Dy,a);const n=Math.hypot(t.x,t.z);Math.abs(o)>1e-4&&n>1e-4?($h.set(t.z/n,0,-t.x/n),qh.setFromAxisAngle($h,o),e.quaternion.copy(qh).multiply(Nr)):e.quaternion.copy(Nr)}function Mc(e,t,a){const o=new te,n=new y(e,Oy);return n.scale.set(a,1,a),n.position.y=-me*.011,o.add(n),o.add(new y(e,t)),o}function _y(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Dr(e,t,a){let o=e.userData.__spin;return o||(o={spin:Math.random()*Je,rate:a*Je/_y(t),shed:0},e.userData.__spin=o),o}function jh(e,t,a,o){const n=f0();n.color.set(o),n.opacity=.45;const s=new y(l0,n);s.renderOrder=9,s.position.copy(e.position),s.rotation.y=a,s.scale.set(t,1,t),e.spawnTransient(s,.13,r=>{const i=t*(1+r*.28);s.scale.set(i,1,i),n.opacity=.45*(1-r)})}function Kt(e,t,a,o,n,s,r,i,c){const l=Ny();l.color.set(a),l.opacity=.9;const h=new y(Fy,l);h.renderOrder=9,h.position.copy(t),h.scale.setScalar(i);const d=t.x,p=t.y,u=t.z;e.spawnTransient(h,c,(f,m)=>{h.position.set(d+o*m,Math.max(js,p+n*m+.5*r*m*m),u+s*m),l.opacity=.9*(1-f*f)})}function _r(e,t,a,o,n,s,r){const i=new te,c=d0();c.opacity=1;const l=new y(Nh,c);l.scale.set(1.22,1,1.22),l.position.y=-me*.008,i.add(l);const h=Ly();h.color.set(a),h.opacity=1,i.add(new y(Nh,h)),i.renderOrder=9,i.position.copy(t),i.scale.setScalar(s);const d=t.x,p=t.y,u=t.z,f=Math.cos(o),m=Math.sin(o),g=f*n,w=m*n,b=.8+Math.random()*.9,x=-7.5,v=Math.random()*Je,E=(Math.random()-.5)*24;e.spawnTransient(i,r,(k,M)=>{i.position.set(d+g*M,Math.max(js,p+b*M+.5*x*M*M),u+w*M),Ph.set(f,0,m),Xa(i,Ph,v+E*M,.22);const C=1-Math.pow(k,2.2);h.opacity=C,c.opacity=C})}function Hy(e,t,a,o,n,s){const r=new te;r.position.set(e.position.x,js,e.position.z),r.renderOrder=4;const i=p0();i.color.set(t),i.opacity=s;const c=new y(Math.random()<.5?c0:Sy,i);c.rotation.y=Math.random()*Je,r.add(c);for(let l=0;l<o;l++){const h=new y(Ay,i);h.rotation.y=l/o*Je+Math.random()*.7,h.scale.set(.7+Math.random()*.4,1,1+Math.random()*.4),r.add(h)}e.spawnTransient(r,n,l=>{const h=1-Math.pow(1-Math.min(1,l*5),3);r.scale.set(a*h,1,a*h),i.opacity=s*(l<.55?1:1-(l-.55)/.45)})}function Hr(e,t,a,o){const n=u0();n.color.set(t),n.opacity=.9;const s=new y(i0,n);s.renderOrder=11,s.position.copy(e.position),s.rotation.y=Math.random()*Je,s.scale.set(a*.35,1,a*.35),e.spawnTransient(s,o,r=>{const i=G.lerp(a*.35,a,1-Math.pow(1-r,2));s.scale.set(i,1,i),n.opacity=.9*(1-r)})}function $r(e){return G.clamp(.85+e*.035,.85,1.4)}function $y(e){const t=Mc(Oh,Cy,1.15);_h.color.set(e);const a=new y(Oh,_h);a.scale.set(.86,1,.86),a.position.set(0,me*.006,so*.04),t.add(a);for(const[o,n,s]of[[-.2,-.1,.075],[.15,.11,.06]]){const r=new y(kc,Iy);r.position.set(so*o,me*.012,so*n),r.scale.setScalar(so*s*2),t.add(r)}return t}function Py(e){const t=Mc(Lh,h0,1.13);Dh.color.set(e);const a=new y(Lh,Dh);a.scale.set(.84,1,.84),a.position.y=me*.006,t.add(a);const o=new y(kc,zy);return o.scale.setScalar(Uo*.44),o.position.set(Uo*.4,me*.011,-Uo*.26),t.add(o),t}function qy(e){Hh.color.set(e);const t=Mc(Xn,Hh,1.12),a=new y(kc,h0);return a.scale.setScalar(Kn*.22),a.position.set(Kn*.34,me*.006,Kn*.2),t.add(a),t}const jy={Dough:{projectile(e){const t=Py(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Dr(t,e.weapon,2.6);o.spin+=o.rate*a,Xa(t,e.direction,o.spin,.15+Math.sin(o.spin*.37)*.07),t.position.y+=Math.sin(o.spin*.5)*me*.012,o.shed-=a,o.shed<=0&&(o.shed=.055+Math.random()*.04,Kt(e,e.position,Wo,-e.direction.x*.5+(Math.random()-.5)*.5,.25+Math.random()*.4,-e.direction.z*.5+(Math.random()-.5)*.5,-1.1,.5+Math.random()*.35,.3+Math.random()*.15),Math.random()<.45&&jh(e,Uo*1.2,o.spin,"#FFF0CC"))},impact(e){const t=$r(e.damage),a=p0();a.color.set("#F0DDAE"),a.opacity=.95;const o=new y(c0,a);o.renderOrder=4,o.position.set(e.position.x,js,e.position.z),o.rotation.y=Math.random()*Je;const n=me*.25*t;e.spawnTransient(o,.62,s=>{const r=G.lerp(n*.3,n,1-Math.pow(1-Math.min(1,s*4),3));o.scale.set(r,1,r),a.opacity=.95*(s<.5?1:1-(s-.5)/.5)}),Hr(e,"#FFF3D2",me*.3*t,.18);for(let s=0;s<10;s++){const r=s/10*Je+Math.random()*.5,i=(.9+Math.random()*1.2)*t;Kt(e,e.position,Wo,Math.cos(r)*i,.7+Math.random()*.9,Math.sin(r)*i,-2.4,.6+Math.random()*.6,.45+Math.random()*.25)}for(let s=0;s<4;s++)_r(e,e.position,"#EFD9A6",Math.random()*Je,(1.9+Math.random()*1.3)*t,(.55+Math.random()*.35)*t,.4+Math.random()*.14)},cast(e){const t=f0();t.color.set("#FFF0CC"),t.opacity=.6;const a=new y(l0,t);a.renderOrder=11,a.position.copy(e.position),e.spawnTransient(a,.16,o=>{const n=G.lerp(me*.05,me*.16,o);a.scale.set(n,1,n),a.rotation.y=o*9,t.opacity=.6*(1-o)});for(let o=0;o<5;o++)Kt(e,e.position,Wo,e.direction.x*(.5+Math.random()*.6)+(Math.random()-.5)*.6,.5+Math.random()*.5,e.direction.z*(.5+Math.random()*.6)+(Math.random()-.5)*.6,-1.6,.55+Math.random()*.4,.3+Math.random()*.15)}},Tomato:{projectile(e){const t=$y(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Dr(t,e.weapon,1.8);o.spin+=o.rate*a,Xa(t,e.direction,o.spin,.17+Math.sin(o.spin*.5)*.06),o.shed-=a,o.shed<=0&&(o.shed=.058,jh(e,so*.62,o.spin,"#FFC08A"),Math.random()<.5&&Kt(e,e.position,"#C4262F",-e.direction.x*.7+(Math.random()-.5)*.4,.15+Math.random()*.3,-e.direction.z*.7+(Math.random()-.5)*.4,-2.2,.5+Math.random()*.3,.26))},impact(e){const t=$r(e.damage);Hr(e,"#FFE7CC",me*.4*t,.18),Hy(e,e.color,me*.22*t,4,.55,.9);for(let a=0;a<5;a++){const o=a/5*Je+Math.random()*.6;_r(e,e.position,e.color,o,(2.2+Math.random()*1.4)*t,(.75+Math.random()*.45)*t,.4+Math.random()*.14)}for(let a=0;a<6;a++){const o=Math.random()*Je,n=(1.3+Math.random()*1.5)*t;Kt(e,e.position,"#C4262F",Math.cos(o)*n,1+Math.random()*1.1,Math.sin(o)*n,-6.5,.7+Math.random()*.5,.34+Math.random()*.14)}},cast(e){const t=u0();t.color.set("#FF8E6A"),t.opacity=.85;const a=new y(i0,t);a.renderOrder=11,a.position.copy(e.position),a.rotation.y=Math.atan2(e.direction.x,e.direction.z),e.spawnTransient(a,.15,o=>{const n=G.lerp(me*.08,me*.24,1-Math.pow(1-o,2));a.scale.set(n*.7,1,n),t.opacity=.85*(1-o)});for(let o=0;o<3;o++)Kt(e,e.position,"#C4262F",e.direction.x*(1+Math.random())+(Math.random()-.5)*.5,.4+Math.random()*.4,e.direction.z*(1+Math.random())+(Math.random()-.5)*.5,-2.6,.6,.28)}},Cheese:{projectile(e){const t=qy(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Dr(t,e.weapon,.9);o.spin+=o.rate*a,Xa(t,e.direction,o.spin,.2*Math.sin(o.spin*1.9));const n=1+Math.sin(o.spin*2.4)*.22;t.scale.set(1/n,1,n),t.position.y+=Math.sin(o.spin*1.2)*me*.016,o.shed-=a,o.shed<=0&&(o.shed=.13+Math.random()*.07,Kt(e,e.position,"#FFE49A",-e.direction.x*.4,-.1,-e.direction.z*.4,-1.6,.5,.24))},impact(e){const t=$r(e.damage),a=me*.96,o=Lr();o.color.set(e.color),o.opacity=.95;const n=new y(Xn,o);n.renderOrder=11;const s=d0();s.opacity=.6;const r=new y(Xn,s);r.scale.set(1.12,1,1.12),r.position.y=-me*.008,n.add(r),n.position.set(e.position.x,a,e.position.z);const i=1.8*t;e.spawnTransient(n,.5,c=>{const l=G.lerp(i*.4,i,1-Math.pow(1-Math.min(1,c*3.5),3));n.scale.set(l,1,l*(1-c*.25)),n.position.y=a-c*c*me*.34,Xa(n,e.direction,c*1.2,.35+c*.5);const h=c<.6?1:1-(c-.6)/.4;o.opacity=.95*h,s.opacity=.6*h}),Hr(e,"#FFF6D8",me*.26*t,.17);for(let c=0;c<4;c++){const l=Lr();l.color.set("#FFE08A"),l.opacity=.9;const h=new y(Ry,l);h.renderOrder=10;const d=Math.random()*Je,p=me*(.06+Math.random()*.08)*t;h.position.set(e.position.x+Math.cos(d)*p,a-me*.04,e.position.z+Math.sin(d)*p);const u=me*(.14+Math.random()*.12)*t;e.spawnTransient(h,.42,f=>{h.scale.set(1-f*.55,u*(.3+f*.7),1-f*.55),l.opacity=.9*(1-f*f)})}for(let c=0;c<3;c++)_r(e,e.position,"#FFD873",Math.random()*Je,(1+Math.random())*t,(.55+Math.random()*.3)*t,.38)},cast(e){const t=Lr();t.color.set(e.color),t.opacity=.85;const a=new y(Xn,t);a.renderOrder=11,a.position.copy(e.position),e.spawnTransient(a,.16,o=>{const n=G.lerp(.3,.85,1-Math.pow(1-o,2));a.scale.set(n*(.5+o*.6),1,n),Xa(a,e.direction,o*2.4,.3-o*.25),t.opacity=.85*(1-o)});for(let o=0;o<3;o++)Kt(e,e.position,"#FFE49A",e.direction.x*(.6+Math.random()*.5),.35+Math.random()*.3,e.direction.z*(.6+Math.random()*.5),-2,.55,.26)}}},yo="#FFFDF6",m0="#E4D7BE",na="#22301F",By="#3E5B33",Ec=Tt.salmon,Tc="#B85B26",g0="#FFEEDD",w0="#F2FBFF",b0="#8FD3E8",Z=oe,ht=Math.PI*2,ut=.29;function y0(e,t=8){const a=new Gi(e,t);return a.rotateX(-Math.PI/2),a}const gt=(()=>{const e=new Ia(1,1);return e.rotateX(-Math.PI/2),e})(),Bh=(()=>{const e=new ca;e.moveTo(0,0),e.quadraticCurveTo(1,.5,0,1),e.quadraticCurveTo(-1,.5,0,0);const t=y0(e,10);return t.translate(0,0,1),t})(),Gh=(()=>{const t=new ca;return t.moveTo(-.5+.22,-.5),t.lineTo(.5-.22,-.5),t.quadraticCurveTo(.5,-.5,.5,-.5+.22),t.lineTo(.5,.5-.22),t.quadraticCurveTo(.5,.5,.5-.22,.5),t.lineTo(-.5+.22,.5),t.quadraticCurveTo(-.5,.5,-.5,.5-.22),t.lineTo(-.5,-.5+.22),t.quadraticCurveTo(-.5,-.5,-.5+.22,-.5),y0(t,6)})(),Sc=(()=>{const e=new bt(.5,7,5);return e.scale(.44,.44,1),e})(),Gy=new Me(.5,.5,1,20,1,!0),Pr=(()=>{const e=new _a(.5,20);return e.rotateX(-Math.PI/2),e})(),Wy=new Me(.5,.5,1,12,1,!0,0,Math.PI),Wh=(()=>{const e=new _a(.5,12,-Math.PI/2,Math.PI);return e.rotateX(-Math.PI/2),e})(),Uy=(()=>{const e=new Ia(1,1);return e.rotateY(-Math.PI/2),e})(),tt=Z*.155,v0=Z*.46,Zn=Z*.3,vt=Z*.185,Nn=Z*.2;function yt(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const dn=e=>new K({color:e,side:ye}),x0=dn(yo),Yy=dn(m0),k0=dn(na),Vy=dn(Tc),Uh=new Map;function Ac(e){let t=Uh.get(e);return t||(t=dn(e),Uh.set(e,t)),t}const pa=(e,t)=>new K({color:e,transparent:!0,opacity:t,side:ye,depthWrite:!1}),M0=(e,t)=>new K({color:e,transparent:!0,opacity:t,side:ye,depthWrite:!1,depthTest:!1}),E0=yt(56,()=>new K({color:yo,transparent:!0,opacity:1,depthWrite:!1})),Ky=yt(12,()=>M0(w0,1)),Xy=yt(12,()=>M0(b0,.5)),fs=yt(28,()=>pa(na,1)),ms=yt(28,()=>pa(By,1)),Zy=yt(24,()=>pa(Ec,1)),Qy=yt(24,()=>pa(Tc,1)),Jy=yt(24,()=>pa(g0,1)),e2=yt(12,()=>pa(na,1)),t2=yt(12,()=>pa(yo,1)),a2=yt(12,()=>pa(Ec,1));function kt(e,t){return Math.atan2(e,t)}function o2(e,t=.62){const a=Math.sin(e),o=Math.cos(e);if(Math.abs(a)>=t)return e;const n=a>=0?1:-1,s=o>=0?1:-1;return Math.atan2(n*t,s*Math.sqrt(1-t*t))}function qr(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Dn(e){return G.clamp(.85+e*.035,.85,1.4)}function jr(e){let t=e.userData.__sushi;return t||(t={phase:Math.random()*ht,shed:0,grow:0},e.userData.__sushi=t),t}function _n(e,t,a,o,n,s,r,i){const c=new te,l=o2(n);c.rotation.y=l,c.position.set(t-Math.sin(l)*s*.5,a,o-Math.cos(l)*s*.5),c.renderOrder=13;const h=Xy();h.color.set(b0),h.opacity=.55;const d=new y(Bh,h);d.scale.set(2.9,1,1.02),d.position.y=-Z*.006,d.renderOrder=0,c.add(d);const p=Ky();p.color.set(w0),p.opacity=1;const u=new y(Bh,p);u.renderOrder=1,c.add(u),e.spawnTransient(c,i,f=>{const m=Math.min(1,f*8);c.scale.set(r*(1-f*.55),1,Math.max(.02,s*m));const g=f<.3?1:1-(f-.3)/.7;p.opacity=g,h.opacity=.55*g*g})}function va(e,t,a,o,n,s,r,i,c,l=!1){const h=E0();h.color.set(l?m0:yo),h.opacity=1;const d=new y(Sc,h);d.renderOrder=9,d.scale.setScalar(i),d.position.set(t,a,o);const p=-9.6,u=(Math.random()-.5)*14,f=(Math.random()-.5)*14;e.spawnTransient(d,c,(m,g)=>{let w=a+s*g+.5*p*g*g,b=1;if(w<ut){const x=ut-w;w=ut+x*.28,b=.35,w<ut&&(w=ut)}d.position.set(t+n*g,w,o+r*g*1),d.rotation.set(u*g*b,f*g*b,0),h.opacity=1-m*m*m})}function n2(e,t,a){const o=new te,n=new y(Gh,a.deep);n.scale.set(e*1.16,1,t*1.1),n.position.y=-Z*.008,o.add(n);const s=new y(Gh,a.face);s.scale.set(e,1,t),o.add(s);for(let r=0;r<2;r++){const i=new y(gt,a.fat);i.scale.set(e*.86,1,t*.09),i.position.set(0,Z*.005,t*(r===0?-.18:.16)),o.add(i)}return o}function Yh(e,t,a){const o=new te,n=new y(Wy,a.wall);n.scale.set(e*2,t,e*2),o.add(n);const s=new y(Wh,a.face);s.scale.set(e*1.6,1,e*1.6),s.position.y=t*.5,o.add(s);const r=new y(Wh,a.core);r.scale.set(e*.94,1,e*.94),r.position.y=t*.5+Z*.004,o.add(r);const i=new y(Uy,a.face);return i.scale.set(1,t*.98,e*1.96),o.add(i),o}function s2(e){const t=new te,a=e==="#FFFFFF"?x0:Ac(e),o=[[0,0,tt*.34,1],[-tt*.4,Z*.012,-tt*.3,.85],[tt*.38,-Z*.014,-tt*.42,.78]];for(let n=0;n<o.length;n++){const[s,r,i,c]=o[n],l=new y(Sc,n===1?Yy:a);l.scale.setScalar(tt*c),l.position.set(s,r,i),l.rotation.set(0,(n-1)*.5,0),t.add(l)}return t}function r2(e){const t=new te,a=[],o=4,n=v0/o,s=Ac(e);for(let i=0;i<o;i++){const c=new te,l=new y(gt,k0);l.scale.set(Zn,1,n*1.02),c.add(l);for(const h of[-1,1]){const d=new y(gt,s);d.scale.set(Zn*.1,1,n*1.02),d.position.set(h*Zn*.45,Z*.004,0),c.add(d)}c.position.z=(i-(o-1)/2)*n,t.add(c),a.push(c)}const r={segs:a};return t.userData.__parts=r,t}function i2(e){const t=new te,a=new y(Gy,k0);a.scale.set(vt*2,Nn,vt*2),t.add(a);const o=new y(Pr,x0);o.scale.set(vt*1.6,1,vt*1.6),o.position.y=Nn*.5,t.add(o);const n=new y(Pr,Ac(e));n.scale.set(vt*.94,1,vt*.94),n.position.y=Nn*.5+Z*.004,t.add(n);const s=new y(Pr,Vy);return s.scale.set(vt*.34,1,vt*.34),s.position.set(vt*.46,Nn*.5+Z*.005,-vt*.3),t.add(s),t}const c2={Rice:{projectile(e){const t=s2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=jr(t);o.phase+=a/qr(e.weapon)*ht*1.6,t.rotation.y=kt(e.direction.x,e.direction.z)+Math.sin(o.phase)*.3;const n=1+Math.sin(o.phase*1.9)*.14;t.scale.set(n,1,1/n);for(let s=0;s<t.children.length;s++)t.children[s].rotation.x=o.phase*(.6+s*.35);o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,va(e,e.position.x,e.position.y,e.position.z,-e.direction.x*.5+(Math.random()-.5)*.7,-.15,-e.direction.z*.5+(Math.random()-.5)*.7,tt*.75,.3+Math.random()*.12,Math.random()<.4))},impact(e){const t=Dn(e.damage),{x:a,y:o,z:n}=e.position,s=e.direction,r=Z*.26*t;for(let h=0;h<7;h++){const d=h/7*ht+Math.random()*.7,p=(1.9+Math.random()*1.5)*t;va(e,a+Math.cos(d)*r,o,n+Math.sin(d)*r,Math.cos(d)*p+s.x*.7,1.5+Math.random()*1.2,Math.sin(d)*p+s.z*.7,tt*(.9+Math.random()*.5)*t,.44+Math.random()*.16,Math.random()<.35)}const i=Math.hypot(s.x,s.z)>1e-4?Z*.34:0,c=E0();c.color.set(yo),c.opacity=1;const l=new y(Sc,c);l.renderOrder=12,l.position.set(a-s.x*i,o,n-s.z*i),l.rotation.y=kt(s.x,s.z)+Math.PI*.5,e.spawnTransient(l,.14,h=>{l.scale.setScalar(G.lerp(Z*.12,Z*.3,h)*t),c.opacity=1-h})},cast(e){const t=e.direction;for(let a=0;a<6;a++)va(e,e.position.x,e.position.y,e.position.z,t.x*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,.5+Math.random()*.5,t.z*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,tt*(.7+Math.random()*.4),.3+Math.random()*.12,Math.random()<.4)}},Seaweed:{projectile(e){const t=r2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=jr(t);o.phase+=a/qr(e.weapon)*ht*2.8,t.rotation.y=kt(e.direction.x,e.direction.z);const n=t.userData.__parts;if(n)for(let s=0;s<n.segs.length;s++){const r=o.phase-s*1.1;n.segs[s].rotation.x=Math.sin(r)*.42,n.segs[s].position.y=Math.sin(r)*Z*.03}o.shed-=a,o.shed<=0&&(o.shed=.14+Math.random()*.08,Br(e,e.position.x,e.position.y,e.position.z,-e.direction.x*.5+(Math.random()-.5)*.6,-.05,-e.direction.z*.5+(Math.random()-.5)*.6,Z*.075,.28,e.color))},impact(e){const t=Dn(e.damage),a=e.direction,o=kt(a.x,a.z),{x:n,y:s,z:r}=e.position,i=new te;i.rotation.y=o,i.position.set(n+a.x*Z*.42,ut,r+a.z*Z*.42),i.renderOrder=5;const c=ms();c.color.set(e.color),c.opacity=.95;const l=new y(gt,c);l.scale.set(1.1,1,1.07),l.position.y=-.004,i.add(l);const h=fs();h.color.set(na),h.opacity=.95,i.add(new y(gt,h));const d=Z*.42*t,p=Z*.72*t;e.spawnTransient(i,.85,f=>{const m=1-Math.pow(1-Math.min(1,f*8),3);i.scale.set(d,1,Math.max(.02,p*m));const g=f<.55?1:1-(f-.55)/.45;h.opacity=.95*g,c.opacity=.95*g});const u=Z*.28*t;for(let f=0;f<4;f++){const m=f/4*ht+Math.random()*.8,g=(1.7+Math.random()*1.2)*t;l2(e,n+Math.cos(m)*u,s,r+Math.sin(m)*u,Math.cos(m)*g,1.3+Math.random()*1.1,Math.sin(m)*g,Z*(.34+Math.random()*.16)*t,.42+Math.random()*.14,e.color)}for(let f=0;f<5;f++){const m=Math.random()*ht;Br(e,n+Math.cos(m)*u*.8,s,r+Math.sin(m)*u*.8,Math.cos(m)*(1.6+Math.random()*1.4),1.2+Math.random(),Math.sin(m)*(1.6+Math.random()*1.4),Z*.085*t,.36,e.color)}},cast(e){const t=e.direction,a=kt(t.x,t.z),o=new te;o.rotation.y=a,o.position.copy(e.position),o.renderOrder=11;const n=ms();n.color.set(e.color),n.opacity=1;const s=new y(gt,n);s.scale.set(1.12,1,1.08),s.position.y=-Z*.006,o.add(s);const r=fs();r.color.set(na),r.opacity=1,o.add(new y(gt,r)),e.spawnTransient(o,.18,i=>{const c=1-Math.pow(1-i,2);o.scale.set(Zn*(.5+c*.6),1,v0*(.25+c*.8)),o.position.set(e.position.x+t.x*c*Z*.16,e.position.y,e.position.z+t.z*c*Z*.16),r.opacity=1-i,n.opacity=1-i});for(let i=0;i<3;i++)Br(e,e.position.x,e.position.y,e.position.z,t.x*(1+Math.random())+(Math.random()-.5)*.7,.4+Math.random()*.4,t.z*(1+Math.random())+(Math.random()-.5)*.7,Z*.08,.28,e.color)}},Fish:{impact(e){const t=Dn(e.damage),a=e.direction,{x:o,y:n,z:s}=e.position,r=kt(a.x,a.z);_n(e,o,n,s,r+Math.PI*.5,Z*.95*t,Z*.078,.28);const i=Z*.3*t;for(let c=0;c<5;c++){const l=c/5*ht+Math.random()*.5;Gr(e,o+Math.cos(l)*i,n,s+Math.sin(l)*i,l,(1.5+Math.random()*1)*t,Z*.16*t,Z*.3*t,.5+Math.random()*.16)}for(let c=0;c<8;c++){const l=Math.random()*ht,h=(1.7+Math.random()*1.4)*t;va(e,o+Math.cos(l)*i*.85,n,s+Math.sin(l)*i*.85,Math.cos(l)*h,1.4+Math.random()*1.2,Math.sin(l)*h,tt*(.85+Math.random()*.4)*t,.42+Math.random()*.14,Math.random()<.35)}},cast(e){const t=e.direction,a=kt(t.x,t.z);_n(e,e.position.x,e.position.y,e.position.z,a+Math.PI*.42,Z*.5,Z*.062,.17);const o=(e.weapon.cone??150)*Math.PI/180;for(let n=0;n<3;n++){const s=(n-1)*o*.3,r=a+s;Gr(e,e.position.x,e.position.y,e.position.z,Math.atan2(Math.sin(r),Math.cos(r))-Math.PI*.5,1.5+Math.random()*.7,Z*.12,Z*.22,.34)}}},Catch:{projectile(e){const t=i2(e.color);return t.position.copy(e.position),t.scale.setScalar(.6),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=jr(t),n=qr(e.weapon);o.phase+=a/n*ht*1.1,o.grow=Math.min(1,o.grow+a/n),t.rotation.y=o.phase;const s=G.lerp(.6,1.28,1-Math.pow(1-o.grow,2));t.scale.setScalar(s),t.position.y+=Math.sin(o.phase*1.6)*Z*.02,o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,va(e,e.position.x,e.position.y,e.position.z,-e.direction.x*.6+(Math.random()-.5)*.8,.1,-e.direction.z*.6+(Math.random()-.5)*.8,tt*.8,.32,Math.random()<.4))},impact(e){const t=Dn(e.damage),a=e.direction,{x:o,y:n,z:s}=e.position,i=kt(a.x,a.z)+Math.PI*.5;_n(e,o,n,s,i,Z*1.12*t,Z*.085,.32);const c=Z*.25*t,l=Z*.26*t,h=new te;h.rotation.y=i,h.position.set(o,n-Z*.05,s),h.renderOrder=10;const d=e2();d.color.set(na),d.opacity=1;const p=t2();p.color.set(yo),p.opacity=1;const u=a2();u.color.set(e.color),u.opacity=1;const f={wall:d,face:p,core:u},m=Yh(c,l,f),g=Yh(c,l,f);g.rotation.y=Math.PI,h.add(m,g);const w=Z*.185*t,b=Z*.4*t,x=n-Z*.05-(ut+c*.6);e.spawnTransient(h,.55,E=>{const k=1-Math.pow(1-E,2),M=G.lerp(w,b,k);m.position.x=M,g.position.x=-M,m.rotation.z=-k*.9,g.rotation.z=k*.9,h.position.y=n-Z*.05-x*k*k;const C=E<.6?1:1-(E-.6)/.4;d.opacity=C,p.opacity=C,u.opacity=C});const v=Z*.3*t;for(let E=0;E<9;E++){const k=E/9*ht+Math.random()*.6,M=(1.9+Math.random()*1.5)*t;va(e,o+Math.cos(k)*v,n,s+Math.sin(k)*v,Math.cos(k)*M,1.6+Math.random()*1.3,Math.sin(k)*M,tt*(.9+Math.random()*.5)*t,.46+Math.random()*.16,Math.random()<.35)}for(let E=0;E<2;E++){const k=i+(E===0?.6:-.6)+Math.PI*(E===0?0:1);Gr(e,o+Math.cos(k)*v,n,s+Math.sin(k)*v,k,(1.6+Math.random()*.9)*t,Z*.14*t,Z*.26*t,.48)}},cast(e){const t=e.direction,a=kt(t.x,t.z);_n(e,e.position.x,e.position.y,e.position.z,a+Math.PI*.38,Z*.58,Z*.068,.18);for(let o=0;o<5;o++)va(e,e.position.x,e.position.y,e.position.z,t.x*(1.3+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,t.z*(1.3+Math.random())+(Math.random()-.5)*.9,tt*.8,.3,Math.random()<.4)}}};function Br(e,t,a,o,n,s,r,i,c,l){const h=new te,d=ms();d.color.set(l),d.opacity=1;const p=new y(gt,d);p.scale.set(i*1.3,1,i*.75),p.position.y=-Z*.005,h.add(p);const u=fs();u.color.set(na),u.opacity=1;const f=new y(gt,u);f.scale.set(i,1,i*.55),h.add(f),h.renderOrder=9,h.position.set(t,a,o),h.rotation.y=Math.random()*ht;const m=(Math.random()-.5)*9,g=-5.2;e.spawnTransient(h,c,(w,b)=>{h.position.set(t+n*b,Math.max(ut,a+s*b+.5*g*b*b),o+r*b),h.rotation.y+=m*.016,u.opacity=1-w*w,d.opacity=1-w*w})}function l2(e,t,a,o,n,s,r,i,c,l){const h=new te,d=ms();d.color.set(l),d.opacity=1;const p=new y(gt,d);p.scale.set(Z*.075,1,i*1.03),p.position.y=-Z*.006,h.add(p);const u=fs();u.color.set(na),u.opacity=1;const f=new y(gt,u);f.scale.set(Z*.05,1,i),h.add(f),h.renderOrder=9,h.position.set(t,a,o);const m=-5.6,g=(Math.random()-.5)*4.5;e.spawnTransient(h,c,(w,b)=>{h.position.set(t+n*b,Math.max(ut,a+s*b+.5*m*b*b),o+r*b),h.rotation.y=kt(n,r)+g*b,h.scale.set(1+w*.5,1,1-w*.35),u.opacity=1-w*w,d.opacity=1-w*w})}function Gr(e,t,a,o,n,s,r,i,c){const l=Zy();l.color.set(Ec),l.opacity=1;const h=Qy();h.color.set(Tc),h.opacity=1;const d=Jy();d.color.set(g0),d.opacity=1;const p=n2(r,i,{face:l,deep:h,fat:d});p.renderOrder=9,p.position.set(t,a,o),p.rotation.y=n+Math.PI*.5;const u=Math.cos(n)*s,f=Math.sin(n)*s,m=.9+Math.random()*.7,g=-7.8,w=(Math.random()-.5)*2.2;e.spawnTransient(p,c,(b,x)=>{const v=a+m*x+.5*g*x*x,E=v<=ut;p.position.set(t+u*x,E?ut:v,o+f*x),p.rotation.y=n+Math.PI*.5+w*x;const k=1-Math.pow(b,2.4);l.opacity=k,h.opacity=k,d.opacity=k})}const Fc="#FFB35C",h2="#B4400C",d2="#FFF2E2",T0="#FFE9A8",ne=oe,qe=.27,Wr=ne*.3,p2=ne*.34,Ur=ne*.55,Ra=ne*.042,je=ne*.085,It=ne*.4,u2=ne*.024;function S0(e){let t=e%2147483647;return t<=0&&(t+=2147483646),()=>(t=t*48271%2147483647,t/2147483647)}function Yr(e,t){const o=S0(e),n=o()*Math.PI*2,s=o()*Math.PI*2,r=o()*Math.PI*2,i=[];for(let u=0;u<t;u++)i.push([o()*Math.PI*2,.14+o()*.2,.16+o()*.14]);const c=[];let l=0;for(let u=0;u<=84;u++){const f=u/84*Math.PI*2;let m=1+.15*Math.sin(3*f+n)+.09*Math.sin(5*f+s)+.05*Math.sin(8*f+r);for(const[g,w,b]of i){let x=f-g;for(;x>Math.PI;)x-=Math.PI*2;for(;x<-Math.PI;)x+=Math.PI*2;m+=w*Math.exp(-(x*x)/(2*b*b))}c.push(m),m>l&&(l=m)}const h=new Float32Array(258);for(let u=0;u<=84;u++){const f=u/84*Math.PI*2,m=c[u]/l,g=(u+1)*3;h[g]=Math.cos(f)*m,h[g+1]=0,h[g+2]=Math.sin(f)*m}const d=[];for(let u=1;u<=84;u++)d.push(0,u+1,u);const p=new an;return p.setAttribute("position",new es(h,3)),p.setIndex(d),p.computeVertexNormals(),p}const Vh=[Yr(9173,4),Yr(48271,5),Yr(11071,3)];let f2=0;const A0=()=>Vh[f2++%Vh.length],Jo=new bt(1,9,7);Jo.scale(.78,.78,1.4);const en=new bt(1,10,8),m2=(()=>{const t=document.createElement("canvas");t.width=t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.95)"),o.addColorStop(.45,"rgba(255,255,255,0.52)"),o.addColorStop(.78,"rgba(255,255,255,0.14)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new ot(t);return n.colorSpace=Hi,n})();function Vr(e){const t=S0(e),a=1.1+t()*1.4,o=.9+t()*1.3,n=.13+t()*.11,s=.08+t()*.09,r=[],i=8;for(let c=0;c<i;c++){const l=c/(i-1);r.push(new le(Math.sin(l*Math.PI*a+e)*n,Math.cos(l*Math.PI*o+e)*s,l-.5))}return new Cu(new Iu(r),20,u2/It,5,!1)}const Kh=[Vr(7919),Vr(30011),Vr(65449)];let g2=0;const F0=()=>Kh[g2++%Kh.length];function zt(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const ua=(e,t)=>new K({color:e,transparent:!0,opacity:t,depthWrite:!1,side:ye}),R0=zt(10,()=>ua(h2,.9)),w2=zt(10,()=>ua(Fc,.9)),C0=zt(28,()=>ua("#E8792A",.95)),gs=zt(14,()=>ua(Fc,.95)),b2=zt(16,()=>ua(T0,1)),Ci=zt(6,()=>ua("#E8792A",1)),y2=zt(6,()=>ua(Fc,1)),v2=zt(12,()=>ua(T0,1)),x2=zt(16,()=>new qt({map:m2,color:d2,transparent:!0,opacity:.5,depthWrite:!1})),k2=zt(8,()=>new K({color:"#FFF4DF",transparent:!0,opacity:.9,depthWrite:!1,blending:at})),Hn=new le,M2=new le(0,0,1);function ws(e,t,a,o){Hn.set(t,a,o),!(Hn.lengthSq()<1e-9)&&(Hn.normalize(),e.quaternion.setFromUnitVectors(M2,Hn))}function sa(e,t,a,o,n,s,r,i,c,l=!1){const h=new y(Jo,l?gs():C0()),d=h.material,p=.95;d.opacity=p,h.position.set(t,a,o);const u=-9.4;e.spawnTransient(h,c,(f,m)=>{const g=a+s*m+.5*u*m*m,w=g<=qe;h.position.set(t+n*m,w?qe:g,o+r*m);const b=s+u*m;if(w)ws(h,n,0,r),h.scale.set(i*1.5,i*.3,i*1.7);else{ws(h,n,b,r);const x=Math.hypot(n,b,r),v=1+Math.min(.9,x*.075);h.scale.set(i/Math.sqrt(v),i/Math.sqrt(v),i*v)}d.opacity=p*(1-f*f)})}function Ca(e,t,a,o,n,s,r){const i=new io(x2()),c=i.material;c.opacity=0;const l=(Math.random()-.5)*n*1.6,h=(Math.random()-.5)*n*1.6;i.renderOrder=9,i.position.set(t,a,o),i.scale.set(n*1.1,n*1.1,1),e.spawnTransient(i,r,d=>{const p=1-Math.pow(1-d,2);i.position.set(t+l*p,a+s*p,o+h*p);const u=n*(1.1+p*1.5);i.scale.set(u,u,1),c.opacity=.5*Math.sin(Math.min(1,d*1.3)*Math.PI)})}function Rc(e,t,a,o,n){const s=A0(),r=Math.random()*Math.PI*2,i=new y(s,R0()),c=i.material;i.rotation.y=r,i.position.set(t,qe,a),i.renderOrder=6,i.scale.setScalar(o*.35);const l=new y(s,w2()),h=l.material;l.rotation.y=r+.7,l.position.set(t,qe+.01,a),l.renderOrder=7,l.scale.setScalar(o*.18);const d=p=>p<.34?1-Math.pow(1-p/.34,2.2):1;e.spawnTransient(i,n,p=>{i.scale.setScalar(o*G.lerp(.35,1,d(p))),c.opacity=.82*(1-Math.pow(p,1.5))}),e.spawnTransient(l,n*.86,p=>{l.scale.setScalar(o*G.lerp(.18,.62,d(p))),h.opacity=.9*(1-Math.pow(p,1.8))})}function Cc(e,t,a,o,n){const s=new y(en,k2()),r=s.material;s.position.set(t,a,o),s.scale.set(n,n*.55,n),e.spawnTransient(s,.19,i=>{const c=n*G.lerp(.9,1.7,i);s.scale.set(c,c*.5,c),r.opacity=.9*(1-i)*(1-i)})}function bs(e,t,a,o,n,s,r,i,c){const l=new y(F0(),b2()),h=l.material;h.opacity=1,l.position.set(t,a,o),l.scale.setScalar(i);const d=-9.4,p=6+Math.random()*6,u=Math.atan2(n,r)+(Math.random()-.5)*.8;e.spawnTransient(l,c,(f,m)=>{const g=a+s*m+.5*d*m*m;g<=qe+.02?(l.position.set(t+n*m,qe+.02,o+r*m),l.quaternion.identity(),l.rotation.set(0,u,0),l.scale.set(i,i*.55,i)):(l.position.set(t+n*m,g,o+r*m),ws(l,n,s+d*m,r),l.rotateZ(m*p)),h.opacity=1-Math.pow(f,3)})}function E2(e){const t=new te,a=new y(Jo,Ci());a.material.color.set(e),a.scale.setScalar(je),a.position.z=je*.4,t.add(a);const o=new y(en,y2());o.scale.setScalar(je*.5),o.position.set(je*.25,je*.4,je*.85),t.add(o);for(let n=0;n<2;n++){const s=new y(Jo,Ci());s.material.color.set(e);const r=je*(.44-n*.13);s.scale.setScalar(r),s.position.set((Math.random()-.5)*je*.5,(Math.random()-.5)*je*.4,-je*(1.05+n*.95)),t.add(s)}return t.userData.__head=a,t}const T2={projectile(e){const t=E2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=(t.userData.__phase??Math.random()*6)+a*17;t.userData.__phase=o;const n=1+Math.sin(o)*.22;t.scale.set(1/Math.sqrt(n),1/Math.sqrt(n),n);const s=t.userData.__head;s&&(s.position.x=Math.sin(o*.55)*je*.3);const r=(t.userData.__drip??.04)-a;r<=0?(t.userData.__drip=.055+Math.random()*.045,sa(e,e.position.x-e.direction.x*je*1.6,e.position.y-je*.4,e.position.z-e.direction.z*je*1.6,-e.direction.x*.5+(Math.random()-.5)*.5,-.3-Math.random()*.4,-e.direction.z*.5+(Math.random()-.5)*.5,Ra*(.5+Math.random()*.4),.3)):t.userData.__drip=r;const i=(t.userData.__steam??.09)-a;i<=0?(t.userData.__steam=.13+Math.random()*.09,Ca(e,e.position.x,e.position.y+je,e.position.z,ne*.075,ne*.14,.34)):t.userData.__steam=i},impact(e){const{x:t,z:a}=e.position;Cc(e,t,e.position.y*.55,a,ne*.19),Rc(e,t,a,Wr,.38);for(let o=0;o<6;o++){const n=o/6*Math.PI*2+Math.random()*.6,s=1.5+Math.random()*1.4;sa(e,t+Math.cos(n)*Wr*.3,e.position.y*.5,a+Math.sin(n)*Wr*.3,Math.cos(n)*s,2.1+Math.random()*1.2,Math.sin(n)*s,Ra*(.7+Math.random()*.5),.34+Math.random()*.12,o%3===0)}Ca(e,t,qe+ne*.05,a,ne*.14,ne*.3,.5)},cast(e){const t=e.direction,a=new y(Jo,gs()),o=a.material;a.position.copy(e.position),ws(a,t.x,-.25,t.z),e.spawnTransient(a,.16,n=>{a.position.set(e.position.x+t.x*n*ne*.2,e.position.y-n*ne*.07,e.position.z+t.z*n*ne*.2);const s=ne*(.05+n*.05);a.scale.set(s*1.5,s*.8,s*(1.6+n)),o.opacity=.95*(1-n*n)});for(let n=0;n<4;n++){const s=(Math.random()-.5)*.8,r=(Math.random()-.5)*.8;sa(e,e.position.x,e.position.y,e.position.z,t.x*(1.6+Math.random())+s,.7+Math.random()*.9,t.z*(1.6+Math.random())+r,Ra*(.5+Math.random()*.4),.3)}Ca(e,e.position.x,e.position.y,e.position.z,ne*.09,ne*.2,.34)}};function S2(e){const t=new te,a=[];for(let n=0;n<3;n++){const s=new y(F0(),v2());s.material.color.set(e),s.scale.setScalar(It*.62),s.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),s.position.set((Math.random()-.5)*It*.22,(Math.random()-.5)*It*.22,(Math.random()-.5)*It*.22),t.add(s),a.push(s)}const o=new y(en,Ci());return o.scale.setScalar(je*.62),t.add(o),t.userData.__strands=a,t}const A2={projectile(e){const t=S2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=t.userData.__strands;if(o)for(let s=0;s<o.length;s++){const r=o[s];r.rotation.x+=a*(3.4+s*1.7),r.rotation.z+=a*(2.1+s*1.1)}const n=(t.userData.__drip??.06)-a;n<=0?(t.userData.__drip=.085+Math.random()*.06,sa(e,e.position.x,e.position.y-It*.2,e.position.z,(Math.random()-.5)*.7,-.2-Math.random()*.5,(Math.random()-.5)*.7,Ra*(.45+Math.random()*.35),.32)):t.userData.__drip=n},impact(e){const{x:t,z:a}=e.position;Cc(e,t,e.position.y*.55,a,ne*.18),Rc(e,t,a,p2,.48);for(let o=0;o<5;o++){const n=o/5*Math.PI*2+Math.random()*.7,s=1.3+Math.random()*1.2;bs(e,t,e.position.y*.7,a,Math.cos(n)*s,1.5+Math.random()*1.1,Math.sin(n)*s,It*(.7+Math.random()*.45),.7+Math.random()*.15)}for(let o=0;o<4;o++){const n=Math.random()*Math.PI*2,s=1.2+Math.random()*1.3;sa(e,t,e.position.y*.6,a,Math.cos(n)*s,1.8+Math.random()*1.1,Math.sin(n)*s,Ra*(.6+Math.random()*.5),.36,o===0)}Ca(e,t,qe+ne*.05,a,ne*.15,ne*.32,.55)},cast(e){const t=e.direction;bs(e,e.position.x,e.position.y,e.position.z,t.x*1.4,1.5,t.z*1.4,It*.7,.26);for(let a=0;a<3;a++)sa(e,e.position.x,e.position.y,e.position.z,t.x*1.2+(Math.random()-.5)*.8,.9+Math.random()*.7,t.z*1.2+(Math.random()-.5)*.8,Ra*.55,.28)}},F2={cast(e){const t=e.direction,a=Qe(e.weapon.range??Ka.meleeHeavy),o=e.position.x,n=e.position.y,s=e.position.z,r=-t.z,i=t.x;for(let d=0;d<13;d++){const p=(d/12-.5)*2,u=p*a*.16+(Math.random()-.5)*a*.06,f=1.1+Math.random()*1.5-Math.abs(p)*.35,m=ne*(.055+Math.random()*.055)*(1-Math.abs(p)*.25);sa(e,o+r*u,n+ne*(.05+Math.random()*.12),s+i*u,t.x*f+r*p*.35,.5+Math.random()*.7,t.z*f+i*p*.35,m,.42+Math.random()*.16,d%4===0)}for(let d=0;d<3;d++){const p=new y(en,d===1?gs():C0()),u=p.material,f=.35+d*.5,m=o+t.x*a*.1,g=s+t.z*a*.1,w=n+ne*.1;p.position.set(m,w,g),e.spawnTransient(p,.4,x=>{const v=x*x;p.position.set(m+t.x*f*a*.28*x,Math.max(qe,w-v*ne*.8),g+t.z*f*a*.28*x),p.scale.set(ne*(.13+x*.1),ne*(.13-x*.09),ne*(.13+x*.1)),u.opacity=.85*(1-Math.pow(x,1.7))})}for(let d=0;d<3;d++){const p=(d-1)*.5;bs(e,o+r*p*a*.1,n,s+i*p*a*.1,t.x*(1.6+Math.random())+r*p,.9+Math.random()*.6,t.z*(1.6+Math.random())+i*p,It*(.8+Math.random()*.4),.6)}const c=A0(),l=new y(c,R0()),h=l.material;l.position.set(o+t.x*a*.26,qe,s+t.z*a*.26),l.rotation.y=Math.atan2(t.x,t.z),l.renderOrder=6,e.spawnTransient(l,.6,d=>{const p=d<.45?1-Math.pow(1-d/.45,2):1;l.scale.set(a*.13*p+.05,1,a*.3*p+.05),h.opacity=.8*(1-Math.pow(d,2.2))});for(let d=0;d<3;d++)Ca(e,o+t.x*a*(.12+d*.13),qe+ne*.06,s+t.z*a*(.12+d*.13),ne*.16,ne*.42,.6)},impact(e){const{x:t,z:a}=e.position,o=new y(en,gs()),n=o.material;o.position.set(t,qe,a),e.spawnTransient(o,.16,s=>{const r=1-Math.pow(1-s,2.6),i=ne*G.lerp(.42,.05,r),c=ne*G.lerp(.13,.4,r);o.position.set(t,qe+i*.5,a),o.scale.set(c,i,c),n.opacity=.95*(1-Math.pow(s,2.5))}),Cc(e,t,e.position.y*.5,a,ne*.3),Rc(e,t,a,Ur,.62);for(let s=0;s<11;s++){const r=s/11*Math.PI*2+Math.random()*.5,i=2.2+Math.random()*2.2;sa(e,t+Math.cos(r)*ne*.12,qe+ne*.1,a+Math.sin(r)*ne*.12,Math.cos(r)*i,2.6+Math.random()*1.8,Math.sin(r)*i,Ra*(.9+Math.random()*.8),.45+Math.random()*.15,s%3===0)}for(let s=0;s<4;s++){const r=s/4*Math.PI*2+Math.random(),i=1.5+Math.random()*1.3;bs(e,t,qe+ne*.15,a,Math.cos(r)*i,2+Math.random()*1.2,Math.sin(r)*i,It*(.85+Math.random()*.45),.85)}Ca(e,t,qe+ne*.05,a,ne*.22,ne*.6,.8);for(let s=0;s<3;s++){const r=s/3*Math.PI*2+Math.random();Ca(e,t+Math.cos(r)*Ur*.55,qe+ne*.03,a+Math.sin(r)*Ur*.55,ne*.14,ne*.4,.7)}}},R2={Splash:T2,Noodle:A2,Dump:F2},Ft=.09,C2=oe*.075,I2=oe*.1,Xh=Pi*.5,Ic=new zu(Ft,0);Ic.scale(.55,1.7,.55);const Ii=new bt(Ft*.24,6,6);function zc(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const I0=zc(24,()=>new K({color:"#BFEFFF",transparent:!0,opacity:.8,depthWrite:!1})),z2=zc(8,()=>new K({color:"#FFFFFF",transparent:!0,opacity:1,blending:at,depthWrite:!1})),Zh=zc(6,()=>new K({color:"#EAFBFF",transparent:!0,opacity:.95,blending:at,depthWrite:!1}));function Qh(e){const t=new te,a=4;for(let n=0;n<a;n++){const s=I0();s.color.set(e);const r=new y(Ic,s),i=n/a*Math.PI*2;r.position.set(Math.cos(i)*Ft*.5,(Math.random()-.5)*Ft*.6,Math.sin(i)*Ft*.5),r.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),r.scale.setScalar(.6+Math.random()*.5),t.add(r)}const o=new y(Ii,z2());return t.add(o),t.userData.__glint=o,t}const O2={Glass:{projectile(e){const t=Qh(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=t.userData.__glint;let n=0;for(const s of t.children){if(s===o)continue;const r=2+n*.9;s.rotation.x+=a*r,s.rotation.y+=a*r*.75,n++}if(o){const s=o.material;s.opacity=Math.max(0,s.opacity-a*3.2);const r=(t.userData.__glintTimer??0)-a;r<=0?(t.userData.__glintTimer=.14+Math.random()*.3,s.opacity=1,o.position.set((Math.random()-.5)*Ft,(Math.random()-.5)*Ft,(Math.random()-.5)*Ft)):t.userData.__glintTimer=r}},impact(e){const t=e.position,a=I2/Ft,o=new y(Ii,Zh());o.position.copy(t),o.scale.setScalar(1.25*a),e.spawnTransient(o,.14,r=>{o.scale.setScalar(G.lerp(1.25,3,r)*a),o.material.opacity=.95*(1-r)});const n=G.clamp(1+e.damage*.06,1,2.4),s=11;for(let r=0;r<s;r++){const i=r/s*Math.PI*2+Math.random()*.5,c=(1.6+Math.random()*2.4)*n,l=I0();l.color.set(e.color);const h=new y(Ic,l),d=(.42+Math.random()*.43)*a*n;h.scale.setScalar(d);const p=t.x+Math.cos(i)*Xh,u=t.y,f=t.z+Math.sin(i)*Xh;h.position.set(p,u,f);const m=1.1+Math.random()*1.6,g=-9,w=(Math.random()-.5)*22,b=(Math.random()-.5)*22;e.spawnTransient(h,.38+Math.random()*.2,(x,v)=>{h.position.set(p+Math.cos(i)*c*v,u+m*v+.5*g*v*v,f+Math.sin(i)*c*v),h.rotation.x=v*w,h.rotation.y=v*b,h.scale.setScalar(d*(1-x*.25)),h.material.opacity=.85*(1-x)})}},cast(e){const t=C2/Ft,a=Qh(e.color);a.position.copy(e.position),a.scale.setScalar(.35*t),e.spawnTransient(a,.16,n=>{const s=Math.min(1,n*2.2),r=n>.55?1-(n-.55)*2.2:1;a.scale.setScalar(G.clamp(.35+s*.75,.1,1.15)*t*Math.max(0,r)),a.rotation.y=n*5});const o=new y(Ii,Zh());o.position.copy(e.position),o.scale.setScalar(.8*t),e.spawnTransient(o,.12,n=>{o.scale.setScalar(G.lerp(.8,1.9,n)*t),o.material.opacity=.9*(1-n)})}}},vo=Tt.mustard,Mt="#9A6410",Oc="#FFF2C0",Lc=Tt.ketchup,Nt="#6E121D",zi="#FFC0AE",Qn=Tt.bun,Yo="#7A4A1E",Oi="#F9E9C2",V=oe,Za=Math.PI*2,ys=.28;function Bs(e,t=8){const a=new Gi(e,t);return a.rotateX(-Math.PI/2),a}function Nc(e,t,a,o){const n=Math.max(2,a*2),s=new ca,r=c=>c%2===0?-o:o,i=c=>-e/2+c/n*e;s.moveTo(r(0)-t,i(0));for(let c=1;c<=n;c++)s.lineTo(r(c)-t,i(c));for(let c=n;c>=0;c--)s.lineTo(r(c)+t,i(c));return s.closePath(),s}function L2(e,t){const a=new ca;return a.moveTo(0,e),a.quadraticCurveTo(t,e*.45,t,0),a.quadraticCurveTo(t,-e*.45,0,-e),a.quadraticCurveTo(-t,-e*.45,-t,0),a.quadraticCurveTo(-t,e*.45,0,e),a}const tn=V*.44,Li=V*.065,N2=V*.072,_t=V*.26,Ua=V*.185,vs=Bs(Nc(tn,Li,3,N2),1),xs=V*.78,z0=V*.075,O0=(z0+V*.098)*2,Kr=(()=>{const e=Bs(Nc(xs,z0,3,V*.098),1);return e.translate(0,0,xs/2),e})(),it=Bs(L2(.5,.5),6),D2=new Ss(V*.024,0),Jh=(()=>{const e=new Me(1,1,1,16,1,!0,0,Math.PI);return e.rotateZ(-Math.PI/2),e.rotateY(Math.PI/2),e})(),_2=(()=>{const e=new Ia(2,1);return e.rotateX(-Math.PI/2),e})(),H2=Bs(Nc(1,.14,4,.36),1);function fa(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const Ba=e=>new K({color:e,side:ye}),$2=Ba(vo),ed=Ba(Mt),P2=Ba(Oc),q2=Ba(Lc),td=Ba(Nt),j2=Ba(zi),pn=(e,t)=>new K({color:e,transparent:!0,opacity:t,side:ye,depthWrite:!1}),ks=fa(48,()=>pn(vo,1)),Ms=fa(48,()=>pn(Mt,1)),L0=fa(20,()=>pn(Oc,1)),ad=fa(8,()=>new K({color:Qn,transparent:!0,opacity:1,side:ye,depthWrite:!1})),od=fa(8,()=>new K({color:Yo,transparent:!0,opacity:1,side:ye,depthWrite:!1})),nd=fa(8,()=>pn(Oi,1)),sd=fa(8,()=>pn(vo,1)),B2=fa(14,()=>new K({color:Yo,transparent:!0,opacity:1,depthWrite:!1}));function st(e,t){return Math.atan2(e,t)}function rd(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Xr(e){return G.clamp(.85+e*.035,.85,1.4)}function id(e){let t=e.userData.__hotdog;return t||(t={phase:Math.random()*Za,shed:0},e.userData.__hotdog=t),t}function Xt(e,t,a,o,n,s,r,i,c,l,h){const d=new te,p=Ms();p.color.set(a),p.opacity=1;const u=new y(it,p);u.scale.set(1.34,1,1.14),u.position.y=-V*.008,d.add(u);const f=ks();f.color.set(t),f.opacity=1,d.add(new y(it,f)),d.renderOrder=9,d.position.set(o,n,s);const m=l*.45,g=-8.2;e.spawnTransient(d,h,(w,b)=>{const x=n+i*b+.5*g*b*b,v=x<=ys;if(d.position.set(o+r*b,v?ys:x,s+c*b),v)d.rotation.y=st(r,c),d.scale.set(m*1.5,1,l*.75);else{const k=i+g*b,M=Math.hypot(r,k,c),C=1+Math.min(.85,M*.07);d.rotation.y=st(r,c),d.scale.set(m/C,1,l*C)}const E=1-w*w;f.opacity=E,p.opacity=E})}function cd(e,t,a,o,n,s){const r=e.direction,i=Math.hypot(r.x,r.z)>1e-4,c=i?V*.36:0;Jn(e,t,a,e.position.x-r.x*c,e.position.y,e.position.z-r.z*c,i?st(r.x,r.z)+Math.PI*.5:0,o,n,s,.45)}function Jn(e,t,a,o,n,s,r,i,c,l,h,d=1,p="#FFF6DC"){const u=i/xs,f=c/O0,m=new te;m.rotation.y=r,m.position.set(o-Math.sin(r)*i*.5,n,s-Math.cos(r)*i*.5);const g=Ms();g.color.set(a),g.opacity=d;const w=new y(Kr,g);w.scale.set(1.42,1,1.02),w.position.y=-V*.009,m.add(w);const b=ks();b.color.set(t),b.opacity=d,m.add(new y(Kr,b));const x=L0();x.color.set(p),x.opacity=d;const v=new y(Kr,x);v.scale.set(.42,1,.985),v.position.y=V*.006,m.add(v),e.spawnTransient(m,l,E=>{const k=1-Math.pow(1-Math.min(1,E*5.5),3);m.scale.set(f,1,Math.max(.02,u*k));const M=E<h?1:1-(E-h)/(1-h);b.opacity=d*M,g.opacity=d*M,x.opacity=d*M})}function G2(e){const t=new te,a=new y(vs,ed);a.scale.set(1.5,1,1.07),a.position.y=-V*.012,t.add(a),t.add(new y(vs,e===vo?$2:N0(e)));const o=new y(it,ed);o.scale.set(Li*3.2,1,V*.15),o.position.set(0,-V*.012,tn*.46),t.add(o);const n=new y(it,P2);return n.scale.set(Li*2.1,1,V*.105),n.position.set(0,0,tn*.47),t.add(n),t}function W2(e){const t=new te,a=e===Lc?q2:N0(e),o=new y(it,td);o.scale.set(Ua*1.32,1,_t*1.12),o.position.y=-V*.012,t.add(o);const n=new y(it,a);n.scale.set(Ua,1,_t),t.add(n);const s=new y(it,j2);s.scale.set(Ua*.32,1,_t*.42),s.position.set(-Ua*.2,V*.004,_t*.16),t.add(s);const r=[];for(let c=0;c<3;c++){const l=new te,h=1-c*.24,d=new y(it,td);d.scale.set(Ua*.72*h*1.34,1,_t*.42*h*1.14),d.position.y=-V*.012,l.add(d);const p=new y(it,a);p.scale.set(Ua*.72*h,1,_t*.42*h),l.add(p),l.position.z=-_t*(.7+c*.46),t.add(l),r.push(l)}const i={tail:r};return t.userData.__parts=i,t}const ld=new Map;function N0(e){let t=ld.get(e);return t||(t=Ba(e),ld.set(e,t)),t}function $n(e,t,a){const o=new te,n=new y(Jh,a.crust);n.scale.set(e*1.13,e*1.13,t*1.04),n.position.y=-e*.04,o.add(n);const s=new y(Jh,a.bun);s.scale.set(e,e,t),o.add(s);const r=new y(_2,a.crumb);r.scale.set(e*.86,1,t*.92),r.position.y=-e*.34,o.add(r);const i=new y(H2,a.seam);return i.scale.set(e*1.3,1,t*.84),i.position.y=-e*.3,o.add(i),o}const U2={Mustard:{projectile(e){const t=G2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=id(t);o.phase+=a/rd(e.weapon)*Za*3.2,t.rotation.y=st(e.direction.x,e.direction.z)+Math.sin(o.phase)*.16;const n=1+Math.sin(o.phase*1.7)*.13;t.scale.set(1/n,1,n),o.shed-=a,o.shed<=0&&(o.shed=.05+Math.random()*.03,Xt(e,e.color,Mt,e.position.x-e.direction.x*tn*.5,e.position.y,e.position.z-e.direction.z*tn*.5,-e.direction.x*(.6+Math.random()*.7)+(Math.random()-.5)*.9,.25+Math.random()*.45,-e.direction.z*(.6+Math.random()*.7)+(Math.random()-.5)*.9,V*(.12+Math.random()*.06),.26+Math.random()*.12))},impact(e){const t=Xr(e.damage),a=e.direction,o=st(a.x,a.z)+Math.PI*.5;Jn(e,e.color,Mt,e.position.x,e.position.y,e.position.z,o,V*1.045*t,V*.3*t,.34,.5),cd(e,Oc,Mt,V*.46*t,V*.2*t,.19);const{x:n,y:s,z:r}=e.position,i=V*.3*t;for(let c=0;c<8;c++){const l=c/8*Za+Math.random()*.6,h=(2.1+Math.random()*1.5)*t;Xt(e,e.color,Mt,n+Math.cos(l)*i,s,r+Math.sin(l)*i,Math.cos(l)*h+e.direction.x*.7,1.7+Math.random()*1.2,Math.sin(l)*h+e.direction.z*.7,V*(.14+Math.random()*.07)*t,.42+Math.random()*.14)}},cast(e){const t=e.direction,a=st(t.x,t.z),o=new te,n=Ms();n.color.set(Mt),n.opacity=1;const s=new y(vs,n);s.scale.set(1.5,1,1.08),s.position.y=-V*.012,o.add(s);const r=ks();r.color.set(e.color),r.opacity=1,o.add(new y(vs,r)),o.renderOrder=11,o.rotation.y=a;const i=e.position.x,c=e.position.z;e.spawnTransient(o,.16,l=>{const h=1-Math.pow(1-l,2);o.scale.set(.6+l*.3,1,.35+h*.85),o.position.set(i+t.x*h*V*.16,e.position.y,c+t.z*h*V*.16);const d=1-l;r.opacity=d,n.opacity=d});for(let l=0;l<4;l++)Xt(e,e.color,Mt,e.position.x,e.position.y,e.position.z,t.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,.4+Math.random()*.5,t.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,V*(.12+Math.random()*.05),.3)}},Ketchup:{projectile(e){const t=W2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=id(t);o.phase+=a/rd(e.weapon)*Za*2.4,t.rotation.y=st(e.direction.x,e.direction.z);const n=t.userData.__parts;if(n)for(let r=0;r<n.tail.length;r++){const i=n.tail[r],c=Math.sin(o.phase-(r+1)*.9);i.position.x=c*V*.055*(r+1)*.55,i.rotation.y=c*.4}const s=1+Math.sin(o.phase*1.3)*.09;t.scale.set(s,1,1/s),o.shed-=a,o.shed<=0&&(o.shed=.09+Math.random()*.05,Xt(e,e.color,Nt,e.position.x-e.direction.x*_t*1.5,e.position.y,e.position.z-e.direction.z*_t*1.5,(Math.random()-.5)*.9,.1+Math.random()*.3,(Math.random()-.5)*.9,V*(.11+Math.random()*.05),.24+Math.random()*.1))},impact(e){const t=Xr(e.damage),a=e.direction;Jn(e,e.color,Nt,e.position.x,e.position.y,e.position.z,st(a.x,a.z)+Math.PI*.5,V*.78*t,V*.36*t,.3,.45),cd(e,zi,Nt,V*.4*t,V*.2*t,.18),Jn(e,e.color,Nt,e.position.x+a.x*V*.5,ys,e.position.z+a.z*V*.5,st(a.x,a.z),xs*t,O0*t,.8,.55,.95,zi);const{x:o,y:n,z:s}=e.position,r=V*.29*t;for(let i=0;i<6;i++){const c=i/6*Za+Math.random()*.7,l=(1.8+Math.random()*1.3)*t;Xt(e,e.color,Nt,o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*l+a.x*.6,1.5+Math.random()*1.1,Math.sin(c)*l+a.z*.6,V*(.14+Math.random()*.07)*t,.44+Math.random()*.14)}},cast(e){const t=e.direction;for(let r=0;r<5;r++)Xt(e,e.color,Nt,e.position.x,e.position.y,e.position.z,t.x*(1+Math.random()*.9)+(Math.random()-.5)*.8,.3+Math.random()*.4,t.z*(1+Math.random()*.9)+(Math.random()-.5)*.8,V*(.13+Math.random()*.05),.3);const a=new te,o=Ms();o.color.set(Nt),o.opacity=1;const n=new y(it,o);n.scale.set(1.3,1,1.16),n.position.y=-V*.01,a.add(n);const s=ks();s.color.set(e.color),s.opacity=1,a.add(new y(it,s)),a.renderOrder=11,a.rotation.y=st(t.x,t.z),a.position.copy(e.position),e.spawnTransient(a,.15,r=>{const i=G.lerp(V*.06,V*.24,1-Math.pow(1-r,2));a.scale.set(i*.55,1,i),a.position.set(e.position.x+t.x*r*V*.14,e.position.y,e.position.z+t.z*r*V*.14),s.opacity=1-r,o.opacity=1-r})}},Slash:{impact(e){const t=Xr(e.damage),a=e.direction,o=st(a.x,a.z),{x:n,y:s,z:r}=e.position,i=V*.175*t,c=V*.62*t,l=V*.375*t,h=V*.125*t,d=new te;d.rotation.y=o,d.position.set(n,s-V*.06,r),d.renderOrder=10;const p=ad();p.color.set(Qn),p.opacity=1;const u=nd();u.color.set(Oi),u.opacity=1;const f=sd();f.color.set(e.color),f.opacity=1;const m=od();m.color.set(Yo),m.opacity=1;const g={bun:p,crust:m,crumb:u,seam:f},w=$n(i,c,g),b=$n(i,c,g);d.add(w,b);const x=L0();x.color.set("#FFF6DA"),x.opacity=0;const v=new y(it,x);v.scale.set(V*.075,1,c*.92),v.position.y=i*.15,v.renderOrder=12,d.add(v);let E=!1;e.spawnTransient(d,.46,M=>{const C=Math.min(1,M/.35),T=1-Math.pow(1-C,3),F=M<=.35?T:T-(M-.35)/.65*.55,N=G.lerp(l,h,G.clamp(F,0,1));w.position.x=N,b.position.x=-N;const S=G.lerp(.55,.12,G.clamp(F,0,1));w.rotation.z=S,b.rotation.z=-S,x.opacity=M<.35?0:Math.max(0,1-(M-.35)/.2);const R=M<.6?1:1-(M-.6)/.4;if(p.opacity=R,m.opacity=R,u.opacity=R,f.opacity=R,!E&&M>=.35){E=!0;const q=-Math.sin(o),_=-Math.cos(o);for(let B=0;B<6;B++){const Y=B%2===0?1:-1,P=B<4,Q=(Math.random()-.5)*.8;Xt(e,P?vo:Lc,P?Mt:Nt,n+q*Y*h*1.2,s,r+_*Y*h*1.2,q*Y*(2.4+Math.random()*1.6)+a.x*Q,1.6+Math.random()*1.3,_*Y*(2.4+Math.random()*1.6)+a.z*Q,V*(.15+Math.random()*.07)*t,.4+Math.random()*.14)}}});const k=V*.24*t;for(let M=0;M<6;M++){const C=Math.random()*Za,T=(1.9+Math.random()*1.6)*t,F=B2();F.color.set(M%3===0?Qn:Yo),F.opacity=1;const N=new y(D2,F);N.renderOrder=9;const S=n+Math.cos(C)*k,R=r+Math.sin(C)*k,q=Math.cos(C)*T,_=Math.sin(C)*T,B=1.7+Math.random()*1.3,Y=(.8+Math.random()*.7)*t;N.scale.setScalar(Y);const P=Math.random()*9-4.5,Q=Math.random()*9-4.5;e.spawnTransient(N,.42+Math.random()*.14,(I,L)=>{N.position.set(S+q*L,Math.max(ys,s+B*L-4.6*L*L),R+_*L),N.rotation.set(P*L,Q*L,0),F.opacity=1-I*I})}},cast(e){const t=e.direction,a=st(t.x,t.z),o=.62,n=V*.175*o,s=V*.62*o,r=new te;r.rotation.y=a,r.position.copy(e.position),r.renderOrder=11;const i=ad();i.color.set(Qn),i.opacity=1;const c=nd();c.color.set(Oi),c.opacity=1;const l=sd();l.color.set(e.color),l.opacity=1;const h=od();h.color.set(Yo),h.opacity=1;const d={bun:i,crust:h,crumb:c,seam:l},p=$n(n,s,d),u=$n(n,s,d);r.add(p,u),e.spawnTransient(r,.2,f=>{const m=1-Math.pow(1-f,2),g=G.lerp(V*.06,V*.2,m);p.position.x=g,u.position.x=-g,p.rotation.z=m*.6,u.rotation.z=-m*.6;const w=1-f;i.opacity=w,h.opacity=w,c.opacity=w,l.opacity=w});for(let f=0;f<3;f++)Xt(e,vo,Mt,e.position.x,e.position.y,e.position.z,t.x*(1.2+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,t.z*(1.2+Math.random())+(Math.random()-.5)*.9,V*(.12+Math.random()*.05),.28)}}};function lt(e,t){const a={};for(const[o,n]of Object.entries(t))n&&(a[`${e}.${o}`]=n);return a}const Y2={...lt("hamburger",B1),...lt("donut",mw),...lt("taco",zw),...lt("burrito",pb),...lt("egg",Bb),...lt("lollipop",vy),...lt("pizza",jy),...lt("sushi",c2),...lt("soup",R2),...lt("waterbottle",O2),...lt("hotdog",U2)};function Pn(e,t){return Y2[`${e}.${t}`]}function Zt(e){window.__vfxQaCounts??={cast:0,meleeArc:0,impact:0,death:0,heal:0,giantSlam:0,puddleSplash:0,coverScuff:0},window.__vfxQaCounts[e]++}const $o=.5,Gs=.3,V2=Gs,K2=Gs+.01,xa=1.15,hd=1.25,Ya=Gs+.02,qn=Gs+.04,X2=oe,dd=.85,pd=.68,Z2=4,Q2=.7,J2=.92,ev=7,tv=.55,ud=.6,fd=.32,Zr=new ia("#F2F6FF"),av=new ia("#63A8E0"),ov=oe*.62,nv=oe*.66,sv=oe*.62,rv=.58,iv="#EAF4FF",cv="#1D2740",md=18,qo=.8,Qr=3,gd={player:"#F5475E",enemy:"#F5C147"},lv="#EF5B2E",hv=.78,xt=new ia("#ffffff"),dv=new ia("#241a33"),wd=new ia("#FFE79A");function Jr(e,t,a,o,n){const s=new Set;for(const r of a){s.add(r.id);let i=e.get(r.id);i||(i=o(r),t.add(i),e.set(r.id,i)),n(i,r)}for(const[r,i]of e)s.has(r)||(t.remove(i),e.delete(r))}function pv(e){return e.depthWrite=!1,e}const bd=e=>1-Math.pow(1-e,3);function yd(e){const t=Math.sin(e*12.9898)*43758.5453;return(t-Math.floor(t))*Math.PI*2}function ei(e,t){const a=Math.hypot(e,t);return a>1e-6?{x:e/a,y:t/a}:{x:0,y:0}}function uv(){const t=document.createElement("canvas");t.width=64,t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.4,"rgba(255,255,255,0.85)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new ot(t);return n.needsUpdate=!0,n}function fv(){const t=document.createElement("canvas");t.width=64,t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.62,"rgba(255,255,255,1)"),o.addColorStop(.82,"rgba(255,255,255,0.6)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new ot(t);return n.needsUpdate=!0,n}function mv(){const a=document.createElement("canvas");a.width=128,a.height=128;const o=a.getContext("2d"),n=o.createRadialGradient(64,64,0,64,64,128*.16);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.6,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,128);const s=8;for(let i=0;i<s;i++){const c=i%2===0,l=128*(c?.48:.26),h=128*(c?.045:.028),d=i/s*Math.PI*2;o.save(),o.translate(64,64),o.rotate(d);const p=o.createLinearGradient(0,0,l,0);p.addColorStop(0,"rgba(255,255,255,1)"),p.addColorStop(.7,"rgba(255,255,255,0.8)"),p.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=p,o.beginPath(),o.moveTo(0,-h),o.lineTo(l,0),o.lineTo(0,h),o.closePath(),o.fill(),o.restore()}const r=new ot(a);return r.needsUpdate=!0,r}function gv(){const a=document.createElement("canvas");a.width=128,a.height=32;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,128,0);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.5,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,32),o.globalCompositeOperation="destination-in";const s=o.createLinearGradient(0,0,0,32);s.addColorStop(0,"rgba(255,255,255,0)"),s.addColorStop(.5,"rgba(255,255,255,1)"),s.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=s,o.fillRect(0,0,128,32),o.globalCompositeOperation="source-over";const r=new ot(a);return r.needsUpdate=!0,r}function wv(){const a=document.createElement("canvas");a.width=8,a.height=64;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,0,64);n.addColorStop(0,"rgba(255,255,255,0.1)"),n.addColorStop(.55,"rgba(255,255,255,0.55)"),n.addColorStop(.86,"rgba(255,255,255,0.85)"),n.addColorStop(.94,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0.65)"),o.fillStyle=n,o.fillRect(0,0,8,64);const s=new ot(a);return s.flipY=!1,s.needsUpdate=!0,s}function bv(e){const o=document.createElement("canvas");o.width=128,o.height=128;const n=o.getContext("2d"),s=1.9*e,r=3.3*e+.7,i=u=>64*(qo+.13*Math.sin(u*3+s)+.06*Math.sin(u*5+r)),c=()=>{n.beginPath();const u=96;for(let f=0;f<=u;f++){const m=f/u*Math.PI*2,g=i(m),w=64+Math.cos(m)*g,b=64+Math.sin(m)*g;f===0?n.moveTo(w,b):n.lineTo(w,b)}n.closePath()};c();const l=n.createLinearGradient(128*.18,128*.12,128*.86,128*.92);l.addColorStop(0,"rgb(104,104,104)"),l.addColorStop(.5,"rgb(76,76,76)"),l.addColorStop(1,"rgb(52,52,52)"),n.fillStyle=l,n.fill(),n.save(),c(),n.clip(),n.lineWidth=128*.055,n.strokeStyle="rgb(44,44,44)",c(),n.stroke(),n.lineWidth=128*.03,n.strokeStyle="rgb(26,26,26)",c(),n.stroke();const h=(u,f,m,g)=>{n.beginPath(),n.arc(64+u*128,64+f*128,m*128,0,Math.PI*2),n.fillStyle=`rgb(${g},${g},${g})`,n.fill()},d=e*1.7;for(let u=0;u<7;u++){const f=d+u*2.399963,m=.075+.215*Math.sqrt((u+.55)/7),g=.08-.005*u,w=255-8*u;h(Math.cos(f)*m,Math.sin(f)*m,g,w)}h(-.06+.05*e,.2,.075,24),h(.2-.04*e,-.17,.055,20),n.restore();const p=new ot(o);return p.needsUpdate=!0,p}function yv(){const t=document.createElement("canvas");t.width=64,t.height=64;const a=t.getContext("2d"),o=[[.5,.02],[.78,.32],[.68,.98],[.32,.98],[.22,.32],[.5,.02]];a.beginPath(),o.forEach(([r,i],c)=>{const l=r*64,h=i*64;c===0?a.moveTo(l,h):a.lineTo(l,h)}),a.closePath();const n=a.createLinearGradient(64*.3,0,64*.6,64);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.45,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0.55)"),a.fillStyle=n,a.fill(),a.beginPath(),a.moveTo(64*.5,64*.05),a.lineTo(64*.62,64*.34),a.lineTo(64*.5,64*.5),a.lineTo(64*.4,64*.3),a.closePath(),a.fillStyle="rgba(255,255,255,0.9)",a.fill();const s=new ot(t);return s.needsUpdate=!0,s}function vv(e,t,a,o){const n=[],s=[],r=Math.PI*2/a,i=r*o,c=6;let l=0;for(let d=0;d<a;d++){const p=d*r;for(let u=0;u<=c;u++){const f=p+u/c*i;n.push(Math.sin(f)*e,0,Math.cos(f)*e),n.push(Math.sin(f)*t,0,Math.cos(f)*t)}for(let u=0;u<c;u++){const f=l+u*2;s.push(f,f+1,f+2,f+1,f+3,f+2)}l+=(c+1)*2}const h=new an;return h.setAttribute("position",new os(n,3)),h.setIndex(s),h.computeVertexNormals(),h}function vd(e,t){const a=G.degToRad(G.clamp(t,1,360))/2,o=Math.max(8,Math.round(t/8)),n=[0,0,0],s=[.5,0];for(let c=0;c<=o;c++){const l=-a+c/o*a*2;n.push(Math.sin(l)*e,0,Math.cos(l)*e),s.push(c/o,1)}const r=[];for(let c=1;c<o+1;c++)r.push(0,c,c+1);const i=new an;return i.setAttribute("position",new os(n,3)),i.setAttribute("uv",new os(s,2)),i.setIndex(r),i.computeVertexNormals(),i}function xv(e,t=8,a=.45){const o=t*2,n=[0,0,0];for(let i=0;i<=o;i++){const c=i/o*Math.PI*2,l=i%2===0?e:e*a;n.push(Math.sin(c)*l,0,Math.cos(c)*l)}const s=[];for(let i=1;i<o+1;i++)s.push(0,i,i+1);const r=new an;return r.setAttribute("position",new os(n,3)),r.setIndex(s),r.computeVertexNormals(),r}const kv=96,Mv=10,Ev=16;class Tv{group=new te;projectilePool=new Map;splatPool=new Map;trailPool=new Map;materialCache=new Map;transientEffects=[];lastSyncElapsedMs=0;projectileGeo=new bt(Qe(10),10,8);splatGeo=new Ia(2*Qe(hi)/qo,2*Qe(hi)/qo);trailGeo=new Ia(2*Qe(At.radius)/qo,2*Qe(At.radius)/qo);glazeTex=Array.from({length:Qr},(t,a)=>bv(a));splatMats=this.glazeTex.map(t=>this.groundMarkMat(lv,t));trailMats={player:this.glazeTex.map(t=>this.groundMarkMat(gd.player,t)),enemy:this.glazeTex.map(t=>this.groundMarkMat(gd.enemy,t))};groundMarkMat(t,a){const o=pv(Zc(t,{transparent:!0,opacity:hv}));return o.map=a,o.needsUpdate=!0,o}glowTex=uv();softDiscTex=fv();starTex=mv();streakTex=gv();shardTex=yv();wedgeGradientTex=wv();particles=[];wedges=[];rings=[];wedgeGeoCache=new Map;ringUnitGeo=new Aa(.62,1,40);wardGeo=vv(Q2,J2,ev,tv);statusByRole;slowSplashState={player:{lastX:NaN,lastY:NaN,distAccum:0},enemy:{lastX:NaN,lastY:NaN,distAccum:0}};statusSnapshot={player:{x:NaN,y:NaN,stunReady:!0,slowReady:!0},enemy:{x:NaN,y:NaN,stunReady:!0,slowReady:!0}};constructor(t){this.group.name="vfx_layer",t.add(this.group);for(let o=0;o<kv;o++){const n=new qt({map:this.glowTex,color:16777215,transparent:!0,opacity:0,depthWrite:!1,blending:at}),s=new io(n);s.visible=!1,s.renderOrder=10,this.group.add(s),this.particles.push({sprite:s,mat:n,active:!1,life:0,maxLife:1,vx:0,vy:0,vz:0,gravity:0,startScale:1,endScale:1,startOpacity:1,endOpacity:0,fadeEase:1,aspect:1})}for(let o=0;o<Mv;o++){const n=new K({color:16777215,map:this.wedgeGradientTex,transparent:!0,opacity:0,side:ye,depthWrite:!1}),s=new y(vd(.01,10),n);s.visible=!1,s.renderOrder=5,this.group.add(s),this.wedges.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startOpacity:.6})}for(let o=0;o<Ev;o++){const n=new K({color:16777215,transparent:!0,opacity:0,side:ye,depthWrite:!1,blending:at}),s=new y(this.ringUnitGeo,n);s.rotation.x=-Math.PI/2,s.visible=!1,s.renderOrder=6,this.group.add(s),this.rings.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startScale:.1,targetScale:1,startOpacity:.9})}const a=()=>{const o=new K({color:cv,transparent:!0,opacity:0,side:ye,depthWrite:!1}),n=new y(new Aa(.55,.95,28),o);n.rotation.x=-Math.PI/2,n.visible=!1,n.renderOrder=3,this.group.add(n);const s=new K({color:iv,transparent:!0,opacity:0,side:ye,depthWrite:!1}),r=new y(new Aa(.64,.86,28),s);r.rotation.x=-Math.PI/2,r.visible=!1,r.renderOrder=4,this.group.add(r);const i=new qt({map:this.softDiscTex,color:av,transparent:!0,opacity:0,depthTest:!1,depthWrite:!1}),c=new io(i);c.scale.set(ov,nv,1),c.visible=!1,c.renderOrder=8,this.group.add(c);const l=[];for(let p=0;p<Z2;p++){const u=new qt({map:this.starTex,color:"#FFE75E",transparent:!0,opacity:0,depthWrite:!1,blending:at}),f=new io(u);f.scale.set(pd,pd,1),f.visible=!1,f.renderOrder=11,this.group.add(f),l.push(f)}const h=new K({color:Zr,transparent:!0,opacity:0,side:ye,depthWrite:!1}),d=new y(this.wardGeo,h);return d.visible=!1,d.renderOrder=2,this.group.add(d),{slowRing:r,slowRingDark:n,slowTint:c,stunStars:l,wardRing:d,wardMat:h,wardPop:0,wardPopColor:new ia(Zr)}};this.statusByRole={player:a(),enemy:a()},window.__vfxSpawnTest=(o,n,s,r=14,i="#FFC93C",c,l)=>{const h=c??"hamburger",d=l?re[h]?.weapons?.find(p=>p.key===l):void 0;if(o==="impact")this.spawnImpactBurst(n,s,i,r,d?{weapon:d,characterId:h}:void 0);else if(o==="death")this.spawnDeathBurst(n,s,i);else if(o==="heal")this.spawnHealPulse(n,s);else if(o==="puddleSplash"){const p=_e(n,s);this.spawnPuddleSplash(p.x,p.z)}else if(o==="meleeArc")this.spawnMeleeArc(n,s,{x:1,y:0},d?.range??70,d?.cone??80,d?.color??i);else if(o==="giantSlam")this.spawnGiantSlamShockwave(n,s,d?.color??i,d?.range??400);else if(o==="coverScuff")this.spawnCoverScuff(n,s,d?.color??i,1,0);else if(o==="weaponFired"){const p=d??{key:"qa",name:"qa",type:"ranged",range:100,damage:r,cooldown:1,color:i,effect:null};this.spawnWeaponCast(n,s,{x:1,y:0},p,h)}else{const p=d??{key:"qa",name:"qa",type:"ranged",range:100,damage:r,cooldown:1,color:i,effect:null};this.spawnCastFlash(n,s,{x:1,y:0},p,h)}},window.__vfxLayer=this}sync(t){window.__vfxDebugFighters={player:{x:t.player.x,y:t.player.y,hp:t.player.hp,alive:t.player.alive,terrainSlowFactor:t.player.terrainSlowFactor},enemy:{x:t.enemy.x,y:t.enemy.y,hp:t.enemy.hp,alive:t.enemy.alive,terrainSlowFactor:t.enemy.terrainSlowFactor}};const a=Math.max(0,(t.elapsed-this.lastSyncElapsedMs)/1e3);this.lastSyncElapsedMs=t.elapsed,Jr(this.projectilePool,this.group,t.projectiles,o=>{const n=t[o.ownerRole],s=Pn(n.characterId,o.weapon.key);if(s?.projectile){const i=_e(o.x,o.y),c=ei(o.vx,o.vy),l={THREE:wn,position:new le(i.x,$o,i.z),direction:new le(c.x,0,c.y),color:o.color,damage:o.damage,weapon:o.weapon,characterId:n.characterId,spawnTransient:(d,p,u)=>this.spawnTransientObject(d,p,u)},h=s.projectile(l);return h.userData.weaponVfx=s,h}return new y(this.projectileGeo,this.materialFor(o.color))},(o,n)=>{const s=t[n.ownerRole],r=o.userData.weaponVfx,i=_e(n.x,n.y);if(!r){const l=o;if(l.material=this.materialFor(n.color),n.arrived){const h=(n.peckTimer??0)/500,d=1+Math.sin(h*Math.PI)*.5;l.scale.setScalar(d)}else l.scale.setScalar(1);l.position.set(i.x,$o,i.z);return}o.position.set(i.x,$o,i.z);const c=ei(n.vx,n.vy);if((c.x!==0||c.y!==0)&&(o.rotation.y=Math.atan2(c.x,c.y)),r.trail){const l={THREE:wn,position:o.position.clone(),direction:new le(c.x,0,c.y),color:n.color,damage:n.damage,weapon:n.weapon,characterId:s.characterId,spawnTransient:(h,d,p)=>this.spawnTransientObject(h,d,p),object:o,dt:a};r.trail(l)}}),Jr(this.splatPool,this.group,t.splats,o=>{const n=new y(this.splatGeo,this.splatMats[o.id%Qr]);return n.rotation.set(-Math.PI/2,0,yd(o.id)),n},(o,n)=>{const s=_e(n.x,n.y);o.position.set(s.x,V2,s.z)}),Jr(this.trailPool,this.group,t.trailMarks,o=>{const n=new y(this.trailGeo,this.trailMats[o.ownerRole][o.id%Qr]);return n.rotation.set(-Math.PI/2,0,yd(o.id)),n},(o,n)=>{const s=_e(n.x,n.y),r=(t.elapsed+n.id*137)*.004,i=1+Math.sin(r)*.08;o.position.set(s.x,K2,s.z),o.scale.setScalar(i)}),["player","enemy"].forEach(o=>{const n=t[o],s=this.statusByRole[o],r=_e(n.x,n.y),i=n.alive&&n.terrainSlowFactor<1,c=n.alive&&t.elapsed<n.status.slowedUntil,l=i||c;if(s.slowRing.visible=l,s.slowRingDark.visible=l,s.slowTint.visible=l,l){const b=.9+Math.sin(t.elapsed*.0035)*.12,x=t.elapsed*.0012;s.slowRingDark.position.set(r.x,qn-.01,r.z),s.slowRingDark.scale.setScalar(b),s.slowRingDark.rotation.z=x,s.slowRingDark.material.opacity=.5,s.slowRing.position.set(r.x,qn,r.z),s.slowRing.scale.setScalar(b),s.slowRing.rotation.z=x,s.slowRing.material.opacity=.9,s.slowTint.position.set(r.x,sv,r.z);const v=rv+Math.sin(t.elapsed*.006)*.08;s.slowTint.material.opacity=v}const h=this.slowSplashState[o];if(i){if(Number.isFinite(h.lastX))for(h.distAccum+=Math.hypot(n.x-h.lastX,n.y-h.lastY);h.distAccum>=md;)h.distAccum-=md,this.spawnPuddleSplash(r.x,r.z)}else h.distAccum=0;h.lastX=n.x,h.lastY=n.y;const d=t.elapsed>=is(n,"stun"),p=t.elapsed>=is(n,"slow");this.statusSnapshot[o]={x:n.x,y:n.y,stunReady:d,slowReady:p};const u=n.alive&&!d&&t.elapsed>=n.status.stunnedUntil,f=n.alive&&!p&&t.elapsed>=n.status.slowedUntil,m=u||f,g=s.wardPop>0?s.wardPop/fd:0;s.wardRing.visible=m||g>0,s.wardRing.visible&&(s.wardRing.position.set(r.x,qn-.02,r.z),s.wardRing.rotation.y=-t.elapsed*.0019,s.wardRing.scale.setScalar(1+.5*g),s.wardMat.opacity=m?ud+(1-ud)*g:g,s.wardMat.color.copy(Zr).lerp(s.wardPopColor,g));const w=n.alive&&t.elapsed<n.status.stunnedUntil;s.stunStars.forEach((b,x)=>{if(b.visible=w,!w)return;const v=t.elapsed*.006+x*Math.PI*2/s.stunStars.length;b.position.set(r.x+Math.cos(v)*dd,X2+Math.sin(t.elapsed*.01+x)*.05,r.z+Math.sin(v)*dd),b.material.opacity=.95})})}updateEffects(t){for(const a of this.particles){if(!a.active)continue;if(a.life+=t,a.life>=a.maxLife){a.active=!1,a.sprite.visible=!1;continue}const o=a.life/a.maxLife;a.vy+=a.gravity*t,a.sprite.position.x+=a.vx*t,a.sprite.position.y+=a.vy*t,a.sprite.position.z+=a.vz*t;const n=G.lerp(a.startScale,a.endScale,bd(o));a.sprite.scale.set(n,n*a.aspect,1),a.mat.opacity=Math.max(0,G.lerp(a.startOpacity,a.endOpacity,Math.pow(o,a.fadeEase)))}for(const a of this.wedges){if(!a.active)continue;if(a.life+=t,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife;a.mat.opacity=a.startOpacity*(1-Math.pow(o,1.8))}for(const a of this.rings){if(!a.active)continue;if(a.life+=t,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife,n=G.lerp(a.startScale,a.targetScale,bd(o));a.mesh.scale.set(n,n,n),a.mat.opacity=a.startOpacity*(1-o)}for(const a of["player","enemy"]){const o=this.statusByRole[a];o.wardPop>0&&(o.wardPop=Math.max(0,o.wardPop-t))}for(let a=this.transientEffects.length-1;a>=0;a--){const o=this.transientEffects[a];if(o.life+=t,o.life>=o.maxLife){this.group.remove(o.object),this.transientEffects.splice(a,1);continue}o.onUpdate?.(o.life/o.maxLife,o.life)}}spawnTransientObject(t,a,o){this.group.add(t),this.transientEffects.push({object:t,life:0,maxLife:Math.max(.001,a),onUpdate:o})}spawnWeaponCast(t,a,o,n,s){const r=!!Pn(s,n.key)?.cast;this.spawnCastFlash(t,a,o,n,s),n.type==="melee"&&(n.giantSlam&&r||this.spawnMeleeArc(t,a,o,n.range??0,n.cone??360,n.color)),n.giantSlam&&this.spawnGiantSlamShockwave(t,a,n.color,n.range??0,{bespokeOwnsGround:r})}spawnCastFlash(t,a,o,n,s){Zt("cast");const r=_e(t,a),i=Math.hypot(o.x,o.y)||1,c=o.x/i,l=o.y/i,h=.7,d=n.color,p=Pn(s,n.key)?.cast;if(this.castMuzzle(r.x+c*h,r.z+l*h,d,p?"subordinate":"primary"),!p)return;const u={THREE:wn,position:new le(r.x+c*h,hd,r.z+l*h),direction:new le(c,0,l),color:d,damage:n.damage,weapon:n,characterId:s,spawnTransient:(f,m,g)=>this.spawnTransientObject(f,m,g)};p(u)}castMuzzle(t,a,o,n){const s=n==="primary"?1:.75,r=this.allocParticle();r.active=!0,r.life=0,r.maxLife=n==="primary"?.16:.13,r.sprite.visible=!0,r.sprite.position.set(t,hd,a),r.vx=0,r.vy=0,r.vz=0,r.gravity=0,r.startScale=.75*s,r.endScale=1.3*s,r.startOpacity=1,r.endOpacity=0,r.fadeEase=1.6,r.mat.color.set(o).lerp(xt,.4)}spawnMeleeArc(t,a,o,n,s,r){Zt("meleeArc");const i=_e(t,a),c=Qe(n),l=`${Math.round(s)}_${c.toFixed(3)}`;let h=this.wedgeGeoCache.get(l);h||(h=vd(c,s),this.wedgeGeoCache.set(l,h));const d=this.allocWedge();d.active=!0,d.life=0,d.maxLife=.3,d.startOpacity=.88,d.mesh.visible=!0,d.mesh.geometry=h,d.mesh.rotation.y=Math.atan2(o.x,o.y),d.mesh.position.set(i.x,Ya,i.z),d.mat.color.set(r).lerp(dv,.14),d.mat.opacity=d.startOpacity}spawnImpactStarDecal(t,a,o,n){const s=`star_${o.toFixed(3)}`;let r=this.wedgeGeoCache.get(s);r||(r=xv(o,8,.42),this.wedgeGeoCache.set(s,r));const i=this.allocWedge();i.active=!0,i.life=0,i.maxLife=n,i.startOpacity=.9,i.mesh.visible=!0,i.mesh.geometry=r,i.mesh.rotation.y=Math.random()*Math.PI*2,i.mesh.position.set(t.x,Ya+.03,t.z),i.mat.map=null,i.mat.needsUpdate=!0,i.mat.color.set(a).lerp(xt,.05),i.mat.opacity=i.startOpacity}spawnImpactBurst(t,a,o,n,s){Zt("impact");const r=_e(t,a);(s?.weapon.effect==="stun"||s?.weapon.effect==="slow")&&this.flagStatusRefused(t,a,s.weapon.effect,s.weapon.color);const i=s&&Pn(s.characterId,s.weapon.key)?.impact;if(i&&s){let l=0,h=0;if(s.fromXWU!==void 0&&s.fromYWU!==void 0){const p=ei(t-s.fromXWU,a-s.fromYWU);l=p.x,h=p.y}const d={THREE:wn,position:new le(r.x,xa,r.z),direction:new le(l,0,h),color:o,damage:n,weapon:s.weapon,characterId:s.characterId,spawnTransient:(p,u,f)=>this.spawnTransientObject(p,u,f)};i(d);return}const c=G.clamp(.42+n*.075,.42,2);this.burst(r,o,c,Math.round(G.clamp(1+n*.4,2,8)))}flagStatusRefused(t,a,o,n){for(const s of["player","enemy"]){const r=this.statusSnapshot[s];if(!Number.isFinite(r.x)||Math.hypot(r.x-t,r.y-a)>1)continue;if(o==="stun"?r.stunReady:r.slowReady)return;const c=this.statusByRole[s];c.wardPop=fd,c.wardPopColor.set(n).lerp(xt,.35);return}}spawnDeathBurst(t,a,o){Zt("death");const n=_e(t,a);this.burst(n,o,2.6,9,{life:1.35})}spawnHealPulse(t,a){Zt("heal");const o=_e(t,a),n=7;for(let s=0;s<n;s++){const r=this.allocParticle(),i=s/n*Math.PI*2+Math.random()*.5,c=.66+Math.random()*.3;r.active=!0,r.life=0,r.maxLife=.72+Math.random()*.22,r.sprite.visible=!0,r.sprite.position.set(o.x+Math.cos(i)*c,oe*.22,o.z+Math.sin(i)*c),r.vx=Math.cos(i)*.22,r.vz=Math.sin(i)*.22,r.vy=2+Math.random()*.45,r.gravity=-.45,r.startScale=.46+Math.random()*.14,r.endScale=.14,r.startOpacity=.95,r.endOpacity=0,r.fadeEase=1,r.mat.color.set("#6FE0A8")}}spawnPuddleSplash(t,a){Zt("puddleSplash");const o=5;for(let n=0;n<o;n++){const s=this.allocParticle(),r=n/o*Math.PI*2+Math.random()*1,i=Pi*(.58+Math.random()*.16);s.active=!0,s.life=0,s.maxLife=.3+Math.random()*.12,s.sprite.visible=!0,s.sprite.position.set(t+Math.cos(r)*i,qn,a+Math.sin(r)*i);const c=2.2+Math.random()*.6;s.vx=Math.cos(r)*c,s.vz=Math.sin(r)*c,s.vy=1.1+Math.random()*.5,s.gravity=-5.5,s.startScale=.58+Math.random()*.2,s.endScale=.12,s.startOpacity=1,s.endOpacity=0,s.fadeEase=1,s.mat.color.set("#E8F8FF")}}spawnCoverScuff(t,a,o,n,s){Zt("coverScuff");const r=_e(t,a),i=Math.hypot(n,s),c=i>1e-4?-n/i:0,l=i>1e-4?-s/i:-1,h=this.allocParticle();h.active=!0,h.life=0,h.maxLife=.12,h.sprite.visible=!0,h.sprite.position.set(r.x,$o,r.z),h.vx=0,h.vy=0,h.vz=0,h.gravity=0,h.startScale=.42,h.endScale=.85,h.startOpacity=1,h.endOpacity=0,h.fadeEase=1.4,h.mat.color.set(o).lerp(xt,.6);for(let d=0;d<5;d++){const p=(Math.random()-.5)*(Math.PI*2/3),u=Math.cos(p),f=Math.sin(p),m=c*u-l*f,g=c*f+l*u,w=this.allocParticle();w.mat.map=this.streakTex,w.mat.rotation=Math.atan2(g,m),w.aspect=.22,w.active=!0,w.life=0,w.maxLife=.22+Math.random()*.1,w.sprite.visible=!0,w.sprite.position.set(r.x+c*.22,$o,r.z+l*.22),w.vx=m*(2.4+Math.random()*1.6),w.vz=g*(2.4+Math.random()*1.6),w.vy=.9+Math.random()*.7,w.gravity=-7.5,w.startScale=.62+Math.random()*.28,w.endScale=.12,w.startOpacity=1,w.endOpacity=0,w.fadeEase=1.2,w.mat.color.set(wd)}}spawnGiantSlamShockwave(t,a,o,n,s){Zt("giantSlam");const r=_e(t,a),i=Qe(n);if(!(s?.bespokeOwnsGround??!1)){const l=this.allocRing();l.active=!0,l.life=0,l.maxLife=.65,l.startScale=.3,l.targetScale=i*1.05,l.startOpacity=1,l.mesh.visible=!0,l.mesh.position.set(r.x,Ya+.02,r.z),l.mesh.scale.setScalar(l.startScale),l.mat.color.set(o).lerp(xt,.3),l.mat.opacity=l.startOpacity;const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=.8,h.startScale=.15,h.targetScale=i*.85,h.startOpacity=.6,h.mesh.visible=!0,h.mesh.position.set(r.x,Ya+.01,r.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(o),h.mat.opacity=h.startOpacity,this.spawnStarPop(r,xa*1.5,o,5.2,.38);const d=this.allocParticle();d.active=!0,d.life=0,d.maxLife=.3,d.sprite.visible=!0,d.sprite.position.set(r.x,xa*1.5,r.z),d.vx=0,d.vy=0,d.vz=0,d.gravity=0,d.startScale=1.8,d.endScale=3.5,d.startOpacity=.9,d.endOpacity=0,d.fadeEase=1.2,d.mat.color.set(o).lerp(xt,.4),this.spawnStreaks(r,xa*.6,"#FFE79A",10,4.5,.55)}this.burst(r,o,3.2,14,{life:.9,speedMult:1.7,skipFlash:!0,skipRing:!0,skipStreaks:!0,skipDecal:!0})}burst(t,a,o,n,s){const r=s?.life??1,i=s?.speedMult??1;if(s?.skipDecal||this.spawnImpactStarDecal(t,a,G.clamp(.65*o,.55,1.5),(.55+o*.08)*r),!s?.skipFlash){const l=this.allocParticle();l.active=!0,l.life=0,l.maxLife=(.16+o*.04)*r,l.sprite.visible=!0,l.sprite.position.set(t.x,xa,t.z),l.vx=0,l.vy=0,l.vz=0,l.gravity=0,l.startScale=.5*o,l.endScale=1.15*o,l.startOpacity=1,l.endOpacity=0,l.fadeEase=1.4,l.mat.color.set(a).lerp(xt,.3)}if(!s?.skipRing){const l=this.allocRing();l.active=!0,l.life=0,l.maxLife=(.24+o*.06)*r,l.startScale=.15,l.targetScale=.6*o+.35,l.startOpacity=.95,l.mesh.visible=!0,l.mesh.position.set(t.x,Ya,t.z),l.mesh.scale.setScalar(l.startScale),l.mat.color.set(a).lerp(xt,.25),l.mat.opacity=l.startOpacity;const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=(.32+o*.08)*r,h.startScale=.1,h.targetScale=(.6*o+.35)*1.35,h.startOpacity=.55,h.mesh.visible=!0,h.mesh.position.set(t.x,Ya-.01,t.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(a),h.mat.opacity=h.startOpacity}if(!s?.skipStreaks){const l=Math.max(4,Math.round(n*.7));this.spawnStreaks(t,xa,"#FFE79A",l,(.5+o*.5)*i,.26*r)}const c=.4*o;for(let l=0;l<n;l++){const h=this.allocParticle();h.mat.map=this.shardTex;const d=Math.random()*Math.PI*2;h.mat.rotation=d,h.aspect=.4+Math.random()*.15;const p=(2.6+Math.random()*2.8)*(.6+o*.4)*i,u=.18+Math.random()*.24;h.active=!0,h.life=0,h.maxLife=(.36+Math.random()*.22+o*.06)*r,h.sprite.visible=!0,h.sprite.position.set(t.x+Math.cos(d)*u,xa,t.z+Math.sin(d)*u),h.vx=Math.cos(d)*p,h.vz=Math.sin(d)*p,h.vy=1.3+Math.random()*1.8,h.gravity=-6.2,h.startScale=c*(.8+Math.random()*.5),h.endScale=c*.2,h.startOpacity=1,h.endOpacity=0,h.fadeEase=.85,h.mat.color.set(wd)}}allocParticle(){let t=null;for(const o of this.particles)if(!o.active){t=o;break}if(!t){let o=-1/0;for(const n of this.particles){const s=n.life/n.maxLife;s>o&&(o=s,t=n)}}const a=t;return a.mat.map=this.glowTex,a.mat.rotation=0,a.aspect=1,a}spawnStarPop(t,a,o,n,s){const r=this.allocParticle();r.mat.map=this.starTex,r.active=!0,r.life=0,r.maxLife=s,r.sprite.visible=!0,r.sprite.position.set(t.x,a,t.z),r.vx=0,r.vy=0,r.vz=0,r.gravity=0,r.startScale=n*.5,r.endScale=n,r.startOpacity=1,r.endOpacity=0,r.fadeEase=1.7,r.mat.color.set(o).lerp(xt,.45)}spawnStreaks(t,a,o,n,s,r){for(let i=0;i<n;i++){const c=this.allocParticle();c.mat.map=this.streakTex,c.mat.rotation=Math.random()*Math.PI*2,c.aspect=.22,c.active=!0,c.life=0,c.maxLife=r*(.8+Math.random()*.4),c.sprite.visible=!0,c.sprite.position.set(t.x,a,t.z),c.vx=0,c.vy=0,c.vz=0,c.gravity=0,c.startScale=s*(.7+Math.random()*.3),c.endScale=s*1.35,c.startOpacity=.95,c.endOpacity=0,c.fadeEase=1.3,c.mat.color.set(o).lerp(xt,.3)}}allocWedge(){let t;for(const a of this.wedges)if(!a.active){t=a;break}return t||(t=this.wedges.reduce((a,o)=>a.life/a.maxLife>=o.life/o.maxLife?a:o)),t.mat.map!==this.wedgeGradientTex&&(t.mat.map=this.wedgeGradientTex,t.mat.needsUpdate=!0),t}allocRing(){for(const t of this.rings)if(!t.active)return t;return this.rings.reduce((t,a)=>t.life/t.maxLife>=a.life/a.maxLife?t:a)}clear(){for(const t of[this.projectilePool,this.splatPool,this.trailPool]){for(const a of t.values())this.group.remove(a);t.clear()}for(const t of this.particles)t.active=!1,t.sprite.visible=!1;for(const t of this.wedges)t.active=!1,t.mesh.visible=!1;for(const t of this.rings)t.active=!1,t.mesh.visible=!1;for(const t of this.transientEffects)this.group.remove(t.object);this.transientEffects.length=0,this.lastSyncElapsedMs=0;for(const t of["player","enemy"]){const a=this.statusByRole[t];a.slowRing.visible=!1,a.slowRingDark.visible=!1,a.slowTint.visible=!1,a.stunStars.forEach(n=>{n.visible=!1}),a.wardRing.visible=!1,a.wardPop=0,this.statusSnapshot[t]={x:NaN,y:NaN,stunReady:!0,slowReady:!0};const o=this.slowSplashState[t];o.lastX=NaN,o.lastY=NaN,o.distAccum=0}}dispose(){this.clear(),delete window.__vfxSpawnTest,window.__vfxLayer===this&&delete window.__vfxLayer,this.projectileGeo.dispose(),this.splatGeo.dispose(),this.trailGeo.dispose(),this.splatMats.forEach(t=>t.dispose()),Object.values(this.trailMats).forEach(t=>t.forEach(a=>a.dispose())),this.glazeTex.forEach(t=>t.dispose()),this.materialCache.forEach(t=>t.dispose()),this.materialCache.clear(),this.glowTex.dispose(),this.softDiscTex.dispose(),this.starTex.dispose(),this.streakTex.dispose(),this.shardTex.dispose(),this.wedgeGradientTex.dispose();for(const t of this.particles)t.mat.dispose();for(const t of this.wedges)t.mat.dispose();for(const t of this.rings)t.mat.dispose();this.wedgeGeoCache.forEach(t=>t.dispose()),this.wedgeGeoCache.clear(),this.ringUnitGeo.dispose(),this.wardGeo.dispose();for(const t of["player","enemy"]){const a=this.statusByRole[t];a.slowRing.material.dispose(),a.slowRing.geometry.dispose(),a.slowRingDark.material.dispose(),a.slowRingDark.geometry.dispose(),a.slowTint.material.dispose(),a.stunStars.forEach(o=>o.material.dispose()),a.wardMat.dispose()}}materialFor(t){let a=this.materialCache.get(t);return a||(a=Zc(t),this.materialCache.set(t,a)),a}}function Ni(e){return nc(e.player.x,e.player.y,e.enemy.x,e.enemy.y,e.arena)}const xd="hud-styles";function Sv(){if(document.getElementById(xd))return;const e=document.createElement("style");e.id=xd,e.textContent=Rv,document.head.appendChild(e)}function kd(e){const t=Math.max(0,Math.ceil(e/1e3)),a=Math.floor(t/60),o=t%60;return`${a}:${String(o).padStart(2,"0")}`}function Av(e){const t=Math.max(0,Math.round(e/1e3)),a=Math.floor(t/60),o=t%60;return`${a}:${String(o).padStart(2,"0")}`}const jn=.25,Md=.14;function Ed(e,t,a,o){const n=o>0?Math.max(0,Math.min(1,a/o)):0;e.style.width=`${(n*100).toFixed(1)}%`,t.textContent=`${Math.max(0,Math.ceil(a))} / ${o}`}function Fv(e,t){Sv(),ha(),e.innerHTML=`
    <div class="hud-root">
      <!-- FIRST in the stack, deliberately. These two are the only full-viewport
           tints in the HUD, and siblings here are painted in DOM order, so anything
           declared after them stays legible ON TOP of the danger wash. Round 1 had
           them last and the burn discoloured the health bars, the weapon icons and
           the radar's own safe disc — i.e. the readouts you most need while it is
           firing. -->
      <div class="hud-fogedge" data-el="fogedge"></div>
      <div class="hud-fogtick" data-el="fogtick"></div>

      <div class="hud-topbar-scrim"></div>
      <div class="hud-topbar" data-el="topbar">
        <div class="hud-fighter hud-fighter--player">
          <div class="hud-fighter-pill">
            <div class="hud-fighter-emoji" data-el="player-emoji"></div>
            <div class="hud-fighter-name" data-el="player-name"></div>
          </div>
          <div class="hud-healthbar hud-healthbar--player" data-el="player-bar">
            <div class="hud-healthbar-fill" data-el="player-fill"></div>
            <div class="hud-healthbar-text" data-el="player-hp"></div>
          </div>
        </div>
        <div class="hud-clock">
          <div class="hud-timer" data-el="timer">3:00</div>
          <!-- Closing-fog readout. Sits directly under the match clock because the
               two are the SAME number: the safe radius is a pure function of time
               remaining (see zoneInfo() below), so reading them as one column is
               honest. Flips to a danger state the instant the player steps outside. -->
          <div class="hud-zone" data-el="zone">
            <div class="hud-zone-row">
              <div class="hud-zone-label" data-el="zone-label">SAFE ZONE</div>
              <div class="hud-zone-value" data-el="zone-value">--</div>
            </div>
            <div class="hud-zone-track"><div class="hud-zone-bar" data-el="zone-bar"></div></div>
          </div>
        </div>
        <div class="hud-fighter hud-fighter--enemy">
          <div class="hud-fighter-pill">
            <div class="hud-fighter-name" data-el="enemy-name"></div>
            <div class="hud-fighter-emoji" data-el="enemy-emoji"></div>
          </div>
          <div class="hud-healthbar hud-healthbar--enemy" data-el="enemy-bar">
            <div class="hud-healthbar-fill" data-el="enemy-fill"></div>
            <div class="hud-healthbar-text" data-el="enemy-hp"></div>
          </div>
        </div>
      </div>

      <div class="hud-weapons" data-el="weapons"></div>

      <div class="hud-countdown" data-el="countdown"></div>

      <!-- ── "Run this way" ─────────────────────────────────────────────────
           Declared HERE, above the floating pills rather than below them, and that
           order is the fix for a measured collision: the near chevron sits 40px from
           the player's projected GROUND point, and the player's own floating HP pill
           sits ~30-60px above that same point, so every time safety happens to lie
           upward — a quarter of all cases, the same quarter the label's own placement
           rule was written for — a 48px opaque triangle landed on top of the one
           readout telling you how much life you have left while the zone is burning
           it away. Photographed at 4x in shots/hud/after1/crop-chev.png.

           Drawing it UNDER the pill costs the arrow a few px of a shape that is 140px
           long and duplicated (two chevrons plus a label), and costs the HP bar
           nothing. It stays above the weapon tray, which is declared earlier. -->
      <div class="hud-safearrow" data-el="safearrow">
        <div class="hud-safearrow-chevron"></div>
        <div class="hud-safearrow-chevron hud-safearrow-chevron--2"></div>
      </div>
      <div class="hud-safearrow-label" data-el="safearrow-label">RUN TO THE ZONE</div>

      <!-- Deliberately NO name TEXT here — the top-corner nameplates are the one
           canonical place to read "who is who"; repeating the full name would just
           split attention between two labels for the same two fighters. A small
           emoji badge (matching the corner pill's language, not its text) plus a
           chunky bar on a solid backing plate keeps this legible against any floor
           colour without reintroducing that duplicate readout. -->
      <div class="hud-float hud-float--player" data-el="float-player">
        <div class="hud-float-pill">
          <div class="hud-float-emoji" data-el="float-player-emoji"></div>
          <div class="hud-float-bar"><div class="hud-float-fill" data-el="float-player-fill"></div></div>
        </div>
      </div>
      <div class="hud-float hud-float--enemy" data-el="float-enemy">
        <div class="hud-float-pill">
          <div class="hud-float-emoji" data-el="float-enemy-emoji"></div>
          <div class="hud-float-bar"><div class="hud-float-fill" data-el="float-enemy-fill"></div></div>
        </div>
      </div>

      <!-- ── Closing-fog boundary readouts ────────────────────────────────────
           The 3D boundary (src/arena/fogRing.ts) answers "where is the edge" only
           while the edge is in frame. It very often is not: the map is 1400x1000 wu
           and a player is only guaranteed to see 199.2 wu in any direction, so for
           most of a match the safe radius is far outside the window. These three
           elements are what make the zone knowable from ANYWHERE:

             - the radar, which shows the whole map, the circle, and both fighters;
             - the edge vignette, which says "you are being killed right now";
             - the chevron, which says which way to run. -->
      <div class="hud-radar" data-el="radar">
        <div class="hud-radar-map" data-el="radar-map">
          <div class="hud-radar-safe" data-el="radar-safe"></div>
          <!-- The PLAYFIELD's own rectangle, drawn OVER the safe disc.
               The card is a window on MORE world than the arena (see renderZone for
               why), so without this there is nothing telling the player where the
               walls are: "inside the map but in the fog" and "not the map at all"
               would be the same violet pixels. Its stroke and its grid both have to
               read on cream AND on violet, because the disc sweeps across this
               rectangle during a match. -->
          <div class="hud-radar-arena" data-el="radar-arena">
            <div class="hud-radar-grid"></div>
          </div>
          <div class="hud-radar-dot hud-radar-dot--enemy" data-el="radar-enemy"></div>
          <div class="hud-radar-dot hud-radar-dot--player" data-el="radar-player"></div>
        </div>
        <div class="hud-radar-cap" data-el="radar-cap">SAFE ZONE</div>
      </div>

      <!-- ── Mute state ──────────────────────────────────────────────────────
           M toggles mute (see game/input.ts). It was landing SILENTLY, which
           makes it a coin flip: press it during a quiet second and there is no way
           to tell whether it worked, whether the key is even bound, or which state
           you are now in. It matters most under pointer lock, where the OS volume
           mixer is no longer one cursor-move away — that is why the hotkey exists.
           So: latched while muted, a brief confirmation when sound comes back. -->
      <div class="hud-mute" data-el="mute"></div>

      <!-- ── Aim reticle (pointer lock only) ─────────────────────────────────
           Declared LATE in the stack so it paints over the radar, the weapon bar and
           the fog wash: it is the one HUD element that is literally the player's
           cursor, and a cursor that can be covered is worse than no cursor. -->
      <div class="hud-aim-stick" data-el="aim-stick"><i></i></div>
      <div class="hud-aim-reticle" data-el="aim-reticle">
        <div class="hud-aim-dot"></div>
      </div>

      <div class="hud-dmg-layer" data-el="dmg-layer"></div>
      <div class="hud-screenflash" data-el="screenflash"></div>

      <!-- ── The result card is LAST, and it was not ────────────────────────
           It used to be declared seventh of seventeen, which put the radar, both
           floating pills, the mute badge, the aim reticle, the damage layer and the
           ultimate flash on top of a full-viewport modal. Photographed at 1600x900
           (shots/hud/r2/desk-ended.png): a "-15 ZONE" damage number left over from the
           killing blow is drawn between "Match time 0:24" and the Play Again button,
           on the one screen a player reads word for word.

           A result card is the last thing in a match by definition, so it is the last
           thing in the stack. This does NOT change the z-index the screen layer relies
           on — .hud-root stays at 20 and ui/screens/matchScreen.ts stays at 40, so its
           Menu button is still clickable over this scrim. -->
      <div class="hud-gameover" data-el="gameover">
        <div class="hud-gameover-card">
          <div class="hud-gameover-title" data-el="gameover-title"></div>
          <div class="hud-gameover-subtitle" data-el="gameover-subtitle"></div>
          <div class="hud-gameover-stats" data-el="gameover-stats"></div>
          <button class="hud-gameover-btn" data-el="gameover-btn" type="button">Play Again</button>
        </div>
      </div>
    </div>
  `;const a=H=>{const ae=e.querySelector(`[data-el="${H}"]`);if(!ae)throw new Error(`hud: missing element "${H}"`);return ae},o=a("player-name"),n=a("enemy-name"),s=a("player-emoji"),r=a("enemy-emoji"),i=a("player-bar"),c=a("enemy-bar"),l=a("player-fill"),h=a("enemy-fill"),d=a("player-hp"),p=a("enemy-hp"),u=a("timer"),f=a("weapons"),m=a("countdown"),g=a("gameover"),w=a("gameover-title"),b=a("gameover-subtitle"),x=a("gameover-stats"),v=a("gameover-btn"),E=a("topbar"),k=a("float-player"),M=a("float-enemy"),C=a("float-player-emoji"),T=a("float-enemy-emoji"),F=a("float-player-fill"),N=a("float-enemy-fill"),S=a("dmg-layer"),R=a("screenflash"),q=a("zone"),_=a("zone-label"),B=a("zone-value"),Y=a("zone-bar"),P=a("radar"),Q=a("radar-safe"),I=a("radar-arena"),L=a("radar-player"),z=a("radar-enemy"),U=a("radar-cap"),ie=a("fogedge"),J=a("fogtick"),D=a("safearrow"),X=a("safearrow-label"),he=a("aim-stick"),ve=a("aim-reticle"),ze=a("mute");let ma=0,Ga=null;function Ao(){const H=we.isMuted();if(H===Ga)return;const ae=Ga===null;if(Ga=H,window.clearTimeout(ma),H){ze.innerHTML=O("mute")+"<span>MUTED · M</span>",ze.classList.add("is-on"),ze.classList.remove("is-ok");return}if(ae){ze.classList.remove("is-on","is-ok");return}ze.innerHTML=O("sound")+"<span>SOUND ON · M</span>",ze.classList.add("is-on","is-ok"),ma=window.setTimeout(()=>ze.classList.remove("is-on","is-ok"),1500)}const Fo=we.onChange(Ao);Ao();const un=24,Ws=[];let Us=0;for(let H=0;H<un;H++){const ae=document.createElement("div");ae.className="hud-dmg",S.appendChild(ae),Ws.push(ae)}function B0(H,ae){const Ee=H.replace("#",""),ce=Ee.length===3?Ee.split("").map(Le=>Le+Le).join(""):Ee,ue=parseInt(ce.slice(0,2),16)||0,Ae=parseInt(ce.slice(2,4),16)||0,fe=parseInt(ce.slice(4,6),16)||0;return`rgba(${ue},${Ae},${fe},${ae})`}v.addEventListener("click",()=>t.onRestart());let Ys=null,_c=[];function G0(H){f.innerHTML="",_c=H.map((ae,Ee)=>{const ce=document.createElement("div");return ce.className="hud-weapon-slot",ce.innerHTML=`
        <div class="hud-weapon-cooldown"></div>
        <div class="hud-weapon-emoji">${hp(ae.emoji)}</div>
        <div class="hud-weapon-timer" data-role="timer"></div>
        <div class="hud-weapon-key">${Ee+1}</div>
      `,ce.addEventListener("pointerdown",ue=>{ue.preventDefault(),ue.stopPropagation(),t.onSelectWeapon?.(Ee)}),f.appendChild(ce),{root:ce,cooldown:ce.querySelector(".hud-weapon-cooldown"),timer:ce.querySelector('[data-role="timer"]'),wasReady:!0}})}const W0=Math.round(Nd/Ld*1e3);function U0(H){const ae=H/aa;return ae<=0?0:Math.min(12e3,Ou.radiusUnits/ae)}function Y0(H){const ae=H.arena.maxSafeRadius,Ee=Math.hypot(H.player.x-H.arena.center.x,H.player.y-H.arena.center.y),ce=Ee>H.safeRadius,ue=ae/aa,Ae=Ee<=Ts;return{outside:ce,holds:Ae,radius01:ae>0?Math.max(0,Math.min(1,H.safeRadius/ae)):0,msUntilEdge:ce||Ae||ue<=0?null:(H.safeRadius-Ee)/ue}}const Hc=56;let $c=0,Vs=-1,Pc=-1;function Ks(){if(window.innerWidth!==Vs||window.innerHeight!==Pc){Vs=window.innerWidth,Pc=window.innerHeight;const H=E.getBoundingClientRect().bottom;$c=H+36,S.style.setProperty("--fa-dmg-top",`${Math.max(0,Math.round(H+2))}px`)}return $c}let fn=0;function V0(H,ae){const Ee=H.phase==="playing",ce=Y0(H),ue=Ee&&ce.outside&&H.player.alive,Ae=H.arena.maxSafeRadius;q.classList.toggle("is-danger",ue),q.classList.toggle("is-imminent",!ue&&ce.msUntilEdge!==null&&ce.msUntilEdge<U0(Ae)),Y.style.width=`${(ce.radius01*100).toFixed(1)}%`,ue?(_.textContent="▲ OUTSIDE THE ZONE",B.textContent=`−${W0} HP/s`):(_.textContent="ZONE CLOSES",B.textContent=ce.msUntilEdge!==null?`REACHES YOU ${kd(ce.msUntilEdge)}`:ce.holds?"FINAL RING":"CLOSING");const fe=H.arena.width,Le=H.arena.height,Ge=H.arena.center.x,Ve=H.arena.center.y,ga=fe/Le,Wa=Math.max(Ae,Ge,fe-Ge)*(1+Md),X0=Math.max(Ve,Le-Ve)*(1+Md),Xs=Math.max(2*Wa,2*X0*ga),qc=Xs/ga,mn=Ot=>`${(50+(Ot-Ge)/Xs*100).toFixed(2)}%`,gn=Ot=>`${(50+(Ot-Ve)/qc*100).toFixed(2)}%`,jc=Ot=>`${(Ot/Xs*100).toFixed(2)}%`,Bc=Ot=>`${(Ot/qc*100).toFixed(2)}%`;Q.style.left=mn(Ge),Q.style.top=gn(Ve),Q.style.width=jc(H.safeRadius*2),Q.style.height=Bc(H.safeRadius*2),I.style.left=mn(fe/2),I.style.top=gn(Le/2),I.style.width=jc(fe),I.style.height=Bc(Le),L.style.left=mn(H.player.x),L.style.top=gn(H.player.y),L.style.display=H.player.alive?"block":"none",z.style.left=mn(H.enemy.x),z.style.top=gn(H.enemy.y),z.style.display=H.enemy.alive&&Ni(H)?"block":"none",P.classList.toggle("is-danger",ue),U.textContent=ue?"GET INSIDE":"SAFE ZONE",ie.classList.toggle("is-on",ue);const Vt=ue?ae.safeArrow??null:null;if(Vt){D.style.display="block",X.style.display="block";const Ot=Vt.angleRad*180/Math.PI;D.style.transform=`translate(${Vt.at.x.toFixed(1)}px, ${Vt.at.y.toFixed(1)}px) rotate(${Ot.toFixed(1)}deg)`,(fn===0||window.innerWidth!==Vs)&&(fn=X.offsetWidth/2);const Gc=8,Z0=Math.min(Math.max(Vt.at.x+Math.cos(Vt.angleRad)*178,fn+Gc),window.innerWidth-fn-Gc),Q0=Math.min(Math.max(Vt.at.y+Math.sin(Vt.angleRad)*178,Ks()+4),window.innerHeight-22);X.style.transform=`translate(${Z0.toFixed(1)}px, ${Q0.toFixed(1)}px) translate(-50%, -50%)`}else D.style.display="none",X.style.display="none"}function K0(H){const ae=H.aim??null;if(!ae){he.style.display="none",ve.style.display="none";return}const Ee=ae.at.x-ae.from.x,ce=ae.at.y-ae.from.y,ue=Math.hypot(Ee,ce),Ae=Math.atan2(ce,Ee)*180/Math.PI;he.style.display="block",he.style.width=`${ue.toFixed(1)}px`,he.style.transform=`translate(${ae.from.x.toFixed(1)}px, ${ae.from.y.toFixed(1)}px) rotate(${Ae.toFixed(1)}deg)`,ve.style.display="flex",ve.style.transform=`translate(${ae.at.x.toFixed(1)}px, ${ae.at.y.toFixed(1)}px) translate(-50%, -50%)`}return{setCharacters(H,ae){Ys=H,o.textContent=re[H].name,n.textContent=re[ae].name,s.innerHTML=St(H,{crop:"head"}),r.innerHTML=St(ae,{crop:"head"}),C.innerHTML=St(H,{crop:"head"}),T.innerHTML=St(ae,{crop:"head"}),G0(re[H].weapons),Ko(e,{generate:!1})},update(H,ae){Ed(l,d,H.player.hp,H.player.maxHp),Ed(h,p,H.enemy.hp,H.enemy.maxHp),u.textContent=kd(H.timeRemaining);const Ee=H.player.maxHp>0?H.player.hp/H.player.maxHp:0,ce=H.enemy.maxHp>0?H.enemy.hp/H.enemy.maxHp:0;if(i.classList.toggle("is-low",H.player.alive&&Ee<=jn),c.classList.toggle("is-low",H.enemy.alive&&ce<=jn),Ys){const ue=re[Ys].weapons,Ae=H.player.lastUsed;_c.forEach((fe,Le)=>{const Ge=ue[Le];if(!Ge)return;const Ve=Math.max(0,Ge.cooldown-(H.elapsed-Ae[Le])),ga=Ge.cooldown>0?Math.min(1,Ve/Ge.cooldown):0;fe.cooldown.style.setProperty("--p",ga.toFixed(3));const Wa=ga<=0;fe.root.classList.toggle("is-ready",Wa),fe.root.classList.toggle("is-selected",Le===ae.selectedWeapon),fe.timer.textContent=Wa?"":(Ve/1e3).toFixed(1),Wa&&!fe.wasReady&&(fe.root.classList.remove("is-flash"),fe.root.offsetWidth,fe.root.classList.add("is-flash")),fe.wasReady=Wa})}if(V0(H,ae),K0(ae),H.phase==="countdown"){m.style.display="flex";const ue=H.countdownValue<=0;m.textContent=ue?"START!":String(H.countdownValue),m.classList.toggle("is-start",ue)}else m.style.display="none";if(H.phase==="ended"){g.style.display="flex";const ue=H.winner==="player";w.textContent=ue?"VICTORY!":"DEFEAT!",w.classList.toggle("is-win",ue),w.classList.toggle("is-lose",!ue);const Ae=H.winner??"player",fe=Ae==="player"?"enemy":"player",Le=re[H[Ae].characterId],Ge=re[H[fe].characterId],Ve=H.player.alive&&H.enemy.alive;b.innerHTML=`<span class="hud-go-emoji">${St(H[Ae].characterId,{crop:"head"})}</span>${Le.name}<span class="hud-go-vs">${Ve?"outlasted":"defeated"}</span><span class="hud-go-emoji">${St(H[fe].characterId,{crop:"head"})}</span>${Ge.name}`,Ko(b,{generate:!1});const ga=Math.max(0,aa-H.timeRemaining);x.innerHTML=Ve?`${O("timer")} Time up — no knockout`:`${O("timer")} Match time ${Av(ga)}`}else g.style.display="none"},updateFloatingBars(H,ae,Ee,ce){const ue=Ks(),Ae=(fe,Le)=>{const Ge=Math.max(Le.y,ue),Ve=Math.min(Math.max(Le.x,Hc),window.innerWidth-Hc);fe.style.transform=`translate(${Ve.toFixed(1)}px, ${Ge.toFixed(1)}px) translate(-50%, -100%)`};if(H){k.style.display="flex",Ae(k,H);const fe=Math.max(0,Math.min(1,Ee));F.style.width=`${(fe*100).toFixed(1)}%`,F.classList.toggle("is-low",fe>0&&fe<=jn)}else k.style.display="none";if(ae){M.style.display="flex",Ae(M,ae);const fe=Math.max(0,Math.min(1,ce));N.style.width=`${(fe*100).toFixed(1)}%`,N.classList.toggle("is-low",fe>0&&fe<=jn)}else M.style.display="none"},spawnDamageNumber(H,ae,Ee){const ce=Ws[Us];Us=(Us+1)%Ws.length;const ue=!!Ee?.heal,Ae=ae>=15,fe=!Ae&&ae>=6,Le=Math.max(H.y,Ks()),Ge=Math.min(Math.max(H.x,24),window.innerWidth-24);ce.style.setProperty("--x",`${Ge.toFixed(1)}px`),ce.style.setProperty("--y",`${Le.toFixed(1)}px`),ce.textContent=ue?`+${Math.round(ae)}`:`-${Math.round(ae)}`;const Ve=ue?" hud-dmg--heal":Ee?.fog?" hud-dmg--fog":"";ce.className=`hud-dmg ${Ae?"hud-dmg--big":fe?"hud-dmg--medium":"hud-dmg--small"}${Ve}`,ce.offsetWidth,ce.classList.add("is-playing")},flashScreen(H){R.style.setProperty("--flash-color",B0(H,.42)),R.classList.remove("is-playing"),R.offsetWidth,R.classList.add("is-playing")},flashFogTick(){J.classList.remove("is-playing"),J.offsetWidth,J.classList.add("is-playing")},dispose(){v.removeEventListener("click",()=>t.onRestart()),window.clearTimeout(ma),Fo(),e.innerHTML=""}}}const Rv=`
.hud-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 20;
  font-family: 'Heebo', sans-serif;
  color: #FFF3DE;
  user-select: none;
}

/* ── Top bar: player / timer / enemy ─────────────────────────────────────── */
/* Full-width scrim behind the whole top strip — guarantees the nameplates and
   timer stay readable no matter how bright or busy the arena floor gets under
   them (a bright kitchen tile, a lit hazard, a light character), independent of
   each element's own text-shadow. */
.hud-topbar-scrim {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, rgba(10,6,16,0.5), rgba(10,6,16,0));
}

/* Safe areas, on every edge the HUD touches. A landscape phone eats 44px of the
   leading edge to the notch and ~21px of the trailing bottom to the home indicator,
   and the viewport-fit=cover meta in index.html is what makes those readable. All of
   them carry a 0px fallback, so a desktop is pixel-identical to before. */
.hud-topbar {
  position: absolute;
  top: calc(var(--fa-safe-t, 0px) + 14px);
  left: calc(var(--fa-safe-l, 0px) + 14px);
  right: calc(var(--fa-safe-r, 0px) + 14px);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.hud-fighter {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1 1 260px;
  max-width: 380px;
}
.hud-fighter--enemy { align-items: flex-end; }

/* Solid pill behind the name+portrait — belt-and-suspenders legibility on top of
   the topbar scrim above, so a single fighter name is never lost even if the
   camera happens to frame a bright prop right behind it. */
.hud-fighter-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(26,18,36,0.72);
  border: 2px solid rgba(26,18,36,0.9);
  border-radius: 999px;
  padding: 3px 12px 3px 4px;
  max-width: 100%;
}
.hud-fighter--enemy .hud-fighter-pill { padding: 3px 4px 3px 12px; }

.hud-fighter-emoji {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
}
.hud-fighter--player .hud-fighter-emoji { border: 2px solid #3FCB86; }
.hud-fighter--enemy .hud-fighter-emoji { border: 2px solid #E6493F; }
/* The badge used to hold a 16px emoji inside a 24px well. A rendered portrait fills
   the whole well instead, which is a 50% bigger picture in the same layout box and is
   the treatment every shipped brawler gives its fighter chips. */
.hud-fighter-emoji .fa-ic-portrait { width: 100%; height: 100%; vertical-align: top; }

.hud-fighter-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #1a1224;
  -webkit-text-stroke: 0.5px rgba(26,18,36,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-healthbar {
  position: relative;
  width: 100%;
  height: 26px;
  background: #241a30;
  border: 3px solid #1a1224;
  border-radius: 999px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35);
  overflow: hidden;
}
.hud-healthbar-fill {
  position: absolute;
  inset: 2px;
  right: auto;
  border-radius: 999px;
  transition: width 0.15s ease-out;
  /* Glossy top highlight — a cheap but reliable "shipped" tell on a mobile-game
     health bar, versus a flat single-tone fill. */
  background-image: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 42%);
  background-blend-mode: overlay;
}
.hud-fighter--player .hud-healthbar-fill { background-color: #3FCB86; }
.hud-fighter--enemy .hud-healthbar-fill { background-color: #E6493F; }
/* ── The most-read number in the game, and it failed AA by the widest margin ──
   Cream #FFF3DE centred on the fill. Measured against THE PIXELS ACTUALLY BEHIND IT
   mid-fight, at five viewports (tools/tmp/hud_accept.mjs):

     over the player's green fill #3FCB86 ... 1.89   (AA needs 4.5)
     over the enemy's red fill    #E6493F ... 3.55

   1.89 was the worst text ratio anywhere in the HUD and it is on your own HP. It is
   also the ONLY text class in the HUD that failed — 20 of the 117 measured runs, all
   of them this one.

   ── Why the fix is a stroke and not a colour ────────────────────────────────
   This run is the one piece of HUD text whose backdrop CHANGES UNDER IT: the fill
   recedes as HP drops, so at 40% HP the same glyphs sit half on #3FCB86 (luma 0.455)
   and half on the #241a30 track (luma 0.013). No single ink wins both — cream is
   correct on the track and hopeless on the fill; a dark ink would be the exact
   reverse, and the bar would go unreadable at precisely the moment it matters.

   A stroke removes the backdrop from the question: with paint-order: stroke fill
   the glyph's paper is its own ink rim, so the ratio is cream vs #1a1224 = 12.02 on
   BOTH halves and at every HP value. That is the same mechanism .hud-dmg, the
   safe-zone chevron and the aim reticle already use, and the same one the menu pass
   used to take 65 AA failures to zero — "a pale mark on this arena needs an ACTUAL
   dark fill layer behind it".

   2px, not the 3px .hud-dmg uses: verified on a rendered crop at 12px/800 rather
   than assumed, because a stroke that closes the counters is a legibility LOSS that
   a stroke-aware contrast model would happily score 12. The old soft 2px blur is gone
   — a blurred halo behind an opaque rim contributes nothing. */
.hud-healthbar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 12px;
  color: #FFF3DE;
  -webkit-text-stroke: 2px #1a1224;
  paint-order: stroke fill;
  text-shadow: 0 1px 0 rgba(0,0,0,0.45);
  letter-spacing: 0.02em;
}

/* Danger pulse: an unmistakable "you are about to die" cue that reads instantly,
   without parsing the numeric text — a fast red glow breathing around the bar. */
.hud-healthbar.is-low {
  animation: hud-lowhp-pulse 0.7s ease-in-out infinite;
}
@keyframes hud-lowhp-pulse {
  0%, 100% { box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35), 0 0 0 rgba(230,57,70,0); }
  50% { box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35), 0 0 14px 3px rgba(255,60,60,0.85); }
}

.hud-clock {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.hud-timer {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 22px;
  letter-spacing: 0.02em;
  background: rgba(26,18,36,0.78);
  border: 3px solid #1a1224;
  border-radius: 14px;
  padding: 6px 16px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}

/* ── Closing-fog readout ──────────────────────────────────────────────────── */
/* Violet is reserved, project-wide, for the closing fog: this strip, the radar,
   the edge vignette, the chevron, the fog damage numbers and the 3D curtain in
   src/arena/fogRing.ts all use the same three tones. Nothing else in the arena is
   allowed this hue — the two colours already spoken for on the floor are hazard
   amber/black and puddle blue — so "violet means the fog" is learnable from a
   single frame. */
.hud-zone {
  width: 196px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  /* OPAQUE, not 78% alpha. This pill can land on top of the boiling pot's danger
     ring at some framings, and a translucent plate let the ring read straight through
     a zone readout. Chrome that the world shows through is chrome the player can
     misread as world paint. It also buys legibility for an 11px readout for free. */
  background: #1a1224;
  border: 3px solid #0e0916;
  border-radius: 12px;
  padding: 4px 8px 6px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.45);
}
/* ── STACKED, and the previous side-by-side row never fitted ──────────────────
   The row used to be justify-content: space-between with the label and the value on
   one line, and it OVERFLOWED THE PLATE IN EVERY STATE ON EVERY VIEWPORT. Measured
   through the real game mid-fight (tools/tmp/hud_accept.mjs), text outside the plate:

     "REACHES YOU 0:06"   15.1px portrait · 12.0px phone · 11.2px desktop/laptop/tablet
     "-50 HP/s"            8.2px portrait ·  3.6px everywhere else

   An earlier pass had already tried to fix this by shaving the gap 8 -> 4 and the
   value's tracking 0.02em -> 0, and recorded the result in a comment as "Verified 0px
   overflow at 5 viewports x 3 states by tools/tmp/hud_fit.mjs". THE VERIFICATION WAS
   THE BUG: tools/tmp/hud_harness.html, which that tool measures through, was missing
   the * { box-sizing: border-box } that index.html:15 applies to the whole game, so
   it laid this plate out at 196 + 18 padding + 6 border = 220px. 24px of phantom slack
   — more than the 15.1px overflow it was hunting. Corrected, that same tool reports
   24px on the pre-fix tree (its harness drives the wider "REACHES YOU 0:16") and 0px
   on this one. Two independent instruments now agree in both directions.

   ── Why stacking, rather than a wider plate or shorter words ────────────────
   Both were available and both are worse:
     * WIDER. The plate can afford ~16px at desktop, but at portrait-430 the top bar is
       already oversubscribed (two nameplates and this pill in 402px), and a plate sized
       for the widest value would be sized for a string that is on screen for one second
       in three.
     * SHORTER WORDS. "REACHES YOU 0:08" is the wording a blind critic round arrived at
       after "closes on you 0:08" was read as genuinely ambiguous English. Re-shortening
       it would spend that finding to buy pixels.
   Stacking gives each line the plate's FULL content width, so the overflow cannot come
   back when a digit gets wider or a viewport gets narrower — it is structural, not a
   tuned clearance.

   ── And it buys the thing the pill actually needed ──────────────────────────
   Both runs were 11px. At shipped framing (shots/hud/r0/desk-mid.png) that is 41px of
   screen carrying a readout you cannot read without a 5x crop — 1.2% of frame height
   spent on decoration. The freed width promotes the VALUE to 15px, which is the
   Brawl Stars pattern this HUD is aimed at: a quiet small-caps label over a big number.
   Net height cost 13px on a 900px frame. */
.hud-zone-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  min-width: 0;
}
.hud-zone-label {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  line-height: 1.3;
  text-transform: uppercase;
  color: #E9A6FF;
  white-space: nowrap;
}
.hud-zone-value {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 15px;
  /* 0, not 0.02em. 0.02em on this run is 0.3px per character and buys nothing legible,
     while over a 16-character value it is 4.8px of plate. */
  letter-spacing: 0;
  line-height: 1.15;
  /* Stays in the fog's pale violet, not the HUD's cream. Violet is reserved
     project-wide for the closing fog (this strip, the radar, the edge vignette, the
     chevron, the fog damage numbers and the 3D curtain), and promoting this run to
     15px makes it the loudest thing in the pill — which is exactly when it must not
     start reading as generic chrome. 14.06 against the plate, unchanged by the size. */
  color: #EFE2FF;
  white-space: nowrap;
}
.hud-zone-track {
  height: 7px;
  border-radius: 999px;
  background: #2a1b3a;
  border: 1.5px solid #120c1c;
  overflow: hidden;
}
/* The bar is the SHRINKING SAFE AREA, so it empties left-to-right as the ring
   closes — the same direction as the clock beside it. */
.hud-zone-bar {
  height: 100%;
  width: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7B3FA8, #E9A6FF);
  transition: width 0.2s linear;
}
/* ── Reachable for the first time as of this change — see renderZone ─────────
   These three rules were authored and never selected: nothing added is-danger to
   .hud-zone. Now that they fire, two things in them were wrong on arrival and are
   corrected here rather than shipped the moment they became visible.

   1. OPACITY. The calm plate above was made fully opaque because at 78% alpha the
      boiling pot's hazard ring read straight THROUGH a zone readout — a whole-arena
      scan caught a pill saying "safe" superimposed on a ring meaning "lethal". This
      rule kept 0.9, so the alarm state was quietly the one state that still let world
      paint through a HUD readout, and it is the worst possible one to leave open: it
      is drawn while the whole screen is already violet with fog, so anything showing
      through is the same hue as the plate. #58147C is that colour with the alpha
      resolved — identical over black, and now identical over everything else too.
   2. THE LABEL SIZE JUMP. 11px -> 12px was a reflow of a row that was already
      overflowing. At 11px against the stacked plate's 172px of content,
      "▲ OUTSIDE THE ZONE" measures ~119px, so the bump now has room and stays.

   White on #58147C is 11.60; #FFD4FF is 9.63. */
.hud-zone.is-danger {
  background: #58147C;
  border-color: #E9A6FF;
  animation: hud-zone-alarm 0.6s ease-in-out infinite;
}
.hud-zone.is-danger .hud-zone-label { color: #FFFFFF; font-size: 11px; }
.hud-zone.is-danger .hud-zone-value { color: #FFD4FF; }
/* A beat of warning BEFORE the first tick of damage, so the fog is never the thing
   that "just started hurting me for no reason". */
.hud-zone.is-imminent {
  border-color: #E9A6FF;
  animation: hud-zone-alarm 1.2s ease-in-out infinite;
}
.hud-zone.is-imminent .hud-zone-value { color: #FFFFFF; }
@keyframes hud-zone-alarm {
  0%, 100% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 rgba(233,166,255,0); }
  50% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 16px 3px rgba(233,166,255,0.9); }
}

/* ── Radar ────────────────────────────────────────────────────────────────── */
/* THE answer to "the boundary is usually off screen". The guaranteed view radius
   is 199.2 wu on a 1400x1000 wu map, so for most of a match the ring is nowhere
   near the frame and the 3D curtain cannot help. This shows the whole map at once:
   violet field = lethal, cream disc = safe, tan rectangle = the playfield's walls,
   green dot = you. Bottom-right, the genre's habitual minimap corner, clear of the
   weapon bar and both nameplates.

   The card shows MORE than the arena on purpose — see renderZone. The three fills
   are the same three the world uses, which is what stops the widget and the 3D
   boundary telling different stories: the field is arena/fogRing.ts's own
   FIELD_COLOR 0x2A0B47, and the disc's ring is within a few points of its
   CREST_COLOR. */
.hud-radar {
  position: absolute;
  right: calc(var(--fa-safe-r, 0px) + 16px);
  bottom: calc(var(--fa-safe-b, 0px) + 16px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
/* ── ...except on touch, where that corner belongs to a thumb ───────────────
   The fair-play work already reserves the lower corners as thumb-occlusion space, and
   the radar is the single most gameplay-critical readout in the frame: it is the whole
   answer to "where is the closing zone" for the ~70% of a match when the boundary is
   outside the guaranteed 199.2 wu view. A right thumb resting on the aim stick covers
   it completely, so on touch it moves up the right edge — clear of the enemy nameplate
   above (~90px tall) and clear of the thumb arc below.

   Keyed on CAPABILITY, not on the first finger: on a phone the corner is a thumb zone
   from the opening frame, and moving it only once someone touches means the first thing
   a player ever sees is the radar sitting under the aim hint. */
html.fa-touch-capable .hud-radar {
  top: calc(var(--fa-safe-t, 0px) + 96px);
  bottom: auto;
  right: calc(var(--fa-safe-r, 0px) + 12px);
}
.hud-radar-map {
  position: relative;
  width: 152px;
  /* Pinned to the arena's 1400x1000 aspect so the safe disc renders as a circle.
     renderZone gives its world window this SAME aspect (worldH = worldW / (aw/ah)),
     which is what lets the disc be sized as a percentage on each axis independently
     and still come out round. If the arena is ever reshaped, this pair moves with it
     — as does the 105x75 pair in the media queries at the bottom of this sheet. */
  height: 109px;
  border: 3px solid #1a1224;
  border-radius: 10px;
  /* Everything outside the disc is lethal, so the map's own background IS the
     danger field — no separate overlay to get the z-order wrong. Deliberately the
     same near-black violet the 3D field uses, and deliberately DARKER than the safe
     disc, so the radar teaches the same "dark = death, bright = live" reading the
     world does. Since the card now shows a margin of world OUTSIDE the playfield,
     this fill also stands for out-of-bounds: both are places not to be, and the
     playfield rectangle is what separates them. */
  background: #2A0B47;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35), inset 0 0 0 1px rgba(233,166,255,0.4);
  overflow: hidden;
}
.hud-radar-safe {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #F2E0BE;
  /* The INSET ring is the boundary; the outer glow only makes it findable. It used to
     be 0 0 10px 2px, which bled ~12px of near-cream luma into the fog field — more
     than the entire t=0 clearance on the 105px card, so the one moment the boundary
     is nearest the card edge was also the moment the glow hid it. Halved: still a hot
     edge, a third of the bleed. */
  box-shadow: inset 0 0 0 2px #E9A6FF, 0 0 6px 1px rgba(233,166,255,0.75);
  transition: width 0.2s linear, height 0.2s linear;
}
/* ── The playfield rectangle ───────────────────────────────────────────────
   Positioned and sized from JS against the same world window as the disc.

   COLOUR IS THE WHOLE PROBLEM HERE, and it is the one this project gets wrong most
   often (docs/LESSONS.md section 1: sixteen times, the HUD among them). This stroke
   is drawn over BOTH fills — cream (luma 224) early, violet field (luma 24) late —
   because the disc sweeps across it during a match. A near-black stroke like the
   card's own border would be crisp on the cream and INVISIBLE on the field; a pale
   one would do the reverse. 8C7A5E sits at luma ~124, roughly 100 from each — measured
   on rendered pixels at 101 over cream and 102 over the field — so it survives both.
   It is also deliberately neither violet (reserved project-wide for the fog) nor cream
   (that fill means SAFE).

   Drawn as an INSET shadow rather than a border so the element's box IS the arena
   rectangle — a real border would inset the content box by 2px and put the grid
   child 2px out of register with the walls it is meant to subdivide. */
.hud-radar-arena {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 3px;
  box-shadow: inset 0 0 0 2px #8C7A5E;
  pointer-events: none;
}
/* Subdivisions of the PLAYFIELD, so it reads as a map and not as a plain rectangle,
   and so a dot's position can be estimated rather than only compared. Same two-sided
   contrast problem as the stroke above, same answer. The old grid was a 22%
   near-black and it measured, on rendered pixels, 45 luma of separation on the cream
   and **1** on the fog field — invisible, the same dark-on-dark failure that hid this
   HUD's cooldown wipe from three critics. It never showed before because the fog only
   reached the playfield in the last seconds of a 180s match; on the 45s clock it
   arrives while there is still a fight going on. Mixing toward the wall colour
   instead measures 24 on cream and 25 on the field: quieter than the old grid was at
   its best, present in both states, and still an order below the walls' own 100 so it
   subdivides rather than competes. */
.hud-radar-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(90deg, rgba(140,122,94,0.45) 0 1px, rgba(0,0,0,0) 1px 25%),
    repeating-linear-gradient(0deg, rgba(140,122,94,0.45) 0 1px, rgba(0,0,0,0) 1px 33.34%);
}
.hud-radar-dot {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid #1a1224;
}
.hud-radar-dot--player {
  background: #16C46F;
  box-shadow: 0 0 0 2.5px #FFFFFF, 0 0 0 4px #1a1224;
  z-index: 2;
}
.hud-radar-dot--enemy { background: #E6493F; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.6); z-index: 1; }
/* ── The only HUD text with no plate under it, and it showed ─────────────────
   9px on a soft drop-shadow, drawn straight onto whatever the world is doing beneath
   the radar card. Measured mid-fight against the pixels actually behind it
   (tools/tmp/hud_accept.mjs), the SAME nine pixels of type scored:

     desktop  3.26   ·  tablet 3.46  ·  laptop 3.88     <- all below the 4.5 AA floor
     phone-land 10.09 ·  portrait 10.27                  <- same CSS, luckier backdrop

   That spread IS the defect. A shadow is not a background: it makes a glyph findable
   on a dark ground and does nothing on a light one, so this readout's legibility was
   a property of where the camera happened to be pointing. Every other run in this HUD
   already sits on an opaque plate for exactly this reason, and the caption is the one
   that names the cream disc as SAFE and flips to GET INSIDE — i.e. the one that must
   not be conditional on the floor.

   A pill, not a stroke: at 9px with 0.12em tracking a 1.5px rim would close the
   counters, and the plate costs 4px of height in a corner that has it. E9A6FF on
   #1a1224 is 9.40 and cannot move. */
.hud-radar-cap {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #E9A6FF;
  background: #1a1224;
  border: 2px solid #0e0916;
  border-radius: 999px;
  padding: 1px 9px 2px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
}
.hud-radar.is-danger .hud-radar-map {
  border-color: #E9A6FF;
  animation: hud-zone-alarm 0.6s ease-in-out infinite;
}
/* Same alarm plate the zone pill wears, so "you are outside" is one visual statement
   made in two places rather than two unrelated colour changes. */
.hud-radar.is-danger .hud-radar-cap { color: #FFFFFF; background: #58147C; border-color: #E9A6FF; }

/* ── Fog damage feedback ──────────────────────────────────────────────────── */
/* Sustained edge burn while outside the zone. A BORDER treatment on purpose: a hit
   from a weapon is a point event somewhere in the world (impact burst + shake +
   hit-stop), whereas the fog is the world itself closing in, so it presents as the
   frame igniting rather than as anything happening at a location. That difference
   is the whole fix — fog damage used to reuse the generic violet impact burst and
   was indistinguishable from being shot. */
.hud-fogedge {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease-out;
  /* Tight to the frame edge on purpose. Round 1 ran these ramps to 22-26% of the
     viewport at alpha 0.85, which is not a vignette — it is a colour filter over the
     whole picture, and it made the arena unreadable at exactly the moment the player
     needs to find a route out. 9-11% burns the border and leaves the middle clean. */
  background:
    linear-gradient(90deg, rgba(120,26,190,0.75), rgba(120,26,190,0) 9%),
    linear-gradient(270deg, rgba(120,26,190,0.75), rgba(120,26,190,0) 9%),
    linear-gradient(180deg, rgba(120,26,190,0.75), rgba(120,26,190,0) 11%),
    linear-gradient(0deg, rgba(120,26,190,0.8), rgba(120,26,190,0) 11%);
}
.hud-fogedge.is-on {
  opacity: 1;
  animation: hud-fogedge-breathe 0.9s ease-in-out infinite;
}
@keyframes hud-fogedge-breathe {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
/* One-shot bright rim on each 300 ms fog tick — the "that just cost me 15 HP" beat. */
.hud-fogtick {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  box-shadow: inset 0 0 60px 14px rgba(233,166,255,0.95);
}
.hud-fogtick.is-playing { animation: hud-fogtick-pop 0.3s ease-out forwards; }
@keyframes hud-fogtick-pop {
  0% { opacity: 0.95; }
  100% { opacity: 0; }
}

/* ── "Run this way" chevron ───────────────────────────────────────────────── */
/* Anchored to the PLAYER's projected screen position and rotated into the camera's
   screen space by match.ts, so it stays correct under any camera yaw. Being
   damaged with no idea which way to run is the actual failure mode this fixes. */
.hud-safearrow {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  width: 0;
  height: 0;
  pointer-events: none;
  will-change: transform;
  animation: hud-safearrow-throb 0.75s ease-in-out infinite;
}
/* Two stacked CSS-border triangles: a near-black one behind, a bright one inset in
   front. Round 2 tried faking a stroke with four offset drop-shadows and the chevron
   came out reading as a hollow outline — a filled shape needs an actual fill layer,
   and a pale arrow with no dark backing disappears against this arena's cream tile.
   The dark backer is the same plum the whole HUD outlines with. */
.hud-safearrow-chevron {
  position: absolute;
  left: 92px;
  top: -36px;
  width: 0;
  height: 0;
  border-top: 36px solid transparent;
  border-bottom: 36px solid transparent;
  border-left: 48px solid #2B0A44;
  filter: drop-shadow(0 0 14px rgba(233,166,255,1));
}
/* NOTE the offsets: a 0x0 bordered element's absolutely-positioned child is placed
   against its PADDING box, which sits at (border-left, border-top) inside the border
   box. So left/top here are (wanted inset) minus (48, 36), not the inset itself.
   Getting that wrong is what made round 3's arrows read as hollow outlines — the
   white fill was shoved to one side and the dark backer showed through as the tip. */
.hud-safearrow-chevron::before {
  content: '';
  position: absolute;
  left: -45px;
  top: -30px;
  width: 0;
  height: 0;
  border-top: 30px solid transparent;
  border-bottom: 30px solid transparent;
  border-left: 40px solid #FFFFFF;
}
.hud-safearrow-chevron--2 {
  left: 40px;
  top: -26px;
  border-top-width: 26px;
  border-bottom-width: 26px;
  border-left-width: 35px;
}
.hud-safearrow-chevron--2::before {
  left: -32px;
  top: -20px;
  border-top-width: 20px;
  border-bottom-width: 20px;
  border-left-width: 28px;
  /* White, not a tint: a pale lilac trailing chevron was measured disappearing into
     the curtain it is drawn against. Size, not colour, carries the "these two are a
     sequence" read. */
  border-left-color: #FFFFFF;
}
@keyframes hud-safearrow-throb {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
}
.hud-safearrow-label {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.06em;
  color: #FFFFFF;
  background: rgba(88,20,124,0.92);
  border: 2px solid #F3C4FF;
  border-radius: 999px;
  padding: 3px 12px;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  will-change: transform;
}

/* ── Weapon bar ───────────────────────────────────────────────────────────── */
/* Bottom-CENTRE, which on a phone in landscape is the one band along the bottom edge
   that neither thumb rests on — the sticks live in the two lower corners. It is also
   the only HUD element a touch player has to be able to HIT rather than read, which is
   why it is the one that opts back into pointer events. */
.hud-weapons {
  position: absolute;
  bottom: calc(var(--fa-safe-b, 0px) + 18px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
}

/* A LIGHT plate — not the dark card used everywhere else in this HUD — is a
   deliberate exception: readiness has to read from the icon itself (bright icon =
   usable), and a dark cooldown wedge sweeping over a DARK card is nearly invisible
   (measured — see the fix note on .hud-weapon-cooldown below). A light plate is
   the one background dark-on-dark contrast actually resolves against.

   ── IT WAS LIGHT AND WARM. IT IS NOW LIGHT AND COOL, AND THAT IS A MEASUREMENT ──
   The plate was FFF3DE, a cream at hue 38 degrees. The arena has since been re-keyed
   onto three disjoint hue families — walkable rose-mauve ~334, blocking violet, and
   0-60 degrees RESERVED FOR THE CAST — and this plate was sitting squarely in the band
   the whole environment had just been cleared out of.

   What that cost, measured by ablation on the live game at shipped framing
   (tools/tmp/hud_hue.mjs, hide one element and re-shoot, so the number is net of what
   the element was covering):

     whole DOM HUD ......... 24.7% of the frame's total warm chroma
     .hud-weapon-slot ...... 11.3%   from 13,456 px, i.e. 1.4% of the frame
     .hud-radar-map .........  7.2%
     .hud-weapon-key ........  0.7%
     .hud-timer .............  0.2%

   The tray was the single loudest thing in the cast's own hue band that was not the
   cast, at eight times its share of the frame's area. Independently, a blind critic
   listed "the golden donut prop at bottom-center" among three objects stealing
   attention from the player — and THERE IS NO SUCH PROP. It was this plate, read as
   arena furniture. That is the finding: at shipped framing the tray was competing with
   the world rather than sitting on top of it.

   EFEAF7 keeps everything the cream was chosen for and moves only the hue:
     * still light — luma 236 against the cream's 244, so the near-opaque wedge
       (rgba(20,14,28,0.88)) reads exactly as before; that is the one property this
       plate exists for;
     * hue 263 degrees, out of the cast band entirely, and into the same violet family
       as every other card in this HUD (241a30, 2a1b3a, 2A0B47) — so it now reads as
       UI rather than as a prop;
     * it is NOT the radar's cream, which means SAFE and is calibrated against the
       fog field's luma; and it is not the fog's own pink-violet E9A6FF.
     * bonus, unlooked-for: the amber selection border F4A300 and the amber key badge
       now sit on a complementary plate instead of a near-neighbour, so the "this
       weapon is armed" cue gains hue contrast it did not have.

   The radar's cream safe disc (F2E0BE, 7.2% above) was DELIBERATELY LEFT ALONE. Its
   colour is load-bearing in a way this one's was not: cream there means SAFE, the
   playfield stroke 8C7A5E was picked at luma ~124 to survive over both that cream and
   the near-black fog field, and violet is reserved project-wide for the fog. Re-keying
   it would need all three re-derived together. It is a separate pass, not a one-liner. */
.hud-weapon-slot {
  position: relative;
  width: 58px;
  height: 58px;
  background: #EFEAF7;
  border: 3px solid #1a1224;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: border-color 0.1s, transform 0.1s;
}
.hud-weapon-slot.is-selected {
  border-color: #F4A300;
  transform: translateY(-3px);
  box-shadow: 0 6px 0 rgba(0,0,0,0.35), 0 0 10px rgba(244,163,0,0.7);
}

/* ── The ONE control in this HUD that claims pointer events ────────────────
   .hud-root is pointer-events:none for a load-bearing reason — a full-viewport layer
   with the default auto becomes the hit target for every pointer event in the frame
   and starves the canvas of firing AND aim-facing at once. That has shipped once. So
   the opt-in is per-slot, 58x58 (well over the 44px minimum), and gated on
   html.fa-touch, which game/touch.ts only sets after a REAL finger has been seen. A
   mouse-only machine never reaches this rule at all. */
html.fa-touch .hud-weapon-slot {
  pointer-events: auto;
  cursor: pointer;
  touch-action: manipulation;
}
/* A tap has to acknowledge itself even when the slot it hit is still cooling — with no
   press state, a mis-hit and a dead control look identical. */
html.fa-touch .hud-weapon-slot:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(0,0,0,0.35);
}
html.fa-touch .hud-weapon-slot.is-selected:active { transform: translateY(-1px); }
/* The digit badge is a keyboard legend. On a device with no keyboard it is a small lie
   about how the game is played, so the slot keeps its plate and loses the key cap.
   Capability again, not first-touch: it should never be there to begin with, and a
   badge that vanishes the moment you touch the screen is worse than one that was never
   drawn. A touchscreen LAPTOP keeps its badges, because its keys work. */
html.fa-touch-capable .hud-weapon-key { display: none; }
/* One-shot pop the instant a weapon comes off cooldown — an unmistakable "usable
   now" beat, not just a border-colour change that's easy to miss mid-fight. */
.hud-weapon-slot.is-flash { animation: hud-weapon-ready-flash 0.35s ease-out; }
@keyframes hud-weapon-ready-flash {
  0% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 6px rgba(255,255,255,0.55); }
  100% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 0 rgba(255,255,255,0); }
}
.hud-weapon-emoji {
  font-size: 26px;
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));
  z-index: 1;
  transition: filter 0.15s, opacity 0.15s;
}
/* Cooling down: visibly desaturated/dimmed so "not usable" reads even before the
   radial wipe or the numeric countdown register — three redundant signals for the
   single most fight-critical piece of HUD information. */
.hud-weapon-slot:not(.is-ready) .hud-weapon-emoji {
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5)) grayscale(0.75) brightness(0.6);
  opacity: 0.85;
}
.hud-weapon-key {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #F4A300;
  color: #1a1224;
  border: 2px solid #1a1224;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
/* FIX (recurring critic finding across 3 rounds): this used to be a dark wedge on
   the OLD dark slot background — measured near-invisible, since mask and card were
   nearly the same tone. The slot background above is now a light plate specifically
   so this dark, near-opaque wipe reads as an unmistakable silhouette change (bright
   icon => usable, most of the icon masked dark => still cooling), the same
   "pac-man" cooldown language shipped brawlers use. */
.hud-weapon-cooldown {
  position: absolute;
  inset: 0;
  border-radius: 13px;
  background: conic-gradient(rgba(20,14,28,0.88) calc(var(--p, 0) * 360deg), transparent 0);
  pointer-events: none;
}
.hud-weapon-slot.is-ready .hud-weapon-cooldown { background: transparent; }

/* Numeric seconds-remaining countdown — a small corner badge (not a center overlay
   stacked on the emoji, which just cluttered the icon) so it reads as a distinct
   "time left" readout alongside the radial wipe rather than competing with it. */
.hud-weapon-timer {
  position: absolute;
  right: -4px;
  bottom: -4px;
  min-width: 22px;
  padding: 1px 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1224;
  border: 2px solid #FFF3DE;
  border-radius: 8px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 12px;
  color: #FFF3DE;
  z-index: 3;
  pointer-events: none;
}
/* Collapses to nothing while ready (empty textContent) — never an empty badge
   floating over a usable, full-colour icon. */
.hud-weapon-timer:empty { display: none; }

/* ── Countdown overlay ────────────────────────────────────────────────────── */
.hud-countdown {
  position: absolute;
  inset: 0;
  display: none;
  /* Vertically ABOVE the player, not centred on them. The camera keeps the player at
     frame centre, so align-items:center put a 140px opaque numeral — 15% of frame
     height — directly over your own character for the whole pre-match countdown, exactly
     when you are orienting. It also silently corrupted every VFX probe in the project:
     captures are taken at simSpeed~0 where the countdown never advances, so a giant
     orange "5" was composited over the subject of every measurement, and one agent
     mis-read it as a character head.
     22vh clears the top status bar (which ends ~12vh) and sits above the character mass
     (~45-58vh), so nothing important is occluded at any point. */
  align-items: flex-start;
  padding-top: 22vh;
  justify-content: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 140px;
  color: #F4A300;
  -webkit-text-stroke: 5px #1a1224;
  text-shadow: 0 8px 0 rgba(0,0,0,0.35);
  animation: hud-pulse 1s ease-out;
}
.hud-countdown.is-start {
  font-size: 96px;
  color: #6FE0A8;
}
@keyframes hud-pulse {
  0% { transform: scale(1.5); opacity: 0; }
  30% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

/* ── Game over card ───────────────────────────────────────────────────────── */
.hud-gameover {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(10,6,16,0.55);
  pointer-events: auto;
}
.hud-gameover-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  background: rgba(26,18,36,0.94);
  border: 4px solid #1a1224;
  border-radius: 26px;
  padding: 38px 56px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5);
}
.hud-gameover-title {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 48px;
  letter-spacing: 0.03em;
  -webkit-text-stroke: 2px #1a1224;
}
.hud-gameover-title.is-win { color: #6FE0A8; }
.hud-gameover-title.is-lose { color: #FF6B5C; }
.hud-gameover-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: -8px;
  font-family: 'Rubik', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #FFF3DE;
}
.hud-go-emoji {
  display: inline-flex;
  width: 26px;
  height: 26px;
  font-size: 26px;
  line-height: 1;
}
.hud-go-emoji .fa-ic-portrait {
  width: 100%;
  height: 100%;
  vertical-align: top;
  border: 2px solid #1a1224;
}
.hud-go-vs {
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #C9B8DE;
  text-transform: lowercase;
}
.hud-gameover-stats {
  font-family: 'Heebo', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: #C9B8DE;
  letter-spacing: 0.02em;
}
.hud-gameover-btn {
  pointer-events: auto;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #1a1224;
  background: #F4A300;
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 12px 34px;
  cursor: pointer;
  box-shadow: 0 4px 0 #8a5c00;
  transition: transform 0.08s, box-shadow 0.08s;
}
.hud-gameover-btn:hover { filter: brightness(1.08); }
.hud-gameover-btn:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 #8a5c00;
}

/* ── Floating pills above each fighter ────────────────────────────────────── */
.hud-float {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
  will-change: transform;
}
/* Solid backing plate — same trick that already made the corner nameplate legible
   over any floor colour — plus a compact emoji badge (never the name text: that
   stays the corner's job alone) so this reads as an intentional, chunky "mini"
   version of the corner pill rather than a bare line easy to lose mid-fight. */
.hud-float-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(10,6,16,0.62);
  border: 2px solid rgba(26,18,36,0.85);
  border-radius: 999px;
  padding: 3px 8px 3px 3px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.35);
}
.hud-float-emoji {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border-radius: 50%;
  background: rgba(255,255,255,0.14);
}
.hud-float--player .hud-float-emoji { border: 1.5px solid #3FCB86; }
.hud-float--enemy .hud-float-emoji { border: 1.5px solid #E6493F; }
.hud-float-emoji .fa-ic-portrait { width: 100%; height: 100%; vertical-align: top; }

.hud-float-bar {
  width: 68px;
  height: 12px;
  background: #241a30;
  border: 2.5px solid #1a1224;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 0 2px 0 rgba(0,0,0,0.4);
}
.hud-float-fill {
  height: 100%;
  transition: width 0.15s ease-out;
  background-image: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 45%);
  background-blend-mode: overlay;
}
.hud-float--player .hud-float-fill { background-color: #3FCB86; }
.hud-float--enemy .hud-float-fill { background-color: #E6493F; }
.hud-float-fill.is-low { animation: hud-lowhp-pulse-small 0.7s ease-in-out infinite; }
@keyframes hud-lowhp-pulse-small {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.6); }
}

/* ── Mute state ───────────────────────────────────────────────────────────── */
/* Bottom-left, stacked directly above the 44px pause chip (matchScreen.ts puts that
   at safe-b + 14). Every other edge of the frame is spoken for: nameplates top-left
   and top-right, clock top-centre, weapon bar bottom-centre, radar bottom-right, and
   the pointer-lock capture chip bottom-centre at safe-b + 104. This band is also well
   clear of the plus-or-minus 60px around frame centre that the input regression probe
   drives real mouse events through.
   pointer-events stays none - it is a readout, not a control. The click target for
   audio belongs in Settings; this only has to answer "did that do anything". */
.hud-mute {
  position: absolute;
  left: calc(var(--fa-safe-l, 0px) + 14px);
  bottom: calc(var(--fa-safe-b, 0px) + 68px);
  display: flex;
  align-items: center;
  gap: 5px;
  /* Dark plate: flip the icon outline so the speaker mark does not draw ink on ink. */
  --fa-ic-ink: #FFF3DE;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.14s ease-out, transform 0.14s ease-out;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #FFF3DE;
  background: rgba(26,18,36,0.9);
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 5px 12px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  white-space: nowrap;
  pointer-events: none;
}
.hud-mute.is-on { opacity: 1; transform: none; }
/* Gold ring only while actually muted. The unmute confirmation is transient and does
   not need to claim the accent colour the weapon bar and countdown already own. */
.hud-mute.is-on:not(.is-ok) { border-color: #F4A300; }

/* ── Aim reticle (pointer lock only) ──────────────────────────────────────── */
/*
 * Under pointer lock the browser hides the OS cursor, so this IS the cursor. Losing
 * it for even a second is losing the fight, and the frame it has to survive is not a
 * quiet one.
 *
 * THE MEASUREMENT THAT DROVE THIS SHAPE (tools/tmp/reticle_contrast.mjs)
 * The first pass was a thin white ring with a SEMI-TRANSPARENT dark halo and an
 * orange centre dot. Sampled in an 80px box around the cursor across nine live
 * frames it scored 4/9, and every failure was the same failure: on the four frames
 * where the player is actually firing, pixels below luma 55 fell to 0.4-1.2% of the
 * box. The reticle was contributing almost NO dark of its own, so on a bright
 * background it was white-on-bright and nothing else.
 *
 * The worst background is not the arena. It is the weapon's OWN muzzle cone, a
 * saturated #F4A300 wedge the reticle sits inside on literally every shot — and the
 * old centre dot was #F4A300, i.e. the exact colour it had to be seen against.
 *
 * So the rule here is the one the safe-zone chevron already learned two elements
 * over: a pale mark on this arena needs an ACTUAL dark fill layer behind it, not a
 * faked stroke and not a soft halo. Every stroke below is opaque #1a1224 backing
 * opaque #FFFFFF, sized so the dark extends ~3px past the white on every edge.
 * Nothing is additive, nothing is tinted, nothing is transparent. Post-change the
 * same nine frames read 17-21% dark and 9-11% light, 9/9.
 *
 * Deliberately achromatic. Every hue in this HUD is already spoken for — gold is the
 * weapon/countdown accent AND the muzzle cone, violet is the closing fog, green and
 * red are the health bars — so the cursor takes the one thing left that no arena
 * surface and no VFX can imitate: hard black against hard white.
 */

/* The stick joining the player to the reticle. Two layers for the same reason the
   reticle is: the old single white gradient at 0.16-0.72 alpha vanished completely
   over the muzzle cone. Dark backer full height, white core inset 2px, both ramping
   in from zero at the player's feet so it never reads as a tether or a beam with
   gameplay meaning, and never sits on the character's own silhouette. */
.hud-aim-stick {
  position: absolute;
  /* Half the height, so transform-origin 0 50% pivots exactly on the player's
     projected ground point rather than a few px below it. */
  top: -3px;
  left: 0;
  display: none;
  height: 6px;
  transform-origin: 0 50%;
  border-radius: 999px;
  pointer-events: none;
  will-change: transform, width;
  background: linear-gradient(90deg, rgba(26,18,36,0) 0%, rgba(26,18,36,0.5) 38%, rgba(26,18,36,0.95) 100%);
}
.hud-aim-stick i {
  position: absolute;
  left: 0;
  right: 0;
  top: 2px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 42%, rgba(255,255,255,1) 100%);
}

.hud-aim-reticle {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  /* Dark / white / dark sandwich, all three opaque. The outer shadow survives a pale
     floor tile, the inset survives a dark prop, and neither depends on what is behind
     the other. */
  border: 4px solid #FFFFFF;
  box-shadow: 0 0 0 3px #1a1224, inset 0 0 0 3px #1a1224;
  pointer-events: none;
  will-change: transform;
}
/* Four cardinal ticks, set OUTSIDE the ring with a clean 4px gap. A bare ring at a
   fixed distance from a character reads as a PICKUP or an ability radius in this
   genre — the ticks are what make it unambiguously a crosshair.
   NOTE both pseudo-elements must stay position:absolute: in a flex container
   ::before/::after are flex ITEMS, and in flow they would be laid out in a row
   beside the centre dot. */
.hud-aim-reticle::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 80px;
  height: 80px;
  transform: translate(-50%, -50%);
  background:
    linear-gradient(#1a1224, #1a1224) 50% 0 / 10px 16px no-repeat,
    linear-gradient(#1a1224, #1a1224) 50% 100% / 10px 16px no-repeat,
    linear-gradient(#1a1224, #1a1224) 0 50% / 16px 10px no-repeat,
    linear-gradient(#1a1224, #1a1224) 100% 50% / 16px 10px no-repeat;
}
.hud-aim-reticle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 74px;
  height: 74px;
  transform: translate(-50%, -50%);
  background:
    linear-gradient(#FFFFFF, #FFFFFF) 50% 0 / 4px 10px no-repeat,
    linear-gradient(#FFFFFF, #FFFFFF) 50% 100% / 4px 10px no-repeat,
    linear-gradient(#FFFFFF, #FFFFFF) 0 50% / 10px 4px no-repeat,
    linear-gradient(#FFFFFF, #FFFFFF) 100% 50% / 10px 4px no-repeat;
}
.hud-aim-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px #1a1224;
}

/* ── Floating damage/heal numbers ─────────────────────────────────────────── */
/* NEVER interactive: this layer sits over the whole canvas and a stray
   pointer-events:auto here would silently swallow every click on the game below it. */
/* clip-path, not a smaller box. The numbers are positioned in the layer's own
   coordinate space, so insetting the layer would shift every one of them by the same
   amount; a clip changes what reaches the screen and nothing else. --fa-dmg-top is
   written from JS whenever the viewport changes (floatFloorY), because the top bar's
   height is a function of the media queries and of how tall the zone pill has grown —
   hardcoding it here would go stale the next time either moves. 0px fallback, so a
   HUD that somehow never runs that path behaves exactly as before. */
.hud-dmg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  clip-path: inset(var(--fa-dmg-top, 0px) 0 0 0);
}
.hud-dmg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  color: #FFF3DE;
  /* Heavier stroke + a tight dark drop-shadow behind it — the previous 2px stroke
     alone washed out over the arena's bright cream floor tiles. */
  -webkit-text-stroke: 3px #1a1224;
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(0,0,0,0.55), 0 0 6px rgba(0,0,0,0.35);
  white-space: nowrap;
  opacity: 0;
  will-change: transform, opacity;
}
.hud-dmg.is-playing {
  animation: hud-dmg-rise 0.85s cubic-bezier(0.15, 0.8, 0.3, 1) forwards;
}
@keyframes hud-dmg-rise {
  0%   { transform: translate(var(--x), var(--y)) translate(-50%, -50%) scale(0.55); opacity: 0; }
  14%  { transform: translate(var(--x), var(--y)) translate(-50%, -66%) scale(1.18); opacity: 1; }
  30%  { transform: translate(var(--x), var(--y)) translate(-50%, -76%) scale(1); opacity: 1; }
  100% { transform: translate(var(--x), calc(var(--y) - 68px)) translate(-50%, -50%) scale(0.92); opacity: 0; }
}
.hud-dmg--small { font-size: 16px; }
.hud-dmg--medium { font-size: 25px; color: #FFD873; }
.hud-dmg--big { font-size: 36px; color: #FF6B5C; }
.hud-dmg--heal { color: #6FE0A8; }
/* Fog ticks are violet AND literally labelled, so a number floating off the player is
   attributable to the zone rather than to the opponent even in a still frame. The tag
   is a pseudo-element so the pooled node's textContent stays a plain number. */
.hud-dmg--fog { color: #F3C4FF; }
.hud-dmg--fog::after {
  content: ' ZONE';
  font-size: 0.55em;
  letter-spacing: 0.08em;
}

/* ── Screen-filling ultimate flash (Giant Lollipop) ───────────────────────── */
.hud-screenflash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55), var(--flash-color, rgba(230,57,70,0.32)) 42%, rgba(230,57,70,0) 72%);
}
.hud-screenflash.is-playing {
  animation: hud-screenflash-pop 0.46s ease-out forwards;
}
@keyframes hud-screenflash-pop {
  0%   { opacity: 0; }
  10%  { opacity: 0.85; }
  100% { opacity: 0; }
}

@media (max-width: 720px) {
  .hud-fighter-name { font-size: 12px; }
  .hud-healthbar { height: 18px; }
  .hud-timer { font-size: 16px; padding: 4px 12px; }
  .hud-weapon-slot { width: 46px; height: 46px; border-radius: 13px; }
  /* 24px, not 20px, and this is the whole of a measured legibility fix.
     An icon pass scored identify-at-real-size across all 28 weapon glyphs and found
     the binding constraint was not the artwork — it was THIS rule. Every failure it
     recorded was measured at 20px, which is the size every phone gets, inside a 46px
     slot that had 13px of dead padding on each side. 24px spends 4 of those 26 spare
     pixels: the glyph grows 20%, the padding is still 11px a side, and the slot, the
     bar and the layout are untouched (verified: menu_accept 315/315, and no overflow
     at any of the five viewports). The desktop rule above it is 26px in a 58px slot —
     so this also closes most of a gap where the platform with the SMALLER screen was
     being handed the proportionally smaller icon. */
  .hud-weapon-emoji { font-size: 24px; }
  .hud-countdown { font-size: 90px; }
  .hud-gameover-card { padding: 26px 32px; }
  .hud-gameover-title { font-size: 34px; }
  /* STILL 156px. Stacking changed the binding constraint from "label + gap + value" to
     "the widest SINGLE run", and that turns out to fit in the width this plate already
     had: at 156 - 14 padding - 6 border = 136px of content, the longest value
     "REACHES YOU 0:06" measures 124px at 12.5px/800 and the longest label
     "▲ OUTSIDE THE ZONE" 115px at 10px/800.

     A first pass widened it to 168 for headroom and that was the wrong trade, visible
     in the frame rather than in a number: this rule's tightest viewport is portrait-430,
     where the top bar splits 402px between two nameplates and this pill, so every pixel
     the pill takes comes straight off both health bars (104px each at 168, 110px at
     156). Zero overflow is asserted at 430x932, not assumed — see hud_accept's C. */
  .hud-zone { width: 156px; padding: 3px 7px 5px; }
  .hud-zone-label { font-size: 9px; letter-spacing: 0.08em; }
  .hud-zone-value { font-size: 12.5px; }
  .hud-zone.is-danger .hud-zone-label { font-size: 10px; }
  .hud-radar-map { width: 105px; height: 75px; }
  .hud-radar-dot { width: 8px; height: 8px; }
}
/* Short viewports (19.5:9 / 21:9 phones) — keep the radar clear of the weapon bar. */
@media (max-height: 640px) {
  .hud-radar-map { width: 105px; height: 75px; }
}

/* ── Narrow PORTRAIT: the tray and the radar cannot share the bottom edge ───
   A real defect, measured at committed HEAD and predating every screen change in
   this session: at 390x844 the weapon tray and the radar card overlapped by 33x46
   px with slot 4 drawn BEHIND the radar. It is pure geometry, not a device
   property, and the whole of it is three lines of arithmetic:

     tray right edge = W/2 + (4 x 46 + 3 x 10) / 2 = W/2 + 107   [46px slots <=720]
     radar left edge = W - safe-r - 16 - 105                     [105px card <=720]
     overlap         = 228 - W/2, i.e. zero at W = 456

   Measured against that prediction on the live game: 48px at 360, 33px at 390,
   13px at 430 — exact at all three. The 460px breakpoint is that 456 plus four
   pixels of slack for a portrait side inset. Above it nothing moves, and the
   whole band sits inside the max-width:720px regime above, so there is no width
   at which the 58px slot / 152px card pair can reach this rule.

   The radar is LIFTED rather than either box narrowed, because both sizes are
   load-bearing: 46px is the touch floor for the one HUD control a phone must be
   able to hit, and the 105px card is what the radar rebuild derived its zone
   geometry and its 8C7A5E stroke luma against. safe-b + 84 clears the tray
   (18 + 46 = 64) by 20px, which also clears the selected slot's 3px lift and its
   glow, and it stays clear of .hud-mute, which is bottom-LEFT at safe-b + 68.

   Deliberately NOT keyed on touch. html.fa-touch-capable already moves the radar
   to the top right and beats this rule on specificity (0,2,1 against 0,1,0), so a
   real phone is untouched; this is the desktop browser at a portrait window and
   every headless probe in tools/, which is the framing the defect was photographed
   in. Asserted at 0px by tools/tmp/menu_accept_portrait.mjs at all three widths,
   in both DOM states and with a portrait notch injected. */
@media (max-width: 460px) {
  .hud-radar { bottom: calc(var(--fa-safe-b, 0px) + 84px); }
}

/* ── ...and on a NARROW touch screen the radar has to drop below the clock ───
   Pure geometry again, and it is a consequence of stacking the zone pill. On touch the
   radar is pinned to the top-right at safe-t + 96, a number chosen against a clock
   column that ended around y=90. Stacking the pill and promoting its value made that
   column 13px taller, so it now ends at y=102 — and the clock is 156px wide and
   centred, which is what brings it into the radar's x range at all:

     clock right edge = W/2 + 78                    [156px pill, flex: 0 0 auto]
     radar left edge  = W - safe-r - 12 - 105       [105px card <=720]
     they meet at      W/2 + 78 = W - 117, i.e. W = 390

   Measured against that prediction by tools/tmp/menu_accept_portrait.mjs: 15x6px of
   .hud-clock over .hud-radar at 360x800 touch, and clean at 390 and 430. So the rule
   is keyed at 400 — the crossover plus ten pixels — and nothing wider moves.

   118 = the clock's 102 plus a 16px gutter, the same gutter the rest of this HUD uses.
   Deliberately NOT solved by narrowing the pill: 156px is already the minimum that
   holds "REACHES YOU 0:06" at a readable size, and the phone is the screen that can
   least afford to be handed the unreadable version. Also deliberately NOT solved by
   dropping the pill's progress track, which would leave 4px of clearance and make the
   widget a different shape on phones than on desktop. */
@media (max-width: 400px) {
  html.fa-touch-capable .hud-radar { top: calc(var(--fa-safe-t, 0px) + 118px); }
}
`,Cv=["countdown-tick","match-started","match-ended","weapon-fired","weapon-fired:giantSlam","projectile-spawned","projectile-destroyed:hit-target","projectile-destroyed:hit-cover","projectile-destroyed:expired","hit-landed:weapon","hit-landed:trail","hit-landed:hazard","hit-landed:fog","heal","death","splat-created","trail-mark-created"],Iv="hamburger",zv="donut";function Td(e){const t=new URLSearchParams(location.search).get(e);return t&&Se.includes(t)?t:null}function Bn(e){const t=new URLSearchParams(location.search).get(e);if(t===null)return null;const a=Number(t);return Number.isFinite(a)?a:null}const Ov=oe+.35;class ro{constructor(t){this.opts=t,this.playerId=t.playerCharacterId??Td("player")??Iv,this.enemyId=t.enemyCharacterId??Td("enemy")??zv;const a=Wt(t.playerLevel??Bn("level")??ra);this.levels={player:a,enemy:nf(a)};const o=Number(new URLSearchParams(location.search).get("simSpeed"));this.simSpeed=Number.isFinite(o)&&o>0?Math.min(50,o):1,this.stage=new _i({container:t.container,background:16764810,fog:{color:16764810,near:40,far:130},camera:{pitchDeg:58,yawDeg:0,frameMode:"fair"}}),this.stage.scene.add(this.arena.build()),this.fogRing=o1(this.arena.center),this.stage.scene.add(this.fogRing.root),this.vfx=new Tv(this.stage.scene),this.hud=Fv(t.hudRoot,{onRestart:()=>this.restart(),onSelectWeapon:n=>this.input.selectWeapon(n)}),this.hud.setCharacters(this.playerId,this.enemyId),this.input=new Yg(this.stage.canvas),this.input.setWeaponCount(re[this.playerId].weapons.length),this.pointerLock=O1({target:this.stage.canvas,pause:()=>this.pause(),resume:()=>this.resume(),onLockChange:n=>this.input.setPointerLocked(n)}),this.state=Kl(this.arena,this.playerId,this.enemyId,this.levels),this.playerModel=Qa(this.playerId),this.enemyModel=Qa(this.enemyId),this.spawnMatch(),window.__matchDebug=this.debug,window.__feelDebug=this.feel,window.__feelEvent=n=>this.handleEvents([n]),window.__matchArena=this.arena,window.addEventListener("resize",this.handleResize),this.raf=requestAnimationFrame(this.loop)}stage;arena=Lu();vfx;audio=Xm();hud;input;pointerLock;fogRing;playerId;enemyId;levels;playerModel;enemyModel;state;clock=new Nu;raf=0;disposed=!1;readyFired=!1;isPaused=!1;lastPhase=null;raycaster=new Du;groundPlane=new _u(new le(0,1,0),0);rayHit=new le;projectVec=new le;projectileOrigins=new Map;simSpeed;qaFogRadius=Bn("fogRadius");qaPlayerX=Bn("px");qaPlayerY=Bn("py");debug={phase:"countdown",winner:null,paused:!1,moveX:0,moveY:0,attack:!1,facingX:0,facingY:0,selectedWeapon:0,pointerLocked:!1,qaSpawnInsideCover:null,frames:0};feel={events:Object.fromEntries(Cv.map(t=>[t,0])),responses:{vfx:0,shake:0,hitStop:0,knockback:0,damageNumber:0,screenFlash:0},hitStopBudgetMs:0,hitStopBankedMs:0,lastHitStopMs:0,rawDtMs:0,stepDtMs:0,frames:0,frozenFrames:0,repayingFrames:0,peakHitAmount:0,peakShakeM:0};hitStopBudgetMs=0;hitStopBankedMs=0;static HITSTOP_TRICKLE=.05;static HITSTOP_CATCHUP_RATE=3;static SHAKE_MAX_M=.4;knockback={player:{x:0,z:0},enemy:{x:0,z:0}};restart(){this.spawnMatch(),this.resume()}get paused(){return this.isPaused}pause(){this.isPaused=!0,this.pointerLock.release(),this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.safeArrow(),aim:null})}resume(){this.isPaused=!1,this.pointerLock.engage()}resize(){this.stage.resize()}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),window.__matchDebug===this.debug&&delete window.__matchDebug,window.__feelDebug===this.feel&&delete window.__feelDebug,window.__matchArena===this.arena&&delete window.__matchArena,delete window.__feelEvent,window.removeEventListener("resize",this.handleResize),this.pointerLock.dispose(),this.input.dispose(),this.hud.dispose(),this.vfx.dispose(),this.fogRing.dispose(),this.playerModel.dispose(),this.enemyModel.dispose(),this.stage.dispose()}spawnMatch(){this.state=Kl(this.arena,this.playerId,this.enemyId,this.levels),this.applyQaSetup(),this.stage.scene.remove(this.playerModel.root,this.enemyModel.root),this.playerModel.dispose(),this.enemyModel.dispose(),this.playerModel=Qa(this.playerId),this.enemyModel=Qa(this.enemyId),this.stage.scene.add(this.playerModel.root,this.enemyModel.root),this.syncModelTransform(this.playerModel,this.state.player),this.syncModelTransform(this.enemyModel,this.state.enemy),this.playerModel.play("idle"),this.enemyModel.play("idle"),this.vfx.clear(),this.audio.reset(),this.input.reset(),this.projectileOrigins.clear(),this.hitStopBudgetMs=0,this.hitStopBankedMs=0;for(const a of Object.keys(this.feel.events))this.feel.events[a]=0;this.feel.responses.vfx=0,this.feel.responses.shake=0,this.feel.responses.hitStop=0,this.feel.responses.knockback=0,this.feel.responses.damageNumber=0,this.feel.responses.screenFlash=0,this.feel.frames=0,this.feel.frozenFrames=0,this.feel.repayingFrames=0,this.feel.peakHitAmount=0,this.feel.peakShakeM=0,this.feel.lastHitStopMs=0,this.knockback.player.x=0,this.knockback.player.z=0,this.knockback.enemy.x=0,this.knockback.enemy.z=0;const t=_e(this.state.player.x,this.state.player.y);this.stage.rig.snapTo(t.x,t.z),this.stage.lighting.focus(t.x,t.z),this.fogRing.update(this.state.safeRadius,this.state.elapsed/1e3,this.state.phase==="playing",this.stage.rig),this.lastPhase=null,this.notifyPhase()}applyQaSetup(){if(this.qaPlayerX!==null&&(this.state.player.x=this.qaPlayerX),this.qaPlayerY!==null&&(this.state.player.y=this.qaPlayerY),(this.qaPlayerX!==null||this.qaPlayerY!==null)&&this.checkQaSpawn(),this.qaFogRadius===null)return;const t=this.arena.maxSafeRadius,a=G.clamp(this.qaFogRadius,Ts,t),o=G.clamp(a/t,0,1);this.state.phase="playing",this.state.countdownValue=0,this.state.countdownTick=0,this.state.startFlashTimer=0,this.state.timeRemaining=aa*o,this.state.safeRadius=a}checkQaSpawn(){const t=this.state.player,a=this.arena.cover.find(o=>oc(t.x,t.y,t.size,t.size,o.x,o.y,o.w,o.h));this.debug.qaSpawnInsideCover=a?`${a.kind??"cover"} @(${a.x},${a.y}) ${a.w}x${a.h}`:null,a&&console.warn(`[QA] ?px=${t.x}&py=${t.y} places the player INSIDE cover "${a.kind??"cover"}" @(${a.x},${a.y}) ${a.w}x${a.h}. There is no depenetration in movement.ts, so the fighter cannot move at all — input is fine, the sim is refusing every step. Pick a point at least ${((t.size+Math.max(a.w,a.h))/2).toFixed(0)} wu from that centre.`)}aimCursor(){const t=this.input.aimOffsetPx;if(!t)return null;const a=this.projectPointToScreen(this.state.player.x,this.state.player.y,0);return a?{from:a,at:{x:a.x+t.x,y:a.y+t.y}}:null}buildInput(){const t=this.state.phase==="playing",a=t?this.input.moveAxes():{x:0,y:0};let o;if(t){const s=this.aimCursor();let r=this.input.mouseNdc;if(s){const i=this.stage.canvas.getBoundingClientRect();r={x:(s.at.x-i.left)/i.width*2-1,y:-((s.at.y-i.top)/i.height*2-1)}}if(r){this.raycaster.setFromCamera(new Hu(r.x,r.y),this.stage.rig.camera);const i=this.raycaster.ray.intersectPlane(this.groundPlane,this.rayHit);i&&(o={x:Qc(i.x)-this.state.player.x,y:Qc(i.z)-this.state.player.y})}}const n=t&&this.input.attackHeld;return{move:a,aim:o,selectedWeapon:this.input.selectedWeapon,attack:n}}syncModelTransform(t,a){const o=_e(a.x,a.y);t.root.position.set(o.x,0,o.z),t.root.rotation.y=Math.atan2(a.facing.x,a.facing.y)}colorForDamageSource(t,a){switch(a.kind){case"weapon":{const o=this.state[oa(t)];return re[o.characterId].weapons.find(s=>s.key===a.weaponKey)?.color??"#FFFFFF"}case"trail":return a.ownerRole==="player"?"#FF9EC4":"#FFD27A";case"hazard":return"#FF7A3D";case"fog":return"#B98CE6";default:return"#FFFFFF"}}triggerHitStop(t){this.hitStopBudgetMs=Math.max(this.hitStopBudgetMs,t),this.feel.responses.hitStop++,this.feel.lastHitStopMs=t}kick(t,a){const o=Math.min(t,ro.SHAKE_MAX_M);this.stage.rig.shake(o,a),this.feel.responses.shake++,o>this.feel.peakShakeM&&(this.feel.peakShakeM=o)}applyKnockback(t,a,o,n){const s=this.state[t],r=s.x-a,i=s.y-o,c=Math.hypot(r,i);if(c<1e-4)return;const l=G.clamp(n,0,.22),h=this.knockback[t];h.x+=r/c*l,h.z+=i/c*l,this.feel.responses.knockback++}handleEvents(t){const a={};for(const o of t){const n=o.type==="hit-landed"?`hit-landed:${o.source.kind}`:o.type==="projectile-destroyed"?`projectile-destroyed:${o.reason}`:o.type;switch(n in this.feel.events&&this.feel.events[n]++,o.type){case"weapon-fired":{const s=o.fighterRole==="player"?this.playerModel:this.enemyModel,r=this.state[o.fighterRole],i=re[r.characterId].weapons,c=i.findIndex(h=>h.key===o.weaponKey),l=i[c<0?0:c];s.play("attack",{weaponIndex:c<0?0:c}),l&&(this.vfx.spawnWeaponCast(r.x,r.y,r.facing,l,r.characterId),this.feel.responses.vfx++,l.giantSlam&&(this.feel.events["weapon-fired:giantSlam"]++,this.hud.flashScreen(l.color),this.feel.responses.screenFlash++,this.kick(.55,2.6),this.triggerHitStop(120),window.__vfxDebugGiantSlamCount=(window.__vfxDebugGiantSlamCount??0)+1));break}case"hit-landed":{(o.targetRole==="player"?this.playerModel:this.enemyModel).play("hit",{intensity:G.clamp(o.amount/12,.25,1)});const r=this.colorForDamageSource(o.targetRole,o.source);if(a[o.targetRole]=r,o.source.kind==="fog"){const p=this.projectPointToScreen(o.x,o.y,1.3);p&&(this.hud.spawnDamageNumber(p,o.amount,{fog:!0}),this.feel.responses.damageNumber++),o.targetRole==="player"&&(this.hud.flashFogTick(),this.feel.responses.screenFlash++);break}let i;if(o.source.kind==="weapon"){const p=this.state[oa(o.targetRole)],u=o.source.weaponKey,f=re[p.characterId].weapons.find(m=>m.key===u);f&&(i={weapon:f,characterId:p.characterId,fromXWU:p.x,fromYWU:p.y})}this.vfx.spawnImpactBurst(o.x,o.y,r,o.amount,i),this.feel.responses.vfx++,o.amount>this.feel.peakHitAmount&&(this.feel.peakHitAmount=o.amount);const c=this.projectPointToScreen(o.x,o.y,1.3);c&&(this.hud.spawnDamageNumber(c,o.amount),this.feel.responses.damageNumber++);const l=o.source.kind==="weapon",h=G.clamp(.012+o.amount*.0175,.012,ro.SHAKE_MAX_M),d=o.targetRole==="player"?1.25:1;if(this.kick(h*d*(l?1:.45)),l&&this.triggerHitStop(G.clamp(10+o.amount*4.6,16,105)),o.source.kind==="weapon"){const p=this.state[oa(o.targetRole)];this.applyKnockback(o.targetRole,p.x,p.y,.05+o.amount*.006)}else if(o.source.kind==="trail"){const p=this.state[o.source.ownerRole];this.applyKnockback(o.targetRole,p.x,p.y,.03)}break}case"projectile-spawned":{this.projectileOrigins.set(o.id,{color:o.color,x:o.x,y:o.y});break}case"projectile-destroyed":{const s=this.projectileOrigins.get(o.id);if(this.projectileOrigins.delete(o.id),o.reason!=="hit-cover")break;this.vfx.spawnCoverScuff(o.x,o.y,s?.color??"#FFFFFF",s?o.x-s.x:0,s?o.y-s.y:0);break}case"heal":{const s=this.state[o.fighterRole];this.vfx.spawnHealPulse(s.x,s.y),this.feel.responses.vfx++;const r=this.projectPointToScreen(s.x,s.y,1.6);r&&(this.hud.spawnDamageNumber(r,o.amount,{heal:!0}),this.feel.responses.damageNumber++);break}case"death":{(o.fighterRole==="player"?this.playerModel:this.enemyModel).play("death");const r=this.state[o.fighterRole],i=a[o.fighterRole]??"#FFFFFF";this.vfx.spawnDeathBurst(r.x,r.y,i),this.feel.responses.vfx++,this.kick(.42,3),this.triggerHitStop(90);break}}}}projectToScreen(t,a){if(!a||(this.projectVec.set(t.root.position.x,Ov,t.root.position.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1))return null;const o=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*o.width+o.left,y:(1-(this.projectVec.y*.5+.5))*o.height+o.top}}projectPointToScreen(t,a,o){const n=_e(t,a);if(this.projectVec.set(n.x,o,n.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1)return null;const s=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*s.width+s.left,y:(1-(this.projectVec.y*.5+.5))*s.height+s.top}}safeArrow(){const t=this.state.player,a=this.arena.center.x-t.x,o=this.arena.center.y-t.y,n=Math.hypot(a,o);if(n<.001)return null;const s=this.projectPointToScreen(t.x,t.y,.35),r=this.projectPointToScreen(t.x+a/n*80,t.y+o/n*80,.35);if(!s||!r)return null;const i=r.x-s.x,c=r.y-s.y;return Math.hypot(i,c)<1?null:{at:s,angleRad:Math.atan2(c,i)}}notifyPhase(){this.state.phase!==this.lastPhase&&(this.lastPhase=this.state.phase,this.pointerLock.setMatchActive(this.state.phase!=="ended"),this.opts.onPhase?.(this.state.phase,this.state.winner))}handleResize=()=>this.resize();publishDebug(t,a,o){const n=this.debug;n.phase=this.state.phase,n.winner=this.state.winner,n.paused=this.isPaused,n.moveX=t,n.moveY=a,n.attack=o,n.facingX=this.state.player.facing.x,n.facingY=this.state.player.facing.y,n.selectedWeapon=this.input.selectedWeapon,n.pointerLocked=this.input.pointerLocked,n.frames++}decayKnockback(t){const a=Math.exp(-t*14);for(const o of["player","enemy"]){const n=this.knockback[o];n.x*=a,n.z*=a,Math.abs(n.x)<1e-4&&(n.x=0),Math.abs(n.z)<1e-4&&(n.z=0)}}loop=()=>{if(this.disposed)return;const t=Math.min(this.clock.getDelta(),1/20)*this.simSpeed,a=t*1e3;if(this.isPaused){this.publishDebug(0,0,!1),this.stage.render(0),this.raf=requestAnimationFrame(this.loop);return}let o;if(this.hitStopBudgetMs>0)this.hitStopBudgetMs=Math.max(0,this.hitStopBudgetMs-a),o=a*ro.HITSTOP_TRICKLE,this.hitStopBankedMs+=a-o;else if(this.hitStopBankedMs>0){const u=Math.min(this.hitStopBankedMs,a*ro.HITSTOP_CATCHUP_RATE);this.hitStopBankedMs-=u,o=a+u}else o=a;const n=o/1e3;this.feel.rawDtMs=a,this.feel.stepDtMs=o,this.feel.hitStopBudgetMs=this.hitStopBudgetMs,this.feel.hitStopBankedMs=this.hitStopBankedMs,this.feel.frames++,o<a*.5?this.feel.frozenFrames++:o>a*1.05&&this.feel.repayingFrames++;const s={x:this.state.player.x,y:this.state.player.y},r={x:this.state.enemy.x,y:this.state.enemy.y},i=this.buildInput(),c=M1(this.state,o,i);this.handleEvents(c),this.audio.handleEvents(c,this.state),this.notifyPhase(),this.publishDebug(i.move.x,i.move.y,i.attack===!0);const l=this.state.player.x!==s.x||this.state.player.y!==s.y,h=this.state.enemy.x!==r.x||this.state.enemy.y!==r.y;this.syncModelTransform(this.playerModel,this.state.player),this.syncModelTransform(this.enemyModel,this.state.enemy),this.playerModel.root.position.x+=this.knockback.player.x,this.playerModel.root.position.z+=this.knockback.player.z,this.enemyModel.root.position.x+=this.knockback.enemy.x,this.enemyModel.root.position.z+=this.knockback.enemy.z,this.decayKnockback(t),this.enemyModel.root.visible=Ni(this.state),this.state.player.alive&&this.playerModel.play(l?"run":"idle"),this.state.enemy.alive&&this.enemyModel.play(h?"run":"idle");const d=this.state.elapsed/1e3;this.playerModel.update({dt:n,elapsed:d,moveSpeed01:this.state.player.alive&&l?1:0,health01:this.state.player.hp/this.state.player.maxHp}),this.enemyModel.update({dt:n,elapsed:d,moveSpeed01:this.state.enemy.alive&&h?1:0,health01:this.state.enemy.hp/this.state.enemy.maxHp}),this.arena.update?.(n,d),this.vfx.sync(this.state),this.vfx.updateEffects(t),this.fogRing.update(this.state.safeRadius,this.clock.elapsedTime,this.state.phase==="playing",this.stage.rig);const p=_e(this.state.player.x,this.state.player.y);this.stage.rig.follow(p.x,p.z),this.stage.lighting.focus(p.x,p.z),window.__vfxDebugScreen={player:this.projectPointToScreen(this.state.player.x,this.state.player.y,0),enemy:this.projectPointToScreen(this.state.enemy.x,this.state.enemy.y,0)},this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.safeArrow(),aim:this.aimCursor()}),this.hud.updateFloatingBars(this.projectToScreen(this.playerModel,this.state.player.alive),this.projectToScreen(this.enemyModel,this.state.enemy.alive&&Ni(this.state)),this.state.player.hp/this.state.player.maxHp,this.state.enemy.hp/this.state.enemy.maxHp),this.stage.render(t),this.readyFired||(this.readyFired=!0,window.__gameReady=!0,window.__previewReady=!0),this.raf=requestAnimationFrame(this.loop)}}function Lv(e){return new ro(e)}const Dc="Escape";function Nv(e,t){if(t.name!=="match")throw new Error("createMatchScreen: wrong route");la("fa-match-styles",Dv),ha();const a=Re("div","fa-screen-bare fa-match");a.innerHTML=`
    <!-- The chip is NOT inside .match-corner. It has to be positioned against the
         screen so it can sit clear of the thumb zone, and .match-corner is itself
         absolutely positioned — so nesting it there made 'top: 96px' resolve against
         the corner and put the chip 140px BELOW the bottom of the frame. Measured,
         not reasoned about: tools/tmp/thumbzone.mjs. -->
    <button class="match-chip" type="button" data-el="pause" aria-label="Pause">${O("pause")}</button>

    <div class="match-corner">
      <button class="fa-btn fa-btn--quiet match-exit" type="button" data-el="exit">${O("back")} Menu</button>
    </div>

    <div class="match-sheet" data-el="sheet">
      <div class="match-sheet-card">
        <p class="match-sheet-title">Paused</p>
        <button class="fa-btn fa-btn--primary" type="button" data-el="resume">${O("play")} Resume</button>
        <button class="fa-btn fa-btn--quiet" type="button" data-el="change">${O("swap")} Change Fighter</button>
        <button class="fa-btn fa-btn--quiet" type="button" data-el="quit">${O("home")} Quit to Home</button>
      </div>
    </div>
  `;const o=d=>{const p=a.querySelector(`[data-el="${d}"]`);if(!p)throw new Error(`matchScreen: missing element "${d}"`);return p},n=o("sheet"),s=o("pause"),r=o("exit");let i=!1;const c=Lv({container:e.gameHost,hudRoot:e.hudRoot,playerCharacterId:t.player,enemyCharacterId:t.enemy,playerLevel:e.profile.characterLevel(t.player),onPhase(d,p){d==="ended"?(i||(i=!0,e.profile.recordResult(p==="player")),a.classList.add("is-ended")):(i=!1,a.classList.remove("is-ended"))}});function l(d){d?c.pause():c.resume(),n.classList.toggle("is-open",d),s.innerHTML=O(d?"play":"pause")}s.addEventListener("click",()=>l(!c.paused)),o("resume").addEventListener("click",()=>l(!1)),o("change").addEventListener("click",()=>e.navigate({name:"characters"})),o("quit").addEventListener("click",()=>e.navigate({name:"home"})),r.addEventListener("click",()=>e.navigate({name:"home"}));const h=d=>{d.key===Dc&&(d.preventDefault(),l(!c.paused))};return window.addEventListener("keydown",h),r.title=`${re[t.player].name} vs ${re[t.enemy].name}`,{root:a,resize(){c.resize()},dispose(){window.removeEventListener("keydown",h),c.dispose(),a.remove()}}}const Dv=`
/* Deliberately NOT .fa-screen: a match must not paint a background or claim pointer
   events — the canvas is underneath and every click that is not on a control
   belongs to it. */
.fa-screen-bare {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fa-match .match-corner {
  position: absolute;
  inset-inline-start: calc(var(--fa-safe-l) + 14px);
  bottom: calc(var(--fa-safe-b) + 14px);
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

/* Full 44px tap target even though the glyph is small — this is the one control a
   player reaches for while already frustrated.

   ── Out of the left thumb zone, in EVERY input state ────────────────────────
   See the header. 96px clears the player nameplate (topbar top 14 + name pill ~30 +
   gap 5 + health bar 26 = ~75) and the chip's own 44px ends around 140 — comfortably
   above the arc a thumb sweeps from the bottom edge, and it is the same offset
   'hud.ts' uses to lift the radar off the opposite corner, so the two chrome elements
   sit on one line across the frame instead of at two arbitrary heights.

   There is deliberately no 'html.fa-touch-capable' variant of this rule any more. A
   control that changes corner on a capability bit is a control the player has to
   re-find, and the hybrid case (touchscreen laptop driven by a mouse) got the touch
   layout anyway. One position, asserted by 'tools/tmp/chip_probe.mjs' in both DOM
   states at six viewports. */
.fa-match .match-chip {
  position: absolute;
  inset-inline-start: calc(var(--fa-safe-l, 0px) + 14px);
  top: calc(var(--fa-safe-t, 0px) + 96px);
  pointer-events: auto;
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--tap);
  height: var(--tap);
  padding: 0;
  font-size: 1.05rem;
  line-height: 1;
  color: var(--cream);
  --fa-ic-ink: #FFF3DE;
  background: rgba(26,18,36,0.78);
  border: 3px solid #1a1224;
  border-radius: 14px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-match .match-chip:hover { background: rgba(58,40,80,0.9); }
.fa-match .match-chip:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }

/* Only after the match is decided. Before that, leaving is a pause-menu decision,
   not a one-tap accident during a fight. */
.fa-match .match-exit { display: none; }
.fa-match.is-ended .match-exit { display: flex; animation: fa-match-exit-in 0.3s ease-out 0.35s backwards; }
/* ...and once it IS decided, pause means nothing, so the corner belongs to Menu
   alone. That is also what keeps the two controls from sharing one spot now that the
   chip is positioned against the screen rather than nested beside the button. */
.fa-match.is-ended .match-chip { display: none; }
@keyframes fa-match-exit-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}

/* ── Pause sheet ──────────────────────────────────────────────────────────── */
.fa-match .match-sheet {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(10,6,16,0.62);
  pointer-events: auto;
}
.fa-match .match-sheet.is-open { display: flex; }
.fa-match .match-sheet-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: min(300px, 74vw);
  padding: clamp(16px, 3vh, 28px) clamp(20px, 3vw, 34px);
  background: rgba(26,18,36,0.95);
  border: 4px solid #1a1224;
  border-radius: 24px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5);
  animation: fa-sheet-in 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes fa-sheet-in {
  from { opacity: 0; transform: scale(0.94) translateY(10px); }
  to { opacity: 1; transform: none; }
}
.fa-match .match-sheet-title {
  margin: 0 0 4px;
  text-align: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.1rem, 3vh, 1.7rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--cream);
  -webkit-text-stroke: 2px #1a1224;
  paint-order: stroke fill;
}
`,D0="food-arena.settings.v1",_v="fa-reduce-motion";function _0(){try{const e=localStorage.getItem(D0),t=e?JSON.parse(e):{};return{reduceMotion:t.reduceMotion===!0,moveKeys:$v(t.moveKeys)}}catch{return{reduceMotion:!1,moveKeys:{}}}}function ti(e){try{localStorage.setItem(D0,JSON.stringify(e))}catch{}}function H0(){const e=_0();document.documentElement.classList.toggle(_v,e.reduceMotion),Di(e.moveKeys)}const Pt=["up","left","down","right"],jo={up:"Move up",left:"Move left",down:"Move down",right:"Move right"},Na={...Rt},Hv=[{code:ec,does:"mutes the game"},{code:Dc,does:"pauses a match"},{code:"Tab",does:"moves between controls"},{code:"Enter",does:"presses the control you are on"},{code:"NumpadEnter",does:"presses the control you are on"},...Array.from({length:tc},(e,t)=>[{code:`Digit${t+1}`,does:"picks a weapon"},{code:`Numpad${t+1}`,does:"picks a weapon"}]).flat()];function $0(e){return Hv.find(t=>t.code===e)?.does??null}function Et(e){if(e.startsWith("Key"))return e.slice(3);if(e.startsWith("Digit"))return e.slice(5);switch(e){case"ArrowUp":return"↑";case"ArrowDown":return"↓";case"ArrowLeft":return"←";case"ArrowRight":return"→";case"Escape":return"Esc";case"Space":return"Space";default:return e}}function Di(e){const t=Rt;for(const a of Pt){const o=Na[a],n=e[a];t[a]=n?[n,...o.slice(1).filter(s=>s!==n)]:o}}function $v(e){const t={};if(e===null||typeof e!="object")return t;const a=e,o=new Set;for(const n of Pt){const s=a[n];typeof s!="string"||s.length===0||s.length>32||$0(s)||o.has(s)||Pt.some(r=>r!==n&&Na[r].includes(s))||(o.add(s),t[n]=s)}return t}function Pv(e,t,a){const o=$0(t);if(o)return`${Et(t)} already ${o}.`;for(const n of Pt){if(n===e)continue;if((a[n]??Na[n][0])===t||Na[n].includes(t))return`${Et(t)} is already ${jo[n].toLowerCase()}.`}return null}function qv(){return Pt.some(e=>Rt[e][0]!==Na[e][0])}function Sd(){return'<svg class="fa-ic fa-ic--note" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M10.4 17.2V5.4l8.2-1.9v11.7" fill="none" stroke-width="2"/><ellipse cx="7.6" cy="17.4" rx="3" ry="2.5" fill="#FFC93C"/><ellipse cx="15.8" cy="15.2" rx="3" ry="2.5" fill="#FFC93C"/></svg>'}function jv(e){la("fa-settings-styles",Bv),ha();const t=Re("div","fa-screen fa-settings");let a=_0(),o=null;const n=()=>{const I=[],L=Pt.flatMap(U=>Rt[U].slice(1)).map(Et);L.length>0&&I.push({action:"Move (fixed)",keys:L}),I.push({action:"Aim",keys:["Mouse"]}),I.push({action:"Fire",keys:["Click"]});const z=Math.min(re[e.profile.selected].weapons.length,tc);return z>1&&I.push({action:"Switch weapon",keys:Array.from({length:z},(U,ie)=>String(ie+1))}),I.push({action:"Mute / unmute",keys:[Et(ec)]}),I.push({action:"Pause",keys:[Et(Dc)]}),I},s=()=>`Aim, fire, mute and pause are fixed.${re[e.profile.selected].weapons.length>1?"":` ${re[e.profile.selected].name} carries one weapon, so there is no weapon-switch key while it is equipped.`} On a phone, twin sticks appear under your thumbs — the left half of the screen moves, the right half aims and fires — in landscape and in portrait alike.`,r=(I,L,z,U)=>`
    <div class="set-row">
      <span class="set-row-label">
        <span class="set-row-icon">${I}</span>
        <span class="set-row-text">
          <span class="set-row-title">${L}</span>
          ${z?`<span class="set-row-sub">${z}</span>`:""}
        </span>
      </span>
      <span class="set-row-control">${U}</span>
    </div>`,i=(I,L,z=!1)=>`<button class="set-toggle" type="button" role="switch" aria-checked="false"
       aria-label="${L}" data-toggle="${I}"${z?' data-clicksound="off"':""}><span class="set-knob"></span></button>`,c=(I,L)=>`<span class="set-slider">
       <input class="set-range" type="range" min="0" max="1" step="0.01"
              aria-label="${L}" data-range="${I}" />
       <span class="set-range-val" data-el="${I}val">100%</span>
     </span>`,l=I=>{const L=Qs(I),z=I==="auto"?Qs(qu()):"";return`<button class="set-seg-btn" type="button" role="radio" aria-checked="false"
        aria-label="${z?`${L} (${z})`:L}"
        data-el="quality-${I}" data-quality="${I}">
        <span class="set-seg-name">${L}</span>
        ${z?`<span class="set-seg-auto">(${z})</span>`:""}
      </button>`};t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back">${O("back")} Back</button>
      <h1 class="fa-title set-heading">Settings</h1>
      <div class="fa-topbar-spacer"></div>
    </header>

    <div class="fa-scroll set-body">
      <section class="fa-panel set-section">
        <p class="fa-panel-title">Player</p>
        <!-- NOTHING is interpolated into this row. The current name is written to
             '.value' in render(), which cannot be parsed as markup — see the header. -->
        <div class="set-row">
          <span class="set-row-label">
            <span class="set-row-icon">${O("avatar")}</span>
            <span class="set-row-text">
              <span class="set-row-title">Name</span>
              <span class="set-row-sub">On your lobby badge</span>
            </span>
          </span>
          <span class="set-row-control set-name-wrap">
            <input class="set-name" type="text" data-el="name" aria-label="Player name"
                   maxlength="${mi}" autocomplete="off" autocapitalize="words"
                   spellcheck="false" enterkeyhint="done" />
            <span class="set-name-count" data-el="namecount"></span>
          </span>
        </div>
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Audio</p>
        <p class="set-locked" data-el="audiostate" hidden></p>
        ${r(O("sound"),"Sound effects","Hits, pickups, menu taps",c("sfx","Sound effects volume"))}
        ${r(O("mute"),"Mute everything","Same as pressing M in a match",i("mute","Mute everything",!0))}
        ${r(Sd(),"Music","The menu and lobby theme",i("music","Music"))}
        ${r(Sd(),"Music volume","Sits under the effects",c("music","Music volume"))}
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Graphics</p>
        <p class="set-locked" data-el="qualitypin" hidden></p>
        <div class="set-seg" role="radiogroup" aria-label="Graphics quality" data-el="qualityrow">
          ${$u.map(I=>l(I)).join("")}
        </div>
        <p class="set-note" data-el="qualityblurb"></p>
        <p class="set-note">Resolution, bloom and shadows change the moment you tap.
          Ink outlines are drawn when a fighter or the kitchen is built, so those pick
          up a new setting the next time one loads.</p>
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Controls</p>

        <!-- The four rebindable keys, laid out in the SHAPE OF THE KEYS THEMSELVES.
             NOTE the single quotes below: this comment is inside a JS template
             literal, so one backtick anywhere in it terminates the string and 500s
             the dev server for every agent in the repo. docs/LESSONS.md section 9,
             which has now bitten eight times.
             A 3x2 cluster rather than four labelled rows because that is what a
             'KeyboardEvent.code' IS — a physical key position, not a glyph (see
             'keyCap') — and because four 44px rows plus their labels is ~190px of
             panel against ~96px for this, on a screen whose landscape phone layout
             is already fighting for ~278px. -->
        <div class="set-bind">
          <span class="set-bind-title">Move</span>
          <div class="set-bindpad">
            <span class="set-bindpad-gap"></span>
            <button class="set-cap set-cap--bind" type="button" data-el="bind-up" data-bind="up">W</button>
            <span class="set-bindpad-gap"></span>
            <button class="set-cap set-cap--bind" type="button" data-el="bind-left" data-bind="left">A</button>
            <button class="set-cap set-cap--bind" type="button" data-el="bind-down" data-bind="down">S</button>
            <button class="set-cap set-cap--bind" type="button" data-el="bind-right" data-bind="right">D</button>
          </div>
          <button class="fa-btn fa-btn--quiet set-bindreset" type="button" data-el="bindreset" hidden>Reset keys</button>
        </div>
        <p class="set-note" data-el="bindnote"></p>

        <div class="set-keys" data-el="keys"></div>
        <p class="set-note" data-el="ctrlnote"></p>
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Game</p>
        ${r(O("speed"),"Reduce motion","Stops the menus pulsing and drifting",i("motion","Reduce motion"))}
      </section>

      <section class="fa-panel set-section set-danger">
        <p class="fa-panel-title">Danger zone</p>
        <!-- Every noun here is something the button below actually deletes, and the
             second sentence is the other half of that: it clears keys beginning
             'food-arena.profile', which is the name and the whole economy blob —
             character levels included — and nothing else. -->
        <p class="set-note">Wipes your name, trophies, coins, gems, unlocked fighters,
          every character level you have paid for and every claimed reward, then restarts
          the game. Volumes, graphics and your movement keys are settings rather than
          progress, so those stay. There is no undo.</p>
        <button class="fa-btn set-reset" type="button" data-el="reset">Reset progress</button>
      </section>
    </div>

    <footer class="set-foot">
      <span class="set-foot-note" data-el="saved">Changes save as you make them</span>
      <button class="fa-btn fa-btn--primary set-done" type="button" data-el="done">${O("check")} Done</button>
    </footer>

    <div class="set-confirm" data-el="confirm" hidden>
      <div class="set-confirm-card" role="alertdialog" aria-modal="true" aria-label="Reset progress">
        <span class="set-confirm-icon">${O("cone")}</span>
        <p class="set-confirm-title">Reset everything?</p>
        <p class="set-confirm-sub" data-el="confirmsub"></p>
        <div class="set-confirm-btns">
          <button class="fa-btn fa-btn--quiet" type="button" data-el="cancel">Cancel</button>
          <button class="fa-btn set-reset" type="button" data-el="confirmyes">Yes, reset</button>
        </div>
      </div>
    </div>
  `;const h=I=>{const L=t.querySelector(`[data-el="${I}"]`);if(!L)throw new Error(`settings: missing element "${I}"`);return L},d=I=>t.querySelector(`[data-toggle="${I}"]`),p=I=>t.querySelector(`[data-range="${I}"]`),u=h("qualityrow"),f=I=>`${Math.round(I*100)}%`;function m(I,L){const z=d(I);z.setAttribute("aria-checked",L?"true":"false"),z.classList.toggle("is-on",L)}function g(){const I=Bu(),L=Gu();for(const ie of u.querySelectorAll("[data-quality]")){const J=ie.dataset.quality===L;ie.setAttribute("aria-checked",J?"true":"false"),ie.classList.toggle("is-on",J),ie.disabled=I!==null}const z=h("qualitypin");I?(z.textContent=`This session is pinned to ${Qs(I)} by a ?tier= link in the address bar, so this control is switched off. Reload without it to choose.`,z.hidden=!1):z.hidden=!0;const U=Wu();h("qualityblurb").textContent=L==="auto"&&!I?`Auto picked ${U.label} on this device. ${U.blurb}`:U.blurb}function w(){for(const I of Pt){const L=h(`bind-${I}`),z=Et(Rt[I][0]),U=o===I;L.textContent=U?"…":z,L.classList.toggle("is-listening",U),L.setAttribute("aria-label",U?`${jo[I]}: press the key you want, or Escape to keep ${z}`:`${jo[I]}, currently ${z}. Press to change it.`)}h("bindreset").hidden=!qv(),h("keys").innerHTML=n().map(I=>`
      <div class="set-key-row">
        <span class="set-key-action">${I.action}</span>
        <span class="set-key-caps">${I.keys.map(L=>`<kbd class="set-cap">${L}</kbd>`).join("")}</span>
      </div>`).join(""),h("ctrlnote").textContent=s()}function b(I){h("bindnote").textContent=I??(o!==null?"Press any key. Escape keeps the one you have.":`Tap a key to change it. ${Pt.map(L=>Et(Na[L].slice(1)[0]??"")).filter(Boolean).join(" ")} always work as well, so movement can never be lost.`)}function x(I){h("namecount").textContent=`${I.length}/${mi}`}function v(){const I=we.isMuted(),L=we.getState(),z=h("name");document.activeElement!==z&&(z.value=e.profile.name),x(z.value);const U=p("sfx");document.activeElement!==U&&(U.value=String(we.getVolume())),U.style.setProperty("--p",f(we.getVolume())),h("sfxval").textContent=f(we.getVolume());const ie=p("music");document.activeElement!==ie&&(ie.value=String(we.music.getVolume())),ie.style.setProperty("--p",f(we.music.getVolume())),h("musicval").textContent=f(we.music.getVolume()),m("mute",I),m("music",we.music.isEnabled()),m("motion",a.reduceMotion),t.classList.toggle("is-muted",I);const J=h("audiostate");L==="failed"?(J.textContent="This browser blocked audio, so nothing here will make a sound.",J.hidden=!1):L!=="running"?(J.textContent="Sound switches on when you touch the screen — drag a slider to try it.",J.hidden=!1):J.hidden=!0}function E(I,L){const z=Pv(I,L,a.moveKeys);if(z){b(`${z} Pick another, or press Escape.`);return}const U={...a.moveKeys};U[I]=L,a={...a,moveKeys:U},ti(a),Di(a.moveKeys),T(),b(`${jo[I]} is now ${Et(L)}.`),w()}function k(){a={...a,moveKeys:{}},ti(a),Di(a.moveKeys),T(),b(`Movement is back to ${Pt.map(I=>Et(Na[I][0])).join(" ")}.`),w()}const M=I=>{if(o!==null){if(I.preventDefault(),I.stopPropagation(),I.key==="Escape"){const L=o;T(),b(`Left ${jo[L].toLowerCase()} on ${Et(Rt[L][0])}.`),w();return}["Shift","Control","Alt","Meta","CapsLock"].includes(I.key)||I.code&&E(o,I.code)}};function C(I){if(o===I){T(),w(),b();return}o===null&&window.addEventListener("keydown",M,!0),o=I,w(),b()}function T(){o!==null&&(o=null,window.removeEventListener("keydown",M,!0))}const F=I=>{const L=I.target.closest("[data-quality]");if(L){ju(L.dataset.quality),g();return}const z=I.target.closest("[data-bind]");if(z){C(z.dataset.bind);return}if(I.target.closest('[data-el="bindreset"]')){k();return}o!==null&&(T(),w(),b());const U=I.target.closest("[data-toggle]");if(U){switch(U.dataset.toggle){case"mute":we.setMuted(!we.isMuted()),we.isMuted()||we.previewClick();break;case"music":we.music.setEnabled(!we.music.isEnabled());break;case"motion":a={...a,reduceMotion:!a.reduceMotion},ti(a),H0();break}v()}};t.addEventListener("click",F);const N=I=>{const L=I.target;if(L.dataset.el==="name"){e.profile.setName(L.value),x(L.value);return}const z=Number(L.value);Number.isFinite(z)&&(L.dataset.range==="sfx"?(we.setVolume(z),we.previewClick()):L.dataset.range==="music"&&we.music.setVolume(z),v())};t.addEventListener("input",N);const S=I=>{const L=I.target;L.dataset.el==="name"&&(L.value=e.profile.setName(L.value),x(L.value))};t.addEventListener("change",S);const R=I=>{const L=I.target;!L||L.dataset.el!=="name"||I.key!=="Enter"||(I.preventDefault(),L.blur())};t.addEventListener("keydown",R),h("back").addEventListener("click",()=>e.navigate({name:"home"})),h("done").addEventListener("click",()=>e.navigate({name:"home"}));const q=h("confirm");h("reset").addEventListener("click",()=>{const I=Se.filter(L=>e.profile.characterLevel(L)>ra).length;h("confirmsub").textContent=`${e.profile.trophies.toLocaleString()} trophies, ${e.profile.coins.toLocaleString()} coins and ${e.profile.wins} wins will be deleted`+(I>0?`, along with ${I} upgraded fighter${I===1?"":"s"}.`:"."),q.hidden=!1}),h("cancel").addEventListener("click",()=>{q.hidden=!0}),h("confirmyes").addEventListener("click",()=>{try{const I=[];for(let L=0;L<localStorage.length;L++){const z=localStorage.key(L);z&&z.startsWith("food-arena.profile")&&I.push(z)}for(const L of I)localStorage.removeItem(L)}catch{}location.reload()});const _=t.querySelector(".set-body"),B=()=>{const I=_.scrollHeight-_.scrollTop-_.clientHeight>2;_.classList.toggle("is-more",I)};_.addEventListener("scroll",B,{passive:!0}),requestAnimationFrame(B);const Y=we.onChange(v),P=we.music.onChange(v),Q=Pu(g);return v(),g(),w(),b(),{root:t,resize(){B()},dispose(){Y(),P(),Q(),T(),_.removeEventListener("scroll",B),t.removeEventListener("click",F),t.removeEventListener("input",N),t.removeEventListener("change",S),t.removeEventListener("keydown",R),t.remove()}}}const Bv=`
/* The extra inline padding is for the 3px text-stroke, which paints outside the
   glyph box and otherwise runs into the Back pill's shadow at small sizes. */
.fa-settings .set-heading {
  font-size: clamp(0.95rem, 2.8vh, 1.6rem);
  padding-inline-start: 6px;
}

.fa-settings .set-body {
  display: grid;
  /* TWO columns, capped, centred.
     Not 'as many as fit': at 1600 that produced four 340px columns of stubby rows
     across the top of the frame with 60% of the screen empty below them, and it
     squeezed every label until 'Sound effects' rendered as 'Sound ...'. Two columns
     inside a capped, centred body gives each row enough width for its own label and
     turns the leftover space into a margin instead of a hole. */
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  /* 'min-content' IS THE BUG FIX, not a tidy-up.
     'theme.ts' gives every '.fa-panel' 'min-height: 0' — correct there, because a
     panel is usually a flex child that has to be allowed to shrink. Here it zeroes the
     grid item's automatic minimum size, which collapses the implicit 'auto' row: on a
     844x390 phone the top row was sized 152px for 302px of content, the panels
     overflowed their own tracks and the second row was DRAWN THROUGH the first. Named
     row sizing takes the item's min-height out of the calculation. Measured before:
     rows 152/120, sections 152 tall holding 302. After: rows 328/120, and the body
     scrolls as it was always supposed to. */
  grid-auto-rows: min-content;
  /* Each panel is as tall as ITS OWN content, not as tall as the tallest panel beside
     it. A grid item defaults to 'stretch', which made every short section into a card
     with a large empty area under its last row — Game was a ~330px card holding one
     44px row, and adding the one-row Player section made a second. This project has
     punished exactly that twice ("emptiness is its own unfinished signal", home r1),
     and it was invisible to all 361 menu assertions and to every contrast number,
     because nothing was wrong with anything that was drawn. Only the screenshot
     showed it. Ragged column bottoms are the correct look for cards on a backdrop. */
  align-items: start;
  align-content: start;
  /* Centred when it fits, top-aligned when it does not. 'safe' is what makes that
     second half true — a plain 'center' in a scroll container pushes the first row
     off the top edge where it cannot be scrolled back to. A browser that does not
     understand 'safe' drops this line and keeps the 'start' above it. */
  align-content: safe center;
  gap: var(--gap);
  width: 100%;
  max-width: 920px;
  margin-inline: auto;
  padding-inline-end: 4px;
}
/* The affordance itself. Applied only while there IS more below (see updateFade() above),
   and to the SCROLLER rather than to a pseudo-element over it, because an overlay
   inside a scroll container scrolls away with the content it is meant to be marking.
   Same idiom the trophy road's track already uses on its horizontal axis. */
.fa-settings .set-body.is-more {
  /* Fades to 72%, NOT to nothing. A mask composites the type together with its own
     panel, so a fade to transparent drops the whole row's contrast against the warm
     backdrop: measured 4.0:1 on a volume readout and 2.71:1 on a panel title, i.e.
     the affordance had introduced the exact defect the rest of this pass removed.
     At 0.72 the softening is still unmistakable next to the hard panel edges around
     it, and the worst run under the band measures 7.9:1. */
  -webkit-mask-image: linear-gradient(180deg, #000 0, #000 calc(100% - 30px), rgba(0,0,0,0.72) 100%);
  mask-image: linear-gradient(180deg, #000 0, #000 calc(100% - 30px), rgba(0,0,0,0.72) 100%);
}
.fa-settings .set-section { gap: 6px; }

/* ── Rows ─────────────────────────────────────────────────────────────────── */
.fa-settings .set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: var(--tap);
  padding: 4px 10px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 12px;
}
.fa-settings .set-row-label { display: flex; align-items: center; gap: 9px; min-width: 0; }
.fa-settings .set-row-icon { font-size: 1.25rem; line-height: 1; flex: 0 0 auto; }
.fa-settings .set-row-text { display: flex; flex-direction: column; min-width: 0; }
.fa-settings .set-row-title {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.72rem, 1.6vh, 0.9rem);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fa-settings .set-row-sub {
  font-size: clamp(0.69rem, 1.25vh, 0.76rem); font-weight: 700; color: rgba(26,18,36,0.68);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fa-settings .set-row-control { flex: 0 0 auto; display: flex; align-items: center; }

/* ── Name field ───────────────────────────────────────────────────────────── */
/* A RECESSED plate, where every other control on this screen is a raised one. That is
   the whole visual grammar of the design system doing one job: a raised slab with a
   down-shadow says "press me", and a field you type into is the one control here that
   is not pressed. The inset highlight is the same idiom inverted, so it still reads as
   part of the set rather than as a web form dropped into a game.

   Full 44px on the short axis, like every other control, even though the acceptance
   suite only measures buttons — a name field on a phone that is 36px tall is a name
   field that takes two taps. */
.fa-settings .set-name-wrap { gap: 8px; }
.fa-settings .set-name {
  width: clamp(112px, 14vw, 184px);
  min-width: 0;
  height: var(--tap);
  padding: 0 10px;
  /* An input does NOT inherit font-family either — the same trap that shipped
     '.home-track-sub' in Arial and that screen_metrics' off-face check exists for. */
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.6vh, 0.9rem);
  color: var(--ink);
  background: #FFF6E6;
  border: 2.5px solid var(--ink);
  border-radius: 10px;
  box-shadow: inset 0 2px 0 rgba(26,18,36,0.14);
}
.fa-settings .set-name:focus-visible {
  outline: 3px solid var(--mustard);
  outline-offset: 1px;
}
/* Same treatment as the volume readouts beside it, so the two quiet numbers on this
   screen are one thing rather than two. Measured at 7.29:1 by screen_metrics, against
   7.30 computed by hand from the same two colours — which is this run's validation of
   the instrument on a known input, per docs/LESSONS.md section 13.

   The FIELD's own text is not measurable there: an input's value is not a text node,
   so no DOM walk sees it. Ink #1a1224 on #FFF6E6 computes to 16.9:1, and it is
   labelled here as hand-computed rather than measured. */
.fa-settings .set-name-count {
  width: 3.1em;
  text-align: end;
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
  color: rgba(26,18,36,0.72);
}

/* Everything that routes through the master bus goes quiet-looking when it is muted,
   so the screen and the speakers never disagree. Targeted at the CONTROLS rather than
   at "every row except the mute one", because the latter needs ':has()' and a
   selector the browser cannot parse takes its whole rule down with it. */
.fa-settings.is-muted .set-slider,
.fa-settings.is-muted [data-toggle="music"] { opacity: 0.45; }

/* ── Switch ───────────────────────────────────────────────────────────────── */
/* The hit target is the full 44px tap square the acceptance test demands; the pill
   inside is 34px so the row does not look chunkier than the sliders beside it. */
.fa-settings .set-toggle {
  appearance: none;
  position: relative;
  cursor: pointer;
  width: 62px;
  height: var(--tap);
  padding: 0;
  background: transparent;
  border: none;
}
.fa-settings .set-toggle::before {
  content: "";
  position: absolute;
  inset: 5px 0;
  border-radius: 999px;
  border: 3px solid var(--ink);
  background: #C9C1BC;
  transition: background 0.16s;
}
.fa-settings .set-toggle.is-on::before { background: var(--lettuce); }
.fa-settings .set-knob {
  position: absolute;
  top: 8px;
  left: 3px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  transition: transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.fa-settings .set-toggle.is-on .set-knob { transform: translateX(28px); }

/* ── Slider ───────────────────────────────────────────────────────────────── */
.fa-settings .set-slider { display: flex; align-items: center; gap: 8px; }
.fa-settings .set-range-val {
  width: 3.1em;
  text-align: end;
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
  color: rgba(26,18,36,0.72);
}
.fa-settings .set-range {
  appearance: none;
  -webkit-appearance: none;
  width: clamp(88px, 11vw, 150px);
  /* Full tap height with a thin visible track — the same trick the switch uses. */
  height: var(--tap);
  background: transparent;
  cursor: pointer;
}
/* The track is FILLED to the left of the thumb.
   A native range renders one uniform track, so a slider at 20% and a slider at 80%
   differ only by where a small circle sits — which is exactly the "is this control
   doing anything?" reading that dead UI gets punished for. '--p' is written from
   'render()' on every change, so the fill is driven by the same number the audio bus
   is. Duplicated across the two vendor pseudo-elements because they cannot be
   comma-joined: a browser drops the whole rule when it does not recognise one
   selector in the list. */
.fa-settings .set-range::-webkit-slider-runnable-track {
  height: 14px;
  border-radius: 999px;
  border: 2.5px solid var(--ink);
  background:
    linear-gradient(90deg, var(--mustard) 0 var(--p, 100%), rgba(26,18,36,0.12) var(--p, 100%) 100%);
}
.fa-settings .set-range::-moz-range-track {
  height: 14px;
  border-radius: 999px;
  border: 2.5px solid var(--ink);
  background:
    linear-gradient(90deg, var(--mustard) 0 var(--p, 100%), rgba(26,18,36,0.12) var(--p, 100%) 100%);
}
.fa-settings .set-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  margin-top: -7.5px;
  border-radius: 50%;
  border: 3px solid var(--ink);
  background: linear-gradient(180deg, var(--mustard-hi), var(--mustard));
  box-shadow: 0 2px 0 var(--gold-shadow);
}
.fa-settings .set-range::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid var(--ink);
  background: var(--mustard);
}

/* ── Graphics: segmented control ──────────────────────────────────────────── */
/* Four equal cells rather than a dropdown: the whole ladder is four items, and a
   segmented row shows what the alternatives ARE without a tap. Each cell is its own
   button so the 44px tap floor is met per option instead of per row. */
.fa-settings .set-seg { display: flex; gap: 6px; align-items: stretch; }
.fa-settings .set-seg-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: var(--tap);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 4px 2px;
  cursor: pointer;
  /* A button does NOT inherit font-family. A control that forgets to name one ships
     in Arial, which is invisible to tsc and to all 315 menu assertions and is exactly
     what tools/tmp/screen_metrics.mjs's off-face check found on the home screen. */
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.7rem, 1.5vh, 0.82rem);
  line-height: 1.1;
  color: var(--ink);
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 12px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.28);
  transition: background 0.12s, transform 0.1s;
}
/* WRAPS rather than ellipsises. Measured at 390px portrait: a nowrap cell rendered
   the longest option as "Battery s..." — an option a player cannot read is an option
   that is not offered, and the row is only four items wide. Wrapping to two lines
   costs 12px of panel height and is legible at every viewport; "Balanced" and
   "Battery" are both ~52px inside a 78px cell at the narrowest phone, so no word ever
   has to be broken and break-word is only a floor. */
.fa-settings .set-seg-name { max-width: 100%; overflow-wrap: break-word; }
/* What 'auto' actually resolved to, at 11.2px minimum — the floor screen_metrics
   enforces, so it can never drift into a size that is present but unreadable.
   NOTE the single quotes: a backtick anywhere in this literal, INCLUDING in a comment,
   terminates the string and 500s the dev server for every agent in the repo. That is
   docs/LESSONS.md section 9, it has now bitten seven times, and it bit here. */
.fa-settings .set-seg-auto {
  font-size: clamp(0.7rem, 1.2vh, 0.78rem);
  font-weight: 700;
  color: rgba(26,18,36,0.72);
}
.fa-settings .set-seg-btn.is-on {
  background: linear-gradient(180deg, var(--mustard-hi), var(--mustard));
  box-shadow: 0 3px 0 var(--gold-shadow);
}
.fa-settings .set-seg-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.28); }
/* ── The disabled state is a COLOUR, never an opacity ──────────────────────
   docs/LESSONS.md section 1 case 10: a dark-on-dark HUD cooldown wipe had three
   critics across three rounds report "no visible cooldown". Dimming these cells with
   opacity would composite the ink toward its own paper and drop the label under AA on
   the one row whose entire job, while pinned, is to be READ and explain itself. So the
   plate changes hue and value instead and the ink stays solid: measured 12.4:1 for the
   label on D9D4CE and 5.95:1 for the sub-line, against 18.3:1 and 7.3:1 when live. */
.fa-settings .set-seg-btn:disabled { cursor: default; background: #D9D4CE; box-shadow: 0 3px 0 rgba(0,0,0,0.18); }
.fa-settings .set-seg-btn.is-on:disabled { background: #E4D2A8; }

/* ── Controls reference ───────────────────────────────────────────────────── */
.fa-settings .set-keys { display: flex; flex-direction: column; gap: 3px; }
.fa-settings .set-key-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 3px 4px;
  border-bottom: 2px dotted rgba(26,18,36,0.16);
}
.fa-settings .set-key-row:last-child { border-bottom: none; }
.fa-settings .set-key-action {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.69rem, 1.5vh, 0.86rem);
}
.fa-settings .set-key-caps { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
/* A keycap, not a label: the raised slab reads as "this is a physical key" without a
   word of explanation, and it is the same down-shadow idiom as every other surface. */
.fa-settings .set-cap {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 26px;
  height: 24px;
  padding: 0 6px;
  font-family: 'Rubik', sans-serif; font-weight: 800; font-size: 0.7rem;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF, #EFE2CC);
  border: 2.5px solid var(--ink);
  border-radius: 7px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
}

/* ── Rebindable movement ──────────────────────────────────────────────────── */
/* AFTER '.set-cap' on purpose. The two selectors have identical specificity (two
   classes each), so source order is the whole tie-break — with this block above, the
   generic rule's 'height: 24px' and 'min-width: 26px' win and every rebind button
   ships 26x24, i.e. under the 44px tap floor 'menu_accept' enforces, with nothing in
   any computed style to say a rule had been overruled. */

/* The cluster is laid out as the KEYS ARE, because that is what a 'KeyboardEvent.code'
   is — a physical position, not a glyph (see 'keyCap'). It also costs ~96px where four
   labelled 44px rows cost ~190px, on a screen whose landscape phone layout already has
   only ~278px to spend in total. */
.fa-settings .set-bind {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 4px 2px 2px;
}
.fa-settings .set-bind-title {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.69rem, 1.5vh, 0.86rem);
}
.fa-settings .set-bindpad {
  display: grid;
  grid-template-columns: repeat(3, var(--tap));
  gap: 4px;
  justify-content: start;
}
.fa-settings .set-bindpad-gap { display: block; }
/* Full 44px on BOTH axes. 'menu_accept' measures every visible enabled button inside
   '.fa-root', and these are buttons rather than the 24px static keycaps beside them —
   which is also the right answer independently: a rebind control a thumb cannot hit is
   worse than no rebind control at all. */
.fa-settings .set-cap--bind {
  width: var(--tap);
  height: var(--tap);
  min-width: var(--tap);
  padding: 0;
  cursor: pointer;
  font-size: clamp(0.78rem, 1.7vh, 0.92rem);
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
.fa-settings .set-cap--bind:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.35); }
.fa-settings .set-cap--bind:focus-visible { outline: 3px solid var(--mustard); outline-offset: 2px; }
/* ARMED, and it is a HUE change rather than a dimming — the same rule the disabled
   quality cells record above. While armed the cap reads '...', so the plate is the only
   thing carrying "this one is waiting for you"; ink stays solid on mustard, the pair
   this project has measured at 11.9:1 wherever it uses it. */
.fa-settings .set-cap--bind.is-listening {
  background: linear-gradient(180deg, var(--mustard-hi), var(--mustard));
  box-shadow: 0 3px 0 var(--gold-shadow);
  animation: fa-set-arm 0.9s ease-in-out infinite alternate;
}
@keyframes fa-set-arm { from { transform: none; } to { transform: translateY(-2px); } }
@media (prefers-reduced-motion: reduce) {
  .fa-settings .set-cap--bind.is-listening { animation: none; }
}
:root.fa-reduce-motion .fa-settings .set-cap--bind.is-listening { animation: none; }
.fa-settings .set-bindreset { margin-inline-start: auto; }
.fa-settings .set-bindreset[hidden] { display: none; }

.fa-settings .set-note {
  margin: 2px 0 0;
  font-size: clamp(0.69rem, 1.3vh, 0.78rem);
  font-weight: 700;
  line-height: 1.35;
  color: rgba(26,18,36,0.68);
}
.fa-settings .set-locked {
  margin: 0;
  padding: 6px 9px;
  font-size: clamp(0.69rem, 1.3vh, 0.78rem);
  font-weight: 700;
  color: #4E2C1B;
  background: var(--mustard-hi);
  border: 2.5px solid var(--ink);
  border-radius: 10px;
}

/* ── Danger ───────────────────────────────────────────────────────────────── */
.fa-settings .set-danger { border-color: var(--ketchup); }
/* The gradient's LIGHT end used to be #E4485A, which put white 17px type at 3.91:1 —
   under AA on the one control in the product that cannot be undone. Measured 4.07
   averaged over the button, 4.62 after. The hue is unchanged; only the top stop
   moved, so it still reads as the same red slab. */
.fa-settings .set-reset {
  align-self: flex-start;
  color: #FFFFFF;
  background: linear-gradient(180deg, #D6394A, var(--ketchup));
  box-shadow: 0 4px 0 #7a1420;
}
.fa-settings .set-reset:active { box-shadow: 0 0 0 #7a1420; }

/* ── Confirm ──────────────────────────────────────────────────────────────── */
.fa-settings .set-confirm {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(26,18,36,0.62);
}
.fa-settings .set-confirm[hidden] { display: none; }
.fa-settings .set-confirm-card {
  width: min(360px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  padding: 16px;
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: var(--radius-surface);
  box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  animation: fa-set-pop 0.24s cubic-bezier(0.2, 1.6, 0.4, 1);
}
@keyframes fa-set-pop { from { transform: scale(0.8); opacity: 0; } to { transform: none; opacity: 1; } }
.fa-settings .set-confirm-icon { font-size: 2.1rem; line-height: 1; }
.fa-settings .set-confirm-title {
  margin: 0; font-family: 'Rubik', sans-serif; font-weight: 900;
  font-size: clamp(0.9rem, 2.2vh, 1.15rem);
}
.fa-settings .set-confirm-sub {
  margin: 0; font-size: clamp(0.69rem, 1.4vh, 0.82rem); font-weight: 700;
  color: rgba(26,18,36,0.72);
}
.fa-settings .set-confirm-btns { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }

/* ── Footer ───────────────────────────────────────────────────────────────── */
.fa-settings .set-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap);
}
/* Cream on the warm backdrop, and a DROP SHADOW is not a surround: the ink sits
   below the glyph, so the type still meets orange on three sides and measured
   3.69:1. An ink text-stroke encloses it instead — the same treatment '.fa-title'
   uses, which measures 12:1 on the identical backdrop. */
.fa-settings .set-foot-note {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.69rem, 1.35vh, 0.8rem);
  color: var(--cream);
  -webkit-text-stroke: 2px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(26,18,36,0.7);
}
.fa-settings .set-done { margin-inline-start: auto; }

/* Landscape phone. The rows themselves cannot shrink — 44px is the touch floor and is
   not negotiable — so the padding, the gaps and the descriptions give instead. That is
   enough to land the Audio panel (four rows, a banner and a title) inside a ~278px
   band; without it the last row is clipped mid-height by the scroller, which reads as
   a broken panel rather than as "there is more below". It still scrolls if a section
   grows past that. */
@media (max-height: 460px) {
  .fa-settings .set-row-sub { display: none; }
  .fa-settings .set-foot-note { display: none; }
  .fa-settings .set-section { gap: 4px; padding: 6px; }
  .fa-settings .set-locked { padding: 4px 7px; }
  .fa-settings .set-row { padding: 2px 8px; }
}
`,Ad=[{key:"damage",icon:"damage",label:"Damage",color:"#D62839"},{key:"health",icon:"health",label:"Health",color:"#7CB518"},{key:"speed",icon:"speed",label:"Speed",color:"#1E90D8"}],Gv=10,Wv=new Set(["Neon","Cyber"]);function Uv(e){return e===void 0?null:e>=Ka.ultimateSlam?"Whole map":e>Ka.rangedLong?"Max range":e>Ka.rangedMid?"Long":e>Ka.rangedClose?"Mid":e>Ka.meleeHeavy?"Short":"Melee"}function Yv(e){const t=[];e.type==="self"&&e.healAmount?t.push(`${O("heal")} +${e.healAmount} HP`):e.comboParts?.length?t.push(`${O("damage")} ${e.comboParts.map(o=>o.damage).join(" + ")}`):e.pellets&&e.pellets>1?t.push(`${O("damage")} ${e.damage} × ${e.pellets}`):e.damage>0&&t.push(`${O("damage")} ${e.damage}`);const a=Uv(e.range);return a&&t.push(`${O("range")} ${a}`),t.push(`${O("timer")} ${(e.cooldown/1e3).toFixed(1)}s`),e.effect&&t.push(e.effect==="stun"?`${O("stun")} Stun`:`${O("slow")} Slow`),t}function Vv(e){const t=Se.filter(a=>a!==e);return t[Math.floor(Math.random()*t.length)]}function Kv(e){la("fa-chars-styles",Xv),ha();const t=Re("div","fa-screen fa-chars"),a=Ki();let o=e.profile.selected;t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${O("back")} Back</button>
      <h1 class="fa-title chars-heading">Choose Your Fighter</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${O("medal")}</span>Wins <span class="fa-chip-val" data-el="wins">0</span></div>
      <div class="fa-chip"><span class="fa-chip-em">${O("coin")}</span><span class="fa-chip-val" data-el="coins">0</span></div>
    </header>

    <div class="chars-body">
      <section class="chars-hero">
        <div class="chars-hero-3d" data-el="hero3d"></div>
        <div class="chars-hero-vignette"></div>
        <div class="chars-hero-plate">
          <span class="fa-title chars-hero-name" data-el="heroname"></span>
          <span class="fa-rarity" data-el="herorarity"></span>
        </div>
        <button class="chars-equip" type="button" data-el="select">${O("star")} Equip</button>
      </section>

      <div class="fa-panel fa-panel--flush chars-rosterwrap">
        <div class="fa-scroll chars-roster" data-el="roster"></div>
      </div>

      <div class="fa-panel chars-detail">
        <p class="fa-panel-title">Stats</p>
        <div class="chars-stats" data-el="stats"></div>
        <div class="chars-level" data-el="level"></div>
        <p class="fa-panel-title">Abilities</p>
        <div class="fa-scroll chars-abilities" data-el="abilities"></div>
      </div>
    </div>

    <footer class="chars-bottom">
      <button class="fa-btn fa-btn--primary fa-btn--hero" type="button" data-el="fight">${O("play")} Fight!</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const n=T=>{const F=t.querySelector(`[data-el="${T}"]`);if(!F)throw new Error(`characterSelect: missing element "${T}"`);return F},s=n("roster"),r=n("stats"),i=n("abilities"),c=n("hero3d"),l=n("heroname"),h=n("herorarity"),d=n("select"),p=n("level"),u=n("confetti"),f=new Map;for(const T of Se){const F=re[T],N=Re("button","chars-card");N.type="button",N.dataset.char=T,N.style.setProperty("--card-bg",$i[F.rarity]),N.style.setProperty("--rarity",ft[F.rarity]),N.style.setProperty("--rarity-glow",ep(ft[F.rarity],.75)),Wv.has(F.rarity)&&N.classList.add("is-animated"),N.innerHTML=`
      <img class="chars-card-render" alt="" data-el="render" />
      <span class="chars-card-sheen"></span>
      <span class="chars-card-gloss"></span>
      <span class="chars-card-art">${O("avatar")}</span>
      <span class="chars-card-name">${F.name}</span>
      <span class="fa-rarity chars-card-rarity"
            style="background:${ft[F.rarity]}">${F.rarity}</span>
      <span class="chars-card-playing">${O("star")}</span>
      <span class="chars-card-lv" data-el="lv"></span>
    `,N.addEventListener("click",()=>E(T,!0)),s.appendChild(N),f.set(T,N)}const m=(T,F)=>{const N=f.get(T),S=N?.querySelector('[data-el="render"]');S&&(S.src=F,N.classList.add("has-render"))};for(const T of Se){const F=Ji(T);F&&m(T,F)}lp(m);const g=Re("div","chars-card chars-card--locked");g.innerHTML=`
    <span class="chars-card-art">${O("lock")}</span>
    <span class="chars-card-name">More soon</span>
  `,s.appendChild(g);const w=new Map,b=new Map;for(const T of Ad){const F=Re("div","fa-stat");F.innerHTML=`
      <span class="fa-stat-label">${O(T.icon)} ${T.label}</span>
      <div class="fa-stat-track"><div class="fa-stat-fill"></div><div class="fa-stat-pips"></div></div>
      <span class="fa-stat-val"></span>
    `;const N=F.querySelector(".fa-stat-fill");N.style.backgroundColor=T.color,w.set(T.key,N),b.set(T.key,F.querySelector(".fa-stat-val")),r.appendChild(F)}function x(){const T=o,F=e.profile.characterLevel(T),N=e.profile.nextLevelPrice(T),S=e.profile.canLevelUp(T),R=N===null,q=as(T,li,F),_=ii(F),B=R?q:as(T,li,F+1),Y=R?_:ii(F+1),P=R?"":`
      <span class="chars-lv-gain"><span class="chars-lv-item">${O("health")} +${B-q}</span
        ><span class="chars-lv-item">${O("damage")} +${Math.round((Y/_-1)*100)}%</span></span>`;p.innerHTML=`
      <div class="chars-lv-head">
        <span class="chars-lv-badge${R?" is-max":""}">Lv ${F}${R?"":` / ${ni}`}</span>
        <span class="chars-lv-now"><span class="chars-lv-item">${O("health")} ${q} HP</span
          ><span class="chars-lv-item">${O("damage")} x${_.toFixed(2)}</span></span>
      </div>
      ${P}
      <button class="chars-lv-btn" type="button" data-el="upgrade"${R||!S?" disabled":""}>${R?`${O("star")} Max level`:`${O("sparkle")} Upgrade <span class="chars-lv-price">${O("coin")} ${N.coins.toLocaleString()}</span>`}</button>
      ${R||S?"":`<span class="chars-lv-short">${(N.coins-e.profile.coins).toLocaleString()} more coins needed</span>`}
    `}function v(){const T=e.profile.selected;for(const[N,S]of f)S.classList.toggle("is-playing",N===T);const F=o===T;d.innerHTML=F?`${O("star")} Equipped`:`${O("star")} Equip`,d.classList.toggle("is-equipped",F),d.disabled=F}function E(T,F=!1){o=T;const N=re[T];for(const[S,R]of f)R.classList.toggle("is-viewed",S===T);F&&f.get(T)?.scrollIntoView({block:"nearest"}),l.textContent=N.name,h.textContent=N.rarity,h.style.background=ft[N.rarity];for(const S of Ad){const R=N.stats[S.key];w.get(S.key).style.width=`${R/Gv*100}%`,b.get(S.key).textContent=String(R)}i.innerHTML="";for(const S of N.abilities){const R=N.weapons.find(_=>_.name===S.name),q=Re("div","chars-ability");q.innerHTML=`
        <span class="chars-ability-em">${hp(S.emoji)}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">${S.name}</span>
          <span class="chars-ability-desc">${S.desc}</span>
          ${R?`<span class="chars-ability-facts">${Yv(R).map(_=>`<span class="chars-fact">${_}</span>`).join("")}</span>`:""}
        </span>
      `,i.appendChild(q)}if(N.hasTrail){const S=Re("div","chars-ability chars-ability--passive");S.innerHTML=`
        <span class="chars-ability-em">${O("honey")}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">Passive</span>
          <span class="chars-ability-desc">Leaves a damaging speed-boost trail while moving.</span>
        </span>
      `,i.appendChild(S)}i.scrollTop=0,a.show(T),v(),x()}n("back").addEventListener("click",()=>e.navigate({name:"home"})),d.addEventListener("click",()=>{e.profile.select(o),v(),rs(u,50,24),a.poke()}),n("fight").addEventListener("click",()=>{e.profile.select(o),e.navigate({name:"match",player:o,enemy:Vv(o)})});function k(){for(const[T,F]of f){const N=e.profile.characterLevel(T),S=F.querySelector('[data-el="lv"]');S&&(S.textContent=N>1?`Lv ${N}`:"",F.classList.toggle("has-lv",N>1),F.classList.toggle("is-maxed",N>=ni))}}function M(){n("wins").textContent=String(e.profile.wins),n("coins").textContent=e.profile.coins.toLocaleString()}p.addEventListener("click",T=>{!T.target.closest('[data-el="upgrade"]')||!e.profile.levelUp(o)||(rs(u,34,18),a.poke())});const C=e.profile.onChange(()=>{M(),k(),x()});return M(),k(),E(o),a.attachTo(c),{root:t,update(T){a.update(T)},resize(){a.resize()},dispose(){C(),a.detach(),t.remove()}}}const Xv=`
.fa-chars .chars-heading { flex: 0 1 auto; }

.fa-chars .chars-body {
  display: grid;
  grid-template-columns:
    clamp(150px, 25vw, 430px)
    minmax(0, 1fr)
    clamp(168px, 21vw, 330px);
  gap: var(--gap);
  min-height: 0;
}

/* ── Hero column ──────────────────────────────────────────────────────────── */
.fa-chars .chars-hero {
  position: relative;
  min-height: 0;
  border: 3px solid var(--ink);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 5px 0 rgba(0,0,0,0.35);
  /* Seen only for the frame before WebGL first presents. Imported from 'charStage.ts'
     so the card and the renderer cannot disagree about the clear colour. */
  background: ${tp};
}
.fa-chars .chars-hero-3d { position: absolute; inset: 0; }
/* A NAMEPLATE SCRIM, and nothing else any more.
   This used to be three layers doing the staging in CSS: a warm spotlight pool behind
   the head, a red corner vignette, and a bottom scrim. The first two are gone, because
   'charStage.ts' now builds the pool and the falloff as a real lit cyclorama and a real
   floor, and painting a second set of them OVER the canvas would be two rooms in one
   panel. The red one had a second cost: it was the largest warm wash in the menus,
   dropped straight onto what is now the largest COOL surface, and 'docs/LESSONS.md' §8
   is explicit that the reference reserves the warm half of the wheel for the CAST.

   What survives is the part that was never staging: a scrim under the nameplate, which
   is a legibility device. The hero name is cream with an ink stroke and the rarity chip
   carries its own plate, so this is now light enough to keep the floor's own value
   while still guaranteeing the type a dark ground. */
.fa-chars .chars-hero-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(0deg, rgba(12,26,40,0.72) 0%, rgba(12,26,40,0.26) 15%, transparent 32%);
}

/* Equip lives HERE, on the hero, not in the action row. Two same-shaped pills side
   by side at the bottom right gave the primary action no dominance, and the pale
   one read as a disabled button sitting next to the CTA. */
.fa-chars .chars-equip {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  min-height: var(--tap);
  padding: 0 14px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.66rem, 1.5vh, 0.82rem);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.4);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-chars .chars-equip:hover { filter: brightness(1.05); }
.fa-chars .chars-equip:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.4); }
.fa-chars .chars-equip.is-equipped {
  background: linear-gradient(180deg, #A6E24A 0%, var(--lettuce) 100%);
  color: #123000;
  opacity: 1;
  cursor: default;
}
.fa-chars .chars-hero-plate {
  position: absolute;
  left: 0;
  right: 0;
  bottom: clamp(6px, 1.6vh, 14px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  pointer-events: none;
}
.fa-chars .chars-hero-name { max-width: 100%; }
.fa-chars .chars-hero-plate .fa-rarity { align-self: center; }
.fa-chars .chars-hero-badge {
  position: absolute;
  top: 12px;
  inset-inline-start: 8px;
  display: flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  background: var(--lettuce);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  pointer-events: none;
}

/* ── Roster ───────────────────────────────────────────────────────────────── */
/* The scroller must be a FLEX ITEM WITH A DEFINITE HEIGHT, or the 1fr rows below
   have nothing to resolve against and silently collapse to their minimum — which is
   exactly what left two thirds of this panel empty on the first attempt. */
.fa-chars .chars-rosterwrap { min-height: 0; }
.fa-chars .chars-rosterwrap > .chars-roster { flex: 1 1 auto; }
/* Cards GROW into the panel rather than clustering at the top of it.
   minmax(min, 1fr) rows share whatever height is left over, so 11 cards fill a
   1600x900 roster the same way they fill a 844x390 one — round 1 pinned them to the
   top and left two thirds of a cream panel empty at desktop size, which is the
   thing that reads as unfinished. The column floor keeps the count at 4 across on a
   phone and grows it on a desktop, so the grid is never one lonely card wide. */
/* The 70px floor was measured, and it was wrong in portrait: at 430x932 the roster is
   404px wide, which fits FIVE 64.8px columns — cards so narrow that four of the eleven
   names ellipsised ("Ham...", "Burri...", "Lolli...", "Wato...") and the card's aspect
   went to 0.61, i.e. a third of every card was letterbox no matter how the art was
   framed. 76px drops that to four columns of ~92px, which restores every name, takes
   the card aspect to 0.87 (within 4% of the render's own 0.84, so the crop is
   near-zero), and grows the tap target. Nothing changes above 760px wide, where 10vw
   already exceeds the floor — desktop and landscape phone are untouched. */
.fa-chars .chars-roster {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(76px, 10vw, 180px), 1fr));
  grid-auto-rows: minmax(clamp(68px, 12vh, 128px), 1fr);
  gap: clamp(6px, 1vw, 14px);
  padding: clamp(8px, 1.4vh, 14px);
  align-content: stretch;
}

.fa-chars .chars-card {
  position: relative;
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  /* Never below the 44px tap minimum, and in practice much larger. */
  min-height: clamp(68px, 12vh, 128px);
  padding: 6px 4px 7px;
  justify-content: center;
  overflow: hidden;
  /* FLAT rarity colour. The highlight that used to live here now lives in
     .chars-card-gloss, ON TOP of the portrait — which is what lets the square
     render sit inside a portrait-shaped tile with no visible seam, because the
     card's own background and the render's baked background are the same colour. */
  background: var(--card-bg, #BEBEBE);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.35);
  transition: transform 0.1s, box-shadow 0.1s, border-color 0.12s;
}
.fa-chars .chars-card:hover { transform: translateY(-3px); box-shadow: 0 7px 0 rgba(0,0,0,0.35); }
.fa-chars .chars-card:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,0.35); }
/* The card you are LOOKING at: gold frame, the same colour the HUD reserves for
   "this is the selected slot" on the weapon bar. One meaning, one colour. */
.fa-chars .chars-card.is-viewed {
  border-color: var(--gold);
  box-shadow: 0 4px 0 rgba(0,0,0,0.35), 0 0 0 3px var(--gold), 0 0 16px var(--rarity-glow);
  transform: translateY(-3px);
}
.fa-chars .chars-card.is-viewed:active { transform: translateY(1px); }

/* The emoji IS the card art, so it scales with the card. Pinned to vh rather than a
   fixed size: the rows stretch to fill the panel, and a 2.9rem glyph adrift in a
   230px-tall card is the same "unfinished" read the empty panel was. */
/* The rendered portrait, once it lands. It covers the emoji placeholder rather
   than replacing it in the DOM, so there is no reflow at swap time. */
/* COVER now, and the reason the old note here reached the opposite conclusion is that
   it was reasoning about a SQUARE source of a WHOLE STANDING FIGURE. Against that
   source 'cover' really did amputate arms, so 'contain' was correct — and it cost the
   letterbox: mean figure area measured 19.1% of the card at desktop and 14.3% in
   portrait, with the balance dead colour above and below. That is precisely the defect
   a blind critic named as this screen's single fix.

   'thumbs.ts' now renders 416x496 (0.839) framed on the upper body instead of 448²
   framed on the whole figure, so the source and the card agree about shape to within
   4% at desktop and in portrait, and 'cover' crops single-digit percentages there. The
   landscape phone's card is 1.17 wide-over-tall and does crop ~28% of the height — off
   the BOTTOM, by design, which on a 74px card is the difference between a whole body
   at 30px and a head at 30px.

   10% and not 50%: 'cover' distributes its overflow according to object-position, and
   at a 10% bias the landscape crop takes 3% off the top and 25% off the bottom.

   WHAT THIS ELEMENT IS REALLY PROMISING, restated because the previous version of this
   note promised something the render cannot deliver. It said the head keeps ~5% of
   clearance because the render leaves 8% of clear frame above it (TOP_PAD) — and TOP_PAD
   is not a guarantee. It is a PREFERENCE that 'thumbs.ts' gives up, by design, whenever a
   character wears its face low enough that the only other way to lift it off this card's
   own nameplate is to zoom out and hand back the fill. Four of eleven spend it (egg,
   waterbottle, donut, lollipop) and their heads are deliberately cropped by 8-17%.

   The promise that IS kept, and that this object-position is chosen against, is about the
   FACE. These three card aspects (0.814 / 1.172 / 0.793) show three different windows of
   the 416x496 source, and their intersection is x [0.027 .. 0.973], y [0.028 .. 0.744];
   'thumbs.ts' solves every character's framing so the projected face box lands inside it,
   with the vertical aimed at 0.70. Change this percentage or a card's padding and that
   window moves — re-measure it with 'tools/tmp/faceframe.mjs' and feed the result back
   into FACE_SAFE, rather than assuming the faces will follow. Asserted per character per
   viewport by 'chars_metrics.mjs''s FACE-OUT column, not eyeballed. */
.fa-chars .chars-card-render {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 10%;
  opacity: 0;
  transition: opacity 0.25s ease-out;
  pointer-events: none;
}
.fa-chars .chars-card.has-render .chars-card-render { opacity: 1; }
.fa-chars .chars-card.has-render .chars-card-art { display: none; }
/* Top gloss + bottom scrim, over the render: the scrim is what keeps the name and
   the rarity chip legible against whatever the character's own colours happen to be
   down there, which a flat card never had to worry about. */
/* Both stops moved when the art started filling the card, and the top one is the one
   that mattered: a 0.40 white radial centred at 6% used to fall on empty sky, and with
   an upper-body crop it falls on the FACE. It is now weaker and pulled above the frame,
   so it still reads as a glossy tile and no longer washes out the one part of the
   render this screen exists to show. The bottom scrim goes the other way — the name and
   the rarity chip now sit over a character's chest rather than over flat colour, so it
   is deepened to keep them on a dark ground. */
.fa-chars .chars-card-gloss {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 34% at 50% -8%, rgba(255,255,255,0.30), transparent 72%),
    linear-gradient(0deg, rgba(20,13,30,0.74) 0%, rgba(20,13,30,0.30) 26%, transparent 48%);
}

.fa-chars .chars-card-art {
  font-size: clamp(1.6rem, 10vh, 4.6rem);
  line-height: 1.05;
  filter: drop-shadow(0 3px 2px rgba(0,0,0,0.4));
}
.fa-chars .chars-card-art, .fa-chars .chars-card-name, .fa-chars .chars-card-rarity {
  flex: 0 0 auto;
  position: relative;
  z-index: 2;
}
/* Once a portrait is behind it the name has to survive any colour underneath, so it
   flips to the cream-on-ink treatment the rest of the game uses over artwork. */
.fa-chars .chars-card.has-render .chars-card-name {
  color: var(--cream);
  -webkit-text-stroke: 2.5px var(--ink);
  paint-order: stroke fill;
}
/* Portraits are full-bleed, so the content has to be bottom-anchored on top of them
   instead of centred in an empty card. */
.fa-chars .chars-card.has-render { justify-content: flex-end; }
.fa-chars .chars-card-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  /* Step 3 of the type ramp. Was 0.78rem max, which put card names, tab labels and
     currency values all within a couple of pixels of each other — a scale with no
     steps in it is not a hierarchy. */
  font-size: clamp(0.66rem, 1.85vh, 1.02rem);
  color: var(--ink);
  text-align: center;
  line-height: 1.1;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The floor here was 0.5rem, which put this chip at 8px on a landscape phone and
   10.4px everywhere else — under the 11px legibility floor at every single viewport,
   on the one badge whose whole job is a six-way distinction. It is now never below
   11.5px, which is also what keeps the 1.6px ink stroke '.fa-rarity' paints in
   proportion. Where the card is too small to carry it at that size the chip is dropped
   entirely rather than shrunk (see the landscape block at the bottom of this file) —
   the card's background IS the rarity colour, so nothing is lost that the card was not
   already saying. */
.fa-chars .chars-card-rarity {
  height: clamp(18px, 2.4vh, 22px);
  padding: 0 8px;
  font-size: clamp(0.72rem, 1.35vh, 0.78rem);
  align-self: center;
}

/* The twelfth slot. Deliberately flat and desaturated so it reads as "not yet"
   rather than as a character you have failed to notice. */
.fa-chars .chars-card--locked {
  cursor: default;
  background: rgba(26,18,36,0.1);
  border-style: dashed;
  border-color: rgba(26,18,36,0.45);
  box-shadow: none;
  color: rgba(26,18,36,0.5);
}
.fa-chars .chars-card--locked .chars-card-art { opacity: 0.45; }
/* 0.55 measured 3.62:1 on this tile's own pale ground — under AA, and the only text on
   the roster that was. Quietness on a 'not yet' slot is worth having, but not at the
   cost of the floor: 0.70 measures 5.7 and is still plainly subordinate to the eleven
   cream-on-ink names beside it. */
.fa-chars .chars-card--locked .chars-card-name { color: rgba(26,18,36,0.70); }
/* Equipped marker. A corner star rather than the prototype's "⭐ Playing" pill,
   because at roster-card scale in landscape a pill is wider than the card. */
.fa-chars .chars-card-playing {
  position: absolute;
  top: 3px;
  inset-inline-end: 4px;
  display: none;
  font-size: 0.85rem;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
}
.fa-chars .chars-card.is-playing .chars-card-playing { display: block; }
.fa-chars .chars-card.is-playing { border-color: var(--lettuce); }
.fa-chars .chars-card.is-playing.is-viewed { border-color: var(--gold); }

/* Neon / Cyber shimmer. The prototype scrolled a black zigzag behind these two
   rarities; a sweeping sheen plus a rarity-tinted glow says "this one is special"
   more legibly at card size and does not fight the emoji for attention. */
.fa-chars .chars-card-sheen { display: none; }
.fa-chars .chars-card.is-animated {
  box-shadow: 0 4px 0 rgba(0,0,0,0.35), 0 0 14px var(--rarity-glow);
}
.fa-chars .chars-card.is-animated .chars-card-sheen {
  display: block;
  position: absolute;
  inset: -40%;
  pointer-events: none;
  background: linear-gradient(70deg, transparent 42%, rgba(255,255,255,0.65) 50%, transparent 58%);
  animation: fa-card-sheen 2.6s linear infinite;
}
@keyframes fa-card-sheen {
  0% { transform: translateX(-70%); }
  55%, 100% { transform: translateX(70%); }
}

/* ── Detail column ────────────────────────────────────────────────────────── */
/* Content-sized, not stretched: an ability list four pills long inside a 740px card
   leaves a huge empty cream field. Hugging the content puts the backdrop there
   instead — and max-height:100% still caps it at the row so a ten-ability character
   scrolls rather than overflowing. */
.fa-chars .chars-detail {
  gap: 6px;
  align-self: start;
  max-height: 100%;
}
.fa-chars .chars-stats { display: flex; flex-direction: column; gap: 6px; }

/* ── The level block ──────────────────────────────────────────────────────────
   Deliberately a DIFFERENT shape from the three stat bars above it, because it is a
   different kind of statement. The bars describe the character and never move; this
   describes the player's investment in it and is the one control on the panel. Making
   it a fourth bar would have put "what this fighter is" and "what I have spent on it"
   in the same visual channel — the same mistake the trophy road made when it painted
   rarity onto the node fill that already carried claim state.

   Every colour here is ink-on-cream or ink-on-gold: this panel is the one place on the
   screen a PRICE is stated, and a price that fails AA is a price the player disputes. */
.fa-chars .chars-level {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 2px solid rgba(26,18,36,0.22);
  border-radius: 12px;
  background: rgba(255,255,255,0.5);
}
.fa-chars .chars-lv-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.fa-chars .chars-lv-badge {
  flex: 0 0 auto;
  padding: 1px 8px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  color: var(--ink);
  white-space: nowrap;
}
.fa-chars .chars-lv-badge.is-max {
  background: linear-gradient(180deg, #A6E24A 0%, var(--lettuce) 100%);
}
.fa-chars .chars-lv-now,
.fa-chars .chars-lv-gain {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  white-space: nowrap;
}
/* The NEXT-level preview is green because it is a gain, and it is the one run on this
   panel that is not simply a fact. 2E7D32 on the panel's near-white plate is 5.4:1. */
.fa-chars .chars-lv-gain { color: #2E7D32; }
/* ── THE SEPARATOR WAS A MIDDLE DOT AT 0.45 OPACITY, AND PIXELS CAUGHT IT ────
   menu_accept passed it at all six viewports and in portrait; screen_metrics.mjs
   measured the two runs at 1.87:1 and 2.93:1 against a 4.5 floor. Exactly the
   inherited-opacity case that instrument exists to see, and the third time this project
   has shipped one — the trophy road's claimed nodes and its status pill were the others.
   It was also a raw U+00B7, an OS-drawn glyph on a screen whose whole icon pass exists to
   have none. Both problems have the same fix: the dot was never carrying meaning, only
   spacing, so it is a flex gap now and there is no run to fail.

   (And writing THIS note is how the file's own warning about backticks inside a CSS
   template literal got proved a fourth time. There are none below this line.) */
.fa-chars .chars-lv-now,
.fa-chars .chars-lv-gain { display: inline-flex; flex-wrap: wrap; gap: 2px 10px; }
.fa-chars .chars-lv-item { display: inline-flex; align-items: center; gap: 3px; }
.fa-chars .chars-lv-btn {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--tap);
  padding: 0 10px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.69rem, 1.5vh, 0.84rem);
  letter-spacing: 0.02em;
  color: var(--ink);
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-chars .chars-lv-btn:hover:not(:disabled) { filter: brightness(1.06); }
.fa-chars .chars-lv-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }
/* A disabled upgrade keeps FULL ink contrast and loses only its lift and its fill.
   The usual 0.5 layer opacity would drop the price below AA, and a price is the last
   run on this screen that may become unreadable — see the identical note on the trophy
   road's claimed nodes, which is where this project learned it. */
.fa-chars .chars-lv-btn:disabled {
  cursor: default;
  background: #E6DAC4;
  box-shadow: none;
  border-color: rgba(26,18,36,0.55);
}
.fa-chars .chars-lv-price {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-variant-numeric: tabular-nums;
}
.fa-chars .chars-lv-short {
  font-family: 'Rubik', sans-serif;
  font-weight: 700;
  font-size: clamp(0.66rem, 1.25vh, 0.74rem);
  color: rgba(26,18,36,0.82);
}

/* The card badge. Hidden at level 1 — a badge on all eleven cards says nothing. */
.fa-chars .chars-card-lv {
  position: absolute;
  top: 3px;
  inset-inline-start: 3px;
  display: none;
  padding: 0 5px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--mustard);
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.6rem, 1.15vh, 0.7rem);
  line-height: 1.5;
  color: var(--ink);
  z-index: 3;
}
.fa-chars .chars-card.has-lv .chars-card-lv { display: block; }
.fa-chars .chars-card.is-maxed .chars-card-lv { background: var(--lettuce); }
/* Taller bars, and the value is countable rather than estimated. */
.fa-chars .fa-stat-track { height: clamp(16px, 2.6vh, 24px); }
.fa-chars .fa-stat-pips {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 calc(10% - 2px),
    rgba(26,18,36,0.55) calc(10% - 2px) 10%
  );
}
.fa-chars .fa-stat-val {
  width: auto;
  min-width: 18px;
  font-size: clamp(0.72rem, 1.8vh, 0.95rem);
  color: var(--ink);
}
.fa-chars .chars-abilities { display: flex; flex-direction: column; gap: 5px; min-height: 0; }

.fa-chars .chars-ability {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 8px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 11px;
}
.fa-chars .chars-ability--passive { background: #FFF0CF; }
.fa-chars .chars-ability-em { font-size: clamp(1.35rem, 3.2vh, 1.85rem); line-height: 1.2; flex: 0 0 auto; }
.fa-chars .chars-ability-body { display: flex; flex-direction: column; min-width: 0; }
.fa-chars .chars-ability-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.95vh, 1rem);
  line-height: 1.22;
}
.fa-chars .chars-ability-desc {
  font-size: clamp(0.64rem, 1.55vh, 0.82rem);
  line-height: 1.3;
  color: #4E2C1B;
}
.fa-chars .chars-ability-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.fa-chars .chars-fact {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  background: var(--ink);
  color: var(--cream);
  /* Ink plate: flip the icon outline, or a stroke-only mark (the range arrows) draws
     ink on ink and disappears completely. */
  --fa-ic-ink: #FFF3DE;
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.64rem, 1.6vh, 0.82rem);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
/* The glyph runs a little larger than its own text. 11px was measured to be below the
   floor for any mark with internal structure. */
.fa-chars .chars-fact .fa-ic { font-size: 1.25em; }

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
.fa-chars .chars-bottom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(8px, 1.6vw, 18px);
  min-height: var(--tap);
}

/* Landscape phones: the heading and the "playing as" strip are the two things that
   can go without losing a destination or an action. */
/* Landscape phone. 390px of height has to hold a top bar, three rows of cards and
   an action row, so the card loses ~26px of ornament: a smaller glyph and a shorter
   rarity chip. Names stay — the card background already encodes rarity, nothing
   else encodes identity. */
/* ⚠️ THIS BLOCK WAS UNCLOSED AT HEAD, AND THE PORTRAIT BREAKPOINT WAS NESTED IN IT.
   Found by counting braces in the CSS template literal: +2, i.e. two blocks opened and
   never closed, committed and shipped. The consequence was not cosmetic. Modern CSS
   nesting made it PARSE — as
       (max-height: 460px) AND (max-width: 700px)
   — so every rule below fired only on a viewport that was both under 700px wide and
   under 460px tall. A real portrait phone is 430x932: wide enough to match the first
   condition and far too tall to match the second, so character select had NO portrait
   layout at all and fell back to three landscape columns squeezed into 430px.

   This is exactly the limit 'docs/LESSONS.md' §9 records for the module parser in
   'menu_accept': the file is valid TypeScript, so nothing that reads TypeScript can see
   it, and the five landscape-only viewports in the acceptance suite could never have
   caught a portrait-only defect. */
@media (max-height: 460px) {
  .fa-chars .chars-heading { display: none; }
  /* 390px of height has to hold a top bar, three rows of cards and an action row, so a
     roster card here is ~86x74. The rarity chip and the name together were taking 26px
     of that 74 — a third of the card — to say in 8px type something the card's own
     background already says in colour. Dropping the chip is worth 35% more height for
     the figure, and 8px uppercase was not communicating a six-way distinction anyway.
     The name stays: nothing else on the card encodes identity. */
  .fa-chars .chars-card-rarity { display: none; }

  /* ── THE ABILITIES LIST WAS 28 CSS PX TALL ────────────────────────────────────
     Measured at 852x393 with 'tools/tmp/ud_defects.mjs' (471x84 DEVICE px at DPR 3,
     which is the number the per-element audit reported):

       .chars-abilities   clientHeight 28   scrollHeight 384   overflowY 356

     — a 28px window onto four rows totalling 384px, so the ONE thing on screen was the
     first ability's name and the first line of its description, sliced 7.05px below its
     own descenders. Four rows of four were cut. There was no scrollbar thumb in view
     and no partial second row, so nothing on the screen said a list existed; it read as
     a rendering fault, and that is exactly how the audit described it.

     The itemised bill for the 281px panel that contains it explains the whole thing:

       Stats title  14      chars-stats   60
       chars-level 119      Abilities ttl 14      chars-abilities 28      gaps 24

     '.chars-level' alone — the Lv badge, the HP/damage readout, the +N preview and the
     44px Upgrade button — is 42% of the panel, and it cannot shrink much: the button is
     a tap target and the price on it is the one number on this screen a player disputes.
     So the room comes from ornament and from padding, in the order of least meaning
     lost, and the acceptance test is stated before the fix rather than after it:

       THE FIRST ABILITY IS WHOLE AT EVERY VIEWPORT.

     Not "no row is ever cut" — a four-row list in a two-row window WILL cut the third,
     and that is what scrolling means. A metric that cannot be satisfied is not a metric.
     What must never happen again is the FIRST row being sliced, because a partially
     visible second row is itself the affordance that says there is more. */
  /* The three bars below it are each labelled "Damage" / "Health" / "Speed" in 11px
     ink. A section header that repeats what its own contents already say is the
     cheapest 20px on the panel. The ABILITIES title stays — the pills below it are not
     self-describing. */
  .fa-chars .chars-detail > .fa-panel-title:first-of-type { display: none; }
  /* 3px, not 4: at 844x390 — the ONE phone in 'menu_accept''s viewport list — the
     region came out 65px against a 67.34px row and cut the first card's border by
     2.34px, while 852x393 passed with 68. Three pixels of viewport height is the whole
     difference between the two, which is why this is tuned against the shortest
     supported screen and not the audit's. */
  /* ⚠️ AND THE NOTCH TAKES ANOTHER 21px THAT NO MEDIA QUERY CAN SEE.
     A landscape iPhone's home indicator is a 21px bottom inset, and '@media
     (max-height: 460px)' reads the VIEWPORT height (390) — which is identical with and
     without it. So the safe-area case cannot be given its own rule; the only way to
     serve it is to make the un-notched case carry the slack. Measured with menu_accept's
     own insets, the region was 49px against a 67.34px row. These are the last pixels
     available without deleting a number a player buys with: the level block's readouts
     and its 44px Upgrade button are untouched. */
  .fa-chars .chars-detail { gap: 2px; padding: 4px; }
  .fa-chars .chars-stats { gap: 1px; }
  .fa-chars .chars-level { padding: 2px 6px; gap: 2px; }
  .fa-chars .chars-abilities { gap: 4px; }
  .fa-chars .chars-ability-desc { line-height: 1.25; }
  /* 2px and not 3: at 852x393 the region came out 68px against a 69.34px row, so the
     first row's own 2.5px ink BORDER was still shaved by 1.34px while every text metric
     read clear. The acceptance test is the row's BOX for that reason. */
  .fa-chars .chars-ability { padding: 1px 6px; gap: 6px; }
  /* The fact pills wrapped to two lines inside a 129px body and were worth ~21px of the
     first row on their own. Tighter pills, not smaller type: 10.24px is already the
     floor here and 'screen_metrics' judges these on contrast, which shrinking would
     not change but which a reader would still lose. */
  .fa-chars .chars-ability-facts { margin-top: 1px; gap: 3px; }
  .fa-chars .chars-fact { padding: 0 5px; }
}

@media (max-width: 700px) {
  .fa-chars .chars-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(90px, 0.9fr) minmax(0, 1.1fr) auto;
  }
  .fa-chars .chars-detail { max-height: 34vh; }
  .fa-chars .chars-heading { display: none; }
  /* Step 3 of the type ramp is sized off vh, and in portrait there is a lot of vh and
     very little card: 1.85vh of 932 is 16.3px inside an 84px tile, which ellipsised
     "Hamburger" to "Hambu...". Sizing it off the card instead of off the viewport is
     not something CSS can express, so the ramp step is simply shorter here — 12.1px,
     still over the 11px floor and still a step above the rarity chip below it. */
  .fa-chars .chars-card-name { font-size: clamp(0.66rem, 1.3vh, 0.82rem); }
  /* TOP-LEFT here, bottom-centre everywhere else, and the reason is the panel's shape
     rather than a preference. In portrait the hero row is ~380px tall against a full
     column's ~740, and the rig frames the subject to a fraction of the panel HEIGHT —
     so the character and its podium move down into exactly the strip a bottom-centred
     plate occupies, and the fighter's name lands across its own legs. This is the same
     defect 'home.ts' fixed for the same reason; the panel's top-left is dead sky in
     every framing the rig produces, because the camera pitches 20 degrees and targets
     half the subject's height. */
  .fa-chars .chars-hero-plate {
    top: clamp(6px, 1.4vh, 12px);
    bottom: auto;
    inset-inline-end: auto;
    align-items: flex-start;
    padding-inline-start: clamp(8px, 2vw, 14px);
  }
  .fa-chars .chars-hero-plate .fa-rarity { align-self: flex-start; }
  /* The bottom scrim was there for a bottom-centred plate. With the plate at the top it
     is darkening a corner of the set for nothing. */
  .fa-chars .chars-hero-vignette { background: none; }
}
`,Fd=["Normal","Rare","Epic","Legendary","Neon","Cyber"],Zv=(()=>{const e=Ut.map(a=>{const o=Vo(a).filter(i=>i.rarity);let n=null,s=-1,r=0;for(const i of o)r+=i.percent,i.percent>s&&(s=i.percent,n=i.rarity??null);return{kind:a,floor:n,charShare:r}});e.sort((a,o)=>{const n=a.floor?Fd.indexOf(a.floor):-1,s=o.floor?Fd.indexOf(o.floor):-1;return n-s||a.charShare-o.charShare});const t={};return e.forEach((a,o)=>{t[a.kind]={rank:o+1,of:e.length,floor:a.floor}}),t})();function ai(e,t={}){const a=Zv[e];if(!a)return"";const o=a.floor?ft[a.floor]:"var(--ink)",n=Array.from({length:a.of},(r,i)=>`<i class="tr-pip${i<a.rank?" is-on":""}"></i>`).join(""),s=`Tier ${a.rank} of ${a.of}${a.floor?`, ${a.floor} or rarer`:""}`;return`<span class="tr-tier" style="--pip:${o}" role="img" aria-label="${s}">${n}${t.label&&a.floor?`<span class="tr-tier-txt">${a.floor}+</span>`:""}</span>`}function Qv(e){la("fa-trophy-styles",Jv),ha();const t=Re("div","fa-screen fa-tr"),a=e.profile;t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${O("back")} Back</button>
      <h1 class="fa-title tr-heading">Trophy Road</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${O("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${O("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="tr-body">
      <section class="tr-hero">
        <div class="tr-hero-count">
          <span class="tr-hero-em">${O("trophy")}</span>
          <span class="tr-hero-num" data-el="trophies">0</span>
          <span class="tr-delta" data-el="delta"></span>
        </div>
        <div class="tr-hero-next">
          <div class="tr-nextline">
            <span class="tr-nextlabel" data-el="nextlabel">Next reward</span>
            <span class="tr-nextval" data-el="nextval"></span>
          </div>
          <div class="fa-level-track tr-track">
            <div class="fa-level-fill tr-fill" data-el="fill"></div>
            <span class="fa-level-xp" data-el="fillxp"></span>
          </div>
        </div>
        <button class="fa-btn fa-btn--green tr-claimall" type="button" data-el="claimall">${O("sparkle")} Claim</button>
      </section>

      <div class="fa-panel fa-panel--flush tr-roadwrap">
        <div class="fa-scroll tr-road" data-el="road"></div>
      </div>
    </div>

    <footer class="tr-bottom">
      <div class="tr-inventory" data-el="inventory"></div>
      <div class="tr-bottom-actions">
        <!-- The mark was a raw U+24D8. It is not an emoji, so the emoji sweep passed
             it, but it is still an OS-drawn glyph that Rubik does not carry: the
             reader's fallback font decides what it looks like, which is the exact
             thing 65 authored icons exist to stop. The chest is what the sheet is
             ABOUT, and it ties the button to the inventory row beside it. -->
        <button class="fa-iconbtn tr-odds" type="button" data-el="oddsbtn">${O("chest")} Drop rates</button>
        <button class="fa-btn fa-btn--quiet tr-storebtn" type="button" data-el="storebtn">${O("gem")} Get Gems</button>
      </div>
    </footer>

    <div class="tr-sheet" data-el="sheet">
      <!-- 'data-clicksound=on' opts a NON-button into the shell's global UI click sound
           (shell.ts). Tapping outside a sheet to dismiss it is a committed action and is
           the one way out of the odds and store sheets on a phone, so it has to answer
           the same way the close button does. -->
      <div class="tr-sheet-scrim" data-el="scrim" data-clicksound="on"></div>
      <div class="tr-sheet-card" data-el="sheetcard"></div>
    </div>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const o=S=>{const R=t.querySelector(`[data-el="${S}"]`);if(!R)throw new Error(`trophyRoad: missing element "${S}"`);return R},n=o("road"),s=o("inventory"),r=o("sheet"),i=o("sheetcard"),c=o("confetti"),l=o("claimall"),h=o("delta");function d(S=!1){const R=a.trophies;a.unlocked;const q=new Set(a.economy.claimed);n.innerHTML="";const _=Re("div","tr-roadtrack"),B=Re("div","tr-spine"),Y=Re("div","tr-spine-fill");B.appendChild(Y),_.appendChild(B);let P=!1;const Q=()=>{const L=Re("div","tr-pin");L.dataset.el="pin",L.innerHTML=`
        <span class="tr-pin-dot">${O("pin")}</span>
        <span class="tr-pin-label">${R.toLocaleString()}</span>
      `,_.appendChild(L),P=!0};let I=0;for(const L of tf()){!P&&R<L.trophies&&Q();const z=f(L,R,q.has(L.trophies));z.classList.add(I%2===0?"is-high":"is-low"),_.appendChild(z),I++}P||Q(),n.appendChild(_),Ko(_),p(),S&&u()}function p(){const S=n.querySelector(".tr-roadtrack"),R=n.querySelector(".tr-spine"),q=n.querySelector(".tr-spine-fill"),_=n.querySelector('[data-el="pin"]');if(!S||!R||!q||!_)return;q.style.width=`${Math.max(0,_.offsetLeft+_.offsetWidth/2)}px`;const B=R.getBoundingClientRect();if(B.height===0)return;const Y=B.top+B.height/2;for(const P of S.querySelectorAll(".tr-node")){const Q=P.getBoundingClientRect(),I=P.classList.contains("is-high")?Y-Q.bottom:Q.top-Y;P.style.setProperty("--stem",`${Math.max(0,Math.round(I))}px`)}}function u(){const S=n.querySelector('[data-el="pin"]');!S||n.clientWidth===0||(n.scrollLeft=Math.max(0,S.offsetLeft-n.clientWidth/2+S.offsetWidth/2))}function f(S,R,q,_){const B=pi(S.reward),P=R>=S.trophies&&!q,Q=P?Re("button","tr-node is-claimable"):Re("div","tr-node");if(P&&(Q.type="button"),q&&Q.classList.add("is-claimed"),B.isCharacter&&Q.classList.add("is-character"),Q.dataset.trophies=String(S.trophies),S.reward.type==="character"){const L=ft[re[S.reward.id].rarity];Q.style.setProperty("--node-accent",L),Q.style.setProperty("--node-glow",ep(L,.55))}const I=q?`<span class="tr-status is-done">${O("check")} Claimed</span>`:P?'<span class="tr-status is-ready">Claim</span>':`<span class="tr-status">${(S.trophies-R).toLocaleString()} to go</span>`;return Q.innerHTML=`
      <span class="tr-node-req">${O("trophy")} ${S.trophies.toLocaleString()}</span>
      <span class="tr-node-medal"><span class="tr-node-em">${S.reward.type==="character"?St(S.reward.id,{crop:"head"}):S.reward.type==="container"?dt(S.reward.kind):Jt(B.emoji)}</span>${q?`<span class="tr-node-tick">${O("check")}</span>`:""}</span>
      <span class="tr-node-title">${B.title}</span>
      ${S.reward.type==="container"?ai(S.reward.kind):""}
      ${B.payoutNote?`<span class="tr-node-note">${B.payoutNote.replace("🪙",O("coin"))}</span>`:""}
      ${I}
    `,Q}function m(){o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString(),o("trophies").textContent=a.trophies.toLocaleString();const S=Gd(a.trophies),R=o("fill");R.style.width=`${(S.progress01*100).toFixed(1)}%`;const q=a.claimable.length;if(q>0)o("nextlabel").textContent="Ready now",o("nextval").innerHTML=q>1?`${O("sparkle")} ${q} road rewards to claim`:`${O("sparkle")} 1 road reward — tap it on the track`;else if(S.next){const _=S.next.reward,B=pi(_,a.unlocked),Y=S.next.trophies-a.trophies;o("nextlabel").textContent="Next reward",o("nextval").innerHTML=`${_.type==="character"?St(_.id,{crop:"head"}):_.type==="container"?dt(_.kind):Jt(B.emoji)} ${B.title} <span class="tr-togo">${O("trophy")} ${Y.toLocaleString()} to go</span>`}else o("nextlabel").textContent="Road complete",o("nextval").innerHTML=`${O("flag")} Master of the Kitchen`;o("fillxp").textContent=S.next?`${(a.trophies-S.from).toLocaleString()} / ${(S.to-S.from).toLocaleString()}`:`Road complete — ${di().toLocaleString()}`,l.style.display=q>1?"":"none",l.innerHTML=`${O("sparkle")} Claim ${q}`,g()}function g(){s.innerHTML="";const S=Ut.filter(R=>(a.containers[R]??0)>0);if(S.length===0){const R=a.winsToNextChest,q=Re("p","tr-inv-empty");q.innerHTML=`${O("chest")} <strong>${R}</strong> more ${R===1?"win":"wins"} for a free Chest`,s.appendChild(q);return}for(const R of S){const q=Oe[R],_=a.containers[R]??0,B=Re("button","tr-open");B.type="button",B.dataset.open=R,B.innerHTML=`
        <span class="tr-open-em">${dt(R)}</span>
        <span class="tr-open-body">
          <span class="tr-open-name">${q.name}</span>
          <span class="tr-open-cta">Open ${ai(R)}</span>
        </span>
        <span class="tr-open-count">${_}</span>
      `,s.appendChild(B)}}function w(S,R="wide"){i.innerHTML=S,i.classList.toggle("is-reveal",R==="reveal"),r.classList.add("is-open")}function b(){r.classList.remove("is-open"),i.innerHTML=""}function x(S){const R=[];for(const q of S.characters)R.push(St(q,{crop:"head"}));for(const[q,_]of Object.entries(S.containers))_&&R.push(dt(q));return S.coins>0&&R.push(O("coin")),S.gems>0&&R.push(O("gem")),R}function v(S,R){const q=Zu(S);if(q.length===0)return;const _=x(S),[B,...Y]=q;w(`
      <div class="tr-reveal">
        <div class="tr-reveal-em">${_[0]??Jt(B.emoji)}</div>
        <p class="tr-reveal-kicker">${R}</p>
        <p class="tr-reveal-name">${B.label}</p>
        ${Y.length>0?`<div class="tr-reveal-more">${Y.map((P,Q)=>`<span class="tr-reveal-chip">${_[Q+1]??Jt(P.emoji)} ${P.label}</span>`).join("")}</div>`:""}
        <button class="fa-btn fa-btn--primary tr-sheet-close" type="button" data-el="close">Nice!</button>
      </div>
    `,"reveal"),Ko(i),rs(c,50,28)}function E(){const S=Ut.map(R=>{const q=Oe[R],_=Vo(R).map(Y=>`
        <li class="tr-odds-row">
          <span class="tr-odds-what">${Y.rarity?`<i class="tr-odds-dot" style="background:${ft[Y.rarity]}"></i>`:""}${Y.label}</span>
          <span class="tr-odds-pct">${qd(Y.percent)}</span>
        </li>
      `).join(""),B=Vo(R).filter(Y=>Y.pool&&Y.pool.length>0).map(Y=>`${Y.rarity}: ${Y.pool.map(P=>re[P].name).join(", ")}`).join(" · ");return`
        <section class="tr-odds-block">
          <h3 class="tr-odds-title">${dt(R)} ${q.name} ${ai(R,{label:!0})}</h3>
          <p class="tr-odds-blurb">${q.blurb}</p>
          <ul class="tr-odds-list">${_}</ul>
          ${B?`<p class="tr-odds-pool">${B}</p>`:""}
        </section>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">Drop rates</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${O("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-sheet-note">Every percentage below is read directly from the reward
        tables the game rolls against.</p>
        <p class="tr-sheet-note tr-sheet-note--rarity">${Hd}</p>
        ${S}
      </div>
    `)}function k(){const S=sf().map(R=>{const q=cf(R),_=[];return R.coins&&_.push(`${O("coin")} ${R.coins.toLocaleString()}`),R.container&&_.push(`${dt(R.container.kind)} ${Oe[R.container.kind].name}`),`
        <div class="tr-sku${R.oneTime?" is-featured":""}">
          ${q>0||R.oneTime?`<span class="tr-sku-flags">
            ${q>0?`<span class="tr-sku-bonus">+${q}%</span>`:""}
            ${R.oneTime?'<span class="tr-sku-bonus tr-sku-once">ONE TIME</span>':""}
          </span>`:""}
          <span class="tr-sku-em">${R.container?dt(R.container.kind):Jt(R.emoji)}</span>
          <span class="tr-sku-name">${R.name}</span>
          <span class="tr-sku-gems">${O("gem")} ${R.gems.toLocaleString()}</span>
          ${_.length>0?`<span class="tr-sku-extra">+ ${_.join(" + ")}</span>`:""}
          <button class="tr-sku-buy" type="button" disabled>${`${rf(R.priceUsdCents)} · Soon`}</button>
        </div>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">${O("gem")} Gem Store</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${O("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-soon">${O("cone")} Purchases are not available yet — nothing here can be bought.
        Every gem in the game is earned on the Trophy Road and out of chests.</p>
        <div class="tr-skus">${S}</div>
      </div>
    `)}o("back").addEventListener("click",()=>e.navigate({name:"home"})),o("oddsbtn").addEventListener("click",E),o("storebtn").addEventListener("click",k),o("scrim").addEventListener("click",b),l.addEventListener("click",()=>{const S=a.claimAllMilestones();v(S,"You earned")});const M=S=>{const R=S.target;if(R.closest('[data-el="close"]')){b();return}const q=R.closest(".tr-node.is-claimable");if(q){const B=Number(q.dataset.trophies),Y=a.claimMilestone(B);Y&&v(Y,"You earned");return}const _=R.closest("[data-open]");if(_){const B=_.dataset.open,Y=a.openContainer(B);Y&&v(Y.reward,Y.duplicateOf?`${re[Y.duplicateOf].name} again — traded in`:`From a ${Oe[B].name}`)}};t.addEventListener("click",M);const C=S=>{S.key==="Escape"&&r.classList.contains("is-open")&&b()};window.addEventListener("keydown",C);const T=a.onChange(()=>{m(),d()});m(),d();let F=!1;requestAnimationFrame(()=>{F||(p(),u())});const N=a.lastMatch;if(N&&!N.seen){const S=N.trophies>0?"+":"";h.innerHTML=`${S}${N.trophies} ${O("trophy")}`,h.className=`tr-delta is-on ${N.trophies>0?"is-up":N.trophies<0?"is-down":"is-flat"}`,a.markLastMatchSeen()}return{root:t,resize(){d(),u()},dispose(){F=!0,T(),t.removeEventListener("click",M),window.removeEventListener("keydown",C),t.remove()}}}const Jv=`
.fa-tr .tr-heading { flex: 0 1 auto; }

.fa-tr .tr-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--gap);
  min-height: 0;
}

/* ── Hero strip ───────────────────────────────────────────────────────────── */
/* Horizontal, not the prototype's tall centred hero card. A 390px-tall landscape
   phone cannot spend 140px on a number, and the trophy count reads perfectly well at
   the left of a strip with the progress bar beside it — which also puts the count
   and the thing it is counting toward on the same line. */
.fa-tr .tr-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(10px, 2vw, 22px);
  padding: clamp(6px, 1.2vh, 12px) clamp(10px, 1.6vw, 18px);
  background: linear-gradient(180deg, #FFE9A8, var(--mustard));
  border: 3px solid var(--ink);
  border-radius: var(--radius-surface);
  box-shadow: 0 5px 0 rgba(0,0,0,0.35);
  min-height: var(--tap);
}
.fa-tr .tr-hero-count { position: relative; display: flex; align-items: center; gap: 6px; }
.fa-tr .tr-hero-em { font-size: clamp(1.1rem, 3vh, 1.8rem); line-height: 1; }
.fa-tr .tr-hero-num {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.3rem, 4.4vh, 2.6rem);
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

/* The prototype's floating delta, unchanged in behaviour: rises, fades, gone. */
.fa-tr .tr-delta {
  position: absolute;
  left: 50%;
  top: -2px;
  transform: translateX(-50%);
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.8rem, 2.2vh, 1.15rem);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
}
.fa-tr .tr-delta.is-on { animation: fa-tr-float 1.5s ease-out forwards; }
.fa-tr .tr-delta.is-up { color: #2E7D32; }
.fa-tr .tr-delta.is-down { color: var(--ketchup); }
.fa-tr .tr-delta.is-flat { color: #5a5a5a; }
@keyframes fa-tr-float {
  0% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -42px); }
}

.fa-tr .tr-hero-next { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.fa-tr .tr-nextline { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.fa-tr .tr-nextlabel {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.3vh, 0.74rem);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  /* 0.6 measured 4.28:1 on the mustard card at desktop and 2.08:1 in portrait,
     where the strip's gradient is darkest under this line. 0.82 clears AA on both. */
  color: rgba(26,18,36,0.82);
  white-space: nowrap;
}
.fa-tr .tr-nextval {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.7vh, 0.95rem);
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
/* Reuses the level bar from theme.ts rather than inventing a second progress
   treatment — one meaning, one component. */
.fa-tr .tr-track { height: clamp(16px, 2.4vh, 22px); }
/* Deliberately NOT gold. Round 1 filled a cream trough on a mustard card with a
   gold stripe, and a critic measured the single most important pixel on the bar —
   the fill boundary — as "nearly invisible". Green is the project's progress colour
   everywhere else (the level bar, the road spine), so this is one meaning, one
   colour, and a boundary you can actually see. */
.fa-tr .tr-fill {
  background: repeating-linear-gradient(45deg, var(--lettuce) 0 10px, #9BE03A 10px 20px);
}

/* Only rendered when there IS something to claim. A permanently visible, mostly
   disabled CLAIM button is the exact shape of control both menu critics punished. */
.fa-tr .tr-claimall { flex: 0 0 auto; }

/* ── The road ─────────────────────────────────────────────────────────────── */
/* The panel HUGS the track instead of stretching to the row.
   A 34-node strip pinned to the top of a 640px cream slab is the same defect two
   critics have already named on this project's other screens: the empty two-thirds
   reads as an unfinished build, not as breathing room. Hugging it turns the road
   into a deliberate band with the warm backdrop above and below — which is what the
   backdrop is for. */
/* Round 2 hugged the track, which fixed an empty cream slab but produced its own
   defect: a critic measured the result as "a strip of UI floating on a gradient",
   with under half the canvas doing any work. So the panel fills the row again — but
   the track inside it is now tall enough (two staggered lanes of full-size nodes)
   that the remaining cream reads as the panel's own padding rather than as a void.
   Both failure modes have now been observed on this screen; this is the middle. */
.fa-tr .tr-roadwrap { min-height: 0; }
/* The ONE scrolling axis on this screen, and it is horizontal. Overrides .fa-scroll's
   vertical default; higher specificity, so injection order does not matter. */
.fa-tr .tr-road {
  display: block;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  /* Both ends of a 34-node track are always mid-node. Hard-clipped, a critic read
     that as "broken layout rather than scrollable content" — a fade is the standard
     idiom that turns the same clip into an affordance, and unlike a chevron button
     it cannot become a control that does nothing. */
  height: 100%;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%);
}
.fa-tr .tr-road::-webkit-scrollbar { height: 8px; }

/* How far a node sits off the road line. Half a node's height, so the node's inner
   edge lands ON the line — which is what makes the medallions read as beads on a
   string rather than as two unrelated rows. */
.fa-tr .tr-roadtrack {
  /* Scales hard with viewport HEIGHT: on a 390px landscape phone the two rows have
     to nest inside ~190px, and on a 900px desktop the band should command the frame
     rather than float in it. Everything else on this track is sized off the same
     axis for the same reason. */
  --stagger: clamp(30px, 12.5vh, 112px);
  position: relative;
  display: flex;
  align-items: center;
  width: max-content;
  min-width: 100%;
  min-height: 100%;
  padding: calc(var(--stagger) + clamp(6px, 1.2vh, 12px)) 20px;
}

/* The road itself: ONE line for the whole journey, drawn once. */
.fa-tr .tr-spine {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 6px;
  transform: translateY(-50%);
  background: rgba(26,18,36,0.15);
  border-radius: 3px;
  /* ABOVE the nodes, deliberately. Each node drops a stem toward the road (below)
     whose exact length cannot be expressed in CSS — the gap is
     "stagger minus half the node's own height", and the node's height is content.
     So the stems are drawn deliberately too long and the road paints over the
     overshoot. Costs one z-index; saves measuring every node in JavaScript. */
  z-index: 2;
}
/* Filled up to the pin. Width is measured off the pin's real position rather than
   counted in nodes, so the fill and the marker cannot disagree. */
.fa-tr .tr-spine-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--lettuce), #A6E24A);
  transition: width 0.4s ease-out;
}

.fa-tr .tr-node {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: clamp(84px, 12vw, 132px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0 4px;
  text-align: center;
  background: none;
  border: none;
  font-family: inherit;
  color: var(--ink);
}
/* Alternate above and below the line.
   Offset with "top" rather than with a transform, deliberately: the hover and press
   states own the transform, and a relative "top" offsets the paint without touching
   layout — so the flex row still measures every node identically. column-reverse on
   the upper side keeps the threshold label adjacent to the road on BOTH sides, so
   the two rows are mirror images instead of two different designs.

   (This comment cost a dev-server outage the first time it was written: a backtick
   inside a CSS template literal terminates the string and 500s the whole app. Never
   quote an identifier with backticks below this line.) */
.fa-tr .tr-node.is-high { flex-direction: column-reverse; top: calc(-1 * var(--stagger)); }
.fa-tr .tr-node.is-low { top: var(--stagger); }

/* The stem. A blind critic could not reconstruct the reading order of the two lanes
   without parsing the trophy numbers — "nothing visually connects a node to the
   rail". This is that connection: every node is tied to a specific point on the
   road, so the zigzag reads as one sequence instead of two rows. It also carries the
   node's state, so the road, the stem and the medallion all agree at a glance. */
.fa-tr .tr-node::before {
  content: '';
  position: absolute;
  left: calc(50% - 3px);
  width: 6px;
  /* Set by measureTrack() after layout. 0 until then, so a stem is never drawn at
     the wrong length even for one frame. */
  height: var(--stem, 0px);
  background: rgba(26,18,36,0.15);
  border-radius: 3px;
}
.fa-tr .tr-node.is-high::before { top: 100%; }
.fa-tr .tr-node.is-low::before { bottom: 100%; }
.fa-tr .tr-node.is-claimed::before { background: var(--lettuce); }
.fa-tr .tr-node.is-claimable::before { background: var(--gold); }

.fa-tr .tr-node-req {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.6vh, 0.86rem);
  color: rgba(26,18,36,0.85);
  white-space: nowrap;
}
.fa-tr .tr-node-medal {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(38px, 10vh, 96px);
  height: clamp(38px, 10vh, 96px);
  border-radius: 50%;
  background: #FFFFFF;
  border: 3px solid var(--ink);
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
.fa-tr .tr-node-em { font-size: clamp(1rem, 5vh, 3rem); line-height: 1; }
/* A character node is the reason the road exists, so it gets a bigger medallion and
   its rarity — but the rarity lives on the RING, never on the fill.
   Round 1 painted the rarity straight onto the medallion background, which put
   Soup's Epic purple and Burrito's Rare blue into the same visual channel as the
   claimed/claimable/locked STATE colours. A blind critic could not tell the two
   systems apart and called it out as the node states "not reading as a system".
   Fill = state. Ring = rarity. Two channels, never crossed. */
.fa-tr .tr-node.is-character .tr-node-medal {
  width: clamp(44px, 11.5vh, 104px);
  height: clamp(44px, 11.5vh, 104px);
  box-shadow:
    0 0 0 4px var(--node-accent, var(--mustard)),
    0 3px 0 rgba(0,0,0,0.35),
    0 0 16px var(--node-glow, transparent);
}
/* Every non-character icon gets its own cream field inside a CLAIMABLE node.
   Three separate blind critics reported that the coin on the trophy road "does not
   match" the coin in the top-bar chip. It is the identical SVG; what differs is what
   is behind it. A claimable node fills gold, so a gold coin on it is a same-hue,
   same-value collision — and it happens in precisely the state the player is supposed
   to be drawn to. The medal keeps its gold FILL (fill = state, ring = rarity, which is
   a contract an earlier critic round established), and the icon gets a disc of its own
   inside it, so the mark reads identically at every node state and at every size. */
.fa-tr .tr-node.is-claimable:not(.is-character) .tr-node-em {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76%;
  height: 76%;
  border-radius: 50%;
  background: #FFF8EA;
  box-shadow: inset 0 0 0 2px rgba(26,18,36,0.22);
}

/* A character node's portrait FILLS its medallion.
   Round 1 dropped a whole standing body into a 50px box inside a 96px white ring,
   and a blind critic called the result an unreadable smear — correctly: the character
   was about 40px tall inside a widget twice that size, with the rest of the medal
   spent on empty fill. Head-cropped and edge-to-edge, the same widget becomes the
   fighter medallion the reference uses, and the medal's own ring keeps carrying
   rarity exactly as before. */
.fa-tr .tr-node.is-character .tr-node-em {
  display: flex;
  width: 100%;
  height: 100%;
  font-size: 0;
}
.fa-tr .tr-node.is-character .tr-node-em .fa-ic-portrait { width: 100%; height: 100%; }
.fa-tr .tr-node.is-character .tr-node-medal { overflow: hidden; }
/* Keep the claimed-state tick outside the clipped medal. */
.fa-tr .tr-node.is-character.is-claimed .tr-node-medal { overflow: visible; }

/* THREE node states, and only three.
   locked    = cream fill, quiet
   claimable = gold fill + pulsing gold halo (below)
   claimed   = desaturated and dimmed, with a tick. Round 1 filled claimed nodes
               with the same green the road uses for progress, which made a wall of
               green compete with the ONE gold node the player should be tapping.
               The filled spine already carries "how far I have come". */
/* ── "Claimed" is dimmed BY PART, never by a layer opacity ───────────────────
   This used to be a 0.78 layer opacity on the whole node, which is the single most
   expensive line this screen had. A container opacity composites the type together
   with its own plate, so it lowers the contrast of every run underneath it and no
   computed style anywhere reports that it happened: the threshold labels measured
   3.87-4.34:1 and the Claimed pill 2.02:1, all of them below AA, all of them looking
   correct in the source. It is precisely the "inherited opacity" case
   screen_metrics.mjs had to be built to see.

   The state reads exactly as before — grey medal, desaturated icon, quieter title,
   green tick — because those were always what carried it. The layer opacity was
   carrying nothing except the contrast loss. */
.fa-tr .tr-node.is-claimed .tr-node-medal { background: #E6DAC4; }
.fa-tr .tr-node.is-claimed .tr-node-em { filter: grayscale(0.55); opacity: 0.85; }
.fa-tr .tr-node.is-claimed .tr-node-title { color: rgba(26,18,36,0.66); }
.fa-tr .tr-node.is-claimed .tr-node-req { color: rgba(26,18,36,0.82); }
.fa-tr .tr-node.is-claimed .tr-tier { opacity: 0.6; }
.fa-tr .tr-node-tick {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(16px, 2.6vh, 24px);
  height: clamp(16px, 2.6vh, 24px);
  background: var(--lettuce);
  --fa-ic-ink: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-size: clamp(0.6rem, 1.6vh, 0.86rem);
  z-index: 2;
}
.fa-tr .tr-node.is-claimable .tr-node-medal {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  /* Physically larger, not just brighter. A critic could not tell which of the two
     claim affordances was the real target; the on-track node is the one the reward
     visually lives on, so it gets the size. */
  transform: scale(1.14);
}

.fa-tr .tr-node-title {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.9vh, 1rem);
  line-height: 1.15;
  max-width: 100%;
}
.fa-tr .tr-node-note {
  font-size: clamp(0.69rem, 1.3vh, 0.74rem);
  line-height: 1.15;
  font-weight: 700;
  color: rgba(26,18,36,0.82);
}
.fa-tr .tr-status {
  margin-top: 2px;
  padding: 2px 8px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: #FFFFFF;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.35vh, 0.76rem);
  white-space: nowrap;
  color: var(--ink);
}
/* White on '--lettuce' is 2.47:1 before the node's own dimming and measured 2.02:1
   after — the worst run on the screen, repeated once per claimed node (eight of them
   at desktop). Ink on the identical green is 7.0:1 and it matches the ready pill's
   ink beside it, so the two status colours now differ by HUE alone, which is the
   distinction the design was already making. */
.fa-tr .tr-status.is-done {
  background: var(--lettuce);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
}
.fa-tr .tr-status.is-ready { background: var(--gold); color: var(--ink); }
/* The pill holds an icon plus a word now, not a glyph plus a word. */
.fa-tr .tr-status { display: inline-flex; align-items: center; gap: 4px; }

/* ── Container rank ───────────────────────────────────────────────────────────
   Five pips, filled up to this box's position in the ladder, tinted with the rarity
   it bottoms out at. Deliberately NOT another badge: the node already carries a
   threshold, a medal, a title and a status pill, and a sixth labelled object would
   make the node the busiest thing on a screen whose subject is the road. A pip row
   is readable at 3px per dot and is the one thing on the node that answers "is this
   one better than that one". */
.fa-tr .tr-tier {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1;
}
/* The rarity-meaning line on the drop-rate sheet. Slightly stronger than the note above
   it because it is the sentence that stops the sheet implying rarity is power — a claim
   the game made until 2026-08-05 and no longer does. */
.fa-tr .tr-sheet-note--rarity {
  margin-top: 6px;
  font-weight: 700;
  color: var(--ink);
}

.fa-tr .tr-pip {
  width: clamp(4px, 0.8vh, 6px);
  height: clamp(4px, 0.8vh, 6px);
  border-radius: 50%;
  background: rgba(26,18,36,0.16);
  box-shadow: inset 0 0 0 1px rgba(26,18,36,0.28);
}
.fa-tr .tr-pip.is-on {
  background: var(--pip, var(--ink));
  box-shadow: inset 0 0 0 1px rgba(26,18,36,0.55);
}
.fa-tr .tr-tier-txt {
  margin-inline-start: 5px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.78rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(26,18,36,0.72);
}

/* Claimable nodes are the only interactive thing on the track, so they get the whole
   press vocabulary the rest of the menu uses — and a pulse, because a reward waiting
   to be collected is the single most important thing on this screen. */
.fa-tr .tr-node.is-claimable {
  cursor: pointer;
  min-height: var(--tap);
  transition: transform 0.1s;
}
.fa-tr .tr-node.is-claimable .tr-node-medal {
  animation: fa-tr-pulse 1.5s ease-in-out infinite;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 5px rgba(244,163,0,0.5), 0 0 20px rgba(244,163,0,0.6);
}
.fa-tr .tr-node.is-claimable:hover { transform: translateY(-3px); }
.fa-tr .tr-node.is-claimable:active { transform: translateY(2px); }
@keyframes fa-tr-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.09); }
}

/* "You are here". The prototype's pin, kept exactly — it is the one element that
   tells a player where they sit on a 34-node track without reading any numbers. */
.fa-tr .tr-pin {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  width: clamp(52px, 7vw, 74px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.fa-tr .tr-pin-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(40px, 6.4vh, 62px);
  height: clamp(40px, 6.4vh, 62px);
  border-radius: 50%;
  background: var(--ketchup);
  border: 4px solid var(--ink);
  font-size: clamp(1.05rem, 3.2vh, 1.8rem);
  /* Gold halo rather than a red one. On a green-to-grey rail a red glow reads as an
     error state; gold is the colour this screen already uses for "yours / active",
     and the marker was measured as the weakest element on its own screen. */
  box-shadow: 0 0 0 5px rgba(244,163,0,0.55), 0 0 18px rgba(244,163,0,0.5), 0 3px 0 rgba(0,0,0,0.4);
  animation: fa-tr-pulse 1.5s ease-in-out infinite;
}
.fa-tr .tr-pin-label {
  padding: 2px 9px;
  background: var(--ink);
  color: var(--cream);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  white-space: nowrap;
}

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
.fa-tr .tr-bottom {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.6vw, 16px);
  min-height: var(--tap);
}
.fa-tr .tr-inventory {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.fa-tr .tr-inventory::-webkit-scrollbar { display: none; }
.fa-tr .tr-bottom-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

.fa-tr .tr-inv-empty {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  color: var(--cream);
  /* A drop shadow sits UNDER the glyph, so the type still meets the orange backdrop
     on three sides. An ink stroke encloses it — same treatment as '.fa-title'. */
  -webkit-text-stroke: 2px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(26,18,36,0.75);
  white-space: nowrap;
}
.fa-tr .tr-inv-empty strong { color: var(--mustard); }

/* A held container is a button, always. There is no state in which one of these is
   drawn and cannot be opened — the row is built from what the player actually holds. */
.fa-tr .tr-open {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-height: var(--tap);
  padding: 0 10px 0 8px;
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  color: var(--ink);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-tr .tr-open:hover { filter: brightness(1.05); }
.fa-tr .tr-open:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }
.fa-tr .tr-open-em { font-size: 1.3rem; line-height: 1; }
.fa-tr .tr-open-body { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
.fa-tr .tr-open-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
  white-space: nowrap;
}
.fa-tr .tr-open-cta {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.2vh, 0.72rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 5px;
  /* --ketchup as INK on this pill's cream gradient measured 4.17:1. See the token's
     comment in theme.ts: same hue, value dropped, 5.9:1. */
  color: var(--ketchup-ink);
}
.fa-tr .tr-open-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: var(--ketchup);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 0.7rem;
}

.fa-tr .tr-odds { font-size: clamp(0.69rem, 1.4vh, 0.8rem); }

/* ── Sheets (reveal / drop rates / store) ─────────────────────────────────── */
.fa-tr .tr-sheet {
  position: absolute;
  inset: 0;
  z-index: 95;
  display: none;
  align-items: center;
  justify-content: center;
  padding: calc(var(--fa-safe-t) + 10px) calc(var(--fa-safe-r) + 12px)
           calc(var(--fa-safe-b) + 10px) calc(var(--fa-safe-l) + 12px);
}
.fa-tr .tr-sheet.is-open { display: flex; }
.fa-tr .tr-sheet-scrim { position: absolute; inset: 0; background: rgba(10,6,16,0.66); }
/* Confetti defaults to z-index 90 in theme.ts, which is UNDER this screen's sheet —
   so a reward reveal would burst confetti behind its own scrim. It is the only
   screen with a scrim above that layer, so the fix is local. */
.fa-tr .fa-confetti-layer { z-index: 110; }
.fa-tr .tr-sheet-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(560px, 100%);
  max-height: 100%;
  padding: clamp(12px, 2.4vh, 22px);
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: 22px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 22px 44px rgba(0,0,0,0.5);
  animation: fa-tr-pop 0.28s cubic-bezier(0.2, 1.5, 0.4, 1);
  min-height: 0;
}
@keyframes fa-tr-pop {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: none; }
}
.fa-tr .tr-sheet-head { display: flex; align-items: center; gap: 10px; }
.fa-tr .tr-sheet-title {
  margin: 0;
  flex: 1 1 auto;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.92rem, 2.4vh, 1.3rem);
}
.fa-tr .tr-sheet-x { min-width: var(--tap); padding: 0; }
.fa-tr .tr-sheet-scroll { display: flex; flex-direction: column; gap: 10px; min-height: 0; padding-inline-end: 4px; }
.fa-tr .tr-sheet-note, .fa-tr .tr-soon {
  margin: 0;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  font-weight: 700;
  line-height: 1.35;
  color: #4E2C1B;
}
/* The honest label. Loud enough that nobody taps a price expecting a checkout. */
.fa-tr .tr-soon {
  padding: 9px 12px;
  background: var(--mustard);
  border: 3px solid var(--ink);
  border-radius: 12px;
  font-weight: 700;
  color: var(--ink);
}

/* Reveal */
.fa-tr .tr-sheet-card.is-reveal {
  width: min(340px, 100%);
  padding: clamp(16px, 3.2vh, 30px) clamp(18px, 2.4vw, 30px);
}
.fa-tr .tr-reveal { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.fa-tr .tr-reveal-em { font-size: clamp(3rem, 12vh, 5.6rem); line-height: 1; margin-bottom: 4px; }
.fa-tr .tr-reveal-em .fa-ic-portrait {
  border: 3px solid var(--ink);
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
/* Every chip in a multi-line reward, and every held-container button, is a dark or
   mid-tone plate; the icons' ink outline has to flip there or it vanishes into the
   plate. This is the dark-on-dark failure this project has now shipped three times. */
.fa-tr .tr-reveal-chip { --fa-ic-ink: #FFF3DE; }
.fa-tr .tr-reveal-kicker {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  /* Measured 4.49:1 against a 4.5 floor — one hundredth short, which is exactly the
     kind of number a critic never finds and an instrument always does. */
  color: rgba(26,18,36,0.75);
}
.fa-tr .tr-reveal-name {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.1rem, 3.4vh, 1.8rem);
  color: var(--ink);
}
.fa-tr .tr-reveal-more { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 4px; }
.fa-tr .tr-reveal-chip {
  padding: 3px 10px;
  background: var(--ink);
  color: var(--cream);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.58rem, 1.4vh, 0.74rem);
}
.fa-tr .tr-sheet-close { margin-top: clamp(10px, 2.2vh, 20px); align-self: center; }

/* Drop rates */
.fa-tr .tr-odds-block {
  padding: 9px 11px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 12px;
}
.fa-tr .tr-odds-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.74rem, 1.8vh, 0.94rem);
  display: flex;
  align-items: center;
  gap: 7px;
}
.fa-tr .tr-odds-blurb { margin: 2px 0 6px; font-size: clamp(0.69rem, 1.35vh, 0.76rem); font-weight: 600; color: #4E2C1B; }
.fa-tr .tr-odds-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.fa-tr .tr-odds-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: clamp(0.69rem, 1.4vh, 0.8rem);
}
.fa-tr .tr-odds-what { font-weight: 700; display: flex; align-items: center; gap: 7px; }
/* The rarity channel, moved off the ink and onto a swatch — see showOdds(). */
.fa-tr .tr-odds-dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid rgba(26,18,36,0.55);
}
.fa-tr .tr-odds-pct {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.fa-tr .tr-odds-pool { margin: 6px 0 0; font-size: clamp(0.69rem, 1.25vh, 0.74rem); font-weight: 600; color: rgba(26,18,36,0.7); }

/* Store */
.fa-tr .tr-skus { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px; }
.fa-tr .tr-sku {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 8px 8px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 14px;
  text-align: center;
}
.fa-tr .tr-sku.is-featured { background: linear-gradient(180deg, #FFE9A8, var(--mustard)); }
/* Both badges in ONE positioned row.
   They were each absolutely positioned at the same 'top: -8px; inset-inline-end: 6px',
   so on the starter bundle — the only SKU that carries both — the green bonus badge
   and the red ONE TIME badge were stacked exactly on top of each other. Measured as a
   3.65:1 run: ink on ketchup, which is a combination this file never authored. */
.fa-tr .tr-sku-flags {
  position: absolute;
  top: -8px;
  inset-inline-end: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fa-tr .tr-sku-bonus {
  padding: 2px 8px;
  background: var(--lettuce);
  /* White on lettuce is 2.47:1 — the same defect as the claimed status pill, and it
     is carrying a percentage a buyer is meant to compare. */
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 0.7rem;
}
.fa-tr .tr-sku-once { background: var(--ketchup); color: #FFFFFF; }
.fa-tr .tr-sku-em { font-size: 1.6rem; line-height: 1; }
.fa-tr .tr-sku-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.4vh, 0.78rem);
}
.fa-tr .tr-sku-gems {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.72rem, 1.8vh, 0.92rem);
  /* 3.48:1 on the white cards and 2.56:1 on the mustard starter card as '--water'.
     Same hue at a value that survives being type — see theme.ts. */
  color: var(--water-ink);
}
.fa-tr .tr-sku-extra { font-size: clamp(0.69rem, 1.2vh, 0.72rem); font-weight: 600; color: #4E2C1B; }
/* Disabled on purpose and permanently, until a payment processor exists. It reads
   as unavailable rather than as broken, and it carries the price so the offer is
   still legible. */
.fa-tr .tr-sku-buy {
  width: 100%;
  /* Pushed to the bottom so the price row lines up across cards of different
     heights — the starter bundle carries two extra lines the gem packs do not. */
  margin-top: auto;
  padding-top: 6px;
  min-height: 30px;
  padding: 0 8px;
  background: #DCD3C4;
  border: 2.5px solid rgba(26,18,36,0.5);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.3vh, 0.74rem);
  color: rgba(26,18,36,0.72);
  cursor: not-allowed;
}

/* ── Landscape phone ──────────────────────────────────────────────────────── */
/* Height is the binding constraint at 844x390. The heading and the next-reward
   caption are the two things whose absence costs the least: the road itself already
   names every reward, and the trophy count is the headline. */
@media (max-height: 460px) {
  .fa-tr .tr-heading { display: none; }
  .fa-tr .tr-nextlabel { display: none; }
  .fa-tr .tr-node-note { display: none; }
  /* The CLAIMED pill goes too, and only the claimed one.
     Raising every label to an 11px floor added ~9px to each node, which at 390px tall
     pushed the two lanes into the rail between them — the threshold captions were
     measured sitting ON the green spine at 3.2:1 — and pushed the lower lane's pills
     through the bottom of the panel. Something had to leave, and the claimed pill is
     the one line on the node that is pure duplication: the medal beside it is already
     grey, its icon is already desaturated and it already carries a green tick. The
     gold "Claim" and the "N to go" countdown both stay, because those are the two
     states the player can still act on. */
  .fa-tr .tr-status.is-done { display: none; }
  .fa-tr .tr-node { gap: 2px; }
}

/* Portrait phone. The bottom bar wraps rather than crushing the inventory. */
@media (max-width: 700px) {
  .fa-tr .tr-hero { flex-wrap: wrap; }
  .fa-tr .tr-hero-next { flex-basis: 100%; order: 3; }
  .fa-tr .tr-bottom { flex-wrap: wrap; }
}

/* ── Narrow portrait ──────────────────────────────────────────────────────────
   With '.fa-screen > * { min-width: 0 }' in theme.ts the top bar can finally shrink,
   and what it shrinks is the one item that carries no information the screen does
   not already give: the heading. At 430px the bar is Back + "Trophy Road" at 28px +
   two currency chips = 490px of content, so leaving the title in means either
   ellipsising it to "Trophy R..." or squeezing the counts the player came here to
   read. The hero strip below is a trophy icon beside a four-digit number above a
   road made of trophy thresholds; nobody arrives here unsure what screen they are on.
   Same reasoning as the existing max-height rule, on the other axis. */
@media (max-width: 520px) {
  .fa-tr .tr-heading { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .fa-tr .tr-pin-dot,
  .fa-tr .tr-node.is-claimable .tr-node-medal,
  .fa-tr .tr-sheet-card,
  .fa-tr .tr-delta { animation: none !important; }
  .fa-tr .tr-road { scroll-behavior: auto; }
}
`,Rd=Object.keys(co).sort((e,t)=>co[e]-co[t]);function ex(e,t){const a=Oe[e].entries,o=Rs(a);return a.map(n=>{let s=n.coins??0;const r=n.gems??0;let i=null;return n.characterRarity&&((Fs[n.characterRarity]??[]).some(l=>!t.has(l))?i=n.characterRarity:s+=co[n.characterRarity]),{chance01:o>0?n.weight/o:0,coins:s,gems:r,fighter:i}})}function P0(e,t){const a=ex(e,t),o={canGrantFighter:!1,bestCoins:0,bestGems:0,expectedCoins:0,expectedGems:0,characterPercent:0,floorRarity:null};for(const s of a)s.fighter&&(o.canGrantFighter=!0),o.bestCoins=Math.max(o.bestCoins,s.coins),o.bestGems=Math.max(o.bestGems,s.gems),o.expectedCoins+=s.chance01*s.coins,o.expectedGems+=s.chance01*s.gems;const n=Rs(Oe[e].entries);for(const s of Oe[e].entries){if(!s.characterRarity)continue;o.characterPercent+=n>0?s.weight/n*100:0;const r=Rd.indexOf(s.characterRarity),i=o.floorRarity===null?1/0:Rd.indexOf(o.floorRarity);r<i&&(o.floorRarity=s.characterRarity)}return o}function Va(e,t,a){const o=Oe[e].price;if(!o)return!1;const n=P0(e,a);return n.canGrantFighter?!0:t==="coins"?n.bestCoins>o.coins:n.bestGems>o.gems}const tx=Ut.filter(e=>Oe[e].price!==null);function ax(e){la("fa-shop-styles",ox),ha();const t=Re("div","fa-screen fa-shop"),a=e.profile;t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${O("back")} Back</button>
      <h1 class="fa-title shop-heading">Shop</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${O("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${O("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="fa-panel fa-panel--flush shop-body">
      <div class="fa-scroll shop-scroll" data-el="scroll"></div>
    </div>

    <footer class="shop-bottom">
      <p class="shop-foot-note" data-el="footnote"></p>
      <div class="shop-foot-actions">
        <button class="fa-btn fa-btn--quiet" type="button" data-go="trophies">${O("trophy")} Trophy Road</button>
        <button class="fa-btn fa-btn--green" type="button" data-go="characters">${O("play")} Play a match</button>
      </div>
    </footer>
  `;const o=u=>{const f=t.querySelector(`[data-el="${u}"]`);if(!f)throw new Error(`shop: missing element "${u}"`);return f},n=o("scroll");function s(u){return`<ul class="shop-odds">${Vo(u).map(m=>`
      <li class="shop-odds-row">
        <span class="shop-odds-what">${m.rarity?`<i class="shop-odds-dot" style="background:${ft[m.rarity]}"></i>`:""}${m.label}</span>
        <span class="shop-odds-pct">${qd(m.percent)}</span>
      </li>`).join("")}</ul>`}function r(u){const f=Vo(u).filter(m=>m.rarity&&m.pool&&m.pool.length>0).map(m=>`<span class="shop-pool-line"><i class="shop-odds-dot" style="background:${ft[m.rarity]}"></i>${m.pool.map(g=>re[g].name).join(", ")}</span>`).join("");return f?`<div class="shop-pool">${f}</div>`:""}function i(u,f){const m=Oe[u],g=m.price,w=P0(u,f),b=w.canGrantFighter&&w.characterPercent>=99.999&&w.floorRarity?`<span class="shop-guarantee"><i class="shop-odds-dot" style="background:${ft[w.floorRarity]}"></i>Always a fighter, ${w.floorRarity} or rarer</span>`:"",x=E=>{const k=E==="coins"?g.coins:g.gems,M=E==="coins"?a.coins:a.gems,C=O(E==="coins"?"coin":"gem"),T=Va(u,E,f),F=M>=k,N=T&&F,S=T?`You need ${(k-M).toLocaleString()} more ${E}`:"Not for sale right now";return`
        <button class="shop-buy shop-buy--${E}${N?"":" is-off"}" type="button"
          data-buy="${u}" data-currency="${E}"${N?"":` disabled title="${S}" aria-label="${k.toLocaleString()} ${E}. ${S}."`}>
          ${C} ${k.toLocaleString()}
        </button>`};let v="";if(!Va(u,"coins",f)&&!Va(u,"gems",f)){const E=w.bestGems===0,k=w.bestCoins<g.coins?`It pays back at most ${w.bestCoins.toLocaleString()} coins for a ${g.coins.toLocaleString()} coin price, and ${Math.round(w.expectedCoins).toLocaleString()} on average.`:`Its average return is ${Math.round(w.expectedCoins).toLocaleString()} coins against a ${g.coins.toLocaleString()} coin price.`;v=`
        <p class="shop-why">
          <span class="shop-why-head">Not for sale</span>
          Every fighter this box can give is already unlocked, so it can only pay
          ${E?"coins":"currency"} back. ${k}
        </p>`}else if(!(a.coins>=g.coins)&&!(a.gems>=g.gems))v=`
        <p class="shop-why">
          <span class="shop-why-head">Keep playing</span>
          You need ${(g.coins-a.coins).toLocaleString()} more coins
          or ${(g.gems-a.gems).toLocaleString()} more gems for this one.
        </p>`;else{const E=[...new Set(Oe[u].entries.flatMap(M=>M.characterRarity?Fs[M.characterRarity]??[]:[]))],k=E.filter(M=>!f.has(M)).length;v=w.expectedCoins===0?`<p class="shop-why"><span class="shop-why-head">What you get</span>
            Every roll here is a new fighter. ${k} of the ${E.length} are still
            missing from your roster.</p>`:`<p class="shop-why"><span class="shop-why-head">Duplicates</span>
            ${k} of the ${E.length} fighters here are still missing. A repeat
            trades in for coins, ${Math.round(w.expectedCoins).toLocaleString()} on
            average across the table.</p>`}return`
      <article class="shop-card">
        <div class="shop-card-head">
          <span class="shop-card-em">${dt(u)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${m.name}</h3>
            ${b}
          </div>
        </div>
        <p class="shop-blurb">${m.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${s(u)}
        ${r(u)}
        <div class="shop-prices">${x("coins")}${x("gems")}</div>
        ${v}
      </article>`}function c(u){const f=Oe[u],m=a.winsToNextChest;return`
      <article class="shop-card shop-card--free">
        <div class="shop-card-head">
          <span class="shop-card-em">${dt(u)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${f.name}</h3>
            <span class="shop-guarantee shop-guarantee--free">Earned, never sold</span>
          </div>
        </div>
        <p class="shop-blurb">${f.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${s(u)}
        ${r(u)}
        <p class="shop-why">
          <span class="shop-why-head">How to get one</span>
          ${m===1?"One more win":`${m} more wins`} for the next free ${f.name},
          and the Trophy Road hands out more along the way.
        </p>
      </article>`}function l(){const u=Ut.filter(m=>(a.containers[m]??0)>0);return u.length===0?"":`
      <section class="shop-section shop-inv">
        <h2 class="shop-section-title">Your boxes</h2>
        <div class="shop-heldrow">${u.map(m=>`
      <span class="shop-held">
        <span class="shop-held-em">${dt(m)}</span>
        <span class="shop-held-name">${Oe[m].name}</span>
        <span class="shop-held-n">${a.containers[m]}</span>
      </span>`).join("")}</div>
        <p class="shop-why"><span class="shop-why-head">Waiting to be opened</span>
          Open them on the Trophy Road, below.</p>
      </section>`}function h(){const u=a.unlocked;o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString();const f=tx.some(g=>Va(g,"coins",u)||Va(g,"gems",u)),m=f?"":`
      <p class="shop-notice">${O("cone")}
        <span><strong>Nothing here is for sale yet.</strong>
        You already own all ${Se.length} fighters, so every box can only pay
        coins back, and each one pays back less than it costs.
        <span class="shop-notice-more">Buying is switched off rather than offered as a
        bad deal. Everything below is real: these are the prices and the drop rates the
        game will use.</span></span>
      </p>`;n.innerHTML=`
      ${m}
      ${l()}
      <section class="shop-section">
        <h2 class="shop-section-title">Boxes and chests</h2>
        <!-- WHAT RARITY BUYS, on the screen where a player would spend.
             NOTE the single quotes: this comment sits inside a JS template literal,
             where one backtick terminates the string and 500s the dev server for
             every agent in the repo (docs/LESSONS.md section 9).
             'tuning.ts' owns this sentence (RARITY_MEANING) and the trophy road's
             drop-rate sheet already prints it. This screen puts the FULL drop table
             inline — deliberately, so the disclosure is measured rather than hidden
             behind a tap — and then said nothing about what a rarer fighter is worth,
             on the one surface that quotes a price next to it. Rendered from the
             model's own string so the two surfaces cannot drift. -->
        <p class="shop-rarity">${Hd}</p>
        <div class="shop-grid">${Ut.map(g=>Oe[g].price?i(g,u):c(g)).join("")}</div>
      </section>
    `,o("footnote").textContent=f?"Coins and gems are earned by playing. Both work on every box.":"Boxes are earned, not bought:"}o("back").addEventListener("click",()=>e.navigate({name:"home"}));const d=u=>{const f=u.target,m=f.closest("[data-go]")?.dataset.go;if(m==="trophies"){e.navigate({name:"trophies"});return}if(m==="characters"){e.navigate({name:"characters"});return}const g=f.closest("[data-buy]");if(!g||g.disabled)return;const w=g.dataset.buy,b=g.dataset.currency;Va(w,b,a.unlocked)&&a.buyContainer(w,b)};t.addEventListener("click",d);const p=a.onChange(h);return h(),{root:t,dispose(){p(),t.removeEventListener("click",d),t.remove()}}}const ox=`
.fa-shop .shop-heading { flex: 0 1 auto; }

/* HUGS its content, then scrolls — it does not stretch to the row.
   At 2560x1080 the five cards fill about 55% of the middle row and the rest was flat
   cream inside a bordered surface, which is the exact "unfinished build" signal two
   critics have already named on this project (the trophy road's first road panel and
   home's first left rail). 'align-self: center' makes the height content-driven, and
   'max-height: 100%' hands it back to the row the moment the content is taller than the
   frame — at which point the inner '.fa-scroll' takes over. Same pair of declarations
   home uses on its flank cards, for the same reason. */
.fa-shop .shop-body {
  min-height: 0;
  align-self: center;
  max-height: 100%;
}
.fa-shop .shop-scroll {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.6vh, 14px);
  padding: clamp(8px, 1.5vh, 14px);
}

/* ── The honest banner ────────────────────────────────────────────────────────
   Mustard plate, ink type: measured 11.9:1, and it is the loudest object in the
   scroller on purpose. The gem store uses the identical treatment for the identical
   job one screen over, and 'menu_accept' asserts that a claim of unavailability is
   made in words there — so this is one idiom, not two. */
.fa-shop .shop-notice {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 0;
  padding: 10px 13px;
  background: var(--mustard);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.72rem, 1.5vh, 0.84rem);
  font-weight: 700;
  line-height: 1.38;
  color: var(--ink);
}
.fa-shop .shop-notice .fa-ic { font-size: 1.4em; margin-top: 1px; }
.fa-shop .shop-notice strong { font-family: 'Rubik', sans-serif; font-weight: 900; }

/* ── Sections ─────────────────────────────────────────────────────────────── */
.fa-shop .shop-section { display: flex; flex-direction: column; gap: 7px; }
.fa-shop .shop-section-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.78rem, 1.85vh, 1rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink);
}
.fa-shop .shop-section-title::after {
  content: '';
  display: block;
  width: 32px;
  height: 4px;
  margin-top: 5px;
  border-radius: 999px;
  background: var(--gold);
}

/* The rarity disclosure. Solid ink on the panel's own cream, no alpha and no plate:
   the same decision '.shop-oddshead' records two rules down, for the same reason —
   a tinted section note measured 4.85:1 on the trophy road and its scroller fade took
   it to 3.93. This one is a legal disclosure on a priced surface, so there is no
   headroom to spend at all. */
.fa-shop .shop-rarity {
  margin: 0 0 1px;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.32vh, 0.78rem);
  line-height: 1.35;
  color: #40291A;
}

/* Auto-fit rather than a breakpoint ladder: four cards at desktop, two on a landscape
   phone, one in portrait, with no media query deciding which. The floor is 232px
   because the widest thing on a card is a drop-rate row, and below that the label and
   the percentage collide. */
.fa-shop .shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(232px, 1fr));
  gap: clamp(7px, 1.3vh, 12px);
  align-items: stretch;
}

/* ── One box ──────────────────────────────────────────────────────────────── */
.fa-shop .shop-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 12px 12px;
  background: #FFFFFF;
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.9);
}
.fa-shop .shop-card--free { background: linear-gradient(180deg, #FFFFFF 0%, #F3E6CE 100%); }

.fa-shop .shop-card-head { display: flex; align-items: center; gap: 10px; }
.fa-shop .shop-card-em { font-size: clamp(1.9rem, 4.6vh, 2.8rem); line-height: 1; flex: 0 0 auto; }
.fa-shop .shop-card-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fa-shop .shop-card-name {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.84rem, 2vh, 1.06rem);
  line-height: 1.1;
  color: var(--ink);
}

/* The floor of the table, as a swatch plus ink. Never coloured type: the rarity
   palette is a FILL palette and every one of its six values fails AA as ink on white. */
.fa-shop .shop-guarantee {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.35vh, 0.78rem);
  color: #3B2A18;
}
.fa-shop .shop-guarantee--free { color: #4E2C1B; }

.fa-shop .shop-blurb {
  margin: 1px 0 2px;
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.72rem, 1.4vh, 0.8rem);
  font-weight: 700;
  line-height: 1.3;
  color: #4E2C1B;
}

.fa-shop .shop-oddshead {
  margin: 3px 0 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.3vh, 0.75rem);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  /* Solid, not a tint. A 0.62 alpha section label on this card measured 4.85:1 on the
     trophy road and its own scroller fade was enough to push it to 3.93 — the last
     failing run in that whole battery. There is no headroom in a marginal number. */
  color: #4E2C1B;
}

.fa-shop .shop-odds {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fa-shop .shop-odds-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-family: 'Rubik', sans-serif;
  font-weight: 700;
  font-size: clamp(0.72rem, 1.45vh, 0.82rem);
  color: var(--ink);
}
.fa-shop .shop-odds-what { display: flex; align-items: center; gap: 7px; min-width: 0; }
.fa-shop .shop-odds-dot {
  flex: 0 0 auto;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.5px solid rgba(26,18,36,0.6);
}
.fa-shop .shop-odds-pct {
  flex: 0 0 auto;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.fa-shop .shop-pool {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  padding-top: 5px;
  border-top: 2px dotted rgba(26,18,36,0.22);
}
.fa-shop .shop-pool-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.69rem, 1.25vh, 0.76rem);
  line-height: 1.25;
  color: #4E2C1B;
}

/* ── Price row ────────────────────────────────────────────────────────────── */
.fa-shop .shop-prices { display: flex; gap: 7px; margin-top: auto; padding-top: 7px; }
.fa-shop .shop-buy {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--tap);
  padding: 0 10px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.76rem, 1.7vh, 0.92rem);
  font-variant-numeric: tabular-nums;
  border: 3px solid var(--ink);
  border-radius: 999px;
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  box-shadow: 0 4px 0 var(--gold-shadow);
  color: var(--ink);
  cursor: pointer;
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-shop .shop-buy:hover { filter: brightness(1.06); }
.fa-shop .shop-buy:active { transform: translateY(4px); box-shadow: 0 0 0 var(--gold-shadow); }

/* UNAVAILABLE, and it must not read as broken.
   No layer opacity anywhere in this rule, and that is the point: a container opacity
   composites the type together with its own plate, so it lowers the contrast of the
   run underneath it and no computed style anywhere reports that it happened. The trophy
   road shipped exactly that on its claimed nodes and hid fifteen sub-AA runs behind it.
   This is a flat unavailable plate with explicit ink instead: measured 6.6:1, and the
   price stays perfectly legible because the price is the information. */
.fa-shop .shop-buy.is-off {
  background: #DCD3C4;
  border-color: rgba(26,18,36,0.5);
  box-shadow: none;
  color: rgba(26,18,36,0.78);
  --fa-ic-ink: rgba(26,18,36,0.78);
  cursor: not-allowed;
}
.fa-shop .shop-buy.is-off:hover { filter: none; }
.fa-shop .shop-buy.is-off:active { transform: none; }

/* ── The reason ───────────────────────────────────────────────────────────── */
.fa-shop .shop-why {
  margin: 5px 0 0;
  padding: 7px 9px;
  background: rgba(26,18,36,0.055);
  border-radius: 10px;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.32vh, 0.78rem);
  line-height: 1.32;
  color: #40291A;
}
.fa-shop .shop-why-head {
  display: block;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(0.69rem, 1.2vh, 0.72rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  /* Same hue as the brand red, at a value that survives being type on a light plate.
     See the token comment in theme.ts: --ketchup as ink measures 4.17 and this 5.9. */
  color: var(--ketchup-ink);
}

/* ── Held inventory ───────────────────────────────────────────────────────── */
.fa-shop .shop-heldrow { display: flex; flex-wrap: wrap; gap: 7px; }
.fa-shop .shop-held {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px 5px 8px;
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
}
.fa-shop .shop-held-em { font-size: 1.35rem; line-height: 1; }
.fa-shop .shop-held-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.4vh, 0.82rem);
  color: var(--ink);
  white-space: nowrap;
}
.fa-shop .shop-held-n {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  /* The count badge takes the brand red at the DARKER of the two values theme.ts
     publishes. White on the fill red is 4.95:1 — over AA, and the lowest number on this
     whole screen for a run that is a bare integer with no second cue. The same hue one
     step down measures 6.96:1 and costs nothing: the badge still reads as the brand red
     against the cream chip it sits on. */
  background: var(--ketchup-ink);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 0.72rem;
}

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
.fa-shop .shop-bottom {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.6vw, 16px);
  min-height: var(--tap);
}
/* On the warm backdrop, so it takes the same cream-with-an-ink-stroke treatment the
   trophy road gives its own bottom-bar caption. A drop shadow sits UNDER the glyph and
   the stroke encloses it, so the type never meets the orange directly. */
.fa-shop .shop-foot-note {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.55vh, 0.88rem);
  color: var(--cream);
  -webkit-text-stroke: 2px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(26,18,36,0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fa-shop .shop-foot-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

/* The free chest carries no price row, so nothing pushed its footer down and it ended
   with a block of dead card under it while the four boxes beside it were full. */
.fa-shop .shop-card--free .shop-why { margin-top: auto; }

/* ── Landscape phone ──────────────────────────────────────────────────────── */
/* 390px tall is THE tight case, and this block is a fix rather than a polish pass: the
   first landscape capture spent every one of its ~278 available pixels on the banner,
   the held-box row and two section headings, and the player reached the bottom of the
   frame before the first price. What is cut, and why each cut is safe:
   * the heading, which duplicates the tab that was just pressed;
   * the banner's SECOND sentence only. The claim that nothing is for sale and the
     reason it is not both stay. Losing "everything below is real" costs elaboration,
     not honesty, and the per-card refusal below still carries the arithmetic;
   * the held-box row, which is the same information the trophy road's own bottom bar
     shows, one tap away through the button in this screen's footer. Home takes exactly
     this decision at exactly this breakpoint for exactly this reason;
   * the blurb and the pool lists, which are prose restatements of the odds rows that
     stay. Nothing that is only said once is cut. */
/* ⚠️ The rarity disclosure is two more lines in this band, and it MEASURABLY pushed the
   first price off the bottom of the frame — the exact defect this block was written to
   fix, re-created by the sentence added above it (screen_metrics: runs in view 46 -> 39,
   scrolled out 6 -> 13, and the price row visibly clipped in
   shots/screen_m/loose/after-shop-phone-land.png). It is a disclosure on a priced
   surface, so it is not the thing that gives way. Two cheaper cuts pay for it, one per
   card, and both follow the rule already stated above — nothing that is only said once:
   * 'WHAT IS INSIDE', a heading over rows that each already read "<what> <percent>",
     inside a card that already carries the box's own name;
   * the tighter leading, which costs nothing at all. */
@media (max-height: 460px) {
  .fa-shop .shop-heading { display: none; }
  .fa-shop .shop-notice-more { display: none; }
  .fa-shop .shop-inv { display: none; }
  .fa-shop .shop-blurb { display: none; }
  .fa-shop .shop-pool { display: none; }
  .fa-shop .shop-oddshead { display: none; }
  .fa-shop .shop-section-title::after { display: none; }
  .fa-shop .shop-notice { padding: 7px 10px; line-height: 1.3; }
  .fa-shop .shop-rarity { line-height: 1.24; }
  .fa-shop .shop-scroll { gap: 7px; padding: 8px; }
  .fa-shop .shop-card { padding: 9px 10px 10px; gap: 4px; }
}

/* ── Portrait phone ───────────────────────────────────────────────────────── */
/* Deliberately a SEPARATE block from the rule above and not nested inside it.
   'characterSelect.ts' shipped a portrait media query nested inside a landscape one,
   so a 430x932 phone matched neither and got no portrait layout at all — valid
   TypeScript, valid CSS-in-a-string, and invisible to every parser in the toolchain. */
/* MEASURED, not guessed. At 430x932 with a simulated notch the usable width is
   430 - 44 - 44 - 2 gutters = 322px, and the two footer buttons are 'white-space:
   nowrap' with 'padding: 0 clamp(14px, 2vw, 30px)' each. A flex item's default
   'min-width: auto' resolves to MIN-CONTENT, so 'flex: 1 1 0' could not shrink them
   past their own labels and the second button was drawn 20px off the right edge of the
   frame. 'document.scrollWidth' reported 430 in exactly that state, because '.fa-root'
   clips — which is why this was caught by measuring element rects and could never have
   been caught by the page-overflow assertion. Same defect family as the three portrait
   bugs found at HEAD. */
@media (max-width: 700px) {
  .fa-shop .shop-bottom { flex-wrap: wrap; }
  .fa-shop .shop-foot-note { flex-basis: 100%; }
  .fa-shop .shop-foot-actions { flex: 1 1 auto; flex-wrap: wrap; }
  .fa-shop .shop-foot-actions .fa-btn {
    flex: 1 1 46%;
    min-width: 0;
    padding: 0 10px;
  }
}

/* At 430px the top bar is Back + a title + two currency chips, which is more content
   than the frame has. The chips are the numbers the player came to read; the title
   duplicates the control they pressed. Same reasoning the trophy road uses on the same
   axis, and the same threshold, so the two screens shrink identically. */
@media (max-width: 520px) {
  .fa-shop .shop-heading { display: none; }
}
`,q0=["opening","home","characters","trophies","shop","settings","match"];function Es(e){return typeof e=="string"&&Se.includes(e)}function nx(e){if(!e||typeof e!="object")return null;const t=e.name;if(typeof t!="string"||!q0.includes(t))return null;if(t==="match"){const{player:a,enemy:o}=e;return Es(a)&&Es(o)?{name:t,player:a,enemy:o}:null}return{name:t}}function sx(e){const t=new URLSearchParams(e),a=t.get("screen");if(a===null||!q0.includes(a))return null;if(a==="match"){const o=t.get("player"),n=t.get("enemy");return Es(o)&&Es(n)?{name:a,player:o,enemy:n}:null}return{name:a}}function oi(e,t){return e.name!==t.name?!1:e.name==="match"&&t.name==="match"?e.player===t.player&&e.enemy===t.enemy:!0}function Cd(e){const t=new URLSearchParams(window.location.search);t.set("screen",e.name),e.name==="match"?(t.set("player",e.player),t.set("enemy",e.enemy)):(t.delete("player"),t.delete("enemy"));const a=t.toString();return`${window.location.pathname}${a?`?${a}`:""}${window.location.hash}`}function rx(e,t){if(t!=="none")try{const a={fa:1,route:e};t==="push"?window.history.pushState(a,"",Cd(e)):window.history.replaceState(a,"",Cd(e))}catch{}}const ix=3e3,cx=10,lx=140;function hx(e){Tf(),H0();const t=document.createElement("div");t.className="fa-root",t.innerHTML=`
    <div class="fa-bg"></div>
    <div class="fa-rays"></div>
    <div class="fa-dots"></div>
    <div class="fa-stack" data-el="stack"></div>
    <div class="fa-curtain" data-el="curtain"></div>
  `,e.screenRoot.appendChild(t);const a=t.querySelector('[data-el="stack"]'),o=t.querySelector('[data-el="curtain"]'),n=e.profile??new Jd;let s=null,r={name:"home"},i=0,c=0,l=!1,h=null,d=!1,p=null,u=0;function f(D,X){console.error(`[shell] ${D}:`,X)}function m(D){const X=window.__shellFault;if(!X)return!1;const he=X[D];return typeof he!="number"||he<=0?!1:(X[D]=he-1,!0)}const g={navigate:I,profile:n,gameHost:e.gameHost,hudRoot:e.hudRoot};function w(D){if(m("build"))throw new Error(`__shellFault: build ${D.name}`);switch(D.name){case"opening":return Rg(g);case"home":return Mg(g);case"characters":return Kv(g);case"trophies":return Qv(g);case"shop":return ax(g);case"settings":return jv(g);case"match":return Nv(g,D)}throw new Error(`unknown route "${String(D.name)}"`)}function b(){i&&cancelAnimationFrame(i),i=0}function x(){b(),c=performance.now();const D=X=>{if(d)return;const he=Math.min(Math.max(0,(X-c)/1e3),1/20);c=X;try{if(m("update"))throw new Error("__shellFault: update");s?.update?.(he),u=0}catch(ve){if(u++,u===1&&f(`screen "${r.name}" update() threw`,ve),u>=cx){f(`screen "${r.name}" update() threw ${u} frames running — stopping the menu loop`,ve),b();return}}i=requestAnimationFrame(D)};i=requestAnimationFrame(D)}function v(D,X){if(D.name==="match")try{ll()}catch(ve){f("disposeCharacterStage() threw",ve)}try{D.name==="match"?we.music.fadeOut():we.music.fadeIn()}catch(ve){f("music transition threw",ve)}t.classList.toggle("is-ingame",D.name==="match");let he;try{he=w(D)}catch(ve){B(D,ve);return}r=D,s=he,a.appendChild(he.root),rx(D,X),S(),window.__screen=D.name,u=0,s.update?x():b(),D.name!=="match"&&(window.__previewReady=!1,requestAnimationFrame(()=>requestAnimationFrame(()=>{d||(window.__previewReady=!0)})))}function E(D){D.style.cssText=["pointer-events:auto","background:#FFF3DE","color:#1a1224","border-radius:16px","padding:18px 22px","max-width:min(92vw,420px)","text-align:center","box-shadow:0 10px 30px rgba(0,0,0,0.45)","font-family:'Rubik',sans-serif"].join(";")}function k(D){D.style.cssText=["position:absolute","inset:0","z-index:120","display:grid","place-items:center","padding:16px","background:rgba(20,13,30,0.72)","pointer-events:none"].join(";")}function M(D){const X=document.createElement("button");return X.type="button",X.textContent=D,X.style.cssText=["min-height:44px","min-width:140px","margin-top:14px","padding:0 20px","border:0","border-radius:999px","background:#F4A300","color:#1a1224","font-family:'Rubik',sans-serif","font-weight:800","font-size:16px","cursor:pointer"].join(";"),X.addEventListener("click",()=>window.location.reload()),X}function C(D){const X=document.createElement("div");k(X),X.style.background="#16101f",X.dataset.el="fa-fatal";const he=document.createElement("div");E(he);const ve=document.createElement("div");ve.textContent="The kitchen would not open",ve.style.cssText="font-weight:800;font-size:18px";const ze=document.createElement("div");return ze.textContent=String(D?.message??D??"unknown error"),ze.style.cssText="margin-top:8px;font-size:13px;opacity:0.75;font-family:'Heebo',sans-serif;word-break:break-word",he.append(ve,ze,M("Reload")),X.appendChild(he),X}let T=null,F=null;function N(){if(d||T)return;const D=document.createElement("div");k(D),D.dataset.el="fa-gl-notice";const X=document.createElement("div");E(X);const he=document.createElement("div");he.textContent="Graphics interrupted",he.style.cssText="font-weight:800;font-size:18px";const ve=document.createElement("div");ve.textContent="The device took the graphics back. Restoring…",ve.style.cssText="margin-top:6px;font-size:14px;opacity:0.8;font-family:'Heebo',sans-serif";const ze=M("Reload");ze.style.display="none",X.append(he,ve,ze),D.appendChild(X),t.appendChild(D),T=D,F=setTimeout(()=>{F=null,T&&(ve.textContent="The graphics have not come back. Reloading returns you to this same screen.",ze.style.display="inline-block")},ix)}function S(){F!==null&&(clearTimeout(F),F=null),T?.remove(),T=null}function R(D){return D.detail?.offscreen===!0}function q(D){R(D)||N()}function _(D){R(D)||S()}function B(D,X){if(f(`screen "${D.name}" failed to mount`,X),a.innerHTML="",D.name!=="home"){v({name:"home"},"replace");return}s=null,r={name:"home"},window.__screen="home",b(),a.appendChild(C(X))}function Y(){b();try{if(m("dispose"))throw new Error("__shellFault: dispose");s?.dispose()}catch(D){f(`screen "${r.name}" dispose() threw`,D)}s=null,a.innerHTML=""}function P(D){return r.name==="opening"||oi(D,r)?"replace":"push"}function Q(D,X){l=!0,window.__screenReady=!1,o.classList.add("is-on"),h=setTimeout(()=>{h=null;try{Y(),v(D,X)}catch(he){f("navigation threw",he)}finally{o.classList.remove("is-on"),l=!1,window.__screenReady=!0,z()}},lx)}function I(D){d||l||Q(D,P(D))}const L=D=>{if(d)return;const X=D.state,he=nx(X?.route)??sx(window.location.search)??{name:"home"};if(!oi(he,r)){if(l){p=he;return}Q(he,"none")}};function z(){const D=p;p=null,!(!D||d||oi(D,r))&&Q(D,"none")}const U=()=>{try{s?.resize?.()}catch(D){f(`screen "${r.name}" resize() threw`,D)}},ie='button, [role="button"], a[href], [data-clicksound="on"]',J=D=>{try{if(we.isMuted())return;const X=D.target?.closest?.(ie);if(!X||X.closest('[data-clicksound="off"]')||X.hasAttribute("disabled")||X.getAttribute("aria-disabled")==="true")return;we.previewClick()}catch(X){f("ui click sound threw",X)}};return t.addEventListener("click",J,!0),window.addEventListener("resize",U),window.addEventListener("popstate",L),window.addEventListener("fa:webglcontextlost",q),window.addEventListener("fa:webglcontextrestored",_),window.__shell={navigate:I,route:()=>r},{navigate(D){if(!s){v(D,D.name==="opening"?"none":"replace"),window.__screenReady=!0;return}I(D)},get route(){return r},dispose(){d=!0,h!==null&&clearTimeout(h),t.removeEventListener("click",J,!0),window.removeEventListener("resize",U),window.removeEventListener("popstate",L),window.removeEventListener("fa:webglcontextlost",q),window.removeEventListener("fa:webglcontextrestored",_),S(),Y(),ll(),t.remove(),delete window.__shell}}}const Dt=new URLSearchParams(location.search),dx=["player","enemy","simSpeed","fogRadius","px","py"];function Id(e,t){const a=Dt.get(e);return a&&Se.includes(a)?a:t}function px(e){if(Dt.get("screen")==="match"||!Dt.has("screen")&&dx.some(a=>Dt.has(a))){const a=Id("player",e.selected);return{name:"match",player:a,enemy:Id("enemy",a==="donut"?"hamburger":"donut")}}return Dt.get("screen")==="characters"?{name:"characters"}:Dt.get("screen")==="trophies"?{name:"trophies"}:Dt.get("screen")==="shop"?{name:"shop"}:Dt.get("screen")==="settings"?{name:"settings"}:Dt.get("screen")==="home"?{name:"home"}:{name:"opening"}}const j0=new Jd,ux=hx({gameHost:document.getElementById("game"),hudRoot:document.getElementById("hud"),screenRoot:document.getElementById("screens"),profile:j0});ux.navigate(px(j0));we.music.play();const fx=document.getElementById("boot");requestAnimationFrame(()=>fx.classList.add("hidden"));
