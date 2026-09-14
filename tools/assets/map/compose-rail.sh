#!/usr/bin/env bash
# A rail-era background from a Midjourney painting (ImageMagick 7):
#   the painting keeps its own pixels (never resampled), centred on the
#   3200×1800 world; what the world and the 15 % bleed need beyond it is
#   mirrored from its edges (4160×2340, the canal map's frame); rail beds
#   engraved from the real routes; mist in the far edges; served as WebP.
# Usage, from the repository root:
#   tools/assets/map/compose-rail.sh <painting.png> <geo.json> [stem]
# geo.json comes from tools/map/geo.ts (see tools/map/README.md); stem
# defaults to map-era-rail (app/public/<stem>.webp).
# BEDS=0 skips the engraving (a painting that already carries the rails).
set -euo pipefail
SRC=$1 GEO=$2 STEM=${3:-map-era-rail}
T=${WORK:-$(mktemp -d)}
mkdir -p "$T"
WW=3200 WH=1800 BX=480 BY=270
FW=$((WW + 2 * BX)) FH=$((WH + 2 * BY))
SW=$(magick identify -format %w "$SRC") SH=$(magick identify -format %h "$SRC")
# 1. the painting centred in the frame: margins to mirror on each side
LX=$(( (FW - SW) / 2 )) RX=$(( FW - SW - LX ))
TY=$(( (FH - SH) / 2 )) BYY=$(( FH - SH - TY ))
[[ $LX -ge 0 && $TY -ge 0 && $LX -le $SW && $TY -le $SH ]] || { echo "painting $SWx$SH does not fit the frame"; exit 1; }
magick \( "$SRC" -crop "${LX}x${SH}+0+0" +repage -flop \) "$SRC" \( "$SRC" -crop "${RX}x${SH}+$((SW - RX))+0" +repage -flop \) +append "$T/row.png"
magick \( "$T/row.png" -crop "${FW}x${TY}+0+0" +repage -flip \) "$T/row.png" \( "$T/row.png" -crop "${FW}x${BYY}+0+$((SH - BYY))" +repage -flip \) -append "$T/full.png"
# 2. rail beds engraved along every rail route, like the canal beds of the
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
magick -size ${FW}x${FH} xc:none -fill none -stroke 'rgba(14,11,8,0.34)' -strokewidth 20 -draw "$DRAW" -channel RGBA -blur 0x4 +channel "$T/bank.png"
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke 'rgba(96,84,66,0.38)' -strokewidth 9 -draw "$DRAW" \
  -stroke 'rgba(28,22,16,0.45)' -strokewidth 10 -draw "stroke-dasharray 2.5 8 $DRAW" \
  -stroke 'rgba(214,206,186,0.4)' -strokewidth 5 -draw "$DRAW" \
  -stroke 'rgba(70,60,48,0.55)' -strokewidth 3 -draw "$DRAW" \
  -channel RGBA -blur 0x0.6 +channel "$T/track.png"
if [[ "${BEDS:-1}" == 0 ]]; then cp "$T/full.png" "$T/rails.png"; else magick "$T/full.png" "$T/bank.png" -compose over -composite "$T/track.png" -compose over -composite "$T/rails.png"; fi
# 3. mist past the play area only, so the far edges read as distance
magick -size $((WW + 80))x$((WH + 80)) xc:black -gravity center -background white -extent ${FW}x${FH} -blur 0x110 -evaluate multiply 0.45 "$T/mask.png"
magick -size ${FW}x${FH} xc:'rgb(150,170,160)' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/mist.png"
magick "$T/rails.png" "$T/mist.png" -compose over -composite -modulate 84,112 "$T/out.png"
magick "$T/out.png" -quality 82 "app/public/$STEM.webp"
echo "$STEM.webp: $(du -h "app/public/$STEM.webp" | cut -f1) from ${SW}x${SH}"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
