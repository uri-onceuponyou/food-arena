"""
GX_GAP_ROLES — per-role frame statistics, OURS (exact masks from gx_gap_cap.mjs) vs the six
top-down plates (hand-annotated masks from gx_gap_refmask.py), through ONE set of functions.

Role codes (shared with gx_gap_refmask.py):
  1 ground   2 obstacle (structure + hazard bodies)   3 fighter   4 ring (seat marker)
  5 effect   6 hud   7 debris/litter (ours only; the reference method folds it into 2)
  8 fog      0 background
OURS, priority high -> low:
  hud      |page - canvas| >= 16 on any channel, dilated 1 px          (DOM over canvas)
  fighter  top-most ID pass, mesh under a `character:*` root
  effect   |canvas - novfx| >= 12, i.e. DELIVERED vfx pixels (not authored quads)
  rest     opaque-only ID pass -> arena sub-role by mesh name (see arena_sub)
  shadow   FLAG: luma(noshadow) - luma(canvas) >= 0.03 (key light shadow.intensity -> 0)

🚨 Plates are third-party, the repo is public: numbers only.
"""
import json, os, sys, glob, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from gx_gap_lib import luma, oklab, hsl, box_mean, grad_mag, hue_stats
np.seterr(all='ignore')

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
REFDIR = os.path.join(ROOT, 'shots/rv/audit/gap/ref')
PLATES = os.path.join(ROOT, 'reference/images/curated/gameplay_topdown')
STRICT_REF = '--strict-ref' in sys.argv
NAMES = {0: 'bg', 1: 'ground', 2: 'obstacle', 3: 'fighter', 4: 'ring', 5: 'effect', 6: 'hud', 7: 'debris', 8: 'fog'}


def rgbf(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float64) / 255.0


def decode_ids(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int32)
    qv = np.clip(np.round((a - 8) / 16.0), 0, 15).astype(np.int32)
    ok = (np.abs(a - (qv * 16 + 8)) <= 7).all(-1)
    ids = qv[..., 0] | (qv[..., 1] << 4) | (qv[..., 2] << 8)
    ids[~ok] = -1          # an antialiased edge blend: no valid id
    ids[(a.max(-1) <= 4)] = 0
    return ids


def arena_sub(m):
    n = m['name'] or ''
    p = m['path'] or ''
    if n.startswith(('debris_', 'hub_debris_', 'ground_chip')):
        return 7
    if 'contact_shadow' in n or 'grounding' in n or n.startswith('contact'):
        return 1   # a decal ON the ground: the viewer reads ground
    if n.startswith(('floor_', 'apron_service_floor', 'puddle', 'hazard_ring')):
        return 1
    if n.startswith(('pot_', 'hazard_')) or 'boiling_pot' in p or 'pot_solid' in p:
        return 2
    if m.get('transparent') and m.get('matType') == 'MeshBasicMaterial' and not n:
        return 1
    return 2


def mesh_roles(meta):
    tops = {t['i']: t for t in meta['tops']}
    role_of_id = {0: 0}
    fighter_of_id = {}
    for m in meta['meshes']:
        if not m.get('id'):
            continue
        t = tops.get(m['top'], {})
        nm = t.get('name', '') or ''
        if nm.startswith('character:'):
            role_of_id[m['id']] = 3
            fighter_of_id[m['id']] = nm
        elif nm == 'vfx_layer':
            role_of_id[m['id']] = 5
        elif nm == 'contact:shadows':
            role_of_id[m['id']] = 1
        elif nm == 'fog_boundary':
            role_of_id[m['id']] = 8
        elif nm == 'arena:kitchen':
            role_of_id[m['id']] = arena_sub(m)
        else:
            role_of_id[m['id']] = 2
    return role_of_id, fighter_of_id


def lut_map(ids, table, default=0):
    mx = max(4096, int(ids.max()) + 2)
    lut = np.full(mx + 2, default, dtype=object if isinstance(default, str) else np.int32)
    for k, v in table.items():
        if 0 <= k < mx:
            lut[k] = v
    out = lut[np.clip(ids, 0, mx)]
    return out


def dilate(mask, r):
    if r <= 0:
        return mask.copy()
    return box_mean(mask.astype(np.float64), r) > 1e-9


def ours_roles(base):
    meta = json.load(open(base + '.json'))
    page = rgbf(base + '.png')
    can = rgbf(base + '.canvas.png')
    nov = rgbf(base + '.novfx.png')
    nof = rgbf(base + '.nofighters.png')
    nos = rgbf(base + '.noshadow.png')
    ids_top = decode_ids(base + '.id.png')
    ids_op = decode_ids(base + '.idopaque.png')
    role_of_id, fighter_of_id = mesh_roles(meta)
    r_top = lut_map(ids_top, role_of_id, 0)
    r_op = lut_map(ids_op, role_of_id, 0)
    # antialiased edge pixels (-1) inherit the opaque-pass role, or ground as a last resort
    r_op = np.where(ids_op < 0, 1, r_op)
    hdiff_ = np.abs(page - can).max(-1)
    hud0 = hdiff_ >= 16 / 255
    hud0 = dilate(~dilate(~hud0, 1), 1)      # 1-px OPENING: drops 1-px AA lines along silhouettes
    hud = dilate(hud0, 1)
    hud_opaque = hud & (hdiff_ >= 60 / 255)
    fighter = (r_top == 3)
    vfxd = (np.abs(can - nov).max(-1) >= 12 / 255)
    fighterd = (np.abs(can - nof).max(-1) >= 12 / 255)
    role = r_op.astype(np.int32).copy()
    role[r_op == 5] = 1          # an opaque vfx mesh with no delivered diff: leave to ground
    role[r_op == 3] = 1
    role[vfxd] = 5
    role[hud] = 6
    shadow = (luma(nos) - luma(can)) >= 0.03
    fshadow = fighterd & ~fighter & ~hud & ~vfxd
    # per-fighter body masks (by character root), HUD excluded
    fmap = lut_map(ids_top, {k: i + 1 for i, k in enumerate(sorted(set(fighter_of_id)))}, 0)
    names = {}
    for k, nm in fighter_of_id.items():
        names.setdefault(nm, set()).add(k)
    bodies = {}
    # ⚠️ An antialiased edge between two id colours can decode to a VALID third id, so a
    # raw id match scatters stray 'fighter' px across the frame — the first run read
    # fighter heights of 24-30% of frame on a ~11% subject. Keep only the 1-px OPENING of
    # the match, inside a window around that fighter's own projected ground point
    # (meta.fighterRoots[i] <-> meta.slots[i]: both are slot order, spawnMatch adds the
    # models in slot order).
    roots = meta.get('fighterRoots') or []
    slots = meta.get('slots') or []
    yy, xx = np.mgrid[0:ids_top.shape[0], 0:ids_top.shape[1]]
    for nm, idset in names.items():
        mk = np.isin(ids_top, list(idset)) & ~hud
        mk = ~dilate(~mk, 1)            # erode 1
        mk = dilate(mk, 1) & np.isin(ids_top, list(idset)) & ~hud   # dilate back, inside the match
        if nm in roots and roots.index(nm) < len(slots) and slots[roots.index(nm)]:
            sx, sy = slots[roots.index(nm)]['x'], slots[roots.index(nm)]['y']
            win = (np.abs(xx - sx) <= 140) & (yy >= sy - 230) & (yy <= sy + 70)
            mk &= win
        if mk.sum() > 30:
            bodies[nm] = mk
    fighter_clean = np.zeros_like(hud)
    for mk in bodies.values():
        fighter_clean |= mk
    role[fighter_clean & ~hud] = 3
    ctrl = {'hudOpaqueShare': float(hud_opaque.mean()), 'hudTranslucentShare': float((hud & ~hud_opaque).mean()), 'strayFighterPx': int((fighter & ~fighter_clean).sum()), 'idValidTop': float((ids_top >= 0).mean()), 'idValidOpaque': float((ids_op >= 0).mean()),
            'idZeroOpaque': float((ids_op == 0).mean())}
    return {'page': page, 'canvas': can, 'role': role, 'shadow': shadow, 'fshadow': fshadow,
            'bodies': bodies, 'meta': meta, 'ctrl': ctrl, 'noshadow': nos}


def ellipse_mask(h, w, e):
    cx, cy, rx, ry = e
    yy, xx = np.mgrid[0:h, 0:w]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


def ref_roles(name):
    ann = json.load(open(os.path.join(REFDIR, 'ref_annot.json')))[name]
    page = rgbf(os.path.join(PLATES, name + '.png'))
    role = np.load(os.path.join(REFDIR, f'role_{name}.npy')).astype(np.int32)
    shadow = np.load(os.path.join(REFDIR, f'shadow_{name}.npy'))
    h, w = role.shape
    bodies = {}
    ringz = np.zeros((h, w), bool)
    for e in ann.get('rings', []):
        ringz |= ellipse_mask(h, w, e)
    for i, e in enumerate(ann.get('fighters', [])):
        mk = ellipse_mask(h, w, e) & (role == 3)
        if STRICT_REF:
            mk &= ~ringz
        if mk.sum() > 0:
            bodies[f'f{i}'] = mk
    return {'page': page, 'canvas': page, 'role': role, 'shadow': shadow, 'bodies': bodies, 'ann': ann}


def circ_mean_hue(hdeg, wts):
    if wts.sum() <= 0:
        return None
    th = np.radians(hdeg)
    x = (np.cos(th) * wts).sum(); y = (np.sin(th) * wts).sum()
    return float(np.degrees(np.arctan2(y, x)) % 360)


def hdiff(a, b):
    if a is None or b is None:
        return None
    d = abs(a - b) % 360
    return min(d, 360 - d)


def px_stats(rgb, mask):
    n = int(mask.sum())
    if n == 0:
        return None
    L = luma(rgb)[mask]
    Lk, A, B = oklab(rgb)
    C = np.hypot(A, B)[mask]
    hdeg, s, _ = hsl(rgb)
    hm = circ_mean_hue(hdeg[mask], C)
    return {'px': n, 'Lmean': float(L.mean()), 'Lp05': float(np.quantile(L, .05)), 'Lp50': float(np.median(L)),
            'Lp95': float(np.quantile(L, .95)), 'Lsd': float(L.std()), 'hi80': float((L > .8).mean()), 'lo30': float((L < .3).mean()),
            'C': float(C.mean()), 'Cp90': float(np.quantile(C, .9)), 'hue': hm}


def fighter_stats(rgb, role, body, H):
    # surround = ring 4..18 px outside the body, minus every fighter and hud pixel
    near = dilate(body, 18) & ~dilate(body, 4) & (role != 3) & (role != 6)
    inner = body & ~dilate(~body, 2)        # 2 px inside the edge
    outer = dilate(body, 3) & ~body & (role != 6) & (role != 3)
    ys, xs = np.where(body)
    bs = px_stats(rgb, body); ss = px_stats(rgb, near)
    if not bs or not ss:
        return None
    Lin = luma(rgb)[inner] if inner.any() else None
    rimDark = (bs['Lp50'] - float(np.quantile(Lin, .10))) if Lin is not None and Lin.size > 10 else None
    Li = luma(rgb)[inner].mean() if inner.any() else None
    Lo = luma(rgb)[outer].mean() if outer.any() else None
    return {'px': bs['px'], 'areaPct': 100 * bs['px'] / body.size, 'heightPct': 100 * (ys.max() - ys.min() + 1) / H,
            'dLmedian': bs['Lp50'] - ss['Lp50'], 'absdL': abs(bs['Lp50'] - ss['Lp50']), 'dC': bs['C'] - ss['C'],
            'dHue': hdiff(bs['hue'], ss['hue']), 'bodyLsd': bs['Lsd'], 'bodyLrange': bs['Lp95'] - bs['Lp05'],
            'edgeDL': (abs(Li - Lo) if Li is not None and Lo is not None else None), 'rimDark': rimDark,
            'bodyHue': bs['hue'], 'surroundHue': ss['hue'], 'bodyC': bs['C'], 'surroundC': ss['C'],
            'bodyL': bs['Lp50'], 'surroundL': ss['Lp50'], 'surroundRolesPct': {NAMES[c]: round(float((role[near] == c).mean()), 3) for c in (1, 2, 4, 5, 7) if (role[near] == c).any()}}


def frame_role_stats(R):
    role = R['role']; rgb = R['canvas']; page = R['page']
    H, W = role.shape
    out = {'share': {NAMES[c]: round(float((role == c).mean()), 4) for c in range(0, 9) if (role == c).any()}}
    for c in (1, 2, 3, 4, 5, 6, 7):
        st = px_stats(page if c == 6 else rgb, role == c)
        if st:
            out[NAMES[c]] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in st.items()}
    g = out.get('ground')
    if g:
        for c in ('effect', 'fighter', 'obstacle', 'hud', 'ring'):
            if c in out:
                out[c]['dLvsGround'] = round(out[c]['Lp50'] - g['Lp50'], 4)
                out[c]['dHueVsGround'] = hdiff(out[c]['hue'], g['hue'])
    # cast shadow share of GROUND+OBSTACLE, and its depth
    sh = R['shadow'] & ((role == 1) | (role == 2) | (role == 7))
    out['shadowShareOfWorld'] = round(float(sh.sum() / max(1, ((role == 1) | (role == 2) | (role == 7)).sum())), 4)
    if 'noshadow' in R:
        L0 = luma(R['noshadow'])[sh]; L1 = luma(rgb)[sh]
        if L0.size:
            out['shadowDepthRatio'] = round(float(np.median(L1 / np.maximum(L0, 1e-3))), 4)
            out['shadowDL'] = round(float(np.median(L0 - L1)), 4)
            out['shadowedL50'] = round(float(np.median(L1)), 4)
    # ground detail: edge density on ground-only pixels, at native size
    gm = grad_mag(luma(rgb))
    gmask = role == 1
    if gmask.any():
        out['groundGrad'] = round(float(gm[gmask].mean()), 5)
        out['groundEdge05'] = round(float((gm[gmask] > .05).mean()), 4)
    # per fighter
    fs = []
    for nm, body in R['bodies'].items():
        st = fighter_stats(rgb, role, body, H)
        if st:
            st['name'] = nm
            fs.append(st)
    out['fighters'] = fs
    return out


def summarize(rows, key, sub=None):
    vals = []
    for r in rows:
        v = r.get(key) if sub is None else (r.get(key) or {}).get(sub)
        if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
            vals.append(v)
    if not vals:
        return None
    return {'n': len(vals), 'min': round(min(vals), 4), 'med': round(float(np.median(vals)), 4), 'max': round(max(vals), 4)}


if __name__ == '__main__':
    pos = [a for a in sys.argv[1:] if not a.startswith('--')]
    capdir = pos[0] if len(pos) > 0 else os.path.join(ROOT, 'shots/rv/audit/gap/cap')
    outp = pos[1] if len(pos) > 1 else os.path.join(ROOT, 'shots/rv/audit/gap/roles.json')
    res = {'ours': {}, 'ref': {}}
    for js in sorted(glob.glob(os.path.join(capdir, '*_[0-9].json'))):
        base = js[:-5]
        tag = os.path.basename(base)
        R = ours_roles(base)
        st = frame_role_stats(R)
        st['ctrl'] = R['ctrl']
        st['fighterShadowShare'] = round(float(R['fshadow'].mean()), 4)
        res['ours'][tag] = st
        # role map overlay to LOOK at
        cols = {0: (0, 0, 0), 1: (40, 40, 40), 2: (60, 110, 255), 3: (255, 40, 200), 4: (40, 255, 120), 5: (255, 210, 0), 6: (255, 255, 255), 7: (0, 220, 220), 8: (120, 60, 160)}
        col = np.zeros(R['role'].shape + (3,), np.uint8)
        for c, v in cols.items():
            col[R['role'] == c] = v
        base8 = (R['page'] * 255).astype(np.uint8)
        mix = (0.45 * base8 + 0.55 * col).astype(np.uint8)
        mix[R['shadow'] & (R['role'] <= 2)] = (0.6 * mix[R['shadow'] & (R['role'] <= 2)] + 0.4 * np.array([0, 255, 255])).astype(np.uint8)
        Image.fromarray(np.concatenate([base8, mix], 1)).resize((1600, 450)).save(os.path.join(os.path.dirname(outp), f'ovr_{tag}.png'))
        print('ours', tag, st['share'], 'ctrl', {k: round(v, 4) for k, v in R['ctrl'].items()})
    for name in ['bs_01', 'bs_02', 'bs_03', 'bs_04', 'bs_05', 'bs_06']:
        R = ref_roles(name)
        st = frame_role_stats(R)
        res['ref'][name] = st
        print('ref ', name, st['share'])
    json.dump(res, open(outp, 'w'), indent=1, default=lambda o: None)
