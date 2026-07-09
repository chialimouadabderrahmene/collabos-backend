import { PrismaService } from '../../prisma/prisma.service';

export async function findPriorBrandIdsForCreator(
  prisma: PrismaService,
  creatorId: string,
): Promise<string[]> {
  const [deals, applications] = await Promise.all([
    prisma.deal.findMany({
      where: { creatorId },
      select: { brandId: true },
    }),
    prisma.application.findMany({
      where: { applicantId: creatorId },
      select: { brief: { select: { brandId: true } } },
    }),
  ]);

  const brandIds = new Set<string>();
  deals.forEach((deal) => brandIds.add(deal.brandId));
  applications.forEach((application) =>
    brandIds.add(application.brief.brandId),
  );

  return Array.from(brandIds);
}
