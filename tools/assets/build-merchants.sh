#!/usr/bin/env bash
# From the painted sources under tools/assets/merchants (fal-merchants.sh)
# to what the board loads (ImageMagick 7). Run from the repository root.
#   merchant-<house>.webp   the painting, 1024 wide
#   merchant-frame.webp     the gilded frame in nine slices: the carved
#                           corners as painted, the bands between them tiled
#                           from a plain stretch so nothing warps when the
#                           frame is stretched to a house's width; black
#                           inside and out made transparent
set -euo pipefail
M=tools/assets/merchants
P=app/public
for n in shrewsbury warrington nottingham oxford gloucester; do
  magick "$M/$n-2048.jpg" -resize 1024x -quality 82 -define webp:method=6 "$P/merchant-$n.webp"
  echo "  merchant-$n.webp"
done
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
magick "$M/frame-1024.png" -resize 512x512 "$T/f.png"
# the inner black square starts 121px in on every side at 512px
magick "$T/f.png" -crop 50x121+125+0 +repage -write mpr:top +delete -size 232x121 tile:mpr:top "$T/top.png"
magick "$T/f.png" -crop 50x121+125+391 +repage -write mpr:bot +delete -size 232x121 tile:mpr:bot "$T/bot.png"
magick "$T/f.png" -crop 121x50+0+125 +repage -write mpr:lft +delete -size 121x232 tile:mpr:lft "$T/lft.png"
magick "$T/f.png" -crop 121x50+391+125 +repage -write mpr:rgt +delete -size 121x232 tile:mpr:rgt "$T/rgt.png"
magick "$T/f.png" "$T/top.png" -geometry +140+0 -composite "$T/bot.png" -geometry +140+391 -composite \
  "$T/lft.png" -geometry +0+140 -composite "$T/rgt.png" -geometry +391+140 -composite \
  -fuzz 6% -transparent black -quality 90 -define webp:method=6 "$P/merchant-frame.webp"
echo "  merchant-frame.webp (slices of 121px)"
