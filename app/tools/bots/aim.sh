#!/bin/sh
# Breed a reading of the board for the score it posts, not the matches it
# wins. From app/:
#   GENERATIONS=40 GAMES=12 BUDGET=400 sh tools/bots/aim.sh
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/aim.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/aim.mjs --log-level=warning
node tools/bots/dist/aim.mjs "$@"
