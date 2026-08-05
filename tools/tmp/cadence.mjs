// Report the run-cycle period of every character — the observable form of
// `rig.heaviness`, which is what tells us whether the archetypes move differently.
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:5186';
const IDS = ['waterbottle','egg','lollipop','donut','soup','hamburger','taco','pizza','sushi','burrito','hotdog'];
const ARCH = {waterbottle:'stub',egg:'stub',lollipop:'stub',donut:'stub',soup:'stout',hamburger:'stout',taco:'stout',pizza:'standard',sushi:'standard',burrito:'lanky',hotdog:'lanky'};
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox']});
const p = await b.newPage({viewport:{width:300,height:400}});
await p.route('**/@vite/client*', r=>r.fulfill({status:200,contentType:'text/javascript',body:'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},decline(){},data:{}});export const injectQuery=u=>u;export const updateStyle=()=>{};export const removeStyle=()=>{};export const ErrorOverlay=class{};export default {};'}));
console.log('char          arch      runCycle(s)  squash   rootRise');
for (const id of IDS) {
  await p.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=run&t=0&shot=1`, {waitUntil:'networkidle'});
  await p.waitForFunction('window.__previewReady === true');
  const tr = await p.evaluate(()=>window.__preview.trace({anim:'run',t0:0,t1:1.3,samples:157}));
  const S = tr.samples, N = Object.keys(S[0].joints);
  const d = i => N.reduce((s,n)=>{const a=S[i].joints[n],c=S[0].joints[n];return s+Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2]);},0);
  let best=-1,bd=Infinity;
  for(let i=Math.floor(S.length*0.33);i<S.length;i++){const x=d(i); if(x<bd){bd=x;best=i;}}
  const sy = S.map(s=>s.bodyScale[1]);
  const by = S.map(s=>s.joints.rig_body[1]);
  console.log(`${id.padEnd(13)} ${ARCH[id].padEnd(9)} ${S[best].t.toFixed(3).padStart(8)} ${(Math.max(...sy)-Math.min(...sy)).toFixed(3).padStart(9)} ${(Math.max(...by)-Math.min(...by)).toFixed(3).padStart(10)}`);
}
await b.close();
