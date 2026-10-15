"""GX_GAP_AGGREGATE — every headline number of the gap analysis, from all captured frames and
the six plates, into one evidence JSON (shots/rv/audit/gap/gap_numbers.json). Numbers only."""
import sys, os, glob, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import gx_gap_roles as G, gx_gap_salience as S, gx_gap_fx as F, gx_gap_form as FM, gx_gap_world as W
np.seterr(all='ignore')
ROOT = G.ROOT
CAPS = [os.path.join(ROOT, 'shots/rv/audit/gap/cap'), os.path.join(ROOT, 'shots/rv/audit/gap/cap2')]
def rng(v):
    v = [x for x in v if x is not None]
    return None if not v else {'n': len(v), 'min': round(float(min(v)), 4), 'med': round(float(np.median(v)), 4), 'max': round(float(max(v)), 4)}
def frame_rows():
    rows = []
    for d in CAPS:
        for js in sorted(glob.glob(d + '/*_[0-9].json')):
            rows.append(('ours', os.path.basename(js)[:-5], G.ours_roles(js[:-5]), js[:-5]))
    for n in ['bs_01', 'bs_02', 'bs_03', 'bs_04', 'bs_05', 'bs_06']:
        rows.append(('ref', n, G.ref_roles(n), None))
    return rows
if __name__ == '__main__':
    out = {'ours': {}, 'ref': {}}
    acc = {'ours': {}, 'ref': {}}
    def put(side, k, v): acc[side].setdefault(k, []).append(v)
    for side, tag, R, base in frame_rows():
        st = G.frame_role_stats(R); role = R['role']
        rec = {'share': st['share']}
        for r in ('ground', 'obstacle', 'fighter', 'effect', 'hud', 'ring', 'debris'):
            if r in st:
                rec[r] = {k: st[r][k] for k in ('Lp50', 'Lp05', 'Lp95', 'C', 'hi80', 'Lsd', 'hue')}
                put(side, r + '.share', st['share'].get(r, 0)); put(side, r + '.Lp50', st[r]['Lp50']); put(side, r + '.C', st[r]['C']); put(side, r + '.hi80', st[r]['hi80'])
        fs = st['fighters']
        rec['fighters'] = [{k: f[k] for k in ('name', 'areaPct', 'heightPct', 'dLmedian', 'dHue', 'bodyL', 'rimDark')} for f in fs]
        for f in fs:
            put(side, 'fighter.areaPct', f['areaPct']); put(side, 'fighter.dL', f['dLmedian']); put(side, 'fighter.bodyL', f['bodyL'])
        put(side, 'fighters.totalShare', st['share'].get('fighter', 0) + st['share'].get('ring', 0))
        b, n, top = S.report(R['page'], role)
        rec['salience'] = {'bestFighterRank': b, 'worldCells': n, 'top10': top}
        put(side, 'salience.bestFighterRank', b)
        cells = S.sal(R['page'], role); world = sorted([c for c in cells if c[1][6] < 0.5], key=lambda c: -c[0])
        put(side, 'salience.groundInTop20', sum(1 for c in world[:20] if max(range(9), key=lambda k: c[1][k]) == 1))
        fx = F.fx(R['canvas'], role == 5)
        if fx:
            rec['fx'] = {k: float(v) if v is not None else None for k, v in fx.items()}
            for k in ('Lsd', 'Lp95', 'hi80', 'deadFlat', 'coreMinusRim'): put(side, 'fx.' + k, fx[k])
        world_mask = role != 6
        wr = W.row(tag, R['canvas'], world_mask)
        rec['playfield'] = {k: wr[k] for k in ('p05', 'p50', 'Lsd', 'lo30', 'hi80', 'C', 'win35', 'R', 'rms12_p50')}
        for k in ('p05', 'p50', 'Lsd', 'C', 'rms12_p50', 'win35'): put(side, 'playfield.' + k, wr[k])
        if side == 'ours':
            rec['hud'] = {'opaque': R['ctrl']['hudOpaqueShare'], 'translucent': R['ctrl']['hudTranslucentShare']}
            rec['shadow'] = {'shareOfWorld': st.get('shadowShareOfWorld'), 'depthRatio': st.get('shadowDepthRatio')}
            put(side, 'shadow.share', st.get('shadowShareOfWorld')); put(side, 'shadow.depthRatio', st.get('shadowDepthRatio'))
            fm = FM.ours(base); rec['form'] = {'frontOverTop': fm['frontOverTop'], 'sideOverTop': fm['sideOverTop']}
            put(side, 'form.frontOverTop', fm['frontOverTop'])
        out[side][tag] = rec
    out['ranges'] = {side: {k: rng(v) for k, v in acc[side].items()} for side in acc}
    json.dump(out, open(os.path.join(ROOT, 'shots/rv/audit/gap/gap_numbers.json'), 'w'), indent=1, default=lambda o: None)
    for side in ('ours', 'ref'):
        print('==', side)
        for k, v in sorted(out['ranges'][side].items()): print('  ', k.ljust(26), v)
