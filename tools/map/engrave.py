"""Engraved board map — the draw lists ImageMagick engraves from geo.json:
form lines and woods on the free land, canal beds, survey lines, village
blocks, merchant basins, the rail ladders, the soot of the Rail Era.
usage: engrave.py <geo.json> <workdir>   (called by compose-engraved.sh)"""
import json, math, random, sys
g = json.load(open(sys.argv[1])); out = sys.argv[2]
BX, BY, WW, WH = 480, 270, 3200, 1800
FW, FH = WW + 2 * BX, WH + 2 * BY
X = lambda x: x + BX
Y = lambda y: y + BY
rng = random.Random(7)

# ---------- value noise (pure python) ----------
def make_noise(seed, cell):
    r = random.Random(seed); gw, gh = FW // cell + 2, FH // cell + 2
    grid = [[r.random() for _ in range(gw)] for _ in range(gh)]
    def n(x, y):
        fx, fy = x / cell, y / cell; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
        a, b = grid[iy][ix], grid[iy][ix + 1]; c, d = grid[iy + 1][ix], grid[iy + 1][ix + 1]
        return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    return n
n1, n2, n3 = make_noise(1, 420), make_noise(2, 170), make_noise(3, 90)
def height(x, y): return 0.6 * n1(x, y) + 0.3 * n2(x, y) + 0.1 * n3(x, y)
w1, w2 = make_noise(11, 260), make_noise(12, 70)
def wood(x, y): return 0.7 * w1(x, y) + 0.3 * w2(x, y)

# ---------- keep-clear mask: towns, merchants, every link ----------
def seg_d(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy or 1
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - ax - dx * t, py - ay - dy * t)
links = [[(X(x), Y(y)) for x, y in l['pts']] for l in g['links']]
towns = [(X(t['x']), Y(t['y']), 200 if not t['farm'] else 120) for t in g['towns']]
merch = [(X(m['x']), Y(m['y'])) for m in g['merchants']]
def clear(x, y):
    """1 = free land, 0 = under the board's furniture"""
    v = 1.0
    for tx, ty, r in towns:
        d = math.hypot(x - tx, y - ty)
        if d < r: return 0.0
        if d < r + 90: v = min(v, (d - r) / 90)
    for mx, my in merch:
        d = math.hypot(x - mx, y - my)
        if d < 150: return 0.0
        if d < 230: v = min(v, (d - 150) / 80)
    for pts in links:
        for i in range(len(pts) - 1):
            d = seg_d(x, y, *pts[i], *pts[i + 1])
            if d < 48: return 0.0
            if d < 110: v = min(v, (d - 48) / 62)
    return v
inside = lambda x, y: BX - 40 <= x <= FW - BX + 40 and BY - 40 <= y <= FH - BY + 40

# ---------- hachures: short downslope strokes where the land tilts ----------
hach = []
step = 20
for gy in range(0, FH, step):
    for gx in range(0, FW, step):
        x, y = gx + rng.uniform(-6, 6), gy + rng.uniform(-6, 6)
        if not inside(x, y): continue
        e = 6
        gxv = (height(x + e, y) - height(x - e, y)) / (2 * e)
        gyv = (height(x, y + e) - height(x, y - e)) / (2 * e)
        s = math.hypot(gxv, gyv) * 1000
        if s < 0.55: continue
        c = clear(x, y)
        if c <= 0.05: continue
        a = min(0.5, (s - 0.55) * 0.45 + 0.10) * c
        L = 10 + min(10, s * 4); ang = math.atan2(gyv, gxv) + math.pi / 2
        dx, dy = math.cos(ang) * L / 2, math.sin(ang) * L / 2
        hach.append(f"fill none stroke 'rgba(74,58,40,{a:.2f})' line {x - dx:.1f},{y - dy:.1f} {x + dx:.1f},{y + dy:.1f}")
open(f'{out}/hachures.mvg', 'w').write(f'viewbox 0 0 {FW} {FH}\nstroke-width 1\n' + '\n'.join(hach))

# ---------- woods: little engraved tree glyphs in the darker blots ----------
trees = []
step = 13
for gy in range(0, FH, step):
    for gx in range(0, FW, step):
        x, y = gx + rng.uniform(-6, 6), gy + rng.uniform(-6, 6)
        if not inside(x, y): continue
        wv = wood(x, y)
        if wv < 0.62: continue
        if rng.random() > (wv - 0.62) * 7: continue
        c = clear(x, y)
        if c <= 0.1: continue
        r = 2.8 + rng.random() * 1.6
        trees.append(f"stroke 'rgba(74,58,40,{0.7*c:.2f})' fill 'rgba(150,140,110,{0.35*c:.2f})' ellipse {x:.1f},{y:.1f} {r:.1f},{r*0.85:.1f} 0,360")
        trees.append(f"stroke 'rgba(74,58,40,{0.7*c:.2f})' fill none line {x:.1f},{y + r*0.6:.1f} {x:.1f},{y + r*0.85 + 2.2:.1f}")
open(f'{out}/woods.mvg', 'w').write(f'viewbox 0 0 {FW} {FH}\nstroke-width 0.9\n' + '\n'.join(trees))

# ---------- the geometry ----------
def poly(pts, dx=0, dy=0): return 'polyline ' + ' '.join(f'{X(x) + dx:.1f},{Y(y) + dy:.1f}' for x, y in pts)
open(f'{out}/canal.txt', 'w').write('\n'.join(poly(l['pts']) for l in g['links'] if l['canal']))
open(f'{out}/towpath.txt', 'w').write('\n'.join(poly(l['pts'], 8, 8) for l in g['links'] if l['canal']))
open(f'{out}/road.txt', 'w').write('\n'.join(poly(l['pts']) for l in g['links'] if not l['canal']))
open(f'{out}/rail.txt', 'w').write('\n'.join(poly(l.get('railPts') or l['pts']) for l in g['links'] if l['rail']))

# village grounds: the county-map cluster of tiny black blocks, a hatched ring
blocks, rings, soot, smoke = [], [], [], []
for t in g['towns']:
    cx, cy = X(t['x']), Y(t['y']); r = 40 if t['farm'] else 66
    for _ in range(10 if t['farm'] else 34):
        a = rng.random() * math.tau; d = math.sqrt(rng.random()) * r
        w, h = 3 + rng.random() * 4, 2.4 + rng.random() * 2.6; rot = rng.random() * 180
        blocks.append(f'push graphic-context translate {cx + math.cos(a) * d:.1f},{cy + math.sin(a) * d:.1f} rotate {rot:.1f} rectangle {-w/2:.1f},{-h/2:.1f} {w/2:.1f},{h/2:.1f} pop graphic-context')
    rings.append(f'circle {cx},{cy} {cx + r + 14},{cy}')
    if not t['farm']:
        soot.append(f'circle {cx},{cy} {cx + 210},{cy}')
        for _ in range(3):
            a = rng.random() * math.tau; d = 60 + rng.random() * 140
            smoke.append(f'ellipse {cx + math.cos(a) * d:.1f},{cy + math.sin(a) * d:.1f} {50 + rng.random()*60:.0f},{18 + rng.random()*20:.0f} 0,360')
open(f'{out}/blocks.txt', 'w').write('\n'.join(blocks))
open(f'{out}/rings.txt', 'w').write('\n'.join(rings))
open(f'{out}/soot.txt', 'w').write('\n'.join(soot))
open(f'{out}/smoke.txt', 'w').write('\n'.join(smoke))
# merchant basins: a stone ring, water hatched inside
open(f'{out}/basin-outer.txt', 'w').write('\n'.join(f'circle {x},{y} {x + 76},{y}' for x, y in merch))
open(f'{out}/basin-inner.txt', 'w').write('\n'.join(f'circle {x},{y} {x + 64},{y}' for x, y in merch))
hatch = []
for x, y in merch:
    for k in range(-60, 61, 7):
        hw = math.sqrt(max(0, 62 * 62 - k * k))
        hatch.append(f'line {x - hw:.1f},{y + k} {x + hw:.1f},{y + k}')
open(f'{out}/basin-hatch.txt', 'w').write('\n'.join(hatch))
print('hachures', len(hach), 'trees', len(trees) // 2)
