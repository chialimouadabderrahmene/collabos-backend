import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from '../dto/update-notification-preferences.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdatePrivacySettingsDto } from '../dto/update-privacy-settings.dto';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import {
  NotificationPreferencesResponse,
  PrivacySettingsResponse,
  UserPreferencesResponse,
  UserSettingsResponse,
} from '../types/user-response.types';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string): Promise<UserSettingsResponse> {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async getPreferences(userId: string): Promise<UserPreferencesResponse> {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserPreferencesResponse> {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferencesResponse> {
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponse> {
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async getPrivacySettings(userId: string): Promise<PrivacySettingsResponse> {
    return this.prisma.privacySettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePrivacySettings(
    userId: string,
    dto: UpdatePrivacySettingsDto,
  ): Promise<PrivacySettingsResponse> {
    return this.prisma.privacySettings.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
