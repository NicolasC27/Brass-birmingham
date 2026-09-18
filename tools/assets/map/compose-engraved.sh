#!/usr/bin/env bash
# The board grounds as a period engraved map (ImageMagick 7): a laid cream
# sheet with the plate mark at the world's edge, the real geometry engraved
# in sepia ink — canal beds with a towpath, the future rails as survey
# lines, an engraved hamlet under each town, merchant basins — form lines and woods on the free
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
# the hamlets under the towns (ink vignettes, 360 px wide, a touch lighter than the map's ink)
VIG=""
while read -r k cx cy; do
  magick "tools/assets/map/vignettes/town-$k.png" -resize 360x -channel A -evaluate multiply 0.8 +channel "$T/vig-$k.png"
  w=$(magick identify -format %w "$T/vig-$k.png"); h=$(magick identify -format %h "$T/vig-$k.png")
  VIG="$VIG $T/vig-$k.png -geometry +$((cx - w / 2))+$((cy - h / 2)) -composite"
done < "$T/vignettes.txt"
magick -size ${FW}x${FH} xc:none $VIG "$T/towns.png"
# merchant basins
magick -size ${FW}x${FH} xc:none -fill 'rgba(122,150,140,0.40)' -stroke none -draw "$(D basin-inner.txt)" \
  -fill none -stroke "$INK,0.55)" -strokewidth 0.9 -draw "$(D basin-hatch.txt)" \
  -stroke "$INK,0.9)" -strokewidth 2.2 -draw "$(D basin-outer.txt)" \
  -stroke "$INK,0.9)" -strokewidth 1 -draw "$(D basin-inner.txt)" "$T/basins.png"

# 4. canal era
magick "$T/sheet.png" "$T/hills.png" -compose over -composite "$T/woods.png" -compose over -composite \
  "$T/roads.png" -compose over -composite "$T/canals.png" -compose over -composite \
  "$T/towns.png" -compose over -composite "$T/basins.png" -compose over -composite "$T/canal.png"

# 5. rail era: the same sheet yellowed and sooted, rails in black ink, smoke over the towns
magick -size ${FW}x${FH} xc:none -fill none \
  -stroke 'rgba(30,24,18,0.85)' -strokewidth 5.6 -draw "stroke-dasharray 1.3 5.7 $(D rail.txt)" \
  -stroke 'rgba(30,24,18,0.92)' -strokewidth 3.8 -draw "$(D rail.txt)" \
  -stroke 'rgba(200,188,156,0.95)' -strokewidth 1.8 -draw "$(D rail.txt)" \
  "$T/rails.png"
magick -size ${FW}x${FH} xc:none -stroke none -fill 'rgba(40,32,26,0.20)' -draw "$(D soot.txt)" -channel RGBA -blur 0x110 +channel "$T/soot.png"
magick -size ${FW}x${FH} xc:none -stroke none -fill 'rgba(70,66,60,0.22)' -draw "$(D smoke.txt)" -channel RGBA -blur 0x40 +channel "$T/smoke.png"
magick "$T/canal.png" -fill '#C8B283' -colorize 22 -modulate 90,88 \
  "$T/soot.png" -compose multiply -composite \
  "$T/rails.png" -compose over -composite \
  "$T/smoke.png" -compose over -composite "$T/rail.png"
magick "$T/canal.png" -quality 85 app/public/map-engraved-canal.webp
magick "$T/rail.png" -quality 85 app/public/map-engraved-rail.webp
echo "map-engraved-canal.webp $(du -h app/public/map-engraved-canal.webp | cut -f1), map-engraved-rail.webp $(du -h app/public/map-engraved-rail.webp | cut -f1)"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
