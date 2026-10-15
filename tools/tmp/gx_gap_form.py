"""
GX_GAP_FORM — does a box read as a box? Luma of TOP faces vs CAMERA-FACING vertical faces vs
SIDE faces on our structure pixels, from the exact normal pass (validated: ground pixels must
decode to world-up, |n| = 1). The reference arm is hand-picked top/front patch pairs on the
plates' box-like obstacles (shots/rv/audit/gap/ref/ref_faces.json), coordinates only.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import gx_gap_roles as G
from gx_gap_lib import luma
np.seterr(all='ignore')

def world_normals(base, meta):
    nrm = np.asarray(Image.open(base + '.normal.png').convert('RGB')).astype(float) / 255
    M = np.array(meta['camera']['matrixWorld']).reshape(4, 4).T
    w = (nrm * 2 - 1) @ M[:3, :3].T
    return w / np.maximum(np.linalg.norm(w, axis=-1, keepdims=True), 1e-6)

def ours(base):
    meta = json.load(open(base + '.json'))
    R = G.ours_roles(base)
    w = world_normals(base, meta)
    L = luma(R['canvas'])
    role = R['role']
    g = role == 1
    gnd_ok = float(np.median(w[g][:, 1])) if g.any() else None
    obst = role == 2
    top = obst & (w[..., 1] > 0.85)
    front = obst & (np.abs(w[..., 1]) < 0.35) & (w[..., 2] > 0.6)
    side = obst & (np.abs(w[..., 1]) < 0.35) & (np.abs(w[..., 0]) > 0.6)
    f = lambda m: (float(np.median(L[m])), int(m.sum())) if m.sum() > 200 else (None, int(m.sum()))
    t, fr, sd = f(top), f(front), f(side)
    gl = float(np.median(L[g & ~R['shadow']])) if g.any() else None
    return {'groundUpCheck': round(gnd_ok, 4) if gnd_ok else None, 'top': t, 'front': fr, 'side': sd, 'groundLit': gl,
            'frontOverTop': round(fr[0] / t[0], 3) if fr[0] and t[0] else None,
            'sideOverTop': round(sd[0] / t[0], 3) if sd[0] and t[0] else None}

if __name__ == '__main__':
    for js in sorted(glob.glob(sys.argv[1] + '/*_[0-9].json')):
        print(os.path.basename(js)[:-5], ours(js[:-5]))


def per_mesh(base):
    """Same-MESH top vs camera-facing ratio: albedo cancels, only lighting remains."""
    meta = json.load(open(base + '.json'))
    R = G.ours_roles(base)
    w = world_normals(base, meta)
    L = luma(R['canvas'])
    ids = G.decode_ids(base + '.idopaque.png')
    names = {m['id']: m['name'] for m in meta['meshes'] if m.get('id')}
    role = R['role']
    top = (w[..., 1] > 0.85); front = (np.abs(w[..., 1]) < 0.35) & (w[..., 2] > 0.6)
    rows = []
    for i in np.unique(ids[(role == 2) & (ids > 0)]):
        m = (ids == i) & (role == 2) & ~R['shadow']
        t = m & top; f = m & front
        if t.sum() >= 150 and f.sum() >= 150:
            rows.append((names.get(int(i), '?'), float(np.median(L[f]) / np.median(L[t])), int(t.sum()), int(f.sum())))
    return rows

if __name__ == '__main__' and '--per-mesh' in sys.argv:
    for js in sorted(glob.glob(sys.argv[1] + '/*_[0-9].json')):
        rows = per_mesh(js[:-5])
        r = [x[1] for x in rows]
        print(os.path.basename(js)[:-5], 'meshes', len(rows), 'front/top same-mesh: min %.3f med %.3f max %.3f' % (min(r), float(np.median(r)), max(r)) if r else 'none')
        for x in sorted(rows, key=lambda x: -x[2] - x[3])[:8]:
            print('   ', x[0][:40].ljust(40), 'front/top %.3f  top px %d front px %d' % (x[1], x[2], x[3]))
