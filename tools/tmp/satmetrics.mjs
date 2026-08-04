// Acceptance metrics for the saturation-contract change. Reads an arena-scan
// metrics.json and prints the four acceptance numbers plus per-station rows.
import { readFileSync } from 'node:fs';
const files = process.argv.slice(2);
const load = (f) => JSON.parse(readFileSync(f, 'utf8')).stations.filter((s) => s.ok);
const med = (a) => { const s=[...a].sort((x,y)=>x-y); const h=s.length>>1; return s.length%2?s[h]:(s[h-1]+s[h])/2; };
const mean = (a) => a.reduce((x,y)=>x+y,0)/a.length;
for (const f of files) {
  const st = load(f);
  const ranks = st.map((s)=>s.metrics.playerRank);
  const dsat  = st.map((s)=>+(s.metrics.centreContrast.playerSat - s.metrics.centreContrast.ringSat).toFixed(3));
  const dlum  = st.map((s)=>s.metrics.centreContrast.deltaLuma);
  const bin0  = st.map((s)=>s.metrics.hueHist[0]);
  const warm  = st.map((s)=>+(s.metrics.hueHist[0]+s.metrics.hueHist[1]).toFixed(3));
  const dom   = st.map((s)=>s.metrics.dominantHueShare);
  const cl    = st.map((s)=>s.metrics.clippedLowPct);
  const ch    = st.map((s)=>s.metrics.clippedHighPct);
  console.log(`\n=== ${f}  (${st.length} stations) ===`);
  console.log('station           rank  dSat   dLum   bin0(0-30)  warm(0-60)  domShare  clip0 clip255');
  st.forEach((s,i)=>console.log(
    `${s.id.padEnd(16)} ${String(ranks[i]).padStart(4)}  ${String(dsat[i]).padStart(6)} ${String(dlum[i]).padStart(6)}   `+
    `${bin0[i].toFixed(3)}       ${warm[i].toFixed(3)}      ${dom[i].toFixed(3)}    ${cl[i].toFixed(2)}  ${ch[i].toFixed(2)}`));
  console.log('---');
  console.log(`A playerRank      median ${med(ranks)}   mean ${mean(ranks).toFixed(1)}   top6: ${ranks.filter(r=>r<=6).length}/${st.length}   top12: ${ranks.filter(r=>r<=12).length}/${st.length}   top24: ${ranks.filter(r=>r<=24).length}/${st.length}`);
  console.log(`B player-surround sat  positive at ${dsat.filter(d=>d>0).length}/${st.length}   mean ${mean(dsat).toFixed(3)}   median ${med(dsat).toFixed(3)}`);
  console.log(`C hue 0-30 bin0   mean ${mean(bin0).toFixed(3)}  max ${Math.max(...bin0).toFixed(3)}  |  warm 0-60 mean ${mean(warm).toFixed(3)} max ${Math.max(...warm).toFixed(3)}  |  domShare mean ${mean(dom).toFixed(3)} max ${Math.max(...dom).toFixed(3)}`);
  console.log(`D clipping        low ${Math.min(...cl).toFixed(2)}-${Math.max(...cl).toFixed(2)}%   high ${Math.min(...ch).toFixed(2)}-${Math.max(...ch).toFixed(2)}%`);
  console.log(`  (aux) deltaLuma |dL|<=0.06 at ${dlum.filter(d=>Math.abs(d)<=0.06).length}/${st.length}, negative at ${dlum.filter(d=>d<0).length}/${st.length}`);
}
