#!/bin/sh
# Tägliche Sicherung der Datenbank, z. B. per crontab:
#   15 3 * * * /opt/beyourself/deploy/backup.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
docker compose exec -T app node -e "require('better-sqlite3')('/app/data/beyourself.db').backup('/app/data/backup.db').then(()=>console.log('ok'))"
docker compose cp app:/app/data/backup.db "backups/beyourself-$(date +%F).db"
find backups -name 'beyourself-*.db' -mtime +30 -delete
