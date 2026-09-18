#!/bin/sh
# Bundle the trainer with the engine and run it. From app/:
#   GENERATIONS=12 GAMES=32 STRENGTH=0.6 sh tools/bots/train.sh
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/train.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/train.mjs --log-level=warning
node tools/bots/dist/train.mjs
