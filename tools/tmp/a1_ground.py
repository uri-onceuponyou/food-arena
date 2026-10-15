"""A1_GROUND — the "calm stage" acceptance numbers, from a1_cap.mjs captures.

Owner: work package A1 (graphics revamp, 2026-10-15). Prefix `a1_`.

Per shot (match camera, 1600x900, canvas readback, post chain ON):

  windows     140x90 px windows (stride 70x45) whose EVERY interior pixel is LIT GROUND:
                - top-most surface (id pass, translucent meshes included) is ground or a
                  ground decal, AND the opaque surface under it is ground
                  (gx_gap_roles.arena_sub == 1: floor_*, contact/grounding decals, puddles);
                - not in cast shadow: luma(noshadow) - luma(canvas) < 0.03 (gx_gap_roles);
                - both id decodes valid (an antialiased id blend is not trusted).
              The audit's GX-05 measure ("lit-ground windows, 140x90 px, entirely ground").
  deadFlat    share of window px with |grad L| < 0.5/255 (gx_gap_fx's threshold), median
              over the shot's windows. Target >= 0.40 (audit: ours 0.10-0.155, plates 0.40-0.93)
  microGrad   mean |grad L| over window px (gx_gap_lib.grad_mag), median over windows.
              Target <= 0.005 (audit: ours 0.0076-0.0084, plate median 0.0025)
  litter      top-pass px on litter meshes (ground_chip*, ground_crumb*, debris_*,
              hub_debris_*) / frame px. Target < 0.005 on hub fight frames (audit 0.013-0.016)
  smudge      top-pass px on the translucent smudge decals (floor_stain, floor_path_strip,
              floor_speck, floor_mat_edge_wear) / frame px — what item 1 deletes
  subfloor    opaque-pass px on `floor_base` / frame px: the subfloor plane seen THROUGH the
              stone field. The gap construction showed it in every joint; the soft-joint
              construction must show it nowhere inside the playfield (a sliver is a hole)

  python3 tools/tmp/a1_ground.py <capdir> [--json out.json]
  python3 tools/tmp/a1_ground.py --selftest

Rule 6: --selftest proves the window filter, the flatness and gradient arms and the id
decode against constructed inputs (flat must read 1.0, noise must read ~0, one foreign px
must reject a window), and the run asserts every analysed shot found SOME lit ground
(a filtered set is asserted non-empty before anything is computed over it).
"""
import sys, os, json, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gx_gap_lib import luma, grad_mag, oklab, box_mean  # noqa: E402

WIN_W, WIN_H, STR_X, STR_Y = 140, 90, 70, 45
FLAT_T = 0.5 / 255
SHADOW_T = 0.03
FOREIGN_R = 2
LITTER = ('ground_chip', 'ground_crumb', 'debris_', 'hub_debris_')
SMUDGE = ('floor_stain', 'floor_path_strip', 'floor_speck', 'floor_mat_edge_wear')


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


def is_ground_name(n, top_name):
    """gx_gap_roles.arena_sub == 1, plus the contact-shadow root."""
    if top_name == 'contact:shadows':
        return True
    if top_name != 'arena:kitchen':
        return False
    if n.startswith(LITTER):
        return False
    if 'contact_shadow' in n or 'grounding' in n or n.startswith('contact'):
        return True
    return n.startswith(('floor_', 'apron_service_floor', 'puddle', 'hazard_ring'))


def lut(ids, table, default=False):
    mx = max(4096, int(ids.max()) + 2)
    arr = np.full(mx + 2, default)
    for k, v in table.items():
        if 0 <= k < mx:
            arr[k] = v
    return arr[np.clip(ids, 0, mx)]


def lit_ground_mask(idt, ido, gt, go, lit):
    """Lit ground, tolerant of antialiased id blends BETWEEN ground ids (-1 decodes), never of
    one next to a foreign surface: a px is ok when no foreign px (a valid non-ground id in
    either pass, an empty id, or a cast-shadowed px) lies within FOREIGN_R and some ground
    px does."""
    foreign = ((idt > 0) & ~gt) | ((ido > 0) & ~go) | (idt == 0) | (ido == 0) | ~lit
    near_foreign = box_mean(foreign.astype(np.float64), FOREIGN_R) > 1e-9
    near_ground = box_mean((gt & go).astype(np.float64), FOREIGN_R) > 1e-9
    return ~near_foreign & near_ground


def windows_of(okmask, L, gm):
    """Windows whose every INTERIOR px (1 px border dropped) is in okmask."""
    h, w = okmask.shape
    out = []
    for y in range(0, h - WIN_H + 1, STR_Y):
        for x in range(0, w - WIN_W + 1, STR_X):
            m = okmask[y + 1:y + WIN_H - 1, x + 1:x + WIN_W - 1]
            if not m.all():
                continue
            g = gm[y + 1:y + WIN_H - 1, x + 1:x + WIN_W - 1]
            out.append({'x': x, 'y': y, 'deadFlat': float((g < FLAT_T).mean()), 'microGrad': float(g.mean()),
                        'Lsd': float(L[y + 1:y + WIN_H - 1, x + 1:x + WIN_W - 1].std())})
    return out


def analyse(base):
    meta = json.load(open(base + '.json'))
    can = rgbf(base + '.canvas.png')
    nos = rgbf(base + '.noshadow.png')
    idt = decode_ids(np.asarray(Image.open(base + '.id.png').convert('RGB')))
    ido = decode_ids(np.asarray(Image.open(base + '.idopaque.png').convert('RGB')))
    tops = {t['i']: t.get('name', '') or '' for t in meta['tops']}
    ground_of, litter_of, smudge_of, name_of, base_of = {}, {}, {}, {}, {}
    for m in meta['meshes']:
        if not m.get('id'):
            continue
        tn = tops.get(m['top'], '')
        n = m['name'] or ''
        name_of[m['id']] = n
        ground_of[m['id']] = is_ground_name(n, tn)
        litter_of[m['id']] = tn == 'arena:kitchen' and n.startswith(LITTER)
        smudge_of[m['id']] = tn == 'arena:kitchen' and n.startswith(SMUDGE)
        base_of[m['id']] = tn == 'arena:kitchen' and n == 'floor_base'
    # ⚠️ An antialiased edge between two GROUND ids (a light stone against a dark one, a
    # stone against the subfloor gap) decodes to -1. The first version required a valid id
    # on every px, which rejected nearly every window — every 140x90 window crosses a
    # joint — and measured only the few that happened to straddle same-mesh joints (4 of
    # 11 shots had ANY window). A -1 px is now ground when every VALID id within FOREIGN_R
    # px is ground, so a joint stays ground and the halo of a prop, a fighter or a chip
    # (valid non-ground ids) still rejects the window.
    gt = lut(idt, ground_of) & (idt > 0)
    go = lut(ido, ground_of) & (ido > 0)
    L = luma(can)
    lit = (luma(nos) - L) < SHADOW_T
    ok = lit_ground_mask(idt, ido, gt, go, lit)
    n_px = L.size
    idcover = float(((idt > 0) | (idt < 0)).mean())
    gm = grad_mag(L)
    wins = windows_of(ok, L, gm)
    Lk, A, B = oklab(can)
    C = np.hypot(A, B)
    res = {
        'shot': os.path.basename(base),
        'idCover': round(idcover, 4),
        'litGroundShare': round(float(ok.mean()), 4),
        'groundShareTop': round(float(gt.mean()), 4),
        'litter': round(float((lut(idt, litter_of) & (idt > 0)).sum() / n_px), 5),
        'smudge': round(float((lut(idt, smudge_of) & (idt > 0)).sum() / n_px), 5),
        'subfloor': round(float((lut(ido, base_of) & (ido > 0)).sum() / n_px), 5),
        'windows': len(wins),
        'deadFlat_med': round(float(np.median([w['deadFlat'] for w in wins])), 4) if wins else None,
        'microGrad_med': round(float(np.median([w['microGrad'] for w in wins])), 5) if wins else None,
        'Lsd_med': round(float(np.median([w['Lsd'] for w in wins])), 4) if wins else None,
        'groundOkL_med': round(float(np.median(Lk[ok])), 4) if ok.any() else None,
        'groundOkC_med': round(float(np.median(C[ok])), 4) if ok.any() else None,
        'groundLuma_med': round(float(np.median(L[ok])), 4) if ok.any() else None,
        'controls': meta.get('controls'),
    }
    return res, wins


def selftest():
    fails = 0

    def chk(name, cond, detail=''):
        nonlocal fails
        print(('  ok   - ' if cond else '  FAIL - ') + name + ('' if cond else f'  {detail}'))
        if not cond:
            fails += 1
    h, w = 200, 300
    flat = np.full((h, w), 0.5)
    ok = np.ones((h, w), bool)
    W = windows_of(ok, flat, grad_mag(flat))
    chk('flat field: windows found', len(W) > 0, len(W))
    chk('flat field: deadFlat == 1.0 and microGrad == 0', all(x['deadFlat'] == 1.0 and x['microGrad'] == 0 for x in W))
    rng = np.random.default_rng(7)
    noise = 0.5 + (rng.random((h, w)) - 0.5) * (8 / 255)
    W = windows_of(ok, noise, grad_mag(noise))
    chk('+-4/255 noise: deadFlat < 0.15', max(x['deadFlat'] for x in W) < 0.15, max(x['deadFlat'] for x in W))
    chk('+-4/255 noise: microGrad > 0.005', min(x['microGrad'] for x in W) > 0.005, min(x['microGrad'] for x in W))
    # The threshold is a GRADIENT, so a smooth shading ramp below 0.5/255 per px is flat BY
    # DEFINITION (lighting falloff is not texture) and one above it is not. Both directions:
    ramp = np.tile(np.linspace(0.4, 0.6, w), (h, 1))          # 0.00067/px
    W = windows_of(ok, ramp, grad_mag(ramp))
    chk('a gentle ramp (0.00067/px, under 0.5/255) IS dead flat', min(x['deadFlat'] for x in W) == 1.0)
    steep = np.tile(np.linspace(0.0, 1.0, w), (h, 1))         # 0.0033/px
    W = windows_of(ok, steep, grad_mag(steep))
    chk('a steep ramp (0.0033/px, over 0.5/255) is NOT', max(x['deadFlat'] for x in W) == 0.0)
    bad = ok.copy()
    bad[50, 50] = False
    W1 = windows_of(ok, flat, grad_mag(flat))
    W2 = windows_of(bad, flat, grad_mag(flat))
    chk('one foreign px rejects every window containing it', len(W2) < len(W1), (len(W1), len(W2)))
    chk('...and only those (window at x=140 survives)', any(x['x'] == 140 and x['y'] == 0 for x in W2))
    ids = np.zeros((4, 4), np.int32)
    ids[0, 0], ids[1, 1], ids[2, 2] = 1, 300, 4093
    enc = np.zeros((4, 4, 3), np.int32)
    for c, sh in enumerate((0, 4, 8)):
        enc[..., c] = ((ids >> sh) & 15) * 16 + 8
    enc[ids == 0] = 0
    dec = decode_ids(enc)
    chk('id round-trip (1, 300, 4093)', dec[0, 0] == 1 and dec[1, 1] == 300 and dec[2, 2] == 4093 and dec[3, 3] == 0, dec)
    blend = enc.copy()
    blend[0, 0] = (enc[0, 0] + enc[1, 1]) // 2
    chk('an AA blend of two ids decodes to -1, not a third id', decode_ids(blend)[0, 0] == -1, decode_ids(blend)[0, 0])
    # the AA-tolerant mask: a -1 seam between two GROUND ids keeps the window; the same seam
    # beside a FOREIGN id (a prop, a chip) rejects every window within FOREIGN_R of it
    ids = np.full((h, w), 5, np.int32)          # 5 = a ground id
    ids[:, 150:] = 6                            # 6 = another ground id
    ids[:, 149] = -1                            # the AA blend between them
    gtab = (ids == 5) | (ids == 6)
    m1 = lit_ground_mask(ids, ids, gtab, gtab, np.ones((h, w), bool))
    W1 = windows_of(m1, flat, grad_mag(flat))
    chk('a -1 seam between two ground ids keeps the windows across it', any(x['x'] <= 149 < x['x'] + WIN_W for x in W1), len(W1))
    ids2 = ids.copy(); ids2[100, 151] = 9      # 9 = a foreign (non-ground) id beside the seam
    gtab2 = (ids2 == 5) | (ids2 == 6)
    m2 = lit_ground_mask(ids2, ids2, gtab2, gtab2, np.ones((h, w), bool))
    W2 = windows_of(m2, flat, grad_mag(flat))
    chk('...and one foreign px beside it rejects the windows that contain it',
        not any(x['x'] < 151 < x['x'] + WIN_W and x['y'] < 100 < x['y'] + WIN_H for x in W2) and len(W2) < len(W1), (len(W1), len(W2)))
    shadow = np.ones((h, w), bool); shadow[20:30, 20:30] = False
    m3 = lit_ground_mask(ids, ids, gtab, gtab, shadow)
    chk('a cast-shadow patch is not lit ground', not m3[25, 25] and m3[100, 100])
    chk('ground names: stones yes, chips no, a counter no',
        is_ground_name('floor_stones_light', 'arena:kitchen') and not is_ground_name('ground_chip_pebble', 'arena:kitchen')
        and not is_ground_name('counter_top', 'arena:kitchen') and not is_ground_name('floor_stones_light', 'character:x'))
    print(f'a1_ground selftest: {"PASS" if not fails else "FAIL"} ({fails} failed)')
    return fails


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(1 if selftest() else 0)
    d = sys.argv[1]
    rows = []
    for js in sorted(glob.glob(os.path.join(d, '*.json'))):
        if os.path.basename(js) in ('stations.json',):
            continue
        base = js[:-5]
        if not os.path.exists(base + '.id.png'):
            continue
        r, wins = analyse(base)
        rows.append(r)
        print(f"{r['shot']:12s} win {r['windows']:3d}  deadFlat {r['deadFlat_med']}  microGrad {r['microGrad_med']}  "
              f"litter {r['litter']*100:.2f}%  smudge {r['smudge']*100:.2f}%  subfloor {r['subfloor']*100:.3f}%  litGround {r['litGroundShare']:.3f}  "
              f"okL {r['groundOkL_med']} C {r['groundOkC_med']} luma {r['groundLuma_med']}  idCover {r['idCover']}  ctl {r['controls']}")
    if not rows:
        print('a1_ground: NO shots analysed — wrong directory?'); sys.exit(2)
    empty = [r['shot'] for r in rows if r['litGroundShare'] == 0]
    if empty:
        print(f'a1_ground: shots with NO lit ground at all (the mask selected nothing): {empty}'); sys.exit(2)
    lowcov = [r['shot'] for r in rows if r['idCover'] < 0.85]
    if lowcov:
        print(f'a1_ground: id pass covers < 85% on {lowcov} — the id decode is not trustworthy there')
    W = [r for r in rows if r['windows']]
    if W:
        df = [r['deadFlat_med'] for r in W]; mg = [r['microGrad_med'] for r in W]
        print(f"ACROSS {len(W)} shots with windows: deadFlat {min(df):.3f}..{max(df):.3f} (median {np.median(df):.3f})  "
              f"microGrad {min(mg):.5f}..{max(mg):.5f} (median {np.median(mg):.5f})")
    hub = [r for r in rows if r['shot'].startswith('hub6')]
    if hub:
        print(f"HUB FIGHT litter {min(r['litter'] for r in hub)*100:.2f}..{max(r['litter'] for r in hub)*100:.2f}% of frame")
    if '--json' in sys.argv:
        json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
