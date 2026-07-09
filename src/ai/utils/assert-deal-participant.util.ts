import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';

export function assertDealParticipant(
  deal: { creatorId: string; brand: { ownerId: string } },
  user: AuthenticatedUser,
): void {
  const isCreator = deal.creatorId === user.id;
  const isBrandOwner = deal.brand.ownerId === user.id;
  const isAdmin = user.roles.includes('ADMIN');

  if (!isCreator && !isBrandOwner && !isAdmin) {
    throw new ForbiddenException('You do not have access to this deal');
  }
}
