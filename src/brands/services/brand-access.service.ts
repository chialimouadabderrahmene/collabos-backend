import { Injectable } from '@nestjs/common';
import { BrandMemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface BrandAccess {
  brandId: string;
  ownerId: string;
  role: BrandMemberRole;
}

/**
 * Single source of truth for "what can this user do inside this brand".
 * The brand's legal owner (`Brand.ownerId`) is always OWNER, even if their
 * BrandMember row is missing; everyone else needs a BrandMember row.
 * Inactive (suspended) brands grant no access.
 */
@Injectable()
export class BrandAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(brandId: string, userId: string): Promise<BrandAccess | null> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        ownerId: true,
        isActive: true,
        members: { where: { userId }, select: { role: true } },
      },
    });

    if (!brand || !brand.isActive) {
      return null;
    }

    if (brand.ownerId === userId) {
      return { brandId: brand.id, ownerId: brand.ownerId, role: 'OWNER' };
    }

    const [membership] = brand.members;
    return membership
      ? { brandId: brand.id, ownerId: brand.ownerId, role: membership.role }
      : null;
  }
}
