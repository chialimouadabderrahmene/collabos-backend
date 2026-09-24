# Frontend ↔ backend gaps

Contract gaps discovered while building the frontend. Each entry names the
screens affected, what the UI does today, and whether a backend change was
made. Only one backend change was made (entry 1); everything else is
documented here and handled in the frontend without inventing endpoints.

Severity: **High** = wrong data or money; **Medium** = missing capability or
inconsistent authorization model; **Low** = UX/performance.

## Resolved with an isolated backend change

### 1. No "brands I belong to" endpoint — **added `GET /v1/brands/mine`**

- **Needed by:** the brand/workspace switcher, Home greeting (brand name), onboarding resume, and Create Opportunity (`POST /opportunities` requires a `brandId`).
- **Problem:** `GET /v1/brands` is a public, unscoped search with no member filter, and `GET /v1/users/me` does not include brands. A returning user, or anyone on a new device, had no way to find their brands.
- **Change (isolated commit `b0b967f`, read-only):** `GET /v1/brands/mine` → `MyBrandResponse[]`, i.e. `BrandResponse` plus the caller's `role`. Returns active brands where the caller is the legal owner or a `BrandMember`. Unit-tested; declared before `GET /brands/:id`. No schema, migration or domain-logic change.

## High severity — recommend fixing before launch

### 2. Checkout ignores product currency (orders always `USD`)

- **Where:** `src/orders/services/checkout.service.ts` → `tx.order.create({ data: { … } })` never sets `currency`, so every order falls back to the Prisma default `USD`. Payments are then created from `order.subtotal` in the order's currency.
- **Observed live:** a product priced €420 produced an order of **US$840** for 2 units.
- **Impact:** customers are charged in the wrong currency; analytics and payouts report USD.
- **Suggested fix (not applied — backend change outside the frontend's needs):** set `currency` from the products in each brand group and reject mixed-currency carts per brand.
- **Frontend today:** displays whatever currency the order carries; the bag shows amounts without a currency symbol (see 3) rather than guess.

## Medium severity

| # | Screens | Gap | Current frontend behaviour |
|---|---|---|---|
| 3 | Bag (`/cart`) | `CartResponse` / `CartItemResponse` have no `currency` (and no `productId`, so the UI can't look it up). | Amounts shown as plain numbers with a note that each brand's currency applies. |
| 4 | Deals, contracts, briefs, drops, products, orders (seller side), analytics, payouts of a brand | These modules authorize the brand's **legal owner** (`brand.ownerId`) or platform ADMIN only. `BrandMember` roles (OWNER/ADMIN/EDITOR/VIEWER) apply only to Opportunities. A brand ADMIN member cannot see the brand's deals or sales, and brand identity (`PATCH /brands/:id`, profile, logo) is owner-only too. | UI mirrors this: owner-only screens explain who can act; nothing is hidden that the backend would allow. Recommend migrating these modules to `BrandAccessService` roles. |
| 5 | Messages | Conversation participants carry only `userId` (no name/avatar). | Threads are titled by context: brand name for `BRAND` threads (flagged "Inquiry" when it's my brand), deal title for `DEAL` threads. |
| 6 | Messages realtime | The Socket.IO gateway authenticates with a bearer token (`auth.token`, header or query). Tokens live in httpOnly cookies and are never exposed to browser JS. | Threads poll every 5 s and the inbox every 15 s. Needs a short-lived WS ticket endpoint or cookie-based socket auth via the BFF. |
| 7 | Brand profile "Propose Collaboration" | No endpoint to pitch a brand directly; proposals are applications to a brief. | Button opens the brand's first open brief; if none, it starts a `BRAND` conversation. |
| 8 | Deal ↔ contract ↔ application lookups | No `GET /contracts?dealId=`, no deal-by-application, and `GET /applications` (mine) has no `briefId` filter. | Client-side matching over the first 100 items (`limit=100`). Breaks beyond 100 deals/contracts/applications. |
| 9 | Drop page builder | `ctaUrl`, `heroImageUrl`, `ogImageUrl`, `canonicalUrl` are only `MaxLength`-validated — `javascript:` URLs are accepted. | Editor blocks non-http(s) CTA links; the public `/d/[slug]` page renders a CTA only through `safeHref` (http/https). Backend should validate with `@IsUrl({ protocols: ['https','http'] })`. |
| 10 | Card payments | Backend returns a PaymentIntent `clientSecret` but exposes no publishable key. | Frontend reads `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public by design); the build refuses non-`pk_` values. Without it the order page says payments aren't configured and never creates a PaymentIntent. |
| 11 | Stripe Connect onboarding | `stripe.connectReturnUrl` / `connectRefreshUrl` are backend config. | Must be set to the frontend's `/payouts` in each environment. The UI only follows `https://*.stripe.com` onboarding links. |
| 12 | Media storage model | Opportunity assets use signed, expiring URLs; legacy media (brand logo/cover, drop/product media, message attachments) are public `/uploads/*` paths. | Frontend never constructs storage URLs; it uses what the API returns and proxies `/uploads/*` through Next rewrites so the backend host stays server config. Message attachments being public is a privacy concern. |

## Low severity

| # | Screens | Gap | Current frontend behaviour |
|---|---|---|---|
| 13 | Home / Explore "match %" | Match scores exist only per brand (`GET /ai/brand-match/:brandId`), no batch endpoint. | Scores shown only where fetched; no invented numbers. |
| 14 | Onboarding "country" | Brand profile has free-text `location`, no country. | Country select writes into `profile.location`. |
| 15 | Registration without SMTP | `POST /auth/register` returns 500 when mail is unreachable although the account is created. | Register form retries sign-in once and continues if it succeeds. |
| 16 | Session refresh across instances | Refresh tokens rotate; the BFF single-flights refresh per server instance. | Multi-instance deployments need sticky sessions or a shared lock. |
| 17 | Brand follow | No `isFollowing` on brand responses. | Follow button omitted (would otherwise show wrong state). |
| 18 | Account security | No change-password endpoint (only forgot/reset by email). | Profile offers "Email me a password reset link". |
| 19 | Traffic analytics | `POST /analytics/track` requires a persistent `visitorId`; storing one is a tracking identifier that needs consent (EU). | Not wired yet; Sales shows "No tracked page views". Add after a consent banner exists. |
| 20 | `GET /users/me/notifications` | Returns internal `id`/`userId` and an undocumented `inAppNotifications`. | Ignored by the UI. |
| 21 | `GET /health` on Windows dev | Disk indicator checks path `/` → `InvalidPathError` → 500 (`/health/live` fine). | Not a frontend concern; Linux/Docker unaffected. |
