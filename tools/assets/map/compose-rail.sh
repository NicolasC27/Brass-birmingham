#!/usr/bin/env bash
# The rail-era background from the Midjourney painting (ImageMagick 7):
#   painting scaled to cover the 3200×1800 world, a 15 % mirrored bleed on
#   every side (4160×2340, same frame as the canal map), rail beds engraved
#   from the real routes, mist in the far edges, served as WebP.
# Usage, from the repository root:
#   tools/assets/map/compose-rail.sh <painting.png> <geo.json>
# geo.json comes from tools/map/geo.ts (see tools/map/README.md).
# BEDS=0 skips the embankments (a painting that already carries the rails).
set -euo pipefail
SRC=$1 GEO=$2
T=${WORK:-$(mktemp -d)}
mkdir -p "$T"
WW=3200 WH=1800 BX=480 BY=270
# 1. cover the world
magick "$SRC" -resize "${WW}x${WH}^" -gravity center -extent "${WW}x${WH}" "$T/core.png"
# 2. mirrored bleed: the countryside continues past the play area
magick \( "$T/core.png" -crop "${BX}x${WH}+0+0" +repage -flop \) "$T/core.png" \( "$T/core.png" -crop "${BX}x${WH}+$((WW - BX))+0" +repage -flop \) +append "$T/row.png"
magick \( "$T/row.png" -crop "$((WW + 2 * BX))x${BY}+0+0" +repage -flip \) "$T/row.png" \( "$T/row.png" -crop "$((WW + 2 * BX))x${BY}+0+$((WH - BY))" +repage -flip \) -append "$T/full.png"
# 3. rail beds engraved along every rail route, like the canal beds of the
#    canal map: a cinder embankment blurred into the land, sleepers, and the
#    two steel rails catching the light. The board draws its own links on
#    top, so this stays quiet.
DRAW=$(python3 - "$GEO" "$BX" "$BY" <<'PY'
import json, sys
g = json.load(open(sys.argv[1])); bx, by = int(sys.argv[2]), int(sys.argv[3])
out = []
for l in g['links']:
    if not l['rail']: continue
    pts = ' '.join(f'{x + bx:.1f},{y + by:.1f}' for x, y in l['pts'])
    out.append(f'polyline {pts}')
print('\n'.join(out))
PY
)
magick -size 4160x2340 xc:none -fill none -stroke 'rgba(14,11,8,0.34)' -strokewidth 20 -draw "$DRAW" -channel RGBA -blur 0x4 +channel "$T/bank.png"
magick -size 4160x2340 xc:none -fill none \
  -stroke 'rgba(96,84,66,0.38)' -strokewidth 9 -draw "$DRAW" \
  -stroke 'rgba(28,22,16,0.45)' -strokewidth 10 -draw "stroke-dasharray 2.5 8 $DRAW" \
  -stroke 'rgba(214,206,186,0.4)' -strokewidth 5 -draw "$DRAW" \
  -stroke 'rgba(70,60,48,0.55)' -strokewidth 3 -draw "$DRAW" \
  -channel RGBA -blur 0x0.6 +channel "$T/track.png"
if [[ "${BEDS:-1}" == 0 ]]; then cp "$T/full.png" "$T/rails.png"; else magick "$T/full.png" "$T/bank.png" -compose over -composite "$T/track.png" -compose over -composite "$T/rails.png"; fi
# 4. mist past the play area only, so the far edges read as distance:
#    the mask is black over the world, white in the bleed, blurred across
magick -size $((WW + 80))x$((WH + 80)) xc:black -gravity center -background white -extent 4160x2340 -blur 0x110 -evaluate multiply 0.45 "$T/mask.png"
magick -size 4160x2340 xc:'rgb(150,170,160)' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/mist.png"
magick "$T/rails.png" "$T/mist.png" -compose over -composite -modulate 84,112 "$T/out.png"
magick "$T/out.png" -quality 82 app/public/map-era-rail.webp
cp "$T/out.png" "$T/../map-era-rail-preview.png" 2>/dev/null || true
echo "map-era-rail.webp: $(du -h app/public/map-era-rail.webp | cut -f1)"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
