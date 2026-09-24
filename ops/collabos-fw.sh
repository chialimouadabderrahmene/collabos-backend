#!/usr/bin/env bash
# Restricts the CollabOS API's published port so ONLY the reverse proxy's
# Docker bridge (and the host itself) can reach it. Idempotent: safe to run
# repeatedly (boot, deploy). Adds/removes only rules carrying the comment
# "collabos-api-3002" — never touches UFW's files or any other rule.
#
# Why this exists: the port is bound to the proxy bridge's gateway IP (see
# COLLABOS_API_BIND_HOST), which restricts the *destination* address only —
# any container on any other Docker network can still route to that IP.
# Docker-published ports are also well known to sidestep UFW expectations,
# so an explicit source-restricting rule is added instead of trusting UFW.
#
# Config (env, defaults match the target VPS audit):
#   COLLABOS_PROXY_BRIDGE_IF   host bridge interface of the proxy network
#   COLLABOS_PROXY_SUBNET      that network's subnet
#   COLLABOS_API_HOST_PORT     published port
#   COLLABOS_API_BIND_HOST     gateway IP the port is bound to

set -euo pipefail

IFACE="${COLLABOS_PROXY_BRIDGE_IF:-br-391da80cd2cd}"
SUBNET="${COLLABOS_PROXY_SUBNET:-172.21.0.0/16}"
PORT="${COLLABOS_API_HOST_PORT:-3002}"
BIND="${COLLABOS_API_BIND_HOST:-172.21.0.1}"
TAG="collabos-api-$PORT"

rule() { # rule <action> <args...>  (action = ACCEPT|DROP)
  local action="$1"; shift
  iptables -C INPUT "$@" -m comment --comment "$TAG" -j "$action" 2>/dev/null \
    || iptables -I INPUT 1 "$@" -m comment --comment "$TAG" -j "$action"
}

# Inserted at position 1 each time, so add in REVERSE of desired order:
# final order = accept proxy bridge, accept host-local, drop the rest.
rule DROP   -p tcp -d "$BIND" --dport "$PORT"
rule ACCEPT -p tcp -d "$BIND" --dport "$PORT" -i lo
rule ACCEPT -p tcp -d "$BIND" --dport "$PORT" -i "$IFACE" -s "$SUBNET"

echo "[collabos-fw] INPUT rules for port $PORT:"
iptables -S INPUT | grep "$TAG"
