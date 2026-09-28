#!/usr/bin/env bash
# CollabOS backup: PostgreSQL (custom-format pg_dump, restorable with
# pg_restore) plus the uploads volume (tar), written outside the active
# Docker volumes, with a retention prune. Meant to run daily via cron on
# the VPS — see ops/README.md for the exact crontab line and restore
# procedure. Never prints or logs a secret: the Postgres dump goes via
# `docker exec`, which reads POSTGRES_USER/POSTGRES_DB from the running
# container's own environment, not from anything this script has to know.
#
# Safe to re-run any time; only ever creates new timestamped files and
# prunes ones older than RETENTION_DAYS. Never touches a live container,
# never touches anything outside collabos-postgres / collabos_uploads /
# BACKUP_ROOT.

set -euo pipefail
umask 077

BACKUP_ROOT="${COLLABOS_BACKUP_ROOT:-/opt/collabos/backups}"
RETENTION_DAYS="${COLLABOS_BACKUP_RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_PREFIX="[collabos-backup $TS]"

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

echo "$LOG_PREFIX starting"

if ! docker inspect -f '{{.State.Health.Status}}' collabos-postgres 2>/dev/null | grep -q healthy; then
  echo "$LOG_PREFIX ERROR: collabos-postgres is not healthy, aborting backup" >&2
  exit 1
fi

PG_DUMP_FILE="$BACKUP_ROOT/collabos-postgres-$TS.dump"
docker exec collabos-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$PG_DUMP_FILE"
chmod 600 "$PG_DUMP_FILE"
echo "$LOG_PREFIX postgres dump: $PG_DUMP_FILE ($(du -h "$PG_DUMP_FILE" | cut -f1))"

UPLOADS_FILE="$BACKUP_ROOT/collabos-uploads-$TS.tar.gz"
# Read-only mount of the named volume via a disposable Alpine container —
# never touches the running collabos-api container.
docker run --rm \
  -v collabos_uploads:/data:ro \
  -v "$BACKUP_ROOT":/backup \
  alpine:3.20 \
  sh -c 'tar -czf "/backup/collabos-uploads-'"$TS"'.tar.gz" -C /data .'
chmod 600 "$UPLOADS_FILE"
echo "$LOG_PREFIX uploads archive: $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"

# Retention — only ever deletes CollabOS's own timestamped backup files in
# BACKUP_ROOT, never anything else in that directory or elsewhere.
find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'collabos-postgres-*.dump' -mtime "+$RETENTION_DAYS" -print -delete
find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'collabos-uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "$LOG_PREFIX done"
