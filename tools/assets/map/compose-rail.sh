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
# how the land beyond the board falls away: DIM is its brightness against the
# painting's (100 = no fall), FADE how wide the step is softened. A pale
# painting wants a gentler fall, or the world reads as a lit rectangle.
DIM=${DIM:-72} FADE=${FADE:-30}
# the painting's own tone, as brightness,saturation, and the ink that suits it:
# LIT=1 lightens ballast and rails for a ground graded down under painted tiles
TONE=${TONE:-100,100}
if [[ ${LIT:-0} == 1 ]]; then
  BALLAST='rgba(150,138,110,0.55)' SLEEPER='rgba(20,16,10,0.60)' RAIL_WIDE='rgba(224,220,202,0.55)' RAIL_FINE='rgba(236,232,214,0.75)'
else
  BALLAST='rgba(72,66,52,0.45)' SLEEPER='rgba(24,20,14,0.55)' RAIL_WIDE='rgba(176,170,150,0.42)' RAIL_FINE='rgba(72,66,52,0.8)'
fi
FW=$((WW + 2 * BX)) FH=$((WH + 2 * BY))
SW=$(magick identify -format %w "$SRC") SH=$(magick identify -format %h "$SRC")
# 1. the painting centred in the frame: margins to mirror on each side
LX=$(( (FW - SW) / 2 )) RX=$(( FW - SW - LX ))
TY=$(( (FH - SH) / 2 )) BYY=$(( FH - SH - TY ))
[[ $LX -ge 0 && $TY -ge 0 && $LX -le $SW && $TY -le $SH ]] || { echo "painting $SWx$SH does not fit the frame"; exit 1; }
magick \( "$SRC" -crop "${LX}x${SH}+0+0" +repage -flop \) "$SRC" \( "$SRC" -crop "${RX}x${SH}+$((SW - RX))+0" +repage -flop \) +append "$T/row.png"
magick \( "$T/row.png" -crop "${FW}x${TY}+0+0" +repage -flip \) "$T/row.png" \( "$T/row.png" -crop "${FW}x${BYY}+0+$((SH - BYY))" +repage -flip \) -append "$T/mirror.png"
#    the mirrored land is only distance: blurred and darkened, so a bright
#    mill at the painting's edge does not come back as a kaleidoscope
magick -size ${SW}x${SH} xc:white -bordercolor black -border 1 -gravity center -background black -extent ${FW}x${FH} -blur 0x${FADE} -negate "$T/outside.png"
magick "$T/mirror.png" \( +clone -blur 0x14 -modulate ${DIM},80 \) "$T/outside.png" -compose over -composite "$T/full.png"
# 2. railways engraved along every rail route: a soft embankment blurred
#    into the land, a thin umber ballast in the painting's own palette,
#    dark sleepers, two fine rails catching a little light — quiet enough
#    to read as painted, even with the board's own traces hidden.
DRAW=$(python3 - "$GEO" "$BX" "$BY" <<'PY'
import json, sys
g = json.load(open(sys.argv[1])); bx, by = int(sys.argv[2]), int(sys.argv[3])
out = []
for l in g['links']:
    if not l['rail']: continue
    pts = ' '.join(f'{x + bx:.1f},{y + by:.1f}' for x, y in (l.get('railPts') or l['pts']))
    out.append(f'polyline {pts}')
print('\n'.join(out))
PY
)
magick -size ${FW}x${FH} xc:none -fill none -stroke 'rgba(14,12,8,0.30)' -strokewidth 16 -draw "$DRAW" -channel RGBA -blur 0x4 +channel "$T/bank.png"
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke "$BALLAST" -strokewidth 7 -draw "$DRAW" \
  -stroke "$SLEEPER" -strokewidth 6.5 -draw "stroke-dasharray 1.6 4.4 $DRAW" \
  -stroke "$RAIL_WIDE" -strokewidth 3.4 -draw "$DRAW" \
  -stroke "$RAIL_FINE" -strokewidth 1.6 -draw "$DRAW" \
  -channel RGBA -blur 0x0.4 +channel "$T/track.png"
if [[ "${BEDS:-1}" == 0 ]]; then cp "$T/full.png" "$T/rails.png"; else magick "$T/full.png" "$T/bank.png" -compose over -composite "$T/track.png" -compose over -composite "$T/rails.png"; fi
# 3. mist past the play area only, so the far edges read as distance
magick -size $((WW + 80))x$((WH + 80)) xc:black -gravity center -background white -extent ${FW}x${FH} -blur 0x110 -evaluate multiply 0.45 "$T/mask.png"
magick -size ${FW}x${FH} xc:'rgb(150,170,160)' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/mist.png"
magick "$T/rails.png" "$T/mist.png" -compose over -composite -modulate 84,112 -modulate ${TONE} "$T/out.png"
magick "$T/out.png" -quality 82 "app/public/$STEM.webp"
echo "$STEM.webp: $(du -h "app/public/$STEM.webp" | cut -f1) from ${SW}x${SH}"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
