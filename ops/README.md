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

## Caddy runtime-config drift (READ BEFORE ANY CADDY RESTART)

The shared reverse proxy on the VPS is `medismart-web-caddy-1`, owned by a
different project. CollabOS adds one isolated block (`api.neao.online`) to
that project's Caddyfile at `/opt/medismart-web-full/ops/Caddyfile`.

**Current state is intentionally not consistent — three copies exist:**

| Copy | Path | Content |
|---|---|---|
| Host file (**source of truth**) | `/opt/medismart-web-full/ops/Caddyfile` | Corrected: CollabOS upstream `172.21.0.1:3002`, no `header_up Connection/Upgrade` lines |
| **Running config** | `/config/Caddyfile.active` inside the container (`/var/lib/docker/volumes/medismart-web_caddy_config/_data/Caddyfile.active` on the host) | Byte-identical copy of the host file, loaded with `caddy reload --config /config/Caddyfile.active --adapter caddyfile` |
| Container's `/etc/caddy/Caddyfile` | read-only single-file bind mount | **Stale** — still the old inode from before the edit (upstream `127.0.0.1:3002`, which Caddy cannot reach). Not what Caddy is running. |

**Why:** editing the host file with `sed -i` replaced its inode; a Docker
single-file bind mount keeps pointing at the old one, so the container
never saw the fix. Fixing that properly means recreating/restarting the
Caddy container, which would cause downtime for other projects' sites
(medismart, adraea). A graceful `caddy reload` from a copy in Caddy's own
`/config` volume was used instead, deliberately, to avoid any downtime.

**Consequences / rules:**
- A normal `docker restart medismart-web-caddy-1` (or recreate) re-resolves
  the bind mount by path and will load the **corrected host file** — that is
  the desired outcome, and nothing else needs to change first.
- Until then, anyone running the *default* reload
  (`caddy reload --config /etc/caddy/Caddyfile`) would load the **stale**
  file and silently break `api.neao.online` (503). Use the host file's
  content via the `/config` copy, or restart the container in a maintenance
  window instead.
- If the host Caddyfile is edited again, re-copy it to `Caddyfile.active`,
  `caddy validate`, then `caddy reload` — and prefer in-place writes
  (`>>`, `cat >`), not `sed -i`/editors that replace the inode.
- Verify drift any time: compare md5 of the three files above; host and
  `Caddyfile.active` must match, the third will not until a restart.
- Do **not** add `header_up Connection {>Connection}` / `header_up Upgrade
  {>Upgrade}` to the CollabOS block: they blank the upgrade headers after
  Caddy's hop-by-hop stripping and break socket.io WebSockets (verified:
  engine.io "code 3 Bad request" with them, `101 Switching Protocols`
  without). `reverse_proxy` proxies upgrades natively.

## Port 3002 isolation (defense in depth)

The API binds to the proxy bridge gateway IP only (`COLLABOS_API_BIND_HOST`),
which limits the destination address but not the source; Docker-published
ports also sidestep UFW. `ops/collabos-fw.sh` (run at boot by
`collabos-fw.service`) therefore adds tagged (`collabos-api-3002`) INPUT and
DOCKER-USER rules: only the proxy's bridge and the host itself may reach the
port. Verified: proxy container reaches it, an unrelated container is
rejected, external access is unreachable. Note the DOCKER-USER rule matches
`--ctdir ORIGINAL` — without it reply packets are dropped too.
