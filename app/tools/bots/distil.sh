#!/bin/sh
# Bundle the move-ranking learner with the engine and run it. From app/:
#   GAMES=120 ITERATIONS=1 EPOCHS=40 sh tools/bots/distil.sh loop|play|fit|check
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/distil.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/distil.mjs --log-level=warning
node tools/bots/dist/distil.mjs "$@"
