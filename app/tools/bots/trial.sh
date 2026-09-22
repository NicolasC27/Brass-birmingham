#!/bin/sh
# Weigh one change against another with enough games to tell. From app/:
#   TRIALS='as it stands:;the mat:stack=0.8' GAMES=96 sh tools/bots/trial.sh
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/trial.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/trial.mjs --log-level=warning
node tools/bots/dist/trial.mjs "$@"
