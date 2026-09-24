# CollabOS VPS operations

Companion to `docs/vps-deployment-audit.md` (what the host looks like) and
`docs/ui-implementation-status.md`. This file covers the day-2 operational
bits: backups/restore, the deploy script, and rollback.

## Backups

`ops/backup.sh` — PostgreSQL (`pg_dump -Fc`, custom format) plus the
uploads volume (`tar.gz`), written to `/opt/collabos/backups/` (outside
any Docker volume, `chmod 700` dir / `600` files), with a 14-day retention
prune (`COLLABOS_BACKUP_RETENTION_DAYS` to override). Idempotent — only
ever creates new timestamped files or deletes ones past retention, never
touches a running container beyond a `docker exec pg_dump` (read) and a
disposable read-only-mounted Alpine container for the tar.

Aborts loudly (exit 1) rather than silently skipping if `collabos-postgres`
isn't healthy when it runs.

### Schedule

Added as **one appended line** to root's existing crontab — the VPS
already runs an unrelated cron job for another project; this was added
alongside it, never replacing the crontab wholesale:

```
0 3 * * * /opt/collabos/backend/ops/backup.sh >> /var/log/collabos-backup.log 2>&1
```

### Restore

**PostgreSQL** — stop the API first so nothing writes during restore:

```bash
cd /opt/collabos/backend
docker compose --env-file .env.production -f docker-compose.production.yml stop collabos-api

# Restore into the running collabos-postgres container. --clean drops
# existing objects first (this DOES overwrite current data — confirm
# you're restoring into the right place before running it for real).
docker exec -i collabos-postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < /opt/collabos/backups/collabos-postgres-<timestamp>.dump

docker compose --env-file .env.production -f docker-compose.production.yml start collabos-api
```

**Uploads** — restore into the named volume via a disposable container
(never touches a running container):

```bash
docker run --rm \
  -v collabos_uploads:/data \
  -v /opt/collabos/backups:/backup \
  alpine:3.20 \
  sh -c 'rm -rf /data/* && tar -xzf /backup/collabos-uploads-<timestamp>.tar.gz -C /data'
```

## Deploy script — `ops/deploy.sh`

Run on the VPS as `/opt/collabos/backend/ops/deploy.sh`. Flow: fetch →
checkout the given ref → build → **backup first** → `prisma migrate
deploy` (never `reset`/`db push`) → recreate only the CollabOS containers
→ health-check → **does not roll back automatically on failure** (see
below) but does stop before anything destructive if a check fails.

```bash
./ops/deploy.sh feature/opportunity-studio   # or a specific commit SHA
```

Never prints or logs a secret — everything it touches lives in
`.env.production`, which it passes through `--env-file` without ever
`cat`-ing it.

## Rollback

- **Code**: `git checkout <previous-known-good-SHA>` in
  `/opt/collabos/backend`, rebuild the image, `docker compose ... up -d
  --force-recreate collabos-api`. The previous image tag also stays
  available locally (`docker images collabos-backend`) until pruned, so a
  rebuild isn't even always necessary — `docker compose ... up -d` with
  `COLLABOS_IMAGE_TAG=<previous-sha>` in `.env.production` reuses it
  directly.
- **Database**: **Prisma migrations are not automatically reversible.**
  There is no `prisma migrate rollback` in this codebase. Rolling the
  *code* back to a commit whose Prisma schema doesn't match an
  already-applied migration will break at the ORM layer (columns/tables
  the older code doesn't expect). If a bad migration needs undoing:
  restore from the most recent pre-migration backup (above) rather than
  attempting to hand-write a down-migration under time pressure. This is
  exactly why `ops/deploy.sh` always backs up immediately before
  `migrate deploy`.
- Containers/volumes are never deleted by any script here — rollback
  never needs to recreate Postgres/Redis from scratch unless you choose to.
