#!/usr/bin/env bash
# The rail-era background from the Midjourney painting (ImageMagick 7):
#   painting scaled to cover the 3200×1800 world, a 15 % mirrored bleed on
#   every side (4160×2340, same frame as the canal map), rail beds engraved
#   from the real routes, mist in the far edges, served as WebP.
# Usage, from the repository root:
#   tools/assets/map/compose-rail.sh <painting.png> <geo.json>
# geo.json comes from tools/map/geo.ts (see tools/map/README.md).
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
# 3. rail embankments along every rail route: a soft dark band, blurred
#    into the land — the board draws the rails themselves
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
magick -size 4160x2340 xc:none -fill none -stroke 'rgba(12,10,8,0.22)' -strokewidth 14 -draw "$DRAW" -channel RGBA -blur 0x5 +channel "$T/beds.png"
magick "$T/full.png" "$T/beds.png" -compose over -composite "$T/rails.png"
# 4. mist past the play area only, so the far edges read as distance:
#    the mask is black over the world, white in the bleed, blurred across
magick -size $((WW + 80))x$((WH + 80)) xc:black -gravity center -background white -extent 4160x2340 -blur 0x110 -evaluate multiply 0.45 "$T/mask.png"
magick -size 4160x2340 xc:'rgb(150,170,160)' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/mist.png"
magick "$T/rails.png" "$T/mist.png" -compose over -composite -modulate 84,112 "$T/out.png"
magick "$T/out.png" -quality 82 app/public/map-era-rail.webp
cp "$T/out.png" "$T/../map-era-rail-preview.png" 2>/dev/null || true
echo "map-era-rail.webp: $(du -h app/public/map-era-rail.webp | cut -f1)"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
