# Frontend audit (Step 1)

Date: 2026-09-24 · Branch: `feature/opportunity-studio-ui` (from `feature/opportunity-studio` @ `d597992`)

## Findings

| # | Question | Finding |
|---|---|---|
| 1 | Frontend already present? | **No.** The repository is the NestJS backend only (0 `.tsx/.jsx/.css` files). |
| 2 | Frontend package/app? | None. No `next`, `react`, Vite or Tailwind dependency or config anywhere. |
| 3 | Next.js/React config? | None. |
| 4 | UI components? | None. |
| 5 | API clients? | None. The backend exposes Swagger at `/api/docs` when `SWAGGER_ENABLED=true`. |
| 6 | Environment variables? | Backend only (`.env.example`). `CLIENT_URL` (default `http://localhost:5173`) and `CORS_ORIGIN` exist for a future frontend; `OPPORTUNITY_SHARE_BASE_URL` defaults to `${CLIENT_URL}/share`. |
| 7 | Authentication partially implemented? | Backend only: JWT access (15 min) + refresh (7 d) tokens returned **in the JSON body** of `POST /v1/auth/{register,login,refresh}`; `POST /v1/auth/logout` takes the refresh token; `GET /v1/auth/me`. No cookies are set by the backend. |
| 8 | Design system? | None in code. The only design source is the provided screenshots (see "Design references"). |
| 9 | Routing? | None on the frontend. Backend routes are URI-versioned under `/v1/*` (health, metrics, storage are version-neutral). |
| 10 | Same repository or isolated? | **Same repository, isolated app in `frontend/`.** See decision below. |

## Decision: `frontend/` app in this repository

- The requested branch strategy (`feature/opportunity-studio-ui` next to the backend PR) implies one repository.
- The frontend is a **self-contained Next.js app** in `frontend/` with its own `package.json`, lockfile, lint, tests and build. It imports nothing from the backend `src/`.
- Backend isolation is config-only: the root `tsconfig.json` excludes `frontend`, and `.dockerignore` excludes it from the backend image. No backend domain code changes.
- Deployment: the frontend can be deployed independently (e.g. a platform root directory of `frontend/`).

## Session / token strategy (from the auth contract)

Because the backend returns tokens in JSON, the frontend uses a **backend-for-frontend (BFF)**:

- `app/api/auth/*` route handlers call the backend and store the access and refresh tokens in **httpOnly, Secure, SameSite=Lax cookies**. Tokens are never readable by browser JavaScript.
- `app/api/backend/[...path]` proxies client API calls to `${API_URL}/v1/*`, attaching `Authorization: Bearer` from the cookie. On a 401 it performs one refresh-token rotation and retries.
- `middleware.ts` gates `(dashboard)` routes on session presence; the backend remains the authority for every permission decision.
- `API_URL` is a **server-only** env var (no `NEXT_PUBLIC_` backend secrets).

## Backend API surface relevant to the UI

All routes below are prefixed with `/v1`.

- **Auth**: `POST auth/register|login|refresh|logout|forgot-password|reset-password|verify-email`, `GET auth/me`
- **Users**: `GET users/me`, `PATCH users/me/profile`, avatar, settings, preferences, notifications, privacy
- **Brands**: `GET brands` (public search), `POST brands`, `GET/PATCH brands/:id`, `GET/PATCH brands/:id/profile`, logo/cover upload, follow, `GET categories`
- **Brand team**: `GET/POST brands/:brandId/members`, `PATCH/DELETE brands/:brandId/members/:userId`
- **Opportunities**: CRUD + restore, activity, members, `GET/PUT :id/draft`, assets, `POST :id/publish`, versions, share links, AI (`generate|rewrite|summarize|structure|titles`, suggestions accept/discard)
- **Public share**: `GET share/:token`
- **Collaboration**: `briefs`, `applications`, `messaging/conversations`, `deals` (+ proposals, milestones, responsibilities, health), `contracts` (+ versions, signatures, send/sign/void)
- **Commerce**: `drops` (+ page, SEO, media, products, publish/schedule), `products` (+ variants, stock, media), `cart`, `orders` (+ checkout, refunds, shipments)
- **Finance**: `payments` (+ connect, invoices, transactions), `payouts` (+ balance, transfers, withdraw, summary), `analytics/*`
- **AI (legacy)**: `ai/recommendations`, `ai/brand-match/:brandId`, `ai/deal-health/:dealId`, `ai/launch-readiness/:dropId`, `ai/revenue-prediction/:brandId`
- **Notifications**: `notifications`, read / read-all, preferences

Contract gaps are tracked in [`frontend-backend-gaps.md`](frontend-backend-gaps.md).

## Design references

- 20 screenshots of the CollabOS mobile design: v1 screens 00–44 and iterations V2, V7, V8 and S01–S13.
- **Resolution limitation:** each phone frame is only about **120–145 px wide** (the real design is ~390 px). Palette, layout, hierarchy, component anatomy and density can be extracted reliably. Exact pixel spacing and font metrics cannot, and are reconstructed to a consistent 4 px grid. **Full-resolution Figma frames are needed for a pixel-level QA pass.**
- Palette sampled from the images:

| Role | Colour |
|---|---|
| Base | `#080808` |
| Surface | `#101010` |
| Raised surface | `#181818` |
| Border | `#242424` |
| Accent (acid lime) | `#C8FF00` |
| Lime tint | `#182004` |
| Success tint | `#041C10` |
| Warning tint | `#201804` |
| Danger | `#C03838` |
| Info / "verified" | `#285080` |
| Text | `#FFFFFF` / `#C8C8C8` / `#909090` / `#585858` |
