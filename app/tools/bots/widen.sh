#!/bin/sh
# Carry a record written for fewer features across to this reading. From app/:
#   FROM=166 sh tools/bots/widen.sh            (positions, for learn.ts)
#   FROM=166 TRAILING=41 DIR=tools/bots/policy-data PREFIX=moves sh tools/bots/widen.sh
set -e
cd "$(dirname "$0")/../.."
mkdir -p tools/bots/dist
./node_modules/.bin/esbuild tools/bots/widen.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=tools/bots/dist/widen.mjs --log-level=warning
node tools/bots/dist/widen.mjs
