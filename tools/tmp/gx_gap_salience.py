"""GX_GAP_SALIENCE — where does the eye go at thumbnail scale? Each frame is cut into a 32x18
grid (50x50 px at 1600x900; proportional on the plates). Cell salience = OKLab distance of the
cell mean from the frame's median colour + 0.5 x the cell's own OKLab spread. Reports the best
rank of any cell that is >= 25% fighter (body, + ring on the reference) and the roles owning the
top 10 cells. HUD cells are EXCLUDED from the ranking (world salience), reported separately.
Same code both sides; ours uses exact role maps, the reference its hand masks."""
import sys, os, glob, json, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import gx_gap_roles as G
from gx_gap_lib import oklab
np.seterr(all='ignore')
NAMES = G.NAMES
def sal(rgb, role, gx=32, gy=18):
    L, A, B = oklab(rgb); h, w = role.shape
    lab = np.stack([L, A, B], -1)
    med = np.median(lab.reshape(-1, 3), 0)
    cells = []
    for j in range(gy):
        for i in range(gx):
            y0, y1 = j * h // gy, (j + 1) * h // gy; x0, x1 = i * w // gx, (i + 1) * w // gx
            c = lab[y0:y1, x0:x1].reshape(-1, 3); r = role[y0:y1, x0:x1].ravel()
            s = float(np.linalg.norm(c.mean(0) - med) + 0.5 * np.linalg.norm(c.std(0)))
            frac = {k: float((r == k).mean()) for k in range(9)}
            cells.append((s, frac))
    return cells
def report(rgb, role):
    cells = sal(rgb, role)
    world = [c for c in cells if c[1][6] < 0.5]
    world.sort(key=lambda c: -c[0])
    fr = [k for k, c in enumerate(world) if c[1][3] + c[1][4] >= 0.25]
    best = fr[0] + 1 if fr else None
    top = [max(range(9), key=lambda k: c[1][k]) for c in world[:10]]
    return best, len(world), [NAMES[t] for t in top]
if __name__ == '__main__':
    for d in sys.argv[1:]:
        for js in sorted(glob.glob(d + '/*_[0-9].json')):
            R = G.ours_roles(js[:-5]); b, n, top = report(R['page'], R['role'])
            print('ours', os.path.basename(js)[:-5], 'best fighter-cell rank', b, 'of', n, '| top10 roles', top)
    for nme in ['bs_01', 'bs_02', 'bs_03', 'bs_04', 'bs_05', 'bs_06']:
        R = G.ref_roles(nme); b, n, top = report(R['page'], R['role'])
        print('ref ', nme, 'best fighter-cell rank', b, 'of', n, '| top10 roles', top)
