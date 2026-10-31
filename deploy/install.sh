#!/usr/bin/env bash
# =============================================================================
#  Be Yourself – Installation auf dem IONOS VPS (Ubuntu 24.04)
#
#  Aufruf als root auf dem Server:
#    curl -fsSL https://raw.githubusercontent.com/azizimaryam1974-beyourself/beyourself-app/main/deploy/install.sh -o install.sh
#    bash install.sh
#
#  Das Skript kann gefahrlos mehrfach laufen (z. B. für Updates).
#  Schlüssel werden nur hier am Server eingetippt – nie im Chat.
# =============================================================================
set -euo pipefail

REPO="https://github.com/azizimaryam1974-beyourself/beyourself-app.git"
DIR="/opt/beyourself"
DOMAIN="fahrschule-beyourself.de"

say()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m ✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m ! %s\033[0m\n" "$*"; }
ask()  { local __v; read -r -p "$1" __v </dev/tty; printf '%s' "$__v"; }
asks() { local __v; read -r -s -p "$1" __v </dev/tty; echo >&2; printf '%s' "$__v"; }

[ "$(id -u)" -eq 0 ] || { echo "Bitte als root ausführen (sudo -i)."; exit 1; }

# --- 1. System ---------------------------------------------------------------
say "System aktualisieren (kann ein paar Minuten dauern)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get -y -qq -o Dpkg::Options::="--force-confold" upgrade
apt-get -y -qq install git curl ufw unattended-upgrades ca-certificates dnsutils
ok "System aktuell"

say "Automatische Sicherheitsupdates einschalten"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
ok "unattended-upgrades aktiv"

say "Firewall: nur SSH, HTTP, HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
ok "Firewall aktiv"

if ! command -v docker >/dev/null 2>&1; then
  say "Docker installieren"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || apt-get -y -qq install docker-compose-plugin
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"

# --- 2. App holen ------------------------------------------------------------
say "App von GitHub holen"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"
ok "Code in $DIR"

# --- 3. Einstellungen (.env) -------------------------------------------------
if [ ! -f .env ]; then
  say "Schlüssel eintragen (Eingabe bleibt unsichtbar, einfach einfügen + Enter)"
  echo "Azure-Portal → Ressource → „Schlüssel und Endpunkt“ → SCHLÜSSEL 1"
  SPEECH_KEY=$(asks "  Azure Speech-Schlüssel (beyourself-speech): ")
  TRANSLATOR_KEY=$(asks "  Azure Translator-Schlüssel (beyourself-translator): ")
  echo "Anthropic Console → API Keys (Feld leer lassen = nur Azure übersetzt)"
  ANTHROPIC_KEY=$(asks "  Anthropic API-Schlüssel: ")
  PROVIDER="claude"; [ -z "$ANTHROPIC_KEY" ] && PROVIDER="azure"
  umask 077
  cat > .env <<EOF
APP_URL=https://$DOMAIN
DATABASE_PATH=/app/data/beyourself.db
LESSON_RETENTION_DAYS=180
ENABLE_FARSI=0
TRANSLATION_PROVIDER=$PROVIDER
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
CLAUDE_MODEL=claude-haiku-5-5
AZURE_SPEECH_KEY=$SPEECH_KEY
AZURE_SPEECH_REGION=germanywestcentral
AZURE_TRANSLATOR_KEY=$TRANSLATOR_KEY
AZURE_TRANSLATOR_REGION=germanywestcentral
AZURE_TRANSLATOR_ENDPOINT=https://api-eur.cognitive.microsofttranslator.com
EOF
  chmod 600 .env
  unset SPEECH_KEY TRANSLATOR_KEY ANTHROPIC_KEY
  ok ".env angelegt (nur für root lesbar), Übersetzer: $PROVIDER"
else
  ok ".env vorhanden – bleibt unverändert"
fi

# --- 4. DNS prüfen -----------------------------------------------------------
say "DNS prüfen"
MYIP=$(curl -fsS4 https://api.ipify.org || true)
DNSIP=$(dig +short A "$DOMAIN" | tail -1)
if [ -n "$MYIP" ] && [ "$MYIP" = "$DNSIP" ]; then
  ok "$DOMAIN zeigt auf diesen Server ($MYIP)"
else
  warn "$DOMAIN zeigt noch auf '${DNSIP:-nichts}', dieser Server ist '$MYIP'."
  warn "HTTPS-Zertifikat kommt automatisch, sobald der DNS-Eintrag stimmt."
fi
if [ -n "$(dig +short AAAA "$DOMAIN")" ]; then
  warn "Es gibt einen AAAA-Eintrag (IPv6) – bei IONOS entfernen, sonst kann HTTPS scheitern."
fi

# --- 5. Starten --------------------------------------------------------------
say "App bauen und starten (beim ersten Mal 3–6 Minuten)"
docker compose up -d --build
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ok "App läuft"; break
  fi
  sleep 3
done

# --- 6. Lehrkraft-Konto ------------------------------------------------------
if ! docker compose exec -T app node -e "const d=require('better-sqlite3')('/app/data/beyourself.db');process.exit(d.prepare(\"select count(*) n from users where role='teacher'\").get().n?0:1)" 2>/dev/null; then
  say "Konto für die Lehrkraft anlegen"
  T_EMAIL=$(ask "  E-Mail: ")
  T_NAME=$(ask "  Name: ")
  docker compose exec -it app npx tsx scripts/create-teacher.ts "$T_EMAIL" "$T_NAME" </dev/tty
else
  ok "Lehrkraft-Konto vorhanden"
fi

# --- 7. Tägliche Sicherung ---------------------------------------------------
say "Tägliche Datenbank-Sicherung (03:15 Uhr, 30 Tage)"
chmod +x deploy/backup.sh
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' ; echo "15 3 * * * $DIR/deploy/backup.sh >> /var/log/beyourself-backup.log 2>&1" ) | crontab -
ok "Sicherung eingerichtet"

say "Fertig"
echo "  Adresse:      https://$DOMAIN"
echo "  Logs:         cd $DIR && docker compose logs -f app"
echo "  Update:       cd $DIR && bash deploy/install.sh"
