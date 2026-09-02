import{C as ce,I as Me,l as xl,a as Tt,b as Ce,c as Ba,L as ko,d as Ee,t as Xa,R as Gs,e as vl,V as fe,f as ee,S as nh,g as Ae,M as V,h as qe,i as rt,B as yc,j as S,k as Da,m as Pn,n as st,o as kl,p as Ni,G as le,P as wo,q as K,r as gt,s as sh,u as $n,O as Ml,Z as xc,A as ni,v as Nm,w as z0,N as Lm,x as El,y as P0,z as $0,D as ih,E as na,F as ea,H as St,J as $a,K as Ne,Q as be,T as Zn,U as Dm,W as Hm,X as et,Y as _m,_ as zm,$ as B0,a0 as Pm,a1 as U0,a2 as vc,a3 as Tl,a4 as $m,a5 as Bm,a6 as Um,a7 as zt,a8 as rh,a9 as q0,aa as qm,ab as jm,ac as ht,ad as j0,ae as Wm,af as W0,ag as Gm,ah as Ym,ai as Ys,aj as kc,ak as Mc,al as Bn,am as Vm,an as mn,ao as ir,ap as Km,aq as Xm,ar as rr,as as Ec,at as Sl,au as Zm,av as si,aw as Jm,ax as Qm,ay as Al,az as eg,aA as Rl,aB as tg,aC as ag,aD as og,aE as ng,aF as ii,aG as Il,aH as sg,aI as ig,aJ as rg,aK as lg,aL as lh,aM as ct,aN as nn,aO as Li,aP as ot,aQ as po,aR as hh,aS as ch,aT as Di,aU as Mo,aV as dh,aW as Oa,aX as Pt,aY as Eo,aZ as G0,a_ as ph,a$ as Ua,b0 as hg,b1 as cg,b2 as ro,b3 as dg,b4 as pg,b5 as ug,b6 as Tc,b7 as gn,b8 as ri,b9 as fg,ba as lr,bb as mg,bc as gg,bd as wg,be as bg,bf as yg,bg as xg,bh as vg,bi as Sc,bj as kg,bk as Mg,bl as Eg,bm as Tg,bn as hr,bo as Sg,bp as Ag,bq as Rg,br as Ig,bs as Og,bt as Cg}from"./kitchen-C7R9kcqx.js";const Gt=6,nt=2;function Fg(t){return t===0?"player":"enemy"}function Ng(t){return 1<<t}const li=-1;function Lg(t,e){if(t.length>Tt)throw new RangeError(`createFighter: slot ${e} was handed ${t.length} items and the game has ${Tt} equip slots (rules.ts:ITEM_SLOTS — Uri: "up to 2 items per player")`);for(const a of t)if(!(a in Ce))throw new RangeError(`createFighter: slot ${e} was handed an unknown item id "${a}" (see rules.ts:ITEMS)`);if(new Set(t).size!==t.length)throw new RangeError(`createFighter: slot ${e} equipped a duplicate item [${t.join(", ")}]`);return t.slice()}function Dg(t){const{id:e,controller:a,characterId:o,spawn:n,maxHp:s,size:i,hitRadius:r,facing:l}=t,h=ce[o].weapons.length,c=Ba(t.level??ko),d=Lg(t.items??[],e);return{id:e,controller:a,role:Fg(e),characterId:o,level:c,damageMul:xl(c),x:n.x,y:n.y,hp:s,maxHp:s,size:i,hitRadius:r,facing:{x:l.x,y:l.y},status:{slowedUntil:-1/0,stunnedUntil:-1/0,slowAppliedAt:-1/0,slowStacks:0,stunAppliedAt:-1/0,stunStacks:0},alive:!0,deaths:0,lastUsed:new Array(h).fill(-1/0),hazardTimers:[],fogTimer:0,regenTimer:0,trailDropTimer:0,detourSign:0,lastDamagedAt:-1/0,terrainSlowFactor:1,concealed:!1,revealedUntil:-1/0,cast:null,push:{x:0,y:0,remaining:0,speed:0},item:{equipped:d,lastUsed:new Array(d.length).fill(-1/0),sleepUntil:-1/0,clogUntil:-1/0,rootUntil:-1/0,blotUntil:-1/0,shieldUntil:-1/0,streakTarget:li,streakCount:0,streakAt:-1/0,auraTimers:[],killerId:li,revivesLeft:d.includes("leftovers")?Me.leftovers.usesPerMatch:0},itemCast:null}}function Hg(t,e){return t.item.equipped.includes(e)}function Y0(t){return t.cast!==null}function Hi(t,e){return e<t.status.stunnedUntil||t.cast!==null||t.itemCast!==null||e<t.item.sleepUntil||e<t.item.rootUntil}function zo(t,e){return e<t.item.sleepUntil}function V0(t,e){return zo(t,e)||e<t.item.clogUntil}function uh(t){let e=0;for(const a of t.fighters)a.alive&&a.hp>0&&e++;return e}function K0(t){return t==="player"?"enemy":"player"}function _i(t,e){return t!==e&&t.alive&&t.hp>0}function Jn(t,e,a){let o=null,n=1/0;for(const s of t.fighters){if(!_i(s,e)||s===a)continue;const i=Math.hypot(s.x-e.x,s.y-e.y);i<n&&(n=i,o=s)}return o}function _g(t){let e=null;for(const a of t.fighters)if(!(!a.alive||a.hp<=0)){if(e!==null)return null;e=a}return e}function Ol(t,e,a){return t*a+e}function zg(t){const e=t.get("seats");if(e!==null)return zi(Number(e))}function zi(t){if(Number.isInteger(t)&&!(t<=nt||t>Gt))return t}const Ac=Array.from({length:Gt-nt+1},(t,e)=>nt+e);function X0(t,e,a){if(!Number.isInteger(a)||a<nt||a>Gt)throw new RangeError(`brawlRoster: ${a} seats; the sim seats ${nt}..${Gt} (see state.ts MIN_FIGHTERS / MAX_FIGHTERS)`);const o=[t];a>1&&o.push(e);const n=Ee.indexOf(t);for(let s=1;o.length<a&&s<=Ee.length;s++){const i=Ee[(n+s)%Ee.length];o.includes(i)||o.push(i)}if(o.length!==a||new Set(o).size!==a)throw new RangeError(`brawlRoster: built ${o.length} seats (${new Set(o).size} distinct) for ${a} from ${Ee.length} characters — [${o.join(", ")}]`);return o}const Rc={coins:500,gems:25},Pg=!1,Z0=Ee[0],wt={trophiesWin:Xa("MATCH_PAYOUT.trophiesWin",15,{group:"economy",unit:"trophies",min:0,max:200,int:!0,doc:"Trophies for first place. The whole placement curve is stated relative to this — see the placement block below."}),trophyLossBase:Xa("MATCH_PAYOUT.trophyLossBase",2,{group:"economy",unit:"trophies",min:0,max:100,int:!0,doc:"Flat part of a loss. Loss = min(cap, base + floor(trophies / per))."}),trophyLossPer:Xa("MATCH_PAYOUT.trophyLossPer",150,{group:"economy",unit:"trophies",min:1,max:1e4,int:!0,doc:"Trophies per extra point of loss — the escalation rate. A DIVISOR: smaller is harsher."}),trophyLossCap:Xa("MATCH_PAYOUT.trophyLossCap",10,{group:"economy",unit:"trophies",min:0,max:200,int:!0,doc:"Ceiling on a single loss, however many trophies are held."}),trophyLossGraceBelow:Xa("MATCH_PAYOUT.trophyLossGraceBelow",100,{group:"economy",unit:"trophies",min:0,max:1e4,int:!0,doc:"Below this standing a loss costs nothing — the first hour must not read as standing still."}),coinsWin:Xa("MATCH_PAYOUT.coinsWin",60,{group:"economy",unit:"coins",min:0,max:1e4,int:!0,doc:"Coins for a win. The 3:1 ratio against coinsLoss is the design statement, not either number alone."}),coinsLoss:Xa("MATCH_PAYOUT.coinsLoss",20,{group:"economy",unit:"coins",min:0,max:1e4,int:!0,doc:"Coins for a loss. Always non-zero: a losing streak must not feel like a waste of ten minutes."}),winsPerChest:3,placementSteepness:1},jt={Normal:120,Rare:260,Epic:520,Legendary:900,Neon:1400,Cyber:2200},wn={baseCoins:300,growth:1.32,rarityCostMultiplier:{Normal:1,Rare:1,Epic:1,Legendary:1,Neon:1,Cyber:1},roundTo:10},ba=["chest","hamburgerBox","pineappleBox","redBox","fireBox"],J0="Rarity sets how hard a fighter is to find — not how strong it is, and not what it costs to level up. Two fighters at the same level are a fair fight whatever their rarity.",Be={chest:{name:"Chest",emoji:"📦",blurb:"Earned by winning matches and along the Trophy Road.",price:null,entries:[{weight:46,coins:120},{weight:21,coins:220},{weight:13,coins:90,gems:5},{weight:8,coins:400},{weight:4,coins:150,gems:20},{weight:2.1,characterRarity:"Normal"},{weight:.9,characterRarity:"Rare"},{weight:3,itemRarity:"Normal"},{weight:1.4,itemRarity:"Rare"},{weight:.5,itemRarity:"Epic"},{weight:.1,itemRarity:"Legendary"}]},hamburgerBox:{name:"Hamburger Box",emoji:"🍔",blurb:"Mostly Normal fighters and gear, with a chance of something rarer.",price:{coins:900,gems:60},entries:[{weight:71.2,characterRarity:"Normal"},{weight:8,characterRarity:"Rare"},{weight:.8,characterRarity:"Epic"},{weight:16,itemRarity:"Normal"},{weight:3.6,itemRarity:"Rare"},{weight:.4,itemRarity:"Epic"}]},pineappleBox:{name:"Purple Pineapple Box",emoji:"🍍",blurb:"Rare fighters and gear, Epic and Legendary possible.",price:{coins:3200,gems:120},entries:[{weight:75.6,characterRarity:"Rare"},{weight:4,characterRarity:"Epic"},{weight:.4,characterRarity:"Legendary"},{weight:16,itemRarity:"Rare"},{weight:3.6,itemRarity:"Epic"},{weight:.4,itemRarity:"Legendary"}]},redBox:{name:"Big Smile Box",emoji:"🎁",blurb:"Epic fighters and gear, with the only Cyber chance outside the Fire Box.",price:{coins:5600,gems:240},entries:[{weight:71.59,characterRarity:"Epic"},{weight:8,characterRarity:"Legendary"},{weight:.4,characterRarity:"Neon"},{weight:.01,characterRarity:"Cyber"},{weight:16,itemRarity:"Epic"},{weight:3.5,itemRarity:"Legendary"},{weight:.4,itemRarity:"Neon"},{weight:.1,itemRarity:"Cyber"}]},fireBox:{name:"Purple Fire Box",emoji:"🔥",blurb:"Legendary fighters and gear, with the best Neon and Cyber odds in the game.",price:{coins:12e3,gems:480},entries:[{weight:75.6,characterRarity:"Legendary"},{weight:4,characterRarity:"Neon"},{weight:.4,characterRarity:"Cyber"},{weight:16,itemRarity:"Legendary"},{weight:3.5,itemRarity:"Neon"},{weight:.5,itemRarity:"Cyber"}]}},$g=1e4,ma=[{trophies:30,reward:{type:"container",kind:"chest",count:1}},{trophies:65,reward:{type:"coins",amount:150}},{trophies:100,reward:{type:"character",id:"donut"}},{trophies:145,reward:{type:"bundle",parts:[{type:"gems",amount:5},{type:"itemSurprise",minRarity:"Normal"}]}},{trophies:195,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:250,reward:{type:"character",id:"taco"}},{trophies:315,reward:{type:"coins",amount:250}},{trophies:390,reward:{type:"container",kind:"chest",count:1}},{trophies:480,reward:{type:"character",id:"burrito"}},{trophies:575,reward:{type:"bundle",parts:[{type:"gems",amount:10},{type:"itemSurprise",minRarity:"Normal"}]}},{trophies:685,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:800,reward:{type:"character",id:"soup"}},{trophies:940,reward:{type:"coins",amount:400}},{trophies:1090,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:1250,reward:{type:"character",id:"sushi"}},{trophies:1420,reward:{type:"gems",amount:20}},{trophies:1595,reward:{type:"container",kind:"chest",count:1}},{trophies:1770,reward:{type:"bundle",parts:[{type:"coins",amount:700},{type:"itemSurprise",minRarity:"Rare"}]}},{trophies:1950,reward:{type:"character",id:"waterbottle"}},{trophies:2140,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:2340,reward:{type:"gems",amount:35}},{trophies:2550,reward:{type:"coins",amount:1200}},{trophies:2770,reward:{type:"container",kind:"chest",count:2}},{trophies:3e3,reward:{type:"character",id:"pizza"}},{trophies:3235,reward:{type:"container",kind:"redBox",count:1}},{trophies:3475,reward:{type:"bundle",parts:[{type:"coins",amount:1800},{type:"itemSurprise",minRarity:"Rare"}]}},{trophies:3725,reward:{type:"gems",amount:50}},{trophies:3980,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:4240,reward:{type:"coins",amount:2400}},{trophies:4500,reward:{type:"character",id:"egg"}},{trophies:4780,reward:{type:"gems",amount:70}},{trophies:5080,reward:{type:"container",kind:"redBox",count:1}},{trophies:5390,reward:{type:"bundle",parts:[{type:"coins",amount:3e3},{type:"itemSurprise",minRarity:"Epic"}]}},{trophies:5710,reward:{type:"container",kind:"chest",count:3}},{trophies:6040,reward:{type:"gems",amount:90}},{trophies:6380,reward:{type:"container",kind:"pineappleBox",count:2}},{trophies:6750,reward:{type:"character",id:"lollipop"}},{trophies:7125,reward:{type:"coins",amount:4e3}},{trophies:7510,reward:{type:"container",kind:"redBox",count:1}},{trophies:7905,reward:{type:"bundle",parts:[{type:"gems",amount:120},{type:"itemSurprise",minRarity:"Legendary"}]}},{trophies:8310,reward:{type:"coins",amount:5e3}},{trophies:8725,reward:{type:"container",kind:"fireBox",count:1}},{trophies:9145,reward:{type:"bundle",parts:[{type:"gems",amount:150},{type:"itemSurprise",minRarity:"Neon"}]}},{trophies:9565,reward:{type:"bundle",parts:[{type:"coins",amount:8e3},{type:"gems",amount:250},{type:"container",kind:"fireBox",count:1}]}},{trophies:$g,reward:{type:"character",id:"hotdog"}}],Q0=[{id:"gemsPouch",name:"Pouch of Gems",emoji:"💎",priceUsdCents:99,gems:80},{id:"gemsSack",name:"Sack of Gems",emoji:"💎",priceUsdCents:499,gems:500},{id:"gemsCrate",name:"Crate of Gems",emoji:"💎",priceUsdCents:999,gems:1200},{id:"gemsBarrel",name:"Barrel of Gems",emoji:"💎",priceUsdCents:1999,gems:2600},{id:"gemsVault",name:"Vault of Gems",emoji:"💎",priceUsdCents:4999,gems:7e3},{id:"starterBundle",name:"Chef Starter Pack",emoji:"🧑‍🍳",priceUsdCents:499,gems:500,coins:2e3,container:{kind:"pineappleBox",count:1},oneTime:!0}],Pi=(()=>{const t={};for(const e of Ee){const a=ce[e].rarity;(t[a]??=[]).push(e)}return t})(),pa=Object.keys(Ce),sn=(()=>{const t={};for(const e of pa)(t[Ce[e].rarity]??=[]).push(e);return t})(),Un=jt,Bg=(()=>{const t={};for(const[e,a]of Object.entries(jt))t[e]=a>0?1/a:0;return t})(),eu=(()=>{const t=Object.keys(jt).sort((e,a)=>jt[e]-jt[a]);for(const e of t){const a=sn[e];if(a&&a.length>0)return a[0]}throw new Error("STARTER_ITEM: rules.ts:ITEMS is empty")})();function Ug(t){let e=t>>>0;return e=Math.imul(e^e>>>16,569420461),e=Math.imul(e^e>>>15,1935289751),(e^e>>>15)>>>0}function tu(t){let e=Ug(Math.trunc(t)||0);const a=()=>{e=e+1831565813>>>0;let o=e;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296};return{next:a,int(o){return o>0?Math.floor(a()*o):0},pick(o){return o.length>0?o[Math.floor(a()*o.length)]:void 0}}}function au(t,e,a){if(e.length===0)return-1;const o=t.next()*a;let n=0;for(let s=0;s<e.length;s++)if(n+=e[s],o<n)return s;return e.length-1}function qg(t,e){if(e.length===0)return-1;let a=0;for(const o of e)a+=o>0?o:0;return a<=0?-1:au(t,e,a)}const jg=1e6;function Wg(t,e){return t+jg+e}function Gg(){return Math.floor(Math.random()*4294967295)>>>0||1}function fh(){return{coins:0,gems:0,containers:{},characters:[],items:[]}}function Vs(t,e){return e===1?t:/[sxz]$/i.test(t)?`${t}es`:`${t}s`}function ou(t,e){t.coins+=e.coins,t.gems+=e.gems;for(const[a,o]of Object.entries(e.containers))t.containers[a]=(t.containers[a]??0)+o;for(const a of e.characters)t.characters.includes(a)||t.characters.push(a);for(const a of e.items)t.items.includes(a)||t.items.push(a);return t}function Yg(t){const e=[];for(const a of t.characters)e.push({emoji:ce[a].emoji,label:ce[a].name});for(const[a,o]of Object.entries(t.containers)){if(!o)continue;const n=Be[a];e.push({emoji:n.emoji,label:o>1?`${o} ${Vs(n.name,o)}`:n.name})}t.coins>0&&e.push({emoji:"🪙",label:`${t.coins.toLocaleString()} ${Vs("Coin",t.coins)}`}),t.gems>0&&e.push({emoji:"💎",label:`${t.gems.toLocaleString()} ${Vs("Gem",t.gems)}`});for(const a of t.items)e.push({emoji:Vg,label:Ce[a].name});return e}const Vg="🎁";function $i(t){return t.reduce((e,a)=>e+a.weight,0)}function qn(t){const e=Be[t],a=$i(e.entries);if(a<=0)return[];const o=[];for(const s of e.entries){const i=s.weight/a*100;if(s.characterRarity){const r=Pi[s.characterRarity]??[];o.push({label:`${s.characterRarity} fighter`,percent:i,rarity:s.characterRarity,pool:r})}else if(s.itemRarity){const r=sn[s.itemRarity]??[];r.length===0?o.push({label:`${Un[s.itemRarity].toLocaleString()} coins`,percent:i}):o.push({label:`${s.itemRarity} item`,percent:i,rarity:s.itemRarity,itemPool:r})}else{const r=[];s.coins&&r.push(`${s.coins.toLocaleString()} coins`),s.gems&&r.push(`${s.gems.toLocaleString()} gems`),o.push({label:r.join(" + ")||"Nothing",percent:i})}}const n=new Map;for(const s of o){const i=n.get(s.label);i?i.percent+=s.percent:n.set(s.label,{...s})}return[...n.values()].sort((s,i)=>i.percent-s.percent)}function Ks(t){return`${t.toFixed(4).replace(/0+$/,"").replace(/\.$/,"")}%`}function Kg(t,e,a,o){const n=Be[t],s=$i(n.entries),i=n.entries[au(e,n.entries.map(l=>l.weight),s)],r=fh();if(!i)return{kind:t,reward:r};if(i.coins&&(r.coins+=i.coins),i.gems&&(r.gems+=i.gems),i.characterRarity){const l=Pi[i.characterRarity]??[],h=l.filter(c=>!a.has(c));if(h.length>0){const c=e.pick(h);r.characters.push(c)}else{const c=e.pick(l);if(r.coins+=jt[i.characterRarity],c)return{kind:t,reward:r,duplicateOf:c}}}if(i.itemRarity){const l=sn[i.itemRarity]??[],h=l.filter(c=>!o.has(c));if(h.length>0){const c=e.pick(h);r.items.push(c)}else{const c=e.pick(l);if(r.coins+=Un[i.itemRarity],c)return{kind:t,reward:r,duplicateItemOf:c}}}return{kind:t,reward:r}}function nu(t){return jt[ce[t].rarity]}function Xg(t){return t<wt.trophyLossGraceBelow?0:Math.min(wt.trophyLossCap,wt.trophyLossBase+Math.floor(t/wt.trophyLossPer))}function Bi(t,e){if(!Number.isInteger(e)||e<nt||e>Gt)throw new RangeError(`placementRank01: ${e} seats; the sim seats ${nt}..${Gt} (see game/state.ts MIN_FIGHTERS / MAX_FIGHTERS)`);if(!Number.isInteger(t)||t<0||t>=e)throw new RangeError(`placementRank01: place ${t} is outside 0..${e-1}`);return t/(e-1)}function mh(t,e=wt.placementSteepness){return t<=0?0:t>=1?1:Math.pow(t,e)}function Zg(t,e,a,o){const n=mh(Bi(t,e),o),s=wt.trophiesWin+Xg(a);return Math.round(wt.trophiesWin-n*s)}function Jg(t,e,a){const o=mh(Bi(t,e),a);return Math.round(wt.coinsWin-o*(wt.coinsWin-wt.coinsLoss))}function Qg(t,e){return Bi(t,e)<.5}function ew(){return ma}function Cl(){return ma.length>0?ma[ma.length-1].trophies:0}function su(t,e){return ma.filter(a=>t>=a.trophies&&!e.includes(a.trophies))}function tw(t){return ma.find(e=>t<e.trophies)??null}function iu(t){const e=tw(t);if(!e)return{from:Cl(),to:Cl(),progress01:1,next:null};const a=ma.indexOf(e),o=a>0?ma[a-1].trophies:0,n=e.trophies-o,s=n>0?Math.min(1,Math.max(0,(t-o)/n)):0;return{from:o,to:e.trophies,progress01:s,next:e}}function aw(t){const e=Gs.indexOf(t);if(e<0)return[];const a=[];for(let o=e;o<Gs.length;o++)a.push(...sn[Gs[o]]??[]);return a}function ow(t,e,a,o){const n=aw(t),s=n.filter(c=>!o.has(c)),i=s.length>0?s:n,r=tu(Wg(e,a)),l=qg(r,i.map(c=>Bg[Ce[c].rarity]));if(l<0)return{item:null,coins:Un[t],duplicateOf:null};const h=i[l];return s.length>0?{item:h,coins:0,duplicateOf:null}:{item:null,coins:Un[Ce[h].rarity],duplicateOf:h}}function ru(t,e,a){const o=fh();switch(t.type){case"coins":o.coins+=t.amount;break;case"gems":o.gems+=t.amount;break;case"container":o.containers[t.kind]=(o.containers[t.kind]??0)+t.count;break;case"character":o.coins+=nu(t.id);break;case"bundle":for(const n of t.parts)ou(o,ru(n,e,a));break;case"itemSurprise":{const n=ow(t.minRarity,e.seed,a,e.items);n.item?o.items.push(n.item):o.coins+=n.coins;break}}return o}function nw(t,e){return ru(t.reward,e,t.trophies)}function Fl(t,e){switch(t.type){case"coins":return{emoji:"🪙",title:`${t.amount.toLocaleString()} Coins`,isCharacter:!1};case"gems":return{emoji:"💎",title:`${t.amount.toLocaleString()} Gems`,isCharacter:!1};case"container":{const a=Be[t.kind];return{emoji:a.emoji,title:t.count>1?`${t.count} ${Vs(a.name,t.count)}`:a.name,isCharacter:!1}}case"character":{const a=ce[t.id],o=Pg;return{emoji:a.emoji,title:a.name,isCharacter:!0,payoutNote:o?void 0:`owned · 🪙 ${nu(t.id).toLocaleString()}`}}case"bundle":return{emoji:"🎉",title:"Grand Prize",isCharacter:!1};case"itemSurprise":return{emoji:"🎁",title:"Mystery Item",isCharacter:!1,payoutNote:`${t.minRarity} or better`}}}function sw(t,e){const a=Ba(e);if(a>=vl)return null;const o=a-ko,n=wn.baseCoins*Math.pow(wn.growth,o)*wn.rarityCostMultiplier[ce[t].rarity];return{coins:Math.round(n/wn.roundTo)*wn.roundTo,gems:0}}function lu(t){return Ba(t)}function iw(){return Q0}function rw(t){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(t/100)}function Ic(t){return t.priceUsdCents>0?t.gems/(t.priceUsdCents/100):0}function lw(t){const e=Q0.filter(n=>!n.oneTime&&n.gems>0),a=e.reduce((n,s)=>s.priceUsdCents<n.priceUsdCents?s:n,e[0]);if(!a||t.id===a.id)return 0;const o=Ic(t)/Ic(a);return Math.max(0,Math.round((o-1)*100))}function hu(){const t={};for(const e of ba)t[e]=0;return t}function cu(t=Gg()){return{trophies:0,bestTrophies:0,coins:Rc.coins,gems:Rc.gems,containers:hu(),claimed:[],unlocked:[Z0],items:[eu],winsTowardChest:0,lastMatch:null,levels:{},seed:t,rolls:0}}function gh(t){return new Set(Ee)}function hw(t,e){return!0}function hi(t){return new Set(t.items)}function cw(t){return{characters:gh(),items:hi(t),seed:t.seed}}function du(t,e){t.coins+=e.coins,t.gems+=e.gems;for(const[a,o]of Object.entries(e.containers))t.containers[a]=(t.containers[a]??0)+(o??0);for(const a of e.characters)t.unlocked.includes(a)||t.unlocked.push(a);for(const a of e.items)t.items.includes(a)||t.items.push(a)}function Nl(t,e,a){return t.coins<e||t.gems<a?!1:(t.coins-=e,t.gems-=a,!0)}function dw(t,e,a){const o=Zg(e,a,t.trophies);t.trophies=Math.max(0,t.trophies+o),t.bestTrophies=Math.max(t.bestTrophies,t.trophies);const n=Jg(e,a);t.coins+=n;let s=0;if(Qg(e,a)){for(t.winsTowardChest++;t.winsTowardChest>=wt.winsPerChest;)t.winsTowardChest-=wt.winsPerChest,s++;t.containers.chest+=s}const i={won:e===0,trophies:o,coins:n,chests:s,place:e,seats:a,seen:!1};return t.lastMatch=i,i}function pw(t){return Math.max(0,wt.winsPerChest-t.winsTowardChest)}function pu(t){return su(t.trophies,t.claimed)}function uu(t,e){const a=su(t.trophies,t.claimed).find(n=>n.trophies===e);if(!a)return null;const o=nw(a,cw(t));return t.claimed.push(e),t.claimed.sort((n,s)=>n-s),du(t,o),o}function uw(t){const e=fh();for(const a of pu(t)){const o=uu(t,a.trophies);o&&ou(e,o)}return e}function fw(t,e){if((t.containers[e]??0)<=0)return null;t.containers[e]--;const a=tu(t.seed+t.rolls);t.rolls++;const o=Kg(e,a,gh(),hi(t));return du(t,o.reward),o}function mw(t){return ba.reduce((e,a)=>e+(t.containers[a]??0),0)}function gw(t,e,a){const o=Be[e].price;return!o||!(a==="coins"?Nl(t,o.coins,0):Nl(t,0,o.gems))?!1:(t.containers[e]++,!0)}function wh(t,e){return Ba(t.levels[e]??ko)}function bh(t,e){return sw(e,wh(t,e))}function ww(t,e){const a=bh(t,e);return a!==null&&t.coins>=a.coins&&t.gems>=a.gems}function bw(t,e){const a=bh(t,e);if(!a||!Nl(t,a.coins,a.gems))return null;const o=Ba(wh(t,e)+1);return t.levels[e]=o,{level:o,spent:a}}function yw(t){const e=cu();if(!t||typeof t!="object")return e;const a=t,o=(s,i)=>typeof s=="number"&&Number.isFinite(s)&&s>=0?Math.floor(s):i,n={trophies:o(a.trophies,0),bestTrophies:o(a.bestTrophies,0),coins:o(a.coins,e.coins),gems:o(a.gems,e.gems),containers:hu(),claimed:[],unlocked:[Z0],items:[eu],winsTowardChest:o(a.winsTowardChest,0),lastMatch:null,levels:{},seed:o(a.seed,e.seed)||e.seed,rolls:o(a.rolls,0)};if(a.containers&&typeof a.containers=="object"){const s=a.containers;for(const i of ba)n.containers[i]=o(s[i],0)}if(Array.isArray(a.claimed)){const s=new Set(ma.map(r=>r.trophies)),i=new Set(a.claimed.filter(r=>typeof r=="number"&&s.has(r)));n.claimed=[...i].sort((r,l)=>r-l)}if(Array.isArray(a.unlocked))for(const s of a.unlocked)typeof s=="string"&&Ee.includes(s)&&!n.unlocked.includes(s)&&n.unlocked.push(s);if(Array.isArray(a.items))for(const s of a.items)typeof s=="string"&&pa.includes(s)&&!n.items.includes(s)&&n.items.push(s);if(a.levels&&typeof a.levels=="object"){const s=a.levels;for(const i of Ee){const r=s[i];if(typeof r!="number"||!Number.isFinite(r))continue;const l=Ba(r);l>ko&&(n.levels[i]=l)}}if(a.lastMatch&&typeof a.lastMatch=="object"){const s=a.lastMatch,i=s.won===!0,r=Number.isInteger(s.seats)&&s.seats>=nt&&s.seats<=Gt?s.seats:nt,l=Number.isInteger(s.place)&&s.place>=0&&s.place<r?s.place:i?0:r-1;n.lastMatch={won:l===0,trophies:typeof s.trophies=="number"&&Number.isFinite(s.trophies)?Math.trunc(s.trophies):0,coins:o(s.coins,0),chests:o(s.chests,0),place:l,seats:r,seen:s.seen===!0}}return n.bestTrophies=Math.max(n.bestTrophies,n.trophies),n}function xw(t){return{trophies:t.trophies,bestTrophies:t.bestTrophies,coins:t.coins,gems:t.gems,containers:{...t.containers},claimed:[...t.claimed],unlocked:[...t.unlocked],items:[...t.items],winsTowardChest:t.winsTowardChest,lastMatch:t.lastMatch?{...t.lastMatch}:null,levels:{...t.levels},seed:t.seed,rolls:t.rolls}}function vw(t,e){typeof e.coins=="number"&&Number.isFinite(e.coins)&&e.coins>=0&&(t.coins=Math.floor(e.coins)),typeof e.gems=="number"&&Number.isFinite(e.gems)&&e.gems>=0&&(t.gems=Math.floor(e.gems))}const fu="food-arena.profile.v1",Dn=250,Oc=100,kw=35;function mu(t,e){const a=mh(Bi(t,e));return Math.round(Oc-a*(Oc-kw))}const Ll="Chef",Dl=16;function gu(t){if(typeof t!="string")return Ll;const e=t.replace(/\s+/g," ").replace(/[\p{Cc}\p{Cf}]/gu,"").trim().slice(0,Dl).trim();return e.length>0?e:Ll}function Mw(t){return typeof t=="string"&&Ee.includes(t)}function cr(t,e){return typeof t=="number"&&Number.isFinite(t)&&t>=0?t:e}function Cc(){return{name:Ll,wins:0,losses:0,xp:0,selected:Ee[0],economy:cu()}}function Fc(){try{const t=localStorage.getItem(fu);if(!t)return Cc();const e=JSON.parse(t),a=yw(e.economy);return e.economy===void 0&&vw(a,e),{name:gu(e.name),wins:Math.floor(cr(e.wins,0)),losses:Math.floor(cr(e.losses,0)),xp:Math.floor(cr(e.xp,0)),selected:Mw(e.selected)?e.selected:Ee[0],economy:a}}catch{return Cc()}}class wu{data;listeners=new Set;constructor(e){this.data=e?{...Fc(),...e}:Fc()}get name(){return this.data.name}get wins(){return this.data.wins}get losses(){return this.data.losses}get xp(){return this.data.xp}get selected(){return this.data.selected}get level(){return Math.floor(this.data.xp/Dn)+1}get levelProgress01(){return this.data.xp%Dn/Dn}get economy(){return this.data.economy}get coins(){return this.data.economy.coins}get gems(){return this.data.economy.gems}get trophies(){return this.data.economy.trophies}get bestTrophies(){return this.data.economy.bestTrophies}get containers(){return this.data.economy.containers}get containerCount(){return mw(this.data.economy)}get winsToNextChest(){return pw(this.data.economy)}get lastMatch(){return this.data.economy.lastMatch}get unlocked(){return gh(this.data.economy)}isUnlocked(e){return hw(this.data.economy)}get claimable(){return pu(this.data.economy)}select(e){this.data.selected!==e&&(this.data.selected=e,this.commit())}setName(e){const a=gu(e);return a===this.data.name||(this.data.name=a,this.commit()),a}recordPlacement(e,a){const o=dw(this.data.economy,e,a);return o.won?this.data.wins++:this.data.losses++,this.data.xp+=mu(e,a),this.commit(),o}recordResult(e){return this.recordPlacement(e?0:1,nt)}markLastMatchSeen(){const e=this.data.economy.lastMatch;!e||e.seen||(e.seen=!0,this.commit())}claimMilestone(e){const a=uu(this.data.economy,e);return a&&this.commit(),a}claimAllMilestones(){const e=uw(this.data.economy);return this.commit(),e}openContainer(e){const a=fw(this.data.economy,e);return a&&this.commit(),a}buyContainer(e,a){const o=gw(this.data.economy,e,a);return o&&this.commit(),o}characterLevel(e){return wh(this.data.economy,e)}nextLevelPrice(e){return bh(this.data.economy,e)}canLevelUp(e){return ww(this.data.economy,e)}levelUp(e){const a=bw(this.data.economy,e);return a&&this.commit(),a}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}commit(){try{localStorage.setItem(fu,JSON.stringify({name:this.data.name,wins:this.data.wins,losses:this.data.losses,xp:this.data.xp,selected:this.data.selected,economy:xw(this.data.economy)}))}catch{}for(const e of this.listeners)e()}}const Ew="fa-screen-styles";function ya(t,e){if(document.getElementById(t))return;const a=document.createElement("style");a.id=t,a.textContent=e,document.head.appendChild(a)}function Tw(){ya(Ew,Sw)}function bu(t,e){const a=t.replace("#",""),o=a.length===3?a.split("").map(r=>r+r).join(""):a,n=parseInt(o.slice(0,2),16)||0,s=parseInt(o.slice(2,4),16)||0,i=parseInt(o.slice(4,6),16)||0;return`rgba(${n},${s},${i},${e})`}const Sw=`
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
/* ── ONE HUE FAMILY, AND IT USED TO BE THREE ──────────────────────────────────
   WAS: radial #FFD98C, ramp #F4A300 -> #E85D2C -> #C1272D, base #C1272D.
   Kept above the change per house style, because the VALUE structure below is
   unchanged and was not the problem.

   Those four stops sit at hue 39 / 40 / 17 / 358 degrees. That is a 42-degree arc
   that crosses THREE of the 30-degree bins pc_pal's hue statistics count in, and
   this is the backdrop of EVERY menu — the shell paints it once and never repaints
   it, so it is the largest single chromatic surface in the product. Uri, item 3:
   "nothing leads and nothing recedes."

   Measured on the character-select page (pc_pal --conc, 320x180, loud gate
   s >= 0.60), against the 13 reference menu plates:

                        ours     plates
     LOUD effHues       5.39      3.27      how many hues share the accent budget
     LOUD top1 share    34.8%     64.6%     how much the leading hue leads by
     LOUD R             0.283     0.590     circular concentration, 1 = one hue
     loud area          61.6%     57.9%

   🚨 THE LAST ROW IS WHY THIS RAMP IS STILL SATURATED. We are within 4 pp of the
   plates on HOW MUCH of the frame is loud and at HALF their concentration — so the
   defect is WHERE the saturation is spread, not how much of it there is.
   Desaturating this would have "fixed" the row that was never broken, and
   CLAUDE.md's art direction has falsified desaturation as a remedy five times.
   So the stops keep their saturation and their value and give up only their SPREAD:
   every one now sits inside ONE 30-degree bin.

   WHICH BIN IS NOT A FREE CHOICE, AND THE FIRST ATTEMPT PICKED THE WRONG ONE.
   Round 1 of this change moved the ramp to hue 20-32 -- the 0-30 bin -- on the
   reasoning that the page's chroma-weighted mean hue reads 20 degrees, so that
   must be where the mass is. It is not, and dumping the LOUD bin histogram
   instead of the mean said so immediately. Character-select, chroma-weighted
   share of the loud budget, before -> after that attempt:

       0- 30 deg    22.4%  ->  28.8%
      30- 60 deg    34.9%  ->  29.2%     <- the leader, and it was being drained
     180-210 deg    23.9%  ->  23.0%     <- the 3D stage, deliberately a second family

   The backdrop had been straddling both warm bins, and moving all of it into the
   SMALLER one levelled them: top1 fell 34.9% -> 29.2% and effHues rose 5.21 ->
   5.30, both well outside their floors, on a change whose whole purpose was to
   move them the other way. A mean hue is a vector average over a bimodal
   distribution and it lands in the trough between the two modes -- it points at
   where there is LEAST, and reading it as "where the mass is" is what picked the
   losing bin. The histogram is one extra line of output and it is the only form
   of this statistic worth acting on.

   So: hue 36-40, the 30-60 bin, consolidating the warm family into the bin that
   already led it rather than splitting it into two equal ones.

   ⚠️ THE FRAME HAS TWO FAMILIES ON PURPOSE AND WILL NOT REACH THE PLATES' 64.6%.
   The 180-210 band is the lobby stage, made cool in the commit before this one so
   the warm hero reads against it -- that is the same figure/ground separation
   LESSONS §13 paid for, and spending it to win a hue statistic would be trading a
   defect Uri can see for a number he cannot. What IS available is fam2, the two
   ADJACENT bins that make one family: 57.3% of the loud budget is already warm,
   and consolidating it is what this stop list is for.

   ⚠️ FLOORS, from a null arm — the same tree captured on two page loads:
   LOUD effHues +/-0.02, LOUD top1 +/-0.2 pp, LOUD R +/-0.004, loud area +/-0.6 pp,
   ALL R +/-0.017. The ALL:R floor is the loose one and a move in it under ~0.02 is
   not a move.

   NOTE, no backticks anywhere above: this whole stylesheet is ONE TypeScript template
   literal, so a backtick in a CSS comment closes it and the file stops parsing. tsc
   reported it as three syntax errors 100 lines away. menu_accept parses all 88 modules
   on every run specifically to catch this. */
.fa-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% -8%, #FFD98C 0%, transparent 46%),
    linear-gradient(160deg, #F4A300 0%, #E89D2C 45%, #C18327 100%);
  background-color: #C18327;
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
/* ⚠️ 'display: flex' IS A FIX, NOT A TIDY-UP, AND IT MAKES AN EXISTING DECLARATION WORK.
   'home.ts' has carried '.fa-home .fa-tab { justify-content: center }' since the tab bar
   was written, and it has been INERT the whole time: a <button> lays its content out as
   an inline flow, not as a flex container, so 'justify-content' applies to nothing and
   the centring you see is the UA's 'text-align: center'. The difference shows up the
   moment the content does not fit — an inline flow WRAPS, so at 390px the trophy glyph
   took line 1 and the word "Trophies" took line 2, and the one tab that did it lost the
   bar's baseline while its three neighbours kept it.

   Flex + 'white-space: nowrap' makes the icon and the label one unbreakable run, so the
   failure mode under pressure becomes "the label shrinks" (handled at the call site with
   a vw-aware font-size) instead of "the label falls under its own icon". 'gap' also
   replaces the literal space character between the glyph and the word in the markup,
   which was the only thing setting that distance and was not tunable at all. */
.fa-tab {
  appearance: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  min-width: 0;
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
/* 'display: block' for the reason recorded in full on '.ds-bar' below: a track that
   states a height and a fill that states 'height: 100%' are both discarded on an inline
   box, and every current caller only survives by being a flex item. */
.fa-level-track {
  display: block;
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
  display: block;
  height: 100%;
  border-radius: var(--ds-r-pill);
  background: repeating-linear-gradient(45deg, var(--lettuce) 0 10px, #9BE03A 10px 20px);
  transition: width 0.4s ease-out;
}
/* 🚨 'white-space: nowrap', AND THIS ONE SHIPPED BROKEN RATHER THAN LATENT.
   The caption is 'position: absolute; inset: 0' inside a track with 'overflow: hidden',
   so when it wraps the second line is CLIPPED and the first is clipped through its
   middle. 'git log f5a6229' defect 3: lifting the level labels 9.92 -> 11.04px took
   ~10px off the track between them and this caption wrapped inside a 14px bar at
   852x480. 'home.ts' paid for it by deleting its trailing "Lv 18" label -- a screen
   deleting information to work around a missing declaration in the shared layer.
   Measured with 'tools/tmp/dc_guard.mjs' on a track derived 12px narrower than the run
   needs: 2 line boxes, 26px of text in a 20px track. With nowrap, 1 line box.
   ⚠️ Blast radius is bounded BY CONSTRUCTION, not by hope: the element is out of flow
   and its parent clips, so nothing outside the track can move. 'da_census' confirms it
   on the two unowned screens that render this class. */
.fa-level-xp {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
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
/* 'display: block' on both, for the reason recorded in full on '.ds-bar' below. */
.fa-stat-track {
  display: block;
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
  display: block;
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
/* 🚨 'display: block' IS LOAD-BEARING ON BOTH THE TRACK AND THE FILL.
   A track states a 'height' and a fill states 'height: 100%' plus a caller-supplied
   width, and an INLINE box silently discards all three. Measured on the pre-fix sheet
   with 'tools/tmp/dc_guard.mjs', mounting the component as a '<span>' inside an
   ordinary block parent -- which is exactly how 'home.ts' writes it:

     .ds-bar--sm   track  4px wide in a 280px parent, computed height 14px, RENDERED 28
     .ds-bar       track  6px wide in a 280px parent, computed height 22px, RENDERED 30
     the fill      0px wide in a 0px inner track, in every case

   Every caller TODAY happens to be a flex ITEM, which blockifies it, so the track has
   never been seen broken -- but the FILL is not a flex item, and it shipped as an empty
   track on home's road card the first time '.ds-bar' was adopted ('git log f5a6229',
   defect 1). 'menu_accept' and 'ud_defects' both passed it; it was found by reading a
   PNG. A component that only works inside a flex parent is a trap, not a component.
   ⚠️ This is computed-NEUTRAL on every current caller: a flex item's computed 'display'
   is already 'block', and every fill in the tree is a '<div>' or carries its own
   'display: block'. Proven with 'da_census' over 70 properties on all five screens. */
.ds-bar {
  display: block;
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
  display: block;
  height: 100%;
  border-radius: var(--ds-r-pill);
  background: var(--ds-bar-ink, var(--lettuce));
  /* The top-light that makes a fill read as a lozenge rather than a flat block.
     Same idiom as '.fa-stat-fill', hoisted so every bar gets it. */
  background-image: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%);
  transition: width 0.4s ease-out;
}
/* The numeric readout INSIDE the track. A bar with no number is a decoration, and a
   critic called ours "invisible for what is core progression" when it had none.
   ⚠️ 'white-space: nowrap' is the same defect as the fill's 'display', one component
   over: see '.fa-level-xp' above, where it shipped rather than stayed latent. */
.ds-bar-cap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
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
`,Aw=3101286,yu="#2f5266",Rw="#2E4E60",Iw="#284053",Nc="#3F5462",Ow="#6D8290",Cw="#9FB1BE",bn=5,yn=14,dr=-.6,Fw=[[-.6,.86],[0,.88],[1.2,.94],[2.6,1.02],[3.8,1.16],[8,1.4],[14,1.55]],Lc=1.3,Nw=.52,Dc=new fe(16.35,9.82,4.69).normalize(),Lw=[[0,.58],[1.5,.62],[2.6,.88],[3.8,1.16],[4.7,1.36],[6.4,1.42]],xn=.24,vn=.215,Hc=.62,Dw=2.48,Hw=.86;function _c(t,e){if(e<=t[0][0])return t[0][1];const a=t[t.length-1];if(e>=a[0])return a[1];for(let o=1;o<t.length;o++){const[n,s]=t[o],[i,r]=t[o-1];if(e>n)continue;const l=(e-i)/Math.max(1e-6,n-i);return r+(s-r)*(l*l*(3-2*l))}return a[1]}function _w(t,e=128){const a=document.createElement("canvas");a.width=e,a.height=e;const o=a.getContext("2d");if(o){const s=o.createRadialGradient(e/2,e/2,0,e/2,e/2,e/2),[i,r,l]=t,h=c=>`rgb(${Math.round(i+(255-i)*c)},${Math.round(r+(255-r)*c)},${Math.round(l+(255-l)*c)})`;s.addColorStop(0,h(0)),s.addColorStop(.54,h(.1)),s.addColorStop(.8,h(.58)),s.addColorStop(1,"rgb(255,255,255)"),o.fillStyle=s,o.fillRect(0,0,e,e)}const n=new st(a);return n.colorSpace=Lm,n.wrapS=El,n.wrapT=El,n}function zc(t,e,a){const o=new K({map:_w(e),blending:z0,blendEquation:ni,blendSrc:xc,blendDst:Nm,blendEquationAlpha:ni,blendSrcAlpha:xc,blendDstAlpha:Ml,transparent:!0,depthWrite:!1,toneMapped:!1}),n=new S(new wo(t,t),o);return n.rotation.x=-Math.PI/2,n.renderOrder=a,n.userData.noOutline=!0,n}const ia={counterBody:"#123A50",counterTop:"#A8641F",counterLip:"#D08A2E",shelf:"#7A431A",steel:"#24485C",jars:["#B02733","#4E8A12","#C99414","#1668A8","#6B3AA8","#B85A18","#2E8C6A","#C4553C"]};class ci{stage;holder=document.createElement("div");model=null;currentId=null;subjectW=ee*.8;subjectH=ee;elapsed=0;introT=0;observer=null;footShadow=null;disposed=!1;dressing=null;constructor(){this.holder.style.cssText="position:absolute;inset:0;",this.stage=new nh({container:this.holder,background:Aw,fog:null,camera:{pitchDeg:20,yawDeg:0,frameMode:"subject",subjectHeight:ee,subjectFill:.6,targetHeight:ee*.52,followLerp:1},budget:"menu",maxPixelRatio:2}),this.stage.canvas.style.cssText="display:block;width:100%;height:100%;",this.buildSet(),this.stage.rig.snapTo(0,0),this.stage.lighting.focus(0,0,6)}buildSet(){const e=new Ae(bn,bn,yn,72,28,!0);this.paintVertexRamp(e,(f,g,w)=>{const b=V.clamp(-(f*Dc.x+w*Dc.z)/bn,0,1);return _c(Fw,g+yn/2+dr)*(Lc+(Nw-Lc)*b)});const a=qe({color:Rw,ramp:rt(),roughness:.9,rim:!1});a.side=yc,a.vertexColors=!0;const o=new S(e,a);o.position.y=yn/2+dr,o.receiveShadow=!0,o.userData.noOutline=!0,o.name="menu_wall",o.renderOrder=-1,this.stage.scene.add(o);const n=new Da(0,6.4,96,32);this.paintVertexRamp(n,(f,g)=>_c(Lw,Math.hypot(f,g)));const s=qe({color:Iw,ramp:rt(),roughness:.86,rim:!1});s.vertexColors=!0;const i=new S(n,s);i.rotation.x=-Math.PI/2,i.receiveShadow=!0,i.userData.noOutline=!0,i.name="menu_ground",this.stage.scene.add(i);const r=zc(5.4,[18,32,160],1);r.position.y=.012,r.name="menu_ground_decal",this.stage.scene.add(r);const l=new S(new Ae(1.15,1.24,.18,48),qe({color:Nc,ramp:rt(),roughness:.72}));l.position.y=.09,l.castShadow=!0,l.receiveShadow=!0,l.userData.noOutline=!0,l.name="menu_plinth_body",this.stage.scene.add(l);const h=qe({color:Ow,ramp:rt(),roughness:.55}),c=new S(new Ae(1.21,1.19,.06,48,1,!0),h);c.position.y=xn-.03,c.castShadow=!0,c.receiveShadow=!0,c.userData.noOutline=!0,c.name="menu_plinth_rim",this.stage.scene.add(c);const d=new S(new Da(1.1,1.21,48),h);d.rotation.x=-Math.PI/2,d.position.y=xn,d.receiveShadow=!0,d.userData.noOutline=!0,d.name="menu_plinth_rim_top",this.stage.scene.add(d);const p=new S(new Ae(1.1,1.1,xn-vn,48,1,!0),qe({color:Nc,ramp:rt(),roughness:.8,doubleSide:!0}));p.position.y=(xn+vn)/2,p.receiveShadow=!0,p.userData.noOutline=!0,p.name="menu_plinth_recess",this.stage.scene.add(p);const u=new S(new Ae(1.1,1.1,.05,48),qe({color:Cw,ramp:rt(),roughness:.45}));u.position.y=vn-.025,u.receiveShadow=!0,u.userData.noOutline=!0,u.name="menu_plinth_top",this.stage.scene.add(u);const m=zc(1.9,[58,64,72],2);m.position.y=vn+.004,m.scale.set(1,1,.72),m.name="menu_foot_decal",this.footShadow=m,this.stage.scene.add(m)}paintVertexRamp(e,a){const o=e.attributes.position,n=new Float32Array(o.count*3);for(let s=0;s<o.count;s++){const i=a(o.getX(s),o.getY(s),o.getZ(s));n[s*3]=i,n[s*3+1]=i,n[s*3+2]=i}e.setAttribute("color",new Pn(n,3))}applyFraming(){const e=this.stage.rig.camera,a=e.aspect>0&&Number.isFinite(e.aspect)?e.aspect:1,o=Math.max(.5,this.subjectH)+xn,n=Math.max(.5,this.subjectW,Dw),s=Hw*a*o/n;this.stage.rig.subjectHeight=o,this.stage.rig.subjectFill=V.clamp(Math.min(Hc,s),.2,Hc),this.stage.rig.targetHeight=o*.5,this.stage.rig.apply()}static floorGridTexture(e=256){const a=document.createElement("canvas");a.width=e,a.height=e;const o=a.getContext("2d");o&&(o.clearRect(0,0,e,e),o.strokeStyle="rgba(0,0,0,0.55)",o.lineWidth=e*.055,o.strokeRect(0,0,e,e));const n=new st(a);return n.wrapS=kl,n.wrapT=kl,n.repeat.set(22,22),n.colorSpace=Ni,n}buildDressing(){const e=new le;e.name="lobby_dressing";const a=(m,f=!1)=>(m.castShadow=f,m.receiveShadow=!0,m.userData.noOutline=!0,e.add(m),m),o=-3.35,n=7.2,s=.78,i=new S(new wo(13,13),new K({map:ci.floorGridTexture(),transparent:!0,depthWrite:!1,toneMapped:!1}));i.rotation.x=-Math.PI/2,i.position.y=.006,i.renderOrder=0,i.userData.noOutline=!0,i.name="lobby_floor_grid",e.add(i);const r=ci.floorGridTexture();r.repeat.set(26,9);const l=new S(new Ae(bn-.04,bn-.04,yn,72,1,!0),new K({map:r,side:yc,transparent:!0,depthWrite:!1,toneMapped:!1}));l.position.y=yn/2+dr,l.renderOrder=0,l.userData.noOutline=!0,l.name="lobby_wall_grid",e.add(l),a(new S(new gt(n,s,.72),qe({color:ia.counterBody,ramp:rt(),roughness:.8})),!0).position.set(0,s/2,o),a(new S(new gt(n+.12,.11,.84),qe({color:ia.counterTop,ramp:rt(),roughness:.5}))).position.set(0,s+.055,o),a(new S(new gt(n+.12,.045,.06),qe({color:ia.counterLip,ramp:rt(),roughness:.4}))).position.set(0,s+.012,o+.44),a(new S(new gt(n-.4,.13,.52),qe({color:ia.shelf,ramp:rt(),roughness:.75}))).position.set(0,2.15,o-.05);for(const m of[-2.6,2.6])a(new S(new gt(.1,.36,.1),qe({color:ia.steel,ramp:rt(),roughness:.7}))).position.set(m,2.31,o-.2);const h=new Ae(.19,.21,.44,20),c=new Ae(.21,.21,.07,20),d=qe({color:ia.steel,ramp:rt(),roughness:.45}),p=[-2.95,-2.25,-1.55,1.55,2.25,2.95,-2.6,2.6],u=[2.35,2.35,2.35,2.35,2.35,2.35,.9,.9];for(let m=0;m<p.length;m++){const f=.86+m*37%5*.09,g=u[m]+.22*f;a(new S(h,qe({color:ia.jars[m],ramp:rt(),roughness:.55}))).position.set(p[m],g,o-.02),e.children[e.children.length-1].scale.setScalar(f),a(new S(c,d)).position.set(p[m],g+.25*f,o-.02),e.children[e.children.length-1].scale.setScalar(f)}for(const m of[-1.95,1.95])a(new S(new Ae(.4,.36,.46,24),qe({color:ia.steel,ramp:rt(),roughness:.35}))).position.set(m,s+.34,o-.02),a(new S(new Ae(.44,.44,.06,24),qe({color:ia.counterLip,ramp:rt(),roughness:.3}))).position.set(m,s+.6,o-.02);return e}setScene(e){this.disposed||(e==="lobby"&&!this.dressing&&(this.dressing=this.buildDressing(),this.stage.scene.add(this.dressing)),this.dressing&&(this.dressing.visible=e==="lobby"))}attachTo(e){this.disposed||(this.holder.parentElement!==e&&e.appendChild(this.holder),this.observer?.disconnect(),this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(e),this.resize())}detach(){this.observer?.disconnect(),this.observer=null,this.holder.remove()}show(e){if(this.disposed||e===this.currentId)return;this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose()),this.model=sh(e),this.model.play("idle"),this.stage.scene.add(this.model.root);const a=new $n().setFromObject(this.model.root);if(this.subjectH=Math.max(.5,a.max.y-a.min.y),this.subjectW=2*Math.max(.25,Math.abs(a.min.x),Math.abs(a.max.x),Math.abs(a.min.z),Math.abs(a.max.z)),this.model.root.position.y=vn+.005-a.min.y,this.footShadow){const o=V.clamp(Math.max(a.max.x-a.min.x,a.max.z-a.min.z)*1.15,1,2.3);this.footShadow.scale.set(o/1.9,1,o/1.9*.72)}this.currentId=e,this.introT=.34,this.applyFraming()}poke(){this.model?.play("attack")}update(e){if(!this.disposed){if(this.elapsed+=e,this.stage.rig.yawDeg=Math.sin(this.elapsed*.42)*22,this.model){if(this.introT>0){this.introT=Math.max(0,this.introT-e);const a=1-this.introT/.34,o=Math.sin(a*Math.PI)*(1-a*.4);this.model.root.scale.setScalar(1+o*.16),this.model.root.rotation.y=(1-a)*-.9}else this.model.root.scale.setScalar(1),this.model.root.rotation.y=0;this.model.update({dt:e,elapsed:this.elapsed,moveSpeed01:0,health01:1})}this.stage.render(e)}}resize(){this.disposed||(this.stage.resize(),this.applyFraming())}info(){const e=this.stage.rig.camera,a=this.model?new $n().setFromObject(this.model.root):null,o=s=>{const i=s.clone().project(e);return{x:+(i.x*.5+.5).toFixed(3),y:+(1-(i.y*.5+.5)).toFixed(3)}},n=this.stage.rig;return{id:this.currentId,aspect:+e.aspect.toFixed(3),fill:+n.subjectFill.toFixed(3),subject:{w:+this.subjectW.toFixed(2),h:+this.subjectH.toFixed(2)},cameraOk:Number.isFinite(e.position.x)&&Number.isFinite(e.position.y),feet:a?o(new fe(0,a.min.y,0)):null,crown:a?o(new fe(0,a.max.y,0)):null,left:a?o(new fe(a.min.x,(a.min.y+a.max.y)/2,0)):null,right:a?o(new fe(a.max.x,(a.min.y+a.max.y)/2,0)):null}}dispose(){if(!this.disposed){if(this.disposed=!0,this.observer?.disconnect(),this.observer=null,this.dressing){const e=new Set,a=new Set;this.dressing.traverse(o=>{const n=o;if(n.geometry&&e.add(n.geometry),n.material)for(const s of Array.isArray(n.material)?n.material:[n.material])a.add(s)}),e.forEach(o=>o.dispose()),a.forEach(o=>o.dispose()),this.stage.scene.remove(this.dressing),this.dressing=null}this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose(),this.model=null),this.stage.dispose(),this.holder.remove()}}}let Po=null;function yh(){return Po||(Po=new ci,typeof window<"u"&&(window.__charStage=()=>Po?.info()??null)),Po}function Pc(){Po?.dispose(),Po=null}const pr=1e-4,zw=2e4;function xh(t){let e=t|0||2654435769;return()=>(e^=e<<13,e^=e>>>17,e^=e<<5,(e>>>0)/4294967296)}function xe(t,e,a){return e+t()*(a-e)}function he(t,e){return Math.pow(2,xe(t,-e,e)/1200)}const $c=new WeakMap;function Pw(t){const e=$c.get(t);if(e)return e;const a=Math.floor(t.sampleRate*2),o=t.createBuffer(1,a,t.sampleRate),n=o.getChannelData(0),s=xh(6221086);for(let i=0;i<a;i++)n[i]=s()*2-1;return $c.set(t,o),o}const Bc=new WeakMap;function $w(t,e){let a=Bc.get(t);a||(a=new Map,Bc.set(t,a));const o=Math.max(.05,Math.round(e*20)/20),n=a.get(o);if(n)return n;const s=1024,i=new Float32Array(s),r=Math.tanh(o);for(let l=0;l<s;l++){const h=l/(s-1)*2-1;i[l]=Math.tanh(o*h)/r}return a.set(o,i),i}function xu(t,e){const a=t.createWaveShaper();return a.curve=$w(t,e),a.oversample="2x",a}const Bw=.26,Uw=.19,Uc=new WeakMap;function qw(t){const e=Uc.get(t);if(e)return e;const a=t.sampleRate,o=Math.floor(a*Bw),n=t.createBuffer(2,o,a),s=Math.floor(a*.005),i=6.9078/(Uw*a);for(let h=0;h<2;h++){const c=n.getChannelData(h),d=xh(h===0?1990433:7840721);let p=0;for(let m=s;m<o;m++){const f=m-s,g=.3+.42*(f/(o-s)),w=d()*2-1;p=p*g+w*(1-g),c[m]=p*Math.exp(-i*f)}const u=h===0?[.0071,.0132,.0198,.0281,.0367,.0458]:[.0083,.0119,.0214,.0263,.0389,.0441];for(let m=0;m<u.length;m++){const f=s+Math.floor(u[m]*a);if(f>=o)continue;const g=m%2===0?1:-1;c[f]+=g*.62*Math.exp(-i*(f-s)*.55)}}let r=0;for(let h=0;h<2;h++){const c=n.getChannelData(h);for(let d=0;d<o;d++)r=Math.max(r,Math.abs(c[d]))}const l=r>0?.6/r:1;for(let h=0;h<2;h++){const c=n.getChannelData(h);for(let d=0;d<o;d++)c[d]*=l}return Uc.set(t,n),n}function jw(t){const e=t.createConvolver();return e.normalize=!1,e.buffer=qw(t),e}function vu(t,e,a){if(!t.wet||!(a>0))return;const o=t.ctx.createGain();o.gain.value=a,e.connect(o),o.connect(t.wet)}function ku(t,e,a){const o=t.createGain(),n=Math.max(5e-4,a.attack??.002),s=(a.duration-n)*Math.max(0,Math.min(.9,a.hold??0)),i=Math.max(pr*2,a.peak),r=e+a.duration;return o.gain.setValueAtTime(pr,e),o.gain.linearRampToValueAtTime(i,e+n),s>0&&o.gain.setValueAtTime(i,e+n+s),(a.curve??"exp")==="exp"?o.gain.exponentialRampToValueAtTime(pr,r):o.gain.linearRampToValueAtTime(0,r),o.gain.setValueAtTime(0,r+.001),o}function $o(t,e,a,o,n="exp"){if(typeof e=="number"){t.setValueAtTime(e,a);return}const[s,i]=e;t.setValueAtTime(s,a),n==="exp"&&s>0&&i>0?t.exponentialRampToValueAtTime(i,a+o):t.linearRampToValueAtTime(i,a+o)}function W(t,e){const{ctx:a,dest:o,when:n}=t,s=a.createBufferSource(),i=Pw(a);s.buffer=i,s.playbackRate.value=e.rate??1,e.loop&&(s.loop=!0,s.loopStart=0,s.loopEnd=i.duration);const r=Math.max(0,i.duration-(e.duration+.02)),l=e.loop?xe(t.rng,0,i.duration):xe(t.rng,0,Math.min(1.5,r)),h=ku(a,n,e),c=e.tremolo?Ww(a,n,e.duration,e.tremolo.rate,e.tremolo.depth):h;c!==h&&c.connect(h);const d=e.drive?xu(a,e.drive):c;if(d!==c&&d.connect(c),e.filter){const p=u=>{const m=a.createBiquadFilter();return m.type=e.filter,m.Q.value=u,$o(m.frequency,e.freq??1e3,n,e.duration,e.freqCurve??"exp"),m};if(e.poles===24){const u=Math.sqrt(Math.max(.1,e.q??1));s.connect(p(u)).connect(p(u)).connect(d)}else s.connect(p(e.q??1)).connect(d)}else s.connect(d);return h.connect(o),vu(t,h,e.wet??0),s.start(n,l,e.duration+.02),s.stop(n+e.duration+.02),e.duration}function X(t,e){const{ctx:a,dest:o,when:n}=t,s=ku(a,n,e);let i=s;if(e.ring!==void 0){const h=a.createGain();h.gain.value=0;const c=a.createOscillator();c.type="sine",$o(c.frequency,e.ring,n,e.duration,"exp"),c.connect(h.gain),c.start(n),c.stop(n+e.duration+.02),h.connect(s),i=h}if(e.drive){const h=xu(a,e.drive);h.connect(i),i=h}if(e.lowpass!==void 0){const h=a.createBiquadFilter();h.type="lowpass",h.Q.value=.7,$o(h.frequency,e.lowpass,n,e.duration),h.connect(i),i=h}const r=Math.max(1,Math.min(3,Math.round(e.voices??1))),l=e.detuneCents??0;for(let h=0;h<r;h++){const c=a.createOscillator();c.type=e.type??"sine";const d=r===1?0:(h/(r-1)-.5)*l,p=Math.pow(2,d/1200);if(typeof e.freq=="number"?$o(c.frequency,e.freq*p,n,e.duration,e.freqCurve??"exp"):$o(c.frequency,[e.freq[0]*p,e.freq[1]*p],n,e.duration,e.freqCurve??"exp"),r>1){const u=a.createGain();u.gain.value=1/r,c.connect(u).connect(i)}else c.connect(i);c.start(n),c.stop(n+e.duration+.02)}return s.connect(o),vu(t,s,e.wet??0),e.duration}function Ui(t,e){let a=0;for(const o of e.modes){const n=e.duration*o.decay,s=typeof e.freq=="number"?e.freq*o.ratio:[e.freq[0]*o.ratio,e.freq[1]*o.ratio];(typeof s=="number"?s:Math.max(s[0],s[1]))>zw||(a=Math.max(a,n),X(t,{type:"sine",freq:s,peak:e.peak*o.gain,attack:e.attack??.0015,duration:n,drive:e.drive,wet:e.wet}))}return a}function Ww(t,e,a,o,n){const s=Math.max(0,Math.min(1,n)),i=t.createGain();i.gain.value=1-s*.5;const r=t.createOscillator();r.type="sine",$o(r.frequency,o,e,a,"lin");const l=t.createGain();return l.gain.value=s*.5,r.connect(l),l.connect(i.gain),r.start(e),r.stop(e+a+.02),i}function Te(t,e){const a=e.freq??5e3,o=W(t,{filter:"highpass",freq:a,q:.9,peak:e.peak,attack:4e-4,duration:.007,wet:e.wet??.06});if(!e.snap)return o;const n=(e.snapMs??14)/1e3,s=X(t,{type:"triangle",freq:[e.snap,e.snap*.38],peak:e.peak*.72,attack:6e-4,duration:n,drive:2.2,wet:e.wet??.06});return G(o,s)}function Ue(t,e){const[a,o]=e.grainMs??[4,11],n=e.decay??.35,s=e.freqShift;for(let i=0;i<e.count;i++){const r=Math.pow(t.rng(),1.5)*e.spread,l=xe(t.rng,a,o)/1e3,h=e.peak*(1-r/e.spread*(1-n))*xe(t.rng,.55,1),c=s?s[0]+(s[1]-s[0])*(r/e.spread):1;W({...t,when:t.when+r},{filter:"bandpass",freq:xe(t.rng,e.freq[0],e.freq[1])*c,q:e.q??6,peak:h,attack:8e-4,duration:l,drive:e.drive,wet:e.wet})}return e.spread+o/1e3}function Cn(t,e){const a=e.rise??2.6;let o=0;for(let n=0;n<e.count;n++){const s=xe(t.rng,0,e.spread),i=xe(t.rng,e.freq[0],e.freq[1]),r=xe(t.rng,.045,.095);o=Math.max(o,s+r),X({...t,when:t.when+s},{type:"sine",freq:[i,i*a],peak:e.peak*xe(t.rng,.5,1),attack:.002,duration:r,wet:e.wet})}return o}function di(t,e){const[a,o]=e.pingMs??[7,18],n=e.bend??.92,s=Math.log2(e.freq[0]),i=Math.log2(e.freq[1]);let r=0;for(let l=0;l<e.count;l++){const h=Math.pow(t.rng(),1.6)*e.spread,c=Math.pow(2,s+(t.rng()+l*.6180339887)%1*(i-s)),d=xe(t.rng,a,o)/1e3;r=Math.max(r,h+d),X({...t,when:t.when+h},{type:"sine",freq:[c,c*n],peak:e.peak*xe(t.rng,.55,1),attack:6e-4,duration:d,wet:e.wet})}return r}function vh(t,e){const[a,o]=e.freq??[9e3,3200],n=e.duration??.11,s=e.wet??.3,i=W(t,{filter:"bandpass",freq:[a*he(t.rng,90),o*he(t.rng,90)],q:.7,peak:e.peak,attack:.0012,duration:n,wet:s}),r=W(t,{filter:"highpass",poles:24,freq:[a*.8,a*.45],q:.7,peak:e.peak*.55,attack:6e-4,duration:n*.55,wet:s}),l=e.drops??6,h=l>0?Ue(t,{count:l,spread:n*.85,grainMs:[3,9],freq:[o,a],q:5,peak:e.peak*.85,decay:.25,wet:s}):0;return G(i,r,h)}function G(...t){let e=0;for(const a of t)a>e&&(e=a);return e}const qc="fa.audio.volume",jc="fa.audio.muted",Gw=.62,Yw=20,Vw=.008,Je={Ambient:0,Normal:1,Critical:2},Kw=.11,Wc=[1,.62,.42,.3,.22],Xw=.5,kn=.7,Gc=1.2,Mu=3,Yc=new WeakMap;function Zw(t){const e=Yc.get(t);if(e)return e;const a=2048,o=new Float32Array(a);for(let n=0;n<a;n++){const s=(n/(a-1)*2-1)*Mu,i=Math.abs(s),r=i<=kn?i:kn+(Gc-kn)*Math.tanh((i-kn)/(Gc-kn));o[n]=Math.sign(s)*r}return Yc.set(t,o),o}function Jw(t,e,a=!0){const o=t.createGain();o.gain.value=1;let n=null;if(a)try{n=t.createGain(),n.gain.value=1;const l=t.createGain();l.gain.value=Xw,n.connect(jw(t)).connect(l).connect(o)}catch{n=null}const s=t.createGain();s.gain.value=1/Mu;const i=t.createWaveShaper();i.curve=Zw(t),i.oversample="2x";const r=t.createGain();return r.gain.value=0,o.connect(s).connect(i).connect(r).connect(e??t.destination),{input:o,wetIn:n,limiter:i,master:r}}function Qw(t){const e=Math.max(0,Math.min(1,t));return Math.pow(e,1.8)*Gw}function e1(){const t=typeof navigator<"u"?navigator.userActivation:void 0;return t===void 0||t.isActive===!0}class t1{ctx=null;chain=null;state="idle";failure=null;volume=.8;muted=!1;maxVoices;persist;reverb;injected;injectedDestination;offline;voices=[];retrigger=new Map;listeners=new Set;virtualTime=0;counters={started:0,droppedBudget:0,droppedThrottle:0,droppedNotRunning:0};analyser=null;gestureBound=!1;constructor(e={}){this.maxVoices=e.maxVoices??Yw,this.persist=e.persist??!0,this.reverb=e.reverb??!0,this.injected=e.context??null,this.injectedDestination=e.destination??null,this.offline=!!this.injected&&typeof OfflineAudioContext<"u"&&this.injected instanceof OfflineAudioContext,this.loadSettings(),this.injected?(this.attachContext(this.injected),this.offline&&(this.state="running")):(this.bindGestureUnlock(),this.bindVisibility())}setVolume(e){this.volume=Math.max(0,Math.min(1,Number.isFinite(e)?e:0)),this.applyMasterGain(.02),this.saveSettings(),this.emit()}getVolume(){return this.volume}setMuted(e){this.muted=!!e,this.applyMasterGain(.015),this.saveSettings(),this.emit()}isMuted(){return this.muted}toggleMuted(){return this.setMuted(!this.muted),this.muted}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}getState(){return this.state}getFailure(){return this.failure}activeVoices(){return this.prune(this.now()),this.voices.length}unlock(){if(this.state==="failed"||this.offline||!this.ctx&&!e1())return;const e=this.ensureContext();e&&(typeof e.resume=="function"&&e.state!=="running"&&e.resume().then(()=>this.syncState(),()=>this.syncState()),this.syncState())}bindGestureUnlock(){if(this.gestureBound||typeof window>"u")return;this.gestureBound=!0;const e=["pointerdown","touchend","keydown","click"],a=()=>{if(this.unlock(),this.state==="running"||this.state==="failed")for(const o of e)window.removeEventListener(o,a,!0)};for(const o of e)window.addEventListener(o,a,!0)}bindVisibility(){typeof document>"u"||document.addEventListener("visibilitychange",()=>{const e=this.ctx;if(!(!e||typeof e.suspend!="function")){try{document.hidden?e.suspend().catch(()=>{}):this.state!=="idle"&&e.resume().catch(()=>{})}catch{}this.syncState()}})}ensureContext(){if(this.ctx)return this.ctx;if(this.state==="failed")return null;try{const e=typeof AudioContext<"u"?AudioContext:globalThis.webkitAudioContext;if(!e)return this.fail("Web Audio API unavailable"),null;const a=new e({latencyHint:"interactive"});return this.attachContext(a),a}catch(e){return this.fail(String(e)),null}}attachContext(e){this.ctx=e;try{this.chain=Jw(e,this.injectedDestination??void 0,this.reverb),this.applyMasterGain(0),this.syncState()}catch(a){this.fail(String(a))}}syncState(){if(this.state==="failed")return;const e=this.state;this.ctx?this.offline?this.state="running":this.state=this.ctx.state==="running"?"running":"suspended":this.state="idle",e!==this.state&&this.emit()}fail(e){this.state="failed",this.failure=e,console.warn("[audio] disabled:",e),this.emit()}play(e,a={}){try{return this.playInner(e,a)}catch(o){return this.failure||(this.failure=String(o),console.warn("[audio] sound failed:",o)),!1}}playInner(e,a){if(this.state==="failed")return!1;if(this.state!=="running"||!this.ctx||!this.chain)return this.counters.droppedNotRunning++,!1;const o=this.now();this.prune(o);const n=a.priority??Je.Normal;let s=1,i=1;if(a.key){const y=this.retrigger.get(a.key),v=y&&o-y.at<Kw?y.count+1:0;if(this.retrigger.set(a.key,{at:o,count:v}),v>=Wc.length)return this.counters.droppedThrottle++,!1;s=Wc[v],i=1+v*.045}if(this.voices.length>=this.maxVoices){if(n<Je.Critical&&!this.steal(n))return this.counters.droppedBudget++,!1;n>=Je.Critical&&this.voices.length>=this.maxVoices&&this.steal(Je.Critical)}const r=this.ctx,l=Math.max(o,r.currentTime)+Vw+(a.delay??0),h=Math.max(0,(a.gain??1)*s),c=r.createGain();c.gain.value=h;const d=a.pan!==void 0&&typeof r.createStereoPanner=="function",p=Math.max(-1,Math.min(1,a.pan??0));let u=c;if(d){const y=r.createStereoPanner();y.pan.value=p,c.connect(y),u=y}u.connect(this.chain.input);let m=null;if(this.chain.wetIn)if(m=r.createGain(),m.gain.value=h,d){const y=r.createStereoPanner();y.pan.value=p,m.connect(y).connect(this.chain.wetIn)}else m.connect(this.chain.wetIn);const f=xh(a.seed??Math.random()*4294967295|0),g={ctx:r,dest:c,wet:m??void 0,when:l,rng:f};let w=0;try{w=e(g)||0}catch(y){throw c.disconnect(),m?.disconnect(),y}const b=l+w/i+.05;if(this.voices.push({node:c,wet:m,end:b,priority:n}),this.counters.started++,!this.offline){const y=Math.max(30,(b-r.currentTime)*1e3+40);setTimeout(()=>this.prune(this.now()),y)}return!0}steal(e){let a=-1;for(let n=0;n<this.voices.length;n++)if(this.voices[n].priority<e){a=n;break}if(a<0)return!1;const[o]=this.voices.splice(a,1);return this.release(o),!0}prune(e){for(let a=this.voices.length-1;a>=0;a--)if(this.voices[a].end<=e){const[o]=this.voices.splice(a,1);this.release(o)}if(this.retrigger.size>64)for(const[a,o]of this.retrigger)e-o.at>1&&this.retrigger.delete(a)}release(e){try{e.node.gain.cancelScheduledValues(0),e.node.gain.value=0,e.node.disconnect()}catch{}if(e.wet)try{e.wet.gain.cancelScheduledValues(0),e.wet.gain.value=0,e.wet.disconnect()}catch{}}now(){return this.ctx?Math.max(this.ctx.currentTime,this.virtualTime):this.virtualTime}setVirtualTime(e){this.virtualTime=e,this.prune(e)}tap(){if(!this.ctx||!this.chain)return null;if(this.analyser)return this.analyser;try{const e=this.ctx.createAnalyser();return e.fftSize=2048,e.smoothingTimeConstant=0,this.chain.master.connect(e),this.analyser=e,e}catch{return null}}connectTap(e){if(!this.ctx||!this.chain)return!1;try{return this.chain.master.connect(e),!0}catch{return!1}}get context(){return this.ctx}get busInput(){return this.chain?.input??null}applyMasterGain(e){if(!this.chain||!this.ctx)return;const a=this.muted?0:Qw(this.volume),o=this.chain.master.gain;try{if(e>0&&!this.offline){const n=this.ctx.currentTime;o.cancelScheduledValues(n),o.setValueAtTime(o.value,n),o.linearRampToValueAtTime(a,n+e)}else o.cancelScheduledValues(0),o.value=a}catch{o.value=a}}loadSettings(){if(!(!this.persist||typeof localStorage>"u"))try{const e=localStorage.getItem(qc);if(e!==null){const a=Number(e);Number.isFinite(a)&&(this.volume=Math.max(0,Math.min(1,a)))}this.muted=localStorage.getItem(jc)==="1"}catch{}}saveSettings(){if(!(!this.persist||typeof localStorage>"u"))try{localStorage.setItem(qc,String(this.volume)),localStorage.setItem(jc,this.muted?"1":"0")}catch{}}emit(){for(const e of this.listeners)try{e()}catch{}}}const Le=0;function je(t){const e=t.fighters;return Array.isArray(e)&&e.length>0?e:[t.player,t.enemy].filter(Boolean)}function Qe(t){return je(t)[Le]??t.player}function At(t,e,a){if(typeof e=="number"){const o=je(t)[e];if(o)return o}return t[a]}function Fn(t,e,a){return At(t,e.attackerId,K0(a))}function Vc(t,e){return At(t,e.ownerId,e.ownerRole)}function ua(t,e){return typeof t=="number"?t:e==="player"?0:1}function a1(t){return t===0?"player":t===1?"enemy":`slot${t}`}function o1(t){const{seats:e,center:a,eliminated:o,winnerId:n}=t,s=g=>e.find(w=>w.id===g),i=g=>g.maxHp>0?g.hp/g.maxHp:0,r=g=>Math.hypot(g.x-a.x,g.y-a.y),l=(g,w)=>{const b=i(g),y=i(w);if(b!==y)return y-b;const v=r(g),k=r(w);return v!==k?v-k:g.deaths!==w.deaths?g.deaths-w.deaths:g.id-w.id},h=e.filter(g=>g.alive&&g.hp>0).slice().sort(l).map(g=>g.id),c=new Set(h),d=new Map;o.forEach((g,w)=>{s(g)!==void 0&&d.set(g,w)});const p=[...d.keys()].filter(g=>!c.has(g)).sort((g,w)=>{const b=d.get(g)??-1,y=d.get(w)??-1;if(b!==y)return y-b;const v=s(g),k=s(w);return v&&k&&v.deaths!==k.deaths?v.deaths-k.deaths:g-w}),u=new Set([...h,...p]),m=e.filter(g=>!u.has(g.id)).slice().sort((g,w)=>g.deaths!==w.deaths?g.deaths-w.deaths:g.id-w.id).map(g=>g.id),f=[...h,...p,...m];return n!==null&&f[0]!==n&&s(n)!==void 0?[n,...f.filter(g=>g!==n)]:f}function n1(t,e,a){if(!(t>e))return 1;if(t>=a)return 0;const o=a-e,n=(t-e)/o;return 1-n*n*(3-2*n)}const s1=200,i1=900;function kh(t){return Math.max(0,Math.min(1,(t-2)/16))}function r1(t){const e=kh(t);return a=>{const o=he(a.rng,70),n=W(a,{filter:"bandpass",freq:[2600*o,620*o],q:1.1,peak:.26+e*.12,attack:.006,duration:.13,drive:1.5,wet:.14}),s=X(a,{type:"sine",freq:[440*o,170*o],peak:.16+e*.12,attack:.004,duration:.11,drive:1.9,voices:2,detuneCents:14,wet:.1});return G(n,s)}}function l1(t,e){const a=kh(t),o=Math.min(1,e/180);return n=>{const s=he(n.rng,55),i=.2+o*.1,r=W(n,{filter:"bandpass",freq:[420*s,(1900-o*600)*s],q:2.2,peak:.44+a*.2,attack:.05+o*.03,hold:.12,duration:i,drive:1.6,wet:.2}),l=X(n,{type:"sawtooth",freq:[200*s,88*s],lowpass:[900,300],peak:.2+a*.12,attack:.02,duration:i*.8,drive:1.8,voices:2,detuneCents:18,wet:.12});return G(r,l)}}function h1(){const t=[523.25,659.25,783.99];return e=>{const a=he(e.rng,25);t.forEach((n,s)=>{X({...e,when:e.when+s*.06},{type:"triangle",freq:n*a,peak:.2,attack:.012,hold:.2,duration:.3,voices:2,detuneCents:9,wet:.42})});const o=W(e,{filter:"highpass",freq:[3e3,7e3],q:.8,peak:.07,attack:.08,duration:.42,wet:.5});return G(.3+t.length*.06,o)}}function c1(){return t=>{const e=he(t.rng,30),a=X(t,{type:"sine",freq:[130*e,30*e],peak:.9,attack:.004,hold:.08,duration:.78,drive:3.4,voices:3,detuneCents:22,wet:.3}),o=W(t,{filter:"lowpass",freq:[2200,140],q:1.4,peak:.55,attack:.01,duration:.62,drive:2.2,wet:.34}),n=Te(t,{peak:.62,freq:3e3,snap:1900,snapMs:26}),s=Ue(t,{count:10,spread:.42,freq:[900,4200],peak:.16,q:5,wet:.4});return G(a,o,n,s)}}function d1(t){const e=kh(t);return a=>{const o=he(a.rng,60),n=Te(a,{peak:.66-e*.14,freq:3900-e*1100,snap:2700-e*800,snapMs:11+e*7}),s=X(a,{type:"sine",freq:[(230-e*80)*o,(62-e*22)*o],peak:.48+e*.34,attack:.0018,duration:.11+e*.22,drive:2+e*1.5,voices:2,detuneCents:16,wet:.16}),i=e>.12?X(a,{type:"sine",freq:[(118-e*38)*o,(44-e*12)*o],peak:.14+e*.38,attack:.004,duration:.1+e*.2,drive:1.5,wet:.1}):0,r=W(a,{filter:"bandpass",freq:[1700*o,470*o],q:1.5,peak:.24+e*.2,attack:.0012,duration:.07+e*.1,drive:1.9,wet:.22}),l=W(a,{filter:"bandpass",freq:[1900,640],q:.9,peak:.05+e*.05,attack:.018,duration:.16+e*.22,wet:.6}),h=vh(a,{peak:.1+(1-e)*.06,freq:[8600-e*2200,3400-e*900],duration:.06+e*.05,drops:5,wet:.28});return G(n,s,i,r,l,h)}}function p1(t){const e=t<.3;return a=>{const o=he(a.rng,45),n=xe(a.rng,.9,1.15),s=xe(a.rng,285,360),i=X(a,{type:"sawtooth",freq:[s*o,s*o*.4],lowpass:[xe(a.rng,1180,1620),260],peak:.3,attack:.004,duration:(e?.34:.22)*n,drive:xe(a.rng,2.1,2.8),voices:2,detuneCents:20,wet:.18}),r=xe(a.rng,830,1150),l=W(a,{filter:"lowpass",poles:24,freq:[r,190],q:.9,peak:.2,attack:.002,duration:.16*n,drive:1.6,wet:.24}),h=Te(a,{peak:.2,freq:3600,wet:.16}),c=Ue(a,{count:4,spread:.03,grainMs:[3,8],freq:[xe(a.rng,2700,3400),xe(a.rng,6e3,9e3)],q:4,peak:.24,decay:.3,wet:.2}),d=vh(a,{peak:.13,freq:[xe(a.rng,7600,9400),xe(a.rng,2800,3600)],duration:xe(a.rng,.05,.08),drops:5,wet:.26}),p=e?X(a,{type:"sine",freq:[xe(a.rng,88,104),32],peak:.55,attack:.006,duration:.3*n,drive:2.6,wet:.16}):0;return G(i,l,h,c,d,p)}}function u1(){return t=>{const e=he(t.rng,30),a=Te(t,{peak:.2,freq:5400,snap:3800,snapMs:6}),o=X(t,{type:"triangle",freq:[620*e,1560*e],ring:[132,96],peak:.34,attack:.022,duration:.26,wet:.34}),n=X(t,{type:"sine",freq:[1880*e,2520*e],peak:.1,attack:.03,duration:.34,wet:.55});return G(a,o,n)}}function f1(){return t=>{const e=he(t.rng,40),a=X(t,{type:"sawtooth",freq:[440*e,58*e],lowpass:[2600,240],peak:.42,attack:.006,duration:.6,drive:2.2,voices:2,detuneCents:24,wet:.26}),o=W(t,{filter:"lowpass",freq:[3200,200],q:1.1,peak:.34,attack:.004,duration:.44,drive:1.5,wet:.4}),n=X(t,{type:"sine",freq:[150*e,30*e],peak:.7,attack:.003,duration:.42,drive:3,voices:2,detuneCents:14,wet:.2});return G(a,o,n)}}function m1(){const t=[392,523.25,659.25];return e=>{const a=he(e.rng,20);return t.forEach((o,n)=>{X({...e,when:e.when+n*.05},{type:"triangle",freq:o*a,peak:.26,attack:.01,duration:.24,voices:2,detuneCents:8,wet:.34})}),.24+t.length*.05}}function g1(){return t=>{const e=W(t,{filter:"lowpass",poles:24,freq:[420,110],q:1.2,peak:.34,attack:.05,duration:.4,drive:2,wet:.35}),a=W(t,{filter:"bandpass",freq:[1400,2600],q:.7,peak:.1,attack:.08,duration:.42,wet:.55});return G(e,a)}}const w1=2.1,Eu=1.5,ur=.55;function b1(){return t=>{const e=w1,a={attack:ur,hold:(Eu-ur)/(e-ur),duration:e},o=X(t,{type:"sine",freq:118*he(t.rng,25),peak:.026,voices:3,detuneCents:26,drive:1.6,...a,wet:.25}),n=W(t,{filter:"bandpass",freq:[xe(t.rng,900,1500),xe(t.rng,1700,2500)],q:.45,peak:.055,loop:!0,tremolo:{rate:[.55,.85],depth:.3},...a,wet:.4}),s=W(t,{filter:"highpass",poles:24,freq:[6400,8200],q:.7,peak:.009,loop:!0,...a,wet:.5}),i=xe(t.rng,.3,e-.6),r={...t,when:t.when+i},l=Math.floor(t.rng()*4);let h=0;if(l===0)h=Ui(r,{freq:xe(t.rng,620,980),duration:.42,peak:.085,attack:.0015,wet:.62,modes:[{ratio:1,gain:1,decay:1},{ratio:2.71,gain:.6,decay:.5},{ratio:4.63,gain:.34,decay:.3}]});else if(l===1){const c=Te(r,{peak:.1,freq:3400,snap:900,snapMs:14,wet:.5}),d=xe(t.rng,.11,.19),p=Te({...r,when:r.when+d},{peak:.075,freq:3100,snap:820,snapMs:12,wet:.5});h=G(c,d+p)}else l===2?h=W(r,{filter:"bandpass",freq:[xe(t.rng,2800,3600),xe(t.rng,5600,7400)],q:.8,peak:.04,attack:.09,duration:.55,wet:.7}):h=di(r,{count:3,spread:.16,freq:[4200,11e3],peak:.022,pingMs:[8,20],bend:.94,wet:.6});return G(o,n,s,i+h)}}function y1(){return t=>{const e=W(t,{filter:"highpass",freq:[2600,5200],q:.8,peak:.18,attack:.01,duration:.26,wet:.3}),a=Ue(t,{count:4,spread:.2,freq:[2500,6e3],peak:.1,q:7,wet:.35});return G(e,a)}}function x1(){return t=>{const e=W(t,{filter:"lowpass",freq:[1400,260],q:3.2,peak:.2,attack:.008,duration:.15,drive:1.8,wet:.2}),a=X(t,{type:"sine",freq:[180,84],peak:.14,duration:.11,drive:2.2,wet:.14});return G(e,a)}}function v1(){return t=>{const e=he(t.rng,90),a=Te(t,{peak:.26,freq:2400,snap:1200,snapMs:8}),o=X(t,{type:"sine",freq:[150*e,66*e],peak:.22,duration:.09,drive:2,wet:.24});return G(o,a)}}function k1(t){const e=[523.25,587.33,659.25,698.46,783.99],a=e[Math.max(0,Math.min(e.length-1,5-t))];return o=>{const n=X(o,{type:"triangle",freq:a,peak:.34,attack:.004,hold:.25,duration:.16,voices:2,detuneCents:7,wet:.3}),s=W(o,{filter:"highpass",freq:3800,peak:.12,duration:.015,wet:.12});return G(n,s)}}function M1(){const t=[523.25,659.25,1046.5];return e=>{t.forEach((o,n)=>{X({...e,when:e.when+n*.07},{type:"square",freq:o,lowpass:[3200,1800],peak:.22,attack:.006,hold:.3,duration:.34,voices:2,detuneCents:10,wet:.3})});const a=W(e,{filter:"bandpass",freq:[500,4e3],q:.9,peak:.16,attack:.14,duration:.2,wet:.35});return G(.34+t.length*.07,a)}}function E1(){return t=>{const e=he(t.rng,18);[587.33,392].forEach((n,s)=>{X({...t,when:t.when+s*.16},{type:"triangle",freq:n*e,peak:.26,attack:.008,hold:.25,duration:.38,voices:2,detuneCents:11,wet:.34})});const a=X(t,{type:"sine",freq:[196*e,98*e],peak:.34,attack:.02,hold:.3,duration:.72,drive:2.2,voices:2,detuneCents:15,wet:.28}),o=W(t,{filter:"bandpass",freq:[2200,620],q:.8,peak:.12,attack:.06,duration:.66,wet:.55});return G(.38+.16,a,o)}}function T1(t){const e=t?[523.25,659.25,783.99,1046.5]:[659.25,587.33,493.88,392];return a=>(e.forEach((o,n)=>{X({...a,when:a.when+n*.1},{type:t?"square":"sawtooth",freq:o,lowpass:t?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.4,voices:2,detuneCents:t?9:16,wet:.34})}),.4+e.length*.1)}function S1(t){const e=t?[523.25,659.25,1046.5]:[587.33,493.88,392],a=.62;return o=>{const n=(r,l)=>(W({...o,when:o.when+r},{filter:"bandpass",freq:2900,q:10,peak:.7,attack:.012,hold:.45,duration:l,tremolo:{rate:24,depth:.7},wet:.06}),r+l);n(0,.26);const s=n(.36,.22),i=X(o,{type:"sawtooth",freq:[150,132],lowpass:[1100,420],peak:.14,attack:.01,hold:.5,duration:.58,drive:1.8,voices:2,detuneCents:22,wet:.2});return e.forEach((r,l)=>{X({...o,when:o.when+a+l*.1},{type:t?"square":"sawtooth",freq:r,lowpass:t?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.36,voices:2,detuneCents:t?9:16,wet:.34})}),G(s,i,a+(e.length-1)*.1+.36)}}function A1(){return t=>{const e=X(t,{type:"triangle",freq:[900,620],peak:.22,duration:.055,drive:1.6,wet:.16}),a=W(t,{filter:"highpass",freq:5e3,peak:.1,duration:.012});return G(e,a)}}function ps(t,e,a,o,n){return Ue(t,{count:12,spread:e,grainMs:[5,14],freq:[2300,4600],freqShift:[a,o],q:3.2,peak:n,decay:.4,drive:1.5,wet:.3})}function Mn(t,e,a){return Ue(t,{count:7,spread:e,grainMs:[2,5],freq:[5600,11e3],q:9,peak:a,decay:.25,wet:.34})}const R1={Disc:{cast(t){const e=he(t.rng,55),a=ps(t,.3,1.35,.62,.3),o=Mn(t,.22,.13),n=W(t,{filter:"bandpass",freq:[700*e,1800*e],q:1.6,peak:.34,attack:.05,hold:.1,duration:.3,drive:1.4,wet:.3});return G(a,o,n)},impact(t){const e=Te(t,{peak:.46,freq:3400,snap:1600,snapMs:10,wet:.1}),a=W(t,{filter:"bandpass",freq:[2400,950],q:2,peak:.3,attack:.003,duration:.07,drive:1.9,wet:.24}),o=ps(t,.2,1.3,.68,.3),n=Mn(t,.14,.46),s=X(t,{type:"sine",freq:[190,72],peak:.46,attack:.0022,duration:.1,drive:2.6,voices:2,detuneCents:15,wet:.14});return G(e,a,o,n,s)}},Roll:{cast(t){const e=he(t.rng,60);return W(t,{filter:"bandpass",freq:[900*e,2100*e],q:2.4,peak:.36,attack:.04,duration:.2,drive:1.5,wet:.3})},impact(t){const e=ps(t,.26,.7,1.5,.32),a=Mn(t,.2,.44),o=W(t,{filter:"bandpass",freq:[1100,3400],q:7,peak:.3,attack:.02,duration:.26,drive:1.6,wet:.32}),n=X(t,{type:"sine",freq:[230,124],peak:.18,attack:.004,duration:.08,drive:2.2,wet:.12});return G(e,a,o,n)}},Swarm:{cast(t){const e=he(t.rng,70),a=W(t,{filter:"bandpass",freq:[1400*e,3e3*e],q:4,peak:.36,attack:.025,duration:.17,drive:1.7,wet:.3}),o=Mn(t,.16,.16);return G(a,o)},impact(t){const e=Te(t,{peak:.36,freq:4200,snap:2200,snapMs:7,wet:.1}),a=ps(t,.13,1.2,.8,.24),o=Mn(t,.1,.3),n=X(t,{type:"sine",freq:[250,118],peak:.18,attack:.002,duration:.07,drive:2.4,wet:.12});return G(e,a,o,n)}}};function us(t,e,a,o){return Ui(t,{freq:e,duration:a,peak:o,attack:.0012,drive:1.4,wet:.34,modes:[{ratio:1,gain:1,decay:1},{ratio:2.06,gain:.82,decay:.82},{ratio:3.18,gain:.6,decay:.6},{ratio:4.34,gain:.4,decay:.42},{ratio:5.52,gain:.3,decay:.3}]})}function Kc(t,e,a){return Ue(t,{count:7,spread:e,grainMs:[2,5],freq:[4200,12e3],q:10,peak:a,decay:.3,wet:.12})}function I1(t,e,a){return di(t,{count:4,spread:e,freq:[5e3,12500],peak:a,pingMs:[5,13],bend:1.08,wet:.2})}const O1={Candy:{cast(t){const e=he(t.rng,70),a=W(t,{filter:"bandpass",freq:[1400*e,3200*e],q:2,peak:.34,attack:.022,duration:.13,wet:.28}),o=us(t,1900*e,.11,.2),n=Kc(t,.07,.1);return G(a,o,n)},impact(t){const e=he(t.rng,60),a=Te(t,{peak:.5,freq:5400,snap:3200,snapMs:8,wet:.12}),o=us(t,2450*e,.4,.56),n=Kc(t,.22,.9),s=I1(t,.16,.74),i=us({...t,when:t.when+.09},2450*e*1.02,.26,.22),r=us({...t,when:t.when+.175},2450*e*1.045,.17,.11),l=X(t,{type:"sine",freq:[280*e,130*e],peak:.42,attack:.0018,duration:.1,drive:3.2,wet:.12});return G(a,o,n,s,.09+i,.175+r,l)}}};function fr(t,e,a){const o=he(t.rng,60),n=Te(t,{peak:e,freq:(4200+a*1800)*o,snap:(2600+a*900)*o,snapMs:7,wet:.05}),s=W(t,{filter:"bandpass",freq:[(2600+a*800)*o,(5200+a*1600)*o],q:3.4,peak:e*.8,attack:5e-4,duration:.022,drive:2.2,wet:.1}),i=W(t,{filter:"highpass",poles:24,freq:[(7e3+a*1800)*o,(4600+a*1200)*o],q:.7,peak:e*1.5,attack:4e-4,duration:.024,wet:.12});return G(n,s,i)}function Xc(t,e){const a=he(t.rng,70),o=W(t,{filter:"lowpass",poles:24,freq:[(1800+e*600)*a,(420-e*110)*a],q:3.6,peak:.26+e*.18,attack:.012+e*.01,duration:.15+e*.12,drive:2,wet:.24}),n=X(t,{type:"sine",freq:[(180-e*45)*a,(58-e*16)*a],peak:.36+e*.3,attack:.006,duration:.13+e*.1,drive:3.2,voices:2,detuneCents:16,wet:.14}),s=W(t,{filter:"bandpass",freq:[700*a,1500*a],q:6,peak:.12+e*.08,attack:.03,duration:.2+e*.14,wet:.36}),i=Ue(t,{count:Math.round(5+e*5),spread:.12+e*.06,grainMs:[3,8],freq:[3800,10600],q:7,peak:.5+e*.3,decay:.3,wet:.28});return G(o,n,s,i)}const mr=.045,C1={Tackle:{cast(t){const e=he(t.rng,40),a=W(t,{filter:"bandpass",freq:[420*e,1900*e],q:2,peak:.44,attack:.07,hold:.1,duration:.26,drive:1.6,wet:.3}),o=X(t,{type:"sine",freq:[120*e,240*e],peak:.28,attack:.08,duration:.24,drive:2.4,voices:2,detuneCents:14,wet:.16});return G(a,o)},impact(t){const e=fr(t,.88,.35),a=Xc({...t,when:t.when+mr},1);return G(e,mr+a)}},Hatch:{cast(t){const e=fr(t,.5,0),a=X({...t,when:t.when+.05},{type:"triangle",freq:[1500,2400],peak:.3,attack:.006,duration:.09,drive:2.2,wet:.32}),o=X({...t,when:t.when+.15},{type:"triangle",freq:[1800,2700],peak:.24,attack:.005,duration:.07,drive:2.2,wet:.32});return G(e,.05+a,.15+o)},impact(t){const e=Te(t,{peak:.4,freq:5400,snap:3200,snapMs:6,wet:.1}),a=W(t,{filter:"highpass",poles:24,freq:[8200,5600],q:.7,peak:.2,attack:4e-4,duration:.005,wet:.12}),o=X(t,{type:"triangle",freq:[2100,1250],peak:.22,attack:.0015,duration:.05,drive:2.4,wet:.2}),n=X({...t,when:t.when+.035},{type:"triangle",freq:[1700,2600],peak:.18,attack:.005,duration:.06,drive:2,wet:.3}),s=X(t,{type:"sine",freq:[240,120],peak:.22,attack:.002,duration:.06,drive:2.2,wet:.1});return G(e,a,o,.035+n,s)}},Shards:{cast(t){const e=he(t.rng,80),a=W(t,{filter:"highpass",freq:[1900*e,3800*e],q:1.1,peak:.32,attack:.016,duration:.11,wet:.26}),o=Ue(t,{count:4,spread:.08,grainMs:[3,6],freq:[3400,7e3],q:8,peak:.13,wet:.28});return G(a,o)},impact(t){const e=mr*.62,a=fr(t,.66,1),o=Xc({...t,when:t.when+e},.18);return G(a,e+o)}}};function Zc(t,e,a,o){const n=he(t.rng,70),s=X(t,{type:"sine",freq:[(170-e*55)*n,(52-e*16)*n],peak:o,attack:.003,duration:a,drive:3+e*1.2,voices:2,detuneCents:18,wet:.12}),i=W(t,{filter:"lowpass",poles:24,freq:[(760-e*220)*n,(150-e*45)*n],q:1.2,peak:o*.45,attack:.002,duration:a*.7,drive:2.2,wet:.2}),r=W(t,{filter:"bandpass",freq:[(2400-e*400)*n,(1450-e*300)*n],q:.8,peak:o*.056,attack:.003,duration:a*.55,drive:1.4,wet:.3});return G(s,i,r)}const F1={Smash:{cast(t){const e=he(t.rng,55),a=W(t,{filter:"lowpass",poles:24,freq:[1300*e,420*e],q:1.6,peak:.42,attack:.055,hold:.1,duration:.22,drive:1.7,wet:.22}),o=X(t,{type:"sawtooth",freq:[180*e,92*e],lowpass:[620,220],peak:.24,attack:.03,duration:.2,drive:2.2,voices:2,detuneCents:20,wet:.12});return G(a,o)},impact(t){const e=Te(t,{peak:.44,freq:1500,snap:620,snapMs:22,wet:.1}),a=Zc(t,1,.24,.86);return G(e,a)}},Tomato:{cast(t){const e=he(t.rng,80),a=W(t,{filter:"lowpass",poles:24,freq:[1500*e,520*e],q:2.1,peak:.36,attack:.014,duration:.14,drive:1.6,wet:.18}),o=X(t,{type:"sine",freq:[300*e,140*e],peak:.16,attack:.006,duration:.11,drive:2,wet:.1});return G(a,o)},impact(t){const e=Te(t,{peak:.34,freq:1900,snap:780,snapMs:15,wet:.1}),a=Zc(t,.55,.19,.62),o=W(t,{filter:"lowpass",poles:24,freq:[1e3,260],q:2.8,peak:.24,attack:.008,duration:.13,drive:1.8,wet:.26});return G(e,a,o)}},Lettuce:{cast(t){return W(t,{filter:"bandpass",freq:[900,2200],q:1.2,peak:.26,attack:.03,duration:.15,wet:.3})},impact(t){const e=W(t,{filter:"lowpass",poles:24,freq:[1600,380],q:1.4,peak:.3,attack:.006,duration:.16,drive:1.5,wet:.3}),a=X(t,{type:"triangle",freq:[240,96],peak:.3,attack:.012,hold:.2,duration:.3,drive:2.4,voices:2,detuneCents:22,wet:.18}),o=W(t,{filter:"bandpass",freq:[3400,1900],q:.9,peak:.042,attack:.004,duration:.1,wet:.34});return G(e,a,o)}},Onion:{cast(t){const e=he(t.rng,20),a=[174.61,220,261.63];a.forEach((n,s)=>{X({...t,when:t.when+s*.07},{type:"triangle",freq:n*e,peak:.28,attack:.016,hold:.22,duration:.34,drive:2.2,voices:2,detuneCents:11,wet:.4})});const o=W(t,{filter:"lowpass",poles:24,freq:[900,300],q:1,peak:.1,attack:.1,duration:.45,wet:.5});return G(.34+a.length*.07,o)}}};function Jc(t,e,a,o,n){const s=he(t.rng,60),i=.075+o*.045,r=.1+o*.06,l=W(t,{filter:"bandpass",freq:[e*s,a*s],q:5.5,peak:n,attack:.012,duration:i,drive:1.8,wet:.2}),h=W({...t,when:t.when+i*.82},{filter:"bandpass",freq:[a*s,e*.72*s],q:5.5,peak:n*.9,attack:.008,duration:r,drive:1.8,wet:.24}),c=X(t,{type:"triangle",freq:[e*.34*s,a*.3*s],peak:n*.5,attack:.014,duration:i+r*.6,drive:2.4,voices:2,detuneCents:16,wet:.14});return G(l,i*.82+h,c)}function Qc(t,e,a){const o=he(t.rng,70),n=Te(t,{peak:.3+e*.1,freq:1700+a*700,snap:700+a*320,snapMs:16,wet:.1}),s=W(t,{filter:"lowpass",poles:24,freq:[(1400+a*600)*o,(280+a*120)*o],q:3.2,peak:.42+e*.2,attack:.005,duration:.15+e*.07,drive:2,wet:.26}),i=X(t,{type:"sine",freq:[(210-e*50)*o,(66-e*18)*o],peak:.6+e*.34,attack:.0025,duration:.16+e*.14,drive:2.6,voices:2,detuneCents:15,wet:.14}),r=W(t,{filter:"bandpass",freq:[(4200+a*2200)*o,(2100+a*900)*o],q:.75,peak:.23+a*.06,attack:.0015,duration:.05+a*.03,wet:.34});return G(n,s,i,r)}const N1={Mustard:{cast(t){return Jc(t,520,1250,.15,.44)},impact(t){return Qc(t,.42,1)}},Ketchup:{cast(t){return Jc(t,340,780,1,.42)},impact(t){const e=Qc(t,.3,0),a=W(t,{filter:"lowpass",poles:24,freq:[640,200],q:4,peak:.2,attack:.04,duration:.34,drive:1.6,wet:.4});return G(e,a)}},Slash:{cast(t){const e=he(t.rng,50);return W(t,{filter:"bandpass",freq:[700*e,2300*e],q:2,peak:.38,attack:.05,hold:.1,duration:.19,drive:1.5,wet:.26})},impact(t){const e=he(t.rng,45),a=.026,o=(h,c,d)=>Te({...t,when:t.when+h},{peak:c,freq:d,snap:d*.3,snapMs:20,wet:.12}),n=o(0,.5,1400),s=o(a,.4,1200),i=W(t,{filter:"bandpass",freq:[900*e,340*e],q:2.4,peak:.34,attack:.0015,duration:.12,drive:2.1,wet:.24}),r=X(t,{type:"sine",freq:[200*e,58*e],peak:.95,attack:.002,duration:.24,drive:3,voices:2,detuneCents:17,wet:.14}),l=Ue(t,{count:5,spread:.075,grainMs:[3,9],freq:[3e3,6400],q:4,peak:.38,decay:.3,wet:.3});return G(n,a+s,i,r,l)}}};function gr(t,e,a,o){const n=Ui(t,{freq:e,duration:a,peak:o,attack:8e-4,wet:.36,modes:[{ratio:1,gain:1,decay:1},{ratio:2.76,gain:.8,decay:.7},{ratio:5.4,gain:.5,decay:.44}]}),s=X(t,{type:"sine",freq:[e*1.02,e*.92],ring:e*1.37,peak:o*.7,attack:8e-4,duration:a*.8,wet:.4});return G(n,s)}function ed(t,e,a,o){return Ue(t,{count:e,spread:a,grainMs:[2,5],freq:[5600,14e3],q:11,peak:o,decay:.3,wet:.3})}const L1={Smash:{cast(t){const e=he(t.rng,50),a=W(t,{filter:"bandpass",freq:[600*e,2400*e],q:2.4,peak:.44,attack:.055,hold:.1,duration:.22,drive:1.5,wet:.3}),o=gr(t,2400*e,.12,.16);return G(a,o)},impact(t){const e=he(t.rng,45),a=Te(t,{peak:.66,freq:6400,snap:4200,snapMs:6,wet:.14}),o=gr(t,5400*e,.34,.56),n=ed(t,9,.2,.8),s=X(t,{type:"sine",freq:[250*e,100*e],peak:.62,attack:.0015,duration:.12,drive:3,wet:.12}),i=W(t,{filter:"bandpass",freq:[7e3,12e3],q:1.2,peak:.26,attack:.025,duration:.16,wet:.5});return G(a,o,n,i,s)}},Giant:{impact(t){const e=he(t.rng,35),a=Te(t,{peak:.72,freq:5800,snap:3600,snapMs:9,wet:.16}),o=gr(t,4550*e,.5,.64),n=ed(t,12,.36,.84),s=W(t,{filter:"bandpass",freq:[6e3,9500],q:1.4,peak:.14,attack:.06,duration:.58,wet:.6}),i=X(t,{type:"sine",freq:[230*e,78*e],peak:.52,attack:.0025,duration:.14,drive:3,voices:2,detuneCents:16,wet:.14});return G(a,o,n,s,i)}}};function wr(t,e,a){const o=he(t.rng,60),n=.38+a*.12,s=W(t,{filter:"bandpass",freq:[(560-a*200)*o,(2200-a*900)*o],q:1.5,peak:1.2,attack:.035,hold:.1,duration:n,drive:1.5,wet:.1*Math.min(1,16/e),tremolo:{rate:[e*.88,e],depth:.85}}),i=W(t,{filter:"highpass",freq:3600,peak:.16,attack:8e-4,duration:.018,wet:.1});return G(s,i)}const D1={Dough:{cast(t){return wr(t,16,.85)},impact(t){const e=he(t.rng,70),a=W(t,{filter:"lowpass",poles:24,freq:[1100*e,190*e],q:1.1,peak:.34,attack:.004,duration:.13,drive:1.8,wet:.24}),o=Te(t,{peak:.34,freq:1600,snap:660,snapMs:18,wet:.1}),n=X(t,{type:"sine",freq:[150*e,58*e],peak:.5,attack:.003,duration:.18,drive:2.8,voices:2,detuneCents:18,wet:.14}),s=W(t,{filter:"bandpass",freq:[2500,1700],q:.8,peak:.028,attack:.012,duration:.11,wet:.4});return G(a,o,n,s)}},Tomato:{cast(t){return wr(t,26,.25)},impact(t){const e=he(t.rng,65),a=W(t,{filter:"bandpass",freq:[1350*e,400*e],q:1.4,peak:.34,attack:.001,duration:.07,drive:2,wet:.2}),o=W(t,{filter:"lowpass",poles:24,freq:[900,240],q:2.6,peak:.3,attack:.008,duration:.15,drive:1.7,wet:.26}),n=Te(t,{peak:.34,freq:2e3,snap:900,snapMs:13,wet:.1}),s=X(t,{type:"sine",freq:[200*e,72*e],peak:.62,duration:.18,drive:3.2,voices:2,detuneCents:16,wet:.14}),i=vh(t,{peak:.15,freq:[8200,3e3],duration:.085,drops:6,wet:.34});return G(a,o,n,s,i)}},Cheese:{cast(t){return wr(t,12,.6)},impact(t){const e=he(t.rng,55),a=W(t,{filter:"bandpass",freq:[1400*e,480*e],q:2.2,peak:.3,attack:.01,duration:.2,drive:1.6,wet:.26}),o=X(t,{type:"triangle",freq:[300*e,110*e],peak:.32,attack:.012,hold:.25,duration:.34,drive:2.4,voices:2,detuneCents:20,wet:.18}),n=Te(t,{peak:.26,freq:1800,snap:760,snapMs:16,wet:.1}),s=Ue(t,{count:4,spread:.13,grainMs:[6,16],freq:[3200,5200],q:3.5,peak:.16,decay:.35,freqShift:[1,.62],wet:.34});return G(a,o,n,s)}}};function br(t,e,a){return W(t,{filter:"bandpass",freq:[2800,5600],q:.85,peak:e,attack:a*.35,duration:a,wet:.55})}function yr(t,e,a,o){return Cn(t,{count:e,spread:a,freq:[1500,3100],rise:1.9,peak:o,wet:.42})}function xr(t,e,a,o){const n=he(t.rng,80),s=(2600-e*900)*n,i=(420-e*200)*n,r=W(t,{filter:"lowpass",freq:[s,i],poles:24,q:2.4+e*2,peak:o*.72,attack:.006+e*.012,duration:a,drive:1.8,wet:.3}),l=X(t,{type:"sine",freq:[(190-e*60)*n,(68-e*22)*n],peak:o*(.85+e*.55),attack:.005,duration:a*.75,drive:2.5,voices:2,detuneCents:16,wet:.14}),h=Te(t,{peak:.22+e*.12,freq:1150,snap:460,snapMs:18,wet:.12});return G(r,l,h)}const H1={Splash:{cast(t){const e=he(t.rng,90),a=W(t,{filter:"bandpass",freq:[900*e,260*e],q:3.4,peak:.46,attack:.012,duration:.12,drive:1.8,wet:.24}),o=Cn(t,{count:2,spread:.07,freq:[620,980],peak:.2,wet:.3});return G(a,o)},impact(t){const e=xr(t,.24,.2,.44),a=Cn(t,{count:4,spread:.16,freq:[480,900],peak:.14,wet:.3}),o=yr(t,7,.11,.2),n=br(t,.11,.34);return G(e,a,o,n)}},Noodle:{cast(t){const e=he(t.rng,70),a=W(t,{filter:"bandpass",freq:[1500*e,520*e],q:2.2,peak:.42,attack:.01,duration:.16,drive:1.7,wet:.26}),o=X(t,{type:"sine",freq:[520*e,190*e],peak:.16,attack:.02,duration:.18,drive:2,wet:.16});return G(a,o)},impact(t){const e=W(t,{filter:"bandpass",freq:[1400,560],q:1.6,peak:.26,attack:.0015,duration:.05,drive:1.8,wet:.18}),a=xr(t,.35,.26,.44),o=Cn(t,{count:3,spread:.2,freq:[440,820],peak:.12,wet:.3}),n=yr(t,8,.14,.2),s=br(t,.12,.42);return G(e,a,o,n,s)}},Dump:{cast(t){const e=he(t.rng,40);let a=0;const o=9;for(let s=0;s<o;s++){const i=s/o*.34+xe(t.rng,-.012,.012),r=xe(t.rng,320,1100)*e,l=xe(t.rng,.05,.11);a=Math.max(a,i+l),W({...t,when:t.when+Math.max(0,i)},{filter:"lowpass",poles:24,freq:[r*2.2,r*.6],q:4.5,peak:.32,attack:.008,duration:l,drive:1.6,wet:.28})}const n=X(t,{type:"sine",freq:[150*e,70*e],peak:.3,attack:.12,duration:.4,drive:2,voices:2,detuneCents:14,wet:.2});return G(a,n)},impact(t){const e=xr(t,1,.42,.62),a=Cn(t,{count:7,spread:.34,freq:[380,820],peak:.16,wet:.34}),o=Ue(t,{count:5,spread:.26,freq:[600,1500],peak:.1,q:4,wet:.3}),n=yr(t,7,.22,.14),s=br(t,.15,.75);return G(e,a,o,n,s)}}};function vr(t,e,a,o,n){const s=he(t.rng,45),i=W(t,{filter:"bandpass",freq:[e*s,a*s],q:12,peak:n,attack:.004,duration:o,curve:"lin",freqCurve:"exp",wet:.18}),r=W({...t,when:t.when+o*.16},{filter:"bandpass",freq:[e*2*s,a*1.7*s],q:14,peak:n*.5,attack:.002,duration:o*.7,curve:"lin",wet:.22}),l=W({...t,when:t.when+o*.06},{filter:"bandpass",freq:[e*3.4*s,a*2.6*s],q:16,peak:n*.8,attack:.0015,duration:o*.45,curve:"lin",wet:.24});return G(i,o*.16+r,o*.06+l)}function fs(t,e,a,o){return Ue(t,{count:e,spread:a,grainMs:[2,5],freq:[4200,12e3],q:6,peak:o,decay:.35,wet:.1})}const _1={Rice:{cast(t){const e=W(t,{filter:"highpass",freq:[2200,4200],q:1,peak:.3,attack:.012,duration:.09,wet:.2}),a=fs(t,7,.09,.2);return G(e,a)},impact(t){const e=fs(t,6,.075,.34),a=Te(t,{peak:.3,freq:5600,snap:3600,snapMs:5,wet:.08}),o=X(t,{type:"sine",freq:[300,170],peak:.16,attack:.0015,duration:.05,drive:2,wet:.1});return G(e,a,o)}},Seaweed:{cast(t){const e=he(t.rng,60);return W(t,{filter:"bandpass",freq:[1600*e,3400*e],q:1.8,peak:.34,attack:.03,duration:.18,wet:.3})},impact(t){const e=he(t.rng,55),a=Ue(t,{count:10,spread:.16,grainMs:[3,9],freq:[2800,6400],q:4.5,peak:.28,decay:.35,wet:.28}),o=W(t,{filter:"bandpass",freq:[3600*e,1600*e],q:7,peak:.26,attack:.012,duration:.24,wet:.32}),n=Te(t,{peak:.32,freq:4200,snap:2400,snapMs:7,wet:.1}),s=X(t,{type:"sine",freq:[280,150],peak:.13,attack:.003,duration:.06,drive:2,wet:.12});return G(a,o,n,s)}},Fish:{cast(t){return vr(t,900,2600,.14,.3)},impact(t){const e=vr(t,2600,8200,.17,.72),a=W(t,{filter:"lowpass",poles:24,freq:[1100,340],q:2.4,peak:.16,attack:.006,duration:.09,drive:1.8,wet:.24}),o=fs(t,5,.1,.2),n=X(t,{type:"sine",freq:[230,96],peak:.42,attack:.0018,duration:.07,drive:2.4,wet:.12});return G(e,a,o,n)}},Catch:{cast(t){const e=he(t.rng,40),a=X(t,{type:"sine",freq:[140*e,300*e],peak:.3,attack:.1,duration:.3,drive:2.2,voices:2,detuneCents:14,wet:.24}),o=W(t,{filter:"bandpass",freq:[800*e,2400*e],q:2.2,peak:.34,attack:.08,duration:.28,wet:.32});return G(a,o)},impact(t){const e=vr(t,3e3,9e3,.15,.8),a=W({...t,when:t.when+.05},{filter:"lowpass",poles:24,freq:[1300,420],q:2.2,peak:.2,attack:.005,duration:.11,drive:1.9,wet:.26}),o=fs({...t,when:t.when+.04},8,.16,.28),n=Te(t,{peak:.52,freq:5e3,snap:2800,snapMs:7,wet:.1}),s=X(t,{type:"sine",freq:[220,80],peak:.5,attack:.0018,duration:.09,drive:2.6,voices:2,detuneCents:14,wet:.14});return G(e,.05+a,.04+o,n,s)}}};function ms(t,e,a){const o=he(t.rng,70),n=W(t,{filter:"bandpass",freq:[3400*o,1500*o],q:1.2,peak:.55+e*.3,attack:6e-4,duration:.03,drive:2.2,wet:.12}),s=Te(t,{peak:.44+e*.2,freq:5200*o,snap:(2900-e*500)*o,snapMs:8,wet:.1}),i=Ue(t,{count:Math.round(7+e*6),spread:.14+e*.1,grainMs:[3,9-a*3],freq:[2700+a*900,9200+a*2600],q:7,peak:.34+e*.16,decay:.28,drive:1.6,wet:.26}),r=e*(1-a)>.02?X(t,{type:"sine",freq:[(190-e*60)*o,(72-e*22)*o],peak:.24+e*.26,attack:.002,duration:.08+e*.1,drive:2.6,voices:2,detuneCents:16,wet:.14}):0,l=W(t,{filter:"highpass",poles:24,freq:[8e3+a*2e3,5200+a*1200],q:.7,peak:.165+e*.065,attack:6e-4,duration:.014+e*.012,wet:.22});return G(n,s,i,r,l)}const z1={Filling:{cast(t){const e=he(t.rng,60),a=W(t,{filter:"bandpass",freq:[700*e,1800*e],q:2,peak:.44,attack:.03,duration:.16,drive:1.6,wet:.26}),o=Ue(t,{count:4,spread:.1,freq:[3e3,7e3],peak:.11,q:8,wet:.28}),n=X(t,{type:"sine",freq:[260*e,130*e],peak:.14,duration:.1,drive:2,wet:.12});return G(a,o,n)},impact(t){return ms(t,.75,.3)}},Onion:{cast(t){const e=he(t.rng,80);return W(t,{filter:"highpass",freq:[1800*e,3400*e],q:1.1,peak:.36,attack:.02,duration:.12,wet:.28})},impact(t){const e=ms(t,.3,1),a=W(t,{filter:"bandpass",freq:[1100,420],q:1.6,peak:.26,attack:.006,duration:.1,drive:1.7,wet:.24});return G(e,a)}},Double:{cast(t){const e=he(t.rng,50),a=W(t,{filter:"bandpass",freq:[640*e,1700*e],q:2,peak:.44,attack:.025,duration:.15,drive:1.6,wet:.26}),o=W({...t,when:t.when+.055},{filter:"bandpass",freq:[820*e,2100*e],q:2,peak:.38,attack:.02,duration:.13,drive:1.6,wet:.26}),n=X(t,{type:"sine",freq:[240*e,118*e],peak:.16,duration:.12,drive:2,wet:.12});return G(a,.055+o,n)},impact(t){const e=ms(t,.85,.1),a=ms({...t,when:t.when+.055},.4,.85);return G(e,.055+a)}}};function gs(t,e,a,o){return Ui(t,{freq:e,duration:a,peak:o,attack:.001,drive:1.8,wet:.22,modes:[{ratio:1,gain:1,decay:1},{ratio:2.43,gain:.78,decay:.55},{ratio:3.71,gain:.5,decay:.34},{ratio:5.86,gain:.3,decay:.2}]})}function td(t,e,a){const o=W(t,{filter:"bandpass",freq:[1300,2800],q:1.5,peak:e,attack:.004,duration:a,wet:.34}),n=Ue(t,{count:7,spread:a*.7,grainMs:[3,7],freq:[2600,8600],q:8,peak:e*.42,decay:.3,wet:.3}),s=W(t,{filter:"highpass",poles:24,freq:[6200,3800],q:.7,peak:e*.25,attack:.002,duration:a*.5,wet:.36});return G(o,n,s)}const P1={Spray:{cast(t){const e=W(t,{filter:"bandpass",freq:[900,2800],q:1.1,peak:.34,attack:.02,duration:.14,wet:.28}),a=gs(t,190,.06,.2);return G(e,a)},impact(t){const e=Te(t,{peak:.28,freq:4200,snap:2500,snapMs:8,wet:.12}),a=td(t,.34,.16),o=X(t,{type:"sine",freq:[260,120],peak:.3,attack:.002,duration:.09,drive:2,wet:.12});return G(e,a,o)}},Glass:{cast(t){const e=he(t.rng,70),a=W(t,{filter:"highpass",freq:[1600*e,3600*e],q:1.2,peak:.36,attack:.018,duration:.13,wet:.26}),o=Ue(t,{count:3,spread:.07,grainMs:[3,7],freq:[4200,8e3],q:9,peak:.14,wet:.3});return G(a,o)},impact(t){const e=Te(t,{peak:.62,freq:4600,snap:3400,snapMs:9,wet:.14}),a=gs(t,460,.13,.42),o=Ue(t,{count:9,spread:.15,grainMs:[3,8],freq:[3200,9200],q:8,peak:.3,decay:.25,wet:.32}),n=di(t,{count:3,spread:.1,freq:[5200,11e3],peak:.19,pingMs:[6,14],bend:.9,wet:.34});return G(e,a,o,n)}},Cap:{cast(t){const e=X(t,{type:"sine",freq:[520,900],peak:.4,attack:.001,duration:.05,drive:2.6,wet:.2}),a=Te(t,{peak:.3,freq:4e3,snap:2400,snapMs:6,wet:.12});return G(e,a)},impact(t){const e=Te(t,{peak:.52,freq:3800,snap:2300,snapMs:9,wet:.12}),a=gs(t,560,.2,.7),o=X(t,{type:"sine",freq:[150,68],peak:.17,attack:.003,duration:.11,drive:2.4,wet:.12}),n=di(t,{count:2,spread:.05,freq:[4600,9e3],peak:.3,pingMs:[5,11],bend:.86,wet:.28});return G(e,a,o,n)}},Mega:{cast(t){const e=he(t.rng,35),a=W(t,{filter:"bandpass",freq:[500*e,2600*e],q:1.8,peak:.44,attack:.1,hold:.08,duration:.34,drive:1.5,wet:.34}),o=X(t,{type:"sine",freq:[90*e,200*e],peak:.34,attack:.12,duration:.36,drive:2.4,voices:2,detuneCents:14,wet:.2});return G(a,o)},impact(t){const e=Te(t,{peak:.58,freq:3e3,snap:1500,snapMs:16,wet:.12}),a=td(t,.56,.42),o=gs(t,380,.24,.56),n=X(t,{type:"sine",freq:[140,46],peak:.62,attack:.003,duration:.3,drive:3.2,voices:2,detuneCents:18,wet:.16});return G(e,a,o,n)}}};function Lt(t,e){const a={};for(const[o,n]of Object.entries(e))n&&(a[`${t}.${o}`]=n);return a}const $1={...Lt("burrito",R1),...Lt("donut",O1),...Lt("egg",C1),...Lt("hamburger",F1),...Lt("hotdog",N1),...Lt("lollipop",L1),...Lt("pizza",D1),...Lt("soup",H1),...Lt("sushi",_1),...Lt("taco",z1),...Lt("waterbottle",P1)};function ad(t,e){return $1[`${t}.${e}`]}const B1=210,U1=.78,q1=420,j1=900,W1=520,G1=.45,Y1=1.5,V1=1600,K1=q1,X1=.6180339887,Z1=.42;class pi{constructor(e,a={}){this.engine=e,this.localSlot=a.listenerId??(a.listener==="enemy"?1:Le),this.listenerSlot=this.localSlot}listenerSlot;localSlot;lastFogSoundAt=-1/0;lastHealSoundAt=-1/0;ringFloored=!1;sawRingAboveFloor=!1;statusBefore=[];statusWriterUnclaimed=[];statusTrackable=!1;nextAmbienceAt=-1/0;ambienceChunk=0;lastCombatAt=-1/0;setListener(e){this.listenerSlot=e}handleEvents(e,a){try{this.watchZone(a),this.watchAmbience(a),this.openStatusWindow(a);for(const o of e)this.handleEvent(o,a)}catch(o){console.warn("[audio] event dispatch failed:",o)}finally{this.closeStatusWindow(a)}}reset(){this.listenerSlot=this.localSlot,this.lastFogSoundAt=-1/0,this.lastHealSoundAt=-1/0,this.ringFloored=!1,this.sawRingAboveFloor=!1,this.statusBefore=[],this.statusWriterUnclaimed=[],this.statusTrackable=!1,this.nextAmbienceAt=-1/0,this.ambienceChunk=0,this.lastCombatAt=-1/0}static statusTimestamps(e){const a=e.status;return!a||typeof a.stunnedUntil!="number"||typeof a.slowedUntil!="number"?null:{stun:a.stunnedUntil,slow:a.slowedUntil}}openStatusWindow(e){const o=je(e).map(n=>pi.statusTimestamps(n));if(this.statusTrackable=o.length>0&&o.every(n=>n!==null),!!this.statusTrackable)for(let n=0;n<o.length;n++){const s=this.statusBefore[n]??{stun:NaN,slow:NaN},i=o[n];this.statusWriterUnclaimed[n]={stun:i.stun!==s.stun,slow:i.slow!==s.slow}}}closeStatusWindow(e){je(e).forEach((a,o)=>{const n=pi.statusTimestamps(a);n&&(this.statusBefore[o]=n)})}wasStatusRefused(e,a){if(!this.statusTrackable)return!1;const o=this.statusWriterUnclaimed[e];return o?.[a]?(o[a]=!1,!1):!0}watchZone(e){if(!this.ringFloored&&e.phase==="playing"){if(e.safeRadius>P0(e.fighters.length,e.timeRemaining)+.5){this.sawRingAboveFloor=!0;return}this.sawRingAboveFloor&&(this.ringFloored=!0,this.engine.play(E1(),{priority:Je.Critical}))}}watchAmbience(e){if(e.phase!=="playing"||e.elapsed<this.nextAmbienceAt)return;this.nextAmbienceAt=e.elapsed+Eu*1e3;const a=this.ambienceChunk*X1%1;this.ambienceChunk++;const o=je(e);let n=1/0;for(let i=0;i<o.length;i++)for(let r=i+1;r<o.length;r++){const l=Math.hypot(o[i].x-o[r].x,o[i].y-o[r].y);l<n&&(n=l)}const s=e.elapsed-this.lastCombatAt<V1||n<K1;this.engine.play(b1(),{gain:s?G1:Y1,pan:(a*2-1)*Z1,priority:Je.Ambient,key:"ambience"})}handleEvent(e,a){switch(e.type){case"countdown-tick":this.engine.play(k1(e.value),{priority:Je.Critical});break;case"match-started":this.engine.play(M1(),{priority:Je.Critical});break;case"match-ended":{const o=je(a),n=o.length>0&&o.every(i=>i.alive===!0),s=ua(e.winnerId,e.winner)===this.localSlot;this.engine.play(n?S1(s):T1(s),{priority:Je.Critical});break}case"weapon-fired":this.lastCombatAt=a.elapsed,this.playCast(At(a,e.fighterId,e.fighterRole),e.weaponKey,a);break;case"hit-landed":this.lastCombatAt=a.elapsed,this.playHit(e,a);break;case"heal":{if(e.amount<=$0&&a.elapsed-this.lastHealSoundAt<W1)break;this.lastHealSoundAt=a.elapsed;const o=At(a,e.fighterId,e.fighterRole);this.engine.play(m1(),{...this.place(o.x,o.y,a),key:"heal"});break}case"death":{const o=At(a,e.fighterId,e.fighterRole),n=this.place(o.x,o.y,a);this.engine.play(f1(),{...n,priority:Je.Critical,gain:ua(e.fighterId,e.fighterRole)===this.localSlot?1:n.gain});break}case"projectile-destroyed":e.reason==="hit-cover"&&this.engine.play(v1(),{...this.place(e.x,e.y,a),priority:Je.Ambient,key:"cover"});break}}playCast(e,a,o){const n=ce[e.characterId].weapons.find(r=>r.key===a);if(!n)return;if(n.giantSlam){this.engine.play(c1(),{priority:Je.Critical});return}const s=ad(e.characterId,a)?.cast,i=s?this.wrapWeaponHook(s,n,e.characterId,n.damage):J1(n);this.engine.play(i,{...this.place(e.x,e.y,o),key:`cast:${e.characterId}.${a}`})}playHit(e,a){const o=this.place(e.x,e.y,a),n=ua(e.targetId,e.targetRole),s=e.effect==="stun"&&this.wasStatusRefused(n,"stun");if(e.source.kind==="fog"){if(a.elapsed-this.lastFogSoundAt<j1)return;this.lastFogSoundAt=a.elapsed,this.engine.play(g1(),{priority:Je.Ambient,key:"fog"});return}if(e.source.kind==="hazard"){this.engine.play(y1(),{...o,priority:Je.Ambient,key:"hazard"});return}if(e.source.kind==="trail"){this.engine.play(x1(),{...o,priority:Je.Ambient,key:"trail"});return}const i=e.source.weaponKey,r=Fn(a,e.source,e.targetRole),l=ce[r.characterId].weapons.find(d=>d.key===i),h=l?ad(r.characterId,l.key)?.impact:void 0,c=h&&l?this.wrapWeaponHook(h,l,r.characterId,e.amount):d1(e.amount);if(this.engine.play(c,{...o,key:`impact:${r.characterId}.${i}`}),n===this.localSlot){const d=At(a,e.targetId,e.targetRole);this.engine.play(p1(d.hp/d.maxHp),{gain:.9,key:"hurt",priority:Je.Normal})}s&&this.engine.play(u1(),{...o,key:"shrug",priority:Je.Normal})}wrapWeaponHook(e,a,o,n){return s=>e({...s,color:a.color,damage:n,weapon:a,characterId:o})}place(e,a,o){const n=je(o)[this.listenerSlot]??o.player,s=e-n.x,i=a-n.y,r=Math.max(-1,Math.min(1,s/B1))*U1,l=Math.hypot(s,i),h=n1(l,s1,i1);return{pan:r,gain:h}}}function J1(t){return t.type==="melee"?l1(t.damage,t.cone??90):t.type==="self"?h1():r1(t.damage)}const kr="/food-arena/",od=`${kr.endsWith("/")?kr:`${kr}/`}audio/bounce-and-bash.mp3`,nd=.45,Tu="fa.audio.music";function Q1(){try{const t=localStorage.getItem(Tu);if(t){const e=JSON.parse(t);return{volume:typeof e.volume=="number"?Math.min(1,Math.max(0,e.volume)):nd,enabled:e.enabled!==!1}}}catch{}return{volume:nd,enabled:!0}}function sd(t){try{localStorage.setItem(Tu,JSON.stringify(t))}catch{}}class eb{el=null;source=null;gain=null;state=Q1();wanted=!1;listeners=new Set;fadeToken=0;loadError=null;suppressed=!1;ensureGraph(){if(typeof document>"u")return!1;const e=ft(),a=e.context,o=e.busInput;if(!a||!o||typeof a.createMediaElementSource!="function")return!1;if(this.source)return!0;if(!this.el){const n=document.createElement("audio");n.src=od,n.loop=!0,n.preload="auto",n.volume=1,n.crossOrigin="anonymous",n.addEventListener("error",()=>{const s=n.error?n.error.code:0;this.loadError=`music track failed to load (MediaError ${s}) from ${n.currentSrc||n.src}`,console.warn(`[audio] ${this.loadError}`),this.emit()},{once:!0}),this.el=n}try{return this.source=a.createMediaElementSource(this.el),this.gain=a.createGain(),this.gain.gain.value=this.state.enabled?this.state.volume:0,this.source.connect(this.gain).connect(o),!0}catch{return this.source=null,this.gain=null,!1}}play(){if(this.wanted=!0,this.suppressed||!this.state.enabled||!this.ensureGraph()||!this.el)return;const e=this.el.play();e&&typeof e.catch=="function"&&e.catch(()=>{})}pause(){this.wanted=!1,this.el?.pause()}onUnlock(){this.wanted&&this.play()}isPlaying(){return!!this.el&&!this.el.paused}getLoadError(){return this.loadError}getTrackUrl(){return this.el?this.el.src:od}getVolume(){return this.state.volume}setVolume(e){this.state.volume=Math.min(1,Math.max(0,e)),sd(this.state),this.applyGain(),this.emit()}isEnabled(){return this.state.enabled}setEnabled(e){this.state.enabled=e,sd(this.state),this.applyGain(),e?this.play():this.el?.pause(),this.emit()}fadeOut(e=.6){if(this.suppressed=!0,!this.el||this.el.paused)return;this.applyGain(0,e);const a=this.el;window.setTimeout(()=>{this.fadeToken===o&&a.pause()},e*1e3+40);const o=++this.fadeToken}fadeIn(e=.8){if(this.fadeToken++,this.suppressed=!1,!this.state.enabled||!this.ensureGraph()||!this.el)return;const a=this.el.paused;if(a){this.gain&&(this.gain.gain.value=0);const o=this.el.play();o&&typeof o.catch=="function"&&o.catch(()=>{})}this.applyGain(void 0,a?e:.25)}duck(e=.35){this.applyGain(this.state.volume*Math.min(1,Math.max(0,e)))}unduck(){this.applyGain()}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}applyGain(e,a=.08){if(!this.gain)return;const n=ft().context,s=this.state.enabled?e??this.state.volume:0;try{if(n){const i=n.currentTime;this.gain.gain.cancelScheduledValues(i),this.gain.gain.setValueAtTime(this.gain.gain.value,i),this.gain.gain.linearRampToValueAtTime(s,i+a)}else this.gain.gain.value=s}catch{this.gain.gain.value=s}}emit(){for(const e of this.listeners)try{e()}catch{}}}let ws=null;function lt(){if(!ws){ws=new eb;const t=ws;ft().onChange(()=>{ft().getState()==="running"&&t.onUnlock()})}return ws}let bs=null;function ft(){return bs||(bs=new t1,ab(bs)),bs}function tb(t){return new pi(ft(),t)}const Se={setVolume(t){ft().setVolume(t)},getVolume(){return ft().getVolume()},setMuted(t){ft().setMuted(t)},isMuted(){return ft().isMuted()},toggleMuted(){return ft().toggleMuted()},onChange(t){return ft().onChange(t)},getState(){return ft().getState()},unlock(){ft().unlock()},previewClick(){ft().play(A1(),{key:"ui"})},music:{play(){lt().play()},pause(){lt().pause()},isPlaying(){return lt().isPlaying()},getVolume(){return lt().getVolume()},setVolume(t){lt().setVolume(t)},isEnabled(){return lt().isEnabled()},setEnabled(t){lt().setEnabled(t)},fadeOut(t){lt().fadeOut(t)},fadeIn(t){lt().fadeIn(t)},duck(t){lt().duck(t)},unduck(){lt().unduck()},onChange(t){return lt().onChange(t)},getLoadError(){return lt().getLoadError()},getTrackUrl(){return lt().getTrackUrl()}}};function ab(t){typeof window>"u"||(window.__audio={engine:t,tap:()=>t.tap(),connectTap:e=>t.connectTap(e),stats:()=>({state:t.getState(),activeVoices:t.activeVoices(),started:t.counters.started,droppedBudget:t.counters.droppedBudget,droppedThrottle:t.counters.droppedThrottle,droppedNotRunning:t.counters.droppedNotRunning,volume:t.getVolume(),muted:t.isMuted()}),get music(){const e=lt();return{url:e.getTrackUrl(),error:e.getLoadError(),playing:e.isPlaying(),enabled:e.isEnabled()}}})}const O={ink:"#1a1224",cream:"#FFF3DE",white:"#FFFFFF",gold:"#F4A300",goldDark:"#B87400",mustard:"#FFC93C",mustardHi:"#FFDD6B",ketchup:"#D62839",tomato:"#E63946",tomatoHi:"#FF9E9E",lettuce:"#7CB518",leafDark:"#4E8B2B",water:"#1E90D8",waterHi:"#5BC8F5",ice:"#8FE1FF",iceHi:"#BFF0FF",grape:"#7A4BC4",grapeHi:"#9B6BE0",grapeDark:"#5B2E8C",violet:"#B497D6",wood:"#8B4A22",woodHi:"#B4622A",meat:"#8B3A2E",meatHi:"#D98A72",patty:"#A05A2C",pattyDark:"#5A2E17",steel:"#DCD6E8",candy:"#FF6FA5",candyHi:"#FFB3D1",flame:"#FF7A2F"};function Bo(t,e,a,o=12,n=12){const s=[];for(let i=0;i<t*2;i++){const r=i%2===0?e:a,l=Math.PI*i/t-Math.PI/2;s.push(`${(o+r*Math.cos(l)).toFixed(2)} ${(n+r*Math.sin(l)).toFixed(2)}`)}return`M${s.join("L")}Z`}const ob={patty:`
<ellipse cx="12" cy="14.3" rx="8.5" ry="4.5" fill="${O.pattyDark}"/>
<ellipse cx="12" cy="11.5" rx="8.5" ry="4.5" fill="${O.patty}"/>
<path d="M6.8 10.4 10 12.3M10.9 9.2 14.1 11.1M15.2 10.1 17.8 11.6" stroke="${O.pattyDark}" stroke-width="1.5"/>`,meat:`
<path d="M2.6 12.8c0-4.6 3.4-7.6 7.6-7.6 4.3 0 6.9 2.9 6.9 6.5 0 4.9-3.4 8.7-7.6 8.7-4.1 0-6.9-3.2-6.9-7.6z" fill="${O.meat}"/>
<path d="M6.8 9.8c2.6-.8 4.5.2 5.5 2.5" stroke="${O.meatHi}" stroke-width="1.8"/>
<path d="M14.4 7.6h4.8a1.5 1.5 0 0 1 0 3h-4.8a1.5 1.5 0 0 1 0-3z" fill="${O.cream}"/>
<circle cx="19.6" cy="7.2" r="1.9" fill="${O.cream}"/>
<circle cx="19.6" cy="10.6" r="1.9" fill="${O.cream}"/>`,tomato:`
<circle cx="12" cy="13.7" r="7.6" fill="${O.tomato}"/>
<path d="M12 7.2c-1.5-1.4-3.1-1.8-4.4-1.4.1 1.5.9 2.7 2.1 3.4M12 7.2c1.5-1.4 3.1-1.8 4.4-1.4-.1 1.5-.9 2.7-2.1 3.4z" fill="${O.leafDark}" stroke-width="1.4"/>
<path d="M12 3.4v3.6" stroke="${O.leafDark}" stroke-width="1.9"/>
<path d="M8.5 11a4.4 4.4 0 0 1 2.4-2.3" stroke="${O.tomatoHi}" stroke-width="1.7"/>`,lettuce:`
<path d="M12 20.8c-5.4 0-8.9-3.5-8.9-7.6 0-1.7 1.1-2.3 2.1-1.7.4-1.9 1.9-2.5 2.9-1.4.6-1.9 2.3-2.5 3.3-1.3.9-1.9 2.7-2.1 3.7-.6 1.2-1.1 2.9-.2 2.9 1.4 1.5-.2 2.7.9 2.5 2.3.6 3.9-2.7 8.2-8.2 8.2z" fill="${O.lettuce}"/>
<path d="M12 20.2v-8.4" stroke="${O.leafDark}" stroke-width="1.6"/>`,onion:`
<path d="M12 20.8c-4.1 0-6.8-2.7-6.8-6.4 0-3.5 2.7-6.6 6.8-8.6 4.1 2 6.8 5.1 6.8 8.6 0 3.7-2.7 6.4-6.8 6.4z" fill="#F4E6F7"/>
<path d="M12 6.2v14.6" stroke="${O.violet}" stroke-width="1.4"/>
<path d="M8.4 8.6c-1.1 2.5-1.3 5.6 0 9.1M15.6 8.6c1.1 2.5 1.3 5.6 0 9.1" stroke="${O.violet}" stroke-width="1.4"/>
<path d="M12 6.4c.4-2.1 1.9-3.2 3.6-3.4-.4 2.1-1.7 3.2-3.6 3.4z" fill="${O.lettuce}" stroke-width="1.3"/>`,candy:`
<ellipse cx="12" cy="12" rx="5.3" ry="4.7" fill="${O.candy}"/>
<path d="M6.8 10.1 2.7 7.2v9.6l4.1-2.9z" fill="${O.candyHi}"/>
<path d="M17.2 10.1 21.3 7.2v9.6l-4.1-2.9z" fill="${O.candyHi}"/>
<path d="M9.7 10.4a3 3 0 0 1 2-1.5" stroke="${O.cream}" stroke-width="1.6"/>`,swirl:`
<g fill="${O.water}">
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(120 12 12)"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(240 12 12)"/>
</g>
<circle cx="12" cy="12" r="1.8" fill="${O.cream}" stroke-width="1.4"/>`,chick:`
<path d="M10.4 4.4 11 1.8 12.8 4.2" stroke-width="1.8"/>
<ellipse cx="11.4" cy="15.8" rx="7.2" ry="6" fill="${O.mustardHi}"/>
<circle cx="11.6" cy="9.4" r="5.4" fill="${O.mustardHi}"/>
<path d="M16.6 8.2 22.2 10.2 16.6 12.2z" fill="${O.gold}"/>
<circle cx="13.4" cy="8.2" r="1.4" fill="${O.ink}" stroke="none"/>
<path d="M8.4 15a4 4 0 0 0 4.6 4.4" stroke="${O.gold}" stroke-width="1.9"/>`,burst:`<path d="${Bo(9,10.2,4.6)}" fill="${O.gold}"/>
<path d="${Bo(9,5.6,2.4)}" fill="${O.mustardHi}" stroke-width="1.3"/>`,hammer:`
<path d="M5.2 3.4h13.6a1.7 1.7 0 0 1 1.7 1.7v4.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V5.1a1.7 1.7 0 0 1 1.7-1.7z" fill="#C9B8DE"/>
<path d="M16.2 3.6v7.4" stroke-width="1.4"/>
<path d="M10.1 11h3.8v10.2h-3.8z" fill="${O.patty}"/>`,dough:`
<circle cx="8" cy="15.4" r="5.1" fill="#E6D4B0"/>
<circle cx="16.4" cy="14.6" r="4.3" fill="#EFE0C4"/>
<circle cx="12.6" cy="7.4" r="4.6" fill="#F7ECD6"/>
<path d="M10.8 5.9a2.6 2.6 0 0 1 1.8-1.4" stroke="${O.white}" stroke-width="1.5"/>`,cheese:`
<path d="M2.4 17.4 20.4 5.6a1.4 1.4 0 0 1 1.2 1.4v10.4a1.4 1.4 0 0 1-1.4 1.4H3.8a1.4 1.4 0 0 1-1.4-1.4z" fill="${O.mustard}"/>
<circle cx="9.4" cy="15.2" r="1.9" fill="#DE9A12" stroke="none"/>
<circle cx="16.2" cy="12.2" r="1.6" fill="#DE9A12" stroke="none"/>
<circle cx="17.6" cy="16.6" r="1.3" fill="#DE9A12" stroke="none"/>`,rice:`
<path d="M3.4 13.4h17.2c0 4.6-3.8 8-8.6 8s-8.6-3.4-8.6-8z" fill="${O.waterHi}"/>
<path d="M5.6 13.4a2.2 2.2 0 0 1 2.8-2 2.4 2.4 0 0 1 3.6-1.6 2.4 2.4 0 0 1 3.6 1.6 2.2 2.2 0 0 1 2.8 2z" fill="${O.white}"/>
<path d="M2.4 13.4h19.2" stroke-width="1.8"/>`,seaweed:`
<path d="M12 21.6V6" stroke="#2E6B3A" stroke-width="2.3"/>
<path d="M11.8 10c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>
<path d="M12.2 15.4c4.6 0 7-2.6 7-6.8-4.6 0-7 2.6-7 6.8z" fill="#4E9B5A"/>
<path d="M11.8 20.8c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>`,fish:`
<path d="M2.4 12.2c2.1-4 5.6-6.1 9.7-6.1 3.5 0 6 1.7 7.3 4.2-1.3 4.8-4.4 7.9-9 7.9-3.5 0-6-2.1-8-6z" fill="${O.water}"/>
<path d="M18.9 10.1 22.4 7v10.2l-3.5-3.4z" fill="${O.waterHi}"/>
<circle cx="7.1" cy="10.7" r="1.2" fill="${O.ink}" stroke="none"/>`,puffer:`
<path d="M11 1.8v6.8a4.1 4.1 0 1 1-8.2 0v-1.2" stroke-width="2.8"/>
<path d="M2.8 8.2 5.4 11.6" stroke-width="2.2"/>
<path d="M10.4 17.4c1.2-2.2 3.1-3.4 5.4-3.4 2 0 3.4 1 4.2 2.4-.8 2.7-2.6 4.5-5.2 4.5-2 0-3.4-1.2-4.4-3.5z" fill="${O.gold}"/>
<path d="M19.8 16.4 22.4 14.6v5.9l-2.6-1.9z" fill="${O.mustard}"/>
<circle cx="13.2" cy="16.9" r="1.1" fill="${O.ink}" stroke="none"/>`,droplets:`
<path d="M8.4 20.6a4.9 4.9 0 0 1-4.9-4.9c0-2.9 4.9-8.4 4.9-8.4s4.9 5.5 4.9 8.4a4.9 4.9 0 0 1-4.9 4.9z" fill="${O.water}"/>
<path d="M17.6 13.6a3.3 3.3 0 0 1-3.3-3.3c0-2 3.3-5.7 3.3-5.7s3.3 3.7 3.3 5.7a3.3 3.3 0 0 1-3.3 3.3z" fill="${O.waterHi}"/>`,noodle:`
<path d="M16.4 2 13 11.4" stroke="${O.woodHi}" stroke-width="2.6"/>
<path d="M21.7 3.9 18.3 13.3" stroke="${O.wood}" stroke-width="2.6"/>
<path d="M3.2 13.2h17.6c0 4.8-3.9 8.4-8.8 8.4s-8.8-3.6-8.8-8.4z" fill="${O.ketchup}"/>
<path d="M5.6 13.2a2.1 2.1 0 0 1 2.3-2.2 2.4 2.4 0 0 1 3.1-2.3 2.6 2.6 0 0 1 4 .2 2.4 2.4 0 0 1 3.3 2.1 2.1 2.1 0 0 1 1.5 2.2z" fill="${O.mustardHi}"/>
<path d="M8.8 11.2c0-1.6.9-2.6 2-2.6M13.6 11.4c0-1.7.9-2.7 2-2.7" stroke="#D9A417" stroke-width="1.4"/>
<path d="M2.2 13.2h19.6" stroke-width="1.8"/>`,wave:`
<path d="M2.4 18.6C4 11 8.5 6.6 13.6 6.6c4.1 0 7 2.5 7 5.8 0 2.7-1.9 4.6-4.2 4.6-2.1 0-3.6-1.4-3.6-3.2 0-1.6 1.1-2.6 2.4-2.6.9 0 1.7.5 1.9 1.3-1.4-.3-2.3.5-2.3 1.4 0 1 .8 1.7 1.9 1.7 1.5 0 2.5-1.2 2.5-2.9 0-2.3-2.1-4.2-5.2-4.2-4.4 0-7.9 3.8-9.4 10.1z" fill="${O.water}"/>
<path d="M2 21c2.7-1.5 4.4 1 7.1-.4M11.9 20.6c2.7-1.5 4.4 1 7.1-.4" stroke="${O.waterHi}" stroke-width="1.7"/>`,shards:`
<path d="M2.2 3.4 12.6 8.8 6.6 18.2z" fill="${O.ice}"/>
<path d="M15.2 2.6 22 11.4 13.4 13.6z" fill="${O.iceHi}"/>
<path d="M12.4 16 20.8 15.4 17 21.8z" fill="${O.ice}"/>`,cap:`
<g transform="rotate(9 12 12.4)">
<ellipse cx="12" cy="15" rx="9.2" ry="3.2" fill="#12669E"/>
<path d="M2.8 12h18.4v3H2.8z" fill="#12669E" stroke="none"/>
<ellipse cx="12" cy="12" rx="9.2" ry="3.2" fill="${O.water}"/>
<ellipse cx="12" cy="11.8" rx="5.6" ry="1.5" fill="${O.iceHi}" stroke-width="1.3"/>
</g>`,mustardblast:`
<path d="M9.7 11.4h4.6a4.3 4.3 0 0 1 0 8.6H9.7a4.3 4.3 0 0 1 0-8.6z" fill="#E8B15C"/>
<path d="M5 6.6h14a3.7 3.7 0 0 1 0 7.4H5a3.7 3.7 0 0 1 0-7.4z" fill="#C2452F"/>
<path d="M5.6 12 9 8.8 12.4 12 15.8 8.8 19.2 12" stroke="${O.mustard}" stroke-width="2.8"/>`,ketchupslip:`
<path d="M4.6 8.6h7.6a2.1 2.1 0 0 1 2.1 2.1v8.6a2.1 2.1 0 0 1-2.1 2.1H4.6a2.1 2.1 0 0 1-2.1-2.1v-8.6a2.1 2.1 0 0 1 2.1-2.1z" fill="${O.tomato}"/>
<path d="M6.6 3.2h3.6v5.4H6.6z" fill="${O.tomato}"/>
<path d="M7.2 1.4h2.4v1.9H7.2z" fill="#9E1B27"/>
<path d="M3.4 12.4h10" stroke="${O.cream}" stroke-width="2"/>
<path d="M18.4 8.6c2.4 0 3.6 1.5 3.4 3-.2 1.4-1.5 1.4-1.5 2.6 0 1.4-1.5 2.3-2.8 1.7-1.2-.6-2.4.3-3-.9-.6-1.2.3-1.9-.3-3 -.6-1.2.6-2.4 2-2.4 1 0 1.2-1 2.2-1z" fill="${O.tomato}"/>`,slash:`
<path d="M2.4 21.6C2 9 9 2 21.6 2.4 15 8 11 12 2.4 21.6z" fill="${O.steel}"/>
<path d="M20.4 3.6C13.4 7.4 8.2 12.4 4.4 18.8" stroke="${O.white}" stroke-width="2.2"/>
<path d="M8.6 21.4c3.4-2.8 6.2-5.6 8.4-8.6M14.4 21.6c2.4-2 4.4-4 6-6.2" stroke="#9C93B0" stroke-width="1.8"/>`,wrap:`
<path d="M4.4 17.6 15.6 6.4a4.4 4.4 0 0 1 3.6 3.6L8 21.2a4.4 4.4 0 0 1-3.6-3.6z" fill="#EFE0C4"/>
<path d="M15.6 6.4a4.4 4.4 0 0 1 3.6 3.6l2.8-2.8a4.4 4.4 0 0 0-3.6-3.6z" fill="#E9B44C"/>
<path d="M8.4 13.6 11.2 16.4M11.6 10.4 14.4 13.2" stroke="#CBB289" stroke-width="1.8"/>`,lollipop:`
<path d="M12 21.4v-6.6" stroke-width="2.3"/>
<circle cx="12" cy="9" r="6.3" fill="${O.candy}"/>
<path d="M12 9a2.1 2.1 0 1 0 2.1 2.1c0-2.3-2.3-3.7-4.6-2.9" stroke="${O.cream}" stroke-width="1.9"/>`,egg:`
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="#E4CFA6"/>
<path d="M12 4.8a6.7 8.3 0 0 1 0 16.6z" fill="#C9AE7C" stroke="none"/>
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="none"/>
<path d="M8.4 15.4a3.6 3.6 0 0 0 1.9 3.8" stroke="#FFF8EA" stroke-width="2"/>`,honey:`
<path d="M5.4 3.4h13.2v3.4H5.4z" fill="${O.gold}"/>
<path d="M8.2 6.6h7.6v2.6H8.2z" fill="#C98A00"/>
<path d="M6.6 9c-.9 2.6-1.3 4.9-1.3 7 0 3.3 2.2 5.2 6.7 5.2s6.7-1.9 6.7-5.2c0-2.1-.4-4.4-1.3-7z" fill="#C98A00"/>
<path d="M6.6 12.8h10.8v3.6H6.6z" fill="${O.mustardHi}" stroke-width="1.4"/>
<path d="M18.3 9.2c1.7 2.4 2.5 4.2 2.5 5.5 0 1.5-.9 2.5-2.2 2.5s-2.2-1-2.2-2.5c0-1.3.6-3 1.9-5.5z" fill="${O.mustardHi}"/>`},ra={haze:"#5FBFA8",hazeDark:"#2E7C6B",cap:"#7A4A34",capHi:"#A9694A"},nb={tenderiser:`
<path d="M4.6 20.4 10.2 14.8" stroke-width="3.4"/>
<path d="M4.6 20.4 10.2 14.8" stroke="${O.patty}" stroke-width="1.9"/>
<path d="M11.6 8.2 17.4 14l-3.9 3.9L7.7 12.1z" fill="${O.wood}"/>
<path d="M13.1 6.7 18.9 12.5 17.4 14l-5.8-5.8z" fill="${O.woodHi}"/>
<circle cx="12.4" cy="12.4" r="0.75" fill="${O.pattyDark}" stroke="none"/>
<circle cx="14.6" cy="10.2" r="0.75" fill="${O.pattyDark}" stroke="none"/>
<circle cx="14.7" cy="14.6" r="0.75" fill="${O.pattyDark}" stroke="none"/>
<path d="M16.6 5.6 19 3.2l2.4 2.4M16.6 9.4 19 7l2.4 2.4" stroke="${O.gold}" stroke-width="1.9" fill="none"/>`,springform:`
<path d="M3.4 15.6C5 8.2 9.2 4.6 14.4 4.6" fill="none" stroke-width="4.4"/>
<path d="M3.4 15.6C5 8.2 9.2 4.6 14.4 4.6" fill="none" stroke="${O.mustard}" stroke-width="2.2"/>
<path d="M11.6 2.2 15 4.6l-3.2 2.6" stroke-width="3.6" fill="none"/>
<path d="M11.6 2.2 15 4.6l-3.2 2.6" stroke="${O.mustard}" stroke-width="1.8" fill="none"/>
<path d="M4.2 16.4h15.6v3.1a1.9 1.9 0 0 1-1.9 1.9H6.1a1.9 1.9 0 0 1-1.9-1.9z" fill="${O.steel}"/>
<path d="M3.2 15.2h17.6v1.9H3.2z" fill="${O.white}"/>
<path d="M18.1 17.2v3.4" stroke-width="1.4"/>
<circle cx="19.6" cy="18.9" r="1.4" fill="${O.gold}"/>`,warm_milk:`
<path d="M4.7 9.4h10.7v6.9a3.3 3.3 0 0 1-3.3 3.3H8a3.3 3.3 0 0 1-3.3-3.3z" fill="${O.cream}"/>
<path d="M15.4 11h1.5a2.3 2.3 0 0 1 0 4.6h-1.5"/>
<path d="M7.6 12.2h4.8l-4.8 4.2h4.8" stroke="${O.grape}" stroke-width="1.9" fill="none"/>
<path d="M8.6 2.8c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>
<path d="M12.2 2.4c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>`,pompa:`
<path d="M11.1 3.2h1.8v9.3h-1.8z" fill="${O.wood}"/>
<path d="M6.5 12.5h11c0 4.2-2.2 7.4-5.5 8.4-3.3-1-5.5-4.2-5.5-8.4z" fill="${O.ketchup}"/>
<path d="M5.5 12.5h13" stroke-width="2"/>`,squid_ink:`
<path d="M12 3.3c3.5 0 6.4 2.3 6.4 5.4 0 1.9-1 3.1-1 4.6 0 1.9 1.8 2.5 1.8 4.1 0 1.4-1.2 2.4-2.7 2.4-1.4 0-2.1-.8-3.3-.8-1.4 0-2 1.2-3.7 1.2-2 0-3.3-1.4-3.3-3.1 0-1.6 1-2.4 1-3.7 0-1.6-1.6-2.6-1.6-4.7 0-3.1 2.9-5.4 6.4-5.4z" fill="${O.grapeDark}"/>
<circle cx="20.6" cy="6.2" r="1.5" fill="${O.grapeDark}"/>
<circle cx="3.5" cy="18.4" r="1.2" fill="${O.grapeDark}"/>`,disposal:`
<ellipse cx="12" cy="12" rx="9.3" ry="8.6" fill="${O.steel}"/>
<ellipse cx="12" cy="12" rx="6" ry="5.4" fill="${O.grapeDark}"/>
<path d="M12 6.9c2.9 0 5.2 2.1 5.2 4.6" stroke="${O.grapeHi}" stroke-width="1.8" fill="none"/>
<path d="M6.6 12.5c0-2.2 1.9-4 4.4-4.3" stroke="${O.grapeHi}" stroke-width="1.6" fill="none"/>
<path d="M12 6.6v10.8M6.9 12h10.2" stroke-width="1.7"/>`,blue_cheese:`
<path d="M6.9 17.8h10.3a3.9 3.9 0 0 0 .4-7.8 4.8 4.8 0 0 0-8.9-2.3 4 4 0 0 0-1.8 10.1z" fill="${ra.haze}"/>
<circle cx="9.7" cy="13.4" r="1.15" fill="${ra.hazeDark}" stroke="none"/>
<circle cx="13.4" cy="11.3" r="1" fill="${ra.hazeDark}" stroke="none"/>
<circle cx="15.7" cy="14.4" r="0.9" fill="${ra.hazeDark}" stroke="none"/>
<circle cx="8.6" cy="20.6" r="1.1" fill="${ra.haze}"/>
<circle cx="14.4" cy="20.8" r="0.9" fill="${ra.haze}"/>`,shiitake:`
<path d="M2.9 15.4c0-3 2.2-5.4 5-5.4s5 2.4 5 5.4z" fill="${ra.cap}"/>
<path d="M11.6 14.2c0-3.2 2.4-5.8 5.3-5.8s5.3 2.6 5.3 5.8z" fill="${ra.cap}"/>
<path d="M5.6 12.6c0-3.9 2.9-7 6.4-7s6.4 3.1 6.4 7z" fill="${ra.capHi}"/>
<path d="M5.6 12.6h12.8v1.5a1.6 1.6 0 0 1-1.6 1.6H7.2a1.6 1.6 0 0 1-1.6-1.6z" fill="${O.cream}"/>
<path d="M9.4 20.4 12 17.6l2.6 2.8" stroke="${O.ketchup}" stroke-width="2.2" fill="none"/>`,liquorice:`
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke-width="5"/>
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke="${O.ketchup}" stroke-width="2.4"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke-width="5"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke="${O.ketchup}" stroke-width="2.4"/>`,leftovers:`
<path d="M4.6 2.9h9.9a1.8 1.8 0 0 1 1.8 1.8v14.6a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V4.7a1.8 1.8 0 0 1 1.8-1.8z" fill="${O.steel}"/>
<path d="M2.8 8.8h13.5" stroke-width="1.6"/>
<path d="M13.1 5.2v2.2M13.1 10.6v2.6" stroke-width="1.6"/>
<path d="M16.3 4.9 21.6 3v18l-5.3-1.9z" fill="${O.mustardHi}"/>
<path d="M17.4 16.2 19.2 14l1.8 2.2" stroke-width="1.9" fill="none"/>`};function ys(t,e,a,o=""){return`
<path d="M3.4 9.4h17.2v9.4a1.7 1.7 0 0 1-1.7 1.7H5.1a1.7 1.7 0 0 1-1.7-1.7z" fill="${t}"/>
<path d="M3.4 9.4 6.6 5.6h10.8l3.2 3.8z" fill="${e}"/>
<path d="M9.8 7.0h4.4v5.6H9.8z" fill="${a}" stroke-width="1.3"/>
${o}`}const sb=`<path d="M12 0.6c2.6 2.2 3.7 3.9 3.2 5.5-.9-.8-1.6-1.1-2.3-.9.7 1.9.3 3.1-.9 4-1.2-.9-1.6-2.1-.9-4-.7-.2-1.4.1-2.3.9-.5-1.6.6-3.3 3.2-5.5z" fill="${O.flame}" stroke-width="1.3"/>`,ib=`<path d="M12 0.4c2.4.8 3.6 2.4 3.6 4.6-2.4-.7-3.6-2.3-3.6-4.6zM12 0.4c-2.4.8-3.6 2.4-3.6 4.6C10.8 4.3 12 2.7 12 .4z" fill="${O.lettuce}" stroke-width="1.3"/>`,rb=`<path d="M12 5.6C9.2 1.6 4.8 2.8 6.2 5.6M12 5.6C14.8 1.6 19.2 2.8 17.8 5.6" fill="${O.mustard}" stroke-width="1.4"/>`,lb=`<path d="M4.9 13.4a2.6 2.6 0 0 1 5.2 0z" fill="#B4622A" stroke-width="1.2"/>
<path d="M4.7 13.4h5.6v1.5H4.7z" fill="${O.lettuce}" stroke-width="1.2"/>
<path d="M4.9 15h5.2a2.2 2.2 0 0 1-5.2 0z" fill="#B4622A" stroke-width="1.2"/>`,hb=Array.from({length:8},(t,e)=>`<rect x="10.3" y="0.9" width="3.4" height="5.4" rx="1.2" fill="${O.gold}" transform="rotate(${e*45} 12 12)"/>`).join(""),cb={coin:`
<circle cx="12" cy="12" r="9.5" fill="${O.goldDark}"/>
<circle cx="12" cy="12" r="7.6" fill="${O.gold}" stroke="none"/>
<path d="${Bo(5,5.8,2.5,12,12)}" fill="${O.cream}" stroke="none"/>`,gem:`
<path d="M6.6 3.9h10.8l3.6 5.3L12 20.4 3 9.2z" fill="${O.water}"/>
<path d="M6.6 3.9 8.9 9.2h6.2l2.3-5.3z" fill="${O.ice}" stroke-width="1.3"/>
<path d="M3 9.2h18" stroke-width="1.3"/>
<path d="M8.9 9.2 12 20.4l3.1-11.2" stroke-width="1.3"/>`,trophy:`
<path d="M7.1 3.3h9.8v5a4.9 4.9 0 0 1-9.8 0z" fill="${O.gold}"/>
<path d="M7.1 4.9H4.3a3.3 3.3 0 0 0 3.3 4.3" stroke-width="1.8"/>
<path d="M16.9 4.9h2.8a3.3 3.3 0 0 1-3.3 4.3" stroke-width="1.8"/>
<path d="M12 13.1v3.3" stroke-width="2.2"/>
<path d="M7.9 20.7h8.2l-.8-2.6a1.2 1.2 0 0 0-1.2-.9h-4.2a1.2 1.2 0 0 0-1.2.9z" fill="${O.mustard}"/>
<path d="M9.6 5.1a3.4 3.4 0 0 0 .5 4.5" stroke="${O.cream}" stroke-width="1.4"/>`,star:`<path d="${Bo(5,9.4,4.1)}" fill="${O.mustard}"/>
<path d="M12 4.6 10.6 9" stroke="${O.mustardHi}" stroke-width="1.4"/>`,sparkle:`
<path d="M10.4 1.8c1.5 5.4 2.9 6.8 8.3 8.3-5.4 1.5-6.8 2.9-8.3 8.3-1.5-5.4-2.9-6.8-8.3-8.3 5.4-1.5 6.7-2.9 8.3-8.3z" fill="${O.mustard}"/>
<path d="M18.6 14.4c.7 2.6 1.4 3.3 4 4-2.6.7-3.3 1.4-4 4-.7-2.6-1.4-3.3-4-4 2.6-.7 3.3-1.4 4-4z" fill="${O.mustardHi}" stroke-width="1.5"/>`,flag:`
<path d="M5.6 21.2V3.2" stroke-width="2.2"/>
<path d="M5.6 4h13.6v9.2H5.6z" fill="${O.cream}"/>
<path d="M5.6 4h3.4v3.06H5.6zM12.4 4h3.4v3.06h-3.4zM9 7.06h3.4v3.07H9zM15.8 7.06h3.4v3.07h-3.4zM5.6 10.13h3.4v3.07H5.6zM12.4 10.13h3.4v3.07h-3.4z" fill="${O.ink}" stroke="none"/>`,pin:`
<path d="M12 21.4s6.7-6.5 6.7-11.1a6.7 6.7 0 1 0-13.4 0c0 4.6 6.7 11.1 6.7 11.1z" fill="${O.ketchup}"/>
<circle cx="12" cy="10.2" r="2.6" fill="${O.cream}"/>`,chest:`
<path d="M3.1 11.6h17.8v6.7a1.7 1.7 0 0 1-1.7 1.7H4.8a1.7 1.7 0 0 1-1.7-1.7z" fill="${O.wood}"/>
<path d="M3.1 8.2a8.9 4.2 0 0 1 17.8 0v3.4z" fill="${O.woodHi}"/>
<path d="M2.6 10.2h18.8v3H2.6z" fill="${O.gold}" stroke-width="1.4"/>
<path d="M10.3 9.8h3.4v5.4h-3.4z" fill="${O.mustard}" stroke-width="1.4"/>
<circle cx="12" cy="12.9" r="0.85" fill="${O.wood}" stroke="none"/>`,boxBurger:ys(O.gold,O.mustard,O.ketchup,lb),boxPineapple:ys(O.grape,O.grapeHi,O.mustard,ib),boxRed:ys(O.ketchup,"#E9536A",O.mustard,rb),boxFire:ys(O.grapeDark,O.grape,O.flame,sb),gift:`
<path d="M4 10.4h16v8.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.6z" fill="${O.ketchup}"/>
<path d="M2.6 6.4h18.8v4H2.6z" fill="#E9536A"/>
<path d="M10.2 6.4h3.6v13.8h-3.6z" fill="${O.mustard}" stroke-width="1.3"/>
<path d="M12 6.2c-2.6-3.4-6.2-2.4-5 .2M12 6.2c2.6-3.4 6.2-2.4 5 .2" fill="${O.mustard}" stroke-width="1.4"/>`,gear:`${hb}
<circle cx="12" cy="12" r="7.4" fill="${O.gold}"/>
<circle cx="12" cy="12" r="3.3" fill="${O.cream}"/>`,lock:`
<path d="M7.5 10.4V7.9a4.5 4.5 0 0 1 9 0v2.5" stroke-width="1.9"/>
<path d="M4.4 10.2h15.2a1.9 1.9 0 0 1 1.9 1.9v6.6a1.9 1.9 0 0 1-1.9 1.9H4.4a1.9 1.9 0 0 1-1.9-1.9v-6.6a1.9 1.9 0 0 1 1.9-1.9z" fill="${O.gold}"/>
<circle cx="12" cy="14.4" r="1.7" fill="${O.ink}" stroke="none"/>
<path d="M12 15.4v2.6" stroke-width="1.9"/>`,play:'<path d="M7.6 4.2 19.4 12 7.6 19.8z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>',pause:`
<path d="M6.4 4.4h4.2v15.2H6.4z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>
<path d="M13.4 4.4h4.2v15.2h-4.2z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>`,back:'<path d="M15.2 4.4 7.4 12l7.8 7.6" stroke-width="2.8"/>',close:'<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" stroke-width="2.8"/>',check:'<path d="M4.6 12.4 9.4 17.4 19.4 6.8" stroke-width="3"/>',home:`
<path d="M3 11.6 12 3.4l9 8.2" stroke-width="2.1"/>
<path d="M5.4 10.6h13.2v9.8H5.4z" fill="${O.gold}"/>
<path d="M9.6 14h4.8v6.4H9.6z" fill="${O.wood}"/>`,swap:`
<path d="M4.6 10.2a7.4 7.4 0 0 1 12.6-3.6" stroke-width="2.2"/>
<path d="M17.6 2.9v4.2h-4.2" stroke-width="2.2"/>
<path d="M19.4 13.8a7.4 7.4 0 0 1-12.6 3.6" stroke-width="2.2"/>
<path d="M6.4 21.1v-4.2h4.2" stroke-width="2.2"/>`,mute:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${O.cream}"/>
<path d="M15.4 9.4 20.6 14.6M20.6 9.4 15.4 14.6" stroke="${O.tomato}" stroke-width="2.4"/>`,sound:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${O.cream}"/>
<path d="M15.2 9a4.2 4.2 0 0 1 0 6" stroke-width="1.9"/>
<path d="M18 6.4a8 8 0 0 1 0 11.2" stroke-width="1.9"/>`,cone:`
<path d="M12 3 18.8 18.6H5.2z" fill="${O.gold}"/>
<path d="M9.3 11.4h5.4M8 15h8" stroke="${O.cream}" stroke-width="2.1"/>
<path d="M3.2 18.4h17.6a1.2 1.2 0 0 1 1.2 1.2v.2a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 19.8v-.2a1.2 1.2 0 0 1 1.2-1.2z" fill="${O.ketchup}"/>`,chefhat:`
<path d="M6.6 12.4a3.9 3.9 0 1 1 1.6-7.4 4.3 4.3 0 0 1 7.6 0 3.9 3.9 0 1 1 1.6 7.4z" fill="${O.cream}"/>
<path d="M6.6 12.2h10.8v6a1.4 1.4 0 0 1-1.4 1.4H8a1.4 1.4 0 0 1-1.4-1.4z" fill="${O.cream}"/>
<path d="M6.6 15.4h10.8" stroke-width="1.4"/>`,avatar:`
<path d="M3.4 21.2a8.6 8.6 0 0 1 17.2 0z" fill="${O.gold}"/>
<circle cx="12" cy="11.6" r="5" fill="${O.mustard}"/>
<path d="M7.2 8.4a2.9 2.9 0 1 1 1.6-5.3 3.6 3.6 0 0 1 6.4 0 2.9 2.9 0 1 1 1.6 5.3z" fill="${O.cream}"/>
<path d="M7.2 8.2h9.6v2.2H7.2z" fill="${O.cream}"/>`,damage:`
<path d="M20.6 1.6 21.4 6.6 9.8 18.2 6.4 14.8z" fill="${O.steel}"/>
<path d="M20.6 1.6 15.6 2.4 4 14l3.4 3.4z" fill="#B7AFC7" stroke="none"/>
<path d="M20.6 1.6 6.4 14.8" stroke-width="1.4"/>
<path d="M3.6 15.2 8.8 20.4" stroke="${O.ketchup}" stroke-width="3.4"/>
<path d="M1.8 20.2 5.4 16.6" stroke-width="2.4"/>`,health:`<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${O.ketchup}"/>
<path d="M7.2 10.4a2.6 2.6 0 0 1 2-1.6" stroke="${O.cream}" stroke-width="1.5"/>`,speed:`<path d="M13.8 2.2 5.6 13.4h4.8l-1.6 8.4 8.8-11.6h-5z" fill="${O.mustard}"/>`,range:`
<path d="M3.4 12h17.2" stroke-width="2.3"/>
<path d="M7.2 8.1 3.2 12l4 3.9" stroke-width="2.3"/>
<path d="M16.8 8.1 20.8 12l-4 3.9" stroke-width="2.3"/>`,timer:`
<circle cx="12" cy="13.6" r="7.7" fill="#C9B8DE"/>
<path d="M9.5 2.4h5" stroke-width="2.1"/>
<path d="M12 2.4v3.5" stroke-width="2.1"/>
<path d="M12 13.6V8.2" stroke="${O.ketchup}" stroke-width="2.4"/>
<path d="M12 13.6 21.4 7.4" stroke="${O.ketchup}" stroke-width="2.4"/>`,heal:`
<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${O.lettuce}"/>
<path d="M12 9.6v5.6M9.2 12.4h5.6" stroke="${O.cream}" stroke-width="2.1"/>`,stun:`<path d="${Bo(5,8.6,3.7,10.2,10.6)}" fill="${O.mustard}"/>
<path d="${Bo(5,4.2,1.8,19.2,18)}" fill="${O.mustardHi}" stroke-width="1.4"/>`,slow:`
<path d="M13 7.6 21.8 3.6 18.4 13.2z" fill="${O.gold}"/>
<circle cx="10.6" cy="14.2" r="7.8" fill="${O.gold}"/>
<path d="M14.2 18.4a5 5 0 1 1 1-5.6" stroke="#5A3200" stroke-width="2.8" fill="none" stroke-linecap="round"/>
<circle cx="10.6" cy="14.2" r="1.7" fill="#5A3200" stroke="none"/>`,medal:`
<path d="M8.4 2.2 11 8.6H7L4.4 2.2z" fill="${O.ketchup}"/>
<path d="M15.6 2.2 13 8.6h4l2.6-6.4z" fill="${O.water}"/>
<circle cx="12" cy="15.2" r="6.6" fill="${O.gold}"/>
<circle cx="12" cy="15.2" r="3.4" fill="${O.mustard}" stroke-width="1.3"/>`,party:`
<path d="M3.4 20.9 9 8.2l6.8 6.8z" fill="${O.ketchup}"/>
<path d="M9 8.2 15.8 15" stroke-width="1.4"/>
<circle cx="18.7" cy="5.5" r="1.6" fill="${O.mustard}"/>
<circle cx="14.2" cy="3.4" r="1.3" fill="${O.lettuce}"/>
<circle cx="20.8" cy="10.4" r="1.3" fill="${O.water}"/>
<path d="M16.2 8.8 18.6 6.4" stroke-width="1.4"/>`},kt=416,It=496,id=kt/It,db=.42,pb=.07,Mr=.08,ub=.66,fb=.08,Za={x0:.035,x1:.965,y0:.045,y1:.725},mb=.7,Er=.18,Tr=.92,gb=1.15,fo=new Map,Sr=new Map,Hl=[];let Ar=!1;function wb(t){const a=document.createElement("canvas");a.width=8,a.height=8;const o=a.getContext("2d",{willReadFrequently:!0});if(!o)return[0,0,0];o.drawImage(t,0,0,8,8);const n=o.getImageData(0,0,8,8).data;let s=0,i=0,r=0;for(let h=0;h<n.length;h+=4)s+=n[h],i+=n[h+1],r+=n[h+2];const l=n.length/4;return[Math.round(s/l),Math.round(i/l),Math.round(r/l)]}function Mh(t){return fo.get(t)}function _l(){const t=[...Ee];if(typeof document>"u"||typeof window<"u"&&window.__screen==="characters")return t;const e=new Set;for(const a of document.querySelectorAll("[data-portrait]")){const o=a.dataset.portrait;Ee.includes(o)&&e.add(o)}return!e.size&&(typeof window>"u"||!window.__screen)?t:[...e]}function Su(t){for(const a of Ee){const o=fo.get(a);o&&t(a,o)}if(Ee.every(a=>fo.has(a))){window.__thumbsReady=!0;return}if(Hl.push(t),Ar)return;Ar=!0,window.__thumbsReady=!1;const e=()=>void bb().finally(()=>{Ar=!1,Hl.length=0,window.__thumbsReady=_l().every(a=>fo.has(a))});typeof requestIdleCallback=="function"?requestIdleCallback(e,{timeout:600}):setTimeout(e,120)}async function bb(){if(!_l().some(a=>!fo.has(a)))return;const t=document.createElement("div");t.style.cssText=`position:fixed;left:-9999px;top:0;width:${kt}px;height:${It}px;pointer-events:none;`,document.body.appendChild(t);let e=null;try{e=new nh({container:t,background:0,fog:null,camera:{pitchDeg:12,yawDeg:24,frameMode:"subject",subjectHeight:2.1,subjectFill:1,targetHeight:1.05,followLerp:1},shadows:!1,postFx:"grade",offscreen:!0,maxPixelRatio:1}),e.canvas.style.cssText=`display:block;width:${kt}px;height:${It}px;`,e.resize();const a=new Set;for(;;){const o=_l().filter(n=>!fo.has(n)&&!a.has(n));if(!o.length)break;for(const n of o)a.add(n),await xb(e,n)}}catch{}finally{e?.dispose(),t.remove()}}function En(t,e,a,o){const n=new fe,s=t.getCenter(n.clone()).applyMatrix4(e.matrixWorldInverse).z;let i=1/0,r=1/0,l=-1/0,h=-1/0;for(let c=0;c<8;c++){n.set(c&1?t.max.x:t.min.x,c&2?t.max.y:t.min.y,c&4?t.max.z:t.min.z).applyMatrix4(e.matrixWorldInverse),n.z=s,n.applyMatrix4(e.projectionMatrix);const d=(n.x*.5+.5)*a,p=(1-(n.y*.5+.5))*o;i=Math.min(i,d),l=Math.max(l,d),r=Math.min(r,p),h=Math.max(h,p)}return{x:+i.toFixed(1),y:+r.toFixed(1),w:+(l-i).toFixed(1),h:+(h-r).toFixed(1)}}function rd(t,e){const a=t.getObjectByName(e);if(!a)return null;const o=new $n().setFromObject(a);return o.isEmpty()?null:o}function yb(t,e,a){const o=new fe;let n=0;return t.traverse(s=>{const i=s;if(!i.isMesh||!i.visible)return;const r=i.geometry?.getAttribute("position");if(r)for(let l=0;l<r.count;l++){if(o.fromBufferAttribute(r,l).applyMatrix4(i.matrixWorld),o.y<e)continue;const h=Math.abs(o.dot(a));h>n&&(n=h)}}),n}async function xb(t,e){const a=sh(e);t.scene.add(a.root),a.play("idle"),a.update({dt:.4,elapsed:.4,moveSpeed01:0,health01:1});const o=new $n().setFromObject(a.root),n=rd(a.root,"head"),s=rd(a.root,"face"),i=Math.max(.5,o.max.y-o.min.y),r=o.max.y,l=(s??n)?.min.y??o.min.y+.45*i,h=Math.max(o.min.y,Math.min(o.min.y+db*i,l-pb*i)),c=Math.max(.4,r-h),d=t.rig.camera,p=new fe,u=(M,R,T)=>{t.rig.subjectFill=1,t.rig.subjectHeight=M,t.rig.targetHeight=R-M/2,t.rig.snapTo(T*p.x,T*p.z),d.updateMatrixWorld(!0),d.matrixWorldInverse.copy(d.matrixWorld).invert()};u(c/Tr,r+Mr*(c/Tr),0),p.setFromMatrixColumn(d.matrixWorld,0).normalize();const m=yb(a.root,h,p),f=Math.max(c/Tr,2*m/(id*gb),s?(r-s.min.y)/(ub+fb):0);let g=r+Mr*f,w=0,b=f;if(s){const M=()=>r-Er*b;for(let R=0;R<4;R++){g=r+Mr*b;for(let z=0;z<3;z++){u(b,g,w);const Y=En(s,d,kt,It),A=(Y.y+Y.h)/It-mb;if(A<=0)break;const C=Math.max(0,(Y.y/It-Za.y0)*b),D=Math.max(M(),g-Math.min(A*b,C));if(Math.abs(D-g)<1e-4)break;g=D}u(b,g,w);const T=En(s,d,kt,It),N=T.x+T.w-Za.x1*kt,I=Za.x0*kt-T.x,F=b*id/kt;N>0&&I<0?w+=Math.min(N,-I)*F:I>0&&N<0&&(w-=Math.min(I,-N)*F);const L=T.w/((Za.x1-Za.x0)*kt),H=(T.y+T.h)/It,P=H>Za.y1?(H+Er)/(Za.y1+Er):1,j=Math.max(L,P);if(j<=1.001)break;b*=j}}u(b,g,w);const y=ih[ce[e].rarity];t.scene.background=new na(y),t.lighting.focus(0,0,4),Sr.has(y)||(a.root.visible=!1,t.render(0),Sr.set(y,wb(t.canvas)),a.root.visible=!0),t.render(0),t.render(0);const v=t.canvas.toDataURL("image/png"),k=a.root.getObjectByName("hips"),E=a.root.getObjectByName("shoulderL"),x=new fe;(window.__thumbMeta??={})[e]={size:{w:kt,h:It},subject:En(o,d,kt,It),head:n?En(n,d,kt,It):null,face:s?En(s,d,kt,It):null,bg:Sr.get(y)??null,world:{minY:+o.min.y.toFixed(4),maxY:+o.max.y.toFixed(4),halfWidth:+Math.max(Math.abs(o.min.x),Math.abs(o.max.x)).toFixed(4),hipsY:k?+k.getWorldPosition(x).y.toFixed(4):null,shoulderY:E?+E.getWorldPosition(x).y.toFixed(4):null,headY:n?[+n.min.y.toFixed(4),+n.max.y.toFixed(4)]:null,faceY:s?[+s.min.y.toFixed(4),+s.max.y.toFixed(4)]:null,yCut:+h.toFixed(4),upperHalfWidth:+m.toFixed(4)},frame:{subjectHeight:+t.rig.subjectHeight.toFixed(4),subjectFill:+t.rig.subjectFill.toFixed(4),targetHeight:+t.rig.targetHeight.toFixed(4),headroom:+((g-r)/b).toFixed(4),pan:+w.toFixed(4)}},t.scene.remove(a.root),a.dispose(),fo.set(e,v);for(const M of Hl)M(e,v);await new Promise(M=>setTimeout(M,0))}const vb='<circle cx="12" cy="9" r="5.6" fill="#FFF3DE"/><path d="M5.2 21.6c0-3.5 3-5.6 6.8-5.6s6.8 2.1 6.8 5.6z" fill="#FFF3DE"/>';function Ha(t,e={}){const a=ih[ce[t].rarity],o=Mh(t),n=["fa-ic-portrait",e.crop==="head"?"fa-ic-portrait--head":"",o?"has-render":"",e.class??""].filter(Boolean).join(" "),s=o?` src="${o}"`:"";return`<span class="${n}" data-portrait="${t}" style="--pc:${a}"><img alt=""${s}/><svg class="fa-ic" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${vb}</svg></span>`}function Xo(t,e={}){const a=(o,n)=>{for(const s of t.querySelectorAll(`[data-portrait="${o}"]`)){const i=s.querySelector("img");i&&(i.getAttribute("src")!==n&&i.setAttribute("src",n),s.classList.add("has-render"))}};if(e.generate===!1){for(const o of t.querySelectorAll("[data-portrait]")){const n=o.dataset.portrait,s=Mh(n);s&&a(n,s)}return}Su(a)}const kb={...cb,...ob,...nb},Mb='viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"';function _(t,e={}){const a=kb[t];if(!a)return"";const o=["fa-ic",`fa-ic--${t}`,e.class??""].filter(Boolean).join(" "),n=e.size??"1em",s=e.label?`role="img" aria-label="${e.label}"`:'aria-hidden="true" focusable="false"';return`<svg class="${o}" ${Mb} width="${n}" height="${n}" ${s}>${a}</svg>`}const Eb={"🪙":"coin","💎":"gem","🏆":"trophy","⭐":"star","✨":"sparkle","🏁":"flag","📍":"pin","🎉":"party","🎁":"gift","🧑‍🍳":"chefhat","⚙️":"gear","⚙":"gear","🔒":"lock","▶":"play","⏸":"pause","◀":"back","🙂":"avatar","🚧":"cone","🔇":"mute","🔊":"sound","🏠":"home","🍟":"swap","❤️":"health","❤":"health","💨":"speed","↔":"range","⏱":"timer","💚":"heal","💫":"stun","🐌":"slow","🍖":"patty","🍅":"tomato","🥬":"lettuce","🧅":"onion","🍬":"candy","🥩":"meat","🌯":"wrap","🌀":"swirl","🥚":"egg","🐣":"chick","💥":"burst","🔨":"hammer","🍭":"lollipop","⚪":"dough","🧀":"cheese","🍚":"rice","🌿":"seaweed","🐟":"fish","🐡":"puffer","💦":"droplets","🍜":"noodle","🌊":"wave","🧊":"shards","🔵":"cap","💛":"mustardblast","🔴":"ketchupslip","⚔️":"slash","⚔":"damage","🍯":"honey","💧":"droplets"},Tb={chest:"chest",hamburgerBox:"boxBurger",pineappleBox:"boxPineapple",redBox:"boxRed",fireBox:"boxFire"};function Ca(t,e={}){const a=Eb[t];return a?_(a,e):t}function _t(t,e={}){return _(Tb[t]??"chest",e)}function Au(t,e={}){return Ca(t,e)}const ld="fa-icon-styles";function xa(){if(document.getElementById(ld))return;const t=document.createElement("style");t.id=ld,t.textContent=Sb,document.head.appendChild(t)}const Sb=`
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
`,hd=[ea.tomato,ea.mustard,ea.lettuce,ea.cheese,ea.glaze,ea.waterCap];function ui(t,e=50,a=26){for(let o=0;o<a;o++){const n=document.createElement("span");n.className="fa-confetti",n.style.left=`${e+(Math.random()*12-6)}%`,n.style.background=hd[Math.floor(Math.random()*hd.length)],n.style.animationDelay=`${(Math.random()*.22).toFixed(2)}s`,n.style.setProperty("--x",`${Math.round(Math.random()*240-120)}px`),t.appendChild(n),setTimeout(()=>n.remove(),1800)}}function He(t,e,a){const o=document.createElement(t);return e&&(o.className=e),o}const Ab=null,cd="Open to a player",dd="Online play is not connected yet. This seat is played by a bot.";function Rb(t){return`Online play is not connected yet, so ${t===1?"the other seat is":`all ${t} other seats are`} played by a bot. Opening a seat to another player is switched off rather than offered as a button that does nothing.`}const Ru="food-arena.loadout.v1";function Eh(t){let e=null;try{e=localStorage.getItem(Ru)}catch{return[]}if(e===null)return[];let a;try{a=JSON.parse(e)}catch{return[]}if(!Array.isArray(a))return[];const o=[];for(const n of a){if(o.length>=Tt)break;typeof n!="string"||!Th(n)||!t.has(n)||o.includes(n)||o.push(n)}return o}function pd(t){try{localStorage.setItem(Ru,JSON.stringify(t.slice(0,Tt)))}catch{}}function Th(t){return pa.includes(t)}function Sh(t){const e=window.__faOwnedItems;return e?new Set(e.filter(Th)):new Set(pa)}function Ib(){return"Your picks go into the match now. Active items have no button yet, so only an item that needs no press can fire."}const ud="Items come from boxes and from the trophy road.";function Ob(t){return t==="passive"?"Passive":t==="triggered"?"Triggered":"Active"}function fd(t){const e=[Ob(t.kind)];return t.cooldownMs!==null?e.push(`${+(t.cooldownMs/1e3).toFixed(1)} s cooldown`):t.kind==="passive"?e.push("always on"):e.push("once a match"),t.minAlive>nt&&e.push(`needs ${t.minAlive} fighters alive`),e.join(" · ")}function Cb(t){ya("fa-lobby-styles",Nb),xa();const e=window.__faOpenSeat!==void 0?window.__faOpenSeat:Ab,a=e!==null,o=t.profile.selected,n=Fb(o);let s=Ac[0];const i=He("div","fa-screen fa-lobby");i.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${_("back")} Back</button>
      <h1 class="fa-title lobby-heading">Match Lobby</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${_("party")}</span>Players <span class="fa-chip-val ds-chip-val ds-num" data-el="count">2</span></div>
    </header>

    <div class="lobby-body">
      <p class="lobby-note" data-el="note"></p>
      <section class="fa-panel lobby-kit" aria-labelledby="lobby-kit-label">
        <div class="lobby-kit-head">
          <span class="fa-panel-title" id="lobby-kit-label">Your items</span>
          <span class="lobby-kit-owned ds-num" data-el="kit-owned"></span>
        </div>
        <div class="lobby-kit-slots" data-el="kit-slots"></div>
        <p class="lobby-kit-note" data-el="kit-note"></p>
      </section>
      <div class="fa-panel fa-panel--flush lobby-seatswrap">
        <div class="fa-scroll lobby-seats" data-el="seats"></div>
      </div>
    </div>

    <footer class="lobby-bottom">
      <div class="lobby-count">
        <span class="fa-panel-title lobby-count-title" id="lobby-count-label">Players in this match</span>
        <div class="lobby-count-opts" role="group" aria-labelledby="lobby-count-label" data-el="opts"></div>
      </div>
      <button class="fa-btn ds-btn ds-btn--primary lobby-start" type="button" data-el="start">${_("play")} Start</button>
    </footer>

    <!-- ── THE PICKER ────────────────────────────────────────────────────────
         🚨 SINGLE QUOTES IN HERE, NEVER BACKTICKS. This comment is inside a TEMPLATE
         LITERAL and a backtick TERMINATES it — the trap 'a015d1f' held the whole items
         branch red on, with tsc parsing the rest of the file as something else. Writing
         it in house style cost this pass one red compile too.

         Inside the screen root rather than on <body>: 'dispose()' removes the root and
         everything in it, and a sheet parented anywhere else is a leak the router cannot
         see. 'hidden' while closed, which is what keeps its ten rows out of
         'menu_accept''s control census (that battery filters on a NON-ZERO rect).

         WAS: '— they are measured instead by ul_accept.mjs, which opens it first.'
         That file has never existed (see the correction in section 5b). The ten rows are
         therefore measured by NOTHING while the sheet is closed, which is a real gap and
         is now stated as one rather than covered by a citation. -->
    <div class="lobby-sheet" data-el="sheet" hidden role="dialog" aria-modal="true"
         aria-labelledby="lobby-sheet-title">
      <div class="lobby-sheet-scrim" data-el="sheet-scrim"></div>
      <div class="fa-panel lobby-sheet-card">
        <header class="lobby-sheet-head">
          <h2 class="fa-panel-title lobby-sheet-title" id="lobby-sheet-title">Choose an item</h2>
          <button class="fa-iconbtn lobby-sheet-x" type="button" data-el="sheet-x"
                  aria-label="Close the item picker">${_("close")}</button>
        </header>
        <p class="lobby-sheet-sub" data-el="sheet-sub"></p>
        <div class="fa-scroll lobby-sheet-list" data-el="sheet-list"></div>
      </div>
    </div>
  `;const r=A=>{const C=i.querySelector(`[data-el="${A}"]`);if(!C)throw new Error(`lobby: missing element "${A}"`);return C},l=r("seats"),h=r("opts"),c=r("note"),d=r("kit-slots"),p=r("kit-note"),u=r("kit-owned"),m=r("sheet"),f=r("sheet-list"),g=r("sheet-sub");for(const A of Ac){const C=He("button","ds-btn lobby-opt");C.type="button",C.dataset.seats=String(A),C.textContent=String(A),C.setAttribute("aria-label",`${A} players`),h.appendChild(C)}function w(){r("count").textContent=String(s);for(const A of h.querySelectorAll(".lobby-opt")){const C=Number(A.dataset.seats)===s;A.classList.toggle("is-on",C),A.setAttribute("aria-pressed",C?"true":"false")}}function b(){const A=X0(o,n,s),C=t.profile.characterLevel(o),D=lu(C);l.innerHTML=A.map((U,te)=>{const Z=te===0,$=ce[U].name,oe=Z?C:D,we=Z?"You":"Bot",ve=Z?`<button class="ds-btn ds-btn--icon lobby-seat-act" type="button" data-el="swap"
             title="Change your fighter" aria-label="Change your fighter">${_("swap")}</button>`:`<button class="ds-btn ds-btn--icon lobby-seat-act lobby-seat-open" type="button"
             data-el="open" data-slot="${te}"${a?"":" disabled"}
             title="${cd}. ${dd}"
             aria-label="${cd} — seat ${te+1}. ${a?"":dd}">${_("avatar")}</button>`;return`
        <div class="lobby-seat${Z?" is-you":""}" data-seat="${te}" data-char="${U}">
          <span class="lobby-seat-pic">${Ha(U,{crop:"head"})}</span>
          <span class="lobby-seat-body">
            <span class="lobby-seat-name" data-el="seat-name">${$}</span>
            <span class="lobby-seat-tag"><b>${we}</b> · Lv ${oe}</span>
          </span>
          ${ve}
        </div>`}).join(""),Xo(l)}const y=Sh(t.profile.economy);let v=Eh(y),k=null;function E(){const A=C=>Gs.indexOf(Ce[C].rarity);return[...pa].sort((C,D)=>{const U=y.has(C)?0:1,te=y.has(D)?0:1;if(U!==te)return U-te;const Z=A(C)-A(D);return Z!==0?Z:pa.indexOf(C)-pa.indexOf(D)})}function x(A,C){return`<span class="fa-rarity ${C}" style="background:${St[A]}">${A}</span>`}function M(A){const C=v[A],D=A+1;if(C===void 0){const $=y.size===0?`Slot ${D}: empty. You do not own any items yet.`:`Slot ${D}: empty. Choose an item.`;return`
        <button class="lobby-slot is-empty" type="button" data-el="slot" data-slot="${A}"
                title="${$}" aria-label="${$}">
          <span class="lobby-slot-plus" aria-hidden="true">+</span>
          <span class="lobby-slot-txt"><span class="lobby-slot-name">Add item</span></span>
        </button>`}const U=Ce[C],te=s<U.minAlive,Z=`Slot ${D}: ${U.name}, ${U.rarity}. ${U.blurb}${te?` Needs ${U.minAlive} fighters; this match has ${s}.`:""} Change it.`;return`
      <button class="lobby-slot is-filled${te?" is-dead":""}" type="button"
              data-el="slot" data-slot="${A}" title="${Z}" aria-label="${Z}">
        <span class="lobby-slot-ic">${_(C)}</span>
        <span class="lobby-slot-txt">
          <span class="lobby-slot-name">${U.name}</span>
          ${x(U.rarity,"lobby-slot-rar")}
        </span>
      </button>`}function R(){d.innerHTML=Array.from({length:Tt},(D,U)=>M(U)).join(""),u.textContent=`${y.size} of ${pa.length} owned`;const A=y.size===0?ud:Ib();p.textContent=A,p.hidden=A==="";const C=v.filter(D=>s<Ce[D].minAlive);C.length>0&&(p.textContent=C.map(D=>`${Ce[D].name} needs ${Ce[D].minAlive} fighters alive; this match has ${s}.`).join(" "),p.hidden=!1)}function T(A){const C=Ce[A],D=y.has(A),U=v.indexOf(A),te=D?U>=0?`In slot ${U+1}`:"Equip":"Not owned yet",Z=D?"":" You do not own this item yet.",$=`${C.name}, ${C.rarity}. ${C.blurb} ${fd(C)}.${Z}`;return`
      <button class="lobby-item${D?"":" is-locked"}${U>=0?" is-on":""}" type="button"
              data-item="${A}"${D?"":" disabled"}
              title="${$}" aria-label="${$}">
        <span class="lobby-item-ic">${_(A)}</span>
        <span class="lobby-item-body">
          <span class="lobby-item-top">
            <span class="lobby-item-name">${C.name}</span>
            ${x(C.rarity,"lobby-item-rar")}
          </span>
          <span class="lobby-item-blurb">${C.blurb}</span>
          <span class="lobby-item-meta">${fd(C)}</span>
        </span>
        <span class="lobby-item-state">
          ${D?U>=0?_("check"):"":_("lock")}<span>${te}</span>
        </span>
      </button>`}function N(){if(k===null)return;const A=v[k];g.textContent=y.size===0?`You own none of these ${pa.length} yet. ${ud}`:A===void 0?`Slot ${k+1} of ${Tt}. Pick one of the ${y.size} you own.`:`Slot ${k+1} of ${Tt} holds ${Ce[A].name}. Pick another, or take it out.`;const C=E().map(T).join(""),D=A===void 0?"":`
      <button class="ds-btn lobby-item-clear" type="button" data-el="clear"
              aria-label="Take ${Ce[A].name} out of slot ${k+1}">
        ${_("close")} Take out ${Ce[A].name}
      </button>`;f.innerHTML=C+D}function I(A){k=A,N(),m.hidden=!1,r("sheet-x").focus()}function F(){const A=k;k=null,m.hidden=!0,d.querySelector(`[data-slot="${A}"]`)?.focus()}function L(A){if(k===null||!y.has(A))return;const C=Math.min(k,v.length),D=v.slice(),U=D.indexOf(A);if(U===C){F();return}const te=D[C];C<D.length?D[C]=A:D.push(A),U>=0&&(te===void 0?D.splice(U,1):D[U]=te),v=D.slice(0,Tt),pd(v),F(),R()}function H(A){v=v.filter((C,D)=>D!==A),pd(v),F(),R()}function P(){c.textContent=a?"":Rb(s-1),c.hidden=a}function j(){w(),b(),P(),R()}const z=A=>{const C=A.target,D=C?.closest(".lobby-opt");if(D){const $=Number(D.dataset.seats);Number.isInteger($)&&$!==s&&(s=$,j());return}const U=C?.closest('[data-el="slot"]');if(U){I(Number(U.dataset.slot));return}if(C?.closest('[data-el="clear"]')){k!==null&&H(Math.min(k,Math.max(0,v.length-1)));return}if(C?.closest('[data-el="sheet-x"]')||C?.closest('[data-el="sheet-scrim"]')){F();return}const te=C?.closest(".lobby-item");if(te){const $=te.dataset.item;$!==void 0&&Th($)&&L($);return}const Z=C?.closest('[data-el="open"]');if(Z){e?.(Number(Z.dataset.slot));return}if(C?.closest('[data-el="swap"]')){t.navigate({name:"characters"});return}C?.closest('[data-el="back"]')&&t.navigate({name:"home"})};i.addEventListener("click",z);const Y=A=>{A.key==="Escape"&&k!==null&&(A.stopPropagation(),F())};return i.addEventListener("keydown",Y),r("start").addEventListener("click",()=>{const A={name:"match",player:o,enemy:n,seats:zi(s)};t.navigate(A)}),j(),{root:i,dispose(){i.removeEventListener("click",z),i.removeEventListener("keydown",Y),i.remove()}}}function Fb(t){const e=Ee.filter(a=>a!==t);return e[Math.floor(Math.random()*e.length)]}const Nb=`
/* The heading SHRINKS and the controls beside it do not. 'flex: 0 0 auto' here squeezed
   the Back pill's own padding at 360px — the row was over budget and the only item that
   could give was the one that should never give. */
.fa-lobby .lobby-heading {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fa-lobby .fa-topbar > .fa-iconbtn,
.fa-lobby .fa-topbar > .fa-chip { flex: 0 0 auto; }

/* ── THE PANEL HUGS ITS CONTENT, AND THAT IS A MEASUREMENT ──────────────────────
   First draft was 'flex: 1 1 auto' on the panel — i.e. fill the row — and the 1600x900
   capture was a 1500x670 cream rectangle with four 64px rows at the top of it and
   OVER HALF THE FRAME EMPTY. That is this project's oldest named defect, recorded in
   'home.ts''s header as "more than half the frame was empty cyan", and it arrived here
   the same way: a container told to fill a row that is much bigger than its contents.

   'flex: 0 1 auto' lets the panel be as tall as its seats and no taller, capped by the
   row so it still scrolls when six seats do not fit. The leftover is the warm backdrop,
   which is a field, not a void. The width cap is the same idea on the other axis: a seat
   row 1500px wide puts the name and its control at opposite ends of the screen with a
   metre of nothing between them. */
.fa-lobby .lobby-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  /* Centred in the band, because a hugging panel pinned to the TOP of a 900px row leaves
     550px of backdrop under it and reads as a screen that failed to finish loading. On a
     phone the content fills the band and this is a no-op. */
  justify-content: center;
  gap: var(--gap);
  min-height: 0;
}
.fa-lobby .lobby-note,
.fa-lobby .lobby-kit,
.fa-lobby .lobby-seatswrap {
  width: min(100%, 880px);
  margin-inline: auto;
}

/* The state of the screen, in words, above the thing it describes. Cream on the warm
   backdrop rather than inside a panel: it is a caption on the whole list, and a panel
   would make it read as one more piece of data to compare. */
.fa-lobby .lobby-note {
  /* 'margin-block', NOT 'margin' — a blanket 'margin: 0' here overrode the shared
     'margin-inline: auto' above (it is declared later and wins), and the banner rendered
     hard against the left edge while the panel it describes sat centred 340px away.
     Caught by reading the 1600x900 PNG, not by any assertion in 'lb_accept'. */
  margin-block: 0;
  flex: 0 0 auto;
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.78rem, 1.9vh, 0.95rem);
  line-height: 1.35;
  color: var(--cream);
  text-shadow: 0 2px 0 rgba(26,18,36,0.55);
}
.fa-lobby .lobby-note[hidden] { display: none; }

.fa-lobby .lobby-seatswrap { flex: 0 1 auto; min-height: 0; }
/* A GRID, so the column count is one declaration. One column is the portrait answer and
   it is measured: 360px minus safe areas cannot hold two portraits, two names and two
   44px controls in a row. */
.fa-lobby .lobby-seats {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 8px;
  padding: 10px;
}

/* ONE COLUMN, at every width, and that is a measurement rather than a preference:
   360 px minus safe areas cannot hold two portraits, two names and two 44 px controls in
   a row. Six rows at ~64 px fit the 547 px free band a 360x800 phone leaves under the
   header and above the footer; '.fa-scroll' takes the overflow on the tall-content case
   so the page itself never scrolls. */
.fa-lobby .lobby-seat {
  display: flex;
  align-items: center;
  gap: 10px;
  /* Floor 64, and it grows with the viewport rather than staying phone-sized on a
     desktop — 'theme.ts' records the same finding for '.ds-row': ours measured 0.60x the
     reference's row height and the fix was the row, not the type inside it. The floor is
     what the 44px tap rule and the six-rows-in-547px portrait band both need. */
  min-height: clamp(64px, 8.5vh, 88px);
  padding: 6px 10px;
  border-radius: var(--ds-r-2);
  background: rgba(26,18,36,0.06);
}
/* Your own seat is the one the eye should find first in a list of six near-identical
   rows. A left rule rather than a fill: a filled row would read as "selected", which is a
   state this list does not have. */
.fa-lobby .lobby-seat.is-you {
  background: rgba(244,163,0,0.16);
  box-shadow: inset 3px 0 0 var(--mustard);
}

.fa-lobby .lobby-seat-pic {
  flex: 0 0 auto;
  display: inline-flex;
  font-size: 44px;
  line-height: 1;
}

.fa-lobby .lobby-seat-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
}
.fa-lobby .lobby-seat-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: clamp(0.9rem, 2.2vh, 1.05rem);
  line-height: 1.1;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 'You' / 'Bot' is the load-bearing word on this screen, so it is bold inside a line that
   is otherwise quiet. 0.72 opacity on ink over the cream panel measures well clear of AA;
   the '<b>' inherits it and stays the darkest thing in the line by weight. */
.fa-lobby .lobby-seat-tag {
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.72rem, 1.7vh, 0.85rem);
  line-height: 1.15;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-seat-tag b { font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold); }

.fa-lobby .lobby-seat-act { flex: 0 0 auto; }

/* ══ THE LOADOUT ══════════════════════════════════════════════════════════════
   🚨 THIS HEADER CLAIMED A MEASUREMENT THAT WAS NEVER TAKEN. IT READ:

     'EVERY SURFACE BELOW IS MEASURED AGAINST WCAG 2.1 SC 1.4.11's 3.0 FLOOR ON THE
      RENDERED PIXELS, NOT REASONED ABOUT. tools/tmp/ul_accept.mjs section C samples the
      real PNG through qx_contrast.mjs:boundaryContrast'

   'ul_accept.mjs' has never existed on any branch (re-derived 2026-09-02). So the
   strongest claim in this file — 'measured on rendered pixels, not reasoned about' — was
   itself reasoned about, and the citation is exactly what made it read as verified.

   That is the SAME SENTENCE 'tools/tmp/ul_seam.mjs's own header condemns 'il_seam.mjs'
   for: 'a measurement that was never taken, under a heading reading WHAT HAS AND HAS NOT
   BEEN MEASURED.' It was reproduced here in the commit that wrote the condemnation.

   WHAT IS ACTUALLY TRUE, and it is the DESIGN half rather than the measurement half:
   the match pause chip shipped working, at 1.026:1 against its own background, and that
   is the TWENTIETH rendering-and-invisible instance in this project and the FOURTH
   dark-on-dark. A control whose boundary is a 6%-alpha tint is exactly how the previous
   three looked in source. Hence full ink borders below rather than tinted fills — a
   reasoned defence against a known class, and NOT a contrast measurement. Nobody has
   sampled these pixels yet. */

.fa-lobby .lobby-kit { flex: 0 0 auto; gap: 8px; }
.fa-lobby .lobby-kit-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
/* The count is DATA, so it is quieter than the label and never quieter than AA:
   0.66 ink on the cream panel measures ~6:1, against a 4.5 floor. */
.fa-lobby .lobby-kit-owned {
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  font-weight: var(--ds-w-body);
  color: rgba(26,18,36,0.66);
  white-space: nowrap;
}

/* TWO COLUMNS AT EVERY WIDTH, because ITEM_SLOTS is two and a slot that wrapped to its
   own row would read as a list rather than as a pair. 1fr each keeps them equal, so
   "empty" and "filled" are the same size and the pair reads as two of one thing. */
.fa-lobby .lobby-kit-slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

/* The slot. Sized from CSS, never from its label — the same drift note the seat-count
   control carries: text-driven widths move ~+-2 CSS px between runs on one tree, and
   'menu_accept_portrait''s MIN_TAP - 0.5 slack is inside that. */
.fa-lobby .lobby-slot {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: clamp(var(--tap), 7vh, 60px);
  min-width: 0;
  padding: 4px 10px;
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e1);
  text-align: left;
  color: var(--ink);
  --fa-ic-ink: var(--ink);
}
/* '--ds-lip' is the elevation ladder's colour, per component — 'theme.ts' factored it out
   so a component picks a lip and keeps the six-rung shadow scale. Mustard takes the gold
   lip; the empty slot takes the root default. */
.fa-lobby .lobby-slot.is-filled {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
}
/* Empty is a DASHED ink outline on the cream panel, not a faint tint. The dash is the
   whole tell that this is a place something goes; the ink keeps the boundary at ~18:1
   instead of the 1.1:1 a 6%-alpha fill would have given it. */
.fa-lobby .lobby-slot.is-empty {
  background: var(--ds-paper-hi);
  border-style: dashed;
  justify-content: center;
}
.fa-lobby .lobby-slot:active { transform: translateY(2px); box-shadow: var(--ds-e0); }

/* A typographic '+', not an icon: the registry has no plus glyph, and 'ui.ts' is another
   pass's file. A '+' is a font character, so it is ours in a way an emoji is not — the
   defect the whole icon set exists to fix. */
.fa-lobby .lobby-slot-plus {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--ds-r-round);
  background: var(--ink);
  color: var(--cream);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: 15px;
  line-height: 1;
}
.fa-lobby .lobby-slot-ic { flex: 0 0 auto; font-size: 28px; line-height: 1; }
.fa-lobby .lobby-slot-txt {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fa-lobby .lobby-slot.is-empty .lobby-slot-txt { flex: 0 1 auto; }
.fa-lobby .lobby-slot-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t3);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The shared badge, at the smallest size it is measured at. Height comes down; the
   1.6px stroke and 'paint-order' in 'theme.ts' do NOT, because that pair is what makes
   it 16.5:1 on all six fills instead of 3.69:1 on Epic. */
.fa-lobby .lobby-slot-rar {
  height: 17px;
  padding: 0 7px;
  font-size: 0.66rem;
  align-self: flex-start;
}
/* An equipped item the selected seat count cannot use. Ketchup-INK, which 'theme.ts'
   dropped in value for exactly this job: the fill red measures 4.17-2.56 as type on
   these surfaces and this one measures 5.9 on cream. */
.fa-lobby .lobby-slot.is-dead { box-shadow: var(--ds-e1), inset 4px 0 0 var(--ketchup-ink); }

.fa-lobby .lobby-kit-note {
  margin: 0;
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  line-height: 1.3;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-kit-note[hidden] { display: none; }

/* ── The picker ──────────────────────────────────────────────────────────────
   Absolutely positioned inside the screen root and inset by the safe area, so a notch
   cannot eat the close control. 'theme.ts' declares '--fa-safe-*' from 'env()';
   'menu_accept' overrides them on <html> to simulate a notched device, which is the only
   way any of this is testable on a machine with no notched hardware ('APP.md' 5). */
.fa-lobby .lobby-sheet {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    calc(var(--fa-safe-t) + var(--gap))
    calc(var(--fa-safe-r) + var(--gutter))
    calc(var(--fa-safe-b) + var(--gap))
    calc(var(--fa-safe-l) + var(--gutter));
}
.fa-lobby .lobby-sheet[hidden] { display: none; }
/* 0.72 ink over the warm backdrop: dark enough that the cream card is unambiguously in
   front, light enough that the lobby is still visibly behind it rather than replaced. */
.fa-lobby .lobby-sheet-scrim {
  position: absolute;
  inset: 0;
  background: rgba(26,18,36,0.72);
}
.fa-lobby .lobby-sheet-card {
  position: relative;
  width: min(100%, 560px);
  max-height: 100%;
  box-shadow: var(--ds-e5);
}
.fa-lobby .lobby-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
}
.fa-lobby .lobby-sheet-title { flex: 1 1 auto; min-width: 0; }
.fa-lobby .lobby-sheet-x { flex: 0 0 auto; }
.fa-lobby .lobby-sheet-sub {
  margin: 0;
  flex: 0 0 auto;
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  line-height: 1.3;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-sheet-list {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

/* ── An item row ─────────────────────────────────────────────────────────────
   A FULL INK BORDER, not a tinted tile. '.lobby-seat' above uses
   'rgba(26,18,36,0.06)' and gets away with it because it is not a control; these are
   buttons, and SC 1.4.11 asks for 3:1 on a control's own boundary. 0.06 ink on cream is
   ~1.1:1 — within rounding of the 1.026:1 the pause chip shipped at. */
.fa-lobby .lobby-item {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-height: var(--tap);
  padding: 8px 10px;
  text-align: left;
  background: var(--ds-paper-hi);
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
}
.fa-lobby .lobby-item:active { transform: translateY(2px); }
/* Equipped. The product's "this is the live one" mustard, the same statement
   '.lobby-opt.is-on' makes, so the two selected states on this screen agree. */
.fa-lobby .lobby-item.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
}
/* Not owned. THREE tells, because one is a colour and a colour alone is not a state:
   a dashed border, a lock glyph, and the words. 0.72 composites the whole row to ~7:1
   against the panel, so the blurb — which is the informed-choice content this screen
   exists to deliver — stays legible on a row you cannot press. */
.fa-lobby .lobby-item.is-locked {
  cursor: default;
  opacity: 0.72;
  border-style: dashed;
  background: var(--ds-paper);
}
.fa-lobby .lobby-item.is-locked:active { transform: none; }

.fa-lobby .lobby-item-ic { flex: 0 0 auto; font-size: 30px; line-height: 1; margin-top: 1px; }
.fa-lobby .lobby-item-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fa-lobby .lobby-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fa-lobby .lobby-item-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t3);
  line-height: 1.1;
}
.fa-lobby .lobby-item-rar { height: 18px; padding: 0 7px; font-size: 0.68rem; }
/* WHAT IT DOES. 'ITEMS[id].blurb' verbatim — the registry's own player-facing line, so
   this screen cannot describe an item differently from anything else that shows one. */
.fa-lobby .lobby-item-blurb {
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2);
  line-height: 1.3;
  color: rgba(26,18,36,0.82);
}
.fa-lobby .lobby-item-meta {
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t1);
  line-height: 1.25;
  color: rgba(26,18,36,0.66);
}
.fa-lobby .lobby-item-state {
  flex: 0 0 auto;
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 34%;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  line-height: 1.15;
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  text-align: right;
  color: rgba(26,18,36,0.78);
}
.fa-lobby .lobby-item.is-on .lobby-item-state { color: var(--ink); }
.fa-lobby .lobby-item-clear { width: 100%; }

/* ── The count row + the CTA ───────────────────────────────────────────────── */
.fa-lobby .lobby-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap);
  flex-wrap: wrap;
}
.fa-lobby .lobby-count {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.fa-lobby .lobby-count-title { color: var(--cream); text-shadow: 0 2px 0 rgba(26,18,36,0.55); }
.fa-lobby .lobby-count-opts { display: flex; gap: 8px; }

/* Square, sized from CSS, never from the digit inside it — see the drift note in the TS. */
.fa-lobby .lobby-opt {
  width: var(--tap);
  min-width: var(--tap);
  height: var(--tap);
  min-height: var(--tap);
  padding: 0;
  font-size: var(--ds-t4);
  border-radius: var(--ds-r-2);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  --ds-lip: rgba(0,0,0,0.35);
}
/* The selected count. Mustard is the product's "this is the live one" colour (the tab
   bar's active state and the primary CTA both use it), so the row reads as state without
   a legend. */
.fa-lobby .lobby-opt.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
  transform: translateY(-1px);
}

/* ── TWO COLUMNS WHEN THERE IS ROOM, AND IT IS THE LANDSCAPE PHONE THAT NEEDS IT ──
   At 844x390 — the shape 'DECISIONS §14' says the game is played in — one column fits
   THREE seats and silently scrolled the fourth out of view under a simulated notch. A
   list that says "Players 4" and shows three is the same class of defect as a number the
   model does not compute, even though nothing is technically wrong. Two columns puts six
   seats in three rows: ~210px, which the band holds without a notch and very nearly with
   one. 760px is the breakpoint because a column needs ~360px to hold a 44px portrait, a
   name and a 44px control without ellipsising the name. */
@media (min-width: 760px) {
  .fa-lobby .lobby-seats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* The footer stacks before it squeezes. On a 360px phone the primary CTA and a five-way
   segmented control cannot share a line, and a CTA that has shrunk to fit is a CTA that
   has stopped being the loudest thing on the screen. */
@media (max-width: 700px) {
  /* The topbar chip goes, and the SCREEN'S NAME stays. At 360px the row was over budget
     and the title ellipsised to "Match L…" — a screen whose own heading is truncated.
     The chip is the redundant one: the identical number is on the segmented control
     directly above the CTA, highlighted, at every width. Measured before this: Back 72 +
     title + chip ~100 + gaps over 332px of usable width. */
  .fa-lobby .fa-topbar > .fa-chip { display: none; }
  .fa-lobby .lobby-bottom { flex-direction: column; align-items: stretch; }
  .fa-lobby .lobby-count-opts { justify-content: space-between; }
  .fa-lobby .lobby-start { width: 100%; }
}

/* ── THE LANDSCAPE PHONE, AND THIS BLOCK IS LAST ON PURPOSE ──────────────────
   ⚠️ A MEDIA QUERY ADDS NO SPECIFICITY. 'theme.ts' records what that cost: an identical
   selector written earlier in a file loses to one inside a later block, and a
   '@media (max-height: 460px)' rule placed above a '(max-height: 560px)' one delivered
   2.44px rows. This block re-declares '.lobby-kit' selectors that appear above it, so it
   must stay at the FOOT of this stylesheet.

   844x390 is 'DECISIONS §14''s shape and it is the tight one: ~240px of body band under
   the header and above the footer, which the seat panel alone can fill at six seats.
   The saving here is the kit's own stacking — label above count on the left, both slots
   on the right, note across the bottom — which is ~24px against putting the head on its
   own row, on the one viewport that has no rows to spare. */
@media (max-height: 460px) {
  .fa-lobby .lobby-kit {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    column-gap: 12px;
    row-gap: 6px;
    padding: 8px 10px;
  }
  .fa-lobby .lobby-kit-head { flex-direction: column; align-items: flex-start; gap: 1px; }
  .fa-lobby .lobby-kit-note { grid-column: 1 / -1; }
  /* The slot stays over the 44px floor — clamped from the SHORT axis, which is the one
     that runs out here — and its icon comes down so the name keeps its line. */
  .fa-lobby .lobby-slot { min-height: var(--tap); }
  .fa-lobby .lobby-slot-ic { font-size: 24px; }
  /* The picker is the whole viewport at this height: a centred card with 390px of room
     would be a 200px scroller. Stretched, it holds four rows instead of two. */
  .fa-lobby .lobby-sheet-card { width: 100%; max-width: 720px; }
}
`,Lb="Kitchen Rumble";function Db(t){const e=Math.round(t/1e3);return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`}function Hb(t){ya("fa-home-styles",_b),xa();const e=He("div","fa-screen fa-home"),a=yh();a.setScene("lobby"),e.innerHTML=`
    <div class="home-room" aria-hidden="true">
      <div class="home-room-wall"></div>
      <div class="home-room-floor"></div>
      <div class="home-room-alcove"></div>
    </div>

    <!-- ADOPTED: '.ds-chip ds-chip--slate' from theme.ts's component layer, plus
         '.ds-chip-val' on the NUMERALS. The slate treatment is not new here - this file
         already hand-rolled it in a '.fa-home .fa-chip' override with the same gradient,
         the same cream and the same lip - so the adoption DELETES a bespoke rule rather
         than adding a look. What is new is '.ds-chip-val': the count now runs a full
         ladder step above its own icon and label, which is theme.ts's recorded finding
         that "on the reference plates the numeral is the loudest thing in the counter and
         the icon is second; ours were the same size, which is why a trophy total read as
         chrome". '.fa-chip' STAYS on the element - 'screen_metrics' and 'home_metrics'
         both key their headline set on it, and dropping it would shrink a guard's
         coverage to make a class list tidier. -->
    <header class="fa-topbar">
      <div class="fa-chip ds-chip ds-chip--slate"><span class="fa-chip-em">${_("avatar")}</span><span data-el="name"></span></div>
      <div class="fa-chip ds-chip ds-chip--slate"><span class="fa-chip-em">${_("trophy")}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="trophies">0</span></div>
      <div class="fa-chip ds-chip ds-chip--slate home-chip-coin"><span class="fa-chip-em">${_("coin")}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="coins">0</span></div>
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
        <button class="fa-tab is-active" type="button">${_("home")} Home</button>
        <button class="fa-tab" type="button" data-go="characters">${_("chefhat")} Foods</button>
        <button class="fa-tab" type="button" data-go="trophies">${_("trophy")} Trophies</button>
        <!-- The one destination on this bar that cannot currently sell anything, and it
             is here anyway. The lobby's standing rule is "nothing advertises something
             that does not work", and the shop passes it on the same terms the gem store
             already does: nothing on it is a live-looking control that no-ops, every
             price and every drop rate on it is real, and it states in words that buying
             is off and why. Hidden would have been the dishonest option — it would put
             a compliance surface where no screenshot, no contrast battery and no
             acceptance test can reach it. See the header of shop.ts. -->
        <button class="fa-tab" type="button" data-go="shop">${_("coin")} Shop</button>
      </nav>
      <button class="fa-iconbtn" type="button" data-el="settings" aria-label="Settings">${_("gear")}</button>
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
            <span class="home-track-icon" data-el="roadicon">${_("chest")}</span>
            <span class="home-track-title" data-el="roadtitle">Next reward</span>
            <span class="home-track-pill" data-el="roadpill">${_("trophy")}</span>
          </span>
          <span class="home-track-sub" data-el="roadsub"></span>
          <!-- ADOPTED: '.ds-bar ds-bar--sm'. theme.ts's adoption map names '.home-bar' as
               a '.ds-bar' site, and the component supplies the track, the radius, the ink
               line and the top-light on the fill. The FILL COLOUR stays this file's — the
               gold diagonal stripe is the road's identity and the component takes its ink
               from the caller by design. -->
          <span class="home-bar ds-bar ds-bar--sm"><span class="home-bar-fill ds-bar-fill" data-el="roadfill"></span></span>
        </button>

        <button class="home-track" type="button" data-go="trophies" data-el="chest">
          <span class="home-track-top">
            <span class="home-track-icon">${_("gift")}</span>
            <span class="home-track-title">Free chest</span>
            <span class="home-pips" data-el="pips"></span>
          </span>
          <span class="home-track-sub" data-el="chestsub"></span>
        </button>

        <button class="home-track home-track--held" type="button" data-go="trophies" data-el="held" hidden>
          <span class="home-track-top">
            <span class="home-track-icon">${_("chest")}</span>
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
          <div class="home-rec"><span class="home-rec-ic">${_("medal")}</span><span class="home-rec-val is-win" data-el="wins">0</span><span class="home-rec-key">Wins</span></div>
          <div class="home-rec"><span class="home-rec-ic">${_("close")}</span><span class="home-rec-val is-loss" data-el="losses">0</span><span class="home-rec-key">Losses</span></div>
          <div class="home-rec"><span class="home-rec-ic">${_("trophy")}</span><span class="home-rec-val is-best" data-el="best">0</span><span class="home-rec-key">Best</span></div>
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
        <!-- 🔴 THE 3.6x HIERARCHY INVERSION, FIXED HERE AND NOT IN THE SHARED CLASS.
             Measured on this screen: the secondary control was 0.91x the PRIMARY's area
             where the reference's is 0.25x, which is why the lobby read as three equal
             columns instead of one dominant action. theme.ts records the finding and
             deliberately did NOT change '.fa-btn--quiet' to fix it — that class is live
             on five screens and the layer shipped pixel-neutral, so the fix belongs to
             each screen's owner. This is home's.

             It is a SIZE change, not a colour one. The class moves to '.ds-btn
             ds-btn--quiet', whose base holds the 44px tap floor while '.fa-btn--primary'
             runs to 78px, and the 'width: 100%' comes off so the control sizes to its
             own label instead of to the panel. '.fa-btn' STAYS: 'home_metrics' keys its
             headline set on it. -->
        <button class="fa-btn ds-btn ds-btn--quiet home-change" type="button" data-go="characters">
          ${_("swap")} Change
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
      <!-- 🚨 THE LOBBY ENTRY, AND IT IS THIS ELEMENT RATHER THAN THE CTA.
           NOTE: no backticks anywhere in this literal. A backtick inside a template
           string terminates it, and menu_accept parses all 88 modules for exactly this.
           DECISIONS 66 asks for "the lobby where the gameplay is set".
           ⚠️ WAS "DECISIONS 74", and it is wrong here and in four other places, kept
           per the reversed-assertion rule because the fix is a re-derivation and not a
           typo. Checked 2026-09-02 against the document itself: there is NO section
           heading numbered 74 in docs/DECISIONS-FOR-URI.md at all — the number appears
           only in prose, about a phone capture and about choosing BUILD over reword.
           The sentence quoted above sits under "### 66 — the six-player lobby. The
           default is withdrawn; build the affordance.", and the summary table at the
           top of that file attributes the same verbatim quote to 66. A citation is the
           one part of a comment that looks verified BECAUSE it is a citation, which is
           exactly how this one survived being pasted into five source files.
           ⚠️ ROUTED, not fixed: lobby.ts (x2), types.ts, brawl.ts and
           tools/tmp/lb_accept.mjs carry the same wrong number and are outside this
           pass's owned set.

           ── WAS: "the obvious wiring is the start button, and it is REFUSED by a
           measurement: journey.mjs — the only end-to-end gate in this project — and
           tools/match-play.mjs both click [data-el=start], wait for __screen ===
           characters, then click [data-el=fight]. Re-pointing the CTA breaks both, at a
           120 s timeout each, and neither file is in this pass's owned set." ──
           Kept per the reversed-assertion rule. The CONCLUSION survives and the
           ARGUMENT was wrong in both directions, re-derived 2026-09-02 by grepping
           [data-el=start] across tools/ instead of trusting this comment:

             * "journey.mjs is the only end-to-end gate" is FALSE. menu_accept.mjs is a
               REQUIRED PRE-COMMIT GATE and it clicks this exact button and waits on
               characters twice (its flow arm), which this comment does not mention.
             * "both" is FALSE and undercounts by eight. Ten files drive
               [data-el=start] on home and then wait on characters: menu_accept.mjs,
               journey.mjs, match-play.mjs, input_accept.mjs, kbdverdict.mjs,
               lb_accept.mjs, lb_journey.mjs, reload_watch.mjs, us_loadout.mjs and the
               archived _before_menu_accept.mjs. Uri was offered the trade as "the two
               tools that depend on it are ours and can be updated" — the real number
               is ten, one of them shipped, and that is the fact that decides it.
             * "it is what keeps 2f907a7's four-arm np_identity bit-identity true BY
               CONSTRUCTION" is FALSE, and it was the load-bearing half. np_identity
               NEVER VISITS THIS SCREEN: it opens ?px=1070&py=610&player=...&enemy=...
               and main.ts routes any MATCH_ONLY_PARAMS straight to the match. No click,
               no home screen, no dependency on this line at all. That claim could have
               been used to refuse a change on grounds that do not exist.

           ⚠️ SO THE REAL ARGUMENT IS OWNERSHIP, NOT BIT-IDENTITY: seven of those ten
           tools are outside this pass's owned set, and re-pointing the CTA is a
           ten-file change that has to land atomically with them or the battery is red.
           Routed to the orchestrator. What is fixed HERE instead is the thing Uri
           actually reported — that this control does not look like a control and says
           nothing about items.

           It is also where the reference plates put mode configuration — a wide tappable
           band immediately left of the primary CTA, mode on line 1, variant on line 2 —
           which is the composition this element already had as a dead div. So the change
           is that it becomes what it looks like.

           ⚠️ It KEEPS .home-mode and both inner class names. The old note said
           "home_metrics, screen_metrics and menu_accept all key on them"; grepping
           tools/ says only home_metrics does (its HEADLINE regex names home-mode-name),
           plus ud_defects.mjs on both inner names and lb_accept.mjs on .home-mode.
           screen_metrics and menu_accept do not mention any of the three. The names are
           kept anyway — two live tools is reason enough — but the list is now the
           measured one. -->
      <button class="home-mode" type="button" data-el="mode"
              aria-label="Match lobby — choose how many players are in the match">
        <!-- The leading tile is the "you act on this" mark. This screen's own grammar,
             stated in the record-row comment above: amber tiles for things you act on,
             dark slate for things you read off. The party glyph is the same one the
             lobby's count chip carries, so the two screens are visibly one subject. -->
        <span class="home-mode-tile" aria-hidden="true">${_("party")}</span>
        <span class="home-mode-lines">
          <span class="home-mode-name">${Lb}</span>
          <span class="home-mode-sub" data-el="modesub">${Db($a)} · last one standing</span>
        </span>
        <!-- 🚨 THE ANSWER TO "how do i use an item in a game?" IS ON THIS CONTROL.
             Measured on the shipped screen with tools/tmp/lf_probe.mjs: ZERO of 41
             visible text runs on home matched /items?|kits?|loadouts?|equip|gear/, and
             zero aria-labels did either. The route to the loadout existed and nothing
             on the screen named it. Two slots, ITEM_SLOTS from rules.ts rather than a
             typed two, each showing the equipped icon or an empty + — and the empty
             slot is the point: lobby.ts 5e refuses to auto-equip precisely so that
             "I chose this" and "I never opened this screen" are different states, and
             an empty slot is what makes the second one visible from here. -->
        <span class="home-mode-kit">
          <span class="home-mode-kit-cap">Items</span>
          <span class="home-mode-slots" data-el="modekit"></span>
        </span>
        <!-- WAS the party glyph, which is now the leading tile. A trailing mark on a
             control should say "this goes somewhere", and the icon set has no forward
             chevron — back is the only chevron in it, mirrored here in CSS rather than
             by adding a near-duplicate glyph to a shared registry that five screens
             draw from. -->
        <span class="home-mode-go" aria-hidden="true">${_("back")}</span>
      </button>
      <button class="fa-btn fa-btn--primary" type="button" data-el="start">${_("play")} Start Game</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const o=T=>{const N=e.querySelector(`[data-el="${T}"]`);if(!N)throw new Error(`home: missing element "${T}"`);return N},n=o("stage3d"),s=o("confetti"),i=o("heroname"),r=o("herorarity"),l=o("hint");let h=0;function c(){const T=t.profile.claimable.length,N=o("road"),I=o("roadfill");if(T>0){N.classList.add("is-ready"),o("roadicon").innerHTML=_("sparkle"),o("roadtitle").textContent=T>1?`${T} rewards ready`:"Reward ready",o("roadsub").textContent="Tap to claim",o("roadpill").textContent="Claim",I.style.width="100%";return}N.classList.remove("is-ready");const{progress01:F,next:L}=iu(t.profile.trophies);if(I.style.width=`${(F*100).toFixed(1)}%`,!L){o("roadicon").innerHTML=_("flag"),o("roadtitle").textContent="Road complete",o("roadsub").textContent="Every reward claimed",o("roadpill").innerHTML=`${_("trophy")} ${t.profile.trophies.toLocaleString()}`;return}const H=Fl(L.reward,t.profile.unlocked);o("roadicon").innerHTML=L.reward.type==="character"?Ha(L.reward.id,{crop:"head"}):L.reward.type==="container"?_t(L.reward.kind):Ca(H.emoji),Xo(e),o("roadtitle").textContent=H.title,o("roadsub").textContent=`${(L.trophies-t.profile.trophies).toLocaleString()} trophies to go`,o("roadpill").innerHTML=`${_("trophy")} ${L.trophies.toLocaleString()}`}function d(){const T=t.profile.winsToNextChest,N=wt.winsPerChest,I=Math.max(0,Math.min(N,N-T));o("chestsub").textContent=T===0?"Ready on your next win":`${T} more ${T===1?"win":"wins"}`,o("pips").innerHTML=Array.from({length:N},(F,L)=>`<span class="home-pip${L<I?" is-on":""}"></span>`).join("")}function p(){const T=t.profile.containerCount,N=o("held");N.hidden=T===0,T>0&&(o("heldtitle").textContent=T===1?"1 chest held":`${T} chests held`)}const u=[["damage","Damage","damage","#FF8A96"],["health","Health","health","#8FE04A"],["speed","Speed","speed","#6FC8F5"]];function m(){const T=ce[t.profile.selected];o("stats").innerHTML=u.map(([N,I,F,L])=>`
      <div class="fa-stat ds-row ds-row--slate home-stat" style="--ds-row-accent:${L}">
        <span class="ds-tile ds-tile--stat" style="--ds-tile-fill:${L}">${_(N)}</span>
        <span class="ds-row-body">
          <span class="ds-row-label">${I}</span>
          <span class="ds-row-val ds-num">${T.stats[F]}</span>
        </span>
      </div>`).join(""),f()}function f(){const T=ce[t.profile.selected];h>=T.abilities.length&&(h=0),o("kit").innerHTML=T.abilities.map((F,L)=>`
      <button class="home-kit-tile${L===h?" is-on":""}" type="button" data-kit="${L}">
        <span class="home-kit-em">${Ca(F.emoji)}</span>
        <span class="home-kit-name">${F.name}</span>
      </button>`).join("");const N=o("kitcap"),I=T.abilities[h];N.innerHTML=I?`<span class="home-kit-capname">${I.name}</span><span>${I.desc}</span>`:"",g()}function g(){const T=o("kit"),N=T.children[h];if(!N)return;const I=T.getBoundingClientRect(),F=N.getBoundingClientRect();if(I.width<=0||F.width<=0)return;const L=F.left+F.width/2,H=getComputedStyle(T).direction==="rtl"?(I.right-L)/I.width:(L-I.left)/I.width;o("kitcap").style.setProperty("--home-cap-x",`${(H*100).toFixed(1)}%`)}function w(){const T=e.getBoundingClientRect();if(T.height<=0)return;const N=e.querySelector(".fa-topbar");if(N){const F=N.getBoundingClientRect();F.height>0&&e.style.setProperty("--home-topbar-b",`${Math.round(F.bottom-T.top)}px`)}const I=e.querySelector(".home-bottom");if(I){const F=I.getBoundingClientRect();F.height>0&&e.style.setProperty("--home-bottom-h",`${Math.round(T.bottom-F.top)}px`)}}function b(){const T=Eh(Sh(t.profile.economy));o("modekit").innerHTML=Array.from({length:Tt},(I,F)=>{const L=T[F];return L===void 0?'<span class="home-mode-slot is-empty" aria-hidden="true">+</span>':`<span class="home-mode-slot is-filled" aria-hidden="true" title="${Ce[L].name}">${_(L)}</span>`}).join("");const N=T.length;o("mode").setAttribute("aria-label",`Match lobby — your items and how many players are in the match. ${N} of ${Tt} item slots filled.`)}function y(){const T=ce[t.profile.selected];o("name").textContent=t.profile.name,o("trophies").textContent=t.profile.trophies.toLocaleString(),o("coins").textContent=t.profile.coins.toLocaleString(),c(),d(),p(),m(),b(),o("wins").textContent=t.profile.wins.toLocaleString(),o("losses").textContent=t.profile.losses.toLocaleString(),o("best").textContent=t.profile.bestTrophies.toLocaleString(),o("lv").textContent=`Lv ${t.profile.level}`,o("lvnext").textContent=`Lv ${t.profile.level+1}`,o("lvfill").style.width=`${(t.profile.levelProgress01*100).toFixed(1)}%`,o("lvxp").textContent=`${t.profile.xp%Dn} / ${Dn} XP`,i.textContent=T.name,r.textContent=T.rarity,r.style.background=St[T.rarity],a.show(T.id)}const v=T=>{const N=T.target,I=N.closest("[data-kit]");if(I){const H=Number(I.dataset.kit);Number.isInteger(H)&&(h=H,f());return}const F=N.closest("[data-go]");if(!F)return;const L=F.dataset.go;L==="characters"?t.navigate({name:"characters"}):L==="trophies"?t.navigate({name:"trophies"}):L==="shop"&&t.navigate({name:"shop"})};e.addEventListener("click",v),o("start").addEventListener("click",()=>{t.navigate({name:"characters"})}),o("mode").addEventListener("click",()=>{t.navigate({name:"lobby"})}),o("settings").addEventListener("click",()=>{t.navigate({name:"settings"})}),o("stage").addEventListener("click",()=>{a.poke(),ui(s,50,18)}),setTimeout(()=>l.classList.add("is-faded"),4200);const k=t.profile.onChange(y);y(),a.attachTo(n);const E=requestAnimationFrame(()=>{g(),w()}),x=new ResizeObserver(()=>w()),M=e.querySelector(".fa-topbar"),R=e.querySelector(".home-bottom");return M&&x.observe(M),R&&x.observe(R),{root:e,update(T){a.update(T)},resize(){a.resize(),g(),w()},dispose(){k(),x.disconnect(),cancelAnimationFrame(E),e.removeEventListener("click",v),a.setScene("portrait"),a.detach(),e.remove()}}}const _b=`
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
/* ADOPTED: the elevation ladder. This four-layer stack was one hand-typed idiom at two
   hand-typed parameters -- exactly what theme.ts's '--ds-e*' collapses -- and the two
   outer layers are now 'var(--ds-e4)' (the hero-CTA elevation, which is what a panel
   this large should carry) and the top highlight is 'var(--ds-bevel)'. The warm inner
   pool is KEPT as a literal and is the one thing here that is not on the ladder: it was
   added against a critic finding ("no warmth pooling in the base") and there is no token
   for a hue-tinted inner glow. Recorded rather than deleted to make a counter go up. */
.fa-home .home-col {
  border-width: var(--ds-stroke-3);
  box-shadow: var(--ds-e4), var(--ds-bevel), inset 0 -10px 16px rgba(150,96,30,0.10);
}
/* Panel titles were 62%-opacity ink at ~12px — the lightest structural type on the
   screen, and measured at 4.8:1. Solid ink, larger, with a gold rule under it, so a
   heading reads as a heading and not as a caption. */
/* ── TYPE: STEP 3, AND THE STEP IS THE POINT ─────────────────────────────────
   'ds_inventory --clamps' decomposed every font-size on the menus and found 91 of 102
   -- 89% of all menu type -- inside ONE cluster: min 0.58-0.84rem, max 0.70-1.15rem.
   The menus did not have a scale that drifted, they had ONE SIZE JITTERED 26 WAYS, and
   this file supplied a dozen of the jitters. Every 'font-size' below now names a rung
   of theme.ts's histogram-derived ladder, and the rung is chosen by MEANING:

     t1  caption / tag      the tap hint, the record's key, the level caption, the pill
     t2  label              a card's sub-line, an ability name, the mode's sub
     t3  body / control     a section title, a card's title
     t4  lead               the mode name, and (from theme.ts) a chip's numeral
     t5  numeral            the record's counts, and the stat row's value
     t6  glyph / title      the ability icon
   ⚠️ A ladder assigned at random scores as well on any counter as one assigned by
   meaning (LESSONS §6b). The counter is 'da_geom --compare's T3; the assignment is
   this table, and the close-out is the PNG. */
.fa-home .fa-panel-title {
  color: var(--ink);
  font-size: var(--ds-t3);
  letter-spacing: var(--ds-track-caps);
}
.fa-home .fa-panel-title::after {
  content: '';
  display: block;
  width: 32px;
  height: 4px;
  margin-top: 5px;
  border-radius: var(--ds-r-pill);
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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-home .home-track:hover { filter: brightness(1.04); }
.fa-home .home-track:active {
  transform: translateY(3px);
  box-shadow: var(--ds-e0), var(--ds-bevel);
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
.fa-home .home-track-icon { font-size: var(--ds-t5); line-height: 1; flex: 0 0 auto; }
.fa-home .home-track-title {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold);
  font-size: var(--ds-t3);
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
  font-size: var(--ds-t2); font-weight: var(--ds-w-body); color: #4A3524;
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
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  background: var(--ink); color: var(--cream);
  border-radius: var(--ds-r-pill); padding: 3px 9px; white-space: nowrap;
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

/* Distance-to-next, measured across the gap the player is actually crossing.
   ── ADOPTED '.ds-bar ds-bar--sm', SO ALL THAT IS LEFT HERE IS WHAT THE COMPONENT
      CANNOT KNOW ────────────────────────────────────────────────────────────────
   The track, the ink line, the pill radius, the clip and the fill's top-light all come
   from theme.ts now. Two declarations have to stay, and both are about the CONTEXT
   rather than the component:

     * 'flex: 0 0 auto'. '.ds-bar' is 'flex: 1 1 auto', which is right in the flex ROW
       it was drawn for and wrong inside '.home-track', which is a flex COLUMN -- there
       the same declaration makes the bar grow in HEIGHT until it fills the card. This
       is the '.home-col > *' guard one level down, for the same reason.
     * the diagonal gold stripe, which is this row's identity and which '.ds-bar-fill'
       takes from the caller by design ('--ds-bar-ink' or an override). */
.fa-home .home-bar { flex: 0 0 auto; }
/* 🚨 'display: block' IS LOAD-BEARING AND THIS FILE ALREADY KNEW IT.
   The note above 'renderFighter' has said since round 1: "'theme.ts' styles the fill
   with a width and a height and nothing else — an INLINE SPAN silently ignores both,
   and the bars render as empty tracks." Deleting this file's own '.home-bar-fill'
   block during the '.ds-bar' adoption took the 'display: block' with it, and the very
   first capture showed the road card's bar as an empty cream track with a 100%-width
   fill inside it that was not drawing anything. Rendering and INVISIBLE, for the
   twenty-first time (AGENT-BRIEF §4.2), caught by reading the PNG and not by any
   assertion — 'menu_accept' and 'ud_defects' both passed it.
   ⚠️ '.ds-bar-fill' in 'theme.ts' has the same gap and it is a trap for every future
   adopter. That file is not this owner's; it is in the report. */
.fa-home .home-bar-fill {
  display: block;
  background: repeating-linear-gradient(45deg, var(--gold) 0 8px, var(--mustard) 8px 16px);
}

/* Free-chest cadence. Countable, so it is counted. */
.fa-home .home-pips { display: flex; gap: 3px; flex: 0 0 auto; }
.fa-home .home-pip {
  width: 10px; height: 10px; border-radius: var(--ds-r-round);
  border: var(--ds-stroke-1) solid var(--ink);
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
  .fa-home .home-track-icon { grid-area: ic; font-size: var(--ds-t4); }
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
  background: ${yu};
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
/* 🚨 AND "THE TOP BAR IS 56px TALL AT EVERY ONE OF THEM" IS FALSE IN PORTRAIT, WHICH IS
   WHERE URI HOLDS THE PHONE. Kept above per the reversed-assertion rule; this is the
   correction and the reason.

   All six viewports in that table are landscape or desktop, and none is under 844px
   wide — so not one of them fires the '@media (max-width: 700px)' block at the bottom
   of this file, which sets '.fa-topbar { flex-wrap: wrap }'. Wrapped, the bar is not
   56px. Measured on a detached worktree of ce0c665, 390x844:

     .fa-topbar        11.0 -> 163.0   152px tall, THREE rows
       row 1  chips                     11 ->  51
       row 2  .fa-tabs                  57 -> 113
       row 3  the settings gear ALONE  119 -> 163
     .home-nameplate   top 92.8   (clamp(70px, 11vh, 120px) -> 92.84)
     .home-hero-name   92.8 -> 120.3

   The name therefore starts 20.2px INSIDE the tab bar. 'tools/tmp/mn_occlude.mjs',
   16 arms over 4 detectors: OCCLUDED 80.7% of its ink, OVERLAP 71% of its box, occluder
   named as '.fa-tabs'. occFrac's self-pair floor is 0.000 pp and overlapFrac is exact
   geometry, so both numbers are far outside the noise. The hero's own NAME, on the
   lobby, on a phone, in portrait.

   ⚠️ THE FLOOR ABOVE WOULD HAVE HELD — the portrait override discarded it. It reads
   'top: clamp(70px, 11vh, 120px)' with no 'max()', three declarations below the
   'flex-wrap: wrap' that invalidated the constant it was derived from. A guess replaced
   a derivation, in the same block that broke the derivation.

   The offset now comes off the bar's MEASURED bottom ('publishBars', mirroring
   'hud.ts''s '--fa-topbar-b', whose comment records this identical class on the touch
   radar). A measurement survives wrapping, a font swap, a longer player name and a
   fifth tab; no constant does. '--tap + 12px' stays as the FALLBACK so a build where
   the script never runs is exactly as good as the one before it — not worse. */
.fa-home .home-nameplate {
  position: absolute;
  top: max(
    calc(var(--home-topbar-b, calc(var(--fa-safe-t) + var(--gap) + var(--tap) + 12px)) + 6px),
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
  border-width: var(--ds-stroke-1);
  box-shadow: var(--ds-e1);
}

/* BOTTOM-LEFT, not bottom-right. The stage now runs the full screen height, so its
   bottom-right corner is exactly where the mode plate and START GAME are -- the hint
   would have been drawn across the primary CTA. */
/* 🚨 AND BOTTOM-LEFT IS NOT FAR ENOUGH LEFT IN PORTRAIT — same reasoning, same blind
   spot, one axis over. Kept above per the reversed-assertion rule.

   The rule dodged the CTA on the assumption that it sits in the bottom-RIGHT corner.
   It does at 844x390. At 390x844 '.home-bottom' wraps ('flex-wrap: wrap' in the
   max-width:700px block), the mode plate takes its own full-width row above, and START
   GAME — 269.8px of a 370px content column — spans x 114.8 -> 384.5. The hint spans
   x 24 -> 140.7 at the same y. Measured on ce0c665, 390x844:

     .home-stage-hint   x  24.0 -> 140.7   y 805.5 -> 830.5
     [data-el=start]    x 114.8 -> 384.5   y 753.7 -> 834.4

   'mn_occlude': OCCLUDED 10.8% of the hint's ink, OVERLAP 10% of its box, occluder
   named '.fa-btn fa-btn--primary'. Small, and real — it eats the final T of "TAP TO
   TAUNT", which is worse than it sounds because a clipped word reads as a bug rather
   than as a quiet label.

   There is no horizontal escape: the CTA is 73% of the content width. So the hint goes
   ABOVE the footer instead of beside it, off '--home-bottom-h' (the footer's measured
   height, 'publishBars') rather than off a guess about which corner the CTA is in. It
   is still the stage's bottom-left, just above the band the footer owns — and it still
   sits under the character rather than over him, which is what "bottom-left" was
   protecting. The fallback keeps today's value, so a build without the script is
   unchanged. */
.fa-home .home-stage-hint {
  position: absolute;
  bottom: calc(var(--home-bottom-h, 0px) + clamp(8px, 1.6vh, 16px));
  inset-inline-start: clamp(4px, 1vh, 12px);
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  letter-spacing: var(--ds-track-caps);
  text-transform: uppercase;
  color: var(--cream);
  background: linear-gradient(180deg, rgba(42,29,58,0.94) 0%, rgba(16,10,26,0.96) 100%);
  border: var(--ds-stroke-1) solid rgba(255,243,222,0.45);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e2);
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
/* WAS, and kept with the reason per this project's rule about reversed assertions:

     ".fa-home .home-stats { display: flex; flex-direction: column; gap: 5px; }"
     "The shared '.fa-stat-label' is a fixed 58-92px column, which is right for
      character select's narrow stats panel and wrong here, where the label carries an
      icon too."
     .fa-home .home-fighter .fa-stat-label { display:flex; align-items:center; gap:5px;
                                             width:auto; flex:0 0 auto; }

   Both are obsolete because the element they describe is gone: '.fa-stat-label' and
   '.fa-stat-track' are no longer rendered on this screen. See 'renderFighter()' for the
   measurement that removed the bar -- character select's taller, pipped version of the
   same bar scored IDENTICALLY, so the bar was not the thing.

   ⚠️ THE THEME'S '.fa-stat-*' CHILDREN ARE NOT REUSED, AND THAT IS DELIBERATE.
   '.fa-stat-val' carries 'width: 20px' and 'color: rgba(26,18,36,0.7)' -- a 70%-ink
   value that on this row's SLATE plate is dark ink on a dark ground, which is
   'docs/LESSONS.md' §1 case 10 exactly. Reusing the class to look tidy would have
   shipped that bug for the third time in this repo. */
.fa-home .home-stats { display: flex; flex-direction: column; gap: var(--ds-s2); }
/* ⚠️ THE ROW LIST IS THE TALL-VIEWPORT FORM AND IT DOES NOT FIT A LANDSCAPE PHONE.
   Three 56px rows plus gaps is ~180px against the ~64px the old bars occupied, and
   'ud_defects' measures the left flank's slack at 852x480 as 24.95px. So the same three
   facts are laid out ACROSS at short viewports instead of DOWN -- see the max-height
   block at the foot of this file. The tile, the colour-coded label and the display-
   weight numeral survive at every viewport; only the axis changes. */

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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-home .home-kit-tile:last-child:nth-child(odd) { grid-column: 1 / -1; }
.fa-home .home-kit-tile:hover { filter: brightness(1.04); }
.fa-home .home-kit-tile:active {
  transform: translateY(3px);
  box-shadow: var(--ds-e0), var(--ds-bevel);
}
.fa-home .home-kit-tile.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
  box-shadow: var(--ds-e2), var(--ds-bevel);
}
.fa-home .home-kit-em { font-size: var(--ds-t6); line-height: 1; flex: 0 0 auto; }
/* WRAPS, for the same reason the track title does. At 852x480 a 58.17px tile rendered
   "Tomato Toss" as "Tomato T..." and "Lettuce Fling" as "Lettuce ..." — three of the
   nine truncated runs on the screen, and unlike the track rows these strings come from
   'rules.ts' and cannot be shortened here. The longest single word in the cast's
   ability names measures ~40px against a 57-58px tile at every viewport where the tile
   exists, so the wrap always lands on a space and 'break-word' is only a floor. */
.fa-home .home-kit-name {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold);
  font-size: var(--ds-t2);
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
  font-weight: var(--ds-w-body);
  font-size: var(--ds-t2);
  line-height: 1.15;
  text-align: center;
  color: #3B2A18;
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel);
}
/* The selected ability's NAME, hidden by default because the tile beside it already
   carries it. It is turned on at exactly one breakpoint — the landscape phone, where
   the tiles go icon-only to fit (see the max-height block at the foot of this file) —
   so the caption is the only place the name exists there. Rendered as its own element
   rather than concatenated into the string, because the two states differ in LAYOUT,
   not in content, and a screen must not have to re-run 'renderKit' to change size. */
.fa-home .home-kit-capname { display: none; font-weight: var(--ds-w-black); }
/* NON-BREAKING SPACES, both sides. A plain space in 'content' collapses against the
   adjacent inline box and the first capture rendered "Tomato Toss -Slows enemies down"
   — the leading space survived and the trailing one did not. The dash is also what
   stops the separator from being the wrap point on a two-line caption.
   ⚠️ DOUBLE backslashes: this whole stylesheet is a JS template literal, so a single
   backslash is consumed by JS and never reaches CSS. Written singly it compiled as an
   octal escape and tsc refused the file (TS1487). Same family of trap as the backtick
   rule at the top of this file. */
.fa-home .home-kit-capname::after { content: '\\00a0\\2013\\00a0'; font-weight: var(--ds-w-body); }
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
  border-left: var(--ds-stroke-1) solid var(--ink);
  border-top: var(--ds-stroke-1) solid var(--ink);
  border-start-start-radius: var(--ds-r-1);
}
/* WAS: '.fa-home .home-change { margin-top: 4px; width: 100%; }', and the 'width: 100%'
   is the whole 3.6x inversion in one declaration. A secondary control stretched to its
   panel is 0.91x the primary's area; the reference's is 0.25x. It now sizes to its own
   label and centres, and theme.ts's stated target -- "a caller should hold its WIDTH
   near half the primary's" -- is what 'da_geom --compare's T4 column measures. */
/* ⚠️ AND THE PADDING COMES IN A STEP, BECAUSE A SHRINK-WRAPPED BUTTON CAN BE WIDER
   THAN ITS PANEL. 'menu_accept' caught it: at 1024x768 WITH a landscape tablet's 44px
   safe insets the flank falls to ~150px of content, and '.ds-btn''s 20px side padding
   plus a nowrap "CHANGE" plus its icon measures ~132px of MIN-CONTENT -- which a flex
   item is not allowed to shrink below, so the centred button overhung both sides and
   landed 3px inside the right safe inset ("inside-safe-area  fa-btn[Change] R41").
   'width: 100%' had been hiding it: a stretched item is bounded by its container by
   construction, and taking the stretch off is what exposed the min-content. One step
   down on the space scale is 16px, which clears it with 34px to spare -- and it makes
   the control smaller, which is the direction T4 wants anyway.
   Deliberately NO 'max-width: 100%': with 'white-space: nowrap' that would cap the BOX
   and let the label spill out of it, i.e. turn a loud gate failure into a silent visual
   one. If a longer label ever arrives here, this assertion should fail again. */
.fa-home .home-change { margin-top: var(--ds-s1); align-self: center; padding: 0 var(--ds-s4); }

/* Career record. Three numbers, all live, and the only place in the product that
   shows them — the trophy road tracks the CURRENT count, this tracks the peak. */
.fa-home .home-record {
  display: flex;
  gap: 5px;
  margin-top: 2px;
  padding-top: 6px;
  border-top: var(--ds-stroke-1) dotted rgba(26,18,36,0.2);
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
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel-dark);
  --fa-ic-ink: #FFF3DE;
}
.fa-home .home-rec-ic { font-size: var(--ds-t2); line-height: 1; opacity: 0.92; }
.fa-home .home-rec-val {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-black);
  font-size: var(--ds-t5);
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
  font-size: var(--ds-t1);
  font-weight: var(--ds-w-bold);
  letter-spacing: var(--ds-track);
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
  --ds-lip: var(--gold-shadow);
  box-shadow: var(--ds-e2), var(--ds-bevel);
}
.fa-home .home-track--road:active { box-shadow: var(--ds-e0), var(--ds-bevel); }
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
   the direct cost of changing a surface under type that was tuned for the old one.

   ── AND THE HAND-ROLLED SLAB IS NOW '.ds-chip--slate' ───────────────────────────
   The three declarations that used to live here -- the '#3A2A4E -> #241A33' gradient,
   'color: var(--cream)' and a '0 4px 0 / inset 0 2px 0' pair -- were this file
   re-deriving, by eye, exactly what theme.ts's slate chip declares from the ladder. They
   are deleted rather than tokenised: the class is on the elements now. What is left is
   the ONE thing the component cannot know, which is that an outlined SVG glyph inside it
   has to flip its ink or draw ink-on-ink -- the bug this repo has shipped three times. */
.fa-home .fa-chip { --fa-ic-ink: #FFF3DE; }
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
  font-size: var(--ds-t1);
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
/* ⚠️ NOW A <button> (see the markup): the plate is unchanged and what is added is the
   press physics, the 44px tap floor and a trailing glyph. 'appearance: none' and the
   explicit font declarations are not tidiness — a <button> inherits neither family nor
   size, and 'screen_metrics.mjs' has caught real controls shipping in Arial for exactly
   that reason. */
/* 🚨 THE PLATE IS CREAM NOW, AND THE PARAGRAPH ABOVE IS THE OLD REASON, KEPT.
   ── What it got right, and still does ────────────────────────────────────────
   The 3.50:1 finding was about INK ON A SATURATED RED BACKDROP and it is still fixed:
   the copy sits on an opaque plate rather than on the screen, and lf_probe measures the
   ink from the pixels behind each glyph, so the fix is verified rather than assumed.
   ── What it got wrong ────────────────────────────────────────────────────────
   A dark plate on this screen means "read this", not "press this", and the rule is
   THIS FILE'S OWN, three hundred lines up in the record-row comment: "amber tiles for
   things you act on, dark slate tiles for things you read off — and these are
   read-only, so they are the dark ones." The screen keeps it everywhere else — the
   status chips are dark and read-only, the record row is dark and read-only, the
   ability tiles you press are cream, the one you have selected is mustard. The lobby
   entry was the exception, and Uri could not find it. So this is not a taste reversal:
   the element was carrying the wrong side of a rule the screen already states.
   ── And the measurement agrees ───────────────────────────────────────────────
   tools/tmp/lf_probe.mjs, on a detached worktree of 32438b4, warm: the dark plate
   separated from the pixels behind it by 1.555:1 at 1600x900 and 1.102:1 at 390x844,
   against 3.87:1 and 4.27:1 for START GAME on the same frames. The nearest other dark
   pill on the screen is TAP TO TAUNT, which IS a label — that is the grammar it had
   joined. Known-bad validated: camouflaging the plate in its own surround colour drops
   the number to 1.007 and restoring brings it back to 1.554, so the metric moves for
   the reason it claims to.
   ⚠️ The HUD idiom sentence above is not wrong about the HUD. It is wrong about a
   MENU FOOTER, where nothing else dark is pressable. */
.fa-home .home-mode {
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: clamp(7px, 0.85vw, 12px);
  min-height: var(--tap);
  margin-inline-start: auto;
  /* WAS 'text-align: end'. The block used to be two right-aligned lines hugging the
     CTA; it is now a row of four objects reading left to right, so the type starts at
     its own left edge like every other card on the screen. */
  text-align: start;
  min-width: 0;
  font-family: 'Rubik', sans-serif;
  padding: 6px clamp(10px, 1.2vw, 16px);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  --ds-lip: rgba(0,0,0,0.35);
  box-shadow: var(--ds-e3), var(--ds-bevel);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-home .home-mode:hover { filter: brightness(1.12); }
.fa-home .home-mode:active { transform: translateY(3px); box-shadow: var(--ds-e0); }
.fa-home .home-mode-lines {
  display: flex;
  flex-direction: column;
  /* WAS 'flex-end' — see 'text-align' above. */
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
}
/* The leading tile. Mustard is the screen's "act on this" accent and a round filled
   tile is the shape the stat rows already use, so the control announces itself with a
   mark this screen has taught the player to read rather than with a new one. */
.fa-home .home-mode-tile {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(26px, 3.2vh, 34px);
  height: clamp(26px, 3.2vh, 34px);
  border-radius: 50%;
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  border: 2px solid var(--ink);
  box-shadow: var(--ds-bevel);
  font-size: var(--ds-t3);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
}
/* The kit strip. A hairline rule separates it from the mode copy because they answer
   two different questions and a flat row of four things reads as one. */
.fa-home .home-mode-kit {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-inline-start: clamp(7px, 0.85vw, 12px);
  border-inline-start: 2px solid rgba(26,18,36,0.22);
}
/* The WORD. 0 of 41 visible runs on this screen matched an item vocabulary before
   this; a picture of two slots with no noun beside it is a rebus. '#4A3524' is the
   same ink the gold row's sub-line uses and measures 7.1:1 there — on this cream it is
   lighter still, and lf_probe reports the measured value rather than this sentence. */
.fa-home .home-mode-kit-cap {
  font-family: 'Rubik', sans-serif;
  font-size: var(--ds-t1);
  font-weight: var(--ds-w-black);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  color: #4A3524;
  white-space: nowrap;
}
.fa-home .home-mode-slots { display: flex; align-items: center; gap: 4px; }
.fa-home .home-mode-slot {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(24px, 3vh, 30px);
  height: clamp(24px, 3vh, 30px);
  border-radius: 8px;
  border: 2px solid var(--ink);
  font-size: var(--ds-t3);
  line-height: 1;
}
/* A DASHED empty slot, and the dash is doing work: it is the one border style on this
   screen that means "nothing here yet", which is what makes the empty state read as an
   invitation rather than as a disabled control. lobby.ts 5e is deliberate about never
   auto-equipping, so this is the state a new player is actually in. */
/* ⚠️ WAS 'background: rgba(26,18,36,0.08)' — a grey wash — and the render is what
   killed it. Side by side with the filled state (both captured, both looked at), the
   EMPTY slot was the quieter of the two, and empty is the DEFAULT: lobby.ts 5e never
   auto-equips, so every new player sees this state and only this state. The one that
   has to invite a tap was the one reading as disabled. Mustard at 0.38 keeps the dashed
   "nothing here yet" edge while joining the screen's act-on-this family. */
.fa-home .home-mode-slot.is-empty {
  background: rgba(255,201,60,0.38);
  border-style: dashed;
  color: #4A3524;
  font-weight: var(--ds-w-black);
}
.fa-home .home-mode-slot.is-filled {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  box-shadow: var(--ds-bevel);
  --fa-ic-ink: var(--ink);
}
/* The affordance. WAS the party glyph in mustard on the dark plate, with the reason
   "a dark plate that is suddenly tappable needs to say so, and the glyph is the same
   'who is in the match' mark the lobby's own count chip carries". That mark is now the
   LEADING tile, where it labels the control; the trailing position says "this goes
   somewhere", which a party popper never did. Mirrored 'back' — see the markup. */
.fa-home .home-mode-go {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  font-size: var(--ds-t3);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
  transform: scaleX(-1);
  /* WAS 0.72. At 1600x900 the mark was the faintest thing on a control whose whole job
     is to say "this goes somewhere"; 0.85 still sits under the type without whispering. */
  opacity: 0.85;
}
.fa-home .home-mode-name {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-black);
  font-size: var(--ds-t4);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  /* WAS 'var(--mustard-hi)', which was correct ON THE DARK PLATE and would be 1.5:1 on
     this one. The plate changed under the type — the exact failure the status-chip
     comment above records as LESSONS §1 case 10 — so the type changes with it. */
  color: var(--ink);
  text-shadow: none;
  white-space: nowrap;
}
.fa-home .home-mode-sub {
  font-family: 'Rubik', sans-serif;
  font-size: var(--ds-t2);
  font-weight: var(--ds-w-bold);
  /* WAS 'rgba(255,243,222,0.94)' — cream, for the dark plate. '#4A3524' is the ink the
     gold row's sub-line already uses; it is a value chosen against a warm light plate
     rather than a cream dimmed on a dark one, which is what the old colour was. */
  color: #4A3524;
  text-shadow: none;
  white-space: nowrap;
}

/* ── THE STAT ROWS TURN THROUGH 90 DEGREES ON A SHORT SCREEN ──────────────────
   The tall-viewport form is theme.ts's '.ds-row': a 56px slate slab per stat, carrying a
   56px tinted tile, a colour-coded label and the numeral under it at display weight.
   Three of those plus gaps is ~180px, and 'ud_defects' measures the left flank's slack
   at 852x480 as 24.95px -- so the vertical list is simply not affordable on a landscape
   phone, and pretending otherwise would convert a legibility fix into a clipped panel,
   which is strictly worse (an ellipsis at least tells the player something was cut).

   What gives is the AXIS, and nothing else. Laid out across, the three rows share the
   flank's width and stack their own contents: tile on top, label under it, numeral
   under that. Every one of the three measured fixes survives -- a filled tinted TILE
   instead of a line glyph, a colour-coded label, and the numeral a full ladder step
   above it -- because none of them was ever about the row being horizontal. This is the
   shape '.home-record' three panels down already uses for the same reason.

   ⚠️ 460px is NOT the right threshold here even though it is what the rest of this file
   uses. The binding case is 852x480, which is above it, and 480 is where the flank's
   slack was measured. 520 is the same bound the container-query trims below already
   run on.

   🚨 AND THIS BLOCK'S POSITION IN THE FILE IS LOAD-BEARING. It was first written just
   above the existing '@media (max-height: 520px)' container-query block, which is 350
   lines ABOVE '.fa-home .home-stats'. A MEDIA QUERY ADDS NO SPECIFICITY, so the later
   base rule won, 'flex-direction' stayed 'column', and the three rows -- now
   'flex: 1 1 0' in a zero-height column -- collapsed to about 8px each with their 30px
   tiles overflowing across the panel title. tsc was clean, the rule parsed, and the
   cascade simply did not reach it. Caught by reading the 844x390 PNG; no assertion in
   the battery would have. Keep this block BELOW the base rule. */
@media (max-height: 520px) {
  .fa-home .home-stats { flex-direction: row; gap: var(--ds-s1); }
  .fa-home .home-stat {
    flex: 1 1 0;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    min-height: 0;
    padding: var(--ds-s1) 0 var(--ds-s1);
  }
  /* 30px and not 56: three 56px tiles need 168px of a 155px flank before any padding.
     It is still a filled, tinted, bordered MASS rather than the 1.7px-stroke outline the
     audit measured -- which is the property that was wrong, not the diameter. */
  .fa-home .home-stat .ds-tile--stat {
    width: 30px;
    height: 30px;
    border-width: var(--ds-stroke-1);
    font-size: var(--ds-t6);
  }
  .fa-home .home-stat .ds-row-body { flex: 0 0 auto; align-items: center; text-align: center; }
  /* The label loses its caps tracking and nothing else. At 11px in a ~50px cell,
     0.09em of tracking on "DAMAGE" is the difference between the word fitting and the
     component's own ellipsis firing -- and an ellipsised label is the D2 defect this
     screen spent a whole pass removing. */
  .fa-home .home-stat .ds-row-label { letter-spacing: var(--ds-track-tight); }
  .fa-home .home-stat .ds-row-val { font-size: var(--ds-t4); }

  /* ── TWO PLACES WHERE THE LADDER OVERFLOWS A BOX, AND BOTH WERE FOUND IN A PNG ──
     A type ramp is sized off vh and knows nothing about how wide the box under it is.
     Both of these read clean in every assertion in the battery and both were plainly
     broken at 852x480 in the capture:

     1. THE RECORD NUMERAL. t5 floors at 1.18rem = 18.9px, and "3,170" at that size
        needs ~62px against a ~50px tile — the comma and the last digit were drawn
        outside the plate. t3 floors at 13.1px, still a clear step above the 11px key
        under it, and inside the tile.
     2. THE LEVEL ROW. Both "Lv 17" and "Lv 18" went from 9.92px to 11.04px, which is
        the right direction (9.92 is under 'screen_metrics''s 11px legibility floor) and
        took ~10px off the track between them — enough that theme.ts's own
        '.fa-level-xp' caption WRAPPED inside a 14px track and was clipped through the
        middle of both lines. There is no ladder rung below 11.04px by design, so the
        room has to come from the row rather than from the type: the TRAILING label goes
        and the leading one plus the fraction carry it, which is complete
        ("Lv 17 / 180 of 250 XP") and is the same kind of trim this breakpoint already
        makes to the panel rule and the record glyphs. */
  .fa-home .home-rec-val { font-size: var(--ds-t3); }
  .fa-home .home-level .fa-level-label:last-child { display: none; }
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
  /* ⚠️ WAS '.fa-home .home-mode { display: none; }', on the reasoning that the footer's
     copy is not durable at this width and the mode block is only a caption. That reason
     expired on 2026-08-12: the block is now the ONLY route to the match lobby
     (DECISIONS 66 -- was 74, see the '.home-mode' markup), and hiding it would make the
     seat count unreachable in portrait
     except by typing '?screen=lobby' — "hidden is unmeasurable", and worse, unusable.
     Kept here per the project's rule on reversed assertions.

     It does not squeeze onto the CTA's line at 360px; it takes its own. '.home-bottom'
     already wraps at this breakpoint, so this is one declaration, and the block goes
     full-width and left-aligned because a right-aligned label above a full-width button
     reads as detached from it. */
  .fa-home .home-mode {
    order: -1;
    flex: 1 0 100%;
    justify-content: space-between;
    text-align: start;
  }
  /* 'text-align' and 'align-items' are now the BASE values too, so these two lines are
     no longer doing anything at this breakpoint. They stay because the base could move
     back and a silently-inherited alignment is how a portrait footer regresses without
     a rule to point at. */
  .fa-home .home-mode-lines { align-items: flex-start; }
  /* ⚠️ AND THE MIDDLE HAS TO ABSORB THE SLACK, or 'space-between' spreads FOUR objects
     across 370px and the tile floats away from the copy it labels. With the lines block
     flexing, the control reads as two groups — tile + copy on the left, kit + chevron
     on the right — which is the same left-to-right order as the landscape form. */
  .fa-home .home-mode-lines { flex: 1 1 auto; }
  .fa-home .home-bottom { flex-wrap: wrap; }
  /* WAS, and kept per the reversed-assertion rule:

       ".fa-home .fa-topbar-spacer { display: none; }"
       ".fa-home .fa-tabs { flex: 1 1 auto; }"
       "Two rows rather than one. The spacer goes because a flex spacer inside a
        wrapping row pushes the wrap point around for no benefit; the chips take the
        first line and the navigation takes the second."

     🚨 IT IS THREE ROWS, NOT TWO, AND THE THIRD HOLDS ONE 44px GEAR. Measured on a
     detached worktree of ce0c665 at 390x844 — '.fa-topbar' runs 11.0 -> 163.0, i.e.
     152px, 18% of the viewport height, before any content:

       row 1  chips                     11 ->  51
       row 2  .fa-tabs                  57 -> 113
       row 3  the settings gear ALONE  119 -> 163

     The spacer being gone is exactly WHY: with 'flex: 1 1 auto' the nav takes whatever
     is left of row 1, cannot fit, wraps to row 2 and then fills it — so the gear has
     nowhere to go but a third line, where it lands on the hero card looking like a
     stray control. The wrap point the old comment did not want the spacer to "push
     around" is the thing that needed pushing: give the nav its OWN row explicitly
     ('flex: 1 0 100%') and the wrap point stops being emergent, the spacer goes back to
     doing its one job (hold the gear against the right edge), and the bar is two real
     rows. 152px -> 102px, and the gear is where every other screen in this game puts
     it.

     This is also half of the fix for the hero name: 'publishBars' derives the
     nameplate's clearance from the bar's MEASURED bottom, so a shorter bar moves the
     name up with it rather than needing a second constant. */
  .fa-home .fa-topbar { flex-wrap: wrap; row-gap: 6px; }
  .fa-home .fa-topbar-spacer { display: block; flex: 1 1 auto; min-width: 0; }
  .fa-home .fa-tabs { order: 1; flex: 1 0 100%; }
  /* WAS 'flex: 1 1 0' — equal-width tabs, and that is what wrapped "Trophies".
     'flex-basis: 0' throws away every tab's content width and hands all four the same
     89.5px. Three of the labels are short enough not to care; "Trophies" needs 75px of
     label beside a 16px glyph inside 89.5px minus padding, does not get it, and the
     glyph takes line 1 while the word takes line 2 — so the bar loses its baseline and
     one of four tabs reads as broken. 'mn_occlude' flags it as WRAP with the icon and
     the label on different lines; the other three are correctly silent.
     'flex-basis: auto' keeps each tab's own content width as its starting size and then
     shares the slack, so the wide label gets the width it needs and the narrow ones give
     it up. Measured need at 390px: 4 labels 221.6 + 4 glyphs 64 + gaps 16 + padding 40
     = ~342 inside 358 of track. The 'min(..., 4.2vw)' is the graceful half: it is inert
     at 390px and shrinks the type on a 360 or 320px phone rather than letting it clip. */
  .fa-home .fa-tab {
    flex: 1 1 auto;
    justify-content: center;
    padding: 0 5px;
    gap: 4px;
    font-size: min(clamp(0.74rem, 1.9vh, 1.02rem), 4.2vw);
  }
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
  /* WAS '.fa-home .home-nameplate { top: clamp(70px, 11vh, 120px); }', DELETED rather
     than retuned, and kept here with the reason per the reversed-assertion rule.

     It is a bare clamp with no 'max()' — it threw away the derived floor whose own
     comment says it exists "so the nameplate moves with it instead of silently sliding
     back under the tabs", written three declarations below the 'flex-wrap: wrap' that
     invalidated the constant that floor was derived from. At 390x844 it resolves to
     92.84px against a bar that ends at 163: the name rendered 80.7% behind the tabs.

     Retuning the number would have fixed this viewport and no other. The base rule now
     derives from '--home-topbar-b', the bar's measured bottom, which is correct at every
     viewport and at every row count — including the 102px two-row bar this block now
     produces, which a retuned constant would have been wrong about immediately. */
}

@media (prefers-reduced-motion: reduce) {
  .fa-home .home-track.is-ready { animation: none !important; }
}
:root.fa-reduce-motion .fa-home .home-track.is-ready { animation: none !important; }
`,zb=4500,Pb=["No","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen","Twenty"];function $b(t){return Pb[t]??String(t)}function Bb(){const t=new URLSearchParams(location.search).get("hold"),e=t===null?NaN:Number(t);return Number.isFinite(e)&&e>=0?e:zb}function Ub(t){ya("fa-opening-styles",qb),xa();const e=He("div","fa-screen fa-opening"),a=yh();e.innerHTML=`
    <header class="open-head">
      <h1 class="open-title">Food Fight Arena</h1>
      <p class="open-tagline">${$b(Ee.length)} fighters. One kitchen. No table manners.</p>
    </header>

    <div class="open-stage">
      <div class="open-stage-3d" data-el="stage3d"></div>
      <div class="open-glow"></div>
    </div>

    <footer class="open-foot">
      <button class="fa-btn fa-btn--primary open-start" type="button" data-el="start">
        ${_("play")} Tap to start
      </button>
      <div class="open-timer" aria-hidden="true"><span class="open-timer-fill" data-el="timerfill"></span></div>
    </footer>
  `;const o=p=>{const u=e.querySelector(`[data-el="${p}"]`);if(!u)throw new Error(`opening: missing element "${p}"`);return u},n=o("stage3d");let s=!1,i=null;function r(){s||(s=!0,i!==null&&(clearTimeout(i),i=null),Se.unlock(),Se.music.play(),t.navigate({name:"home"}))}const l=p=>{p.key!=="Tab"&&r()},h=()=>r();window.addEventListener("keydown",l,!0),window.addEventListener("pointerdown",h,!0),o("start").addEventListener("click",r);const c=Bb();i=setTimeout(r,c);const d=o("timerfill");return d.style.transition=`width ${c}ms linear`,requestAnimationFrame(()=>{d.style.width="100%"}),a.show(t.profile.selected),a.attachTo(n),{root:e,update(p){a.update(p)},resize(){a.resize()},dispose(){i!==null&&clearTimeout(i),window.removeEventListener("keydown",l,!0),window.removeEventListener("pointerdown",h,!0),a.detach(),e.remove()}}}const qb=`
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
/* 🚨 THE 2-DEGREE TILT COSTS INK ABOVE THE BOX, AND ON A LANDSCAPE PHONE THE VIEWPORT
   TAKES IT. Measured on a detached worktree of ce0c665 with 'tools/tmp/mn_occlude.mjs'
   (CLIP is pure geometry, so the number is exact rather than within a floor):

     844x390   "Food Fight Arena"   CLIPPED 4.6%
     390x844   "Food Fight Arena"   clean
    1600x900   "Food Fight Arena"   clean

   Rotating a box about its centre lifts its top corners by (w/2)·sin(2°). This wordmark
   is ~10.3 ems wide, so that is ~0.18em of ink above the layout box — 5.1px at the
   28.1px the 7.2vh clamp resolves to at 390px tall. '.fa-screen''s top padding there is
   'var(--gap)' at its 6px floor, and '-webkit-text-stroke: 4px' puts another 2px outside
   the glyph. The tilt is deliberate and is documented above as "the single detail that
   stops a centred sans-serif wordmark reading as a placeholder", so the fix is to pay
   for the ink rather than to straighten the type.

   'em' and not 'px' because the overhang is proportional to the wordmark's WIDTH, which
   is proportional to its font-size — so one declaration is correct from the 1.5rem floor
   to the 4rem ceiling. The +3px covers the stroke, which is authored in px and does not
   scale. Costs 8.1px of the title row at landscape phone and 14.5px at desktop, both out
   of the 'minmax(0, 1fr)' hero row, which is the row with the slack. */
.fa-opening .open-title {
  margin: 0;
  padding-top: calc(0.2em + 3px);
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
`,jb=.15,Wb=44,Gb=78,Yb=5,Vb=10,md=.5,gd="touch-styles";function Kb(){return typeof window>"u"?!1:typeof navigator<"u"&&(navigator.maxTouchPoints??0)>0?!0:"ontouchstart"in window}function Xb(){return typeof window.matchMedia!="function"?!1:window.matchMedia("(pointer: coarse)").matches}function Zb(){const t=Math.min(window.innerWidth,window.innerHeight);return Math.max(Wb,Math.min(Gb,t*jb))}function Jb(t,e,a){const o=Math.max(Math.abs(t),Math.abs(e)),n=o>1e-6?Math.min(1,Math.hypot(t,e))/o:0;return a.x=Math.max(-1,Math.min(1,t*n)),a.y=Math.max(-1,Math.min(1,e*n)),a}function wd(){return{id:null,baseX:0,baseY:0,curX:0,curY:0}}function Qb(t){const e=Kb(),a=wd(),o=wd(),n={x:0,y:0},s={x:0,y:-1};let i=!1,r=!1,l=!1,h=0,c="",d="";if(!e)return{available:!1,get engaged(){return!1},move:n,get moving(){return!1},aimDir:()=>null,get firing(){return!1},clearAim(){},reset(){},dispose(){}};ey();const p=document.createElement("div");p.className="tch-root",p.innerHTML='<div class="tch-stick tch-stick--move" data-el="move-stick"><div class="tch-knob"></div></div><div class="tch-stick tch-stick--aim" data-el="aim-stick"><div class="tch-knob"></div></div><div class="tch-hint tch-hint--move" data-el="move-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">MOVE</div></div><div class="tch-hint tch-hint--aim" data-el="aim-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">AIM &amp; FIRE</div></div>',document.body.appendChild(p);const u=D=>p.querySelector('[data-el="'+D+'"]'),m=u("move-stick"),f=u("aim-stick"),g=u("move-hint"),w=u("aim-hint");Xb()&&(p.classList.add("is-hinted"),document.documentElement.classList.add("fa-touch-capable"));const y=t.canvas.parentElement,v=t.canvas.style.touchAction,k=y?y.style.touchAction:"";t.canvas.style.touchAction="none",y&&(y.style.touchAction="none");function E(D){if(!(D instanceof Node))return!1;const U=t.canvas;return D===U||U.contains(D)||D.contains(U)}function x(){return Zb()}function M(D,U){const te=x();let Z=D.curX-D.baseX,$=D.curY-D.baseY;const oe=Math.hypot(Z,$);if(oe>te){const ve=te/oe;D.baseX=D.curX-Z*ve,D.baseY=D.curY-$*ve,Z*=ve,$*=ve}const we=Math.hypot(Z,$);return U.x=Z,U.y=$,we}const R={x:0,y:0},T=[];function N(D){const U=T.indexOf(D);U>=0&&T.splice(U,1)}function I(D,U){for(let te=0;te<D.length;te++)if(D[te].identifier===U)return D[te];return null}function F(D,U,te){for(let Z=T.length-1;Z>=0;Z--){const $=I(te,T[Z]);if(!$){T.splice(Z,1);continue}if($.clientX<window.innerWidth*md===U){T.splice(Z,1),D.id=$.identifier,D.baseX=$.clientX,D.baseY=$.clientY,D.curX=$.clientX,D.curY=$.clientY;return}}}function L(){if(a.id===null){n.x=0,n.y=0;return}if(M(a,R)<Yb){n.x=0,n.y=0;return}const U=x();Jb(R.x/U,R.y/U,n)}function H(){if(o.id===null)return;const D=M(o,R);D<Vb||(s.x=R.x/D,s.y=R.y/D,i=!0)}function P(D,U,te){if(U.id===null)return te!==""&&(D.style.display="none"),"";const Z=U.curX-U.baseX,$=U.curY-U.baseY,oe=x(),we=Math.hypot(Z,$),ve=we>oe?oe/we:1,yt=Math.round(U.baseX),sa=Math.round(U.baseY),dn=Math.round(U.baseX+Z*ve),cs=Math.round(U.baseY+$*ve),Ea=yt+","+sa+","+dn+","+cs+","+Math.round(oe);if(Ea===te)return Ea;te===""&&(D.style.display="block"),D.style.setProperty("--r",oe.toFixed(0)+"px"),D.style.transform="translate("+yt+"px,"+sa+"px) translate(-50%,-50%)";const pn=D.firstElementChild;return pn&&(pn.style.transform="translate("+(dn-yt)+"px,"+(cs-sa)+"px) translate(-50%,-50%)"),Ea}function j(){if(c=P(m,a,c),d=P(f,o,d),a.id===null&&o.id===null){h=0;return}h=requestAnimationFrame(j)}function z(){!h&&!l&&(h=requestAnimationFrame(j))}const Y=D=>{if(l)return;let U=!1;for(let te=0;te<D.changedTouches.length;te++){const Z=D.changedTouches[te];if(!E(Z.target))continue;const $=Z.clientX<window.innerWidth*md,oe=$?a:o;if(oe.id!==null){T.includes(Z.identifier)||T.push(Z.identifier),U=!0;continue}oe.id=Z.identifier,oe.baseX=Z.clientX,oe.baseY=Z.clientY,oe.curX=Z.clientX,oe.curY=Z.clientY,U=!0,$?g.classList.add("is-used"):w.classList.add("is-used")}U&&(r||(r=!0,document.documentElement.classList.add("fa-touch")),L(),H(),z(),D.preventDefault())},A=D=>{if(l)return;let U=!1;for(let te=0;te<D.changedTouches.length;te++){const Z=D.changedTouches[te];Z.identifier===a.id?(a.curX=Z.clientX,a.curY=Z.clientY,U=!0):Z.identifier===o.id?(o.curX=Z.clientX,o.curY=Z.clientY,U=!0):T.includes(Z.identifier)&&(U=!0)}U&&(L(),H(),z(),D.preventDefault())},C=D=>{if(l)return;let U=!1;for(let te=0;te<D.changedTouches.length;te++){const Z=D.changedTouches[te];Z.identifier===a.id?(a.id=null,F(a,!0,D.touches),U=!0):Z.identifier===o.id?(o.id=null,F(o,!1,D.touches),U=!0):T.includes(Z.identifier)&&(N(Z.identifier),U=!0)}U&&(L(),H(),z())};return window.addEventListener("touchstart",Y,{passive:!1}),window.addEventListener("touchmove",A,{passive:!1}),window.addEventListener("touchend",C),window.addEventListener("touchcancel",C),{available:!0,get engaged(){return r},move:n,get moving(){return a.id!==null},aimDir:()=>i?s:null,get firing(){return o.id!==null},clearAim(){o.id===null&&(i=!1)},reset(){a.id=null,o.id=null,T.length=0,n.x=0,n.y=0,i=!1,z()},dispose(){l||(l=!0,cancelAnimationFrame(h),window.removeEventListener("touchstart",Y),window.removeEventListener("touchmove",A),window.removeEventListener("touchend",C),window.removeEventListener("touchcancel",C),T.length=0,t.canvas.style.touchAction=v,y&&(y.style.touchAction=k),document.documentElement.classList.remove("fa-touch","fa-touch-capable"),p.remove())}}}function ey(){if(document.getElementById(gd))return;const t=document.createElement("style");t.id=gd,t.textContent=ty,document.head.appendChild(t)}const ty=`
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

/* ── LANDSCAPE: the aim hint steps aside for the cluster this HUD now parks in that
   corner ────────────────────────────────────────────────────────────────────
   ui/hud.ts moves the weapon tray out of the bottom-CENTRE — where it was hiding
   5.75-7.92% of the 199.2 wu the camera guarantees every player can see — into a
   two-column cluster in the bottom-RIGHT, which is this genre's place for the buttons
   the firing thumb has to reach. That corner is where this hint sits.

   The stick FLOATS, so this ring is a suggestion about where a thumb usually rests and
   never a pad. But a suggestion drawn underneath four buttons is a bad suggestion, and
   the two DO collide at 17% — measured, not predicted, at the widest phone:

     cluster left edge  = W - safe-r - 12 - (2 x 58px + 8px gap)  = W - 136 = 708 at 844
     hint ring          = centre 700, 76px wide  ->  662..738     30px INSIDE the cluster
     hint LABEL         = centre 700, 92px       ->  654..746     38px INSIDE, and lower,
                                                                 so it lands on the
                                                                 cluster's second row

   ⚠️ THE FIRST FIX WAS A PERCENTAGE AND THE PERCENTAGE WAS THE WRONG UNIT. Moving this
   to 26% cleared the cluster at every width, but a percentage measures from the wrong
   end: the cluster's left edge is a CONSTANT distance from the right of the screen, so
   a percentage over-corrects on a wide phone and barely corrects on a narrow one. It
   pushed the hint 69px past what was needed at 844 and 23px at 667 — inboard, toward
   the middle of the frame, which is the expensive ground. Measured on
   tools/tmp/lu_occlude.mjs, the hints' own share of the guaranteed view went UP:

       844x390   1.51%  ->  5.46%
       667x375   7.64%  ->  8.90%
       932x430   0.99%  ->  4.42%

   i.e. a third of the tray's saving was handed straight back. A CONSTANT px offset
   gives a constant 12px of clearance at every width and keeps the hint as far outboard
   as the cluster allows, which is the cheapest place it can be:

     194 = 12 (safe gutter) + 124 (cluster) + 12 (clearance) + 46 (half the label)

   ⚠️ 124 IS A CONSTANT ONLY BECAUSE ui/hud.ts WAS MADE TO MAKE IT ONE. Its 720px
   breakpoint used to take a slot to 46px, so the cluster was 124px wide above it and
   100px below, and one offset here could not be right at both: at 174 it cleared 667
   and collided by 8px at 844, 932 and 740. lu_land.mjs found that — it is the defect
   arm C exists for. The tray now pins 58px in this layout at every width, which also
   hands the phone the BIGGER touch target rather than the smaller one.

   The bottom offset drops from 22% to 14% for the same reason: the bottom edge of a 58
   degree frame is the cheapest ground on screen, and a resting thumb is low anyway.

   ⚠️ THIS MOVES THE HINT AND NOTHING ELSE. Where a stick may be PLANTED is unchanged —
   ZONE_SPLIT is untouched, and W - 194 is still far inside the aim half at every
   landscape phone width — and a finger landing on a weapon slot belongs to the slot by
   this module's own coexistence rule (ownsTarget refuses a control), which is the
   property that lets a button sit inside the aim half at all.

   ⚠️ Scoped to fa-touch-capable + landscape to match the tray rule EXACTLY. If one of
   the two ever moves without the other, the hint lands back under the buttons — so if
   you change 194, change .hud-weapons in ui/hud.ts in the same commit.
   tools/tmp/lu_land.mjs asserts the two do not overlap, so it will say so. */
@media (orientation: landscape) {
  html.fa-touch-capable .tch-hint--aim {
    right: calc(var(--fa-safe-r, 0px) + 194px);
    bottom: calc(var(--fa-safe-b, 0px) + 14%);
  }

  /* ── ...AND 194 BECOMES 260 THE MOMENT THE PLAYER BRINGS AN ITEM ──────────────
     ui/hud.ts now draws item buttons — the control that makes rules.ts:ITEMS pressable
     at all — as a COLUMN immediately left of the weapon cluster, in this same corner.
     The arithmetic above just gains one term, and every term is still measured from the
     RIGHT EDGE, which is the unit the paragraph above spent a whole pass learning:

       194 = 12 (safe gutter) + 124 (weapon cluster)                    + 12 + 46
       260 = 12 (safe gutter) + 124 (weapon cluster) + 8 + 58 (items)   + 12 + 46
                                                       ^^^^^^^^^^^^^^
     58 is the item button's width and 8 the gap BETWEEN THE TWO CLUSTERS (it is spelled
     in ui/hud.ts as right: safe-r + 144px, i.e. 12 + 124 + 8 — not the 16px gap between
     the two stacked buttons, which is a HEIGHT and does not enter this sum). Both are
     fixed in that file's landscape rule for exactly the reason the weapon slot is fixed
     at 58 there: a cluster whose width changes at a breakpoint cannot be cleared by one
     constant in a different file.

     ⚠️ **GATED ON html.fa-items, WHICH ui/hud.ts SETS ONLY WHEN THE LOCAL SEAT ACTUALLY
     BROUGHT SOMETHING, AND THAT GATE IS THE WHOLE POINT.** Moving the hint costs
     guaranteed view — the paragraph above measured a percentage-based move at
     1.51% -> 5.46% of the disc at 844x390 and called it a third of the tray's saving
     handed back — so a player with an empty loadout must not pay it. With no items the
     cluster is display:none, this rule does not match, and the hint is where it was to
     the pixel. That is also what keeps every existing probe byte-identical: nothing in
     tools/ sets a loadout, so lu_land, menu_accept and hud_accept see the tree they
     always saw.

     ⚠️ A CLASS ON <html> RATHER THAN A DESCENDANT SELECTOR, BECAUSE THE TWO ELEMENTS ARE
     IN DIFFERENT TREES: .tch-hint--aim is inside .tch-root (this module's own layer, z 25)
     and .hud-items is inside .hud-root (z 20). There is no ancestor they share below
     <html>, and fa-touch / fa-touch-capable already establish that this is where a
     cross-layer layout fact lives. ui/hud.ts owns writing it and removes it on dispose. */
  html.fa-touch-capable.fa-items .tch-hint--aim {
    right: calc(var(--fa-safe-r, 0px) + 260px);
  }
}
`,aa={left:["KeyA","ArrowLeft"],right:["KeyD","ArrowRight"],up:["KeyW","ArrowUp"],down:["KeyS","ArrowDown"]},Ah="KeyM",Rh=9,Iu=["KeyQ","KeyE"],ay=.155,oy=84,ny=190;function sy(t){const e=new URLSearchParams(location.search).get(t);if(e===null)return null;const a=Number(e);return Number.isFinite(a)?a:null}class iy{constructor(e){this.canvas=e;const a=sy("aimSens");this.sensitivity=a!==null&&a>0?Math.min(6,a):1,this.freeAim=new URLSearchParams(location.search).get("aimMode")==="free",this.touch=Qb({canvas:e}),window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onVisibilityChange),e.addEventListener("mousemove",this.onMouseMove),e.addEventListener("mousedown",this.onMouseDown),window.addEventListener("mouseup",this.onMouseUp),e.addEventListener("contextmenu",this.onContextMenu)}keys=new Set;mouseDown=!1;ndcX=0;ndcY=0;hasMouse=!1;weaponIndex=0;weaponCount=1;itemPress=null;locked=!1;offX=0;offY=0;clientX=0;clientY=0;sensitivity;freeAim;touch;touchOffset={x:0,y:0};setWeaponCount(e){this.weaponCount=Math.max(1,e),this.weaponIndex>=this.weaponCount&&(this.weaponIndex=0)}get selectedWeapon(){return this.weaponIndex}selectWeapon(e){!Number.isInteger(e)||e<0||e>=this.weaponCount||(this.weaponIndex=e)}get touchEngaged(){return this.touch.engaged}pressItem(e){!Number.isInteger(e)||e<0||e>=Tt||(this.itemPress=e)}takeItemPress(){const e=this.itemPress;return this.itemPress=null,e}get attackHeld(){return this.mouseDown||this.touch.firing}get mouseNdc(){return this.hasMouse&&!this.locked?{x:this.ndcX,y:this.ndcY}:null}get pointerLocked(){return this.locked}get aimOffsetPx(){const e=this.touch.aimDir();if(e){const a=this.aimRadiusPx();return this.touchOffset.x=e.x*a,this.touchOffset.y=e.y*a,this.touchOffset}return this.locked?{x:this.offX,y:this.offY}:null}setPointerLocked(e){e!==this.locked&&(this.locked=e,e&&(this.hasMouse?(this.offX=this.clientX-window.innerWidth/2,this.offY=this.clientY-window.innerHeight/2):(this.offX=0,this.offY=-this.aimRadiusPx()),this.clampOffset(),this.hasMouse=!0))}moveAxes(){let e=0,a=0;return this.keyDown(aa.left)&&(e-=1),this.keyDown(aa.right)&&(e+=1),this.keyDown(aa.up)&&(a-=1),this.keyDown(aa.down)&&(a+=1),this.touch.moving&&(e=Math.max(-1,Math.min(1,e+this.touch.move.x)),a=Math.max(-1,Math.min(1,a+this.touch.move.y))),{x:e,y:a}}reset(){this.keys.clear(),this.mouseDown=!1,this.itemPress=null,this.touch.reset(),this.locked&&(this.offX=0,this.offY=-this.aimRadiusPx())}dispose(){this.touch.dispose(),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onVisibilityChange),this.canvas.removeEventListener("mousemove",this.onMouseMove),this.canvas.removeEventListener("mousedown",this.onMouseDown),window.removeEventListener("mouseup",this.onMouseUp),this.canvas.removeEventListener("contextmenu",this.onContextMenu)}aimRadiusPx(){const e=Math.min(window.innerWidth,window.innerHeight);return Math.max(oy,Math.min(ny,e*ay))}clampOffset(){if(this.freeAim){const n=window.innerWidth/2,s=window.innerHeight/2;this.offX=Math.max(-n,Math.min(n,this.offX)),this.offY=Math.max(-s,Math.min(s,this.offY));return}const e=this.aimRadiusPx(),a=Math.hypot(this.offX,this.offY);if(a<=e){a<.001&&(this.offY=-e);return}const o=e/a;this.offX*=o,this.offY*=o}keyDown(e){return e.some(a=>this.keys.has(a))}onKeyDown=e=>{this.keys.add(e.code);const a=Number(e.key);if(Number.isInteger(a)&&a>=1&&a<=Rh){const n=a-1;n<this.weaponCount&&(this.weaponIndex=n)}const o=e.repeat||e.ctrlKey||e.metaKey||e.altKey?-1:Iu.indexOf(e.code);o>=0&&this.pressItem(o),e.code===Ah&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&Se.toggleMuted()};onKeyUp=e=>{this.keys.delete(e.code)};onMouseMove=e=>{if(this.touch.clearAim(),this.locked){this.offX+=(e.movementX??0)*this.sensitivity,this.offY+=(e.movementY??0)*this.sensitivity,this.clampOffset(),this.hasMouse=!0;return}const a=this.canvas.getBoundingClientRect();this.clientX=e.clientX,this.clientY=e.clientY,this.ndcX=(e.clientX-a.left)/a.width*2-1,this.ndcY=-((e.clientY-a.top)/a.height*2-1),this.hasMouse=!0};onMouseDown=e=>{e.button===0&&(this.mouseDown=!0)};onMouseUp=e=>{e.button===0&&(this.mouseDown=!1)};onBlur=()=>{this.keys.clear(),this.mouseDown=!1,this.itemPress=null,this.touch.reset()};onVisibilityChange=()=>{document.visibilityState==="hidden"&&this.onBlur()};onContextMenu=e=>{e.preventDefault()}}const bd=16241663,ry=14711797,ly=12872686,Uo=2755399,hy=.34,xs=3.2,cy=6.5;function dy(t){return V.clamp(t*.3,ee,cy)}const py=.5,Ke=128,Ih=_m+zm,uy=[{offset:-14,color:bd,alpha:0},{offset:-1,color:bd,alpha:.9},{offset:7,color:ry,alpha:.85},{offset:34,color:5906060,alpha:.3},{offset:150,color:Uo,alpha:.18},{offset:0,absolute:Ih,color:Uo,alpha:.18}],fy=[{offset:12,color:Uo,alpha:0},{offset:44,color:Uo,alpha:.6},{offset:140,color:Uo,alpha:.72},{offset:0,absolute:Ih,color:Uo,alpha:.72}];function my(){const a=document.createElement("canvas");a.width=64,a.height=256;const o=a.getContext("2d"),n=o.createImageData(64,256);let s=2654435769;const i=()=>(s=s*1664525+1013904223>>>0,s/4294967295),r=new Float32Array(64);for(let h=0;h<64;h++)r[h]=.18+.82*i();for(let h=0;h<256;h++){const c=1-h/255,d=Math.pow(1-c,2.6);for(let p=0;p<64;p++){const u=.85+.15*Math.sin(p*.9+c*5),m=Math.max(0,Math.min(1,d*r[p]*u)),f=(h*64+p)*4,g=Math.pow(1-c,3);n.data[f]=255,n.data[f+1]=Math.round(190+65*g),n.data[f+2]=255,n.data[f+3]=Math.round(m*255)}}o.putImageData(n,0,0);const l=new st(a);return l.wrapS=kl,l.wrapT=El,l.needsUpdate=!0,l}function yd(t,e,a,o){const n=t.length*Ke,s=new Float32Array(n*3),i=new Float32Array(n*4),r=[],l=new Float32Array(Ke),h=new Float32Array(Ke);for(let f=0;f<Ke;f++){const g=f/Ke*Math.PI*2;l[f]=Math.cos(g),h[f]=Math.sin(g)}const c=new na;for(let f=0;f<t.length;f++){c.setHex(t[f].color);for(let g=0;g<Ke;g++){const w=f*Ke+g;s[w*3+1]=0,i[w*4]=c.r,i[w*4+1]=c.g,i[w*4+2]=c.b,i[w*4+3]=t[f].alpha}}for(let f=0;f<t.length-1;f++)for(let g=0;g<Ke;g++){const w=(g+1)%Ke;r.push(f*Ke+g,(f+1)*Ke+g,f*Ke+w),r.push(f*Ke+w,(f+1)*Ke+g,(f+1)*Ke+w)}const d=new Zn,p=new Pn(s,3);p.setUsage(Dm),d.setAttribute("position",p),d.setAttribute("color",new Pn(i,4)),d.setIndex(r),d.boundingSphere=new Hm(new fe,et(Ih)*1.2);const u=new K({vertexColors:!0,transparent:!0,depthWrite:!1,side:be,toneMapped:!1}),m=new S(d,u);return m.name=`${o}__no_outline`,m.userData.noOutline=!0,m.renderOrder=a,m.frustumCulled=!1,m.castShadow=!1,m.receiveShadow=!1,m.position.y=e,{mesh:m,setRadius(f){for(let g=0;g<t.length;g++){const w=t[g],b=w.absolute!==void 0?Math.max(w.absolute,f+200):Math.max(0,f+w.offset),y=et(b),v=g*Ke;for(let k=0;k<Ke;k++){const E=(v+k)*3;s[E]=l[k]*y,s[E+2]=h[k]*y}}p.needsUpdate=!0},setOpacity(f){u.opacity=f},dispose(){d.dispose(),u.dispose()}}}function gy(t){const e=new le;e.name="fog_boundary";const a=Ne(t.x,t.y);e.position.set(a.x,0,a.z),e.frustumCulled=!1;const o=yd(uy,hy,6,"fog_edge"),n=yd(fy,xs,8,"fog_canopy");e.add(o.mesh);const s=my(),i=new Ae(1,1,1,Ke,1,!0),r=new K({map:s,color:ly,transparent:!0,opacity:.82,depthWrite:!1,side:be,toneMapped:!1}),l=new S(i,r);l.name="fog_curtain__no_outline",l.userData.noOutline=!0,l.renderOrder=7,l.frustumCulled=!1,l.castShadow=!1,l.receiveShadow=!1,e.add(l),e.add(n.mesh);let h=0,c=0;return{root:e,update(d,p,u,m){const f=Math.min(.25,Math.max(0,p-c));if(c=p,h=u&&d>=0?1:Math.max(0,h-f/py),e.visible=h>.002,!e.visible)return;const w=Math.max(0,d);o.setRadius(w),n.setRadius(w),o.setOpacity(h),n.setOpacity(h);const b=m.camera.position.y,y=V.clamp(b>xs?(b-xs)/b:0,.05,1);n.mesh.scale.set(y,1,y),n.mesh.position.set((1-y)*(m.camera.position.x-e.position.x),xs,(1-y)*(m.camera.position.z-e.position.z));const v=et(w),k=dy(v);l.scale.set(v,k,v),l.position.y=k/2;const E=2*Math.PI*v;s.repeat.x=Math.max(6,Math.round(E/5)),s.offset.x=p*.035%1,r.opacity=(.82+.1*Math.sin(p*2.1))*h},dispose(){o.dispose(),n.dispose(),i.dispose(),r.dispose(),s.dispose(),e.clear()}}}function Qn(t,e,a,o,n,s,i,r){return Math.abs(t-n)<(a+i)/2&&Math.abs(e-s)<(o+r)/2}function fi(t,e,a,o){for(let n=0;n<o.length;n++){const s=o[n];if(Math.abs(t-s.x)<(a+s.w)/2&&Math.abs(e-s.y)<(a+s.h)/2)return!0}return!1}const Ou=[];function Cu(t){return t.concealment??Ou}function wy(t,e){if(!e)return!1;const a=e.brokenConcealment;for(let o=0;o<a.length;o++)if(a[o]===t)return!0;return!1}function by(t,e,a,o){const n=Cu(a);for(let s=0;s<n.length;s++){const i=n[s];if(Qn(t,e,0,0,i.x,i.y,i.w,i.h)&&!wy(i,o))return!0}return!1}function Fu(t,e,a,o,n){return o&&n&&o.elapsed<n.revealedUntil?!1:by(t,e,a,o)}function Oh(t,e,a,o,n,s,i){return Fu(a,o,n,s,i)?Math.hypot(a-t,o-e)<=Pm:!0}function yy(t,e,a,o){const n=Cu(a);let s=null;for(let i=0;i<n.length;i++){const r=n[i];Qn(t,e,0,0,r.x,r.y,r.w,r.h)&&(o.includes(r)||(o.push(r),(s??=[]).push(r)))}return s??Ou}function Nu(t,e,a,o){let n=1;for(const s of a.hazards)s.kind==="slow"&&Math.hypot(t-s.x,e-s.y)<s.radius&&(n=Math.min(n,s.slowFactor??vc));for(const s of o)Math.hypot(t-s.x,e-s.y)<Tl&&(n=Math.min(n,vc));return n}const xy=U0,vy=1e-6;function mi(t,e,a,o,n){if(!(o>0))return;const s=Math.hypot(e,a);if(s<vy)return;const i=t.push,r=Math.max(n?.cap??xy,i.remaining);i.x=e/s,i.y=a/s,i.remaining=Math.min(r,i.remaining+o),i.speed=n?.speed??0}function ky(t,e,a,o){const n=t.size/2;t.x=Math.min(o.width-n,Math.max(n,e)),t.y=Math.min(o.height-n,Math.max(n,a)),Lu(t,o);const s=t.push;s.remaining=0,s.x=0,s.y=0,s.speed=0}function My(t,e,a,o){const n=t.push;if(n.remaining<=0)return!1;const i=(n.speed>0?n.speed:B0)*e,r=n.remaining<i?n.remaining:i;n.remaining-=r;const l=Hi(t,o)?!1:gi(t,n.x*r,n.y*r,a);return n.remaining<=0&&(n.remaining=0,n.x=0,n.y=0,n.speed=0),l}const Ey=4,xd=.01;function Lu(t,e){const a=t.size,o=a/2,n=e.cover;for(let s=0;s<Ey;s++){let i=null,r=0;for(let c=0;c<n.length;c++){const d=n[c],p=(a+d.w)/2-Math.abs(t.x-d.x);if(p<=0)continue;const u=(a+d.h)/2-Math.abs(t.y-d.y);if(u<=0)continue;const m=p<u?p:u;m>r&&(r=m,i=d)}if(i===null)return;const l=(a+i.w)/2-Math.abs(t.x-i.x),h=(a+i.h)/2-Math.abs(t.y-i.y);if(l<=h){const c=t.x>=i.x?1:-1;t.x=Math.min(e.width-o,Math.max(o,t.x+c*(l+xd)))}else{const c=t.y>=i.y?1:-1;t.y=Math.min(e.height-o,Math.max(o,t.y+c*(h+xd)))}}}function gi(t,e,a,o){const n=t.size/2,s=t.x,i=t.y;if((e!==0||a!==0)&&Lu(t,o),e!==0){const r=Math.min(o.width-n,Math.max(n,t.x+e));fi(r,t.y,t.size,o.cover)||(t.x=r)}if(a!==0){const r=Math.min(o.height-n,Math.max(n,t.y+a));fi(t.x,r,t.size,o.cover)||(t.y=r)}return t.x!==s||t.y!==i}const Ty=10,Sy=4e4,Du=16,Ay=8,Ry=4,vd=new WeakMap;function Iy(t,e){const a=vd.get(t);if(a&&a.size===e&&a.cover===t.cover)return a;let o=Ty;for(;Math.ceil(t.width/o)*Math.ceil(t.height/o)>Sy;)o*=2;const n=Math.max(1,Math.ceil(t.width/o)),s=Math.max(1,Math.ceil(t.height/o)),i=n*s,r=new Uint8Array(i),l=e/2;for(let c=0;c<s;c++)for(let d=0;d<n;d++){const p=(d+.5)*o,u=(c+.5)*o;p>=l&&p<=t.width-l&&u>=l&&u<=t.height-l&&!fi(p,u,e,t.cover)&&(r[c*n+d]=1)}const h={cell:o,cols:n,rows:s,size:e,cover:t.cover,passable:r,dist:new Int32Array(i),queue:new Int32Array(i),chain:new Int32Array(Du+1),goalCell:-1,requestedGoal:-1};return vd.set(t,h),h}function Rr(t,e){const{cols:a,rows:o,passable:n,dist:s,queue:i}=t;s.fill(-1),t.goalCell=e,s[e]=0,i[0]=e;let r=0,l=1;for(;r<l;){const h=i[r++],c=h%a,d=(h-c)/a,p=s[h]+1;for(let u=-1;u<=1;u++){const m=d+u;if(m<0||m>=o)continue;const f=m*a;for(let g=-1;g<=1;g++){if(g===0&&u===0)continue;const w=c+g;if(w<0||w>=a)continue;const b=f+w;n[b]===0||s[b]>=0||g!==0&&u!==0&&(n[d*a+w]===0||n[f+c]===0)||(s[b]=p,i[l++]=b)}}}}function kd(t,e,a,o,n){const{cols:s,rows:i,passable:r,dist:l}=t;if(e>=0&&e<s&&a>=0&&a<i){const h=a*s+e;if(r[h]===1)return h}for(let h=1;h<=o;h++)for(let c=-h;c<=h;c++){const d=a+c;if(d<0||d>=i)continue;const p=Math.abs(c)===h;for(let u=-h;u<=h;u+=p?1:2*h){const m=e+u;if(m<0||m>=s)continue;const f=d*s+m;if(r[f]===1)return f}}return-1}function Md(t,e,a,o,n,s){const i=a-t,r=o-e,l=Math.max(1,Math.ceil(Math.hypot(i,r)/(n*.4)));for(let h=1;h<=l;h++){const c=h/l;if(fi(t+i*c,e+r*c,n,s))return!1}return!0}const Fa={dirX:0,dirY:0,wpX:0,wpY:0};function Oy(t,e,a,o){const n=Iy(t,e.size),{cell:s,cols:i,rows:r,dist:l,chain:h}=n,c=e.size/2,d=Math.min(t.width-c,Math.max(c,a)),p=Math.min(t.height-c,Math.max(c,o)),u=kd(n,Math.min(i-1,Math.max(0,Math.floor(d/s))),Math.min(r-1,Math.max(0,Math.floor(p/s))),Ay);if(u<0)return!1;const m=kd(n,Math.min(i-1,Math.max(0,Math.floor(e.x/s))),Math.min(r-1,Math.max(0,Math.floor(e.y/s))),Ry);if(m<0)return!1;if(n.requestedGoal!==u||l[m]<0){if(Rr(n,u),l[m]<0){Rr(n,m);let E=m,x=1/0;for(let M=0;M<l.length;M++){if(l[M]<0)continue;const R=M%i,T=(R+.5)*s-d,N=((M-R)/i+.5)*s-p,I=T*T+N*N;I<x&&(x=I,E=M)}Rr(n,E)}n.requestedGoal=u}if(l[m]<0)return!1;let f=m,g=0;for(;g<Du&&l[f]>0;){const E=f%i,x=(f-E)/i,M=l[f];let R=-1,T=M,N=1/0;for(let I=-1;I<=1;I++){const F=x+I;if(F<0||F>=r)continue;const L=F*i;for(let H=-1;H<=1;H++){if(H===0&&I===0)continue;const P=E+H;if(P<0||P>=i)continue;const j=L+P,z=l[j];if(z<0||z>=M||H!==0&&I!==0&&(n.passable[x*i+P]===0||n.passable[L+E]===0))continue;const Y=(P+.5)*s-d,A=(F+.5)*s-p,C=Y*Y+A*A;(z<T||z===T&&C<N)&&(T=z,N=C,R=j)}}if(R<0)break;h[g++]=R,f=R}let w,b;if(g===0)w=d,b=p;else{let E=0;for(let T=1;T<g;T++){const N=h[T],I=N%i,F=(N-I)/i;if(!Md(e.x,e.y,(I+.5)*s,(F+.5)*s,e.size,t.cover))break;E=T}const x=h[E],M=x%i,R=(x-M)/i;w=(M+.5)*s,b=(R+.5)*s,E===g-1&&l[x]===0&&Md(e.x,e.y,d,p,e.size,t.cover)&&(w=d,b=p)}const y=w-e.x,v=b-e.y,k=Math.hypot(y,v);return k<1e-6?!1:(Fa.dirX=y/k,Fa.dirY=v/k,Fa.wpX=w,Fa.wpY=b,!0)}function Ed(t,e,a,o,n,s,i){const r=t.x,l=t.y;let h=e,c=a,d=s,p=i;Oy(n,t,s,i)&&(h=Fa.dirX,c=Fa.dirY,d=Fa.wpX,p=Fa.wpY);const u=(E,x)=>Math.hypot(E-d,x-p),m=u(r,l);gi(t,h*o,c*o,n);const f=t.x,g=t.y;if(m-u(f,g)>=o*.35)return t.detourSign=0,!0;const w=E=>{t.x=r,t.y=l;const x=-c*E+h*.3,M=h*E+c*.3,R=Math.hypot(x,M)||1;return gi(t,x/R*o,M/R*o,n),Math.hypot(t.x-r,t.y-l)};if(t.detourSign!==0&&w(t.detourSign)>=o*.35)return!0;const b=w(1),y=t.x,v=t.y,k=w(-1);if(b>=k){if(b>=o*.35)return t.detourSign=1,t.x=y,t.y=v,!0}else if(k>=o*.35)return t.detourSign=-1,!0;return t.detourSign=0,t.x=f,t.y=g,f!==r||g!==l}const Cy=180/Math.PI,Fy=Math.PI/180,Ny=1e-6;function Ch(t,e){return ce[e.characterId].hasTrail?t.trailMarks.some(a=>a.ownerId===e.id&&Math.hypot(e.x-a.x,e.y-a.y)<zt.radius):!1}function wi(t,e){return e==="stun"?t.status.stunnedUntil+$m:t.status.slowedUntil+Bm}function zl(t,e,a){const o=t.status,n=e==="stun"?o.stunAppliedAt:o.slowAppliedAt,s=e==="stun"?o.stunStacks:o.slowStacks,i=a-n>=Wm;return Math.min(i?0:s+1,q0.length-1)}function Td(t,e,a,o){return o*q0[zl(t,e,a)]}function Pl(t,e,a){const o=t.cast;o!==null&&(t.cast=null,a.push({type:"cast-cancelled",fighterRole:t.role,fighterId:t.id,weaponKey:ce[t.characterId].weapons[o.weaponIndex].key,reason:e}))}function Hu(t,e,a){const o=t.itemCast;o!==null&&(t.itemCast=null,a.push({type:"item-cancelled",fighterRole:t.role,fighterId:t.id,itemId:o.itemId,slot:o.slot,reason:e}))}function Ly(t,e,a,o){const n=o.knockback??0;n>0&&mi(a,a.x-e.x,a.y-e.y,n);const s=o.lure??0;if(s>0){const i=a.x,r=a.y;for(const l of t.fighters){if(!_i(l,e))continue;const h=i-l.x,c=r-l.y,d=Math.hypot(h,c);mi(l,h,c,s<d?s:d)}}}function Dy(t,e){return{kind:"weapon",weaponKey:e,weaponName:Ce[e].name,attackerId:t.id,itemId:e}}function Hy(t,e,a){const o=t.item;if(o.streakTarget!==e.id||a-o.streakAt>=Me.tenderiser.decayMs)return 1;const n=o.streakCount<Me.tenderiser.maxStacks?o.streakCount:Me.tenderiser.maxStacks;return Me.tenderiser.stackMul**n}function _y(t,e,a){const o=t.item,n=o.streakTarget===e.id&&a-o.streakAt<Me.tenderiser.decayMs;return o.streakCount=n?Math.min(o.streakCount+1,Me.tenderiser.maxStacks):1,o.streakTarget=e.id,o.streakAt=a,o.streakCount}function _a(t,e,a,o,n,s){if(!e.alive)return;const i=n.kind==="weapon"&&n.itemId!==void 0,r=n.kind==="weapon"?t.fighters[n.attackerId]:n.kind==="trail"?t.fighters[n.ownerId]:null,l=r!=null&&!i&&n.kind==="weapon"&&r!==e&&Hg(r,"tenderiser"),h=l?Hy(r,e,t.elapsed):1;let c=r&&!i?a*r.damageMul:a;h!==1&&(c*=h);const d=l?_y(r,e,t.elapsed):0;if(e.hp=Math.max(0,e.hp-c),e.lastDamagedAt=t.elapsed,o==="slow"){if(t.elapsed>=wi(e,"slow")){const p=Td(e,"slow",t.elapsed,qm);p>0&&(e.status.slowStacks=zl(e,"slow",t.elapsed),e.status.slowAppliedAt=t.elapsed,e.status.slowedUntil=t.elapsed+p)}}else if(o==="stun"){const p=t.elapsed>=wi(e,"stun")?Td(e,"stun",t.elapsed,jm):0;p>0&&(e.status.stunStacks=zl(e,"stun",t.elapsed),e.status.stunAppliedAt=t.elapsed,e.status.stunnedUntil=t.elapsed+p,e.cast!==null&&Pl(e,"stun",s))}if(r!=null&&n.kind==="weapon"&&!i){const p=ce[r.characterId].weapons.find(u=>u.key===n.weaponKey);p!==void 0&&Ly(t,r,e,p)}if(s.push({type:"hit-landed",targetRole:e.role,targetId:e.id,amount:c,effect:o,source:n,x:e.x,y:e.y}),d>0&&r!=null&&s.push({type:"item-hit",itemId:"tenderiser",ownerRole:r.role,ownerId:r.id,targetRole:e.role,targetId:e.id,durationMs:Me.tenderiser.decayMs,stacks:d,fromX:e.x,fromY:e.y,x:e.x,y:e.y}),e.hp===0&&(e.alive=!1,s.push({type:"death",fighterRole:e.role,fighterId:e.id}),e.deaths++,e.item.killerId=r!=null&&r!==e?r.id:li,e.cast!==null&&Pl(e,"death",s),e.itemCast!==null&&Hu(e,"death",s),Py(t,e,s),zy(t,e,s),t.phase==="playing")){const p=_g(t);p!==null&&(t.phase="ended",t.winner=p.role,t.winnerId=p.id,s.push({type:"match-ended",winner:p.role,winnerId:p.id}))}!i&&n.kind==="weapon"&&r!=null&&r!==e&&c>0&&t.elapsed<e.item.shieldUntil&&_a(t,r,c*Me.shiitake.reflect,null,Dy(e,"shiitake"),s)}function zy(t,e,a){if(!(uh(t)<Me.leftovers.minAliveAfterKillerDies))for(const n of t.fighters)n.item.revivesLeft<=0||n.item.killerId===e.id&&(n.alive||n.hp>0||(n.item.revivesLeft--,n.item.killerId=li,n.alive=!0,n.hp=Math.min(n.maxHp,Me.leftovers.hp),n.status.slowedUntil=-1/0,n.status.stunnedUntil=-1/0,n.item.sleepUntil=-1/0,n.item.clogUntil=-1/0,n.item.rootUntil=-1/0,n.item.blotUntil=-1/0,n.item.shieldUntil=-1/0,n.push.x=0,n.push.y=0,n.push.remaining=0,n.push.speed=0,n.fogTimer=0,n.regenTimer=0,n.hazardTimers.length=0,n.lastDamagedAt=t.elapsed,a.push({type:"item-revived",fighterRole:n.role,fighterId:n.id,killerRole:e.role,killerId:e.id,hp:n.hp,x:n.x,y:n.y})))}function Py(t,e,a){const o=Math.atan2(e.facing.y,e.facing.x),n=ht.pickupRadius;for(let s=0;s<ht.count;s++){const i=o+s*2*Math.PI/ht.count;let r=Math.min(t.arena.width-n,Math.max(n,e.x+Math.cos(i)*ht.popDistance)),l=Math.min(t.arena.height-n,Math.max(n,e.y+Math.sin(i)*ht.popDistance));for(const c of t.arena.cover)if(Qn(r,l,n,n,c.x,c.y,c.w,c.h)){r=e.x,l=e.y;break}const h={id:t.nextId++,sourceId:e.id,x:r,y:l,fromX:e.x,fromY:e.y,armsAt:t.elapsed+ht.popMs,expiresAt:t.elapsed+ht.popMs+ht.durationMs};t.medikits.push(h),a.push({type:"medikit-dropped",id:h.id,sourceRole:e.role,sourceId:e.id,fromX:h.fromX,fromY:h.fromY,x:h.x,y:h.y,popMs:ht.popMs})}}function Ir(t,e,a,o,n,s,i,r,l,h,c){const d=Math.atan2(h.y,h.x)+n*Fy,p=Math.cos(d),u=Math.sin(d),m=o.speed??0,f=i??o.color,g=r??o.emoji,w=t.nextId++;t.projectiles.push({id:w,ownerId:e.id,targetId:a.id,ownerRole:e.role,targetRole:a.role,weapon:o,x:l.x,y:l.y,vx:p*m,vy:u*m,traveled:0,tx:a.x,ty:a.y,age:0,damage:s,color:f,emoji:g}),c.push({type:"projectile-spawned",id:w,ownerRole:e.role,ownerId:e.id,weaponKey:o.key,x:l.x,y:l.y,color:f,emoji:g})}function _u(t,e,a,o){if(a.type!=="self"){e.revealedUntil=t.elapsed+Um;for(const n of yy(e.x,e.y,t.arena,t.brokenConcealment))o.push({type:"concealment-broken",ownerRole:e.role,ownerId:e.id,x:n.x,y:n.y,w:n.w,h:n.h,kind:n.kind})}}function zu(t,e,a,o){const s=ce[e.characterId].weapons[a];if(!s)return!1;o.push({type:"weapon-fired",fighterRole:e.role,fighterId:e.id,weaponKey:s.key}),_u(t,e,s,o);const i=By(t,e,s,o),r=s.selfLaunch??0;return r>0&&mi(e,e.facing.x,e.facing.y,r),i}function $y(t,e,a){if(t.phase!=="playing")return!1;const o=e.cast;return o===null||t.elapsed<o.resolvesAt?!1:(e.cast=null,zu(t,e,o.weaponIndex,a))}function $l(t,e,a,o){if(t.phase!=="playing")return!1;const n=ce[e.characterId].weapons[a];if(!n)return!1;const s=t.elapsed,i=n.castMs??0;return V0(e,s)||e.cast!==null&&i>0||s-e.lastUsed[a]<n.cooldown?!1:(e.lastUsed[a]=s,i>0?(e.cast={weaponIndex:a,startedAt:s,resolvesAt:s+i},o.push({type:"cast-started",fighterRole:e.role,fighterId:e.id,weaponKey:n.key,castMs:i}),_u(t,e,n,o),!0):zu(t,e,a,o))}function By(t,e,a,o){const n=Jn(t,e);if(a.type==="self"){const h=(a.healAmount??0)*rh(e.level),c=Math.min(h,e.maxHp-e.hp);return e.hp=Math.min(e.maxHp,e.hp+h),c>0&&o.push({type:"heal",fighterRole:e.role,fighterId:e.id,amount:c}),!0}if(n===null)return!0;if(a.type==="melee"){const h=a.cone??360,c=a.range??0;for(const d of t.fighters){if(!_i(d,e))continue;const p=d.x-e.x,u=d.y-e.y,m=Math.hypot(p,u);if(!(m>c)){if(h<360){if(m<Ny)continue;const f=(e.facing.x*p+e.facing.y*u)/m;if(Math.acos(Math.max(-1,Math.min(1,f)))*Cy>h/2)continue}_a(t,d,a.damage,a.effect,{kind:"weapon",weaponKey:a.key,weaponName:a.name,attackerId:e.id},o)}}return!0}const s={x:e.x,y:e.y},i=e.facing;if(a.comboParts){for(const h of a.comboParts)Ir(t,e,n,a,h.angle,h.damage,h.color,h.emoji,s,i,o);return!0}const l=!!a.trailBoosted&&Ch(t,e)?Math.round(a.damage*zt.damageBoost):a.damage;if(a.pellets&&a.pellets>1){const h=a.spreadDeg??0;for(let c=0;c<a.pellets;c++){const d=(c-(a.pellets-1)/2)*h,p=a.pelletColors?a.pelletColors[c%a.pelletColors.length]:void 0,u=a.pelletEmojis?a.pelletEmojis[c%a.pelletEmojis.length]:void 0;Ir(t,e,n,a,d,l,p,u,s,i,o)}}else Ir(t,e,n,a,0,l,void 0,void 0,s,i,o);return!0}const vs=j0;function Fh(t,e,a){if(t.phase!=="playing")return!1;const o=e.item.equipped[a];if(o===void 0)return!1;const n=Ce[o];if(n.kind!=="active"||zo(e,t.elapsed)||uh(t)<n.minAlive||e.itemCast!==null)return!1;const s=n.cooldownMs??0;return t.elapsed-e.item.lastUsed[a]>=s}function Pu(t,e,a,o){if(!Fh(t,e,a))return!1;const n=e.item.equipped[a],s=t.elapsed;e.item.lastUsed[a]=s;const i=n==="shiitake"?Me.shiitake.windupMs:0;return o.push({type:"item-used",fighterRole:e.role,fighterId:e.id,itemId:n,slot:a,x:e.x,y:e.y,windupMs:i}),i>0?(e.itemCast={slot:a,itemId:n,startedAt:s,resolvesAt:s+i},!0):($u(t,e,a,n,o),!0)}function Uy(t,e,a){if(t.phase!=="playing")return!1;const o=e.itemCast;return o===null||t.elapsed<o.resolvesAt?!1:(e.itemCast=null,a.push({type:"item-resolved",fighterRole:e.role,fighterId:e.id,itemId:o.itemId,slot:o.slot,x:e.x,y:e.y}),$u(t,e,o.slot,o.itemId,a),!0)}function Tn(t,e,a){const o=Jn(t,e);return o===null?null:Math.hypot(o.x-e.x,o.y-e.y)<=a?o:null}function ks(t,e,a,o,n,s,i){return s<=0||t.elapsed<a.item[n]?!1:(a.item[n]=t.elapsed+s,n==="sleepUntil"&&(a.cast!==null&&Pl(a,"sleep",i),a.itemCast!==null&&Hu(a,"sleep",i)),i.push({type:"item-hit",itemId:o,ownerRole:e.role,ownerId:e.id,targetRole:a.role,targetId:a.id,durationMs:s,stacks:0,fromX:a.x,fromY:a.y,x:a.x,y:a.y}),!0)}function $u(t,e,a,o,n){switch(o){case"springform":{mi(e,e.facing.x,e.facing.y,Me.springform.distance,{cap:Me.springform.distance,speed:Me.springform.distance/Me.springform.travelMs});return}case"warm_milk":{const s=Tn(t,e,Me.warm_milk.range);if(s===null)return;const i=Math.hypot(s.x-e.x,s.y-e.y),r=Me.warm_milk.range>0?Math.min(1,Math.max(0,i/Me.warm_milk.range)):0,l=Me.warm_milk.minMs+(Me.warm_milk.maxMs-Me.warm_milk.minMs)*r;ks(t,e,s,o,"sleepUntil",l,n);return}case"pompa":{const s=Tn(t,e,vs);if(s===null)return;ks(t,e,s,o,"clogUntil",Me.pompa.clogMs,n);return}case"squid_ink":{const s=Tn(t,e,vs);if(s===null)return;ks(t,e,s,o,"blotUntil",Me.squid_ink.blotMs,n);return}case"liquorice":{const s=Tn(t,e,vs);if(s===null)return;ks(t,e,s,o,"rootUntil",Me.liquorice.rootMs,n);return}case"shiitake":{e.item.shieldUntil=t.elapsed+Me.shiitake.durationMs,n.push({type:"item-hit",itemId:o,ownerRole:e.role,ownerId:e.id,targetRole:e.role,targetId:e.id,durationMs:Me.shiitake.durationMs,stacks:0,fromX:e.x,fromY:e.y,x:e.x,y:e.y});return}case"disposal":{const s=Tn(t,e,vs);if(s===null)return;const i=Jn(t,s,e);if(i===null)return;const r=s.x,l=s.y;let h=r-i.x,c=l-i.y;const d=Math.hypot(h,c);d<1e-6?(h=i.facing.x,c=i.facing.y):(h/=d,c/=d);const p=Me.disposal.dropDistance;ky(s,i.x+h*p,i.y+c*p,t.arena),n.push({type:"item-hit",itemId:o,ownerRole:e.role,ownerId:e.id,targetRole:s.role,targetId:s.id,durationMs:0,stacks:0,fromX:r,fromY:l,x:s.x,y:s.y});return}case"tenderiser":case"blue_cheese":case"leftovers":return}}const Ms=400,Na=1e-6,Sd=.8,Ad=.6,Zt={x:0,y:0},Ve={dirX:0,dirY:0,navX:0,navY:0},Bu=Math.PI/180,qy=[0];function Uu(t){if(t.comboParts)return t.comboParts.map(n=>n.angle);const e=t.pellets??1;if(e<=1)return qy;const a=t.spreadDeg??0,o=[];for(let n=0;n<e;n++)o.push((n-(e-1)/2)*a);return o}const jy=(()=>{const t=new Map;for(const e of Ee)for(const a of ce[e].weapons)t.set(a,Uu(a));return t})();function Wy(t,e,a,o,n){const s=e.range??0;if(s<=0)return null;const i=a-t.x,r=o-t.y,l=Math.hypot(i,r),h=l>Na?i/l:1,c=l>Na?r/l:0;switch(e.type){case"self":return null;case"melee":return{margin:l-s,outX:h,outY:c};case"ranged":{const p=s+n,u=l-p;if(e.homing)return{margin:u,outX:h,outY:c};const m=Math.hypot(t.facing.x,t.facing.y);if(m<Na)return{margin:u,outX:h,outY:c};const f=t.facing.x/m,g=t.facing.y/m,w=i*f+r*g,b=-i*g+r*f;let y=-1/0,v=-1/0,k=!1,E=!0;for(const R of jy.get(e)??Uu(e)){const T=R*Bu,N=Math.cos(T),I=Math.sin(T);if(w*N+b*I<0)continue;if(N<=Na){E=!1;break}k=!0;const L=b*N-w*I,H=(n-L)/N,P=(n+L)/N;H>y&&(y=H),P>v&&(v=P)}if(!E)return{margin:u,outX:h,outY:c};if(!k)return{margin:l-n,outX:h,outY:c};const x=y<=v,M=x?-y:-v;return u>=M?{margin:u,outX:h,outY:c}:{margin:M,outX:x?-g:g,outY:x?f:-f}}}return e.type}function Gy(t,e,a,o,n){const s=e.x,i=e.y;Zt.x=0,Zt.y=0;let r=0;for(const u of t.arena.hazards){if(u.kind!=="damage")continue;const m=s-u.x,f=i-u.y,g=Math.hypot(m,f),w=u.radius+mn;if(g>=w)continue;const b=g>Na?m/g:1,y=g>Na?f/g:0,v=-y*a+b*o>=0?1:-1,k=-y*v,E=b*v,x=Math.min(2,(w-g)/mn),M=x*ir;Zt.x+=(b*Sd+k*Ad)*M,Zt.y+=(y*Sd+E*Ad)*M,x>r&&(r=x)}const l=t.arena.center.x,h=t.arena.center.y,c=l-s,d=h-i,p=Math.hypot(c,d);if(p>Na){const u=t.safeRadius-p;if(u<rr){const m=Math.min(2,(rr-u)/rr);Zt.x+=c/p*m*Ec,Zt.y+=d/p*m*Ec,m>r&&(r=m)}}for(const u of t.fighters){if(u===e||!u.alive)continue;const m=u.cast;if(m===null)continue;const f=ce[u.characterId].weapons[m.weaponIndex];if(f===void 0)continue;const g=Wy(u,f,s,i,e.hitRadius);if(g===null)continue;const w=g.margin;if(w>=mn)continue;const b=Math.max(0,m.resolvesAt-t.elapsed);if(w<0&&-w>n*b)continue;const y=Math.min(2,(mn-w)/mn);Zt.x+=g.outX*y*ir,Zt.y+=g.outY*y*ir,y>r&&(r=y)}return r}const Rd={melee:!0,ranged:!0,self:!1},Yy={melee:!1,ranged:!1,self:!0},Vy=(()=>{const t=new Map,e=a=>{const o=Math.abs(Math.sin(a*Bu));return o<1e-9?1/0:W0/o};for(const a of Ee)for(const o of ce[a].weapons){let n=0;const s=[];if(o.type!=="self")if(o.comboParts)for(const i of o.comboParts){const r=e(i.angle);r===1/0?n+=i.damage:s.push({maxDist:r,damage:i.damage})}else{const i=o.damage*(o.peckHits??1),r=o.pellets??1;if(o.type==="melee"||r<=1||o.homing)n=i*r;else{const l=o.spreadDeg??0;for(let h=0;h<r;h++){const c=e((h-(r-1)/2)*l);c===1/0?n+=i:s.push({maxDist:c,damage:i})}}}t.set(o,{always:n,offAxis:s})}return t})();function Ky(t,e){const a=Vy.get(t);if(!a)return t.damage;let o=a.always;for(const n of a.offAxis)e<n.maxDist&&(o+=n.damage);return o}const Id=(t,e,a,o,n)=>Ky(a,n),Xy=(t,e,a)=>{const o=a.healAmount??0;return o<=0||e.hp>e.maxHp*Xm||e.maxHp-e.hp<o?-1/0:o};function Or(t,e,a,o,n,s){const i=ce[e.characterId].weapons,r=t.elapsed;if(V0(e,r))return null;let l=null,h=-1/0;for(let c=0;c<i.length;c++){const d=i[c];if(!o[d.type]||r-e.lastUsed[c]<d.cooldown||a>(d.range??1/0)||(d.castMs??0)>0&&(d.castMs??0)>=s)continue;const p=n(t,e,d,c,a);p>h&&(h=p,l=c)}return l}const Es=j0,Zy=(()=>{const t=new Map;for(const e of Ee){let a=0;for(const o of ce[e].weapons)o.type!=="self"&&(a=Math.max(a,o.range??1/0));t.set(e,a)}return t})();function Od(t){return Zy.get(t)??0}function Jy(t,e,a,o,n,s,i,r){const l=t.elapsed;switch(a){case"springform":return!i&&s&&!Hi(e,l)&&e.push.remaining<=0&&n>Od(e.characterId);case"warm_milk":return s&&n<=Me.warm_milk.range&&!zo(o,l);case"pompa":return s&&n<=Es&&!zo(o,l)&&l>=o.item.clogUntil;case"squid_ink":return s&&n<=Es&&!zo(o,l)&&l>=o.item.blotUntil;case"liquorice":return s&&n<=Es&&!zo(o,l)&&l>=o.item.rootUntil;case"disposal":{if(!s||n>Es)return!1;const h=Jn(t,o,e);return h===null?!1:Math.hypot(h.x-e.x,h.y-e.y)-Me.disposal.dropDistance>n}case"shiitake":return!i&&s&&l>=e.item.shieldUntil&&Me.shiitake.windupMs<r&&n<=Od(o.characterId);case"tenderiser":case"blue_cheese":case"leftovers":return!1}}function Qy(t,e,a,o,n,s,i){const r=e.item.equipped;if(r.length===0)return null;for(let l=0;l<r.length;l++)if(Fh(t,e,l)&&Jy(t,e,r[l],a,o,n,s,i))return l;return null}function e2(t,e,a,o){if(t.phase!=="playing")return!1;const n=Jn(t,e);if(e.hp<=0||n===null)return!1;const s=t.elapsed,i=Oh(e.x,e.y,n.x,n.y,t.arena,t,n),r=t.sightings[Ol(e.id,n.id,t.fighters.length)];i&&(r.x=n.x,r.y=n.y,r.at=s);const l=r.x,h=r.y,c=l-e.x,d=h-e.y,p=Math.hypot(c,d),u=p||1,m=p>1e-6,f=e.hp<e.maxHp*Gm,g=(s<e.status.slowedUntil?Ym:1)*Nu(e.x,e.y,t.arena,t.splats)*(Ch(t,e)?zt.speedBoost:1),w=Hi(e,s);m&&!Y0(e)&&(e.facing={x:c/u,y:d/u});let b=!1;const y=f?-1:1,v=Ys(e.characterId,f?kc:Mc)*g,k=(()=>{if(t.medikits.length===0||e.maxHp-e.hp<ht.heal*rh(e.level))return null;let P=null,j=1/0;for(const z of t.medikits){const Y=Math.hypot(z.x-e.x,z.y-e.y);Y>=j||Y>(z.expiresAt-s)*v||(P=z,j=Y)}return P})(),E=k===null?0:Math.hypot(k.x-e.x,k.y-e.y)||1,x=k===null?y*c/u:(k.x-e.x)/E,M=k===null?y*d/u:(k.y-e.y)/E,R=Gy(t,e,x,M,v),T=R>=Km,N=(P,j,z,Y)=>{if(Ve.dirX=P,Ve.dirY=j,Ve.navX=z,Ve.navY=Y,R<=0)return;const A=P+Zt.x,C=j+Zt.y,D=Math.hypot(A,C);D<Na||(Ve.dirX=A/D,Ve.dirY=C/D,Ve.navX=e.x+Ve.dirX*Ms,Ve.navY=e.y+Ve.dirY*Ms)},I=T&&!w,F=T?0:Bn(t.timeRemaining)?e.hp*1e3/Vm:1/0,L=I?null:Or(t,e,u,Yy,Xy,F);if(f){if(!w){const j=Ys(e.characterId,kc)*a*g;k!==null?N(x,M,k.x,k.y):N(-c/u,-d/u,e.x-c/u*Ms,e.y-d/u*Ms),Ed(e,Ve.dirX,Ve.dirY,j,t.arena,Ve.navX,Ve.navY),b=!0}const P=L??(i?Or(t,e,u,Rd,Id,F):null);P!==null&&$l(t,e,P,o)}else{const P=I?null:L??(i?Or(t,e,u,Rd,Id,F):null);if(P!==null)$l(t,e,P,o);else if(!w){const j=Ys(e.characterId,Mc)*a*g;k!==null?N(x,M,k.x,k.y):N(c/u,d/u,l,h),Ed(e,Ve.dirX,Ve.dirY,j,t.arena,Ve.navX,Ve.navY),b=!0}}const H=Qy(t,e,n,p,i,f,F);return H!==null&&Pu(t,e,H,o),b}const Cd=12;function Ts(t,e,a,o){if(Array.isArray(e)){if(a!==void 0||o!==void 0)throw new TypeError("createMatch: the fighter-list form takes no third or fourth argument; put `level` on each FighterConfig instead");return Fd(t,e)}const n=o??{};return Fd(t,[{characterId:e,level:n.player},{characterId:a,level:n.enemy}])}function Fd(t,e){if(e.length<nt||e.length>Gt)throw new RangeError(`createMatch: ${e.length} fighters; the sim seats ${nt}..${Gt} (see state.ts MIN_FIGHTERS / MAX_FIGHTERS)`);const a=e.length===nt,o=e.map((i,r)=>{const l=Ba(i.level??ko),h=r===0,c=a&&!h,d=i.spawn??t2(t,r);return Dg({id:r,controller:i.controller??(h?"human":"ai"),characterId:i.characterId,spawn:d,maxHp:i.maxHp??Al(i.characterId,c?eg:Rl,l),size:i.size??(c?Qm:U0),hitRadius:i.hitRadius??(c?Jm:W0),facing:i.facing??a2(t,r,d),level:l,items:i.items})}),n=o.length,s=new Array(n*n);for(let i=0;i<n;i++)for(let r=0;r<n;r++)s[Ol(i,r,n)]={x:o[r].x,y:o[r].y,at:0};return{phase:"countdown",elapsed:0,countdownValue:tg,countdownTick:0,startFlashTimer:0,timeRemaining:$a,safeRadius:t.maxSafeRadius,fighters:o,player:o[0],enemy:o[1],projectiles:[],splats:[],trailMarks:[],medikits:[],winner:null,winnerId:null,arena:t,sightings:s,aiSighting:s[Ol(1,0,n)],brokenConcealment:[],nextId:1}}function t2(t,e){if(e===0)return t.playerSpawn;if(e===1)return t.enemySpawn;const a=t.spawns?.[e];if(a)return{x:a.x,y:a.y};throw new RangeError(`createMatch: slot ${e} has no spawn. ArenaDefinition declares playerSpawn and enemySpawn only, so slots 2 and up must pass \`spawn\` explicitly — arena geometry is src/arena/**'s to own (DECISIONS §48: spawn placement is part of the 180° point-symmetry fairness constraint).`)}function a2(t,e,a){if(e===0)return{x:1,y:0};if(e===1)return{x:-1,y:0};const o=t.center.x-a.x,n=t.center.y-a.y,s=Math.hypot(o,n);return s>1e-6?{x:o/s,y:n/s}:{x:1,y:0}}const o2=Object.freeze({move:Object.freeze({x:0,y:0}),selectedWeapon:0,attack:!1});function n2(t,e,a){const o=[];if(t.elapsed+=e,i2(t,e,o),t.phase==="playing"){t.timeRemaining=Math.max(0,t.timeRemaining-e);const n=$a-t.timeRemaining;t.safeRadius=Bn(t.timeRemaining)?Sl:Zm(n,t.arena.maxSafeRadius,si(t.fighters.length))}if(r2(t),t.phase==="playing"){const n=Array.isArray(a)?a:null;for(const s of t.fighters){let i;if($y(t,s,o),Uy(t,s,o),!!s.alive){if(s.controller==="human"){const r=n===null?a:n[s.id]??o2;h2(s,r),r.attack&&$l(t,s,r.selectedWeapon,o),i=c2(t,s,e,r);const l=r.useItem??null;l!==null&&Pu(t,s,l,o)}else i=e2(t,s,e,o);My(s,e,t.arena,t.elapsed),d2(t,s,e,i,o)}}Bn(t.timeRemaining)&&p2(t,e,o),l2(t,o)}return f2(t,e,o),t.phase==="playing"&&t.timeRemaining<=0&&s2(t,o),o}function s2(t,e){const{arena:a}=t,o=r=>r.maxHp>0?r.hp/r.maxHp:0,n=r=>Math.hypot(r.x-a.center.x,r.y-a.center.y),i=t.fighters.slice().sort((r,l)=>{const h=o(r),c=o(l);if(h!==c)return c-h;const d=n(r),p=n(l);return d!==p?d-p:r.deaths!==l.deaths?r.deaths-l.deaths:r.id-l.id})[0];t.phase="ended",t.winner=i.role,t.winnerId=i.id,e.push({type:"match-ended",winner:i.role,winnerId:i.id})}function i2(t,e,a){t.phase==="countdown"&&(t.countdownTick+=e,t.countdownTick>=1e3&&(t.countdownTick-=1e3,t.countdownValue-=1,t.countdownValue>0?a.push({type:"countdown-tick",value:t.countdownValue}):(t.startFlashTimer=ag,a.push({type:"countdown-tick",value:0}))),t.countdownValue<=0&&(t.startFlashTimer-=e,t.startFlashTimer<=0&&(t.phase="playing",t.timeRemaining=$a,t.safeRadius=t.arena.maxSafeRadius,a.push({type:"match-started"}))))}function r2(t){for(let e=t.splats.length-1;e>=0;e--)t.elapsed>=t.splats[e].expiresAt&&t.splats.splice(e,1);for(let e=t.trailMarks.length-1;e>=0;e--)t.elapsed>=t.trailMarks[e].expiresAt&&t.trailMarks.splice(e,1);for(let e=t.medikits.length-1;e>=0;e--)t.elapsed>=t.medikits[e].expiresAt&&t.medikits.splice(e,1)}function l2(t,e){for(let a=0;a<t.medikits.length;){const o=t.medikits[a];if(t.elapsed<o.armsAt){a++;continue}let n=null;for(const r of t.fighters)if(!(!r.alive||r.hp>=r.maxHp)&&!(Math.hypot(r.x-o.x,r.y-o.y)>ht.pickupRadius)){if(n===null){n=r;continue}r.hp/r.maxHp<n.hp/n.maxHp&&(n=r)}if(n===null){a++;continue}const s=n.hp;n.hp=Math.min(n.maxHp,n.hp+ht.heal*rh(n.level));const i=n.hp-s;t.medikits.splice(a,1),e.push({type:"heal",fighterRole:n.role,fighterId:n.id,amount:i}),e.push({type:"medikit-taken",id:o.id,fighterRole:n.role,fighterId:n.id,x:o.x,y:o.y,amount:i})}}function qu(t,e){return Nu(e.x,e.y,t.arena,t.splats)}function h2(t,e){if(Y0(t)||!e.aim)return;const a=Math.hypot(e.aim.x,e.aim.y);a>1e-6&&(t.facing={x:e.aim.x/a,y:e.aim.y/a})}function c2(t,e,a,o){const n=t.elapsed;let s=qu(t,e);Ch(t,e)&&(s*=zt.speedBoost),n<e.status.slowedUntil&&(s*=lg);const r=Hi(e,n)?0:Ys(e.characterId,B0)*a*s,l=o.move.x*r,h=o.move.y*r;return gi(e,l,h,t.arena),l!==0||h!==0}function d2(t,e,a,o,n){if(!e.alive)return;if(e.terrainSlowFactor=qu(t,e),e.concealed=Fu(e.x,e.y,t.arena,t,e),ce[e.characterId].hasTrail&&o){if(e.trailDropTimer+=a,e.trailDropTimer>=zt.dropIntervalMs){e.trailDropTimer=0;const r={id:t.nextId++,ownerId:e.id,ownerRole:e.role,x:e.x,y:e.y,expiresAt:t.elapsed+zt.durationMs,damagedMask:0,damaged:!1};t.trailMarks.push(r),n.push({type:"trail-mark-created",ownerRole:e.role,ownerId:e.id,x:e.x,y:e.y})}}else e.trailDropTimer=0;for(const r of t.fighters){if(r===e||!r.alive)continue;const l=Ng(r.id);let h=0;for(const c of t.trailMarks)if(!(c.ownerId!==e.id||(c.damagedMask&l)!==0)&&!(Math.hypot(r.x-c.x,r.y-c.y)>=zt.radius)&&(c.damagedMask|=l,c.damaged=!0,!(h>=zt.maxHitsPerTick)&&(h++,_a(t,r,zt.damage,null,{kind:"trail",ownerId:e.id,ownerRole:e.role},n),!r.alive)))break}if(t.arena.hazards.forEach((r,l)=>{if(r.kind!=="damage")return;if(Math.hypot(e.x-r.x,e.y-r.y)<r.radius){const c=(e.hazardTimers[l]??0)+a;c>=(r.tickMs??1/0)?(e.hazardTimers[l]=0,_a(t,e,r.damage??0,null,{kind:"hazard"},n)):e.hazardTimers[l]=c}else e.hazardTimers[l]=0}),t.elapsed-e.lastDamagedAt>og&&e.hp<e.maxHp&&e.hp>0){if(e.regenTimer+=a,e.regenTimer>=ng){e.regenTimer=0;const r=e.hp;e.hp=Math.min(e.maxHp,e.hp+$0),e.hp>r&&n.push({type:"heal",fighterRole:e.role,fighterId:e.id,amount:e.hp-r})}}else e.regenTimer=0;if(Bn(t.timeRemaining))return;Math.hypot(e.x-t.arena.center.x,e.y-t.arena.center.y)>t.safeRadius&&e.hp>0?(e.fogTimer+=a,e.fogTimer>=ii&&(e.fogTimer=0,_a(t,e,lh,null,{kind:"fog"},n))):e.fogTimer=0}function p2(t,e,a){const o=Il-t.timeRemaining;if(Math.floor(o/ii)===Math.floor((o-e)/ii))return;const n=t.fighters.slice().sort((s,i)=>s.hp!==i.hp?s.hp-i.hp:i.id-s.id);for(const s of n){if(t.phase!=="playing")break;!s.alive||s.hp<=0||Math.hypot(s.x-t.arena.center.x,s.y-t.arena.center.y)<=t.safeRadius||_a(t,s,lh,null,{kind:"fog"},a)}}function Ss(t,e,a,o){const n=t.projectiles[e];o.push({type:"projectile-destroyed",id:n.id,reason:a,x:n.x,y:n.y}),t.projectiles.splice(e,1)}function Nd(t,e,a,o){const n={id:t.nextId++,x:e,y:a,expiresAt:t.elapsed+ig};t.splats.push(n),o.push({type:"splat-created",x:e,y:a})}function u2(t,e,a){let o=null,n=1/0;for(const s of t.fighters){if(!_i(s,a))continue;const i=Math.hypot(e.x-s.x,e.y-s.y);i>=s.hitRadius||i<n&&(n=i,o=s)}return o}function f2(t,e,a){for(let o=t.projectiles.length-1;o>=0;o--){const n=t.projectiles[o],s=n.weapon,i=t.fighters[n.targetId],r=t.fighters[n.ownerId];if(s.peckHits&&n.arrived){if(i.hp<=0){Ss(t,o,"expired",a);continue}n.peckTimer=(n.peckTimer??0)+e,n.peckTimer>=(s.peckInterval??500)&&(n.peckTimer=0,_a(t,i,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name,attackerId:n.ownerId},a),n.hitsSoFar=(n.hitsSoFar??1)+1,n.hitsSoFar>=s.peckHits&&Ss(t,o,"expired",a));continue}if(s.homing&&i.hp>0&&Oh(n.x,n.y,i.x,i.y,t.arena,t,i)){const g=i.x-n.x,w=i.y-n.y,b=Math.hypot(g,w)||1,y=g/b,v=w/b,k=Math.hypot(n.vx,n.vy)||1,E=n.vx/k,x=n.vy/k,M=Math.min(1,rg*e),R=E+(y-E)*M,T=x+(v-x)*M,N=Math.hypot(R,T)||1,I=s.speed??0;n.vx=R/N*I,n.vy=T/N*I}const l=n.vx*e/1e3,h=n.vy*e/1e3,c=n.x+l,d=n.y+h,p=t.arena.cover.some(g=>Qn(c,d,Cd,Cd,g.x,g.y,g.w,g.h)),u=Math.hypot(l,h);let m=u;if(u>0&&n.tx!==void 0&&n.ty!==void 0){const g=((i.x-n.tx)*l+(i.y-n.ty)*h)/u;g>0&&(m=u-g)}if(n.tx=i.x,n.ty=i.y,n.age=(n.age??0)+e,n.traveled+=m>0?m:0,n.x=c,n.y=d,p||n.traveled>=(s.range??1/0)||n.age>=sg(s)){s.splatter&&Nd(t,n.x,n.y,a),Ss(t,o,p?"hit-cover":"expired",a);continue}const f=u2(t,n,r);if(f!==null){if(f!==i&&(n.targetId=f.id,n.targetRole=f.role),_a(t,f,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name,attackerId:n.ownerId},a),s.splatter&&Nd(t,n.x,n.y,a),s.peckHits){n.arrived=!0,n.peckTimer=0,n.hitsSoFar=1;continue}Ss(t,o,"hit-target",a);continue}}}const Ld="pointerlock-styles",m2=2600;function ju(){const t=new URLSearchParams(location.search);return t.get("pointerLock")??t.get("pointerlock")}function g2(){const t=ju();if(t==="0")return!1;if(t==="1"||t==="sim")return!0;const e=new URLSearchParams(location.search);return!(e.has("shot")||e.has("simSpeed"))}function w2(){return typeof window.matchMedia!="function"?!0:window.matchMedia("(pointer: fine)").matches}function b2(t){const{target:e}=t,a=ju()==="sim";let o=!1;const s=typeof document<"u"&&"pointerLockElement"in document&&typeof e.requestPointerLock=="function"&&w2()&&g2();let i=!1,r=!1,l=!0,h="hidden",c=0,d=!1,p=!1,u="";const m=document.createElement("div");m.className="plk-root",m.innerHTML=`
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
  `;const f=z=>m.querySelector(`[data-el="${z}"]`),g=f("fs"),w=f("fs2");function b(){return a?o:document.pointerLockElement===e}function y(){window.__plockDebug={state:h,wantsLock:i,locked:b(),pending:p,lastError:u,available:s}}function v(){m.classList.toggle("is-prompt",h==="prompt"),m.classList.toggle("is-toast",h==="toast"),m.classList.toggle("is-lost",h==="lost"),y()}function k(z){h!==z&&(h=z,window.clearTimeout(c),z==="toast"&&(c=window.setTimeout(()=>{!d&&h==="toast"&&k("hidden")},m2)),v())}function E(){const Y=!!document.fullscreenElement?"⛶ Exit fullscreen":"⛶ Fullscreen";g.textContent=Y,w.textContent=Y}function x(){try{document.fullscreenElement?document.exitFullscreen?.()?.catch(()=>{}):document.documentElement.requestFullscreen?.()?.catch(()=>{})}catch{}}function M(z){u=z===void 0?"refused":String(z?.message??z),y(),!(d||!i||b())&&(t.pause(),k("lost"))}function R(){if(!(d||!s||!i||b()||p)){if(a){o=!0,F();return}p=!0;try{const z=e.requestPointerLock();z&&typeof z.then=="function"?z.then(()=>{p=!1},Y=>{p=!1,M(Y)}):window.setTimeout(()=>{p=!1},0)}catch(z){p=!1,M(z)}}}function T(){if(b()){if(r=!0,a){o=!1,F();return}try{document.exitPointerLock()}catch{r=!1}}}function N(){i=!0,t.resume()}function I(){i=!1,T(),k("prompt"),t.resume()}const F=()=>{if(d)return;const z=b();if(t.onLockChange(z),p=!1,z){i=!0,r=!1,k("toast");return}if(r){r=!1,k(l&&s?"prompt":"hidden");return}i?(t.pause(),k("lost")):k(l&&s?"prompt":"hidden")},L=()=>{p=!1,!d&&M("pointerlockerror")},H=()=>{d||!i||!s||b()||h!=="lost"&&(t.pause(),k("lost"))},P=()=>E(),j=z=>{d||!o||z.key!=="Escape"||(z.preventDefault(),z.stopImmediatePropagation(),o=!1,F())};return s&&(y2(),document.body.appendChild(m),document.addEventListener("pointerlockchange",F),document.addEventListener("pointerlockerror",L),document.addEventListener("fullscreenchange",P),window.addEventListener("blur",H),a&&window.addEventListener("keydown",j,!0),f("capture").addEventListener("click",z=>{z.stopPropagation(),N()}),f("resume").addEventListener("click",z=>{z.stopPropagation(),N()}),f("scrim").addEventListener("click",()=>N()),f("free").addEventListener("click",z=>{z.stopPropagation(),I()}),g.addEventListener("click",z=>{z.stopPropagation(),x()}),w.addEventListener("click",z=>{z.stopPropagation(),x()}),E(),k("prompt"),v()),{available:s,get locked(){return s&&b()},engage:R,release:T,setMatchActive(z){!s||l===z||(l=z,z?b()||k("prompt"):(T(),k("hidden")))},dispose(){d||(d=!0,window.clearTimeout(c),s&&(T(),document.removeEventListener("pointerlockchange",F),document.removeEventListener("pointerlockerror",L),document.removeEventListener("fullscreenchange",P),window.removeEventListener("blur",H),window.removeEventListener("keydown",j,!0),m.remove()))}}}function y2(){if(document.getElementById(Ld))return;const t=document.createElement("style");t.id=Ld,t.textContent=x2,document.head.appendChild(t)}const x2=`
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
`,oa=.11,Dd=ee*.1,Wu=new ct(oa,12,10);Wu.scale(1,.86,1);const v2=new nn(oa*.32,oa*.5,6),Go=new Li(oa*.6,0);Go.scale(1,.4,1);const k2=new K({color:"#E63946"}),M2=new K({color:"#3E5C2B"}),E2=new K({color:"#FF9E9E",transparent:!0,opacity:.55,depthWrite:!1});function Nh(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const T2=Nh(18,()=>new K({color:"#E63946",transparent:!0,opacity:.85,depthWrite:!1})),S2=Nh(20,()=>new K({color:"#C21F32",transparent:!0,opacity:.9,depthWrite:!1})),Hd=Nh(6,()=>new K({color:"#FFD9C7",transparent:!0,opacity:.95,blending:ot,depthWrite:!1}));function A2(t){const e=new le,a=new S(Wu,k2);e.add(a);const o=new S(v2,M2);o.position.set(0,oa*.75,0),e.add(o);const n=new S(Go,E2);return n.scale.setScalar(.55),n.position.set(oa*.32,oa*.28,oa*.5),e.add(n),e}function Cr(t,e,a,o,n,s=1){const i=new S(Go,S2()),r=(.3+Math.random()*.25)*s;i.scale.setScalar(r),i.position.copy(e);const l=e.x,h=e.y,c=e.z,d=1.1+Math.random()*1.3,p=-5.5,u=.32+Math.random()*.16;t.spawnTransient(i,u,(m,f)=>{i.position.set(l+a*n*f,h+d*f+.5*p*f*f,c+o*n*f),i.scale.setScalar(r*(1-m*.35)),i.material.opacity=.9*(1-m)})}const R2={Tomato:{projectile(t){const e=A2(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=(e.userData.__spin??0)+a*8;e.userData.__spin=o,e.rotation.x=o,e.rotation.z=Math.sin(o*.6)*.25;const n=1+Math.sin(o*2.2)*.09;e.scale.set(1/n,n,1/n);const s=(e.userData.__dripTimer??.05)-a;s<=0?(e.userData.__dripTimer=.09+Math.random()*.05,Cr(t,t.position,-t.direction.x*.5,-t.direction.z*.5,.3+Math.random()*.25)):e.userData.__dripTimer=s},impact(t){const e=t.position,a=V.clamp(1+t.damage*.05,1,2.2),o=Dd/(oa*.6),n=new S(Go,Hd());n.position.copy(e),n.scale.setScalar(.7*o),t.spawnTransient(n,.18,r=>{n.scale.setScalar(V.lerp(.7,2.4,r)*o*a),n.material.opacity=.9*(1-r)});const s=7,i=po*.45;for(let r=0;r<s;r++){const l=r/s*Math.PI*2+Math.random()*.5,h=i+(.5+Math.random()*.75)*a,c=new S(Go,T2()),d=(.55+Math.random()*.4)*o*a,p=e.x+Math.cos(l)*i,u=e.y,m=e.z+Math.sin(l)*i;c.position.set(p,u,m),c.rotation.y=Math.random()*Math.PI*2;const f=e.x+Math.cos(l)*h,g=e.z+Math.sin(l)*h,w=u-.9;t.spawnTransient(c,.55+Math.random()*.2,b=>{const y=1-Math.pow(1-b,3);c.position.set(V.lerp(p,f,y),V.lerp(u,w,Math.min(1,y*1.3)),V.lerp(m,g,y)),c.scale.setScalar(d*(1-b*.3)),c.material.opacity=.85*(1-Math.pow(b,1.5))})}for(let r=0;r<5;r++){const l=Math.random()*Math.PI*2;Cr(t,e,Math.cos(l),Math.sin(l),1.3+Math.random()*1.1,o)}},cast(t){const e=Dd/(oa*.6),a=new S(Go,Hd()),o=a.material;o.color.set(t.color),a.position.copy(t.position),a.scale.setScalar(.16*e),t.spawnTransient(a,.15,n=>{a.scale.setScalar(V.lerp(.16,.62,n)*e),o.opacity=.9*(1-n)});for(let n=0;n<3;n++){const s=(Math.random()-.5)*.6;Cr(t,t.position,t.direction.x+s,t.direction.z+s,.9+Math.random()*.5,e*.35)}}}},Lh="#C93F73",I2="#F0C070",qi="#FFF0F6",O2="#FFD9EC",Bl=["#E63946","#7CB518","#FFC93C","#7C4DFF","#2E86D8","#FFFFFF"],Ct=ee,bo=Math.PI*2,bi=.28,Wt=Ct*.09,ga=Ct*.043,C2=Ct*.014,F2=Ct*.042,As=Ct*.375,Rs=Ct*.4;function Yo(t,e,a,o,n){const s=new ch(t,e,a,o,n);return s.rotateX(-Math.PI/2),s}const N2=Yo(Wt,ga,8,22),L2=Yo(Wt,ga*.82,8,22),D2=Yo(Wt,ga*1.3,8,22),_d=[Yo(Wt*.92,ga*.86,6,8,1.5),Yo(Wt*1.05,ga*.72,6,8,1),Yo(Wt*.8,ga*.95,6,7,2.1)];let H2=0;const _2=()=>_d[H2++%_d.length],Gu=new hh(C2,F2,3,6);function Yu(t,e=40){const a=new Da(t,1,e,1);return a.rotateX(-Math.PI/2),a}const z2=Yu(.84),P2=Yu(.7);function rn(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const ln=(t,e,a={})=>new K({color:t,transparent:!0,opacity:e,depthWrite:!1,side:be,...a}),zd=new K({color:"#FF6FA5"}),$2=new K({color:I2}),B2=new K({color:Lh}),Pd=Bl.map(t=>new K({color:t})),U2=rn(18,()=>ln(Lh,1)),q2=rn(18,()=>ln("#FF6FA5",1)),j2=rn(30,()=>ln("#FFFFFF",1)),W2=rn(24,()=>ln(qi,.7)),G2=rn(20,()=>ln(qi,.7,{blending:ot})),Y2=rn(24,()=>ln(qi,1)),Vu=new fe(0,1,0),$d=new fe,Fr=new Di,Bd=new Di;function V2(t,e,a,o,n){Fr.setFromAxisAngle(Vu,o);const s=Math.hypot(e,a);Math.abs(n)>1e-4&&s>1e-4?($d.set(a/s,0,-e/s),Bd.setFromAxisAngle($d,n),t.quaternion.copy(Bd).multiply(Fr)):t.quaternion.copy(Fr)}function K2(t){return t.range&&t.speed?t.range/t.speed:Mo.normal/1e3}function X2(t,e,a){let o=t.userData.__ring;return o||(o={spin:Math.random()*bo,rate:a*bo/K2(e),shed:0,echo:0},t.userData.__ring=o),o}function Ja(t,e,a,o,n,s,i,r,l,h={}){const c=h.hard?Y2():h.glow?G2():W2();c.color.set(i),c.opacity=r;const d=new S(h.band?P2:z2,c);d.renderOrder=h.renderOrder??9,d.position.set(e,a,o),d.rotation.y=Math.random()*bo,d.scale.set(n,1,n);const p=h.fadePow??1,u=h.hold??0;t.spawnTransient(d,l,m=>{const f=V.lerp(n,s,1-Math.pow(1-m,2.4));d.scale.set(f,1,f),c.opacity=m<u?r:r*(1-Math.pow((m-u)/(1-u),p))})}function Nr(t,e,a,o,n,s,i,r,l=1){const h=j2();h.color.set(Bl[Math.random()*Bl.length|0]),h.opacity=1;const c=new S(Gu,h);c.renderOrder=9,c.position.set(e,a,o),c.scale.setScalar(l);const d=(Math.random()-.5)*26,p=(Math.random()-.5)*26,u=-9;t.spawnTransient(c,r,(m,f)=>{c.position.set(e+n*f,Math.max(bi,a+s*f+.5*u*f*f),o+i*f),c.rotation.set(d*f,0,p*f),h.opacity=1-Math.pow(m,2.4)})}function Z2(t,e,a,o,n,s,i){const r=new le,l=U2();l.color.set(Lh),l.opacity=1;const h=_2(),c=new S(h,l);c.scale.setScalar(1.28),r.add(c);const d=q2();d.color.set(a),d.opacity=1,r.add(new S(h,d)),r.renderOrder=9,r.position.copy(e),r.scale.setScalar(s);const p=e.x,u=e.y,m=e.z,f=Math.cos(o)*n,g=Math.sin(o)*n,w=1.5+Math.random()*1.2,b=-8.5,y=(Math.random()-.5)*20,v=(Math.random()-.5)*20;t.spawnTransient(r,i,(k,E)=>{r.position.set(p+f*E,Math.max(bi,u+w*E+.5*b*E*E),m+g*E),r.rotation.set(y*E,0,v*E);const x=1-Math.pow(k,2.2);d.opacity=x,l.opacity=x})}function J2(t){return V.clamp(.85+t*.035,.85,1.25)}function Q2(t){const e=new le,a=new S(D2,B2);a.position.y=-Ct*.007,e.add(a),e.add(new S(N2,$2)),zd.color.set(t);const o=new S(L2,zd);o.position.y=ga*.36,e.add(o);const n=Math.random()*bo;for(let s=0;s<5;s++){const i=n+s/5*bo+(Math.random()-.5)*.6,r=new S(Gu,Pd[Math.random()*Pd.length|0]);r.position.set(Math.cos(i)*Wt,ga*1.05,Math.sin(i)*Wt),r.quaternion.setFromAxisAngle(Vu,-i),r.rotateX(Math.PI/2),r.scale.setScalar(1.05),e.add(r)}return e.userData.__isCandyRing=!0,e}const ex={Candy:{projectile(t){const e=Q2(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=X2(e,t.weapon,2.4);if(o.spin+=o.rate*a,V2(e,t.direction.x,t.direction.z,o.spin,.13+Math.sin(o.spin*.41)*.08),e.position.y+=Math.sin(o.spin*.62)*Ct*.011,o.echo-=a,o.echo<=0){o.echo=.075;const n=Wt+ga;Ja(t,t.position.x,t.position.y,t.position.z,n,n*1.45,O2,.55,.2,{glow:!0,fadePow:1.4})}o.shed-=a,o.shed<=0&&(o.shed=.085+Math.random()*.05,Nr(t,t.position.x-t.direction.x*Wt,t.position.y,t.position.z-t.direction.z*Wt,-t.direction.x*.6+(Math.random()-.5)*.6,.15+Math.random()*.35,-t.direction.z*.6+(Math.random()-.5)*.6,.34,.85))},impact(t){const e=J2(t.damage),{x:a,y:o,z:n}=t.position;Ja(t,a,o,n,As*.8*e,As*e,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,fadePow:1.1,hold:.45}),Ja(t,a,o,n,As*.62*e,As*.86*e,t.color,1,.19,{hard:!0,renderOrder:11,fadePow:1.4,hold:.3}),Ja(t,a,bi,n,Rs*.2*e,Rs*e,t.color,.95,.3,{hard:!0,renderOrder:7,fadePow:1.6,hold:.35}),Ja(t,a,bi-.01,n,Rs*.16*e,Rs*.86*e,qi,.9,.34,{hard:!0,band:!0,renderOrder:6,fadePow:1.4,hold:.3});for(let s=0;s<3;s++){const i=s/3*bo+Math.random()*.9;Z2(t,t.position,t.color,i,(2.3+Math.random()*1.5)*e,(1.05+Math.random()*.5)*e,.36+Math.random()*.12)}for(let s=0;s<8;s++){const i=Math.random()*bo,r=(2.2+Math.random()*1.8)*e;Nr(t,a,o,n,Math.cos(i)*r+t.direction.x*.9,2.5+Math.random()*1.6,Math.sin(i)*r+t.direction.z*.9,.4+Math.random()*.14,1.1+Math.random()*.6)}},cast(t){Ja(t,t.position.x,t.position.y,t.position.z,Ct*.06,Ct*.2,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,hold:.3}),Ja(t,t.position.x,t.position.y,t.position.z,Ct*.03,Ct*.13,t.color,.95,.13,{hard:!0,band:!0,renderOrder:11,hold:.25});for(let e=0;e<4;e++)Nr(t,t.position.x,t.position.y,t.position.z,t.direction.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.7+Math.random()*.6,t.direction.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.3,.85)}}},es="#F2A73E",Dh="#B96F16",Ku="#E9C078",Hh="#4E2C1B",Xu="#E63946",Zu="#8FCB1E",ji="#EFE2FA",Ju="#C9A9E4",Qu="#CDB0EE",me=ee,We=Math.PI*2,yi=.29,Zo=me*.085,Wi=me*.105,Lr=me*.032,ye=me*.105,da=me*.07,ao=me*.036,Oe=me*.125,tx=me*.33;function Vo(t,e=7){return new Ae(1,1,1,e,1,!0,-t/2,t)}const Jo=[Vo(1.1),Vo(1.7),Vo(2.3)];let ax=0;const ox=()=>Jo[ax++%Jo.length],Ul=Vo(2.7,9),ef=Vo(2.9,12),ql=new Li(1,0),tf=new dh(1,0),jl=new gt(1,1,1),Ud=new ct(1,14,10),nx=new ct(1,16,10,0,Math.PI*1.5),sx=new ch(1,.062,5,20),qd=new nn(1,1,6),ix=Vo(2.2,7),rx=(()=>{const e=document.createElement("canvas");e.width=e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.85)"),o.addColorStop(.42,"rgba(255,255,255,0.44)"),o.addColorStop(.76,"rgba(255,255,255,0.12)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.colorSpace=Ni,n})();function To(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const hn=(t,e={})=>new K({color:t,transparent:!0,opacity:1,depthWrite:!1,side:be,...e}),_h=To(26,()=>hn(es)),af=To(34,()=>hn(Ku)),Is=To(30,()=>hn(Hh)),lx=To(12,()=>hn(Ju)),of=To(20,()=>hn("#FFF3D6")),hx=To(14,()=>new Pt({map:rx,color:Qu,transparent:!0,opacity:.3,depthWrite:!1})),va=(t,e={})=>new K({color:t,side:be,...e}),jd=va("#6B3E26"),cx=va(Hh),dx=va(es),px=va(Dh),Wd=va(Zu),ux=va(Xu),Gd=va("#B497D6"),fx=va(Ju),Dr=va(ji);function mx(t){return t.range&&t.speed?t.range/t.speed:Mo.normal/1e3}function Hr(t){const e=t.weapon.comboParts;if(!e)return-1;const a=e.findIndex(o=>o.color===t.color&&o.damage===t.damage);return a>=0?a:e.findIndex(o=>o.color===t.color)}function nf(t){return V.clamp(.85+t*.035,.85,1.45)}function sf(t,e,a){let o=t.userData.__tumble;return o||(o={t:Math.random()*We,rate:a*We/mx(e),shed:0},t.userData.__tumble=o),o}function qo(t,e,a,o,n,s,i,r,l,h,c,d,p,u,m=-9){a.color.set(o),a.opacity=1;const f=new S(e,a);f.renderOrder=9,f.position.set(n,s,i),f.scale.set(c,d,p),f.rotation.set(Math.random()*We,Math.random()*We,Math.random()*We);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,b=(Math.random()-.5)*20,y=f.rotation.x,v=f.rotation.y,k=f.rotation.z;t.spawnTransient(f,u,(E,x)=>{const M=s+l*x+.5*m*x*x,R=M<=yi;f.position.set(n+r*x,R?yi:M,i+h*x),R||f.rotation.set(y+g*x,v+w*x,k+b*x),a.opacity=1-Math.pow(E,2.4)})}function rf(t,e,a,o,n,s,i,r,l){qo(t,ox(),_h(),Math.random()<.35?Dh:es,e,a,o,n,s,i,Zo*r,Wi*r,Zo*r,l)}function Gi(t,e,a,o,n,s,i,r,l){qo(t,tf,af(),Ku,e,a,o,n,s,i,Lr*r,Lr*r,Lr*r,l)}function Yi(t,e,a,o,n,s,i,r,l,h){if(e==="lettuce")qo(t,Ul,Is(),Zu,a,o,n,s,i,r,da*l,da*.42*l,da*l,h,-6.5);else if(e==="tomato")qo(t,jl,Is(),Xu,a,o,n,s,i,r,ao*l,ao*l,ao*l,h);else if(e==="onion")qo(t,jl,Is(),ji,a,o,n,s,i,r,ao*1.3*l,ao*.4*l,ao*1.3*l,h);else{const c=ye*(.45+Math.random()*.3)*l;qo(t,ql,Is(),Math.random()<.4?Hh:"#6B3E26",a,o,n,s,i,r,c,c*.8,c*1.15,h)}}function zh(t,e,a,o,n){const s=of();s.color.set("#FFF3D6"),s.opacity=1;const i=new S(tf,s);i.renderOrder=12,i.position.set(e,a,o),i.rotation.set(Math.random()*We,Math.random()*We,0),i.scale.setScalar(n*.6),t.spawnTransient(i,.12,r=>{i.scale.setScalar(n*V.lerp(.6,1.3,r)),s.opacity=r<.4?1:1-(r-.4)/.6})}function lf(t,e){const{x:a,y:o,z:n}=t.position,s=t.direction,i=Math.random()*We;for(let r=0;r<5;r++){const l=i+r/5*We,h=of();h.color.set(r%2===0?"#FFF3D6":"#FFD27A"),h.opacity=1;const c=new S(Jo[r%Jo.length],h);c.renderOrder=12;const d=Math.cos(l),p=Math.sin(l),u=me*.11*e,m=me*.44*e,f=Math.atan2(d,p);t.spawnTransient(c,.13,g=>{const w=1-Math.pow(1-g,2.2),b=V.lerp(u,m,w);c.position.set(a+d*b+s.x*b*.3,o,n+p*b+s.z*b*.3);const y=(1-g*.45)*e;c.rotation.set(0,f,0),c.scale.set(Zo*1.15*y,Wi*1*y,Zo*1.15*y),h.opacity=g<.45?1:1-(g-.45)/.55})}}function Yd(t,e,a,o,n,s,i,r=.3){const l=new Oa(hx()),h=l.material;h.color.set(Qu),h.opacity=0,l.renderOrder=10;const c=(Math.random()-.5)*n*1.4,d=(Math.random()-.5)*n*1.4;l.position.set(e,a,o),l.scale.set(n,n,1),t.spawnTransient(l,i,p=>{const u=1-Math.pow(1-p,2);l.position.set(e+c*u,a+s*u,o+d*u);const m=n*(1+u*.9);l.scale.set(m,m,1),h.opacity=r*Math.sin(Math.min(1,p*1.25)*Math.PI)})}function gx(t,e,a,o){const{x:n,y:s,z:i}=t.position,r=t.direction;let l=-r.z,h=r.x;Math.hypot(l,h)<1e-4&&(l=1,h=0);for(const c of[-1,1]){const d=_h();d.color.set(c<0?es:Dh),d.opacity=1;const p=new S(ef,d);p.renderOrder=9;const u=n+l*c*me*.24*e,m=i+h*c*me*.24*e;p.position.set(u,s,m);const f=Zo*2.1*e;p.scale.set(f,Wi*1.9*e,f);const g=l*c*a+r.x*a*.35,w=h*c*a+r.z*a*.35,b=1.5+Math.random()*.9,y=c*(7+Math.random()*5),v=(Math.random()-.5)*6;t.spawnTransient(p,o,(k,E)=>{const x=s+b*E-4.6*E*E;p.position.set(u+g*E,Math.max(yi,x),m+w*E),p.rotation.set(v*E,y*E,c*.5),d.opacity=1-Math.pow(k,2.2)})}}function _r(t){const e=new le;jd.color.set(t);const a=new S(ql,jd);a.scale.set(ye,ye*.85,ye*1.18),a.rotation.set(.6,.4,.2),e.add(a);const o=new S(ql,cx);o.scale.setScalar(ye*.62),o.position.set(ye*.55,-ye*.4,-ye*.3),o.rotation.set(1.1,.3,.8),e.add(o);const n=new S(Ul,Wd);n.scale.set(da*1.15,da*.4,da*1.15),n.position.set(-ye*.45,ye*.55,ye*.2),n.rotation.set(.9,.7,-.5),e.add(n);for(const[l,h,c]of[[.8,.3,.5],[-.55,-.25,-.8]]){const d=new S(jl,ux);d.scale.setScalar(ao*1.45),d.position.set(ye*l,ye*h,ye*c),d.rotation.set(Math.random(),Math.random(),Math.random()),e.add(d)}const s=new S(Ul,Wd);s.scale.set(da*.8,da*.3,da*.8),s.position.set(ye*.3,-ye*.15,-ye*.7),s.rotation.set(-.6,1.9,.8),e.add(s);const i=new S(Jo[2],dx);i.scale.set(ye*1.02,ye*1.25,ye*1.02),i.position.set(-ye*.25,-ye*.72,-ye*.1),i.rotation.set(1.5,.4,.15),e.add(i);const r=new S(Jo[0],px);return r.scale.set(ye*.7,ye*.85,ye*.7),r.position.set(ye*.75,-ye*.35,ye*.45),r.rotation.set(.9,2.2,-.6),e.add(r),e}function zr(t){const e=new le;Gd.color.set(t);const a=new S(Ud,Gd);a.scale.set(Oe,Oe*.92,Oe),e.add(a);const o=new le;for(let i=0;i<3;i++){const r=new S(sx,Dr);r.scale.set(Oe*1.01,Oe*.93,Oe*1.01),r.rotation.y=i/3*Math.PI,o.add(r)}e.add(o);const n=new S(qd,Dr);n.scale.set(Oe*.42,Oe*.62,Oe*.42),n.position.y=Oe*1.06,n.rotation.z=.18,e.add(n);for(let i=0;i<3;i++){const r=i/3*We+.4,l=new S(qd,fx);l.scale.set(Oe*.09,Oe*.34,Oe*.09),l.position.set(Math.cos(r)*Oe*.2,-Oe*1,Math.sin(r)*Oe*.2),l.rotation.set(Math.PI+(Math.random()-.5)*.6,0,(Math.random()-.5)*.6),e.add(l)}const s=new S(Ud,Dr);return s.scale.set(Oe*.42,Oe*.2,Oe*.42),s.position.set(Oe*.42,Oe*.62,-Oe*.3),e.add(s),e.userData.__bands=o,e}function Vd(t,e){const a=t.object;if(!a)return;const o=t.dt??0,n=sf(a,t.weapon,e);if(n.t+=n.rate*o,a.rotation.x=n.t,a.rotation.z=Math.sin(n.t*.63)*.9,n.shed-=o,n.shed<=0){n.shed=.06+Math.random()*.04;const s=Math.random(),i=s<.45?"meat":s<.72?"tomato":"lettuce",r=t.position.x-t.direction.x*ye,l=t.position.z-t.direction.z*ye;Yi(t,i,r,t.position.y-ye*.4,l,-t.direction.x*.5+(Math.random()-.5)*.7,-.2-Math.random()*.4,-t.direction.z*.5+(Math.random()-.5)*.7,.85,.34),Math.random()<.55&&Gi(t,r,t.position.y,l,-t.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-t.direction.z*.7+(Math.random()-.5)*.6,.9,.3)}}function Kd(t,e){const a=nf(t.damage)*e,{x:o,y:n,z:s}=t.position,i=t.direction;zh(t,o,n,s,me*.24*a),lf(t,a),gx(t,a*.95,2.4*a,.4);const r=me*.26*a,l=.8;for(let h=0;h<6;h++){const c=h/6*We+Math.random()*.7,d=(2.2+Math.random()*1.5)*a,p=Math.random();Yi(t,p<.5?"meat":p<.78?"tomato":"lettuce",o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.9+Math.random()*1.3,Math.sin(c)*d+i.z*l,a,.42+Math.random()*.14)}for(let h=0;h<4;h++){const c=h/4*We+Math.random()*.9,d=(2.4+Math.random()*1.6)*a;rf(t,o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.7+Math.random()*1.5,Math.sin(c)*d+i.z*l,(.85+Math.random()*.5)*a,.42+Math.random()*.12)}for(let h=0;h<9;h++){const c=Math.random()*We,d=(2.6+Math.random()*2.1)*a;Gi(t,o+Math.cos(c)*r*.8,n,s+Math.sin(c)*r*.8,Math.cos(c)*d+i.x*l,1.5+Math.random()*1.8,Math.sin(c)*d+i.z*l,(.85+Math.random()*.7)*a,.36+Math.random()*.14)}}function Xd(t,e){const a=t.object;if(!a)return;const o=t.dt??0,n=sf(a,t.weapon,e);n.t+=n.rate*o,a.rotation.x=n.t*.8,a.rotation.z=n.t*.45;const s=a.userData.__bands;if(s&&(s.rotation.y+=o*1.9),n.shed-=o,n.shed<=0){n.shed=.1+Math.random()*.07;const i=af();i.color.set(ji),i.opacity=1;const r=new S(ix,i);r.renderOrder=9;const l=t.position.x-t.direction.x*Oe,h=t.position.z-t.direction.z*Oe;r.position.set(l,t.position.y,h);const c=Oe*(.3+Math.random()*.2);r.scale.set(c,c*.5,c);const d=-t.direction.x*.5+(Math.random()-.5)*.5,p=-t.direction.z*.5+(Math.random()-.5)*.5,u=5+Math.random()*5;t.spawnTransient(r,.42,(m,f)=>{r.position.set(l+d*f,t.position.y-.7*f*f-.25*f,h+p*f),r.rotation.set(Math.sin(f*u)*1.4,f*3,Math.cos(f*u*.7)*1.1),i.opacity=1-Math.pow(m,2)})}}function Zd(t,e){const a=nf(t.damage)*e,{x:o,y:n,z:s}=t.position,i=t.direction;zh(t,o,n,s,me*.21*a),lf(t,a*.88);for(let h=0;h<3;h++){const c=lx();c.color.set(h===0||h===1?t.color:ji),c.opacity=.66;const d=new S(nx,c);d.renderOrder=10,d.position.set(o,n,s),d.rotation.set((Math.random()-.5)*.5,Math.random()*We,(Math.random()-.5)*.5);const p=Oe*(.8+h*.12),u=tx*a*(.78+h*.22),m=(Math.random()-.5)*5;t.spawnTransient(d,.3+h*.05,f=>{const g=1-Math.pow(1-f,2.6),w=V.lerp(p,u,g);d.scale.set(w,w*(.9-g*.45),w),d.position.y=n+g*me*.06,d.rotation.y+=m*.02,c.opacity=.66*(1-Math.pow(f,1.4))})}Yd(t,o,n*.6,s,me*.34*a,me*.3,.65,.4);for(let h=0;h<3;h++){const c=h/3*We+Math.random();Yd(t,o+Math.cos(c)*me*.24*a,yi+me*.12,s+Math.sin(c)*me*.24*a,me*.28*a,me*.26,.6,.34)}const r=me*.24*a,l=.7;for(let h=0;h<5;h++){const c=h/5*We+Math.random()*.8,d=(2.3+Math.random()*1.4)*a;Yi(t,"onion",o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.9+Math.random()*1.2,Math.sin(c)*d+i.z*l,a,.4+Math.random()*.12)}for(let h=0;h<3;h++){const c=Math.random()*We,d=(2.3+Math.random()*1.5)*a;rf(t,o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.6+Math.random()*1.4,Math.sin(c)*d+i.z*l,(.75+Math.random()*.45)*a,.4)}for(let h=0;h<7;h++){const c=Math.random()*We,d=(2.5+Math.random()*1.9)*a;Gi(t,o+Math.cos(c)*r*.8,n,s+Math.sin(c)*r*.8,Math.cos(c)*d+i.x*l,1.4+Math.random()*1.6,Math.sin(c)*d+i.z*l,(.8+Math.random()*.6)*a,.34+Math.random()*.12)}}function Pr(t,e,a){const o=t.direction,{x:n,y:s,z:i}=t.position,r=_h();r.color.set(es),r.opacity=.9;const l=new S(ef,r);l.renderOrder=11;const h=Math.atan2(o.x,o.z),c=Zo*.9*a;t.spawnTransient(l,.18,d=>{const p=c*(1+d*1.5);l.position.set(n+o.x*d*me*.14,s-d*me*.04,i+o.z*d*me*.14),l.scale.set(p,Wi*1.1*a*(1-d*.35),p),l.rotation.set(0,h+d*1.1,0),r.opacity=.9*(1-d*d)}),zh(t,n+o.x*me*.06,s,i+o.z*me*.06,me*.1*a);for(let d=0;d<7;d++)Gi(t,n,s,i,o.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.6+Math.random()*.7,o.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(const d of e)Yi(t,d,n,s,i,o.x*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.8+Math.random()*.5,o.z*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.9*a,.3)}const wx=me*.83/(ye*2.8),bx=new ct(me*.06,7,6),yx=To(8,()=>hn("#FFF3D6",{blending:ot,opacity:0}));function Jd(t,e){let a=0;t.traverse(o=>{o.isMesh&&!o.name&&(o.name=`${e}Part${a++}`)})}const xx={Filling:{projectile(t){const e=_r(t.color);return e.position.copy(t.position),e},trail(t){Vd(t,1.7)},impact(t){Kd(t,1)},cast(t){Pr(t,["meat","tomato"],1)}},Onion:{projectile(t){const e=zr(t.color);return e.position.copy(t.position),e},trail(t){Xd(t,1.2)},impact(t){Zd(t,1)},cast(t){Pr(t,["onion","onion"],1)}},Double:{projectile(t){const e=Hr(t)===1?zr(t.color):_r(t.color);return e.scale.setScalar(1.12),e.position.copy(t.position),e},trail(t){Hr(t)===1?Xd(t,1.3):Vd(t,1.9)},impact(t){Hr(t)===1?Zd(t,1.12):Kd(t,1.12)},cast(t){Pr(t,["meat","onion","tomato"],1.25)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleTacoRoot";const n=t.position.clone();n.y-=me*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=t.weapon.comboParts??[],i=_r(s[0]?.color??t.color);i.name="teleTacoFilling";const r=zr(s[1]?.color??"#B497D6");r.name="teleTacoOnion",Jd(i,"teleTacoFilling"),Jd(r,"teleTacoOnion"),o.add(i,r);const l=6,h=[];for(let f=0;f<l;f++){const g=new e.Mesh(bx,yx());g.name=`teleTacoSpark${f}`,h.push(g),o.add(g)}const c=(f,g,w)=>{const b=e.MathUtils.clamp((f-g)/(w-g),0,1);return b*b*(3-2*b)},d=me*.48,p=me*.72,u=[e.MathUtils.degToRad(s[0]?.angle??-10),e.MathUtils.degToRad(s[1]?.angle??10)],m=(f,g)=>{const w=e.MathUtils.clamp(g/a,0,1),b=c(w,0,.42),y=c(w,.3,.82),v=c(w,.82,1);for(let k=0;k<2;k++){const E=k===0?i:r,x=k===0?-1:1,M=.76+.24*b,R=-me*.62*y,T=d*(.55+.65*b+.35*y),N=u[k],I=me*.85*v,F=x*T+Math.sin(N)*I,L=R+Math.cos(N)*I;E.position.set(F,p+me*(.2*y+.1*v),L),E.scale.setScalar(wx*M*(1+.18*v)),E.rotation.set(w*5.5*(k===0?1:-1),w*3.1,w*2.2*x)}for(let k=0;k<l;k++){const E=h[k],x=k/l*We+w*6.5,M=d*(.25+.85*b);E.position.set(Math.cos(x)*M,p+Math.sin(x*1.7)*me*.16+me*.18*y,Math.sin(x)*M*.55-me*.3*y);const R=.85+1.15*w;E.scale.setScalar(R),E.material.opacity=.45+.45*w}};m(0,0),t.spawnTransient(o,a+.06,m)}}},cn="#F5EAD6",vx="#E4CFA0",hf="#B9843C",cf="#6B3E12",df="#452D18",Vi="#E0562B",pf="#D5EAF4",Ph="#FFFFFF",ts="#FFF6E4",uf="#5B3324",$h="#FFC93C",Bh="#E63946",Uh="#7DA33F",kx="#FFFDF7",se=ee,De=Math.PI*2,jn=.29,Pe=se*.115,pt=se*.3,Mx=se*.085,ff=se*.075,qh=se*.09,Qo=se*.032,$r=se*.058,Ex=se*.1,en=se*.022,Tx=se*.4,Sx=se*.97,Ax=se*.7,mf=se*.11,Wl=new gt(1,1,1),Rx=new Ae(.5,.5,1,8,1,!0,-1.5,3),gf=new Li(.5,0),wf=new dh(.62,0),as=new hh(1,1.4,3,6);as.scale(.5,1/3.4,.5);const bf=new ct(.5,8,6),Wn=new gt(1,1,1),yf=new nn(.5,1,4),Gn=new gt(1,1,1),Qd=new ch(1,.085,5,18),ep=new Ae(1,1,1,16,1),Ix=new Ae(.55,1,1,14,1),Ox=new Ae(1,1,1,12,1,!0,-1.55,3.1),Cx=new Eo(1,18);function ka(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Ma=(t,e={})=>new K({color:t,transparent:!0,opacity:1,depthWrite:!1,side:be,...e}),Fx=ka(30,()=>Ma(cn)),Do=ka(34,()=>Ma(ts)),Nx=ka(6,()=>Ma(Vi)),Lx=ka(10,()=>Ma(cn)),Dx=ka(10,()=>Ma(cf)),xf=ka(24,()=>Ma(Ph)),Ze=(t,e={})=>new K({color:t,side:be,...e}),tp=Ze(cn),ap=Ze(vx),Os=Ze(hf),Hx=Ze(pf),_x=Ze(Vi),op=Ze(ts),zx=Ze(uf);Ze($h);Ze(Bh);Ze(Uh);const Px=[Ze(Uh),Ze(Bh),Ze($h),Ze(ts)],$x=[Ze("#5C7F2A"),Ze("#B02733"),Ze("#E0A317"),Ze(kx)],Cs=new fe,Fs=new fe,Br=new fe,np=new G0;function Bx(t,e,a,o,n,s,i){Cs.set(e,a,o).normalize(),Fs.set(n,s,i).normalize(),Br.crossVectors(Cs,Fs).normalize(),Fs.crossVectors(Br,Cs).normalize(),np.makeBasis(Cs,Fs,Br),t.quaternion.setFromRotationMatrix(np)}function Ux(t){return t.range&&t.speed?t.range/t.speed:Mo.normal/1e3}function sp(t){const e=t.weapon.pelletColors;if(!e||e.length===0)return 0;const a=e.indexOf(t.color);return a>=0?a%4:0}function Gl(t){return V.clamp(.85+t*.035,.85,1.35)}function vf(t,e,a){let o=t.userData.__spin;return o||(o={t:Math.random()*De,rate:a*De/Ux(e),shed:0,age:0},t.userData.__spin=o),o}function $t(t,e,a,o,n,s,i,r,l,h,c,d,p,u,m=-9){a.color.set(o),a.opacity=1;const f=new S(e,a);f.renderOrder=9,f.position.set(n,s,i),f.scale.set(c,d,p),f.rotation.set(Math.random()*De,Math.random()*De,Math.random()*De);const g=(Math.random()-.5)*18,w=(Math.random()-.5)*18,b=(Math.random()-.5)*18,y=f.rotation.x,v=f.rotation.y,k=f.rotation.z;t.spawnTransient(f,u,(E,x)=>{const M=s+l*x+.5*m*x*x,R=M<=jn;f.position.set(n+r*x,R?jn:M,i+h*x),R||f.rotation.set(y+g*x,v+w*x,k+b*x),a.opacity=1-Math.pow(E,2.4)})}function Ko(t,e,a,o,n,s,i,r,l){const h=Mx*r*(.85+Math.random()*.55),c=Math.random();$t(t,Rx,Fx(),c<.24?df:c<.48?hf:cn,e,a,o,n,s,i,h,h*.85,h,l,-7.5)}function Yn(t,e,a,o,n,s,i,r,l){const h=ff*r*(.7+Math.random()*.6);$t(t,Math.random()<.5?gf:wf,xf(),Math.random()<.45?Ph:pf,e,a,o,n,s,i,h*1.3,h*.34,h,l,-8.5)}function Vn(t,e,a,o,n,s,i,r,l,h){if(e==="rice")$t(t,as,Do(),ts,a,o,n,s,i,r,Qo*l,qh*l,Qo*l,h);else if(e==="bean"){const c=$r*l;$t(t,bf,Do(),uf,a,o,n,s,i,r,c*1.35,c*.85,c*.85,h)}else if(e==="cheese")$t(t,Wn,Do(),$h,a,o,n,s,i,r,Ex*l,en*l,en*l,h,-6.5);else if(e==="salsa"){const c=$r*.85*l;$t(t,Gn,Do(),Bh,a,o,n,s,i,r,c,c,c,h)}else{const c=$r*l;$t(t,Gn,Do(),Uh,a,o,n,s,i,r,c*1.2,c*.55,c*1.2,h)}}const qx=se*.075,Ns=ka(28,()=>Ma(ts)),ip=7;function jx(t,e,a,o,n,s,i,r,l,h){const c=t.color,d=qx*l;if(e===0)$t(t,yf,Ns(),c,a,o,n,s,i,r,d*.5,d*2.6,d*.22,h,-7.2);else if(e===1){const p=d*(1+Math.random()*.35);$t(t,Gn,Ns(),c,a,o,n,s,i,r,p,p,p,h)}else e===2?$t(t,Wn,Ns(),c,a,o,n,s,i,r,d*2.5,en*2.2,en*2.2,h,-6.5):$t(t,as,Ns(),c,a,o,n,s,i,r,Qo*1.15*l,qh*1.15*l,Qo*1.15*l,h,-7.5)}function Yl(t,e){const{x:a,y:o,z:n}=t.position,s=t.direction,i=Math.random()*De;for(let r=0;r<8;r++){const l=i+r/8*De,h=xf();h.color.set(r%2===0?Ph:df),h.opacity=1;const c=new S(r%2===0?gf:wf,h);c.renderOrder=12;const d=Math.cos(l),p=Math.sin(l),u=se*.26*e,m=se*.44*e,f=(Math.random()-.5)*14;t.spawnTransient(c,.14,g=>{const w=1-Math.pow(1-g,2.2),b=V.lerp(u,m,w);c.position.set(a+d*b+s.x*b*.28,o+w*se*.05,n+p*b+s.z*b*.28);const y=ff*e*(1.7-g*.5);c.scale.set(y*1.6,y*.34,y),c.rotation.set(f*g,Math.atan2(d,p),f*g*.6),h.opacity=g<.45?1:1-(g-.45)/.55})}}const La=16,kf=2.35,Wx=.42;function jh(t){const e=new le,a=Lx(),o=Dx();a.color.set(cn),a.opacity=1,o.color.set(cf),o.opacity=1;const n=[];for(let s=0;s<t;s++){const i=new S(Wl,o);i.renderOrder=10;const r=new S(Wl,a);r.renderOrder=11,i.scale.setScalar(0),r.scale.setScalar(0),e.add(i,r),n.push({face:r,back:i})}return{group:e,slats:n,faceMat:a,backMat:o}}function Gx(t,e,a,o,n,s,i,r){const{group:l,slats:h,faceMat:c,backMat:d}=jh(La),p=se*.06*i,u=se*.15*i,m=Ax*i,f=mf*i,g=(v,k,E)=>{const x=v*kf*De*s,M=v*Wx*De*s,R=x+(M-x)*k,T=p+v*(u-p),N=p+v*(m-p),I=T+(N-T)*k;E.x=e+Math.cos(n+R)*I,E.z=o+Math.sin(n+R)*I},w={x:0,z:0},b={x:0,z:0},y=v=>{const k=1-Math.pow(1-Math.min(1,v/.62),2.4),E=V.lerp(a,jn,1-Math.pow(1-Math.min(1,v/.72),1.8));for(let M=0;M<La;M++){const R=M/La,T=(M+1)/La;g(R,k,w),g(T,k,b);const N=b.x-w.x,I=b.z-w.z,F=Math.hypot(N,I)*1.14,L=Math.atan2(N,I),H=(w.x+b.x)*.5,P=(w.z+b.z)*.5,j=f*(1-R*.35),{face:z,back:Y}=h[M];z.rotation.set(0,L,0),Y.rotation.set(0,L,0),z.position.set(H,E+.022,P),Y.position.set(H,E,P),z.scale.set(j,se*.008,F),Y.scale.set(j*1.8,se*.006,F*1.12)}const x=v<.68?1:1-(v-.68)/.32;c.opacity=x,d.opacity=x*.95};y(0),t.spawnTransient(l,r,y)}function Yx(t,e,a){const{x:o,z:n}=t.position,s=22,i=2.2,r=Tx*e,{group:l,slats:h,faceMat:c,backMat:d}=jh(s),p=Math.random()*De,u=jn+se*.02,m=(Sx*e-u)/(s-1),f=i*De/(s-1),g=w=>{const b=Math.min(1,w/.52),y=w<.62?1:1-(w-.62)/.38*.16;for(let k=0;k<s;k++){const E=k/s*.9,x=b>E,{face:M,back:R}=h[k];if(M.visible=x,R.visible=x,!x)continue;const T=p+k*f,N=r*y,I=o+Math.cos(T)*N,F=u+k*m,L=n+Math.sin(T)*N;Bx(M,-Math.sin(T)*N*f,m,Math.cos(T)*N*f,Math.cos(T),0,Math.sin(T)),R.quaternion.copy(M.quaternion);const H=N*f*1.02,P=se*.1*e;M.position.set(I,F,L),R.position.set(I-Math.cos(T)*.02,F,L-Math.sin(T)*.02),M.scale.set(H,se*.009,P),R.scale.set(H*1.02,se*.007,P*1.75)}const v=w<.62?1:1-(w-.62)/.38;c.opacity=.88*v,d.opacity=.92*v};g(0),t.spawnTransient(l,a,g)}function Mf(t,e,a,o,n,s,i,r,l){const{group:h,slats:c,faceMat:d,backMat:p}=jh(La),u=se*.03*r,m=se*.13*r,f=Math.random()<.5?1:-1,g=f*(9+Math.random()*5),w={x:0,z:0},b={x:0,z:0},y=(k,E,x)=>{const M=E+k*kf*De*f,R=u+k*(m-u);x.x=Math.cos(M)*R,x.z=Math.sin(M)*R},v=(k,E)=>{const x=g*E,M=e+n*E,R=Math.max(jn,a+s*E-4*E*E),T=o+i*E;for(let I=0;I<La;I++){y(I/La,x,w),y((I+1)/La,x,b);const F=b.x-w.x,L=b.z-w.z,H=Math.hypot(F,L)*1.16,P=Math.atan2(F,L),{face:j,back:z}=c[I];j.rotation.set(0,P,0),z.rotation.set(0,P,0),j.position.set(M+(w.x+b.x)*.5,R+.018,T+(w.z+b.z)*.5),z.position.set(M+(w.x+b.x)*.5,R,T+(w.z+b.z)*.5);const Y=mf*r*.72;j.scale.set(Y,se*.007,H),z.scale.set(Y*1.8,se*.005,H*1.14)}const N=1-Math.pow(k,2);d.opacity=N,p.opacity=N*.95};v(0,0),t.spawnTransient(h,l,v)}function Vx(t){const e=new le,a=new le;e.add(a),tp.color.set(t);const o=new S(ep,tp);o.rotation.x=Math.PI/2,o.scale.set(Pe,pt*.8,Pe),a.add(o);const n=new S(Ix,ap);n.rotation.x=-Math.PI/2,n.scale.set(Pe,pt*.12,Pe),n.position.z=-pt*.46,a.add(n);const s=new S(Ox,Os);s.rotation.x=Math.PI/2,s.scale.set(Pe*1.02,pt*.8,Pe*1.02),a.add(s);const i=new S(Wn,Os);i.position.set(Pe*.92,0,0),i.rotation.set(.42,0,0),i.scale.set(Pe*.14,Pe*.16,pt*.82),a.add(i);const r=new S(ep,Hx);r.rotation.x=Math.PI/2,r.scale.set(Pe*1.07,pt*.26,Pe*1.07),r.position.z=-pt*.2,a.add(r);for(const c of[-pt*.1,pt*.04]){const d=new S(Qd,_x);d.scale.set(Pe*1.08,Pe*1.08,Pe*.85),d.position.z=c,a.add(d)}const l=new S(Cx,ap);l.scale.setScalar(Pe*.99),l.position.z=pt*.404,a.add(l);const h=[Os,op,Os];for(let c=0;c<3;c++){const d=new S(Qd,h[c]),p=Pe*(.78-c*.25);d.scale.set(p,p,Pe*.2),d.position.z=pt*.412,a.add(d)}for(let c=0;c<4;c++){const d=c/4*De+.5,p=new S(c%2===0?as:bf,c%2===0?op:zx),u=Pe*.28;p.scale.set(u,c%2===0?u*2:u,u),p.position.set(Math.cos(d)*Pe*.6,Math.sin(d)*Pe*.6,pt*.42),p.rotation.set(Math.random(),Math.random(),Math.random()),a.add(p)}return e.userData.__spinner=a,e}function rp(t){const e=new le,a=Px[t],o=$x[t],n=se*.075;if(t===0){for(let i=0;i<3;i++){const r=new S(yf,i===1?o:a);r.scale.set(n*.5,n*2.6,n*.22),r.position.set((i-1)*n*.5,n*.4,0),r.rotation.set(.2,0,(i-1)*.55),e.add(r)}const s=new S(Wn,o);s.scale.set(n*.16,n*1.2,n*.16),s.position.y=-n*.7,e.add(s)}else if(t===1)for(let s=0;s<3;s++){const i=s/3*De,r=new S(Gn,s===2?o:a),l=n*(1+Math.random()*.35);r.scale.setScalar(l),r.position.set(Math.cos(i)*n*.75,Math.sin(i)*n*.5,Math.sin(i*1.7)*n*.55),r.rotation.set(Math.random(),Math.random(),Math.random()),e.add(r)}else if(t===2)for(let s=0;s<4;s++){const i=new S(Wn,s===3?o:a);i.scale.set(n*2.5,en*1.2,en*1.2),i.position.set(0,(s-1.5)*n*.28,(s-1.5)*n*.2),i.rotation.set(0,(s-1.5)*.28,(s-1.5)*.14),e.add(i)}else for(let s=0;s<5;s++){const i=s/5*De+.3,r=new S(as,s===4?o:a);r.scale.set(Qo*1.15,qh*1.15,Qo*1.15),r.position.set(Math.cos(i)*n*.55,Math.sin(i*1.3)*n*.4,Math.sin(i)*n*.55),r.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),e.add(r)}return e}function Kx(t){const e=t.object;if(!e)return;const a=t.dt??0,o=vf(e,t.weapon,9);o.t+=o.rate*a;const n=e.userData.__spinner;if(n&&(n.rotation.z=o.t),e.rotation.x=Math.sin(o.t*.35)*.1,o.shed-=a,o.shed<=0){o.shed=.055+Math.random()*.04;const s=t.position.x-t.direction.x*pt*.5,i=t.position.z-t.direction.z*pt*.5,r=Math.random();r<.42?Vn(t,"rice",s,t.position.y-Pe*.3,i,-t.direction.x*.6+(Math.random()-.5)*.7,-.15-Math.random()*.4,-t.direction.z*.6+(Math.random()-.5)*.7,.9,.32):r<.72?Ko(t,s,t.position.y,i,-t.direction.x*.8+(Math.random()-.5)*.6,.15+Math.random()*.3,-t.direction.z*.8+(Math.random()-.5)*.6,.75,.3):Yn(t,s,t.position.y,i,-t.direction.x*.9+(Math.random()-.5)*.5,.2+Math.random()*.35,-t.direction.z*.9+(Math.random()-.5)*.5,.65,.26)}}function Xx(t){const e=Gl(t.damage),{x:a,y:o,z:n}=t.position,s=t.direction;Yl(t,e);const i=se*.16*e;let r=-s.z,l=s.x;Math.hypot(r,l)<1e-4&&(r=1,l=0);const h=Math.atan2(s.z,s.x);for(const p of[-1,1])Gx(t,a+s.x*i+r*p*i*.7,o,n+s.z*i+l*p*i*.7,h+p*1.05,p,e*.92,.78);const c=se*.26*e,d=.8;for(let p=0;p<9;p++){const u=p/9*De+Math.random()*.6,m=(2.3+Math.random()*1.5)*e,f=Math.random();Vn(t,f<.32?"rice":f<.66?"bean":f<.85?"cheese":"salsa",a+Math.cos(u)*c,o,n+Math.sin(u)*c,Math.cos(u)*m+s.x*d,1.9+Math.random()*1.3,Math.sin(u)*m+s.z*d,e,.42+Math.random()*.14)}for(let p=0;p<6;p++){const u=p/6*De+Math.random()*.9,m=(2.4+Math.random()*1.6)*e;Ko(t,a+Math.cos(u)*c,o,n+Math.sin(u)*c,Math.cos(u)*m+s.x*d,1.8+Math.random()*1.4,Math.sin(u)*m+s.z*d,(.9+Math.random()*.5)*e,.44+Math.random()*.12)}for(let p=0;p<4;p++){const u=Math.random()*De,m=(2.7+Math.random()*1.8)*e;Yn(t,a+Math.cos(u)*c*.9,o,n+Math.sin(u)*c*.9,Math.cos(u)*m+s.x*d,1.6+Math.random()*1.6,Math.sin(u)*m+s.z*d,(.8+Math.random()*.6)*e,.36+Math.random()*.12)}}function Zx(t,e){const a=t.direction,{x:o,y:n,z:s}=t.position;Mf(t,o,n,s,a.x*2.2+(Math.random()-.5)*.4,.7,a.z*2.2+(Math.random()-.5)*.4,e,.26);for(let i=0;i<5;i++)Vn(t,i%2===0?"rice":"bean",o,n,s,a.x*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.6,a.z*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.9*e,.3);for(let i=0;i<4;i++)Yn(t,o,n,s,a.x*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8+Math.random()*.6,a.z*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8*e,.24);for(let i=0;i<3;i++)Ko(t,o,n,s,a.x*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.6+Math.random()*.5,a.z*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.8*e,.26)}const Jx=3.6,lp=new ct(1,14,10),Qx=ka(4,()=>Ma(Vi,{opacity:.85})),ev=ka(4,()=>Ma(cn,{opacity:.7}));function tv(t,e){let a=0;t.traverse(o=>{o.isMesh&&!o.name&&(o.name=`${e}Part${a++}`)})}const av={Disc:{projectile(t){const e=Vx(t.color);return e.position.copy(t.position),e},trail(t){Kx(t)},impact(t){Xx(t)},cast(t){Zx(t,1)}},Roll:{impact(t){const e=Gl(t.damage);Yx(t,1,.62),Yl(t,e*.85);const{x:a,y:o,z:n}=t.position,s=t.direction,i=se*.24*e;for(let r=0;r<5;r++){const l=r/5*De+Math.random()*.8,h=(2+Math.random()*1.3)*e;Vn(t,r%2===0?"rice":"guac",a+Math.cos(l)*i,o,n+Math.sin(l)*i,Math.cos(l)*h+s.x*.6,1.7+Math.random()*1.1,Math.sin(l)*h+s.z*.6,e,.38+Math.random()*.12)}for(let r=0;r<3;r++){const l=Math.random()*De,h=(2.2+Math.random()*1.4)*e;Ko(t,a+Math.cos(l)*i,o,n+Math.sin(l)*i,Math.cos(l)*h+s.x*.6,1.6+Math.random()*1.2,Math.sin(l)*h+s.z*.6,.85*e,.4)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position;for(const s of[-.5,.5])Mf(t,a-e.z*s*se*.12,o,n+e.x*s*se*.12,e.x*2.6-e.z*s*1.2,.5,e.z*2.6+e.x*s*1.2,.9,.3);for(let s=0;s<5;s++)Ko(t,a,o,n,e.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.6+Math.random()*.6,e.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.85,.28);for(let s=0;s<3;s++)Yn(t,a,o,n,e.x*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.5,e.z*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.75,.24)}},Swarm:{projectile(t){const e=rp(sp(t));return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=vf(e,t.weapon,2.4);o.t+=o.rate*a,o.age+=a;const n=Math.sin(o.age*7.5+o.t)*se*.085;if(e.position.x+=-t.direction.z*n,e.position.z+=t.direction.x*n,e.position.y+=Math.sin(o.age*5.2)*se*.03,e.rotation.x=o.t*.8,e.rotation.z=Math.sin(o.t*.7)*.7,o.shed-=a,o.shed<=0){o.shed=.14+Math.random()*.08;const s=Do();s.color.set(t.color),s.opacity=1;const i=new S(Gn,s);i.renderOrder=9;const r=e.position.x,l=e.position.y,h=e.position.z,c=se*.03;i.position.set(r,l,h),i.scale.setScalar(c),t.spawnTransient(i,.26,(d,p)=>{i.position.set(r,l-.5*p*p,h),i.scale.setScalar(c*(1-d*.6)),s.opacity=1-d})}},impact(t){const e=Gl(t.damage)*.8,{x:a,y:o,z:n}=t.position,s=t.direction;Yl(t,1);const i=se*.28,r=sp(t);for(let l=0;l<ip;l++){const h=l/ip*De+Math.random()*.8,c=(2.6+Math.random()*1.5)*e;jx(t,r,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*.7,1.8+Math.random()*1.2,Math.sin(h)*c+s.z*.7,1.15,.44+Math.random()*.1)}for(let l=0;l<4;l++){const h=l/4*De+Math.random()*.9,c=(2.5+Math.random()*1.5)*e;Ko(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*.5,1.6+Math.random()*1.2,Math.sin(h)*c+s.z*.5,1+Math.random()*.4,.38)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position,s=(t.weapon.spreadDeg??40)*Math.PI/360,i=["guac","salsa","cheese","rice"];for(let c=0;c<12;c++){const d=(Math.random()*2-1)*s,p=Math.cos(d),u=Math.sin(d),m=e.x*p-e.z*u,f=e.x*u+e.z*p,g=1.8+Math.random()*1.4;Vn(t,i[c%4],a,o,n,m*g,.8+Math.random()*.7,f*g,.95,.34)}const r=Nx();r.color.set(Vi),r.opacity=1;const l=new S(Wl,r);l.renderOrder=11;const h=Math.atan2(e.x,e.z);t.spawnTransient(l,.2,c=>{const d=1-Math.pow(1-c,2);l.position.set(a+e.x*d*se*.3,o+d*se*.05,n+e.z*d*se*.3),l.rotation.set(0,h+d*.8,0),l.scale.set(se*.2*(1+d*.5),se*.01,se*.05),r.opacity=1-c*c});for(let c=0;c<4;c++)Yn(t,a,o,n,e.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8+Math.random()*.6,e.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8,.26)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleBurritoRoot";const n=t.position.clone();n.y-=se*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=Qx(),i=new e.Mesh(lp,s);i.name="teleBurritoBulge",o.add(i);const r=ev(),l=new e.Mesh(lp,r);l.name="teleBurritoShell",o.add(l);const h=4,c=[];for(let g=0;g<h;g++){const w=rp(g);w.name=`teleBurritoTopping${g}`,tv(w,`teleBurritoTopping${g}`),c.push(w),o.add(w)}const d=(g,w,b)=>{const y=e.MathUtils.clamp((g-w)/(b-w),0,1);return y*y*(3-2*y)},p=se*.78,u=se*.22,m=(t.weapon.spreadDeg??55)*Math.PI/360,f=(g,w)=>{const b=e.MathUtils.clamp(w/a,0,1),y=d(b,0,.4),v=d(b,.85,1),k=se*(.13+.15*y)*(1-.35*v);i.position.set(0,p,u),i.scale.set(k,k*(.82+.25*Math.sin(b*11)),k),s.opacity=(.55+.4*y)*(1-v*.8);const E=se*(.17-.05*y);l.position.set(0,p-se*.04,u-se*.16),l.scale.set(E,E*(1.25-.3*y),E),r.opacity=.62*(1-v*.9);for(let x=0;x<h;x++){const M=c[x],R=x*.09,T=d(b,.18+R,.85),N=(x/(h-1)-.5)*2*m,I=x/h*De+b*(3.2+2.4*T),F=e.MathUtils.lerp(I,N,v),L=se*(.42+.34*T+.26*v);M.position.set(Math.sin(F)*L,p+Math.sin(I*1.6)*se*.1*(1-v)+se*.1*T,u+Math.cos(F)*L*(.55+.45*v));const H=2.2+(Jx-2.2)*T;M.scale.setScalar(H),M.rotation.set(b*4.2+x,b*3-x,b*2.4)}};f(0,0),t.spawnTransient(o,a+.06,f)}}},So="#FFF8EA",Wh="#E4D6AE",Ki="#FFFFFF",Gh="#4A3118",Ef="#FF9E12",ov="#FFCE55",Tf="#F4FBFF",Xs="#FFD84D",nv="#EFB528",sv="#F5872B",iv="#2A2320",Sf="#FFF0B8",Re=ee,$e=Math.PI*2,yo=.29,rv=Re*.31,lv=Re*.2,Af=Re*.03,hv=Re*.062,cv=Re*.115,dv=Re*.052,pv=Re*.16,uv=Re*.026,fv=Re*.045,oo=Re*.125,ut=Re*.085,Ls=Re*.115,xo=new nn(.5,1,4);xo.rotateZ(-Math.PI/2);const Vl=new ct(.5,16,11,0,Math.PI*1.5),mv=new Ae(.5,.5,1,8,1,!0,-1.35,2.7),gv=new Ae(.5,.5,1,8,1,!0,-1.2,2.4),jo=new ct(.5,12,10),Yh=new hh(1,2.2,3,7);Yh.scale(.5,1/4.2,.5);Yh.rotateZ(-Math.PI/2);const Rf=new dh(.62,0),wv=new nn(.5,1,3),bv=new gt(1,1,1),If=new nn(.5,1,4);If.rotateX(Math.PI/2);function os(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const ns=(t,e={})=>new K({color:t,transparent:!0,opacity:1,depthWrite:!1,side:be,...e}),Of=os(34,()=>ns(So)),yv=os(18,()=>ns(Ef)),xv=os(18,()=>ns(Tf)),vv=os(16,()=>ns(Sf)),tn=os(40,()=>ns(Ki)),wa=(t,e={})=>new K({color:t,side:be,...e}),Ur=wa(So),Kl=wa(Wh),kv=wa(So),hp=wa(sv),Mv=wa(iv),cp=wa(nv),dp=[wa(Xs),wa(Xs),wa(Xs)];let Ev=0;const Sn=new fe,An=new fe,qr=new fe,pp=new G0;function Xi(t,e,a,o){Sn.set(e,a,o).normalize(),Math.abs(Sn.y)>.94?An.set(1,0,0):An.set(0,1,0),qr.crossVectors(Sn,An).normalize(),An.crossVectors(qr,Sn).normalize(),pp.makeBasis(Sn,An,qr),t.quaternion.setFromRotationMatrix(pp)}function Tv(t){return t.range&&t.speed?t.range/t.speed:Mo.normal/1e3}function Xl(t){return V.clamp(.85+t*.035,.85,1.45)}function Sv(t,e,a,o,n,s,i,r,l,h,c,d,p,u,m=-9){a.color.set(o),a.opacity=1;const f=new S(e,a);f.renderOrder=9,f.position.set(n,s,i),f.scale.set(c,d,p),f.rotation.set(Math.random()*$e,Math.random()*$e,Math.random()*$e);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,b=(Math.random()-.5)*20,y=f.rotation.x,v=f.rotation.y,k=f.rotation.z;t.spawnTransient(f,u,(E,x)=>{const M=s+l*x+.5*m*x*x,R=M<=yo;f.position.set(n+r*x,R?yo:M,i+h*x),R||f.rotation.set(y+g*x,v+w*x,k+b*x),a.opacity=1-Math.pow(E,2.4)})}function lo(t,e,a,o,n,s,i,r,l){const h=hv*r*(.75+Math.random()*.6);Sv(t,Rf,Of(),Math.random()<.3?Wh:So,e,a,o,n,s,i,h,h*.8,h,l)}function jr(t,e,a,o,n,s,i,r,l){const h=yv();h.color.set(Math.random()<.3?ov:Ef),h.opacity=1;const c=new S(jo,h);c.renderOrder=9;const d=dv*r*(.8+Math.random()*.6);c.position.set(e,a,o),c.scale.setScalar(d);const p=14+Math.random()*10,u=Math.random()*$e;t.spawnTransient(c,l,(m,f)=>{const g=a+s*f-4.4*f*f;c.position.set(e+n*f,Math.max(yo,g),o+i*f);const w=Math.sin(u+f*p)*.24;c.scale.set(d*(1+w),d*(1-w),d*(1+w*.4)),h.opacity=1-Math.pow(m,3)})}function Zs(t,e,a,o,n,s,i,r,l){const h=xv();h.color.set(Tf),h.opacity=.78;const c=new S(Yh,h);c.renderOrder=10,c.position.set(e,a,o);const d=pv*r*(.55+Math.random()*.4),p=uv*r*(.75+Math.random()*.5);Xi(c,n,s,i),c.scale.set(d,p,p),t.spawnTransient(c,l,(u,m)=>{const f=a+s*m-2.2*m*m;c.position.set(e+n*m,Math.max(yo,f),o+i*m),c.scale.set(d*(1+u*1.5),p*(1-u*.4),p*(1-u*.4)),h.opacity=.78*(1-Math.pow(u,1.8))})}function Vh(t,e,a,o,n,s,i,r){const l=vv();l.color.set(Math.random()<.35?Xs:Sf),l.opacity=1;const h=new S(wv,l);h.renderOrder=9;const c=fv*i*(.7+Math.random()*.6);h.position.set(e,a,o),h.scale.set(c,c*1.5,c*.35);const d=4+Math.random()*4,p=Math.random()*$e;t.spawnTransient(h,r,(u,m)=>{h.position.set(e+n*m+Math.sin(p+m*d)*.1,a+.35*m-.55*m*m,o+s*m+Math.cos(p+m*d*.8)*.1),h.rotation.set(Math.sin(p+m*d)*1.5,m*2.2,Math.cos(p+m*d*.7)*1.2),l.opacity=1-Math.pow(u,2)})}function Js(t,e,a,o=.13){const{x:n,y:s,z:i}=t.position,r=t.direction,l=Math.random()*$e;for(let h=0;h<e;h++){const c=l+h/e*$e+(Math.random()-.5)*.5,d=(h%3-1)*.42+(Math.random()-.5)*.2,p=Math.cos(d),u=Math.cos(c)*p,m=Math.sin(d),f=Math.sin(c)*p,g=tn();g.color.set(h%2===0?Ki:So),g.opacity=1;const w=tn();w.color.set(Gh),w.opacity=1;const b=new S(xo,g),y=new S(xo,w);b.renderOrder=13,y.renderOrder=12;const v=rv,k=v+lv*a*(.7+Math.random()*.55),E=Af*(.8+Math.random()*.45),x=n+r.x*v*.22,M=i+r.z*v*.22,R=new le;R.add(y,b),Xi(b,u,m,f),y.quaternion.copy(b.quaternion),t.spawnTransient(R,o,T=>{const N=1-Math.pow(1-T,2.4),I=V.lerp(v,v+(k-v)*.45,N),F=V.lerp(v+(k-v)*.35,k,N),L=Math.max(.02,F-I),H=(I+F)*.5;b.position.set(x+u*H,s+m*H,M+f*H),y.position.copy(b.position),b.scale.set(L,E,E),y.scale.set(L*1.06,E*2.6,E*2.6);const P=T<.45?1:1-(T-.45)/.55;g.opacity=P,w.opacity=P})}}function up(t,e,a,o){const{x:n,z:s}=t.position,i=Math.random()*$e,r=new le,l=tn();l.color.set(Ki),l.opacity=1;const h=tn();h.color.set(Gh),h.opacity=1;const c=[];for(let u=0;u<e;u++){const m=i+u/e*$e+(Math.random()-.5)*.55,f=new S(xo,h),g=new S(xo,l);f.renderOrder=10,g.renderOrder=11,f.scale.setScalar(0),g.scale.setScalar(0),Xi(g,Math.cos(m),0,Math.sin(m)),f.quaternion.copy(g.quaternion),r.add(f,g),c.push({face:g,seam:f,a:m,len:Re*(.16+Math.random()*.3)*a,w:Re*(.02+Math.random()*.014)*a})}const d=Re*.2*a,p=u=>{const m=1-Math.pow(1-Math.min(1,u/.22),2.6);for(const g of c){const w=Math.max(.001,g.len*m),b=d+w*.5,y=n+Math.cos(g.a)*b,v=s+Math.sin(g.a)*b;g.face.position.set(y,yo+.012,v),g.seam.position.set(y,yo,v),g.face.scale.set(w,Re*.006,g.w),g.seam.scale.set(w*1.05,Re*.004,g.w*2.1)}const f=u<.42?1:1-(u-.42)/.58;l.opacity=.92*f,h.opacity=.92*f};p(0),t.spawnTransient(r,o,p)}function fp(t,e,a,o){const{x:n,y:s,z:i}=t.position,r=t.direction;let l=-r.z,h=r.x;Math.hypot(l,h)<1e-4&&(l=1,h=0);for(const c of[-1,1]){const d=Of();d.color.set(c<0?So:Wh),d.opacity=1;const p=new S(Vl,d);p.renderOrder=10;const u=n+l*c*Re*.26*e,m=i+h*c*Re*.26*e,f=cv*2*e;p.position.set(u,s,m),p.scale.set(f,f*1.15,f),p.rotation.set(0,c*1.4,0);const g=l*c*a+r.x*a*.35,w=h*c*a+r.z*a*.35,b=1.6+Math.random()*.9,y=c*(6+Math.random()*4),v=(Math.random()-.5)*5;t.spawnTransient(p,o,(k,E)=>{const x=s+b*E-4.6*E*E;p.position.set(u+g*E,Math.max(yo,x),m+w*E),p.rotation.set(v*E,c*1.4+y*E,c*.4),d.opacity=1-Math.pow(k,2.2)})}}function Av(t){const e=new le,a=new le;e.add(a);const o=dp[Ev++%dp.length];o.color.set(t);const n=oo,s=new S(jo,o);s.scale.set(n*2,n*1.85,n*1.9),s.position.y=n*.15,a.add(s);const i=new S(jo,cp);i.scale.set(n*1.5,n*.8,n*1.45),i.position.set(0,-n*.42,n*.18),a.add(i);const r=new S(If,hp);r.scale.set(n*.55,n*.46,n*.7),r.position.set(0,n*.26,n*.92),a.add(r);for(const c of[-1,1]){const d=new S(jo,Mv);d.scale.setScalar(n*.34),d.position.set(c*n*.4,n*.62,n*.62),a.add(d);const p=new S(jo,cp);p.scale.set(n*.34,n*.85,n*1.05),p.position.set(c*n*.92,n*.08,-n*.1),p.rotation.z=c*.4,a.add(p),p.userData.__side=c;const u=new S(bv,hp);u.scale.set(n*.18,n*.1,n*.44),u.position.set(c*n*.34,-n*.92,n*.12),a.add(u)}const l=new S(Vl,kv);l.scale.set(n*1.22,n*1,n*1.22),l.position.set(-n*.16,n*.88,-n*.22),l.rotation.set(Math.PI-.42,.7,.3),a.add(l);const h=new S(Vl,Kl);return h.scale.set(n*1.08,n*.8,n*1.08),h.position.set(-n*.16,n*.86,-n*.22),h.rotation.set(Math.PI-.42,.7,.3),a.add(h),e.userData.__bob=a,e}function Rv(t){const e=new le;Ur.color.set(t);const a=new S(mv,Ur);a.scale.set(ut*2,Ls,ut*2),e.add(a);const o=new S(gv,Kl);o.scale.set(ut*1.78,Ls*.92,ut*1.78),e.add(o);for(let s=0;s<2;s++){const i=new S(Rf,Ur),r=ut*(.42+s*.18);i.scale.set(r,r*.7,r),i.position.set(ut*(s===0?.8:-.5),Ls*(s===0?.45:-.5),ut*.4),i.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),e.add(i)}const n=new S(jo,Kl);return n.scale.set(ut*.75,ut*.4,ut*.75),n.position.set(-ut*.2,-Ls*.34,0),e.add(n),e}function Cf(t,e,a){let o=t.userData.__anim;return o||(o={t:Math.random()*$e,rate:a*$e/Tv(e.weapon),shed:0,age:0,lx:e.position.x,lz:e.position.z,speed:et(e.weapon.speed??160)},t.userData.__anim=o),o}function Iv(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Cf(e,t,1);o.age+=a;const n=Math.hypot(t.position.x-o.lx,t.position.z-o.lz);a>0&&(o.speed=o.speed*.55+n/a*.45),o.lx=t.position.x,o.lz=t.position.z;const s=et(t.weapon.speed??160),i=o.speed<s*.28,r=e.userData.__bob;if(r)if(i){const l=o.age*2.2%1,h=Math.sin(Math.min(1,l*2.2)*Math.PI);r.position.set(0,-oo*.3*h,oo*.75*h),r.rotation.set(h*.95,0,0)}else{const l=o.age*7;r.position.set(0,Math.abs(Math.sin(l))*oo*.22,0),r.rotation.set(0,0,Math.sin(l*.5)*.3);for(const h of r.children){const c=h.userData.__side;c!==void 0&&(h.rotation.z=c*(.4+Math.sin(l)*.5))}}o.shed-=a,o.shed<=0&&(o.shed=i?.1+Math.random()*.08:.2+Math.random()*.14,Vh(t,t.position.x+(Math.random()-.5)*oo,t.position.y+oo*.3,t.position.z+(Math.random()-.5)*oo,-t.direction.x*.25+(Math.random()-.5)*.35,-t.direction.z*.25+(Math.random()-.5)*.35,1,.7))}const Ov=Re*.27;function Cv(t){const e=Xl(t.damage)*1.25,{x:a,y:o,z:n}=t.position,s=t.direction;Js(t,4,e*1.15);const i=Ov;for(let r=0;r<9;r++){const l=r/9*$e+Math.random()*.6,h=(1.9+Math.random()*1.2)*e;lo(t,a+Math.cos(l)*i,o,n+Math.sin(l)*i,Math.cos(l)*h+s.x*.5,1.5+Math.random()*1,Math.sin(l)*h+s.z*.5,1.2*e,.34)}for(let r=0;r<10;r++){const l=Math.random()*$e;Vh(t,a+Math.cos(l)*i,o+Re*.05,n+Math.sin(l)*i,Math.cos(l)*(.9+Math.random()*.8),Math.sin(l)*(.9+Math.random()*.8),e*1.25,.62)}}function Fv(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Cf(e,t,1.9);if(o.t+=o.rate*a,e.rotation.x=o.t,e.rotation.z=Math.sin(o.t*.7)*1,o.shed-=a,o.shed<=0){o.shed=.075+Math.random()*.05;const n=t.position.x-t.direction.x*ut,s=t.position.z-t.direction.z*ut;Math.random()<.45?Zs(t,n,t.position.y-ut*.3,s,-t.direction.x*.35+(Math.random()-.5)*.4,-.5-Math.random()*.4,-t.direction.z*.35+(Math.random()-.5)*.4,.6,.3):lo(t,n,t.position.y,s,-t.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-t.direction.z*.7+(Math.random()-.5)*.6,.7,.28)}}const Nv={Tackle:{impact(t){const e=Xl(t.damage),{x:a,y:o,z:n}=t.position,s=t.direction;Js(t,8,e),fp(t,e*.95,2.4*e,.42),up(t,7,e,.66);const i=Re*.26*e,r=.8;for(let l=0;l<5;l++){const h=l/5*$e+Math.random()*.7,c=(2+Math.random()*1.2)*e;jr(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.9+Math.random()*1.1,Math.sin(h)*c+s.z*r,e*1.15,.5+Math.random()*.12)}for(let l=0;l<6;l++){const h=l/6*$e+Math.random()*.8,c=(2.4+Math.random()*1.5)*e;Zs(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.4+Math.random()*1,Math.sin(h)*c+s.z*r,e,.4+Math.random()*.12)}for(let l=0;l<11;l++){const h=Math.random()*$e,c=(2.6+Math.random()*2)*e;lo(t,a+Math.cos(h)*i*.9,o,n+Math.sin(h)*i*.9,Math.cos(h)*c+s.x*r,1.7+Math.random()*1.7,Math.sin(h)*c+s.z*r,(.9+Math.random()*.6)*e,.4+Math.random()*.14)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position,s=Math.atan2(e.x,e.z);for(let i=0;i<4;i++){const r=(i-1.5)*.34,l=Math.sin(s+r),h=Math.cos(s+r),c=(i%2-.5)*.35,d=tn();d.color.set(i%2===0?Ki:So),d.opacity=1;const p=tn();p.color.set(Gh),p.opacity=1;const u=new S(xo,d),m=new S(xo,p);u.renderOrder=13,m.renderOrder=12;const f=new le;f.add(m,u),Xi(u,l,c,h),m.quaternion.copy(u.quaternion);const g=Af*.85;t.spawnTransient(f,.17,w=>{const b=1-Math.pow(1-w,2.2),y=Re*.1+b*Re*.1,v=Re*(.12+b*.22),k=y+v*.5;u.position.set(a+l*k,o+c*k*.5,n+h*k),m.position.copy(u.position),u.scale.set(v,g,g),m.scale.set(v*1.06,g*2.6,g*2.6);const E=w<.5?1:1-(w-.5)/.5;d.opacity=E,p.opacity=E})}for(let i=0;i<8;i++)lo(t,a,o,n,e.x*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.7+Math.random()*.7,e.z*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(let i=0;i<3;i++)jr(t,a,o,n,e.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.8+Math.random()*.5,e.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.9,.32)}},Hatch:{projectile(t){const e=Av(t.color);return e.position.copy(t.position),e},trail(t){Iv(t)},impact(t){Cv(t)},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position;Js(t,6,.62,.14),fp(t,.8,2,.4);for(let s=0;s<9;s++){const i=Math.random()*$e;Vh(t,a+Math.cos(i)*Re*.1,o+Re*.06,n+Math.sin(i)*Re*.1,Math.cos(i)*(.8+Math.random()*.9)+e.x*.5,Math.sin(i)*(.8+Math.random()*.9)+e.z*.5,1.1,.8)}for(let s=0;s<5;s++)lo(t,a,o,n,e.x*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.8+Math.random()*.6,e.z*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.85,.3)}},Shards:{projectile(t){const e=Rv(t.color);return e.position.copy(t.position),e},trail(t){Fv(t)},impact(t){const e=Xl(t.damage)*.9,{x:a,y:o,z:n}=t.position,s=t.direction;Js(t,5,e*.82,.12),up(t,5,e*.7,.6);const i=Re*.24*e,r=.7;for(let l=0;l<6;l++){const h=l/6*$e+Math.random()*.8,c=(2.2+Math.random()*1.4)*e;Zs(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.4+Math.random()*1,Math.sin(h)*c+s.z*r,e*1.1,.42+Math.random()*.12)}for(let l=0;l<7;l++){const h=l/7*$e+Math.random()*.9,c=(2.4+Math.random()*1.7)*e;lo(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.6+Math.random()*1.4,Math.sin(h)*c+s.z*r,(.85+Math.random()*.5)*e,.38+Math.random()*.12)}for(let l=0;l<2;l++){const h=Math.random()*$e;jr(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*2*e+s.x*r,1.7+Math.random()*.9,Math.sin(h)*2*e+s.z*r,e*.85,.44)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position,s=(t.weapon.spreadDeg??30)*Math.PI/360;for(let i=0;i<9;i++){const r=(Math.random()*2-1)*s,l=Math.cos(r),h=Math.sin(r),c=e.x*l-e.z*h,d=e.x*h+e.z*l,p=1.6+Math.random()*1.2;lo(t,a,o,n,c*p,.7+Math.random()*.6,d*p,.95,.32)}for(let i=0;i<3;i++){const r=(Math.random()*2-1)*s,l=Math.cos(r),h=Math.sin(r),c=e.x*l-e.z*h,d=e.x*h+e.z*l;Zs(t,a,o,n,c*1.6,.5+Math.random()*.4,d*1.6,.85,.3)}}}},qa="#E63946",ja="#FFFDF9",Ff="#00E5B0",Lv="#FFEAF1",Dv=.32,Hv=.34,mp=.36,_v=.33,Wr=.46;function ss(t){const e=document.createElement("canvas");return e.width=t,e.height=t,e.getContext("2d")}function is(t){const e=new st(t.canvas);return e.anisotropy=8,e.needsUpdate=!0,e}function zv(){const e=ss(512),a=512/2,o=a,n=5,s=1.15,i=Math.PI/n*.52,r=56;e.fillStyle="#ffffff";for(let h=0;h<n;h++){const c=h/n*Math.PI*2;e.beginPath();for(let d=0;d<=r;d++){const p=d/r*o,u=c+s*Math.PI*2*(p/o)-i,m=a+Math.cos(u)*p,f=a+Math.sin(u)*p;d===0?e.moveTo(m,f):e.lineTo(m,f)}for(let d=r;d>=0;d--){const p=d/r*o,u=c+s*Math.PI*2*(p/o)+i;e.lineTo(a+Math.cos(u)*p,a+Math.sin(u)*p)}e.closePath(),e.fill()}e.globalCompositeOperation="destination-out";const l=e.createRadialGradient(a,a,o*.9,a,a,o);return l.addColorStop(0,"rgba(0,0,0,0)"),l.addColorStop(1,"rgba(0,0,0,1)"),e.fillStyle=l,e.fillRect(0,0,512,512),e.globalCompositeOperation="source-over",is(e)}function Pv(){const e=ss(256),a=256/2,o=e.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0.62)"),o.addColorStop(.55,"rgba(255,255,255,0.58)"),o.addColorStop(.88,"rgba(255,255,255,0.8)"),o.addColorStop(.975,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=o,e.fillRect(0,0,256,256),is(e)}function $v(){const e=ss(512),a=512/2,o=a,n=o*.74;e.fillStyle="#ffffff",e.beginPath(),e.moveTo(a+o,a),e.arc(a,a,o,0,Math.PI*2,!1),e.moveTo(a+n,a),e.arc(a,a,n,0,Math.PI*2,!0),e.fill(),e.globalCompositeOperation="destination-out";const s=40;e.fillStyle="rgba(0,0,0,0.5)";for(let l=0;l<s;l++){const h=l/s*Math.PI*2,c=h+Math.PI/s;e.beginPath(),e.moveTo(a,a),e.arc(a,a,o,h,c),e.closePath(),e.fill()}const i=e.createRadialGradient(a,a,o*.96,a,a,o);i.addColorStop(0,"rgba(0,0,0,0)"),i.addColorStop(1,"rgba(0,0,0,1)"),e.fillStyle=i,e.fillRect(0,0,512,512);const r=e.createRadialGradient(a,a,n,a,a,n*1.22);return r.addColorStop(0,"rgba(0,0,0,1)"),r.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=r,e.fillRect(0,0,512,512),e.globalCompositeOperation="source-over",is(e)}function Bv(){const e=ss(512),a=512/2,o=e.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0)"),o.addColorStop(.966,"rgba(255,255,255,0)"),o.addColorStop(.976,"rgba(255,255,255,1)"),o.addColorStop(.991,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=o,e.fillRect(0,0,512,512),is(e)}function Uv(){const e=ss(64),a=64/2,o=e.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.35,"rgba(255,255,255,0.8)"),o.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=o,e.fillRect(0,0,64,64),is(e)}const rs=zv(),Kh=Pv(),qv=$v(),Xh=Bv(),Zi=Uv(),Mt=new Eo(1,96);Mt.rotateX(-Math.PI/2);const jv=new Ae(1,1,.34,12),Nf=new Ae(1,1,.22,44),Lf=new Ae(.055,.055,1,10);function _e(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Wv=_e(3,()=>new K({map:Kh,color:qa,transparent:!0,opacity:.6,depthWrite:!1})),Gv=_e(2,()=>new K({map:rs,color:ja,transparent:!0,opacity:.5,depthWrite:!1})),Yv=_e(2,()=>new K({map:rs,color:qa,transparent:!0,opacity:.9,depthWrite:!1})),Vv=_e(6,()=>new K({map:rs,color:ja,transparent:!0,opacity:.9,depthWrite:!1})),Kv=_e(3,()=>new K({map:qv,color:ja,transparent:!0,opacity:1,depthWrite:!1,blending:ot})),Df=_e(4,()=>new K({map:Xh,color:qa,transparent:!0,opacity:1,depthWrite:!1})),Xv=_e(2,()=>new K({map:Xh,color:ja,transparent:!0,opacity:1,depthWrite:!1})),Zv=_e(10,()=>new K({map:rs,color:qa,transparent:!0,opacity:.9,depthWrite:!1})),Jv=_e(14,()=>new K({color:qa,transparent:!0,opacity:1})),Qv=_e(14,()=>new K({color:ja,transparent:!0,opacity:1})),ek=_e(24,()=>new Pt({map:Zi,color:Lv,transparent:!0,opacity:1,depthWrite:!1,blending:ot})),tk=_e(12,()=>new Pt({map:Zi,color:Ff,transparent:!0,opacity:1,depthWrite:!1,blending:ot})),ak=_e(12,()=>new Pt({map:Zi,color:qa,transparent:!0,opacity:1,depthWrite:!1})),ok=_e(5,()=>new Pt({map:Zi,color:Ff,transparent:!0,opacity:1,depthWrite:!1})),nk=_e(2,()=>new K({color:ja,transparent:!0,opacity:1})),sk=_e(2,()=>new K({color:"#FBF7EE",transparent:!0,opacity:1}));function gp(t,e,a,o,n,s){const i=Zv(),r=new S(Mt,i);r.position.set(e,_v,a),r.rotation.y=Math.random()*Math.PI*2,r.renderOrder=12;const l=(Math.random()<.5?-1:1)*(2.4+Math.random()*1.2),h=r.rotation.y;r.scale.setScalar(o*.35),t.spawnTransient(r,n,c=>{const d=1-Math.pow(1-Math.min(1,c*3.2),3);r.scale.setScalar(o*(.35+.65*d)),r.rotation.y=h+l*c*.35,i.opacity=s*(1-Math.pow(c,1.6))})}function wp(t,e,a,o,n,s,i){const r=Math.random()<.45?Jv():Qv(),l=new S(jv,r);l.scale.setScalar(s),l.position.set(e.x,e.y,e.z),l.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);const h=e.x,c=e.y,d=e.z,p=1.5+Math.random()*1.9,u=-9.4,m=(Math.random()-.5)*16,f=(Math.random()-.5)*16;t.spawnTransient(l,i,(g,w)=>{l.position.set(h+a*n*w,Math.max(.08,c+p*w+.5*u*w*w),d+o*n*w),l.rotation.x+=m*.016,l.rotation.z+=f*.016,r.opacity=1-Math.pow(g,2.2)})}function Qa(t,e,a,o,n,s,i,r,l=ek,h=0){const c=l(),d=new Oa(c);d.position.set(e,a,o),d.scale.set(n,n,1),d.renderOrder=14,d.visible=h<=0;const p=(Math.random()-.5)*.5;t.spawnTransient(d,i+h,(u,m)=>{if(m<h){d.visible=!1;return}d.visible=!0;const f=Math.min(1,(m-h)/i),g=V.lerp(n,s,f);d.scale.set(g,g,1),d.position.y=a+r*f,d.position.x=e+p*f,c.opacity=1-Math.pow(f,1.5)})}function ik(t,e,a,o,n){const s=ee*.85,i=ee*1.7,r=new le,l=Math.hypot(o,n)||1,h=s+ee*.5;r.position.set(e+o/l*h,0,a+n/l*h);const c=Df(),d=new S(Mt,c);d.scale.setScalar(s*1.16),d.position.y=.115,d.renderOrder=12,r.add(d);const p=nk(),u=new S(Nf,p);u.scale.set(s,1,s),r.add(u);const m=Yv(),f=new S(Mt,m);f.scale.setScalar(s*.99),f.position.y=.13,f.renderOrder=13,r.add(f);const g=sk(),w=new S(Lf,g);w.scale.set(1,i,1);const b=new fe(-o,0,-n);b.lengthSq()<1e-6&&b.set(0,0,-1),b.normalize(),w.quaternion.setFromUnitVectors(new fe(0,1,0),b),w.position.set(b.x*(s+i*.5)*.92,.05,b.z*(s+i*.5)*.92),r.add(w);const y=5.2,v=.09;t.spawnTransient(r,.75,(E,x)=>{if(x<v){const R=x/v;r.position.y=y*(1-R*R),r.scale.set(1,1,1)}else{const R=Math.min(1,(x-v)/.16);r.position.y=0;const T=1-.55*(1-R)*Math.cos(R*Math.PI*1.2);r.scale.set(1+(1-T)*.22,Math.max(.25,T),1+(1-T)*.22)}const M=E<.45?1:1-(E-.45)/.55;p.opacity=M,g.opacity=M,m.opacity=.9*M,c.opacity=M})}const no=ee*.85,Ds=no+ee*.5,bp=ee*1.7,rk="#3C0F12",lk="#EC656F",hk="#F5B0B5",ck=_e(2,()=>new K({map:Kh,color:rk,transparent:!0,opacity:0,depthWrite:!1})),dk=_e(2,()=>new K({map:Kh,color:lk,transparent:!0,opacity:0,depthWrite:!1})),pk=_e(2,()=>new K({map:Xh,color:hk,transparent:!0,opacity:0,depthWrite:!1})),uk=_e(2,()=>new K({color:ja,transparent:!0,opacity:1,depthWrite:!1})),fk=_e(2,()=>new K({map:rs,color:qa,transparent:!0,opacity:.95,depthWrite:!1})),mk=_e(2,()=>new K({color:"#FBF7EE",transparent:!0,opacity:1,depthWrite:!1})),gk={Smash:{cast(t){const e=t.direction.x,a=t.direction.z,o=t.position.x-e*.75,n=t.position.z-a*.75,s=Math.atan2(a,e),i=ee*1.15,r=V.degToRad((t.weapon.cone??80)/2),l=ee*.34;for(let h=0;h<2;h++){const c=h*.05,d=Vv();d.color.set(h===0?ja:qa);const p=new S(Mt,d);p.scale.setScalar(l*(1-h*.16)),p.renderOrder=13;const u=h===0?.95:.42;t.spawnTransient(p,.2,m=>{const f=V.clamp((m*.2-c)/.2,0,1),g=1-Math.pow(1-f,2),w=s-r+g*r*2;p.position.set(o+Math.cos(w)*i,V.lerp(ee*.8,.4,g),n+Math.sin(w)*i),p.rotation.y=w*1.6,d.opacity=u*(f<=0?0:1-Math.pow(m,2.4))})}for(let h=0;h<2;h++){const c=s+(Math.random()-.5)*r*1.4;Qa(t,o+Math.cos(c)*i*1.05,ee*.5,n+Math.sin(c)*i*1.05,ee*.13,ee*.03,.2,.25)}},impact(t){const{x:e,z:a}=t.position,o=V.clamp(.85+t.damage*.03,.85,1.6);Qa(t,e,t.position.y,a,ee*.3*o,ee*.6*o,.15,.1),gp(t,e,a,ee*.32*o,.5,.85);const n=6;for(let s=0;s<n;s++){const i=s/n*Math.PI*2+Math.random()*.7;wp(t,{x:e,y:t.position.y*.8,z:a},Math.cos(i),Math.sin(i),(1.7+Math.random()*1.9)*o,ee*(.065+Math.random()*.03),.42+Math.random()*.18)}for(let s=0;s<3;s++){const i=Math.random()*Math.PI*2;Qa(t,e+Math.cos(i)*.3,t.position.y+.1,a+Math.sin(i)*.3,ee*.14,ee*.04,.34,.5)}}},Giant:{cast(t){const{x:e,z:a}=t.position,o=et(t.weapon.range??0),n=Wv(),s=new S(Mt,n);s.position.set(e,Dv,a),s.renderOrder=10,s.scale.setScalar(o*.12),t.spawnTransient(s,1,u=>{const m=1-Math.pow(1-Math.min(1,u/.26),3);s.scale.setScalar(o*(.12+.88*m)),n.opacity=.3*(u<.2?1:Math.pow(1-(u-.2)/.8,1.5))});for(const[u,m,f,g]of[[Df(),1,.95,16],[Xv(),.974,.9,17]]){const w=new S(Mt,u);w.position.set(e,mp+.01,a),w.renderOrder=g,w.scale.setScalar(o*.12*m),t.spawnTransient(w,1,b=>{const y=1-Math.pow(1-Math.min(1,b/.26),3);w.scale.setScalar(o*(.12+.88*y)*m),u.opacity=f*(b<.42?1:Math.pow(1-(b-.42)/.58,1.4))})}const i=Gv(),r=new S(Mt,i);r.position.set(e,Hv,a),r.renderOrder=11,r.scale.setScalar(o*.12),t.spawnTransient(r,1,u=>{const m=1-Math.pow(1-Math.min(1,u/.26),3);r.scale.setScalar(o*(.12+.88*m)),r.rotation.y=(1-Math.pow(1-u,2))*1.5,i.opacity=.4*(u<.22?1:Math.pow(1-(u-.22)/.78,1.5))});const l=Kv(),h=new S(Mt,l);h.position.set(e,mp,a),h.renderOrder=15,h.scale.setScalar(o*.05),t.spawnTransient(h,Wr+.22,(u,m)=>{const f=Math.min(1,m/Wr),g=1-Math.pow(1-f,2.2);h.scale.setScalar(o*(.05+.98*g)),h.rotation.y=g*.5,l.opacity=.95*(1-Math.pow(u,2.4))});const c=10,d=.55,p=Math.PI*(3-Math.sqrt(5));for(let u=0;u<c;u++){const m=o*d*Math.sqrt((u+.6)/c),f=u*p,g=e+Math.cos(f)*m,w=a+Math.sin(f)*m,b=m/o*Wr;Qa(t,g,.55,w,ee*.2,ee*.68,.3,.55,ak,b),u%3===0&&Qa(t,g,.5,w,ee*.12,ee*.34,.34,.7,ok,b+.03)}ik(t,e,a,t.direction.x,t.direction.z)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1500)/1e3),o=new e.Group;o.name="teleLolliRoot";const n=t.position.clone();n.y-=ee*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=ck(),i=new e.Mesh(Mt,s);i.name="teleLolliBase",i.scale.setScalar(no),i.position.set(0,.02,Ds),i.renderOrder=5,o.add(i);const r=dk(),l=new e.Mesh(Mt,r);l.name="teleLolliFill",l.position.set(0,.032,Ds),l.renderOrder=5.01,o.add(l);const h=pk(),c=new e.Mesh(Mt,h);c.name="teleLolliRim",c.scale.setScalar(no*1.06),c.position.set(0,.044,Ds),c.renderOrder=5.02,o.add(c);const d=new e.Group;d.name="teleLolliCandy",o.add(d);const p=uk(),u=new e.Mesh(Nf,p);u.name="teleLolliHead",u.scale.set(no,1,no),d.add(u);const m=fk(),f=new e.Mesh(Mt,m);f.name="teleLolliSwirl",f.scale.setScalar(no*.99),f.position.y=.13,f.renderOrder=13,d.add(f);const g=mk(),w=new e.Mesh(Lf,g);w.name="teleLolliStick",w.scale.set(1,bp,1),w.rotation.x=-Math.PI/2,w.position.z=-3.57*.92,d.add(w);const b=(v,k,E)=>{const x=e.MathUtils.clamp((v-k)/(E-k),0,1);return x*x*(3-2*x)},y=(v,k)=>{const E=e.MathUtils.clamp(k/a,0,1),x=b(E,0,.78),M=b(E,.78,1),R=.5+.5*Math.sin(Math.PI*2*(2*E+3*E*E));s.opacity=.6+.14*R;const T=no*(.12+.88*E);l.scale.setScalar(T),r.opacity=.7+.22*E,h.opacity=.62+.36*E*E;const N=.28+.72*x;d.scale.setScalar(N),d.position.set(0,ee*(.55+1.05*x+.55*M),Ds*(.35+.65*x)-bp*.1*M),d.rotation.y=E*(2.2+5.5*E),d.rotation.x=-.55*M;const I=.85+.15*R;p.opacity=I,g.opacity=I,m.opacity=.95*I};y(0,0),t.spawnTransient(o,a+.06,y)},impact(t){const{x:e,z:a}=t.position,o=V.clamp(.9+t.damage*.035,.9,1.7);Qa(t,e,t.position.y,a,ee*.34*o,ee*.62*o,.18,.12),gp(t,e,a,ee*.42*o,.62,.9);const n=8;for(let s=0;s<n;s++){const i=s/n*Math.PI*2+Math.random()*.6;wp(t,{x:e,y:t.position.y*.85,z:a},Math.cos(i),Math.sin(i),(2.1+Math.random()*2.2)*o,ee*(.07+Math.random()*.035),.48+Math.random()*.2)}for(let s=0;s<4;s++){const i=s/4*Math.PI*2+Math.random();Qa(t,e+Math.cos(i)*.34,t.position.y+.15,a+Math.sin(i)*.34,ee*.11,ee*.04,.42,.85,tk)}}}},wk="#EFB868",bk="#CE8A2E",Hf="#4A2A12",yk="#B93A28",Hn="#F7ECD3",ke=ee,mt=Math.PI*2,Ji=.26;function Ao(t,e=10){const a=new ph(t,e);return a.rotateX(-Math.PI/2),a}function Zh(t,e){const a=Math.tan(e)*t,o=-t*.58,n=t*.42,s=new Ua;return s.moveTo(0,o),s.lineTo(-a,n),s.quadraticCurveTo(0,n+a*.5,a,n),s.closePath(),s}function xk(t){const e=new Ua;return e.moveTo(0,t),e.quadraticCurveTo(t*.82,t*.78,t*.96,-t*.06),e.quadraticCurveTo(t*.7,-t*.72,0,-t),e.quadraticCurveTo(-t*.84,-t*.66,-t,t*.04),e.quadraticCurveTo(-t*.7,t*.8,0,t),e}function _f(t,e,a=22){const o=new Ua;for(let n=0;n<=a;n++){const s=n/a*mt,i=1+Math.sin(s*3+t)*.17+Math.sin(s*5+e)*.11,r=Math.cos(s)*i,l=Math.sin(s)*i;n===0?o.moveTo(r,l):o.lineTo(r,l)}return o}function vk(t){const e=new Ua;return e.moveTo(-t,0),e.lineTo(t,0),e.lineTo(0,1),e.closePath(),e}const Wo=ke*.3,_n=ke*.16,Qs=ke*.18,yp=Ao(Zh(Wo,.44),8),ei=Ao(xk(Qs),8),Jh=(()=>{const t=new Eo(1,12);return t.rotateX(-Math.PI/2),t})(),xp=(()=>{const t=new Eo(_n,20);t.rotateX(-Math.PI/2);const e=t.attributes.position;for(let a=1;a<e.count;a++){const o=e.getX(a),n=e.getZ(a),s=Math.atan2(n,o),i=1+Math.sin(s*3)*.13+Math.sin(s*7+1.3)*.075;e.setX(a,o*i),e.setZ(a,n*i)}return e.needsUpdate=!0,t})(),vp=Ao(Zh(ke*.105,.52),4),zf=Ao(Zh(1,.62),3),Pf=Ao(_f(0,2.1),1),kk=Ao(_f(1.7,4.3),1),Mk=Ao(vk(.16),1),$f=(()=>{const t=new Da(.62,1,18,1,0,Math.PI*.8);return t.rotateX(-Math.PI/2),t})(),Ek=(()=>{const t=new Eo(ke*.032,6);return t.rotateX(-Math.PI/2),t})(),Tk=(()=>{const t=new gt(ke*.022,1,ke*.022);return t.translate(0,-.5,0),t})();function Ro(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Wa=t=>new K({color:t,side:be}),kp=Wa("#F6E3B4"),Mp=Wa("#E63946"),Ep=Wa("#FFD873"),Sk=Wa(wk),Bf=Wa(bk),Ak=Wa(yk),Rk=Wa(Hn),Ik=Wa(Hf),Ok=Ro(20,()=>new K({color:"#E63946",transparent:!0,opacity:1,side:be,depthWrite:!1})),Uf=Ro(24,()=>new K({color:Hf,transparent:!0,opacity:1,side:be,depthWrite:!1})),qf=Ro(10,()=>new K({color:"#B62430",transparent:!0,opacity:.9,side:be,depthWrite:!1})),Ck=Ro(28,()=>new K({color:Hn,transparent:!0,opacity:.9,side:be,depthWrite:!1})),jf=Ro(8,()=>new K({color:"#FFE9A8",transparent:!0,opacity:.9,side:be,blending:ot,depthWrite:!1})),Wf=Ro(16,()=>new K({color:"#FFD9A0",transparent:!0,opacity:.5,side:be,blending:ot,depthWrite:!1})),Gr=Ro(12,()=>new K({color:"#FFD873",transparent:!0,opacity:.95,side:be,depthWrite:!1})),Fk=new fe(0,1,0),Tp=new fe,Sp=new fe,Yr=new Di,Ap=new Di;function Ho(t,e,a,o){Yr.setFromAxisAngle(Fk,a);const n=Math.hypot(e.x,e.z);Math.abs(o)>1e-4&&n>1e-4?(Tp.set(e.z/n,0,-e.x/n),Ap.setFromAxisAngle(Tp,o),t.quaternion.copy(Ap).multiply(Yr)):t.quaternion.copy(Yr)}function Qh(t,e,a){const o=new le,n=new S(t,Ik);return n.scale.set(a,1,a),n.position.y=-ke*.011,o.add(n),o.add(new S(t,e)),o}function Nk(t){return t.range&&t.speed?t.range/t.speed:Mo.normal/1e3}function Vr(t,e,a){let o=t.userData.__spin;return o||(o={spin:Math.random()*mt,rate:a*mt/Nk(e),shed:0},t.userData.__spin=o),o}function Rp(t,e,a,o){const n=Wf();n.color.set(o),n.opacity=.45;const s=new S($f,n);s.renderOrder=9,s.position.copy(t.position),s.rotation.y=a,s.scale.set(e,1,e),t.spawnTransient(s,.13,i=>{const r=e*(1+i*.28);s.scale.set(r,1,r),n.opacity=.45*(1-i)})}function Sa(t,e,a,o,n,s,i,r,l){const h=Ck();h.color.set(a),h.opacity=.9;const c=new S(Ek,h);c.renderOrder=9,c.position.copy(e),c.scale.setScalar(r);const d=e.x,p=e.y,u=e.z;t.spawnTransient(c,l,(m,f)=>{c.position.set(d+o*f,Math.max(Ji,p+n*f+.5*i*f*f),u+s*f),h.opacity=.9*(1-m*m)})}function Kr(t,e,a,o,n,s,i){const r=new le,l=Uf();l.opacity=1;const h=new S(vp,l);h.scale.set(1.22,1,1.22),h.position.y=-ke*.008,r.add(h);const c=Ok();c.color.set(a),c.opacity=1,r.add(new S(vp,c)),r.renderOrder=9,r.position.copy(e),r.scale.setScalar(s);const d=e.x,p=e.y,u=e.z,m=Math.cos(o),f=Math.sin(o),g=m*n,w=f*n,b=.8+Math.random()*.9,y=-7.5,v=Math.random()*mt,k=(Math.random()-.5)*24;t.spawnTransient(r,i,(E,x)=>{r.position.set(d+g*x,Math.max(Ji,p+b*x+.5*y*x*x),u+w*x),Sp.set(m,0,f),Ho(r,Sp,v+k*x,.22);const M=1-Math.pow(E,2.2);c.opacity=M,l.opacity=M})}function Lk(t,e,a,o,n,s){const i=new le;i.position.set(t.position.x,Ji,t.position.z),i.renderOrder=4;const r=qf();r.color.set(e),r.opacity=s;const l=new S(Math.random()<.5?Pf:kk,r);l.rotation.y=Math.random()*mt,i.add(l);for(let h=0;h<o;h++){const c=new S(Mk,r);c.rotation.y=h/o*mt+Math.random()*.7,c.scale.set(.7+Math.random()*.4,1,1+Math.random()*.4),i.add(c)}t.spawnTransient(i,n,h=>{const c=1-Math.pow(1-Math.min(1,h*5),3);i.scale.set(a*c,1,a*c),r.opacity=s*(h<.55?1:1-(h-.55)/.45)})}function Xr(t,e,a,o){const n=jf();n.color.set(e),n.opacity=.9;const s=new S(zf,n);s.renderOrder=11,s.position.copy(t.position),s.rotation.y=Math.random()*mt,s.scale.set(a*.35,1,a*.35),t.spawnTransient(s,o,i=>{const r=V.lerp(a*.35,a,1-Math.pow(1-i,2));s.scale.set(r,1,r),n.opacity=.9*(1-i)})}function Zr(t){return V.clamp(.85+t*.035,.85,1.4)}function Dk(t){const e=Qh(yp,Sk,1.15);Mp.color.set(t);const a=new S(yp,Mp);a.scale.set(.86,1,.86),a.position.set(0,ke*.006,Wo*.04),e.add(a);for(const[o,n,s]of[[-.2,-.1,.075],[.15,.11,.06]]){const i=new S(Jh,Ak);i.position.set(Wo*o,ke*.012,Wo*n),i.scale.setScalar(Wo*s*2),e.add(i)}return e}function Hk(t){const e=Qh(xp,Bf,1.13);kp.color.set(t);const a=new S(xp,kp);a.scale.set(.84,1,.84),a.position.y=ke*.006,e.add(a);const o=new S(Jh,Rk);return o.scale.setScalar(_n*.44),o.position.set(_n*.4,ke*.011,-_n*.26),e.add(o),e}function _k(t){Ep.color.set(t);const e=Qh(ei,Ep,1.12),a=new S(Jh,Bf);return a.scale.setScalar(Qs*.22),a.position.set(Qs*.34,ke*.006,Qs*.2),e.add(a),e}const zk={Dough:{projectile(t){const e=Hk(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Vr(e,t.weapon,2.6);o.spin+=o.rate*a,Ho(e,t.direction,o.spin,.15+Math.sin(o.spin*.37)*.07),e.position.y+=Math.sin(o.spin*.5)*ke*.012,o.shed-=a,o.shed<=0&&(o.shed=.055+Math.random()*.04,Sa(t,t.position,Hn,-t.direction.x*.5+(Math.random()-.5)*.5,.25+Math.random()*.4,-t.direction.z*.5+(Math.random()-.5)*.5,-1.1,.5+Math.random()*.35,.3+Math.random()*.15),Math.random()<.45&&Rp(t,_n*1.2,o.spin,"#FFF0CC"))},impact(t){const e=Zr(t.damage),a=qf();a.color.set("#F0DDAE"),a.opacity=.95;const o=new S(Pf,a);o.renderOrder=4,o.position.set(t.position.x,Ji,t.position.z),o.rotation.y=Math.random()*mt;const n=ke*.25*e;t.spawnTransient(o,.62,s=>{const i=V.lerp(n*.3,n,1-Math.pow(1-Math.min(1,s*4),3));o.scale.set(i,1,i),a.opacity=.95*(s<.5?1:1-(s-.5)/.5)}),Xr(t,"#FFF3D2",ke*.3*e,.18);for(let s=0;s<10;s++){const i=s/10*mt+Math.random()*.5,r=(.9+Math.random()*1.2)*e;Sa(t,t.position,Hn,Math.cos(i)*r,.7+Math.random()*.9,Math.sin(i)*r,-2.4,.6+Math.random()*.6,.45+Math.random()*.25)}for(let s=0;s<4;s++)Kr(t,t.position,"#EFD9A6",Math.random()*mt,(1.9+Math.random()*1.3)*e,(.55+Math.random()*.35)*e,.4+Math.random()*.14)},cast(t){const e=Wf();e.color.set("#FFF0CC"),e.opacity=.6;const a=new S($f,e);a.renderOrder=11,a.position.copy(t.position),t.spawnTransient(a,.16,o=>{const n=V.lerp(ke*.05,ke*.16,o);a.scale.set(n,1,n),a.rotation.y=o*9,e.opacity=.6*(1-o)});for(let o=0;o<5;o++)Sa(t,t.position,Hn,t.direction.x*(.5+Math.random()*.6)+(Math.random()-.5)*.6,.5+Math.random()*.5,t.direction.z*(.5+Math.random()*.6)+(Math.random()-.5)*.6,-1.6,.55+Math.random()*.4,.3+Math.random()*.15)}},Tomato:{projectile(t){const e=Dk(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Vr(e,t.weapon,1.8);o.spin+=o.rate*a,Ho(e,t.direction,o.spin,.17+Math.sin(o.spin*.5)*.06),o.shed-=a,o.shed<=0&&(o.shed=.058,Rp(t,Wo*.62,o.spin,"#FFC08A"),Math.random()<.5&&Sa(t,t.position,"#C4262F",-t.direction.x*.7+(Math.random()-.5)*.4,.15+Math.random()*.3,-t.direction.z*.7+(Math.random()-.5)*.4,-2.2,.5+Math.random()*.3,.26))},impact(t){const e=Zr(t.damage);Xr(t,"#FFE7CC",ke*.4*e,.18),Lk(t,t.color,ke*.22*e,4,.55,.9);for(let a=0;a<5;a++){const o=a/5*mt+Math.random()*.6;Kr(t,t.position,t.color,o,(2.2+Math.random()*1.4)*e,(.75+Math.random()*.45)*e,.4+Math.random()*.14)}for(let a=0;a<6;a++){const o=Math.random()*mt,n=(1.3+Math.random()*1.5)*e;Sa(t,t.position,"#C4262F",Math.cos(o)*n,1+Math.random()*1.1,Math.sin(o)*n,-6.5,.7+Math.random()*.5,.34+Math.random()*.14)}},cast(t){const e=jf();e.color.set("#FF8E6A"),e.opacity=.85;const a=new S(zf,e);a.renderOrder=11,a.position.copy(t.position),a.rotation.y=Math.atan2(t.direction.x,t.direction.z),t.spawnTransient(a,.15,o=>{const n=V.lerp(ke*.08,ke*.24,1-Math.pow(1-o,2));a.scale.set(n*.7,1,n),e.opacity=.85*(1-o)});for(let o=0;o<3;o++)Sa(t,t.position,"#C4262F",t.direction.x*(1+Math.random())+(Math.random()-.5)*.5,.4+Math.random()*.4,t.direction.z*(1+Math.random())+(Math.random()-.5)*.5,-2.6,.6,.28)}},Cheese:{projectile(t){const e=_k(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Vr(e,t.weapon,.9);o.spin+=o.rate*a,Ho(e,t.direction,o.spin,.2*Math.sin(o.spin*1.9));const n=1+Math.sin(o.spin*2.4)*.22;e.scale.set(1/n,1,n),e.position.y+=Math.sin(o.spin*1.2)*ke*.016,o.shed-=a,o.shed<=0&&(o.shed=.13+Math.random()*.07,Sa(t,t.position,"#FFE49A",-t.direction.x*.4,-.1,-t.direction.z*.4,-1.6,.5,.24))},impact(t){const e=Zr(t.damage),a=ke*.96,o=Gr();o.color.set(t.color),o.opacity=.95;const n=new S(ei,o);n.renderOrder=11;const s=Uf();s.opacity=.6;const i=new S(ei,s);i.scale.set(1.12,1,1.12),i.position.y=-ke*.008,n.add(i),n.position.set(t.position.x,a,t.position.z);const r=1.8*e;t.spawnTransient(n,.5,l=>{const h=V.lerp(r*.4,r,1-Math.pow(1-Math.min(1,l*3.5),3));n.scale.set(h,1,h*(1-l*.25)),n.position.y=a-l*l*ke*.34,Ho(n,t.direction,l*1.2,.35+l*.5);const c=l<.6?1:1-(l-.6)/.4;o.opacity=.95*c,s.opacity=.6*c}),Xr(t,"#FFF6D8",ke*.26*e,.17);for(let l=0;l<4;l++){const h=Gr();h.color.set("#FFE08A"),h.opacity=.9;const c=new S(Tk,h);c.renderOrder=10;const d=Math.random()*mt,p=ke*(.06+Math.random()*.08)*e;c.position.set(t.position.x+Math.cos(d)*p,a-ke*.04,t.position.z+Math.sin(d)*p);const u=ke*(.14+Math.random()*.12)*e;t.spawnTransient(c,.42,m=>{c.scale.set(1-m*.55,u*(.3+m*.7),1-m*.55),h.opacity=.9*(1-m*m)})}for(let l=0;l<3;l++)Kr(t,t.position,"#FFD873",Math.random()*mt,(1+Math.random())*e,(.55+Math.random()*.3)*e,.38)},cast(t){const e=Gr();e.color.set(t.color),e.opacity=.85;const a=new S(ei,e);a.renderOrder=11,a.position.copy(t.position),t.spawnTransient(a,.16,o=>{const n=V.lerp(.3,.85,1-Math.pow(1-o,2));a.scale.set(n*(.5+o*.6),1,n),Ho(a,t.direction,o*2.4,.3-o*.25),e.opacity=.85*(1-o)});for(let o=0;o<3;o++)Sa(t,t.position,"#FFE49A",t.direction.x*(.6+Math.random()*.5),.35+Math.random()*.3,t.direction.z*(.6+Math.random()*.5),-2,.55,.26)}}},an="#FFFDF6",Gf="#E4D7BE",za="#22301F",Pk="#3E5B33",ec=ea.salmon,tc="#B85B26",Yf="#FFEEDD",Vf="#F2FBFF",Kf="#8FD3E8",J=ee,Rt=Math.PI*2,Bt=.29;function Xf(t,e=8){const a=new ph(t,e);return a.rotateX(-Math.PI/2),a}const Ut=(()=>{const t=new wo(1,1);return t.rotateX(-Math.PI/2),t})(),Ip=(()=>{const t=new Ua;t.moveTo(0,0),t.quadraticCurveTo(1,.5,0,1),t.quadraticCurveTo(-1,.5,0,0);const e=Xf(t,10);return e.translate(0,0,1),e})(),Op=(()=>{const e=new Ua;return e.moveTo(-.5+.22,-.5),e.lineTo(.5-.22,-.5),e.quadraticCurveTo(.5,-.5,.5,-.5+.22),e.lineTo(.5,.5-.22),e.quadraticCurveTo(.5,.5,.5-.22,.5),e.lineTo(-.5+.22,.5),e.quadraticCurveTo(-.5,.5,-.5,.5-.22),e.lineTo(-.5,-.5+.22),e.quadraticCurveTo(-.5,-.5,-.5+.22,-.5),Xf(e,6)})(),ac=(()=>{const t=new ct(.5,7,5);return t.scale(.44,.44,1),t})(),$k=new Ae(.5,.5,1,20,1,!0),Jr=(()=>{const t=new Eo(.5,20);return t.rotateX(-Math.PI/2),t})(),Bk=new Ae(.5,.5,1,12,1,!0,0,Math.PI),Cp=(()=>{const t=new Eo(.5,12,-Math.PI/2,Math.PI);return t.rotateX(-Math.PI/2),t})(),Uk=(()=>{const t=new wo(1,1);return t.rotateY(-Math.PI/2),t})(),Et=J*.155,Zf=J*.46,ti=J*.3,Kt=J*.185,Hs=J*.2;function Yt(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const ls=t=>new K({color:t,side:be}),Jf=ls(an),qk=ls(Gf),Qf=ls(za),jk=ls(tc),Fp=new Map;function oc(t){let e=Fp.get(t);return e||(e=ls(t),Fp.set(t,e)),e}const Ga=(t,e)=>new K({color:t,transparent:!0,opacity:e,side:be,depthWrite:!1}),em=(t,e)=>new K({color:t,transparent:!0,opacity:e,side:be,depthWrite:!1,depthTest:!1}),tm=Yt(56,()=>new K({color:an,transparent:!0,opacity:1,depthWrite:!1})),Wk=Yt(12,()=>em(Vf,1)),Gk=Yt(12,()=>em(Kf,.5)),xi=Yt(28,()=>Ga(za,1)),vi=Yt(28,()=>Ga(Pk,1)),Yk=Yt(24,()=>Ga(ec,1)),Vk=Yt(24,()=>Ga(tc,1)),Kk=Yt(24,()=>Ga(Yf,1)),Xk=Yt(12,()=>Ga(za,1)),Zk=Yt(12,()=>Ga(an,1)),Jk=Yt(12,()=>Ga(ec,1));function Xt(t,e){return Math.atan2(t,e)}function Qk(t,e=.62){const a=Math.sin(t),o=Math.cos(t);if(Math.abs(a)>=e)return t;const n=a>=0?1:-1,s=o>=0?1:-1;return Math.atan2(n*e,s*Math.sqrt(1-e*e))}function Qr(t){return t.range&&t.speed?t.range/t.speed:Mo.normal/1e3}function _s(t){return V.clamp(.85+t*.035,.85,1.4)}function el(t){let e=t.userData.__sushi;return e||(e={phase:Math.random()*Rt,shed:0,grow:0},t.userData.__sushi=e),e}function zs(t,e,a,o,n,s,i,r){const l=new le,h=Qk(n);l.rotation.y=h,l.position.set(e-Math.sin(h)*s*.5,a,o-Math.cos(h)*s*.5),l.renderOrder=13;const c=Gk();c.color.set(Kf),c.opacity=.55;const d=new S(Ip,c);d.scale.set(2.9,1,1.02),d.position.y=-J*.006,d.renderOrder=0,l.add(d);const p=Wk();p.color.set(Vf),p.opacity=1;const u=new S(Ip,p);u.renderOrder=1,l.add(u),t.spawnTransient(l,r,m=>{const f=Math.min(1,m*8);l.scale.set(i*(1-m*.55),1,Math.max(.02,s*f));const g=m<.3?1:1-(m-.3)/.7;p.opacity=g,c.opacity=.55*g*g})}function eo(t,e,a,o,n,s,i,r,l,h=!1){const c=tm();c.color.set(h?Gf:an),c.opacity=1;const d=new S(ac,c);d.renderOrder=9,d.scale.setScalar(r),d.position.set(e,a,o);const p=-9.6,u=(Math.random()-.5)*14,m=(Math.random()-.5)*14;t.spawnTransient(d,l,(f,g)=>{let w=a+s*g+.5*p*g*g,b=1;if(w<Bt){const y=Bt-w;w=Bt+y*.28,b=.35,w<Bt&&(w=Bt)}d.position.set(e+n*g,w,o+i*g*1),d.rotation.set(u*g*b,m*g*b,0),c.opacity=1-f*f*f})}function e5(t,e,a){const o=new le,n=new S(Op,a.deep);n.scale.set(t*1.16,1,e*1.1),n.position.y=-J*.008,o.add(n);const s=new S(Op,a.face);s.scale.set(t,1,e),o.add(s);for(let i=0;i<2;i++){const r=new S(Ut,a.fat);r.scale.set(t*.86,1,e*.09),r.position.set(0,J*.005,e*(i===0?-.18:.16)),o.add(r)}return o}function Np(t,e,a){const o=new le,n=new S(Bk,a.wall);n.scale.set(t*2,e,t*2),o.add(n);const s=new S(Cp,a.face);s.scale.set(t*1.6,1,t*1.6),s.position.y=e*.5,o.add(s);const i=new S(Cp,a.core);i.scale.set(t*.94,1,t*.94),i.position.y=e*.5+J*.004,o.add(i);const r=new S(Uk,a.face);return r.scale.set(1,e*.98,t*1.96),o.add(r),o}function t5(t){const e=new le,a=t==="#FFFFFF"?Jf:oc(t),o=[[0,0,Et*.34,1],[-Et*.4,J*.012,-Et*.3,.85],[Et*.38,-J*.014,-Et*.42,.78]];for(let n=0;n<o.length;n++){const[s,i,r,l]=o[n],h=new S(ac,n===1?qk:a);h.scale.setScalar(Et*l),h.position.set(s,i,r),h.rotation.set(0,(n-1)*.5,0),e.add(h)}return e}function Lp(t){const e=new le,a=[],o=4,n=Zf/o,s=oc(t);for(let r=0;r<o;r++){const l=new le,h=new S(Ut,Qf);h.scale.set(ti,1,n*1.02),l.add(h);for(const c of[-1,1]){const d=new S(Ut,s);d.scale.set(ti*.1,1,n*1.02),d.position.set(c*ti*.45,J*.004,0),l.add(d)}l.position.z=(r-(o-1)/2)*n,e.add(l),a.push(l)}const i={segs:a};return e.userData.__parts=i,e}function Dp(t){const e=new le,a=new S($k,Qf);a.scale.set(Kt*2,Hs,Kt*2),e.add(a);const o=new S(Jr,Jf);o.scale.set(Kt*1.6,1,Kt*1.6),o.position.y=Hs*.5,e.add(o);const n=new S(Jr,oc(t));n.scale.set(Kt*.94,1,Kt*.94),n.position.y=Hs*.5+J*.004,e.add(n);const s=new S(Jr,jk);return s.scale.set(Kt*.34,1,Kt*.34),s.position.set(Kt*.46,Hs*.5+J*.005,-Kt*.3),e.add(s),e}const a5=1.9;function Hp(t,e){let a=0;t.traverse(o=>{o.isMesh&&!o.name&&(o.name=`${e}Part${a++}`)})}const o5={Rice:{projectile(t){const e=t5(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=el(e);o.phase+=a/Qr(t.weapon)*Rt*1.6,e.rotation.y=Xt(t.direction.x,t.direction.z)+Math.sin(o.phase)*.3;const n=1+Math.sin(o.phase*1.9)*.14;e.scale.set(n,1,1/n);for(let s=0;s<e.children.length;s++)e.children[s].rotation.x=o.phase*(.6+s*.35);o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,eo(t,t.position.x,t.position.y,t.position.z,-t.direction.x*.5+(Math.random()-.5)*.7,-.15,-t.direction.z*.5+(Math.random()-.5)*.7,Et*.75,.3+Math.random()*.12,Math.random()<.4))},impact(t){const e=_s(t.damage),{x:a,y:o,z:n}=t.position,s=t.direction,i=J*.26*e;for(let c=0;c<7;c++){const d=c/7*Rt+Math.random()*.7,p=(1.9+Math.random()*1.5)*e;eo(t,a+Math.cos(d)*i,o,n+Math.sin(d)*i,Math.cos(d)*p+s.x*.7,1.5+Math.random()*1.2,Math.sin(d)*p+s.z*.7,Et*(.9+Math.random()*.5)*e,.44+Math.random()*.16,Math.random()<.35)}const r=Math.hypot(s.x,s.z)>1e-4?J*.34:0,l=tm();l.color.set(an),l.opacity=1;const h=new S(ac,l);h.renderOrder=12,h.position.set(a-s.x*r,o,n-s.z*r),h.rotation.y=Xt(s.x,s.z)+Math.PI*.5,t.spawnTransient(h,.14,c=>{h.scale.setScalar(V.lerp(J*.12,J*.3,c)*e),l.opacity=1-c})},cast(t){const e=t.direction;for(let a=0;a<6;a++)eo(t,t.position.x,t.position.y,t.position.z,e.x*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,.5+Math.random()*.5,e.z*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,Et*(.7+Math.random()*.4),.3+Math.random()*.12,Math.random()<.4)}},Seaweed:{projectile(t){const e=Lp(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=el(e);o.phase+=a/Qr(t.weapon)*Rt*2.8,e.rotation.y=Xt(t.direction.x,t.direction.z);const n=e.userData.__parts;if(n)for(let s=0;s<n.segs.length;s++){const i=o.phase-s*1.1;n.segs[s].rotation.x=Math.sin(i)*.42,n.segs[s].position.y=Math.sin(i)*J*.03}o.shed-=a,o.shed<=0&&(o.shed=.14+Math.random()*.08,tl(t,t.position.x,t.position.y,t.position.z,-t.direction.x*.5+(Math.random()-.5)*.6,-.05,-t.direction.z*.5+(Math.random()-.5)*.6,J*.075,.28,t.color))},impact(t){const e=_s(t.damage),a=t.direction,o=Xt(a.x,a.z),{x:n,y:s,z:i}=t.position,r=new le;r.rotation.y=o,r.position.set(n+a.x*J*.42,Bt,i+a.z*J*.42),r.renderOrder=5;const l=vi();l.color.set(t.color),l.opacity=.95;const h=new S(Ut,l);h.scale.set(1.1,1,1.07),h.position.y=-.004,r.add(h);const c=xi();c.color.set(za),c.opacity=.95,r.add(new S(Ut,c));const d=J*.42*e,p=J*.72*e;t.spawnTransient(r,.85,m=>{const f=1-Math.pow(1-Math.min(1,m*8),3);r.scale.set(d,1,Math.max(.02,p*f));const g=m<.55?1:1-(m-.55)/.45;c.opacity=.95*g,l.opacity=.95*g});const u=J*.28*e;for(let m=0;m<4;m++){const f=m/4*Rt+Math.random()*.8,g=(1.7+Math.random()*1.2)*e;n5(t,n+Math.cos(f)*u,s,i+Math.sin(f)*u,Math.cos(f)*g,1.3+Math.random()*1.1,Math.sin(f)*g,J*(.34+Math.random()*.16)*e,.42+Math.random()*.14,t.color)}for(let m=0;m<5;m++){const f=Math.random()*Rt;tl(t,n+Math.cos(f)*u*.8,s,i+Math.sin(f)*u*.8,Math.cos(f)*(1.6+Math.random()*1.4),1.2+Math.random(),Math.sin(f)*(1.6+Math.random()*1.4),J*.085*e,.36,t.color)}},cast(t){const e=t.direction,a=Xt(e.x,e.z),o=new le;o.rotation.y=a,o.position.copy(t.position),o.renderOrder=11;const n=vi();n.color.set(t.color),n.opacity=1;const s=new S(Ut,n);s.scale.set(1.12,1,1.08),s.position.y=-J*.006,o.add(s);const i=xi();i.color.set(za),i.opacity=1,o.add(new S(Ut,i)),t.spawnTransient(o,.18,r=>{const l=1-Math.pow(1-r,2);o.scale.set(ti*(.5+l*.6),1,Zf*(.25+l*.8)),o.position.set(t.position.x+e.x*l*J*.16,t.position.y,t.position.z+e.z*l*J*.16),i.opacity=1-r,n.opacity=1-r});for(let r=0;r<3;r++)tl(t,t.position.x,t.position.y,t.position.z,e.x*(1+Math.random())+(Math.random()-.5)*.7,.4+Math.random()*.4,e.z*(1+Math.random())+(Math.random()-.5)*.7,J*.08,.28,t.color)}},Fish:{impact(t){const e=_s(t.damage),a=t.direction,{x:o,y:n,z:s}=t.position,i=Xt(a.x,a.z);zs(t,o,n,s,i+Math.PI*.5,J*.95*e,J*.078,.28);const r=J*.3*e;for(let l=0;l<5;l++){const h=l/5*Rt+Math.random()*.5;al(t,o+Math.cos(h)*r,n,s+Math.sin(h)*r,h,(1.5+Math.random()*1)*e,J*.16*e,J*.3*e,.5+Math.random()*.16)}for(let l=0;l<8;l++){const h=Math.random()*Rt,c=(1.7+Math.random()*1.4)*e;eo(t,o+Math.cos(h)*r*.85,n,s+Math.sin(h)*r*.85,Math.cos(h)*c,1.4+Math.random()*1.2,Math.sin(h)*c,Et*(.85+Math.random()*.4)*e,.42+Math.random()*.14,Math.random()<.35)}},cast(t){const e=t.direction,a=Xt(e.x,e.z);zs(t,t.position.x,t.position.y,t.position.z,a+Math.PI*.42,J*.5,J*.062,.17);const o=(t.weapon.cone??150)*Math.PI/180;for(let n=0;n<3;n++){const s=(n-1)*o*.3,i=a+s;al(t,t.position.x,t.position.y,t.position.z,Math.atan2(Math.sin(i),Math.cos(i))-Math.PI*.5,1.5+Math.random()*.7,J*.12,J*.22,.34)}}},Catch:{projectile(t){const e=Dp(t.color);return e.position.copy(t.position),e.scale.setScalar(.6),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=el(e),n=Qr(t.weapon);o.phase+=a/n*Rt*1.1,o.grow=Math.min(1,o.grow+a/n),e.rotation.y=o.phase;const s=V.lerp(.6,1.28,1-Math.pow(1-o.grow,2));e.scale.setScalar(s),e.position.y+=Math.sin(o.phase*1.6)*J*.02,o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,eo(t,t.position.x,t.position.y,t.position.z,-t.direction.x*.6+(Math.random()-.5)*.8,.1,-t.direction.z*.6+(Math.random()-.5)*.8,Et*.8,.32,Math.random()<.4))},impact(t){const e=_s(t.damage),a=t.direction,{x:o,y:n,z:s}=t.position,r=Xt(a.x,a.z)+Math.PI*.5;zs(t,o,n,s,r,J*1.12*e,J*.085,.32);const l=J*.25*e,h=J*.26*e,c=new le;c.rotation.y=r,c.position.set(o,n-J*.05,s),c.renderOrder=10;const d=Xk();d.color.set(za),d.opacity=1;const p=Zk();p.color.set(an),p.opacity=1;const u=Jk();u.color.set(t.color),u.opacity=1;const m={wall:d,face:p,core:u},f=Np(l,h,m),g=Np(l,h,m);g.rotation.y=Math.PI,c.add(f,g);const w=J*.185*e,b=J*.4*e,y=n-J*.05-(Bt+l*.6);t.spawnTransient(c,.55,k=>{const E=1-Math.pow(1-k,2),x=V.lerp(w,b,E);f.position.x=x,g.position.x=-x,f.rotation.z=-E*.9,g.rotation.z=E*.9,c.position.y=n-J*.05-y*E*E;const M=k<.6?1:1-(k-.6)/.4;d.opacity=M,p.opacity=M,u.opacity=M});const v=J*.3*e;for(let k=0;k<9;k++){const E=k/9*Rt+Math.random()*.6,x=(1.9+Math.random()*1.5)*e;eo(t,o+Math.cos(E)*v,n,s+Math.sin(E)*v,Math.cos(E)*x,1.6+Math.random()*1.3,Math.sin(E)*x,Et*(.9+Math.random()*.5)*e,.46+Math.random()*.16,Math.random()<.35)}for(let k=0;k<2;k++){const E=r+(k===0?.6:-.6)+Math.PI*(k===0?0:1);al(t,o+Math.cos(E)*v,n,s+Math.sin(E)*v,E,(1.6+Math.random()*.9)*e,J*.14*e,J*.26*e,.48)}},cast(t){const e=t.direction,a=Xt(e.x,e.z);zs(t,t.position.x,t.position.y,t.position.z,a+Math.PI*.38,J*.58,J*.068,.18);for(let o=0;o<5;o++)eo(t,t.position.x,t.position.y,t.position.z,e.x*(1.3+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,e.z*(1.3+Math.random())+(Math.random()-.5)*.9,Et*.8,.3,Math.random()<.4)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleSushiRoot";const n=t.position.clone();n.y-=J*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=Lp(t.color);s.name="teleSushiNori",Hp(s,"teleSushiNori"),o.add(s);const i=Math.max(1,t.weapon.pellets??3),r=[];for(let p=0;p<i;p++){const u=Dp(t.color);u.name=`teleSushiRoll${p}`,Hp(u,`teleSushiRoll${p}`),r.push(u),o.add(u)}const l=(p,u,m)=>{const f=e.MathUtils.clamp((p-u)/(m-u),0,1);return f*f*(3-2*f)},h=(t.weapon.spreadDeg??40)*Math.PI/360,c=J*.7,d=(p,u)=>{const m=e.MathUtils.clamp(u/a,0,1),f=l(m,0,.38),g=l(m,.88,1);s.position.set(Math.sin(m*3.1)*J*.3,c+J*(.7+.34*f),J*(.1+.34*f)),s.rotation.set(-.95-.3*Math.sin(m*4.2),m*2.6,.35*Math.sin(m*3.4));const w=.85+.45*f;s.scale.set(w,1,w*(1+.25*Math.sin(m*5)));for(let b=0;b<i;b++){const y=r[b],v=b*.1,k=l(m,.15+v,.88),E=i===1?0:(b/(i-1)-.5)*2*h,x=b/i*Rt+m*(2.4+2*k),M=e.MathUtils.lerp(x,E,g),R=J*(.62+.3*k+.34*g);y.position.set(Math.sin(M)*R,c+Math.sin(x*1.4)*J*.14*(1-g)+J*.16*k,Math.cos(M)*R*(.6+.4*g)),y.scale.setScalar(1.1+(a5-1.1)*k),y.rotation.y=x*1.5}};d(0,0),t.spawnTransient(o,a+.06,d)}}};function tl(t,e,a,o,n,s,i,r,l,h){const c=new le,d=vi();d.color.set(h),d.opacity=1;const p=new S(Ut,d);p.scale.set(r*1.3,1,r*.75),p.position.y=-J*.005,c.add(p);const u=xi();u.color.set(za),u.opacity=1;const m=new S(Ut,u);m.scale.set(r,1,r*.55),c.add(m),c.renderOrder=9,c.position.set(e,a,o),c.rotation.y=Math.random()*Rt;const f=(Math.random()-.5)*9,g=-5.2;t.spawnTransient(c,l,(w,b)=>{c.position.set(e+n*b,Math.max(Bt,a+s*b+.5*g*b*b),o+i*b),c.rotation.y+=f*.016,u.opacity=1-w*w,d.opacity=1-w*w})}function n5(t,e,a,o,n,s,i,r,l,h){const c=new le,d=vi();d.color.set(h),d.opacity=1;const p=new S(Ut,d);p.scale.set(J*.075,1,r*1.03),p.position.y=-J*.006,c.add(p);const u=xi();u.color.set(za),u.opacity=1;const m=new S(Ut,u);m.scale.set(J*.05,1,r),c.add(m),c.renderOrder=9,c.position.set(e,a,o);const f=-5.6,g=(Math.random()-.5)*4.5;t.spawnTransient(c,l,(w,b)=>{c.position.set(e+n*b,Math.max(Bt,a+s*b+.5*f*b*b),o+i*b),c.rotation.y=Xt(n,i)+g*b,c.scale.set(1+w*.5,1,1-w*.35),u.opacity=1-w*w,d.opacity=1-w*w})}function al(t,e,a,o,n,s,i,r,l){const h=Yk();h.color.set(ec),h.opacity=1;const c=Vk();c.color.set(tc),c.opacity=1;const d=Kk();d.color.set(Yf),d.opacity=1;const p=e5(i,r,{face:h,deep:c,fat:d});p.renderOrder=9,p.position.set(e,a,o),p.rotation.y=n+Math.PI*.5;const u=Math.cos(n)*s,m=Math.sin(n)*s,f=.9+Math.random()*.7,g=-7.8,w=(Math.random()-.5)*2.2;t.spawnTransient(p,l,(b,y)=>{const v=a+f*y+.5*g*y*y,k=v<=Bt;p.position.set(e+u*y,k?Bt:v,o+m*y),p.rotation.y=n+Math.PI*.5+w*y;const E=1-Math.pow(b,2.4);h.opacity=E,c.opacity=E,d.opacity=E})}function s5(t){const e=t.replace("#","");return[0,2,4].map(a=>parseInt(e.slice(a,a+2),16)/255)}function i5(t){return`#${t.map(e=>Math.round(Math.max(0,Math.min(1,e))*255).toString(16).padStart(2,"0").toUpperCase()).join("")}`}function _p(t){return .2126*t[0]+.7152*t[1]+.0722*t[2]}function r5([t,e,a]){const o=Math.max(t,e,a),n=Math.min(t,e,a),s=(o+n)/2,i=o-n;if(i===0)return[0,0,s];const r=s>.5?i/(2-o-n):i/(o+n);return[(o===t?(e-a)/i+(e<a?6:0):o===e?(a-t)/i+2:(t-e)/i+4)*60,r,s]}function zp([t,e,a]){const o=(t%360+360)%360/360,n=a<.5?a*(1+e):a+e-a*e,s=2*a-n,i=r=>{const l=(r+1)%1;return l<1/6?s+(n-s)*6*l:l<.5?n:l<2/3?s+(n-s)*(2/3-l)*6:s};return[i(o+1/3),i(o),i(o-1/3)]}function am(t,e,a,o){const n=s5(t),[s,i]=r5(n),r=_p(n)+o,l=s+e,h=Math.max(0,Math.min(1,i+a));let c=0,d=1;for(let p=0;p<32;p++){const u=(c+d)/2;_p(zp([l,h,u]))<r?c=u:d=u}return i5(zp([l,h,(c+d)/2]))}function om(t){const e=ce.soup.weapons.find(a=>a.key===t);if(!e)throw new Error(`soup vfx: no weapon '${t}' in CHARACTERS.soup.weapons`);return e.color}const Qi=om("Splash"),er=am(Qi,7.1,.195,.196),tr=am(Qi,-6.4,.07,-.212),l5="#FFF2E2",nc=om("Noodle"),re=ee,Xe=.27,Rn=re*.3,h5=re*.34,ol=re*.55,mo=re*.042,at=re*.085,qt=re*.4,c5=re*.024;function nm(t){let e=t%2147483647;return e<=0&&(e+=2147483646),()=>(e=e*48271%2147483647,e/2147483647)}function nl(t,e){const o=nm(t),n=o()*Math.PI*2,s=o()*Math.PI*2,i=o()*Math.PI*2,r=[];for(let u=0;u<e;u++)r.push([o()*Math.PI*2,.14+o()*.2,.16+o()*.14]);const l=[];let h=0;for(let u=0;u<=84;u++){const m=u/84*Math.PI*2;let f=1+.15*Math.sin(3*m+n)+.09*Math.sin(5*m+s)+.05*Math.sin(8*m+i);for(const[g,w,b]of r){let y=m-g;for(;y>Math.PI;)y-=Math.PI*2;for(;y<-Math.PI;)y+=Math.PI*2;f+=w*Math.exp(-(y*y)/(2*b*b))}l.push(f),f>h&&(h=f)}const c=new Float32Array(258);for(let u=0;u<=84;u++){const m=u/84*Math.PI*2,f=l[u]/h,g=(u+1)*3;c[g]=Math.cos(m)*f,c[g+1]=0,c[g+2]=Math.sin(m)*f}const d=[];for(let u=1;u<=84;u++)d.push(0,u+1,u);const p=new Zn;return p.setAttribute("position",new Pn(c,3)),p.setIndex(d),p.computeVertexNormals(),p}const Pp=[nl(9173,4),nl(48271,5),nl(11071,3)];let d5=0;const sm=()=>Pp[d5++%Pp.length],Kn=new ct(1,9,7);Kn.scale(.78,.78,1.4);const uo=new ct(1,10,8),p5=new Ae(1,.34,1,24,1,!0),u5=(()=>{const e=document.createElement("canvas");e.width=e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.95)"),o.addColorStop(.45,"rgba(255,255,255,0.52)"),o.addColorStop(.78,"rgba(255,255,255,0.14)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.colorSpace=Ni,n})();function sl(t){const e=nm(t),a=1.1+e()*1.4,o=.9+e()*1.3,n=.13+e()*.11,s=.08+e()*.09,i=[],r=8;for(let l=0;l<r;l++){const h=l/(r-1);i.push(new fe(Math.sin(h*Math.PI*a+t)*n,Math.cos(h*Math.PI*o+t)*s,h-.5))}return new hg(new cg(i),20,c5/qt,5,!1)}const $p=[sl(7919),sl(30011),sl(65449)];let f5=0;const sc=()=>$p[f5++%$p.length];function bt(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Nt=(t,e)=>new K({color:t,transparent:!0,opacity:e,depthWrite:!1,side:be}),im=bt(10,()=>Nt(tr,.9)),m5=bt(10,()=>Nt(er,.9)),rm=bt(28,()=>Nt(Qi,.95)),ki=bt(14,()=>Nt(er,.95)),g5=bt(16,()=>Nt(nc,1)),w5=bt(6,()=>Nt(tr,.85)),Zl=bt(6,()=>Nt(Qi,1)),b5=bt(6,()=>Nt(er,1)),y5=bt(12,()=>Nt(nc,1)),x5=bt(3,()=>Nt(tr,.92)),v5=bt(3,()=>Nt(er,.9)),k5=bt(6,()=>Nt(nc,1)),M5=bt(16,()=>new Pt({map:u5,color:l5,transparent:!0,opacity:.5,depthWrite:!1})),E5=bt(8,()=>new K({color:"#FFF4DF",transparent:!0,opacity:.9,depthWrite:!1,blending:ot})),Ps=new fe,T5=new fe(0,0,1);function Mi(t,e,a,o){Ps.set(e,a,o),!(Ps.lengthSq()<1e-9)&&(Ps.normalize(),t.quaternion.setFromUnitVectors(T5,Ps))}function Pa(t,e,a,o,n,s,i,r,l,h=!1){const c=new S(Kn,h?ki():rm()),d=c.material,p=.95;d.opacity=p,c.position.set(e,a,o);const u=-9.4;t.spawnTransient(c,l,(m,f)=>{const g=a+s*f+.5*u*f*f,w=g<=Xe;c.position.set(e+n*f,w?Xe:g,o+i*f);const b=s+u*f;if(w)Mi(c,n,0,i),c.scale.set(r*1.5,r*.3,r*1.7);else{Mi(c,n,b,i);const y=Math.hypot(n,b,i),v=1+Math.min(.9,y*.075);c.scale.set(r/Math.sqrt(v),r/Math.sqrt(v),r*v)}d.opacity=p*(1-m*m)})}function go(t,e,a,o,n,s,i){const r=new Oa(M5()),l=r.material;l.opacity=0;const h=(Math.random()-.5)*n*1.6,c=(Math.random()-.5)*n*1.6;r.renderOrder=9,r.position.set(e,a,o),r.scale.set(n*1.1,n*1.1,1),t.spawnTransient(r,i,d=>{const p=1-Math.pow(1-d,2);r.position.set(e+h*p,a+s*p,o+c*p);const u=n*(1.1+p*1.5);r.scale.set(u,u,1),l.opacity=.5*Math.sin(Math.min(1,d*1.3)*Math.PI)})}function ic(t,e,a,o,n){const s=sm(),i=Math.random()*Math.PI*2,r=new S(s,im()),l=r.material;r.rotation.y=i,r.position.set(e,Xe,a),r.renderOrder=6,r.scale.setScalar(o*.35);const h=new S(s,m5()),c=h.material;h.rotation.y=i+.7,h.position.set(e,Xe+.01,a),h.renderOrder=7,h.scale.setScalar(o*.18);const d=p=>p<.34?1-Math.pow(1-p/.34,2.2):1;t.spawnTransient(r,n,p=>{r.scale.setScalar(o*V.lerp(.35,1,d(p))),l.opacity=.82*(1-Math.pow(p,1.5))}),t.spawnTransient(h,n*.86,p=>{h.scale.setScalar(o*V.lerp(.18,.62,d(p))),c.opacity=.9*(1-Math.pow(p,1.8))})}function S5(t,e,a,o,n){const s=new S(p5,w5()),i=s.material;i.color.set(tr),i.opacity=.85,s.rotation.y=Math.random()*Math.PI*2,s.renderOrder=8;const r=o*.78,l=h=>{const c=h<.5?1-Math.pow(1-h/.5,2.4):1,d=o*V.lerp(.24,1,c),p=r*V.lerp(1,.18,c);s.position.set(e,Xe+p*.5,a),s.scale.set(d,p,d),i.opacity=.85*(1-Math.pow(h,1.6))};l(0),t.spawnTransient(s,n,l)}function rc(t,e,a,o,n){const s=new S(uo,E5()),i=s.material;s.position.set(e,a,o),s.scale.set(n,n*.55,n),t.spawnTransient(s,.19,r=>{const l=n*V.lerp(.9,1.7,r);s.scale.set(l,l*.5,l),i.opacity=.9*(1-r)*(1-r)})}function Ei(t,e,a,o,n,s,i,r,l){const h=new S(sc(),g5()),c=h.material;c.opacity=1,h.position.set(e,a,o),h.scale.setScalar(r);const d=-9.4,p=6+Math.random()*6,u=Math.atan2(n,i)+(Math.random()-.5)*.8;t.spawnTransient(h,l,(m,f)=>{const g=a+s*f+.5*d*f*f;g<=Xe+.02?(h.position.set(e+n*f,Xe+.02,o+i*f),h.quaternion.identity(),h.rotation.set(0,u,0),h.scale.set(r,r*.55,r)):(h.position.set(e+n*f,g,o+i*f),Mi(h,n,s+d*f,i),h.rotateZ(f*p)),c.opacity=1-Math.pow(m,3)})}function A5(t){const e=new le,a=new S(Kn,Zl());a.material.color.set(t),a.scale.setScalar(at),a.position.z=at*.4,e.add(a);const o=new S(uo,b5());o.scale.setScalar(at*.5),o.position.set(at*.25,at*.4,at*.85),e.add(o);for(let n=0;n<2;n++){const s=new S(Kn,Zl());s.material.color.set(t);const i=at*(.44-n*.13);s.scale.setScalar(i),s.position.set((Math.random()-.5)*at*.5,(Math.random()-.5)*at*.4,-at*(1.05+n*.95)),e.add(s)}return e.userData.__head=a,e}const R5={projectile(t){const e=A5(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=(e.userData.__phase??Math.random()*6)+a*17;e.userData.__phase=o;const n=1+Math.sin(o)*.22;e.scale.set(1/Math.sqrt(n),1/Math.sqrt(n),n);const s=e.userData.__head;s&&(s.position.x=Math.sin(o*.55)*at*.3);const i=(e.userData.__drip??.04)-a;i<=0?(e.userData.__drip=.055+Math.random()*.045,Pa(t,t.position.x-t.direction.x*at*1.6,t.position.y-at*.4,t.position.z-t.direction.z*at*1.6,-t.direction.x*.5+(Math.random()-.5)*.5,-.3-Math.random()*.4,-t.direction.z*.5+(Math.random()-.5)*.5,mo*(.5+Math.random()*.4),.3)):e.userData.__drip=i;const r=(e.userData.__steam??.09)-a;r<=0?(e.userData.__steam=.13+Math.random()*.09,go(t,t.position.x,t.position.y+at,t.position.z,re*.075,re*.14,.34)):e.userData.__steam=r},impact(t){const{x:e,z:a}=t.position,o=t.direction;let n=o.x,s=o.z;const i=Math.hypot(n,s);i<1e-4?(n=1,s=0):(n/=i,s/=i),rc(t,e,t.position.y*.55,a,re*.19);const r=Rn*.85;ic(t,e+n*r,a+s*r,Rn,.42),S5(t,e+n*r*.45,a+s*r*.45,Rn*1.15,.24);for(let l=0;l<7;l++){const h=l/7*Math.PI*2+Math.random()*.6,c=1.7+Math.random()*1.5;Pa(t,e+Math.cos(h)*Rn*.55,t.position.y*.5,a+Math.sin(h)*Rn*.55,Math.cos(h)*c+n*.9,2.1+Math.random()*1.2,Math.sin(h)*c+s*.9,mo*(1+Math.random()*.7),.36+Math.random()*.12,l%3===0)}go(t,e+n*r*.6,Xe+re*.05,a+s*r*.6,re*.14,re*.3,.5)},cast(t){const e=t.direction,a=new S(Kn,ki()),o=a.material;a.position.copy(t.position),Mi(a,e.x,-.25,e.z),t.spawnTransient(a,.16,n=>{a.position.set(t.position.x+e.x*n*re*.2,t.position.y-n*re*.07,t.position.z+e.z*n*re*.2);const s=re*(.05+n*.05);a.scale.set(s*1.5,s*.8,s*(1.6+n)),o.opacity=.95*(1-n*n)});for(let n=0;n<4;n++){const s=(Math.random()-.5)*.8,i=(Math.random()-.5)*.8;Pa(t,t.position.x,t.position.y,t.position.z,e.x*(1.6+Math.random())+s,.7+Math.random()*.9,e.z*(1.6+Math.random())+i,mo*(.5+Math.random()*.4),.3)}go(t,t.position.x,t.position.y,t.position.z,re*.09,re*.2,.34)}};function I5(t){const e=new le,a=[];for(let n=0;n<3;n++){const s=new S(sc(),y5());s.material.color.set(t),s.scale.setScalar(qt*.62),s.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),s.position.set((Math.random()-.5)*qt*.22,(Math.random()-.5)*qt*.22,(Math.random()-.5)*qt*.22),e.add(s),a.push(s)}const o=new S(uo,Zl());return o.scale.setScalar(at*.62),e.add(o),e.userData.__strands=a,e}const O5={projectile(t){const e=I5(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=e.userData.__strands;if(o)for(let s=0;s<o.length;s++){const i=o[s];i.rotation.x+=a*(3.4+s*1.7),i.rotation.z+=a*(2.1+s*1.1)}const n=(e.userData.__drip??.06)-a;n<=0?(e.userData.__drip=.085+Math.random()*.06,Pa(t,t.position.x,t.position.y-qt*.2,t.position.z,(Math.random()-.5)*.7,-.2-Math.random()*.5,(Math.random()-.5)*.7,mo*(.45+Math.random()*.35),.32)):e.userData.__drip=n},impact(t){const{x:e,z:a}=t.position;rc(t,e,t.position.y*.55,a,re*.18),ic(t,e,a,h5,.48);for(let o=0;o<5;o++){const n=o/5*Math.PI*2+Math.random()*.7,s=1.3+Math.random()*1.2;Ei(t,e,t.position.y*.7,a,Math.cos(n)*s,1.5+Math.random()*1.1,Math.sin(n)*s,qt*(.7+Math.random()*.45),.7+Math.random()*.15)}for(let o=0;o<4;o++){const n=Math.random()*Math.PI*2,s=1.2+Math.random()*1.3;Pa(t,e,t.position.y*.6,a,Math.cos(n)*s,1.8+Math.random()*1.1,Math.sin(n)*s,mo*(.6+Math.random()*.5),.36,o===0)}go(t,e,Xe+re*.05,a,re*.15,re*.32,.55)},cast(t){const e=t.direction;Ei(t,t.position.x,t.position.y,t.position.z,e.x*1.4,1.5,e.z*1.4,qt*.7,.26);for(let a=0;a<3;a++)Pa(t,t.position.x,t.position.y,t.position.z,e.x*1.2+(Math.random()-.5)*.8,.9+Math.random()*.7,e.z*1.2+(Math.random()-.5)*.8,mo*.55,.28)}},C5={cast(t){const e=t.direction,a=et(t.weapon.range??ro.meleeHeavy),o=t.position.x,n=t.position.y,s=t.position.z,i=-e.z,r=e.x;for(let d=0;d<13;d++){const p=(d/12-.5)*2,u=p*a*.16+(Math.random()-.5)*a*.06,m=1.1+Math.random()*1.5-Math.abs(p)*.35,f=re*(.055+Math.random()*.055)*(1-Math.abs(p)*.25);Pa(t,o+i*u,n+re*(.05+Math.random()*.12),s+r*u,e.x*m+i*p*.35,.5+Math.random()*.7,e.z*m+r*p*.35,f,.42+Math.random()*.16,d%4===0)}for(let d=0;d<3;d++){const p=new S(uo,d===1?ki():rm()),u=p.material,m=.35+d*.5,f=o+e.x*a*.1,g=s+e.z*a*.1,w=n+re*.1;p.position.set(f,w,g),t.spawnTransient(p,.4,y=>{const v=y*y;p.position.set(f+e.x*m*a*.28*y,Math.max(Xe,w-v*re*.8),g+e.z*m*a*.28*y),p.scale.set(re*(.13+y*.1),re*(.13-y*.09),re*(.13+y*.1)),u.opacity=.85*(1-Math.pow(y,1.7))})}for(let d=0;d<3;d++){const p=(d-1)*.5;Ei(t,o+i*p*a*.1,n,s+r*p*a*.1,e.x*(1.6+Math.random())+i*p,.9+Math.random()*.6,e.z*(1.6+Math.random())+r*p,qt*(.8+Math.random()*.4),.6)}const l=sm(),h=new S(l,im()),c=h.material;h.position.set(o+e.x*a*.26,Xe,s+e.z*a*.26),h.rotation.y=Math.atan2(e.x,e.z),h.renderOrder=6,t.spawnTransient(h,.6,d=>{const p=d<.45?1-Math.pow(1-d/.45,2):1;h.scale.set(a*.13*p+.05,1,a*.3*p+.05),c.opacity=.8*(1-Math.pow(d,2.2))});for(let d=0;d<3;d++)go(t,o+e.x*a*(.12+d*.13),Xe+re*.06,s+e.z*a*(.12+d*.13),re*.16,re*.42,.6)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleSoupRoot";const n=t.position.clone();n.y-=re*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=new e.Group;s.name="teleSoupTilt",o.add(s);const i=x5(),r=new e.Mesh(uo,i);r.name="teleSoupBroth",s.add(r);const l=v5(),h=new e.Mesh(uo,l);h.name="teleSoupLip",s.add(h);const c=3,d=[];for(let f=0;f<c;f++){const g=new e.Mesh(sc(),k5());g.name=`teleSoupNoodle${f}`,d.push(g),s.add(g)}const p=(f,g,w)=>{const b=e.MathUtils.clamp((f-g)/(w-g),0,1);return b*b*(3-2*b)},u=re*.98,m=(f,g)=>{const w=e.MathUtils.clamp(g/a,0,1),b=p(w,0,.45),y=p(w,.25,.85),v=p(w,.85,1),k=re*(.45+.22*b),E=Math.sin(w*(7+9*y));r.position.set(Math.sin(w*(5+7*y))*re*.06*y,u+re*.1*b,re*.3*y),r.scale.set(k*(1+.1*E),k*(.72-.1*E),k),i.opacity=.8+.15*b;const x=k*(.48+.3*v);h.position.set(r.position.x,r.position.y+k*(.3-.34*v),r.position.z+k*(.42+.55*v)),h.scale.set(x,x*.55,x),l.opacity=.35+.6*v+.15*y;for(let M=0;M<c;M++){const R=d[M],T=M/c*Math.PI*2+w*3.4,N=p(w,.25+M*.08,.9),I=k*(.35+.75*N);R.position.set(r.position.x+Math.cos(T)*I,r.position.y+k*(.35+.45*N),r.position.z+Math.sin(T)*I*.7),R.scale.setScalar(qt*(.5+.85*N)),R.rotation.set(T*1.3,w*4.1+M,T*.8),R.material.opacity=.55+.45*N}s.rotation.x=v*.75+y*.12};m(0,0),t.spawnTransient(o,a+.06,m)},impact(t){const{x:e,z:a}=t.position,o=new S(uo,ki()),n=o.material;o.position.set(e,Xe,a),t.spawnTransient(o,.16,s=>{const i=1-Math.pow(1-s,2.6),r=re*V.lerp(.42,.05,i),l=re*V.lerp(.13,.4,i);o.position.set(e,Xe+r*.5,a),o.scale.set(l,r,l),n.opacity=.95*(1-Math.pow(s,2.5))}),rc(t,e,t.position.y*.5,a,re*.3),ic(t,e,a,ol,.62);for(let s=0;s<11;s++){const i=s/11*Math.PI*2+Math.random()*.5,r=2.2+Math.random()*2.2;Pa(t,e+Math.cos(i)*re*.12,Xe+re*.1,a+Math.sin(i)*re*.12,Math.cos(i)*r,2.6+Math.random()*1.8,Math.sin(i)*r,mo*(.9+Math.random()*.8),.45+Math.random()*.15,s%3===0)}for(let s=0;s<4;s++){const i=s/4*Math.PI*2+Math.random(),r=1.5+Math.random()*1.3;Ei(t,e,Xe+re*.15,a,Math.cos(i)*r,2+Math.random()*1.2,Math.sin(i)*r,qt*(.85+Math.random()*.45),.85)}go(t,e,Xe+re*.05,a,re*.22,re*.6,.8);for(let s=0;s<3;s++){const i=s/3*Math.PI*2+Math.random();go(t,e+Math.cos(i)*ol*.55,Xe+re*.03,a+Math.sin(i)*ol*.55,re*.14,re*.4,.7)}}},F5={Splash:R5,Noodle:O5,Dump:C5},ta=.09,N5=ee*.075,L5=ee*.1,Bp=po*.5,lc=new dg(ta,0);lc.scale(.55,1.7,.55);const Jl=new ct(ta*.24,6,6);function Ya(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const lm=Ya(24,()=>new K({color:"#BFEFFF",transparent:!0,opacity:.8,depthWrite:!1})),D5=Ya(8,()=>new K({color:"#FFFFFF",transparent:!0,opacity:1,blending:ot,depthWrite:!1})),Up=Ya(6,()=>new K({color:"#EAFBFF",transparent:!0,opacity:.95,blending:ot,depthWrite:!1}));function qp(t){const e=new le,a=4;for(let n=0;n<a;n++){const s=lm();s.color.set(t);const i=new S(lc,s),r=n/a*Math.PI*2;i.position.set(Math.cos(r)*ta*.5,(Math.random()-.5)*ta*.6,Math.sin(r)*ta*.5),i.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),i.scale.setScalar(.6+Math.random()*.5),e.add(i)}const o=new S(Jl,D5());return e.add(o),e.userData.__glint=o,e}const $s=ee*1,H5=new Ae(.3,.36,.66,14,1,!1),_5=new ct(.3,14,8),z5=new Ae(.15,.24,.16,12,1,!1),P5=new Ae(.185,.185,.14,12,1,!1),$5=new Ae(.26,.31,.6,12,1,!1),B5=new ct(ee*.09,7,6),U5=new Ae(1,1,1,16,1,!0),jp=new Da(.72,1,28),q5=Ya(8,()=>new K({color:"#7FD4F5",transparent:!0,opacity:.42,depthWrite:!1,side:be})),j5=Ya(4,()=>new K({color:"#BFEFFF",transparent:!0,opacity:.9,depthWrite:!1})),W5=Ya(20,()=>new K({color:"#BFEFFF",transparent:!0,opacity:.9,depthWrite:!1})),G5=Ya(6,()=>new K({color:"#1E90D8",transparent:!0,opacity:.95,depthWrite:!1})),il=Ya(8,()=>new K({color:"#8FD9F7",transparent:!0,opacity:.9,blending:ot,depthWrite:!1,side:be}));function Wp(t){const e=new le;e.name=t;const a=q5(),o=new S(H5,a);o.name=`${t}Body`,o.position.y=.33;const n=new S(_5,a);n.name=`${t}Shoulder`,n.position.y=.66,n.scale.set(1,.62,1);const s=new S(z5,a);s.name=`${t}Neck`,s.position.y=.8;const i=new S($5,j5());i.name=`${t}Fill`,i.position.y=.3;const r=new S(P5,G5());return r.name=`${t}Cap`,r.position.y=.93,e.add(o,n,s,i,r),e.userData.__cap=r,e.userData.__fill=i,e}const Y5={Mega:{telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=t.position.clone();o.y-=ee*.55;const n=new e.Group;n.name="megaTelegraph",n.position.copy(o);const s=Wp("megaSelfBottle"),i=Wp("megaCapBottle");n.add(s,i);const r=[],l=16;for(let g=0;g<l;g++){const w=new e.Mesh(B5,W5());w.name=`megaLaunchStreak${g}`,w.scale.set(.8,2.6,.8),r.push(w),n.add(w)}const h=new e.Mesh(jp,il());h.name="megaMergeGlow",h.rotation.x=-Math.PI/2,h.visible=!1,n.add(h);const c=g=>g.userData.__cap,d=g=>g.userData.__fill,p=(g,w,b)=>{const y=e.MathUtils.clamp((g-w)/(b-w),0,1);return y*y*(3-2*y)},u=ee*.85,m=2.05,f=(g,w)=>{const b=e.MathUtils.clamp(w/a,0,1),y=p(b,0,.38),v=p(b,.22,.62),k=p(b,.55,.88),E=p(b,.88,1),x=u*y;s.position.set(0,x,0),s.rotation.z=.24+.09*Math.sin(b*7);const M=$s*(.55+.45*y);s.scale.setScalar(M);for(let L=0;L<l;L++){const H=L/l*Math.PI*2,P=L%4*.06,j=e.MathUtils.clamp((b-P)/.5,0,1),z=r[L],Y=po*(.6+1.5*j);z.position.set(Math.cos(H)*Y,ee*(.05+1.25*j),Math.sin(H)*Y),z.scale.set(.8*(1-j*.4),2.6*(1-j*.5),.8*(1-j*.4)),z.material.opacity=.9*(1-j)*(1-k)}const R=c(s);R.position.y=.93+v*.55,R.visible=v<.98;const T=v>.02;if(i.visible=T,T){const L=$s*(.06+.62*v);i.scale.setScalar(L);const H=po*1.5*v*(1-k);i.position.set(H,x+M*.95+v*ee*.42,0),i.rotation.z=-.3-.1*Math.sin(b*6),c(i).visible=v>.5}if(k>0){const L=$s*e.MathUtils.lerp(1,m,k);s.scale.setScalar(L),s.position.set(0,u+ee*.25*k,0),i.position.x*=1-k,i.position.y=s.position.y+L*.55,s.rotation.z=(.24+.09*Math.sin(b*7))*(1-k*.5);const H=$s*e.MathUtils.lerp(.62,.02,k);i.scale.setScalar(Math.max(.001,H)),h.visible=k<.99,h.position.set(0,s.position.y+L*.45,0);const P=L*(.22+.3*k);h.scale.set(P,P,P),h.material.opacity=.75*Math.sin(Math.PI*k)}else h.visible=!1;const N=E*.85;n.rotation.z=-N*t.direction.x,n.rotation.x=N*t.direction.z;const I=d(s),F=.35+.65*b;I.scale.set(1,F,1),I.position.y=.3*F,I.material.opacity=.75+.25*E};f(0,0),t.spawnTransient(n,a+.06,f)},cast(t){const e=t.THREE,a=t.position.clone();a.y-=ee*.55;const o=new e.Mesh(U5,il());o.name="megaPourColumn";const n=po*1.35,s=ee*2.6;o.position.set(a.x,a.y+s*.5,a.z),o.scale.set(n,s,n),t.spawnTransient(o,.34,i=>{const r=Math.min(1,i*2.4),l=Math.max(0,(i-.42)/.58);o.position.y=a.y+s*.5*(1-.55*r),o.scale.set(n*(1+1.5*l),s*(1-.5*r),n*(1+1.5*l)),o.material.opacity=.85*(1-i*i)});for(let i=0;i<2;i++){const r=new e.Mesh(jp,il());r.name=`megaPourRing${i}`,r.rotation.x=-Math.PI/2,r.position.set(a.x,a.y+.05+i*.03,a.z);const l=i*.09;t.spawnTransient(r,.42+l,h=>{const c=Math.max(0,(h*(.42+l)-l)/.42),d=po*(.8+3.6*c);r.scale.set(d,d,d),r.material.opacity=.9*(1-c)})}}},Glass:{projectile(t){const e=qp(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=e.userData.__glint;let n=0;for(const s of e.children){if(s===o)continue;const i=2+n*.9;s.rotation.x+=a*i,s.rotation.y+=a*i*.75,n++}if(o){const s=o.material;s.opacity=Math.max(0,s.opacity-a*3.2);const i=(e.userData.__glintTimer??0)-a;i<=0?(e.userData.__glintTimer=.14+Math.random()*.3,s.opacity=1,o.position.set((Math.random()-.5)*ta,(Math.random()-.5)*ta,(Math.random()-.5)*ta)):e.userData.__glintTimer=i}},impact(t){const e=t.position,a=L5/ta,o=new S(Jl,Up());o.position.copy(e),o.scale.setScalar(1.25*a),t.spawnTransient(o,.14,i=>{o.scale.setScalar(V.lerp(1.25,3,i)*a),o.material.opacity=.95*(1-i)});const n=V.clamp(1+t.damage*.06,1,2.4),s=11;for(let i=0;i<s;i++){const r=i/s*Math.PI*2+Math.random()*.5,l=(1.6+Math.random()*2.4)*n,h=lm();h.color.set(t.color);const c=new S(lc,h),d=(.42+Math.random()*.43)*a*n;c.scale.setScalar(d);const p=e.x+Math.cos(r)*Bp,u=e.y,m=e.z+Math.sin(r)*Bp;c.position.set(p,u,m);const f=1.1+Math.random()*1.6,g=-9,w=(Math.random()-.5)*22,b=(Math.random()-.5)*22;t.spawnTransient(c,.38+Math.random()*.2,(y,v)=>{c.position.set(p+Math.cos(r)*l*v,u+f*v+.5*g*v*v,m+Math.sin(r)*l*v),c.rotation.x=v*w,c.rotation.y=v*b,c.scale.setScalar(d*(1-y*.25)),c.material.opacity=.85*(1-y)})}},cast(t){const e=N5/ta,a=qp(t.color);a.position.copy(t.position),a.scale.setScalar(.35*e),t.spawnTransient(a,.16,n=>{const s=Math.min(1,n*2.2),i=n>.55?1-(n-.55)*2.2:1;a.scale.setScalar(V.clamp(.35+s*.75,.1,1.15)*e*Math.max(0,i)),a.rotation.y=n*5});const o=new S(Jl,Up());o.position.copy(t.position),o.scale.setScalar(.8*e),t.spawnTransient(o,.12,n=>{o.scale.setScalar(V.lerp(.8,1.9,n)*e),o.material.opacity=.9*(1-n)})}}},on=ea.mustard,Jt="#9A6410",hc="#FFF2C0",cc=ea.ketchup,ha="#6E121D",Ql="#FFC0AE",ai=ea.bun,zn="#7A4A1E",eh="#F9E9C2",ae=ee,_o=Math.PI*2,Ti=.28;function ar(t,e=8){const a=new ph(t,e);return a.rotateX(-Math.PI/2),a}function dc(t,e,a,o){const n=Math.max(2,a*2),s=new Ua,i=l=>l%2===0?-o:o,r=l=>-t/2+l/n*t;s.moveTo(i(0)-e,r(0));for(let l=1;l<=n;l++)s.lineTo(i(l)-e,r(l));for(let l=n;l>=0;l--)s.lineTo(i(l)+e,r(l));return s.closePath(),s}function V5(t,e){const a=new Ua;return a.moveTo(0,t),a.quadraticCurveTo(e,t*.45,e,0),a.quadraticCurveTo(e,-t*.45,0,-t),a.quadraticCurveTo(-e,-t*.45,-e,0),a.quadraticCurveTo(-e,t*.45,0,t),a}const Xn=ae*.44,th=ae*.065,K5=ae*.072,ca=ae*.26,Co=ae*.185,Si=ar(dc(Xn,th,3,K5),1),Ai=ae*.78,hm=ae*.075,cm=(hm+ae*.098)*2,rl=(()=>{const t=ar(dc(Ai,hm,3,ae*.098),1);return t.translate(0,0,Ai/2),t})(),Ft=ar(V5(.5,.5),6),X5=new Li(ae*.024,0),Gp=(()=>{const t=new Ae(1,1,1,16,1,!0,0,Math.PI);return t.rotateZ(-Math.PI/2),t.rotateY(Math.PI/2),t})(),Z5=(()=>{const t=new wo(2,1);return t.rotateX(-Math.PI/2),t})(),J5=ar(dc(1,.14,4,.36),1);function Va(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Io=t=>new K({color:t,side:be}),Q5=Io(on),Yp=Io(Jt),e4=Io(hc),t4=Io(cc),Vp=Io(ha),a4=Io(Ql),hs=(t,e)=>new K({color:t,transparent:!0,opacity:e,side:be,depthWrite:!1}),Ri=Va(48,()=>hs(on,1)),Ii=Va(48,()=>hs(Jt,1)),dm=Va(20,()=>hs(hc,1)),Kp=Va(8,()=>new K({color:ai,transparent:!0,opacity:1,side:be,depthWrite:!1})),Xp=Va(8,()=>new K({color:zn,transparent:!0,opacity:1,side:be,depthWrite:!1})),Zp=Va(8,()=>hs(eh,1)),Jp=Va(8,()=>hs(on,1)),o4=Va(14,()=>new K({color:zn,transparent:!0,opacity:1,depthWrite:!1}));function Ot(t,e){return Math.atan2(t,e)}function Qp(t){return t.range&&t.speed?t.range/t.speed:Mo.normal/1e3}function ll(t){return V.clamp(.85+t*.035,.85,1.4)}function e0(t){let e=t.userData.__hotdog;return e||(e={phase:Math.random()*_o,shed:0},t.userData.__hotdog=e),e}function Aa(t,e,a,o,n,s,i,r,l,h,c){const d=new le,p=Ii();p.color.set(a),p.opacity=1;const u=new S(Ft,p);u.scale.set(1.34,1,1.14),u.position.y=-ae*.008,d.add(u);const m=Ri();m.color.set(e),m.opacity=1,d.add(new S(Ft,m)),d.renderOrder=9,d.position.set(o,n,s);const f=h*.45,g=-8.2;t.spawnTransient(d,c,(w,b)=>{const y=n+r*b+.5*g*b*b,v=y<=Ti;if(d.position.set(o+i*b,v?Ti:y,s+l*b),v)d.rotation.y=Ot(i,l),d.scale.set(f*1.5,1,h*.75);else{const E=r+g*b,x=Math.hypot(i,E,l),M=1+Math.min(.85,x*.07);d.rotation.y=Ot(i,l),d.scale.set(f/M,1,h*M)}const k=1-w*w;m.opacity=k,p.opacity=k})}function t0(t,e,a,o,n,s){const i=t.direction,r=Math.hypot(i.x,i.z)>1e-4,l=r?ae*.36:0;oi(t,e,a,t.position.x-i.x*l,t.position.y,t.position.z-i.z*l,r?Ot(i.x,i.z)+Math.PI*.5:0,o,n,s,.45)}function oi(t,e,a,o,n,s,i,r,l,h,c,d=1,p="#FFF6DC"){const u=r/Ai,m=l/cm,f=new le;f.rotation.y=i,f.position.set(o-Math.sin(i)*r*.5,n,s-Math.cos(i)*r*.5);const g=Ii();g.color.set(a),g.opacity=d;const w=new S(rl,g);w.scale.set(1.42,1,1.02),w.position.y=-ae*.009,f.add(w);const b=Ri();b.color.set(e),b.opacity=d,f.add(new S(rl,b));const y=dm();y.color.set(p),y.opacity=d;const v=new S(rl,y);v.scale.set(.42,1,.985),v.position.y=ae*.006,f.add(v),t.spawnTransient(f,h,k=>{const E=1-Math.pow(1-Math.min(1,k*5.5),3);f.scale.set(m,1,Math.max(.02,u*E));const x=k<c?1:1-(k-c)/(1-c);b.opacity=d*x,g.opacity=d*x,y.opacity=d*x})}function n4(t){const e=new le,a=new S(Si,Yp);a.scale.set(1.5,1,1.07),a.position.y=-ae*.012,e.add(a),e.add(new S(Si,t===on?Q5:pm(t)));const o=new S(Ft,Yp);o.scale.set(th*3.2,1,ae*.15),o.position.set(0,-ae*.012,Xn*.46),e.add(o);const n=new S(Ft,e4);return n.scale.set(th*2.1,1,ae*.105),n.position.set(0,0,Xn*.47),e.add(n),e}function s4(t){const e=new le,a=t===cc?t4:pm(t),o=new S(Ft,Vp);o.scale.set(Co*1.32,1,ca*1.12),o.position.y=-ae*.012,e.add(o);const n=new S(Ft,a);n.scale.set(Co,1,ca),e.add(n);const s=new S(Ft,a4);s.scale.set(Co*.32,1,ca*.42),s.position.set(-Co*.2,ae*.004,ca*.16),e.add(s);const i=[];for(let l=0;l<3;l++){const h=new le,c=1-l*.24,d=new S(Ft,Vp);d.scale.set(Co*.72*c*1.34,1,ca*.42*c*1.14),d.position.y=-ae*.012,h.add(d);const p=new S(Ft,a);p.scale.set(Co*.72*c,1,ca*.42*c),h.add(p),h.position.z=-ca*(.7+l*.46),e.add(h),i.push(h)}const r={tail:i};return e.userData.__parts=r,e}const a0=new Map;function pm(t){let e=a0.get(t);return e||(e=Io(t),a0.set(t,e)),e}function Bs(t,e,a){const o=new le,n=new S(Gp,a.crust);n.scale.set(t*1.13,t*1.13,e*1.04),n.position.y=-t*.04,o.add(n);const s=new S(Gp,a.bun);s.scale.set(t,t,e),o.add(s);const i=new S(Z5,a.crumb);i.scale.set(t*.86,1,e*.92),i.position.y=-t*.34,o.add(i);const r=new S(J5,a.seam);return r.scale.set(t*1.3,1,e*.84),r.position.y=-t*.3,o.add(r),o}const i4={Mustard:{projectile(t){const e=n4(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=e0(e);o.phase+=a/Qp(t.weapon)*_o*3.2,e.rotation.y=Ot(t.direction.x,t.direction.z)+Math.sin(o.phase)*.16;const n=1+Math.sin(o.phase*1.7)*.13;e.scale.set(1/n,1,n),o.shed-=a,o.shed<=0&&(o.shed=.05+Math.random()*.03,Aa(t,t.color,Jt,t.position.x-t.direction.x*Xn*.5,t.position.y,t.position.z-t.direction.z*Xn*.5,-t.direction.x*(.6+Math.random()*.7)+(Math.random()-.5)*.9,.25+Math.random()*.45,-t.direction.z*(.6+Math.random()*.7)+(Math.random()-.5)*.9,ae*(.12+Math.random()*.06),.26+Math.random()*.12))},impact(t){const e=ll(t.damage),a=t.direction,o=Ot(a.x,a.z)+Math.PI*.5;oi(t,t.color,Jt,t.position.x,t.position.y,t.position.z,o,ae*1.045*e,ae*.3*e,.34,.5),t0(t,hc,Jt,ae*.46*e,ae*.2*e,.19);const{x:n,y:s,z:i}=t.position,r=ae*.3*e;for(let l=0;l<8;l++){const h=l/8*_o+Math.random()*.6,c=(2.1+Math.random()*1.5)*e;Aa(t,t.color,Jt,n+Math.cos(h)*r,s,i+Math.sin(h)*r,Math.cos(h)*c+t.direction.x*.7,1.7+Math.random()*1.2,Math.sin(h)*c+t.direction.z*.7,ae*(.14+Math.random()*.07)*e,.42+Math.random()*.14)}},cast(t){const e=t.direction,a=Ot(e.x,e.z),o=new le,n=Ii();n.color.set(Jt),n.opacity=1;const s=new S(Si,n);s.scale.set(1.5,1,1.08),s.position.y=-ae*.012,o.add(s);const i=Ri();i.color.set(t.color),i.opacity=1,o.add(new S(Si,i)),o.renderOrder=11,o.rotation.y=a;const r=t.position.x,l=t.position.z;t.spawnTransient(o,.16,h=>{const c=1-Math.pow(1-h,2);o.scale.set(.6+h*.3,1,.35+c*.85),o.position.set(r+e.x*c*ae*.16,t.position.y,l+e.z*c*ae*.16);const d=1-h;i.opacity=d,n.opacity=d});for(let h=0;h<4;h++)Aa(t,t.color,Jt,t.position.x,t.position.y,t.position.z,e.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,.4+Math.random()*.5,e.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,ae*(.12+Math.random()*.05),.3)}},Ketchup:{projectile(t){const e=s4(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=e0(e);o.phase+=a/Qp(t.weapon)*_o*2.4,e.rotation.y=Ot(t.direction.x,t.direction.z);const n=e.userData.__parts;if(n)for(let i=0;i<n.tail.length;i++){const r=n.tail[i],l=Math.sin(o.phase-(i+1)*.9);r.position.x=l*ae*.055*(i+1)*.55,r.rotation.y=l*.4}const s=1+Math.sin(o.phase*1.3)*.09;e.scale.set(s,1,1/s),o.shed-=a,o.shed<=0&&(o.shed=.09+Math.random()*.05,Aa(t,t.color,ha,t.position.x-t.direction.x*ca*1.5,t.position.y,t.position.z-t.direction.z*ca*1.5,(Math.random()-.5)*.9,.1+Math.random()*.3,(Math.random()-.5)*.9,ae*(.11+Math.random()*.05),.24+Math.random()*.1))},impact(t){const e=ll(t.damage),a=t.direction;oi(t,t.color,ha,t.position.x,t.position.y,t.position.z,Ot(a.x,a.z)+Math.PI*.5,ae*.78*e,ae*.36*e,.3,.45),t0(t,Ql,ha,ae*.4*e,ae*.2*e,.18),oi(t,t.color,ha,t.position.x+a.x*ae*.5,Ti,t.position.z+a.z*ae*.5,Ot(a.x,a.z),Ai*e,cm*e,.8,.55,.95,Ql);const{x:o,y:n,z:s}=t.position,i=ae*.29*e;for(let r=0;r<6;r++){const l=r/6*_o+Math.random()*.7,h=(1.8+Math.random()*1.3)*e;Aa(t,t.color,ha,o+Math.cos(l)*i,n,s+Math.sin(l)*i,Math.cos(l)*h+a.x*.6,1.5+Math.random()*1.1,Math.sin(l)*h+a.z*.6,ae*(.14+Math.random()*.07)*e,.44+Math.random()*.14)}},cast(t){const e=t.direction;for(let i=0;i<5;i++)Aa(t,t.color,ha,t.position.x,t.position.y,t.position.z,e.x*(1+Math.random()*.9)+(Math.random()-.5)*.8,.3+Math.random()*.4,e.z*(1+Math.random()*.9)+(Math.random()-.5)*.8,ae*(.13+Math.random()*.05),.3);const a=new le,o=Ii();o.color.set(ha),o.opacity=1;const n=new S(Ft,o);n.scale.set(1.3,1,1.16),n.position.y=-ae*.01,a.add(n);const s=Ri();s.color.set(t.color),s.opacity=1,a.add(new S(Ft,s)),a.renderOrder=11,a.rotation.y=Ot(e.x,e.z),a.position.copy(t.position),t.spawnTransient(a,.15,i=>{const r=V.lerp(ae*.06,ae*.24,1-Math.pow(1-i,2));a.scale.set(r*.55,1,r),a.position.set(t.position.x+e.x*i*ae*.14,t.position.y,t.position.z+e.z*i*ae*.14),s.opacity=1-i,o.opacity=1-i})}},Slash:{impact(t){const e=ll(t.damage),a=t.direction,o=Ot(a.x,a.z),{x:n,y:s,z:i}=t.position,r=ae*.175*e,l=ae*.62*e,h=ae*.375*e,c=ae*.125*e,d=new le;d.rotation.y=o,d.position.set(n,s-ae*.06,i),d.renderOrder=10;const p=Kp();p.color.set(ai),p.opacity=1;const u=Zp();u.color.set(eh),u.opacity=1;const m=Jp();m.color.set(t.color),m.opacity=1;const f=Xp();f.color.set(zn),f.opacity=1;const g={bun:p,crust:f,crumb:u,seam:m},w=Bs(r,l,g),b=Bs(r,l,g);d.add(w,b);const y=dm();y.color.set("#FFF6DA"),y.opacity=0;const v=new S(Ft,y);v.scale.set(ae*.075,1,l*.92),v.position.y=r*.15,v.renderOrder=12,d.add(v);let k=!1;t.spawnTransient(d,.46,x=>{const M=Math.min(1,x/.35),R=1-Math.pow(1-M,3),T=x<=.35?R:R-(x-.35)/.65*.55,N=V.lerp(h,c,V.clamp(T,0,1));w.position.x=N,b.position.x=-N;const I=V.lerp(.55,.12,V.clamp(T,0,1));w.rotation.z=I,b.rotation.z=-I,y.opacity=x<.35?0:Math.max(0,1-(x-.35)/.2);const F=x<.6?1:1-(x-.6)/.4;if(p.opacity=F,f.opacity=F,u.opacity=F,m.opacity=F,!k&&x>=.35){k=!0;const L=-Math.sin(o),H=-Math.cos(o);for(let P=0;P<6;P++){const j=P%2===0?1:-1,z=P<4,Y=(Math.random()-.5)*.8;Aa(t,z?on:cc,z?Jt:ha,n+L*j*c*1.2,s,i+H*j*c*1.2,L*j*(2.4+Math.random()*1.6)+a.x*Y,1.6+Math.random()*1.3,H*j*(2.4+Math.random()*1.6)+a.z*Y,ae*(.15+Math.random()*.07)*e,.4+Math.random()*.14)}}});const E=ae*.24*e;for(let x=0;x<6;x++){const M=Math.random()*_o,R=(1.9+Math.random()*1.6)*e,T=o4();T.color.set(x%3===0?ai:zn),T.opacity=1;const N=new S(X5,T);N.renderOrder=9;const I=n+Math.cos(M)*E,F=i+Math.sin(M)*E,L=Math.cos(M)*R,H=Math.sin(M)*R,P=1.7+Math.random()*1.3,j=(.8+Math.random()*.7)*e;N.scale.setScalar(j);const z=Math.random()*9-4.5,Y=Math.random()*9-4.5;t.spawnTransient(N,.42+Math.random()*.14,(A,C)=>{N.position.set(I+L*C,Math.max(Ti,s+P*C-4.6*C*C),F+H*C),N.rotation.set(z*C,Y*C,0),T.opacity=1-A*A})}},cast(t){const e=t.direction,a=Ot(e.x,e.z),o=.62,n=ae*.175*o,s=ae*.62*o,i=new le;i.rotation.y=a,i.position.copy(t.position),i.renderOrder=11;const r=Kp();r.color.set(ai),r.opacity=1;const l=Zp();l.color.set(eh),l.opacity=1;const h=Jp();h.color.set(t.color),h.opacity=1;const c=Xp();c.color.set(zn),c.opacity=1;const d={bun:r,crust:c,crumb:l,seam:h},p=Bs(n,s,d),u=Bs(n,s,d);i.add(p,u),t.spawnTransient(i,.2,m=>{const f=1-Math.pow(1-m,2),g=V.lerp(ae*.06,ae*.2,f);p.position.x=g,u.position.x=-g,p.rotation.z=f*.6,u.rotation.z=-f*.6;const w=1-m;r.opacity=w,c.opacity=w,l.opacity=w,h.opacity=w});for(let m=0;m<3;m++)Aa(t,on,Jt,t.position.x,t.position.y,t.position.z,e.x*(1.2+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,e.z*(1.2+Math.random())+(Math.random()-.5)*.9,ae*(.12+Math.random()*.05),.28)}}};function Dt(t,e){const a={};for(const[o,n]of Object.entries(e))n&&(a[`${t}.${o}`]=n);return a}const r4={...Dt("hamburger",R2),...Dt("donut",ex),...Dt("taco",xx),...Dt("burrito",av),...Dt("egg",Nv),...Dt("lollipop",gk),...Dt("pizza",zk),...Dt("sushi",o5),...Dt("soup",F5),...Dt("waterbottle",Y5),...Dt("hotdog",i4)};function In(t,e){return r4[`${t}.${e}`]}function la(t){window.__vfxQaCounts??={cast:0,meleeArc:0,impact:0,death:0,heal:0,giantSlam:0,puddleSplash:0,coverScuff:0,castTelegraph:0},window.__vfxQaCounts[t]++}const Fo=.5,l4=.3,or=.3,h4=or,c4=or+.01,d4=0,so=et(ht.pickupRadius),ho=so*.62,p4=ho*2.2,o0=ho*.16,u4=.0042,f4=.0013,m4=ht.popMs*3,Ra=1.15,hl=1.25,g4=.25,w4=0,to=or+.02,Us=or+.04,b4=ee,n0=.85,s0=.68,y4=4,x4=.7,v4=.92,k4=7,M4=.55,i0=.6,r0=.32,cl=new na("#F2F6FF"),E4=new na("#63A8E0"),T4=ee*.62,S4=ee*.66,A4=ee*.62,R4=.58,I4="#EAF4FF",O4="#1D2740",l0=18,Nn=.8,dl=3,h0=["#F5475E","#F5C147","#47C4F5","#6BE05A","#B36BF5","#F58A47"],c0="#EF5B2E",C4=.62,F4=.28,d0=.85,N4=.9,L4=1.15,D4=1.45,H4=2,p0=.3,vt=new na("#ffffff"),_4=new na("#241a33"),u0=new na("#FFE79A"),pl=pg.clone().normalize(),z4=.38,P4=.45,$4=.995;function um(t){if(t.userData.__fxShaded)return!1;const e=t.getAttribute("position");if(!e)return t.userData.__fxShaded=!0,!1;const a=t.getAttribute("normal"),o=e.count,n=new Float32Array(o*3);let s=!0;if(a&&a.count===o){let u=0,m=0,f=0;for(let g=0;g<o;g++)u+=a.getX(g),m+=a.getY(g),f+=a.getZ(g);s=Math.hypot(u/o,m/o,f/o)>=$4}t.computeBoundingSphere();const i=t.boundingSphere,r=i?i.center.x:0,l=i?i.center.y:0,h=i?i.center.z:0,c=Math.max(i?i.radius:1,1e-6);let d=0;for(let u=0;u<o;u++){const m=Math.min(1,Math.hypot(e.getX(u)-r,e.getY(u)-l,e.getZ(u)-h)/c),f=1-P4*m*m,g=s?1:1+z4*(a.getX(u)*pl.x+a.getY(u)*pl.y+a.getZ(u)*pl.z),w=Math.max(0,g*f);n[u*3]=w,d+=w}const p=d>1e-9?o/d:1;for(let u=0;u<o;u++){const m=n[u*3]*p;n[u*3]=m,n[u*3+1]=m,n[u*3+2]=m}return t.setAttribute("color",new Pn(n,3)),t.userData.__fxShaded=!0,!0}function B4(t){const e=t;return e.vertexColors||e.map?!1:(e.vertexColors=!0,e.needsUpdate=!0,!0)}const U4=.62,q4=.3,f0=new WeakMap;function m0(t){const e=t;if(!t.isMeshBasicMaterial||e.transparent||e.blending!==fg||e.map)return null;const a=f0.get(t);if(a)return a;const o=qe({color:e.color.clone(),roughness:q4,metalness:0,doubleSide:e.side===be,emissive:e.color.clone().multiplyScalar(U4)});return o.depthWrite=e.depthWrite,o.depthTest=e.depthTest,o.vertexColors=e.vertexColors,f0.set(t,o),o}function g0(t){t.traverse(e=>{const a=e;if(!a.isMesh||a.isSprite)return;if(Array.isArray(a.material)){const n=a.material.map(s=>m0(s)??s);a.material=n;return}const o=m0(a.material);o&&(a.material=o)})}function fm(t){t.traverse(e=>{const a=e;if(!a.isMesh)return;const o=Array.isArray(a.material)?a.material:[a.material];o.some(n=>n&&!n.map)&&um(a.geometry);for(const n of o)n&&B4(n)})}const w0=.55,j4=.34,W4=.72,G4=1,Y4=.34,V4=1.1,K4=ee*.85,X4=.8,Z4=12,J4=2,ul=.05,Ia={scopes:0,inert:0,members:0,mats:0,opaqueSkipped:0,cores:0,coresStarved:0,aliasTouches:0};function Q4(t){const e=[],a=new Set;return t.traverse(o=>{const s=o.material;if(!s)return;const i=Array.isArray(s)?s:[s];for(const r of i)if(r){if(!r.transparent){Ia.opaqueSkipped++;continue}a.has(r.uuid)||(a.add(r.uuid),e.push(r))}}),Ia.mats+=e.length,{mats:e}}function eM(t,e){let a=0;e.set(0,0,0);const o=(n,s,i,r)=>{const l=s+n.position.x,h=i+n.position.y,c=r+n.position.z;if(!n.visible)return;const d=n;(d.isMesh||d.isSprite)&&(e.x+=l,e.y+=h,e.z+=c,a++);for(const p of n.children)o(p,l,h,c)};return o(t,0,0,0),a===0?!1:(e.multiplyScalar(1/a),!0)}function On(t,e,a,o,n){const s=new Set;for(const i of a){s.add(i.id);let r=t.get(i.id);r||(r=o(i),fm(r),e.add(r),t.set(i.id,r)),n(r,i)}for(const[i,r]of t)s.has(i)||(e.remove(r),t.delete(i))}function tM(t){return t.depthWrite=!1,t}const b0=t=>1-Math.pow(1-t,3);function y0(t){const e=Math.sin(t*12.9898)*43758.5453;return(e-Math.floor(e))*Math.PI*2}function fl(t,e){const a=Math.hypot(t,e);return a>1e-6?{x:t/a,y:e/a}:{x:0,y:0}}function aM(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.4,"rgba(255,255,255,0.85)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.needsUpdate=!0,n}function oM(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.14,"rgba(255,255,255,0.85)"),o.addColorStop(.32,"rgba(255,255,255,0.45)"),o.addColorStop(.55,"rgba(255,255,255,0.18)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.needsUpdate=!0,n}function nM(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.62,"rgba(255,255,255,1)"),o.addColorStop(.82,"rgba(255,255,255,0.6)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.needsUpdate=!0,n}function sM(){const a=document.createElement("canvas");a.width=128,a.height=128;const o=a.getContext("2d"),n=o.createRadialGradient(64,64,0,64,64,128*.16);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.6,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,128);const s=8;for(let r=0;r<s;r++){const l=r%2===0,h=128*(l?.48:.26),c=128*(l?.045:.028),d=r/s*Math.PI*2;o.save(),o.translate(64,64),o.rotate(d);const p=o.createLinearGradient(0,0,h,0);p.addColorStop(0,"rgba(255,255,255,1)"),p.addColorStop(.7,"rgba(255,255,255,0.8)"),p.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=p,o.beginPath(),o.moveTo(0,-c),o.lineTo(h,0),o.lineTo(0,c),o.closePath(),o.fill(),o.restore()}const i=new st(a);return i.needsUpdate=!0,i}function iM(){const a=document.createElement("canvas");a.width=128,a.height=32;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,128,0);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.5,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,32),o.globalCompositeOperation="destination-in";const s=o.createLinearGradient(0,0,0,32);s.addColorStop(0,"rgba(255,255,255,0)"),s.addColorStop(.5,"rgba(255,255,255,1)"),s.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=s,o.fillRect(0,0,128,32),o.globalCompositeOperation="source-over";const i=new st(a);return i.needsUpdate=!0,i}function rM(){const a=document.createElement("canvas");a.width=8,a.height=64;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,0,64);n.addColorStop(0,"rgba(255,255,255,0.1)"),n.addColorStop(.55,"rgba(255,255,255,0.55)"),n.addColorStop(.86,"rgba(255,255,255,0.85)"),n.addColorStop(.94,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0.65)"),o.fillStyle=n,o.fillRect(0,0,8,64);const s=new st(a);return s.flipY=!1,s.needsUpdate=!0,s}function lM(){const a=document.createElement("canvas");a.width=8,a.height=128;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,0,128);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.78,"rgba(255,255,255,0)"),n.addColorStop(.88,"rgba(255,255,255,0.85)"),n.addColorStop(.94,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0.75)"),o.fillStyle=n,o.fillRect(0,0,8,128);const s=new st(a);return s.flipY=!1,s.needsUpdate=!0,s}function Oi(t){const e=t.replace("#","");return[parseInt(e.slice(0,2),16),parseInt(e.slice(2,4),16),parseInt(e.slice(4,6),16)]}const Ci=t=>t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4),hM=t=>t<=.0031308?t*12.92:1.055*Math.pow(t,1/2.4)-.055,cM=42,dM=.7,x0=.66;function pc(t){const[e,a,o]=Oi(t).map(y=>y/255),n=Math.max(e,a,o),s=Math.min(e,a,o),i=(n+s)/2,r=n-s,l=r===0?0:r/(1-Math.abs(2*i-1));let h=0;r!==0&&(n===e?h=60*((a-o)/r%6):n===a?h=60*((o-e)/r+2):h=60*((e-a)/r+4)),h<0&&(h+=360);let c=cM-h;c>180&&(c-=360),c<-180&&(c+=360);const d=(h+c*dM+360)%360,p=(1-Math.abs(2*x0-1))*l,u=p*(1-Math.abs(d/60%2-1)),m=x0-p/2,f=Math.floor(d/60)%6,w=[[p,u,0],[u,p,0],[0,p,u],[0,u,p],[u,0,p],[p,0,u]][f].map((y,v)=>Math.max(y+m,[e,a,o][v])),b=y=>Math.round(Math.min(1,y)*255).toString(16).padStart(2,"0");return`#${b(w[0])}${b(w[1])}${b(w[2])}`}function v0(t,e){const a=/rgb\((\d+),(\d+),(\d+)\)/.exec(io(t,e)),o=Oi(pc(t)).map(s=>Ci(s/255)),n=[1,2,3].map(s=>Ci(Number(a[s])/255));return .2126*o[0]*n[0]+.7152*o[1]*n[1]+.0722*o[2]*n[2]}const k0="#F5475E";function No(t,e){if(t===k0)return e;const a=v0(k0,e);let o=0,n=2;for(let s=0;s<28;s++){const i=(o+n)/2;v0(t,i)<a?o=i:n=i}return(o+n)/2}function io(t,e){const a=Oi(t).map(r=>Ci(r/255)),o=Oi(pc(t)).map(r=>Ci(r/255)),n=a.map((r,l)=>r/Math.max(1e-6,o[l])),s=Math.max(0,Math.min(1,e-1)),i=n.map(r=>Math.round(255*hM(e<=1?r*Math.max(0,e):r+(1-r)*s)));return`rgb(${i[0]},${i[1]},${i[2]})`}function pM(t,e){const n=document.createElement("canvas");n.width=128,n.height=128;const s=n.getContext("2d"),i=document.createElement("canvas");i.width=128,i.height=128;const r=i.getContext("2d"),l=x=>{const M=Math.round(255*x);return`rgb(${M},${M},${M})`},h=1.9*t,c=3.3*t+.7,d=x=>64*(Nn+.13*Math.sin(x*3+h)+.06*Math.sin(x*5+c)),p=x=>{x.beginPath();const M=96;for(let R=0;R<=M;R++){const T=R/M*Math.PI*2,N=d(T),I=64+Math.cos(T)*N,F=64+Math.sin(T)*N;R===0?x.moveTo(I,F):x.lineTo(I,F)}x.closePath()},u=()=>p(s);u();const m=s.createLinearGradient(128*.18,128*.12,128*.86,128*.92);m.addColorStop(0,io(e,No(e,D4))),m.addColorStop(.5,io(e,No(e,L4))),m.addColorStop(1,io(e,No(e,N4))),s.fillStyle=m,s.fill(),p(r),r.fillStyle=l(C4),r.fill(),s.save(),u(),s.clip(),r.save(),p(r),r.clip();const f=.45,g=1/Math.sqrt(.5+.5*f*f),w=(x,M,R,T,N)=>{const I=64+x*128,F=64+M*128,L=R*128*g,H=(z,Y)=>{const A=z.createRadialGradient(I,F,0,I,F,L),C=D=>`rgba(${Y[0]},${Y[1]},${Y[2]},${D})`;A.addColorStop(0,C(1)),A.addColorStop(f,C(1)),A.addColorStop(1,C(0)),z.fillStyle=A,z.beginPath(),z.arc(I,F,L,0,Math.PI*2),z.fill()},P=/rgb\((\d+),(\d+),(\d+)\)/.exec(T);H(s,[Number(P[1]),Number(P[2]),Number(P[3])]);const j=Math.round(255*N);H(r,[j,j,j])},b=t*1.7;for(let x=0;x<7;x++){const M=b+x*2.399963,R=.075+.215*Math.sqrt((x+.55)/7),T=.08-.005*x,N=H4-.055*x;w(Math.cos(M)*R,Math.sin(M)*R,T,io(e,No(e,N)),F4)}w(-.06+.05*t,.2,.075,io(e,No(e,p0)),d0),w(.2-.04*t,-.17,.055,io(e,No(e,p0*.85)),d0),s.restore(),r.restore();const y=s.getImageData(0,0,128,128),v=y.data,k=r.getImageData(0,0,128,128).data;for(let x=0;x<v.length;x+=4){const M=v[x+3];if(M===0){v[x]=0,v[x+1]=0,v[x+2]=0;continue}const R=M/255;v[x]=Math.round(v[x]*R),v[x+1]=Math.round(v[x+1]*R),v[x+2]=Math.round(v[x+2]*R),v[x+3]=Math.round(k[x]*R)}s.putImageData(y,0,0);const E=new st(n);return E.colorSpace=Ni,E.needsUpdate=!0,E}const uM=.26,fM=2.4,mM=1.65,M0=.36,gM=.64,wM=.66,bM=.4,yM=.78,xM=1.25,vM=6;function kM(){const e=document.createElement("canvas");e.width=128,e.height=128;const a=e.getContext("2d"),o=a.createRadialGradient(128/2,128/2,0,128/2,128/2,128/2);o.addColorStop(0,"rgba(255,255,255,0.22)"),o.addColorStop(.44,"rgba(255,255,255,0.34)"),o.addColorStop(.62,"rgba(255,255,255,0.78)"),o.addColorStop(.82,"rgba(255,255,255,0.90)"),o.addColorStop(.88,"rgba(70,70,70,0.86)"),o.addColorStop(.96,"rgba(48,48,48,0.55)"),o.addColorStop(1,"rgba(40,40,40,0)"),a.fillStyle=o,a.fillRect(0,0,128,128);const n=new st(e);return n.needsUpdate=!0,n}function MM(t){const e=/^#?([0-9a-f]{6})$/i.exec(t.trim());if(!e)return t;const a=parseInt(e[1],16),o=(a>>16&255)/255,n=(a>>8&255)/255,s=(a&255)/255,i=Math.max(o,n,s),r=Math.min(o,n,s),l=i-r;let h=0;l>1e-6&&(i===o?h=(n-s)/l%6:i===n?h=(s-o)/l+2:h=(o-n)/l+4,h*=60,h<0&&(h+=360));const c=(i+r)/2,d=l<1e-6?0:l/(1-Math.abs(2*c-1)),p=c>=yM?bM:Math.max(c,wM),u=Math.min(1,d*xM),m=(1-Math.abs(2*p-1))*u,f=m*(1-Math.abs(h/60%2-1)),g=p-m/2;let w=0,b=0,y=0;h<60?(w=m,b=f):h<120?(w=f,b=m):h<180?(b=m,y=f):h<240?(b=f,y=m):h<300?(w=f,y=m):(w=m,y=f);const v=k=>Math.round((k+g)*255).toString(16).padStart(2,"0");return`#${v(w)}${v(b)}${v(y)}`}function EM(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=[[.5,.02],[.78,.32],[.68,.98],[.32,.98],[.22,.32],[.5,.02]];a.beginPath(),o.forEach(([i,r],l)=>{const h=i*64,c=r*64;l===0?a.moveTo(h,c):a.lineTo(h,c)}),a.closePath();const n=a.createLinearGradient(64*.3,0,64*.6,64);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.45,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0.55)"),a.fillStyle=n,a.fill(),a.beginPath(),a.moveTo(64*.5,64*.05),a.lineTo(64*.62,64*.34),a.lineTo(64*.5,64*.5),a.lineTo(64*.4,64*.3),a.closePath(),a.fillStyle="rgba(255,255,255,0.9)",a.fill();const s=new st(e);return s.needsUpdate=!0,s}function TM(t,e,a,o){const n=[],s=[],i=Math.PI*2/a,r=i*o,l=6;let h=0;for(let d=0;d<a;d++){const p=d*i;for(let u=0;u<=l;u++){const m=p+u/l*r;n.push(Math.sin(m)*t,0,Math.cos(m)*t),n.push(Math.sin(m)*e,0,Math.cos(m)*e)}for(let u=0;u<l;u++){const m=h+u*2;s.push(m,m+1,m+2,m+1,m+3,m+2)}h+=(l+1)*2}const c=new Zn;return c.setAttribute("position",new ri(n,3)),c.setIndex(s),c.computeVertexNormals(),c}function ml(t,e){const a=V.degToRad(V.clamp(e,1,360))/2,o=Math.max(8,Math.round(e/8)),n=[0,0,0],s=[.5,0];for(let l=0;l<=o;l++){const h=-a+l/o*a*2;n.push(Math.sin(h)*t,0,Math.cos(h)*t),s.push(l/o,1)}const i=[];for(let l=1;l<o+1;l++)i.push(0,l,l+1);const r=new Zn;return r.setAttribute("position",new ri(n,3)),r.setAttribute("uv",new ri(s,2)),r.setIndex(i),r.computeVertexNormals(),r}function SM(t,e=8,a=.45){const o=e*2,n=[0,0,0];for(let r=0;r<=o;r++){const l=r/o*Math.PI*2,h=r%2===0?t:t*a;n.push(Math.sin(l)*h,0,Math.cos(l)*h)}const s=[];for(let r=1;r<o+1;r++)s.push(0,r,r+1);const i=new Zn;return i.setAttribute("position",new ri(n,3)),i.setIndex(s),i.computeVertexNormals(),i}const AM=96,RM=10,IM=16,E0=.09,T0=.2;function S0(t,e,a){const o=t.clone().convertLinearToSRGB(),n=e.clone().convertLinearToSRGB();return o.lerp(n,a).convertSRGBToLinear()}function OM(t,e){return t.clone().convertLinearToSRGB().multiplyScalar(e).convertSRGBToLinear()}function gl(t){t.traverse(e=>{const a=e.material;if(a)for(const o of Array.isArray(a)?a:[a])o.userData?.__ownMat&&o.dispose()})}class CM{group=new le;projectilePool=new Map;shellPool=new Map;splatPool=new Map;trailPool=new Map;medikitPool=new Map;materialCache=new Map;transientEffects=[];unionScopes=[];pendingUnion=null;unionCores=[];unionMemberState=new WeakMap;unionMatState=new WeakMap;unionFrame=0;unionPointScratch=new fe;unionCentreScratch=new fe;unionDistScratch=[];unionSortScratch=[];castTelegraphs=new Map;lastSyncElapsedMs=0;projectileGeo=new ct(et(10),10,8);splatGeo=new wo(2*et(Tl)/Nn,2*et(Tl)/Nn);trailGeo=new wo(2*et(zt.radius)/Nn,2*et(zt.radius)/Nn);medikitBodyGeo=new gt(so,ho,so);medikitArmXGeo=new gt(so*.66,ho*.16,so*.24);medikitArmZGeo=new gt(so*.24,ho*.16,so*.66);medikitBodyMat=qe({color:"#FBFDFF",roughness:.42});medikitCrossMat=qe({color:"#FF2F45",roughness:.38,emissive:"#7A0A16",emissiveIntensity:.55});glazeTexByColor=new Map;glazeTexFor(e){let a=this.glazeTexByColor.get(e);return a||(a=Array.from({length:dl},(o,n)=>pM(n,e)),this.glazeTexByColor.set(e,a)),a}haloTex=kM();haloMats=new Map;shellBox=new $n;shellSize=new fe;splatMats=this.glazeTexFor(c0).map(e=>this.groundMarkMat(c0,e));trailMats=[];trailMatsFor(e){let a=this.trailMats[e];if(!a){const o=h0[e]??h0[0];a=this.glazeTexFor(o).map(n=>this.groundMarkMat(o,n)),this.trailMats[e]=a}return a}groundMarkMat(e,a){const o=tM(ug(pc(e),{transparent:!0,opacity:1}));return o.userData.markColor=e,o.map=a,o.blending=z0,o.blendEquation=ni,o.blendSrc=Ml,o.blendDst=Tc,o.blendEquationAlpha=ni,o.blendSrcAlpha=Ml,o.blendDstAlpha=Tc,o.needsUpdate=!0,o}glowTex=aM();coreTex=oM();softDiscTex=nM();starTex=sM();streakTex=iM();shardTex=EM();wedgeGradientTex=rM();telegraphRimTex=lM();particles=[];wedges=[];rings=[];wedgeGeoCache=new Map;ringUnitGeo=new Da(.62,1,40);wardGeo=TM(x4,v4,k4,M4);statusBySlot=[];buildStatusVisual;ensureSlots(e){for(;this.statusBySlot.length<e;)this.statusBySlot.push(this.buildStatusVisual()),this.slowSplashState.push({lastX:NaN,lastY:NaN,distAccum:0}),this.statusSnapshot.push({x:NaN,y:NaN,stunReady:!0,slowReady:!0})}slowSplashState=[];statusSnapshot=[];constructor(e){this.group.name="vfx_layer",e.add(this.group);for(let o=0;o<AM;o++){const n=new Pt({map:this.glowTex,color:16777215,transparent:!0,opacity:0,depthWrite:!1,blending:ot}),s=new Oa(n);s.visible=!1,s.renderOrder=10,this.group.add(s),this.particles.push({sprite:s,mat:n,active:!1,life:0,maxLife:1,vx:0,vy:0,vz:0,gravity:0,startScale:1,endScale:1,startOpacity:1,endOpacity:0,fadeEase:1,aspect:1})}for(let o=0;o<Z4;o++){const n=new Pt({map:this.coreTex,color:16777215,transparent:!0,opacity:0,depthWrite:!1,depthTest:!1,blending:ot}),s=new Oa(n);s.name="vfx_union_core",s.visible=!1,s.renderOrder=9,this.group.add(s),this.unionCores.push({sprite:s,mat:n,busy:!1})}for(let o=0;o<RM;o++){const n=new K({color:16777215,map:this.wedgeGradientTex,transparent:!0,opacity:0,side:be,depthWrite:!1}),s=new S(ml(.01,10),n);s.visible=!1,s.renderOrder=5,this.group.add(s),this.wedges.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startOpacity:.6})}for(let o=0;o<IM;o++){const n=new K({color:16777215,transparent:!0,opacity:0,side:be,depthWrite:!1,blending:ot}),s=new S(this.ringUnitGeo,n);s.rotation.x=-Math.PI/2,s.visible=!1,s.renderOrder=6,this.group.add(s),this.rings.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startScale:.1,targetScale:1,startOpacity:.9})}const a=()=>{const o=new K({color:O4,transparent:!0,opacity:0,side:be,depthWrite:!1}),n=new S(new Da(.55,.95,28),o);n.rotation.x=-Math.PI/2,n.visible=!1,n.renderOrder=3,this.group.add(n);const s=new K({color:I4,transparent:!0,opacity:0,side:be,depthWrite:!1}),i=new S(new Da(.64,.86,28),s);i.rotation.x=-Math.PI/2,i.visible=!1,i.renderOrder=4,this.group.add(i);const r=new Pt({map:this.softDiscTex,color:E4,transparent:!0,opacity:0,depthTest:!1,depthWrite:!1}),l=new Oa(r);l.scale.set(T4,S4,1),l.visible=!1,l.renderOrder=8,this.group.add(l);const h=[];for(let p=0;p<y4;p++){const u=new Pt({map:this.starTex,color:"#FFE75E",transparent:!0,opacity:0,depthWrite:!1,blending:ot}),m=new Oa(u);m.scale.set(s0,s0,1),m.visible=!1,m.renderOrder=11,this.group.add(m),h.push(m)}const c=new K({color:cl,transparent:!0,opacity:0,side:be,depthWrite:!1}),d=new S(this.wardGeo,c);return d.visible=!1,d.renderOrder=2,this.group.add(d),{slowRing:i,slowRingDark:n,slowTint:l,stunStars:h,wardRing:d,wardMat:c,wardPop:0,wardPopColor:new na(cl)}};this.buildStatusVisual=a,this.ensureSlots(2),window.__vfxSpawnTest=(o,n,s,i=14,r="#FFC93C",l,h,c)=>{const d=l??"hamburger",p=h?ce[d]?.weapons?.find(u=>u.key===h):void 0;if(o==="impact")this.spawnImpactBurst(n,s,r,i,p?{weapon:p,characterId:d,fromXWU:n-60,fromYWU:s}:void 0);else if(o==="death")this.spawnDeathBurst(n,s,r);else if(o==="heal")this.spawnHealPulse(n,s);else if(o==="puddleSplash"){const u=Ne(n,s);this.spawnPuddleSplash(u.x,u.z)}else if(o==="meleeArc")this.spawnMeleeArc(n,s,{x:1,y:0},p?.range??70,p?.cone??80,p?.color??r);else if(o==="giantSlam")this.spawnGiantSlamShockwave(n,s,p?.color??r,p?.range??ro.ultimateSlam);else if(o==="coverScuff")this.spawnCoverScuff(n,s,p?.color??r,1,0);else if(o==="castTelegraph"){const u=p??{key:"qa",name:"qa",type:"melee",range:84,cone:100,damage:i,cooldown:1,color:r,effect:null},m=c??u.castMs??1100;this.spawnCastTelegraph(0,n,s,{x:1,y:0},u,d,m)}else if(o==="weaponFired"){const u=p??{key:"qa",name:"qa",type:"ranged",range:100,damage:i,cooldown:1,color:r,effect:null};this.spawnWeaponCast(n,s,{x:1,y:0},u,d)}else{const u=p??{key:"qa",name:"qa",type:"ranged",range:100,damage:i,cooldown:1,color:r,effect:null};this.spawnCastFlash(n,s,{x:1,y:0},u,d)}},window.__vfxLayer=this}sync(e){const a=je(e);this.ensureSlots(a.length);const o=s=>({x:s.x,y:s.y,hp:s.hp,alive:s.alive,terrainSlowFactor:s.terrainSlowFactor});window.__vfxDebugFighters={player:o(a[0]),enemy:o(a[1]??a[0]),slots:a.map(o)};const n=Math.max(0,(e.elapsed-this.lastSyncElapsedMs)/1e3);this.lastSyncElapsedMs=e.elapsed,On(this.projectilePool,this.group,e.projectiles,s=>{const i=At(e,s.ownerId,s.ownerRole),r=In(i.characterId,s.weapon.key);if(r?.projectile){const h=Ne(s.x,s.y),c=fl(s.vx,s.vy),d={THREE:gn,position:new fe(h.x,Fo,h.z),direction:new fe(c.x,0,c.y),color:s.color,damage:s.damage,weapon:s.weapon,characterId:i.characterId,spawnTransient:(u,m,f)=>this.spawnTransientObject(u,m,f)},p=r.projectile(d);return g0(p),p.userData.weaponVfx=r,p.name=`projectile:${i.characterId}.${s.weapon.key}`,this.measureShell(p),p}const l=new S(this.projectileGeo,this.materialFor(s.color));return l.name=`projectile:${i.characterId}.${s.weapon.key}`,this.measureShell(l),l},(s,i)=>{const r=At(e,i.ownerId,i.ownerRole),l=s.userData.weaponVfx,h=Ne(i.x,i.y),c=s.userData.shellSpec?.scale??1;if(!l){const u=s;if(u.material=this.materialFor(i.color),i.arrived){const m=(i.peckTimer??0)/500,f=1+Math.sin(m*Math.PI)*.5;u.scale.setScalar(f*c)}else u.scale.setScalar(c);u.position.set(h.x,Fo,h.z);return}s.position.set(h.x,Fo,h.z);const d=fl(i.vx,i.vy);(d.x!==0||d.y!==0)&&(s.rotation.y=Math.atan2(d.x,d.y));const p=s.userData.__authoredScale??=s.scale.clone();if(s.scale.copy(p),l.trail){const u={THREE:gn,position:s.position.clone(),direction:new fe(d.x,0,d.y),color:i.color,damage:i.damage,weapon:i.weapon,characterId:r.characterId,spawnTransient:(m,f,g)=>this.spawnTransientObject(m,f,g),object:s,dt:n};l.trail(u)}p.copy(s.scale),s.scale.multiplyScalar(c)}),On(this.shellPool,this.group,e.projectiles,s=>{const r=`${At(e,s.ownerId,s.ownerRole).characterId}.${s.weapon.key}`,h=this.projectilePool.get(s.id)?.userData.shellSpec?.haloR??M0,c=new le;c.name=`projectile_shell:${r}`;let d=this.haloMats.get(s.color);d||(d=new Pt({map:this.haloTex,color:new na(MM(s.color)),transparent:!0,opacity:1,depthWrite:!1}),this.haloMats.set(s.color,d));const p=new Oa(d);return p.name=`projectile_halo:${r}`,p.scale.set(h*2,h*2,1),p.renderOrder=vM,c.add(p),c},(s,i)=>{const r=Ne(i.x,i.y);s.position.set(r.x,Fo,r.z)}),On(this.splatPool,this.group,e.splats,s=>{const i=new S(this.splatGeo,this.splatMats[s.id%dl]);return i.name="vfx_ground_mark",i.rotation.set(-Math.PI/2,0,y0(s.id)),i},(s,i)=>{const r=Ne(i.x,i.y);s.position.set(r.x,h4,r.z)}),On(this.medikitPool,this.group,e.medikits,()=>{const s=new le;s.name="vfx_medikit";const i=new S(this.medikitBodyGeo,this.medikitBodyMat);i.name="vfx_medikit_body",s.add(i);for(const r of[this.medikitArmXGeo,this.medikitArmZGeo]){const l=new S(r,this.medikitCrossMat);l.name="vfx_medikit_cross",l.position.y=ho*.5,s.add(l)}return s},(s,i)=>{const r=Ne(i.x,i.y),l=d4+ho*.5+o0,h=i.armsAt-e.elapsed;if(h>0){const d=Ne(i.fromX,i.fromY),p=1-h/ht.popMs;s.position.set(d.x+(r.x-d.x)*p,l+4*p4*p*(1-p),d.z+(r.z-d.z)*p),s.rotation.set(Math.PI*2*p,Math.PI*3*p,0)}else{const d=e.elapsed-i.armsAt;s.position.set(r.x,l+Math.sin(d*u4)*o0,r.z),s.rotation.set(0,d*f4,0)}const c=i.expiresAt-e.elapsed;s.scale.setScalar(c<m4&&c>0?1+Math.sin(c*.03)*.14:1)}),On(this.trailPool,this.group,e.trailMarks,s=>{const i=new S(this.trailGeo,this.trailMatsFor(ua(s.ownerId,s.ownerRole))[s.id%dl]);return i.name="vfx_ground_mark",i.rotation.set(-Math.PI/2,0,y0(s.id)),i},(s,i)=>{const r=Ne(i.x,i.y),l=(e.elapsed+i.id*137)*.004,h=1+Math.sin(l)*.08;s.position.set(r.x,c4,r.z),s.scale.setScalar(h)}),a.forEach((s,i)=>{const r=this.statusBySlot[i];if(!r)return;const l=Ne(s.x,s.y),h=s.alive&&s.terrainSlowFactor<1,c=s.alive&&e.elapsed<s.status.slowedUntil,d=h||c;if(r.slowRing.visible=d,r.slowRingDark.visible=d,r.slowTint.visible=d,d){const v=.9+Math.sin(e.elapsed*.0035)*.12,k=e.elapsed*.0012;r.slowRingDark.position.set(l.x,Us-.01,l.z),r.slowRingDark.scale.setScalar(v),r.slowRingDark.rotation.z=k,r.slowRingDark.material.opacity=.5,r.slowRing.position.set(l.x,Us,l.z),r.slowRing.scale.setScalar(v),r.slowRing.rotation.z=k,r.slowRing.material.opacity=.9,r.slowTint.position.set(l.x,A4,l.z);const E=R4+Math.sin(e.elapsed*.006)*.08;r.slowTint.material.opacity=E}const p=this.slowSplashState[i];if(h){if(Number.isFinite(p.lastX))for(p.distAccum+=Math.hypot(s.x-p.lastX,s.y-p.lastY);p.distAccum>=l0;)p.distAccum-=l0,this.spawnPuddleSplash(l.x,l.z)}else p.distAccum=0;p.lastX=s.x,p.lastY=s.y;const u=e.elapsed>=wi(s,"stun"),m=e.elapsed>=wi(s,"slow");this.statusSnapshot[i]={x:s.x,y:s.y,stunReady:u,slowReady:m};const f=s.alive&&!u&&e.elapsed>=s.status.stunnedUntil,g=s.alive&&!m&&e.elapsed>=s.status.slowedUntil,w=f||g,b=r.wardPop>0?r.wardPop/r0:0;r.wardRing.visible=w||b>0,r.wardRing.visible&&(r.wardRing.position.set(l.x,Us-.02,l.z),r.wardRing.rotation.y=-e.elapsed*.0019,r.wardRing.scale.setScalar(1+.5*b),r.wardMat.opacity=w?i0+(1-i0)*b:b,r.wardMat.color.copy(cl).lerp(r.wardPopColor,b));const y=s.alive&&e.elapsed<s.status.stunnedUntil;r.stunStars.forEach((v,k)=>{if(v.visible=y,!y)return;const E=e.elapsed*.006+k*Math.PI*2/r.stunStars.length;v.position.set(l.x+Math.cos(E)*n0,b4+Math.sin(e.elapsed*.01+k)*.05,l.z+Math.sin(E)*n0),v.material.opacity=.95})})}updateEffects(e){for(const a of this.particles){if(!a.active)continue;if(a.life+=e,a.life>=a.maxLife){a.active=!1,a.sprite.visible=!1;continue}const o=a.life/a.maxLife;a.vy+=a.gravity*e,a.sprite.position.x+=a.vx*e,a.sprite.position.y+=a.vy*e,a.sprite.position.z+=a.vz*e;const n=V.lerp(a.startScale,a.endScale,b0(o));a.sprite.scale.set(n,n*a.aspect,1),a.mat.opacity=Math.max(0,V.lerp(a.startOpacity,a.endOpacity,Math.pow(o,a.fadeEase)))}for(const a of this.wedges){if(!a.active)continue;if(a.life+=e,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife;a.mat.opacity=a.startOpacity*(1-Math.pow(o,1.8))}for(const a of this.rings){if(!a.active)continue;if(a.life+=e,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife,n=V.lerp(a.startScale,a.targetScale,b0(o));a.mesh.scale.set(n,n,n),a.mat.opacity=a.startOpacity*(1-o)}for(const a of this.statusBySlot)a.wardPop>0&&(a.wardPop=Math.max(0,a.wardPop-e));for(let a=this.transientEffects.length-1;a>=0;a--){const o=this.transientEffects[a];if(o.life+=e,o.life>=o.maxLife){this.group.remove(o.object),gl(o.object),o.telegraphOwner!==void 0&&this.castTelegraphs.get(o.telegraphOwner)===o.object&&this.castTelegraphs.delete(o.telegraphOwner),this.detachUnionMember(o),this.transientEffects.splice(a,1);continue}o.onUpdate?.(o.life/o.maxLife,o.life)}this.updateUnionScopes(e)}spawnTransientObject(e,a,o,n){fm(e),g0(e),this.group.add(e);const s=this.pendingUnion;s&&(s.members.push(e),this.unionMemberState.set(e,Q4(e)),s.maxLife=Math.max(s.maxLife,Math.max(.001,a)),Ia.members++),this.transientEffects.push({object:e,life:0,maxLife:Math.max(.001,a),onUpdate:o,telegraphOwner:n,union:s??void 0})}openUnionScope(e,a){this.pendingUnion={cx:e.x,cy:Ra,cz:e.z,members:[],life:0,maxLife:0,core:null,color:a}}closeUnionScope(){const e=this.pendingUnion;if(this.pendingUnion=null,!e)return;if(Ia.scopes++,e.members.length<J4){Ia.inert++;return}const a=this.unionCores.find(o=>!o.busy)??null;a?(a.busy=!0,a.sprite.visible=!0,a.sprite.position.set(e.cx,e.cy,e.cz),a.sprite.scale.set(ul,ul,1),a.mat.color.set(e.color).lerp(vt,W4),a.mat.opacity=0,e.core=a,Ia.cores++):Ia.coresStarved++,this.unionScopes.push(e)}detachUnionMember(e){if(!e.union)return;const a=e.union.members.indexOf(e.object);a>=0&&e.union.members.splice(a,1)}releaseUnionCore(e){e.core&&(e.core.busy=!1,e.core.sprite.visible=!1,e.core.mat.opacity=0,e.core=null)}updateUnionScopes(e){this.unionFrame++;for(let a=this.unionScopes.length-1;a>=0;a--){const o=this.unionScopes[a];if(o.life+=e,o.members.length===0||o.life>=o.maxLife){this.releaseUnionCore(o),this.unionScopes.splice(a,1);continue}const n=this.unionDistScratch;n.length=0;for(const p of o.members){if(!eM(p,this.unionPointScratch)){n.push(-1);continue}n.push(this.unionPointScratch.distanceTo(this.unionCentreScratch.set(o.cx,o.cy,o.cz)))}const s=this.unionSortScratch;s.length=0;for(const p of n)p>=0&&s.push(p);if(s.length===0)continue;s.sort((p,u)=>p-u);const i=s[Math.min(s.length-1,Math.floor(s.length*X4))],r=V.clamp(i,ul,K4);let l=0,h=0;for(let p=0;p<o.members.length;p++){const u=n[p];if(u<0)continue;const m=this.unionMemberState.get(o.members[p]);if(!m||m.mats.length===0)continue;const f=Math.min(1,u/r);l+=1-w0*f*f,h++}if(h===0)continue;const c=l>1e-9?h/l:1;for(let p=0;p<o.members.length;p++){const u=n[p];if(u<0)continue;const m=this.unionMemberState.get(o.members[p]);if(!m||m.mats.length===0)continue;const f=Math.min(1,u/r),g=(1-w0*f*f)*c;for(const w of m.mats){const b=w.opacity;let y=this.unionMatState.get(w);y||(y={frame:-1,base:b,written:NaN},this.unionMatState.set(w,y)),y.frame!==this.unionFrame?(y.base=y.written===b?y.base:b,y.frame=this.unionFrame):Ia.aliasTouches++;const v=Math.min(1,y.base*g);y.written=v,w.opacity=v}}const d=o.core;if(d){const p=Math.min(1,o.life/Y4),u=2*r*j4;d.sprite.position.set(o.cx,o.cy,o.cz),d.sprite.scale.set(u,u,1),d.mat.opacity=G4*Math.pow(1-p,V4),p>=1&&this.releaseUnionCore(o)}}}spawnCastTelegraph(e,a,o,n,s,i,r){if(!(r>0))return;const l=s.range??0;if(!(l>0))return;la("castTelegraph"),this.cancelCastTelegraph(e,"resolved");const h=Ne(a,o),c=s.type==="melee"?s.cone??360:Math.max(12,s.spreadDeg??18),d=et(l),p=In(i,s.key)?.telegraph,u=s.giantSlam!==!0;if(!u&&!p)return;const m=`${Math.round(c)}_${d.toFixed(3)}`;let f=this.wedgeGeoCache.get(m);f||(f=ml(d,c),this.wedgeGeoCache.set(m,f));const g=new na(s.color),w=Math.atan2(n.x,n.y),b=(F,L,H,P,j)=>{const z=new K({color:L,map:j?this.telegraphRimTex:null,transparent:!0,opacity:0,depthWrite:!1,side:be});z.userData.__ownMat=!0;const Y=new S(f,z);return Y.name=F,Y.rotation.y=w,Y.position.set(0,H,0),Y.renderOrder=P,Y},y=new le;y.name="castTelegraph",y.position.set(h.x,to,h.z);const v=u?b("castTelegraphBase",OM(g,.26),0,5,!1):null,k=u?b("castTelegraphFill",S0(g,vt,.22),.012,5.01,!1):null,E=u?b("castTelegraphRim",S0(g,vt,.6),.024,5.02,!0):null;v&&k&&E&&y.add(v,k,E);const x=r/1e3,M=v?.material,R=k?.material,T=E?.material;this.castTelegraphs.set(e,y);const N=(F,L)=>{if(!v||!k||!E||!M||!R||!T)return;const H=V.clamp(L/x,0,1),P=L<=x?1:Math.max(0,1-(L-x)/E0),j=.5+.5*Math.sin(Math.PI*2*(2*H+3*H*H));M.opacity=(.6+.14*j)*P;const z=.1+.9*H;k.scale.set(z,1,z),R.opacity=(.7+.22*H)*P,T.opacity=(.62+.36*H*H)*P};if(N(0,0),this.spawnTransientObject(y,x+E0,N,e),!p)return;const I={THREE:gn,position:new fe(h.x,hl,h.z),direction:new fe(n.x,0,n.y).normalize(),color:s.color,damage:s.damage,weapon:s,characterId:i,castMs:r,spawnTransient:(F,L,H)=>this.spawnTransientObject(F,L,H,e)};p(I)}cancelCastTelegraph(e,a){const o=this.castTelegraphs.get(e);if(o){this.castTelegraphs.delete(e);for(let n=this.transientEffects.length-1;n>=0;n--){const s=this.transientEffects[n];if(s.telegraphOwner===e){if(s.object===o&&a!=="resolved"){const i=s.life,r=o.children.map(l=>l.material.opacity);s.maxLife=i+T0,s.onUpdate=(l,h)=>{const c=V.clamp((h-i)/T0,0,1),d=Math.max(.001,1-c);o.scale.set(d,1,d);for(let p=0;p<o.children.length;p++){const u=o.children[p].material;u.opacity=r[p]*(1-c)}};continue}this.group.remove(s.object),gl(s.object),this.detachUnionMember(s),this.transientEffects.splice(n,1)}}}}spawnWeaponCast(e,a,o,n,s){const i=!!In(s,n.key)?.cast;this.spawnCastFlash(e,a,o,n,s),n.type==="melee"&&(n.giantSlam&&i||this.spawnMeleeArc(e,a,o,n.range??0,n.cone??360,n.color)),n.giantSlam&&this.spawnGiantSlamShockwave(e,a,n.color,n.range??0,{bespokeOwnsGround:i})}spawnCastFlash(e,a,o,n,s){la("cast");const i=Ne(e,a),r=Math.hypot(o.x,o.y)||1,l=o.x/r,h=o.y/r,c=.7,d=n.color,p=In(s,n.key)?.cast;if(this.castMuzzle(i.x+l*c,i.z+h*c,d,p?"subordinate":"primary"),!p)return;const u={THREE:gn,position:new fe(i.x+l*c,hl,i.z+h*c),direction:new fe(l,0,h),color:d,damage:n.damage,weapon:n,characterId:s,spawnTransient:(m,f,g)=>this.spawnTransientObject(m,f,g)};p(u)}castMuzzle(e,a,o,n){const s=n==="primary"?1:.75,i=this.allocParticle();i.active=!0,i.life=0,i.maxLife=n==="primary"?.16:.13,i.sprite.visible=!0,i.sprite.position.set(e,hl,a),i.vx=0,i.vy=0,i.vz=0,i.gravity=0,i.startScale=.75*s,i.endScale=1.3*s,i.startOpacity=1,i.endOpacity=0,i.fadeEase=1.6,i.mat.color.set(o).lerp(vt,.4)}spawnMeleeArc(e,a,o,n,s,i){la("meleeArc");const r=Ne(e,a),l=et(n),h=`${Math.round(s)}_${l.toFixed(3)}`;let c=this.wedgeGeoCache.get(h);c||(c=ml(l,s),this.wedgeGeoCache.set(h,c));const d=this.allocWedge();d.active=!0,d.life=0,d.maxLife=.3,d.startOpacity=.88,d.mesh.visible=!0,d.mesh.geometry=c,d.mesh.rotation.y=Math.atan2(o.x,o.y),d.mesh.position.set(r.x,to,r.z),d.mat.color.set(i).lerp(_4,.14),d.mat.opacity=d.startOpacity}spawnImpactStarDecal(e,a,o,n){const s=`star_${o.toFixed(3)}`;let i=this.wedgeGeoCache.get(s);i||(i=SM(o,8,.42),this.wedgeGeoCache.set(s,i));const r=this.allocWedge();r.active=!0,r.life=0,r.maxLife=n,r.startOpacity=.9,r.mesh.visible=!0,r.mesh.geometry=i,r.mesh.rotation.y=Math.random()*Math.PI*2,r.mesh.position.set(e.x,to+.03,e.z),r.mat.map=null,um(i),r.mat.vertexColors,r.mat.vertexColors=!0,r.mat.needsUpdate=!0,r.mat.color.set(a).lerp(vt,.05),r.mat.opacity=r.startOpacity}spawnImpactBurst(e,a,o,n,s){la("impact");const i=Ne(e,a);(s?.weapon.effect==="stun"||s?.weapon.effect==="slow")&&this.flagStatusRefused(e,a,s.weapon.effect,s.weapon.color);const r=s&&In(s.characterId,s.weapon.key)?.impact;if(this.impactAnchor(i,o,n,r?"subordinate":"primary"),r&&s){let l=0,h=0;if(s.fromXWU!==void 0&&s.fromYWU!==void 0){const d=fl(e-s.fromXWU,a-s.fromYWU);l=d.x,h=d.y}const c={THREE:gn,position:new fe(i.x,Ra,i.z),direction:new fe(l,0,h),color:o,damage:n,weapon:s.weapon,characterId:s.characterId,spawnTransient:(d,p,u)=>this.spawnTransientObject(d,p,u)};this.openUnionScope(i,o);try{r(c)}finally{this.closeUnionScope()}}}impactAnchor(e,a,o,n){const s=n==="primary"?1:g4,i=V.clamp(.42+o*.075,.42,2)*s,r=Math.max(2,Math.round(V.clamp(1+o*.4,2,8)*s));if(n==="primary"){this.burst(e,a,i,r);return}this.burst(e,a,i,0,{skipFlash:!0,skipStreaks:!0,decalMinRadius:w4})}flagStatusRefused(e,a,o,n){for(let s=0;s<this.statusSnapshot.length;s++){const i=this.statusSnapshot[s];if(!Number.isFinite(i.x)||Math.hypot(i.x-e,i.y-a)>1)continue;if(o==="stun"?i.stunReady:i.slowReady)return;const l=this.statusBySlot[s];if(l){l.wardPop=r0,l.wardPopColor.set(n).lerp(vt,.35);return}}}spawnDeathBurst(e,a,o){la("death");const n=Ne(e,a);this.burst(n,o,2.6,9,{life:1.35})}spawnHealPulse(e,a){la("heal");const o=Ne(e,a),n=7;for(let s=0;s<n;s++){const i=this.allocParticle(),r=s/n*Math.PI*2+Math.random()*.5,l=.66+Math.random()*.3;i.active=!0,i.life=0,i.maxLife=.72+Math.random()*.22,i.sprite.visible=!0,i.sprite.position.set(o.x+Math.cos(r)*l,ee*.22,o.z+Math.sin(r)*l),i.vx=Math.cos(r)*.22,i.vz=Math.sin(r)*.22,i.vy=2+Math.random()*.45,i.gravity=-.45,i.startScale=.46+Math.random()*.14,i.endScale=.14,i.startOpacity=.95,i.endOpacity=0,i.fadeEase=1,i.mat.color.set("#6FE0A8")}}spawnPuddleSplash(e,a){la("puddleSplash");const o=5;for(let n=0;n<o;n++){const s=this.allocParticle(),i=n/o*Math.PI*2+Math.random()*1,r=po*(.58+Math.random()*.16);s.active=!0,s.life=0,s.maxLife=.3+Math.random()*.12,s.sprite.visible=!0,s.sprite.position.set(e+Math.cos(i)*r,Us,a+Math.sin(i)*r);const l=2.2+Math.random()*.6;s.vx=Math.cos(i)*l,s.vz=Math.sin(i)*l,s.vy=1.1+Math.random()*.5,s.gravity=-5.5,s.startScale=.58+Math.random()*.2,s.endScale=.12,s.startOpacity=1,s.endOpacity=0,s.fadeEase=1,s.mat.color.set("#E8F8FF")}}spawnCoverScuff(e,a,o,n,s){la("coverScuff");const i=Ne(e,a),r=Math.hypot(n,s),l=r>1e-4?-n/r:0,h=r>1e-4?-s/r:-1,c=this.allocParticle();c.active=!0,c.life=0,c.maxLife=.12,c.sprite.visible=!0,c.sprite.position.set(i.x,Fo,i.z),c.vx=0,c.vy=0,c.vz=0,c.gravity=0,c.startScale=.42,c.endScale=.85,c.startOpacity=1,c.endOpacity=0,c.fadeEase=1.4,c.mat.color.set(o).lerp(vt,.6);for(let d=0;d<5;d++){const p=(Math.random()-.5)*(Math.PI*2/3),u=Math.cos(p),m=Math.sin(p),f=l*u-h*m,g=l*m+h*u,w=this.allocParticle();w.mat.map=this.streakTex,w.mat.rotation=Math.atan2(g,f),w.aspect=.22,w.active=!0,w.life=0,w.maxLife=.22+Math.random()*.1,w.sprite.visible=!0,w.sprite.position.set(i.x+l*.22,Fo,i.z+h*.22),w.vx=f*(2.4+Math.random()*1.6),w.vz=g*(2.4+Math.random()*1.6),w.vy=.9+Math.random()*.7,w.gravity=-7.5,w.startScale=.62+Math.random()*.28,w.endScale=.12,w.startOpacity=1,w.endOpacity=0,w.fadeEase=1.2,w.mat.color.set(u0)}}spawnGiantSlamShockwave(e,a,o,n,s){la("giantSlam");const i=Ne(e,a),r=et(n);if(!(s?.bespokeOwnsGround??!1)){const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=.65,h.startScale=.3,h.targetScale=r*1.05,h.startOpacity=1,h.mesh.visible=!0,h.mesh.position.set(i.x,to+.02,i.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(o).lerp(vt,.3),h.mat.opacity=h.startOpacity;const c=this.allocRing();c.active=!0,c.life=0,c.maxLife=.8,c.startScale=.15,c.targetScale=r*.85,c.startOpacity=.6,c.mesh.visible=!0,c.mesh.position.set(i.x,to+.01,i.z),c.mesh.scale.setScalar(c.startScale),c.mat.color.set(o),c.mat.opacity=c.startOpacity,this.spawnStarPop(i,Ra*1.5,o,5.2,.38);const d=this.allocParticle();d.active=!0,d.life=0,d.maxLife=.3,d.sprite.visible=!0,d.sprite.position.set(i.x,Ra*1.5,i.z),d.vx=0,d.vy=0,d.vz=0,d.gravity=0,d.startScale=1.8,d.endScale=3.5,d.startOpacity=.9,d.endOpacity=0,d.fadeEase=1.2,d.mat.color.set(o).lerp(vt,.4),this.spawnStreaks(i,Ra*.6,"#FFE79A",10,4.5,.55)}this.burst(i,o,3.2,14,{life:.9,speedMult:1.7,skipFlash:!0,skipRing:!0,skipStreaks:!0,skipDecal:!0})}burst(e,a,o,n,s){const i=s?.life??1,r=s?.speedMult??1;if(s?.skipDecal||this.spawnImpactStarDecal(e,a,V.clamp(.65*o,s?.decalMinRadius??.55,1.5),(.55+o*.08)*i),!s?.skipFlash){const h=this.allocParticle();h.active=!0,h.life=0,h.maxLife=(.16+o*.04)*i,h.sprite.visible=!0,h.sprite.position.set(e.x,Ra,e.z),h.vx=0,h.vy=0,h.vz=0,h.gravity=0,h.startScale=.5*o,h.endScale=1.15*o,h.startOpacity=1,h.endOpacity=0,h.fadeEase=1.4,h.mat.color.set(a).lerp(vt,.3)}if(!s?.skipRing){const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=(.24+o*.06)*i,h.startScale=.15,h.targetScale=.6*o+.35,h.startOpacity=.95,h.mesh.visible=!0,h.mesh.position.set(e.x,to,e.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(a).lerp(vt,.25),h.mat.opacity=h.startOpacity;const c=this.allocRing();c.active=!0,c.life=0,c.maxLife=(.32+o*.08)*i,c.startScale=.1,c.targetScale=(.6*o+.35)*1.35,c.startOpacity=.55,c.mesh.visible=!0,c.mesh.position.set(e.x,to-.01,e.z),c.mesh.scale.setScalar(c.startScale),c.mat.color.set(a),c.mat.opacity=c.startOpacity}if(!s?.skipStreaks){const h=Math.max(4,Math.round(n*.7));this.spawnStreaks(e,Ra,"#FFE79A",h,(.5+o*.5)*r,.26*i)}const l=.4*o;for(let h=0;h<n;h++){const c=this.allocParticle();c.mat.map=this.shardTex;const d=Math.random()*Math.PI*2;c.mat.rotation=d,c.aspect=.4+Math.random()*.15;const p=(2.6+Math.random()*2.8)*(.6+o*.4)*r,u=.18+Math.random()*.24;c.active=!0,c.life=0,c.maxLife=(.36+Math.random()*.22+o*.06)*i,c.sprite.visible=!0,c.sprite.position.set(e.x+Math.cos(d)*u,Ra,e.z+Math.sin(d)*u),c.vx=Math.cos(d)*p,c.vz=Math.sin(d)*p,c.vy=1.3+Math.random()*1.8,c.gravity=-6.2,c.startScale=l*(.8+Math.random()*.5),c.endScale=l*.2,c.startOpacity=1,c.endOpacity=0,c.fadeEase=.85,c.mat.color.set(u0)}}allocParticle(){let e=null;for(const o of this.particles)if(!o.active){e=o;break}if(!e){let o=-1/0;for(const n of this.particles){const s=n.life/n.maxLife;s>o&&(o=s,e=n)}}const a=e;return a.mat.map=this.glowTex,a.mat.rotation=0,a.aspect=1,a}spawnStarPop(e,a,o,n,s){const i=this.allocParticle();i.mat.map=this.starTex,i.active=!0,i.life=0,i.maxLife=s,i.sprite.visible=!0,i.sprite.position.set(e.x,a,e.z),i.vx=0,i.vy=0,i.vz=0,i.gravity=0,i.startScale=n*.5,i.endScale=n,i.startOpacity=1,i.endOpacity=0,i.fadeEase=1.7,i.mat.color.set(o).lerp(vt,.45)}spawnStreaks(e,a,o,n,s,i){for(let r=0;r<n;r++){const l=this.allocParticle();l.mat.map=this.streakTex,l.mat.rotation=Math.random()*Math.PI*2,l.aspect=.22,l.active=!0,l.life=0,l.maxLife=i*(.8+Math.random()*.4),l.sprite.visible=!0,l.sprite.position.set(e.x,a,e.z),l.vx=0,l.vy=0,l.vz=0,l.gravity=0,l.startScale=s*(.7+Math.random()*.3),l.endScale=s*1.35,l.startOpacity=.95,l.endOpacity=0,l.fadeEase=1.3,l.mat.color.set(o).lerp(vt,.3)}}allocWedge(){let e;for(const a of this.wedges)if(!a.active){e=a;break}return e||(e=this.wedges.reduce((a,o)=>a.life/a.maxLife>=o.life/o.maxLife?a:o)),e.mat.map!==this.wedgeGradientTex&&(e.mat.map=this.wedgeGradientTex,e.mat.needsUpdate=!0),e.mat.vertexColors&&(e.mat.vertexColors=!1,e.mat.needsUpdate=!0),e}allocRing(){for(const e of this.rings)if(!e.active)return e;return this.rings.reduce((e,a)=>e.life/e.maxLife>=a.life/a.maxLife?e:a)}clear(){for(const e of[this.projectilePool,this.shellPool,this.splatPool,this.trailPool,this.medikitPool]){for(const a of e.values())this.group.remove(a);e.clear()}for(const e of this.particles)e.active=!1,e.sprite.visible=!1;for(const e of this.wedges)e.active=!1,e.mesh.visible=!1;for(const e of this.rings)e.active=!1,e.mesh.visible=!1;for(const e of this.transientEffects)this.group.remove(e.object),gl(e.object);this.transientEffects.length=0;for(const e of this.unionScopes)this.releaseUnionCore(e);this.unionScopes.length=0,this.pendingUnion=null,this.castTelegraphs.clear(),this.lastSyncElapsedMs=0;for(let e=0;e<this.statusBySlot.length;e++){const a=this.statusBySlot[e];a.slowRing.visible=!1,a.slowRingDark.visible=!1,a.slowTint.visible=!1,a.stunStars.forEach(n=>{n.visible=!1}),a.wardRing.visible=!1,a.wardPop=0,this.statusSnapshot[e]={x:NaN,y:NaN,stunReady:!0,slowReady:!0};const o=this.slowSplashState[e];o.lastX=NaN,o.lastY=NaN,o.distAccum=0}}dispose(){this.clear(),delete window.__vfxSpawnTest,window.__vfxLayer===this&&delete window.__vfxLayer,this.projectileGeo.dispose(),this.splatGeo.dispose(),this.trailGeo.dispose(),this.medikitBodyGeo.dispose(),this.medikitArmXGeo.dispose(),this.medikitArmZGeo.dispose(),this.medikitBodyMat.dispose(),this.medikitCrossMat.dispose(),this.splatMats.forEach(e=>e.dispose()),Object.values(this.trailMats).forEach(e=>e.forEach(a=>a.dispose())),this.glazeTexByColor.forEach(e=>e.forEach(a=>a.dispose())),this.glazeTexByColor.clear(),this.materialCache.forEach(e=>e.dispose()),this.materialCache.clear(),this.haloTex.dispose(),this.haloMats.forEach(e=>e.dispose()),this.haloMats.clear(),this.glowTex.dispose(),this.coreTex.dispose(),this.softDiscTex.dispose(),this.starTex.dispose(),this.streakTex.dispose(),this.shardTex.dispose(),this.wedgeGradientTex.dispose(),this.telegraphRimTex.dispose();for(const e of this.particles)e.mat.dispose();for(const e of this.unionCores)e.mat.dispose();for(const e of this.wedges)e.mat.dispose();for(const e of this.rings)e.mat.dispose();this.wedgeGeoCache.forEach(e=>e.dispose()),this.wedgeGeoCache.clear(),this.ringUnitGeo.dispose(),this.wardGeo.dispose();for(const e of this.statusBySlot)e.slowRing.material.dispose(),e.slowRing.geometry.dispose(),e.slowRingDark.material.dispose(),e.slowRingDark.geometry.dispose(),e.slowTint.material.dispose(),e.stunStars.forEach(a=>a.material.dispose()),e.wardMat.dispose()}measureShell(e){let a=et(10);if(this.shellBox.setFromObject(e),!this.shellBox.isEmpty()){this.shellBox.getSize(this.shellSize);const s=.5*Math.max(this.shellSize.x,this.shellSize.y,this.shellSize.z);s>1e-4&&(a=s)}const o=Math.min(fM,Math.max(1,uM/a)),n=Math.min(gM,Math.max(M0,a*o*mM));e.userData.shellSpec={scale:o,haloR:n}}materialFor(e){let a=this.materialCache.get(e);return a||(a=qe({color:e,roughness:l4,metalness:0}),this.materialCache.set(e,a)),a}}function ah(t,e,a){return Oh(e.x,e.y,a.x,a.y,t.arena,t,a)}function A0(t,e){return je(t)[e.observerSlot??Le]??Qe(t)}function qs(t){return t.phase==="playing"&&!Qe(t).alive}const R0="hud-styles";function FM(){if(document.getElementById(R0))return;const t=document.createElement("style");t.id=R0,t.textContent=HM,document.head.appendChild(t)}function I0(t){const e=Math.max(0,Math.ceil(t/1e3)),a=Math.floor(e/60),o=e%60;return`${a}:${String(o).padStart(2,"0")}`}function NM(t){const e=Math.max(0,Math.round(t/1e3)),a=Math.floor(e/60),o=e%60;return`${a}:${String(o).padStart(2,"0")}`}const O0=.25,C0=.14;function LM(t,e,a,o){const n=o>0?Math.max(0,Math.min(1,a/o)):0;t.style.width=`${(n*100).toFixed(1)}%`,e.textContent=`${Math.max(0,Math.ceil(a))} / ${o}`}function DM(t,e){FM(),xa(),t.innerHTML=`
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
      <!-- ── The fighter nameplates are BUILT, not declared ────────────────────
           state.fighters seats up to MAX_FIGHTERS, so a static two-fighter
           template is a two-fighter game. buildFighterSlots() below inserts one
           block per slot — slot 0 BEFORE this clock and every other slot AFTER it,
           which reproduces the old declaration order (player, clock, enemy) exactly
           at two fighters. The clock stays declared here because it is the one child
           of this bar that is not per-fighter and it is what the others are placed
           relative to. -->
      <div class="hud-topbar" data-el="topbar">
        <div class="hud-clock">
          <!-- ⚠️ THIS PLACEHOLDER HAS NOW BEEN STALE TWICE, WHICH IS THE POINT OF THE
               COMMENT AND THE REASON tools/tmp/rc_prose.mjs GAINED A CLOCK ARM.
               It read 3:00 until 2026-08-11, when MATCH_DURATION_MS was 45_000 — a 4x
               contradiction of the one true source. It then read 0:45 until 2026-08-12,
               when Uri reversed the clock to 150_000 (2:30) in 6d5c4d6. Both times it was
               overwritten by the first update(), so nothing on screen was ever wrong — and
               both times a markup literal sat in the file being read by the next person as
               a statement of fact about the clock. Kept as the full duration rather than
               as an empty string so the element still has its shipped WIDTH before the
               first frame paints; that WIDTH is why the literal cannot simply be dropped,
               and 2:30 is one glyph wider than 0:45, so the reservation grew with it.
               (No backticks in this comment on purpose: the whole block is a template
               literal, and a backtick here closes it — which is exactly how this comment
               failed to compile the first time it was written.) -->
          <div class="hud-timer" data-el="timer">2:30</div>
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
      </div>

      <div class="hud-weapons" data-el="weapons"></div>

      <!-- ── The two equip slots, as buttons ────────────────────────────────
           Declared AFTER the weapon tray and positioned relative to it (see the
           .hud-items rules), because it is the tray's neighbour in every layout:
           directly above it on desktop and in portrait, and a column beside it in
           the landscape corner cluster. Empty until renderItems() sees a local
           fighter carrying something — a player with no loadout gets no element
           with a box, which is what keeps every existing probe's pixels identical. -->
      <div class="hud-items" data-el="items"></div>

      <!-- ── "You are dead, and this is why the screen changed" ──────────────
           🚨 THE MISSING AFFORDANCE. Uri's six-seat loss left a HUD that was
           internally consistent and unexplained: the health plate read 0/70, the
           camera had walked off to a fight two thousand world units away, and
           NOTHING on screen said the two facts were connected. Every other inert
           state this pass adds (the grey tray, the de-personalised zone pill) is a
           thing that stopped happening; this is the one element that says what is
           happening instead, and without it they read as breakage.

           Declared AFTER the tray, so it paints over it if a viewport ever brings
           them together, and before the countdown/result overlays, which own the
           screen outright when they are up. -->
      <div class="hud-spectate" data-el="spectate"></div>

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

      <!-- The floating per-fighter pills are BUILT by buildFighterSlots() and
           inserted immediately before the radar below, which is exactly where they
           were declared — DOM order here is paint order, and the pills must stay
           under the radar and over the weapon tray.

           Deliberately NO name TEXT on them — the top-corner nameplates are the one
           canonical place to read "who is who"; repeating the full name would just
           split attention between two labels for the same fighters. A small
           emoji badge (matching the corner pill's language, not its text) plus a
           chunky bar on a solid backing plate keeps this legible against any floor
           colour without reintroducing that duplicate readout. -->

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
          <!-- Blips are BUILT (see buildFighterSlots) and appended here in the order
               OPPONENTS-then-LOCAL, so the local dot paints last and is never covered by
               someone standing on top of it. That is the order these two were declared
               in, and at two fighters the DOM is character-for-character the same. -->
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
          <!-- The local seat's finishing PLACE. Empty and display:none unless
               HudFrameInfo.place is supplied — see that field. Declared between the
               title and the subtitle because that is the reading order of the sentence
               it completes: "DEFEAT! / 4th of 6 / EGG defeated ...". -->
          <div class="hud-gameover-place" data-el="gameover-place"></div>
          <div class="hud-gameover-subtitle" data-el="gameover-subtitle"></div>
          <div class="hud-gameover-stats" data-el="gameover-stats"></div>
          <!-- What the match PAID. Empty and display:none unless HudFrameInfo.payout is
               supplied — see that field, and note that the HUD is handed these numbers and
               cannot compute them. Declared LAST before the button because it is the one
               thing on this card the player is about to act on: read the verdict, read the
               reward, press the button. -->
          <div class="hud-gameover-payout" data-el="gameover-payout"></div>
          <button class="hud-gameover-btn" data-el="gameover-btn" type="button">Play Again</button>
        </div>
      </div>
    </div>
  `;const a=B=>{const Q=t.querySelector(`[data-el="${B}"]`);if(!Q)throw new Error(`hud: missing element "${B}"`);return Q},o=a("timer"),n=a("weapons"),s=a("items"),i=a("spectate"),r=a("countdown"),l=a("gameover"),h=a("gameover-title"),c=a("gameover-place"),d=a("gameover-subtitle"),p=a("gameover-stats"),u=a("gameover-payout"),m=a("gameover-btn"),f=a("topbar"),g=t.querySelector(".hud-clock"),w=t.querySelector(".hud-root"),b=a("dmg-layer"),y=a("screenflash"),v=a("zone"),k=a("zone-label"),E=a("zone-value"),x=a("zone-bar"),M=a("radar"),R=a("radar-safe"),T=a("radar-arena"),N=a("radar-map"),I=a("radar-cap"),F=a("fogedge"),L=a("fogtick"),H=a("safearrow"),P=a("safearrow-label"),j=a("aim-stick"),z=a("aim-reticle"),Y=a("mute");let A=[],C=null;function D(B){if(A.length===B)return;for(const ne of A)ne.bar.parentElement?.remove(),ne.float.remove(),ne.blip.remove();A=[],C?.remove(),C=null;const Q=B>2;f.classList.toggle("hud-topbar--chips",Q),Q&&(C=document.createElement("div"),C.className="hud-chips",C.dataset.el="chips",f.appendChild(C));for(let ne=0;ne<B;ne++){const q=a1(ne),de=ne===0?"player":"enemy",ie=Q&&ne>0,pe=document.createElement("div");pe.className=`hud-fighter hud-fighter--${de}${ie?" hud-fighter--chip":""}`;const ue=`<div class="hud-fighter-level" data-el="${q}-level"><span class="hud-fighter-level-tag">LV</span><span class="hud-fighter-level-n" data-el="${q}-level-n"></span></div>`,Fe=ne===0?`<div class="hud-fighter-emoji" data-el="${q}-emoji"></div><div class="hud-fighter-name" data-el="${q}-name"></div>`+ue:ue+`<div class="hud-fighter-name" data-el="${q}-name"></div><div class="hud-fighter-emoji" data-el="${q}-emoji"></div>`;pe.innerHTML=`<div class="hud-fighter-pill">${Fe}</div><div class="hud-healthbar hud-healthbar--${de}" data-el="${q}-bar"><div class="hud-healthbar-fill" data-el="${q}-fill"></div><div class="hud-healthbar-text" data-el="${q}-hp"></div></div>`,ne===0?f.insertBefore(pe,g):C?C.appendChild(pe):f.appendChild(pe);const Ie=document.createElement("div");Ie.className=`hud-float hud-float--${de}`,Ie.dataset.el=`float-${q}`,Ie.innerHTML=`<div class="hud-float-pill"><div class="hud-float-emoji" data-el="float-${q}-emoji"></div><div class="hud-float-bar"><div class="hud-float-fill" data-el="float-${q}-fill"></div></div></div>`,M.parentElement.insertBefore(Ie,M);const ze=document.createElement("div");ze.className=`hud-radar-dot hud-radar-dot--${de}`,ze.dataset.el=`radar-${q}`,ne===0?N.appendChild(ze):N.insertBefore(ze,N.querySelector(".hud-radar-dot--player")),A.push({name:pe.querySelector(`[data-el="${q}-name"]`),emoji:pe.querySelector(`[data-el="${q}-emoji"]`),level:pe.querySelector(`[data-el="${q}-level-n"]`),levelValue:-1,bar:pe.querySelector(`[data-el="${q}-bar"]`),fill:pe.querySelector(`[data-el="${q}-fill"]`),hpText:pe.querySelector(`[data-el="${q}-hp"]`),float:Ie,floatEmoji:Ie.querySelector(`[data-el="float-${q}-emoji"]`),floatFill:Ie.querySelector(`[data-el="float-${q}-fill"]`),blip:ze})}}D(2);let U=0,te=null;function Z(){const B=Se.isMuted();if(B===te)return;const Q=te===null;if(te=B,window.clearTimeout(U),B){Y.innerHTML=_("mute")+"<span>MUTED · M</span>",Y.classList.add("is-on"),Y.classList.remove("is-ok");return}if(Q){Y.classList.remove("is-on","is-ok");return}Y.innerHTML=_("sound")+"<span>SOUND ON · M</span>",Y.classList.add("is-on","is-ok"),U=window.setTimeout(()=>Y.classList.remove("is-on","is-ok"),1500)}const $=Se.onChange(Z);Z();const oe=24,we=[];let ve=0;for(let B=0;B<oe;B++){const Q=document.createElement("div");Q.className="hud-dmg",b.appendChild(Q),we.push(Q)}function yt(B,Q){const ne=B.replace("#",""),q=ne.length===3?ne.split("").map(ue=>ue+ue).join(""):ne,de=parseInt(q.slice(0,2),16)||0,ie=parseInt(q.slice(2,4),16)||0,pe=parseInt(q.slice(4,6),16)||0;return`rgba(${de},${ie},${pe},${Q})`}m.addEventListener("click",()=>e.onRestart());let sa=null,dn=[];function cs(B){n.innerHTML="",dn=B.map((Q,ne)=>{const q=document.createElement("div");return q.className="hud-weapon-slot",q.innerHTML=`
        <div class="hud-weapon-cooldown"></div>
        <div class="hud-weapon-emoji">${Au(Q.emoji)}</div>
        <div class="hud-weapon-timer" data-role="timer"></div>
        <div class="hud-weapon-key">${ne+1}</div>
      `,q.addEventListener("pointerdown",de=>{de.preventDefault(),de.stopPropagation(),e.onSelectWeapon?.(ne)}),n.appendChild(q),{root:q,cooldown:q.querySelector(".hud-weapon-cooldown"),timer:q.querySelector('[data-role="timer"]'),wasReady:!0}})}let Ea=[],pn="\0";const km=B=>B.startsWith("Key")?B.slice(3):B;function Mm(B){if(s.innerHTML="",B.length===0){Ea=[];return}Ea=Array.from({length:Tt},(Q,ne)=>{const q=B[ne],de=document.createElement("div");return de.className="hud-item-slot",de.innerHTML=`
        <div class="hud-item-wipe"></div>
        <div class="hud-item-glyph">${q?_(q,{size:"26px",label:Ce[q].name}):""}</div>
        <div class="hud-item-badge" data-role="badge"></div>
        <div class="hud-item-key">${km(Iu[ne]??"")}</div>
      `,de.addEventListener("pointerdown",ie=>{ie.preventDefault(),ie.stopPropagation(),e.onUseItem?.(ne)}),s.appendChild(de),{root:de,wipe:de.querySelector(".hud-item-wipe"),badge:de.querySelector('[data-role="badge"]'),lastBadge:"\0",lastState:"\0",lastP:"\0",wasReady:!1}})}function Em(B){const Q=Qe(B),ne=Q.item.equipped,q=ne.join(",");if(q!==pn&&(pn=q,Mm(ne),s.classList.toggle("is-on",ne.length>0),document.documentElement.classList.toggle("fa-items",ne.length>0)),Ea.length===0)return;const de=qs(B);s.classList.toggle("is-inert",de);const ie=uh(B),pe=Q.itemCast;Ea.forEach((ue,Fe)=>{const Ie=ne[Fe],ze=Ie!==void 0&&!de&&Fh(B,Q,Fe);let Ge,tt,Vt=0;if(Ie===void 0)Ge="is-empty",tt="EMPTY";else if(Ce[Ie].cooldownMs===null)Ge="is-auto",tt="AUTO";else if(pe!==null&&pe.slot===Fe){const Ye=Math.max(1,pe.resolvesAt-pe.startedAt),xt=Math.max(0,pe.resolvesAt-B.elapsed);Ge="is-winding",tt=(xt/1e3).toFixed(1),Vt=Math.min(1,xt/Ye)}else{const Ye=Ce[Ie].cooldownMs??0,xt=Math.max(0,Ye-(B.elapsed-Q.item.lastUsed[Fe]));Vt=Ye>0?Math.min(1,xt/Ye):0,xt>0?(Ge="is-cooling",tt=(xt/1e3).toFixed(1)):ie<Ce[Ie].minAlive?(Ge="is-blocked",tt=`NEED ${Ce[Ie].minAlive}`):ze?(Ge="",tt=""):(Ge="is-blocked",tt="WAIT")}const Ka=ze,dt=["hud-item-slot",Ge,Ka?"is-ready":""].filter(Boolean).join(" ");ue.lastState!==dt&&(ue.lastState=dt,ue.root.className=dt);const ge=Vt.toFixed(3);ue.lastP!==ge&&(ue.lastP=ge,ue.wipe.style.setProperty("--p",ge)),ue.lastBadge!==tt&&(ue.lastBadge=tt,ue.badge.textContent=tt),Ka&&!ue.wasReady&&(ue.root.classList.remove("is-flash"),ue.root.offsetWidth,ue.root.classList.add("is-flash")),ue.wasReady=Ka})}const Tm=Math.round(lh/ii*1e3);function Sm(B,Q){const ne=lr(B-mg.radiusUnits,B,Q)-lr(B,B,Q);return ne>0?Math.min(12e3,ne):0}function Am(B){const Q=B.arena.maxSafeRadius,ne=Qe(B),q=Math.hypot(ne.x-B.arena.center.x,ne.y-B.arena.center.y),de=q>B.safeRadius,ie=$a-B.timeRemaining,pe=si(B.fighters.length),ue=q<=P0(B.fighters.length,B.timeRemaining);return{outside:de,holds:ue,ringAtFloor:B.safeRadius<=pe,sudden:Bn(B.timeRemaining),radius01:Q>0?Math.max(0,Math.min(1,B.safeRadius/Q)):0,msUntilEdge:de||ue?null:lr(q,Q,pe)-ie}}const fc=56;let mc=0,nr=-1,gc=-1,wc=-1;function sr(){if(window.innerWidth!==nr||window.innerHeight!==gc||A.length!==wc){nr=window.innerWidth,gc=window.innerHeight,wc=A.length;const B=f.getBoundingClientRect().bottom;mc=B+36,b.style.setProperty("--fa-dmg-top",`${Math.max(0,Math.round(B+2))}px`),w.style.setProperty("--fa-topbar-b",`${Math.max(0,Math.round(B))}px`)}return mc}let ds=0;function Rm(B,Q){const ne=qs(B);if(i.classList.toggle("is-on",ne),!ne){i.textContent!==""&&(i.textContent="");return}const q=A0(B,Q),ie=q!==Qe(B)?`Spectating ${ce[q.characterId].name}`:"Eliminated";i.textContent!==ie&&(i.textContent=ie)}function Im(B,Q){const ne=B.phase==="playing",q=Am(B),de=qs(B),ie=ne&&q.outside&&Qe(B).alive,pe=ne&&q.sudden,ue=B.arena.maxSafeRadius;v.classList.toggle("is-danger",ie),v.classList.toggle("is-imminent",!ie&&!de&&q.msUntilEdge!==null&&q.msUntilEdge<Sm(ue,si(B.fighters.length))),x.style.width=`${(q.radius01*100).toFixed(1)}%`,pe?(k.textContent="SUDDEN DEATH",E.textContent="MOST HP WINS"):ie?(k.textContent="▲ OUTSIDE THE ZONE",E.textContent=`−${Tm} HP/s`):(k.textContent="ZONE CLOSES",E.textContent=de?q.ringAtFloor?"FINAL RING":"CLOSING":q.msUntilEdge!==null?`REACHES YOU ${I0(q.msUntilEdge)}`:q.holds?"FINAL RING":"CLOSING");const Fe=B.arena.width,Ie=B.arena.height,ze=B.arena.center.x,Ge=B.arena.center.y,tt=Fe/Ie,Vt=Math.max(ue,ze,Fe-ze)*(1+C0),Ka=Math.max(Ge,Ie-Ge)*(1+C0),dt=Math.max(2*Vt,2*Ka*tt),ge=dt/tt,Ye=it=>`${(50+(it-ze)/dt*100).toFixed(2)}%`,xt=it=>`${(50+(it-Ge)/ge*100).toFixed(2)}%`,un=it=>`${(it/dt*100).toFixed(2)}%`,bc=it=>`${(it/ge*100).toFixed(2)}%`;R.style.left=Ye(ze),R.style.top=xt(Ge),R.style.width=un(B.safeRadius*2),R.style.height=bc(B.safeRadius*2),T.style.left=Ye(Fe/2),T.style.top=xt(Ie/2),T.style.width=un(Fe),T.style.height=bc(Ie);const Cm=A0(B,Q);je(B).forEach((it,fn)=>{const Oo=A[fn]?.blip;Oo&&(Oo.style.left=Ye(it.x),Oo.style.top=xt(it.y),Oo.style.display=fn===Le?it.alive?"block":"none":it.alive&&ah(B,Cm,it)?"block":"none")}),M.classList.toggle("is-danger",ie),I.textContent=pe?"SUDDEN DEATH":ie?"GET INSIDE":"SAFE ZONE",F.classList.toggle("is-on",ie);const Ta=ie&&!pe?Q.safeArrow??null:null;if(Ta){H.style.display="block",P.style.display="block";const it=Ta.angleRad*180/Math.PI;H.style.transform=`translate(${Ta.at.x.toFixed(1)}px, ${Ta.at.y.toFixed(1)}px) rotate(${it.toFixed(1)}deg)`,(ds===0||window.innerWidth!==nr)&&(ds=P.offsetWidth/2);const fn=8,Oo=Math.min(Math.max(Ta.at.x+Math.cos(Ta.angleRad)*178,ds+fn),window.innerWidth-ds-fn),Fm=Math.min(Math.max(Ta.at.y+Math.sin(Ta.angleRad)*178,sr()+4),window.innerHeight-22);P.style.transform=`translate(${Oo.toFixed(1)}px, ${Fm.toFixed(1)}px) translate(-50%, -50%)`}else H.style.display="none",P.style.display="none"}function Om(B){const Q=B.aim??null;if(!Q){j.style.display="none",z.style.display="none";return}const ne=Q.at.x-Q.from.x,q=Q.at.y-Q.from.y,de=Math.hypot(ne,q),ie=Math.atan2(q,ne)*180/Math.PI;j.style.display="block",j.style.width=`${de.toFixed(1)}px`,j.style.transform=`translate(${Q.from.x.toFixed(1)}px, ${Q.from.y.toFixed(1)}px) rotate(${ie.toFixed(1)}deg)`,z.style.display="flex",z.style.transform=`translate(${Q.at.x.toFixed(1)}px, ${Q.at.y.toFixed(1)}px) translate(-50%, -50%)`}return{setCharacters(B){D(B.length),sa=B[Le]??null,B.forEach((Q,ne)=>{const q=A[ne];q&&(q.name.textContent=ce[Q].name,q.emoji.innerHTML=Ha(Q,{crop:"head"}),q.floatEmoji.innerHTML=Ha(Q,{crop:"head"}))}),sa&&cs(ce[sa].weapons),Xo(t,{generate:!1})},update(B,Q){o.textContent=I0(B.timeRemaining),je(B).forEach((q,de)=>{const ie=A[de];if(!ie)return;LM(ie.fill,ie.hpText,q.hp,q.maxHp),ie.levelValue!==q.level&&(ie.levelValue=q.level,ie.level.textContent=String(q.level));const pe=q.maxHp>0?q.hp/q.maxHp:0;ie.bar.classList.toggle("is-low",q.alive&&pe<=O0)});const ne=qs(B);if(n.classList.toggle("is-inert",ne),sa){const q=ce[sa].weapons,de=Qe(B).lastUsed;dn.forEach((ie,pe)=>{const ue=q[pe];if(!ue)return;const Fe=Math.max(0,ue.cooldown-(B.elapsed-de[pe])),Ie=ue.cooldown>0?Math.min(1,Fe/ue.cooldown):0;ie.cooldown.style.setProperty("--p",Ie.toFixed(3));const ze=Ie<=0,Ge=ze&&!ne;ie.root.classList.toggle("is-ready",Ge),ie.root.classList.toggle("is-selected",!ne&&pe===Q.selectedWeapon),ie.timer.textContent=ze?"":(Fe/1e3).toFixed(1),ze&&!ie.wasReady&&!ne&&(ie.root.classList.remove("is-flash"),ie.root.offsetWidth,ie.root.classList.add("is-flash")),ie.wasReady=ze})}if(Em(B),Rm(B,Q),Im(B,Q),Om(Q),B.phase==="countdown"){r.style.display="flex";const q=B.countdownValue<=0;r.textContent=q?"START!":String(B.countdownValue),r.classList.toggle("is-start",q)}else r.style.display="none";if(B.phase==="ended"){l.style.display="flex";const q=je(B),de=ua(B.winnerId??void 0,B.winner??"player"),ie=de===Le;h.textContent=ie?"VICTORY!":"DEFEAT!",h.classList.toggle("is-win",ie),h.classList.toggle("is-lose",!ie);const pe=q[de]??q[0];ce[pe.characterId];const ue=q.every(ge=>ge.alive),Fe=Q.order??null,Ie=Fe!==null&&Fe.length===q.length&&Fe.every(ge=>Number.isInteger(ge)&&ge>=0&&ge<q.length)&&new Set(Fe).size===q.length,ze=Fe&&Ie?Fe.filter(ge=>ge!==de).map(ge=>q[ge]):q.filter((ge,Ye)=>Ye!==de),Ge=ge=>`<span class="hud-go-fighter"><span class="hud-go-emoji">${Ha(ge.characterId,{crop:"head"})}</span>${ce[ge.characterId].name}</span>`,tt=(ge,Ye)=>Ye.length?`<span class="hud-go-vs">${ge}</span>${Ye.map(Ge).join("")}`:"";d.innerHTML=Ge(pe)+tt("defeated",ze.filter(ge=>!ge.alive))+tt("outlasted",ze.filter(ge=>ge.alive)),Xo(d,{generate:!1});const Vt=Q.place??null;if(Vt&&Vt.of>1){const ge=Vt.place,Ye=ge%100>=11&&ge%100<=13?"th":{1:"st",2:"nd",3:"rd"}[ge%10]??"th";c.textContent=`${ge}${Ye} of ${Vt.of}`,c.classList.toggle("is-podium",ge<=3),c.style.display="block"}else c.textContent="",c.style.display="none";const Ka=Math.max(0,$a-B.timeRemaining);p.innerHTML=ue?`${_("timer")} Time up — no knockout`:`${_("timer")} Match time ${NM(Ka)}`;const dt=Q.payout??null;if(dt){const ge=(Ye,xt,un="")=>`<span class="hud-go-pay">${_(Ye)}<b>${xt>0?"+":""}${xt}</b>${un?`<i>${un}</i>`:""}</span>`;u.innerHTML=ge("trophy",dt.trophies)+ge("coin",dt.coins)+ge("star",dt.xp,"xp")+(dt.chests?ge("chest",dt.chests):""),u.style.display="flex"}else u.innerHTML="",u.style.display="none"}else l.style.display="none"},updateFloatingBars(B,Q){const ne=sr(),q=(de,ie)=>{const pe=Math.max(ie.y,ne),ue=Math.min(Math.max(ie.x,fc),window.innerWidth-fc);de.style.transform=`translate(${ue.toFixed(1)}px, ${pe.toFixed(1)}px) translate(-50%, -100%)`};A.forEach((de,ie)=>{const pe=B[ie]??null;if(!pe){de.float.style.display="none";return}de.float.style.display="flex",q(de.float,pe);const ue=Math.max(0,Math.min(1,Q[ie]??0));de.floatFill.style.width=`${(ue*100).toFixed(1)}%`,de.floatFill.classList.toggle("is-low",ue>0&&ue<=O0)})},spawnDamageNumber(B,Q,ne){const q=we[ve];ve=(ve+1)%we.length;const de=!!ne?.heal,ie=Q>=15,pe=!ie&&Q>=6,ue=Math.max(B.y,sr()),Fe=Math.min(Math.max(B.x,24),window.innerWidth-24);q.style.setProperty("--x",`${Fe.toFixed(1)}px`),q.style.setProperty("--y",`${ue.toFixed(1)}px`),q.textContent=de?`+${Math.round(Q)}`:`-${Math.round(Q)}`;const Ie=de?" hud-dmg--heal":ne?.fog?" hud-dmg--fog":"";q.className=`hud-dmg ${ie?"hud-dmg--big":pe?"hud-dmg--medium":"hud-dmg--small"}${Ie}`,q.offsetWidth,q.classList.add("is-playing")},flashScreen(B){y.style.setProperty("--flash-color",yt(B,.42)),y.classList.remove("is-playing"),y.offsetWidth,y.classList.add("is-playing")},flashFogTick(){L.classList.remove("is-playing"),L.offsetWidth,L.classList.add("is-playing")},dispose(){m.removeEventListener("click",()=>e.onRestart()),window.clearTimeout(U),$(),document.documentElement.classList.remove("fa-items"),t.innerHTML=""}}}const HM=`
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

/* ── THE FIGHTER'S CHARACTER LEVEL, 1-15 ─────────────────────────────────────
   Uri, playing the deployed build: "In the gameplay add player level on player
   data." It rides the PILL rather than the bar, and that is the whole of the
   layout decision:

     * The bar is the one readout whose backdrop moves under it (see
       .hud-healthbar-text). Anything parked in it either covers the fill or
       collides with the centred HP run at narrow widths.
     * The pill has slack and the bar does not. The local plate stretches to the
       full .hud-fighter width (380px at desk) and the name uses a fraction of it,
       so on the seat Uri asked about the badge lands in dead space. MEASURED at
       1280x720, c9a2ed0 vs this tree: the name's own clip is 0px BEFORE and 0px
       AFTER, at two seats and at six. The opponent pill is content-sized
       (.hud-fighter--enemy sets align-items: flex-end) so it GROWS leftward
       instead - width only, never height.

   HEIGHT IS THE BUDGET AND IT IS DELIBERATELY UNDERSPENT. 20px against the 24px
   portrait beside it, so .hud-fighter-pill's height is still set by the portrait
   and the top bar's measured height does not move. h49_chips PRINTS that height
   ("precisely so no budget gets invented here and then quoted"), so a badge that
   moved it would be a number this pass owed an explanation for.

   flex: 0 0 auto, so the badge never shrinks; between 560 and 720px it is the NAME
   that ellipsizes (it already carries overflow: hidden for exactly that), and below
   560 the name is dropped outright - see that media query. A shrinking level badge
   would clip a digit off a two-digit level, and a level 15 reading "LV 1" is worse
   than a truncated name by a long way.

   CONTRAST IS NOT INHERITED HERE. The badge carries its own opaque plate, so the
   ratio is fixed at #1a1224 on #FFC93C = 11.83:1 whatever the arena does behind
   it - the same mechanism the HP run uses, and the reason this class adds no new
   WCAG failure to a HUD that went from 20 to 0.

   #FFC93C IS "mustard", A NAMED PROJECT TOKEN - theme.ts's --mustard, icons/svg.ts,
   and rules.ts's palette all spell it. It is deliberately NOT #F4A300, the amber
   this HUD already spends on the selected weapon border, the weapon key badge, the
   countdown and the podium place: that amber means CONTROL AFFORDANCE here, and a
   level is data. Two warm accents with two jobs beats one warm accent with two
   meanings. (#1a1224 on #F4A300 would have been 8.72:1 - also safe, so this is a
   semantics choice and not a contrast one.) */
.hud-fighter-level {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 7px;
  border: 2px solid #1a1224;
  border-radius: 999px;
  background: #FFC93C;
  color: #1a1224;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  box-shadow: 0 1px 0 rgba(0,0,0,0.35);
  gap: 3px;
}
/* The label is the part that goes. See buildFighterSlots: at 390px under fallback font
   metrics the whole badge measured 44px against a 73px content box that also had to hold
   a 24px portrait and two 6px gaps. The NUMERAL never shrinks and never wraps - a level
   15 that reads "LV 1" because a digit got clipped is worse than every failure this
   badge is meant to prevent.

   ⚠️ AND THE LABEL CARRIES NO OPACITY. The first draft de-emphasised it at 0.75, which
   is a CONTRAST spend: screen_metrics/home_metrics measure WCAG against the pixels
   actually behind a run, so an inherited opacity counts, and 0.75 takes this run from
   11.83:1 to 6.41:1. It still passes AA - and it is 5.4 points of the margin that made
   this badge safe on any backdrop, bought for a hierarchy nobody asked for. */
.hud-fighter-level-tag { flex: 0 0 auto; }
.hud-fighter-level-n { flex: 0 0 auto; font-variant-numeric: tabular-nums; }

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

/* ── ABOVE TWO SEATS: local bar full size, opponents as chips ─────────────────
   DECISIONS 49f, Uri: "Local seat full, others as chips". See buildFighterSlots
   for the shape; this is the whole of the styling and NONE of it can reach a
   two-fighter match — every selector below is a descendant of, or is,
   .hud-topbar--chips / .hud-chips / .hud-fighter--chip, and none of those three
   strings appears in the DOM at n === 2.

   ⚠️ NOTE FOR ANYONE EDITING THIS BLOCK: THERE ARE NO BACKTICKS IN IT, ON PURPOSE.
   This whole sheet is a template literal, so one backtick in a CSS comment ends the
   string and the file stops parsing — which is exactly what the first draft of this
   block did, and it is the failure menu_accept.mjs's header already records as "the
   very next backtick to break hud.ts".

   ⚠️ PLACEMENT IS LOAD-BEARING AND IT IS THE CASCADE TRAP FROM THE OTHER SIDE.
   .hud-fighter--chip and .hud-fighter are BOTH (0,1,0), so between those two only
   source order decides — which is why this block sits AFTER .hud-fighter rather
   than beside it. In the other direction the specificity works FOR us and that is
   also deliberate: ".hud-fighter--chip .hud-healthbar" is (0,2,0) against the
   max-width:720px block's ".hud-healthbar" at (0,1,0), and a media query adds NO
   specificity — so a chip keeps its own height on a phone without this block having
   to restate itself inside every media query. The phone rules below still own
   everything they owned before, because none of them names a chip. */

/* The three columns. Two EQUAL 1fr side tracks are what centres the clock: it is
   centred by the grid, not by however much plate happens to sit either side, which
   is the property the flex row could not have at any plate width. 1fr and not
   minmax(0, 1fr) on purpose — a 0 minimum lets a wide rail overflow LEFTWARD over
   the clock, and an auto minimum makes it push the clock a few px instead, which is
   the failure that degrades rather than the one that collides. */
.hud-topbar--chips {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
}
/* FULL SIZE means literally the width it has in a 1v1, and it is measured that way
   (h49_chips compares n=6 against n=2 on the same viewport, and gets 100% at all
   three). No max-width here on purpose: the base .hud-fighter rule already caps at
   380px, and adding a second, smaller cap made the local bar 300px at 1280 against
   380px at two fighters — 79%, i.e. a squeeze of its own, which is the exact defect
   this section exists to remove. Below 380px of track the plate is bounded by the
   1fr column instead, which is the same arithmetic the flex row gave it. */
.hud-topbar--chips .hud-fighter--player {
  justify-self: start;
  width: 100%;
}
.hud-topbar--chips .hud-clock { justify-self: center; }

/* Right-aligned so the rail grows INWARD from the corner as seats are added — the
   last chip is always in the same place, which is what makes 3, 4 and 6 read as the
   same HUD. Wraps rather than squeezes: this whole section exists because squeezing
   was the failure, so the overflow behaviour must not be a squeeze either. A wrapped
   second row is picked up automatically by floatFloorY(), which reads the top bar's
   live bottom edge, so the floating pills and the damage-layer clip follow it. */
.hud-chips {
  justify-self: end;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.hud-fighter--chip {
  flex: 0 0 auto;
  width: 48px;
  max-width: none;
  align-items: center;
  gap: 3px;
}
/* A chip IS its portrait: the pill's plate and border are chrome around a 30px disc
   that already carries its own dark rim below, and drawing both put two concentric
   outlines on a 48px element. */
.hud-fighter--chip .hud-fighter-pill {
  background: transparent;
  border: 0;
  padding: 0;
  gap: 0;
}
/* Present, wired to its own slot, and not drawn. 48px cannot hold "HAMBURGER" at a
   weight this HUD would ship, and the rendered head crop identifies the character
   faster than 8px type would. The element stays so nothing that reads it by name
   stops matching — see buildFighterSlots' note on what that costs np_nfighter. */
.hud-fighter--chip .hud-fighter-name { display: none; }
/* ── AND NEITHER IS THE LEVEL. THIS IS THE DECISION, NOT AN OVERSIGHT ─────────
   The chip is 48px wide (40px below 720px) and holds a 30px portrait over an
   11px bar. A level badge there has exactly two places to go and both are worse
   than not drawing it:

     * a THIRD ROW in the chip - which grows the rail, and the rail's height is
       the top bar's height, a number h49_chips publishes on purpose;
     * ON the portrait - which is the chip's ONLY identity now that the name is
       gone, at 30px, on a phone at 26px.

   And what it would buy is nothing a player does not already have. Measured in
   the source, not assumed: tuning.ts:ENEMY_LEVEL_MODE is 'mirror', so
   economy/levels.ts:enemyLevelFor() returns clampLevel(playerLevel) and
   match.ts:newMatch hands this.levels.enemy to EVERY non-local seat. So all
   five chips carry the same number, and that number is the one already printed
   on the local plate two feet to the left. Five redundant copies, in the corner
   html.fa-touch-capable also puts the radar in.

   ⚠️ THE ELEMENT IS STILL BUILT AND STILL WRITTEN, exactly like the name and the
   numeric HP above it. The day a seat carries its own level - a per-seat level
   input on GameSessionOptions, or a second human - this is one line of CSS, and
   update() is already writing the right number into it. Deleting the element
   instead would make that a change to buildFighterSlots, to the slot interface
   and to every probe that counts [data-el$="-level"]. */
.hud-fighter--chip .hud-fighter-level { display: none; }
.hud-fighter--chip .hud-fighter-emoji {
  width: 30px;
  height: 30px;
  font-size: 18px;
  /* The dark rim sits OUTSIDE the red identity ring, so the chip reads on a bright
     tile the same way the nameplate's opaque pill does on one. */
  box-shadow: 0 0 0 2px rgba(26,18,36,0.92), 0 2px 0 rgba(0,0,0,0.35);
}
.hud-fighter--chip .hud-healthbar {
  height: 11px;
  border-width: 2px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35);
}
.hud-fighter--chip .hud-healthbar-fill { inset: 1px; right: auto; }
/* "99 / 108" at 12px in an 11px track is unreadable AND overflows it. The bar's
   FILL is the readout at this size, and on the local seat's own full bar.
   ⚠️ THIS COMMENT USED TO ALSO SAY "the number lives on the float pill over the
   fighter's own head". IT DOES NOT AND NEVER DID: .hud-float-pill holds
   .hud-float-emoji and .hud-float-bar, and there is no text node anywhere in it
   (buildFighterSlots writes the whole float in one template). Corrected rather
   than deleted, because it is the shape this project keeps paying for - a
   consolation readout named in a comment as the reason a real one was dropped,
   where nobody checked that the consolation exists. */
.hud-fighter--chip .hud-healthbar-text { display: none; }

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
   HUD's cooldown wipe from three critics.

   The reason it went unseen is a schedule claim, and the schedule has now moved twice
   under it. KEPT AS WRITTEN, on quote lines:

     > "It never showed before because the fog only reached the playfield in the last
     > seconds of a 180s match; on the 45s clock it arrives while there is still a fight
     > going on."

   On Uri's schedule (6d5c4d6) first contact is FOG_HOLD_MS - 25 s - BY CONSTRUCTION
   rather than by arithmetic: the ring opens on the arena half-diagonal, so it is already
   touching the four corners, and it does not move at all until the hold ends. That is
   16.7% into the 150 s clock. But the honest number for THIS comment is a different one:
   tools/tmp/sr_ringfloor.mjs measured 880 duels at a mean play length of 22.05 s, so the
   median match ENDS BEFORE THE FOG EVER MOVES and this grid is never seen against a fog
   field at all. It still has to work there - the longest of those 880 ran 62.23 s, and
   six-seat matches on this schedule are unmeasured - so the two-sided contrast below is
   kept and is no longer load-bearing for the common case. Mixing toward the wall colour
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
/* 🚨 REVERSED FOR LANDSCAPE TOUCH — the paragraph below is kept as written because it
   is the reasoning that was overturned, and it is wrong in an instructive way. See
   "THE TRAY LEAVES THE CENTRE OF PLAY" at the very bottom of this sheet. In short: it
   reasons entirely about THUMBS and says nothing about the WORLD. Both thumbs really
   are clear of the bottom-centre band; the arena is not, and bottom-centre was hiding
   5.75-7.92% of the 199.2 wu every player is guaranteed to see. Desktop and portrait
   are unchanged and still get exactly what this paragraph describes. */
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

/* ── 🚨 THE TRAY, ONCE THE PLAYER IT BELONGS TO IS DEAD ─────────────────────
   See update(). Three signals in this cluster say "press this now" — the light
   plate, the amber is-selected ring and the one-shot ready flash — and after
   7a32f3d a corpse's press reaches nothing at all. update() withholds the two
   classes; this rule is what makes the withholding LEGIBLE rather than merely
   accurate, because a tray with no ring on it is only distinguishable from a normal
   one by a comparison the player cannot make.

   grayscale + opacity rather than display: none, and that is the whole design
   choice here: removing the tray would change the shape of the HUD mid-match and
   read as a glitch, while a greyed one reads as "yours, disabled" — the convention
   every disabled control on every platform already uses. It also keeps the four
   icons on screen, which is what makes the spectated fighter's DIFFERENT abilities
   legible as somebody else's.

   0.42 rather than something fainter: the plate has to stay above the arena behind
   it. EFEAF7 at 0.42 over this game's darkest floor is still a light mark, and
   hud_accept's non-text-mark rule (3.0) is asserted on the LIT tray, which this
   state is not — a disabled control is exempt from WCAG 1.4.11 by the same clause
   that exempts it from 1.4.3, and the caption below carries the meaning at full
   contrast regardless. */
.hud-weapons.is-inert {
  filter: grayscale(1);
  opacity: 0.42;
}
/* The press affordance goes with it. Without this a dead player taps a slot, gets the
   full :active depress and moves a selection ring for a weapon that cannot fire —
   the most convincing possible statement that the control works. pointer-events is
   only ever auto here under html.fa-touch (see that rule's header: .hud-root is
   none and this is the ONE opt-in in the HUD), so this is the exact counterpart. */
.hud-weapons.is-inert .hud-weapon-slot { pointer-events: none; }

/* ═══════════════════════════════════════════════════════════════════════════
   THE ITEM BUTTONS
   ═══════════════════════════════════════════════════════════════════════════

   See renderItems() for what each state means. This sheet's job is that they can be
   TOLD APART at arm's length on a phone, and that none of them is invisible.

   ── ROUND, WHERE A WEAPON SLOT IS A ROUNDED SQUARE ────────────────────────
   The one shape difference, and it is doing real work rather than decoration: these
   two buttons sit directly beside four that mean something else, they are pressed by
   the same thumb, and at 58px a player is reading silhouette long before they read a
   glyph. Round-vs-square is the cheapest discriminator available and it is the one
   this genre already uses for "ability" against "weapon". Everything ELSE is copied
   from the weapon slot on purpose: the light plate, the ink border, the dark conic
   wipe and the numeric countdown are all language this HUD has already paid for —
   .hud-weapon-cooldown's own header records three critic rounds calling a dark wipe
   on a dark card absent, which is why the plate under it is light.

   ── POSITION: ALWAYS THE TRAY'S NEIGHBOUR ─────────────────────────────────
   Directly ABOVE the tray on desktop and in portrait; a COLUMN beside it in the
   landscape-touch corner cluster (that rule is with the tray's, at the bottom of this
   sheet, so the two are read together). Both offsets are written as the SUM of the
   terms they clear, the way .hud-spectate's is, so a change to the tray is a visible
   change to a term here rather than a number that silently stops being right. */
.hud-items {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  /*   18px  .hud-weapons' own bottom offset
       58px  a weapon slot at this viewport (the DESKTOP one, deliberately: the
             max-width:720px block takes the tray to 46px, so keeping 58 in this sum
             OVER-clears by 12px on a phone and keeps the whole cluster describable by
             one constant instead of two that must be kept in step)
       20px  clearance — and it is 20 rather than 10 because the state badge HANGS 9px
             BELOW its button (bottom: -7px on a 16px pill). At 10 the badge's ink and
             the tray's top border were 1px apart, which reads as one crowded block
             rather than two control groups. */
  bottom: calc(var(--fa-safe-b, 0px) + 18px + 58px + 20px);
  display: none;
  /* 14, not the tray's 10: these plates are round and each carries a badge wider than
     itself (NEED 3 overhangs a 46px button by ~4px a side), plus a 5px ready ring. */
  gap: 14px;
}
/* Set by renderItems when the local seat actually brought something. display rather
   than opacity, so a player with an empty loadout has no box in the frame at all and
   cannot enter any collision or occlusion measurement. */
.hud-items.is-on { display: flex; }

.hud-item-slot {
  position: relative;
  width: 58px;
  height: 58px;
  background: #EFEAF7;
  border: 3px solid #1a1224;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: border-color 0.1s, transform 0.1s;
}

/* ── EMPTY: a socket, not a control ────────────────────────────────────────
   Most players carry one item or none, so this is the state most of them will see and
   it has to read as "nothing here", never as "cooling". Opaque #241a30 — this HUD's
   darkest card, the same plate .hud-spectate and the mute chip use, so it inherits
   their measured contrast instead of inventing a new one, and it is opaque for the
   reason the zone pill was made opaque: a translucent plate over live 3D let the pot's
   hazard ring read straight through a readout. The dashed cream rim is the whole
   signal and is measured against that plate, not against the arena. */
.hud-item-slot.is-empty {
  background: #241a30;
  border-style: dashed;
  border-color: #FFF3DE;
  box-shadow: none;
}

/* ── AUTO: an item that is working, with no press to offer ─────────────────
   Passive and triggered items (cooldownMs null) get the full-strength plate and glyph
   — they ARE on — and lose every affordance that would imply a press: no pointer
   events even on touch, no :active depress, no ready flash. */
.hud-item-slot.is-auto { pointer-events: none !important; }

.hud-item-glyph {
  line-height: 0;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));
  z-index: 1;
  transition: filter 0.15s, opacity 0.15s;
}
/* Not usable right now: the same desaturate+dim the weapon tray uses, so "dim glyph"
   means one thing across both clusters. is-auto is excluded deliberately — it is not
   waiting for anything. */
.hud-item-slot.is-cooling .hud-item-glyph,
.hud-item-slot.is-blocked .hud-item-glyph {
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5)) grayscale(0.75) brightness(0.6);
  opacity: 0.85;
}

/* ── The wipe: dark for a COOLDOWN, amber for a WIND-UP ────────────────────
   Two different facts, so two different inks. A cooldown is time you are waiting
   through; a wind-up is time you are spending, in public, and ITEMS.shiitake.look
   makes that visibility the reason the item is counterable rather than a coin flip.
   Drawing both as the same dark sweep would make the only telegraphed item in the set
   indistinguishable from the eight that are not.
   The dark value is .hud-weapon-cooldown's, unchanged, for the same reason. */
.hud-item-wipe {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(rgba(20,14,28,0.88) calc(var(--p, 0) * 360deg), transparent 0);
  pointer-events: none;
}
.hud-item-slot.is-winding .hud-item-wipe {
  background: conic-gradient(rgba(244,163,0,0.92) calc(var(--p, 0) * 360deg), transparent 0);
}
.hud-item-slot.is-ready .hud-item-wipe,
.hud-item-slot.is-empty .hud-item-wipe,
.hud-item-slot.is-auto .hud-item-wipe { background: transparent; }

/* ── READY: an amber ring ADDED OUTSIDE the ink, never REPLACING it ─────────
   🚨 THE FIRST CUT DID WHAT .hud-weapon-slot.is-selected DOES — swapped border-color to
   #F4A300 — AND THE RENDERED FRAME FAILED ITS OWN CONTRAST ROW AT 2.31:1. The ink
   border is the only thing that separates this plate from the arena; amber on the
   kitchen's yellow counter is not, and a ready button sitting on that counter lost its
   outline in exactly the state it most needs to be seen (up_item_hud D, 844x390,
   shots at tools/tmp/up_shots/crop-ready.png).

   So the border stays ink at every state and the readiness cue becomes a spread
   box-shadow OUTSIDE it: amber ring, then ink again, then the soft glow. The plate is
   legible against any arena via the inner ink; the amber is legible against any arena
   via the outer ink; and nothing about the layout moves, because a box-shadow has no
   box. The tray's is-selected is deliberately NOT changed here — that is a different
   control, a different owner's measurement, and a routed note rather than a drive-by.

   There is no SELECTION here to confuse readiness with: the press names its own slot
   (state.ts:FighterInput.useItem), so amber can mean one thing. */
.hud-item-slot.is-ready {
  box-shadow: 0 0 0 3px #F4A300, 0 0 0 5px #1a1224,
              0 3px 0 rgba(0,0,0,0.35), 0 0 12px rgba(244,163,0,0.75);
}
/* ── 🚨 THE ONE-SHOT POP, AND IT MAY NOT BE THE TRAY'S ─────────────────────
   ⚠️ THIS RULE USED TO SAY, AND THE REASONING WAS WRONG IN A WAY ONLY THE RENDER SHOWS:

     "The tray's one-shot pop, reused rather than duplicated: it is the same event
      ('usable now') on the same kind of control, and a second keyframe set would be a
      second place to change the beat."
     .hud-item-slot.is-flash { animation: hud-weapon-ready-flash 0.35s ease-out; }

   hud-weapon-ready-flash animates the whole box-shadow PROPERTY, and its 100% frame is
   the weapon slot's shadow — 0 3px 0 rgba(0,0,0,0.35) and nothing else. An animation
   wins over a normal declaration while it is running, so for 350ms after an item became
   usable it was drawn with NO AMBER RING AT ALL: the flash deleted the exact state it
   existed to announce, and then handed it back.

   Found by looking at the PNG, not by any assertion — every geometry and contrast row
   was green, because the ink border it fell back to is the one that carries the 3.0
   floor. tools/tmp/up_shots/crop-btn.png is the frame: a ready button with a plain dark
   rim, 250ms into a 350ms animation.

   ⚠️ SO THE LESSON IS NOT "duplicate less". It is that a shared keyframe set is a shared
   statement about WHICH PROPERTIES ARE IN PLAY, and these two controls no longer agree
   about that — the weapon slot puts its state in border-color, the item button puts its
   in box-shadow. The white ring below is the same beat at the same duration; the two
   static rungs under it are this control's own resting shadow, restated in both frames
   so the animation adds a flash instead of replacing the button. */
.hud-item-slot.is-flash { animation: hud-item-ready-flash 0.35s ease-out; }
@keyframes hud-item-ready-flash {
  0% { box-shadow: 0 0 0 3px #F4A300, 0 0 0 5px #1a1224, 0 3px 0 rgba(0,0,0,0.35),
                   0 0 0 10px rgba(255,255,255,0.55); }
  100% { box-shadow: 0 0 0 3px #F4A300, 0 0 0 5px #1a1224, 0 3px 0 rgba(0,0,0,0.35),
                     0 0 0 0 rgba(255,255,255,0); }
}

/* ── ONE badge, bottom-centre, carrying whichever fact this slot has ───────
   The weapon tray puts its countdown bottom-RIGHT because that corner is free on a
   square plate. This one is centred because the plate is round — a corner badge on a
   circle floats off the edge — and because it has to hold words (EMPTY, AUTO, NEED 3,
   WAIT) as well as a number, and a word centred under a round button is the shape the
   eye already reads as a label.
   #1a1224 on a #FFF3DE rim and cream text is .hud-weapon-timer's pair, unchanged. */
.hud-item-badge {
  position: absolute;
  left: 50%;
  bottom: -7px;
  transform: translateX(-50%);
  min-width: 22px;
  padding: 1px 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1224;
  border: 2px solid #FFF3DE;
  border-radius: 8px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.02em;
  color: #FFF3DE;
  white-space: nowrap;
  z-index: 3;
  pointer-events: none;
}
/* Ready: no badge at all, never an empty pill floating under a live button. */
.hud-item-badge:empty { display: none; }

/* The key cap. Top-LEFT like the weapon tray's digit badge, same colours, and hidden
   on a device with no keyboard by the same capability rule — a legend for a key that
   does not exist is a small lie about how the game is played. A touchscreen LAPTOP
   keeps it, because its keys work. */
.hud-item-key {
  position: absolute;
  top: -6px;
  left: -6px;
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
html.fa-touch-capable .hud-item-key { display: none; }
/* An empty or automatic slot has nothing to press, so it carries no key legend either. */
.hud-item-slot.is-empty .hud-item-key,
.hud-item-slot.is-auto .hud-item-key { display: none; }

/* The ONE opt-in to pointer events, exactly as the weapon slot's: per-slot, 58x58
   (well over the 44px floor), and gated on html.fa-touch, which game/touch.ts sets only
   after a REAL finger. .hud-root is pointer-events:none and a full-viewport layer that
   claims events starves the canvas of firing AND aim at once — that has shipped once. */
html.fa-touch .hud-item-slot {
  pointer-events: auto;
  cursor: pointer;
  touch-action: manipulation;
}
/* A press has to acknowledge itself even when the slot it hit is still cooling — with
   no press state, a mis-hit and a dead control look identical. */
html.fa-touch .hud-item-slot:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(0,0,0,0.35);
}
/* Nothing to press: no depress, and no pointer events to produce one. */
html.fa-touch .hud-item-slot.is-empty { pointer-events: none; }

/* Dead player: the cluster greys with the tray and stops accepting presses, for the
   tray's reasons and by the tray's mechanism. */
.hud-items.is-inert {
  filter: grayscale(1);
  opacity: 0.42;
}
.hud-items.is-inert .hud-item-slot { pointer-events: none; }

/* ── "SPECTATING <NAME>" ───────────────────────────────────────────────────────
   The one element this pass ADDS a signal with rather than removing one. See
   renderSpectate for what it says, what it rejected, and why it is not a banner.

   ── Position ────────────────────────────────────────────────────────────────
   Bottom-centre, and the offset is spelled as a SUM of the terms it clears rather
   than as one tuned number, exactly as floatFloorY's bottom + 36 is:

       18px  .hud-weapons' own bottom offset, above
       58px  a slot, at the size it is at every viewport that keeps the tray
             centred (the <=720 rule takes it to 46, which only makes this clearance
             larger; the 2-column touch-landscape tray is not under this element at
             all — it moves to the bottom-right corner)
       10px  clearance, so the caption is a caption and not a fifth row of the tray

   NOT anchored to --fa-topbar-b like the radar and the damage layer, and that is
   deliberate: that band belongs to the floating HP pills, which floatFloorY clamps
   to topbar.bottom + 36 and which sit at their fighters' x — i.e. anywhere across
   the width, including the middle. A caption there would collide with a pill roughly
   whenever a fighter was near the centre of the frame.

   ── Contrast ────────────────────────────────────────────────────────────────
   An opaque plate, not text on the arena. It is drawn over live 3D at whatever hue
   the floor happens to be, and this HUD has one measured precedent for the mistake:
   the zone pill was translucent, the pot's hazard ring read straight through it, and
   a readout meaning "safe" ended up superimposed on one meaning "lethal". #241a30
   is the HUD's own darkest card and #FFF3DE its cream — the same pair the mute
   chip and the clock use, so it inherits their measured contrast rather than
   inventing a new one. */
.hud-spectate {
  position: absolute;
  left: 50%;
  bottom: calc(var(--fa-safe-b, 0px) + 18px + 58px + 10px);
  transform: translateX(-50%);
  display: none;
  padding: 5px 12px;
  border-radius: 999px;
  background: #241a30;
  border: 2px solid #120c1c;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
  color: #FFF3DE;
  white-space: nowrap;
  /* Never a hit target, never a scroll anchor. .hud-root is already
     pointer-events: none and this restates it locally so a future fa-touch rule
     scoped at the root cannot accidentally hand a caption a tap. */
  pointer-events: none;
}
/* Toggled by renderSpectate, never by a phase check in CSS. display rather than
   opacity, so the element has no box at all in the 99% of match time it is off and
   cannot enter any collision measurement hud_accept takes on a living HUD. */
.hud-spectate.is-on { display: block; }
/* ── ...and it steps over the item row when there is one ───────────────────────
   The offset above is a SUM of the terms it clears, and the item cluster adds two of
   them: another 58px control and another 10px of clearance. Without this the caption
   lands exactly on the item buttons — measured, not predicted: both are bottom-centre
   and the caption's own bottom offset IS the item row's.

   ⚠️ It is gated on html.fa-items rather than applied unconditionally, so a player with
   an empty loadout keeps the caption where it has always been. And it is CANCELLED in
   the landscape-touch block at the bottom of this sheet, where the cluster is in the
   corner and nothing is under the caption at all. */
html.fa-items .hud-spectate {
  bottom: calc(var(--fa-safe-b, 0px) + 18px + 58px + 20px + 58px + 10px);
}

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
/* (No backticks anywhere below: this whole sheet is a template literal and one
   would close it. The rule is already recorded at .hud-go-pay .fa-ic.)

   The padding is the card's GUTTER, and it is what max-width:100% on the card
   resolves against — the * { box-sizing: border-box } in index.html means the card's
   100% is this element's CONTENT box, so twelve pixels here is twelve pixels of
   breathing room on each side and nothing else has to know about it. Safe insets
   are added on every edge for the same reason the top bar adds them: a landscape
   phone eats 44px to the notch, and a result card pushed under it is unreadable on
   exactly the device this card is smallest on. */
.hud-gameover {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  padding:
    calc(var(--fa-safe-t, 0px) + 12px) calc(var(--fa-safe-r, 0px) + 12px)
    calc(var(--fa-safe-b, 0px) + 12px) calc(var(--fa-safe-l, 0px) + 12px);
  background: rgba(10,6,16,0.55);
  pointer-events: auto;
}
/* ── THE CARD IS BOUNDED, AND IT WAS NOT ──────────────────────────────────────
   DECISIONS §70, measured and reproduced before this line was written: at
   430x932 the SIX-fighter card was 705.08px wide with its left edge at -137.53px,
   so the winner's portrait (l=-101.5) and name (l=-67.5) were entirely off-screen
   on the one screen whose whole job is to say who won. The overflow is symmetric
   because this is a centred flex column with no width bound: it grows to its
   widest child and half the excess goes off each edge.

   ⚠️ IT WAS NEVER A SIX-SEAT DEFECT. The same run measured 530.5px at THREE seats
   with a mixed dead/alive card (left -50.2), and the widest case anywhere was
   776.5px at 360x800 with the left edge at -208.3. Six is where it was noticed.

   max-width:100% is a NO-OP on every card that already fitted — it can only
   bite where the card was overflowing, which is the whole of the change at two
   seats on a desktop.

   🚨 AND THERE IS DELIBERATELY NO max-height/overflow-y HERE, WHICH IS A REVERSAL:
   this shipped for one round as max-height:100% + overflow-y:auto, to keep the box
   inside the screen if a future row made it taller. It was ABLATED and removed, on
   two measurements:

     * rcw_pixels, 48 two-seat cards on a detached worktree of the pre-change
       commit against this tree: with overflow-y:auto, 16 of the 28 cards whose
       layout was rect-for-rect IDENTICAL still differed by 18-412 antialiased
       pixels at a max channel delta of 6/255 — every one of them on a CURVE (the
       portrait discs, the chip pills, the Play Again corners), none on text.
       Removing it took all 28 to EXACTLY ZERO. A scroll container rasterises its
       own rounded edges through a different path in Chromium, and pixel identity
       at two seats is the claim this whole change is judged on.
     * It also silently changed the failure mode. A flex item whose overflow is not
       visible has its automatic minimum size resolve to 0 rather than to its
       min-content width, so a card whose content could not wrap was squeezed to the
       scrim and CLIPPED (measured: 406px, not the 705px it actually wanted) instead
       of hanging off the edge. That is a quieter bug, not a smaller one.

   The height budget is held by the max-height:640px rules at the bottom of this
   sheet instead, where it is arithmetic rather than a runtime backstop, and
   rcw_fit's vertical rows go red if a future row breaks it. Nothing overflows
   today: over 126 cards x 9 viewports the tightest vertical slack is 76px, at
   667x375. */
.hud-gameover-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  max-width: 100%;
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
/* ── The finishing place ──────────────────────────────────────────────────────
   display: none in the SHEET, not only from script, so a card rendered before
   update() has ever run cannot flash an empty row. Above two seats this is the
   result of the match for five of the six players and the card could not say it.

   Cream, not the title's win/lose green or red: the title already carries that
   verdict at 48px, and a second element in the same two colours would read as a
   repeat rather than as new information. The podium tint is the one exception —
   #F4A300 is the same amber the countdown and the trophy road use. */
.hud-gameover-place {
  display: none;
  margin-top: -10px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 26px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #FFF3DE;
  -webkit-text-stroke: 1px #1a1224;
}
.hud-gameover-place.is-podium { color: #F4A300; }
/* flex-wrap:wrap is the other half of the card's bound. Without it this row lays
   out on one line and grows without limit, and since the card sizes to its widest
   child, THIS is the element that made the card 705px wide. justify-content:
   center only has an effect once a line is short of the container's width, which
   cannot happen while the container is shrink-to-fit — so on a card that already
   fitted, both properties are inert. */
.hud-gameover-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: -8px;
  font-family: 'Rubik', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #FFF3DE;
}
/* ── ONE FIGHTER, ONE FLEX ITEM ───────────────────────────────────────────────
   A flex line breaks only BETWEEN items, so wrapping a portrait and its name into
   one item is what makes flex-wrap above safe. The 8px gap here is the same 8px
   the subtitle used to put between them when they were siblings, which is why the
   two-seat card does not move: [emoji, NAME, verb, emoji, NAME] at 8px and
   [ [emoji NAME], verb, [emoji NAME] ] at 8px inside and out lay out to the same
   pixels. That is asserted, not assumed — tools/tmp/rcw_pixels.mjs screenshots
   the two-seat card on a detached worktree of the pre-change commit and on this
   tree and requires a zero-pixel difference.

   flex:0 0 auto on the portrait because a flex item's default flex-shrink:1
   would let a tight line squash the 26px badge into a smudge rather than wrap —
   the failure mode this whole section exists to remove, one level down. */
.hud-go-fighter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.hud-go-emoji {
  display: inline-flex;
  flex: 0 0 auto;
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
/* ── What the match paid ──────────────────────────────────────────────────────
   display: none in the SHEET for the same reason .hud-gameover-place is: a card
   that rendered before update() ran would otherwise flash an empty row.

   A chip row rather than a sentence. Three numbers read as three numbers at a
   glance; "You earned 9 trophies, 44 coins and 74 XP" is a line of prose on the
   one screen a player wants to leave. The plate under each chip is what keeps a
   -5 legible next to a +44 without colouring them differently — the sign is the
   information, and tinting it green/red would repeat the title's verdict. */
/* Wraps for the same reason the subtitle does, and it is not hypothetical: a
   chest credit makes this FOUR chips, which measured 381px of content against a
   334px budget at 430x932. Each chip is already one atomic inline-flex box, so
   unlike the subtitle this row needed no wrapper — nothing inside a chip can be
   separated from the rest of it. */
.hud-gameover-payout {
  display: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: -4px;
}
.hud-go-pay {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px 5px 8px;
  border-radius: 999px;
  background: rgba(10,6,16,0.5);
  border: 2px solid #1a1224;
  font-family: 'Rubik', sans-serif;
  color: #FFF3DE;
  /* ── The icon OUTLINE has to flip on a dark plate, and this was measured ──────
     icons/index.ts draws every stroke as var(--fa-ic-ink) defaulting to #1a1224,
     which is the right answer on the cream menus and is INVISIBLE on this chip.
     Photographed at 4x in shots/rc/pay_crop.png: the trophy's handles and stem are
     ink strokes, so at 18px on a near-black plate it rendered as a gold sliver with
     a dash under it — a cup with no handles. The coin and the star survived only
     because they are solid fills. One variable on the container flips all three,
     which is exactly what that file says the variable is for. */
  --fa-ic-ink: #F3E7D6;
}
.hud-go-pay b {
  font-weight: 900;
  font-size: 16px;
  letter-spacing: 0.01em;
}
.hud-go-pay i {
  font-style: normal;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #C9B8DE;
}
/* 22px, not the 18px this shipped at for one round, and the reason is in the trophy.
   icons/ui.ts draws its handles as 1.8-unit strokes in a 24-unit box, so at 18px they land
   at 1.35px and wash out — the glyph reads as a gold sliver rather than a cup, which is
   exactly the failure the coin's own comment records at 11px ("1.7 units of ink is 0.78px
   drawn"). Measured square at both sizes (rc_card §D, 18x18 then 22x22), so this is the
   icon's minimum legible size and not a layout bug.
   (No backticks: this whole sheet is a template literal and one would close it.) */
.hud-go-pay .fa-ic {
  width: 22px;
  height: 22px;
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
  /* Down with the name, and still SHORTER than the 24px portrait beside it (this
     media query does not shrink the full plate's portrait — only the chip's), so
     .hud-fighter-pill's height is unchanged here too and the top bar keeps the
     height h49_chips publishes. */
  .hud-fighter-level { height: 18px; font-size: 10px; padding: 0 6px; gap: 0; }
  /* THE MEASURED LINE. 44px of badge did not fit a 73px pill at 390px under fallback
     metrics; the numeral alone is ~22px and clears it by ~9px even there. */
  .hud-fighter-level-tag { display: none; }
  .hud-healthbar { height: 18px; }
  /* ── The chip rail, narrowed ────────────────────────────────────────────────
     Arithmetic, not taste, and it is the same geometry the radar/tray rules at the
     bottom of this sheet are derived from. The rail must fit ONE of the two 1fr side
     tracks or it wraps:

       track = (W - 28 padding - 156 clock - 20 gap) / 2
       rail  = (n - 1) chips x (chipW + 5 gap) - 5

     At the narrowest width this regime has to hold, 667 (a landscape phone at
     667x375), the track is 231px and five chips at 40px measure 220px — inside it.
     At 48px they would measure 260px and wrap to a second row, which is legible but
     is the "consequence rather than a design" the chip section exists to replace.
     The local plate needs no cap of its own here: its 1fr track IS 231px, which is
     the same width the two-fighter flex row gives it at this viewport, and
     h49_chips asserts the two are equal to within half a pixel. */
  .hud-chips { gap: 5px; }
  .hud-fighter--chip { width: 40px; }
  .hud-fighter--chip .hud-fighter-emoji { width: 26px; height: 26px; font-size: 15px; }
  .hud-fighter--chip .hud-healthbar { height: 10px; }
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
  /* The item buttons follow the tray down, and for the tray's reason: this is the
     phone treatment, and a control that stayed 58px while its neighbour became 46
     would read as a different, more important kind of button rather than as the pair
     they are. The 24px glyph is the same measured legibility fix the line above
     records — 20px was where every identify-at-real-size failure was scored. */
  .hud-item-slot { width: 46px; height: 46px; }
  .hud-item-glyph .fa-ic { width: 24px; height: 24px; }
  .hud-items { gap: 12px; }
  .hud-item-badge { font-size: 10px; padding: 1px 4px; bottom: -6px; }
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

/* ── BELOW 660px THE CHIP RAIL GETS ITS OWN ROW, because its column runs out ──
   Arithmetic, and the same shape as the two rules further down. The side track is
   (W - 28 padding - 156 clock - 20 gap) / 2 and five chips measure 5 x 45 - 5 =
   220px, so the rail stops fitting its column at W = 664. Below that it wrapped
   into a ragged two- or three-row block in the corner — measured by h49_chips at
   141px of top bar at 390 and 229px at 360, against 102px at two seats — which is
   the same "consequence rather than a design" this pass exists to remove, rotated
   90 degrees.

   Spanning the full bar instead gives 332px of content at 360 for a 220px rail, so
   it is ONE centred row at every phone width and the bar is 151px rather than 229.
   The clock does not move: it is still row 1, column 2 of a 1fr / auto / 1fr grid,
   and nothing placed in row 2 can shift it. Asserted at 0.0px, not assumed.

   ⚠️ 660 IS THE CROSSOVER ROUNDED **DOWN**, AND THAT DIRECTION IS THE DELIBERATE
   ONE — it is the opposite of what the 460px rule below does, so do not "fix" it to
   match. On a short landscape phone HEIGHT is the scarce resource: at 667x375 the
   rail still fits its column and the bar is 102px (27% of that frame), while the
   centred row would make it 151px (40%). So the 661-668 band — where a device with
   a side inset can still wrap — is deliberately left to WRAP, and the derived radar
   rule at the bottom of this sheet is what makes wrapping safe instead of colliding.
   That is the division of labour: THIS rule is about the bar's HEIGHT, the radar
   rule is about COLLISIONS, and only the second one has to hold at every width. */
@media (max-width: 660px) {
  .hud-topbar--chips .hud-chips {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: center;
    justify-content: center;
  }
}

/* ── PORTRAIT PHONES: THE NAME YIELDS TO THE LEVEL, AND IT IS A MEASURED LINE ─
   Not a taste call and not a blanket phone rule. The arithmetic is the one the
   720px block below already sets out for the chip rail:

     side track = (W - 28 padding - 156 clock - 20 gap) / 2
     name box   = track - 16 pill padding - 4 border - 24 portrait - 12 gaps - 28 badge

   "HAMBURGER" measures ~107px at the 12px/800 this HUD gives a phone, so the name
   needs a 107px box and gets:

     W = 667 (landscape phone) .. track 231 .. name box 147   -> fits, with slack
     W = 430 .................. track 113 .. name box  29   -> one character
     W = 390 .................. track  93 .. name box   9   -> nothing

   MEASURED, both trees, at 390x844: the name was ALREADY ellipsised to "HAM…" before
   this pass (clipped 39px) and the badge took it to a 1-2px sliver (clipped 76px).
   A stub that reads as a rendering fault is worse than no name, and this is exactly
   the trade .hud-fighter--chip .hud-fighter-name already makes 40 lines up: THE
   PORTRAIT IS THE IDENTITY AT THIS SIZE. It is also your OWN character, chosen
   seconds earlier on the select screen.

   560, not 720: at 667 the name fits WITH the badge and dropping it there would
   remove something that works. The crossover solves at W = 586 (name box = 107), and
   560 is the round number below it with the nearest real viewport (430) far to the
   other side. ⚠️ Both 156 and 107 are measured, not derived — if the clock or the
   type scale moves, this number is stale. lk3_level asserts BOTH sides of it.

   ⚠️ The element is not removed, exactly as on a chip. [data-el="<slot>-name"] is
   still there and still carries its own slot's name — np_nfighter and h49_chips both
   read it by name. */
@media (max-width: 560px) {
  .hud-fighter-name { display: none; }
}

/* Short viewports (19.5:9 / 21:9 phones) — keep the radar clear of the weapon bar. */
@media (max-height: 640px) {
  .hud-radar-map { width: 105px; height: 75px; }
  /* ── ...AND THE RESULT CARD IS THE ONE ELEMENT HEIGHT ACTUALLY BINDS ─────────
     Arithmetic, measured at 844x390 (the landscape phone menu_accept uses):

       before this pass, TWO seats  = 373px of card in a 390px viewport (95.6%)
       WITHOUT these rules, SIX     = 399px, i.e. 9px PAST the bottom. That is
                                      rcw_fit --arm tallcard, which reverts exactly
                                      this block and is the known-bad for the
                                      vertical row.
       WITH them, SIX               = 265px, and 299px at 667x375.

     This viewport is above the max-width:720px regime, so it is still being
     handed the 48px title and 38x56 padding a desktop gets — on the shortest
     screen the game supports. The rules below give back ~108px: 40 of padding,
     40 of column gap, ~21 of title and ~7 of place.

     ⚠️ Keyed on HEIGHT, not on width or on touch, because height is what runs
     out: 1024x768 and 1280x800 carry the same 825px six-fighter card with 395px
     and 427px of vertical slack and must not shrink. There is no runtime backstop
     under this — see .hud-gameover-card for why max-height/overflow-y was measured
     and removed — so this arithmetic is the whole of the height budget, and
     rcw_fit's vertical rows are what hold it. 667x375 is the shortest viewport in
     that matrix, not 844x390. */
  .hud-gameover-card { padding: 18px 28px; gap: 10px; }
  .hud-gameover-title { font-size: 30px; }
  .hud-gameover-place { font-size: 20px; }
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

/* ── ...and above two seats the touch radar STOPS GUESSING where the bar ends ──
   🚨 THE TWO RULES ABOVE ARE CONSTANTS DERIVED FROM AN ASSUMED BAR HEIGHT, AND THE
   CHIP RAIL BROKE THE ASSUMPTION. Their own comments say so: 96 was chosen against
   "a clock column that ended around y=90", and 118 is "the clock's 102 plus a 16px
   gutter". Both are true of a bar that is one row at every seat count, which it was
   until this pass. With a rail it is 102px at two seats, 141px at six on a 390-wide
   phone and 229px at six on a 360-wide one — so the radar, which touch moves into
   the TOP-RIGHT CORNER the rail grows from, ends up underneath it.

   Measured by h49_chips --touch before this rule existed: .hud-chips overlapped
   .hud-radar at ALL THREE portrait widths menu_accept_portrait covers (360, 390,
   430) and at NONE of them in the plain DOM state — i.e. the collision lived
   entirely in the state no probe was looking at, which is why the probe now walks
   both and why .hud-radar is in its landmark set at all despite being a SIBLING
   of the top bar rather than a child.

   ⚠️ AND THIS COMMENT LOST ITS BACKTICKS THE HARD WAY, TWICE IN ONE PASS. The sheet
   is a template literal; one backtick in a CSS comment ends the string and the file
   stops parsing. Do not put them back.

   --fa-topbar-b is the bar's measured bottom, published by floatFloorY() on the
   same layout read that already feeds the float pills and the damage-layer clip —
   no new getBoundingClientRect, and it re-reads when the SEAT COUNT changes as well
   as the viewport (see that function's cache note).

   ⚠️ SCOPED TO .hud-topbar--chips, AND THAT IS THE ACCEPTANCE TEST, NOT TIDINESS.
   At two fighters the class does not exist, this selector cannot match, and the two
   rules above keep their exact constants — so the duel's pixels are untouched. The
   118px fallback is today's ≤400 value, so even a frame rendered before the first
   layout read lands where it lands now. Specificity (0,3,1) beats (0,2,1), which is
   what lets it win without !important and without reordering anything above it. */
html.fa-touch-capable .hud-topbar--chips ~ .hud-radar {
  top: calc(var(--fa-topbar-b, 118px) + 16px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   LANDSCAPE PHONE: THE TRAY LEAVES THE CENTRE OF PLAY
   ═══════════════════════════════════════════════════════════════════════════

   🚨 URI, FROM A LANDSCAPE PHONE: "the weapon choosing is on the most critical part
   of the screen where most gameplay happens." He is right, and the rule this replaces
   said the opposite in as many words — .hud-weapons above still opens with

       "Bottom-CENTRE, which on a phone in landscape is the one band along the bottom
        edge that neither thumb rests on"

   which is true about THUMBS and silent about the WORLD. Both thumbs are indeed clear
   of it; the arena is not. That sentence is kept above rather than deleted, because it
   records the reasoning this rule reverses.

   ── THE MEASUREMENT THAT SETTLES IT ────────────────────────────────────────
   tools/tmp/lu_occlude.mjs scores a control in the one currency that means anything
   here: the share of FAIR_PLAY.radiusUnits (199.2 wu, camera.ts, derived from
   rules.ts) that it HIDES. Not pixels — a pixel at the bottom of a 58 degree frame
   shows a fraction of the ground a pixel at the top does, so a pixel metric flatters
   every control along the bottom edge, which is where all of them are.

   Measured at e10baf6, fa-touch on, three landscape phone viewports:

       viewport    weapon tray hides    all controls together
       ─────────   ──────────────────   ─────────────────────
       844x390     7.92% of the disc    21.88%
       667x375     5.75%                22.66%
       932x430     6.45%                17.01%

   ── WHY THE CORNER IS NOT JUST TIDIER, IT IS ARITHMETICALLY CHEAPER ────────
   The guarantee is a DISC inscribed in the frame. A disc inscribed in a rectangle
   does not reach the rectangle's corners — so ground area hidden by a corner control
   tends to zero while ground hidden by a centre-bottom one does not. The reference
   pattern this genre settled on ("controls in the corners, the centre kept clear") is
   therefore not a style: it is the layout that minimises exactly this quantity, and
   the instrument arrives at it independently.

   ── THE SHAPE ──────────────────────────────────────────────────────────────
   A two-column cluster pinned to the BOTTOM-RIGHT corner, i.e. on the fire thumb's
   own side, which is where this genre puts the buttons that thumb has to reach. Slots
   stay 46px — the touch floor this HUD already committed to, and the reason the tray
   is not simply made smaller. Four weapons give 2x2; the roster runs 1 to 4 weapons
   (rules.ts: donut 1, lollipop 2, six at 3, three at 4) and a wrapping two-column grid
   holds every one of them without a second template.

   ⚠️ SCOPED TO html.fa-touch-capable AND TO LANDSCAPE, AND BOTH HALVES ARE LOAD-BEARING.
   * fa-touch-capable, because a DESKTOP tray is a readout with 1-4 printed on it, not
     a control a thumb must hit; bottom-centre is where the eye already is and nothing
     about it is in anyone's way. It also means menu_accept's five landscape viewports
     and every existing headless probe see byte-identical pixels, so this pass cannot
     move a number it was not aimed at.
   * (orientation: landscape), because portrait is DECISIONS §14's rotate-prompt case
     and menu_accept_portrait (219) is a shipped gate over it. Portrait keeps the
     centre tray it was measured with.
   ⚠️ NOT keyed on width. A tablet in landscape is a coarse pointer with two thumbs on
   the same two corners; the defect is the pointer and the orientation, not the size. */
@media (orientation: landscape) {
  html.fa-touch-capable .hud-weapons {
    left: auto;
    transform: none;
    right: calc(var(--fa-safe-r, 0px) + 12px);
    bottom: calc(var(--fa-safe-b, 0px) + 12px);
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-items: center;
    align-items: center;
    gap: 8px;
  }

  /* ── 58px HERE EVEN BELOW 720, AND THAT IS A REVERSAL WORTH READING ────────
     The max-width: 720px rule above takes a slot to 46px, and its own comment calls 46
     "the touch floor for the one HUD control a phone must be able to hit". It was never
     a preference for a smaller button — it was arithmetic forced by FOUR OF THEM IN A
     ROW: 4 x 58 + 3 x 10 = 262px of a 667px frame, sitting across the middle. In two
     columns the constraint is gone (2 x 58 + 8 = 124px), so the phone gets the LARGER
     target rather than the smaller one, which is the right way round and was not
     available before.

     🚨 AND FIXING IT HERE IS WHAT MAKES THE CLUSTER ONE WIDTH AT EVERY VIEWPORT.
     That is not tidiness, it is the fix for a measured defect: game/touch.ts has to
     place the aim hint clear of this cluster, and it can only do that with a constant
     if the cluster IS a constant. The first cut let the 720px breakpoint through, so the
     cluster was 124px wide above it and 100px below — and tools/tmp/lu_land.mjs caught
     an 8px label collision at 844, 932 and 740 and a clean pass at 667, from ONE
     offset that was correct for the narrow case only. Two files, two stylesheets, one
     silent coupling. Now: 124px everywhere, and lu_land asserts the clearance. */
  html.fa-touch-capable .hud-weapons .hud-weapon-slot {
    width: 58px;
    height: 58px;
    border-radius: 16px;
  }
  html.fa-touch-capable .hud-weapons .hud-weapon-emoji { font-size: 26px; }

  /* ── ...AND THE ITEM BUTTONS BECOME A COLUMN BESIDE IT, NOT A ROW ABOVE IT ──
     🚨 THIS WAS GOING TO GO ABOVE THE TRAY UNTIL THE CORNER WAS MEASURED, AND THE
     MEASUREMENT IS THE ONLY REASON IT DID NOT. tools/tmp/up_item_probe.mjs on the
     tree before this pass, fa-touch-capable on, six seats:

         viewport   .hud-radar bottom   .hud-weapons top   free band
         ────────   ─────────────────   ────────────────   ─────────
         844x390    y 232               y 251              19px
         667x375    y 214               y 236              22px
         932x430    y 232               y 291              59px

     A 58px row above the tray needs 66px and there are NINETEEN at the phone this HUD
     is tuned for. The right edge of a landscape phone is already full: radar at the
     top, tray at the bottom. So the cluster grows SIDEWAYS along the bottom edge, which
     is also the cheaper direction — lu_occlude's finding is that the guaranteed view
     is a DISC, ground hidden by a corner control tends to zero, and the bottom edge of a
     58 degree frame is the cheapest ground on screen.

     ── EVERY OFFSET IS FROM THE RIGHT EDGE, WHICH IS THE LESSON NEXT DOOR ────
     game/touch.ts spent a whole pass learning that a percentage is the wrong unit
     here because the cluster's left edge is a CONSTANT distance from the right of the
     screen. Same units, one more term:

       144 = 12 (safe gutter) + 124 (weapon cluster) + 8 (gap)
       58  wide, so this column's left edge is 202px in from the right at EVERY width

     ⚠️ AND THE AIM HINT'S 194 BECOMES 260 IN game/touch.ts — gated on the SAME
     html.fa-items flag, so a player with no loadout pays nothing. That file's rule
     carries the arithmetic and the warning that the two must move together;
     tools/tmp/lu_land.mjs row C is what catches it if they ever do not.

     ⚠️ 58px HERE EVEN BELOW 720px, for the tray's reason and by the tray's argument: two
     of them stacked is 124px of a 390px-tall frame, the two-column constraint that forced
     46px on the tray does not apply, and a constant width is what lets one number in a
     different file clear this cluster at every viewport. */
  html.fa-touch-capable .hud-items {
    left: auto;
    transform: none;
    right: calc(var(--fa-safe-r, 0px) + 144px);
    bottom: calc(var(--fa-safe-b, 0px) + 12px);
    flex-direction: column;
    align-items: center;
    /* 16, not the tray's 8: stacked vertically, the upper button's badge hangs 9px into
       whatever is below it. At 8 the NEED 3 pill sat 1px off the next button's rim —
       photographed at tools/tmp/up_shots/crop-blocked.png before this line existed. */
    gap: 16px;
  }
  html.fa-touch-capable .hud-items .hud-item-slot { width: 58px; height: 58px; }
  html.fa-touch-capable .hud-items .hud-item-glyph .fa-ic { width: 26px; height: 26px; }
  html.fa-touch-capable .hud-items .hud-item-badge { font-size: 11px; padding: 1px 5px; bottom: -7px; }
  /* The caption's step-over is a bottom-CENTRE rule and there is nothing bottom-centre
     here to step over — the cluster is in the corner. Cancelled explicitly rather than
     by scoping the rule above, so the two states are readable side by side. */
  html.fa-touch-capable.fa-items .hud-spectate {
    bottom: calc(var(--fa-safe-b, 0px) + 18px + 58px + 10px);
  }
  /* 12 + 58 + 16 + 58 = 144px of frame height, from the bottom edge up. The block's
     header carries the measurement that made a row above the tray impossible; this is
     what the column costs instead, and up_item_hud B is what keeps it honest. */

  /* ═════════════════════════════════════════════════════════════════════════
     ...AND THE CLOCK LIES DOWN, BECAUSE IT BECAME THE BIGGEST OCCLUDER IN THE FRAME

     🚨 THE TRAY PASS ABOVE MEASURED WHAT IT LEFT BEHIND, AND THE ANSWER WAS THIS
     COLUMN. Same instrument, same three viewports, same currency — the share of
     FAIR_PLAY.radiusUnits (199.2 wu) a control HIDES:

         viewport   the tray BEFORE that pass   the clock column, after it
         ────────   ─────────────────────────   ──────────────────────────
         844x390    7.92%                       13.12%
         667x375    5.75%                        9.01%
         932x430    6.45%                       10.21%

     So the control this HUD had never questioned was hiding two-thirds more of the
     guaranteed arena than the one Uri complained about.

     ── WHY IT IS EXPENSIVE, AND IT IS NOT "BECAUSE IT IS BIG" ─────────────────
     lu_occlude now reports the disc's TOP ARC. The guarantee is a DISC around the
     local fighter, so on a pitched frame it has a top edge, and ground above that
     edge is more than 199.2 wu away and is worth EXACTLY ZERO however many pixels it
     covers. Measured, at all three landscape phone viewports:

         844x390  the arc is at y = 52px (13.3% down the frame)
         667x375                  y = 52px (13.9%)
         932x430                  y = 60px (14.0%)

     ⚠️ AND THE ARC IS AN ARC — it PEAKS at the horizontal centre and falls away to
     both sides, which is why the two nameplates, 300px wide and 65px tall each, cost
     0.07% between them while a 196x108 column at dead centre costs 13.12%. The top
     centre is the most expensive square the frame has. So the lever is HEIGHT, not
     area: a control that fits above its own local arc is free, and a wide short one
     is cheaper than a narrow tall one of the same area because its ends reach out to
     where the arc is lower.

     ── THE SHAPE ─────────────────────────────────────────────────────────────
     The column becomes a ROW — timer pill beside the zone plate rather than above it
     — at the sizes the max-width:720px block already ships to phones, and the bar
     lifts from 14px to 6px off the top so the row lands inside the free band instead
     of straddling it. Measured on the same three viewports, share of the guaranteed
     arena hidden by the clock (lu_occlude, .hud-clock box / its two ink leaves):

         viewport   before            after            top bar height, touch
         ────────   ───────────────   ──────────────   ─────────────────────
         844x390    13.12% / 12.51%   0.49% / 0.47%    122px -> 71px
         667x375     9.01% /  9.01%   0.93% / 0.85%    103px -> 63px
         932x430    10.21% /  9.91%   0.00% / 0.00%

     and every control together goes 16.44% -> 4.33%, 20.86% -> 12.58%,
     12.13% -> 2.21%. The known-bad arm reinstates the pre-change plate inline and
     reproduces 12.51 / 9.01 / 9.91 exactly, so the before column is a paired reading
     on this same tree rather than a number remembered from another one.

     ⚠️ THE PLATE ITSELF IS NOT RESTYLED AND THAT IS DELIBERATE. Every value below is
     lifted verbatim from the max-width:720px block, which a landscape phone MISSES
     because it is 844 or 932 CSS px wide — wide, but only 390 tall. That block is
     the phone treatment; the breakpoint that gates it is a width, and a landscape
     phone fails a width test while being exactly the device it was written for. This
     rule is keyed on the pointer and the orientation, like the tray rule above it,
     and it hands the same plate to the same device through the right predicate.

     ⚠️ AND .hud-zone-row STAYS STACKED. Its own comment records that a side-by-side
     label+value overflowed the plate at every viewport and in every state, and that
     stacking is what gave the VALUE its 15px (12.5px here). Laying the CLOCK down is
     not the same change as laying the ZONE's contents down, and only the first one is
     made here — the second would spend a measured legibility fix to buy pixels the
     arc has already made free.

     ⚠️ IT COSTS THE NAMEPLATES SOME WIDTH AND THAT IS STATED, NOT HIDDEN. The clock
     is the middle of a three-part flex row, so a wider clock is narrower nameplates.
     Measured as painted area over the pair (lu_occlude's own rect sum, height
     unchanged): 39 000px2 -> 36 615 at 844 (-6.1% of width) and 26 391 -> 22 020 at
     667 (-16.6%). 667 is the one that has to be argued for rather than waved through,
     and the argument is that it buys 8.2 points of the guaranteed arena back and
     leaves a 232px-class plate at ~194px, which still holds "HAMBURGER" and a
     "70 / 70" bar at the sizes this viewport already uses.

     ⚠️ AT 667 IT ALSO WRAPS THE SIX-SEAT CHIP RAIL, AND THAT WAS CHECKED RATHER THAN
     ASSUMED. The rail needs 220px of side track and the wider clock leaves less, so
     it goes to two rows — which .hud-chips is built to do. h49_chips --touch is
     551/551 either way, and the bar it produces is SHORTER than before at every cell:
     122 -> 71px at 844 (all seat counts) and 103 -> 63px at 667, rising only to 89px
     at six seats there, against the 102px the clock column alone used to cost. The
     touch radar derives its top from --fa-topbar-b, so it follows all of that for
     free. */
  html.fa-touch-capable .hud-topbar { top: calc(var(--fa-safe-t, 0px) + 6px); }
  html.fa-touch-capable .hud-clock { flex-direction: row; align-items: flex-start; gap: 6px; }
  html.fa-touch-capable .hud-timer { font-size: 16px; padding: 4px 12px; }
  html.fa-touch-capable .hud-zone { width: 156px; padding: 3px 7px 5px; }
  html.fa-touch-capable .hud-zone-label { font-size: 9px; letter-spacing: 0.08em; }
  html.fa-touch-capable .hud-zone-value { font-size: 12.5px; }
  /* (0,4,1), so it beats .hud-zone.is-danger .hud-zone-label at (0,3,1). Without it
     the alarm state would keep the desktop 11px and the row would grow ~2px taller in
     exactly the state the player is being burned in. */
  html.fa-touch-capable .hud-zone.is-danger .hud-zone-label { font-size: 10px; }
}
/* ⚠️ THE AIM STICK'S RESTING HINT HAS TO MOVE OFF THIS CLUSTER, AND THAT RULE IS NOT
   HERE. It lives beside the element it restyles, in game/touch.ts (search for
   "the cluster this HUD now parks in that corner"), because .tch-hint--aim is that
   module's element and a cross-file rule for it is a rule nobody maintaining either
   file would find. The arithmetic tying the two together is written out there. */
`,_M=["countdown-tick","match-started","match-ended","weapon-fired","weapon-fired:giantSlam","projectile-spawned","projectile-destroyed:hit-target","projectile-destroyed:hit-cover","projectile-destroyed:expired","hit-landed:weapon","hit-landed:trail","hit-landed:hazard","hit-landed:fog","heal","death","splat-created","trail-mark-created"],zM="hamburger",PM="donut";function F0(t){const e=new URLSearchParams(location.search).get(t);return e&&Ee.includes(e)?e:null}function $M(){const t=new URLSearchParams(location.search).get("fighters");if(!t)return null;const e=[];for(const a of t.split(";")){const[o,n]=a.split("@"),s=o?.trim();if(!s||!Ee.includes(s))return null;const i={characterId:s};if(n){const[r,l]=n.split(",").map(Number);if(!Number.isFinite(r)||!Number.isFinite(l))return null;i.spawn={x:r,y:l}}e.push(i)}return e.length>=3?e:null}function BM(t){if(!t)return[];const e=[];for(const a of t){if(e.length>=Tt)break;if(typeof a!="string"||!(a in Ce))continue;const o=a;e.includes(o)||e.push(o)}return e}function UM(){const t=new URLSearchParams(location.search).get("items");return t===null?null:t.split(",").map(e=>e.trim()).filter(Boolean)}function js(t){const e=new URLSearchParams(location.search).get(t);if(e===null)return null;const a=Number(e);return Number.isFinite(a)?a:null}function qM(t){if(t.type!=="hit-landed")return t;const e=t.targetRole??"enemy",a=t.source.kind==="trail"&&t.source.ownerRole===void 0?{...t.source,ownerRole:K0(e)}:t.source;return{...t,targetRole:e,source:a}}const jM=ee+.35;class co{constructor(e){this.opts=e,this.playerId=e.playerCharacterId??F0("player")??zM,this.enemyId=e.enemyCharacterId??F0("enemy")??PM;const a=Ba(e.playerLevel??js("level")??ko);this.levels={player:a,enemy:lu(a)},this.roster=e.roster&&e.roster.length>nt&&e.roster.length<=Gt?e.roster.slice():null,this.items=BM(e.items?.length?e.items:UM()??void 0),this.characterIds=this.qaFighters?this.qaFighters.map(n=>n.characterId):this.roster?this.roster.slice():[this.playerId,this.enemyId];const o=Number(new URLSearchParams(location.search).get("simSpeed"));this.simSpeed=Number.isFinite(o)&&o>0?Math.min(50,o):1,this.stage=new nh({container:e.container,background:16764810,fog:{color:16764810,near:40,far:130},camera:{pitchDeg:58,yawDeg:0,frameMode:"fair"}}),this.stage.scene.add(this.arena.build()),this.fogRing=gy(this.arena.center),this.stage.scene.add(this.fogRing.root),this.vfx=new CM(this.stage.scene),this.hud=DM(e.hudRoot,{onRestart:()=>this.restart(),onSelectWeapon:n=>this.input.selectWeapon(n)}),this.hud.setCharacters(this.characterIds),this.input=new iy(this.stage.canvas),this.input.setWeaponCount(ce[this.characterIds[Le]].weapons.length),this.pointerLock=b2({target:this.stage.canvas,pause:()=>this.pause(),resume:()=>this.resume(),onLockChange:n=>this.input.setPointerLocked(n)}),this.state=this.newMatch(),this.spawnMatch(),window.__matchDebug=this.debug,window.__feelDebug=this.feel,window.__feelEvent=n=>this.handleEvents([qM(n)]),window.__matchArena=this.arena,window.addEventListener("resize",this.handleResize),this.raf=requestAnimationFrame(this.loop)}stage;arena=gg();vfx;audio=tb();hud;input;pointerLock;fogRing;playerId;enemyId;levels;characterIds;qaFighters=$M();roster;items;models=[];state;eliminated=[];killedBy=[];viewSubject=Le;spectateDwellMs=0;static SPECTATE_DWELL_MS=1350;endedOutcome=null;endedPayout=null;clock=new wg;raf=0;disposed=!1;readyFired=!1;isPaused=!1;lastPhase=null;raycaster=new bg;groundPlane=new yg(new fe(0,1,0),0);rayHit=new fe;projectVec=new fe;projectileOrigins=new Map;simSpeed;qaFogRadius=js("fogRadius");qaPlayerX=js("px");qaPlayerY=js("py");debug={phase:"countdown",winner:null,paused:!1,moveX:0,moveY:0,attack:!1,facingX:0,facingY:0,selectedWeapon:0,pointerLocked:!1,qaSpawnInsideCover:null,frames:0,viewSubject:Le,viewReason:"local",loadouts:[]};feel={events:Object.fromEntries(_M.map(e=>[e,0])),responses:{vfx:0,shake:0,hitStop:0,knockback:0,damageNumber:0,screenFlash:0},hitStopBudgetMs:0,hitStopBankedMs:0,lastHitStopMs:0,rawDtMs:0,stepDtMs:0,frames:0,frozenFrames:0,repayingFrames:0,peakHitAmount:0,peakShakeM:0,shakeSumM:0,shakeRawSumM:0,peakShakeRawM:0};hitStopBudgetMs=0;hitStopBankedMs=0;static HITSTOP_TRICKLE=.05;static HITSTOP_CATCHUP_RATE=3;static SHAKE_MAX_M=.4;shakeFadeUnits=-1;knockback=[];restart(){this.spawnMatch(),this.resume()}get paused(){return this.isPaused}pause(){this.isPaused=!0,this.pointerLock.release(),this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.hudSafeArrow(),observerSlot:this.viewSubject,aim:null,...this.hudResult()})}resume(){this.isPaused=!1,this.pointerLock.engage()}resize(){this.stage.resize()}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),window.__matchDebug===this.debug&&delete window.__matchDebug,window.__feelDebug===this.feel&&delete window.__feelDebug,window.__matchArena===this.arena&&delete window.__matchArena,delete window.__feelEvent,window.removeEventListener("resize",this.handleResize),this.pointerLock.dispose(),this.input.dispose(),this.hud.dispose(),this.vfx.dispose(),this.fogRing.dispose();for(const e of this.models)e.dispose();this.stage.dispose()}newMatch(){return this.qaFighters?Ts(this.arena,this.qaFighters):this.roster?Ts(this.arena,this.roster.map((e,a)=>({characterId:e,level:a===Le?this.levels.player:this.levels.enemy,items:a===Le?this.items:void 0}))):this.items.length===0?Ts(this.arena,this.playerId,this.enemyId,this.levels):Ts(this.arena,[{characterId:this.playerId,level:this.levels.player,items:this.items},{characterId:this.enemyId,level:this.levels.enemy}])}spawnMatch(){this.state=this.newMatch(),this.applyQaSetup();for(const n of this.models)this.stage.scene.remove(n.root),n.dispose();const e=je(this.state);this.debug.loadouts=e.map(n=>n.item.equipped.slice()),this.models=e.map((n,s)=>sh(this.characterIds[s]??n.characterId));for(const n of this.models)this.stage.scene.add(n.root);this.models.forEach((n,s)=>{this.syncModelTransform(n,e[s]),n.play("idle")}),this.vfx.clear(),this.audio.reset(),this.input.reset(),this.projectileOrigins.clear(),this.eliminated.length=0,this.killedBy.length=0,this.viewSubject=Le,this.spectateDwellMs=0,this.hitStopBudgetMs=0,this.hitStopBankedMs=0;for(const n of Object.keys(this.feel.events))this.feel.events[n]=0;this.feel.responses.vfx=0,this.feel.responses.shake=0,this.feel.responses.hitStop=0,this.feel.responses.knockback=0,this.feel.responses.damageNumber=0,this.feel.responses.screenFlash=0,this.feel.frames=0,this.feel.frozenFrames=0,this.feel.repayingFrames=0,this.feel.peakHitAmount=0,this.feel.peakShakeM=0,this.feel.lastHitStopMs=0,this.feel.shakeSumM=0,this.feel.shakeRawSumM=0,this.feel.peakShakeRawM=0,this.knockback=e.map(()=>({x:0,z:0}));const a=Qe(this.state),o=Ne(a.x,a.y);this.stage.rig.snapTo(o.x,o.z),this.stage.lighting.focus(o.x,o.z),this.fogRing.update(this.state.safeRadius,this.state.elapsed/1e3,this.state.phase==="playing",this.stage.rig),this.lastPhase=null,this.notifyPhase()}applyQaSetup(){const e=Qe(this.state);if(this.qaPlayerX!==null&&(e.x=this.qaPlayerX),this.qaPlayerY!==null&&(e.y=this.qaPlayerY),(this.qaPlayerX!==null||this.qaPlayerY!==null)&&this.checkQaSpawn(),this.qaFogRadius===null)return;const a=this.arena.maxSafeRadius;this.state.phase="playing",this.state.countdownValue=0,this.state.countdownTick=0,this.state.startFlashTimer=0;const o=Math.max(si(this.state.fighters.length),a*(Il/$a));if(this.qaFogRadius<=o){this.qaFogRadius>Sl&&console.warn(`[QA] ?fogRadius=${this.qaFogRadius} is below the lowest radius the schedule ever reaches (${o.toFixed(2)} wu — DECISIONS §2 collapses the ring at ${xg/1e3} s). Snapped to SUDDEN DEATH (radius 0). Ask for a larger radius if you wanted a ring.`),this.state.timeRemaining=Il,this.state.safeRadius=Sl;return}const n=V.clamp(this.qaFogRadius,o,a),s=V.clamp(n/a,0,1);this.state.timeRemaining=$a*s,this.state.safeRadius=n}checkQaSpawn(){const e=Qe(this.state),a=this.arena.cover.find(o=>Qn(e.x,e.y,e.size,e.size,o.x,o.y,o.w,o.h));this.debug.qaSpawnInsideCover=a?`${a.kind??"cover"} @(${a.x},${a.y}) ${a.w}x${a.h}`:null,a&&console.warn(`[QA] ?px=${e.x}&py=${e.y} places the player INSIDE cover "${a.kind??"cover"}" @(${a.x},${a.y}) ${a.w}x${a.h}. There is no depenetration in movement.ts, so the fighter cannot move at all — input is fine, the sim is refusing every step. Pick a point at least ${((e.size+Math.max(a.w,a.h))/2).toFixed(0)} wu from that centre.`)}aimCursor(){const e=this.input.aimOffsetPx;if(!e)return null;const a=Qe(this.state),o=this.projectPointToScreen(a.x,a.y,0);return o?{from:o,at:{x:o.x+e.x,y:o.y+e.y}}:null}buildInput(){const e=this.state.phase==="playing",a=e?this.input.moveAxes():{x:0,y:0};let o;if(e){const s=this.aimCursor();let i=this.input.mouseNdc;if(s){const r=this.stage.canvas.getBoundingClientRect();i={x:(s.at.x-r.left)/r.width*2-1,y:-((s.at.y-r.top)/r.height*2-1)}}if(i){this.raycaster.setFromCamera(new vg(i.x,i.y),this.stage.rig.camera);const r=this.raycaster.ray.intersectPlane(this.groundPlane,this.rayHit);if(r){const l=Qe(this.state);o={x:Sc(r.x)-l.x,y:Sc(r.z)-l.y}}}}const n=e&&this.input.attackHeld;return{move:a,aim:o,selectedWeapon:this.input.selectedWeapon,attack:n}}syncModelTransform(e,a){const o=Ne(a.x,a.y);e.root.position.set(o.x,0,o.z),e.root.rotation.y=Math.atan2(a.facing.x,a.facing.y)}attackerSlotOf(e,a){let o=null;if(e.kind==="weapon"?o=Fn(this.state,e,a):e.kind==="trail"&&(o=Vc(this.state,e)),!o)return;const n=je(this.state).indexOf(o);return n>=0?n:void 0}colorForDamageSource(e,a){switch(a.kind){case"weapon":{const o=Fn(this.state,a,e);return ce[o.characterId].weapons.find(s=>s.key===a.weaponKey)?.color??"#FFFFFF"}case"trail":return ua(a.ownerId,a.ownerRole)===Le?"#FF9EC4":"#FFD27A";case"hazard":return"#FF7A3D";case"fog":return"#B98CE6";default:return"#FFFFFF"}}triggerHitStop(e){this.hitStopBudgetMs=Math.max(this.hitStopBudgetMs,e),this.feel.responses.hitStop++,this.feel.lastHitStopMs=e}kick(e,a,o){const n=Math.min(e,co.SHAKE_MAX_M),s=n*a;this.stage.rig.shake(s,o),this.feel.responses.shake++,this.feel.shakeSumM+=s,this.feel.shakeRawSumM+=n,s>this.feel.peakShakeM&&(this.feel.peakShakeM=s),n>this.feel.peakShakeRawM&&(this.feel.peakShakeRawM=n)}shakeProximity(e,a){this.shakeFadeUnits<0&&(this.shakeFadeUnits=this.stage.rig.shakeFadeRadiusUnits());const o=this.viewObserver();return kg(Math.hypot(e-o.x,a-o.y),this.shakeFadeUnits)}viewObserver(){return je(this.state)[this.viewSubject]??Qe(this.state)}updateViewSubject(e){const a=je(this.state);if(a[Le]?.alive){this.viewSubject=Le,this.spectateDwellMs=0,this.audio.setListener(Le),this.debug.viewSubject=Le,this.debug.viewReason="local";return}if(this.spectateDwellMs>0){this.spectateDwellMs=Math.max(0,this.spectateDwellMs-e),this.debug.viewReason="dwell";return}this.shakeFadeUnits<0&&(this.shakeFadeUnits=this.stage.rig.shakeFadeRadiusUnits());const o=this.stage.rig.targetUnits(),n=Mg({seats:a,localSlot:Le,current:this.viewSubject,killedBy:this.killedBy,cameraX:o.x,cameraY:o.y,cutBeyondUnits:this.shakeFadeUnits});if(n.slot!==this.viewSubject&&(this.viewSubject=n.slot,n.cut)){const s=a[n.slot];if(s){const i=Ne(s.x,s.y);this.stage.rig.snapTo(i.x,i.z),this.stage.lighting.focus(i.x,i.z)}}this.audio.setListener(this.viewSubject),this.debug.viewSubject=this.viewSubject,this.debug.viewReason=n.reason}applyKnockback(e,a,o,n){const s=je(this.state)[e],i=this.knockback[e];if(!s||!i)return;const r=s.x-a,l=s.y-o,h=Math.hypot(r,l);if(h<1e-4)return;const c=V.clamp(n,0,.22);i.x+=r/h*c,i.z+=l/h*c,this.feel.responses.knockback++}handleEvents(e){const a=[],o=[];for(const n of e){const s=n.type==="hit-landed"?`hit-landed:${n.source.kind}`:n.type==="projectile-destroyed"?`projectile-destroyed:${n.reason}`:n.type;switch(s in this.feel.events&&this.feel.events[s]++,n.type){case"weapon-fired":{const i=this.models[ua(n.fighterId,n.fighterRole)],r=At(this.state,n.fighterId,n.fighterRole);if(!i)break;const l=ce[r.characterId].weapons,h=l.findIndex(d=>d.key===n.weaponKey),c=l[h<0?0:h];i.play("attack",{weaponIndex:h<0?0:h}),c&&(this.vfx.spawnWeaponCast(r.x,r.y,r.facing,c,r.characterId),this.feel.responses.vfx++,c.giantSlam&&(this.feel.events["weapon-fired:giantSlam"]++,this.hud.flashScreen(c.color),this.feel.responses.screenFlash++,this.kick(.55,this.shakeProximity(r.x,r.y),2.6),this.triggerHitStop(120),window.__vfxDebugGiantSlamCount=(window.__vfxDebugGiantSlamCount??0)+1));break}case"hit-landed":{const i=ua(n.targetId,n.targetRole);this.models[i]?.play("hit",{intensity:V.clamp(n.amount/12,.25,1)});const l=this.colorForDamageSource(n.targetRole,n.source);if(a[i]=l,o[i]=this.attackerSlotOf(n.source,n.targetRole),n.source.kind==="fog"){const f=this.projectPointToScreen(n.x,n.y,1.3);f&&(this.hud.spawnDamageNumber(f,n.amount,{fog:!0}),this.feel.responses.damageNumber++),i===Le&&(this.hud.flashFogTick(),this.feel.responses.screenFlash++);break}let h;if(n.source.kind==="weapon"){const f=Fn(this.state,n.source,n.targetRole),g=n.source.weaponKey,w=ce[f.characterId].weapons.find(b=>b.key===g);w&&(h={weapon:w,characterId:f.characterId,fromXWU:f.x,fromYWU:f.y})}this.vfx.spawnImpactBurst(n.x,n.y,l,n.amount,h),this.feel.responses.vfx++,n.amount>this.feel.peakHitAmount&&(this.feel.peakHitAmount=n.amount);const c=this.projectPointToScreen(n.x,n.y,1.3);c&&(this.hud.spawnDamageNumber(c,n.amount),this.feel.responses.damageNumber++);const d=n.source.kind==="weapon",p=V.clamp(.012+n.amount*.0175,.012,co.SHAKE_MAX_M),u=i===Le?1.25:1,m=At(this.state,n.targetId,n.targetRole);if(this.kick(p*u*(d?1:.45),this.shakeProximity(m.x,m.y)),d&&this.triggerHitStop(V.clamp(10+n.amount*4.6,16,105)),n.source.kind==="weapon"){const f=n.source,g=Fn(this.state,f,n.targetRole);(ce[g.characterId].weapons.find(y=>y.key===f.weaponKey)?.knockback??0)>0||this.applyKnockback(i,g.x,g.y,.05+n.amount*.006)}else if(n.source.kind==="trail"){const f=Vc(this.state,n.source);this.applyKnockback(i,f.x,f.y,.03)}break}case"projectile-spawned":{this.projectileOrigins.set(n.id,{color:n.color,x:n.x,y:n.y});break}case"projectile-destroyed":{const i=this.projectileOrigins.get(n.id);if(this.projectileOrigins.delete(n.id),n.reason!=="hit-cover")break;this.vfx.spawnCoverScuff(n.x,n.y,i?.color??"#FFFFFF",i?n.x-i.x:0,i?n.y-i.y:0);break}case"heal":{const i=At(this.state,n.fighterId,n.fighterRole);this.vfx.spawnHealPulse(i.x,i.y),this.feel.responses.vfx++;const r=this.projectPointToScreen(i.x,i.y,1.6);r&&(this.hud.spawnDamageNumber(r,n.amount,{heal:!0}),this.feel.responses.damageNumber++);break}case"death":{const i=ua(n.fighterId,n.fighterRole);this.eliminated.push(i),this.killedBy[i]=o[i]??null,i===this.viewSubject&&(this.spectateDwellMs=co.SPECTATE_DWELL_MS),this.models[i]?.play("death");const r=At(this.state,n.fighterId,n.fighterRole),l=a[i]??"#FFFFFF";this.vfx.spawnDeathBurst(r.x,r.y,l),this.feel.responses.vfx++,this.kick(.42,this.shakeProximity(r.x,r.y),3),this.triggerHitStop(90);break}}}}groundOnScreen(e,a){return this.projectVec.set(e,0,a),this.projectVec.project(this.stage.rig.camera),this.projectVec.z<=1&&Math.abs(this.projectVec.x)<=1&&Math.abs(this.projectVec.y)<=1}projectToScreen(e,a){if(!a||!this.groundOnScreen(e.root.position.x,e.root.position.z)||(this.projectVec.set(e.root.position.x,jM,e.root.position.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1))return null;const o=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*o.width+o.left,y:(1-(this.projectVec.y*.5+.5))*o.height+o.top}}projectPointToScreen(e,a,o){const n=Ne(e,a);if(!this.groundOnScreen(n.x,n.z)||(this.projectVec.set(n.x,o,n.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1))return null;const s=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*s.width+s.left,y:(1-(this.projectVec.y*.5+.5))*s.height+s.top}}safeArrow(){const e=Qe(this.state),a=this.arena.center.x-e.x,o=this.arena.center.y-e.y,n=Math.hypot(a,o);if(n<.001)return null;const s=this.projectPointToScreen(e.x,e.y,.35),i=this.projectPointToScreen(e.x+a/n*80,e.y+o/n*80,.35);if(!s||!i)return null;const r=i.x-s.x,l=i.y-s.y;return Math.hypot(r,l)<1?null:{at:s,angleRad:Math.atan2(l,r)}}notifyPhase(){this.state.phase!==this.lastPhase&&(this.lastPhase=this.state.phase,this.pointerLock.setMatchActive(this.state.phase!=="ended"),this.endedOutcome=this.state.phase==="ended"?this.outcome():null,this.state.phase!=="ended"&&(this.endedPayout=null),this.opts.onPhase?.(this.state.phase,this.state.winner,this.endedOutcome))}showPayout(e){this.endedPayout=e}hudSafeArrow(){return Qe(this.state).alive?this.safeArrow():null}hudResult(){return{place:this.hudPlace(),order:this.endedOutcome?.places??null,payout:this.endedOutcome?this.endedPayout:null}}hudPlace(){const e=this.endedOutcome;return!e||e.seats<=1||e.localPlace<0?null:{place:e.localPlace+1,of:e.seats}}outcome(){const a={seats:je(this.state).map((n,s)=>({id:s,alive:n.alive,hp:n.hp,maxHp:n.maxHp,x:n.x,y:n.y,deaths:n.deaths})),center:{x:this.arena.center.x,y:this.arena.center.y},eliminated:this.eliminated,winnerId:this.state.winnerId??null},o=o1(a);return{seats:a.seats.length,places:o,localPlace:o.indexOf(Le),winnerId:a.winnerId}}handleResize=()=>this.resize();publishDebug(e,a,o){const n=this.debug;n.phase=this.state.phase,n.winner=this.state.winner,n.paused=this.isPaused,n.moveX=e,n.moveY=a,n.attack=o;const s=Qe(this.state);n.facingX=s.facing.x,n.facingY=s.facing.y,n.selectedWeapon=this.input.selectedWeapon,n.pointerLocked=this.input.pointerLocked,n.frames++}decayKnockback(e){const a=Math.exp(-e*14);for(const o of this.knockback)o.x*=a,o.z*=a,Math.abs(o.x)<1e-4&&(o.x=0),Math.abs(o.z)<1e-4&&(o.z=0)}loop=()=>{if(this.disposed)return;const e=Math.min(this.clock.getDelta(),1/20)*this.simSpeed,a=e*1e3;if(this.isPaused){this.publishDebug(0,0,!1),this.stage.render(0),this.raf=requestAnimationFrame(this.loop);return}let o;if(this.hitStopBudgetMs>0)this.hitStopBudgetMs=Math.max(0,this.hitStopBudgetMs-a),o=a*co.HITSTOP_TRICKLE,this.hitStopBankedMs+=a-o;else if(this.hitStopBankedMs>0){const u=Math.min(this.hitStopBankedMs,a*co.HITSTOP_CATCHUP_RATE);this.hitStopBankedMs-=u,o=a+u}else o=a;const n=o/1e3;this.feel.rawDtMs=a,this.feel.stepDtMs=o,this.feel.hitStopBudgetMs=this.hitStopBudgetMs,this.feel.hitStopBankedMs=this.hitStopBankedMs,this.feel.frames++,o<a*.5?this.feel.frozenFrames++:o>a*1.05&&this.feel.repayingFrames++;const s=je(this.state),i=s.map(u=>({x:u.x,y:u.y})),r=this.buildInput(),l=n2(this.state,o,r);this.handleEvents(l),this.audio.handleEvents(l,this.state),this.notifyPhase(),this.publishDebug(r.move.x,r.move.y,r.attack===!0);const h=s.map((u,m)=>u.x!==i[m].x||u.y!==i[m].y);this.models.forEach((u,m)=>{const f=s[m];if(!f)return;this.syncModelTransform(u,f);const g=this.knockback[m];g&&(u.root.position.x+=g.x,u.root.position.z+=g.z)}),this.decayKnockback(e),this.updateViewSubject(a);const c=this.viewObserver();this.models.forEach((u,m)=>{if(m===Le)return;const f=s[m];f&&(u.root.visible=ah(this.state,c,f))}),this.models.forEach((u,m)=>{s[m]?.alive&&u.play(h[m]?"run":"idle")});const d=this.state.elapsed/1e3;this.models.forEach((u,m)=>{const f=s[m];f&&u.update({dt:n,elapsed:d,moveSpeed01:f.alive&&h[m]?1:0,health01:f.hp/f.maxHp})}),this.arena.update?.(n,d),this.vfx.sync(this.state),this.vfx.updateEffects(e),this.fogRing.update(this.state.safeRadius,this.clock.elapsedTime,this.state.phase==="playing",this.stage.rig);const p=Ne(c.x,c.y);this.stage.rig.follow(p.x,p.z),this.stage.lighting.focus(p.x,p.z),window.__vfxDebugScreen={player:this.projectPointToScreen(s[0].x,s[0].y,0),enemy:s[1]?this.projectPointToScreen(s[1].x,s[1].y,0):null,slots:s.map(u=>this.projectPointToScreen(u.x,u.y,0))},this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.hudSafeArrow(),aim:Qe(this.state).alive?this.aimCursor():null,observerSlot:this.viewSubject,...this.hudResult()}),this.hud.updateFloatingBars(this.models.map((u,m)=>{const f=s[m];if(!f)return null;const g=m===Le?f.alive:f.alive&&ah(this.state,c,f);return this.projectToScreen(u,g)}),s.map(u=>u.hp/u.maxHp)),this.stage.render(e),this.readyFired||(this.readyFired=!0,window.__gameReady=!0,window.__previewReady=!0),this.raf=requestAnimationFrame(this.loop)}}function WM(t){return new co(t)}const uc="Escape";function GM(t,e){if(e.name!=="match")throw new Error("createMatchScreen: wrong route");ya("fa-match-styles",YM),xa();const a=He("div","fa-screen-bare fa-match");a.innerHTML=`
    <!-- The chip is NOT inside .match-corner. It has to be positioned against the
         screen so it can sit clear of the thumb zone, and .match-corner is itself
         absolutely positioned — so nesting it there made 'top: 96px' resolve against
         the corner and put the chip 140px BELOW the bottom of the frame. Measured,
         not reasoned about: tools/tmp/thumbzone.mjs. -->
    <button class="match-chip" type="button" data-el="pause" aria-label="Pause">${_("pause",{size:"22px"})}</button>

    <div class="match-corner">
      <button class="fa-btn fa-btn--quiet match-exit" type="button" data-el="exit">${_("back")} Menu</button>
    </div>

    <div class="match-sheet" data-el="sheet">
      <div class="match-sheet-card">
        <div class="match-sheet-pane" data-el="pane-pause">
          <p class="match-sheet-title">Paused</p>
          <button class="fa-btn fa-btn--primary" type="button" data-el="resume">${_("play")} Resume</button>
          <button class="fa-btn fa-btn--quiet" type="button" data-el="change">${_("swap")} Change Fighter</button>
          <button class="fa-btn fa-btn--quiet" type="button" data-el="quit">${_("home")} Quit to Home</button>
        </div>
        <div class="match-sheet-pane match-sheet-pane--confirm" data-el="pane-confirm" hidden>
          <p class="match-sheet-title">Leave the match?</p>
          <p class="match-sheet-body" data-el="confirmbody"></p>
          <button class="fa-btn fa-btn--primary" type="button" data-el="keep">${_("play")} Keep Playing</button>
          <button class="fa-btn fa-btn--quiet match-leave" type="button" data-el="leave">${_("close")} Leave</button>
        </div>
      </div>
    </div>
  `;const o=E=>{const x=a.querySelector(`[data-el="${E}"]`);if(!x)throw new Error(`matchScreen: missing element "${E}"`);return x},n=o("sheet"),s=o("pause"),i=o("exit");let r=!1;const l=e.seats===void 0?void 0:X0(e.player,e.enemy,e.seats),h=WM({container:t.gameHost,hudRoot:t.hudRoot,playerCharacterId:e.player,enemyCharacterId:e.enemy,roster:l,items:Eh(Sh(t.profile.economy)),playerLevel:t.profile.characterLevel(e.player),onPhase(E,x,M){if(E==="ended"){if(!r){r=!0;const T=M!==null&&M.localPlace>=0&&M.seats>=nt&&M.seats<=Gt&&M?t.profile.recordPlacement(M.localPlace,M.seats):t.profile.recordResult(x==="player");h.showPayout({trophies:T.trophies,coins:T.coins,xp:mu(T.place,T.seats),chests:T.chests})}a.classList.add("is-ended")}else r=!1,a.classList.remove("is-ended")}}),c=o("pane-pause"),d=o("pane-confirm"),p=o("leave"),u="22px";function m(E){s.innerHTML=_(E?"play":"pause",{size:u}),s.setAttribute("aria-label",E?"Resume":"Pause")}const f=350;let g=0,w=null;function b(E,x,M){w=E,p.innerHTML=`${_(M)} ${x}`,o("confirmbody").textContent="This match ends now — no trophies, coins or XP from it.",c.hidden=!0,d.hidden=!1,p.disabled=!0,window.clearTimeout(g),g=window.setTimeout(()=>{p.disabled=!1},f)}function y(){w=null,window.clearTimeout(g),p.disabled=!0,d.hidden=!0,c.hidden=!1}function v(E){E||y(),E?h.pause():h.resume(),n.classList.toggle("is-open",E),m(E)}s.addEventListener("click",()=>v(!h.paused)),o("resume").addEventListener("click",()=>v(!1)),o("change").addEventListener("click",()=>b({name:"characters"},"Change Fighter","swap")),o("quit").addEventListener("click",()=>b({name:"home"},"Quit to Home","home")),o("keep").addEventListener("click",()=>v(!1)),p.addEventListener("click",()=>{w&&t.navigate(w)}),i.addEventListener("click",()=>t.navigate({name:"home"}));const k=E=>{if(E.key===uc){if(E.preventDefault(),w!==null){y();return}v(!h.paused)}};return window.addEventListener("keydown",k),i.title=l?l.map(E=>ce[E].name).join(" · "):`${ce[e.player].name} vs ${ce[e.enemy].name}`,{root:a,resize(){h.resize()},dispose(){window.removeEventListener("keydown",k),window.clearTimeout(g),h.dispose(),a.remove()}}}const YM=`
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
  background: rgba(26,18,36,0.88);
  border: 3px solid #1a1224;
  border-radius: 14px;
  /* ── 🚨 THE PLATE WAS INVISIBLE, AND THAT IS THE WHOLE REASON THIS GAME READ AS
     HAVING NO WAY OUT ──────────────────────────────────────────────────────────
     Measured on a served snapshot at 390x844, six seats, mid-match: the chip's fill
     against the ring of pixels immediately outside it came to **1.026:1**. One is
     "identical". The chip copied '.hud-clock''s plate — rgba(26,18,36,0.78) on a
     #1a1224 border — which works for the clock because the clock is mostly big cream
     numerals, and does not work for a 44px square whose entire ink is two 4px bars.
     In portrait that square sits in the letterbox band, which is very nearly the same
     colour as the plate, so the player saw two floating tick marks and no button.
     'src/ui/icons/index.ts''s header already records that this project has shipped the
     dark-on-dark bug three separate times; this is the fourth, and it is the one that
     hid the only exit.

     The fix is a TWO-TONE edge, not a lighter fill, and the reason is that the chip is
     over the arena in landscape and over the letterbox in portrait. A lighter fill
     that clears 3:1 against the letterbox measures 1.37:1 against the arena's pink
     floor — it fixes one orientation and fails the other. Cream outside / ink inside
     always has a >=3:1 step somewhere across the boundary whatever is behind it: cream
     against the letterbox is 17.0:1, cream against the brightest floor pink is 3.45:1,
     and where the backdrop is itself cream the inner ink border carries it at 17:1.
     The floor is WCAG 2.1 SC 1.4.11 (non-text contrast, 3:1) — a published external
     number, not one invented here. 'tools/tmp/qx_quit.mjs' §C measures it. */
  box-shadow: 0 0 0 2px rgba(255,243,222,0.92), 0 5px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-match .match-chip:hover { background: rgba(58,40,80,0.9); }
.fa-match .match-chip:active {
  transform: translateY(3px);
  /* The ring survives the press — it is the control's boundary, not its decoration. */
  box-shadow: 0 0 0 2px rgba(255,243,222,0.92), 0 0 0 rgba(0,0,0,0.35);
}

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

/* ⚠️ '[hidden]' IS A UA 'display: none' AND A CLASS RULE OUTRANKS IT. Declaring
   'display: flex' on '.match-sheet-pane' without the line below leaves the hidden pane
   fully laid out and clickable — both panes stacked, and the Leave button live before
   anyone has asked for a confirm. Same shape as every other "it isn't there / it IS
   there and invisible" defect in this repo, inverted. */
.fa-match .match-sheet-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fa-match .match-sheet-pane[hidden] { display: none; }

.fa-match .match-sheet-body {
  margin: 0 0 2px;
  max-width: min(340px, 70vw);
  text-align: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 500;
  font-size: clamp(0.72rem, 1.7vh, 0.92rem);
  line-height: 1.35;
  color: rgba(255,243,222,0.82);
}

/* The destructive half of the confirm, and the ONLY control in the product that ends
   something the player cannot get back. Tinted rather than restyled: it keeps the
   'fa-btn--quiet' material so it still reads as the same family of button, and the
   ketchup wash plus a smaller footprint say "this is the other one" without inventing
   a variant in 'theme.ts', which this file does not own. */
.fa-match .match-leave {
  align-self: center;
  min-width: 62%;
  background: linear-gradient(180deg, #FFE2DA 0%, #F4B7A6 100%);
  box-shadow: 0 4px 0 rgba(120,40,20,0.45);
  /* The 350ms arming window (see LEAVE_ARM_MS) rides the theme's [disabled] opacity.
     Fading it in makes the wait read as the button ARRIVING rather than as a dead
     control, which is the difference between a safety and a bug report. */
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s, opacity 0.25s ease-out;
}
.fa-match .match-leave:active { box-shadow: 0 0 0 rgba(120,40,20,0.45); }
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
`,mm="food-arena.settings.v1",VM="fa-reduce-motion";function gm(){try{const t=localStorage.getItem(mm),e=t?JSON.parse(t):{};return{reduceMotion:e.reduceMotion===!0,moveKeys:XM(e.moveKeys)}}catch{return{reduceMotion:!1,moveKeys:{}}}}function wl(t){try{localStorage.setItem(mm,JSON.stringify(t))}catch{}}function wm(){const t=gm();document.documentElement.classList.toggle(VM,t.reduceMotion),oh(t.moveKeys)}const fa=["up","left","down","right"],Ln={up:"Move up",left:"Move left",down:"Move down",right:"Move right"},vo={...aa},KM=[{code:Ah,does:"mutes the game"},{code:uc,does:"pauses a match"},{code:"Tab",does:"moves between controls"},{code:"Enter",does:"presses the control you are on"},{code:"NumpadEnter",does:"presses the control you are on"},...Array.from({length:Rh},(t,e)=>[{code:`Digit${e+1}`,does:"picks a weapon"},{code:`Numpad${e+1}`,does:"picks a weapon"}]).flat()];function bm(t){return KM.find(e=>e.code===t)?.does??null}function Qt(t){if(t.startsWith("Key"))return t.slice(3);if(t.startsWith("Digit"))return t.slice(5);switch(t){case"ArrowUp":return"↑";case"ArrowDown":return"↓";case"ArrowLeft":return"←";case"ArrowRight":return"→";case"Escape":return"Esc";case"Space":return"Space";default:return t}}function oh(t){const e=aa;for(const a of fa){const o=vo[a],n=t[a];e[a]=n?[n,...o.slice(1).filter(s=>s!==n)]:o}}function XM(t){const e={};if(t===null||typeof t!="object")return e;const a=t,o=new Set;for(const n of fa){const s=a[n];typeof s!="string"||s.length===0||s.length>32||bm(s)||o.has(s)||fa.some(i=>i!==n&&vo[i].includes(s))||(o.add(s),e[n]=s)}return e}function ZM(t,e,a){const o=bm(e);if(o)return`${Qt(e)} already ${o}.`;for(const n of fa){if(n===t)continue;if((a[n]??vo[n][0])===e||vo[n].includes(e))return`${Qt(e)} is already ${Ln[n].toLowerCase()}.`}return null}function JM(){return fa.some(t=>aa[t][0]!==vo[t][0])}function N0(){return'<svg class="fa-ic fa-ic--note" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M10.4 17.2V5.4l8.2-1.9v11.7" fill="none" stroke-width="2"/><ellipse cx="7.6" cy="17.4" rx="3" ry="2.5" fill="#FFC93C"/><ellipse cx="15.8" cy="15.2" rx="3" ry="2.5" fill="#FFC93C"/></svg>'}function QM(t){ya("fa-settings-styles",eE),xa();const e=He("div","fa-screen fa-settings");let a=gm(),o=null;const n=()=>{const A=[],C=fa.flatMap(U=>aa[U].slice(1)).map(Qt);C.length>0&&A.push({action:"Move (fixed)",keys:C}),A.push({action:"Aim",keys:["Mouse"]}),A.push({action:"Fire",keys:["Click"]});const D=Math.min(ce[t.profile.selected].weapons.length,Rh);return D>1&&A.push({action:"Switch weapon",keys:Array.from({length:D},(U,te)=>String(te+1))}),A.push({action:"Mute / unmute",keys:[Qt(Ah)]}),A.push({action:"Pause",keys:[Qt(uc)]}),A},s=()=>`Aim, fire, mute and pause are fixed.${ce[t.profile.selected].weapons.length>1?"":` ${ce[t.profile.selected].name} carries one weapon, so there is no weapon-switch key while it is equipped.`} On a phone, twin sticks appear under your thumbs — the left half of the screen moves, the right half aims and fires — in landscape and in portrait alike.`,i=(A,C,D,U)=>`
    <div class="set-row">
      <span class="set-row-label">
        <span class="set-row-icon">${A}</span>
        <span class="set-row-text">
          <span class="set-row-title">${C}</span>
          ${D?`<span class="set-row-sub">${D}</span>`:""}
        </span>
      </span>
      <span class="set-row-control">${U}</span>
    </div>`,r=(A,C,D=!1)=>`<button class="set-toggle" type="button" role="switch" aria-checked="false"
       aria-label="${C}" data-toggle="${A}"${D?' data-clicksound="off"':""}><span class="set-knob"></span></button>`,l=(A,C)=>`<span class="set-slider">
       <input class="set-range" type="range" min="0" max="1" step="0.01"
              aria-label="${C}" data-range="${A}" />
       <span class="set-range-val" data-el="${A}val">100%</span>
     </span>`,h=A=>{const C=hr(A),D=A==="auto"?hr(Sg()):"";return`<button class="set-seg-btn" type="button" role="radio" aria-checked="false"
        aria-label="${D?`${C} (${D})`:C}"
        data-el="quality-${A}" data-quality="${A}">
        <span class="set-seg-name">${C}</span>
        ${D?`<span class="set-seg-auto">(${D})</span>`:""}
      </button>`};e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back">${_("back")} Back</button>
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
            <span class="set-row-icon">${_("avatar")}</span>
            <span class="set-row-text">
              <span class="set-row-title">Name</span>
              <span class="set-row-sub">On your lobby badge</span>
            </span>
          </span>
          <span class="set-row-control set-name-wrap">
            <input class="set-name" type="text" data-el="name" aria-label="Player name"
                   maxlength="${Dl}" autocomplete="off" autocapitalize="words"
                   spellcheck="false" enterkeyhint="done" />
            <span class="set-name-count" data-el="namecount"></span>
          </span>
        </div>
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Audio</p>
        <p class="set-locked" data-el="audiostate" hidden></p>
        ${i(_("sound"),"Sound effects","Hits, pickups, menu taps",l("sfx","Sound effects volume"))}
        ${i(_("mute"),"Mute everything","Same as pressing M in a match",r("mute","Mute everything",!0))}
        ${i(N0(),"Music","The menu and lobby theme",r("music","Music"))}
        ${i(N0(),"Music volume","Sits under the effects",l("music","Music volume"))}
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Graphics</p>
        <p class="set-locked" data-el="qualitypin" hidden></p>
        <div class="set-seg" role="radiogroup" aria-label="Graphics quality" data-el="qualityrow">
          ${Eg.map(A=>h(A)).join("")}
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
        ${i(_("speed"),"Reduce motion","Stops the menus pulsing and drifting",r("motion","Reduce motion"))}
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
      <button class="fa-btn fa-btn--primary set-done" type="button" data-el="done">${_("check")} Done</button>
    </footer>

    <div class="set-confirm" data-el="confirm" hidden>
      <div class="set-confirm-card" role="alertdialog" aria-modal="true" aria-label="Reset progress">
        <span class="set-confirm-icon">${_("cone")}</span>
        <p class="set-confirm-title">Reset everything?</p>
        <p class="set-confirm-sub" data-el="confirmsub"></p>
        <div class="set-confirm-btns">
          <button class="fa-btn fa-btn--quiet" type="button" data-el="cancel">Cancel</button>
          <button class="fa-btn set-reset" type="button" data-el="confirmyes">Yes, reset</button>
        </div>
      </div>
    </div>
  `;const c=A=>{const C=e.querySelector(`[data-el="${A}"]`);if(!C)throw new Error(`settings: missing element "${A}"`);return C},d=A=>e.querySelector(`[data-toggle="${A}"]`),p=A=>e.querySelector(`[data-range="${A}"]`),u=c("qualityrow"),m=A=>`${Math.round(A*100)}%`;function f(A,C){const D=d(A);D.setAttribute("aria-checked",C?"true":"false"),D.classList.toggle("is-on",C)}function g(){const A=Rg(),C=Ig();for(const te of u.querySelectorAll("[data-quality]")){const Z=te.dataset.quality===C;te.setAttribute("aria-checked",Z?"true":"false"),te.classList.toggle("is-on",Z),te.disabled=A!==null}const D=c("qualitypin");A?(D.textContent=`This session is pinned to ${hr(A)} by a ?tier= link in the address bar, so this control is switched off. Reload without it to choose.`,D.hidden=!1):D.hidden=!0;const U=Og();c("qualityblurb").textContent=C==="auto"&&!A?`Auto picked ${U.label} on this device. ${U.blurb}`:U.blurb}function w(){for(const A of fa){const C=c(`bind-${A}`),D=Qt(aa[A][0]),U=o===A;C.textContent=U?"…":D,C.classList.toggle("is-listening",U),C.setAttribute("aria-label",U?`${Ln[A]}: press the key you want, or Escape to keep ${D}`:`${Ln[A]}, currently ${D}. Press to change it.`)}c("bindreset").hidden=!JM(),c("keys").innerHTML=n().map(A=>`
      <div class="set-key-row">
        <span class="set-key-action">${A.action}</span>
        <span class="set-key-caps">${A.keys.map(C=>`<kbd class="set-cap">${C}</kbd>`).join("")}</span>
      </div>`).join(""),c("ctrlnote").textContent=s()}function b(A){c("bindnote").textContent=A??(o!==null?"Press any key. Escape keeps the one you have.":`Tap a key to change it. ${fa.map(C=>Qt(vo[C].slice(1)[0]??"")).filter(Boolean).join(" ")} always work as well, so movement can never be lost.`)}function y(A){c("namecount").textContent=`${A.length}/${Dl}`}function v(){const A=Se.isMuted(),C=Se.getState(),D=c("name");document.activeElement!==D&&(D.value=t.profile.name),y(D.value);const U=p("sfx");document.activeElement!==U&&(U.value=String(Se.getVolume())),U.style.setProperty("--p",m(Se.getVolume())),c("sfxval").textContent=m(Se.getVolume());const te=p("music");document.activeElement!==te&&(te.value=String(Se.music.getVolume())),te.style.setProperty("--p",m(Se.music.getVolume())),c("musicval").textContent=m(Se.music.getVolume()),f("mute",A),f("music",Se.music.isEnabled()),f("motion",a.reduceMotion),e.classList.toggle("is-muted",A);const Z=c("audiostate");C==="failed"?(Z.textContent="This browser blocked audio, so nothing here will make a sound.",Z.hidden=!1):C!=="running"?(Z.textContent="Sound switches on when you touch the screen — drag a slider to try it.",Z.hidden=!1):Z.hidden=!0}function k(A,C){const D=ZM(A,C,a.moveKeys);if(D){b(`${D} Pick another, or press Escape.`);return}const U={...a.moveKeys};U[A]=C,a={...a,moveKeys:U},wl(a),oh(a.moveKeys),R(),b(`${Ln[A]} is now ${Qt(C)}.`),w()}function E(){a={...a,moveKeys:{}},wl(a),oh(a.moveKeys),R(),b(`Movement is back to ${fa.map(A=>Qt(vo[A][0])).join(" ")}.`),w()}const x=A=>{if(o!==null){if(A.preventDefault(),A.stopPropagation(),A.key==="Escape"){const C=o;R(),b(`Left ${Ln[C].toLowerCase()} on ${Qt(aa[C][0])}.`),w();return}["Shift","Control","Alt","Meta","CapsLock"].includes(A.key)||A.code&&k(o,A.code)}};function M(A){if(o===A){R(),w(),b();return}o===null&&window.addEventListener("keydown",x,!0),o=A,w(),b()}function R(){o!==null&&(o=null,window.removeEventListener("keydown",x,!0))}const T=A=>{const C=A.target.closest("[data-quality]");if(C){Ag(C.dataset.quality),g();return}const D=A.target.closest("[data-bind]");if(D){M(D.dataset.bind);return}if(A.target.closest('[data-el="bindreset"]')){E();return}o!==null&&(R(),w(),b());const U=A.target.closest("[data-toggle]");if(U){switch(U.dataset.toggle){case"mute":Se.setMuted(!Se.isMuted()),Se.isMuted()||Se.previewClick();break;case"music":Se.music.setEnabled(!Se.music.isEnabled());break;case"motion":a={...a,reduceMotion:!a.reduceMotion},wl(a),wm();break}v()}};e.addEventListener("click",T);const N=A=>{const C=A.target;if(C.dataset.el==="name"){t.profile.setName(C.value),y(C.value);return}const D=Number(C.value);Number.isFinite(D)&&(C.dataset.range==="sfx"?(Se.setVolume(D),Se.previewClick()):C.dataset.range==="music"&&Se.music.setVolume(D),v())};e.addEventListener("input",N);const I=A=>{const C=A.target;C.dataset.el==="name"&&(C.value=t.profile.setName(C.value),y(C.value))};e.addEventListener("change",I);const F=A=>{const C=A.target;!C||C.dataset.el!=="name"||A.key!=="Enter"||(A.preventDefault(),C.blur())};e.addEventListener("keydown",F),c("back").addEventListener("click",()=>t.navigate({name:"home"})),c("done").addEventListener("click",()=>t.navigate({name:"home"}));const L=c("confirm");c("reset").addEventListener("click",()=>{const A=Ee.filter(C=>t.profile.characterLevel(C)>ko).length;c("confirmsub").textContent=`${t.profile.trophies.toLocaleString()} trophies, ${t.profile.coins.toLocaleString()} coins and ${t.profile.wins} wins will be deleted`+(A>0?`, along with ${A} upgraded fighter${A===1?"":"s"}.`:"."),L.hidden=!1}),c("cancel").addEventListener("click",()=>{L.hidden=!0}),c("confirmyes").addEventListener("click",()=>{try{const A=[];for(let C=0;C<localStorage.length;C++){const D=localStorage.key(C);D&&D.startsWith("food-arena.profile")&&A.push(D)}for(const C of A)localStorage.removeItem(C)}catch{}location.reload()});const H=e.querySelector(".set-body"),P=()=>{const A=H.scrollHeight-H.scrollTop-H.clientHeight>2;H.classList.toggle("is-more",A)};H.addEventListener("scroll",P,{passive:!0}),requestAnimationFrame(P);const j=Se.onChange(v),z=Se.music.onChange(v),Y=Tg(g);return v(),g(),w(),b(),{root:e,resize(){P()},dispose(){j(),z(),Y(),R(),H.removeEventListener("scroll",P),e.removeEventListener("click",T),e.removeEventListener("input",N),e.removeEventListener("change",I),e.removeEventListener("keydown",F),e.remove()}}}const eE=`
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
/* ── LANDSCAPE PHONE: at the NARROW end the two columns above never happen ───
   🚨 URI: "it seems like it was designed for vertical and not horizontal. its the same
   of all game menus." Settings is the clearest case in the build.

   The track above asks a minimum of 400px per column, so two of them plus the 6px gap
   need 806px of content box. Measured, not predicted (tools/tmp/lu_dbg2 reading the
   computed grid on the live screen):

     viewport    content box   tracks BEFORE          scroll height
     ─────────   ───────────   ────────────────────   ─────────────
     932x430     902px         446.09 + 446.09  (2)   869px
     844x390     817px         403.50 + 403.50  (2)   884px
     667x375     646px         641.66           (1)   1170px

   ⚠️ SO THE FIRST DRAFT OF THIS COMMENT WAS WRONG AND IS WORTH SAYING SO. It claimed
   844 was "a tie that the gap loses". It is not: 817 >= 806, two columns already, and
   this rule does not move a pixel there or at 932. The whole defect lives at 667x375,
   where auto-fit collapses to ONE column and the screen becomes a single full-width
   vertical list — 1170px of it inside a 263px window, four and a half screens of
   scrolling with the right two thirds of every row empty. That IS a portrait layout; it
   simply was not written as one.

   ⚠️ AND 400 IS NOT A NUMBER TO LOWER GLOBALLY. The rule above says why, from
   measurement: "as many as fit" at 1600 gave four 340px columns and squeezed
   'Sound effects' down to 'Sound ...'. So the smaller minimum is scoped to landscape
   AND short — a phone held sideways — and 300 is chosen to be the largest value that
   fixes 667 without ever admitting a THIRD column at any of the three:

     two at 667    2 x 300 +  6 =  606  <=  646   yes, tracks come out at 317.83
     three at 667  3 x 300 + 12 =  912  >   646   no
     three at 844  3 x 300 + 12 =  912  >   817   no
     three at 932  3 x 300 + 12 =  912  >   902   no   (the closest call, by 10px)

   AFTER: 667x375 goes to two 317.83px tracks and its scroll height falls 1170 -> 931,
   a 20.4% cut, with 844 and 932 byte-identical. Height is the scarce axis in landscape
   and width is the one already paid for; this spends the second to buy the first. */
@media (orientation: landscape) and (max-height: 500px) {
  .fa-settings .set-body {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }
}
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
`,L0=[{key:"damage",icon:"damage",label:"Damage",color:"#FF8A96"},{key:"health",icon:"health",label:"Health",color:"#8FE04A"},{key:"speed",icon:"speed",label:"Speed",color:"#6FC8F5"}],tE=new Set(["Neon","Cyber"]);function aE(t){return t===void 0?null:t>=ro.ultimateSlam?"Widest":t>ro.rangedLong?"Max range":t>ro.rangedMid?"Long":t>ro.rangedClose?"Mid":t>ro.meleeHeavy?"Short":"Melee"}function oE(t){const e=[];t.type==="self"&&t.healAmount?e.push(`${_("heal")} +${t.healAmount} HP`):t.comboParts?.length?e.push(`${_("damage")} ${t.comboParts.map(o=>o.damage).join(" + ")}`):t.pellets&&t.pellets>1?e.push(`${_("damage")} ${t.damage} × ${t.pellets}`):t.damage>0&&e.push(`${_("damage")} ${t.damage}`);const a=aE(t.range);return a&&e.push(`${_("range")} ${a}`),e.push(`${_("timer")} ${(t.cooldown/1e3).toFixed(1)}s`),t.effect&&e.push(t.effect==="stun"?`${_("stun")} Stun`:`${_("slow")} Slow`),e}function nE(t){const e=Ee.filter(a=>a!==t);return e[Math.floor(Math.random()*e.length)]}function sE(t){ya("fa-chars-styles",iE),xa();const e=He("div","fa-screen fa-chars"),a=yh();let o=t.profile.selected;e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${_("back")} Back</button>
      <h1 class="fa-title chars-heading">Choose Your Fighter</h1>
      <div class="fa-topbar-spacer"></div>
      <!-- ADOPTED: '.ds-chip' plus '.ds-chip-val' on the numerals. The chip's shape is
           unchanged; what moves is the RELATIONSHIP inside it — theme.ts's recorded
           finding is that on the reference plates the numeral is the loudest thing in a
           counter and ours were the same size as their own labels, "which is why a
           trophy total read as chrome". '.fa-chip' stays: 'chars_metrics' and
           'screen_metrics' both key on it. -->
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${_("medal")}</span>Wins <span class="fa-chip-val ds-chip-val ds-num" data-el="wins">0</span></div>
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${_("coin")}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="coins">0</span></div>
    </header>

    <div class="chars-body">
      <section class="chars-hero">
        <div class="chars-hero-3d" data-el="hero3d"></div>
        <div class="chars-hero-vignette"></div>
        <div class="chars-hero-plate">
          <span class="fa-title chars-hero-name" data-el="heroname"></span>
          <span class="fa-rarity" data-el="herorarity"></span>
        </div>
        <button class="chars-equip" type="button" data-el="select">${_("star")} Equip</button>
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
      <button class="fa-btn fa-btn--primary fa-btn--hero" type="button" data-el="fight">${_("play")} Fight!</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const n=M=>{const R=e.querySelector(`[data-el="${M}"]`);if(!R)throw new Error(`characterSelect: missing element "${M}"`);return R},s=n("roster"),i=n("stats"),r=n("abilities"),l=n("hero3d"),h=n("heroname"),c=n("herorarity"),d=n("select"),p=n("level"),u=n("confetti"),m=new Map;for(const M of Ee){const R=ce[M],T=He("button","chars-card");T.type="button",T.dataset.char=M,T.style.setProperty("--card-bg",ih[R.rarity]),T.style.setProperty("--rarity",St[R.rarity]),T.style.setProperty("--rarity-glow",bu(St[R.rarity],.75)),tE.has(R.rarity)&&T.classList.add("is-animated"),T.innerHTML=`
      <img class="chars-card-render" alt="" data-el="render" />
      <span class="chars-card-sheen"></span>
      <span class="chars-card-gloss"></span>
      <span class="chars-card-art">${_("avatar")}</span>
      <span class="chars-card-name">${R.name}</span>
      <span class="fa-rarity chars-card-rarity"
            style="background:${St[R.rarity]}">${R.rarity}</span>
      <span class="chars-card-playing">${_("star")}</span>
      <span class="chars-card-lv" data-el="lv"></span>
    `,T.addEventListener("click",()=>v(M,!0)),s.appendChild(T),m.set(M,T)}const f=(M,R)=>{const T=m.get(M),N=T?.querySelector('[data-el="render"]');N&&(N.src=R,T.classList.add("has-render"))};for(const M of Ee){const R=Mh(M);R&&f(M,R)}Su(f);const g=He("div","chars-card chars-card--locked");g.innerHTML=`
    <span class="chars-card-art">${_("lock")}</span>
    <span class="chars-card-name">More soon</span>
  `,s.appendChild(g);const w=new Map;for(const M of L0){const R=He("div","fa-stat ds-row ds-row--slate chars-stat");R.style.setProperty("--ds-row-accent",M.color),R.innerHTML=`
      <span class="ds-tile ds-tile--stat" style="--ds-tile-fill:${M.color}">${_(M.icon)}</span>
      <span class="ds-row-body">
        <span class="ds-row-label">${M.label}</span>
        <span class="ds-row-val ds-num"></span>
      </span>
    `,w.set(M.key,R.querySelector(".ds-row-val")),i.appendChild(R)}function b(){const M=o,R=t.profile.characterLevel(M),T=t.profile.nextLevelPrice(M),N=t.profile.canLevelUp(M),I=T===null,F=Al(M,Rl,R),L=xl(R),H=I?F:Al(M,Rl,R+1),P=I?L:xl(R+1),j=I?"":`
      <span class="chars-lv-gain"><span class="chars-lv-item">${_("health")} +${H-F}</span
        ><span class="chars-lv-item">${_("damage")} +${Math.round((P/L-1)*100)}%</span></span>`;p.innerHTML=`
      <div class="chars-lv-head">
        <span class="chars-lv-badge${I?" is-max":""}">Lv ${R}${I?"":` / ${vl}`}</span>
        <span class="chars-lv-now"><span class="chars-lv-item">${_("health")} ${F} HP</span
          ><span class="chars-lv-item">${_("damage")} x${L.toFixed(2)}</span></span>
      </div>
      ${j}
      <button class="ds-btn ds-btn--block chars-lv-btn" type="button" data-el="upgrade"${I||!N?" disabled":""}>${I?`${_("star")} Max level`:`${_("sparkle")} Upgrade <span class="chars-lv-price">${_("coin")} ${T.coins.toLocaleString()}</span>`}</button>
      ${I||N?"":`<span class="chars-lv-short">${(T.coins-t.profile.coins).toLocaleString()} more coins needed</span>`}
    `}function y(){const M=t.profile.selected;for(const[T,N]of m)N.classList.toggle("is-playing",T===M);const R=o===M;d.innerHTML=R?`${_("star")} Equipped`:`${_("star")} Equip`,d.classList.toggle("is-equipped",R),d.disabled=R}function v(M,R=!1){o=M;const T=ce[M];for(const[N,I]of m)I.classList.toggle("is-viewed",N===M);R&&m.get(M)?.scrollIntoView({block:"nearest"}),h.textContent=T.name,c.textContent=T.rarity,c.style.background=St[T.rarity];for(const N of L0)w.get(N.key).textContent=String(T.stats[N.key]);r.innerHTML="";for(const N of Cg(T)){const I=N.weapon,F=He("div","chars-ability");F.innerHTML=`
        <span class="chars-ability-em">${Au(N.emoji)}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">${N.name}</span>
          <span class="chars-ability-desc">${N.desc}</span>
          ${I?`<span class="chars-ability-facts">${oE(I).map(L=>`<span class="chars-fact">${L}</span>`).join("")}</span>`:""}
        </span>
      `,r.appendChild(F)}if(T.hasTrail){const N=He("div","chars-ability chars-ability--passive");N.innerHTML=`
        <span class="chars-ability-em">${_("honey")}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">Passive</span>
          <span class="chars-ability-desc">Leaves a damaging speed-boost trail while moving.</span>
        </span>
      `,r.appendChild(N)}r.scrollTop=0,a.show(M),y(),b()}n("back").addEventListener("click",()=>t.navigate({name:"home"})),d.addEventListener("click",()=>{t.profile.select(o),y(),ui(u,50,24),a.poke()}),n("fight").addEventListener("click",()=>{t.profile.select(o),t.navigate({name:"match",player:o,enemy:nE(o)})});function k(){for(const[M,R]of m){const T=t.profile.characterLevel(M),N=R.querySelector('[data-el="lv"]');N&&(N.textContent=T>1?`Lv ${T}`:"",R.classList.toggle("has-lv",T>1),R.classList.toggle("is-maxed",T>=vl))}}function E(){n("wins").textContent=String(t.profile.wins),n("coins").textContent=t.profile.coins.toLocaleString()}p.addEventListener("click",M=>{!M.target.closest('[data-el="upgrade"]')||!t.profile.levelUp(o)||(ui(u,34,18),a.poke())});const x=t.profile.onChange(()=>{E(),k(),b()});return E(),k(),v(o),a.attachTo(l),{root:e,update(M){a.update(M)},resize(){a.resize()},dispose(){x(),a.detach(),e.remove()}}}const iE=`
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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-3);
  overflow: hidden;
  box-shadow: var(--ds-e3);
  /* Seen only for the frame before WebGL first presents. Imported from 'charStage.ts'
     so the card and the renderer cannot disagree about the clear colour. */
  background: ${yu};
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
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t2);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e2);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-chars .chars-equip:hover { filter: brightness(1.05); }
.fa-chars .chars-equip:active { transform: translateY(3px); box-shadow: var(--ds-e0); }
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
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e1);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  letter-spacing: var(--ds-track);
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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e3);
  transition: transform 0.1s, box-shadow 0.1s, border-color 0.12s;
}
.fa-chars .chars-card:hover { transform: translateY(-3px); box-shadow: var(--ds-e4); }
.fa-chars .chars-card:active { transform: translateY(3px); box-shadow: var(--ds-e0); }
/* The card you are LOOKING at: gold frame, the same colour the HUD reserves for
   "this is the selected slot" on the weapon bar. One meaning, one colour. */
.fa-chars .chars-card.is-viewed {
  border-color: var(--gold);
  box-shadow: var(--ds-e3), 0 0 0 3px var(--gold), 0 0 16px var(--rarity-glow);
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
  font-weight: var(--ds-w-bold);
  /* Step 3 of the type ramp. Was 0.78rem max, which put card names, tab labels and
     currency values all within a couple of pixels of each other — a scale with no
     steps in it is not a hierarchy. */
  font-size: var(--ds-t3);
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
  box-shadow: var(--ds-e3), 0 0 14px var(--rarity-glow);
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
  border: var(--ds-stroke-1) solid rgba(26,18,36,0.22);
  border-radius: var(--ds-r-2);
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
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-pill);
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t2);
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
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t2);
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
/* ADOPTED '.ds-btn'. This was nineteen declarations re-deriving, by hand, the gold
   gradient, the ink line, the pill, the lip and the press travel that theme.ts's button
   already declares -- one of the eleven bespoke buttons its adoption map counts. What
   stays is the two things the component does not know: the weight (this control states a
   PRICE, so it runs at black rather than bold) and the disabled treatment below, which is
   a legibility decision rather than a state. */
.fa-chars .chars-lv-btn {
  font-weight: var(--ds-w-black);
  padding: 0 var(--ds-s4);
  letter-spacing: var(--ds-track-tight);
  text-transform: none;
}
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
  font-weight: var(--ds-w-body);
  font-size: var(--ds-t1);
  color: rgba(26,18,36,0.82);
}

/* The card badge. Hidden at level 1 — a badge on all eleven cards says nothing. */
.fa-chars .chars-card-lv {
  position: absolute;
  top: 3px;
  inset-inline-start: 3px;
  display: none;
  padding: 0 5px;
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-pill);
  background: var(--mustard);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t1);
  line-height: 1.5;
  color: var(--ink);
  z-index: 3;
}
.fa-chars .chars-card.has-lv .chars-card-lv { display: block; }
.fa-chars .chars-card.is-maxed .chars-card-lv { background: var(--lettuce); }
/* ── THE TALLER TRACK AND THE PIPS ARE DELETED, AND THAT IS THE MEASUREMENT ────
   WAS, verbatim, and kept per this project's rule about reversed assertions:

     "Taller bars, and the value is countable rather than estimated."
     .fa-chars .fa-stat-track { height: clamp(16px, 2.6vh, 24px); }
     .fa-chars .fa-stat-pips  { ... repeating-linear-gradient at 10% ... }
     .fa-chars .fa-stat-val   { width: auto; min-width: 18px; ... }

   These two rules were THE ONLY places character select overrides the shared chrome,
   and a per-element critique (6ebb6d1) measured what they bought: NOTHING. This screen's
   taller, pipped stat bar scored 3 against a reference 7 -- the identical number
   'home.ts''s plain bar scored. Two critics, two panels, one result. That is the finding
   that refutes "make the bar better" and is why 'theme.ts' built a ROW instead of a
   better BAR, and why both screens now draw one.

   '.fa-stat-val' goes with them for a second, independent reason: it carries
   'color: var(--ink)' here and 'rgba(26,18,36,0.7)' in theme.ts, and the row it would
   now sit in is a DARK slate plate. Reusing it to keep a class list tidy would have
   shipped dark ink on a dark ground -- 'docs/LESSONS.md' §1 case 10, for the third time
   in this repo. See '.chars-stat' below for what replaced all of it. */
.fa-chars .chars-abilities { display: flex; flex-direction: column; gap: 5px; min-height: 0; }

.fa-chars .chars-ability {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 8px;
  background: #FFFFFF;
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
}
.fa-chars .chars-ability--passive { background: #FFF0CF; }
.fa-chars .chars-ability-em { font-size: var(--ds-t6); line-height: 1.2; flex: 0 0 auto; }
.fa-chars .chars-ability-body { display: flex; flex-direction: column; min-width: 0; }
.fa-chars .chars-ability-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t3);
  line-height: 1.22;
}
.fa-chars .chars-ability-desc {
  font-size: var(--ds-t2);
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
  border-radius: var(--ds-r-pill);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  letter-spacing: var(--ds-track-tight);
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

  /* ── AND THE RING IS WHAT PAYS FOR DROPPING THE CHIP ─────────────────────────
     The comment above says the card BACKGROUND already says what the chip said, and
     that was true while the six fills were six unrelated hues. It stopped being true
     when they collapsed into one family (see 'RARITY_CARD_COLORS'): the fills now
     differ by VALUE and CHROMA inside one hue, and the minimum ADJACENT-tier dE on
     the graded on-card colours is 5.0 (Rare vs Epic) where it used to be 52.4.

     Side by side in a grid that still reads. Alone it is thin — and this is the ONE
     viewport with no second signal, because '.chars-card-rarity' is display:none
     exactly here. Neon and Cyber were already covered by '.is-animated' 's
     '--rarity-glow'; Normal, Rare, Epic and Legendary had nothing, and they are
     precisely the four tiers with the tightest dE.

     So the six-way distinction goes back to a 2px ring in 'RARITY_COLORS' — the
     still-six-hue palette, at a few hundred pixels instead of a full card. That is
     the "small number of accents" half of Uri's item 3 rather than a violation of it:
     hue carries rarity at ACCENT area, the fill stays in one family, and it costs
     ZERO layout height, which is the entire reason the chip was dropped at 86x74.

     🚨 THE RING GOES ON '.chars-card-gloss', NOT ON THE CARD, AND THAT COST A ROUND.
     The obvious form is 'inset 0 0 0 2px var(--rarity)' in the CARD's own box-shadow.
     It renders — and it is INVISIBLE, which is CLAUDE.md rule 4 for the nineteenth
     time. An inset box-shadow paints on the element's own background layer, and
     '.chars-card-render' is an absolutely-positioned full-bleed child at 'inset: 0',
     so the render covers the ring on every card that HAS a render. That is all eleven
     of them; it would have been visible only on the placeholder state nobody sees.
     A pixel diff said 221,455 subpixels had changed and a 6x crop showed the two
     frames identical inside the card border — the change was real and the ring was
     under the portrait. The gloss is the sibling AFTER the render in DOM order, also
     inset:0, also z-index auto, so it paints above it and is already the layer this
     card uses for things that must sit over the artwork. */
  .fa-chars .chars-card:not(.chars-card--locked) .chars-card-gloss {
    box-shadow: inset 0 0 0 2px var(--rarity, transparent);
  }

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
  /* ⚠️ DELETED, NOT MOVED: '.fa-chars .chars-stats { gap: 1px; }' stood here.
     'dc_guard' reported it as two CASCADE faults ('row-gap' and 'column-gap') because a
     media query adds NO SPECIFICITY: the '@media (max-height: 560px)' block below sets
     'gap: var(--ds-s1)' on the same selector and is written LATER, so at <=460 the later
     block wins and the delivered value is 3px against a declared 1px. The file already
     solved that trap once — the block at the foot of the 560 one is there on purpose,
     with its own measurement.

     🔴 SO THE REFLEX WAS TO MOVE THIS ONE BELOW TOO, AND THE REFLEX WAS WRONG, BECAUSE
     THE AXIS TURNED UNDER THE DECLARATION. The base rule is 'flex-direction: column',
     and 'gap: 1px' was authored FOR THAT COLUMN — the bill above it is entirely in
     VERTICAL pixels ("the notched landscape budget", "16.39px cut off the first ability
     row"). The 560 block turns this element into 'flex-direction: row', and <=460 is a
     strict subset of <=560, so at every viewport this declaration could ever apply to,
     the element is a ROW with 'flex-wrap: nowrap' and the surviving axis is HORIZONTAL.

     Measured on the live element ('tools/tmp/si_gap.mjs'), 3px -> 1px, at the three
     viewports where both queries are live:

         844x390    .chars-stats 163.23x48.17 -> 163.23x48.17   Δh 0.00
         852x393    .chars-stats 164.91x48.17 -> 164.91x48.17   Δh 0.00
         852x460    .chars-stats 164.91x48.17 -> 164.91x48.17   Δh 0.00
         detail overflow Δ 0 · first ability row's clearance Δ 0.00 at all three

     It buys **0.00px of the budget it was written to buy**, at every viewport. The only
     thing that moves is +1.32px of width per stat cell, and no '.ds-row-label' overflows
     in either arm (Damage/Health/Speed all 0 before and 0 after), so it does not even
     pay off the D2 truncation the 560 block already bought with '--ds-track-tight'.
     Re-ordering it would therefore ship a 1px horizontal gap that no author asked for.
     Deleted; the reasoning is kept here because the next reader will see 'dc_guard''s
     fault disappear and wonder which way it was fixed. */
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
  /* ── THE STAT BAND PAYS FOR ITSELF HERE, MEASURED IN DEVICE PIXELS ────────────
     The 30px compact cell measures 65.17px tall against the 48px the three bars used,
     and this panel has no slack at all on a NOTCHED landscape phone: 'ud_defects'
     reported the first ability row's BOX cut by 16.39px at 844x390+notch and 13.39px at
     852x393+notch -- D3, one of the four hard defects this file exists to keep fixed.
     The un-notched viewports passed; the notch takes 21px off the bottom and no media
     query can see it, so the un-notched case has to carry the slack (the note above says
     exactly this about the 460px bound).

     So the cell is rebuilt to the height budget rather than to the design: a 24px tile,
     the value one rung down at t3, and both text lines at line-height 1. That is 48.2px,
     which hands back the 16.4 and then some. It is NOT the 56px tile the audit called
     for -- but the property the audit measured as wrong was that our icon was a
     1.7px-stroke 'fill: none' OUTLINE at 16px of actual ink, and a 24px filled, tinted,
     ink-bordered tile is still a MASS. The full geometry runs at every viewport with the
     room for it, which is every viewport above 460px tall. */
}

/* ── THE STAT ROWS TURN THROUGH 90 DEGREES ON A SHORT SCREEN ──────────────────
   Identical to the rule 'home.ts' carries, for an identical reason and at a threshold
   this panel's own budget sets. The tall form is three 56px slate rows, ~180px; the
   itemised bill above records this panel at 281px total at 852x393, of which
   '.chars-level' alone is 119. Three tall rows would eat the abilities list whole, which
   is D3 -- the defect this file spent a pass measuring in device pixels.

   Laid out across, the same three facts cost about what the bars did. Nothing is
   dropped: the tinted tile, the colour-coded label and the display-weight numeral all
   survive; only the axis changes.

   ⚠️ 560 and not 460. 852x480 is above every other threshold in this file and is where
   'ud_defects' measured the tightest flank, so a 460 bound would leave the one viewport
   the audit used running the tall form. */
@media (max-height: 560px) {
  /* ⚠️ THE CARD NAME DROPS A RUNG, AND IT IS A REGRESSION FIX RATHER THAN A PREFERENCE.
     Ladder step 3 is right on a desktop card and WRONG on a ~96px one: t3 floors at
     0.82rem = 13.1px against the old clamp's 0.66rem = 10.6px, and the first two
     captures after the type pass rendered "Water Bot..." at BOTH 844x390 and 852x480 on
     cards that had shown "Water Bottle" the run before. Step 2 floors at 0.69rem =
     11.04px, over 'screen_metrics''s 11px legibility floor and back inside the card.
     ⚠️ The threshold is 560 and not 460 for exactly the reason the first fix missed:
     852x480 is above 460, so a 460 bound repaired the phone the suite watches and left
     the phone the AUDIT used still truncating. The portrait breakpoint at the foot of
     this file states the same rule for the same element — a ladder step sized off vh
     knows nothing about how wide the card is, and where the two disagree the CARD wins. */
  .fa-chars .chars-card-name { font-size: var(--ds-t2); }
  .fa-chars .chars-stats { flex-direction: row; gap: var(--ds-s1); }
  .fa-chars .chars-stat {
    flex: 1 1 0;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    min-height: 0;
    padding: var(--ds-s1) 0;
  }
  .fa-chars .chars-stat .ds-tile--stat {
    width: 30px;
    height: 30px;
    border-width: var(--ds-stroke-1);
    font-size: var(--ds-t6);
  }
  .fa-chars .chars-stat .ds-row-body { flex: 0 0 auto; align-items: center; text-align: center; }
  /* The caps tracking goes, and only the tracking: at 11px in a ~55px cell, 0.09em on
     "DAMAGE" is the difference between the word fitting and the component's own ellipsis
     firing, and a truncated label is the D2 defect this screen already fixed once. */
  .fa-chars .chars-stat .ds-row-label { letter-spacing: var(--ds-track-tight); }
  .fa-chars .chars-stat .ds-row-val { font-size: var(--ds-t4); }
}

/* ── AND THE NOTCHED LANDSCAPE PHONE PAYS FOR THE BAND OUT OF THE BAND ─────────
   🚨 THIS BLOCK IS BELOW THE 560px ONE ON PURPOSE, AND THE FIRST ATTEMPT WAS ABOVE IT.
   A MEDIA QUERY ADDS NO SPECIFICITY, so a '@media (max-height: 460px)' rule written
   earlier in the file loses to an identical selector inside '@media (max-height: 560px)'
   written later -- both match at 390px tall and the later one wins. Measured: the tile
   stayed 30px and the band came back 62.73px instead of the ~48 intended, i.e. the fix
   moved 2.44px of the 16.39 it was written to move. Second time this exact trap fired in
   this pass; the first was in 'home.ts'.

   The budget it is paying: 'ud_defects' measured the first ability row's BOX cut by
   16.39px at 844x390+notch and 13.39px at 852x393+notch after the stat band went in --
   D3, one of the four hard defects this file exists to keep fixed. The notch takes 21px
   off the bottom and NO media query can see it (the block above says so), so the
   un-notched case has to carry the slack.

   A 24px tile is not the 56px the audit called for, and that is a stated compromise
   rather than a miss: the property the audit measured as WRONG was that our icon was a
   1.7px-stroke 'fill: none' OUTLINE with 16px of actual ink, and a 24px filled, tinted,
   ink-bordered tile is still a MASS. The full 56px geometry runs at every viewport that
   has the room, which is every viewport above 560px tall. */
@media (max-height: 460px) {
  /* And 4px of headroom on top, because 0.61px is not a margin. With the band at 48.17
     the first ability row cleared its container by 0.61px at 844x390+notch -- a pass
     that the next font-metric change anywhere in the product would turn into a failure.
     The panel's own gap is the cheapest 4px in the bill and it deletes nothing: 1px
     instead of 2px across four gaps. Margin 0.61 -> ~4.6px. */
  .fa-chars .chars-detail { gap: 1px; }
  .fa-chars .chars-stat { padding: 0; }
  .fa-chars .chars-stat .ds-tile--stat { width: 24px; height: 24px; font-size: var(--ds-t4); }
  .fa-chars .chars-stat .ds-row-label { line-height: 1; }
  .fa-chars .chars-stat .ds-row-val { font-size: var(--ds-t3); line-height: 1; }
}

@media (max-width: 700px) {
  .fa-chars .chars-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(90px, 0.9fr) minmax(0, 1.1fr) auto;
  }
  .fa-chars .chars-detail { max-height: 34vh; }
  .fa-chars .chars-heading { display: none; }
  /* ── THE STAT BAND GOES ACROSS HERE TOO, AND 'chars_metrics' IS WHAT SAID SO ──
     Portrait caps this panel at 34vh = 317px, and the tall '.ds-row' form is three 56px
     slabs plus gaps = ~180px of it. With the level block at ~100 and two section titles
     at 15 each there is nothing left, so the panel OVERFLOWED and the "Abilities" title
     was drawn on the shell's red backdrop: 'chars_metrics' measured it at 2.95:1 against
     a 4.5 floor -- 'rgba(26,18,36,0.8) on rgb(202,52,45)@27%', which is the page
     background, not a panel. A contrast battery reported it, and what it was actually
     detecting was a LAYOUT overflow. (LESSONS §6b: an acceptance test proves you moved
     the thing you named, not that it was the thing.)
     Across, the band is ~65px and the panel fits. There is far more WIDTH here than on a
     landscape phone, so the tile keeps its 30px rather than dropping to the notched
     phone's 24. */
  .fa-chars .chars-stats { flex-direction: row; gap: var(--ds-s1); }
  .fa-chars .chars-stat {
    flex: 1 1 0;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    min-height: 0;
    padding: var(--ds-s1) 0;
  }
  .fa-chars .chars-stat .ds-tile--stat {
    width: 30px;
    height: 30px;
    border-width: var(--ds-stroke-1);
    font-size: var(--ds-t6);
  }
  .fa-chars .chars-stat .ds-row-body { flex: 0 0 auto; align-items: center; text-align: center; }
  .fa-chars .chars-stat .ds-row-val { font-size: var(--ds-t4); }
  /* Step 3 of the type ramp is sized off vh, and in portrait there is a lot of vh and
     very little card: 1.85vh of 932 is 16.3px inside an 84px tile, which ellipsised
     "Hamburger" to "Hambu...". Sizing it off the card instead of off the viewport is
     not something CSS can express, so the ramp step is simply shorter here — 12.1px,
     still over the 11px floor and still a step above the rarity chip below it. */
  .fa-chars .chars-card-name { font-size: var(--ds-t2); }
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
`,D0=["Normal","Rare","Epic","Legendary","Neon","Cyber"],rE=(()=>{const t=ba.map(a=>{const o=qn(a).filter(r=>r.rarity);let n=null,s=-1,i=0;for(const r of o)i+=r.percent,r.percent>s&&(s=r.percent,n=r.rarity??null);return{kind:a,floor:n,charShare:i}});t.sort((a,o)=>{const n=a.floor?D0.indexOf(a.floor):-1,s=o.floor?D0.indexOf(o.floor):-1;return n-s||a.charShare-o.charShare});const e={};return t.forEach((a,o)=>{e[a.kind]={rank:o+1,of:t.length,floor:a.floor}}),e})();function bl(t,e={}){const a=rE[t];if(!a)return"";const o=a.floor?St[a.floor]:"var(--ink)",n=Array.from({length:a.of},(i,r)=>`<i class="tr-pip${r<a.rank?" is-on":""}"></i>`).join(""),s=`Tier ${a.rank} of ${a.of}${a.floor?`, ${a.floor} or rarer`:""}`;return`<span class="tr-tier" style="--pip:${o}" role="img" aria-label="${s}">${n}${e.label&&a.floor?`<span class="tr-tier-txt">${a.floor}+</span>`:""}</span>`}function lE(t){ya("fa-trophy-styles",hE),xa();const e=He("div","fa-screen fa-tr"),a=t.profile;e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${_("back")} Back</button>
      <h1 class="fa-title tr-heading">Trophy Road</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${_("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${_("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="tr-body">
      <section class="tr-hero">
        <div class="tr-hero-count">
          <span class="tr-hero-em">${_("trophy")}</span>
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
        <button class="fa-btn fa-btn--green tr-claimall" type="button" data-el="claimall">${_("sparkle")} Claim</button>
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
        <button class="fa-iconbtn tr-odds" type="button" data-el="oddsbtn">${_("chest")} Drop rates</button>
        <button class="fa-btn fa-btn--quiet tr-storebtn" type="button" data-el="storebtn">${_("gem")} Get Gems</button>
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
  `;const o=I=>{const F=e.querySelector(`[data-el="${I}"]`);if(!F)throw new Error(`trophyRoad: missing element "${I}"`);return F},n=o("road"),s=o("inventory"),i=o("sheet"),r=o("sheetcard"),l=o("confetti"),h=o("claimall"),c=o("delta");function d(I=!1){const F=a.trophies;a.unlocked;const L=new Set(a.economy.claimed);n.innerHTML="";const H=He("div","tr-roadtrack"),P=He("div","tr-spine"),j=He("div","tr-spine-fill");P.appendChild(j),H.appendChild(P);let z=!1;const Y=()=>{const C=He("div","tr-pin");C.dataset.el="pin",C.innerHTML=`
        <span class="tr-pin-dot">${_("pin")}</span>
        <span class="tr-pin-label">${F.toLocaleString()}</span>
      `,H.appendChild(C),z=!0};let A=0;for(const C of ew()){!z&&F<C.trophies&&Y();const D=m(C,F,L.has(C.trophies));D.classList.add(A%2===0?"is-high":"is-low"),H.appendChild(D),A++}z||Y(),n.appendChild(H),Xo(H),p(),I&&u()}function p(){const I=n.querySelector(".tr-roadtrack"),F=n.querySelector(".tr-spine"),L=n.querySelector(".tr-spine-fill"),H=n.querySelector('[data-el="pin"]');if(!I||!F||!L||!H)return;L.style.width=`${Math.max(0,H.offsetLeft+H.offsetWidth/2)}px`;const P=F.getBoundingClientRect();if(P.height===0)return;const j=P.top+P.height/2;for(const z of I.querySelectorAll(".tr-node")){const Y=z.getBoundingClientRect(),A=z.classList.contains("is-high")?j-Y.bottom:Y.top-j;z.style.setProperty("--stem",`${Math.max(0,Math.round(A))}px`)}}function u(){const I=n.querySelector('[data-el="pin"]');!I||n.clientWidth===0||(n.scrollLeft=Math.max(0,I.offsetLeft-n.clientWidth/2+I.offsetWidth/2))}function m(I,F,L,H){const P=Fl(I.reward),z=F>=I.trophies&&!L,Y=z?He("button","tr-node is-claimable"):He("div","tr-node");if(z&&(Y.type="button"),L&&Y.classList.add("is-claimed"),P.isCharacter&&Y.classList.add("is-character"),Y.dataset.trophies=String(I.trophies),I.reward.type==="character"){const C=St[ce[I.reward.id].rarity];Y.style.setProperty("--node-accent",C),Y.style.setProperty("--node-glow",bu(C,.55))}const A=L?`<span class="tr-status is-done">${_("check")} Claimed</span>`:z?'<span class="tr-status is-ready">Claim</span>':`<span class="tr-status">${(I.trophies-F).toLocaleString()} to go</span>`;return Y.innerHTML=`
      <span class="tr-node-req">${_("trophy")} ${I.trophies.toLocaleString()}</span>
      <span class="tr-node-medal"><span class="tr-node-em">${I.reward.type==="character"?Ha(I.reward.id,{crop:"head"}):I.reward.type==="container"?_t(I.reward.kind):Ca(P.emoji)}</span>${L?`<span class="tr-node-tick">${_("check")}</span>`:""}</span>
      <span class="tr-node-title">${P.title}</span>
      ${I.reward.type==="container"?bl(I.reward.kind):""}
      ${P.payoutNote?`<span class="tr-node-note">${P.payoutNote.replace("🪙",_("coin"))}</span>`:""}
      ${A}
    `,Y}function f(){o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString(),o("trophies").textContent=a.trophies.toLocaleString();const I=iu(a.trophies),F=o("fill");F.style.width=`${(I.progress01*100).toFixed(1)}%`;const L=a.claimable.length;if(L>0)o("nextlabel").textContent="Ready now",o("nextval").innerHTML=L>1?`${_("sparkle")} ${L} road rewards to claim`:`${_("sparkle")} 1 road reward — tap it on the track`;else if(I.next){const H=I.next.reward,P=Fl(H,a.unlocked),j=I.next.trophies-a.trophies;o("nextlabel").textContent="Next reward",o("nextval").innerHTML=`${H.type==="character"?Ha(H.id,{crop:"head"}):H.type==="container"?_t(H.kind):Ca(P.emoji)} ${P.title} <span class="tr-togo">${_("trophy")} ${j.toLocaleString()} to go</span>`}else o("nextlabel").textContent="Road complete",o("nextval").innerHTML=`${_("flag")} Master of the Kitchen`;o("fillxp").textContent=I.next?`${(a.trophies-I.from).toLocaleString()} / ${(I.to-I.from).toLocaleString()}`:`Road complete — ${Cl().toLocaleString()}`,h.style.display=L>1?"":"none",h.innerHTML=`${_("sparkle")} Claim ${L}`,g()}function g(){s.innerHTML="";const I=ba.filter(F=>(a.containers[F]??0)>0);if(I.length===0){const F=a.winsToNextChest,L=He("p","tr-inv-empty");L.innerHTML=`${_("chest")} <strong>${F}</strong> more ${F===1?"win":"wins"} for a free Chest`,s.appendChild(L);return}for(const F of I){const L=Be[F],H=a.containers[F]??0,P=He("button","tr-open");P.type="button",P.dataset.open=F,P.innerHTML=`
        <span class="tr-open-em">${_t(F)}</span>
        <span class="tr-open-body">
          <span class="tr-open-name">${L.name}</span>
          <span class="tr-open-cta">Open ${bl(F)}</span>
        </span>
        <span class="tr-open-count">${H}</span>
      `,s.appendChild(P)}}function w(I,F="wide"){r.innerHTML=I,r.classList.toggle("is-reveal",F==="reveal"),i.classList.add("is-open")}function b(){i.classList.remove("is-open"),r.innerHTML=""}function y(I){const F=[];for(const L of I.characters)F.push(Ha(L,{crop:"head"}));for(const[L,H]of Object.entries(I.containers))H&&F.push(_t(L));return I.coins>0&&F.push(_("coin")),I.gems>0&&F.push(_("gem")),F}function v(I,F){const L=Yg(I);if(L.length===0)return;const H=y(I),[P,...j]=L;w(`
      <div class="tr-reveal">
        <div class="tr-reveal-em">${H[0]??Ca(P.emoji)}</div>
        <p class="tr-reveal-kicker">${F}</p>
        <p class="tr-reveal-name">${P.label}</p>
        ${j.length>0?`<div class="tr-reveal-more">${j.map((z,Y)=>`<span class="tr-reveal-chip">${H[Y+1]??Ca(z.emoji)} ${z.label}</span>`).join("")}</div>`:""}
        <button class="fa-btn fa-btn--primary tr-sheet-close" type="button" data-el="close">Nice!</button>
      </div>
    `,"reveal"),Xo(r),ui(l,50,28)}function k(){const I=ba.map(F=>{const L=Be[F],H=qn(F).map(j=>`
        <li class="tr-odds-row">
          <span class="tr-odds-what">${j.rarity?`<i class="tr-odds-dot" style="background:${St[j.rarity]}"></i>`:""}${j.label}</span>
          <span class="tr-odds-pct">${Ks(j.percent)}</span>
        </li>
      `).join(""),P=qn(F).filter(j=>j.pool&&j.pool.length>0).map(j=>`${j.rarity}: ${j.pool.map(z=>ce[z].name).join(", ")}`).join(" · ");return`
        <section class="tr-odds-block">
          <h3 class="tr-odds-title">${_t(F)} ${L.name} ${bl(F,{label:!0})}</h3>
          <p class="tr-odds-blurb">${L.blurb}</p>
          <ul class="tr-odds-list">${H}</ul>
          ${P?`<p class="tr-odds-pool">${P}</p>`:""}
        </section>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">Drop rates</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${_("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-sheet-note">Every percentage below is read directly from the reward
        tables the game rolls against.</p>
        <p class="tr-sheet-note tr-sheet-note--rarity">${J0}</p>
        ${I}
      </div>
    `)}function E(){const I=iw().map(F=>{const L=lw(F),H=[];return F.coins&&H.push(`${_("coin")} ${F.coins.toLocaleString()}`),F.container&&H.push(`${_t(F.container.kind)} ${Be[F.container.kind].name}`),`
        <div class="tr-sku${F.oneTime?" is-featured":""}">
          ${L>0||F.oneTime?`<span class="tr-sku-flags">
            ${L>0?`<span class="tr-sku-bonus">+${L}%</span>`:""}
            ${F.oneTime?'<span class="tr-sku-bonus tr-sku-once">ONE TIME</span>':""}
          </span>`:""}
          <span class="tr-sku-em">${F.container?_t(F.container.kind):Ca(F.emoji)}</span>
          <span class="tr-sku-name">${F.name}</span>
          <span class="tr-sku-gems">${_("gem")} ${F.gems.toLocaleString()}</span>
          ${H.length>0?`<span class="tr-sku-extra">+ ${H.join(" + ")}</span>`:""}
          <button class="tr-sku-buy" type="button" disabled>${`${rw(F.priceUsdCents)} · Soon`}</button>
        </div>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">${_("gem")} Gem Store</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${_("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-soon">${_("cone")} Purchases are not available yet — nothing here can be bought.
        Every gem in the game is earned on the Trophy Road and out of chests.</p>
        <div class="tr-skus">${I}</div>
      </div>
    `)}o("back").addEventListener("click",()=>t.navigate({name:"home"})),o("oddsbtn").addEventListener("click",k),o("storebtn").addEventListener("click",E),o("scrim").addEventListener("click",b),h.addEventListener("click",()=>{const I=a.claimAllMilestones();v(I,"You earned")});const x=I=>{const F=I.target;if(F.closest('[data-el="close"]')){b();return}const L=F.closest(".tr-node.is-claimable");if(L){const P=Number(L.dataset.trophies),j=a.claimMilestone(P);j&&v(j,"You earned");return}const H=F.closest("[data-open]");if(H){const P=H.dataset.open,j=a.openContainer(P);j&&v(j.reward,j.duplicateOf?`${ce[j.duplicateOf].name} again — traded in`:`From a ${Be[P].name}`)}};e.addEventListener("click",x);const M=I=>{I.key==="Escape"&&i.classList.contains("is-open")&&b()};window.addEventListener("keydown",M);const R=a.onChange(()=>{f(),d()});f(),d();let T=!1;requestAnimationFrame(()=>{T||(p(),u())});const N=a.lastMatch;if(N&&!N.seen){const I=N.trophies>0?"+":"";c.innerHTML=`${I}${N.trophies} ${_("trophy")}`,c.className=`tr-delta is-on ${N.trophies>0?"is-up":N.trophies<0?"is-down":"is-flat"}`,a.markLastMatchSeen()}return{root:e,resize(){d(),u()},dispose(){T=!0,R(),e.removeEventListener("click",x),window.removeEventListener("keydown",M),e.remove()}}}const hE=`
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
   A single-row node strip pinned to the top of a 640px cream slab is the same defect two
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

/* ── THE ORANGE PLATE IS SPENT. This is the move the size pass named and deferred ──
   The block further down ('WHAT THE SPACE WAS TAKEN FROM') closes with:

     "the plate is still available and giving this hint the same cream pill '.tr-open'
      already uses is the cheap move."

   It has now been measured twice by an icon pass and it is not optional. Every fill
   this glyph draws with, against its own backdrop:

     on the saturated orange   1.80 · 1.18 · 1.81 · 2.45      (the ink outline 4.82)
     on this cream pill        5.77 · 3.79 · 1.77 · 1.31 · 15.48

   NOT ONE FILL CLEARED 2:1 ON THE ORANGE. The '-webkit-text-stroke: 2px' that used to
   be here existed only to rescue legibility on that plate — an ink box drawn around
   every letterform because the letterform itself could not be seen. On a cream pill it
   is unnecessary, so it goes with the plate rather than being left behind as a habit.

   🚨 AND THERE IS A RECORD TO CORRECT. An earlier pass's commit message ('620bf7f')
   CLAIMED this hint had already moved to the cream chip. It never landed. A later round
   was then judged against a spec that recorded the chip while the game shipped the
   orange — i.e. there is a measurement on file for a plate that did not exist. Landing
   it is what makes that record true, which is why this is a fix and not a preference.

   The plate is '.tr-open''s, character for character, because these two are the same
   row in the same bar and the empty state should be the full state minus its contents.
   'strong' takes '--ketchup-ink' rather than '--mustard' for the reason stated on
   '.tr-open-cta' twenty lines below: on THIS gradient '--ketchup' measures 4.17:1 and
   '--ketchup-ink' 5.9:1 — mustard on cream is nearer 1.3 and was never a candidate once
   the backdrop changed. '--fa-ic-ink' is set for the same reason the active tab sets it:
   the chest glyph inherits its ink from that token, and a token left on cream would put
   a cream chest on a cream pill.

   ⚠️ This is a fix routed in from an icon pass that could not reach this file. It is
   local to '.tr-inv-empty': no shared token moves, so the blast radius is this rule. */
.fa-tr .tr-inv-empty {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-height: var(--tap);
  padding: 0 12px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.69rem, 1.5vh, 0.82rem);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  color: var(--ink);
  --fa-ic-ink: var(--ink);
  white-space: nowrap;
}
.fa-tr .tr-inv-empty strong { color: var(--ketchup-ink); }

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

/* ── THE GLYPH IS UNCOUPLED FROM ITS LABEL'S FONT-SIZE AT FOUR SITES ──────────
   🔴 'chest' AND 'boxBurger' WERE A DELIVERED-SIZE DEFECT, AND THIS FILE OWNS THE SIZE.

   Both glyphs carry the identical signature across every blind round ever run:
   **0 of 3 native on every arm ever drawn, 3 of 3 magnified.** Six drawing variables
   moved 'boxBurger' by Δ +0 each ('13fb98c', 'a77ff30'); both of 'chest''s in-file
   variables are spent — ink budget Δ +0/+0 and a plate-value move Δ +0 native and −2
   MAGNIFIED ('7f71f20'). Two glyphs failing the same way at 11.0–11.8 px and passing at
   magnification is a size result, not a drawing one, and every icon here is
   'width: 1em' on an '<svg>', so its size is whatever its LABEL's font-size happens to
   be. That is the whole bug: a 24-unit drawing with five stacked outlined shapes was
   being asked to survive at the size of the 11px caption beside it.

   'characterSelect.ts:1047' had already reached the same conclusion from the other end
   and shipped this exact mechanism — *"the glyph runs a little larger than its own text.
   11px was measured to be below the floor for any mark with internal structure."*

   ── WHERE 16 px COMES FROM. It is measured, and it is a POPULATION, not a promise ──
   Pooled over the two most recent native panels (r8 seed 13 + r9 seed 21, shipped arms
   only, 3 blind judges each), joined to 'shots/ic/spec.json''s delivered px:

       < 12 px   16 icons   59.8 %          14 – 17 px    4 icons   95.8 %
      12 – 14    11 icons   72.7 %          17 – 21       4 icons   96.7 %

   ⚠️ Bigger sites may host simpler glyphs, so this is a trend and not a controlled
   experiment; it is read as "aim for >=16 px", never as "16 px guarantees a read". The
   controlled half is the paired plate, which is what actually decided this change.

   ── WHAT THE SPACE WAS TAKEN FROM, MEASURED ('tools/tmp/si_fit.mjs') ─────────
   Delivered px at 844x390 / 1280x800 / 390x844, and the cost of each:

     .tr-odds         11.03 -> 16.55   11.19 -> 16.80   11.81 -> 17.72   FREE
                      the button is 'height: var(--tap)', so this costs zero height and
                      a few px of width in a bottom bar whose inventory row scrolls.
     .tr-inv-empty    11.03 -> 16.55   12.00 -> 18.00   12.66 -> 18.98
                      line box 13 -> 17.08. '.tr-bottom' is 'min-height: var(--tap)' and
                      absorbs it whole in landscape (44 -> 44); in PORTRAIT the bar
                      stacks and grows 67 -> 71.14, which comes out of '.tr-body', i.e.
                      out of the road panel, which is a scroller.
     .tr-nextval      11.52 -> 16.70   13.59 -> 19.72   14.34 -> 20.80
                      the only site with a real bill: '.tr-nextline' 14 -> 17.2 grows
                      '.tr-hero' 51 -> 54.2, and the hero takes its height out of the
                      road below it — '.tr-road''s vertical overflow goes 7px -> 10px at
                      844x390. It was ALREADY a scroller in both axes (2731px across).
     .tr-odds-title   11.83 -> 17.16   14.39 -> 20.88   15.03 -> 21.80
                      five titles in the drop-rates sheet; '.tr-sheet-scroll' goes
                      609 -> 625 / 232 -> 251 / 367 -> 401 px of scroll. Already a
                      scroller by construction.

   🔴 NOTHING WAS TAKEN FROM ANY TEXT. 'scrollWidth - clientWidth' on '.tr-nextval',
   '.tr-inv-empty', '.tr-odds' and '.tr-odds-title' is **0 before and 0 after at all
   three viewports** — not one run ellipsised — and no icon left its clipping ancestor.

   ⚠️ AND THE PLATE WAS THE OTHER CANDIDATE VARIABLE AND IS NOT SPENT. '.tr-inv-empty'
   is the only glyph in the game on a saturated orange plate, and every fill this glyph
   uses fails 2:1 against it (wood 1.88, woodHi 1.24, gold 1.73; the ink outline is
   5.05). That was NOT changed here: at 16.55 px the domed lid, the gold band and the
   clasp resolve on the orange anyway — read in 'shots/si/fit1/crop-inv-after.png' — so
   the size alone answered it. If a later round needs more, the plate is still available
   and giving this hint the same cream pill '.tr-open' already uses is the cheap move.

   🔵 THE PLATE IS NOW SPENT — a later round did need more. See the block on
   '.tr-inv-empty' above: the orange went, the cream pill landed, and the
   '-webkit-text-stroke' that was propping it up went with it. This paragraph is kept
   because it is the one that correctly identified the remaining variable and named the
   exact remedy; the only thing it got wrong was expecting not to need it.

   ⚠️ '.fa-ic-portrait' is listed with '.fa-ic' on '.tr-nextval' on purpose: when the
   next reward is a CHARACTER that slot renders a portrait, and scaling only one of the
   two would make the same slot two different sizes depending on what is next. */
.fa-tr .tr-odds .fa-ic { font-size: 1.5em; }
.fa-tr .tr-inv-empty .fa-ic { font-size: 1.5em; }
.fa-tr .tr-nextval .fa-ic,
.fa-tr .tr-nextval .fa-ic-portrait { font-size: 1.45em; }
.fa-tr .tr-odds-title .fa-ic { font-size: 1.45em; }

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
`,Ws=Object.keys(jt).sort((t,e)=>jt[t]-jt[e]);function cE(t,e,a){const o=Be[t].entries,n=$i(o);return o.map(s=>{let i=s.coins??0;const r=s.gems??0;let l=null;s.characterRarity&&((Pi[s.characterRarity]??[]).some(d=>!e.has(d))?l=s.characterRarity:i+=jt[s.characterRarity]);let h=null;return s.itemRarity&&((sn[s.itemRarity]??[]).some(d=>!a.has(d))?h=s.itemRarity:i+=Un[s.itemRarity]),{chance01:n>0?s.weight/n:0,coins:i,gems:r,fighter:l,item:h}})}function dE(t){return[...new Set(Be[t].entries.flatMap(e=>e.itemRarity?sn[e.itemRarity]??[]:[]))]}function ym(t,e,a){const o=cE(t,e,a),n=dE(t),s={canGrantFighter:!1,canGrantItem:!1,bestCoins:0,bestGems:0,expectedCoins:0,expectedGems:0,characterPercent:0,itemPercent:0,floorRarity:null,itemFloorRarity:null,missingItems:n.filter(r=>!a.has(r)).length,poolItems:n.length};for(const r of o)r.fighter&&(s.canGrantFighter=!0),r.item&&(s.canGrantItem=!0),s.bestCoins=Math.max(s.bestCoins,r.coins),s.bestGems=Math.max(s.bestGems,r.gems),s.expectedCoins+=r.chance01*r.coins,s.expectedGems+=r.chance01*r.gems;const i=$i(Be[t].entries);for(const r of Be[t].entries){const l=i>0?r.weight/i*100:0;if(r.characterRarity){s.characterPercent+=l;const h=Ws.indexOf(r.characterRarity),c=s.floorRarity===null?1/0:Ws.indexOf(s.floorRarity);h<c&&(s.floorRarity=r.characterRarity)}if(r.itemRarity){s.itemPercent+=l;const h=Ws.indexOf(r.itemRarity),c=s.itemFloorRarity===null?1/0:Ws.indexOf(s.itemFloorRarity);h<c&&(s.itemFloorRarity=r.itemRarity)}}return s}function Lo(t,e,a,o){const n=Be[t].price;if(!n)return!1;const s=ym(t,a,o);return s.canGrantFighter?!0:e==="coins"?s.bestCoins>n.coins:s.bestGems>n.gems}const pE=ba.filter(t=>Be[t].price!==null);function uE(t){ya("fa-shop-styles",fE),xa();const e=He("div","fa-screen fa-shop"),a=t.profile;e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${_("back")} Back</button>
      <h1 class="fa-title shop-heading">Shop</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${_("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${_("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="fa-panel fa-panel--flush shop-body">
      <div class="fa-scroll shop-scroll" data-el="scroll"></div>
    </div>

    <footer class="shop-bottom">
      <p class="shop-foot-note" data-el="footnote"></p>
      <div class="shop-foot-actions">
        <button class="fa-btn fa-btn--quiet" type="button" data-go="trophies">${_("trophy")} Trophy Road</button>
        <button class="fa-btn fa-btn--green" type="button" data-go="characters">${_("play")} Play a match</button>
      </div>
    </footer>
  `;const o=u=>{const m=e.querySelector(`[data-el="${u}"]`);if(!m)throw new Error(`shop: missing element "${u}"`);return m},n=o("scroll");function s(u){return`<ul class="shop-odds">${qn(u).map(f=>`
      <li class="shop-odds-row">
        <span class="shop-odds-what">${f.rarity?`<i class="shop-odds-dot" style="background:${St[f.rarity]}"></i>`:""}${f.label}</span>
        <span class="shop-odds-pct">${Ks(f.percent)}</span>
      </li>`).join("")}</ul>`}function i(u){const m=qn(u).filter(f=>f.rarity&&(f.pool&&f.pool.length>0||f.itemPool&&f.itemPool.length>0)).map(f=>`<span class="shop-pool-line"><i class="shop-odds-dot" style="background:${St[f.rarity]}"></i>${(f.pool??[]).map(g=>ce[g].name).concat((f.itemPool??[]).map(g=>Ce[g].name)).join(", ")}</span>`).join("");return m?`<div class="shop-pool">${m}</div>`:""}function r(u,m,f){const g=Be[u],w=g.price,b=ym(u,m,f),y=b.canGrantFighter&&b.characterPercent>=99.999&&b.floorRarity?`<span class="shop-guarantee"><i class="shop-odds-dot" style="background:${St[b.floorRarity]}"></i>Always a fighter, ${b.floorRarity} or rarer</span>`:"",v=b.canGrantItem&&b.itemFloorRarity?`<span class="shop-guarantee shop-guarantee--item"><i class="shop-odds-dot" style="background:${St[b.itemFloorRarity]}"></i>${Ks(b.itemPercent)} loadout item, ${b.itemFloorRarity} or rarer</span>`:"",k=x=>{const M=x==="coins"?w.coins:w.gems,R=x==="coins"?a.coins:a.gems,T=_(x==="coins"?"coin":"gem"),N=Lo(u,x,m,f),I=R>=M,F=N&&I,L=N?`You need ${(M-R).toLocaleString()} more ${x}`:"Not for sale right now";return`
        <button class="shop-buy shop-buy--${x}${F?"":" is-off"}" type="button"
          data-buy="${u}" data-currency="${x}"${F?"":` disabled title="${L}" aria-label="${M.toLocaleString()} ${x}. ${L}."`}>
          ${T} ${M.toLocaleString()}
        </button>`};let E="";if(!Lo(u,"coins",m,f)&&!Lo(u,"gems",m,f)){const x=b.bestGems===0,M=b.bestCoins<w.coins?`It pays back at most ${b.bestCoins.toLocaleString()} coins for a ${w.coins.toLocaleString()} coin price, and ${Math.round(b.expectedCoins).toLocaleString()} on average.`:`Its average return is ${Math.round(b.expectedCoins).toLocaleString()} coins against a ${w.coins.toLocaleString()} coin price.`,R=b.missingItems;E=`
        <p class="shop-why">
          <span class="shop-why-head">Not for sale</span>
          Every fighter here is already unlocked, so a fighter roll only pays
          ${x?"coins":"currency"} back. ${M}
          ${R>0?`Its ${R} unowned loadout item${R===1?"":"s"} come from
            Chests and the Trophy Road.`:"You own every loadout item in it too."}
        </p>`}else if(!(a.coins>=w.coins)&&!(a.gems>=w.gems))E=`
        <p class="shop-why">
          <span class="shop-why-head">Keep playing</span>
          You need ${(w.coins-a.coins).toLocaleString()} more coins
          or ${(w.gems-a.gems).toLocaleString()} more gems for this one.
        </p>`;else{const x=[...new Set(Be[u].entries.flatMap(T=>T.characterRarity?Pi[T.characterRarity]??[]:[]))],M=x.filter(T=>!m.has(T)).length,R=b.missingItems>0?` It also holds ${b.missingItems} loadout item${b.missingItems===1?"":"s"}
            you do not have, at ${Ks(b.itemPercent)} of the table.`:"";E=b.expectedCoins===0?`<p class="shop-why"><span class="shop-why-head">What you get</span>
            Every fighter roll here is a new fighter. ${M} of the ${x.length} are
            still missing from your roster.${R}</p>`:`<p class="shop-why"><span class="shop-why-head">Duplicates</span>
            ${M} of the ${x.length} fighters here are still missing. A repeat
            trades in for coins, ${Math.round(b.expectedCoins).toLocaleString()} on
            average across the table.${R}</p>`}return`
      <article class="shop-card">
        <div class="shop-card-head">
          <span class="shop-card-em">${_t(u)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${g.name}</h3>
            ${y}${v}
          </div>
        </div>
        <p class="shop-blurb">${g.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${s(u)}
        ${i(u)}
        <div class="shop-prices">${k("coins")}${k("gems")}</div>
        ${E}
      </article>`}function l(u){const m=Be[u],f=a.winsToNextChest;return`
      <article class="shop-card shop-card--free">
        <div class="shop-card-head">
          <span class="shop-card-em">${_t(u)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${m.name}</h3>
            <span class="shop-guarantee shop-guarantee--free">Earned, never sold</span>
          </div>
        </div>
        <p class="shop-blurb">${m.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${s(u)}
        ${i(u)}
        <p class="shop-why">
          <span class="shop-why-head">How to get one</span>
          ${f===1?"One more win":`${f} more wins`} for the next free ${m.name},
          and the Trophy Road hands out more along the way.
        </p>
      </article>`}function h(){const u=ba.filter(f=>(a.containers[f]??0)>0);return u.length===0?"":`
      <section class="shop-section shop-inv">
        <h2 class="shop-section-title">Your boxes</h2>
        <div class="shop-heldrow">${u.map(f=>`
      <span class="shop-held">
        <span class="shop-held-em">${_t(f)}</span>
        <span class="shop-held-name">${Be[f].name}</span>
        <span class="shop-held-n">${a.containers[f]}</span>
      </span>`).join("")}</div>
        <p class="shop-why"><span class="shop-why-head">Waiting to be opened</span>
          Open them on the Trophy Road, below.</p>
      </section>`}function c(){const u=a.unlocked,m=hi(a.economy);o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString();const f=pE.some(w=>Lo(w,"coins",u,m)||Lo(w,"gems",u,m)),g=f?"":`
      <p class="shop-notice">${_("cone")}
        <span><strong>Nothing here is for sale yet.</strong>
        You own all ${Ee.length} fighters, so a fighter roll only pays coins
        back and every box returns less than it costs. Loadout items come from free
        Chests and the Trophy Road.
        <span class="shop-notice-more">Buying is switched off rather than offered as a
        bad deal. Everything below is real: these are the prices and the drop rates the
        game will use.</span></span>
      </p>`;n.innerHTML=`
      ${g}
      ${h()}
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
        <p class="shop-rarity">${J0}</p>
        <div class="shop-grid">${ba.map(w=>Be[w].price?r(w,u,m):l(w)).join("")}</div>
      </section>
    `,o("footnote").textContent=f?"Coins and gems both work on every box.":"Boxes are earned, not bought:"}o("back").addEventListener("click",()=>t.navigate({name:"home"}));const d=u=>{const m=u.target,f=m.closest("[data-go]")?.dataset.go;if(f==="trophies"){t.navigate({name:"trophies"});return}if(f==="characters"){t.navigate({name:"characters"});return}const g=m.closest("[data-buy]");if(!g||g.disabled)return;const w=g.dataset.buy,b=g.dataset.currency;Lo(w,b,a.unlocked,hi(a.economy))&&a.buyContainer(w,b)};e.addEventListener("click",d);const p=a.onChange(c);return c(),{root:e,dispose(){p(),e.removeEventListener("click",d),e.remove()}}}const fE=`
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
/* The item chip states a RATE, not a guarantee, and stacks under the fighter one when
   both are present ('.shop-card-id' is a column). Same ink deliberately: the rarity
   channel is carried by the 10px dot and never by the type — measured on this project's
   other odds sheet, every rarity colour is below AA as text on cream.
   NOTE THE SINGLE QUOTES: this block is inside a JS template literal and one backtick
   terminates it — the trap this file already warns about 400 lines up, and which I
   walked straight into while writing a comment about being careful. */
.fa-shop .shop-guarantee--item { color: #4E2C1B; }

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
`,mE="admin panel is not enabled in this build — rebuild with VITE_FA_ADMIN=1, or run the dev server",xm=["opening","home","characters","trophies","shop","settings","lobby","match"];function Fi(t){return typeof t=="string"&&Ee.includes(t)}function gE(t){return typeof t=="number"?zi(t):void 0}function wE(t){if(!t||typeof t!="object")return null;const e=t.name;if(typeof e!="string"||!xm.includes(e))return null;if(e==="match"){const{player:a,enemy:o,seats:n}=t;return Fi(a)&&Fi(o)?{name:e,player:a,enemy:o,seats:gE(n)}:null}return{name:e}}function bE(t){const e=new URLSearchParams(t),a=e.get("screen");if(a===null||!xm.includes(a))return null;if(a==="match"){const o=e.get("player"),n=e.get("enemy");return Fi(o)&&Fi(n)?{name:a,player:o,enemy:n,seats:yE(e)}:null}return{name:a}}function yE(t){const e=t.get("seats");return e===null?void 0:zi(Number(e))}function yl(t,e){return t.name!==e.name?!1:t.name==="match"&&e.name==="match"?t.player===e.player&&t.enemy===e.enemy&&t.seats===e.seats:!0}function H0(t){const e=new URLSearchParams(window.location.search);e.set("screen",t.name),t.name==="match"?(e.set("player",t.player),e.set("enemy",t.enemy),t.seats===void 0?e.delete("seats"):e.set("seats",String(t.seats))):(e.delete("player"),e.delete("enemy"),e.delete("seats"));const a=e.toString();return`${window.location.pathname}${a?`?${a}`:""}${window.location.hash}`}function xE(t,e){if(e!=="none")try{const a={fa:1,route:t};e==="push"?window.history.pushState(a,"",H0(t)):window.history.replaceState(a,"",H0(t))}catch{}}const vE=3e3,kE=10,ME=140;function EE(t){Tw(),wm();const e=document.createElement("div");e.className="fa-root",e.innerHTML=`
    <div class="fa-bg"></div>
    <div class="fa-rays"></div>
    <div class="fa-dots"></div>
    <div class="fa-stack" data-el="stack"></div>
    <div class="fa-curtain" data-el="curtain"></div>
  `,t.screenRoot.appendChild(e);const a=e.querySelector('[data-el="stack"]'),o=e.querySelector('[data-el="curtain"]'),n=t.profile??new wu;let s=null,i={name:"home"},r=0,l=0,h=!1,c=null,d=!1,p=null,u=0;function m($,oe){console.error(`[shell] ${$}:`,oe)}function f($){const oe=window.__shellFault;if(!oe)return!1;const we=oe[$];return typeof we!="number"||we<=0?!1:(oe[$]=we-1,!0)}const g={navigate:A,profile:n,gameHost:t.gameHost,hudRoot:t.hudRoot};function w($){if(f("build"))throw new Error(`__shellFault: build ${$.name}`);switch($.name){case"opening":return Ub(g);case"home":return Hb(g);case"characters":return sE(g);case"trophies":return lE(g);case"shop":return uE(g);case"settings":return QM(g);case"lobby":return Cb(g);case"admin":throw new Error(mE);case"match":return GM(g,$)}throw new Error(`unknown route "${String($.name)}"`)}function b(){r&&cancelAnimationFrame(r),r=0}function y(){b(),l=performance.now();const $=oe=>{if(d)return;const we=Math.min(Math.max(0,(oe-l)/1e3),1/20);l=oe;try{if(f("update"))throw new Error("__shellFault: update");s?.update?.(we),u=0}catch(ve){if(u++,u===1&&m(`screen "${i.name}" update() threw`,ve),u>=kE){m(`screen "${i.name}" update() threw ${u} frames running — stopping the menu loop`,ve),b();return}}r=requestAnimationFrame($)};r=requestAnimationFrame($)}function v($,oe){if($.name==="match")try{Pc()}catch(ve){m("disposeCharacterStage() threw",ve)}try{$.name==="match"?Se.music.fadeOut():Se.music.fadeIn()}catch(ve){m("music transition threw",ve)}e.classList.toggle("is-ingame",$.name==="match");let we;try{we=w($)}catch(ve){P($,ve);return}i=$,s=we,a.appendChild(we.root),xE($,oe),I(),window.__screen=$.name,u=0,s.update?y():b(),$.name!=="match"&&(window.__previewReady=!1,requestAnimationFrame(()=>requestAnimationFrame(()=>{d||(window.__previewReady=!0)})))}function k($){$.style.cssText=["pointer-events:auto","background:#FFF3DE","color:#1a1224","border-radius:16px","padding:18px 22px","max-width:min(92vw,420px)","text-align:center","box-shadow:0 10px 30px rgba(0,0,0,0.45)","font-family:'Rubik',sans-serif"].join(";")}function E($){$.style.cssText=["position:absolute","inset:0","z-index:120","display:grid","place-items:center","padding:16px","background:rgba(20,13,30,0.72)","pointer-events:none"].join(";")}function x($){const oe=document.createElement("button");return oe.type="button",oe.textContent=$,oe.style.cssText=["min-height:44px","min-width:140px","margin-top:14px","padding:0 20px","border:0","border-radius:999px","background:#F4A300","color:#1a1224","font-family:'Rubik',sans-serif","font-weight:800","font-size:16px","cursor:pointer"].join(";"),oe.addEventListener("click",()=>window.location.reload()),oe}function M($){const oe=document.createElement("div");E(oe),oe.style.background="#16101f",oe.dataset.el="fa-fatal";const we=document.createElement("div");k(we);const ve=document.createElement("div");ve.textContent="The kitchen would not open",ve.style.cssText="font-weight:800;font-size:18px";const yt=document.createElement("div");return yt.textContent=String($?.message??$??"unknown error"),yt.style.cssText="margin-top:8px;font-size:13px;opacity:0.75;font-family:'Heebo',sans-serif;word-break:break-word",we.append(ve,yt,x("Reload")),oe.appendChild(we),oe}let R=null,T=null;function N(){if(d||R)return;const $=document.createElement("div");E($),$.dataset.el="fa-gl-notice";const oe=document.createElement("div");k(oe);const we=document.createElement("div");we.textContent="Graphics interrupted",we.style.cssText="font-weight:800;font-size:18px";const ve=document.createElement("div");ve.textContent="The device took the graphics back. Restoring…",ve.style.cssText="margin-top:6px;font-size:14px;opacity:0.8;font-family:'Heebo',sans-serif";const yt=x("Reload");yt.style.display="none",oe.append(we,ve,yt),$.appendChild(oe),e.appendChild($),R=$,T=setTimeout(()=>{T=null,R&&(ve.textContent="The graphics have not come back. Reloading returns you to this same screen.",yt.style.display="inline-block")},vE)}function I(){T!==null&&(clearTimeout(T),T=null),R?.remove(),R=null}function F($){return $.detail?.offscreen===!0}function L($){F($)||N()}function H($){F($)||I()}function P($,oe){if(m(`screen "${$.name}" failed to mount`,oe),a.innerHTML="",$.name!=="home"){v({name:"home"},"replace");return}s=null,i={name:"home"},window.__screen="home",b(),a.appendChild(M(oe))}function j(){b();try{if(f("dispose"))throw new Error("__shellFault: dispose");s?.dispose()}catch($){m(`screen "${i.name}" dispose() threw`,$)}s=null,a.innerHTML=""}function z($){return i.name==="opening"||yl($,i)?"replace":"push"}function Y($,oe){h=!0,window.__screenReady=!1,o.classList.add("is-on"),c=setTimeout(()=>{c=null;try{j(),v($,oe)}catch(we){m("navigation threw",we)}finally{o.classList.remove("is-on"),h=!1,window.__screenReady=!0,D()}},ME)}function A($){d||h||Y($,z($))}const C=$=>{if(d)return;const oe=$.state,we=wE(oe?.route)??bE(window.location.search)??{name:"home"};if(!yl(we,i)){if(h){p=we;return}Y(we,"none")}};function D(){const $=p;p=null,!(!$||d||yl($,i))&&Y($,"none")}const U=()=>{try{s?.resize?.()}catch($){m(`screen "${i.name}" resize() threw`,$)}},te='button, [role="button"], a[href], [data-clicksound="on"]',Z=$=>{try{if(Se.isMuted())return;const oe=$.target?.closest?.(te);if(!oe||oe.closest('[data-clicksound="off"]')||oe.hasAttribute("disabled")||oe.getAttribute("aria-disabled")==="true")return;Se.previewClick()}catch(oe){m("ui click sound threw",oe)}};return e.addEventListener("click",Z,!0),window.addEventListener("resize",U),window.addEventListener("popstate",C),window.addEventListener("fa:webglcontextlost",L),window.addEventListener("fa:webglcontextrestored",H),window.__shell={navigate:A,route:()=>i},{navigate($){if(!s){v($,$.name==="opening"?"none":"replace"),window.__screenReady=!0;return}A($)},get route(){return i},dispose(){d=!0,c!==null&&clearTimeout(c),e.removeEventListener("click",Z,!0),window.removeEventListener("resize",U),window.removeEventListener("popstate",C),window.removeEventListener("fa:webglcontextlost",L),window.removeEventListener("fa:webglcontextrestored",H),I(),j(),Pc(),e.remove(),delete window.__shell}}}const Ht=new URLSearchParams(location.search),TE=["player","enemy","simSpeed","fogRadius","px","py","fighters","seats"];function _0(t,e){const a=Ht.get(t);return a&&Ee.includes(a)?a:e}function SE(t){if(Ht.get("screen")==="match"||!Ht.has("screen")&&TE.some(a=>Ht.has(a))){const a=_0("player",t.selected),o=a==="donut"?"hamburger":"donut",n=zg(Ht);return{name:"match",player:a,enemy:_0("enemy",o),seats:n}}return Ht.get("screen")==="lobby"?{name:"lobby"}:Ht.get("screen")==="characters"?{name:"characters"}:Ht.get("screen")==="trophies"?{name:"trophies"}:Ht.get("screen")==="shop"?{name:"shop"}:Ht.get("screen")==="settings"?{name:"settings"}:Ht.get("screen")==="home"?{name:"home"}:{name:"opening"}}const vm=new wu,AE=EE({gameHost:document.getElementById("game"),hudRoot:document.getElementById("hud"),screenRoot:document.getElementById("screens"),profile:vm});AE.navigate(SE(vm));Se.music.play();const RE=document.getElementById("boot");requestAnimationFrame(()=>RE.classList.add("hidden"));
