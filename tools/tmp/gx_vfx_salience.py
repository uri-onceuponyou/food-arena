#!/usr/bin/env python3
"""
GX_VFX_SALIENCE — how loud is one VFX element against the rest of the frame?
(VFX audit, review phase; reads PNGs only, writes nothing but its own JSON.)

Input: same-camera canvas renders of one frozen instant from `gx_vfx_cap.mjs --diag`:
  <name>_full.png      nothing ablated (shake zeroed)
  <name>_noground.png  every `vfx_ground_mark` mesh hidden (Donut's trail + splats)
  <name>_novfx.png     the whole vfx_layer hidden

Per frame it reports, in OKLab (perceptual L and chroma C):
  * area share of the element (pixels that move by >= DELTA when it is ablated)
  * mean L / C of the element as drawn, and of the SAME pixels with it removed
    (i.e. what it is drawn over)
  * its share of the frame's TOP-k% most chromatic pixels, against its share of area
    (a salience ratio > 1 means it owns more of the loudest pixels than its size earns)
  * the same three numbers for ALL VFX (full vs novfx), so the element is read against
    the whole layer it belongs to

Known-bad / controls, run every time:
  * SELF-PAIR: full vs full must give area 0 (a differ that reports area on identical
    inputs is broken)
  * the element mask must be NON-EMPTY before any mean is taken over it ([] trap)

Usage: python3 tools/tmp/gx_vfx_salience.py <dir> <name> [<name> ...]
"""
import json
import sys
import numpy as np
from PIL import Image

DELTA = 16
TOPK = 0.02


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float64) / 255.0


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def oklab(img):
    lin = srgb_to_lin(img)
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, np.hypot(A, B)


def mask_between(a, b):
    return (np.abs(a - b).max(axis=-1) * 255.0) >= DELTA


def element_stats(full, other, name):
    m = mask_between(full, other)
    n = int(m.sum())
    total = m.size
    if n == 0:
        return {'element': name, 'areaShare': 0.0, 'empty': True}
    Lf, Cf = oklab(full)
    Lo, Co = oklab(other)
    thr = np.quantile(Cf, 1 - TOPK)
    top = Cf >= thr
    share_top = float((top & m).sum() / max(1, top.sum()))
    area = n / total
    return {
        'element': name,
        'areaShare': round(area, 4),
        'drawnL': round(float(Lf[m].mean()), 3), 'drawnC': round(float(Cf[m].mean()), 3),
        'underL': round(float(Lo[m].mean()), 3), 'underC': round(float(Co[m].mean()), 3),
        'frameMeanC': round(float(Cf.mean()), 3),
        'topChromaShare': round(share_top, 3),
        'salienceRatio': round(share_top / area, 2) if area > 0 else None,
    }


def selftest(d, name):
    """KNOWN-INPUT arm. Plant a fully saturated magenta square of known area into a
    real `_novfx` render and ablate it: the element's area must come back as the
    planted area, its topChromaShare must be ~min(1, area / TOPK) (it is the most
    chromatic thing in the frame by construction), and a planted square painted in the
    FLOOR'S OWN median colour must come back with area ~0 (DELTA floor) — the
    invisible-plant known-bad."""
    base = load(f'{d}/{name}_novfx.png')
    h, w, _ = base.shape
    side = int(round((0.01 * h * w) ** 0.5))  # 1% of the frame
    y0, x0 = h // 3, w // 3
    planted = base.copy()
    planted[y0:y0 + side, x0:x0 + side] = [1.0, 0.0, 1.0]
    s = element_stats(planted, base, 'planted magenta 1%')
    want_area = side * side / (h * w)
    ok_area = abs(s['areaShare'] - want_area) < 0.0005
    ok_top = s['topChromaShare'] > 0.45  # 1% of frame vs a 2% top band -> ~0.5
    camo = base.copy()
    med = np.median(base[y0:y0 + side, x0:x0 + side].reshape(-1, 3), axis=0)
    camo[y0:y0 + side, x0:x0 + side] = med
    c = element_stats(camo, base, 'planted floor-median 1%')
    ok_camo = c.get('areaShare', 0) < want_area * 0.6  # mostly below DELTA by construction
    print(json.dumps({'selftest': {'planted': s, 'wantArea': round(want_area, 4), 'okArea': ok_area,
                                   'okTop': ok_top, 'camo': c, 'okCamo': ok_camo}}))
    if not (ok_area and ok_top and ok_camo):
        raise SystemExit('SELFTEST FAILED')


def main():
    d = sys.argv[1]
    names = sys.argv[2:]
    if names and names[0] == '--selftest':
        selftest(d, names[1])
        return
    out = []
    for nm in names:
        full = load(f'{d}/{nm}_full.png')
        # SELF-PAIR control
        if mask_between(full, full).sum() != 0:
            raise SystemExit('SELF-PAIR control failed: differ reports area on identical input')
        row = {'frame': nm}
        try:
            row['trail'] = element_stats(full, load(f'{d}/{nm}_noground.png'), 'ground marks')
        except FileNotFoundError:
            row['trail'] = None
        try:
            row['allVfx'] = element_stats(full, load(f'{d}/{nm}_novfx.png'), 'all vfx')
        except FileNotFoundError:
            row['allVfx'] = None
        out.append(row)
        print(json.dumps(row))
    with open(f'{d}/salience.json', 'w') as f:
        json.dump(out, f, indent=1)


if __name__ == '__main__':
    main()
