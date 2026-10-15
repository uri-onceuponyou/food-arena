"""
GX_GAP_REFMASK — role masks for the six top-down reference plates, from hand annotations
plus a per-plate GROUND COLOUR MODEL, and overlays to LOOK at.

🚨 Third-party plates, public repo: numbers and coordinates only. Annotations live in the
gitignored scratch dir (shots/rv/audit/gap/ref/ref_annot.json) and describe ROLES only.

Roles (priority high -> low): hud > fighter (ellipse body = non-ground px inside the ellipse,
plus actor polygons) > ring (ellipse minus fighter) > effect (polygon) > ground (colour model)
> obstacle (everything else). 'shadow' is a FLAG on ground-family pixels darker than the lit
ground (k <= 0.88 along the ground's own OKLab ray), not a role.

The ground model: median OKLab g over the annotated lit-ground boxes. A pixel v is in the
ground FAMILY if it lies near the ray k*g: k = v.g/g.g in [0.40,1.20] and |v - k g| < TOL.
The same function is applied to OUR frames by gx_gap_roles.py, where the exact ID-pass
ground mask measures its error, so the reference masks carry a measured error bar.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from gx_gap_lib import oklab

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
PLATES = os.path.join(ROOT, 'reference/images/curated/gameplay_topdown')
ANNOT = os.path.join(ROOT, 'shots/rv/audit/gap/ref/ref_annot.json')
OUT = os.path.join(ROOT, 'shots/rv/audit/gap/ref')
TOL = 0.045
ROLE_CODES = {'ground': 1, 'obstacle': 2, 'fighter': 3, 'ring': 4, 'effect': 5, 'hud': 6}
ROLE_COLS = {1: (40, 40, 40), 2: (60, 110, 255), 3: (255, 40, 200), 4: (40, 255, 120), 5: (255, 210, 0), 6: (255, 255, 255)}


def ellipse_mask(h, w, e):
    cx, cy, rx, ry = e
    yy, xx = np.mgrid[0:h, 0:w]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


def poly_mask(h, w, pts):
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=1)
    return np.asarray(im).astype(bool)


def box_mask(h, w, b):
    m = np.zeros((h, w), bool)
    x0, y0, x1, y1 = [int(v) for v in b]
    m[max(0, y0):min(h, y1), max(0, x0):min(w, x1)] = True
    return m


def ground_model(lab, boxes):
    L, A, B = lab
    sel = np.zeros(L.shape, bool)
    for b in boxes:
        sel |= box_mask(L.shape[0], L.shape[1], b)
    g = np.array([np.median(L[sel]), np.median(A[sel]), np.median(B[sel])])
    return g, int(sel.sum())


def ground_family(lab, g, tol=TOL):
    L, A, B = lab
    v = np.stack([L, A, B], -1)
    k = (v @ g) / float(g @ g)
    r = np.linalg.norm(v - k[..., None] * g[None, None, :], axis=-1)
    fam = (k > 0.40) & (k < 1.20) & (r < tol)
    return fam, k, r


def build(name, rgb, ann):
    h, w = rgb.shape[:2]
    lab = oklab(rgb)
    g, nsel = ground_model(lab, ann['ground'])
    fam, k, r = ground_family(lab, g)
    role = np.zeros((h, w), np.uint8)
    # low -> high priority writes
    role[:] = ROLE_CODES['obstacle']
    role[fam] = ROLE_CODES['ground']
    # same-hue structure the ground ray cannot separate (tall grass on a grass map, cliff
    # faces on sand): hand polygons, ABOVE the colour model; lane markings forced to ground.
    for p in ann.get('groundForce', []):
        role[poly_mask(h, w, p)] = ROLE_CODES['ground']
    for p in ann.get('obstacles', []):
        role[poly_mask(h, w, p)] = ROLE_CODES['obstacle']
    for p in ann.get('effects', []):
        role[poly_mask(h, w, p)] = ROLE_CODES['effect']
    fmask = np.zeros((h, w), bool)
    for e in ann.get('fighters', []):
        fmask |= ellipse_mask(h, w, e)
    for p in ann.get('actors', []):
        fmask |= poly_mask(h, w, p)
    for e in ann.get('rings', []):
        rm = ellipse_mask(h, w, e) & ~fmask
        role[rm] = ROLE_CODES['ring']
    # fighter body = non-ground-family pixels inside the fighter ellipses
    role[fmask & ~fam] = ROLE_CODES['fighter']
    for b in ann.get('hud', []):
        role[box_mask(h, w, b)] = ROLE_CODES['hud']
    shadow = fam & (k <= 0.88) & (role == ROLE_CODES['ground'])
    np.seterr(all='ignore')
    return role, shadow, g, k


def overlay(rgb, role, shadow, path):
    base = (rgb * 255).astype(np.uint8)
    col = np.zeros_like(base)
    for c, v in ROLE_COLS.items():
        col[role == c] = v
    mix = (0.45 * base + 0.55 * col).astype(np.uint8)
    mix[shadow] = (0.5 * mix[shadow] + 0.5 * np.array([0, 255, 255])).astype(np.uint8)
    Image.fromarray(np.concatenate([base, mix], 1)).save(path)


if __name__ == '__main__':
    ann_all = json.load(open(ANNOT))
    res = {}
    for name in sorted(k for k in ann_all if k.startswith('bs_')):
        im = Image.open(os.path.join(PLATES, name + '.png')).convert('RGB')
        rgb = np.asarray(im).astype(np.float64) / 255
        role, shadow, g, k = build(name, rgb, ann_all[name])
        np.save(os.path.join(OUT, f'role_{name}.npy'), role)
        np.save(os.path.join(OUT, f'shadow_{name}.npy'), shadow)
        overlay(rgb, role, shadow, os.path.join(OUT, f'ov_{name}.png'))
        n = role.size
        res[name] = {r: round(float((role == c).sum() / n), 4) for r, c in ROLE_CODES.items()}
        res[name]['shadowOfGround'] = round(float(shadow.sum() / max(1, (role == 1).sum())), 4)
        res[name]['groundLab'] = [round(float(x), 4) for x in g]
        print(name, res[name])
    json.dump(res, open(os.path.join(OUT, 'ref_roles_summary.json'), 'w'), indent=1)
