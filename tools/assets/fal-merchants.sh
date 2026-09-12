#!/usr/bin/env bash
# The merchant houses' signs, generated with Flux Pro 1.1 Ultra through
# fal.ai: one whole picture per house — gilded frame, the quay at dusk, the
# name on a brass plate, a blank brass medallion for the bonus. Run from
# the repository root with FAL_KEY in .env.local (never committed); writes
# tools/assets/merchants/house-<name>-<n>.png, two candidates per house.
# Pick one, trim the black off it, keep it as house-<name>.jpg (2048 wide)
# and write app/public/merchant-house-<name>.webp (1024 wide); then read
# the medallion's place off it into app/src/gl/houses.ts.
#   ./tools/assets/fal-merchants.sh            # every house
#   ./tools/assets/fal-merchants.sh oxford     # one
set -euo pipefail
set -a; . ./.env.local; set +a
: "${FAL_KEY:?FAL_KEY missing from .env.local}"
OUT=tools/assets/merchants
mkdir -p "$OUT"
declare -A SCENE=(
  [shrewsbury]="a timber-framed Tudor merchant hall on a river quay, a stone bridge behind, moored narrowboats"
  [warrington]="brick warehouses and a wide stone bridge over the river Mersey at Warrington, a canal basin with moored barges and a crane on the quay"
  [nottingham]="tall red-brick lace-market warehouses above the river Trent at Nottingham, the castle on its rock in the distance, a wharf with a moored barge"
  [oxford]="a canal wharf at Oxford, college spires and a domed tower rising behind stone warehouses, moored narrowboats"
  [gloucester]="the great Victorian docks at Gloucester, tall brick warehouses with many windows, tall ships and barges moored, the cathedral tower in the distance"
)
for name in "${@:-shrewsbury warrington nottingham oxford gloucester}"; do
  P="A single ornate trading-house sign for a Victorian board game, wide format, seen perfectly straight on, filling the image. An antique carved gold-leaf frame with acanthus corners surrounds an oil painting of ${SCENE[$name]}, dusk, warm lantern light on wet stone and dark water, atmospheric haze. Along the bottom edge of the frame runs a polished brass counter shelf, completely empty. On the right side, inside the frame, a large round brass medallion with a beaded rim, its face blank and empty. At the top centre, mounted on the frame, an engraved brass nameplate with the word ${name^^} in engraved serif capitals. Outside the frame the background is solid pure black. No other text, no people."
  body=$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1],"aspect_ratio":"21:9","num_images":2,"output_format":"png","safety_tolerance":"2"}))' "$P")
  curl -s -m 240 -X POST https://fal.run/fal-ai/flux-pro/v1.1-ultra -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" -d "$body" |
    python3 -c 'import json,sys,subprocess;d=json.load(sys.stdin)
for i,im in enumerate(d["images"]): subprocess.run(["curl","-s","-L",im["url"],"-o",f"{sys.argv[1]}/house-{sys.argv[2]}-{i}.png"])' "$OUT" "$name"
  echo "  $name: two candidates"
done
