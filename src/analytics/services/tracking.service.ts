import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackPageViewDto } from '../dto/track-page-view.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async track(dto: TrackPageViewDto): Promise<void> {
    await this.prisma.pageView.create({
      data: {
        brandId: dto.brandId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        visitorId: dto.visitorId,
        referrer: dto.referrer,
      },
    });
  }
}
