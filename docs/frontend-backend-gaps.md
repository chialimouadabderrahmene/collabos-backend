# Frontend ↔ backend gaps

Contract gaps discovered while building the frontend. Each entry names the
screen affected, what the UI does today, and whether a backend change was made.

## Resolved with an isolated backend change

### 1. No "brands I belong to" endpoint — **added `GET /v1/brands/mine`**

- **Needed by:** the brand/workspace switcher, Home greeting (brand name), onboarding resume, and Create Opportunity (`POST /opportunities` requires a `brandId`).
- **Problem:** `GET /v1/brands` is a public, unscoped search with no member filter, and `GET /v1/users/me` does not include brands. A returning user, or anyone on a new device, had no way to find their brands. Deriving them from opportunities fails for brands with no opportunities yet.
- **Change (isolated commit, read-only):** `GET /v1/brands/mine` → `MyBrandResponse[]`, i.e. `BrandResponse` plus the caller's `role`. Returns active brands where the caller is the legal owner or a `BrandMember`. Implemented in `BrandMembersService.findMine`, unit-tested, and declared before `GET /brands/:id` so `mine` is never parsed as an id. No schema, migration or domain-logic change.

## Open gaps (frontend degrades gracefully)

| # | Screen | Gap | Current frontend behaviour |
|---|---|---|---|
| 2 | Proposals (`/proposals`) | No cross-deal proposals listing; proposals exist only per deal (`GET /deals/:id/proposals`). | `/proposals` aggregates proposals over the user's deals (`GET /deals` then per-deal proposals), capped to the first page of deals. |
| 3 | Home / Explore "match %" | Match scores exist only per brand (`GET /ai/brand-match/:brandId`) and are computed for creators. There is no batch endpoint. | Match bars are shown only where a score was fetched; no invented numbers. |
| 4 | Onboarding "country" | The brand profile has `location` (free text) but no country field. | The country select writes into `profile.location`. |
| 5 | Registration without SMTP | `POST /auth/register` returns 500 when the mail server is unreachable, although the account is created (legacy auth module). | The register form retries sign-in with the same credentials once and continues if it succeeds; otherwise it shows the generic error. |
| 6 | Session refresh across instances | Refresh tokens rotate (the old one is revoked). The BFF single-flights refreshes per server instance. | Multi-instance deployments need sticky sessions or a shared cache for the refresh single-flight. Documented in `frontend/README.md`. |

Further gaps are appended as the remaining phases are implemented.
