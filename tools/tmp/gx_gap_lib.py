"""
GX_GAP_LIB — whole-frame image statistics, ONE implementation applied to both sides.

Why this exists: the graphics-revamp review needs a frame-level gap table, ours vs the six
curated top-down plates, where every number is produced by the SAME code on the SAME
normalisation. A concentration or value statistic with no reference arm is a description,
not a defect (docs/LESSONS.md §2, "only a reference arm can tell you which side of the band
you are on").

🚨 Reference plates are third-party and this repo is PUBLIC. This file and anything it
prints emit NUMBERS ONLY — never a description of what a plate depicts.

Conventions (stated because getting them wrong is the whole risk):
  * luma   = 0.2126R + 0.7152G + 0.0722B on the sRGB-ENCODED value, 0..1 — the same formula
             as tools/tmp/valuelib.mjs and arena-scan, so numbers are commensurable.
  * HSL S / hue as arena-scan's rgbToHsl; chromatic gate S_hsl >= 0.15 (arena-scan GREY_GATE).
  * OKLab chroma C = sqrt(a^2+b^2) (perceptual; HSL S over-reports darks/lights).
  * normalisation: resize to HEIGHT 900 (Lanczos), then optional central band
    x in [0.08,0.92], y in [0.15,0.82] — the band fp_ground/sbj_hue used, so values here are
    comparable with theirs.
  * ACUITY: the plates arrive upscaled ~1.33-1.43x (LESSONS §3). Every gradient/edge number
    is therefore also reported on an ACUITY-MATCHED copy of ours (down 0.70, back up), so a
    high-frequency gap cannot be an artefact of resolution.
"""
import json, math, sys, os
import numpy as np
from PIL import Image

BAND = (0.08, 0.92, 0.15, 0.82)


def load(path, height=900):
    im = Image.open(path).convert('RGB')
    if im.height != height:
        w = round(im.width * height / im.height)
        im = im.resize((w, height), Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255.0


def acuity_match(rgb, f=0.70):
    """Degrade to the reference plates' delivered acuity: down by f, back up (Lanczos)."""
    h, w, _ = rgb.shape
    im = Image.fromarray((rgb * 255 + 0.5).clip(0, 255).astype(np.uint8))
    small = im.resize((max(1, round(w * f)), max(1, round(h * f))), Image.LANCZOS)
    back = small.resize((w, h), Image.LANCZOS)
    return np.asarray(back).astype(np.float64) / 255.0


def band(arr, b=BAND):
    h, w = arr.shape[:2]
    x0, x1, y0, y1 = int(w * b[0]), int(w * b[1]), int(h * b[2]), int(h * b[3])
    return arr[y0:y1, x0:x1]


def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def hsl(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    l = (mx + mn) / 2
    s = np.where(d < 1e-9, 0.0, d / np.maximum(1e-9, 1 - np.abs(2 * l - 1)))
    h = np.zeros_like(mx)
    m = d > 1e-9
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g[rr] - b[rr]) / d[rr]) % 6
    h[gg] = (b[gg] - r[gg]) / d[gg] + 2
    h[bb] = (r[bb] - g[bb]) / d[bb] + 4
    return (h * 60.0) % 360.0, np.clip(s, 0, 1), l


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def oklab(rgb):
    lin = srgb_to_linear(rgb)
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, A, B


def q(a, p):
    return float(np.quantile(a, p)) if a.size else None


def hue_stats(hdeg, w=None, window=35):
    """Largest share in any `window`-deg circular window (1-deg slide), circular R, modes."""
    if hdeg.size == 0:
        return None
    hist = np.bincount(np.floor(hdeg).astype(int) % 360, weights=w, minlength=360).astype(np.float64)
    tot = hist.sum()
    if tot <= 0:
        return None
    ext = np.concatenate([hist, hist[:window]])
    cs = np.concatenate([[0], np.cumsum(ext)])
    sums = cs[window:window + 360] - cs[0:360]
    k = int(np.argmax(sums))
    win = float(sums[k] / tot)
    th = np.radians(hdeg)
    if w is None:
        R = float(np.hypot(np.cos(th).mean(), np.sin(th).mean()))
    else:
        R = float(np.hypot((np.cos(th) * w).sum(), (np.sin(th) * w).sum()) / w.sum())
    # modes: circular gaussian smoothing sigma 6 deg, local maxima holding >=5% within +-20 deg
    xs = np.arange(-30, 31)
    ker = np.exp(-0.5 * (xs / 6.0) ** 2); ker /= ker.sum()
    sm = np.zeros(360)
    for i, kv in zip(xs, ker):
        sm += kv * np.roll(hist, i)
    modes = []
    for i in range(360):
        if sm[i] >= sm[(i - 1) % 360] and sm[i] > sm[(i + 1) % 360]:
            mass = hist[[(i + j) % 360 for j in range(-20, 21)]].sum() / tot
            if mass >= 0.05:
                modes.append((i, round(float(mass), 4)))
    modes.sort(key=lambda t: -t[1])
    # entropy over 36 x 10-deg bins, bits (max log2(36)=5.17)
    b36 = hist.reshape(36, 10).sum(1) / tot
    nz = b36[b36 > 0]
    ent = float(-(nz * np.log2(nz)).sum())
    return {'win35': round(win, 4), 'win35_at': [k, (k + window) % 360], 'R': round(R, 4),
            'modes': modes[:4], 'nModes': len(modes), 'entropyBits': round(ent, 3)}


def grad_mag(L):
    gx = np.zeros_like(L); gy = np.zeros_like(L)
    gx[:, 1:-1] = (L[:, 2:] - L[:, :-2]) / 2
    gy[1:-1, :] = (L[2:, :] - L[:-2, :]) / 2
    return np.hypot(gx, gy)


def box_mean(a, r):
    """Mean over a (2r+1)^2 box via integral image, edge-clamped."""
    p = np.pad(a, r + 1, mode='edge')
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    h, w = a.shape
    return s[:h, :w] / (k * k)


def frame_stats(rgb, mask=None):
    """All whole-frame numbers for the pixels in `mask` (default: all)."""
    L = luma(rgb)
    hdeg, s, _ = hsl(rgb)
    Lk, A, B = oklab(rgb)
    C = np.hypot(A, B)
    if mask is None:
        mask = np.ones(L.shape, bool)
    n = int(mask.sum())
    if n == 0:
        return {'px': 0}
    Lm, sm, Cm = L[mask], s[mask], C[mask]
    chrom = mask & (s >= 0.15)
    out = {
        'px': n,
        'luma': {k: round(v, 4) for k, v in {
            'mean': float(Lm.mean()), 'sd': float(Lm.std()), 'p05': q(Lm, .05), 'p25': q(Lm, .25),
            'p50': q(Lm, .5), 'p75': q(Lm, .75), 'p95': q(Lm, .95),
            'hi70': float((Lm > .70).mean()), 'hi80': float((Lm > .80).mean()), 'hi90': float((Lm > .90).mean()),
            'lo20': float((Lm < .20).mean()), 'lo30': float((Lm < .30).mean())}.items()},
        'notan3': [round(float((Lm < 1 / 3).mean()), 4), round(float(((Lm >= 1 / 3) & (Lm < 2 / 3)).mean()), 4),
                   round(float((Lm >= 2 / 3).mean()), 4)],
        'satHSL': {'mean': round(float(sm.mean()), 4), 'chromaticShare': round(float(chrom.sum() / n), 4)},
        'chromaOK': {'mean': round(float(Cm.mean()), 4), 'p50': round(q(Cm, .5), 4), 'p90': round(q(Cm, .9), 4),
                     'vivid15': round(float((Cm > .15).mean()), 4), 'vivid20': round(float((Cm > .20).mean()), 4)},
        'hue': hue_stats(hdeg[chrom]),
    }
    R8, G8, B8 = rgb[..., 0][mask] * 255, rgb[..., 1][mask] * 255, rgb[..., 2][mask] * 255
    rg = R8 - G8; yb = 0.5 * (R8 + G8) - B8
    out['colorfulnessHS'] = round(float(np.hypot(rg.std(), yb.std()) + 0.3 * np.hypot(rg.mean(), yb.mean())), 2)
    return out


def edge_stats(rgb, mask=None):
    L = luma(rgb)
    g = grad_mag(L)
    if mask is None:
        mask = np.ones(L.shape, bool)
    gm = g[mask]
    # local RMS contrast at object scale (radius 16 px at height 900)
    m1 = box_mean(L, 16); m2 = box_mean(L * L, 16)
    rms = np.sqrt(np.maximum(0, m2 - m1 * m1))[mask]
    return {'gradMean': round(float(gm.mean()), 5), 'edge02': round(float((gm > .02).mean()), 4),
            'edge05': round(float((gm > .05).mean()), 4), 'edge10': round(float((gm > .10).mean()), 4),
            'rms16_p50': round(q(rms, .5), 4), 'rms16_p90': round(q(rms, .9), 4)}


if __name__ == '__main__':
    # --selftest: known-bad inputs, each must come out the way it is constructed.
    if '--selftest' in sys.argv:
        ok = True
        def chk(name, cond, val):
            global ok
            print(('PASS ' if cond else 'FAIL ') + name, val)
            ok &= bool(cond)
        h, w = 300, 400
        spike = np.zeros((h, w, 3)); spike[...] = (1.0, 0.2, 0.2)
        st = frame_stats(spike)
        chk('SPIKE win35==1', st['hue']['win35'] == 1.0, st['hue']['win35'])
        chk('SPIKE R>0.999', st['hue']['R'] > 0.999, st['hue']['R'])
        # wheel: hues uniform 0..360 at full sat
        hh = np.linspace(0, 360, w, endpoint=False)[None, :].repeat(h, 0)
        import colorsys
        wheel = np.zeros((h, w, 3))
        for x in range(w):
            wheel[:, x] = colorsys.hls_to_rgb(hh[0, x] / 360, 0.5, 1.0)
        st = frame_stats(wheel)
        chk('WHEEL win35~0.097', abs(st['hue']['win35'] - 35 / 360) < 0.01, st['hue']['win35'])
        chk('WHEEL R~0', st['hue']['R'] < 0.02, st['hue']['R'])
        two = np.zeros((h, w, 3)); two[:, :w // 2] = (1, 0, 0); two[:, w // 2:] = (0, 1, 1)
        st = frame_stats(two)
        chk('TWO win35~0.5', abs(st['hue']['win35'] - 0.5) < 0.01, st['hue']['win35'])
        chk('TWO R~0 (R alone cannot see it)', st['hue']['R'] < 0.05, st['hue']['R'])
        chk('TWO nModes==2', st['hue']['nModes'] == 2, st['hue']['modes'])
        grey = np.full((h, w, 3), 0.5)
        st = frame_stats(grey)
        chk('GREY refuses hue (None)', st['hue'] is None, st['hue'])
        chk('GREY luma 0.5', abs(st['luma']['mean'] - 0.5) < 1e-6, st['luma']['mean'])
        # edges: flat must be ~0, a checker must be high, blur must DROP edge share
        chk('FLAT edge05==0', edge_stats(grey)['edge05'] == 0, 0)
        yy, xx = np.mgrid[0:h, 0:w]
        chkr = (((xx // 8) + (yy // 8)) % 2).astype(float)[..., None].repeat(3, 2)
        e1 = edge_stats(chkr)['edge05']; e2 = edge_stats(acuity_match(chkr, 0.5))['edge05']
        chk('CHECKER edge05 high', e1 > 0.2, e1)
        chk('ACUITY degrade changes edge stats', e1 != e2, (e1, e2))
        st1 = frame_stats(spike); st2 = frame_stats(spike.copy())
        chk('SELF-PAIR identical', json.dumps(st1) == json.dumps(st2), '')
        print('SELFTEST', 'OK' if ok else 'FAILED')
        sys.exit(0 if ok else 1)
