#!/usr/bin/env python3
"""Set a keyed drawing of a place on its cleared ground.

    tools/assets/map/anchor-place.py <cut.png> <app/public/name.webp> [feet.json]

The cut is the drawing alone, the magenta keyed off and the canvas trimmed
(see tools/map/README.md, "Anchoring a place"). It is centred on a square
with room under it, a soft disc of bare earth laid at its feet, and served
at 768×768, with its soft silhouette beside it (<name>-shadow.webp) for
the board to lay down as its shadow. No shadow is baked in: the board casts one at play time, shaped
by the ground under each town, so the drawing's foot must be known — where
it stands on the square, as fractions of the side — and that is appended to
feet.json under the served name.
"""
import json, os, subprocess, sys

cut, out = sys.argv[1], sys.argv[2]
feet = sys.argv[3] if len(sys.argv) > 3 else None
w, h = [int(x) for x in subprocess.run(['magick', cut, '-format', '%wx%h', 'info:'], capture_output=True, text=True, check=True).stdout.split('x')]
side = int(max(w, h) * 1.28)
ox, oy = (side - w) // 2, int((side - h) * 0.40)
bx, by = ox + w // 2, oy + int(h * 0.86)
rx, ry = int(w * 0.50), int(h * 0.13)
subprocess.run(['magick', '-size', f'{side}x{side}', 'xc:none',
    # the cleared ground the place stands on
    '-fill', 'rgba(204,186,148,0.50)', '-stroke', 'none', '-draw', f'ellipse {bx},{by} {int(rx*1.24)},{int(ry*1.5)} 0,360',
    '-blur', f'0x{max(8, ry//2)}',
    '(', cut, ')', '-geometry', f'+{ox}+{oy}', '-compose', 'over', '-composite',
    '-resize', '768x768!', '-quality', '88', out], check=True)
# the drawing's silhouette, soft-edged, on the same square: the board lays
# it flat and stretches it down the slope as the shadow the place throws.
# Read back off the served picture, its ground (never above half alpha)
# thresholded away so only the buildings cast.
subprocess.run(['magick', out, '-alpha', 'extract', '-threshold', '55%', '-blur', '0x4', '-level', '0%,60%', '-write', 'mpr:mask', '+delete',
    '-size', '768x768', 'xc:rgb(30,22,14)', 'mpr:mask', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    '-resize', '384x384!', '-quality', '80', os.path.splitext(out)[0] + '-shadow.webp'], check=True)
if feet:
    table = json.load(open(feet)) if os.path.exists(feet) else {}
    name = os.path.splitext(os.path.basename(out))[0]
    table[name] = [round(bx / side, 3), round(by / side, 3), round(rx / side, 3), round(ry / side, 3)]
    json.dump(table, open(feet, 'w'), indent=1, sort_keys=True)
print(f'{os.path.basename(out)}: {w}x{h} on {side}, foot at {bx/side:.2f},{by/side:.2f}')
