#!/usr/bin/env python3
"""The ground under each place, read off the painted terrain.

    tools/map/place-ground.py <geo.json> <board id> <feet.json> <canal.webp> <rail.webp>

Writes app/src/gl/placeGround.ts: the foot of every served drawing (from
anchor-place.py) and, for the board, how the land lies where each town's
and merchant's shadow falls. The terrain model is lit from over the
reader's left shoulder, so a slope that descends towards the lower right
— where the shadows go — reads dark, and one that climbs reads light. The
shade is the painting's own brightness there against its surroundings, both
eras averaged, scaled so the steepest place on the board is ±1: below zero
the shadow lengthens down the slope, above it shortens against the rise.
"""
import json, subprocess, sys

geo, board, feet, canal, rail = sys.argv[1:6]
g = json.load(open(geo))
BX, BY, K = 480, 270, 8  # bleed, and the scale the paintings are read at

def raster(path, blur):
    p = subprocess.run(['magick', path, '-colorspace', 'gray', '-resize', f'{100 / K}%', '-blur', f'0x{blur}', '-depth', '8', 'gray:-'],
                       capture_output=True, check=True).stdout
    w = int(subprocess.run(['magick', path, '-format', '%w', 'info:'], capture_output=True, text=True, check=True).stdout) // K
    return p, w

def read(r, x, y):
    data, w = r
    i = max(0, min(len(data) - 1, int(y) * w + int(x)))
    return data[i]

rasters = [(raster(p, 3), raster(p, 28)) for p in (canal, rail)]
spots = [(t['id'], t['x'], t['y'], t['farm']) for t in g['towns']] + [(m['id'], m['x'], m['y'], False) for m in g['merchants']]
raw = {}
for id, x, y, farm in spots:
    # where the shadow lands: below the cards, off to the right
    sx, sy = (x + BX + 60) / K, (y + BY + (90 if farm else 130)) / K
    raw[id] = sum(read(near, sx, sy) - read(wide, sx, sy) for near, wide in rasters) / (255 * len(rasters))
# scaled to the towns: a merchant sits in the mirrored bleed, whose seam
# can read as a cliff
top = max(abs(raw[t['id']]) for t in g['towns']) or 1
shade = {id: round(max(-1, min(1, v / top)), 2) for id, v in raw.items()}
ft = json.load(open(feet))
lines = ['/* written by tools/map/place-ground.py from the served drawings and the',
         '   relief paintings — run it again when either changes; do not edit */', '',
         '/** where a served drawing stands on its square: foot centre and the',
         ' *  half-axes of its ground, as fractions of the side */',
         'export const FEET: Record<string, [number, number, number, number]> = {']
lines += [f"  '{k}': [{', '.join(str(v) for v in ft[k])}]," for k in sorted(ft)]
lines += ['};', '',
          '/** how the land lies where each place\'s shadow falls, per board:',
          ' *  -1 a slope falling away down and right, +1 one climbing, 0 level */',
          'export const SHADE: Record<string, Record<string, number>> = {', f"  {board}: {{"]
lines += [f"    '{id}': {shade[id]}," for id in shade]
lines += ['  },', '};', '']
open('app/src/gl/placeGround.ts', 'w').write('\n'.join(lines))
print(f'{board}: {len(shade)} places, raw span ±{top:.3f}')
