"""GX_GAP_WORLD — whole-frame statistics on PLAYFIELD pixels only (role != hud), both sides.
Ours: exact HUD mask (page vs canvas) and the canvas pixels; reference: annotated HUD boxes.
The full-frame numbers (HUD included) put ours INSIDE the reference band on luma sd/p05/notan,
because our HUD supplies the darks; this asks the same question of the world alone."""
import sys, os, glob, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import gx_gap_roles as G
from gx_gap_lib import frame_stats, box_mean, luma
np.seterr(all='ignore')
def local_rms(rgb, mask, r=12):
    L = luma(rgb); m1 = box_mean(L, r); m2 = box_mean(L * L, r)
    return np.sqrt(np.maximum(0, m2 - m1 * m1))[mask]
def row(name, rgb, world):
    s = frame_stats(rgb, world); h = s['hue'] or {}
    rms = local_rms(rgb, world)
    return {'name': name, 'px': s['px'], 'Lmean': s['luma']['mean'], 'Lsd': s['luma']['sd'], 'p05': s['luma']['p05'], 'p50': s['luma']['p50'], 'p95': s['luma']['p95'],
            'lo30': s['luma']['lo30'], 'hi80': s['luma']['hi80'], 'notan': s['notan3'], 'C': s['chromaOK']['mean'], 'viv15': s['chromaOK']['vivid15'],
            'win35': h.get('win35'), 'R': h.get('R'), 'H': h.get('entropyBits'), 'rms12_p50': float(np.median(rms)), 'rms12_p90': float(np.quantile(rms, .9))}
if __name__ == '__main__':
    rows = []
    for js in sorted(glob.glob(sys.argv[1] + '/*_[0-9].json')):
        R = G.ours_roles(js[:-5]); world = R['role'] != 6
        rows.append(('ours', row(os.path.basename(js)[:-5], R['canvas'], world)))
    for n in ['bs_01', 'bs_02', 'bs_03', 'bs_04', 'bs_05', 'bs_06']:
        R = G.ref_roles(n); world = R['role'] != 6
        rows.append(('ref', row(n, R['page'], world)))
    for side, r in rows:
        print(f"{side:4s} {r['name']:6s} Lmean {r['Lmean']:.3f} sd {r['Lsd']:.3f} p05 {r['p05']:.3f} p50 {r['p50']:.3f} p95 {r['p95']:.3f} lo30 {r['lo30']:.3f} hi80 {r['hi80']:.3f} notan {r['notan']} C {r['C']:.3f} viv15 {r['viv15']:.3f} win35 {r['win35']} R {r['R']} H {r['H']} rms12 {r['rms12_p50']:.4f}/{r['rms12_p90']:.4f}")
    json.dump(rows, open(sys.argv[2], 'w'), indent=1)
