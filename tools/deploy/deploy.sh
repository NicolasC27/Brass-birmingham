#!/usr/bin/env bash
# ------------------------------------------------------------------
# Builds the office and the preview on this machine and puts them on
# the server: the site's files, the office's bundle, the service and
# the Caddyfile, then restarts what changed.
#
#   BLACKRAIL_HOST=ubuntu@<ip> BLACKRAIL_KEY=~/.ssh/<key> tools/deploy/deploy.sh
#
# BLACKRAIL_HOST defaults to an ssh alias `blackrail`. The server must
# have been prepared by setup-server.sh.
# ------------------------------------------------------------------
set -euo pipefail
HOST=${BLACKRAIL_HOST:-blackrail}
APP_URL=${APP_URL:-https://playblackrail.com}
OFFICE_WS=${OFFICE_WS:-wss://office.playblackrail.com}
# the legal notice's particulars (public: they are printed on /legal). The
# publisher, not a professional, stays anonymous under LCEN art. 6-III-2:
# the host holds its identity
export VITE_LEGAL_OPERATOR=${VITE_LEGAL_OPERATOR:-"Blackrail — éditeur non professionnel, identité déclarée à l’hébergeur (LCEN, art. 6-III-2)"}
export VITE_LEGAL_CONTACT=${VITE_LEGAL_CONTACT:-contact@playblackrail.com}
export VITE_LEGAL_HOST=${VITE_LEGAL_HOST:-"OVH SAS, 2 rue Kellermann, 59100 Roubaix, France — +33 9 72 10 10 07"}
SSH=(ssh -o IdentitiesOnly=yes ${BLACKRAIL_KEY:+-i "$BLACKRAIL_KEY"})
here=$(cd "$(dirname "$0")" && pwd)
cd "$here/../../app"

node server/build.mjs
VITE_ONLINE_URL=$OFFICE_WS VITE_APP_URL=$APP_URL npm run build:prelaunch

rsync -az --delete -e "${SSH[*]}" dist-prelaunch/ "$HOST:/srv/blackrail/site/"
rsync -az -e "${SSH[*]}" server/dist/blackrail-server.mjs "$HOST:/srv/blackrail/office/blackrail-server.mjs"
rsync -az -e "${SSH[*]}" "$here/office-package.json" "$HOST:/srv/blackrail/office/package.json"
rsync -az -e "${SSH[*]}" "$here/Caddyfile" "$here/blackrail-office.service" "$here/geo-update.sh" "$here/blackrail-geo.service" "$here/blackrail-geo.timer" "$HOST:/tmp/"
"${SSH[@]}" "$HOST" 'set -e
  cd /srv/blackrail/office && npm install --omit=dev --no-audit --no-fund --loglevel=error
  sudo install -m 644 /tmp/Caddyfile /etc/caddy/Caddyfile
  sudo install -m 644 /tmp/blackrail-office.service /etc/systemd/system/blackrail-office.service
  sudo install -m 755 /tmp/geo-update.sh /usr/local/bin/blackrail-geo-update
  sudo install -m 644 /tmp/blackrail-geo.service /tmp/blackrail-geo.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now blackrail-geo.timer >/dev/null 2>&1
  [ -f /srv/blackrail/data/geo/country.mmdb ] || sudo /usr/local/bin/blackrail-geo-update
  sudo systemctl enable blackrail-office >/dev/null 2>&1
  sudo systemctl restart blackrail-office
  sudo systemctl reload caddy
  sleep 2
  systemctl is-active blackrail-office caddy'
echo "deployed to $HOST"
