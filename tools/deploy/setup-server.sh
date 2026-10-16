#!/usr/bin/env bash
# ------------------------------------------------------------------
# Prepares a fresh Ubuntu 24.04 VPS for Blackrail. Run once as root
# (ssh <host> 'sudo bash -s' < setup-server.sh); running it again
# changes nothing that is already in place.
#
#   - the system up to date, and kept so every night
#   - ssh by key only, no root login; a firewall with 22, 80 and 443
#   - fail2ban on ssh, 2 GB of swap, the clock on Paris
#   - Node 22 (NodeSource) and Caddy (its own repository)
#   - a `blackrail` system user, /srv/blackrail/{office,site,data}
#   - /etc/blackrail/office.env, created empty for the office's settings
# ------------------------------------------------------------------
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -q
apt-get -yq -o Dpkg::Options::=--force-confold upgrade
apt-get -yq install ufw fail2ban unattended-upgrades rsync curl gnupg debian-keyring debian-archive-keyring apt-transport-https sqlite3
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
timedatectl set-timezone Europe/Paris

# ssh: the first value read wins, so this file comes before the cloud image's
cat > /etc/ssh/sshd_config.d/00-blackrail.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
# ssh starts on demand on 24.04: its run directory may not be there yet
install -d -m 755 /run/sshd
sshd -t
systemctl try-reload-or-restart ssh

ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-blackrail.conf
sysctl -q --system

if ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get -yq install nodejs
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get -yq install caddy
fi

id blackrail >/dev/null 2>&1 || useradd --system --home-dir /srv/blackrail --shell /usr/sbin/nologin blackrail
install -d -m 755 /srv/blackrail
# the code and the pages are written by the deploying user, the register by the office alone
install -d -m 755 -o "${SUDO_USER:-ubuntu}" -g "${SUDO_USER:-ubuntu}" /srv/blackrail/office /srv/blackrail/site
install -d -m 750 -o blackrail -g blackrail /srv/blackrail/data
install -d -m 750 -o root -g blackrail /etc/blackrail
[ -f /etc/blackrail/office.env ] || install -m 640 -o root -g blackrail /dev/null /etc/blackrail/office.env

echo "ready: $(lsb_release -ds), node $(node -v), $(caddy version | cut -d' ' -f1)"
