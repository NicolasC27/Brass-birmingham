#!/usr/bin/env bash
# One pass over app/public so a browser downloads paintings, not sources
# (ImageMagick 7). Run from the repository root; idempotent.
#  - opaque paintings (maps, banners, hero, textures, cards, portraits,
#    merchant scenes) → lossy WebP; the alpha village → WebP with alpha
#  - every 16-bit tile PNG → 8-bit (same pixels, half the bytes)
#  - generator sources and superseded renders leave the served folder
set -euo pipefail
P=app/public
webp() { # <stem> <quality> [extra magick args]
  local stem=$1 q=$2; shift 2
  local src
  for src in "$P/$stem.png" "$P/$stem.jpg"; do
    [[ -f "$src" ]] || continue
    magick "$src" "$@" -quality "$q" "$P/$stem.webp"
    rm "$src"
    echo "  $stem → webp ($(du -h "$P/$stem.webp" | cut -f1))"
  done
}
echo "paintings:"
for m in map-era-canal map-era-rail map-painted-canal map-painted-rail; do webp "$m" 82 -alpha off; done
for b in era-canal-banner era-rail-banner hero-diorama hero-vignette; do webp "$b" 82 -alpha off; done
for t in tex-paper tex-brass tex-coal tex-wood table-felt; do webp "$t" 80 -alpha off; done
for c in card-back avatar-bot portrait-1 portrait-2 portrait-3 portrait-4 merchant-boat; do webp "$c" 85 -alpha off; done
for f in "$P"/merchant-*.png; do [[ -f "$f" ]] || continue; s=$(basename "$f" .png); [[ "$s" == merchant-boat ]] && continue; webp "$s" 85 -alpha off; done
webp town-village 90
echo "tiles to 8-bit:"
n=0
for f in "$P"/tile-*.png "$P"/tiles-classic/*.png "$P"/tiles-works/*.png; do
  [[ -f "$f" ]] || continue
  if [[ "$(magick identify -format '%[bit-depth]' "$f")" == 16 ]]; then
    magick "$f" -depth 8 "$f"
    n=$((n + 1))
  fi
done
echo "  $n files"
echo "out of the served folder:"
rm -fv "$P"/map-era-*.orig.png "$P"/map-midlands-*.png "$P"/map-midlands.svg "$P"/pair-*.png
rm -rfv "$P/backup-tiles"
echo "public now: $(du -sh "$P" | cut -f1)"
