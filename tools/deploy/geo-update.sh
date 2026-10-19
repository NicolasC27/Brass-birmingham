#!/usr/bin/env bash
# ------------------------------------------------------------------
# Fetches this month's country database (DB-IP "IP to Country Lite",
# CC BY 4.0) for the office: the country of an address left on the
# waiting list is read from it, on the machine, and nothing else is
# kept. Run by blackrail-geo.timer each month; restarts the office
# only when the file changed.
# ------------------------------------------------------------------
set -euo pipefail
dir=/srv/blackrail/data/geo
install -d -m 750 -o blackrail -g blackrail "$dir"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
for month in "$(date +%Y-%m)" "$(date -d '-1 month' +%Y-%m)"; do
  if curl -fsSL "https://download.db-ip.com/free/dbip-country-lite-$month.mmdb.gz" | gunzip > "$tmp" && [ -s "$tmp" ]; then
    if ! cmp -s "$tmp" "$dir/country.mmdb"; then
      install -m 640 -o blackrail -g blackrail "$tmp" "$dir/country.mmdb"
      systemctl try-restart blackrail-office
      echo "geo: country database of $month in place"
    else
      echo "geo: country database of $month already in place"
    fi
    exit 0
  fi
done
echo "geo: no country database could be fetched" >&2
exit 1
