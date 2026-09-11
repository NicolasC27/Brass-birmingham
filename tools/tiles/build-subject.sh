#!/usr/bin/env bash
# Tile art from a painted subject: take a 512x512 transparent PNG and derive
# every file the board loads from it (ImageMagick 7). Run from the repository
# root, naming the directory the subjects sit in and the style directory to
# write:
#   ./tools/tiles/build-subject.sh tools/tiles/subjects tiles-v3
# Written per industry:
#   tile-<i>-cut.webp          transparent cutout (empty slots, merchants)
#   tile-<i>.webp              cutout on the dark tile ground
#   tile-<i>-<colour>.webp     owner-colour card: 8 px dark rim, colour ground,
#                              dark outline around the painting
# Painted subjects do not compress as PNG (a third of a megabyte each), so
# this set is written as WebP; a variant declares its format in paint.ts.
# Dual-slot paintings are not written: the board composes those itself from
# whichever two paintings are in play (paint.ts composePair).
set -euo pipefail
SRC=${1:-tools/tiles/subjects}  # directory holding subject-<name>-512.png
STYLE=${2:?style directory under app/public}
P="app/public/$STYLE"
mkdir -p "$P"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
shade() { python3 -c "import sys;h=sys.argv[1].lstrip('#');f=float(sys.argv[2]);print('#%02x%02x%02x'%tuple(min(255,round(int(h[i:i+2],16)*f)) for i in (0,2,4)))" "$1" "$2"; }
for NAME in coal iron cotton manufacture pottery brewery; do
  SUBJECT="$SRC/subject-$NAME-512.png"
  [[ -f "$SUBJECT" ]] || { echo "missing $SUBJECT" >&2; exit 1; }
  # trimmed, then set back in the square at 92% so the rim of a built card
  # never cuts the painting
  magick "$SUBJECT" -trim +repage -resize 471x471\> -background none -gravity center -extent 512x512 -depth 8 "$T/art.png"
  magick "$T/art.png" -quality 82 -define webp:method=6 "$P/tile-$NAME-cut.webp"
  magick "$T/art.png" -background '#252629' -flatten -quality 82 -define webp:method=6 "$P/tile-$NAME.webp"
  magick "$T/art.png" -alpha extract -morphology Dilate Disk:4 "$T/mask.png"
  magick -size 512x512 xc:'#0a0806' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/outline.png"
  for pair in brass:#C9A45C oxblood:#9E3B30 verdigris:#3F7A55 steel:#4E6E8E; do
    n=${pair%%:*}; h=${pair##*:}
    magick -size 496x496 "radial-gradient:$(shade "$h" 0.80)-$(shade "$h" 0.74)" -gravity center -background "$(shade "$h" 0.42)" -extent 512x512 \
      "$T/outline.png" -compose Over -composite "$T/art.png" -composite -quality 82 -define webp:method=6 "$P/tile-$NAME-$n.webp"
  done
  echo "  $NAME"
done
echo "subject tile art written to $P"
