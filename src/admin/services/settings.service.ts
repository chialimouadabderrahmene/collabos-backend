import { Injectable } from '@nestjs/common';
import { PlatformSettings } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { toPlatformSettingsResponse } from '../mappers/admin.mapper';
import { PlatformSettingsResponse } from '../types/admin-response.types';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PlatformSettingsResponse> {
    const settings = await this.getOrCreate();
    return toPlatformSettingsResponse(settings);
  }

  async update(
    admin: AuthenticatedUser,
    dto: UpdateSettingsDto,
  ): Promise<PlatformSettingsResponse> {
    const existing = await this.getOrCreate();

    const settings = await this.prisma.platformSettings.update({
      where: { id: existing.id },
      data: { ...dto, updatedById: admin.id },
    });

    return toPlatformSettingsResponse(settings);
  }

  private async getOrCreate(): Promise<PlatformSettings> {
    const existing = await this.prisma.platformSettings.findFirst();

    if (existing) {
      return existing;
    }

    return this.prisma.platformSettings.create({ data: {} });
  }
}
