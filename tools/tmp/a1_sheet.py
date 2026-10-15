"""A1_SHEET — before/after rows for the "calm stage" package (A1, graphics revamp 2026-10-15).

  python3 tools/tmp/a1_sheet.py --out sheet.png --scale 0.5 \\
      --row "label" before.png after.png [--row "label2" b2.png a2.png ...] [--crop x0,y0,x1,y1 --zoom 3]

Each row is BEFORE | AFTER at the same scale, labelled. `--crop` (pixel box on the source)
with `--zoom` makes a magnified detail sheet instead. Prints the output path; LOOK at it.
Never put a reference plate through this — it builds sheets of OUR frames only.
"""
import sys
from PIL import Image, ImageDraw


def main(argv):
    out, scale, crop, zoom, rows = None, 0.5, None, 1, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--out': out = argv[i + 1]; i += 2
        elif a == '--scale': scale = float(argv[i + 1]); i += 2
        elif a == '--crop': crop = tuple(int(v) for v in argv[i + 1].split(',')); i += 2
        elif a == '--zoom': zoom = int(argv[i + 1]); i += 2
        elif a == '--row': rows.append((argv[i + 1], argv[i + 2], argv[i + 3])); i += 4
        else: raise SystemExit(f'a1_sheet: unknown arg {a}')
    if not out or not rows:
        raise SystemExit('a1_sheet: --out and at least one --row required')
    tiles = []
    for label, b, a in rows:
        pair = []
        for p in (b, a):
            im = Image.open(p).convert('RGB')
            if crop:
                im = im.crop(crop)
                im = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
            else:
                im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
            pair.append(im)
        tiles.append((label, pair))
    GAP, LAB = 10, 26
    w = max(p[0].width + p[1].width for _, p in tiles) + GAP * 3
    h = sum(max(p[0].height, p[1].height) + LAB + GAP for _, p in tiles) + GAP
    sheet = Image.new('RGB', (w, h), (22, 16, 31))
    d = ImageDraw.Draw(sheet)
    y = GAP
    for label, (b, a) in tiles:
        d.text((GAP, y + 6), f'{label}   [BEFORE | AFTER]', fill=(235, 235, 245))
        y += LAB
        sheet.paste(b, (GAP, y))
        sheet.paste(a, (GAP * 2 + b.width, y))
        y += max(b.height, a.height) + GAP
    sheet.save(out)
    print(out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1:])
