import{C as ie,I as ke,l as Hl,a as Rt,b as Le,c as Ga,L as Io,d as Te,t as to,R as oi,e as _l,V as pe,f as ae,S as xh,g as Re,M as X,B as _c,h as M,i as $a,j as Je,k as mt,A as tt,P as qa,m as Kt,n as Yn,o as K,p as st,q as zl,r as is,G as he,s as xt,u as vh,v as Vn,w as Lt,x as ga,y as Kn,O as Pl,Z as zc,z as gi,D as fg,E as u0,N as mg,F as f0,H as m0,J as kh,K as na,Q as It,T as Wa,U as _e,W as ye,X as rs,Y as gg,_ as wg,$ as nt,a0 as bg,a1 as yg,a2 as xg,a3 as g0,a4 as w0,a5 as Pc,a6 as $l,a7 as vg,a8 as kg,a9 as Mg,aa as qt,ab as Wi,ac as b0,ad as Eg,ae as Tg,af as dt,ag as y0,ah as Sg,ai as x0,aj as Ag,ak as Rg,al as ni,am as $c,an as Bc,ao as Xn,ap as Ig,aq as Mn,ar as yr,as as Og,at as Cg,au as xr,av as Uc,aw as Bl,ax as Fg,ay as wi,az as Ng,aA as Lg,aB as Ul,aC as Dg,aD as ql,aE as Hg,aF as _g,aG as zg,aH as Pg,aI as bi,aJ as Wl,aK as $g,aL as Bg,aM as Ug,aN as qg,aO as Mh,aP as pt,aQ as cn,aR as Gi,aS as wo,aT as Eh,aU as Th,aV as ji,aW as Oo,aX as Sh,aY as Co,aZ as v0,a_ as Ah,a$ as ja,b0 as Wg,b1 as Gg,b2 as uo,b3 as jg,b4 as Yg,b5 as Vg,b6 as qc,b7 as En,b8 as yi,b9 as Kg,ba as vr,bb as Xg,bc as Zg,bd as Jg,be as Qg,bf as ew,bg as tw,bh as aw,bi as Wc,bj as ow,bk as nw,bl as Gc,bm as sw,bn as iw,bo as kr,bp as rw,bq as lw,br as hw,bs as cw,bt as dw,bu as pw}from"./kitchen-CL6Z61Mo.js";const Jt=6,rt=2;function uw(t){return t===0?"player":"enemy"}function fw(t){return 1<<t}const la=-1;function mw(t,e){if(t.length>Rt)throw new RangeError(`createFighter: slot ${e} was handed ${t.length} items and the game has ${Rt} equip slots (rules.ts:ITEM_SLOTS — Uri: "up to 2 items per player")`);for(const a of t)if(!Object.hasOwn(Le,a))throw new RangeError(`createFighter: slot ${e} was handed an unknown item id "${a}" (see rules.ts:ITEMS)`);if(new Set(t).size!==t.length)throw new RangeError(`createFighter: slot ${e} equipped a duplicate item [${t.join(", ")}]`);return t.slice()}function gw(t){const{id:e,controller:a,characterId:o,spawn:n,maxHp:s,size:i,hitRadius:r,facing:l}=t,h=ie[o].weapons.length,c=Ga(t.level??Io),d=mw(t.items??[],e);return{id:e,controller:a,role:uw(e),characterId:o,level:c,damageMul:Hl(c),x:n.x,y:n.y,hp:s,maxHp:s,size:i,hitRadius:r,facing:{x:l.x,y:l.y},status:{slowedUntil:-1/0,stunnedUntil:-1/0,slowAppliedAt:-1/0,slowStacks:0,stunAppliedAt:-1/0,stunStacks:0},alive:!0,deaths:0,lastUsed:new Array(h).fill(-1/0),hazardTimers:[],fogTimer:0,regenTimer:0,trailDropTimer:0,detourSign:0,lastDamagedAt:-1/0,terrainSlowFactor:1,concealed:!1,revealedUntil:-1/0,cast:null,push:{x:0,y:0,remaining:0,speed:0,anchor:la},item:{equipped:d,lastUsed:new Array(d.length).fill(-1/0),sleepUntil:-1/0,clogUntil:-1/0,rootUntil:-1/0,blotUntil:-1/0,shieldUntil:-1/0,streakTarget:la,streakCount:0,streakAt:-1/0,auraTimers:[],killerId:la,revivesLeft:d.includes("leftovers")?ke.leftovers.usesPerMatch:0},itemCast:null}}function k0(t,e){return t.item.equipped.includes(e)}function M0(t){return t.cast!==null}function Yi(t,e){return e<t.status.stunnedUntil||t.cast!==null||t.itemCast!==null||e<t.item.sleepUntil||e<t.item.rootUntil}function bo(t,e){return e<t.item.sleepUntil}function E0(t,e){return bo(t,e)||e<t.item.clogUntil}function Rh(t){let e=0;for(const a of t.fighters)a.alive&&a.hp>0&&e++;return e}function T0(t){return t==="player"?"enemy":"player"}function dn(t,e){return t!==e&&t.alive&&t.hp>0}function pn(t,e,a){let o=null,n=1/0;for(const s of t.fighters){if(!dn(s,e)||s===a)continue;const i=Math.hypot(s.x-e.x,s.y-e.y);i<n&&(n=i,o=s)}return o}function ww(t,e){const a=e.facing.x,o=e.facing.y;let n=null,s=1/0,i=1/0;for(const r of t.fighters){if(!dn(r,e))continue;const l=r.x-e.x,h=r.y-e.y;if(a*l+o*h<0)continue;const c=Math.abs(a*h-o*l),d=Math.hypot(l,h);(c<s||c===s&&d<i)&&(s=c,i=d,n=r)}return n??pn(t,e)}function bw(t){let e=null;for(const a of t.fighters)if(!(!a.alive||a.hp<=0)){if(e!==null)return null;e=a}return e}function Gl(t,e,a){return t*a+e}function yw(t){const e=t.get("seats");if(e!==null)return Vi(Number(e))}function Vi(t){if(Number.isInteger(t)&&!(t<=rt||t>Jt))return t}const jc=Array.from({length:Jt-rt+1},(t,e)=>rt+e);function S0(t,e,a){if(!Number.isInteger(a)||a<rt||a>Jt)throw new RangeError(`brawlRoster: ${a} seats; the sim seats ${rt}..${Jt} (see state.ts MIN_FIGHTERS / MAX_FIGHTERS)`);const o=[t];a>1&&o.push(e);const n=Te.indexOf(t);for(let s=1;o.length<a&&s<=Te.length;s++){const i=Te[(n+s)%Te.length];o.includes(i)||o.push(i)}if(o.length!==a||new Set(o).size!==a)throw new RangeError(`brawlRoster: built ${o.length} seats (${new Set(o).size} distinct) for ${a} from ${Te.length} characters — [${o.join(", ")}]`);return o}const Yc={coins:500,gems:25},xw=!1,A0=Te[0],kt={trophiesWin:to("MATCH_PAYOUT.trophiesWin",15,{group:"economy",unit:"trophies",min:0,max:200,int:!0,doc:"Trophies for first place. The whole placement curve is stated relative to this — see the placement block below."}),trophyLossBase:to("MATCH_PAYOUT.trophyLossBase",2,{group:"economy",unit:"trophies",min:0,max:100,int:!0,doc:"Flat part of a loss. Loss = min(cap, base + floor(trophies / per))."}),trophyLossPer:to("MATCH_PAYOUT.trophyLossPer",150,{group:"economy",unit:"trophies",min:1,max:1e4,int:!0,doc:"Trophies per extra point of loss — the escalation rate. A DIVISOR: smaller is harsher."}),trophyLossCap:to("MATCH_PAYOUT.trophyLossCap",10,{group:"economy",unit:"trophies",min:0,max:200,int:!0,doc:"Ceiling on a single loss, however many trophies are held."}),trophyLossGraceBelow:to("MATCH_PAYOUT.trophyLossGraceBelow",100,{group:"economy",unit:"trophies",min:0,max:1e4,int:!0,doc:"Below this standing a loss costs nothing — the first hour must not read as standing still."}),coinsWin:to("MATCH_PAYOUT.coinsWin",60,{group:"economy",unit:"coins",min:0,max:1e4,int:!0,doc:"Coins for a win. The 3:1 ratio against coinsLoss is the design statement, not either number alone."}),coinsLoss:to("MATCH_PAYOUT.coinsLoss",20,{group:"economy",unit:"coins",min:0,max:1e4,int:!0,doc:"Coins for a loss. Always non-zero: a losing streak must not feel like a waste of ten minutes."}),winsPerChest:3,placementSteepness:1},Xt={Normal:120,Rare:260,Epic:520,Legendary:900,Neon:1400,Cyber:2200},Tn={baseCoins:300,growth:1.32,rarityCostMultiplier:{Normal:1,Rare:1,Epic:1,Legendary:1,Neon:1,Cyber:1},roundTo:10},Ma=["chest","hamburgerBox","pineappleBox","redBox","fireBox"],R0="Rarity sets how hard a fighter is to find — not how strong it is, and not what it costs to level up. Two fighters at the same level are a fair fight whatever their rarity.",Ge={chest:{name:"Chest",emoji:"📦",blurb:"Earned by winning matches and along the Trophy Road.",price:null,entries:[{weight:46,coins:120},{weight:21,coins:220},{weight:13,coins:90,gems:5},{weight:8,coins:400},{weight:4,coins:150,gems:20},{weight:2.1,characterRarity:"Normal"},{weight:.9,characterRarity:"Rare"},{weight:3,itemRarity:"Normal"},{weight:1.4,itemRarity:"Rare"},{weight:.5,itemRarity:"Epic"},{weight:.1,itemRarity:"Legendary"}]},hamburgerBox:{name:"Hamburger Box",emoji:"🍔",blurb:"Mostly Normal fighters and gear, with a chance of something rarer.",price:{coins:900,gems:60},entries:[{weight:71.2,characterRarity:"Normal"},{weight:8,characterRarity:"Rare"},{weight:.8,characterRarity:"Epic"},{weight:16,itemRarity:"Normal"},{weight:3.6,itemRarity:"Rare"},{weight:.4,itemRarity:"Epic"}]},pineappleBox:{name:"Purple Pineapple Box",emoji:"🍍",blurb:"Rare fighters and gear, Epic and Legendary possible.",price:{coins:3200,gems:120},entries:[{weight:75.6,characterRarity:"Rare"},{weight:4,characterRarity:"Epic"},{weight:.4,characterRarity:"Legendary"},{weight:16,itemRarity:"Rare"},{weight:3.6,itemRarity:"Epic"},{weight:.4,itemRarity:"Legendary"}]},redBox:{name:"Big Smile Box",emoji:"🎁",blurb:"Epic fighters and gear, with the only Cyber chance outside the Fire Box.",price:{coins:5600,gems:240},entries:[{weight:71.59,characterRarity:"Epic"},{weight:8,characterRarity:"Legendary"},{weight:.4,characterRarity:"Neon"},{weight:.01,characterRarity:"Cyber"},{weight:16,itemRarity:"Epic"},{weight:3.5,itemRarity:"Legendary"},{weight:.4,itemRarity:"Neon"},{weight:.1,itemRarity:"Cyber"}]},fireBox:{name:"Purple Fire Box",emoji:"🔥",blurb:"Legendary fighters and gear, with the best Neon and Cyber odds in the game.",price:{coins:12e3,gems:480},entries:[{weight:75.6,characterRarity:"Legendary"},{weight:4,characterRarity:"Neon"},{weight:.4,characterRarity:"Cyber"},{weight:16,itemRarity:"Legendary"},{weight:3.5,itemRarity:"Neon"},{weight:.5,itemRarity:"Cyber"}]}},vw=1e4,xa=[{trophies:30,reward:{type:"container",kind:"chest",count:1}},{trophies:65,reward:{type:"coins",amount:150}},{trophies:100,reward:{type:"character",id:"donut"}},{trophies:145,reward:{type:"bundle",parts:[{type:"gems",amount:5},{type:"itemSurprise",minRarity:"Normal"}]}},{trophies:195,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:250,reward:{type:"character",id:"taco"}},{trophies:315,reward:{type:"coins",amount:250}},{trophies:390,reward:{type:"container",kind:"chest",count:1}},{trophies:480,reward:{type:"character",id:"burrito"}},{trophies:575,reward:{type:"bundle",parts:[{type:"gems",amount:10},{type:"itemSurprise",minRarity:"Normal"}]}},{trophies:685,reward:{type:"container",kind:"hamburgerBox",count:1}},{trophies:800,reward:{type:"character",id:"soup"}},{trophies:940,reward:{type:"coins",amount:400}},{trophies:1090,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:1250,reward:{type:"character",id:"sushi"}},{trophies:1420,reward:{type:"gems",amount:20}},{trophies:1595,reward:{type:"container",kind:"chest",count:1}},{trophies:1770,reward:{type:"bundle",parts:[{type:"coins",amount:700},{type:"itemSurprise",minRarity:"Rare"}]}},{trophies:1950,reward:{type:"character",id:"waterbottle"}},{trophies:2140,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:2340,reward:{type:"gems",amount:35}},{trophies:2550,reward:{type:"coins",amount:1200}},{trophies:2770,reward:{type:"container",kind:"chest",count:2}},{trophies:3e3,reward:{type:"character",id:"pizza"}},{trophies:3235,reward:{type:"container",kind:"redBox",count:1}},{trophies:3475,reward:{type:"bundle",parts:[{type:"coins",amount:1800},{type:"itemSurprise",minRarity:"Rare"}]}},{trophies:3725,reward:{type:"gems",amount:50}},{trophies:3980,reward:{type:"container",kind:"pineappleBox",count:1}},{trophies:4240,reward:{type:"coins",amount:2400}},{trophies:4500,reward:{type:"character",id:"egg"}},{trophies:4780,reward:{type:"gems",amount:70}},{trophies:5080,reward:{type:"container",kind:"redBox",count:1}},{trophies:5390,reward:{type:"bundle",parts:[{type:"coins",amount:3e3},{type:"itemSurprise",minRarity:"Epic"}]}},{trophies:5710,reward:{type:"container",kind:"chest",count:3}},{trophies:6040,reward:{type:"gems",amount:90}},{trophies:6380,reward:{type:"container",kind:"pineappleBox",count:2}},{trophies:6750,reward:{type:"character",id:"lollipop"}},{trophies:7125,reward:{type:"coins",amount:4e3}},{trophies:7510,reward:{type:"container",kind:"redBox",count:1}},{trophies:7905,reward:{type:"bundle",parts:[{type:"gems",amount:120},{type:"itemSurprise",minRarity:"Legendary"}]}},{trophies:8310,reward:{type:"coins",amount:5e3}},{trophies:8725,reward:{type:"container",kind:"fireBox",count:1}},{trophies:9145,reward:{type:"bundle",parts:[{type:"gems",amount:150},{type:"itemSurprise",minRarity:"Neon"}]}},{trophies:9565,reward:{type:"bundle",parts:[{type:"coins",amount:8e3},{type:"gems",amount:250},{type:"container",kind:"fireBox",count:1}]}},{trophies:vw,reward:{type:"character",id:"hotdog"}}],I0=[{id:"gemsPouch",name:"Pouch of Gems",emoji:"💎",priceUsdCents:99,gems:80},{id:"gemsSack",name:"Sack of Gems",emoji:"💎",priceUsdCents:499,gems:500},{id:"gemsCrate",name:"Crate of Gems",emoji:"💎",priceUsdCents:999,gems:1200},{id:"gemsBarrel",name:"Barrel of Gems",emoji:"💎",priceUsdCents:1999,gems:2600},{id:"gemsVault",name:"Vault of Gems",emoji:"💎",priceUsdCents:4999,gems:7e3},{id:"starterBundle",name:"Chef Starter Pack",emoji:"🧑‍🍳",priceUsdCents:499,gems:500,coins:2e3,container:{kind:"pineappleBox",count:1},oneTime:!0}],Ki=(()=>{const t={};for(const e of Te){const a=ie[e].rarity;(t[a]??=[]).push(e)}return t})(),wa=Object.keys(Le),un=(()=>{const t={};for(const e of wa)(t[Le[e].rarity]??=[]).push(e);return t})(),Zn=Xt,kw=(()=>{const t={};for(const[e,a]of Object.entries(Xt))t[e]=a>0?1/a:0;return t})(),O0=(()=>{const t=Object.keys(Xt).sort((e,a)=>Xt[e]-Xt[a]);for(const e of t){const a=un[e];if(a&&a.length>0)return a[0]}throw new Error("STARTER_ITEM: rules.ts:ITEMS is empty")})();function Mw(t){let e=t>>>0;return e=Math.imul(e^e>>>16,569420461),e=Math.imul(e^e>>>15,1935289751),(e^e>>>15)>>>0}function C0(t){let e=Mw(Math.trunc(t)||0);const a=()=>{e=e+1831565813>>>0;let o=e;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296};return{next:a,int(o){return o>0?Math.floor(a()*o):0},pick(o){return o.length>0?o[Math.floor(a()*o.length)]:void 0}}}function F0(t,e,a){if(e.length===0)return-1;const o=t.next()*a;let n=0;for(let s=0;s<e.length;s++)if(n+=e[s],o<n)return s;return e.length-1}function Ew(t,e){if(e.length===0)return-1;let a=0;for(const o of e)a+=o>0?o:0;return a<=0?-1:F0(t,e,a)}const Tw=1e6;function Sw(t,e){return t+Tw+e}function Aw(){return Math.floor(Math.random()*4294967295)>>>0||1}function Ih(){return{coins:0,gems:0,containers:{},characters:[],items:[]}}function si(t,e){return e===1?t:/[sxz]$/i.test(t)?`${t}es`:`${t}s`}function N0(t,e){t.coins+=e.coins,t.gems+=e.gems;for(const[a,o]of Object.entries(e.containers))t.containers[a]=(t.containers[a]??0)+o;for(const a of e.characters)t.characters.includes(a)||t.characters.push(a);for(const a of e.items)t.items.includes(a)||t.items.push(a);return t}function Rw(t){const e=[];for(const a of t.characters)e.push({emoji:ie[a].emoji,label:ie[a].name});for(const[a,o]of Object.entries(t.containers)){if(!o)continue;const n=Ge[a];e.push({emoji:n.emoji,label:o>1?`${o} ${si(n.name,o)}`:n.name})}t.coins>0&&e.push({emoji:"🪙",label:`${t.coins.toLocaleString()} ${si("Coin",t.coins)}`}),t.gems>0&&e.push({emoji:"💎",label:`${t.gems.toLocaleString()} ${si("Gem",t.gems)}`});for(const a of t.items)e.push({emoji:Iw,label:Le[a].name});return e}const Iw="🎁";function Xi(t){return t.reduce((e,a)=>e+a.weight,0)}function Jn(t){const e=Ge[t],a=Xi(e.entries);if(a<=0)return[];const o=[];for(const s of e.entries){const i=s.weight/a*100;if(s.characterRarity){const r=Ki[s.characterRarity]??[];o.push({label:`${s.characterRarity} fighter`,percent:i,rarity:s.characterRarity,pool:r})}else if(s.itemRarity){const r=un[s.itemRarity]??[];r.length===0?o.push({label:`${Zn[s.itemRarity].toLocaleString()} coins`,percent:i}):o.push({label:`${s.itemRarity} item`,percent:i,rarity:s.itemRarity,itemPool:r})}else{const r=[];s.coins&&r.push(`${s.coins.toLocaleString()} coins`),s.gems&&r.push(`${s.gems.toLocaleString()} gems`),o.push({label:r.join(" + ")||"Nothing",percent:i})}}const n=new Map;for(const s of o){const i=n.get(s.label);i?i.percent+=s.percent:n.set(s.label,{...s})}return[...n.values()].sort((s,i)=>i.percent-s.percent)}function ii(t){return`${t.toFixed(4).replace(/0+$/,"").replace(/\.$/,"")}%`}function Ow(t,e,a,o){const n=Ge[t],s=Xi(n.entries),i=n.entries[F0(e,n.entries.map(l=>l.weight),s)],r=Ih();if(!i)return{kind:t,reward:r};if(i.coins&&(r.coins+=i.coins),i.gems&&(r.gems+=i.gems),i.characterRarity){const l=Ki[i.characterRarity]??[],h=l.filter(c=>!a.has(c));if(h.length>0){const c=e.pick(h);r.characters.push(c)}else{const c=e.pick(l);if(r.coins+=Xt[i.characterRarity],c)return{kind:t,reward:r,duplicateOf:c}}}if(i.itemRarity){const l=un[i.itemRarity]??[],h=l.filter(c=>!o.has(c));if(h.length>0){const c=e.pick(h);r.items.push(c)}else{const c=e.pick(l);if(r.coins+=Zn[i.itemRarity],c)return{kind:t,reward:r,duplicateItemOf:c}}}return{kind:t,reward:r}}function L0(t){return Xt[ie[t].rarity]}function Cw(t){return t<kt.trophyLossGraceBelow?0:Math.min(kt.trophyLossCap,kt.trophyLossBase+Math.floor(t/kt.trophyLossPer))}function Zi(t,e){if(!Number.isInteger(e)||e<rt||e>Jt)throw new RangeError(`placementRank01: ${e} seats; the sim seats ${rt}..${Jt} (see game/state.ts MIN_FIGHTERS / MAX_FIGHTERS)`);if(!Number.isInteger(t)||t<0||t>=e)throw new RangeError(`placementRank01: place ${t} is outside 0..${e-1}`);return t/(e-1)}function Oh(t,e=kt.placementSteepness){return t<=0?0:t>=1?1:Math.pow(t,e)}function Fw(t,e,a,o){const n=Oh(Zi(t,e),o),s=kt.trophiesWin+Cw(a);return Math.round(kt.trophiesWin-n*s)}function Nw(t,e,a){const o=Oh(Zi(t,e),a);return Math.round(kt.coinsWin-o*(kt.coinsWin-kt.coinsLoss))}function Lw(t,e){return Zi(t,e)<.5}function Dw(){return xa}function jl(){return xa.length>0?xa[xa.length-1].trophies:0}function D0(t,e){return xa.filter(a=>t>=a.trophies&&!e.includes(a.trophies))}function Hw(t){return xa.find(e=>t<e.trophies)??null}function H0(t){const e=Hw(t);if(!e)return{from:jl(),to:jl(),progress01:1,next:null};const a=xa.indexOf(e),o=a>0?xa[a-1].trophies:0,n=e.trophies-o,s=n>0?Math.min(1,Math.max(0,(t-o)/n)):0;return{from:o,to:e.trophies,progress01:s,next:e}}function _w(t){const e=oi.indexOf(t);if(e<0)return[];const a=[];for(let o=e;o<oi.length;o++)a.push(...un[oi[o]]??[]);return a}function zw(t,e,a,o){const n=_w(t),s=n.filter(c=>!o.has(c)),i=s.length>0?s:n,r=C0(Sw(e,a)),l=Ew(r,i.map(c=>kw[Le[c].rarity]));if(l<0)return{item:null,coins:Zn[t],duplicateOf:null};const h=i[l];return s.length>0?{item:h,coins:0,duplicateOf:null}:{item:null,coins:Zn[Le[h].rarity],duplicateOf:h}}function _0(t,e,a){const o=Ih();switch(t.type){case"coins":o.coins+=t.amount;break;case"gems":o.gems+=t.amount;break;case"container":o.containers[t.kind]=(o.containers[t.kind]??0)+t.count;break;case"character":o.coins+=L0(t.id);break;case"bundle":for(const n of t.parts)N0(o,_0(n,e,a));break;case"itemSurprise":{const n=zw(t.minRarity,e.seed,a,e.items);n.item?o.items.push(n.item):o.coins+=n.coins;break}}return o}function Pw(t,e){return _0(t.reward,e,t.trophies)}function Yl(t,e){switch(t.type){case"coins":return{emoji:"🪙",title:`${t.amount.toLocaleString()} Coins`,isCharacter:!1};case"gems":return{emoji:"💎",title:`${t.amount.toLocaleString()} Gems`,isCharacter:!1};case"container":{const a=Ge[t.kind];return{emoji:a.emoji,title:t.count>1?`${t.count} ${si(a.name,t.count)}`:a.name,isCharacter:!1}}case"character":{const a=ie[t.id],o=xw;return{emoji:a.emoji,title:a.name,isCharacter:!0,payoutNote:o?void 0:`owned · 🪙 ${L0(t.id).toLocaleString()}`}}case"bundle":return{emoji:"🎉",title:"Grand Prize",isCharacter:!1};case"itemSurprise":return{emoji:"🎁",title:"Mystery Item",isCharacter:!1,payoutNote:`${t.minRarity} or better`}}}function $w(t,e){const a=Ga(e);if(a>=_l)return null;const o=a-Io,n=Tn.baseCoins*Math.pow(Tn.growth,o)*Tn.rarityCostMultiplier[ie[t].rarity];return{coins:Math.round(n/Tn.roundTo)*Tn.roundTo,gems:0}}function z0(t){return Ga(t)}function Bw(){return I0}function Uw(t){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(t/100)}function Vc(t){return t.priceUsdCents>0?t.gems/(t.priceUsdCents/100):0}function qw(t){const e=I0.filter(n=>!n.oneTime&&n.gems>0),a=e.reduce((n,s)=>s.priceUsdCents<n.priceUsdCents?s:n,e[0]);if(!a||t.id===a.id)return 0;const o=Vc(t)/Vc(a);return Math.max(0,Math.round((o-1)*100))}function P0(){const t={};for(const e of Ma)t[e]=0;return t}function $0(t=Aw()){return{trophies:0,bestTrophies:0,coins:Yc.coins,gems:Yc.gems,containers:P0(),claimed:[],unlocked:[A0],items:[O0],winsTowardChest:0,lastMatch:null,levels:{},seed:t,rolls:0}}function Ch(t){return new Set(Te)}function Ww(t,e){return!0}function xi(t){return new Set(t.items)}function Gw(t){return{characters:Ch(),items:xi(t),seed:t.seed}}function B0(t,e){t.coins+=e.coins,t.gems+=e.gems;for(const[a,o]of Object.entries(e.containers))t.containers[a]=(t.containers[a]??0)+(o??0);for(const a of e.characters)t.unlocked.includes(a)||t.unlocked.push(a);for(const a of e.items)t.items.includes(a)||t.items.push(a)}function Vl(t,e,a){return t.coins<e||t.gems<a?!1:(t.coins-=e,t.gems-=a,!0)}function jw(t,e,a){const o=Fw(e,a,t.trophies);t.trophies=Math.max(0,t.trophies+o),t.bestTrophies=Math.max(t.bestTrophies,t.trophies);const n=Nw(e,a);t.coins+=n;let s=0;if(Lw(e,a)){for(t.winsTowardChest++;t.winsTowardChest>=kt.winsPerChest;)t.winsTowardChest-=kt.winsPerChest,s++;t.containers.chest+=s}const i={won:e===0,trophies:o,coins:n,chests:s,place:e,seats:a,seen:!1};return t.lastMatch=i,i}function Yw(t){return Math.max(0,kt.winsPerChest-t.winsTowardChest)}function U0(t){return D0(t.trophies,t.claimed)}function q0(t,e){const a=D0(t.trophies,t.claimed).find(n=>n.trophies===e);if(!a)return null;const o=Pw(a,Gw(t));return t.claimed.push(e),t.claimed.sort((n,s)=>n-s),B0(t,o),o}function Vw(t){const e=Ih();for(const a of U0(t)){const o=q0(t,a.trophies);o&&N0(e,o)}return e}function Kw(t,e){if((t.containers[e]??0)<=0)return null;t.containers[e]--;const a=C0(t.seed+t.rolls);t.rolls++;const o=Ow(e,a,Ch(),xi(t));return B0(t,o.reward),o}function Xw(t){return Ma.reduce((e,a)=>e+(t.containers[a]??0),0)}function Zw(t,e,a){const o=Ge[e].price;return!o||!(a==="coins"?Vl(t,o.coins,0):Vl(t,0,o.gems))?!1:(t.containers[e]++,!0)}function Fh(t,e){return Ga(t.levels[e]??Io)}function Nh(t,e){return $w(e,Fh(t,e))}function Jw(t,e){const a=Nh(t,e);return a!==null&&t.coins>=a.coins&&t.gems>=a.gems}function Qw(t,e){const a=Nh(t,e);if(!a||!Vl(t,a.coins,a.gems))return null;const o=Ga(Fh(t,e)+1);return t.levels[e]=o,{level:o,spent:a}}function e1(t){const e=$0();if(!t||typeof t!="object")return e;const a=t,o=(s,i)=>typeof s=="number"&&Number.isFinite(s)&&s>=0?Math.floor(s):i,n={trophies:o(a.trophies,0),bestTrophies:o(a.bestTrophies,0),coins:o(a.coins,e.coins),gems:o(a.gems,e.gems),containers:P0(),claimed:[],unlocked:[A0],items:[O0],winsTowardChest:o(a.winsTowardChest,0),lastMatch:null,levels:{},seed:o(a.seed,e.seed)||e.seed,rolls:o(a.rolls,0)};if(a.containers&&typeof a.containers=="object"){const s=a.containers;for(const i of Ma)n.containers[i]=o(s[i],0)}if(Array.isArray(a.claimed)){const s=new Set(xa.map(r=>r.trophies)),i=new Set(a.claimed.filter(r=>typeof r=="number"&&s.has(r)));n.claimed=[...i].sort((r,l)=>r-l)}if(Array.isArray(a.unlocked))for(const s of a.unlocked)typeof s=="string"&&Te.includes(s)&&!n.unlocked.includes(s)&&n.unlocked.push(s);if(Array.isArray(a.items))for(const s of a.items)typeof s=="string"&&wa.includes(s)&&!n.items.includes(s)&&n.items.push(s);if(a.levels&&typeof a.levels=="object"){const s=a.levels;for(const i of Te){const r=s[i];if(typeof r!="number"||!Number.isFinite(r))continue;const l=Ga(r);l>Io&&(n.levels[i]=l)}}if(a.lastMatch&&typeof a.lastMatch=="object"){const s=a.lastMatch,i=s.won===!0,r=Number.isInteger(s.seats)&&s.seats>=rt&&s.seats<=Jt?s.seats:rt,l=Number.isInteger(s.place)&&s.place>=0&&s.place<r?s.place:i?0:r-1;n.lastMatch={won:l===0,trophies:typeof s.trophies=="number"&&Number.isFinite(s.trophies)?Math.trunc(s.trophies):0,coins:o(s.coins,0),chests:o(s.chests,0),place:l,seats:r,seen:s.seen===!0}}return n.bestTrophies=Math.max(n.bestTrophies,n.trophies),n}function t1(t){return{trophies:t.trophies,bestTrophies:t.bestTrophies,coins:t.coins,gems:t.gems,containers:{...t.containers},claimed:[...t.claimed],unlocked:[...t.unlocked],items:[...t.items],winsTowardChest:t.winsTowardChest,lastMatch:t.lastMatch?{...t.lastMatch}:null,levels:{...t.levels},seed:t.seed,rolls:t.rolls}}function a1(t,e){typeof e.coins=="number"&&Number.isFinite(e.coins)&&e.coins>=0&&(t.coins=Math.floor(e.coins)),typeof e.gems=="number"&&Number.isFinite(e.gems)&&e.gems>=0&&(t.gems=Math.floor(e.gems))}const W0="food-arena.profile.v1",qn=250,Kc=100,o1=35;function G0(t,e){const a=Oh(Zi(t,e));return Math.round(Kc-a*(Kc-o1))}const Kl="Chef",Xl=16;function j0(t){if(typeof t!="string")return Kl;const e=t.replace(/\s+/g," ").replace(/[\p{Cc}\p{Cf}]/gu,"").trim().slice(0,Xl).trim();return e.length>0?e:Kl}function n1(t){return typeof t=="string"&&Te.includes(t)}function Mr(t,e){return typeof t=="number"&&Number.isFinite(t)&&t>=0?t:e}function Xc(){return{name:Kl,wins:0,losses:0,xp:0,selected:Te[0],economy:$0()}}function Zc(){try{const t=localStorage.getItem(W0);if(!t)return Xc();const e=JSON.parse(t),a=e1(e.economy);return e.economy===void 0&&a1(a,e),{name:j0(e.name),wins:Math.floor(Mr(e.wins,0)),losses:Math.floor(Mr(e.losses,0)),xp:Math.floor(Mr(e.xp,0)),selected:n1(e.selected)?e.selected:Te[0],economy:a}}catch{return Xc()}}class Y0{data;listeners=new Set;constructor(e){this.data=e?{...Zc(),...e}:Zc()}get name(){return this.data.name}get wins(){return this.data.wins}get losses(){return this.data.losses}get xp(){return this.data.xp}get selected(){return this.data.selected}get level(){return Math.floor(this.data.xp/qn)+1}get levelProgress01(){return this.data.xp%qn/qn}get economy(){return this.data.economy}get coins(){return this.data.economy.coins}get gems(){return this.data.economy.gems}get trophies(){return this.data.economy.trophies}get bestTrophies(){return this.data.economy.bestTrophies}get containers(){return this.data.economy.containers}get containerCount(){return Xw(this.data.economy)}get winsToNextChest(){return Yw(this.data.economy)}get lastMatch(){return this.data.economy.lastMatch}get unlocked(){return Ch(this.data.economy)}isUnlocked(e){return Ww(this.data.economy)}get claimable(){return U0(this.data.economy)}select(e){this.data.selected!==e&&(this.data.selected=e,this.commit())}setName(e){const a=j0(e);return a===this.data.name||(this.data.name=a,this.commit()),a}recordPlacement(e,a){const o=jw(this.data.economy,e,a);return o.won?this.data.wins++:this.data.losses++,this.data.xp+=G0(e,a),this.commit(),o}recordResult(e){return this.recordPlacement(e?0:1,rt)}markLastMatchSeen(){const e=this.data.economy.lastMatch;!e||e.seen||(e.seen=!0,this.commit())}claimMilestone(e){const a=q0(this.data.economy,e);return a&&this.commit(),a}claimAllMilestones(){const e=Vw(this.data.economy);return this.commit(),e}openContainer(e){const a=Kw(this.data.economy,e);return a&&this.commit(),a}buyContainer(e,a){const o=Zw(this.data.economy,e,a);return o&&this.commit(),o}characterLevel(e){return Fh(this.data.economy,e)}nextLevelPrice(e){return Nh(this.data.economy,e)}canLevelUp(e){return Jw(this.data.economy,e)}levelUp(e){const a=Qw(this.data.economy,e);return a&&this.commit(),a}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}commit(){try{localStorage.setItem(W0,JSON.stringify({name:this.data.name,wins:this.data.wins,losses:this.data.losses,xp:this.data.xp,selected:this.data.selected,economy:t1(this.data.economy)}))}catch{}for(const e of this.listeners)e()}}const s1="fa-screen-styles";function Ea(t,e){if(document.getElementById(t))return;const a=document.createElement("style");a.id=t,a.textContent=e,document.head.appendChild(a)}function i1(){Ea(s1,r1)}function V0(t,e){const a=t.replace("#",""),o=a.length===3?a.split("").map(r=>r+r).join(""):a,n=parseInt(o.slice(0,2),16)||0,s=parseInt(o.slice(2,4),16)||0,i=parseInt(o.slice(4,6),16)||0;return`rgba(${n},${s},${i},${e})`}const r1=`
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
`,l1=1320538,K0="#14265a",h1="#2F66D8",c1="#1F3F86",Jc="#1A2B5E",d1="#2A4C9C",p1="#7E9CCF",u1="#38D6FF",Sn=5,An=14,Er=-.6,f1=[[-.6,.34],[.4,.44],[1.6,.5],[3,.4],[5,.25],[8,.16],[14,.12]],Qc=.42,m1=1.6,g1=new pe(.55,.8,.7).normalize(),w1=45,b1=3,y1=new pe(-.78,.52,-.86).normalize(),x1=3.4,v1=16768174,ed=.85,k1=.8,M1="#5AA6FF",E1=.9,td=2.35,ad=-1.9,od=5,T1=18,S1="#8CC8FF",A1=.16,nd=9.5,R1=.05,I1="#3FA9FF",O1=.42,sd=4.6,C1=1.15,F1=[[0,1],[1.5,.92],[2.6,.66],[3.8,.5],[4.7,.46],[6.4,.4]],Rn=.24,In=.215,id=.62,N1=2.48,L1=.86;function rd(t,e){if(e<=t[0][0])return t[0][1];const a=t[t.length-1];if(e>=a[0])return a[1];for(let o=1;o<t.length;o++){const[n,s]=t[o],[i,r]=t[o-1];if(e>n)continue;const l=(e-i)/Math.max(1e-6,n-i);return r+(s-r)*(l*l*(3-2*l))}return a[1]}function D1(t,e=128){const a=document.createElement("canvas");a.width=e,a.height=e;const o=a.getContext("2d");if(o){const s=o.createRadialGradient(e/2,e/2,0,e/2,e/2,e/2),[i,r,l]=t,h=c=>`rgb(${Math.round(i+(255-i)*c)},${Math.round(r+(255-r)*c)},${Math.round(l+(255-l)*c)})`;s.addColorStop(0,h(0)),s.addColorStop(.54,h(.1)),s.addColorStop(.8,h(.58)),s.addColorStop(1,"rgb(255,255,255)"),o.fillStyle=s,o.fillRect(0,0,e,e)}const n=new st(a);return n.colorSpace=mg,n.wrapS=Kn,n.wrapT=Kn,n}function ld(t,e,a){const o=new X({map:D1(e),blending:u0,blendEquation:gi,blendSrc:zc,blendDst:fg,blendEquationAlpha:gi,blendSrcAlpha:zc,blendDstAlpha:Pl,transparent:!0,depthWrite:!1,toneMapped:!1}),n=new M(new qa(t,t),o);return n.rotation.x=-Math.PI/2,n.renderOrder=a,n.userData.noOutline=!0,n}function Tr(t=0,e=256){const a=document.createElement("canvas");a.width=e,a.height=e;const o=a.getContext("2d");if(o){const s=o.createRadialGradient(e/2,e/2,0,e/2,e/2,e/2);if(s.addColorStop(0,"rgba(255,255,255,0.95)"),s.addColorStop(.22,"rgba(255,255,255,0.62)"),s.addColorStop(.5,"rgba(255,255,255,0.22)"),s.addColorStop(.76,"rgba(255,255,255,0.06)"),s.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=s,o.fillRect(0,0,e,e),t>0){o.globalCompositeOperation="destination-in",o.beginPath();const i=Math.PI*2/t;for(let r=0;r<t;r++){const l=r*i;o.moveTo(e/2,e/2),o.arc(e/2,e/2,e,l,l+i*.42),o.closePath()}o.fill()}}const n=new st(a);return n.colorSpace=is,n.wrapS=Kn,n.wrapT=Kn,n}function hd(t,e,a,o){const n=new Lt({map:t,color:e,opacity:a,blending:tt,transparent:!0,depthTest:!0,depthWrite:!1,fog:!1,toneMapped:!1}),s=new ga(n);return s.renderOrder=o,s.userData.noOutline=!0,s}const ca={counterBody:"#123A50",counterTop:"#A8641F",counterLip:"#D08A2E",shelf:"#7A431A",steel:"#24485C",jars:["#B02733","#4E8A12","#C99414","#1668A8","#6B3AA8","#B85A18","#2E8C6A","#C4553C"]};class vi{stage;holder=document.createElement("div");model=null;currentId=null;subjectW=ae*.8;subjectH=ae;elapsed=0;introT=0;observer=null;footShadow=null;disposed=!1;dressing=null;rays=null;constructor(){this.holder.style.cssText="position:absolute;inset:0;",this.stage=new xh({container:this.holder,background:l1,fog:null,camera:{pitchDeg:20,yawDeg:0,frameMode:"subject",subjectHeight:ae,subjectFill:.6,targetHeight:ae*.52,followLerp:1},budget:"menu",maxPixelRatio:2}),this.stage.canvas.style.cssText="display:block;width:100%;height:100%;",this.buildSet(),this.stage.rig.snapTo(0,0),this.stage.lighting.focus(0,0,6),this.applyPortraitRig()}applyPortraitRig(){const e=this.stage.lighting;e.key.position.copy(g1).multiplyScalar(w1),e.key.target.position.set(0,0,0),e.key.target.updateMatrixWorld(),e.key.intensity=b1,e.rim.position.copy(y1).multiplyScalar(30),e.rim.color.set(v1),e.rim.intensity=x1,e.fill.intensity=k1,e.front.intensity=ed}buildSet(){const e=new Re(Sn,Sn,An,72,28,!0);this.paintVertexRamp(e,(y,x,k)=>{const T=K.clamp(-k/Sn,-1,1),v=Qc+(1-Qc)*((1+T)/2)**m1;return rd(f1,x+An/2+Er)*v});const a=new X({color:h1,vertexColors:!0,fog:!1});a.side=_c;const o=new M(e,a);o.position.y=An/2+Er,o.receiveShadow=!1,o.userData.noOutline=!0,o.name="menu_wall",o.renderOrder=-1,this.stage.scene.add(o);const n=new $a(0,6.4,96,32);this.paintVertexRamp(n,(y,x)=>rd(F1,Math.hypot(y,x)));const s=Je({color:c1,ramp:mt(),roughness:.86,rim:!1});s.vertexColors=!0;const i=new M(n,s);i.rotation.x=-Math.PI/2,i.receiveShadow=!0,i.userData.noOutline=!0,i.name="menu_ground",this.stage.scene.add(i);const r=hd(Tr(0),M1,E1,0);r.position.set(0,td,ad),r.scale.set(od,od,1),r.name="menu_glow",this.stage.scene.add(r);const l=hd(Tr(T1),S1,A1,0);l.position.set(0,td,ad-.01),l.scale.set(nd,nd,1),l.name="menu_glow_rays",this.stage.scene.add(l),this.rays=l;const h=new X({map:Tr(0),color:I1,opacity:O1,blending:tt,transparent:!0,depthWrite:!1,toneMapped:!1}),c=new M(new qa(sd,sd),h);c.rotation.x=-Math.PI/2,c.position.y=.008,c.renderOrder=0,c.userData.noOutline=!0,c.name="menu_ground_pool",this.stage.scene.add(c);const d=ld(5.4,[18,32,160],1);d.position.y=.012,d.name="menu_ground_decal",this.stage.scene.add(d);const p=new M(new Re(1.15,1.24,.18,48),Je({color:Jc,ramp:mt(),roughness:.72}));p.position.y=.09,p.castShadow=!0,p.receiveShadow=!0,p.userData.noOutline=!0,p.name="menu_plinth_body",this.stage.scene.add(p);const u=Je({color:d1,ramp:mt(),roughness:.55});u.emissive=new Kt(u1),u.emissiveIntensity=C1;const m=new M(new Re(1.21,1.19,.06,48,1,!0),u);m.position.y=Rn-.03,m.castShadow=!0,m.receiveShadow=!0,m.userData.noOutline=!0,m.name="menu_plinth_rim",this.stage.scene.add(m);const f=new M(new $a(1.1,1.21,48),u);f.rotation.x=-Math.PI/2,f.position.y=Rn,f.receiveShadow=!0,f.userData.noOutline=!0,f.name="menu_plinth_rim_top",this.stage.scene.add(f);const g=new M(new Re(1.1,1.1,Rn-In,48,1,!0),Je({color:Jc,ramp:mt(),roughness:.8,doubleSide:!0}));g.position.y=(Rn+In)/2,g.receiveShadow=!0,g.userData.noOutline=!0,g.name="menu_plinth_recess",this.stage.scene.add(g);const w=new M(new Re(1.1,1.1,.05,48),Je({color:p1,ramp:mt(),roughness:.45}));w.position.y=In-.025,w.receiveShadow=!0,w.userData.noOutline=!0,w.name="menu_plinth_top",this.stage.scene.add(w);const b=ld(1.9,[58,64,72],2);b.position.y=In+.004,b.scale.set(1,1,.72),b.name="menu_foot_decal",this.footShadow=b,this.stage.scene.add(b)}paintVertexRamp(e,a){const o=e.attributes.position,n=new Float32Array(o.count*3);for(let s=0;s<o.count;s++){const i=a(o.getX(s),o.getY(s),o.getZ(s));n[s*3]=i,n[s*3+1]=i,n[s*3+2]=i}e.setAttribute("color",new Yn(n,3))}applyFraming(){const e=this.stage.rig.camera,a=e.aspect>0&&Number.isFinite(e.aspect)?e.aspect:1,o=Math.max(.5,this.subjectH)+Rn,n=Math.max(.5,this.subjectW,N1),s=L1*a*o/n;this.stage.rig.subjectHeight=o,this.stage.rig.subjectFill=K.clamp(Math.min(id,s),.2,id),this.stage.rig.targetHeight=o*.5,this.stage.rig.apply()}static floorGridTexture(e=256){const a=document.createElement("canvas");a.width=e,a.height=e;const o=a.getContext("2d");o&&(o.clearRect(0,0,e,e),o.strokeStyle="rgba(0,0,0,0.55)",o.lineWidth=e*.055,o.strokeRect(0,0,e,e));const n=new st(a);return n.wrapS=zl,n.wrapT=zl,n.repeat.set(22,22),n.colorSpace=is,n}buildDressing(){const e=new he;e.name="lobby_dressing";const a=(m,f=!1)=>(m.castShadow=f,m.receiveShadow=!0,m.userData.noOutline=!0,e.add(m),m),o=-3.35,n=7.2,s=.78,i=new M(new qa(13,13),new X({map:vi.floorGridTexture(),transparent:!0,depthWrite:!1,toneMapped:!1}));i.rotation.x=-Math.PI/2,i.position.y=.006,i.renderOrder=0,i.userData.noOutline=!0,i.name="lobby_floor_grid",e.add(i);const r=vi.floorGridTexture();r.repeat.set(26,9);const l=new M(new Re(Sn-.04,Sn-.04,An,72,1,!0),new X({map:r,side:_c,transparent:!0,depthWrite:!1,toneMapped:!1}));l.position.y=An/2+Er,l.renderOrder=0,l.userData.noOutline=!0,l.name="lobby_wall_grid",e.add(l),a(new M(new xt(n,s,.72),Je({color:ca.counterBody,ramp:mt(),roughness:.8})),!0).position.set(0,s/2,o),a(new M(new xt(n+.12,.11,.84),Je({color:ca.counterTop,ramp:mt(),roughness:.5}))).position.set(0,s+.055,o),a(new M(new xt(n+.12,.045,.06),Je({color:ca.counterLip,ramp:mt(),roughness:.4}))).position.set(0,s+.012,o+.44),a(new M(new xt(n-.4,.13,.52),Je({color:ca.shelf,ramp:mt(),roughness:.75}))).position.set(0,2.15,o-.05);for(const m of[-2.6,2.6])a(new M(new xt(.1,.36,.1),Je({color:ca.steel,ramp:mt(),roughness:.7}))).position.set(m,2.31,o-.2);const h=new Re(.19,.21,.44,20),c=new Re(.21,.21,.07,20),d=Je({color:ca.steel,ramp:mt(),roughness:.45}),p=[-2.95,-2.25,-1.55,1.55,2.25,2.95,-2.6,2.6],u=[2.35,2.35,2.35,2.35,2.35,2.35,.9,.9];for(let m=0;m<p.length;m++){const f=.86+m*37%5*.09,g=u[m]+.22*f;a(new M(h,Je({color:ca.jars[m],ramp:mt(),roughness:.55}))).position.set(p[m],g,o-.02),e.children[e.children.length-1].scale.setScalar(f),a(new M(c,d)).position.set(p[m],g+.25*f,o-.02),e.children[e.children.length-1].scale.setScalar(f)}for(const m of[-1.95,1.95])a(new M(new Re(.4,.36,.46,24),Je({color:ca.steel,ramp:mt(),roughness:.35}))).position.set(m,s+.34,o-.02),a(new M(new Re(.44,.44,.06,24),Je({color:ca.counterLip,ramp:mt(),roughness:.3}))).position.set(m,s+.6,o-.02);return e}setScene(e){this.disposed||(e==="lobby"&&!this.dressing&&(this.dressing=this.buildDressing(),this.stage.scene.add(this.dressing)),this.dressing&&(this.dressing.visible=e==="lobby"))}attachTo(e){this.disposed||(this.holder.parentElement!==e&&e.appendChild(this.holder),this.observer?.disconnect(),this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(e),this.resize())}detach(){this.observer?.disconnect(),this.observer=null,this.holder.remove()}show(e){if(this.disposed||e===this.currentId)return;this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose()),this.model=vh(e),this.model.play("idle"),this.stage.scene.add(this.model.root);const a=new Vn().setFromObject(this.model.root);if(this.subjectH=Math.max(.5,a.max.y-a.min.y),this.subjectW=2*Math.max(.25,Math.abs(a.min.x),Math.abs(a.max.x),Math.abs(a.min.z),Math.abs(a.max.z)),this.model.root.position.y=In+.005-a.min.y,this.footShadow){const o=K.clamp(Math.max(a.max.x-a.min.x,a.max.z-a.min.z)*1.15,1,2.3);this.footShadow.scale.set(o/1.9,1,o/1.9*.72)}this.currentId=e,this.introT=.34,this.applyFraming()}poke(){this.model?.play("attack")}update(e){if(!this.disposed){if(this.elapsed+=e,this.stage.rig.yawDeg=Math.sin(this.elapsed*.42)*22,this.model){if(this.introT>0){this.introT=Math.max(0,this.introT-e);const a=1-this.introT/.34,o=Math.sin(a*Math.PI)*(1-a*.4);this.model.root.scale.setScalar(1+o*.16),this.model.root.rotation.y=(1-a)*-.9}else this.model.root.scale.setScalar(1),this.model.root.rotation.y=0;this.model.update({dt:e,elapsed:this.elapsed,moveSpeed01:0,health01:1})}this.rays&&(this.rays.material.rotation=this.elapsed*R1),this.stage.lighting.front.intensity=ed,this.stage.render(e)}}resize(){this.disposed||(this.stage.resize(),this.applyFraming())}info(){const e=this.stage.rig.camera,a=this.model?new Vn().setFromObject(this.model.root):null,o=s=>{const i=s.clone().project(e);return{x:+(i.x*.5+.5).toFixed(3),y:+(1-(i.y*.5+.5)).toFixed(3)}},n=this.stage.rig;return{id:this.currentId,aspect:+e.aspect.toFixed(3),fill:+n.subjectFill.toFixed(3),subject:{w:+this.subjectW.toFixed(2),h:+this.subjectH.toFixed(2)},cameraOk:Number.isFinite(e.position.x)&&Number.isFinite(e.position.y),feet:a?o(new pe(0,a.min.y,0)):null,crown:a?o(new pe(0,a.max.y,0)):null,left:a?o(new pe(a.min.x,(a.min.y+a.max.y)/2,0)):null,right:a?o(new pe(a.max.x,(a.min.y+a.max.y)/2,0)):null}}dispose(){if(!this.disposed){if(this.disposed=!0,this.observer?.disconnect(),this.observer=null,this.dressing){const e=new Set,a=new Set;this.dressing.traverse(o=>{const n=o;if(n.geometry&&e.add(n.geometry),n.material)for(const s of Array.isArray(n.material)?n.material:[n.material])a.add(s)}),e.forEach(o=>o.dispose()),a.forEach(o=>o.dispose()),this.stage.scene.remove(this.dressing),this.dressing=null}this.model&&(this.stage.scene.remove(this.model.root),this.model.dispose(),this.model=null),this.stage.dispose(),this.holder.remove()}}}let Go=null;function Lh(){return Go||(Go=new vi,typeof window<"u"&&(window.__charStage=()=>Go?.info()??null)),Go}function cd(){Go?.dispose(),Go=null}const Sr=1e-4,H1=2e4;function Dh(t){let e=t|0||2654435769;return()=>(e^=e<<13,e^=e>>>17,e^=e<<5,(e>>>0)/4294967296)}function Me(t,e,a){return e+t()*(a-e)}function ce(t,e){return Math.pow(2,Me(t,-e,e)/1200)}const dd=new WeakMap;function _1(t){const e=dd.get(t);if(e)return e;const a=Math.floor(t.sampleRate*2),o=t.createBuffer(1,a,t.sampleRate),n=o.getChannelData(0),s=Dh(6221086);for(let i=0;i<a;i++)n[i]=s()*2-1;return dd.set(t,o),o}const pd=new WeakMap;function z1(t,e){let a=pd.get(t);a||(a=new Map,pd.set(t,a));const o=Math.max(.05,Math.round(e*20)/20),n=a.get(o);if(n)return n;const s=1024,i=new Float32Array(s),r=Math.tanh(o);for(let l=0;l<s;l++){const h=l/(s-1)*2-1;i[l]=Math.tanh(o*h)/r}return a.set(o,i),i}function X0(t,e){const a=t.createWaveShaper();return a.curve=z1(t,e),a.oversample="2x",a}const P1=.26,$1=.19,ud=new WeakMap;function B1(t){const e=ud.get(t);if(e)return e;const a=t.sampleRate,o=Math.floor(a*P1),n=t.createBuffer(2,o,a),s=Math.floor(a*.005),i=6.9078/($1*a);for(let h=0;h<2;h++){const c=n.getChannelData(h),d=Dh(h===0?1990433:7840721);let p=0;for(let m=s;m<o;m++){const f=m-s,g=.3+.42*(f/(o-s)),w=d()*2-1;p=p*g+w*(1-g),c[m]=p*Math.exp(-i*f)}const u=h===0?[.0071,.0132,.0198,.0281,.0367,.0458]:[.0083,.0119,.0214,.0263,.0389,.0441];for(let m=0;m<u.length;m++){const f=s+Math.floor(u[m]*a);if(f>=o)continue;const g=m%2===0?1:-1;c[f]+=g*.62*Math.exp(-i*(f-s)*.55)}}let r=0;for(let h=0;h<2;h++){const c=n.getChannelData(h);for(let d=0;d<o;d++)r=Math.max(r,Math.abs(c[d]))}const l=r>0?.6/r:1;for(let h=0;h<2;h++){const c=n.getChannelData(h);for(let d=0;d<o;d++)c[d]*=l}return ud.set(t,n),n}function U1(t){const e=t.createConvolver();return e.normalize=!1,e.buffer=B1(t),e}function Z0(t,e,a){if(!t.wet||!(a>0))return;const o=t.ctx.createGain();o.gain.value=a,e.connect(o),o.connect(t.wet)}function J0(t,e,a){const o=t.createGain(),n=Math.max(5e-4,a.attack??.002),s=(a.duration-n)*Math.max(0,Math.min(.9,a.hold??0)),i=Math.max(Sr*2,a.peak),r=e+a.duration;return o.gain.setValueAtTime(Sr,e),o.gain.linearRampToValueAtTime(i,e+n),s>0&&o.gain.setValueAtTime(i,e+n+s),(a.curve??"exp")==="exp"?o.gain.exponentialRampToValueAtTime(Sr,r):o.gain.linearRampToValueAtTime(0,r),o.gain.setValueAtTime(0,r+.001),o}function jo(t,e,a,o,n="exp"){if(typeof e=="number"){t.setValueAtTime(e,a);return}const[s,i]=e;t.setValueAtTime(s,a),n==="exp"&&s>0&&i>0?t.exponentialRampToValueAtTime(i,a+o):t.linearRampToValueAtTime(i,a+o)}function G(t,e){const{ctx:a,dest:o,when:n}=t,s=a.createBufferSource(),i=_1(a);s.buffer=i,s.playbackRate.value=e.rate??1,e.loop&&(s.loop=!0,s.loopStart=0,s.loopEnd=i.duration);const r=Math.max(0,i.duration-(e.duration+.02)),l=e.loop?Me(t.rng,0,i.duration):Me(t.rng,0,Math.min(1.5,r)),h=J0(a,n,e),c=e.tremolo?q1(a,n,e.duration,e.tremolo.rate,e.tremolo.depth):h;c!==h&&c.connect(h);const d=e.drive?X0(a,e.drive):c;if(d!==c&&d.connect(c),e.filter){const p=u=>{const m=a.createBiquadFilter();return m.type=e.filter,m.Q.value=u,jo(m.frequency,e.freq??1e3,n,e.duration,e.freqCurve??"exp"),m};if(e.poles===24){const u=Math.sqrt(Math.max(.1,e.q??1));s.connect(p(u)).connect(p(u)).connect(d)}else s.connect(p(e.q??1)).connect(d)}else s.connect(d);return h.connect(o),Z0(t,h,e.wet??0),s.start(n,l,e.duration+.02),s.stop(n+e.duration+.02),e.duration}function J(t,e){const{ctx:a,dest:o,when:n}=t,s=J0(a,n,e);let i=s;if(e.ring!==void 0){const h=a.createGain();h.gain.value=0;const c=a.createOscillator();c.type="sine",jo(c.frequency,e.ring,n,e.duration,"exp"),c.connect(h.gain),c.start(n),c.stop(n+e.duration+.02),h.connect(s),i=h}if(e.drive){const h=X0(a,e.drive);h.connect(i),i=h}if(e.lowpass!==void 0){const h=a.createBiquadFilter();h.type="lowpass",h.Q.value=.7,jo(h.frequency,e.lowpass,n,e.duration),h.connect(i),i=h}const r=Math.max(1,Math.min(3,Math.round(e.voices??1))),l=e.detuneCents??0;for(let h=0;h<r;h++){const c=a.createOscillator();c.type=e.type??"sine";const d=r===1?0:(h/(r-1)-.5)*l,p=Math.pow(2,d/1200);if(typeof e.freq=="number"?jo(c.frequency,e.freq*p,n,e.duration,e.freqCurve??"exp"):jo(c.frequency,[e.freq[0]*p,e.freq[1]*p],n,e.duration,e.freqCurve??"exp"),r>1){const u=a.createGain();u.gain.value=1/r,c.connect(u).connect(i)}else c.connect(i);c.start(n),c.stop(n+e.duration+.02)}return s.connect(o),Z0(t,s,e.wet??0),e.duration}function Ji(t,e){let a=0;for(const o of e.modes){const n=e.duration*o.decay,s=typeof e.freq=="number"?e.freq*o.ratio:[e.freq[0]*o.ratio,e.freq[1]*o.ratio];(typeof s=="number"?s:Math.max(s[0],s[1]))>H1||(a=Math.max(a,n),J(t,{type:"sine",freq:s,peak:e.peak*o.gain,attack:e.attack??.0015,duration:n,drive:e.drive,wet:e.wet}))}return a}function q1(t,e,a,o,n){const s=Math.max(0,Math.min(1,n)),i=t.createGain();i.gain.value=1-s*.5;const r=t.createOscillator();r.type="sine",jo(r.frequency,o,e,a,"lin");const l=t.createGain();return l.gain.value=s*.5,r.connect(l),l.connect(i.gain),r.start(e),r.stop(e+a+.02),i}function Se(t,e){const a=e.freq??5e3,o=G(t,{filter:"highpass",freq:a,q:.9,peak:e.peak,attack:4e-4,duration:.007,wet:e.wet??.06});if(!e.snap)return o;const n=(e.snapMs??14)/1e3,s=J(t,{type:"triangle",freq:[e.snap,e.snap*.38],peak:e.peak*.72,attack:6e-4,duration:n,drive:2.2,wet:e.wet??.06});return Y(o,s)}function je(t,e){const[a,o]=e.grainMs??[4,11],n=e.decay??.35,s=e.freqShift;for(let i=0;i<e.count;i++){const r=Math.pow(t.rng(),1.5)*e.spread,l=Me(t.rng,a,o)/1e3,h=e.peak*(1-r/e.spread*(1-n))*Me(t.rng,.55,1),c=s?s[0]+(s[1]-s[0])*(r/e.spread):1;G({...t,when:t.when+r},{filter:"bandpass",freq:Me(t.rng,e.freq[0],e.freq[1])*c,q:e.q??6,peak:h,attack:8e-4,duration:l,drive:e.drive,wet:e.wet})}return e.spread+o/1e3}function Pn(t,e){const a=e.rise??2.6;let o=0;for(let n=0;n<e.count;n++){const s=Me(t.rng,0,e.spread),i=Me(t.rng,e.freq[0],e.freq[1]),r=Me(t.rng,.045,.095);o=Math.max(o,s+r),J({...t,when:t.when+s},{type:"sine",freq:[i,i*a],peak:e.peak*Me(t.rng,.5,1),attack:.002,duration:r,wet:e.wet})}return o}function ki(t,e){const[a,o]=e.pingMs??[7,18],n=e.bend??.92,s=Math.log2(e.freq[0]),i=Math.log2(e.freq[1]);let r=0;for(let l=0;l<e.count;l++){const h=Math.pow(t.rng(),1.6)*e.spread,c=Math.pow(2,s+(t.rng()+l*.6180339887)%1*(i-s)),d=Me(t.rng,a,o)/1e3;r=Math.max(r,h+d),J({...t,when:t.when+h},{type:"sine",freq:[c,c*n],peak:e.peak*Me(t.rng,.55,1),attack:6e-4,duration:d,wet:e.wet})}return r}function Hh(t,e){const[a,o]=e.freq??[9e3,3200],n=e.duration??.11,s=e.wet??.3,i=G(t,{filter:"bandpass",freq:[a*ce(t.rng,90),o*ce(t.rng,90)],q:.7,peak:e.peak,attack:.0012,duration:n,wet:s}),r=G(t,{filter:"highpass",poles:24,freq:[a*.8,a*.45],q:.7,peak:e.peak*.55,attack:6e-4,duration:n*.55,wet:s}),l=e.drops??6,h=l>0?je(t,{count:l,spread:n*.85,grainMs:[3,9],freq:[o,a],q:5,peak:e.peak*.85,decay:.25,wet:s}):0;return Y(i,r,h)}function Y(...t){let e=0;for(const a of t)a>e&&(e=a);return e}const fd="fa.audio.volume",md="fa.audio.muted",W1=.62,G1=20,j1=.008,Qe={Ambient:0,Normal:1,Critical:2},Y1=.11,gd=[1,.62,.42,.3,.22],V1=.5,On=.7,wd=1.2,Q0=3,bd=new WeakMap;function K1(t){const e=bd.get(t);if(e)return e;const a=2048,o=new Float32Array(a);for(let n=0;n<a;n++){const s=(n/(a-1)*2-1)*Q0,i=Math.abs(s),r=i<=On?i:On+(wd-On)*Math.tanh((i-On)/(wd-On));o[n]=Math.sign(s)*r}return bd.set(t,o),o}function X1(t,e,a=!0){const o=t.createGain();o.gain.value=1;let n=null;if(a)try{n=t.createGain(),n.gain.value=1;const l=t.createGain();l.gain.value=V1,n.connect(U1(t)).connect(l).connect(o)}catch{n=null}const s=t.createGain();s.gain.value=1/Q0;const i=t.createWaveShaper();i.curve=K1(t),i.oversample="2x";const r=t.createGain();return r.gain.value=0,o.connect(s).connect(i).connect(r).connect(e??t.destination),{input:o,wetIn:n,limiter:i,master:r}}function Z1(t){const e=Math.max(0,Math.min(1,t));return Math.pow(e,1.8)*W1}function J1(){const t=typeof navigator<"u"?navigator.userActivation:void 0;return t===void 0||t.isActive===!0}class Q1{ctx=null;chain=null;state="idle";failure=null;volume=.8;muted=!1;maxVoices;persist;reverb;injected;injectedDestination;offline;voices=[];retrigger=new Map;listeners=new Set;virtualTime=0;counters={started:0,droppedBudget:0,droppedThrottle:0,droppedNotRunning:0};analyser=null;gestureBound=!1;constructor(e={}){this.maxVoices=e.maxVoices??G1,this.persist=e.persist??!0,this.reverb=e.reverb??!0,this.injected=e.context??null,this.injectedDestination=e.destination??null,this.offline=!!this.injected&&typeof OfflineAudioContext<"u"&&this.injected instanceof OfflineAudioContext,this.loadSettings(),this.injected?(this.attachContext(this.injected),this.offline&&(this.state="running")):(this.bindGestureUnlock(),this.bindVisibility())}setVolume(e){this.volume=Math.max(0,Math.min(1,Number.isFinite(e)?e:0)),this.applyMasterGain(.02),this.saveSettings(),this.emit()}getVolume(){return this.volume}setMuted(e){this.muted=!!e,this.applyMasterGain(.015),this.saveSettings(),this.emit()}isMuted(){return this.muted}toggleMuted(){return this.setMuted(!this.muted),this.muted}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}getState(){return this.state}getFailure(){return this.failure}activeVoices(){return this.prune(this.now()),this.voices.length}unlock(){if(this.state==="failed"||this.offline||!this.ctx&&!J1())return;const e=this.ensureContext();e&&(typeof e.resume=="function"&&e.state!=="running"&&e.resume().then(()=>this.syncState(),()=>this.syncState()),this.syncState())}bindGestureUnlock(){if(this.gestureBound||typeof window>"u")return;this.gestureBound=!0;const e=["pointerdown","touchend","keydown","click"],a=()=>{if(this.unlock(),this.state==="running"||this.state==="failed")for(const o of e)window.removeEventListener(o,a,!0)};for(const o of e)window.addEventListener(o,a,!0)}bindVisibility(){typeof document>"u"||document.addEventListener("visibilitychange",()=>{const e=this.ctx;if(!(!e||typeof e.suspend!="function")){try{document.hidden?e.suspend().catch(()=>{}):this.state!=="idle"&&e.resume().catch(()=>{})}catch{}this.syncState()}})}ensureContext(){if(this.ctx)return this.ctx;if(this.state==="failed")return null;try{const e=typeof AudioContext<"u"?AudioContext:globalThis.webkitAudioContext;if(!e)return this.fail("Web Audio API unavailable"),null;const a=new e({latencyHint:"interactive"});return this.attachContext(a),a}catch(e){return this.fail(String(e)),null}}attachContext(e){this.ctx=e;try{this.chain=X1(e,this.injectedDestination??void 0,this.reverb),this.applyMasterGain(0),this.syncState()}catch(a){this.fail(String(a))}}syncState(){if(this.state==="failed")return;const e=this.state;this.ctx?this.offline?this.state="running":this.state=this.ctx.state==="running"?"running":"suspended":this.state="idle",e!==this.state&&this.emit()}fail(e){this.state="failed",this.failure=e,console.warn("[audio] disabled:",e),this.emit()}play(e,a={}){try{return this.playInner(e,a)}catch(o){return this.failure||(this.failure=String(o),console.warn("[audio] sound failed:",o)),!1}}playInner(e,a){if(this.state==="failed")return!1;if(this.state!=="running"||!this.ctx||!this.chain)return this.counters.droppedNotRunning++,!1;const o=this.now();this.prune(o);const n=a.priority??Qe.Normal;let s=1,i=1;if(a.key){const y=this.retrigger.get(a.key),x=y&&o-y.at<Y1?y.count+1:0;if(this.retrigger.set(a.key,{at:o,count:x}),x>=gd.length)return this.counters.droppedThrottle++,!1;s=gd[x],i=1+x*.045}if(this.voices.length>=this.maxVoices){if(n<Qe.Critical&&!this.steal(n))return this.counters.droppedBudget++,!1;n>=Qe.Critical&&this.voices.length>=this.maxVoices&&this.steal(Qe.Critical)}const r=this.ctx,l=Math.max(o,r.currentTime)+j1+(a.delay??0),h=Math.max(0,(a.gain??1)*s),c=r.createGain();c.gain.value=h;const d=a.pan!==void 0&&typeof r.createStereoPanner=="function",p=Math.max(-1,Math.min(1,a.pan??0));let u=c;if(d){const y=r.createStereoPanner();y.pan.value=p,c.connect(y),u=y}u.connect(this.chain.input);let m=null;if(this.chain.wetIn)if(m=r.createGain(),m.gain.value=h,d){const y=r.createStereoPanner();y.pan.value=p,m.connect(y).connect(this.chain.wetIn)}else m.connect(this.chain.wetIn);const f=Dh(a.seed??Math.random()*4294967295|0),g={ctx:r,dest:c,wet:m??void 0,when:l,rng:f};let w=0;try{w=e(g)||0}catch(y){throw c.disconnect(),m?.disconnect(),y}const b=l+w/i+.05;if(this.voices.push({node:c,wet:m,end:b,priority:n}),this.counters.started++,!this.offline){const y=Math.max(30,(b-r.currentTime)*1e3+40);setTimeout(()=>this.prune(this.now()),y)}return!0}steal(e){let a=-1;for(let n=0;n<this.voices.length;n++)if(this.voices[n].priority<e){a=n;break}if(a<0)return!1;const[o]=this.voices.splice(a,1);return this.release(o),!0}prune(e){for(let a=this.voices.length-1;a>=0;a--)if(this.voices[a].end<=e){const[o]=this.voices.splice(a,1);this.release(o)}if(this.retrigger.size>64)for(const[a,o]of this.retrigger)e-o.at>1&&this.retrigger.delete(a)}release(e){try{e.node.gain.cancelScheduledValues(0),e.node.gain.value=0,e.node.disconnect()}catch{}if(e.wet)try{e.wet.gain.cancelScheduledValues(0),e.wet.gain.value=0,e.wet.disconnect()}catch{}}now(){return this.ctx?Math.max(this.ctx.currentTime,this.virtualTime):this.virtualTime}setVirtualTime(e){this.virtualTime=e,this.prune(e)}tap(){if(!this.ctx||!this.chain)return null;if(this.analyser)return this.analyser;try{const e=this.ctx.createAnalyser();return e.fftSize=2048,e.smoothingTimeConstant=0,this.chain.master.connect(e),this.analyser=e,e}catch{return null}}connectTap(e){if(!this.ctx||!this.chain)return!1;try{return this.chain.master.connect(e),!0}catch{return!1}}get context(){return this.ctx}get busInput(){return this.chain?.input??null}applyMasterGain(e){if(!this.chain||!this.ctx)return;const a=this.muted?0:Z1(this.volume),o=this.chain.master.gain;try{if(e>0&&!this.offline){const n=this.ctx.currentTime;o.cancelScheduledValues(n),o.setValueAtTime(o.value,n),o.linearRampToValueAtTime(a,n+e)}else o.cancelScheduledValues(0),o.value=a}catch{o.value=a}}loadSettings(){if(!(!this.persist||typeof localStorage>"u"))try{const e=localStorage.getItem(fd);if(e!==null){const a=Number(e);Number.isFinite(a)&&(this.volume=Math.max(0,Math.min(1,a)))}this.muted=localStorage.getItem(md)==="1"}catch{}}saveSettings(){if(!(!this.persist||typeof localStorage>"u"))try{localStorage.setItem(fd,String(this.volume)),localStorage.setItem(md,this.muted?"1":"0")}catch{}}emit(){for(const e of this.listeners)try{e()}catch{}}}const Ce=0;function qe(t){const e=t.fighters;return Array.isArray(e)&&e.length>0?e:[t.player,t.enemy].filter(Boolean)}function Be(t){return qe(t)[Ce]??t.player}function vt(t,e,a){if(typeof e=="number"){const o=qe(t)[e];if(o)return o}return t[a]}function $n(t,e,a){return vt(t,e.attackerId,T0(a))}function yd(t,e){return vt(t,e.ownerId,e.ownerRole)}function Wt(t,e){return typeof t=="number"?t:e==="player"?0:1}function eb(t){return t===0?"player":t===1?"enemy":`slot${t}`}function tb(t){const{seats:e,center:a,eliminated:o,winnerId:n}=t,s=g=>e.find(w=>w.id===g),i=g=>g.maxHp>0?g.hp/g.maxHp:0,r=g=>Math.hypot(g.x-a.x,g.y-a.y),l=(g,w)=>{const b=i(g),y=i(w);if(b!==y)return y-b;const x=r(g),k=r(w);return x!==k?x-k:g.deaths!==w.deaths?g.deaths-w.deaths:g.id-w.id},h=e.filter(g=>g.alive&&g.hp>0).slice().sort(l).map(g=>g.id),c=new Set(h),d=new Map;o.forEach((g,w)=>{s(g)!==void 0&&d.set(g,w)});const p=[...d.keys()].filter(g=>!c.has(g)).sort((g,w)=>{const b=d.get(g)??-1,y=d.get(w)??-1;if(b!==y)return y-b;const x=s(g),k=s(w);return x&&k&&x.deaths!==k.deaths?x.deaths-k.deaths:g-w}),u=new Set([...h,...p]),m=e.filter(g=>!u.has(g.id)).slice().sort((g,w)=>g.deaths!==w.deaths?g.deaths-w.deaths:g.id-w.id).map(g=>g.id),f=[...h,...p,...m];return n!==null&&f[0]!==n&&s(n)!==void 0?[n,...f.filter(g=>g!==n)]:f}function ab(t,e,a){if(!(t>e))return 1;if(t>=a)return 0;const o=a-e,n=(t-e)/o;return 1-n*n*(3-2*n)}const ob=200,nb=900,Ar=.02;function _h(t){return Math.max(0,Math.min(1,(t-2)/16))}function sb(t){const e=_h(t);return a=>{const o=ce(a.rng,70),n=G(a,{filter:"bandpass",freq:[2600*o,620*o],q:1.1,peak:.26+e*.12,attack:.006,duration:.13,drive:1.5,wet:.14}),s=J(a,{type:"sine",freq:[440*o,170*o],peak:.16+e*.12,attack:.004,duration:.11,drive:1.9,voices:2,detuneCents:14,wet:.1});return Y(n,s)}}function ib(t,e){const a=_h(t),o=Math.min(1,e/180);return n=>{const s=ce(n.rng,55),i=.2+o*.1,r=G(n,{filter:"bandpass",freq:[420*s,(1900-o*600)*s],q:2.2,peak:.44+a*.2,attack:.05+o*.03,hold:.12,duration:i,drive:1.6,wet:.2}),l=J(n,{type:"sawtooth",freq:[200*s,88*s],lowpass:[900,300],peak:.2+a*.12,attack:.02,duration:i*.8,drive:1.8,voices:2,detuneCents:18,wet:.12});return Y(r,l)}}function rb(){const t=[523.25,659.25,783.99];return e=>{const a=ce(e.rng,25);t.forEach((n,s)=>{J({...e,when:e.when+s*.06},{type:"triangle",freq:n*a,peak:.2,attack:.012,hold:.2,duration:.3,voices:2,detuneCents:9,wet:.42})});const o=G(e,{filter:"highpass",freq:[3e3,7e3],q:.8,peak:.07,attack:.08,duration:.42,wet:.5});return Y(.3+t.length*.06,o)}}function lb(){return t=>{const e=ce(t.rng,30),a=J(t,{type:"sine",freq:[130*e,30*e],peak:.9,attack:.004,hold:.08,duration:.78,drive:3.4,voices:3,detuneCents:22,wet:.3}),o=G(t,{filter:"lowpass",freq:[2200,140],q:1.4,peak:.55,attack:.01,duration:.62,drive:2.2,wet:.34}),n=Se(t,{peak:.62,freq:3e3,snap:1900,snapMs:26}),s=je(t,{count:10,spread:.42,freq:[900,4200],peak:.16,q:5,wet:.4});return Y(a,o,n,s)}}function hb(t){const e=_h(t);return a=>{const o=ce(a.rng,60),n=Se(a,{peak:.66-e*.14,freq:3900-e*1100,snap:2700-e*800,snapMs:11+e*7}),s=J(a,{type:"sine",freq:[(230-e*80)*o,(62-e*22)*o],peak:.48+e*.34,attack:.0018,duration:.11+e*.22,drive:2+e*1.5,voices:2,detuneCents:16,wet:.16}),i=e>.12?J(a,{type:"sine",freq:[(118-e*38)*o,(44-e*12)*o],peak:.14+e*.38,attack:.004,duration:.1+e*.2,drive:1.5,wet:.1}):0,r=G(a,{filter:"bandpass",freq:[1700*o,470*o],q:1.5,peak:.24+e*.2,attack:.0012,duration:.07+e*.1,drive:1.9,wet:.22}),l=G(a,{filter:"bandpass",freq:[1900,640],q:.9,peak:.05+e*.05,attack:.018,duration:.16+e*.22,wet:.6}),h=Hh(a,{peak:.1+(1-e)*.06,freq:[8600-e*2200,3400-e*900],duration:.06+e*.05,drops:5,wet:.28});return Y(n,s,i,r,l,h)}}function cb(t){const e=t<.3;return a=>{const o=ce(a.rng,45),n=Me(a.rng,.9,1.15),s=Me(a.rng,285,360),i=J(a,{type:"sawtooth",freq:[s*o,s*o*.4],lowpass:[Me(a.rng,1180,1620),260],peak:.3,attack:.004,duration:(e?.34:.22)*n,drive:Me(a.rng,2.1,2.8),voices:2,detuneCents:20,wet:.18}),r=Me(a.rng,830,1150),l=G(a,{filter:"lowpass",poles:24,freq:[r,190],q:.9,peak:.2,attack:.002,duration:.16*n,drive:1.6,wet:.24}),h=Se(a,{peak:.2,freq:3600,wet:.16}),c=je(a,{count:4,spread:.03,grainMs:[3,8],freq:[Me(a.rng,2700,3400),Me(a.rng,6e3,9e3)],q:4,peak:.24,decay:.3,wet:.2}),d=Hh(a,{peak:.13,freq:[Me(a.rng,7600,9400),Me(a.rng,2800,3600)],duration:Me(a.rng,.05,.08),drops:5,wet:.26}),p=e?J(a,{type:"sine",freq:[Me(a.rng,88,104),32],peak:.55,attack:.006,duration:.3*n,drive:2.6,wet:.16}):0;return Y(i,l,h,c,d,p)}}function db(){return t=>{const e=ce(t.rng,30),a=Se(t,{peak:.2,freq:5400,snap:3800,snapMs:6}),o=J(t,{type:"triangle",freq:[620*e,1560*e],ring:[132,96],peak:.34,attack:.022,duration:.26,wet:.34}),n=J(t,{type:"sine",freq:[1880*e,2520*e],peak:.1,attack:.03,duration:.34,wet:.55});return Y(a,o,n)}}function pb(){return t=>{const e=ce(t.rng,40),a=J(t,{type:"sawtooth",freq:[440*e,58*e],lowpass:[2600,240],peak:.42,attack:.006,duration:.6,drive:2.2,voices:2,detuneCents:24,wet:.26}),o=G(t,{filter:"lowpass",freq:[3200,200],q:1.1,peak:.34,attack:.004,duration:.44,drive:1.5,wet:.4}),n=J(t,{type:"sine",freq:[150*e,30*e],peak:.7,attack:.003,duration:.42,drive:3,voices:2,detuneCents:14,wet:.2});return Y(a,o,n)}}function ub(){const t=[392,523.25,659.25];return e=>{const a=ce(e.rng,20);return t.forEach((o,n)=>{J({...e,when:e.when+n*.05},{type:"triangle",freq:o*a,peak:.26,attack:.01,duration:.24,voices:2,detuneCents:8,wet:.34})}),.24+t.length*.05}}function xd(){return t=>{const e=G(t,{filter:"lowpass",poles:24,freq:[420,110],q:1.2,peak:.34,attack:.05,duration:.4,drive:2,wet:.35}),a=G(t,{filter:"bandpass",freq:[1400,2600],q:.7,peak:.1,attack:.08,duration:.42,wet:.55});return Y(e,a)}}const fb=2.1,ef=1.5,Rr=.55;function mb(){return t=>{const e=fb,a={attack:Rr,hold:(ef-Rr)/(e-Rr),duration:e},o=J(t,{type:"sine",freq:118*ce(t.rng,25),peak:.026,voices:3,detuneCents:26,drive:1.6,...a,wet:.25}),n=G(t,{filter:"bandpass",freq:[Me(t.rng,900,1500),Me(t.rng,1700,2500)],q:.45,peak:.055,loop:!0,tremolo:{rate:[.55,.85],depth:.3},...a,wet:.4}),s=G(t,{filter:"highpass",poles:24,freq:[6400,8200],q:.7,peak:.009,loop:!0,...a,wet:.5}),i=Me(t.rng,.3,e-.6),r={...t,when:t.when+i},l=Math.floor(t.rng()*4);let h=0;if(l===0)h=Ji(r,{freq:Me(t.rng,620,980),duration:.42,peak:.085,attack:.0015,wet:.62,modes:[{ratio:1,gain:1,decay:1},{ratio:2.71,gain:.6,decay:.5},{ratio:4.63,gain:.34,decay:.3}]});else if(l===1){const c=Se(r,{peak:.1,freq:3400,snap:900,snapMs:14,wet:.5}),d=Me(t.rng,.11,.19),p=Se({...r,when:r.when+d},{peak:.075,freq:3100,snap:820,snapMs:12,wet:.5});h=Y(c,d+p)}else l===2?h=G(r,{filter:"bandpass",freq:[Me(t.rng,2800,3600),Me(t.rng,5600,7400)],q:.8,peak:.04,attack:.09,duration:.55,wet:.7}):h=ki(r,{count:3,spread:.16,freq:[4200,11e3],peak:.022,pingMs:[8,20],bend:.94,wet:.6});return Y(o,n,s,i+h)}}function gb(){return t=>{const e=G(t,{filter:"highpass",freq:[2600,5200],q:.8,peak:.18,attack:.01,duration:.26,wet:.3}),a=je(t,{count:4,spread:.2,freq:[2500,6e3],peak:.1,q:7,wet:.35});return Y(e,a)}}function wb(){return t=>{const e=G(t,{filter:"lowpass",freq:[1400,260],q:3.2,peak:.2,attack:.008,duration:.15,drive:1.8,wet:.2}),a=J(t,{type:"sine",freq:[180,84],peak:.14,duration:.11,drive:2.2,wet:.14});return Y(e,a)}}function bb(){return t=>{const e=ce(t.rng,90),a=Se(t,{peak:.26,freq:2400,snap:1200,snapMs:8}),o=J(t,{type:"sine",freq:[150*e,66*e],peak:.22,duration:.09,drive:2,wet:.24});return Y(o,a)}}function yb(t){const e=[523.25,587.33,659.25,698.46,783.99],a=e[Math.max(0,Math.min(e.length-1,5-t))];return o=>{const n=J(o,{type:"triangle",freq:a,peak:.34,attack:.004,hold:.25,duration:.16,voices:2,detuneCents:7,wet:.3}),s=G(o,{filter:"highpass",freq:3800,peak:.12,duration:.015,wet:.12});return Y(n,s)}}function xb(){const t=[523.25,659.25,1046.5];return e=>{t.forEach((o,n)=>{J({...e,when:e.when+n*.07},{type:"square",freq:o,lowpass:[3200,1800],peak:.22,attack:.006,hold:.3,duration:.34,voices:2,detuneCents:10,wet:.3})});const a=G(e,{filter:"bandpass",freq:[500,4e3],q:.9,peak:.16,attack:.14,duration:.2,wet:.35});return Y(.34+t.length*.07,a)}}function vb(){return t=>{const e=ce(t.rng,18);[587.33,392].forEach((n,s)=>{J({...t,when:t.when+s*.16},{type:"triangle",freq:n*e,peak:.26,attack:.008,hold:.25,duration:.38,voices:2,detuneCents:11,wet:.34})});const a=J(t,{type:"sine",freq:[196*e,98*e],peak:.34,attack:.02,hold:.3,duration:.72,drive:2.2,voices:2,detuneCents:15,wet:.28}),o=G(t,{filter:"bandpass",freq:[2200,620],q:.8,peak:.12,attack:.06,duration:.66,wet:.55});return Y(.38+.16,a,o)}}function kb(t){const e=t?[523.25,659.25,783.99,1046.5]:[659.25,587.33,493.88,392];return a=>(e.forEach((o,n)=>{J({...a,when:a.when+n*.1},{type:t?"square":"sawtooth",freq:o,lowpass:t?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.4,voices:2,detuneCents:t?9:16,wet:.34})}),.4+e.length*.1)}function Mb(t){const e=t?[523.25,659.25,1046.5]:[587.33,493.88,392],a=.62;return o=>{const n=(r,l)=>(G({...o,when:o.when+r},{filter:"bandpass",freq:2900,q:10,peak:.7,attack:.012,hold:.45,duration:l,tremolo:{rate:24,depth:.7},wet:.06}),r+l);n(0,.26);const s=n(.36,.22),i=J(o,{type:"sawtooth",freq:[150,132],lowpass:[1100,420],peak:.14,attack:.01,hold:.5,duration:.58,drive:1.8,voices:2,detuneCents:22,wet:.2});return e.forEach((r,l)=>{J({...o,when:o.when+a+l*.1},{type:t?"square":"sawtooth",freq:r,lowpass:t?[3600,2200]:[1600,500],peak:.24,attack:.008,hold:.3,duration:.36,voices:2,detuneCents:t?9:16,wet:.34})}),Y(s,i,a+(e.length-1)*.1+.36)}}function Eb(){return t=>{const e=J(t,{type:"triangle",freq:[900,620],peak:.22,duration:.055,drive:1.6,wet:.16}),a=G(t,{filter:"highpass",freq:5e3,peak:.1,duration:.012});return Y(e,a)}}function ks(t,e,a,o,n){return je(t,{count:12,spread:e,grainMs:[5,14],freq:[2300,4600],freqShift:[a,o],q:3.2,peak:n,decay:.4,drive:1.5,wet:.3})}function Cn(t,e,a){return je(t,{count:7,spread:e,grainMs:[2,5],freq:[5600,11e3],q:9,peak:a,decay:.25,wet:.34})}const Tb={Disc:{cast(t){const e=ce(t.rng,55),a=ks(t,.3,1.35,.62,.3),o=Cn(t,.22,.13),n=G(t,{filter:"bandpass",freq:[700*e,1800*e],q:1.6,peak:.34,attack:.05,hold:.1,duration:.3,drive:1.4,wet:.3});return Y(a,o,n)},impact(t){const e=Se(t,{peak:.46,freq:3400,snap:1600,snapMs:10,wet:.1}),a=G(t,{filter:"bandpass",freq:[2400,950],q:2,peak:.3,attack:.003,duration:.07,drive:1.9,wet:.24}),o=ks(t,.2,1.3,.68,.3),n=Cn(t,.14,.46),s=J(t,{type:"sine",freq:[190,72],peak:.46,attack:.0022,duration:.1,drive:2.6,voices:2,detuneCents:15,wet:.14});return Y(e,a,o,n,s)}},Roll:{cast(t){const e=ce(t.rng,60);return G(t,{filter:"bandpass",freq:[900*e,2100*e],q:2.4,peak:.36,attack:.04,duration:.2,drive:1.5,wet:.3})},impact(t){const e=ks(t,.26,.7,1.5,.32),a=Cn(t,.2,.44),o=G(t,{filter:"bandpass",freq:[1100,3400],q:7,peak:.3,attack:.02,duration:.26,drive:1.6,wet:.32}),n=J(t,{type:"sine",freq:[230,124],peak:.18,attack:.004,duration:.08,drive:2.2,wet:.12});return Y(e,a,o,n)}},Swarm:{cast(t){const e=ce(t.rng,70),a=G(t,{filter:"bandpass",freq:[1400*e,3e3*e],q:4,peak:.36,attack:.025,duration:.17,drive:1.7,wet:.3}),o=Cn(t,.16,.16);return Y(a,o)},impact(t){const e=Se(t,{peak:.36,freq:4200,snap:2200,snapMs:7,wet:.1}),a=ks(t,.13,1.2,.8,.24),o=Cn(t,.1,.3),n=J(t,{type:"sine",freq:[250,118],peak:.18,attack:.002,duration:.07,drive:2.4,wet:.12});return Y(e,a,o,n)}}};function Ms(t,e,a,o){return Ji(t,{freq:e,duration:a,peak:o,attack:.0012,drive:1.4,wet:.34,modes:[{ratio:1,gain:1,decay:1},{ratio:2.06,gain:.82,decay:.82},{ratio:3.18,gain:.6,decay:.6},{ratio:4.34,gain:.4,decay:.42},{ratio:5.52,gain:.3,decay:.3}]})}function vd(t,e,a){return je(t,{count:7,spread:e,grainMs:[2,5],freq:[4200,12e3],q:10,peak:a,decay:.3,wet:.12})}function Sb(t,e,a){return ki(t,{count:4,spread:e,freq:[5e3,12500],peak:a,pingMs:[5,13],bend:1.08,wet:.2})}const Ab={Candy:{cast(t){const e=ce(t.rng,70),a=G(t,{filter:"bandpass",freq:[1400*e,3200*e],q:2,peak:.34,attack:.022,duration:.13,wet:.28}),o=Ms(t,1900*e,.11,.2),n=vd(t,.07,.1);return Y(a,o,n)},impact(t){const e=ce(t.rng,60),a=Se(t,{peak:.5,freq:5400,snap:3200,snapMs:8,wet:.12}),o=Ms(t,2450*e,.4,.56),n=vd(t,.22,.9),s=Sb(t,.16,.74),i=Ms({...t,when:t.when+.09},2450*e*1.02,.26,.22),r=Ms({...t,when:t.when+.175},2450*e*1.045,.17,.11),l=J(t,{type:"sine",freq:[280*e,130*e],peak:.42,attack:.0018,duration:.1,drive:3.2,wet:.12});return Y(a,o,n,s,.09+i,.175+r,l)}}};function Ir(t,e,a){const o=ce(t.rng,60),n=Se(t,{peak:e,freq:(4200+a*1800)*o,snap:(2600+a*900)*o,snapMs:7,wet:.05}),s=G(t,{filter:"bandpass",freq:[(2600+a*800)*o,(5200+a*1600)*o],q:3.4,peak:e*.8,attack:5e-4,duration:.022,drive:2.2,wet:.1}),i=G(t,{filter:"highpass",poles:24,freq:[(7e3+a*1800)*o,(4600+a*1200)*o],q:.7,peak:e*1.5,attack:4e-4,duration:.024,wet:.12});return Y(n,s,i)}function kd(t,e){const a=ce(t.rng,70),o=G(t,{filter:"lowpass",poles:24,freq:[(1800+e*600)*a,(420-e*110)*a],q:3.6,peak:.26+e*.18,attack:.012+e*.01,duration:.15+e*.12,drive:2,wet:.24}),n=J(t,{type:"sine",freq:[(180-e*45)*a,(58-e*16)*a],peak:.36+e*.3,attack:.006,duration:.13+e*.1,drive:3.2,voices:2,detuneCents:16,wet:.14}),s=G(t,{filter:"bandpass",freq:[700*a,1500*a],q:6,peak:.12+e*.08,attack:.03,duration:.2+e*.14,wet:.36}),i=je(t,{count:Math.round(5+e*5),spread:.12+e*.06,grainMs:[3,8],freq:[3800,10600],q:7,peak:.5+e*.3,decay:.3,wet:.28});return Y(o,n,s,i)}const Or=.045,Rb={Tackle:{cast(t){const e=ce(t.rng,40),a=G(t,{filter:"bandpass",freq:[420*e,1900*e],q:2,peak:.44,attack:.07,hold:.1,duration:.26,drive:1.6,wet:.3}),o=J(t,{type:"sine",freq:[120*e,240*e],peak:.28,attack:.08,duration:.24,drive:2.4,voices:2,detuneCents:14,wet:.16});return Y(a,o)},impact(t){const e=Ir(t,.88,.35),a=kd({...t,when:t.when+Or},1);return Y(e,Or+a)}},Hatch:{cast(t){const e=Ir(t,.5,0),a=J({...t,when:t.when+.05},{type:"triangle",freq:[1500,2400],peak:.3,attack:.006,duration:.09,drive:2.2,wet:.32}),o=J({...t,when:t.when+.15},{type:"triangle",freq:[1800,2700],peak:.24,attack:.005,duration:.07,drive:2.2,wet:.32});return Y(e,.05+a,.15+o)},impact(t){const e=Se(t,{peak:.4,freq:5400,snap:3200,snapMs:6,wet:.1}),a=G(t,{filter:"highpass",poles:24,freq:[8200,5600],q:.7,peak:.2,attack:4e-4,duration:.005,wet:.12}),o=J(t,{type:"triangle",freq:[2100,1250],peak:.22,attack:.0015,duration:.05,drive:2.4,wet:.2}),n=J({...t,when:t.when+.035},{type:"triangle",freq:[1700,2600],peak:.18,attack:.005,duration:.06,drive:2,wet:.3}),s=J(t,{type:"sine",freq:[240,120],peak:.22,attack:.002,duration:.06,drive:2.2,wet:.1});return Y(e,a,o,.035+n,s)}},Shards:{cast(t){const e=ce(t.rng,80),a=G(t,{filter:"highpass",freq:[1900*e,3800*e],q:1.1,peak:.32,attack:.016,duration:.11,wet:.26}),o=je(t,{count:4,spread:.08,grainMs:[3,6],freq:[3400,7e3],q:8,peak:.13,wet:.28});return Y(a,o)},impact(t){const e=Or*.62,a=Ir(t,.66,1),o=kd({...t,when:t.when+e},.18);return Y(a,e+o)}}};function Md(t,e,a,o){const n=ce(t.rng,70),s=J(t,{type:"sine",freq:[(170-e*55)*n,(52-e*16)*n],peak:o,attack:.003,duration:a,drive:3+e*1.2,voices:2,detuneCents:18,wet:.12}),i=G(t,{filter:"lowpass",poles:24,freq:[(760-e*220)*n,(150-e*45)*n],q:1.2,peak:o*.45,attack:.002,duration:a*.7,drive:2.2,wet:.2}),r=G(t,{filter:"bandpass",freq:[(2400-e*400)*n,(1450-e*300)*n],q:.8,peak:o*.056,attack:.003,duration:a*.55,drive:1.4,wet:.3});return Y(s,i,r)}const Ib={Smash:{cast(t){const e=ce(t.rng,55),a=G(t,{filter:"lowpass",poles:24,freq:[1300*e,420*e],q:1.6,peak:.42,attack:.055,hold:.1,duration:.22,drive:1.7,wet:.22}),o=J(t,{type:"sawtooth",freq:[180*e,92*e],lowpass:[620,220],peak:.24,attack:.03,duration:.2,drive:2.2,voices:2,detuneCents:20,wet:.12});return Y(a,o)},impact(t){const e=Se(t,{peak:.44,freq:1500,snap:620,snapMs:22,wet:.1}),a=Md(t,1,.24,.86);return Y(e,a)}},Tomato:{cast(t){const e=ce(t.rng,80),a=G(t,{filter:"lowpass",poles:24,freq:[1500*e,520*e],q:2.1,peak:.36,attack:.014,duration:.14,drive:1.6,wet:.18}),o=J(t,{type:"sine",freq:[300*e,140*e],peak:.16,attack:.006,duration:.11,drive:2,wet:.1});return Y(a,o)},impact(t){const e=Se(t,{peak:.34,freq:1900,snap:780,snapMs:15,wet:.1}),a=Md(t,.55,.19,.62),o=G(t,{filter:"lowpass",poles:24,freq:[1e3,260],q:2.8,peak:.24,attack:.008,duration:.13,drive:1.8,wet:.26});return Y(e,a,o)}},Lettuce:{cast(t){return G(t,{filter:"bandpass",freq:[900,2200],q:1.2,peak:.26,attack:.03,duration:.15,wet:.3})},impact(t){const e=G(t,{filter:"lowpass",poles:24,freq:[1600,380],q:1.4,peak:.3,attack:.006,duration:.16,drive:1.5,wet:.3}),a=J(t,{type:"triangle",freq:[240,96],peak:.3,attack:.012,hold:.2,duration:.3,drive:2.4,voices:2,detuneCents:22,wet:.18}),o=G(t,{filter:"bandpass",freq:[3400,1900],q:.9,peak:.042,attack:.004,duration:.1,wet:.34});return Y(e,a,o)}},Onion:{cast(t){const e=ce(t.rng,20),a=[174.61,220,261.63];a.forEach((n,s)=>{J({...t,when:t.when+s*.07},{type:"triangle",freq:n*e,peak:.28,attack:.016,hold:.22,duration:.34,drive:2.2,voices:2,detuneCents:11,wet:.4})});const o=G(t,{filter:"lowpass",poles:24,freq:[900,300],q:1,peak:.1,attack:.1,duration:.45,wet:.5});return Y(.34+a.length*.07,o)}}};function Ed(t,e,a,o,n){const s=ce(t.rng,60),i=.075+o*.045,r=.1+o*.06,l=G(t,{filter:"bandpass",freq:[e*s,a*s],q:5.5,peak:n,attack:.012,duration:i,drive:1.8,wet:.2}),h=G({...t,when:t.when+i*.82},{filter:"bandpass",freq:[a*s,e*.72*s],q:5.5,peak:n*.9,attack:.008,duration:r,drive:1.8,wet:.24}),c=J(t,{type:"triangle",freq:[e*.34*s,a*.3*s],peak:n*.5,attack:.014,duration:i+r*.6,drive:2.4,voices:2,detuneCents:16,wet:.14});return Y(l,i*.82+h,c)}function Td(t,e,a){const o=ce(t.rng,70),n=Se(t,{peak:.3+e*.1,freq:1700+a*700,snap:700+a*320,snapMs:16,wet:.1}),s=G(t,{filter:"lowpass",poles:24,freq:[(1400+a*600)*o,(280+a*120)*o],q:3.2,peak:.42+e*.2,attack:.005,duration:.15+e*.07,drive:2,wet:.26}),i=J(t,{type:"sine",freq:[(210-e*50)*o,(66-e*18)*o],peak:.6+e*.34,attack:.0025,duration:.16+e*.14,drive:2.6,voices:2,detuneCents:15,wet:.14}),r=G(t,{filter:"bandpass",freq:[(4200+a*2200)*o,(2100+a*900)*o],q:.75,peak:.23+a*.06,attack:.0015,duration:.05+a*.03,wet:.34});return Y(n,s,i,r)}const Ob={Mustard:{cast(t){return Ed(t,520,1250,.15,.44)},impact(t){return Td(t,.42,1)}},Ketchup:{cast(t){return Ed(t,340,780,1,.42)},impact(t){const e=Td(t,.3,0),a=G(t,{filter:"lowpass",poles:24,freq:[640,200],q:4,peak:.2,attack:.04,duration:.34,drive:1.6,wet:.4});return Y(e,a)}},Slash:{cast(t){const e=ce(t.rng,50);return G(t,{filter:"bandpass",freq:[700*e,2300*e],q:2,peak:.38,attack:.05,hold:.1,duration:.19,drive:1.5,wet:.26})},impact(t){const e=ce(t.rng,45),a=.026,o=(h,c,d)=>Se({...t,when:t.when+h},{peak:c,freq:d,snap:d*.3,snapMs:20,wet:.12}),n=o(0,.5,1400),s=o(a,.4,1200),i=G(t,{filter:"bandpass",freq:[900*e,340*e],q:2.4,peak:.34,attack:.0015,duration:.12,drive:2.1,wet:.24}),r=J(t,{type:"sine",freq:[200*e,58*e],peak:.95,attack:.002,duration:.24,drive:3,voices:2,detuneCents:17,wet:.14}),l=je(t,{count:5,spread:.075,grainMs:[3,9],freq:[3e3,6400],q:4,peak:.38,decay:.3,wet:.3});return Y(n,a+s,i,r,l)}}};function Cr(t,e,a,o){const n=Ji(t,{freq:e,duration:a,peak:o,attack:8e-4,wet:.36,modes:[{ratio:1,gain:1,decay:1},{ratio:2.76,gain:.8,decay:.7},{ratio:5.4,gain:.5,decay:.44}]}),s=J(t,{type:"sine",freq:[e*1.02,e*.92],ring:e*1.37,peak:o*.7,attack:8e-4,duration:a*.8,wet:.4});return Y(n,s)}function Sd(t,e,a,o){return je(t,{count:e,spread:a,grainMs:[2,5],freq:[5600,14e3],q:11,peak:o,decay:.3,wet:.3})}const Cb={Smash:{cast(t){const e=ce(t.rng,50),a=G(t,{filter:"bandpass",freq:[600*e,2400*e],q:2.4,peak:.44,attack:.055,hold:.1,duration:.22,drive:1.5,wet:.3}),o=Cr(t,2400*e,.12,.16);return Y(a,o)},impact(t){const e=ce(t.rng,45),a=Se(t,{peak:.66,freq:6400,snap:4200,snapMs:6,wet:.14}),o=Cr(t,5400*e,.34,.56),n=Sd(t,9,.2,.8),s=J(t,{type:"sine",freq:[250*e,100*e],peak:.62,attack:.0015,duration:.12,drive:3,wet:.12}),i=G(t,{filter:"bandpass",freq:[7e3,12e3],q:1.2,peak:.26,attack:.025,duration:.16,wet:.5});return Y(a,o,n,i,s)}},Giant:{impact(t){const e=ce(t.rng,35),a=Se(t,{peak:.72,freq:5800,snap:3600,snapMs:9,wet:.16}),o=Cr(t,4550*e,.5,.64),n=Sd(t,12,.36,.84),s=G(t,{filter:"bandpass",freq:[6e3,9500],q:1.4,peak:.14,attack:.06,duration:.58,wet:.6}),i=J(t,{type:"sine",freq:[230*e,78*e],peak:.52,attack:.0025,duration:.14,drive:3,voices:2,detuneCents:16,wet:.14});return Y(a,o,n,s,i)}}};function Fr(t,e,a){const o=ce(t.rng,60),n=.38+a*.12,s=G(t,{filter:"bandpass",freq:[(560-a*200)*o,(2200-a*900)*o],q:1.5,peak:1.2,attack:.035,hold:.1,duration:n,drive:1.5,wet:.1*Math.min(1,16/e),tremolo:{rate:[e*.88,e],depth:.85}}),i=G(t,{filter:"highpass",freq:3600,peak:.16,attack:8e-4,duration:.018,wet:.1});return Y(s,i)}const Fb={Dough:{cast(t){return Fr(t,16,.85)},impact(t){const e=ce(t.rng,70),a=G(t,{filter:"lowpass",poles:24,freq:[1100*e,190*e],q:1.1,peak:.34,attack:.004,duration:.13,drive:1.8,wet:.24}),o=Se(t,{peak:.34,freq:1600,snap:660,snapMs:18,wet:.1}),n=J(t,{type:"sine",freq:[150*e,58*e],peak:.5,attack:.003,duration:.18,drive:2.8,voices:2,detuneCents:18,wet:.14}),s=G(t,{filter:"bandpass",freq:[2500,1700],q:.8,peak:.028,attack:.012,duration:.11,wet:.4});return Y(a,o,n,s)}},Tomato:{cast(t){return Fr(t,26,.25)},impact(t){const e=ce(t.rng,65),a=G(t,{filter:"bandpass",freq:[1350*e,400*e],q:1.4,peak:.34,attack:.001,duration:.07,drive:2,wet:.2}),o=G(t,{filter:"lowpass",poles:24,freq:[900,240],q:2.6,peak:.3,attack:.008,duration:.15,drive:1.7,wet:.26}),n=Se(t,{peak:.34,freq:2e3,snap:900,snapMs:13,wet:.1}),s=J(t,{type:"sine",freq:[200*e,72*e],peak:.62,duration:.18,drive:3.2,voices:2,detuneCents:16,wet:.14}),i=Hh(t,{peak:.15,freq:[8200,3e3],duration:.085,drops:6,wet:.34});return Y(a,o,n,s,i)}},Cheese:{cast(t){return Fr(t,12,.6)},impact(t){const e=ce(t.rng,55),a=G(t,{filter:"bandpass",freq:[1400*e,480*e],q:2.2,peak:.3,attack:.01,duration:.2,drive:1.6,wet:.26}),o=J(t,{type:"triangle",freq:[300*e,110*e],peak:.32,attack:.012,hold:.25,duration:.34,drive:2.4,voices:2,detuneCents:20,wet:.18}),n=Se(t,{peak:.26,freq:1800,snap:760,snapMs:16,wet:.1}),s=je(t,{count:4,spread:.13,grainMs:[6,16],freq:[3200,5200],q:3.5,peak:.16,decay:.35,freqShift:[1,.62],wet:.34});return Y(a,o,n,s)}}};function Nr(t,e,a){return G(t,{filter:"bandpass",freq:[2800,5600],q:.85,peak:e,attack:a*.35,duration:a,wet:.55})}function Lr(t,e,a,o){return Pn(t,{count:e,spread:a,freq:[1500,3100],rise:1.9,peak:o,wet:.42})}function Dr(t,e,a,o){const n=ce(t.rng,80),s=(2600-e*900)*n,i=(420-e*200)*n,r=G(t,{filter:"lowpass",freq:[s,i],poles:24,q:2.4+e*2,peak:o*.72,attack:.006+e*.012,duration:a,drive:1.8,wet:.3}),l=J(t,{type:"sine",freq:[(190-e*60)*n,(68-e*22)*n],peak:o*(.85+e*.55),attack:.005,duration:a*.75,drive:2.5,voices:2,detuneCents:16,wet:.14}),h=Se(t,{peak:.22+e*.12,freq:1150,snap:460,snapMs:18,wet:.12});return Y(r,l,h)}const Nb={Splash:{cast(t){const e=ce(t.rng,90),a=G(t,{filter:"bandpass",freq:[900*e,260*e],q:3.4,peak:.46,attack:.012,duration:.12,drive:1.8,wet:.24}),o=Pn(t,{count:2,spread:.07,freq:[620,980],peak:.2,wet:.3});return Y(a,o)},impact(t){const e=Dr(t,.24,.2,.44),a=Pn(t,{count:4,spread:.16,freq:[480,900],peak:.14,wet:.3}),o=Lr(t,7,.11,.2),n=Nr(t,.11,.34);return Y(e,a,o,n)}},Noodle:{cast(t){const e=ce(t.rng,70),a=G(t,{filter:"bandpass",freq:[1500*e,520*e],q:2.2,peak:.42,attack:.01,duration:.16,drive:1.7,wet:.26}),o=J(t,{type:"sine",freq:[520*e,190*e],peak:.16,attack:.02,duration:.18,drive:2,wet:.16});return Y(a,o)},impact(t){const e=G(t,{filter:"bandpass",freq:[1400,560],q:1.6,peak:.26,attack:.0015,duration:.05,drive:1.8,wet:.18}),a=Dr(t,.35,.26,.44),o=Pn(t,{count:3,spread:.2,freq:[440,820],peak:.12,wet:.3}),n=Lr(t,8,.14,.2),s=Nr(t,.12,.42);return Y(e,a,o,n,s)}},Dump:{cast(t){const e=ce(t.rng,40);let a=0;const o=9;for(let s=0;s<o;s++){const i=s/o*.34+Me(t.rng,-.012,.012),r=Me(t.rng,320,1100)*e,l=Me(t.rng,.05,.11);a=Math.max(a,i+l),G({...t,when:t.when+Math.max(0,i)},{filter:"lowpass",poles:24,freq:[r*2.2,r*.6],q:4.5,peak:.32,attack:.008,duration:l,drive:1.6,wet:.28})}const n=J(t,{type:"sine",freq:[150*e,70*e],peak:.3,attack:.12,duration:.4,drive:2,voices:2,detuneCents:14,wet:.2});return Y(a,n)},impact(t){const e=Dr(t,1,.42,.62),a=Pn(t,{count:7,spread:.34,freq:[380,820],peak:.16,wet:.34}),o=je(t,{count:5,spread:.26,freq:[600,1500],peak:.1,q:4,wet:.3}),n=Lr(t,7,.22,.14),s=Nr(t,.15,.75);return Y(e,a,o,n,s)}}};function Hr(t,e,a,o,n){const s=ce(t.rng,45),i=G(t,{filter:"bandpass",freq:[e*s,a*s],q:12,peak:n,attack:.004,duration:o,curve:"lin",freqCurve:"exp",wet:.18}),r=G({...t,when:t.when+o*.16},{filter:"bandpass",freq:[e*2*s,a*1.7*s],q:14,peak:n*.5,attack:.002,duration:o*.7,curve:"lin",wet:.22}),l=G({...t,when:t.when+o*.06},{filter:"bandpass",freq:[e*3.4*s,a*2.6*s],q:16,peak:n*.8,attack:.0015,duration:o*.45,curve:"lin",wet:.24});return Y(i,o*.16+r,o*.06+l)}function Es(t,e,a,o){return je(t,{count:e,spread:a,grainMs:[2,5],freq:[4200,12e3],q:6,peak:o,decay:.35,wet:.1})}const Lb={Rice:{cast(t){const e=G(t,{filter:"highpass",freq:[2200,4200],q:1,peak:.3,attack:.012,duration:.09,wet:.2}),a=Es(t,7,.09,.2);return Y(e,a)},impact(t){const e=Es(t,6,.075,.34),a=Se(t,{peak:.3,freq:5600,snap:3600,snapMs:5,wet:.08}),o=J(t,{type:"sine",freq:[300,170],peak:.16,attack:.0015,duration:.05,drive:2,wet:.1});return Y(e,a,o)}},Seaweed:{cast(t){const e=ce(t.rng,60);return G(t,{filter:"bandpass",freq:[1600*e,3400*e],q:1.8,peak:.34,attack:.03,duration:.18,wet:.3})},impact(t){const e=ce(t.rng,55),a=je(t,{count:10,spread:.16,grainMs:[3,9],freq:[2800,6400],q:4.5,peak:.28,decay:.35,wet:.28}),o=G(t,{filter:"bandpass",freq:[3600*e,1600*e],q:7,peak:.26,attack:.012,duration:.24,wet:.32}),n=Se(t,{peak:.32,freq:4200,snap:2400,snapMs:7,wet:.1}),s=J(t,{type:"sine",freq:[280,150],peak:.13,attack:.003,duration:.06,drive:2,wet:.12});return Y(a,o,n,s)}},Fish:{cast(t){return Hr(t,900,2600,.14,.3)},impact(t){const e=Hr(t,2600,8200,.17,.72),a=G(t,{filter:"lowpass",poles:24,freq:[1100,340],q:2.4,peak:.16,attack:.006,duration:.09,drive:1.8,wet:.24}),o=Es(t,5,.1,.2),n=J(t,{type:"sine",freq:[230,96],peak:.42,attack:.0018,duration:.07,drive:2.4,wet:.12});return Y(e,a,o,n)}},Catch:{cast(t){const e=ce(t.rng,40),a=J(t,{type:"sine",freq:[140*e,300*e],peak:.3,attack:.1,duration:.3,drive:2.2,voices:2,detuneCents:14,wet:.24}),o=G(t,{filter:"bandpass",freq:[800*e,2400*e],q:2.2,peak:.34,attack:.08,duration:.28,wet:.32});return Y(a,o)},impact(t){const e=Hr(t,3e3,9e3,.15,.8),a=G({...t,when:t.when+.05},{filter:"lowpass",poles:24,freq:[1300,420],q:2.2,peak:.2,attack:.005,duration:.11,drive:1.9,wet:.26}),o=Es({...t,when:t.when+.04},8,.16,.28),n=Se(t,{peak:.52,freq:5e3,snap:2800,snapMs:7,wet:.1}),s=J(t,{type:"sine",freq:[220,80],peak:.5,attack:.0018,duration:.09,drive:2.6,voices:2,detuneCents:14,wet:.14});return Y(e,.05+a,.04+o,n,s)}}};function Ts(t,e,a){const o=ce(t.rng,70),n=G(t,{filter:"bandpass",freq:[3400*o,1500*o],q:1.2,peak:.55+e*.3,attack:6e-4,duration:.03,drive:2.2,wet:.12}),s=Se(t,{peak:.44+e*.2,freq:5200*o,snap:(2900-e*500)*o,snapMs:8,wet:.1}),i=je(t,{count:Math.round(7+e*6),spread:.14+e*.1,grainMs:[3,9-a*3],freq:[2700+a*900,9200+a*2600],q:7,peak:.34+e*.16,decay:.28,drive:1.6,wet:.26}),r=e*(1-a)>.02?J(t,{type:"sine",freq:[(190-e*60)*o,(72-e*22)*o],peak:.24+e*.26,attack:.002,duration:.08+e*.1,drive:2.6,voices:2,detuneCents:16,wet:.14}):0,l=G(t,{filter:"highpass",poles:24,freq:[8e3+a*2e3,5200+a*1200],q:.7,peak:.165+e*.065,attack:6e-4,duration:.014+e*.012,wet:.22});return Y(n,s,i,r,l)}const Db={Filling:{cast(t){const e=ce(t.rng,60),a=G(t,{filter:"bandpass",freq:[700*e,1800*e],q:2,peak:.44,attack:.03,duration:.16,drive:1.6,wet:.26}),o=je(t,{count:4,spread:.1,freq:[3e3,7e3],peak:.11,q:8,wet:.28}),n=J(t,{type:"sine",freq:[260*e,130*e],peak:.14,duration:.1,drive:2,wet:.12});return Y(a,o,n)},impact(t){return Ts(t,.75,.3)}},Onion:{cast(t){const e=ce(t.rng,80);return G(t,{filter:"highpass",freq:[1800*e,3400*e],q:1.1,peak:.36,attack:.02,duration:.12,wet:.28})},impact(t){const e=Ts(t,.3,1),a=G(t,{filter:"bandpass",freq:[1100,420],q:1.6,peak:.26,attack:.006,duration:.1,drive:1.7,wet:.24});return Y(e,a)}},Double:{cast(t){const e=ce(t.rng,50),a=G(t,{filter:"bandpass",freq:[640*e,1700*e],q:2,peak:.44,attack:.025,duration:.15,drive:1.6,wet:.26}),o=G({...t,when:t.when+.055},{filter:"bandpass",freq:[820*e,2100*e],q:2,peak:.38,attack:.02,duration:.13,drive:1.6,wet:.26}),n=J(t,{type:"sine",freq:[240*e,118*e],peak:.16,duration:.12,drive:2,wet:.12});return Y(a,.055+o,n)},impact(t){const e=Ts(t,.85,.1),a=Ts({...t,when:t.when+.055},.4,.85);return Y(e,.055+a)}}};function Ss(t,e,a,o){return Ji(t,{freq:e,duration:a,peak:o,attack:.001,drive:1.8,wet:.22,modes:[{ratio:1,gain:1,decay:1},{ratio:2.43,gain:.78,decay:.55},{ratio:3.71,gain:.5,decay:.34},{ratio:5.86,gain:.3,decay:.2}]})}function Ad(t,e,a){const o=G(t,{filter:"bandpass",freq:[1300,2800],q:1.5,peak:e,attack:.004,duration:a,wet:.34}),n=je(t,{count:7,spread:a*.7,grainMs:[3,7],freq:[2600,8600],q:8,peak:e*.42,decay:.3,wet:.3}),s=G(t,{filter:"highpass",poles:24,freq:[6200,3800],q:.7,peak:e*.25,attack:.002,duration:a*.5,wet:.36});return Y(o,n,s)}const Hb={Spray:{cast(t){const e=G(t,{filter:"bandpass",freq:[900,2800],q:1.1,peak:.34,attack:.02,duration:.14,wet:.28}),a=Ss(t,190,.06,.2);return Y(e,a)},impact(t){const e=Se(t,{peak:.28,freq:4200,snap:2500,snapMs:8,wet:.12}),a=Ad(t,.34,.16),o=J(t,{type:"sine",freq:[260,120],peak:.3,attack:.002,duration:.09,drive:2,wet:.12});return Y(e,a,o)}},Glass:{cast(t){const e=ce(t.rng,70),a=G(t,{filter:"highpass",freq:[1600*e,3600*e],q:1.2,peak:.36,attack:.018,duration:.13,wet:.26}),o=je(t,{count:3,spread:.07,grainMs:[3,7],freq:[4200,8e3],q:9,peak:.14,wet:.3});return Y(a,o)},impact(t){const e=Se(t,{peak:.62,freq:4600,snap:3400,snapMs:9,wet:.14}),a=Ss(t,460,.13,.42),o=je(t,{count:9,spread:.15,grainMs:[3,8],freq:[3200,9200],q:8,peak:.3,decay:.25,wet:.32}),n=ki(t,{count:3,spread:.1,freq:[5200,11e3],peak:.19,pingMs:[6,14],bend:.9,wet:.34});return Y(e,a,o,n)}},Cap:{cast(t){const e=J(t,{type:"sine",freq:[520,900],peak:.4,attack:.001,duration:.05,drive:2.6,wet:.2}),a=Se(t,{peak:.3,freq:4e3,snap:2400,snapMs:6,wet:.12});return Y(e,a)},impact(t){const e=Se(t,{peak:.52,freq:3800,snap:2300,snapMs:9,wet:.12}),a=Ss(t,560,.2,.7),o=J(t,{type:"sine",freq:[150,68],peak:.17,attack:.003,duration:.11,drive:2.4,wet:.12}),n=ki(t,{count:2,spread:.05,freq:[4600,9e3],peak:.3,pingMs:[5,11],bend:.86,wet:.28});return Y(e,a,o,n)}},Mega:{cast(t){const e=ce(t.rng,35),a=G(t,{filter:"bandpass",freq:[500*e,2600*e],q:1.8,peak:.44,attack:.1,hold:.08,duration:.34,drive:1.5,wet:.34}),o=J(t,{type:"sine",freq:[90*e,200*e],peak:.34,attack:.12,duration:.36,drive:2.4,voices:2,detuneCents:14,wet:.2});return Y(a,o)},impact(t){const e=Se(t,{peak:.58,freq:3e3,snap:1500,snapMs:16,wet:.12}),a=Ad(t,.56,.42),o=Ss(t,380,.24,.56),n=J(t,{type:"sine",freq:[140,46],peak:.62,attack:.003,duration:.3,drive:3.2,voices:2,detuneCents:18,wet:.16});return Y(e,a,o,n)}}};function zt(t,e){const a={};for(const[o,n]of Object.entries(e))n&&(a[`${t}.${o}`]=n);return a}const _b={...zt("burrito",Tb),...zt("donut",Ab),...zt("egg",Rb),...zt("hamburger",Ib),...zt("hotdog",Ob),...zt("lollipop",Cb),...zt("pizza",Fb),...zt("soup",Nb),...zt("sushi",Lb),...zt("taco",Db),...zt("waterbottle",Hb)};function Rd(t,e){return _b[`${t}.${e}`]}const zb=210,Pb=.78,$b=420,Bb=900,Ub=900,qb=520,Wb=.45,Gb=1.5,jb=1600,Yb=$b,Vb=.6180339887,Kb=.42;class Mi{constructor(e,a={}){this.engine=e,this.localSlot=a.listenerId??(a.listener==="enemy"?1:Ce),this.listenerSlot=this.localSlot}listenerSlot;localSlot;lastFogSoundAt=-1/0;lastAuraSoundAt=-1/0;lastHealSoundAt=-1/0;ringFloored=!1;sawRingAboveFloor=!1;statusBefore=[];statusWriterUnclaimed=[];statusTrackable=!1;nextAmbienceAt=-1/0;ambienceChunk=0;lastCombatAt=-1/0;setListener(e){this.listenerSlot=e}handleEvents(e,a){try{this.watchZone(a),this.watchAmbience(a),this.openStatusWindow(a);for(const o of e)this.handleEvent(o,a)}catch(o){console.warn("[audio] event dispatch failed:",o)}finally{this.closeStatusWindow(a)}}reset(){this.listenerSlot=this.localSlot,this.lastFogSoundAt=-1/0,this.lastAuraSoundAt=-1/0,this.lastHealSoundAt=-1/0,this.ringFloored=!1,this.sawRingAboveFloor=!1,this.statusBefore=[],this.statusWriterUnclaimed=[],this.statusTrackable=!1,this.nextAmbienceAt=-1/0,this.ambienceChunk=0,this.lastCombatAt=-1/0}static statusTimestamps(e){const a=e.status;return!a||typeof a.stunnedUntil!="number"||typeof a.slowedUntil!="number"?null:{stun:a.stunnedUntil,slow:a.slowedUntil}}openStatusWindow(e){const o=qe(e).map(n=>Mi.statusTimestamps(n));if(this.statusTrackable=o.length>0&&o.every(n=>n!==null),!!this.statusTrackable)for(let n=0;n<o.length;n++){const s=this.statusBefore[n]??{stun:NaN,slow:NaN},i=o[n];this.statusWriterUnclaimed[n]={stun:i.stun!==s.stun,slow:i.slow!==s.slow}}}closeStatusWindow(e){qe(e).forEach((a,o)=>{const n=Mi.statusTimestamps(a);n&&(this.statusBefore[o]=n)})}wasStatusRefused(e,a){if(!this.statusTrackable)return!1;const o=this.statusWriterUnclaimed[e];return o?.[a]?(o[a]=!1,!1):!0}watchZone(e){if(!this.ringFloored&&e.phase==="playing"){if(e.safeRadius>f0(e.fighters.length,e.timeRemaining)+.5){this.sawRingAboveFloor=!0;return}this.sawRingAboveFloor&&(this.ringFloored=!0,this.engine.play(vb(),{priority:Qe.Critical}))}}watchAmbience(e){if(e.phase!=="playing"||e.elapsed<this.nextAmbienceAt)return;this.nextAmbienceAt=e.elapsed+ef*1e3;const a=this.ambienceChunk*Vb%1;this.ambienceChunk++;const o=qe(e);let n=1/0;for(let i=0;i<o.length;i++)for(let r=i+1;r<o.length;r++){const l=Math.hypot(o[i].x-o[r].x,o[i].y-o[r].y);l<n&&(n=l)}const s=e.elapsed-this.lastCombatAt<jb||n<Yb;this.engine.play(mb(),{gain:s?Wb:Gb,pan:(a*2-1)*Kb,priority:Qe.Ambient,key:"ambience"})}handleEvent(e,a){switch(e.type){case"countdown-tick":this.engine.play(yb(e.value),{priority:Qe.Critical});break;case"match-started":this.engine.play(xb(),{priority:Qe.Critical});break;case"match-ended":{const o=qe(a),n=o.length>0&&o.every(i=>i.alive===!0),s=Wt(e.winnerId,e.winner)===this.localSlot;this.engine.play(n?Mb(s):kb(s),{priority:Qe.Critical});break}case"weapon-fired":this.lastCombatAt=a.elapsed,this.playCast(vt(a,e.fighterId,e.fighterRole),e.weaponKey,a);break;case"hit-landed":this.lastCombatAt=a.elapsed,this.playHit(e,a);break;case"heal":{const o=vt(a,e.fighterId,e.fighterRole),n=this.place(o.x,o.y,a);if(n.gain<Ar||e.amount<=m0&&a.elapsed-this.lastHealSoundAt<qb)break;this.lastHealSoundAt=a.elapsed,this.engine.play(ub(),{...n,key:"heal"});break}case"death":{const o=vt(a,e.fighterId,e.fighterRole),n=this.place(o.x,o.y,a);if(!(Wt(e.fighterId,e.fighterRole)===this.localSlot)&&n.gain<Ar)break;this.engine.play(pb(),{...n,priority:Qe.Critical,gain:Wt(e.fighterId,e.fighterRole)===this.localSlot?1:n.gain});break}case"projectile-destroyed":e.reason==="hit-cover"&&this.playPlaced(bb(),{...this.place(e.x,e.y,a),priority:Qe.Ambient,key:"cover"});break}}playCast(e,a,o){const n=ie[e.characterId].weapons.find(r=>r.key===a);if(!n)return;if(n.giantSlam){this.engine.play(lb(),{priority:Qe.Critical});return}const s=Rd(e.characterId,a)?.cast,i=s?this.wrapWeaponHook(s,n,e.characterId,n.damage):Xb(n);this.playPlaced(i,{...this.place(e.x,e.y,o),key:`cast:${e.characterId}.${a}`})}playHit(e,a){const o=this.place(e.x,e.y,a),n=Wt(e.targetId,e.targetRole),s=e.effect==="stun"&&this.wasStatusRefused(n,"stun");if(e.source.kind==="fog"){if(a.elapsed-this.lastFogSoundAt<Bb)return;this.lastFogSoundAt=a.elapsed,this.engine.play(xd(),{priority:Qe.Ambient,key:"fog"});return}if(e.source.kind==="hazard"){this.playPlaced(gb(),{...o,priority:Qe.Ambient,key:"hazard"});return}if(e.source.kind==="trail"){this.playPlaced(wb(),{...o,priority:Qe.Ambient,key:"trail"});return}if(e.source.kind==="weapon"&&e.source.itemId==="blue_cheese"){if(a.elapsed-this.lastAuraSoundAt<Ub)return;this.lastAuraSoundAt=a.elapsed,this.playPlaced(xd(),{...o,priority:Qe.Ambient,key:"aura"});return}const i=e.source.weaponKey,r=$n(a,e.source,e.targetRole),l=ie[r.characterId].weapons.find(d=>d.key===i),h=l?Rd(r.characterId,l.key)?.impact:void 0,c=h&&l?this.wrapWeaponHook(h,l,r.characterId,e.amount):hb(e.amount);if(this.playPlaced(c,{...o,key:`impact:${r.characterId}.${i}`}),n===this.localSlot){const d=vt(a,e.targetId,e.targetRole);this.engine.play(cb(d.hp/d.maxHp),{gain:.9,key:"hurt",priority:Qe.Normal})}s&&this.playPlaced(db(),{...o,key:"shrug",priority:Qe.Normal})}wrapWeaponHook(e,a,o,n){return s=>e({...s,color:a.color,damage:n,weapon:a,characterId:o})}playPlaced(e,a){a.gain<Ar||this.engine.play(e,a)}place(e,a,o){const n=qe(o)[this.listenerSlot]??o.player,s=e-n.x,i=a-n.y,r=Math.max(-1,Math.min(1,s/zb))*Pb,l=Math.hypot(s,i),h=ab(l,ob,nb);return{pan:r,gain:h}}}function Xb(t){return t.type==="melee"?ib(t.damage,t.cone??90):t.type==="self"?rb():sb(t.damage)}const _r="/food-arena/",Id=`${_r.endsWith("/")?_r:`${_r}/`}audio/bounce-and-bash.mp3`,Od=.45,tf="fa.audio.music";function Zb(){try{const t=localStorage.getItem(tf);if(t){const e=JSON.parse(t);return{volume:typeof e.volume=="number"?Math.min(1,Math.max(0,e.volume)):Od,enabled:e.enabled!==!1}}}catch{}return{volume:Od,enabled:!0}}function Cd(t){try{localStorage.setItem(tf,JSON.stringify(t))}catch{}}class Jb{el=null;source=null;gain=null;state=Zb();wanted=!1;listeners=new Set;fadeToken=0;loadError=null;suppressed=!1;ensureGraph(){if(typeof document>"u")return!1;const e=bt(),a=e.context,o=e.busInput;if(!a||!o||typeof a.createMediaElementSource!="function")return!1;if(this.source)return!0;if(!this.el){const n=document.createElement("audio");n.src=Id,n.loop=!0,n.preload="auto",n.volume=1,n.crossOrigin="anonymous",n.addEventListener("error",()=>{const s=n.error?n.error.code:0;this.loadError=`music track failed to load (MediaError ${s}) from ${n.currentSrc||n.src}`,console.warn(`[audio] ${this.loadError}`),this.emit()},{once:!0}),this.el=n}try{return this.source=a.createMediaElementSource(this.el),this.gain=a.createGain(),this.gain.gain.value=this.state.enabled?this.state.volume:0,this.source.connect(this.gain).connect(o),!0}catch{return this.source=null,this.gain=null,!1}}play(){if(this.wanted=!0,this.suppressed||!this.state.enabled||!this.ensureGraph()||!this.el)return;const e=this.el.play();e&&typeof e.catch=="function"&&e.catch(()=>{})}pause(){this.wanted=!1,this.el?.pause()}onUnlock(){this.wanted&&this.play()}isPlaying(){return!!this.el&&!this.el.paused}getLoadError(){return this.loadError}getTrackUrl(){return this.el?this.el.src:Id}getVolume(){return this.state.volume}setVolume(e){this.state.volume=Math.min(1,Math.max(0,e)),Cd(this.state),this.applyGain(),this.emit()}isEnabled(){return this.state.enabled}setEnabled(e){this.state.enabled=e,Cd(this.state),this.applyGain(),e?this.play():this.el?.pause(),this.emit()}fadeOut(e=.6){if(this.suppressed=!0,!this.el||this.el.paused)return;this.applyGain(0,e);const a=this.el;window.setTimeout(()=>{this.fadeToken===o&&a.pause()},e*1e3+40);const o=++this.fadeToken}fadeIn(e=.8){if(this.fadeToken++,this.suppressed=!1,!this.state.enabled||!this.ensureGraph()||!this.el)return;const a=this.el.paused;if(a){this.gain&&(this.gain.gain.value=0);const o=this.el.play();o&&typeof o.catch=="function"&&o.catch(()=>{})}this.applyGain(void 0,a?e:.25)}duck(e=.35){this.applyGain(this.state.volume*Math.min(1,Math.max(0,e)))}unduck(){this.applyGain()}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}applyGain(e,a=.08){if(!this.gain)return;const n=bt().context,s=this.state.enabled?e??this.state.volume:0;try{if(n){const i=n.currentTime;this.gain.gain.cancelScheduledValues(i),this.gain.gain.setValueAtTime(this.gain.gain.value,i),this.gain.gain.linearRampToValueAtTime(s,i+a)}else this.gain.gain.value=s}catch{this.gain.gain.value=s}}emit(){for(const e of this.listeners)try{e()}catch{}}}let As=null;function ct(){if(!As){As=new Jb;const t=As;bt().onChange(()=>{bt().getState()==="running"&&t.onUnlock()})}return As}let Rs=null;function bt(){return Rs||(Rs=new Q1,ey(Rs)),Rs}function Qb(t){return new Mi(bt(),t)}const Ae={setVolume(t){bt().setVolume(t)},getVolume(){return bt().getVolume()},setMuted(t){bt().setMuted(t)},isMuted(){return bt().isMuted()},toggleMuted(){return bt().toggleMuted()},onChange(t){return bt().onChange(t)},getState(){return bt().getState()},unlock(){bt().unlock()},previewClick(){bt().play(Eb(),{key:"ui"})},music:{play(){ct().play()},pause(){ct().pause()},isPlaying(){return ct().isPlaying()},getVolume(){return ct().getVolume()},setVolume(t){ct().setVolume(t)},isEnabled(){return ct().isEnabled()},setEnabled(t){ct().setEnabled(t)},fadeOut(t){ct().fadeOut(t)},fadeIn(t){ct().fadeIn(t)},duck(t){ct().duck(t)},unduck(){ct().unduck()},onChange(t){return ct().onChange(t)},getLoadError(){return ct().getLoadError()},getTrackUrl(){return ct().getTrackUrl()}}};function ey(t){typeof window>"u"||(window.__audio={engine:t,tap:()=>t.tap(),connectTap:e=>t.connectTap(e),stats:()=>({state:t.getState(),activeVoices:t.activeVoices(),started:t.counters.started,droppedBudget:t.counters.droppedBudget,droppedThrottle:t.counters.droppedThrottle,droppedNotRunning:t.counters.droppedNotRunning,volume:t.getVolume(),muted:t.isMuted()}),get music(){const e=ct();return{url:e.getTrackUrl(),error:e.getLoadError(),playing:e.isPlaying(),enabled:e.isEnabled()}}})}const F={ink:"#1a1224",cream:"#FFF3DE",white:"#FFFFFF",gold:"#F4A300",goldDark:"#B87400",mustard:"#FFC93C",mustardHi:"#FFDD6B",ketchup:"#D62839",tomato:"#E63946",tomatoHi:"#FF9E9E",lettuce:"#7CB518",leafDark:"#4E8B2B",water:"#1E90D8",waterHi:"#5BC8F5",ice:"#8FE1FF",iceHi:"#BFF0FF",grape:"#7A4BC4",grapeHi:"#9B6BE0",grapeDark:"#5B2E8C",violet:"#B497D6",wood:"#8B4A22",woodHi:"#B4622A",meat:"#8B3A2E",meatHi:"#D98A72",patty:"#A05A2C",pattyDark:"#5A2E17",steel:"#DCD6E8",candy:"#FF6FA5",candyHi:"#FFB3D1",flame:"#FF7A2F"};function Yo(t,e,a,o=12,n=12){const s=[];for(let i=0;i<t*2;i++){const r=i%2===0?e:a,l=Math.PI*i/t-Math.PI/2;s.push(`${(o+r*Math.cos(l)).toFixed(2)} ${(n+r*Math.sin(l)).toFixed(2)}`)}return`M${s.join("L")}Z`}const ty={patty:`
<ellipse cx="12" cy="14.3" rx="8.5" ry="4.5" fill="${F.pattyDark}"/>
<ellipse cx="12" cy="11.5" rx="8.5" ry="4.5" fill="${F.patty}"/>
<path d="M6.8 10.4 10 12.3M10.9 9.2 14.1 11.1M15.2 10.1 17.8 11.6" stroke="${F.pattyDark}" stroke-width="1.5"/>`,meat:`
<path d="M2.6 12.8c0-4.6 3.4-7.6 7.6-7.6 4.3 0 6.9 2.9 6.9 6.5 0 4.9-3.4 8.7-7.6 8.7-4.1 0-6.9-3.2-6.9-7.6z" fill="${F.meat}"/>
<path d="M6.8 9.8c2.6-.8 4.5.2 5.5 2.5" stroke="${F.meatHi}" stroke-width="1.8"/>
<path d="M14.4 7.6h4.8a1.5 1.5 0 0 1 0 3h-4.8a1.5 1.5 0 0 1 0-3z" fill="${F.cream}"/>
<circle cx="19.6" cy="7.2" r="1.9" fill="${F.cream}"/>
<circle cx="19.6" cy="10.6" r="1.9" fill="${F.cream}"/>`,tomato:`
<circle cx="12" cy="13.7" r="7.6" fill="${F.tomato}"/>
<path d="M12 7.2c-1.5-1.4-3.1-1.8-4.4-1.4.1 1.5.9 2.7 2.1 3.4M12 7.2c1.5-1.4 3.1-1.8 4.4-1.4-.1 1.5-.9 2.7-2.1 3.4z" fill="${F.leafDark}" stroke-width="1.4"/>
<path d="M12 3.4v3.6" stroke="${F.leafDark}" stroke-width="1.9"/>
<path d="M8.5 11a4.4 4.4 0 0 1 2.4-2.3" stroke="${F.tomatoHi}" stroke-width="1.7"/>`,lettuce:`
<path d="M12 20.8c-5.4 0-8.9-3.5-8.9-7.6 0-1.7 1.1-2.3 2.1-1.7.4-1.9 1.9-2.5 2.9-1.4.6-1.9 2.3-2.5 3.3-1.3.9-1.9 2.7-2.1 3.7-.6 1.2-1.1 2.9-.2 2.9 1.4 1.5-.2 2.7.9 2.5 2.3.6 3.9-2.7 8.2-8.2 8.2z" fill="${F.lettuce}"/>
<path d="M12 20.2v-8.4" stroke="${F.leafDark}" stroke-width="1.6"/>`,onion:`
<path d="M12 20.8c-4.1 0-6.8-2.7-6.8-6.4 0-3.5 2.7-6.6 6.8-8.6 4.1 2 6.8 5.1 6.8 8.6 0 3.7-2.7 6.4-6.8 6.4z" fill="#F4E6F7"/>
<path d="M12 6.2v14.6" stroke="${F.violet}" stroke-width="1.4"/>
<path d="M8.4 8.6c-1.1 2.5-1.3 5.6 0 9.1M15.6 8.6c1.1 2.5 1.3 5.6 0 9.1" stroke="${F.violet}" stroke-width="1.4"/>
<path d="M12 6.4c.4-2.1 1.9-3.2 3.6-3.4-.4 2.1-1.7 3.2-3.6 3.4z" fill="${F.lettuce}" stroke-width="1.3"/>`,candy:`
<ellipse cx="12" cy="12" rx="5.3" ry="4.7" fill="${F.candy}"/>
<path d="M6.8 10.1 2.7 7.2v9.6l4.1-2.9z" fill="${F.candyHi}"/>
<path d="M17.2 10.1 21.3 7.2v9.6l-4.1-2.9z" fill="${F.candyHi}"/>
<path d="M9.7 10.4a3 3 0 0 1 2-1.5" stroke="${F.cream}" stroke-width="1.6"/>`,swirl:`
<g fill="${F.water}">
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(120 12 12)"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(240 12 12)"/>
</g>
<circle cx="12" cy="12" r="1.8" fill="${F.cream}" stroke-width="1.4"/>`,chick:`
<path d="M10.4 4.4 11 1.8 12.8 4.2" stroke-width="1.8"/>
<ellipse cx="11.4" cy="15.8" rx="7.2" ry="6" fill="${F.mustardHi}"/>
<circle cx="11.6" cy="9.4" r="5.4" fill="${F.mustardHi}"/>
<path d="M16.6 8.2 22.2 10.2 16.6 12.2z" fill="${F.gold}"/>
<circle cx="13.4" cy="8.2" r="1.4" fill="${F.ink}" stroke="none"/>
<path d="M8.4 15a4 4 0 0 0 4.6 4.4" stroke="${F.gold}" stroke-width="1.9"/>`,burst:`<path d="${Yo(9,10.2,4.6)}" fill="${F.gold}"/>
<path d="${Yo(9,5.6,2.4)}" fill="${F.mustardHi}" stroke-width="1.3"/>`,hammer:`
<path d="M5.2 3.4h13.6a1.7 1.7 0 0 1 1.7 1.7v4.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V5.1a1.7 1.7 0 0 1 1.7-1.7z" fill="#C9B8DE"/>
<path d="M16.2 3.6v7.4" stroke-width="1.4"/>
<path d="M10.1 11h3.8v10.2h-3.8z" fill="${F.patty}"/>`,dough:`
<circle cx="8" cy="15.4" r="5.1" fill="#E6D4B0"/>
<circle cx="16.4" cy="14.6" r="4.3" fill="#EFE0C4"/>
<circle cx="12.6" cy="7.4" r="4.6" fill="#F7ECD6"/>
<path d="M10.8 5.9a2.6 2.6 0 0 1 1.8-1.4" stroke="${F.white}" stroke-width="1.5"/>`,cheese:`
<path d="M2.4 17.4 20.4 5.6a1.4 1.4 0 0 1 1.2 1.4v10.4a1.4 1.4 0 0 1-1.4 1.4H3.8a1.4 1.4 0 0 1-1.4-1.4z" fill="${F.mustard}"/>
<circle cx="9.4" cy="15.2" r="1.9" fill="#DE9A12" stroke="none"/>
<circle cx="16.2" cy="12.2" r="1.6" fill="#DE9A12" stroke="none"/>
<circle cx="17.6" cy="16.6" r="1.3" fill="#DE9A12" stroke="none"/>`,rice:`
<path d="M3.4 13.4h17.2c0 4.6-3.8 8-8.6 8s-8.6-3.4-8.6-8z" fill="${F.waterHi}"/>
<path d="M5.6 13.4a2.2 2.2 0 0 1 2.8-2 2.4 2.4 0 0 1 3.6-1.6 2.4 2.4 0 0 1 3.6 1.6 2.2 2.2 0 0 1 2.8 2z" fill="${F.white}"/>
<path d="M2.4 13.4h19.2" stroke-width="1.8"/>`,seaweed:`
<path d="M12 21.6V6" stroke="#2E6B3A" stroke-width="2.3"/>
<path d="M11.8 10c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>
<path d="M12.2 15.4c4.6 0 7-2.6 7-6.8-4.6 0-7 2.6-7 6.8z" fill="#4E9B5A"/>
<path d="M11.8 20.8c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>`,fish:`
<path d="M2.4 12.2c2.1-4 5.6-6.1 9.7-6.1 3.5 0 6 1.7 7.3 4.2-1.3 4.8-4.4 7.9-9 7.9-3.5 0-6-2.1-8-6z" fill="${F.water}"/>
<path d="M18.9 10.1 22.4 7v10.2l-3.5-3.4z" fill="${F.waterHi}"/>
<circle cx="7.1" cy="10.7" r="1.2" fill="${F.ink}" stroke="none"/>`,puffer:`
<path d="M11 1.8v6.8a4.1 4.1 0 1 1-8.2 0v-1.2" stroke-width="2.8"/>
<path d="M2.8 8.2 5.4 11.6" stroke-width="2.2"/>
<path d="M10.4 17.4c1.2-2.2 3.1-3.4 5.4-3.4 2 0 3.4 1 4.2 2.4-.8 2.7-2.6 4.5-5.2 4.5-2 0-3.4-1.2-4.4-3.5z" fill="${F.gold}"/>
<path d="M19.8 16.4 22.4 14.6v5.9l-2.6-1.9z" fill="${F.mustard}"/>
<circle cx="13.2" cy="16.9" r="1.1" fill="${F.ink}" stroke="none"/>`,droplets:`
<path d="M8.4 20.6a4.9 4.9 0 0 1-4.9-4.9c0-2.9 4.9-8.4 4.9-8.4s4.9 5.5 4.9 8.4a4.9 4.9 0 0 1-4.9 4.9z" fill="${F.water}"/>
<path d="M17.6 13.6a3.3 3.3 0 0 1-3.3-3.3c0-2 3.3-5.7 3.3-5.7s3.3 3.7 3.3 5.7a3.3 3.3 0 0 1-3.3 3.3z" fill="${F.waterHi}"/>`,noodle:`
<path d="M16.4 2 13 11.4" stroke="${F.woodHi}" stroke-width="2.6"/>
<path d="M21.7 3.9 18.3 13.3" stroke="${F.wood}" stroke-width="2.6"/>
<path d="M3.2 13.2h17.6c0 4.8-3.9 8.4-8.8 8.4s-8.8-3.6-8.8-8.4z" fill="${F.ketchup}"/>
<path d="M5.6 13.2a2.1 2.1 0 0 1 2.3-2.2 2.4 2.4 0 0 1 3.1-2.3 2.6 2.6 0 0 1 4 .2 2.4 2.4 0 0 1 3.3 2.1 2.1 2.1 0 0 1 1.5 2.2z" fill="${F.mustardHi}"/>
<path d="M8.8 11.2c0-1.6.9-2.6 2-2.6M13.6 11.4c0-1.7.9-2.7 2-2.7" stroke="#D9A417" stroke-width="1.4"/>
<path d="M2.2 13.2h19.6" stroke-width="1.8"/>`,wave:`
<path d="M2.4 18.6C4 11 8.5 6.6 13.6 6.6c4.1 0 7 2.5 7 5.8 0 2.7-1.9 4.6-4.2 4.6-2.1 0-3.6-1.4-3.6-3.2 0-1.6 1.1-2.6 2.4-2.6.9 0 1.7.5 1.9 1.3-1.4-.3-2.3.5-2.3 1.4 0 1 .8 1.7 1.9 1.7 1.5 0 2.5-1.2 2.5-2.9 0-2.3-2.1-4.2-5.2-4.2-4.4 0-7.9 3.8-9.4 10.1z" fill="${F.water}"/>
<path d="M2 21c2.7-1.5 4.4 1 7.1-.4M11.9 20.6c2.7-1.5 4.4 1 7.1-.4" stroke="${F.waterHi}" stroke-width="1.7"/>`,shards:`
<path d="M2.2 3.4 12.6 8.8 6.6 18.2z" fill="${F.ice}"/>
<path d="M15.2 2.6 22 11.4 13.4 13.6z" fill="${F.iceHi}"/>
<path d="M12.4 16 20.8 15.4 17 21.8z" fill="${F.ice}"/>`,cap:`
<g transform="rotate(9 12 12.4)">
<ellipse cx="12" cy="15" rx="9.2" ry="3.2" fill="#12669E"/>
<path d="M2.8 12h18.4v3H2.8z" fill="#12669E" stroke="none"/>
<ellipse cx="12" cy="12" rx="9.2" ry="3.2" fill="${F.water}"/>
<ellipse cx="12" cy="11.8" rx="5.6" ry="1.5" fill="${F.iceHi}" stroke-width="1.3"/>
</g>`,mustardblast:`
<path d="M9.7 11.4h4.6a4.3 4.3 0 0 1 0 8.6H9.7a4.3 4.3 0 0 1 0-8.6z" fill="#E8B15C"/>
<path d="M5 6.6h14a3.7 3.7 0 0 1 0 7.4H5a3.7 3.7 0 0 1 0-7.4z" fill="#C2452F"/>
<path d="M5.6 12 9 8.8 12.4 12 15.8 8.8 19.2 12" stroke="${F.mustard}" stroke-width="2.8"/>`,ketchupslip:`
<path d="M4.6 8.6h7.6a2.1 2.1 0 0 1 2.1 2.1v8.6a2.1 2.1 0 0 1-2.1 2.1H4.6a2.1 2.1 0 0 1-2.1-2.1v-8.6a2.1 2.1 0 0 1 2.1-2.1z" fill="${F.tomato}"/>
<path d="M6.6 3.2h3.6v5.4H6.6z" fill="${F.tomato}"/>
<path d="M7.2 1.4h2.4v1.9H7.2z" fill="#9E1B27"/>
<path d="M3.4 12.4h10" stroke="${F.cream}" stroke-width="2"/>
<path d="M18.4 8.6c2.4 0 3.6 1.5 3.4 3-.2 1.4-1.5 1.4-1.5 2.6 0 1.4-1.5 2.3-2.8 1.7-1.2-.6-2.4.3-3-.9-.6-1.2.3-1.9-.3-3 -.6-1.2.6-2.4 2-2.4 1 0 1.2-1 2.2-1z" fill="${F.tomato}"/>`,slash:`
<path d="M2.4 21.6C2 9 9 2 21.6 2.4 15 8 11 12 2.4 21.6z" fill="${F.steel}"/>
<path d="M20.4 3.6C13.4 7.4 8.2 12.4 4.4 18.8" stroke="${F.white}" stroke-width="2.2"/>
<path d="M8.6 21.4c3.4-2.8 6.2-5.6 8.4-8.6M14.4 21.6c2.4-2 4.4-4 6-6.2" stroke="#9C93B0" stroke-width="1.8"/>`,wrap:`
<path d="M4.4 17.6 15.6 6.4a4.4 4.4 0 0 1 3.6 3.6L8 21.2a4.4 4.4 0 0 1-3.6-3.6z" fill="#EFE0C4"/>
<path d="M15.6 6.4a4.4 4.4 0 0 1 3.6 3.6l2.8-2.8a4.4 4.4 0 0 0-3.6-3.6z" fill="#E9B44C"/>
<path d="M8.4 13.6 11.2 16.4M11.6 10.4 14.4 13.2" stroke="#CBB289" stroke-width="1.8"/>`,lollipop:`
<path d="M12 21.4v-6.6" stroke-width="2.3"/>
<circle cx="12" cy="9" r="6.3" fill="${F.candy}"/>
<path d="M12 9a2.1 2.1 0 1 0 2.1 2.1c0-2.3-2.3-3.7-4.6-2.9" stroke="${F.cream}" stroke-width="1.9"/>`,egg:`
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="#E4CFA6"/>
<path d="M12 4.8a6.7 8.3 0 0 1 0 16.6z" fill="#C9AE7C" stroke="none"/>
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="none"/>
<path d="M8.4 15.4a3.6 3.6 0 0 0 1.9 3.8" stroke="#FFF8EA" stroke-width="2"/>`,honey:`
<path d="M5.4 3.4h13.2v3.4H5.4z" fill="${F.gold}"/>
<path d="M8.2 6.6h7.6v2.6H8.2z" fill="#C98A00"/>
<path d="M6.6 9c-.9 2.6-1.3 4.9-1.3 7 0 3.3 2.2 5.2 6.7 5.2s6.7-1.9 6.7-5.2c0-2.1-.4-4.4-1.3-7z" fill="#C98A00"/>
<path d="M6.6 12.8h10.8v3.6H6.6z" fill="${F.mustardHi}" stroke-width="1.4"/>
<path d="M18.3 9.2c1.7 2.4 2.5 4.2 2.5 5.5 0 1.5-.9 2.5-2.2 2.5s-2.2-1-2.2-2.5c0-1.3.6-3 1.9-5.5z" fill="${F.mustardHi}"/>`},da={haze:"#5FBFA8",hazeDark:"#2E7C6B",cap:"#7A4A34",capHi:"#A9694A"},ay={tenderiser:`
<path d="M4.6 20.4 10.2 14.8" stroke-width="3.4"/>
<path d="M4.6 20.4 10.2 14.8" stroke="${F.patty}" stroke-width="1.9"/>
<path d="M11.6 8.2 17.4 14l-3.9 3.9L7.7 12.1z" fill="${F.wood}"/>
<path d="M13.1 6.7 18.9 12.5 17.4 14l-5.8-5.8z" fill="${F.woodHi}"/>
<circle cx="12.4" cy="12.4" r="0.75" fill="${F.pattyDark}" stroke="none"/>
<circle cx="14.6" cy="10.2" r="0.75" fill="${F.pattyDark}" stroke="none"/>
<circle cx="14.7" cy="14.6" r="0.75" fill="${F.pattyDark}" stroke="none"/>
<path d="M16.6 5.6 19 3.2l2.4 2.4M16.6 9.4 19 7l2.4 2.4" stroke="${F.gold}" stroke-width="1.9" fill="none"/>`,springform:`
<path d="M3.4 15.6C5 8.2 9.2 4.6 14.4 4.6" fill="none" stroke-width="4.4"/>
<path d="M3.4 15.6C5 8.2 9.2 4.6 14.4 4.6" fill="none" stroke="${F.mustard}" stroke-width="2.2"/>
<path d="M11.6 2.2 15 4.6l-3.2 2.6" stroke-width="3.6" fill="none"/>
<path d="M11.6 2.2 15 4.6l-3.2 2.6" stroke="${F.mustard}" stroke-width="1.8" fill="none"/>
<path d="M4.2 16.4h15.6v3.1a1.9 1.9 0 0 1-1.9 1.9H6.1a1.9 1.9 0 0 1-1.9-1.9z" fill="${F.steel}"/>
<path d="M3.2 15.2h17.6v1.9H3.2z" fill="${F.white}"/>
<path d="M18.1 17.2v3.4" stroke-width="1.4"/>
<circle cx="19.6" cy="18.9" r="1.4" fill="${F.gold}"/>`,warm_milk:`
<path d="M4.7 9.4h10.7v6.9a3.3 3.3 0 0 1-3.3 3.3H8a3.3 3.3 0 0 1-3.3-3.3z" fill="${F.cream}"/>
<path d="M15.4 11h1.5a2.3 2.3 0 0 1 0 4.6h-1.5"/>
<path d="M7.6 12.2h4.8l-4.8 4.2h4.8" stroke="${F.grape}" stroke-width="1.9" fill="none"/>
<path d="M8.6 2.8c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>
<path d="M12.2 2.4c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>`,pompa:`
<path d="M11.1 3.2h1.8v9.3h-1.8z" fill="${F.wood}"/>
<path d="M6.5 12.5h11c0 4.2-2.2 7.4-5.5 8.4-3.3-1-5.5-4.2-5.5-8.4z" fill="${F.ketchup}"/>
<path d="M5.5 12.5h13" stroke-width="2"/>`,squid_ink:`
<path d="M12 3.3c3.5 0 6.4 2.3 6.4 5.4 0 1.9-1 3.1-1 4.6 0 1.9 1.8 2.5 1.8 4.1 0 1.4-1.2 2.4-2.7 2.4-1.4 0-2.1-.8-3.3-.8-1.4 0-2 1.2-3.7 1.2-2 0-3.3-1.4-3.3-3.1 0-1.6 1-2.4 1-3.7 0-1.6-1.6-2.6-1.6-4.7 0-3.1 2.9-5.4 6.4-5.4z" fill="${F.grapeDark}"/>
<circle cx="20.6" cy="6.2" r="1.5" fill="${F.grapeDark}"/>
<circle cx="3.5" cy="18.4" r="1.2" fill="${F.grapeDark}"/>`,disposal:`
<ellipse cx="12" cy="12" rx="9.3" ry="8.6" fill="${F.steel}"/>
<ellipse cx="12" cy="12" rx="6" ry="5.4" fill="${F.grapeDark}"/>
<path d="M12 6.9c2.9 0 5.2 2.1 5.2 4.6" stroke="${F.grapeHi}" stroke-width="1.8" fill="none"/>
<path d="M6.6 12.5c0-2.2 1.9-4 4.4-4.3" stroke="${F.grapeHi}" stroke-width="1.6" fill="none"/>
<path d="M12 6.6v10.8M6.9 12h10.2" stroke-width="1.7"/>`,blue_cheese:`
<path d="M6.9 17.8h10.3a3.9 3.9 0 0 0 .4-7.8 4.8 4.8 0 0 0-8.9-2.3 4 4 0 0 0-1.8 10.1z" fill="${da.haze}"/>
<circle cx="9.7" cy="13.4" r="1.15" fill="${da.hazeDark}" stroke="none"/>
<circle cx="13.4" cy="11.3" r="1" fill="${da.hazeDark}" stroke="none"/>
<circle cx="15.7" cy="14.4" r="0.9" fill="${da.hazeDark}" stroke="none"/>
<circle cx="8.6" cy="20.6" r="1.1" fill="${da.haze}"/>
<circle cx="14.4" cy="20.8" r="0.9" fill="${da.haze}"/>`,shiitake:`
<path d="M2.9 15.4c0-3 2.2-5.4 5-5.4s5 2.4 5 5.4z" fill="${da.cap}"/>
<path d="M11.6 14.2c0-3.2 2.4-5.8 5.3-5.8s5.3 2.6 5.3 5.8z" fill="${da.cap}"/>
<path d="M5.6 12.6c0-3.9 2.9-7 6.4-7s6.4 3.1 6.4 7z" fill="${da.capHi}"/>
<path d="M5.6 12.6h12.8v1.5a1.6 1.6 0 0 1-1.6 1.6H7.2a1.6 1.6 0 0 1-1.6-1.6z" fill="${F.cream}"/>
<path d="M9.4 20.4 12 17.6l2.6 2.8" stroke="${F.ketchup}" stroke-width="2.2" fill="none"/>`,liquorice:`
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke-width="5"/>
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke="${F.ketchup}" stroke-width="2.4"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke-width="5"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke="${F.ketchup}" stroke-width="2.4"/>`,leftovers:`
<path d="M4.6 2.9h9.9a1.8 1.8 0 0 1 1.8 1.8v14.6a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V4.7a1.8 1.8 0 0 1 1.8-1.8z" fill="${F.steel}"/>
<path d="M2.8 8.8h13.5" stroke-width="1.6"/>
<path d="M13.1 5.2v2.2M13.1 10.6v2.6" stroke-width="1.6"/>
<path d="M16.3 4.9 21.6 3v18l-5.3-1.9z" fill="${F.mustardHi}"/>
<path d="M17.4 16.2 19.2 14l1.8 2.2" stroke-width="1.9" fill="none"/>`};function Is(t,e,a,o=""){return`
<path d="M3.4 9.4h17.2v9.4a1.7 1.7 0 0 1-1.7 1.7H5.1a1.7 1.7 0 0 1-1.7-1.7z" fill="${t}"/>
<path d="M3.4 9.4 6.6 5.6h10.8l3.2 3.8z" fill="${e}"/>
<path d="M9.8 7.0h4.4v5.6H9.8z" fill="${a}" stroke-width="1.3"/>
${o}`}const oy=`<path d="M12 0.6c2.6 2.2 3.7 3.9 3.2 5.5-.9-.8-1.6-1.1-2.3-.9.7 1.9.3 3.1-.9 4-1.2-.9-1.6-2.1-.9-4-.7-.2-1.4.1-2.3.9-.5-1.6.6-3.3 3.2-5.5z" fill="${F.flame}" stroke-width="1.3"/>`,ny=`<path d="M12 0.4c2.4.8 3.6 2.4 3.6 4.6-2.4-.7-3.6-2.3-3.6-4.6zM12 0.4c-2.4.8-3.6 2.4-3.6 4.6C10.8 4.3 12 2.7 12 .4z" fill="${F.lettuce}" stroke-width="1.3"/>`,sy=`<path d="M12 5.6C9.2 1.6 4.8 2.8 6.2 5.6M12 5.6C14.8 1.6 19.2 2.8 17.8 5.6" fill="${F.mustard}" stroke-width="1.4"/>`,iy=`<path d="M4.9 13.4a2.6 2.6 0 0 1 5.2 0z" fill="#B4622A" stroke-width="1.2"/>
<path d="M4.7 13.4h5.6v1.5H4.7z" fill="${F.lettuce}" stroke-width="1.2"/>
<path d="M4.9 15h5.2a2.2 2.2 0 0 1-5.2 0z" fill="#B4622A" stroke-width="1.2"/>`,ry=Array.from({length:8},(t,e)=>`<rect x="10.3" y="0.9" width="3.4" height="5.4" rx="1.2" fill="${F.gold}" transform="rotate(${e*45} 12 12)"/>`).join(""),ly={coin:`
<circle cx="12" cy="12" r="9.5" fill="${F.goldDark}"/>
<circle cx="12" cy="12" r="7.6" fill="${F.gold}" stroke="none"/>
<path d="${Yo(5,5.8,2.5,12,12)}" fill="${F.cream}" stroke="none"/>`,gem:`
<path d="M6.6 3.9h10.8l3.6 5.3L12 20.4 3 9.2z" fill="${F.water}"/>
<path d="M6.6 3.9 8.9 9.2h6.2l2.3-5.3z" fill="${F.ice}" stroke-width="1.3"/>
<path d="M3 9.2h18" stroke-width="1.3"/>
<path d="M8.9 9.2 12 20.4l3.1-11.2" stroke-width="1.3"/>`,trophy:`
<path d="M7.1 3.3h9.8v5a4.9 4.9 0 0 1-9.8 0z" fill="${F.gold}"/>
<path d="M7.1 4.9H4.3a3.3 3.3 0 0 0 3.3 4.3" stroke-width="1.8"/>
<path d="M16.9 4.9h2.8a3.3 3.3 0 0 1-3.3 4.3" stroke-width="1.8"/>
<path d="M12 13.1v3.3" stroke-width="2.2"/>
<path d="M7.9 20.7h8.2l-.8-2.6a1.2 1.2 0 0 0-1.2-.9h-4.2a1.2 1.2 0 0 0-1.2.9z" fill="${F.mustard}"/>
<path d="M9.6 5.1a3.4 3.4 0 0 0 .5 4.5" stroke="${F.cream}" stroke-width="1.4"/>`,star:`<path d="${Yo(5,9.4,4.1)}" fill="${F.mustard}"/>
<path d="M12 4.6 10.6 9" stroke="${F.mustardHi}" stroke-width="1.4"/>`,sparkle:`
<path d="M10.4 1.8c1.5 5.4 2.9 6.8 8.3 8.3-5.4 1.5-6.8 2.9-8.3 8.3-1.5-5.4-2.9-6.8-8.3-8.3 5.4-1.5 6.7-2.9 8.3-8.3z" fill="${F.mustard}"/>
<path d="M18.6 14.4c.7 2.6 1.4 3.3 4 4-2.6.7-3.3 1.4-4 4-.7-2.6-1.4-3.3-4-4 2.6-.7 3.3-1.4 4-4z" fill="${F.mustardHi}" stroke-width="1.5"/>`,flag:`
<path d="M5.6 21.2V3.2" stroke-width="2.2"/>
<path d="M5.6 4h13.6v9.2H5.6z" fill="${F.cream}"/>
<path d="M5.6 4h3.4v3.06H5.6zM12.4 4h3.4v3.06h-3.4zM9 7.06h3.4v3.07H9zM15.8 7.06h3.4v3.07h-3.4zM5.6 10.13h3.4v3.07H5.6zM12.4 10.13h3.4v3.07h-3.4z" fill="${F.ink}" stroke="none"/>`,pin:`
<path d="M12 21.4s6.7-6.5 6.7-11.1a6.7 6.7 0 1 0-13.4 0c0 4.6 6.7 11.1 6.7 11.1z" fill="${F.ketchup}"/>
<circle cx="12" cy="10.2" r="2.6" fill="${F.cream}"/>`,chest:`
<path d="M3.1 11.6h17.8v6.7a1.7 1.7 0 0 1-1.7 1.7H4.8a1.7 1.7 0 0 1-1.7-1.7z" fill="${F.wood}"/>
<path d="M3.1 8.2a8.9 4.2 0 0 1 17.8 0v3.4z" fill="${F.woodHi}"/>
<path d="M2.6 10.2h18.8v3H2.6z" fill="${F.gold}" stroke-width="1.4"/>
<path d="M10.3 9.8h3.4v5.4h-3.4z" fill="${F.mustard}" stroke-width="1.4"/>
<circle cx="12" cy="12.9" r="0.85" fill="${F.wood}" stroke="none"/>`,boxBurger:Is(F.gold,F.mustard,F.ketchup,iy),boxPineapple:Is(F.grape,F.grapeHi,F.mustard,ny),boxRed:Is(F.ketchup,"#E9536A",F.mustard,sy),boxFire:Is(F.grapeDark,F.grape,F.flame,oy),gift:`
<path d="M4 10.4h16v8.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.6z" fill="${F.ketchup}"/>
<path d="M2.6 6.4h18.8v4H2.6z" fill="#E9536A"/>
<path d="M10.2 6.4h3.6v13.8h-3.6z" fill="${F.mustard}" stroke-width="1.3"/>
<path d="M12 6.2c-2.6-3.4-6.2-2.4-5 .2M12 6.2c2.6-3.4 6.2-2.4 5 .2" fill="${F.mustard}" stroke-width="1.4"/>`,gear:`${ry}
<circle cx="12" cy="12" r="7.4" fill="${F.gold}"/>
<circle cx="12" cy="12" r="3.3" fill="${F.cream}"/>`,lock:`
<path d="M7.5 10.4V7.9a4.5 4.5 0 0 1 9 0v2.5" stroke-width="1.9"/>
<path d="M4.4 10.2h15.2a1.9 1.9 0 0 1 1.9 1.9v6.6a1.9 1.9 0 0 1-1.9 1.9H4.4a1.9 1.9 0 0 1-1.9-1.9v-6.6a1.9 1.9 0 0 1 1.9-1.9z" fill="${F.gold}"/>
<circle cx="12" cy="14.4" r="1.7" fill="${F.ink}" stroke="none"/>
<path d="M12 15.4v2.6" stroke-width="1.9"/>`,play:'<path d="M7.6 4.2 19.4 12 7.6 19.8z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>',pause:`
<path d="M6.4 4.4h4.2v15.2H6.4z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>
<path d="M13.4 4.4h4.2v15.2h-4.2z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>`,back:'<path d="M15.2 4.4 7.4 12l7.8 7.6" stroke-width="2.8"/>',close:'<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" stroke-width="2.8"/>',check:'<path d="M4.6 12.4 9.4 17.4 19.4 6.8" stroke-width="3"/>',home:`
<path d="M3 11.6 12 3.4l9 8.2" stroke-width="2.1"/>
<path d="M5.4 10.6h13.2v9.8H5.4z" fill="${F.gold}"/>
<path d="M9.6 14h4.8v6.4H9.6z" fill="${F.wood}"/>`,swap:`
<path d="M4.6 10.2a7.4 7.4 0 0 1 12.6-3.6" stroke-width="2.2"/>
<path d="M17.6 2.9v4.2h-4.2" stroke-width="2.2"/>
<path d="M19.4 13.8a7.4 7.4 0 0 1-12.6 3.6" stroke-width="2.2"/>
<path d="M6.4 21.1v-4.2h4.2" stroke-width="2.2"/>`,mute:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${F.cream}"/>
<path d="M15.4 9.4 20.6 14.6M20.6 9.4 15.4 14.6" stroke="${F.tomato}" stroke-width="2.4"/>`,sound:`
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${F.cream}"/>
<path d="M15.2 9a4.2 4.2 0 0 1 0 6" stroke-width="1.9"/>
<path d="M18 6.4a8 8 0 0 1 0 11.2" stroke-width="1.9"/>`,cone:`
<path d="M12 3 18.8 18.6H5.2z" fill="${F.gold}"/>
<path d="M9.3 11.4h5.4M8 15h8" stroke="${F.cream}" stroke-width="2.1"/>
<path d="M3.2 18.4h17.6a1.2 1.2 0 0 1 1.2 1.2v.2a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 19.8v-.2a1.2 1.2 0 0 1 1.2-1.2z" fill="${F.ketchup}"/>`,chefhat:`
<path d="M6.6 12.4a3.9 3.9 0 1 1 1.6-7.4 4.3 4.3 0 0 1 7.6 0 3.9 3.9 0 1 1 1.6 7.4z" fill="${F.cream}"/>
<path d="M6.6 12.2h10.8v6a1.4 1.4 0 0 1-1.4 1.4H8a1.4 1.4 0 0 1-1.4-1.4z" fill="${F.cream}"/>
<path d="M6.6 15.4h10.8" stroke-width="1.4"/>`,avatar:`
<path d="M3.4 21.2a8.6 8.6 0 0 1 17.2 0z" fill="${F.gold}"/>
<circle cx="12" cy="11.6" r="5" fill="${F.mustard}"/>
<path d="M7.2 8.4a2.9 2.9 0 1 1 1.6-5.3 3.6 3.6 0 0 1 6.4 0 2.9 2.9 0 1 1 1.6 5.3z" fill="${F.cream}"/>
<path d="M7.2 8.2h9.6v2.2H7.2z" fill="${F.cream}"/>`,damage:`
<path d="M20.6 1.6 21.4 6.6 9.8 18.2 6.4 14.8z" fill="${F.steel}"/>
<path d="M20.6 1.6 15.6 2.4 4 14l3.4 3.4z" fill="#B7AFC7" stroke="none"/>
<path d="M20.6 1.6 6.4 14.8" stroke-width="1.4"/>
<path d="M3.6 15.2 8.8 20.4" stroke="${F.ketchup}" stroke-width="3.4"/>
<path d="M1.8 20.2 5.4 16.6" stroke-width="2.4"/>`,health:`<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${F.ketchup}"/>
<path d="M7.2 10.4a2.6 2.6 0 0 1 2-1.6" stroke="${F.cream}" stroke-width="1.5"/>`,speed:`<path d="M13.8 2.2 5.6 13.4h4.8l-1.6 8.4 8.8-11.6h-5z" fill="${F.mustard}"/>`,range:`
<path d="M3.4 12h17.2" stroke-width="2.3"/>
<path d="M7.2 8.1 3.2 12l4 3.9" stroke-width="2.3"/>
<path d="M16.8 8.1 20.8 12l-4 3.9" stroke-width="2.3"/>`,timer:`
<circle cx="12" cy="13.6" r="7.7" fill="#C9B8DE"/>
<path d="M9.5 2.4h5" stroke-width="2.1"/>
<path d="M12 2.4v3.5" stroke-width="2.1"/>
<path d="M12 13.6V8.2" stroke="${F.ketchup}" stroke-width="2.4"/>
<path d="M12 13.6 21.4 7.4" stroke="${F.ketchup}" stroke-width="2.4"/>`,heal:`
<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${F.lettuce}"/>
<path d="M12 9.6v5.6M9.2 12.4h5.6" stroke="${F.cream}" stroke-width="2.1"/>`,stun:`<path d="${Yo(5,8.6,3.7,10.2,10.6)}" fill="${F.mustard}"/>
<path d="${Yo(5,4.2,1.8,19.2,18)}" fill="${F.mustardHi}" stroke-width="1.4"/>`,slow:`
<path d="M13 7.6 21.8 3.6 18.4 13.2z" fill="${F.gold}"/>
<circle cx="10.6" cy="14.2" r="7.8" fill="${F.gold}"/>
<path d="M14.2 18.4a5 5 0 1 1 1-5.6" stroke="#5A3200" stroke-width="2.8" fill="none" stroke-linecap="round"/>
<circle cx="10.6" cy="14.2" r="1.7" fill="#5A3200" stroke="none"/>`,medal:`
<path d="M8.4 2.2 11 8.6H7L4.4 2.2z" fill="${F.ketchup}"/>
<path d="M15.6 2.2 13 8.6h4l2.6-6.4z" fill="${F.water}"/>
<circle cx="12" cy="15.2" r="6.6" fill="${F.gold}"/>
<circle cx="12" cy="15.2" r="3.4" fill="${F.mustard}" stroke-width="1.3"/>`,party:`
<path d="M3.4 20.9 9 8.2l6.8 6.8z" fill="${F.ketchup}"/>
<path d="M9 8.2 15.8 15" stroke-width="1.4"/>
<circle cx="18.7" cy="5.5" r="1.6" fill="${F.mustard}"/>
<circle cx="14.2" cy="3.4" r="1.3" fill="${F.lettuce}"/>
<circle cx="20.8" cy="10.4" r="1.3" fill="${F.water}"/>
<path d="M16.2 8.8 18.6 6.4" stroke-width="1.4"/>`},Tt=416,Ft=496,Fd=Tt/Ft,hy=.42,cy=.07,zr=.08,dy=.66,py=.08,ao={x0:.035,x1:.965,y0:.045,y1:.725},uy=.7,Pr=.18,$r=.92,fy=1.15,xo=new Map,Br=new Map,Zl=[];let Ur=!1;function my(t){const a=document.createElement("canvas");a.width=8,a.height=8;const o=a.getContext("2d",{willReadFrequently:!0});if(!o)return[0,0,0];o.drawImage(t,0,0,8,8);const n=o.getImageData(0,0,8,8).data;let s=0,i=0,r=0;for(let h=0;h<n.length;h+=4)s+=n[h],i+=n[h+1],r+=n[h+2];const l=n.length/4;return[Math.round(s/l),Math.round(i/l),Math.round(r/l)]}function zh(t){return xo.get(t)}function Jl(){const t=[...Te];if(typeof document>"u"||typeof window<"u"&&window.__screen==="characters")return t;const e=new Set;for(const a of document.querySelectorAll("[data-portrait]")){const o=a.dataset.portrait;Te.includes(o)&&e.add(o)}return!e.size&&(typeof window>"u"||!window.__screen)?t:[...e]}function af(t){for(const a of Te){const o=xo.get(a);o&&t(a,o)}if(Te.every(a=>xo.has(a))){window.__thumbsReady=!0;return}if(Zl.push(t),Ur)return;Ur=!0,window.__thumbsReady=!1;const e=()=>void gy().finally(()=>{Ur=!1,Zl.length=0,window.__thumbsReady=Jl().every(a=>xo.has(a))});typeof requestIdleCallback=="function"?requestIdleCallback(e,{timeout:600}):setTimeout(e,120)}async function gy(){if(!Jl().some(a=>!xo.has(a)))return;const t=document.createElement("div");t.style.cssText=`position:fixed;left:-9999px;top:0;width:${Tt}px;height:${Ft}px;pointer-events:none;`,document.body.appendChild(t);let e=null;try{e=new xh({container:t,background:0,fog:null,camera:{pitchDeg:12,yawDeg:24,frameMode:"subject",subjectHeight:2.1,subjectFill:1,targetHeight:1.05,followLerp:1},shadows:!1,postFx:"grade",offscreen:!0,maxPixelRatio:1}),e.canvas.style.cssText=`display:block;width:${Tt}px;height:${Ft}px;`,e.resize();const a=new Set;for(;;){const o=Jl().filter(n=>!xo.has(n)&&!a.has(n));if(!o.length)break;for(const n of o)a.add(n),await by(e,n)}}catch{}finally{e?.dispose(),t.remove()}}function Fn(t,e,a,o){const n=new pe,s=t.getCenter(n.clone()).applyMatrix4(e.matrixWorldInverse).z;let i=1/0,r=1/0,l=-1/0,h=-1/0;for(let c=0;c<8;c++){n.set(c&1?t.max.x:t.min.x,c&2?t.max.y:t.min.y,c&4?t.max.z:t.min.z).applyMatrix4(e.matrixWorldInverse),n.z=s,n.applyMatrix4(e.projectionMatrix);const d=(n.x*.5+.5)*a,p=(1-(n.y*.5+.5))*o;i=Math.min(i,d),l=Math.max(l,d),r=Math.min(r,p),h=Math.max(h,p)}return{x:+i.toFixed(1),y:+r.toFixed(1),w:+(l-i).toFixed(1),h:+(h-r).toFixed(1)}}function Nd(t,e){const a=t.getObjectByName(e);if(!a)return null;const o=new Vn().setFromObject(a);return o.isEmpty()?null:o}function wy(t,e,a){const o=new pe;let n=0;return t.traverse(s=>{const i=s;if(!i.isMesh||!i.visible)return;const r=i.geometry?.getAttribute("position");if(r)for(let l=0;l<r.count;l++){if(o.fromBufferAttribute(r,l).applyMatrix4(i.matrixWorld),o.y<e)continue;const h=Math.abs(o.dot(a));h>n&&(n=h)}}),n}async function by(t,e){const a=vh(e);t.scene.add(a.root),a.play("idle"),a.update({dt:.4,elapsed:.4,moveSpeed01:0,health01:1});const o=new Vn().setFromObject(a.root),n=Nd(a.root,"head"),s=Nd(a.root,"face"),i=Math.max(.5,o.max.y-o.min.y),r=o.max.y,l=(s??n)?.min.y??o.min.y+.45*i,h=Math.max(o.min.y,Math.min(o.min.y+hy*i,l-cy*i)),c=Math.max(.4,r-h),d=t.rig.camera,p=new pe,u=(O,D,_)=>{t.rig.subjectFill=1,t.rig.subjectHeight=O,t.rig.targetHeight=D-O/2,t.rig.snapTo(_*p.x,_*p.z),d.updateMatrixWorld(!0),d.matrixWorldInverse.copy(d.matrixWorld).invert()};u(c/$r,r+zr*(c/$r),0),p.setFromMatrixColumn(d.matrixWorld,0).normalize();const m=wy(a.root,h,p),f=Math.max(c/$r,2*m/(Fd*fy),s?(r-s.min.y)/(dy+py):0);let g=r+zr*f,w=0,b=f;if(s){const O=()=>r-Pr*b;for(let D=0;D<4;D++){g=r+zr*b;for(let H=0;H<3;H++){u(b,g,w);const j=Fn(s,d,Tt,Ft),S=(j.y+j.h)/Ft-uy;if(S<=0)break;const N=Math.max(0,(j.y/Ft-ao.y0)*b),q=Math.max(O(),g-Math.min(S*b,N));if(Math.abs(q-g)<1e-4)break;g=q}u(b,g,w);const _=Fn(s,d,Tt,Ft),E=_.x+_.w-ao.x1*Tt,A=ao.x0*Tt-_.x,C=b*Fd/Tt;E>0&&A<0?w+=Math.min(E,-A)*C:A>0&&E<0&&(w-=Math.min(A,-E)*C);const R=_.w/((ao.x1-ao.x0)*Tt),I=(_.y+_.h)/Ft,L=I>ao.y1?(I+Pr)/(ao.y1+Pr):1,B=Math.max(R,L);if(B<=1.001)break;b*=B}}u(b,g,w);const y=kh[ie[e].rarity];t.scene.background=new Kt(y),t.lighting.focus(0,0,4),Br.has(y)||(a.root.visible=!1,t.render(0),Br.set(y,my(t.canvas)),a.root.visible=!0),t.render(0),t.render(0);const x=t.canvas.toDataURL("image/png"),k=a.root.getObjectByName("hips"),T=a.root.getObjectByName("shoulderL"),v=new pe;(window.__thumbMeta??={})[e]={size:{w:Tt,h:Ft},subject:Fn(o,d,Tt,Ft),head:n?Fn(n,d,Tt,Ft):null,face:s?Fn(s,d,Tt,Ft):null,bg:Br.get(y)??null,world:{minY:+o.min.y.toFixed(4),maxY:+o.max.y.toFixed(4),halfWidth:+Math.max(Math.abs(o.min.x),Math.abs(o.max.x)).toFixed(4),hipsY:k?+k.getWorldPosition(v).y.toFixed(4):null,shoulderY:T?+T.getWorldPosition(v).y.toFixed(4):null,headY:n?[+n.min.y.toFixed(4),+n.max.y.toFixed(4)]:null,faceY:s?[+s.min.y.toFixed(4),+s.max.y.toFixed(4)]:null,yCut:+h.toFixed(4),upperHalfWidth:+m.toFixed(4)},frame:{subjectHeight:+t.rig.subjectHeight.toFixed(4),subjectFill:+t.rig.subjectFill.toFixed(4),targetHeight:+t.rig.targetHeight.toFixed(4),headroom:+((g-r)/b).toFixed(4),pan:+w.toFixed(4)}},t.scene.remove(a.root),a.dispose(),xo.set(e,x);for(const O of Zl)O(e,x);await new Promise(O=>setTimeout(O,0))}const yy='<circle cx="12" cy="9" r="5.6" fill="#FFF3DE"/><path d="M5.2 21.6c0-3.5 3-5.6 6.8-5.6s6.8 2.1 6.8 5.6z" fill="#FFF3DE"/>';function vo(t,e={}){const a=kh[ie[t].rarity],o=zh(t),n=["fa-ic-portrait",e.crop==="head"?"fa-ic-portrait--head":"",o?"has-render":"",e.class??""].filter(Boolean).join(" "),s=o?` src="${o}"`:"";return`<span class="${n}" data-portrait="${t}" style="--pc:${a}"><img alt=""${s}/><svg class="fa-ic" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${yy}</svg></span>`}function ko(t,e={}){const a=(o,n)=>{for(const s of t.querySelectorAll(`[data-portrait="${o}"]`)){const i=s.querySelector("img");i&&(i.getAttribute("src")!==n&&i.setAttribute("src",n),s.classList.add("has-render"))}};if(e.generate===!1){for(const o of t.querySelectorAll("[data-portrait]")){const n=o.dataset.portrait,s=zh(n);s&&a(n,s)}return}af(a)}const xy={...ly,...ty,...ay},vy='viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"';function P(t,e={}){const a=xy[t];if(!a)return"";const o=["fa-ic",`fa-ic--${t}`,e.class??""].filter(Boolean).join(" "),n=e.size??"1em",s=e.label?`role="img" aria-label="${e.label}"`:'aria-hidden="true" focusable="false"';return`<svg class="${o}" ${vy} width="${n}" height="${n}" ${s}>${a}</svg>`}const ky={"🪙":"coin","💎":"gem","🏆":"trophy","⭐":"star","✨":"sparkle","🏁":"flag","📍":"pin","🎉":"party","🎁":"gift","🧑‍🍳":"chefhat","⚙️":"gear","⚙":"gear","🔒":"lock","▶":"play","⏸":"pause","◀":"back","🙂":"avatar","🚧":"cone","🔇":"mute","🔊":"sound","🏠":"home","🍟":"swap","❤️":"health","❤":"health","💨":"speed","↔":"range","⏱":"timer","💚":"heal","💫":"stun","🐌":"slow","🍖":"patty","🍅":"tomato","🥬":"lettuce","🧅":"onion","🍬":"candy","🥩":"meat","🌯":"wrap","🌀":"swirl","🥚":"egg","🐣":"chick","💥":"burst","🔨":"hammer","🍭":"lollipop","⚪":"dough","🧀":"cheese","🍚":"rice","🌿":"seaweed","🐟":"fish","🐡":"puffer","💦":"droplets","🍜":"noodle","🌊":"wave","🧊":"shards","🔵":"cap","💛":"mustardblast","🔴":"ketchupslip","⚔️":"slash","⚔":"damage","🍯":"honey","💧":"droplets"},My={chest:"chest",hamburgerBox:"boxBurger",pineappleBox:"boxPineapple",redBox:"boxRed",fireBox:"boxFire"};function Ha(t,e={}){const a=ky[t];return a?P(a,e):t}function Ut(t,e={}){return P(My[t]??"chest",e)}function of(t,e={}){return Ha(t,e)}const Ld="fa-icon-styles";function Ta(){if(document.getElementById(Ld))return;const t=document.createElement("style");t.id=Ld,t.textContent=Ey,document.head.appendChild(t)}const Ey=`
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
`,Dd=[na.tomato,na.mustard,na.lettuce,na.cheese,na.glaze,na.waterCap];function Ei(t,e=50,a=26){for(let o=0;o<a;o++){const n=document.createElement("span");n.className="fa-confetti",n.style.left=`${e+(Math.random()*12-6)}%`,n.style.background=Dd[Math.floor(Math.random()*Dd.length)],n.style.animationDelay=`${(Math.random()*.22).toFixed(2)}s`,n.style.setProperty("--x",`${Math.round(Math.random()*240-120)}px`),t.appendChild(n),setTimeout(()=>n.remove(),1800)}}function Ue(t,e,a){const o=document.createElement(t);return e&&(o.className=e),o}const Ty=null,Hd="Open to a player",_d="Online play is not connected yet. This seat is played by a bot.";function Sy(t){return`Online play is not connected yet, so ${t===1?"the other seat is":`all ${t} other seats are`} played by a bot. Opening a seat to another player is switched off rather than offered as a button that does nothing.`}const nf="food-arena.loadout.v1";function Ph(t){let e=null;try{e=localStorage.getItem(nf)}catch{return[]}if(e===null)return[];let a;try{a=JSON.parse(e)}catch{return[]}if(!Array.isArray(a))return[];const o=[];for(const n of a){if(o.length>=Rt)break;typeof n!="string"||!$h(n)||!t.has(n)||o.includes(n)||o.push(n)}return o}function zd(t){try{localStorage.setItem(nf,JSON.stringify(t.slice(0,Rt)))}catch{}}function $h(t){return wa.includes(t)}function Bh(t){const e=window.__faOwnedItems;return e?new Set(e.filter($h)):new Set(wa)}function Ay(){return""}const Pd="Items come from boxes and from the trophy road.";function Ry(t){return t==="passive"?"Passive":t==="triggered"?"Triggered":"Active"}function $d(t){const e=[Ry(t.kind)];return t.cooldownMs!==null?e.push(`${+(t.cooldownMs/1e3).toFixed(1)} s cooldown`):t.kind==="passive"?e.push("always on"):e.push("once a match"),t.minAlive>rt&&e.push(`needs ${t.minAlive} fighters alive`),e.join(" · ")}function Iy(t){Ea("fa-lobby-styles",Cy),Ta();const e=window.__faOpenSeat!==void 0?window.__faOpenSeat:Ty,a=e!==null,o=t.profile.selected,n=Oy(o);let s=jc[0];const i=Ue("div","fa-screen fa-lobby");i.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${P("back")} Back</button>
      <h1 class="fa-title lobby-heading">Match Lobby</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${P("party")}</span>Players <span class="fa-chip-val ds-chip-val ds-num" data-el="count">2</span></div>
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
      <button class="fa-btn ds-btn ds-btn--primary lobby-start" type="button" data-el="start">${P("play")} Start</button>
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
                  aria-label="Close the item picker">${P("close")}</button>
        </header>
        <p class="lobby-sheet-sub" data-el="sheet-sub"></p>
        <div class="fa-scroll lobby-sheet-list" data-el="sheet-list"></div>
      </div>
    </div>
  `;const r=S=>{const N=i.querySelector(`[data-el="${S}"]`);if(!N)throw new Error(`lobby: missing element "${S}"`);return N},l=r("seats"),h=r("opts"),c=r("note"),d=r("kit-slots"),p=r("kit-note"),u=r("kit-owned"),m=r("sheet"),f=r("sheet-list"),g=r("sheet-sub");for(const S of jc){const N=Ue("button","ds-btn lobby-opt");N.type="button",N.dataset.seats=String(S),N.textContent=String(S),N.setAttribute("aria-label",`${S} players`),h.appendChild(N)}function w(){r("count").textContent=String(s);for(const S of h.querySelectorAll(".lobby-opt")){const N=Number(S.dataset.seats)===s;S.classList.toggle("is-on",N),S.setAttribute("aria-pressed",N?"true":"false")}}function b(){const S=S0(o,n,s),N=t.profile.characterLevel(o),q=z0(N);l.innerHTML=S.map((U,V)=>{const ne=V===0,z=ie[U].name,Q=ne?N:q,de=ne?"You":"Bot",Oe=ne?`<button class="ds-btn ds-btn--icon lobby-seat-act" type="button" data-el="swap"
             title="Change your fighter" aria-label="Change your fighter">${P("swap")}</button>`:`<button class="ds-btn ds-btn--icon lobby-seat-act lobby-seat-open" type="button"
             data-el="open" data-slot="${V}"${a?"":" disabled"}
             title="${Hd}. ${_d}"
             aria-label="${Hd} — seat ${V+1}. ${a?"":_d}">${P("avatar")}</button>`;return`
        <div class="lobby-seat${ne?" is-you":""}" data-seat="${V}" data-char="${U}">
          <span class="lobby-seat-pic">${vo(U,{crop:"head"})}</span>
          <span class="lobby-seat-body">
            <span class="lobby-seat-name" data-el="seat-name">${z}</span>
            <span class="lobby-seat-tag"><b>${de}</b> · Lv ${Q}</span>
          </span>
          ${Oe}
        </div>`}).join(""),ko(l)}const y=Bh(t.profile.economy);let x=Ph(y),k=null;function T(){const S=N=>oi.indexOf(Le[N].rarity);return[...wa].sort((N,q)=>{const U=y.has(N)?0:1,V=y.has(q)?0:1;if(U!==V)return U-V;const ne=S(N)-S(q);return ne!==0?ne:wa.indexOf(N)-wa.indexOf(q)})}function v(S,N){return`<span class="fa-rarity ${N}" style="background:${It[S]}">${S}</span>`}function O(S){const N=x[S],q=S+1;if(N===void 0){const z=y.size===0?`Slot ${q}: empty. You do not own any items yet.`:`Slot ${q}: empty. Choose an item.`;return`
        <button class="lobby-slot is-empty" type="button" data-el="slot" data-slot="${S}"
                title="${z}" aria-label="${z}">
          <span class="lobby-slot-plus" aria-hidden="true">+</span>
          <span class="lobby-slot-txt"><span class="lobby-slot-name">Add item</span></span>
        </button>`}const U=Le[N],V=s<U.minAlive,ne=`Slot ${q}: ${U.name}, ${U.rarity}. ${U.blurb}${V?` Needs ${U.minAlive} fighters; this match has ${s}.`:""} Change it.`;return`
      <button class="lobby-slot is-filled${V?" is-dead":""}" type="button"
              data-el="slot" data-slot="${S}" title="${ne}" aria-label="${ne}">
        <span class="lobby-slot-ic">${P(N)}</span>
        <span class="lobby-slot-txt">
          <span class="lobby-slot-name">${U.name}</span>
          ${v(U.rarity,"lobby-slot-rar")}
        </span>
      </button>`}function D(){d.innerHTML=Array.from({length:Rt},(q,U)=>O(U)).join(""),u.textContent=`${y.size} of ${wa.length} owned`;const S=y.size===0?Pd:Ay();p.textContent=S,p.hidden=S==="";const N=x.filter(q=>s<Le[q].minAlive);N.length>0&&(p.textContent=N.map(q=>`${Le[q].name} needs ${Le[q].minAlive} fighters alive; this match has ${s}.`).join(" "),p.hidden=!1)}function _(S){const N=Le[S],q=y.has(S),U=x.indexOf(S),V=q?U>=0?`In slot ${U+1}`:"Equip":"Not owned yet",ne=q?"":" You do not own this item yet.",z=`${N.name}, ${N.rarity}. ${N.blurb} ${$d(N)}.${ne}`;return`
      <button class="lobby-item${q?"":" is-locked"}${U>=0?" is-on":""}" type="button"
              data-item="${S}"${q?"":" disabled"}
              title="${z}" aria-label="${z}">
        <span class="lobby-item-ic">${P(S)}</span>
        <span class="lobby-item-body">
          <span class="lobby-item-top">
            <span class="lobby-item-name">${N.name}</span>
            ${v(N.rarity,"lobby-item-rar")}
          </span>
          <span class="lobby-item-blurb">${N.blurb}</span>
          <span class="lobby-item-meta">${$d(N)}</span>
        </span>
        <span class="lobby-item-state">
          ${q?U>=0?P("check"):"":P("lock")}<span>${V}</span>
        </span>
      </button>`}function E(){if(k===null)return;const S=x[k];g.textContent=y.size===0?`You own none of these ${wa.length} yet. ${Pd}`:S===void 0?`Slot ${k+1} of ${Rt}. Pick one of the ${y.size} you own.`:`Slot ${k+1} of ${Rt} holds ${Le[S].name}. Pick another, or take it out.`;const N=T().map(_).join(""),q=S===void 0?"":`
      <button class="ds-btn lobby-item-clear" type="button" data-el="clear"
              aria-label="Take ${Le[S].name} out of slot ${k+1}">
        ${P("close")} Take out ${Le[S].name}
      </button>`;f.innerHTML=N+q}function A(S){k=S,E(),m.hidden=!1,r("sheet-x").focus()}function C(){const S=k;k=null,m.hidden=!0,d.querySelector(`[data-slot="${S}"]`)?.focus()}function R(S){if(k===null||!y.has(S))return;const N=Math.min(k,x.length),q=x.slice(),U=q.indexOf(S);if(U===N){C();return}const V=q[N];N<q.length?q[N]=S:q.push(S),U>=0&&(V===void 0?q.splice(U,1):q[U]=V),x=q.slice(0,Rt),zd(x),C(),D()}function I(S){x=x.filter((N,q)=>q!==S),zd(x),C(),D()}function L(){c.textContent=a?"":Sy(s-1),c.hidden=a}function B(){w(),b(),L(),D()}const H=S=>{const N=S.target,q=N?.closest(".lobby-opt");if(q){const z=Number(q.dataset.seats);Number.isInteger(z)&&z!==s&&(s=z,B());return}const U=N?.closest('[data-el="slot"]');if(U){A(Number(U.dataset.slot));return}if(N?.closest('[data-el="clear"]')){k!==null&&I(Math.min(k,Math.max(0,x.length-1)));return}if(N?.closest('[data-el="sheet-x"]')||N?.closest('[data-el="sheet-scrim"]')){C();return}const V=N?.closest(".lobby-item");if(V){const z=V.dataset.item;z!==void 0&&$h(z)&&R(z);return}const ne=N?.closest('[data-el="open"]');if(ne){e?.(Number(ne.dataset.slot));return}if(N?.closest('[data-el="swap"]')){t.navigate({name:"characters"});return}N?.closest('[data-el="back"]')&&t.navigate({name:"home"})};i.addEventListener("click",H);const j=S=>{S.key==="Escape"&&k!==null&&(S.stopPropagation(),C())};return i.addEventListener("keydown",j),r("start").addEventListener("click",()=>{const S={name:"match",player:o,enemy:n,seats:Vi(s)};t.navigate(S)}),B(),{root:i,dispose(){i.removeEventListener("click",H),i.removeEventListener("keydown",j),i.remove()}}}function Oy(t){const e=Te.filter(a=>a!==t);return e[Math.floor(Math.random()*e.length)]}const Cy=`
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
`,Fy="Kitchen Rumble";function Ny(t){const e=Math.round(t/1e3);return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`}function Ly(t){Ea("fa-home-styles",Dy),Ta();const e=Ue("div","fa-screen fa-home"),a=Lh();a.setScene("lobby"),e.innerHTML=`
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
      <div class="fa-chip ds-chip ds-chip--slate"><span class="fa-chip-em">${P("avatar")}</span><span data-el="name"></span></div>
      <div class="fa-chip ds-chip ds-chip--slate"><span class="fa-chip-em">${P("trophy")}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="trophies">0</span></div>
      <div class="fa-chip ds-chip ds-chip--slate home-chip-coin"><span class="fa-chip-em">${P("coin")}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="coins">0</span></div>
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
        <button class="fa-tab is-active" type="button">${P("home")} Home</button>
        <button class="fa-tab" type="button" data-go="characters">${P("chefhat")} Foods</button>
        <button class="fa-tab" type="button" data-go="trophies">${P("trophy")} Trophies</button>
        <!-- The one destination on this bar that cannot currently sell anything, and it
             is here anyway. The lobby's standing rule is "nothing advertises something
             that does not work", and the shop passes it on the same terms the gem store
             already does: nothing on it is a live-looking control that no-ops, every
             price and every drop rate on it is real, and it states in words that buying
             is off and why. Hidden would have been the dishonest option — it would put
             a compliance surface where no screenshot, no contrast battery and no
             acceptance test can reach it. See the header of shop.ts. -->
        <button class="fa-tab" type="button" data-go="shop">${P("coin")} Shop</button>
      </nav>
      <button class="fa-iconbtn" type="button" data-el="settings" aria-label="Settings">${P("gear")}</button>
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
            <span class="home-track-icon" data-el="roadicon">${P("chest")}</span>
            <span class="home-track-title" data-el="roadtitle">Next reward</span>
            <span class="home-track-pill" data-el="roadpill">${P("trophy")}</span>
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
            <span class="home-track-icon">${P("gift")}</span>
            <span class="home-track-title">Free chest</span>
            <span class="home-pips" data-el="pips"></span>
          </span>
          <span class="home-track-sub" data-el="chestsub"></span>
        </button>

        <button class="home-track home-track--held" type="button" data-go="trophies" data-el="held" hidden>
          <span class="home-track-top">
            <span class="home-track-icon">${P("chest")}</span>
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
          <div class="home-rec"><span class="home-rec-ic">${P("medal")}</span><span class="home-rec-val is-win" data-el="wins">0</span><span class="home-rec-key">Wins</span></div>
          <div class="home-rec"><span class="home-rec-ic">${P("close")}</span><span class="home-rec-val is-loss" data-el="losses">0</span><span class="home-rec-key">Losses</span></div>
          <div class="home-rec"><span class="home-rec-ic">${P("trophy")}</span><span class="home-rec-val is-best" data-el="best">0</span><span class="home-rec-key">Best</span></div>
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
          ${P("swap")} Change
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
        <span class="home-mode-tile" aria-hidden="true">${P("party")}</span>
        <span class="home-mode-lines">
          <span class="home-mode-name">${Fy}</span>
          <span class="home-mode-sub" data-el="modesub">${Ny(Wa)} · last one standing</span>
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
        <span class="home-mode-go" aria-hidden="true">${P("back")}</span>
      </button>
      <button class="fa-btn fa-btn--primary" type="button" data-el="start">${P("play")} Start Game</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const o=E=>{const A=e.querySelector(`[data-el="${E}"]`);if(!A)throw new Error(`home: missing element "${E}"`);return A},n=o("stage3d"),s=o("confetti"),i=o("heroname"),r=o("herorarity"),l=o("hint");let h=0;function c(){const E=t.profile.claimable.length,A=o("road"),C=o("roadfill");if(E>0){A.classList.add("is-ready"),o("roadicon").innerHTML=P("sparkle"),o("roadtitle").textContent=E>1?`${E} rewards ready`:"Reward ready",o("roadsub").textContent="Tap to claim",o("roadpill").textContent="Claim",C.style.width="100%";return}A.classList.remove("is-ready");const{progress01:R,next:I}=H0(t.profile.trophies);if(C.style.width=`${(R*100).toFixed(1)}%`,!I){o("roadicon").innerHTML=P("flag"),o("roadtitle").textContent="Road complete",o("roadsub").textContent="Every reward claimed",o("roadpill").innerHTML=`${P("trophy")} ${t.profile.trophies.toLocaleString()}`;return}const L=Yl(I.reward,t.profile.unlocked);o("roadicon").innerHTML=I.reward.type==="character"?vo(I.reward.id,{crop:"head"}):I.reward.type==="container"?Ut(I.reward.kind):Ha(L.emoji),ko(e),o("roadtitle").textContent=L.title,o("roadsub").textContent=`${(I.trophies-t.profile.trophies).toLocaleString()} trophies to go`,o("roadpill").innerHTML=`${P("trophy")} ${I.trophies.toLocaleString()}`}function d(){const E=t.profile.winsToNextChest,A=kt.winsPerChest,C=Math.max(0,Math.min(A,A-E));o("chestsub").textContent=E===0?"Ready on your next win":`${E} more ${E===1?"win":"wins"}`,o("pips").innerHTML=Array.from({length:A},(R,I)=>`<span class="home-pip${I<C?" is-on":""}"></span>`).join("")}function p(){const E=t.profile.containerCount,A=o("held");A.hidden=E===0,E>0&&(o("heldtitle").textContent=E===1?"1 chest held":`${E} chests held`)}const u=[["damage","Damage","damage","#FF8A96"],["health","Health","health","#8FE04A"],["speed","Speed","speed","#6FC8F5"]];function m(){const E=ie[t.profile.selected];o("stats").innerHTML=u.map(([A,C,R,I])=>`
      <div class="fa-stat ds-row ds-row--slate home-stat" style="--ds-row-accent:${I}">
        <span class="ds-tile ds-tile--stat" style="--ds-tile-fill:${I}">${P(A)}</span>
        <span class="ds-row-body">
          <span class="ds-row-label">${C}</span>
          <span class="ds-row-val ds-num">${E.stats[R]}</span>
        </span>
      </div>`).join(""),f()}function f(){const E=ie[t.profile.selected];h>=E.abilities.length&&(h=0),o("kit").dataset.n=String(E.abilities.length),o("kit").innerHTML=E.abilities.map((R,I)=>`
      <button class="home-kit-tile${I===h?" is-on":""}" type="button" data-kit="${I}">
        <span class="home-kit-em">${Ha(R.emoji)}</span>
        <span class="home-kit-name">${R.name}</span>
      </button>`).join("");const A=o("kitcap"),C=E.abilities[h];A.innerHTML=C?`<span class="home-kit-captext"><span class="home-kit-capname">${C.name}</span>${C.desc}</span>`:"",A.scrollTop=0,g()}function g(){const E=o("kitcap");E.classList.toggle("is-clipped",E.scrollHeight-E.clientHeight>1)}function w(){const E=e.getBoundingClientRect();if(E.height<=0)return;const A=e.querySelector(".fa-topbar");if(A){const R=A.getBoundingClientRect();R.height>0&&e.style.setProperty("--home-topbar-b",`${Math.round(R.bottom-E.top)}px`)}const C=e.querySelector(".home-bottom");if(C){const R=C.getBoundingClientRect();R.height>0&&e.style.setProperty("--home-bottom-h",`${Math.round(E.bottom-R.top)}px`)}}function b(){const E=Ph(Bh(t.profile.economy));o("modekit").innerHTML=Array.from({length:Rt},(C,R)=>{const I=E[R];return I===void 0?'<span class="home-mode-slot is-empty" aria-hidden="true">+</span>':`<span class="home-mode-slot is-filled" aria-hidden="true" title="${Le[I].name}">${P(I)}</span>`}).join("");const A=E.length;o("mode").setAttribute("aria-label",`Match lobby — your items and how many players are in the match. ${A} of ${Rt} item slots filled.`)}function y(){const E=ie[t.profile.selected];o("name").textContent=t.profile.name,o("trophies").textContent=t.profile.trophies.toLocaleString(),o("coins").textContent=t.profile.coins.toLocaleString(),c(),d(),p(),m(),b(),o("wins").textContent=t.profile.wins.toLocaleString(),o("losses").textContent=t.profile.losses.toLocaleString(),o("best").textContent=t.profile.bestTrophies.toLocaleString(),o("lv").textContent=`Lv ${t.profile.level}`,o("lvnext").textContent=`Lv ${t.profile.level+1}`,o("lvfill").style.width=`${(t.profile.levelProgress01*100).toFixed(1)}%`,o("lvxp").textContent=`${t.profile.xp%qn} / ${qn} XP`,i.textContent=E.name,r.textContent=E.rarity,r.style.background=It[E.rarity],a.show(E.id)}const x=E=>{const A=E.target,C=A.closest("[data-kit]");if(C){const L=Number(C.dataset.kit);Number.isInteger(L)&&(h=L,f());return}const R=A.closest("[data-go]");if(!R)return;const I=R.dataset.go;I==="characters"?t.navigate({name:"characters"}):I==="trophies"?t.navigate({name:"trophies"}):I==="shop"&&t.navigate({name:"shop"})};e.addEventListener("click",x),o("start").addEventListener("click",()=>{t.navigate({name:"characters"})}),o("mode").addEventListener("click",()=>{t.navigate({name:"lobby"})}),o("settings").addEventListener("click",()=>{t.navigate({name:"settings"})}),o("stage").addEventListener("click",()=>{a.poke(),Ei(s,50,18)}),setTimeout(()=>l.classList.add("is-faded"),4200);const k=t.profile.onChange(y);y(),a.attachTo(n);const T=requestAnimationFrame(()=>{w()}),v=new ResizeObserver(()=>w()),O=e.querySelector(".fa-topbar"),D=e.querySelector(".home-bottom");O&&v.observe(O),D&&v.observe(D);const _=new ResizeObserver(()=>g());return _.observe(o("kitcap")),{root:e,update(E){a.update(E)},resize(){a.resize(),w()},dispose(){k(),v.disconnect(),_.disconnect(),cancelAnimationFrame(T),e.removeEventListener("click",x),a.setScene("portrait"),a.detach(),e.remove()}}}const Dy=`
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
/* ⚠️ DEEPER, NOT DESATURATED (graphics campaign U1). WAS, verbatim:
     repeating-linear-gradient(90deg,  rgba(52,14,0,0.30) 0 3px, rgba(255,240,200,0.26) 3px 7px, transparent 7px 46px),
     repeating-linear-gradient(180deg, rgba(52,14,0,0.30) 0 3px, rgba(255,240,200,0.26) 3px 7px, transparent 7px 46px),
     radial-gradient(120% 90% at 50% 100%, rgba(255,222,150,0.55) 0%, transparent 62%),
     linear-gradient(180deg, #E9761F 0%, #EE8A22 46%, #F2A22C 100%);
   r0: 6 of 6 home critics described a hero "in a big, flat orange frame of plain cream
   boxes" and asked for "a lit, deep background". REVAMP 2.7 measured the menus LIGHTER and
   far LESS vivid than the reference (median luma 0.58 vs 0.15-0.40; vivid share 12.6% vs
   46.8%). So the kitchen keeps its hue and its tiles and spends VALUE: a deep, saturated
   burnt orange, darker toward the ceiling, so the lit recess holding the hero is the
   brightest place in the room and the cream panels separate from it. The grout keeps a
   step well over 'hm_lang''s 30-count edge threshold on the darker base. */
.fa-home .home-room-wall {
  position: absolute;
  inset: 0 0 42% 0;
  background:
    repeating-linear-gradient(90deg, rgba(30,6,0,0.42) 0 3px, rgba(255,196,130,0.24) 3px 7px, transparent 7px 46px),
    repeating-linear-gradient(180deg, rgba(30,6,0,0.42) 0 3px, rgba(255,196,130,0.24) 3px 7px, transparent 7px 46px),
    radial-gradient(120% 90% at 50% 100%, rgba(255,170,80,0.40) 0%, transparent 62%),
    linear-gradient(180deg, #7C2A0A 0%, #A23E10 46%, #C65616 100%);
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
    /* WAS '#A63A18 0%, #7E240F 55%, #5E1608 100%' — deepened with the wall (note above). */
    linear-gradient(180deg, #6E200C 0%, #4C1407 55%, #300B04 100%);
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
  /* WAS 'rgba(120,190,235,0.30)' over '#1B5375 0%, #164866 52%, #0E3149 100%' — keyed to the
     lit teal cove 'charStage.ts' used to render. Re-keyed to its painted deep-blue set (U1)
     so the recess and the canvas inside it remain one place. */
  background:
    radial-gradient(58% 44% at 50% 30%, rgba(90,166,255,0.30) 0%, transparent 72%),
    linear-gradient(180deg, #1F3F94 0%, #183178 52%, #101E4E 100%);
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
  background: ${K0};
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
/* ⚠️ margin-top WAS 9px: the room the retired caret's upper half stood in (see the tail
   note below). It is the grid's own gap now. And 'align-items' is SAFE centre, because
   the caption may now scroll (below) and plain centring pushes an overflowing first line
   above the scroll origin where it can never be reached. */
.fa-home .home-kit-cap {
  position: relative;
  margin: 5px 0 0;
  padding: 4px 8px;
  min-height: 2em;
  display: flex;
  align-items: safe center;
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
/* THE ONE CHILD OF '.home-col' ALLOWED TO SHRINK — an exception to the guard above
   '.home-col > *', and a designed one. The caption had a minimum height and no maximum:
   home shows the SELECTED fighter's descriptions, which run to 180 characters, so a
   fighter like Water Bottle pushed the Change button out of the clipped column on short
   screens for any player who picked it. As a scroll container its automatic minimum is
   0, so it absorbs the overspend; it is never cut, because it fades ('.is-clipped', set
   from 'renderKit' and a ResizeObserver only while it truly overflows) and scrolls. */
.fa-home .home-col > .home-kit-cap { flex: 0 1 auto; overflow-y: auto; scrollbar-width: none; }
.fa-home .home-kit-cap::-webkit-scrollbar { display: none; }
.fa-home .home-kit-cap.is-clipped {
  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 16px), transparent);
  mask-image: linear-gradient(180deg, #000 calc(100% - 16px), transparent);
}
/* ONE paragraph, not two flex boxes: the name and the description used to be sibling flex
   items, so a two-line caption laid out as two side-by-side COLUMNS ("Tomato Toss -" |
   "Slows enemies / down") on the scored phone frame. */
.fa-home .home-kit-captext { min-width: 0; }
/* The selected ability's NAME, hidden by default because the tile beside it already
   carries it. It is turned on at exactly one breakpoint — the landscape phone, where
   the tiles go icon-only to fit (see the max-height block at the foot of this file) —
   so the caption is the only place the name exists there. Rendered as its own element
   rather than concatenated into the string, because the two states differ in LAYOUT,
   not in content, and a screen must not have to re-run 'renderKit' to change size. */
/* 🔴 SHOWN AT EVERY VIEWPORT NOW — WAS 'display: none' here and 'inline' only in the
   landscape-phone block. The name is what binds the caption to its tile since the caret
   was retired (see 'renderKit'): r0's critics read the caret as "a diamond marker on top
   of the 'Tomato Toss' label", and on the phone it was exactly that. */
.fa-home .home-kit-capname { display: inline; font-weight: var(--ds-w-black); }
/* NON-BREAKING SPACES, both sides. A plain space in 'content' collapses against the
   adjacent inline box and the first capture rendered "Tomato Toss -Slows enemies down"
   — the leading space survived and the trailing one did not. The dash is also what
   stops the separator from being the wrap point on a two-line caption.
   ⚠️ DOUBLE backslashes: this whole stylesheet is a JS template literal, so a single
   backslash is consumed by JS and never reaches CSS. Written singly it compiled as an
   octal escape and tsc refused the file (TS1487). Same family of trap as the backtick
   rule at the top of this file. */
.fa-home .home-kit-capname::after { content: '\\00a0\\2013\\00a0'; font-weight: var(--ds-w-body); }
/* 🔴 THE TAIL IS RETIRED. WAS, verbatim: "The tail. '--home-cap-x' is written by
   'renderKit()' from the selected index, so the caption points at its own tile rather than
   at the grid in general. A rotated square whose lower half lands ON the plate's ink
   border, which is what makes it read as a tail growing out of the plate instead of as a
   diamond floating above it — the first version left a gap and looked like a stray icon."
     .fa-home .home-kit-cap::before { content: ''; position: absolute; top: -8px;
       inset-inline-start: var(--home-cap-x, 50%); width: 13px; height: 13px;
       margin-inline-start: -6.5px; transform: rotate(45deg); background: var(--mustard); … }
   Its lower half landing ON the plate is what put it on the TEXT: a positioned pseudo paints
   over in-flow content, and its tip reached 4.7 px into the first line wherever the caption
   leads with the name (the landscape phone, i.e. the scored frame). r0, 5 of 6 home critics:
   "a yellow diamond marker sits on top of the 'Tomato Toss' label" — it read as the stray
   icon this note had already feared. The caption now names its ability at every viewport
   ('.home-kit-capname' above), which binds it to its tile without drawing over anything.
   Measured: 'tools/tmp/u1_clip.mjs' C3. */
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
  /* ── FIVE ABILITIES ON A SHORT SCREEN (Donut) ──────────────────────────────────
     Measured with 'u1_clip' (Donut selected), and red on the base tree as well: at
     852x480+notch the two-up kit WITH names stood three rows and 198 px tall, crushed the
     caption to 22 px and pushed the Change button wholly out of the clipped column; at
     852x393 the icon-only rows still overspent it by 25 px and cut Change by 4-7 px. So
     for this count only — the scored four-ability frame keeps its layout — the tiles go
     icon-only on the 3 + 2 grid (the caption names the pressed one at every viewport now),
     the panel title goes (the stat cells and the tiles describe themselves), and the
     caption may fall to one line before it scrolls behind its fade. */
  .fa-home .home-kit[data-n="5"] {
    grid-auto-flow: row;
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .fa-home .home-kit[data-n="5"] .home-kit-tile { grid-column: span 2; padding: 4px 3px; gap: 0; }
  .fa-home .home-kit[data-n="5"] .home-kit-tile:nth-child(n+4) { grid-column: span 3; }
  .fa-home .home-kit[data-n="5"] .home-kit-name { display: none; }
  .fa-home .home-fighter:has(.home-kit[data-n="5"]) > .fa-panel-title { display: none; }
  .fa-home .home-kit[data-n="5"] + .home-kit-cap { min-height: 1.6em; }
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
    /* ⚠️ BUT ONE ROW IS A FOUR-TILE ROW. 191 px is "4 tiles x 44px + 3 gaps x 5px" (the
       note above), and Donut has FIVE abilities: 5 x 44 + 4 x 5 = 240 px in a ~200 px
       flank, so the fifth tile was laid out past the panel's clipped edge — and pressing
       it scrolled the whole overflow:hidden column sideways (focus scrolls a clipping
       ancestor), throwing "Your fighter" 32 px out of its own panel. 'u1_clip' with Donut
       selected at 852x393. Five go 3 + 2 on a six-track grid, both rows full. */
    .fa-home .home-kit[data-n="5"] {
      grid-auto-flow: row;
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
    .fa-home .home-kit[data-n="5"] .home-kit-tile { grid-column: span 2; }
    .fa-home .home-kit[data-n="5"] .home-kit-tile:nth-child(n+4) { grid-column: span 3; }
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
`,Hy=4500,_y=["No","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen","Twenty"];function zy(t){return _y[t]??String(t)}function Py(){const t=new URLSearchParams(location.search).get("hold"),e=t===null?NaN:Number(t);return Number.isFinite(e)&&e>=0?e:Hy}function $y(t){Ea("fa-opening-styles",By),Ta();const e=Ue("div","fa-screen fa-opening"),a=Lh();e.innerHTML=`
    <header class="open-head">
      <h1 class="open-title">Food Fight Arena</h1>
      <p class="open-tagline">${zy(Te.length)} fighters. One kitchen. No table manners.</p>
    </header>

    <div class="open-stage">
      <div class="open-stage-3d" data-el="stage3d"></div>
      <div class="open-glow"></div>
    </div>

    <footer class="open-foot">
      <button class="fa-btn fa-btn--primary open-start" type="button" data-el="start">
        ${P("play")} Tap to start
      </button>
      <div class="open-timer" aria-hidden="true"><span class="open-timer-fill" data-el="timerfill"></span></div>
    </footer>
  `;const o=p=>{const u=e.querySelector(`[data-el="${p}"]`);if(!u)throw new Error(`opening: missing element "${p}"`);return u},n=o("stage3d");let s=!1,i=null;function r(){s||(s=!0,i!==null&&(clearTimeout(i),i=null),Ae.unlock(),Ae.music.play(),t.navigate({name:"home"}))}const l=p=>{p.key!=="Tab"&&r()},h=()=>r();window.addEventListener("keydown",l,!0),window.addEventListener("pointerdown",h,!0),o("start").addEventListener("click",r);const c=Py();i=setTimeout(r,c);const d=o("timerfill");return d.style.transition=`width ${c}ms linear`,requestAnimationFrame(()=>{d.style.width="100%"}),a.show(t.profile.selected),a.attachTo(n),{root:e,update(p){a.update(p)},resize(){a.resize()},dispose(){i!==null&&clearTimeout(i),window.removeEventListener("keydown",l,!0),window.removeEventListener("pointerdown",h,!0),a.detach(),e.remove()}}}const By=`
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
`,Uy=.15,qy=44,Wy=78,Gy=5,jy=10,Bd=.5,Ud="touch-styles";function Yy(){return typeof window>"u"?!1:typeof navigator<"u"&&(navigator.maxTouchPoints??0)>0?!0:"ontouchstart"in window}function Vy(){return typeof window.matchMedia!="function"?!1:window.matchMedia("(pointer: coarse)").matches}function Ky(){const t=Math.min(window.innerWidth,window.innerHeight);return Math.max(qy,Math.min(Wy,t*Uy))}function Xy(t,e,a){const o=Math.max(Math.abs(t),Math.abs(e)),n=o>1e-6?Math.min(1,Math.hypot(t,e))/o:0;return a.x=Math.max(-1,Math.min(1,t*n)),a.y=Math.max(-1,Math.min(1,e*n)),a}function qd(){return{id:null,baseX:0,baseY:0,curX:0,curY:0}}function Zy(t){const e=Yy(),a=qd(),o=qd(),n={x:0,y:0},s={x:0,y:-1};let i=!1,r=!1,l=!1,h=!1,c=0,d="",p="";if(!e)return{available:!1,get engaged(){return!1},move:n,get moving(){return!1},aimDir:()=>null,get firing(){return!1},takeFirePress:()=>!1,clearAim(){},reset(){},dispose(){}};Jy();const u=document.createElement("div");u.className="tch-root",u.innerHTML='<div class="tch-stick tch-stick--move" data-el="move-stick"><div class="tch-knob"></div></div><div class="tch-stick tch-stick--aim" data-el="aim-stick"><div class="tch-knob"></div></div><div class="tch-hint tch-hint--move" data-el="move-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">MOVE</div></div><div class="tch-hint tch-hint--aim" data-el="aim-hint"><div class="tch-hint-ring"></div><div class="tch-hint-label">AIM &amp; FIRE</div></div>',document.body.appendChild(u);const m=U=>u.querySelector('[data-el="'+U+'"]'),f=m("move-stick"),g=m("aim-stick"),w=m("move-hint"),b=m("aim-hint");Vy()&&(u.classList.add("is-hinted"),document.documentElement.classList.add("fa-touch-capable","fa-touch"));const x=t.canvas.parentElement,k=t.canvas.style.touchAction,T=x?x.style.touchAction:"";t.canvas.style.touchAction="none",x&&(x.style.touchAction="none");function v(U){if(!(U instanceof Node))return!1;const V=t.canvas;return U===V||V.contains(U)||U.contains(V)}function O(){return Ky()}function D(U,V){const ne=O();let z=U.curX-U.baseX,Q=U.curY-U.baseY;const de=Math.hypot(z,Q);if(de>ne){const ot=ne/de;U.baseX=U.curX-z*ot,U.baseY=U.curY-Q*ot,z*=ot,Q*=ot}const Oe=Math.hypot(z,Q);return V.x=z,V.y=Q,Oe}const _={x:0,y:0},E=[];function A(U){const V=E.indexOf(U);V>=0&&E.splice(V,1)}function C(U,V){for(let ne=0;ne<U.length;ne++)if(U[ne].identifier===V)return U[ne];return null}function R(U,V,ne){for(let z=E.length-1;z>=0;z--){const Q=C(ne,E[z]);if(!Q){E.splice(z,1);continue}if(Q.clientX<window.innerWidth*Bd===V){E.splice(z,1),U.id=Q.identifier,U.baseX=Q.clientX,U.baseY=Q.clientY,U.curX=Q.clientX,U.curY=Q.clientY;return}}}function I(){if(a.id===null){n.x=0,n.y=0;return}if(D(a,_)<Gy){n.x=0,n.y=0;return}const V=O();Xy(_.x/V,_.y/V,n)}function L(){if(o.id===null)return;const U=D(o,_);U<jy||(s.x=_.x/U,s.y=_.y/U,i=!0)}function B(U,V,ne){if(V.id===null)return ne!==""&&(U.style.display="none"),"";const z=V.curX-V.baseX,Q=V.curY-V.baseY,de=O(),Oe=Math.hypot(z,Q),ot=Oe>de?de/Oe:1,bn=Math.round(V.baseX),Ia=Math.round(V.baseY),yn=Math.round(V.baseX+z*ot),xn=Math.round(V.baseY+Q*ot),Qa=bn+","+Ia+","+yn+","+xn+","+Math.round(de);if(Qa===ne)return Qa;ne===""&&(U.style.display="block"),U.style.setProperty("--r",de.toFixed(0)+"px"),U.style.transform="translate("+bn+"px,"+Ia+"px) translate(-50%,-50%)";const _o=U.firstElementChild;return _o&&(_o.style.transform="translate("+(yn-bn)+"px,"+(xn-Ia)+"px) translate(-50%,-50%)"),Qa}function H(){if(d=B(f,a,d),p=B(g,o,p),a.id===null&&o.id===null){c=0;return}c=requestAnimationFrame(H)}function j(){!c&&!h&&(c=requestAnimationFrame(H))}const S=U=>{if(h)return;let V=!1;for(let ne=0;ne<U.changedTouches.length;ne++){const z=U.changedTouches[ne];if(!v(z.target))continue;const Q=z.clientX<window.innerWidth*Bd,de=Q?a:o;if(de.id!==null){E.includes(z.identifier)||E.push(z.identifier),V=!0;continue}de.id=z.identifier,de.baseX=z.clientX,de.baseY=z.clientY,de.curX=z.clientX,de.curY=z.clientY,V=!0,Q?w.classList.add("is-used"):(b.classList.add("is-used"),l=!0)}V&&(r||(r=!0,document.documentElement.classList.add("fa-touch")),I(),L(),j(),U.preventDefault())},N=U=>{if(h)return;let V=!1;for(let ne=0;ne<U.changedTouches.length;ne++){const z=U.changedTouches[ne];z.identifier===a.id?(a.curX=z.clientX,a.curY=z.clientY,V=!0):z.identifier===o.id?(o.curX=z.clientX,o.curY=z.clientY,V=!0):E.includes(z.identifier)&&(V=!0)}V&&(I(),L(),j(),U.preventDefault())},q=U=>{if(h)return;let V=!1;for(let ne=0;ne<U.changedTouches.length;ne++){const z=U.changedTouches[ne];z.identifier===a.id?(a.id=null,R(a,!0,U.touches),V=!0):z.identifier===o.id?(o.id=null,R(o,!1,U.touches),V=!0):E.includes(z.identifier)&&(A(z.identifier),V=!0)}V&&(I(),L(),j())};return window.addEventListener("touchstart",S,{passive:!1}),window.addEventListener("touchmove",N,{passive:!1}),window.addEventListener("touchend",q),window.addEventListener("touchcancel",q),{available:!0,get engaged(){return r},move:n,get moving(){return a.id!==null},aimDir:()=>i?s:null,get firing(){return o.id!==null},takeFirePress(){const U=l;return l=!1,U},clearAim(){o.id===null&&(i=!1)},reset(){a.id=null,o.id=null,E.length=0,n.x=0,n.y=0,i=!1,l=!1,j()},dispose(){h||(h=!0,cancelAnimationFrame(c),window.removeEventListener("touchstart",S),window.removeEventListener("touchmove",N),window.removeEventListener("touchend",q),window.removeEventListener("touchcancel",q),E.length=0,t.canvas.style.touchAction=k,x&&(x.style.touchAction=T),document.documentElement.classList.remove("fa-touch","fa-touch-capable"),u.remove())}}}function Jy(){if(document.getElementById(Ud))return;const t=document.createElement("style");t.id=Ud,t.textContent=Qy,document.head.appendChild(t)}const Qy=`
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
`,ia={left:["KeyA","ArrowLeft"],right:["KeyD","ArrowRight"],up:["KeyW","ArrowUp"],down:["KeyS","ArrowDown"]},Uh="KeyM",Ti=9;function e2(t){const e=Number(t.key);if(Number.isInteger(e)&&e>=1&&e<=Ti)return e-1;if(t.ctrlKey||t.metaKey||t.altKey)return null;const a=/^(?:Digit|Numpad)([1-9])$/.exec(t.code);return a&&Number(a[1])<=Ti?Number(a[1])-1:null}const Qi=["KeyQ","KeyE"],t2=.155,a2=84,o2=190;function n2(t){const e=new URLSearchParams(location.search).get(t);if(e===null)return null;const a=Number(e);return Number.isFinite(a)?a:null}class s2{constructor(e){this.canvas=e;const a=n2("aimSens");this.sensitivity=a!==null&&a>0?Math.min(6,a):1,this.freeAim=new URLSearchParams(location.search).get("aimMode")==="free",this.touch=Zy({canvas:e}),this.surface=e.parentElement??e,window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onVisibilityChange),this.surface.addEventListener("mousemove",this.onMouseMove),this.surface.addEventListener("mousedown",this.onMouseDown),window.addEventListener("mouseup",this.onMouseUp),this.surface.addEventListener("contextmenu",this.onContextMenu)}keys=new Set;mouseDown=!1;ndcX=0;ndcY=0;hasMouse=!1;weaponIndex=0;weaponCount=1;itemPress=null;attackPress=!1;locked=!1;offX=0;offY=0;clientX=0;clientY=0;sensitivity;freeAim;touch;touchOffset={x:0,y:0};surface;setWeaponCount(e){this.weaponCount=Math.max(1,e),this.weaponIndex>=this.weaponCount&&(this.weaponIndex=0)}get selectedWeapon(){return this.weaponIndex}selectWeapon(e){!Number.isInteger(e)||e<0||e>=this.weaponCount||(this.weaponIndex=e)}get touchEngaged(){return this.touch.engaged}pressItem(e){!Number.isInteger(e)||e<0||e>=Rt||(this.itemPress=e)}takeItemPress(){const e=this.itemPress;return this.itemPress=null,e}get attackHeld(){return this.mouseDown||this.touch.firing}takeAttackPress(){const e=this.attackPress;this.attackPress=!1;const a=this.touch.takeFirePress();return e||a}get mouseNdc(){return this.hasMouse&&!this.locked?{x:this.ndcX,y:this.ndcY}:null}get pointerLocked(){return this.locked}get aimOffsetPx(){const e=this.touch.aimDir();if(e){const a=this.aimRadiusPx();return this.touchOffset.x=e.x*a,this.touchOffset.y=e.y*a,this.touchOffset}return this.locked?{x:this.offX,y:this.offY}:null}setPointerLocked(e){e!==this.locked&&(this.locked=e,e&&(this.hasMouse?(this.offX=this.clientX-window.innerWidth/2,this.offY=this.clientY-window.innerHeight/2):(this.offX=0,this.offY=-this.aimRadiusPx()),this.clampOffset(),this.hasMouse=!0))}moveAxes(){let e=0,a=0;return this.keyDown(ia.left)&&(e-=1),this.keyDown(ia.right)&&(e+=1),this.keyDown(ia.up)&&(a-=1),this.keyDown(ia.down)&&(a+=1),this.touch.moving&&(e=Math.max(-1,Math.min(1,e+this.touch.move.x)),a=Math.max(-1,Math.min(1,a+this.touch.move.y))),{x:e,y:a}}reset(){this.keys.clear(),this.mouseDown=!1,this.itemPress=null,this.attackPress=!1,this.touch.reset(),this.locked&&(this.offX=0,this.offY=-this.aimRadiusPx())}dispose(){this.touch.dispose(),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onVisibilityChange),this.surface.removeEventListener("mousemove",this.onMouseMove),this.surface.removeEventListener("mousedown",this.onMouseDown),window.removeEventListener("mouseup",this.onMouseUp),this.surface.removeEventListener("contextmenu",this.onContextMenu)}aimRadiusPx(){const e=Math.min(window.innerWidth,window.innerHeight);return Math.max(a2,Math.min(o2,e*t2))}clampOffset(){if(this.freeAim){const n=window.innerWidth/2,s=window.innerHeight/2;this.offX=Math.max(-n,Math.min(n,this.offX)),this.offY=Math.max(-s,Math.min(s,this.offY));return}const e=this.aimRadiusPx(),a=Math.hypot(this.offX,this.offY);if(a<=e){a<.001&&(this.offY=-e);return}const o=e/a;this.offX*=o,this.offY*=o}keyDown(e){return e.some(a=>this.keys.has(a))}onKeyDown=e=>{this.keys.add(e.code);const a=e2(e);a!==null&&a<this.weaponCount&&(this.weaponIndex=a);const o=e.repeat||e.ctrlKey||e.metaKey||e.altKey?-1:Qi.indexOf(e.code);o>=0&&this.pressItem(o),e.code===Uh&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&Ae.toggleMuted()};onKeyUp=e=>{this.keys.delete(e.code)};onMouseMove=e=>{if(this.touch.clearAim(),this.locked){this.offX+=(e.movementX??0)*this.sensitivity,this.offY+=(e.movementY??0)*this.sensitivity,this.clampOffset(),this.hasMouse=!0;return}const a=this.canvas.getBoundingClientRect();this.clientX=e.clientX,this.clientY=e.clientY,this.ndcX=(e.clientX-a.left)/a.width*2-1,this.ndcY=-((e.clientY-a.top)/a.height*2-1),this.hasMouse=!0};onMouseDown=e=>{e.button===0&&(this.mouseDown=!0,this.attackPress=!0)};onMouseUp=e=>{e.button===0&&(this.mouseDown=!1)};onBlur=()=>{this.keys.clear(),this.mouseDown=!1,this.itemPress=null,this.attackPress=!1,this.touch.reset()};onVisibilityChange=()=>{document.visibilityState==="hidden"&&this.onBlur()};onContextMenu=e=>{e.preventDefault()}}const Wd=16241663,i2=14711797,r2=12872686,Vo=2755399,l2=.34,Os=3.2,h2=6.5;function c2(t){return K.clamp(t*.3,ae,h2)}const d2=.5,Ze=128,qh=bg+yg,p2=[{offset:-14,color:Wd,alpha:0},{offset:-1,color:Wd,alpha:.9},{offset:7,color:i2,alpha:.85},{offset:34,color:5906060,alpha:.3},{offset:150,color:Vo,alpha:.18},{offset:0,absolute:qh,color:Vo,alpha:.18}],u2=[{offset:12,color:Vo,alpha:0},{offset:44,color:Vo,alpha:.6},{offset:140,color:Vo,alpha:.72},{offset:0,absolute:qh,color:Vo,alpha:.72}];function f2(){const a=document.createElement("canvas");a.width=64,a.height=256;const o=a.getContext("2d"),n=o.createImageData(64,256);let s=2654435769;const i=()=>(s=s*1664525+1013904223>>>0,s/4294967295),r=new Float32Array(64);for(let h=0;h<64;h++)r[h]=.18+.82*i();for(let h=0;h<256;h++){const c=1-h/255,d=Math.pow(1-c,2.6);for(let p=0;p<64;p++){const u=.85+.15*Math.sin(p*.9+c*5),m=Math.max(0,Math.min(1,d*r[p]*u)),f=(h*64+p)*4,g=Math.pow(1-c,3);n.data[f]=255,n.data[f+1]=Math.round(190+65*g),n.data[f+2]=255,n.data[f+3]=Math.round(m*255)}}o.putImageData(n,0,0);const l=new st(a);return l.wrapS=zl,l.wrapT=Kn,l.needsUpdate=!0,l}function Gd(t,e,a,o){const n=t.length*Ze,s=new Float32Array(n*3),i=new Float32Array(n*4),r=[],l=new Float32Array(Ze),h=new Float32Array(Ze);for(let f=0;f<Ze;f++){const g=f/Ze*Math.PI*2;l[f]=Math.cos(g),h[f]=Math.sin(g)}const c=new Kt;for(let f=0;f<t.length;f++){c.setHex(t[f].color);for(let g=0;g<Ze;g++){const w=f*Ze+g;s[w*3+1]=0,i[w*4]=c.r,i[w*4+1]=c.g,i[w*4+2]=c.b,i[w*4+3]=t[f].alpha}}for(let f=0;f<t.length-1;f++)for(let g=0;g<Ze;g++){const w=(g+1)%Ze;r.push(f*Ze+g,(f+1)*Ze+g,f*Ze+w),r.push(f*Ze+w,(f+1)*Ze+g,(f+1)*Ze+w)}const d=new rs,p=new Yn(s,3);p.setUsage(gg),d.setAttribute("position",p),d.setAttribute("color",new Yn(i,4)),d.setIndex(r),d.boundingSphere=new wg(new pe,nt(qh)*1.2);const u=new X({vertexColors:!0,transparent:!0,depthWrite:!1,side:ye,toneMapped:!1}),m=new M(d,u);return m.name=`${o}__no_outline`,m.userData.noOutline=!0,m.renderOrder=a,m.frustumCulled=!1,m.castShadow=!1,m.receiveShadow=!1,m.position.y=e,{mesh:m,setRadius(f){for(let g=0;g<t.length;g++){const w=t[g],b=w.absolute!==void 0?Math.max(w.absolute,f+200):Math.max(0,f+w.offset),y=nt(b),x=g*Ze;for(let k=0;k<Ze;k++){const T=(x+k)*3;s[T]=l[k]*y,s[T+2]=h[k]*y}}p.needsUpdate=!0},setOpacity(f){u.opacity=f},dispose(){d.dispose(),u.dispose()}}}function m2(t){const e=new he;e.name="fog_boundary";const a=_e(t.x,t.y);e.position.set(a.x,0,a.z),e.frustumCulled=!1;const o=Gd(p2,l2,6,"fog_edge"),n=Gd(u2,Os,8,"fog_canopy");e.add(o.mesh);const s=f2(),i=new Re(1,1,1,Ze,1,!0),r=new X({map:s,color:r2,transparent:!0,opacity:.82,depthWrite:!1,side:ye,toneMapped:!1}),l=new M(i,r);l.name="fog_curtain__no_outline",l.userData.noOutline=!0,l.renderOrder=7,l.frustumCulled=!1,l.castShadow=!1,l.receiveShadow=!1,e.add(l),e.add(n.mesh);let h=0,c=0;return{root:e,update(d,p,u,m){const f=Math.min(.25,Math.max(0,p-c));if(c=p,h=u&&d>=0?1:Math.max(0,h-f/d2),e.visible=h>.002,!e.visible)return;const w=Math.max(0,d);o.setRadius(w),n.setRadius(w),o.setOpacity(h),n.setOpacity(h);const b=m.camera.position.y,y=K.clamp(b>Os?(b-Os)/b:0,.05,1);n.mesh.scale.set(y,1,y),n.mesh.position.set((1-y)*(m.camera.position.x-e.position.x),Os,(1-y)*(m.camera.position.z-e.position.z));const x=nt(w),k=c2(x);l.scale.set(x,k,x),l.position.y=k/2;const T=2*Math.PI*x;s.repeat.x=Math.max(6,Math.round(T/5)),s.offset.x=p*.035%1,r.opacity=(.82+.1*Math.sin(p*2.1))*h},dispose(){o.dispose(),n.dispose(),i.dispose(),r.dispose(),s.dispose(),e.clear()}}}function ls(t,e,a,o,n,s,i,r){return Math.abs(t-n)<(a+i)/2&&Math.abs(e-s)<(o+r)/2}function Si(t,e,a,o){for(let n=0;n<o.length;n++){const s=o[n];if(Math.abs(t-s.x)<(a+s.w)/2&&Math.abs(e-s.y)<(a+s.h)/2)return!0}return!1}const sf=[];function rf(t){return t.concealment??sf}function g2(t,e){if(!e)return!1;const a=e.brokenConcealment;for(let o=0;o<a.length;o++)if(a[o]===t)return!0;return!1}function w2(t,e,a,o){const n=rf(a);for(let s=0;s<n.length;s++){const i=n[s];if(ls(t,e,0,0,i.x,i.y,i.w,i.h)&&!g2(i,o))return!0}return!1}function lf(t,e,a,o,n){return o&&n&&o.elapsed<n.revealedUntil?!1:w2(t,e,a,o)}function Wh(t,e,a,o,n,s,i){return lf(a,o,n,s,i)?Math.hypot(a-t,o-e)<=xg:!0}function b2(t,e,a,o){const n=rf(a);let s=null;for(let i=0;i<n.length;i++){const r=n[i];ls(t,e,0,0,r.x,r.y,r.w,r.h)&&(o.includes(r)||(o.push(r),(s??=[]).push(r)))}return s??sf}function hf(t,e,a,o){let n=1;for(const s of a.hazards)s.kind==="slow"&&Math.hypot(t-s.x,e-s.y)<s.radius&&(n=Math.min(n,s.slowFactor??Pc));for(const s of o)Math.hypot(t-s.x,e-s.y)<$l&&(n=Math.min(n,Pc));return n}const y2=w0,cf=1e-6;function er(t,e,a,o,n){if(!(o>0))return;const s=Math.hypot(e,a);if(s<cf)return;const i=t.push,r=Math.max(n?.cap??y2,i.remaining);i.x=e/s,i.y=a/s,i.remaining=Math.min(r,i.remaining+o),i.speed=n?.speed??0,i.anchor=la}function x2(t,e,a){const o=e.x-t.x,n=e.y-t.y,s=Math.hypot(o,n);if(!(a>0)||s<cf)return;er(t,o,n,a);const i=t.push;i.remaining>s&&(i.remaining=s),i.anchor=e.id}function v2(t,e,a,o){const n=t.size/2;t.x=Math.min(o.width-n,Math.max(n,e)),t.y=Math.min(o.height-n,Math.max(n,a)),df(t,o);const s=t.push;s.remaining=0,s.x=0,s.y=0,s.speed=0,s.anchor=la}function k2(t,e,a,o,n){const s=t.push;if(s.remaining<=0)return!1;const r=(s.speed>0?s.speed:g0)*e;let l=s.remaining<r?s.remaining:r;if(s.anchor!==la&&n!==void 0){const c=n[s.anchor];if(c!==void 0){const d=(c.x-t.x)*s.x+(c.y-t.y)*s.y;d<=l&&(l=d>0?d:0,s.remaining=l)}}s.remaining-=l;const h=Yi(t,o)?!1:Ai(t,s.x*l,s.y*l,a);return s.remaining<=0&&(s.remaining=0,s.x=0,s.y=0,s.speed=0,s.anchor=la),h}const M2=4,jd=.01;function df(t,e){const a=t.size,o=a/2,n=e.cover;for(let s=0;s<M2;s++){let i=null,r=0;for(let c=0;c<n.length;c++){const d=n[c],p=(a+d.w)/2-Math.abs(t.x-d.x);if(p<=0)continue;const u=(a+d.h)/2-Math.abs(t.y-d.y);if(u<=0)continue;const m=p<u?p:u;m>r&&(r=m,i=d)}if(i===null)return;const l=(a+i.w)/2-Math.abs(t.x-i.x),h=(a+i.h)/2-Math.abs(t.y-i.y);if(l<=h){const c=t.x>=i.x?1:-1;t.x=Math.min(e.width-o,Math.max(o,t.x+c*(l+jd)))}else{const c=t.y>=i.y?1:-1;t.y=Math.min(e.height-o,Math.max(o,t.y+c*(h+jd)))}}}function Ai(t,e,a,o){const n=t.size/2,s=t.x,i=t.y;if((e!==0||a!==0)&&df(t,o),e!==0){const r=Math.min(o.width-n,Math.max(n,t.x+e));Si(r,t.y,t.size,o.cover)||(t.x=r)}if(a!==0){const r=Math.min(o.height-n,Math.max(n,t.y+a));Si(t.x,r,t.size,o.cover)||(t.y=r)}return t.x!==s||t.y!==i}const E2=10,T2=4e4,pf=16,S2=8,A2=4,Yd=new WeakMap;function R2(t,e){const a=Yd.get(t);if(a&&a.size===e&&a.cover===t.cover)return a;let o=E2;for(;Math.ceil(t.width/o)*Math.ceil(t.height/o)>T2;)o*=2;const n=Math.max(1,Math.ceil(t.width/o)),s=Math.max(1,Math.ceil(t.height/o)),i=n*s,r=new Uint8Array(i),l=e/2;for(let c=0;c<s;c++)for(let d=0;d<n;d++){const p=(d+.5)*o,u=(c+.5)*o;p>=l&&p<=t.width-l&&u>=l&&u<=t.height-l&&!Si(p,u,e,t.cover)&&(r[c*n+d]=1)}const h={cell:o,cols:n,rows:s,size:e,cover:t.cover,passable:r,dist:new Int32Array(i),queue:new Int32Array(i),chain:new Int32Array(pf+1),goalCell:-1,requestedGoal:-1};return Yd.set(t,h),h}function qr(t,e){const{cols:a,rows:o,passable:n,dist:s,queue:i}=t;s.fill(-1),t.goalCell=e,s[e]=0,i[0]=e;let r=0,l=1;for(;r<l;){const h=i[r++],c=h%a,d=(h-c)/a,p=s[h]+1;for(let u=-1;u<=1;u++){const m=d+u;if(m<0||m>=o)continue;const f=m*a;for(let g=-1;g<=1;g++){if(g===0&&u===0)continue;const w=c+g;if(w<0||w>=a)continue;const b=f+w;n[b]===0||s[b]>=0||g!==0&&u!==0&&(n[d*a+w]===0||n[f+c]===0)||(s[b]=p,i[l++]=b)}}}}function Vd(t,e,a,o,n){const{cols:s,rows:i,passable:r,dist:l}=t;if(e>=0&&e<s&&a>=0&&a<i){const h=a*s+e;if(r[h]===1)return h}for(let h=1;h<=o;h++)for(let c=-h;c<=h;c++){const d=a+c;if(d<0||d>=i)continue;const p=Math.abs(c)===h;for(let u=-h;u<=h;u+=p?1:2*h){const m=e+u;if(m<0||m>=s)continue;const f=d*s+m;if(r[f]===1)return f}}return-1}function Kd(t,e,a,o,n,s){const i=a-t,r=o-e,l=Math.max(1,Math.ceil(Math.hypot(i,r)/(n*.4)));for(let h=1;h<=l;h++){const c=h/l;if(Si(t+i*c,e+r*c,n,s))return!1}return!0}const _a={dirX:0,dirY:0,wpX:0,wpY:0};function I2(t,e,a,o){const n=R2(t,e.size),{cell:s,cols:i,rows:r,dist:l,chain:h}=n,c=e.size/2,d=Math.min(t.width-c,Math.max(c,a)),p=Math.min(t.height-c,Math.max(c,o)),u=Vd(n,Math.min(i-1,Math.max(0,Math.floor(d/s))),Math.min(r-1,Math.max(0,Math.floor(p/s))),S2);if(u<0)return!1;const m=Vd(n,Math.min(i-1,Math.max(0,Math.floor(e.x/s))),Math.min(r-1,Math.max(0,Math.floor(e.y/s))),A2);if(m<0)return!1;if(n.requestedGoal!==u||l[m]<0){if(qr(n,u),l[m]<0){qr(n,m);let T=m,v=1/0;for(let O=0;O<l.length;O++){if(l[O]<0)continue;const D=O%i,_=(D+.5)*s-d,E=((O-D)/i+.5)*s-p,A=_*_+E*E;A<v&&(v=A,T=O)}qr(n,T)}n.requestedGoal=u}if(l[m]<0)return!1;let f=m,g=0;for(;g<pf&&l[f]>0;){const T=f%i,v=(f-T)/i,O=l[f];let D=-1,_=O,E=1/0;for(let A=-1;A<=1;A++){const C=v+A;if(C<0||C>=r)continue;const R=C*i;for(let I=-1;I<=1;I++){if(I===0&&A===0)continue;const L=T+I;if(L<0||L>=i)continue;const B=R+L,H=l[B];if(H<0||H>=O||I!==0&&A!==0&&(n.passable[v*i+L]===0||n.passable[R+T]===0))continue;const j=(L+.5)*s-d,S=(C+.5)*s-p,N=j*j+S*S;(H<_||H===_&&N<E)&&(_=H,E=N,D=B)}}if(D<0)break;h[g++]=D,f=D}let w,b;if(g===0)w=d,b=p;else{let T=0;for(let _=1;_<g;_++){const E=h[_],A=E%i,C=(E-A)/i;if(!Kd(e.x,e.y,(A+.5)*s,(C+.5)*s,e.size,t.cover))break;T=_}const v=h[T],O=v%i,D=(v-O)/i;w=(O+.5)*s,b=(D+.5)*s,T===g-1&&l[v]===0&&Kd(e.x,e.y,d,p,e.size,t.cover)&&(w=d,b=p)}const y=w-e.x,x=b-e.y,k=Math.hypot(y,x);return k<1e-6?!1:(_a.dirX=y/k,_a.dirY=x/k,_a.wpX=w,_a.wpY=b,!0)}function Xd(t,e,a,o,n,s,i){const r=t.x,l=t.y;let h=e,c=a,d=s,p=i;I2(n,t,s,i)&&(h=_a.dirX,c=_a.dirY,d=_a.wpX,p=_a.wpY);const u=(T,v)=>Math.hypot(T-d,v-p),m=u(r,l);Ai(t,h*o,c*o,n);const f=t.x,g=t.y;if(m-u(f,g)>=o*.35)return t.detourSign=0,!0;const w=T=>{t.x=r,t.y=l;const v=-c*T+h*.3,O=h*T+c*.3,D=Math.hypot(v,O)||1;return Ai(t,v/D*o,O/D*o,n),Math.hypot(t.x-r,t.y-l)};if(t.detourSign!==0&&w(t.detourSign)>=o*.35)return!0;const b=w(1),y=t.x,x=t.y,k=w(-1);if(b>=k){if(b>=o*.35)return t.detourSign=1,t.x=y,t.y=x,!0}else if(k>=o*.35)return t.detourSign=-1,!0;return t.detourSign=0,t.x=f,t.y=g,f!==r||g!==l}const O2=180/Math.PI,C2=Math.PI/180,F2=1e-6;function Gh(t,e){return ie[e.characterId].hasTrail?t.trailMarks.some(a=>a.ownerId===e.id&&Math.hypot(e.x-a.x,e.y-a.y)<qt.radius):!1}function Zd(t,e,a){return a.trailBoosted&&Gh(t,e)?Math.round(a.damage*qt.damageBoost):a.damage}function Ri(t,e){return e==="stun"?t.status.stunnedUntil+vg:t.status.slowedUntil+kg}function Ql(t,e,a){const o=t.status,n=e==="stun"?o.stunAppliedAt:o.slowAppliedAt,s=e==="stun"?o.stunStacks:o.slowStacks,i=a-n>=Sg;return Math.min(i?0:s+1,b0.length-1)}function Jd(t,e,a,o){return o*b0[Ql(t,e,a)]}function eh(t,e,a){const o=t.cast;o!==null&&(t.cast=null,a.push({type:"cast-cancelled",fighterRole:t.role,fighterId:t.id,weaponKey:ie[t.characterId].weapons[o.weaponIndex].key,reason:e}))}function th(t,e,a){const o=t.itemCast;o!==null&&(t.itemCast=null,a.push({type:"item-cancelled",fighterRole:t.role,fighterId:t.id,itemId:o.itemId,slot:o.slot,reason:e}))}function N2(t,e,a,o){const n=o.knockback??0;n>0&&er(a,a.x-e.x,a.y-e.y,n);const s=o.lure??0;if(s>0)for(const i of t.fighters)dn(i,e)&&x2(i,a,s)}function uf(t,e){return{kind:"weapon",weaponKey:e,weaponName:Le[e].name,attackerId:t.id,itemId:e}}function L2(t,e,a){const o=t.item;if(o.streakTarget!==e.id||a-o.streakAt>=ke.tenderiser.decayMs)return 1;const n=o.streakCount<ke.tenderiser.maxStacks?o.streakCount:ke.tenderiser.maxStacks;return ke.tenderiser.stackMul**n}function D2(t,e,a){const o=t.item,n=o.streakTarget===e.id&&a-o.streakAt<ke.tenderiser.decayMs;return o.streakCount=n?Math.min(o.streakCount+1,ke.tenderiser.maxStacks):1,o.streakTarget=e.id,o.streakAt=a,o.streakCount}function ba(t,e,a,o,n,s){if(!e.alive)return;const i=n.kind==="weapon"&&n.itemId!==void 0,r=n.kind==="weapon"?t.fighters[n.attackerId]:n.kind==="trail"?t.fighters[n.ownerId]:null,l=r!=null&&!i&&n.kind==="weapon"&&r!==e&&k0(r,"tenderiser"),h=l?L2(r,e,t.elapsed):1;let c=r&&!i?a*r.damageMul:a;h!==1&&(c*=h);const d=l?D2(r,e,t.elapsed):0,p=c<e.hp?c:e.hp;if(e.hp=Math.max(0,e.hp-c),e.lastDamagedAt=t.elapsed,o==="slow"){if(t.elapsed>=Ri(e,"slow")){const u=Jd(e,"slow",t.elapsed,Eg);u>0&&(e.status.slowStacks=Ql(e,"slow",t.elapsed),e.status.slowAppliedAt=t.elapsed,e.status.slowedUntil=t.elapsed+u)}}else if(o==="stun"){const u=t.elapsed>=Ri(e,"stun")?Jd(e,"stun",t.elapsed,Tg):0;u>0&&(e.status.stunStacks=Ql(e,"stun",t.elapsed),e.status.stunAppliedAt=t.elapsed,e.status.stunnedUntil=t.elapsed+u,e.cast!==null&&eh(e,"stun",s),e.itemCast!==null&&th(e,"stun",s))}if(r!=null&&n.kind==="weapon"&&!i){const u=ie[r.characterId].weapons.find(m=>m.key===n.weaponKey);u!==void 0&&N2(t,r,e,u)}if(s.push({type:"hit-landed",targetRole:e.role,targetId:e.id,amount:c,effect:o,source:n,x:e.x,y:e.y}),d>0&&r!=null&&s.push({type:"item-hit",itemId:"tenderiser",ownerRole:r.role,ownerId:r.id,targetRole:e.role,targetId:e.id,durationMs:ke.tenderiser.decayMs,stacks:d,fromX:e.x,fromY:e.y,x:e.x,y:e.y}),e.hp===0&&(e.alive=!1,s.push({type:"death",fighterRole:e.role,fighterId:e.id}),e.deaths++,e.item.killerId=r!=null&&r!==e?r.id:la,e.cast!==null&&eh(e,"death",s),e.itemCast!==null&&th(e,"death",s),_2(t,e,s),H2(t,e,s),t.phase==="playing")){const u=bw(t);u!==null&&(t.phase="ended",t.winner=u.role,t.winnerId=u.id,s.push({type:"match-ended",winner:u.role,winnerId:u.id}))}!i&&n.kind==="weapon"&&r!=null&&r!==e&&p>0&&t.elapsed<e.item.shieldUntil&&ba(t,r,p*ke.shiitake.reflect,null,uf(e,"shiitake"),s)}function H2(t,e,a){if(!(Rh(t)<ke.leftovers.minAliveAfterKillerDies))for(const n of t.fighters)n.item.revivesLeft<=0||n.item.killerId===e.id&&(n.alive||n.hp>0||(n.item.revivesLeft--,n.item.killerId=la,n.alive=!0,n.hp=Math.min(n.maxHp,ke.leftovers.hp*Wi(n.level)),n.status.slowedUntil=-1/0,n.status.stunnedUntil=-1/0,n.item.sleepUntil=-1/0,n.item.clogUntil=-1/0,n.item.rootUntil=-1/0,n.item.blotUntil=-1/0,n.item.shieldUntil=-1/0,n.push.x=0,n.push.y=0,n.push.remaining=0,n.push.speed=0,n.fogTimer=0,n.regenTimer=0,n.hazardTimers.length=0,n.item.auraTimers.length=0,n.lastDamagedAt=t.elapsed,a.push({type:"item-revived",fighterRole:n.role,fighterId:n.id,killerRole:e.role,killerId:e.id,hp:n.hp,x:n.x,y:n.y})))}function _2(t,e,a){const o=Math.atan2(e.facing.y,e.facing.x),n=dt.pickupRadius;for(let s=0;s<dt.count;s++){const i=o+s*2*Math.PI/dt.count;let r=Math.min(t.arena.width-n,Math.max(n,e.x+Math.cos(i)*dt.popDistance)),l=Math.min(t.arena.height-n,Math.max(n,e.y+Math.sin(i)*dt.popDistance));for(const c of t.arena.cover)if(ls(r,l,n,n,c.x,c.y,c.w,c.h)){r=e.x,l=e.y;break}const h={id:t.nextId++,sourceId:e.id,x:r,y:l,fromX:e.x,fromY:e.y,armsAt:t.elapsed+dt.popMs,expiresAt:t.elapsed+dt.popMs+dt.durationMs};t.medikits.push(h),a.push({type:"medikit-dropped",id:h.id,sourceRole:e.role,sourceId:e.id,fromX:h.fromX,fromY:h.fromY,x:h.x,y:h.y,popMs:dt.popMs})}}function Wr(t,e,a,o,n,s,i,r,l,h,c){const d=Math.atan2(h.y,h.x)+n*C2,p=Math.cos(d),u=Math.sin(d),m=o.speed??0,f=i??o.color,g=r??o.emoji,w=t.nextId++;t.projectiles.push({id:w,ownerId:e.id,targetId:a.id,ownerRole:e.role,targetRole:a.role,weapon:o,x:l.x,y:l.y,vx:p*m,vy:u*m,traveled:0,tx:a.x,ty:a.y,age:0,damage:s,color:f,emoji:g}),c.push({type:"projectile-spawned",id:w,ownerRole:e.role,ownerId:e.id,weaponKey:o.key,x:l.x,y:l.y,color:f,emoji:g})}function ff(t,e,a,o){if(a.type!=="self"){e.revealedUntil=t.elapsed+Mg;for(const n of b2(e.x,e.y,t.arena,t.brokenConcealment))o.push({type:"concealment-broken",ownerRole:e.role,ownerId:e.id,x:n.x,y:n.y,w:n.w,h:n.h,kind:n.kind})}}function mf(t,e,a,o){const s=ie[e.characterId].weapons[a];if(!s)return!1;o.push({type:"weapon-fired",fighterRole:e.role,fighterId:e.id,weaponKey:s.key}),ff(t,e,s,o);const i=P2(t,e,s,o),r=s.selfLaunch??0;return r>0&&er(e,e.facing.x,e.facing.y,r),i}function z2(t,e,a){if(t.phase!=="playing")return!1;const o=e.cast;return o===null||t.elapsed<o.resolvesAt?!1:(e.cast=null,mf(t,e,o.weaponIndex,a))}function ah(t,e,a){if(t.phase!=="playing")return"phase";const o=ie[e.characterId].weapons[a];if(!o)return"no-weapon";const n=t.elapsed;return bo(e,n)?"asleep":E0(e,n)?"clogged":e.cast!==null&&(o.castMs??0)>0?"casting":n-e.lastUsed[a]<o.cooldown?"cooldown":null}function oh(t,e,a,o){if(ah(t,e,a)!==null)return!1;const n=ie[e.characterId].weapons[a];if(!n)return!1;const s=t.elapsed,i=n.castMs??0;return e.lastUsed[a]=s,i>0?(e.cast={weaponIndex:a,startedAt:s,resolvesAt:s+i},o.push({type:"cast-started",fighterRole:e.role,fighterId:e.id,weaponKey:n.key,castMs:i}),ff(t,e,n,o),!0):mf(t,e,a,o)}function P2(t,e,a,o){const n=pn(t,e);if(a.type==="self"){const h=(a.healAmount??0)*Wi(e.level),c=Math.min(h,e.maxHp-e.hp);return e.hp=Math.min(e.maxHp,e.hp+h),c>0&&o.push({type:"heal",fighterRole:e.role,fighterId:e.id,amount:c}),!0}if(n===null)return!0;if(a.type==="melee"){const h=a.cone??360,c=a.range??0,d=Zd(t,e,a);for(const p of t.fighters){if(!dn(p,e))continue;const u=p.x-e.x,m=p.y-e.y,f=Math.hypot(u,m);if(!(f>c)){if(h<360){if(f<F2)continue;const g=(e.facing.x*u+e.facing.y*m)/f;if(Math.acos(Math.max(-1,Math.min(1,g)))*O2>h/2)continue}ba(t,p,d,a.effect,{kind:"weapon",weaponKey:a.key,weaponName:a.name,attackerId:e.id},o)}}return!0}const s={x:e.x,y:e.y},i=e.facing,r=e.controller==="human"?ww(t,e)??n:n;if(a.comboParts){for(const h of a.comboParts)Wr(t,e,r,a,h.angle,h.damage,h.color,h.emoji,s,i,o);return!0}const l=Zd(t,e,a);if(a.pellets&&a.pellets>1){const h=a.spreadDeg??0;for(let c=0;c<a.pellets;c++){const d=(c-(a.pellets-1)/2)*h,p=a.pelletColors?a.pelletColors[c%a.pelletColors.length]:void 0,u=a.pelletEmojis?a.pelletEmojis[c%a.pelletEmojis.length]:void 0;Wr(t,e,r,a,d,l,p,u,s,i,o)}}else Wr(t,e,r,a,0,l,void 0,void 0,s,i,o);return!0}const Cs=y0,Gr=1e3;function jh(t,e,a){if(t.phase!=="playing")return!1;const o=e.item.equipped[a];if(o===void 0)return!1;const n=Le[o];if(n.kind!=="active"||bo(e,t.elapsed)||Rh(t)<n.minAlive||e.itemCast!==null)return!1;const s=n.cooldownMs??0;return t.elapsed-e.item.lastUsed[a]>=s}function gf(t,e,a,o){if(!jh(t,e,a))return!1;const n=e.item.equipped[a];Le[n];const s=t.elapsed;e.item.lastUsed[a]=s;const i=n==="shiitake"?ke.shiitake.windupMs:0;return o.push({type:"item-used",fighterRole:e.role,fighterId:e.id,itemId:n,slot:a,x:e.x,y:e.y,windupMs:i}),i>0?(e.itemCast={slot:a,itemId:n,startedAt:s,resolvesAt:s+i},!0):(wf(t,e,a,n,o),!0)}function $2(t,e,a){if(t.phase!=="playing")return!1;const o=e.itemCast;return o===null||t.elapsed<o.resolvesAt?!1:(e.itemCast=null,a.push({type:"item-resolved",fighterRole:e.role,fighterId:e.id,itemId:o.itemId,slot:o.slot,x:e.x,y:e.y}),wf(t,e,o.slot,o.itemId,a),!0)}function Nn(t,e,a){const o=pn(t,e);return o===null?null:Math.hypot(o.x-e.x,o.y-e.y)<=a?o:null}function Fs(t,e,a,o,n,s,i){return s<=0||t.elapsed<a.item[n]?!1:(a.item[n]=t.elapsed+s,n==="sleepUntil"&&(a.cast!==null&&eh(a,"sleep",i),a.itemCast!==null&&th(a,"sleep",i)),i.push({type:"item-hit",itemId:o,ownerRole:e.role,ownerId:e.id,targetRole:a.role,targetId:a.id,durationMs:s,stacks:0,fromX:a.x,fromY:a.y,x:a.x,y:a.y}),!0)}function wf(t,e,a,o,n){switch(o){case"springform":{er(e,e.facing.x,e.facing.y,ke.springform.distance,{cap:ke.springform.distance,speed:ke.springform.distance/ke.springform.travelMs});return}case"warm_milk":{const s=Nn(t,e,ke.warm_milk.range);if(s===null)return;const i=Math.hypot(s.x-e.x,s.y-e.y),r=ke.warm_milk.range>0?Math.min(1,Math.max(0,i/ke.warm_milk.range)):0,l=ke.warm_milk.minMs+(ke.warm_milk.maxMs-ke.warm_milk.minMs)*r;Fs(t,e,s,o,"sleepUntil",l,n);return}case"pompa":{const s=Nn(t,e,Cs);if(s===null)return;Fs(t,e,s,o,"clogUntil",ke.pompa.clogMs,n);return}case"squid_ink":{const s=Nn(t,e,Cs);if(s===null)return;Fs(t,e,s,o,"blotUntil",ke.squid_ink.blotMs,n);return}case"liquorice":{const s=Nn(t,e,Cs);if(s===null)return;Fs(t,e,s,o,"rootUntil",ke.liquorice.rootMs,n);return}case"shiitake":{e.item.shieldUntil=t.elapsed+ke.shiitake.durationMs,n.push({type:"item-hit",itemId:o,ownerRole:e.role,ownerId:e.id,targetRole:e.role,targetId:e.id,durationMs:ke.shiitake.durationMs,stacks:0,fromX:e.x,fromY:e.y,x:e.x,y:e.y});return}case"disposal":{const s=Nn(t,e,Cs);if(s===null)return;const i=pn(t,s,e);if(i===null)return;const r=s.x,l=s.y;let h=r-i.x,c=l-i.y;const d=Math.hypot(h,c);d<1e-6?(h=i.facing.x,c=i.facing.y):(h/=d,c/=d);const p=ke.disposal.dropDistance;v2(s,i.x+h*p,i.y+c*p,t.arena),n.push({type:"item-hit",itemId:o,ownerRole:e.role,ownerId:e.id,targetRole:s.role,targetId:s.id,durationMs:0,stacks:0,fromX:r,fromY:l,x:s.x,y:s.y});return}case"tenderiser":case"blue_cheese":case"leftovers":return}}const Ns=400,za=1e-6,Qd=.8,ep=.6,aa={x:0,y:0},Xe={dirX:0,dirY:0,navX:0,navY:0},bf=Math.PI/180,B2=[0];function yf(t){if(t.comboParts)return t.comboParts.map(n=>n.angle);const e=t.pellets??1;if(e<=1)return B2;const a=t.spreadDeg??0,o=[];for(let n=0;n<e;n++)o.push((n-(e-1)/2)*a);return o}const U2=(()=>{const t=new Map;for(const e of Te)for(const a of ie[e].weapons)t.set(a,yf(a));return t})();function q2(t,e,a,o,n){const s=e.range??0;if(s<=0)return null;const i=a-t.x,r=o-t.y,l=Math.hypot(i,r),h=l>za?i/l:1,c=l>za?r/l:0;switch(e.type){case"self":return null;case"melee":return{margin:l-s,outX:h,outY:c};case"ranged":{const p=s+n,u=l-p;if(e.homing)return{margin:u,outX:h,outY:c};const m=Math.hypot(t.facing.x,t.facing.y);if(m<za)return{margin:u,outX:h,outY:c};const f=t.facing.x/m,g=t.facing.y/m,w=i*f+r*g,b=-i*g+r*f;let y=-1/0,x=-1/0,k=!1,T=!0;for(const D of U2.get(e)??yf(e)){const _=D*bf,E=Math.cos(_),A=Math.sin(_);if(w*E+b*A<0)continue;if(E<=za){T=!1;break}k=!0;const R=b*E-w*A,I=(n-R)/E,L=(n+R)/E;I>y&&(y=I),L>x&&(x=L)}if(!T)return{margin:u,outX:h,outY:c};if(!k)return{margin:l-n,outX:h,outY:c};const v=y<=x,O=v?-y:-x;return u>=O?{margin:u,outX:h,outY:c}:{margin:O,outX:v?-g:g,outY:v?f:-f}}}return e.type}function W2(t,e,a,o,n){const s=e.x,i=e.y;aa.x=0,aa.y=0;let r=0;for(const u of t.arena.hazards){if(u.kind!=="damage")continue;const m=s-u.x,f=i-u.y,g=Math.hypot(m,f),w=u.radius+Mn;if(g>=w)continue;const b=g>za?m/g:1,y=g>za?f/g:0,x=-y*a+b*o>=0?1:-1,k=-y*x,T=b*x,v=Math.min(2,(w-g)/Mn),O=v*yr;aa.x+=(b*Qd+k*ep)*O,aa.y+=(y*Qd+T*ep)*O,v>r&&(r=v)}const l=t.arena.center.x,h=t.arena.center.y,c=l-s,d=h-i,p=Math.hypot(c,d);if(p>za){const u=t.safeRadius-p;if(u<xr){const m=Math.min(2,(xr-u)/xr);aa.x+=c/p*m*Uc,aa.y+=d/p*m*Uc,m>r&&(r=m)}}for(const u of t.fighters){if(u===e||!u.alive)continue;const m=u.cast;if(m===null)continue;const f=ie[u.characterId].weapons[m.weaponIndex];if(f===void 0)continue;const g=q2(u,f,s,i,e.hitRadius);if(g===null)continue;const w=g.margin;if(w>=Mn)continue;const b=Math.max(0,m.resolvesAt-t.elapsed);if(w<0&&-w>n*b)continue;const y=Math.min(2,(Mn-w)/Mn);aa.x+=g.outX*y*yr,aa.y+=g.outY*y*yr,y>r&&(r=y)}return r}const tp={melee:!0,ranged:!0,self:!1},G2={melee:!1,ranged:!1,self:!0},j2=(()=>{const t=new Map,e=a=>{const o=Math.abs(Math.sin(a*bf));return o<1e-9?1/0:x0/o};for(const a of Te)for(const o of ie[a].weapons){let n=0;const s=[];if(o.type!=="self")if(o.comboParts)for(const i of o.comboParts){const r=e(i.angle);r===1/0?n+=i.damage:s.push({maxDist:r,damage:i.damage})}else{const i=o.damage*(o.peckHits??1),r=o.pellets??1;if(o.type==="melee"||r<=1||o.homing)n=i*r;else{const l=o.spreadDeg??0;for(let h=0;h<r;h++){const c=e((h-(r-1)/2)*l);c===1/0?n+=i:s.push({maxDist:c,damage:i})}}}t.set(o,{always:n,offAxis:s})}return t})();function Y2(t,e){const a=j2.get(t);if(!a)return t.damage;let o=a.always;for(const n of a.offAxis)e<n.maxDist&&(o+=n.damage);return o}const ap=(t,e,a,o,n)=>Y2(a,n),V2=(t,e,a)=>{const o=a.healAmount??0;return o<=0||e.hp>e.maxHp*Cg||e.maxHp-e.hp<o?-1/0:o};function jr(t,e,a,o,n,s){const i=ie[e.characterId].weapons,r=t.elapsed;if(E0(e,r))return null;let l=null,h=-1/0;for(let c=0;c<i.length;c++){const d=i[c];if(!o[d.type]||r-e.lastUsed[c]<d.cooldown||a>(d.range??1/0)||(d.castMs??0)>0&&(d.castMs??0)>=s)continue;const p=n(t,e,d,c,a);p>h&&(h=p,l=c)}return l}const Ls=y0,K2=(()=>{const t=new Map;for(const e of Te){let a=0;for(const o of ie[e].weapons)o.type!=="self"&&(a=Math.max(a,o.range??1/0));t.set(e,a)}return t})();function op(t){return K2.get(t)??0}function X2(t,e,a,o,n,s,i,r){const l=t.elapsed;switch(a){case"springform":return!i&&s&&!Yi(e,l)&&e.push.remaining<=0&&n>op(e.characterId);case"warm_milk":return s&&n<=ke.warm_milk.range&&!bo(o,l);case"pompa":return s&&n<=Ls&&!bo(o,l)&&l>=o.item.clogUntil;case"squid_ink":return s&&n<=Ls&&!bo(o,l)&&l>=o.item.blotUntil;case"liquorice":return s&&n<=Ls&&!bo(o,l)&&l>=o.item.rootUntil;case"disposal":{if(!s||n>Ls)return!1;const h=pn(t,o,e);return h===null?!1:Math.hypot(h.x-e.x,h.y-e.y)-ke.disposal.dropDistance>n}case"shiitake":return!i&&s&&l>=e.item.shieldUntil&&ke.shiitake.windupMs<r&&n<=op(o.characterId);case"tenderiser":case"blue_cheese":case"leftovers":return!1}}function Z2(t,e,a,o,n,s,i){const r=e.item.equipped;if(r.length===0)return null;for(let l=0;l<r.length;l++)if(jh(t,e,l)&&X2(t,e,r[l],a,o,n,s,i))return l;return null}function J2(t,e,a,o){if(t.phase!=="playing")return!1;const n=pn(t,e);if(e.hp<=0||n===null)return!1;const s=t.elapsed,i=Wh(e.x,e.y,n.x,n.y,t.arena,t,n),r=t.sightings[Gl(e.id,n.id,t.fighters.length)];i&&(r.x=n.x,r.y=n.y,r.at=s);const l=r.x,h=r.y,c=l-e.x,d=h-e.y,p=Math.hypot(c,d),u=p||1,m=p>1e-6,f=e.hp<e.maxHp*Ag,g=(s<e.status.slowedUntil?Rg:1)*hf(e.x,e.y,t.arena,t.splats)*(Gh(t,e)?qt.speedBoost:1),w=Yi(e,s);m&&!M0(e)&&(e.facing={x:c/u,y:d/u});let b=!1;const y=f?-1:1,x=ni(e.characterId,f?$c:Bc)*g,k=(()=>{if(t.medikits.length===0||e.maxHp-e.hp<dt.heal*Wi(e.level))return null;let L=null,B=1/0;for(const H of t.medikits){const j=Math.hypot(H.x-e.x,H.y-e.y);j>=B||j>(H.expiresAt-s)*x||(L=H,B=j)}return L})(),T=k===null?0:Math.hypot(k.x-e.x,k.y-e.y)||1,v=k===null?y*c/u:(k.x-e.x)/T,O=k===null?y*d/u:(k.y-e.y)/T,D=W2(t,e,v,O,x),_=D>=Og,E=(L,B,H,j)=>{if(Xe.dirX=L,Xe.dirY=B,Xe.navX=H,Xe.navY=j,D<=0)return;const S=L+aa.x,N=B+aa.y,q=Math.hypot(S,N);q<za||(Xe.dirX=S/q,Xe.dirY=N/q,Xe.navX=e.x+Xe.dirX*Ns,Xe.navY=e.y+Xe.dirY*Ns)},A=_&&!w,C=_?0:Xn(t.timeRemaining)?e.hp*1e3/Ig:1/0,R=A?null:jr(t,e,u,G2,V2,C);if(f){if(!w){const B=ni(e.characterId,$c)*a*g;k!==null?E(v,O,k.x,k.y):E(-c/u,-d/u,e.x-c/u*Ns,e.y-d/u*Ns),Xd(e,Xe.dirX,Xe.dirY,B,t.arena,Xe.navX,Xe.navY),b=!0}const L=R??(i?jr(t,e,u,tp,ap,C):null);L!==null&&oh(t,e,L,o)}else{const L=A?null:R??(i?jr(t,e,u,tp,ap,C):null);if(L!==null)oh(t,e,L,o);else if(!w){const B=ni(e.characterId,Bc)*a*g;k!==null?E(v,O,k.x,k.y):E(c/u,d/u,l,h),Xd(e,Xe.dirX,Xe.dirY,B,t.arena,Xe.navX,Xe.navY),b=!0}}const I=Z2(t,e,n,p,i,f,C);return I!==null&&gf(t,e,I,o),b}const np=12;function Ds(t,e,a,o){if(Array.isArray(e)){if(a!==void 0||o!==void 0)throw new TypeError("createMatch: the fighter-list form takes no third or fourth argument; put `level` on each FighterConfig instead");return sp(t,e)}const n=o??{};return sp(t,[{characterId:e,level:n.player},{characterId:a,level:n.enemy}])}function sp(t,e){if(e.length<rt||e.length>Jt)throw new RangeError(`createMatch: ${e.length} fighters; the sim seats ${rt}..${Jt} (see state.ts MIN_FIGHTERS / MAX_FIGHTERS)`);const a=e.length===rt,o=e.map((i,r)=>{const l=Ga(i.level??Io),h=r===0,c=a&&!h,d=i.spawn??Q2(t,r);return gw({id:r,controller:i.controller??(h?"human":"ai"),characterId:i.characterId,spawn:d,maxHp:i.maxHp??Ul(i.characterId,c?Dg:ql,l),size:i.size??(c?Lg:w0),hitRadius:i.hitRadius??(c?Ng:x0),facing:i.facing??ex(t,r,d),level:l,items:i.items})}),n=o.length,s=new Array(n*n);for(let i=0;i<n;i++)for(let r=0;r<n;r++)s[Gl(i,r,n)]={x:o[r].x,y:o[r].y,at:0};return{phase:"countdown",elapsed:0,countdownValue:Hg,countdownTick:0,startFlashTimer:0,timeRemaining:Wa,safeRadius:t.maxSafeRadius,fighters:o,player:o[0],enemy:o[1],projectiles:[],splats:[],trailMarks:[],medikits:[],winner:null,winnerId:null,arena:t,sightings:s,aiSighting:s[Gl(1,0,n)],brokenConcealment:[],nextId:1}}function Q2(t,e){if(e===0)return t.playerSpawn;if(e===1)return t.enemySpawn;const a=t.spawns?.[e];if(a)return{x:a.x,y:a.y};throw new RangeError(`createMatch: slot ${e} has no spawn. ArenaDefinition declares playerSpawn and enemySpawn only, so slots 2 and up must pass \`spawn\` explicitly — arena geometry is src/arena/**'s to own (DECISIONS §48: spawn placement is part of the 180° point-symmetry fairness constraint).`)}function ex(t,e,a){if(e===0)return{x:1,y:0};if(e===1)return{x:-1,y:0};const o=t.center.x-a.x,n=t.center.y-a.y,s=Math.hypot(o,n);return s>1e-6?{x:o/s,y:n/s}:{x:1,y:0}}const tx=Object.freeze({move:Object.freeze({x:0,y:0}),selectedWeapon:0,attack:!1});function ip(t,e,a){const o=[];if(t.elapsed+=e,ox(t,e,o),t.phase==="playing"){t.timeRemaining=Math.max(0,t.timeRemaining-e);const n=Wa-t.timeRemaining;t.safeRadius=Xn(t.timeRemaining)?Bl:Fg(n,t.arena.maxSafeRadius,wi(t.fighters.length))}if(nx(t),t.phase==="playing"){const n=Array.isArray(a)?a:null;for(const s of t.fighters){let i;if(z2(t,s,o),$2(t,s,o),!!s.alive){if(s.controller==="human"){const r=n===null?a:n[s.id]??tx;ix(s,r),r.attack&&oh(t,s,r.selectedWeapon,o),i=rx(t,s,e,r);const l=r.useItem??null;l!==null&&gf(t,s,l,o)}else i=J2(t,s,e,o);k2(s,e,t.arena,t.elapsed,t.fighters),lx(t,s,e,i,o)}}Xn(t.timeRemaining)&&hx(t,e,o),sx(t,o)}return dx(t,e,o),t.phase==="playing"&&t.timeRemaining<=0&&ax(t,o),o}function ax(t,e){const{arena:a}=t,o=r=>r.maxHp>0?r.hp/r.maxHp:0,n=r=>Math.hypot(r.x-a.center.x,r.y-a.center.y),i=t.fighters.slice().sort((r,l)=>{const h=o(r),c=o(l);if(h!==c)return c-h;const d=n(r),p=n(l);return d!==p?d-p:r.deaths!==l.deaths?r.deaths-l.deaths:r.id-l.id})[0];t.phase="ended",t.winner=i.role,t.winnerId=i.id,e.push({type:"match-ended",winner:i.role,winnerId:i.id})}function ox(t,e,a){t.phase==="countdown"&&(t.countdownTick+=e,t.countdownTick>=1e3&&(t.countdownTick-=1e3,t.countdownValue-=1,t.countdownValue>0?a.push({type:"countdown-tick",value:t.countdownValue}):(t.startFlashTimer=_g,a.push({type:"countdown-tick",value:0}))),t.countdownValue<=0&&(t.startFlashTimer-=e,t.startFlashTimer<=0&&(t.phase="playing",t.timeRemaining=Wa,t.safeRadius=t.arena.maxSafeRadius,a.push({type:"match-started"}))))}function nx(t){for(let e=t.splats.length-1;e>=0;e--)t.elapsed>=t.splats[e].expiresAt&&t.splats.splice(e,1);for(let e=t.trailMarks.length-1;e>=0;e--)t.elapsed>=t.trailMarks[e].expiresAt&&t.trailMarks.splice(e,1);for(let e=t.medikits.length-1;e>=0;e--)t.elapsed>=t.medikits[e].expiresAt&&t.medikits.splice(e,1)}function sx(t,e){for(let a=0;a<t.medikits.length;){const o=t.medikits[a];if(t.elapsed<o.armsAt){a++;continue}let n=null;for(const r of t.fighters)if(!(!r.alive||r.hp>=r.maxHp)&&!(Math.hypot(r.x-o.x,r.y-o.y)>dt.pickupRadius)){if(n===null){n=r;continue}r.hp/r.maxHp<n.hp/n.maxHp&&(n=r)}if(n===null){a++;continue}const s=n.hp;n.hp=Math.min(n.maxHp,n.hp+dt.heal*Wi(n.level));const i=n.hp-s;t.medikits.splice(a,1),e.push({type:"heal",fighterRole:n.role,fighterId:n.id,amount:i}),e.push({type:"medikit-taken",id:o.id,fighterRole:n.role,fighterId:n.id,x:o.x,y:o.y,amount:i})}}function xf(t,e){return hf(e.x,e.y,t.arena,t.splats)}function ix(t,e){if(M0(t)||!e.aim)return;const a=Math.hypot(e.aim.x,e.aim.y);a>1e-6&&(t.facing={x:e.aim.x/a,y:e.aim.y/a})}function rx(t,e,a,o){const n=t.elapsed;let s=xf(t,e);Gh(t,e)&&(s*=qt.speedBoost),n<e.status.slowedUntil&&(s*=qg);const r=Yi(e,n)?0:ni(e.characterId,g0)*a*s,l=o.move.x*r,h=o.move.y*r;return Ai(e,l,h,t.arena),l!==0||h!==0}function lx(t,e,a,o,n){if(!e.alive)return;if(e.terrainSlowFactor=xf(t,e),e.concealed=lf(e.x,e.y,t.arena,t,e),ie[e.characterId].hasTrail&&o){if(e.trailDropTimer+=a,e.trailDropTimer>=qt.dropIntervalMs){e.trailDropTimer=0;const r={id:t.nextId++,ownerId:e.id,ownerRole:e.role,x:e.x,y:e.y,expiresAt:t.elapsed+qt.durationMs,damagedMask:0,damaged:!1};t.trailMarks.push(r),n.push({type:"trail-mark-created",ownerRole:e.role,ownerId:e.id,x:e.x,y:e.y})}}else e.trailDropTimer=0;for(const r of t.fighters){if(r===e||!r.alive)continue;const l=fw(r.id);let h=0;for(const c of t.trailMarks)if(!(c.ownerId!==e.id||(c.damagedMask&l)!==0)&&!(Math.hypot(r.x-c.x,r.y-c.y)>=qt.radius)&&(c.damagedMask|=l,c.damaged=!0,!(h>=qt.maxHitsPerTick)&&(h++,ba(t,r,qt.damage,null,{kind:"trail",ownerId:e.id,ownerRole:e.role},n),!r.alive)))break}if(k0(e,"blue_cheese")){const r=ke.blue_cheese.radius,l=ke.blue_cheese.dps*(Gr/1e3);for(const h of t.fighters){if(!dn(h,e))continue;const c=h.item.auraTimers;if(Math.hypot(h.x-e.x,h.y-e.y)<r){let d=(c[e.id]??0)+a;const p=d>=Gr;p&&(d-=Gr),c[e.id]=d,p&&ba(t,h,l,null,uf(e,"blue_cheese"),n)}else c[e.id]!==void 0&&(c[e.id]=0)}}if(t.arena.hazards.forEach((r,l)=>{if(r.kind!=="damage")return;if(Math.hypot(e.x-r.x,e.y-r.y)<r.radius){const c=(e.hazardTimers[l]??0)+a;c>=(r.tickMs??1/0)?(e.hazardTimers[l]=0,ba(t,e,r.damage??0,null,{kind:"hazard"},n)):e.hazardTimers[l]=c}else e.hazardTimers[l]=0}),t.elapsed-e.lastDamagedAt>zg&&e.hp<e.maxHp&&e.hp>0){if(e.regenTimer+=a,e.regenTimer>=Pg){e.regenTimer=0;const r=e.hp;e.hp=Math.min(e.maxHp,e.hp+m0),e.hp>r&&n.push({type:"heal",fighterRole:e.role,fighterId:e.id,amount:e.hp-r})}}else e.regenTimer=0;if(Xn(t.timeRemaining))return;Math.hypot(e.x-t.arena.center.x,e.y-t.arena.center.y)>t.safeRadius&&e.hp>0?(e.fogTimer+=a,e.fogTimer>=bi&&(e.fogTimer=0,ba(t,e,Mh,null,{kind:"fog"},n))):e.fogTimer=0}function hx(t,e,a){const o=Wl-t.timeRemaining;if(Math.floor(o/bi)===Math.floor((o-e)/bi))return;const n=t.fighters.slice().sort((s,i)=>s.hp!==i.hp?s.hp-i.hp:i.id-s.id);for(const s of n){if(t.phase!=="playing")break;!s.alive||s.hp<=0||Math.hypot(s.x-t.arena.center.x,s.y-t.arena.center.y)<=t.safeRadius||ba(t,s,Mh,null,{kind:"fog"},a)}}function Hs(t,e,a,o){const n=t.projectiles[e];o.push({type:"projectile-destroyed",id:n.id,reason:a,x:n.x,y:n.y}),t.projectiles.splice(e,1)}function rp(t,e,a,o){const n={id:t.nextId++,x:e,y:a,expiresAt:t.elapsed+Bg};t.splats.push(n),o.push({type:"splat-created",x:e,y:a})}function cx(t,e,a){let o=null,n=1/0;for(const s of t.fighters){if(!dn(s,a))continue;const i=Math.hypot(e.x-s.x,e.y-s.y);i>=s.hitRadius||i<n&&(n=i,o=s)}return o}function dx(t,e,a){for(let o=t.projectiles.length-1;o>=0;o--){const n=t.projectiles[o],s=n.weapon,i=t.fighters[n.targetId],r=t.fighters[n.ownerId];if(s.peckHits&&n.arrived){if(i.hp<=0){Hs(t,o,"expired",a);continue}n.peckTimer=(n.peckTimer??0)+e,n.peckTimer>=(s.peckInterval??500)&&(n.peckTimer=0,ba(t,i,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name,attackerId:n.ownerId},a),n.hitsSoFar=(n.hitsSoFar??1)+1,n.hitsSoFar>=s.peckHits&&Hs(t,o,"expired",a));continue}if(s.homing&&i.hp>0&&Wh(n.x,n.y,i.x,i.y,t.arena,t,i)){const g=i.x-n.x,w=i.y-n.y,b=Math.hypot(g,w)||1,y=g/b,x=w/b,k=Math.hypot(n.vx,n.vy)||1,T=n.vx/k,v=n.vy/k,O=Math.min(1,Ug*e),D=T+(y-T)*O,_=v+(x-v)*O,E=Math.hypot(D,_)||1,A=s.speed??0;n.vx=D/E*A,n.vy=_/E*A}const l=n.vx*e/1e3,h=n.vy*e/1e3,c=n.x+l,d=n.y+h,p=t.arena.cover.some(g=>ls(c,d,np,np,g.x,g.y,g.w,g.h)),u=Math.hypot(l,h);let m=u;if(u>0&&n.tx!==void 0&&n.ty!==void 0){const g=((i.x-n.tx)*l+(i.y-n.ty)*h)/u;g>0&&(m=u-g)}if(n.tx=i.x,n.ty=i.y,n.age=(n.age??0)+e,n.traveled+=m>0?m:0,n.x=c,n.y=d,p||n.traveled>=(s.range??1/0)||n.age>=$g(s)){s.splatter&&rp(t,n.x,n.y,a),Hs(t,o,p?"hit-cover":"expired",a);continue}const f=cx(t,n,r);if(f!==null){if(f!==i&&(n.targetId=f.id,n.targetRole=f.role),ba(t,f,n.damage,s.effect,{kind:"weapon",weaponKey:s.key,weaponName:s.name,attackerId:n.ownerId},a),s.splatter&&rp(t,n.x,n.y,a),s.peckHits){n.arrived=!0,n.peckTimer=0,n.hitsSoFar=1;continue}Hs(t,o,"hit-target",a);continue}}}const lp="pointerlock-styles",px=2600;function vf(){const t=new URLSearchParams(location.search);return t.get("pointerLock")??t.get("pointerlock")}function ux(){const t=vf();if(t==="0")return!1;if(t==="1"||t==="sim")return!0;const e=new URLSearchParams(location.search);return!(e.has("shot")||e.has("simSpeed"))}function fx(){return typeof window.matchMedia!="function"?!0:window.matchMedia("(pointer: fine)").matches}function mx(t){const{target:e}=t,a=vf()==="sim";let o=!1;const s=typeof document<"u"&&"pointerLockElement"in document&&typeof e.requestPointerLock=="function"&&fx()&&ux();let i=!1,r=!1,l=!0,h="hidden",c=0,d=!1,p=!1,u="";const m=document.createElement("div");m.className="plk-root",m.innerHTML=`
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
  `;const f=H=>m.querySelector(`[data-el="${H}"]`),g=f("fs"),w=f("fs2");function b(){return a?o:document.pointerLockElement===e}function y(){window.__plockDebug={state:h,wantsLock:i,locked:b(),pending:p,lastError:u,available:s}}function x(){m.classList.toggle("is-prompt",h==="prompt"),m.classList.toggle("is-toast",h==="toast"),m.classList.toggle("is-lost",h==="lost"),y()}function k(H){h!==H&&(h=H,window.clearTimeout(c),H==="toast"&&(c=window.setTimeout(()=>{!d&&h==="toast"&&k("hidden")},px)),x())}function T(){const j=!!document.fullscreenElement?"⛶ Exit fullscreen":"⛶ Fullscreen";g.textContent=j,w.textContent=j}function v(){try{document.fullscreenElement?document.exitFullscreen?.()?.catch(()=>{}):document.documentElement.requestFullscreen?.()?.catch(()=>{})}catch{}}function O(H){if(u=H===void 0?"refused":String(H?.message??H),y(),!(d||!i||b())){if(!l){k("hidden");return}t.pause(),k("lost")}}function D(){if(!(d||!s||!l||!i||b()||p)){if(a){o=!0,C();return}p=!0;try{const H=e.requestPointerLock();H&&typeof H.then=="function"?H.then(()=>{p=!1},j=>{p=!1,O(j)}):window.setTimeout(()=>{p=!1},0)}catch(H){p=!1,O(H)}}}function _(){if(b()){if(r=!0,a){o=!1,C();return}try{document.exitPointerLock()}catch{r=!1}}}function E(){i=!0,t.resume()}function A(){i=!1,_(),k("prompt"),t.resume()}const C=()=>{if(d)return;const H=b();if(t.onLockChange(H),p=!1,H){i=!0,r=!1,k("toast");return}if(r){r=!1,k(l&&s?"prompt":"hidden");return}i&&l?(t.pause(),k("lost")):k(l&&s?"prompt":"hidden")},R=()=>{p=!1,!d&&O("pointerlockerror")},I=()=>{d||!i||!s||!l||b()||h!=="lost"&&(t.pause(),k("lost"))},L=()=>T(),B=H=>{d||!o||H.key!=="Escape"||(H.preventDefault(),H.stopImmediatePropagation(),o=!1,C())};return s&&(gx(),document.body.appendChild(m),document.addEventListener("pointerlockchange",C),document.addEventListener("pointerlockerror",R),document.addEventListener("fullscreenchange",L),window.addEventListener("blur",I),a&&window.addEventListener("keydown",B,!0),m.addEventListener("mousedown",H=>{H.target?.closest?.("button")&&H.preventDefault()}),f("capture").addEventListener("click",H=>{H.stopPropagation(),E()}),f("resume").addEventListener("click",H=>{H.stopPropagation(),E()}),f("scrim").addEventListener("click",()=>E()),f("free").addEventListener("click",H=>{H.stopPropagation(),A()}),g.addEventListener("click",H=>{H.stopPropagation(),v()}),w.addEventListener("click",H=>{H.stopPropagation(),v()}),T(),k("prompt"),x()),{available:s,get locked(){return s&&b()},engage:D,release:_,setMatchActive(H){!s||l===H||(l=H,H?b()||k("prompt"):(_(),k("hidden")))},dispose(){d||(d=!0,window.clearTimeout(c),s&&(_(),document.removeEventListener("pointerlockchange",C),document.removeEventListener("pointerlockerror",R),document.removeEventListener("fullscreenchange",L),window.removeEventListener("blur",I),window.removeEventListener("keydown",B,!0),m.remove()))}}}function gx(){if(document.getElementById(lp))return;const t=document.createElement("style");t.id=lp,t.textContent=wx,document.head.appendChild(t)}const wx=`
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
`,ra=.11,hp=ae*.1,kf=new pt(ra,12,10);kf.scale(1,.86,1);const bx=new cn(ra*.32,ra*.5,6),Jo=new Gi(ra*.6,0);Jo.scale(1,.4,1);const yx=new X({color:"#E63946"}),xx=new X({color:"#3E5C2B"}),vx=new X({color:"#FF9E9E",transparent:!0,opacity:.55,depthWrite:!1});function Yh(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const kx=Yh(18,()=>new X({color:"#E63946",transparent:!0,opacity:.85,depthWrite:!1})),Mx=Yh(20,()=>new X({color:"#C21F32",transparent:!0,opacity:.9,depthWrite:!1})),cp=Yh(6,()=>new X({color:"#FFD9C7",transparent:!0,opacity:.95,blending:tt,depthWrite:!1}));function Ex(t){const e=new he,a=new M(kf,yx);e.add(a);const o=new M(bx,xx);o.position.set(0,ra*.75,0),e.add(o);const n=new M(Jo,vx);return n.scale.setScalar(.55),n.position.set(ra*.32,ra*.28,ra*.5),e.add(n),e}function Yr(t,e,a,o,n,s=1){const i=new M(Jo,Mx()),r=(.3+Math.random()*.25)*s;i.scale.setScalar(r),i.position.copy(e);const l=e.x,h=e.y,c=e.z,d=1.1+Math.random()*1.3,p=-5.5,u=.32+Math.random()*.16;t.spawnTransient(i,u,(m,f)=>{i.position.set(l+a*n*f,h+d*f+.5*p*f*f,c+o*n*f),i.scale.setScalar(r*(1-m*.35)),i.material.opacity=.9*(1-m)})}const Tx={Tomato:{projectile(t){const e=Ex(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=(e.userData.__spin??0)+a*8;e.userData.__spin=o,e.rotation.x=o,e.rotation.z=Math.sin(o*.6)*.25;const n=1+Math.sin(o*2.2)*.09;e.scale.set(1/n,n,1/n);const s=(e.userData.__dripTimer??.05)-a;s<=0?(e.userData.__dripTimer=.09+Math.random()*.05,Yr(t,t.position,-t.direction.x*.5,-t.direction.z*.5,.3+Math.random()*.25)):e.userData.__dripTimer=s},impact(t){const e=t.position,a=K.clamp(1+t.damage*.05,1,2.2),o=hp/(ra*.6),n=new M(Jo,cp());n.position.copy(e),n.scale.setScalar(.7*o),t.spawnTransient(n,.18,r=>{n.scale.setScalar(K.lerp(.7,2.4,r)*o*a),n.material.opacity=.9*(1-r)});const s=7,i=wo*.45;for(let r=0;r<s;r++){const l=r/s*Math.PI*2+Math.random()*.5,h=i+(.5+Math.random()*.75)*a,c=new M(Jo,kx()),d=(.55+Math.random()*.4)*o*a,p=e.x+Math.cos(l)*i,u=e.y,m=e.z+Math.sin(l)*i;c.position.set(p,u,m),c.rotation.y=Math.random()*Math.PI*2;const f=e.x+Math.cos(l)*h,g=e.z+Math.sin(l)*h,w=u-.9;t.spawnTransient(c,.55+Math.random()*.2,b=>{const y=1-Math.pow(1-b,3);c.position.set(K.lerp(p,f,y),K.lerp(u,w,Math.min(1,y*1.3)),K.lerp(m,g,y)),c.scale.setScalar(d*(1-b*.3)),c.material.opacity=.85*(1-Math.pow(b,1.5))})}for(let r=0;r<5;r++){const l=Math.random()*Math.PI*2;Yr(t,e,Math.cos(l),Math.sin(l),1.3+Math.random()*1.1,o)}},cast(t){const e=hp/(ra*.6),a=new M(Jo,cp()),o=a.material;o.color.set(t.color),a.position.copy(t.position),a.scale.setScalar(.16*e),t.spawnTransient(a,.15,n=>{a.scale.setScalar(K.lerp(.16,.62,n)*e),o.opacity=.9*(1-n)});for(let n=0;n<3;n++){const s=(Math.random()-.5)*.6;Yr(t,t.position,t.direction.x+s,t.direction.z+s,.9+Math.random()*.5,e*.35)}}}},Vh="#C93F73",Sx="#F0C070",tr="#FFF0F6",Ax="#FFD9EC",nh=["#E63946","#7CB518","#FFC93C","#7C4DFF","#2E86D8","#FFFFFF"],Dt=ae,To=Math.PI*2,Ii=.28,Zt=Dt*.09,va=Dt*.043,Rx=Dt*.014,Ix=Dt*.042,_s=Dt*.375,zs=Dt*.4;function Qo(t,e,a,o,n){const s=new Th(t,e,a,o,n);return s.rotateX(-Math.PI/2),s}const Ox=Qo(Zt,va,8,22),Cx=Qo(Zt,va*.82,8,22),Fx=Qo(Zt,va*1.3,8,22),dp=[Qo(Zt*.92,va*.86,6,8,1.5),Qo(Zt*1.05,va*.72,6,8,1),Qo(Zt*.8,va*.95,6,7,2.1)];let Nx=0;const Lx=()=>dp[Nx++%dp.length],Mf=new Eh(Rx,Ix,3,6);function Ef(t,e=40){const a=new $a(t,1,e,1);return a.rotateX(-Math.PI/2),a}const Dx=Ef(.84),Hx=Ef(.7);function fn(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const mn=(t,e,a={})=>new X({color:t,transparent:!0,opacity:e,depthWrite:!1,side:ye,...a}),pp=new X({color:"#FF6FA5"}),_x=new X({color:Sx}),zx=new X({color:Vh}),up=nh.map(t=>new X({color:t})),Px=fn(18,()=>mn(Vh,1)),$x=fn(18,()=>mn("#FF6FA5",1)),Bx=fn(30,()=>mn("#FFFFFF",1)),Ux=fn(24,()=>mn(tr,.7)),qx=fn(20,()=>mn(tr,.7,{blending:tt})),Wx=fn(24,()=>mn(tr,1)),Tf=new pe(0,1,0),fp=new pe,Vr=new ji,mp=new ji;function Gx(t,e,a,o,n){Vr.setFromAxisAngle(Tf,o);const s=Math.hypot(e,a);Math.abs(n)>1e-4&&s>1e-4?(fp.set(a/s,0,-e/s),mp.setFromAxisAngle(fp,n),t.quaternion.copy(mp).multiply(Vr)):t.quaternion.copy(Vr)}function jx(t){return t.range&&t.speed?t.range/t.speed:Oo.normal/1e3}function Yx(t,e,a){let o=t.userData.__ring;return o||(o={spin:Math.random()*To,rate:a*To/jx(e),shed:0,echo:0},t.userData.__ring=o),o}function oo(t,e,a,o,n,s,i,r,l,h={}){const c=h.hard?Wx():h.glow?qx():Ux();c.color.set(i),c.opacity=r;const d=new M(h.band?Hx:Dx,c);d.renderOrder=h.renderOrder??9,d.position.set(e,a,o),d.rotation.y=Math.random()*To,d.scale.set(n,1,n);const p=h.fadePow??1,u=h.hold??0;t.spawnTransient(d,l,m=>{const f=K.lerp(n,s,1-Math.pow(1-m,2.4));d.scale.set(f,1,f),c.opacity=m<u?r:r*(1-Math.pow((m-u)/(1-u),p))})}function Kr(t,e,a,o,n,s,i,r,l=1){const h=Bx();h.color.set(nh[Math.random()*nh.length|0]),h.opacity=1;const c=new M(Mf,h);c.renderOrder=9,c.position.set(e,a,o),c.scale.setScalar(l);const d=(Math.random()-.5)*26,p=(Math.random()-.5)*26,u=-9;t.spawnTransient(c,r,(m,f)=>{c.position.set(e+n*f,Math.max(Ii,a+s*f+.5*u*f*f),o+i*f),c.rotation.set(d*f,0,p*f),h.opacity=1-Math.pow(m,2.4)})}function Vx(t,e,a,o,n,s,i){const r=new he,l=Px();l.color.set(Vh),l.opacity=1;const h=Lx(),c=new M(h,l);c.scale.setScalar(1.28),r.add(c);const d=$x();d.color.set(a),d.opacity=1,r.add(new M(h,d)),r.renderOrder=9,r.position.copy(e),r.scale.setScalar(s);const p=e.x,u=e.y,m=e.z,f=Math.cos(o)*n,g=Math.sin(o)*n,w=1.5+Math.random()*1.2,b=-8.5,y=(Math.random()-.5)*20,x=(Math.random()-.5)*20;t.spawnTransient(r,i,(k,T)=>{r.position.set(p+f*T,Math.max(Ii,u+w*T+.5*b*T*T),m+g*T),r.rotation.set(y*T,0,x*T);const v=1-Math.pow(k,2.2);d.opacity=v,l.opacity=v})}function Kx(t){return K.clamp(.85+t*.035,.85,1.25)}function Xx(t){const e=new he,a=new M(Fx,zx);a.position.y=-Dt*.007,e.add(a),e.add(new M(Ox,_x)),pp.color.set(t);const o=new M(Cx,pp);o.position.y=va*.36,e.add(o);const n=Math.random()*To;for(let s=0;s<5;s++){const i=n+s/5*To+(Math.random()-.5)*.6,r=new M(Mf,up[Math.random()*up.length|0]);r.position.set(Math.cos(i)*Zt,va*1.05,Math.sin(i)*Zt),r.quaternion.setFromAxisAngle(Tf,-i),r.rotateX(Math.PI/2),r.scale.setScalar(1.05),e.add(r)}return e.userData.__isCandyRing=!0,e}const Zx={Candy:{projectile(t){const e=Xx(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Yx(e,t.weapon,2.4);if(o.spin+=o.rate*a,Gx(e,t.direction.x,t.direction.z,o.spin,.13+Math.sin(o.spin*.41)*.08),e.position.y+=Math.sin(o.spin*.62)*Dt*.011,o.echo-=a,o.echo<=0){o.echo=.075;const n=Zt+va;oo(t,t.position.x,t.position.y,t.position.z,n,n*1.45,Ax,.55,.2,{glow:!0,fadePow:1.4})}o.shed-=a,o.shed<=0&&(o.shed=.085+Math.random()*.05,Kr(t,t.position.x-t.direction.x*Zt,t.position.y,t.position.z-t.direction.z*Zt,-t.direction.x*.6+(Math.random()-.5)*.6,.15+Math.random()*.35,-t.direction.z*.6+(Math.random()-.5)*.6,.34,.85))},impact(t){const e=Kx(t.damage),{x:a,y:o,z:n}=t.position;oo(t,a,o,n,_s*.8*e,_s*e,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,fadePow:1.1,hold:.45}),oo(t,a,o,n,_s*.62*e,_s*.86*e,t.color,1,.19,{hard:!0,renderOrder:11,fadePow:1.4,hold:.3}),oo(t,a,Ii,n,zs*.2*e,zs*e,t.color,.95,.3,{hard:!0,renderOrder:7,fadePow:1.6,hold:.35}),oo(t,a,Ii-.01,n,zs*.16*e,zs*.86*e,tr,.9,.34,{hard:!0,band:!0,renderOrder:6,fadePow:1.4,hold:.3});for(let s=0;s<3;s++){const i=s/3*To+Math.random()*.9;Vx(t,t.position,t.color,i,(2.3+Math.random()*1.5)*e,(1.05+Math.random()*.5)*e,.36+Math.random()*.12)}for(let s=0;s<8;s++){const i=Math.random()*To,r=(2.2+Math.random()*1.8)*e;Kr(t,a,o,n,Math.cos(i)*r+t.direction.x*.9,2.5+Math.random()*1.6,Math.sin(i)*r+t.direction.z*.9,.4+Math.random()*.14,1.1+Math.random()*.6)}},cast(t){oo(t,t.position.x,t.position.y,t.position.z,Dt*.06,Dt*.2,"#FFF6FA",1,.16,{hard:!0,renderOrder:12,hold:.3}),oo(t,t.position.x,t.position.y,t.position.z,Dt*.03,Dt*.13,t.color,.95,.13,{hard:!0,band:!0,renderOrder:11,hold:.25});for(let e=0;e<4;e++)Kr(t,t.position.x,t.position.y,t.position.z,t.direction.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.7+Math.random()*.6,t.direction.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.7,.3,.85)}}},hs="#F2A73E",Kh="#B96F16",Sf="#E9C078",Xh="#4E2C1B",Af="#E63946",Rf="#8FCB1E",ar="#EFE2FA",If="#C9A9E4",Of="#CDB0EE",ue=ae,Ye=Math.PI*2,Oi=.29,an=ue*.085,or=ue*.105,Xr=ue*.032,ve=ue*.105,ma=ue*.07,ro=ue*.036,Ne=ue*.125,Jx=ue*.33;function en(t,e=7){return new Re(1,1,1,e,1,!0,-t/2,t)}const on=[en(1.1),en(1.7),en(2.3)];let Qx=0;const ev=()=>on[Qx++%on.length],sh=en(2.7,9),Cf=en(2.9,12),ih=new Gi(1,0),Ff=new Sh(1,0),rh=new xt(1,1,1),gp=new pt(1,14,10),tv=new pt(1,16,10,0,Math.PI*1.5),av=new Th(1,.062,5,20),wp=new cn(1,1,6),ov=en(2.2,7),nv=(()=>{const e=document.createElement("canvas");e.width=e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.85)"),o.addColorStop(.42,"rgba(255,255,255,0.44)"),o.addColorStop(.76,"rgba(255,255,255,0.12)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.colorSpace=is,n})();function Fo(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const gn=(t,e={})=>new X({color:t,transparent:!0,opacity:1,depthWrite:!1,side:ye,...e}),Zh=Fo(26,()=>gn(hs)),Nf=Fo(34,()=>gn(Sf)),Ps=Fo(30,()=>gn(Xh)),sv=Fo(12,()=>gn(If)),Lf=Fo(20,()=>gn("#FFF3D6")),iv=Fo(14,()=>new Lt({map:nv,color:Of,transparent:!0,opacity:.3,depthWrite:!1})),Sa=(t,e={})=>new X({color:t,side:ye,...e}),bp=Sa("#6B3E26"),rv=Sa(Xh),lv=Sa(hs),hv=Sa(Kh),yp=Sa(Rf),cv=Sa(Af),xp=Sa("#B497D6"),dv=Sa(If),Zr=Sa(ar);function pv(t){return t.range&&t.speed?t.range/t.speed:Oo.normal/1e3}function Jr(t){const e=t.weapon.comboParts;if(!e)return-1;const a=e.findIndex(o=>o.color===t.color&&o.damage===t.damage);return a>=0?a:e.findIndex(o=>o.color===t.color)}function Df(t){return K.clamp(.85+t*.035,.85,1.45)}function Hf(t,e,a){let o=t.userData.__tumble;return o||(o={t:Math.random()*Ye,rate:a*Ye/pv(e),shed:0},t.userData.__tumble=o),o}function Ko(t,e,a,o,n,s,i,r,l,h,c,d,p,u,m=-9){a.color.set(o),a.opacity=1;const f=new M(e,a);f.renderOrder=9,f.position.set(n,s,i),f.scale.set(c,d,p),f.rotation.set(Math.random()*Ye,Math.random()*Ye,Math.random()*Ye);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,b=(Math.random()-.5)*20,y=f.rotation.x,x=f.rotation.y,k=f.rotation.z;t.spawnTransient(f,u,(T,v)=>{const O=s+l*v+.5*m*v*v,D=O<=Oi;f.position.set(n+r*v,D?Oi:O,i+h*v),D||f.rotation.set(y+g*v,x+w*v,k+b*v),a.opacity=1-Math.pow(T,2.4)})}function _f(t,e,a,o,n,s,i,r,l){Ko(t,ev(),Zh(),Math.random()<.35?Kh:hs,e,a,o,n,s,i,an*r,or*r,an*r,l)}function nr(t,e,a,o,n,s,i,r,l){Ko(t,Ff,Nf(),Sf,e,a,o,n,s,i,Xr*r,Xr*r,Xr*r,l)}function sr(t,e,a,o,n,s,i,r,l,h){if(e==="lettuce")Ko(t,sh,Ps(),Rf,a,o,n,s,i,r,ma*l,ma*.42*l,ma*l,h,-6.5);else if(e==="tomato")Ko(t,rh,Ps(),Af,a,o,n,s,i,r,ro*l,ro*l,ro*l,h);else if(e==="onion")Ko(t,rh,Ps(),ar,a,o,n,s,i,r,ro*1.3*l,ro*.4*l,ro*1.3*l,h);else{const c=ve*(.45+Math.random()*.3)*l;Ko(t,ih,Ps(),Math.random()<.4?Xh:"#6B3E26",a,o,n,s,i,r,c,c*.8,c*1.15,h)}}function Jh(t,e,a,o,n){const s=Lf();s.color.set("#FFF3D6"),s.opacity=1;const i=new M(Ff,s);i.renderOrder=12,i.position.set(e,a,o),i.rotation.set(Math.random()*Ye,Math.random()*Ye,0),i.scale.setScalar(n*.6),t.spawnTransient(i,.12,r=>{i.scale.setScalar(n*K.lerp(.6,1.3,r)),s.opacity=r<.4?1:1-(r-.4)/.6})}function zf(t,e){const{x:a,y:o,z:n}=t.position,s=t.direction,i=Math.random()*Ye;for(let r=0;r<5;r++){const l=i+r/5*Ye,h=Lf();h.color.set(r%2===0?"#FFF3D6":"#FFD27A"),h.opacity=1;const c=new M(on[r%on.length],h);c.renderOrder=12;const d=Math.cos(l),p=Math.sin(l),u=ue*.11*e,m=ue*.44*e,f=Math.atan2(d,p);t.spawnTransient(c,.13,g=>{const w=1-Math.pow(1-g,2.2),b=K.lerp(u,m,w);c.position.set(a+d*b+s.x*b*.3,o,n+p*b+s.z*b*.3);const y=(1-g*.45)*e;c.rotation.set(0,f,0),c.scale.set(an*1.15*y,or*1*y,an*1.15*y),h.opacity=g<.45?1:1-(g-.45)/.55})}}function vp(t,e,a,o,n,s,i,r=.3){const l=new ga(iv()),h=l.material;h.color.set(Of),h.opacity=0,l.renderOrder=10;const c=(Math.random()-.5)*n*1.4,d=(Math.random()-.5)*n*1.4;l.position.set(e,a,o),l.scale.set(n,n,1),t.spawnTransient(l,i,p=>{const u=1-Math.pow(1-p,2);l.position.set(e+c*u,a+s*u,o+d*u);const m=n*(1+u*.9);l.scale.set(m,m,1),h.opacity=r*Math.sin(Math.min(1,p*1.25)*Math.PI)})}function uv(t,e,a,o){const{x:n,y:s,z:i}=t.position,r=t.direction;let l=-r.z,h=r.x;Math.hypot(l,h)<1e-4&&(l=1,h=0);for(const c of[-1,1]){const d=Zh();d.color.set(c<0?hs:Kh),d.opacity=1;const p=new M(Cf,d);p.renderOrder=9;const u=n+l*c*ue*.24*e,m=i+h*c*ue*.24*e;p.position.set(u,s,m);const f=an*2.1*e;p.scale.set(f,or*1.9*e,f);const g=l*c*a+r.x*a*.35,w=h*c*a+r.z*a*.35,b=1.5+Math.random()*.9,y=c*(7+Math.random()*5),x=(Math.random()-.5)*6;t.spawnTransient(p,o,(k,T)=>{const v=s+b*T-4.6*T*T;p.position.set(u+g*T,Math.max(Oi,v),m+w*T),p.rotation.set(x*T,y*T,c*.5),d.opacity=1-Math.pow(k,2.2)})}}function Qr(t){const e=new he;bp.color.set(t);const a=new M(ih,bp);a.scale.set(ve,ve*.85,ve*1.18),a.rotation.set(.6,.4,.2),e.add(a);const o=new M(ih,rv);o.scale.setScalar(ve*.62),o.position.set(ve*.55,-ve*.4,-ve*.3),o.rotation.set(1.1,.3,.8),e.add(o);const n=new M(sh,yp);n.scale.set(ma*1.15,ma*.4,ma*1.15),n.position.set(-ve*.45,ve*.55,ve*.2),n.rotation.set(.9,.7,-.5),e.add(n);for(const[l,h,c]of[[.8,.3,.5],[-.55,-.25,-.8]]){const d=new M(rh,cv);d.scale.setScalar(ro*1.45),d.position.set(ve*l,ve*h,ve*c),d.rotation.set(Math.random(),Math.random(),Math.random()),e.add(d)}const s=new M(sh,yp);s.scale.set(ma*.8,ma*.3,ma*.8),s.position.set(ve*.3,-ve*.15,-ve*.7),s.rotation.set(-.6,1.9,.8),e.add(s);const i=new M(on[2],lv);i.scale.set(ve*1.02,ve*1.25,ve*1.02),i.position.set(-ve*.25,-ve*.72,-ve*.1),i.rotation.set(1.5,.4,.15),e.add(i);const r=new M(on[0],hv);return r.scale.set(ve*.7,ve*.85,ve*.7),r.position.set(ve*.75,-ve*.35,ve*.45),r.rotation.set(.9,2.2,-.6),e.add(r),e}function el(t){const e=new he;xp.color.set(t);const a=new M(gp,xp);a.scale.set(Ne,Ne*.92,Ne),e.add(a);const o=new he;for(let i=0;i<3;i++){const r=new M(av,Zr);r.scale.set(Ne*1.01,Ne*.93,Ne*1.01),r.rotation.y=i/3*Math.PI,o.add(r)}e.add(o);const n=new M(wp,Zr);n.scale.set(Ne*.42,Ne*.62,Ne*.42),n.position.y=Ne*1.06,n.rotation.z=.18,e.add(n);for(let i=0;i<3;i++){const r=i/3*Ye+.4,l=new M(wp,dv);l.scale.set(Ne*.09,Ne*.34,Ne*.09),l.position.set(Math.cos(r)*Ne*.2,-Ne*1,Math.sin(r)*Ne*.2),l.rotation.set(Math.PI+(Math.random()-.5)*.6,0,(Math.random()-.5)*.6),e.add(l)}const s=new M(gp,Zr);return s.scale.set(Ne*.42,Ne*.2,Ne*.42),s.position.set(Ne*.42,Ne*.62,-Ne*.3),e.add(s),e.userData.__bands=o,e}function kp(t,e){const a=t.object;if(!a)return;const o=t.dt??0,n=Hf(a,t.weapon,e);if(n.t+=n.rate*o,a.rotation.x=n.t,a.rotation.z=Math.sin(n.t*.63)*.9,n.shed-=o,n.shed<=0){n.shed=.06+Math.random()*.04;const s=Math.random(),i=s<.45?"meat":s<.72?"tomato":"lettuce",r=t.position.x-t.direction.x*ve,l=t.position.z-t.direction.z*ve;sr(t,i,r,t.position.y-ve*.4,l,-t.direction.x*.5+(Math.random()-.5)*.7,-.2-Math.random()*.4,-t.direction.z*.5+(Math.random()-.5)*.7,.85,.34),Math.random()<.55&&nr(t,r,t.position.y,l,-t.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-t.direction.z*.7+(Math.random()-.5)*.6,.9,.3)}}function Mp(t,e){const a=Df(t.damage)*e,{x:o,y:n,z:s}=t.position,i=t.direction;Jh(t,o,n,s,ue*.24*a),zf(t,a),uv(t,a*.95,2.4*a,.4);const r=ue*.26*a,l=.8;for(let h=0;h<6;h++){const c=h/6*Ye+Math.random()*.7,d=(2.2+Math.random()*1.5)*a,p=Math.random();sr(t,p<.5?"meat":p<.78?"tomato":"lettuce",o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.9+Math.random()*1.3,Math.sin(c)*d+i.z*l,a,.42+Math.random()*.14)}for(let h=0;h<4;h++){const c=h/4*Ye+Math.random()*.9,d=(2.4+Math.random()*1.6)*a;_f(t,o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.7+Math.random()*1.5,Math.sin(c)*d+i.z*l,(.85+Math.random()*.5)*a,.42+Math.random()*.12)}for(let h=0;h<9;h++){const c=Math.random()*Ye,d=(2.6+Math.random()*2.1)*a;nr(t,o+Math.cos(c)*r*.8,n,s+Math.sin(c)*r*.8,Math.cos(c)*d+i.x*l,1.5+Math.random()*1.8,Math.sin(c)*d+i.z*l,(.85+Math.random()*.7)*a,.36+Math.random()*.14)}}function Ep(t,e){const a=t.object;if(!a)return;const o=t.dt??0,n=Hf(a,t.weapon,e);n.t+=n.rate*o,a.rotation.x=n.t*.8,a.rotation.z=n.t*.45;const s=a.userData.__bands;if(s&&(s.rotation.y+=o*1.9),n.shed-=o,n.shed<=0){n.shed=.1+Math.random()*.07;const i=Nf();i.color.set(ar),i.opacity=1;const r=new M(ov,i);r.renderOrder=9;const l=t.position.x-t.direction.x*Ne,h=t.position.z-t.direction.z*Ne;r.position.set(l,t.position.y,h);const c=Ne*(.3+Math.random()*.2);r.scale.set(c,c*.5,c);const d=-t.direction.x*.5+(Math.random()-.5)*.5,p=-t.direction.z*.5+(Math.random()-.5)*.5,u=5+Math.random()*5;t.spawnTransient(r,.42,(m,f)=>{r.position.set(l+d*f,t.position.y-.7*f*f-.25*f,h+p*f),r.rotation.set(Math.sin(f*u)*1.4,f*3,Math.cos(f*u*.7)*1.1),i.opacity=1-Math.pow(m,2)})}}function Tp(t,e){const a=Df(t.damage)*e,{x:o,y:n,z:s}=t.position,i=t.direction;Jh(t,o,n,s,ue*.21*a),zf(t,a*.88);for(let h=0;h<3;h++){const c=sv();c.color.set(h===0||h===1?t.color:ar),c.opacity=.66;const d=new M(tv,c);d.renderOrder=10,d.position.set(o,n,s),d.rotation.set((Math.random()-.5)*.5,Math.random()*Ye,(Math.random()-.5)*.5);const p=Ne*(.8+h*.12),u=Jx*a*(.78+h*.22),m=(Math.random()-.5)*5;t.spawnTransient(d,.3+h*.05,f=>{const g=1-Math.pow(1-f,2.6),w=K.lerp(p,u,g);d.scale.set(w,w*(.9-g*.45),w),d.position.y=n+g*ue*.06,d.rotation.y+=m*.02,c.opacity=.66*(1-Math.pow(f,1.4))})}vp(t,o,n*.6,s,ue*.34*a,ue*.3,.65,.4);for(let h=0;h<3;h++){const c=h/3*Ye+Math.random();vp(t,o+Math.cos(c)*ue*.24*a,Oi+ue*.12,s+Math.sin(c)*ue*.24*a,ue*.28*a,ue*.26,.6,.34)}const r=ue*.24*a,l=.7;for(let h=0;h<5;h++){const c=h/5*Ye+Math.random()*.8,d=(2.3+Math.random()*1.4)*a;sr(t,"onion",o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.9+Math.random()*1.2,Math.sin(c)*d+i.z*l,a,.4+Math.random()*.12)}for(let h=0;h<3;h++){const c=Math.random()*Ye,d=(2.3+Math.random()*1.5)*a;_f(t,o+Math.cos(c)*r,n,s+Math.sin(c)*r,Math.cos(c)*d+i.x*l,1.6+Math.random()*1.4,Math.sin(c)*d+i.z*l,(.75+Math.random()*.45)*a,.4)}for(let h=0;h<7;h++){const c=Math.random()*Ye,d=(2.5+Math.random()*1.9)*a;nr(t,o+Math.cos(c)*r*.8,n,s+Math.sin(c)*r*.8,Math.cos(c)*d+i.x*l,1.4+Math.random()*1.6,Math.sin(c)*d+i.z*l,(.8+Math.random()*.6)*a,.34+Math.random()*.12)}}function tl(t,e,a){const o=t.direction,{x:n,y:s,z:i}=t.position,r=Zh();r.color.set(hs),r.opacity=.9;const l=new M(Cf,r);l.renderOrder=11;const h=Math.atan2(o.x,o.z),c=an*.9*a;t.spawnTransient(l,.18,d=>{const p=c*(1+d*1.5);l.position.set(n+o.x*d*ue*.14,s-d*ue*.04,i+o.z*d*ue*.14),l.scale.set(p,or*1.1*a*(1-d*.35),p),l.rotation.set(0,h+d*1.1,0),r.opacity=.9*(1-d*d)}),Jh(t,n+o.x*ue*.06,s,i+o.z*ue*.06,ue*.1*a);for(let d=0;d<7;d++)nr(t,n,s,i,o.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.6+Math.random()*.7,o.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(const d of e)sr(t,d,n,s,i,o.x*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.8+Math.random()*.5,o.z*(1.3+Math.random()*.7)+(Math.random()-.5)*.6,.9*a,.3)}const fv=ue*.83/(ve*2.8),mv=new pt(ue*.06,7,6),gv=Fo(8,()=>gn("#FFF3D6",{blending:tt,opacity:0}));function Sp(t,e){let a=0;t.traverse(o=>{o.isMesh&&!o.name&&(o.name=`${e}Part${a++}`)})}const wv={Filling:{projectile(t){const e=Qr(t.color);return e.position.copy(t.position),e},trail(t){kp(t,1.7)},impact(t){Mp(t,1)},cast(t){tl(t,["meat","tomato"],1)}},Onion:{projectile(t){const e=el(t.color);return e.position.copy(t.position),e},trail(t){Ep(t,1.2)},impact(t){Tp(t,1)},cast(t){tl(t,["onion","onion"],1)}},Double:{projectile(t){const e=Jr(t)===1?el(t.color):Qr(t.color);return e.scale.setScalar(1.12),e.position.copy(t.position),e},trail(t){Jr(t)===1?Ep(t,1.3):kp(t,1.9)},impact(t){Jr(t)===1?Tp(t,1.12):Mp(t,1.12)},cast(t){tl(t,["meat","onion","tomato"],1.25)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleTacoRoot";const n=t.position.clone();n.y-=ue*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=t.weapon.comboParts??[],i=Qr(s[0]?.color??t.color);i.name="teleTacoFilling";const r=el(s[1]?.color??"#B497D6");r.name="teleTacoOnion",Sp(i,"teleTacoFilling"),Sp(r,"teleTacoOnion"),o.add(i,r);const l=6,h=[];for(let f=0;f<l;f++){const g=new e.Mesh(mv,gv());g.name=`teleTacoSpark${f}`,h.push(g),o.add(g)}const c=(f,g,w)=>{const b=e.MathUtils.clamp((f-g)/(w-g),0,1);return b*b*(3-2*b)},d=ue*.48,p=ue*.72,u=[e.MathUtils.degToRad(s[0]?.angle??-10),e.MathUtils.degToRad(s[1]?.angle??10)],m=(f,g)=>{const w=e.MathUtils.clamp(g/a,0,1),b=c(w,0,.42),y=c(w,.3,.82),x=c(w,.82,1);for(let k=0;k<2;k++){const T=k===0?i:r,v=k===0?-1:1,O=.76+.24*b,D=-ue*.62*y,_=d*(.55+.65*b+.35*y),E=u[k],A=ue*.85*x,C=v*_+Math.sin(E)*A,R=D+Math.cos(E)*A;T.position.set(C,p+ue*(.2*y+.1*x),R),T.scale.setScalar(fv*O*(1+.18*x)),T.rotation.set(w*5.5*(k===0?1:-1),w*3.1,w*2.2*v)}for(let k=0;k<l;k++){const T=h[k],v=k/l*Ye+w*6.5,O=d*(.25+.85*b);T.position.set(Math.cos(v)*O,p+Math.sin(v*1.7)*ue*.16+ue*.18*y,Math.sin(v)*O*.55-ue*.3*y);const D=.85+1.15*w;T.scale.setScalar(D),T.material.opacity=.45+.45*w}};m(0,0),t.spawnTransient(o,a+.06,m)}}},wn="#F5EAD6",bv="#E4CFA0",Pf="#B9843C",$f="#6B3E12",Bf="#452D18",ir="#E0562B",Uf="#D5EAF4",Qh="#FFFFFF",cs="#FFF6E4",qf="#5B3324",ec="#FFC93C",tc="#E63946",ac="#7DA33F",yv="#FFFDF7",se=ae,ze=Math.PI*2,Qn=.29,$e=se*.115,gt=se*.3,xv=se*.085,Wf=se*.075,oc=se*.09,nn=se*.032,al=se*.058,vv=se*.1,sn=se*.022,kv=se*.4,Mv=se*.97,Ev=se*.7,Gf=se*.11,lh=new xt(1,1,1),Tv=new Re(.5,.5,1,8,1,!0,-1.5,3),jf=new Gi(.5,0),Yf=new Sh(.62,0),ds=new Eh(1,1.4,3,6);ds.scale(.5,1/3.4,.5);const Vf=new pt(.5,8,6),es=new xt(1,1,1),Kf=new cn(.5,1,4),ts=new xt(1,1,1),Ap=new Th(1,.085,5,18),Rp=new Re(1,1,1,16,1),Sv=new Re(.55,1,1,14,1),Av=new Re(1,1,1,12,1,!0,-1.55,3.1),Rv=new Co(1,18);function Aa(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Ra=(t,e={})=>new X({color:t,transparent:!0,opacity:1,depthWrite:!1,side:ye,...e}),Iv=Aa(30,()=>Ra(wn)),Uo=Aa(34,()=>Ra(cs)),Ov=Aa(6,()=>Ra(ir)),Cv=Aa(10,()=>Ra(wn)),Fv=Aa(10,()=>Ra($f)),Xf=Aa(24,()=>Ra(Qh)),at=(t,e={})=>new X({color:t,side:ye,...e}),Ip=at(wn),Op=at(bv),$s=at(Pf),Nv=at(Uf),Lv=at(ir),Cp=at(cs),Dv=at(qf);at(ec);at(tc);at(ac);const Hv=[at(ac),at(tc),at(ec),at(cs)],_v=[at("#5C7F2A"),at("#B02733"),at("#E0A317"),at(yv)],Bs=new pe,Us=new pe,ol=new pe,Fp=new v0;function zv(t,e,a,o,n,s,i){Bs.set(e,a,o).normalize(),Us.set(n,s,i).normalize(),ol.crossVectors(Bs,Us).normalize(),Us.crossVectors(ol,Bs).normalize(),Fp.makeBasis(Bs,Us,ol),t.quaternion.setFromRotationMatrix(Fp)}function Pv(t){return t.range&&t.speed?t.range/t.speed:Oo.normal/1e3}function Np(t){const e=t.weapon.pelletColors;if(!e||e.length===0)return 0;const a=e.indexOf(t.color);return a>=0?a%4:0}function hh(t){return K.clamp(.85+t*.035,.85,1.35)}function Zf(t,e,a){let o=t.userData.__spin;return o||(o={t:Math.random()*ze,rate:a*ze/Pv(e),shed:0,age:0},t.userData.__spin=o),o}function Gt(t,e,a,o,n,s,i,r,l,h,c,d,p,u,m=-9){a.color.set(o),a.opacity=1;const f=new M(e,a);f.renderOrder=9,f.position.set(n,s,i),f.scale.set(c,d,p),f.rotation.set(Math.random()*ze,Math.random()*ze,Math.random()*ze);const g=(Math.random()-.5)*18,w=(Math.random()-.5)*18,b=(Math.random()-.5)*18,y=f.rotation.x,x=f.rotation.y,k=f.rotation.z;t.spawnTransient(f,u,(T,v)=>{const O=s+l*v+.5*m*v*v,D=O<=Qn;f.position.set(n+r*v,D?Qn:O,i+h*v),D||f.rotation.set(y+g*v,x+w*v,k+b*v),a.opacity=1-Math.pow(T,2.4)})}function tn(t,e,a,o,n,s,i,r,l){const h=xv*r*(.85+Math.random()*.55),c=Math.random();Gt(t,Tv,Iv(),c<.24?Bf:c<.48?Pf:wn,e,a,o,n,s,i,h,h*.85,h,l,-7.5)}function as(t,e,a,o,n,s,i,r,l){const h=Wf*r*(.7+Math.random()*.6);Gt(t,Math.random()<.5?jf:Yf,Xf(),Math.random()<.45?Qh:Uf,e,a,o,n,s,i,h*1.3,h*.34,h,l,-8.5)}function os(t,e,a,o,n,s,i,r,l,h){if(e==="rice")Gt(t,ds,Uo(),cs,a,o,n,s,i,r,nn*l,oc*l,nn*l,h);else if(e==="bean"){const c=al*l;Gt(t,Vf,Uo(),qf,a,o,n,s,i,r,c*1.35,c*.85,c*.85,h)}else if(e==="cheese")Gt(t,es,Uo(),ec,a,o,n,s,i,r,vv*l,sn*l,sn*l,h,-6.5);else if(e==="salsa"){const c=al*.85*l;Gt(t,ts,Uo(),tc,a,o,n,s,i,r,c,c,c,h)}else{const c=al*l;Gt(t,ts,Uo(),ac,a,o,n,s,i,r,c*1.2,c*.55,c*1.2,h)}}const $v=se*.075,qs=Aa(28,()=>Ra(cs)),Lp=7;function Bv(t,e,a,o,n,s,i,r,l,h){const c=t.color,d=$v*l;if(e===0)Gt(t,Kf,qs(),c,a,o,n,s,i,r,d*.5,d*2.6,d*.22,h,-7.2);else if(e===1){const p=d*(1+Math.random()*.35);Gt(t,ts,qs(),c,a,o,n,s,i,r,p,p,p,h)}else e===2?Gt(t,es,qs(),c,a,o,n,s,i,r,d*2.5,sn*2.2,sn*2.2,h,-6.5):Gt(t,ds,qs(),c,a,o,n,s,i,r,nn*1.15*l,oc*1.15*l,nn*1.15*l,h,-7.5)}function ch(t,e){const{x:a,y:o,z:n}=t.position,s=t.direction,i=Math.random()*ze;for(let r=0;r<8;r++){const l=i+r/8*ze,h=Xf();h.color.set(r%2===0?Qh:Bf),h.opacity=1;const c=new M(r%2===0?jf:Yf,h);c.renderOrder=12;const d=Math.cos(l),p=Math.sin(l),u=se*.26*e,m=se*.44*e,f=(Math.random()-.5)*14;t.spawnTransient(c,.14,g=>{const w=1-Math.pow(1-g,2.2),b=K.lerp(u,m,w);c.position.set(a+d*b+s.x*b*.28,o+w*se*.05,n+p*b+s.z*b*.28);const y=Wf*e*(1.7-g*.5);c.scale.set(y*1.6,y*.34,y),c.rotation.set(f*g,Math.atan2(d,p),f*g*.6),h.opacity=g<.45?1:1-(g-.45)/.55})}}const Pa=16,Jf=2.35,Uv=.42;function nc(t){const e=new he,a=Cv(),o=Fv();a.color.set(wn),a.opacity=1,o.color.set($f),o.opacity=1;const n=[];for(let s=0;s<t;s++){const i=new M(lh,o);i.renderOrder=10;const r=new M(lh,a);r.renderOrder=11,i.scale.setScalar(0),r.scale.setScalar(0),e.add(i,r),n.push({face:r,back:i})}return{group:e,slats:n,faceMat:a,backMat:o}}function qv(t,e,a,o,n,s,i,r){const{group:l,slats:h,faceMat:c,backMat:d}=nc(Pa),p=se*.06*i,u=se*.15*i,m=Ev*i,f=Gf*i,g=(x,k,T)=>{const v=x*Jf*ze*s,O=x*Uv*ze*s,D=v+(O-v)*k,_=p+x*(u-p),E=p+x*(m-p),A=_+(E-_)*k;T.x=e+Math.cos(n+D)*A,T.z=o+Math.sin(n+D)*A},w={x:0,z:0},b={x:0,z:0},y=x=>{const k=1-Math.pow(1-Math.min(1,x/.62),2.4),T=K.lerp(a,Qn,1-Math.pow(1-Math.min(1,x/.72),1.8));for(let O=0;O<Pa;O++){const D=O/Pa,_=(O+1)/Pa;g(D,k,w),g(_,k,b);const E=b.x-w.x,A=b.z-w.z,C=Math.hypot(E,A)*1.14,R=Math.atan2(E,A),I=(w.x+b.x)*.5,L=(w.z+b.z)*.5,B=f*(1-D*.35),{face:H,back:j}=h[O];H.rotation.set(0,R,0),j.rotation.set(0,R,0),H.position.set(I,T+.022,L),j.position.set(I,T,L),H.scale.set(B,se*.008,C),j.scale.set(B*1.8,se*.006,C*1.12)}const v=x<.68?1:1-(x-.68)/.32;c.opacity=v,d.opacity=v*.95};y(0),t.spawnTransient(l,r,y)}function Wv(t,e,a){const{x:o,z:n}=t.position,s=22,i=2.2,r=kv*e,{group:l,slats:h,faceMat:c,backMat:d}=nc(s),p=Math.random()*ze,u=Qn+se*.02,m=(Mv*e-u)/(s-1),f=i*ze/(s-1),g=w=>{const b=Math.min(1,w/.52),y=w<.62?1:1-(w-.62)/.38*.16;for(let k=0;k<s;k++){const T=k/s*.9,v=b>T,{face:O,back:D}=h[k];if(O.visible=v,D.visible=v,!v)continue;const _=p+k*f,E=r*y,A=o+Math.cos(_)*E,C=u+k*m,R=n+Math.sin(_)*E;zv(O,-Math.sin(_)*E*f,m,Math.cos(_)*E*f,Math.cos(_),0,Math.sin(_)),D.quaternion.copy(O.quaternion);const I=E*f*1.02,L=se*.1*e;O.position.set(A,C,R),D.position.set(A-Math.cos(_)*.02,C,R-Math.sin(_)*.02),O.scale.set(I,se*.009,L),D.scale.set(I*1.02,se*.007,L*1.75)}const x=w<.62?1:1-(w-.62)/.38;c.opacity=.88*x,d.opacity=.92*x};g(0),t.spawnTransient(l,a,g)}function Qf(t,e,a,o,n,s,i,r,l){const{group:h,slats:c,faceMat:d,backMat:p}=nc(Pa),u=se*.03*r,m=se*.13*r,f=Math.random()<.5?1:-1,g=f*(9+Math.random()*5),w={x:0,z:0},b={x:0,z:0},y=(k,T,v)=>{const O=T+k*Jf*ze*f,D=u+k*(m-u);v.x=Math.cos(O)*D,v.z=Math.sin(O)*D},x=(k,T)=>{const v=g*T,O=e+n*T,D=Math.max(Qn,a+s*T-4*T*T),_=o+i*T;for(let A=0;A<Pa;A++){y(A/Pa,v,w),y((A+1)/Pa,v,b);const C=b.x-w.x,R=b.z-w.z,I=Math.hypot(C,R)*1.16,L=Math.atan2(C,R),{face:B,back:H}=c[A];B.rotation.set(0,L,0),H.rotation.set(0,L,0),B.position.set(O+(w.x+b.x)*.5,D+.018,_+(w.z+b.z)*.5),H.position.set(O+(w.x+b.x)*.5,D,_+(w.z+b.z)*.5);const j=Gf*r*.72;B.scale.set(j,se*.007,I),H.scale.set(j*1.8,se*.005,I*1.14)}const E=1-Math.pow(k,2);d.opacity=E,p.opacity=E*.95};x(0,0),t.spawnTransient(h,l,x)}function Gv(t){const e=new he,a=new he;e.add(a),Ip.color.set(t);const o=new M(Rp,Ip);o.rotation.x=Math.PI/2,o.scale.set($e,gt*.8,$e),a.add(o);const n=new M(Sv,Op);n.rotation.x=-Math.PI/2,n.scale.set($e,gt*.12,$e),n.position.z=-gt*.46,a.add(n);const s=new M(Av,$s);s.rotation.x=Math.PI/2,s.scale.set($e*1.02,gt*.8,$e*1.02),a.add(s);const i=new M(es,$s);i.position.set($e*.92,0,0),i.rotation.set(.42,0,0),i.scale.set($e*.14,$e*.16,gt*.82),a.add(i);const r=new M(Rp,Nv);r.rotation.x=Math.PI/2,r.scale.set($e*1.07,gt*.26,$e*1.07),r.position.z=-gt*.2,a.add(r);for(const c of[-gt*.1,gt*.04]){const d=new M(Ap,Lv);d.scale.set($e*1.08,$e*1.08,$e*.85),d.position.z=c,a.add(d)}const l=new M(Rv,Op);l.scale.setScalar($e*.99),l.position.z=gt*.404,a.add(l);const h=[$s,Cp,$s];for(let c=0;c<3;c++){const d=new M(Ap,h[c]),p=$e*(.78-c*.25);d.scale.set(p,p,$e*.2),d.position.z=gt*.412,a.add(d)}for(let c=0;c<4;c++){const d=c/4*ze+.5,p=new M(c%2===0?ds:Vf,c%2===0?Cp:Dv),u=$e*.28;p.scale.set(u,c%2===0?u*2:u,u),p.position.set(Math.cos(d)*$e*.6,Math.sin(d)*$e*.6,gt*.42),p.rotation.set(Math.random(),Math.random(),Math.random()),a.add(p)}return e.userData.__spinner=a,e}function Dp(t){const e=new he,a=Hv[t],o=_v[t],n=se*.075;if(t===0){for(let i=0;i<3;i++){const r=new M(Kf,i===1?o:a);r.scale.set(n*.5,n*2.6,n*.22),r.position.set((i-1)*n*.5,n*.4,0),r.rotation.set(.2,0,(i-1)*.55),e.add(r)}const s=new M(es,o);s.scale.set(n*.16,n*1.2,n*.16),s.position.y=-n*.7,e.add(s)}else if(t===1)for(let s=0;s<3;s++){const i=s/3*ze,r=new M(ts,s===2?o:a),l=n*(1+Math.random()*.35);r.scale.setScalar(l),r.position.set(Math.cos(i)*n*.75,Math.sin(i)*n*.5,Math.sin(i*1.7)*n*.55),r.rotation.set(Math.random(),Math.random(),Math.random()),e.add(r)}else if(t===2)for(let s=0;s<4;s++){const i=new M(es,s===3?o:a);i.scale.set(n*2.5,sn*1.2,sn*1.2),i.position.set(0,(s-1.5)*n*.28,(s-1.5)*n*.2),i.rotation.set(0,(s-1.5)*.28,(s-1.5)*.14),e.add(i)}else for(let s=0;s<5;s++){const i=s/5*ze+.3,r=new M(ds,s===4?o:a);r.scale.set(nn*1.15,oc*1.15,nn*1.15),r.position.set(Math.cos(i)*n*.55,Math.sin(i*1.3)*n*.4,Math.sin(i)*n*.55),r.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),e.add(r)}return e}function jv(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Zf(e,t.weapon,9);o.t+=o.rate*a;const n=e.userData.__spinner;if(n&&(n.rotation.z=o.t),e.rotation.x=Math.sin(o.t*.35)*.1,o.shed-=a,o.shed<=0){o.shed=.055+Math.random()*.04;const s=t.position.x-t.direction.x*gt*.5,i=t.position.z-t.direction.z*gt*.5,r=Math.random();r<.42?os(t,"rice",s,t.position.y-$e*.3,i,-t.direction.x*.6+(Math.random()-.5)*.7,-.15-Math.random()*.4,-t.direction.z*.6+(Math.random()-.5)*.7,.9,.32):r<.72?tn(t,s,t.position.y,i,-t.direction.x*.8+(Math.random()-.5)*.6,.15+Math.random()*.3,-t.direction.z*.8+(Math.random()-.5)*.6,.75,.3):as(t,s,t.position.y,i,-t.direction.x*.9+(Math.random()-.5)*.5,.2+Math.random()*.35,-t.direction.z*.9+(Math.random()-.5)*.5,.65,.26)}}function Yv(t){const e=hh(t.damage),{x:a,y:o,z:n}=t.position,s=t.direction;ch(t,e);const i=se*.16*e;let r=-s.z,l=s.x;Math.hypot(r,l)<1e-4&&(r=1,l=0);const h=Math.atan2(s.z,s.x);for(const p of[-1,1])qv(t,a+s.x*i+r*p*i*.7,o,n+s.z*i+l*p*i*.7,h+p*1.05,p,e*.92,.78);const c=se*.26*e,d=.8;for(let p=0;p<9;p++){const u=p/9*ze+Math.random()*.6,m=(2.3+Math.random()*1.5)*e,f=Math.random();os(t,f<.32?"rice":f<.66?"bean":f<.85?"cheese":"salsa",a+Math.cos(u)*c,o,n+Math.sin(u)*c,Math.cos(u)*m+s.x*d,1.9+Math.random()*1.3,Math.sin(u)*m+s.z*d,e,.42+Math.random()*.14)}for(let p=0;p<6;p++){const u=p/6*ze+Math.random()*.9,m=(2.4+Math.random()*1.6)*e;tn(t,a+Math.cos(u)*c,o,n+Math.sin(u)*c,Math.cos(u)*m+s.x*d,1.8+Math.random()*1.4,Math.sin(u)*m+s.z*d,(.9+Math.random()*.5)*e,.44+Math.random()*.12)}for(let p=0;p<4;p++){const u=Math.random()*ze,m=(2.7+Math.random()*1.8)*e;as(t,a+Math.cos(u)*c*.9,o,n+Math.sin(u)*c*.9,Math.cos(u)*m+s.x*d,1.6+Math.random()*1.6,Math.sin(u)*m+s.z*d,(.8+Math.random()*.6)*e,.36+Math.random()*.12)}}function Vv(t,e){const a=t.direction,{x:o,y:n,z:s}=t.position;Qf(t,o,n,s,a.x*2.2+(Math.random()-.5)*.4,.7,a.z*2.2+(Math.random()-.5)*.4,e,.26);for(let i=0;i<5;i++)os(t,i%2===0?"rice":"bean",o,n,s,a.x*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.6,a.z*(1.5+Math.random()*1)+(Math.random()-.5)*.9,.9*e,.3);for(let i=0;i<4;i++)as(t,o,n,s,a.x*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8+Math.random()*.6,a.z*(1.7+Math.random()*1.2)+(Math.random()-.5)*.8,.8*e,.24);for(let i=0;i<3;i++)tn(t,o,n,s,a.x*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.6+Math.random()*.5,a.z*(1.3+Math.random()*.9)+(Math.random()-.5)*.7,.8*e,.26)}const Kv=3.6,Hp=new pt(1,14,10),Xv=Aa(4,()=>Ra(ir,{opacity:.85})),Zv=Aa(4,()=>Ra(wn,{opacity:.7}));function Jv(t,e){let a=0;t.traverse(o=>{o.isMesh&&!o.name&&(o.name=`${e}Part${a++}`)})}const Qv={Disc:{projectile(t){const e=Gv(t.color);return e.position.copy(t.position),e},trail(t){jv(t)},impact(t){Yv(t)},cast(t){Vv(t,1)}},Roll:{impact(t){const e=hh(t.damage);Wv(t,1,.62),ch(t,e*.85);const{x:a,y:o,z:n}=t.position,s=t.direction,i=se*.24*e;for(let r=0;r<5;r++){const l=r/5*ze+Math.random()*.8,h=(2+Math.random()*1.3)*e;os(t,r%2===0?"rice":"guac",a+Math.cos(l)*i,o,n+Math.sin(l)*i,Math.cos(l)*h+s.x*.6,1.7+Math.random()*1.1,Math.sin(l)*h+s.z*.6,e,.38+Math.random()*.12)}for(let r=0;r<3;r++){const l=Math.random()*ze,h=(2.2+Math.random()*1.4)*e;tn(t,a+Math.cos(l)*i,o,n+Math.sin(l)*i,Math.cos(l)*h+s.x*.6,1.6+Math.random()*1.2,Math.sin(l)*h+s.z*.6,.85*e,.4)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position;for(const s of[-.5,.5])Qf(t,a-e.z*s*se*.12,o,n+e.x*s*se*.12,e.x*2.6-e.z*s*1.2,.5,e.z*2.6+e.x*s*1.2,.9,.3);for(let s=0;s<5;s++)tn(t,a,o,n,e.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.6+Math.random()*.6,e.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1,.85,.28);for(let s=0;s<3;s++)as(t,a,o,n,e.x*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.7+Math.random()*.5,e.z*(1.8+Math.random()*1)+(Math.random()-.5)*.9,.75,.24)}},Swarm:{projectile(t){const e=Dp(Np(t));return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Zf(e,t.weapon,2.4);o.t+=o.rate*a,o.age+=a;const n=Math.sin(o.age*7.5+o.t)*se*.085;if(e.position.x+=-t.direction.z*n,e.position.z+=t.direction.x*n,e.position.y+=Math.sin(o.age*5.2)*se*.03,e.rotation.x=o.t*.8,e.rotation.z=Math.sin(o.t*.7)*.7,o.shed-=a,o.shed<=0){o.shed=.14+Math.random()*.08;const s=Uo();s.color.set(t.color),s.opacity=1;const i=new M(ts,s);i.renderOrder=9;const r=e.position.x,l=e.position.y,h=e.position.z,c=se*.03;i.position.set(r,l,h),i.scale.setScalar(c),t.spawnTransient(i,.26,(d,p)=>{i.position.set(r,l-.5*p*p,h),i.scale.setScalar(c*(1-d*.6)),s.opacity=1-d})}},impact(t){const e=hh(t.damage)*.8,{x:a,y:o,z:n}=t.position,s=t.direction;ch(t,1);const i=se*.28,r=Np(t);for(let l=0;l<Lp;l++){const h=l/Lp*ze+Math.random()*.8,c=(2.6+Math.random()*1.5)*e;Bv(t,r,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*.7,1.8+Math.random()*1.2,Math.sin(h)*c+s.z*.7,1.15,.44+Math.random()*.1)}for(let l=0;l<4;l++){const h=l/4*ze+Math.random()*.9,c=(2.5+Math.random()*1.5)*e;tn(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*.5,1.6+Math.random()*1.2,Math.sin(h)*c+s.z*.5,1+Math.random()*.4,.38)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position,s=(t.weapon.spreadDeg??40)*Math.PI/360,i=["guac","salsa","cheese","rice"];for(let c=0;c<12;c++){const d=(Math.random()*2-1)*s,p=Math.cos(d),u=Math.sin(d),m=e.x*p-e.z*u,f=e.x*u+e.z*p,g=1.8+Math.random()*1.4;os(t,i[c%4],a,o,n,m*g,.8+Math.random()*.7,f*g,.95,.34)}const r=Ov();r.color.set(ir),r.opacity=1;const l=new M(lh,r);l.renderOrder=11;const h=Math.atan2(e.x,e.z);t.spawnTransient(l,.2,c=>{const d=1-Math.pow(1-c,2);l.position.set(a+e.x*d*se*.3,o+d*se*.05,n+e.z*d*se*.3),l.rotation.set(0,h+d*.8,0),l.scale.set(se*.2*(1+d*.5),se*.01,se*.05),r.opacity=1-c*c});for(let c=0;c<4;c++)as(t,a,o,n,e.x*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8+Math.random()*.6,e.z*(1.6+Math.random()*1.1)+(Math.random()-.5)*1.1,.8,.26)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleBurritoRoot";const n=t.position.clone();n.y-=se*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=Xv(),i=new e.Mesh(Hp,s);i.name="teleBurritoBulge",o.add(i);const r=Zv(),l=new e.Mesh(Hp,r);l.name="teleBurritoShell",o.add(l);const h=4,c=[];for(let g=0;g<h;g++){const w=Dp(g);w.name=`teleBurritoTopping${g}`,Jv(w,`teleBurritoTopping${g}`),c.push(w),o.add(w)}const d=(g,w,b)=>{const y=e.MathUtils.clamp((g-w)/(b-w),0,1);return y*y*(3-2*y)},p=se*.78,u=se*.22,m=(t.weapon.spreadDeg??55)*Math.PI/360,f=(g,w)=>{const b=e.MathUtils.clamp(w/a,0,1),y=d(b,0,.4),x=d(b,.85,1),k=se*(.13+.15*y)*(1-.35*x);i.position.set(0,p,u),i.scale.set(k,k*(.82+.25*Math.sin(b*11)),k),s.opacity=(.55+.4*y)*(1-x*.8);const T=se*(.17-.05*y);l.position.set(0,p-se*.04,u-se*.16),l.scale.set(T,T*(1.25-.3*y),T),r.opacity=.62*(1-x*.9);for(let v=0;v<h;v++){const O=c[v],D=v*.09,_=d(b,.18+D,.85),E=(v/(h-1)-.5)*2*m,A=v/h*ze+b*(3.2+2.4*_),C=e.MathUtils.lerp(A,E,x),R=se*(.42+.34*_+.26*x);O.position.set(Math.sin(C)*R,p+Math.sin(A*1.6)*se*.1*(1-x)+se*.1*_,u+Math.cos(C)*R*(.55+.45*x));const I=2.2+(Kv-2.2)*_;O.scale.setScalar(I),O.rotation.set(b*4.2+v,b*3-v,b*2.4)}};f(0,0),t.spawnTransient(o,a+.06,f)}}},No="#FFF8EA",sc="#E4D6AE",rr="#FFFFFF",ic="#4A3118",em="#FF9E12",ek="#FFCE55",tm="#F4FBFF",ri="#FFD84D",tk="#EFB528",ak="#F5872B",ok="#2A2320",am="#FFF0B8",Ie=ae,We=Math.PI*2,So=.29,nk=Ie*.31,sk=Ie*.2,om=Ie*.03,ik=Ie*.062,rk=Ie*.115,lk=Ie*.052,hk=Ie*.16,ck=Ie*.026,dk=Ie*.045,lo=Ie*.125,wt=Ie*.085,Ws=Ie*.115,Ao=new cn(.5,1,4);Ao.rotateZ(-Math.PI/2);const dh=new pt(.5,16,11,0,Math.PI*1.5),pk=new Re(.5,.5,1,8,1,!0,-1.35,2.7),uk=new Re(.5,.5,1,8,1,!0,-1.2,2.4),Xo=new pt(.5,12,10),rc=new Eh(1,2.2,3,7);rc.scale(.5,1/4.2,.5);rc.rotateZ(-Math.PI/2);const nm=new Sh(.62,0),fk=new cn(.5,1,3),mk=new xt(1,1,1),sm=new cn(.5,1,4);sm.rotateX(Math.PI/2);function ps(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const us=(t,e={})=>new X({color:t,transparent:!0,opacity:1,depthWrite:!1,side:ye,...e}),im=ps(34,()=>us(No)),gk=ps(18,()=>us(em)),wk=ps(18,()=>us(tm)),bk=ps(16,()=>us(am)),rn=ps(40,()=>us(rr)),ka=(t,e={})=>new X({color:t,side:ye,...e}),nl=ka(No),ph=ka(sc),yk=ka(No),_p=ka(ak),xk=ka(ok),zp=ka(tk),Pp=[ka(ri),ka(ri),ka(ri)];let vk=0;const Ln=new pe,Dn=new pe,sl=new pe,$p=new v0;function lr(t,e,a,o){Ln.set(e,a,o).normalize(),Math.abs(Ln.y)>.94?Dn.set(1,0,0):Dn.set(0,1,0),sl.crossVectors(Ln,Dn).normalize(),Dn.crossVectors(sl,Ln).normalize(),$p.makeBasis(Ln,Dn,sl),t.quaternion.setFromRotationMatrix($p)}function kk(t){return t.range&&t.speed?t.range/t.speed:Oo.normal/1e3}function uh(t){return K.clamp(.85+t*.035,.85,1.45)}function Mk(t,e,a,o,n,s,i,r,l,h,c,d,p,u,m=-9){a.color.set(o),a.opacity=1;const f=new M(e,a);f.renderOrder=9,f.position.set(n,s,i),f.scale.set(c,d,p),f.rotation.set(Math.random()*We,Math.random()*We,Math.random()*We);const g=(Math.random()-.5)*20,w=(Math.random()-.5)*20,b=(Math.random()-.5)*20,y=f.rotation.x,x=f.rotation.y,k=f.rotation.z;t.spawnTransient(f,u,(T,v)=>{const O=s+l*v+.5*m*v*v,D=O<=So;f.position.set(n+r*v,D?So:O,i+h*v),D||f.rotation.set(y+g*v,x+w*v,k+b*v),a.opacity=1-Math.pow(T,2.4)})}function fo(t,e,a,o,n,s,i,r,l){const h=ik*r*(.75+Math.random()*.6);Mk(t,nm,im(),Math.random()<.3?sc:No,e,a,o,n,s,i,h,h*.8,h,l)}function il(t,e,a,o,n,s,i,r,l){const h=gk();h.color.set(Math.random()<.3?ek:em),h.opacity=1;const c=new M(Xo,h);c.renderOrder=9;const d=lk*r*(.8+Math.random()*.6);c.position.set(e,a,o),c.scale.setScalar(d);const p=14+Math.random()*10,u=Math.random()*We;t.spawnTransient(c,l,(m,f)=>{const g=a+s*f-4.4*f*f;c.position.set(e+n*f,Math.max(So,g),o+i*f);const w=Math.sin(u+f*p)*.24;c.scale.set(d*(1+w),d*(1-w),d*(1+w*.4)),h.opacity=1-Math.pow(m,3)})}function li(t,e,a,o,n,s,i,r,l){const h=wk();h.color.set(tm),h.opacity=.78;const c=new M(rc,h);c.renderOrder=10,c.position.set(e,a,o);const d=hk*r*(.55+Math.random()*.4),p=ck*r*(.75+Math.random()*.5);lr(c,n,s,i),c.scale.set(d,p,p),t.spawnTransient(c,l,(u,m)=>{const f=a+s*m-2.2*m*m;c.position.set(e+n*m,Math.max(So,f),o+i*m),c.scale.set(d*(1+u*1.5),p*(1-u*.4),p*(1-u*.4)),h.opacity=.78*(1-Math.pow(u,1.8))})}function lc(t,e,a,o,n,s,i,r){const l=bk();l.color.set(Math.random()<.35?ri:am),l.opacity=1;const h=new M(fk,l);h.renderOrder=9;const c=dk*i*(.7+Math.random()*.6);h.position.set(e,a,o),h.scale.set(c,c*1.5,c*.35);const d=4+Math.random()*4,p=Math.random()*We;t.spawnTransient(h,r,(u,m)=>{h.position.set(e+n*m+Math.sin(p+m*d)*.1,a+.35*m-.55*m*m,o+s*m+Math.cos(p+m*d*.8)*.1),h.rotation.set(Math.sin(p+m*d)*1.5,m*2.2,Math.cos(p+m*d*.7)*1.2),l.opacity=1-Math.pow(u,2)})}function hi(t,e,a,o=.13){const{x:n,y:s,z:i}=t.position,r=t.direction,l=Math.random()*We;for(let h=0;h<e;h++){const c=l+h/e*We+(Math.random()-.5)*.5,d=(h%3-1)*.42+(Math.random()-.5)*.2,p=Math.cos(d),u=Math.cos(c)*p,m=Math.sin(d),f=Math.sin(c)*p,g=rn();g.color.set(h%2===0?rr:No),g.opacity=1;const w=rn();w.color.set(ic),w.opacity=1;const b=new M(Ao,g),y=new M(Ao,w);b.renderOrder=13,y.renderOrder=12;const x=nk,k=x+sk*a*(.7+Math.random()*.55),T=om*(.8+Math.random()*.45),v=n+r.x*x*.22,O=i+r.z*x*.22,D=new he;D.add(y,b),lr(b,u,m,f),y.quaternion.copy(b.quaternion),t.spawnTransient(D,o,_=>{const E=1-Math.pow(1-_,2.4),A=K.lerp(x,x+(k-x)*.45,E),C=K.lerp(x+(k-x)*.35,k,E),R=Math.max(.02,C-A),I=(A+C)*.5;b.position.set(v+u*I,s+m*I,O+f*I),y.position.copy(b.position),b.scale.set(R,T,T),y.scale.set(R*1.06,T*2.6,T*2.6);const L=_<.45?1:1-(_-.45)/.55;g.opacity=L,w.opacity=L})}}function Bp(t,e,a,o){const{x:n,z:s}=t.position,i=Math.random()*We,r=new he,l=rn();l.color.set(rr),l.opacity=1;const h=rn();h.color.set(ic),h.opacity=1;const c=[];for(let u=0;u<e;u++){const m=i+u/e*We+(Math.random()-.5)*.55,f=new M(Ao,h),g=new M(Ao,l);f.renderOrder=10,g.renderOrder=11,f.scale.setScalar(0),g.scale.setScalar(0),lr(g,Math.cos(m),0,Math.sin(m)),f.quaternion.copy(g.quaternion),r.add(f,g),c.push({face:g,seam:f,a:m,len:Ie*(.16+Math.random()*.3)*a,w:Ie*(.02+Math.random()*.014)*a})}const d=Ie*.2*a,p=u=>{const m=1-Math.pow(1-Math.min(1,u/.22),2.6);for(const g of c){const w=Math.max(.001,g.len*m),b=d+w*.5,y=n+Math.cos(g.a)*b,x=s+Math.sin(g.a)*b;g.face.position.set(y,So+.012,x),g.seam.position.set(y,So,x),g.face.scale.set(w,Ie*.006,g.w),g.seam.scale.set(w*1.05,Ie*.004,g.w*2.1)}const f=u<.42?1:1-(u-.42)/.58;l.opacity=.92*f,h.opacity=.92*f};p(0),t.spawnTransient(r,o,p)}function Up(t,e,a,o){const{x:n,y:s,z:i}=t.position,r=t.direction;let l=-r.z,h=r.x;Math.hypot(l,h)<1e-4&&(l=1,h=0);for(const c of[-1,1]){const d=im();d.color.set(c<0?No:sc),d.opacity=1;const p=new M(dh,d);p.renderOrder=10;const u=n+l*c*Ie*.26*e,m=i+h*c*Ie*.26*e,f=rk*2*e;p.position.set(u,s,m),p.scale.set(f,f*1.15,f),p.rotation.set(0,c*1.4,0);const g=l*c*a+r.x*a*.35,w=h*c*a+r.z*a*.35,b=1.6+Math.random()*.9,y=c*(6+Math.random()*4),x=(Math.random()-.5)*5;t.spawnTransient(p,o,(k,T)=>{const v=s+b*T-4.6*T*T;p.position.set(u+g*T,Math.max(So,v),m+w*T),p.rotation.set(x*T,c*1.4+y*T,c*.4),d.opacity=1-Math.pow(k,2.2)})}}function Ek(t){const e=new he,a=new he;e.add(a);const o=Pp[vk++%Pp.length];o.color.set(t);const n=lo,s=new M(Xo,o);s.scale.set(n*2,n*1.85,n*1.9),s.position.y=n*.15,a.add(s);const i=new M(Xo,zp);i.scale.set(n*1.5,n*.8,n*1.45),i.position.set(0,-n*.42,n*.18),a.add(i);const r=new M(sm,_p);r.scale.set(n*.55,n*.46,n*.7),r.position.set(0,n*.26,n*.92),a.add(r);for(const c of[-1,1]){const d=new M(Xo,xk);d.scale.setScalar(n*.34),d.position.set(c*n*.4,n*.62,n*.62),a.add(d);const p=new M(Xo,zp);p.scale.set(n*.34,n*.85,n*1.05),p.position.set(c*n*.92,n*.08,-n*.1),p.rotation.z=c*.4,a.add(p),p.userData.__side=c;const u=new M(mk,_p);u.scale.set(n*.18,n*.1,n*.44),u.position.set(c*n*.34,-n*.92,n*.12),a.add(u)}const l=new M(dh,yk);l.scale.set(n*1.22,n*1,n*1.22),l.position.set(-n*.16,n*.88,-n*.22),l.rotation.set(Math.PI-.42,.7,.3),a.add(l);const h=new M(dh,ph);return h.scale.set(n*1.08,n*.8,n*1.08),h.position.set(-n*.16,n*.86,-n*.22),h.rotation.set(Math.PI-.42,.7,.3),a.add(h),e.userData.__bob=a,e}function Tk(t){const e=new he;nl.color.set(t);const a=new M(pk,nl);a.scale.set(wt*2,Ws,wt*2),e.add(a);const o=new M(uk,ph);o.scale.set(wt*1.78,Ws*.92,wt*1.78),e.add(o);for(let s=0;s<2;s++){const i=new M(nm,nl),r=wt*(.42+s*.18);i.scale.set(r,r*.7,r),i.position.set(wt*(s===0?.8:-.5),Ws*(s===0?.45:-.5),wt*.4),i.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2),e.add(i)}const n=new M(Xo,ph);return n.scale.set(wt*.75,wt*.4,wt*.75),n.position.set(-wt*.2,-Ws*.34,0),e.add(n),e}function rm(t,e,a){let o=t.userData.__anim;return o||(o={t:Math.random()*We,rate:a*We/kk(e.weapon),shed:0,age:0,lx:e.position.x,lz:e.position.z,speed:nt(e.weapon.speed??160)},t.userData.__anim=o),o}function Sk(t){const e=t.object;if(!e)return;const a=t.dt??0,o=rm(e,t,1);o.age+=a;const n=Math.hypot(t.position.x-o.lx,t.position.z-o.lz);a>0&&(o.speed=o.speed*.55+n/a*.45),o.lx=t.position.x,o.lz=t.position.z;const s=nt(t.weapon.speed??160),i=o.speed<s*.28,r=e.userData.__bob;if(r)if(i){const l=o.age*2.2%1,h=Math.sin(Math.min(1,l*2.2)*Math.PI);r.position.set(0,-lo*.3*h,lo*.75*h),r.rotation.set(h*.95,0,0)}else{const l=o.age*7;r.position.set(0,Math.abs(Math.sin(l))*lo*.22,0),r.rotation.set(0,0,Math.sin(l*.5)*.3);for(const h of r.children){const c=h.userData.__side;c!==void 0&&(h.rotation.z=c*(.4+Math.sin(l)*.5))}}o.shed-=a,o.shed<=0&&(o.shed=i?.1+Math.random()*.08:.2+Math.random()*.14,lc(t,t.position.x+(Math.random()-.5)*lo,t.position.y+lo*.3,t.position.z+(Math.random()-.5)*lo,-t.direction.x*.25+(Math.random()-.5)*.35,-t.direction.z*.25+(Math.random()-.5)*.35,1,.7))}const Ak=Ie*.27;function Rk(t){const e=uh(t.damage)*1.25,{x:a,y:o,z:n}=t.position,s=t.direction;hi(t,4,e*1.15);const i=Ak;for(let r=0;r<9;r++){const l=r/9*We+Math.random()*.6,h=(1.9+Math.random()*1.2)*e;fo(t,a+Math.cos(l)*i,o,n+Math.sin(l)*i,Math.cos(l)*h+s.x*.5,1.5+Math.random()*1,Math.sin(l)*h+s.z*.5,1.2*e,.34)}for(let r=0;r<10;r++){const l=Math.random()*We;lc(t,a+Math.cos(l)*i,o+Ie*.05,n+Math.sin(l)*i,Math.cos(l)*(.9+Math.random()*.8),Math.sin(l)*(.9+Math.random()*.8),e*1.25,.62)}}function Ik(t){const e=t.object;if(!e)return;const a=t.dt??0,o=rm(e,t,1.9);if(o.t+=o.rate*a,e.rotation.x=o.t,e.rotation.z=Math.sin(o.t*.7)*1,o.shed-=a,o.shed<=0){o.shed=.075+Math.random()*.05;const n=t.position.x-t.direction.x*wt,s=t.position.z-t.direction.z*wt;Math.random()<.45?li(t,n,t.position.y-wt*.3,s,-t.direction.x*.35+(Math.random()-.5)*.4,-.5-Math.random()*.4,-t.direction.z*.35+(Math.random()-.5)*.4,.6,.3):fo(t,n,t.position.y,s,-t.direction.x*.7+(Math.random()-.5)*.6,.1+Math.random()*.3,-t.direction.z*.7+(Math.random()-.5)*.6,.7,.28)}}const Ok={Tackle:{impact(t){const e=uh(t.damage),{x:a,y:o,z:n}=t.position,s=t.direction;hi(t,8,e),Up(t,e*.95,2.4*e,.42),Bp(t,7,e,.66);const i=Ie*.26*e,r=.8;for(let l=0;l<5;l++){const h=l/5*We+Math.random()*.7,c=(2+Math.random()*1.2)*e;il(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.9+Math.random()*1.1,Math.sin(h)*c+s.z*r,e*1.15,.5+Math.random()*.12)}for(let l=0;l<6;l++){const h=l/6*We+Math.random()*.8,c=(2.4+Math.random()*1.5)*e;li(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.4+Math.random()*1,Math.sin(h)*c+s.z*r,e,.4+Math.random()*.12)}for(let l=0;l<11;l++){const h=Math.random()*We,c=(2.6+Math.random()*2)*e;fo(t,a+Math.cos(h)*i*.9,o,n+Math.sin(h)*i*.9,Math.cos(h)*c+s.x*r,1.7+Math.random()*1.7,Math.sin(h)*c+s.z*r,(.9+Math.random()*.6)*e,.4+Math.random()*.14)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position,s=Math.atan2(e.x,e.z);for(let i=0;i<4;i++){const r=(i-1.5)*.34,l=Math.sin(s+r),h=Math.cos(s+r),c=(i%2-.5)*.35,d=rn();d.color.set(i%2===0?rr:No),d.opacity=1;const p=rn();p.color.set(ic),p.opacity=1;const u=new M(Ao,d),m=new M(Ao,p);u.renderOrder=13,m.renderOrder=12;const f=new he;f.add(m,u),lr(u,l,c,h),m.quaternion.copy(u.quaternion);const g=om*.85;t.spawnTransient(f,.17,w=>{const b=1-Math.pow(1-w,2.2),y=Ie*.1+b*Ie*.1,x=Ie*(.12+b*.22),k=y+x*.5;u.position.set(a+l*k,o+c*k*.5,n+h*k),m.position.copy(u.position),u.scale.set(x,g,g),m.scale.set(x*1.06,g*2.6,g*2.6);const T=w<.5?1:1-(w-.5)/.5;d.opacity=T,p.opacity=T})}for(let i=0;i<8;i++)fo(t,a,o,n,e.x*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.7+Math.random()*.7,e.z*(1.5+Math.random()*1.1)+(Math.random()-.5)*.9,.9,.3);for(let i=0;i<3;i++)il(t,a,o,n,e.x*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.8+Math.random()*.5,e.z*(1.2+Math.random()*.8)+(Math.random()-.5)*.6,.9,.32)}},Hatch:{projectile(t){const e=Ek(t.color);return e.position.copy(t.position),e},trail(t){Sk(t)},impact(t){Rk(t)},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position;hi(t,6,.62,.14),Up(t,.8,2,.4);for(let s=0;s<9;s++){const i=Math.random()*We;lc(t,a+Math.cos(i)*Ie*.1,o+Ie*.06,n+Math.sin(i)*Ie*.1,Math.cos(i)*(.8+Math.random()*.9)+e.x*.5,Math.sin(i)*(.8+Math.random()*.9)+e.z*.5,1.1,.8)}for(let s=0;s<5;s++)fo(t,a,o,n,e.x*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.8+Math.random()*.6,e.z*(1.2+Math.random()*.9)+(Math.random()-.5)*1,.85,.3)}},Shards:{projectile(t){const e=Tk(t.color);return e.position.copy(t.position),e},trail(t){Ik(t)},impact(t){const e=uh(t.damage)*.9,{x:a,y:o,z:n}=t.position,s=t.direction;hi(t,5,e*.82,.12),Bp(t,5,e*.7,.6);const i=Ie*.24*e,r=.7;for(let l=0;l<6;l++){const h=l/6*We+Math.random()*.8,c=(2.2+Math.random()*1.4)*e;li(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.4+Math.random()*1,Math.sin(h)*c+s.z*r,e*1.1,.42+Math.random()*.12)}for(let l=0;l<7;l++){const h=l/7*We+Math.random()*.9,c=(2.4+Math.random()*1.7)*e;fo(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*c+s.x*r,1.6+Math.random()*1.4,Math.sin(h)*c+s.z*r,(.85+Math.random()*.5)*e,.38+Math.random()*.12)}for(let l=0;l<2;l++){const h=Math.random()*We;il(t,a+Math.cos(h)*i,o,n+Math.sin(h)*i,Math.cos(h)*2*e+s.x*r,1.7+Math.random()*.9,Math.sin(h)*2*e+s.z*r,e*.85,.44)}},cast(t){const e=t.direction,{x:a,y:o,z:n}=t.position,s=(t.weapon.spreadDeg??30)*Math.PI/360;for(let i=0;i<9;i++){const r=(Math.random()*2-1)*s,l=Math.cos(r),h=Math.sin(r),c=e.x*l-e.z*h,d=e.x*h+e.z*l,p=1.6+Math.random()*1.2;fo(t,a,o,n,c*p,.7+Math.random()*.6,d*p,.95,.32)}for(let i=0;i<3;i++){const r=(Math.random()*2-1)*s,l=Math.cos(r),h=Math.sin(r),c=e.x*l-e.z*h,d=e.x*h+e.z*l;li(t,a,o,n,c*1.6,.5+Math.random()*.4,d*1.6,.85,.3)}}}},Ya="#E63946",Va="#FFFDF9",lm="#00E5B0",Ck="#FFEAF1",Fk=.32,Nk=.34,qp=.36,Lk=.33,rl=.46;function fs(t){const e=document.createElement("canvas");return e.width=t,e.height=t,e.getContext("2d")}function ms(t){const e=new st(t.canvas);return e.anisotropy=8,e.needsUpdate=!0,e}function Dk(){const e=fs(512),a=512/2,o=a,n=5,s=1.15,i=Math.PI/n*.52,r=56;e.fillStyle="#ffffff";for(let h=0;h<n;h++){const c=h/n*Math.PI*2;e.beginPath();for(let d=0;d<=r;d++){const p=d/r*o,u=c+s*Math.PI*2*(p/o)-i,m=a+Math.cos(u)*p,f=a+Math.sin(u)*p;d===0?e.moveTo(m,f):e.lineTo(m,f)}for(let d=r;d>=0;d--){const p=d/r*o,u=c+s*Math.PI*2*(p/o)+i;e.lineTo(a+Math.cos(u)*p,a+Math.sin(u)*p)}e.closePath(),e.fill()}e.globalCompositeOperation="destination-out";const l=e.createRadialGradient(a,a,o*.9,a,a,o);return l.addColorStop(0,"rgba(0,0,0,0)"),l.addColorStop(1,"rgba(0,0,0,1)"),e.fillStyle=l,e.fillRect(0,0,512,512),e.globalCompositeOperation="source-over",ms(e)}function Hk(){const e=fs(256),a=256/2,o=e.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0.62)"),o.addColorStop(.55,"rgba(255,255,255,0.58)"),o.addColorStop(.88,"rgba(255,255,255,0.8)"),o.addColorStop(.975,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=o,e.fillRect(0,0,256,256),ms(e)}function _k(){const e=fs(512),a=512/2,o=a,n=o*.74;e.fillStyle="#ffffff",e.beginPath(),e.moveTo(a+o,a),e.arc(a,a,o,0,Math.PI*2,!1),e.moveTo(a+n,a),e.arc(a,a,n,0,Math.PI*2,!0),e.fill(),e.globalCompositeOperation="destination-out";const s=40;e.fillStyle="rgba(0,0,0,0.5)";for(let l=0;l<s;l++){const h=l/s*Math.PI*2,c=h+Math.PI/s;e.beginPath(),e.moveTo(a,a),e.arc(a,a,o,h,c),e.closePath(),e.fill()}const i=e.createRadialGradient(a,a,o*.96,a,a,o);i.addColorStop(0,"rgba(0,0,0,0)"),i.addColorStop(1,"rgba(0,0,0,1)"),e.fillStyle=i,e.fillRect(0,0,512,512);const r=e.createRadialGradient(a,a,n,a,a,n*1.22);return r.addColorStop(0,"rgba(0,0,0,1)"),r.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=r,e.fillRect(0,0,512,512),e.globalCompositeOperation="source-over",ms(e)}function zk(){const e=fs(512),a=512/2,o=e.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,0)"),o.addColorStop(.966,"rgba(255,255,255,0)"),o.addColorStop(.976,"rgba(255,255,255,1)"),o.addColorStop(.991,"rgba(255,255,255,1)"),o.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=o,e.fillRect(0,0,512,512),ms(e)}function Pk(){const e=fs(64),a=64/2,o=e.createRadialGradient(a,a,0,a,a,a);return o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.35,"rgba(255,255,255,0.8)"),o.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=o,e.fillRect(0,0,64,64),ms(e)}const gs=Dk(),hc=Hk(),$k=_k(),cc=zk(),hr=Pk(),St=new Co(1,96);St.rotateX(-Math.PI/2);const Bk=new Re(1,1,.34,12),hm=new Re(1,1,.22,44),cm=new Re(.055,.055,1,10);function Pe(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Uk=Pe(3,()=>new X({map:hc,color:Ya,transparent:!0,opacity:.6,depthWrite:!1})),qk=Pe(2,()=>new X({map:gs,color:Va,transparent:!0,opacity:.5,depthWrite:!1})),Wk=Pe(2,()=>new X({map:gs,color:Ya,transparent:!0,opacity:.9,depthWrite:!1})),Gk=Pe(6,()=>new X({map:gs,color:Va,transparent:!0,opacity:.9,depthWrite:!1})),jk=Pe(3,()=>new X({map:$k,color:Va,transparent:!0,opacity:1,depthWrite:!1,blending:tt})),dm=Pe(4,()=>new X({map:cc,color:Ya,transparent:!0,opacity:1,depthWrite:!1})),Yk=Pe(2,()=>new X({map:cc,color:Va,transparent:!0,opacity:1,depthWrite:!1})),Vk=Pe(10,()=>new X({map:gs,color:Ya,transparent:!0,opacity:.9,depthWrite:!1})),Kk=Pe(14,()=>new X({color:Ya,transparent:!0,opacity:1})),Xk=Pe(14,()=>new X({color:Va,transparent:!0,opacity:1})),Zk=Pe(24,()=>new Lt({map:hr,color:Ck,transparent:!0,opacity:1,depthWrite:!1,blending:tt})),Jk=Pe(12,()=>new Lt({map:hr,color:lm,transparent:!0,opacity:1,depthWrite:!1,blending:tt})),Qk=Pe(12,()=>new Lt({map:hr,color:Ya,transparent:!0,opacity:1,depthWrite:!1})),e5=Pe(5,()=>new Lt({map:hr,color:lm,transparent:!0,opacity:1,depthWrite:!1})),t5=Pe(2,()=>new X({color:Va,transparent:!0,opacity:1})),a5=Pe(2,()=>new X({color:"#FBF7EE",transparent:!0,opacity:1}));function Wp(t,e,a,o,n,s){const i=Vk(),r=new M(St,i);r.position.set(e,Lk,a),r.rotation.y=Math.random()*Math.PI*2,r.renderOrder=12;const l=(Math.random()<.5?-1:1)*(2.4+Math.random()*1.2),h=r.rotation.y;r.scale.setScalar(o*.35),t.spawnTransient(r,n,c=>{const d=1-Math.pow(1-Math.min(1,c*3.2),3);r.scale.setScalar(o*(.35+.65*d)),r.rotation.y=h+l*c*.35,i.opacity=s*(1-Math.pow(c,1.6))})}function Gp(t,e,a,o,n,s,i){const r=Math.random()<.45?Kk():Xk(),l=new M(Bk,r);l.scale.setScalar(s),l.position.set(e.x,e.y,e.z),l.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);const h=e.x,c=e.y,d=e.z,p=1.5+Math.random()*1.9,u=-9.4,m=(Math.random()-.5)*16,f=(Math.random()-.5)*16;t.spawnTransient(l,i,(g,w)=>{l.position.set(h+a*n*w,Math.max(.08,c+p*w+.5*u*w*w),d+o*n*w),l.rotation.x+=m*.016,l.rotation.z+=f*.016,r.opacity=1-Math.pow(g,2.2)})}function no(t,e,a,o,n,s,i,r,l=Zk,h=0){const c=l(),d=new ga(c);d.position.set(e,a,o),d.scale.set(n,n,1),d.renderOrder=14,d.visible=h<=0;const p=(Math.random()-.5)*.5;t.spawnTransient(d,i+h,(u,m)=>{if(m<h){d.visible=!1;return}d.visible=!0;const f=Math.min(1,(m-h)/i),g=K.lerp(n,s,f);d.scale.set(g,g,1),d.position.y=a+r*f,d.position.x=e+p*f,c.opacity=1-Math.pow(f,1.5)})}function o5(t,e,a,o,n){const s=ae*.85,i=ae*1.7,r=new he,l=Math.hypot(o,n)||1,h=s+ae*.5;r.position.set(e+o/l*h,0,a+n/l*h);const c=dm(),d=new M(St,c);d.scale.setScalar(s*1.16),d.position.y=.115,d.renderOrder=12,r.add(d);const p=t5(),u=new M(hm,p);u.scale.set(s,1,s),r.add(u);const m=Wk(),f=new M(St,m);f.scale.setScalar(s*.99),f.position.y=.13,f.renderOrder=13,r.add(f);const g=a5(),w=new M(cm,g);w.scale.set(1,i,1);const b=new pe(-o,0,-n);b.lengthSq()<1e-6&&b.set(0,0,-1),b.normalize(),w.quaternion.setFromUnitVectors(new pe(0,1,0),b),w.position.set(b.x*(s+i*.5)*.92,.05,b.z*(s+i*.5)*.92),r.add(w);const y=5.2,x=.09;t.spawnTransient(r,.75,(T,v)=>{if(v<x){const D=v/x;r.position.y=y*(1-D*D),r.scale.set(1,1,1)}else{const D=Math.min(1,(v-x)/.16);r.position.y=0;const _=1-.55*(1-D)*Math.cos(D*Math.PI*1.2);r.scale.set(1+(1-_)*.22,Math.max(.25,_),1+(1-_)*.22)}const O=T<.45?1:1-(T-.45)/.55;p.opacity=O,g.opacity=O,m.opacity=.9*O,c.opacity=O})}const ho=ae*.85,Gs=ho+ae*.5,jp=ae*1.7,n5="#3C0F12",s5="#EC656F",i5="#F5B0B5",r5=Pe(2,()=>new X({map:hc,color:n5,transparent:!0,opacity:0,depthWrite:!1})),l5=Pe(2,()=>new X({map:hc,color:s5,transparent:!0,opacity:0,depthWrite:!1})),h5=Pe(2,()=>new X({map:cc,color:i5,transparent:!0,opacity:0,depthWrite:!1})),c5=Pe(2,()=>new X({color:Va,transparent:!0,opacity:1,depthWrite:!1})),d5=Pe(2,()=>new X({map:gs,color:Ya,transparent:!0,opacity:.95,depthWrite:!1})),p5=Pe(2,()=>new X({color:"#FBF7EE",transparent:!0,opacity:1,depthWrite:!1})),u5={Smash:{cast(t){const e=t.direction.x,a=t.direction.z,o=t.position.x-e*.75,n=t.position.z-a*.75,s=Math.atan2(a,e),i=ae*1.15,r=K.degToRad((t.weapon.cone??80)/2),l=ae*.34;for(let h=0;h<2;h++){const c=h*.05,d=Gk();d.color.set(h===0?Va:Ya);const p=new M(St,d);p.scale.setScalar(l*(1-h*.16)),p.renderOrder=13;const u=h===0?.95:.42;t.spawnTransient(p,.2,m=>{const f=K.clamp((m*.2-c)/.2,0,1),g=1-Math.pow(1-f,2),w=s-r+g*r*2;p.position.set(o+Math.cos(w)*i,K.lerp(ae*.8,.4,g),n+Math.sin(w)*i),p.rotation.y=w*1.6,d.opacity=u*(f<=0?0:1-Math.pow(m,2.4))})}for(let h=0;h<2;h++){const c=s+(Math.random()-.5)*r*1.4;no(t,o+Math.cos(c)*i*1.05,ae*.5,n+Math.sin(c)*i*1.05,ae*.13,ae*.03,.2,.25)}},impact(t){const{x:e,z:a}=t.position,o=K.clamp(.85+t.damage*.03,.85,1.6);no(t,e,t.position.y,a,ae*.3*o,ae*.6*o,.15,.1),Wp(t,e,a,ae*.32*o,.5,.85);const n=6;for(let s=0;s<n;s++){const i=s/n*Math.PI*2+Math.random()*.7;Gp(t,{x:e,y:t.position.y*.8,z:a},Math.cos(i),Math.sin(i),(1.7+Math.random()*1.9)*o,ae*(.065+Math.random()*.03),.42+Math.random()*.18)}for(let s=0;s<3;s++){const i=Math.random()*Math.PI*2;no(t,e+Math.cos(i)*.3,t.position.y+.1,a+Math.sin(i)*.3,ae*.14,ae*.04,.34,.5)}}},Giant:{cast(t){const{x:e,z:a}=t.position,o=nt(t.weapon.range??0),n=Uk(),s=new M(St,n);s.position.set(e,Fk,a),s.renderOrder=10,s.scale.setScalar(o*.12),t.spawnTransient(s,1,u=>{const m=1-Math.pow(1-Math.min(1,u/.26),3);s.scale.setScalar(o*(.12+.88*m)),n.opacity=.3*(u<.2?1:Math.pow(1-(u-.2)/.8,1.5))});for(const[u,m,f,g]of[[dm(),1,.95,16],[Yk(),.974,.9,17]]){const w=new M(St,u);w.position.set(e,qp+.01,a),w.renderOrder=g,w.scale.setScalar(o*.12*m),t.spawnTransient(w,1,b=>{const y=1-Math.pow(1-Math.min(1,b/.26),3);w.scale.setScalar(o*(.12+.88*y)*m),u.opacity=f*(b<.42?1:Math.pow(1-(b-.42)/.58,1.4))})}const i=qk(),r=new M(St,i);r.position.set(e,Nk,a),r.renderOrder=11,r.scale.setScalar(o*.12),t.spawnTransient(r,1,u=>{const m=1-Math.pow(1-Math.min(1,u/.26),3);r.scale.setScalar(o*(.12+.88*m)),r.rotation.y=(1-Math.pow(1-u,2))*1.5,i.opacity=.4*(u<.22?1:Math.pow(1-(u-.22)/.78,1.5))});const l=jk(),h=new M(St,l);h.position.set(e,qp,a),h.renderOrder=15,h.scale.setScalar(o*.05),t.spawnTransient(h,rl+.22,(u,m)=>{const f=Math.min(1,m/rl),g=1-Math.pow(1-f,2.2);h.scale.setScalar(o*(.05+.98*g)),h.rotation.y=g*.5,l.opacity=.95*(1-Math.pow(u,2.4))});const c=10,d=.55,p=Math.PI*(3-Math.sqrt(5));for(let u=0;u<c;u++){const m=o*d*Math.sqrt((u+.6)/c),f=u*p,g=e+Math.cos(f)*m,w=a+Math.sin(f)*m,b=m/o*rl;no(t,g,.55,w,ae*.2,ae*.68,.3,.55,Qk,b),u%3===0&&no(t,g,.5,w,ae*.12,ae*.34,.34,.7,e5,b+.03)}o5(t,e,a,t.direction.x,t.direction.z)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1500)/1e3),o=new e.Group;o.name="teleLolliRoot";const n=t.position.clone();n.y-=ae*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=r5(),i=new e.Mesh(St,s);i.name="teleLolliBase",i.scale.setScalar(ho),i.position.set(0,.02,Gs),i.renderOrder=5,o.add(i);const r=l5(),l=new e.Mesh(St,r);l.name="teleLolliFill",l.position.set(0,.032,Gs),l.renderOrder=5.01,o.add(l);const h=h5(),c=new e.Mesh(St,h);c.name="teleLolliRim",c.scale.setScalar(ho*1.06),c.position.set(0,.044,Gs),c.renderOrder=5.02,o.add(c);const d=new e.Group;d.name="teleLolliCandy",o.add(d);const p=c5(),u=new e.Mesh(hm,p);u.name="teleLolliHead",u.scale.set(ho,1,ho),d.add(u);const m=d5(),f=new e.Mesh(St,m);f.name="teleLolliSwirl",f.scale.setScalar(ho*.99),f.position.y=.13,f.renderOrder=13,d.add(f);const g=p5(),w=new e.Mesh(cm,g);w.name="teleLolliStick",w.scale.set(1,jp,1),w.rotation.x=-Math.PI/2,w.position.z=-3.57*.92,d.add(w);const b=(x,k,T)=>{const v=e.MathUtils.clamp((x-k)/(T-k),0,1);return v*v*(3-2*v)},y=(x,k)=>{const T=e.MathUtils.clamp(k/a,0,1),v=b(T,0,.78),O=b(T,.78,1),D=.5+.5*Math.sin(Math.PI*2*(2*T+3*T*T));s.opacity=.6+.14*D;const _=ho*(.12+.88*T);l.scale.setScalar(_),r.opacity=.7+.22*T,h.opacity=.62+.36*T*T;const E=.28+.72*v;d.scale.setScalar(E),d.position.set(0,ae*(.55+1.05*v+.55*O),Gs*(.35+.65*v)-jp*.1*O),d.rotation.y=T*(2.2+5.5*T),d.rotation.x=-.55*O;const A=.85+.15*D;p.opacity=A,g.opacity=A,m.opacity=.95*A};y(0,0),t.spawnTransient(o,a+.06,y)},impact(t){const{x:e,z:a}=t.position,o=K.clamp(.9+t.damage*.035,.9,1.7);no(t,e,t.position.y,a,ae*.34*o,ae*.62*o,.18,.12),Wp(t,e,a,ae*.42*o,.62,.9);const n=8;for(let s=0;s<n;s++){const i=s/n*Math.PI*2+Math.random()*.6;Gp(t,{x:e,y:t.position.y*.85,z:a},Math.cos(i),Math.sin(i),(2.1+Math.random()*2.2)*o,ae*(.07+Math.random()*.035),.48+Math.random()*.2)}for(let s=0;s<4;s++){const i=s/4*Math.PI*2+Math.random();no(t,e+Math.cos(i)*.34,t.position.y+.15,a+Math.sin(i)*.34,ae*.11,ae*.04,.42,.85,Jk)}}}},f5="#EFB868",m5="#CE8A2E",pm="#4A2A12",g5="#B93A28",Wn="#F7ECD3",Ee=ae,yt=Math.PI*2,cr=.26;function Lo(t,e=10){const a=new Ah(t,e);return a.rotateX(-Math.PI/2),a}function dc(t,e){const a=Math.tan(e)*t,o=-t*.58,n=t*.42,s=new ja;return s.moveTo(0,o),s.lineTo(-a,n),s.quadraticCurveTo(0,n+a*.5,a,n),s.closePath(),s}function w5(t){const e=new ja;return e.moveTo(0,t),e.quadraticCurveTo(t*.82,t*.78,t*.96,-t*.06),e.quadraticCurveTo(t*.7,-t*.72,0,-t),e.quadraticCurveTo(-t*.84,-t*.66,-t,t*.04),e.quadraticCurveTo(-t*.7,t*.8,0,t),e}function um(t,e,a=22){const o=new ja;for(let n=0;n<=a;n++){const s=n/a*yt,i=1+Math.sin(s*3+t)*.17+Math.sin(s*5+e)*.11,r=Math.cos(s)*i,l=Math.sin(s)*i;n===0?o.moveTo(r,l):o.lineTo(r,l)}return o}function b5(t){const e=new ja;return e.moveTo(-t,0),e.lineTo(t,0),e.lineTo(0,1),e.closePath(),e}const Zo=Ee*.3,Gn=Ee*.16,ci=Ee*.18,Yp=Lo(dc(Zo,.44),8),di=Lo(w5(ci),8),pc=(()=>{const t=new Co(1,12);return t.rotateX(-Math.PI/2),t})(),Vp=(()=>{const t=new Co(Gn,20);t.rotateX(-Math.PI/2);const e=t.attributes.position;for(let a=1;a<e.count;a++){const o=e.getX(a),n=e.getZ(a),s=Math.atan2(n,o),i=1+Math.sin(s*3)*.13+Math.sin(s*7+1.3)*.075;e.setX(a,o*i),e.setZ(a,n*i)}return e.needsUpdate=!0,t})(),Kp=Lo(dc(Ee*.105,.52),4),fm=Lo(dc(1,.62),3),mm=Lo(um(0,2.1),1),y5=Lo(um(1.7,4.3),1),x5=Lo(b5(.16),1),gm=(()=>{const t=new $a(.62,1,18,1,0,Math.PI*.8);return t.rotateX(-Math.PI/2),t})(),v5=(()=>{const t=new Co(Ee*.032,6);return t.rotateX(-Math.PI/2),t})(),k5=(()=>{const t=new xt(Ee*.022,1,Ee*.022);return t.translate(0,-.5,0),t})();function Do(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Ka=t=>new X({color:t,side:ye}),Xp=Ka("#F6E3B4"),Zp=Ka("#E63946"),Jp=Ka("#FFD873"),M5=Ka(f5),wm=Ka(m5),E5=Ka(g5),T5=Ka(Wn),S5=Ka(pm),A5=Do(20,()=>new X({color:"#E63946",transparent:!0,opacity:1,side:ye,depthWrite:!1})),bm=Do(24,()=>new X({color:pm,transparent:!0,opacity:1,side:ye,depthWrite:!1})),ym=Do(10,()=>new X({color:"#B62430",transparent:!0,opacity:.9,side:ye,depthWrite:!1})),R5=Do(28,()=>new X({color:Wn,transparent:!0,opacity:.9,side:ye,depthWrite:!1})),xm=Do(8,()=>new X({color:"#FFE9A8",transparent:!0,opacity:.9,side:ye,blending:tt,depthWrite:!1})),vm=Do(16,()=>new X({color:"#FFD9A0",transparent:!0,opacity:.5,side:ye,blending:tt,depthWrite:!1})),ll=Do(12,()=>new X({color:"#FFD873",transparent:!0,opacity:.95,side:ye,depthWrite:!1})),I5=new pe(0,1,0),Qp=new pe,eu=new pe,hl=new ji,tu=new ji;function qo(t,e,a,o){hl.setFromAxisAngle(I5,a);const n=Math.hypot(e.x,e.z);Math.abs(o)>1e-4&&n>1e-4?(Qp.set(e.z/n,0,-e.x/n),tu.setFromAxisAngle(Qp,o),t.quaternion.copy(tu).multiply(hl)):t.quaternion.copy(hl)}function uc(t,e,a){const o=new he,n=new M(t,S5);return n.scale.set(a,1,a),n.position.y=-Ee*.011,o.add(n),o.add(new M(t,e)),o}function O5(t){return t.range&&t.speed?t.range/t.speed:Oo.normal/1e3}function cl(t,e,a){let o=t.userData.__spin;return o||(o={spin:Math.random()*yt,rate:a*yt/O5(e),shed:0},t.userData.__spin=o),o}function au(t,e,a,o){const n=vm();n.color.set(o),n.opacity=.45;const s=new M(gm,n);s.renderOrder=9,s.position.copy(t.position),s.rotation.y=a,s.scale.set(e,1,e),t.spawnTransient(s,.13,i=>{const r=e*(1+i*.28);s.scale.set(r,1,r),n.opacity=.45*(1-i)})}function Fa(t,e,a,o,n,s,i,r,l){const h=R5();h.color.set(a),h.opacity=.9;const c=new M(v5,h);c.renderOrder=9,c.position.copy(e),c.scale.setScalar(r);const d=e.x,p=e.y,u=e.z;t.spawnTransient(c,l,(m,f)=>{c.position.set(d+o*f,Math.max(cr,p+n*f+.5*i*f*f),u+s*f),h.opacity=.9*(1-m*m)})}function dl(t,e,a,o,n,s,i){const r=new he,l=bm();l.opacity=1;const h=new M(Kp,l);h.scale.set(1.22,1,1.22),h.position.y=-Ee*.008,r.add(h);const c=A5();c.color.set(a),c.opacity=1,r.add(new M(Kp,c)),r.renderOrder=9,r.position.copy(e),r.scale.setScalar(s);const d=e.x,p=e.y,u=e.z,m=Math.cos(o),f=Math.sin(o),g=m*n,w=f*n,b=.8+Math.random()*.9,y=-7.5,x=Math.random()*yt,k=(Math.random()-.5)*24;t.spawnTransient(r,i,(T,v)=>{r.position.set(d+g*v,Math.max(cr,p+b*v+.5*y*v*v),u+w*v),eu.set(m,0,f),qo(r,eu,x+k*v,.22);const O=1-Math.pow(T,2.2);c.opacity=O,l.opacity=O})}function C5(t,e,a,o,n,s){const i=new he;i.position.set(t.position.x,cr,t.position.z),i.renderOrder=4;const r=ym();r.color.set(e),r.opacity=s;const l=new M(Math.random()<.5?mm:y5,r);l.rotation.y=Math.random()*yt,i.add(l);for(let h=0;h<o;h++){const c=new M(x5,r);c.rotation.y=h/o*yt+Math.random()*.7,c.scale.set(.7+Math.random()*.4,1,1+Math.random()*.4),i.add(c)}t.spawnTransient(i,n,h=>{const c=1-Math.pow(1-Math.min(1,h*5),3);i.scale.set(a*c,1,a*c),r.opacity=s*(h<.55?1:1-(h-.55)/.45)})}function pl(t,e,a,o){const n=xm();n.color.set(e),n.opacity=.9;const s=new M(fm,n);s.renderOrder=11,s.position.copy(t.position),s.rotation.y=Math.random()*yt,s.scale.set(a*.35,1,a*.35),t.spawnTransient(s,o,i=>{const r=K.lerp(a*.35,a,1-Math.pow(1-i,2));s.scale.set(r,1,r),n.opacity=.9*(1-i)})}function ul(t){return K.clamp(.85+t*.035,.85,1.4)}function F5(t){const e=uc(Yp,M5,1.15);Zp.color.set(t);const a=new M(Yp,Zp);a.scale.set(.86,1,.86),a.position.set(0,Ee*.006,Zo*.04),e.add(a);for(const[o,n,s]of[[-.2,-.1,.075],[.15,.11,.06]]){const i=new M(pc,E5);i.position.set(Zo*o,Ee*.012,Zo*n),i.scale.setScalar(Zo*s*2),e.add(i)}return e}function N5(t){const e=uc(Vp,wm,1.13);Xp.color.set(t);const a=new M(Vp,Xp);a.scale.set(.84,1,.84),a.position.y=Ee*.006,e.add(a);const o=new M(pc,T5);return o.scale.setScalar(Gn*.44),o.position.set(Gn*.4,Ee*.011,-Gn*.26),e.add(o),e}function L5(t){Jp.color.set(t);const e=uc(di,Jp,1.12),a=new M(pc,wm);return a.scale.setScalar(ci*.22),a.position.set(ci*.34,Ee*.006,ci*.2),e.add(a),e}const D5={Dough:{projectile(t){const e=N5(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=cl(e,t.weapon,2.6);o.spin+=o.rate*a,qo(e,t.direction,o.spin,.15+Math.sin(o.spin*.37)*.07),e.position.y+=Math.sin(o.spin*.5)*Ee*.012,o.shed-=a,o.shed<=0&&(o.shed=.055+Math.random()*.04,Fa(t,t.position,Wn,-t.direction.x*.5+(Math.random()-.5)*.5,.25+Math.random()*.4,-t.direction.z*.5+(Math.random()-.5)*.5,-1.1,.5+Math.random()*.35,.3+Math.random()*.15),Math.random()<.45&&au(t,Gn*1.2,o.spin,"#FFF0CC"))},impact(t){const e=ul(t.damage),a=ym();a.color.set("#F0DDAE"),a.opacity=.95;const o=new M(mm,a);o.renderOrder=4,o.position.set(t.position.x,cr,t.position.z),o.rotation.y=Math.random()*yt;const n=Ee*.25*e;t.spawnTransient(o,.62,s=>{const i=K.lerp(n*.3,n,1-Math.pow(1-Math.min(1,s*4),3));o.scale.set(i,1,i),a.opacity=.95*(s<.5?1:1-(s-.5)/.5)}),pl(t,"#FFF3D2",Ee*.3*e,.18);for(let s=0;s<10;s++){const i=s/10*yt+Math.random()*.5,r=(.9+Math.random()*1.2)*e;Fa(t,t.position,Wn,Math.cos(i)*r,.7+Math.random()*.9,Math.sin(i)*r,-2.4,.6+Math.random()*.6,.45+Math.random()*.25)}for(let s=0;s<4;s++)dl(t,t.position,"#EFD9A6",Math.random()*yt,(1.9+Math.random()*1.3)*e,(.55+Math.random()*.35)*e,.4+Math.random()*.14)},cast(t){const e=vm();e.color.set("#FFF0CC"),e.opacity=.6;const a=new M(gm,e);a.renderOrder=11,a.position.copy(t.position),t.spawnTransient(a,.16,o=>{const n=K.lerp(Ee*.05,Ee*.16,o);a.scale.set(n,1,n),a.rotation.y=o*9,e.opacity=.6*(1-o)});for(let o=0;o<5;o++)Fa(t,t.position,Wn,t.direction.x*(.5+Math.random()*.6)+(Math.random()-.5)*.6,.5+Math.random()*.5,t.direction.z*(.5+Math.random()*.6)+(Math.random()-.5)*.6,-1.6,.55+Math.random()*.4,.3+Math.random()*.15)}},Tomato:{projectile(t){const e=F5(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=cl(e,t.weapon,1.8);o.spin+=o.rate*a,qo(e,t.direction,o.spin,.17+Math.sin(o.spin*.5)*.06),o.shed-=a,o.shed<=0&&(o.shed=.058,au(t,Zo*.62,o.spin,"#FFC08A"),Math.random()<.5&&Fa(t,t.position,"#C4262F",-t.direction.x*.7+(Math.random()-.5)*.4,.15+Math.random()*.3,-t.direction.z*.7+(Math.random()-.5)*.4,-2.2,.5+Math.random()*.3,.26))},impact(t){const e=ul(t.damage);pl(t,"#FFE7CC",Ee*.4*e,.18),C5(t,t.color,Ee*.22*e,4,.55,.9);for(let a=0;a<5;a++){const o=a/5*yt+Math.random()*.6;dl(t,t.position,t.color,o,(2.2+Math.random()*1.4)*e,(.75+Math.random()*.45)*e,.4+Math.random()*.14)}for(let a=0;a<6;a++){const o=Math.random()*yt,n=(1.3+Math.random()*1.5)*e;Fa(t,t.position,"#C4262F",Math.cos(o)*n,1+Math.random()*1.1,Math.sin(o)*n,-6.5,.7+Math.random()*.5,.34+Math.random()*.14)}},cast(t){const e=xm();e.color.set("#FF8E6A"),e.opacity=.85;const a=new M(fm,e);a.renderOrder=11,a.position.copy(t.position),a.rotation.y=Math.atan2(t.direction.x,t.direction.z),t.spawnTransient(a,.15,o=>{const n=K.lerp(Ee*.08,Ee*.24,1-Math.pow(1-o,2));a.scale.set(n*.7,1,n),e.opacity=.85*(1-o)});for(let o=0;o<3;o++)Fa(t,t.position,"#C4262F",t.direction.x*(1+Math.random())+(Math.random()-.5)*.5,.4+Math.random()*.4,t.direction.z*(1+Math.random())+(Math.random()-.5)*.5,-2.6,.6,.28)}},Cheese:{projectile(t){const e=L5(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=cl(e,t.weapon,.9);o.spin+=o.rate*a,qo(e,t.direction,o.spin,.2*Math.sin(o.spin*1.9));const n=1+Math.sin(o.spin*2.4)*.22;e.scale.set(1/n,1,n),e.position.y+=Math.sin(o.spin*1.2)*Ee*.016,o.shed-=a,o.shed<=0&&(o.shed=.13+Math.random()*.07,Fa(t,t.position,"#FFE49A",-t.direction.x*.4,-.1,-t.direction.z*.4,-1.6,.5,.24))},impact(t){const e=ul(t.damage),a=Ee*.96,o=ll();o.color.set(t.color),o.opacity=.95;const n=new M(di,o);n.renderOrder=11;const s=bm();s.opacity=.6;const i=new M(di,s);i.scale.set(1.12,1,1.12),i.position.y=-Ee*.008,n.add(i),n.position.set(t.position.x,a,t.position.z);const r=1.8*e;t.spawnTransient(n,.5,l=>{const h=K.lerp(r*.4,r,1-Math.pow(1-Math.min(1,l*3.5),3));n.scale.set(h,1,h*(1-l*.25)),n.position.y=a-l*l*Ee*.34,qo(n,t.direction,l*1.2,.35+l*.5);const c=l<.6?1:1-(l-.6)/.4;o.opacity=.95*c,s.opacity=.6*c}),pl(t,"#FFF6D8",Ee*.26*e,.17);for(let l=0;l<4;l++){const h=ll();h.color.set("#FFE08A"),h.opacity=.9;const c=new M(k5,h);c.renderOrder=10;const d=Math.random()*yt,p=Ee*(.06+Math.random()*.08)*e;c.position.set(t.position.x+Math.cos(d)*p,a-Ee*.04,t.position.z+Math.sin(d)*p);const u=Ee*(.14+Math.random()*.12)*e;t.spawnTransient(c,.42,m=>{c.scale.set(1-m*.55,u*(.3+m*.7),1-m*.55),h.opacity=.9*(1-m*m)})}for(let l=0;l<3;l++)dl(t,t.position,"#FFD873",Math.random()*yt,(1+Math.random())*e,(.55+Math.random()*.3)*e,.38)},cast(t){const e=ll();e.color.set(t.color),e.opacity=.85;const a=new M(di,e);a.renderOrder=11,a.position.copy(t.position),t.spawnTransient(a,.16,o=>{const n=K.lerp(.3,.85,1-Math.pow(1-o,2));a.scale.set(n*(.5+o*.6),1,n),qo(a,t.direction,o*2.4,.3-o*.25),e.opacity=.85*(1-o)});for(let o=0;o<3;o++)Fa(t,t.position,"#FFE49A",t.direction.x*(.6+Math.random()*.5),.35+Math.random()*.3,t.direction.z*(.6+Math.random()*.5),-2,.55,.26)}}},ln="#FFFDF6",km="#E4D7BE",Ba="#22301F",H5="#3E5B33",fc=na.salmon,mc="#B85B26",Mm="#FFEEDD",Em="#F2FBFF",Tm="#8FD3E8",ee=ae,Ct=Math.PI*2,jt=.29;function Sm(t,e=8){const a=new Ah(t,e);return a.rotateX(-Math.PI/2),a}const Yt=(()=>{const t=new qa(1,1);return t.rotateX(-Math.PI/2),t})(),ou=(()=>{const t=new ja;t.moveTo(0,0),t.quadraticCurveTo(1,.5,0,1),t.quadraticCurveTo(-1,.5,0,0);const e=Sm(t,10);return e.translate(0,0,1),e})(),nu=(()=>{const e=new ja;return e.moveTo(-.5+.22,-.5),e.lineTo(.5-.22,-.5),e.quadraticCurveTo(.5,-.5,.5,-.5+.22),e.lineTo(.5,.5-.22),e.quadraticCurveTo(.5,.5,.5-.22,.5),e.lineTo(-.5+.22,.5),e.quadraticCurveTo(-.5,.5,-.5,.5-.22),e.lineTo(-.5,-.5+.22),e.quadraticCurveTo(-.5,-.5,-.5+.22,-.5),Sm(e,6)})(),gc=(()=>{const t=new pt(.5,7,5);return t.scale(.44,.44,1),t})(),_5=new Re(.5,.5,1,20,1,!0),fl=(()=>{const t=new Co(.5,20);return t.rotateX(-Math.PI/2),t})(),z5=new Re(.5,.5,1,12,1,!0,0,Math.PI),su=(()=>{const t=new Co(.5,12,-Math.PI/2,Math.PI);return t.rotateX(-Math.PI/2),t})(),P5=(()=>{const t=new qa(1,1);return t.rotateY(-Math.PI/2),t})(),At=ee*.155,Am=ee*.46,pi=ee*.3,ea=ee*.185,js=ee*.2;function Qt(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const ws=t=>new X({color:t,side:ye}),Rm=ws(ln),$5=ws(km),Im=ws(Ba),B5=ws(mc),iu=new Map;function wc(t){let e=iu.get(t);return e||(e=ws(t),iu.set(t,e)),e}const Xa=(t,e)=>new X({color:t,transparent:!0,opacity:e,side:ye,depthWrite:!1}),Om=(t,e)=>new X({color:t,transparent:!0,opacity:e,side:ye,depthWrite:!1,depthTest:!1}),Cm=Qt(56,()=>new X({color:ln,transparent:!0,opacity:1,depthWrite:!1})),U5=Qt(12,()=>Om(Em,1)),q5=Qt(12,()=>Om(Tm,.5)),Ci=Qt(28,()=>Xa(Ba,1)),Fi=Qt(28,()=>Xa(H5,1)),W5=Qt(24,()=>Xa(fc,1)),G5=Qt(24,()=>Xa(mc,1)),j5=Qt(24,()=>Xa(Mm,1)),Y5=Qt(12,()=>Xa(Ba,1)),V5=Qt(12,()=>Xa(ln,1)),K5=Qt(12,()=>Xa(fc,1));function ta(t,e){return Math.atan2(t,e)}function X5(t,e=.62){const a=Math.sin(t),o=Math.cos(t);if(Math.abs(a)>=e)return t;const n=a>=0?1:-1,s=o>=0?1:-1;return Math.atan2(n*e,s*Math.sqrt(1-e*e))}function ml(t){return t.range&&t.speed?t.range/t.speed:Oo.normal/1e3}function Ys(t){return K.clamp(.85+t*.035,.85,1.4)}function gl(t){let e=t.userData.__sushi;return e||(e={phase:Math.random()*Ct,shed:0,grow:0},t.userData.__sushi=e),e}function Vs(t,e,a,o,n,s,i,r){const l=new he,h=X5(n);l.rotation.y=h,l.position.set(e-Math.sin(h)*s*.5,a,o-Math.cos(h)*s*.5),l.renderOrder=13;const c=q5();c.color.set(Tm),c.opacity=.55;const d=new M(ou,c);d.scale.set(2.9,1,1.02),d.position.y=-ee*.006,d.renderOrder=0,l.add(d);const p=U5();p.color.set(Em),p.opacity=1;const u=new M(ou,p);u.renderOrder=1,l.add(u),t.spawnTransient(l,r,m=>{const f=Math.min(1,m*8);l.scale.set(i*(1-m*.55),1,Math.max(.02,s*f));const g=m<.3?1:1-(m-.3)/.7;p.opacity=g,c.opacity=.55*g*g})}function so(t,e,a,o,n,s,i,r,l,h=!1){const c=Cm();c.color.set(h?km:ln),c.opacity=1;const d=new M(gc,c);d.renderOrder=9,d.scale.setScalar(r),d.position.set(e,a,o);const p=-9.6,u=(Math.random()-.5)*14,m=(Math.random()-.5)*14;t.spawnTransient(d,l,(f,g)=>{let w=a+s*g+.5*p*g*g,b=1;if(w<jt){const y=jt-w;w=jt+y*.28,b=.35,w<jt&&(w=jt)}d.position.set(e+n*g,w,o+i*g*1),d.rotation.set(u*g*b,m*g*b,0),c.opacity=1-f*f*f})}function Z5(t,e,a){const o=new he,n=new M(nu,a.deep);n.scale.set(t*1.16,1,e*1.1),n.position.y=-ee*.008,o.add(n);const s=new M(nu,a.face);s.scale.set(t,1,e),o.add(s);for(let i=0;i<2;i++){const r=new M(Yt,a.fat);r.scale.set(t*.86,1,e*.09),r.position.set(0,ee*.005,e*(i===0?-.18:.16)),o.add(r)}return o}function ru(t,e,a){const o=new he,n=new M(z5,a.wall);n.scale.set(t*2,e,t*2),o.add(n);const s=new M(su,a.face);s.scale.set(t*1.6,1,t*1.6),s.position.y=e*.5,o.add(s);const i=new M(su,a.core);i.scale.set(t*.94,1,t*.94),i.position.y=e*.5+ee*.004,o.add(i);const r=new M(P5,a.face);return r.scale.set(1,e*.98,t*1.96),o.add(r),o}function J5(t){const e=new he,a=t==="#FFFFFF"?Rm:wc(t),o=[[0,0,At*.34,1],[-At*.4,ee*.012,-At*.3,.85],[At*.38,-ee*.014,-At*.42,.78]];for(let n=0;n<o.length;n++){const[s,i,r,l]=o[n],h=new M(gc,n===1?$5:a);h.scale.setScalar(At*l),h.position.set(s,i,r),h.rotation.set(0,(n-1)*.5,0),e.add(h)}return e}function lu(t){const e=new he,a=[],o=4,n=Am/o,s=wc(t);for(let r=0;r<o;r++){const l=new he,h=new M(Yt,Im);h.scale.set(pi,1,n*1.02),l.add(h);for(const c of[-1,1]){const d=new M(Yt,s);d.scale.set(pi*.1,1,n*1.02),d.position.set(c*pi*.45,ee*.004,0),l.add(d)}l.position.z=(r-(o-1)/2)*n,e.add(l),a.push(l)}const i={segs:a};return e.userData.__parts=i,e}function hu(t){const e=new he,a=new M(_5,Im);a.scale.set(ea*2,js,ea*2),e.add(a);const o=new M(fl,Rm);o.scale.set(ea*1.6,1,ea*1.6),o.position.y=js*.5,e.add(o);const n=new M(fl,wc(t));n.scale.set(ea*.94,1,ea*.94),n.position.y=js*.5+ee*.004,e.add(n);const s=new M(fl,B5);return s.scale.set(ea*.34,1,ea*.34),s.position.set(ea*.46,js*.5+ee*.005,-ea*.3),e.add(s),e}const Q5=1.9;function cu(t,e){let a=0;t.traverse(o=>{o.isMesh&&!o.name&&(o.name=`${e}Part${a++}`)})}const e4={Rice:{projectile(t){const e=J5(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=gl(e);o.phase+=a/ml(t.weapon)*Ct*1.6,e.rotation.y=ta(t.direction.x,t.direction.z)+Math.sin(o.phase)*.3;const n=1+Math.sin(o.phase*1.9)*.14;e.scale.set(n,1,1/n);for(let s=0;s<e.children.length;s++)e.children[s].rotation.x=o.phase*(.6+s*.35);o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,so(t,t.position.x,t.position.y,t.position.z,-t.direction.x*.5+(Math.random()-.5)*.7,-.15,-t.direction.z*.5+(Math.random()-.5)*.7,At*.75,.3+Math.random()*.12,Math.random()<.4))},impact(t){const e=Ys(t.damage),{x:a,y:o,z:n}=t.position,s=t.direction,i=ee*.26*e;for(let c=0;c<7;c++){const d=c/7*Ct+Math.random()*.7,p=(1.9+Math.random()*1.5)*e;so(t,a+Math.cos(d)*i,o,n+Math.sin(d)*i,Math.cos(d)*p+s.x*.7,1.5+Math.random()*1.2,Math.sin(d)*p+s.z*.7,At*(.9+Math.random()*.5)*e,.44+Math.random()*.16,Math.random()<.35)}const r=Math.hypot(s.x,s.z)>1e-4?ee*.34:0,l=Cm();l.color.set(ln),l.opacity=1;const h=new M(gc,l);h.renderOrder=12,h.position.set(a-s.x*r,o,n-s.z*r),h.rotation.y=ta(s.x,s.z)+Math.PI*.5,t.spawnTransient(h,.14,c=>{h.scale.setScalar(K.lerp(ee*.12,ee*.3,c)*e),l.opacity=1-c})},cast(t){const e=t.direction;for(let a=0;a<6;a++)so(t,t.position.x,t.position.y,t.position.z,e.x*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,.5+Math.random()*.5,e.z*(1.5+Math.random()*1.2)+(Math.random()-.5)*1.1,At*(.7+Math.random()*.4),.3+Math.random()*.12,Math.random()<.4)}},Seaweed:{projectile(t){const e=lu(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=gl(e);o.phase+=a/ml(t.weapon)*Ct*2.8,e.rotation.y=ta(t.direction.x,t.direction.z);const n=e.userData.__parts;if(n)for(let s=0;s<n.segs.length;s++){const i=o.phase-s*1.1;n.segs[s].rotation.x=Math.sin(i)*.42,n.segs[s].position.y=Math.sin(i)*ee*.03}o.shed-=a,o.shed<=0&&(o.shed=.14+Math.random()*.08,wl(t,t.position.x,t.position.y,t.position.z,-t.direction.x*.5+(Math.random()-.5)*.6,-.05,-t.direction.z*.5+(Math.random()-.5)*.6,ee*.075,.28,t.color))},impact(t){const e=Ys(t.damage),a=t.direction,o=ta(a.x,a.z),{x:n,y:s,z:i}=t.position,r=new he;r.rotation.y=o,r.position.set(n+a.x*ee*.42,jt,i+a.z*ee*.42),r.renderOrder=5;const l=Fi();l.color.set(t.color),l.opacity=.95;const h=new M(Yt,l);h.scale.set(1.1,1,1.07),h.position.y=-.004,r.add(h);const c=Ci();c.color.set(Ba),c.opacity=.95,r.add(new M(Yt,c));const d=ee*.42*e,p=ee*.72*e;t.spawnTransient(r,.85,m=>{const f=1-Math.pow(1-Math.min(1,m*8),3);r.scale.set(d,1,Math.max(.02,p*f));const g=m<.55?1:1-(m-.55)/.45;c.opacity=.95*g,l.opacity=.95*g});const u=ee*.28*e;for(let m=0;m<4;m++){const f=m/4*Ct+Math.random()*.8,g=(1.7+Math.random()*1.2)*e;t4(t,n+Math.cos(f)*u,s,i+Math.sin(f)*u,Math.cos(f)*g,1.3+Math.random()*1.1,Math.sin(f)*g,ee*(.34+Math.random()*.16)*e,.42+Math.random()*.14,t.color)}for(let m=0;m<5;m++){const f=Math.random()*Ct;wl(t,n+Math.cos(f)*u*.8,s,i+Math.sin(f)*u*.8,Math.cos(f)*(1.6+Math.random()*1.4),1.2+Math.random(),Math.sin(f)*(1.6+Math.random()*1.4),ee*.085*e,.36,t.color)}},cast(t){const e=t.direction,a=ta(e.x,e.z),o=new he;o.rotation.y=a,o.position.copy(t.position),o.renderOrder=11;const n=Fi();n.color.set(t.color),n.opacity=1;const s=new M(Yt,n);s.scale.set(1.12,1,1.08),s.position.y=-ee*.006,o.add(s);const i=Ci();i.color.set(Ba),i.opacity=1,o.add(new M(Yt,i)),t.spawnTransient(o,.18,r=>{const l=1-Math.pow(1-r,2);o.scale.set(pi*(.5+l*.6),1,Am*(.25+l*.8)),o.position.set(t.position.x+e.x*l*ee*.16,t.position.y,t.position.z+e.z*l*ee*.16),i.opacity=1-r,n.opacity=1-r});for(let r=0;r<3;r++)wl(t,t.position.x,t.position.y,t.position.z,e.x*(1+Math.random())+(Math.random()-.5)*.7,.4+Math.random()*.4,e.z*(1+Math.random())+(Math.random()-.5)*.7,ee*.08,.28,t.color)}},Fish:{impact(t){const e=Ys(t.damage),a=t.direction,{x:o,y:n,z:s}=t.position,i=ta(a.x,a.z);Vs(t,o,n,s,i+Math.PI*.5,ee*.95*e,ee*.078,.28);const r=ee*.3*e;for(let l=0;l<5;l++){const h=l/5*Ct+Math.random()*.5;bl(t,o+Math.cos(h)*r,n,s+Math.sin(h)*r,h,(1.5+Math.random()*1)*e,ee*.16*e,ee*.3*e,.5+Math.random()*.16)}for(let l=0;l<8;l++){const h=Math.random()*Ct,c=(1.7+Math.random()*1.4)*e;so(t,o+Math.cos(h)*r*.85,n,s+Math.sin(h)*r*.85,Math.cos(h)*c,1.4+Math.random()*1.2,Math.sin(h)*c,At*(.85+Math.random()*.4)*e,.42+Math.random()*.14,Math.random()<.35)}},cast(t){const e=t.direction,a=ta(e.x,e.z);Vs(t,t.position.x,t.position.y,t.position.z,a+Math.PI*.42,ee*.5,ee*.062,.17);const o=(t.weapon.cone??150)*Math.PI/180;for(let n=0;n<3;n++){const s=(n-1)*o*.3,i=a+s;bl(t,t.position.x,t.position.y,t.position.z,Math.atan2(Math.sin(i),Math.cos(i))-Math.PI*.5,1.5+Math.random()*.7,ee*.12,ee*.22,.34)}}},Catch:{projectile(t){const e=hu(t.color);return e.position.copy(t.position),e.scale.setScalar(.6),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=gl(e),n=ml(t.weapon);o.phase+=a/n*Ct*1.1,o.grow=Math.min(1,o.grow+a/n),e.rotation.y=o.phase;const s=K.lerp(.6,1.28,1-Math.pow(1-o.grow,2));e.scale.setScalar(s),e.position.y+=Math.sin(o.phase*1.6)*ee*.02,o.shed-=a,o.shed<=0&&(o.shed=.1+Math.random()*.06,so(t,t.position.x,t.position.y,t.position.z,-t.direction.x*.6+(Math.random()-.5)*.8,.1,-t.direction.z*.6+(Math.random()-.5)*.8,At*.8,.32,Math.random()<.4))},impact(t){const e=Ys(t.damage),a=t.direction,{x:o,y:n,z:s}=t.position,r=ta(a.x,a.z)+Math.PI*.5;Vs(t,o,n,s,r,ee*1.12*e,ee*.085,.32);const l=ee*.25*e,h=ee*.26*e,c=new he;c.rotation.y=r,c.position.set(o,n-ee*.05,s),c.renderOrder=10;const d=Y5();d.color.set(Ba),d.opacity=1;const p=V5();p.color.set(ln),p.opacity=1;const u=K5();u.color.set(t.color),u.opacity=1;const m={wall:d,face:p,core:u},f=ru(l,h,m),g=ru(l,h,m);g.rotation.y=Math.PI,c.add(f,g);const w=ee*.185*e,b=ee*.4*e,y=n-ee*.05-(jt+l*.6);t.spawnTransient(c,.55,k=>{const T=1-Math.pow(1-k,2),v=K.lerp(w,b,T);f.position.x=v,g.position.x=-v,f.rotation.z=-T*.9,g.rotation.z=T*.9,c.position.y=n-ee*.05-y*T*T;const O=k<.6?1:1-(k-.6)/.4;d.opacity=O,p.opacity=O,u.opacity=O});const x=ee*.3*e;for(let k=0;k<9;k++){const T=k/9*Ct+Math.random()*.6,v=(1.9+Math.random()*1.5)*e;so(t,o+Math.cos(T)*x,n,s+Math.sin(T)*x,Math.cos(T)*v,1.6+Math.random()*1.3,Math.sin(T)*v,At*(.9+Math.random()*.5)*e,.46+Math.random()*.16,Math.random()<.35)}for(let k=0;k<2;k++){const T=r+(k===0?.6:-.6)+Math.PI*(k===0?0:1);bl(t,o+Math.cos(T)*x,n,s+Math.sin(T)*x,T,(1.6+Math.random()*.9)*e,ee*.14*e,ee*.26*e,.48)}},cast(t){const e=t.direction,a=ta(e.x,e.z);Vs(t,t.position.x,t.position.y,t.position.z,a+Math.PI*.38,ee*.58,ee*.068,.18);for(let o=0;o<5;o++)so(t,t.position.x,t.position.y,t.position.z,e.x*(1.3+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,e.z*(1.3+Math.random())+(Math.random()-.5)*.9,At*.8,.3,Math.random()<.4)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleSushiRoot";const n=t.position.clone();n.y-=ee*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=lu(t.color);s.name="teleSushiNori",cu(s,"teleSushiNori"),o.add(s);const i=Math.max(1,t.weapon.pellets??3),r=[];for(let p=0;p<i;p++){const u=hu(t.color);u.name=`teleSushiRoll${p}`,cu(u,`teleSushiRoll${p}`),r.push(u),o.add(u)}const l=(p,u,m)=>{const f=e.MathUtils.clamp((p-u)/(m-u),0,1);return f*f*(3-2*f)},h=(t.weapon.spreadDeg??40)*Math.PI/360,c=ee*.7,d=(p,u)=>{const m=e.MathUtils.clamp(u/a,0,1),f=l(m,0,.38),g=l(m,.88,1);s.position.set(Math.sin(m*3.1)*ee*.3,c+ee*(.7+.34*f),ee*(.1+.34*f)),s.rotation.set(-.95-.3*Math.sin(m*4.2),m*2.6,.35*Math.sin(m*3.4));const w=.85+.45*f;s.scale.set(w,1,w*(1+.25*Math.sin(m*5)));for(let b=0;b<i;b++){const y=r[b],x=b*.1,k=l(m,.15+x,.88),T=i===1?0:(b/(i-1)-.5)*2*h,v=b/i*Ct+m*(2.4+2*k),O=e.MathUtils.lerp(v,T,g),D=ee*(.62+.3*k+.34*g);y.position.set(Math.sin(O)*D,c+Math.sin(v*1.4)*ee*.14*(1-g)+ee*.16*k,Math.cos(O)*D*(.6+.4*g)),y.scale.setScalar(1.1+(Q5-1.1)*k),y.rotation.y=v*1.5}};d(0,0),t.spawnTransient(o,a+.06,d)}}};function wl(t,e,a,o,n,s,i,r,l,h){const c=new he,d=Fi();d.color.set(h),d.opacity=1;const p=new M(Yt,d);p.scale.set(r*1.3,1,r*.75),p.position.y=-ee*.005,c.add(p);const u=Ci();u.color.set(Ba),u.opacity=1;const m=new M(Yt,u);m.scale.set(r,1,r*.55),c.add(m),c.renderOrder=9,c.position.set(e,a,o),c.rotation.y=Math.random()*Ct;const f=(Math.random()-.5)*9,g=-5.2;t.spawnTransient(c,l,(w,b)=>{c.position.set(e+n*b,Math.max(jt,a+s*b+.5*g*b*b),o+i*b),c.rotation.y+=f*.016,u.opacity=1-w*w,d.opacity=1-w*w})}function t4(t,e,a,o,n,s,i,r,l,h){const c=new he,d=Fi();d.color.set(h),d.opacity=1;const p=new M(Yt,d);p.scale.set(ee*.075,1,r*1.03),p.position.y=-ee*.006,c.add(p);const u=Ci();u.color.set(Ba),u.opacity=1;const m=new M(Yt,u);m.scale.set(ee*.05,1,r),c.add(m),c.renderOrder=9,c.position.set(e,a,o);const f=-5.6,g=(Math.random()-.5)*4.5;t.spawnTransient(c,l,(w,b)=>{c.position.set(e+n*b,Math.max(jt,a+s*b+.5*f*b*b),o+i*b),c.rotation.y=ta(n,i)+g*b,c.scale.set(1+w*.5,1,1-w*.35),u.opacity=1-w*w,d.opacity=1-w*w})}function bl(t,e,a,o,n,s,i,r,l){const h=W5();h.color.set(fc),h.opacity=1;const c=G5();c.color.set(mc),c.opacity=1;const d=j5();d.color.set(Mm),d.opacity=1;const p=Z5(i,r,{face:h,deep:c,fat:d});p.renderOrder=9,p.position.set(e,a,o),p.rotation.y=n+Math.PI*.5;const u=Math.cos(n)*s,m=Math.sin(n)*s,f=.9+Math.random()*.7,g=-7.8,w=(Math.random()-.5)*2.2;t.spawnTransient(p,l,(b,y)=>{const x=a+f*y+.5*g*y*y,k=x<=jt;p.position.set(e+u*y,k?jt:x,o+m*y),p.rotation.y=n+Math.PI*.5+w*y;const T=1-Math.pow(b,2.4);h.opacity=T,c.opacity=T,d.opacity=T})}function a4(t){const e=t.replace("#","");return[0,2,4].map(a=>parseInt(e.slice(a,a+2),16)/255)}function o4(t){return`#${t.map(e=>Math.round(Math.max(0,Math.min(1,e))*255).toString(16).padStart(2,"0").toUpperCase()).join("")}`}function du(t){return .2126*t[0]+.7152*t[1]+.0722*t[2]}function n4([t,e,a]){const o=Math.max(t,e,a),n=Math.min(t,e,a),s=(o+n)/2,i=o-n;if(i===0)return[0,0,s];const r=s>.5?i/(2-o-n):i/(o+n);return[(o===t?(e-a)/i+(e<a?6:0):o===e?(a-t)/i+2:(t-e)/i+4)*60,r,s]}function pu([t,e,a]){const o=(t%360+360)%360/360,n=a<.5?a*(1+e):a+e-a*e,s=2*a-n,i=r=>{const l=(r+1)%1;return l<1/6?s+(n-s)*6*l:l<.5?n:l<2/3?s+(n-s)*(2/3-l)*6:s};return[i(o+1/3),i(o),i(o-1/3)]}function Fm(t,e,a,o){const n=a4(t),[s,i]=n4(n),r=du(n)+o,l=s+e,h=Math.max(0,Math.min(1,i+a));let c=0,d=1;for(let p=0;p<32;p++){const u=(c+d)/2;du(pu([l,h,u]))<r?c=u:d=u}return o4(pu([l,h,(c+d)/2]))}function Nm(t){const e=ie.soup.weapons.find(a=>a.key===t);if(!e)throw new Error(`soup vfx: no weapon '${t}' in CHARACTERS.soup.weapons`);return e.color}const dr=Nm("Splash"),pr=Fm(dr,7.1,.195,.196),ur=Fm(dr,-6.4,.07,-.212),s4="#FFF2E2",bc=Nm("Noodle"),le=ae,et=.27,Hn=le*.3,i4=le*.34,yl=le*.55,Mo=le*.042,it=le*.085,Vt=le*.4,r4=le*.024;function Lm(t){let e=t%2147483647;return e<=0&&(e+=2147483646),()=>(e=e*48271%2147483647,e/2147483647)}function xl(t,e){const o=Lm(t),n=o()*Math.PI*2,s=o()*Math.PI*2,i=o()*Math.PI*2,r=[];for(let u=0;u<e;u++)r.push([o()*Math.PI*2,.14+o()*.2,.16+o()*.14]);const l=[];let h=0;for(let u=0;u<=84;u++){const m=u/84*Math.PI*2;let f=1+.15*Math.sin(3*m+n)+.09*Math.sin(5*m+s)+.05*Math.sin(8*m+i);for(const[g,w,b]of r){let y=m-g;for(;y>Math.PI;)y-=Math.PI*2;for(;y<-Math.PI;)y+=Math.PI*2;f+=w*Math.exp(-(y*y)/(2*b*b))}l.push(f),f>h&&(h=f)}const c=new Float32Array(258);for(let u=0;u<=84;u++){const m=u/84*Math.PI*2,f=l[u]/h,g=(u+1)*3;c[g]=Math.cos(m)*f,c[g+1]=0,c[g+2]=Math.sin(m)*f}const d=[];for(let u=1;u<=84;u++)d.push(0,u+1,u);const p=new rs;return p.setAttribute("position",new Yn(c,3)),p.setIndex(d),p.computeVertexNormals(),p}const uu=[xl(9173,4),xl(48271,5),xl(11071,3)];let l4=0;const Dm=()=>uu[l4++%uu.length],ns=new pt(1,9,7);ns.scale(.78,.78,1.4);const yo=new pt(1,10,8),h4=new Re(1,.34,1,24,1,!0),c4=(()=>{const e=document.createElement("canvas");e.width=e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,0.95)"),o.addColorStop(.45,"rgba(255,255,255,0.52)"),o.addColorStop(.78,"rgba(255,255,255,0.14)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.colorSpace=is,n})();function vl(t){const e=Lm(t),a=1.1+e()*1.4,o=.9+e()*1.3,n=.13+e()*.11,s=.08+e()*.09,i=[],r=8;for(let l=0;l<r;l++){const h=l/(r-1);i.push(new pe(Math.sin(h*Math.PI*a+t)*n,Math.cos(h*Math.PI*o+t)*s,h-.5))}return new Wg(new Gg(i),20,r4/Vt,5,!1)}const fu=[vl(7919),vl(30011),vl(65449)];let d4=0;const yc=()=>fu[d4++%fu.length];function Mt(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const _t=(t,e)=>new X({color:t,transparent:!0,opacity:e,depthWrite:!1,side:ye}),Hm=Mt(10,()=>_t(ur,.9)),p4=Mt(10,()=>_t(pr,.9)),_m=Mt(28,()=>_t(dr,.95)),Ni=Mt(14,()=>_t(pr,.95)),u4=Mt(16,()=>_t(bc,1)),f4=Mt(6,()=>_t(ur,.85)),fh=Mt(6,()=>_t(dr,1)),m4=Mt(6,()=>_t(pr,1)),g4=Mt(12,()=>_t(bc,1)),w4=Mt(3,()=>_t(ur,.92)),b4=Mt(3,()=>_t(pr,.9)),y4=Mt(6,()=>_t(bc,1)),x4=Mt(16,()=>new Lt({map:c4,color:s4,transparent:!0,opacity:.5,depthWrite:!1})),v4=Mt(8,()=>new X({color:"#FFF4DF",transparent:!0,opacity:.9,depthWrite:!1,blending:tt})),Ks=new pe,k4=new pe(0,0,1);function Li(t,e,a,o){Ks.set(e,a,o),!(Ks.lengthSq()<1e-9)&&(Ks.normalize(),t.quaternion.setFromUnitVectors(k4,Ks))}function Ua(t,e,a,o,n,s,i,r,l,h=!1){const c=new M(ns,h?Ni():_m()),d=c.material,p=.95;d.opacity=p,c.position.set(e,a,o);const u=-9.4;t.spawnTransient(c,l,(m,f)=>{const g=a+s*f+.5*u*f*f,w=g<=et;c.position.set(e+n*f,w?et:g,o+i*f);const b=s+u*f;if(w)Li(c,n,0,i),c.scale.set(r*1.5,r*.3,r*1.7);else{Li(c,n,b,i);const y=Math.hypot(n,b,i),x=1+Math.min(.9,y*.075);c.scale.set(r/Math.sqrt(x),r/Math.sqrt(x),r*x)}d.opacity=p*(1-m*m)})}function Eo(t,e,a,o,n,s,i){const r=new ga(x4()),l=r.material;l.opacity=0;const h=(Math.random()-.5)*n*1.6,c=(Math.random()-.5)*n*1.6;r.renderOrder=9,r.position.set(e,a,o),r.scale.set(n*1.1,n*1.1,1),t.spawnTransient(r,i,d=>{const p=1-Math.pow(1-d,2);r.position.set(e+h*p,a+s*p,o+c*p);const u=n*(1.1+p*1.5);r.scale.set(u,u,1),l.opacity=.5*Math.sin(Math.min(1,d*1.3)*Math.PI)})}function xc(t,e,a,o,n){const s=Dm(),i=Math.random()*Math.PI*2,r=new M(s,Hm()),l=r.material;r.rotation.y=i,r.position.set(e,et,a),r.renderOrder=6,r.scale.setScalar(o*.35);const h=new M(s,p4()),c=h.material;h.rotation.y=i+.7,h.position.set(e,et+.01,a),h.renderOrder=7,h.scale.setScalar(o*.18);const d=p=>p<.34?1-Math.pow(1-p/.34,2.2):1;t.spawnTransient(r,n,p=>{r.scale.setScalar(o*K.lerp(.35,1,d(p))),l.opacity=.82*(1-Math.pow(p,1.5))}),t.spawnTransient(h,n*.86,p=>{h.scale.setScalar(o*K.lerp(.18,.62,d(p))),c.opacity=.9*(1-Math.pow(p,1.8))})}function M4(t,e,a,o,n){const s=new M(h4,f4()),i=s.material;i.color.set(ur),i.opacity=.85,s.rotation.y=Math.random()*Math.PI*2,s.renderOrder=8;const r=o*.78,l=h=>{const c=h<.5?1-Math.pow(1-h/.5,2.4):1,d=o*K.lerp(.24,1,c),p=r*K.lerp(1,.18,c);s.position.set(e,et+p*.5,a),s.scale.set(d,p,d),i.opacity=.85*(1-Math.pow(h,1.6))};l(0),t.spawnTransient(s,n,l)}function vc(t,e,a,o,n){const s=new M(yo,v4()),i=s.material;s.position.set(e,a,o),s.scale.set(n,n*.55,n),t.spawnTransient(s,.19,r=>{const l=n*K.lerp(.9,1.7,r);s.scale.set(l,l*.5,l),i.opacity=.9*(1-r)*(1-r)})}function Di(t,e,a,o,n,s,i,r,l){const h=new M(yc(),u4()),c=h.material;c.opacity=1,h.position.set(e,a,o),h.scale.setScalar(r);const d=-9.4,p=6+Math.random()*6,u=Math.atan2(n,i)+(Math.random()-.5)*.8;t.spawnTransient(h,l,(m,f)=>{const g=a+s*f+.5*d*f*f;g<=et+.02?(h.position.set(e+n*f,et+.02,o+i*f),h.quaternion.identity(),h.rotation.set(0,u,0),h.scale.set(r,r*.55,r)):(h.position.set(e+n*f,g,o+i*f),Li(h,n,s+d*f,i),h.rotateZ(f*p)),c.opacity=1-Math.pow(m,3)})}function E4(t){const e=new he,a=new M(ns,fh());a.material.color.set(t),a.scale.setScalar(it),a.position.z=it*.4,e.add(a);const o=new M(yo,m4());o.scale.setScalar(it*.5),o.position.set(it*.25,it*.4,it*.85),e.add(o);for(let n=0;n<2;n++){const s=new M(ns,fh());s.material.color.set(t);const i=it*(.44-n*.13);s.scale.setScalar(i),s.position.set((Math.random()-.5)*it*.5,(Math.random()-.5)*it*.4,-it*(1.05+n*.95)),e.add(s)}return e.userData.__head=a,e}const T4={projectile(t){const e=E4(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=(e.userData.__phase??Math.random()*6)+a*17;e.userData.__phase=o;const n=1+Math.sin(o)*.22;e.scale.set(1/Math.sqrt(n),1/Math.sqrt(n),n);const s=e.userData.__head;s&&(s.position.x=Math.sin(o*.55)*it*.3);const i=(e.userData.__drip??.04)-a;i<=0?(e.userData.__drip=.055+Math.random()*.045,Ua(t,t.position.x-t.direction.x*it*1.6,t.position.y-it*.4,t.position.z-t.direction.z*it*1.6,-t.direction.x*.5+(Math.random()-.5)*.5,-.3-Math.random()*.4,-t.direction.z*.5+(Math.random()-.5)*.5,Mo*(.5+Math.random()*.4),.3)):e.userData.__drip=i;const r=(e.userData.__steam??.09)-a;r<=0?(e.userData.__steam=.13+Math.random()*.09,Eo(t,t.position.x,t.position.y+it,t.position.z,le*.075,le*.14,.34)):e.userData.__steam=r},impact(t){const{x:e,z:a}=t.position,o=t.direction;let n=o.x,s=o.z;const i=Math.hypot(n,s);i<1e-4?(n=1,s=0):(n/=i,s/=i),vc(t,e,t.position.y*.55,a,le*.19);const r=Hn*.85;xc(t,e+n*r,a+s*r,Hn,.42),M4(t,e+n*r*.45,a+s*r*.45,Hn*1.15,.24);for(let l=0;l<7;l++){const h=l/7*Math.PI*2+Math.random()*.6,c=1.7+Math.random()*1.5;Ua(t,e+Math.cos(h)*Hn*.55,t.position.y*.5,a+Math.sin(h)*Hn*.55,Math.cos(h)*c+n*.9,2.1+Math.random()*1.2,Math.sin(h)*c+s*.9,Mo*(1+Math.random()*.7),.36+Math.random()*.12,l%3===0)}Eo(t,e+n*r*.6,et+le*.05,a+s*r*.6,le*.14,le*.3,.5)},cast(t){const e=t.direction,a=new M(ns,Ni()),o=a.material;a.position.copy(t.position),Li(a,e.x,-.25,e.z),t.spawnTransient(a,.16,n=>{a.position.set(t.position.x+e.x*n*le*.2,t.position.y-n*le*.07,t.position.z+e.z*n*le*.2);const s=le*(.05+n*.05);a.scale.set(s*1.5,s*.8,s*(1.6+n)),o.opacity=.95*(1-n*n)});for(let n=0;n<4;n++){const s=(Math.random()-.5)*.8,i=(Math.random()-.5)*.8;Ua(t,t.position.x,t.position.y,t.position.z,e.x*(1.6+Math.random())+s,.7+Math.random()*.9,e.z*(1.6+Math.random())+i,Mo*(.5+Math.random()*.4),.3)}Eo(t,t.position.x,t.position.y,t.position.z,le*.09,le*.2,.34)}};function S4(t){const e=new he,a=[];for(let n=0;n<3;n++){const s=new M(yc(),g4());s.material.color.set(t),s.scale.setScalar(Vt*.62),s.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),s.position.set((Math.random()-.5)*Vt*.22,(Math.random()-.5)*Vt*.22,(Math.random()-.5)*Vt*.22),e.add(s),a.push(s)}const o=new M(yo,fh());return o.scale.setScalar(it*.62),e.add(o),e.userData.__strands=a,e}const A4={projectile(t){const e=S4(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=e.userData.__strands;if(o)for(let s=0;s<o.length;s++){const i=o[s];i.rotation.x+=a*(3.4+s*1.7),i.rotation.z+=a*(2.1+s*1.1)}const n=(e.userData.__drip??.06)-a;n<=0?(e.userData.__drip=.085+Math.random()*.06,Ua(t,t.position.x,t.position.y-Vt*.2,t.position.z,(Math.random()-.5)*.7,-.2-Math.random()*.5,(Math.random()-.5)*.7,Mo*(.45+Math.random()*.35),.32)):e.userData.__drip=n},impact(t){const{x:e,z:a}=t.position;vc(t,e,t.position.y*.55,a,le*.18),xc(t,e,a,i4,.48);for(let o=0;o<5;o++){const n=o/5*Math.PI*2+Math.random()*.7,s=1.3+Math.random()*1.2;Di(t,e,t.position.y*.7,a,Math.cos(n)*s,1.5+Math.random()*1.1,Math.sin(n)*s,Vt*(.7+Math.random()*.45),.7+Math.random()*.15)}for(let o=0;o<4;o++){const n=Math.random()*Math.PI*2,s=1.2+Math.random()*1.3;Ua(t,e,t.position.y*.6,a,Math.cos(n)*s,1.8+Math.random()*1.1,Math.sin(n)*s,Mo*(.6+Math.random()*.5),.36,o===0)}Eo(t,e,et+le*.05,a,le*.15,le*.32,.55)},cast(t){const e=t.direction;Di(t,t.position.x,t.position.y,t.position.z,e.x*1.4,1.5,e.z*1.4,Vt*.7,.26);for(let a=0;a<3;a++)Ua(t,t.position.x,t.position.y,t.position.z,e.x*1.2+(Math.random()-.5)*.8,.9+Math.random()*.7,e.z*1.2+(Math.random()-.5)*.8,Mo*.55,.28)}},R4={cast(t){const e=t.direction,a=nt(t.weapon.range??uo.meleeHeavy),o=t.position.x,n=t.position.y,s=t.position.z,i=-e.z,r=e.x;for(let d=0;d<13;d++){const p=(d/12-.5)*2,u=p*a*.16+(Math.random()-.5)*a*.06,m=1.1+Math.random()*1.5-Math.abs(p)*.35,f=le*(.055+Math.random()*.055)*(1-Math.abs(p)*.25);Ua(t,o+i*u,n+le*(.05+Math.random()*.12),s+r*u,e.x*m+i*p*.35,.5+Math.random()*.7,e.z*m+r*p*.35,f,.42+Math.random()*.16,d%4===0)}for(let d=0;d<3;d++){const p=new M(yo,d===1?Ni():_m()),u=p.material,m=.35+d*.5,f=o+e.x*a*.1,g=s+e.z*a*.1,w=n+le*.1;p.position.set(f,w,g),t.spawnTransient(p,.4,y=>{const x=y*y;p.position.set(f+e.x*m*a*.28*y,Math.max(et,w-x*le*.8),g+e.z*m*a*.28*y),p.scale.set(le*(.13+y*.1),le*(.13-y*.09),le*(.13+y*.1)),u.opacity=.85*(1-Math.pow(y,1.7))})}for(let d=0;d<3;d++){const p=(d-1)*.5;Di(t,o+i*p*a*.1,n,s+r*p*a*.1,e.x*(1.6+Math.random())+i*p,.9+Math.random()*.6,e.z*(1.6+Math.random())+r*p,Vt*(.8+Math.random()*.4),.6)}const l=Dm(),h=new M(l,Hm()),c=h.material;h.position.set(o+e.x*a*.26,et,s+e.z*a*.26),h.rotation.y=Math.atan2(e.x,e.z),h.renderOrder=6,t.spawnTransient(h,.6,d=>{const p=d<.45?1-Math.pow(1-d/.45,2):1;h.scale.set(a*.13*p+.05,1,a*.3*p+.05),c.opacity=.8*(1-Math.pow(d,2.2))});for(let d=0;d<3;d++)Eo(t,o+e.x*a*(.12+d*.13),et+le*.06,s+e.z*a*(.12+d*.13),le*.16,le*.42,.6)},telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=new e.Group;o.name="teleSoupRoot";const n=t.position.clone();n.y-=le*.55,o.position.copy(n),o.rotation.y=Math.atan2(t.direction.x,t.direction.z);const s=new e.Group;s.name="teleSoupTilt",o.add(s);const i=w4(),r=new e.Mesh(yo,i);r.name="teleSoupBroth",s.add(r);const l=b4(),h=new e.Mesh(yo,l);h.name="teleSoupLip",s.add(h);const c=3,d=[];for(let f=0;f<c;f++){const g=new e.Mesh(yc(),y4());g.name=`teleSoupNoodle${f}`,d.push(g),s.add(g)}const p=(f,g,w)=>{const b=e.MathUtils.clamp((f-g)/(w-g),0,1);return b*b*(3-2*b)},u=le*.98,m=(f,g)=>{const w=e.MathUtils.clamp(g/a,0,1),b=p(w,0,.45),y=p(w,.25,.85),x=p(w,.85,1),k=le*(.45+.22*b),T=Math.sin(w*(7+9*y));r.position.set(Math.sin(w*(5+7*y))*le*.06*y,u+le*.1*b,le*.3*y),r.scale.set(k*(1+.1*T),k*(.72-.1*T),k),i.opacity=.8+.15*b;const v=k*(.48+.3*x);h.position.set(r.position.x,r.position.y+k*(.3-.34*x),r.position.z+k*(.42+.55*x)),h.scale.set(v,v*.55,v),l.opacity=.35+.6*x+.15*y;for(let O=0;O<c;O++){const D=d[O],_=O/c*Math.PI*2+w*3.4,E=p(w,.25+O*.08,.9),A=k*(.35+.75*E);D.position.set(r.position.x+Math.cos(_)*A,r.position.y+k*(.35+.45*E),r.position.z+Math.sin(_)*A*.7),D.scale.setScalar(Vt*(.5+.85*E)),D.rotation.set(_*1.3,w*4.1+O,_*.8),D.material.opacity=.55+.45*E}s.rotation.x=x*.75+y*.12};m(0,0),t.spawnTransient(o,a+.06,m)},impact(t){const{x:e,z:a}=t.position,o=new M(yo,Ni()),n=o.material;o.position.set(e,et,a),t.spawnTransient(o,.16,s=>{const i=1-Math.pow(1-s,2.6),r=le*K.lerp(.42,.05,i),l=le*K.lerp(.13,.4,i);o.position.set(e,et+r*.5,a),o.scale.set(l,r,l),n.opacity=.95*(1-Math.pow(s,2.5))}),vc(t,e,t.position.y*.5,a,le*.3),xc(t,e,a,yl,.62);for(let s=0;s<11;s++){const i=s/11*Math.PI*2+Math.random()*.5,r=2.2+Math.random()*2.2;Ua(t,e+Math.cos(i)*le*.12,et+le*.1,a+Math.sin(i)*le*.12,Math.cos(i)*r,2.6+Math.random()*1.8,Math.sin(i)*r,Mo*(.9+Math.random()*.8),.45+Math.random()*.15,s%3===0)}for(let s=0;s<4;s++){const i=s/4*Math.PI*2+Math.random(),r=1.5+Math.random()*1.3;Di(t,e,et+le*.15,a,Math.cos(i)*r,2+Math.random()*1.2,Math.sin(i)*r,Vt*(.85+Math.random()*.45),.85)}Eo(t,e,et+le*.05,a,le*.22,le*.6,.8);for(let s=0;s<3;s++){const i=s/3*Math.PI*2+Math.random();Eo(t,e+Math.cos(i)*yl*.55,et+le*.03,a+Math.sin(i)*yl*.55,le*.14,le*.4,.7)}}},I4={Splash:T4,Noodle:A4,Dump:R4},sa=.09,O4=ae*.075,C4=ae*.1,mu=wo*.5,kc=new jg(sa,0);kc.scale(.55,1.7,.55);const mh=new pt(sa*.24,6,6);function Za(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const zm=Za(24,()=>new X({color:"#BFEFFF",transparent:!0,opacity:.8,depthWrite:!1})),F4=Za(8,()=>new X({color:"#FFFFFF",transparent:!0,opacity:1,blending:tt,depthWrite:!1})),gu=Za(6,()=>new X({color:"#EAFBFF",transparent:!0,opacity:.95,blending:tt,depthWrite:!1}));function wu(t){const e=new he,a=4;for(let n=0;n<a;n++){const s=zm();s.color.set(t);const i=new M(kc,s),r=n/a*Math.PI*2;i.position.set(Math.cos(r)*sa*.5,(Math.random()-.5)*sa*.6,Math.sin(r)*sa*.5),i.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),i.scale.setScalar(.6+Math.random()*.5),e.add(i)}const o=new M(mh,F4());return e.add(o),e.userData.__glint=o,e}const Xs=ae*1,N4=new Re(.3,.36,.66,14,1,!1),L4=new pt(.3,14,8),D4=new Re(.15,.24,.16,12,1,!1),H4=new Re(.185,.185,.14,12,1,!1),_4=new Re(.26,.31,.6,12,1,!1),z4=new pt(ae*.09,7,6),P4=new Re(1,1,1,16,1,!0),bu=new $a(.72,1,28),$4=Za(8,()=>new X({color:"#7FD4F5",transparent:!0,opacity:.42,depthWrite:!1,side:ye})),B4=Za(4,()=>new X({color:"#BFEFFF",transparent:!0,opacity:.9,depthWrite:!1})),U4=Za(20,()=>new X({color:"#BFEFFF",transparent:!0,opacity:.9,depthWrite:!1})),q4=Za(6,()=>new X({color:"#1E90D8",transparent:!0,opacity:.95,depthWrite:!1})),kl=Za(8,()=>new X({color:"#8FD9F7",transparent:!0,opacity:.9,blending:tt,depthWrite:!1,side:ye}));function yu(t){const e=new he;e.name=t;const a=$4(),o=new M(N4,a);o.name=`${t}Body`,o.position.y=.33;const n=new M(L4,a);n.name=`${t}Shoulder`,n.position.y=.66,n.scale.set(1,.62,1);const s=new M(D4,a);s.name=`${t}Neck`,s.position.y=.8;const i=new M(_4,B4());i.name=`${t}Fill`,i.position.y=.3;const r=new M(H4,q4());return r.name=`${t}Cap`,r.position.y=.93,e.add(o,n,s,i,r),e.userData.__cap=r,e.userData.__fill=i,e}const W4={Mega:{telegraph(t){const e=t.THREE,a=Math.max(.2,(t.castMs??1100)/1e3),o=t.position.clone();o.y-=ae*.55;const n=new e.Group;n.name="megaTelegraph",n.position.copy(o);const s=yu("megaSelfBottle"),i=yu("megaCapBottle");n.add(s,i);const r=[],l=16;for(let g=0;g<l;g++){const w=new e.Mesh(z4,U4());w.name=`megaLaunchStreak${g}`,w.scale.set(.8,2.6,.8),r.push(w),n.add(w)}const h=new e.Mesh(bu,kl());h.name="megaMergeGlow",h.rotation.x=-Math.PI/2,h.visible=!1,n.add(h);const c=g=>g.userData.__cap,d=g=>g.userData.__fill,p=(g,w,b)=>{const y=e.MathUtils.clamp((g-w)/(b-w),0,1);return y*y*(3-2*y)},u=ae*.85,m=2.05,f=(g,w)=>{const b=e.MathUtils.clamp(w/a,0,1),y=p(b,0,.38),x=p(b,.22,.62),k=p(b,.55,.88),T=p(b,.88,1),v=u*y;s.position.set(0,v,0),s.rotation.z=.24+.09*Math.sin(b*7);const O=Xs*(.55+.45*y);s.scale.setScalar(O);for(let R=0;R<l;R++){const I=R/l*Math.PI*2,L=R%4*.06,B=e.MathUtils.clamp((b-L)/.5,0,1),H=r[R],j=wo*(.6+1.5*B);H.position.set(Math.cos(I)*j,ae*(.05+1.25*B),Math.sin(I)*j),H.scale.set(.8*(1-B*.4),2.6*(1-B*.5),.8*(1-B*.4)),H.material.opacity=.9*(1-B)*(1-k)}const D=c(s);D.position.y=.93+x*.55,D.visible=x<.98;const _=x>.02;if(i.visible=_,_){const R=Xs*(.06+.62*x);i.scale.setScalar(R);const I=wo*1.5*x*(1-k);i.position.set(I,v+O*.95+x*ae*.42,0),i.rotation.z=-.3-.1*Math.sin(b*6),c(i).visible=x>.5}if(k>0){const R=Xs*e.MathUtils.lerp(1,m,k);s.scale.setScalar(R),s.position.set(0,u+ae*.25*k,0),i.position.x*=1-k,i.position.y=s.position.y+R*.55,s.rotation.z=(.24+.09*Math.sin(b*7))*(1-k*.5);const I=Xs*e.MathUtils.lerp(.62,.02,k);i.scale.setScalar(Math.max(.001,I)),h.visible=k<.99,h.position.set(0,s.position.y+R*.45,0);const L=R*(.22+.3*k);h.scale.set(L,L,L),h.material.opacity=.75*Math.sin(Math.PI*k)}else h.visible=!1;const E=T*.85;n.rotation.z=-E*t.direction.x,n.rotation.x=E*t.direction.z;const A=d(s),C=.35+.65*b;A.scale.set(1,C,1),A.position.y=.3*C,A.material.opacity=.75+.25*T};f(0,0),t.spawnTransient(n,a+.06,f)},cast(t){const e=t.THREE,a=t.position.clone();a.y-=ae*.55;const o=new e.Mesh(P4,kl());o.name="megaPourColumn";const n=wo*1.35,s=ae*2.6;o.position.set(a.x,a.y+s*.5,a.z),o.scale.set(n,s,n),t.spawnTransient(o,.34,i=>{const r=Math.min(1,i*2.4),l=Math.max(0,(i-.42)/.58);o.position.y=a.y+s*.5*(1-.55*r),o.scale.set(n*(1+1.5*l),s*(1-.5*r),n*(1+1.5*l)),o.material.opacity=.85*(1-i*i)});for(let i=0;i<2;i++){const r=new e.Mesh(bu,kl());r.name=`megaPourRing${i}`,r.rotation.x=-Math.PI/2,r.position.set(a.x,a.y+.05+i*.03,a.z);const l=i*.09;t.spawnTransient(r,.42+l,h=>{const c=Math.max(0,(h*(.42+l)-l)/.42),d=wo*(.8+3.6*c);r.scale.set(d,d,d),r.material.opacity=.9*(1-c)})}}},Glass:{projectile(t){const e=wu(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=e.userData.__glint;let n=0;for(const s of e.children){if(s===o)continue;const i=2+n*.9;s.rotation.x+=a*i,s.rotation.y+=a*i*.75,n++}if(o){const s=o.material;s.opacity=Math.max(0,s.opacity-a*3.2);const i=(e.userData.__glintTimer??0)-a;i<=0?(e.userData.__glintTimer=.14+Math.random()*.3,s.opacity=1,o.position.set((Math.random()-.5)*sa,(Math.random()-.5)*sa,(Math.random()-.5)*sa)):e.userData.__glintTimer=i}},impact(t){const e=t.position,a=C4/sa,o=new M(mh,gu());o.position.copy(e),o.scale.setScalar(1.25*a),t.spawnTransient(o,.14,i=>{o.scale.setScalar(K.lerp(1.25,3,i)*a),o.material.opacity=.95*(1-i)});const n=K.clamp(1+t.damage*.06,1,2.4),s=11;for(let i=0;i<s;i++){const r=i/s*Math.PI*2+Math.random()*.5,l=(1.6+Math.random()*2.4)*n,h=zm();h.color.set(t.color);const c=new M(kc,h),d=(.42+Math.random()*.43)*a*n;c.scale.setScalar(d);const p=e.x+Math.cos(r)*mu,u=e.y,m=e.z+Math.sin(r)*mu;c.position.set(p,u,m);const f=1.1+Math.random()*1.6,g=-9,w=(Math.random()-.5)*22,b=(Math.random()-.5)*22;t.spawnTransient(c,.38+Math.random()*.2,(y,x)=>{c.position.set(p+Math.cos(r)*l*x,u+f*x+.5*g*x*x,m+Math.sin(r)*l*x),c.rotation.x=x*w,c.rotation.y=x*b,c.scale.setScalar(d*(1-y*.25)),c.material.opacity=.85*(1-y)})}},cast(t){const e=O4/sa,a=wu(t.color);a.position.copy(t.position),a.scale.setScalar(.35*e),t.spawnTransient(a,.16,n=>{const s=Math.min(1,n*2.2),i=n>.55?1-(n-.55)*2.2:1;a.scale.setScalar(K.clamp(.35+s*.75,.1,1.15)*e*Math.max(0,i)),a.rotation.y=n*5});const o=new M(mh,gu());o.position.copy(t.position),o.scale.setScalar(.8*e),t.spawnTransient(o,.12,n=>{o.scale.setScalar(K.lerp(.8,1.9,n)*e),o.material.opacity=.9*(1-n)})}}},hn=na.mustard,oa="#9A6410",Mc="#FFF2C0",Ec=na.ketchup,ua="#6E121D",gh="#FFC0AE",ui=na.bun,jn="#7A4A1E",wh="#F9E9C2",oe=ae,Wo=Math.PI*2,Hi=.28;function fr(t,e=8){const a=new Ah(t,e);return a.rotateX(-Math.PI/2),a}function Tc(t,e,a,o){const n=Math.max(2,a*2),s=new ja,i=l=>l%2===0?-o:o,r=l=>-t/2+l/n*t;s.moveTo(i(0)-e,r(0));for(let l=1;l<=n;l++)s.lineTo(i(l)-e,r(l));for(let l=n;l>=0;l--)s.lineTo(i(l)+e,r(l));return s.closePath(),s}function G4(t,e){const a=new ja;return a.moveTo(0,t),a.quadraticCurveTo(e,t*.45,e,0),a.quadraticCurveTo(e,-t*.45,0,-t),a.quadraticCurveTo(-e,-t*.45,-e,0),a.quadraticCurveTo(-e,t*.45,0,t),a}const ss=oe*.44,bh=oe*.065,j4=oe*.072,fa=oe*.26,zo=oe*.185,_i=fr(Tc(ss,bh,3,j4),1),zi=oe*.78,Pm=oe*.075,$m=(Pm+oe*.098)*2,Ml=(()=>{const t=fr(Tc(zi,Pm,3,oe*.098),1);return t.translate(0,0,zi/2),t})(),Ht=fr(G4(.5,.5),6),Y4=new Gi(oe*.024,0),xu=(()=>{const t=new Re(1,1,1,16,1,!0,0,Math.PI);return t.rotateZ(-Math.PI/2),t.rotateY(Math.PI/2),t})(),V4=(()=>{const t=new qa(2,1);return t.rotateX(-Math.PI/2),t})(),K4=fr(Tc(1,.14,4,.36),1);function Ja(t,e){const a=Array.from({length:t},e);let o=0;return()=>a[o++%t]}const Ho=t=>new X({color:t,side:ye}),X4=Ho(hn),vu=Ho(oa),Z4=Ho(Mc),J4=Ho(Ec),ku=Ho(ua),Q4=Ho(gh),bs=(t,e)=>new X({color:t,transparent:!0,opacity:e,side:ye,depthWrite:!1}),Pi=Ja(48,()=>bs(hn,1)),$i=Ja(48,()=>bs(oa,1)),Bm=Ja(20,()=>bs(Mc,1)),Mu=Ja(8,()=>new X({color:ui,transparent:!0,opacity:1,side:ye,depthWrite:!1})),Eu=Ja(8,()=>new X({color:jn,transparent:!0,opacity:1,side:ye,depthWrite:!1})),Tu=Ja(8,()=>bs(wh,1)),Su=Ja(8,()=>bs(hn,1)),eM=Ja(14,()=>new X({color:jn,transparent:!0,opacity:1,depthWrite:!1}));function Nt(t,e){return Math.atan2(t,e)}function Au(t){return t.range&&t.speed?t.range/t.speed:Oo.normal/1e3}function El(t){return K.clamp(.85+t*.035,.85,1.4)}function Ru(t){let e=t.userData.__hotdog;return e||(e={phase:Math.random()*Wo,shed:0},t.userData.__hotdog=e),e}function Na(t,e,a,o,n,s,i,r,l,h,c){const d=new he,p=$i();p.color.set(a),p.opacity=1;const u=new M(Ht,p);u.scale.set(1.34,1,1.14),u.position.y=-oe*.008,d.add(u);const m=Pi();m.color.set(e),m.opacity=1,d.add(new M(Ht,m)),d.renderOrder=9,d.position.set(o,n,s);const f=h*.45,g=-8.2;t.spawnTransient(d,c,(w,b)=>{const y=n+r*b+.5*g*b*b,x=y<=Hi;if(d.position.set(o+i*b,x?Hi:y,s+l*b),x)d.rotation.y=Nt(i,l),d.scale.set(f*1.5,1,h*.75);else{const T=r+g*b,v=Math.hypot(i,T,l),O=1+Math.min(.85,v*.07);d.rotation.y=Nt(i,l),d.scale.set(f/O,1,h*O)}const k=1-w*w;m.opacity=k,p.opacity=k})}function Iu(t,e,a,o,n,s){const i=t.direction,r=Math.hypot(i.x,i.z)>1e-4,l=r?oe*.36:0;fi(t,e,a,t.position.x-i.x*l,t.position.y,t.position.z-i.z*l,r?Nt(i.x,i.z)+Math.PI*.5:0,o,n,s,.45)}function fi(t,e,a,o,n,s,i,r,l,h,c,d=1,p="#FFF6DC"){const u=r/zi,m=l/$m,f=new he;f.rotation.y=i,f.position.set(o-Math.sin(i)*r*.5,n,s-Math.cos(i)*r*.5);const g=$i();g.color.set(a),g.opacity=d;const w=new M(Ml,g);w.scale.set(1.42,1,1.02),w.position.y=-oe*.009,f.add(w);const b=Pi();b.color.set(e),b.opacity=d,f.add(new M(Ml,b));const y=Bm();y.color.set(p),y.opacity=d;const x=new M(Ml,y);x.scale.set(.42,1,.985),x.position.y=oe*.006,f.add(x),t.spawnTransient(f,h,k=>{const T=1-Math.pow(1-Math.min(1,k*5.5),3);f.scale.set(m,1,Math.max(.02,u*T));const v=k<c?1:1-(k-c)/(1-c);b.opacity=d*v,g.opacity=d*v,y.opacity=d*v})}function tM(t){const e=new he,a=new M(_i,vu);a.scale.set(1.5,1,1.07),a.position.y=-oe*.012,e.add(a),e.add(new M(_i,t===hn?X4:Um(t)));const o=new M(Ht,vu);o.scale.set(bh*3.2,1,oe*.15),o.position.set(0,-oe*.012,ss*.46),e.add(o);const n=new M(Ht,Z4);return n.scale.set(bh*2.1,1,oe*.105),n.position.set(0,0,ss*.47),e.add(n),e}function aM(t){const e=new he,a=t===Ec?J4:Um(t),o=new M(Ht,ku);o.scale.set(zo*1.32,1,fa*1.12),o.position.y=-oe*.012,e.add(o);const n=new M(Ht,a);n.scale.set(zo,1,fa),e.add(n);const s=new M(Ht,Q4);s.scale.set(zo*.32,1,fa*.42),s.position.set(-zo*.2,oe*.004,fa*.16),e.add(s);const i=[];for(let l=0;l<3;l++){const h=new he,c=1-l*.24,d=new M(Ht,ku);d.scale.set(zo*.72*c*1.34,1,fa*.42*c*1.14),d.position.y=-oe*.012,h.add(d);const p=new M(Ht,a);p.scale.set(zo*.72*c,1,fa*.42*c),h.add(p),h.position.z=-fa*(.7+l*.46),e.add(h),i.push(h)}const r={tail:i};return e.userData.__parts=r,e}const Ou=new Map;function Um(t){let e=Ou.get(t);return e||(e=Ho(t),Ou.set(t,e)),e}function Zs(t,e,a){const o=new he,n=new M(xu,a.crust);n.scale.set(t*1.13,t*1.13,e*1.04),n.position.y=-t*.04,o.add(n);const s=new M(xu,a.bun);s.scale.set(t,t,e),o.add(s);const i=new M(V4,a.crumb);i.scale.set(t*.86,1,e*.92),i.position.y=-t*.34,o.add(i);const r=new M(K4,a.seam);return r.scale.set(t*1.3,1,e*.84),r.position.y=-t*.3,o.add(r),o}const oM={Mustard:{projectile(t){const e=tM(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Ru(e);o.phase+=a/Au(t.weapon)*Wo*3.2,e.rotation.y=Nt(t.direction.x,t.direction.z)+Math.sin(o.phase)*.16;const n=1+Math.sin(o.phase*1.7)*.13;e.scale.set(1/n,1,n),o.shed-=a,o.shed<=0&&(o.shed=.05+Math.random()*.03,Na(t,t.color,oa,t.position.x-t.direction.x*ss*.5,t.position.y,t.position.z-t.direction.z*ss*.5,-t.direction.x*(.6+Math.random()*.7)+(Math.random()-.5)*.9,.25+Math.random()*.45,-t.direction.z*(.6+Math.random()*.7)+(Math.random()-.5)*.9,oe*(.12+Math.random()*.06),.26+Math.random()*.12))},impact(t){const e=El(t.damage),a=t.direction,o=Nt(a.x,a.z)+Math.PI*.5;fi(t,t.color,oa,t.position.x,t.position.y,t.position.z,o,oe*1.045*e,oe*.3*e,.34,.5),Iu(t,Mc,oa,oe*.46*e,oe*.2*e,.19);const{x:n,y:s,z:i}=t.position,r=oe*.3*e;for(let l=0;l<8;l++){const h=l/8*Wo+Math.random()*.6,c=(2.1+Math.random()*1.5)*e;Na(t,t.color,oa,n+Math.cos(h)*r,s,i+Math.sin(h)*r,Math.cos(h)*c+t.direction.x*.7,1.7+Math.random()*1.2,Math.sin(h)*c+t.direction.z*.7,oe*(.14+Math.random()*.07)*e,.42+Math.random()*.14)}},cast(t){const e=t.direction,a=Nt(e.x,e.z),o=new he,n=$i();n.color.set(oa),n.opacity=1;const s=new M(_i,n);s.scale.set(1.5,1,1.08),s.position.y=-oe*.012,o.add(s);const i=Pi();i.color.set(t.color),i.opacity=1,o.add(new M(_i,i)),o.renderOrder=11,o.rotation.y=a;const r=t.position.x,l=t.position.z;t.spawnTransient(o,.16,h=>{const c=1-Math.pow(1-h,2);o.scale.set(.6+h*.3,1,.35+c*.85),o.position.set(r+e.x*c*oe*.16,t.position.y,l+e.z*c*oe*.16);const d=1-h;i.opacity=d,n.opacity=d});for(let h=0;h<4;h++)Na(t,t.color,oa,t.position.x,t.position.y,t.position.z,e.x*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,.4+Math.random()*.5,e.z*(1.4+Math.random()*1.1)+(Math.random()-.5)*.7,oe*(.12+Math.random()*.05),.3)}},Ketchup:{projectile(t){const e=aM(t.color);return e.position.copy(t.position),e},trail(t){const e=t.object;if(!e)return;const a=t.dt??0,o=Ru(e);o.phase+=a/Au(t.weapon)*Wo*2.4,e.rotation.y=Nt(t.direction.x,t.direction.z);const n=e.userData.__parts;if(n)for(let i=0;i<n.tail.length;i++){const r=n.tail[i],l=Math.sin(o.phase-(i+1)*.9);r.position.x=l*oe*.055*(i+1)*.55,r.rotation.y=l*.4}const s=1+Math.sin(o.phase*1.3)*.09;e.scale.set(s,1,1/s),o.shed-=a,o.shed<=0&&(o.shed=.09+Math.random()*.05,Na(t,t.color,ua,t.position.x-t.direction.x*fa*1.5,t.position.y,t.position.z-t.direction.z*fa*1.5,(Math.random()-.5)*.9,.1+Math.random()*.3,(Math.random()-.5)*.9,oe*(.11+Math.random()*.05),.24+Math.random()*.1))},impact(t){const e=El(t.damage),a=t.direction;fi(t,t.color,ua,t.position.x,t.position.y,t.position.z,Nt(a.x,a.z)+Math.PI*.5,oe*.78*e,oe*.36*e,.3,.45),Iu(t,gh,ua,oe*.4*e,oe*.2*e,.18),fi(t,t.color,ua,t.position.x+a.x*oe*.5,Hi,t.position.z+a.z*oe*.5,Nt(a.x,a.z),zi*e,$m*e,.8,.55,.95,gh);const{x:o,y:n,z:s}=t.position,i=oe*.29*e;for(let r=0;r<6;r++){const l=r/6*Wo+Math.random()*.7,h=(1.8+Math.random()*1.3)*e;Na(t,t.color,ua,o+Math.cos(l)*i,n,s+Math.sin(l)*i,Math.cos(l)*h+a.x*.6,1.5+Math.random()*1.1,Math.sin(l)*h+a.z*.6,oe*(.14+Math.random()*.07)*e,.44+Math.random()*.14)}},cast(t){const e=t.direction;for(let i=0;i<5;i++)Na(t,t.color,ua,t.position.x,t.position.y,t.position.z,e.x*(1+Math.random()*.9)+(Math.random()-.5)*.8,.3+Math.random()*.4,e.z*(1+Math.random()*.9)+(Math.random()-.5)*.8,oe*(.13+Math.random()*.05),.3);const a=new he,o=$i();o.color.set(ua),o.opacity=1;const n=new M(Ht,o);n.scale.set(1.3,1,1.16),n.position.y=-oe*.01,a.add(n);const s=Pi();s.color.set(t.color),s.opacity=1,a.add(new M(Ht,s)),a.renderOrder=11,a.rotation.y=Nt(e.x,e.z),a.position.copy(t.position),t.spawnTransient(a,.15,i=>{const r=K.lerp(oe*.06,oe*.24,1-Math.pow(1-i,2));a.scale.set(r*.55,1,r),a.position.set(t.position.x+e.x*i*oe*.14,t.position.y,t.position.z+e.z*i*oe*.14),s.opacity=1-i,o.opacity=1-i})}},Slash:{impact(t){const e=El(t.damage),a=t.direction,o=Nt(a.x,a.z),{x:n,y:s,z:i}=t.position,r=oe*.175*e,l=oe*.62*e,h=oe*.375*e,c=oe*.125*e,d=new he;d.rotation.y=o,d.position.set(n,s-oe*.06,i),d.renderOrder=10;const p=Mu();p.color.set(ui),p.opacity=1;const u=Tu();u.color.set(wh),u.opacity=1;const m=Su();m.color.set(t.color),m.opacity=1;const f=Eu();f.color.set(jn),f.opacity=1;const g={bun:p,crust:f,crumb:u,seam:m},w=Zs(r,l,g),b=Zs(r,l,g);d.add(w,b);const y=Bm();y.color.set("#FFF6DA"),y.opacity=0;const x=new M(Ht,y);x.scale.set(oe*.075,1,l*.92),x.position.y=r*.15,x.renderOrder=12,d.add(x);let k=!1;t.spawnTransient(d,.46,v=>{const O=Math.min(1,v/.35),D=1-Math.pow(1-O,3),_=v<=.35?D:D-(v-.35)/.65*.55,E=K.lerp(h,c,K.clamp(_,0,1));w.position.x=E,b.position.x=-E;const A=K.lerp(.55,.12,K.clamp(_,0,1));w.rotation.z=A,b.rotation.z=-A,y.opacity=v<.35?0:Math.max(0,1-(v-.35)/.2);const C=v<.6?1:1-(v-.6)/.4;if(p.opacity=C,f.opacity=C,u.opacity=C,m.opacity=C,!k&&v>=.35){k=!0;const R=-Math.sin(o),I=-Math.cos(o);for(let L=0;L<6;L++){const B=L%2===0?1:-1,H=L<4,j=(Math.random()-.5)*.8;Na(t,H?hn:Ec,H?oa:ua,n+R*B*c*1.2,s,i+I*B*c*1.2,R*B*(2.4+Math.random()*1.6)+a.x*j,1.6+Math.random()*1.3,I*B*(2.4+Math.random()*1.6)+a.z*j,oe*(.15+Math.random()*.07)*e,.4+Math.random()*.14)}}});const T=oe*.24*e;for(let v=0;v<6;v++){const O=Math.random()*Wo,D=(1.9+Math.random()*1.6)*e,_=eM();_.color.set(v%3===0?ui:jn),_.opacity=1;const E=new M(Y4,_);E.renderOrder=9;const A=n+Math.cos(O)*T,C=i+Math.sin(O)*T,R=Math.cos(O)*D,I=Math.sin(O)*D,L=1.7+Math.random()*1.3,B=(.8+Math.random()*.7)*e;E.scale.setScalar(B);const H=Math.random()*9-4.5,j=Math.random()*9-4.5;t.spawnTransient(E,.42+Math.random()*.14,(S,N)=>{E.position.set(A+R*N,Math.max(Hi,s+L*N-4.6*N*N),C+I*N),E.rotation.set(H*N,j*N,0),_.opacity=1-S*S})}},cast(t){const e=t.direction,a=Nt(e.x,e.z),o=.62,n=oe*.175*o,s=oe*.62*o,i=new he;i.rotation.y=a,i.position.copy(t.position),i.renderOrder=11;const r=Mu();r.color.set(ui),r.opacity=1;const l=Tu();l.color.set(wh),l.opacity=1;const h=Su();h.color.set(t.color),h.opacity=1;const c=Eu();c.color.set(jn),c.opacity=1;const d={bun:r,crust:c,crumb:l,seam:h},p=Zs(n,s,d),u=Zs(n,s,d);i.add(p,u),t.spawnTransient(i,.2,m=>{const f=1-Math.pow(1-m,2),g=K.lerp(oe*.06,oe*.2,f);p.position.x=g,u.position.x=-g,p.rotation.z=f*.6,u.rotation.z=-f*.6;const w=1-m;r.opacity=w,c.opacity=w,l.opacity=w,h.opacity=w});for(let m=0;m<3;m++)Na(t,hn,oa,t.position.x,t.position.y,t.position.z,e.x*(1.2+Math.random())+(Math.random()-.5)*.9,.5+Math.random()*.4,e.z*(1.2+Math.random())+(Math.random()-.5)*.9,oe*(.12+Math.random()*.05),.28)}}};function Pt(t,e){const a={};for(const[o,n]of Object.entries(e))n&&(a[`${t}.${o}`]=n);return a}const nM={...Pt("hamburger",Tx),...Pt("donut",Zx),...Pt("taco",wv),...Pt("burrito",Qv),...Pt("egg",Ok),...Pt("lollipop",u5),...Pt("pizza",D5),...Pt("sushi",e4),...Pt("soup",I4),...Pt("waterbottle",W4),...Pt("hotdog",oM)};function _n(t,e){return nM[`${t}.${e}`]}function pa(t){window.__vfxQaCounts??={cast:0,meleeArc:0,impact:0,death:0,heal:0,giantSlam:0,puddleSplash:0,coverScuff:0,castTelegraph:0},window.__vfxQaCounts[t]++}const Po=.5,sM=.3,mr=.3,iM=mr,rM=mr+.01,lM=0,co=nt(dt.pickupRadius),mo=co*.62,hM=mo*2.2,Cu=mo*.16,cM=.0042,dM=.0013,pM=dt.popMs*3,La=1.15,Tl=1.25,uM=.25,fM=0,io=mr+.02,Js=mr+.04,mM=ae,Fu=.85,Nu=.68,gM=4,wM=.7,bM=.92,yM=7,xM=.55,Lu=.6,Du=.32,Sl=new Kt("#F2F6FF"),vM=new Kt("#63A8E0"),kM=ae*.62,MM=ae*.66,EM=ae*.62,TM=.58,SM="#EAF4FF",AM="#1D2740",Hu=18,Bn=.8,Al=3,_u=["#F5475E","#F5C147","#47C4F5","#6BE05A","#B36BF5","#F58A47"],zu="#EF5B2E",RM=.62,IM=.28,Pu=.85,OM=.9,CM=1.15,FM=1.45,NM=2,$u=.3,Et=new Kt("#ffffff"),LM=new Kt("#241a33"),Bu=new Kt("#FFE79A"),Rl=Yg.clone().normalize(),DM=.38,HM=.45,_M=.995;function qm(t){if(t.userData.__fxShaded)return!1;const e=t.getAttribute("position");if(!e)return t.userData.__fxShaded=!0,!1;const a=t.getAttribute("normal"),o=e.count,n=new Float32Array(o*3);let s=!0;if(a&&a.count===o){let u=0,m=0,f=0;for(let g=0;g<o;g++)u+=a.getX(g),m+=a.getY(g),f+=a.getZ(g);s=Math.hypot(u/o,m/o,f/o)>=_M}t.computeBoundingSphere();const i=t.boundingSphere,r=i?i.center.x:0,l=i?i.center.y:0,h=i?i.center.z:0,c=Math.max(i?i.radius:1,1e-6);let d=0;for(let u=0;u<o;u++){const m=Math.min(1,Math.hypot(e.getX(u)-r,e.getY(u)-l,e.getZ(u)-h)/c),f=1-HM*m*m,g=s?1:1+DM*(a.getX(u)*Rl.x+a.getY(u)*Rl.y+a.getZ(u)*Rl.z),w=Math.max(0,g*f);n[u*3]=w,d+=w}const p=d>1e-9?o/d:1;for(let u=0;u<o;u++){const m=n[u*3]*p;n[u*3]=m,n[u*3+1]=m,n[u*3+2]=m}return t.setAttribute("color",new Yn(n,3)),t.userData.__fxShaded=!0,!0}function zM(t){const e=t;return e.vertexColors||e.map?!1:(e.vertexColors=!0,e.needsUpdate=!0,!0)}const PM=.62,$M=.3,Uu=new WeakMap;function qu(t){const e=t;if(!t.isMeshBasicMaterial||e.transparent||e.blending!==Kg||e.map)return null;const a=Uu.get(t);if(a)return a;const o=Je({color:e.color.clone(),roughness:$M,metalness:0,doubleSide:e.side===ye,emissive:e.color.clone().multiplyScalar(PM)});return o.depthWrite=e.depthWrite,o.depthTest=e.depthTest,o.vertexColors=e.vertexColors,Uu.set(t,o),o}function Wu(t){t.traverse(e=>{const a=e;if(!a.isMesh||a.isSprite)return;if(Array.isArray(a.material)){const n=a.material.map(s=>qu(s)??s);a.material=n;return}const o=qu(a.material);o&&(a.material=o)})}function Wm(t){t.traverse(e=>{const a=e;if(!a.isMesh)return;const o=Array.isArray(a.material)?a.material:[a.material];o.some(n=>n&&!n.map)&&qm(a.geometry);for(const n of o)n&&zM(n)})}const Gu=.55,BM=.34,UM=.72,qM=1,WM=.34,GM=1.1,jM=ae*.85,YM=.8,VM=12,KM=2,Il=.05,Da={scopes:0,inert:0,members:0,mats:0,opaqueSkipped:0,cores:0,coresStarved:0,aliasTouches:0};function XM(t){const e=[],a=new Set;return t.traverse(o=>{const s=o.material;if(!s)return;const i=Array.isArray(s)?s:[s];for(const r of i)if(r){if(!r.transparent){Da.opaqueSkipped++;continue}a.has(r.uuid)||(a.add(r.uuid),e.push(r))}}),Da.mats+=e.length,{mats:e}}function ZM(t,e){let a=0;e.set(0,0,0);const o=(n,s,i,r)=>{const l=s+n.position.x,h=i+n.position.y,c=r+n.position.z;if(!n.visible)return;const d=n;(d.isMesh||d.isSprite)&&(e.x+=l,e.y+=h,e.z+=c,a++);for(const p of n.children)o(p,l,h,c)};return o(t,0,0,0),a===0?!1:(e.multiplyScalar(1/a),!0)}function zn(t,e,a,o,n){const s=new Set;for(const i of a){s.add(i.id);let r=t.get(i.id);r||(r=o(i),Wm(r),e.add(r),t.set(i.id,r)),n(r,i)}for(const[i,r]of t)s.has(i)||(e.remove(r),t.delete(i))}function JM(t){return t.depthWrite=!1,t}const ju=t=>1-Math.pow(1-t,3);function Yu(t){const e=Math.sin(t*12.9898)*43758.5453;return(e-Math.floor(e))*Math.PI*2}function Ol(t,e){const a=Math.hypot(t,e);return a>1e-6?{x:t/a,y:e/a}:{x:0,y:0}}function QM(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.4,"rgba(255,255,255,0.85)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.needsUpdate=!0,n}function eE(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.14,"rgba(255,255,255,0.85)"),o.addColorStop(.32,"rgba(255,255,255,0.45)"),o.addColorStop(.55,"rgba(255,255,255,0.18)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.needsUpdate=!0,n}function tE(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=a.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.62,"rgba(255,255,255,1)"),o.addColorStop(.82,"rgba(255,255,255,0.6)"),o.addColorStop(1,"rgba(255,255,255,0)"),a.fillStyle=o,a.fillRect(0,0,64,64);const n=new st(e);return n.needsUpdate=!0,n}function aE(){const a=document.createElement("canvas");a.width=128,a.height=128;const o=a.getContext("2d"),n=o.createRadialGradient(64,64,0,64,64,128*.16);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.6,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,128);const s=8;for(let r=0;r<s;r++){const l=r%2===0,h=128*(l?.48:.26),c=128*(l?.045:.028),d=r/s*Math.PI*2;o.save(),o.translate(64,64),o.rotate(d);const p=o.createLinearGradient(0,0,h,0);p.addColorStop(0,"rgba(255,255,255,1)"),p.addColorStop(.7,"rgba(255,255,255,0.8)"),p.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=p,o.beginPath(),o.moveTo(0,-c),o.lineTo(h,0),o.lineTo(0,c),o.closePath(),o.fill(),o.restore()}const i=new st(a);return i.needsUpdate=!0,i}function oE(){const a=document.createElement("canvas");a.width=128,a.height=32;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,128,0);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.5,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=n,o.fillRect(0,0,128,32),o.globalCompositeOperation="destination-in";const s=o.createLinearGradient(0,0,0,32);s.addColorStop(0,"rgba(255,255,255,0)"),s.addColorStop(.5,"rgba(255,255,255,1)"),s.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=s,o.fillRect(0,0,128,32),o.globalCompositeOperation="source-over";const i=new st(a);return i.needsUpdate=!0,i}function nE(){const a=document.createElement("canvas");a.width=8,a.height=64;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,0,64);n.addColorStop(0,"rgba(255,255,255,0.1)"),n.addColorStop(.55,"rgba(255,255,255,0.55)"),n.addColorStop(.86,"rgba(255,255,255,0.85)"),n.addColorStop(.94,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0.65)"),o.fillStyle=n,o.fillRect(0,0,8,64);const s=new st(a);return s.flipY=!1,s.needsUpdate=!0,s}function sE(){const a=document.createElement("canvas");a.width=8,a.height=128;const o=a.getContext("2d"),n=o.createLinearGradient(0,0,0,128);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.78,"rgba(255,255,255,0)"),n.addColorStop(.88,"rgba(255,255,255,0.85)"),n.addColorStop(.94,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0.75)"),o.fillStyle=n,o.fillRect(0,0,8,128);const s=new st(a);return s.flipY=!1,s.needsUpdate=!0,s}function Bi(t){const e=t.replace("#","");return[parseInt(e.slice(0,2),16),parseInt(e.slice(2,4),16),parseInt(e.slice(4,6),16)]}const Ui=t=>t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4),iE=t=>t<=.0031308?t*12.92:1.055*Math.pow(t,1/2.4)-.055,rE=42,lE=.7,Vu=.66;function Sc(t){const[e,a,o]=Bi(t).map(y=>y/255),n=Math.max(e,a,o),s=Math.min(e,a,o),i=(n+s)/2,r=n-s,l=r===0?0:r/(1-Math.abs(2*i-1));let h=0;r!==0&&(n===e?h=60*((a-o)/r%6):n===a?h=60*((o-e)/r+2):h=60*((e-a)/r+4)),h<0&&(h+=360);let c=rE-h;c>180&&(c-=360),c<-180&&(c+=360);const d=(h+c*lE+360)%360,p=(1-Math.abs(2*Vu-1))*l,u=p*(1-Math.abs(d/60%2-1)),m=Vu-p/2,f=Math.floor(d/60)%6,w=[[p,u,0],[u,p,0],[0,p,u],[0,u,p],[u,0,p],[p,0,u]][f].map((y,x)=>Math.max(y+m,[e,a,o][x])),b=y=>Math.round(Math.min(1,y)*255).toString(16).padStart(2,"0");return`#${b(w[0])}${b(w[1])}${b(w[2])}`}function Ku(t,e){const a=/rgb\((\d+),(\d+),(\d+)\)/.exec(po(t,e)),o=Bi(Sc(t)).map(s=>Ui(s/255)),n=[1,2,3].map(s=>Ui(Number(a[s])/255));return .2126*o[0]*n[0]+.7152*o[1]*n[1]+.0722*o[2]*n[2]}const Xu="#F5475E";function $o(t,e){if(t===Xu)return e;const a=Ku(Xu,e);let o=0,n=2;for(let s=0;s<28;s++){const i=(o+n)/2;Ku(t,i)<a?o=i:n=i}return(o+n)/2}function po(t,e){const a=Bi(t).map(r=>Ui(r/255)),o=Bi(Sc(t)).map(r=>Ui(r/255)),n=a.map((r,l)=>r/Math.max(1e-6,o[l])),s=Math.max(0,Math.min(1,e-1)),i=n.map(r=>Math.round(255*iE(e<=1?r*Math.max(0,e):r+(1-r)*s)));return`rgb(${i[0]},${i[1]},${i[2]})`}function hE(t,e){const n=document.createElement("canvas");n.width=128,n.height=128;const s=n.getContext("2d"),i=document.createElement("canvas");i.width=128,i.height=128;const r=i.getContext("2d"),l=v=>{const O=Math.round(255*v);return`rgb(${O},${O},${O})`},h=1.9*t,c=3.3*t+.7,d=v=>64*(Bn+.13*Math.sin(v*3+h)+.06*Math.sin(v*5+c)),p=v=>{v.beginPath();const O=96;for(let D=0;D<=O;D++){const _=D/O*Math.PI*2,E=d(_),A=64+Math.cos(_)*E,C=64+Math.sin(_)*E;D===0?v.moveTo(A,C):v.lineTo(A,C)}v.closePath()},u=()=>p(s);u();const m=s.createLinearGradient(128*.18,128*.12,128*.86,128*.92);m.addColorStop(0,po(e,$o(e,FM))),m.addColorStop(.5,po(e,$o(e,CM))),m.addColorStop(1,po(e,$o(e,OM))),s.fillStyle=m,s.fill(),p(r),r.fillStyle=l(RM),r.fill(),s.save(),u(),s.clip(),r.save(),p(r),r.clip();const f=.45,g=1/Math.sqrt(.5+.5*f*f),w=(v,O,D,_,E)=>{const A=64+v*128,C=64+O*128,R=D*128*g,I=(H,j)=>{const S=H.createRadialGradient(A,C,0,A,C,R),N=q=>`rgba(${j[0]},${j[1]},${j[2]},${q})`;S.addColorStop(0,N(1)),S.addColorStop(f,N(1)),S.addColorStop(1,N(0)),H.fillStyle=S,H.beginPath(),H.arc(A,C,R,0,Math.PI*2),H.fill()},L=/rgb\((\d+),(\d+),(\d+)\)/.exec(_);I(s,[Number(L[1]),Number(L[2]),Number(L[3])]);const B=Math.round(255*E);I(r,[B,B,B])},b=t*1.7;for(let v=0;v<7;v++){const O=b+v*2.399963,D=.075+.215*Math.sqrt((v+.55)/7),_=.08-.005*v,E=NM-.055*v;w(Math.cos(O)*D,Math.sin(O)*D,_,po(e,$o(e,E)),IM)}w(-.06+.05*t,.2,.075,po(e,$o(e,$u)),Pu),w(.2-.04*t,-.17,.055,po(e,$o(e,$u*.85)),Pu),s.restore(),r.restore();const y=s.getImageData(0,0,128,128),x=y.data,k=r.getImageData(0,0,128,128).data;for(let v=0;v<x.length;v+=4){const O=x[v+3];if(O===0){x[v]=0,x[v+1]=0,x[v+2]=0;continue}const D=O/255;x[v]=Math.round(x[v]*D),x[v+1]=Math.round(x[v+1]*D),x[v+2]=Math.round(x[v+2]*D),x[v+3]=Math.round(k[v]*D)}s.putImageData(y,0,0);const T=new st(n);return T.colorSpace=is,T.needsUpdate=!0,T}const cE=.26,dE=2.4,pE=1.65,Zu=.36,uE=.64,fE=.66,mE=.4,gE=.78,wE=1.25,bE=6;function yE(){const e=document.createElement("canvas");e.width=128,e.height=128;const a=e.getContext("2d"),o=a.createRadialGradient(128/2,128/2,0,128/2,128/2,128/2);o.addColorStop(0,"rgba(255,255,255,0.22)"),o.addColorStop(.44,"rgba(255,255,255,0.34)"),o.addColorStop(.62,"rgba(255,255,255,0.78)"),o.addColorStop(.82,"rgba(255,255,255,0.90)"),o.addColorStop(.88,"rgba(70,70,70,0.86)"),o.addColorStop(.96,"rgba(48,48,48,0.55)"),o.addColorStop(1,"rgba(40,40,40,0)"),a.fillStyle=o,a.fillRect(0,0,128,128);const n=new st(e);return n.needsUpdate=!0,n}function xE(t){const e=/^#?([0-9a-f]{6})$/i.exec(t.trim());if(!e)return t;const a=parseInt(e[1],16),o=(a>>16&255)/255,n=(a>>8&255)/255,s=(a&255)/255,i=Math.max(o,n,s),r=Math.min(o,n,s),l=i-r;let h=0;l>1e-6&&(i===o?h=(n-s)/l%6:i===n?h=(s-o)/l+2:h=(o-n)/l+4,h*=60,h<0&&(h+=360));const c=(i+r)/2,d=l<1e-6?0:l/(1-Math.abs(2*c-1)),p=c>=gE?mE:Math.max(c,fE),u=Math.min(1,d*wE),m=(1-Math.abs(2*p-1))*u,f=m*(1-Math.abs(h/60%2-1)),g=p-m/2;let w=0,b=0,y=0;h<60?(w=m,b=f):h<120?(w=f,b=m):h<180?(b=m,y=f):h<240?(b=f,y=m):h<300?(w=f,y=m):(w=m,y=f);const x=k=>Math.round((k+g)*255).toString(16).padStart(2,"0");return`#${x(w)}${x(b)}${x(y)}`}function vE(){const e=document.createElement("canvas");e.width=64,e.height=64;const a=e.getContext("2d"),o=[[.5,.02],[.78,.32],[.68,.98],[.32,.98],[.22,.32],[.5,.02]];a.beginPath(),o.forEach(([i,r],l)=>{const h=i*64,c=r*64;l===0?a.moveTo(h,c):a.lineTo(h,c)}),a.closePath();const n=a.createLinearGradient(64*.3,0,64*.6,64);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.45,"rgba(255,255,255,0.85)"),n.addColorStop(1,"rgba(255,255,255,0.55)"),a.fillStyle=n,a.fill(),a.beginPath(),a.moveTo(64*.5,64*.05),a.lineTo(64*.62,64*.34),a.lineTo(64*.5,64*.5),a.lineTo(64*.4,64*.3),a.closePath(),a.fillStyle="rgba(255,255,255,0.9)",a.fill();const s=new st(e);return s.needsUpdate=!0,s}function kE(t,e,a,o){const n=[],s=[],i=Math.PI*2/a,r=i*o,l=6;let h=0;for(let d=0;d<a;d++){const p=d*i;for(let u=0;u<=l;u++){const m=p+u/l*r;n.push(Math.sin(m)*t,0,Math.cos(m)*t),n.push(Math.sin(m)*e,0,Math.cos(m)*e)}for(let u=0;u<l;u++){const m=h+u*2;s.push(m,m+1,m+2,m+1,m+3,m+2)}h+=(l+1)*2}const c=new rs;return c.setAttribute("position",new yi(n,3)),c.setIndex(s),c.computeVertexNormals(),c}function Cl(t,e){const a=K.degToRad(K.clamp(e,1,360))/2,o=Math.max(8,Math.round(e/8)),n=[0,0,0],s=[.5,0];for(let l=0;l<=o;l++){const h=-a+l/o*a*2;n.push(Math.sin(h)*t,0,Math.cos(h)*t),s.push(l/o,1)}const i=[];for(let l=1;l<o+1;l++)i.push(0,l,l+1);const r=new rs;return r.setAttribute("position",new yi(n,3)),r.setAttribute("uv",new yi(s,2)),r.setIndex(i),r.computeVertexNormals(),r}function ME(t,e=8,a=.45){const o=e*2,n=[0,0,0];for(let r=0;r<=o;r++){const l=r/o*Math.PI*2,h=r%2===0?t:t*a;n.push(Math.sin(l)*h,0,Math.cos(l)*h)}const s=[];for(let r=1;r<o+1;r++)s.push(0,r,r+1);const i=new rs;return i.setAttribute("position",new yi(n,3)),i.setIndex(s),i.computeVertexNormals(),i}const EE=96,TE=10,SE=16,Ju=.09,Qu=.2;function e0(t,e,a){const o=t.clone().convertLinearToSRGB(),n=e.clone().convertLinearToSRGB();return o.lerp(n,a).convertSRGBToLinear()}function AE(t,e){return t.clone().convertLinearToSRGB().multiplyScalar(e).convertSRGBToLinear()}function Fl(t){t.traverse(e=>{const a=e.material;if(a)for(const o of Array.isArray(a)?a:[a])o.userData?.__ownMat&&o.dispose()})}class RE{group=new he;projectilePool=new Map;shellPool=new Map;splatPool=new Map;trailPool=new Map;medikitPool=new Map;materialCache=new Map;transientEffects=[];unionScopes=[];pendingUnion=null;unionCores=[];unionMemberState=new WeakMap;unionMatState=new WeakMap;unionFrame=0;unionPointScratch=new pe;unionCentreScratch=new pe;unionDistScratch=[];unionSortScratch=[];castTelegraphs=new Map;lastSyncElapsedMs=0;projectileGeo=new pt(nt(10),10,8);splatGeo=new qa(2*nt($l)/Bn,2*nt($l)/Bn);trailGeo=new qa(2*nt(qt.radius)/Bn,2*nt(qt.radius)/Bn);medikitBodyGeo=new xt(co,mo,co);medikitArmXGeo=new xt(co*.66,mo*.16,co*.24);medikitArmZGeo=new xt(co*.24,mo*.16,co*.66);medikitBodyMat=Je({color:"#FBFDFF",roughness:.42});medikitCrossMat=Je({color:"#FF2F45",roughness:.38,emissive:"#7A0A16",emissiveIntensity:.55});glazeTexByColor=new Map;glazeTexFor(e){let a=this.glazeTexByColor.get(e);return a||(a=Array.from({length:Al},(o,n)=>hE(n,e)),this.glazeTexByColor.set(e,a)),a}haloTex=yE();haloMats=new Map;shellBox=new Vn;shellSize=new pe;splatMats=this.glazeTexFor(zu).map(e=>this.groundMarkMat(zu,e));trailMats=[];trailMatsFor(e){let a=this.trailMats[e];if(!a){const o=_u[e]??_u[0];a=this.glazeTexFor(o).map(n=>this.groundMarkMat(o,n)),this.trailMats[e]=a}return a}groundMarkMat(e,a){const o=JM(Vg(Sc(e),{transparent:!0,opacity:1}));return o.userData.markColor=e,o.map=a,o.blending=u0,o.blendEquation=gi,o.blendSrc=Pl,o.blendDst=qc,o.blendEquationAlpha=gi,o.blendSrcAlpha=Pl,o.blendDstAlpha=qc,o.needsUpdate=!0,o}glowTex=QM();coreTex=eE();softDiscTex=tE();starTex=aE();streakTex=oE();shardTex=vE();wedgeGradientTex=nE();telegraphRimTex=sE();particles=[];wedges=[];rings=[];wedgeGeoCache=new Map;ringUnitGeo=new $a(.62,1,40);wardGeo=kE(wM,bM,yM,xM);statusBySlot=[];buildStatusVisual;ensureSlots(e){for(;this.statusBySlot.length<e;)this.statusBySlot.push(this.buildStatusVisual()),this.slowSplashState.push({lastX:NaN,lastY:NaN,distAccum:0}),this.statusSnapshot.push({x:NaN,y:NaN,stunReady:!0,slowReady:!0})}slowSplashState=[];statusSnapshot=[];constructor(e){this.group.name="vfx_layer",e.add(this.group);for(let o=0;o<EE;o++){const n=new Lt({map:this.glowTex,color:16777215,transparent:!0,opacity:0,depthWrite:!1,blending:tt}),s=new ga(n);s.visible=!1,s.renderOrder=10,this.group.add(s),this.particles.push({sprite:s,mat:n,active:!1,life:0,maxLife:1,vx:0,vy:0,vz:0,gravity:0,startScale:1,endScale:1,startOpacity:1,endOpacity:0,fadeEase:1,aspect:1})}for(let o=0;o<VM;o++){const n=new Lt({map:this.coreTex,color:16777215,transparent:!0,opacity:0,depthWrite:!1,depthTest:!1,blending:tt}),s=new ga(n);s.name="vfx_union_core",s.visible=!1,s.renderOrder=9,this.group.add(s),this.unionCores.push({sprite:s,mat:n,busy:!1})}for(let o=0;o<TE;o++){const n=new X({color:16777215,map:this.wedgeGradientTex,transparent:!0,opacity:0,side:ye,depthWrite:!1}),s=new M(Cl(.01,10),n);s.visible=!1,s.renderOrder=5,this.group.add(s),this.wedges.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startOpacity:.6})}for(let o=0;o<SE;o++){const n=new X({color:16777215,transparent:!0,opacity:0,side:ye,depthWrite:!1,blending:tt}),s=new M(this.ringUnitGeo,n);s.rotation.x=-Math.PI/2,s.visible=!1,s.renderOrder=6,this.group.add(s),this.rings.push({mesh:s,mat:n,active:!1,life:0,maxLife:1,startScale:.1,targetScale:1,startOpacity:.9})}const a=()=>{const o=new X({color:AM,transparent:!0,opacity:0,side:ye,depthWrite:!1}),n=new M(new $a(.55,.95,28),o);n.rotation.x=-Math.PI/2,n.visible=!1,n.renderOrder=3,this.group.add(n);const s=new X({color:SM,transparent:!0,opacity:0,side:ye,depthWrite:!1}),i=new M(new $a(.64,.86,28),s);i.rotation.x=-Math.PI/2,i.visible=!1,i.renderOrder=4,this.group.add(i);const r=new Lt({map:this.softDiscTex,color:vM,transparent:!0,opacity:0,depthTest:!1,depthWrite:!1}),l=new ga(r);l.scale.set(kM,MM,1),l.visible=!1,l.renderOrder=8,this.group.add(l);const h=[];for(let p=0;p<gM;p++){const u=new Lt({map:this.starTex,color:"#FFE75E",transparent:!0,opacity:0,depthWrite:!1,blending:tt}),m=new ga(u);m.scale.set(Nu,Nu,1),m.visible=!1,m.renderOrder=11,this.group.add(m),h.push(m)}const c=new X({color:Sl,transparent:!0,opacity:0,side:ye,depthWrite:!1}),d=new M(this.wardGeo,c);return d.visible=!1,d.renderOrder=2,this.group.add(d),{slowRing:i,slowRingDark:n,slowTint:l,stunStars:h,wardRing:d,wardMat:c,wardPop:0,wardPopColor:new Kt(Sl)}};this.buildStatusVisual=a,this.ensureSlots(2),window.__vfxSpawnTest=(o,n,s,i=14,r="#FFC93C",l,h,c)=>{const d=l??"hamburger",p=h?ie[d]?.weapons?.find(u=>u.key===h):void 0;if(o==="impact")this.spawnImpactBurst(n,s,r,i,p?{weapon:p,characterId:d,fromXWU:n-60,fromYWU:s}:void 0);else if(o==="death")this.spawnDeathBurst(n,s,r);else if(o==="heal")this.spawnHealPulse(n,s);else if(o==="puddleSplash"){const u=_e(n,s);this.spawnPuddleSplash(u.x,u.z)}else if(o==="meleeArc")this.spawnMeleeArc(n,s,{x:1,y:0},p?.range??70,p?.cone??80,p?.color??r);else if(o==="giantSlam")this.spawnGiantSlamShockwave(n,s,p?.color??r,p?.range??uo.ultimateSlam);else if(o==="coverScuff")this.spawnCoverScuff(n,s,p?.color??r,1,0);else if(o==="castTelegraph"){const u=p??{key:"qa",name:"qa",type:"melee",range:84,cone:100,damage:i,cooldown:1,color:r,effect:null},m=c??u.castMs??1100;this.spawnCastTelegraph(0,n,s,{x:1,y:0},u,d,m)}else if(o==="weaponFired"){const u=p??{key:"qa",name:"qa",type:"ranged",range:100,damage:i,cooldown:1,color:r,effect:null};this.spawnWeaponCast(n,s,{x:1,y:0},u,d)}else{const u=p??{key:"qa",name:"qa",type:"ranged",range:100,damage:i,cooldown:1,color:r,effect:null};this.spawnCastFlash(n,s,{x:1,y:0},u,d)}},window.__vfxLayer=this}sync(e){const a=qe(e);this.ensureSlots(a.length);const o=s=>({x:s.x,y:s.y,hp:s.hp,alive:s.alive,terrainSlowFactor:s.terrainSlowFactor});window.__vfxDebugFighters={player:o(a[0]),enemy:o(a[1]??a[0]),slots:a.map(o)};const n=Math.max(0,(e.elapsed-this.lastSyncElapsedMs)/1e3);this.lastSyncElapsedMs=e.elapsed,zn(this.projectilePool,this.group,e.projectiles,s=>{const i=vt(e,s.ownerId,s.ownerRole),r=_n(i.characterId,s.weapon.key);if(r?.projectile){const h=_e(s.x,s.y),c=Ol(s.vx,s.vy),d={THREE:En,position:new pe(h.x,Po,h.z),direction:new pe(c.x,0,c.y),color:s.color,damage:s.damage,weapon:s.weapon,characterId:i.characterId,spawnTransient:(u,m,f)=>this.spawnTransientObject(u,m,f)},p=r.projectile(d);return Wu(p),p.userData.weaponVfx=r,p.name=`projectile:${i.characterId}.${s.weapon.key}`,this.measureShell(p),p}const l=new M(this.projectileGeo,this.materialFor(s.color));return l.name=`projectile:${i.characterId}.${s.weapon.key}`,this.measureShell(l),l},(s,i)=>{const r=vt(e,i.ownerId,i.ownerRole),l=s.userData.weaponVfx,h=_e(i.x,i.y),c=s.userData.shellSpec?.scale??1;if(!l){const u=s;if(u.material=this.materialFor(i.color),i.arrived){const m=(i.peckTimer??0)/500,f=1+Math.sin(m*Math.PI)*.5;u.scale.setScalar(f*c)}else u.scale.setScalar(c);u.position.set(h.x,Po,h.z);return}s.position.set(h.x,Po,h.z);const d=Ol(i.vx,i.vy);(d.x!==0||d.y!==0)&&(s.rotation.y=Math.atan2(d.x,d.y));const p=s.userData.__authoredScale??=s.scale.clone();if(s.scale.copy(p),l.trail){const u={THREE:En,position:s.position.clone(),direction:new pe(d.x,0,d.y),color:i.color,damage:i.damage,weapon:i.weapon,characterId:r.characterId,spawnTransient:(m,f,g)=>this.spawnTransientObject(m,f,g),object:s,dt:n};l.trail(u)}p.copy(s.scale),s.scale.multiplyScalar(c)}),zn(this.shellPool,this.group,e.projectiles,s=>{const r=`${vt(e,s.ownerId,s.ownerRole).characterId}.${s.weapon.key}`,h=this.projectilePool.get(s.id)?.userData.shellSpec?.haloR??Zu,c=new he;c.name=`projectile_shell:${r}`;let d=this.haloMats.get(s.color);d||(d=new Lt({map:this.haloTex,color:new Kt(xE(s.color)),transparent:!0,opacity:1,depthWrite:!1}),this.haloMats.set(s.color,d));const p=new ga(d);return p.name=`projectile_halo:${r}`,p.scale.set(h*2,h*2,1),p.renderOrder=bE,c.add(p),c},(s,i)=>{const r=_e(i.x,i.y);s.position.set(r.x,Po,r.z)}),zn(this.splatPool,this.group,e.splats,s=>{const i=new M(this.splatGeo,this.splatMats[s.id%Al]);return i.name="vfx_ground_mark",i.rotation.set(-Math.PI/2,0,Yu(s.id)),i},(s,i)=>{const r=_e(i.x,i.y);s.position.set(r.x,iM,r.z)}),zn(this.medikitPool,this.group,e.medikits,()=>{const s=new he;s.name="vfx_medikit";const i=new M(this.medikitBodyGeo,this.medikitBodyMat);i.name="vfx_medikit_body",s.add(i);for(const r of[this.medikitArmXGeo,this.medikitArmZGeo]){const l=new M(r,this.medikitCrossMat);l.name="vfx_medikit_cross",l.position.y=mo*.5,s.add(l)}return s},(s,i)=>{const r=_e(i.x,i.y),l=lM+mo*.5+Cu,h=i.armsAt-e.elapsed;if(h>0){const d=_e(i.fromX,i.fromY),p=1-h/dt.popMs;s.position.set(d.x+(r.x-d.x)*p,l+4*hM*p*(1-p),d.z+(r.z-d.z)*p),s.rotation.set(Math.PI*2*p,Math.PI*3*p,0)}else{const d=e.elapsed-i.armsAt;s.position.set(r.x,l+Math.sin(d*cM)*Cu,r.z),s.rotation.set(0,d*dM,0)}const c=i.expiresAt-e.elapsed;s.scale.setScalar(c<pM&&c>0?1+Math.sin(c*.03)*.14:1)}),zn(this.trailPool,this.group,e.trailMarks,s=>{const i=new M(this.trailGeo,this.trailMatsFor(Wt(s.ownerId,s.ownerRole))[s.id%Al]);return i.name="vfx_ground_mark",i.rotation.set(-Math.PI/2,0,Yu(s.id)),i},(s,i)=>{const r=_e(i.x,i.y),l=(e.elapsed+i.id*137)*.004,h=1+Math.sin(l)*.08;s.position.set(r.x,rM,r.z),s.scale.setScalar(h)}),a.forEach((s,i)=>{const r=this.statusBySlot[i];if(!r)return;const l=_e(s.x,s.y),h=s.alive&&s.terrainSlowFactor<1,c=s.alive&&e.elapsed<s.status.slowedUntil,d=h||c;if(r.slowRing.visible=d,r.slowRingDark.visible=d,r.slowTint.visible=d,d){const x=.9+Math.sin(e.elapsed*.0035)*.12,k=e.elapsed*.0012;r.slowRingDark.position.set(l.x,Js-.01,l.z),r.slowRingDark.scale.setScalar(x),r.slowRingDark.rotation.z=k,r.slowRingDark.material.opacity=.5,r.slowRing.position.set(l.x,Js,l.z),r.slowRing.scale.setScalar(x),r.slowRing.rotation.z=k,r.slowRing.material.opacity=.9,r.slowTint.position.set(l.x,EM,l.z);const T=TM+Math.sin(e.elapsed*.006)*.08;r.slowTint.material.opacity=T}const p=this.slowSplashState[i];if(h){if(Number.isFinite(p.lastX))for(p.distAccum+=Math.hypot(s.x-p.lastX,s.y-p.lastY);p.distAccum>=Hu;)p.distAccum-=Hu,this.spawnPuddleSplash(l.x,l.z)}else p.distAccum=0;p.lastX=s.x,p.lastY=s.y;const u=e.elapsed>=Ri(s,"stun"),m=e.elapsed>=Ri(s,"slow");this.statusSnapshot[i]={x:s.x,y:s.y,stunReady:u,slowReady:m};const f=s.alive&&!u&&e.elapsed>=s.status.stunnedUntil,g=s.alive&&!m&&e.elapsed>=s.status.slowedUntil,w=f||g,b=r.wardPop>0?r.wardPop/Du:0;r.wardRing.visible=w||b>0,r.wardRing.visible&&(r.wardRing.position.set(l.x,Js-.02,l.z),r.wardRing.rotation.y=-e.elapsed*.0019,r.wardRing.scale.setScalar(1+.5*b),r.wardMat.opacity=w?Lu+(1-Lu)*b:b,r.wardMat.color.copy(Sl).lerp(r.wardPopColor,b));const y=s.alive&&e.elapsed<s.status.stunnedUntil;r.stunStars.forEach((x,k)=>{if(x.visible=y,!y)return;const T=e.elapsed*.006+k*Math.PI*2/r.stunStars.length;x.position.set(l.x+Math.cos(T)*Fu,mM+Math.sin(e.elapsed*.01+k)*.05,l.z+Math.sin(T)*Fu),x.material.opacity=.95})})}updateEffects(e){for(const a of this.particles){if(!a.active)continue;if(a.life+=e,a.life>=a.maxLife){a.active=!1,a.sprite.visible=!1;continue}const o=a.life/a.maxLife;a.vy+=a.gravity*e,a.sprite.position.x+=a.vx*e,a.sprite.position.y+=a.vy*e,a.sprite.position.z+=a.vz*e;const n=K.lerp(a.startScale,a.endScale,ju(o));a.sprite.scale.set(n,n*a.aspect,1),a.mat.opacity=Math.max(0,K.lerp(a.startOpacity,a.endOpacity,Math.pow(o,a.fadeEase)))}for(const a of this.wedges){if(!a.active)continue;if(a.life+=e,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife;a.mat.opacity=a.startOpacity*(1-Math.pow(o,1.8))}for(const a of this.rings){if(!a.active)continue;if(a.life+=e,a.life>=a.maxLife){a.active=!1,a.mesh.visible=!1;continue}const o=a.life/a.maxLife,n=K.lerp(a.startScale,a.targetScale,ju(o));a.mesh.scale.set(n,n,n),a.mat.opacity=a.startOpacity*(1-o)}for(const a of this.statusBySlot)a.wardPop>0&&(a.wardPop=Math.max(0,a.wardPop-e));for(let a=this.transientEffects.length-1;a>=0;a--){const o=this.transientEffects[a];if(o.life+=e,o.life>=o.maxLife){this.group.remove(o.object),Fl(o.object),o.telegraphOwner!==void 0&&this.castTelegraphs.get(o.telegraphOwner)===o.object&&this.castTelegraphs.delete(o.telegraphOwner),this.detachUnionMember(o),this.transientEffects.splice(a,1);continue}o.onUpdate?.(o.life/o.maxLife,o.life)}this.updateUnionScopes(e)}spawnTransientObject(e,a,o,n){Wm(e),Wu(e),this.group.add(e);const s=this.pendingUnion;s&&(s.members.push(e),this.unionMemberState.set(e,XM(e)),s.maxLife=Math.max(s.maxLife,Math.max(.001,a)),Da.members++),this.transientEffects.push({object:e,life:0,maxLife:Math.max(.001,a),onUpdate:o,telegraphOwner:n,union:s??void 0})}openUnionScope(e,a){this.pendingUnion={cx:e.x,cy:La,cz:e.z,members:[],life:0,maxLife:0,core:null,color:a}}closeUnionScope(){const e=this.pendingUnion;if(this.pendingUnion=null,!e)return;if(Da.scopes++,e.members.length<KM){Da.inert++;return}const a=this.unionCores.find(o=>!o.busy)??null;a?(a.busy=!0,a.sprite.visible=!0,a.sprite.position.set(e.cx,e.cy,e.cz),a.sprite.scale.set(Il,Il,1),a.mat.color.set(e.color).lerp(Et,UM),a.mat.opacity=0,e.core=a,Da.cores++):Da.coresStarved++,this.unionScopes.push(e)}detachUnionMember(e){if(!e.union)return;const a=e.union.members.indexOf(e.object);a>=0&&e.union.members.splice(a,1)}releaseUnionCore(e){e.core&&(e.core.busy=!1,e.core.sprite.visible=!1,e.core.mat.opacity=0,e.core=null)}updateUnionScopes(e){this.unionFrame++;for(let a=this.unionScopes.length-1;a>=0;a--){const o=this.unionScopes[a];if(o.life+=e,o.members.length===0||o.life>=o.maxLife){this.releaseUnionCore(o),this.unionScopes.splice(a,1);continue}const n=this.unionDistScratch;n.length=0;for(const p of o.members){if(!ZM(p,this.unionPointScratch)){n.push(-1);continue}n.push(this.unionPointScratch.distanceTo(this.unionCentreScratch.set(o.cx,o.cy,o.cz)))}const s=this.unionSortScratch;s.length=0;for(const p of n)p>=0&&s.push(p);if(s.length===0)continue;s.sort((p,u)=>p-u);const i=s[Math.min(s.length-1,Math.floor(s.length*YM))],r=K.clamp(i,Il,jM);let l=0,h=0;for(let p=0;p<o.members.length;p++){const u=n[p];if(u<0)continue;const m=this.unionMemberState.get(o.members[p]);if(!m||m.mats.length===0)continue;const f=Math.min(1,u/r);l+=1-Gu*f*f,h++}if(h===0)continue;const c=l>1e-9?h/l:1;for(let p=0;p<o.members.length;p++){const u=n[p];if(u<0)continue;const m=this.unionMemberState.get(o.members[p]);if(!m||m.mats.length===0)continue;const f=Math.min(1,u/r),g=(1-Gu*f*f)*c;for(const w of m.mats){const b=w.opacity;let y=this.unionMatState.get(w);y||(y={frame:-1,base:b,written:NaN},this.unionMatState.set(w,y)),y.frame!==this.unionFrame?(y.base=y.written===b?y.base:b,y.frame=this.unionFrame):Da.aliasTouches++;const x=Math.min(1,y.base*g);y.written=x,w.opacity=x}}const d=o.core;if(d){const p=Math.min(1,o.life/WM),u=2*r*BM;d.sprite.position.set(o.cx,o.cy,o.cz),d.sprite.scale.set(u,u,1),d.mat.opacity=qM*Math.pow(1-p,GM),p>=1&&this.releaseUnionCore(o)}}}spawnCastTelegraph(e,a,o,n,s,i,r){if(!(r>0))return;const l=s.range??0;if(!(l>0))return;pa("castTelegraph"),this.cancelCastTelegraph(e,"resolved");const h=_e(a,o),c=s.type==="melee"?s.cone??360:Math.max(12,s.spreadDeg??18),d=nt(l),p=_n(i,s.key)?.telegraph,u=s.giantSlam!==!0;if(!u&&!p)return;const m=`${Math.round(c)}_${d.toFixed(3)}`;let f=this.wedgeGeoCache.get(m);f||(f=Cl(d,c),this.wedgeGeoCache.set(m,f));const g=new Kt(s.color),w=Math.atan2(n.x,n.y),b=(C,R,I,L,B)=>{const H=new X({color:R,map:B?this.telegraphRimTex:null,transparent:!0,opacity:0,depthWrite:!1,side:ye});H.userData.__ownMat=!0;const j=new M(f,H);return j.name=C,j.rotation.y=w,j.position.set(0,I,0),j.renderOrder=L,j},y=new he;y.name="castTelegraph",y.position.set(h.x,io,h.z);const x=u?b("castTelegraphBase",AE(g,.26),0,5,!1):null,k=u?b("castTelegraphFill",e0(g,Et,.22),.012,5.01,!1):null,T=u?b("castTelegraphRim",e0(g,Et,.6),.024,5.02,!0):null;x&&k&&T&&y.add(x,k,T);const v=r/1e3,O=x?.material,D=k?.material,_=T?.material;this.castTelegraphs.set(e,y);const E=(C,R)=>{if(!x||!k||!T||!O||!D||!_)return;const I=K.clamp(R/v,0,1),L=R<=v?1:Math.max(0,1-(R-v)/Ju),B=.5+.5*Math.sin(Math.PI*2*(2*I+3*I*I));O.opacity=(.6+.14*B)*L;const H=.1+.9*I;k.scale.set(H,1,H),D.opacity=(.7+.22*I)*L,_.opacity=(.62+.36*I*I)*L};if(E(0,0),this.spawnTransientObject(y,v+Ju,E,e),!p)return;const A={THREE:En,position:new pe(h.x,Tl,h.z),direction:new pe(n.x,0,n.y).normalize(),color:s.color,damage:s.damage,weapon:s,characterId:i,castMs:r,spawnTransient:(C,R,I)=>this.spawnTransientObject(C,R,I,e)};p(A)}cancelCastTelegraph(e,a){const o=this.castTelegraphs.get(e);if(o){this.castTelegraphs.delete(e);for(let n=this.transientEffects.length-1;n>=0;n--){const s=this.transientEffects[n];if(s.telegraphOwner===e){if(s.object===o&&a!=="resolved"){const i=s.life,r=o.children.map(l=>l.material.opacity);s.maxLife=i+Qu,s.onUpdate=(l,h)=>{const c=K.clamp((h-i)/Qu,0,1),d=Math.max(.001,1-c);o.scale.set(d,1,d);for(let p=0;p<o.children.length;p++){const u=o.children[p].material;u.opacity=r[p]*(1-c)}};continue}this.group.remove(s.object),Fl(s.object),this.detachUnionMember(s),this.transientEffects.splice(n,1)}}}}spawnWeaponCast(e,a,o,n,s){const i=!!_n(s,n.key)?.cast;this.spawnCastFlash(e,a,o,n,s),n.type==="melee"&&(n.giantSlam&&i||this.spawnMeleeArc(e,a,o,n.range??0,n.cone??360,n.color)),n.giantSlam&&this.spawnGiantSlamShockwave(e,a,n.color,n.range??0,{bespokeOwnsGround:i})}spawnCastFlash(e,a,o,n,s){pa("cast");const i=_e(e,a),r=Math.hypot(o.x,o.y)||1,l=o.x/r,h=o.y/r,c=.7,d=n.color,p=_n(s,n.key)?.cast;if(this.castMuzzle(i.x+l*c,i.z+h*c,d,p?"subordinate":"primary"),!p)return;const u={THREE:En,position:new pe(i.x+l*c,Tl,i.z+h*c),direction:new pe(l,0,h),color:d,damage:n.damage,weapon:n,characterId:s,spawnTransient:(m,f,g)=>this.spawnTransientObject(m,f,g)};p(u)}castMuzzle(e,a,o,n){const s=n==="primary"?1:.75,i=this.allocParticle();i.active=!0,i.life=0,i.maxLife=n==="primary"?.16:.13,i.sprite.visible=!0,i.sprite.position.set(e,Tl,a),i.vx=0,i.vy=0,i.vz=0,i.gravity=0,i.startScale=.75*s,i.endScale=1.3*s,i.startOpacity=1,i.endOpacity=0,i.fadeEase=1.6,i.mat.color.set(o).lerp(Et,.4)}spawnMeleeArc(e,a,o,n,s,i){pa("meleeArc");const r=_e(e,a),l=nt(n),h=`${Math.round(s)}_${l.toFixed(3)}`;let c=this.wedgeGeoCache.get(h);c||(c=Cl(l,s),this.wedgeGeoCache.set(h,c));const d=this.allocWedge();d.active=!0,d.life=0,d.maxLife=.3,d.startOpacity=.88,d.mesh.visible=!0,d.mesh.geometry=c,d.mesh.rotation.y=Math.atan2(o.x,o.y),d.mesh.position.set(r.x,io,r.z),d.mat.color.set(i).lerp(LM,.14),d.mat.opacity=d.startOpacity}spawnImpactStarDecal(e,a,o,n){const s=`star_${o.toFixed(3)}`;let i=this.wedgeGeoCache.get(s);i||(i=ME(o,8,.42),this.wedgeGeoCache.set(s,i));const r=this.allocWedge();r.active=!0,r.life=0,r.maxLife=n,r.startOpacity=.9,r.mesh.visible=!0,r.mesh.geometry=i,r.mesh.rotation.y=Math.random()*Math.PI*2,r.mesh.position.set(e.x,io+.03,e.z),r.mat.map=null,qm(i),r.mat.vertexColors,r.mat.vertexColors=!0,r.mat.needsUpdate=!0,r.mat.color.set(a).lerp(Et,.05),r.mat.opacity=r.startOpacity}spawnImpactBurst(e,a,o,n,s){pa("impact");const i=_e(e,a);(s?.weapon.effect==="stun"||s?.weapon.effect==="slow")&&this.flagStatusRefused(e,a,s.weapon.effect,s.weapon.color);const r=s&&_n(s.characterId,s.weapon.key)?.impact;if(this.impactAnchor(i,o,n,r?"subordinate":"primary"),r&&s){let l=0,h=0;if(s.fromXWU!==void 0&&s.fromYWU!==void 0){const d=Ol(e-s.fromXWU,a-s.fromYWU);l=d.x,h=d.y}const c={THREE:En,position:new pe(i.x,La,i.z),direction:new pe(l,0,h),color:o,damage:n,weapon:s.weapon,characterId:s.characterId,spawnTransient:(d,p,u)=>this.spawnTransientObject(d,p,u)};this.openUnionScope(i,o);try{r(c)}finally{this.closeUnionScope()}}}impactAnchor(e,a,o,n){const s=n==="primary"?1:uM,i=K.clamp(.42+o*.075,.42,2)*s,r=Math.max(2,Math.round(K.clamp(1+o*.4,2,8)*s));if(n==="primary"){this.burst(e,a,i,r);return}this.burst(e,a,i,0,{skipFlash:!0,skipStreaks:!0,decalMinRadius:fM})}flagStatusRefused(e,a,o,n){for(let s=0;s<this.statusSnapshot.length;s++){const i=this.statusSnapshot[s];if(!Number.isFinite(i.x)||Math.hypot(i.x-e,i.y-a)>1)continue;if(o==="stun"?i.stunReady:i.slowReady)return;const l=this.statusBySlot[s];if(l){l.wardPop=Du,l.wardPopColor.set(n).lerp(Et,.35);return}}}spawnDeathBurst(e,a,o){pa("death");const n=_e(e,a);this.burst(n,o,2.6,9,{life:1.35})}spawnHealPulse(e,a){pa("heal");const o=_e(e,a),n=7;for(let s=0;s<n;s++){const i=this.allocParticle(),r=s/n*Math.PI*2+Math.random()*.5,l=.66+Math.random()*.3;i.active=!0,i.life=0,i.maxLife=.72+Math.random()*.22,i.sprite.visible=!0,i.sprite.position.set(o.x+Math.cos(r)*l,ae*.22,o.z+Math.sin(r)*l),i.vx=Math.cos(r)*.22,i.vz=Math.sin(r)*.22,i.vy=2+Math.random()*.45,i.gravity=-.45,i.startScale=.46+Math.random()*.14,i.endScale=.14,i.startOpacity=.95,i.endOpacity=0,i.fadeEase=1,i.mat.color.set("#6FE0A8")}}spawnPuddleSplash(e,a){pa("puddleSplash");const o=5;for(let n=0;n<o;n++){const s=this.allocParticle(),i=n/o*Math.PI*2+Math.random()*1,r=wo*(.58+Math.random()*.16);s.active=!0,s.life=0,s.maxLife=.3+Math.random()*.12,s.sprite.visible=!0,s.sprite.position.set(e+Math.cos(i)*r,Js,a+Math.sin(i)*r);const l=2.2+Math.random()*.6;s.vx=Math.cos(i)*l,s.vz=Math.sin(i)*l,s.vy=1.1+Math.random()*.5,s.gravity=-5.5,s.startScale=.58+Math.random()*.2,s.endScale=.12,s.startOpacity=1,s.endOpacity=0,s.fadeEase=1,s.mat.color.set("#E8F8FF")}}spawnCoverScuff(e,a,o,n,s){pa("coverScuff");const i=_e(e,a),r=Math.hypot(n,s),l=r>1e-4?-n/r:0,h=r>1e-4?-s/r:-1,c=this.allocParticle();c.active=!0,c.life=0,c.maxLife=.12,c.sprite.visible=!0,c.sprite.position.set(i.x,Po,i.z),c.vx=0,c.vy=0,c.vz=0,c.gravity=0,c.startScale=.42,c.endScale=.85,c.startOpacity=1,c.endOpacity=0,c.fadeEase=1.4,c.mat.color.set(o).lerp(Et,.6);for(let d=0;d<5;d++){const p=(Math.random()-.5)*(Math.PI*2/3),u=Math.cos(p),m=Math.sin(p),f=l*u-h*m,g=l*m+h*u,w=this.allocParticle();w.mat.map=this.streakTex,w.mat.rotation=Math.atan2(g,f),w.aspect=.22,w.active=!0,w.life=0,w.maxLife=.22+Math.random()*.1,w.sprite.visible=!0,w.sprite.position.set(i.x+l*.22,Po,i.z+h*.22),w.vx=f*(2.4+Math.random()*1.6),w.vz=g*(2.4+Math.random()*1.6),w.vy=.9+Math.random()*.7,w.gravity=-7.5,w.startScale=.62+Math.random()*.28,w.endScale=.12,w.startOpacity=1,w.endOpacity=0,w.fadeEase=1.2,w.mat.color.set(Bu)}}spawnGiantSlamShockwave(e,a,o,n,s){pa("giantSlam");const i=_e(e,a),r=nt(n);if(!(s?.bespokeOwnsGround??!1)){const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=.65,h.startScale=.3,h.targetScale=r*1.05,h.startOpacity=1,h.mesh.visible=!0,h.mesh.position.set(i.x,io+.02,i.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(o).lerp(Et,.3),h.mat.opacity=h.startOpacity;const c=this.allocRing();c.active=!0,c.life=0,c.maxLife=.8,c.startScale=.15,c.targetScale=r*.85,c.startOpacity=.6,c.mesh.visible=!0,c.mesh.position.set(i.x,io+.01,i.z),c.mesh.scale.setScalar(c.startScale),c.mat.color.set(o),c.mat.opacity=c.startOpacity,this.spawnStarPop(i,La*1.5,o,5.2,.38);const d=this.allocParticle();d.active=!0,d.life=0,d.maxLife=.3,d.sprite.visible=!0,d.sprite.position.set(i.x,La*1.5,i.z),d.vx=0,d.vy=0,d.vz=0,d.gravity=0,d.startScale=1.8,d.endScale=3.5,d.startOpacity=.9,d.endOpacity=0,d.fadeEase=1.2,d.mat.color.set(o).lerp(Et,.4),this.spawnStreaks(i,La*.6,"#FFE79A",10,4.5,.55)}this.burst(i,o,3.2,14,{life:.9,speedMult:1.7,skipFlash:!0,skipRing:!0,skipStreaks:!0,skipDecal:!0})}burst(e,a,o,n,s){const i=s?.life??1,r=s?.speedMult??1;if(s?.skipDecal||this.spawnImpactStarDecal(e,a,K.clamp(.65*o,s?.decalMinRadius??.55,1.5),(.55+o*.08)*i),!s?.skipFlash){const h=this.allocParticle();h.active=!0,h.life=0,h.maxLife=(.16+o*.04)*i,h.sprite.visible=!0,h.sprite.position.set(e.x,La,e.z),h.vx=0,h.vy=0,h.vz=0,h.gravity=0,h.startScale=.5*o,h.endScale=1.15*o,h.startOpacity=1,h.endOpacity=0,h.fadeEase=1.4,h.mat.color.set(a).lerp(Et,.3)}if(!s?.skipRing){const h=this.allocRing();h.active=!0,h.life=0,h.maxLife=(.24+o*.06)*i,h.startScale=.15,h.targetScale=.6*o+.35,h.startOpacity=.95,h.mesh.visible=!0,h.mesh.position.set(e.x,io,e.z),h.mesh.scale.setScalar(h.startScale),h.mat.color.set(a).lerp(Et,.25),h.mat.opacity=h.startOpacity;const c=this.allocRing();c.active=!0,c.life=0,c.maxLife=(.32+o*.08)*i,c.startScale=.1,c.targetScale=(.6*o+.35)*1.35,c.startOpacity=.55,c.mesh.visible=!0,c.mesh.position.set(e.x,io-.01,e.z),c.mesh.scale.setScalar(c.startScale),c.mat.color.set(a),c.mat.opacity=c.startOpacity}if(!s?.skipStreaks){const h=Math.max(4,Math.round(n*.7));this.spawnStreaks(e,La,"#FFE79A",h,(.5+o*.5)*r,.26*i)}const l=.4*o;for(let h=0;h<n;h++){const c=this.allocParticle();c.mat.map=this.shardTex;const d=Math.random()*Math.PI*2;c.mat.rotation=d,c.aspect=.4+Math.random()*.15;const p=(2.6+Math.random()*2.8)*(.6+o*.4)*r,u=.18+Math.random()*.24;c.active=!0,c.life=0,c.maxLife=(.36+Math.random()*.22+o*.06)*i,c.sprite.visible=!0,c.sprite.position.set(e.x+Math.cos(d)*u,La,e.z+Math.sin(d)*u),c.vx=Math.cos(d)*p,c.vz=Math.sin(d)*p,c.vy=1.3+Math.random()*1.8,c.gravity=-6.2,c.startScale=l*(.8+Math.random()*.5),c.endScale=l*.2,c.startOpacity=1,c.endOpacity=0,c.fadeEase=.85,c.mat.color.set(Bu)}}allocParticle(){let e=null;for(const o of this.particles)if(!o.active){e=o;break}if(!e){let o=-1/0;for(const n of this.particles){const s=n.life/n.maxLife;s>o&&(o=s,e=n)}}const a=e;return a.mat.map=this.glowTex,a.mat.rotation=0,a.aspect=1,a}spawnStarPop(e,a,o,n,s){const i=this.allocParticle();i.mat.map=this.starTex,i.active=!0,i.life=0,i.maxLife=s,i.sprite.visible=!0,i.sprite.position.set(e.x,a,e.z),i.vx=0,i.vy=0,i.vz=0,i.gravity=0,i.startScale=n*.5,i.endScale=n,i.startOpacity=1,i.endOpacity=0,i.fadeEase=1.7,i.mat.color.set(o).lerp(Et,.45)}spawnStreaks(e,a,o,n,s,i){for(let r=0;r<n;r++){const l=this.allocParticle();l.mat.map=this.streakTex,l.mat.rotation=Math.random()*Math.PI*2,l.aspect=.22,l.active=!0,l.life=0,l.maxLife=i*(.8+Math.random()*.4),l.sprite.visible=!0,l.sprite.position.set(e.x,a,e.z),l.vx=0,l.vy=0,l.vz=0,l.gravity=0,l.startScale=s*(.7+Math.random()*.3),l.endScale=s*1.35,l.startOpacity=.95,l.endOpacity=0,l.fadeEase=1.3,l.mat.color.set(o).lerp(Et,.3)}}allocWedge(){let e;for(const a of this.wedges)if(!a.active){e=a;break}return e||(e=this.wedges.reduce((a,o)=>a.life/a.maxLife>=o.life/o.maxLife?a:o)),e.mat.map!==this.wedgeGradientTex&&(e.mat.map=this.wedgeGradientTex,e.mat.needsUpdate=!0),e.mat.vertexColors&&(e.mat.vertexColors=!1,e.mat.needsUpdate=!0),e}allocRing(){for(const e of this.rings)if(!e.active)return e;return this.rings.reduce((e,a)=>e.life/e.maxLife>=a.life/a.maxLife?e:a)}clear(){for(const e of[this.projectilePool,this.shellPool,this.splatPool,this.trailPool,this.medikitPool]){for(const a of e.values())this.group.remove(a);e.clear()}for(const e of this.particles)e.active=!1,e.sprite.visible=!1;for(const e of this.wedges)e.active=!1,e.mesh.visible=!1;for(const e of this.rings)e.active=!1,e.mesh.visible=!1;for(const e of this.transientEffects)this.group.remove(e.object),Fl(e.object);this.transientEffects.length=0;for(const e of this.unionScopes)this.releaseUnionCore(e);this.unionScopes.length=0,this.pendingUnion=null,this.castTelegraphs.clear(),this.lastSyncElapsedMs=0;for(let e=0;e<this.statusBySlot.length;e++){const a=this.statusBySlot[e];a.slowRing.visible=!1,a.slowRingDark.visible=!1,a.slowTint.visible=!1,a.stunStars.forEach(n=>{n.visible=!1}),a.wardRing.visible=!1,a.wardPop=0,this.statusSnapshot[e]={x:NaN,y:NaN,stunReady:!0,slowReady:!0};const o=this.slowSplashState[e];o.lastX=NaN,o.lastY=NaN,o.distAccum=0}}dispose(){this.clear(),delete window.__vfxSpawnTest,window.__vfxLayer===this&&delete window.__vfxLayer,this.projectileGeo.dispose(),this.splatGeo.dispose(),this.trailGeo.dispose(),this.medikitBodyGeo.dispose(),this.medikitArmXGeo.dispose(),this.medikitArmZGeo.dispose(),this.medikitBodyMat.dispose(),this.medikitCrossMat.dispose(),this.splatMats.forEach(e=>e.dispose()),Object.values(this.trailMats).forEach(e=>e.forEach(a=>a.dispose())),this.glazeTexByColor.forEach(e=>e.forEach(a=>a.dispose())),this.glazeTexByColor.clear(),this.materialCache.forEach(e=>e.dispose()),this.materialCache.clear(),this.haloTex.dispose(),this.haloMats.forEach(e=>e.dispose()),this.haloMats.clear(),this.glowTex.dispose(),this.coreTex.dispose(),this.softDiscTex.dispose(),this.starTex.dispose(),this.streakTex.dispose(),this.shardTex.dispose(),this.wedgeGradientTex.dispose(),this.telegraphRimTex.dispose();for(const e of this.particles)e.mat.dispose();for(const e of this.unionCores)e.mat.dispose();for(const e of this.wedges)e.mat.dispose();for(const e of this.rings)e.mat.dispose();this.wedgeGeoCache.forEach(e=>e.dispose()),this.wedgeGeoCache.clear(),this.ringUnitGeo.dispose(),this.wardGeo.dispose();for(const e of this.statusBySlot)e.slowRing.material.dispose(),e.slowRing.geometry.dispose(),e.slowRingDark.material.dispose(),e.slowRingDark.geometry.dispose(),e.slowTint.material.dispose(),e.stunStars.forEach(a=>a.material.dispose()),e.wardMat.dispose()}measureShell(e){let a=nt(10);if(this.shellBox.setFromObject(e),!this.shellBox.isEmpty()){this.shellBox.getSize(this.shellSize);const s=.5*Math.max(this.shellSize.x,this.shellSize.y,this.shellSize.z);s>1e-4&&(a=s)}const o=Math.min(dE,Math.max(1,cE/a)),n=Math.min(uE,Math.max(Zu,a*o*pE));e.userData.shellSpec={scale:o,haloR:n}}materialFor(e){let a=this.materialCache.get(e);return a||(a=Je({color:e,roughness:sM,metalness:0}),this.materialCache.set(e,a)),a}}function mi(t,e,a){return Wh(e.x,e.y,a.x,a.y,t.arena,t,a)}function t0(t,e){return qe(t)[e.observerSlot??Ce]??Be(t)}function Qs(t){return t.phase==="playing"&&!Be(t).alive}const a0="hud-styles";function IE(){if(document.getElementById(a0))return;const t=document.createElement("style");t.id=a0,t.textContent=DE,document.head.appendChild(t)}function o0(t){const e=Math.max(0,Math.ceil(t/1e3)),a=Math.floor(e/60),o=e%60;return`${a}:${String(o).padStart(2,"0")}`}function OE(t){const e=Math.max(0,Math.round(t/1e3)),a=Math.floor(e/60),o=e%60;return`${a}:${String(o).padStart(2,"0")}`}const n0=.25,s0=.14,ei=[[0,0,.55,-50,0],[.14,1,1.18,-66,0],[.3,1,1,-76,0],[1,0,.92,-50,-68]];function CE(t){const e=s=>3*(1-s)*(1-s)*s*.15+3*(1-s)*s*s*.3+s*s*s,a=s=>3*(1-s)*(1-s)*s*.8+3*(1-s)*s*s+s*s*s;let o=0,n=1;for(let s=0;s<18;s++){const i=(o+n)/2;e(i)<t?o=i:n=i}return a((o+n)/2)}function FE(t){let e=0;for(;e<ei.length-2&&t>=ei[e+1][0];)e++;const a=ei[e],o=ei[e+1],n=CE(Math.min(1,Math.max(0,(t-a[0])/(o[0]-a[0])))),s=i=>a[i]+(o[i]-a[i])*n;return{op:s(1),sc:s(2),ty:s(3),dy:s(4)}}function NE(t,e,a,o){const n=o>0?Math.max(0,Math.min(1,a/o)):0;t.style.width=`${(n*100).toFixed(1)}%`,e.textContent=`${Math.max(0,Math.ceil(a))} / ${o}`}function LE(t,e){IE(),Ta(),t.innerHTML=`
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
  `;const a=$=>{const Z=t.querySelector(`[data-el="${$}"]`);if(!Z)throw new Error(`hud: missing element "${$}"`);return Z},o=a("timer"),n=a("weapons"),s=a("items"),i=a("spectate"),r=a("countdown"),l=a("gameover"),h=a("gameover-title"),c=a("gameover-place"),d=a("gameover-subtitle"),p=a("gameover-stats"),u=a("gameover-payout"),m=a("gameover-btn"),f=a("topbar"),g=t.querySelector(".hud-clock"),w=t.querySelector(".hud-root"),b=a("dmg-layer"),y=a("screenflash"),x=a("zone"),k=a("zone-label"),T=a("zone-value"),v=a("zone-bar"),O=a("radar"),D=a("radar-safe"),_=a("radar-arena"),E=a("radar-map"),A=a("radar-cap"),C=a("fogedge"),R=a("fogtick"),I=a("safearrow"),L=a("safearrow-label"),B=a("aim-stick"),H=a("aim-reticle"),j=a("mute");let S=[],N=null;function q($){if(S.length===$)return;for(const te of S)te.bar.parentElement?.remove(),te.float.remove(),te.blip.remove();S=[],N?.remove(),N=null;const Z=$>2;f.classList.toggle("hud-topbar--chips",Z),Z&&(N=document.createElement("div"),N.className="hud-chips",N.dataset.el="chips",f.appendChild(N));for(let te=0;te<$;te++){const W=eb(te),fe=te===0?"player":"enemy",ge=Z&&te>0,be=document.createElement("div");be.className=`hud-fighter hud-fighter--${fe}${ge?" hud-fighter--chip":""}`;const xe=`<div class="hud-fighter-level" data-el="${W}-level"><span class="hud-fighter-level-tag">LV</span><span class="hud-fighter-level-n" data-el="${W}-level-n"></span></div>`,Ve=te===0?`<div class="hud-fighter-emoji" data-el="${W}-emoji"></div><div class="hud-fighter-name" data-el="${W}-name"></div>`+xe:xe+`<div class="hud-fighter-name" data-el="${W}-name"></div><div class="hud-fighter-emoji" data-el="${W}-emoji"></div>`;be.innerHTML=`<div class="hud-fighter-pill">${Ve}</div><div class="hud-healthbar hud-healthbar--${fe}" data-el="${W}-bar"><div class="hud-healthbar-fill" data-el="${W}-fill"></div><div class="hud-healthbar-text" data-el="${W}-hp"></div></div>`,te===0?f.insertBefore(be,g):N?N.appendChild(be):f.appendChild(be);const re=document.createElement("div");re.className=`hud-float hud-float--${fe}`,re.dataset.el=`float-${W}`,re.innerHTML=`<div class="hud-float-name" data-el="float-${W}-name"></div><div class="hud-float-hp" data-el="float-${W}-hp"></div><div class="hud-float-bar"><div class="hud-float-fill" data-el="float-${W}-fill"></div></div>`,O.parentElement.insertBefore(re,O);const Fe=document.createElement("div");Fe.className=`hud-radar-dot hud-radar-dot--${fe}`,Fe.dataset.el=`radar-${W}`,te===0?E.appendChild(Fe):E.insertBefore(Fe,E.querySelector(".hud-radar-dot--player")),S.push({name:be.querySelector(`[data-el="${W}-name"]`),emoji:be.querySelector(`[data-el="${W}-emoji"]`),level:be.querySelector(`[data-el="${W}-level-n"]`),levelValue:-1,bar:be.querySelector(`[data-el="${W}-bar"]`),fill:be.querySelector(`[data-el="${W}-fill"]`),hpText:be.querySelector(`[data-el="${W}-hp"]`),float:re,floatName:re.querySelector(`[data-el="float-${W}-name"]`),floatHp:re.querySelector(`[data-el="float-${W}-hp"]`),floatFill:re.querySelector(`[data-el="float-${W}-fill"]`),floatHpValue:-1,floatH:0,floatHalfW:0,blip:Fe})}}q(2);let U=0,V=null;function ne(){const $=Ae.isMuted();if($===V)return;const Z=V===null;if(V=$,window.clearTimeout(U),$){j.innerHTML=P("mute")+"<span>MUTED · M</span>",j.classList.add("is-on"),j.classList.remove("is-ok");return}if(Z){j.classList.remove("is-on","is-ok");return}j.innerHTML=P("sound")+"<span>SOUND ON · M</span>",j.classList.add("is-on","is-ok"),U=window.setTimeout(()=>j.classList.remove("is-on","is-ok"),1500)}const z=Ae.onChange(ne);ne();const Q=24,de=[];let Oe=0;for(let $=0;$<Q;$++){const Z=document.createElement("div");Z.className="hud-dmg",b.appendChild(Z),de.push(Z)}const ot=850,bn=50,Ia=new Float64Array(Q).fill(-1),yn=new Float64Array(Q),xn=new Float64Array(Q);let Qa=0,_o=-1;function Jm(){const $=performance.now();_o>=0&&(Qa+=Math.min(bn,Math.max(0,$-_o))),_o=$}function Rc($){const Z=de[$],te=(Qa-Ia[$])/ot;if(te>=1){Ia[$]=-1,Z.classList.remove("is-playing"),Z.style.opacity="0";return}const W=FE(Math.max(0,te));Z.style.opacity=W.op.toFixed(3),Z.style.transform=`translate(${yn[$].toFixed(1)}px, ${(xn[$]+W.dy).toFixed(1)}px) translate(-50%, ${W.ty.toFixed(1)}%) scale(${W.sc.toFixed(3)})`}function Qm(){for(let $=0;$<Q;$++)Ia[$]>=0&&Rc($)}const eg=30;let gr=!1,Ic=0;function tg($,Z){const te=$.replace("#",""),W=te.length===3?te.split("").map(xe=>xe+xe).join(""):te,fe=parseInt(W.slice(0,2),16)||0,ge=parseInt(W.slice(2,4),16)||0,be=parseInt(W.slice(4,6),16)||0;return`rgba(${fe},${ge},${be},${Z})`}m.addEventListener("click",()=>e.onRestart());let vn=null,Oc=[];const kn=document.createElement("div");kn.className="hud-weapons-why",kn.setAttribute("aria-live","polite");function ag($){n.innerHTML="",n.appendChild(kn),Oc=$.map((Z,te)=>{const W=document.createElement("div");return W.className="hud-weapon-slot",W.innerHTML=`
        <div class="hud-weapon-cooldown"></div>
        <div class="hud-weapon-emoji">${of(Z.emoji)}</div>
        <div class="hud-weapon-timer" data-role="timer"></div>
        <div class="hud-weapon-key">${te+1}</div>
      `,W.addEventListener("pointerdown",fe=>{fe.preventDefault(),fe.stopPropagation(),e.onSelectWeapon?.(te)}),n.appendChild(W),{root:W,cooldown:W.querySelector(".hud-weapon-cooldown"),timer:W.querySelector('[data-role="timer"]'),wasReady:!0}})}let ys=[],Cc="\0";const og=$=>$.startsWith("Key")?$.slice(3):$;function ng($){if(s.innerHTML="",$.length===0){ys=[];return}ys=Array.from({length:Rt},(Z,te)=>{const W=$[te],fe=document.createElement("div");return fe.className="hud-item-slot",fe.innerHTML=`
        <div class="hud-item-wipe"></div>
        <div class="hud-item-glyph">${W?P(W,{size:"26px",label:Le[W].name}):""}</div>
        <div class="hud-item-badge" data-role="badge"></div>
        <div class="hud-item-key">${og(Qi[te]??"")}</div>
      `,fe.addEventListener("pointerdown",ge=>{ge.preventDefault(),ge.stopPropagation(),e.onUseItem?.(te)}),s.appendChild(fe),{root:fe,wipe:fe.querySelector(".hud-item-wipe"),badge:fe.querySelector('[data-role="badge"]'),lastBadge:"\0",lastState:"\0",lastP:"\0",wasReady:!1}})}function sg($){const Z=Be($),te=Z.item.equipped,W=te.join(",");if(W!==Cc&&(Cc=W,ng(te),s.classList.toggle("is-on",te.length>0),document.documentElement.classList.toggle("fa-items",te.length>0)),ys.length===0)return;const fe=Qs($);s.classList.toggle("is-inert",fe);const ge=Rh($),be=Z.itemCast;ys.forEach((xe,Ve)=>{const re=te[Ve],Fe=re!==void 0&&!fe&&jh($,Z,Ve);let we,De,ut=0;if(re===void 0)we="is-empty",De="EMPTY";else if(Le[re].cooldownMs===null){const Ke=re==="leftovers"&&Z.item.revivesLeft<=0;we=Ke?"is-spent":"is-auto",De=Ke?"USED":"AUTO"}else if(be!==null&&be.slot===Ve){const Ke=Math.max(1,be.resolvesAt-be.startedAt),ht=Math.max(0,be.resolvesAt-$.elapsed);we="is-winding",De=(ht/1e3).toFixed(1),ut=Math.min(1,ht/Ke)}else{const Ke=Le[re].cooldownMs??0,ht=Math.max(0,Ke-($.elapsed-Z.item.lastUsed[Ve]));ut=Ke>0?Math.min(1,ht/Ke):0,ht>0?(we="is-cooling",De=(ht/1e3).toFixed(1)):ge<Le[re].minAlive?(we="is-blocked",De=`NEED ${Le[re].minAlive}`):Fe?(we="",De=""):(we="is-blocked",De="WAIT")}const lt=Fe,Ot=["hud-item-slot",we,lt?"is-ready":""].filter(Boolean).join(" ");xe.lastState!==Ot&&(xe.lastState=Ot,xe.root.className=Ot);const ft=ut.toFixed(3);xe.lastP!==ft&&(xe.lastP=ft,xe.wipe.style.setProperty("--p",ft)),xe.lastBadge!==De&&(xe.lastBadge=De,xe.badge.textContent=De),lt&&!xe.wasReady&&(xe.root.classList.remove("is-flash"),xe.root.offsetWidth,xe.root.classList.add("is-flash")),xe.wasReady=lt})}const ig=Math.round(Mh/bi*1e3);function rg($,Z){const te=vr($-Xg.radiusUnits,$,Z)-vr($,$,Z);return te>0?Math.min(12e3,te):0}function lg($){const Z=$.arena.maxSafeRadius,te=Be($),W=Math.hypot(te.x-$.arena.center.x,te.y-$.arena.center.y),fe=W>$.safeRadius,ge=Wa-$.timeRemaining,be=wi($.fighters.length),xe=W<=f0($.fighters.length,$.timeRemaining);return{outside:fe,holds:xe,ringAtFloor:$.safeRadius<=be,sudden:Xn($.timeRemaining),radius01:Z>0?Math.max(0,Math.min(1,$.safeRadius/Z)):0,msUntilEdge:fe||xe?null:vr(W,Z,be)-ge}}const hg=34;let Fc=0,wr=-1,Nc=-1,Lc=-1,Dc=0,Hc="";function br(){if(window.innerWidth!==wr||window.innerHeight!==Nc||S.length!==Lc){wr=window.innerWidth,Nc=window.innerHeight,Lc=S.length;const $=f.getBoundingClientRect().bottom;Fc=$+36,Dc=$,b.style.setProperty("--fa-dmg-top",`${Math.max(0,Math.round($+2))}px`),w.style.setProperty("--fa-topbar-b",`${Math.max(0,Math.round($))}px`)}return Fc}let xs=0;function cg($,Z){const te=Qs($);if(i.classList.toggle("is-on",te),!te){i.textContent!==""&&(i.textContent="");return}const W=t0($,Z),ge=W!==Be($)?`Spectating ${ie[W.characterId].name}`:"Eliminated";i.textContent!==ge&&(i.textContent=ge)}function dg($,Z){const te=$.phase==="playing",W=lg($),fe=Qs($),ge=te&&W.outside&&Be($).alive,be=te&&W.sudden,xe=$.arena.maxSafeRadius;x.classList.toggle("is-danger",ge),x.classList.toggle("is-imminent",!ge&&!fe&&W.msUntilEdge!==null&&W.msUntilEdge<rg(xe,wi($.fighters.length))),v.style.width=`${(W.radius01*100).toFixed(1)}%`,be?(k.textContent="SUDDEN DEATH",T.textContent="MOST HP WINS"):ge?(k.textContent="▲ OUTSIDE THE ZONE",T.textContent=`−${ig} HP/s`):(k.textContent="ZONE CLOSES",T.textContent=fe?W.ringAtFloor?"FINAL RING":"CLOSING":W.msUntilEdge!==null?`REACHES YOU ${o0(W.msUntilEdge)}`:W.holds?"FINAL RING":"CLOSING");const Ve=$.arena.width,re=$.arena.height,Fe=$.arena.center.x,we=$.arena.center.y,De=Ve/re,ut=Math.max(xe,Fe,Ve-Fe)*(1+s0),lt=Math.max(we,re-we)*(1+s0),Ot=Math.max(2*ut,2*lt*De),ft=Ot/De,Ke=He=>`${(50+(He-Fe)/Ot*100).toFixed(2)}%`,ht=He=>`${(50+(He-we)/ft*100).toFixed(2)}%`,eo=He=>`${(He/Ot*100).toFixed(2)}%`,vs=He=>`${(He/ft*100).toFixed(2)}%`;D.style.left=Ke(Fe),D.style.top=ht(we),D.style.width=eo($.safeRadius*2),D.style.height=vs($.safeRadius*2),_.style.left=Ke(Ve/2),_.style.top=ht(re/2),_.style.width=eo(Ve),_.style.height=vs(re);const Oa=t0($,Z);qe($).forEach((He,Ca)=>{const ha=S[Ca]?.blip;ha&&(ha.style.left=Ke(He.x),ha.style.top=ht(He.y),ha.style.display=Ca===Ce?He.alive?"block":"none":He.alive&&mi($,Oa,He)?"block":"none")}),O.classList.toggle("is-danger",ge),A.textContent=be?"SUDDEN DEATH":ge?"GET INSIDE":"SAFE ZONE",C.classList.toggle("is-on",ge);const me=ge&&!be?Z.safeArrow??null:null;if(me){I.style.display="block",L.style.display="block";const He=me.angleRad*180/Math.PI;I.style.transform=`translate(${me.at.x.toFixed(1)}px, ${me.at.y.toFixed(1)}px) rotate(${He.toFixed(1)}deg)`,(xs===0||window.innerWidth!==wr)&&(xs=L.offsetWidth/2);const Ca=8,ha=Math.min(Math.max(me.at.x+Math.cos(me.angleRad)*178,xs+Ca),window.innerWidth-xs-Ca),ug=Math.min(Math.max(me.at.y+Math.sin(me.angleRad)*178,br()+4),window.innerHeight-22);L.style.transform=`translate(${ha.toFixed(1)}px, ${ug.toFixed(1)}px) translate(-50%, -50%)`}else I.style.display="none",L.style.display="none"}function pg($){const Z=$.aim??null;if(!Z){B.style.display="none",H.style.display="none";return}const te=Z.at.x-Z.from.x,W=Z.at.y-Z.from.y,fe=Math.hypot(te,W),ge=Math.atan2(W,te)*180/Math.PI;B.style.display="block",B.style.width=`${fe.toFixed(1)}px`,B.style.transform=`translate(${Z.from.x.toFixed(1)}px, ${Z.from.y.toFixed(1)}px) rotate(${ge.toFixed(1)}deg)`,H.style.display="flex",H.style.transform=`translate(${Z.at.x.toFixed(1)}px, ${Z.at.y.toFixed(1)}px) translate(-50%, -50%)`}return{setCharacters($){q($.length),vn=$[Ce]??null,$.forEach((Z,te)=>{const W=S[te];W&&(W.name.textContent=ie[Z].name,W.emoji.innerHTML=vo(Z,{crop:"head"}),W.floatName.textContent=ie[Z].name)}),vn&&ag(ie[vn].weapons),ko(t,{generate:!1}),gr=t.querySelector("[data-portrait]:not(.has-render)")!==null,Ic=0},update($,Z){o.textContent=o0($.timeRemaining),gr&&++Ic%eg===0&&(ko(t,{generate:!1}),gr=t.querySelector("[data-portrait]:not(.has-render)")!==null),Jm(),Qm(),qe($).forEach((re,Fe)=>{const we=S[Fe];if(!we)return;NE(we.fill,we.hpText,re.hp,re.maxHp);const De=Math.max(0,Math.ceil(re.hp));we.floatHpValue!==De&&(we.floatHpValue=De,we.floatHp.textContent=String(De)),we.levelValue!==re.level&&(we.levelValue=re.level,we.level.textContent=String(re.level));const ut=re.maxHp>0?re.hp/re.maxHp:0;we.bar.classList.toggle("is-low",re.alive&&ut<=n0)});const te=Qs($);n.classList.toggle("is-inert",te);const W=Be($),fe=te?null:ah($,W,0),ge=fe==="asleep"||fe==="clogged"?fe:null,be=ge!==null;n.classList.toggle("is-locked",be),ge?n.dataset.refusal=ge:delete n.dataset.refusal;const xe=ge==="asleep"?W.item.sleepUntil-$.elapsed:ge==="clogged"?W.item.clogUntil-$.elapsed:0,Ve=ge?`${ge==="asleep"?"ASLEEP":"CLOGGED"} ${(Math.max(0,xe)/1e3).toFixed(1)}`:"";if(kn.textContent!==Ve&&(kn.textContent=Ve),vn){const re=ie[vn].weapons,Fe=W.lastUsed;Oc.forEach((we,De)=>{const ut=re[De];if(!ut)return;const lt=Math.max(0,ut.cooldown-($.elapsed-Fe[De])),Ot=ut.cooldown>0?Math.min(1,lt/ut.cooldown):0;we.cooldown.style.setProperty("--p",Ot.toFixed(3));const ft=Ot<=0,Ke=te?null:ah($,W,De),ht=ft&&!te&&(Ke===null||Ke==="phase");we.root.classList.toggle("is-ready",ht),we.root.classList.toggle("is-selected",!te&&De===Z.selectedWeapon),we.timer.textContent=ft?"":(lt/1e3).toFixed(1),ft&&!we.wasReady&&!te&&!be&&(we.root.classList.remove("is-flash"),we.root.offsetWidth,we.root.classList.add("is-flash")),we.wasReady=ft})}if(sg($),cg($,Z),dg($,Z),pg(Z),$.phase==="countdown"){r.style.display="flex";const re=$.countdownValue<=0;r.textContent=re?"START!":String($.countdownValue),r.classList.toggle("is-start",re)}else r.style.display="none";if($.phase==="ended"){l.style.display="flex";const re=qe($),Fe=Wt($.winnerId??void 0,$.winner??"player"),we=Fe===Ce;h.textContent=we?"VICTORY!":"DEFEAT!",h.classList.toggle("is-win",we),h.classList.toggle("is-lose",!we);const De=re[Fe]??re[0];ie[De.characterId];const ut=re.every(me=>me.alive),lt=Z.order??null,Ot=lt!==null&&lt.length===re.length&&lt.every(me=>Number.isInteger(me)&&me>=0&&me<re.length)&&new Set(lt).size===re.length,ft=lt&&Ot?lt.filter(me=>me!==Fe).map(me=>re[me]):re.filter((me,He)=>He!==Fe),Ke=me=>`<span class="hud-go-fighter"><span class="hud-go-emoji">${vo(me.characterId,{crop:"head"})}</span>${ie[me.characterId].name}</span>`,ht=(me,He)=>He.length?`<span class="hud-go-vs">${me}</span>${He.map(Ke).join("")}`:"";d.innerHTML=Ke(De)+ht("defeated",ft.filter(me=>!me.alive))+ht("outlasted",ft.filter(me=>me.alive)),ko(d,{generate:!1});const eo=Z.place??null;if(eo&&eo.of>1){const me=eo.place,He=me%100>=11&&me%100<=13?"th":{1:"st",2:"nd",3:"rd"}[me%10]??"th";c.textContent=`${me}${He} of ${eo.of}`,c.classList.toggle("is-podium",me<=3),c.style.display="block"}else c.textContent="",c.style.display="none";const vs=Math.max(0,Wa-$.timeRemaining);p.innerHTML=ut?`${P("timer")} Time up — no knockout`:`${P("timer")} Match time ${OE(vs)}`;const Oa=Z.payout??null;if(Oa){const me=(He,Ca,ha="")=>`<span class="hud-go-pay">${P(He)}<b>${Ca>0?"+":""}${Ca}</b>${ha?`<i>${ha}</i>`:""}</span>`;u.innerHTML=me("trophy",Oa.trophies)+me("coin",Oa.coins)+me("star",Oa.xp,"xp")+(Oa.chests?me("chest",Oa.chests):""),u.style.display="flex"}else u.innerHTML="",u.style.display="none"}else l.style.display="none"},updateFloatingBars($,Z){br();const te=`${window.innerWidth}x${window.innerHeight}`;if(te!==Hc){Hc=te;for(const W of S)W.floatH=0,W.floatHalfW=0}S.forEach((W,fe)=>{const ge=$[fe]??null;if(!ge){W.float.style.display="none";return}if(W.float.style.display="flex",W.floatH<=0){const Fe=W.float.getBoundingClientRect();W.floatH=Fe.height,W.floatHalfW=Fe.width/2}const be=Math.max(ge.y,Dc+W.floatH+8),xe=Math.max(W.floatHalfW,hg),Ve=Math.min(Math.max(ge.x,xe),window.innerWidth-xe);W.float.style.transform=`translate(${Ve.toFixed(1)}px, ${be.toFixed(1)}px) translate(-50%, -100%)`;const re=Math.max(0,Math.min(1,Z[fe]??0));W.floatFill.style.width=`${(re*100).toFixed(1)}%`,W.floatFill.classList.toggle("is-low",re>0&&re<=n0)})},spawnDamageNumber($,Z,te){const W=Oe,fe=de[W];Oe=(Oe+1)%de.length;const ge=!!te?.heal,be=Z>=15,xe=!be&&Z>=6,Ve=Math.max($.y,br()),re=Math.min(Math.max($.x,24),window.innerWidth-24);fe.textContent=ge?`+${Math.round(Z)}`:`-${Math.round(Z)}`;const Fe=ge?" hud-dmg--heal":te?.fog?" hud-dmg--fog":"";fe.className=`hud-dmg ${be?"hud-dmg--big":xe?"hud-dmg--medium":"hud-dmg--small"}${Fe} is-playing`,yn[W]=re,xn[W]=Ve,Ia[W]=Qa,Rc(W)},flashScreen($){y.style.setProperty("--flash-color",tg($,.42)),y.classList.remove("is-playing"),y.offsetWidth,y.classList.add("is-playing")},flashFogTick(){R.classList.remove("is-playing"),R.offsetWidth,R.classList.add("is-playing")},dispose(){m.removeEventListener("click",()=>e.onRestart()),window.clearTimeout(U),z(),document.documentElement.classList.remove("fa-items"),t.innerHTML=""}}}const DE=`
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
/* REMOVED (graphics campaign F1, docs/REVAMP.md §5): it was "position absolute, top 0,
   full width, height 120px, linear-gradient(180deg, rgba(10,6,16,0.5) -> 0)". Every
   element it protected now sits on its own opaque plate (nameplate, clock, zone, chips)
   or its own stroke, and hud_accept measures each text run against what is actually
   behind it — so the wash was darkening the top 120 px of the ARENA (13% of a 900 px
   frame, a third of a landscape phone's) to protect text that no longer needed it. The
   element stays in the DOM so nothing that queries it breaks. */
.hud-topbar-scrim { display: none; }

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
   where nobody checked that the consolation exists.
   ⚠️ AND NOW IT DOES (graphics campaign F1): the over-head plate prints each
   fighter's HP as a big stroked numeral (.hud-float-hp), so a chip's hidden
   "99 / 108" has a real readout at the fighter it belongs to. */
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
   mouse-only machine never reaches this rule at all.
   F7 — AND ON A PHONE THAT GATE MADE THE FIRST TOUCH OF EVERY MATCH FIRE. fa-touch is
   set by the first CLAIMED finger, so before it the slot was pointer-events none, a
   touch on it fell through to the canvas, claimed the aim stick and FIRED the selected
   weapon (bh_input_probe S3.J: first touch on slot 3 -> selectedWeapon 0, attackFrames 7;
   the second touch, after the class landed, selected cleanly). The gate's reason —
   "do not eat a MOUSE player's fire clicks" — cannot apply on a device whose PRIMARY
   pointer is coarse, and html.fa-touch-capable is exactly that device (touch.ts sets it
   at construction, phones and tablets only, never a touchscreen laptop). So the slots
   opt in under either flag. The inert tray (0,3,0) and the AUTO/spent item !important
   rules still out-rank both. The touch.ts half (B2's file) needs nothing for this:
   once the slot takes the event, its pointerdown handler preventDefaults it.
   ⚠️ (B3b, COMMENTS-1) Two sentences above went stale at 6c39d30 (F7's touch half) and
   are kept: "which game/touch.ts only sets after a REAL finger has been seen" and
   "fa-touch is set by the first CLAIMED finger". touch.ts now sets fa-touch AND
   fa-touch-capable at CONSTRUCTION on a coarse-primary device, so on a phone this rule is
   live from the first frame. Both sentences still describe a touchscreen LAPTOP (a fine
   primary pointer: fa-touch waits for a real finger), and a mouse-only machine still
   never reaches this rule. */
html.fa-touch .hud-weapon-slot,
html.fa-touch-capable .hud-weapon-slot {
  pointer-events: auto;
  cursor: pointer;
  touch-action: manipulation;
}
/* A tap has to acknowledge itself even when the slot it hit is still cooling — with no
   press state, a mis-hit and a dead control look identical. */
html.fa-touch .hud-weapon-slot:active,
html.fa-touch-capable .hud-weapon-slot:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(0,0,0,0.35);
}
html.fa-touch .hud-weapon-slot.is-selected:active,
html.fa-touch-capable .hud-weapon-slot.is-selected:active { transform: translateY(-1px); }
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
   none and this is the ONE opt-in in the HUD), so this is the exact counterpart.
   (B3b, COMMENTS-1: "under html.fa-touch" — or html.fa-touch-capable since F7; the slot
   rule opts in under either class, and this counterpart out-ranks both.) */
.hud-weapons.is-inert .hud-weapon-slot { pointer-events: none; }
/* LOCKED (U1): clogged or asleep — the sim refuses every press until it lifts. Greyed like
   the inert tray, but presses stay live: SELECTING a weapon is not firing one, and a
   locked player picking the slot to fire the instant the lock lifts is the right play.

   ⚠️ THE FADE MOVED FROM THE TRAY TO ITS SLOTS (B3b), and the slots look exactly as they
   did. It read ".hud-weapons.is-locked { filter: grayscale(1); opacity: 0.5; }". A filter
   or opacity on the container applies to EVERY descendant, and the tray now holds the
   caption that says WHY it is locked — which would have been greyed and halved with the
   icons it explains. The slots do not overlap (gap 8-10px), so per-slot opacity composites
   to the same pixels as the group's. */
.hud-weapons.is-locked .hud-weapon-slot {
  filter: grayscale(1);
  opacity: 0.5;
}
/* WHY IT IS LOCKED (B3b): "ASLEEP 2.4" / "CLOGGED 3.0", stamped across the greyed icons at
   full strength. Inside the tray's own box on purpose — the touch layout's corner cluster
   has the radar above it and the item column beside it (see that media rule's measured
   free band), so a label ABOVE the tray would need space this HUD does not have. It takes
   no pointer events, so a press still reaches the slot under it (selecting is not firing).
   The dark ink and light text are the slot timer's own pair (#1a1224 / #FFF3DE), so the
   caption reads as the same family as the countdown digits it stands in for. */
.hud-weapons-why {
  display: none;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  padding: 4px 10px;
  border: 2px solid #FFF3DE;
  border-radius: 10px;
  background: #1a1224;
  color: #FFF3DE;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 14px;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
}
.hud-weapons.is-locked .hud-weapons-why { display: block; }

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
/* SPENT (ML-8): a once-per-match item that has fired. Nothing to press and nothing
   working any more — the AUTO plate's no-press rules, with the glyph greyed out so it
   cannot be read as "on". */
.hud-item-slot.is-spent { pointer-events: none !important; opacity: 0.55; }
.hud-item-slot.is-spent .hud-item-glyph { filter: grayscale(1) brightness(0.7); }

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
.hud-item-slot.is-auto .hud-item-wipe,
.hud-item-slot.is-spent .hud-item-wipe { background: transparent; }

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
.hud-item-slot.is-auto .hud-item-key,
.hud-item-slot.is-spent .hud-item-key { display: none; }

/* The ONE opt-in to pointer events, exactly as the weapon slot's: per-slot, 58x58
   (well over the 44px floor), and gated on html.fa-touch, which game/touch.ts sets only
   after a REAL finger. .hud-root is pointer-events:none and a full-viewport layer that
   claims events starves the canvas of firing AND aim at once — that has shipped once.
   ⚠️ (B3b, COMMENTS-1) "sets only after a REAL finger" is stale since 6c39d30 (F7):
   touch.ts sets fa-touch AND fa-touch-capable at CONSTRUCTION on a coarse-primary device,
   and this rule opts in under either class — so on a phone the item buttons take pointer
   events from the first frame. A touchscreen laptop still waits for a real finger. */
html.fa-touch .hud-item-slot,
html.fa-touch-capable .hud-item-slot {
  pointer-events: auto;
  cursor: pointer;
  touch-action: manipulation;
}
/* A press has to acknowledge itself even when the slot it hit is still cooling — with
   no press state, a mis-hit and a dead control look identical. */
html.fa-touch .hud-item-slot:active,
html.fa-touch-capable .hud-item-slot:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(0,0,0,0.35);
}
/* Nothing to press: no depress, and no pointer events to produce one. */
html.fa-touch .hud-item-slot.is-empty,
html.fa-touch-capable .hud-item-slot.is-empty { pointer-events: none; }

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
  gap: 1px;
  pointer-events: none;
  will-change: transform;
}
/* ── THE BRAWLER NAMEPLATE (graphics campaign F1, docs/REVAMP.md §2.1) ─────────
   Name in the team colour, the HP as a big stroked numeral, a thick two-tone bar —
   the reference's over-head unit, measured on two of its plates at 126-148 x 60-75 px
   at 900-px equivalent (name row to bar bottom). Sized in vh so a phone gets the same
   plate in proportion, clamped so it never drops below legibility.
   NO backing plate, deliberately: the old 106x28 pill was a dark slab over the floor
   (§2.1's "dark pill, no name, no number"). Legibility comes from the STROKE — every
   glyph sits on its own 3-4 px dark outline (paint-order: stroke fill), which is also
   what hud_accept measures it against (a stroked glyph's backdrop is its stroke).
   Team colours are the HUD's own (#3FCB86 you, #E6493F them) and the seat ring's
   (render/seatRings.ts), so ring, plate and corner say "you"/"them" in one vocabulary;
   the enemy NAME takes the lighter #FF6B5C of the same family, 6.5:1 on its stroke
   where #E6493F is 4.7:1. */
.hud-float-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(10px, 2vh, 18px);
  line-height: 1;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  -webkit-text-stroke: 3px #1a1224;
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(0,0,0,0.45);
}
.hud-float--player .hud-float-name { color: #3FCB86; }
.hud-float--enemy .hud-float-name { color: #FF6B5C; }
.hud-float-hp {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(14px, 3.3vh, 30px);
  line-height: 1;
  color: #FFF3DE;
  white-space: nowrap;
  -webkit-text-stroke: 4px #1a1224;
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(0,0,0,0.5);
  /* Sits ON the bar's top edge, the way the reference's numeral does. */
  margin-bottom: calc(clamp(7px, 1.6vh, 15px) * -0.35);
  position: relative;
  z-index: 1;
}
.hud-float-bar {
  width: clamp(60px, 13.5vh, 122px);
  height: clamp(7px, 1.6vh, 15px);
  background: #241a30;
  border: 2.5px solid #1a1224;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 0 2px 0 rgba(0,0,0,0.4);
}
/* TWO-TONE: the team colour over a darker band of the same hue — a bar with a lit top
   and a shaded bottom reads as an object, not a flat swatch. */
.hud-float-fill {
  height: 100%;
  transition: width 0.15s ease-out;
}
.hud-float--player .hud-float-fill { background: linear-gradient(180deg, #5FE0A0 0 50%, #2E9E68 50% 100%); }
.hud-float--enemy .hud-float-fill { background: linear-gradient(180deg, #F2665C 0 50%, #B8302A 50% 100%); }
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
/* .is-playing marks a LIVE number. Its rise is driven per frame by update() (UI-02 —
   see dmgKeyframe); it used to be the 0.85 s hud-dmg-rise keyframe on the document
   timeline, which a slow renderer finished between frames and a frozen capture held at
   opacity 0. The class is kept because hud_accept selects .hud-dmg.is-playing.
   (No backticks in this comment: the whole block is a template literal.) */
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
`,HE=["countdown-tick","match-started","match-ended","weapon-fired","weapon-fired:giantSlam","projectile-spawned","projectile-destroyed:hit-target","projectile-destroyed:hit-cover","projectile-destroyed:expired","hit-landed:weapon","hit-landed:trail","hit-landed:hazard","hit-landed:fog","heal","death","splat-created","trail-mark-created","cast-started","cast-cancelled","item-revived"],_E="hamburger",zE="donut";function i0(t){const e=new URLSearchParams(location.search).get(t);return e&&Te.includes(e)?e:null}function PE(){const t=new URLSearchParams(location.search).get("fighters");if(!t)return null;const e=[];for(const a of t.split(";")){const[o,n]=a.split("@"),s=o?.trim();if(!s||!Te.includes(s))return null;const i={characterId:s};if(n){const[r,l]=n.split(",").map(Number);if(!Number.isFinite(r)||!Number.isFinite(l))return null;i.spawn={x:r,y:l}}e.push(i)}return e.length>=3?e:null}function $E(t){if(!t)return[];const e=[];for(const a of t){if(e.length>=Rt)break;if(typeof a!="string"||!Object.hasOwn(Le,a))continue;const o=a;e.includes(o)||e.push(o)}return e}function BE(){const t=new URLSearchParams(location.search).get("items");return t===null?null:t.split(",").map(e=>e.trim()).filter(Boolean)}function ti(t){const e=new URLSearchParams(location.search).get(t);if(e===null)return null;const a=Number(e);return Number.isFinite(a)?a:null}function UE(t){if(t.type!=="hit-landed")return t;const e=t.targetRole??"enemy",a=t.source.kind==="trail"&&t.source.ownerRole===void 0?{...t.source,ownerRole:T0(e)}:t.source;return{...t,targetRole:e,source:a}}const qE=ae+.35;class go{constructor(e){this.opts=e,this.playerId=e.playerCharacterId??i0("player")??_E,this.enemyId=e.enemyCharacterId??i0("enemy")??zE;const a=Ga(e.playerLevel??ti("level")??Io);this.levels={player:a,enemy:z0(a)},this.roster=e.roster&&e.roster.length>rt&&e.roster.length<=Jt?e.roster.slice():null,this.items=$E(e.items?.length?e.items:BE()??void 0),this.characterIds=this.qaFighters?this.qaFighters.map(n=>n.characterId):this.roster?this.roster.slice():[this.playerId,this.enemyId];const o=Number(new URLSearchParams(location.search).get("simSpeed"));this.simSpeed=Number.isFinite(o)&&o>0?Math.min(50,o):1,this.stage=new xh({container:e.container,background:16764810,fog:{color:16764810,near:40,far:130},camera:{pitchDeg:58,yawDeg:0,frameMode:"fair"}}),this.stage.scene.add(this.arena.build()),this.fogRing=m2(this.arena.center),this.stage.scene.add(this.fogRing.root),this.vfx=new RE(this.stage.scene),this.hud=LE(e.hudRoot,{onRestart:()=>this.restart(),onSelectWeapon:n=>this.input.selectWeapon(n),onUseItem:n=>this.input.pressItem(n)}),this.hud.setCharacters(this.characterIds),this.input=new s2(this.stage.canvas),this.input.setWeaponCount(ie[this.characterIds[Ce]].weapons.length),this.pointerLock=mx({target:this.stage.canvas,pause:()=>this.pause(),resume:()=>this.resume(),onLockChange:n=>this.input.setPointerLocked(n)}),this.state=this.newMatch(),this.spawnMatch(),window.__matchDebug=this.debug,window.__feelDebug=this.feel,window.__feelEvent=n=>this.handleEvents([UE(n)]),window.__matchArena=this.arena,window.addEventListener("resize",this.handleResize),this.raf=requestAnimationFrame(this.loop)}stage;arena=Zg();vfx;audio=Qb();hud;input;pointerLock;fogRing;playerId;enemyId;levels;characterIds;qaFighters=PE();roster;items;models=[];state;eliminated=[];killedBy=[];viewSubject=Ce;spectateDwellMs=0;static SPECTATE_DWELL_MS=1350;endedOutcome=null;endedPayout=null;localResultSent=!1;clock=new Jg;raf=0;disposed=!1;readyFired=!1;isPaused=!1;lastPhase=null;raycaster=new Qg;groundPlane=new ew(new pe(0,1,0),0);rayHit=new pe;projectVec=new pe;projectileOrigins=new Map;simSpeed;qaFogRadius=ti("fogRadius");qaPlayerX=ti("px");qaPlayerY=ti("py");debug={phase:"countdown",winner:null,paused:!1,moveX:0,moveY:0,attack:!1,facingX:0,facingY:0,selectedWeapon:0,pointerLocked:!1,qaSpawnInsideCover:null,frames:0,viewSubject:Ce,viewReason:"local",loadouts:[]};feel={events:Object.fromEntries(HE.map(e=>[e,0])),responses:{vfx:0,shake:0,hitStop:0,knockback:0,damageNumber:0,screenFlash:0},hitStopBudgetMs:0,hitStopBankedMs:0,lastHitStopMs:0,rawDtMs:0,stepDtMs:0,stepCalls:0,maxStepCallMs:0,frames:0,frozenFrames:0,repayingFrames:0,peakHitAmount:0,peakShakeM:0,shakeSumM:0,shakeRawSumM:0,peakShakeRawM:0};hitStopBudgetMs=0;hitStopBankedMs=0;static HITSTOP_TRICKLE=.05;static HITSTOP_CATCHUP_RATE=3;static SHAKE_MAX_M=.4;shakeFadeUnits=-1;knockback=[];restart(){this.spawnMatch(),this.resume()}get paused(){return this.isPaused}pause(){this.isPaused=!0,this.pointerLock.release(),this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.hudSafeArrow(),observerSlot:this.viewSubject,aim:null,...this.hudResult()})}resume(){this.isPaused=!1,this.pointerLock.engage()}resize(){this.stage.resize()}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),window.__matchDebug===this.debug&&delete window.__matchDebug,window.__feelDebug===this.feel&&delete window.__feelDebug,window.__matchArena===this.arena&&delete window.__matchArena,delete window.__feelEvent,window.removeEventListener("resize",this.handleResize),this.pointerLock.dispose(),this.input.dispose(),this.hud.dispose(),this.vfx.dispose(),this.fogRing.dispose();for(const e of this.models)e.dispose();this.stage.dispose()}newMatch(){return this.qaFighters?Ds(this.arena,this.qaFighters):this.roster?Ds(this.arena,this.roster.map((e,a)=>({characterId:e,level:a===Ce?this.levels.player:this.levels.enemy,items:a===Ce?this.items:void 0}))):this.items.length===0?Ds(this.arena,this.playerId,this.enemyId,this.levels):Ds(this.arena,[{characterId:this.playerId,level:this.levels.player,items:this.items},{characterId:this.enemyId,level:this.levels.enemy}])}spawnMatch(){this.state=this.newMatch(),this.applyQaSetup();for(const n of this.models)this.stage.scene.remove(n.root),n.dispose();const e=qe(this.state);this.debug.loadouts=e.map(n=>n.item.equipped.slice()),this.models=e.map((n,s)=>vh(this.characterIds[s]??n.characterId));for(const n of this.models)this.stage.scene.add(n.root);this.models.forEach((n,s)=>{this.syncModelTransform(n,e[s]),n.play("idle")}),this.vfx.clear(),this.audio.reset(),this.input.reset(),this.projectileOrigins.clear(),this.eliminated.length=0,this.killedBy.length=0,this.viewSubject=Ce,this.spectateDwellMs=0,this.localResultSent=!1,this.hitStopBudgetMs=0,this.hitStopBankedMs=0;for(const n of Object.keys(this.feel.events))this.feel.events[n]=0;this.feel.responses.vfx=0,this.feel.responses.shake=0,this.feel.responses.hitStop=0,this.feel.responses.knockback=0,this.feel.responses.damageNumber=0,this.feel.responses.screenFlash=0,this.feel.frames=0,this.feel.frozenFrames=0,this.feel.repayingFrames=0,this.feel.peakHitAmount=0,this.feel.peakShakeM=0,this.feel.lastHitStopMs=0,this.feel.shakeSumM=0,this.feel.shakeRawSumM=0,this.feel.peakShakeRawM=0,this.knockback=e.map(()=>({x:0,z:0}));const a=Be(this.state),o=_e(a.x,a.y);this.stage.rig.snapTo(o.x,o.z),this.stage.lighting.focus(o.x,o.z),this.fogRing.update(this.state.safeRadius,this.state.elapsed/1e3,this.state.phase==="playing",this.stage.rig),this.lastPhase=null,this.notifyPhase()}applyQaSetup(){const e=Be(this.state);if(this.qaPlayerX!==null&&(e.x=this.qaPlayerX),this.qaPlayerY!==null&&(e.y=this.qaPlayerY),(this.qaPlayerX!==null||this.qaPlayerY!==null)&&this.checkQaSpawn(),this.qaFogRadius===null)return;const a=this.arena.maxSafeRadius;this.state.phase="playing",this.state.countdownValue=0,this.state.countdownTick=0,this.state.startFlashTimer=0;const o=Math.max(wi(this.state.fighters.length),a*(Wl/Wa));if(this.qaFogRadius<=o){this.qaFogRadius>Bl&&console.warn(`[QA] ?fogRadius=${this.qaFogRadius} is below the lowest radius the schedule ever reaches (${o.toFixed(2)} wu — DECISIONS §2 collapses the ring at ${tw/1e3} s). Snapped to SUDDEN DEATH (radius 0). Ask for a larger radius if you wanted a ring.`),this.state.timeRemaining=Wl,this.state.safeRadius=Bl;return}const n=K.clamp(this.qaFogRadius,o,a),s=K.clamp(n/a,0,1);this.state.timeRemaining=Wa*s,this.state.safeRadius=n}checkQaSpawn(){const e=Be(this.state),a=this.arena.cover.find(o=>ls(e.x,e.y,e.size,e.size,o.x,o.y,o.w,o.h));this.debug.qaSpawnInsideCover=a?`${a.kind??"cover"} @(${a.x},${a.y}) ${a.w}x${a.h}`:null,a&&console.warn(`[QA] ?px=${e.x}&py=${e.y} places the player INSIDE cover "${a.kind??"cover"}" @(${a.x},${a.y}) ${a.w}x${a.h}. There is no depenetration in movement.ts, so the fighter cannot move at all — input is fine, the sim is refusing every step. Pick a point at least ${((e.size+Math.max(a.w,a.h))/2).toFixed(0)} wu from that centre.`)}aimCursor(){const e=this.input.aimOffsetPx;if(!e)return null;const a=Be(this.state),o=this.projectPointToScreen(a.x,a.y,0);return o?{from:o,at:{x:o.x+e.x,y:o.y+e.y}}:null}buildInput(){const e=this.state.phase==="playing",a=e?this.input.moveAxes():{x:0,y:0};let o;if(e){const r=this.aimCursor();let l=this.input.mouseNdc;if(r){const h=this.stage.canvas.getBoundingClientRect();l={x:(r.at.x-h.left)/h.width*2-1,y:-((r.at.y-h.top)/h.height*2-1)}}if(l){this.raycaster.setFromCamera(new aw(l.x,l.y),this.stage.rig.camera);const h=this.raycaster.ray.intersectPlane(this.groundPlane,this.rayHit);if(h){const c=Be(this.state);o={x:Wc(h.x)-c.x,y:Wc(h.z)-c.y}}}}const n=this.input.takeAttackPress(),s=e&&(this.input.attackHeld||n),i=this.input.takeItemPress();return{move:a,aim:o,selectedWeapon:this.input.selectedWeapon,attack:s,useItem:e?i:null}}syncModelTransform(e,a){const o=_e(a.x,a.y);e.root.position.set(o.x,0,o.z),e.root.rotation.y=Math.atan2(a.facing.x,a.facing.y)}attackerSlotOf(e,a){let o=null;if(e.kind==="weapon"?o=$n(this.state,e,a):e.kind==="trail"&&(o=yd(this.state,e)),!o)return;const n=qe(this.state).indexOf(o);return n>=0?n:void 0}colorForDamageSource(e,a){switch(a.kind){case"weapon":{const o=$n(this.state,a,e);return ie[o.characterId].weapons.find(s=>s.key===a.weaponKey)?.color??"#FFFFFF"}case"trail":return Wt(a.ownerId,a.ownerRole)===Ce?"#FF9EC4":"#FFD27A";case"hazard":return"#FF7A3D";case"fog":return"#B98CE6";default:return"#FFFFFF"}}triggerHitStop(e){this.hitStopBudgetMs=Math.max(this.hitStopBudgetMs,e),this.feel.responses.hitStop++,this.feel.lastHitStopMs=e}kick(e,a,o){const n=Math.min(e,go.SHAKE_MAX_M),s=n*a;this.stage.rig.shake(s,o),this.feel.responses.shake++,this.feel.shakeSumM+=s,this.feel.shakeRawSumM+=n,s>this.feel.peakShakeM&&(this.feel.peakShakeM=s),n>this.feel.peakShakeRawM&&(this.feel.peakShakeRawM=n)}shakeProximity(e,a){this.shakeFadeUnits<0&&(this.shakeFadeUnits=this.stage.rig.shakeFadeRadiusUnits());const o=this.viewObserver();return ow(Math.hypot(e-o.x,a-o.y),this.shakeFadeUnits)}eventOnAnyScreen(e,a){this.shakeFadeUnits<0&&(this.shakeFadeUnits=this.stage.rig.shakeFadeRadiusUnits());const o=this.viewObserver();return nw(Math.hypot(e-o.x,a-o.y),this.shakeFadeUnits)}viewObserver(){return qe(this.state)[this.viewSubject]??Be(this.state)}updateViewSubject(e){const a=qe(this.state);if(a[Ce]?.alive){if(this.viewSubject!==Ce){this.shakeFadeUnits<0&&(this.shakeFadeUnits=this.stage.rig.shakeFadeRadiusUnits());const s=this.stage.rig.targetUnits(),i=Gc({seats:a,localSlot:Ce,current:this.viewSubject,killedBy:this.killedBy,cameraX:s.x,cameraY:s.y,cutBeyondUnits:this.shakeFadeUnits}),r=a[Ce];if(i.cut&&r){const l=_e(r.x,r.y);this.stage.rig.snapTo(l.x,l.z),this.stage.lighting.focus(l.x,l.z)}}this.viewSubject=Ce,this.spectateDwellMs=0,this.audio.setListener(Ce),this.debug.viewSubject=Ce,this.debug.viewReason="local";return}if(this.spectateDwellMs>0){this.spectateDwellMs=Math.max(0,this.spectateDwellMs-e),this.debug.viewReason="dwell";return}this.shakeFadeUnits<0&&(this.shakeFadeUnits=this.stage.rig.shakeFadeRadiusUnits());const o=this.stage.rig.targetUnits(),n=Gc({seats:a,localSlot:Ce,current:this.viewSubject,killedBy:this.killedBy,cameraX:o.x,cameraY:o.y,cutBeyondUnits:this.shakeFadeUnits});if(n.slot!==this.viewSubject&&(this.viewSubject=n.slot,n.cut)){const s=a[n.slot];if(s){const i=_e(s.x,s.y);this.stage.rig.snapTo(i.x,i.z),this.stage.lighting.focus(i.x,i.z)}}this.audio.setListener(this.viewSubject),this.debug.viewSubject=this.viewSubject,this.debug.viewReason=n.reason}applyKnockback(e,a,o,n){const s=qe(this.state)[e],i=this.knockback[e];if(!s||!i)return;const r=s.x-a,l=s.y-o,h=Math.hypot(r,l);if(h<1e-4)return;const c=K.clamp(n,0,.22);i.x+=r/h*c,i.z+=l/h*c,this.feel.responses.knockback++}handleEvents(e){const a=[],o=[];for(const n of e){const s=n.type==="hit-landed"?`hit-landed:${n.source.kind}`:n.type==="projectile-destroyed"?`projectile-destroyed:${n.reason}`:n.type;switch(s in this.feel.events&&this.feel.events[s]++,n.type){case"weapon-fired":{const i=this.models[Wt(n.fighterId,n.fighterRole)],r=vt(this.state,n.fighterId,n.fighterRole);if(!i)break;const l=ie[r.characterId].weapons,h=l.findIndex(d=>d.key===n.weaponKey),c=l[h<0?0:h];i.play("attack",{weaponIndex:h<0?0:h}),c&&(this.vfx.spawnWeaponCast(r.x,r.y,r.facing,c,r.characterId),this.feel.responses.vfx++,c.giantSlam&&(this.feel.events["weapon-fired:giantSlam"]++,this.eventOnAnyScreen(r.x,r.y)&&(this.hud.flashScreen(c.color),this.feel.responses.screenFlash++,this.triggerHitStop(120)),this.kick(.55,this.shakeProximity(r.x,r.y),2.6),window.__vfxDebugGiantSlamCount=(window.__vfxDebugGiantSlamCount??0)+1));break}case"hit-landed":{const i=Wt(n.targetId,n.targetRole),r=this.models[i],l=n.source.kind==="weapon"&&n.source.itemId==="blue_cheese";l||r?.play("hit",{intensity:K.clamp(n.amount/12,.25,1)});const h=this.colorForDamageSource(n.targetRole,n.source);if(a[i]=h,o[i]=this.attackerSlotOf(n.source,n.targetRole),n.source.kind==="fog"){const g=this.projectPointToScreen(n.x,n.y,1.3);g&&(this.hud.spawnDamageNumber(g,n.amount,{fog:!0}),this.feel.responses.damageNumber++),i===Ce&&(this.hud.flashFogTick(),this.feel.responses.screenFlash++);break}if(l){const g=this.projectPointToScreen(n.x,n.y,1.3);g&&(this.hud.spawnDamageNumber(g,n.amount),this.feel.responses.damageNumber++);break}let c;if(n.source.kind==="weapon"){const g=$n(this.state,n.source,n.targetRole),w=n.source.weaponKey,b=ie[g.characterId].weapons.find(y=>y.key===w);b&&(c={weapon:b,characterId:g.characterId,fromXWU:g.x,fromYWU:g.y})}this.vfx.spawnImpactBurst(n.x,n.y,h,n.amount,c),this.feel.responses.vfx++,n.amount>this.feel.peakHitAmount&&(this.feel.peakHitAmount=n.amount);const d=this.projectPointToScreen(n.x,n.y,1.3);d&&(this.hud.spawnDamageNumber(d,n.amount),this.feel.responses.damageNumber++);const p=n.source.kind==="weapon",u=K.clamp(.012+n.amount*.0175,.012,go.SHAKE_MAX_M),m=i===Ce?1.25:1,f=vt(this.state,n.targetId,n.targetRole);if(this.kick(u*m*(p?1:.45),this.shakeProximity(f.x,f.y)),p&&this.eventOnAnyScreen(f.x,f.y)&&this.triggerHitStop(K.clamp(10+n.amount*4.6,16,105)),n.source.kind==="weapon"){const g=n.source,w=$n(this.state,g,n.targetRole);(ie[w.characterId].weapons.find(x=>x.key===g.weaponKey)?.knockback??0)>0||this.applyKnockback(i,w.x,w.y,.05+n.amount*.006)}else if(n.source.kind==="trail"){const g=yd(this.state,n.source);this.applyKnockback(i,g.x,g.y,.03)}break}case"projectile-spawned":{this.projectileOrigins.set(n.id,{color:n.color,x:n.x,y:n.y});break}case"projectile-destroyed":{const i=this.projectileOrigins.get(n.id);if(this.projectileOrigins.delete(n.id),n.reason!=="hit-cover")break;this.vfx.spawnCoverScuff(n.x,n.y,i?.color??"#FFFFFF",i?n.x-i.x:0,i?n.y-i.y:0);break}case"heal":{const i=vt(this.state,n.fighterId,n.fighterRole);this.vfx.spawnHealPulse(i.x,i.y),this.feel.responses.vfx++;const r=this.projectPointToScreen(i.x,i.y,1.6);r&&(this.hud.spawnDamageNumber(r,n.amount,{heal:!0}),this.feel.responses.damageNumber++);break}case"death":{const i=Wt(n.fighterId,n.fighterRole);this.eliminated.push(i),this.killedBy[i]=o[i]??null,i===this.viewSubject&&(this.spectateDwellMs=go.SPECTATE_DWELL_MS),this.models[i]?.play("death");const r=vt(this.state,n.fighterId,n.fighterRole),l=a[i]??"#FFFFFF";this.vfx.spawnDeathBurst(r.x,r.y,l),this.feel.responses.vfx++,this.kick(.42,this.shakeProximity(r.x,r.y),3),this.eventOnAnyScreen(r.x,r.y)&&this.triggerHitStop(90);break}case"cast-started":{const i=Wt(n.fighterId,n.fighterRole),r=vt(this.state,n.fighterId,n.fighterRole);if(i!==Ce&&!mi(this.state,this.viewObserver(),r))break;const l=ie[r.characterId].weapons.find(h=>h.key===n.weaponKey);if(!l)break;this.vfx.spawnCastTelegraph(n.fighterId,r.x,r.y,r.facing,l,r.characterId,n.castMs),this.feel.responses.vfx++;break}case"item-revived":{this.vfx.spawnHealPulse(n.x,n.y),this.feel.responses.vfx++;const i=this.projectPointToScreen(n.x,n.y,1.6);i&&(this.hud.spawnDamageNumber(i,n.hp,{heal:!0}),this.feel.responses.damageNumber++);break}case"cast-cancelled":this.vfx.cancelCastTelegraph(n.fighterId,n.reason==="death"?"death":"stun");break}}}groundOnScreen(e,a){return this.projectVec.set(e,0,a),this.projectVec.project(this.stage.rig.camera),this.projectVec.z<=1&&Math.abs(this.projectVec.x)<=1&&Math.abs(this.projectVec.y)<=1}projectToScreen(e,a){if(!a||!this.groundOnScreen(e.root.position.x,e.root.position.z)||(this.projectVec.set(e.root.position.x,qE,e.root.position.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1))return null;const o=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*o.width+o.left,y:(1-(this.projectVec.y*.5+.5))*o.height+o.top}}projectPointToScreen(e,a,o){const n=_e(e,a);if(!this.groundOnScreen(n.x,n.z)||(this.projectVec.set(n.x,o,n.z),this.projectVec.project(this.stage.rig.camera),this.projectVec.z>1))return null;const s=this.stage.canvas.getBoundingClientRect();return{x:(this.projectVec.x*.5+.5)*s.width+s.left,y:(1-(this.projectVec.y*.5+.5))*s.height+s.top}}safeArrow(){const e=Be(this.state),a=this.arena.center.x-e.x,o=this.arena.center.y-e.y,n=Math.hypot(a,o);if(n<.001)return null;const s=this.projectPointToScreen(e.x,e.y,.35),i=this.projectPointToScreen(e.x+a/n*80,e.y+o/n*80,.35);if(!s||!i)return null;const r=i.x-s.x,l=i.y-s.y;return Math.hypot(r,l)<1?null:{at:s,angleRad:Math.atan2(l,r)}}notifyPhase(){this.state.phase!==this.lastPhase&&(this.lastPhase=this.state.phase,this.pointerLock.setMatchActive(this.state.phase!=="ended"),this.endedOutcome=this.state.phase==="ended"?this.outcome():null,this.state.phase!=="ended"&&(this.endedPayout=null),this.opts.onPhase?.(this.state.phase,this.state.winner,this.endedOutcome))}stepSim(e,a,o){const n=a>0&&e>a?Math.ceil(e/a-1e-9):1,s=e/n,i=this.state.phase==="ended",r=ip(this.state,s,o);let l=1;if(n>1){const h=o.useItem==null?o:{...o,useItem:null};for(let c=1;c<n&&!(!i&&this.state.phase==="ended");c++){for(const d of ip(this.state,s,h))r.push(d);l++}}return this.feel.stepCalls=l,this.feel.maxStepCallMs=s,r}retireShotsAfterWhistle(){const e=this.state.projectiles;if(e.length!==0){for(const a of e)this.projectileOrigins.delete(a.id);e.length=0}}notifyLocalResult(){this.localResultSent||this.state.phase==="playing"&&(Be(this.state).alive||this.localReviveStillPossible()||(this.localResultSent=!0,this.opts.onLocalResult?.(this.outcome())))}localReviveStillPossible(){const e=Be(this.state);return e.item.revivesLeft<=0||e.item.killerId===la?!1:qe(this.state)[e.item.killerId]?.alive===!0}knockedOutOutcome(){return this.state.phase!=="playing"||Be(this.state).alive?null:this.outcome()}showPayout(e){this.endedPayout=e}hudSafeArrow(){return Be(this.state).alive?this.safeArrow():null}hudResult(){return{place:this.hudPlace(),order:this.endedOutcome?.places??null,payout:this.endedOutcome?this.endedPayout:null}}hudPlace(){const e=this.endedOutcome;return!e||e.seats<=1||e.localPlace<0?null:{place:e.localPlace+1,of:e.seats}}outcome(){const a={seats:qe(this.state).map((n,s)=>({id:s,alive:n.alive,hp:n.hp,maxHp:n.maxHp,x:n.x,y:n.y,deaths:n.deaths})),center:{x:this.arena.center.x,y:this.arena.center.y},eliminated:this.eliminated,winnerId:this.state.winnerId??null},o=tb(a);return{seats:a.seats.length,places:o,localPlace:o.indexOf(Ce),winnerId:a.winnerId}}handleResize=()=>this.resize();publishDebug(e,a,o){const n=this.debug;n.phase=this.state.phase,n.winner=this.state.winner,n.paused=this.isPaused,n.moveX=e,n.moveY=a,n.attack=o;const s=Be(this.state);n.facingX=s.facing.x,n.facingY=s.facing.y,n.selectedWeapon=this.input.selectedWeapon,n.pointerLocked=this.input.pointerLocked,n.frames++}decayKnockback(e){const a=Math.exp(-e*14);for(const o of this.knockback)o.x*=a,o.z*=a,Math.abs(o.x)<1e-4&&(o.x=0),Math.abs(o.z)<1e-4&&(o.z=0)}loop=()=>{if(this.disposed)return;const e=Math.min(this.clock.getDelta(),1/20)*this.simSpeed,a=e*1e3;if(this.isPaused){this.publishDebug(0,0,!1),this.stage.render(0),this.raf=requestAnimationFrame(this.loop);return}let o;if(this.hitStopBudgetMs>0)this.hitStopBudgetMs=Math.max(0,this.hitStopBudgetMs-a),o=a*go.HITSTOP_TRICKLE,this.hitStopBankedMs+=a-o;else if(this.hitStopBankedMs>0){const u=Math.min(this.hitStopBankedMs,a*go.HITSTOP_CATCHUP_RATE);this.hitStopBankedMs-=u,o=a+u}else o=a;const n=o/1e3;this.feel.rawDtMs=a,this.feel.stepDtMs=o,this.feel.hitStopBudgetMs=this.hitStopBudgetMs,this.feel.hitStopBankedMs=this.hitStopBankedMs,this.feel.frames++,o<a*.5?this.feel.frozenFrames++:o>a*1.05&&this.feel.repayingFrames++;const s=qe(this.state),i=s.map(u=>({x:u.x,y:u.y})),r=this.buildInput();this.state.phase==="ended"&&this.retireShotsAfterWhistle();const l=this.stepSim(o,a,r);this.handleEvents(l),this.audio.handleEvents(l,this.state),this.notifyLocalResult(),this.notifyPhase(),this.publishDebug(r.move.x,r.move.y,r.attack===!0);const h=s.map((u,m)=>u.x!==i[m].x||u.y!==i[m].y);this.models.forEach((u,m)=>{const f=s[m];if(!f)return;this.syncModelTransform(u,f);const g=this.knockback[m];g&&(u.root.position.x+=g.x,u.root.position.z+=g.z)}),this.decayKnockback(e),this.updateViewSubject(a);const c=this.viewObserver();this.models.forEach((u,m)=>{if(m===Ce)return;const f=s[m];f&&(u.root.visible=mi(this.state,c,f))}),this.models.forEach((u,m)=>{s[m]?.alive&&u.play(h[m]?"run":"idle")});const d=this.state.elapsed/1e3;this.models.forEach((u,m)=>{const f=s[m];f&&u.update({dt:n,elapsed:d,moveSpeed01:f.alive&&h[m]?1:0,health01:f.hp/f.maxHp})}),this.arena.update?.(n,d),this.vfx.sync(this.state),this.vfx.updateEffects(e),this.fogRing.update(this.state.safeRadius,this.clock.elapsedTime,this.state.phase==="playing",this.stage.rig);const p=_e(c.x,c.y);this.stage.rig.follow(p.x,p.z),this.stage.lighting.focus(p.x,p.z),window.__vfxDebugScreen={player:this.projectPointToScreen(s[0].x,s[0].y,0),enemy:s[1]?this.projectPointToScreen(s[1].x,s[1].y,0):null,slots:s.map(u=>this.projectPointToScreen(u.x,u.y,0))},this.hud.update(this.state,{selectedWeapon:this.input.selectedWeapon,safeArrow:this.hudSafeArrow(),aim:Be(this.state).alive?this.aimCursor():null,observerSlot:this.viewSubject,...this.hudResult()}),this.hud.updateFloatingBars(this.models.map((u,m)=>{const f=s[m];if(!f)return null;const g=m===Ce?f.alive:f.alive&&mi(this.state,c,f);return this.projectToScreen(u,g)}),s.map(u=>u.hp/u.maxHp)),this.stage.setFighterSeats(this.models.map((u,m)=>({root:u.root,local:m===Ce,alive:s[m]?.alive??!1}))),this.stage.render(e),this.readyFired||(this.readyFired=!0,window.__gameReady=!0,window.__previewReady=!0),this.raf=requestAnimationFrame(this.loop)}}function WE(t){return new go(t)}const Ac="Escape";function r0(t){const e=t%100>=11&&t%100<=13?"th":t%10===1?"st":t%10===2?"nd":t%10===3?"rd":"th";return`${t}${e}`}function GE(t,e){if(e.name!=="match")throw new Error("createMatchScreen: wrong route");Ea("fa-match-styles",jE),Ta();const a=Ue("div","fa-screen-bare fa-match");a.innerHTML=`
    <!-- The chip is NOT inside .match-corner. It has to be positioned against the
         screen so it can sit clear of the thumb zone, and .match-corner is itself
         absolutely positioned — so nesting it there made 'top: 96px' resolve against
         the corner and put the chip 140px BELOW the bottom of the frame. Measured,
         not reasoned about: tools/tmp/thumbzone.mjs. -->
    <button class="match-chip" type="button" data-el="pause" aria-label="Pause">${P("pause",{size:"22px"})}</button>

    <div class="match-corner">
      <button class="fa-btn fa-btn--quiet match-exit" type="button" data-el="exit">${P("back")} Menu</button>
    </div>

    <div class="match-sheet" data-el="sheet">
      <div class="match-sheet-card">
        <div class="match-sheet-pane" data-el="pane-pause">
          <p class="match-sheet-title">Paused</p>
          <button class="fa-btn fa-btn--primary" type="button" data-el="resume">${P("play")} Resume</button>
          <button class="fa-btn fa-btn--quiet" type="button" data-el="change">${P("swap")} Change Fighter</button>
          <button class="fa-btn fa-btn--quiet" type="button" data-el="quit">${P("home")} Quit to Home</button>
        </div>
        <div class="match-sheet-pane match-sheet-pane--confirm" data-el="pane-confirm" hidden>
          <p class="match-sheet-title">Leave the match?</p>
          <p class="match-sheet-body" data-el="confirmbody"></p>
          <button class="fa-btn fa-btn--primary" type="button" data-el="keep">${P("play")} Keep Playing</button>
          <button class="fa-btn fa-btn--quiet match-leave" type="button" data-el="leave">${P("close")} Leave</button>
        </div>
      </div>
    </div>
  `;const o=E=>{const A=a.querySelector(`[data-el="${E}"]`);if(!A)throw new Error(`matchScreen: missing element "${E}"`);return A},n=o("sheet"),s=o("pause"),i=o("exit");let r=!1,l=null;const h=E=>E!==null&&E.localPlace>=0&&E.seats>=rt&&E.seats<=Jt;function c(E,A){if(!r){r=!0;const C=h(E)?t.profile.recordPlacement(E.localPlace,E.seats):t.profile.recordResult(A==="player");l={payout:{trophies:C.trophies,coins:C.coins,xp:G0(C.place,C.seats),chests:C.chests},place:C.place,seats:C.seats}}l&&p.showPayout(l.payout)}const d=e.seats===void 0?void 0:S0(e.player,e.enemy,e.seats),p=WE({container:t.gameHost,hudRoot:t.hudRoot,playerCharacterId:e.player,enemyCharacterId:e.enemy,roster:d,items:Ph(Bh(t.profile.economy)),playerLevel:t.profile.characterLevel(e.player),onLocalResult(E){h(E)&&c(E,null)},onPhase(E,A,C){E==="ended"?(c(C,A),a.classList.add("is-ended")):(r=!1,l=null,a.classList.remove("is-ended"))}}),u=o("pane-pause"),m=o("pane-confirm"),f=o("leave"),g="22px";function w(E){s.innerHTML=P(E?"play":"pause",{size:g}),s.setAttribute("aria-label",E?"Resume":"Pause")}const b=350;let y=0,x=null;function k(){if(l)return`You finished ${r0(l.place+1)} of ${l.seats} — that is already banked.`;const E=p.knockedOutOutcome();return h(E)?`You are out in ${r0(E.localPlace+1)} of ${E.seats}. Leaving banks that now and gives up your Leftovers revive.`:"This match ends now — no trophies, coins or XP from it."}function T(E,A,C){x=E,f.innerHTML=`${P(C)} ${A}`,o("confirmbody").textContent=k();const R=l!==null||p.knockedOutOutcome()!==null;o("keep").innerHTML=`${P("play")} ${R?"Keep Watching":"Keep Playing"}`,u.hidden=!0,m.hidden=!1,f.disabled=!0,window.clearTimeout(y),y=window.setTimeout(()=>{f.disabled=!1},b)}function v(){x=null,window.clearTimeout(y),f.disabled=!0,m.hidden=!0,u.hidden=!1}function O(E){E||v(),E?p.pause():p.resume(),n.classList.toggle("is-open",E),w(E);const A=document.activeElement;!E&&A instanceof HTMLElement&&a.contains(A)&&A.blur()}s.addEventListener("mousedown",E=>E.preventDefault());const D=()=>n.classList.contains("is-open");s.addEventListener("click",()=>O(!D())),o("resume").addEventListener("click",()=>O(!1)),o("change").addEventListener("click",()=>T({name:"characters"},"Change Fighter","swap")),o("quit").addEventListener("click",()=>T({name:"home"},"Quit to Home","home")),o("keep").addEventListener("click",()=>O(!1)),f.addEventListener("click",()=>{if(!x)return;const E=p.knockedOutOutcome();h(E)&&c(E,null),t.navigate(x)}),i.addEventListener("click",()=>t.navigate({name:"home"}));const _=E=>{if(E.key===Ac&&!a.classList.contains("is-ended")){if(E.preventDefault(),x!==null){v();return}O(!D())}};return window.addEventListener("keydown",_),i.title=d?d.map(E=>ie[E].name).join(" · "):`${ie[e.player].name} vs ${ie[e.enemy].name}`,{root:a,resize(){p.resize()},dispose(){window.removeEventListener("keydown",_),window.clearTimeout(y),p.dispose(),a.remove()}}}const jE=`
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
/* ONE "Paused" card, not two (F6). With mouse capture on, the sheet now opens OVER the capture
   scrim ('pointerLock.ts', a layer below '#screens'), which stays in its 'lost' state — two
   0.62 backdrops, a 2px blur, and the scrim card's edges either side of this one. Hidden
   only while the sheet is open: if Resume's re-capture is then refused (Chrome rate-limits
   a re-lock for ~1s after an Esc), the scrim is still 'lost' and comes back by itself. */
body:has(.fa-match .match-sheet.is-open) .plk-scrim { display: none; }
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
`,Gm="food-arena.settings.v1",YE="fa-reduce-motion";function jm(){try{const t=localStorage.getItem(Gm),e=t?JSON.parse(t):{};return{reduceMotion:e.reduceMotion===!0,moveKeys:KE(e.moveKeys)}}catch{return{reduceMotion:!1,moveKeys:{}}}}function Nl(t){try{localStorage.setItem(Gm,JSON.stringify(t))}catch{}}function Ym(){const t=jm();document.documentElement.classList.toggle(YE,t.reduceMotion),yh(t.moveKeys)}const ya=["up","left","down","right"],Un={up:"Move up",left:"Move left",down:"Move down",right:"Move right"},Ro={...ia},VE=[{code:Uh,does:"mutes the game"},{code:Ac,does:"pauses a match"},...Qi.map((t,e)=>({code:t,does:`uses item ${e+1}`})),{code:"Tab",does:"moves between controls"},{code:"Enter",does:"presses the control you are on"},{code:"NumpadEnter",does:"presses the control you are on"},{code:"Space",does:"presses the control you are on"},...Array.from({length:Ti},(t,e)=>[{code:`Digit${e+1}`,does:"picks a weapon"},{code:`Numpad${e+1}`,does:"picks a weapon"}]).flat()];function Vm(t){return VE.find(e=>e.code===t)?.does??null}function Bt(t){if(t.startsWith("Key"))return t.slice(3);if(t.startsWith("Digit"))return t.slice(5);switch(t){case"ArrowUp":return"↑";case"ArrowDown":return"↓";case"ArrowLeft":return"←";case"ArrowRight":return"→";case"Escape":return"Esc";case"Space":return"Space";default:return t}}function yh(t){const e=ia;for(const a of ya){const o=Ro[a],n=t[a];e[a]=n?[n,...o.slice(1).filter(s=>s!==n)]:o}}function KE(t){const e={};if(t===null||typeof t!="object")return e;const a=t,o=new Set;for(const n of ya){const s=a[n];typeof s!="string"||s.length===0||s.length>32||Vm(s)||o.has(s)||ya.some(i=>i!==n&&Ro[i].includes(s))||(o.add(s),e[n]=s)}return e}function XE(t,e,a){const o=Vm(e);if(o)return`${Bt(e)} already ${o}.`;for(const n of ya){if(n===t)continue;if((a[n]??Ro[n][0])===e||Ro[n].includes(e))return`${Bt(e)} is already ${Un[n].toLowerCase()}.`}return null}function ZE(){return ya.some(t=>ia[t][0]!==Ro[t][0])}function l0(){return'<svg class="fa-ic fa-ic--note" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M10.4 17.2V5.4l8.2-1.9v11.7" fill="none" stroke-width="2"/><ellipse cx="7.6" cy="17.4" rx="3" ry="2.5" fill="#FFC93C"/><ellipse cx="15.8" cy="15.2" rx="3" ry="2.5" fill="#FFC93C"/></svg>'}function JE(t){Ea("fa-settings-styles",QE),Ta();const e=Ue("div","fa-screen fa-settings");let a=jm(),o=null;const n=()=>{const S=[],N=ya.flatMap(U=>ia[U].slice(1)).map(Bt);N.length>0&&S.push({action:"Move (fixed)",keys:N}),S.push({action:"Aim",keys:["Mouse"]}),S.push({action:"Fire",keys:["Click"]});const q=Math.min(ie[t.profile.selected].weapons.length,Ti);return q>1&&S.push({action:"Switch weapon",keys:Array.from({length:q},(U,V)=>String(V+1))}),S.push({action:"Use item",keys:Qi.map(Bt)}),S.push({action:"Mute / unmute",keys:[Bt(Uh)]}),S.push({action:"Pause",keys:[Bt(Ac)]}),S},s=()=>`Aim, fire, items, mute and pause are fixed.${ie[t.profile.selected].weapons.length>1?"":` ${ie[t.profile.selected].name} carries one weapon, so there is no weapon-switch key while it is equipped.`} On a phone, twin sticks appear under your thumbs — the left half of the screen moves, the right half aims and fires — in landscape and in portrait alike.`,i=(S,N,q,U)=>`
    <div class="set-row">
      <span class="set-row-label">
        <span class="set-row-icon">${S}</span>
        <span class="set-row-text">
          <span class="set-row-title">${N}</span>
          ${q?`<span class="set-row-sub">${q}</span>`:""}
        </span>
      </span>
      <span class="set-row-control">${U}</span>
    </div>`,r=(S,N,q=!1)=>`<button class="set-toggle" type="button" role="switch" aria-checked="false"
       aria-label="${N}" data-toggle="${S}"${q?' data-clicksound="off"':""}><span class="set-knob"></span></button>`,l=(S,N)=>`<span class="set-slider">
       <input class="set-range" type="range" min="0" max="1" step="0.01"
              aria-label="${N}" data-range="${S}" />
       <span class="set-range-val" data-el="${S}val">100%</span>
     </span>`,h=S=>{const N=kr(S),q=S==="auto"?kr(rw()):"";return`<button class="set-seg-btn" type="button" role="radio" aria-checked="false"
        aria-label="${q?`${N} (${q})`:N}"
        data-el="quality-${S}" data-quality="${S}">
        <span class="set-seg-name">${N}</span>
        ${q?`<span class="set-seg-auto">(${q})</span>`:""}
      </button>`};e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back">${P("back")} Back</button>
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
            <span class="set-row-icon">${P("avatar")}</span>
            <span class="set-row-text">
              <span class="set-row-title">Name</span>
              <span class="set-row-sub">On your lobby badge</span>
            </span>
          </span>
          <span class="set-row-control set-name-wrap">
            <input class="set-name" type="text" data-el="name" aria-label="Player name"
                   maxlength="${Xl}" autocomplete="off" autocapitalize="words"
                   spellcheck="false" enterkeyhint="done" />
            <span class="set-name-count" data-el="namecount"></span>
          </span>
        </div>
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Audio</p>
        <p class="set-locked" data-el="audiostate" hidden></p>
        ${i(P("sound"),"Sound effects","Hits, pickups, menu taps",l("sfx","Sound effects volume"))}
        ${i(P("mute"),"Mute everything","Same as pressing M in a match",r("mute","Mute everything",!0))}
        ${i(l0(),"Music","The menu and lobby theme",r("music","Music"))}
        ${i(l0(),"Music volume","Sits under the effects",l("music","Music volume"))}
      </section>

      <section class="fa-panel set-section">
        <p class="fa-panel-title">Graphics</p>
        <p class="set-locked" data-el="qualitypin" hidden></p>
        <div class="set-seg" role="radiogroup" aria-label="Graphics quality" data-el="qualityrow">
          ${sw.map(S=>h(S)).join("")}
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
        ${i(P("speed"),"Reduce motion","Stops the menus pulsing and drifting",r("motion","Reduce motion"))}
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
      <button class="fa-btn fa-btn--primary set-done" type="button" data-el="done">${P("check")} Done</button>
    </footer>

    <div class="set-confirm" data-el="confirm" hidden>
      <div class="set-confirm-card" role="alertdialog" aria-modal="true" aria-label="Reset progress">
        <span class="set-confirm-icon">${P("cone")}</span>
        <p class="set-confirm-title">Reset everything?</p>
        <p class="set-confirm-sub" data-el="confirmsub"></p>
        <div class="set-confirm-btns">
          <button class="fa-btn fa-btn--quiet" type="button" data-el="cancel">Cancel</button>
          <button class="fa-btn set-reset" type="button" data-el="confirmyes">Yes, reset</button>
        </div>
      </div>
    </div>
  `;const c=S=>{const N=e.querySelector(`[data-el="${S}"]`);if(!N)throw new Error(`settings: missing element "${S}"`);return N},d=S=>e.querySelector(`[data-toggle="${S}"]`),p=S=>e.querySelector(`[data-range="${S}"]`),u=c("qualityrow"),m=S=>`${Math.round(S*100)}%`;function f(S,N){const q=d(S);q.setAttribute("aria-checked",N?"true":"false"),q.classList.toggle("is-on",N)}function g(){const S=hw(),N=cw();for(const V of u.querySelectorAll("[data-quality]")){const ne=V.dataset.quality===N;V.setAttribute("aria-checked",ne?"true":"false"),V.classList.toggle("is-on",ne),V.disabled=S!==null}const q=c("qualitypin");S?(q.textContent=`This session is pinned to ${kr(S)} by a ?tier= link in the address bar, so this control is switched off. Reload without it to choose.`,q.hidden=!1):q.hidden=!0;const U=dw();c("qualityblurb").textContent=N==="auto"&&!S?`Auto picked ${U.label} on this device. ${U.blurb}`:U.blurb}function w(){for(const S of ya){const N=c(`bind-${S}`),q=Bt(ia[S][0]),U=o===S;N.textContent=U?"…":q,N.classList.toggle("is-listening",U),N.setAttribute("aria-label",U?`${Un[S]}: press the key you want, or Escape to keep ${q}`:`${Un[S]}, currently ${q}. Press to change it.`)}c("bindreset").hidden=!ZE(),c("keys").innerHTML=n().map(S=>`
      <div class="set-key-row">
        <span class="set-key-action">${S.action}</span>
        <span class="set-key-caps">${S.keys.map(N=>`<kbd class="set-cap">${N}</kbd>`).join("")}</span>
      </div>`).join(""),c("ctrlnote").textContent=s()}function b(S){c("bindnote").textContent=S??(o!==null?"Press any key. Escape keeps the one you have.":`Tap a key to change it. ${ya.map(N=>Bt(Ro[N].slice(1)[0]??"")).filter(Boolean).join(" ")} always work as well, so movement can never be lost.`)}function y(S){c("namecount").textContent=`${S.length}/${Xl}`}function x(){const S=Ae.isMuted(),N=Ae.getState(),q=c("name");document.activeElement!==q&&(q.value=t.profile.name),y(q.value);const U=p("sfx");document.activeElement!==U&&(U.value=String(Ae.getVolume())),U.style.setProperty("--p",m(Ae.getVolume())),c("sfxval").textContent=m(Ae.getVolume());const V=p("music");document.activeElement!==V&&(V.value=String(Ae.music.getVolume())),V.style.setProperty("--p",m(Ae.music.getVolume())),c("musicval").textContent=m(Ae.music.getVolume()),f("mute",S),f("music",Ae.music.isEnabled()),f("motion",a.reduceMotion),e.classList.toggle("is-muted",S);const ne=c("audiostate");N==="failed"?(ne.textContent="This browser blocked audio, so nothing here will make a sound.",ne.hidden=!1):N!=="running"?(ne.textContent="Sound switches on when you touch the screen — drag a slider to try it.",ne.hidden=!1):ne.hidden=!0}function k(S,N){const q=XE(S,N,a.moveKeys);if(q){b(`${q} Pick another, or press Escape.`);return}const U={...a.moveKeys};U[S]=N,a={...a,moveKeys:U},Nl(a),yh(a.moveKeys),D(),b(`${Un[S]} is now ${Bt(N)}.`),w()}function T(){a={...a,moveKeys:{}},Nl(a),yh(a.moveKeys),D(),b(`Movement is back to ${ya.map(S=>Bt(Ro[S][0])).join(" ")}.`),w()}const v=S=>{if(o!==null){if(S.preventDefault(),S.stopPropagation(),S.key==="Escape"){const N=o;D(),b(`Left ${Un[N].toLowerCase()} on ${Bt(ia[N][0])}.`),w();return}["Shift","Control","Alt","Meta","CapsLock"].includes(S.key)||S.code&&k(o,S.code)}};function O(S){if(o===S){D(),w(),b();return}o===null&&window.addEventListener("keydown",v,!0),o=S,w(),b()}function D(){o!==null&&(o=null,window.removeEventListener("keydown",v,!0))}const _=S=>{const N=S.target.closest("[data-quality]");if(N){lw(N.dataset.quality),g();return}const q=S.target.closest("[data-bind]");if(q){O(q.dataset.bind);return}if(S.target.closest('[data-el="bindreset"]')){T();return}o!==null&&(D(),w(),b());const U=S.target.closest("[data-toggle]");if(U){switch(U.dataset.toggle){case"mute":Ae.setMuted(!Ae.isMuted()),Ae.isMuted()||Ae.previewClick();break;case"music":Ae.music.setEnabled(!Ae.music.isEnabled());break;case"motion":a={...a,reduceMotion:!a.reduceMotion},Nl(a),Ym();break}x()}};e.addEventListener("click",_);const E=S=>{const N=S.target;if(N.dataset.el==="name"){t.profile.setName(N.value),y(N.value);return}const q=Number(N.value);Number.isFinite(q)&&(N.dataset.range==="sfx"?(Ae.setVolume(q),Ae.previewClick()):N.dataset.range==="music"&&Ae.music.setVolume(q),x())};e.addEventListener("input",E);const A=S=>{const N=S.target;N.dataset.el==="name"&&(N.value=t.profile.setName(N.value),y(N.value))};e.addEventListener("change",A);const C=S=>{const N=S.target;!N||N.dataset.el!=="name"||S.key!=="Enter"||(S.preventDefault(),N.blur())};e.addEventListener("keydown",C),c("back").addEventListener("click",()=>t.navigate({name:"home"})),c("done").addEventListener("click",()=>t.navigate({name:"home"}));const R=c("confirm");c("reset").addEventListener("click",()=>{const S=Te.filter(N=>t.profile.characterLevel(N)>Io).length;c("confirmsub").textContent=`${t.profile.trophies.toLocaleString()} trophies, ${t.profile.coins.toLocaleString()} coins and ${t.profile.wins} wins will be deleted`+(S>0?`, along with ${S} upgraded fighter${S===1?"":"s"}.`:"."),R.hidden=!1}),c("cancel").addEventListener("click",()=>{R.hidden=!0}),c("confirmyes").addEventListener("click",()=>{try{const S=[];for(let N=0;N<localStorage.length;N++){const q=localStorage.key(N);q&&q.startsWith("food-arena.profile")&&S.push(q)}for(const N of S)localStorage.removeItem(N)}catch{}location.reload()});const I=e.querySelector(".set-body"),L=()=>{const S=I.scrollHeight-I.scrollTop-I.clientHeight>2;I.classList.toggle("is-more",S)};I.addEventListener("scroll",L,{passive:!0}),requestAnimationFrame(L);const B=Ae.onChange(x),H=Ae.music.onChange(x),j=iw(g);return x(),g(),w(),b(),{root:e,resize(){L()},dispose(){B(),H(),j(),D(),I.removeEventListener("scroll",L),e.removeEventListener("click",_),e.removeEventListener("input",E),e.removeEventListener("change",A),e.removeEventListener("keydown",C),e.remove()}}}const QE=`
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
`,h0=[{key:"damage",icon:"damage",label:"Damage",color:"#FF8A96"},{key:"health",icon:"health",label:"Health",color:"#8FE04A"},{key:"speed",icon:"speed",label:"Speed",color:"#6FC8F5"}],eT=new Set(["Neon","Cyber"]);function tT(t){return t===void 0?null:t>=uo.ultimateSlam?"Widest":t>uo.rangedLong?"Max range":t>uo.rangedMid?"Long":t>uo.rangedClose?"Mid":t>uo.meleeHeavy?"Short":"Melee"}function aT(t){const e=[];t.type==="self"&&t.healAmount?e.push(`${P("heal")} +${t.healAmount} HP`):t.comboParts?.length?e.push(`${P("damage")} ${t.comboParts.map(o=>o.damage).join(" + ")}`):t.pellets&&t.pellets>1?e.push(`${P("damage")} ${t.damage} × ${t.pellets}`):t.damage>0&&e.push(`${P("damage")} ${t.damage}`);const a=tT(t.range);return a&&e.push(`${P("range")} ${a}`),e.push(`${P("timer")} ${(t.cooldown/1e3).toFixed(1)}s`),t.effect&&e.push(t.effect==="stun"?`${P("stun")} Stun`:`${P("slow")} Slow`),e}function oT(t){const e=Te.filter(a=>a!==t);return e[Math.floor(Math.random()*e.length)]}function nT(t){Ea("fa-chars-styles",sT),Ta();const e=Ue("div","fa-screen fa-chars"),a=Lh();let o=t.profile.selected;e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${P("back")} Back</button>
      <h1 class="fa-title chars-heading">Choose Your Fighter</h1>
      <div class="fa-topbar-spacer"></div>
      <!-- ADOPTED: '.ds-chip' plus '.ds-chip-val' on the numerals. The chip's shape is
           unchanged; what moves is the RELATIONSHIP inside it — theme.ts's recorded
           finding is that on the reference plates the numeral is the loudest thing in a
           counter and ours were the same size as their own labels, "which is why a
           trophy total read as chrome". '.fa-chip' stays: 'chars_metrics' and
           'screen_metrics' both key on it. -->
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${P("medal")}</span>Wins <span class="fa-chip-val ds-chip-val ds-num" data-el="wins">0</span></div>
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${P("coin")}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="coins">0</span></div>
    </header>

    <div class="chars-body">
      <section class="chars-hero">
        <div class="chars-hero-3d" data-el="hero3d"></div>
        <div class="chars-hero-vignette"></div>
        <div class="chars-hero-plate">
          <span class="fa-title chars-hero-name" data-el="heroname"></span>
          <span class="fa-rarity" data-el="herorarity"></span>
        </div>
        <button class="chars-equip" type="button" data-el="select">${P("star")} Equip</button>
      </section>

      <div class="fa-panel fa-panel--flush chars-rosterwrap">
        <div class="fa-scroll chars-roster" data-el="roster"></div>
      </div>

      <div class="fa-panel chars-detail">
        <p class="fa-panel-title">Stats</p>
        <div class="chars-stats" data-el="stats"></div>
        <p class="fa-panel-title">Abilities</p>
        <div class="chars-kit" data-el="kit" role="group" aria-label="Abilities"></div>
        <div class="chars-kit-cap" data-el="kitcap" aria-live="polite"></div>
      </div>
    </div>

    <!-- The LEVEL block lives in the action row, beside FIGHT, and not in the detail column.
         r0 (shots/rv/r0/critics.json, 6 of 6 select critics on the scored 852x393 frame):
         "the '1,590' on the Upgrade button runs past its edge and the 'Lettuce Fling' card is
         cut off at the bottom". Both had one cause: '.chars-level' was 119 of the column's
         281 px (42%) and its button was as wide as a 179 px column, so the price overflowed
         by 2.5 px and the ability list got a 28-74 px window. In the action row the button is
         sized to its own content (it cannot clip its price) and the column gets the height
         back. The upgrade IS an action — a price you pay — so it belongs with the other one.
         Measured: tools/tmp/u1_clip.mjs, C1 and C2. -->
    <footer class="chars-bottom">
      <div class="chars-level" data-el="level"></div>
      <button class="fa-btn fa-btn--primary fa-btn--hero" type="button" data-el="fight">${P("play")} Fight!</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;const n=R=>{const I=e.querySelector(`[data-el="${R}"]`);if(!I)throw new Error(`characterSelect: missing element "${R}"`);return I},s=n("roster"),i=n("stats"),r=n("kit"),l=n("kitcap"),h=n("hero3d"),c=n("heroname"),d=n("herorarity"),p=n("select"),u=n("level"),m=n("confetti"),f=new Map;for(const R of Te){const I=ie[R],L=Ue("button","chars-card");L.type="button",L.dataset.char=R,L.style.setProperty("--card-bg",kh[I.rarity]),L.style.setProperty("--rarity",It[I.rarity]),L.style.setProperty("--rarity-glow",V0(It[I.rarity],.75)),eT.has(I.rarity)&&L.classList.add("is-animated"),L.innerHTML=`
      <img class="chars-card-render" alt="" data-el="render" />
      <span class="chars-card-sheen"></span>
      <span class="chars-card-gloss"></span>
      <span class="chars-card-art">${P("avatar")}</span>
      <span class="chars-card-name">${I.name}</span>
      <span class="fa-rarity chars-card-rarity"
            style="background:${It[I.rarity]}">${I.rarity}</span>
      <span class="chars-card-playing">${P("star")}</span>
      <span class="chars-card-lv" data-el="lv"></span>
    `,L.addEventListener("click",()=>v(R,!0)),s.appendChild(L),f.set(R,L)}const g=(R,I)=>{const L=f.get(R),B=L?.querySelector('[data-el="render"]');B&&(B.src=I,L.classList.add("has-render"))};for(const R of Te){const I=zh(R);I&&g(R,I)}af(g);const w=Ue("div","chars-card chars-card--locked");w.innerHTML=`
    <span class="chars-card-art">${P("lock")}</span>
    <span class="chars-card-name">More soon</span>
  `,s.appendChild(w);const b=new Map;for(const R of h0){const I=Ue("div","fa-stat ds-row ds-row--slate chars-stat");I.style.setProperty("--ds-row-accent",R.color),I.innerHTML=`
      <span class="ds-tile ds-tile--stat" style="--ds-tile-fill:${R.color}">${P(R.icon)}</span>
      <span class="ds-row-body">
        <span class="ds-row-label">${R.label}</span>
        <span class="ds-row-val ds-num"></span>
      </span>
    `,b.set(R.key,I.querySelector(".ds-row-val")),i.appendChild(I)}function y(){const R=o,I=t.profile.characterLevel(R),L=t.profile.nextLevelPrice(R),B=t.profile.canLevelUp(R),H=L===null,j=Ul(R,ql,I),S=Hl(I),N=H?j:Ul(R,ql,I+1),q=H?S:Hl(I+1),U=H?"":`
      <span class="chars-lv-gain"><span class="chars-lv-item">${P("health")} +${N-j}</span
        ><span class="chars-lv-item">${P("damage")} +${Math.round((q/S-1)*100)}%</span></span>`;u.innerHTML=`
      <span class="chars-lv-badge${H?" is-max":""}">Lv ${I}${H?"":` / ${_l}`}</span>
      <span class="chars-lv-read">
        <span class="chars-lv-now"><span class="chars-lv-item">${P("health")} ${j} HP</span
          ><span class="chars-lv-item">${P("damage")} x${S.toFixed(2)}</span></span>
        ${U}
      </span>
      <span class="chars-lv-act">
        <button class="ds-btn chars-lv-btn" type="button" data-el="upgrade"${H||!B?" disabled":""}>${H?`${P("star")} Max level`:`${P("sparkle")} Upgrade <span class="chars-lv-price">${P("coin")} ${L.coins.toLocaleString()}</span>`}</button>
        ${H||B?"":`<span class="chars-lv-short">${(L.coins-t.profile.coins).toLocaleString()} more coins needed</span>`}
      </span>
    `}function x(){const R=t.profile.selected;for(const[L,B]of f)B.classList.toggle("is-playing",L===R);const I=o===R;p.innerHTML=I?`${P("star")} Equipped`:`${P("star")} Equip`,p.classList.toggle("is-equipped",I),p.disabled=I}let k=0,T=null;function v(R,I=!1){o=R;const L=ie[R];for(const[B,H]of f)H.classList.toggle("is-viewed",B===R);I&&f.get(R)?.scrollIntoView({block:"nearest"}),c.textContent=L.name,d.textContent=L.rarity,d.style.background=It[L.rarity];for(const B of h0)b.get(B.key).textContent=String(L.stats[B.key]);R!==T&&(k=0,T=R),O(),a.show(R),x(),y()}function O(){const R=ie[o],L=pw(R).map(H=>({name:H.name,desc:H.desc,em:of(H.emoji),weapon:H.weapon,passive:!H.weapon}));R.hasTrail&&!L.some(H=>H.passive)&&L.push({name:"Passive",desc:"Leaves a damaging speed-boost trail while moving.",em:P("honey"),weapon:null,passive:!0}),k>=L.length&&(k=0),r.dataset.n=String(L.length),r.style.setProperty("--chars-kit-cols",String(L.length<=4?L.length:3)),r.innerHTML=L.map((H,j)=>`
      <button class="chars-abl${j===k?" is-on":""}" type="button" data-abl="${j}"
              aria-pressed="${j===k}" aria-label="${H.name}">
        <span class="chars-abl-em">${H.em}</span>
        <span class="chars-abl-name">${H.name}</span>
      </button>`).join("");const B=L[k];l.innerHTML=B?`
      <span class="chars-abl-head">
        <span class="chars-abl-capname">${B.name}</span>
        ${B.passive?'<span class="chars-abl-tag">Passive</span>':""}
      </span>
      <span class="chars-abl-desc">${B.desc}</span>
      ${B.weapon?`<span class="chars-ability-facts">${aT(B.weapon).map(H=>`<span class="chars-fact">${H}</span>`).join("")}</span>`:""}`:"",l.scrollTop=0,D()}function D(){const R=l.scrollHeight-l.clientHeight>1;l.classList.toggle("is-clipped",R)}r.addEventListener("click",R=>{const I=R.target.closest("[data-abl]");if(!I)return;const L=Number(I.dataset.abl);!Number.isInteger(L)||L===k||(k=L,O())}),n("back").addEventListener("click",()=>t.navigate({name:"home"})),p.addEventListener("click",()=>{t.profile.select(o),x(),Ei(m,50,24),a.poke()}),n("fight").addEventListener("click",()=>{t.profile.select(o),t.navigate({name:"match",player:o,enemy:oT(o)})});function _(){for(const[R,I]of f){const L=t.profile.characterLevel(R),B=I.querySelector('[data-el="lv"]');B&&(B.textContent=L>1?`Lv ${L}`:"",I.classList.toggle("has-lv",L>1),I.classList.toggle("is-maxed",L>=_l))}}function E(){n("wins").textContent=String(t.profile.wins),n("coins").textContent=t.profile.coins.toLocaleString()}u.addEventListener("click",R=>{!R.target.closest('[data-el="upgrade"]')||!t.profile.levelUp(o)||(Ei(m,34,18),a.poke())});const A=t.profile.onChange(()=>{E(),_(),y()});E(),_(),v(o),a.attachTo(h);const C=typeof ResizeObserver=="function"?new ResizeObserver(()=>D()):null;return C?.observe(l),{root:e,update(R){a.update(R)},resize(){a.resize(),D()},dispose(){A(),C?.disconnect(),a.detach(),e.remove()}}}const sT=`
/* ── THE SCREEN'S OWN SET ─────────────────────────────────────────────────────
   WAS the shell's global '.fa-bg' showing through: a flat orange gradient with a halftone.
   r0, 6 of 6 select critics: "flat UI cards on a plain orange fill", "replace the flat
   orange sunburst backdrop behind the grid with a lit, layered scene like the one behind
   the hero". REVAMP 2.7 measured select's median luma at 0.58 against 0.15-0.40 on the
   reference menus. So the screen continues the hero's set: the same deep blue as the
   portrait cove, a pool of light behind the hero column, navy at the edges (a vignette
   with depth, not a flat fill), and the halftone kept as texture. Cream panels and the
   mustard CTA now sit on dark, which is the reference's figure/ground for chrome.
   '.fa-screen' is a full-viewport box, so this covers '.fa-bg' for THIS screen only. */
.fa-chars {
  background:
    radial-gradient(rgba(255,255,255,0.05) 2px, transparent 2px) 0 0 / 24px 24px,
    radial-gradient(ellipse 42% 62% at 17% 52%, rgba(90,166,255,0.42) 0%, rgba(90,166,255,0) 70%),
    radial-gradient(ellipse 110% 95% at 45% 42%, #2C56C4 0%, #1D3586 46%, #111A48 100%);
  background-color: #111A48;
}
.fa-chars .chars-heading { flex: 0 1 auto; }

/* The detail column's floor is 200 px and not 168: it now carries the ability KIT, and
   four 44 px tap targets plus three 3 px gaps (185) plus the panel's padding and ink
   line (2 x 4 + 2 x 3 on a short screen) is 199. A 168-179 px column cannot hold four
   tiles at the tap floor, which is the same arithmetic that cut the price at 852x393. */
.fa-chars .chars-body {
  display: grid;
  grid-template-columns:
    clamp(150px, 25vw, 430px)
    minmax(0, 1fr)
    clamp(200px, 21vw, 330px);
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
  background: ${K0};
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
   screen a PRICE is stated, and a price that fails AA is a price the player disputes.

   ⚠️ IT IS A SLAB IN THE ACTION ROW NOW, NOT A BLOCK IN THE DETAIL COLUMN. WAS:
   'display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; border: 2px solid
   rgba(26,18,36,0.22); background: rgba(255,255,255,0.5)' inside '.chars-detail', where it
   was 119 of the column's 281 px at 852x393 and its button was column-wide — 'u1_clip' C1
   measured the price 2.5 px past the button's own ink line there. Here the button is sized
   to its content and the slab sits left of FIGHT, in the row that was empty but for it. */
.fa-chars .chars-level {
  margin-inline-end: auto;
  display: flex;
  align-items: center;
  gap: var(--ds-s3);
  min-width: 0;
  padding: 3px 4px 3px 8px;
  /* OPAQUE near-white, not 'var(--panel)': the panel colour is 94% opaque, and over the
     screen's dark set it composited to rgb(241,231,216), where 'chars_metrics' measured the
     green gain runs at 4.03-4.23:1 against a 4.5 floor at all three of its viewports. The
     old in-column plate was 'rgba(255,255,255,0.5)' over cream, i.e. effectively this. */
  background: #FFF9EE;
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-3);
  box-shadow: var(--ds-e3);
}
.fa-chars .chars-lv-read {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.fa-chars .chars-lv-act {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex: 0 0 auto;
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
/* ⚠️ ONE STEP DARKER: WAS '#2E7D32'. On the slab's opaque #FFF9EE it computes to ~4.9:1 — a
   pass, but a margin of 0.4 is the kind this file already learned not to trust (the
   separator note below: "over the AA floor by 0.35, which is no headroom at all").
   #26702A is ~5.8:1 on the same plate, same hue. */
.fa-chars .chars-lv-gain { color: #26702A; }
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
  flex: 0 0 auto;
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
/* ── The kit: tiles you press, one caption for the one pressed ─────────────────
   WAS a '.chars-abilities' scroller of '.chars-ability' rows (icon | name, description,
   fact pills), whose contract was "the FIRST ability is whole at every viewport" — the
   half-cut second row it left on the scored phone frame is what 5 of 6 r0 critics named.
   See 'renderKit' for the measurement and for why no row list fits that column.

   Columns come from the COUNT, not from auto-fit: auto-fit puts four tiles 3 + 1 in a
   247 px column and leaves the ragged cell a critic already named a defect on home. One
   row for up to four abilities; five go 3 + 2 on a six-track grid so both rows are full. */
.fa-chars .chars-kit {
  display: grid;
  grid-template-columns: repeat(var(--chars-kit-cols, 4), minmax(0, 1fr));
  gap: var(--ds-s1);
  flex: 0 0 auto;
}
.fa-chars .chars-kit[data-n="5"] { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.fa-chars .chars-kit[data-n="5"] .chars-abl { grid-column: span 2; }
.fa-chars .chars-kit[data-n="5"] .chars-abl:nth-child(n+4) { grid-column: span 3; }
.fa-chars .chars-abl {
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  min-height: var(--tap);
  padding: 4px 3px;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel);
  transition: transform 0.08s, box-shadow 0.08s;
}
.fa-chars .chars-abl:hover { filter: brightness(1.04); }
.fa-chars .chars-abl:active { transform: translateY(3px); box-shadow: var(--ds-e0), var(--ds-bevel); }
/* Selected = the GET colour, exactly as on home's kit, so "the one you are reading" is the
   same signal on both screens. */
.fa-chars .chars-abl.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
}
.fa-chars .chars-abl-em { font-size: var(--ds-t5); line-height: 1; flex: 0 0 auto; }
.fa-chars .chars-abl-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  line-height: 1.1;
  text-align: center;
  max-width: 100%;
  overflow-wrap: break-word;
}
/* The caption. Content-sized; it may SHRINK below its content (min-height 0) and then
   scrolls — and only then does it carry the fade ('.is-clipped', set from JS when it
   actually overflows), so the edge says "there is more" instead of cutting a line. */
.fa-chars .chars-kit-cap {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 8px 7px;
  background: #FFFFFF;
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
}
.fa-chars .chars-kit-cap::-webkit-scrollbar { display: none; }
.fa-chars .chars-kit-cap.is-clipped {
  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 22px), transparent);
  mask-image: linear-gradient(180deg, #000 calc(100% - 22px), transparent);
}
.fa-chars .chars-abl-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fa-chars .chars-abl-capname {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t3);
  line-height: 1.15;
}
.fa-chars .chars-abl-tag {
  padding: 0 6px;
  border-radius: var(--ds-r-pill);
  background: var(--mustard);
  border: var(--ds-stroke-1) solid var(--ink);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t1);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  line-height: 1.4;
}
.fa-chars .chars-abl-desc {
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
  /* 🔴 REVERSED (graphics campaign U1, 2026-10-15) — the wording above is kept because it
     was a reasoned contract, and the blind round is what refuted it. On the scored 852x393
     frame 5 of 6 r0 critics wrote that "the second ability card ('Lettuce Fling') is cut
     off at the bottom": the "affordance" read as the same rendering fault the 28 px window
     did. 'tools/tmp/u1_clip.mjs' C2 on the base tree: 9 of 11 fighters CUT a row at
     852x393 (Lettuce Fling by 74.5 px). The list is now the KIT ('renderKit'): every tile
     whole at every viewport, and the one long caption that cannot fit scrolls behind a
     fade rather than being sliced. The level block no longer lives in this panel. */
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
  /* WAS four rules here tuning the retired ability ROWS and the level block's in-column
     padding to the pixel ('.chars-level { padding: 2px 6px; gap: 2px }', '.chars-abilities
     { gap: 4px }', '.chars-ability-desc { line-height: 1.25 }', '.chars-ability { padding:
     1px 6px; gap: 6px }' — "2px and not 3: at 852x393 the region came out 68px against a
     69.34px row"). A list tuned to clear its FIRST row by a pixel is the design r0 scored;
     the level block left the column and the rows became the kit, so none has a target. */
  .fa-chars .chars-level { padding: 2px 3px 2px 6px; gap: var(--ds-s2); }
  .fa-chars .chars-abl-desc { line-height: 1.25; }
  .fa-chars .chars-kit-cap { padding: 4px 6px 5px; gap: 2px; }
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
  /* ICON-ONLY tiles on a short screen, exactly as home's kit does on the same phones: a
     185 px row holds four 44 px tap targets, not four names. The caption below states the
     name of the one pressed, so no ability is unnamed on screen. */
  .fa-chars .chars-abl-name { display: none; }
  .fa-chars .chars-abl { padding: 2px; }
  .fa-chars .chars-abl-em { font-size: var(--ds-t6); }
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
  /* ── PORTRAIT: HERO | DETAIL ON TOP, THE WHOLE ROSTER UNDER THEM ──────────────────
     WAS one column of three rows — 'grid-template-rows: minmax(90px, 0.9fr) minmax(0,
     1.1fr) auto' with '.chars-detail { max-height: 34vh }'. Measured at 390x844 on the
     base tree ('u1_shots'): the hero in a 366x165 letterbox at ~65 px tall, the roster cut
     through its second row, and the abilities sliced after one ('u1_clip' C2: every
     fighter, every portrait viewport). Uri plays this screen in portrait.
     Side by side, the hero gets a TALL box — its own shape — and the detail column gets
     the height the kit needs; the roster below holds all three rows of four, so no card is
     cut. The rows' 12vh floor is a landscape number (101 px at 844 tall, i.e. 303 px of
     cards before a gap); 9.5vh keeps the tap target and returns ~60 px to the hero. */
  .fa-chars .chars-body {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas: "hero detail" "roster roster";
  }
  /* The set's light pool follows the hero, which is top-left here. */
  .fa-chars {
    background:
      radial-gradient(rgba(255,255,255,0.05) 2px, transparent 2px) 0 0 / 24px 24px,
      radial-gradient(ellipse 70% 34% at 26% 28%, rgba(90,166,255,0.42) 0%, rgba(90,166,255,0) 70%),
      radial-gradient(ellipse 120% 90% at 40% 30%, #2C56C4 0%, #1D3586 46%, #111A48 100%);
    background-color: #111A48;
  }
  .fa-chars .chars-hero { grid-area: hero; }
  .fa-chars .chars-detail { grid-area: detail; align-self: stretch; max-height: none; }
  .fa-chars .chars-rosterwrap { grid-area: roster; }
  /* FIXED rows, not minmax(.., 1fr): in an auto-height row a 1fr track resolves to the
     cards' content height (measured ~118 px), which handed the roster ~100 px the hero
     and the kit's caption needed. 12 cards, 3 rows of 4, all whole. */
  .fa-chars .chars-roster { grid-auto-rows: clamp(68px, 9.5vh, 100px); }
  .fa-chars .chars-card { min-height: 0; }
  /* ~80 px cards, the landscape phone's size, so the landscape phone's answer: the rarity
     CHIP goes and the 2 px rarity RING on the gloss carries the six-way distinction (see
     "THE RING IS WHAT PAYS FOR DROPPING THE CHIP" in the max-height 460 block — the same
     two rules). Measured need: "LEGENDARY" at the 11 px floor with the tracking its 1.6 px
     ink stroke requires is ~84 px of chip in a ~72 px card; it rendered "EGENDARY". The
     roster's padding and gaps tighten so the longest name, "Water Bottle", fits whole. */
  .fa-chars .chars-card-rarity { display: none; }
  .fa-chars .chars-card:not(.chars-card--locked) .chars-card-gloss {
    box-shadow: inset 0 0 0 2px var(--rarity, transparent);
  }
  .fa-chars .chars-roster { padding: 6px; gap: 4px; }
  .fa-chars .chars-card { padding: 4px 2px 5px; }
  /* The hero name runs at the landscape title size (3.1vh = 26 px) in a ~170 px panel and
     was cut by it ("Hamburgei"). One ramp step that holds "Water Bottle", the longest. */
  .fa-chars .chars-hero-name { font-size: var(--ds-t5); }
  .fa-chars .chars-heading { display: none; }
  /* The detail column is ~180 px wide here: the kit goes two-up, icon-only (the caption
     names the pressed one), and the section titles go — the stat cells and the tiles are
     self-describing at this size, exactly as on the short landscape phone. */
  .fa-chars .chars-detail > .fa-panel-title { display: none; }
  .fa-chars .chars-detail { padding: 6px; gap: 6px; }
  .fa-chars .chars-kit { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fa-chars .chars-kit[data-n="5"] { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .fa-chars .chars-abl-name { display: none; }
  .fa-chars .chars-abl-em { font-size: var(--ds-t6); }
  .fa-chars .chars-kit[data-n="3"] .chars-abl:last-child { grid-column: 1 / -1; }
  /* The hero panel is ~170 px wide here, so a top-right Equip and a top-left nameplate
     meet in the middle. Equip moves to the panel's foot, full width — still on the hero,
     which is where the note on '.chars-equip' says it belongs. */
  .fa-chars .chars-equip {
    top: auto;
    bottom: 8px;
    inset-inline: 8px;
    justify-content: center;
  }
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
  /* ⚠️ AND NOW THE FLOOR STEP: WAS 'var(--ds-t2)'. The portrait cards are ~80 px since the
     roster went three rows under a hero | detail row (block head), and t2 ellipsised
     "Hamburg..." and "Water Bo..." there. t1 is the 11 px floor; the chip it had to stay a
     step above is not drawn at this size any more (see the ring above). */
  .fa-chars .chars-card-name { font-size: var(--ds-t1); letter-spacing: 0; }
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
  /* The ACTION ROW WRAPS here: badge + readouts + the Upgrade button need ~290 px and FIGHT
     ~150, against 340 at 360 px wide. The slab takes the first line and FIGHT the second,
     both full width — portrait has the height, and a full-width CTA is the portrait norm. */
  .fa-chars .chars-bottom { flex-wrap: wrap; row-gap: var(--ds-s2); }
  .fa-chars .chars-level { flex: 1 1 100%; margin-inline-end: 0; }
  .fa-chars .chars-lv-read { flex: 1 1 auto; }
  /* Full width and 60 px rather than the 9.5vh (78 px at 844 tall) the landscape CTA uses:
     a full-width slab is already the loudest object on a portrait screen, and the 18 px go
     to the hero. */
  .fa-chars .chars-bottom > .fa-btn--hero { flex: 1 1 100%; min-height: 60px; }
}
`,c0=["Normal","Rare","Epic","Legendary","Neon","Cyber"],iT=(()=>{const t=Ma.map(a=>{const o=Jn(a).filter(r=>r.rarity);let n=null,s=-1,i=0;for(const r of o)i+=r.percent,r.percent>s&&(s=r.percent,n=r.rarity??null);return{kind:a,floor:n,charShare:i}});t.sort((a,o)=>{const n=a.floor?c0.indexOf(a.floor):-1,s=o.floor?c0.indexOf(o.floor):-1;return n-s||a.charShare-o.charShare});const e={};return t.forEach((a,o)=>{e[a.kind]={rank:o+1,of:t.length,floor:a.floor}}),e})();function Ll(t,e={}){const a=iT[t];if(!a)return"";const o=a.floor?It[a.floor]:"var(--ink)",n=Array.from({length:a.of},(i,r)=>`<i class="tr-pip${r<a.rank?" is-on":""}"></i>`).join(""),s=`Tier ${a.rank} of ${a.of}${a.floor?`, ${a.floor} or rarer`:""}`;return`<span class="tr-tier" style="--pip:${o}" role="img" aria-label="${s}">${n}${e.label&&a.floor?`<span class="tr-tier-txt">${a.floor}+</span>`:""}</span>`}function rT(t){Ea("fa-trophy-styles",lT),Ta();const e=Ue("div","fa-screen fa-tr"),a=t.profile;e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${P("back")} Back</button>
      <h1 class="fa-title tr-heading">Trophy Road</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${P("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${P("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="tr-body">
      <section class="tr-hero">
        <div class="tr-hero-count">
          <span class="tr-hero-em">${P("trophy")}</span>
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
        <button class="fa-btn fa-btn--green tr-claimall" type="button" data-el="claimall">${P("sparkle")} Claim</button>
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
        <button class="fa-iconbtn tr-odds" type="button" data-el="oddsbtn">${P("chest")} Drop rates</button>
        <button class="fa-btn fa-btn--quiet tr-storebtn" type="button" data-el="storebtn">${P("gem")} Get Gems</button>
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
  `;const o=A=>{const C=e.querySelector(`[data-el="${A}"]`);if(!C)throw new Error(`trophyRoad: missing element "${A}"`);return C},n=o("road"),s=o("inventory"),i=o("sheet"),r=o("sheetcard"),l=o("confetti"),h=o("claimall"),c=o("delta");function d(A=!1){const C=a.trophies;a.unlocked;const R=new Set(a.economy.claimed);n.innerHTML="";const I=Ue("div","tr-roadtrack"),L=Ue("div","tr-spine"),B=Ue("div","tr-spine-fill");L.appendChild(B),I.appendChild(L);let H=!1;const j=()=>{const N=Ue("div","tr-pin");N.dataset.el="pin",N.innerHTML=`
        <span class="tr-pin-dot">${P("pin")}</span>
        <span class="tr-pin-label">${C.toLocaleString()}</span>
      `,I.appendChild(N),H=!0};let S=0;for(const N of Dw()){!H&&C<N.trophies&&j();const q=m(N,C,R.has(N.trophies));q.classList.add(S%2===0?"is-high":"is-low"),I.appendChild(q),S++}H||j(),n.appendChild(I),ko(I),p(),A&&u()}function p(){const A=n.querySelector(".tr-roadtrack"),C=n.querySelector(".tr-spine"),R=n.querySelector(".tr-spine-fill"),I=n.querySelector('[data-el="pin"]');if(!A||!C||!R||!I)return;R.style.width=`${Math.max(0,I.offsetLeft+I.offsetWidth/2)}px`;const L=C.getBoundingClientRect();if(L.height===0)return;const B=L.top+L.height/2;for(const H of A.querySelectorAll(".tr-node")){const j=H.getBoundingClientRect(),S=H.classList.contains("is-high")?B-j.bottom:j.top-B;H.style.setProperty("--stem",`${Math.max(0,Math.round(S))}px`)}}function u(){const A=n.querySelector('[data-el="pin"]');!A||n.clientWidth===0||(n.scrollLeft=Math.max(0,A.offsetLeft-n.clientWidth/2+A.offsetWidth/2))}function m(A,C,R,I){const L=Yl(A.reward),H=C>=A.trophies&&!R,j=H?Ue("button","tr-node is-claimable"):Ue("div","tr-node");if(H&&(j.type="button"),R&&j.classList.add("is-claimed"),L.isCharacter&&j.classList.add("is-character"),j.dataset.trophies=String(A.trophies),A.reward.type==="character"){const N=It[ie[A.reward.id].rarity];j.style.setProperty("--node-accent",N),j.style.setProperty("--node-glow",V0(N,.55))}const S=R?`<span class="tr-status is-done">${P("check")} Claimed</span>`:H?'<span class="tr-status is-ready">Claim</span>':`<span class="tr-status">${(A.trophies-C).toLocaleString()} to go</span>`;return j.innerHTML=`
      <span class="tr-node-req">${P("trophy")} ${A.trophies.toLocaleString()}</span>
      <span class="tr-node-medal"><span class="tr-node-em">${A.reward.type==="character"?vo(A.reward.id,{crop:"head"}):A.reward.type==="container"?Ut(A.reward.kind):Ha(L.emoji)}</span>${R?`<span class="tr-node-tick">${P("check")}</span>`:""}</span>
      <span class="tr-node-title">${L.title}</span>
      ${A.reward.type==="container"?Ll(A.reward.kind):""}
      ${L.payoutNote?`<span class="tr-node-note">${L.payoutNote.replace("🪙",P("coin"))}</span>`:""}
      ${S}
    `,j}function f(){o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString(),o("trophies").textContent=a.trophies.toLocaleString();const A=H0(a.trophies),C=o("fill");C.style.width=`${(A.progress01*100).toFixed(1)}%`;const R=a.claimable.length;if(R>0)o("nextlabel").textContent="Ready now",o("nextval").innerHTML=R>1?`${P("sparkle")} ${R} road rewards to claim`:`${P("sparkle")} 1 road reward — tap it on the track`;else if(A.next){const I=A.next.reward,L=Yl(I,a.unlocked),B=A.next.trophies-a.trophies;o("nextlabel").textContent="Next reward",o("nextval").innerHTML=`${I.type==="character"?vo(I.id,{crop:"head"}):I.type==="container"?Ut(I.kind):Ha(L.emoji)} ${L.title} <span class="tr-togo">${P("trophy")} ${B.toLocaleString()} to go</span>`}else o("nextlabel").textContent="Road complete",o("nextval").innerHTML=`${P("flag")} Master of the Kitchen`;o("fillxp").textContent=A.next?`${(a.trophies-A.from).toLocaleString()} / ${(A.to-A.from).toLocaleString()}`:`Road complete — ${jl().toLocaleString()}`,h.style.display=R>1?"":"none",h.innerHTML=`${P("sparkle")} Claim ${R}`,g()}function g(){s.innerHTML="";const A=Ma.filter(C=>(a.containers[C]??0)>0);if(A.length===0){const C=a.winsToNextChest,R=Ue("p","tr-inv-empty");R.innerHTML=`${P("chest")} <strong>${C}</strong> more ${C===1?"win":"wins"} for a free Chest`,s.appendChild(R);return}for(const C of A){const R=Ge[C],I=a.containers[C]??0,L=Ue("button","tr-open");L.type="button",L.dataset.open=C,L.innerHTML=`
        <span class="tr-open-em">${Ut(C)}</span>
        <span class="tr-open-body">
          <span class="tr-open-name">${R.name}</span>
          <span class="tr-open-cta">Open ${Ll(C)}</span>
        </span>
        <span class="tr-open-count">${I}</span>
      `,s.appendChild(L)}}function w(A,C="wide"){r.innerHTML=A,r.classList.toggle("is-reveal",C==="reveal"),i.classList.add("is-open")}function b(){i.classList.remove("is-open"),r.innerHTML=""}function y(A){const C=[];for(const R of A.characters)C.push(vo(R,{crop:"head"}));for(const[R,I]of Object.entries(A.containers))I&&C.push(Ut(R));return A.coins>0&&C.push(P("coin")),A.gems>0&&C.push(P("gem")),C}function x(A,C){const R=Rw(A);if(R.length===0)return;const I=y(A),[L,...B]=R;w(`
      <div class="tr-reveal">
        <div class="tr-reveal-em">${I[0]??Ha(L.emoji)}</div>
        <p class="tr-reveal-kicker">${C}</p>
        <p class="tr-reveal-name">${L.label}</p>
        ${B.length>0?`<div class="tr-reveal-more">${B.map((H,j)=>`<span class="tr-reveal-chip">${I[j+1]??Ha(H.emoji)} ${H.label}</span>`).join("")}</div>`:""}
        <button class="fa-btn fa-btn--primary tr-sheet-close" type="button" data-el="close">Nice!</button>
      </div>
    `,"reveal"),ko(r),Ei(l,50,28)}function k(){const A=Ma.map(C=>{const R=Ge[C],I=Jn(C).map(B=>`
        <li class="tr-odds-row">
          <span class="tr-odds-what">${B.rarity?`<i class="tr-odds-dot" style="background:${It[B.rarity]}"></i>`:""}${B.label}</span>
          <span class="tr-odds-pct">${ii(B.percent)}</span>
        </li>
      `).join(""),L=Jn(C).filter(B=>B.pool&&B.pool.length>0).map(B=>`${B.rarity}: ${B.pool.map(H=>ie[H].name).join(", ")}`).join(" · ");return`
        <section class="tr-odds-block">
          <h3 class="tr-odds-title">${Ut(C)} ${R.name} ${Ll(C,{label:!0})}</h3>
          <p class="tr-odds-blurb">${R.blurb}</p>
          <ul class="tr-odds-list">${I}</ul>
          ${L?`<p class="tr-odds-pool">${L}</p>`:""}
        </section>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">Drop rates</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${P("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-sheet-note">Every percentage below is read directly from the reward
        tables the game rolls against.</p>
        <p class="tr-sheet-note tr-sheet-note--rarity">${R0}</p>
        ${A}
      </div>
    `)}function T(){const A=Bw().map(C=>{const R=qw(C),I=[];return C.coins&&I.push(`${P("coin")} ${C.coins.toLocaleString()}`),C.container&&I.push(`${Ut(C.container.kind)} ${Ge[C.container.kind].name}`),`
        <div class="tr-sku${C.oneTime?" is-featured":""}">
          ${R>0||C.oneTime?`<span class="tr-sku-flags">
            ${R>0?`<span class="tr-sku-bonus">+${R}%</span>`:""}
            ${C.oneTime?'<span class="tr-sku-bonus tr-sku-once">ONE TIME</span>':""}
          </span>`:""}
          <span class="tr-sku-em">${C.container?Ut(C.container.kind):Ha(C.emoji)}</span>
          <span class="tr-sku-name">${C.name}</span>
          <span class="tr-sku-gems">${P("gem")} ${C.gems.toLocaleString()}</span>
          ${I.length>0?`<span class="tr-sku-extra">+ ${I.join(" + ")}</span>`:""}
          <button class="tr-sku-buy" type="button" disabled>${`${Uw(C.priceUsdCents)} · Soon`}</button>
        </div>
      `}).join("");w(`
      <div class="tr-sheet-head">
        <p class="tr-sheet-title">${P("gem")} Gem Store</p>
        <button class="fa-iconbtn tr-sheet-x" type="button" data-el="close" aria-label="Close">${P("close")}</button>
      </div>
      <div class="fa-scroll tr-sheet-scroll">
        <p class="tr-soon">${P("cone")} Purchases are not available yet — nothing here can be bought.
        Every gem in the game is earned on the Trophy Road and out of chests.</p>
        <div class="tr-skus">${A}</div>
      </div>
    `)}o("back").addEventListener("click",()=>t.navigate({name:"home"})),o("oddsbtn").addEventListener("click",k),o("storebtn").addEventListener("click",T),o("scrim").addEventListener("click",b),h.addEventListener("click",()=>{const A=a.claimAllMilestones();x(A,"You earned")});const v=A=>{const C=A.target;if(C.closest('[data-el="close"]')){b();return}const R=C.closest(".tr-node.is-claimable");if(R){const L=Number(R.dataset.trophies),B=a.claimMilestone(L);B&&x(B,"You earned");return}const I=C.closest("[data-open]");if(I){const L=I.dataset.open,B=a.openContainer(L);B&&x(B.reward,B.duplicateOf?`${ie[B.duplicateOf].name} again — traded in`:`From a ${Ge[L].name}`)}};e.addEventListener("click",v);const O=A=>{A.key==="Escape"&&i.classList.contains("is-open")&&b()};window.addEventListener("keydown",O);const D=a.onChange(()=>{f(),d()});f(),d();let _=!1;requestAnimationFrame(()=>{_||(p(),u())});const E=a.lastMatch;if(E&&!E.seen){const A=E.trophies>0?"+":"";c.innerHTML=`${A}${E.trophies} ${P("trophy")}`,c.className=`tr-delta is-on ${E.trophies>0?"is-up":E.trophies<0?"is-down":"is-flat"}`,a.markLastMatchSeen()}return{root:e,resize(){d(),u()},dispose(){_=!0,D(),e.removeEventListener("click",v),window.removeEventListener("keydown",O),e.remove()}}}const lT=`
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
`,ai=Object.keys(Xt).sort((t,e)=>Xt[t]-Xt[e]);function hT(t,e,a){const o=Ge[t].entries,n=Xi(o);return o.map(s=>{let i=s.coins??0;const r=s.gems??0;let l=null;s.characterRarity&&((Ki[s.characterRarity]??[]).some(d=>!e.has(d))?l=s.characterRarity:i+=Xt[s.characterRarity]);let h=null;return s.itemRarity&&((un[s.itemRarity]??[]).some(d=>!a.has(d))?h=s.itemRarity:i+=Zn[s.itemRarity]),{chance01:n>0?s.weight/n:0,coins:i,gems:r,fighter:l,item:h}})}function cT(t){return[...new Set(Ge[t].entries.flatMap(e=>e.itemRarity?un[e.itemRarity]??[]:[]))]}function Km(t,e,a){const o=hT(t,e,a),n=cT(t),s={canGrantFighter:!1,canGrantItem:!1,bestCoins:0,bestGems:0,expectedCoins:0,expectedGems:0,characterPercent:0,itemPercent:0,floorRarity:null,itemFloorRarity:null,missingItems:n.filter(r=>!a.has(r)).length,poolItems:n.length};for(const r of o)r.fighter&&(s.canGrantFighter=!0),r.item&&(s.canGrantItem=!0),s.bestCoins=Math.max(s.bestCoins,r.coins),s.bestGems=Math.max(s.bestGems,r.gems),s.expectedCoins+=r.chance01*r.coins,s.expectedGems+=r.chance01*r.gems;const i=Xi(Ge[t].entries);for(const r of Ge[t].entries){const l=i>0?r.weight/i*100:0;if(r.characterRarity){s.characterPercent+=l;const h=ai.indexOf(r.characterRarity),c=s.floorRarity===null?1/0:ai.indexOf(s.floorRarity);h<c&&(s.floorRarity=r.characterRarity)}if(r.itemRarity){s.itemPercent+=l;const h=ai.indexOf(r.itemRarity),c=s.itemFloorRarity===null?1/0:ai.indexOf(s.itemFloorRarity);h<c&&(s.itemFloorRarity=r.itemRarity)}}return s}function Bo(t,e,a,o){const n=Ge[t].price;if(!n)return!1;const s=Km(t,a,o);return s.canGrantFighter?!0:e==="coins"?s.bestCoins>n.coins:s.bestGems>n.gems}const dT=Ma.filter(t=>Ge[t].price!==null);function pT(t){Ea("fa-shop-styles",uT),Ta();const e=Ue("div","fa-screen fa-shop"),a=t.profile;e.innerHTML=`
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${P("back")} Back</button>
      <h1 class="fa-title shop-heading">Shop</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${P("coin")}</span><span data-el="coins">0</span></div>
      <div class="fa-chip fa-chip--gem"><span class="fa-chip-em">${P("gem")}</span><span data-el="gems">0</span></div>
    </header>

    <div class="fa-panel fa-panel--flush shop-body">
      <div class="fa-scroll shop-scroll" data-el="scroll"></div>
    </div>

    <footer class="shop-bottom">
      <p class="shop-foot-note" data-el="footnote"></p>
      <div class="shop-foot-actions">
        <button class="fa-btn fa-btn--quiet" type="button" data-go="trophies">${P("trophy")} Trophy Road</button>
        <button class="fa-btn fa-btn--green" type="button" data-go="characters">${P("play")} Play a match</button>
      </div>
    </footer>
  `;const o=u=>{const m=e.querySelector(`[data-el="${u}"]`);if(!m)throw new Error(`shop: missing element "${u}"`);return m},n=o("scroll");function s(u){return`<ul class="shop-odds">${Jn(u).map(f=>`
      <li class="shop-odds-row">
        <span class="shop-odds-what">${f.rarity?`<i class="shop-odds-dot" style="background:${It[f.rarity]}"></i>`:""}${f.label}</span>
        <span class="shop-odds-pct">${ii(f.percent)}</span>
      </li>`).join("")}</ul>`}function i(u){const m=Jn(u).filter(f=>f.rarity&&(f.pool&&f.pool.length>0||f.itemPool&&f.itemPool.length>0)).map(f=>`<span class="shop-pool-line"><i class="shop-odds-dot" style="background:${It[f.rarity]}"></i>${(f.pool??[]).map(g=>ie[g].name).concat((f.itemPool??[]).map(g=>Le[g].name)).join(", ")}</span>`).join("");return m?`<div class="shop-pool">${m}</div>`:""}function r(u,m,f){const g=Ge[u],w=g.price,b=Km(u,m,f),y=b.canGrantFighter&&b.characterPercent>=99.999&&b.floorRarity?`<span class="shop-guarantee"><i class="shop-odds-dot" style="background:${It[b.floorRarity]}"></i>Always a fighter, ${b.floorRarity} or rarer</span>`:"",x=b.canGrantItem&&b.itemFloorRarity?`<span class="shop-guarantee shop-guarantee--item"><i class="shop-odds-dot" style="background:${It[b.itemFloorRarity]}"></i>${ii(b.itemPercent)} loadout item, ${b.itemFloorRarity} or rarer</span>`:"",k=v=>{const O=v==="coins"?w.coins:w.gems,D=v==="coins"?a.coins:a.gems,_=P(v==="coins"?"coin":"gem"),E=Bo(u,v,m,f),A=D>=O,C=E&&A,R=E?`You need ${(O-D).toLocaleString()} more ${v}`:"Not for sale right now";return`
        <button class="shop-buy shop-buy--${v}${C?"":" is-off"}" type="button"
          data-buy="${u}" data-currency="${v}"${C?"":` disabled title="${R}" aria-label="${O.toLocaleString()} ${v}. ${R}."`}>
          ${_} ${O.toLocaleString()}
        </button>`};let T="";if(!Bo(u,"coins",m,f)&&!Bo(u,"gems",m,f)){const v=b.bestGems===0,O=b.bestCoins<w.coins?`It pays back at most ${b.bestCoins.toLocaleString()} coins for a ${w.coins.toLocaleString()} coin price, and ${Math.round(b.expectedCoins).toLocaleString()} on average.`:`Its average return is ${Math.round(b.expectedCoins).toLocaleString()} coins against a ${w.coins.toLocaleString()} coin price.`,D=b.missingItems;T=`
        <p class="shop-why">
          <span class="shop-why-head">Not for sale</span>
          Every fighter here is already unlocked, so a fighter roll only pays
          ${v?"coins":"currency"} back. ${O}
          ${D>0?`Its ${D} unowned loadout item${D===1?"":"s"} come from
            Chests and the Trophy Road.`:"You own every loadout item in it too."}
        </p>`}else if(!(a.coins>=w.coins)&&!(a.gems>=w.gems))T=`
        <p class="shop-why">
          <span class="shop-why-head">Keep playing</span>
          You need ${(w.coins-a.coins).toLocaleString()} more coins
          or ${(w.gems-a.gems).toLocaleString()} more gems for this one.
        </p>`;else{const v=[...new Set(Ge[u].entries.flatMap(_=>_.characterRarity?Ki[_.characterRarity]??[]:[]))],O=v.filter(_=>!m.has(_)).length,D=b.missingItems>0?` It also holds ${b.missingItems} loadout item${b.missingItems===1?"":"s"}
            you do not have, at ${ii(b.itemPercent)} of the table.`:"";T=b.expectedCoins===0?`<p class="shop-why"><span class="shop-why-head">What you get</span>
            Every fighter roll here is a new fighter. ${O} of the ${v.length} are
            still missing from your roster.${D}</p>`:`<p class="shop-why"><span class="shop-why-head">Duplicates</span>
            ${O} of the ${v.length} fighters here are still missing. A repeat
            trades in for coins, ${Math.round(b.expectedCoins).toLocaleString()} on
            average across the table.${D}</p>`}return`
      <article class="shop-card">
        <div class="shop-card-head">
          <span class="shop-card-em">${Ut(u)}</span>
          <div class="shop-card-id">
            <h3 class="shop-card-name">${g.name}</h3>
            ${y}${x}
          </div>
        </div>
        <p class="shop-blurb">${g.blurb}</p>
        <p class="shop-oddshead">What is inside</p>
        ${s(u)}
        ${i(u)}
        <div class="shop-prices">${k("coins")}${k("gems")}</div>
        ${T}
      </article>`}function l(u){const m=Ge[u],f=a.winsToNextChest;return`
      <article class="shop-card shop-card--free">
        <div class="shop-card-head">
          <span class="shop-card-em">${Ut(u)}</span>
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
      </article>`}function h(){const u=Ma.filter(f=>(a.containers[f]??0)>0);return u.length===0?"":`
      <section class="shop-section shop-inv">
        <h2 class="shop-section-title">Your boxes</h2>
        <div class="shop-heldrow">${u.map(f=>`
      <span class="shop-held">
        <span class="shop-held-em">${Ut(f)}</span>
        <span class="shop-held-name">${Ge[f].name}</span>
        <span class="shop-held-n">${a.containers[f]}</span>
      </span>`).join("")}</div>
        <p class="shop-why"><span class="shop-why-head">Waiting to be opened</span>
          Open them on the Trophy Road, below.</p>
      </section>`}function c(){const u=a.unlocked,m=xi(a.economy);o("coins").textContent=a.coins.toLocaleString(),o("gems").textContent=a.gems.toLocaleString();const f=dT.some(w=>Bo(w,"coins",u,m)||Bo(w,"gems",u,m)),g=f?"":`
      <p class="shop-notice">${P("cone")}
        <span><strong>Nothing here is for sale yet.</strong>
        You own all ${Te.length} fighters, so a fighter roll only pays coins
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
        <p class="shop-rarity">${R0}</p>
        <div class="shop-grid">${Ma.map(w=>Ge[w].price?r(w,u,m):l(w)).join("")}</div>
      </section>
    `,o("footnote").textContent=f?"Coins and gems both work on every box.":"Boxes are earned, not bought:"}o("back").addEventListener("click",()=>t.navigate({name:"home"}));const d=u=>{const m=u.target,f=m.closest("[data-go]")?.dataset.go;if(f==="trophies"){t.navigate({name:"trophies"});return}if(f==="characters"){t.navigate({name:"characters"});return}const g=m.closest("[data-buy]");if(!g||g.disabled)return;const w=g.dataset.buy,b=g.dataset.currency;Bo(w,b,a.unlocked,xi(a.economy))&&a.buyContainer(w,b)};e.addEventListener("click",d);const p=a.onChange(c);return c(),{root:e,dispose(){p(),e.removeEventListener("click",d),e.remove()}}}const uT=`
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
`,fT="admin panel is not enabled in this build — rebuild with VITE_FA_ADMIN=1, or run the dev server",Xm=["opening","home","characters","trophies","shop","settings","lobby","match"];function qi(t){return typeof t=="string"&&Te.includes(t)}function mT(t){return typeof t=="number"?Vi(t):void 0}function gT(t){if(!t||typeof t!="object")return null;const e=t.name;if(typeof e!="string"||!Xm.includes(e))return null;if(e==="match"){const{player:a,enemy:o,seats:n}=t;return qi(a)&&qi(o)?{name:e,player:a,enemy:o,seats:mT(n)}:null}return{name:e}}function wT(t){const e=new URLSearchParams(t),a=e.get("screen");if(a===null||!Xm.includes(a))return null;if(a==="match"){const o=e.get("player"),n=e.get("enemy");return qi(o)&&qi(n)?{name:a,player:o,enemy:n,seats:bT(e)}:null}return{name:a}}function bT(t){const e=t.get("seats");return e===null?void 0:Vi(Number(e))}function Dl(t,e){return t.name!==e.name?!1:t.name==="match"&&e.name==="match"?t.player===e.player&&t.enemy===e.enemy&&t.seats===e.seats:!0}function d0(t){const e=new URLSearchParams(window.location.search);e.set("screen",t.name),t.name==="match"?(e.set("player",t.player),e.set("enemy",t.enemy),t.seats===void 0?e.delete("seats"):e.set("seats",String(t.seats))):(e.delete("player"),e.delete("enemy"),e.delete("seats"));const a=e.toString();return`${window.location.pathname}${a?`?${a}`:""}${window.location.hash}`}function yT(t,e){if(e!=="none")try{const a={fa:1,route:t};e==="push"?window.history.pushState(a,"",d0(t)):window.history.replaceState(a,"",d0(t))}catch{}}const xT=3e3,vT=10,kT=140;function MT(t){i1(),Ym();const e=document.createElement("div");e.className="fa-root",e.innerHTML=`
    <div class="fa-bg"></div>
    <div class="fa-rays"></div>
    <div class="fa-dots"></div>
    <div class="fa-stack" data-el="stack"></div>
    <div class="fa-curtain" data-el="curtain"></div>
  `,t.screenRoot.appendChild(e);const a=e.querySelector('[data-el="stack"]'),o=e.querySelector('[data-el="curtain"]'),n=t.profile??new Y0;let s=null,i={name:"home"},r=0,l=0,h=!1,c=null,d=!1,p=null,u=0;function m(z,Q){console.error(`[shell] ${z}:`,Q)}function f(z){const Q=window.__shellFault;if(!Q)return!1;const de=Q[z];return typeof de!="number"||de<=0?!1:(Q[z]=de-1,!0)}const g={navigate:S,profile:n,gameHost:t.gameHost,hudRoot:t.hudRoot};function w(z){if(f("build"))throw new Error(`__shellFault: build ${z.name}`);switch(z.name){case"opening":return $y(g);case"home":return Ly(g);case"characters":return nT(g);case"trophies":return rT(g);case"shop":return pT(g);case"settings":return JE(g);case"lobby":return Iy(g);case"admin":throw new Error(fT);case"match":return GE(g,z)}throw new Error(`unknown route "${String(z.name)}"`)}function b(){r&&cancelAnimationFrame(r),r=0}function y(){b(),l=performance.now();const z=Q=>{if(d)return;const de=Math.min(Math.max(0,(Q-l)/1e3),1/20);l=Q;try{if(f("update"))throw new Error("__shellFault: update");s?.update?.(de),u=0}catch(Oe){if(u++,u===1&&m(`screen "${i.name}" update() threw`,Oe),u>=vT){m(`screen "${i.name}" update() threw ${u} frames running — stopping the menu loop`,Oe),b();return}}r=requestAnimationFrame(z)};r=requestAnimationFrame(z)}function x(z,Q){if(z.name==="match")try{cd()}catch(Oe){m("disposeCharacterStage() threw",Oe)}try{z.name==="match"?Ae.music.fadeOut():Ae.music.fadeIn()}catch(Oe){m("music transition threw",Oe)}e.classList.toggle("is-ingame",z.name==="match");let de;try{de=w(z)}catch(Oe){L(z,Oe);return}i=z,s=de,a.appendChild(de.root),yT(z,Q),A(),window.__screen=z.name,u=0,s.update?y():b(),z.name!=="match"&&(window.__previewReady=!1,requestAnimationFrame(()=>requestAnimationFrame(()=>{d||(window.__previewReady=!0)})))}function k(z){z.style.cssText=["pointer-events:auto","background:#FFF3DE","color:#1a1224","border-radius:16px","padding:18px 22px","max-width:min(92vw,420px)","text-align:center","box-shadow:0 10px 30px rgba(0,0,0,0.45)","font-family:'Rubik',sans-serif"].join(";")}function T(z){z.style.cssText=["position:absolute","inset:0","z-index:120","display:grid","place-items:center","padding:16px","background:rgba(20,13,30,0.72)","pointer-events:none"].join(";")}function v(z){const Q=document.createElement("button");return Q.type="button",Q.textContent=z,Q.style.cssText=["min-height:44px","min-width:140px","margin-top:14px","padding:0 20px","border:0","border-radius:999px","background:#F4A300","color:#1a1224","font-family:'Rubik',sans-serif","font-weight:800","font-size:16px","cursor:pointer"].join(";"),Q.addEventListener("click",()=>window.location.reload()),Q}function O(z){const Q=document.createElement("div");T(Q),Q.style.background="#16101f",Q.dataset.el="fa-fatal";const de=document.createElement("div");k(de);const Oe=document.createElement("div");Oe.textContent="The kitchen would not open",Oe.style.cssText="font-weight:800;font-size:18px";const ot=document.createElement("div");return ot.textContent=String(z?.message??z??"unknown error"),ot.style.cssText="margin-top:8px;font-size:13px;opacity:0.75;font-family:'Heebo',sans-serif;word-break:break-word",de.append(Oe,ot,v("Reload")),Q.appendChild(de),Q}let D=null,_=null;function E(){if(d||D)return;const z=document.createElement("div");T(z),z.dataset.el="fa-gl-notice";const Q=document.createElement("div");k(Q);const de=document.createElement("div");de.textContent="Graphics interrupted",de.style.cssText="font-weight:800;font-size:18px";const Oe=document.createElement("div");Oe.textContent="The device took the graphics back. Restoring…",Oe.style.cssText="margin-top:6px;font-size:14px;opacity:0.8;font-family:'Heebo',sans-serif";const ot=v("Reload");ot.style.display="none",Q.append(de,Oe,ot),z.appendChild(Q),e.appendChild(z),D=z,_=setTimeout(()=>{_=null,D&&(Oe.textContent="The graphics have not come back. Reloading returns you to this same screen.",ot.style.display="inline-block")},xT)}function A(){_!==null&&(clearTimeout(_),_=null),D?.remove(),D=null}function C(z){return z.detail?.offscreen===!0}function R(z){C(z)||E()}function I(z){C(z)||A()}function L(z,Q){if(m(`screen "${z.name}" failed to mount`,Q),a.innerHTML="",z.name!=="home"){x({name:"home"},"replace");return}s=null,i={name:"home"},window.__screen="home",b(),a.appendChild(O(Q))}function B(){b();try{if(f("dispose"))throw new Error("__shellFault: dispose");s?.dispose()}catch(z){m(`screen "${i.name}" dispose() threw`,z)}s=null,a.innerHTML=""}function H(z){return i.name==="opening"||Dl(z,i)?"replace":"push"}function j(z,Q){h=!0,window.__screenReady=!1,o.classList.add("is-on"),c=setTimeout(()=>{c=null;try{B(),x(z,Q)}catch(de){m("navigation threw",de)}finally{o.classList.remove("is-on"),h=!1,window.__screenReady=!0,q()}},kT)}function S(z){d||h||j(z,H(z))}const N=z=>{if(d)return;const Q=z.state,de=gT(Q?.route)??wT(window.location.search)??{name:"home"};if(!Dl(de,i)){if(h){p=de;return}j(de,"none")}};function q(){const z=p;p=null,!(!z||d||Dl(z,i))&&j(z,"none")}const U=()=>{try{s?.resize?.()}catch(z){m(`screen "${i.name}" resize() threw`,z)}},V='button, [role="button"], a[href], [data-clicksound="on"]',ne=z=>{try{if(Ae.isMuted())return;const Q=z.target?.closest?.(V);if(!Q||Q.closest('[data-clicksound="off"]')||Q.hasAttribute("disabled")||Q.getAttribute("aria-disabled")==="true")return;Ae.previewClick()}catch(Q){m("ui click sound threw",Q)}};return e.addEventListener("click",ne,!0),window.addEventListener("resize",U),window.addEventListener("popstate",N),window.addEventListener("fa:webglcontextlost",R),window.addEventListener("fa:webglcontextrestored",I),window.__shell={navigate:S,route:()=>i},{navigate(z){if(!s){x(z,z.name==="opening"?"none":"replace"),window.__screenReady=!0;return}S(z)},get route(){return i},dispose(){d=!0,c!==null&&clearTimeout(c),e.removeEventListener("click",ne,!0),window.removeEventListener("resize",U),window.removeEventListener("popstate",N),window.removeEventListener("fa:webglcontextlost",R),window.removeEventListener("fa:webglcontextrestored",I),A(),B(),cd(),e.remove(),delete window.__shell}}}const $t=new URLSearchParams(location.search),ET=["player","enemy","simSpeed","fogRadius","px","py","fighters","seats"];function p0(t,e){const a=$t.get(t);return a&&Te.includes(a)?a:e}function TT(t){if($t.get("screen")==="match"||!$t.has("screen")&&ET.some(a=>$t.has(a))){const a=p0("player",t.selected),o=a==="donut"?"hamburger":"donut",n=yw($t);return{name:"match",player:a,enemy:p0("enemy",o),seats:n}}return $t.get("screen")==="lobby"?{name:"lobby"}:$t.get("screen")==="characters"?{name:"characters"}:$t.get("screen")==="trophies"?{name:"trophies"}:$t.get("screen")==="shop"?{name:"shop"}:$t.get("screen")==="settings"?{name:"settings"}:$t.get("screen")==="home"?{name:"home"}:{name:"opening"}}const Zm=new Y0,ST=MT({gameHost:document.getElementById("game"),hudRoot:document.getElementById("hud"),screenRoot:document.getElementById("screens"),profile:Zm});ST.navigate(TT(Zm));Ae.music.play();const AT=document.getElementById("boot");requestAnimationFrame(()=>AT.classList.add("hidden"));
