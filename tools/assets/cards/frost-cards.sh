#!/usr/bin/env bash
# The hand's location cards in winter, for the frozen city bought at the
# counter: each town's engraving (tools/assets/cards/<name>.jpg) handed to
# fal-ai/nano-banana/edit through tools/map/fal-run.mjs — the same plate,
# the same scene, under snow — kept as <name>-frost.jpg and served as
# app/public/cards/<name>-frost.webp by the same press as the others.
# Run from the repository root with FAL_KEY in .env.local.
#   ./tools/assets/cards/frost-cards.sh              # every plate missing
#   ./tools/assets/cards/frost-cards.sh town-stoke   # one, again
#   ./tools/assets/cards/frost-cards.sh --serve      # the served files, again
set -euo pipefail
SRC=tools/assets/cards
OUT=app/public/cards
T=${TMPDIR:-/tmp}/frost-cards
mkdir -p "$T"
serve() {
  magick "$SRC/$1-frost.jpg" -gravity center -crop 86%x84%+0+0 +repage -resize 360x \
    -colorspace gray -auto-level +level-colors '#3B2A1A,#F4EAD2' -quality 80 "$OUT/$1-frost.webp"
}
if [[ "${1:-}" == --serve ]]; then
  for f in "$SRC"/town-*-frost.jpg; do serve "$(basename "$f" -frost.jpg)"; done
  exit 0
fi
names=("$@")
if [[ ${#names[@]} -eq 0 ]]; then
  names=()
  for f in "$SRC"/town-*.jpg; do n=$(basename "$f" .jpg); [[ $n == *-frost ]] || names+=("$n"); done
fi
one() {
  local name=$1
  [[ -f "$SRC/$name-frost.jpg" && $# -eq 1 ]] && return 0
  python3 - "$SRC/$name.jpg" "$T/$name.json" <<'PY'
import json, sys
src, body = sys.argv[1:3]
prompt = ("Transform this 1830s copperplate engraving into the same view in the dead of a hard winter, after a heavy snowfall: "
"keep every building, chimney, bridge and boat exactly where it is and the same framing, but bury the scene in snow — deep white snow heaped on every roof, ledge, wall-top, quay and bank, "
"the river or canal frozen over into a flat sheet of ice with the boats held fast in it, every tree bare and black against the snow, long icicles under the eaves, a heavy grey winter sky, "
"the smoke rising straight up in the still cold, a few muffled figures in the snow. The snow must be obvious at a glance: most of the picture is the paper's white, with only the lightest stippling for shadow on it. "
"The same fine sepia-brown ink line work and cross-hatching on cream paper for everything that is not snow, monochrome. "
"The scene still runs off every edge of the image: no margin, no border, no frame, no caption, no title, no text or lettering anywhere.")
json.dump({'prompt': prompt, 'image_urls': [f'file://{src}'], 'num_images': 1, 'output_format': 'jpeg'}, open(body, 'w'))
PY
  node tools/map/fal-run.mjs fal-ai/nano-banana/edit "$T/$name.json" "$SRC/$name-frost.jpg" 2>&1 | grep -v base64 | tail -1 | cut -c1-60
  serve "$name"
}
# five at a time
i=0
for n in "${names[@]}"; do
  one "$n" "${2:-}" &
  i=$((i + 1))
  (( i % 5 == 0 )) && wait
done
wait
ls "$OUT"/town-*-frost.webp | wc -l
