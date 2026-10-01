#!/usr/bin/env bash
# The night plates of the front page, generated with Flux Pro 1.1 Ultra
# through fal.ai: the same three scenes the day plates print (the Black
# Country, the canal, the rail), engraved in pale ink on black paper for
# the night register, only the fires and the lamps glowing. Run from the
# repository root with FAL_KEY in .env.local (never committed); writes
# tools/assets/plates/night-<name>-<n>.png, two candidates per scene.
# Pick one per scene and write app/public/plate-night-<name>.webp (2048
# wide, ImageMagick: magick in.png -resize 2048x -quality 82 out.webp).
#   ./tools/assets/fal-plates.sh            # every scene
#   ./tools/assets/fal-plates.sh canal      # one
set -euo pipefail
set -a; . ./.env.local; set +a
: "${FAL_KEY:?FAL_KEY missing from .env.local}"
OUT=tools/assets/plates
mkdir -p "$OUT"
declare -A SCENE=(
  [country]="a wide panorama of the Black Country, Staffordshire, at night: rows of blast furnaces and tall chimneys pouring smoke, a canal with narrowboats winding through the works, a many-arched railway viaduct on the right with a steam locomotive crossing it, a church spire in the distance, a full moon behind thin cloud"
  [canal]="a canal lock at night in the English Midlands, a narrowboat with a lantern moored below the lock gates, a stone humpback bridge, a lock-keeper's cottage with one lit window, willows, a warehouse and a crane on the wharf, the moon on the water"
  [rail]="a steam locomotive with its tender and three carriages crossing a tall stone railway viaduct at night above a Midlands mill town, sparks and a plume of smoke lit from the firebox, mill windows lit in rows below, a river under the arches, a crescent moon"
)
names=("$@"); [[ ${#names[@]} -eq 0 ]] && names=(country canal rail)
for name in "${names[@]}"; do
  P="An antique nineteenth-century steel engraving, wide panoramic format, printed in pale ivory ink on black paper: ${SCENE[$name]}. Fine cross-hatching and stipple, the sky worked in dense hatched lines, every edge crisp. The only colour is a warm amber glow at the furnace fires, the firebox and the lit windows. No border, no text, no signature, no people in the foreground."
  body=$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1],"aspect_ratio":"21:9","num_images":2,"output_format":"png","safety_tolerance":"2"}))' "$P")
  curl -s -m 300 -X POST https://fal.run/fal-ai/flux-pro/v1.1-ultra -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" -d "$body" |
    python3 -c 'import json,sys,subprocess;d=json.load(sys.stdin)
for i,im in enumerate(d["images"]): subprocess.run(["curl","-s","-L",im["url"],"-o",f"{sys.argv[1]}/night-{sys.argv[2]}-{i}.png"])' "$OUT" "$name"
  echo "  $name: two candidates"
done
