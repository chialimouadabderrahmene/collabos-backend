# CollabOS frontend

Next.js (App Router) client for the CollabOS API in the parent directory.

## Run locally

```bash
cp .env.example .env.local   # set API_URL to the backend origin
npm ci
npm run dev -- --port 3001
```

The backend's `CLIENT_URL` / `CORS_ORIGIN` should point at this app (emailed
reset/verify links use `CLIENT_URL`). Stripe Connect return/refresh URLs should
point at `/payouts`.

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build / server |
| `npm run lint` | ESLint (incl. React Compiler rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest + Testing Library (jsdom) |

## Environment

| Variable | Exposure | Notes |
|---|---|---|
| `API_URL` | server only | Backend origin. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | browser | Publishable key (`pk_…`) only; the build fails on anything else. Empty disables in-app card payments. |

## Architecture

- **BFF auth.** `/api/auth/[action]` exchanges credentials with the backend and
  stores access/refresh tokens in httpOnly cookies (`cos_at`, `cos_rt`) plus a
  non-secret `cos_session` flag used only for route gating. Browser JS never
  sees a token.
- **API proxy.** `/api/backend/[...path]` forwards to `${API_URL}/v1/…`,
  attaching the bearer server-side, refreshing once on 401 (single-flight per
  instance — use sticky sessions or a shared lock when running several
  instances, because refresh tokens rotate). It refuses token-issuing auth
  routes and dot-segment paths and never forwards `set-cookie`.
- **Authorization.** `src/proxy.ts` gating and role checks in components are
  UX only; the backend authorizes every request.
- **Server state** lives in TanStack Query (`src/lib/api/query-keys.ts`);
  Zustand holds UI state only (active brand id, studio panels, toasts).
- **Documents.** Opportunity drafts are Tiptap JSON (`schemaVersion 1`) with
  assets referenced as `asset:<uuid>`; one `DocumentRenderer` (no raw HTML)
  serves preview, versions and public share pages.
- **Public pages.** `/share/[token]` and `/d/[slug]` are server-rendered from
  public endpoints and fail closed.

## Layout

```
src/app          routes: (auth) (onboarding) (dashboard) (studio), share/, d/, api/
src/components   ui/ design system, navigation/, editorial/ renderer, domain/ cards
src/features     one folder per product area (screens + hooks)
src/lib          api/ typed clients, auth/ BFF session, validation/ zod, utils/
```

See `../docs/frontend-audit.md`, `../docs/frontend-backend-gaps.md` and
`../docs/ui-implementation-status.md`.
