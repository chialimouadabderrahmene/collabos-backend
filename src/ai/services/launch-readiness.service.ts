import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { LaunchReadinessResponse } from '../types/ai-response.types';
import { computeLaunchReadiness } from '../utils/launch-readiness-score.util';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';

@Injectable()
export class LaunchReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly promptService: PromptService,
    private readonly configService: ConfigService,
  ) {}

  async getReadiness(
    dropId: string,
    user: AuthenticatedUser,
  ): Promise<LaunchReadinessResponse> {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      include: {
        brand: true,
        page: true,
        seo: true,
        media: true,
        products: true,
      },
    });

    if (!drop) {
      throw new NotFoundException('Drop not found');
    }

    if (drop.brand.ownerId !== user.id && !user.roles.includes('ADMIN')) {
      throw new ForbiddenException('You do not have access to this drop');
    }

    const ttl = this.configService.get<number>('ai.cacheTtlSeconds') ?? 900;

    const { value, cached } = await this.cacheService.getOrCompute(
      `launch-readiness:${dropId}`,
      ttl,
      async () => {
        const { score, blockers } = computeLaunchReadiness({
          status: drop.status,
          publishAt: drop.publishAt,
          hasPage: drop.page !== null,
          hasSeo: drop.seo !== null,
          mediaCount: drop.media.length,
          productCount: drop.products.length,
        });

        const narrative = await this.promptService.launchReadinessNarrative({
          dropTitle: drop.title,
          score,
          blockers,
        });

        return {
          dropId,
          score,
          blockers,
          narrative: narrative.text,
          generatedByAi: narrative.generatedByAi,
        };
      },
    );

    return { ...value, cached };
  }
}
