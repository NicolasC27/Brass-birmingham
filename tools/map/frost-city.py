#!/usr/bin/env python3
"""The frozen city's two paintings, assembled (ImageMagick 7).

A model asked for a city paints one where it likes; the board needs a
settlement under every town and nowhere else. So the city is put together
by hand: ring settlements cut from one painting and laid, each through a
soft disc, on the wasteland of another — one under every town, a depot
under every merchant, at the places the board shows them (places.ts). The
rail era is the same sheet a generation on: the snow greyed, soot drifting
down and right of every settlement, the furnaces lit inside the rings.

Usage, from the repository root:
  tools/map/frost-city.py <rings.jpg> <waste.jpg> <places.json> <canal.png> <rail.png>
rings and waste are 4032x2304, as the upscaler leaves them; the paintings
come out at that size, for compose-canal.sh and compose-rail.sh.
"""
import json, os, subprocess, sys, tempfile

RINGS, WASTE, PLACES, CANAL, RAIL = sys.argv[1:6]
W, H = 4032, 2304
# the painting covers the 3200x1800 world in width; the height overflows, centred
K = W / 3200
OY = (H - 1800 * K) / 2
PX = lambda wx: wx * K
PY = lambda wy: wy * K + OY
# the settlements worth cutting, and the depots, as (x, y[, radius]) on the
# rings painting at 1400 px wide — the ones standing clear of their neighbours
VIEW = W / 1400
RING_AT = [(290, 460), (1058, 152), (920, 85), (713, 80), (425, 665), (985, 668), (460, 103), (922, 202)]
DEPOT_AT = [(1032, 348, 78), (345, 262, 62)]
T = tempfile.mkdtemp()


def run(*a):
    subprocess.run(['magick', *map(str, a)], check=True)


def cut(name, cx, cy, r_in, r_out):
    """a sprite through a soft disc: whole to r_in, gone at r_out"""
    R = int(r_out * VIEW) + 4
    ri, ro = r_in * VIEW, r_out * VIEW
    run(RINGS, '-crop', f'{2 * R}x{2 * R}+{int(cx * VIEW) - R}+{int(cy * VIEW) - R}', '+repage',
        '(', '-size', f'{2 * R}x{2 * R}', 'xc:black', '-fill', 'white', '-draw', f'circle {R},{R} {R + (ri + ro) / 2:.1f},{R}', '-blur', f'0x{(ro - ri) / 4:.1f}', ')',
        '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', f'{T}/{name}.png')
    return 2 * R


ring_w = [cut(f'ring{i}', x, y, 58, 74) for i, (x, y) in enumerate(RING_AT)]
depot_w = [cut(f'depot{i}', x, y, r - 22, r) for i, (x, y, r) in enumerate(DEPOT_AT)]
p = json.load(open(PLACES))


def lay(cmd, sprite, width, k, wx, wy):
    w = width * k
    cmd += ['(', f'{T}/{sprite}.png', '-resize', f'{k * 100:.0f}%', ')', '-geometry', f'+{PX(wx) - w / 2:.0f}+{PY(wy) - w / 2:.0f}', '-compose', 'over', '-composite']


cmd = [WASTE, '-gravity', 'NorthWest']
# the farms first, then the towns from the top of the sheet down
for i, t in enumerate(sorted(p['towns'], key=lambda t: (not t['farm'], t['y']))):
    k = 0.58 if t['farm'] else (0.92 if t['slots'] >= 3 else 0.82)
    n = (sum(map(ord, t['id'])) + i) % len(RING_AT)
    lay(cmd, f'ring{n}', ring_w[n], k, t['x'], t['y'])
for i, m in enumerate(p['merchants']):
    n = i % len(DEPOT_AT)
    lay(cmd, f'depot{n}', depot_w[n], 0.8, m['x'], m['y'])
run(*cmd, CANAL)

# the rail era: soot down and right of every place, the furnaces lit in the rings
soot, glow = [], []
for t in p['towns']:
    x, y = PX(t['x']), PY(t['y'])
    r, g = (120, 70) if t['farm'] else (210, 125)
    soot.append(f'circle {x + 50:.0f},{y + 50:.0f} {x + 50 + r:.0f},{y + 50:.0f}')
    glow.append(f'circle {x:.0f},{y:.0f} {x + g:.0f},{y:.0f}')
for m in p['merchants']:
    x, y = PX(m['x']), PY(m['y'])
    soot.append(f'circle {x + 40:.0f},{y + 40:.0f} {x + 170:.0f},{y + 40:.0f}')
size = f'{W}x{H}'
run('-size', size, 'xc:black', '-fill', 'white', '-stroke', 'none', '-draw', '\n'.join(soot), '-blur', '0x80', '-level', '0%,70%', f'{T}/soot-mask.png')
run('-seed', 7, '-size', f'{W // 8}x{H // 8}', 'plasma:fractal', '-colorspace', 'gray', '-auto-level', '-resize', f'{size}!', '-motion-blur', '0x90+45', '-auto-level', '-level', '25%,85%', f'{T}/soot-noise.png')
run(f'{T}/soot-mask.png', f'{T}/soot-noise.png', '-compose', 'multiply', '-composite', '-evaluate', 'multiply', 0.62, f'{T}/soot-a.png')
run('-size', size, 'xc:rgb(16,14,14)', f'{T}/soot-a.png', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', f'{T}/soot.png')
run('-size', size, 'xc:black', '-fill', 'rgb(255,128,40)', '-stroke', 'none', '-draw', '\n'.join(glow), '-blur', '0x55', '-evaluate', 'multiply', 0.42, f'{T}/glow.png')
run(CANAL, '-modulate', '92,78', '-fill', 'rgb(70,62,58)', '-colorize', 10, f'{T}/soot.png', '-compose', 'over', '-composite', f'{T}/glow.png', '-compose', 'screen', '-composite', RAIL)
for f in os.listdir(T):
    os.remove(f'{T}/{f}')
os.rmdir(T)
print(f'{CANAL}, {RAIL}: {len(p["towns"])} settlements, {len(p["merchants"])} depots')
