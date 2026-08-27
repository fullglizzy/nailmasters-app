#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Бэкап NailMasters: дамп PostgreSQL + каталог загрузок.
# Вызывается по cron из deploy/backup.cron от root. Хранит 14 дней.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/nailmasters"
BACKUP_DIR="/var/backups/nailmasters"
RETENTION_DAYS=14
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/uploads"

# DATABASE_URL из .env (в кавычках — source понимает)
set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a

echo "[$(date '+%F %T')] pg_dump -> $BACKUP_DIR/db/nailmasters_$STAMP.sql.gz"
pg_dump --no-owner "$DATABASE_URL" | gzip -9 > "$BACKUP_DIR/db/nailmasters_$STAMP.sql.gz"

echo "[$(date '+%F %T')] uploads   -> $BACKUP_DIR/uploads/uploads_$STAMP.tar.gz"
tar -czf "$BACKUP_DIR/uploads/uploads_$STAMP.tar.gz" -C "$APP_DIR" public/uploads

echo "[$(date '+%F %T')] Удаление бэкапов старше $RETENTION_DAYS дней"
find "$BACKUP_DIR/db" "$BACKUP_DIR/uploads" -type f -mtime "+$RETENTION_DAYS" -delete

echo "[$(date '+%F %T')] Бэкап завершён"
