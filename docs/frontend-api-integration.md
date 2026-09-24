# Frontend ↔ API integration

Status of the connection between `frontend/` (branch `feature/opportunity-studio-ui`)
and the production backend at **`https://api.neao.online`**. Verified live on
2026‑09‑24 with disposable test accounts (see "Verification" below). Remaining
mismatches are in [`frontend-backend-gaps.md`](./frontend-backend-gaps.md).

## Architecture

```
Browser ── same-origin ──▶ Next.js (BFF) ──server-side fetch──▶ https://api.neao.online/v1/*
   │  cookies: cos_at (httpOnly)              API_URL (server-only env, one source of truth:
   │           cos_rt (httpOnly)              src/lib/env.server.ts)
   │           cos_session=1 (route gating only, not a credential)
   └─ signed media GETs (opportunity assets) go straight to api.neao.online/storage/*
      (short-lived HMAC URLs returned by the API; no credentials involved)
```

- **`API_URL`** is a server-only variable (never `NEXT_PUBLIC_`). It is read in exactly one place, `src/lib/env.server.ts`. In development it falls back to `http://localhost:3000`; **in production the build/boot fails if it is unset** (a silent localhost fallback would be an outage). Production value: `API_URL=https://api.neao.online`.
- **Every server-side backend call** goes through that value: `lib/auth/backend-fetch.ts` (proxy + token refresh), `app/api/auth/[action]` (login/register/logout), `lib/auth/session.ts` (refresh), `lib/api/share.server.ts` and `lib/api/drops.server.ts` (public server-rendered pages), and `next.config.ts` (`/uploads/*` rewrite).
- The browser only calls same-origin `/api/auth/*` and `/api/backend/*` (`lib/api/http.ts`, `lib/api/assets.ts` for XHR upload progress). Nothing in the browser bundle knows the backend URL.

### Proxy (`/api/backend/<path>` → `${API_URL}/v1/<path>`)

| Concern | Behaviour |
|---|---|
| Path safety | Each segment must match `[A-Za-z0-9._~-]`, never `.`/`..`; encoded slashes → 400. Upstream host is fixed; no user-supplied URLs. |
| Token routes | `auth/login`, `register`, `refresh`, `logout` are refused (404) — only `/api/auth/*` may issue tokens, and it strips them from the response. |
| Request headers forwarded | `content-type`, `accept`, `idempotency-key`, `x-request-id` only. Browser `cookie`/`authorization` are never forwarded; the access token is attached server-side. |
| Response headers returned | `content-type`, `content-disposition`, `cache-control`, `x-request-id`, `retry-after`. **`set-cookie` is never returned.** |
| Bodies | JSON and multipart pass through as raw bytes. |
| Timeouts | 30 s (JSON), 120 s (multipart upload), 15 s (refresh/share), 10 s (logout). Timeout → **504**, unreachable → **502**. |
| Refresh | On 401 (or missing access cookie) the BFF rotates the refresh token once (single-flight per instance, 30 s reuse window) and retries. Refresh failure clears the session. |

## Auth flow

`POST /api/auth/register|login` → backend `/v1/auth/*` → tokens moved into httpOnly cookies, body returns only `{ user }`. `POST /api/auth/logout` revokes the refresh token server-side and clears cookies. `src/proxy.ts` redirects signed-out visitors to `/login?next=…` (UX only; the backend authorizes every call).

## API modules and the backend routes they consume

| Module (`src/lib/api`) | Backend routes (`/v1`) |
|---|---|
| `auth.ts` | `GET auth/me`, `POST auth/forgot-password`, `auth/reset-password`, `auth/verify-email` (+ `/api/auth/*` BFF for login/register/logout) |
| `users.ts` | `GET users/me`; `PATCH users/me/profile`; `POST/DELETE users/me/avatar`; `GET/PATCH users/me/settings`, `/preferences`, `/notifications`, `/privacy` |
| `brands.ts` | `GET brands`, `GET brands/mine`, `GET/PATCH brands/:id`, `PATCH brands/:id/profile`, `PATCH brands/:id/categories`, `POST brands/:id/logo\|cover`, `POST/DELETE brands/:id/follow`, `GET/POST/PATCH/DELETE brands/:id/members[/:userId]`, `POST brands`, `GET categories` |
| `opportunities.ts` | `GET/POST opportunities`, `GET/PATCH/DELETE opportunities/:id`, `POST :id/restore`, `GET :id/activity`, `GET/PUT :id/draft`, `POST :id/publish`, `GET :id/versions[/:n]`, `GET/POST/DELETE :id/members`, `GET/POST/DELETE :id/share-links` |
| `assets.ts` | `GET/POST opportunities/:id/assets`, `PATCH/DELETE :id/assets/:assetId` |
| `ai.ts` | `POST opportunities/:id/ai/generate\|rewrite\|summarize\|structure\|titles`, `GET :id/ai/suggestions`, `POST :id/ai/suggestions/:sid/accept\|discard`, `GET ai/brand-match/:brandId`, `GET ai/revenue-prediction/:brandId` |
| `share.server.ts` | `GET share/:token` (unauthenticated, server-side) |
| `briefs.ts`, `applications.ts` | `GET/POST briefs`, `GET briefs/:id`, `POST briefs/:id/close\|archive`; `GET/POST applications`, `GET applications/brief/:briefId`, `GET applications/:id`, `POST applications/:id/withdraw\|accept\|reject` |
| `deals.ts` | `GET/POST deals`, `GET deals/:id`, `POST :id/complete\|cancel`, proposals / responsibilities / milestones sub-resources |
| `contracts.ts` | `GET/POST contracts`, `GET :id`, `GET/POST :id/versions`, `GET :id/versions/:n/pdf`, `POST :id/send\|void\|sign`, `GET :id/signatures\|history` |
| `drops.ts`, `drops.server.ts` | `GET/POST drops`, `GET drops/:id`, `GET drops/slug/:slug`, `PATCH :id`, `POST :id/schedule\|publish\|archive`, `PATCH :id/visibility\|page\|seo`, `GET/POST/DELETE :id/media`, `GET/POST/PATCH/DELETE :id/products` |
| `products.ts` | `GET/POST products`, `GET/PATCH/DELETE products/:id`, variants CRUD, `POST/GET :id/variants/:vid/stock`, `GET/POST/DELETE :id/media` |
| `orders.ts` | `GET/POST/PATCH/DELETE cart[/items]`, `POST orders/checkout`, `GET orders[/:id]`, `POST :id/cancel`, refunds and shipments sub-resources |
| `payments.ts` | `POST payments/orders\|deals`, `GET payments/:id`, `POST :id/refund`, `GET payments/connect/status`, `POST payments/connect/onboard`, `GET payments/invoices`, `POST payments/invoices/:paymentId`, `GET payments/invoices/:id/pdf`, `GET payments/transactions`, `GET payouts/balance\|transfers\|reports/summary`, `POST payouts/withdraw` |
| `messages.ts` | `GET/POST messaging/conversations`, `GET :id`, `GET/POST :id/messages` (multipart field `attachment`), `POST :id/seen` |
| `notifications.ts` | `GET notifications`, `POST notifications/:id/read`, `POST notifications/read-all` |
| `analytics.ts` | `GET analytics/reports/summary\|export`, `analytics/revenue/chart`, `analytics/traffic/chart` |

**Webhook:** the frontend never calls webhooks. Stripe posts to
`https://api.neao.online/v1/payments/webhook/stripe` (payouts:
`/v1/payouts/webhook/stripe`). The old `/payments/webhook` path appears nowhere in the frontend.

## Feature flows

- **Opportunity Studio:** `GET draft` (`format:"blank"`, revision 0 for a new draft) → autosave `PUT draft` with `baseRevision`; the server returns the new `revision`. Content is Tiptap JSON with `format:"tiptap"`, `schemaVersion:1`. A stale `baseRevision` → **409** with `details.currentRevision`; the editor pauses autosave and shows "This draft was changed elsewhere" (copy / download / keep mine / reload) — nothing is overwritten silently.
- **Assets:** multipart `POST …/assets` (field `file`, `kind`), response carries `reference: "asset:<uuid>"` (what the document stores) and a signed `url` (display only, never persisted). Dimensions are computed server-side.
- **AI:** each action returns a suggestion the user previews, then accepts/discards; the draft is never auto-overwritten. `503 "AI assistance is not configured"` renders an unavailable state, not an error toast or fake output.
- **Publish / versions / share:** publish returns the new immutable `versionNumber`; share links are pinned to a version, the raw token is returned once at creation, and `/share/[token]` calls the real `GET share/:token` server-side (`noindex`, `no-referrer`). The share URL shown/copied is built from `window.location.origin` (the backend's `url` field carries the backend's own `CLIENT_URL`, which is still a placeholder).

## Verification (live, 2026‑09‑24, disposable data only)

| Area | Result |
|---|---|
| Login/refresh/logout/proxy hardening | ✅ tokens only in httpOnly cookies; login body has no tokens; missing/garbage access token → transparent refresh with rotation; logout revokes server-side (old refresh → 401); `..`, `auth/login`, `auth/refresh`, encoded slashes rejected; no `set-cookie` passthrough |
| Opportunity: create/list/get/patch/draft/autosave/409/reload | ✅ (also in a real browser: autosave → "Saved · rev 1"; concurrent change → conflict panel) |
| Assets: upload, signed URL fetch, list, insert reference, browser upload + render | ✅ (after backend fix: uploads volume permissions) |
| Publish v1 → edit → publish v2, v1 unchanged, share link pinned to v1, anonymous open, revoke → 404 | ✅ |
| AI | 🟡 backend returns 503 (no `ANTHROPIC_API_KEY`) — UI state only |
| Team members: add/list/role/remove, viewer denied | ✅ |
| Briefs → application → accept → deal → counter-proposal → milestones/responsibilities → contract → send → both sign (`EXECUTED`) | ✅ |
| Messaging: create conversation, send, unread list, messages, seen | ✅ (polling; realtime blocked by cookie auth — gap 6) |
| Drops: create, products, publish | ✅ (`bodyContent` field name matches) |
| Commerce: EUR 420×2 → **EUR 840**; USD 100×2 → **USD 200**; mixed EUR+USD → 400; cancel restores stock 8→10 | ✅ |
| Payments (`POST payments/orders`) | ❌ 500 — Stripe keys are placeholders on the VPS (see gaps) |
| Responsive 375/768/1024/1440 (explore, studio, preview, publish, share, cart, home) | ✅ no horizontal overflow (checked with viewport emulation) |
| Secret scan of `.next` (browser + server) | ✅ none of the listed names/prefixes present |

## Known blockers (not frontend bugs)

See [`frontend-backend-gaps.md`](./frontend-backend-gaps.md) §"Deployment findings" — pending backend redeploy, Stripe TEST keys, SMTP, frontend domain for `CLIENT_URL`/`CORS_ORIGIN`.
