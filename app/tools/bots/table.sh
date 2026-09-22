#!/bin/sh
# Four of the same reading at one table: the yardstick that only measures
# how well the game is played. From app/:
#   GAMES=24 PLAYERS=4 BUDGET=1500 sh tools/bots/table.sh
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/table.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/table.mjs --log-level=warning
node tools/bots/dist/table.mjs "$@"
