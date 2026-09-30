#!/usr/bin/env bash
# A canal-era background from a Midjourney painting (ImageMagick 7), the
# sibling of compose-rail.sh: the painting keeps its own pixels, centred on
# the 3200×1800 world, the 15 % bleed mirrored from its edges (4160×2340);
# graded flat so the board's tiles keep the light; then the real geometry
# engraved on top — canal beds with a towpath, the future rail lines as
# cart roads, village grounds, merchant basins — and mist in the far edges.
# Usage, from the repository root:
#   tools/assets/map/compose-canal.sh <painting.png> <geo.json> [stem]
# geo.json comes from tools/map/geo.ts (see tools/map/README.md); stem
# defaults to map-era-canal (app/public/<stem>.webp).
set -euo pipefail
IN=$1 GEO=$2 STEM=${3:-map-era-canal}
T=${WORK:-$(mktemp -d)}
mkdir -p "$T"
WW=3200 WH=1800 BX=480 BY=270
# how the land beyond the board falls away: DIM is its brightness against the
# painting's (100 = no fall), FADE how wide the step is softened. A pale
# painting wants a gentler fall, or the world reads as a lit rectangle.
DIM=${DIM:-72} FADE=${FADE:-30}
FW=$((WW + 2 * BX)) FH=$((WH + 2 * BY))
# 0. a painting smaller than the world is brought up to cover it (a Midjourney
#    2× upscale is 2912×1632, a tenth short), so nothing mirrored or blurred
#    lies inside the play area
SRC=$T/src.png
magick "$IN" -resize "${WW}x${WH}^" -gravity center -extent "${WW}x${WH}" "$SRC"
SW=$(magick identify -format %w "$SRC") SH=$(magick identify -format %h "$SRC")
# 1. the painting centred in the frame: margins to mirror on each side
LX=$(( (FW - SW) / 2 )) RX=$(( FW - SW - LX ))
TY=$(( (FH - SH) / 2 )) BYY=$(( FH - SH - TY ))
[[ $LX -ge 0 && $TY -ge 0 && $LX -le $SW && $TY -le $SH ]] || { echo "painting $SWx$SH does not fit the frame"; exit 1; }
magick \( "$SRC" -crop "${LX}x${SH}+0+0" +repage -flop \) "$SRC" \( "$SRC" -crop "${RX}x${SH}+$((SW - RX))+0" +repage -flop \) +append "$T/row.png"
magick \( "$T/row.png" -crop "${FW}x${TY}+0+0" +repage -flip \) "$T/row.png" \( "$T/row.png" -crop "${FW}x${BYY}+0+$((SH - BYY))" +repage -flip \) -append "$T/mirror.png"
#    the mirrored land is only distance: blurred and darkened
magick -size ${SW}x${SH} xc:white -bordercolor black -border 1 -gravity center -background black -extent ${FW}x${FH} -blur 0x${FADE} -negate "$T/outside.png"
magick "$T/mirror.png" \( +clone -blur 0x14 -modulate ${DIM},80 \) "$T/outside.png" -compose over -composite "$T/full.png"
# 2. the grade: the painting's bleached clearings pulled back into the land
#    (whites capped, the blacks untouched) and a breath of grey-green, so
#    the parchment tiles stay the brightest thing on the table
magick "$T/full.png" -level 0%,108% -modulate 100,92 -fill 'rgb(118,138,126)' -colorize 3 "$T/graded.png"
# 3. the geometry, drawn by python from geo.json (world → frame offset)
python3 - "$GEO" "$BX" "$BY" "$T" <<'PY'
import json, math, sys
g = json.load(open(sys.argv[1])); bx, by, t = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
def poly(pts, dx=0, dy=0): return 'polyline ' + ' '.join(f'{x + bx + dx:.1f},{y + by + dy:.1f}' for x, y in pts)
canal = [poly(l['pts']) for l in g['links'] if l['canal']]
tow = [poly(l['pts'], 9, 9) for l in g['links'] if l['canal']]
road = [poly(l['pts']) for l in g['links'] if not l['canal']]
open(f'{t}/canal.txt', 'w').write('\n'.join(canal))
open(f'{t}/towpath.txt', 'w').write('\n'.join(tow))
open(f'{t}/road.txt', 'w').write('\n'.join(road))
# village grounds: a soft dusty patch, cobble specks, two outbuildings
x = 11
def rnd():
    global x
    x ^= (x << 13) & 0xffffffff; x ^= x >> 17; x ^= (x << 5) & 0xffffffff
    return x / 4294967296
patch, specks, houses, roofs, shade = [], [], [], [], []
for tn in g['towns']:
    cx, cy = tn['x'] + bx, tn['y'] + by
    r = 60 if tn['farm'] else 105
    patch.append(f'circle {cx},{cy} {cx + r * 0.62:.1f},{cy}')
    for _ in range(30 if tn['farm'] else 140):
        a = rnd() * math.tau; d = math.sqrt(rnd()) * r * 0.78
        px, py = cx + math.cos(a) * d, cy + math.sin(a) * d
        specks.append((rnd() < 0.5, f'rectangle {px:.1f},{py:.1f} {px + 2.6:.1f},{py + 2.6:.1f}'))
    if not tn['farm']:
        for _ in range(2):
            a = rnd() * math.tau; d = r * (0.55 + rnd() * 0.35); w = 12 + rnd() * 12; h = 8 + rnd() * 7
            hx, hy, rot = cx + math.cos(a) * d, cy + math.sin(a) * d, rnd() * 180
            ctx = f'push graphic-context translate {hx:.1f},{hy:.1f} rotate {rot:.1f} '
            shade.append(ctx + f'rectangle {-w/2+2:.1f},{-h/2+3:.1f} {w/2+2:.1f},{h/2+3:.1f} pop graphic-context')
            houses.append(ctx + f'rectangle {-w/2:.1f},{-h/2:.1f} {w/2:.1f},{h/2:.1f} pop graphic-context')
            roofs.append(ctx + f'rectangle {-w/2:.1f},{-h/2:.1f} {w/2:.1f},{-h/2 + h*0.45:.1f} pop graphic-context')
open(f'{t}/patch.txt', 'w').write('\n'.join(patch))
open(f'{t}/specks-light.txt', 'w').write('\n'.join(s for light, s in specks if light))
open(f'{t}/specks-dark.txt', 'w').write('\n'.join(s for light, s in specks if not light))
open(f'{t}/shade.txt', 'w').write('\n'.join(shade))
open(f'{t}/houses.txt', 'w').write('\n'.join(houses))
open(f'{t}/roofs.txt', 'w').write('\n'.join(roofs))
# merchant basins: a wide dark pool and a stone edge
open(f'{t}/basin.txt', 'w').write('\n'.join(f"circle {m['x'] + bx},{m['y'] + by} {m['x'] + bx + 70},{m['y'] + by}" for m in g['merchants']))
open(f'{t}/edge.txt', 'w').write('\n'.join(f"circle {m['x'] + bx},{m['y'] + by} {m['x'] + bx + 62},{m['y'] + by}" for m in g['merchants']))
PY
# 4. canal beds: a dug channel with earthen banks, a towpath on one side,
#    still water with a lighter thread down the middle and faint ripples
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke 'rgba(60,50,30,0.22)' -strokewidth 30 -draw "$(cat "$T/canal.txt")" \
  -stroke 'rgba(22,30,20,0.55)' -strokewidth 20 -draw "$(cat "$T/canal.txt")" \
  -stroke 'rgba(34,62,60,0.72)' -strokewidth 11 -draw "$(cat "$T/canal.txt")" \
  -stroke 'rgba(78,122,118,0.42)' -strokewidth 5 -draw "$(cat "$T/canal.txt")" \
  -stroke 'rgba(230,240,230,0.28)' -strokewidth 1.4 -draw "stroke-dasharray 3 26 $(cat "$T/canal.txt")" \
  -stroke 'rgba(214,196,150,0.42)' -strokewidth 2.2 -draw "stroke-dasharray 12 10 $(cat "$T/towpath.txt")" \
  "$T/beds.png"
# 5. rail-only lines: cart roads today, surveyed for rails tomorrow
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke 'rgba(70,56,38,0.28)' -strokewidth 7 -draw "$(cat "$T/road.txt")" \
  -stroke 'rgba(206,186,140,0.34)' -strokewidth 3 -draw "$(cat "$T/road.txt")" \
  "$T/roads.png"
# 6. village grounds and merchant basins
magick -size ${FW}x${FH} xc:none -stroke none -fill 'rgba(90,72,50,0.6)' -draw "$(cat "$T/patch.txt")" -channel RGBA -blur 0x26 +channel "$T/patch.png"
magick -size ${FW}x${FH} xc:none -stroke none \
  -fill 'rgba(150,128,98,0.45)' -draw "$(cat "$T/specks-light.txt")" \
  -fill 'rgba(36,28,20,0.5)' -draw "$(cat "$T/specks-dark.txt")" \
  -fill 'rgba(0,0,0,0.35)' -draw "$(cat "$T/shade.txt")" \
  -fill 'rgba(104,72,58,0.85)' -draw "$(cat "$T/houses.txt")" \
  -fill 'rgba(255,220,180,0.18)' -draw "$(cat "$T/roofs.txt")" \
  "$T/village.png"
magick -size ${FW}x${FH} xc:none -stroke none -fill 'rgba(34,62,60,0.8)' -draw "$(cat "$T/basin.txt")" -channel RGBA -blur 0x30 +channel \
  -fill none -stroke 'rgba(210,196,160,0.5)' -strokewidth 4 -draw "$(cat "$T/edge.txt")" "$T/basin.png"
magick "$T/graded.png" "$T/roads.png" -compose over -composite "$T/beds.png" -compose over -composite \
  "$T/patch.png" -compose over -composite "$T/village.png" -compose over -composite "$T/basin.png" -compose over -composite "$T/land.png"
# 7. mist past the play area only, so the far edges read as distance
magick -size $((WW + 80))x$((WH + 80)) xc:black -gravity center -background white -extent ${FW}x${FH} -blur 0x110 -evaluate multiply 0.45 "$T/mask.png"
magick -size ${FW}x${FH} xc:'rgb(150,170,160)' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/mist.png"
magick "$T/land.png" "$T/mist.png" -compose over -composite "$T/out.png"
magick "$T/out.png" -quality 82 "app/public/$STEM.webp"
echo "$STEM.webp: $(du -h "app/public/$STEM.webp" | cut -f1) from ${SW}x${SH}"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
