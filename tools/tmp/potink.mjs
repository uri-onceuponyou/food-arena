import { chromium } from 'playwright';
const BASE = process.env.PREVIEW_BASE;
const LAUNCH_ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b = await chromium.launch({ args: LAUNCH_ARGS });
const p = await b.newPage({ viewport:{width:1600,height:900} });
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=700&py=640&fogRadius=545&simSpeed=0.02&pointerLock=0`, { waitUntil:'networkidle', timeout:90000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout:90000 });
await p.waitForTimeout(2000);
const out = await p.evaluate(`(() => {
  const st = window.__stage;
  const arena = st.scene.children.find(c => c.name === 'arena:kitchen');
  const find = (n) => { let r=null; arena.traverse(o=>{ if(!r && o.name===n) r=o; }); return r; };
  let potCover = find('cover:boiling_pot'); if(!potCover){ arena.traverse(o=>{ if(!potCover && o.name==='pot_solid') potCover=o.parent; }); }
  const legacy = [];
  arena.traverse(o => { if (o.name === 'pot_body' || o.name === 'pot_rim') legacy.push({name:o.name, path:(()=>{const s=[];let q=o;while(q){s.unshift(q.name||q.type);q=q.parent;}return s.join('/');})()}); });
  const outlines = [];
  if (potCover) potCover.traverse(o => { if (o.isMesh && o.name.endsWith('__outline')) {
    const u = o.material?.uniforms; outlines.push({ name:o.name, thickness: u?.outlineThickness?.value ?? o.material?.userData?.thickness ?? null });
  }});
  let meshes=0, shadows=0;
  if (potCover) potCover.traverse(o => { if(o.isMesh){meshes++; if(o.name.includes('contact_shadow')||o.name.includes('grounded')) shadows++;} });
  // total scene draw-ish count
  let sceneMeshes=0; st.scene.traverse(o=>{ if(o.isMesh && o.visible) sceneMeshes++; });
  return { hasPotCover: !!potCover, potCoverMeshes: meshes, shadowDecalsUnderPot: shadows,
           outlineCount: outlines.length, thicknesses: [...new Set(outlines.map(o=>o.thickness))], legacy, sceneMeshes,
           potCoverPos: potCover ? [potCover.position.x, potCover.position.y, potCover.position.z] : null };
})()`);
console.log(JSON.stringify(out, null, 2));
await b.close();
