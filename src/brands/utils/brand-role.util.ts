import { BrandMemberRole } from '@prisma/client';

const BRAND_ROLE_RANK: Record<BrandMemberRole, number> = {
  [BrandMemberRole.VIEWER]: 1,
  [BrandMemberRole.EDITOR]: 2,
  [BrandMemberRole.ADMIN]: 3,
  [BrandMemberRole.OWNER]: 4,
};

export function brandRoleAtLeast(
  role: BrandMemberRole | null | undefined,
  minimum: BrandMemberRole,
): boolean {
  return !!role && BRAND_ROLE_RANK[role] >= BRAND_ROLE_RANK[minimum];
}
