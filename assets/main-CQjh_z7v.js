import{C as Se,a as re,L as ni,c as Ut,b as ra,V as le,d as oe,S as Di,e as ve,M as U,t as Be,R as Ge,B as Bc,f as b,g as Aa,h as es,i as tt,j as si,k as $i,G as ee,P as za,l as K,m as pt,n as Qa,o as ts,O as Q0,Z as Gc,A as Uc,p as J0,q as eu,N as tu,r as ri,s as ii,u as Es,v as Cd,w as Ni,x as ia,y as Et,z as ft,D as aa,E as Oe,F as we,H as an,I as au,J as ou,K as Ke,Q as nu,T as su,U as ru,W as At,X as iu,Y as cu,_ as lu,$ as zd,a0 as hu,a1 as du,a2 as ci,a3 as Wc,a4 as pu,a5 as uu,a6 as fu,a7 as mu,a8 as Zs,a9 as Yc,aa as gu,ab as wu,ac as as,ad as yu,ae as li,af as bu,ag as xu,ah as vu,ai as Id,aj as ku,ak as Vc,al as hi,am as Mu,an as Su,ao as Eu,ap as Tu,aq as Au,ar as Fu,as as Ld,at as yt,au as vo,av as Ts,aw as et,ax as Pi,ay as Hi,az as qi,aA as As,aB as Da,aC as ji,aD as io,aE as qt,aF as $a,aG as Od,aH as Bi,aI as ca,aJ as Ru,aK as Cu,aL as Xa,aM as zu,aN as Xc,aO as wn,aP as os,aQ as Iu,aR as Lu,aS as Ou,aT as _u,aU as Du,aV as $u,aW as Kc,aX as Nu,aY as Pu,aZ as Qs,a_ as Hu,a$ as qu,b0 as ju,b1 as Bu,b2 as Gu}from"./kitchen-lVni5XWb.js";const Zc={coins:500,gems:25},Uu=!1,_d=Se[0],mt={trophiesWin:15,trophyLossBase:2,trophyLossPer:150,trophyLossCap:10,trophyLossGraceBelow:100,coinsWin:60,coinsLoss:20,winsPerChest:3},co={Normal:120,Rare:260,Epic:520,Legendary:900,Neon:1400,Cyber:2200},Ro={baseCoins:300,growth:1.32,rarityCostMultiplier:{Normal:1,Rare:1,Epic:1,Legendary:1,Neon:1,Cyber:1},roundTo:10},Wt=["chest","hamburgerBox","pineappleBox","redBox","fireBox"],Dd="Rarity sets how hard a fighter is to find — not how strong it is, and not what it costs to level up. Two fighters at the same level are a fair fight whatever their rarity.",Ce={chest:{name:"Chest",emoji:"📦",blurb:"Earned by winning matches and along the Trophy Road.",price:null,entries:[{weight:50,coins:120},{weight:22,coins:220},{weight:13,coins:90,gems:5},{weight:8,coins:400},{weight:4,coins:150,gems:20},{weight:2.1,characterRarity:"Normal"},{weight:.9,characterRarity:"Rare"}]},hamburgerBox:{name:"Hamburger Box",emoji:"🍔",blurb:"Mostly Normal fighters, with a chance of something rarer.",price:{coins:900,gems:60},entries:[{weight:89,characterRarity:"Normal"},{weight:10,characterRarity:"Rare"},{weight:1,characterRarity:"Epic"}]},pineappleBox:{name:"Purple Pineapple Box",emoji:"🍍",blurb:"Rare fighters guaranteed, Epic and Legendary possible.",price:{coins:3200,gems:120},entries:[{weight:94.5,characterRarity:"Rare"},{weight:5,characterRarity:"Epic"},{weight:.5,characterRarity:"Legendary"}]},redBox:{name:"Big Smile Box",emoji:"🎁",blurb:"Epic fighters, with the only Cyber chance outside the Fire Box.",price:{coins:5600,gems:240},entries:[{weight:89.49,characterRarity:"Epic"},{weight:10,characterRarity:"Legendary"},{weight:.5,characterRarity:"Neon"},{weight:.01,characterRarity:"Cyber"}]},fireBox:{name:"Purple Fire Box",emoji:"🔥",blurb:"Legendary fighters, with the best Neon and Cyber odds in the game.",price:{coins:12e3,gems:480},entries:[{weight:94.5,characterRarity:"Legendary"},{weight:5,characterRarity:"Neon"},{weight:.5,characterRarity:"Cyber"}]}},jt=[{trophies:10,reward:{type:"container",kind:"chest",count:1}},{trophies:25,reward:{type:"coins",amount:150}},{trophies:42,reward:{type:"gems",amount:5}},{trophies:60,reward:{type:"character",id:"donut"}},{trophies:85,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:107,reward:{type:"coins",amount:250}},{trophies:130,reward:{type:"character",id:"taco"}},{trophies:160,reward:{type:"gems",amount:10}},{trophies:190,reward:{type:"container",kind:"chest",count:1}},{trophies:220,reward:{type:"character",id:"burrito"}},{trophies:260,reward:{type:"coins",amount:400}},{trophies:300,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:345,reward:{type:"character",id:"soup"}},{trophies:400,reward:{type:"gems",amount:20}},{trophies:455,reward:{type:"container",kind:"chest",count:1}},{trophies:510,reward:{type:"character",id:"sushi"}},{trophies:580,reward:{type:"coins",amount:700}},{trophies:650,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:725,reward:{type:"character",id:"waterbottle"}},{trophies:815,reward:{type:"gems",amount:35}},{trophies:905,reward:{type:"container",kind:"chest",count:1}},{trophies:1e3,reward:{type:"character",id:"pizza"}},{trophies:1105,reward:{type:"coins",amount:1200}},{trophies:1220,reward:{type:"container",kind:"redBox",count:1}},{trophies:1340,reward:{type:"character",id:"egg"}},{trophies:1485,reward:{type:"gems",amount:60}},{trophies:1630,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:1780,reward:{type:"character",id:"lollipop"}},{trophies:1980,reward:{type:"coins",amount:2e3}},{trophies:2190,reward:{type:"container",kind:"redBox",count:1}},{trophies:2400,reward:{type:"character",id:"hotdog"}},{trophies:2650,reward:{type:"gems",amount:100}},{trophies:2900,reward:{type:"container",kind:"fireBox",count:1}},{trophies:3200,reward:{type:"bundle",parts:[{type:"coins",amount:5e3},{type:"gems",amount:150},{type:"container",kind:"fireBox",count:1}]}}],$d=[{id:"gemsPouch",name:"Pouch of Gems",emoji:"💎",priceUsdCents:99,gems:80},{id:"gemsSack",name:"Sack of Gems",emoji:"💎",priceUsdCents:499,gems:500},{id:"gemsCrate",name:"Crate of Gems",emoji:"💎",priceUsdCents:999,gems:1200},{id:"gemsBarrel",name:"Barrel of Gems",emoji:"💎",priceUsdCents:1999,gems:2600},{id:"gemsVault",name:"Vault of Gems",emoji:"💎",priceUsdCents:4999,gems:7e3},{id:"starterBundle",name:"Chef Starter Pack",emoji:"🧑‍🍳",priceUsdCents:499,gems:500,coins:2e3,container:{kind:"pineappleBox",count:1},oneTime:!0}],Fs=(()=>{const e={};for(const t of Se){const a=re[t].rarity;(e[a]??=[]).push(t)}return e})();function Wu(e){let t=e>>>0;return t=Math.imul(t^t>>>16,569420461),t=Math.imul(t^t>>>15,1935289751),(t^t>>>15)>>>0}function Yu(e){let t=Wu(Math.trunc(e)||0);const a=()=>{t=t+1831565813>>>0;let o=t;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296};return{next:a,int(o){return o>0?Math.floor(a()*o):0},pick(o){return o.length>0?o[Math.floor(a()*o.length)]:void 0}}}function Vu(e,t,a){if(t.length===0)return-1;const o=e.next()*a;let n=0;for(let s=0;s<t.length;s++)if(n+=t[s],o<n)return s;return t.length-1}function Xu(){return Math.floor(Math.random()*4294967295)>>>0||1}function Gi(){return{coins:0,gems:0,containers:{},characters:[]}}function Gn(e,t){return t===1?e:/[sxz]$/i.test(e)?`${e}es`:`${e}s`}function Nd(e,t){e.coins+=t.coins,e.gems+=t.gems;for(const[a,o]of Object.entries(t.containers))e.containers[a]=(e.containers[a]??0)+o;for(const a of t.characters)e.characters.includes(a)||e.characters.push(a);return e}function Ku(e){const t=[];for(const a of e.characters)t.push({emoji:re[a].emoji,label:re[a].name});for(const[a,o]of Object.entries(e.containers)){if(!o)continue;const n=Ce[a];t.push({emoji:n.emoji,label:o>1?`${o} ${Gn(n.name,o)}`:n.name})}return e.coins>0&&t.push({emoji:"🪙",label:`${e.coins.toLocaleString()} ${Gn("Coin",e.coins)}`}),e.gems>0&&t.push({emoji:"💎",label:`${e.gems.toLocaleString()} ${Gn("Gem",e.gems)}`}),t}function Rs(e){return e.reduce((t,a)=>t+a.weight,0)}function Vo(e){const t=Ce[e],a=Rs(t.entries);if(a<=0)return[];const o=[];for(const s of t.entries){const r=s.weight/a*100;if(s.characterRarity){const i=Fs[s.characterRarity]??[];o.push({label:`${s.characterRarity} fighter`,percent:r,rarity:s.characterRarity,pool:i})}else{const i=[];s.coins&&i.push(`${s.coins.toLocaleString()} coins`),s.gems&&i.push(`${s.gems.toLocaleString()} gems`),o.push({label:i.join(" + ")||"Nothing",percent:r})}}const n=new Map;for(const s of o){const r=n.get(s.label);r?r.percent+=s.percent:n.set(s.label,{...s})}return[...n.values()].sort((s,r)=>r.percent-s.percent)}function Pd(e){return`${e.toFixed(4).replace(/0+$/,"").replace(/\.$/,"")}%`}function Zu(e,t,a){const o=Ce[e],n=Rs(o.entries),s=o.entries[Vu(t,o.entries.map(i=>i.weight),n)],r=Gi();if(!s)return{kind:e,reward:r};if(s.coins&&(r.coins+=s.coins),s.gems&&(r.gems+=s.gems),s.characterRarity){const i=Fs[s.characterRarity]??[],c=i.filter(l=>!a.has(l));if(c.length>0){const l=t.pick(c);r.characters.push(l)}else{const l=t.pick(i);if(r.coins+=co[s.characterRarity],l)return{kind:e,reward:r,duplicateOf:l}}}return{kind:e,reward:r}}function Hd(e){return co[re[e].rarity]}function Qu(e){return e<mt.trophyLossGraceBelow?0:Math.min(mt.trophyLossCap,mt.trophyLossBase+Math.floor(e/mt.trophyLossPer))}function Ju(e,t){return t?mt.trophiesWin:-Qu(e)}function ef(){return jt}function di(){return jt.length>0?jt[jt.length-1].trophies:0}function qd(e,t){return jt.filter(a=>e>=a.trophies&&!t.includes(a.trophies))}function tf(e){return jt.find(t=>e<t.trophies)??null}function jd(e){const t=tf(e);if(!t)return{from:di(),to:di(),progress01:1,next:null};const a=jt.indexOf(t),o=a>0?jt[a-1].trophies:0,n=t.trophies-o,s=n>0?Math.min(1,Math.max(0,(e-o)/n)):0;return{from:o,to:t.trophies,progress01:s,next:t}}function Bd(e,t){const a=Gi();switch(e.type){case"coins":a.coins+=e.amount;break;case"gems":a.gems+=e.amount;break;case"container":a.containers[e.kind]=(a.containers[e.kind]??0)+e.count;break;case"character":a.coins+=Hd(e.id);break;case"bundle":for(const o of e.parts)Nd(a,Bd(o));break}return a}function pi(e,t){switch(e.type){case"coins":return{emoji:"🪙",title:`${e.amount.toLocaleString()} Coins`,isCharacter:!1};case"gems":return{emoji:"💎",title:`${e.amount.toLocaleString()} Gems`,isCharacter:!1};case"container":{const a=Ce[e.kind];return{emoji:a.emoji,title:e.count>1?`${e.count} ${Gn(a.name,e.count)}`:a.name,isCharacter:!1}}case"character":{const a=re[e.id],o=Uu;return{emoji:a.emoji,title:a.name,isCharacter:!0,payoutNote:o?void 0:`owned · 🪙 ${Hd(e.id).toLocaleString()}`}}case"bundle":return{emoji:"🎉",title:"Grand Prize",isCharacter:!1}}}function af(e,t){const a=Ut(t);if(a>=ni)return null;const o=a-ra,n=Ro.baseCoins*Math.pow(Ro.growth,o)*Ro.rarityCostMultiplier[re[e].rarity];return{coins:Math.round(n/Ro.roundTo)*Ro.roundTo,gems:0}}function of(e){return Ut(e)}function nf(){return $d}function sf(e){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(e/100)}function Qc(e){return e.priceUsdCents>0?e.gems/(e.priceUsdCents/100):0}function rf(e){const t=$d.filter(n=>!n.oneTime&&n.gems>0),a=t.reduce((n,s)=>s.priceUsdCents<n.priceUsdCents?s:n,t[0]);if(!a||e.id===a.id)return 0;const o=Qc(e)/Qc(a);return Math.max(0,Math.round((o-1)*100))}function Gd(){const e={};for(const t of Wt)e[t]=0;return e}function Ud(e=Xu()){return{trophies:0,bestTrophies:0,coins:Zc.coins,gems:Zc.gems,containers:Gd(),claimed:[],unlocked:[_d],winsTowardChest:0,lastMatch:null,levels:{},seed:e,rolls:0}}function Ui(e){return new Set(Se)}function cf(e,t){return!0}function Wd(e,t){e.coins+=t.coins,e.gems+=t.gems;for(const[a,o]of Object.entries(t.containers))e.containers[a]=(e.containers[a]??0)+(o??0);for(const a of t.characters)e.unlocked.includes(a)||e.unlocked.push(a)}function ui(e,t,a){return e.coins<t||e.gems<a?!1:(e.coins-=t,e.gems-=a,!0)}function lf(e,t){const a=Ju(e.trophies,t);e.trophies=Math.max(0,e.trophies+a),e.bestTrophies=Math.max(e.bestTrophies,e.trophies);const o=t?mt.coinsWin:mt.coinsLoss;e.coins+=o;let n=0;if(t){for(e.winsTowardChest++;e.winsTowardChest>=mt.winsPerChest;)e.winsTowardChest-=mt.winsPerChest,n++;e.containers.chest+=n}const s={won:t,trophies:a,coins:o,chests:n,seen:!1};return e.lastMatch=s,s}function hf(e){return Math.max(0,mt.winsPerChest-e.winsTowardChest)}function Yd(e){return qd(e.trophies,e.claimed)}function Vd(e,t){const a=qd(e.trophies,e.claimed).find(n=>n.trophies===t);if(!a)return null;const o=Bd(a.reward,Ui());return e.claimed.push(t),e.claimed.sort((n,s)=>n-s),Wd(e,o),o}function df(e){const t=Gi();for(const a of Yd(e)){const o=Vd(e,a.trophies);o&&Nd(t,o)}return t}function pf(e,t){if((e.containers[t]??0)<=0)return null;e.containers[t]--;const a=Yu(e.seed+e.rolls);e.rolls++;const o=Zu(t,a,Ui());return Wd(e,o.reward),o}function uf(e){return Wt.reduce((t,a)=>t+(e.containers[a]??0),0)}function ff(e,t,a){const o=Ce[t].price;return!o||!(a==="coins"?ui(e,o.coins,0):ui(e,0,o.gems))?!1:(e.containers[t]++,!0)}function Wi(e,t){return Ut(e.levels[t]??ra)}function Yi(e,t){return af(t,Wi(e,t))}function mf(e,t){const a=Yi(e,t);return a!==null&&e.coins>=a.coins&&e.gems>=a.gems}function gf(e,t){const a=Yi(e,t);if(!a||!ui(e,a.coins,a.gems))return null;const o=Ut(Wi(e,t)+1);return e.levels[t]=o,{level:o,spent:a}}function wf(e){const t=Ud();if(!e||typeof e!="object")return t;const a=e,o=(s,r)=>typeof s=="number"&&Number.isFinite(s)&&s>=0?Math.floor(s):r,n={trophies:o(a.trophies,0),bestTrophies:o(a.bestTrophies,0),coins:o(a.coins,t.coins),gems:o(a.gems,t.gems),containers:Gd(),claimed:[],unlocked:[_d],winsTowardChest:o(a.winsTowardChest,0),lastMatch:null,levels:{},seed:o(a.seed,t.seed)||t.seed,rolls:o(a.rolls,0)};if(a.containers&&typeof a.containers=="object"){const s=a.containers;for(const r of Wt)n.containers[r]=o(s[r],0)}if(Array.isArray(a.claimed)){const s=new Set(jt.map(i=>i.trophies)),r=new Set(a.claimed.filter(i=>typeof i=="number"&&s.has(i)));n.claimed=[...r].sort((i,c)=>i-c)}if(Array.isArray(a.unlocked))for(const s of a.unlocked)typeof s=="string"&&Se.includes(s)&&!n.unlocked.includes(s)&&n.unlocked.push(s);if(a.levels&&typeof a.levels=="object"){const s=a.levels;for(const r of Se){const i=s[r];if(typeof i!="number"||!Number.isFinite(i))continue;const c=Ut(i);c>ra&&(n.levels[r]=c)}}if(a.lastMatch&&typeof a.lastMatch=="object"){const s=a.lastMatch;n.lastMatch={won:s.won===!0,trophies:typeof s.trophies=="number"&&Number.isFinite(s.trophies)?Math.trunc(s.trophies):0,coins:o(s.coins,0),chests:o(s.chests,0),seen:s.seen===!0}}return n.bestTrophies=Math.max(n.bestTrophies,n.trophies),n}function yf(e){return{trophies:e.trophies,bestTrophies:e.bestTrophies,coins:e.coins,gems:e.gems,containers:{...e.containers},claimed:[...e.claimed],unlocked:[...e.unlocked],winsTowardChest:e.winsTowardChest,lastMatch:e.lastMatch?{...e.lastMatch}:null,levels:{...e.levels},seed:e.seed,rolls:e.rolls}}function bf(e,t){typeof t.coins=="number"&&Number.isFinite(t.coins)&&t.coins>=0&&(e.coins=Math.floor(t.coins)),typeof t.gems=="number"&&Number.isFinite(t.gems)&&t.gems>=0&&(e.gems=Math.floor(t.gems))}const Xd="food-arena.profile.v1",Bo=250,xf=100,vf=35,fi="Chef",mi=16;function Kd(e){if(typeof e!="string")return fi;const t=e.replace(/\s+/g," ").replace(/[\p{Cc}\p{Cf}]/gu,"").trim().slice(0,mi).trim();return t.length>0?t:fi}function kf(e){return typeof e=="string"&&Se.includes(e)}function Js(e,t){return typeof e=="number"&&Number.isFinite(e)&&e>=0?e:t}function Jc(){return{name:fi,wins:0,losses:0,xp:0,selected:Se[0],economy:Ud()}}function el(){try{const e=localStorage.getItem(Xd);if(!e)return Jc();const t=JSON.parse(e),a=wf(t.economy);return t.economy===void 0&&bf(a,t),{name:Kd(t.name),wins:Math.floor(Js(t.wins,0)),losses:Math.floor(Js(t.losses,0)),xp:Math.floor(Js(t.xp,0)),selected:kf(t.selected)?t.selected:Se[0],economy:a}}catch{return Jc()}}class Zd{data;listeners=new Set;constructor(t){this.data=t?{...el(),...t}:el()}get name(){return this.data.name}get wins(){return this.data.wins}get losses(){return this.data.losses}get xp(){return this.data.xp}get selected(){return this.data.selected}get level(){return Math.floor(this.data.xp/Bo)+1}get levelProgress01(){return this.data.xp%Bo/Bo}get economy(){return this.data.economy}get coins(){return this.data.economy.coins}get gems(){return this.data.economy.gems}get trophies(){return this.data.economy.trophies}get bestTrophies(){return this.data.economy.bestTrophies}get containers(){return this.data.economy.containers}get containerCount(){return uf(this.data.economy)}get winsToNextChest(){return hf(this.data.economy)}get lastMatch(){return this.data.economy.lastMatch}get unlocked(){return Ui(this.data.economy)}isUnlocked(t){return cf(this.data.economy)}get claimable(){return Yd(this.data.economy)}select(t){this.data.selected!==t&&(this.data.selected=t,this.commit())}setName(t){const a=Kd(t);return a===this.data.name||(this.data.name=a,this.commit()),a}recordResult(t){t?(this.data.wins++,this.data.xp+=xf):(this.data.losses++,this.data.xp+=vf);const a=lf(this.data.economy,t);return this.commit(),a}markLastMatchSeen(){const t=this.data.economy.lastMatch;!t||t.seen||(t.seen=!0,this.commit())}claimMilestone(t){const a=Vd(this.data.economy,t);return a&&this.commit(),a}claimAllMilestones(){const t=df(this.data.economy);return this.commit(),t}openContainer(t){const a=pf(this.data.economy,t);return a&&this.commit(),a}buyContainer(t,a){const o=ff(this.data.economy,t,a);return o&&this.commit(),o}characterLevel(t){return Wi(this.data.economy,t)}nextLevelPrice(t){return Yi(this.data.economy,t)}canLevelUp(t){return mf(this.data.economy,t)}levelUp(t){const a=gf(this.data.economy,t);return a&&this.commit(),a}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}commit(){try{localStorage.setItem(Xd,JSON.stringify({name:this.data.name,wins:this.data.wins,losses:this.data.losses,xp:this.data.xp,selected:this.data.selected,economy:yf(this.data.economy)}))}catch{}for(const t of this.listeners)t()}}const Mf="fa-screen-styles";function la(e,t){if(document.getElementById(e))return;const a=document.createElement("style");a.id=e,a.textContent=t,document.head.appendChild(a)}function Sf(){la(Mf,Ef)}function Qd(e,t){const a=e.replace("#",""),o=a.length===3?a.split("").map(i=>i+i).join(""):a,n=parseInt(o.slice(0,2),16)||0,s=parseInt(o.slice(2,4),16)||0,r=parseInt(o.slice(4,6),16)||0;return`rgba(${n},${s},${r},${t})`}const Ef=`
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
  /* TWO radii, project-wide. Anything you press is a pill; anything you read off is
     a 16px surface. Four competing radii on one screen was a named critic finding. */
  --radius-surface: 16px;

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
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
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
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.7rem, 1.6vh, 0.9rem);
  color: var(--ink);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-iconbtn:hover { background: #FFFFFF; }
.fa-iconbtn:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }

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
  border: 3px solid var(--ink);
  border-radius: 999px;
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
  font-weight: 800;
  font-size: clamp(0.74rem, 1.9vh, 1.02rem);
  letter-spacing: 0.02em;
  min-height: var(--tap);
  padding: 0 clamp(10px, 1.6vw, 22px);
  border-radius: 999px;
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
  border: 3px solid var(--ink);
  border-radius: var(--radius-surface);
  box-shadow: 0 5px 0 rgba(0,0,0,0.35);
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
  font-weight: 900;
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
  font-weight: 900;
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
  font-weight: 800;
  font-size: clamp(0.8rem, 1.9vh, 1.1rem);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--ink);
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
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
.fa-btn--quiet:active { box-shadow: 0 0 0 rgba(0,0,0,0.35); }

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
  font-weight: 800;
  font-size: clamp(0.74rem, 1.7vh, 0.95rem);
  color: var(--ink);
  background: #FFFFFF;
  border: 3px solid var(--ink);
  border-radius: 999px;
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
  font-weight: 800;
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
  border-radius: 999px;
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
  font-weight: 900;
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
  border: 3px solid var(--ink);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
.fa-level-fill {
  height: 100%;
  border-radius: 999px;
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
  font-weight: 800;
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
  font-weight: 800;
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
  border-radius: 999px;
  overflow: hidden;
}
.fa-stat-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.32s cubic-bezier(0.2, 0.9, 0.3, 1);
  background-image: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%);
  background-blend-mode: overlay;
}
.fa-stat-val {
  flex: 0 0 auto;
  width: 20px;
  text-align: end;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
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
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
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
`,Tf=1923712,Jd="#1d5a80",Af="#1D5576",Ff="#093F73",tl="#8A4E15",Rf="#C07A23",Cf="#F4C55E",Co=5,zo=14,er=-.6,zf=[[-.6,.86],[0,.88],[1.2,.94],[2.6,1.02],[3.8,1.16],[8,1.4],[14,1.55]],al=1.3,If=.52,ol=new le(16.35,9.82,4.69).normalize(),Lf=[[0,.58],[1.5,.62],[2.6,.88],[3.8,1.16],[4.7,1.36],[6.4,1.42]],Io=.24,Lo=.215,nl=.62,Of=2.48,_f=.86;function sl(e,t){if(t<=e[0][0])return e[0][1];const a=e[e.length-1];if(t>=a[0])return a[1];for(let o=1;o<e.length;o++){const[n,s]=e[o],[r,i]=e[o-1];if(t>n)continue;const c=(t-r)/Math.max(1e-6,n-r);return i+(s-i)*(c*c*(3-2*c))}return a[1]}function Df(e,t=128){const a=document.createElement("canvas");a.width=t,a.height=t;const o=a.getContext("2d");if(o){const s=o.createRadialGradient(t/2,t/2,0,t/2,t/2,t/2),[r,i,c]=e,l=h=>`rgb(${Math.round(r+(255-r)*h)},${Math.round(i+(255-i)*h)},${Math.round(c+(255-c)*h)})`;s.addColorStop(0,l(0)),s.addColorStop(.54,l(.1)),s.addColorStop(.8,l(.58)),s.addColorStop(1,"rgb(255,255,255)"),o.fillStyle=s,o.fillRect(0,0,t,t)}const n=new tt(a);return n.colorSpace=tu,n.wrapS=ri,n.wrapT=ri,n}function rl(e,t,a){const o=new K({map:Df(t),blending:eu,blendEquation:Uc,blendSrc:Gc,blendDst:J0,blendEquationAlpha:Uc,blendSrcAlpha:Gc,blendDstAlpha:Q0,transparent:!0,depthWrite:!1,toneMapped:!1}),n=new b(new za(e,e),o);return n.rotation.x=-Math.PI/2,n.renderOrder=a,n.userData.noOutline=!0,n}const Ot={counterBody:"#123A50",counterTop:"#A8641F",counterLip:"#D08A2E",shelf:"#7A431A",steel:"#24485C",jars:["#B02733","#4E8A12","#C99414","#1668A8","#6B3AA8","#B85A18","#2E8C6A","#C4553C"]};class ns{stage;holder=document.createElement("div");model=null;currentId=null;subjectW=oe*.8;subjectH=oe;elapsed=0;introT=0;observer=null;footShadow=null;disposed=!1;dressing=null;constructor(){this.holder.style.cssText="position:absolute;inset:0;",this.stage=new Di({container:this.holder,background:Tf,fog:null,camera:{pitchDeg:20,yawDeg:0,frameMode:"subject",subjectHeight:oe,subjectFill:.6,targetHeight:oe*.52,followLerp:1},maxPixelRatio:2}),this.stage.canvas.style.cssText="display:block;width:100%;height:100%;",this.buildSet(),this.stage.rig.snapTo(0,0),this.stage.lighting.focus(0,0,6)}buildSet(){const t=new ve(Co,Co,zo,72,28,!0);this.paintVertexRamp(t,(m,g,w)=>{const y=U.clamp(-(m*ol.x+w*ol.z)/Co,0,1);return sl(zf,g+zo/2+er)*(al+(If-al)*y)});const a=Be({color:Af,ramp:Ge(),roughness:.9,rim:!1});a.side=Bc,a.vertexColors=!0;const o=new b(t,a);o.position.y=zo/2+er,o.receiveShadow=!0,o.userData.noOutline=!0,o.name="menu_wall",o.renderOrder=-1,this.stage.scene.add(o);const n=new Aa(0,6.4,96,32);this.paintVertexRamp(n,(m,g)=>sl(Lf,Math.hypot(m,g)));const s=Be({color:Ff,ramp:Ge(),roughness:.86,rim:!1});s.vertexColors=!0;const r=new b(n,s);r.rotation.x=-Math.PI/2,r.receiveShadow=!0,r.userData.noOutline=!0,r.name="menu_ground",this.stage.scene.add(r);const i=rl(5.4,[18,32,160],1);i.position.y=.012,i.name="menu_ground_decal",this.stage.scene.add(i);const c=new b(new ve(1.15,1.24,.18,48),Be({color:tl,ramp:Ge(),roughness:.72}));c.position.y=.09,c.castShadow=!0,c.receiveShadow=!0,c.userData.noOutline=!0,c.name="menu_plinth_body",this.stage.scene.add(c);const l=Be({color:Rf,ramp:Ge(),roughness:.55}),h=new b(new ve(1.21,1.19,.06,48,1,!0),l);h.position.y=Io-.03,h.castShadow=!0,h.receiveShadow=!0,h.userData.noOutline=!0,h.name="menu_plinth_rim",this.stage.scene.add(h);const d=new b(new Aa(1.1,1.21,48),l);d.rotation.x=-Math.PI/2,d.position.y=Io,d.receiveShadow=!0,d.userData.noOutline=!0,this.stage.scene.add(d);const p=new b(new ve(1.1,1.1,Io-Lo,48,1,!0),Be({color:tl,ramp:Ge(),roughness:.8,doubleSide:!0}));p.position.y=(Io+Lo)/2,p.receiveShadow=!0,p.userData.noOutline=!0,this.stage.scene.add(p);const u=new b(new ve(1.1,1.1,.05,48),Be({color:Cf,ramp:Ge(),roughness:.45}));u.position.y=Lo-.025,u.receiveShadow=!0,u.userData.noOutline=!0,u.name="menu_plinth_top",this.stage.scene.add(u);const f=rl(1.9,[92,62,30],2);f.position.y=Lo+.004,f.scale.set(1,1,.72),f.name="menu_foot_decal",this.footShadow=f,this.stage.scene.add(f)}paintVertexRamp(t,a){const o=t.attributes.position,n=new Float32Array(o.count*3);for(let s=0;s<o.count;s++){const r=a(o.getX(s),o.getY(s),o.getZ(s));n[s*3]=r,n[s*3+1]=r,n[s*3+2]=r}t.setAttribute("color",new es(n,3))}applyFraming(){const t=this.stage.rig.camera,a=t.aspect>0&&Number.isFinite(t.aspect)?t.aspect:1,o=Math.max(.5,this.subjectH)+Io,n=Math.max(.5,this.subjectW,Of),s=_f*a*o/n;this.stage.rig.subjectHeight=o,this.stage.rig.subjectFill=U.clamp(Math.min(nl,s),.2,nl),this.stage.rig.targetHeight=o*.5,this.stage.rig.apply()}static floorGridTexture(t=256){const a=document.createElement("canvas");a.width=t,a.height=t;const o=a.getContext("2d");o&&(o.clearRect(0,0,t,t),o.strokeStyle="rgba(0,0,0,0.55)",o.lineWidth=t*.055,o.strokeRect(0,0,t,t));const n=new tt(a);return n.wrapS=si,n.wrapT=si,n.repeat.set(22,22),n.colorSpace=$i,n}buildDressing(){const t=new ee;t.name="lobby_dressing";const a=(f,m=!1)=>(f.castShadow=m,f.receiveShadow=!0,f.userData.noOutline=!0,t.add(f),f),o=-3.35,n=7.2,s=.78,r=new b(new za(13,13),new K({map:ns.floorGridTexture(),transparent:!0,depthWrite:!1,toneMapped:!1}));r.rotation.x=-Math.PI/2,r.position.y=.006,r.renderOrder=0,r.userData.noOutline=!0,r.name="lobby_floor_grid",t.add(r);const i=ns.floorGridTexture();i.repeat.set(26,9);const c=new b(new ve(Co-.04,Co-.04,zo,72,1,!0),new K({map:i,side:Bc,transparent:!0,depthWrite:!1,toneMapped:!1}));c.position.y=zo/2+er,c.renderOrder=0,c.userData.noOutline=!0,c.name="lobby_wall_grid",t.add(c),a(new b(new pt(n,s,.72),Be({color:Ot.counterBody,ramp:Ge(),roughness:.8})),!0).position.set(0,s/2,o),a(new b(new pt(n+.12,.11,.84),Be({color:Ot.counterTop,ramp:Ge(),roughness:.5}))).position.set(0,s+.055,o),a(new b(new pt(n+.12,.045,.06),Be({color:Ot.counterLip,ramp:Ge(),roughness:.4}))).position.set(0,s+.012,o+.44),a(new b(new pt(n-.4,.13,.52),Be({color:Ot.shelf,ramp:Ge(),roughness:.75}))).position.set(0,2.15,o-.05);for(const f of[-2.6,2.6])a(new b(new pt(.1,.36,.1),Be({color:Ot.steel,ramp:Ge(),roughness:.7}))).position.set(f,2.31,o-.2);const l=new ve(.19,.21,.44,20),h=new ve(.21,.21,.07,20),d=Be({color:Ot.steel,ramp:Ge(),roughness:.45}),p=[-2.95,-2.25,-1.55,1.55,2.25,2.95,-2.6,2.6],u=[2.35,2.35,2.35,2.35,2.35,2.35,.9,.9];for(let f=0;f<p.length;f++){const m=.86+f*37%5*.09,g=u[f]+.22*m;a(new b(l,Be({color:Ot.jars[f],ramp:Ge(),roughness:.55}))).position.set(p[f],g,o-.02),t.children[t.children.length-1].scale.setScalar(m),a(new b(h,d)).position.set(p[f],g+.25*m,o-.02),t.children[t.children.length-1].scale.setScalar(m)}for(const f of[-1.95,1.95])a(new b(new ve(.4,.36,.46,24),Be({color:Ot.steel,ramp:Ge(),roughness:.35}))).position.set(f,s+.34,o-.02),a(new b(new ve(.44,.44,.06,24),Be({color:Ot.counterLip,ramp:Ge(),roughness:.3}))).position.set(f,s+.6,o-.02);return t}setScene(t){this.disposed||(t==="lobby"&&!this.dressing&&(this.dressing=this.buildDressing(),this.stage.scene.add(this.dressing)),this.dressing&&(this.dressing.visible=t==="lobby"))}attachTo(t){this.disposed||(this.holder.parentElement!==t&&t.appendChild(this.holder),this.observer?.disconnect(),this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(t),this.resize())}detach(){this.observer?.disconnect(),this.observer=null,this.holder.remove()}show(t){if(this.disposed||t===this.currentId)return;this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose()),this.model=Qa(t),this.model.play("idle"),this.stage.scene.add(this.model.root);const a=new ts().setFromObject(this.model.root);if(this.subjectH=Math.max(.5,a.max.y-a.min.y),this.subjectW=2*Math.max(.25,Math.abs(a.min.x),Math.abs(a.max.x),Math.abs(a.min.z),Math.abs(a.max.z)),this.model.root.position.y=Lo+.005-a.min.y,this.footShadow){const o=U.clamp(Math.max(a.max.x-a.min.x,a.max.z-a.min.z)*1.15,1,2.3);this.footShadow.scale.set(o/1.9,1,o/1.9*.72)}this.currentId=t,this.introT=.34,this.applyFraming()}poke(){this.model?.play("attack")}update(t){if(!this.disposed){if(this.elapsed+=t,this.stage.rig.yawDeg=Math.sin(this.elapsed*.42)*22,this.model){if(this.introT>0){this.introT=Math.max(0,this.introT-t);const a=1-this.introT/.34,o=Math.sin(a*Math.PI)*(1-a*.4);this.model.root.scale.setScalar(1+o*.16),this.model.root.rotation.y=(1-a)*-.9}else this.model.root.scale.setScalar(1),this.model.root.rotation.y=0;this.model.update({dt:t,elapsed:this.elapsed,moveSpeed01:0,health01:1})}this.stage.render(t)}}resize(){this.disposed||(this.stage.resize(),this.applyFraming())}info(){const t=this.stage.rig.camera,a=this.model?new ts().setFromObject(this.model.root):null,o=s=>{const r=s.clone().project(t);return{x:+(r.x*.5+.5).toFixed(3),y:+(1-(r.y*.5+.5)).toFixed(3)}},n=this.stage.rig;return{id:this.currentId,aspect:+t.aspect.toFixed(3),fill:+n.subjectFill.toFixed(3),subject:{w:+this.subjectW.toFixed(2),h:+this.subjectH.toFixed(2)},cameraOk:Number.isFinite(t.position.x)&&Number.isFinite(t.position.y),feet:a?o(new le(0,a.min.y,0)):null,crown:a?o(new le(0,a.max.y,0)):null,left:a?o(new le(a.min.x,(a.min.y+a.max.y)/2,0)):null,right:a?o(new le(a.max.x,(a.min.y+a.max.y)/2,0)):null}}dispose(){if(!this.disposed){if(this.disposed=!0,this.observer?.disconnect(),this.observer=null,this.dressing){const t=new Set,a=new Set;this.dressing.traverse(o=>{const n=o;if(n.geometry&&t.add(n.geometry),n.material)for(const s of Array.isArray(n.material)?n.material:[n.material])a.add(s)}),t.forEach(o=>o.dispose()),a.forEach(o=>o.dispose()),this.stage.scene.remove(this.dressing),this.dressing=null}this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose(),this.model=null),this.stage.dispose(),this.holder.remove()}}}let Ja=null;function Vi(){return Ja||(Ja=new ns,typeof window<"u"&&(window.__charStage=()=>Ja?.info()??null)),Ja}function il(){Ja?.dispose(),Ja=null}const tr=1e-4,$f=2e4;function Xi(e){let t=e|0||2654435769;return()=>(t^=t<<13,t^=t>>>17,t^=t<<5,(t>>>0)/4294967296)}function he(e,t,a){return t+e()*(a-t)}function J(e,t){return Math.pow(2,he(e,-t,t)/1200)}const cl=new WeakMap;function Nf(e){const t=cl.get(e);if(t)return t;const a=Math.floor(e.sampleRate*2),o=e.createBuffer(1,a,e.sampleRate),n=o.getChannelData(0),s=Xi(6221086);for(let r=0;r<a;r++)n[r]=s()*2-1;return cl.set(e,o),o}const ll=new WeakMap;function Pf(e,t){let a=ll.get(e);a||(a=new Map,ll.set(e,a));const o=Math.max(.05,Math.round(t*20)/20),n=a.get(o);if(n)return n;const s=1024,r=new Float32Array(s),i=Math.tanh(o);for(let c=0;c<s;c++){const l=c/(s-1)*2-1;r[c]=Math.tanh(o*l)/i}return a.set(o,r),r}function ep(e,t){const a=e.createWaveShaper();return a.curve=Pf(e,t),a.oversample="2x",a}const Hf=.26,qf=.19,hl=new WeakMap;function jf(e){const t=hl.get(e);if(t)return t;const a=e.sampleRate,o=Math.floor(a*Hf),n=e.createBuffer(2,o,a),s=Math.floor(a*.005),r=6.9078/(qf*a);for(let l=0;l<2;l++){const h=n.getChannelData(l),d=Xi(l===0?1990433:7840721);let p=0;for(let f=s;f<o;f++){const m=f-s,g=.3+.42*(m/(o-s)),w=d()*2-1;p=p*g+w*(1-g),h[f]=p*Math.exp(-r*m)}const u=l===0?[.0071,.0132,.0198,.0281,.0367,.0458]:[.0083,.0119,.0214,.0263,.0389,.0441];for(let f=0;f<u.length;f++){const m=s+Math.floor(u[f]*a);if(m>=o)continue;const g=f%2===0?1:-1;h[m]+=g*.62*Math.exp(-r*(m-s)*.55)}}let i=0;for(let l=0;l<2;l++){const h=n.getChannelData(l);for(let d=0;d<o;d++)i=Math.max(i,Math.abs(h[d]))}const c=i>0?.6/i:1;for(let l=0;l<2;l++){const h=n.getChannelData(l);for(let d=0;d<o;d++)h[d]*=c}return hl.set(e,n),n}function Bf(e){const t=e.createConvolver();return t.normalize=!1,t.buffer=jf(e),t}function tp(e,t,a){if(!e.wet||!(a>0))return;const o=e.ctx.createGain();o.gain.value=a,t.connect(o),o.connect(e.wet)}function ap(e,t,a){const o=e.createGain(),n=Math.max(5e-4,a.attack??.002),s=(a.duration-n)*Math.max(0,Math.min(.9,a.hold??0)),r=Math.max(tr*2,a.peak),i=t+a.duration;return o.gain.setValueAtTime(tr,t),o.gain.linearRampToValueAtTime(r,t+n),s>0&&o.gain.setValueAtTime(r,t+n+s),(a.curve??"exp")==="exp"?o.gain.exponentialRampToValueAtTime(tr,i):o.gain.linearRampToValueAtTime(0,i),o.gain.setValueAtTime(0,i+.001),o}function eo(e,t,a,o,n="exp"){if(typeof t=="number"){e.setValueAtTime(t,a);return}const[s,r]=t;e.setValueAtTime(s,a),n==="exp"&&s>0&&r>0?e.exponentialRampToValueAtTime(r,a+o):e.linearRampToValueAtTime(r,a+o)}function P(e,t){const{ctx:a,dest:o,when:n}=e,s=a.createBufferSource(),r=Nf(a);s.buffer=r,s.playbackRate.value=t.rate??1,t.loop&&(s.loop=!0,s.loopStart=0,s.loopEnd=r.duration);const i=Math.max(0,r.duration-(t.duration+.02)),c=t.loop?he(e.rng,0,r.duration):he(e.rng,0,Math.min(1.5,i)),l=ap(a,n,t),h=t.tremolo?Gf(a,n,t.duration,t.tremolo.rate,t.tremolo.depth):l;h!==l&&h.connect(l);const d=t.drive?ep(a,t.drive):h;if(d!==h&&d.connect(h),t.filter){const p=u=>{const f=a.createBiquadFilter();return f.type=t.filter,f.Q.value=u,eo(f.frequency,t.freq??1e3,n,t.duration,t.freqCurve??"exp"),f};if(t.poles===24){const u=Math.sqrt(Math.max(.1,t.q??1));s.connect(p(u)).connect(p(u)).connect(d)}else s.connect(p(t.q??1)).connect(d)}else s.connect(d);return l.connect(o),tp(e,l,t.wet??0),s.start(n,c,t.duration+.02),s.stop(n+t.duration+.02),t.duration}function W(e,t){const{ctx:a,dest:o,when:n}=e,s=ap(a,n,t);let r=s;if(t.ring!==void 0){const l=a.createGain();l.gain.value=0;const h=a.createOscillator();h.type="sine",eo(h.frequency,t.ring,n,t.duration,"exp"),h.connect(l.gain),h.start(n),h.stop(n+t.duration+.02),l.connect(s),r=l}if(t.drive){const l=ep(a,t.drive);l.connect(r),r=l}if(t.lowpass!==void 0){const l=a.createBiquadFilter();l.type="lowpass",l.Q.value=.7,eo(l.frequency,t.lowpass,n,t.duration),l.connect(r),r=l}const i=Math.max(1,Math.min(3,Math.round(t.voices??1))),c=t.detuneCents??0;for(let l=0;l<i;l++){const h=a.createOscillator();h.type=t.type??"sine";const d=i===1?0:(l/(i-1)-.5)*c,p=Math.pow(2,d/1200);if(typeof t.freq=="number"?eo(h.frequency,t.freq*p,n,t.duration,t.freqCurve??"exp"):eo(h.frequency,[t.freq[0]*p,t.freq[1]*p],n,t.duration,t.freqCurve??"exp"),i>1){const u=a.createGain();u.gain.value=1/i,h.connect(u).connect(r)}else h.connect(r);h.start(n),h.stop(n+t.duration+.02)}return s.connect(o),tp(e,s,t.wet??0),t.duration}function Cs(e,t){let a=0;for(const o of t.modes){const n=t.duration*o.decay,s=typeof t.freq=="number"?t.freq*o.ratio:[t.freq[0]*o.ratio,t.freq[1]*o.ratio];(typeof s=="number"?s:Math.max(s[0],s[1]))>$f||(a=Math.max(a,n),W(e,{type:"sine",freq:s,peak:t.peak*o.gain,attack:t.attack??.0015,duration:n,drive:t.drive,wet:t.wet}))}return a}function Gf(e,t,a,o,n){const s=Math.max(0,Math.min(1,n)),r=e.createGain();r.gain.value=1-s*.5;const i=e.createOscillator();i.type="sine",eo(i.frequency,o,t,a,"lin");const c=e.createGain();return c.gain.value=s*.5,i.connect(c),c.connect(r.gain),i.start(t),i.stop(t+a+.02),r}function me(e,t){const a=t.freq??5e3,o=P(e,{filter:"highpass",freq:a,q:.9,peak:t.peak,attack:4e-4,duration:.007,wet:t.wet??.06});if(!t.snap)return o;const n=(t.snapMs??14)/1e3,s=W(e,{type:"triangle",freq:[t.snap,t.snap*.38],peak:t.peak*.72,attack:6e-4,duration:n,drive:2.2,wet:t.wet??.06});return B(o,s)}function Re(e,t){const[a,o]=t.grainMs??[4,11],n=t.decay??.35,s=t.freqShift;for(let r=0;r<t.count;r++){const i=Math.pow(e.rng(),1.5)*t.spread,c=he(e.rng,a,o)/1e3,l=t.peak*(1-i/t.spread*(1-n))*he(e.rng,.55,1),h=s?s[0]+(s[1]-s[0])*(i/t.spread):1;P({...e,when:e.when+i},{filter:"bandpass",freq:he(e.rng,t.freq[0],t.freq[1])*h,q:t.q??6,peak:l,attack:8e-4,duration:c,drive:t.drive,wet:t.wet})}return t.spread+o/1e3}function Ho(e,t){const a=t.rise??2.6;let o=0;for(let n=0;n<t.count;n++){const s=he(e.rng,0,t.spread),r=he(e.rng,t.freq[0],t.freq[1]),i=he(e.rng,.045,.095);o=Math.max(o,s+i),W({...e,when:e.when+s},{type:"sine",freq:[r,r*a],peak:t.peak*he(e.rng,.5,1),attack:.002,duration:i,wet:t.wet})}return o}function ss(e,t){const[a,o]=t.pingMs??[7,18],n=t.bend??.92,s=Math.log2(t.freq[0]),r=Math.log2(t.freq[1]);let i=0;for(let c=0;c<t.count;c++){const l=Math.pow(e.rng(),1.6)*t.spread,h=Math.pow(2,s+(e.rng()+c*.6180339887)%1*(r-s)),d=he(e.rng,a,o)/1e3;i=Math.max(i,l+d),W({...e,when:e.when+l},{type:"sine",freq:[h,h*n],peak:t.peak*he(e.rng,.55,1),attack:6e-4,duration:d,wet:t.wet})}return i}function Ki(e,t){const[a,o]=t.freq??[9e3,3200],n=t.duration??.11,s=t.wet??.3,r=P(e,{filter:"bandpass",freq:[a*J(e.rng,90),o*J(e.rng,90)],q:.7,peak:t.peak,attack:.0012,duration:n,wet:s}),i=P(e,{filter:"highpass",poles:24,freq:[a*.8,a*.45],q:.7,peak:t.peak*.55,attack:6e-4,duration:n*.55,wet:s}),c=t.drops??6,l=c>0?Re(e,{count:c,spread:n*.85,grainMs:[3,9],freq:[o,a],q:5,peak:t.peak*.85,decay:.25,wet:s}):0;return B(r,i,l)}function B(...e){let t=0;for(const a of e)a>t&&(t=a);return t}const dl="fa.audio.volume",pl="fa.audio.muted",Uf=.62,Wf=20,Yf=.008,Ne={Ambient:0,Normal:1,Critical:2},Vf=.11,ul=[1,.62,.42,.3,.22],Xf=.5,Oo=.7,fl=1.2,op=3,ml=new WeakMap;function Kf(e){const t=ml.get(e);if(t)return t;const a=2048,o=new Float32Array(a);for(let n=0;n<a;n++){const s=(n/(a-1)*2-1)*op,r=Math.abs(s),i=r<=Oo?r:Oo+(fl-Oo)*Math.tanh((r-Oo)/(fl-Oo));o[n]=Math.sign(s)*i}return ml.set(e,o),o}function Zf(e,t,a=!0){const o=e.createGain();o.gain.value=1;let n=null;if(a)try{n=e.createGain(),n.gain.value=1;const c=e.createGain();c.gain.value=Xf,n.connect(Bf(e)).connect(c).connect(o)}catch{n=null}const s=e.createGain();s.gain.value=1/op;const r=e.createWaveShaper();r.curve=Kf(e),r.oversample="2x";const i=e.createGain();return i.gain.value=0,o.connect(s).connect(r).connect(i).connect(t??e.destination),{input:o,wetIn:n,limiter:r,master:i}}function Qf(e){const t=Math.max(0,Math.min(1,e));return Math.pow(t,1.8)*Uf}function Jf(){const e=typeof navigator<"u"?navigator.userActivation:void 0;return e===void 0||e.isActive===!0}class em{ctx=null;chain=null;state="idle";failure=null;volume=.8;muted=!1;maxVoices;persist;reverb;injected;injectedDestination;offline;voices=[];retrigger=new Map;listeners=new Set;virtualTime=0;counters={started:0,droppedBudget:0,droppedThrottle:0,droppedNotRunning:0};analyser=null;gestureBound=!1;constructor(t={}){this.maxVoices=t.maxVoices??Wf,this.persist=t.persist??!0,this.reverb=t.reverb??!0,this.injected=t.context??null,this.injectedDestination=t.destination??null,this.offline=!!this.injected&&typeof OfflineAudioContext<"u"&&this.injected instanceof OfflineAudioContext,this.loadSettings(),this.injected?(this.attachContext(this.injected),this.offline&&(this.state="running")):(this.bindGestureUnlock(),this.bindVisibility())}setVolume(t){this.volume=Math.max(0,Math.min(1,Number.isFinite(t)?t:0)),this.applyMasterGain(.02),this.saveSettings(),this.emit()}getVolume(){return this.volume}setMuted(t){this.muted=!!t,this.applyMasterGain(.015),this.saveSettings(),this.emit()}isMuted(){return this.muted}toggleMuted(){return this.setMuted(!this.muted),this.muted}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}getState(){return this.state}getFailure(){return this.failure}activeVoices(){return this.prune(this.now()),this.voices.length}unlock(){if(this.state==="failed"||this.offline||!this.ctx&&!Jf())return;const t=this.ensureContext();t&&(typeof t.resume=="function"&&t.state!=="running"&&t.resume().then(()=>this.syncState(),()=>this.syncState()),this.syncState())}bindGestureUnlock(){if(this.gestureBound||typeof window>"u")return;this.gestureBound=!0;const t=["pointerdown","touchend","keydown","click"],a=()=>{if(this.unlock(),this.state==="running"||this.state==="failed")for(const o of t)window.removeEventListener(o,a,!0)};for(const o of t)window.addEventListener(o,a,!0)}bindVisibility(){typeof document>"u"||document.addEventListener("visibilitychange",()=>{const t=this.ctx;if(!(!t||typeof t.suspend!="function")){try{document.hidden?t.suspend().catch(()=>{}):this.state!=="idle"&&t.resume().catch(()=>{})}catch{}this.syncState()}})}ensureContext(){if(this.ctx)return this.ctx;if(this.state==="failed")return null;try{const t=typeof AudioContext<"u"?AudioContext:globalThis.webkitAudioContext;if(!t)return this.fail("Web Audio API unavailable"),null;const a=new t({latencyHint:"interactive"});return this.attachContext(a),a}catch(t){return this.fail(String(t)),null}}attachContext(t){this.ctx=t;try{this.chain=Zf(t,this.injectedDestination??void 0,this.reverb),this.applyMasterGain(0),this.syncState()}catch(a){this.fail(String(a))}}syncState(){if(this.state==="failed")return;const t=this.state;this.ctx?this.offline?this.state="running":this.state=this.ctx.state==="running"?"running":"suspended":this.state="idle",t!==this.state&&this.emit()}fail(t){this.state="failed",this.failure=t,console.warn("[audio] disabled:",t),this.emit()}play(t,a={}){try{return this.playInner(t,a)}catch(o){return this.failure||(this.failure=String(o),console.warn("[audio] sound failed:",o)),!1}}playInner(t,a){if(this.state==="failed")return!1;if(this.state!=="running"||!this.ctx||!this.chain)return this.counters.droppedNotRunning++,!1;const o=this.now();this.prune(o);const n=a.priority??Ne.Normal;let s=1,r=1;if(a.key){const x=this.retrigger.get(a.key),k=x&&o-x.at<Vf?x.count+1:0;if(this.retrigger.set(a.key,{at:o,count:k}),k>=ul.length)return this.counters.droppedThrottle++,!1;s=ul[k],r=1+k*.045}if(this.voices.length>=this.maxVoices){if(n<Ne.Critical&&!this.steal(n))return this.counters.droppedBudget++,!1;n>=Ne.Critical&&this.voices.length>=this.maxVoices&&this.steal(Ne.Critical)}const i=this.ctx,c=Math.max(o,i.currentTime)+Yf+(a.delay??0),l=Math.max(0,(a.gain??1)*s),h=i.createGain();h.gain.value=l;const d=a.pan!==void 0&&typeof i.createStereoPanner=="function",p=Math.max(-1,Math.min(1,a.pan??0));let u=h;if(d){const x=i.createStereoPanner();x.pan.value=p,h.connect(x),u=x}u.connect(this.chain.input);let f=null;if(this.chain.wetIn)if(f=i.createGain(),f.gain.value=l,d){const x=i.createStereoPanner();x.pan.value=p,f.connect(x).connect(this.chain.wetIn)}else f.connect(this.chain.wetIn);const m=Xi(a.seed??Math.random()*4294967295|0),g={ctx:i,dest:h,wet:f??void 0,when:c,rng:m};let w=0;try{w=t(g)||0}catch(x){throw h.disconnect(),f?.disconnect(),x}const y=c+w/r+.05;if(this.voices.push({node:h,wet:f,end:y,priority:n}),this.counters.started++,!this.offline){const x=Math.max(30,(y-i.currentTime)*1e3+40);setTimeout(()=>this.prune(this.now()),x)}return!0}steal(t){let a=-1;for(let n=0;n<this.voices.length;n++)if(this.voices[n].priority<t){a=n;break}if(a<0)return!1;const[o]=this.voices.splice(a,1);return this.release(o),!0}prune(t){for(let a=this.voices.length-1;a>=0;a--)if(this.voices[a].end<=t){const[o]=this.voices.splice(a,1);this.release(o)}if(this.retrigger.size>64)for(const[a,o]of this.retrigger)t-o.at>1&&this.retrigger.delete(a)}release(t){try{t.node.gain.cancelScheduledValues(0),t.node.gain.value=0,t.node.disconnect()}catch{}if(t.wet)try{t.wet.gain.cancelScheduledValues(0),t.wet.gain.value=0,t.wet.disconnect()}catch{}}now(){return this.ctx?Math.max(this.ctx.currentTime,this.virtualTime):this.virtualTime}setVirtualTime(t){this.virtualTime=t,this.prune(t)}tap(){if(!this.ctx||!this.chain)return null;if(this.analyser)return this.analyser;try{const t=this.ctx.createAnalyser();return t.fftSize=2048,t.smoothingTimeConstant=0,this.chain.master.connect(t),this.analyser=t,t}catch{return null}}connectTap(t){if(!this.ctx||!this.chain)return!1;try{return this.chain.master.connect(t),!0}catch{return!1}}get context(){return this.ctx}get busInput(){return this.chain?.input??null}applyMasterGain(t){if(!this.chain||!this.ctx)return;const a=this.muted?0:Qf(this.volume),o=this.chain.master.gain;try{if(t>0&&!this.offline){const n=this.ctx.currentTime;o.cancelScheduledValues(n),o.setValueAtTime(o.value,n),o.linearRampToValueAtTime(a,n+t)}else o.cancelScheduledValues(0),o.value=a}catch{o.value=a}}loadSettings(){if(!(!this.persist||typeof localStorage>"u"))try{const t=localStorage.getItem(dl);if(t!==null){const a=Number(t);Number.isFinite(a)&&(this.volume=Math.max(0,Math.min(1,a)))}this.muted=localStorage.getItem(pl)==="1"}catch{}}saveSettings(){if(!(!this.persist||typeof localStorage>"u"))try{localStorage.setItem(dl,String(this.volume)),localStorage.setItem(pl,this.muted?"1":"0")}catch{}}emit(){for(const t of this.listeners)try{t()}catch{}}}function gl(e,t,a,o,n,s,r=ra){const i=re[t].weapons.length,c=Ut(r);return{role:e,characterId:t,level:c,damageMul:ii(c),x:a.x,y:a.y,hp:o,maxHp:o,size:n,facing:{x:s.x,y:s.y},status:{slowedUntil:-1/0,stunnedUntil:-1/0},alive:!0,lastUsed:new Array(i).fill(-1/0),hazardTimers:[],fogTimer:0,regenTimer:0,trailDropTimer:0,detourSign:0,lastDamagedAt:-1/0,terrainSlowFactor:1,concealed:!1}}function oa(e){return e==="player"?"enemy":"player"}function Zi(e){return Math.max(0,Math.min(1,(e-2)/16))}function tm(e){const t=Zi(e);return a=>{const o=J(a.rng,70),n=P(a,{filter:"bandpass",freq:[2600*o,620*o],q:1.1,peak:.26+t*.12,attack:.006,duration:.13,drive:1.5,wet:.14}),s=W(a,{type:"sine",freq:[440*o,170*o],peak:.16+t*.12,attack:.004,duration:.11,drive:1.9,voices:2,detuneCents:14,wet:.1});return B(n,s)}}function am(e,t){const a=Zi(e),o=Math.min(1,t/180);return n=>{const s=J(n.rng,55),r=.2+o*.1,i=P(n,{filter:"bandpass",freq:[420*s,(1900-o*600)*s],q:2.2,peak:.44+a*.2,attack:.05+o*.03,hold:.12,duration:r,drive:1.6,wet:.2}),c=W(n,{type:"sawtooth",freq:[200*s,88*s],lowpass:[900,300],peak:.2+a*.12,attack:.02,duration:r*.8,drive:1.8,voices:2,detuneCents:18,wet:.12});return B(i,c)}}function om(){const e=[523.25,659.25,783.99];return t=>{const a=J(t.rng,25);e.forEach((n,s)=>{W({...t,when:t.when+s*.06},{type:"triangle",freq:n*a,peak:.2,attack:.012,hold:.2,duration:.3,voices:2,detuneCents:9,wet:.42})});const o=P(t,{filter:"highpass",freq:[3e3,7e3],q:.8,peak:.07,attack:.08,duration:.42,wet:.5});return B(.3+e.length*.06,o)}}function nm(){return e=>{const t=J(e.rng,30),a=W(e,{type:"sine",freq:[130*t,30*t],peak:.9,attack:.004,hold:.08,duration:.78,drive:3.4,voices:3,detuneCents:22,wet:.3}),o=P(e,{filter:"lowpass",freq:[2200,140],q:1.4,peak:.55,attack:.01,duration:.62,drive:2.2,wet:.34}),n=me(e,{peak:.62,freq:3e3,snap:1900,snapMs:26}),s=Re(e,{count:10,spread:.42,freq:[900,4200],peak:.16,q:5,wet:.4});return B(a,o,n,s)}}function sm(e){const t=Zi(e);return a=>{const o=J(a.rng,60),n=me(a,{peak:.66-t*.14,freq:3900-t*1100,snap:2700-t*800,snapMs:11+t*7}),s=W(a,{type:"sine",freq:[(230-t*80)*o,(62-t*22)*o],peak:.48+t*.34,attack:.0018,duration:.11+t*.22,drive:2+t*1.5,voices:2,detuneCents:16,wet:.16}),r=t>.12?W(a,{type:"sine",freq:[(118-t*38)*o,(44-t*12)*o],peak:.14+t*.38,attack:.004,duration:.1+t*.2,drive:1.5,wet:.1}):0,i=P(a,{filter:"bandpass",freq:[1700*o,470*o],q:1.5,peak:.24+t*.2,attack:.0012,duration:.07+t*.1,drive:1.9,wet:.22}),c=P(a,{filter:"bandpass",freq:[1900,640],q:.9,peak:.05+t*.05,attack:.018,duration:.16+t*.22,wet:.6}),l=Ki(a,{peak:.1+(1-t)*.06,freq:[8600-t*2200,3400-t*900],duration:.06+t*.05,drops:5,wet:.28});return B(n,s,r,i,c,l)}}function rm(e){const t=e<.3;return a=>{const o=J(a.rng,45),n=he(a.rng,.9,1.15),s=he(a.rng,285,360),r=W(a,{type:"sawtooth",freq:[s*o,s*o*.4],lowpass:[he(a.rng,1180,1620),260],peak:.3,attack:.004,duration:(t?.34:.22)*n,drive:he(a.rng,2.1,2.8),voices:2,detuneCents:20,wet:.18}),i=he(a.rng,830,1150),c=P(a,{filter:"lowpass",poles:24,freq:[i,190],q:.9,peak:.2,attack:.002,duration:.16*n,drive:1.6,wet:.24}),l=me(a,{peak:.2,freq:3600,wet:.16}),h=Re(a,{count:4,spread:.03,grainMs:[3,8],freq:[he(a.rng,2700,3400),he(a.rng,6e3,9e3)],q:4,peak:.24,decay:.3,wet:.2}),d=Ki(a,{peak:.13,freq:[he(a.rng,7600,9400),he(a.rng,2800,3600)],duration:he(a.rng,.05,.08),drops:5,wet:.26}),p=t?W(a,{type:"sine",freq:[he(a.rng,88,104),32],peak:.55,attack:.006,duration:.3*n,drive:2.6,wet:.16}):0;return B(r,c,l,h,d,p)}}function im(){return e=>{const t=J(e.rng,30),a=me(e,{peak:.2,freq:5400,snap:3800,snapMs:6}),o=W(e,{type:"triangle",freq:[620*t,1560*t],ring:[132,96],peak:.34,attack:.022,duration:.26,wet:.34}),n=W(e,{type:"sine",freq:[1880*t,2520*t],peak:.1,attack:.03,duration:.34,wet:.55});return B(a,o,n)}}function cm(){return e=>{const t=J(e.rng,40),a=W(e,{type:"sawtooth",freq:[440*t,58*t],lowpass:[2600,240],peak:.42,attack:.006,duration:.6,drive:2.2,voices:2,detuneCents:24,wet:.26}),o=P(e,{filter:"lowpass",freq:[3200,200],q:1.1,peak:.34,attack:.004,duration:.44,drive:1.5,wet:.4}),n=W(e,{type:"sine",freq:[150*t,30*t],peak:.7,attack:.003,duration:.42,drive:3,voices:2,detuneCents:14,wet:.2});return B(a,o,n)}}function lm(){const e=[392,523.25,659.25];return t=>{const a=J(t.rng,20);return e.forEach((o,n)=>{W({...t,when:t.when+n*.05},{type:"triangle",freq:o*a,peak:.26,attack:.01,duration:.24,voices:2,detuneCents:8,wet:.34})}),.24+e.length*.05}}function hm(){return e=>{const t=P(e,{filter:"lowpass",poles:24,freq:[420,110],q:1.2,peak:.34,attack:.05,duration:.4,drive:2,wet:.35}),a=P(e,{filter:"bandpass",freq:[1400,2600],q:.7,peak:.1,attack:.08,duration:.42,wet:.55});return B(t,a)}}const dm=2.1,np=1.5,ar=.55;function pm(){return e=>{const t=dm,a={attack:ar,hold:(np-ar)/(t-ar),duration:t},o=W(e,{type:"sine",freq:118*J(e.rng,25),peak:.026,voices:3,detuneCents:26,drive:1.6,...a,wet:.25}),n=P(e,{filter:"bandpass",freq:[he(e.rng,900,1500),he(e.rng,1700,2500)],q:.45,peak:.055,loop:!0,tremolo:{rate:[.55,.85],depth:.3},...a,wet:.4}),s=P(e,{filter:"highpass",poles:24,freq:[6400,8200],q:.7,peak:.009,loop:!0,...a,wet:.5}),r=he(e.rng,.3,t-.6),i={...e,when:e.when+r},c=Math.floor(e.rng()*4);let l=0;if(c===0)l=Cs(i,{freq:he(e.rng,620,980),duration:.42,peak:.085,attack:.0015,wet:.62,modes:[{ratio:1,gain:1,decay:1},{ratio:2.71,gain:.6,decay:.5},{ratio:4.63,gain:.34,decay:.3}]});else if(c===1){const h=me(i,{peak:.1,freq:3400,snap:900,snapMs:14,wet:.5}),d=he(e.rng,.11,.19),p=me({...i,when:i.when+d},{peak:.075,freq:3100,snap:820,snapMs:12,wet:.5});l=B(h,d+p)}else c===2?l=P(i,{filter:"bandpass",freq:[he(e.rng,2800,3600),he(e.rng,5600,7400)],q:.8,peak:.04,attack:.09,duration:.55,wet:.7}):l=ss(i,{count:3,spread:.16,freq:[4200,11e3],peak:.022,pingMs:[8,20],bend:.94,wet:.6});return B(o,n,s,r+l)}}function um(){return e=>{const t=P(e,{filter:"highpass",freq:[2600,5200],q:.8,peak:.18,attack:.01,duration:.26,wet:.3}),a=Re(e,{count:4,spread:.2,freq:[2500,6e3],peak:.1,q:7,wet:.35});return B(t,a)}}function fm(){return e=>{const t=P(e,{filter:"lowpass",freq:[1400,260],q:3.2,peak:.2,attack:.008,duration:.15,drive:1.8,wet:.2}),a=W(e,{type:"sine",freq:[180,84],peak:.14,duration:.11,drive:2.2,wet:.14});return B(t,a)}}function mm(){return e=>{const t=J(e.rng,90),a=me(e,{peak:.26,freq:2400,snap:1200,snapMs:8}),o=W(e,{type:"sine",freq:[150*t,66*t],peak:.22,duration:.09,drive:2,wet:.24});return B(o,a)}}function gm(e){const t=[523.25,587.33,659.25,698.46,783.99],a=t[Math.max(0,Math.min(t.length-1,5-e))];return o=>{const n=W(o,{type:"triangle",freq:a,peak:.34,attack:.004,hold:.25,duration:.16,voices:2,detuneCents:7,wet:.3}),s=P(o,{filter:"highpass",freq:3800,peak:.12,duration:.015,wet:.12});return B(n,s)}}function wm(){const e=[523.25,659.25,1046.5];return t=>{e.forEach((o,n)=>{W({...t,when:t.when+n*.07},{type:"square",freq:o,lowpass:[3200,1800],peak:.22,attack:.006,hold:.3,duration:.34,voices:2,detuneCents:10,wet:.3})});const a=P(t,{filter:"bandpass",freq:[500,4e3],q:.9,peak:.16,attack:.14,duration:.2,wet:.35});return B(.34+e.length*.07,a)}}function ym(){return e=>{const t=J(e.rng,18);[587.33,392].forEach((n,s)=>{W({...e,when:e.when+s*.16},{type:"triangle",freq:n*t,peak:.26,attack:.008,hold:.25,duration:.38,voices:2,detuneCents:11,wet:.34})});const a=W(e,{type:"sine",freq:[196*t,98*t],peak:.34,attack:.02,hold:.3,duration:.72,drive:2.2,voices:2,detuneCents:15,wet:.28}),o=P(e,{filter:"bandpass",freq:[2200,620],q:.8,peak:.12,attack:.06,duration:.66,wet:.55});return B(.38+.16,a,o)}}function bm(e){const t=e?[523.25,659.25,783.99,1046.5]:[659.25,587.33,493.88,392];return a=>(t.forEach((o,n)=>{W({...a,when:a.when+n*.1},{type:e?"square":"sawtooth",freq:o,lowpass:e?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.4,voices:2,detuneCents:e?9:16,wet:.34})}),.4+t.length*.1)}function xm(e){const t=e?[523.25,659.25,1046.5]:[587.33,493.88,392],a=.62;return o=>{const n=(i,c)=>(P({...o,when:o.when+i},{filter:"bandpass",freq:2900,q:10,peak:.7,attack:.012,hold:.45,duration:c,tremolo:{rate:24,depth:.7},wet:.06}),i+c);n(0,.26);const s=n(.36,.22),r=W(o,{type:"sawtooth",freq:[150,132],lowpass:[1100,420],peak:.14,attack:.01,hold:.5,duration:.58,drive:1.8,voices:2,detuneCents:22,wet:.2});return t.forEach((i,c)=>{W({...o,when:o.when+a+c*.1},{type:e?"square":"sawtooth",freq:i,lowpass:e?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.36,voices:2,detuneCents:e?9:16,wet:.34})}),B(s,r,a+(t.length-1)*.1+.36)}}function vm(){return e=>{const t=W(e,{type:"triangle",freq:[900,620],peak:.22,duration:.055,drive:1.6,wet:.16}),a=P(e,{filter:"highpass",freq:5e3,peak:.1,duration:.012});return B(t,a)}}function yn(e,t,a,o,n){return Re(e,{count:12,spread:t,grainMs:[5,14],freq:[2300,4600],freqShift:[a,o],q:3.2,peak:n,decay:.4,drive:1.5,wet:.3})}function _o(e,t,a){return Re(e,{count:7,spread:t,grainMs:[2,5],freq:[5600,11e3],q:9,peak:a,decay:.25,wet:.34})}const km={Disc:{cast(e){const t=J(e.rng,55),a=yn(e,.3,1.35,.62,.3),o=_o(e,.22,.13),n=P(e,{filter:"bandpass",freq:[700*t,1800*t],q:1.6,peak:.34,attack:.05,hold:.1,duration:.3,drive:1.4,wet:.3});return B(a,o,n)},impact(e){const t=me(e,{peak:.46,freq:3400,snap:1600,snapMs:10,wet:.1}),a=P(e,{filter:"bandpass",freq:[2400,950],q:2,peak:.3,attack:.003,duration:.07,drive:1.9,wet:.24}),o=yn(e,.2,1.3,.68,.3),n=_o(e,.14,.46),s=W(e,{type:"sine",freq:[190,72],peak:.46,attack:.0022,duration:.1,drive:2.6,voices:2,detuneCents:15,wet:.14});return B(t,a,o,n,s)}},Roll:{cast(e){const t=J(e.rng,60);return P(e,{filter:"bandpass",freq:[900*t,2100*t],q:2.4,peak:.36,attack:.04,duration:.2,drive:1.5,wet:.3})},impact(e){const t=yn(e,.26,.7,1.5,.32),a=_o(e,.2,.44),o=P(e,{filter:"bandpass",freq:[1100,3400],q:7,peak:.3,attack:.02,duration:.26,drive:1.6,wet:.32}),n=W(e,{type:"sine",freq:[230,124],peak:.18,attack:.004,duration:.08,drive:2.2,wet:.12});return B(t,a,o,n)}},Swarm:{cast(e){const t=J(e.rng,70),a=P(e,{filter:"bandpass",freq:[1400*t,3e3*t],q:4,peak:.36,attack:.025,duration:.17,drive:1.7,wet:.3}),o=_o(e,.16,.16);return B(a,o)},impact(e){const t=me(e,{peak:.36,freq:4200,snap:2200,snapMs:7,wet:.1}),a=yn(e,.13,1.2,.8,.24),o=_o(e,.1,.3),n=W(e,{type:"sine",freq:[250,118],peak:.18,attack:.002,duration:.07,drive:2.4,wet:.12});return B(t,a,o,n)}}};function bn(e,t,a,o){return Cs(e,{freq:t,duration:a,peak:o,attack:.0012,drive:1.4,wet:.34,modes:[{ratio:1,gain:1,decay:1},{ratio:2.06,gain:.82,decay:.82},{ratio:3.18,gain:.6,decay:.6},{ratio:4.34,gain:.4,decay:.42},{ratio:5.52,gain:.3,decay:.3}]})}function wl(e,t,a){return Re(e,{count:7,spread:t,grainMs:[2,5],freq:[4200,12e3],q:10,peak:a,decay:.3,wet:.12})}function Mm(e,t,a){return ss(e,{count:4,spread:t,freq:[5e3,12500],peak:a,pingMs:[5,13],bend:1.08,wet:.2})}const Sm={Candy:{cast(e){const t=J(e.rng,70),a=P(e,{filter:"bandpass",freq:[1400*t,3200*t],q:2,peak:.34,attack:.022,duration:.13,wet:.28}),o=bn(e,1900*t,.11,.2),n=wl(e,.07,.1);return B(a,o,n)},impact(e){const t=J(e.rng,60),a=me(e,{peak:.5,freq:5400,snap:3200,snapMs:8,wet:.12}),o=bn(e,2450*t,.4,.56),n=wl(e,.22,.9),s=Mm(e,.16,.74),r=bn({...e,when:e.when+.09},2450*t*1.02,.26,.22),i=bn({...e,when:e.when+.175},2450*t*1.045,.17,.11),c=W(e,{type:"sine",freq:[280*t,130*t],peak:.42,attack:.0018,duration:.1,drive:3.2,wet:.12});return B(a,o,n,s,.09+r,.175+i,c)}}};function or(e,t,a){const o=J(e.rng,60),n=me(e,{peak:t,freq:(4200+a*1800)*o,snap:(2600+a*900)*o,snapMs:7,wet:.05}),s=P(e,{filter:"bandpass",freq:[(2600+a*800)*o,(5200+a*1600)*o],q:3.4,peak:t*.8,attack:5e-4,duration:.022,drive:2.2,wet:.1}),r=P(e,{filter:"highpass",poles:24,freq:[(7e3+a*1800)*o,(4600+a*1200)*o],q:.7,peak:t*1.5,attack:4e-4,duration:.024,wet:.12});return B(n,s,r)}function yl(e,t){const a=J(e.rng,70),o=P(e,{filter:"lowpass",poles:24,freq:[(1800+t*600)*a,(420-t*110)*a],q:3.6,peak:.26+t*.18,attack:.012+t*.01,duration:.15+t*.12,drive:2,wet:.24}),n=W(e,{type:"sine",freq:[(180-t*45)*a,(58-t*16)*a],peak:.36+t*.3,attack:.006,duration:.13+t*.1,drive:3.2,voices:2,detuneCents:16,wet:.14}),s=P(e,{filter:"bandpass",freq:[700*a,1500*a],q:6,peak:.12+t*.08,attack:.03,duration:.2+t*.14,wet:.36}),r=Re(e,{count:Math.round(5+t*5),spread:.12+t*.06,grainMs:[3,8],freq:[3800,10600],q:7,peak:.5+t*.3,decay:.3,wet:.28});return B(o,n,s,r)}const nr=.045,Em={Tackle:{cast(e){const t=J(e.rng,40),a=P(e,{filter:"bandpass",freq:[420*t,1900*t],q:2,peak:.44,attack:.07,hold:.1,duration:.26,drive:1.6,wet:.3}),o=W(e,{type:"sine",freq:[120*t,240*t],peak:.28,attack:.08,duration:.24,drive:2.4,voices:2,detuneCents:14,wet:.16});return B(a,o)},impact(e){const t=or(e,.88,.35),a=yl({...e,when:e.when+nr},1);return B(t,nr+a)}},Hatch:{cast(e){const t=or(e,.5,0),a=W({...e,when:e.when+.05},{type:"triangle",freq:[1500,2400],peak:.3,attack:.006,duration:.09,drive:2.2,wet:.32}),o=W({...e,when:e.when+.15},{type:"triangle",freq:[1800,2700],peak:.24,attack:.005,duration:.07,drive:2.2,wet:.32});return B(t,.05+a,.15+o)},impact(e){const t=me(e,{peak:.4,freq:5400,snap:3200,snapMs:6,wet:.1}),a=P(e,{filter:"highpass",poles:24,freq:[8200,5600],q:.7,peak:.2,attack:4e-4,duration:.005,wet:.12}),o=W(e,{type:"triangle",freq:[2100,1250],peak:.22,attack:.0015,duration:.05,drive:2.4,wet:.2}),n=W({...e,when:e.when+.035},{type:"triangle",freq:[1700,2600],peak:.18,attack:.005,duration:.06,drive:2,wet:.3}),s=W(e,{type:"sine",freq:[240,120],peak:.22,attack:.002,duration:.06,drive:2.2,wet:.1});return B(t,a,o,.035+n,s)}},Shards:{cast(e){const t=J(e.rng,80),a=P(e,{filter:"highpass",freq:[1900*t,3800*t],q:1.1,peak:.32,attack:.016,duration:.11,wet:.26}),o=Re(e,{count:4,spread:.08,grainMs:[3,6],freq:[3400,7e3],q:8,peak:.13,wet:.28});return B(a,o)},impact(e){const t=nr*.62,a=or(e,.66,1),o=yl({...e,when:e.when+t},.18);return B(a,t+o)}}};function bl(e,t,a,o){const n=J(e.rng,70),s=W(e,{type:"sine",freq:[(170-t*55)*n,(52-t*16)*n],peak:o,attack:.003,duration:a,drive:3+t*1.2,voices:2,detuneCents:18,wet:.12}),r=P(e,{filter:"lowpass",poles:24,freq:[(760-t*220)*n,(150-t*45)*n],q:1.2,peak:o*.45,attack:.002,duration:a*.7,drive:2.2,wet:.2}),i=P(e,{filter:"bandpass",freq:[(2400-t*400)*n,(1450-t*300)*n],q:.8,peak:o*.056,attack:.003,duration:a*.55,drive:1.4,wet:.3});return B(s,r,i)}const Tm={Smash:{cast(e){const t=J(e.rng,55),a=P(e,{filter:"lowpass",poles:24,freq:[1300*t,420*t],q:1.6,peak:.42,attack:.055,hold:.1,duration:.22,drive:1.7,wet:.22}),o=W(e,{type:"sawtooth",freq:[180*t,92*t],lowpass:[620,220],peak:.24,attack:.03,duration:.2,drive:2.2,voices:2,detuneCents:20,wet:.12});return B(a,o)},impact(e){const t=me(e,{peak:.44,freq:1500,snap:620,snapMs:22,wet:.1}),a=bl(e,1,.24,.86);return B(t,a)}},Tomato:{cast(e){const t=J(e.rng,80),a=P(e,{filter:"lowpass",poles:24,freq:[1500*t,520*t],q:2.1,peak:.36,attack:.014,duration:.14,drive:1.6,wet:.18}),o=W(e,{type:"sine",freq:[300*t,140*t],peak:.16,attack:.006,duration:.11,drive:2,wet:.1});return B(a,o)},impact(e){const t=me(e,{peak:.34,freq:1900,snap:780,snapMs:15,wet:.1}),a=bl(e,.55,.19,.62),o=P(e,{filter:"lowpass",poles:24,freq:[1e3,260],q:2.8,peak:.24,attack:.008,duration:.13,drive:1.8,wet:.26});return B(t,a,o)}},Lettuce:{cast(e){return P(e,{filter:"bandpass",freq:[900,2200],q:1.2,peak:.26,attack:.03,duration:.15,wet:.3})},impact(e){const t=P(e,{filter:"lowpass",poles:24,freq:[1600,380],q:1.4,peak:.3,attack:.006,duration:.16,drive:1.5,wet:.3}),a=W(e,{type:"triangle",freq:[240,96],peak:.3,attack:.012,hold:.2,duration:.3,drive:2.4,voices:2,detuneCents:22,wet:.18}),o=P(e,{filter:"bandpass",freq:[3400,1900],q:.9,peak:.042,attack:.004,duration:.1,wet:.34});return B(t,a,o)}},Onion:{cast(e){const t=J(e.rng,20),a=[174.61,220,261.63];a.forEach((n,s)=>{W({...e,when:e.when+s*.07},{type:"triangle",freq:n*t,peak:.28,attack:.016,hold:.22,duration:.34,drive:2.2,voices:2,detuneCents:11,wet:.4})});const o=P(e,{filter:"lowpass",poles:24,freq:[900,300],q:1,peak:.1,attack:.1,duration:.45,wet:.5});return B(.34+a.length*.07,o)}}};function xl(e,t,a,o,n){const s=J(e.rng,60),r=.075+o*.045,i=.1+o*.06,c=P(e,{filter:"bandpass",freq:[t*s,a*s],q:5.5,peak:n,attack:.012,duration:r,drive:1.8,wet:.2}),l=P({...e,when:e.when+r*.82},{filter:"bandpass",freq:[a*s,t*.72*s],q:5.5,peak:n*.9,attack:.008,duration:i,drive:1.8,wet:.24}),h=W(e,{type:"triangle",freq:[t*.34*s,a*.3*s],peak:n*.5,attack:.014,duration:r+i*.6,drive:2.4,voices:2,detuneCents:16,wet:.14});return B(c,r*.82+l,h)}function vl(e,t,a){const o=J(e.rng,70),n=me(e,{peak:.3+t*.1,freq:1700+a*700,snap:700+a*320,snapMs:16,wet:.1}),s=P(e,{filter:"lowpass",poles:24,freq:[(1400+a*600)*o,(280+a*120)*o],q:3.2,peak:.42+t*.2,attack:.005,duration:.15+t*.07,drive:2,wet:.26}),r=W(e,{type:"sine",freq:[(210-t*50)*o,(66-t*18)*o],peak:.6+t*.34,attack:.0025,duration:.16+t*.14,drive:2.6,voices:2,detuneCents:15,wet:.14}),i=P(e,{filter:"bandpass",freq:[(4200+a*2200)*o,(2100+a*900)*o],q:.75,peak:.23+a*.06,attack:.0015,duration:.05+a*.03,wet:.34});return B(n,s,r,i)}const Am={Mustard:{cast(e){return xl(e,520,1250,.15,.44)},impact(e){return vl(e,.42,1)}},Ketchup:{cast(e){return xl(e,340,780,1,.42)},impact(e){const t=vl(e,.3,0),a=P(e,{filter:"lowpass",poles:24,freq:[640,200],q:4,peak:.2,attack:.04,duration:.34,drive:1.6,wet:.4});return B(t,a)}},Slash:{cast(e){const t=J(e.rng,50);return P(e,{filter:"bandpass",freq:[700*t,2300*t],q:2,peak:.38,attack:.05,hold:.1,duration:.19,drive:1.5,wet:.26})},impact(e){const t=J(e.rng,45),a=.026,o=(l,h,d)=>me({...e,when:e.when+l},{peak:h,freq:d,snap:d*.3,snapMs:20,wet:.12}),n=o(0,.5,1400),s=o(a,.4,1200),r=P(e,{filter:"bandpass",freq:[900*t,340*t],q:2.4,peak:.34,attack:.0015,duration:.12,drive:2.1,wet:.24}),i=W(e,{type:"sine",freq:[200*t,58*t],peak:.95,attack:.002,duration:.24,drive:3,voices:2,detuneCents:17,wet:.14}),c=Re(e,{count:5,spread:.075,grainMs:[3,9],freq:[3e3,6400],q:4,peak:.38,decay:.3,wet:.3});return B(n,a+s,r,i,c)}}};function sr(e,t,a,o){const n=Cs(e,{freq:t,duration:a,peak:o,attack:8e-4,wet:.36,modes:[{ratio:1,gain:1,decay:1},{ratio:2.76,gain:.8,decay:.7},{ratio:5.4,gain:.5,decay:.44}]}),s=W(e,{type:"sine",freq:[t*1.02,t*.92],ring:t*1.37,peak:o*.7,attack:8e-4,duration:a*.8,wet:.4});return B(n,s)}function kl(e,t,a,o){return Re(e,{count:t,spread:a,grainMs:[2,5],freq:[5600,14e3],q:11,peak:o,decay:.3,wet:.3})}const Fm={Smash:{cast(e){const t=J(e.rng,50),a=P(e,{filter:"bandpass",freq:[600*t,2400*t],q:2.4,peak:.44,attack:.055,hold:.1,duration:.22,drive:1.5,wet:.3}),o=sr(e,2400*t,.12,.16);return B(a,o)},impact(e){const t=J(e.rng,45),a=me(e,{peak:.66,freq:6400,snap:4200,snapMs:6,wet:.14}),o=sr(e,5400*t,.34,.56),n=kl(e,9,.2,.8),s=W(e,{type:"sine",freq:[250*t,100*t],peak:.62,attack:.0015,duration:.12,drive:3,wet:.12}),r=P(e,{filter:"bandpass",freq:[7e3,12e3],q:1.2,peak:.26,attack:.025,duration:.16,wet:.5});return B(a,o,n,r,s)}},Giant:{impact(e){const t=J(e.rng,35),a=me(e,{peak:.72,freq:5800,snap:3600,snapMs:9,wet:.16}),o=sr(e,4550*t,.5,.64),n=kl(e,12,.36,.84),s=P(e,{filter:"bandpass",freq:[6e3,9500],q:1.4,peak:.14,attack:.06,duration:.58,wet:.6}),r=W(e,{type:"sine",freq:[230*t,78*t],peak:.52,attack:.0025,duration:.14,drive:3,voices:2,detuneCents:16,wet:.14});return B(a,o,n,s,r)}}};function rr(e,t,a){const o=J(e.rng,60),n=.38+a*.12,s=P(e,{filter:"bandpass",freq:[(560-a*200)*o,(2200-a*900)*o],q:1.5,peak:1.2,attack:.035,hold:.1,duration:n,drive:1.5,wet:.1*Math.min(1,16/t),tremolo:{rate:[t*.88,t],depth:.85}}),r=P(e,{filter:"highpass",freq:3600,peak:.16,attack:8e-4,duration:.018,wet:.1});return B(s,r)}const Rm={Dough:{cast(e){return rr(e,16,.85)},impact(e){const t=J(e.rng,70),a=P(e,{filter:"lowpass",poles:24,freq:[1100*t,190*t],q:1.1,peak:.34,attack:.004,duration:.13,drive:1.8,wet:.24}),o=me(e,{peak:.34,freq:1600,snap:660,snapMs:18,wet:.1}),n=W(e,{type:"sine",freq:[150*t,58*t],peak:.5,attack:.003,duration:.18,drive:2.8,voices:2,detuneCents:18,wet:.14}),s=P(e,{filter:"bandpass",freq:[2500,1700],q:.8,peak:.028,attack:.012,duration:.11,wet:.4});return B(a,o,n,s)}},Tomato:{cast(e){return rr(e,26,.25)},impact(e){const t=J(e.rng,65),a=P(e,{filter:"bandpass",freq:[1350*t,400*t],q:1.4,peak:.34,attack:.001,duration:.07,drive:2,wet:.2}),o=P(e,{filter:"lowpass",poles:24,freq:[900,240],q:2.6,peak:.3,attack:.008,duration:.15,drive:1.7,wet:.26}),n=me(e,{peak:.34,freq:2e3,snap:900,snapMs:13,wet:.1}),s=W(e,{type:"sine",freq:[200*t,72*t],peak:.62,duration:.18,drive:3.2,voices:2,detuneCents:16,wet:.14}),r=Ki(e,{peak:.15,freq:[8200,3e3],duration:.085,drops:6,wet:.34});return B(a,o,n,s,r)}},Cheese:{cast(e){return rr(e,12,.6)},impact(e){const t=J(e.rng,55),a=P(e,{filter:"bandpass",freq:[1400*t,480*t],q:2.2,peak:.3,attack:.01,duration:.2,drive:1.6,wet:.26}),o=W(e,{type:"triangle",freq:[300*t,110*t],peak:.32,attack:.012,hold:.25,duration:.34,drive:2.4,voices:2,detuneCents:20,wet:.18}),n=me(e,{peak:.26,freq:1800,snap:760,snapMs:16,wet:.1}),s=Re(e,{count:4,spread:.13,grainMs:[6,16],freq:[3200,5200],q:3.5,peak:.16,decay:.35,freqShift:[1,.62],wet:.34});return B(a,o,n,s)}}};function ir(e,t,a){return P(e,{filter:"bandpass",freq:[2800,5600],q:.85,peak:t,attack:a*.35,duration:a,wet:.55})}function cr(e,t,a,o){return Ho(e,{count:t,spread:a,freq:[1500,3100],rise:1.9,peak:o,wet:.42})}function lr(e,t,a,o){const n=J(e.rng,80),s=(2600-t*900)*n,r=(420-t*200)*n,i=P(e,{filter:"lowpass",freq:[s,r],poles:24,q:2.4+t*2,peak:o*.72,attack:.006+t*.012,duration:a,drive:1.8,wet:.3}),c=W(e,{type:"sine",freq:[(190-t*60)*n,(68-t*22)*n],peak:o*(.85+t*.55),attack:.005,duration:a*.75,drive:2.5,voices:2,detuneCents:16,wet:.14}),l=me(e,{peak:.22+t*.12,freq:1150,snap:460,snapMs:18,wet:.12});return B(i,c,l)}const Cm={Splash:{cast(e){const t=J(e.rng,90),a=P(e,{filter:"bandpass",freq:[900*t,260*t],q:3.4,peak:.46,attack:.012,duration:.12,drive:1.8,wet:.24}),o=Ho(e,{count:2,spread:.07,freq:[620,980],peak:.2,wet:.3});return B(a,o)},impact(e){const t=lr(e,.24,.2,.44),a=Ho(e,{count:4,spread:.16,freq:[480,900],peak:.14,wet:.3}),o=cr(e,7,.11,.2),n=ir(e,.11,.34);return B(t,a,o,n)}},Noodle:{cast(e){const t=J(e.rng,70),a=P(e,{filter:"bandpass",freq:[1500*t,520*t],q:2.2,peak:.42,attack:.01,duration:.16,drive:1.7,wet:.26}),o=W(e,{type:"sine",freq:[520*t,190*t],peak:.16,attack:.02,duration:.18,drive:2,wet:.16});return B(a,o)},impact(e){const t=P(e,{filter:"bandpass",freq:[1400,560],q:1.6,peak:.26,attack:.0015,duration:.05,drive:1.8,wet:.18}),a=lr(e,.35,.26,.44),o=Ho(e,{count:3,spread:.2,freq:[440,820],peak:.12,wet:.3}),n=cr(e,8,.14,.2),s=ir(e,.12,.42);return B(t,a,o,n,s)}},Dump:{cast(e){const t=J(e.rng,40);let a=0;const o=9;for(let s=0;s<o;s++){const r=s/o*.34+he(e.rng,-.012,.012),i=he(e.rng,320,1100)*t,c=he(e.rng,.05,.11);a=Math.max(a,r+c),P({...e,when:e.when+Math.max(0,r)},{filter:"lowpass",poles:24,freq:[i*2.2,i*.6],q:4.5,peak:.32,attack:.008,duration:c,drive:1.6,wet:.28})}const n=W(e,{type:"sine",freq:[150*t,70*t],peak:.3,attack:.12,duration:.4,drive:2,voices:2,detuneCents:14,wet:.2});return B(a,n)},impact(e){const t=lr(e,1,.42,.62),a=Ho(e,{count:7,spread:.34,freq:[380,820],peak:.16,wet:.34}),o=Re(e,{count:5,spread:.26,freq:[600,1500],peak:.1,q:4,wet:.3}),n=cr(e,7,.22,.14),s=ir(e,.15,.75);return B(t,a,o,n,s)}}};function hr(e,t,a,o,n){const s=J(e.rng,45),r=P(e,{filter:"bandpass",freq:[t*s,a*s],q:12,peak:n,attack:.004,duration:o,curve:"lin",freqCurve:"exp",wet:.18}),i=P({...e,when:e.when+o*.16},{filter:"bandpass",freq:[t*2*s,a*1.7*s],q:14,peak:n*.5,attack:.002,duration:o*.7,curve:"lin",wet:.22}),c=P({...e,when:e.when+o*.06},{filter:"bandpass",freq:[t*3.4*s,a*2.6*s],q:16,peak:n*.8,attack:.0015,duration:o*.45,curve:"lin",wet:.24});return B(r,o*.16+i,o*.06+c)}function xn(e,t,a,o){return Re(e,{count:t,spread:a,grainMs:[2,5],freq:[4200,12e3],q:6,peak:o,decay:.35,wet:.1})}const zm={Rice:{cast(e){const t=P(e,{filter:"highpass",freq:[2200,4200],q:1,peak:.3,attack:.012,duration:.09,wet:.2}),a=xn(e,7,.09,.2);return B(t,a)},impact(e){const t=xn(e,6,.075,.34),a=me(e,{peak:.3,freq:5600,snap:3600,snapMs:5,wet:.08}),o=W(e,{type:"sine",freq:[300,170],peak:.16,attack:.0015,duration:.05,drive:2,wet:.1});return B(t,a,o)}},Seaweed:{cast(e){const t=J(e.rng,60);return P(e,{filter:"bandpass",freq:[1600*t,3400*t],q:1.8,peak:.34,attack:.03,duration:.18,wet:.3})},impact(e){const t=J(e.rng,55),a=Re(e,{count:10,spread:.16,grainMs:[3,9],freq:[2800,6400],q:4.5,peak:.28,decay:.35,wet:.28}),o=P(e,{filter:"bandpass",freq:[3600*t,1600*t],q:7,peak:.26,attack:.012,duration:.24,wet:.32}),n=me(e,{peak:.32,freq:4200,snap:2400,snapMs:7,wet:.1}),s=W(e,{type:"sine",freq:[280,150],peak:.13,attack:.003,duration:.06,drive:2,wet:.12});return B(a,o,n,s)}},Fish:{cast(e){return hr(e,900,2600,.14,.3)},impact(e){const t=hr(e,2600,8200,.17,.72),a=P(e,{filter:"lowpass",poles:24,freq:[1100,340],q:2.4,peak:.16,attack:.006,duration:.09,drive:1.8,wet:.24}),o=xn(e,5,.1,.2),n=W(e,{type:"sine",freq:[230,96],peak:.42,attack:.0018,duration:.07,drive:2.4,wet:.12});return B(t,a,o,n)}},Catch:{cast(e){const t=J(e.rng,40),a=W(e,{type:"sine",freq:[140*t,300*t],peak:.3,attack:.1,duration:.3,drive:2.2,voices:2,detuneCents:14,wet:.24}),o=P(e,{filter:"bandpass",freq:[800*t,2400*t],q:2.2,peak:.34,attack:.08,duration:.28,wet:.32});return B(a,o)},impact(e){const t=hr(e,3e3,9e3,.15,.8),a=P({...e,when:e.when+.05},{filter:"lowpass",poles:24,freq:[1300,420],q:2.2,peak:.2,attack:.005,duration:.11,drive:1.9,wet:.26}),o=xn({...e,when:e.when+.04},8,.16,.28),n=me(e,{peak:.52,freq:5e3,snap:2800,snapMs:7,wet:.1}),s=W(e,{type:"sine",freq:[220,80],peak:.5,attack:.0018,duration:.09,drive:2.6,voices:2,detuneCents:14,wet:.14});return B(t,.05+a,.04+o,n,s)}}};function vn(e,t,a){const o=J(e.rng,70),n=P(e,{filter:"bandpass",freq:[3400*o,1500*o],q:1.2,peak:.55+t*.3,attack:6e-4,duration:.03,drive:2.2,wet:.12}),s=me(e,{peak:.44+t*.2,freq:5200*o,snap:(2900-t*500)*o,snapMs:8,wet:.1}),r=Re(e,{count:Math.round(7+t*6),spread:.14+t*.1,grainMs:[3,9-a*3],freq:[2700+a*900,9200+a*2600],q:7,peak:.34+t*.16,decay:.28,drive:1.6,wet:.26}),i=t*(1-a)>.02?W(e,{type:"sine",freq:[(190-t*60)*o,(72-t*22)*o],peak:.24+t*.26,attack:.002,duration:.08+t*.1,drive:2.6,voices:2,detuneCents:16,wet:.14}):0,c=P(e,{filter:"highpass",poles:24,freq:[8e3+a*2e3,5200+a*1200],q:.7,peak:.165+t*.065,attack:6e-4,duration:.014+t*.012,wet:.22});return B(n,s,r,i,c)}const Im={Filling:{cast(e){const t=J(e.rng,60),a=P(e,{filter:"bandpass",freq:[700*t,1800*t],q:2,peak:.44,attack:.03,duration:.16,drive:1.6,wet:.26}),o=Re(e,{count:4,spread:.1,freq:[3e3,7e3],peak:.11,q:8,wet:.28}),n=W(e,{type:"sine",freq:[260*t,130*t],peak:.14,duration:.1,drive:2,wet:.12});return B(a,o,n)},impact(e){return vn(e,.75,.3)}},Onion:{cast(e){const t=J(e.rng,80);return P(e,{filter:"highpass",freq:[1800*t,3400*t],q:1.1,peak:.36,attack:.02,duration:.12,wet:.28})},impact(e){const t=vn(e,.3,1),a=P(e,{filter:"bandpass",freq:[1100,420],q:1.6,peak:.26,attack:.006,duration:.1,drive:1.7,wet:.24});return B(t,a)}},Double:{cast(e){const t=J(e.rng,50),a=P(e,{filter:"bandpass",freq:[640*t,1700*t],q:2,peak:.44,attack:.025,duration:.15,drive:1.6,wet:.26}),o=P({...e,when:e.when+.055},{filter:"bandpass",freq:[820*t,2100*t],q:2,peak:.38,attack:.02,duration:.13,drive:1.6,wet:.26}),n=W(e,{type:"sine",freq:[240*t,118*t],peak:.16,duration:.12,drive:2,wet:.12});return B(a,.055+o,n)},impact(e){const t=vn(e,.85,.1),a=vn({...e,when:e.when+.055},.4,.85);return B(t,.055+a)}}};function kn(e,t,a,o){return Cs(e,{freq:t,duration:a,peak:o,attack:.001,drive:1.8,wet:.22,modes:[{ratio:1,gain:1,decay:1},{ratio:2.43,gain:.78,decay:.55},{ratio:3.71,gain:.5,decay:.34},{ratio:5.86,gain:.3,decay:.2}]})}function Ml(e,t,a){const o=P(e,{filter:"bandpass",freq:[1300,2800],q:1.5,peak:t,attack:.004,duration:a,wet:.34}),n=Re(e,{count:7,spread:a*.7,grainMs:[3,7],freq:[2600,8600],q:8,peak:t*.42,decay:.3,wet:.3}),s=P(e,{filter:"highpass",poles:24,freq:[6200,3800],q:.7,peak:t*.25,attack:.002,duration:a*.5,wet:.36});return B(o,n,s)}const Lm={Spray:{cast(e){const t=P(e,{filter:"bandpass",freq:[900,2800],q:1.1,peak:.34,attack:.02,duration:.14,wet:.28}),a=kn(e,190,.06,.2);return B(t,a)},impact(e){const t=me(e,{peak:.28,freq:4200,snap:2500,snapMs:8,wet:.12}),a=Ml(e,.34,.16),o=W(e,{type:"sine",freq:[260,120],peak:.3,attack:.002,duration:.09,drive:2,wet:.12});return B(t,a,o)}},Glass:{cast(e){const t=J(e.rng,70),a=P(e,{filter:"highpass",freq:[1600*t,3600*t],q:1.2,peak:.36,attack:.018,duration:.13,wet:.26}),o=Re(e,{count:3,spread:.07,grainMs:[3,7],freq:[4200,8e3],q:9,peak:.14,wet:.3});return B(a,o)},impact(e){const t=me(e,{peak:.62,freq:4600,snap:3400,snapMs:9,wet:.14}),a=kn(e,460,.13,.42),o=Re(e,{count:9,spread:.15,grainMs:[3,8],freq:[3200,9200],q:8,peak:.3,decay:.25,wet:.32}),n=ss(e,{count:3,spread:.1,freq:[5200,11e3],peak:.19,pingMs:[6,14],bend:.9,wet:.34});return B(t,a,o,n)}},Cap:{cast(e){const t=W(e,{type:"sine",freq:[520,900],peak:.4,attack:.001,duration:.05,drive:2.6,wet:.2}),a=me(e,{peak:.3,freq:4e3,snap:2400,snapMs:6,wet:.12});return B(t,a)},impact(e){const t=me(e,{peak:.52,freq:3800,snap:2300,snapMs:9,wet:.12}),a=kn(e,560,.2,.7),o=W(e,{type:"sine",freq:[150,68],peak:.17,attack:.003,duration:.11,drive:2.4,wet:.12}),n=ss(e,{count:2,spread:.05,freq:[4600,9e3],peak:.3,pingMs:[5,11],bend:.86,wet:.28});return B(t,a,o,n)}},Mega:{cast(e){const t=J(e.rng,35),a=P(e,{filter:"bandpass",freq:[500*t,2600*t],q:1.8,peak:.44,attack:.1,hold:.08,duration:.34,drive:1.5,wet:.34}),o=W(e,{type:"sine",freq:[90*t,200*t],peak:.34,attack:.12,duration:.36,drive:2.4,voices:2,detuneCents:14,wet:.2});return B(a,o)},impact(e){const t=me(e,{peak:.58,freq:3e3,snap:1500,snapMs:16,wet:.12}),a=Ml(e,.56,.42),o=kn(e,380,.24,.56),n=W(e,{type:"sine",freq:[140,46],peak:.62,attack:.003,duration:.3,drive:3.2,voices:2,detuneCents:18,wet:.16});return B(t,a,o,n)}}};function ct(e,t){const a={};for(const[o,n]of Object.entries(t))n&&(a[`${e}.${o}`]=n);return a}const Om={...ct("burrito",km),...ct("donut",Sm),...ct("egg",Em),...ct("hamburger",Tm),...ct("hotdog",Am),...ct("lollipop",Fm),...ct("pizza",Rm),...ct("soup",Cm),...ct("sushi",zm),...ct("taco",Im),...ct("waterbottle",Lm)};function Sl(e,t){return Om[`${e}.${t}`]}const _m=210,Dm=.78,sp=420,$m=.32,Nm=900,Pm=520,Hm=.45,qm=1.5,jm=1600,Bm=sp,Gm=.6180339887,Um=.42;class Go{constructor(t,a={}){this.engine=t,this.listenerRole=a.listener??"player"}listenerRole;lastFogSoundAt=-1/0;lastHealSoundAt=-1/0;ringFloored=!1;sawRingAboveFloor=!1;statusBefore={player:{stun:NaN,slow:NaN},enemy:{stun:NaN,slow:NaN}};statusWriterUnclaimed={player:{stun:!1,slow:!1},enemy:{stun:!1,slow:!1}};statusTrackable=!1;nextAmbienceAt=-1/0;ambienceChunk=0;lastCombatAt=-1/0;handleEvents(t,a){try{this.watchZone(a),this.watchAmbience(a),this.openStatusWindow(a);for(const o of t)this.handleEvent(o,a)}catch(o){console.warn("[audio] event dispatch failed:",o)}finally{this.closeStatusWindow(a)}}reset(){this.lastFogSoundAt=-1/0,this.lastHealSoundAt=-1/0,this.ringFloored=!1,this.sawRingAboveFloor=!1,this.statusBefore={player:{stun:NaN,slow:NaN},enemy:{stun:NaN,slow:NaN}},this.statusWriterUnclaimed={player:{stun:!1,slow:!1},enemy:{stun:!1,slow:!1}},this.statusTrackable=!1,this.nextAmbienceAt=-1/0,this.ambienceChunk=0,this.lastCombatAt=-1/0}static statusTimestamps(t){const a=t.status;return!a||typeof a.stunnedUntil!="number"||typeof a.slowedUntil!="number"?null:{stun:a.stunnedUntil,slow:a.slowedUntil}}openStatusWindow(t){const a=Go.statusTimestamps(t.player),o=Go.statusTimestamps(t.enemy);if(this.statusTrackable=a!==null&&o!==null,a===null||o===null)return;const n={player:a,enemy:o};for(const s of["player","enemy"]){const r=this.statusBefore[s];this.statusWriterUnclaimed[s]={stun:n[s].stun!==r.stun,slow:n[s].slow!==r.slow}}}closeStatusWindow(t){for(const a of["player","enemy"]){const o=Go.statusTimestamps(t[a]);o&&(this.statusBefore[a]=o)}}wasStatusRefused(t,a){return this.statusTrackable?this.statusWriterUnclaimed[t][a]?(this.statusWriterUnclaimed[t][a]=!1,!1):!0:!1}watchZone(t){if(!this.ringFloored&&t.phase==="playing"){if(t.safeRadius>Es+.5){this.sawRingAboveFloor=!0;return}this.sawRingAboveFloor&&(this.ringFloored=!0,this.engine.play(ym(),{priority:Ne.Critical}))}}watchAmbience(t){if(t.phase!=="playing"||t.elapsed<this.nextAmbienceAt)return;this.nextAmbienceAt=t.elapsed+np*1e3;const a=this.ambienceChunk*Gm%1;this.ambienceChunk++;const o=Math.hypot(t.player.x-t.enemy.x,t.player.y-t.enemy.y),n=t.elapsed-this.lastCombatAt<jm||o<Bm;this.engine.play(pm(),{gain:n?Hm:qm,pan:(a*2-1)*Um,priority:Ne.Ambient,key:"ambience"})}handleEvent(t,a){switch(t.type){case"countdown-tick":this.engine.play(gm(t.value),{priority:Ne.Critical});break;case"match-started":this.engine.play(wm(),{priority:Ne.Critical});break;case"match-ended":{const o=a.player.alive===!0&&a.enemy.alive===!0,n=t.winner===this.listenerRole;this.engine.play(o?xm(n):bm(n),{priority:Ne.Critical});break}case"weapon-fired":this.lastCombatAt=a.elapsed,this.playCast(t.fighterRole,t.weaponKey,a);break;case"hit-landed":this.lastCombatAt=a.elapsed,this.playHit(t,a);break;case"heal":{if(t.amount<=Cd&&a.elapsed-this.lastHealSoundAt<Pm)break;this.lastHealSoundAt=a.elapsed;const o=a[t.fighterRole];this.engine.play(lm(),{...this.place(o.x,o.y,a),key:"heal"});break}case"death":{const o=a[t.fighterRole];this.engine.play(cm(),{...this.place(o.x,o.y,a),priority:Ne.Critical,gain:t.fighterRole===this.listenerRole?1:void 0});break}case"projectile-destroyed":t.reason==="hit-cover"&&this.engine.play(mm(),{...this.place(t.x,t.y,a),priority:Ne.Ambient,key:"cover"});break}}playCast(t,a,o){const n=o[t],s=re[n.characterId].weapons.find(c=>c.key===a);if(!s)return;if(s.giantSlam){this.engine.play(nm(),{priority:Ne.Critical});return}const r=Sl(n.characterId,a)?.cast,i=r?this.wrapWeaponHook(r,s,n.characterId,s.damage):Wm(s);this.engine.play(i,{...this.place(n.x,n.y,o),key:`cast:${n.characterId}.${a}`})}playHit(t,a){const o=this.place(t.x,t.y,a),n=t.effect==="stun"&&this.wasStatusRefused(t.targetRole,"stun");if(t.source.kind==="fog"){if(a.elapsed-this.lastFogSoundAt<Nm)return;this.lastFogSoundAt=a.elapsed,this.engine.play(hm(),{priority:Ne.Ambient,key:"fog"});return}if(t.source.kind==="hazard"){this.engine.play(um(),{...o,priority:Ne.Ambient,key:"hazard"});return}if(t.source.kind==="trail"){this.engine.play(fm(),{...o,priority:Ne.Ambient,key:"trail"});return}const s=t.source.weaponKey,r=a[oa(t.targetRole)],i=re[r.characterId].weapons.find(h=>h.key===s),c=i?Sl(r.characterId,i.key)?.impact:void 0,l=c&&i?this.wrapWeaponHook(c,i,r.characterId,t.amount):sm(t.amount);if(this.engine.play(l,{...o,key:`impact:${r.characterId}.${s}`}),t.targetRole===this.listenerRole){const h=a[t.targetRole];this.engine.play(rm(h.hp/h.maxHp),{gain:.9,key:"hurt",priority:Ne.Normal})}n&&this.engine.play(im(),{...o,key:"shrug",priority:Ne.Normal})}wrapWeaponHook(t,a,o,n){return s=>t({...s,color:a.color,damage:n,weapon:a,characterId:o})}place(t,a,o){const n=o[this.listenerRole],s=t-n.x,r=a-n.y,i=Math.max(-1,Math.min(1,s/_m))*Dm,c=Math.hypot(s,r),l=Math.max($m,1/(1+c/sp));return{pan:i,gain:l}}}function Wm(e){return e.type==="melee"?am(e.damage,e.cone??90):e.type==="self"?om():tm(e.damage)}const dr="/food-arena/",El=`${dr.endsWith("/")?dr:`${dr}/`}audio/bounce-and-bash.mp3`,Tl=.45,rp="fa.audio.music";function Ym(){try{const e=localStorage.getItem(rp);if(e){const t=JSON.parse(e);return{volume:typeof t.volume=="number"?Math.min(1,Math.max(0,t.volume)):Tl,enabled:t.enabled!==!1}}}catch{}return{volume:Tl,enabled:!0}}function Al(e){try{localStorage.setItem(rp,JSON.stringify(e))}catch{}}class Vm{el=null;source=null;gain=null;state=Ym();wanted=!1;listeners=new Set;fadeToken=0;loadError=null;suppressed=!1;ensureGraph(){if(typeof document>"u")return!1;const t=Xe(),a=t.context,o=t.busInput;if(!a||!o||typeof a.createMediaElementSource!="function")return!1;if(this.source)return!0;if(!this.el){const n=document.createElement("audio");n.src=El,n.loop=!0,n.preload="auto",n.volume=1,n.crossOrigin="anonymous",n.addEventListener("error",()=>{const s=n.error?n.error.code:0;this.loadError=`music track failed to load (MediaError ${s}) from ${n.currentSrc||n.src}`,console.warn(`[audio] ${this.loadError}`),this.emit()},{once:!0}),this.el=n}try{return this.source=a.createMediaElementSource(this.el),this.gain=a.createGain(),this.gain.gain.value=this.state.enabled?this.state.volume:0,this.source.connect(this.gain).connect(o),!0}catch{return this.source=null,this.gain=null,!1}}play(){if(this.wanted=!0,this.suppressed||!this.state.enabled||!this.ensureGraph()||!this.el)return;const t=this.el.play();t&&typeof t.catch=="function"&&t.catch(()=>{})}pause(){this.wanted=!1,this.el?.pause()}onUnlock(){this.wanted&&this.play()}isPlaying(){return!!this.el&&!this.el.paused}getLoadError(){return this.loadError}getTrackUrl(){return this.el?this.el.src:El}getVolume(){return this.state.volume}setVolume(t){this.state.volume=Math.min(1,Math.max(0,t)),Al(this.state),this.applyGain(),this.emit()}isEnabled(){return this.state.enabled}setEnabled(t){this.state.enabled=t,Al(this.state),this.applyGain(),t?this.play():this.el?.pause(),this.emit()}fadeOut(t=.6){if(this.suppressed=!0,!this.el||this.el.paused)return;this.applyGain(0,t);const a=this.el;window.setTimeout(()=>{this.fadeToken===o&&a.pause()},t*1e3+40);const o=++this.fadeToken}fadeIn(t=.8){if(this.fadeToken++,this.suppressed=!1,!this.state.enabled||!this.ensureGraph()||!this.el)return;const a=this.el.paused;if(a){this.gain&&(this.gain.gain.value=0);const o=this.el.play();o&&typeof o.catch=="function"&&o.catch(()=>{})}this.applyGain(void 0,a?t:.25)}duck(t=.35){this.applyGain(this.state.volume*Math.min(1,Math.max(0,t)))}unduck(){this.applyGain()}onChange(t){return this.listeners.add(t),()=>this.listeners.delete(t)}applyGain(t,a=.08){if(!this.gain)return;const n=Xe().context,s=this.state.enabled?t??this.state.volume:0;try{if(n){const r=n.currentTime;this.gain.gain.cancelScheduledValues(r),this.gain.gain.setValueAtTime(this.gain.gain.value,r),this.gain.gain.linearRampToValueAtTime(s,r+a)}else this.gain.gain.value=s}catch{this.gain.gain.value=s}}emit(){for(const t of this.listeners)try{t()}catch{}}}let Mn=null;function Ue(){if(!Mn){Mn=new Vm;const e=Mn;Xe().onChange(()=>{Xe().getState()==="running"&&e.onUnlock()})}return Mn}let Sn=null;function Xe(){return Sn||(Sn=new em,Km(Sn)),Sn}function Xm(e){return new Go(Xe(),e)}const be={setVolume(e){Xe().setVolume(e)},getVolume(){return Xe().getVolume()},setMuted(e){Xe().setMuted(e)},isMuted(){return Xe().isMuted()},toggleMuted(){return Xe().toggleMuted()},onChange(e){return Xe().onChange(e)},getState(){return Xe().getState()},unlock(){Xe().unlock()},previewClick(){Xe().play(vm(),{key:"ui"})},music:{play(){Ue().play()},pause(){Ue().pause()},isPlaying(){return Ue().isPlaying()},getVolume(){return Ue().getVolume()},setVolume(e){Ue().setVolume(e)},isEnabled(){return Ue().isEnabled()},setEnabled(e){Ue().setEnabled(e)},fadeOut(e){Ue().fadeOut(e)},fadeIn(e){Ue().fadeIn(e)},duck(e){Ue().duck(e)},unduck(){Ue().unduck()},onChange(e){return Ue().onChange(e)},getLoadError(){return Ue().getLoadError()},getTrackUrl(){return Ue().getTrackUrl()}}};function Km(e){typeof window>"u"||(window.__audio={engine:e,tap:()=>e.tap(),connectTap:t=>e.connectTap(t),stats:()=>({state:e.getState(),activeVoices:e.activeVoices(),started:e.counters.started,droppedBudget:e.counters.droppedBudget,droppedThrottle:e.counters.droppedThrottle,droppedNotRunning:e.counters.droppedNotRunning,volume:e.getVolume(),muted:e.isMuted()}),get music(){const t=Ue();return{url:t.getTrackUrl(),error:t.getLoadError(),playing:t.isPlaying(),enabled:t.isEnabled()}}})}const T={ink:"#1a1224",cream:"#FFF3DE",white:"#FFFFFF",gold:"#F4A300",mustard:"#FFC93C",mustardHi:"#FFDD6B",ketchup:"#D62839",tomato:"#E63946",tomatoHi:"#FF9E9E",lettuce:"#7CB518",leafDark:"#4E8B2B",water:"#1E90D8",waterHi:"#5BC8F5",ice:"#8FE1FF",iceHi:"#BFF0FF",grape:"#7A4BC4",grapeHi:"#9B6BE0",grapeDark:"#5B2E8C",violet:"#B497D6",wood:"#8B4A22",woodHi:"#B4622A",meat:"#8B3A2E",meatHi:"#D98A72",patty:"#A05A2C",pattyDark:"#5A2E17",steel:"#DCD6E8",candy:"#FF6FA5",candyHi:"#FFB3D1",flame:"#FF7A2F"};function to(e,t,a,o=12,n=12){const s=[];for(let r=0;r<e*2;r++){const i=r%2===0?t:a,c=Math.PI*r/e-Math.PI/2;s.push(`${(o+i*Math.cos(c)).toFixed(2)} ${(n+i*Math.sin(c)).toFixed(2)}`)}return`M${s.join("L")}Z`}const Zm={patty:`
<ellipse cx="12" cy="14.3" rx="8.5" ry="4.5" fill="${T.pattyDark}"/>
<ellipse cx="12" cy="11.5" rx="8.5" ry="4.5" fill="${T.patty}"/>
<path d="M6.8 10.4 10 12.3M10.9 9.2 14.1 11.1M15.2 10.1 17.8 11.6" stroke="${T.pattyDark}" stroke-width="1.5"/>`,meat:`
<path d="M2.6 12.8c0-4.6 3.4-7.6 7.6-7.6 4.3 0 6.9 2.9 6.9 6.5 0 4.9-3.4 8.7-7.6 8.7-4.1 0-6.9-3.2-6.9-7.6z" fill="${T.meat}"/>
<path d="M6.8 9.8c2.6-.8 4.5.2 5.5 2.5" stroke="${T.meatHi}" stroke-width="1.8"/>
<path d="M14.4 7.6h4.8a1.5 1.5 0 0 1 0 3h-4.8a1.5 1.5 0 0 1 0-3z" fill="${T.cream}"/>
<circle cx="19.6" cy="7.2" r="1.9" fill="${T.cream}"/>
<circle cx="19.6" cy="10.6" r="1.9" fill="${T.cream}"/>`,tomato:`
<circle cx="12" cy="13.7" r="7.6" fill="${T.tomato}"/>
<path d="M12 7.2c-1.5-1.4-3.1-1.8-4.4-1.4.1 1.5.9 2.7 2.1 3.4M12 7.2c1.5-1.4 3.1-1.8 4.4-1.4-.1 1.5-.9 2.7-2.1 3.4z" fill="${T.leafDark}" stroke-width="1.4"/>
<path d="M12 3.4v3.6" stroke="${T.leafDark}" stroke-width="1.9"/>
<path d="M8.5 11a4.4 4.4 0 0 1 2.4-2.3" stroke="${T.tomatoHi}" stroke-width="1.7"/>`,lettuce:`
<path d="M12 20.8c-5.4 0-8.9-3.5-8.9-7.6 0-1.7 1.1-2.3 2.1-1.7.4-1.9 1.9-2.5 2.9-1.4.6-1.9 2.3-2.5 3.3-1.3.9-1.9 2.7-2.1 3.7-.6 1.2-1.1 2.9-.2 2.9 1.4 1.5-.2 2.7.9 2.5 2.3.6 3.9-2.7 8.2-8.2 8.2z" fill="${T.lettuce}"/>
<path d="M12 20.2v-8.4" stroke="${T.leafDark}" stroke-width="1.6"/>`,onion:`
<path d="M12 20.8c-4.1 0-6.8-2.7-6.8-6.4 0-3.5 2.7-6.6 6.8-8.6 4.1 2 6.8 5.1 6.8 8.6 0 3.7-2.7 6.4-6.8 6.4z" fill="#F4E6F7"/>
<path d="M12 6.2v14.6" stroke="${T.violet}" stroke-width="1.4"/>
<path d="M8.4 8.6c-1.1 2.5-1.3 5.6 0 9.1M15.6 8.6c1.1 2.5 1.3 5.6 0 9.1" stroke="${T.violet}" stroke-width="1.4"/>
<path d="M12 6.4c.4-2.1 1.9-3.2 3.6-3.4-.4 2.1-1.7 3.2-3.6 3.4z" fill="${T.lettuce}" stroke-width="1.3"/>`,candy:`
<ellipse cx="12" cy="12" rx="5.3" ry="4.7" fill="${T.candy}"/>
<path d="M6.8 10.1 2.7 7.2v9.6l4.1-2.9z" fill="${T.candyHi}"/>
<path d="M17.2 10.1 21.3 7.2v9.6l-4.1-2.9z" fill="${T.candyHi}"/>
<path d="M9.7 10.4a3 3 0 0 1 2-1.5" stroke="${T.cream}" stroke-width="1.6"/>`,swirl:`
<g fill="${T.water}">
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(120 12 12)"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(240 12 12)"/>
</g>
<circle cx="12" cy="12" r="1.8" fill="${T.cream}" stroke-width="1.4"/>`,chick:`
<path d="M10.4 4.4 11 1.8 12.8 4.2" stroke-width="1.8"/>
<ellipse cx="11.4" cy="15.8" rx="7.2" ry="6" fill="${T.mustardHi}"/>
<circle cx="11.6" cy="9.4" r="5.4" fill="${T.mustardHi}"/>
<path d="M16.6 8.2 22.2 10.2 16.6 12.2z" fill="${T.gold}"/>
<circle cx="13.4" cy="8.2" r="1.4" fill="${T.ink}" stroke="none"/>
<path d="M8.4 15a4 4 0 0 0 4.6 4.4" stroke="${T.gold}" stroke-width="1.9"/>`,burst:`<path d="${to(9,10.2,4.6)}" fill="${T.gold}"/>
<path d="${to(9,5.6,2.4)}" fill="${T.mustardHi}" stroke-width="1.3"/>`,hammer:`
<path d="M5.2 3.4h13.6a1.7 1.7 0 0 1 1.7 1.7v4.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V5.1a1.7 1.7 0 0 1 1.7-1.7z" fill="#C9B8DE"/>
<path d="M16.2 3.6v7.4" stroke-width="1.4"/>
<path d="M10.1 11h3.8v10.2h-3.8z" fill="${T.patty}"/>`,dough:`
<circle cx="8" cy="15.4" r="5.1" fill="#E6D4B0"/>
<circle cx="16.4" cy="14.6" r="4.3" fill="#EFE0C4"/>
<circle cx="12.6" cy="7.4" r="4.6" fill="#F7ECD6"/>
<path d="M10.8 5.9a2.6 2.6 0 0 1 1.8-1.4" stroke="${T.white}" stroke-width="1.5"/>`,cheese:`
<path d="M2.4 17.4 20.4 5.6a1.4 1.4 0 0 1 1.2 1.4v10.4a1.4 1.4 0 0 1-1.4 1.4H3.8a1.4 1.4 0 0 1-1.4-1.4z" fill="${T.mustard}"/>
<circle cx="9.4" cy="15.2" r="1.9" fill="#DE9A12" stroke="none"/>
<circle cx="16.2" cy="12.2" r="1.6" fill="#DE9A12" stroke="none"/>
<circle cx="17.6" cy="16.6" r="1.3" fill="#DE9A12" stroke="none"/>`,rice:`
<path d="M3.4 13.4h17.2c0 4.6-3.8 8-8.6 8s-8.6-3.4-8.6-8z" fill="${T.waterHi}"/>
<path d="M5.6 13.4a2.2 2.2 0 0 1 2.8-2 2.4 2.4 0 0 1 3.6-1.6 2.4 2.4 0 0 1 3.6 1.6 2.2 2.2 0 0 1 2.8 2z" fill="${T.white}"/>
<path d="M2.4 13.4h19.2" stroke-width="1.8"/>`,seaweed:`
<path d="M12 21.6V6" stroke="#2E6B3A" stroke-width="2.3"/>
<path d="M11.8 10c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>
<path d="M12.2 15.4c4.6 0 7-2.6 7-6.8-4.6 0-7 2.6-7 6.8z" fill="#4E9B5A"/>
<path d="M11.8 20.8c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>`,fish:`
<path d="M2.4 12.2c2.1-4 5.6-6.1 9.7-6.1 3.5 0 6 1.7 7.3 4.2-1.3 4.8-4.4 7.9-9 7.9-3.5 0-6-2.1-8-6z" fill="${T.water}"/>
<path d="M18.9 10.1 22.4 7v10.2l-3.5-3.4z" fill="${T.waterHi}"/>
<circle cx="7.1" cy="10.7" r="1.2" fill="${T.ink}" stroke="none"/>`,puffer:`
<path d="M11 1.8v6.8a4.1 4.1 0 1 1-8.2 0v-1.2" stroke-width="2.8"/>
<path d="M2.8 8.2 5.4 11.6" stroke-width="2.2"/>
<path d="M10.4 17.4c1.2-2.2 3.1-3.4 5.4-3.4 2 0 3.4 1 4.2 2.4-.8 2.7-2.6 4.5-5.2 4.5-2 0-3.4-1.2-4.4-3.5z" fill="${T.gold}"/>
<path d="M19.8 16.4 22.4 14.6v5.9l-2.6-1.9z" fill="${T.mustard}"/>
<circle cx="13.2" cy="16.9" r="1.1" fill="${T.ink}" stroke="none"/>`,droplets:`
<path d="M8.4 20.6a4.9 4.9 0 0 1-4.9-4.9c0-2.9 4.9-8.4 4.9-8.4s4.9 5.5 4.9 8.4a4.9 4.9 0 0 1-4.9 4.9z" fill="${T.water}"/>
<path d="M17.6 13.6a3.3 3.3 0 0 1-3.3-3.3c0-2 3.3-5.7 3.3-5.7s3.3 3.7 3.3 5.7a3.3 3.3 0 0 1-3.3 3.3z" fill="${T.waterHi}"/>`,noodle:`
<path d="M16.4 2 13 11.4" stroke="${T.woodHi}" stroke-width="2.6"/>
<path d="M21.7 3.9 18.3 13.3" stroke="${T.wood}" stroke-width="2.6"/>
<path d="M3.2 13.2h17.6c0 4.8-3.9 8.4-8.8 8.4s-8.8-3.6-8.8-8.4z" fill="${T.ketchup}"/>
<path d="M5.6 13.2a2.1 2.1 0 0 1 2.3-2.2 2.4 2.4 0 0 1 3.1-2.3 2.6 2.6 0 0 1 4 .2 2.4 2.4 0 0 1 3.3 2.1 2.1 2.1 0 0 1 1.5 2.2z" fill="${T.mustardHi}"/>
<path d="M8.8 11.2c0-1.6.9-2.6 2-2.6M13.6 11.4c0-1.7.9-2.7 2-2.7" stroke="#D9A417" stroke-width="1.4"/>
<path d="M2.2 13.2h19.6" stroke-width="1.8"/>`,wave:`
<path d="M2.4 18.6C4 11 8.5 6.6 13.6 6.6c4.1 0 7 2.5 7 5.8 0 2.7-1.9 4.6-4.2 4.6-2.1 0-3.6-1.4-3.6-3.2 0-1.6 1.1-2.6 2.4-2.6.9 0 1.7.5 1.9 1.3-1.4-.3-2.3.5-2.3 1.4 0 1 .8 1.7 1.9 1.7 1.5 0 2.5-1.2 2.5-2.9 0-2.3-2.1-4.2-5.2-4.2-4.4 0-7.9 3.8-9.4 10.1z" fill="${T.water}"/>
<path d="M2 21c2.7-1.5 4.4 1 7.1-.4M11.9 20.6c2.7-1.5 4.4 1 7.1-.4" stroke="${T.waterHi}" stroke-width="1.7"/>`,shards:`
<path d="M2.2 3.4 12.6 8.8 6.6 18.2z" fill="${T.ice}"/>
<path d="M15.2 2.6 22 11.4 13.4 13.6z" fill="${T.iceHi}"/>
<path d="M12.4 16 20.8 15.4 17 21.8z" fill="${T.ice}"/>`,cap:`
<g transform="rotate(9 12 12.4)">
<ellipse cx="12" cy="15" rx="9.2" ry="3.2" fill="#12669E"/>
<path d="M2.8 12h18.4v3H2.8z" fill="#12669E" stroke="none"/>
<ellipse cx="12" cy="12" rx="9.2" ry="3.2" fill="${T.water}"/>
<ellipse cx="12" cy="11.8" rx="5.6" ry="1.5" fill="${T.iceHi}" stroke-width="1.3"/>
</g>`,mustardblast:`
<path d="M7.2 11.4h9.6a4.3 4.3 0 0 1 0 8.6H7.2a4.3 4.3 0 0 1 0-8.6z" fill="#E8B15C"/>
<path d="M5 6.6h14a3.7 3.7 0 0 1 0 7.4H5a3.7 3.7 0 0 1 0-7.4z" fill="#C2452F"/>
<path d="M5.6 12 9 8.8 12.4 12 15.8 8.8 19.2 12" stroke="${T.mustard}" stroke-width="2.8"/>`,ketchupslip:`
<path d="M4.6 8.6h7.6a2.1 2.1 0 0 1 2.1 2.1v8.6a2.1 2.1 0 0 1-2.1 2.1H4.6a2.1 2.1 0 0 1-2.1-2.1v-8.6a2.1 2.1 0 0 1 2.1-2.1z" fill="${T.tomato}"/>
<path d="M6.6 3.2h3.6v5.4H6.6z" fill="${T.tomato}"/>
<path d="M7.2 1.4h2.4v1.9H7.2z" fill="#9E1B27"/>
<path d="M3.4 12.4h10" stroke="${T.cream}" stroke-width="2"/>
<path d="M18.4 8.6c2.4 0 3.6 1.5 3.4 3-.2 1.4-1.5 1.4-1.5 2.6 0 1.4-1.5 2.3-2.8 1.7-1.2-.6-2.4.3-3-.9-.6-1.2.3-1.9-.3-3 -.6-1.2.6-2.4 2-2.4 1 0 1.2-1 2.2-1z" fill="${T.tomato}"/>`,slash:`
<path d="M2.4 21.6C2 9 9 2 21.6 2.4 15 8 11 12 2.4 21.6z" fill="${T.steel}"/>
<path d="M20.4 3.6C13.4 7.4 8.2 12.4 4.4 18.8" stroke="${T.white}" stroke-width="2.2"/>
<path d="M8.6 21.4c3.4-2.8 6.2-5.6 8.4-8.6M14.4 21.6c2.4-2 4.4-4 6-6.2" stroke="#9C93B0" stroke-width="1.8"/>`,wrap:`
<path d="M4.4 17.6 15.6 6.4a4.4 4.4 0 0 1 3.6 3.6L8 21.2a4.4 4.4 0 0 1-3.6-3.6z" fill="#EFE0C4"/>
<path d="M15.6 6.4a4.4 4.4 0 0 1 3.6 3.6l2.8-2.8a4.4 4.4 0 0 0-3.6-3.6z" fill="#E9B44C"/>
<path d="M8.4 13.6 11.2 16.4M11.6 10.4 14.4 13.2" stroke="#CBB289" stroke-width="1.8"/>`,lollipop:`
<path d="M12 21.4v-6.6" stroke-width="2.3"/>
<circle cx="12" cy="9" r="6.3" fill="${T.candy}"/>
<path d="M12 9a2.1 2.1 0 1 0 2.1 2.1c0-2.3-2.3-3.7-4.6-2.9" stroke="${T.cream}" stroke-width="1.9"/>`,egg:`
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="#E4CFA6"/>
<path d="M12 4.8a6.7 8.3 0 0 1 0 16.6z" fill="#C9AE7C" stroke="none"/>
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="none"/>
<path d="M8.4 15.4a3.6 3.6 0 0 0 1.9 3.8" stroke="#FFF8EA" stroke-width="2"/>`,honey:`
<path d="M5.4 3.4h13.2v3.4H5.4z" fill="${T.gold}"/>
<path d="M8.2 6.6h7.6v2.6H8.2z" fill="#C98A00"/>
<path d="M6.6 9c-.9 2.6-1.3 4.9-1.3 7 0 3.3 2.2 5.2 6.7 5.2s6.7-1.9 6.7-5.2c0-2.1-.4-4.4-1.3-7z" fill="#C98A00"/>
<path d="M6.6 12.8h10.8v3.6H6.6z" fill="${T.mustardHi}" stroke-width="1.4"/>
<path d="M18.3 9.2c1.7 2.4 2.5 4.2 2.5 5.5 0 1.5-.9 2.5-2.2 2.5s-2.2-1-2.2-2.5c0-1.3.6-3 1.9-5.5z" fill="${T.mustardHi}"/>`};function En(e,t,a,o=""){return`
<path d="M3.4 9.4h17.2v9.4a1.7 1.7 0 0 1-1.7 1.7H5.1a1.7 1.7 0 0 1-1.7-1.7z" fill="${e}"/>
<path d="M3.4 9.4 6.6 5.6h10.8l3.2 3.8z" fill="${t}"/>
<path d="M10.2 5.6h3.6v14.9h-3.6z" fill="${a}" stroke-width="1.3"/>
${o}`}const Qm=`<path d="M12 0.6c2.6 2.2 3.7 3.9 3.2 5.5-.9-.8-1.6-1.1-2.3-.9.7 1.9.3 3.1-.9 4-1.2-.9-1.6-2.1-.9-4-.7-.2-1.4.1-2.3.9-.5-1.6.6-3.3 3.2-5.5z" fill="${T.flame}" stroke-width="1.3"/>`,Jm=`<path d="M12 0.4c2.4.8 3.6 2.4 3.6 4.6-2.4-.7-3.6-2.3-3.6-4.6zM12 0.4c-2.4.8-3.6 2.4-3.6 4.6C10.8 4.3 12 2.7 12 .4z" fill="${T.lettuce}" stroke-width="1.3"/>`,eg=`<path d="M12 5.6C9.2 1.6 4.8 2.8 6.2 5.6M12 5.6C14.8 1.6 19.2 2.8 17.8 5.6" fill="${T.mustard}" stroke-width="1.4"/>`,tg=`<path d="M4.9 13.4a2.6 2.6 0 0 1 5.2 0z" fill="#B4622A" stroke-width="1.2"/>
<path d="M4.7 13.4h5.6v1.5H4.7z" fill="${T.lettuce}" stroke-width="1.2"/>
<path d="M4.9 15h5.2a2.2 2.2 0 0 1-5.2 0z" fill="#B4622A" stroke-width="1.2"/>`,ag=Array.from({length:8},(e,t)=>`<rect x="10.3" y="0.9" width="3.4" height="5.4" rx="1.2" fill="${T.gold}" transform="rotate(${t*45} 12 12)"/>`).join(""),og={coin:`
<ellipse cx="12" cy="14.2" rx="9" ry="7" fill="#7F4E00"/>
<ellipse cx="12" cy="11.2" rx="9" ry="7" fill="#D98200"/>
<path d="${to(5,5.6,2.4,12,11.4)}" fill="#FFEFC0" stroke-width="1.4"/>
<path d="M8.2 8.6a7 5.4 0 0 1 3.4-2.3" stroke="${T.white}" stroke-width="1.7"/>`,gem:`
<path d="M6.6 3.9h10.8l3.6 5.3L12 20.4 3 9.2z" fill="${T.water}"/>
<path d="M6.6 3.9 8.9 9.2h6.2l2.3-5.3z" fill="${T.ice}" stroke-width="1.3"/>
<path d="M3 9.2h18" stroke-width="1.3"/>
<path d="M8.9 9.2 12 20.4l3.1-11.2" stroke-width="1.3"/>`,trophy:`
<path d="M7.1 3.3h9.8v5a4.9 4.9 0 0 1-9.8 0z" fill="${T.gold}"/>
<path d="M7.1 4.9H4.3a3.3 3.3 0 0 0 3.3 4.3" stroke-width="1.8"/>
<path d="M16.9 4.9h2.8a3.3 3.3 0 0 1-3.3 4.3" stroke-width="1.8"/>
<path d="M12 13.1v3.3" stroke-width="2.2"/>
<path d="M7.9 20.7h8.2l-.8-2.6a1.2 1.2 0 0 0-1.2-.9h-4.2a1.2 1.2 0 0 0-1.2.9z" fill="${T.mustard}"/>
<path d="M9.6 5.1a3.4 3.4 0 0 0 .5 4.5" stroke="${T.cream}" stroke-width="1.4"/>`,star:`<path d="${to(5,9.4,4.1)}" fill="${T.mustard}"/>
<path d="M12 4.6 10.6 9" stroke="${T.mustardHi}" stroke-width="1.4"/>`,sparkle:`
<path d="M10.4 1.8c1.5 5.4 2.9 6.8 8.3 8.3-5.4 1.5-6.8 2.9-8.3 8.3-1.5-5.4-2.9-6.8-8.3-8.3 5.4-1.5 6.7-2.9 8.3-8.3z" fill="${T.mustard}"/>
<path d="M18.6 14.4c.7 2.6 1.4 3.3 4 4-2.6.7-3.3 1.4-4 4-.7-2.6-1.4-3.3-4-4 2.6-.7 3.3-1.4 4-4z" fill="${T.mustardHi}" stroke-width="1.5"/>`,flag:`
<path d="M5.6 21.2V3.2" stroke-width="2.2"/>
<path d="M5.6 4h13.6v9.2H5.6z" fill="${T.cream}"/>
<path d="M5.6 4h3.4v3.06H5.6zM12.4 4h3.4v3.06h-3.4zM9 7.06h3.4v3.07H9zM15.8 7.06h3.4v3.07h-3.4zM5.6 10.13h3.4v3.07H5.6zM12.4 10.13h3.4v3.07h-3.4z" fill="${T.ink}" stroke="none"/>`,pin:`
<path d="M12 21.4s6.7-6.5 6.7-11.1a6.7 6.7 0 1 0-13.4 0c0 4.6 6.7 11.1 6.7 11.1z" fill="${T.ketchup}"/>
<circle cx="12" cy="10.2" r="2.6" fill="${T.cream}"/>`,chest:`
<path d="M3.1 11.6h17.8v6.7a1.7 1.7 0 0 1-1.7 1.7H4.8a1.7 1.7 0 0 1-1.7-1.7z" fill="${T.wood}"/>
<path d="M3.1 11.6a8.9 8.9 0 0 1 17.8 0z" fill="${T.woodHi}"/>
<path d="M2.6 10.2h18.8v3H2.6z" fill="${T.gold}" stroke-width="1.4"/>
<path d="M10.3 9.8h3.4v5.4h-3.4z" fill="${T.mustard}" stroke-width="1.4"/>
<circle cx="12" cy="12.9" r="0.85" fill="${T.wood}" stroke="none"/>`,boxBurger:En(T.gold,T.mustard,T.ketchup,tg),boxPineapple:En(T.grape,T.grapeHi,T.mustard,Jm),boxRed:En(T.ketchup,"#E9536A",T.mustard,eg),boxFire:En(T.grapeDark,T.grape,T.flame,Qm),gift:`
<path d="M4 10.4h16v8.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.6z" fill="${T.ketchup}"/>
<path d="M2.6 6.4h18.8v4H2.6z" fill="#E9536A"/>
<path d="M10.2 6.4h3.6v13.8h-3.6z" fill="${T.mustard}" stroke-width="1.3"/>
<path d="M12 6.2c-2.6-3.4-6.2-2.4-5 .2M12 6.2c2.6-3.4 6.2-2.4 5 .2" fill="${T.mustard}" stroke-width="1.4"/>`,gear:`${ag}
<circle cx="12" cy="12" r="7.4" fill="${T.gold}"/>
<circle cx="12" cy="12" r="3.3" fill="${T.cream}"/>`,lock:`
<path d="M7.5 10.4V7.9a4.5 4.5 0 0 1 9 0v2.5" stroke-width="1.9"/>
<path d="M4.4 10.2h15.2a1.9 1.9 0 0 1 1.9 1.9v6.6a1.9 1.9 0 0 1-1.9 1.9H4.4a1.9 1.9 0 0 1-1.9-1.9v-6.6a1.9 1.9 0 0 1 1.9-1.9z" fill="${T.gold}"/>
<circle cx="12" cy="14.4" r="1.7" fill="${T.ink}" stroke="none"/>
<path d="M12 15.4v2.6" stroke-width="1.9"/>`,play:'<path d="M7.6 4.2 19.4 12 7.6 19.8z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>',pause:`
<path d="M6.4 4.4h4.2v15.2H6.4z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>
<path d="M13.4 4.4h4.2v15.2h-4.2z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>`,back:'<path d="M15.2 4.4 7.4 12l7.8 7.6" stroke-width="2.8"/>',close:'<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" stroke-width="2.8"/>',check:'<path d="M4.6 12.4 9.4 17.4 19.4 6.8" stroke-width="3"/>',home:`
<path d="M3 11.6 12 3.4l9 8.2" stroke-width="2.1"/>
<path d="M5.4 10.6h13.2v9.8H5.4z" fill="${T.gold}"/>
<path d="M9.6 14h4.8v6.4H9.6z" fill="${T.wood}"/>`,swap:`
<path d="M4.6 10.2a7.4 7.4 0 0 1 12.6-3.6" stroke-width="2.2"/>
<path d="M17.6 2.9v4.2h-4.2" stroke-width="2.2"/>
<path d="M19.4 13.8a7.4 7.4 0 0 1-12.6 3.6" stroke-width="2.2"/>
<path d="M6.4 21.1v-4.2h4.2" stroke-width="2.2"/>`,mute:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${T.cream}"/>
<path d="M15.4 9.4 20.6 14.6M20.6 9.4 15.4 14.6" stroke="${T.tomato}" stroke-width="2.4"/>`,sound:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${T.cream}"/>
<path d="M15.2 9a4.2 4.2 0 0 1 0 6" stroke-width="1.9"/>
<path d="M18 6.4a8 8 0 0 1 0 11.2" stroke-width="1.9"/>`,cone:`
<path d="M12 3 18.8 18.6H5.2z" fill="${T.gold}"/>
<path d="M9.3 11.4h5.4M8 15h8" stroke="${T.cream}" stroke-width="2.1"/>
<path d="M3.2 18.4h17.6a1.2 1.2 0 0 1 1.2 1.2v.2a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 19.8v-.2a1.2 1.2 0 0 1 1.2-1.2z" fill="${T.ketchup}"/>`,chefhat:`
<path d="M6.6 12.4a3.9 3.9 0 1 1 1.6-7.4 4.3 4.3 0 0 1 7.6 0 3.9 3.9 0 1 1 1.6 7.4z" fill="${T.cream}"/>
<path d="M6.6 12.2h10.8v6a1.4 1.4 0 0 1-1.4 1.4H8a1.4 1.4 0 0 1-1.4-1.4z" fill="${T.cream}"/>
<path d="M6.6 15.4h10.8" stroke-width="1.4"/>`,avatar:`
<path d="M3.4 21.2a8.6 8.6 0 0 1 17.2 0z" fill="${T.gold}"/>
<circle cx="12" cy="11.6" r="5" fill="${T.mustard}"/>
<path d="M7.2 8.4a2.9 2.9 0 1 1 1.6-5.3 3.6 3.6 0 0 1 6.4 0 2.9 2.9 0 1 1 1.6 5.3z" fill="${T.cream}"/>
<path d="M7.2 8.2h9.6v2.2H7.2z" fill="${T.cream}"/>`,damage:`
<path d="M20.6 1.6 21.4 6.6 9.8 18.2 6.4 14.8z" fill="${T.steel}"/>
<path d="M20.6 1.6 15.6 2.4 4 14l3.4 3.4z" fill="#B7AFC7" stroke="none"/>
<path d="M20.6 1.6 6.4 14.8" stroke-width="1.4"/>
<path d="M3.6 15.2 8.8 20.4" stroke="${T.ketchup}" stroke-width="3.4"/>
<path d="M1.8 20.2 5.4 16.6" stroke-width="2.4"/>`,health:`<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${T.ketchup}"/>
<path d="M7.2 10.4a2.6 2.6 0 0 1 2-1.6" stroke="${T.cream}" stroke-width="1.5"/>`,speed:`<path d="M13.8 2.2 5.6 13.4h4.8l-1.6 8.4 8.8-11.6h-5z" fill="${T.mustard}"/>`,range:`
<path d="M3.4 12h17.2" stroke-width="2.3"/>
<path d="M7.2 8.1 3.2 12l4 3.9" stroke-width="2.3"/>
<path d="M16.8 8.1 20.8 12l-4 3.9" stroke-width="2.3"/>`,timer:`
<circle cx="12" cy="13.6" r="7.7" fill="#C9B8DE"/>
<path d="M9.5 2.4h5" stroke-width="2.1"/>
<path d="M12 2.4v3.5" stroke-width="2.1"/>
<path d="M12 9.4v4.3h3.3" stroke-width="1.9"/>`,heal:`
<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${T.lettuce}"/>
<path d="M12 9.6v5.6M9.2 12.4h5.6" stroke="${T.cream}" stroke-width="2.1"/>`,stun:`<path d="${to(5,8.6,3.7,10.2,10.6)}" fill="${T.mustard}"/>
<path d="${to(5,4.2,1.8,19.2,18)}" fill="${T.mustardHi}" stroke-width="1.4"/>`,slow:`
<circle cx="12" cy="12" r="9.1" fill="${T.gold}"/>
<path d="M12 12a2.9 2.9 0 1 0 2.9 2.9c0-3.4-3.2-5.3-6.3-4.1-3.4 1.3-4.6 5.3-2.6 8.2" stroke-width="2.1"/>`,medal:`
<path d="M8.4 2.2 11 8.6H7L4.4 2.2z" fill="${T.ketchup}"/>
<path d="M15.6 2.2 13 8.6h4l2.6-6.4z" fill="${T.water}"/>
<circle cx="12" cy="15.2" r="6.6" fill="${T.gold}"/>
<circle cx="12" cy="15.2" r="3.4" fill="${T.mustard}" stroke-width="1.3"/>`,party:`
<path d="M3.4 20.9 9 8.2l6.8 6.8z" fill="${T.ketchup}"/>
<path d="M9 8.2 15.8 15" stroke-width="1.4"/>
<circle cx="18.7" cy="5.5" r="1.6" fill="${T.mustard}"/>
<circle cx="14.2" cy="3.4" r="1.3" fill="${T.lettuce}"/>
<circle cx="20.8" cy="10.4" r="1.3" fill="${T.water}"/>
<path d="M16.2 8.8 18.6 6.4" stroke-width="1.4"/>`},Qe=416,at=496,Fl=Qe/at,ng=.42,sg=.07,pr=.08,rg=.66,ig=.08,wa={x0:.035,x1:.965,y0:.045,y1:.725},cg=.7,ur=.18,fr=.92,lg=1.15,Fa=new Map,mr=new Map,gi=[];let gr=!1;function hg(e){const a=document.createElement("canvas");a.width=8,a.height=8;const o=a.getContext("2d",{willReadFrequently:!0});if(!o)return[0,0,0];o.drawImage(e,0,0,8,8);const n=o.getImageData(0,0,8,8).data;let s=0,r=0,i=0;for(let l=0;l<n.length;l+=4)s+=n[l],r+=n[l+1],i+=n[l+2];const c=n.length/4;return[Math.round(s/c),Math.round(r/c),Math.round(i/c)]}function Qi(e){return Fa.get(e)}function wi(){const e=[...Se];if(typeof document>"u"||typeof window<"u"&&window.__screen==="characters")return e;const t=new Set;for(const a of document.querySelectorAll("[data-portrait]")){const o=a.dataset.portrait;Se.includes(o)&&t.add(o)}return!t.size&&(typeof window>"u"||!window.__screen)?e:[...t]}function ip(e){for(const a of Se){const o=Fa.get(a);o&&e(a,o)}if(Se.every(a=>Fa.has(a))){window.__thumbsReady=!0;return}if(gi.push(e),gr)return;gr=!0,window.__thumbsReady=!1;const t=()=>void dg().finally(()=>{gr=!1,gi.length=0,window.__thumbsReady=wi().every(a=>Fa.has(a))});typeof requestIdleCallback=="function"?requestIdleCallback(t,{timeout:600}):setTimeout(t,120)}async function dg(){if(!wi().some(a=>!Fa.has(a)))return;const e=document.createElement("div");e.style.cssText=`position:fixed;left:-9999px;top:0;width:${Qe}px;height:${at}px;pointer-events:none;`,document.body.appendChild(e);let t=null;try{t=new Di({container:e,background:0,fog:null,camera:{pitchDeg:12,yawDeg:24,frameMode:"subject",subjectHeight:2.1,subjectFill:1,targetHeight:1.05,followLerp:1},shadows:!1,postFx:"grade",offscreen:!0,maxPixelRatio:1}),t.canvas.style.cssText=`display:block;width:${Qe}px;height:${at}px;`,t.resize();const a=new Set;for(;;){const o=wi().filter(n=>!Fa.has(n)&&!a.has(n));if(!o.length)break;for(const n of o)a.add(n),await ug(t,n)}}catch{}finally{t?.dispose(),e.remove()}}function Do(e,t,a,o){const n=new le,s=e.getCenter(n.clone()).applyMatrix4(t.matrixWorldInverse).z;let r=1/0,i=1/0,c=-1/0,l=-1/0;for(let h=0;h<8;h++){n.set(h&1?e.max.x:e.min.x,h&2?e.max.y:e.min.y,h&4?e.max.z:e.min.z).applyMatrix4(t.matrixWorldInverse),n.z=s,n.applyMatrix4(t.projectionMatrix);const d=(n.x*.5+.5)*a,p=(1-(n.y*.5+.5))*o;r=Math.min(r,d),c=Math.max(c,d),i=Math.min(i,p),l=Math.max(l,p)}return{x:+r.toFixed(1),y:+i.toFixed(1),w:+(c-r).toFixed(1),h:+(l-i).toFixed(1)}}function Rl(e,t){const a=e.getObjectByName(t);if(!a)return null;const o=new ts().setFromObject(a);return o.isEmpty()?null:o}function pg(e,t,a){const o=new le;let n=0;return e.traverse(s=>{const r=s;if(!r.isMesh||!r.visible)return;const i=r.geometry?.getAttribute("position");if(i)for(let c=0;c<i.count;c++){if(o.fromBufferAttribute(i,c).applyMatrix4(r.matrixWorld),o.y<t)continue;const l=Math.abs(o.dot(a));l>n&&(n=l)}}),n}async function ug(e,t){const a=Qa(t);e.scene.add(a.root),a.play("idle"),a.update({dt:.4,elapsed:.4,moveSpeed01:0,health01:1});const o=new ts().setFromObject(a.root),n=Rl(a.root,"head"),s=Rl(a.root,"face"),r=Math.max(.5,o.max.y-o.min.y),i=o.max.y,c=(s??n)?.min.y??o.min.y+.45*r,l=Math.max(o.min.y,Math.min(o.min.y+ng*r,c-sg*r)),h=Math.max(.4,i-l),d=e.rig.camera,p=new le,u=(L,A,F)=>{e.rig.subjectFill=1,e.rig.subjectHeight=L,e.rig.targetHeight=A-L/2,e.rig.snapTo(F*p.x,F*p.z),d.updateMatrixWorld(!0),d.matrixWorldInverse.copy(d.matrixWorld).invert()};u(h/fr,i+pr*(h/fr),0),p.setFromMatrixColumn(d.matrixWorld,0).normalize();const f=pg(a.root,l,p),m=Math.max(h/fr,2*f/(Fl*lg),s?(i-s.min.y)/(rg+ig):0);let g=i+pr*m,w=0,y=m;if(s){const L=()=>i-ur*y;for(let A=0;A<4;A++){g=i+pr*y;for(let H=0;H<3;H++){u(y,g,w);const Q=Do(s,d,Qe,at),C=(Q.y+Q.h)/at-cg;if(C<=0)break;const O=Math.max(0,(Q.y/at-wa.y0)*y),_=Math.max(L(),g-Math.min(C*y,O));if(Math.abs(_-g)<1e-4)break;g=_}u(y,g,w);const F=Do(s,d,Qe,at),D=F.x+F.w-wa.x1*Qe,E=wa.x0*Qe-F.x,R=y*Fl/Qe;D>0&&E<0?w+=Math.min(D,-E)*R:E>0&&D<0&&(w-=Math.min(E,-D)*R);const q=F.w/((wa.x1-wa.x0)*Qe),$=(F.y+F.h)/at,G=$>wa.y1?($+ur)/(wa.y1+ur):1,V=Math.max(q,G);if(V<=1.001)break;y*=V}}u(y,g,w);const x=Ni[re[t].rarity];e.scene.background=new ia(x),e.lighting.focus(0,0,4),mr.has(x)||(a.root.visible=!1,e.render(0),mr.set(x,hg(e.canvas)),a.root.visible=!0),e.render(0),e.render(0);const k=e.canvas.toDataURL("image/png"),S=a.root.getObjectByName("hips"),v=a.root.getObjectByName("shoulderL"),M=new le;(window.__thumbMeta??={})[t]={size:{w:Qe,h:at},subject:Do(o,d,Qe,at),head:n?Do(n,d,Qe,at):null,face:s?Do(s,d,Qe,at):null,bg:mr.get(x)??null,world:{minY:+o.min.y.toFixed(4),maxY:+o.max.y.toFixed(4),halfWidth:+Math.max(Math.abs(o.min.x),Math.abs(o.max.x)).toFixed(4),hipsY:S?+S.getWorldPosition(M).y.toFixed(4):null,shoulderY:v?+v.getWorldPosition(M).y.toFixed(4):null,headY:n?[+n.min.y.toFixed(4),+n.max.y.toFixed(4)]:null,faceY:s?[+s.min.y.toFixed(4),+s.max.y.toFixed(4)]:null,yCut:+l.toFixed(4),upperHalfWidth:+f.toFixed(4)},frame:{subjectHeight:+e.rig.subjectHeight.toFixed(4),subjectFill:+e.rig.subjectFill.toFixed(4),targetHeight:+e.rig.targetHeight.toFixed(4),headroom:+((g-i)/y).toFixed(4),pan:+w.toFixed(4)}},e.scene.remove(a.root),a.dispose(),Fa.set(t,k);for(const L of gi)L(t,k);await new Promise(L=>setTimeout(L,0))}const fg='<circle cx="12" cy="9" r="5.6" fill="#FFF3DE"/><path d="M5.2 21.6c0-3.5 3-5.6 6.8-5.6s6.8 2.1 6.8 5.6z" fill="#FFF3DE"/>';function Tt(e,t={}){const a=Ni[re[e].rarity],o=Qi(e),n=["fa-ic-portrait",t.crop==="head"?"fa-ic-portrait--head":"",o?"has-render":"",t.class??""].filter(Boolean).join(" "),s=o?` src="${o}"`:"";return`<span class="${n}" data-portrait="${e}" style="--pc:${a}"><img alt=""${s}/><svg class="fa-ic" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${fg}</svg></span>`}function Xo(e,t={}){const a=(o,n)=>{for(const s of e.querySelectorAll(`[data-portrait="${o}"]`)){const r=s.querySelector("img");r&&(r.getAttribute("src")!==n&&r.setAttribute("src",n),s.classList.add("has-render"))}};if(t.generate===!1){for(const o of e.querySelectorAll("[data-portrait]")){const n=o.dataset.portrait,s=Qi(n);s&&a(n,s)}return}ip(a)}const mg={...og,...Zm},gg='viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"';function I(e,t={}){const a=mg[e];if(!a)return"";const o=["fa-ic",`fa-ic--${e}`,t.class??""].filter(Boolean).join(" "),n=t.size??"1em",s=t.label?`role="img" aria-label="${t.label}"`:'aria-hidden="true" focusable="false"';return`<svg class="${o}" ${gg} width="${n}" height="${n}" ${s}>${a}</svg>`}const wg={"🪙":"coin","💎":"gem","🏆":"trophy","⭐":"star","✨":"sparkle","🏁":"flag","📍":"pin","🎉":"party","🎁":"gift","🧑‍🍳":"chefhat","⚙️":"gear","⚙":"gear","🔒":"lock","▶":"play","⏸":"pause","◀":"back","🙂":"avatar","🚧":"cone","🔇":"mute","🔊":"sound","🏠":"home","🍟":"swap","❤️":"health","❤":"health","💨":"speed","↔":"range","⏱":"timer","💚":"heal","💫":"stun","🐌":"slow","🍖":"patty","🍅":"tomato","🥬":"lettuce","🧅":"onion","🍬":"candy","🥩":"meat","🌯":"wrap","🌀":"swirl","🥚":"egg","🐣":"chick","💥":"burst","🔨":"hammer","🍭":"lollipop","⚪":"dough","🧀":"cheese","🍚":"rice","🌿":"seaweed","🐟":"fish","🐡":"puffer","💦":"droplets","🍜":"noodle","🌊":"wave","🧊":"shards","🔵":"cap","💛":"mustardblast","🔴":"ketchupslip","⚔️":"slash","⚔":"damage","🍯":"honey","💧":"droplets"},yg={chest:"chest",hamburgerBox:"boxBurger",pineappleBox:"boxPineapple",redBox:"boxRed",fireBox:"boxFire"};function Jt(e,t={}){const a=wg[e];return a?I(a,t):e}function dt(e,t={}){return I(yg[e]??"chest",t)}function cp(e,t={}){return Jt(e,t)}const Cl="fa-icon-styles";function ha(){if(document.getElementById(Cl))return;const e=document.createElement("style");e.id=Cl,e.textContent=bg,document.head.appendChild(e)}const bg=`
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
`,zl=[Et.tomato,Et.mustard,Et.lettuce,Et.cheese,Et.glaze,Et.waterCap];function rs(e,t=50,a=26){for(let o=0;o<a;o++){const n=document.createElement("span");n.className="fa-confetti",n.style.left=`${t+(Math.random()*12-6)}%`,n.style.background=zl[Math.floor(Math.random()*zl.length)],n.style.animationDelay=`${(Math.random()*.22).toFixed(2)}s`,n.style.setProperty("--x",`${Math.round(Math.random()*240-120)}px`),e.appendChild(n),setTimeout(()=>n.remove(),1800)}}function Ae(e,t,a){const o=document.createElement(e);return t&&(o.className=t),o}const xg="1v1 · Kitchen Rumble";function vg(e){const t=Math.round(e/1e3);return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}function kg(e){la("fa-home-styles",Mg),ha();const t=Ae("div","fa-screen fa-home"),a=Vi();a.setScene("lobby"),t.innerHTML=`
    <div class="home-room" aria-hidden="true">
      <div class="home-room-wall"></div>
      <div class="home-room-floor"></div>
      <div class="home-room-alcove"></div>
    </div>

    <header class="fa-topbar">
      <div class="fa-chip"><span class="fa-chip-em">${I("avatar")}</span><span data-el="name"></span></div>
      <div class="fa-chip"><span class="fa-chip-em">${I("trophy")}</span><span class="fa-chip-val" data-el="trophies">0</span></div>
      <div class="fa-chip home-chip-coin"><span class="fa-chip-em">${I("coin")}</span><span data-el="coins">0</span></div>
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
        <button class="fa-tab is-active" type="button">${I("home")} Home</button>
        <button class="fa-tab" type="button" data-go="characters">${I("chefhat")} Foods</button>
        <button class="fa-tab" type="button" data-go="trophies">${I("trophy")} Trophies</button>
        <!-- The one destination on this bar that cannot currently sell anything, and it
             is here anyway. The lobby's standing rule is "nothing advertises something
             that does not work", and the shop passes it on the same terms the gem store
             already does: nothing on it is a live-looking control that no-ops, every
             price and every drop rate on it is real, and it states in words that buying
             is off and why. Hidden would have been the dishonest option — it would put
             a compliance surface where no screenshot, no contrast battery and no
             acceptance test can reach it. See the header of shop.ts. -->
        <button class="fa-tab" type="button" data-go="shop">${I("coin")} Shop</button>
      </nav>
      <button class="fa-iconbtn" type="button" data-el="settings" aria-label="Settings">${I("gear")}</button>
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

        <button class="home-track home-track--road" type="button" data-go="trophies" data-el="road">
          <span class="home-track-top">
            <span class="home-track-icon" data-el="roadicon">${I("chest")}</span>
            <span class="home-track-text">
              <span class="home-track-title" data-el="roadtitle">Next reward</span>
              <span class="home-track-sub" data-el="roadsub"></span>
            </span>
            <span class="home-track-pill" data-el="roadpill">${I("trophy")}</span>
          </span>
          <span class="home-bar"><span class="home-bar-fill" data-el="roadfill"></span></span>
        </button>

        <button class="home-track" type="button" data-go="trophies" data-el="chest">
          <span class="home-track-top">
            <span class="home-track-icon">${I("gift")}</span>
            <span class="home-track-text">
              <span class="home-track-title">Free chest</span>
              <span class="home-track-sub" data-el="chestsub"></span>
            </span>
            <span class="home-pips" data-el="pips"></span>
          </span>
        </button>

        <button class="home-track home-track--held" type="button" data-go="trophies" data-el="held" hidden>
          <span class="home-track-top">
            <span class="home-track-icon">${I("chest")}</span>
            <span class="home-track-text">
              <span class="home-track-title" data-el="heldtitle"></span>
              <span class="home-track-sub">Waiting to be opened</span>
            </span>
            <span class="home-track-pill is-go">Open</span>
          </span>
        </button>

        <!-- THE DARK FAMILY. Three cream-on-cream chips inside a cream card were the
             clearest instance of the whole screen speaking one material: same fill, same
             radius, same border as everything around them, differentiated by nothing.
             The reference plates run TWO tile families side by side — bright tiles for
             things you act on, dark slate tiles for things you read off — and these are
             read-only, so they are the dark ones. The numeral also carries the meaning
             in colour now (won / lost / peak) instead of a caption doing all the work. -->
        <div class="home-record">
          <div class="home-rec"><span class="home-rec-ic">${I("medal")}</span><span class="home-rec-val is-win" data-el="wins">0</span><span class="home-rec-key">Wins</span></div>
          <div class="home-rec"><span class="home-rec-ic">${I("close")}</span><span class="home-rec-val is-loss" data-el="losses">0</span><span class="home-rec-key">Losses</span></div>
          <div class="home-rec"><span class="home-rec-ic">${I("trophy")}</span><span class="home-rec-val is-best" data-el="best">0</span><span class="home-rec-key">Best</span></div>
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
          ${I("swap")} Change
        </button>
      </aside>
    </div>

    <!-- OUTSIDE '.home-middle' ON PURPOSE. It spans the whole screen height, so it
         cannot be a child of one row of the screen grid. -->
    <section class="home-stage" data-el="stage">
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
        <span class="home-mode-sub" data-el="modesub">${vg(aa)} · last one standing</span>
      </div>
      <button class="fa-btn fa-btn--primary" type="button" data-el="start">${I("play")} Start Game</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const o=y=>{const x=t.querySelector(`[data-el="${y}"]`);if(!x)throw new Error(`home: missing element "${y}"`);return x},n=o("stage3d"),s=o("confetti"),r=o("heroname"),i=o("herorarity"),c=o("hint");let l=0;function h(){const y=e.profile.claimable.length,x=o("road"),k=o("roadfill");if(y>0){x.classList.add("is-ready"),o("roadicon").innerHTML=I("sparkle"),o("roadtitle").textContent=y>1?`${y} rewards ready`:"Reward ready",o("roadsub").textContent="Tap to claim",o("roadpill").textContent="Claim",k.style.width="100%";return}x.classList.remove("is-ready");const{progress01:S,next:v}=jd(e.profile.trophies);if(k.style.width=`${(S*100).toFixed(1)}%`,!v){o("roadicon").innerHTML=I("flag"),o("roadtitle").textContent="Road complete",o("roadsub").textContent="Every reward claimed",o("roadpill").innerHTML=`${I("trophy")} ${e.profile.trophies.toLocaleString()}`;return}const M=pi(v.reward,e.profile.unlocked);o("roadicon").innerHTML=v.reward.type==="character"?Tt(v.reward.id,{crop:"head"}):v.reward.type==="container"?dt(v.reward.kind):Jt(M.emoji),Xo(t),o("roadtitle").textContent=M.title,o("roadsub").textContent=`${(v.trophies-e.profile.trophies).toLocaleString()} trophies to go`,o("roadpill").innerHTML=`${I("trophy")} ${v.trophies.toLocaleString()}`}function d(){const y=e.profile.winsToNextChest,x=mt.winsPerChest,k=Math.max(0,Math.min(x,x-y));o("chestsub").textContent=y===0?"Ready on your next win":`${y} more ${y===1?"win":"wins"}`,o("pips").innerHTML=Array.from({length:x},(S,v)=>`<span class="home-pip${v<k?" is-on":""}"></span>`).join("")}function p(){const y=e.profile.containerCount,x=o("held");x.hidden=y===0,y>0&&(o("heldtitle").textContent=y===1?"1 chest held":`${y} chests held`)}function u(){const y=re[e.profile.selected],x=[["damage","Damage",y.stats.damage,"var(--ketchup)"],["health","Health",y.stats.health,"var(--lettuce)"],["speed","Speed",y.stats.speed,"var(--water)"]];o("stats").innerHTML=x.map(([k,S,v,M])=>`
      <div class="fa-stat">
        <span class="fa-stat-label">${I(k)} ${S}</span>
        <div class="fa-stat-track">
          <div class="fa-stat-fill" style="width:${v*10}%;background-color:${M}"></div>
        </div>
        <span class="fa-stat-val">${v}</span>
      </div>`).join(""),f()}function f(){const y=re[e.profile.selected];l>=y.abilities.length&&(l=0),o("kit").innerHTML=y.abilities.map((S,v)=>`
      <button class="home-kit-tile${v===l?" is-on":""}" type="button" data-kit="${v}">
        <span class="home-kit-em">${Jt(S.emoji)}</span>
        <span class="home-kit-name">${S.name}</span>
      </button>`).join("");const x=o("kitcap");x.textContent=y.abilities[l]?.desc??"";const k=l===y.abilities.length-1&&y.abilities.length%2===1;x.style.setProperty("--home-cap-x",k?"50%":l%2===0?"25%":"75%")}function m(){const y=re[e.profile.selected];o("name").textContent=e.profile.name,o("trophies").textContent=e.profile.trophies.toLocaleString(),o("coins").textContent=e.profile.coins.toLocaleString(),h(),d(),p(),u(),o("wins").textContent=e.profile.wins.toLocaleString(),o("losses").textContent=e.profile.losses.toLocaleString(),o("best").textContent=e.profile.bestTrophies.toLocaleString(),o("lv").textContent=`Lv ${e.profile.level}`,o("lvnext").textContent=`Lv ${e.profile.level+1}`,o("lvfill").style.width=`${(e.profile.levelProgress01*100).toFixed(1)}%`,o("lvxp").textContent=`${e.profile.xp%Bo} / ${Bo} XP`,r.textContent=y.name,i.textContent=y.rarity,i.style.background=ft[y.rarity],a.show(y.id)}const g=y=>{const x=y.target,k=x.closest("[data-kit]");if(k){const M=Number(k.dataset.kit);Number.isInteger(M)&&(l=M,f());return}const S=x.closest("[data-go]");if(!S)return;const v=S.dataset.go;v==="characters"?e.navigate({name:"characters"}):v==="trophies"?e.navigate({name:"trophies"}):v==="shop"&&e.navigate({name:"shop"})};t.addEventListener("click",g),o("start").addEventListener("click",()=>{e.navigate({name:"characters"})}),o("settings").addEventListener("click",()=>{e.navigate({name:"settings"})}),o("stage").addEventListener("click",()=>{a.poke(),rs(s,50,18)}),setTimeout(()=>c.classList.add("is-faded"),4200);const w=e.profile.onChange(m);return m(),a.attachTo(n),{root:t,update(y){a.update(y)},resize(){a.resize()},dispose(){w(),t.removeEventListener("click",g),a.setScene("portrait"),a.detach(),t.remove()}}}const Mg=`
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
.fa-home .home-col {
  gap: 6px;
  overflow: hidden;
  align-self: center;
  max-height: 100%;
}

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

.fa-home .home-track-top { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.fa-home .home-track-icon { font-size: 1.5rem; line-height: 1; flex: 0 0 auto; }
.fa-home .home-track-text { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
.fa-home .home-track-title {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.7rem, 1.55vh, 0.86rem);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fa-home .home-track-sub {
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.7rem, 1.4vh, 0.8rem); font-weight: 700; color: #4A3524;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fa-home .home-track-pill {
  display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
  --fa-ic-ink: #FFF3DE;
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.6rem, 1.35vh, 0.74rem);
  background: var(--ink); color: var(--cream);
  border-radius: 999px; padding: 3px 9px; white-space: nowrap;
}
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
  background: ${Jd};
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
.fa-home .home-nameplate {
  position: absolute;
  top: clamp(46px, 7.5vh, 76px);
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
.fa-home .home-kit-name {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.66rem, 1.45vh, 0.82rem);
  text-align: center;
  max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
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
  /* The nameplate's top offset is a clamp against viewport height, and at 390px tall the
     top bar is proportionally much larger, so the name would land on the tabs. */
  .fa-home .home-nameplate { top: clamp(40px, 12vh, 56px); }
  .fa-home .home-track-sub { display: none; }
  .fa-home .home-mode-sub { display: none; }
  .fa-home .home-record { display: none; }
  .fa-home .home-kit { display: none; }
  /* The caption is the kit's tap state, so it goes with the kit. Left behind it would
     be a description of an ability whose tile is not on screen. */
  .fa-home .home-kit-cap { display: none; }
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
`,Sg=4500,Eg=["No","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen","Twenty"];function Tg(e){return Eg[e]??String(e)}function Ag(){const e=new URLSearchParams(location.search).get("hold"),t=e===null?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:Sg}function Fg(e){la("fa-opening-styles",Rg),ha();const t=Ae("div","fa-screen fa-opening"),a=Vi();t.innerHTML=`
    <header class="open-head">
      <h1 class="open-title">Food Fight Arena</h1>
      <p class="open-tagline">${Tg(Se.length)} fighters. One kitchen. No table manners.</p>
    </header>

    <div class="open-stage">
      <div class="open-stage-3d" data-el="stage3d"></div>
      <div class="open-glow"></div>
    </div>

    <footer class="open-foot">
      <button class="fa-btn fa-btn--primary open-start" type="button" data-el="start">
        ${I("play")} Tap to start
      </button>
      <div class="open-timer" aria-hidden="true"><span class="open-timer-fill" data-el="timerfill"></span></div>
    </footer>
  `;const o=p=>{const u=t.querySelector(`[data-el="${p}"]`);if(!u)throw new Error(`opening: missing element "${p}"`);return u},n=o("stage3d");let s=!1,r=null;function i(){s||(s=!0,r!==null&&(clearTimeout(r),r=null),be.unlock(),be.music.play(),e.navigate({name:"home"}))}const c=p=>{p.key!=="Tab"&&i()},l=()=>i();window.addEventListener("keydown",c,!0),window.addEventListener("pointerdown",l,!0),o("start").addEventListener("click",i);const h=Ag();r=setTimeout(i,h);const d=o("timerfill");return d.style.transition=`width ${h}ms linear`,requestAnimationFrame(()=>{d.style.width="100%"}),a.show(e.profile.selected),a.attachTo(n),{root:t,update(p){a.update(p)},resize(){a.resize()},dispose(){r!==null&&clearTimeout(r),window.removeEventListener("keydown",c,!0),window.removeEventListener("pointerdown",l,!0),a.detach(),t.remove()}}}const Rg=`
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
`,Cg=.15,zg=44,Ig=78,Lg=5,Og=10,Il=.5,Ll="touch-styles";function _g(){return typeof window>"u"?!1:typeof navigator<"u"&&(navigator.maxTouchPoints??0)>0?!0:"ontouchstart"in window}function Dg(){return typeof window.matchMedia!="function"?!1:window.matchMedia("(pointer: coarse)").matches}function $g(){const e=Math.min(window.innerWidth,window.innerHeight);return Math.max(zg,Math.min(Ig,e*Cg))}function Ng(e,t,a){const o=Math.max(Math.abs(e),Math.abs(t)),n=o>1e-6?Math.min(1,Math.hypot(e,t))/o:0;return a.x=Math.max(-1,Math.min(1,e*n)),a.y=Math.max(-1,Math.min(1,t*n)),a}function Ol(){return{id:null,baseX:0,baseY:0,curX:0,curY:0}}function Pg(e){const t=_g(),a=Ol(),o=Ol(),n={x:0,y:0},s={x:0,y:-1};let r=!1,i=!1,c=!1,l=0,h="",d="";if(!t)return{available:!1,get engaged(){return!1},move:n,get moving(){return!1},aimDir:()=>null,get firing(){return!1},clearAim(){},reset(){},dispose(){}};Hg();const p=document.createElement("div");p.className="tch-root",p.innerHTML='<div class="tch-stick tch-stick--move" data-el="move-stick"><div class="tch-knob"></div></div><div class="tch-stick tch-stick--aim" data-el="aim-stick"><div class="tch-knob"></div></div><div class="tch-hint tch-hint--move" data-el="move-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">MOVE</div></div><div class="tch-hint tch-hint--aim" data-el="aim-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">AIM &amp; FIRE</div></div>',document.body.appendChild(p);const u=_=>p.querySelector('[data-el="'+_+'"]'),f=u("move-stick"),m=u("aim-stick"),g=u("move-hint"),w=u("aim-hint");Dg()&&(p.classList.add("is-hinted"),document.documentElement.classList.add("fa-touch-capable"));const x=e.canvas.parentElement,k=e.canvas.style.touchAction,S=x?x.style.touchAction:"";e.canvas.style.touchAction="none",x&&(x.style.touchAction="none");function v(_){if(!(_ instanceof Node))return!1;const Y=e.canvas;return _===Y||Y.contains(_)||_.contains(Y)}function M(){return $g()}function L(_,Y){const z=M();let j=_.curX-_.baseX,te=_.curY-_.baseY;const ie=Math.hypot(j,te);if(ie>z){const rt=z/ie;_.baseX=_.curX-j*rt,_.baseY=_.curY-te*rt,j*=rt,te*=rt}const $e=Math.hypot(j,te);return Y.x=j,Y.y=te,$e}const A={x:0,y:0},F=[];function D(_){const Y=F.indexOf(_);Y>=0&&F.splice(Y,1)}function E(_,Y){for(let z=0;z<_.length;z++)if(_[z].identifier===Y)return _[z];return null}function R(_,Y,z){for(let j=F.length-1;j>=0;j--){const te=E(z,F[j]);if(!te){F.splice(j,1);continue}if(te.clientX<window.innerWidth*Il===Y){F.splice(j,1),_.id=te.identifier,_.baseX=te.clientX,_.baseY=te.clientY,_.curX=te.clientX,_.curY=te.clientY;return}}}function q(){if(a.id===null){n.x=0,n.y=0;return}if(L(a,A)<Lg){n.x=0,n.y=0;return}const Y=M();Ng(A.x/Y,A.y/Y,n)}function $(){if(o.id===null)return;const _=L(o,A);_<Og||(s.x=A.x/_,s.y=A.y/_,r=!0)}function G(_,Y,z){if(Y.id===null)return z!==""&&(_.style.display="none"),"";const j=Y.curX-Y.baseX,te=Y.curY-Y.baseY,ie=M(),$e=Math.hypot(j,te),rt=$e>ie?ie/$e:1,it=Math.round(Y.baseX),ma=Math.round(Y.baseY),Ga=Math.round(Y.baseX+j*rt),Ao=Math.round(Y.baseY+te*rt),Fo=it+","+ma+","+Ga+","+Ao+","+Math.round(ie);if(Fo===z)return Fo;z===""&&(_.style.display="block"),_.style.setProperty("--r",ie.toFixed(0)+"px"),_.style.transform="translate("+it+"px,"+ma+"px) translate(-50%,-50%)";const un=_.firstElementChild;return un&&(un.style.transform="translate("+(Ga-it)+"px,"+(Ao-ma)+"px) translate(-50%,-50%)"),Fo}function V(){if(h=G(f,a,h),d=G(m,o,d),a.id===null&&o.id===null){l=0;return}l=requestAnimationFrame(V)}function H(){!l&&!c&&(l=requestAnimationFrame(V))}const Q=_=>{if(c)return;let Y=!1;for(let z=0;z<_.changedTouches.length;z++){const j=_.changedTouches[z];if(!v(j.target))continue;const te=j.clientX<window.innerWidth*Il,ie=te?a:o;if(ie.id!==null){F.includes(j.identifier)||F.push(j.identifier),Y=!0;continue}ie.id=j.identifier,ie.baseX=j.clientX,ie.baseY=j.clientY,ie.curX=j.clientX,ie.curY=j.clientY,Y=!0,te?g.classList.add("is-used"):w.classList.add("is-used")}Y&&(i||(i=!0,document.documentElement.classList.add("fa-touch")),q(),$(),H(),_.preventDefault())},C=_=>{if(c)return;let Y=!1;for(let z=0;z<_.changedTouches.length;z++){const j=_.changedTouches[z];j.identifier===a.id?(a.curX=j.clientX,a.curY=j.clientY,Y=!0):j.identifier===o.id?(o.curX=j.clientX,o.curY=j.clientY,Y=!0):F.includes(j.identifier)&&(Y=!0)}Y&&(q(),$(),H(),_.preventDefault())},O=_=>{if(c)return;let Y=!1;for(let z=0;z<_.changedTouches.length;z++){const j=_.changedTouches[z];j.identifier===a.id?(a.id=null,R(a,!0,_.touches),Y=!0):j.identifier===o.id?(o.id=null,R(o,!1,_.touches),Y=!0):F.includes(j.identifier)&&(D(j.identifier),Y=!0)}Y&&(q(),$(),H())};return window.addEventListener("touchstart",Q,{passive:!1}),window.addEventListener("touchmove",C,{passive:!1}),window.addEventListener("touchend",O),window.addEventListener("touchcancel",O),{available:!0,get engaged(){return i},move:n,get moving(){return a.id!==null},aimDir:()=>r?s:null,get firing(){return o.id!==null},clearAim(){o.id===null&&(r=!1)},reset(){a.id=null,o.id=null,F.length=0,n.x=0,n.y=0,r=!1,H()},dispose(){c||(c=!0,cancelAnimationFrame(l),window.removeEventListener("touchstart",Q),window.removeEventListener("touchmove",C),window.removeEventListener("touchend",O),window.removeEventListener("touchcancel",O),F.length=0,e.canvas.style.touchAction=k,x&&(x.style.touchAction=S),document.documentElement.classList.remove("fa-touch","fa-touch-capable"),p.remove())}}}function Hg(){if(document.getElementById(Ll))return;const e=document.createElement("style");e.id=Ll,e.textContent=qg,document.head.appendChild(e)}const qg=`
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
`,Rt={left:["KeyA","ArrowLeft"],right:["KeyD","ArrowRight"],up:["KeyW","ArrowUp"],down:["KeyS","ArrowDown"]},Ji="KeyM",ec=9,jg=.155,Bg=84,Gg=190;function Ug(e){const t=new URLSearchParams(location.search).get(e);if(t===null)return null;const a=Number(t);return Number.isFinite(a)?a:null}class Wg{constructor(t){this.canvas=t;const a=Ug("aimSens");this.sensitivity=a!==null&&a>0?Math.min(6,a):1,this.freeAim=new URLSearchParams(location.search).get("aimMode")==="free",this.touch=Pg({canvas:t}),window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onVisibilityChange),t.addEventListener("mousemove",this.onMouseMove),t.addEventListener("mousedown",this.onMouseDown),window.addEventListener("mouseup",this.onMouseUp),t.addEventListener("contextmenu",this.onContextMenu)}keys=new Set;mouseDown=!1;ndcX=0;ndcY=0;hasMouse=!1;weaponIndex=0;weaponCount=1;locked=!1;offX=0;offY=0;clientX=0;clientY=0;sensitivity;freeAim;touch;touchOffset={x:0,y:0};setWeaponCount(t){this.weaponCount=Math.max(1,t),this.weaponIndex>=this.weaponCount&&(this.weaponIndex=0)}get selectedWeapon(){return this.weaponIndex}selectWeapon(t){!Number.isInteger(t)||t<0||t>=this.weaponCount||(this.weaponIndex=t)}get touchEngaged(){return this.touch.engaged}get attackHeld(){return this.mouseDown||this.touch.firing}get mouseNdc(){return this.hasMouse&&!this.locked?{x:this.ndcX,y:this.ndcY}:null}get pointerLocked(){return this.locked}get aimOffsetPx(){const t=this.touch.aimDir();if(t){const a=this.aimRadiusPx();return this.touchOffset.x=t.x*a,this.touchOffset.y=t.y*a,this.touchOffset}return this.locked?{x:this.offX,y:this.offY}:null}setPointerLocked(t){t!==this.locked&&(this.locked=t,t&&(this.hasMouse?(this.offX=this.clientX-window.innerWidth/2,this.offY=this.clientY-window.innerHeight/2):(this.offX=0,this.offY=-this.aimRadiusPx()),this.clampOffset(),this.hasMouse=!0))}moveAxes(){let t=0,a=0;return this.keyDown(Rt.left)&&(t-=1),this.keyDown(Rt.right)&&(t+=1),this.keyDown(Rt.up)&&(a-=1),this.keyDown(Rt.down)&&(a+=1),this.touch.moving&&(t=Math.max(-1,Math.min(1,t+this.touch.move.x)),a=Math.max(-1,Math.min(1,a+this.touch.move.y))),{x:t,y:a}}reset(){this.keys.clear(),this.mouseDown=!1,this.touch.reset(),this.locked&&(this.offX=0,this.offY=-this.aimRadiusPx())}dispose(){this.touch.dispose(),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onVisibilityChange),this.canvas.removeEventListener("mousemove",this.onMouseMove),this.canvas.removeEventListener("mousedown",this.onMouseDown),window.removeEventListener("mouseup",this.onMouseUp),this.canvas.removeEventListener("contextmenu",this.onContextMenu)}aimRadiusPx(){const t=Math.min(window.innerWidth,window.innerHeight);return Math.max(Bg,Math.min(Gg,t*jg))}clampOffset(){if(this.freeAim){const n=window.innerWidth/2,s=window.innerHeight/2;this.offX=Math.max(-n,Math.min(n,this.offX)),this.offY=Math.max(-s,Math.min(s,this.offY));return}const t=this.aimRadiusPx(),a=Math.hypot(this.offX,this.offY);if(a<=t){a<.001&&(this.offY=-t);return}const o=t/a;this.offX*=o,this.offY*=o}keyDown(t){return t.some(a=>this.keys.has(a))}onKeyDown=t=>{this.keys.add(t.code);const a=Number(t.key);if(Number.isInteger(a)&&a>=1&&a<=ec){const o=a-1;o<this.weaponCount&&(this.weaponIndex=o)}t.code===Ji&&!t.repeat&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&be.toggleMuted()};onKeyUp=t=>{this.keys.delete(t.code)};onMouseMove=t=>{if(this.touch.clearAim(),this.locked){this.offX+=(t.movementX??0)*this.sensitivity,this.offY+=(t.movementY??0)*this.sensitivity,this.clampOffset(),this.hasMouse=!0;return}const a=this.canvas.getBoundingClientRect();this.clientX=t.clientX,this.clientY=t.clientY,this.ndcX=(t.clientX-a.left)/a.width*2-1,this.ndcY=-((t.clientY-a.top)/a.height*2-1),this.hasMouse=!0};onMouseDown=t=>{t.button===0&&(this.mouseDown=!0)};onMouseUp=t=>{t.button===0&&(this.mouseDown=!1)};onBlur=()=>{this.keys.clear(),this.mouseDown=!1,this.touch.reset()};onVisibilityChange=()=>{document.visibilityState==="hidden"&&this.onBlur()};onContextMenu=t=>{t.preventDefault()}}const _l=16241663,Yg=14711797,Vg=12872686,ao=2755399,Xg=.34,wr=3.2,Kg=6.5;function Zg(e){return U.clamp(e*.3,oe,Kg)}const Qg=.5,Le=128,tc=1500,Jg=[{offset:-14,color:_l,alpha:0},{offset:-1,color:_l,alpha:.9},{offset:7,color:Yg,alpha:.85},{offset:34,color:5906060,alpha:.3},{offset:150,color:ao,alpha:.18},{offset:0,absolute:tc,color:ao,alpha:.18}],e1=[{offset:12,color:ao,alpha:0},{offset:44,color:ao,alpha:.6},{offset:140,color:ao,alpha:.72},{offset:0,absolute:tc,color:ao,alpha:.72}];function t1(){const a=document.createElement("canvas");a.width=64,a.height=256;const o=a.getContext("2d"),n=o.createImageData(64,256);let s=2654435769;const r=()=>(s=s*1664525+1013904223>>>0,s/4294967295),i=new Float32Array(64);for(let l=0;l<64;l++)i[l]=.18+.82*r();for(let l=0;l<256;l++){const h=1-l/255,d=Math.pow(1-h,2.6);for(let p=0;p<64;p++){const u=.85+.15*Math.sin(p*.9+h*5),f=Math.max(0,Math.min(1,d*i[p]*u)),m=(l*64+p)*4,g=Math.pow(1-h,3);n.data[m]=255,n.data[m+1]=Math.round(190+65*g),n.data[m+2]=255,n.data[m+3]=Math.round(f*255)}}o.putImageData(n,0,0);const c=new tt(a);return c.wrapS=si,c.wrapT=ri,c.needsUpdate=!0,c}function Dl(e,t,a,o){const n=e.length*Le,s=new Float32Array(n*3),r=new Float32Array(n*4),i=[],c=new Float32Array(Le),l=new Float32Array(Le);for(let m=0;m<Le;m++){const g=m/Le*Math.PI*2;c[m]=Math.cos(g),l[m]=Math.sin(g)}const h=new ia;for(let m=0;m<e.length;m++){h.setHex(e[m].color);for(let g=0;g<Le;g++){const w=m*Le+g;s[w*3+1]=0,r[w*4]=h.r,r[w*4+1]=h.g,r[w*4+2]=h.b,r[w*4+3]=e[m].alpha}}for(let m=0;m<e.length-1;m++)for(let g=0;g<Le;g++){const w=(g+1)%Le;i.push(m*Le+g,(m+1)*Le+g,m*Le+w),i.push(m*Le+w,(m+1)*Le+g,(m+1)*Le+w)}const d=new an,p=new es(s,3);p.setUsage(au),d.setAttribute("position",p),d.setAttribute("color",new es(r,4)),d.setIndex(i),d.boundingSphere=new ou(new le,Ke(tc)*1.2);const u=new K({vertexColors:!0,transparent:!0,depthWrite:!1,side:we,toneMapped:!1}),f=new b(d,u);return f.name=`${o}__no_outline`,f.userData.noOutline=!0,f.renderOrder=a,f.frustumCulled=!1,f.castShadow=!1,f.receiveShadow=!1,f.position.y=t,{mesh:f,setRadius(m){for(let g=0;g<e.length;g++){const w=e[g],y=w.absolute!==void 0?Math.max(w.absolute,m+200):Math.max(0,m+w.offset),x=Ke(y),k=g*Le;for(let S=0;S<Le;S++){const v=(k+S)*3;s[v]=c[S]*x,s[v+2]=l[S]*x}}p.needsUpdate=!0},setOpacity(m){u.opacity=m},dispose(){d.dispose(),u.dispose()}}}function a1(e){const t=new ee;t.name="fog_boundary";const a=Oe(e.x,e.y);t.position.set(a.x,0,a.z),t.frustumCulled=!1;const o=Dl(Jg,Xg,6,"fog_edge"),n=Dl(e1,wr,8,"fog_canopy");t.add(o.mesh);const s=t1(),r=new ve(1,1,1,Le,1,!0),i=new K({map:s,color:Vg,transparent:!0,opacity:.82,depthWrite:!1,side:we,toneMapped:!1}),c=new b(r,i);c.name="fog_curtain__no_outline",c.userData.noOutline=!0,c.renderOrder=7,c.frustumCulled=!1,c.castShadow=!1,c.receiveShadow=!1,t.add(c),t.add(n.mesh);let l=0,h=0;return{root:t,update(d,p,u,f){const m=Math.min(.25,Math.max(0,p-h));if(h=p,l=u&&d>0?1:Math.max(0,l-m/Qg),t.visible=l>.002,!t.visible)return;const w=Math.max(0,d);o.setRadius(w),n.setRadius(w),o.setOpacity(l),n.setOpacity(l);const y=U.degToRad(f.pitchDeg),x=U.degToRad(f.yawDeg),k=wr/Math.max(.2,Math.tan(y));n.mesh.position.set(-Math.sin(x)*k,wr,-Math.cos(x)*k);const S=Ke(w),v=Zg(S);c.scale.set(S,v,S),c.position.y=v/2;const M=2*Math.PI*S;s.repeat.x=Math.max(6,Math.round(M/5)),s.offset.x=p*.035%1,i.opacity=(.82+.1*Math.sin(p*2.1))*l},dispose(){o.dispose(),n.dispose(),r.dispose(),i.dispose(),s.dispose(),t.clear()}}}const o1=180/Math.PI,n1=Math.PI/180,s1=1e-6;function lp(e,t){const a=e[t];return re[a.characterId].hasTrail?e.trailMarks.some(o=>o.ownerRole===t&&Math.hypot(a.x-o.x,a.y-o.y)<At.radius):!1}function is(e,t){return t==="stun"?e.status.stunnedUntil+nu:e.status.slowedUntil+su}function lo(e,t,a,o,n,s){const r=e[t];if(!r.alive)return;const i=n.kind==="weapon"?e[oa(t)]:n.kind==="trail"?e[n.ownerRole]:null,c=i?a*i.damageMul:a;r.hp=Math.max(0,r.hp-c),r.lastDamagedAt=e.elapsed,o==="slow"?e.elapsed>=is(r,"slow")&&(r.status.slowedUntil=e.elapsed+iu):o==="stun"&&e.elapsed>=is(r,"stun")&&(r.status.stunnedUntil=e.elapsed+cu),s.push({type:"hit-landed",targetRole:t,amount:c,effect:o,source:n,x:r.x,y:r.y}),r.hp===0&&(r.alive=!1,s.push({type:"death",fighterRole:t}),e.phase==="playing"&&(e.phase="ended",e.winner=oa(t),s.push({type:"match-ended",winner:e.winner})))}function yr(e,t,a,o,n,s,r,i,c,l,h){const d=Math.atan2(l.y,l.x)+n*n1,p=Math.cos(d),u=Math.sin(d),f=o.speed??0,m=r??o.color,g=i??o.emoji,w=e.nextId++;e.projectiles.push({id:w,ownerRole:t,targetRole:a,weapon:o,x:c.x,y:c.y,vx:p*f,vy:u*f,traveled:0,damage:s,color:m,emoji:g}),h.push({type:"projectile-spawned",id:w,ownerRole:t,weaponKey:o.key,x:c.x,y:c.y,color:m,emoji:g})}function yi(e,t,a,o){if(e.phase!=="playing")return!1;const n=e[t],s=oa(t),r=e[s],c=re[n.characterId].weapons[a];if(!c)return!1;const l=e.elapsed;if(l-n.lastUsed[a]<c.cooldown)return!1;if(n.lastUsed[a]=l,o.push({type:"weapon-fired",fighterRole:t,weaponKey:c.key}),c.type==="self"){const f=(c.healAmount??0)*ru(n.level),m=Math.min(f,n.maxHp-n.hp);return n.hp=Math.min(n.maxHp,n.hp+f),m>0&&o.push({type:"heal",fighterRole:t,amount:m}),!0}if(c.type==="melee"){if(r.hp<=0)return!0;const f=r.x-n.x,m=r.y-n.y,g=Math.hypot(f,m);if(g>(c.range??0))return!0;const w=c.cone??360;if(w<360){if(g<s1)return!0;const y=(n.facing.x*f+n.facing.y*m)/g;if(Math.acos(Math.max(-1,Math.min(1,y)))*o1>w/2)return!0}return lo(e,s,c.damage,c.effect,{kind:"weapon",weaponKey:c.key,weaponName:c.name},o),!0}const h={x:n.x,y:n.y},d=n.facing;if(c.comboParts){for(const f of c.comboParts)yr(e,t,s,c,f.angle,f.damage,f.color,f.emoji,h,d,o);return!0}const u=!!c.trailBoosted&&lp(e,t)?Math.round(c.damage*At.damageBoost):c.damage;if(c.pellets&&c.pellets>1){const f=c.spreadDeg??0;for(let m=0;m<c.pellets;m++){const g=(m-(c.pellets-1)/2)*f,w=c.pelletColors?c.pelletColors[m%c.pelletColors.length]:void 0,y=c.pelletEmojis?c.pelletEmojis[m%c.pelletEmojis.length]:void 0;yr(e,t,s,c,g,u,w,y,h,d,o)}}else yr(e,t,s,c,0,u,void 0,void 0,h,d,o);return!0}function ac(e,t,a,o,n,s,r,i){return Math.abs(e-n)<(a+r)/2&&Math.abs(t-s)<(o+i)/2}function cs(e,t,a,o){for(let n=0;n<o.length;n++){const s=o[n];if(Math.abs(e-s.x)<(a+s.w)/2&&Math.abs(t-s.y)<(a+s.h)/2)return!0}return!1}const r1=[];function i1(e){return e.concealment??r1}function hp(e,t,a){const o=i1(a);for(let n=0;n<o.length;n++){const s=o[n];if(ac(e,t,0,0,s.x,s.y,s.w,s.h))return!0}return!1}function dp(e,t,a,o,n){return hp(a,o,n)?Math.hypot(a-e,o-t)<=lu:!0}const c1=4,$l=.01;function l1(e,t){const a=e.size,o=a/2,n=t.cover;for(let s=0;s<c1;s++){let r=null,i=0;for(let h=0;h<n.length;h++){const d=n[h],p=(a+d.w)/2-Math.abs(e.x-d.x);if(p<=0)continue;const u=(a+d.h)/2-Math.abs(e.y-d.y);if(u<=0)continue;const f=p<u?p:u;f>i&&(i=f,r=d)}if(r===null)return;const c=(a+r.w)/2-Math.abs(e.x-r.x),l=(a+r.h)/2-Math.abs(e.y-r.y);if(c<=l){const h=e.x>=r.x?1:-1;e.x=Math.min(t.width-o,Math.max(o,e.x+h*(c+$l)))}else{const h=e.y>=r.y?1:-1;e.y=Math.min(t.height-o,Math.max(o,e.y+h*(l+$l)))}}}function bi(e,t,a,o){const n=e.size/2,s=e.x,r=e.y;if((t!==0||a!==0)&&l1(e,o),t!==0){const i=Math.min(o.width-n,Math.max(n,e.x+t));cs(i,e.y,e.size,o.cover)||(e.x=i)}if(a!==0){const i=Math.min(o.height-n,Math.max(n,e.y+a));cs(e.x,i,e.size,o.cover)||(e.y=i)}return e.x!==s||e.y!==r}const h1=10,d1=4e4,pp=16,p1=8,u1=4,Nl=new WeakMap;function f1(e,t){const a=Nl.get(e);if(a&&a.size===t&&a.cover===e.cover)return a;let o=h1;for(;Math.ceil(e.width/o)*Math.ceil(e.height/o)>d1;)o*=2;const n=Math.max(1,Math.ceil(e.width/o)),s=Math.max(1,Math.ceil(e.height/o)),r=n*s,i=new Uint8Array(r),c=t/2;for(let h=0;h<s;h++)for(let d=0;d<n;d++){const p=(d+.5)*o,u=(h+.5)*o;p>=c&&p<=e.width-c&&u>=c&&u<=e.height-c&&!cs(p,u,t,e.cover)&&(i[h*n+d]=1)}const l={cell:o,cols:n,rows:s,size:t,cover:e.cover,passable:i,dist:new Int32Array(r),queue:new Int32Array(r),chain:new Int32Array(pp+1),goalCell:-1,requestedGoal:-1};return Nl.set(e,l),l}function br(e,t){const{cols:a,rows:o,passable:n,dist:s,queue:r}=e;s.fill(-1),e.goalCell=t,s[t]=0,r[0]=t;let i=0,c=1;for(;i<c;){const l=r[i++],h=l%a,d=(l-h)/a,p=s[l]+1;for(let u=-1;u<=1;u++){const f=d+u;if(f<0||f>=o)continue;const m=f*a;for(let g=-1;g<=1;g++){if(g===0&&u===0)continue;const w=h+g;if(w<0||w>=a)continue;const y=m+w;n[y]===0||s[y]>=0||g!==0&&u!==0&&(n[d*a+w]===0||n[m+h]===0)||(s[y]=p,r[c++]=y)}}}}function Pl(e,t,a,o,n){const{cols:s,rows:r,passable:i,dist:c}=e;if(t>=0&&t<s&&a>=0&&a<r){const l=a*s+t;if(i[l]===1)return l}for(let l=1;l<=o;l++)for(let h=-l;h<=l;h++){const d=a+h;if(d<0||d>=r)continue;const p=Math.abs(h)===l;for(let u=-l;u<=l;u+=p?1:2*l){const f=t+u;if(f<0||f>=s)continue;const m=d*s+f;if(i[m]===1)return m}}return-1}function Hl(e,t,a,o,n,s){const r=a-e,i=o-t,c=Math.max(1,Math.ceil(Math.hypot(r,i)/(n*.4)));for(let l=1;l<=c;l++){const h=l/c;if(cs(e+r*h,t+i*h,n,s))return!1}return!0}const ea={dirX:0,dirY:0,wpX:0,wpY:0};function m1(e,t,a,o){const n=f1(e,t.size),{cell:s,cols:r,rows:i,dist:c,chain:l}=n,h=t.size/2,d=Math.min(e.width-h,Math.max(h,a)),p=Math.min(e.height-h,Math.max(h,o)),u=Pl(n,Math.min(r-1,Math.max(0,Math.floor(d/s))),Math.min(i-1,Math.max(0,Math.floor(p/s))),p1);if(u<0)return!1;const f=Pl(n,Math.min(r-1,Math.max(0,Math.floor(t.x/s))),Math.min(i-1,Math.max(0,Math.floor(t.y/s))),u1);if(f<0)return!1;if(n.requestedGoal!==u||c[f]<0){if(br(n,u),c[f]<0){br(n,f);let v=f,M=1/0;for(let L=0;L<c.length;L++){if(c[L]<0)continue;const A=L%r,F=(A+.5)*s-d,D=((L-A)/r+.5)*s-p,E=F*F+D*D;E<M&&(M=E,v=L)}br(n,v)}n.requestedGoal=u}if(c[f]<0)return!1;let m=f,g=0;for(;g<pp&&c[m]>0;){const v=m%r,M=(m-v)/r,L=c[m];let A=-1,F=L,D=1/0;for(let E=-1;E<=1;E++){const R=M+E;if(R<0||R>=i)continue;const q=R*r;for(let $=-1;$<=1;$++){if($===0&&E===0)continue;const G=v+$;if(G<0||G>=r)continue;const V=q+G,H=c[V];if(H<0||H>=L||$!==0&&E!==0&&(n.passable[M*r+G]===0||n.passable[q+v]===0))continue;const Q=(G+.5)*s-d,C=(R+.5)*s-p,O=Q*Q+C*C;(H<F||H===F&&O<D)&&(F=H,D=O,A=V)}}if(A<0)break;l[g++]=A,m=A}let w,y;if(g===0)w=d,y=p;else{let v=0;for(let F=1;F<g;F++){const D=l[F],E=D%r,R=(D-E)/r;if(!Hl(t.x,t.y,(E+.5)*s,(R+.5)*s,t.size,e.cover))break;v=F}const M=l[v],L=M%r,A=(M-L)/r;w=(L+.5)*s,y=(A+.5)*s,v===g-1&&c[M]===0&&Hl(t.x,t.y,d,p,t.size,e.cover)&&(w=d,y=p)}const x=w-t.x,k=y-t.y,S=Math.hypot(x,k);return S<1e-6?!1:(ea.dirX=x/S,ea.dirY=k/S,ea.wpX=w,ea.wpY=y,!0)}function ql(e,t,a,o,n,s,r){const i=e.x,c=e.y;let l=t,h=a,d=s,p=r;m1(n,e,s,r)&&(l=ea.dirX,h=ea.dirY,d=ea.wpX,p=ea.wpY);const u=(v,M)=>Math.hypot(v-d,M-p),f=u(i,c);bi(e,l*o,h*o,n);const m=e.x,g=e.y;if(f-u(m,g)>=o*.35)return e.detourSign=0,!0;const w=v=>{e.x=i,e.y=c;const M=-h*v+l*.3,L=l*v+h*.3,A=Math.hypot(M,L)||1;return bi(e,M/A*o,L/A*o,n),Math.hypot(e.x-i,e.y-c)};if(e.detourSign!==0&&w(e.detourSign)>=o*.35)return!0;const y=w(1),x=e.x,k=e.y,S=w(-1);if(y>=S){if(y>=o*.35)return e.detourSign=1,e.x=x,e.y=k,!0}else if(S>=o*.35)return e.detourSign=-1,!0;return e.detourSign=0,e.x=m,e.y=g,m!==i||g!==c}const Tn=400,Un=1e-6,jl=.8,Bl=.6,Qt={x:0,y:0},Ie={dirX:0,dirY:0,navX:0,navY:0};function g1(e,t,a,o,n){Qt.x=0,Qt.y=0;let s=0;for(const d of e.arena.hazards){if(d.kind!=="damage")continue;const p=t-d.x,u=a-d.y,f=Math.hypot(p,u),m=d.radius+Wc;if(f>=m)continue;const g=f>Un?p/f:1,w=f>Un?u/f:0,y=-w*o+g*n>=0?1:-1,x=-w*y,k=g*y,S=Math.min(2,(m-f)/Wc),v=S*gu;Qt.x+=(g*jl+x*Bl)*v,Qt.y+=(w*jl+k*Bl)*v,S>s&&(s=S)}const r=e.arena.center.x,i=e.arena.center.y,c=r-t,l=i-a,h=Math.hypot(c,l);if(h>Un){const d=e.safeRadius-h;if(d<Zs){const p=Math.min(2,(Zs-d)/Zs);Qt.x+=c/h*p*Yc,Qt.y+=l/h*p*Yc,p>s&&(s=p)}}return s}const Gl={melee:!0,ranged:!0,self:!1},w1={melee:!1,ranged:!1,self:!0},y1=(()=>{const e=Math.PI/180,t=new Map,a=o=>{const n=Math.abs(Math.sin(o*e));return n<1e-9?1/0:zd/n};for(const o of Se)for(const n of re[o].weapons){let s=0;const r=[];if(n.type!=="self")if(n.comboParts)for(const i of n.comboParts){const c=a(i.angle);c===1/0?s+=i.damage:r.push({maxDist:c,damage:i.damage})}else{const i=n.damage*(n.peckHits??1),c=n.pellets??1;if(n.type==="melee"||c<=1||n.homing)s=i*c;else{const l=n.spreadDeg??0;for(let h=0;h<c;h++){const d=a((h-(c-1)/2)*l);d===1/0?s+=i:r.push({maxDist:d,damage:i})}}}t.set(n,{always:s,offAxis:r})}return t})();function b1(e,t){const a=y1.get(e);if(!a)return e.damage;let o=a.always;for(const n of a.offAxis)t<n.maxDist&&(o+=n.damage);return o}const Ul=(e,t,a,o)=>b1(t,o),x1=(e,t)=>{const a=e.enemy,o=t.healAmount??0;return o<=0||a.hp>a.maxHp*mu||a.maxHp-a.hp<o?-1/0:o};function xr(e,t,a,o){const n=e.enemy,s=re[n.characterId].weapons,r=e.elapsed;let i=null,c=-1/0;for(let l=0;l<s.length;l++){const h=s[l];if(!a[h.type]||r-n.lastUsed[l]<h.cooldown||t>(h.range??1/0))continue;const d=o(e,h,l,t);d>c&&(c=d,i=l)}return i}function v1(e,t,a){if(e.phase!=="playing")return!1;const o=e.enemy,n=e.player;if(o.hp<=0||n.hp<=0)return!1;const s=e.elapsed,r=dp(o.x,o.y,n.x,n.y,e.arena),i=e.aiSighting;r&&(i.x=n.x,i.y=n.y,i.at=s);const c=i.x,l=i.y,h=c-o.x,d=l-o.y,p=Math.hypot(h,d),u=p||1,f=p>1e-6,m=o.hp<o.maxHp*hu,g=s<o.status.slowedUntil?du:1,w=s<o.status.stunnedUntil;f&&(o.facing={x:h/u,y:d/u});let y=!1;const x=m?-1:1,k=g1(e,o.x,o.y,x*h/u,x*d/u),S=k>=fu,v=(A,F,D,E)=>{if(Ie.dirX=A,Ie.dirY=F,Ie.navX=D,Ie.navY=E,k<=0)return;const R=A+Qt.x,q=F+Qt.y,$=Math.hypot(R,q);$<Un||(Ie.dirX=R/$,Ie.dirY=q/$,Ie.navX=o.x+Ie.dirX*Tn,Ie.navY=o.y+Ie.dirY*Tn)},M=S&&!w,L=M?null:xr(e,u,w1,x1);if(m){if(!w){const F=ci(o.characterId,pu)*t*g;v(-h/u,-d/u,o.x-h/u*Tn,o.y-d/u*Tn),ql(o,Ie.dirX,Ie.dirY,F,e.arena,Ie.navX,Ie.navY),y=!0}const A=L??(r?xr(e,u,Gl,Ul):null);A!==null&&yi(e,"enemy",A,a)}else{const A=M?null:L??(r?xr(e,u,Gl,Ul):null);if(A!==null)yi(e,"enemy",A,a);else if(!w){const F=ci(o.characterId,uu)*t*g;v(h/u,d/u,c,l),ql(o,Ie.dirX,Ie.dirY,F,e.arena,Ie.navX,Ie.navY),y=!0}}return y}const Wl=12;function Yl(e,t,a,o={}){const n=Ut(o.player??ra),s=Ut(o.enemy??ra);return{phase:"countdown",elapsed:0,countdownValue:wu,countdownTick:0,startFlashTimer:0,timeRemaining:aa,safeRadius:e.maxSafeRadius,player:gl("player",t,e.playerSpawn,as(t,li,n),Au,{x:1,y:0},n),enemy:gl("enemy",a,e.enemySpawn,as(a,yu,s),Tu,{x:-1,y:0},s),projectiles:[],splats:[],trailMarks:[],winner:null,arena:e,aiSighting:{x:e.playerSpawn.x,y:e.playerSpawn.y,at:0},nextId:1}}function k1(e,t,a){const o=[];if(e.elapsed+=t,S1(e,t,o),e.phase==="playing"){e.timeRemaining=Math.max(0,e.timeRemaining-t);const n=1-e.timeRemaining/aa;e.safeRadius=Math.max(Es,e.arena.maxSafeRadius*(1-n))}if(E1(e),e.phase==="playing"){T1(e,a),a.attack&&yi(e,"player",a.selectedWeapon,o);const n=A1(e,t,a);Vl(e,"player",t,n,o);const s=v1(e,t,o);Vl(e,"enemy",t,s,o)}return F1(e,t,o),e.phase==="playing"&&e.timeRemaining<=0&&M1(e,o),o}function M1(e,t){const{player:a,enemy:o,arena:n}=e,s=a.maxHp>0?a.hp/a.maxHp:0,r=o.maxHp>0?o.hp/o.maxHp:0;let i;if(s!==r)i=s>r?"player":"enemy";else{const c=Math.hypot(a.x-n.center.x,a.y-n.center.y),l=Math.hypot(o.x-n.center.x,o.y-n.center.y);i=c<=l?"player":"enemy"}e.phase="ended",e.winner=i,t.push({type:"match-ended",winner:i})}function S1(e,t,a){e.phase==="countdown"&&(e.countdownTick+=t,e.countdownTick>=1e3&&(e.countdownTick-=1e3,e.countdownValue-=1,e.countdownValue>0?a.push({type:"countdown-tick",value:e.countdownValue}):(e.startFlashTimer=bu,a.push({type:"countdown-tick",value:0}))),e.countdownValue<=0&&(e.startFlashTimer-=t,e.startFlashTimer<=0&&(e.phase="playing",e.timeRemaining=aa,e.safeRadius=e.arena.maxSafeRadius,a.push({type:"match-started"}))))}function E1(e){for(let t=e.splats.length-1;t>=0;t--)e.elapsed>=e.splats[t].expiresAt&&e.splats.splice(t,1);for(let t=e.trailMarks.length-1;t>=0;t--)e.elapsed>=e.trailMarks[t].expiresAt&&e.trailMarks.splice(t,1)}function up(e,t){let a=1;for(const o of e.arena.hazards)o.kind==="slow"&&Math.hypot(t.x-o.x,t.y-o.y)<o.radius&&(a=Math.min(a,o.slowFactor??Vc));for(const o of e.splats)Math.hypot(t.x-o.x,t.y-o.y)<hi&&(a=Math.min(a,Vc));return a}function T1(e,t){if(!t.aim)return;const a=Math.hypot(t.aim.x,t.aim.y);a>1e-6&&(e.player.facing={x:t.aim.x/a,y:t.aim.y/a})}function A1(e,t,a,o){const n=e.player,s=e.elapsed;let r=up(e,n);lp(e,"player")&&(r*=At.speedBoost),s<n.status.slowedUntil&&(r*=Fu);const c=s<n.status.stunnedUntil?0:ci(n.characterId,Mu)*t*r,l=a.move.x*c,h=a.move.y*c;return bi(n,l,h,e.arena),l!==0||h!==0}function Vl(e,t,a,o,n){const s=e[t];if(!s.alive)return;s.terrainSlowFactor=up(e,s),s.concealed=hp(s.x,s.y,e.arena);const r=re[s.characterId],i=oa(t),c=e[i];if(r.hasTrail&&o){if(s.trailDropTimer+=a,s.trailDropTimer>=At.dropIntervalMs){s.trailDropTimer=0;const h={id:e.nextId++,ownerRole:t,x:s.x,y:s.y,expiresAt:e.elapsed+At.durationMs,damaged:!1};e.trailMarks.push(h),n.push({type:"trail-mark-created",ownerRole:t,x:s.x,y:s.y})}}else s.trailDropTimer=0;if(c.alive){let h=0;for(const d of e.trailMarks)if(!(d.ownerRole!==t||d.damaged)&&!(Math.hypot(c.x-d.x,c.y-d.y)>=At.radius)&&(d.damaged=!0,!(h>=At.maxHitsPerTick)&&(h++,lo(e,i,At.damage,null,{kind:"trail",ownerRole:t},n),!c.alive)))break}if(e.arena.hazards.forEach((h,d)=>{if(h.kind!=="damage")return;if(Math.hypot(s.x-h.x,s.y-h.y)<h.radius){const u=(s.hazardTimers[d]??0)+a;u>=(h.tickMs??1/0)?(s.hazardTimers[d]=0,lo(e,t,h.damage??0,null,{kind:"hazard"},n)):s.hazardTimers[d]=u}else s.hazardTimers[d]=0}),e.elapsed-s.lastDamagedAt>xu&&s.hp<s.maxHp&&s.hp>0){if(s.regenTimer+=a,s.regenTimer>=vu){s.regenTimer=0;const h=s.hp;s.hp=Math.min(s.maxHp,s.hp+Cd),s.hp>h&&n.push({type:"heal",fighterRole:t,amount:s.hp-h})}}else s.regenTimer=0;Math.hypot(s.x-e.arena.center.x,s.y-e.arena.center.y)>e.safeRadius&&s.hp>0?(s.fogTimer+=a,s.fogTimer>=Id&&(s.fogTimer=0,lo(e,t,Ld,null,{kind:"fog"},n))):s.fogTimer=0}function An(e,t,a,o){const n=e.projectiles[t];o.push({type:"projectile-destroyed",id:n.id,reason:a,x:n.x,y:n.y}),e.projectiles.splice(t,1)}function Xl(e,t,a,o){const n={id:e.nextId++,x:t,y:a,expiresAt:e.elapsed+Su};e.splats.push(n),o.push({type:"splat-created",x:t,y:a})}function F1(e,t,a){for(let o=e.projectiles.length-1;o>=0;o--){const n=e.projectiles[o],s=n.weapon,r=e[n.targetRole],i=n.targetRole==="player"?zd:ku;if(s.peckHits&&n.arrived){if(r.hp<=0){An(e,o,"expired",a);continue}n.peckTimer=(n.peckTimer??0)+t,n.peckTimer>=(s.peckInterval??500)&&(n.peckTimer=0,lo(e,n.targetRole,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name},a),n.hitsSoFar=(n.hitsSoFar??1)+1,n.hitsSoFar>=s.peckHits&&An(e,o,"expired",a));continue}if(s.homing&&r.hp>0&&dp(n.x,n.y,r.x,r.y,e.arena)){const u=r.x-n.x,f=r.y-n.y,m=Math.hypot(u,f)||1,g=u/m,w=f/m,y=Math.hypot(n.vx,n.vy)||1,x=n.vx/y,k=n.vy/y,S=Math.min(1,Eu*t),v=x+(g-x)*S,M=k+(w-k)*S,L=Math.hypot(v,M)||1,A=s.speed??0;n.vx=v/L*A,n.vy=M/L*A}const c=n.vx*t/1e3,l=n.vy*t/1e3,h=n.x+c,d=n.y+l,p=e.arena.cover.some(u=>ac(h,d,Wl,Wl,u.x,u.y,u.w,u.h));if(n.traveled+=Math.hypot(c,l),n.x=h,n.y=d,p||n.traveled>=(s.range??1/0)){s.splatter&&Xl(e,n.x,n.y,a),An(e,o,p?"hit-cover":"expired",a);continue}if(r.hp>0&&Math.hypot(n.x-r.x,n.y-r.y)<i){if(lo(e,n.targetRole,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name},a),s.splatter&&Xl(e,n.x,n.y,a),s.peckHits){n.arrived=!0,n.peckTimer=0,n.hitsSoFar=1;continue}An(e,o,"hit-target",a);continue}}}const Kl="pointerlock-styles",R1=2600;function fp(){const e=new URLSearchParams(location.search);return e.get("pointerLock")??e.get("pointerlock")}function C1(){const e=fp();if(e==="0")return!1;if(e==="1"||e==="sim")return!0;const t=new URLSearchParams(location.search);return!(t.has("shot")||t.has("simSpeed"))}function z1(){return typeof window.matchMedia!="function"?!0:window.matchMedia("(pointer: fine)").matches}function I1(e){const{target:t}=e,a=fp()==="sim";let o=!1;const s=typeof document<"u"&&"pointerLockElement"in document&&typeof t.requestPointerLock=="function"&&z1()&&C1();let r=!1,i=!1,c=!0,l="hidden",h=0,d=!1,p=!1,u="";const f=document.createElement("div");f.className="plk-root",f.innerHTML=`
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
  `;const m=H=>f.querySelector(`[data-el="${H}"]`),g=m("fs"),w=m("fs2");function y(){return a?o:document.pointerLockElement===t}function x(){window.__plockDebug={state:l,wantsLock:r,locked:y(),pending:p,lastError:u,available:s}}function k(){f.classList.toggle("is-prompt",l==="prompt"),f.classList.toggle("is-toast",l==="toast"),f.classList.toggle("is-lost",l==="lost"),x()}function S(H){l!==H&&(l=H,window.clearTimeout(h),H==="toast"&&(h=window.setTimeout(()=>{!d&&l==="toast"&&S("hidden")},R1)),k())}function v(){const Q=!!document.fullscreenElement?"⛶ Exit fullscreen":"⛶ Fullscreen";g.textContent=Q,w.textContent=Q}function M(){try{document.fullscreenElement?document.exitFullscreen?.()?.catch(()=>{}):document.documentElement.requestFullscreen?.()?.catch(()=>{})}catch{}}function L(H){u=H===void 0?"refused":String(H?.message??H),x(),!(d||!r||y())&&(e.pause(),S("lost"))}function A(){if(!(d||!s||!r||y()||p)){if(a){o=!0,R();return}p=!0;try{const H=t.requestPointerLock();H&&typeof H.then=="function"?H.then(()=>{p=!1},Q=>{p=!1,L(Q)}):window.setTimeout(()=>{p=!1},0)}catch(H){p=!1,L(H)}}}function F(){if(y()){if(i=!0,a){o=!1,R();return}try{document.exitPointerLock()}catch{i=!1}}}function D(){r=!0,e.resume()}function E(){r=!1,F(),S("prompt"),e.resume()}const R=()=>{if(d)return;const H=y();if(e.onLockChange(H),p=!1,H){r=!0,i=!1,S("toast");return}if(i){i=!1,S(c&&s?"prompt":"hidden");return}r?(e.pause(),S("lost")):S(c&&s?"prompt":"hidden")},q=()=>{p=!1,!d&&L("pointerlockerror")},$=()=>{d||!r||!s||y()||l!=="lost"&&(e.pause(),S("lost"))},G=()=>v(),V=H=>{d||!o||H.key!=="Escape"||(H.preventDefault(),H.stopImmediatePropagation(),o=!1,R())};return s&&(L1(),document.body.appendChild(f),document.addEventListener("pointerlockchange",R),document.addEventListener("pointerlockerror",q),document.addEventListener("fullscreenchange",G),window.addEventListener("blur",$),a&&window.addEventListener("keydown",V,!0),m("capture").addEventListener("click",H=>{H.stopPropagation(),D()}),m("resume").addEventListener("click",H=>{H.stopPropagation(),D()}),m("scrim").addEventListener("click",()=>D()),m("free").addEventListener("click",H=>{H.stopPropagation(),E()}),g.addEventListener("click",H=>{H.stopPropagation(),M()}),w.addEventListener("click",H=>{H.stopPropagation(),M()}),v(),S("prompt"),k()),{available:s,get locked(){return s&&y()},engage:A,release:F,setMatchActive(H){!s||c===H||(c=H,H?y()||S("prompt"):(F(),S("hidden")))},dispose(){d||(d=!0,window.clearTimeout(h),s&&(F(),document.removeEventListener("pointerlockchange",R),document.removeEventListener("pointerlockerror",q),document.removeEventListener("fullscreenchange",G),window.removeEventListener("blur",$),window.removeEventListener("keydown",V,!0),f.remove()))}}}function L1(){if(document.getElementById(Kl))return;const e=document.createElement("style");e.id=Kl,e.textContent=O1,document.head.appendChild(e)}const O1=`
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
`,Ct=.11,Zl=oe*.1,mp=new yt(Ct,12,10);mp.scale(1,.86,1);const _1=new vo(Ct*.32,Ct*.5,6),ho=new Ts(Ct*.6,0);ho.scale(1,.4,1);const D1=new K({color:"#E63946"}),$1=new K({color:"#3E5C2B"}),N1=new K({color:"#FF9E9E",transparent:!0,opacity:.55,depthWrite:!1});function oc(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const P1=oc(18,()=>new K({color:"#E63946",transparent:!0,opacity:.85,depthWrite:!1})),H1=oc(20,()=>new K({color:"#C21F32",transparent:!0,opacity:.9,depthWrite:!1})),Ql=oc(6,()=>new K({color:"#FFD9C7",transparent:!0,opacity:.95,blending:et,depthWrite:!1}));function q1(e){const t=new ee,a=new b(mp,D1);t.add(a);const o=new b(_1,$1);o.position.set(0,Ct*.75,0),t.add(o);const n=new b(ho,N1);return n.scale.setScalar(.55),n.position.set(Ct*.32,Ct*.28,Ct*.5),t.add(n),t}function vr(e,t,a,o,n,s=1){const r=new b(ho,H1()),i=(.3+Math.random()*.25)*s;r.scale.setScalar(i),r.position.copy(t);const c=t.x,l=t.y,h=t.z,d=1.1+Math.random()*1.3,p=-5.5,u=.32+Math.random()*.16;e.spawnTransient(r,u,(f,m)=>{r.position.set(c+a*n*m,l+d*m+.5*p*m*m,h+o*n*m),r.scale.setScalar(i*(1-f*.35)),r.material.opacity=.9*(1-f)})}const j1={Tomato:{projectile(e){const t=q1(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=(t.userData.__spin??0)+a*8;t.userData.__spin=o,t.rotation.x=o,t.rotation.z=Math.sin(o*.6)*.25;const n=1+Math.sin(o*2.2)*.09;t.scale.set(1/n,n,1/n);const s=(t.userData.__dripTimer??.05)-a;s<=0?(t.userData.__dripTimer=.09+Math.random()*.05,vr(e,e.position,-e.direction.x*.5,-e.direction.z*.5,.3+Math.random()*.25)):t.userData.__dripTimer=s},impact(e){const t=e.position,a=U.clamp(1+e.damage*.05,1,2.2),o=Zl/(Ct*.6),n=new b(ho,Ql());n.position.copy(t),n.scale.setScalar(.7*o),e.spawnTransient(n,.18,i=>{n.scale.setScalar(U.lerp(.7,2.4,i)*o*a),n.material.opacity=.9*(1-i)});const s=7,r=Pi*.45;for(let i=0;i<s;i++){const c=i/s*Math.PI*2+Math.random()*.5,l=r+(.5+Math.random()*.75)*a,h=new b(ho,P1()),d=(.55+Math.random()*.4)*o*a,p=t.x+Math.cos(c)*r,u=t.y,f=t.z+Math.sin(c)*r;h.position.set(p,u,f),h.rotation.y=Math.random()*Math.PI*2;const m=t.x+Math.cos(c)*l,g=t.z+Math.sin(c)*l,w=u-.9;e.spawnTransient(h,.55+Math.random()*.2,y=>{const x=1-Math.pow(1-y,3);h.position.set(U.lerp(p,m,x),U.lerp(u,w,Math.min(1,x*1.3)),U.lerp(f,g,x)),h.scale.setScalar(d*(1-y*.3)),h.material.opacity=.85*(1-Math.pow(y,1.5))})}for(let i=0;i<5;i++){const c=Math.random()*Math.PI*2;vr(e,t,Math.cos(c),Math.sin(c),1.3+Math.random()*1.1,o)}},cast(e){const t=Zl/(Ct*.6),a=new b(ho,Ql()),o=a.material;o.color.set(e.color),a.position.copy(e.position),a.scale.setScalar(.16*t),e.spawnTransient(a,.15,n=>{a.scale.setScalar(U.lerp(.16,.62,n)*t),o.opacity=.9*(1-n)});for(let n=0;n<3;n++){const s=(Math.random()-.5)*.6;vr(e,e.position,e.direction.x+s,e.direction.z+s,.9+Math.random()*.5,t*.35)}}}},nc="#C93F73",B1="#F0C070",zs="#FFF0F6",G1="#FFD9EC",xi=["#E63946","#7CB518","#FFC93C","#7C4DFF","#2E86D8","#FFFFFF"],nt=oe,Ia=Math.PI*2,ls=.28,wt=nt*.09,Bt=nt*.043,U1=nt*.014,W1=nt*.042,Fn=nt*.375,Rn=nt*.4;function po(e,t,a,o,n){const s=new qi(e,t,a,o,n);return s.rotateX(-Math.PI/2),s}const Y1=po(wt,Bt,8,22),V1=po(wt,Bt*.82,8,22),X1=po(wt,Bt*1.3,8,22),Jl=[po(wt*.92,Bt*.86,6,8,1.5),po(wt*1.05,Bt*.72,6,8,1),po(wt*.8,Bt*.95,6,7,2.1)];let K1=0;const Z1=()=>Jl[K1++%Jl.length],gp=new Hi(U1,W1,3,6);function wp(e,t=40){const a=new Aa(e,1,t,1);return a.rotateX(-Math.PI/2),a}const Q1=wp(.84),J1=wp(.7);function ko(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const Mo=(e,t,a={})=>new K({color:e,transparent:!0,opacity:t,depthWrite:!1,side:we,...a}),eh=new K({color:"#FF6FA5"}),ew=new K({color:B1}),tw=new K({color:nc}),th=xi.map(e=>new K({color:e})),aw=ko(18,()=>Mo(nc,1)),ow=ko(18,()=>Mo("#FF6FA5",1)),nw=ko(30,()=>Mo("#FFFFFF",1)),sw=ko(24,()=>Mo(zs,.7)),rw=ko(20,()=>Mo(zs,.7,{blending:et})),iw=ko(24,()=>Mo(zs,1)),yp=new le(0,1,0),ah=new le,kr=new As,oh=new As;function cw(e,t,a,o,n){kr.setFromAxisAngle(yp,o);const s=Math.hypot(t,a);Math.abs(n)>1e-4&&s>1e-4?(ah.set(a/s,0,-t/s),oh.setFromAxisAngle(ah,n),e.quaternion.copy(oh).multiply(kr)):e.quaternion.copy(kr)}function lw(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function hw(e,t,a){let o=e.userData.__ring;return o||(o={spin:Math.random()*Ia,rate:a*Ia/lw(t),shed:0,echo:0},e.userData.__ring=o),o}function ya(e,t,a,o,n,s,r,i,c,l={}){const h=l.hard?iw():l.glow?rw():sw();h.color.set(r),h.opacity=i;const d=new b(l.band?J1:Q1,h);d.renderOrder=l.renderOrder??9,d.position.set(t,a,o),d.rotation.y=Math.random()*Ia,d.scale.set(n,1,n);const p=l.fadePow??1,u=l.hold??0;e.spawnTransient(d,c,f=>{const m=U.lerp(n,s,1-Math.pow(1-f,2.4));d.scale.set(m,1,m),h.opacity=f<u?i:i*(1-Math.pow((f-u)/(1-u),p))})}function Mr(e,t,a,o,n,s,r,i,c=1){const l=nw();l.color.set(xi[Math.random()*xi.length|0]),l.opacity=1;const h=new b(gp,l);h.renderOrder=9,h.position.set(t,a,o),h.scale.setScalar(c);const d=(Math.random()-.5)*26,p=(Math.random()-.5)*26,u=-9;e.spawnTransient(h,i,(f,m)=>{h.position.set(t+n*m,Math.max(ls,a+s*m+.5*u*m*m),o+r*m),h.rotation.set(d*m,0,p*m),l.opacity=1-Math.pow(f,2.4)})}function dw(e,t,a,o,n,s,r){const i=new ee,c=aw();c.color.set(nc),c.opacity=1;const l=Z1(),h=new b(l,c);h.scale.setScalar(1.28),i.add(h);const d=ow();d.color.set(a),d.opacity=1,i.add(new b(l,d)),i.renderOrder=9,i.position.copy(t),i.scale.setScalar(s);const p=t.x,u=t.y,f=t.z,m=Math.cos(o)*n,g=Math.sin(o)*n,w=1.5+Math.random()*1.2,y=-8.5,x=(Math.random()-.5)*20,k=(Math.random()-.5)*20;e.spawnTransient(i,r,(S,v)=>{i.position.set(p+m*v,Math.max(ls,u+w*v+.5*y*v*v),f+g*v),i.rotation.set(x*v,0,k*v);const M=1-Math.pow(S,2.2);d.opacity=M,c.opacity=M})}function pw(e){return U.clamp(.85+e*.035,.85,1.25)}function uw(e){const t=new ee,a=new b(X1,tw);a.position.y=-nt*.007,t.add(a),t.add(new b(Y1,ew)),eh.color.set(e);const o=new b(V1,eh);o.position.y=Bt*.36,t.add(o);const n=Math.random()*Ia;for(let s=0;s<5;s++){const r=n+s/5*Ia+(Math.random()-.5)*.6,i=new b(gp,th[Math.random()*th.length|0]);i.position.set(Math.cos(r)*wt,Bt*1.05,Math.sin(r)*wt),i.quaternion.setFromAxisAngle(yp,-r),i.rotateX(Math.PI/2),i.scale.setScalar(1.05),t.add(i)}return t.userData.__isCandyRing=!0,t}const fw={Candy:{projectile(e){const t=uw(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=hw(t,e.weapon,2.4);if(o.spin+=o.rate*a,cw(t,e.direction.x,e.direction.z,o.spin,.13+Math.sin(o.spin*.41)*.08),t.position.y+=Math.sin(o.spin*.62)*nt*.011,o.echo-=a,o.echo<=0){o.echo=.075;const n=wt+Bt;ya(e,e.position.x,e.position.y,e.position.z,n,n*1.45,G1,.55,.2,{glow:!0,fadePow:1.4})}o.shed-=a,o.shed<=0&&(o.shed=.085+Math.random()*.05,Mr(e,e.position.x-e.direction.x*wt,e.position.y,e.position.z-e.direction.z*wt,-e.direction.x*.6+(Math.random()-.5)*.6,.15+Math.random()*.35,-e.direction.z*.6+(Math.random()-.5)*.6,.34,.85))},impact(e){const t=pw(e.damage),{x:a,y:o,z:n}=e.position;ya(e,a,o,n,Fn*.8*t,Fn*t,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,fadePow:1.1,hold:.45}),ya(e,a,o,n,Fn*.62*t,Fn*.86*t,e.color,1,.19,{hard:!0,renderOrder:11,fadePow:1.4,hold:.3}),ya(e,a,ls,n,Rn*.2*t,Rn*t,e.color,.95,.3,{hard:!0,renderOrder:7,fadePow:1.6,hold:.35}),ya(e,a,ls-.01,n,Rn*.16*t,Rn*.86*t,zs,.9,.34,{hard:!0,band:!0,renderOrder:6,fadePow:1.4,hold:.3});for(let s=0;s<3;s++){const r=s/3*Ia+Math.random()*.9;dw(e,e.position,e.color,r,(2.3+Math.random()*1.5)*t,(1.05+Math.random()*.5)*t,.36+Math.random()*.12)}for(let s=0;s<8;s++){const r=Math.random()*Ia,i=(2.2+Math.random()*1.8)*t;Mr(e,a,o,n,Math.cos(r)*i+e.direction.x*.9,2.5+Math.random()*1.6,Math.sin(r)*i+e.direction.z*.9,.4+Math.random()*.14,1.1+Math.random()*.6)}},cast(e){ya(e,e.position.x,e.position.y,e.position.z,nt*.06,nt*.2,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,hold:.3}),ya(e,e.position.x,e.position.y,e.position.z,nt*.03,nt*.13,e.color,.95,.13,{hard:!0,band:!0,renderOrder:11,hold:.25});for(let t=0;t<4;t++)Mr(e,e.position.x,e.position.y,e.position.z,e.direction.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.7+Math.random()*.6,e.direction.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.3,.85)}}},on="#F2A73E",sc="#B96F16",bp="#E9C078",rc="#4E2C1B",xp="#E63946",vp="#8FCB1E",Is="#EFE2FA",kp="#C9A9E4",Mp="#CDB0EE",ge=oe,_e=Math.PI*2,hs=.29,mo=ge*.085,Ls=ge*.105,Sr=ge*.032,de=ge*.105,Nt=ge*.07,ka=ge*.036,xe=ge*.125,mw=ge*.33;function uo(e,t=7){return new ve(1,1,1,t,1,!0,-e/2,e)}const go=[uo(1.1),uo(1.7),uo(2.3)];let gw=0;const ww=()=>go[gw++%go.length],vi=uo(2.7,9),Sp=uo(2.9,12),ki=new Ts(1,0),Ep=new ji(1,0),Mi=new pt(1,1,1),nh=new yt(1,14,10),yw=new yt(1,16,10,0,Math.PI*1.5),bw=new qi(1,.062,5,20),sh=new vo(1,1,6),xw=uo(2.2,7),vw=(()=>{const t=document.createElement("canvas");t.width=t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.85)"),o.addColorStop(.42,"rgba(255,255,255,0.44)"),o.addColorStop(.76,"rgba(255,255,255,0.12)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new tt(t);return n.colorSpace=$i,n})();function So(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const nn=(e,t={})=>new K({color:e,transparent:!0,opacity:1,depthWrite:!1,side:we,...t}),ic=So(26,()=>nn(on)),Tp=So(34,()=>nn(bp)),Cn=So(30,()=>nn(rc)),kw=So(12,()=>nn(kp)),Ap=So(20,()=>nn("#FFF3D6")),Mw=So(14,()=>new qt({map:vw,color:Mp,transparent:!0,opacity:.3,depthWrite:!1})),Yt=(e,t={})=>new K({color:e,side:we,...t}),rh=Yt("#6B3E26"),Sw=Yt(rc),Ew=Yt(on),Tw=Yt(sc),ih=Yt(vp),Aw=Yt(xp),ch=Yt("#B497D6"),Fw=Yt(kp),Er=Yt(Is);function Rw(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Tr(e){const t=e.weapon.comboParts;if(!t)return-1;const a=t.findIndex(o=>o.color===e.color&&o.damage===e.damage);return a>=0?a:t.findIndex(o=>o.color===e.color)}function Fp(e){return U.clamp(.85+e*.035,.85,1.45)}function Rp(e,t,a){let o=e.userData.__tumble;return o||(o={t:Math.random()*_e,rate:a*_e/Rw(t),shed:0},e.userData.__tumble=o),o}function oo(e,t,a,o,n,s,r,i,c,l,h,d,p,u,f=-9){a.color.set(o),a.opacity=1;const m=new b(t,a);m.renderOrder=9,m.position.set(n,s,r),m.scale.set(h,d,p),m.rotation.set(Math.random()*_e,Math.random()*_e,Math.random()*_e);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,y=(Math.random()-.5)*20,x=m.rotation.x,k=m.rotation.y,S=m.rotation.z;e.spawnTransient(m,u,(v,M)=>{const L=s+c*M+.5*f*M*M,A=L<=hs;m.position.set(n+i*M,A?hs:L,r+l*M),A||m.rotation.set(x+g*M,k+w*M,S+y*M),a.opacity=1-Math.pow(v,2.4)})}function Cp(e,t,a,o,n,s,r,i,c){oo(e,ww(),ic(),Math.random()<.35?sc:on,t,a,o,n,s,r,mo*i,Ls*i,mo*i,c)}function Os(e,t,a,o,n,s,r,i,c){oo(e,Ep,Tp(),bp,t,a,o,n,s,r,Sr*i,Sr*i,Sr*i,c)}function _s(e,t,a,o,n,s,r,i,c,l){if(t==="lettuce")oo(e,vi,Cn(),vp,a,o,n,s,r,i,Nt*c,Nt*.42*c,Nt*c,l,-6.5);else if(t==="tomato")oo(e,Mi,Cn(),xp,a,o,n,s,r,i,ka*c,ka*c,ka*c,l);else if(t==="onion")oo(e,Mi,Cn(),Is,a,o,n,s,r,i,ka*1.3*c,ka*.4*c,ka*1.3*c,l);else{const h=de*(.45+Math.random()*.3)*c;oo(e,ki,Cn(),Math.random()<.4?rc:"#6B3E26",a,o,n,s,r,i,h,h*.8,h*1.15,l)}}function cc(e,t,a,o,n){const s=Ap();s.color.set("#FFF3D6"),s.opacity=1;const r=new b(Ep,s);r.renderOrder=12,r.position.set(t,a,o),r.rotation.set(Math.random()*_e,Math.random()*_e,0),r.scale.setScalar(n*.6),e.spawnTransient(r,.12,i=>{r.scale.setScalar(n*U.lerp(.6,1.3,i)),s.opacity=i<.4?1:1-(i-.4)/.6})}function zp(e,t){const{x:a,y:o,z:n}=e.position,s=e.direction,r=Math.random()*_e;for(let i=0;i<5;i++){const c=r+i/5*_e,l=Ap();l.color.set(i%2===0?"#FFF3D6":"#FFD27A"),l.opacity=1;const h=new b(go[i%go.length],l);h.renderOrder=12;const d=Math.cos(c),p=Math.sin(c),u=ge*.11*t,f=ge*.44*t,m=Math.atan2(d,p);e.spawnTransient(h,.13,g=>{const w=1-Math.pow(1-g,2.2),y=U.lerp(u,f,w);h.position.set(a+d*y+s.x*y*.3,o,n+p*y+s.z*y*.3);const x=(1-g*.45)*t;h.rotation.set(0,m,0),h.scale.set(mo*1.15*x,Ls*1*x,mo*1.15*x),l.opacity=g<.45?1:1-(g-.45)/.55})}}function lh(e,t,a,o,n,s,r,i=.3){const c=new io(Mw()),l=c.material;l.color.set(Mp),l.opacity=0,c.renderOrder=10;const h=(Math.random()-.5)*n*1.4,d=(Math.random()-.5)*n*1.4;c.position.set(t,a,o),c.scale.set(n,n,1),e.spawnTransient(c,r,p=>{const u=1-Math.pow(1-p,2);c.position.set(t+h*u,a+s*u,o+d*u);const f=n*(1+u*.9);c.scale.set(f,f,1),l.opacity=i*Math.sin(Math.min(1,p*1.25)*Math.PI)})}function Cw(e,t,a,o){const{x:n,y:s,z:r}=e.position,i=e.direction;let c=-i.z,l=i.x;Math.hypot(c,l)<1e-4&&(c=1,l=0);for(const h of[-1,1]){const d=ic();d.color.set(h<0?on:sc),d.opacity=1;const p=new b(Sp,d);p.renderOrder=9;const u=n+c*h*ge*.24*t,f=r+l*h*ge*.24*t;p.position.set(u,s,f);const m=mo*2.1*t;p.scale.set(m,Ls*1.9*t,m);const g=c*h*a+i.x*a*.35,w=l*h*a+i.z*a*.35,y=1.5+Math.random()*.9,x=h*(7+Math.random()*5),k=(Math.random()-.5)*6;e.spawnTransient(p,o,(S,v)=>{const M=s+y*v-4.6*v*v;p.position.set(u+g*v,Math.max(hs,M),f+w*v),p.rotation.set(k*v,x*v,h*.5),d.opacity=1-Math.pow(S,2.2)})}}function hh(e){const t=new ee;rh.color.set(e);const a=new b(ki,rh);a.scale.set(de,de*.85,de*1.18),a.rotation.set(.6,.4,.2),t.add(a);const o=new b(ki,Sw);o.scale.setScalar(de*.62),o.position.set(de*.55,-de*.4,-de*.3),o.rotation.set(1.1,.3,.8),t.add(o);const n=new b(vi,ih);n.scale.set(Nt*1.15,Nt*.4,Nt*1.15),n.position.set(-de*.45,de*.55,de*.2),n.rotation.set(.9,.7,-.5),t.add(n);for(const[c,l,h]of[[.8,.3,.5],[-.55,-.25,-.8]]){const d=new b(Mi,Aw);d.scale.setScalar(ka*1.45),d.position.set(de*c,de*l,de*h),d.rotation.set(Math.random(),Math.random(),Math.random()),t.add(d)}const s=new b(vi,ih);s.scale.set(Nt*.8,Nt*.3,Nt*.8),s.position.set(de*.3,-de*.15,-de*.7),s.rotation.set(-.6,1.9,.8),t.add(s);const r=new b(go[2],Ew);r.scale.set(de*1.02,de*1.25,de*1.02),r.position.set(-de*.25,-de*.72,-de*.1),r.rotation.set(1.5,.4,.15),t.add(r);const i=new b(go[0],Tw);return i.scale.set(de*.7,de*.85,de*.7),i.position.set(de*.75,-de*.35,de*.45),i.rotation.set(.9,2.2,-.6),t.add(i),t}function dh(e){const t=new ee;ch.color.set(e);const a=new b(nh,ch);a.scale.set(xe,xe*.92,xe),t.add(a);const o=new ee;for(let r=0;r<3;r++){const i=new b(bw,Er);i.scale.set(xe*1.01,xe*.93,xe*1.01),i.rotation.y=r/3*Math.PI,o.add(i)}t.add(o);const n=new b(sh,Er);n.scale.set(xe*.42,xe*.62,xe*.42),n.position.y=xe*1.06,n.rotation.z=.18,t.add(n);for(let r=0;r<3;r++){const i=r/3*_e+.4,c=new b(sh,Fw);c.scale.set(xe*.09,xe*.34,xe*.09),c.position.set(Math.cos(i)*xe*.2,-xe*1,Math.sin(i)*xe*.2),c.rotation.set(Math.PI+(Math.random()-.5)*.6,0,(Math.random()-.5)*.6),t.add(c)}const s=new b(nh,Er);return s.scale.set(xe*.42,xe*.2,xe*.42),s.position.set(xe*.42,xe*.62,-xe*.3),t.add(s),t.userData.__bands=o,t}function ph(e,t){const a=e.object;if(!a)return;const o=e.dt??0,n=Rp(a,e.weapon,t);if(n.t+=n.rate*o,a.rotation.x=n.t,a.rotation.z=Math.sin(n.t*.63)*.9,n.shed-=o,n.shed<=0){n.shed=.06+Math.random()*.04;const s=Math.random(),r=s<.45?"meat":s<.72?"tomato":"lettuce",i=e.position.x-e.direction.x*de,c=e.position.z-e.direction.z*de;_s(e,r,i,e.position.y-de*.4,c,-e.direction.x*.5+(Math.random()-.5)*.7,-.2-Math.random()*.4,-e.direction.z*.5+(Math.random()-.5)*.7,.85,.34),Math.random()<.55&&Os(e,i,e.position.y,c,-e.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-e.direction.z*.7+(Math.random()-.5)*.6,.9,.3)}}function uh(e,t){const a=Fp(e.damage)*t,{x:o,y:n,z:s}=e.position,r=e.direction;cc(e,o,n,s,ge*.24*a),zp(e,a),Cw(e,a*.95,2.4*a,.4);const i=ge*.26*a,c=.8;for(let l=0;l<6;l++){const h=l/6*_e+Math.random()*.7,d=(2.2+Math.random()*1.5)*a,p=Math.random();_s(e,p<.5?"meat":p<.78?"tomato":"lettuce",o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.9+Math.random()*1.3,Math.sin(h)*d+r.z*c,a,.42+Math.random()*.14)}for(let l=0;l<4;l++){const h=l/4*_e+Math.random()*.9,d=(2.4+Math.random()*1.6)*a;Cp(e,o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.7+Math.random()*1.5,Math.sin(h)*d+r.z*c,(.85+Math.random()*.5)*a,.42+Math.random()*.12)}for(let l=0;l<9;l++){const h=Math.random()*_e,d=(2.6+Math.random()*2.1)*a;Os(e,o+Math.cos(h)*i*.8,n,s+Math.sin(h)*i*.8,Math.cos(h)*d+r.x*c,1.5+Math.random()*1.8,Math.sin(h)*d+r.z*c,(.85+Math.random()*.7)*a,.36+Math.random()*.14)}}function fh(e,t){const a=e.object;if(!a)return;const o=e.dt??0,n=Rp(a,e.weapon,t);n.t+=n.rate*o,a.rotation.x=n.t*.8,a.rotation.z=n.t*.45;const s=a.userData.__bands;if(s&&(s.rotation.y+=o*1.9),n.shed-=o,n.shed<=0){n.shed=.1+Math.random()*.07;const r=Tp();r.color.set(Is),r.opacity=1;const i=new b(xw,r);i.renderOrder=9;const c=e.position.x-e.direction.x*xe,l=e.position.z-e.direction.z*xe;i.position.set(c,e.position.y,l);const h=xe*(.3+Math.random()*.2);i.scale.set(h,h*.5,h);const d=-e.direction.x*.5+(Math.random()-.5)*.5,p=-e.direction.z*.5+(Math.random()-.5)*.5,u=5+Math.random()*5;e.spawnTransient(i,.42,(f,m)=>{i.position.set(c+d*m,e.position.y-.7*m*m-.25*m,l+p*m),i.rotation.set(Math.sin(m*u)*1.4,m*3,Math.cos(m*u*.7)*1.1),r.opacity=1-Math.pow(f,2)})}}function mh(e,t){const a=Fp(e.damage)*t,{x:o,y:n,z:s}=e.position,r=e.direction;cc(e,o,n,s,ge*.21*a),zp(e,a*.88);for(let l=0;l<3;l++){const h=kw();h.color.set(l===0||l===1?e.color:Is),h.opacity=.66;const d=new b(yw,h);d.renderOrder=10,d.position.set(o,n,s),d.rotation.set((Math.random()-.5)*.5,Math.random()*_e,(Math.random()-.5)*.5);const p=xe*(.8+l*.12),u=mw*a*(.78+l*.22),f=(Math.random()-.5)*5;e.spawnTransient(d,.3+l*.05,m=>{const g=1-Math.pow(1-m,2.6),w=U.lerp(p,u,g);d.scale.set(w,w*(.9-g*.45),w),d.position.y=n+g*ge*.06,d.rotation.y+=f*.02,h.opacity=.66*(1-Math.pow(m,1.4))})}lh(e,o,n*.6,s,ge*.34*a,ge*.3,.65,.4);for(let l=0;l<3;l++){const h=l/3*_e+Math.random();lh(e,o+Math.cos(h)*ge*.24*a,hs+ge*.12,s+Math.sin(h)*ge*.24*a,ge*.28*a,ge*.26,.6,.34)}const i=ge*.24*a,c=.7;for(let l=0;l<5;l++){const h=l/5*_e+Math.random()*.8,d=(2.3+Math.random()*1.4)*a;_s(e,"onion",o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.9+Math.random()*1.2,Math.sin(h)*d+r.z*c,a,.4+Math.random()*.12)}for(let l=0;l<3;l++){const h=Math.random()*_e,d=(2.3+Math.random()*1.5)*a;Cp(e,o+Math.cos(h)*i,n,s+Math.sin(h)*i,Math.cos(h)*d+r.x*c,1.6+Math.random()*1.4,Math.sin(h)*d+r.z*c,(.75+Math.random()*.45)*a,.4)}for(let l=0;l<7;l++){const h=Math.random()*_e,d=(2.5+Math.random()*1.9)*a;Os(e,o+Math.cos(h)*i*.8,n,s+Math.sin(h)*i*.8,Math.cos(h)*d+r.x*c,1.4+Math.random()*1.6,Math.sin(h)*d+r.z*c,(.8+Math.random()*.6)*a,.34+Math.random()*.12)}}function Ar(e,t,a){const o=e.direction,{x:n,y:s,z:r}=e.position,i=ic();i.color.set(on),i.opacity=.9;const c=new b(Sp,i);c.renderOrder=11;const l=Math.atan2(o.x,o.z),h=mo*.9*a;e.spawnTransient(c,.18,d=>{const p=h*(1+d*1.5);c.position.set(n+o.x*d*ge*.14,s-d*ge*.04,r+o.z*d*ge*.14),c.scale.set(p,Ls*1.1*a*(1-d*.35),p),c.rotation.set(0,l+d*1.1,0),i.opacity=.9*(1-d*d)}),cc(e,n+o.x*ge*.06,s,r+o.z*ge*.06,ge*.1*a);for(let d=0;d<7;d++)Os(e,n,s,r,o.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.6+Math.random()*.7,o.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(const d of t)_s(e,d,n,s,r,o.x*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.8+Math.random()*.5,o.z*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.9*a,.3)}const zw={Filling:{projectile(e){const t=hh(e.color);return t.position.copy(e.position),t},trail(e){ph(e,1.7)},impact(e){uh(e,1)},cast(e){Ar(e,["meat","tomato"],1)}},Onion:{projectile(e){const t=dh(e.color);return t.position.copy(e.position),t},trail(e){fh(e,1.2)},impact(e){mh(e,1)},cast(e){Ar(e,["onion","onion"],1)}},Double:{projectile(e){const t=Tr(e)===1?dh(e.color):hh(e.color);return t.scale.setScalar(1.12),t.position.copy(e.position),t},trail(e){Tr(e)===1?fh(e,1.3):ph(e,1.9)},impact(e){Tr(e)===1?mh(e,1.12):uh(e,1.12)},cast(e){Ar(e,["meat","onion","tomato"],1.25)}}},sn="#F5EAD6",Iw="#E4CFA0",Ip="#B9843C",Lp="#6B3E12",Op="#452D18",lc="#E0562B",_p="#D5EAF4",hc="#FFFFFF",Ds="#FFF6E4",Dp="#5B3324",dc="#FFC93C",pc="#E63946",uc="#7DA33F",Lw="#FFFDF7",se=oe,Me=Math.PI*2,wo=.29,Te=se*.115,Ye=se*.3,Ow=se*.085,$p=se*.075,Np=se*.09,ds=se*.032,Fr=se*.058,_w=se*.05,Dw=se*.1,ps=se*.022,$w=se*.4,Nw=se*.97,Pw=se*.7,Pp=se*.11,Si=new pt(1,1,1),Hw=new ve(.5,.5,1,8,1,!0,-1.5,3),Hp=new Ts(.5,0),qp=new ji(.62,0),$s=new Hi(1,1.4,3,6);$s.scale(.5,1/3.4,.5);const jp=new yt(.5,8,6),us=new pt(1,1,1),qw=new vo(.5,1,4),Ko=new pt(1,1,1),gh=new qi(1,.085,5,18),wh=new ve(1,1,1,16,1),jw=new ve(.55,1,1,14,1),Bw=new ve(1,1,1,12,1,!0,-1.55,3.1),Gw=new $a(1,18);function Eo(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const To=(e,t={})=>new K({color:e,transparent:!0,opacity:1,depthWrite:!1,side:we,...t}),Uw=Eo(30,()=>To(sn)),Sa=Eo(34,()=>To(Ds)),Ww=Eo(6,()=>To(lc)),Yw=Eo(10,()=>To(sn)),Vw=Eo(10,()=>To(Lp)),Bp=Eo(24,()=>To(hc)),De=(e,t={})=>new K({color:e,side:we,...t}),yh=De(sn),bh=De(Iw),zn=De(Ip),Xw=De(_p),Kw=De(lc),xh=De(Ds),Zw=De(Dp);De(dc);De(pc);De(uc);const Qw=[De(uc),De(pc),De(dc),De(Ds)],Jw=[De("#5C7F2A"),De("#B02733"),De("#E0A317"),De(Lw)],In=new le,Ln=new le,Rr=new le,vh=new Od;function ey(e,t,a,o,n,s,r){In.set(t,a,o).normalize(),Ln.set(n,s,r).normalize(),Rr.crossVectors(In,Ln).normalize(),Ln.crossVectors(Rr,In).normalize(),vh.makeBasis(In,Ln,Rr),e.quaternion.setFromRotationMatrix(vh)}function ty(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function ay(e){const t=e.weapon.pelletColors;if(!t||t.length===0)return 0;const a=t.indexOf(e.color);return a>=0?a%4:0}function Ei(e){return U.clamp(.85+e*.035,.85,1.35)}function Gp(e,t,a){let o=e.userData.__spin;return o||(o={t:Math.random()*Me,rate:a*Me/ty(t),shed:0,age:0},e.userData.__spin=o),o}function Ea(e,t,a,o,n,s,r,i,c,l,h,d,p,u,f=-9){a.color.set(o),a.opacity=1;const m=new b(t,a);m.renderOrder=9,m.position.set(n,s,r),m.scale.set(h,d,p),m.rotation.set(Math.random()*Me,Math.random()*Me,Math.random()*Me);const g=(Math.random()-.5)*18,w=(Math.random()-.5)*18,y=(Math.random()-.5)*18,x=m.rotation.x,k=m.rotation.y,S=m.rotation.z;e.spawnTransient(m,u,(v,M)=>{const L=s+c*M+.5*f*M*M,A=L<=wo;m.position.set(n+i*M,A?wo:L,r+l*M),A||m.rotation.set(x+g*M,k+w*M,S+y*M),a.opacity=1-Math.pow(v,2.4)})}function fo(e,t,a,o,n,s,r,i,c){const l=Ow*i*(.85+Math.random()*.55),h=Math.random();Ea(e,Hw,Uw(),h<.24?Op:h<.48?Ip:sn,t,a,o,n,s,r,l,l*.85,l,c,-7.5)}function Zo(e,t,a,o,n,s,r,i,c){const l=$p*i*(.7+Math.random()*.6);Ea(e,Math.random()<.5?Hp:qp,Bp(),Math.random()<.45?hc:_p,t,a,o,n,s,r,l*1.3,l*.34,l,c,-8.5)}function Qo(e,t,a,o,n,s,r,i,c,l){if(t==="rice")Ea(e,$s,Sa(),Ds,a,o,n,s,r,i,ds*c,Np*c,ds*c,l);else if(t==="bean"){const h=Fr*c;Ea(e,jp,Sa(),Dp,a,o,n,s,r,i,h*1.35,h*.85,h*.85,l)}else if(t==="cheese")Ea(e,us,Sa(),dc,a,o,n,s,r,i,Dw*c,ps*c,ps*c,l,-6.5);else if(t==="salsa"){const h=Fr*.85*c;Ea(e,Ko,Sa(),pc,a,o,n,s,r,i,h,h,h,l)}else{const h=Fr*c;Ea(e,Ko,Sa(),uc,a,o,n,s,r,i,h*1.2,h*.55,h*1.2,l)}}function Ti(e,t){const{x:a,y:o,z:n}=e.position,s=e.direction,r=Math.random()*Me;for(let i=0;i<8;i++){const c=r+i/8*Me,l=Bp();l.color.set(i%2===0?hc:Op),l.opacity=1;const h=new b(i%2===0?Hp:qp,l);h.renderOrder=12;const d=Math.cos(c),p=Math.sin(c),u=se*.26*t,f=se*.44*t,m=(Math.random()-.5)*14;e.spawnTransient(h,.14,g=>{const w=1-Math.pow(1-g,2.2),y=U.lerp(u,f,w);h.position.set(a+d*y+s.x*y*.28,o+w*se*.05,n+p*y+s.z*y*.28);const x=$p*t*(1.7-g*.5);h.scale.set(x*1.6,x*.34,x),h.rotation.set(m*g,Math.atan2(d,p),m*g*.6),l.opacity=g<.45?1:1-(g-.45)/.55})}}const ta=16,Up=2.35,oy=.42;function fc(e){const t=new ee,a=Yw(),o=Vw();a.color.set(sn),a.opacity=1,o.color.set(Lp),o.opacity=1;const n=[];for(let s=0;s<e;s++){const r=new b(Si,o);r.renderOrder=10;const i=new b(Si,a);i.renderOrder=11,r.scale.setScalar(0),i.scale.setScalar(0),t.add(r,i),n.push({face:i,back:r})}return{group:t,slats:n,faceMat:a,backMat:o}}function ny(e,t,a,o,n,s,r,i){const{group:c,slats:l,faceMat:h,backMat:d}=fc(ta),p=se*.06*r,u=se*.15*r,f=Pw*r,m=Pp*r,g=(k,S,v)=>{const M=k*Up*Me*s,L=k*oy*Me*s,A=M+(L-M)*S,F=p+k*(u-p),D=p+k*(f-p),E=F+(D-F)*S;v.x=t+Math.cos(n+A)*E,v.z=o+Math.sin(n+A)*E},w={x:0,z:0},y={x:0,z:0},x=k=>{const S=1-Math.pow(1-Math.min(1,k/.62),2.4),v=U.lerp(a,wo,1-Math.pow(1-Math.min(1,k/.72),1.8));for(let L=0;L<ta;L++){const A=L/ta,F=(L+1)/ta;g(A,S,w),g(F,S,y);const D=y.x-w.x,E=y.z-w.z,R=Math.hypot(D,E)*1.14,q=Math.atan2(D,E),$=(w.x+y.x)*.5,G=(w.z+y.z)*.5,V=m*(1-A*.35),{face:H,back:Q}=l[L];H.rotation.set(0,q,0),Q.rotation.set(0,q,0),H.position.set($,v+.022,G),Q.position.set($,v,G),H.scale.set(V,se*.008,R),Q.scale.set(V*1.8,se*.006,R*1.12)}const M=k<.68?1:1-(k-.68)/.32;h.opacity=M,d.opacity=M*.95};x(0),e.spawnTransient(c,i,x)}function sy(e,t,a){const{x:o,z:n}=e.position,s=22,r=2.2,i=$w*t,{group:c,slats:l,faceMat:h,backMat:d}=fc(s),p=Math.random()*Me,u=wo+se*.02,f=(Nw*t-u)/(s-1),m=r*Me/(s-1),g=w=>{const y=Math.min(1,w/.52),x=w<.62?1:1-(w-.62)/.38*.16;for(let S=0;S<s;S++){const v=S/s*.9,M=y>v,{face:L,back:A}=l[S];if(L.visible=M,A.visible=M,!M)continue;const F=p+S*m,D=i*x,E=o+Math.cos(F)*D,R=u+S*f,q=n+Math.sin(F)*D;ey(L,-Math.sin(F)*D*m,f,Math.cos(F)*D*m,Math.cos(F),0,Math.sin(F)),A.quaternion.copy(L.quaternion);const $=D*m*1.02,G=se*.1*t;L.position.set(E,R,q),A.position.set(E-Math.cos(F)*.02,R,q-Math.sin(F)*.02),L.scale.set($,se*.009,G),A.scale.set($*1.02,se*.007,G*1.75)}const k=w<.62?1:1-(w-.62)/.38;h.opacity=.88*k,d.opacity=.92*k};g(0),e.spawnTransient(c,a,g)}function Wp(e,t,a,o,n,s,r,i,c){const{group:l,slats:h,faceMat:d,backMat:p}=fc(ta),u=se*.03*i,f=se*.13*i,m=Math.random()<.5?1:-1,g=m*(9+Math.random()*5),w={x:0,z:0},y={x:0,z:0},x=(S,v,M)=>{const L=v+S*Up*Me*m,A=u+S*(f-u);M.x=Math.cos(L)*A,M.z=Math.sin(L)*A},k=(S,v)=>{const M=g*v,L=t+n*v,A=Math.max(wo,a+s*v-4*v*v),F=o+r*v;for(let E=0;E<ta;E++){x(E/ta,M,w),x((E+1)/ta,M,y);const R=y.x-w.x,q=y.z-w.z,$=Math.hypot(R,q)*1.16,G=Math.atan2(R,q),{face:V,back:H}=h[E];V.rotation.set(0,G,0),H.rotation.set(0,G,0),V.position.set(L+(w.x+y.x)*.5,A+.018,F+(w.z+y.z)*.5),H.position.set(L+(w.x+y.x)*.5,A,F+(w.z+y.z)*.5);const Q=Pp*i*.72;V.scale.set(Q,se*.007,$),H.scale.set(Q*1.8,se*.005,$*1.14)}const D=1-Math.pow(S,2);d.opacity=D,p.opacity=D*.95};k(0,0),e.spawnTransient(l,c,k)}function ry(e){const t=new ee,a=new ee;t.add(a),yh.color.set(e);const o=new b(wh,yh);o.rotation.x=Math.PI/2,o.scale.set(Te,Ye*.8,Te),a.add(o);const n=new b(jw,bh);n.rotation.x=-Math.PI/2,n.scale.set(Te,Ye*.12,Te),n.position.z=-Ye*.46,a.add(n);const s=new b(Bw,zn);s.rotation.x=Math.PI/2,s.scale.set(Te*1.02,Ye*.8,Te*1.02),a.add(s);const r=new b(us,zn);r.position.set(Te*.92,0,0),r.rotation.set(.42,0,0),r.scale.set(Te*.14,Te*.16,Ye*.82),a.add(r);const i=new b(wh,Xw);i.rotation.x=Math.PI/2,i.scale.set(Te*1.07,Ye*.26,Te*1.07),i.position.z=-Ye*.2,a.add(i);for(const h of[-Ye*.1,Ye*.04]){const d=new b(gh,Kw);d.scale.set(Te*1.08,Te*1.08,Te*.85),d.position.z=h,a.add(d)}const c=new b(Gw,bh);c.scale.setScalar(Te*.99),c.position.z=Ye*.404,a.add(c);const l=[zn,xh,zn];for(let h=0;h<3;h++){const d=new b(gh,l[h]),p=Te*(.78-h*.25);d.scale.set(p,p,Te*.2),d.position.z=Ye*.412,a.add(d)}for(let h=0;h<4;h++){const d=h/4*Me+.5,p=new b(h%2===0?$s:jp,h%2===0?xh:Zw),u=Te*.28;p.scale.set(u,h%2===0?u*2:u,u),p.position.set(Math.cos(d)*Te*.6,Math.sin(d)*Te*.6,Ye*.42),p.rotation.set(Math.random(),Math.random(),Math.random()),a.add(p)}return t.userData.__spinner=a,t}function iy(e){const t=new ee,a=Qw[e],o=Jw[e],n=se*.075;if(e===0){for(let r=0;r<3;r++){const i=new b(qw,r===1?o:a);i.scale.set(n*.5,n*2.6,n*.22),i.position.set((r-1)*n*.5,n*.4,0),i.rotation.set(.2,0,(r-1)*.55),t.add(i)}const s=new b(us,o);s.scale.set(n*.16,n*1.2,n*.16),s.position.y=-n*.7,t.add(s)}else if(e===1)for(let s=0;s<3;s++){const r=s/3*Me,i=new b(Ko,s===2?o:a),c=n*(1+Math.random()*.35);i.scale.setScalar(c),i.position.set(Math.cos(r)*n*.75,Math.sin(r)*n*.5,Math.sin(r*1.7)*n*.55),i.rotation.set(Math.random(),Math.random(),Math.random()),t.add(i)}else if(e===2)for(let s=0;s<4;s++){const r=new b(us,s===3?o:a);r.scale.set(n*2.5,ps*1.2,ps*1.2),r.position.set(0,(s-1.5)*n*.28,(s-1.5)*n*.2),r.rotation.set(0,(s-1.5)*.28,(s-1.5)*.14),t.add(r)}else for(let s=0;s<5;s++){const r=s/5*Me+.3,i=new b($s,s===4?o:a);i.scale.set(ds*1.15,Np*1.15,ds*1.15),i.position.set(Math.cos(r)*n*.55,Math.sin(r*1.3)*n*.4,Math.sin(r)*n*.55),i.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),t.add(i)}return t}function cy(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Gp(t,e.weapon,9);o.t+=o.rate*a;const n=t.userData.__spinner;if(n&&(n.rotation.z=o.t),t.rotation.x=Math.sin(o.t*.35)*.1,o.shed-=a,o.shed<=0){o.shed=.055+Math.random()*.04;const s=e.position.x-e.direction.x*Ye*.5,r=e.position.z-e.direction.z*Ye*.5,i=Math.random();i<.42?Qo(e,"rice",s,e.position.y-Te*.3,r,-e.direction.x*.6+(Math.random()-.5)*.7,-.15-Math.random()*.4,-e.direction.z*.6+(Math.random()-.5)*.7,.9,.32):i<.72?fo(e,s,e.position.y,r,-e.direction.x*.8+(Math.random()-.5)*.6,.15+Math.random()*.3,-e.direction.z*.8+(Math.random()-.5)*.6,.75,.3):Zo(e,s,e.position.y,r,-e.direction.x*.9+(Math.random()-.5)*.5,.2+Math.random()*.35,-e.direction.z*.9+(Math.random()-.5)*.5,.65,.26)}}function ly(e){const t=Ei(e.damage),{x:a,y:o,z:n}=e.position,s=e.direction;Ti(e,t);const r=se*.16*t;let i=-s.z,c=s.x;Math.hypot(i,c)<1e-4&&(i=1,c=0);const l=Math.atan2(s.z,s.x);for(const p of[-1,1])ny(e,a+s.x*r+i*p*r*.7,o,n+s.z*r+c*p*r*.7,l+p*1.05,p,t*.92,.78);const h=se*.26*t,d=.8;for(let p=0;p<9;p++){const u=p/9*Me+Math.random()*.6,f=(2.3+Math.random()*1.5)*t,m=Math.random();Qo(e,m<.32?"rice":m<.66?"bean":m<.85?"cheese":"salsa",a+Math.cos(u)*h,o,n+Math.sin(u)*h,Math.cos(u)*f+s.x*d,1.9+Math.random()*1.3,Math.sin(u)*f+s.z*d,t,.42+Math.random()*.14)}for(let p=0;p<6;p++){const u=p/6*Me+Math.random()*.9,f=(2.4+Math.random()*1.6)*t;fo(e,a+Math.cos(u)*h,o,n+Math.sin(u)*h,Math.cos(u)*f+s.x*d,1.8+Math.random()*1.4,Math.sin(u)*f+s.z*d,(.9+Math.random()*.5)*t,.44+Math.random()*.12)}for(let p=0;p<4;p++){const u=Math.random()*Me,f=(2.7+Math.random()*1.8)*t;Zo(e,a+Math.cos(u)*h*.9,o,n+Math.sin(u)*h*.9,Math.cos(u)*f+s.x*d,1.6+Math.random()*1.6,Math.sin(u)*f+s.z*d,(.8+Math.random()*.6)*t,.36+Math.random()*.12)}}function hy(e,t){const a=e.direction,{x:o,y:n,z:s}=e.position;Wp(e,o,n,s,a.x*2.2+(Math.random()-.5)*.4,.7,a.z*2.2+(Math.random()-.5)*.4,t,.26);for(let r=0;r<5;r++)Qo(e,r%2===0?"rice":"bean",o,n,s,a.x*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.6,a.z*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.9*t,.3);for(let r=0;r<4;r++)Zo(e,o,n,s,a.x*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8+Math.random()*.6,a.z*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8*t,.24);for(let r=0;r<3;r++)fo(e,o,n,s,a.x*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.6+Math.random()*.5,a.z*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.8*t,.26)}const dy={Disc:{projectile(e){const t=ry(e.color);return t.position.copy(e.position),t},trail(e){cy(e)},impact(e){ly(e)},cast(e){hy(e,1)}},Roll:{impact(e){const t=Ei(e.damage);sy(e,1,.62),Ti(e,t*.85);const{x:a,y:o,z:n}=e.position,s=e.direction,r=se*.24*t;for(let i=0;i<5;i++){const c=i/5*Me+Math.random()*.8,l=(2+Math.random()*1.3)*t;Qo(e,i%2===0?"rice":"guac",a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.6,1.7+Math.random()*1.1,Math.sin(c)*l+s.z*.6,t,.38+Math.random()*.12)}for(let i=0;i<3;i++){const c=Math.random()*Me,l=(2.2+Math.random()*1.4)*t;fo(e,a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.6,1.6+Math.random()*1.2,Math.sin(c)*l+s.z*.6,.85*t,.4)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position;for(const s of[-.5,.5])Wp(e,a-t.z*s*se*.12,o,n+t.x*s*se*.12,t.x*2.6-t.z*s*1.2,.5,t.z*2.6+t.x*s*1.2,.9,.3);for(let s=0;s<5;s++)fo(e,a,o,n,t.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.6+Math.random()*.6,t.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.85,.28);for(let s=0;s<3;s++)Zo(e,a,o,n,t.x*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.5,t.z*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.75,.24)}},Swarm:{projectile(e){const t=iy(ay(e));return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Gp(t,e.weapon,2.4);o.t+=o.rate*a,o.age+=a;const n=Math.sin(o.age*7.5+o.t)*se*.085;if(t.position.x+=-e.direction.z*n,t.position.z+=e.direction.x*n,t.position.y+=Math.sin(o.age*5.2)*se*.03,t.rotation.x=o.t*.8,t.rotation.z=Math.sin(o.t*.7)*.7,o.shed-=a,o.shed<=0){o.shed=.14+Math.random()*.08;const s=Sa();s.color.set(e.color),s.opacity=1;const r=new b(Ko,s);r.renderOrder=9;const i=t.position.x,c=t.position.y,l=t.position.z,h=se*.03;r.position.set(i,c,l),r.scale.setScalar(h),e.spawnTransient(r,.26,(d,p)=>{r.position.set(i,c-.5*p*p,l),r.scale.setScalar(h*(1-d*.6)),s.opacity=1-d})}},impact(e){const t=Ei(e.damage)*.8,{x:a,y:o,z:n}=e.position,s=e.direction;Ti(e,t*.7);const r=se*.22*t;for(let i=0;i<5;i++){const c=i/5*Me+Math.random()*.8,l=(2.1+Math.random()*1.2)*t,h=Sa();h.color.set(e.color),h.opacity=1;const d=new b(Ko,h);d.renderOrder=9;const p=a+Math.cos(c)*r,u=n+Math.sin(c)*r,f=Math.cos(c)*l+s.x*.6,m=Math.sin(c)*l+s.z*.6,g=1.6+Math.random()*1.1,w=_w*t;d.scale.setScalar(w),d.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3),e.spawnTransient(d,.36,(y,x)=>{const k=o+g*x-4.5*x*x;d.position.set(p+f*x,Math.max(wo,k),u+m*x),h.opacity=1-Math.pow(y,2.2)})}for(let i=0;i<3;i++){const c=Math.random()*Me,l=(2.2+Math.random()*1.3)*t;fo(e,a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.5,1.5+Math.random()*1.2,Math.sin(c)*l+s.z*.5,.7*t,.34)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position,s=(e.weapon.spreadDeg??40)*Math.PI/360,r=["guac","salsa","cheese","rice"];for(let h=0;h<12;h++){const d=(Math.random()*2-1)*s,p=Math.cos(d),u=Math.sin(d),f=t.x*p-t.z*u,m=t.x*u+t.z*p,g=1.8+Math.random()*1.4;Qo(e,r[h%4],a,o,n,f*g,.8+Math.random()*.7,m*g,.95,.34)}const i=Ww();i.color.set(lc),i.opacity=1;const c=new b(Si,i);c.renderOrder=11;const l=Math.atan2(t.x,t.z);e.spawnTransient(c,.2,h=>{const d=1-Math.pow(1-h,2);c.position.set(a+t.x*d*se*.3,o+d*se*.05,n+t.z*d*se*.3),c.rotation.set(0,l+d*.8,0),c.scale.set(se*.2*(1+d*.5),se*.01,se*.05),i.opacity=1-h*h});for(let h=0;h<4;h++)Zo(e,a,o,n,t.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8+Math.random()*.6,t.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8,.26)}}},Na="#FFF8EA",mc="#E4D6AE",Ns="#FFFFFF",gc="#4A3118",Yp="#FF9E12",py="#FFCE55",Vp="#F4FBFF",Wn="#FFD84D",uy="#EFB528",fy="#F5872B",my="#2A2320",Xp="#FFF0B8",ye=oe,Fe=Math.PI*2,La=.29,gy=ye*.31,wy=ye*.2,Kp=ye*.03,yy=ye*.062,by=ye*.115,xy=ye*.052,vy=ye*.16,ky=ye*.026,My=ye*.045,Ma=ye*.125,Ve=ye*.085,On=ye*.115,Oa=new vo(.5,1,4);Oa.rotateZ(-Math.PI/2);const Ai=new yt(.5,16,11,0,Math.PI*1.5),Sy=new ve(.5,.5,1,8,1,!0,-1.35,2.7),Ey=new ve(.5,.5,1,8,1,!0,-1.2,2.4),no=new yt(.5,12,10),wc=new Hi(1,2.2,3,7);wc.scale(.5,1/4.2,.5);wc.rotateZ(-Math.PI/2);const Zp=new ji(.62,0),Ty=new vo(.5,1,3),Ay=new pt(1,1,1),Qp=new vo(.5,1,4);Qp.rotateX(Math.PI/2);function rn(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const cn=(e,t={})=>new K({color:e,transparent:!0,opacity:1,depthWrite:!1,side:we,...t}),Jp=rn(34,()=>cn(Na)),Fy=rn(18,()=>cn(Yp)),Ry=rn(18,()=>cn(Vp)),Cy=rn(16,()=>cn(Xp)),yo=rn(40,()=>cn(Ns)),Gt=(e,t={})=>new K({color:e,side:we,...t}),Cr=Gt(Na),Fi=Gt(mc),zy=Gt(Na),kh=Gt(fy),Iy=Gt(my),Mh=Gt(uy),Sh=[Gt(Wn),Gt(Wn),Gt(Wn)];let Ly=0;const $o=new le,No=new le,zr=new le,Eh=new Od;function Ps(e,t,a,o){$o.set(t,a,o).normalize(),Math.abs($o.y)>.94?No.set(1,0,0):No.set(0,1,0),zr.crossVectors($o,No).normalize(),No.crossVectors(zr,$o).normalize(),Eh.makeBasis($o,No,zr),e.quaternion.setFromRotationMatrix(Eh)}function Oy(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Ri(e){return U.clamp(.85+e*.035,.85,1.45)}function _y(e,t,a,o,n,s,r,i,c,l,h,d,p,u,f=-9){a.color.set(o),a.opacity=1;const m=new b(t,a);m.renderOrder=9,m.position.set(n,s,r),m.scale.set(h,d,p),m.rotation.set(Math.random()*Fe,Math.random()*Fe,Math.random()*Fe);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,y=(Math.random()-.5)*20,x=m.rotation.x,k=m.rotation.y,S=m.rotation.z;e.spawnTransient(m,u,(v,M)=>{const L=s+c*M+.5*f*M*M,A=L<=La;m.position.set(n+i*M,A?La:L,r+l*M),A||m.rotation.set(x+g*M,k+w*M,S+y*M),a.opacity=1-Math.pow(v,2.4)})}function Ta(e,t,a,o,n,s,r,i,c){const l=yy*i*(.75+Math.random()*.6);_y(e,Zp,Jp(),Math.random()<.3?mc:Na,t,a,o,n,s,r,l,l*.8,l,c)}function Ir(e,t,a,o,n,s,r,i,c){const l=Fy();l.color.set(Math.random()<.3?py:Yp),l.opacity=1;const h=new b(no,l);h.renderOrder=9;const d=xy*i*(.8+Math.random()*.6);h.position.set(t,a,o),h.scale.setScalar(d);const p=14+Math.random()*10,u=Math.random()*Fe;e.spawnTransient(h,c,(f,m)=>{const g=a+s*m-4.4*m*m;h.position.set(t+n*m,Math.max(La,g),o+r*m);const w=Math.sin(u+m*p)*.24;h.scale.set(d*(1+w),d*(1-w),d*(1+w*.4)),l.opacity=1-Math.pow(f,3)})}function Yn(e,t,a,o,n,s,r,i,c){const l=Ry();l.color.set(Vp),l.opacity=.78;const h=new b(wc,l);h.renderOrder=10,h.position.set(t,a,o);const d=vy*i*(.55+Math.random()*.4),p=ky*i*(.75+Math.random()*.5);Ps(h,n,s,r),h.scale.set(d,p,p),e.spawnTransient(h,c,(u,f)=>{const m=a+s*f-2.2*f*f;h.position.set(t+n*f,Math.max(La,m),o+r*f),h.scale.set(d*(1+u*1.5),p*(1-u*.4),p*(1-u*.4)),l.opacity=.78*(1-Math.pow(u,1.8))})}function yc(e,t,a,o,n,s,r,i){const c=Cy();c.color.set(Math.random()<.35?Wn:Xp),c.opacity=1;const l=new b(Ty,c);l.renderOrder=9;const h=My*r*(.7+Math.random()*.6);l.position.set(t,a,o),l.scale.set(h,h*1.5,h*.35);const d=4+Math.random()*4,p=Math.random()*Fe;e.spawnTransient(l,i,(u,f)=>{l.position.set(t+n*f+Math.sin(p+f*d)*.1,a+.35*f-.55*f*f,o+s*f+Math.cos(p+f*d*.8)*.1),l.rotation.set(Math.sin(p+f*d)*1.5,f*2.2,Math.cos(p+f*d*.7)*1.2),c.opacity=1-Math.pow(u,2)})}function Vn(e,t,a,o=.13){const{x:n,y:s,z:r}=e.position,i=e.direction,c=Math.random()*Fe;for(let l=0;l<t;l++){const h=c+l/t*Fe+(Math.random()-.5)*.5,d=(l%3-1)*.42+(Math.random()-.5)*.2,p=Math.cos(d),u=Math.cos(h)*p,f=Math.sin(d),m=Math.sin(h)*p,g=yo();g.color.set(l%2===0?Ns:Na),g.opacity=1;const w=yo();w.color.set(gc),w.opacity=1;const y=new b(Oa,g),x=new b(Oa,w);y.renderOrder=13,x.renderOrder=12;const k=gy,S=k+wy*a*(.7+Math.random()*.55),v=Kp*(.8+Math.random()*.45),M=n+i.x*k*.22,L=r+i.z*k*.22,A=new ee;A.add(x,y),Ps(y,u,f,m),x.quaternion.copy(y.quaternion),e.spawnTransient(A,o,F=>{const D=1-Math.pow(1-F,2.4),E=U.lerp(k,k+(S-k)*.45,D),R=U.lerp(k+(S-k)*.35,S,D),q=Math.max(.02,R-E),$=(E+R)*.5;y.position.set(M+u*$,s+f*$,L+m*$),x.position.copy(y.position),y.scale.set(q,v,v),x.scale.set(q*1.06,v*2.6,v*2.6);const G=F<.45?1:1-(F-.45)/.55;g.opacity=G,w.opacity=G})}}function Th(e,t,a,o){const{x:n,z:s}=e.position,r=Math.random()*Fe,i=new ee,c=yo();c.color.set(Ns),c.opacity=1;const l=yo();l.color.set(gc),l.opacity=1;const h=[];for(let u=0;u<t;u++){const f=r+u/t*Fe+(Math.random()-.5)*.55,m=new b(Oa,l),g=new b(Oa,c);m.renderOrder=10,g.renderOrder=11,m.scale.setScalar(0),g.scale.setScalar(0),Ps(g,Math.cos(f),0,Math.sin(f)),m.quaternion.copy(g.quaternion),i.add(m,g),h.push({face:g,seam:m,a:f,len:ye*(.16+Math.random()*.3)*a,w:ye*(.02+Math.random()*.014)*a})}const d=ye*.2*a,p=u=>{const f=1-Math.pow(1-Math.min(1,u/.22),2.6);for(const g of h){const w=Math.max(.001,g.len*f),y=d+w*.5,x=n+Math.cos(g.a)*y,k=s+Math.sin(g.a)*y;g.face.position.set(x,La+.012,k),g.seam.position.set(x,La,k),g.face.scale.set(w,ye*.006,g.w),g.seam.scale.set(w*1.05,ye*.004,g.w*2.1)}const m=u<.42?1:1-(u-.42)/.58;c.opacity=.92*m,l.opacity=.92*m};p(0),e.spawnTransient(i,o,p)}function Ah(e,t,a,o){const{x:n,y:s,z:r}=e.position,i=e.direction;let c=-i.z,l=i.x;Math.hypot(c,l)<1e-4&&(c=1,l=0);for(const h of[-1,1]){const d=Jp();d.color.set(h<0?Na:mc),d.opacity=1;const p=new b(Ai,d);p.renderOrder=10;const u=n+c*h*ye*.26*t,f=r+l*h*ye*.26*t,m=by*2*t;p.position.set(u,s,f),p.scale.set(m,m*1.15,m),p.rotation.set(0,h*1.4,0);const g=c*h*a+i.x*a*.35,w=l*h*a+i.z*a*.35,y=1.6+Math.random()*.9,x=h*(6+Math.random()*4),k=(Math.random()-.5)*5;e.spawnTransient(p,o,(S,v)=>{const M=s+y*v-4.6*v*v;p.position.set(u+g*v,Math.max(La,M),f+w*v),p.rotation.set(k*v,h*1.4+x*v,h*.4),d.opacity=1-Math.pow(S,2.2)})}}function Dy(e){const t=new ee,a=new ee;t.add(a);const o=Sh[Ly++%Sh.length];o.color.set(e);const n=Ma,s=new b(no,o);s.scale.set(n*2,n*1.85,n*1.9),s.position.y=n*.15,a.add(s);const r=new b(no,Mh);r.scale.set(n*1.5,n*.8,n*1.45),r.position.set(0,-n*.42,n*.18),a.add(r);const i=new b(Qp,kh);i.scale.set(n*.55,n*.46,n*.7),i.position.set(0,n*.26,n*.92),a.add(i);for(const h of[-1,1]){const d=new b(no,Iy);d.scale.setScalar(n*.34),d.position.set(h*n*.4,n*.62,n*.62),a.add(d);const p=new b(no,Mh);p.scale.set(n*.34,n*.85,n*1.05),p.position.set(h*n*.92,n*.08,-n*.1),p.rotation.z=h*.4,a.add(p),p.userData.__side=h;const u=new b(Ay,kh);u.scale.set(n*.18,n*.1,n*.44),u.position.set(h*n*.34,-n*.92,n*.12),a.add(u)}const c=new b(Ai,zy);c.scale.set(n*1.22,n*1,n*1.22),c.position.set(-n*.16,n*.88,-n*.22),c.rotation.set(Math.PI-.42,.7,.3),a.add(c);const l=new b(Ai,Fi);return l.scale.set(n*1.08,n*.8,n*1.08),l.position.set(-n*.16,n*.86,-n*.22),l.rotation.set(Math.PI-.42,.7,.3),a.add(l),t.userData.__bob=a,t}function $y(e){const t=new ee;Cr.color.set(e);const a=new b(Sy,Cr);a.scale.set(Ve*2,On,Ve*2),t.add(a);const o=new b(Ey,Fi);o.scale.set(Ve*1.78,On*.92,Ve*1.78),t.add(o);for(let s=0;s<2;s++){const r=new b(Zp,Cr),i=Ve*(.42+s*.18);r.scale.set(i,i*.7,i),r.position.set(Ve*(s===0?.8:-.5),On*(s===0?.45:-.5),Ve*.4),r.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),t.add(r)}const n=new b(no,Fi);return n.scale.set(Ve*.75,Ve*.4,Ve*.75),n.position.set(-Ve*.2,-On*.34,0),t.add(n),t}function e0(e,t,a){let o=e.userData.__anim;return o||(o={t:Math.random()*Fe,rate:a*Fe/Oy(t.weapon),shed:0,age:0,lx:t.position.x,lz:t.position.z,speed:Ke(t.weapon.speed??160)},e.userData.__anim=o),o}function Ny(e){const t=e.object;if(!t)return;const a=e.dt??0,o=e0(t,e,1);o.age+=a;const n=Math.hypot(e.position.x-o.lx,e.position.z-o.lz);a>0&&(o.speed=o.speed*.55+n/a*.45),o.lx=e.position.x,o.lz=e.position.z;const s=Ke(e.weapon.speed??160),r=o.speed<s*.28,i=t.userData.__bob;if(i)if(r){const c=o.age*2.2%1,l=Math.sin(Math.min(1,c*2.2)*Math.PI);i.position.set(0,-Ma*.3*l,Ma*.75*l),i.rotation.set(l*.95,0,0)}else{const c=o.age*7;i.position.set(0,Math.abs(Math.sin(c))*Ma*.22,0),i.rotation.set(0,0,Math.sin(c*.5)*.3);for(const l of i.children){const h=l.userData.__side;h!==void 0&&(l.rotation.z=h*(.4+Math.sin(c)*.5))}}o.shed-=a,o.shed<=0&&(o.shed=r?.1+Math.random()*.08:.2+Math.random()*.14,yc(e,e.position.x+(Math.random()-.5)*Ma,e.position.y+Ma*.3,e.position.z+(Math.random()-.5)*Ma,-e.direction.x*.25+(Math.random()-.5)*.35,-e.direction.z*.25+(Math.random()-.5)*.35,1,.7))}const Py=ye*.27;function Hy(e){const t=Ri(e.damage)*1.25,{x:a,y:o,z:n}=e.position,s=e.direction;Vn(e,4,t*1.15);const r=Py;for(let i=0;i<9;i++){const c=i/9*Fe+Math.random()*.6,l=(1.9+Math.random()*1.2)*t;Ta(e,a+Math.cos(c)*r,o,n+Math.sin(c)*r,Math.cos(c)*l+s.x*.5,1.5+Math.random()*1,Math.sin(c)*l+s.z*.5,1.2*t,.34)}for(let i=0;i<10;i++){const c=Math.random()*Fe;yc(e,a+Math.cos(c)*r,o+ye*.05,n+Math.sin(c)*r,Math.cos(c)*(.9+Math.random()*.8),Math.sin(c)*(.9+Math.random()*.8),t*1.25,.62)}}function qy(e){const t=e.object;if(!t)return;const a=e.dt??0,o=e0(t,e,1.9);if(o.t+=o.rate*a,t.rotation.x=o.t,t.rotation.z=Math.sin(o.t*.7)*1,o.shed-=a,o.shed<=0){o.shed=.075+Math.random()*.05;const n=e.position.x-e.direction.x*Ve,s=e.position.z-e.direction.z*Ve;Math.random()<.45?Yn(e,n,e.position.y-Ve*.3,s,-e.direction.x*.35+(Math.random()-.5)*.4,-.5-Math.random()*.4,-e.direction.z*.35+(Math.random()-.5)*.4,.6,.3):Ta(e,n,e.position.y,s,-e.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-e.direction.z*.7+(Math.random()-.5)*.6,.7,.28)}}const jy={Tackle:{impact(e){const t=Ri(e.damage),{x:a,y:o,z:n}=e.position,s=e.direction;Vn(e,8,t),Ah(e,t*.95,2.4*t,.42),Th(e,7,t,.66);const r=ye*.26*t,i=.8;for(let c=0;c<5;c++){const l=c/5*Fe+Math.random()*.7,h=(2+Math.random()*1.2)*t;Ir(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.9+Math.random()*1.1,Math.sin(l)*h+s.z*i,t*1.15,.5+Math.random()*.12)}for(let c=0;c<6;c++){const l=c/6*Fe+Math.random()*.8,h=(2.4+Math.random()*1.5)*t;Yn(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.4+Math.random()*1,Math.sin(l)*h+s.z*i,t,.4+Math.random()*.12)}for(let c=0;c<11;c++){const l=Math.random()*Fe,h=(2.6+Math.random()*2)*t;Ta(e,a+Math.cos(l)*r*.9,o,n+Math.sin(l)*r*.9,Math.cos(l)*h+s.x*i,1.7+Math.random()*1.7,Math.sin(l)*h+s.z*i,(.9+Math.random()*.6)*t,.4+Math.random()*.14)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position,s=Math.atan2(t.x,t.z);for(let r=0;r<4;r++){const i=(r-1.5)*.34,c=Math.sin(s+i),l=Math.cos(s+i),h=(r%2-.5)*.35,d=yo();d.color.set(r%2===0?Ns:Na),d.opacity=1;const p=yo();p.color.set(gc),p.opacity=1;const u=new b(Oa,d),f=new b(Oa,p);u.renderOrder=13,f.renderOrder=12;const m=new ee;m.add(f,u),Ps(u,c,h,l),f.quaternion.copy(u.quaternion);const g=Kp*.85;e.spawnTransient(m,.17,w=>{const y=1-Math.pow(1-w,2.2),x=ye*.1+y*ye*.1,k=ye*(.12+y*.22),S=x+k*.5;u.position.set(a+c*S,o+h*S*.5,n+l*S),f.position.copy(u.position),u.scale.set(k,g,g),f.scale.set(k*1.06,g*2.6,g*2.6);const v=w<.5?1:1-(w-.5)/.5;d.opacity=v,p.opacity=v})}for(let r=0;r<8;r++)Ta(e,a,o,n,t.x*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.7+Math.random()*.7,t.z*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(let r=0;r<3;r++)Ir(e,a,o,n,t.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.8+Math.random()*.5,t.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.9,.32)}},Hatch:{projectile(e){const t=Dy(e.color);return t.position.copy(e.position),t},trail(e){Ny(e)},impact(e){Hy(e)},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position;Vn(e,6,.62,.14),Ah(e,.8,2,.4);for(let s=0;s<9;s++){const r=Math.random()*Fe;yc(e,a+Math.cos(r)*ye*.1,o+ye*.06,n+Math.sin(r)*ye*.1,Math.cos(r)*(.8+Math.random()*.9)+t.x*.5,Math.sin(r)*(.8+Math.random()*.9)+t.z*.5,1.1,.8)}for(let s=0;s<5;s++)Ta(e,a,o,n,t.x*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.8+Math.random()*.6,t.z*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.85,.3)}},Shards:{projectile(e){const t=$y(e.color);return t.position.copy(e.position),t},trail(e){qy(e)},impact(e){const t=Ri(e.damage)*.9,{x:a,y:o,z:n}=e.position,s=e.direction;Vn(e,5,t*.82,.12),Th(e,5,t*.7,.6);const r=ye*.24*t,i=.7;for(let c=0;c<6;c++){const l=c/6*Fe+Math.random()*.8,h=(2.2+Math.random()*1.4)*t;Yn(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.4+Math.random()*1,Math.sin(l)*h+s.z*i,t*1.1,.42+Math.random()*.12)}for(let c=0;c<7;c++){const l=c/7*Fe+Math.random()*.9,h=(2.4+Math.random()*1.7)*t;Ta(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*h+s.x*i,1.6+Math.random()*1.4,Math.sin(l)*h+s.z*i,(.85+Math.random()*.5)*t,.38+Math.random()*.12)}for(let c=0;c<2;c++){const l=Math.random()*Fe;Ir(e,a+Math.cos(l)*r,o,n+Math.sin(l)*r,Math.cos(l)*2*t+s.x*i,1.7+Math.random()*.9,Math.sin(l)*2*t+s.z*i,t*.85,.44)}},cast(e){const t=e.direction,{x:a,y:o,z:n}=e.position,s=(e.weapon.spreadDeg??30)*Math.PI/360;for(let r=0;r<9;r++){const i=(Math.random()*2-1)*s,c=Math.cos(i),l=Math.sin(i),h=t.x*c-t.z*l,d=t.x*l+t.z*c,p=1.6+Math.random()*1.2;Ta(e,a,o,n,h*p,.7+Math.random()*.6,d*p,.95,.32)}for(let r=0;r<3;r++){const i=(Math.random()*2-1)*s,c=Math.cos(i),l=Math.sin(i),h=t.x*c-t.z*l,d=t.x*l+t.z*c;Yn(e,a,o,n,h*1.6,.5+Math.random()*.4,d*1.6,.85,.3)}}}},Pa="#E63946",Ha="#FFFDF9",t0="#00E5B0",By="#FFEAF1",Gy=.32,Uy=.34,Fh=.36,Wy=.33,Lr=.46;function ln(e){const t=document.createElement("canvas");return t.width=e,t.height=e,t.getContext("2d")}function hn(e){const t=new tt(e.canvas);return t.anisotropy=8,t.needsUpdate=!0,t}function Yy(){const t=ln(512),a=512/2,o=a,n=5,s=1.15,r=Math.PI/n*.52,i=56;t.fillStyle="#ffffff";for(let l=0;l<n;l++){const h=l/n*Math.PI*2;t.beginPath();for(let d=0;d<=i;d++){const p=d/i*o,u=h+s*Math.PI*2*(p/o)-r,f=a+Math.cos(u)*p,m=a+Math.sin(u)*p;d===0?t.moveTo(f,m):t.lineTo(f,m)}for(let d=i;d>=0;d--){const p=d/i*o,u=h+s*Math.PI*2*(p/o)+r;t.lineTo(a+Math.cos(u)*p,a+Math.sin(u)*p)}t.closePath(),t.fill()}t.globalCompositeOperation="destination-out";const c=t.createRadialGradient(a,a,o*.9,a,a,o);return c.addColorStop(0,"rgba(0,0,0,0)"),c.addColorStop(1,"rgba(0,0,0,1)"),t.fillStyle=c,t.fillRect(0,0,512,512),t.globalCompositeOperation="source-over",hn(t)}function Vy(){const t=ln(256),a=256/2,o=t.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0.62)"),o.addColorStop(.55,"rgba(255,255,255,0.58)"),o.addColorStop(.88,"rgba(255,255,255,0.8)"),o.addColorStop(.975,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=o,t.fillRect(0,0,256,256),hn(t)}function Xy(){const t=ln(512),a=512/2,o=a,n=o*.74;t.fillStyle="#ffffff",t.beginPath(),t.moveTo(a+o,a),t.arc(a,a,o,0,Math.PI*2,!1),t.moveTo(a+n,a),t.arc(a,a,n,0,Math.PI*2,!0),t.fill(),t.globalCompositeOperation="destination-out";const s=40;t.fillStyle="rgba(0,0,0,0.5)";for(let c=0;c<s;c++){const l=c/s*Math.PI*2,h=l+Math.PI/s;t.beginPath(),t.moveTo(a,a),t.arc(a,a,o,l,h),t.closePath(),t.fill()}const r=t.createRadialGradient(a,a,o*.96,a,a,o);r.addColorStop(0,"rgba(0,0,0,0)"),r.addColorStop(1,"rgba(0,0,0,1)"),t.fillStyle=r,t.fillRect(0,0,512,512);const i=t.createRadialGradient(a,a,n,a,a,n*1.22);return i.addColorStop(0,"rgba(0,0,0,1)"),i.addColorStop(1,"rgba(0,0,0,0)"),t.fillStyle=i,t.fillRect(0,0,512,512),t.globalCompositeOperation="source-over",hn(t)}function Ky(){const t=ln(512),a=512/2,o=t.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0)"),o.addColorStop(.966,"rgba(255,255,255,0)"),o.addColorStop(.976,"rgba(255,255,255,1)"),o.addColorStop(.991,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=o,t.fillRect(0,0,512,512),hn(t)}function Zy(){const t=ln(64),a=64/2,o=t.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.35,"rgba(255,255,255,0.8)"),o.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=o,t.fillRect(0,0,64,64),hn(t)}const Hs=Yy(),Qy=Vy(),Jy=Xy(),a0=Ky(),qs=Zy(),Pt=new $a(1,96);Pt.rotateX(-Math.PI/2);const eb=new ve(1,1,.34,12),tb=new ve(1,1,.22,44),ab=new ve(.055,.055,1,10);function qe(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const ob=qe(3,()=>new K({map:Qy,color:Pa,transparent:!0,opacity:.6,depthWrite:!1})),nb=qe(2,()=>new K({map:Hs,color:Ha,transparent:!0,opacity:.5,depthWrite:!1})),sb=qe(2,()=>new K({map:Hs,color:Pa,transparent:!0,opacity:.9,depthWrite:!1})),rb=qe(6,()=>new K({map:Hs,color:Ha,transparent:!0,opacity:.9,depthWrite:!1})),ib=qe(3,()=>new K({map:Jy,color:Ha,transparent:!0,opacity:1,depthWrite:!1,blending:et})),o0=qe(4,()=>new K({map:a0,color:Pa,transparent:!0,opacity:1,depthWrite:!1})),cb=qe(2,()=>new K({map:a0,color:Ha,transparent:!0,opacity:1,depthWrite:!1})),lb=qe(10,()=>new K({map:Hs,color:Pa,transparent:!0,opacity:.9,depthWrite:!1})),hb=qe(14,()=>new K({color:Pa,transparent:!0,opacity:1})),db=qe(14,()=>new K({color:Ha,transparent:!0,opacity:1})),pb=qe(24,()=>new qt({map:qs,color:By,transparent:!0,opacity:1,depthWrite:!1,blending:et})),ub=qe(12,()=>new qt({map:qs,color:t0,transparent:!0,opacity:1,depthWrite:!1,blending:et})),fb=qe(12,()=>new qt({map:qs,color:Pa,transparent:!0,opacity:1,depthWrite:!1})),mb=qe(5,()=>new qt({map:qs,color:t0,transparent:!0,opacity:1,depthWrite:!1})),gb=qe(2,()=>new K({color:Ha,transparent:!0,opacity:1})),wb=qe(2,()=>new K({color:"#FBF7EE",transparent:!0,opacity:1}));function Rh(e,t,a,o,n,s){const r=lb(),i=new b(Pt,r);i.position.set(t,Wy,a),i.rotation.y=Math.random()*Math.PI*2,i.renderOrder=12;const c=(Math.random()<.5?-1:1)*(2.4+Math.random()*1.2),l=i.rotation.y;i.scale.setScalar(o*.35),e.spawnTransient(i,n,h=>{const d=1-Math.pow(1-Math.min(1,h*3.2),3);i.scale.setScalar(o*(.35+.65*d)),i.rotation.y=l+c*h*.35,r.opacity=s*(1-Math.pow(h,1.6))})}function Ch(e,t,a,o,n,s,r){const i=Math.random()<.45?hb():db(),c=new b(eb,i);c.scale.setScalar(s),c.position.set(t.x,t.y,t.z),c.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);const l=t.x,h=t.y,d=t.z,p=1.5+Math.random()*1.9,u=-9.4,f=(Math.random()-.5)*16,m=(Math.random()-.5)*16;e.spawnTransient(c,r,(g,w)=>{c.position.set(l+a*n*w,Math.max(.08,h+p*w+.5*u*w*w),d+o*n*w),c.rotation.x+=f*.016,c.rotation.z+=m*.016,i.opacity=1-Math.pow(g,2.2)})}function ba(e,t,a,o,n,s,r,i,c=pb,l=0){const h=c(),d=new io(h);d.position.set(t,a,o),d.scale.set(n,n,1),d.renderOrder=14,d.visible=l<=0;const p=(Math.random()-.5)*.5;e.spawnTransient(d,r+l,(u,f)=>{if(f<l){d.visible=!1;return}d.visible=!0;const m=Math.min(1,(f-l)/r),g=U.lerp(n,s,m);d.scale.set(g,g,1),d.position.y=a+i*m,d.position.x=t+p*m,h.opacity=1-Math.pow(m,1.5)})}function yb(e,t,a,o,n){const s=oe*.85,r=oe*1.7,i=new ee,c=Math.hypot(o,n)||1,l=s+oe*.5;i.position.set(t+o/c*l,0,a+n/c*l);const h=o0(),d=new b(Pt,h);d.scale.setScalar(s*1.16),d.position.y=.115,d.renderOrder=12,i.add(d);const p=gb(),u=new b(tb,p);u.scale.set(s,1,s),i.add(u);const f=sb(),m=new b(Pt,f);m.scale.setScalar(s*.99),m.position.y=.13,m.renderOrder=13,i.add(m);const g=wb(),w=new b(ab,g);w.scale.set(1,r,1);const y=new le(-o,0,-n);y.lengthSq()<1e-6&&y.set(0,0,-1),y.normalize(),w.quaternion.setFromUnitVectors(new le(0,1,0),y),w.position.set(y.x*(s+r*.5)*.92,.05,y.z*(s+r*.5)*.92),i.add(w);const x=5.2,k=.09;e.spawnTransient(i,.75,(v,M)=>{if(M<k){const A=M/k;i.position.y=x*(1-A*A),i.scale.set(1,1,1)}else{const A=Math.min(1,(M-k)/.16);i.position.y=0;const F=1-.55*(1-A)*Math.cos(A*Math.PI*1.2);i.scale.set(1+(1-F)*.22,Math.max(.25,F),1+(1-F)*.22)}const L=v<.45?1:1-(v-.45)/.55;p.opacity=L,g.opacity=L,f.opacity=.9*L,h.opacity=L})}const bb={Smash:{cast(e){const t=e.direction.x,a=e.direction.z,o=e.position.x-t*.75,n=e.position.z-a*.75,s=Math.atan2(a,t),r=oe*1.15,i=U.degToRad((e.weapon.cone??80)/2),c=oe*.34;for(let l=0;l<2;l++){const h=l*.05,d=rb();d.color.set(l===0?Ha:Pa);const p=new b(Pt,d);p.scale.setScalar(c*(1-l*.16)),p.renderOrder=13;const u=l===0?.95:.42;e.spawnTransient(p,.2,f=>{const m=U.clamp((f*.2-h)/.2,0,1),g=1-Math.pow(1-m,2),w=s-i+g*i*2;p.position.set(o+Math.cos(w)*r,U.lerp(oe*.8,.4,g),n+Math.sin(w)*r),p.rotation.y=w*1.6,d.opacity=u*(m<=0?0:1-Math.pow(f,2.4))})}for(let l=0;l<2;l++){const h=s+(Math.random()-.5)*i*1.4;ba(e,o+Math.cos(h)*r*1.05,oe*.5,n+Math.sin(h)*r*1.05,oe*.13,oe*.03,.2,.25)}},impact(e){const{x:t,z:a}=e.position,o=U.clamp(.85+e.damage*.03,.85,1.6);ba(e,t,e.position.y,a,oe*.3*o,oe*.6*o,.15,.1),Rh(e,t,a,oe*.32*o,.5,.85);const n=6;for(let s=0;s<n;s++){const r=s/n*Math.PI*2+Math.random()*.7;Ch(e,{x:t,y:e.position.y*.8,z:a},Math.cos(r),Math.sin(r),(1.7+Math.random()*1.9)*o,oe*(.065+Math.random()*.03),.42+Math.random()*.18)}for(let s=0;s<3;s++){const r=Math.random()*Math.PI*2;ba(e,t+Math.cos(r)*.3,e.position.y+.1,a+Math.sin(r)*.3,oe*.14,oe*.04,.34,.5)}}},Giant:{cast(e){const{x:t,z:a}=e.position,o=Ke(e.weapon.range??0),n=ob(),s=new b(Pt,n);s.position.set(t,Gy,a),s.renderOrder=10,s.scale.setScalar(o*.12),e.spawnTransient(s,1,u=>{const f=1-Math.pow(1-Math.min(1,u/.26),3);s.scale.setScalar(o*(.12+.88*f)),n.opacity=.3*(u<.2?1:Math.pow(1-(u-.2)/.8,1.5))});for(const[u,f,m,g]of[[o0(),1,.95,16],[cb(),.974,.9,17]]){const w=new b(Pt,u);w.position.set(t,Fh+.01,a),w.renderOrder=g,w.scale.setScalar(o*.12*f),e.spawnTransient(w,1,y=>{const x=1-Math.pow(1-Math.min(1,y/.26),3);w.scale.setScalar(o*(.12+.88*x)*f),u.opacity=m*(y<.42?1:Math.pow(1-(y-.42)/.58,1.4))})}const r=nb(),i=new b(Pt,r);i.position.set(t,Uy,a),i.renderOrder=11,i.scale.setScalar(o*.12),e.spawnTransient(i,1,u=>{const f=1-Math.pow(1-Math.min(1,u/.26),3);i.scale.setScalar(o*(.12+.88*f)),i.rotation.y=(1-Math.pow(1-u,2))*1.5,r.opacity=.4*(u<.22?1:Math.pow(1-(u-.22)/.78,1.5))});const c=ib(),l=new b(Pt,c);l.position.set(t,Fh,a),l.renderOrder=15,l.scale.setScalar(o*.05),e.spawnTransient(l,Lr+.22,(u,f)=>{const m=Math.min(1,f/Lr),g=1-Math.pow(1-m,2.2);l.scale.setScalar(o*(.05+.98*g)),l.rotation.y=g*.5,c.opacity=.95*(1-Math.pow(u,2.4))});const h=10,d=.55,p=Math.PI*(3-Math.sqrt(5));for(let u=0;u<h;u++){const f=o*d*Math.sqrt((u+.6)/h),m=u*p,g=t+Math.cos(m)*f,w=a+Math.sin(m)*f,y=f/o*Lr;ba(e,g,.55,w,oe*.2,oe*.68,.3,.55,fb,y),u%3===0&&ba(e,g,.5,w,oe*.12,oe*.34,.34,.7,mb,y+.03)}yb(e,t,a,e.direction.x,e.direction.z)},impact(e){const{x:t,z:a}=e.position,o=U.clamp(.9+e.damage*.035,.9,1.7);ba(e,t,e.position.y,a,oe*.34*o,oe*.62*o,.18,.12),Rh(e,t,a,oe*.42*o,.62,.9);const n=8;for(let s=0;s<n;s++){const r=s/n*Math.PI*2+Math.random()*.6;Ch(e,{x:t,y:e.position.y*.85,z:a},Math.cos(r),Math.sin(r),(2.1+Math.random()*2.2)*o,oe*(.07+Math.random()*.035),.48+Math.random()*.2)}for(let s=0;s<4;s++){const r=s/4*Math.PI*2+Math.random();ba(e,t+Math.cos(r)*.34,e.position.y+.15,a+Math.sin(r)*.34,oe*.11,oe*.04,.42,.85,ub)}}}},xb="#EFB868",vb="#CE8A2E",n0="#4A2A12",kb="#B93A28",Uo="#F7ECD3",fe=oe,Ze=Math.PI*2,js=.26;function qa(e,t=10){const a=new Bi(e,t);return a.rotateX(-Math.PI/2),a}function bc(e,t){const a=Math.tan(t)*e,o=-e*.58,n=e*.42,s=new ca;return s.moveTo(0,o),s.lineTo(-a,n),s.quadraticCurveTo(0,n+a*.5,a,n),s.closePath(),s}function Mb(e){const t=new ca;return t.moveTo(0,e),t.quadraticCurveTo(e*.82,e*.78,e*.96,-e*.06),t.quadraticCurveTo(e*.7,-e*.72,0,-e),t.quadraticCurveTo(-e*.84,-e*.66,-e,e*.04),t.quadraticCurveTo(-e*.7,e*.8,0,e),t}function s0(e,t,a=22){const o=new ca;for(let n=0;n<=a;n++){const s=n/a*Ze,r=1+Math.sin(s*3+e)*.17+Math.sin(s*5+t)*.11,i=Math.cos(s)*r,c=Math.sin(s)*r;n===0?o.moveTo(i,c):o.lineTo(i,c)}return o}function Sb(e){const t=new ca;return t.moveTo(-e,0),t.lineTo(e,0),t.lineTo(0,1),t.closePath(),t}const so=fe*.3,Wo=fe*.16,Xn=fe*.18,zh=qa(bc(so,.44),8),Kn=qa(Mb(Xn),8),xc=(()=>{const e=new $a(1,12);return e.rotateX(-Math.PI/2),e})(),Ih=(()=>{const e=new $a(Wo,20);e.rotateX(-Math.PI/2);const t=e.attributes.position;for(let a=1;a<t.count;a++){const o=t.getX(a),n=t.getZ(a),s=Math.atan2(n,o),r=1+Math.sin(s*3)*.13+Math.sin(s*7+1.3)*.075;t.setX(a,o*r),t.setZ(a,n*r)}return t.needsUpdate=!0,e})(),Lh=qa(bc(fe*.105,.52),4),r0=qa(bc(1,.62),3),i0=qa(s0(0,2.1),1),Eb=qa(s0(1.7,4.3),1),Tb=qa(Sb(.16),1),c0=(()=>{const e=new Aa(.62,1,18,1,0,Math.PI*.8);return e.rotateX(-Math.PI/2),e})(),Ab=(()=>{const e=new $a(fe*.032,6);return e.rotateX(-Math.PI/2),e})(),Fb=(()=>{const e=new pt(fe*.022,1,fe*.022);return e.translate(0,-.5,0),e})();function ja(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const da=e=>new K({color:e,side:we}),Oh=da("#F6E3B4"),_h=da("#E63946"),Dh=da("#FFD873"),Rb=da(xb),l0=da(vb),Cb=da(kb),zb=da(Uo),Ib=da(n0),Lb=ja(20,()=>new K({color:"#E63946",transparent:!0,opacity:1,side:we,depthWrite:!1})),h0=ja(24,()=>new K({color:n0,transparent:!0,opacity:1,side:we,depthWrite:!1})),d0=ja(10,()=>new K({color:"#B62430",transparent:!0,opacity:.9,side:we,depthWrite:!1})),Ob=ja(28,()=>new K({color:Uo,transparent:!0,opacity:.9,side:we,depthWrite:!1})),p0=ja(8,()=>new K({color:"#FFE9A8",transparent:!0,opacity:.9,side:we,blending:et,depthWrite:!1})),u0=ja(16,()=>new K({color:"#FFD9A0",transparent:!0,opacity:.5,side:we,blending:et,depthWrite:!1})),Or=ja(12,()=>new K({color:"#FFD873",transparent:!0,opacity:.95,side:we,depthWrite:!1})),_b=new le(0,1,0),$h=new le,Nh=new le,_r=new As,Ph=new As;function Ka(e,t,a,o){_r.setFromAxisAngle(_b,a);const n=Math.hypot(t.x,t.z);Math.abs(o)>1e-4&&n>1e-4?($h.set(t.z/n,0,-t.x/n),Ph.setFromAxisAngle($h,o),e.quaternion.copy(Ph).multiply(_r)):e.quaternion.copy(_r)}function vc(e,t,a){const o=new ee,n=new b(e,Ib);return n.scale.set(a,1,a),n.position.y=-fe*.011,o.add(n),o.add(new b(e,t)),o}function Db(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Dr(e,t,a){let o=e.userData.__spin;return o||(o={spin:Math.random()*Ze,rate:a*Ze/Db(t),shed:0},e.userData.__spin=o),o}function Hh(e,t,a,o){const n=u0();n.color.set(o),n.opacity=.45;const s=new b(c0,n);s.renderOrder=9,s.position.copy(e.position),s.rotation.y=a,s.scale.set(t,1,t),e.spawnTransient(s,.13,r=>{const i=t*(1+r*.28);s.scale.set(i,1,i),n.opacity=.45*(1-r)})}function Xt(e,t,a,o,n,s,r,i,c){const l=Ob();l.color.set(a),l.opacity=.9;const h=new b(Ab,l);h.renderOrder=9,h.position.copy(t),h.scale.setScalar(i);const d=t.x,p=t.y,u=t.z;e.spawnTransient(h,c,(f,m)=>{h.position.set(d+o*m,Math.max(js,p+n*m+.5*r*m*m),u+s*m),l.opacity=.9*(1-f*f)})}function $r(e,t,a,o,n,s,r){const i=new ee,c=h0();c.opacity=1;const l=new b(Lh,c);l.scale.set(1.22,1,1.22),l.position.y=-fe*.008,i.add(l);const h=Lb();h.color.set(a),h.opacity=1,i.add(new b(Lh,h)),i.renderOrder=9,i.position.copy(t),i.scale.setScalar(s);const d=t.x,p=t.y,u=t.z,f=Math.cos(o),m=Math.sin(o),g=f*n,w=m*n,y=.8+Math.random()*.9,x=-7.5,k=Math.random()*Ze,S=(Math.random()-.5)*24;e.spawnTransient(i,r,(v,M)=>{i.position.set(d+g*M,Math.max(js,p+y*M+.5*x*M*M),u+w*M),Nh.set(f,0,m),Ka(i,Nh,k+S*M,.22);const L=1-Math.pow(v,2.2);h.opacity=L,c.opacity=L})}function $b(e,t,a,o,n,s){const r=new ee;r.position.set(e.position.x,js,e.position.z),r.renderOrder=4;const i=d0();i.color.set(t),i.opacity=s;const c=new b(Math.random()<.5?i0:Eb,i);c.rotation.y=Math.random()*Ze,r.add(c);for(let l=0;l<o;l++){const h=new b(Tb,i);h.rotation.y=l/o*Ze+Math.random()*.7,h.scale.set(.7+Math.random()*.4,1,1+Math.random()*.4),r.add(h)}e.spawnTransient(r,n,l=>{const h=1-Math.pow(1-Math.min(1,l*5),3);r.scale.set(a*h,1,a*h),i.opacity=s*(l<.55?1:1-(l-.55)/.45)})}function Nr(e,t,a,o){const n=p0();n.color.set(t),n.opacity=.9;const s=new b(r0,n);s.renderOrder=11,s.position.copy(e.position),s.rotation.y=Math.random()*Ze,s.scale.set(a*.35,1,a*.35),e.spawnTransient(s,o,r=>{const i=U.lerp(a*.35,a,1-Math.pow(1-r,2));s.scale.set(i,1,i),n.opacity=.9*(1-r)})}function Pr(e){return U.clamp(.85+e*.035,.85,1.4)}function Nb(e){const t=vc(zh,Rb,1.15);_h.color.set(e);const a=new b(zh,_h);a.scale.set(.86,1,.86),a.position.set(0,fe*.006,so*.04),t.add(a);for(const[o,n,s]of[[-.2,-.1,.075],[.15,.11,.06]]){const r=new b(xc,Cb);r.position.set(so*o,fe*.012,so*n),r.scale.setScalar(so*s*2),t.add(r)}return t}function Pb(e){const t=vc(Ih,l0,1.13);Oh.color.set(e);const a=new b(Ih,Oh);a.scale.set(.84,1,.84),a.position.y=fe*.006,t.add(a);const o=new b(xc,zb);return o.scale.setScalar(Wo*.44),o.position.set(Wo*.4,fe*.011,-Wo*.26),t.add(o),t}function Hb(e){Dh.color.set(e);const t=vc(Kn,Dh,1.12),a=new b(xc,l0);return a.scale.setScalar(Xn*.22),a.position.set(Xn*.34,fe*.006,Xn*.2),t.add(a),t}const qb={Dough:{projectile(e){const t=Pb(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Dr(t,e.weapon,2.6);o.spin+=o.rate*a,Ka(t,e.direction,o.spin,.15+Math.sin(o.spin*.37)*.07),t.position.y+=Math.sin(o.spin*.5)*fe*.012,o.shed-=a,o.shed<=0&&(o.shed=.055+Math.random()*.04,Xt(e,e.position,Uo,-e.direction.x*.5+(Math.random()-.5)*.5,.25+Math.random()*.4,-e.direction.z*.5+(Math.random()-.5)*.5,-1.1,.5+Math.random()*.35,.3+Math.random()*.15),Math.random()<.45&&Hh(e,Wo*1.2,o.spin,"#FFF0CC"))},impact(e){const t=Pr(e.damage),a=d0();a.color.set("#F0DDAE"),a.opacity=.95;const o=new b(i0,a);o.renderOrder=4,o.position.set(e.position.x,js,e.position.z),o.rotation.y=Math.random()*Ze;const n=fe*.25*t;e.spawnTransient(o,.62,s=>{const r=U.lerp(n*.3,n,1-Math.pow(1-Math.min(1,s*4),3));o.scale.set(r,1,r),a.opacity=.95*(s<.5?1:1-(s-.5)/.5)}),Nr(e,"#FFF3D2",fe*.3*t,.18);for(let s=0;s<10;s++){const r=s/10*Ze+Math.random()*.5,i=(.9+Math.random()*1.2)*t;Xt(e,e.position,Uo,Math.cos(r)*i,.7+Math.random()*.9,Math.sin(r)*i,-2.4,.6+Math.random()*.6,.45+Math.random()*.25)}for(let s=0;s<4;s++)$r(e,e.position,"#EFD9A6",Math.random()*Ze,(1.9+Math.random()*1.3)*t,(.55+Math.random()*.35)*t,.4+Math.random()*.14)},cast(e){const t=u0();t.color.set("#FFF0CC"),t.opacity=.6;const a=new b(c0,t);a.renderOrder=11,a.position.copy(e.position),e.spawnTransient(a,.16,o=>{const n=U.lerp(fe*.05,fe*.16,o);a.scale.set(n,1,n),a.rotation.y=o*9,t.opacity=.6*(1-o)});for(let o=0;o<5;o++)Xt(e,e.position,Uo,e.direction.x*(.5+Math.random()*.6)+(Math.random()-.5)*.6,.5+Math.random()*.5,e.direction.z*(.5+Math.random()*.6)+(Math.random()-.5)*.6,-1.6,.55+Math.random()*.4,.3+Math.random()*.15)}},Tomato:{projectile(e){const t=Nb(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Dr(t,e.weapon,1.8);o.spin+=o.rate*a,Ka(t,e.direction,o.spin,.17+Math.sin(o.spin*.5)*.06),o.shed-=a,o.shed<=0&&(o.shed=.058,Hh(e,so*.62,o.spin,"#FFC08A"),Math.random()<.5&&Xt(e,e.position,"#C4262F",-e.direction.x*.7+(Math.random()-.5)*.4,.15+Math.random()*.3,-e.direction.z*.7+(Math.random()-.5)*.4,-2.2,.5+Math.random()*.3,.26))},impact(e){const t=Pr(e.damage);Nr(e,"#FFE7CC",fe*.4*t,.18),$b(e,e.color,fe*.22*t,4,.55,.9);for(let a=0;a<5;a++){const o=a/5*Ze+Math.random()*.6;$r(e,e.position,e.color,o,(2.2+Math.random()*1.4)*t,(.75+Math.random()*.45)*t,.4+Math.random()*.14)}for(let a=0;a<6;a++){const o=Math.random()*Ze,n=(1.3+Math.random()*1.5)*t;Xt(e,e.position,"#C4262F",Math.cos(o)*n,1+Math.random()*1.1,Math.sin(o)*n,-6.5,.7+Math.random()*.5,.34+Math.random()*.14)}},cast(e){const t=p0();t.color.set("#FF8E6A"),t.opacity=.85;const a=new b(r0,t);a.renderOrder=11,a.position.copy(e.position),a.rotation.y=Math.atan2(e.direction.x,e.direction.z),e.spawnTransient(a,.15,o=>{const n=U.lerp(fe*.08,fe*.24,1-Math.pow(1-o,2));a.scale.set(n*.7,1,n),t.opacity=.85*(1-o)});for(let o=0;o<3;o++)Xt(e,e.position,"#C4262F",e.direction.x*(1+Math.random())+(Math.random()-.5)*.5,.4+Math.random()*.4,e.direction.z*(1+Math.random())+(Math.random()-.5)*.5,-2.6,.6,.28)}},Cheese:{projectile(e){const t=Hb(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=Dr(t,e.weapon,.9);o.spin+=o.rate*a,Ka(t,e.direction,o.spin,.2*Math.sin(o.spin*1.9));const n=1+Math.sin(o.spin*2.4)*.22;t.scale.set(1/n,1,n),t.position.y+=Math.sin(o.spin*1.2)*fe*.016,o.shed-=a,o.shed<=0&&(o.shed=.13+Math.random()*.07,Xt(e,e.position,"#FFE49A",-e.direction.x*.4,-.1,-e.direction.z*.4,-1.6,.5,.24))},impact(e){const t=Pr(e.damage),a=fe*.96,o=Or();o.color.set(e.color),o.opacity=.95;const n=new b(Kn,o);n.renderOrder=11;const s=h0();s.opacity=.6;const r=new b(Kn,s);r.scale.set(1.12,1,1.12),r.position.y=-fe*.008,n.add(r),n.position.set(e.position.x,a,e.position.z);const i=1.8*t;e.spawnTransient(n,.5,c=>{const l=U.lerp(i*.4,i,1-Math.pow(1-Math.min(1,c*3.5),3));n.scale.set(l,1,l*(1-c*.25)),n.position.y=a-c*c*fe*.34,Ka(n,e.direction,c*1.2,.35+c*.5);const h=c<.6?1:1-(c-.6)/.4;o.opacity=.95*h,s.opacity=.6*h}),Nr(e,"#FFF6D8",fe*.26*t,.17);for(let c=0;c<4;c++){const l=Or();l.color.set("#FFE08A"),l.opacity=.9;const h=new b(Fb,l);h.renderOrder=10;const d=Math.random()*Ze,p=fe*(.06+Math.random()*.08)*t;h.position.set(e.position.x+Math.cos(d)*p,a-fe*.04,e.position.z+Math.sin(d)*p);const u=fe*(.14+Math.random()*.12)*t;e.spawnTransient(h,.42,f=>{h.scale.set(1-f*.55,u*(.3+f*.7),1-f*.55),l.opacity=.9*(1-f*f)})}for(let c=0;c<3;c++)$r(e,e.position,"#FFD873",Math.random()*Ze,(1+Math.random())*t,(.55+Math.random()*.3)*t,.38)},cast(e){const t=Or();t.color.set(e.color),t.opacity=.85;const a=new b(Kn,t);a.renderOrder=11,a.position.copy(e.position),e.spawnTransient(a,.16,o=>{const n=U.lerp(.3,.85,1-Math.pow(1-o,2));a.scale.set(n*(.5+o*.6),1,n),Ka(a,e.direction,o*2.4,.3-o*.25),t.opacity=.85*(1-o)});for(let o=0;o<3;o++)Xt(e,e.position,"#FFE49A",e.direction.x*(.6+Math.random()*.5),.35+Math.random()*.3,e.direction.z*(.6+Math.random()*.5),-2,.55,.26)}}},bo="#FFFDF6",f0="#E4D7BE",na="#22301F",jb="#3E5B33",kc=Et.salmon,Mc="#B85B26",m0="#FFEEDD",g0="#F2FBFF",w0="#8FD3E8",Z=oe,ht=Math.PI*2,ut=.29;function y0(e,t=8){const a=new Bi(e,t);return a.rotateX(-Math.PI/2),a}const gt=(()=>{const e=new za(1,1);return e.rotateX(-Math.PI/2),e})(),qh=(()=>{const e=new ca;e.moveTo(0,0),e.quadraticCurveTo(1,.5,0,1),e.quadraticCurveTo(-1,.5,0,0);const t=y0(e,10);return t.translate(0,0,1),t})(),jh=(()=>{const t=new ca;return t.moveTo(-.5+.22,-.5),t.lineTo(.5-.22,-.5),t.quadraticCurveTo(.5,-.5,.5,-.5+.22),t.lineTo(.5,.5-.22),t.quadraticCurveTo(.5,.5,.5-.22,.5),t.lineTo(-.5+.22,.5),t.quadraticCurveTo(-.5,.5,-.5,.5-.22),t.lineTo(-.5,-.5+.22),t.quadraticCurveTo(-.5,-.5,-.5+.22,-.5),y0(t,6)})(),Sc=(()=>{const e=new yt(.5,7,5);return e.scale(.44,.44,1),e})(),Bb=new ve(.5,.5,1,20,1,!0),Hr=(()=>{const e=new $a(.5,20);return e.rotateX(-Math.PI/2),e})(),Gb=new ve(.5,.5,1,12,1,!0,0,Math.PI),Bh=(()=>{const e=new $a(.5,12,-Math.PI/2,Math.PI);return e.rotateX(-Math.PI/2),e})(),Ub=(()=>{const e=new za(1,1);return e.rotateY(-Math.PI/2),e})(),Je=Z*.155,b0=Z*.46,Zn=Z*.3,xt=Z*.185,_n=Z*.2;function bt(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const dn=e=>new K({color:e,side:we}),x0=dn(bo),Wb=dn(f0),v0=dn(na),Yb=dn(Mc),Gh=new Map;function Ec(e){let t=Gh.get(e);return t||(t=dn(e),Gh.set(e,t)),t}const pa=(e,t)=>new K({color:e,transparent:!0,opacity:t,side:we,depthWrite:!1}),k0=(e,t)=>new K({color:e,transparent:!0,opacity:t,side:we,depthWrite:!1,depthTest:!1}),M0=bt(56,()=>new K({color:bo,transparent:!0,opacity:1,depthWrite:!1})),Vb=bt(12,()=>k0(g0,1)),Xb=bt(12,()=>k0(w0,.5)),fs=bt(28,()=>pa(na,1)),ms=bt(28,()=>pa(jb,1)),Kb=bt(24,()=>pa(kc,1)),Zb=bt(24,()=>pa(Mc,1)),Qb=bt(24,()=>pa(m0,1)),Jb=bt(12,()=>pa(na,1)),e2=bt(12,()=>pa(bo,1)),t2=bt(12,()=>pa(kc,1));function kt(e,t){return Math.atan2(e,t)}function a2(e,t=.62){const a=Math.sin(e),o=Math.cos(e);if(Math.abs(a)>=t)return e;const n=a>=0?1:-1,s=o>=0?1:-1;return Math.atan2(n*t,s*Math.sqrt(1-t*t))}function qr(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Dn(e){return U.clamp(.85+e*.035,.85,1.4)}function jr(e){let t=e.userData.__sushi;return t||(t={phase:Math.random()*ht,shed:0,grow:0},e.userData.__sushi=t),t}function $n(e,t,a,o,n,s,r,i){const c=new ee,l=a2(n);c.rotation.y=l,c.position.set(t-Math.sin(l)*s*.5,a,o-Math.cos(l)*s*.5),c.renderOrder=13;const h=Xb();h.color.set(w0),h.opacity=.55;const d=new b(qh,h);d.scale.set(2.9,1,1.02),d.position.y=-Z*.006,d.renderOrder=0,c.add(d);const p=Vb();p.color.set(g0),p.opacity=1;const u=new b(qh,p);u.renderOrder=1,c.add(u),e.spawnTransient(c,i,f=>{const m=Math.min(1,f*8);c.scale.set(r*(1-f*.55),1,Math.max(.02,s*m));const g=f<.3?1:1-(f-.3)/.7;p.opacity=g,h.opacity=.55*g*g})}function xa(e,t,a,o,n,s,r,i,c,l=!1){const h=M0();h.color.set(l?f0:bo),h.opacity=1;const d=new b(Sc,h);d.renderOrder=9,d.scale.setScalar(i),d.position.set(t,a,o);const p=-9.6,u=(Math.random()-.5)*14,f=(Math.random()-.5)*14;e.spawnTransient(d,c,(m,g)=>{let w=a+s*g+.5*p*g*g,y=1;if(w<ut){const x=ut-w;w=ut+x*.28,y=.35,w<ut&&(w=ut)}d.position.set(t+n*g,w,o+r*g*1),d.rotation.set(u*g*y,f*g*y,0),h.opacity=1-m*m*m})}function o2(e,t,a){const o=new ee,n=new b(jh,a.deep);n.scale.set(e*1.16,1,t*1.1),n.position.y=-Z*.008,o.add(n);const s=new b(jh,a.face);s.scale.set(e,1,t),o.add(s);for(let r=0;r<2;r++){const i=new b(gt,a.fat);i.scale.set(e*.86,1,t*.09),i.position.set(0,Z*.005,t*(r===0?-.18:.16)),o.add(i)}return o}function Uh(e,t,a){const o=new ee,n=new b(Gb,a.wall);n.scale.set(e*2,t,e*2),o.add(n);const s=new b(Bh,a.face);s.scale.set(e*1.6,1,e*1.6),s.position.y=t*.5,o.add(s);const r=new b(Bh,a.core);r.scale.set(e*.94,1,e*.94),r.position.y=t*.5+Z*.004,o.add(r);const i=new b(Ub,a.face);return i.scale.set(1,t*.98,e*1.96),o.add(i),o}function n2(e){const t=new ee,a=e==="#FFFFFF"?x0:Ec(e),o=[[0,0,Je*.34,1],[-Je*.4,Z*.012,-Je*.3,.85],[Je*.38,-Z*.014,-Je*.42,.78]];for(let n=0;n<o.length;n++){const[s,r,i,c]=o[n],l=new b(Sc,n===1?Wb:a);l.scale.setScalar(Je*c),l.position.set(s,r,i),l.rotation.set(0,(n-1)*.5,0),t.add(l)}return t}function s2(e){const t=new ee,a=[],o=4,n=b0/o,s=Ec(e);for(let i=0;i<o;i++){const c=new ee,l=new b(gt,v0);l.scale.set(Zn,1,n*1.02),c.add(l);for(const h of[-1,1]){const d=new b(gt,s);d.scale.set(Zn*.1,1,n*1.02),d.position.set(h*Zn*.45,Z*.004,0),c.add(d)}c.position.z=(i-(o-1)/2)*n,t.add(c),a.push(c)}const r={segs:a};return t.userData.__parts=r,t}function r2(e){const t=new ee,a=new b(Bb,v0);a.scale.set(xt*2,_n,xt*2),t.add(a);const o=new b(Hr,x0);o.scale.set(xt*1.6,1,xt*1.6),o.position.y=_n*.5,t.add(o);const n=new b(Hr,Ec(e));n.scale.set(xt*.94,1,xt*.94),n.position.y=_n*.5+Z*.004,t.add(n);const s=new b(Hr,Yb);return s.scale.set(xt*.34,1,xt*.34),s.position.set(xt*.46,_n*.5+Z*.005,-xt*.3),t.add(s),t}const i2={Rice:{projectile(e){const t=n2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=jr(t);o.phase+=a/qr(e.weapon)*ht*1.6,t.rotation.y=kt(e.direction.x,e.direction.z)+Math.sin(o.phase)*.3;const n=1+Math.sin(o.phase*1.9)*.14;t.scale.set(n,1,1/n);for(let s=0;s<t.children.length;s++)t.children[s].rotation.x=o.phase*(.6+s*.35);o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,xa(e,e.position.x,e.position.y,e.position.z,-e.direction.x*.5+(Math.random()-.5)*.7,-.15,-e.direction.z*.5+(Math.random()-.5)*.7,Je*.75,.3+Math.random()*.12,Math.random()<.4))},impact(e){const t=Dn(e.damage),{x:a,y:o,z:n}=e.position,s=e.direction,r=Z*.26*t;for(let h=0;h<7;h++){const d=h/7*ht+Math.random()*.7,p=(1.9+Math.random()*1.5)*t;xa(e,a+Math.cos(d)*r,o,n+Math.sin(d)*r,Math.cos(d)*p+s.x*.7,1.5+Math.random()*1.2,Math.sin(d)*p+s.z*.7,Je*(.9+Math.random()*.5)*t,.44+Math.random()*.16,Math.random()<.35)}const i=Math.hypot(s.x,s.z)>1e-4?Z*.34:0,c=M0();c.color.set(bo),c.opacity=1;const l=new b(Sc,c);l.renderOrder=12,l.position.set(a-s.x*i,o,n-s.z*i),l.rotation.y=kt(s.x,s.z)+Math.PI*.5,e.spawnTransient(l,.14,h=>{l.scale.setScalar(U.lerp(Z*.12,Z*.3,h)*t),c.opacity=1-h})},cast(e){const t=e.direction;for(let a=0;a<6;a++)xa(e,e.position.x,e.position.y,e.position.z,t.x*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,.5+Math.random()*.5,t.z*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,Je*(.7+Math.random()*.4),.3+Math.random()*.12,Math.random()<.4)}},Seaweed:{projectile(e){const t=s2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=jr(t);o.phase+=a/qr(e.weapon)*ht*2.8,t.rotation.y=kt(e.direction.x,e.direction.z);const n=t.userData.__parts;if(n)for(let s=0;s<n.segs.length;s++){const r=o.phase-s*1.1;n.segs[s].rotation.x=Math.sin(r)*.42,n.segs[s].position.y=Math.sin(r)*Z*.03}o.shed-=a,o.shed<=0&&(o.shed=.14+Math.random()*.08,Br(e,e.position.x,e.position.y,e.position.z,-e.direction.x*.5+(Math.random()-.5)*.6,-.05,-e.direction.z*.5+(Math.random()-.5)*.6,Z*.075,.28,e.color))},impact(e){const t=Dn(e.damage),a=e.direction,o=kt(a.x,a.z),{x:n,y:s,z:r}=e.position,i=new ee;i.rotation.y=o,i.position.set(n+a.x*Z*.42,ut,r+a.z*Z*.42),i.renderOrder=5;const c=ms();c.color.set(e.color),c.opacity=.95;const l=new b(gt,c);l.scale.set(1.1,1,1.07),l.position.y=-.004,i.add(l);const h=fs();h.color.set(na),h.opacity=.95,i.add(new b(gt,h));const d=Z*.42*t,p=Z*.72*t;e.spawnTransient(i,.85,f=>{const m=1-Math.pow(1-Math.min(1,f*8),3);i.scale.set(d,1,Math.max(.02,p*m));const g=f<.55?1:1-(f-.55)/.45;h.opacity=.95*g,c.opacity=.95*g});const u=Z*.28*t;for(let f=0;f<4;f++){const m=f/4*ht+Math.random()*.8,g=(1.7+Math.random()*1.2)*t;c2(e,n+Math.cos(m)*u,s,r+Math.sin(m)*u,Math.cos(m)*g,1.3+Math.random()*1.1,Math.sin(m)*g,Z*(.34+Math.random()*.16)*t,.42+Math.random()*.14,e.color)}for(let f=0;f<5;f++){const m=Math.random()*ht;Br(e,n+Math.cos(m)*u*.8,s,r+Math.sin(m)*u*.8,Math.cos(m)*(1.6+Math.random()*1.4),1.2+Math.random(),Math.sin(m)*(1.6+Math.random()*1.4),Z*.085*t,.36,e.color)}},cast(e){const t=e.direction,a=kt(t.x,t.z),o=new ee;o.rotation.y=a,o.position.copy(e.position),o.renderOrder=11;const n=ms();n.color.set(e.color),n.opacity=1;const s=new b(gt,n);s.scale.set(1.12,1,1.08),s.position.y=-Z*.006,o.add(s);const r=fs();r.color.set(na),r.opacity=1,o.add(new b(gt,r)),e.spawnTransient(o,.18,i=>{const c=1-Math.pow(1-i,2);o.scale.set(Zn*(.5+c*.6),1,b0*(.25+c*.8)),o.position.set(e.position.x+t.x*c*Z*.16,e.position.y,e.position.z+t.z*c*Z*.16),r.opacity=1-i,n.opacity=1-i});for(let i=0;i<3;i++)Br(e,e.position.x,e.position.y,e.position.z,t.x*(1+Math.random())+(Math.random()-.5)*.7,.4+Math.random()*.4,t.z*(1+Math.random())+(Math.random()-.5)*.7,Z*.08,.28,e.color)}},Fish:{impact(e){const t=Dn(e.damage),a=e.direction,{x:o,y:n,z:s}=e.position,r=kt(a.x,a.z);$n(e,o,n,s,r+Math.PI*.5,Z*.95*t,Z*.078,.28);const i=Z*.3*t;for(let c=0;c<5;c++){const l=c/5*ht+Math.random()*.5;Gr(e,o+Math.cos(l)*i,n,s+Math.sin(l)*i,l,(1.5+Math.random()*1)*t,Z*.16*t,Z*.3*t,.5+Math.random()*.16)}for(let c=0;c<8;c++){const l=Math.random()*ht,h=(1.7+Math.random()*1.4)*t;xa(e,o+Math.cos(l)*i*.85,n,s+Math.sin(l)*i*.85,Math.cos(l)*h,1.4+Math.random()*1.2,Math.sin(l)*h,Je*(.85+Math.random()*.4)*t,.42+Math.random()*.14,Math.random()<.35)}},cast(e){const t=e.direction,a=kt(t.x,t.z);$n(e,e.position.x,e.position.y,e.position.z,a+Math.PI*.42,Z*.5,Z*.062,.17);const o=(e.weapon.cone??150)*Math.PI/180;for(let n=0;n<3;n++){const s=(n-1)*o*.3,r=a+s;Gr(e,e.position.x,e.position.y,e.position.z,Math.atan2(Math.sin(r),Math.cos(r))-Math.PI*.5,1.5+Math.random()*.7,Z*.12,Z*.22,.34)}}},Catch:{projectile(e){const t=r2(e.color);return t.position.copy(e.position),t.scale.setScalar(.6),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=jr(t),n=qr(e.weapon);o.phase+=a/n*ht*1.1,o.grow=Math.min(1,o.grow+a/n),t.rotation.y=o.phase;const s=U.lerp(.6,1.28,1-Math.pow(1-o.grow,2));t.scale.setScalar(s),t.position.y+=Math.sin(o.phase*1.6)*Z*.02,o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,xa(e,e.position.x,e.position.y,e.position.z,-e.direction.x*.6+(Math.random()-.5)*.8,.1,-e.direction.z*.6+(Math.random()-.5)*.8,Je*.8,.32,Math.random()<.4))},impact(e){const t=Dn(e.damage),a=e.direction,{x:o,y:n,z:s}=e.position,i=kt(a.x,a.z)+Math.PI*.5;$n(e,o,n,s,i,Z*1.12*t,Z*.085,.32);const c=Z*.25*t,l=Z*.26*t,h=new ee;h.rotation.y=i,h.position.set(o,n-Z*.05,s),h.renderOrder=10;const d=Jb();d.color.set(na),d.opacity=1;const p=e2();p.color.set(bo),p.opacity=1;const u=t2();u.color.set(e.color),u.opacity=1;const f={wall:d,face:p,core:u},m=Uh(c,l,f),g=Uh(c,l,f);g.rotation.y=Math.PI,h.add(m,g);const w=Z*.185*t,y=Z*.4*t,x=n-Z*.05-(ut+c*.6);e.spawnTransient(h,.55,S=>{const v=1-Math.pow(1-S,2),M=U.lerp(w,y,v);m.position.x=M,g.position.x=-M,m.rotation.z=-v*.9,g.rotation.z=v*.9,h.position.y=n-Z*.05-x*v*v;const L=S<.6?1:1-(S-.6)/.4;d.opacity=L,p.opacity=L,u.opacity=L});const k=Z*.3*t;for(let S=0;S<9;S++){const v=S/9*ht+Math.random()*.6,M=(1.9+Math.random()*1.5)*t;xa(e,o+Math.cos(v)*k,n,s+Math.sin(v)*k,Math.cos(v)*M,1.6+Math.random()*1.3,Math.sin(v)*M,Je*(.9+Math.random()*.5)*t,.46+Math.random()*.16,Math.random()<.35)}for(let S=0;S<2;S++){const v=i+(S===0?.6:-.6)+Math.PI*(S===0?0:1);Gr(e,o+Math.cos(v)*k,n,s+Math.sin(v)*k,v,(1.6+Math.random()*.9)*t,Z*.14*t,Z*.26*t,.48)}},cast(e){const t=e.direction,a=kt(t.x,t.z);$n(e,e.position.x,e.position.y,e.position.z,a+Math.PI*.38,Z*.58,Z*.068,.18);for(let o=0;o<5;o++)xa(e,e.position.x,e.position.y,e.position.z,t.x*(1.3+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,t.z*(1.3+Math.random())+(Math.random()-.5)*.9,Je*.8,.3,Math.random()<.4)}}};function Br(e,t,a,o,n,s,r,i,c,l){const h=new ee,d=ms();d.color.set(l),d.opacity=1;const p=new b(gt,d);p.scale.set(i*1.3,1,i*.75),p.position.y=-Z*.005,h.add(p);const u=fs();u.color.set(na),u.opacity=1;const f=new b(gt,u);f.scale.set(i,1,i*.55),h.add(f),h.renderOrder=9,h.position.set(t,a,o),h.rotation.y=Math.random()*ht;const m=(Math.random()-.5)*9,g=-5.2;e.spawnTransient(h,c,(w,y)=>{h.position.set(t+n*y,Math.max(ut,a+s*y+.5*g*y*y),o+r*y),h.rotation.y+=m*.016,u.opacity=1-w*w,d.opacity=1-w*w})}function c2(e,t,a,o,n,s,r,i,c,l){const h=new ee,d=ms();d.color.set(l),d.opacity=1;const p=new b(gt,d);p.scale.set(Z*.075,1,i*1.03),p.position.y=-Z*.006,h.add(p);const u=fs();u.color.set(na),u.opacity=1;const f=new b(gt,u);f.scale.set(Z*.05,1,i),h.add(f),h.renderOrder=9,h.position.set(t,a,o);const m=-5.6,g=(Math.random()-.5)*4.5;e.spawnTransient(h,c,(w,y)=>{h.position.set(t+n*y,Math.max(ut,a+s*y+.5*m*y*y),o+r*y),h.rotation.y=kt(n,r)+g*y,h.scale.set(1+w*.5,1,1-w*.35),u.opacity=1-w*w,d.opacity=1-w*w})}function Gr(e,t,a,o,n,s,r,i,c){const l=Kb();l.color.set(kc),l.opacity=1;const h=Zb();h.color.set(Mc),h.opacity=1;const d=Qb();d.color.set(m0),d.opacity=1;const p=o2(r,i,{face:l,deep:h,fat:d});p.renderOrder=9,p.position.set(t,a,o),p.rotation.y=n+Math.PI*.5;const u=Math.cos(n)*s,f=Math.sin(n)*s,m=.9+Math.random()*.7,g=-7.8,w=(Math.random()-.5)*2.2;e.spawnTransient(p,c,(y,x)=>{const k=a+m*x+.5*g*x*x,S=k<=ut;p.position.set(t+u*x,S?ut:k,o+f*x),p.rotation.y=n+Math.PI*.5+w*x;const v=1-Math.pow(y,2.4);l.opacity=v,h.opacity=v,d.opacity=v})}const Tc="#FFB35C",l2="#B4400C",h2="#FFF2E2",S0="#FFE9A8",ne=oe,Pe=.27,Ur=ne*.3,d2=ne*.34,Wr=ne*.55,Ra=ne*.042,He=ne*.085,zt=ne*.4,p2=ne*.024;function E0(e){let t=e%2147483647;return t<=0&&(t+=2147483646),()=>(t=t*48271%2147483647,t/2147483647)}function Yr(e,t){const o=E0(e),n=o()*Math.PI*2,s=o()*Math.PI*2,r=o()*Math.PI*2,i=[];for(let u=0;u<t;u++)i.push([o()*Math.PI*2,.14+o()*.2,.16+o()*.14]);const c=[];let l=0;for(let u=0;u<=84;u++){const f=u/84*Math.PI*2;let m=1+.15*Math.sin(3*f+n)+.09*Math.sin(5*f+s)+.05*Math.sin(8*f+r);for(const[g,w,y]of i){let x=f-g;for(;x>Math.PI;)x-=Math.PI*2;for(;x<-Math.PI;)x+=Math.PI*2;m+=w*Math.exp(-(x*x)/(2*y*y))}c.push(m),m>l&&(l=m)}const h=new Float32Array(258);for(let u=0;u<=84;u++){const f=u/84*Math.PI*2,m=c[u]/l,g=(u+1)*3;h[g]=Math.cos(f)*m,h[g+1]=0,h[g+2]=Math.sin(f)*m}const d=[];for(let u=1;u<=84;u++)d.push(0,u+1,u);const p=new an;return p.setAttribute("position",new es(h,3)),p.setIndex(d),p.computeVertexNormals(),p}const Wh=[Yr(9173,4),Yr(48271,5),Yr(11071,3)];let u2=0;const T0=()=>Wh[u2++%Wh.length],Jo=new yt(1,9,7);Jo.scale(.78,.78,1.4);const en=new yt(1,10,8),f2=(()=>{const t=document.createElement("canvas");t.width=t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.95)"),o.addColorStop(.45,"rgba(255,255,255,0.52)"),o.addColorStop(.78,"rgba(255,255,255,0.14)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new tt(t);return n.colorSpace=$i,n})();function Vr(e){const t=E0(e),a=1.1+t()*1.4,o=.9+t()*1.3,n=.13+t()*.11,s=.08+t()*.09,r=[],i=8;for(let c=0;c<i;c++){const l=c/(i-1);r.push(new le(Math.sin(l*Math.PI*a+e)*n,Math.cos(l*Math.PI*o+e)*s,l-.5))}return new Ru(new Cu(r),20,p2/zt,5,!1)}const Yh=[Vr(7919),Vr(30011),Vr(65449)];let m2=0;const A0=()=>Yh[m2++%Yh.length];function It(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const ua=(e,t)=>new K({color:e,transparent:!0,opacity:t,depthWrite:!1,side:we}),F0=It(10,()=>ua(l2,.9)),g2=It(10,()=>ua(Tc,.9)),R0=It(28,()=>ua("#E8792A",.95)),gs=It(14,()=>ua(Tc,.95)),w2=It(16,()=>ua(S0,1)),Ci=It(6,()=>ua("#E8792A",1)),y2=It(6,()=>ua(Tc,1)),b2=It(12,()=>ua(S0,1)),x2=It(16,()=>new qt({map:f2,color:h2,transparent:!0,opacity:.5,depthWrite:!1})),v2=It(8,()=>new K({color:"#FFF4DF",transparent:!0,opacity:.9,depthWrite:!1,blending:et})),Nn=new le,k2=new le(0,0,1);function ws(e,t,a,o){Nn.set(t,a,o),!(Nn.lengthSq()<1e-9)&&(Nn.normalize(),e.quaternion.setFromUnitVectors(k2,Nn))}function sa(e,t,a,o,n,s,r,i,c,l=!1){const h=new b(Jo,l?gs():R0()),d=h.material,p=.95;d.opacity=p,h.position.set(t,a,o);const u=-9.4;e.spawnTransient(h,c,(f,m)=>{const g=a+s*m+.5*u*m*m,w=g<=Pe;h.position.set(t+n*m,w?Pe:g,o+r*m);const y=s+u*m;if(w)ws(h,n,0,r),h.scale.set(i*1.5,i*.3,i*1.7);else{ws(h,n,y,r);const x=Math.hypot(n,y,r),k=1+Math.min(.9,x*.075);h.scale.set(i/Math.sqrt(k),i/Math.sqrt(k),i*k)}d.opacity=p*(1-f*f)})}function Ca(e,t,a,o,n,s,r){const i=new io(x2()),c=i.material;c.opacity=0;const l=(Math.random()-.5)*n*1.6,h=(Math.random()-.5)*n*1.6;i.renderOrder=9,i.position.set(t,a,o),i.scale.set(n*1.1,n*1.1,1),e.spawnTransient(i,r,d=>{const p=1-Math.pow(1-d,2);i.position.set(t+l*p,a+s*p,o+h*p);const u=n*(1.1+p*1.5);i.scale.set(u,u,1),c.opacity=.5*Math.sin(Math.min(1,d*1.3)*Math.PI)})}function Ac(e,t,a,o,n){const s=T0(),r=Math.random()*Math.PI*2,i=new b(s,F0()),c=i.material;i.rotation.y=r,i.position.set(t,Pe,a),i.renderOrder=6,i.scale.setScalar(o*.35);const l=new b(s,g2()),h=l.material;l.rotation.y=r+.7,l.position.set(t,Pe+.01,a),l.renderOrder=7,l.scale.setScalar(o*.18);const d=p=>p<.34?1-Math.pow(1-p/.34,2.2):1;e.spawnTransient(i,n,p=>{i.scale.setScalar(o*U.lerp(.35,1,d(p))),c.opacity=.82*(1-Math.pow(p,1.5))}),e.spawnTransient(l,n*.86,p=>{l.scale.setScalar(o*U.lerp(.18,.62,d(p))),h.opacity=.9*(1-Math.pow(p,1.8))})}function Fc(e,t,a,o,n){const s=new b(en,v2()),r=s.material;s.position.set(t,a,o),s.scale.set(n,n*.55,n),e.spawnTransient(s,.19,i=>{const c=n*U.lerp(.9,1.7,i);s.scale.set(c,c*.5,c),r.opacity=.9*(1-i)*(1-i)})}function ys(e,t,a,o,n,s,r,i,c){const l=new b(A0(),w2()),h=l.material;h.opacity=1,l.position.set(t,a,o),l.scale.setScalar(i);const d=-9.4,p=6+Math.random()*6,u=Math.atan2(n,r)+(Math.random()-.5)*.8;e.spawnTransient(l,c,(f,m)=>{const g=a+s*m+.5*d*m*m;g<=Pe+.02?(l.position.set(t+n*m,Pe+.02,o+r*m),l.quaternion.identity(),l.rotation.set(0,u,0),l.scale.set(i,i*.55,i)):(l.position.set(t+n*m,g,o+r*m),ws(l,n,s+d*m,r),l.rotateZ(m*p)),h.opacity=1-Math.pow(f,3)})}function M2(e){const t=new ee,a=new b(Jo,Ci());a.material.color.set(e),a.scale.setScalar(He),a.position.z=He*.4,t.add(a);const o=new b(en,y2());o.scale.setScalar(He*.5),o.position.set(He*.25,He*.4,He*.85),t.add(o);for(let n=0;n<2;n++){const s=new b(Jo,Ci());s.material.color.set(e);const r=He*(.44-n*.13);s.scale.setScalar(r),s.position.set((Math.random()-.5)*He*.5,(Math.random()-.5)*He*.4,-He*(1.05+n*.95)),t.add(s)}return t.userData.__head=a,t}const S2={projectile(e){const t=M2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=(t.userData.__phase??Math.random()*6)+a*17;t.userData.__phase=o;const n=1+Math.sin(o)*.22;t.scale.set(1/Math.sqrt(n),1/Math.sqrt(n),n);const s=t.userData.__head;s&&(s.position.x=Math.sin(o*.55)*He*.3);const r=(t.userData.__drip??.04)-a;r<=0?(t.userData.__drip=.055+Math.random()*.045,sa(e,e.position.x-e.direction.x*He*1.6,e.position.y-He*.4,e.position.z-e.direction.z*He*1.6,-e.direction.x*.5+(Math.random()-.5)*.5,-.3-Math.random()*.4,-e.direction.z*.5+(Math.random()-.5)*.5,Ra*(.5+Math.random()*.4),.3)):t.userData.__drip=r;const i=(t.userData.__steam??.09)-a;i<=0?(t.userData.__steam=.13+Math.random()*.09,Ca(e,e.position.x,e.position.y+He,e.position.z,ne*.075,ne*.14,.34)):t.userData.__steam=i},impact(e){const{x:t,z:a}=e.position;Fc(e,t,e.position.y*.55,a,ne*.19),Ac(e,t,a,Ur,.38);for(let o=0;o<6;o++){const n=o/6*Math.PI*2+Math.random()*.6,s=1.5+Math.random()*1.4;sa(e,t+Math.cos(n)*Ur*.3,e.position.y*.5,a+Math.sin(n)*Ur*.3,Math.cos(n)*s,2.1+Math.random()*1.2,Math.sin(n)*s,Ra*(.7+Math.random()*.5),.34+Math.random()*.12,o%3===0)}Ca(e,t,Pe+ne*.05,a,ne*.14,ne*.3,.5)},cast(e){const t=e.direction,a=new b(Jo,gs()),o=a.material;a.position.copy(e.position),ws(a,t.x,-.25,t.z),e.spawnTransient(a,.16,n=>{a.position.set(e.position.x+t.x*n*ne*.2,e.position.y-n*ne*.07,e.position.z+t.z*n*ne*.2);const s=ne*(.05+n*.05);a.scale.set(s*1.5,s*.8,s*(1.6+n)),o.opacity=.95*(1-n*n)});for(let n=0;n<4;n++){const s=(Math.random()-.5)*.8,r=(Math.random()-.5)*.8;sa(e,e.position.x,e.position.y,e.position.z,t.x*(1.6+Math.random())+s,.7+Math.random()*.9,t.z*(1.6+Math.random())+r,Ra*(.5+Math.random()*.4),.3)}Ca(e,e.position.x,e.position.y,e.position.z,ne*.09,ne*.2,.34)}};function E2(e){const t=new ee,a=[];for(let n=0;n<3;n++){const s=new b(A0(),b2());s.material.color.set(e),s.scale.setScalar(zt*.62),s.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),s.position.set((Math.random()-.5)*zt*.22,(Math.random()-.5)*zt*.22,(Math.random()-.5)*zt*.22),t.add(s),a.push(s)}const o=new b(en,Ci());return o.scale.setScalar(He*.62),t.add(o),t.userData.__strands=a,t}const T2={projectile(e){const t=E2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=t.userData.__strands;if(o)for(let s=0;s<o.length;s++){const r=o[s];r.rotation.x+=a*(3.4+s*1.7),r.rotation.z+=a*(2.1+s*1.1)}const n=(t.userData.__drip??.06)-a;n<=0?(t.userData.__drip=.085+Math.random()*.06,sa(e,e.position.x,e.position.y-zt*.2,e.position.z,(Math.random()-.5)*.7,-.2-Math.random()*.5,(Math.random()-.5)*.7,Ra*(.45+Math.random()*.35),.32)):t.userData.__drip=n},impact(e){const{x:t,z:a}=e.position;Fc(e,t,e.position.y*.55,a,ne*.18),Ac(e,t,a,d2,.48);for(let o=0;o<5;o++){const n=o/5*Math.PI*2+Math.random()*.7,s=1.3+Math.random()*1.2;ys(e,t,e.position.y*.7,a,Math.cos(n)*s,1.5+Math.random()*1.1,Math.sin(n)*s,zt*(.7+Math.random()*.45),.7+Math.random()*.15)}for(let o=0;o<4;o++){const n=Math.random()*Math.PI*2,s=1.2+Math.random()*1.3;sa(e,t,e.position.y*.6,a,Math.cos(n)*s,1.8+Math.random()*1.1,Math.sin(n)*s,Ra*(.6+Math.random()*.5),.36,o===0)}Ca(e,t,Pe+ne*.05,a,ne*.15,ne*.32,.55)},cast(e){const t=e.direction;ys(e,e.position.x,e.position.y,e.position.z,t.x*1.4,1.5,t.z*1.4,zt*.7,.26);for(let a=0;a<3;a++)sa(e,e.position.x,e.position.y,e.position.z,t.x*1.2+(Math.random()-.5)*.8,.9+Math.random()*.7,t.z*1.2+(Math.random()-.5)*.8,Ra*.55,.28)}},A2={cast(e){const t=e.direction,a=Ke(e.weapon.range??Xa.meleeHeavy),o=e.position.x,n=e.position.y,s=e.position.z,r=-t.z,i=t.x;for(let d=0;d<13;d++){const p=(d/12-.5)*2,u=p*a*.16+(Math.random()-.5)*a*.06,f=1.1+Math.random()*1.5-Math.abs(p)*.35,m=ne*(.055+Math.random()*.055)*(1-Math.abs(p)*.25);sa(e,o+r*u,n+ne*(.05+Math.random()*.12),s+i*u,t.x*f+r*p*.35,.5+Math.random()*.7,t.z*f+i*p*.35,m,.42+Math.random()*.16,d%4===0)}for(let d=0;d<3;d++){const p=new b(en,d===1?gs():R0()),u=p.material,f=.35+d*.5,m=o+t.x*a*.1,g=s+t.z*a*.1,w=n+ne*.1;p.position.set(m,w,g),e.spawnTransient(p,.4,x=>{const k=x*x;p.position.set(m+t.x*f*a*.28*x,Math.max(Pe,w-k*ne*.8),g+t.z*f*a*.28*x),p.scale.set(ne*(.13+x*.1),ne*(.13-x*.09),ne*(.13+x*.1)),u.opacity=.85*(1-Math.pow(x,1.7))})}for(let d=0;d<3;d++){const p=(d-1)*.5;ys(e,o+r*p*a*.1,n,s+i*p*a*.1,t.x*(1.6+Math.random())+r*p,.9+Math.random()*.6,t.z*(1.6+Math.random())+i*p,zt*(.8+Math.random()*.4),.6)}const c=T0(),l=new b(c,F0()),h=l.material;l.position.set(o+t.x*a*.26,Pe,s+t.z*a*.26),l.rotation.y=Math.atan2(t.x,t.z),l.renderOrder=6,e.spawnTransient(l,.6,d=>{const p=d<.45?1-Math.pow(1-d/.45,2):1;l.scale.set(a*.13*p+.05,1,a*.3*p+.05),h.opacity=.8*(1-Math.pow(d,2.2))});for(let d=0;d<3;d++)Ca(e,o+t.x*a*(.12+d*.13),Pe+ne*.06,s+t.z*a*(.12+d*.13),ne*.16,ne*.42,.6)},impact(e){const{x:t,z:a}=e.position,o=new b(en,gs()),n=o.material;o.position.set(t,Pe,a),e.spawnTransient(o,.16,s=>{const r=1-Math.pow(1-s,2.6),i=ne*U.lerp(.42,.05,r),c=ne*U.lerp(.13,.4,r);o.position.set(t,Pe+i*.5,a),o.scale.set(c,i,c),n.opacity=.95*(1-Math.pow(s,2.5))}),Fc(e,t,e.position.y*.5,a,ne*.3),Ac(e,t,a,Wr,.62);for(let s=0;s<11;s++){const r=s/11*Math.PI*2+Math.random()*.5,i=2.2+Math.random()*2.2;sa(e,t+Math.cos(r)*ne*.12,Pe+ne*.1,a+Math.sin(r)*ne*.12,Math.cos(r)*i,2.6+Math.random()*1.8,Math.sin(r)*i,Ra*(.9+Math.random()*.8),.45+Math.random()*.15,s%3===0)}for(let s=0;s<4;s++){const r=s/4*Math.PI*2+Math.random(),i=1.5+Math.random()*1.3;ys(e,t,Pe+ne*.15,a,Math.cos(r)*i,2+Math.random()*1.2,Math.sin(r)*i,zt*(.85+Math.random()*.45),.85)}Ca(e,t,Pe+ne*.05,a,ne*.22,ne*.6,.8);for(let s=0;s<3;s++){const r=s/3*Math.PI*2+Math.random();Ca(e,t+Math.cos(r)*Wr*.55,Pe+ne*.03,a+Math.sin(r)*Wr*.55,ne*.14,ne*.4,.7)}}},F2={Splash:S2,Noodle:T2,Dump:A2},Ft=.09,R2=oe*.075,C2=oe*.1,Vh=Pi*.5,Rc=new zu(Ft,0);Rc.scale(.55,1.7,.55);const zi=new yt(Ft*.24,6,6);function Cc(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const C0=Cc(24,()=>new K({color:"#BFEFFF",transparent:!0,opacity:.8,depthWrite:!1})),z2=Cc(8,()=>new K({color:"#FFFFFF",transparent:!0,opacity:1,blending:et,depthWrite:!1})),Xh=Cc(6,()=>new K({color:"#EAFBFF",transparent:!0,opacity:.95,blending:et,depthWrite:!1}));function Kh(e){const t=new ee,a=4;for(let n=0;n<a;n++){const s=C0();s.color.set(e);const r=new b(Rc,s),i=n/a*Math.PI*2;r.position.set(Math.cos(i)*Ft*.5,(Math.random()-.5)*Ft*.6,Math.sin(i)*Ft*.5),r.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),r.scale.setScalar(.6+Math.random()*.5),t.add(r)}const o=new b(zi,z2());return t.add(o),t.userData.__glint=o,t}const I2={Glass:{projectile(e){const t=Kh(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=t.userData.__glint;let n=0;for(const s of t.children){if(s===o)continue;const r=2+n*.9;s.rotation.x+=a*r,s.rotation.y+=a*r*.75,n++}if(o){const s=o.material;s.opacity=Math.max(0,s.opacity-a*3.2);const r=(t.userData.__glintTimer??0)-a;r<=0?(t.userData.__glintTimer=.14+Math.random()*.3,s.opacity=1,o.position.set((Math.random()-.5)*Ft,(Math.random()-.5)*Ft,(Math.random()-.5)*Ft)):t.userData.__glintTimer=r}},impact(e){const t=e.position,a=C2/Ft,o=new b(zi,Xh());o.position.copy(t),o.scale.setScalar(1.25*a),e.spawnTransient(o,.14,r=>{o.scale.setScalar(U.lerp(1.25,3,r)*a),o.material.opacity=.95*(1-r)});const n=U.clamp(1+e.damage*.06,1,2.4),s=11;for(let r=0;r<s;r++){const i=r/s*Math.PI*2+Math.random()*.5,c=(1.6+Math.random()*2.4)*n,l=C0();l.color.set(e.color);const h=new b(Rc,l),d=(.42+Math.random()*.43)*a*n;h.scale.setScalar(d);const p=t.x+Math.cos(i)*Vh,u=t.y,f=t.z+Math.sin(i)*Vh;h.position.set(p,u,f);const m=1.1+Math.random()*1.6,g=-9,w=(Math.random()-.5)*22,y=(Math.random()-.5)*22;e.spawnTransient(h,.38+Math.random()*.2,(x,k)=>{h.position.set(p+Math.cos(i)*c*k,u+m*k+.5*g*k*k,f+Math.sin(i)*c*k),h.rotation.x=k*w,h.rotation.y=k*y,h.scale.setScalar(d*(1-x*.25)),h.material.opacity=.85*(1-x)})}},cast(e){const t=R2/Ft,a=Kh(e.color);a.position.copy(e.position),a.scale.setScalar(.35*t),e.spawnTransient(a,.16,n=>{const s=Math.min(1,n*2.2),r=n>.55?1-(n-.55)*2.2:1;a.scale.setScalar(U.clamp(.35+s*.75,.1,1.15)*t*Math.max(0,r)),a.rotation.y=n*5});const o=new b(zi,Xh());o.position.copy(e.position),o.scale.setScalar(.8*t),e.spawnTransient(o,.12,n=>{o.scale.setScalar(U.lerp(.8,1.9,n)*t),o.material.opacity=.9*(1-n)})}}},xo=Et.mustard,Mt="#9A6410",zc="#FFF2C0",Ic=Et.ketchup,_t="#6E121D",Ii="#FFC0AE",Qn=Et.bun,Yo="#7A4A1E",Li="#F9E9C2",X=oe,Za=Math.PI*2,bs=.28;function Bs(e,t=8){const a=new Bi(e,t);return a.rotateX(-Math.PI/2),a}function Lc(e,t,a,o){const n=Math.max(2,a*2),s=new ca,r=c=>c%2===0?-o:o,i=c=>-e/2+c/n*e;s.moveTo(r(0)-t,i(0));for(let c=1;c<=n;c++)s.lineTo(r(c)-t,i(c));for(let c=n;c>=0;c--)s.lineTo(r(c)+t,i(c));return s.closePath(),s}function L2(e,t){const a=new ca;return a.moveTo(0,e),a.quadraticCurveTo(t,e*.45,t,0),a.quadraticCurveTo(t,-e*.45,0,-e),a.quadraticCurveTo(-t,-e*.45,-t,0),a.quadraticCurveTo(-t,e*.45,0,e),a}const tn=X*.44,Oi=X*.065,O2=X*.072,$t=X*.26,Wa=X*.185,xs=Bs(Lc(tn,Oi,3,O2),1),vs=X*.78,z0=X*.075,I0=(z0+X*.098)*2,Xr=(()=>{const e=Bs(Lc(vs,z0,3,X*.098),1);return e.translate(0,0,vs/2),e})(),st=Bs(L2(.5,.5),6),_2=new Ts(X*.024,0),Zh=(()=>{const e=new ve(1,1,1,16,1,!0,0,Math.PI);return e.rotateZ(-Math.PI/2),e.rotateY(Math.PI/2),e})(),D2=(()=>{const e=new za(2,1);return e.rotateX(-Math.PI/2),e})(),$2=Bs(Lc(1,.14,4,.36),1);function fa(e,t){const a=Array.from({length:e},t);let o=0;return()=>a[o++%e]}const Ba=e=>new K({color:e,side:we}),N2=Ba(xo),Qh=Ba(Mt),P2=Ba(zc),H2=Ba(Ic),Jh=Ba(_t),q2=Ba(Ii),pn=(e,t)=>new K({color:e,transparent:!0,opacity:t,side:we,depthWrite:!1}),ks=fa(48,()=>pn(xo,1)),Ms=fa(48,()=>pn(Mt,1)),L0=fa(20,()=>pn(zc,1)),ed=fa(8,()=>new K({color:Qn,transparent:!0,opacity:1,side:we,depthWrite:!1})),td=fa(8,()=>new K({color:Yo,transparent:!0,opacity:1,side:we,depthWrite:!1})),ad=fa(8,()=>pn(Li,1)),od=fa(8,()=>pn(xo,1)),j2=fa(14,()=>new K({color:Yo,transparent:!0,opacity:1,depthWrite:!1}));function ot(e,t){return Math.atan2(e,t)}function nd(e){return e.range&&e.speed?e.range/e.speed:Da.normal/1e3}function Kr(e){return U.clamp(.85+e*.035,.85,1.4)}function sd(e){let t=e.userData.__hotdog;return t||(t={phase:Math.random()*Za,shed:0},e.userData.__hotdog=t),t}function Kt(e,t,a,o,n,s,r,i,c,l,h){const d=new ee,p=Ms();p.color.set(a),p.opacity=1;const u=new b(st,p);u.scale.set(1.34,1,1.14),u.position.y=-X*.008,d.add(u);const f=ks();f.color.set(t),f.opacity=1,d.add(new b(st,f)),d.renderOrder=9,d.position.set(o,n,s);const m=l*.45,g=-8.2;e.spawnTransient(d,h,(w,y)=>{const x=n+i*y+.5*g*y*y,k=x<=bs;if(d.position.set(o+r*y,k?bs:x,s+c*y),k)d.rotation.y=ot(r,c),d.scale.set(m*1.5,1,l*.75);else{const v=i+g*y,M=Math.hypot(r,v,c),L=1+Math.min(.85,M*.07);d.rotation.y=ot(r,c),d.scale.set(m/L,1,l*L)}const S=1-w*w;f.opacity=S,p.opacity=S})}function rd(e,t,a,o,n,s){const r=e.direction,i=Math.hypot(r.x,r.z)>1e-4,c=i?X*.36:0;Jn(e,t,a,e.position.x-r.x*c,e.position.y,e.position.z-r.z*c,i?ot(r.x,r.z)+Math.PI*.5:0,o,n,s,.45)}function Jn(e,t,a,o,n,s,r,i,c,l,h,d=1,p="#FFF6DC"){const u=i/vs,f=c/I0,m=new ee;m.rotation.y=r,m.position.set(o-Math.sin(r)*i*.5,n,s-Math.cos(r)*i*.5);const g=Ms();g.color.set(a),g.opacity=d;const w=new b(Xr,g);w.scale.set(1.42,1,1.02),w.position.y=-X*.009,m.add(w);const y=ks();y.color.set(t),y.opacity=d,m.add(new b(Xr,y));const x=L0();x.color.set(p),x.opacity=d;const k=new b(Xr,x);k.scale.set(.42,1,.985),k.position.y=X*.006,m.add(k),e.spawnTransient(m,l,S=>{const v=1-Math.pow(1-Math.min(1,S*5.5),3);m.scale.set(f,1,Math.max(.02,u*v));const M=S<h?1:1-(S-h)/(1-h);y.opacity=d*M,g.opacity=d*M,x.opacity=d*M})}function B2(e){const t=new ee,a=new b(xs,Qh);a.scale.set(1.5,1,1.07),a.position.y=-X*.012,t.add(a),t.add(new b(xs,e===xo?N2:O0(e)));const o=new b(st,Qh);o.scale.set(Oi*3.2,1,X*.15),o.position.set(0,-X*.012,tn*.46),t.add(o);const n=new b(st,P2);return n.scale.set(Oi*2.1,1,X*.105),n.position.set(0,0,tn*.47),t.add(n),t}function G2(e){const t=new ee,a=e===Ic?H2:O0(e),o=new b(st,Jh);o.scale.set(Wa*1.32,1,$t*1.12),o.position.y=-X*.012,t.add(o);const n=new b(st,a);n.scale.set(Wa,1,$t),t.add(n);const s=new b(st,q2);s.scale.set(Wa*.32,1,$t*.42),s.position.set(-Wa*.2,X*.004,$t*.16),t.add(s);const r=[];for(let c=0;c<3;c++){const l=new ee,h=1-c*.24,d=new b(st,Jh);d.scale.set(Wa*.72*h*1.34,1,$t*.42*h*1.14),d.position.y=-X*.012,l.add(d);const p=new b(st,a);p.scale.set(Wa*.72*h,1,$t*.42*h),l.add(p),l.position.z=-$t*(.7+c*.46),t.add(l),r.push(l)}const i={tail:r};return t.userData.__parts=i,t}const id=new Map;function O0(e){let t=id.get(e);return t||(t=Ba(e),id.set(e,t)),t}function Pn(e,t,a){const o=new ee,n=new b(Zh,a.crust);n.scale.set(e*1.13,e*1.13,t*1.04),n.position.y=-e*.04,o.add(n);const s=new b(Zh,a.bun);s.scale.set(e,e,t),o.add(s);const r=new b(D2,a.crumb);r.scale.set(e*.86,1,t*.92),r.position.y=-e*.34,o.add(r);const i=new b($2,a.seam);return i.scale.set(e*1.3,1,t*.84),i.position.y=-e*.3,o.add(i),o}const U2={Mustard:{projectile(e){const t=B2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=sd(t);o.phase+=a/nd(e.weapon)*Za*3.2,t.rotation.y=ot(e.direction.x,e.direction.z)+Math.sin(o.phase)*.16;const n=1+Math.sin(o.phase*1.7)*.13;t.scale.set(1/n,1,n),o.shed-=a,o.shed<=0&&(o.shed=.05+Math.random()*.03,Kt(e,e.color,Mt,e.position.x-e.direction.x*tn*.5,e.position.y,e.position.z-e.direction.z*tn*.5,-e.direction.x*(.6+Math.random()*.7)+(Math.random()-.5)*.9,.25+Math.random()*.45,-e.direction.z*(.6+Math.random()*.7)+(Math.random()-.5)*.9,X*(.12+Math.random()*.06),.26+Math.random()*.12))},impact(e){const t=Kr(e.damage),a=e.direction,o=ot(a.x,a.z)+Math.PI*.5;Jn(e,e.color,Mt,e.position.x,e.position.y,e.position.z,o,X*1.045*t,X*.3*t,.34,.5),rd(e,zc,Mt,X*.46*t,X*.2*t,.19);const{x:n,y:s,z:r}=e.position,i=X*.3*t;for(let c=0;c<8;c++){const l=c/8*Za+Math.random()*.6,h=(2.1+Math.random()*1.5)*t;Kt(e,e.color,Mt,n+Math.cos(l)*i,s,r+Math.sin(l)*i,Math.cos(l)*h+e.direction.x*.7,1.7+Math.random()*1.2,Math.sin(l)*h+e.direction.z*.7,X*(.14+Math.random()*.07)*t,.42+Math.random()*.14)}},cast(e){const t=e.direction,a=ot(t.x,t.z),o=new ee,n=Ms();n.color.set(Mt),n.opacity=1;const s=new b(xs,n);s.scale.set(1.5,1,1.08),s.position.y=-X*.012,o.add(s);const r=ks();r.color.set(e.color),r.opacity=1,o.add(new b(xs,r)),o.renderOrder=11,o.rotation.y=a;const i=e.position.x,c=e.position.z;e.spawnTransient(o,.16,l=>{const h=1-Math.pow(1-l,2);o.scale.set(.6+l*.3,1,.35+h*.85),o.position.set(i+t.x*h*X*.16,e.position.y,c+t.z*h*X*.16);const d=1-l;r.opacity=d,n.opacity=d});for(let l=0;l<4;l++)Kt(e,e.color,Mt,e.position.x,e.position.y,e.position.z,t.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,.4+Math.random()*.5,t.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,X*(.12+Math.random()*.05),.3)}},Ketchup:{projectile(e){const t=G2(e.color);return t.position.copy(e.position),t},trail(e){const t=e.object;if(!t)return;const a=e.dt??0,o=sd(t);o.phase+=a/nd(e.weapon)*Za*2.4,t.rotation.y=ot(e.direction.x,e.direction.z);const n=t.userData.__parts;if(n)for(let r=0;r<n.tail.length;r++){const i=n.tail[r],c=Math.sin(o.phase-(r+1)*.9);i.position.x=c*X*.055*(r+1)*.55,i.rotation.y=c*.4}const s=1+Math.sin(o.phase*1.3)*.09;t.scale.set(s,1,1/s),o.shed-=a,o.shed<=0&&(o.shed=.09+Math.random()*.05,Kt(e,e.color,_t,e.position.x-e.direction.x*$t*1.5,e.position.y,e.position.z-e.direction.z*$t*1.5,(Math.random()-.5)*.9,.1+Math.random()*.3,(Math.random()-.5)*.9,X*(.11+Math.random()*.05),.24+Math.random()*.1))},impact(e){const t=Kr(e.damage),a=e.direction;Jn(e,e.color,_t,e.position.x,e.position.y,e.position.z,ot(a.x,a.z)+Math.PI*.5,X*.78*t,X*.36*t,.3,.45),rd(e,Ii,_t,X*.4*t,X*.2*t,.18),Jn(e,e.color,_t,e.position.x+a.x*X*.5,bs,e.position.z+a.z*X*.5,ot(a.x,a.z),vs*t,I0*t,.8,.55,.95,Ii);const{x:o,y:n,z:s}=e.position,r=X*.29*t;for(let i=0;i<6;i++){const c=i/6*Za+Math.random()*.7,l=(1.8+Math.random()*1.3)*t;Kt(e,e.color,_t,o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*l+a.x*.6,1.5+Math.random()*1.1,Math.sin(c)*l+a.z*.6,X*(.14+Math.random()*.07)*t,.44+Math.random()*.14)}},cast(e){const t=e.direction;for(let r=0;r<5;r++)Kt(e,e.color,_t,e.position.x,e.position.y,e.position.z,t.x*(1+Math.random()*.9)+(Math.random()-.5)*.8,.3+Math.random()*.4,t.z*(1+Math.random()*.9)+(Math.random()-.5)*.8,X*(.13+Math.random()*.05),.3);const a=new ee,o=Ms();o.color.set(_t),o.opacity=1;const n=new b(st,o);n.scale.set(1.3,1,1.16),n.position.y=-X*.01,a.add(n);const s=ks();s.color.set(e.color),s.opacity=1,a.add(new b(st,s)),a.renderOrder=11,a.rotation.y=ot(t.x,t.z),a.position.copy(e.position),e.spawnTransient(a,.15,r=>{const i=U.lerp(X*.06,X*.24,1-Math.pow(1-r,2));a.scale.set(i*.55,1,i),a.position.set(e.position.x+t.x*r*X*.14,e.position.y,e.position.z+t.z*r*X*.14),s.opacity=1-r,o.opacity=1-r})}},Slash:{impact(e){const t=Kr(e.damage),a=e.direction,o=ot(a.x,a.z),{x:n,y:s,z:r}=e.position,i=X*.175*t,c=X*.62*t,l=X*.375*t,h=X*.125*t,d=new ee;d.rotation.y=o,d.position.set(n,s-X*.06,r),d.renderOrder=10;const p=ed();p.color.set(Qn),p.opacity=1;const u=ad();u.color.set(Li),u.opacity=1;const f=od();f.color.set(e.color),f.opacity=1;const m=td();m.color.set(Yo),m.opacity=1;const g={bun:p,crust:m,crumb:u,seam:f},w=Pn(i,c,g),y=Pn(i,c,g);d.add(w,y);const x=L0();x.color.set("#FFF6DA"),x.opacity=0;const k=new b(st,x);k.scale.set(X*.075,1,c*.92),k.position.y=i*.15,k.renderOrder=12,d.add(k);let S=!1;e.spawnTransient(d,.46,M=>{const L=Math.min(1,M/.35),A=1-Math.pow(1-L,3),F=M<=.35?A:A-(M-.35)/.65*.55,D=U.lerp(l,h,U.clamp(F,0,1));w.position.x=D,y.position.x=-D;const E=U.lerp(.55,.12,U.clamp(F,0,1));w.rotation.z=E,y.rotation.z=-E,x.opacity=M<.35?0:Math.max(0,1-(M-.35)/.2);const R=M<.6?1:1-(M-.6)/.4;if(p.opacity=R,m.opacity=R,u.opacity=R,f.opacity=R,!S&&M>=.35){S=!0;const q=-Math.sin(o),$=-Math.cos(o);for(let G=0;G<6;G++){const V=G%2===0?1:-1,H=G<4,Q=(Math.random()-.5)*.8;Kt(e,H?xo:Ic,H?Mt:_t,n+q*V*h*1.2,s,r+$*V*h*1.2,q*V*(2.4+Math.random()*1.6)+a.x*Q,1.6+Math.random()*1.3,$*V*(2.4+Math.random()*1.6)+a.z*Q,X*(.15+Math.random()*.07)*t,.4+Math.random()*.14)}}});const v=X*.24*t;for(let M=0;M<6;M++){const L=Math.random()*Za,A=(1.9+Math.random()*1.6)*t,F=j2();F.color.set(M%3===0?Qn:Yo),F.opacity=1;const D=new b(_2,F);D.renderOrder=9;const E=n+Math.cos(L)*v,R=r+Math.sin(L)*v,q=Math.cos(L)*A,$=Math.sin(L)*A,G=1.7+Math.random()*1.3,V=(.8+Math.random()*.7)*t;D.scale.setScalar(V);const H=Math.random()*9-4.5,Q=Math.random()*9-4.5;e.spawnTransient(D,.42+Math.random()*.14,(C,O)=>{D.position.set(E+q*O,Math.max(bs,s+G*O-4.6*O*O),R+$*O),D.rotation.set(H*O,Q*O,0),F.opacity=1-C*C})}},cast(e){const t=e.direction,a=ot(t.x,t.z),o=.62,n=X*.175*o,s=X*.62*o,r=new ee;r.rotation.y=a,r.position.copy(e.position),r.renderOrder=11;const i=ed();i.color.set(Qn),i.opacity=1;const c=ad();c.color.set(Li),c.opacity=1;const l=od();l.color.set(e.color),l.opacity=1;const h=td();h.color.set(Yo),h.opacity=1;const d={bun:i,crust:h,crumb:c,seam:l},p=Pn(n,s,d),u=Pn(n,s,d);r.add(p,u),e.spawnTransient(r,.2,f=>{const m=1-Math.pow(1-f,2),g=U.lerp(X*.06,X*.2,m);p.position.x=g,u.position.x=-g,p.rotation.z=m*.6,u.rotation.z=-m*.6;const w=1-f;i.opacity=w,h.opacity=w,c.opacity=w,l.opacity=w});for(let f=0;f<3;f++)Kt(e,xo,Mt,e.position.x,e.position.y,e.position.z,t.x*(1.2+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,t.z*(1.2+Math.random())+(Math.random()-.5)*.9,X*(.12+Math.random()*.05),.28)}}};function lt(e,t){const a={};for(const[o,n]of Object.entries(t))n&&(a[`${e}.${o}`]=n);return a}const W2={...lt("hamburger",j1),...lt("donut",fw),...lt("taco",zw),...lt("burrito",dy),...lt("egg",jy),...lt("lollipop",bb),...lt("pizza",qb),...lt("sushi",i2),...lt("soup",F2),...lt("waterbottle",I2),...lt("hotdog",U2)};function Hn(e,t){return W2[`${e}.${t}`]}function Zt(e){window.__vfxQaCounts??={cast:0,meleeArc:0,impact:0,death:0,heal:0,giantSlam:0,puddleSplash:0,coverScuff:0},window.__vfxQaCounts[e]++}const Po=.5,Gs=.3,Y2=Gs,V2=Gs+.01,va=1.15,cd=1.25,Ya=Gs+.02,qn=Gs+.04,X2=oe,ld=.85,hd=.68,K2=4,Z2=.7,Q2=.92,J2=7,e5=.55,dd=.6,pd=.32,Zr=new ia("#F2F6FF"),t5=new ia("#63A8E0"),a5=oe*.62,o5=oe*.66,n5=oe*.62,s5=.58,r5="#EAF4FF",i5="#1D2740",ud=18,qo=.8,Qr=3,fd={player:"#F5475E",enemy:"#F5C147"},c5="#EF5B2E",l5=.78,vt=new ia("#ffffff"),h5=new ia("#241a33"),md=new ia("#FFE79A");function Jr(e,t,a,o,n){const s=new Set;for(const r of a){s.add(r.id);let i=e.get(r.id);i||(i=o(r),t.add(i),e.set(r.id,i)),n(i,r)}for(const[r,i]of e)s.has(r)||(t.remove(i),e.delete(r))}function d5(e){return e.depthWrite=!1,e}const gd=e=>1-Math.pow(1-e,3);function wd(e){const t=Math.sin(e*12.9898)*43758.5453;return(t-Math.floor(t))*Math.PI*2}function ei(e,t){const a=Math.hypot(e,t);return a>1e-6?{x:e/a,y:t/a}:{x:0,y:0}}function p5(){const t=document.createElement("canvas");t.width=64,t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.4,"rgba(255,255,255,0.85)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new tt(t);return n.needsUpdate=!0,n}function u5(){const t=document.createElement("canvas");t.width=64,t.height=64;const a=t.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.62,"rgba(255,255,255,1)"),o.addColorStop(.82,"rgba(255,255,255,0.6)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new tt(t);return n.needsUpdate=!0,n}function f5(){const a=document.createElement("canvas");a.width=128,a.height=128;const o=a.getContext("2d"),n=o.createRadialGradient(64,64,0,64,64,128*.16);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.6,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,128);const s=8;for(let i=0;i<s;i++){const c=i%2===0,l=128*(c?.48:.26),h=128*(c?.045:.028),d=i/s*Math.PI*2;o.save(),o.translate(64,64),o.rotate(d);const p=o.createLinearGradient(0,0,l,0);p.addColorStop(0,"rgba(255,255,255,1)"),p.addColorStop(.7,"rgba(255,255,255,0.8)"),p.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=p,o.beginPath(),o.moveTo(0,-h),o.lineTo(l,0),o.lineTo(0,h),o.closePath(),o.fill(),o.restore()}const r=new tt(a);return r.needsUpdate=!0,r}function m5(){const a=document.createElement("canvas");a.width=128,a.height=32;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,128,0);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.5,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,32),o.globalCompositeOperation="destination-in";const s=o.createLinearGradient(0,0,0,32);s.addColorStop(0,"rgba(255,255,255,0)"),s.addColorStop(.5,"rgba(255,255,255,1)"),s.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=s,o.fillRect(0,0,128,32),o.globalCompositeOperation="source-over";const r=new tt(a);return r.needsUpdate=!0,r}function g5(){const a=document.createElement("canvas");a.width=8,a.height=64;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,0,64);n.addColorStop(0,"rgba(255,255,255,0.1)"),n.addColorStop(.55,"rgba(255,255,255,0.55)"),n.addColorStop(.86,"rgba(255,255,255,0.85)"),n.addColorStop(.94,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0.65)"),o.fillStyle=n,o.fillRect(0,0,8,64);const s=new tt(a);return s.flipY=!1,s.needsUpdate=!0,s}function w5(e){const o=document.createElement("canvas");o.width=128,o.height=128;const n=o.getContext("2d"),s=1.9*e,r=3.3*e+.7,i=p=>64*(qo+.13*Math.sin(p*3+s)+.06*Math.sin(p*5+r)),c=()=>{n.beginPath();const p=96;for(let u=0;u<=p;u++){const f=u/p*Math.PI*2,m=i(f),g=64+Math.cos(f)*m,w=64+Math.sin(f)*m;u===0?n.moveTo(g,w):n.lineTo(g,w)}n.closePath()};c();const l=n.createLinearGradient(128*.18,128*.12,128*.86,128*.92);l.addColorStop(0,"rgb(74,74,74)"),l.addColorStop(.5,"rgb(58,58,58)"),l.addColorStop(1,"rgb(44,44,44)"),n.fillStyle=l,n.fill(),n.save(),c(),n.clip(),n.lineWidth=128*.05,n.strokeStyle="rgb(96,96,96)",c(),n.stroke(),n.lineWidth=128*.028,n.strokeStyle="rgb(238,238,238)",c(),n.stroke();const h=(p,u,f,m)=>{n.beginPath(),n.arc(64+p*128,64+u*128,f*128,0,Math.PI*2),n.fillStyle=`rgb(${m},${m},${m})`,n.fill()};h(-.16+.05*e,.14,.11,92),h(.19,-.11+.06*e,.075,30),h(-.06,-.19,.055,128),n.restore();const d=new tt(o);return d.needsUpdate=!0,d}function y5(){const t=document.createElement("canvas");t.width=64,t.height=64;const a=t.getContext("2d"),o=[[.5,.02],[.78,.32],[.68,.98],[.32,.98],[.22,.32],[.5,.02]];a.beginPath(),o.forEach(([r,i],c)=>{const l=r*64,h=i*64;c===0?a.moveTo(l,h):a.lineTo(l,h)}),a.closePath();const n=a.createLinearGradient(64*.3,0,64*.6,64);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.45,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0.55)"),a.fillStyle=n,a.fill(),a.beginPath(),a.moveTo(64*.5,64*.05),a.lineTo(64*.62,64*.34),a.lineTo(64*.5,64*.5),a.lineTo(64*.4,64*.3),a.closePath(),a.fillStyle="rgba(255,255,255,0.9)",a.fill();const s=new tt(t);return s.needsUpdate=!0,s}function b5(e,t,a,o){const n=[],s=[],r=Math.PI*2/a,i=r*o,c=6;let l=0;for(let d=0;d<a;d++){const p=d*r;for(let u=0;u<=c;u++){const f=p+u/c*i;n.push(Math.sin(f)*e,0,Math.cos(f)*e),n.push(Math.sin(f)*t,0,Math.cos(f)*t)}for(let u=0;u<c;u++){const f=l+u*2;s.push(f,f+1,f+2,f+1,f+3,f+2)}l+=(c+1)*2}const h=new an;return h.setAttribute("position",new os(n,3)),h.setIndex(s),h.computeVertexNormals(),h}function yd(e,t){const a=U.degToRad(U.clamp(t,1,360))/2,o=Math.max(8,Math.round(t/8)),n=[0,0,0],s=[.5,0];for(let c=0;c<=o;c++){const l=-a+c/o*a*2;n.push(Math.sin(l)*e,0,Math.cos(l)*e),s.push(c/o,1)}const r=[];for(let c=1;c<o+1;c++)r.push(0,c,c+1);const i=new an;return i.setAttribute("position",new os(n,3)),i.setAttribute("uv",new os(s,2)),i.setIndex(r),i.computeVertexNormals(),i}function x5(e,t=8,a=.45){const o=t*2,n=[0,0,0];for(let i=0;i<=o;i++){const c=i/o*Math.PI*2,l=i%2===0?e:e*a;n.push(Math.sin(c)*l,0,Math.cos(c)*l)}const s=[];for(let i=1;i<o+1;i++)s.push(0,i,i+1);const r=new an;return r.setAttribute("position",new os(n,3)),r.setIndex(s),r.computeVertexNormals(),r}const v5=96,k5=10,M5=16;class S5{group=new ee;projectilePool=new Map;splatPool=new Map;trailPool=new Map;materialCache=new Map;transientEffects=[];lastSyncElapsedMs=0;projectileGeo=new yt(Ke(10),10,8);splatGeo=new za(2*Ke(hi)/qo,2*Ke(hi)/qo);trailGeo=new za(2*Ke(At.radius)/qo,2*Ke(At.radius)/qo);glazeTex=Array.from({length:Qr},(t,a)=>w5(a));splatMats=this.glazeTex.map(t=>this.groundMarkMat(c5,t));trailMats={player:this.glazeTex.map(t=>this.groundMarkMat(fd.player,t)),enemy:this.glazeTex.map(t=>this.groundMarkMat(fd.enemy,t))};groundMarkMat(t,a){const o=d5(Xc(t,{transparent:!0,opacity:l5}));return o.map=a,o.needsUpdate=!0,o}glowTex=p5();softDiscTex=u5();starTex=f5();streakTex=m5();shardTex=y5();wedgeGradientTex=g5();particles=[];wedges=[];rings=[];wedgeGeoCache=new Map;ringUnitGeo=new Aa(.62,1,40);wardGeo=b5(Z2,Q2,J2,e5);statusByRole;slowSplashState={player:{lastX:NaN,lastY:NaN,distAccum:0},enemy:{lastX:NaN,lastY:NaN,distAccum:0}};statusSnapshot={player:{x:NaN,y:NaN,stunReady:!0,slowReady:!0},enemy:{x:NaN,y:NaN,stunReady:!0,slowReady:!0}};constructor(t){this.group.name="vfx_layer",t.add(this.group);for(let o=0;o<v5;o++){const n=new qt({map:this.glowTex,color:16777215,transparent:!0,opacity:0,depthWrite:!1,blending:et}),s=new io(n);s.visible=!1,s.renderOrder=10,this.group.add(s),this.particles.push({sprite:s,mat:n,active:!1,life:0,maxLife:1,vx:0,vy:0,vz:0,gravity:0,startScale:1,endScale:1,startOpacity:1,endOpacity:0,fadeEase:1,aspect:1})}for(let o=0;o<k5;o++){const n=new K({color:16777215,map:this.wedgeGradientTex,transparent:!0,opacity:0,side:we,depthWrite:!1}),s=new b(yd(.01,10),n);s.visible=!1,s.renderOrder=5,this.group.add(s),this.wedges.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startOpacity:.6})}for(let o=0;o<M5;o++){const n=new K({color:16777215,transparent:!0,opacity:0,side:we,depthWrite:!1,blending:et}),s=new b(this.ringUnitGeo,n);s.rotation.x=-Math.PI/2,s.visible=!1,s.renderOrder=6,this.group.add(s),this.rings.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startScale:.1,targetScale:1,startOpacity:.9})}const a=()=>{const o=new K({color:i5,transparent:!0,opacity:0,side:we,depthWrite:!1}),n=new b(new Aa(.55,.95,28),o);n.rotation.x=-Math.PI/2,n.visible=!1,n.renderOrder=3,this.group.add(n);const s=new K({color:r5,transparent:!0,opacity:0,side:we,depthWrite:!1}),r=new b(new Aa(.64,.86,28),s);r.rotation.x=-Math.PI/2,r.visible=!1,r.renderOrder=4,this.group.add(r);const i=new qt({map:this.softDiscTex,color:t5,transparent:!0,opacity:0,depthTest:!1,depthWrite:!1}),c=new io(i);c.scale.set(a5,o5,1),c.visible=!1,c.renderOrder=8,this.group.add(c);const l=[];for(let p=0;p<K2;p++){const u=new qt({map:this.starTex,color:"#FFE75E",transparent:!0,opacity:0,depthWrite:!1,blending:et}),f=new io(u);f.scale.set(hd,hd,1),f.visible=!1,f.renderOrder=11,this.group.add(f),l.push(f)}const h=new K({color:Zr,transparent:!0,opacity:0,side:we,depthWrite:!1}),d=new b(this.wardGeo,h);return d.visible=!1,d.renderOrder=2,this.group.add(d),{slowRing:r,slowRingDark:n,slowTint:c,stunStars:l,wardRing:d,wardMat:h,wardPop:0,wardPopColor:new ia(Zr)}};this.statusByRole={player:a(),enemy:a()},window.__vfxSpawnTest=(o,n,s,r=14,i="#FFC93C",c,l)=>{const h=c??"hamburger",d=l?re[h]?.weapons?.find(p=>p.key===l):void 0;if(o==="impact")this.spawnImpactBurst(n,s,i,r,d?{weapon:d,characterId:h}:void 0);else if(o==="death")this.spawnDeathBurst(n,s,i);else if(o==="heal")this.spawnHealPulse(n,s);else if(o==="puddleSplash"){const p=Oe(n,s);this.spawnPuddleSplash(p.x,p.z)}else if(o==="meleeArc")this.spawnMeleeArc(n,s,{x:1,y:0},d?.range??70,d?.cone??80,d?.color??i);else if(o==="giantSlam")this.spawnGiantSlamShockwave(n,s,d?.color??i,d?.range??400);else if(o==="coverScuff")this.spawnCoverScuff(n,s,d?.color??i,1,0);else if(o==="weaponFired"){const p=d??{key:"qa",name:"qa",type:"ranged",range:100,damage:r,cooldown:1,color:i,effect:null};this.spawnWeaponCast(n,s,{x:1,y:0},p,h)}else{const p=d??{key:"qa",name:"qa",type:"ranged",range:100,damage:r,cooldown:1,color:i,effect:null};this.spawnCastFlash(n,s,{x:1,y:0},p,h)}},window.__vfxLayer=this}sync(t){window.__vfxDebugFighters={player:{x:t.player.x,y:t.player.y,hp:t.player.hp,alive:t.player.alive,terrainSlowFactor:t.player.terrainSlowFactor},enemy:{x:t.enemy.x,y:t.enemy.y,hp:t.enemy.hp,alive:t.enemy.alive,terrainSlowFactor:t.enemy.terrainSlowFactor}};const a=Math.max(0,(t.elapsed-this.lastSyncElapsedMs)/1e3);this.lastSyncElapsedMs=t.elapsed,Jr(this.projectilePool,this.group,t.projectiles,o=>{const n=t[o.ownerRole],s=Hn(n.characterId,o.weapon.key);if(s?.projectile){const i=Oe(o.x,o.y),c=ei(o.vx,o.vy),l={THREE:wn,position:new le(i.x,Po,i.z),direction:new le(c.x,0,c.y),color:o.color,damage:o.damage,weapon:o.weapon,characterId:n.characterId,spawnTransient:(d,p,u)=>this.spawnTransientObject(d,p,u)},h=s.projectile(l);return h.userData.weaponVfx=s,h}return new b(this.projectileGeo,this.materialFor(o.color))},(o,n)=>{const s=t[n.ownerRole],r=o.userData.weaponVfx,i=Oe(n.x,n.y);if(!r){const l=o;if(l.material=this.materialFor(n.color),n.arrived){const h=(n.peckTimer??0)/500,d=1+Math.sin(h*Math.PI)*.5;l.scale.setScalar(d)}else l.scale.setScalar(1);l.position.set(i.x,Po,i.z);return}o.position.set(i.x,Po,i.z);const c=ei(n.vx,n.vy);if((c.x!==0||c.y!==0)&&(o.rotation.y=Math.atan2(c.x,c.y)),r.trail){const l={THREE:wn,position:o.position.clone(),direction:new le(c.x,0,c.y),color:n.color,damage:n.damage,weapon:n.weapon,characterId:s.characterId,spawnTransient:(h,d,p)=>this.spawnTransientObject(h,d,p),object:o,dt:a};r.trail(l)}}),Jr(this.splatPool,this.group,t.splats,o=>{const n=new b(this.splatGeo,this.splatMats[o.id%Qr]);return n.rotation.set(-Math.PI/2,0,wd(o.id)),n},(o,n)=>{const s=Oe(n.x,n.y);o.position.set(s.x,Y2,s.z)}),Jr(this.trailPool,this.group,t.trailMarks,o=>{const n=new b(this.trailGeo,this.trailMats[o.ownerRole][o.id%Qr]);return n.rotation.set(-Math.PI/2,0,wd(o.id)),n},(o,n)=>{const s=Oe(n.x,n.y),r=(t.elapsed+n.id*137)*.004,i=1+Math.sin(r)*.08;o.position.set(s.x,V2,s.z),o.scale.setScalar(i)}),["player","enemy"].forEach(o=>{const n=t[o],s=this.statusByRole[o],r=Oe(n.x,n.y),i=n.alive&&n.terrainSlowFactor<1,c=n.alive&&t.elapsed<n.status.slowedUntil,l=i||c;if(s.slowRing.visible=l,s.slowRingDark.visible=l,s.slowTint.visible=l,l){const y=.9+Math.sin(t.elapsed*.0035)*.12,x=t.elapsed*.0012;s.slowRingDark.position.set(r.x,qn-.01,r.z),s.slowRingDark.scale.setScalar(y),s.slowRingDark.rotation.z=x,s.slowRingDark.material.opacity=.5,s.slowRing.position.set(r.x,qn,r.z),s.slowRing.scale.setScalar(y),s.slowRing.rotation.z=x,s.slowRing.material.opacity=.9,s.slowTint.position.set(r.x,n5,r.z);const k=s5+Math.sin(t.elapsed*.006)*.08;s.slowTint.material.opacity=k}const h=this.slowSplashState[o];if(i){if(Number.isFinite(h.lastX))for(h.distAccum+=Math.hypot(n.x-h.lastX,n.y-h.lastY);h.distAccum>=ud;)h.distAccum-=ud,this.spawnPuddleSplash(r.x,r.z)}else h.distAccum=0;h.lastX=n.x,h.lastY=n.y;const d=t.elapsed>=is(n,"stun"),p=t.elapsed>=is(n,"slow");this.statusSnapshot[o]={x:n.x,y:n.y,stunReady:d,slowReady:p};const u=n.alive&&!d&&t.elapsed>=n.status.stunnedUntil,f=n.alive&&!p&&t.elapsed>=n.status.slowedUntil,m=u||f,g=s.wardPop>0?s.wardPop/pd:0;s.wardRing.visible=m||g>0,s.wardRing.visible&&(s.wardRing.position.set(r.x,qn-.02,r.z),s.wardRing.rotation.y=-t.elapsed*.0019,s.wardRing.scale.setScalar(1+.5*g),s.wardMat.opacity=m?dd+(1-dd)*g:g,s.wardMat.color.copy(Zr).lerp(s.wardPopColor,g));const w=n.alive&&t.elapsed<n.status.stunnedUntil;s.stunStars.forEach((y,x)=>{if(y.visible=w,!w)return;const k=t.elapsed*.006+x*Math.PI*2/s.stunStars.length;y.position.set(r.x+Math.cos(k)*ld,X2+Math.sin(t.elapsed*.01+x)*.05,r.z+Math.sin(k)*ld),y.material.opacity=.95})})}updateEffects(t){for(const a of this.particles){if(!a.active)continue;if(a.life+=t,a.life>=a.maxLife){a.active=!1,a.sprite.visible=!1;continue}const o=a.life/a.maxLife;a.vy+=a.gravity*t,a.sprite.position.x+=a.vx*t,a.sprite.position.y+=a.vy*t,a.sprite.position.z+=a.vz*t;const n=U.lerp(a.startScale,a.endScale,gd(o));a.sprite.scale.set(n,n*a.aspect,1),a.mat.opacity=Math.max(0,U.lerp(a.startOpacity,a.endOpacity,Math.pow(o,a.fadeEase)))}for(const a of this.wedges){if(!a.active)continue;if(a.life+=t,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife;a.mat.opacity=a.startOpacity*(1-Math.pow(o,1.8))}for(const a of this.rings){if(!a.active)continue;if(a.life+=t,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife,n=U.lerp(a.startScale,a.targetScale,gd(o));a.mesh.scale.set(n,n,n),a.mat.opacity=a.startOpacity*(1-o)}for(const a of["player","enemy"]){const o=this.statusByRole[a];o.wardPop>0&&(o.wardPop=Math.max(0,o.wardPop-t))}for(let a=this.transientEffects.length-1;a>=0;a--){const o=this.transientEffects[a];if(o.life+=t,o.life>=o.maxLife){this.group.remove(o.object),this.transientEffects.splice(a,1);continue}o.onUpdate?.(o.life/o.maxLife,o.life)}}spawnTransientObject(t,a,o){this.group.add(t),this.transientEffects.push({object:t,life:0,maxLife:Math.max(.001,a),onUpdate:o})}spawnWeaponCast(t,a,o,n,s){const r=!!Hn(s,n.key)?.cast;this.spawnCastFlash(t,a,o,n,s),n.type==="melee"&&(n.giantSlam&&r||this.spawnMeleeArc(t,a,o,n.range??0,n.cone??360,n.color)),n.giantSlam&&this.spawnGiantSlamShockwave(t,a,n.color,n.range??0,{bespokeOwnsGround:r})}spawnCastFlash(t,a,o,n,s){Zt("cast");const r=Oe(t,a),i=Math.hypot(o.x,o.y)||1,c=o.x/i,l=o.y/i,h=.7,d=n.color,p=Hn(s,n.key)?.cast;if(this.castMuzzle(r.x+c*h,r.z+l*h,d,p?"subordinate":"primary"),!p)return;const u={THREE:wn,position:new le(r.x+c*h,cd,r.z+l*h),direction:new le(c,0,l),color:d,damage:n.damage,weapon:n,characterId:s,spawnTransient:(f,m,g)=>this.spawnTransientObject(f,m,g)};p(u)}castMuzzle(t,a,o,n){const s=n==="primary"?1:.75,r=this.allocParticle();r.active=!0,r.life=0,r.maxLife=n==="primary"?.16:.13,r.sprite.visible=!0,r.sprite.position.set(t,cd,a),r.vx=0,r.vy=0,r.vz=0,r.gravity=0,r.startScale=.75*s,r.endScale=1.3*s,r.startOpacity=1,r.endOpacity=0,r.fadeEase=1.6,r.mat.color.set(o).lerp(vt,.4)}spawnMeleeArc(t,a,o,n,s,r){Zt("meleeArc");const i=Oe(t,a),c=Ke(n),l=`${Math.round(s)}_${c.toFixed(3)}`;let h=this.wedgeGeoCache.get(l);h||(h=yd(c,s),this.wedgeGeoCache.set(l,h));const d=this.allocWedge();d.active=!0,d.life=0,d.maxLife=.3,d.startOpacity=.88,d.mesh.visible=!0,d.mesh.geometry=h,d.mesh.rotation.y=Math.atan2(o.x,o.y),d.mesh.position.set(i.x,Ya,i.z),d.mat.color.set(r).lerp(h5,.14),d.mat.opacity=d.startOpacity}spawnImpactStarDecal(t,a,o,n){const s=`star_${o.toFixed(3)}`;let r=this.wedgeGeoCache.get(s);r||(r=x5(o,8,.42),this.wedgeGeoCache.set(s,r));const i=this.allocWedge();i.active=!0,i.life=0,i.maxLife=n,i.startOpacity=.9,i.mesh.visible=!0,i.mesh.geometry=r,i.mesh.rotation.y=Math.random()*Math.PI*2,i.mesh.position.set(t.x,Ya+.03,t.z),i.mat.map=null,i.mat.needsUpdate=!0,i.mat.color.set(a).lerp(vt,.05),i.mat.opacity=i.startOpacity}spawnImpactBurst(t,a,o,n,s){Zt("impact");const r=Oe(t,a);(s?.weapon.effect==="stun"||s?.weapon.effect==="slow")&&this.flagStatusRefused(t,a,s.weapon.effect,s.weapon.color);const i=s&&Hn(s.characterId,s.weapon.key)?.impact;if(i&&s){let l=0,h=0;if(s.fromXWU!==void 0&&s.fromYWU!==void 0){const p=ei(t-s.fromXWU,a-s.fromYWU);l=p.x,h=p.y}const d={THREE:wn,position:new le(r.x,va,r.z),direction:new le(l,0,h),color:o,damage:n,weapon:s.weapon,characterId:s.characterId,spawnTransient:(p,u,f)=>this.spawnTransientObject(p,u,f)};i(d);return}const c=U.clamp(.42+n*.075,.42,2);this.burst(r,o,c,Math.round(U.clamp(1+n*.4,2,8)))}flagStatusRefused(t,a,o,n){for(const s of["player","enemy"]){const r=this.statusSnapshot[s];if(!Number.isFinite(r.x)||Math.hypot(r.x-t,r.y-a)>1)continue;if(o==="stun"?r.stunReady:r.slowReady)return;const c=this.statusByRole[s];c.wardPop=pd,c.wardPopColor.set(n).lerp(vt,.35);return}}spawnDeathBurst(t,a,o){Zt("death");const n=Oe(t,a);this.burst(n,o,2.6,9,{life:1.35})}spawnHealPulse(t,a){Zt("heal");const o=Oe(t,a),n=7;for(let s=0;s<n;s++){const r=this.allocParticle(),i=s/n*Math.PI*2+Math.random()*.5,c=.66+Math.random()*.3;r.active=!0,r.life=0,r.maxLife=.72+Math.random()*.22,r.sprite.visible=!0,r.sprite.position.set(o.x+Math.cos(i)*c,oe*.22,o.z+Math.sin(i)*c),r.vx=Math.cos(i)*.22,r.vz=Math.sin(i)*.22,r.vy=2+Math.random()*.45,r.gravity=-.45,r.startScale=.46+Math.random()*.14,r.endScale=.14,r.startOpacity=.95,r.endOpacity=0,r.fadeEase=1,r.mat.color.set("#6FE0A8")}}spawnPuddleSplash(t,a){Zt("puddleSplash");const o=5;for(let n=0;n<o;n++){const s=this.allocParticle(),r=n/o*Math.PI*2+Math.random()*1,i=Pi*(.58+Math.random()*.16);s.active=!0,s.life=0,s.maxLife=.3+Math.random()*.12,s.sprite.visible=!0,s.sprite.position.set(t+Math.cos(r)*i,qn,a+Math.sin(r)*i);const c=2.2+Math.random()*.6;s.vx=Math.cos(r)*c,s.vz=Math.sin(r)*c,s.vy=1.1+Math.random()*.5,s.gravity=-5.5,s.startScale=.58+Math.random()*.2,s.endScale=.12,s.startOpacity=1,s.endOpacity=0,s.fadeEase=1,s.mat.color.set("#E8F8FF")}}spawnCoverScuff(t,a,o,n,s){Zt("coverScuff");const r=Oe(t,a),i=Math.hypot(n,s),c=i>1e-4?-n/i:0,l=i>1e-4?-s/i:-1,h=this.allocParticle();h.active=!0,h.life=0,h.maxLife=.12,h.sprite.visible=!0,h.sprite.position.set(r.x,Po,r.z),h.vx=0,h.vy=0,h.vz=0,h.gravity=0,h.startScale=.42,h.endScale=.85,h.startOpacity=1,h.endOpacity=0,h.fadeEase=1.4,h.mat.color.set(o).lerp(vt,.6);for(let d=0;d<5;d++){const p=(Math.random()-.5)*(Math.PI*2/3),u=Math.cos(p),f=Math.sin(p),m=c*u-l*f,g=c*f+l*u,w=this.allocParticle();w.mat.map=this.streakTex,w.mat.rotation=Math.atan2(g,m),w.aspect=.22,w.active=!0,w.life=0,w.maxLife=.22+Math.random()*.1,w.sprite.visible=!0,w.sprite.position.set(r.x+c*.22,Po,r.z+l*.22),w.vx=m*(2.4+Math.random()*1.6),w.vz=g*(2.4+Math.random()*1.6),w.vy=.9+Math.random()*.7,w.gravity=-7.5,w.startScale=.62+Math.random()*.28,w.endScale=.12,w.startOpacity=1,w.endOpacity=0,w.fadeEase=1.2,w.mat.color.set(md)}}spawnGiantSlamShockwave(t,a,o,n,s){Zt("giantSlam");const r=Oe(t,a),i=Ke(n);if(!(s?.bespokeOwnsGround??!1)){const l=this.allocRing();l.active=!0,l.life=0,l.maxLife=.65,l.startScale=.3,l.targetScale=i*1.05,l.startOpacity=1,l.mesh.visible=!0,l.mesh.position.set(r.x,Ya+.02,r.z),l.mesh.scale.setScalar(l.startScale),l.mat.color.set(o).lerp(vt,.3),l.mat.opacity=l.startOpacity;const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=.8,h.startScale=.15,h.targetScale=i*.85,h.startOpacity=.6,h.mesh.visible=!0,h.mesh.position.set(r.x,Ya+.01,r.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(o),h.mat.opacity=h.startOpacity,this.spawnStarPop(r,va*1.5,o,5.2,.38);const d=this.allocParticle();d.active=!0,d.life=0,d.maxLife=.3,d.sprite.visible=!0,d.sprite.position.set(r.x,va*1.5,r.z),d.vx=0,d.vy=0,d.vz=0,d.gravity=0,d.startScale=1.8,d.endScale=3.5,d.startOpacity=.9,d.endOpacity=0,d.fadeEase=1.2,d.mat.color.set(o).lerp(vt,.4),this.spawnStreaks(r,va*.6,"#FFE79A",10,4.5,.55)}this.burst(r,o,3.2,14,{life:.9,speedMult:1.7,skipFlash:!0,skipRing:!0,skipStreaks:!0,skipDecal:!0})}burst(t,a,o,n,s){const r=s?.life??1,i=s?.speedMult??1;if(s?.skipDecal||this.spawnImpactStarDecal(t,a,U.clamp(.65*o,.55,1.5),(.55+o*.08)*r),!s?.skipFlash){const l=this.allocParticle();l.active=!0,l.life=0,l.maxLife=(.16+o*.04)*r,l.sprite.visible=!0,l.sprite.position.set(t.x,va,t.z),l.vx=0,l.vy=0,l.vz=0,l.gravity=0,l.startScale=.5*o,l.endScale=1.15*o,l.startOpacity=1,l.endOpacity=0,l.fadeEase=1.4,l.mat.color.set(a).lerp(vt,.3)}if(!s?.skipRing){const l=this.allocRing();l.active=!0,l.life=0,l.maxLife=(.24+o*.06)*r,l.startScale=.15,l.targetScale=.6*o+.35,l.startOpacity=.95,l.mesh.visible=!0,l.mesh.position.set(t.x,Ya,t.z),l.mesh.scale.setScalar(l.startScale),l.mat.color.set(a).lerp(vt,.25),l.mat.opacity=l.startOpacity;const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=(.32+o*.08)*r,h.startScale=.1,h.targetScale=(.6*o+.35)*1.35,h.startOpacity=.55,h.mesh.visible=!0,h.mesh.position.set(t.x,Ya-.01,t.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(a),h.mat.opacity=h.startOpacity}if(!s?.skipStreaks){const l=Math.max(4,Math.round(n*.7));this.spawnStreaks(t,va,"#FFE79A",l,(.5+o*.5)*i,.26*r)}const c=.4*o;for(let l=0;l<n;l++){const h=this.allocParticle();h.mat.map=this.shardTex;const d=Math.random()*Math.PI*2;h.mat.rotation=d,h.aspect=.4+Math.random()*.15;const p=(2.6+Math.random()*2.8)*(.6+o*.4)*i,u=.18+Math.random()*.24;h.active=!0,h.life=0,h.maxLife=(.36+Math.random()*.22+o*.06)*r,h.sprite.visible=!0,h.sprite.position.set(t.x+Math.cos(d)*u,va,t.z+Math.sin(d)*u),h.vx=Math.cos(d)*p,h.vz=Math.sin(d)*p,h.vy=1.3+Math.random()*1.8,h.gravity=-6.2,h.startScale=c*(.8+Math.random()*.5),h.endScale=c*.2,h.startOpacity=1,h.endOpacity=0,h.fadeEase=.85,h.mat.color.set(md)}}allocParticle(){let t=null;for(const o of this.particles)if(!o.active){t=o;break}if(!t){let o=-1/0;for(const n of this.particles){const s=n.life/n.maxLife;s>o&&(o=s,t=n)}}const a=t;return a.mat.map=this.glowTex,a.mat.rotation=0,a.aspect=1,a}spawnStarPop(t,a,o,n,s){const r=this.allocParticle();r.mat.map=this.starTex,r.active=!0,r.life=0,r.maxLife=s,r.sprite.visible=!0,r.sprite.position.set(t.x,a,t.z),r.vx=0,r.vy=0,r.vz=0,r.gravity=0,r.startScale=n*.5,r.endScale=n,r.startOpacity=1,r.endOpacity=0,r.fadeEase=1.7,r.mat.color.set(o).lerp(vt,.45)}spawnStreaks(t,a,o,n,s,r){for(let i=0;i<n;i++){const c=this.allocParticle();c.mat.map=this.streakTex,c.mat.rotation=Math.random()*Math.PI*2,c.aspect=.22,c.active=!0,c.life=0,c.maxLife=r*(.8+Math.random()*.4),c.sprite.visible=!0,c.sprite.position.set(t.x,a,t.z),c.vx=0,c.vy=0,c.vz=0,c.gravity=0,c.startScale=s*(.7+Math.random()*.3),c.endScale=s*1.35,c.startOpacity=.95,c.endOpacity=0,c.fadeEase=1.3,c.mat.color.set(o).lerp(vt,.3)}}allocWedge(){let t;for(const a of this.wedges)if(!a.active){t=a;break}return t||(t=this.wedges.reduce((a,o)=>a.life/a.maxLife>=o.life/o.maxLife?a:o)),t.mat.map!==this.wedgeGradientTex&&(t.mat.map=this.wedgeGradientTex,t.mat.needsUpdate=!0),t}allocRing(){for(const t of this.rings)if(!t.active)return t;return this.rings.reduce((t,a)=>t.life/t.maxLife>=a.life/a.maxLife?t:a)}clear(){for(const t of[this.projectilePool,this.splatPool,this.trailPool]){for(const a of t.values())this.group.remove(a);t.clear()}for(const t of this.particles)t.active=!1,t.sprite.visible=!1;for(const t of this.wedges)t.active=!1,t.mesh.visible=!1;for(const t of this.rings)t.active=!1,t.mesh.visible=!1;for(const t of this.transientEffects)this.group.remove(t.object);this.transientEffects.length=0,this.lastSyncElapsedMs=0;for(const t of["player","enemy"]){const a=this.statusByRole[t];a.slowRing.visible=!1,a.slowRingDark.visible=!1,a.slowTint.visible=!1,a.stunStars.forEach(n=>{n.visible=!1}),a.wardRing.visible=!1,a.wardPop=0,this.statusSnapshot[t]={x:NaN,y:NaN,stunReady:!0,slowReady:!0};const o=this.slowSplashState[t];o.lastX=NaN,o.lastY=NaN,o.distAccum=0}}dispose(){this.clear(),delete window.__vfxSpawnTest,window.__vfxLayer===this&&delete window.__vfxLayer,this.projectileGeo.dispose(),this.splatGeo.dispose(),this.trailGeo.dispose(),this.splatMats.forEach(t=>t.dispose()),Object.values(this.trailMats).forEach(t=>t.forEach(a=>a.dispose())),this.glazeTex.forEach(t=>t.dispose()),this.materialCache.forEach(t=>t.dispose()),this.materialCache.clear(),this.glowTex.dispose(),this.softDiscTex.dispose(),this.starTex.dispose(),this.streakTex.dispose(),this.shardTex.dispose(),this.wedgeGradientTex.dispose();for(const t of this.particles)t.mat.dispose();for(const t of this.wedges)t.mat.dispose();for(const t of this.rings)t.mat.dispose();this.wedgeGeoCache.forEach(t=>t.dispose()),this.wedgeGeoCache.clear(),this.ringUnitGeo.dispose(),this.wardGeo.dispose();for(const t of["player","enemy"]){const a=this.statusByRole[t];a.slowRing.material.dispose(),a.slowRing.geometry.dispose(),a.slowRingDark.material.dispose(),a.slowRingDark.geometry.dispose(),a.slowTint.material.dispose(),a.stunStars.forEach(o=>o.material.dispose()),a.wardMat.dispose()}}materialFor(t){let a=this.materialCache.get(t);return a||(a=Xc(t),this.materialCache.set(t,a)),a}}const bd="hud-styles";function E5(){if(document.getElementById(bd))return;const e=document.createElement("style");e.id=bd,e.textContent=F5,document.head.appendChild(e)}function xd(e){const t=Math.max(0,Math.ceil(e/1e3)),a=Math.floor(t/60),o=t%60;return`${a}:${String(o).padStart(2,"0")}`}function T5(e){const t=Math.max(0,Math.round(e/1e3)),a=Math.floor(t/60),o=t%60;return`${a}:${String(o).padStart(2,"0")}`}const jn=.25,vd=.14;function kd(e,t,a,o){const n=o>0?Math.max(0,Math.min(1,a/o)):0;e.style.width=`${(n*100).toFixed(1)}%`,t.textContent=`${Math.max(0,Math.ceil(a))} / ${o}`}function A5(e,t){E5(),ha(),e.innerHTML=`
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
  `;const a=N=>{const ae=e.querySelector(`[data-el="${N}"]`);if(!ae)throw new Error(`hud: missing element "${N}"`);return ae},o=a("player-name"),n=a("enemy-name"),s=a("player-emoji"),r=a("enemy-emoji"),i=a("player-bar"),c=a("enemy-bar"),l=a("player-fill"),h=a("enemy-fill"),d=a("player-hp"),p=a("enemy-hp"),u=a("timer"),f=a("weapons"),m=a("countdown"),g=a("gameover"),w=a("gameover-title"),y=a("gameover-subtitle"),x=a("gameover-stats"),k=a("gameover-btn"),S=a("topbar"),v=a("float-player"),M=a("float-enemy"),L=a("float-player-emoji"),A=a("float-enemy-emoji"),F=a("float-player-fill"),D=a("float-enemy-fill"),E=a("dmg-layer"),R=a("screenflash"),q=a("zone"),$=a("zone-label"),G=a("zone-value"),V=a("zone-bar"),H=a("radar"),Q=a("radar-safe"),C=a("radar-arena"),O=a("radar-player"),_=a("radar-enemy"),Y=a("radar-cap"),z=a("fogedge"),j=a("fogtick"),te=a("safearrow"),ie=a("safearrow-label"),$e=a("aim-stick"),rt=a("aim-reticle"),it=a("mute");let ma=0,Ga=null;function Ao(){const N=be.isMuted();if(N===Ga)return;const ae=Ga===null;if(Ga=N,window.clearTimeout(ma),N){it.innerHTML=I("mute")+"<span>MUTED · M</span>",it.classList.add("is-on"),it.classList.remove("is-ok");return}if(ae){it.classList.remove("is-on","is-ok");return}it.innerHTML=I("sound")+"<span>SOUND ON · M</span>",it.classList.add("is-on","is-ok"),ma=window.setTimeout(()=>it.classList.remove("is-on","is-ok"),1500)}const Fo=be.onChange(Ao);Ao();const un=24,Us=[];let Ws=0;for(let N=0;N<un;N++){const ae=document.createElement("div");ae.className="hud-dmg",E.appendChild(ae),Us.push(ae)}function j0(N,ae){const ke=N.replace("#",""),ce=ke.length===3?ke.split("").map(ze=>ze+ze).join(""):ke,pe=parseInt(ce.slice(0,2),16)||0,Ee=parseInt(ce.slice(2,4),16)||0,ue=parseInt(ce.slice(4,6),16)||0;return`rgba(${pe},${Ee},${ue},${ae})`}k.addEventListener("click",()=>t.onRestart());let Ys=null,_c=[];function B0(N){f.innerHTML="",_c=N.map((ae,ke)=>{const ce=document.createElement("div");return ce.className="hud-weapon-slot",ce.innerHTML=`
        <div class="hud-weapon-cooldown"></div>
        <div class="hud-weapon-emoji">${cp(ae.emoji)}</div>
        <div class="hud-weapon-timer" data-role="timer"></div>
        <div class="hud-weapon-key">${ke+1}</div>
      `,ce.addEventListener("pointerdown",pe=>{pe.preventDefault(),pe.stopPropagation(),t.onSelectWeapon?.(ke)}),f.appendChild(ce),{root:ce,cooldown:ce.querySelector(".hud-weapon-cooldown"),timer:ce.querySelector('[data-role="timer"]'),wasReady:!0}})}const G0=Math.round(Ld/Id*1e3);function U0(N){const ae=N/aa;return ae<=0?0:Math.min(12e3,Iu.radiusUnits/ae)}function W0(N){const ae=N.arena.maxSafeRadius,ke=Math.hypot(N.player.x-N.arena.center.x,N.player.y-N.arena.center.y),ce=ke>N.safeRadius,pe=ae/aa,Ee=ke<=Es;return{outside:ce,holds:Ee,radius01:ae>0?Math.max(0,Math.min(1,N.safeRadius/ae)):0,msUntilEdge:ce||Ee||pe<=0?null:(N.safeRadius-ke)/pe}}const Dc=56;let $c=0,Vs=-1,Nc=-1;function Xs(){if(window.innerWidth!==Vs||window.innerHeight!==Nc){Vs=window.innerWidth,Nc=window.innerHeight;const N=S.getBoundingClientRect().bottom;$c=N+36,E.style.setProperty("--fa-dmg-top",`${Math.max(0,Math.round(N+2))}px`)}return $c}let fn=0;function Y0(N,ae){const ke=N.phase==="playing",ce=W0(N),pe=ke&&ce.outside&&N.player.alive,Ee=N.arena.maxSafeRadius;q.classList.toggle("is-danger",pe),q.classList.toggle("is-imminent",!pe&&ce.msUntilEdge!==null&&ce.msUntilEdge<U0(Ee)),V.style.width=`${(ce.radius01*100).toFixed(1)}%`,pe?($.textContent="▲ OUTSIDE THE ZONE",G.textContent=`−${G0} HP/s`):($.textContent="ZONE CLOSES",G.textContent=ce.msUntilEdge!==null?`REACHES YOU ${xd(ce.msUntilEdge)}`:ce.holds?"FINAL RING":"CLOSING");const ue=N.arena.width,ze=N.arena.height,je=N.arena.center.x,We=N.arena.center.y,ga=ue/ze,Ua=Math.max(Ee,je,ue-je)*(1+vd),X0=Math.max(We,ze-We)*(1+vd),Ks=Math.max(2*Ua,2*X0*ga),Pc=Ks/ga,mn=Lt=>`${(50+(Lt-je)/Ks*100).toFixed(2)}%`,gn=Lt=>`${(50+(Lt-We)/Pc*100).toFixed(2)}%`,Hc=Lt=>`${(Lt/Ks*100).toFixed(2)}%`,qc=Lt=>`${(Lt/Pc*100).toFixed(2)}%`;Q.style.left=mn(je),Q.style.top=gn(We),Q.style.width=Hc(N.safeRadius*2),Q.style.height=qc(N.safeRadius*2),C.style.left=mn(ue/2),C.style.top=gn(ze/2),C.style.width=Hc(ue),C.style.height=qc(ze),O.style.left=mn(N.player.x),O.style.top=gn(N.player.y),O.style.display=N.player.alive?"block":"none",_.style.left=mn(N.enemy.x),_.style.top=gn(N.enemy.y),_.style.display=N.enemy.alive?"block":"none",H.classList.toggle("is-danger",pe),Y.textContent=pe?"GET INSIDE":"SAFE ZONE",z.classList.toggle("is-on",pe);const Vt=pe?ae.safeArrow??null:null;if(Vt){te.style.display="block",ie.style.display="block";const Lt=Vt.angleRad*180/Math.PI;te.style.transform=`translate(${Vt.at.x.toFixed(1)}px, ${Vt.at.y.toFixed(1)}px) rotate(${Lt.toFixed(1)}deg)`,(fn===0||window.innerWidth!==Vs)&&(fn=ie.offsetWidth/2);const jc=8,K0=Math.min(Math.max(Vt.at.x+Math.cos(Vt.angleRad)*178,fn+jc),window.innerWidth-fn-jc),Z0=Math.min(Math.max(Vt.at.y+Math.sin(Vt.angleRad)*178,Xs()+4),window.innerHeight-22);ie.style.transform=`translate(${K0.toFixed(1)}px, ${Z0.toFixed(1)}px) translate(-50%, -50%)`}else te.style.display="none",ie.style.display="none"}function V0(N){const ae=N.aim??null;if(!ae){$e.style.display="none",rt.style.display="none";return}const ke=ae.at.x-ae.from.x,ce=ae.at.y-ae.from.y,pe=Math.hypot(ke,ce),Ee=Math.atan2(ce,ke)*180/Math.PI;$e.style.display="block",$e.style.width=`${pe.toFixed(1)}px`,$e.style.transform=`translate(${ae.from.x.toFixed(1)}px, ${ae.from.y.toFixed(1)}px) rotate(${Ee.toFixed(1)}deg)`,rt.style.display="flex",rt.style.transform=`translate(${ae.at.x.toFixed(1)}px, ${ae.at.y.toFixed(1)}px) translate(-50%, -50%)`}return{setCharacters(N,ae){Ys=N,o.textContent=re[N].name,n.textContent=re[ae].name,s.innerHTML=Tt(N,{crop:"head"}),r.innerHTML=Tt(ae,{crop:"head"}),L.innerHTML=Tt(N,{crop:"head"}),A.innerHTML=Tt(ae,{crop:"head"}),B0(re[N].weapons),Xo(e,{generate:!1})},update(N,ae){kd(l,d,N.player.hp,N.player.maxHp),kd(h,p,N.enemy.hp,N.enemy.maxHp),u.textContent=xd(N.timeRemaining);const ke=N.player.maxHp>0?N.player.hp/N.player.maxHp:0,ce=N.enemy.maxHp>0?N.enemy.hp/N.enemy.maxHp:0;if(i.classList.toggle("is-low",N.player.alive&&ke<=jn),c.classList.toggle("is-low",N.enemy.alive&&ce<=jn),Ys){const pe=re[Ys].weapons,Ee=N.player.lastUsed;_c.forEach((ue,ze)=>{const je=pe[ze];if(!je)return;const We=Math.max(0,je.cooldown-(N.elapsed-Ee[ze])),ga=je.cooldown>0?Math.min(1,We/je.cooldown):0;ue.cooldown.style.setProperty("--p",ga.toFixed(3));const Ua=ga<=0;ue.root.classList.toggle("is-ready",Ua),ue.root.classList.toggle("is-selected",ze===ae.selectedWeapon),ue.timer.textContent=Ua?"":(We/1e3).toFixed(1),Ua&&!ue.wasReady&&(ue.root.classList.remove("is-flash"),ue.root.offsetWidth,ue.root.classList.add("is-flash")),ue.wasReady=Ua})}if(Y0(N,ae),V0(ae),N.phase==="countdown"){m.style.display="flex";const pe=N.countdownValue<=0;m.textContent=pe?"START!":String(N.countdownValue),m.classList.toggle("is-start",pe)}else m.style.display="none";if(N.phase==="ended"){g.style.display="flex";const pe=N.winner==="player";w.textContent=pe?"VICTORY!":"DEFEAT!",w.classList.toggle("is-win",pe),w.classList.toggle("is-lose",!pe);const Ee=N.winner??"player",ue=Ee==="player"?"enemy":"player",ze=re[N[Ee].characterId],je=re[N[ue].characterId],We=N.player.alive&&N.enemy.alive;y.innerHTML=`<span class="hud-go-emoji">${Tt(N[Ee].characterId,{crop:"head"})}</span>${ze.name}<span class="hud-go-vs">${We?"outlasted":"defeated"}</span><span class="hud-go-emoji">${Tt(N[ue].characterId,{crop:"head"})}</span>${je.name}`,Xo(y,{generate:!1});const ga=Math.max(0,aa-N.timeRemaining);x.innerHTML=We?`${I("timer")} Time up — no knockout`:`${I("timer")} Match time ${T5(ga)}`}else g.style.display="none"},updateFloatingBars(N,ae,ke,ce){const pe=Xs(),Ee=(ue,ze)=>{const je=Math.max(ze.y,pe),We=Math.min(Math.max(ze.x,Dc),window.innerWidth-Dc);ue.style.transform=`translate(${We.toFixed(1)}px, ${je.toFixed(1)}px) translate(-50%, -100%)`};if(N){v.style.display="flex",Ee(v,N);const ue=Math.max(0,Math.min(1,ke));F.style.width=`${(ue*100).toFixed(1)}%`,F.classList.toggle("is-low",ue>0&&ue<=jn)}else v.style.display="none";if(ae){M.style.display="flex",Ee(M,ae);const ue=Math.max(0,Math.min(1,ce));D.style.width=`${(ue*100).toFixed(1)}%`,D.classList.toggle("is-low",ue>0&&ue<=jn)}else M.style.display="none"},spawnDamageNumber(N,ae,ke){const ce=Us[Ws];Ws=(Ws+1)%Us.length;const pe=!!ke?.heal,Ee=ae>=15,ue=!Ee&&ae>=6,ze=Math.max(N.y,Xs()),je=Math.min(Math.max(N.x,24),window.innerWidth-24);ce.style.setProperty("--x",`${je.toFixed(1)}px`),ce.style.setProperty("--y",`${ze.toFixed(1)}px`),ce.textContent=pe?`+${Math.round(ae)}`:`-${Math.round(ae)}`;const We=pe?" hud-dmg--heal":ke?.fog?" hud-dmg--fog":"";ce.className=`hud-dmg ${Ee?"hud-dmg--big":ue?"hud-dmg--medium":"hud-dmg--small"}${We}`,ce.offsetWidth,ce.classList.add("is-playing")},flashScreen(N){R.style.setProperty("--flash-color",j0(N,.42)),R.classList.remove("is-playing"),R.offsetWidth,R.classList.add("is-playing")},flashFogTick(){j.classList.remove("is-playing"),j.offsetWidth,j.classList.add("is-playing")},dispose(){k.removeEventListener("click",()=>t.onRestart()),window.clearTimeout(ma),Fo(),e.innerHTML=""}}}const F5=`
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
`,R5=["countdown-tick","match-started","match-ended","weapon-fired","weapon-fired:giantSlam","projectile-spawned","projectile-destroyed:hit-target","projectile-destroyed:hit-cover","projectile-destroyed:expired","hit-landed:weapon","hit-landed:trail","hit-landed:hazard","hit-landed:fog","heal","death","splat-created","trail-mark-created"],C5="hamburger",z5="donut";function Md(e){const t=new URLSearchParams(location.search).get(e);return t&&Se.includes(t)?t:null}function Bn(e){const t=new URLSearchParams(location.search).get(e);if(t===null)return null;const a=Number(t);return Number.isFinite(a)?a:null}const I5=oe+.35;class ro{constructor(t){this.opts=t,this.playerId=t.playerCharacterId??Md("player")??C5,this.enemyId=t.enemyCharacterId??Md("enemy")??z5;const a=Ut(t.playerLevel??Bn("level")??ra);this.levels={player:a,enemy:of(a)};const o=Number(new URLSearchParams(location.search).get("simSpeed"));this.simSpeed=Number.isFinite(o)&&o>0?Math.min(50,o):1,this.stage=new Di({container:t.container,background:16764810,fog:{color:16764810,near:40,far:130},camera:{pitchDeg:58,yawDeg:0,frameMode:"fair"}}),this.stage.scene.add(this.arena.build()),this.fogRing=a1(this.arena.center),this.stage.scene.add(this.fogRing.root),this.vfx=new S5(this.stage.scene),this.hud=A5(t.hudRoot,{onRestart:()=>this.restart(),onSelectWeapon:n=>this.input.selectWeapon(n)}),this.hud.setCharacters(this.playerId,this.enemyId),this.input=new Wg(this.stage.canvas),this.input.setWeaponCount(re[this.playerId].weapons.length),this.pointerLock=I1({target:this.stage.canvas,pause:()=>this.pause(),resume:()=>this.resume(),onLockChange:n=>this.input.setPointerLocked(n)}),this.state=Yl(this.arena,this.playerId,this.enemyId,this.levels),this.playerModel=Qa(this.playerId),this.enemyModel=Qa(this.enemyId),this.spawnMatch(),window.__matchDebug=this.debug,window.__feelDebug=this.feel,window.__feelEvent=n=>this.handleEvents([n]),window.addEventListener("resize",this.handleResize),this.raf=requestAnimationFrame(this.loop)}stage;arena=Lu();vfx;audio=Xm();hud;input;pointerLock;fogRing;playerId;enemyId;levels;playerModel;enemyModel;state;clock=new Ou;raf=0;disposed=!1;readyFired=!1;isPaused=!1;lastPhase=null;raycaster=new _u;groundPlane=new Du(new le(0,1,0),0);rayHit=new le;projectVec=new le;projectileOrigins=new Map;simSpeed;qaFogRadius=Bn("fogRadius");qaPlayerX=Bn("px");qaPlayerY=Bn("py");debug={phase:"countdown",winner:null,paused:!1,moveX:0,moveY:0,attack:!1,facingX:0,facingY:0,selectedWeapon:0,pointerLocked:!1,qaSpawnInsideCover:null,frames:0};feel={events:Object.fromEntries(R5.map(t=>[t,0])),responses:{vfx:0,shake:0,hitStop:0,knockback:0,damageNumber:0,screenFlash:0},hitStopBudgetMs:0,hitStopBankedMs:0,lastHitStopMs:0,rawDtMs:0,stepDtMs:0,frames:0,frozenFrames:0,repayingFrames:0,peakHitAmount:0,peakShakeM:0};hitStopBudgetMs=0;hitStopBankedMs=0;static HITSTOP_TRICKLE=.05;static HITSTOP_CATCHUP_RATE=3;static SHAKE_MAX_M=.4;knockback={player:{x:0,z:0},enemy:{x:0,z:0}};restart(){this.spawnMatch(),this.resume()}get paused(){return this.isPaused}pause(){this.isPaused=!0,this.pointerLock.release(),this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.safeArrow(),aim:null})}resume(){this.isPaused=!1,this.pointerLock.engage()}resize(){this.stage.resize()}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),window.__matchDebug===this.debug&&delete window.__matchDebug,window.__feelDebug===this.feel&&delete window.__feelDebug,delete window.__feelEvent,window.removeEventListener("resize",this.handleResize),this.pointerLock.dispose(),this.input.dispose(),this.hud.dispose(),this.vfx.dispose(),this.fogRing.dispose(),this.playerModel.dispose(),this.enemyModel.dispose(),this.stage.dispose()}spawnMatch(){this.state=Yl(this.arena,this.playerId,this.enemyId,this.levels),this.applyQaSetup(),this.stage.scene.remove(this.playerModel.root,this.enemyModel.root),this.playerModel.dispose(),this.enemyModel.dispose(),this.playerModel=Qa(this.playerId),this.enemyModel=Qa(this.enemyId),this.stage.scene.add(this.playerModel.root,this.enemyModel.root),this.syncModelTransform(this.playerModel,this.state.player),this.syncModelTransform(this.enemyModel,this.state.enemy),this.playerModel.play("idle"),this.enemyModel.play("idle"),this.vfx.clear(),this.audio.reset(),this.input.reset(),this.projectileOrigins.clear(),this.hitStopBudgetMs=0,this.hitStopBankedMs=0;for(const a of Object.keys(this.feel.events))this.feel.events[a]=0;this.feel.responses.vfx=0,this.feel.responses.shake=0,this.feel.responses.hitStop=0,this.feel.responses.knockback=0,this.feel.responses.damageNumber=0,this.feel.responses.screenFlash=0,this.feel.frames=0,this.feel.frozenFrames=0,this.feel.repayingFrames=0,this.feel.peakHitAmount=0,this.feel.peakShakeM=0,this.feel.lastHitStopMs=0,this.knockback.player.x=0,this.knockback.player.z=0,this.knockback.enemy.x=0,this.knockback.enemy.z=0;const t=Oe(this.state.player.x,this.state.player.y);this.stage.rig.snapTo(t.x,t.z),this.stage.lighting.focus(t.x,t.z),this.fogRing.update(this.state.safeRadius,this.state.elapsed/1e3,this.state.phase==="playing",this.stage.rig),this.lastPhase=null,this.notifyPhase()}applyQaSetup(){if(this.qaPlayerX!==null&&(this.state.player.x=this.qaPlayerX),this.qaPlayerY!==null&&(this.state.player.y=this.qaPlayerY),(this.qaPlayerX!==null||this.qaPlayerY!==null)&&this.checkQaSpawn(),this.qaFogRadius===null)return;const t=this.arena.maxSafeRadius,a=U.clamp(this.qaFogRadius,Es,t),o=U.clamp(a/t,0,1);this.state.phase="playing",this.state.countdownValue=0,this.state.countdownTick=0,this.state.startFlashTimer=0,this.state.timeRemaining=aa*o,this.state.safeRadius=a}checkQaSpawn(){const t=this.state.player,a=this.arena.cover.find(o=>ac(t.x,t.y,t.size,t.size,o.x,o.y,o.w,o.h));this.debug.qaSpawnInsideCover=a?`${a.kind??"cover"} @(${a.x},${a.y}) ${a.w}x${a.h}`:null,a&&console.warn(`[QA] ?px=${t.x}&py=${t.y} places the player INSIDE cover "${a.kind??"cover"}" @(${a.x},${a.y}) ${a.w}x${a.h}. There is no depenetration in movement.ts, so the fighter cannot move at all — input is fine, the sim is refusing every step. Pick a point at least ${((t.size+Math.max(a.w,a.h))/2).toFixed(0)} wu from that centre.`)}aimCursor(){const t=this.input.aimOffsetPx;if(!t)return null;const a=this.projectPointToScreen(this.state.player.x,this.state.player.y,0);return a?{from:a,at:{x:a.x+t.x,y:a.y+t.y}}:null}buildInput(){const t=this.state.phase==="playing",a=t?this.input.moveAxes():{x:0,y:0};let o;if(t){const s=this.aimCursor();let r=this.input.mouseNdc;if(s){const i=this.stage.canvas.getBoundingClientRect();r={x:(s.at.x-i.left)/i.width*2-1,y:-((s.at.y-i.top)/i.height*2-1)}}if(r){this.raycaster.setFromCamera(new $u(r.x,r.y),this.stage.rig.camera);const i=this.raycaster.ray.intersectPlane(this.groundPlane,this.rayHit);i&&(o={x:Kc(i.x)-this.state.player.x,y:Kc(i.z)-this.state.player.y})}}const n=t&&this.input.attackHeld;return{move:a,aim:o,selectedWeapon:this.input.selectedWeapon,attack:n}}syncModelTransform(t,a){const o=Oe(a.x,a.y);t.root.position.set(o.x,0,o.z),t.root.rotation.y=Math.atan2(a.facing.x,a.facing.y)}colorForDamageSource(t,a){switch(a.kind){case"weapon":{const o=this.state[oa(t)];return re[o.characterId].weapons.find(s=>s.key===a.weaponKey)?.color??"#FFFFFF"}case"trail":return a.ownerRole==="player"?"#FF9EC4":"#FFD27A";case"hazard":return"#FF7A3D";case"fog":return"#B98CE6";default:return"#FFFFFF"}}triggerHitStop(t){this.hitStopBudgetMs=Math.max(this.hitStopBudgetMs,t),this.feel.responses.hitStop++,this.feel.lastHitStopMs=t}kick(t,a){const o=Math.min(t,ro.SHAKE_MAX_M);this.stage.rig.shake(o,a),this.feel.responses.shake++,o>this.feel.peakShakeM&&(this.feel.peakShakeM=o)}applyKnockback(t,a,o,n){const s=this.state[t],r=s.x-a,i=s.y-o,c=Math.hypot(r,i);if(c<1e-4)return;const l=U.clamp(n,0,.22),h=this.knockback[t];h.x+=r/c*l,h.z+=i/c*l,this.feel.responses.knockback++}handleEvents(t){const a={};for(const o of t){const n=o.type==="hit-landed"?`hit-landed:${o.source.kind}`:o.type==="projectile-destroyed"?`projectile-destroyed:${o.reason}`:o.type;switch(n in this.feel.events&&this.feel.events[n]++,o.type){case"weapon-fired":{const s=o.fighterRole==="player"?this.playerModel:this.enemyModel,r=this.state[o.fighterRole],i=re[r.characterId].weapons,c=i.findIndex(h=>h.key===o.weaponKey),l=i[c<0?0:c];s.play("attack",{weaponIndex:c<0?0:c}),l&&(this.vfx.spawnWeaponCast(r.x,r.y,r.facing,l,r.characterId),this.feel.responses.vfx++,l.giantSlam&&(this.feel.events["weapon-fired:giantSlam"]++,this.hud.flashScreen(l.color),this.feel.responses.screenFlash++,this.kick(.55,2.6),this.triggerHitStop(120),window.__vfxDebugGiantSlamCount=(window.__vfxDebugGiantSlamCount??0)+1));break}case"hit-landed":{(o.targetRole==="player"?this.playerModel:this.enemyModel).play("hit",{intensity:U.clamp(o.amount/12,.25,1)});const r=this.colorForDamageSource(o.targetRole,o.source);if(a[o.targetRole]=r,o.source.kind==="fog"){const p=this.projectPointToScreen(o.x,o.y,1.3);p&&(this.hud.spawnDamageNumber(p,o.amount,{fog:!0}),this.feel.responses.damageNumber++),o.targetRole==="player"&&(this.hud.flashFogTick(),this.feel.responses.screenFlash++);break}let i;if(o.source.kind==="weapon"){const p=this.state[oa(o.targetRole)],u=o.source.weaponKey,f=re[p.characterId].weapons.find(m=>m.key===u);f&&(i={weapon:f,characterId:p.characterId,fromXWU:p.x,fromYWU:p.y})}this.vfx.spawnImpactBurst(o.x,o.y,r,o.amount,i),this.feel.responses.vfx++,o.amount>this.feel.peakHitAmount&&(this.feel.peakHitAmount=o.amount);const c=this.projectPointToScreen(o.x,o.y,1.3);c&&(this.hud.spawnDamageNumber(c,o.amount),this.feel.responses.damageNumber++);const l=o.source.kind==="weapon",h=U.clamp(.012+o.amount*.0175,.012,ro.SHAKE_MAX_M),d=o.targetRole==="player"?1.25:1;if(this.kick(h*d*(l?1:.45)),l&&this.triggerHitStop(U.clamp(10+o.amount*4.6,16,105)),o.source.kind==="weapon"){const p=this.state[oa(o.targetRole)];this.applyKnockback(o.targetRole,p.x,p.y,.05+o.amount*.006)}else if(o.source.kind==="trail"){const p=this.state[o.source.ownerRole];this.applyKnockback(o.targetRole,p.x,p.y,.03)}break}case"projectile-spawned":{this.projectileOrigins.set(o.id,{color:o.color,x:o.x,y:o.y});break}case"projectile-destroyed":{const s=this.projectileOrigins.get(o.id);if(this.projectileOrigins.delete(o.id),o.reason!=="hit-cover")break;this.vfx.spawnCoverScuff(o.x,o.y,s?.color??"#FFFFFF",s?o.x-s.x:0,s?o.y-s.y:0);break}case"heal":{const s=this.state[o.fighterRole];this.vfx.spawnHealPulse(s.x,s.y),this.feel.responses.vfx++;const r=this.projectPointToScreen(s.x,s.y,1.6);r&&(this.hud.spawnDamageNumber(r,o.amount,{heal:!0}),this.feel.responses.damageNumber++);break}case"death":{(o.fighterRole==="player"?this.playerModel:this.enemyModel).play("death");const r=this.state[o.fighterRole],i=a[o.fighterRole]??"#FFFFFF";this.vfx.spawnDeathBurst(r.x,r.y,i),this.feel.responses.vfx++,this.kick(.42,3),this.triggerHitStop(90);break}}}}projectToScreen(t,a){if(!a||(this.projectVec.set(t.root.position.x,I5,t.root.position.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1))return null;const o=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*o.width+o.left,y:(1-(this.projectVec.y*.5+.5))*o.height+o.top}}projectPointToScreen(t,a,o){const n=Oe(t,a);if(this.projectVec.set(n.x,o,n.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1)return null;const s=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*s.width+s.left,y:(1-(this.projectVec.y*.5+.5))*s.height+s.top}}safeArrow(){const t=this.state.player,a=this.arena.center.x-t.x,o=this.arena.center.y-t.y,n=Math.hypot(a,o);if(n<.001)return null;const s=this.projectPointToScreen(t.x,t.y,.35),r=this.projectPointToScreen(t.x+a/n*80,t.y+o/n*80,.35);if(!s||!r)return null;const i=r.x-s.x,c=r.y-s.y;return Math.hypot(i,c)<1?null:{at:s,angleRad:Math.atan2(c,i)}}notifyPhase(){this.state.phase!==this.lastPhase&&(this.lastPhase=this.state.phase,this.pointerLock.setMatchActive(this.state.phase!=="ended"),this.opts.onPhase?.(this.state.phase,this.state.winner))}handleResize=()=>this.resize();publishDebug(t,a,o){const n=this.debug;n.phase=this.state.phase,n.winner=this.state.winner,n.paused=this.isPaused,n.moveX=t,n.moveY=a,n.attack=o,n.facingX=this.state.player.facing.x,n.facingY=this.state.player.facing.y,n.selectedWeapon=this.input.selectedWeapon,n.pointerLocked=this.input.pointerLocked,n.frames++}decayKnockback(t){const a=Math.exp(-t*14);for(const o of["player","enemy"]){const n=this.knockback[o];n.x*=a,n.z*=a,Math.abs(n.x)<1e-4&&(n.x=0),Math.abs(n.z)<1e-4&&(n.z=0)}}loop=()=>{if(this.disposed)return;const t=Math.min(this.clock.getDelta(),1/20)*this.simSpeed,a=t*1e3;if(this.isPaused){this.publishDebug(0,0,!1),this.stage.render(0),this.raf=requestAnimationFrame(this.loop);return}let o;if(this.hitStopBudgetMs>0)this.hitStopBudgetMs=Math.max(0,this.hitStopBudgetMs-a),o=a*ro.HITSTOP_TRICKLE,this.hitStopBankedMs+=a-o;else if(this.hitStopBankedMs>0){const u=Math.min(this.hitStopBankedMs,a*ro.HITSTOP_CATCHUP_RATE);this.hitStopBankedMs-=u,o=a+u}else o=a;const n=o/1e3;this.feel.rawDtMs=a,this.feel.stepDtMs=o,this.feel.hitStopBudgetMs=this.hitStopBudgetMs,this.feel.hitStopBankedMs=this.hitStopBankedMs,this.feel.frames++,o<a*.5?this.feel.frozenFrames++:o>a*1.05&&this.feel.repayingFrames++;const s={x:this.state.player.x,y:this.state.player.y},r={x:this.state.enemy.x,y:this.state.enemy.y},i=this.buildInput(),c=k1(this.state,o,i);this.handleEvents(c),this.audio.handleEvents(c,this.state),this.notifyPhase(),this.publishDebug(i.move.x,i.move.y,i.attack===!0);const l=this.state.player.x!==s.x||this.state.player.y!==s.y,h=this.state.enemy.x!==r.x||this.state.enemy.y!==r.y;this.syncModelTransform(this.playerModel,this.state.player),this.syncModelTransform(this.enemyModel,this.state.enemy),this.playerModel.root.position.x+=this.knockback.player.x,this.playerModel.root.position.z+=this.knockback.player.z,this.enemyModel.root.position.x+=this.knockback.enemy.x,this.enemyModel.root.position.z+=this.knockback.enemy.z,this.decayKnockback(t),this.state.player.alive&&this.playerModel.play(l?"run":"idle"),this.state.enemy.alive&&this.enemyModel.play(h?"run":"idle");const d=this.state.elapsed/1e3;this.playerModel.update({dt:n,elapsed:d,moveSpeed01:this.state.player.alive&&l?1:0,health01:this.state.player.hp/this.state.player.maxHp}),this.enemyModel.update({dt:n,elapsed:d,moveSpeed01:this.state.enemy.alive&&h?1:0,health01:this.state.enemy.hp/this.state.enemy.maxHp}),this.arena.update?.(n,d),this.vfx.sync(this.state),this.vfx.updateEffects(t),this.fogRing.update(this.state.safeRadius,this.clock.elapsedTime,this.state.phase==="playing",this.stage.rig);const p=Oe(this.state.player.x,this.state.player.y);this.stage.rig.follow(p.x,p.z),this.stage.lighting.focus(p.x,p.z),window.__vfxDebugScreen={player:this.projectPointToScreen(this.state.player.x,this.state.player.y,0),enemy:this.projectPointToScreen(this.state.enemy.x,this.state.enemy.y,0)},this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.safeArrow(),aim:this.aimCursor()}),this.hud.updateFloatingBars(this.projectToScreen(this.playerModel,this.state.player.alive),this.projectToScreen(this.enemyModel,this.state.enemy.alive),this.state.player.hp/this.state.player.maxHp,this.state.enemy.hp/this.state.enemy.maxHp),this.stage.render(t),this.readyFired||(this.readyFired=!0,window.__gameReady=!0,window.__previewReady=!0),this.raf=requestAnimationFrame(this.loop)}}function L5(e){return new ro(e)}const Oc="Escape";function O5(e,t){if(t.name!=="match")throw new Error("createMatchScreen: wrong route");la("fa-match-styles",_5),ha();const a=Ae("div","fa-screen-bare fa-match");a.innerHTML=`
    <!-- The chip is NOT inside .match-corner. It has to be positioned against the
         screen so it can sit clear of the thumb zone, and .match-corner is itself
         absolutely positioned — so nesting it there made 'top: 96px' resolve against
         the corner and put the chip 140px BELOW the bottom of the frame. Measured,
         not reasoned about: tools/tmp/thumbzone.mjs. -->
    <button class="match-chip" type="button" data-el="pause" aria-label="Pause">${I("pause")}</button>

    <div class="match-corner">
      <button class="fa-btn fa-btn--quiet match-exit" type="button" data-el="exit">${I("back")} Menu</button>
    </div>

    <div class="match-sheet" data-el="sheet">
      <div class="match-sheet-card">
        <p class="match-sheet-title">Paused</p>
        <button class="fa-btn fa-btn--primary" type="button" data-el="resume">${I("play")} Resume</button>
        <button class="fa-btn fa-btn--quiet" type="button" data-el="change">${I("swap")} Change Fighter</button>
        <button class="fa-btn fa-btn--quiet" type="button" data-el="quit">${I("home")} Quit to Home</button>
      </div>
    </div>
  `;const o=d=>{const p=a.querySelector(`[data-el="${d}"]`);if(!p)throw new Error(`matchScreen: missing element "${d}"`);return p},n=o("sheet"),s=o("pause"),r=o("exit");let i=!1;const c=L5({container:e.gameHost,hudRoot:e.hudRoot,playerCharacterId:t.player,enemyCharacterId:t.enemy,playerLevel:e.profile.characterLevel(t.player),onPhase(d,p){d==="ended"?(i||(i=!0,e.profile.recordResult(p==="player")),a.classList.add("is-ended")):(i=!1,a.classList.remove("is-ended"))}});function l(d){d?c.pause():c.resume(),n.classList.toggle("is-open",d),s.innerHTML=I(d?"play":"pause")}s.addEventListener("click",()=>l(!c.paused)),o("resume").addEventListener("click",()=>l(!1)),o("change").addEventListener("click",()=>e.navigate({name:"characters"})),o("quit").addEventListener("click",()=>e.navigate({name:"home"})),r.addEventListener("click",()=>e.navigate({name:"home"}));const h=d=>{d.key===Oc&&(d.preventDefault(),l(!c.paused))};return window.addEventListener("keydown",h),r.title=`${re[t.player].name} vs ${re[t.enemy].name}`,{root:a,resize(){c.resize()},dispose(){window.removeEventListener("keydown",h),c.dispose(),a.remove()}}}const _5=`
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
`,_0="food-arena.settings.v1",D5="fa-reduce-motion";function D0(){try{const e=localStorage.getItem(_0),t=e?JSON.parse(e):{};return{reduceMotion:t.reduceMotion===!0,moveKeys:N5(t.moveKeys)}}catch{return{reduceMotion:!1,moveKeys:{}}}}function ti(e){try{localStorage.setItem(_0,JSON.stringify(e))}catch{}}function $0(){const e=D0();document.documentElement.classList.toggle(D5,e.reduceMotion),_i(e.moveKeys)}const Ht=["up","left","down","right"],jo={up:"Move up",left:"Move left",down:"Move down",right:"Move right"},_a={...Rt},$5=[{code:Ji,does:"mutes the game"},{code:Oc,does:"pauses a match"},{code:"Tab",does:"moves between controls"},{code:"Enter",does:"presses the control you are on"},{code:"NumpadEnter",does:"presses the control you are on"},...Array.from({length:ec},(e,t)=>[{code:`Digit${t+1}`,does:"picks a weapon"},{code:`Numpad${t+1}`,does:"picks a weapon"}]).flat()];function N0(e){return $5.find(t=>t.code===e)?.does??null}function St(e){if(e.startsWith("Key"))return e.slice(3);if(e.startsWith("Digit"))return e.slice(5);switch(e){case"ArrowUp":return"↑";case"ArrowDown":return"↓";case"ArrowLeft":return"←";case"ArrowRight":return"→";case"Escape":return"Esc";case"Space":return"Space";default:return e}}function _i(e){const t=Rt;for(const a of Ht){const o=_a[a],n=e[a];t[a]=n?[n,...o.slice(1).filter(s=>s!==n)]:o}}function N5(e){const t={};if(e===null||typeof e!="object")return t;const a=e,o=new Set;for(const n of Ht){const s=a[n];typeof s!="string"||s.length===0||s.length>32||N0(s)||o.has(s)||Ht.some(r=>r!==n&&_a[r].includes(s))||(o.add(s),t[n]=s)}return t}function P5(e,t,a){const o=N0(t);if(o)return`${St(t)} already ${o}.`;for(const n of Ht){if(n===e)continue;if((a[n]??_a[n][0])===t||_a[n].includes(t))return`${St(t)} is already ${jo[n].toLowerCase()}.`}return null}function H5(){return Ht.some(e=>Rt[e][0]!==_a[e][0])}function Sd(){return'<svg class="fa-ic fa-ic--note" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M10.4 17.2V5.4l8.2-1.9v11.7" fill="none" stroke-width="2"/><ellipse cx="7.6" cy="17.4" rx="3" ry="2.5" fill="#FFC93C"/><ellipse cx="15.8" cy="15.2" rx="3" ry="2.5" fill="#FFC93C"/></svg>'}function q5(e){la("fa-settings-styles",j5),ha();const t=Ae("div","fa-screen fa-settings");let a=D0(),o=null;const n=()=>{const C=[],O=Ht.flatMap(Y=>Rt[Y].slice(1)).map(St);O.length>0&&C.push({action:"Move (fixed)",keys:O}),C.push({action:"Aim",keys:["Mouse"]}),C.push({action:"Fire",keys:["Click"]});const _=Math.min(re[e.profile.selected].weapons.length,ec);return _>1&&C.push({action:"Switch weapon",keys:Array.from({length:_},(Y,z)=>String(z+1))}),C.push({action:"Mute / unmute",keys:[St(Ji)]}),C.push({action:"Pause",keys:[St(Oc)]}),C},s=()=>`Aim, fire, mute and pause are fixed.${re[e.profile.selected].weapons.length>1?"":` ${re[e.profile.selected].name} carries one weapon, so there is no weapon-switch key while it is equipped.`} On a phone, twin sticks appear under your thumbs — the left half of the screen moves, the right half aims and fires — in landscape and in portrait alike.`,r=(C,O,_,Y)=>`
    <div class="set-row">
      <span class="set-row-label">
        <span class="set-row-icon">${C}</span>
        <span class="set-row-text">
          <span class="set-row-title">${O}</span>
          ${_?`<span class="set-row-sub">${_}</span>`:""}
        </span>
      </span>
      <span class="set-row-control">${Y}</span>
    </div>`,i=(C,O)=>`<button class="set-toggle" type="button" role="switch" aria-checked="false"
       aria-label="${O}" data-toggle="${C}"><span class="set-knob"></span></button>`,c=(C,O)=>`<span class="set-slider">
       <input class="set-range" type="range" min="0" max="1" step="0.01"
              aria-label="${O}" data-range="${C}" />
       <span class="set-range-val" data-el="${C}val">100%</span>
     </span>`,l=C=>{const O=Qs(C),_=C==="auto"?Qs(Hu()):"";return`<button class="set-seg-btn" type="button" role="radio" aria-checked="false"
        aria-label="${_?`${O} (${_})`:O}"
        data-el="quality-${C}" data-quality="${C}">
        <span class="set-seg-name">${O}</span>
        ${_?`<span class="set-seg-auto">(${_})</span>`:""}
      </button>`};t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back">${I("back")} Back</button>
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
            <span class="set-row-icon">${I("avatar")}</span>
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
        ${r(I("sound"),"Sound effects","Hits, pickups, menu taps",c("sfx","Sound effects volume"))}
        ${r(I("mute"),"Mute everything","Same as pressing M in a match",i("mute","Mute everything"))}
        ${r(Sd(),"Music","The menu and lobby theme",i("music","Music"))}
        ${r(Sd(),"Music volume","Sits under the effects",c("music","Music volume"))}
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Graphics</p>
        <p class="set-locked" data-el="qualitypin" hidden></p>
        <div class="set-seg" role="radiogroup" aria-label="Graphics quality" data-el="qualityrow">
          ${Nu.map(C=>l(C)).join("")}
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
        ${r(I("speed"),"Reduce motion","Stops the menus pulsing and drifting",i("motion","Reduce motion"))}
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
      <button class="fa-btn fa-btn--primary set-done" type="button" data-el="done">${I("check")} Done</button>
    </footer>

    <div class="set-confirm" data-el="confirm" hidden>
      <div class="set-confirm-card" role="alertdialog" aria-modal="true" aria-label="Reset progress">
        <span class="set-confirm-icon">${I("cone")}</span>
        <p class="set-confirm-title">Reset everything?</p>
        <p class="set-confirm-sub" data-el="confirmsub"></p>
        <div class="set-confirm-btns">
          <button class="fa-btn fa-btn--quiet" type="button" data-el="cancel">Cancel</button>
          <button class="fa-btn set-reset" type="button" data-el="confirmyes">Yes, reset</button>
        </div>
      </div>
    </div>
  `;const h=C=>{const O=t.querySelector(`[data-el="${C}"]`);if(!O)throw new Error(`settings: missing element "${C}"`);return O},d=C=>t.querySelector(`[data-toggle="${C}"]`),p=C=>t.querySelector(`[data-range="${C}"]`),u=h("qualityrow"),f=C=>`${Math.round(C*100)}%`;function m(C,O){const _=d(C);_.setAttribute("aria-checked",O?"true":"false"),_.classList.toggle("is-on",O)}function g(){const C=ju(),O=Bu();for(const z of u.querySelectorAll("[data-quality]")){const j=z.dataset.quality===O;z.setAttribute("aria-checked",j?"true":"false"),z.classList.toggle("is-on",j),z.disabled=C!==null}const _=h("qualitypin");C?(_.textContent=`This session is pinned to ${Qs(C)} by a ?tier= link in the address bar, so this control is switched off. Reload without it to choose.`,_.hidden=!1):_.hidden=!0;const Y=Gu();h("qualityblurb").textContent=O==="auto"&&!C?`Auto picked ${Y.label} on this device. ${Y.blurb}`:Y.blurb}function w(){for(const C of Ht){const O=h(`bind-${C}`),_=St(Rt[C][0]),Y=o===C;O.textContent=Y?"…":_,O.classList.toggle("is-listening",Y),O.setAttribute("aria-label",Y?`${jo[C]}: press the key you want, or Escape to keep ${_}`:`${jo[C]}, currently ${_}. Press to change it.`)}h("bindreset").hidden=!H5(),h("keys").innerHTML=n().map(C=>`
      <div class="set-key-row">
        <span class="set-key-action">${C.action}</span>
        <span class="set-key-caps">${C.keys.map(O=>`<kbd class="set-cap">${O}</kbd>`).join("")}</span>
      </div>`).join(""),h("ctrlnote").textContent=s()}function y(C){h("bindnote").textContent=C??(o!==null?"Press any key. Escape keeps the one you have.":`Tap a key to change it. ${Ht.map(O=>St(_a[O].slice(1)[0]??"")).filter(Boolean).join(" ")} always work as well, so movement can never be lost.`)}function x(C){h("namecount").textContent=`${C.length}/${mi}`}function k(){const C=be.isMuted(),O=be.getState(),_=h("name");document.activeElement!==_&&(_.value=e.profile.name),x(_.value);const Y=p("sfx");document.activeElement!==Y&&(Y.value=String(be.getVolume())),Y.style.setProperty("--p",f(be.getVolume())),h("sfxval").textContent=f(be.getVolume());const z=p("music");document.activeElement!==z&&(z.value=String(be.music.getVolume())),z.style.setProperty("--p",f(be.music.getVolume())),h("musicval").textContent=f(be.music.getVolume()),m("mute",C),m("music",be.music.isEnabled()),m("motion",a.reduceMotion),t.classList.toggle("is-muted",C);const j=h("audiostate");O==="failed"?(j.textContent="This browser blocked audio, so nothing here will make a sound.",j.hidden=!1):O!=="running"?(j.textContent="Sound switches on when you touch the screen — drag a slider to try it.",j.hidden=!1):j.hidden=!0}function S(C,O){const _=P5(C,O,a.moveKeys);if(_){y(`${_} Pick another, or press Escape.`);return}const Y={...a.moveKeys};Y[C]=O,a={...a,moveKeys:Y},ti(a),_i(a.moveKeys),A(),y(`${jo[C]} is now ${St(O)}.`),w()}function v(){a={...a,moveKeys:{}},ti(a),_i(a.moveKeys),A(),y(`Movement is back to ${Ht.map(C=>St(_a[C][0])).join(" ")}.`),w()}const M=C=>{if(o!==null){if(C.preventDefault(),C.stopPropagation(),C.key==="Escape"){const O=o;A(),y(`Left ${jo[O].toLowerCase()} on ${St(Rt[O][0])}.`),w();return}["Shift","Control","Alt","Meta","CapsLock"].includes(C.key)||C.code&&S(o,C.code)}};function L(C){if(o===C){A(),w(),y();return}o===null&&window.addEventListener("keydown",M,!0),o=C,w(),y()}function A(){o!==null&&(o=null,window.removeEventListener("keydown",M,!0))}const F=C=>{const O=C.target.closest("[data-quality]");if(O){qu(O.dataset.quality),g();return}const _=C.target.closest("[data-bind]");if(_){L(_.dataset.bind);return}if(C.target.closest('[data-el="bindreset"]')){v();return}o!==null&&(A(),w(),y());const Y=C.target.closest("[data-toggle]");if(Y){switch(Y.dataset.toggle){case"mute":be.setMuted(!be.isMuted()),be.isMuted()||be.previewClick();break;case"music":be.music.setEnabled(!be.music.isEnabled());break;case"motion":a={...a,reduceMotion:!a.reduceMotion},ti(a),$0();break}k()}};t.addEventListener("click",F);const D=C=>{const O=C.target;if(O.dataset.el==="name"){e.profile.setName(O.value),x(O.value);return}const _=Number(O.value);Number.isFinite(_)&&(O.dataset.range==="sfx"?(be.setVolume(_),be.previewClick()):O.dataset.range==="music"&&be.music.setVolume(_),k())};t.addEventListener("input",D);const E=C=>{const O=C.target;O.dataset.el==="name"&&(O.value=e.profile.setName(O.value),x(O.value))};t.addEventListener("change",E);const R=C=>{const O=C.target;!O||O.dataset.el!=="name"||C.key!=="Enter"||(C.preventDefault(),O.blur())};t.addEventListener("keydown",R),h("back").addEventListener("click",()=>e.navigate({name:"home"})),h("done").addEventListener("click",()=>e.navigate({name:"home"}));const q=h("confirm");h("reset").addEventListener("click",()=>{const C=Se.filter(O=>e.profile.characterLevel(O)>ra).length;h("confirmsub").textContent=`${e.profile.trophies.toLocaleString()} trophies, ${e.profile.coins.toLocaleString()} coins and ${e.profile.wins} wins will be deleted`+(C>0?`, along with ${C} upgraded fighter${C===1?"":"s"}.`:"."),q.hidden=!1}),h("cancel").addEventListener("click",()=>{q.hidden=!0}),h("confirmyes").addEventListener("click",()=>{try{const C=[];for(let O=0;O<localStorage.length;O++){const _=localStorage.key(O);_&&_.startsWith("food-arena.profile")&&C.push(_)}for(const O of C)localStorage.removeItem(O)}catch{}location.reload()});const $=t.querySelector(".set-body"),G=()=>{const C=$.scrollHeight-$.scrollTop-$.clientHeight>2;$.classList.toggle("is-more",C)};$.addEventListener("scroll",G,{passive:!0}),requestAnimationFrame(G);const V=be.onChange(k),H=be.music.onChange(k),Q=Pu(g);return k(),g(),w(),y(),{root:t,resize(){G()},dispose(){V(),H(),Q(),A(),$.removeEventListener("scroll",G),t.removeEventListener("click",F),t.removeEventListener("input",D),t.removeEventListener("change",E),t.removeEventListener("keydown",R),t.remove()}}}const j5=`
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
`,Ed=[{key:"damage",icon:"damage",label:"Damage",color:"#D62839"},{key:"health",icon:"health",label:"Health",color:"#7CB518"},{key:"speed",icon:"speed",label:"Speed",color:"#1E90D8"}],B5=10,G5=new Set(["Neon","Cyber"]);function U5(e){return e===void 0?null:e>=Xa.ultimateSlam?"Whole map":e>Xa.rangedLong?"Max range":e>Xa.rangedMid?"Long":e>Xa.rangedClose?"Mid":e>Xa.meleeHeavy?"Short":"Melee"}function W5(e){const t=[];e.type==="self"&&e.healAmount?t.push(`${I("heal")} +${e.healAmount} HP`):e.comboParts?.length?t.push(`${I("damage")} ${e.comboParts.map(o=>o.damage).join(" + ")}`):e.pellets&&e.pellets>1?t.push(`${I("damage")} ${e.damage} × ${e.pellets}`):e.damage>0&&t.push(`${I("damage")} ${e.damage}`);const a=U5(e.range);return a&&t.push(`${I("range")} ${a}`),t.push(`${I("timer")} ${(e.cooldown/1e3).toFixed(1)}s`),e.effect&&t.push(e.effect==="stun"?`${I("stun")} Stun`:`${I("slow")} Slow`),t}function Y5(e){const t=Se.filter(a=>a!==e);return t[Math.floor(Math.random()*t.length)]}function V5(e){la("fa-chars-styles",X5),ha();const t=Ae("div","fa-screen fa-chars"),a=Vi();let o=e.profile.selected;t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${I("back")} Back</button>
      <h1 class="fa-title chars-heading">Choose Your Fighter</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${I("medal")}</span>Wins <span class="fa-chip-val" data-el="wins">0</span></div>
      <div class="fa-chip"><span class="fa-chip-em">${I("coin")}</span><span class="fa-chip-val" data-el="coins">0</span></div>
    </header>

    <div class="chars-body">
      <section class="chars-hero">
        <div class="chars-hero-3d" data-el="hero3d"></div>
        <div class="chars-hero-vignette"></div>
        <div class="chars-hero-plate">
          <span class="fa-title chars-hero-name" data-el="heroname"></span>
          <span class="fa-rarity" data-el="herorarity"></span>
        </div>
        <button class="chars-equip" type="button" data-el="select">${I("star")} Equip</button>
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
      <button class="fa-btn fa-btn--primary fa-btn--hero" type="button" data-el="fight">${I("play")} Fight!</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const n=A=>{const F=t.querySelector(`[data-el="${A}"]`);if(!F)throw new Error(`characterSelect: missing element "${A}"`);return F},s=n("roster"),r=n("stats"),i=n("abilities"),c=n("hero3d"),l=n("heroname"),h=n("herorarity"),d=n("select"),p=n("level"),u=n("confetti"),f=new Map;for(const A of Se){const F=re[A],D=Ae("button","chars-card");D.type="button",D.dataset.char=A,D.style.setProperty("--card-bg",Ni[F.rarity]),D.style.setProperty("--rarity",ft[F.rarity]),D.style.setProperty("--rarity-glow",Qd(ft[F.rarity],.75)),G5.has(F.rarity)&&D.classList.add("is-animated"),D.innerHTML=`
      <img class="chars-card-render" alt="" data-el="render" />
      <span class="chars-card-sheen"></span>
      <span class="chars-card-gloss"></span>
      <span class="chars-card-art">${I("avatar")}</span>
      <span class="chars-card-name">${F.name}</span>
      <span class="fa-rarity chars-card-rarity"
            style="background:${ft[F.rarity]}">${F.rarity}</span>
      <span class="chars-card-playing">${I("star")}</span>
      <span class="chars-card-lv" data-el="lv"></span>
    `,D.addEventListener("click",()=>S(A,!0)),s.appendChild(D),f.set(A,D)}const m=(A,F)=>{const D=f.get(A),E=D?.querySelector('[data-el="render"]');E&&(E.src=F,D.classList.add("has-render"))};for(const A of Se){const F=Qi(A);F&&m(A,F)}ip(m);const g=Ae("div","chars-card chars-card--locked");g.innerHTML=`
    <span class="chars-card-art">${I("lock")}</span>
    <span class="chars-card-name">More soon</span>
  `,s.appendChild(g);const w=new Map,y=new Map;for(const A of Ed){const F=Ae("div","fa-stat");F.innerHTML=`
      <span class="fa-stat-label">${I(A.icon)} ${A.label}</span>
      <div class="fa-stat-track"><div class="fa-stat-fill"></div><div class="fa-stat-pips"></div></div>
      <span class="fa-stat-val"></span>
    `;const D=F.querySelector(".fa-stat-fill");D.style.backgroundColor=A.color,w.set(A.key,D),y.set(A.key,F.querySelector(".fa-stat-val")),r.appendChild(F)}function x(){const A=o,F=e.profile.characterLevel(A),D=e.profile.nextLevelPrice(A),E=e.profile.canLevelUp(A),R=D===null,q=as(A,li,F),$=ii(F),G=R?q:as(A,li,F+1),V=R?$:ii(F+1),H=R?"":`
      <span class="chars-lv-gain"><span class="chars-lv-item">${I("health")} +${G-q}</span
        ><span class="chars-lv-item">${I("damage")} +${Math.round((V/$-1)*100)}%</span></span>`;p.innerHTML=`
      <div class="chars-lv-head">
        <span class="chars-lv-badge${R?" is-max":""}">Lv ${F}${R?"":` / ${ni}`}</span>
        <span class="chars-lv-now"><span class="chars-lv-item">${I("health")} ${q} HP</span
          ><span class="chars-lv-item">${I("damage")} x${$.toFixed(2)}</span></span>
      </div>
      ${H}
      <button class="chars-lv-btn" type="button" data-el="upgrade"${R||!E?" disabled":""}>${R?`${I("star")} Max level`:`${I("sparkle")} Upgrade <span class="chars-lv-price">${I("coin")} ${D.coins.toLocaleString()}</span>`}</button>
      ${R||E?"":`<span class="chars-lv-short">${(D.coins-e.profile.coins).toLocaleString()} more coins needed</span>`}
    `}function k(){const A=e.profile.selected;for(const[D,E]of f)E.classList.toggle("is-playing",D===A);const F=o===A;d.innerHTML=F?`${I("star")} Equipped`:`${I("star")} Equip`,d.classList.toggle("is-equipped",F),d.disabled=F}function S(A,F=!1){o=A;const D=re[A];for(const[E,R]of f)R.classList.toggle("is-viewed",E===A);F&&f.get(A)?.scrollIntoView({block:"nearest"}),l.textContent=D.name,h.textContent=D.rarity,h.style.background=ft[D.rarity];for(const E of Ed){const R=D.stats[E.key];w.get(E.key).style.width=`${R/B5*100}%`,y.get(E.key).textContent=String(R)}i.innerHTML="";for(const E of D.abilities){const R=D.weapons.find($=>$.name===E.name),q=Ae("div","chars-ability");q.innerHTML=`
        <span class="chars-ability-em">${cp(E.emoji)}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">${E.name}</span>
          <span class="chars-ability-desc">${E.desc}</span>
          ${R?`<span class="chars-ability-facts">${W5(R).map($=>`<span class="chars-fact">${$}</span>`).join("")}</span>`:""}
        </span>
      `,i.appendChild(q)}if(D.hasTrail){const E=Ae("div","chars-ability chars-ability--passive");E.innerHTML=`
        <span class="chars-ability-em">${I("honey")}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">Passive</span>
          <span class="chars-ability-desc">Leaves a damaging speed-boost trail while moving.</span>
        </span>
      `,i.appendChild(E)}i.scrollTop=0,a.show(A),k(),x()}n("back").addEventListener("click",()=>e.navigate({name:"home"})),d.addEventListener("click",()=>{e.profile.select(o),k(),rs(u,50,24),a.poke()}),n("fight").addEventListener("click",()=>{e.profile.select(o),e.navigate({name:"match",player:o,enemy:Y5(o)})});function v(){for(const[A,F]of f){const D=e.profile.characterLevel(A),E=F.querySelector('[data-el="lv"]');E&&(E.textContent=D>1?`Lv ${D}`:"",F.classList.toggle("has-lv",D>1),F.classList.toggle("is-maxed",D>=ni))}}function M(){n("wins").textContent=String(e.profile.wins),n("coins").textContent=e.profile.coins.toLocaleString()}p.addEventListener("click",A=>{!A.target.closest('[data-el="upgrade"]')||!e.profile.levelUp(o)||(rs(u,34,18),a.poke())});const L=e.profile.onChange(()=>{M(),v(),x()});return M(),v(),S(o),a.attachTo(c),{root:t,update(A){a.update(A)},resize(){a.resize()},dispose(){L(),a.detach(),t.remove()}}}const X5=`
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
  background: ${Jd};
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
`,Td=["Normal","Rare","Epic","Legendary","Neon","Cyber"],K5=(()=>{const e=Wt.map(a=>{const o=Vo(a).filter(i=>i.rarity);let n=null,s=-1,r=0;for(const i of o)r+=i.percent,i.percent>s&&(s=i.percent,n=i.rarity??null);return{kind:a,floor:n,charShare:r}});e.sort((a,o)=>{const n=a.floor?Td.indexOf(a.floor):-1,s=o.floor?Td.indexOf(o.floor):-1;return n-s||a.charShare-o.charShare});const t={};return e.forEach((a,o)=>{t[a.kind]={rank:o+1,of:e.length,floor:a.floor}}),t})();function ai(e,t={}){const a=K5[e];if(!a)return"";const o=a.floor?ft[a.floor]:"var(--ink)",n=Array.from({length:a.of},(r,i)=>`<i class="tr-pip${i<a.rank?" is-on":""}"></i>`).join(""),s=`Tier ${a.rank} of ${a.of}${a.floor?`, ${a.floor} or rarer`:""}`;return`<span class="tr-tier" style="--pip:${o}" role="img" aria-label="${s}">${n}${t.label&&a.floor?`<span class="tr-tier-txt">${a.floor}+</span>`:""}</span>`}function Z5(e){la("fa-trophy-styles",Q5),ha();const t=Ae("div","fa-screen fa-tr"),a=e.profile;t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${I("back")} Back</button>
      <h1 class="fa-title tr-heading">Trophy Road</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${I("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${I("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="tr-body">
      <section class="tr-hero">
        <div class="tr-hero-count">
          <span class="tr-hero-em">${I("trophy")}</span>
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
        <button class="fa-btn fa-btn--green tr-claimall" type="button" data-el="claimall">${I("sparkle")} Claim</button>
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
        <button class="fa-iconbtn tr-odds" type="button" data-el="oddsbtn">${I("chest")} Drop rates</button>
        <button class="fa-btn fa-btn--quiet tr-storebtn" type="button" data-el="storebtn">${I("gem")} Get Gems</button>
      </div>
    </footer>

    <div class="tr-sheet" data-el="sheet">
      <div class="tr-sheet-scrim" data-el="scrim"></div>
      <div class="tr-sheet-card" data-el="sheetcard"></div>
    </div>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const o=E=>{const R=t.querySelector(`[data-el="${E}"]`);if(!R)throw new Error(`trophyRoad: missing element "${E}"`);return R},n=o("road"),s=o("inventory"),r=o("sheet"),i=o("sheetcard"),c=o("confetti"),l=o("claimall"),h=o("delta");function d(E=!1){const R=a.trophies;a.unlocked;const q=new Set(a.economy.claimed);n.innerHTML="";const $=Ae("div","tr-roadtrack"),G=Ae("div","tr-spine"),V=Ae("div","tr-spine-fill");G.appendChild(V),$.appendChild(G);let H=!1;const Q=()=>{const O=Ae("div","tr-pin");O.dataset.el="pin",O.innerHTML=`
        <span class="tr-pin-dot">${I("pin")}</span>
        <span class="tr-pin-label">${R.toLocaleString()}</span>
      `,$.appendChild(O),H=!0};let C=0;for(const O of ef()){!H&&R<O.trophies&&Q();const _=f(O,R,q.has(O.trophies));_.classList.add(C%2===0?"is-high":"is-low"),$.appendChild(_),C++}H||Q(),n.appendChild($),Xo($),p(),E&&u()}function p(){const E=n.querySelector(".tr-roadtrack"),R=n.querySelector(".tr-spine"),q=n.querySelector(".tr-spine-fill"),$=n.querySelector('[data-el="pin"]');if(!E||!R||!q||!$)return;q.style.width=`${Math.max(0,$.offsetLeft+$.offsetWidth/2)}px`;const G=R.getBoundingClientRect();if(G.height===0)return;const V=G.top+G.height/2;for(const H of E.querySelectorAll(".tr-node")){const Q=H.getBoundingClientRect(),C=H.classList.contains("is-high")?V-Q.bottom:Q.top-V;H.style.setProperty("--stem",`${Math.max(0,Math.round(C))}px`)}}function u(){const E=n.querySelector('[data-el="pin"]');!E||n.clientWidth===0||(n.scrollLeft=Math.max(0,E.offsetLeft-n.clientWidth/2+E.offsetWidth/2))}function f(E,R,q,$){const G=pi(E.reward),H=R>=E.trophies&&!q,Q=H?Ae("button","tr-node is-claimable"):Ae("div","tr-node");if(H&&(Q.type="button"),q&&Q.classList.add("is-claimed"),G.isCharacter&&Q.classList.add("is-character"),Q.dataset.trophies=String(E.trophies),E.reward.type==="character"){const O=ft[re[E.reward.id].rarity];Q.style.setProperty("--node-accent",O),Q.style.setProperty("--node-glow",Qd(O,.55))}const C=q?`<span class="tr-status is-done">${I("check")} Claimed</span>`:H?'<span class="tr-status is-ready">Claim</span>':`<span class="tr-status">${(E.trophies-R).toLocaleString()} to go</span>`;return Q.innerHTML=`
      <span class="tr-node-req">${I("trophy")} ${E.trophies.toLocaleString()}</span>
      <span class="tr-node-medal"><span class="tr-node-em">${E.reward.type==="character"?Tt(E.reward.id,{crop:"head"}):E.reward.type==="container"?dt(E.reward.kind):Jt(G.emoji)}</span>${q?`<span class="tr-node-tick">${I("check")}</span>`:""}</span>
      <span class="tr-node-title">${G.title}</span>
      ${E.reward.type==="container"?ai(E.reward.kind):""}
      ${G.payoutNote?`<span class="tr-node-note">${G.payoutNote.replace("🪙",I("coin"))}</span>`:""}
      ${C}
    `,Q}function m(){o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString(),o("trophies").textContent=a.trophies.toLocaleString();const E=jd(a.trophies),R=o("fill");R.style.width=`${(E.progress01*100).toFixed(1)}%`;const q=a.claimable.length;if(q>0)o("nextlabel").textContent="Ready now",o("nextval").innerHTML=q>1?`${I("sparkle")} ${q} road rewards to claim`:`${I("sparkle")} 1 road reward — tap it on the track`;else if(E.next){const $=E.next.reward,G=pi($,a.unlocked),V=E.next.trophies-a.trophies;o("nextlabel").textContent="Next reward",o("nextval").innerHTML=`${$.type==="character"?Tt($.id,{crop:"head"}):$.type==="container"?dt($.kind):Jt(G.emoji)} ${G.title} <span class="tr-togo">${I("trophy")} ${V.toLocaleString()} to go</span>`}else o("nextlabel").textContent="Road complete",o("nextval").innerHTML=`${I("flag")} Master of the Kitchen`;o("fillxp").textContent=E.next?`${(a.trophies-E.from).toLocaleString()} / ${(E.to-E.from).toLocaleString()}`:`Road complete — ${di().toLocaleString()}`,l.style.display=q>1?"":"none",l.innerHTML=`${I("sparkle")} Claim ${q}`,g()}function g(){s.innerHTML="";const E=Wt.filter(R=>(a.containers[R]??0)>0);if(E.length===0){const R=a.winsToNextChest,q=Ae("p","tr-inv-empty");q.innerHTML=`${I("chest")} <strong>${R}</strong> more ${R===1?"win":"wins"} for a free Chest`,s.appendChild(q);return}for(const R of E){const q=Ce[R],$=a.containers[R]??0,G=Ae("button","tr-open");G.type="button",G.dataset.open=R,G.innerHTML=`
        <span class="tr-open-em">${dt(R)}</span>
        <span class="tr-open-body">
          <span class="tr-open-name">${q.name}</span>
          <span class="tr-open-cta">Open ${ai(R)}</span>
        </span>
        <span class="tr-open-count">${$}</span>
      `,s.appendChild(G)}}function w(E,R="wide"){i.innerHTML=E,i.classList.toggle("is-reveal",R==="reveal"),r.classList.add("is-open")}function y(){r.classList.remove("is-open"),i.innerHTML=""}function x(E){const R=[];for(const q of E.characters)R.push(Tt(q,{crop:"head"}));for(const[q,$]of Object.entries(E.containers))$&&R.push(dt(q));return E.coins>0&&R.push(I("coin")),E.gems>0&&R.push(I("gem")),R}function k(E,R){const q=Ku(E);if(q.length===0)return;const $=x(E),[G,...V]=q;w(`
      <div class="tr-reveal">
        <div class="tr-reveal-em">${$[0]??Jt(G.emoji)}</div>
        <p class="tr-reveal-kicker">${R}</p>
        <p class="tr-reveal-name">${G.label}</p>
        ${V.length>0?`<div class="tr-reveal-more">${V.map((H,Q)=>`<span class="tr-reveal-chip">${$[Q+1]??Jt(H.emoji)} ${H.label}</span>`).join("")}</div>`:""}
        <button class="fa-btn fa-btn--primary tr-sheet-close" type="button" data-el="close">Nice!</button>
      </div>
    `,"reveal"),Xo(i),rs(c,50,28)}function S(){const E=Wt.map(R=>{const q=Ce[R],$=Vo(R).map(V=>`
        <li class="tr-odds-row">
          <span class="tr-odds-what">${V.rarity?`<i class="tr-odds-dot" style="background:${ft[V.rarity]}"></i>`:""}${V.label}</span>
          <span class="tr-odds-pct">${Pd(V.percent)}</span>
        </li>
      `).join(""),G=Vo(R).filter(V=>V.pool&&V.pool.length>0).map(V=>`${V.rarity}: ${V.pool.map(H=>re[H].name).join(", ")}`).join(" · ");return`
        <section class="tr-odds-block">
          <h3 class="tr-odds-title">${dt(R)} ${q.name} ${ai(R,{label:!0})}</h3>
          <p class="tr-odds-blurb">${q.blurb}</p>
          <ul class="tr-odds-list">${$}</ul>
          ${G?`<p class="tr-odds-pool">${G}</p>`:""}
        </section>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">Drop rates</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${I("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-sheet-note">Every percentage below is read directly from the reward
        tables the game rolls against.</p>
        <p class="tr-sheet-note tr-sheet-note--rarity">${Dd}</p>
        ${E}
      </div>
    `)}function v(){const E=nf().map(R=>{const q=rf(R),$=[];return R.coins&&$.push(`${I("coin")} ${R.coins.toLocaleString()}`),R.container&&$.push(`${dt(R.container.kind)} ${Ce[R.container.kind].name}`),`
        <div class="tr-sku${R.oneTime?" is-featured":""}">
          ${q>0||R.oneTime?`<span class="tr-sku-flags">
            ${q>0?`<span class="tr-sku-bonus">+${q}%</span>`:""}
            ${R.oneTime?'<span class="tr-sku-bonus tr-sku-once">ONE TIME</span>':""}
          </span>`:""}
          <span class="tr-sku-em">${R.container?dt(R.container.kind):Jt(R.emoji)}</span>
          <span class="tr-sku-name">${R.name}</span>
          <span class="tr-sku-gems">${I("gem")} ${R.gems.toLocaleString()}</span>
          ${$.length>0?`<span class="tr-sku-extra">+ ${$.join(" + ")}</span>`:""}
          <button class="tr-sku-buy" type="button" disabled>${`${sf(R.priceUsdCents)} · Soon`}</button>
        </div>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">${I("gem")} Gem Store</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${I("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-soon">${I("cone")} Purchases are not available yet — nothing here can be bought.
        Every gem in the game is earned on the Trophy Road and out of chests.</p>
        <div class="tr-skus">${E}</div>
      </div>
    `)}o("back").addEventListener("click",()=>e.navigate({name:"home"})),o("oddsbtn").addEventListener("click",S),o("storebtn").addEventListener("click",v),o("scrim").addEventListener("click",y),l.addEventListener("click",()=>{const E=a.claimAllMilestones();k(E,"You earned")});const M=E=>{const R=E.target;if(R.closest('[data-el="close"]')){y();return}const q=R.closest(".tr-node.is-claimable");if(q){const G=Number(q.dataset.trophies),V=a.claimMilestone(G);V&&k(V,"You earned");return}const $=R.closest("[data-open]");if($){const G=$.dataset.open,V=a.openContainer(G);V&&k(V.reward,V.duplicateOf?`${re[V.duplicateOf].name} again — traded in`:`From a ${Ce[G].name}`)}};t.addEventListener("click",M);const L=E=>{E.key==="Escape"&&r.classList.contains("is-open")&&y()};window.addEventListener("keydown",L);const A=a.onChange(()=>{m(),d()});m(),d();let F=!1;requestAnimationFrame(()=>{F||(p(),u())});const D=a.lastMatch;if(D&&!D.seen){const E=D.trophies>0?"+":"";h.innerHTML=`${E}${D.trophies} ${I("trophy")}`,h.className=`tr-delta is-on ${D.trophies>0?"is-up":D.trophies<0?"is-down":"is-flat"}`,a.markLastMatchSeen()}return{root:t,resize(){d(),u()},dispose(){F=!0,A(),t.removeEventListener("click",M),window.removeEventListener("keydown",L),t.remove()}}}const Q5=`
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
`,Ad=Object.keys(co).sort((e,t)=>co[e]-co[t]);function J5(e,t){const a=Ce[e].entries,o=Rs(a);return a.map(n=>{let s=n.coins??0;const r=n.gems??0;let i=null;return n.characterRarity&&((Fs[n.characterRarity]??[]).some(l=>!t.has(l))?i=n.characterRarity:s+=co[n.characterRarity]),{chance01:o>0?n.weight/o:0,coins:s,gems:r,fighter:i}})}function P0(e,t){const a=J5(e,t),o={canGrantFighter:!1,bestCoins:0,bestGems:0,expectedCoins:0,expectedGems:0,characterPercent:0,floorRarity:null};for(const s of a)s.fighter&&(o.canGrantFighter=!0),o.bestCoins=Math.max(o.bestCoins,s.coins),o.bestGems=Math.max(o.bestGems,s.gems),o.expectedCoins+=s.chance01*s.coins,o.expectedGems+=s.chance01*s.gems;const n=Rs(Ce[e].entries);for(const s of Ce[e].entries){if(!s.characterRarity)continue;o.characterPercent+=n>0?s.weight/n*100:0;const r=Ad.indexOf(s.characterRarity),i=o.floorRarity===null?1/0:Ad.indexOf(o.floorRarity);r<i&&(o.floorRarity=s.characterRarity)}return o}function Va(e,t,a){const o=Ce[e].price;if(!o)return!1;const n=P0(e,a);return n.canGrantFighter?!0:t==="coins"?n.bestCoins>o.coins:n.bestGems>o.gems}const ex=Wt.filter(e=>Ce[e].price!==null);function tx(e){la("fa-shop-styles",ax),ha();const t=Ae("div","fa-screen fa-shop"),a=e.profile;t.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${I("back")} Back</button>
      <h1 class="fa-title shop-heading">Shop</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${I("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${I("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="fa-panel fa-panel--flush shop-body">
      <div class="fa-scroll shop-scroll" data-el="scroll"></div>
    </div>

    <footer class="shop-bottom">
      <p class="shop-foot-note" data-el="footnote"></p>
      <div class="shop-foot-actions">
        <button class="fa-btn fa-btn--quiet" type="button" data-go="trophies">${I("trophy")} Trophy Road</button>
        <button class="fa-btn fa-btn--green" type="button" data-go="characters">${I("play")} Play a match</button>
      </div>
    </footer>
  `;const o=u=>{const f=t.querySelector(`[data-el="${u}"]`);if(!f)throw new Error(`shop: missing element "${u}"`);return f},n=o("scroll");function s(u){return`<ul class="shop-odds">${Vo(u).map(m=>`
      <li class="shop-odds-row">
        <span class="shop-odds-what">${m.rarity?`<i class="shop-odds-dot" style="background:${ft[m.rarity]}"></i>`:""}${m.label}</span>
        <span class="shop-odds-pct">${Pd(m.percent)}</span>
      </li>`).join("")}</ul>`}function r(u){const f=Vo(u).filter(m=>m.rarity&&m.pool&&m.pool.length>0).map(m=>`<span class="shop-pool-line"><i class="shop-odds-dot" style="background:${ft[m.rarity]}"></i>${m.pool.map(g=>re[g].name).join(", ")}</span>`).join("");return f?`<div class="shop-pool">${f}</div>`:""}function i(u,f){const m=Ce[u],g=m.price,w=P0(u,f),y=w.canGrantFighter&&w.characterPercent>=99.999&&w.floorRarity?`<span class="shop-guarantee"><i class="shop-odds-dot" style="background:${ft[w.floorRarity]}"></i>Always a fighter, ${w.floorRarity} or rarer</span>`:"",x=S=>{const v=S==="coins"?g.coins:g.gems,M=S==="coins"?a.coins:a.gems,L=I(S==="coins"?"coin":"gem"),A=Va(u,S,f),F=M>=v,D=A&&F,E=A?`You need ${(v-M).toLocaleString()} more ${S}`:"Not for sale right now";return`
        <button class="shop-buy shop-buy--${S}${D?"":" is-off"}" type="button"
          data-buy="${u}" data-currency="${S}"${D?"":` disabled title="${E}" aria-label="${v.toLocaleString()} ${S}. ${E}."`}>
          ${L} ${v.toLocaleString()}
        </button>`};let k="";if(!Va(u,"coins",f)&&!Va(u,"gems",f)){const S=w.bestGems===0,v=w.bestCoins<g.coins?`It pays back at most ${w.bestCoins.toLocaleString()} coins for a ${g.coins.toLocaleString()} coin price, and ${Math.round(w.expectedCoins).toLocaleString()} on average.`:`Its average return is ${Math.round(w.expectedCoins).toLocaleString()} coins against a ${g.coins.toLocaleString()} coin price.`;k=`
        <p class="shop-why">
          <span class="shop-why-head">Not for sale</span>
          Every fighter this box can give is already unlocked, so it can only pay
          ${S?"coins":"currency"} back. ${v}
        </p>`}else if(!(a.coins>=g.coins)&&!(a.gems>=g.gems))k=`
        <p class="shop-why">
          <span class="shop-why-head">Keep playing</span>
          You need ${(g.coins-a.coins).toLocaleString()} more coins
          or ${(g.gems-a.gems).toLocaleString()} more gems for this one.
        </p>`;else{const S=[...new Set(Ce[u].entries.flatMap(M=>M.characterRarity?Fs[M.characterRarity]??[]:[]))],v=S.filter(M=>!f.has(M)).length;k=w.expectedCoins===0?`<p class="shop-why"><span class="shop-why-head">What you get</span>
            Every roll here is a new fighter. ${v} of the ${S.length} are still
            missing from your roster.</p>`:`<p class="shop-why"><span class="shop-why-head">Duplicates</span>
            ${v} of the ${S.length} fighters here are still missing. A repeat
            trades in for coins, ${Math.round(w.expectedCoins).toLocaleString()} on
            average across the table.</p>`}return`
      <article class="shop-card">
        <div class="shop-card-head">
          <span class="shop-card-em">${dt(u)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${m.name}</h3>
            ${y}
          </div>
        </div>
        <p class="shop-blurb">${m.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${s(u)}
        ${r(u)}
        <div class="shop-prices">${x("coins")}${x("gems")}</div>
        ${k}
      </article>`}function c(u){const f=Ce[u],m=a.winsToNextChest;return`
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
      </article>`}function l(){const u=Wt.filter(m=>(a.containers[m]??0)>0);return u.length===0?"":`
      <section class="shop-section shop-inv">
        <h2 class="shop-section-title">Your boxes</h2>
        <div class="shop-heldrow">${u.map(m=>`
      <span class="shop-held">
        <span class="shop-held-em">${dt(m)}</span>
        <span class="shop-held-name">${Ce[m].name}</span>
        <span class="shop-held-n">${a.containers[m]}</span>
      </span>`).join("")}</div>
        <p class="shop-why"><span class="shop-why-head">Waiting to be opened</span>
          Open them on the Trophy Road, below.</p>
      </section>`}function h(){const u=a.unlocked;o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString();const f=ex.some(g=>Va(g,"coins",u)||Va(g,"gems",u)),m=f?"":`
      <p class="shop-notice">${I("cone")}
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
        <p class="shop-rarity">${Dd}</p>
        <div class="shop-grid">${Wt.map(g=>Ce[g].price?i(g,u):c(g)).join("")}</div>
      </section>
    `,o("footnote").textContent=f?"Coins and gems are earned by playing. Both work on every box.":"Boxes are earned, not bought:"}o("back").addEventListener("click",()=>e.navigate({name:"home"}));const d=u=>{const f=u.target,m=f.closest("[data-go]")?.dataset.go;if(m==="trophies"){e.navigate({name:"trophies"});return}if(m==="characters"){e.navigate({name:"characters"});return}const g=f.closest("[data-buy]");if(!g||g.disabled)return;const w=g.dataset.buy,y=g.dataset.currency;Va(w,y,a.unlocked)&&a.buyContainer(w,y)};t.addEventListener("click",d);const p=a.onChange(h);return h(),{root:t,dispose(){p(),t.removeEventListener("click",d),t.remove()}}}const ax=`
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
`,H0=["opening","home","characters","trophies","shop","settings","match"];function Ss(e){return typeof e=="string"&&Se.includes(e)}function ox(e){if(!e||typeof e!="object")return null;const t=e.name;if(typeof t!="string"||!H0.includes(t))return null;if(t==="match"){const{player:a,enemy:o}=e;return Ss(a)&&Ss(o)?{name:t,player:a,enemy:o}:null}return{name:t}}function nx(e){const t=new URLSearchParams(e),a=t.get("screen");if(a===null||!H0.includes(a))return null;if(a==="match"){const o=t.get("player"),n=t.get("enemy");return Ss(o)&&Ss(n)?{name:a,player:o,enemy:n}:null}return{name:a}}function oi(e,t){return e.name!==t.name?!1:e.name==="match"&&t.name==="match"?e.player===t.player&&e.enemy===t.enemy:!0}function Fd(e){const t=new URLSearchParams(window.location.search);t.set("screen",e.name),e.name==="match"?(t.set("player",e.player),t.set("enemy",e.enemy)):(t.delete("player"),t.delete("enemy"));const a=t.toString();return`${window.location.pathname}${a?`?${a}`:""}${window.location.hash}`}function sx(e,t){if(t!=="none")try{const a={fa:1,route:e};t==="push"?window.history.pushState(a,"",Fd(e)):window.history.replaceState(a,"",Fd(e))}catch{}}const rx=3e3,ix=10,cx=140;function lx(e){Sf(),$0();const t=document.createElement("div");t.className="fa-root",t.innerHTML=`
    <div class="fa-bg"></div>
    <div class="fa-rays"></div>
    <div class="fa-dots"></div>
    <div class="fa-stack" data-el="stack"></div>
    <div class="fa-curtain" data-el="curtain"></div>
  `,e.screenRoot.appendChild(t);const a=t.querySelector('[data-el="stack"]'),o=t.querySelector('[data-el="curtain"]'),n=e.profile??new Zd;let s=null,r={name:"home"},i=0,c=0,l=!1,h=null,d=!1,p=null,u=0;function f(z,j){console.error(`[shell] ${z}:`,j)}function m(z){const j=window.__shellFault;if(!j)return!1;const te=j[z];return typeof te!="number"||te<=0?!1:(j[z]=te-1,!0)}const g={navigate:C,profile:n,gameHost:e.gameHost,hudRoot:e.hudRoot};function w(z){if(m("build"))throw new Error(`__shellFault: build ${z.name}`);switch(z.name){case"opening":return Fg(g);case"home":return kg(g);case"characters":return V5(g);case"trophies":return Z5(g);case"shop":return tx(g);case"settings":return q5(g);case"match":return O5(g,z)}throw new Error(`unknown route "${String(z.name)}"`)}function y(){i&&cancelAnimationFrame(i),i=0}function x(){y(),c=performance.now();const z=j=>{if(d)return;const te=Math.min(Math.max(0,(j-c)/1e3),1/20);c=j;try{if(m("update"))throw new Error("__shellFault: update");s?.update?.(te),u=0}catch(ie){if(u++,u===1&&f(`screen "${r.name}" update() threw`,ie),u>=ix){f(`screen "${r.name}" update() threw ${u} frames running — stopping the menu loop`,ie),y();return}}i=requestAnimationFrame(z)};i=requestAnimationFrame(z)}function k(z,j){if(z.name==="match")try{il()}catch(ie){f("disposeCharacterStage() threw",ie)}try{z.name==="match"?be.music.fadeOut():be.music.fadeIn()}catch(ie){f("music transition threw",ie)}t.classList.toggle("is-ingame",z.name==="match");let te;try{te=w(z)}catch(ie){G(z,ie);return}r=z,s=te,a.appendChild(te.root),sx(z,j),E(),window.__screen=z.name,u=0,s.update?x():y(),z.name!=="match"&&(window.__previewReady=!1,requestAnimationFrame(()=>requestAnimationFrame(()=>{d||(window.__previewReady=!0)})))}function S(z){z.style.cssText=["pointer-events:auto","background:#FFF3DE","color:#1a1224","border-radius:16px","padding:18px 22px","max-width:min(92vw,420px)","text-align:center","box-shadow:0 10px 30px rgba(0,0,0,0.45)","font-family:'Rubik',sans-serif"].join(";")}function v(z){z.style.cssText=["position:absolute","inset:0","z-index:120","display:grid","place-items:center","padding:16px","background:rgba(20,13,30,0.72)","pointer-events:none"].join(";")}function M(z){const j=document.createElement("button");return j.type="button",j.textContent=z,j.style.cssText=["min-height:44px","min-width:140px","margin-top:14px","padding:0 20px","border:0","border-radius:999px","background:#F4A300","color:#1a1224","font-family:'Rubik',sans-serif","font-weight:800","font-size:16px","cursor:pointer"].join(";"),j.addEventListener("click",()=>window.location.reload()),j}function L(z){const j=document.createElement("div");v(j),j.style.background="#16101f",j.dataset.el="fa-fatal";const te=document.createElement("div");S(te);const ie=document.createElement("div");ie.textContent="The kitchen would not open",ie.style.cssText="font-weight:800;font-size:18px";const $e=document.createElement("div");return $e.textContent=String(z?.message??z??"unknown error"),$e.style.cssText="margin-top:8px;font-size:13px;opacity:0.75;font-family:'Heebo',sans-serif;word-break:break-word",te.append(ie,$e,M("Reload")),j.appendChild(te),j}let A=null,F=null;function D(){if(d||A)return;const z=document.createElement("div");v(z),z.dataset.el="fa-gl-notice";const j=document.createElement("div");S(j);const te=document.createElement("div");te.textContent="Graphics interrupted",te.style.cssText="font-weight:800;font-size:18px";const ie=document.createElement("div");ie.textContent="The device took the graphics back. Restoring…",ie.style.cssText="margin-top:6px;font-size:14px;opacity:0.8;font-family:'Heebo',sans-serif";const $e=M("Reload");$e.style.display="none",j.append(te,ie,$e),z.appendChild(j),t.appendChild(z),A=z,F=setTimeout(()=>{F=null,A&&(ie.textContent="The graphics have not come back. Reloading returns you to this same screen.",$e.style.display="inline-block")},rx)}function E(){F!==null&&(clearTimeout(F),F=null),A?.remove(),A=null}function R(z){return z.detail?.offscreen===!0}function q(z){R(z)||D()}function $(z){R(z)||E()}function G(z,j){if(f(`screen "${z.name}" failed to mount`,j),a.innerHTML="",z.name!=="home"){k({name:"home"},"replace");return}s=null,r={name:"home"},window.__screen="home",y(),a.appendChild(L(j))}function V(){y();try{if(m("dispose"))throw new Error("__shellFault: dispose");s?.dispose()}catch(z){f(`screen "${r.name}" dispose() threw`,z)}s=null,a.innerHTML=""}function H(z){return r.name==="opening"||oi(z,r)?"replace":"push"}function Q(z,j){l=!0,window.__screenReady=!1,o.classList.add("is-on"),h=setTimeout(()=>{h=null;try{V(),k(z,j)}catch(te){f("navigation threw",te)}finally{o.classList.remove("is-on"),l=!1,window.__screenReady=!0,_()}},cx)}function C(z){d||l||Q(z,H(z))}const O=z=>{if(d)return;const j=z.state,te=ox(j?.route)??nx(window.location.search)??{name:"home"};if(!oi(te,r)){if(l){p=te;return}Q(te,"none")}};function _(){const z=p;p=null,!(!z||d||oi(z,r))&&Q(z,"none")}const Y=()=>{try{s?.resize?.()}catch(z){f(`screen "${r.name}" resize() threw`,z)}};return window.addEventListener("resize",Y),window.addEventListener("popstate",O),window.addEventListener("fa:webglcontextlost",q),window.addEventListener("fa:webglcontextrestored",$),window.__shell={navigate:C,route:()=>r},{navigate(z){if(!s){k(z,z.name==="opening"?"none":"replace"),window.__screenReady=!0;return}C(z)},get route(){return r},dispose(){d=!0,h!==null&&clearTimeout(h),window.removeEventListener("resize",Y),window.removeEventListener("popstate",O),window.removeEventListener("fa:webglcontextlost",q),window.removeEventListener("fa:webglcontextrestored",$),E(),V(),il(),t.remove(),delete window.__shell}}}const Dt=new URLSearchParams(location.search),hx=["player","enemy","simSpeed","fogRadius","px","py"];function Rd(e,t){const a=Dt.get(e);return a&&Se.includes(a)?a:t}function dx(e){if(Dt.get("screen")==="match"||!Dt.has("screen")&&hx.some(a=>Dt.has(a))){const a=Rd("player",e.selected);return{name:"match",player:a,enemy:Rd("enemy",a==="donut"?"hamburger":"donut")}}return Dt.get("screen")==="characters"?{name:"characters"}:Dt.get("screen")==="trophies"?{name:"trophies"}:Dt.get("screen")==="shop"?{name:"shop"}:Dt.get("screen")==="settings"?{name:"settings"}:Dt.get("screen")==="home"?{name:"home"}:{name:"opening"}}const q0=new Zd,px=lx({gameHost:document.getElementById("game"),hudRoot:document.getElementById("hud"),screenRoot:document.getElementById("screens"),profile:q0});px.navigate(dx(q0));be.music.play();const ux=document.getElementById("boot");requestAnimationFrame(()=>ux.classList.add("hidden"));
