#!/usr/bin/env bash
# A merchant's sign in the woodcut hand (ImageMagick 7): the Midjourney
# stamp of the town's wharf, black ink lifted from its paper and cleaned
# like the tiles, printed on a cream board in a sepia frame with a double
# rule; a parchment medallion on the right where the board engraves the
# bonus (houses.ts: 0.866, 0.468, r 0.09 of the width); a sepia band at the
# top for the brass nameplate the board screws on. 1280×512, aspect 2.5.
# Usage, from the repository root:
#   [CROP=WxH+X+Y] tools/assets/merchants/build-woodcut-sign.sh <id>   (id: shrewsbury, warrington…)
# reads tools/assets/merchants/wharf-<id>-midjourney.jpg, writes
# app/public/merchant-house-<id>.webp.
set -euo pipefail
ID=$1 SRC=tools/assets/merchants/wharf-$1-midjourney.jpg OUT=app/public/merchant-house-$1.webp
T=${WORK:-$(mktemp -d)}; mkdir -p "$T"
W=1280 H=512 INK='#3C2E20' CREAM='#EDE4CF' PARCH='#DCCFAA'
# the ink, cleaned lightly: specks filled and cleared, cut crisp — a sign is
# three times a tile on screen, its thin white lines (a boat's gunwale, a
# crane's lattice) must survive
# CROP=<WxH+X+Y> cuts inside a border the stamp came with (Warrington)
magick "$SRC" ${CROP:+-crop "$CROP" +repage} -colorspace gray -negate -level 28%,72% "$T/mask.png"
geo=$(magick "$T/mask.png" -morphology Open Disk:3 -threshold 45% -format '%@' info:)
magick "$T/mask.png" -crop "$geo" +repage -statistic Median 3 -morphology Close Disk:2 -morphology Open Disk:2 -threshold 50% -blur 0x1 \
  -resize 840x360 -background black -gravity center -extent 840x360 "$T/fit.png"
magick -size 840x360 xc:"$INK" "$T/fit.png" -alpha off -compose CopyOpacity -composite "$T/ink.png"
# the board: sepia frame, cream field, a double rule; the nameplate band; the medallion
MX=$(python3 -c "print(round(0.866*$W))") MY=$(python3 -c "print(round(0.468*$H))") MR=$(python3 -c "print(round(0.09*$W))")
magick -size ${W}x${H} xc:"$INK" \
  -fill "$CREAM" -draw "roundrectangle 18,18 $((W-19)),$((H-19)) 6,6" \
  -fill none -stroke "$INK" -strokewidth 1.5 -draw "roundrectangle 26,26 $((W-27)),$((H-27)) 4,4" \
  -stroke "$CREAM" -strokewidth 1.2 -draw "roundrectangle 9,9 $((W-10)),$((H-10)) 8,8" \
  -stroke none -fill "$INK" -draw "roundrectangle $((W/2-170)),18 $((W/2+170)),74 0,0" \
  "$T/ink.png" -geometry +56+64 -composite \
  -fill 'rgba(0,0,0,0.18)' -draw "circle $((MX+3)),$((MY+5)) $((MX+3+MR)),$((MY+5))" \
  -fill "$PARCH" -stroke "$INK" -strokewidth 4 -draw "circle $MX,$MY $((MX+MR)),$MY" \
  -fill none -strokewidth 1.5 -draw "circle $MX,$MY $((MX+MR-11)),$MY" \
  -quality 90 "$OUT"
echo "$OUT $(identify -format '%wx%h' "$OUT")"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
