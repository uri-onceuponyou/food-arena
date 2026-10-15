#!/usr/bin/env python3
"""
GX_VFX_HUE — does Donut's Sticky Trail drive the "one hue owns the cast frame" lead?
(VFX audit, review phase; reads PNGs only.)

HANDOVER's open lead: one 35-degree hue band holds ~94% of the chromatic pixels of the
CAST frame. This measures that statistic on a cast-frame crop (0.45 of frame height,
16:9, centred on the two fighters' screen midpoint — the `topdown_cast` crop rule) for
the SAME instant rendered twice by `gx_vfx_cap.mjs --diag`: `_full` and `_noground`
(every `vfx_ground_mark` mesh hidden). If the share falls when the trail is removed,
the trail is (part of) the lead's mechanism.

Chromatic pixel: HSV S >= 0.30 and V >= 0.20 (sRGB). Share = max over circular 35-degree
windows of the fraction of chromatic pixels whose hue falls inside it.
This is an APPROXIMATION of the lead's instrument, which is not named in HANDOVER;
compare full vs noground (a paired difference on one instrument), not to the 94%.

Selftest (known inputs): uniform hue wheel -> ~35/360; a single hue -> 1.0.
Usage: python3 tools/tmp/gx_vfx_hue.py <dir> <runjson> <name> [<name> ...]
"""
import json
import sys
import numpy as np
from PIL import Image

WIN = 35.0


def hsv(img):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    mx = img.max(axis=-1)
    mn = img.min(axis=-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-9), 0)
    h = np.zeros_like(mx)
    m = d > 1e-9
    rm = m & (mx == r)
    gm = m & (mx == g) & ~rm
    bm = m & ~rm & ~gm
    h[rm] = ((g[rm] - b[rm]) / d[rm]) % 6
    h[gm] = (b[gm] - r[gm]) / d[gm] + 2
    h[bm] = (r[bm] - g[bm]) / d[bm] + 4
    return (h * 60) % 360, s, mx


def best_window(hues):
    if hues.size == 0:
        return 0.0, None
    hist, _ = np.histogram(hues, bins=360, range=(0, 360))
    ext = np.concatenate([hist, hist[:int(WIN)]])
    csum = np.cumsum(np.concatenate([[0], ext]))
    win = csum[int(WIN):int(WIN) + 360] - csum[:360]
    i = int(np.argmax(win))
    return float(win[i] / hues.size), (i, (i + WIN) % 360)


def share(img):
    h, s, v = hsv(img)
    chrom = (s >= 0.30) & (v >= 0.20)
    return best_window(h[chrom]) + (int(chrom.sum()),)


def selftest():
    hh = np.linspace(0, 360, 3600, endpoint=False)
    # build an image of fully saturated colours spanning the wheel
    rgb = np.zeros((1, hh.size, 3))
    c = 1.0
    x = c * (1 - np.abs(((hh / 60) % 2) - 1))
    sect = (hh // 60).astype(int)
    tbl = {0: (c, x, 0), 1: (x, c, 0), 2: (0, c, x), 3: (0, x, c), 4: (x, 0, c), 5: (c, 0, x)}
    for k, (a, b2, cc) in tbl.items():
        m = sect == k
        rgb[0, m, 0] = a if np.isscalar(a) else a[m]
        rgb[0, m, 1] = b2 if np.isscalar(b2) else b2[m]
        rgb[0, m, 2] = cc if np.isscalar(cc) else cc[m]
    u, _, _ = share(rgb)
    one = np.zeros((4, 4, 3)); one[..., 0] = 1.0
    o, _, _ = share(one)
    ok = abs(u - WIN / 360) < 0.01 and o > 0.999
    print(json.dumps({'selftest': {'uniform': round(u, 4), 'expect': round(WIN / 360, 4), 'single': o, 'ok': ok}}))
    if not ok:
        raise SystemExit('SELFTEST FAILED')


def main():
    if sys.argv[1] == '--selftest':
        selftest()
        return
    d, runjson = sys.argv[1], sys.argv[2]
    rows = {r['name']: r for run in json.load(open(runjson))['result'] for r in run['rows']}
    out = []
    for nm in sys.argv[3:]:
        row = rows[nm]
        p0, p1 = row['scr'][0], row['scr'][1]
        full = np.asarray(Image.open(f'{d}/{nm}_full.png').convert('RGB')).astype(float) / 255
        nog = np.asarray(Image.open(f'{d}/{nm}_noground.png').convert('RGB')).astype(float) / 255
        H, W = full.shape[:2]
        ch = int(0.45 * H); cw = int(ch * 16 / 9)
        cx = (p0['x'] + p1['x']) / 2; cy = (p0['y'] + p1['y']) / 2
        x0 = int(min(max(0, cx - cw / 2), W - cw)); y0 = int(min(max(0, cy - ch / 2), H - ch))
        cf = full[y0:y0 + ch, x0:x0 + cw]; cn = nog[y0:y0 + ch, x0:x0 + cw]
        sf, wf, nf = share(cf)
        sn, wn, nn = share(cn)
        r = {'frame': nm, 'crop': [x0, y0, cw, ch], 'full': {'share35': round(sf, 3), 'window': wf, 'chromPx': nf},
             'noTrail': {'share35': round(sn, 3), 'window': wn, 'chromPx': nn}}
        out.append(r)
        print(json.dumps(r))
    json.dump(out, open(f'{d}/hue35.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
