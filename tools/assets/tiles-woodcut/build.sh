#!/usr/bin/env bash
# The woodcut tile set (ImageMagick 7): six Midjourney engravings, black ink
# on cream, become the board's faces in app/public/tiles-woodcut (1024 px WebP):
#   tile-<ind>-cut.webp      the drawing on a cream label, edge to edge (empty slots, HUD)
#   tile-<ind>-<colour>.webp the same drawing, near-black, on the owner's colour
#   tile-combo-<a>-<b>.webp  a dual slot: the front industry low left, its partner
#                            behind, up right, the front's silhouette masking it
# The ink is lifted from the paper by luminance at the source's full size,
# trimmed, and fitted to the same box for every industry so the six read at
# one size on the board.
# Usage, from the repository root: tools/assets/tiles-woodcut/build.sh
set -euo pipefail
SRC=tools/assets/tiles-woodcut OUT=app/public/tiles-woodcut
T=${WORK:-$(mktemp -d)}; mkdir -p "$T" "$OUT"
N=1024 CREAM='#EDE4CF' INK='#1C1610'
declare -A COL=([brass]='#C9A45C' [oxblood]='#9E3B30' [verdigris]='#3F7A55' [steel]='#4E6E8E')
INDS="coal iron cotton manufacture pottery brewery"

# 1. the ink of each drawing (alpha), trimmed to its box at full source size
for ind in $INDS; do
  magick "$SRC/$ind-midjourney.jpg" -resize 2048x2048\> -colorspace gray -negate -level 28%,72% "$T/$ind-mask.png"
  geo=$(magick "$T/$ind-mask.png" -threshold 45% -format '%@' info:)
  # the stamp's grain — ink specks in the blacks, paper specks around —
  # filled and cleared, the edges crisp: flat ink for a hundred-pixel face
  magick "$T/$ind-mask.png" -crop "$geo" +repage -statistic Median 5 -morphology Close Disk:4 -morphology Open Disk:2 -threshold 50% -blur 0x1 "$T/$ind-trim.png"
done
# fit <mask> into a <size> box, centred on an NxN transparent canvas at +x+y, as ink
ink() { # ink <ind> <size> <out> [x y]
  local m="$T/$1-trim.png" s=$2 out=$3 x=${4:-0} y=${5:-0}
  magick "$m" -resize "${s}x${s}" -background black -gravity center -extent "${s}x${s}" \
    -background black -gravity northwest -splice "${x}x${y}" -extent "${N}x${N}" \
    -write mpr:m +delete -size "${N}x${N}" xc:"$INK" mpr:m -alpha off -compose CopyOpacity -composite "$out"
}
label() { magick -size "${N}x${N}" xc:none -fill "$CREAM" -draw "roundrectangle 0,0 $((N-1)),$((N-1)) 80,80" "$@"; }

# 2. singles: the drawing fills the label; the owner's cards
for ind in $INDS; do
  ink "$ind" 1000 "$T/$ind-ink.png" 12 12
  label "$T/$ind-ink.png" -compose over -composite -quality 92 "$OUT/tile-$ind-cut.webp"
  for c in "${!COL[@]}"; do
    magick -size "${N}x${N}" xc:"${COL[$c]}" \( "$T/$ind-ink.png" -channel A -evaluate multiply 0.9 +channel \) -compose over -composite -quality 92 "$OUT/tile-$ind-$c.webp"
  done
done

# 3. dual slots: the front industry (brewery, then coal, then goods, then the
#    rest — faces.ts FRONT_RANK) low left at 74 %, the partner behind it up
#    right at 62 %, hidden where the front's silhouette, widened a little, lies
rank() { case $1 in brewery) echo 0;; coal) echo 1;; manufacture) echo 2;; *) echo 3;; esac; }
for pair in coal-manufacture cotton-manufacture coal-cotton brewery-manufacture brewery-cotton iron-manufacture iron-pottery brewery-iron; do
  a=${pair%-*} b=${pair#*-}
  if [[ $(rank "$a") -le $(rank "$b") ]]; then front=$a back=$b; else front=$b back=$a; fi
  ink "$back" 640 "$T/back.png" 372 12
  ink "$front" 760 "$T/front.png" 8 256
  # the front's silhouette: its ink, closed and dilated, in the label's cream
  magick "$T/front.png" -alpha extract -morphology Close Disk:6 -morphology Dilate Disk:14 -blur 0x2 \
    -write mpr:sil +delete -size "${N}x${N}" xc:"$CREAM" mpr:sil -alpha off -compose CopyOpacity -composite "$T/sil.png"
  label "$T/back.png" -compose over -composite "$T/sil.png" -compose over -composite "$T/front.png" -compose over -composite -quality 92 "$OUT/tile-combo-$pair.webp"
done
echo "$(ls "$OUT" | wc -l) faces in $OUT"
[[ -n "${WORK:-}" ]] || rm -rf "$T"
