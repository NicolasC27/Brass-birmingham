#!/usr/bin/env bash
# The board grounds as a period engraved map (ImageMagick 7): a laid cream
# sheet with the plate mark at the world's edge, the real geometry engraved
# in sepia ink — canal beds with a towpath, the future rails as survey
# lines, merchant basins — form lines and woods on the free
# land only. The Rail Era is the same sheet yellowed and sooted, rails as
# black-and-white ladders. Writes app/public/map-engraved-{canal,rail}.webp.
# Usage, from the repository root:
#   tools/assets/map/compose-engraved.sh <geo.json>
# geo.json comes from tools/map/geo.ts (see tools/map/README.md).
set -euo pipefail
GEO=$1; T=${WORK:-$(mktemp -d)}; mkdir -p "$T"
WW=3200 WH=1800 BX=480 BY=270; FW=$((WW + 2 * BX)) FH=$((WH + 2 * BY))
python3 tools/map/engrave.py "$GEO" "$T"
D() { cat "$T/$1"; }
INK='rgba(74,58,40'

# 1. the sheet: laid paper, a soft mottle, foxing, the plate mark at the world's edge
magick -size ${FW}x${FH} xc:'#E4D7B5' \
  \( -size ${FW}x${FH} plasma:fractal -blur 0x0.6 -colorspace gray -auto-level +level 88%,100% \) -compose multiply -composite \
  \( -size $((FW/8))x$((FH/8)) plasma:fractal -resize 800% -blur 0x40 -colorspace gray -auto-level +level 93%,100% \) -compose multiply -composite \
  "$T/paper.png"
# the margin beyond the board a shade darker, like the mount, and the plate mark
magick -size ${WW}x${WH} xc:white -bordercolor black -border 1 -gravity center -background black -extent ${FW}x${FH} -blur 0x2 "$T/plate.png"
magick "$T/paper.png" \( +clone -fill '#C9BB98' -colorize 28 \) "$T/plate.png" -compose over -composite \
  -fill none -stroke "$INK,0.55)" -strokewidth 3 -draw "rectangle $((BX-14)),$((BY-14)) $((FW-BX+14)),$((FH-BY+14))" \
  -stroke "$INK,0.45)" -strokewidth 1 -draw "rectangle $((BX-6)),$((BY-6)) $((FW-BX+6)),$((FH-BY+6))" \
  "$T/sheet.png"

# 2. the land: hachured hills and engraved woods
magick -background none -size ${FW}x${FH} "mvg:$T/hachures.mvg" "$T/hills.png"
magick -background none -size ${FW}x${FH} "mvg:$T/woods.mvg" "$T/woods.png"

# 3. waterways and roads, engraved: canal = a pale wash between two ink lines, a towpath dotted alongside
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke 'rgba(122,150,140,0.50)' -strokewidth 10 -draw "$(D canal.txt)" \
  -stroke 'rgba(200,214,204,0.55)' -strokewidth 3 -draw "$(D canal.txt)" \
  -stroke "$INK,0.85)" -strokewidth 1.6 -draw "$(D canal.txt)" \
  -stroke "$INK,0.55)" -strokewidth 1.2 -draw "stroke-dasharray 2 7 $(D towpath.txt)" \
  "$T/canals.png"
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke "$INK,0.55)" -strokewidth 1.4 -draw "stroke-dasharray 9 6 $(D road.txt)" \
  "$T/roads.png"
# merchant basins
magick -size ${FW}x${FH} xc:none -fill 'rgba(122,150,140,0.40)' -stroke none -draw "$(D basin-inner.txt)" \
  -fill none -stroke "$INK,0.55)" -strokewidth 0.9 -draw "$(D basin-hatch.txt)" \
  -stroke "$INK,0.9)" -strokewidth 2.2 -draw "$(D basin-outer.txt)" \
  -stroke "$INK,0.9)" -strokewidth 1 -draw "$(D basin-inner.txt)" "$T/basins.png"

# 4. canal era
magick "$T/sheet.png" "$T/hills.png" -compose over -composite "$T/woods.png" -compose over -composite \
  "$T/roads.png" -compose over -composite "$T/canals.png" -compose over -composite \
  "$T/basins.png" -compose over -composite "$T/canal.png"

# 5. rail era: the same sheet, older and dirtier — foxed, smoke-darkened at
#    the edges, a soot haze and coal dust over the big towns; the canals
#    fade to second rank, the survey lines become rails
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke 'rgba(30,24,18,0.80)' -strokewidth 7 -draw "stroke-dasharray 1.4 5.6 $(D rail.txt)" \
  -stroke 'rgba(30,24,18,0.92)' -strokewidth 4.6 -draw "$(D rail.txt)" \
  -stroke 'rgba(200,188,156,0.95)' -strokewidth 2 -draw "$(D rail.txt)" \
  "$T/rails.png"
magick -size ${FW}x${FH} xc:none -stroke none -fill 'rgba(40,32,26,0.16)' -draw "$(D soot.txt)" -channel RGBA -blur 0x100 +channel "$T/soot.png"
magick -size ${FW}x${FH} xc:none -stroke none -fill 'rgba(36,28,20,0.32)' -draw "$(D dust.txt)" "$T/dust.png"
#    the old sheet: a touch of ochre, faint foxing, the edges smoke-darkened
magick -size $((FW/8))x$((FH/8)) plasma:fractal -resize 800% -blur 0x12 -colorspace gray -auto-level -level 60%,100% +level 91%,100% "$T/foxing.png"
magick -size ${FW}x${FH} radial-gradient:white-'rgb(196,186,166)' -blur 0x60 "$T/edge.png"
magick "$T/sheet.png" -fill '#C8AC74' -colorize 14 -modulate 97,94 "$T/foxing.png" -compose multiply -composite "$T/edge.png" -compose multiply -composite "$T/sheet-rail.png"
magick "$T/sheet-rail.png" "$T/hills.png" -compose over -composite "$T/woods.png" -compose over -composite \
  \( "$T/canals.png" -channel A -evaluate multiply 0.55 +channel \) -compose over -composite \
  "$T/basins.png" -compose over -composite \
  "$T/soot.png" -compose multiply -composite \
  "$T/rails.png" -compose over -composite \
  "$T/dust.png" -compose over -composite "$T/rail.png"
magick "$T/canal.png" -quality 85 app/public/map-engraved-canal.webp
magick "$T/rail.png" -quality 85 app/public/map-engraved-rail.webp
echo "map-engraved-canal.webp $(du -h app/public/map-engraved-canal.webp | cut -f1), map-engraved-rail.webp $(du -h app/public/map-engraved-rail.webp | cut -f1)"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
