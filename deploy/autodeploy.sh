#!/bin/bash
# Automatisches Update: prüft alle 3 Minuten, ob es bei GitHub einen neuen Stand gibt.
# Wenn ja: Datenbank sichern → neu bauen → erst wenn der Bau klappt, auf die neue Version umschalten.
# Klappt der Bau nicht, läuft die alte Version einfach weiter (und dieser Stand wird nicht noch einmal versucht).
# Protokoll ansehen:  journalctl -u beyourself-deploy -n 50
set -uo pipefail
cd /opt/beyourself || exit 1
exec 9>/var/lock/beyourself-deploy.lock
flock -n 9 || exit 0                       # läuft schon → nichts tun

git fetch -q origin main || exit 0
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0
[ -f .deploy-failed ] && [ "$(cat .deploy-failed)" = "$REMOTE" ] && exit 0

echo "Neue Version gefunden: ${REMOTE:0:7} – $(git log -1 --format=%s "$REMOTE")"
./deploy/backup.sh >/dev/null 2>&1 && echo "Datenbank gesichert" || echo "Hinweis: Sicherung übersprungen"

if ! git merge --ff-only -q origin/main; then
  echo "FEHLER: Dateien auf dem Server wurden von Hand geändert – bitte Claude fragen."
  echo "$REMOTE" > .deploy-failed; exit 1
fi
if ! docker compose build app; then
  echo "FEHLER: Bau fehlgeschlagen – alte Version läuft weiter."
  git reset -q --hard "$LOCAL"
  echo "$REMOTE" > .deploy-failed; exit 1
fi
docker compose up -d
docker image prune -f >/dev/null 2>&1
rm -f .deploy-failed
echo "Fertig: Webseite läuft jetzt mit ${REMOTE:0:7}"
