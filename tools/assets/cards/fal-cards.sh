#!/usr/bin/env bash
# The faces of the hand's cards, generated with Flux Pro 1.1 Ultra through
# fal.ai: one engraved vignette per town of the Midlands board, and one
# plate for each of the two jokers. Every one is printed in the hand of the
# engraved map — an 1830s copperplate, sepia ink on cream paper — cut
# tight to the scene; the card fades its edges into its own paper. The
# service still likes to add a plate border or a caption now and then, so
# the served file keeps only the middle of the picture.
# Run from the repository root with FAL_KEY in .env.local (never committed).
# Keeps tools/assets/cards/<name>.jpg (the source, at full size) and serves
# app/public/cards/<name>.webp, 360 wide.
#   ./tools/assets/cards/fal-cards.sh              # every plate missing
#   ./tools/assets/cards/fal-cards.sh town-dudley  # one, again
#   ./tools/assets/cards/fal-cards.sh --serve      # the served files, again
set -euo pipefail
set -a; . ./.env.local; set +a
: "${FAL_KEY:?FAL_KEY missing from .env.local}"
SRC=tools/assets/cards
OUT=app/public/cards
mkdir -p "$SRC" "$OUT"
declare -A SCENE=(
  [town-belper]="the tall brick cotton mill of Belper beside a curved weir on the river Derwent, wooded hills behind"
  [town-derby]="the old silk mill of Derby on the river Derwent, the tall gothic tower of All Saints church rising behind the rooftops"
  [town-leek]="the moorland market town of Leek, a square-towered stone church above a cluster of silk mills and chimneys, the Roaches crags on the skyline"
  [town-stoke]="the Potteries at Stoke-on-Trent, a crowd of bottle-shaped brick kilns trailing smoke beside a canal with a moored narrowboat"
  [town-stone]="a lock on the Trent and Mersey canal at Stone, brick warehouses and a humpback bridge, a church tower beyond"
  [town-uttoxeter]="the market place of Uttoxeter, Georgian houses around a small market hall, a tall church spire behind"
  [town-stafford]="the timber-framed High House of Stafford on its street, the square tower of St Mary's church behind"
  [town-burton]="the maltings and brewhouses of Burton-on-Trent beside the long stone bridge over the river Trent, stacked barrels on the quay"
  [town-cannock]="a colliery on Cannock Chase, a timber winding headframe and an engine house chimney on open heathland, coal wagons"
  [town-tamworth]="Tamworth castle, a Norman shell keep on its mound above the confluence of two rivers, a stone bridge"
  [town-walsall]="the church of St Matthew on its hill above Walsall, rows of workshops and a canal basin below"
  [town-wolverhampton]="the sandstone tower of St Peter's church above Wolverhampton, foundry chimneys and a canal lock flight in the foreground"
  [town-coalbrookdale]="the Iron Bridge, one slender semicircular cast-iron arch spanning the river Severn in the wooded gorge at Coalbrookdale, blast furnaces smoking on the bank"
  [town-dudley]="the ruined castle of Dudley on its wooded hill, lime kilns and the portal of a canal tunnel below"
  [town-kidderminster]="carpet mills and a tall chimney beside the Staffordshire and Worcestershire canal at Kidderminster, the tower of St Mary's church"
  [town-worcester]="Worcester cathedral on the bank of the river Severn, a sailing trow moored at the quay, a porcelain works chimney"
  [town-birmingham]="Birmingham, the spire of St Martin's church above a canal basin crowded with narrowboats, warehouses and many factory chimneys"
  [town-coventry]="the three medieval spires of Coventry above half-timbered houses and ribbon-weaving workshops"
  [town-nuneaton]="Nuneaton, a church tower above the Coventry canal, a colliery headframe and a brick bridge"
  [town-redditch]="Redditch, needle mills with a waterwheel by a brook, a small church on the green, gentle hills"
  [wild-location]="a surveyor's compass rose laid over a fragment of an old county map, rivers and canals drawn as fine lines, a pair of dividers resting across it"
  [wild-industry]="a still life of the trades: interlocking cast-iron gear wheels, a smith's hammer resting on an anvil, a coal pick, a bobbin of cotton and a small barrel"
)
# the served plate: the middle of the picture, inked again in one sepia so
# that every card is pulled from the same plate-press
serve() {
  magick "$SRC/$1.jpg" -gravity center -crop 86%x84%+0+0 +repage -resize 360x \
    -colorspace gray -auto-level +level-colors '#3B2A1A,#F4EAD2' -quality 80 "$OUT/$1.webp"
}
if [[ "${1:-}" == --serve ]]; then
  for f in "$SRC"/*.jpg; do serve "$(basename "$f" .jpg)"; done
  exit 0
fi
names=("$@")
[[ ${#names[@]} -gt 0 ]] || names=("${!SCENE[@]}")
one() {
  local name=$1
  [[ $# -gt 1 || ! -f "$SRC/$name.jpg" ]] || return 0
  local P="A detail of an 1830s copperplate engraving, cropped tight so the picture fills the whole image edge to edge: ${SCENE[$name]}. Fine sepia-brown ink line work and cross-hatching on cream paper, monochrome, no colour. The scene runs off every edge of the image: no margin, no border, no frame, no caption, no title, no text or lettering anywhere."
  local body
  body=$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1],"aspect_ratio":"4:3","num_images":1,"output_format":"png","safety_tolerance":"2"}))' "$P")
  curl -s -m 240 -X POST https://fal.run/fal-ai/flux-pro/v1.1-ultra -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" -d "$body" |
    python3 -c 'import json,sys,subprocess;d=json.load(sys.stdin)
subprocess.run(["curl","-s","-L",d["images"][0]["url"],"-o",sys.argv[1]],check=True)' "$SRC/$name.png" || { echo "  $name: failed"; return 0; }
  magick "$SRC/$name.png" -quality 94 "$SRC/$name.jpg" && rm "$SRC/$name.png"
  serve "$name"
  echo "  $name: $(du -h "$OUT/$name.webp" | cut -f1)"
}
# four at a time: the service answers each in half a minute or so
for name in "${names[@]}"; do
  one "$name" ${1:+again} &
  while [[ $(jobs -r | wc -l) -ge 4 ]]; do wait -n; done
done
wait
