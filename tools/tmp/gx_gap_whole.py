"""
GX_GAP_WHOLE — whole-frame statistics, ours vs the six top-down plates, same code both sides.

Usage: python3 tools/tmp/gx_gap_whole.py --ours a.png,b.png --out shots/rv/audit/gap/whole.json
       (plates are read from reference/images/curated/gameplay_topdown; numbers only are emitted)

Edge numbers are computed at HEIGHT 540 on both sides (below the plates' native acuity —
they arrive upscaled ~1.4x from ~520-560 px), because blur RAISES a thresholded edge share
(gx_gap_lib selftest, CHECKER arm), so an acuity-degraded copy is not a fair control for it.
"""
import sys, json, glob, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from gx_gap_lib import load, band, frame_stats, edge_stats

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
PLATES = sorted(glob.glob(os.path.join(ROOT, 'reference/images/curated/gameplay_topdown/bs_0*.png')))


def arg(k, d=None):
    return sys.argv[sys.argv.index('--' + k) + 1] if '--' + k in sys.argv else d


def run(path):
    rgb = load(path, 900)
    b = band(rgb)
    e = load(path, 540)
    return {'full': frame_stats(rgb), 'band': frame_stats(b), 'edgeBand540': edge_stats(band(e))}


if __name__ == '__main__':
    ours = [p for p in (arg('ours', '') or '').split(',') if p]
    res = {'ours': {}, 'ref': {}}
    for p in ours:
        res['ours'][os.path.basename(p)] = run(p)
    for p in PLATES:
        res['ref'][os.path.basename(p)] = run(p)
    out = arg('out')
    if out:
        with open(out, 'w') as f:
            json.dump(res, f, indent=1)

    def row(name, r, part='band'):
        s = r[part]; e = r['edgeBand540']; h = s['hue'] or {}
        return (f"{name:28s} Lmean {s['luma']['mean']:.3f} sd {s['luma']['sd']:.3f} p05 {s['luma']['p05']:.3f} "
                f"p50 {s['luma']['p50']:.3f} p95 {s['luma']['p95']:.3f} hi80 {s['luma']['hi80']:.3f} lo20 {s['luma']['lo20']:.3f} "
                f"| notan {s['notan3']} | C {s['chromaOK']['mean']:.3f} viv15 {s['chromaOK']['vivid15']:.3f} "
                f"| win35 {h.get('win35')} R {h.get('R')} nM {h.get('nModes')} H {h.get('entropyBits')} "
                f"| CF {s['colorfulnessHS']} | g {e['gradMean']:.4f} e05 {e['edge05']:.3f} rms50 {e['rms16_p50']:.3f}")
    for side in ('ours', 'ref'):
        print('==', side)
        for k, v in res[side].items():
            print(row(k, v))
