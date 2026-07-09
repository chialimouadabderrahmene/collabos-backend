import { Injectable } from '@nestjs/common';
import { NotificationPreferences } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { toPreferencesResponse } from '../mappers/notification.mapper';
import { PreferencesResponse } from '../types/notification-response.types';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string): Promise<PreferencesResponse> {
    const preferences = await this.getOrCreate(userId);
    return toPreferencesResponse(preferences);
  }

  async update(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponse> {
    await this.getOrCreate(userId);

    const preferences = await this.prisma.notificationPreferences.update({
      where: { userId },
      data: dto,
    });

    return toPreferencesResponse(preferences);
  }

  async getOrCreate(userId: string): Promise<NotificationPreferences> {
    const existing = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.notificationPreferences.create({ data: { userId } });
  }
}
