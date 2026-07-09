# ADR 0006: Fine-Grained Permission System (RBAC + Permissions)

## Status

Accepted

## Context

Before this turn, the schema already had `User.roles Role[]` and
`Role.permissions Permission[]` (many-to-many), the JWT payload already
embedded both role names and flattened permission names
(`AuthService.flattenPermissions`, `JwtStrategy`), and a `PermissionsGuard`
+ `@RequirePermissions()` decorator already existed, registered as a global
`APP_GUARD` alongside `RolesGuard`.

None of it was actually in use: the `Permission` table was never seeded (it
was empty), `prisma/seed.ts` only ever created the `USER` and `ADMIN` roles
with no permissions attached, and no controller anywhere used
`@RequirePermissions()` — the guard always short-circuited to `true` since
`requiredPermissions` was always empty. Investigated via a dedicated
subagent survey before writing any code, per "if a feature already exists,
leave it untouched" — rebuilding the guard/decorator/schema would have
duplicated working infrastructure.

## Decision

Given the plumbing already existed, this turn's job was to make it real:

- **`PERMISSION_CATALOG`** (`src/admin/rbac/permission-catalog.constant.ts`):
  a fixed list of `resource:action` permission names, one per existing
  admin capability area (`users:manage`, `brands:manage`, `reports:manage`,
  `moderation:manage`, `settings:manage`, `audit:view`, `dashboard:view`)
  plus `events:replay` for the reference enforcement point below.
- **Seed update** (`prisma/seed.ts`): upserts every catalog entry as a
  `Permission` row, then connects *all* of them to the `ADMIN` role. This
  keeps existing ADMIN users at full access — nothing is taken away by
  turning the permission system on.
- **RBAC admin API** (`RbacController`, `/admin/rbac/*`, `@Roles('ADMIN')`):
  list permissions, list roles with their assigned permissions, create a
  custom role, and replace a role's permission set — mirroring the existing
  `PATCH /admin/users/:id/roles` full-replacement pattern already used for
  role assignment.
- **One reference enforcement point**: `POST /events/outbox/:id/replay` and
  `POST /events/outbox/replay` now carry `@RequirePermissions('events:replay')`
  in addition to the existing `@Roles('ADMIN')`. Because the seed grants
  every catalog permission to `ADMIN`, this is non-breaking for any
  environment that runs the seed — the same reference-integration strategy
  used for the outbox pattern in ADR 0002 (pick one clean demonstration
  point rather than retrofitting every admin endpoint at once).

## What was deliberately not done

- **Not** adding `@RequirePermissions()` to the other 14 existing
  `@Roles('ADMIN')` controllers. Doing so would require auditing each one's
  actual required permission semantics (is "view" different from "manage"
  there?) — a decision for whoever owns each of those modules, not a
  mechanical find-and-replace. The pattern is proven and adoptable
  one controller at a time.
- **Not** gating the RBAC admin API itself behind a permission (e.g.
  `rbac:manage`) — doing so creates a bootstrapping problem (whoever manages
  permissions needs a permission to do so, and nothing grants it before the
  seed runs). It stays `@Roles('ADMIN')`-only, consistent with the rest of
  the admin module.

## Consequences

- Turning on enforcement for any other endpoint is: pick a permission name
  from (or add one to) `PERMISSION_CATALOG`, grant it to the relevant
  role(s) via the RBAC API or seed, add `@RequirePermissions(name)` next to
  the existing `@Roles(...)`.
- No schema migration was required for this task — `Role` and `Permission`
  already existed; this turn only populated and exposed them.
