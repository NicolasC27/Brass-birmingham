#!/bin/sh
# Bundle the learner with the engine and run it. From app/:
#   GAMES=200 ITERATIONS=3 EPOCHS=30 sh tools/bots/learn.sh loop|play|fit|check
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/learn.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/learn.mjs --log-level=warning
node tools/bots/dist/learn.mjs "$@"
