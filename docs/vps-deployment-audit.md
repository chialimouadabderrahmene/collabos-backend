# VPS deployment audit — CollabOS backend

Live discovery against the target VPS (Contabo, `169.58.30.9`, hostname
`vmi3445686`), read-only, via SSH key auth (no password used or requested).
Nothing on this host was changed to produce this document.

**This is a busy, shared production host running several other clients'
live services**, at least one of which appears to be medical/patient-data
software (`medismart-web`). Every proposal below is designed to touch
nothing that isn't CollabOS's own.

## Host

| | |
|---|---|
| OS | Ubuntu 24.04.4 LTS (noble), kernel 6.8.0-136-generic |
| CPU | 4 vCPU |
| RAM | 7.8 GiB total, 2.3 GiB free, 4.8 GiB "available" (buff/cache reclaimable) |
| Disk | 96G on `/`, 74G used (78%), **22G free** — watch this; see Resource headroom below |
| Uptime | 64 days |
| Docker | 29.6.2 |
| Docker Compose | v5.3.1 (plugin) |
| git / openssl | 2.43.0 / OpenSSL 3.0.13 — both present, no install needed |
| Public IPv4 | `169.58.30.9` (the address you gave me) |
| Public IPv6 | `2a02:c207:2344:5686::1` (host's own outbound default) |

## Services already running — must not be touched

### Docker containers

| Container | Project | Status | Host ports | Notes |
|---|---|---|---|---|
| `medismart-web-caddy-1` | medismart-web | Up 3 weeks | **0.0.0.0:80, 0.0.0.0:443** | **The host's shared reverse proxy.** See below. |
| `medismart-web-app-1` | medismart-web | Up 2 weeks (healthy) | — (8000/tcp internal) | FastAPI backend behind Caddy |
| `medismart-web-postgres-1` | medismart-web | Up 8 weeks (healthy) | — (internal only) | |
| `medismart-web-backup-1` | medismart-web | Up 6 weeks | — | |
| `medismart-landing`/`medismart-cloud-landing-1` | medismart-cloud | Up 2 months | — (3000/tcp internal) | Reverse-proxied by the shared Caddy for `medismart.software` |
| `adraea-postgres` | adraea | Up 4 weeks | **127.0.0.1:5433→5432** | Loopback-only, not public |
| `aurelia` | — | Up 8 weeks | — (3000/tcp internal, but see host-level `next-server` below) | |
| `gestion-medicale-mysql` | gestion-medicale | Up 12 hours | **0.0.0.0:3306, [::]:3306** | Pre-existing, publicly bound — not mine to comment further on or touch |
| `guardtime-backend-1`, `guardtime-postgres-1`, `guardtime-redis-1`, `guardtime-dns-service-1` | guardtime | Up 2 months (healthy) | — (internal only) | Same "no published DB/Redis port" pattern I'm proposing for CollabOS — already this host's convention |
| Several `Exited` containers (medismart-cloud-*, `epic_montalcini`) | — | Exited | — | Stopped, not running, left alone |

### Host-level (non-Docker) listeners

| Port | Process | What |
|---|---|---|
| 22 (tcp, v4+v6) | sshd | SSH — the connection I'm using now |
| 80, 443 (tcp, v4+v6) | `docker-proxy` → `medismart-web-caddy-1` | **Already fully occupied.** Nginx cannot bind here without stopping this. |
| 3000 | `node /opt/guard...` (guardtime) | **Occupied** — my earlier draft's default API port collides with this |
| 3001 | `next-server` (aurelia, presumably) | Occupied |
| 3306 (v4+v6) | `docker-proxy` → gestion-medicale-mysql | Occupied, unrelated |
| 5432 (127.0.0.1 + ::1) | `postgres` (systemd `postgresql@16-main.service`) | **Native, host-installed Postgres — not Docker, not mine, never reuse** |
| 5433 (127.0.0.1) | `docker-proxy` → adraea-postgres | Loopback-only, unrelated |
| 6379 (127.0.0.1 + ::1) | `redis-server` (systemd `redis-server.service`) | **Native, host-installed Redis — not Docker, not mine, never reuse** |
| 8080 | `node /opt/guard...` (guardtime) | Occupied |

`nginx` **is installed** (`/usr/sbin/nginx`) but **inactive** — not running, not in the way, but also can't simply be started on 80/443 without conflicting with the Caddy container already there.

### Firewall (UFW) — active, default deny incoming

```
22, 80, 443, 53/tcp, 53/udp   ALLOW IN  Anywhere (+ v6 equivalents)
3001/tcp                      ALLOW IN  172.21.0.0/16   # scoped to adraea, not the world
```

fail2ban: active, one jail (`sshd`).

### `/opt/` layout (other projects, not touched)

`adraea/`, `adraea.git/`, `aurelia/`, `guardtime/`, `guardtime-backup-*.tar.gz` (117M, a backup file sitting loose — not mine), `medismart-desktop/`, `medismart-landing/`, `medismart-web-full/`. **No `collabos/` directory exists yet — the path is free.**

## The reverse proxy: Caddy, not Nginx — and it's the right model to extend

`medismart-web-caddy-1` is the *single shared* reverse proxy for this whole
host's public HTTP(S) traffic. Its config lives at
`/opt/medismart-web-full/ops/Caddyfile` (bind-mounted into the container —
this is *another project's own repo path*, not a general host-owned config
location).

Reading it (read-only) shows the host's operator already uses **one Caddy
instance, multiple independent site blocks** for unrelated projects sharing
the same 80/443 — there are already three: the medismart app itself,
`medismart.software` (a different, unrelated landing page, proxied to its
own container), and `app.adraea.com`/`adraea.com` (a totally separate
project, reached via the Docker bridge gateway since it runs under `pm2` on
the host, not in this compose project). Each cert is obtained and renewed
by Caddy automatically per-block.

**This means CollabOS should not install/run its own Nginx or a second
Caddy fighting for 80/443.** The established, low-risk, already-proven
pattern on this host is to add one more isolated block to this same
Caddyfile — exactly what the release plan itself asked for ("add one
isolated server block, do not replace the entire config"), just with Caddy
syntax instead of Nginx's. I have **not** touched this file. I'll propose
the exact block for review before ever appending to it, given it currently
terminates TLS for a live client's production app.

## Blocker: the domain doesn't exist in DNS

```
$ nslookup api.collabos.software   → Non-existent domain
$ nslookup collabos.software       → Non-existent domain
```

`collabos.software` isn't resolving at all — not misconfigured, simply not
registered-and-pointed anywhere I can see. Per your own instruction ("If
that domain is not configured, ask me for the exact domain to use. Do not
invent DNS records.") — **I need you to either confirm you own this domain
and will point its DNS at `169.58.30.9` (A record for `api`, or the whole
domain), or give me a different domain to use.** Caddy's automatic HTTPS
needs a real A record in place *before* it can request a cert — adding the
site block before DNS resolves would just produce a failed ACME challenge
(and repeated failures risk Let's Encrypt rate-limiting the domain).

## Proposed CollabOS architecture on this host

```
Internet
  ↓ 443 (existing, shared)
medismart-web-caddy-1  (existing container, gets ONE more site block)
  ↓ reverse_proxy 127.0.0.1:3002
collabos-api  (new container, binds 127.0.0.1 only)
  ↓ (docker network, no published ports)
collabos-postgres, collabos-redis  (new containers, internal-only)
```

### Proposed ports

| Purpose | Value | Why |
|---|---|---|
| API host-mapped port | **`127.0.0.1:3002`** | 3000 and 3001 are both taken on this host; 3002 is free. Loopback-only — the existing Caddy reaches it over `127.0.0.1`, never exposed beyond that. |
| Postgres | not published to host at all | Matches the guardtime/medismart-web-postgres precedent already on this host |
| Redis | not published to host at all | Same |

This matches `docker-compose.production.yml` already drafted in this repo
(commit `8106470`) except that file's *default* host port was `3000` —
**needs updating to `3002`** before first use here, since 3000 is occupied.
I have not yet made that change; flagging it here rather than silently
editing a file that was already reviewed once, pending this whole plan's
go-ahead.

### Deployment path

`/opt/collabos/backend` — confirmed free, standard sibling to the other
projects' `/opt/<name>` layout already used on this host.

### Storage

Not yet decided — Phase 6 of the release plan asks this be a deliberate
choice, not silent. `STORAGE_PROVIDER=local` (with a mounted Docker volume,
already stubbed in `docker-compose.production.yml`) is the simpler option
for a first deployment and needs no external account; S3/R2 needs
credentials I don't have yet. Your call.

## Resource headroom

- **Disk: 22G free of 96G (78% used).** Adding Postgres + Redis + the API
  image + growing data should fit comfortably to start, but this is worth
  watching — not urgent, but don't let it surprise you later. `/opt/`
  itself only accounts for ~4.5G of the 74G used; the rest is Docker's own
  storage (`/var/lib/docker`) plus the rest of the OS.
- **RAM: 2.3G free / 4.8G available** across 4 existing multi-service
  Docker projects plus 2 native services (Postgres, Redis) plus 2 host-level
  Node processes. CollabOS's API + its own Postgres + its own Redis should
  fit, but this isn't a lightly-loaded box — worth monitoring after
  deployment (Phase 27), not assuming.

## What I have not done

- Not created `/opt/collabos/`, not cloned anything, not touched Docker on
  this host, not touched the Caddyfile, not touched UFW, not touched any
  existing container/volume/network.
- Not decided the storage provider (needs your call).
- Not confirmed DNS (blocker above — needs your action).

## Update — domain and storage decided

- **Domain: `api.neao.online`** (confirmed by the VPS/domain owner). Note:
  bare `neao.online` already resolves to this VPS (`169.58.30.9`) and is
  already a site block in the shared Caddyfile (redirects to
  `adraea.com`) — `api.neao.online` is a *different* hostname, Caddy
  matches blocks by exact hostname, so this is a clean, independent
  addition with zero interaction with that existing block. Checked
  separately: `api.neao.online` itself does **not** resolve yet (NXDOMAIN)
  — an A record (and optionally AAAA for `2a02:c207:2344:5686::1`) still
  needs to be added at whatever DNS provider hosts `neao.online`, before a
  real TLS cert can be issued for it.
- **Storage: persistent local VPS storage** for this first deployment
  (not S3/R2). `.env.production.example` and `docker-compose.production.yml`
  updated accordingly — the `collabos_uploads` named volume is enabled,
  `STORAGE_LOCAL_PUBLIC_BASE_URL` points at `https://api.neao.online/storage`.
- `CLIENT_URL`, `CORS_ORIGIN`, `STRIPE_CONNECT_REFRESH_URL`, and
  `STRIPE_CONNECT_RETURN_URL` all need the frontend's eventual domain, not
  this API's — left blank in the template rather than guessed.

## Next steps, in order

1. **You:** confirm the real domain and point its DNS at `169.58.30.9` (or
   give me a different one).
2. **You:** decide `STORAGE_PROVIDER` (local disk here, or S3/R2 — and if
   R2/S3, the credentials).
3. **Me, once 1–2 are answered:** update the Compose file's default API
   port to `3002`, clone `feature/opportunity-studio` @ `8106470` into
   `/opt/collabos/backend`, build the image, create `.env.production` on
   the VPS with generated infra secrets (JWT/webhook/storage-signing) and
   your real Stripe TEST / SMTP / storage credentials (still needs to come
   from you, not invented), start the three containers, run
   `prisma migrate deploy`.
4. **Me, with your review of the exact diff first:** append one isolated
   `api.<domain> { reverse_proxy 127.0.0.1:3002 ... }` block to the shared
   Caddyfile, `caddy validate`, then reload — never a blind edit to a file
   that's currently serving a live client.
