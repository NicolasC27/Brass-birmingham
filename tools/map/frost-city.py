#!/usr/bin/env python3
"""The frozen city's two paintings, assembled (ImageMagick 7).

A model asked for a city paints one where it likes; the board needs a
settlement under every town and nowhere else. So the city is put together
by hand: ring settlements cut from one painting and laid, each through a
soft disc, on an empty snowfield — one under every town, sized to its
cards, a depot under every merchant, at the places the board shows them
(places.ts). The walls are held under the cards' own light, and no two
neighbouring towns wear the same ring. The rail era is the same sheet a
generation on: soot on the walls, drifting down and right, and the lamps
and furnace doors lit in every ring.

Usage, from the repository root:
  tools/map/frost-city.py <rings.jpg> <snow.jpg> <places.json> <canal.png> <rail.png>
rings and snow are 4032x2304, as the upscaler leaves them; the paintings
come out at that size, for compose-canal.sh and compose-rail.sh.
"""
import json, math, os, subprocess, sys, tempfile

RINGS, SNOW, PLACES, CANAL, RAIL = sys.argv[1:6]
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
RING_R = 58
DEPOT_AT = [(1032, 348, 78), (345, 262, 62)]
# a ring's size for a town's cards: a farm's one card, two in a row, a
# block of three or four — the houses showing round the cards every time
SCALE = {1: 0.75, 2: 0.82, 3: 0.95, 4: 1.08}
FARM = 0.58
# towns closer than this are neighbours, and never wear the same ring
NEAR = 320
T = tempfile.mkdtemp()


def run(*a):
    subprocess.run(['magick', *map(str, a)], check=True)


def cut(name, cx, cy, r_in, r_out, tone):
    """a sprite through a soft disc: whole to r_in, gone at r_out; the
    walls' highlights pressed down so no roof outshines a card"""
    R = int(r_out * VIEW) + 4
    ri, ro = r_in * VIEW, r_out * VIEW
    run(RINGS, '-crop', f'{2 * R}x{2 * R}+{int(cx * VIEW) - R}+{int(cy * VIEW) - R}', '+repage',
        *(['-channel', 'RGB', '-function', 'polynomial', '-0.25,1.05,0', '+channel'] if tone else []),
        '(', '-size', f'{2 * R}x{2 * R}', 'xc:black', '-fill', 'white', '-draw', f'circle {R},{R} {R + (ri + ro) / 2:.1f},{R}', '-blur', f'0x{(ro - ri) / 4:.1f}', ')',
        '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', f'{T}/{name}.png')
    return 2 * R


ring_w = [cut(f'ring{i}', x, y, RING_R + 1, RING_R + 7, True) for i, (x, y) in enumerate(RING_AT)]
depot_w = [cut(f'depot{i}', x, y, r - 14, r, False) for i, (x, y, r) in enumerate(DEPOT_AT)]
p = json.load(open(PLACES))
towns = p['towns']


def h(s):
    v = 7
    for ch in s:
        v = (v * 31 + ord(ch)) & 0xffffffff
    return v


# each town's ring: its own by hash, the next one along when a neighbour
# already wears it
worn = {}
for t in sorted(towns, key=lambda t: t['id']):
    near = [o['id'] for o in towns if o is not t and math.hypot(o['x'] - t['x'], o['y'] - t['y']) < NEAR]
    n = h(t['id']) % len(RING_AT)
    for _ in range(len(RING_AT)):
        if all(worn.get(o) != n for o in near):
            break
        n = (n + 1) % len(RING_AT)
    worn[t['id']] = n


def lay(cmd, sprite, width, k, wx, wy):
    w = width * k
    cmd += ['(', f'{T}/{sprite}.png', '-resize', f'{k * 100:.0f}%', ')', '-geometry', f'+{PX(wx) - w / 2:.0f}+{PY(wy) - w / 2:.0f}', '-compose', 'over', '-composite']


def scale(t):
    return FARM if t['farm'] else SCALE[min(4, max(1, t['slots']))]


cmd = [SNOW, '-gravity', 'NorthWest']
# the farms first, then the towns from the top of the sheet down
for t in sorted(towns, key=lambda t: (not t['farm'], t['y'])):
    n = worn[t['id']]
    lay(cmd, f'ring{n}', ring_w[n], scale(t), t['x'], t['y'])
for i, m in enumerate(p['merchants']):
    n = i % len(DEPOT_AT)
    lay(cmd, f'depot{n}', depot_w[n], 0.8, m['x'], m['y'])
run(*cmd, CANAL)

# the rail era: soot on the walls of every ring, drifting down and right,
# and the lamps lit — a furnace door at the inner edge of the houses and a
# few windows round it, never under the cards
soot, lamps, doors = [], [], []
for t in towns:
    x, y = PX(t['x']), PY(t['y'])
    R = RING_R * VIEW * scale(t)
    soot.append(f'circle {x + 0.25 * R:.0f},{y + 0.25 * R:.0f} {x + 0.25 * R + R * 1.15:.0f},{y + 0.25 * R:.0f}')
    seed = h(t['id'] + ' lamps')
    a0 = (seed % 360) * math.pi / 180
    doors.append(f'circle {x + math.cos(a0) * 0.78 * R:.0f},{y + math.sin(a0) * 0.78 * R:.0f} {x + math.cos(a0) * 0.78 * R + 9:.0f},{y + math.sin(a0) * 0.78 * R:.0f}')
    for k in range(5 if t['farm'] else 7):
        a = a0 + (k + 1) * 0.8 + ((seed >> (k + 2)) % 7) * 0.05
        r = R * (0.72 + ((seed >> k) % 5) * 0.05)
        lamps.append(f'circle {x + math.cos(a) * r:.0f},{y + math.sin(a) * r:.0f} {x + math.cos(a) * r + 5:.0f},{y + math.sin(a) * r:.0f}')
for m in p['merchants']:
    x, y = PX(m['x']), PY(m['y'])
    soot.append(f'circle {x + 40:.0f},{y + 40:.0f} {x + 170:.0f},{y + 40:.0f}')
    lamps.append(f'circle {x + 30:.0f},{y - 20:.0f} {x + 35:.0f},{y - 20:.0f}')
hole = []
for t in towns:
    x, y = PX(t['x']), PY(t['y'])
    R = RING_R * VIEW * scale(t)
    hole.append(f'circle {x:.0f},{y:.0f} {x + 0.55 * R:.0f},{y:.0f}')
size = f'{W}x{H}'
# the soot: on the walls, not the yards nor the open snow
run('-size', size, 'xc:black', '-fill', 'white', '-stroke', 'none', '-draw', '\n'.join(soot), '-fill', 'black', '-draw', '\n'.join(hole), '-blur', '0x40', '-level', '0%,80%', f'{T}/soot-mask.png')
run('-seed', 7, '-size', f'{W // 8}x{H // 8}', 'plasma:fractal', '-colorspace', 'gray', '-auto-level', '-resize', f'{size}!', '-motion-blur', '0x90+45', '-auto-level', '-level', '25%,85%', f'{T}/soot-noise.png')
run(f'{T}/soot-mask.png', f'{T}/soot-noise.png', '-compose', 'multiply', '-composite', '-evaluate', 'multiply', 0.55, f'{T}/soot-a.png')
run('-size', size, 'xc:rgb(26,27,30)', f'{T}/soot-a.png', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', f'{T}/soot.png')
# the lamps: a warm point each, a little bloom round it
run('-size', size, 'xc:black', '-stroke', 'none', '-fill', 'rgb(255,150,60)', '-draw', '\n'.join(doors), '-fill', 'rgb(255,190,110)', '-draw', '\n'.join(lamps), f'{T}/lamps-raw.png')
run(f'{T}/lamps-raw.png', '(', '+clone', '-blur', '0x14', '-evaluate', 'multiply', 0.9, ')', '-compose', 'screen', '-composite', '-blur', '0x1.2', f'{T}/lamps.png')
run(CANAL, '-modulate', '96,86', f'{T}/soot.png', '-compose', 'over', '-composite', f'{T}/lamps.png', '-compose', 'screen', '-composite', RAIL)
for f in os.listdir(T):
    os.remove(f'{T}/{f}')
os.rmdir(T)
print(f'{CANAL}, {RAIL}: {len(towns)} settlements, {len(p["merchants"])} depots, rings worn {sorted(worn.values())}')
