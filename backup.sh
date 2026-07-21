#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# KaySetu — Automated daily database backup.
# Setup: chmod +x backup.sh && crontab -e
#   Add:  0 3 * * * /var/www/Projects/KaySetu/backup.sh
#   (runs daily at 3 AM)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="/var/www/Projects/KaySetu/backups"
COMPOSE="docker compose -f /var/www/Projects/KaySetu/docker-compose.prod.yml --env-file /var/www/Projects/KaySetu/.env.production"
KEEP_DAYS=7   # delete backups older than 7 days

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/kaysetu_${TIMESTAMP}.sql.gz"

# Dump all databases (control + tenant DBs) and compress
$COMPOSE exec -T postgres pg_dumpall -U kaysetu | gzip > "$BACKUP_FILE"

# Delete old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete

echo "[$(date)] Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
