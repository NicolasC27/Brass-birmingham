#!/usr/bin/env bash
# Tile art: rasterise tools/tiles/<source>.svg and derive every file the board
# loads from it (ImageMagick 7). Run from the repository root:
#   ./tools/tiles/build-tile.sh coal
#   ./tools/tiles/build-tile.sh brewery
# Written for each industry:
#   tile-<i>-cut.png           transparent cutout (empty slots, merchants)
#   tile-<i>.png               cutout on the dark tile ground
#   tile-<i>-<colour>.png      owner-colour card: 8 px dark rim, colour ground,
#                              black outline around the painting
#   tile-<a>-<b>-cut.png       dual-slot painting: this industry (cropped to its
#                              tallest part) in front-left, the partner behind-right
set -euo pipefail
NAME=${1:?industry name}
case "$NAME" in
  coal)
    SVG=colliery.svg; CROP=280x512+22+0; CROP_SCALE=88
    PAIR_SED='/x1="249" y1="82"/d' # no rope to the cropped engine house
    PAIRS="cotton:70:154 manufacture:62:195" ;;
  brewery)
    SVG=brewhouse.svg; CROP=305x512+40+0; CROP_SCALE=80
    PAIR_SED=''
    PAIRS="cotton:70:160 iron:70:160 manufacture:62:195" ;;
  *) echo "no recipe for $NAME" >&2; exit 1 ;;
esac
P=app/public
T=$(mktemp -d)
magick -background none "tools/tiles/$SVG" -resize 512x512 "$T/art.png"
cp "$T/art.png" "$P/tile-$NAME-cut.png"
magick "$T/art.png" -background '#252629' -flatten "$P/tile-$NAME.png"
shade() { python3 -c "import sys;h=sys.argv[1].lstrip('#');f=float(sys.argv[2]);print('#%02x%02x%02x'%tuple(min(255,round(int(h[i:i+2],16)*f)) for i in (0,2,4)))" "$1" "$2"; }
magick "$T/art.png" -alpha extract -morphology Dilate Disk:6.5 "$T/mask.png"
magick -size 512x512 xc:'#0a0806' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/outline.png"
for pair in brass:#C9A45C oxblood:#9E3B30 verdigris:#3F7A55 steel:#4E6E8E; do
  n=${pair%%:*}; h=${pair##*:}
  magick -size 496x496 "radial-gradient:$(shade "$h" 0.80)-$(shade "$h" 0.74)" -gravity center -background "$(shade "$h" 0.42)" -extent 512x512 \
    "$T/outline.png" -compose Over -composite "$T/art.png" -composite "$P/tile-$NAME-$n.png"
done
sed "$PAIR_SED" "tools/tiles/$SVG" > "$T/front.svg"
magick -background none "$T/front.svg" -resize 512x512 -crop "$CROP" +repage -resize "$CROP_SCALE%" "$T/front.png"
for pair in $PAIRS; do
  n=${pair%%:*}; r=${pair#*:}; sc=${r%%:*}; x=${r##*:}
  # dual-slot files are named with the industry stems sorted (see paint.ts pairFile)
  if [[ "$NAME" < "$n" ]]; then out="tile-$NAME-$n"; else out="tile-$n-$NAME"; fi
  magick -size 512x512 xc:none \( "$P/tile-$n-cut.png" -resize "$sc%" \) -geometry "+$x+$((512 - 512 * sc / 100 - 38))" -compose Over -composite \
    "$T/front.png" -geometry "+4+$((512 - 512 * CROP_SCALE / 100 - 38))" -composite "$P/$out-cut.png"
  magick "$P/$out-cut.png" -background '#252629' -flatten "$P/$out.png"
done
rm -rf "$T"
echo "$NAME tile art written to $P"
