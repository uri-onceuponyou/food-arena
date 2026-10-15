"""
R1_METRICS — work package R1's acceptance numbers, per scene x look variant, from r1_probe.

Every number is computed on ONE set of role masks per scene (the reference variant's exact
ID / normal passes, via gx_gap_roles.ours_roles) and the variant's own canvas + no-shadow
render, so two variants of one frame differ ONLY in what the look changed:

  frontTop     same-MESH front/top luma ratio on structure (albedo cancels), median over
               meshes with >= 150 px of each face — gx_gap_form.per_mesh's rule, verbatim
  shadowRatio  median over shadowed GROUND px of L(canvas) / L(no-shadow render)
  shadowDHue   chroma-weighted circular-mean HSL hue of those px, shadowed minus lit (deg)
  groundTop20  of the 20 most salient world cells (gx_gap_salience, 32x18), how many are
               ground-dominated
  contour      per fighter: share of near-black (luma < 0.15) px in the body dilated by
               3 px @900 (`share`), and in the 3-px ring outside the body alone (`ring`)

Known-bad selftest (`--selftest`) BEFORE any frame is read: a synthetic body with and
without a 3-px black ring, and a synthetic shadow that keeps vs rotates the hue.

Usage:  python3 tools/tmp/r1_metrics.py <probe dir> [--json out.json]
"""
import sys, os, json, glob, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
np.seterr(all='ignore')


def rgbf(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float64) / 255.0


def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def hsl_hue_sat(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    nz = d > 1e-9
    rm = nz & (mx == r); gm = nz & (mx == g) & ~rm; bm = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = ((b - r)[gm] / d[gm]) + 2
    h[bm] = ((r - g)[bm] / d[bm]) + 4
    return h * 60.0, d


def circ_hue(hdeg, w):
    if w.sum() <= 0:
        return None
    t = np.radians(hdeg)
    return float(np.degrees(math.atan2((np.sin(t) * w).sum(), (np.cos(t) * w).sum())) % 360)


def hdiff_signed(a, b):
    if a is None or b is None:
        return None
    return ((a - b + 180.0) % 360.0) - 180.0


def dilate(mask, r):
    if r <= 0:
        return mask.copy()
    a = mask.astype(np.float64)
    pad = np.pad(a, r)
    c = pad.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    h, w = mask.shape
    k = 2 * r + 1
    s = c[k:k + h, k:k + w] - c[0:h, k:k + w] - c[k:k + h, 0:w] + c[0:h, 0:w]
    return s > 0


def pixel_dhue(a, b, mask):
    """Chroma-weighted circular mean of the PER-PIXEL hue difference a - b over mask. Per
    pixel, so a frame whose shadow falls on two different ground materials cannot report a
    hue 'shift' that is only a change in the MIX of materials."""
    ha, ca = hsl_hue_sat(a); hb, cb = hsl_hue_sat(b)
    w = np.minimum(ca, cb)[mask]
    if w.sum() <= 0:
        return None
    d = np.radians(((ha - hb + 180.0) % 360.0 - 180.0)[mask])
    return float(np.degrees(math.atan2((np.sin(d) * w).sum(), (np.cos(d) * w).sum())))


def shadow_stats(can, nos, ground):
    Lc = luma(can); Ln = luma(nos)
    sh = ground & ((Ln - Lc) >= 0.03)
    if sh.sum() < 200:
        return {'px': int(sh.sum())}
    hue_c, ch_c = hsl_hue_sat(can); hue_n, ch_n = hsl_hue_sat(nos)
    hc = circ_hue(hue_c[sh], ch_c[sh]); hn = circ_hue(hue_n[sh], ch_n[sh])
    dh = pixel_dhue(can, nos, sh)
    return {'px': int(sh.sum()), 'ratio': round(float(np.median(Lc[sh] / np.maximum(Ln[sh], 1e-3))), 4),
            'hueLit': round(hn, 1) if hn is not None else None, 'hueShadow': round(hc, 1) if hc is not None else None,
            'dHue': round(dh, 1) if dh is not None else None,
            'litL50': round(float(np.median(Ln[sh])), 4), 'shadowL50': round(float(np.median(Lc[sh])), 4)}


def contour_stats(can, bodies, fighter_any, H):
    r = max(1, round(3 * H / 900))
    L = luma(can)
    rows = []
    for nm, body in bodies.items():
        band = dilate(body, r)
        ring = band & ~body & ~fighter_any
        if band.sum() < 50 or ring.sum() < 20:
            continue
        dark = L < 0.15
        black = L < 0.06      # NEAR-black: the reference contour sits at luma 0.01-0.02
        rows.append({'name': nm, 'share': round(float((dark & band).sum() / band.sum()), 4),
                     'ring': round(float((dark & ring).sum() / ring.sum()), 4),
                     'share06': round(float((black & band).sum() / band.sum()), 4),
                     'ring06': round(float((black & ring).sum() / ring.sum()), 4), 'bodyPx': int(body.sum())})
    return rows


def salience_ground(can, role):
    import gx_gap_salience as S
    cells = S.sal(can, role)
    world = [c for c in cells if c[1][6] < 0.5]
    world.sort(key=lambda c: -c[0])
    top = world[:20]
    dom = [max(range(9), key=lambda k: c[1][k]) for c in top]
    fr = [k for k, c in enumerate(world) if c[1][3] + c[1][4] >= 0.25]
    return {'groundTop20': int(sum(1 for d in dom if d == 1)), 'fighterBestRank': (fr[0] + 1) if fr else None}


def front_top(can, nos, R, w, meta, base):
    import gx_gap_roles as G
    L = luma(can)
    sh = (luma(nos) - L) >= 0.03
    ids = G.decode_ids(base + '.idopaque.png')
    names = {m['id']: m['name'] for m in meta['meshes'] if m.get('id')}
    role = R['role']
    top = (w[..., 1] > 0.85); front = (np.abs(w[..., 1]) < 0.35) & (w[..., 2] > 0.6)
    rows = []
    for i in np.unique(ids[(role == 2) & (ids > 0)]):
        m = (ids == i) & (role == 2) & ~sh
        t = m & top; f = m & front
        if t.sum() >= 150 and f.sum() >= 150:
            rows.append((names.get(int(i), '?'), float(np.median(L[f]) / np.median(L[t])), int(t.sum()), int(f.sum())))
    r = [x[1] for x in rows]
    return {'meshes': len(rows), 'med': round(float(np.median(r)), 3) if r else None,
            'min': round(min(r), 3) if r else None, 'max': round(max(r), 3) if r else None,
            'rows': [(n[:32], round(v, 3), t, f) for n, v, t, f in sorted(rows, key=lambda x: -x[2] - x[3])[:6]]}


def analyse(d):
    import gx_gap_roles as G
    from gx_gap_form import world_normals
    out = {}
    for js in sorted(glob.glob(os.path.join(d, '*.json'))):
        if js.endswith('summary.json'):
            continue
        base = js[:-5]
        meta = json.load(open(js))
        if not os.path.exists(base + '.id.png'):
            continue
        R = G.ours_roles(base)
        w = world_normals(base, meta)
        role = R['role']; H = role.shape[0]
        ground = role == 1
        fighter_any = role == 3
        ctl = {'groundUp': round(float(np.median(w[ground][:, 1])), 4) if ground.any() else None,
               'bodies': len(R['bodies']), 'groundShare': round(float(ground.mean()), 4),
               'obstacleShare': round(float((role == 2).mean()), 4), **{k: v for k, v in R['ctrl'].items() if k in ('strayFighterPx', 'idValidTop')}}
        rows = {}
        leg_nos = rgbf(f'{base}.legacy.noshadow.png') if os.path.exists(f'{base}.legacy.noshadow.png') else None
        leg_can = rgbf(f'{base}.legacy.png') if os.path.exists(f'{base}.legacy.png') else None
        for v in meta.get('variants', {}):
            can = rgbf(f'{base}.{v}.png'); nos = rgbf(f'{base}.{v}.noshadow.png')
            rows[v] = {'frontTop': front_top(can, nos, R, w, meta, base),
                       'shadow': shadow_stats(can, nos, ground),
                       'salience': salience_ground(can, role),
                       'contour': contour_stats(can, R['bodies'], fighter_any, H),
                       'draws': meta['variants'][v].get('drawsShadow'), 'drawsCached': meta['variants'][v].get('drawsCached')}
            if leg_nos is not None:
                # What the look did to the LIT ground (no shadow on either side) and to the whole
                # ground as delivered: hue rotation and value, against the legacy (= base) frame.
                litm = ground & (luma(leg_nos) > 0.05)
                rows[v]['groundVsLegacy'] = {
                    'litDHue': round(pixel_dhue(nos, leg_nos, litm) or 0.0, 2),
                    'litLratio': round(float(np.median(luma(nos)[litm] / np.maximum(luma(leg_nos)[litm], 1e-3))), 4),
                    'delivDHue': round(pixel_dhue(can, leg_can, litm) or 0.0, 2),
                    'delivL50': round(float(np.median(luma(can)[ground])), 4), 'legacyL50': round(float(np.median(luma(leg_can)[ground])), 4)}
        out[os.path.basename(base)] = {'controls': meta.get('controls'), 'hulls': meta.get('hulls'), 'roles': meta.get('roles'), 'maskCtl': ctl, 'variants': rows}
    return out


def selftest():
    ok = True
    def chk(name, cond, val):
        nonlocal ok
        print(('PASS ' if cond else 'FAIL ') + name, val)
        ok = ok and cond
    H = W = 300
    yy, xx = np.mgrid[0:H, 0:W]
    body = ((xx - 150) ** 2 + (yy - 150) ** 2) <= 60 ** 2
    img = np.full((H, W, 3), 0.55)
    img[body] = [0.9, 0.6, 0.5]
    none = contour_stats(img, {'b': body}, body, 900)
    inked = img.copy()
    ring = dilate(body, 3) & ~body
    inked[ring] = [0.02, 0.01, 0.03]
    thin = img.copy(); thin[dilate(body, 1) & ~body] = [0.10, 0.08, 0.15]
    a = contour_stats(inked, {'b': body}, body, 900)[0]
    b = none[0]; c = contour_stats(thin, {'b': body}, body, 900)[0]
    chk('ring of near-black reads as contour', a['ring'] > 0.95, a)
    chk('no ring reads as no contour', b['ring'] < 0.01 and b['share'] < 0.01, b)
    chk('a 1-px ring reads as a third of the 3-px ring', 0.2 < c['ring'] < 0.5, c)
    lit = np.zeros((H, W, 3)); lit[...] = [0.80, 0.45, 0.60]
    ground = np.ones((H, W), bool)
    keep = lit * 0.7
    rot = lit * 0.7; rot[..., 2] *= 1.25; rot[..., 0] *= 0.85
    s1 = shadow_stats(keep, lit, ground); s2 = shadow_stats(rot, lit, ground)
    chk('hue-keeping shadow: ratio 0.7, dHue 0', abs(s1['ratio'] - 0.7) < 0.01 and abs(s1['dHue']) < 0.5, s1)
    chk('blue-shifted shadow: negative dHue (toward violet)', s2['dHue'] < -5, s2)
    chk('dilate is exact on a single pixel', dilate(np.pad(np.ones((1, 1), bool), 5), 2).sum() == 25, int(dilate(np.pad(np.ones((1, 1), bool), 5), 2).sum()))
    return ok


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    if not selftest():
        print('selftest FAILED — refusing to read frames'); sys.exit(1)
    d = sys.argv[1]
    res = analyse(d)
    for scene, r in res.items():
        print(f'== {scene}  controls {r["controls"]}  hulls {r["hulls"]}  roles {r["roles"]}  maskCtl {r["maskCtl"]}')
        for v, m in r['variants'].items():
            ft = m['frontTop']; sh = m['shadow']; sa = m['salience']
            cs = m['contour']
            cshare = np.median([x['share'] for x in cs]) if cs else None
            cring = np.median([x['ring'] for x in cs]) if cs else None
            c06 = np.median([x['share06'] for x in cs]) if cs else None
            r06 = np.median([x['ring06'] for x in cs]) if cs else None
            gv = m.get('groundVsLegacy') or {}
            print(f'  {v:34s} frontTop {ft["med"]} n={ft["meshes"]} | shadow ratio {sh.get("ratio")} dHue {sh.get("dHue")} | groundTop20 {sa["groundTop20"]} fRank {sa["fighterBestRank"]} | contour share {None if cshare is None else round(float(cshare),3)} ring {None if cring is None else round(float(cring),3)} black {None if c06 is None else round(float(c06),3)}/{None if r06 is None else round(float(r06),3)} | litGround dHue {gv.get("litDHue")} Lx{gv.get("litLratio")} delivL50 {gv.get("delivL50")} (leg {gv.get("legacyL50")}) | draws {(m["draws"] or {}).get("calls")}')
    if '--json' in sys.argv:
        json.dump(res, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1, default=str)
