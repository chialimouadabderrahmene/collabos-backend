#!/usr/bin/env bash
# CollabOS deploy: fetch -> checkout -> build -> backup -> migrate deploy
# -> recreate collabos-api only -> health check. Never runs a destructive
# migration command, never touches collabos-postgres/collabos-redis
# containers (only collabos-api is recreated), never prints a secret.
#
# Usage: ops/deploy.sh <branch-or-commit-sha>
# Run from /opt/collabos/backend on the VPS.

set -euo pipefail

REF="${1:?Usage: ops/deploy.sh <branch-or-commit-sha>}"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] ERROR: $ENV_FILE not found in $(pwd) — refusing to guess. Create it (see .env.production.example) before deploying." >&2
  exit 1
fi

echo "[deploy] fetching..."
git fetch origin "$REF"

echo "[deploy] checking out $REF..."
git checkout "$REF"
# Fast-forward only, and only if REF is a branch with a remote tracking
# ref — if REF is already an exact commit SHA this simply does nothing.
git merge --ff-only "origin/$REF" 2>/dev/null || true

SHA="$(git rev-parse HEAD)"
echo "[deploy] deploying commit $SHA"

echo "[deploy] building image..."
docker build -t "collabos-backend:$SHA" -t collabos-backend:latest .

echo "[deploy] backing up before migration..."
./ops/backup.sh

echo "[deploy] applying migrations (prisma migrate deploy only — never reset or db push)..."
NET="$(docker network ls --filter name=collabos-internal --format '{{.Name}}' | head -1)"
if [ -z "$NET" ]; then
  echo "[deploy] ERROR: collabos-internal network not found — is the stack running? (docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d collabos-postgres collabos-redis first)" >&2
  exit 1
fi
docker run --rm --network "$NET" --env-file "$ENV_FILE" collabos-backend:latest npx prisma migrate deploy

echo "[deploy] recreating collabos-api only (postgres/redis untouched)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --force-recreate collabos-api

echo "[deploy] waiting for health..."
for i in $(seq 1 30); do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' collabos-api 2>/dev/null || echo unknown)"
  if [ "$STATUS" = "healthy" ]; then
    echo "[deploy] collabos-api is healthy — deploy of $SHA complete"
    exit 0
  fi
  if [ "$STATUS" = "unhealthy" ]; then
    echo "[deploy] FAILED: collabos-api reported unhealthy. Not rolling back automatically." >&2
    echo "[deploy] Check: docker logs collabos-api" >&2
    echo "[deploy] Previous image is still on disk (docker images collabos-backend) if you need to redeploy it manually." >&2
    exit 1
  fi
  sleep 2
done

echo "[deploy] FAILED: timed out waiting for collabos-api to report healthy." >&2
exit 1
