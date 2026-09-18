#!/usr/bin/env bash
# The woodcut tile set (ImageMagick 7): six Midjourney engravings, black ink
# on cream, become the board's faces in app/public/tiles-woodcut:
#   tile-<ind>-cut.png       the drawing on a cream label (empty slots, HUD)
#   tile-<ind>-<colour>.png  the same drawing, near-black, on the owner's colour
#   tile-combo-<a>-<b>.png   a dual slot: the two drawings side by side on one label
# The ink is lifted from the paper by luminance, trimmed, and fitted to the
# same box for every industry so the six read at one size on the board.
# Usage, from the repository root: tools/assets/tiles-woodcut/build.sh
set -euo pipefail
SRC=tools/assets/tiles-woodcut OUT=app/public/tiles-woodcut
T=${WORK:-$(mktemp -d)}; mkdir -p "$T" "$OUT"
CREAM='#EDE4CF' INK='#1C1610'
declare -A COL=([brass]='#C9A45C' [oxblood]='#9E3B30' [verdigris]='#3F7A55' [steel]='#4E6E8E')
INDS="coal iron cotton manufacture pottery brewery"

# 1. the ink of each drawing, alpha only, trimmed and fitted into 440 of 512
for ind in $INDS; do
  magick "$SRC/$ind-midjourney.jpg" -resize 1024x1024 -colorspace gray -negate -level 28%,72% "$T/$ind-mask.png"
  geo=$(magick "$T/$ind-mask.png" -threshold 45% -format '%@' info:)
  magick "$T/$ind-mask.png" -crop "$geo" +repage -resize 440x440 -background black -gravity center -extent 512x512 "$T/$ind-fit.png"
  magick -size 512x512 xc:"$INK" "$T/$ind-fit.png" -alpha off -compose CopyOpacity -composite "$T/$ind-ink.png"
done
# 2. the label: cream, rounded like the card, the ink on it
label() { magick -size 512x512 xc:none -fill "$CREAM" -draw "roundrectangle 0,0 511,511 40,40" "$@"; }
for ind in $INDS; do
  label "$T/$ind-ink.png" -compose over -composite "$OUT/tile-$ind-cut.png"
  for c in "${!COL[@]}"; do
    magick -size 512x512 xc:"${COL[$c]}" \( "$T/$ind-ink.png" -channel A -evaluate multiply 0.9 +channel \) -compose over -composite "$OUT/tile-$ind-$c.png"
  done
done
# 3. the dual slots printed on the board, sorted file stems as the board names them
for pair in coal-manufacture cotton-manufacture coal-cotton brewery-manufacture brewery-cotton iron-manufacture iron-pottery brewery-iron; do
  a=${pair%-*} b=${pair#*-}
  magick "$T/$a-ink.png" -resize 232x452 -background none -gravity center -extent 232x452 "$T/pa.png"
  magick "$T/$b-ink.png" -resize 232x452 -background none -gravity center -extent 232x452 "$T/pb.png"
  label "$T/pa.png" -geometry +18+30 -composite "$T/pb.png" -geometry +262+30 -composite \
    -fill none -stroke 'rgba(28,22,16,0.35)' -strokewidth 2 -draw "line 256,60 256,452" "$OUT/tile-combo-$pair.png"
done
echo "$(ls "$OUT" | wc -l) faces in $OUT"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
