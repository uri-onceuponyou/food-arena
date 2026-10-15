#!/usr/bin/env python3
"""
V1B_STAIN — is a persistent ground mark a STAIN on the floor, or a HOLE cut in it?
(Graphics campaign V1b, docs/REVAMP.md §8 w5: 5/8 cast critics read V1's MIN-blended Sticky
Trail as "a near-black purple smear that reads like a hole torn in the floor".)

Reads the same-instant canvas renders `gx_vfx_cap.mjs --diag` writes:
  <name>_full.png       nothing ablated (shake zeroed)
  <name>_noground.png   every `vfx_ground_mark` mesh hidden — i.e. the floor UNDER the stain

and asks four questions of the stain, all PAIRED (same pixels, with and without the mark):

  dL_sal    OKLab L drawn − under, over `gx_vfx_salience.py`'s own mask (max channel moved
            >= 16/255). This is V1's canonical number, kept so the two tools agree.
  dL_core   the same difference over the stain's CORE: the whole footprint (moved >= 3/255,
            so the soft edge is in it) eroded by `ERODE` px, floor-like pixels only.
  detail    how much of the floor's OWN detail survives inside the stain. In the core, both
            renders are high-passed against a MASKED local mean (core pixels only, so the
            brighter floor outside never leaks into the band), and the full render's band is
            regressed on the floor's: slope beta = sum(hp_full*hp_floor) / sum(hp_floor^2).
            A darkening blend (floor x k) keeps beta ~ k^(1/3) ~ 0.8; a REPLACEMENT (MIN, an
            opaque decal, a field of its own) carries none of the floor's detail: beta ~ 0.
            Two bands: `fine` (tile seams, r=FINE) and `cell` (per-tile value variation,
            FINE..COARSE).
  seams     the brief's literal form: tile-seam contrast INSIDE the stain against the floor's
            OUTSIDE it. Seams = pixels the floor's fine band puts below −1 sd. Contrast =
            mean L of non-seam minus mean L of seam pixels, in the full render, in the core
            and in a ring of floor just outside the footprint. ratio = in / out.
  chroma    the share of the frame's top-2% most chromatic pixels that the stain footprint
            owns (salience's `topChromaShare`, recomputed on the footprint), and the stain's
            mean chroma against the floor's under it.
  hole      p05 of OKLab L in the core — a "near-black" detector (V1: ~0.25).

ACCEPTANCE (V1b brief): dL_sal in [−0.12, −0.04]; detail.fine >= 0.5 AND seams ratio >= 0.5
(both are "the floor's tile lines stay visible through it"); detail.cell >= 0.5 (its value
variation too). Exit 1 if any station fails, 2 if a station has nothing to measure.

Known-bad / controls (`--selftest <dir> <name>`), planted on a REAL floor render so the
instrument is checked where it is pointed, not on a synthetic gradient:
  * SELF-PAIR — full == floor: the footprint must come back EMPTY (never a pass);
  * a MULTIPLY disc (floor x 0.55 in linear light, a darkening blend) must PASS detail + seams;
  * a MIN disc (min(floor, a dark violet) — V1's blend) must FAIL detail AND seams;
  * an OPAQUE disc carrying its own noise field (a decal with its own texture) must FAIL detail;
  * the core must be NON-EMPTY before any mean is taken over it.

Usage:
  python3 tools/tmp/v1b_stain.py <dir> <name> [<name> ...] [--json <out.json>]
  python3 tools/tmp/v1b_stain.py --selftest <dir> <name>
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter

SAL_DELTA = 16          # gx_vfx_salience.py's mask threshold, /255
FOOT_DELTA = 3          # the whole footprint, soft edge included, /255
ERODE = 9               # px: core = footprint eroded by this (MinFilter of 2*ERODE+1)
RING_IN, RING_OUT = 9, 31   # px: the floor ring just outside the footprint
FINE, COARSE = 4, 24    # px: masked local-mean radii (box, 3 passes)
TOPK = 0.02
FL_L, FL_C, FL_H = 0.10, 0.035, 12.0   # floor-likeness bands (OKLab L, chroma, hue deg) vs the ring's median


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float64) / 255.0


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def oklab(img):
    lin = srgb_to_lin(img)
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, A, B


def morph(mask, r, grow):
    """Binary dilate (grow) / erode by a (2r+1) square, via PIL's rank filters."""
    if r <= 0:
        return mask.copy()
    im = Image.fromarray((mask * 255).astype(np.uint8))
    size = 2 * r + 1
    out = im
    # PIL caps rank-filter sizes in practice by speed; split into passes of <= 9.
    left = size
    while left > 1:
        step = min(left, 9)
        if step % 2 == 0:
            step -= 1
        out = out.filter(ImageFilter.MaxFilter(step) if grow else ImageFilter.MinFilter(step))
        left -= step - 1
    return np.asarray(out) > 127


def box(a, r):
    """Box blur of radius r along both axes (cumulative sums, edge-clamped by renormalising)."""
    if r <= 0:
        return a.copy()
    out = a
    for axis in (0, 1):
        n = out.shape[axis]
        c = np.cumsum(out, axis=axis)
        zero_shape = list(out.shape)
        zero_shape[axis] = 1
        c = np.concatenate([np.zeros(zero_shape), c], axis=axis)
        idx = np.arange(n)
        lo = np.clip(idx - r, 0, n)
        hi = np.clip(idx + r + 1, 0, n)
        out = np.take(c, hi, axis=axis) - np.take(c, lo, axis=axis)
    return out


def masked_mean(a, m, r):
    """Local mean of `a` over pixels where `m` is set, radius r, 3 box passes (~Gaussian)."""
    num = a * m
    den = m.astype(np.float64)
    for _ in range(3):
        num = box(num, r)
        den = box(den, r)
    return num / np.maximum(den, 1e-9)


def slope(y, x):
    d = float((x * x).sum())
    return float((x * y).sum() / d) if d > 0 else None


def corr(y, x):
    sx, sy = x.std(), y.std()
    if sx == 0 or sy == 0:
        return None
    return float(((x - x.mean()) * (y - y.mean())).mean() / (sx * sy))


def measure(full, floor, label='station'):
    if np.abs(full - full).max() != 0:
        raise SystemExit('SELF-PAIR control failed: differ reports a change on identical input')
    moved = np.abs(full - floor).max(axis=-1) * 255.0
    foot = moved >= FOOT_DELTA
    sal = moved >= SAL_DELTA
    if foot.sum() == 0:
        return {'station': label, 'empty': True}
    Lf, Af, Bf = oklab(full)
    Ln, An, Bn = oklab(floor)
    Cf = np.hypot(Af, Bf)
    Cn = np.hypot(An, Bn)

    ring = morph(foot, RING_OUT, True) & ~morph(foot, RING_IN, True)
    if ring.sum() == 0:
        return {'station': label, 'empty': True, 'why': 'no floor ring around the footprint'}
    # FLOOR-LIKE: what the ring's floor looks like, so props, characters, and anything drawn ON
    # TOP of the stain in BOTH renders (a seat ring, a fighter's contact decal, an effect) is
    # not averaged in as "floor". An overlay carries the same sharp edges in both renders, so it
    # correlates perfectly and would be credited as "floor detail surviving": found on the base,
    # where Taco's red seat ring alone carried the fine slope to 0.67 at station 08. Bands, on
    # the FLOOR render, against the ring's median: L within FL_L (seams sit ~0.05 below a cell,
    # prop shadows ~0.08), chroma within FL_C, hue within FL_H degrees (the enemy seat ring is
    # ~30 deg off the pink floor, the local one ~150).
    ringf = ring
    Cm = float(np.median(Cn[ringf]))
    Lm = float(np.median(Ln[ringf]))
    hm = float(np.degrees(np.arctan2(np.median(Bn[ringf]), np.median(An[ringf]))))
    hue = np.degrees(np.arctan2(Bn, An))
    dh = np.abs((hue - hm + 180.0) % 360.0 - 180.0)
    floorlike = (np.abs(Ln - Lm) < FL_L) & (np.abs(Cn - Cm) < FL_C) & (dh < FL_H)
    core = morph(foot, ERODE, False) & floorlike
    ring = ring & floorlike
    out = {'station': label, 'footShare': round(float(foot.mean()), 4),
           'corePx': int(core.sum()), 'ringPx': int(ring.sum())}
    if core.sum() < 200 or ring.sum() < 200:
        out['empty'] = True
        out['why'] = 'core or ring under 200 px'
        return out

    # dL — salience's mask (V1's canonical number) and the core (paired, exact pixels).
    if sal.sum() > 0:
        out['dL_sal'] = round(float(Lf[sal].mean() - Ln[sal].mean()), 3)
        out['salL'] = [round(float(Lf[sal].mean()), 3), round(float(Ln[sal].mean()), 3)]
    else:
        out['dL_sal'] = None
    out['dL_core'] = round(float(Lf[core].mean() - Ln[core].mean()), 3)
    out['coreL'] = [round(float(Lf[core].mean()), 3), round(float(Ln[core].mean()), 3)]
    out['hole_p05'] = round(float(np.percentile(Lf[core], 5)), 3)

    # detail transfer — masked high-pass in the core, both renders.
    cm = core.astype(np.float64)
    mf_f, mf_n = masked_mean(Lf, cm, FINE), masked_mean(Ln, cm, FINE)
    mc_f, mc_n = masked_mean(Lf, cm, COARSE), masked_mean(Ln, cm, COARSE)
    hp_f, hp_n = (Lf - mf_f)[core], (Ln - mf_n)[core]
    bp_f, bp_n = (mf_f - mc_f)[core], (mf_n - mc_n)[core]
    out['detail'] = {
        'fine': None if slope(hp_f, hp_n) is None else round(slope(hp_f, hp_n), 3),
        'fineCorr': None if corr(hp_f, hp_n) is None else round(corr(hp_f, hp_n), 3),
        'cell': None if slope(bp_f, bp_n) is None else round(slope(bp_f, bp_n), 3),
        'cellCorr': None if corr(bp_f, bp_n) is None else round(corr(bp_f, bp_n), 3),
        'floorFineSd': round(float(hp_n.std()), 4), 'floorCellSd': round(float(bp_n.std()), 4),
    }

    # seams — the brief's literal form, inside vs outside, both read off the FULL render.
    both = (core | ring).astype(np.float64)
    hp_floor_all = Ln - masked_mean(Ln, both, FINE)
    sd = float(hp_floor_all[core | ring].std())
    seam = hp_floor_all < -sd
    def contrast(region):
        s, ns = region & seam, region & ~seam
        if s.sum() < 20 or ns.sum() < 20:
            return None
        return float(Lf[ns].mean() - Lf[s].mean())
    cin, cout = contrast(core), contrast(ring)
    out['seams'] = {'in': None if cin is None else round(cin, 4), 'out': None if cout is None else round(cout, 4),
                    'ratio': None if (cin is None or not cout) else round(cin / cout, 3),
                    'seamPxIn': int((core & seam).sum()), 'seamPxOut': int((ring & seam).sum())}

    # chroma — the footprint's share of the frame's loudest chroma, and its own vs the floor.
    thr = np.quantile(Cf, 1 - TOPK)
    top = Cf >= thr
    out['top2Share_foot'] = round(float((top & foot).sum() / max(1, top.sum())), 3)
    out['top2Share_sal'] = round(float((top & sal).sum() / max(1, top.sum())), 3)
    out['C_core'] = [round(float(Cf[core].mean()), 3), round(float(Cn[core].mean()), 3)]

    d = out['detail']
    s = out['seams']
    fails = []
    if out['dL_sal'] is None or not (-0.12 <= out['dL_sal'] <= -0.04):
        fails.append(f"dL_sal {out['dL_sal']} outside [-0.12,-0.04]")
    if d['fine'] is None or d['fine'] < 0.5:
        fails.append(f"detail.fine {d['fine']} < 0.5")
    if d['cell'] is None or d['cell'] < 0.5:
        fails.append(f"detail.cell {d['cell']} < 0.5")
    if s['ratio'] is None or s['ratio'] < 0.5:
        fails.append(f"seams.ratio {s['ratio']} < 0.5")
    out['pass'] = not fails
    out['fails'] = fails
    return out


def selftest(d, name):
    floor = load(f'{d}/{name}_noground.png')
    h, w, _ = floor.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx, rad = h * 0.45, w * 0.5, min(h, w) * 0.16
    disc = ((yy - cy) ** 2 + (xx - cx) ** 2) < rad ** 2
    lin = srgb_to_lin(floor)
    res = {}
    # SELF-PAIR: must be EMPTY, never a pass
    r0 = measure(floor, floor, 'self-pair')
    res['selfPair'] = r0
    ok_self = r0.get('empty') is True
    # MULTIPLY (a darkening blend): floor x 0.55 in linear light inside the disc
    mul = lin.copy()
    mul[disc] = mul[disc] * np.array([0.55, 0.50, 0.62])
    r1 = measure(lin_to_srgb(mul), floor, 'multiply')
    res['multiply'] = {k: r1.get(k) for k in ('dL_sal', 'dL_core', 'detail', 'seams', 'pass', 'fails')}
    ok_mul = bool(r1.get('detail') and r1['detail']['fine'] >= 0.5 and r1['detail']['cell'] >= 0.5
                  and r1['seams']['ratio'] is not None and r1['seams']['ratio'] >= 0.5)
    # MIN (V1's blend): min(floor, a dark violet), per channel
    mn = lin.copy()
    dark = np.array([0.075, 0.006, 0.15])
    mn[disc] = np.minimum(mn[disc], dark)
    r2 = measure(lin_to_srgb(mn), floor, 'min')
    res['min'] = {k: r2.get(k) for k in ('dL_sal', 'dL_core', 'detail', 'seams', 'pass', 'fails')}
    ok_min = bool(r2.get('detail') and r2['detail']['fine'] < 0.5 and r2['seams']['ratio'] is not None
                  and r2['seams']['ratio'] < 0.5 and not r2['pass'])
    # OPAQUE decal with its own noise field: must not count as the floor's detail
    rng = np.random.default_rng(7)
    noise = box(rng.standard_normal((h, w)), 3)
    noise = noise / noise.std() * 0.03
    op = lin.copy()
    base = np.array([0.20, 0.035, 0.10])
    op[disc] = np.clip(base[None, :] * (1 + noise[disc][:, None] * 6), 0, 1)
    r3 = measure(lin_to_srgb(op), floor, 'opaque+noise')
    res['opaqueNoise'] = {k: r3.get(k) for k in ('dL_sal', 'dL_core', 'detail', 'seams', 'pass', 'fails')}
    ok_op = bool(r3.get('detail') and r3['detail']['fine'] < 0.5 and not r3['pass'])
    res['ok'] = {'selfPairEmpty': ok_self, 'multiplyPasses': ok_mul, 'minFails': ok_min, 'opaqueFails': ok_op}
    print(json.dumps(res, indent=1))
    if not (ok_self and ok_mul and ok_min and ok_op):
        raise SystemExit('SELFTEST FAILED')
    print('SELFTEST OK')


def main():
    argv = sys.argv[1:]
    if argv and argv[0] == '--selftest':
        selftest(argv[1], argv[2])
        return
    jpath = None
    if '--json' in argv:
        i = argv.index('--json')
        jpath = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    d, names = argv[0], argv[1:]
    if not names:
        raise SystemExit('usage: v1b_stain.py <dir> <name> [...] [--json out]')
    rows = []
    for nm in names:
        r = measure(load(f'{d}/{nm}_full.png'), load(f'{d}/{nm}_noground.png'), nm)
        rows.append(r)
        print(json.dumps(r))
    if jpath:
        with open(jpath, 'w') as f:
            json.dump(rows, f, indent=1)
    if any(r.get('empty') for r in rows):
        print('NOTHING TO MEASURE at:', [r['station'] for r in rows if r.get('empty')])
        sys.exit(2)
    bad = [r['station'] for r in rows if not r['pass']]
    print(f"{len(rows) - len(bad)}/{len(rows)} stations pass", ('FAIL: ' + ', '.join(bad)) if bad else 'PASS')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
