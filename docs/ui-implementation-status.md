# UI implementation status

Frontend: `frontend/` (Next.js 16 App Router, React 19, TypeScript strict,
Tailwind v4, TanStack Query 5, RHF + zod, Tiptap 3, Zustand for UI state only).
Branch: `feature/opportunity-studio-ui`.

Legend: **Done** = built, wired to real endpoints, typechecked, linted;
**Live** = additionally exercised end-to-end against a running backend with
real accounts (disposable local Postgres/Redis). No mock production data exists
in the app; all test fixtures live in `*.test.ts(x)` files.

| Step | Area | Routes | Status | Notes |
|---|---|---|---|---|
| 1 | Audit | — | Done | `docs/frontend-audit.md` |
| 2 | Foundation | — | Done | BFF auth (httpOnly cookies), `/api/backend/*` proxy, typed API client, `proxy.ts` gating |
| 3 | Design system | — | Done | Tokens sampled from the references; Button, fields, badges, avatar, cards, tabs, modal/bottom sheet, drawer, dropdown, tooltip, toasts, skeleton/empty/error states, SVG bar chart |
| 4 | Shell | all authenticated | Done | Desktop rail + workspace group; mobile 5-tab bar; brand switcher |
| 5 | Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Live | Recovery pages send `no-referrer` + `noindex` (tokens in query) |
| 6 | Onboarding | `/onboarding` | Live | 3 steps, resumes when a brand exists |
| 7 | Home | `/home` | Live | |
| 8 | Explore + brand profile | `/explore`, `/explore/brands/[brandId]` | Live | Brand profile includes Shop section |
| 9 | Opportunity creation | `/create`, `/opportunities/new`, `/opportunities` | Live | Optional notes → AI structure *suggestion* |
| 10 | Studio | `/opportunities/[id]/studio` | Live | Autosave with revision concurrency; 409 conflict dialog never overwrites silently |
| 11 | Assets | Studio panel | Live | Prechecks, progress, signed URL refresh |
| 12 | AI | Studio panel | Done | Suggestions applied only on explicit click; 503/429/502 handled |
| 13 | Preview | `/opportunities/[id]/preview` | Live | Device frames; same renderer as public |
| 14 | Publish | `/opportunities/[id]/publish` | Live | Pins `expectedDraftRevision`; success only after backend confirms |
| 15 | Versions | `/opportunities/[id]/versions`, `…/versions/[version]` | Live | Immutable snapshots |
| 16 | Private sharing | `/opportunities/[id]/share`, `/share/[token]` | Live | Token shown once; revoke/expiry fail closed |
| 17 | Brand members / permissions | `/brand/team` | Done | Role options mirror backend rules; legal owner protected |
| 18 | Messages | `/messages`, `/messages/[id]` | Live | Polling (see gaps 5–6); attachments |
| 19 | Proposals | `/briefs/[id]`, `/briefs/new`, Deals → "My proposals", deal Proposals tab | Live | Apply/withdraw; accept/decline; counter-proposals; can't accept own |
| 20 | Deals | `/deals`, `/deals/new`, `/deals/[id]` | Live | Terms, milestones, responsibilities, complete/cancel, DEAL conversations |
| 21 | Contracts | `/contracts`, `/contracts/new`, `/contracts/[id]` | Live | Draft → revise → send → both parties sign → executed; PDF via BFF |
| 22 | Drops | `/drops`, `/drops/new`, `/drops/[id]`, public `/d/[slug]` | Live | Private drops fail closed; unlisted noindex; safe CTAs |
| 23 | Products / inventory | `/products`, `/products/new`, `/products/[id]` | Live | Variants, stock movements (never < 0), images, shopper view |
| 24 | Orders / checkout | `/cart`, `/orders`, `/orders/[id]` | Live | One order per brand; cancel restores stock; refunds; shipments. **See gap 2 (currency).** |
| 25 | Payments / payouts | Order pay panel, `/payouts` | Done | Stripe Payment Element (publishable key only); balance, withdrawals, transactions, invoices, Connect onboarding. Card flow not exercised (no Stripe keys in dev). |
| 26 | Sales / analytics | `/sales` | Live | KPIs, revenue/traffic charts, outlook (statistical fallback), CSV export |
| 27 | Profile / settings | `/profile`, `/settings`, `/brand`, `/activity` | Live | Avatar, notification/privacy/preferences, brand identity (owner), notifications |
| 28 | Responsive QA | all | Done | 375 px and 768 px: no horizontal page overflow on 20 key screens; fixes committed |
| 29 | Tests & hardening | — | Done | 85 Vitest tests; CI job; bundle scan; secret-key build guard |

## Required test scenarios

| # | Scenario | Where |
|---|---|---|
| 1 | Create Opportunity | `features/flows.test.tsx` |
| 2 | Draft saved | `features/editor/autosave.test.ts` |
| 3 | Conflict handled (409, reload/keep mine) | `features/editor/autosave.test.ts`, live-verified |
| 4 | Asset upload | `features/flows.test.tsx` |
| 5 | AI suggestion accepted only on click | `features/flows.test.tsx` |
| 6 | Publish creates version | `features/flows.test.tsx` |
| 7 | Published version displays read-only | `features/flows.test.tsx` |
| 8 | Share link shows pinned version | `app/share/[token]/share-page.test.tsx` |
| 9 | Revoked/expired share fails | `app/share/[token]/share-page.test.tsx` |
| 10 | Unauthorized user sees no protected data | `features/flows.test.tsx`, `features/workspace-flows.test.tsx`, `features/auth/auth.test.tsx` (proxy), `app/api/backend/[...path]/route.test.ts` |

## Known TODOs

- Stripe card payment and Connect onboarding need real test keys to exercise end to end.
- Realtime messaging needs a WS ticket endpoint (gap 6).
- Page-view tracking waits for a consent banner (gap 19).
- Visual fidelity was compared against low-resolution references; a pass against full-resolution Figma frames is recommended.
- E2E browser tests (Playwright) are not included; flows were verified live in the in-app browser and by component tests.
