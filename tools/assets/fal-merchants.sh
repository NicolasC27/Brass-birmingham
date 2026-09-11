#!/usr/bin/env bash
# The merchant houses' paintings and their gilded frame, generated with
# Flux Pro 1.1 Ultra through fal.ai. Run from the repository root with
# FAL_KEY in .env.local (never committed); writes the sources under
# tools/assets/merchants, then hand them to build-merchants.sh.
#   ./tools/assets/fal-merchants.sh            # everything
#   ./tools/assets/fal-merchants.sh oxford     # one house
set -euo pipefail
set -a; . ./.env.local; set +a
: "${FAL_KEY:?FAL_KEY missing from .env.local}"
OUT=tools/assets/merchants
mkdir -p "$OUT"
STYLE="Oil painting in the manner of a Victorian English landscape painter, 1830s, dusk, warm lantern light reflected on wet stone and dark water, atmospheric haze, rich impasto, muted browns, deep teal sky, gold highlights, wide panoramic composition, no text, no people in the foreground."
declare -A SCENE=(
  [shrewsbury]="A timber-framed Tudor merchant hall on the quay of the river Severn at Shrewsbury, a stone bridge behind, moored narrowboats, bales of cloth and barrels stacked on the wharf."
  [warrington]="Brick warehouses and a wide stone bridge over the river Mersey at Warrington, a canal basin with moored barges, sacks and crates on the quay, a crane arm."
  [nottingham]="Tall lace-market warehouses of red brick above the river Trent at Nottingham, the castle on its rock in the distance, a wharf with barrels and a moored barge."
  [oxford]="A canal wharf at Oxford with college spires and a domed tower rising behind stone warehouses, moored narrowboats, coal and timber on the quay."
  [gloucester]="The great Victorian docks at Gloucester, tall brick warehouses with many windows, tall ships and barges moored, barrels on the quayside, the cathedral tower in the distance."
)
FRAME="An ornate antique gilded Victorian picture frame, square, seen perfectly straight on, filling the image edge to edge, intricate acanthus leaf carving and round rosettes at the four corners, antique gold leaf with warm highlights and deep dark recesses, museum quality. The inside of the frame is solid pure black, empty, no picture. Background outside the frame is solid pure black."
ask() { # <name> <prompt> <aspect> <format>
  local body; body=$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1],"aspect_ratio":sys.argv[2],"num_images":1,"output_format":sys.argv[3],"safety_tolerance":"2"}))' "$2" "$3" "$4")
  local url; url=$(curl -s -m 180 -X POST https://fal.run/fal-ai/flux-pro/v1.1-ultra -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" -d "$body" | python3 -c 'import json,sys;print(json.load(sys.stdin)["images"][0]["url"])')
  curl -s -L "$url" -o "$OUT/$1"
  echo "  $1"
}
for name in "${@:-frame shrewsbury warrington nottingham oxford gloucester}"; do
  if [[ $name == frame ]]; then ask frame-1024.png "$FRAME" 1:1 png; else ask "$name-2048.jpg" "$STYLE ${SCENE[$name]}" 21:9 jpeg; fi
done
