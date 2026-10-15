"""GX_GAP_FX — what distinguishes a reference effect from ours, per effect mask:
  coreMinusRim  median luma of the core (eroded 10 px) minus the rim (outer 3 px band) — a glow
                or lit volume has a bright core; a flat sticker reads ~0.
  deadFlat      share of interior px (eroded 4 px) with |grad L| < 0.5/255 per px — the
                critics' own "dead flat" test, same threshold.
  Lsd, Lp95, hi80, C mean
Ours: DELIVERED vfx mask (canvas vs novfx); reference: annotated effect polygons (role 5)."""
import sys, os, glob, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import gx_gap_roles as G
from gx_gap_lib import luma, oklab, grad_mag
np.seterr(all='ignore')
def erode(m, r): return ~G.dilate(~m, r)
def fx(rgb, mask):
    if mask.sum() < 500: return None
    L = luma(rgb); g = grad_mag(L)
    core = erode(mask, 10); interior = erode(mask, 4); rim = mask & ~erode(mask, 3)
    C = np.hypot(*oklab(rgb)[1:])
    return {'px%': round(100 * mask.mean(), 2),
            'coreMinusRim': round(float(np.median(L[core]) - np.median(L[rim])), 3) if core.sum() > 100 else None,
            'deadFlat': round(float((g[interior] < 0.5 / 255).mean()), 3) if interior.sum() > 100 else None,
            'Lsd': round(float(L[mask].std()), 3), 'Lp95': round(float(np.quantile(L[mask], .95)), 3),
            'hi80': round(float((L[mask] > .8).mean()), 3), 'C': round(float(C[mask].mean()), 3)}
if __name__ == '__main__':
    for js in sorted(glob.glob(sys.argv[1] + '/*_[0-9].json')):
        R = G.ours_roles(js[:-5]); print('ours', os.path.basename(js)[:-5], fx(R['canvas'], R['role'] == 5))
    for n in ['bs_01', 'bs_02', 'bs_03', 'bs_04', 'bs_05', 'bs_06']:
        R = G.ref_roles(n); print('ref ', n, fx(R['page'], R['role'] == 5))
    # ground controls: the same statistics on clean ground, both sides (what "flat" means here)
    for js in sorted(glob.glob(sys.argv[1] + '/*_[0-9].json'))[:2]:
        R = G.ours_roles(js[:-5]); print('ours GROUND', os.path.basename(js)[:-5], fx(R['canvas'], R['role'] == 1))
    for n in ['bs_01', 'bs_04']:
        R = G.ref_roles(n); print('ref  GROUND', n, fx(R['page'], R['role'] == 1))
