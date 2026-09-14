#!/usr/bin/env python3
"""Rail routes that follow the relief of the rail-era painting.

For every link that can carry rails, a least-cost path is traced across a
grey rendering of the painting (world space, 1/4 scale): crossing a sharp
change of tone (a ridge, a wood's edge, the rim of the mist) costs more,
so the line hugs valleys and contours instead of cutting straight; it keeps
clear of every third town and stays in a corridor around the chord. The
path is then smoothed and resampled, and written as TypeScript for the
board (the game draws its rail links on it) and as JSON for the map
compositor (which engraves the very same line).

Usage: rail-routes.py <terrain.pgm 800x450> <geo.json> <out.ts> <out.json>
"""
import heapq, json, math, sys

pgm, geo_path, out_ts, out_json = sys.argv[1:5]
SCALE = 4  # world px per grid cell
with open(pgm, 'rb') as f:
    assert f.readline().strip() == b'P5'
    line = f.readline()
    while line.startswith(b'#'):
        line = f.readline()
    W, H = map(int, line.split())
    assert int(f.readline()) == 255
    lum = list(f.read(W * H))
geo = json.load(open(geo_path))
nodes = {t['id']: (t['x'], t['y']) for t in geo['towns']}
nodes.update({m['id']: (m['x'], m['y']) for m in geo['merchants']})

# tone gradient, softened (3x3 box twice), then the per-cell base cost
def at(x, y):
    return lum[min(H - 1, max(0, y)) * W + min(W - 1, max(0, x))]
grad = [0.0] * (W * H)
for y in range(H):
    for x in range(W):
        gx = at(x + 1, y) - at(x - 1, y)
        gy = at(x, y + 1) - at(x, y - 1)
        grad[y * W + x] = math.hypot(gx, gy)
for _ in range(2):
    nxt = [0.0] * (W * H)
    for y in range(H):
        for x in range(W):
            s = 0.0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    s += grad[min(H - 1, max(0, y + dy)) * W + min(W - 1, max(0, x + dx))]
            nxt[y * W + x] = s / 9
    grad = nxt
gmax = max(grad) or 1
# the painting itself covers the world's middle; the mirrored margins are dear
PAINT = (128 // SCALE, 76 // SCALE, 3072 // SCALE, 1724 // SCALE)
# a slow, deterministic swell in the cost so a flat stretch of land still
# bends the line a little instead of ruling it along the grid
def swell(x, y):
    return (math.sin(x * 0.071 + 1.3) * math.cos(y * 0.053 + 0.4) + math.sin((x + y) * 0.037 + 2.1) * 0.7 + math.cos(x * 0.023 - y * 0.041 + 0.9) * 0.5) / 2.2
base = [0.0] * (W * H)
for y in range(H):
    for x in range(W):
        c = 1.0 + 9.0 * (grad[y * W + x] / gmax) + 1.6 * (1 + swell(x, y))
        if not (PAINT[0] <= x < PAINT[2] and PAINT[1] <= y < PAINT[3]):
            c += 30
        base[y * W + x] = c

def route(a, b, avoid):
    ax, ay = a[0] / SCALE, a[1] / SCALE
    bx, by = b[0] / SCALE, b[1] / SCALE
    chord = math.hypot(bx - ax, by - ay) or 1
    corridor = 0.32 * chord + 18
    ux, uy = (bx - ax) / chord, (by - ay) / chord
    def extra(x, y):
        # distance from the chord, and from every third node
        d = abs((x - ax) * uy - (y - ay) * ux)
        along = (x - ax) * ux + (y - ay) * uy
        if along < -10 or along > chord + 10:
            d = max(d, min(math.hypot(x - ax, y - ay), math.hypot(x - bx, y - by)))
        pen = 0.0 if d < corridor else (d - corridor) * 1.5
        for (nx, ny) in avoid:
            dn = math.hypot(x - nx / SCALE, y - ny / SCALE)
            if dn < 110 / SCALE:
                pen += 60
        return pen
    start = (round(ax), round(ay)); goal = (round(bx), round(by))
    dist = {start: 0.0}; prev = {}
    pq = [(0.0, start)]
    while pq:
        d, (x, y) = heapq.heappop(pq)
        if (x, y) == goal:
            break
        if d > dist.get((x, y), 1e18):
            continue
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= W or ny >= H:
                    continue
                step = math.hypot(dx, dy)
                nd = d + step * (base[ny * W + nx] + taken[ny * W + nx] + extra(nx, ny))
                if nd < dist.get((nx, ny), 1e18):
                    dist[(nx, ny)] = nd; prev[(nx, ny)] = (x, y)
                    heapq.heappush(pq, (nd, (nx, ny)))
    path = [goal]
    while path[-1] != start:
        path.append(prev[path[-1]])
    path.reverse()
    pts = [(x * SCALE, y * SCALE) for x, y in path]
    pts[0] = a; pts[-1] = b
    return pts

def smooth(pts, passes=4, win=6):
    for _ in range(passes):
        out = [pts[0]]
        for i in range(1, len(pts) - 1):
            lo, hi = max(0, i - win), min(len(pts), i + win + 1)
            out.append((sum(p[0] for p in pts[lo:hi]) / (hi - lo), sum(p[1] for p in pts[lo:hi]) / (hi - lo)))
        out.append(pts[-1])
        pts = out
    return pts

def resample(pts, n=40):
    seg = [math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1)]
    total = sum(seg) or 1
    out = []
    for k in range(n):
        t = total * k / (n - 1); i = 0
        while i < len(seg) - 1 and t > seg[i]:
            t -= seg[i]; i += 1
        f = t / seg[i] if seg[i] else 0
        out.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f))
    return out

# two lines sharing a valley is one line to the eye: ground already taken by
# a traced route costs more for the next (short links first, so the long
# ones bend around them) — except close to the towns, where lines must meet
taken = [0.0] * (W * H)
def claim(pts, a, b):
    for x, y in pts:
        cx, cy = round(x / SCALE), round(y / SCALE)
        if min(math.hypot(x - a[0], y - a[1]), math.hypot(x - b[0], y - b[1])) < 110:
            continue
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < W and 0 <= ny < H and dx * dx + dy * dy <= 16:
                    taken[ny * W + nx] = 7.0
routes = {}
order = sorted((l for l in geo['links'] if l['rail']), key=lambda l: math.hypot(l['pts'][-1][0] - l['pts'][0][0], l['pts'][-1][1] - l['pts'][0][1]))
for l in order:
    a, b = tuple(l['pts'][0]), tuple(l['pts'][-1])
    ends = {l['id'].split('--')[0], l['id'].split('--')[1]}
    avoid = [p for nid, p in nodes.items() if nid not in ends]
    pts = resample(smooth(route(a, b, avoid)))
    claim(pts, a, b)
    routes[l['id']] = [[round(x), round(y)] for x, y in pts]

ts = ['/* generated by tools/map/rail-routes.py — the rail routes traced on the',
      ' * relief of the rail-era painting; do not edit by hand */',
      'export const RAIL_ROUTES: Record<string, [number, number][]> = {']
for k, v in routes.items():
    ts.append(f"  '{k}': [{', '.join(f'[{x}, {y}]' for x, y in v)}],")
ts.append('};')
open(out_ts, 'w').write('\n'.join(ts) + '\n')
json.dump(routes, open(out_json, 'w'))
print('routes', len(routes))
