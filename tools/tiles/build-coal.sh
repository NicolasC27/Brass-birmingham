#!/usr/bin/env bash
# Coal tile art: rasterise tools/tiles/colliery.svg and derive every file the
# board loads from it (ImageMagick 7). Run from the repository root.
#   tile-coal-cut.png          transparent cutout (empty slots, merchants)
#   tile-coal.png              cutout on the dark tile ground
#   tile-coal-<colour>.png     owner-colour card: 8 px dark rim, colour ground,
#                              black outline around the painting
#   tile-coal-<b>-cut.png      dual-slot painting with the partner industry
set -euo pipefail
P=app/public
T=$(mktemp -d)
magick -background none tools/tiles/colliery.svg -resize 512x512 "$T/coal.png"
cp "$T/coal.png" "$P/tile-coal-cut.png"
magick "$T/coal.png" -background '#252629' -flatten "$P/tile-coal.png"
shade() { python3 -c "import sys;h=sys.argv[1].lstrip('#');f=float(sys.argv[2]);print('#%02x%02x%02x'%tuple(min(255,round(int(h[i:i+2],16)*f)) for i in (0,2,4)))" "$1" "$2"; }
magick "$T/coal.png" -alpha extract -morphology Dilate Disk:6.5 "$T/mask.png"
magick -size 512x512 xc:'#0a0806' "$T/mask.png" -alpha off -compose CopyOpacity -composite "$T/outline.png"
for pair in brass:#C9A45C oxblood:#9E3B30 verdigris:#3F7A55 steel:#4E6E8E; do
  n=${pair%%:*}; h=${pair##*:}
  magick -size 496x496 "radial-gradient:$(shade "$h" 0.80)-$(shade "$h" 0.74)" -gravity center -background "$(shade "$h" 0.42)" -extent 512x512 \
    "$T/outline.png" -compose Over -composite "$T/coal.png" -composite "$P/tile-coal-$n.png"
done
# dual slots: the headframe side only (no rope to the cropped engine house), partner on the right
sed '/x1="249" y1="82"/d' tools/tiles/colliery.svg > "$T/head.svg"
magick -background none "$T/head.svg" -resize 512x512 -crop 280x512+22+0 +repage -resize 88% "$T/head.png"
for pair in cotton:70:154 manufacture:62:195; do
  n=${pair%%:*}; r=${pair#*:}; sc=${r%%:*}; x=${r##*:}
  magick -size 512x512 xc:none \( "$P/tile-$n-cut.png" -resize "$sc%" \) -geometry "+$x+$((512 - 512 * sc / 100 - 38))" -compose Over -composite \
    "$T/head.png" -geometry "+4+$((512 - 512 * 88 / 100 - 38))" -composite "$P/tile-coal-$n-cut.png"
  magick "$P/tile-coal-$n-cut.png" -background '#252629' -flatten "$P/tile-coal-$n.png"
done
rm -rf "$T"
echo "coal tile art written to $P"
