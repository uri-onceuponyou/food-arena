"""A2A_VALUES — the per-ROLE value script, measured on a2a_cap.mjs's canonical framings.

Owner: work package A2a (graphics revamp wave 3, 2026-10-15). Prefix `a2a_`.

Per shot (canonA / canon6: the shipped 58 deg match camera re-aimed at the canonical frames'
local seat, fighters where rv_capture's trace says they stood at the shutter):

  ground      every px whose top-most AND opaque surface is ground (gx_gap_roles.arena_sub == 1:
              floor stones, ground decals, puddles, the hazard ring), cast shadow INCLUDED —
              the reference's ground masks are hand-drawn and include shade, so this is the
              like-for-like number against REVAMP §2.3's reference median luma 0.39.
  litGround   a1_ground.py's mask (ground and not in cast shadow) — A1's reported quantity.
  topS/sideS  STRUCTURE (role 2 under `arena:kitchen`, not ground, not litter) split by the
              NORMAL pass: top = world n.y > 0.80, side = |n.y| < 0.35. The form question
              ("structure tops light, sides dark") answered by geometry, not by hue.
  fighter     top-most id under a `character:*` root.
Each role reports median luma (Rec.601 on sRGB, gx_gap_lib.luma), OKLab L and C medians and
its share of the frame.

  python3 tools/tmp/a2a_values.py <capdir> [--json out.json]
  python3 tools/tmp/a2a_values.py --selftest

Rule 6: --selftest builds a synthetic shot (known ground / top / side / fighter px with known
colours and normals) and requires every role to come back with the colour it was given, and
the role sets to be NON-EMPTY before a median is taken over them; a run refuses any shot whose
ground or structure set is empty.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gx_gap_lib import luma, oklab  # noqa: E402

SHADOW_T = 0.03
LITTER = ('ground_chip', 'ground_crumb', 'debris_', 'hub_debris_')


def rgbf(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float64) / 255.0


def decode_ids(a):
    a = a.astype(np.int32)
    qv = np.clip(np.round((a - 8) / 16.0), 0, 15).astype(np.int32)
    ok = (np.abs(a - (qv * 16 + 8)) <= 7).all(-1)
    ids = qv[..., 0] | (qv[..., 1] << 4) | (qv[..., 2] << 8)
    ids[~ok] = -1
    ids[(a.max(-1) <= 4)] = 0
    return ids


def arena_role(name, path, top):
    """gx_gap_roles.arena_sub, plus the character / litter split. 1 ground, 2 structure,
    3 fighter, 7 litter, 0 other (vfx, fog, hud, background)."""
    if top.startswith('character:'):
        return 3
    if top == 'contact:shadows':
        return 1
    if top != 'arena:kitchen':
        return 0
    n = name or ''
    if n.startswith(LITTER):
        return 7
    if 'contact_shadow' in n or 'grounding' in n or n.startswith('contact'):
        return 1
    if n.startswith(('floor_', 'apron_service_floor', 'puddle', 'hazard_ring')):
        return 1
    return 2


def role_table(meta):
    tops = {t['i']: t.get('name', '') or '' for t in meta['tops']}
    out = {}
    for m in meta['meshes']:
        if m.get('id'):
            out[m['id']] = arena_role(m['name'], m.get('path', ''), tops.get(m['top'], ''))
    return out


def lut(ids, table):
    mx = max(4096, int(ids.max()) + 2)
    arr = np.zeros(mx + 2, np.int32)
    for k, v in table.items():
        if 0 <= k < mx:
            arr[k] = v
    return arr[np.clip(ids, 0, mx)]


def stats(rgb, mask):
    n = int(mask.sum())
    if n == 0:
        return None
    L = luma(rgb)[mask]
    ok_l, a, b = oklab(rgb)
    C = np.hypot(a, b)[mask]
    return {'share': round(n / mask.size, 4), 'luma': round(float(np.median(L)), 4),
            'okL': round(float(np.median(ok_l[mask])), 4), 'okC': round(float(np.median(C)), 4)}


def analyse_arrays(can, nos, idt, ido, nrm, roles):
    rt = lut(idt, roles) * (idt > 0)
    ro = lut(ido, roles) * (ido > 0)
    ground = (rt == 1) & (ro == 1)
    lit = (luma(nos) - luma(can)) < SHADOW_T
    struct = (ro == 2) & (rt == 2)
    ny = nrm[..., 1] * 2.0 - 1.0
    top = struct & (ny > 0.80)
    side = struct & (np.abs(ny) < 0.35)
    fighter = rt == 3
    res = {
        'ground': stats(can, ground),
        'litGround': stats(can, ground & lit),
        'structure': stats(can, struct),
        'top': stats(can, top),
        'side': stats(can, side),
        'fighter': stats(can, fighter),
    }
    if res['top'] and res['side']:
        res['sideOverTop'] = round(res['side']['luma'] / max(1e-6, res['top']['luma']), 3)
    return res


def analyse(base):
    meta = json.load(open(base + '.json'))
    can = rgbf(base + '.canvas.png')
    nos = rgbf(base + '.noshadow.png')
    idt = decode_ids(np.asarray(Image.open(base + '.id.png').convert('RGB')))
    ido = decode_ids(np.asarray(Image.open(base + '.idopaque.png').convert('RGB')))
    nrm = rgbf(base + '.normal.png')
    res = analyse_arrays(can, nos, idt, ido, nrm, role_table(meta))
    res['shot'] = os.path.basename(base)
    res['controls'] = meta.get('controls')
    return res


def selftest():
    fails = 0

    def chk(name, cond, detail=''):
        nonlocal fails
        print(('  ok   - ' if cond else '  FAIL - ') + name + ('' if cond else f'  {detail}'))
        if not cond:
            fails += 1
    h, w = 60, 80
    enc = lambda i: np.array([(i & 15) * 16 + 8, ((i >> 4) & 15) * 16 + 8, ((i >> 8) & 15) * 16 + 8])
    ids = np.zeros((h, w, 3), np.int32)
    can = np.zeros((h, w, 3)); nrm = np.zeros((h, w, 3)); nos = np.zeros((h, w, 3))
    # ids: 1 floor stone, 2 a structure, 3 a fighter
    ids[:, :40] = enc(1); can[:, :40] = 0.40; nrm[:, :40] = [0.5, 1.0, 0.5]
    ids[:30, 40:] = enc(2); can[:30, 40:] = 0.80; nrm[:30, 40:] = [0.5, 1.0, 0.5]       # a top
    ids[30:50, 40:] = enc(2); can[30:50, 40:] = 0.50; nrm[30:50, 40:] = [0.5, 0.5, 1.0]  # a side
    ids[50:, 40:] = enc(3); can[50:, 40:] = 0.60; nrm[50:, 40:] = [1.0, 0.5, 0.5]
    nos[:] = can
    nos[:10, :40] = 0.60   # the first 10 rows of ground are in cast shadow
    meta = {'tops': [{'i': 0, 'name': 'arena:kitchen'}, {'i': 1, 'name': 'character:hamburger'}],
            'meshes': [{'id': 1, 'name': 'floor_stones_light', 'top': 0}, {'id': 2, 'name': 'props:kit:9', 'top': 0},
                       {'id': 3, 'name': 'body', 'top': 1}]}
    d = decode_ids(ids)
    r = analyse_arrays(can, nos, d, d, nrm, role_table(meta))
    chk('ground found, luma 0.40', r['ground'] and abs(r['ground']['luma'] - 0.40) < 1e-6, r['ground'])
    chk('ground share 0.5', r['ground'] and abs(r['ground']['share'] - 0.5) < 1e-6, r['ground'])
    chk('lit ground excludes the shadowed rows', r['litGround'] and abs(r['litGround']['share'] - 40 * 50 / (h * w)) < 1e-4, r['litGround'])
    chk('top luma 0.80', r['top'] and abs(r['top']['luma'] - 0.80) < 1e-6, r['top'])
    chk('side luma 0.50', r['side'] and abs(r['side']['luma'] - 0.50) < 1e-6, r['side'])
    chk('side/top 0.625', abs(r.get('sideOverTop', 0) - 0.625) < 1e-3, r.get('sideOverTop'))
    chk('fighter luma 0.60', r['fighter'] and abs(r['fighter']['luma'] - 0.60) < 1e-6, r['fighter'])
    # known-bad: a mesh table that names nothing as ground must yield an EMPTY ground set
    meta2 = {'tops': meta['tops'], 'meshes': [{'id': 1, 'name': 'counter_top', 'top': 0}, *meta['meshes'][1:]]}
    r2 = analyse_arrays(can, nos, d, d, nrm, role_table(meta2))
    chk('known-bad: no ground names -> ground is None (not a vacuous number)', r2['ground'] is None, r2['ground'])
    chk('litter is not structure', arena_role('ground_chip_3', '', 'arena:kitchen') == 7)
    chk('a merged kit mesh is structure', arena_role('props:kit_matte:40', '', 'arena:kitchen') == 2)
    print(f'a2a_values selftest: {"PASS" if not fails else "FAIL"} ({fails} failed)')
    return fails


def fmt(s):
    return '—' if not s else f"luma {s['luma']:.3f} okL {s['okL']:.3f} C {s['okC']:.3f} ({s['share']*100:.1f}%)"


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(1 if selftest() else 0)
    d = sys.argv[1]
    rows = []
    for js in sorted(glob.glob(os.path.join(d, '*.json'))):
        base = js[:-5]
        if not os.path.exists(base + '.normal.png'):
            continue
        r = analyse(base)
        rows.append(r)
        print(f"{r['shot']}")
        for k in ('ground', 'litGround', 'structure', 'top', 'side', 'fighter'):
            print(f"  {k:10s} {fmt(r[k])}")
        print(f"  side/top luma {r.get('sideOverTop')}   controls {r['controls']}")
    if not rows:
        print('a2a_values: NO shots analysed — wrong directory?'); sys.exit(2)
    bad = [r['shot'] for r in rows if not r['ground'] or not r['structure']]
    if bad:
        print(f'a2a_values: shots with an EMPTY ground or structure set: {bad}'); sys.exit(2)
    if '--json' in sys.argv:
        json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
