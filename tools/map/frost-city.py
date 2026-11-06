#!/usr/bin/env python3
"""The frozen city's two paintings, assembled (ImageMagick 7).

A model asked for a city paints one where it likes; the board needs a
settlement under every town and nowhere else, and a town wants its own:
Burton its brewhouse, Stoke its bottle kilns, Cannock its pit and spoil
heap. So the model is asked for three sheets of settlements, nine to a
sheet, each named by its trade and no two alike in footprint — round,
oval, a crescent, a walled square, a scattered hamlet, a row along one
street — and the city is put together by hand: every settlement cut from
its sheet through a soft ellipse and laid on an empty snowfield under the
town that trades as it does, sized to the town's cards; a depot under
every merchant; at the places the board shows them (places.ts). The rail
era is the same sheet a generation on: soot on the walls, drifting down
and right, and the lamps and furnace doors lit in every settlement.

Usage, from the repository root:
  tools/map/frost-city.py <sheet-a.jpg> <sheet-b.jpg> <sheet-c.jpg> <snow.jpg> <places.json> <canal.png> <rail.png>
The sheets and the snow are 4032x2304, as the upscaler leaves them; the
paintings come out at that size, for compose-canal.sh and compose-rail.sh.
"""
import json, math, os, subprocess, sys, tempfile

SHEET_A, SHEET_B, SHEET_C, SNOW, PLACES, CANAL, RAIL = sys.argv[1:8]
SHEETS = {'a': SHEET_A, 'b': SHEET_B, 'c': SHEET_C}
W, H = 4032, 2304
# the painting covers the 3200x1800 world in width; the height overflows, centred
K = W / 3200
OY = (H - 1800 * K) / 2
PX = lambda wx: wx * K
PY = lambda wy: wy * K + OY
# every settlement on the sheets, as (sheet, centre x, centre y, half
# width, half height) at 1400 px wide, read off the sheets by eye
VIEW = W / 1400
SPRITES = {
    # sheet a: five cotton-mill towns, four colliery villages
    'mill-ring': ('a', 375, 155, 100, 100),
    'mill-oval': ('a', 700, 155, 120, 95),
    'mill-crescent': ('a', 1000, 150, 115, 85),
    'mill-walled': ('a', 360, 390, 105, 95),
    'mill-row': ('a', 690, 590, 170, 150),
    'pit-hamlet': ('a', 682, 380, 128, 80),
    'pit-heap': ('a', 995, 405, 115, 95),
    'pit-dome': ('a', 330, 630, 140, 85),
    'pit-heap-2': ('a', 985, 640, 115, 100),
    # sheet b: five manufacturing towns, two ironworks, two farmsteads
    'works-ring': ('b', 405, 155, 120, 115),
    'works-oblong': ('b', 695, 145, 110, 80),
    'works-crescent': ('b', 975, 160, 110, 85),
    'works-walled': ('b', 415, 415, 112, 110),
    'works-hamlet': ('b', 690, 405, 115, 100),
    'furnace': ('b', 965, 405, 125, 70),
    'furnace-2': ('b', 410, 645, 115, 60),
    'farm': ('b', 690, 655, 95, 70),
    'farm-2': ('b', 970, 655, 95, 70),
    # sheet c: three brewery towns, the potteries, five depots
    'brew-tower': ('c', 395, 160, 120, 105),
    'brew-crescent': ('c', 715, 150, 120, 85),
    'brew-walled': ('c', 1020, 170, 112, 100),
    'kilns': ('c', 405, 405, 130, 110),
    'depot-rail': ('c', 730, 390, 130, 65),
    'depot-tank': ('c', 1015, 400, 115, 65),
    'depot-heap': ('c', 390, 650, 140, 75),
    'depot-yard': ('c', 710, 640, 95, 105),
    'depot-sheds': ('c', 1000, 640, 135, 105),
}
# a town's settlement: the trade it is known for, in a footprint of its own
TOWN = {
    'belper': 'mill-ring', 'derby': 'mill-oval', 'leek': 'mill-crescent', 'worcester': 'mill-walled', 'kidderminster': 'mill-row',
    'nuneaton': 'pit-hamlet', 'cannock': 'pit-heap', 'dudley': 'pit-dome', 'tamworth': 'pit-heap-2',
    'birmingham': 'works-ring', 'wolverhampton': 'works-oblong', 'walsall': 'works-crescent', 'coventry': 'works-walled', 'stafford': 'works-hamlet',
    'coalbrookdale': 'furnace', 'redditch': 'furnace-2', 'farm-n': 'farm', 'farm-s': 'farm-2',
    'burton': 'brew-tower', 'uttoxeter': 'brew-crescent', 'stone': 'brew-walled', 'stoke': 'kilns',
}
MERCHANT = {'m-warrington': 'depot-rail', 'm-nottingham': 'depot-tank', 'm-shrewsbury': 'depot-heap', 'm-oxford': 'depot-yard', 'm-gloucester': 'depot-sheds'}
# a settlement's width across, in pixels of the painting, for a town's
# cards: a farm's one, two in a row, a block of three or four; a depot's
ACROSS = {1: 250, 2: 310, 3: 350, 4: 400}
FARM_ACROSS = 190
DEPOT_ACROSS = 260
# the ellipse's soft edge, at 1400 px wide
FEATHER = 10
T = tempfile.mkdtemp()


def run(*a):
    subprocess.run(['magick', *map(str, a)], check=True)


def cut(name, tone):
    """a sprite through a soft ellipse; the walls' highlights pressed down
    so no roof outshines a card. Returns its width across, in pixels"""
    sheet, cx, cy, hw, hh = SPRITES[name]
    pad = FEATHER + 4
    X, Y = int((cx - hw - pad) * VIEW), int((cy - hh - pad) * VIEW)
    w, h = int(2 * (hw + pad) * VIEW), int(2 * (hh + pad) * VIEW)
    ex, ey = (hw + FEATHER / 2) * VIEW, (hh + FEATHER / 2) * VIEW
    run(SHEETS[sheet], '-crop', f'{w}x{h}+{X}+{Y}', '+repage',
        *(['-channel', 'RGB', '-function', 'polynomial', '-0.25,1.05,0', '+channel'] if tone else []),
        '(', '-size', f'{w}x{h}', 'xc:black', '-fill', 'white', '-draw', f'ellipse {w / 2:.1f},{h / 2:.1f} {ex:.1f},{ey:.1f} 0,360', '-blur', f'0x{FEATHER * VIEW / 4:.1f}', ')',
        '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', f'{T}/{name}.png')
    return w, h


size_of = {n: cut(n, not n.startswith('depot')) for n in SPRITES}
p = json.load(open(PLACES))
towns = p['towns']


def fit(name, across):
    """the scale that brings a sprite to `across` pixels over its longer side"""
    w, h = size_of[name]
    sheet, cx, cy, hw, hh = SPRITES[name]
    return across / (2 * max(hw, hh) * VIEW)


def lay(cmd, name, k, wx, wy):
    w, h = size_of[name]
    cmd += ['(', f'{T}/{name}.png', '-resize', f'{k * 100:.1f}%', ')', '-geometry', f'+{PX(wx) - w * k / 2:.0f}+{PY(wy) - h * k / 2:.0f}', '-compose', 'over', '-composite']


def across(t):
    return FARM_ACROSS if t['farm'] else ACROSS[min(4, max(1, t['slots']))]


cmd = [SNOW, '-gravity', 'NorthWest']
# the farms first, then the towns from the top of the sheet down
for t in sorted(towns, key=lambda t: (not t['farm'], t['y'])):
    n = TOWN[t['id']]
    lay(cmd, n, fit(n, across(t)), t['x'], t['y'])
for m in p['merchants']:
    n = MERCHANT[m['id']]
    lay(cmd, n, fit(n, DEPOT_ACROSS), m['x'], m['y'])
run(*cmd, CANAL)


def h(s):
    v = 7
    for ch in s:
        v = (v * 31 + ord(ch)) & 0xffffffff
    return v


# the rail era: soot on the walls of every settlement, drifting down and
# right, and the lamps lit — a furnace door at the inner edge of the
# houses and a few windows round it, never under the cards
soot, hole, lamps, doors = [], [], [], []
for t in towns:
    x, y = PX(t['x']), PY(t['y'])
    n = TOWN[t['id']]
    k = fit(n, across(t))
    sheet, cx, cy, hw, hh = SPRITES[n]
    rx, ry = hw * VIEW * k, hh * VIEW * k
    soot.append(f'ellipse {x + 0.25 * rx:.0f},{y + 0.25 * ry:.0f} {rx * 1.15:.0f},{ry * 1.15:.0f} 0,360')
    hole.append(f'ellipse {x:.0f},{y:.0f} {rx * 0.5:.0f},{ry * 0.5:.0f} 0,360')
    seed = h(t['id'] + ' lamps')
    a0 = (seed % 360) * math.pi / 180
    doors.append(f'circle {x + math.cos(a0) * 0.78 * rx:.0f},{y + math.sin(a0) * 0.78 * ry:.0f} {x + math.cos(a0) * 0.78 * rx + 9:.0f},{y + math.sin(a0) * 0.78 * ry:.0f}')
    for i in range(5 if t['farm'] else 7):
        a = a0 + (i + 1) * 0.8 + ((seed >> (i + 2)) % 7) * 0.05
        r = 0.72 + ((seed >> i) % 5) * 0.05
        lamps.append(f'circle {x + math.cos(a) * r * rx:.0f},{y + math.sin(a) * r * ry:.0f} {x + math.cos(a) * r * rx + 5:.0f},{y + math.sin(a) * r * ry:.0f}')
for m in p['merchants']:
    x, y = PX(m['x']), PY(m['y'])
    soot.append(f'circle {x + 40:.0f},{y + 40:.0f} {x + 170:.0f},{y + 40:.0f}')
    lamps.append(f'circle {x + 30:.0f},{y - 20:.0f} {x + 35:.0f},{y - 20:.0f}')
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
print(f'{CANAL}, {RAIL}: {len(towns)} settlements, {len(p["merchants"])} depots')
