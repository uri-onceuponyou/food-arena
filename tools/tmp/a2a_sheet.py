"""A2A_SHEET — before/after contact sheets for a2a_cap.mjs captures, so every kit piece is
LOOKED AT at both pitches (CLAUDE.md non-negotiable 3) without one Read per PNG.

Owner: work package A2a (graphics revamp wave 3, 2026-10-15). Prefix `a2a_`.

  python3 tools/tmp/a2a_sheet.py --out sheet.png --cols 2 --w 800 \
      --row "label|dirA/p58_stove_island.canvas.png|dirB/p58_stove_island.canvas.png" ...
  python3 tools/tmp/a2a_sheet.py --out sheet.png --pieces <dirA> <dirB> [--pitch 58|20] [--kinds a,b]

Each row is one subject; each column one arm. A missing file is drawn as a red cell and
counted, and the run exits 1 if any cell is missing (a sheet with a hole is not evidence).
"""
import sys, os
from PIL import Image, ImageDraw

argv = sys.argv[1:]


def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d


OUT = arg('--out', 'sheet.png')
CW = int(arg('--w', '640'))
rows = []
if '--pieces' in argv:
    i = argv.index('--pieces')
    a, b = argv[i + 1], argv[i + 2]
    pitch = arg('--pitch', '58')
    kinds = arg('--kinds')
    if kinds:
        kinds = kinds.split(',')
    else:
        kinds = sorted({f.split('.')[0][4:] for f in os.listdir(a) if f.startswith(f'p{pitch}_') and f.endswith('.canvas.png')})
    for k in kinds:
        rows.append((f'{k} @{pitch}', [os.path.join(a, f'p{pitch}_{k}.canvas.png'), os.path.join(b, f'p{pitch}_{k}.canvas.png')]))
for j, t in enumerate(argv):
    if t == '--row':
        parts = argv[j + 1].split('|')
        rows.append((parts[0], parts[1:]))
if not rows:
    print('a2a_sheet: no rows'); sys.exit(2)
ncol = max(len(r[1]) for r in rows)
cells = []
missing = 0
ch = None
for label, paths in rows:
    row = []
    for p in paths:
        if os.path.exists(p):
            im = Image.open(p).convert('RGB')
            h = round(im.height * CW / im.width)
            row.append(im.resize((CW, h), Image.LANCZOS))
            ch = ch or h
        else:
            row.append(None)
            missing += 1
    cells.append((label, row))
ch = ch or CW * 9 // 16
LAB = 22
sheet = Image.new('RGB', (CW * ncol, (ch + LAB) * len(cells)), (24, 24, 28))
d = ImageDraw.Draw(sheet)
for r, (label, row) in enumerate(cells):
    y = r * (ch + LAB)
    for c in range(ncol):
        x = c * CW
        im = row[c] if c < len(row) else None
        if im is None:
            d.rectangle([x, y + LAB, x + CW - 1, y + LAB + ch - 1], fill=(160, 20, 20))
        else:
            sheet.paste(im.crop((0, 0, CW, min(ch, im.height))), (x, y + LAB))
        d.text((x + 6, y + 4), f'{label}  [{"ABCDEFG"[c]}]', fill=(235, 235, 235))
sheet.save(OUT)
print(f'a2a_sheet: {len(cells)} rows x {ncol} cols -> {OUT}' + (f'  ({missing} MISSING cells)' if missing else ''))
sys.exit(1 if missing else 0)
