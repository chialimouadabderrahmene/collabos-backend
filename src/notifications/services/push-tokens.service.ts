import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterPushTokenDto } from '../dto/register-push-token.dto';
import { toPushTokenResponse } from '../mappers/notification.mapper';
import { PushTokenResponse } from '../types/notification-response.types';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    userId: string,
    dto: RegisterPushTokenDto,
  ): Promise<PushTokenResponse> {
    const pushToken = await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform, isActive: true },
    });

    return toPushTokenResponse(pushToken);
  }

  async findMine(userId: string): Promise<PushTokenResponse[]> {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map((token) => toPushTokenResponse(token));
  }

  async deactivate(id: string, userId: string): Promise<void> {
    const token = await this.prisma.pushToken.findUnique({ where: { id } });

    if (!token) {
      throw new NotFoundException('Push token not found');
    }

    if (token.userId !== userId) {
      throw new ForbiddenException('You cannot remove this push token');
    }

    await this.prisma.pushToken.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
