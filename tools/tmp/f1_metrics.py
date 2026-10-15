"""
F1_METRICS — graphics campaign work package F1 (the fighter unit), its acceptance numbers.
Owner of the `f1_` prefix.

Reads an `r1_probe.mjs` run (one frozen, deterministic frame per scene; every LOOK variant
rendered on that ONE frame) and reports, per scene x variant:

  fRank     best rank of a WORLD salience cell (gx_gap_salience: 32x18, HUD cells excluded)
            that is >= 25% fighter + ring — the reference's own rule ("body, + ring on the
            reference"), so ours and the plates are ranked by one definition
  fighter   share of the frame that is fighter body (gx_gap_roles' exact per-root masks)
  ring      share that is seat ring and not fighter (role 4, the reference annotation's code)
  unit      fighter + ring
  delivered share of ring-mask px whose colour the ring actually MOVED vs the variant with
            `look.rings` off (>= 12/255 on any channel) — a ring that is in the id pass but
            invisible in the frame is `docs/LESSONS.md` §1's failure, and this sees it

THE RING MASK comes from the reference variant's per-MESH id pass (the top pass, where the
transparent disc is drawn opaque — so the mask is the disc's FOOTPRINT, as the reference's
hand-annotated ring ellipses are), minus fighter and HUD. Ring meshes are found by their
top-level root `seat:rings` in the probe's mesh table. For a variant with the rings OFF the
ring role is folded back into ground, so a `-rings` row is exactly "the frame before F1",
measured on the same pixels.

Controls, each required to come out as constructed (CLAUDE.md rule 6):
  NONEMPTY  a variant with rings ON must have ring px > 0 in every scene with a fighter on
            screen — the filtered set is asserted non-empty BEFORE anything is averaged over it
  MOVES     with rings ON, `delivered` must exceed 0.5 (the ring changes most of its own mask)
  selftest  synthetic frames (below): a saturated ring raises a fighter cell's rank, a grey
            ring that matches the floor does not, and the mass arithmetic is exact on a
            known disc. Runs before any frame is read; a failure refuses to read frames.

Usage:  python3 tools/tmp/f1_metrics.py <probe dir> [--json out.json] [--on r1 --off -rings]
"""
import sys, os, json, glob
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
np.seterr(all='ignore')


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def rank_and_mass(can, role):
    import gx_gap_salience as S
    cells = S.sal(can, role)
    world = [c for c in cells if c[1][6] < 0.5]
    world.sort(key=lambda c: -c[0])
    fr = [k for k, c in enumerate(world) if c[1][3] + c[1][4] >= 0.25]
    return (fr[0] + 1) if fr else None, len(world)


def ring_ids(meta):
    tops = {t['i']: t.get('name', '') for t in meta.get('tops', [])}
    return {m['id'] for m in meta.get('meshes', []) if m.get('id') and tops.get(m['top'], '') == 'seat:rings'}


def analyse(d, on='r1', off='-rings'):
    import gx_gap_roles as G
    from r1_metrics import rgbf
    out = {}
    for js in sorted(glob.glob(os.path.join(d, '*.json'))):
        if js.endswith('summary.json'):
            continue
        base = js[:-5]
        if not os.path.exists(base + '.id.png'):
            continue
        meta = json.load(open(js))
        R = G.ours_roles(base)
        role = R['role'].copy()
        hud = role == 6
        fighter = role == 3
        ids_top = G.decode_ids(base + '.id.png')
        rids = ring_ids(meta)
        ring = np.isin(ids_top, list(rids)) & ~fighter & ~hud if rids else np.zeros_like(fighter)
        rows = {}
        for v in meta.get('variants', {}):
            p = f'{base}.{v}.png'
            if not os.path.exists(p):
                continue
            can = rgbf(p)
            rings_on = bool((meta['variants'][v].get('look') or {}).get('rings', False))
            rl = role.copy()
            if rings_on:
                rl[ring] = 4
            rank, nworld = rank_and_mass(can, rl)
            row = {'ringsOn': rings_on, 'fRank': rank, 'world': nworld,
                   'fighter': round(float(fighter.mean()), 5),
                   'ring': round(float((rl == 4).mean()), 5),
                   'unit': round(float(((rl == 3) | (rl == 4)).mean()), 5),
                   'draws': (meta['variants'][v].get('drawsShadow') or {}).get('calls')}
            rows[v] = row
        # delivered: what the ring did to its own mask, on-variant vs off-variant
        if on in rows and off in rows and ring.any():
            a = rgbf(f'{base}.{on}.png'); b = rgbf(f'{base}.{off}.png')
            moved = (np.abs(a - b).max(-1) >= 12 / 255) & ring
            rows[on]['delivered'] = round(float(moved.sum() / ring.sum()), 4)
        out[os.path.basename(base)] = {'ringIds': len(rids), 'ringPx': int(ring.sum()),
                                       'fighterPx': int(fighter.sum()), 'bodies': len(R['bodies']),
                                       'size': list(role.shape), 'variants': rows}
    return out


def selftest():
    import gx_gap_salience as S
    ok = True

    def chk(name, cond, val):
        nonlocal ok
        print(('PASS ' if cond else 'FAIL ') + name, val)
        ok = ok and cond
    H, W = 900, 1600
    rng = np.random.default_rng(7)
    # A busy floor: mid-value warm noise, so salience has something to compete with.
    floor = np.clip(np.array([0.70, 0.62, 0.50]) + rng.normal(0, 0.05, (H, W, 3)), 0, 1)
    role = np.ones((H, W), np.int32)
    yy, xx = np.mgrid[0:H, 0:W]
    # Decoys: MODERATE prop cells elsewhere (role 2), darker than the floor in its own hue —
    # loud enough to outrank a pastel body that blends in, quiet enough that a saturated
    # mark can climb past them. (Solid violet decoys outrank ANY ring and make the test
    # unable to tell a ring from no ring — the first version of this selftest, 23 vs 23.)
    for k in range(12):
        cx, cy = 150 + (k % 6) * 260, 150 + (k // 6) * 600
        m = (np.abs(xx - cx) < 30) & (np.abs(yy - cy) < 30)
        floor[m] = [0.50, 0.44, 0.36]; role[m] = 2
    body = ((xx - 800) / 18) ** 2 + ((yy - 430) / 34) ** 2 <= 1
    disc = ((xx - 800) / 52) ** 2 + ((yy - 470) / 44) ** 2 <= 1
    rim = disc & ~(((xx - 800) / 43) ** 2 + ((yy - 470) / 36) ** 2 <= 1)
    base = floor.copy(); base[body] = [0.80, 0.74, 0.66]      # a pastel body that blends in
    r0 = role.copy(); r0[body] = 3
    rank0, _ = rank_and_mass(base, r0)
    loud = base.copy(); loud[rim & ~body] = [0.90, 0.29, 0.25]
    r1 = r0.copy(); r1[disc & ~body] = 4
    rank1, _ = rank_and_mass(loud, r1)
    grey = base.copy(); grey[rim & ~body] = floor[rim & ~body]   # a ring that is not there
    rank2, _ = rank_and_mass(grey, r1)
    chk('a saturated rim raises the fighter cell (lower rank)', rank1 is not None and rank0 is not None and rank1 < rank0, (rank0, rank1))
    chk('a ring the floor swallows does not', rank2 is not None and rank1 is not None and rank2 > rank1, (rank2, rank1))
    exact = float((disc & ~body).sum() / (H * W))
    chk('ring mass is the disc minus the body, exactly', abs(float((r1 == 4).mean()) - exact) < 1e-12, round(exact, 6))
    chk('salience grid has 32x18 cells', len(S.sal(base, r0)) == 576, len(S.sal(base, r0)))
    return ok


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    if not selftest():
        print('selftest FAILED — refusing to read frames'); sys.exit(1)
    d = sys.argv[1]
    on, off = arg('--on', 'r1'), arg('--off', '-rings')
    res = analyse(d, on, off)
    bad = []
    for scene, r in res.items():
        print(f'== {scene}  bodies {r["bodies"]}  ring ids {r["ringIds"]}  ring px {r["ringPx"]}  fighter px {r["fighterPx"]}  size {r["size"]}')
        for v, m in r['variants'].items():
            print(f'  {v:14s} rings {"on " if m["ringsOn"] else "off"} | fRank {m["fRank"]} of {m["world"]} | fighter {m["fighter"]*100:.2f}%  ring {m["ring"]*100:.2f}%  unit {m["unit"]*100:.2f}% | delivered {m.get("delivered", "-")} | draws {m["draws"]}')
            if m['ringsOn'] and r['bodies'] > 0 and m['ring'] <= 0:
                bad.append(f'{scene}/{v}: NONEMPTY — rings on, fighters on screen, ring px 0')
            if m['ringsOn'] and 'delivered' in m and m['delivered'] <= 0.5:
                bad.append(f'{scene}/{v}: MOVES — the ring moved only {m["delivered"]} of its own mask')
    for b in bad:
        print('CONTROL FAIL', b)
    if '--json' in sys.argv:
        json.dump(res, open(arg('--json'), 'w'), indent=1, default=str)
    sys.exit(1 if bad else 0)
