import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Brand } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';

export async function assertBrandOwner(
  prisma: PrismaService,
  brandId: string,
  user: AuthenticatedUser,
): Promise<Brand> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });

  if (!brand) {
    throw new NotFoundException('Brand not found');
  }

  if (brand.ownerId !== user.id && !user.roles.includes('ADMIN')) {
    throw new ForbiddenException('You do not have access to this brand');
  }

  return brand;
}
