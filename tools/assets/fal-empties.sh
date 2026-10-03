#!/usr/bin/env bash
# The empty states' plates: a table nobody sits at, a platform nobody
# waits on — engraved for the day register (ink on paper) and for the
# night (pale ink on black). Run from the repository root with FAL_KEY
# in .env.local; writes tools/assets/plates/empty-<name>-<register>-<n>.png.
# Pick one of each and write app/public/empty-<name>[-night].webp (1024 wide).
set -euo pipefail
set -a; . ./.env.local; set +a
: "${FAL_KEY:?FAL_KEY missing from .env.local}"
OUT=tools/assets/plates
mkdir -p "$OUT"
declare -A SCENE=(
  [tables]="a round gaming table in a Victorian club room, six empty wooden chairs pushed in, an oil lamp lit on the table, a ledger and an inkwell, tall bookshelves behind, nobody there"
  [queue]="an empty railway platform of the 1840s under an iron and glass roof, one wooden bench, a station clock, a gas lamp, a porter's trolley, steam drifting in the distance, nobody there"
)
declare -A STYLE=(
  [day]="An antique nineteenth-century steel engraving, fine cross-hatching and stipple, black ink on cream paper, soft sepia tone"
  [night]="An antique nineteenth-century steel engraving printed in pale ivory ink on black paper, fine cross-hatching, the only colour a warm amber glow at the lamp"
)
names=("$@"); [[ ${#names[@]} -eq 0 ]] && names=(tables queue)
for name in "${names[@]}"; do
  for reg in day night; do
    P="${STYLE[$reg]}: ${SCENE[$name]}. Wide format, every edge crisp, no border, no text, no people."
    body=$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1],"aspect_ratio":"16:9","num_images":2,"output_format":"png","safety_tolerance":"2"}))' "$P")
    curl -s -m 300 -X POST https://fal.run/fal-ai/flux-pro/v1.1-ultra -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" -d "$body" |
      python3 -c 'import json,sys,subprocess;d=json.load(sys.stdin)
for i,im in enumerate(d["images"]): subprocess.run(["curl","-s","-L",im["url"],"-o",f"{sys.argv[1]}/empty-{sys.argv[2]}-{sys.argv[3]}-{i}.png"])' "$OUT" "$name" "$reg"
    echo "  $name $reg: two candidates"
  done
done
echo DONE
