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

# Traffic from another container's bridge to a *published* port is DNAT'd by
# Docker and takes the FORWARD path (chain DOCKER-USER), where the INPUT
# rules above never see it. Match on the ORIGINAL destination (pre-DNAT) and
# only the ORIGINAL direction (replies come back from the API's own bridge
# and must not be dropped), so this only ever affects new requests aimed at
# this API's published port that didn't arrive on the proxy's bridge.
# Rebuilt on every run: delete any existing rules carrying our tag first, so
# a changed definition can't leave a stale rule behind.
while iptables -S DOCKER-USER | grep -q -- "--comment $TAG"; do
  N="$(iptables -L DOCKER-USER --line-numbers -n | awk -v t="$TAG" '$0 ~ t {print $1; exit}')"
  iptables -D DOCKER-USER "$N"
done
iptables -I DOCKER-USER 1 -p tcp \
  -m conntrack --ctorigdst "$BIND" --ctorigdstport "$PORT" --ctdir ORIGINAL \
  ! -i "$IFACE" -m comment --comment "$TAG" -j DROP

echo "[collabos-fw] rules for port $PORT:"
iptables -S INPUT | grep "$TAG"
iptables -S DOCKER-USER | grep "$TAG"
