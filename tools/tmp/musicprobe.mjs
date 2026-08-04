import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:1200,height:700} });
p.on('console', m => { const t=m.text(); if(/music|audio|Error|error/i.test(t)) console.log('PAGE:', t.slice(0,140)); });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForTimeout(2500);
// real gesture to unlock
await p.mouse.click(600, 350);
await p.waitForTimeout(4000);

const state = await p.evaluate(() => ({
  engine: window.__audio?.stats?.().state ?? 'no-__audio',
  els: [...document.querySelectorAll('audio')].map(a => ({
    src: a.src.split('/').pop(), paused: a.paused, ct: +a.currentTime.toFixed(2),
    dur: isFinite(a.duration) ? +a.duration.toFixed(1) : null, ready: a.readyState, loop: a.loop,
  })),
}));
console.log('engine state:', state.engine);
console.log('audio elements:', JSON.stringify(state.els));

// Measure the master bus with music ON, then with music DISABLED.
async function measure(label) {
  const rms = await p.evaluate(() => new Promise(res => {
    const eng = window.__audio; if (!eng) return res(null);
    const ctx = eng.engine.context; if (!ctx) return res(null);
    const sp = ctx.createScriptProcessor(2048, 2, 1);
    let peak = 0, sum = 0, n = 0, blocks = 0;
    sp.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      for (let i=0;i<d.length;i++){ const v=Math.abs(d[i]); if(v>peak)peak=v; sum+=d[i]*d[i]; n++; }
      if (++blocks >= 60) { sp.disconnect(); res({ peak:+peak.toFixed(4), rms:+Math.sqrt(sum/n).toFixed(4), blocks }); }
    };
    sp.connect(ctx.destination);
    eng.connectTap(sp);
    setTimeout(()=>{ try{sp.disconnect();}catch{} res({ peak:+peak.toFixed(4), rms:+Math.sqrt(sum/Math.max(1,n)).toFixed(4), blocks, timeout:true }); }, 6000);
  }));
  console.log(`${label.padEnd(22)}`, JSON.stringify(rms));
  return rms;
}
const on = await measure('music ENABLED:');
await p.evaluate(() => window.__audioMusicOff?.() );
await p.evaluate(async () => { const m = await import('/src/audio/index.ts'); m.audio.music.setEnabled(false); });
await p.waitForTimeout(1200);
const off = await measure('music DISABLED:');
console.log('\nVERDICT:', (on?.rms ?? 0) > 0.0005 && (on.rms > (off?.rms ?? 0) * 3)
  ? 'MUSIC IS AUDIBLE and is the source' : 'NOT PROVEN — investigate');
await b.close();
