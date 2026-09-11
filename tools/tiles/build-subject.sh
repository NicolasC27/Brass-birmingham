#!/usr/bin/env bash
# Tile art from a painted subject: take a 512x512 transparent PNG per
# industry and derive every file the board loads (ImageMagick 7). Run from
# the repository root:
#   ./tools/tiles/build-subject.sh tools/tiles/subjects tiles-v3
# Written per industry:
#   tile-<i>-cut.webp          transparent cutout (empty slots, merchants)
#   tile-<i>.webp              cutout on the dark tile ground
#   tile-<i>-<colour>.webp     owner-colour card: the painting full bleed on
#                              the owner's ground, no rim of its own — the
#                              board draws the card body and its shadow
# and per dual slot the board actually has:
#   tile-combo-<a>-<b>.webp    the two industries painted as one yard, the
#                              one that needs room large at the back, the
#                              compact one small and in front of it
# The subject fills the square: the board masks the card to its rounded
# corners, so nothing is lost and the painting reads at every zoom. Painted
# art does not compress as PNG, a third of a megabyte apiece, so the set is
# written as WebP; a variant declares its format in paint.ts.
set -euo pipefail
SRC=${1:-tools/tiles/subjects}
STYLE=${2:?style directory under app/public}
P="app/public/$STYLE"
Q=(-quality 82 -define webp:method=6)
mkdir -p "$P"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
shade() { python3 -c "import sys;h=sys.argv[1].lstrip('#');f=float(sys.argv[2]);print('#%02x%02x%02x'%tuple(min(255,round(int(h[i:i+2],16)*f)) for i in (0,2,4)))" "$1" "$2"; }

# --- one painting per industry, filling the square -------------------
for NAME in coal iron cotton manufacture pottery brewery; do
  SUBJECT="$SRC/subject-$NAME-512.png"
  [[ -f "$SUBJECT" ]] || { echo "missing $SUBJECT" >&2; exit 1; }
  magick "$SUBJECT" -trim +repage -resize 512x512 -background none -gravity center -extent 512x512 -depth 8 "$T/$NAME.png"
  magick "$T/$NAME.png" "${Q[@]}" "$P/tile-$NAME-cut.webp"
  magick "$T/$NAME.png" -background '#252629' -flatten "${Q[@]}" "$P/tile-$NAME.webp"
  for pair in brass:#C9A45C oxblood:#9E3B30 verdigris:#3F7A55 steel:#4E6E8E; do
    n=${pair%%:*}; h=${pair##*:}
    magick -size 512x512 "radial-gradient:$(shade "$h" 0.80)-$(shade "$h" 0.68)" \
      "$T/$NAME.png" -compose Over -composite "${Q[@]}" "$P/tile-$NAME-$n.webp"
  done
  echo "  $NAME"
done

# --- the dual slots, as one scene ------------------------------------
# hero:companion — the industry that needs room to read stands large at
# the back, the compact one small and in front of it, so both are named
# at a glance and the slot still has one subject
COMBOS="cotton:brewery brewery:iron brewery:manufacture cotton:coal coal:manufacture cotton:manufacture manufacture:iron iron:pottery"
for combo in $COMBOS; do
  HERO=${combo%%:*}; SMALL=${combo##*:}
  # the file is named by the industry KEYS, sorted (paint.ts pairKey)
  ka=$HERO; kb=$SMALL
  [[ $ka == manufacture ]] && ka=manufacturer
  [[ $kb == manufacture ]] && kb=manufacturer
  if [[ "$ka" < "$kb" ]]; then OUT="tile-combo-$ka-$kb"; else OUT="tile-combo-$kb-$ka"; fi
  magick "$T/$HERO.png" -resize 86% "$T/hero.png"
  magick "$T/$SMALL.png" -resize 46% "$T/small.png"
  # a ground shadow under each, so the two stand in one yard
  magick -size 512x512 xc:none -fill '#00000052' \
    -draw 'ellipse 286,470 190,26 0,360' -draw 'ellipse 118,492 104,20 0,360' -blur 0x16 "$T/ground.png"
  magick -size 512x512 xc:none \
    "$T/hero.png" -geometry +76+18 -compose Over -composite \
    "$T/ground.png" -compose Over -composite \
    "$T/small.png" -geometry +0+270 -compose Over -composite \
    -depth 8 "${Q[@]}" "$P/$OUT.webp"
  echo "  $OUT"
done
echo "subject tile art written to $P"
