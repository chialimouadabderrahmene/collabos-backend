/** The fixed catalog of fine-grained permission names. Role→Permission
 * assignment is dynamic (managed via the RBAC admin API), but the set of
 * permission names themselves is a fixed catalog seeded at deploy time —
 * consistent with how @Roles() already treats role names as an open string,
 * while permissions are the enumerable, auditable unit of access. */
export const PERMISSION_CATALOG = [
  'users:manage',
  'brands:manage',
  'reports:manage',
  'moderation:manage',
  'settings:manage',
  'audit:view',
  'dashboard:view',
  'events:replay',
] as const;

export type PermissionName = (typeof PERMISSION_CATALOG)[number];
