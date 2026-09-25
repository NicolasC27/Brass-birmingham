#!/bin/sh
# Play uneven tables and note every position's lead against the outcome, for
# the analysis's chance of winning. From app/:
#   GAMES=200 WORKERS=4 BUDGET=60 OUT=/tmp/calibrate.jsonl sh tools/bots/calibrate.sh
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/calibrate.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/calibrate.mjs --log-level=warning
node tools/bots/dist/calibrate.mjs "$@"
