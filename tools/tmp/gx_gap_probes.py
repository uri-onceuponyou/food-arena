"""GX_GAP_PROBES — the lever probes, priced on the SAME frozen frame: playfield value structure
(role != hud, canvas pixels) and per-fighter contrast for each variant. A probe prices what a
knob does to the pixels; it does NOT say a viewer reacts to it (LESSONS §6b)."""
import sys, os, glob, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import gx_gap_roles as G
from gx_gap_lib import frame_stats, luma, box_mean
np.seterr(all='ignore')
VARS = ['canvas', 'nofront', 'unlift', 'nofront_unlift']
def rms(rgb, mask, r=12):
    L = luma(rgb); m1 = box_mean(L, r); m2 = box_mean(L * L, r)
    return float(np.median(np.sqrt(np.maximum(0, m2 - m1 * m1))[mask]))
if __name__ == '__main__':
    for js in sorted(glob.glob(sys.argv[1] + '/*_[0-9].json')):
        base = js[:-5]
        if not os.path.exists(base + '.nofront.png'):
            continue
        R = G.ours_roles(base); world = R['role'] != 6; role = R['role']
        print('==', os.path.basename(base))
        for v in VARS:
            rgb = np.asarray(Image.open(f'{base}.{v}.png').convert('RGB')).astype(float) / 255
            s = frame_stats(rgb, world)
            fl = []
            for nm, body in R['bodies'].items():
                f = G.fighter_stats(rgb, role, body, role.shape[0])
                if f: fl.append(f['dLmedian'])
            print(f"   {v:15s} p05 {s['luma']['p05']:.3f} p50 {s['luma']['p50']:.3f} sd {s['luma']['sd']:.3f} lo30 {s['luma']['lo30']:.3f} notan {s['notan3']} C {s['chromaOK']['mean']:.3f} rms12 {rms(rgb, world):.4f} | fighter dL vs surround {[round(x,3) for x in fl]}")
